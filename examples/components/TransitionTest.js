import { h, Comment, Transition } from '../../src/runtime-core/index.js'
import { ref } from '../../src/reactivity/index.js'

// 添加测试样式
const styleElement = document.createElement('style')
styleElement.textContent = `
  .fade-div-test {
    width: 100px;
    height: 100px;
    background: #eeeeee;
  }
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
  .fade-enter-active,
  .fade-leave-active {
    transition: all 0.5s ease;
  }
`
document.head.appendChild(styleElement)

export default {
  setup() {
    const isShow = ref(true)
    function toggle() {
      isShow.value = !isShow.value
    }

    return () => {
      return h('div', [
        h('h2', 'Transition测试'),
        h(
          'button',
          { onClick: toggle, class: 'el-button el-button--default el-button--mini' },
          '切换'
        ),
        h(
          Transition,
          { name: 'fade' },
          {
            default: () => {
              return isShow.value ? h('div', { class: 'fade-div-test' }) : null
            },
          }
        ),
      ])
    }
  },
}
