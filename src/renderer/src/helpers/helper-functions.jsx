import { app, dialog } from 'electron'
import {
  getProjectId,
  loadAuthClient,
  setCredentials
} from '../../../../resources/google_drive_config/auth'

import { is } from '@electron-toolkit/utils'
import Big from 'big.js'
import path from 'path'

const fs = require('fs').promises
const { google } = require('googleapis')
const { PubSub } = require('@google-cloud/pubsub')

const SUBSCRIPTION_NAME_OR_ID_PATH = path.join(
  app.getPath('userData'),
  'subscription-name-or-id.json'
)

const TOPIC_NAME_OR_ID_PATH = path.join(app.getPath('userData'), 'topic-name-or-id.json')

export const UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH = path.join(
  app.getPath('userData'),
  'receiveTableId.json'
)

const despatchTableDir = is.dev
  ? path.join(__dirname, '../../resources/despatch_table')
  : path.join(process.resourcesPath, 'despatch_table')

const receiveTableDir = is.dev
  ? path.join(__dirname, '../../resources/receive_table')
  : path.join(process.resourcesPath, 'receive_table')

let pubSubInstance = null
let topicInstance = null

let currentSubscription = null
let localSubscriptionNameOrId = null
const topicNameOrId = 'projects/docu-track-demo/topics/docu-track-changes-watch-topic'

export async function getTopicNameOrId() {
  try {
    const data = await fs.readFile(TOPIC_NAME_OR_ID_PATH, 'utf-8')
    return JSON.parse(data).topicNameOrId
  } catch (error) {
    return topicNameOrId
  }
}

export async function saveTopicOverride(overrideValue) {
  try {
    await fs.writeFile(
      TOPIC_NAME_OR_ID_PATH,
      JSON.stringify({ topicNameOrId: overrideValue }),
      'utf-8'
    )
    return true
  } catch (error) {
    console.error('Failed to save topic override:', error.message)
    return false
  }
}

export async function saveSubscriptionOverride(overrideValue) {
  try {
    const timeStamp = Date.now()
    const uniqueSubscriptionNameOrId = `${overrideValue}-${timeStamp}-sub`

    await fs.writeFile(
      SUBSCRIPTION_NAME_OR_ID_PATH,
      JSON.stringify({ subscriptionNameOrId: uniqueSubscriptionNameOrId }),
      'utf-8'
    )
    return uniqueSubscriptionNameOrId
  } catch (error) {
    console.error('Failed to save subscription override:', error.message)
    return null
  }
}

export async function getOrCreateSubscriptionNameOrId() {
  try {
    const data = await fs.readFile(SUBSCRIPTION_NAME_OR_ID_PATH, 'utf-8')
    return JSON.parse(data).subscriptionNameOrId
  } catch (error) {
    const timeStamp = Date.now()
    const subscriptionNameOrId = `projects/docu-track-demo/subscriptions/docu-track-changes-watch-topic-${timeStamp}-sub`

    await fs.writeFile(
      SUBSCRIPTION_NAME_OR_ID_PATH,
      JSON.stringify({ subscriptionNameOrId }),
      'utf-8'
    )
    return subscriptionNameOrId
  }
}

export async function getPubSubClient(oAuth2Client) {
  if (pubSubInstance) {
    return pubSubInstance
  }

  const projectId = await getProjectId()
  pubSubInstance = new PubSub({
    projectId: projectId,
    authClient: oAuth2Client
  })

  return pubSubInstance
}

export async function getTopic(oAuth2Client) {
  if (topicInstance) return topicInstance
  const pubSubClient = await getPubSubClient(oAuth2Client)
  const retrievedTopicNameOrId = await getTopicNameOrId()
  topicInstance = pubSubClient.topic(retrievedTopicNameOrId)
  return topicInstance
}

