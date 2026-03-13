import * as fs from 'fs-extra'
import log from 'electron-log'
import { IImageFile, IOptimizeOptions, SupportedExt } from '../common/types'
import * as fu from '../common/file-utils'
import {
  toPng,
  toJpeg,
  toWebp,
  toAvif,
  IOptimizeMethod,
} from '../optimizers'
import { getFileUrl } from '../common/file-utils'
import store from './configStore'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const convert = require('heic-convert')

const optimize = async (
  image: IImageFile,
  options: IOptimizeOptions,
): Promise<IImageFile> => {
  let sourcePath = fu.getFilePath(image)
  const optimizedId = fu.md5(image.id + JSON.stringify(options))
  let exportExt = options.exportExt || image.ext

  const dest: Partial<IImageFile> = {
    id: optimizedId,
    ext: exportExt,
    originalName: image.originalName,
  }

  if (exportExt === SupportedExt.heic || exportExt === SupportedExt.bmp) {
    exportExt = SupportedExt.jpg
  }

  const destPath = fu.getFilePath(dest)

  log.info('optimize', `convert [${image.ext}]${sourcePath} to [${exportExt}]${destPath}`)

  dest.url = getFileUrl(destPath)

  try {
    dest.size = await fu.getSize(destPath)
  } catch (err) {
    log.info('optimize', 'miss cache')

    if (image.ext === 'heic') {
      log.info('optimize', 'converting HEIC to PNG intermediate')

      const intermediate = sourcePath.replace(/\.heic$/, '.1.png')

      try {
        await fs.access(intermediate)
      } catch (error) {
        log.info('optimize', 'miss cache (heic intermediate)')
        const inputBuffer = await fs.readFile(sourcePath)
        const outputBuffer = await convert({
          buffer: inputBuffer,
          format: 'PNG',
        })
        await fs.writeFile(intermediate, outputBuffer)
      }

      sourcePath = intermediate
    }

    const globalOptions: IOptimizeOptions = {
      ...options,
      keepMetadata: store.get('keepmeta', true) as boolean,
      progressive: store.get('progressive', true) as boolean,
    }

    const factory: { [ext: string]: IOptimizeMethod } = {
      [SupportedExt.png]: toPng,
      [SupportedExt.jpg]: toJpeg,
      [SupportedExt.webp]: toWebp,
      [SupportedExt.avif]: toAvif,
    }

    const optimizeMethod = factory[exportExt]

    if (!optimizeMethod) {
      throw new Error(`Unsupported file format: ${image.ext}`)
    }

    await optimizeMethod(sourcePath, destPath, globalOptions)

    dest.size = await fu.getSize(destPath)
  }

  return dest as IImageFile
}

export default optimize
