import GlobalStyles from '@mui/material/GlobalStyles'
import { StyledEngineProvider } from '@mui/material/styles'
import log from 'electron-log/renderer'
import { createRoot } from 'react-dom/client'

window.console.log = log.log
window.console.error = log.error
window.console.warn = log.warn
window.console.info = log.info

import 'handsontable/styles/handsontable.css'
import 'handsontable/styles/ht-theme-main.css'
import './assets/index.css'
import './assets/main.css'

import App from './App.jsx'
import { AppProvider } from './components/state-provider.jsx'

function MainAppRunner() {
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StyledEngineProvider injectFirst>
    <GlobalStyles styles={{}} />

    <AppProvider>
      <MainAppRunner />
    </AppProvider>
  </StyledEngineProvider>
)
