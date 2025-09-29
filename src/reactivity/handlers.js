import { activeEffect } from "./effect.js"
import { isRef } from "./ref.js"
import { reactive, readonly } from "./reactive.js"
import { isMap, isObject, isArray } from "../shared/shared.js"

// 存储副作用函数的桶，使用WeakMap不影响被代理原始数据的垃圾回收。
// 这个WeakMap桶的设计是分成三层：
// WeakMap的键是被代理的原始对象target，值是一个Map实例。
// Map实例的键是原始对象target的key，值是存储副作用函数的Set。
const bucket = new WeakMap()

// 在 get 拦截函数内调用 track 函数追踪变化
export function track(target, key) {
  if (!activeEffect || !shouldTrack) return
  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

const TriggerType = {
  SET: 'SET',
  ADD: 'ADD',
  DELETE: 'DELETE',
}
// 在 set 拦截函数内调用 trigger 函数触发变化
export function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  // forEach遍历Set时，如果一个值被访问过了，但在遍历未结束时该值被删除并重新添加到集合，则会重新被访问。
  // 执行副作用函数时有删除再添加的动作，所以不直接遍历effects，创建一个新的Set来遍历避免无限循环。
  const effectsToRun = new Set()
  effects && effects.forEach(effectFn => {
    // 场景是如果副作用函数执行时先读取一个响应式数据，则收集了依赖，又设置了该数据，则会触发trigger执行副作用函数，而此时副作用函数已经在执行了，导致无限递归。所以判断如果触发的副作用函数和当前执行的相同则不执行。
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })
  // 如果是修改数组的 length 属性，需要把索引大于或等于length的元素，取出相关副作用函数执行
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }
  // 操作类型为ADD且是数组，说明在添加项，应该取出执行与 length 属性相关的副作用函数
  if (type === TriggerType.ADD && Array.isArray(target)) {
    const lengthEffects = depsMap.get('length')
    lengthEffects && lengthEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }
  // 操作类型为ADD添加或DELETE删除属性时，需要触发与 ITERATE_KEY 相关联的副作用函数执行
  if (
    type === TriggerType.ADD ||
    type === TriggerType.DELETE ||
    // 如果对Map类型的数据操作set，也要触发ITERATE_KEY关联的副作用函数
    (isMap(target) && type === TriggerType.SET)
  ) {
    const iterateEffects = depsMap.get(ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }
  // Map类型数据的ADD或DELETE，取出MAP_KEY_ITERATE_KEY相关的副作用函数
  if (
    (type === TriggerType.ADD ||type === TriggerType.DELETE) &&
    isMap(target)
  ) {
    const iterateEffects = depsMap.get(MAP_KEY_ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      // 响应式数据发生变化，trigger阶段如果存在调度器，不直接执行副作用函数，调用调度器并将副作用函数传过去
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}


/*
* Reflect方法的receiver参数：如果target对象中指定了getter，receiver则为getter调用时的this值。
* 为什么通过Reflect操作？
* 如果按照下放直接target[key]，当访问p.bar时，bar的get函数里this指向obj，然后通过原始数据this.foo访问了foo属性
* 而代理中只和bar建立了关联，跟foo毫无关联，那么访问foo时也不会触发响应。
* const obj = {foo: 1, get bar() { return this.foo } }
* const p = new Proxy(obj, { 
*   get(target, key) {
*     track(target, key)
*     return target[key]
*   } 
* })
* effect(() => console.log(p.bar))
*
* 如果bar不是get函数，是普通函数，通过p调用bar，则this指向被调用者p。
*/

// 创建一个唯一值，作为Reflect.ownKeys 操作和 for...in 循环操作的key
const ITERATE_KEY = Symbol()
export const RAW = '__v_raw'

/*
* 创建响应式数据代理
* @param {boolean} isShallow - 是否是浅响应
* @param {boolean} isReadonly - 是否是只读
*/
export function createBaseHandlers(isShallow = false, isReadonly = false) {
  return {
    get(target, key, receiver) {
      // 让代理对象可以通过 raw 属性访问原始数据
      if (key === RAW) {
        return target
      }
      // 如果操作的目标对象是数组，并且 key 存在于arrayInstrumentations上，返回定义在arrayInstrumentations的值
      const targetIsArray = Array.isArray(target)
      if (targetIsArray && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }
      // 将副作用函数与target和key建立关联，只有 非只读，非symbol 的数据才建立关联
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }
      const res = Reflect.get(target, key, receiver)
      // 如果是浅响应，则直接返回结果
      if (isShallow) {
        return res
      }
      // 如果值是ref，解包
      if (isRef(res)) {
        return targetIsArray ? res : res.value
      }
      if (isObject(res)) {
        // 如果获取的是对象，则包装成响应式数据返回
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
    },
    set(target, key, newVal, receiver) {
      // 如果是只读的，打印警告并返回
      if (isReadonly) {
        console.warn(`属性${key}是只读的`)
        return true
      }
      const oldVal = target[key]
      // 数组设置大于长度的索引时，是新增类型
      const type = Array.isArray(target)
        ? Number(key) < target.length ? TriggerType.SET : TriggerType.ADD
        : Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD
      // 设置属性值，如果值是响应式对象，通过RAW属性设置其原始值到target上，避免污染数据
      const rawValue = newVal?.[RAW] || newVal
      const res = Reflect.set(target, key, rawValue, receiver)
      // 只有receiver是target的代理时才触发更新
      // 如果设置子对象的属性在其原型上且原型也有代理，则又触发原型代理对象的set，导致更新两次
      // 原型代理对象的set里的receiver依然是子对象的代理，根据这个判断屏蔽掉原型代理的触发更新
      if (target === receiver[RAW]) {
        // 比较新值与旧值，只有当它们不全等，并且不都是 NaN 的时候才触发响应，新旧值都是NaN视为不变，NaN === NaN 为false
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type, newVal)
        }
      }
      return res
    },
    // 使用 has 拦截 in 操作符
    has(target, key) {
      track(target, key)
      return Reflect.has(target, key)
    },
    // 使用 ownKeys 拦截函数来拦截 Reflect.ownKeys 操作和 for...in 循环
    // 此时的操作不与任何具体的键绑定，所以对这种情况创建了一个唯一值ITERATE_KEY来绑定
    // 如果是数组，则length改变会影响for..in循环，使用length作为key建立响应联系
    ownKeys(target) {
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
    // 拦截delete操作符
    deleteProperty(target, key) {
      // 如果是只读的，打印警告并返回
      if (isReadonly) {
        console.warn(`属性${key}是只读的`)
        return true
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const res = Reflect.deleteProperty(target, key)
      if (res && hadKey) {
        // 只有当被删除的属性是对象自己的属性并且成功删除时，才触发更新
        trigger(target, key, TriggerType.DELETE)
      }
      return res
    }
  }
}

// 数组的for..of遍历和values方法，都是调用数组的遍历器Symbol.iterator，遍历器的执行会读取数组的索引和length属性，这两个已经添加了追踪，不需要额外处理


// 重写数组查找方法，通过在代理的get中拦截并返回arrayInstrumentations存在的方法来实现
// 目的是为了解决使用数组方法时代理和原始值混用的情况，比如：
/*
* // arr.includes查找的是代理对象，而obj是原始值，所以返回false
* const obj = {}
* const arr = reactive([obj])
* arr.includes(obj) // false
* */
const arrayInstrumentations = {}
;['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function(...args) {
    // this为代理对象，先在代理对象中查找，将结果存储到 res 中
    const res = originMethod.apply(this, args)
    if (res === false || res === -1) {
      // res 为 false 说明没找到，通过 this[RAW] 拿到原始数组，再去其中查找并更新 res 值
      res = originMethod.apply(this[RAW], args)
    }
    // 返回结果
    return res
  }
})


