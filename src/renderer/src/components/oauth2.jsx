import ArrowLaunchIcon from '@mui/icons-material/Launch'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import { useContext, useEffect, useState } from 'react'
import { AppContext } from './state-provider'

const Oauth2 = ({ authUrl }) => {
  const [currentTopic, setCurrentTopic] = useState('')
  const [currentSubscription, setCurrentSubscription] = useState('')
  const [topicOverride, setTopicOverride] = useState('')
  const [subscriptionOverride, setSubscriptionOverride] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const {
    setIsLoading,
    authCode,
    setAuthCode,
    isTokenCreatedAndSavedSuccessfully,
    setIsTokenCreatedAndSavedSuccessfully,
    setIsLoadingForPubSubTable
  } = useContext(AppContext)

  useEffect(() => {
    if (authCode) {
      console.log('An authorization code has been entered.')
    }
  }, [authCode])

  useEffect(() => {
    const loadCurrentConfig = async () => {
      console.log('Loading current Pub/Sub configuration...')
      try {
        const config = await window.electron.ipcRenderer.invoke('get-current-pubsub-config')
        if (config) {
          setCurrentTopic(config.currentTopic)
          setCurrentSubscription(config.currentSubscription)
          console.log('Pub/Sub configuration loaded successfully.')
        }
      } catch (error) {
        console.error('Error: Failed to load Pub/Sub configuration:', error)
      }
    }
    loadCurrentConfig()
  }, [])
  const formatPubSubId = (id) => {
    let clean = id.trim()
    if (!clean) return ''

    if (!/^[a-zA-Z]/.test(clean)) {
      clean = `sub_${clean}`
    }

    if (clean.length < 3) {
      clean = clean.padEnd(3, '_')
    }

    return clean.slice(0, 255)
  }
  async function handleClick() {
    console.log('Verification started. Please wait...')
    setIsVerifying(true)
    setIsLoadingForPubSubTable(true)
    setIsLoading(true)

    console.log('Sending authorization code to connect account...')
    try {
      const Aouth2Clieent = await window.electron.ipcRenderer.invoke('save-Token', authCode)

      if (Aouth2Clieent) {
        console.log('Success: Account connected and token saved!')
        setIsTokenCreatedAndSavedSuccessfully(true)

        if (topicOverride.trim() || subscriptionOverride.trim()) {
          console.log('Saving custom Pub/Sub overrides...')
          try {
            await window.electron.ipcRenderer.invoke(
              'save-pubsub-overrides',
              formatPubSubId(topicOverride),
              formatPubSubId(subscriptionOverride)
            )
            console.log('Overrides saved successfully.')
          } catch (error) {
            console.error('Error: Failed to save overrides:', error)
          }
        }
      } else {
        console.error('Error: Main process returned false. The code might be invalid or expired.')
      }
    } catch (error) {
      console.error('Error: A problem occurred while verifying the token:', error)
    }

    setIsVerifying(false)
    console.log('Verification process finished.')
  }

  return (
    <div className="flex flex-col bg-white w-full max-w-xl mx-auto p-8 rounded-xl shadow-md border border-slate-100">
      {/* Header section */}
      <div className="flex flex-col mb-8 border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          Google Drive Authorization
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Connect this application securely to Google Cloud.
        </p>
      </div>

      {/* STEP 1: Link Launcher */}
      <div className="flex flex-col mb-8 bg-[#f8faff] p-5 rounded-lg border border-blue-50">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1768da] text-xs font-bold text-white">
            1
          </span>
          <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Request Code
          </span>
        </div>
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Click the official secure authorization link below. This will open your web browser where
          you can sign in with your approved Ministry Google account.
        </p>

        {/* The Link Container */}
        <div className="flex">
          <Link
            href={authUrl}
            target="_blank"
            rel="noopener noreferrer"
            underline="none"
            className="inline-flex items-center gap-2 text-[#1768da] hover:text-[#114fa8] font-semibold text-base transition-colors duration-200 group"
          >
            <span>Open Google Authentication Login Screen</span>
            <ArrowLaunchIcon
              className="text-sm transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              sx={{ fontSize: 18 }}
            />
          </Link>
        </div>
      </div>
      {/* STEP 2: Token Paste Area */}
      <div className="flex flex-col mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1768da] text-xs font-bold text-white">
            2
          </span>
          <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Submit Token
          </span>
        </div>
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Once signed in, Google will show you a long code. Copy that code perfectly and paste it
          into the field below.
        </p>

        {/* The Text Field input layout */}
        <TextField
          fullWidth
          label="Authorization Access Code"
          variant="outlined"
          placeholder="Paste copied code here"
          onChange={(e) => setAuthCode(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#fafafa',
              '&:hover fieldset': {
                borderColor: '#1768da'
              }
            }
          }}
        />
      </div>

      {/* STEP 3: Pub/Sub Debug Overrides */}
      <div className="flex flex-col mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1768da] text-xs font-bold text-white">
            3
          </span>
          <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Pub/Sub Configuration (Optional)
          </span>
        </div>
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Shown below are the currently active Pub/Sub topic and subscription IDs. Only fill in an
          override if you need to change one. Leave blank to keep the current value.
        </p>

        <div className="flex flex-col gap-4">
          <TextField
            fullWidth
            label="Current Topic ID"
            variant="outlined"
            value={currentTopic}
            disabled
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f1f5f9'
              }
            }}
          />
          <TextField
            fullWidth
            label="Override Topic ID"
            variant="outlined"
            placeholder="Leave blank to keep current"
            onChange={(e) => setTopicOverride(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#fafafa',
                '&:hover fieldset': {
                  borderColor: '#1768da'
                }
              }
            }}
          />

          <TextField
            fullWidth
            label="Current Subscription ID"
            variant="outlined"
            value={currentSubscription}
            disabled
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f1f5f9'
              }
            }}
          />
          <TextField
            fullWidth
            label="Override Subscription ID"
            variant="outlined"
            placeholder="Leave blank to keep current"
            onChange={(e) => setSubscriptionOverride(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#fafafa',
                '&:hover fieldset': {
                  borderColor: '#1768da'
                }
              }
            }}
          />
        </div>
      </div>

      {/* Bottom Action bar */}
      <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-5">
        <Button
          variant="contained"
          onClick={handleClick}
          disabled={!authCode.trim() || isTokenCreatedAndSavedSuccessfully || isVerifying}
          sx={{
            textTransform: 'none',
            fontWeight: 'bold',
            paddingX: 4,
            backgroundColor: '#1768da',
            '&:hover': {
              backgroundColor: '#114fa8'
            }
          }}
        >
          {isVerifying ? 'Verifying...' : 'Verify Account Connection'}
        </Button>
      </div>
    </div>
  )
}

export default Oauth2
