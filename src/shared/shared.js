export const objectToString = Object.prototype.toString
export const toTypeString = (value) =>
  objectToString.call(value)

export const toRawType = (value) => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1)
}

export const isObject = (val) => val !== null && typeof val === 'object'

export const isPlainObject = (val) => toTypeString(val) === '[object Object]'

export const isArray = Array.isArray

export const isString = (val) => typeof val === 'string'

export const isMap = (val) => toTypeString(val) === '[object Map]'
export const isSet = (val) => toTypeString(val) === '[object Set]'
export const isPromise = (val) => {
  return (
    (isObject(val) || isFunction(val)) &&
    isFunction(val.then) &&
    isFunction(val.catch)
  )
}
export const isFunction = (val) => typeof val === 'function'

const camelizeRE = /-(\w)/g
// 中划线命名转驼峰命名，c是匹配到的子表达式
export const camelize = str => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
}

// 首字母大写
export const capitalize = str =>
  str.charAt(0).toUpperCase() + str.slice(1)

// 首字母大写并添加on前缀
export const toHandlerKey = str =>
  str ? `on${capitalize(str)}` : ``

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (val, key) =>
  hasOwnProperty.call(val, key)
