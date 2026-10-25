/**
 * @jest-environment jsdom
 */
import { createStore } from '../../renderer/store/store'
import JobRunner from '../../renderer/store/job-runner'
import actions from '../../renderer/store/actionCreaters'
import { saveSettings } from '../../renderer/store/storage'
import { imagineAPI } from '../../bridge/web'
import {
  IImageFile, IOptimizeRequest, TaskStatus, SupportedExt, ResizeMode,
} from '../../common/types'

jest.mock('../../bridge/web', () => ({
  imagineAPI: {
    logger: { error: jest.fn() },
    ipcSend: jest.fn(),
    optimize: jest.fn(),
  },
}))

interface PendingEncode {
  request: IOptimizeRequest
  resolve(result: IImageFile): void
  reject(error: Error): void
}

let encodes: PendingEncode[]
const optimize = imagineAPI.optimize as jest.MockedFunction<typeof imagineAPI.optimize>

const makeImage = (id: string): IImageFile => ({
  id,
  url: `${id}.png`,
  size: 1000,
  ext: SupportedExt.png,
  originalName: `${id}.png`,
})

const finish = async (encode: PendingEncode) => {
  const { image, options } = encode.request
  encode.resolve({
    ...image,
    id: `optimized-${image.id}-${JSON.stringify(options)}`,
    ext: options.exportExt || image.ext,
    size: 500,
  })
  await Promise.resolve()
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  localStorage.clear()
  saveSettings({ concurrency: 2 })
  encodes = []
  optimize.mockImplementation((request) => new Promise((resolve, reject) => {
    encodes.push({ request, resolve, reject })
  }))
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  localStorage.clear()
})

test('all 15 PNGs become JPGs when the format changes with 7 PNG encodes still running', async () => {
  saveSettings({ concurrency: 15 })
  const store = createStore()
  new JobRunner().watch(store)
  store.dispatch(actions.taskAdd(Array.from({ length: 15 }, (_, index) => makeImage(String(index)))))
  jest.advanceTimersByTime(1500)
  expect(encodes).toHaveLength(15)
  const pngEncodes = [...encodes]
  for (const encode of pngEncodes.slice(0, 8)) await finish(encode)

  store.dispatch(actions.defaultOptions({
    ext: SupportedExt.png,
    options: { exportExt: SupportedExt.jpg, quality: 80 },
  }))
  store.dispatch(actions.optionsApply())
  expect(store.getState().tasks.every((task) => !task.optimized)).toBe(true)

  // Available workers may start completed images again, but must not
  // duplicate the seven PNG encodes that are still using the cache.
  jest.advanceTimersByTime(800)
  expect(encodes.slice(15).every((encode) => Number(encode.request.image.id) < 8)).toBe(true)
  for (const encode of pngEncodes.slice(8)) await finish(encode)
  jest.advanceTimersByTime(1500)

  const jpgEncodes = encodes.slice(15)
  expect(jpgEncodes).toHaveLength(15)
  for (const encode of jpgEncodes) {
    expect(encode.request.options.exportExt).toBe(SupportedExt.jpg)
    await finish(encode)
  }
  expect(store.getState().tasks.every((task) => (
    task.status === TaskStatus.DONE && task.optimized?.ext === SupportedExt.jpg
  ))).toBe(true)
})

test.each(['quality', 'colors', 'resize', 'format changed back'])(
  'discards an encode after %s changes even when the output format is unchanged',
  async (change) => {
    const store = createStore()
    new JobRunner().watch(store)
    store.dispatch(actions.taskAdd([makeImage('01')]))
    if (change === 'quality') store.dispatch(actions.taskUpdateExport('01', SupportedExt.jpg))
    jest.advanceTimersByTime(100)

    if (change === 'quality') {
      store.dispatch(actions.taskUpdateOptions('01', { exportExt: SupportedExt.jpg, quality: 60 }))
    } else if (change === 'colors') {
      store.dispatch(actions.taskUpdateOptions('01', { exportExt: SupportedExt.png, color: 8 }))
    } else if (change === 'resize') {
      store.dispatch(actions.resizeApply({ enabled: true, mode: ResizeMode.LONG_EDGE, value: 600 }))
    } else {
      store.dispatch(actions.taskUpdateExport('01', SupportedExt.jpg))
      store.dispatch(actions.taskUpdateExport('01', SupportedExt.png))
    }
    jest.advanceTimersByTime(300)
    expect(encodes).toHaveLength(1)
    await finish(encodes[0])
    expect(encodes).toHaveLength(2)
    expect(store.getState().tasks[0].optimized).toBeUndefined()
    expect(store.getState().tasks[0].status).toBe(TaskStatus.PROCESSING)

    await finish(encodes[1])
    expect(store.getState().tasks[0].status).toBe(TaskStatus.DONE)
  },
)

test('ignores an obsolete failure and retries using the latest settings', async () => {
  const store = createStore()
  new JobRunner().watch(store)
  store.dispatch(actions.taskAdd([makeImage('01')]))
  jest.advanceTimersByTime(100)
  store.dispatch(actions.taskUpdateExport('01', SupportedExt.jpg))

  encodes[0].reject(new Error('old PNG encode failed'))
  await Promise.resolve()
  expect(encodes).toHaveLength(2)
  expect(store.getState().tasks[0].status).toBe(TaskStatus.PROCESSING)
  expect(encodes[1].request.options.exportExt).toBe(SupportedExt.jpg)
  await finish(encodes[1])
  expect(store.getState().tasks[0].optimized?.ext).toBe(SupportedExt.jpg)
})

test('a deleted and reimported image cannot receive a previous task result', async () => {
  const store = createStore()
  new JobRunner().watch(store)
  const image = makeImage('01')
  store.dispatch(actions.taskAdd([image]))
  jest.advanceTimersByTime(100)
  store.dispatch(actions.taskClear())
  store.dispatch(actions.taskAdd([image]))
  jest.advanceTimersByTime(300)
  expect(encodes).toHaveLength(1)

  await finish(encodes[0])
  expect(store.getState().tasks[0].optimized).toBeUndefined()
  expect(encodes).toHaveLength(2)
  await finish(encodes[1])
  expect(store.getState().tasks[0].status).toBe(TaskStatus.DONE)
})

test('a current failure is reported and can be retried', async () => {
  const store = createStore()
  new JobRunner().watch(store)
  store.dispatch(actions.taskAdd([makeImage('01')]))
  jest.advanceTimersByTime(100)
  encodes[0].reject(new Error('encode failed'))
  await Promise.resolve()
  expect(store.getState().tasks[0].status).toBe(TaskStatus.FAIL)

  store.dispatch(actions.taskUpdateOptions('01', store.getState().tasks[0].options))
  jest.advanceTimersByTime(100)
  await finish(encodes[1])
  expect(store.getState().tasks[0].status).toBe(TaskStatus.DONE)
})
