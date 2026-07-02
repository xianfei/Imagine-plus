/**
 * HEIC/AVIF decode fallback for platforms without macOS ImageIO
 * (Windows/Linux Tauri builds). Decodes in the webview and hands raw
 * RGBA back to the Rust side, which writes the standard `{id}.1.png`
 * intermediate consumed by the optimize pipeline.
 */
import { invoke } from '@tauri-apps/api/core'
import { IImageFile, SupportedExt } from '../common/types'

interface IRawImage {
  data: Uint8Array
  width: number
  height: number
}

/** libheif compiled to WASM; ~1s for a 12MP image */
async function decodeHeic(bytes: ArrayBuffer): Promise<IRawImage> {
  // dynamic import keeps the ~1MB WASM bundle out of the initial load
  const mod = await import('libheif-js/wasm-bundle')
  const libheif = mod.default ?? mod

  const decoder = new libheif.HeifDecoder()
  const images = decoder.decode(new Uint8Array(bytes))
  if (!images.length) throw new Error('libheif: no image in file')

  const image = images[0]
  const width = image.get_width()
  const height = image.get_height()

  const out = {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  }

  await new Promise<void>((resolve, reject) => {
    image.display(out, (result: unknown) => {
      if (result) resolve()
      else reject(new Error('libheif: display failed'))
    })
  })

  return { data: new Uint8Array(out.data.buffer), width, height }
}

/** AVIF via the webview's own codec (WebView2 is Chromium: supported) */
async function decodeViaCanvas(bytes: ArrayBuffer, mime: string): Promise<IRawImage> {
  const blob = new Blob([bytes], { type: mime })
  const bitmap = await createImageBitmap(blob)

  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return {
    data: new Uint8Array(pixels.data.buffer),
    width: canvas.width,
    height: canvas.height,
  }
}

const isMac = navigator.platform.toLowerCase().includes('mac')

/**
 * Ensure the PNG intermediate exists for heic/avif sources before the
 * Rust optimize command runs. No-op on macOS (ImageIO handles it) and
 * for natively decodable formats.
 */
export async function ensureIntermediate(image: IImageFile): Promise<void> {
  if (isMac) return
  if (image.ext !== SupportedExt.heic && image.ext !== SupportedExt.avif) return

  if (await invoke<boolean>('has_intermediate', { id: image.id })) return

  const bytes = await invoke<ArrayBuffer>('read_source', {
    id: image.id,
    ext: image.ext,
  })

  const raw = image.ext === SupportedExt.heic
    ? await decodeHeic(bytes).catch(() => decodeViaCanvas(bytes, 'image/heic'))
    : await decodeViaCanvas(bytes, 'image/avif')

  await invoke('write_intermediate', raw.data, {
    headers: {
      id: image.id,
      width: String(raw.width),
      height: String(raw.height),
    },
  })
}
