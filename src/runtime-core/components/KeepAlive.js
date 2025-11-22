import { getCurrentInstance, injectHook, callHook, onUnmounted } from '../components.js'
import { isObject, isArray, isString } from '../../shared/shared.js'

/* 
简述：

1. 在渲染器mountComponent时给KeepAlive组件的实例上注入一个keepAliveCtx对象，暴露了move，createElement方法。
2. KeepAlive组件中创建一个隐藏div容器，给组件实例注册_deActivate和_activate方法用于移出移入DOM元素，创建一个缓存插槽内容的Map数据，创建一个表示激活顺序的Set数据。此处优先使用key，其次使用vnode.type表示组件。
3. 响应数据发生改变时，会先执行KeepAlive组件的render函数，render函数中获取要渲染的默认插槽的vnode，给子vnode标识shouldKeepAlive，表示需要keepalive，同时绑定keepAlive的实例。如果子组件未缓存则缓存到Map数据，已缓存则给vnode打上keptAlive标识。
4. 后续响应数据变化，触发渲染，在渲染器patch中检测到组件vnode.keptAlive标识，则不执行挂载，调用_activate激活，在unmount中检测到vnode.shouldKeepAlive，则不执行卸载，调用_deactivate移入隐藏容器。
5. 每次激活更新Set数据的顺序，用于判断超出最大缓存数量max时，删除最早的缓存。如果未匹配include，或匹配了exclude，则直接渲染，不进行后续流程。
*/

export const KeepAlive = {
  name: `KeepAlive`,
  __isKeepAlive: true, // 标识是KeepAlive组件
  props: {
    include: [String, RegExp, Array], // 匹配的组件名
    exclude: [String, RegExp, Array], // 排除的组件名
    max: [String, Number], // 最大缓存数量
  },
  setup(props, { slots }) {
    // 创建一个缓存对象，key是vnode.type，value是vnode
    const cache = new Map()
    const keys = new Set()
    const instance = getCurrentInstance()
    // 在渲染器 mountComponent 挂载组件时给KeepAlive组件的实例上注入一个keepAliveCtx对象，该对象暴漏渲染器内部的一些方法。在已被keptAlive的组件再次挂载时，直接调用_activate，需要keepAlive的组件被卸载时调用_deActivate。
    // move是将一段DOM移动到另一个容器中
    const { move, createElement } = instance.KeepAliveCtx
    // 创建一个隐藏容器
    const storageContainer = createElement('div')
    // 给KeepAlive组件实例上添加两个内部函数_deActivate和_activate用于移动节点，他们会在渲染器patch和unmount中被调用
    instance._deActivate = (vnode) => {
      move(vnode, storageContainer)
      // 执行生命周期
      const { deactivated } = vnode.component
      callHook(deactivated, vnode.component)
    }
    instance._activate = (vnode, container, anchor) => {
      move(vnode, container, anchor)
      const { activated } = vnode.component
      callHook(activated, vnode.component)
    }

    return () => {
      // KeepAlive 的默认插槽就是要被 KeepAlive 的组件
      let rawVNode = slots.default()
      // 如果不是组件，直接渲染，因为非组件的虚拟节点无法被KeepAlive
      if (!isObject(rawVNode.type)) {
        return rawVNode
      }
      // 获取内部组件的name
      const name = rawVNode.type.name
      const { include, exclude, max } = props
      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        // 如果有include但name不匹配，或者有exclude且name匹配，直接渲染内部组件，不进行后续操作
        return rawVNode
      }
      // 优先key，其次type
      const key = rawVNode.key == null ? rawVNode.type : rawVNode.key
      // 在挂载时先获取被缓存的组件 vnode
      const cachedVNode = cache.get(key)
      if (cachedVNode) {
        // 如果有缓存的内容，则说明不应该执行挂载，而应该执行激活
        // 渲染器里先执行组件的render函数，得到vnode再patch
        // 当前执行渲染函数时，如有缓存，则设置keptAlive属性，后续patch执行时就不走mountComponent挂载组件创建组件实例的分支代码
        // 此时直接继承组件实例
        rawVNode.el = cachedVNode.el
        rawVNode.component = cachedVNode.component
        // 在vnode上添加keptAlive属性，避免渲染器patch中挂载组件，而是激活组件
        rawVNode.keptAlive = true
        // 更新缓存顺序
        keys.delete(key)
        keys.add(key)
      } else {
        keys.add(key)
        if (max && keys.size > parseInt(max), 10) {
          // 如果缓存数量超过设置的max，将Set数据缓存的第一项删除
          const firstKey = keys.values().next().value
          cache.delete(firstKey)
          keys.delete(firstKey)
        }
        // 如果没有缓存，则将其添加到缓存中，这样下次激活组件时就不会执行新的挂载动作了
        cache.set(key, rawVNode)
      }
      // 在vnode上添加shouldKeepAlive属性标记，避免渲染器unmount时将组件卸载，而是失活组件
      rawVNode.shouldKeepAlive = true
      // 将 KeepAlive 组件的实例添加到被缓存的 vnode 上，以便在渲染器中通过实例访问_deActivate，_activate
      rawVNode.keepAliveInstance = instance
      // render函数返回被keepAlive的组件
      return rawVNode
    }
  }
}

// 判断组件名name是否和规则pattern匹配，规则支持数组、字符串、正则
function matches(pattern, name) {
  if (isArray(pattern)) {
    // 如果是数组，递归调用matches
    return pattern.some((p) => matches(p, name))
  } else if (isString(pattern)) {
    // 如果是字符串，以逗号分割，判断name是否包含其中
    return pattern.split(',').includes(name)
  } else if (isRegExp(pattern)) {
    // 如果是正则，则判断name是否匹配
    pattern.lastIndex = 0
    return pattern.test(name)
  }
  /* v8 ignore next */
  return false
}

function registerKeepAliveHook(hook, type, target = getCurrentInstance()) {
  // 将hook包装一层，目的是为了控制只有祖先组件不是isDeactivated的才执行hook
  const wrappedHook = 
    hook.__wdc ||
    (hook.__wdc = () => {
      let current = target
      while (current) {
        if (current.isDeactivated) {
          return
        }
        current = current.parent
      }
      return hook()
    })
  // 给当前组件注册keepalive相关生命周期钩子
  injectHook(type, wrappedHook, target)
  if (target) {
    let current = target.parent
    while (current && current.parent) {
      if (current.type.__isKeepAlive) {
        // 循环找到最近祖先的keepAlive组件
        // 再给keepAlive组件注册hook钩子
        injectHook(type, wrappedHook, current)
        onUnmounted(() => {
          // 当前组件被卸载，从keepAlive组件钩子中删除注册的hook
          const arr = current[type]
          const i = arr.indexof(wrappedHook)
          if (i > -1) {
            arr.splice(i, 1)
          }
        }, target)
      }
      current = current.parent
    }
  }
}

// 生命周期注册函数
export function onActivated(hook, target) {
  registerKeepAliveHook(hook, 'activated', target)
}

export function onDeactivated(hook, target) {
  registerKeepAliveHook(hook, 'deactivated', target)
}
