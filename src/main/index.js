import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import log from 'electron-log'
import path, { join } from 'path'
import './profile-setup'
log.initialize()
log.transports.file.getFile().clear()
console.log = log.log
console.error = log.error
console.warn = log.warn

log.info('Application starting in production mode...')

import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'

import fs, { promises as fsPromises } from 'fs'
import {
  generateAuthUrl,
  loadAuthClient,
  saveToken,
  setCredentials
} from '../../resources/google_drive_config/auth'
import {
  createSubscription,
  getOrCreateSubscriptionNameOrId,
  getTopicNameOrId,
  getTotalNumberOfPages,
  getTotalNumberOfReceivePages,
  getTotalNumberOfReceiveRows,
  getTotalNumberOfRows,
  isAuthRevokedError,
  listenForMessages,
  publishMessage,
  saveSubscriptionOverride,
  saveTopicOverride,
  scheduleReceiveDriveSync,
  stopListening,
  UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH
} from '../renderer/src/helpers/helper-functions'

const { google } = require('googleapis')

import Big from 'big.js'
let isOnlineFn = null
async function isOnline(...args) {
  if (!isOnlineFn) {
    const mod = await import('is-online')
    isOnlineFn = mod.default
  }
  return isOnlineFn(...args)
}

process.on('uncaughtException', (error) => {
  const message = error ? error.message : 'Unknown error'
  const code = error && error.code ? `[${error.code}] ` : ''

  console.error(`Error: ${code}${message}`)
})

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  const code = reason && reason.code ? `[${reason.code}] ` : ''

  console.error(`Rejection: ${code}${message}`)
})
const newWorkerSignaturesPath = is.dev
  ? path.join(__dirname, '../../resources/worker_signatures')
  : path.join(process.resourcesPath, 'worker_signatures')

const newWorkerDataPath = is.dev
  ? path.join(__dirname, '../../resources/new-worker-data.txt')
  : path.join(process.resourcesPath, 'new-worker-data.txt')

const emptyReceiveTablePageFilePath = is.dev
  ? path.join(__dirname, '../../resources/empty_receive_table_page/empty-receive-table-page.txt')
  : path.join(process.resourcesPath, 'empty_receive_table_page/empty-receive-table-page.txt')

const emptyDespatchTablePageFilePath = is.dev
  ? path.join(__dirname, '../../resources/empty_despatch_table_page/empty-despatch-table-page.txt')
  : path.join(process.resourcesPath, 'empty_despatch_table_page/empty-despatch-table-page.txt')

const receiveTablePagedDataFilePath = path.join(
  app.getPath('userData'),
  'receive_table',
  'table-data'
)

const despatchTableDataFilePath = path.join(app.getPath('userData'), 'despatch_table', 'table-data')

const pubSubTableDataPath = path.join(app.getPath('userData'), 'pub_sub_table', 'table.txt')

const tempPubSubTableDataPath = path.join(
  app.getPath('userData'),
  'pub_sub_table',
  'temp-pub-sub-table-save-data.txt'
)

const tempDespatchTableSaveDataFilePath = path.join(
  app.getPath('userData'),
  'despatch_table',
  'temp-despatch-table-save-data.txt'
)

const tempReceiveTableSaveDataFilePath = path.join(
  app.getPath('userData'),
  'receive_table',
  'temp-receive-table-save-data.txt'
)

const tempDespatchDownloadFilePath = path.join(
  app.getPath('userData'),
  'despatch_table',
  'temp-despatch-table-download-data.txt'
)

const tempReceiveDownloadFilePath = path.join(
  app.getPath('userData'),
  'receive_table',
  'temp-receive-table-download-data.txt'
)
;(async () => {
  try {
    await fsPromises.mkdir(path.join(app.getPath('userData'), 'despatch_table'), {
      recursive: true
    })
    await fsPromises.mkdir(path.join(app.getPath('userData'), 'receive_table'), {
      recursive: true
    })
    await fsPromises.mkdir(path.join(app.getPath('userData'), 'pub_sub_table'), {
      recursive: true
    })

    const despatchPageCount = (await getTotalNumberOfPages()).toNumber()
    if (despatchPageCount === 0) {
      console.log('No despatch pages found, creating page 1...')
      await fsPromises.copyFile(
        emptyDespatchTablePageFilePath,
        despatchTableDataFilePath + '_page_1.txt'
      )
    }

    const receivePageCount = (await getTotalNumberOfReceivePages()).toNumber()
    if (receivePageCount === 0) {
      console.log('No receive pages found, creating page 1...')
      await fsPromises.copyFile(
        emptyReceiveTablePageFilePath,
        receiveTablePagedDataFilePath + '_page_1.txt'
      )
    }

    try {
      await fsPromises.access(peopleEnumFilePath)
    } catch {
      console.log('No people list found, copying the starter list...')
      await fsPromises.copyFile(bundledPeopleEnumFilePath, peopleEnumFilePath)
    }

    try {
      await fsPromises.access(departmentEnumFilePath)
    } catch {
      console.log('No department list found, copying the starter list...')
      await fsPromises.copyFile(bundledDepartmentEnumFilePath, departmentEnumFilePath)
    }
  } catch (error) {
    console.error('Failed to set up userData table directories:', error.message)
  }
})()

const bundledPeopleEnumFilePath = is.dev
  ? path.join(__dirname, '../../resources/people-options-enum.txt')
  : path.join(process.resourcesPath, 'people-options-enum.txt')

