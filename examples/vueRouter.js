import { Fragment } from '../src/runtime-core/index.js'
import { h } from '../src/runtime-core/index.js'
import { ref } from '../src/reactivity/index.js'
import routers from './routers.js'

// vue router 简单实现，方便功能测试

export const RouterView = {
  name: 'RouterView',
  setup() {
    const currentRoute = ref(null)
    const setRoute = () => {
      const hash = location.hash
      const path = hash.slice(1)
      const route = routers.find(route => route.path === path)
      currentRoute.value = route
    }

    window.addEventListener('hashchange', () => {
      setRoute()
    })
    if (!location.hash) {
      location.hash = '/'
    }
    setRoute()

    return () => {
      return h(Fragment, h(currentRoute.value.component))
    }
  }
}

export const RouterLink = {
  name: 'RouterLink',
  setup(props, { slots, emit }) {
    const onLinkClick = () => {
      location.hash = props.to
      emit('click', props.to)
    }
    return () => {
      const { onClick, ...restProp } = props
      return h('a', {
        onClick: onLinkClick,
        ...restProp
      }, slots.default())
    }
  }
}
