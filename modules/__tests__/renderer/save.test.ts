/**
 * @jest-environment jsdom
 */
import store from '../../renderer/store/store'
import actions from '../../renderer/store/actionCreaters'
import { fileSave, fileSaveAll, takePartialSaveAll } from '../../renderer/apis'
import { imagineAPI } from '../../bridge/web'
import listenIpc from '../../renderer/ipc/listen'
import {
  IImageFile, IpcChannel, SaveType, SupportedExt,
} from '../../common/types'

jest.mock('../../bridge/web', () => ({
  imagineAPI: {
    logger: { error: jest.fn() },
    ipcSend: jest.fn(),
    ipcListen: jest.fn(),
  },
}))

jest.mock('../../renderer/components/Messager', () => ({ showMessage: jest.fn() }))
jest.mock('../../locales', () => ({ __esModule: true, default: (key: string) => key }))

const makeResult = (id: string): IImageFile => ({
  id: `result-${id}`,
  url: `${id}.png`,
  ext: SupportedExt.png,
  size: 500,
  originalName: `${id}.png`,
})

beforeEach(() => {
  store.dispatch(actions.taskClear())
  takePartialSaveAll()
  jest.clearAllMocks()
  const images = ['done', 'pending', 'processing', 'failed'].map((id) => ({ ...makeResult(id), id }))
  store.dispatch(actions.taskAdd(images))
  for (const image of images) store.dispatch(actions.taskOptimizeSuccess(image.id, makeResult(image.id)))
  store.dispatch(actions.taskUpdateExport('pending', SupportedExt.jpg))
  store.dispatch(actions.taskOptimizeStart('processing'))
  store.dispatch(actions.taskOptimizeFail('failed'))
})

test('save all sends only completed current results and reports running tasks', () => {
  fileSaveAll(SaveType.OVER)
  expect(imagineAPI.ipcSend).toHaveBeenCalledWith(IpcChannel.SAVE, {
    images: [makeResult('done')], type: SaveType.OVER,
  })
  expect(takePartialSaveAll()).toEqual({ savedCount: 1, runningCount: 2 })
})

test('individual saves reject stale results, including a stale React callback', () => {
  const result = makeResult('done')
  fileSave([result], SaveType.SAVE_AS)
  expect(imagineAPI.ipcSend).toHaveBeenCalledTimes(1)

  store.dispatch(actions.taskUpdateExport('done', SupportedExt.jpg))
  fileSave([result, makeResult('pending'), makeResult('processing'), makeResult('failed')], SaveType.OVER)
  expect(imagineAPI.ipcSend).toHaveBeenCalledTimes(1)
})

test('save all does nothing if no current result is ready', () => {
  store.dispatch(actions.taskUpdateExport('done', SupportedExt.jpg))
  fileSaveAll(SaveType.OVER)
  expect(imagineAPI.ipcSend).not.toHaveBeenCalled()
})

test('saving an unfinished image in detail view does not save other images', () => {
  listenIpc()
  const ipcListen = imagineAPI.ipcListen as jest.Mock
  const saveListener = ipcListen.mock.calls.find(([channel]) => channel === IpcChannel.SAVE)?.[1]
  expect(saveListener).toBeDefined()
  store.dispatch(actions.taskDetail('pending'))
  saveListener(SaveType.OVER)
  expect(imagineAPI.ipcSend).not.toHaveBeenCalled()

  store.dispatch(actions.taskDetail('done'))
  saveListener(SaveType.OVER)
  expect(imagineAPI.ipcSend).toHaveBeenCalledWith(IpcChannel.SAVE, {
    images: [makeResult('done')], type: SaveType.OVER,
  })
})
