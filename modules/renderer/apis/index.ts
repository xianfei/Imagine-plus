import store from '../store/store'
import {
  IpcChannel,
  IImageFile,
  SaveType,
  ITaskItem,
  TaskStatus,
} from '../../common/types'
import { isTaskSavable } from '../../common/task'
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
  // Also validate individual/menu saves against the live store: the caller
  // can still hold a result from before the most recent settings change.
  const savableIds = new Set(store.getState().tasks.filter(isTaskSavable).map((task) => task.optimized.id))
  const currentImages = images.filter((image) => savableIds.has(image.id))
  if (!currentImages.length) return
  imagineAPI.ipcSend(IpcChannel.SAVE, { images: currentImages, type })
}

export const fileSaveAll = (type: SaveType) => {
  const { tasks } = store.getState()

  const images = tasks.filter(isTaskSavable).map((task) => task.optimized)
  if (!images.length) return

  const runningCount = tasks.filter((task: ITaskItem) => (
    task.status === TaskStatus.PENDING || task.status === TaskStatus.PROCESSING
  )).length

  fileSave(images, type)

  if (runningCount) {
    partialSaveAll = { savedCount: images.length, runningCount }
  }
}
