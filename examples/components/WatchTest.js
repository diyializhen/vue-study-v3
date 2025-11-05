import { h } from '../../src/runtime-core/index.js'
import { watch, watchEffect, reactive, ref } from '../../src/reactivity/index.js'

export default {
  setup() {
    const data1 = ref(0)
    const data2 = reactive({
      count: 2
    })
    watch(() => data1.value, (newVal, oldVal) => {
      console.log('data1数据变化', newVal, oldVal)
    })
    watch(data2, () => {
      console.log('data2数据变化')
    })
    
    watchEffect(() => {
      console.log(`watchEffect回调，data1.value:${data1.value}, data2.count:${data2.count}`)
    })

    return () => {
      return h('div', [
        h('h2', 'watch测试'),
        h('button', { onClick: () => data1.value++, class: 'el-button el-button--default el-button--mini' }, 'data1增加'),
        h('button', { onClick: () => data2.count++, class: 'el-button el-button--default el-button--mini' }, 'data2增加')
      ])
    }
  }
}