const bundledDepartmentEnumFilePath = is.dev
  ? path.join(__dirname, '../../resources/department-options-enum.txt')
  : path.join(process.resourcesPath, 'department-options-enum.txt')

const peopleEnumFilePath = path.join(app.getPath('userData'), 'people-options-enum.txt')

const departmentEnumFilePath = path.join(app.getPath('userData'), 'department-options-enum.txt')

const CREDENTIALS_PATH = is.dev
  ? path.join(__dirname, '../../resources/google_drive_config/credentials.json')
  : path.join(process.resourcesPath, 'google_drive_config/credentials.json')

const TOKEN_PATH = path.join(app.getPath('userData'), 'token.json')

const UPLOADED_DESPATCH_TABLE_ID_JSON_FILE_PATH = path.join(
  app.getPath('userData'),
  'despatchTableId.json'
)

const splashHtmlPath = is.dev
  ? path.join(__dirname, '../../resources/splash.html')
  : path.join(process.resourcesPath, 'splash.html')

async function handleTokenRevocation(error) {
  if (isAuthRevokedError(error)) {
    console.log('Auth Revocation error detected. Attempting to clear token file...')
    try {
      await fsPromises.unlink(TOKEN_PATH)
      console.log('Auth Successfully unlinked token file.')
    } catch (err) {
      console.log('Auth Token file unlinking skipped:', err.message)
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('Auth Sending "token-expired" IPC event to mainWindow.')
      mainWindow.webContents.send('token-expired')
    }
    return true
  }
  return false
}

const TOKEN_MAX_AGE_IN_MS = 3 * 24 * 60 * 60 * 1000 // 3 days in milliseconds

async function checkAndExpireToken() {
  try {
    console.log('Checking Auth token age...')
    const stats = await fsPromises.stat(TOKEN_PATH)
    const age = Date.now() - stats.mtimeMs

    if (age > TOKEN_MAX_AGE_IN_MS) {
      console.log(`Auth Token expired. Age (${age}ms) exceeds max allowed. Unlinking...`)
      await fsPromises.unlink(TOKEN_PATH)

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('token-expired')
      }
    } else {
      console.log(`Auth Token is still valid. Current age: ${age}ms.`)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Auth Error checking token age:', error.message)
    } else {
      console.log('Auth No token file found to check:', error.message)
    }
  }
}

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents'
]
let mainWindow = null
let splashWindow = null
const rowsPerPage = new Big(1000)
let currentDownloadController = null
let isDownloadAborted = false

let departmentWindow = null
let workerWindow = null

function createDepartmentWindow() {
  if (departmentWindow && !departmentWindow.isDestroyed()) {
    departmentWindow.show()
    departmentWindow.focus()
    return
  }

  departmentWindow = new BrowserWindow({
    width: 450,
    height: 700,
    parent: mainWindow,
    modal: true,
    autoHideMenuBar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  departmentWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      departmentWindow.hide()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    departmentWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/add-department`)
  } else {
    departmentWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'add-department'
    })
  }
}

function createWorkerWindow() {
  if (workerWindow && !workerWindow.isDestroyed()) {
    workerWindow.show()
    workerWindow.focus()
    return
  }

  workerWindow = new BrowserWindow({
    width: 600,
    height: 750,
    parent: mainWindow,
    modal: true,
    autoHideMenuBar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  workerWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      workerWindow.hide()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    workerWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/add-worker`)
  } else {
    workerWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'add-worker'
    })
  }
}

function createWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    movable: false,
    skipTaskbar: true
  })
  splashWindow.loadFile(splashHtmlPath)

  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    opacity: 0,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.maximize()

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy()
      }

      mainWindow.show()
      mainWindow.setOpacity(1)
    }, 4000)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true } }
])

