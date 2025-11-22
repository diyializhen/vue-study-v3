import { h, defineAsyncComponent } from '../../src/runtime-core/index.js'

// 模拟请求组件
function requestComponent(content = '异步组件内容', time = 2000, isError = false) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const component = {
        setup() {
          return () => h('div', content)
        }
      }
      isError ? reject(JSON.stringify({ msg: '加载失败' })) : resolve(component)
    }, time)
  })
}

// 组件1正常加载
const MyComponent1 = defineAsyncComponent({
  loader: () => requestComponent('组件1加载成功，显示内容', 3000),
  delay: 1000, // 延迟显示loading组件
  timeout: 5000, // 超时时间
  loadingComponent: {
    setup() {
      return () => h('div', '组件1加载中...')
    }
  },
  errorComponent: {
    setup() {
      return () => h('div', '组件1加载失败!')
    }
  },
})
// 组件2超时
const MyComponent2 = defineAsyncComponent({
  loader: () => requestComponent('组件2加载成功，显示内容', 10000),
  timeout: 3000, // 超时时间
  loadingComponent: {
    setup() {
      return () => h('div', '组件2加载中...')
    }
  },
  errorComponent: {
    setup() {
      return () => h('div', '组件2加载失败!')
    }
  },
})

export default {
  setup() {
    
    return () => {
      return h('div', [
        h('h2', 'defineAsyncComponent异步组件测试'),
        h('div', h(MyComponent1)),
        h('div', h(MyComponent2)),
      ])
    }
  },
}
