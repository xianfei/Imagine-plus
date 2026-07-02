import type { ElectronLog } from 'electron-log'
import {
  AsyncCall, IImageFile, IOptimizeRequest, MainIpcPayload, RendererIpcPayload,
} from '../common/types'

export interface IFileDropHandlers {
  onEnter(): void
  onLeave(): void
  onDrop(paths: string[]): void
}

export interface ImagineAPI {
  logger: ElectronLog
  ipcSend<T extends keyof RendererIpcPayload>(channel: T, payload: RendererIpcPayload[T]): void,
  ipcSendSync<T extends keyof RendererIpcPayload>(channel: T, payload: RendererIpcPayload[T]): RendererIpcPayload[T]
  ipcListen<T extends keyof MainIpcPayload>(channel: T, listener: (payload: MainIpcPayload[T]) => void): void
  optimize: AsyncCall<IOptimizeRequest, IImageFile>
  openExternal(link: string): void;

  /**
   * native file drag-drop with absolute paths; implemented by the Tauri
   * bridge (webviews expose no File.path), absent in Electron where the
   * HTML5 drop handler still works
   */
  onFileDrop?(handlers: IFileDropHandlers): void

  /**
   * custom window buttons; only present where the platform offers no
   * native overlay controls (Tauri on Windows)
   */
  windowControls?: {
    minimize(): void
    toggleMaximize(): void
    close(): void
  }
}
