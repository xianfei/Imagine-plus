import React from 'react'
import ReactDOM from 'react-dom'
import store from './store/store'
import App from './App'
import { IpcChannel } from '../common/types'
import JobRunner from './store/job-runner'
import subscribe from './store/subscribe'
import listenIpc from './ipc/listen'
import { imagineAPI, bridgeReady } from '../bridge/web'
import { setup as setupLocales } from '../locales'
import { getSettings } from './store/storage'

const { language } = getSettings()
setupLocales(language && language !== 'auto' ? language : navigator.language)

bridgeReady.then(() => {
  const runner = new JobRunner()
  runner.watch(store)
  subscribe(store)
  listenIpc()

  imagineAPI?.ipcSend(IpcChannel.READY, null)

  ReactDOM.render(
    React.createElement(App),
    document.getElementById('app'),
  )
})
