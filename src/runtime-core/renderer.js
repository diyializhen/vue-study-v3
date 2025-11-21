import { isArray, isFunction, isString, isObject } from "../shared/shared.js"
import { effect } from '../reactivity/index.js'
import { queueJob } from './scheduler.js'
import { createComponentInstance, setupComponent, callHook } from './components.js'
import { Text, Comment, Fragment } from "./vnode.js"
import { createAppAPI } from './createApp.js'

/*
vnode结构:

{
  type: 'div',
  el: null,
  children: [],
  props: {},
}

*/

// 渲染器
export function createRenderer(options) {
  const {
    insert,
    remove,
    createElement,
    setElementText,
    createText,
    setScopeId,
    patchProp,
    querySelector
  } = options
  // n1: 旧vnode，n2：新vnode，container：容器元素
  function patch(n1, n2, container, anchor, parentComponent) {
    if (n1 === n2) {
      return
    }
    if (n1 && !isSameVNodeType(n1, n2)) {
      // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
      unmount(n1)
      n1 = null
    }
    const { type } = n2
    // n2.type是字符串，表示vnode是普通标签元素
    if (isString(type)) {
      if (!n1) {
        // 如果 n1 即旧vnode不存在，表示挂载，调用 mountElement 函数完成挂载
        mountElement(n2, container, anchor)
      } else {
        // 旧vnode存在，此时更新
        patchElement(n1, n2, parentComponent)
      }
    } else if (type === Text) {
      // 新节点是文本节点
      if (!n1) {
        // 如果没有旧节点，创建文本节点并插入
        const el = n2.el = createText(n2.children)
        insert(el, container)
      } else {
        // 有旧vnode，更新文本节点
        const el = n2.el = n1.el
        if (n2.children !== n1.children) {
          setElementText(el, n2.children)
        }
      }
    } else if (type === Comment) {
      // 新节点是注释节点
      if (!n1) {
        // 如果没有旧节点，创建注释节点并插入
        const el = n2.el = createComment(n2.children)
        insert(el, container)
      } else {
        // 不支持动态注释
        n2.el = n1.el
      }
    } else if (type === Fragment) {
      // 如果是Fragment类型的虚拟节点
      if (!n1) {
        // 如果旧vnode不存在，只需将 Fragment 的 children 逐个挂载
        n2.children.forEach(c => patch(null, c, container, anchor, parentComponent))
      } else {
        // 如果旧vnode存在，则更新 Fragment 的 children 即可
        patchChildren(n1, n2, container)
      }
    } else if (isObject(type) && type.__isTeleport) {
      // __isTeleport标识表示新节点是Teleport组件
      // 为了逻辑分离，调用组件中的process函数，将渲染的控制权交接出去，最后一个参数是将渲染器的一些方法传过去。
      type.process(n1, n2, container, anchor, parentComponent, {
        patch,
        patchChildren,
        unmount,
        querySelector,
        insert,
      })
    } else if (isObject(type) || isFunction(type)) {
      // n2.type是对象，表示新vnode是有状态组件，是函数则表示是函数组件
      if (!n1) {
        if (n2.keptAlive) {
          // 如果组件已经被KeepAlive，则不重新挂载，而是调用_activate激活
          n2.keepAliveInstance._activate(n2, container, anchor)
        } else {
          // 如果没有旧vnode，挂载组件
          mountComponent(n2, container, anchor, parentComponent)
        }
      } else {
        // 旧vnode存在，则更新组件
        patchComponent(n1, n2, anchor)
      }
    } 
  }

  // 挂载普通元素
  function mountElement(vnode, container, anchor) {
    // 将vnode.el指向真实DOM
    const el = vnode.el = createElement(vnode.type)
    if (isString(vnode.children)) {
      // 子节点是文本
      setElementText(el, vnode.children)
    } else if (isArray(vnode.children)) {
      // 如果 children 是数组，则遍历每一个子节点，并调用 patch 函数挂载
      vnode.children.forEach(child => {
        // 挂载阶段，没有旧vnode
        patch(null, child, el)
      })
    }
    if (vnode.props) {
      // 遍历 vnode.props，将属性设置给 el
      for (const key in vnode.props) {
        patchProp(el, key, null, vnode.props[key])
      }
    }
    // vnode上有transition属性，代表是Transition组件的子元素，需要过渡，在插入DOM前后分别调用对应钩子
    const needTransition = vnode.transition
    if (needTransition) {
      vnode.transition.beforeEnter(el)
    }
    // 插入DOM
    insert(el, container, anchor)
    if (needTransition) {
      vnode.transition.enter(el)
    }
  }

  // 卸载
  function unmount(vnode, doRemove = true) {
    const isTeleport = isObject(vnode.type) && vnode.type.__isTeleport
    const isComponent = isObject(vnode.type) || isFunction(vnode.type)
    if (isComponent && !isTeleport) {
      // 卸载组件, Teleport内置组件不需要卸载
      const instance = vnode.component
      if (vnode.shouldKeepAlive) {
        // 需要keepAlive的组件，不要卸载，调用keepAlive组件上挂的_deActivate方法移动到一个隐藏容器
        vnode.keepAliveInstance._deActivate(vnode)
      } else {
        const { beforeUnmount, unmounted } = instance
        callHook(beforeUnmount, instance)
        unmount(instance.subTree, doRemove)
        callHook(unmounted, instance)
        instance.isUnmounted = true
      }
    } else {
      if (isTeleport) {
        vnode.type.remove(vnode, { unmount })
      } else if (vnode.type === Fragment || isArray(vnode.children)) {
        // 在卸载时，如果卸载的 vnode 类型为 Fragment，或有children的节点，则需要卸载其 children
        // 这里递归unmount子节点，doRemove默认false不删除，只为了卸载子组件
        unmountChildren(vnode.children)
      }
      if (doRemove) {
        // 删除节点
        removeByVnode(vnode)
      }
    }
  }

  function removeByVnode(vnode) {
    // vnode上有transition属性，代表是Transition组件的子元素，需要过渡
    // mountElement挂载时存了el，通过vnode.el获取真实DOM元素
    const { type, el, transition } = vnode
    if (type === Fragment) {
      unmountChildren(vnode.children, true)
      return
    }
    // 将卸载元素封装一下
    const performRemove = () => remove(el)
    if (transition) {
      // 需要过渡的情况，调用transition.leave钩子
      transition.leave(el, performRemove)
    } else {
      // 不需要过渡直接卸载
      performRemove()
    }
  }

  function unmountChildren(children, doRemove = false, start = 0) {
    for (let i = start; i < children.length; i++) {
      unmount(children[i], doRemove)
    }
  }

  // 更新
  function patchElement(n1, n2, parentComponent) {
    // 给新vnode设置el
    const el = n2.el = n1.el
    const oldProps = n1.props
    const newProps = n2.props
    // 更新props
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProp(el, key, oldProps[key], newProps[key])
      }
    }
    // 删除不要的props
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProp(el, key, oldProps[key], null)
      }
    }
    // 更新children
    patchChildren(n1, n2, el, parentComponent)
  }

  // 更新子节点
  // 子节点的类型有三种可能：没有子节点、文本子节点以及一组子节点
  function patchChildren(n1, n2, container, parentComponent) {
    // 判断新子节点n2.children类型
    if (isString(n2.children)) {
      // 如果新的子节点是文本节点
      // 当旧子节点是一组子节点时，需要逐个卸载，其他情况什么都不需要做
      if (isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c))
      }
      // 给容器设置新的文本节点
      setElementText(container, n2.children)
    } else if (isArray(n2.children)) {
      // 如果新子节点是一组节点
      if (isArray(n1.children)) {
        // 旧子节点也是一组子节点，使用Diff算法
        patchKeyedChildren(n1, n2, container, parentComponent)
      } else {
        // 旧子节点是文本节点或不存在，只需要清空容器，并逐个挂载新子节点组
        setElementText(container, '')
        n2.children.forEach(c => patch(null, c, container))
      }
    } else {
      // 新子节点不存在
      if (isArray(n1.children)) {
        // 旧子节点是一组
        n1.children.forEach(c => unmount(c))
      } else if (isString(n1.children)) {
        // 旧子节点是文本
        setElementText(container, '')
      }
      // 旧子节点也不存在，什么都不需要做
    }
  }

  // 挂载组件
  function mountComponent(vnode, container, anchor, parentComponent) {
    // 创建组件实例
    const instance = createComponentInstance(vnode, parentComponent)
      // 通过标识判断vnode是否为keep-alive组件
    const isKeepAlive = vnode.type.__isKeepAlive
    if (isKeepAlive) {
      // 给KeepAlive组件实例上添加KeepAliveCtx
      instance.KeepAliveCtx = {
        move(vnode, container, anchor) {
          insert(vnode.component.subTree.el, container, anchor)
        },
        createElement
      }
    }
    // 将组件实例设置到 vnode 上，用于后续更新
    vnode.component = instance
    setupComponent(instance)
    setupRenderEffect(instance, vnode, container, anchor)
  }

  // 将组件render函数放在副作用函数里执行，实现响应式数据变化时组件主动重新执行渲染函数更新。
  function setupRenderEffect(instance, vnode, container, anchor) {
    const componentUpdateFn = () => {
      const { render, mounted, beforeMount, beforeUpdate, updated } = instance
      // 每次副作用函数执行，执行渲染函数，返回一个新的虚拟DOM
      const subTree = render.call(instance.proxy, instance.proxy)
      if (!instance.isMounted) {
        // 初次挂载，patch第一个参数旧vnode传null
        callHook(beforeMount, instance)
        patch(null, subTree, container, anchor, instance)
        instance.isMounted = true
        callHook(mounted, instance)
      } else {
        // 组件已挂载，更新
        callHook(beforeUpdate, instance)
        // 旧vnode是上一次存的subTree，与新的subTree进行patch
        patch(instance.subTree, subTree, container, anchor, instance)
        // 保存el，后面可以通过$el获取
        vnode.el = subTree.el
        callHook(updated, instance)
      }
      // 更新组件的subTree
      instance.subTree = subTree
    }
    instance.effect = effect(componentUpdateFn, {
      // 指定调度器为queueJob，响应式数据变化，副作用函数不立即执行，而是被queueJob添加到微任务中执行
      scheduler: queueJob
    })
  }

  // 父组件更新触发的子组件被动更新
  function patchComponent(n1, n2, anchor) {
    // 获取组件实例，同时给新节点n2设置实例
    const instance = (n2.component = n1.component)
    const { props } = instance
    // 检测传给子组件的props是否变化，没有变化则不需要更新
    if (hasPropsChanged(n1.props, n2.props)) {
      // 重新获取新的props数据
      const [ nextProps ] = resolveProps(n2.type.props, n2.props)
      // 更新props，props是浅响应的，更新后即可触发重新渲染
      for (const k in nextProps) {
        props[k] = nextProps[k]
      }
      // 删除不存在的props
      for (const k in props) {
        if (!(k in nextProps)) delete props[k]
      }
    }
  }

  // 检测组件props是否变化
  function hasPropsChanged(prevProps, nextProps) {
    const nextKeys = Object.keys(nextProps)
    if (nextKeys.length !== Object.keys(prevProps).length) {
      // 新旧props数量不同，说明有变化
      return true
    }
    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i]
      // 如果有不相等的props，说明有变化
      if (nextProps[key] !== prevProps[key]) return true
    }
    return false
  }

  function isSameVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key
  }

  // 快速Diff算法，vue3使用
  function patchKeyedChildren(n1, n2, container, parentComponent) {
    const newChildren = n2.children
    const oldChildren = n1.children
    // 索引 j 指向新旧两组子节点的开头
    let j = 0
    let oldVNode = oldChildren[j]
    let newVNode = newChildren[j]
    // 1. 先循环从前向后遍历，直到vnode节点类型不同为止
    while (j < oldChildren.length && j < newChildren.length) {
      if (isSameVNodeType(oldVNode, newVNode)) {
        // 先patch更新节点
        patch(oldVNode, newVNode, container, parentComponent)
        // 更新索引和变量
        j++
        oldVNode = oldChildren[j]
        newVNode = newChildren[j]
      } else {
        break
      }
    }
    // 两组节点末尾索引
    let oldEnd = oldChildren.length - 1
    let newEnd = newChildren.length - 1
    oldVNode = oldChildren[oldEnd]
    newVNode = newChildren[newEnd]
    // 2. 再从后向前遍历，直到vnode节点类型不同为止
    while (j <= oldEnd && j <= newEnd) {
      if (isSameVNodeType(oldVNode, newVNode)) {
        // 先patch更新节点
        patch(oldVNode, newVNode, container, parentComponent)
        // 更新索引和变量
        oldEnd--
        newEnd--
        oldVNode = oldChildren[oldEnd]
        newVNode = newChildren[newEnd]
      } else {
        break
      }
    }
    // 上方只要类型相同就更新索引，所以未处理节点包含j和newEnd索引。
    // 3. 预处理完成，检查此时索引
    if (j > oldEnd && j <= newEnd) {
      // 3.1 旧节点处理完了，且新节点有剩余, 即j和newEnd之间的元素是新增节点
      // 锚点节点索引
      const anchorIndex = newEnd + 1
      // 锚点元素
      const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null
      // 挂载新节点
      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor, parentComponent)
      }
    } else if (j > newEnd && j <= oldEnd) {
      // 3.2 新节点处理完了，且旧节点有剩余，j到oldEnd的节点应该卸载
      while (j <= oldEnd) {
        unmount(oldChildren[j++])
      }
    } else {
      // 3.3新旧都有剩余情况，根据节点的索引关系，构建一个最长递增子序列，最长递增子序列指向的节点就是不需要移动的节点
      // 构建一个填充-1的source数组，长度是新节点中未处理的数量，所以与未处理新节点一一对应。
      // 此数组用来存储 每个新节点如果找到可复用的旧节点oldVNode，将oldVNode的下标存到source数组对应位置
      // 相当于数组的下标可以通过newStart + i 获得剩余newVnode的下标，下标对应的值是oldVnode的下标
      const count = newEnd - j + 1
      const source = new Array(count)
      source.fill(-1) // vue 源码里默认值用的0，实际存的下标偏移一下为i+1。和这里默认值-1，存的下标是i一个意思，后面只是
      const oldStart = j
      const newStart = j
      let moved = false // 是否需要移动
      let pos = 0 // 遍历剩余oldVnode时，如果找到newVnode可复用，缓存newVnode的索引，如果下次与pos对比，只要不递增，即需要移动
      // 给新节点组构建索引表 key -> i，减少遍历次数
      const keyToNewIndexMap = new Map()
      for(let i = newStart; i <= newEnd; i++) {
        let newChild = newChildren[i]
        if (newChild.key != null) {
          keyToNewIndexMap.set(newChild.key, i)
        }
      }
      // 记录更新过的节点数量，如果已更新的节点数patched大于需要更新的节点数count，则剩余的直接卸载
      let patched = 0
      for (let i = oldStart; i <= oldEnd; i++) {
        oldVNode = oldChildren[i]
        if (patched <= count) {
          let newIndex
          if (oldVNode.key != null) {
            // 当前旧vnode有设置key，通过Map快速查找是否有相同key的新vnode，如有即可复用
            newIndex = keyToNewIndexMap.get(oldVNode.key)
          } else {
            // 当前旧vnode没有设置key，只能通过遍历查找
            for (let k = newStart; k <= newEnd; k++) {
              if (isSameVNodeType(oldVNode, newChildren[k])) {
                newIndex = k
                break
              }
            }
          }
          if (newIndex === undefined) {
            // 当前旧节点oldVNode在新节点中没找到复用节点，直接卸载
            unmount(oldVNode)
          } else {
            newVNode = newChildren[newIndex]
            // 如果找到有可复用节点，patch更新，更新后newVNode.el就赋值成要复用的元素了
            patch(oldVNode, newVNode, container, parentComponent)
            patched++ // 计数
            // 将可复用旧节点索引i存到source数组对应newVNode的位置
            source[newIndex - newStart] = i
            // 把可复用newVnode索引i存到pos，如果一直是递增的，则顺序是对的不需要移动，只要出现不递增就说明需要移动
            if (newIndex < pos) {
              moved = true
            } else {
              pos = newIndex
            }
          }
        } else {
          // 如果更新过的节点数大于需要更新的节点数量，剩下的都是需要卸载的节点
          unmount(oldVNode)
        }
      }
      // 如果需要移动节点
      // 计算最长递增子序列，代表计算出的这些新节点的顺序和对应的旧节点顺序一致，不需要移动。最长递增子序列即选出尽可能多的不需要移动的节点，减少性能消耗。
      // 此算法返回的是数组source最长递增子序列对应的下标
      const seq = moved ? getSequence(source) : []
      let s = seq.length - 1 // 索引s指向最长递增子序列seq数组的末尾下标
      let i = count - 1 // 索引i指向source数组的末尾下标
      for(i; i >= 0; i--) {
        // i + newStart是新节点在newChildren的实际下标
        const pos = i + newStart
        const newVNode = newChildren[pos]
        // 以下一个新节点为锚点
        const nextPos = pos + 1
        const anchor = nextPos < newChildren.length
            ? newChildren[nextPos].el
            : null
        if (source[i] === -1) {
          // 此新节点没有可复用节点，挂载。
          patch(null, newVNode, container, anchor, parentComponent)
        } else if (moved) {
          if (s < 0 || i !== seq[s]) {
            // 如果不相等，则i对应的新节点位置不对，需要移动
            insert(newVNode.el, container, anchor)
          } else {
            // 如果i === seq[s]，说明i这个位置的新节点位置和最长递增子序列的位置一样，不需要移动
            s--
          }
        }
      }
    }
  }

  // 双端Diff算法，vue2使用
  function patchKeyedChildrenTwoWay(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children
    // 两个children数组的开始和结束双端索引值
    let oldStartIdx = 0
    let oldEndIdx = oldChildren.length - 1
    let newStartIdx = 0
    let newEndIdx = newChildren.length - 1
    // 双端索引对应的四个vnode
    let oldStartVNode = oldChildren[oldStartIdx]
    let oldEndVNode = oldChildren[oldEndIdx]
    let newStartVNode = newChildren[newStartIdx]
    let newEndVNode = newChildren[newEndIdx]
    // 分别双端对比，如果可以复用，先patch打补丁，再移动DOM元素，再更新索引和变量
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      // 如果旧节点被移动走了，该位置会设置成undefiend，此时直接更新变量跳到下一次循环
      if (!oldStartVNode) {
        oldStartVNode = oldChildren[++oldStartIdx]
      } else if (!oldEndVNode) {
        oldEndVNode = oldChildren[--oldEndIdx]
      } else if (isSameVNodeType(oldStartVNode, newStartVNode)) {
        // 先用patch打补丁
        patch(oldStartVNode, newStartVNode, container)
        // 新旧节点都是头部，不需要移动，只要更新索引和变量
        oldStartVNode = oldChildren[++oldStartIdx]
        newStartVNode = newChildren[++newStartIdx]
      } else if (isSameVNodeType(oldEndVNode, newEndVNode)) {
        // 先用patch打补丁
        patch(oldEndVNode, newEndVNode, container)
        // 新旧节点都是尾部，不需要移动，只要更新索引和变量
        oldEndVNode = oldChildren[--oldEndIdx]
        newEndVNode = newChildren[--newEndIdx]
      } else if (isSameVNodeType(oldStartVNode, newEndVNode)) {
        // 先用patch打补丁
        patch(oldStartVNode, newEndVNode, container)
        // 旧的头部节点现在变成尾部了，所以将旧头部节点移到旧的尾部后面
        insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling)
        // 移动后，更新索引和变量
        oldStartVNode = oldChildren[++oldStartIdx]
        newEndVNode = newChildren[--newEndIdx]
      } else if (isSameVNodeType(oldEndVNode, newStartVNode)) {
        // 先用patch打补丁
        patch(oldEndVNode, newStartVNode, container)
        // 旧的末尾节点变成头部了，所以要将 oldEndVNode.el 移动到 oldStartVNode.el 前面
        insert(oldEndVNode.el, container, oldStartVNode.el)
        // 移动后，更新索引和变量
        oldEndVNode = oldChildren[--oldEndIdx]
        newStartVNode = newChildren[++newStartIdx]
      } else {
        // 双端比较后没有可复用节点，遍历旧的节点数组，试图寻找可以与newStartVNode复用的节点
        const idxInOld = oldChildren.findIndex(vnode => isSameVNodeType(vnode, newStartVNode))
        if (idxInOld > 0) {
          // 如果找到了
          const vnodeToMove = oldChildren[idxInOld]
          // 先用patch打补丁
          patch(vnodeToMove, newStartVNode, container)
          // 将其DOM移动到oldStartVNode.el之前
          insert(vnodeToMove.el, container, oldStartVNode.el)
          // 由于位置 idxInOld 处的节点所对应的真实 DOM 已经移动走了，将此位置设置为undefiend
          oldChildren[idxInOld] = undefined
        } else {
          // newStartVNode没有找到可复用的节点，作为新节点挂载到头部，使用当前头部节点oldStartVNode.el作为锚点
          patch(null, newStartVNode, container, oldStartVNode.el)
        }
        // 更新索引和变量
        newStartVNode = newChildren[++newStartIdx]
      }
    }
    // 循环条件不满足结束后，检查索引值情况
    if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
      // 如果满足条件，则说明还有新的节点没遍历到，需要挂载它们
      // 这些新节点应该挂载到oldStartVNode.el的前面
      for (let i = newStartIdx; i <= newEndIdx; i++) {
        patch(null, newChildren[i], container, oldStartVNode.el)
      }
    } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
      // 新节点遍历完了，还剩有旧节点，这些应该移除掉
      for (let i = oldStartIdx; i <= oldEndIdx; i++) {
        unmount(oldChildren[i])
      }
    }
  }

  // 渲染函数
  function render(vnode, container) {
    if (vnode) {
      // 新 vnode 存在，将其与旧 vnode 一起传递给 patch 函数，进行打补丁
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        // 旧 vnode 存在，且新 vnode 不存在，说明是卸载（unmount）操作
        unmount(container._vnode)
      }
    }
    // 将vnode保存在容器的_vnode属性上
    container._vnode = vnode
  }

  return {
    render,
    createApp: createAppAPI(render)
  }
}

// 获取最长递增子序列，此算法返回的是数组arr最长递增子序列对应的下标。
// 在vue中，arr每一项值是可复用的剩余oldVnode的下标，arr的下标与剩余newVnode的下标一一对应
function getSequence(arr) {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
