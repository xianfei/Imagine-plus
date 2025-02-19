import type { ElectronLog } from 'electron-log'
import {
  AsyncCall, IImageFile, IOptimizeRequest, MainIpcPayload, RendererIpcPayload,
} from '../common/types'

export interface ImagineAPI {
  logger: ElectronLog
  ipcSend<T extends keyof RendererIpcPayload>(channel: T, payload: RendererIpcPayload[T]): void,
  ipcSendSync<T extends keyof RendererIpcPayload>(channel: T, payload: RendererIpcPayload[T]): RendererIpcPayload[T]
  ipcListen<T extends keyof MainIpcPayload>(channel: T, listener: (payload: MainIpcPayload[T]) => void): void
  optimize: AsyncCall<IOptimizeRequest, IImageFile>
  openExternal(link: string): void;
}