/*
* const arr = reactive([])
* effect(() => arr.push(1))
* effect(() => arr.push(1))
* 重写数组隐式修改长度的方法原因：
* 如上代码，push执行时即会读取数组length，又会设置数组length，
* 当第二个副作用函数执行时设置length，则又取出第一个副作用函数执行，第一个执行设置length又会导致第二个副作用函数再次执行，循环执行导致栈溢出。
* 因为这些方法语义上是做修改，而不是读取，所以要在这些方法执行时通过shouldTrack标识暂时屏蔽对length的追踪
*/

// 一个标记变量，代表是否进行追踪。默认值为 true，即允许追踪
let shouldTrack = true
// 重写数组隐式修改长度的方法
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function(...args) {
    // 在调用原始方法之前，禁止追踪
    shouldTrack = false
    let res = originMethod.apply(this, args)
    // 在调用原始方法之后，恢复原来的行为，即允许追踪
    shouldTrack = true
    return res
  }
})

// 代理Set和Map---开始---------------------------------------
export function createCollectionHandlers(isShallow = false, isReadonly = false) {
  return {
    get(target, key, receiver) {
      // 让代理对象可以通过 raw 属性访问原始数据
      if (key === RAW) {
        return target
      }
      if (key === 'size') {
        // 新增删除都会影响size，建立ITERATE_KEY与副作用函数的响应
        track(target, ITERATE_KEY)
        // Set.prototype.size是一个访问器属性，它的set访问器函数是undefined，而通过代理访问size时，get访问器函数里的this指向了代理
        // 所以读取size属性时，通过第三个参数指定receiver为原始对象，修复问题
        return Reflect.get(target, key, target)
      }
      // 返回定义在 mutableInstrumentations 对象下的方法
      return getInstrumentations(isShallow, isReadonly)[key]
    }
  }
}
// 性能考虑，根据isShallow, isReadonly创建四种对象，而不用每次新增响应式对象就创建新对象
const mutableInstrumentations = createMutableInstrumentations(false, false)
const shallowMutableInstrumentations = createMutableInstrumentations(true, false)
const readonlyInstrumentations = createMutableInstrumentations(false, true)
const shallowReadonlyInstrumentations = createMutableInstrumentations(true, true)
function getInstrumentations(isShallow, isReadonly) {
  return isShallow
    ? isReadonly
      ? shallowReadonlyInstrumentations
      : shallowMutableInstrumentations
    : isReadonly
      ? readonlyInstrumentations
      : mutableInstrumentations
}
function createMutableInstrumentations(isShallow, isReadonly) {
  // 重写Map，Set原型方法
  // add和delete调用trigger触发响应，get调用track收集依赖建立响应
  return {
    add(key) {
      if (isReadonly) {
        console.warn(`数据是只读的，无法添加${key}`)
        return true
      }
      // 源数据
      const target = this[RAW]
      const hasKey = target.has(key)
      const rawKey = key[RAW] || key
      const res = target.add(rawKey)
      // 只加没有的
      if (!hasKey) {
        // 指定操作类型为ADD，trigger则触发ITERATE_KEY相关副作用函数
        trigger(target, key, TriggerType.ADD)
      }
      return res
    },
    // 逻辑和add差不多
    delete(key) {
      if (isReadonly) {
        console.warn(`${key}是只读的`)
        return true
      }
      const target = this[RAW]
      const hasKey = target.has(key)
      const res = target.delete(key)
      if (hasKey) {
        trigger(target, key, TriggerType.DELETE)
      }
      return res
    },
    get(key) {
      const target = this[RAW]
      const had = target.has(key)
      // 追踪依赖
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }
      if (had) {
        const res = target.get(key)
        if (isShallow) {
          return res
        }
        if (isRef(res)) {
          return targetIsArray ? res : res.value
        }
        if (isObject(res)) {
          // 如果获取的是对象，则包装成响应式数据返回
          return isReadonly ? readonly(res) : reactive(res)
        }
        return res
      }
    },
    set(key, value) {
      const target = this[RAW]
      if (isReadonly) {
        console.warn(`数据是只读的，不能设置${key}`)
        return this
      }
      const had = target.has(key)
      const oldValue = target.get(key)
      // 如果有获取原始数据，避免将响应数据设置到原生数据上，造成污染
      const rawValue = value[RAW] || value
      target.set(key, rawValue)
      if (!had) {
        // 没有key，是新增
        trigger(target, key, TriggerType.ADD)
      } else if (oldValue !== value && (oldValue === oldValue &&
value === value)) {
        // 新旧值不同，且都不是NaN，新旧值都是NaN视为不变
        trigger(target, key, TriggerType.SET)
      }
      return this
    },
    forEach(callBack, thisArg) {
      // 把可代理的值转换为响应式数据
      const wrap = (val) => isObject(val) ? reactive(val) : val
      const target = this[RAW]
      // 与ITERATE_KEY建立响应联系，对forEach来说，影响数据数量变化的操作应该触发副作用函数执行
      track(target, ITERATE_KEY)
      target.forEach((v, k) => {
        // 将参数转换成响应式数据
        // 此处的this是遍历的指代理数据，thisArg是forEach的参数，指定回调函数中的this的指向
        callBack.call(thisArg, wrap(v), wrap(k), this)
      })
      // forEach遍历Map数据时，不仅会访问键，还会访问值，所以对Map做set操作时也要触发ITERATE_KEY相关的副作用函数
    },
    [Symbol.iterator]: iterationMethod,
    entries: iterationMethod,
    values: valuesIterationMethod,
    keys: keysIterationMethod
  }
}
// Symbol.iterator和entries拦截方法
function iterationMethod() {
  const target = this[RAW]
  // 获取原始迭代器
  const itr = target[Symbol.iterator]()
  // 包装代理数据
  const wrap = (val) => isObject(val) ? reactive(val) : val
  // 迭代器与元素数量有关，与ITERATE_KEY建立响应连接
  track(target, ITERATE_KEY)
  // 返回自定义的迭代器
  return {
    next() {
      // 调用原始的next方法
      const { value, done } = itr.next()
      // 包装响应式数据
      return {
        value: value && isArray(value) ? [wrap(value[0]), wrap(value[1])] : value,
        done
      }
    },
    [Symbol.iterator]() {
      return this
    }
  }
}
// values拦截方法
function valuesIterationMethod() {
  const target = this[RAW]
  // 通过 target.values 获取原始迭代器方法
  const itr = target.values()
  const wrap = (val) => isObject(val) ? reactive(val) : val
  track(target, ITERATE_KEY)
  return {
    next() {
      const { value, done } = itr.next()
      return {
        // 与entries的区别是只返回值
        value: wrap(value),
        done
      }
    },
    [Symbol.iterator]() {
      return this
    }
  }
}

const MAP_KEY_ITERATE_KEY = Symbol()
// keys拦截方法
function keysIterationMethod() {
  const target = this[RAW]
  // 通过 target.values 获取原始迭代器方法
  const itr = target.keys()
  const wrap = (val) => isObject(val) ? reactive(val) : val
  // 此处创建一个新的键来关联而不是ITERATE_KEY，
  // 因为track里判断了Map数据的set操作也会触发ITERATE_KEY关联的副作用函数，而对于keys方法来说只关心键的变化，
  // 所以创建一个新的MAP_KEY_ITERATE_KEY，对应的track里也要调整
  track(target, MAP_KEY_ITERATE_KEY)
  return {
    next() {
      const { value, done } = itr.next()
      return {
        // 与entries的区别是只返回值
        value: wrap(value),
        done
      }
    },
    [Symbol.iterator]() {
      return this
    }
  }
}
// 代理Set和Map---结束---------------------------------------
