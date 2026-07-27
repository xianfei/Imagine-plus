import React, { useCallback, useState, useEffect } from 'react'
import { connect } from 'react-redux'
import classnames from 'classnames'
import Icon from '../components/Icon'
import Popper from '../components/Popper'
import Tooltip from '../components/Tooltip'
import WindowControls from '../components/WindowControls'
import ProgressRing from '../components/ProgressRing'
import ResizePanel from './ResizePanel'
import actions from '../store/actionCreaters'
import {
  SaveType, IUpdateInfo, IState, TaskStatus,
} from '../../common/types'
import * as apis from '../apis'
import __ from '../../locales'
import pkg from '../../../package.json'
import { isTaskSizeIncreased } from '../../common/task'

import './ActionBar.less'
import { imagineAPI } from '../../bridge/web'

interface IActionBarStateProps {
  count: number
  sizeIncreaseCount: number
  runningCount: number
  savableCount: number
  updateInfo: IUpdateInfo | undefined
  optionsVisible: boolean
  resizeEnabled: boolean
}

interface IActionBarDispatchProps {
  onRemoveAll(): void
  onRemoveIncreased(): void
  onSave(type: SaveType): void
  onAdd(): void
  onUpdateClick(): void
  onOptionsVisibleToggle(visible: boolean): void
}

function ActionBar({
  count,
  sizeIncreaseCount,
  runningCount,
  savableCount,
  updateInfo,
  optionsVisible,
  resizeEnabled,
  onAdd,
  onSave,
  onRemoveAll,
  onRemoveIncreased,
  onUpdateClick,
  onOptionsVisibleToggle,
}: IActionBarStateProps & IActionBarDispatchProps) {
  const [savePopperVisible, setSavePopperVisible] = useState(false)
  const [clearPopperVisible, setClearPopperVisible] = useState(false)
  const [resizePanelVisible, setResizePanelVisible] = useState(false)
  // save type waiting for confirmation while tasks are still running
  const [pendingSaveType, setPendingSaveType] = useState<SaveType | null>(null)

  const handleOptionsVisibleClick = () => {
    onOptionsVisibleToggle(!optionsVisible)
  }

  const handleResizePanelClose = useCallback(() => {
    setResizePanelVisible(false)
  }, [])

  const handleSaveButtonClick = () => {
    setSavePopperVisible(!savePopperVisible)
    setClearPopperVisible(false)
    setPendingSaveType(null)
  }

  const handleClearButtonClick = () => {
    setClearPopperVisible(!clearPopperVisible)
    setSavePopperVisible(false)
  }

  const handleSavePopperHide = () => {
    setSavePopperVisible(false)
  }

  const handleClearPopperHide = () => {
    setClearPopperVisible(false)
  }

  const handleSaveAction = (type: SaveType) => {
    // some tasks are not optimized yet, ask before saving a partial result
    if (runningCount) {
      setPendingSaveType(type)
      return
    }
    onSave(type)
    setSavePopperVisible(false)
  }

  const handleSaveConfirm = () => {
    if (pendingSaveType !== null) onSave(pendingSaveType)
    setPendingSaveType(null)
    setSavePopperVisible(false)
  }

  const handleSaveCancel = () => {
    setPendingSaveType(null)
    setSavePopperVisible(false)
  }

  const handleClearAction = (action: () => void) => {
    action()
    setClearPopperVisible(false)
  }

  // 点击外部关闭弹出菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.popper') && !target.closest('.expand-button')) {
        setSavePopperVisible(false)
        setClearPopperVisible(false)
        setPendingSaveType(null)
      }
    }

    if (savePopperVisible || clearPopperVisible) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [savePopperVisible, clearPopperVisible])

  return (
    <div data-tauri-drag-region="deep" className="action-bar" style={{ paddingLeft: navigator.platform.startsWith('Mac') ? '78px' : '0', paddingRight: navigator.platform.startsWith('Win') ? '150px' : '10px' }}>

      <Tooltip title={__('add')} placement="bottom">
        <button type="button" onClick={onAdd}>
          <Icon name="add" />
        </button>
      </Tooltip>

      <Popper
        visible={savePopperVisible}
        className="actionbar-popper"
        popper={(
          pendingSaveType !== null ? (
            <div className="popper-menu save-confirm">
              <p className="save-confirm-text">
                {__('save_all_processing', runningCount, savableCount)}
              </p>
              <button type="button" onClick={handleSaveConfirm} disabled={!savableCount}>
                {__('save_anyway')}
              </button>
              <button type="button" onClick={handleSaveCancel}>
                {__('cancel')}
              </button>
            </div>
          ) : (
            <div className="popper-menu">
              <button type="button" onClick={() => handleSaveAction(SaveType.OVER)}>
                {__('save_cover')}
              </button>
              <button type="button" onClick={() => handleSaveAction(SaveType.NEW_NAME)}>
                {__('save_new')}
              </button>
              <button type="button" onClick={() => handleSaveAction(SaveType.NEW_DIR)}>
                {__('save_dir')}
              </button>
            </div>
          )
        )}
      >
        <Tooltip title={__('save')} placement="bottom">
          <button
            type="button"
            disabled={!count}
            onClick={handleSaveButtonClick}
          >
            <div>
              <Icon name="save" />
            </div>
          </button>
        </Tooltip>
      </Popper>

      <Popper
        visible={clearPopperVisible}
        className="actionbar-popper"
        popper={(
          <div className="popper-menu">
            <button type="button" onClick={() => handleClearAction(onRemoveAll)}>
              {__('clear')}
            </button>
            <button type="button" onClick={() => handleClearAction(onRemoveIncreased)} disabled={!sizeIncreaseCount}>
              {__('clear_increased')}
              {' ('}
              {sizeIncreaseCount}
              )
            </button>
          </div>
        )}
      >
        <Tooltip title={__('clear')} placement="bottom">
          <button
            type="button"
            disabled={!count}
            onClick={handleClearButtonClick}
          >
            <div>
              <Icon name="delete" />
            </div>
            {sizeIncreaseCount ? <i className="dot" /> : null}
          </button>
        </Tooltip>
      </Popper>
      {
        updateInfo ? (
          <Tooltip title={__('new_version')} placement="bottom">
            <button type="button" onClick={onUpdateClick} className="has-update">
              <Icon name="up" />
            </button>
          </Tooltip>
        ) : null
      }

      {/* the bar root uses data-tauri-drag-region="deep": the whole
          subtree drags, clickable elements are excluded automatically */}
      <span className="title-app-name">Imagine Plus</span>

      {
        runningCount ? (
          <Tooltip title={__('processing_progress', count - runningCount, count)} placement="bottom">
            <div className="task-progress">
              <ProgressRing progress={count ? (count - runningCount) / count : 0} />
              <span className="task-progress-text">
                {count - runningCount}
                /
                {count}
              </span>
            </div>
          </Tooltip>
        ) : null
      }

      {/* <span className='title-app-version' onClick={()=>imagineAPI.ipcSend('about', 1)}>v{pkg.version}</span> */}

      <div className="blank" />

      <Popper
        className="options-popper actionbar-popper"
        visible={resizePanelVisible}
        popper={(
          <ResizePanel onClose={handleResizePanelClose} />
        )}
      >
        <Tooltip title={__('resize')} placement="bottom">
          <button
            type="button"
            className={classnames({ '-active': resizeEnabled })}
            onClick={() => setResizePanelVisible(!resizePanelVisible)}
          >
            <Icon name="resize" />
          </button>
        </Tooltip>
      </Popper>

      <Tooltip title={__('settings')} placement="bottom">
        <button
          type="button"
          className={classnames({
            '-active': optionsVisible,
          })}
          onClick={handleOptionsVisibleClick}
        >
          <Icon name="tune" />
        </button>
      </Tooltip>

      <WindowControls />
    </div>
  )
}

