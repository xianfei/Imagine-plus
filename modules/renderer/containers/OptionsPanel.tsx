// @ts-nocheck

import React, { PureComponent } from 'react'
import { connect } from 'react-redux'
import {
  SupportedExt,
  IOptimizeOptions,
  IDefaultOptions,
  IState,
} from '../../common/types'
import Icon from '../components/Icon'
import Collapse from '../components/Collapse'
import ImageOptions from '../components/ImageOptions'
import TargetTypeSelect from '../components/TargetTypeSelect'
import actions from '../store/actionCreaters'
import __ from '../../locales'

import './OptionsPanel.less'
import { imagineAPI } from '../../bridge/web'
import pkg from '../../../package.json'

function storeset(key: string, value: any) {
  // @ts-ignore
  imagineAPI?.ipcSend('store-set', { key, value })
}

function storeget(key: string, def: any) {
  // @ts-ignore
  const val = imagineAPI?.ipcSendSync('store-get', { key, def })
  return val
}


interface IProps {
  optionsMap: IDefaultOptions
}

interface IDispatchProps {
  onOptionsChange(ext: SupportedExt, options: IOptimizeOptions): void
  onApplyClick(): void
  onClose(): void
}

interface IOwnProps {
  onApplyClick?(): void
}

class OptionsPanel extends PureComponent<IProps & IDispatchProps> {
  onOptionsChanges = (() => {
    const createOptionsChangeHandler = (ext: SupportedExt) => (options: IOptimizeOptions) => {
      const { onOptionsChange } = this.props
      onOptionsChange(ext, options)
    }

    return {
      png: createOptionsChangeHandler(SupportedExt.png),
      jpg: createOptionsChangeHandler(SupportedExt.jpg),
      webp: createOptionsChangeHandler(SupportedExt.webp),
      avif: createOptionsChangeHandler(SupportedExt.avif),
      heic: createOptionsChangeHandler(SupportedExt.heic),
      bmp: createOptionsChangeHandler(SupportedExt.bmp),
    }
  })()

  onExtChanges = (() => {
    const createExtChangeHandler = (ext: SupportedExt) => (exportExt: SupportedExt) => {
      const { onOptionsChange, optionsMap } = this.props
      onOptionsChange(ext, {
        ...optionsMap[ext],
        exportExt,
      })
    }

    return {
      png: createExtChangeHandler(SupportedExt.png),
      jpg: createExtChangeHandler(SupportedExt.jpg),
      webp: createExtChangeHandler(SupportedExt.webp),
      avif: createExtChangeHandler(SupportedExt.avif),
      heic: createExtChangeHandler(SupportedExt.jpg),
      bmp: createExtChangeHandler(SupportedExt.jpg),
    }
  })()

  render() {
    const { optionsMap, onApplyClick, onClose } = this.props

    return (
      <div className="options">
        <div className="options-body">
          <Collapse title="PNG" initialVisible>
            <div className="collapse-row target-ext-select-row">
              <TargetTypeSelect
                className="target-ext-select"
                onChange={this.onExtChanges.png}
                sourceExt={SupportedExt.png}
                targetExt={optionsMap.png.exportExt || SupportedExt.png}
              />
            </div>
            <div className="collapse-row">
              <ImageOptions
                precision
                ext={SupportedExt.png}
                options={optionsMap.png}
                onChange={this.onOptionsChanges.png}
              />
            </div>
          </Collapse>

          <Collapse title="JPEG" initialVisible>
            <div className="collapse-row target-ext-select-row">
              <TargetTypeSelect
                className="target-ext-select"
                onChange={this.onExtChanges.jpg}
                sourceExt={SupportedExt.jpg}
                targetExt={optionsMap.jpg.exportExt || SupportedExt.jpg}
              />
            </div>
            <div className="collapse-row">
              <ImageOptions
                precision
                ext={SupportedExt.jpg}
                options={optionsMap.jpg}
                onChange={this.onOptionsChanges.jpg}
              />
            </div>
          </Collapse>

          <Collapse title="WebP" initialVisible>
            <div className="collapse-row target-ext-select-row">
              <TargetTypeSelect
                className="target-ext-select"
                onChange={this.onExtChanges.webp}
                sourceExt={SupportedExt.webp}
                targetExt={optionsMap.webp.exportExt || SupportedExt.webp}
              />
            </div>
            <div className="collapse-row">
              <ImageOptions
                precision
                ext={SupportedExt.webp}
                options={optionsMap.webp}
                onChange={this.onOptionsChanges.webp}
              />
            </div>
          </Collapse>

          <Collapse title="AVIF" initialVisible>
            <div className="collapse-row target-ext-select-row">
              <TargetTypeSelect
                className="target-ext-select"
                onChange={this.onExtChanges.avif}
                sourceExt={SupportedExt.avif}
                targetExt={optionsMap.avif.exportExt || SupportedExt.avif}
              />
            </div>
            <div className="collapse-row">
              <ImageOptions
                precision
                ext={SupportedExt.avif}
                options={optionsMap.avif}
                onChange={this.onOptionsChanges.avif}
              />
            </div>
          </Collapse>

          <Collapse title="Setting" initialVisible>
            <div className="collapse-row more-options">
              <label>
                <input type="checkbox" defaultChecked={storeget('keepmeta', true)} onChange={(e) => storeset('keepmeta', e.target.checked)} />
                <span>Keep Metadata</span>
              </label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <label>
                <input type="checkbox" defaultChecked={storeget('progressive', true)} onChange={(e) => storeset('progressive', e.target.checked)} />
                <span>Progressive (for PNG&JPEG)</span>
              </label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <label>
                <input type="checkbox" defaultChecked={storeget('checkupdate', true)} onChange={(e) => storeset('checkupdate', e.target.checked)} />
                <span>Check Update</span>
              </label>

            </div>
          </Collapse>
        </div>
        <footer className="clearfix">
          <button type="button" onClick={onApplyClick}>
            <Icon name="doneall" />
            {__('apply_now')}
          </button>
          <div className="blank" />
          <span className='title-app-version' onClick={()=>imagineAPI.ipcSend('about', 1)}>Imagine v{pkg.version}</span>

          <button type="button" onClick={onClose}>
            <Icon name="close" />
          </button>
        </footer>
      </div>
    )
  }
}

export default connect<IProps, IDispatchProps, IOwnProps, IState>(
  (state) => ({
    optionsMap: state.globals.defaultOptions,
  }),

  (dispatch, ownProps) => ({
    onOptionsChange(ext: SupportedExt, options: IOptimizeOptions) {
      dispatch(actions.defaultOptions({
        ext,
        options,
      }))
    },

    onApplyClick() {
      dispatch(actions.optionsApply())
      ownProps.onApplyClick?.()
    },

    onClose() {
      dispatch(actions.optionsVisible(false))
    },
  }),
)(OptionsPanel)
