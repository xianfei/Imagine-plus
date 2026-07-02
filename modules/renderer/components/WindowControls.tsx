import React from 'react'
import { imagineAPI } from '../../bridge/web'

import './WindowControls.less'

/**
 * Custom window buttons for platforms without native overlay controls
 * (Tauri on Windows). Electron uses titleBarOverlay and macOS keeps its
 * traffic lights, so the bridge only exposes windowControls where the
 * buttons are actually needed.
 */
export default function WindowControls() {
  const controls = imagineAPI?.windowControls
  if (!controls) return null

  return (
    <div className="window-controls">
      <button
        type="button"
        aria-label="Minimize"
        onClick={() => controls.minimize()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5h10" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Maximize"
        onClick={() => controls.toggleMaximize()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Close"
        className="-close"
        onClick={() => controls.close()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
        </svg>
      </button>
    </div>
  )
}
