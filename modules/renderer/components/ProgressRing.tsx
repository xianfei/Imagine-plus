import React from 'react'
import classnames from 'classnames'

import './ProgressRing.less'

interface IProgressRingProps {
  // 0 - 1
  progress: number
  size?: number
  strokeWidth?: number
  className?: string
}

export default function ProgressRing({
  progress,
  size = 22,
  strokeWidth = 3,
  className,
}: IProgressRingProps) {
  const center = size / 2
  const radius = (size - strokeWidth) / 2
  const perimeter = 2 * Math.PI * radius
  const value = Math.min(Math.max(progress, 0), 1)

  return (
    <svg
      className={classnames('progress-ring', className)}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle
        className="progress-ring-track"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
      />
      <circle
        className="progress-ring-bar"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeDasharray={perimeter}
        strokeDashoffset={perimeter * (1 - value)}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  )
}
