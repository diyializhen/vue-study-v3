import { reactive, shallowReactive } from "./reactive.js"

const IS_REF = '__v_isRef'
function createRef(val, shallow) {
  if (isRef(val)) {
    return val
  }
  const wrapper = {
    value: val
  }
  // 使用 Object.defineProperty 在 wrapper 对象上定义一个不可枚举的属性 __v_isRef，并且值为 true
  Object.defineProperty(wrapper, IS_REF, {
    value: true
  })
  return shallow ? shallowReactive(wrapper) : reactive(wrapper)
}
export function ref(val) {
  return createRef(val, false)
}
export function shallowRef(val) {
  return createRef(val, true)
}

export function isRef(r) {
  return r ? r[IS_REF] === true : false
}

export function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key]
    },
    set value(val) {
      obj[key] = val
    }
  }
  Object.defineProperty(wrapper, IS_REF, {
    value: true
  })
  return wrapper
}

export function toRefs(obj) {
  const ret = {}
  for (const key in obj) {
    ret[key] = toRef(obj, key)
  }
  return ret
}

export function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      // 自动脱 ref 实现：如果读取的值是 ref，则返回它的 value 属性值
      return value[IS_REF] ? value.value : value
    },
    set(target, key, newValue, receiver) {
      const value = target[key]
      // 如果值是 Ref，则设置其对应的 value 属性值
      if (value[IS_REF]) {
        value.value = newValue
        return true
      }
      return Reflect.set(target, key, newValue, receiver)
    }
  })
}
