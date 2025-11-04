import { h } from '../../src/runtime-core/index.js'
import { baseParse } from '../../src/compiler-core/parser.js'

const templateStr =
  `<div id="app">
    <h1>模板编译</h1>
    <div v-if="show">显示隐藏</div>
    <MyComponent :data="{ title: '组件' }">
      <div>插槽内容</div>
    </MyComponent>>
    <div
      :class="listItem"
      v-for="item in list"
      :key="item.id"
      @click="handleClick"
    >{{ item.name }}</div>
  </div>`

export default {
  name: 'Compiler',
  setup() {
    console.log('字符串：', templateStr)
    console.log('字符串 -> 模板AST树：', baseParse(templateStr))
    // 后续 模板AST -> JS AST -> 生成Js代码 暂时待实现。

    return () => h('h2', `模板编译`)
  }
}
