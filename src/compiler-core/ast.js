
export const NodeTypes = {
  ROOT: 'ROOT',
  ELEMENT: 'ELEMENT', // 元素
  TEXT: 'TEXT',
  COMMENT: 'COMMENT',
  SIMPLE_EXPRESSION: 'SIMPLE_EXPRESSION', // 插值的表达式
  INTERPOLATION: 'INTERPOLATION', // 插值
  ATTRIBUTE: 'ATTRIBUTE', // 属性
  DIRECTIVE: 'DIRECTIVE', // 指令
}

export const ConstantTypes = {
  NOT_CONSTANT: 0,
  CAN_SKIP_PATCH: 1,
  CAN_CACHE: 2,
  CAN_STRINGIFY: 3,
}

// 元素类型
export const ElementTypes = {
  ELEMENT: 0,
  COMPONENT: 1,
  SLOT: 2,
  TEMPLATE: 3,
}

export function createRoot(children, source = '') {
  return {
    type: NodeTypes.ROOT,
    children,
    source,
  }
}

export function createSimpleExpression(
  content,
  isStatic = false,
  loc,
  constType,
) {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content,
    isStatic,
    loc,
    constType: isStatic ? ConstantTypes.CAN_STRINGIFY : constType,
  }
}
