const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#030712',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC: Native HTTP request (bypasses proxy, no CORS)
ipcMain.handle('http:execute', async (_, request) => {
  const { method, url, headers = {}, body } = request
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' && body ? body : undefined,
    })
    const resHeaders = {}
    res.headers.forEach((v, k) => { resHeaders[k] = v })
    const text = await res.text()
    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
      body: text,
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
