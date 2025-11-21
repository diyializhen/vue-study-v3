import { h } from '../src/runtime-core/index.js'
import { createApp } from '../src/runtime-dom/index.js'
import { RouterView, RouterLink } from './vueRouter.js'
import routers from './routers.js'

// 根组件
const App = {
  name: 'App',
  setup() {
    const onLinkClick = (to) => {
      console.log(`----------路由切换：${to}----------`)
    }

    return () => {
      // 遍历路由列表，生成连接标签
      const links = routers.map(item => {
        return h(
          'div',
          h(
            RouterLink,
            {
              to: item.path,
              class: 'el-link el-link--primary',
              onClick: onLinkClick
            },
            { default: () => item.meta.title }
          )
        )
      })
      return h('section', { class: 'el-container' }, [
        h('aside', { class: 'el-aside', style: { width: '200px' } }, links),
        h('main', { class: 'el-main' }, h(RouterView))
      ])
    }
  }
}

createApp(App).mount(document.querySelector('#app'))
