import { isArray, isString } from '../shared/shared.js'

/* 
HTML Attributes 指的就是定义在 HTML 标签上的属性，比如 id="app"、type="text"，
当浏览器解析HTML代码后，会创建一个与之相符的 DOM 元素对象，可以通过JS读取该DOM对象，
这个对象包含很多属性，就是 DOM Properties。例如id="app"对应的el.id。
但 DOM Properties 与 HTML Attributes 的名字不总是一模一样的，也可能没有对应属性。
比如class="foo"对应el.className
el.textContent设置文本内容，但是没有对应的HTML Attributes
自己定义的HTML Attributes没有对应的DOM Properties
*/

function shouldSetAsProps(el, key, value) {
  // 特殊处理, <input form="form1" /> 中el.form是只读的
  if (key === 'form' && el.tagName === 'INPUT') return false
  // 兜底，用in判断key是否存在对应的DOM Properties
  return key in el
}

// 设置更新属性
export function patchProp(el, key, prevValue, nextValue) {
  if (/^on/.test(key)) {
    // 匹配以 on 开头的属性，视其为事件
    // 使用一个伪造的invoker函数当做事件，真正的事件在invoker.value上，这样更新的时候不需要解绑再绑定
    // 获取为该元素伪造的事件处理函数 invoker
    const invokers = el._vei || (el._vei = {})
    let invoker = invokers[key]
    const name = key.slice(2).toLowerCase()
    if (nextValue) {
      if (!invoker) {
        // 如果 invoker 不存在，则将事件处理函数赋值给 invoker
        // vei 是 vue event invoker 的首字母缩写
        invoker = el._vei[key] = (e) => {
          // e.timeStamp 是事件发生的时间
          // 如果事件发生的时间早于事件处理函数绑定的时间，则不执行事件处理函数
          // 原因：假如子元素点击，其click事件中更改响应变量bol为true，父元素bol如为true则绑定click事件，子元素点击时，bol改变触发渲染函数执行，给父元素绑定了事件，更新完成后click事件才冒泡到父元素，导致父元素事件触发。vue在微任务队列更新，但微任务会穿插在事件冒泡的多个事件函数之间执行，无法控制。
          if (e.timeStamp < invoker.attached) return
          // 如果是数组，遍历执行
          if (isArray(invoker.value)) {
            invoker.value.forEach(fn => fn(e))
          } else {
            invoker.value(e)
          }
        }
        // 将真正的事件处理函数赋值给 invoker.value
        invoker.value = nextValue
        // 添加 invoker.attached 属性，存储事件处理函数被绑定的时间
        invoker.attached = performance.now()
        el.addEventListener(name, invoker)
      } else {
        // 如果 invoker 存在，只需要更新 invoker.value的值即可
        invoker.value = nextValue
      }
    } else if (invoker) {
      // 新事件nextValue不存在，之前绑定的invoker存在，则移除绑定的事件
      el.removeEventListener(name, invoker)
    }
  } else if (key === 'class') {
    // class虽然可以通过setAttribute设置，但el.className性能最好，单独处理
    if (nextValue == null) { // null 或 undefined
      el.removeAttribute('class')
    } else {
      el.className = nextValue
    }
  } else if (key === 'style') {
    // 处理style
    patchStyle(el, prevValue, nextValue)
  } else if (shouldSetAsProps(el, key, nextValue)) {
    const type = typeof el[key]
    // 如果是布尔类型，并且 value 是空字符串，则将值矫正为 true。
    // 比如 <input disabled />，其DOM属性el.disabled为布尔值类型
    if (type === 'boolean' && nextValue === '') {
      el[key] = true
    } else {
      el[key] = nextValue
    }
  } else {
    // 如果要设置的属性没有对应的 DOM Properties，则使用 setAttribute 函数设置属性
    el.setAttribute(key, nextValue)
  }
}

const displayRE = /(^|;)\s*display\s*:/
function patchStyle(el, prev, next) {
  const style = el.style
  const isCssString = isString(next)
  let hasControlledDisplay = false
  if (next && !isCssString) {
    // 有next，且next不是字符串，即是对象
    if (prev) {
      // 如果有prev旧的style，先把旧样式比新样式多的设置为空，后面在设置新样式覆盖。
      if (!isString(prev)) {
        // prev也不是字符串
        for (const key in prev) {
          if (next[key] == null) {
            setStyle(style, key, '')
          }
        }
      } else {
        // prev是字符串，以分号分割
        for (const prevStyle of prev.split(';')) {
          const key = prevStyle.slice(0, prevStyle.indexOf(':')).trim()
          if (next[key] == null) {
            setStyle(style, key, '')
          }
        }
      }
    }
    // 设置next新的样式
    for (const key in next) {
      if (key === 'display') {
        hasControlledDisplay = true
      }
      setStyle(style, key, next[key])
    }
  } else {
    // 没有next，或者next是字符串
    if (isCssString) {
      // next是字符串
      if (prev !== next) {
        style.cssText = next
        hasControlledDisplay = displayRE.test(next)
      }
    } else if (prev) {
      // 无next，有prev
      el.removeAttribute('style')
    }
  }
  // TODO：后面根据hasControlledDisplay处理v-show的逻辑
}
const importantRE = /\s*!important$/
function setStyle(style, name, val) {
  if (isArray(val)) {
    val.forEach(v => setStyle(style, name, v))
  } else {
    if (val == null) val = ''
    if (name.startsWith('--')) {
      // css变量
      style.setProperty(name, val)
    } else {
      if (importantRE.test(val)) {
        // !important
        style.setProperty(name, val.replace(importantRE, ''), '!important')
      } else {
        style[name] = val
      }
    }
  }
}
