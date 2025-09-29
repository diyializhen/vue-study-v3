import { isString } from "../../shared/shared.js"
import { Text, Fragment} from '../vnode.js'

/*
{
  type: Teleport,
  // 被 Teleport 的子节点编译成普通 children 的形式
  children: [
    { type: 'p', children: 'hello' },
    { type: 'p', children: 'word' },
  ]
}
*/
/* 
简述：

在渲染器的patch中，检测到组件且有__isTeleport标识，则调用组件的process方法将后续处理交给组件。
process方法中，如果无旧vnode，直接递归调用patch挂载到要挂载的元素上，如果是更新，则递归调用patchChildren更新，如果挂载容器to改变，则移动所有子元素。
*/

// Teleport组件，以__isTeleport为标识，同时有process方法
export const Teleport = {
  name: 'Teleport',
  __isTeleport: true,
  // 将Teleport渲染逻辑从渲染器中分离出来，还顺便做到可以tree shake
  process(n1, n2, container, anchor, parentComponent, internals) {
    const { patch, patchChildren, querySelector } = internals
    // 如果旧vnode不存在，则是全新的挂载，否则是更新
    if (!n1) {
      // 获取要挂载的容器
      const target = isString(n2.props.to)
        ? querySelector(n2.props.to)
        : n2.props.to
      // 将新vnode n2的children挂载到target中
      n2.children.forEach(c => patch(null, c, target, anchor, parentComponent))
    } else {
      // 更新内容，不需要更改container容器
      patchChildren(n1, n2, container, parentComponent)
      // 如果新旧 to 参数的值不同，则需要对内容进行移动
      if (n2.props.to !== n1.props.to) {
        // 获取新的挂载容器
        const newTarget = isString(n2.props.to)
          ? querySelector(n2.props.to)
          : n2.props.to
        // 移动
        n2.children.forEach(c => move(c, newTarget, null, internals))
      }
    }
  }
}

function move(vnode, container, anchor, internals) {
  const { insert } = internals
  const { type } = vnode
  if (type === Fragment) {
    vnode.children.forEach(c => move(c, container, anchor, internals))
  } else if (isObject(type) || isFunction(type)) {
    insert(vnode.component.subTree.el, container, anchor)
  } else {
    insert(vnode.el, container, anchor)
  }
}
