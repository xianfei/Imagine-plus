import * as os from 'os'
import * as fs from 'fs-extra'
import { execFile } from 'child_process'
import { promisify } from 'util'
import log from 'electron-log'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const heicDecode = require('heic-decode')

const execFileAsync = promisify(execFile)

const SIPS_TIMEOUT = 120 * 1000

/**
 * Decode HEIC via macOS ImageIO (hardware HEVC on Apple Silicon).
 * Runs out-of-process, so the main process stays responsive.
 */
async function decodeWithSips(sourcePath: string, destPath: string) {
  await execFileAsync('sips', ['-s', 'format', 'png', sourcePath, '--out', destPath], {
    timeout: SIPS_TIMEOUT,
  })

  const { size } = await fs.stat(destPath)
  if (!size) {
    throw new Error('sips produced an empty file')
  }
}

/**
 * Decode HEIC with libheif (WASM) to raw RGBA, then let sharp write the PNG.
 * The WASM decode blocks while it runs, but skipping the JS PNG encoder
 * makes this notably faster than the old heic-convert path.
 */
async function decodeWithWasm(sourcePath: string, destPath: string) {
  const buffer = await fs.readFile(sourcePath)
  const { width, height, data } = await heicDecode({ buffer })

  await sharp(Buffer.from(data), {
    raw: { width, height, channels: 4 },
    limitInputPixels: false,
  })
    .png()
    .toFile(destPath)
}

/**
 * Decode a HEIC file into a lossless PNG at `destPath`.
 * PNG keeps the optimize pipeline free of generational loss and doubles
 * as the preview image for the renderer (webviews cannot display HEIC).
 */
export async function decodeHeic(sourcePath: string, destPath: string): Promise<void> {
  if (os.platform() === 'darwin') {
    try {
      await decodeWithSips(sourcePath, destPath)
      log.info('heic', `decoded via sips: ${destPath}`)
      return
    } catch (err) {
      log.warn('heic', 'sips decode failed, falling back to wasm', err)
      await fs.remove(destPath).catch(() => undefined)
    }
  }

  await decodeWithWasm(sourcePath, destPath)
  log.info('heic', `decoded via wasm: ${destPath}`)
}
