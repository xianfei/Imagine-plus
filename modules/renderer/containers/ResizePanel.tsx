// @ts-nocheck
import React, { useState } from 'react'
import { connect } from 'react-redux'
import { IResizeOptions, ResizeMode, IState } from '../../common/types'
import Icon from '../components/Icon'
import actions from '../store/actionCreaters'
import __ from '../../locales'

import './ResizePanel.less'

const MODE_DEFAULTS: Record<ResizeMode, number> = {
  [ResizeMode.LONG_EDGE]: 1920,
  [ResizeMode.SHORT_EDGE]: 1080,
  [ResizeMode.SCALE]: 50,
}

interface IProps {
  resizeOptions: IResizeOptions
  onApply(opts: IResizeOptions): void
  onClear(): void
  onClose(): void
}

function ResizePanel({ resizeOptions, onApply, onClear, onClose }: IProps) {
  const [mode, setMode] = useState<ResizeMode>(resizeOptions.mode)
  const [values, setValues] = useState<Record<ResizeMode, number>>({
    [ResizeMode.LONG_EDGE]: resizeOptions.mode === ResizeMode.LONG_EDGE ? resizeOptions.value : MODE_DEFAULTS[ResizeMode.LONG_EDGE],
    [ResizeMode.SHORT_EDGE]: resizeOptions.mode === ResizeMode.SHORT_EDGE ? resizeOptions.value : MODE_DEFAULTS[ResizeMode.SHORT_EDGE],
    [ResizeMode.SCALE]: resizeOptions.mode === ResizeMode.SCALE ? resizeOptions.value : MODE_DEFAULTS[ResizeMode.SCALE],
  })

  const isPixelMode = mode !== ResizeMode.SCALE
  const currentValue = values[mode]
  const min = isPixelMode ? 100 : 1
  const max = isPixelMode ? 4000 : 200
  const step = isPixelMode ? 10 : 1

  const handleValueChange = (val: number) => {
    const clamped = Math.max(min, Math.min(max, Math.round(val)))
    setValues((prev) => ({ ...prev, [mode]: clamped }))
  }

  const handleApply = () => {
    onApply({ enabled: true, mode, value: currentValue })
    onClose()
  }

  const handleClear = () => {
    onClear()
    onClose()
  }

  return (
    <div className="resize-panel">
      <div className="resize-panel-body">
        <div className="resize-panel-title">{__('resize')}</div>

        <div className="resize-modes">
          {([
            [ResizeMode.LONG_EDGE, __('resize_long_edge')],
            [ResizeMode.SHORT_EDGE, __('resize_short_edge')],
            [ResizeMode.SCALE, __('resize_scale')],
          ] as [ResizeMode, string][]).map(([m, label]) => (
            <label key={m} className="resize-mode-option">
              <input
                type="radio"
                name="resize-mode"
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="resize-value-row">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentValue}
            onChange={(e) => handleValueChange(Number(e.target.value))}
          />
          <div className="resize-value-input">
            <input
              type="number"
              min={min}
              max={max}
              value={currentValue}
              onChange={(e) => handleValueChange(Number(e.target.value))}
            />
            <span className="resize-unit">{isPixelMode ? 'px' : '%'}</span>
          </div>
        </div>
      </div>

      <footer className="resize-panel-footer">
        <button type="button" className="btn-apply" onClick={handleApply}>
          <Icon name="doneall" />
          {__('resize_apply')}
        </button>
        <div className="blank" />
        <button
          type="button"
          className="btn-clear"
          onClick={handleClear}
          disabled={!resizeOptions.enabled}
        >
          {__('resize_clear')}
        </button>
        <button type="button" onClick={onClose}>
          <Icon name="close" />
        </button>
      </footer>
    </div>
  )
}

export default connect(
  (state: IState) => ({
    resizeOptions: state.globals.resizeOptions,
  }),
  (dispatch, ownProps: Pick<IProps, 'onClose'>) => ({
    onApply(opts: IResizeOptions) {
      dispatch(actions.resizeApply(opts))
    },
    onClear() {
      dispatch(actions.resizeClear())
    },
  }),
)(ResizePanel)
