import { isArray, isObject, isString } from "./shared.js"

// 规范传的class，返回class字符串
export function normalizeClass(value) {
  let res = ''
  if (isString(value)) {
    // 字符串直接返回
    res = value
  } else if (isArray(value)) {
    // 数组递归调用normalizeClass，拼接结果
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    // 对象，如果值是true类型的，拼接属性名
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}

// 规范传的style，返回style对象
export function normalizeStyle(value) {
  if (isArray(value)) {
    const res = {}
    for (let i = 0; i < value.length; i++) {
      const item = value[i]
      const normalized = isString(item)
        ? parseStringStyle(item)
        : normalizeStyle(item)
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (isString(value) || isObject(value)) {
    return value
  }
}

const listDelimiterRE = /;(?![^(]*\))/g
const propertyDelimiterRE = /:([^]+)/
const styleCommentRE = /\/\*[^]*?\*\//g

// 将style字符串转成规范的对象，去除注释，无效的样式，空格
export function parseStringStyle(cssText) {
  const ret = {}
  cssText
    .replace(styleCommentRE, '')
    .split(listDelimiterRE)
    .forEach(item => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE)
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim())
      }
    })
  return ret
}

// 将规范的style对象转成样式字符串
export function stringifyStyle(styles) {
  if (!styles) return ''
  if (isString(styles)) return styles

  let ret = ''
  for (const key in styles) {
    const value = styles[key]
    if (isString(value) || typeof value === 'number') {
      // only render valid values
      ret += `${key}:${value};`
    }
  }
  return ret
}

export function normalizeProps(props) {
  if (!props) return null
  let { class: klass, style } = props
  if (klass && !isString(klass)) {
    props.class = normalizeClass(klass)
  }
  if (style) {
    props.style = normalizeStyle(style)
  }
  return props
}
