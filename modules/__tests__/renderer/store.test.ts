/**
 * @jest-environment jsdom
 */
import '../_tools/before-test'

import { createStore } from '../../renderer/store/store'
import actions from '../../renderer/store/actionCreaters'
import { getUnsavedTaskCount } from '../../renderer/store/selectors'
import {
  IImageFile,
  TaskStatus,
  SupportedExt,
  BusyKind,
  ResizeMode,
} from '../../common/types'

const image1: IImageFile = {
  id: '01',
  url: '01.png',
  size: 100,
  ext: SupportedExt.png,
  originalName: 'file.png',
}

const image2: IImageFile = {
  id: '02',
  url: '02.jpg',
  size: 101,
  ext: SupportedExt.jpg,
  originalName: 'file.jpg',
}

test('initial state', () => {
  const store = createStore()

  expect(store.getState().tasks).toEqual([])
})

test('task add', () => {
  const store = createStore()

  store.dispatch(actions.taskAdd([image1, image2]))
  store.dispatch(actions.taskAdd([image1, image2]))

  expect(store.getState().tasks).toEqual([
    {
      id: image1.id,
      image: image1,
      options: {
        color: 128,
        exportExt: SupportedExt.png,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
    {
      id: image2.id,
      image: image2,
      options: {
        quality: 80,
        exportExt: SupportedExt.jpg,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
  ])
})

test('task delete', () => {
  const store = createStore()

  store.dispatch(actions.taskAdd([image1, image2]))
  store.dispatch(actions.taskDelete([image2.id, 'notexist']))

  expect(store.getState().tasks).toEqual([
    {
      id: image1.id,
      image: image1,
      options: {
        color: 128,
        exportExt: SupportedExt.png,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
  ])
})

test('task update options', () => {
  const store = createStore()

  store.dispatch(actions.taskAdd([image1, image2]))
  store.dispatch(actions.taskUpdateOptions(image2.id, {
    exportExt: SupportedExt.jpg,
    color: 8,
  }))
  store.dispatch(actions.taskUpdateOptions('notexist', {
    exportExt: SupportedExt.jpg,
    color: 8,
  }))

  expect(store.getState().tasks).toEqual([
    {
      id: image1.id,
      image: image1,
      options: {
        color: 128,
        exportExt: SupportedExt.png,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
    {
      id: image2.id,
      image: image2,
      options: {
        color: 8,
        exportExt: SupportedExt.jpg,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
  ])
})

test('task start', () => {
  const store = createStore()

  store.dispatch(actions.taskAdd([image1, image2]))
  store.dispatch(actions.taskOptimizeStart(image2.id))
  store.dispatch(actions.taskOptimizeStart('notexist'))

  expect(store.getState().tasks).toEqual([
    {
      id: image1.id,
      image: image1,
      options: {
        color: 128,
        exportExt: SupportedExt.png,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
    {
      id: image2.id,
      image: image2,
      options: {
        quality: 80,
        exportExt: SupportedExt.jpg,
      },
      status: TaskStatus.PROCESSING,
      saved: false,
    },
  ])
})

test('task success', () => {
  const store = createStore()

  store.dispatch(actions.taskAdd([image1, image2]))
  store.dispatch(actions.taskOptimizeSuccess(image2.id, {
    id: '03',
    url: '02.jpg',
    size: 101,
    ext: SupportedExt.jpg,
    originalName: 'file-result.jpg',
  }))
  store.dispatch(actions.taskOptimizeSuccess('notexist', {} as IImageFile))

  expect(store.getState().tasks).toEqual([
    {
      id: image1.id,
      image: image1,
      options: {
        color: 128,
        exportExt: SupportedExt.png,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
    {
      id: image2.id,
      image: image2,
      options: {
        quality: 80,
        exportExt: SupportedExt.jpg,
      },
      status: TaskStatus.DONE,
      saved: false,
      optimized: {
        id: '03',
        url: '02.jpg',
        size: 101,
        ext: 'jpg',
        originalName: 'file-result.jpg',
      },
    },
  ])

  expect(getUnsavedTaskCount(store.getState())).toBe(1)

  store.dispatch(actions.taskSaved(['03']))
  expect(store.getState().tasks[1].saved).toBe(true)
  expect(getUnsavedTaskCount(store.getState())).toBe(0)

  store.dispatch(actions.taskUpdateOptions(image2.id, {
    exportExt: SupportedExt.jpg,
    quality: 70,
  }))
  expect(store.getState().tasks[1].saved).toBe(false)
  expect(getUnsavedTaskCount(store.getState())).toBe(0)
})

test('task fail', () => {
  const store = createStore()

  store.dispatch(actions.taskAdd([image1, image2]))
  store.dispatch(actions.taskOptimizeFail(image2.id))
  store.dispatch(actions.taskOptimizeFail('notexist'))

  expect(store.getState().tasks).toEqual([
    {
      id: image1.id,
      image: image1,
      options: {
        color: 128,
        exportExt: SupportedExt.png,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
    {
      id: image2.id,
      image: image2,
      options: {
        quality: 80,
        exportExt: SupportedExt.jpg,
      },
      status: TaskStatus.FAIL,
      saved: false,
    },
  ])
})

test.each(['options', 'format', 'defaults', 'resize', 'clear resize'])(
  '%s changes invalidate the previous saved result immediately',
  (change) => {
    const store = createStore()
    store.dispatch(actions.taskAdd([image1]))
    store.dispatch(actions.taskOptimizeSuccess(image1.id, { ...image1, id: 'result' }))
    store.dispatch(actions.taskSaved(['result']))
    expect(store.getState().tasks[0].saved).toBe(true)

    switch (change) {
      case 'options':
        store.dispatch(actions.taskUpdateOptions(image1.id, { exportExt: SupportedExt.png, color: 8 }))
        break
      case 'format':
        store.dispatch(actions.taskUpdateExport(image1.id, SupportedExt.jpg))
        break
      case 'defaults':
        store.dispatch(actions.optionsApply())
        break
      case 'resize':
        store.dispatch(actions.resizeApply({ enabled: true, mode: ResizeMode.LONG_EDGE, value: 600 }))
        break
      default:
        store.dispatch(actions.resizeClear())
    }

    expect(store.getState().tasks[0]).toMatchObject({ status: TaskStatus.PENDING, saved: false })
    expect(store.getState().tasks[0].optimized).toBeUndefined()
    store.dispatch(actions.taskSaved(['result']))
    expect(store.getState().tasks[0].saved).toBe(false)
  },
)

test('globals', () => {
  const store = createStore()

  store.dispatch(actions.taskDetail('detailId'))

  expect(store.getState().globals.activeId).toBe('detailId')

  store.dispatch(actions.taskDetail(null))

  expect(store.getState().globals.activeId).toBe(null)
})

test('busy operations are counted independently and never go negative', () => {
  const store = createStore()

  store.dispatch(actions.busyChange({ kind: BusyKind.IMPORT, delta: 1 }))
  store.dispatch(actions.busyChange({ kind: BusyKind.IMPORT, delta: 1 }))
  store.dispatch(actions.busyChange({ kind: BusyKind.SAVE, delta: 1 }))
  store.dispatch(actions.busyChange({ kind: BusyKind.IMPORT, delta: -1 }))

  expect(store.getState().globals.busy).toEqual({
    [BusyKind.IMPORT]: 1,
    [BusyKind.SAVE]: 1,
  })

  store.dispatch(actions.busyChange({ kind: BusyKind.IMPORT, delta: -1 }))
  store.dispatch(actions.busyChange({ kind: BusyKind.IMPORT, delta: -1 }))
  store.dispatch(actions.busyChange({ kind: BusyKind.SAVE, delta: -1 }))

  expect(store.getState().globals.busy).toEqual({
    [BusyKind.IMPORT]: 0,
    [BusyKind.SAVE]: 0,
  })
})

test('set globalOptions', () => {
  const store = createStore()

  store.dispatch(actions.defaultOptions({
    ext: SupportedExt.png,
    options: {
      color: 8,
      exportExt: SupportedExt.png,
    },
  }))

  store.dispatch(actions.defaultOptions({
    ext: SupportedExt.jpg,
    options: {
      quality: 60,
      exportExt: SupportedExt.jpg,
    },
  }))

  expect(store.getState().globals.defaultOptions).toEqual({
    png: {
      color: 8,
      exportExt: SupportedExt.png,
    },

    jpg: {
      quality: 60,
      exportExt: SupportedExt.jpg,
    },

    webp: {
      quality: 80,
      exportExt: SupportedExt.webp,
    },

    avif: {
      quality: 50,
      exportExt: SupportedExt.avif,
    },

    heic: {
      quality: 80,
      exportExt: SupportedExt.jpg,
    },

    bmp: {
      quality: 80,
      exportExt: SupportedExt.jpg,
    },
  })

  store.dispatch(actions.taskAdd([image1, image2]))

  expect(store.getState().tasks).toEqual([
    {
      id: image1.id,
      image: image1,
      options: {
        color: 8,
        exportExt: SupportedExt.png,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
    {
      id: image2.id,
      image: image2,
      options: {
        quality: 60,
        exportExt: SupportedExt.jpg,
      },
      status: TaskStatus.PENDING,
      saved: false,
    },
  ])
})
