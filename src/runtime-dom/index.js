import { patchProp } from './patchProp.js'
import { nodeOps } from './nodeOps.js'
import { createRenderer } from '../runtime-core/index.js'
import { Text, Comment, Fragment } from "../runtime-core/index.js"

const rendererOptions = Object.assign({ patchProp }, nodeOps)
let renderer

function ensureRenderer() {
  return renderer || (renderer = createRenderer(rendererOptions))
}

export function render(...args) {
  return ensureRenderer().render(...args)
}

export function createApp(...args) {
  return ensureRenderer().createApp(...args)
}

export {
  Text,
  Comment,
  Fragment
}
