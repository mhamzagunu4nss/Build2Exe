/* eslint-disable react/display-name */
import { SimpleTable } from '@simple-table/react'
import '@simple-table/react/styles.css'
import {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { AppContext } from './state-provider'

const DespatchTable = forwardRef(({ theme }, ref) => {
  const {
    loadingMessage,
    setLoadingMessage,
    hideDespatchTable,
    setHideDespatchTable,
    hideReceiveTable,
    setHideReceiveTable,
    viewMode,
    setViewMode,
    signatureBase64,
    setSignatureBase64,
    despatchTableData,
    setDespatchTableRowData,
    newWorker,
    setNewWorker,
    open,
    setOpen,
    newDepartment,
    setNewDepartment,
    rowForDespatch,
    setRowForDespatch,

    newValue,
    setNewValue,
    accessor,
    setAccessor,
    openNewWorkerDialogBox,
    setOpenNewWorkerDialogBox,
    departmentEnumOptions,
    setDepartmentenumOptions,
    peopleEnumOptions,
    setPeopleEnumOptions,
    isLoading,
    setIsLoading,
    isOnline,
    setIsOnline,
    pageNumber,
    setPageNumber,
    totalNumberOfRows,
    setTotalNumberOfRows,
    tableSettings,
    setTableSettings,
    reMountDispatchComponent,
    setReMountDispatchComponent,
    isDownloadingDispacthPageData,
    setIsDownloadingDispatchPageData
  } = useContext(AppContext)

  const [uploadedPageDriveIds, setUploadedPageDriveIds] = useState({})

  const isFirstMountForUpload = useRef(true)
  const isInitializingAssets = useRef(true)
  const isDownloadRefresh = useRef(false)
  const isChangingPage = useRef(false)
  const isLoadingRef = useRef(isLoading)
  useEffect(() => {
    isLoadingRef.current = isLoading
  }, [isLoading])
  const [dontSave, setDontSave] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const tableApiRef = useRef(null)

  const isFirstMount = useRef(true)

  useImperativeHandle(ref, () => ({
    exportToCSV: () => {
      if (tableApiRef.current) {
        tableApiRef.current.exportToCSV()
      }
    },

    addNewEmptyDespatchPage: async () => {
      setIsLoading(true)
      const response = await window.electron.ipcRenderer.invoke('add-new-empty-despatch-page')
      if (response.newTotalNumberOfRows) {
        setTotalNumberOfRows(response.newTotalNumberOfRows)
        setPageNumber(response.lastPage)
      }

      // setIsLoading(false)
    },

    setPage: async (targetPage) => {
      if (tableApiRef.current) {
        await tableApiRef.current.setPage(targetPage)
      }
    },
    downloadCurrentPage: async () => {
      if (!isOnline) return

      const fileId = uploadedPageDriveIds[pageNumber]
      if (!fileId) return

      const confirmed = await window.electron.ipcRenderer.invoke(
        'confirm-overwrite-with-drive-data',
        `This will overwrite the local copy of page ${pageNumber}. Continue?`
      )
      if (!confirmed) return

      try {
        setIsLoading(true)
        setIsDownloadingDispatchPageData(true)
        setLoadingMessage('Downloading Pages From Google Drive...')

        await window.electron.ipcRenderer.invoke('reset-download-state')
        await window.electron.ipcRenderer.invoke(
          'download-despatch-page-from-drive',
          pageNumber,
          fileId
        )

        isDownloadRefresh.current = true
      } finally {
        setIsDownloadingDispatchPageData(false)
        setReMountDispatchComponent((prev) => !prev)
      }
    },

    downloadAllPages: async () => {
      if (!isOnline) return
      const pageNumbers = Object.keys(uploadedPageDriveIds)
      if (pageNumbers.length === 0) {
        console.warn('Google Drive download aborted: No uploaded pages found.')
        return
      }

      const confirmed = await window.electron.ipcRenderer.invoke(
        'confirm-overwrite-with-drive-data',
        `This will overwrite the local copy of all ${pageNumbers.length} uploaded pages with the versions on Google Drive. Continue?`
      )
      if (!confirmed) return

      try {
        setIsLoading(true)
        setIsDownloadingDispatchPageData(true)
        setLoadingMessage('Downloading Pages From Google Drive...')

        await window.electron.ipcRenderer.invoke('reset-download-state')

        for (const page of pageNumbers) {
          const success = await window.electron.ipcRenderer.invoke(
            'download-despatch-page-from-drive',
            page,
            uploadedPageDriveIds[page]
          )

          if (!success) {
            console.warn('Drive download sequence interrupted at page:', page)
            break
          }
        }

        isDownloadRefresh.current = true
      } finally {
        setIsDownloadingDispatchPageData(false)
        setReMountDispatchComponent((prev) => !prev)
      }
    }
  }))

  useEffect(() => {
    async function updateGoogleDriveFiles() {
      const columnsToIgnore = ['id', 'signature', 'registrynumber', 'numberofletter', 'remarks']

      const allValuesFilled = Object.keys(rowForDespatch).every((key) => {
        if (columnsToIgnore.includes(key)) return true
        const rowValue = rowForDespatch[key]
        return rowValue !== undefined && rowValue !== null && String(rowValue).trim() !== ''
      })

      if (allValuesFilled) {
        if (window.uploadTimerId) {
          clearTimeout(window.uploadTimerId)
        }

        window.uploadTimerId = setTimeout(async () => {
          let fileId = uploadedPageDriveIds[pageNumber]
          if (!fileId) {
            console.info('Initiating initial Drive upload for page:', pageNumber)
            const uploadResponse = await window.electron.ipcRenderer.invoke(
              'upload-despatch-table-data-to-google-drive',
              pageNumber
            )
            if (!uploadResponse) {
              console.error('Drive upload failed for page:', pageNumber)
              window.uploadTimerId = null
              return
            }
            fileId = uploadResponse.id
            await window.electron.ipcRenderer.invoke(
              'save-uploaded-despatch-table-id',
              pageNumber,
              fileId
            )
            setUploadedPageDriveIds((prev) => ({ ...prev, [pageNumber]: fileId }))
          }

          const dataToWrite = despatchTableData.map((item) => JSON.stringify(item)).join('\n')
          const updateResponse = await window.electron.ipcRenderer.invoke(
            'update-google-drive-file',
            fileId,
            dataToWrite
          )

          window.uploadTimerId = null
        }, 8000)
      }
    }

    rowForDespatch !== null &&
      rowForDespatch !== undefined &&
      rowForDespatch.towhomsent !== '+ Add New Department' &&
      rowForDespatch.despatcher !== '+ Add New Worker' &&
      viewMode === 'Despatch' &&
      tableSettings.onlineSyncEnabled !== false &&
      updateGoogleDriveFiles()

    async function publishMessage(message) {
      const columnsToIgnoreForPubSubTable = [
        'id',
        'signature',
        'registrynumber',
        'numberofletter',
        'remarks'
      ]

      const allValuesFilledForPubSubTable = Object.keys(message).every((key) => {
        if (columnsToIgnoreForPubSubTable.includes(key)) return true
        const rowValue = message[key]
        return rowValue !== undefined && rowValue !== null && String(rowValue).trim() !== ''
      })

      if (allValuesFilledForPubSubTable) {
        const actualMessage = {
          id: message.id,
          pubsub_dateofreceived: '',
          pubsub_registrynumber: '',
          pubsub_towhomreceived: '',
          pubsub_dateofletter: message.dateofletter,
          pubsub_numberofletter: message.numberofletter,
          pubsub_subject: message.subject,
          pubsub_receiver: '',
          pubsub_remarks: message.remarks,
          pubsub_signature: message.signature
        }

        await window.electron.ipcRenderer.invoke('publish-message', JSON.stringify(actualMessage))
        setRowForDespatch(null)
      }
    }
    isOnline &&
      rowForDespatch !== null &&
      rowForDespatch !== undefined &&
      rowForDespatch.towhomsent !== '+ Add New Department' &&
      rowForDespatch.despatcher !== '+ Add New Worker' &&
      tableSettings.onlineSyncEnabled !== false &&
      publishMessage(rowForDespatch)
  }, [rowForDespatch, despatchTableData, viewMode, isOnline])

  useEffect(() => {
    const initializeTableAssets = async () => {
      setLoadingMessage('Loading Dispatch Table Data...')

      const savedPage = Number(localStorage.getItem('despatchPageNumber'))
      const activePage = savedPage > 0 ? savedPage : pageNumber
      if (savedPage > 0) {
        setPageNumber(savedPage)
      }

      const [totalNumberOfRows, uploadedIdsMap, tableData, deptData, peopleData] =
        await Promise.all([
          window.electron.ipcRenderer.invoke('get-total-number-of-rows'),
          window.electron.ipcRenderer.invoke('load-uploaded-despatch-table-ids'),
          window.electron.ipcRenderer.invoke('load-despatch-table-data-asynchronous', activePage),
          window.electron.ipcRenderer.invoke('load-department-enum-data-asynchronous'),
          window.electron.ipcRenderer.invoke('load-people-enum-data-asynchronous')
        ])

      if (totalNumberOfRows) setTotalNumberOfRows(totalNumberOfRows)

      const currentUploadedIdsMap = uploadedIdsMap || {}
      setUploadedPageDriveIds(currentUploadedIdsMap)

      if (tableSettings.onlineSyncEnabled !== false && !currentUploadedIdsMap[activePage]) {
        const uploadResponse = await window.electron.ipcRenderer.invoke(
          'upload-despatch-table-data-to-google-drive',
          activePage
        )
        if (uploadResponse) {
          await window.electron.ipcRenderer.invoke(
            'save-uploaded-despatch-table-id',
            activePage,
            uploadResponse.id
          )
          await window.electron.ipcRenderer.invoke('list-google-drive-files')
          setUploadedPageDriveIds((prev) => ({ ...prev, [activePage]: uploadResponse.id }))
        }
      }

      if (tableData) setDespatchTableRowData(tableData)
      if (deptData) setDepartmentenumOptions(deptData)
      if (peopleData) setPeopleEnumOptions(peopleData)
      if (tableApiRef.current) {
        await tableApiRef.current.setPage(activePage)
      }

      setTimeout(async () => {
        isInitializingAssets.current = false
        const hasInternet = await window.electron.ipcRenderer.invoke('check-actual-internet')
        setIsOnline(hasInternet)

        if (!hasInternet) {
          console.log('you are offline')
          setLoadingMessage('Fix Your Internet Connection...')
          setIsLoading(true)
        } else {
          setIsLoading(false)
        }
      }, 300)
    }

    initializeTableAssets()
  }, [])

  useEffect(() => {
    let previousStatus = null

    const verifyRealInternet = async () => {
      const hasInternet = await window.electron.ipcRenderer.invoke('check-actual-internet')

      if (hasInternet === previousStatus) {
        return
      }
      previousStatus = hasInternet

      if (hasInternet) {
        setIsOnline(true)
        await window.electron.ipcRenderer.invoke('create-file-update-subscription')
      } else {
        console.warn('Network connectivity lost. Switched to offline mode.')

        setIsOnline(false)
        await window.electron.ipcRenderer.invoke('stop-listening')
      }
    }

    verifyRealInternet()

    window.addEventListener('online', verifyRealInternet)
    window.addEventListener('offline', verifyRealInternet)

    const intervalId = setInterval(verifyRealInternet, 10000)

    return () => {
      window.removeEventListener('online', verifyRealInternet)
      window.removeEventListener('offline', verifyRealInternet)
      clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (isInitializingAssets.current) return
    if (isOnline) {
      if (isLoadingRef.current && !isDownloadingDispacthPageData && !isChangingPage.current) {
        setIsLoading(false)
      }
    } else {
      setLoadingMessage('Fix Your Internet Connection...')

      if (!isLoadingRef.current) setIsLoading(true)

      const abortDriveDownload = async () => {
        await window.electron.ipcRenderer.invoke('abort-drive-download')
      }
      if (isDownloadingDispacthPageData) abortDriveDownload()
    }
  }, [isOnline, isDownloadingDispacthPageData])
  useEffect(() => {
    if (isFirstMountForUpload.current) {
      isFirstMountForUpload.current = false
      return
    }

    const ensurePageUploaded = async () => {
      if (tableSettings.onlineSyncEnabled === false) return
      if (!uploadedPageDriveIds[pageNumber]) {
        const uploadResponse = await window.electron.ipcRenderer.invoke(
          'upload-despatch-table-data-to-google-drive',
          pageNumber
        )
        if (uploadResponse) {
          await window.electron.ipcRenderer.invoke(
            'save-uploaded-despatch-table-id',
            pageNumber,
            uploadResponse.id
          )
          setUploadedPageDriveIds((prev) => ({ ...prev, [pageNumber]: uploadResponse.id }))
        }
      }
    }

    ensurePageUploaded()
  }, [pageNumber])

  useEffect(() => {
    if (isInitializingAssets.current) return

    localStorage.setItem('despatchPageNumber', pageNumber)

    const loadMatchingPageData = async () => {
      isChangingPage.current = true
      setIsLoading(true)

      try {
        const tableData = await window.electron.ipcRenderer.invoke(
          'load-despatch-table-data-asynchronous',
          pageNumber
        )

        if (tableData) {
          setDespatchTableRowData(tableData)
        }
      } finally {
        isChangingPage.current = false
        setIsLoading(false)
      }
    }

    loadMatchingPageData()
  }, [pageNumber])

  useEffect(() => {
    const syncPage = async () => {
      if (tableApiRef.current) {
        await tableApiRef.current.setPage(pageNumber)
      }
    }
    syncPage()
  }, [departmentEnumOptions.length, peopleEnumOptions.length, totalNumberOfRows, pageNumber])

  useEffect(() => {
    if (isDownloadRefresh.current) {
      isDownloadRefresh.current = false
      return
    }
    const shipNewTableDataToSave = async () => {
      setIsSaving(true)
      setLoadingMessage('Saving Table Data...')

      await window.electron.ipcRenderer.invoke(
        'save-despatch-table-data-asynchronous',
        despatchTableData,
        pageNumber
      )

      setIsLoading(false)
      setIsSaving(false)
    }

    !dontSave &&
      despatchTableData !== null &&
      despatchTableData !== undefined &&
      despatchTableData.length !== 0 &&
      shipNewTableDataToSave()
  }, [despatchTableData, dontSave])

  const handleCellEdit = ({ accessor, newValue, row }) => {
    setDontSave(false)

    localStorage.setItem('despatchActiveEditedRow', JSON.stringify(row))
    localStorage.setItem('despatchActiveEditedAccessor', accessor)

    if (newValue === '+ Add New Department') {
      window.electron.ipcRenderer.invoke('open-department-window')
      return
    }

    if (newValue === '+ Add New Worker') {
      window.electron.ipcRenderer.invoke('open-worker-window')
      return
    }

    setIsLoading(true)

    setDespatchTableRowData((prev) =>
      prev.map((item) => (item.id === row.id ? { ...item, [accessor]: newValue } : item))
    )
    const updatedRow = { ...row, [accessor]: newValue }
    setRowForDespatch(updatedRow)
  }

  const columnHeaders = [
    { accessor: 'id', label: 'ID', width: 50, isSortable: true, type: 'number' },
    {
      accessor: 'dateofdespatch',
      label: 'Date of Despatch',
      width: 150,
      isSortable: true,
      type: 'date',
      isEditable: true,
      filterable: true,
      valueFormatter: ({ value }) => {
        if (!value) return ''
        const dateObj = new Date(value)
        return isNaN(dateObj.getTime()) ? value : dateObj.toLocaleDateString('en-GB')
      }
    },

    {
      accessor: 'registrynumber',
      label: 'Registry Number',
      width: 150,
      isSortable: true,
      type: 'string',
      isEditable: true,
      filterable: true,
      cellRenderer: ({ row, accessor }) => {
        const value = row[accessor]
        return (
          <div title={value} className="truncate">
            {value}
          </div>
        )
      }
    },
    {
      accessor: 'towhomsent',
      label: 'To Whom Sent',
      width: 150,
      isSortable: true,
      type: 'enum',
      filterable: true,
      isEditable: true,
      enumOptions: departmentEnumOptions
    },
    {
      accessor: 'dateofletter',
      label: 'Date of Letter',
      width: 150,
      isSortable: true,
      type: 'date',
      isEditable: true,
      filterable: true,
      valueFormatter: ({ value }) => {
        if (!value) return ''
        const dateObj = new Date(value)
        return isNaN(dateObj.getTime()) ? value : dateObj.toLocaleDateString('en-GB')
      }
    },

    {
      accessor: 'numberofletter',
      label: 'Number of Letter',
      width: 150,
      isSortable: true,
      type: 'string',
      isEditable: true,
      filterable: true,
      cellRenderer: ({ row, accessor }) => {
        const value = row[accessor]
        return (
          <div title={value} className="truncate">
            {value}
          </div>
        )
      }
    },
    {
      accessor: 'subject',
      label: 'Subject',
      width: 150,
      isSortable: true,
      type: 'string',
      isEditable: true,
      filterable: true,
      cellRenderer: ({ row, accessor }) => {
        const value = row[accessor]
        return (
          <div title={value} className="truncate">
            {value}
          </div>
        )
      }
    },
    {
      accessor: 'despatcher',
      label: 'Despatcher',
      width: 150,
      isSortable: true,
      isEditable: true,
      type: 'enum',
      filterable: true,
      enumOptions: peopleEnumOptions
    },

    {
      accessor: 'remarks',
      label: 'Remarks',
      width: 150,
      isSortable: true,
      type: 'string',
      isEditable: true,
      filterable: true,
      cellRenderer: ({ row, accessor }) => {
        const value = row[accessor]
        return (
          <div title={value} className="truncate">
            {value}
          </div>
        )
      }
    }
  ]
  const dynamicHeaders = useMemo(() => {
    const savedWidths = JSON.parse(localStorage.getItem('despatchColumnWidths') || '{}')
    const savedOrder = JSON.parse(localStorage.getItem('despatchColumnOrder'))

    const baseHeaders = columnHeaders.map((col) => ({
      ...col,
      width: savedWidths[col.accessor] || col.width,
      align: tableSettings[`align_${col.accessor}`] || 'left',
      excludeFromCsv: tableSettings[`exclude_${col.accessor}`] || false
    }))

    return savedOrder
      ? savedOrder
          .map((savedCol) => baseHeaders.find((h) => h.accessor === savedCol.accessor))
          .filter(Boolean)
      : baseHeaders
  }, [tableSettings, departmentEnumOptions, peopleEnumOptions])

  return (
    <SimpleTable
      ref={tableApiRef}
      key={`table-${departmentEnumOptions.length}-${peopleEnumOptions.length}-${totalNumberOfRows}`}
      serverSidePagination={true}
      shouldPaginate={true}
      totalRowCount={totalNumberOfRows}
      onPageChange={async (page) => {
        if (pageNumber !== page) {
          setPageNumber(page)
        }
      }}
      rowsPerPage={1000}
      defaultHeaders={dynamicHeaders}
      rows={despatchTableData}
      height={'800px'}
      autoExpandColumns={true}
      theme={tableSettings.theme ?? 'light'}
      selectableCells={true}
      selectableColumns={true}
      columnResizing={tableSettings.columnResizing}
      columnReordering={tableSettings.columnReordering}
      columnBorders={tableSettings.columnBorders}
      useHoverRowBackground={tableSettings.useHoverRowBackground}
      useOddEvenRowBackground={tableSettings.useOddEvenRowBackground}
      customTheme={{ rowHeight: tableSettings.rowHeight }}
      onCellEdit={handleCellEdit}
      isLoading={isLoading}
      enableRowSelection={true}
      onColumnWidthChange={(headers) => {
        localStorage.setItem(
          'despatchColumnWidths',
          JSON.stringify(Object.fromEntries(headers.map((h) => [h.accessor, h.width])))
        )
      }}
      onColumnOrderChange={(newHeaders) => {
        localStorage.setItem('despatchColumnOrder', JSON.stringify(newHeaders))
      }}
    />
  )
})

export default DespatchTable
