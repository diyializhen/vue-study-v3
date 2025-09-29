import { effect } from "./effect.js"
import { track, trigger } from "./handlers.js"

// 在副作用函数里嵌套使用计算属性时，外层和内层副作用函数分别收集自己的依赖数据，但外层的effect函数没有对计算属性的依赖，所以手动调用track和trigger，把计算属性的obj添加到外层的依赖数据
export function computed(getter) {
  // 缓存上一次计算的值
  let value
  // dirty标识是否需要重新计算，如果为true表示要计算
  let dirty = true
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      // 计算属性的依赖发生变化时执行调度器
      // 此时只改变dirty标识
      dirty = true
      // 手动调用trigger触发响应，原因见上方
      trigger(obj, 'value')
    }
  })
  // 只有读取 value 时，才执行 effectFn
  const obj = {
    get value() {
      if (dirty) {
        value = effectFn()
        // 计算后表示改为false
        dirty = false
      }
      // 读取value时，手动调用track进行追踪
      track(obj, 'value')
      return value
    }
  }

  return obj
}
