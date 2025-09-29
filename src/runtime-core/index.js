export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  getCurrentInstance,
} from './components.js'

export {
  Text,
  Comment,
  Fragment,
  createVNode,
  createTextVNode,
  isVNode,
  h,
} from './vnode.js'

export { queueJob, nextTick } from './scheduler.js'

export { createRenderer } from './renderer.js'

export { defineAsyncComponent } from './apiAsyncComponent.js'

export { KeepAlive, onActivated, onDeactivated } from './components/KeepAlive.js'
export { Teleport } from './components/Teleport.js'
export { Transition } from './components/Transition.js'
