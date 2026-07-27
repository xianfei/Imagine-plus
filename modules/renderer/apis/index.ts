import store from '../store/store'
import {
  IpcChannel,
  IImageFile,
  SaveType,
  ITaskItem,
  TaskStatus,
} from '../../common/types'
import { cleanupArray } from '../../common/utils'
import { imagineAPI } from '../../bridge/web'

export const fileAdd = (files: string[]) => imagineAPI.ipcSend(IpcChannel.FILE_ADD, files)

export const fileSelect = () => imagineAPI.ipcSend(IpcChannel.FILE_SELECT, null)

/**
 * set when a "save all" runs while some tasks are still being optimized,
 * so the user can be told the saved result is partial
 */
let partialSaveAll: { savedCount: number, runningCount: number } | null = null

export const takePartialSaveAll = () => {
  const info = partialSaveAll
  partialSaveAll = null
  return info
}

export const fileSave = (images: IImageFile[], type: SaveType) => {
  partialSaveAll = null
  return imagineAPI.ipcSend(IpcChannel.SAVE, { images, type })
}

export const fileSaveAll = (type: SaveType) => {
  const { tasks } = store.getState()

  const images = cleanupArray(
    tasks.map((task: ITaskItem) => task.optimized),
  )
  if (!images.length) return

  const runningCount = tasks.filter((task: ITaskItem) => (
    task.status === TaskStatus.PENDING || task.status === TaskStatus.PROCESSING
  )).length

  fileSave(images, type)

  if (runningCount) {
    partialSaveAll = { savedCount: images.length, runningCount }
  }
}
