// 用一个全局变量存储被注册的副作用函数
export let activeEffect
// 用一个栈存储副作用函数。
// 当多个effect嵌套的时候，只用activeEffect，内层的副作用函数执行后赋值到activeEffect，覆盖了外层的副作用函数，外层后续响应式数据收集的副作用函数就不对了。通过栈解决，当前副作用函数执行时入栈，执行完毕出栈，activeEffect始终指向栈顶。
const effectStack = []
// effect 函数用于注册副作用函数
export function effect(fn, options = {}) {
  const effectFn = () => {
    // 因为副作用函数依赖的值变化重新执行时，函数中可能有三元表达式或者if语句，导致此副作用函数依赖改变，所以先清除存储的副作用函数，执行副作用函数时在track函数重新收集最新的。
    cleanup(effectFn)
    activeEffect = effectFn // 设置activeEffect
    effectStack.push(effectFn) // 入栈
    const res = fn()
    effectStack.pop() // 执行完毕后出栈
    activeEffect = effectStack[effectStack.length - 1] // 更新activeEffect
    return res // 返回fn的返回结果
  }
  effectFn.options = options // 挂载options，如果有scheduler函数，则响应数据发生变化拿到effectFn不会直接执行，而是调用scheduler
  // 用来存储所有与该副作用函数相关联的Set集合，便于清除
  effectFn.deps = []
  // 如果无lazy，立即执行
  if (!options.lazy) {
    effectFn()
  }
  // 否则有lazy，不立即执行，将effectFn return出去，可以手动执行
  return effectFn
}
function cleanup(effectFn) {
  for (let i = 0, len = effectFn.deps.length; i < len; i++) {
    let deps = effectFn.deps[i] // 依赖集合
    deps.delete(effectFn)
  }
  effectFn.deps.length = 0 // 重置effectFn的deps数组
}
