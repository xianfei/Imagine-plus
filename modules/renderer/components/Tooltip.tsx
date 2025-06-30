import React, { PureComponent, ReactElement, cloneElement, Children } from 'react'
import Popper from './Popper'

import './Tooltip.less'

interface ITooltipProps {
  title: string
  placement?: string
  children: ReactElement
}

export default class Tooltip extends PureComponent<ITooltipProps> {
  static defaultProps = {
    placement: 'bottom',
  }

  render() {
    const { title, placement, children } = this.props

    return (
      <Popper
        hoverMode
        placement={placement}
        className="tooltip"
        popper={(
          <div className="tooltip-content">
            {title}
          </div>
        )}
      >
        {children}
      </Popper>
    )
  }
}