import { h } from '../../src/runtime-core/index.js'
import { ref } from '../../src/reactivity/index.js'
import {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
} from '../../src/runtime-core/index.js'

// 生命周期
export default {
  name: 'LifeCycle',
  setup() {
    const count = ref(0)
    setTimeout(() => {
      count.value++
    }, 2000)
    onBeforeMount(() => console.log('触发onBeforeMount'))
    onMounted(() => console.log('触发onMounted'))
    onBeforeUpdate(() => console.log('触发onBeforeUpdate'))
    onUpdated(() => console.log('触发onUpdated'))
    onBeforeUnmount(() => console.log('触发onBeforeUnmount'))
    onUnmounted(() => console.log('触发onUnmounted'))

    return () => h('div', `生命周期，2秒后触发更新：${count.value}`)
  }
}