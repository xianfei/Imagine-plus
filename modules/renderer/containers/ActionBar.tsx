// @ts-nocheck
import React, { useCallback, useState, useEffect } from 'react'
import { connect } from 'react-redux'
import classnames from 'classnames'
import Icon from '../components/Icon'
import Popper from '../components/Popper'
import Tooltip from '../components/Tooltip'
import OptionsPanel from './OptionsPanel'
import actions from '../store/actionCreaters'
import { SaveType, IUpdateInfo, IState } from '../../common/types'
import * as apis from '../apis'
import __ from '../../locales'
import pkg from '../../../package.json'
import { isTaskSizeIncreased } from '../../common/task'

import './ActionBar.less'
import { imagineAPI } from '../../bridge/web'

interface IActionBarStateProps {
  count: number
  sizeIncreaseCount: number
  updateInfo: IUpdateInfo | undefined
  optionsVisible: boolean
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
  updateInfo,
  optionsVisible,
  onAdd,
  onSave,
  onRemoveAll,
  onRemoveIncreased,
  onUpdateClick,
  onOptionsVisibleToggle,
}: IActionBarStateProps & IActionBarDispatchProps) {
  const [savePopperVisible, setSavePopperVisible] = useState(false)
  const [clearPopperVisible, setClearPopperVisible] = useState(false)

  const handleOptionsVisibleClick = () => {
    onOptionsVisibleToggle(!optionsVisible)
  }

  const handleOptionsHide = useCallback(() => {
    onOptionsVisibleToggle(false)
  }, [onOptionsVisibleToggle])

  const handleSaveButtonClick = () => {
    setSavePopperVisible(!savePopperVisible)
    setClearPopperVisible(false)
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
    onSave(type)
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
    <div className="action-bar" style={{ paddingLeft: navigator.platform.startsWith('Mac') ? "78px" : "0", paddingRight: navigator.platform.startsWith('Win') ? "150px" : "10px" }}>


      <Tooltip title={__('add')} placement="bottom">
        <button type="button" onClick={onAdd}>
          <Icon name="add" />
        </button>
      </Tooltip>

      <Popper
        visible={savePopperVisible}
        className='actionbar-popper'
        popper={(
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
        className='actionbar-popper'
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

      <span className='title-app-name'>Imagine</span>

      {/* <span className='title-app-version' onClick={()=>imagineAPI.ipcSend('about', 1)}>v{pkg.version}</span> */}

      <div className="blank" />

      <Popper
        className="options-popper actionbar-popper"
        visible={optionsVisible}
        popper={(
          <OptionsPanel onApplyClick={handleOptionsHide} />
        )}
      >
        <Tooltip title="Settings" placement="bottom">
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
      </Popper>
    </div>
  )
}

export default connect<IActionBarStateProps, IActionBarDispatchProps, Record<string, never>, IState>((state) => ({
  count: state.tasks.length,
  updateInfo: state.globals.updateInfo,
  optionsVisible: state.globals.optionsVisible,
  sizeIncreaseCount: state.tasks.reduce(
    (count, item) => (count + (isTaskSizeIncreased(item) ? 1 : 0)),
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
