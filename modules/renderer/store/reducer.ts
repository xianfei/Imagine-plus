import { Reducer } from 'redux'
import { handleActions, Action } from 'redux-actions'
import * as storage from './storage'
import {
  IImageFile,
  IOptimizeOptions,
  ITaskItem,
  TaskStatus,
  IUpdateInfo,
  SupportedExt,
  IState,
  IGlobals,
  IDefaultOptions,
} from '../../common/types'
import {
  ACTIONS,
  IDefaultOptionsPayload,
} from './actions'
import { isTaskSizeIncreased } from '../../common/task'

type Tasks = ITaskItem[]

export const createOptimizeOptions = (ext: SupportedExt) => {
  const optimizeOptions: IOptimizeOptions = {
    exportExt: ext,
  }

  switch (ext) {
    case SupportedExt.jpg:
    case SupportedExt.webp:
      Object.assign(optimizeOptions, {
        quality: 80,
      })
      break

    case SupportedExt.avif:
      Object.assign(optimizeOptions, {
        quality: 50,
      })
      break

    case SupportedExt.png:
      Object.assign(optimizeOptions, {
        color: 128,
      })
      break

    case SupportedExt.heic:
      Object.assign(optimizeOptions, {
        exportExt: SupportedExt.jpg,
        quality: 80,
      })
      break

      case SupportedExt.bmp:
        Object.assign(optimizeOptions, {
          exportExt: SupportedExt.jpg,
          quality: 80,
        })
        break

    default:
  }

  return optimizeOptions
}

const savedOptions = storage.getOptions()

function updateTaskList(state: IState, updater: (task: Tasks) => Tasks): IState {
  return {
    ...state,
    tasks: updater(state.tasks),
  }
}

function updateTaskItem(state: IState, id: string, partial: Partial<ITaskItem>): IState {
  return updateTaskList(state, (tasks) => {
    const index = tasks.findIndex((task) => task.id === id)
    if (index === -1) return tasks
    return [
      ...tasks.slice(0, index),
      {
        ...tasks[index],
        ...partial,
      },
      ...tasks.slice(index + 1),
    ]
  })
}

function updateGlobals(state: IState, updater: (globals: IGlobals) => IGlobals): IState {
  return {
    ...state,
    globals: updater(state.globals),
  }
}

function updateGlobalsPartial(state: IState, updater: Partial<IGlobals>): IState {
  return updateGlobals(state, (globals) => ({
    ...globals,
    ...updater,
  }))
}

function getInitialTaskOptions(exportExt: SupportedExt, defaultOptions: IDefaultOptions) {
  return {
    ...(defaultOptions[exportExt] || createOptimizeOptions(exportExt)),
    exportExt,
  }
}

export default handleActions<IState, any>({
  [ACTIONS.TASK_ADD](state, action: Action<IImageFile[]>) {
    const { defaultOptions } = state.globals

    return updateTaskList(state, (tasks) => [
      ...tasks,
      ...action.payload
        .filter((image) => !tasks.some((task) => task.id === image.id))
        .map<ITaskItem>((image) => {
        const exportExt = defaultOptions[image.ext]?.exportExt || image.ext

        return {
          id: image.id,
          image,
          options: getInitialTaskOptions(exportExt, defaultOptions),
          status: TaskStatus.PENDING,
        }
      }),
    ])
  },

  [ACTIONS.TASK_DELETE](state, action: Action<string[]>) {
    return updateTaskList(state, (tasks) => tasks.filter((task) => !action.payload.some((id) => id === task.id)))
  },

  [ACTIONS.TASK_CLEAR](state) {
    return updateTaskList(state, () => [])
  },

  [ACTIONS.TASK_CLEAR_INCREASED](state) {
    return updateTaskList(state, (tasks) => tasks.filter((task) => !isTaskSizeIncreased(task)))
  },

  [ACTIONS.TASK_UPDATE_OPTIONS](state, action: Action<{ id: string, options: IOptimizeOptions }>) {
    const { id, options } = action.payload

    return updateTaskItem(state, id, {
      options,
      status: TaskStatus.PENDING,
    })
  },

  [ACTIONS.TASK_UPDATE_EXPORT](state, action: Action<{ id: string, exportExt: SupportedExt }>) {
    const { id, exportExt } = action.payload
    const { defaultOptions } = state.globals

    return updateTaskItem(state, id, {
      options: getInitialTaskOptions(exportExt, defaultOptions),
      status: TaskStatus.PENDING,
    })
  },

  [ACTIONS.TASK_OPTIMIZE_START](state, action: Action<string>) {
    const id = action.payload
    return updateTaskItem(state, id, {
      status: TaskStatus.PROCESSING,
    })
  },

  [ACTIONS.TASK_OPTIMIZE_SUCCESS](state, action: Action<{ id: string, optimized: IImageFile }>) {
    const { id, optimized } = action.payload
    return updateTaskItem(state, id, {
      optimized,
      status: TaskStatus.DONE,
    })
  },

  [ACTIONS.TASK_OPTIMIZE_FAIL](state, action: Action<string>) {
    const id = action.payload
    return updateTaskItem(state, id, {
      status: TaskStatus.FAIL,
    })
  },

  [ACTIONS.OPTIONS_APPLY](state) {
    const { defaultOptions } = state.globals

    return updateTaskList(state, (list) => list.map((item) => {
      const extOptions = defaultOptions[item.image.ext]
      const exportExt = extOptions?.exportExt ?? item.image.ext
      return {
        ...item,
        options: getInitialTaskOptions(exportExt, defaultOptions),
        status: TaskStatus.PENDING,
      }
    }))
  },

  [ACTIONS.TASK_SELECTED_ID_UPDATE](state, action: Action<string>) {
    return updateGlobalsPartial(state, {
      activeId: action.payload,
    })
  },

  [ACTIONS.APP_UPDATABLE](state, action: Action<IUpdateInfo>) {
    return updateGlobalsPartial(state, {
      updateInfo: action.payload,
    })
  },

  [ACTIONS.OPTIONS_VISIBLE_UPDATE](state, action: Action<boolean>) {
    return updateGlobalsPartial(state, {
      optionsVisible: action.payload,
    })
  },

  [ACTIONS.DEFAULT_OPTIONS_UPDATE](state, action: Action<IDefaultOptionsPayload>) {
    const { ext, options } = action.payload
    const defaultOptions = {
      ...state.globals.defaultOptions,
      [ext]: options,
    }

    /**
     * save to localStorage
     */
    storage.saveOptions({ defaultOptions })

    return updateGlobalsPartial(state, {
      defaultOptions,
    })
  },
}, {
  tasks: [],
  globals: {
    optionsVisible: false,
    defaultOptions: {
      png: createOptimizeOptions(SupportedExt.png),
      jpg: createOptimizeOptions(SupportedExt.jpg),
      webp: createOptimizeOptions(SupportedExt.webp),
      avif: createOptimizeOptions(SupportedExt.avif),
      heic: createOptimizeOptions(SupportedExt.heic),
      bmp: createOptimizeOptions(SupportedExt.bmp),
      ...(savedOptions?.defaultOptions || {}),
    },
    ...(savedOptions ? { ...savedOptions, defaultOptions: undefined } : {}),
  },
}) as Reducer<IState, any>
