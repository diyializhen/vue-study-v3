import { h } from '../../src/runtime-core/index.js'
import {
  reactive,
  readonly,
  shallowReadonly,
  shallowReactive,
  isProxy,
  ref,
  shallowRef,
  isRef,
  toRef,
  toRefs,
  proxyRefs,
} from '../../src/reactivity/index.js'

const contentBoxStyle = {
  border: '1px solid #eeeeee',
  'margin-top': '10px',
  'padding': '10px',
}

// 测试ref
const RefTest = {
  setup() {
    console.log('---测试ref开始---')
    const testData = { id: 1, data: { name: '大黄', age: 3 } }
    const refTestData = ref(testData)
    console.log('原始数据：', testData)
    console.log('ref测试数据：', refTestData)
    console.log('isRef', isRef(refTestData))

    const dog1 = reactive({ name: '大黄', age: 3 })
    const dogName = toRef(dog1, 'name')
    console.log('toRef原始数据：', JSON.stringify(dog1))
    dogName.value = '小黄'
    console.log('toRef改变name：', JSON.stringify(dog1))

    console.log('---测试ref结束---')

    const userList = ref([])
    function onGetUserList() {
      userList.value = [
        { name: '张三', age: '18' },
        { name: '李四', age: '20' },
      ]
    }
    function addAge(item) {
      item.age = String(Number(item.age) + 1)
    }

    return () => {
      const userListNodes = userList.value.map(item => {
        return h('div', [
          h('span', item.name),
          h('span', item.age),
          h('button', { onClick: () => addAge(item), class: 'el-button el-button--default el-button--mini' }, '年纪增加'),
        ])
      })
      return h(
        'div',
        { style: contentBoxStyle },
        [
          h('h3', '测试ref'),
          h(
            'button',
            { onClick: onGetUserList, class: 'el-button el-button--primary' },
            `${userList.value.length ? '重置' : '获取'}用户列表`
          ),
          h('div', userListNodes),
        ]
      )
    }
  }
}

// 测试reactive
const ReactiveTest = {
  setup() {
    const user = reactive({ name: '张三', age: '18' })
    function addAge() {
      user.age = String(Number(user.age) + 1)
    }

    return () => {
      return h(
        'div',
        { style: contentBoxStyle },
        [
          h('h3', '测试reactive'),
          h('button', { onClick: addAge, class: 'el-button el-button--default el-button--mini' }, '年纪增加'),
          h('p', `姓名：${user.name}`),
          h('p', `年纪：${user.age}`),
        ]
      )
    }
  }
}


// 响应式数据
export default {
  name: 'ReactivityData',
  setup() {
    
    return () => h('div', [
      h('h2', '响应式数据'),
      h(RefTest),
      h(ReactiveTest),
    ])
  },
}
