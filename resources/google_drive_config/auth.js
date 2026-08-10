import { is } from '@electron-toolkit/utils'

const { google } = require('googleapis')
const fs = require('fs/promises')
const path = require('path')

const CREDENTIALS_PATH = is.dev
  ? path.join(__dirname, '../../resources/google_drive_config/credentials.json')
  : path.join(process.resourcesPath, 'google_drive_config/credentials.json')

const TOKEN_PATH = is.dev
  ? path.join(__dirname, '../../resources/google_drive_config/token.json')
  : path.join(process.resourcesPath, 'google_drive_config/token.json')

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/pubsub'
]

export async function loadAuthClient() {
  try {
    const credentials = await fs.readFile(CREDENTIALS_PATH, 'utf-8')
    console.log('Credentials loaded successfully.')
    const webRedirectUri = 'https://mhamzagunu4nss.github.io/DocuTrackTest1/callback.html'
    const { client_secret, client_id, project_id } = JSON.parse(credentials).web
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, webRedirectUri)
    return oAuth2Client
  } catch (err) {
    console.log('Error loading credentials:', err)
    return null
  }
}

export async function getProjectId() {
  try {
    const credentials = await fs.readFile(CREDENTIALS_PATH, 'utf-8')
    console.log('Credentials loaded successfully for picking up project id.')

    const { project_id } = JSON.parse(credentials).web
    console.log('project id loaded successfully.')
    return project_id
  } catch (err) {
    console.log('Error loading project id:', err.message)
    return null
  }
}

export function generateAuthUrl(oAuth2Client) {
  console.log('Generating auth URL with OAuth2 client:', oAuth2Client)
  console.log('No existing token found, need to generate a new one.')
  const webRedirectUri = 'https://mhamzagunu4nss.github.io/DocuTrackTest1/callback.html'
  try {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      redirect_uri: webRedirectUri
    })
    console.log('Authorize this app by visiting this url:', authUrl)
    return authUrl
  } catch (err) {
    console.log('Error generating auth URL:', err)
    return null
  }
}

export async function setCredentials(oAuth2Client) {
  try {
    const token = await fs.readFile(TOKEN_PATH, 'utf-8')
    console.log('Existing token found, using it for authentication.')
    await oAuth2Client.setCredentials(JSON.parse(token))
    return oAuth2Client
  } catch (err) {
    console.log('No existing token found, user needs to authenticate.')
    return null
  }
}

export async function saveToken(oAuth2Client, code) {
  console.log('Saving token with code:', code)

  try {
    const { tokens } = await oAuth2Client.getToken(code)

    await oAuth2Client.setCredentials(tokens)

    await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), 'utf-8')
    console.log('Token stored to', TOKEN_PATH)

    return true
  } catch (err) {
    console.log('Error retrieving or saving access token:', err.message)
    return null
  }
}
