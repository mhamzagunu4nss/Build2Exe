/* eslint-disable react/prop-types */
import { SignatureMaker } from '@docuseal/signature-maker-react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useContext, useEffect, useRef } from 'react'
import { AppContext } from './state-provider'

const AddNewWorkerDialogBox = ({ open = true, handleClose }) => {
  const { signatureBase64, setSignatureBase64, isLoading, setIsLoading, setIsRendered } =
    useContext(AppContext)

  const signatureRef = useRef(null)

  useEffect(() => {
    if (open) {
      setIsLoading(false)
      setIsRendered(true)
    }
  }, [open])

  const clearFormAndCanvas = () => {
    setSignatureBase64(null)

    if (signatureRef.current && typeof signatureRef.current.clear === 'function') {
      signatureRef.current.clear()
    }

    const formElement = document.getElementById('add-dept-form')
    if (formElement) {
      formElement.reset()
    }
  }

  useEffect(() => {
    const handleReply = async (event, response) => {
      console.log('New worker signature saved successfully response received.')

      clearFormAndCanvas()
      handleClose?.()

      try {
        await window.electron.ipcRenderer.invoke('close-worker-window')
      } catch (err) {
        console.error('Error: Failed to close worker window:', err)
      }
    }

    window.electron.ipcRenderer.on('save-new-worker-signature-reply', handleReply)

    return () => {
      window.electron.ipcRenderer.removeListener('save-new-worker-signature-reply', handleReply)
    }
  }, [handleClose])

  const handleSignatureChange = (event) => {
    setSignatureBase64(event.base64)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const formJson = Object.fromEntries(formData.entries())
    const workerName = formJson.newWorker?.trim()

    if (!workerName) {
      alert('Please enter a worker name.')
      return
    }

    if (!signatureBase64) {
      alert('Please draw your signature.')
      return
    }

    console.log(`Submitting new worker signature for: "${workerName}"...`)
    window.electron.ipcRenderer.send('save-new-worker-signature', {
      signatureBase64: signatureBase64,
      newWorkerName: workerName,
      skipDriveNotification: true
    })
  }

  const handleCancelClick = async () => {
    if (isLoading) return
    clearFormAndCanvas()
    handleClose?.()
    try {
      await window.electron.ipcRenderer.invoke('close-worker-window')
    } catch (err) {
      console.error('Error: Failed to close worker window:', err)
    }
  }

  const handleDialogClose = (event, reason) => {
    if (reason === 'backdropClick') return
    handleCancelClick()
  }

  return (
    <Dialog open={open} onClose={handleDialogClose} fullWidth keepMounted>
      <DialogTitle sx={{ fontWeight: 'bold' }}>Add New Worker</DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Enter the name of the new worker to add to the system list.
        </DialogContentText>

        <form onSubmit={handleSubmit} id="add-dept-form">
          <TextField
            autoFocus
            className="mb-10"
            required
            margin="dense"
            id="newWorker"
            name="newWorker"
            label="Worker Name"
            type="text"
            fullWidth
            variant="outlined"
            disabled={isLoading}
          />

          <div
            style={{
              display: open ? 'block' : 'none',
              pointerEvents: isLoading ? 'none' : 'auto',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            <SignatureMaker
              ref={signatureRef}
              withColorSelect={false}
              withTyped={false}
              withUpload={false}
              withSubmit={false}
              onChange={handleSignatureChange}
            />
          </div>
        </form>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleCancelClick} color="inherit" disabled={isLoading}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="add-dept-form"
          variant="contained"
          sx={{ backgroundColor: '#1768da' }}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Add New Worker'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AddNewWorkerDialogBox
