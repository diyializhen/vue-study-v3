// 任务队列
export const queue = new Set()
const p = Promise.resolve()
// 防止多次执行
let isFlushing = false
// 添加并执行所有任务
export function queueJob(job) {
  // 添加任务
  queue.add(job)
  if (isFlushing) return
  isFlushing = true
  // .then 添加一个微任务执行queue队列中的任务
  p.then(() => {
    try {
      // 执行队列中的所有任务
      queue.forEach(job => job())
    } finally {
      // 重置状态
      isFlushing = false
      queue.clear()
    }
  })
}

export function nextTick(fn) {
  return fn ? p.then(fn) : p
}
