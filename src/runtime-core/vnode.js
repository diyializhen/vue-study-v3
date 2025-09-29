import { isObject, isString, isArray } from "../shared/shared.js"
import { normalizeClass, normalizeStyle } from "../shared/normalizeProp.js"
import { isProxy } from "../reactivity/index.js"

// 定义节点的type类型
export const Text = Symbol()
export const Comment = Symbol()
export const Fragment = Symbol()

// 创建vnode
export function createVNode(type, props, children) {
  if (props) {
    if (isProxy(props)) {
      // 如果是代理对象，需要克隆，防止改变props触发代理
      props = Object.assign({}, props)
    }
    // 规范class和style
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    if (isObject(style)) {
      if (isProxy(style) && !isArray(style)) {
        // 代理对象可能会被修改，需要克隆
        style = Object.assign({}, style)
      }
      props.style = normalizeStyle(style)
    }
  }
  const vnode = {
    __v_isVNode: true,
    type,
    props,
    children,
    el: null,
    component: null,
    // key非null非undefined时，存key，否则就是null
    key: props && (props.key != null ? props.key : null),
  }
  return vnode
}

export function createTextVNode(text) {
  return createVNode(Text, {}, text)
}

// 判断是否为VNode
export function isVNode(value) {
  return value ? value.__v_isVNode : false
}

// h 函数，适配传参的多种形式
export function h(type, propsOrChildren, children) {
  const l = arguments.length
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // 是对象
      if (isVNode(propsOrChildren)) {
        // 是虚拟节点
        return createVNode(type, null, [propsOrChildren])
      }
      // 否则是属性
      return createVNode(type, propsOrChildren)
    } else {
      // 不是对象
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    // 规范children
    if (l > 3) {
      // 超出3个参数，第三个参数及后面的组成子节点数组
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
