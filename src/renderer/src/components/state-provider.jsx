import { createContext, useEffect, useRef, useState } from 'react'

export const AppContext = createContext()

export const AppProvider = ({ children }) => {
  const [newDepartment, setNewDepartment] = useState(null)
  const [newWorker, setNewWorker] = useState(null)
  const [rowForDespatch, setRowForDespatch] = useState(null)
  const [rowForReceive, setRowForReceive] = useState(null)
  const [newValue, setNewValue] = useState(null)
  const [accessor, setAccessor] = useState(null)
  const [open, setOpen] = useState(false)
  const [openNewWorkerDialogBox, setOpenNewWorkerDialogBox] = useState(false)
  const [departmentEnumOptions, setDepartmentenumOptions] = useState([])
  const [peopleEnumOptions, setPeopleEnumOptions] = useState([])
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('docutrack-view-mode')
    return saved || 'Despatch'
  })
  const [despatchTableData, setDespatchTableRowData] = useState([])
  const [receiveTableData, setReceiveTableRowData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [signatureBase64, setSignatureBase64] = useState(null)
  const [hasDespatchTableDataBeenLoaded, setHasDespatchTableDataBeenLoaded] = useState(false)
  const [hasReceiveTableDataBeenLoaded, setHasReceiveTableDataBeenLoaded] = useState(false)
  const [hideDespatchTable, setHideDespatchTable] = useState(false)
  const [hideReceiveTable, setHideReceiveTable] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Loading Table Data...')
  const [isAuthenticatedWithGoogle, setIsAuthenticatedWithGoogle] = useState(true)
  const [isTokenCreatedAndSavedSuccessfully, setIsTokenCreatedAndSavedSuccessfully] =
    useState(false)

  const [isLoadingForPubSubTable, setIsLoadingForPubSubTable] = useState(true)
  const [loadingMessagePubSubTable, setLoadingMessagePubSubTable] =
    useState('Loading Table Data...')

  const [rowForPubSubTable, setRowForPubSubTable] = useState(null)
  const [newValueForPubSubTable, setNewValueForPubSubTable] = useState(null)
  const [accessorForPubSubTable, setAccessorForPubSubTable] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [receivePageNumber, setReceivePageNumber] = useState(1)
  const [totalNumberOfReceiveRows, setTotalNumberOfReceiveRows] = useState(0)
  const [totalNumberOfRows, setTotalNumberOfRows] = useState(0)
  const [pubSubTableData, setPubSubTableData] = useState([])
  const [authCode, setAuthCode] = useState('')
  const [isOnline, setIsOnline] = useState(false)
  const [pubSubTableHasData, setPubSubTableHasData] = useState(false)
  const [reMountDispatchComponent, setReMountDispatchComponent] = useState(false)
  const [reMountReceiveComponent, setReMountReceiveComponent] = useState(false)
  const [isDownloadingReceivePageData, setIsDownloadingReceivePageData] = useState(false)
  const [isDownloadingDispacthPageData, setIsDownloadingDispatchPageData] = useState(false)
  const receiveTableRef = useRef(null)
  const [isTableSettingsRefresh, setIsTableSettingRefresh] = useState(false)
  const [departmentToDelete, setDepartmentToDelete] = useState('')
  const [workerToDelete, setWorkerToDelete] = useState('')
  const [isRendered, setIsRendered] = useState(false)
  const isPublishingActive = useRef(false)

  const DEFAULT_TABLE_SETTINGS = {
    // Global Grid Features
    columnBorders: true,
    useHoverRowBackground: true,
    useOddEvenRowBackground: false,
    rowHeight: 40,
    columnResizing: true,
    columnReordering: true,

    receive_locked: false,
    onlineSyncEnabled: true,

    // Explicit Column Alignments...
    align_pubsub_dateofreceived: 'left',
    align_pubsub_registrynumber: 'left',
    align_pubsub_towhomreceived: 'left',
    align_pubsub_dateofletter: 'left',
    align_pubsub_numberofletter: 'left',
    align_pubsub_subject: 'left',
    align_pubsub_receiver: 'left',
    align_pubsub_remarks: 'left',
    align_pubsub_signature: 'left',

    exclude_pubsub_dateofreceived: false,
    exclude_pubsub_registrynumber: false,
    exclude_pubsub_towhomreceived: false,
    exclude_pubsub_dateofletter: false,
    exclude_pubsub_numberofletter: false,
    exclude_pubsub_subject: false,
    exclude_pubsub_receiver: false,
    exclude_pubsub_remarks: false,
    exclude_pubsub_signature: false,

    align_id: 'left',
    align_dateofdespatch: 'left',
    align_registrynumber: 'left',
    align_towhomsent: 'left',
    align_dateofletter: 'left',
    align_numberofletter: 'left',
    align_subject: 'left',
    align_despatcher: 'left',
    align_remarks: 'left',

    exclude_id: false,
    exclude_dateofdespatch: false,
    exclude_registrynumber: false,
    exclude_towhomsent: false,
    exclude_dateofletter: false,
    exclude_numberofletter: false,
    exclude_subject: false,
    exclude_despatcher: false,
    exclude_remarks: false,

    targetPagesToDownload: 'Current Page Only'
  }

  const [tableSettings, setTableSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('docutrack-table-settings')
      return saved ? { ...DEFAULT_TABLE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_TABLE_SETTINGS
    } catch {
      return DEFAULT_TABLE_SETTINGS
    }
  })

  useEffect(() => {
    const handleDepartmentRefresh = (event, newDept) => {
      setIsLoading(true)
      setIsLoadingForPubSubTable(true)
      setDepartmentenumOptions((prev) => {
        return [...prev, newDept].sort((a, b) => {
          const valA = String(a?.label || a?.value || '')
          const valB = String(b?.label || b?.value || '')
          return valA.localeCompare(valB)
        })
      })

      // Handles Despatch Table updates
      const savedRow = localStorage.getItem('despatchActiveEditedRow')
      const savedAccessor = localStorage.getItem('despatchActiveEditedAccessor')

      if (savedRow && savedAccessor) {
        const row = JSON.parse(savedRow)
        const deptName = newDept.value || newDept.label

        setDespatchTableRowData((prev) =>
          prev.map((item) => (item.id === row.id ? { ...item, [savedAccessor]: deptName } : item))
        )

        localStorage.removeItem('despatchActiveEditedRow')
        localStorage.removeItem('despatchActiveEditedAccessor')
      }

      // Handle PubSub Table updates
      const pubsubSavedRow = localStorage.getItem('pubsubActiveEditedRow')
      const pubsubSavedAccessor = localStorage.getItem('pubsubActiveEditedAccessor')

      if (pubsubSavedRow && pubsubSavedAccessor) {
        const row = JSON.parse(pubsubSavedRow)
        const deptName = newDept.value || newDept.label

        setPubSubTableData((prev) =>
          prev.map((item) =>
            item.id === row.id ? { ...item, [pubsubSavedAccessor]: deptName } : item
          )
        )

        localStorage.removeItem('pubsubActiveEditedRow')
        localStorage.removeItem('pubsubActiveEditedAccessor')
      }

      setTimeout(() => {
        setIsLoading(false)
        setIsLoadingForPubSubTable(false)
      }, 300)
    }

    const handleWorkerRefresh = (event, newWorker) => {
      setIsLoading(true)
      setIsLoadingForPubSubTable(true)
      setPeopleEnumOptions((prev) => {
        return [...prev, newWorker].sort((a, b) => {
          const valA = String(a?.label || a?.value || '')
          const valB = String(b?.label || b?.value || '')
          return valA.localeCompare(valB)
        })
      })

      // Handles Despatch Table updates
      const savedRow = localStorage.getItem('despatchActiveEditedRow')
      const savedAccessor = localStorage.getItem('despatchActiveEditedAccessor')

      if (savedRow && savedAccessor) {
        const row = JSON.parse(savedRow)
        const workerName = newWorker.value || newWorker.label

        setDespatchTableRowData((prev) =>
          prev.map((item) => (item.id === row.id ? { ...item, [savedAccessor]: workerName } : item))
        )

        localStorage.removeItem('despatchActiveEditedRow')
        localStorage.removeItem('despatchActiveEditedAccessor')
      }

      // Handle PubSub Table updates
      const pubsubSavedRow = localStorage.getItem('pubsubActiveEditedRow')
      const pubsubSavedAccessor = localStorage.getItem('pubsubActiveEditedAccessor')

      if (pubsubSavedRow && pubsubSavedAccessor) {
        const row = JSON.parse(pubsubSavedRow)
        const workerName = newWorker.value || newWorker.label

        setPubSubTableData((prev) =>
          prev.map((item) =>
            item.id === row.id ? { ...item, [pubsubSavedAccessor]: workerName } : item
          )
        )

        localStorage.removeItem('pubsubActiveEditedRow')
        localStorage.removeItem('pubsubActiveEditedAccessor')
      }

      setTimeout(() => {
        setIsLoading(false)
        setIsLoadingForPubSubTable(false)
      }, 300)
    }

    window.electron.ipcRenderer.on('refresh-department-enums', handleDepartmentRefresh)
    window.electron.ipcRenderer.on('refresh-worker-enums', handleWorkerRefresh)

    return () => {
      window.electron.ipcRenderer.removeAllListeners('refresh-department-enums')
      window.electron.ipcRenderer.removeAllListeners('refresh-worker-enums')
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('docutrack-table-settings', JSON.stringify(tableSettings))
    } catch (error) {
      console.error('Failed to save table settings to localStorage:', error)
    }
  }, [tableSettings])

  useEffect(() => {
    localStorage.setItem('docutrack-view-mode', viewMode)
  }, [viewMode])

  return (
    <AppContext.Provider
      value={{
        isPublishingActive,
        isRendered,
        setIsRendered,
        workerToDelete,
        setWorkerToDelete,
        departmentToDelete,
        setDepartmentToDelete,
        receiveTableRef,
        isDownloadingReceivePageData,
        setIsDownloadingReceivePageData,
        isTableSettingsRefresh,
        setIsTableSettingRefresh,
        isDownloadingDispacthPageData,
        setIsDownloadingDispatchPageData,
        DEFAULT_TABLE_SETTINGS,
        reMountReceiveComponent,
        setReMountReceiveComponent,
        reMountDispatchComponent,
        setReMountDispatchComponent,
        tableSettings,
        setTableSettings,

        receivePageNumber,
        setReceivePageNumber,
        totalNumberOfReceiveRows,
        setTotalNumberOfReceiveRows,
        totalNumberOfRows,
        setTotalNumberOfRows,
        pageNumber,
        setPageNumber,
        pubSubTableHasData,
        setPubSubTableHasData,
        isOnline,
        setIsOnline,
        isLoadingForPubSubTable,
        setIsLoadingForPubSubTable,
        loadingMessagePubSubTable,
        setLoadingMessagePubSubTable,
        rowForPubSubTable,
        setRowForPubSubTable,
        newValueForPubSubTable,
        setNewValueForPubSubTable,
        accessorForPubSubTable,
        setAccessorForPubSubTable,
        pubSubTableData,
        setPubSubTableData,
        isTokenCreatedAndSavedSuccessfully,
        setIsTokenCreatedAndSavedSuccessfully,
        authCode,
        setAuthCode,
        loadingMessage,
        setLoadingMessage,
        hideDespatchTable,
        setHideDespatchTable,
        hideReceiveTable,
        setHideReceiveTable,
        hasDespatchTableDataBeenLoaded,
        setHasDespatchTableDataBeenLoaded,
        hasReceiveTableDataBeenLoaded,
        setHasReceiveTableDataBeenLoaded,
        signatureBase64,
        setSignatureBase64,
        receiveTableData,
        setReceiveTableRowData,
        despatchTableData,
        setDespatchTableRowData,
        viewMode,
        setViewMode,
        peopleEnumOptions,
        setPeopleEnumOptions,
        departmentEnumOptions,
        setDepartmentenumOptions,
        newWorker,
        setNewWorker,
        newDepartment,
        setNewDepartment,
        rowForDespatch,
        setRowForDespatch,
        rowForReceive,
        setRowForReceive,
        newValue,
        setNewValue,
        open,
        setOpen,
        accessor,
        setAccessor,
        openNewWorkerDialogBox,
        setOpenNewWorkerDialogBox,
        isLoading,
        setIsLoading,
        isAuthenticatedWithGoogle,
        setIsAuthenticatedWithGoogle
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
