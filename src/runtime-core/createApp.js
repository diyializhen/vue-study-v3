import { createVNode } from "./vnode.js"
export function createAppAPI(render) {
  let isMounted = false
  return function createApp(rootComponent) {
    const app = {
      _component: rootComponent,
      _container: null,
      mount(rootContainer) {
        if (!isMounted) {
          const vnode = createVNode(rootComponent)
          render(vnode, rootContainer)
          isMounted = true
          app._container = rootContainer
        } else {
          console.error('App has already been mounted')
        }
      },
      unmount() {
        if (isMounted) {
          render(null, app._container)
          isMounted = false
        } else {
          console.error('Cannot unmount an app that is not mounted.')
        }
      },
    }
    return app
  }
}