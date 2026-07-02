import React, { PureComponent, DragEvent } from 'react'
import classnames from 'classnames'
import { Provider } from 'react-redux'
import List from './containers/List'
import ActionBar from './containers/ActionBar'
import Alone from './containers/Alone'
import Settings from './containers/Settings'
import { prevent } from './utils/dom-event'
import store from './store/store'
import * as apis from './apis'
import { imagineAPI } from '../bridge/web'

import './components/Icon'
import './App.less'

class App extends PureComponent<Record<string, never>, { onion: number }> {
  constructor(props: Record<string, never>) {
    super(props)

    this.state = {
      onion: 0,
    }
  }

  componentDidMount() {
    // OS file drags arrive through Tauri's native drag-drop events with
    // absolute paths (the webview suppresses DOM drops for them); the
    // DOM handlers below only guard against in-page drags
    imagineAPI?.onFileDrop?.({
      onEnter: () => this.setState({ onion: 1 }),
      onLeave: () => this.setState({ onion: 0 }),
      onDrop: (paths) => {
        this.setState({ onion: 0 })
        apis.fileAdd(paths)
      },
    })
  }

  handleDragDrop = (e: DragEvent<HTMLDivElement>) => {
    // block the webview from navigating to a dropped resource
    e.preventDefault()
    e.dataTransfer.effectAllowed = 'none'
    e.dataTransfer.dropEffect = 'none'
  }

  render() {
    const { onion } = this.state

    return (
      <Provider store={store}>
        <div
          className={classnames('layout', {
            '-drag': !!onion,
          })}
          onDragOver={prevent}
          onDrop={this.handleDragDrop}
        >
          <ActionBar />
          <List />
        </div>
        <Alone />
        <Settings />
      </Provider>
    )
  }
}

export default App
