import { ImagineAPI } from './interface'
import { createTauriAPI, initTauriBridge } from './tauri'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const imagineAPI: ImagineAPI = isTauri
  ? createTauriAPI()
  : (window as any as { imagineAPI: ImagineAPI }).imagineAPI

/** resolves once the bridge is usable (config cache primed under Tauri) */
export const bridgeReady: Promise<void> = isTauri ? initTauriBridge() : Promise.resolve()
