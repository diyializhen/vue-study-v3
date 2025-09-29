import { RAW, createBaseHandlers, createCollectionHandlers } from "./handlers.js"
import { toRawType } from '../shared/shared.js'

const reactiveMap = new WeakMap()
const shallowReactiveMap = new WeakMap()
const readonlyMap = new WeakMap()
const shallowReadonlyMap = new WeakMap()

export function reactive(obj) {
  return createReactiveObj(obj, reactiveMap)
}

export function shallowReactive(obj) {
  return createReactiveObj(obj, shallowReactiveMap, true)
}

export function readonly(obj) {
  return createReactiveObj(obj, readonlyMap, false, true)
}

export function shallowReadonly(obj) {
  return createReactiveObj(obj, shallowReadonlyMap, true, true)
}

export function isProxy(value) {
  // 有RAW属性，说明是代理对象
  return value ? !!value[RAW] : false
}

const TargetType = {
  INVALID: 0,
  COMMON: 1,
  COLLECTION: 2,
}
function targetTypeMap(rawType) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}
function getTargetType(value) {
  return !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

function createReactiveObj(obj, proxyMap, isShallow, isReadonly) {
  // 如果obj已经创建了代理对象，直接返回已有的代理对象。
  // 如果每次访问都是返回一个新的代理对象，则下面这种情况includes查找的和arr[0]返回的两个代理对象是不同的
  // const arr = reactive([{}])
  // arr.includes(arr[0]) // false
  const existionProxy = proxyMap.get(obj)
  if (existionProxy) return existionProxy
  const targetType = getTargetType(obj)
  // 不是targetTypeMap中列出来的类型不代理
  if (targetType === TargetType.INVALID) {
    return target
  }
  // 根据数据类型使用不同的拦截选项
  const proxy = new Proxy(
    obj,
    targetType === TargetType.COLLECTION 
      ? createCollectionHandlers(isShallow, isReadonly) 
      : createBaseHandlers(isShallow, isReadonly)
  )
  proxyMap.set(obj, proxy)
  return proxy
}
