import { h } from '../../src/runtime-core/index.js'
import { ref } from '../../src/reactivity/index.js'
import { nextTick } from '../../src/runtime-core/index.js'

export default { 
  setup() {
    const isShow = ref(false)
    function toggle() {
      isShow.value = !isShow.value
      console.log(document.querySelector('#next-tick-test'))
      nextTick(() => {
        console.log('nextTick获取DOM元素：')
        console.log(document.querySelector('#next-tick-test'))
      })
    }
    return () => {
      return h('div', [
        h('h2', 'nextTick测试'),
        h('button', { onClick: toggle }, '点击切换'),
        h('div', isShow.value ? h('div', { id: 'next-tick-test' }, 'xxxxxx') : null)
      ])
    }
  }
}
