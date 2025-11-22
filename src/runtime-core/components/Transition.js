
// 进场：
// beforeEnter 阶段: 从创建 DOM 元素完成后，到把 DOM 元素添加到页面前，添加 enter-from 和 enter-active类。
// enter 阶段：把 DOM 元素添加到页面后，在下一帧中移除 enter-from 类，添加 enter-to
// 过渡完成后，移除 enter-to 和 enter-active 类
// 出场：
// 设置初始 leave-from 和 leave-active类
// 在下一帧移除 leave-from 类，添加 leave-to 类
// 过渡完成后，移除 leave-to 和 leave-active 类，然后将DOM元素移除。

/* 
描述：

Transition的setup函数中，获取当前默认插槽的vnode，即需要过渡的vnode。
在需要过渡的vnode上添加transition对象，对象有beforeEnter，enter，leave三个钩子函数，判断有这个对象即需要过渡。
渲染器判断需要过渡时，在mountElement中创建的元素插入DOM之前调用beforeEnter，插入后调用enter，在unmount中要卸载过渡元素时调用leave。
这三个钩子函数中，插入和删除对应状态的class，添加事件监听过渡完成事件，使用两层requestAnimationFrame控制代码下一帧执行。
*/

// vue3源码中通过window.getComputedStyle(el)拿到计算样式，然后获取到样式类型是transition还是animation，然后监听对应的事件。还获取到设置的过渡或动画时间，通过setTimeout和事件监听的回调共同保证过渡结束执行回调.


/*
transition的子节点被编译成默认插槽
{
  type: Transition,
  children: {
    default() {
      return { type: 'div', children: '我是要过渡的元素' }
    }
  }
}
*/
export const Transition = {
  name: 'Transition',
  setup(props, { slots }) {
    const name = props.name || 'v'
    
    return () => {
      // 通过默认插槽获取需要过渡的元素
      const innerVNode = slots.default()
      if (!innerVNode) return
      // 在过渡元素的 VNode 对象上添加 transition 相应的钩子函数，渲染器在合适的时机去调用
      // 具体是在mountElement和unmount中
      innerVNode.transition = {
        // mountElement中创建元素但未插入DOM时调用
        beforeEnter(el) {
          el.classList.add(`${name}-enter-from`)
          el.classList.add(`${name}-enter-active`)
        },
        // mountElement中已插入DOM时调用
        enter(el) {
          nextFrame(() => {
            el.classList.remove(`${name}-enter-from`)
            el.classList.add(`${name}-enter-to`)
            el.addEventListener('transitionend', () => {
              el.classList.remove(`${name}-enter-to`)
              el.classList.remove(`${name}-enter-active`)
            })
          })
        },
        // unmount中需要过渡的卸载时调用
        leave(el, performRemove) {
          el.classList.add(`${name}-leave-from`)
          el.classList.add(`${name}-leave-active`)
          // 通过读取body高度，强制 reflow，使得初始状态生效
          document.body.offsetHeight
          nextFrame(() => {
            el.classList.remove(`${name}-leave-from`)
            el.classList.add(`${name}-leave-to`)
            el.addEventListener('transitionend', () => {
              el.classList.remove(`${name}-leave-to`)
              el.classList.remove(`${name}-leave-active`)
              // 卸载
              performRemove()
            })
          })
        },
      }
      // 返回要渲染的元素vnode
      return innerVNode
    }
  }
}

function nextFrame(cb) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cb && cb()
    })
  })
}