app.whenReady().then(async () => {
  ipcMain.handle('save-department-from-window', async (event, departmentName) => {
    try {
      const newDepartmentData = { label: departmentName, value: departmentName }
      await fsPromises.appendFile(
        departmentEnumFilePath,
        '\n' + JSON.stringify(newDepartmentData),
        'utf8'
      )

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('refresh-department-enums', newDepartmentData)
      }
      return true
    } catch (error) {
      console.error('Error saving department from window:', error.message)
      return false
    }
  })

  ipcMain.handle('open-department-window', () => {
    createDepartmentWindow()
  })

  ipcMain.handle('open-worker-window', () => {
    createWorkerWindow()
  })

  ipcMain.handle('close-department-window', () => {
    if (departmentWindow && !departmentWindow.isDestroyed()) {
      departmentWindow.hide()
    }
  })

  ipcMain.handle('close-worker-window', () => {
    if (workerWindow && !workerWindow.isDestroyed()) {
      workerWindow.close()
    }
  })

  checkAndExpireToken()
  setInterval(checkAndExpireToken, 60 * 60 * 1000)

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  protocol.handle('media', (request) => {
    const cleanedPath = request.url.replace('media://signatures/', '')
    const finalDiskPath = path.join(newWorkerSignaturesPath, cleanedPath)
    return net.fetch(`file:///${finalDiskPath}`)
  })

  ipcMain.handle('stop-listening', async () => {
    try {
      await stopListening()
      dialog.showMessageBox({
        type: 'error',
        title: 'No internet',
        message: 'Please connect to the internet'
      })
      return
    } catch (error) {
      console.error('Could not stop Listener:', error.message)
      return
    }
  })

  ipcMain.handle('check-actual-internet', async () => {
    try {
      const status = await isOnline()
      return status
    } catch (error) {
      console.error('[Internet Heartbeat] Error checking status:', error)
      return false
    }
  })

  ipcMain.handle('get-current-pubsub-config', async () => {
    const currentTopic = await getTopicNameOrId()
    const currentSubscription = await getOrCreateSubscriptionNameOrId()
    return { currentTopic, currentSubscription }
  })

  ipcMain.handle('save-pubsub-overrides', async (event, topicOverride, subscriptionOverride) => {
    try {
      if (topicOverride) {
        await saveTopicOverride(topicOverride)
      }
      if (subscriptionOverride) {
        await saveSubscriptionOverride(subscriptionOverride)
      }

      if (topicOverride || subscriptionOverride) {
        let oAuth2Client = await loadAuthClient()
        if (oAuth2Client) {
          oAuth2Client = await setCredentials(oAuth2Client)

          stopListening()

          const subscriptionNameOrId = await createSubscription(oAuth2Client)
          if (subscriptionNameOrId) {
            await listenForMessages(mainWindow, subscriptionNameOrId, oAuth2Client)
          }
        }
      }

      return true
    } catch (err) {
      console.error('Error applying Pub/Sub overrides:', err.message)
      return false
    }
  })

  ipcMain.handle('is-despatch-table-already-uploaded?', async () => {
    try {
      await fsPromises.access(UPLOADED_DESPATCH_TABLE_ID_JSON_FILE_PATH)
      return true
    } catch (error) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Failed to check for save status of Despatch Table ID',
        message: 'Could not check save status of Despatch Table File ID : ' + error.message
      })
      return false
    }
  })

  ipcMain.handle('create-file-update-subscription', async () => {
    try {
      let oAuth2Client = await loadAuthClient()
      if (!oAuth2Client) {
        return null
      }
      oAuth2Client = await setCredentials(oAuth2Client)
      const subscriptionNameOrId = await createSubscription(oAuth2Client)
      if (subscriptionNameOrId) {
        await listenForMessages(mainWindow, subscriptionNameOrId, oAuth2Client)
      }
      return subscriptionNameOrId
    } catch (err) {
      await handleTokenRevocation(err)
      console.error('Error creating file update subscription:', err.message)
      return null
    }
  })

  ipcMain.handle('publish-message', async (event, data) => {
    try {
      let oAuth2Client = await loadAuthClient()
      if (!oAuth2Client) {
        return null
      }

      oAuth2Client = await setCredentials(oAuth2Client)
      await publishMessage(oAuth2Client, data)

      return { MessagePublishSuccess: true }
    } catch (err) {
      await handleTokenRevocation(err)
      console.error('Error in publish handler:', err.message)
      return null
    }
  })

  ipcMain.handle('load-uploaded-despatch-table-ids', async () => {
    try {
      await fsPromises.access(UPLOADED_DESPATCH_TABLE_ID_JSON_FILE_PATH)
      const data = await fsPromises.readFile(UPLOADED_DESPATCH_TABLE_ID_JSON_FILE_PATH, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      return {}
    }
  })

  ipcMain.handle('save-uploaded-despatch-table-id', async (event, pageNumber, fileId) => {
    try {
      await fsPromises.mkdir(path.dirname(UPLOADED_DESPATCH_TABLE_ID_JSON_FILE_PATH), {
        recursive: true
      })
      let existingMap = {}
      try {
        await fsPromises.access(UPLOADED_DESPATCH_TABLE_ID_JSON_FILE_PATH)
        const data = await fsPromises.readFile(UPLOADED_DESPATCH_TABLE_ID_JSON_FILE_PATH, 'utf-8')
        existingMap = JSON.parse(data)
      } catch {
        existingMap = {}
      }

      existingMap[pageNumber] = fileId

      await fsPromises.writeFile(
        UPLOADED_DESPATCH_TABLE_ID_JSON_FILE_PATH,
        JSON.stringify(existingMap),
        'utf-8'
      )

      dialog.showMessageBox({
        type: 'info',
        title: 'Despatch Table ID Saved Successfully',
        message: `Despatch Table File ID saved for page ${pageNumber}`
      })
      return
    } catch (error) {
      console.error('Failed to save uploaded despatch table ID:', error.message)
      return
    }
  })

  ipcMain.handle('abort-drive-download', () => {
    isDownloadAborted = true
    if (currentDownloadController) {
      currentDownloadController.abort()
      currentDownloadController = null
    }
  })

  ipcMain.handle('download-despatch-page-from-drive', async (event, pageNumber, fileId) => {
    if (isDownloadAborted) {
      return false
    }
    try {
      let oAuth2Client = await loadAuthClient()
      if (!oAuth2Client) {
        return false
      }
      oAuth2Client = await setCredentials(oAuth2Client)
      const drive = google.drive({ version: 'v3', auth: oAuth2Client })

      currentDownloadController = new AbortController()

      const response = await drive.files.get(
        { fileId, alt: 'media' },
        {
          responseType: 'text',
          signal: currentDownloadController.signal
        }
      )

      const finalFilePath = despatchTableDataFilePath + `_page_${pageNumber}.txt`
      const uniqueTempFilePath = tempDespatchDownloadFilePath + `_${pageNumber}`
      await fsPromises.mkdir(path.dirname(finalFilePath), { recursive: true })
      await fsPromises.writeFile(uniqueTempFilePath, response.data, 'utf8')
      await fsPromises.rename(uniqueTempFilePath, finalFilePath)

      currentDownloadController = null
      return true
    } catch (error) {
      await handleTokenRevocation(error)
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error(`Failed to download despatch page ${pageNumber} from Drive:`, error.message)
      }
      currentDownloadController = null
      return false
    }
  })

  ipcMain.handle('confirm-overwrite-with-drive-data', async (event, message) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Overwrite'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: 'Confirm Download from Google Drive',
      message
    })
    return result.response === 1
  })

  ipcMain.handle('reset-download-state', () => {
    isDownloadAborted = false
  })

  ipcMain.handle('delete-authentication-token', async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Confirm Reset'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: 'Confirm Token Reset',
      message:
        'This will wipe your current Google credentials and force re-authentication. Continue?'
    })

    if (result.response !== 1) {
      return { status: 'cancelled' }
    }

    try {
      await fsPromises.access(TOKEN_PATH)
      await fsPromises.unlink(TOKEN_PATH)
      return { status: 'success' }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { status: 'success' }
      }
      console.error('Failed to delete auth token:', error.message)
      return { status: 'error' }
    }
  })

  ipcMain.handle('download-receive-page-from-drive', async (event, pageNumber, fileId) => {
    if (isDownloadAborted) {
      return false
    }
    try {
      let oAuth2Client = await loadAuthClient()
      if (!oAuth2Client) {
        return false
      }
      oAuth2Client = await setCredentials(oAuth2Client)
      const drive = google.drive({ version: 'v3', auth: oAuth2Client })

      currentDownloadController = new AbortController()

      const response = await drive.files.get(
        { fileId, alt: 'media' },
        {
          responseType: 'text',
          signal: currentDownloadController.signal
        }
      )

      const finalFilePath = receiveTablePagedDataFilePath + `_page_${pageNumber}.txt`
      const uniqueTempFilePath = tempReceiveDownloadFilePath + `_${pageNumber}`
      await fsPromises.mkdir(path.dirname(finalFilePath), { recursive: true })
      await fsPromises.writeFile(uniqueTempFilePath, response.data, 'utf8')
      await fsPromises.rename(uniqueTempFilePath, finalFilePath)

      currentDownloadController = null
      return true
    } catch (error) {
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error(`Failed to download receive page ${pageNumber} from Drive:`, error.message)
      }
      currentDownloadController = null
      return false
    }
  })

  ipcMain.handle('upload-despatch-table-data-to-google-drive', async (event, pageNumber) => {
    try {
      let oAuth2Client = await loadAuthClient()
      if (!oAuth2Client) {
        return null
      }
      oAuth2Client = await setCredentials(oAuth2Client)
      const drive = google.drive({ version: 'v3', auth: oAuth2Client })

      const fileMetadata = {
        name: `despatch-table-data_page_${pageNumber}.txt`,
        parents: ['1f8neDAk2O2wuH487nx6CkXH7ebT33KrT']
      }
      const media = {
        mimeType: 'text/plain',
        body: fs.createReadStream(despatchTableDataFilePath + `_page_${pageNumber}.txt`)
      }
      const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      })
      dialog.showMessageBox({
        type: 'info',
        title: 'Upload Successful',
        message:
          `Page ${pageNumber} uploaded to Google Drive successfully! File ID: ` + response.data.id
      })
      return response.data
    } catch (err) {
      await handleTokenRevocation(err)
      console.error('Error uploading file to Google Drive:', err.message)
      dialog.showMessageBox({
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to upload file to Google Drive. Error: ' + err.message
      })
      return null
    }
  })

  ipcMain.handle('load-uploaded-receive-table-ids', async () => {
    try {
      await fsPromises.access(UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH)
      const data = await fsPromises.readFile(UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      return {}
    }
  })

  ipcMain.handle('save-uploaded-receive-table-id', async (event, pageNumber, fileId) => {
    try {
      await fsPromises.mkdir(path.dirname(UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH), {
        recursive: true
      })
      let existingMap = {}
      try {
        await fsPromises.access(UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH)
        const data = await fsPromises.readFile(UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH, 'utf-8')
        existingMap = JSON.parse(data)
      } catch {
        existingMap = {}
      }

      existingMap[pageNumber] = fileId

      await fsPromises.writeFile(
        UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH,
        JSON.stringify(existingMap),
        'utf-8'
      )

      dialog.showMessageBox({
        type: 'info',
        title: 'Receive Table ID Saved Successfully',
        message: `Receive Table File ID saved for page ${pageNumber}`
      })
      return
    } catch (error) {
      console.error('Failed to save uploaded receive table ID:', error.message)
      return
    }
  })

  ipcMain.handle('upload-receive-table-data-to-google-drive', async (event, pageNumber) => {
    try {
      let oAuth2Client = await loadAuthClient()
      if (!oAuth2Client) {
        return null
      }
      oAuth2Client = await setCredentials(oAuth2Client)
      const drive = google.drive({ version: 'v3', auth: oAuth2Client })

      const fileMetadata = {
        name: `receive-table-data_page_${pageNumber}.txt`,
        parents: ['1hjjcOD9mQGyn3esSNw8He_Z2VcuyJgps']
      }
      const media = {
        mimeType: 'text/plain',
        body: fs.createReadStream(receiveTablePagedDataFilePath + `_page_${pageNumber}.txt`)
      }
      const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      })
      dialog.showMessageBox({
        type: 'info',
        title: 'Upload Successful',
        message:
          `Receive page ${pageNumber} uploaded to Google Drive successfully! File ID: ` +
          response.data.id
      })
      return response.data
    } catch (err) {
      await handleTokenRevocation(err)
      console.error('Error uploading receive file to Google Drive:', err.message)
      dialog.showMessageBox({
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to upload receive file to Google Drive. Error: ' + err.message
      })
      return null
    }
  })

  ipcMain.handle('update-google-drive-file', async (event, fileId, newContent) => {
    try {
      let oAuth2Client = await loadAuthClient()
      if (!oAuth2Client) {
        return null
      }
      oAuth2Client = await setCredentials(oAuth2Client)
      const drive = google.drive({ version: 'v3', auth: oAuth2Client })

      const media = {
        mimeType: 'text/plain',
        body: newContent
      }

      const response = await drive.files.update({
        fileId: fileId,
        media: media
      })

      dialog.showMessageBox({
        type: 'info',
        title: 'Update Successful',
        message: 'File updated on Google Drive successfully! File ID: ' + response.data.id
      })
      return response.data
    } catch (err) {
      await handleTokenRevocation(err)
      console.error('Error updating file on Google Drive:', err.message)
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update file on Google Drive. Error: ' + err.message
      })
      return null
    }
  })

  ipcMain.handle('list-google-drive-files', async () => {
    try {
      let oAuth2Client = await loadAuthClient()
      if (!oAuth2Client) {
        return null
      }
      oAuth2Client = await setCredentials(oAuth2Client)
      const drive = google.drive({ version: 'v3', auth: oAuth2Client })
      const response = await drive.files.list({
        pageSize: 10,
        fields: 'files(id, name)'
      })
      dialog.showMessageBox({
        type: 'info',
        title: 'Files Listed',
        message:
          'Files from Google Drive:\n' +
          response.data.files.map((f) => `${f.name} (${f.id})`).join('\n')
      })
      return response.data.files
    } catch (err) {
      await handleTokenRevocation(err)
      console.error('Error listing Google Drive files:', err.message)
      dialog.showMessageBox({
        type: 'error',
        title: 'Listing Failed',
        message: 'Failed to list files from Google Drive. Error: ' + err.message
      })
      return null
    }
  })

  ipcMain.handle('load-auth-client', async () => {
    try {
      const oAuth2Client = await loadAuthClient()
      if (!oAuth2Client) {
        return null
      }
      return oAuth2Client
    } catch (err) {
      console.error('Error loading credentials:', err.message)
      return null
    }
  })

  ipcMain.handle('generate-auth-url', async () => {
    const oAuth2Client = await loadAuthClient()
    if (!oAuth2Client) {
      return null
    }
    const authUrl = await generateAuthUrl(oAuth2Client)
    return authUrl
  })

  ipcMain.handle('set-credentials', async () => {
    return await setCredentials(await loadAuthClient())
  })

  ipcMain.handle('save-Token', async (event, code) => {
    let oAuth2Client = await loadAuthClient()
    if (!oAuth2Client) {
      return null
    }
    return await saveToken(oAuth2Client, code)
  })

  ipcMain.handle('check-google-token-existence', async () => {
    try {
      await fsPromises.access(TOKEN_PATH)
      return true
    } catch {
      return false
    }
  })

  ipcMain.on('save-new-worker-signature', async (event, newworkerdata) => {
    try {
      const rawData = newworkerdata.signatureBase64.replace(/^data:image\/\w+;base64,/, '')
      const signatureBuffer = Buffer.from(rawData, 'base64')
      await fsPromises.mkdir(newWorkerSignaturesPath, { recursive: true })
      await fsPromises.writeFile(
        `${newWorkerSignaturesPath}/${newworkerdata.newWorkerName}.png`,
        signatureBuffer
      )

      try {
        await fsPromises.appendFile(newWorkerDataPath, JSON.stringify(newworkerdata) + '\n', 'utf8')

        const personEnumItem = {
          label: newworkerdata.newWorkerName,
          value: newworkerdata.newWorkerName
        }
        await fsPromises.appendFile(
          peopleEnumFilePath,
          '\n' + JSON.stringify(personEnumItem),
          'utf8'
        )

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('refresh-worker-enums', personEnumItem)
        }

        event.reply('save-new-worker-signature-reply', 'New worker signature saved successfully!')
      } catch (error) {
        console.error('Error appending new worker data to file:', error.message)
        event.reply('save-new-worker-signature-reply', 'Error saving new worker data')
        return
      }
    } catch (error) {
      console.error('Error saving new worker signature:', error.message)
      event.reply('save-new-worker-signature-reply', 'Error saving new worker signature')
    }
  })

  ipcMain.handle('get-worker-signature', async (event, targetName) => {
    try {
      if (!targetName) return null

      const rawData = await fsPromises.readFile(newWorkerDataPath, 'utf-8')
      const lines = rawData.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        const parsedRow = JSON.parse(line)
        if (
          parsedRow.newWorkerName &&
          parsedRow.newWorkerName.toLowerCase() === targetName.toLowerCase()
        ) {
          return parsedRow.signatureBase64
        }
      }

      return null
    } catch (error) {
      console.error('Error matching signature data from file:', error.message)
      return null
    }
  })

  ipcMain.on('append-new-worker-data-to-peoples-enum-asynchronous', (event, newworkerdata) => {
    fs.appendFile(peopleEnumFilePath, '\n' + JSON.stringify(newworkerdata), (err) => {
      if (err) {
        console.error('Error appending worker enum:', err.message)
      }
    })
  })

  ipcMain.on(
    'append-new-department-data-to-department-enum-asynchronous',
    (event, newdepartmentdata) => {
      fs.appendFile(departmentEnumFilePath, '\n' + JSON.stringify(newdepartmentdata), (err) => {
        if (err) {
          console.error('Error appending department enum:', err.message)
        }
      })
      event.reply(
        'append-new-department-data-to-department-enum-asynchronous-reply',
        `${JSON.stringify(newdepartmentdata)} appended to file successfully!`
      )
    }
  )

  ipcMain.handle(
    'save-despatch-table-data-asynchronous',
    async (event, updatedtabledata, currentPageNumber) => {
      const dataToWrite = updatedtabledata.map((item) => JSON.stringify(item)).join('\n')

      try {
        await fsPromises.mkdir(path.dirname(tempDespatchTableSaveDataFilePath), { recursive: true })
        await fsPromises.writeFile(tempDespatchTableSaveDataFilePath, dataToWrite, 'utf8')
        try {
          await fsPromises.rename(
            tempDespatchTableSaveDataFilePath,
            despatchTableDataFilePath + `_page_${currentPageNumber}.txt`
          )
        } catch (error) {
          console.error('Error replacing original table data file:', error.message)
          return error.message
        }
      } catch (err) {
        console.error('Error writing to temp table data file:', err.message)
        return err.message
      }

      return 'Table data saved successfully!'
    }
  )

  ipcMain.handle('save-pub-sub-table-data-asynchronous', async (event, pubsubtabledata) => {
    const dataToWrite = pubsubtabledata.map((item) => JSON.stringify(item)).join('\n')

    try {
      await fsPromises.mkdir(path.dirname(pubSubTableDataPath), { recursive: true })
      await fsPromises.writeFile(tempPubSubTableDataPath, dataToWrite, 'utf8')

      try {
        await fsPromises.rename(tempPubSubTableDataPath, pubSubTableDataPath)
        return 'PubSub table data saved successfully!'
      } catch (error) {
        console.error('Error replacing original PubSub table data file:', error.message)
        return error.message
      }
    } catch (err) {
      console.error('Error writing to temp file during PubSub save:', err.message)
      return err.message
    }
  })

  ipcMain.handle('delete-row', async (event, messageJsonString) => {
    try {
      try {
        await fsPromises.access(pubSubTableDataPath)
      } catch {
        return true
      }

      const targetRow = JSON.parse(messageJsonString)
      const targetId = targetRow.id

      const fileContent = await fsPromises.readFile(pubSubTableDataPath, 'utf8')
      const lines = fileContent.split('\n').filter((line) => line.trim() !== '')
      const remainingRows = []
      let deletionSuccessful = false

      for (const line of lines) {
        const parsedItem = JSON.parse(line)

        if (parsedItem.id === targetId) {
          deletionSuccessful = true
          continue
        }
        remainingRows.push(parsedItem)
      }

      if (!deletionSuccessful) {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Row Not Found',
          message: `Could not find a row matching ID: ${targetId} to delete.`,
          buttons: ['OK']
        })
        return false
      }

      const dataToWrite = remainingRows.map((item) => JSON.stringify(item)).join('\n')
      await fsPromises.writeFile(tempPubSubTableDataPath, dataToWrite, 'utf8')
      await fsPromises.rename(tempPubSubTableDataPath, pubSubTableDataPath)

      dialog.showMessageBox({
        type: 'info',
        title: 'Success',
        message: `Row with ID ${targetId} was safely deleted and saved!`,
        buttons: ['OK']
      })
      return true
    } catch (error) {
      console.error('Failed to handle row deletion backend processing:', error.message)
      dialog.showErrorBox('System Error', `An error occurred during deletion: ${error.message}`)
      return false
    }
  })

  ipcMain.handle('load-pub-sub-table-data-asynchronous', async () => {
    try {
      const data = await fsPromises.readFile(pubSubTableDataPath, 'utf8')
      const lines = data.split('\n').filter((line) => line.trim() !== '')
      const tableData = lines.map((line) => JSON.parse(line))
      return tableData
    } catch (error) {
      console.error('Error reading/parsing PubSub table data file:', error.message)
      return []
    }
  })

  ipcMain.handle('add-new-empty-despatch-page', async () => {
    const newTotalNumberOfPages = (await getTotalNumberOfPages()).toNumber() + 1
    await fsPromises.copyFile(
      emptyDespatchTablePageFilePath,
      despatchTableDataFilePath + `_page_${newTotalNumberOfPages}.txt`
    )
    const newTotalNumberOfRows = await getTotalNumberOfRows(rowsPerPage)

    return { newTotalNumberOfRows: newTotalNumberOfRows, lastPage: newTotalNumberOfPages }
  })

  ipcMain.handle('get-total-number-of-rows', async () => {
    const totalNumberOfRows = await getTotalNumberOfRows(rowsPerPage)
    return totalNumberOfRows
  })

  ipcMain.handle('load-despatch-table-data-asynchronous', async (event, currentpagenumber) => {
    try {
      const data = await fsPromises.readFile(
        despatchTableDataFilePath + `_page_${currentpagenumber}.txt`,
        'utf8'
      )
      const lines = data.split('\n').filter((line) => line.trim() !== '')
      const tableData = lines.map((line) => JSON.parse(line))

      return tableData
    } catch (error) {
      return []
    }
  })

  ipcMain.handle('get-total-number-of-receive-rows', async () => {
    const totalNumberOfReceiveRows = await getTotalNumberOfReceiveRows(rowsPerPage)
    return totalNumberOfReceiveRows
  })

  ipcMain.handle('get-last-receive-page', async () => {
    const lastReceivePage = (await getTotalNumberOfReceivePages()).toNumber() + 1
    return lastReceivePage
  })

  ipcMain.handle('add-new-empty-receive-page', async (event, rowToInsert) => {
    try {
      const newTotalNumberOfReceivePages = (await getTotalNumberOfReceivePages()).toNumber() + 1
      const newPageFilePath =
        receiveTablePagedDataFilePath + `_page_${newTotalNumberOfReceivePages}.txt`

      await fsPromises.copyFile(emptyReceiveTablePageFilePath, newPageFilePath)

      if (rowToInsert) {
        const data = await fsPromises.readFile(newPageFilePath, 'utf8')
        const rows = data
          .split('\n')
          .filter((l) => l.trim() !== '')
          .map((l) => JSON.parse(l))

        if (rows.length > 0) {
          rows[0] = { ...rowToInsert, id: rows[0].id }
        }

        const dataToWrite = rows.map((r) => JSON.stringify(r)).join('\n')
        await fsPromises.writeFile(tempReceiveTableSaveDataFilePath, dataToWrite, 'utf8')
        await fsPromises.rename(tempReceiveTableSaveDataFilePath, newPageFilePath)
      }

      const newTotalNumberOfReceiveRows = await getTotalNumberOfReceiveRows(rowsPerPage)

      return {
        newTotalNumberOfRows: newTotalNumberOfReceiveRows,
        lastPage: newTotalNumberOfReceivePages
      }
    } catch (error) {
      console.error('add-new-empty-receive-page failed:', error.message)
      return null
    }
  })

  ipcMain.handle('publish-row-to-receive-table', async (event, rowToInsert, isTableRefresh) => {
    const isEmptyReceiveRow = (row) =>
      !row.dateofreceived?.trim() &&
      !row.towhomreceived?.trim() &&
      !row.dateofletter?.trim() &&
      !row.subject?.trim() &&
      !row.receiver?.trim()

    try {
      const totalNumberOfReceivePages = (await getTotalNumberOfReceivePages()).toNumber()

      for (let page = 1; page <= totalNumberOfReceivePages; page++) {
        const pageFilePath = receiveTablePagedDataFilePath + `_page_${page}.txt`

        let data
        try {
          data = await fsPromises.readFile(pageFilePath, 'utf8')
        } catch {
          continue
        }

        const rows = data
          .split('\n')
          .filter((l) => l.trim() !== '')
          .map((l) => JSON.parse(l))
        const overwriteIndex = rows.findIndex(
          (r) =>
            r.iDOnDespatchTable === rowToInsert.iDOnDespatchTable &&
            r.subscriptionNameOrId === rowToInsert.subscriptionNameOrId
        )

        if (overwriteIndex !== -1) {
          rows[overwriteIndex] = { ...rowToInsert, id: rows[overwriteIndex].id }

          const dataToWrite = rows.map((r) => JSON.stringify(r)).join('\n')
          await fsPromises.writeFile(tempReceiveTableSaveDataFilePath, dataToWrite, 'utf8')
          await fsPromises.rename(tempReceiveTableSaveDataFilePath, pageFilePath)

          !isTableRefresh && scheduleReceiveDriveSync(page, pageFilePath)
          return { pageNumber: page, newTotalNumberOfRows: null }
        }
      }

      for (let page = 1; page <= totalNumberOfReceivePages; page++) {
        const pageFilePath = receiveTablePagedDataFilePath + `_page_${page}.txt`

        let data
        try {
          data = await fsPromises.readFile(pageFilePath, 'utf8')
        } catch {
          continue
        }

        const rows = data
          .split('\n')
          .filter((l) => l.trim() !== '')
          .map((l) => JSON.parse(l))
        const emptyIndex = rows.findIndex((row) => isEmptyReceiveRow(row))

        if (emptyIndex !== -1) {
          rows[emptyIndex] = { ...rowToInsert, id: rows[emptyIndex].id }

          const dataToWrite = rows.map((r) => JSON.stringify(r)).join('\n')
          await fsPromises.writeFile(tempReceiveTableSaveDataFilePath, dataToWrite, 'utf8')
          await fsPromises.rename(tempReceiveTableSaveDataFilePath, pageFilePath)

          !isTableRefresh && scheduleReceiveDriveSync(page, pageFilePath)
          return { pageNumber: page, newTotalNumberOfRows: null }
        }
      }

      const newPageNumber = totalNumberOfReceivePages + 1
      const newPageFilePath = receiveTablePagedDataFilePath + `_page_${newPageNumber}.txt`

      await fsPromises.copyFile(emptyReceiveTablePageFilePath, newPageFilePath)

      const newPageData = await fsPromises.readFile(newPageFilePath, 'utf8')
      const newPageRows = newPageData
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l))

      if (newPageRows.length > 0) {
        newPageRows[0] = { ...rowToInsert, id: newPageRows[0].id }
      }

      const dataToWrite = newPageRows.map((r) => JSON.stringify(r)).join('\n')
      await fsPromises.writeFile(tempReceiveTableSaveDataFilePath, dataToWrite, 'utf8')
      await fsPromises.rename(tempReceiveTableSaveDataFilePath, newPageFilePath)

      const newTotalNumberOfReceiveRows = await getTotalNumberOfReceiveRows(rowsPerPage)

      !isTableRefresh && scheduleReceiveDriveSync(newPageNumber, newPageFilePath)
      return { pageNumber: newPageNumber, newTotalNumberOfRows: newTotalNumberOfReceiveRows }
    } catch (error) {
      console.error('publish-row-to-receive-table failed:', error.message)
      return null
    }
  })

  ipcMain.handle('get-total-number-of-despatch-pages', async () => {
    const totalPages = await getTotalNumberOfPages()
    return totalPages ? totalPages.toNumber() : 0
  })

  ipcMain.handle('load-receive-table-data-asynchronous', async (event, currentpagenumber) => {
    try {
      const data = await fsPromises.readFile(
        receiveTablePagedDataFilePath + `_page_${currentpagenumber}.txt`,
        'utf8'
      )
      const lines = data.split('\n').filter((line) => line.trim() !== '')
      const tableData = lines.map((line) => JSON.parse(line))
      return tableData
    } catch (error) {
      return []
    }
  })

  ipcMain.handle(
    'save-receive-table-data-asynchronous',
    async (event, updatedtabledata, currentPageNumber) => {
      const dataToWrite = updatedtabledata.map((item) => JSON.stringify(item)).join('\n')

      try {
        await fsPromises.mkdir(path.dirname(tempReceiveTableSaveDataFilePath), { recursive: true })
        await fsPromises.writeFile(tempReceiveTableSaveDataFilePath, dataToWrite, 'utf8')
        try {
          await fsPromises.rename(
            tempReceiveTableSaveDataFilePath,
            receiveTablePagedDataFilePath + `_page_${currentPageNumber}.txt`
          )
        } catch (error) {
          console.error('Error replacing original receive table data file:', error.message)
          return error.message
        }
      } catch (err) {
        console.error('Error writing to temp receive table data file:', err.message)
        return err.message
      }

      return 'Receive table data saved successfully!'
    }
  )

  ipcMain.handle('load-department-enum-data-asynchronous', async () => {
    try {
      const data = await fsPromises.readFile(departmentEnumFilePath, 'utf8')
      const lines = data.split('\n').filter((line) => line.trim() !== '')
      const departmentOptionsEnum = lines.map((line) => JSON.parse(line))
      departmentOptionsEnum.sort((a, b) => {
        if (a.value.startsWith('+ Add New')) return -1
        return a.label.localeCompare(b.label)
      })
      return departmentOptionsEnum
    } catch (error) {
      console.error('Error reading/parsing department options enum file:', error.message)
      return []
    }
  })

  ipcMain.handle('load-people-enum-data-asynchronous', async () => {
    try {
      const data = await fsPromises.readFile(peopleEnumFilePath, 'utf8')
      const lines = data.split('\n').filter((line) => line.trim() !== '')
      const peopleOptionsEnum = lines.map((line) => JSON.parse(line))
      peopleOptionsEnum.sort((a, b) => {
        if (a.value.startsWith('+ Add New')) return -1
        return a.label.localeCompare(b.label)
      })
      return peopleOptionsEnum
    } catch (error) {
      console.error('Error reading/parsing people options enum file:', error.message)
      return []
    }
  })

  ipcMain.handle('delete-department-enum-option', async (event, valueToDelete) => {
    try {
      const data = await fsPromises.readFile(departmentEnumFilePath, 'utf8')
      const remaining = data
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line))
        .filter((item) => item.value !== valueToDelete)
      await fsPromises.writeFile(
        departmentEnumFilePath,
        remaining.map((item) => JSON.stringify(item)).join('\n'),
        'utf8'
      )
      return true
    } catch (error) {
      console.error('Failed to delete department option:', error.message)
      return false
    }
  })

  ipcMain.handle('delete-people-enum-option', async (event, valueToDelete) => {
    try {
      const data = await fsPromises.readFile(peopleEnumFilePath, 'utf8')
      const remaining = data
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line))
        .filter((item) => item.value !== valueToDelete)
      await fsPromises.writeFile(
        peopleEnumFilePath,
        remaining.map((item) => JSON.stringify(item)).join('\n'),
        'utf8'
      )

      try {
        const workerRawData = await fsPromises.readFile(newWorkerDataPath, 'utf8')
        const workerLines = workerRawData.split('\n').filter((line) => line.trim() !== '')
        const remainingWorkers = []
        let foundWorkerName = null

        for (const line of workerLines) {
          const parsed = JSON.parse(line)

          if (
            parsed.newWorkerName &&
            parsed.newWorkerName.toLowerCase() === valueToDelete.toLowerCase()
          ) {
            foundWorkerName = parsed.newWorkerName
          } else {
            remainingWorkers.push(parsed)
          }
        }

        await fsPromises.writeFile(
          newWorkerDataPath,
          remainingWorkers.map((item) => JSON.stringify(item)).join('\n'),
          'utf8'
        )

        if (foundWorkerName) {
          const signatureImagePath = path.join(newWorkerSignaturesPath, `${foundWorkerName}.png`)
          try {
            await fsPromises.unlink(signatureImagePath)
          } catch (imgError) {
            if (imgError.code !== 'ENOENT') {
              console.error('Error deleting worker signature image file:', imgError.message)
            }
          }
        }
      } catch (workerFileErr) {
        console.error('Error cleaning up new-worker-data.txt:', workerFileErr.message)
      }

      return true
    } catch (error) {
      console.error('Failed to delete people option and associated files:', error.message)
      return false
    }
  })

  createWindow()
  createDepartmentWindow()
  createWorkerWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
