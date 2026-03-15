import log from 'electron-log'
import { IOptimizeOptions, IResizeOptions, ResizeMode } from '../common/types'

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

async function applyResize(pipeline: any, resize: IResizeOptions): Promise<void> {
  if (resize.mode === ResizeMode.LONG_EDGE) {
    pipeline.resize(resize.value, resize.value, { fit: 'inside', withoutEnlargement: true })
    return
  }

  const { width = 1, height = 1 } = await pipeline.metadata()

  if (resize.mode === ResizeMode.SHORT_EDGE) {
    const short = Math.min(width, height)
    if (short > resize.value) {
      const scale = resize.value / short
      pipeline.resize(Math.round(width * scale), Math.round(height * scale))
    }
  } else {
    // SCALE: value is a percentage (e.g. 50 = 50%)
    const factor = resize.value / 100
    if (factor !== 1) {
      pipeline.resize(Math.round(width * factor), Math.round(height * factor), { fit: 'fill' })
    }
  }
}

export const toJpeg: IOptimizeMethod = async (input, output, options) => {
  const { quality = 70, keepMetadata = true, progressive = true, resize } = options
  log.info('toJpeg quality=%d', quality)
  const pipeline = openImage(input)
  if (resize?.enabled) await applyResize(pipeline, resize)
  pipeline.jpeg({ quality, mozjpeg: true, progressive })
  if (keepMetadata) pipeline.keepMetadata()
  return pipeline.toFile(output).catch((e: { message: any }) => { throw new Error(e.message) })
}

export const toPng: IOptimizeMethod = async (input, output, options) => {
  const { color = 256, keepMetadata = true, progressive = true, resize } = options
  log.info('toPng colors=%d', color)
  const pipeline = openImage(input)
  if (resize?.enabled) await applyResize(pipeline, resize)
  pipeline.png({ colors: color, progressive })
  if (keepMetadata) pipeline.keepMetadata()
  return pipeline.toFile(output).catch((e: { message: any }) => { throw new Error(e.message) })
}

export const toWebp: IOptimizeMethod = async (input, output, options) => {
  const { quality = 80, keepMetadata = true, resize } = options
  log.info('toWebp quality=%d', quality)
  const pipeline = openImage(input)
  if (resize?.enabled) await applyResize(pipeline, resize)
  pipeline.webp({ quality })
  if (keepMetadata) pipeline.keepMetadata()
  return pipeline.toFile(output).catch((e: { message: any }) => { throw new Error(e.message) })
}

export const toAvif: IOptimizeMethod = async (input, output, options) => {
  const { quality = 50, keepMetadata = true, resize } = options
  log.info('toAvif quality=%d', quality)
  const pipeline = openImage(input)
  if (resize?.enabled) await applyResize(pipeline, resize)
  pipeline.avif({ quality })
  if (keepMetadata) pipeline.keepMetadata()
  return pipeline.toFile(output).catch((e: { message: any }) => { throw new Error(e.message) })
}
