import { spawn } from 'child-process-promise'
import log from 'electron-log'
// import * as bins from './bin'
import { IOptimizeOptions } from '../common/types'
const sharp = require("sharp");
const bmp = require("sharp-bmp");
import store from '../backend/configStore'

// const createEnv = () => ({
//   ...process.env,
//   LD_LIBRARY_PATH: bins.basePath,
// } as NodeJS.ProcessEnv)

export type IOptimizeMethod = (
  input: string,
  output: string,
  options: IOptimizeOptions,
) => Promise<{ stdout: string; stderr: string }>

// export const mozjpeg: IOptimizeMethod = (
//   input,
//   output,
//   options,
// ) => {
//   const { quality = 70 } = options

//   const spawnArgs = [
//     '-quality',
//     quality.toString(),
//     '-outfile',
//     output,
//     input,
//   ]

//   log.info('spawn', bins.mozjpeg, spawnArgs)

//   return spawn(bins.mozjpeg, spawnArgs, {
//     capture: ['stdout', 'stderr'],
//     env: createEnv(),
//   }).catch((e) => {
//     throw new Error(`${e.message}\n${e.stderr}`)
//   })
// }

export const mozjpeg: IOptimizeMethod = (
  input,
  output,
  options,
) => {
  const { quality = 70 } = options

  log.info('Converting to jpeg with quality', quality)

  const pipeline = (input.endsWith('.bmp')?bmp.sharpFromBmp(input):sharp(input)).jpeg({ quality, mozjpeg: true , progressive: store.get("progressive", true)})

  if(store.get("keepmeta", true)) pipeline.keepMetadata();

  return (pipeline.toFile(output)).catch((e:{message:any}) => {
      throw new Error(`${e.message}`)
    })
}

export const pngquant: IOptimizeMethod = (
  input,
  output,
  options,
) => {
  const { color = 256 } = options

  log.info('Converting to jpeg with colors', color)

  const pipeline = (input.endsWith('.bmp')?bmp.sharpFromBmp(input):sharp(input)).png({ colors:color , progressive: store.get("progressive", true) })

  if(store.get("keepmeta", true)) pipeline.keepMetadata();

  return (pipeline.toFile(output)).catch((e:{message:any}) => {
      throw new Error(`${e.message}`)
    })
}

// export const pngquant: IOptimizeMethod = (
//   input,
//   output,
//   options,
// ) => {
//   const { color = 256 } = options

//   const spawnArgs = [
//     color.toString(),
//     input,
//     '-o',
//     output,
//   ]

//   log.info('spawn', bins.pngquant, spawnArgs)

//   return spawn(bins.pngquant, spawnArgs, {
//     capture: ['stdout', 'stderr'],
//     env: createEnv(),
//   }).catch((e) => {
//     throw new Error(`${e.message}\n${e.stderr}`)
//   })
// }

// export const cwebp: IOptimizeMethod = (
//   input,
//   output,
//   options,
// ) => {
//   const { quality = 80 } = options

//   const spawnArgs = [
//     '-q',
//     quality.toString(),
//     input,
//     '-o',
//     output,
//   ]

//   log.info('spawn', bins.cwebp, spawnArgs)

//   return spawn(bins.cwebp, spawnArgs, {
//     capture: ['stdout', 'stderr'],
//     env: createEnv(),
//   }).catch((e) => {
//     throw new Error(`${e.message}\n${e.stderr}`)
//   })
// }

export const cwebp: IOptimizeMethod = (
  input,
  output,
  options,
) => {
  const { quality = 80 } = options

  log.info('Converting to webp with quality', quality)

  const pipeline = (input.endsWith('.bmp')?bmp.sharpFromBmp(input):sharp(input)).webp({ quality })

  if(store.get("keepmeta", true)) pipeline.keepMetadata();

  return (pipeline.toFile(output)).catch((e:{message:any}) => {
      throw new Error(`${e.message}`)
    })
}

export const cavif: IOptimizeMethod = (
  input,
  output,
  options,
) => {
  const { quality = 50 } = options

  log.info('Converting to AVIF with quality', quality)

  const pipeline = (input.endsWith('.bmp')?bmp.sharpFromBmp(input):sharp(input)).avif({ quality })

  if(store.get("keepmeta", true)) pipeline.keepMetadata();

  return (pipeline.toFile(output)).catch((e:{message:any}) => {
      throw new Error(`${e.message}`)
    })
}