export async function createSubscription(oAuth2Client) {
  try {
    const pubsub = await getPubSubClient(oAuth2Client)
    const retrievedTopicNameOrId = await getTopicNameOrId()
    const topicInstance = pubsub.topic(retrievedTopicNameOrId)
    const [topic] = await topicInstance.get({ autoCreate: true })

    const subscriptionNameOrId = await getOrCreateSubscriptionNameOrId()
    localSubscriptionNameOrId = subscriptionNameOrId

    await topic.createSubscription(subscriptionNameOrId)
    return subscriptionNameOrId
  } catch (error) {
    if (error.code === 6) {
      return await getOrCreateSubscriptionNameOrId()
    }

    if (error.code === 4 || (error.message && error.message.includes('DEADLINE_EXCEEDED'))) {
      return await getOrCreateSubscriptionNameOrId()
    }

    console.error('Error in Setup:', error.message)
    return null
  }
}

export async function publishMessage(oAuth2Client, data) {
  const parsedData = typeof data === 'string' ? JSON.parse(data) : data

  const messageWithAddedSubscriptionNameOrId = {
    ...parsedData,
    subscriptionNameOrId: localSubscriptionNameOrId
  }

  const dataBuffer = Buffer.from(JSON.stringify(messageWithAddedSubscriptionNameOrId))
  const topic = await getTopic(oAuth2Client)

  try {
    await topic.publishMessage({ data: dataBuffer })
    return
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`)
    return
  }
}

export async function listenForMessages(mainWindow, subscriptionNameOrId, oAuth2Client) {
  if (!subscriptionNameOrId) {
    console.log('PubSub update skipped: No subscription ID provided.')
    return
  }
  if (currentSubscription) {
    console.log('PubSub update skipped: A listener is already active.')
    return
  }

  console.log(`Setting up PubSub listener for subscription: ${subscriptionNameOrId}...`)
  const pubSubClient = await getPubSubClient(oAuth2Client)
  currentSubscription = pubSubClient.subscription(subscriptionNameOrId)
  console.log(`Successfully listening for updates on subscription: ${subscriptionNameOrId}`)

  currentSubscription.on('message', (message) => {
    const rawPayload = message.data.toString()
    console.log(`\nNew message received from server (Message ID: ${message.id})`)

    if (rawPayload && rawPayload !== 'null') {
      const parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload

      const { signature, ...rest } = parsed
      console.log('Received row data (Signature omitted):', rest)

      if (localSubscriptionNameOrId !== parsed.subscriptionNameOrId) {
        try {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (parsed.ReceiveStatus === 'true') {
              console.log('Action: Removing row from table based on remote update.')
              mainWindow.webContents.send('raw-remove-row', {
                id: parsed.id,
                subscriptionNameOrId: parsed.subscriptionNameOrId
              })
            } else {
              console.log('Action: Adding new row to table based on remote update.')
              mainWindow.webContents.send('raw-append-row', parsed)
            }
          } else {
            console.log('Main window is closed. Skipping table update.')
          }
        } catch (parseError) {
          console.error('Failed to process incoming row update:', parseError.message)
        }
      } else {
        console.log('Ignored message because it originated from this local session.')
      }
    } else {
      console.log('Received empty message payload.')
    }

    console.log(`Acknowledging processed message ID: ${message.id}`)
    message.ack()
  })
}

export function stopListening() {
  if (currentSubscription) {
    currentSubscription.removeAllListeners('message')
    currentSubscription = null
  }
}

export async function splitTableDataInToToChunks(updatedtabledata) {
  Big.DP = 0
  Big.RM = Big.roundUp
  const numberOfRows = new Big(updatedtabledata.length)
  const chunkSize = new Big(1000)
  const numberOfPages = numberOfRows.div(chunkSize)
  return numberOfPages
}

export async function getTotalNumberOfRows(rowsperpage) {
  try {
    Big.DP = 0
    Big.RM = Big.roundUp
    let totalNumberOfPages = await getTotalNumberOfPages()
    const totalNumberOfRows = totalNumberOfPages.times(rowsperpage)
    return totalNumberOfRows.toNumber()
  } catch (error) {
    console.error(error.message)
    return
  }
}

export async function getTotalNumberOfPages() {
  try {
    const files = await fs.readdir(despatchTableDir)
    const pageFiles = files.filter((f) => /^table-data_page_\d+\.txt$/.test(f))
    return new Big(pageFiles.length)
  } catch (error) {
    console.error(error.message)
    return
  }
}

export async function getTotalNumberOfReceivePages() {
  try {
    const files = await fs.readdir(receiveTableDir)
    const pageFiles = files.filter((f) => /^table-data_page_\d+\.txt$/.test(f))
    return new Big(pageFiles.length)
  } catch (error) {
    console.error(error.message)
    return
  }
}

export async function getTotalNumberOfReceiveRows(rowsperpage) {
  try {
    Big.DP = 0
    Big.RM = Big.roundUp
    let totalNumberOfReceivePages = await getTotalNumberOfReceivePages()
    const totalNumberOfReceiveRows = totalNumberOfReceivePages.times(rowsperpage)
    return totalNumberOfReceiveRows.toNumber()
  } catch (error) {
    console.error(error.message)
    return
  }
}

async function UploadReceivePageToDrive(pageNumber, pageFilePath) {
  try {
    let uploadedIdsMap = {}
    try {
      await fs.access(UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH)
      const data = await fs.readFile(UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH, 'utf-8')
      uploadedIdsMap = JSON.parse(data)
    } catch (error) {}

    let oAuth2Client = await loadAuthClient()
    if (!oAuth2Client) {
      return
    }
    oAuth2Client = await setCredentials(oAuth2Client)
    const drive = google.drive({ version: 'v3', auth: oAuth2Client })

    const dataToWrite = await fs.readFile(pageFilePath, 'utf8')
    let fileId = uploadedIdsMap[pageNumber]

    if (!fileId) {
      const fileMetadata = {
        name: `receive-table-data_page_${pageNumber}.txt`,
        parents: ['1hjjcOD9mQGyn3esSNw8He_Z2VcuyJgps']
      }
      const media = { mimeType: 'text/plain', body: dataToWrite }
      const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' })
      fileId = response.data.id

      uploadedIdsMap[pageNumber] = fileId
      await fs.writeFile(
        UPLOADED_RECEIVE_TABLE_ID_JSON_FILE_PATH,
        JSON.stringify(uploadedIdsMap),
        'utf-8'
      )
      dialog.showMessageBox({
        type: 'info',
        title: 'Receive Page Synced',
        message: `Receive page ${pageNumber} synced to Google Drive successfully!`
      })
    } else {
      await drive.files.update({ fileId, media: { mimeType: 'text/plain', body: dataToWrite } })
      dialog.showMessageBox({
        type: 'info',
        title: 'Receive Page Synced',
        message: `Receive page ${pageNumber} synced to Google Drive successfully!`
      })
    }
  } catch (error) {
    console.error(`syncReceivePageToDrive failed for page ${pageNumber}:`, error.message)
    dialog.showMessageBox({
      type: 'error',
      title: 'Receive Page Sync Failed',
      message: `Failed to sync receive page ${pageNumber} to Google Drive. Error: ` + error.message
    })
  }
}

let receiveDriveSyncTimers = {}

export const scheduleReceiveDriveSync = (pageNumber, pageFilePath) => {
  if (receiveDriveSyncTimers[pageNumber]) {
    clearTimeout(receiveDriveSyncTimers[pageNumber])
  }
  receiveDriveSyncTimers[pageNumber] = setTimeout(async () => {
    await UploadReceivePageToDrive(pageNumber, pageFilePath)
    delete receiveDriveSyncTimers[pageNumber]
  }, 8000)
}

export function isAuthRevokedError(error) {
  const msg = error?.message || ''
  const status = error?.code || error?.response?.status
  return (
    msg.includes('invalid_grant') ||
    msg.includes('invalid_token') ||
    status === 401 ||
    status === 403
  )
}
