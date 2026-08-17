import { app } from 'electron'
import path from 'path'

// This must be the very first thing imported in index.js, so that other
// files (auth.js, helper-functions.jsx) compute their userData-based paths
// AFTER the profile-specific folder has been set — not before.
const profileArg = process.argv.find((arg) => arg.startsWith('--profile='))
if (profileArg) {
  const profileName = profileArg.split('=')[1]
  const basePath = app.getPath('userData')
  app.setPath('userData', path.join(basePath, '..', `Docutrack-${profileName}`))
}
