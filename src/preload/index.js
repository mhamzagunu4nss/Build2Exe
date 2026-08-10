import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  onRawRowAppend: (callback) =>
    ipcRenderer.on('raw-append-row', (_event, rowData) => callback(rowData)),

  removeRawRowListener: () => ipcRenderer.removeAllListeners('raw-append-row'),
  onTokenExpired: (callback) => ipcRenderer.on('token-expired', () => callback()),
  removeTokenExpiredListener: () => ipcRenderer.removeAllListeners('token-expired'),

  onRawRowRemove: (callback) =>
    ipcRenderer.on('raw-remove-row', (_event, rowIdentity) => callback(rowIdentity)),

  removeRawRowRemoveListener: () => ipcRenderer.removeAllListeners('raw-remove-row')
}
// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
