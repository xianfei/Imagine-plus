/**
 * store / restore options using localStorage
 */

import { imagineAPI } from '../../bridge/web'
import { IDefaultOptions } from '../../common/types'

interface IStorageContent {
  defaultOptions: IDefaultOptions,
}

const key = 'options-v3'

const hasLocalStorage = !(typeof localStorage === 'undefined')

export const getOptions = () => {
  if (!hasLocalStorage) return null

  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as IStorageContent
  } catch (e) {
    imagineAPI?.logger.error(`Failed to get options from localStorage, ${e}`)
    return null
  }
}

export const saveOptions = (options: IStorageContent) => {
  if (!hasLocalStorage) return

  try {
    localStorage.setItem(key, JSON.stringify(options))
  } catch (e) {
    imagineAPI?.logger.error(`Failed to set options to localStorage, ${e}`)
  }
}

/**
 * renderer-only app settings (no backend involvement needed)
 */
interface IAppSettings {
  /** locale code, or 'auto' to follow the system */
  language?: string
  /** max parallel optimize tasks; 0/undefined = auto (cores - 1) */
  concurrency?: number
}

const settingsKey = 'settings-v1'

export const getSettings = (): IAppSettings => {
  if (!hasLocalStorage) return {}
  try {
    return JSON.parse(localStorage.getItem(settingsKey) ?? '{}') as IAppSettings
  } catch {
    return {}
  }
}

export const saveSettings = (partial: Partial<IAppSettings>) => {
  if (!hasLocalStorage) return
  try {
    localStorage.setItem(settingsKey, JSON.stringify({ ...getSettings(), ...partial }))
  } catch (e) {
    imagineAPI?.logger.error(`Failed to save settings, ${e}`)
  }
}
