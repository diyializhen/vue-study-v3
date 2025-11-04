import { baseParse } from './parser.js'
import { isString } from '../shared/shared.js'

export function baseCompile(source) {
  const ast = isString(source) ? baseParse(source) : source
}
