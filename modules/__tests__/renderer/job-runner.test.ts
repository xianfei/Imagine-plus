/**
 * @jest-environment jsdom
 */
import '../_tools/before-test'

import { createStore } from '../../renderer/store/store'
import JobRunner from '../../renderer/store/job-runner'
import actions from '../../renderer/store/actionCreaters'
import { sleep } from '../../common/utils'
import {
  IImageFile, IOptimizeRequest, TaskStatus, SupportedExt,
} from '../../common/types'

jest.mock('../../bridge/web', () => ({
  imagineAPI: {
    logger: console,
    ipcSend: () => undefined,
    ipcSendSync: () => undefined,
    ipcListen: () => undefined,
    openExternal: () => undefined,
    optimize: async ({ image }: IOptimizeRequest) => {
      // simulated encode latency so PROCESSING is observable
      await sleep(150)
      return {
        ...image,
        id: `optimized-${image.id}`,
        size: Math.floor(image.size / 2),
      }
    },
  },
  bridgeReady: Promise.resolve(),
}))

const makeImage = (id: string): IImageFile => ({
  id,
  url: `${id}.png`,
  size: 1000,
  ext: SupportedExt.png,
  originalName: `${id}.png`,
})

test('optimize JobRunner', async () => {
  const images = [makeImage('01'), makeImage('02')]
  const store = createStore()
  new JobRunner().watch(store)
  let state

  store.dispatch(actions.taskAdd(images))

  // for debounce
  await sleep(100)

  state = store.getState()

  expect(state.tasks[0].status).toBe(TaskStatus.PROCESSING)

  // enough for processing two images
  await sleep(500)

  state = store.getState()
  expect(state.tasks[0].status).toBe(TaskStatus.DONE)
  expect(state.tasks[1].status).toBe(TaskStatus.DONE)
  expect(state.tasks[0].optimized?.id).toBe('optimized-01')

  await sleep(10)

  // update options and auto optimized
  store.dispatch(actions.taskUpdateOptions(images[0].id, {
    color: 8,
  }))

  // for debounce
  await sleep(100)

  state = store.getState()
  expect(state.tasks[0].status).toBe(TaskStatus.PROCESSING)
  expect(state.tasks[1].status).toBe(TaskStatus.DONE)

  await sleep(300)

  state = store.getState()
  expect(state.tasks[0].status).toBe(TaskStatus.DONE)
})
