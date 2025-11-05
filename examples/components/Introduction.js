import { h } from '../../src/runtime-core/index.js'

export default {
  name: 'Introduction',
  render() {
    return h('div', [
      h('h2', '介绍'),
      h('p', '此页面用于功能测试'),
      h('p', '点击左侧链接切换路由'),
      h('p', '注意查看控制台打印信息'),
    ])
  }
}