/* 
通过Tokenizer对字符串进行遍历，
根据规则和遍历到的字符来切换当前状态，
下次遍历根据当前状态确定现在处理什么内容，
当前状态的字符处理完毕调用对应传入的回调，通知当前状态字符的开始到结束下标
*/
// a-z，A-Z，只有字母是合法的tagName
function isTagStartChar(c) {
  return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
}
// 是否为空白字符，空字符串，换行符，回车符，tab，换页符
export function isWhitespace(c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f'
}

// 标签是否结束
function isEndOfTagSection(c) {
  return c === '/' || c === '>' || isWhitespace(c)
}

export const State = {
  Text: 'Text',
  // 标签字符相关
  BeforeTagName: 'BeforeTagName',
  InTagName: 'InTagName',
  InSelfClosingTag: 'InSelfClosingTag',
  BeforeClosingTagName: 'BeforeClosingTagName',
  InClosingTagName: 'InClosingTagName',
  AfterClosingTagName: 'AfterClosingTagName',

  // 插值字符相关
  InterpolationOpen: 'InterpolationOpen',
  Interpolation: 'Interpolation',
  InterpolationClose: 'InterpolationClose',

  // 属性相关
  BeforeAttrName: 'BeforeAttrName',
  InAttrName: 'InAttrName',
  AfterAttrName: 'AfterAttrName',
  BeforeAttrValue: 'BeforeAttrValue',
  InAttrValueDq: 'InAttrValueDq', // "
  InAttrValueSq: 'InAttrValueSq', // '
  InAttrValueNq: 'InAttrValueNq', // 属性值没有引号
  InDirName: 'InDirName', // v-xxx 的 指令xxx，或者. : @ #这些符号也是指令
  InDirArg: 'InDirArg', // .yyy :yyy, @yyy, #yyy 这些符号指令开头的yyy
  InDirModifier: 'InDirModifier', // 指令后面 .xxx 的xxx修饰符
  InDirDynamicArg: 'InDirDynamicArg', // v-[xxx] 的xxx
}

// 引号的类型
export const QuoteType = {
  NoValue: 0,
  Unquoted: 1,
  Single: 2,
  Double: 3
}

// 插值默认的分隔符，可以更改
const defaultDelimitersOpen = ['{', '{']
const defaultDelimitersClose = ['}', '}']

export default class Tokenizer {
  state = State.Text // 当前状态
  buffer = '' // 解析的文本
  index = 0 // 当前解析的下标
  // 解析到一个状态时，存储当前下标为sectionStart，后面继续解析到下个状态时，sectionStart到index的内容就是这个状态的内容
  sectionStart = 0 
  cbs = {}

  constructor(cbs) {
    this.cbs = cbs
  }

  reset() {
    this.state = State.Text
    this.buffer = ''
    this.sectionStart = 0
    this.index = 0
    this.delimiterOpen = defaultDelimitersOpen
    this.delimiterClose = defaultDelimitersClose
  }

  stateText(c) {
    if (c === '<') {
      // 标签开始
      if (this.index > this.sectionStart) {
        // 如果 < 之前有文本，调用ontext
        this.cbs.ontext(this.sectionStart, this.index)
      }
      // 更新状态和sectionStart
      this.state = State.BeforeTagName
      this.sectionStart = this.index
    } else if (c === this.delimiterOpen[0]) {
      this.state = State.InterpolationOpen
      this.delimiterIndex = 0
      this.stateInterpolationOpen(c)
    }
  }

  delimiterIndex = -1 // 插值分隔符下标
  delimiterOpen = defaultDelimitersOpen // 插值开始分隔符
  delimiterClose = defaultDelimitersClose // 插值结束分隔符

  // 解析插值开始分隔符
  stateInterpolationOpen(c) {
    if (c === this.delimiterOpen[this.delimiterIndex]) {
      if (this.delimiterIndex === this.delimiterOpen.length - 1) {
        // 解析到开始插值字符最后一位
        // 计算开始插值字符第一位的下标
        const start = this.index + 1 - this.delimiterOpen.length
        if (start > this.sectionStart) {
          // 如果开始插值字符之前有文本
          this.cbs.ontext(this.sectionStart, start)
        }
        // 更新状态和sectionStart
        this.state = State.Interpolation
        this.sectionStart = start
      } else {
        // 没到开始插值字符最后一位，delimiterIndex自增
        this.delimiterIndex++
      }
    } else {
      // 不是插值分隔符，状态改为text继续解析
      this.state = State.Text
      this.stateText(c)
    }
  }
  // 解析插值内容
  stateInterpolation(c) {
    // 直到解析到插值结束字符改变状态，重置delimiterIndex
    if (c === this.delimiterClose[0]) {
      this.state = State.InterpolationClose
      this.delimiterIndex = 0
      this.stateInterpolationClose(c)
    }
  }
  // 解析插值结束分隔符
  stateInterpolationClose(c) {
    if (c === this.delimiterClose[this.delimiterIndex]) {
      if (this.delimiterIndex === this.delimiterClose.length - 1) {
        // 解析到插值结束字符最后一位，执行回调，重置状态。sectionStart到index + 1的内容是包括插值字符的内容。
        this.cbs.oninterpolation(this.sectionStart, this.index + 1)
        this.state = State.Text
        this.sectionStart = this.index + 1
      } else {
        // 没到结束字符最后一位，delimiterIndex自增
        this.delimiterIndex++
      }
    } else {
      // 不符合插值结束字符，状态改为interpolation继续解析
      this.state = State.Interpolation
      this.stateInterpolation(c)
    }
  }
  // 标签开始
  stateBeforeTagName(c) {
    if (isTagStartChar(c)) {
      // 符合标签名规则
      this.sectionStart = this.index
      this.state = State.InTagName
    } else if (c === '/') {
      // html结束标签字符
      this.state = State.BeforeClosingTagName
    } else {
      // 不符合继续解析
      this.state = State.Text
      this.stateText(c)
    }
  }

