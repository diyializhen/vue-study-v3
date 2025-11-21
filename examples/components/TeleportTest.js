import { h } from '../../src/runtime-core/index.js'
import { Teleport } from '../../src/runtime-core/index.js'

export default { 
  setup() {
    return () => {
      return h('div', [
        h('h2', 'Teleport测试'),
        h(Teleport, { to: 'body' }, [
          h(
            'div',
            { style: { position: 'fixed', top: '200px', left: '50%', transform: 'translateX(-50%)' } },
            'teleport子节点渲染到body下'
          ),
        ]),
      ])
    }
  }
}
