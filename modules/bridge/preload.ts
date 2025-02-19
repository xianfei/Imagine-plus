import { contextBridge, ipcRenderer, shell } from 'electron'
import logger from 'electron-log'
import { IpcChannel } from '../common/types'
import { createAsyncCall } from './async-call/renderer'
import { ImagineAPI } from './interface'

const imagineAPI: ImagineAPI = {
  logger,
  ipcSend(channel, payload) {
    ipcRenderer.send(channel, payload)
  },
  ipcSendSync(channel, payload) {
    return ipcRenderer.sendSync(channel, payload)
  },
  ipcListen(channel, listener) {
    ipcRenderer.on(channel, (event, payload) => listener(payload))
  },
  optimize: createAsyncCall(IpcChannel.OPTIMIZE),
  openExternal: shell.openExternal,
}

contextBridge.exposeInMainWorld('imagineAPI', imagineAPI)