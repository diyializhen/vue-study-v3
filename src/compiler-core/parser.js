/* 
通过Tokenizer遍历字符串，在一个状态遍历结束时执行回调并传入起止下标，
在回调函数中获取不同类型的字符串，进行处理后生成一个AST节点
通过一个栈stack来维护节点父子关系，开标签解析完毕，节点unshift入栈，解析到闭标签，从栈顶弹出匹配节点，
所以栈顶节点就是当前解析内容的父节点。

词法解析就是将字符串转换成一个个的词法单元，在这里使用一个对象来描述
语法解析就是将词法单元转换成AST树
在vue中这两步直接合并了，构建词法单元的对象，直接当做AST节点，去构建AST树。
*/

import Tokenizer, { isWhitespace, State, QuoteType } from "./tokenizer.js"
import { createRoot, NodeTypes, createSimpleExpression, ElementTypes } from "./ast.js"
import { ConstantTypes } from "./ast.js"

let currentInput = '' // 当前解析的字符串
let currentRoot = null // 当前根节点
let currentOpenTag = null // 当前开标签
let currentProp = null // 当前解析的属性
let currentAttrValue = '' // 当前解析的属性值
let currentAttrStartIndex = -1 // 当前属性值的起始下标
let currentAttrEndIndex = -1 // 当前属性值的结束下标
// 解析到开标签入栈，闭标签出栈，用于维护节点的层级关系
const stack = []

const tokenizer = new Tokenizer({
  ontext(start, end) {
    onText(getSlice(start, end), start, end)
  },
  // 插值结束
  oninterpolation(start, end) {
    // 获取插值内容下标，去除插值符号
    let innerStart = start + tokenizer.delimiterOpen.length
    let innerEnd = end - tokenizer.delimiterClose.length
    // 去除两端的空白字符
    while (isWhitespace(currentInput.charAt(innerStart))) {
      innerStart++
    }
    while (isWhitespace(currentInput.charAt(innerEnd - 1))) {
      innerEnd--
    }
    // 获取表达式
    let exp = getSlice(innerStart, innerEnd)
    if (exp.includes('&')) {
      // 解析实体字符
      exp = decodeEntities(exp, false)
    }
    // 插值节点插入父节点，content是插值内容节点
    addNode({
      type: NodeTypes.INTERPOLATION,
      content: createExp(exp, false),
    })
  },
  // 开标签名
  onopentagname(start, end) {
    // 获取标签名
    const name = getSlice(start, end)
    // 缓存
    currentOpenTag = {
      type: NodeTypes.ELEMENT, // 节点类型
      tag: name, // 标签名
      tagType: ElementTypes.ELEMENT, // 标签类型，onCloseTag里会重新设置
      props: [],
      children: [],
      codegenNode: undefined,
    }
  },
  // 开标签结束
  onopentagend(end) {
    endOpenTag(end)
  },
  // closeTag名结束
  onclosetag(start, end) {
    const name = getSlice(start, end)
    // img标签没有closeTag名，不走这个逻辑
    if (!isVoidTag(name)) {
      let found = false
      for (let i = 0; i < stack.length; i++) {
        const e = stack[i]
        if (e.tag.toLowerCase() === name.toLowerCase()) {
          // 如果找到相同的标签名
          found = true
          // stack是使用unshift添加的，如果当前闭标签不是对应下标0的元素，则说明下标0-i的元素都没有闭标签
          if (i > 0) {
            console.log(`闭标签缺失${stack[0].tag}`)
          }
          // 将0-i的元素全部弹出并执行onCloseTag逻辑
          for (let j = 0; j <= i; j++) {
            const el = stack.shift()
            onCloseTag(el, end)
          }
          break
        }
      }
      // 没找到说明这个闭标签name没有对应的开标签
      if (!found) {
        console.log(`非法的闭标签${name}`)
      }
    }
  },
  // 自闭合标签结束
  onselfclosingtag(end) {
    const name = currentOpenTag.tag
    currentOpenTag.isSelfClosing = true
    endOpenTag(end)
    if (stack[0] && stack[0].tag === name) {
      // 自闭合标签如果stack[0]是当前标签，则弹出并执行onCloseTag
      onCloseTag(stack.shift(), end)
    }
  },
  // 普通属性名
  onattribname(start, end) {
    currentProp = {
      type: NodeTypes.ATTRIBUTE,
      name: getSlice(start, end),
      value: undefined,
      loc: { start, end },
    }
  },
  // 指令v-xxx 或者这些符号 . : @ #
  ondirname(start, end) {
    const raw = getSlice(start, end)
    // 符号转换成对应的指令
    const name =
      raw === '.' || raw === ':'
        ? 'bind'
        : raw === '@'
          ? 'on'
          : raw === '#'
            ? 'slot'
            : raw.slice(2)
    if (name === '') {
      // 没有指令情况
      console.log(`缺失指令名，位置：${start}`)
      currentProp = {
        type: NodeTypes.ATTRIBUTE,
        name: raw,
        value: undefined,
        loc: { start, end },
      }
    } else {
      // 存指令节点
      currentProp = {
        type: NodeTypes.DIRECTIVE, // 类型为指令
        name, // 指令名
        rawName: raw, // 原始字符
        exp: undefined, // 指令值节点
        arg: undefined, // 指令参数节点
        modifiers: raw === '.' ? [createSimpleExpression('prop')] : [], // 修饰符节点
        loc: { start, end },
      }
    }
  },
  // 这些符号指令开头的 .xxx, :xxx, @xxx, #xxx
  ondirarg(start, end) {
    if (start === end) return
    const arg = getSlice(start, end)
    const isStatic = arg[0] !== `[`
    // 指令节点
    currentProp.arg = createExp(
      isStatic ? arg : arg.slice(1, -1),
      isStatic,
      { start, end },
      isStatic ? ConstantTypes.CAN_STRINGIFY : ConstantTypes.NOT_CONSTANT
    )
  },
  // 修饰符 .xxx
  ondirmodifier(start, end) {
    const mod = getSlice(start, end)
    if (currentProp.name !== 'slot') {
      // slot没有修饰符
      const exp = createSimpleExpression(mod, true)
      currentProp.modifiers.push(exp)
    }
  },
  // 属性值
  onattribdata(start, end) {
    currentAttrValue += getSlice(start, end)
    if (currentAttrStartIndex < 0) currentAttrStartIndex = start
    currentAttrEndIndex = end
  },
  // 属性名部分结束
  onattribnameend(end) {
    const start = currentProp.loc.start
    const name = getSlice(start, end)
    if (currentProp.type === NodeTypes.DIRECTIVE) {
      currentProp.rawName = name
    }
    // 检测重复
    if (currentOpenTag.props.some(p => (p.type === NodeTypes.DIRECTIVE ? p.rawName : p.name) === name)) {
      console.log(`属性名重复：${name}, ${start}`)
    }
  },
  // 属性值结束
  onattribend(quote, end) {
    if (currentOpenTag && currentProp) {
      currentProp.loc.end = end
      if (quote !== QuoteType.NoValue) {
        if(currentAttrValue.includes('&')) {
          // 有实体字符，解析
          currentAttrValue = decodeEntities(
            currentAttrValue,
            true,
          )
        }
        if (currentProp.type === NodeTypes.ATTRIBUTE) {
          // 是属性
          if (currentProp.name === 'class') {
            currentAttrValue = condense(currentAttrValue).trim()
          }
          if (quote === QuoteType.Unquoted && !currentAttrValue) {
            console.log(`缺失属性值${end}`)
          }
          currentProp.value = {
            type: NodeTypes.TEXT,
            content: currentAttrValue,
          }
        } else {
          // 是指令
          currentProp.exp = createExp(
            currentAttrValue,
            false,
            {
              start: currentAttrStartIndex,
              end: currentAttrEndIndex,
            },
            ConstantTypes.NOT_CONSTANT,
          )
          if (currentProp.name === 'for') {
            currentProp.forParseResult = parseForExpression(currentProp.exp)
          }
        }
      }
      currentOpenTag.props.push(currentProp)
    }
    // 重置
    currentAttrValue = ''
    currentAttrStartIndex = currentAttrEndIndex = -1
  },
  onend() {
    const end = currentInput.length
    for (let index = 0; index < stack.length; index++) {
      onCloseTag(stack[index], end - 1)
      console.log(`缺失闭标签${stack[index].tag}`)
    }
  }

})

