import React, { useCallback, useEffect } from 'react'
import { connect } from 'react-redux'
import {
  SupportedExt,
  IOptimizeOptions,
  IDefaultOptions,
  IState,
} from '../../common/types'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import Select from '../components/Select'
import ImageOptions from '../components/ImageOptions'
import TargetTypeSelect from '../components/TargetTypeSelect'
import actions from '../store/actionCreaters'
import * as storage from '../store/storage'
import { imagineAPI } from '../../bridge/web'
import __ from '../../locales'
import pkg from '../../../package.json'

import './Settings.less'

const INPUT_EXTS: { ext: SupportedExt, label: string }[] = [
  { ext: SupportedExt.jpg, label: 'JPEG' },
  { ext: SupportedExt.png, label: 'PNG' },
  { ext: SupportedExt.webp, label: 'WebP' },
  { ext: SupportedExt.avif, label: 'AVIF' },
  { ext: SupportedExt.heic, label: 'HEIC' },
  { ext: SupportedExt.bmp, label: 'BMP' },
]

const OUTPUT_EXTS: { ext: SupportedExt, label: string }[] = [
  { ext: SupportedExt.jpg, label: 'JPEG' },
  { ext: SupportedExt.png, label: 'PNG' },
  { ext: SupportedExt.webp, label: 'WebP' },
  { ext: SupportedExt.avif, label: 'AVIF' },
]

const LANGUAGES: { code: string, label: string }[] = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'ru', label: 'Русский' },
  { code: 'sv', label: 'Svenska' },
  { code: 'hr', label: 'Hrvatski' },
  { code: 'sr', label: 'Српски' },
  { code: 'ar', label: 'العربية' },
  { code: 'fa', label: 'فارسی' },
]

const cpuCount = Math.max((navigator.hardwareConcurrency || 2) - 1, 1)

function storeset(key: string, value: unknown) {
  imagineAPI?.ipcSend('store-set' as never, { key, value } as never)
}

function storeget<T>(key: string, def: T): T {
  return (imagineAPI?.ipcSendSync('store-get' as never, { key, def } as never) ?? def) as T
}

interface IProps {
  visible: boolean
  optionsMap: IDefaultOptions
}

interface IDispatchProps {
  onOptionsChange(ext: SupportedExt, options: IOptimizeOptions): void
  onApply(): void
  onClose(): void
}

function Settings(props: IProps & IDispatchProps) {
  const {
    visible, optionsMap, onOptionsChange, onApply, onClose,
  } = props

  useEffect(() => {
    if (!visible) return undefined

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keyup', handleKey)
    return () => window.removeEventListener('keyup', handleKey)
  }, [visible, onClose])

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    storage.saveSettings({ language: e.target.value })
    // locale strings are resolved once at boot; reload to apply
    window.location.reload()
  }, [])

  const handleConcurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    storage.saveSettings({ concurrency: Number(e.target.value) || 0 })
  }, [])

  const settings = storage.getSettings()

  return (
    <Modal className="settings-modal" visible={visible} onClose={onClose}>
      <div className="settings-page">
        {/* header shares the row with the modal back button (and keeps
            the window draggable while settings cover the action bar) */}
        <header
          data-tauri-drag-region="deep"
          className="settings-header"
          style={{ paddingLeft: navigator.platform.startsWith('Mac') ? '135px' : '55px' }}
        >
          <h1>{__('settings')}</h1>
        </header>

        <section>
          <h2>{__('format_mapping')}</h2>
          <p className="section-desc">{__('format_mapping_desc')}</p>
          <div className="format-grid">
            {INPUT_EXTS.map(({ ext, label }) => (
              <div className="settings-row" key={ext}>
                <span className="row-label">{label}</span>
                <TargetTypeSelect
                  sourceExt={ext}
                  targetExt={optionsMap[ext]?.exportExt || ext}
                  onChange={(exportExt) => onOptionsChange(ext, {
                    ...optionsMap[ext],
                    exportExt,
                  })}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>{__('output_options')}</h2>
          <p className="section-desc">{__('output_options_desc')}</p>
          {OUTPUT_EXTS.map(({ ext, label }) => (
            <div className="settings-row" key={ext}>
              <span className="row-label">{label}</span>
              <ImageOptions
                precision
                ext={ext}
                options={optionsMap[ext]}
                onChange={(options) => onOptionsChange(ext, options)}
              />
            </div>
          ))}
        </section>

        <section>
          <h2>{__('general')}</h2>
          <div className="settings-row">
            <label>
              <input
                type="checkbox"
                defaultChecked={storeget('keepmeta', true)}
                onChange={(e) => storeset('keepmeta', e.target.checked)}
              />
              <span>{__('keep_metadata')}</span>
            </label>
          </div>
          <div className="settings-row">
            <label>
              <input
                type="checkbox"
                defaultChecked={storeget('progressive', true)}
                onChange={(e) => storeset('progressive', e.target.checked)}
              />
              <span>{__('progressive_enc')}</span>
            </label>
          </div>
          <div className="settings-row">
            <label>
              <input
                type="checkbox"
                defaultChecked={storeget('checkupdate', true)}
                onChange={(e) => storeset('checkupdate', e.target.checked)}
              />
              <span>{__('check_update')}</span>
            </label>
          </div>
          <div className="settings-row">
            <span className="row-label">{__('language')}</span>
            <Select value={settings.language || 'auto'} onChange={handleLanguageChange}>
              <option value="auto">{__('language_auto')}</option>
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </Select>
          </div>
          <div className="settings-row">
            <span className="row-label">{__('concurrency')}</span>
            <Select
              value={String(settings.concurrency || 0)}
              onChange={handleConcurrencyChange}
            >
              <option value="0">{__('concurrency_auto', cpuCount)}</option>
              {Array.from({ length: Math.max(navigator.hardwareConcurrency || 2, 4) }, (_, i) => i + 1)
                .map((n) => <option key={n} value={String(n)}>{n}</option>)}
            </Select>
          </div>
        </section>

        <footer>
          <button type="button" className="apply-button" onClick={onApply}>
            <Icon name="doneall" />
            <span>{__('apply_existing')}</span>
          </button>
          <span
            className="app-version"
            onClick={() => imagineAPI.ipcSend('about' as never, 1 as never)}
          >
            Imagine v
            {pkg.version}
          </span>
        </footer>
      </div>
    </Modal>
  )
}

export default connect<IProps, IDispatchProps, Record<string, never>, IState>(
  (state) => ({
    visible: state.globals.optionsVisible,
    optionsMap: state.globals.defaultOptions,
  }),
  (dispatch) => ({
    onOptionsChange(ext: SupportedExt, options: IOptimizeOptions) {
      dispatch(actions.defaultOptions({ ext, options }))
    },
    onApply() {
      dispatch(actions.optionsApply())
    },
    onClose() {
      dispatch(actions.optionsVisible(false))
    },
  }),
)(Settings)
