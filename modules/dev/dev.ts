import * as path from 'path'
import * as http from 'http'
import { spawn } from 'child_process'
import { app } from 'electron'
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from 'electron-devtools-installer'

app.on('ready', () => {
  installExtension(REACT_DEVELOPER_TOOLS).catch(() => {})
  installExtension(REDUX_DEVTOOLS).catch(() => {})
})

function waitForServer(url: string, timeout = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    const check = () => {
      http.get(url, () => {
        resolve()
      }).on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Vite dev server not ready after ${timeout}ms`))
          return
        }
        setTimeout(check, 500)
      })
    }
    check()
  })
}

export async function start(): Promise<void> {
  const rootDir = path.resolve(__dirname, '../..')
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

  const viteProcess = spawn(npx, ['vite', '--port', '9999'], {
    cwd: rootDir,
    stdio: 'inherit',
  })

  viteProcess.on('error', (err) => {
    console.error('[dev] Failed to spawn Vite:', err)
  })

  app.on('before-quit', () => {
    viteProcess.kill()
  })

  await waitForServer('http://localhost:9999/')
}