function isUpperCase(c) {
  return c >= 'A' && c <= 'Z'
}
function getSlice(start, end) {
  return currentInput.slice(start, end)
}

// 实体字符解码，通过创建一个div，设置属性或文本
let decoder
function decodeEntities(raw, asAttr = false) {
  if (!decoder) {
    decoder = document.createElement('div')
  }
  if (asAttr) {
    decoder.innerHTML = `<div foo="${raw.replace(/"/g, '&quot;')}">`
    return decoder.children[0].getAttribute('foo')
  } else {
    decoder.innerHTML = raw
    return decoder.textContent
  }
}

// 压缩字符，将不连续的第一个空白字符转成空字符串
function condense(str) {
  let ret = ''
  let prevCharIsWhitespace = false
  for (let i = 0; i < str.length; i++) {
    if (isWhitespace(str.charAt(i))) {
      if (!prevCharIsWhitespace) {
        ret += ' '
        prevCharIsWhitespace = true
      }
    } else {
      ret += str[i]
      prevCharIsWhitespace = false
    }
  }
  return ret
}

function addNode(node) {
  ;(stack[0] || currentRoot).children.push(node)
}

function createExp(content, isStatic, loc, constType = ConstantTypes.NOT_CONSTANT) {
  // 创建表达式的节点
  const exp = createSimpleExpression(content, isStatic, loc, constType)
  return exp
}