  stateInTagName(c) {
    if (isEndOfTagSection(c)) {
      // 如果tagName结束了
      this.handleTagName(c)
    }
  }

  handleTagName(c) {
    // 执行onopentagname
    this.cbs.onopentagname(this.sectionStart, this.index)
    this.sectionStart = -1
    // 状态变成BeforeAttrName
    this.state = State.BeforeAttrName
    this.stateBeforeAttrName(c)
  }

  stateInSelfClosingTag(c) {
    if (c === '>') {
      this.cbs.onselfclosingtag(this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    }
  }

  stateBeforeClosingTagName(c) {
    if (isWhitespace(c)) {
      // 忽略
    } else if (c === '>') {
      this.state = State.Text
      this.sectionStart = this.index + 1
    } else {
      this.state = State.InClosingTagName
      this.sectionStart = this.index
    }
  }

  stateInClosingTagName(c) {
    if (c === '>' || isWhitespace(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index)
      this.sectionStart = -1
      this.state = State.AfterClosingTagName
      this.stateAfterClosingTagName(c)
    }
  }

  stateAfterClosingTagName(c) {
    if (c === '>') {
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }

  stateBeforeAttrName(c) {
    if (c === '>') {
      // 标签结束了，更新状态为Text，更新sectionStart
      this.cbs.onopentagend(this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    } else if (c === '/') {
      // 自闭合标签，不用做什么
      this.state = State.InSelfClosingTag
    } else if (!isWhitespace(c)) {
      // 非空白字符
      this.handleAttrStart(c)
    }
  }

  handleAttrStart(c) {
    if (c === 'v' && this.peek() === '-') {
      // v-xxx 开头的指令
      this.state = State.InDirName
      this.sectionStart = this.index
    } else if (
      c === '.' ||
      c === ':' ||
      c === '@' ||
      c === '#'
    ) {
      // 这些符号也是指令，后面内容是指令参数
      this.cbs.ondirname(this.index, this.index + 1)
      this.state = State.InDirArg
      this.sectionStart = this.index + 1
    } else {
      // 其他情况，即普通属性名
      this.state = State.InAttrName
      this.sectionStart = this.index
    }
  }

  stateInAttrName(c) {
    if (c === '=' || isEndOfTagSection(c)) {
      // 出现等于号或者标签结束了或空白字符
      this.cbs.onattribname(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    }
  }
  // 处理AttrNameEnd时要改变的状态
  handleAttrNameEnd(c) {
    this.sectionStart = this.index
    this.state = State.AfterAttrName
    this.cbs.onattribnameend(this.index)
    this.stateAfterAttrName(c)
  }
  // 属性名之后
  stateAfterAttrName(c) {
    if (c === '=') {
      // 等于号后面状态BeforeAttrValue
      this.state = State.BeforeAttrValue
    } else if (c === '/' || c === '>') {
      // 标签结束
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      this.sectionStart = -1
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    } else if (!isWhitespace(c)) { 
      // 非空白字符
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      this.handleAttrStart(c)
    }
  }

  stateBeforeAttrValue(c) {
    if (c === '"') {
      this.state = State.InAttrValueDq
      this.sectionStart = this.index + 1
    } else if (c === "'") {
      this.state = State.InAttrValueSq
      this.sectionStart = this.index + 1
    } else if (!isWhitespace(c)) {
      // 属性值无引号
      this.sectionStart = this.index
      this.state = State.InAttrValueNq
      this.stateInAttrValueNoQuotes(c)
    }
  }

  // 处理属性值
  // quote: 当前的引号，" 或 '
  handleInAttrValue(c, quote) {
    if (c === quote) {
      // 属性值结束
      this.cbs.onattribdata(this.sectionStart, this.index)
      this.sectionStart = -1
      this.cbs.onattribend(
        quote === '"' ? QuoteType.Double : QuoteType.Single,
        this.index + 1,
      )
      this.state = State.BeforeAttrName
    }
  }

  stateInAttrValueDoubleQuotes(c) {
    this.handleInAttrValue(c, '"')
  }

  stateInAttrValueSingleQuotes(c) {
    this.handleInAttrValue(c, "'")
  }

  stateInAttrValueNoQuotes(c) {
    if (isWhitespace(c) || c === '>') {
      // 属性值结束
      this.cbs.onattribdata(this.sectionStart, this.index)
      this.sectionStart = -1
      this.cbs.onattribend(QuoteType.Unquoted, this.index)
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    }
  }

  stateInDirName(c) {
    if (c === '=' || isEndOfTagSection(c)) {
      // 出现等于号或者标签结束，说明指令结束了
      this.cbs.ondirname(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (c === ':') {
      // v-bind:click 这种遇到冒号，后续是指令参数
      this.cbs.ondirname(this.sectionStart, this.index)
      this.state = State.InDirArg
      this.sectionStart = this.index + 1
    } else if (c === '.') {
      // 遇到点，后续是修饰符。如：@clock.once
      this.cbs.ondirname(this.sectionStart, this.index)
      this.state = State.InDirModifier
      this.sectionStart = this.index + 1
    }
  }

  stateInDirArg(c) {
    if (c === '=' || isEndOfTagSection(c)) {
      // 出现等于号或者标签结束，说明指令参数结束了
      this.cbs.ondirarg(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (c === '[') {
      this.state = State.InDirDynamicArg
    } else if (c === '.') {
      this.cbs.ondirarg(this.sectionStart, this.index)
      this.state = State.InDirModifier
      this.sectionStart = this.index + 1
    }
  }

  stateInDirModifier(c) {
    if (c === '=' || isEndOfTagSection(c)) {
      // .xxx的修饰符结束了
      this.cbs.ondirmodifier(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (c === '.') {
      this.cbs.ondirmodifier(this.sectionStart, this.index)
      this.sectionStart = this.index + 1
    }
  }

  stateInDynamicDirArg(c) {
    if (c === ']') {
      // 说明v-[xxx] 指令内容结束了
      this.state = State.InDirArg
    } else if (c === '=' || isEndOfTagSection(c)) {
      // 遇到等于号，或者标签结束，则结束
      this.cbs.ondirarg(this.sectionStart, this.index + 1)
      this.handleAttrNameEnd(c)
    }
  }

  peek() {
    return this.buffer.charAt(this.index + 1)
  }

  parse(input) {
    this.buffer = input
    // 通过下标index自增，逐个遍历字符串
    while (this.index < this.buffer.length) {
      const c = this.buffer.charAt(this.index)
      switch (this.state) {
        case State.Text: 
          this.stateText(c)
          break
        case State.InterpolationOpen: {
          this.stateInterpolationOpen(c)
          break
        }
        case State.Interpolation: {
          this.stateInterpolation(c)
          break
        }
        case State.InterpolationClose: {
          this.stateInterpolationClose(c)
          break
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c)
          break
        }
        case State.InTagName: {
          this.stateInTagName(c)
          break
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c)
          break
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(c)
          break
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(c)
          break
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(c)
          break
        }
        case State.BeforeAttrName: {
          this.stateBeforeAttrName(c)
          break
        }
        case State.InAttrName: {
          this.stateInAttrName(c)
          break
        }
        case State.AfterAttrName: {
          this.stateAfterAttrName(c)
          break
        }
        case State.BeforeAttrValue: {
          this.stateBeforeAttrValue(c)
          break
        }
        case State.InAttrValueDq: {
          this.stateInAttrValueDoubleQuotes(c)
          break
        }
        case State.InAttrValueSq: {
          this.stateInAttrValueSingleQuotes(c)
          break
        }
        case State.InAttrValueNq: {
          this.stateInAttrValueNoQuotes(c)
          break
        }
        case State.InDirName: {
          this.stateInDirName(c)
          break
        }
        case State.InDirArg: {
          this.stateInDirArg(c)
          break
        }
        case State.InDirModifier: {
          this.stateInDirModifier(c)
          break
        }
        case State.InDirDynamicArg: {
          this.stateInDynamicDirArg(c)
          break
        }
      }
      this.index++
    }
    this.cleanup()
    this.finish()
  }
  cleanup() {
    if (this.sectionStart !== this.index) {
      if (this.state === State.Text) {
        this.cbs.ontext(this.sectionStart, this.index)
        this.sectionStart = this.index
      } else if (
        this.state === State.InAttrValueDq ||
        this.state === State.InAttrValueSq ||
        this.state === State.InAttrValueNq
      ) {
        this.cbs.onattribdata(this.sectionStart, this.index)
        this.sectionStart = this.index
      }
    }
  }
  finish() {
    const endIndex = this.buffer.length
    if (this.sectionStart < endIndex) {
      this.cbs.ontext(this.sectionStart, endIndex)
    }
    this.cbs?.onend()
  }
}
