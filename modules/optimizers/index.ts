import log from 'electron-log'
import { IOptimizeOptions } from '../common/types'

const sharp = require('sharp')
const bmp = require('sharp-bmp')

export type IOptimizeMethod = (
  input: string,
  output: string,
  options: IOptimizeOptions,
) => Promise<void>

function openImage(input: string) {
  return input.endsWith('.bmp') ? bmp.sharpFromBmp(input) : sharp(input)
}

export const toJpeg: IOptimizeMethod = (input, output, options) => {
  const { quality = 70, keepMetadata = true, progressive = true } = options
  log.info('toJpeg quality=%d', quality)
  const pipeline = openImage(input).jpeg({ quality, mozjpeg: true, progressive })
  if (keepMetadata) pipeline.keepMetadata()
  return pipeline.toFile(output).catch((e: { message: any }) => { throw new Error(e.message) })
}

export const toPng: IOptimizeMethod = (input, output, options) => {
  const { color = 256, keepMetadata = true, progressive = true } = options
  log.info('toPng colors=%d', color)
  const pipeline = openImage(input).png({ colors: color, progressive })
  if (keepMetadata) pipeline.keepMetadata()
  return pipeline.toFile(output).catch((e: { message: any }) => { throw new Error(e.message) })
}

export const toWebp: IOptimizeMethod = (input, output, options) => {
  const { quality = 80, keepMetadata = true } = options
  log.info('toWebp quality=%d', quality)
  const pipeline = openImage(input).webp({ quality })
  if (keepMetadata) pipeline.keepMetadata()
  return pipeline.toFile(output).catch((e: { message: any }) => { throw new Error(e.message) })
}

export const toAvif: IOptimizeMethod = (input, output, options) => {
  const { quality = 50, keepMetadata = true } = options
  log.info('toAvif quality=%d', quality)
  const pipeline = openImage(input).avif({ quality })
  if (keepMetadata) pipeline.keepMetadata()
  return pipeline.toFile(output).catch((e: { message: any }) => { throw new Error(e.message) })
}