const specialTemplateDir = new Set(['if', 'else', 'else-if', 'for', 'slot'])
// 是否是片段的template，只要有上述属性之一，就是片段的template
function isFragmentTemplate({ tag, props }) {
  if (tag === 'template') {
    for (let i = 0; i < props.length; i++) {
      if (
        props[i].type === NodeTypes.DIRECTIVE &&
        specialTemplateDir.has((props[i]).name)
      ) {
        return true
      }
    }
  }
  return false
}

// 是否是组件元素，判断开头字母是大写，或者tag为component
function isComponent({ tag, props }) {
  if (
    tag === 'component' ||
    isUpperCase(tag.charAt(0))
  ) {
    return true
  }
  return false
}

function onText(content, start, end) {
  const tag = stack[0] && stack[0].tag
  if (tag !== 'script' && tag !== 'style' && content.includes('&')) {
    // 含有HTML实体字符
    content = decodeEntities(content, false)
  }
  const parent = stack[0] || currentRoot
  const lastNode = parent.children[parent.children.length - 1]
  if (lastNode && lastNode.type === NodeTypes.TEXT) {
    // 栈顶是文本，合并
    lastNode.content += content
  } else {
    // 否则插入文本
    parent.children.push({
      type: NodeTypes.TEXT,
      content
    })
  }
}

const isVoidTag = tag => tag === 'img'
// 开标签结束，
function endOpenTag(end) {
  // 插入父节点的children
  addNode(currentOpenTag)
  if (isVoidTag(currentOpenTag.tag)) {
    // img标签直接闭标签
    onCloseTag(currentOpenTag, end)
  } else {
    // 当前开标签解析结束，将 currentOpenTag 从首位入栈
    stack.unshift(currentOpenTag)
  }
  currentOpenTag = null
}

function onCloseTag(el, end) {
  const { tag, children } = el
  // 设置标签类型
  if (tag === 'slot') {
    el.tagType = ElementTypes.SLOT
  } else if (isFragmentTemplate(el)) {
    el.tagType = ElementTypes.TEMPLATE
  } else if (isComponent(el)) {
    el.tagType = ElementTypes.COMPONENT
  }
}

const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+(\S[\s\S]*)/
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g
// 解析for的表达式
function parseForExpression(input) {
  const loc = input.loc
  const exp = input.content
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return
  // LHS: 'item' 或 '(item, i)'，RHS：'list'
  const [, LHS, RHS] = inMatch
  const createAliasExpression = (content, offset, asParam = false,) => {
    const start = loc.start + offset
    const end = start + content.length
    // 创建表达式节点
    return createExp(
      content,
      false,
      { start, end },
      ConstantTypes.NOT_CONSTANT,
    )
  }
  const result = {
    // 参数：RHS字符串，RHS位置下标，创建被遍历数据RHS的节点
    source: createAliasExpression(RHS.trim(), exp.indexOf(RHS, LHS.length)),
    value: undefined,
    key: undefined,
    index: undefined,
    finalized: false,
  }
  // 去除两端括号空格
  let valueContent = LHS.trim().replace(stripParensRE, '').trim()
  // LHS内容的位置
  const trimmedOffset = LHS.indexOf(valueContent)
  // 当内容是 'item, i' -> [', i', ' i',] 或对象的 'value, key, index' -> [', i, j', ' i', ' j',]
  // 没有逗号后面的情况则不匹配
  const iteratorMatch = valueContent.match(forIteratorRE)
  if (iteratorMatch) {
    // item, i 的 item
    valueContent = valueContent.replace(forIteratorRE, '').trim()
    // item, i 的 i
    const keyContent = iteratorMatch[1].trim()
    let keyOffset
    if (keyContent) {
      // keyContent的位置
      keyOffset = exp.indexOf(keyContent, trimmedOffset + valueContent.length)
      // 创建keyContent节点
      result.key = createAliasExpression(keyContent, keyOffset)
    }
    // 如果还有第三个参数，即'value, key, index'的索引index
    if (iteratorMatch[2]) {
      const indexContent = iteratorMatch[2].trim()
      if (indexContent) {
        // 创建索引的节点
        result.index = createAliasExpression(
          indexContent,
          // 从指定位置查找索引
          exp.indexOf(
            indexContent,
            result.key
              ? keyOffset + keyContent.length
              : trimmedOffset + valueContent.length,
          ),
          true,
        )
      }
    }
  }
  if (valueContent) {
    // 创建当前遍历值的节点
    result.value = createAliasExpression(valueContent, trimmedOffset, true)
  }
  return result
}

// 重置变量
function reset() {
  tokenizer.reset()
  currentOpenTag = null
  currentProp = null
  currentAttrValue = ''
  currentAttrStartIndex = -1
  currentAttrEndIndex = -1
  stack.length = 0
}

// 将字符串解析成AST树
export function baseParse(input) {
  reset()
  currentInput = input
  const root = (currentRoot = createRoot([], input))
  tokenizer.parse(currentInput)
  currentRoot = null
  return root
}
