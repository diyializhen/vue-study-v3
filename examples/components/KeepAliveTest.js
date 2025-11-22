import { h } from '../../src/runtime-core/index.js'
import { ref } from '../../src/reactivity/index.js'
import { KeepAlive, onActivated, onDeactivated } from '../../src/runtime-core/index.js'

const CachedCom = {
  name: 'CachedCom',
  setup() {
    onActivated(() => {
      console.log('activated')
    })
    onDeactivated(() => {
      console.log('deactivated')
    })
    return () => {
      return h('div', [
        h('h3', '被keepAlive的子组件'),
        h('div', { class: 'el-input' }, h('input', { class: 'el-input__inner' })),
      ])
    }
  },
}

const NotCachedCom = {
  name: 'NotCachedCom',
  setup() {
    return () => {
      return h('div', [
        h('h3', '没有被keepAlive的子组件'),
        h('div', { class: 'el-input' }, h('input', { class: 'el-input__inner' })),
      ])
    }
  },
}

export default {
  setup() {
    const index = ref(1)
    function toggle() {
      index.value = index.value === 1 ? 2 : 1
    }

    return () => {
      return h('div', [
        h('h2', 'KeepAlive测试'),
        h('div', '在输入框中输入文字，被keepAlive的input文字不会丢失'),
        h(
          'button',
          { onClick: toggle, class: 'el-button el-button--default el-button--mini' },
          '切换组件'
        ),
        h(
          KeepAlive,
          { include: ['CachedCom'], exclude: ['NotCachedCom'] },
          { default: () => h(index.value === 1 ? CachedCom : NotCachedCom) }
        ),
      ])
    }
  },
}
