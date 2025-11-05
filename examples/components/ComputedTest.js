import { h } from '../../src/runtime-core/index.js'
import { computed, ref } from '../../src/reactivity/index.js'

export default {
  setup() {
    const num1 = ref(1)
    const num2 = ref(2)

    const sum = computed(() => {
      console.log('执行计算')
      return num1.value + num2.value
    })

    function print() {
      console.log(sum.value)
    }

    return () => {
      return h('div', [
        h('h2', 'computed测试'),
        h('p', `num1: ${num1.value}, num2: ${num2.value}`),
        h('button', { onClick: () => num1.value++, class: 'el-button el-button--default el-button--mini' }, 'num1增加'),
        h('button', { onClick: () => num2.value++, class: 'el-button el-button--default el-button--mini' }, 'num2增加'),
        h('button', { onClick: print, class: 'el-button el-button--default el-button--mini' }, '打印计算结果')
      ])
    }
  },
}