export default connect<IActionBarStateProps, IActionBarDispatchProps, Record<string, never>, IState>((state) => ({
  count: state.tasks.length,
  updateInfo: state.globals.updateInfo,
  optionsVisible: state.globals.optionsVisible,
  resizeEnabled: state.globals.resizeOptions.enabled,
  sizeIncreaseCount: state.tasks.reduce(
    (count, item) => (count + (isTaskSizeIncreased(item) ? 1 : 0)),
    0,
  ),
  savableCount: state.tasks.reduce(
    (count, item) => (count + (item.optimized ? 1 : 0)),
    0,
  ),
  runningCount: state.tasks.reduce(
    (count, item) => (count + (
      item.status === TaskStatus.PENDING || item.status === TaskStatus.PROCESSING ? 1 : 0
    )),
    0,
  ),
}), (dispatch) => ({
  onRemoveAll() {
    dispatch(actions.taskClear())
  },

  onRemoveIncreased() {
    dispatch(actions.taskClearIncreased())
  },

  onOptionsVisibleToggle(visible: boolean) {
    dispatch(actions.optionsVisible(visible))
  },

  onAdd() {
    apis.fileSelect()
  },

  onSave(type: SaveType) {
    apis.fileSaveAll(type)
  },

  onUpdateClick() {
    imagineAPI.openExternal(`${pkg.homepage}/releases`)
  },
}))(ActionBar)
