import React, { PureComponent, DragEvent } from 'react'
import classnames from 'classnames'
import { Provider } from 'react-redux'
import List from './containers/List'
import ActionBar from './containers/ActionBar'
import Alone from './containers/Alone'
import { prevent } from './utils/dom-event'
import store from './store/store'
import * as apis from './apis'

import './components/Icon'
import './App.less'

class App extends PureComponent<Record<string, never>, { onion: number }> {
  constructor(props: Record<string, never>) {
    super(props)

    this.state = {
      onion: 0,
    }
  }

  handleDragEnter = () => {
    this.setState((state) => ({
      onion: state.onion + 1,
    }))
  }

  handleDragLeave = () => {
    this.setState((state) => ({
      onion: state.onion - 1,
    }))
  }

  handleDragDrop = (e: DragEvent<HTMLDivElement>) => {
    this.setState({
      onion: 0,
    })

    console.log(e.dataTransfer.files)

    const files = Array.from(e.dataTransfer.files)
      .filter((file) => !file.type || /png|jpeg|webp|avif/.test(file.type))
      .map((file) => file.path)

    apis.fileAdd(files)

    e.preventDefault();
      //属性指定拖放操作所允许的一个效果。copy 操作用于指示被拖动的数据将从当前位置复制到放置位置。
      // move操作用于指定被拖动的数据将被移动。 link操作用于指示将在源和放置位置之间创建某种形式的关系或连接。
      e.dataTransfer.effectAllowed = 'none';
      // 属性控制在拖放操作中给用户的反馈（通常是视觉上的）。它会影响在拖拽过程中光标的手势。
      e.dataTransfer.dropEffect = 'none';
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
          onDragEnter={this.handleDragEnter}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDragDrop}
        >
          <ActionBar />
          <List />
        </div>
        <Alone />
      </Provider>
    )
  }
}

export default App
