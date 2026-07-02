/**
 * Tauri implementation of the ImagineAPI bridge.
 * Mirrors bridge/preload.ts so the renderer code runs unchanged.
 */
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  IImageFile,
  IUpdateInfo,
  IpcChannel,
} from '../common/types'
import { ImagineAPI } from './interface'
import __ from '../locales'
import pkg from '../../package.json'

/**
 * config cache primed before first render so that the synchronous
 * `ipcSendSync('store-get')` calls keep working without sync IPC
 */
let configCache: Record<string, unknown> = {}

/** convert plain paths sent by the Rust side into asset-protocol URLs */
function normalizeImage(image: IImageFile): IImageFile {
  return {
    ...image,
    url: image.url ? convertFileSrc(image.url) : image.url,
    sourcePreviewUrl: image.sourcePreviewUrl
      ? convertFileSrc(image.sourcePreviewUrl)
      : image.sourcePreviewUrl,
  }
}

/** menu labels localized in the renderer; the backend has no locale files */
function menuLabels(): Record<string, string> {
  return {
    about: __('about', pkg.name),
    file: __('file'),
    open: __('open'),
    save: __('save'),
    save_as: __('save_as'),
    save_new: __('save_new'),
    save_dir: __('save_dir'),
    ok: __('ok'),
    visit: __('visit'),
  }
}

type UpdateListener = (payload: IUpdateInfo) => void
const updateListeners: UpdateListener[] = []

/** electron-updater only fired on semver-greater remotes; match that */
function isNewerVersion(remote: string, local: string): boolean {
  const a = remote.split('.').map(Number)
  const b = local.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] || 0) - (b[i] || 0)
    if (d !== 0) return d > 0
  }
  return false
}

/** electron-updater is gone: a plain GitHub API version check instead */
async function checkForUpdates() {
  try {
    const repoPath = new URL(pkg.homepage).pathname
    const res = await fetch(`https://api.github.com/repos${repoPath}/releases/latest`)
    if (!res.ok) return

    const release = await res.json()
    const latest = String(release.tag_name || '').replace(/^v/, '')

    if (latest && isNewerVersion(latest, pkg.version)) {
      const info = { version: latest } as IUpdateInfo
      updateListeners.forEach((listener) => listener(info))
    }
  } catch {
    // offline or rate-limited: silently skip, same as electron-updater noop
  }
}

const logger = {
  error: (...args: unknown[]) => console.error(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  info: (...args: unknown[]) => console.info(...args),
  verbose: (...args: unknown[]) => console.debug(...args),
  debug: (...args: unknown[]) => console.debug(...args),
  silly: (...args: unknown[]) => console.debug(...args),
  log: (...args: unknown[]) => console.log(...args),
} as unknown as ImagineAPI['logger']

export function createTauriAPI(): ImagineAPI {
  const api: ImagineAPI = {
    logger,

    ipcSend(channel: string, payload?: unknown) {
      switch (channel) {
        case IpcChannel.READY:
          // labels ride along so the menu localizes at boot
          invoke('ready', { labels: menuLabels() })
          break
        case IpcChannel.FILE_ADD:
          invoke('file_add', { files: payload })
          break
        case IpcChannel.FILE_SELECT:
          invoke('file_select')
          break
        case IpcChannel.SAVE: {
          const { images, type } = payload as { images: IImageFile[], type: string }
          invoke('save', { images, saveType: type })
          break
        }
        case IpcChannel.SYNC:
          invoke('sync', {
            backendState: {
              ...(payload as Record<string, unknown>),
              labels: menuLabels(),
            },
          })
          break
        case 'store-set': {
          const { key, value } = payload as { key: string, value: unknown }
          configCache[key] = value
          invoke('store_set', { key, value })
          break
        }
        case 'about':
          invoke('about')
          break
        case 'setProgressBar':
          invoke('set_progress_bar', { progress: payload })
          break
        default:
          logger.warn(`unhandled ipcSend channel: ${channel}`)
      }
    },

    ipcSendSync(channel: string, payload?: unknown) {
      if (channel === 'store-get') {
        const { key, def } = payload as { key: string, def: unknown }
        return (configCache[key] ?? def) as never
      }
      logger.warn(`unhandled ipcSendSync channel: ${channel}`)
      return undefined as never
    },

    ipcListen(channel: string, listener: (payload: never) => void) {
      switch (channel) {
        case IpcChannel.FILE_SELECTED:
          listen<IImageFile[]>('FILE_SELECTED', (event) => {
            listener(event.payload.map(normalizeImage) as never)
          })
          break
        case IpcChannel.SAVE:
          listen('SAVE', (event) => listener(event.payload as never))
          break
        case IpcChannel.SAVED:
          listen('SAVED', (event) => listener(event.payload as never))
          break
        case IpcChannel.APP_UPDATE:
          updateListeners.push(listener as UpdateListener)
          break
        default:
          logger.warn(`unhandled ipcListen channel: ${channel}`)
      }
    },

    async optimize(request) {
      const result = await invoke<IImageFile>('optimize', {
        image: request.image,
        options: request.options,
      })
      return normalizeImage(result)
    },

    openExternal(link: string) {
      invoke('open_external', { url: link })
    },

    onFileDrop(handlers) {
      getCurrentWebview().onDragDropEvent((event) => {
        // 'over' fires continuously with the cursor position; only the
        // discrete transitions matter for the drop overlay
        if (event.payload.type === 'enter') {
          handlers.onEnter()
        } else if (event.payload.type === 'leave') {
          handlers.onLeave()
        } else if (event.payload.type === 'drop') {
          handlers.onDrop(event.payload.paths)
        }
      })
    },
  }

  return api
}

/** prime the config cache and kick off the update check before first render */
export async function initTauriBridge(): Promise<void> {
  // Tauri never fires beforeunload on window close; replay the close
  // request as a cancelable synthetic event so the alone-mode close
  // interception in Alone.tsx keeps working unchanged
  getCurrentWindow().onCloseRequested((event) => {
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    if (e.defaultPrevented) {
      event.preventDefault()
    }
  })

  configCache = (await invoke<Record<string, unknown>>('store_get_all')) || {}

  if (configCache.checkupdate !== false) {
    checkForUpdates()
  }
}
