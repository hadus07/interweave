import type { Widget } from './types'
import { makeWidget } from './utils'

export function run(): Widget {
  return makeWidget('hello')
}
