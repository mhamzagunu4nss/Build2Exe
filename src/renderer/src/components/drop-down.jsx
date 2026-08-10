import Option from '@mui/joy/Option'
import Select from '@mui/joy/Select'
import { useContext } from 'react'
import { AppContext } from './state-provider'

export default function Mode() {
  const { viewMode, setViewMode, setIsLoading } = useContext(AppContext)

  const handleChange = (event, newValue) => {
    console.log(`Switching application view mode to: ${newValue}`)
    setIsLoading(true)
    setViewMode(newValue)
  }

  return (
    <Select value={viewMode} onChange={handleChange}>
      <Option value="Despatch">Despatch</Option>
      <Option value="Receive">Receive</Option>
    </Select>
  )
}
