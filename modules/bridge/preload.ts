import { contextBridge, ipcRenderer, shell } from 'electron'
import logger from 'electron-log'
import { IpcChannel } from '../common/types'
import { createAsyncCall } from './async-call/renderer'
import { ImagineAPI } from './interface'
import { Titlebar, TitlebarColor } from "custom-electron-titlebar";

window.addEventListener('DOMContentLoaded', () => {
  // Title bar implementation
  new Titlebar({
    backgroundColor: TitlebarColor.fromHex('#FFFFFF')
  });
});

const imagineAPI: ImagineAPI = {
  logger,
  ipcSend(channel, payload) {
    ipcRenderer.send(channel, payload)
  },
  ipcListen(channel, listener) {
    ipcRenderer.on(channel, (event, payload) => listener(payload))
  },
  optimize: createAsyncCall(IpcChannel.OPTIMIZE),
  openExternal: shell.openExternal,
}

contextBridge.exposeInMainWorld('imagineAPI', imagineAPI)
