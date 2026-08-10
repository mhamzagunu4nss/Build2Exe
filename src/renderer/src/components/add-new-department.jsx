/* eslint-disable react/prop-types */
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useContext, useEffect, useRef } from 'react'
import { AppContext } from './state-provider'

const AddNewDepartmentDialogBox = ({ open = true, handleClose }) => {
  const { isLoading, setIsLoading } = useContext(AppContext)
  const formRef = useRef(null)

  useEffect(() => {
    if (open) {
      setIsLoading(false)
    }
  }, [open, setIsLoading])

  const clearForm = () => {
    if (formRef.current) {
      formRef.current.reset()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const formJson = Object.fromEntries(formData.entries())
    const departmentName = formJson.departmentName?.trim()

    if (!departmentName) return

    try {
      await window.electron.ipcRenderer.invoke('save-department-from-window', departmentName)

      clearForm()
      handleClose?.()
      await window.electron.ipcRenderer.invoke('close-department-window')
    } catch (error) {
      console.error('Error: Failed to save department:', error)
    }
  }

  const handleCancelClick = async () => {
    if (isLoading) return
    clearForm()
    handleClose?.()
    try {
      await window.electron.ipcRenderer.invoke('close-department-window')
    } catch (err) {
      console.error('Error: Failed to close department window:', err)
    }
  }

  const handleDialogClose = (event, reason) => {
    if (reason === 'backdropClick') return
    handleCancelClick()
  }

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      fullWidth
      maxWidth="sm"
      keepMounted
      PaperProps={{
        sx: { p: 1 }
      }}
    >
      <DialogTitle sx={{ fontWeight: 'bold', pb: 1 }}>Add New Department</DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <DialogContentText sx={{ mb: 2 }}>
          Enter the name of the new department to add it to the system list.
        </DialogContentText>

        <form onSubmit={handleSubmit} id="add-dept-form-name" ref={formRef}>
          <TextField
            autoFocus
            required
            disabled={isLoading}
            margin="dense"
            id="departmentName"
            name="departmentName"
            label="Department Name"
            type="text"
            fullWidth
            variant="outlined"
          />
        </form>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={handleCancelClick} color="inherit" disabled={isLoading} type="button">
          Cancel
        </Button>

        <Button
          type="submit"
          form="add-dept-form-name"
          variant="contained"
          disabled={isLoading}
          sx={{ backgroundColor: '#1768da' }}
        >
          {isLoading ? 'Saving...' : 'Add Department'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AddNewDepartmentDialogBox
