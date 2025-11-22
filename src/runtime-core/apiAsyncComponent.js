import { ref, shallowRef } from '../reactivity/index.js'
import { isFunction } from '../shared/shared.js'
import { onUnmounted} from './components.js'
import { Text } from './vnode.js'
import { h } from './vnode.js'

// 异步组件
export function defineAsyncComponent(options) {
  if (isFunction(options)) {
    // 如果传个函数作为loader
    options = { loader: options }
  }
  const { loader } = options
  let innerComp = null
  // 记录重试次数
  let retries = 0
  // 封装 load 函数用来加载异步组件
  function load() {
    // 捕获加载器的错误
    return loader().catch(err => {
      // 如果配置了onError回调，则将控制器交给用户
      if (options.onError) {
        return new Promise((resolve, reject) => {
          // 重试
          const retry = () => {
            resolve(load())
            retries++
          }
          // 失败
          const fail = () => reject(err)
          // 调用回调
          options.onError(retry, fail, retries)
        })
      } else {
        throw err
      }
    })
  }
  return {
    name: 'AsyncComponentWrapper',
    setup() {
      // 是否已加载
      const loaded = ref(false)
      // 定义 error，当错误发生时，用来存储错误对象
      const error = shallowRef(null)
      // 是否正在加载
      const loading = ref(false)
      let loadingTimer = null
      // 如果配置了delay，开启定时器，延迟到时设置loading.value为true，没有配置直接设置
      if (options.delay) {
        loadingTimer = setTimeout(() => {
          loading.value = true
        }, options.delay)
      } else {
        loading.value = true
      }
      // 调用加载方法
      load()
        .then(c => {
          innerComp = c
          loaded.value = true
        })
        .catch(err => error.value = err)
        .finally(() => {
          // 加载完毕，清除定时器并更新loading.value为false
          loading.value = false
          clearTimeout(loadingTimer)
        }) 
      let timer = null
      // 如果配置了超时时长
      if (options.timeout) {
        timer = setTimeout(() => {
          // 超时后创建一个错误对象，并复制给 error.value
          if (loaded.value || error.value) return
          const err = new Error(`Async component timed out after${options.timeout}ms.`)
          error.value = err
        }, options.timeout)
      }
      // 组件被卸载时清除定时器
      onUnmounted(() => clearTimeout(timer))
      const placeholder = h(Text, '')
      return () => {
        if (loaded.value) {
          // 加载成功渲染组件
          return h(innerComp)
        } else if (error.value && options.errorComponent) {
          // 只有当错误存在且用户配置了 errorComponent 时才展示 Error组件，同时将 error 作为 props 传递
          return h(options.errorComponent, { error: error.value })
        } else if (loading.value && options.loadingComponent) {
          // 如果异步组件正在加载，并且配置了loading组件，则渲染loading组件
          return h(options.loadingComponent)
        } else {
          return placeholder
        }
      }
    }
  }
}
