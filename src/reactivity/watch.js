import { effect } from "./effect.js"
import { isRef } from "./ref.js"
import { isObject, isArray, isMap, isSet, isPlainObject } from "../shared/shared.js"

export function watch(source, cb, options = {}) {
  let getter
  // watch可以观测getter函数或响应式数据
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }
  let oldValue, newValue
  // cleanup 用来存储用户注册的过期回调
  let cleanup
  function onInvalidate(fn) {
    cleanup = fn
  }
  const job = () => { 
    // 依赖数据变化，执行effectFn得到新值
    newValue = effectFn()
    // 在下次调用回调函数 cb 之前，先调用上次注册的过期回调
    if (cleanup) {
      cleanup()
    }
    cb(newValue, oldValue, onInvalidate)
    // 更新旧值
    oldValue = newValue
  }
  const effectFn = effect(
    () => getter(),
    {
      // 开启lazy，不立即执行副作用函数，后续手动调用
      lazy: true,
      scheduler: () => {
        if (options.flush === 'post') {
          // 如果flush为post，则将cb回调放到微任务中延迟执行
          const p = Promise.resolve()
          p.then(job)
        } else {
          job()
        }
      }
    }
  )
  if (options.immediate) {
    // 当 immediate 为 true 时立即执行 job，从而触发cb回调执行
    job()
  } else {
    // 手动调用副作用函数，拿到旧值
    oldValue = effectFn()
  }
}

// 递归遍历读取对象，收集所有依赖数据，从而可监听任意属性变化
function traverse(value, depth = Infinity, seen = new Set()) {
  // 如果读取的非对象或者读取过了，return
  if (!isObject(value) || depth <= 0 || seen.has(value)) {
    return value
  }
  // 保存已经读取过的数据，避免有循环引用数据时导致死循环
  seen.add(value)
  depth--
  if (isRef(value)) {
    traverse(value.value, depth, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, seen)
    }
  } else if (isMap(value) || isSet(value)) {
    value.forEach((v) => {
      traverse(v, depth, seen)
    })
  } else if (isPlainObject) {
    // 普通对象
    for (const key in value) {
      traverse(value[key], depth, seen)
    }
    // 遍历对象所有自有symbol属性
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        // 是对象的可枚举自有属性
        traverse(value[key], depth, seen)
      }
    }
  }
  return value
}
