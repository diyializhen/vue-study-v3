import { ref, shallowRef, reactive, shallowReadonly, shallowReactive } from '../reactivity/index.js'
import { toHandlerKey, camelize, hasOwn, isFunction, isPromise, isArray, isObject } from '../shared/shared.js'
import { KeepAlive } from './index.js'

// 全局变量，存储当前正在被初始化的组件实例，用于在setup中注册生命周期钩子时关联组件实例
export let currentInstance = {}
// 设置获取当前组件实例
export function setCurrentInstance(instance) {
  currentInstance = instance
}
export function getCurrentInstance() {
  return currentInstance
}

// 定义emit函数
export function emit(instance, event, ...payload) {
  // 根据约定对事件名称进行处理，例如 change --> onChange
  const eventName = toHandlerKey(camelize(event))
  // 事件处理函数
  const handler = instance.props[eventName]
  if (handler) {
    handler(...payload)
  } else {
    console.error(`事件 ${eventName} 不存在`)
  }
}

let uid = 0
// 创建组件实例
export function createComponentInstance(vnode, parentComponent) {
  // 定义一个组件实例，包含组件的状态信息
  const instance = {
    uid: uid++,
    type: vnode.type,
    vnode,
    parent: parentComponent,
    proxy: null,

    ctx: {},
    data: {},
    props: {},
    attrs: {},
    slots: {},
    refs: {},
    setupState: {}, // 存储setup返回的数据(非函数)
    emit: () => {},

    isMounted: false, // 是否已挂载
    isUnmounted: false, // 是否已卸载

    subTree: null, // 存储组件渲染的内容
    KeepAliveCtx: null, // keepAlive组件特有
  }
  instance.ctx = { _: instance }
  // 使用bind方法，将第一个参数传组件实例
  instance.emit = emit.bind(null, instance)
  return instance
}

export function callHook(hook, instance) {
  if (isFunction(hook)) {
    const res = hook.call(instance.proxy)
    return res
  }
  if (isArray(hook)) {
    const values = []
    for (let i = 0; i < hook.length; i++) {
      values.push(callHook(hook[i], instance))
    }
    return values
  }
}

export function finishComponentSetup(instance) {
  // 组件的选项对象
  const componentOptions = instance.type
  if (!instance.render) {
    if (!componentOptions.render) {
      // 需要把 template 编译成 render 函数
      componentOptions.render = () => {}
    }
    instance.render = componentOptions.render
  }
  applyOptions(instance)
}
function applyOptions(instance) {
  const options = instance.type
  const publicThis = instance.proxy
  // 触发选项的beforeCreate
  if (options.beforeCreate) {
    callHook(options.beforeCreate, instance)
  }
  const { data: dataOptions, methods, created } = options
  
  // 在组件实例设置data
  if (dataOptions) {
    const data = dataOptions.call(publicThis)
    if (isObject(data)) {
      instance.data = reactive(data)
    }
  }
  // 触发选项的created生命周期
  if (created) {
    callHook(created, instance)
  }
  // 其余选项式api省略实现
}

export function setupComponent(instance) {
  const vnode = instance.vnode
  // 组件的选项对象
  let componentOptions = vnode.type
  // vnode.type是函数则表示是函数组件
  const isFunctional = isFunction(componentOptions)
  if (isFunctional) {
    componentOptions = {
      render: vnode.type,
      props: vnode.type.props
    }
  }
  let { render, setup, props: propsOption } = componentOptions
  // 用组件选项的propsOption和传给组件的属性vnode.props，获取最终的props和attrs数据
  const [props, attrs] = resolveProps(propsOption, vnode.props)
  // 给组件实例设置props和slots
  instance.props = shallowReactive(props)
  instance.attrs = attrs
  // 模板中的插槽slot被编译成函数，存在vnode的children对象中
  const slots = vnode.children || {}
  instance.slots = slots
  // 创建一个上下文代理对象，让组件可以通过this访问data、props、setup返回值、api等
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)
  if(setup) {
    // 构建传给setup函数的第二个参数
    const setupContext = { attrs, emit: instance.emit, slots }
    // 调用setup之前设置当前组件实例
    setCurrentInstance(instance)
    const setupResult = setup(shallowReadonly(props), setupContext)
    // 调用setup之后，将当前组件实例设置为null
    setCurrentInstance(null)
    if (typeof setupResult === 'function') {
      // setup返回的是渲染函数
      if (render) {
        console.error('setup 函数返回渲染函数，render选项将被忽略')
      }
      instance.render = setupResult
    } else {
      // 不是函数
      instance.setupState = setupResult
    }
  }
  finishComponentSetup(instance)
}

// 解析组件props选项和attrs数据
function resolveProps(options = {}, propsData = {}) {
  const attrs = {}
  // 正常应该校验：
  // 如果传给组件的props数据在组件自身的props选项中有定义，则视为合法的props，其他的才是attrs
  // 以on开头的属性，直接添加到props中，而不是attrs
  // 目前不做这个处理，直接返回propsData
  return [propsData, { ...propsData }]
}

const publicPropertiesMap = {
  $el: i => i.vnode.el,
  $emit: i => i.emit,
  $slots: i => i.slots,
  $props: i => i.props,
  $data: i => i.data,
  $attrs: i => i.attrs,
  $refs: i => i.refs,
}
// 创建一个上下文代理对象，让组件可以通过this访问data、props、setup返回值、api等
// instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)
export const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    const { data, props, setupState } = instance
    if (key[0] !== '$') {
      if (hasOwn(setupState, key)) {
        return setupState[key]
      } else if (hasOwn(data, key)) {
        return data[key]
      } else if (hasOwn(props, key)) {
        return props[key]
      } else {
        console.log(`组件不存在属性${key}`)
      }
    }
    const publicGetter = publicPropertiesMap[key]
    // 返回对应的api
    return publicGetter(instance)
  },
  set({ _: instance }, key, value) {
    const { data, props, setupState } = instance
    if (hasOwn(setupState, key)) {
      setupState[key] = value
    } else if (hasOwn(data, key)) {
      data[key] = value
    } else if (hasOwn(props, key)) {
      console.log(`props是只读的`)
    } else {
      console.log(`组件不存在属性${key}`)
    }
    return true
  }
}

export function injectHook(type, hook, target = currentInstance) {
  if (target) {
    // 将生命周期钩子存到组件实例对应的数组中
    const hooks = target[type] || (target[type] = [])
    hooks.push(hook)
  } else {
    console.log(`注册${type}生命周期钩子只能在setup中调用`)
  }
}
export const createHook = type => {
  return function(hook, target = currentInstance) {
    injectHook(type, hook, target)
  }
}
// 生命周期钩子注册函数
export const onBeforeMount = createHook('beforeMount')
export const onMounted = createHook('mounted')
export const onBeforeUpdate = createHook('beforeUpdate')
export const onUpdated = createHook('updated')
export const onBeforeUnmount = createHook('beforeUnmount')
export const onUnmounted = createHook('unmounted')
