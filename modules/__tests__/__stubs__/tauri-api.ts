/**
 * Jest stub for @tauri-apps/api (ESM-only, which jest 27 cannot parse).
 * Tests always run the Electron code path, so these are never called.
 */
export const invoke = async () => {
  throw new Error('tauri api stub')
}

export const convertFileSrc = (path: string) => path

export const listen = async () => () => undefined

export const getCurrentWebview = () => ({
  onDragDropEvent: async () => () => undefined,
})

export const getCurrentWindow = () => ({
  onCloseRequested: async () => () => undefined,
})
