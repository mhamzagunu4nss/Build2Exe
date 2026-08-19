/* eslint-disable react/display-name */
import { SimpleTable } from '@simple-table/react'
import '@simple-table/react/styles.css'
import { formatInTimeZone } from 'date-fns-tz'
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

const failedSignaturesCache = new Set()

const SignatureCell = ({ row }) => {
  const workerName = row.receiver && row.receiver.trim() !== '' ? row.receiver : null
  const [hasFailed, setHasFailed] = useState(() =>
    workerName ? failedSignaturesCache.has(workerName) : false
  )

  if (!workerName || hasFailed) {
    return (
      <span className="text-gray-400 text-xs italic block whitespace-pre-line">
        {'No Receiver Signature\n Assigned'}
      </span>
    )
  }

  return (
    <div title="Signature of Receiver" className="w-full max-h-10 flex justify-center items-center">
      <img
        src={`media://signatures/${workerName}.png`}
        alt="Receiver's Signature is missing"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        onError={() => {
          failedSignaturesCache.add(workerName)
          setHasFailed(true)
        }}
      />
    </div>
  )
}

const ReceiveTable = forwardRef(({ theme }, ref) => {
  const {
    loadingMessage,
    setLoadingMessage,
    hideReceiveTable,
    setHideReceiveTable,
    receiveTableData,
    setReceiveTableRowData,
    rowForReceive,
    setRowForReceive,
    newValue,
    setNewValue,
    accessor,
    setAccessor,
    isLoading,
    setIsLoading,
    receivePageNumber,
    setReceivePageNumber,
    totalNumberOfReceiveRows,
    setTotalNumberOfReceiveRows,
    viewMode,
    tableSettings,
    isOnline,
    setIsOnline,
    reMountReceiveComponent,
    setReMountReceiveComponent,
    isDownloadingReceivePageData,
    setIsDownloadingReceivePageData,
    setIsTableSettingRefresh,
    isPublishingActive
  } = useContext(AppContext)

  const [uploadedReceivePageDriveIds, setUploadedReceivePageDriveIds] = useState({})

  const isFirstMountForUpload = useRef(true)
  const isInitializingReceiveAssets = useRef(true)
  const isDownloadRefresh = useRef(false)
  const [dontSaveReceive, setDontSaveReceive] = useState(true)
  const isFirstMount = useRef(true)
  const isSyncFromPubSub = useRef(false)
  const tableApiRef = useRef(null)
  const isChangingPage = useRef(false)
  const isLoadingRef = useRef(isLoading)
  useEffect(() => {
    isLoadingRef.current = isLoading
  }, [isLoading])
  useImperativeHandle(ref, () => ({
    exportToCSV: () => {
      if (tableApiRef.current) {
        tableApiRef.current.exportToCSV()
      }
    },
    setSkipNextAutosave: () => {
      isSyncFromPubSub.current = true
    },

    addNewEmptyReceivePage: async (rowToInsert = null) => {
      setIsLoading(true)
      try {
        const response = await window.electron.ipcRenderer.invoke(
          'add-new-empty-receive-page',
          rowToInsert
        )
        if (response && typeof response.newTotalNumberOfRows === 'number') {
          setTotalNumberOfReceiveRows(response.newTotalNumberOfRows)
          setReceivePageNumber(response.lastPage)
        }
      } catch (error) {
        console.error('add-new-empty-receive-page IPC call threw:', error.message)
      }
      setIsLoading(false)
    },

    setPage: async (targetPage) => {
      if (tableApiRef.current) {
        await tableApiRef.current.setPage(targetPage)
      }
    },

    downloadCurrentPage: async () => {
      if (!isOnline) return

      const fileId = uploadedReceivePageDriveIds[receivePageNumber]
      if (!fileId) return

      const confirmed = await window.electron.ipcRenderer.invoke(
        'confirm-overwrite-with-drive-data',
        `This will overwrite the local copy of receive page ${receivePageNumber}. Continue?`
      )
      if (!confirmed) return

      try {
        setIsLoading(true)
        setIsDownloadingReceivePageData(true)
        setLoadingMessage('Downloading Receive Pages From Google Drive...')

        await window.electron.ipcRenderer.invoke('reset-download-state')
        await window.electron.ipcRenderer.invoke(
          'download-receive-page-from-drive',
          receivePageNumber,
          fileId
        )

        isDownloadRefresh.current = true
      } finally {
        setIsDownloadingReceivePageData(false)
        setReMountReceiveComponent((prev) => !prev)
      }
    },

    downloadAllPages: async () => {
      if (!isOnline) return
      const pageNumbers = Object.keys(uploadedReceivePageDriveIds)
      if (pageNumbers.length === 0) {
        return
      }

      const confirmed = await window.electron.ipcRenderer.invoke(
        'confirm-overwrite-with-drive-data',
        `This will overwrite the local copy of all ${pageNumbers.length} uploaded receive pages with versions on Google Drive. Continue?`
      )
      if (!confirmed) return

      try {
        setIsLoading(true)
        setIsDownloadingReceivePageData(true)
        setLoadingMessage('Downloading Pages From Google Drive...')

        await window.electron.ipcRenderer.invoke('reset-download-state')

        for (const page of pageNumbers) {
          const success = await window.electron.ipcRenderer.invoke(
            'download-receive-page-from-drive',
            page,
            uploadedReceivePageDriveIds[page]
          )

          if (!success) {
            break
          }
        }

        isDownloadRefresh.current = true
      } finally {
        setIsDownloadingReceivePageData(false)
        setReMountReceiveComponent((prev) => !prev)
      }
    }
  }))

  useEffect(() => {
    async function updateGoogleDriveFiles() {
      const columnsToIgnore = ['id', 'signature', 'registrynumber', 'numberofletter', 'remarks']

      const allValuesFilled = Object.keys(rowForReceive).every((key) => {
        if (columnsToIgnore.includes(key)) return true
        const rowValue = rowForReceive[key]
        return rowValue !== undefined && rowValue !== null && String(rowValue).trim() !== ''
      })

      if (allValuesFilled) {
        if (window.uploadReceiveTimerId) {
          clearTimeout(window.uploadReceiveTimerId)
        }

        window.uploadReceiveTimerId = setTimeout(async () => {
          let fileId = uploadedReceivePageDriveIds[receivePageNumber]
          if (!fileId) {
            const uploadResponse = await window.electron.ipcRenderer.invoke(
              'upload-receive-table-data-to-google-drive',
              receivePageNumber
            )
            if (!uploadResponse) {
              window.uploadReceiveTimerId = null
              return
            }
            fileId = uploadResponse.id
            await window.electron.ipcRenderer.invoke(
              'save-uploaded-receive-table-id',
              receivePageNumber,
              fileId
            )
            setUploadedReceivePageDriveIds((prev) => ({ ...prev, [receivePageNumber]: fileId }))
          }

          const dataToWrite = receiveTableData.map((item) => JSON.stringify(item)).join('\n')
          await window.electron.ipcRenderer.invoke('update-google-drive-file', fileId, dataToWrite)

          window.uploadReceiveTimerId = null
        }, 8000)
      }
    }

    rowForReceive !== null &&
      rowForReceive !== undefined &&
      viewMode === 'Receive' &&
      tableSettings.onlineSyncEnabled !== false &&
      updateGoogleDriveFiles()
  }, [rowForReceive, receiveTableData, viewMode])

  useEffect(() => {
    setIsTableSettingRefresh(false)
    const initializeTableAssets = async () => {
      setLoadingMessage('Loading Receive Table Data...')
      setIsLoading(true)

      const savedPage = Number(localStorage.getItem('receivePageNumber'))
      const activePage = savedPage > 0 ? savedPage : receivePageNumber
      if (savedPage > 0) {
        setReceivePageNumber(savedPage)
      }

      const [totalNumberOfReceiveRows, tableData, uploadedIdsMap] = await Promise.all([
        window.electron.ipcRenderer.invoke('get-total-number-of-receive-rows'),
        window.electron.ipcRenderer.invoke('load-receive-table-data-asynchronous', activePage),
        window.electron.ipcRenderer.invoke('load-uploaded-receive-table-ids')
      ])

      if (totalNumberOfReceiveRows) setTotalNumberOfReceiveRows(totalNumberOfReceiveRows)
      if (tableData) setReceiveTableRowData(tableData)

      const currentUploadedIdsMap = uploadedIdsMap || {}
      setUploadedReceivePageDriveIds(currentUploadedIdsMap)

      if (tableSettings.onlineSyncEnabled !== false && !currentUploadedIdsMap[activePage]) {
        const uploadResponse = await window.electron.ipcRenderer.invoke(
          'upload-receive-table-data-to-google-drive',
          activePage
        )
        if (uploadResponse) {
          await window.electron.ipcRenderer.invoke(
            'save-uploaded-receive-table-id',
            activePage,
            uploadResponse.id
          )
          setUploadedReceivePageDriveIds((prev) => ({
            ...prev,
            [activePage]: uploadResponse.id
          }))
        }
      }

      if (tableApiRef.current) {
        await tableApiRef.current.setPage(activePage)
      }

      setTimeout(async () => {
        isInitializingReceiveAssets.current = false
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
    if (isInitializingReceiveAssets.current) return
    if (isOnline) {
      if (
        isLoadingRef.current &&
        !isDownloadingReceivePageData &&
        !isChangingPage.current &&
        !isPublishingActive.current
      ) {
        setIsLoading(false)
      }
    } else {
      setLoadingMessage('Fix Your Internet Connection...')
      if (!isLoadingRef.current) setIsLoading(true)

      const abortDriveDownload = async () => {
        await window.electron.ipcRenderer.invoke('abort-drive-download')
      }
      if (isDownloadingReceivePageData) abortDriveDownload()
    }
  }, [isOnline, isDownloadingReceivePageData])

  useEffect(() => {
    if (isFirstMountForUpload.current) {
      isFirstMountForUpload.current = false
      return
    }

    const ensurePageUploaded = async () => {
      if (tableSettings.onlineSyncEnabled === false) return
      if (!uploadedReceivePageDriveIds[receivePageNumber]) {
        const uploadResponse = await window.electron.ipcRenderer.invoke(
          'upload-receive-table-data-to-google-drive',
          receivePageNumber
        )
        if (uploadResponse) {
          await window.electron.ipcRenderer.invoke(
            'save-uploaded-receive-table-id',
            receivePageNumber,
            uploadResponse.id
          )
          setUploadedReceivePageDriveIds((prev) => ({
            ...prev,
            [receivePageNumber]: uploadResponse.id
          }))
        }
      }
    }

    ensurePageUploaded()
  }, [receivePageNumber])

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }

    localStorage.setItem('receivePageNumber', receivePageNumber)

    const loadMatchingPageData = async () => {
      isChangingPage.current = true
      setIsLoading(true)

      try {
        const tableData = await window.electron.ipcRenderer.invoke(
          'load-receive-table-data-asynchronous',
          receivePageNumber
        )

        if (tableData) {
          setReceiveTableRowData(tableData)
        }
      } finally {
        isChangingPage.current = false
        if (!isPublishingActive.current) {
          setIsLoading(false)
        }
      }
    }

    loadMatchingPageData()
  }, [receivePageNumber])

  useEffect(() => {
    const syncPage = async () => {
      if (tableApiRef.current) {
        await tableApiRef.current.setPage(receivePageNumber)
      }
    }
    syncPage()
  }, [totalNumberOfReceiveRows, receivePageNumber])

  useEffect(() => {
    if (!receiveTableData || receiveTableData.length === 0) return

    let needsCleanup = false

    const cleanedData = receiveTableData.map((row) => {
      const isRowEmpty =
        (!row.dateofreceived || row.dateofreceived.trim() === '') &&
        (!row.registrynumber || row.registrynumber.trim() === '') &&
        (!row.towhomreceived || row.towhomreceived.trim() === '') &&
        (!row.dateofletter || row.dateofletter.trim() === '') &&
        (!row.numberofletter || row.numberofletter.trim() === '') &&
        (!row.subject || row.subject.trim() === '') &&
        (!row.receiver || row.receiver.trim() === '') &&
        (!row.remarks || row.remarks.trim() === '')

      if (isRowEmpty) {
        const hasLingeringData =
          (row.signature && row.signature !== '') ||
          row.iDOnDespatchTable !== undefined ||
          row.subscriptionNameOrId !== undefined ||
          row.ReceiveStatus !== undefined

        if (hasLingeringData) {
          needsCleanup = true

          return {
            id: row.id,
            dateofreceived: '',
            registrynumber: '',
            towhomreceived: '',
            dateofletter: '',
            numberofletter: '',
            subject: '',
            receiver: '',
            remarks: '',
            signature: ''
          }
        }
      } else {
        const isReceiverEmpty = !row.receiver || row.receiver.toString().trim() === ''
        if (isReceiverEmpty && row.signature && row.signature !== '') {
          needsCleanup = true
          return { ...row, signature: '' }
        }
      }

      return row
    })

    if (needsCleanup) {
      setReceiveTableRowData(cleanedData)
      return
    }

    if (isSyncFromPubSub.current) {
      isSyncFromPubSub.current = false
      return
    }
    if (isDownloadRefresh.current) {
      isDownloadRefresh.current = false
      return
    }

    const shipNewTableDataToSave = async () => {
      setLoadingMessage('Saving Receive Table Data...')

      try {
        await window.electron.ipcRenderer.invoke(
          'save-receive-table-data-asynchronous',
          receiveTableData,
          receivePageNumber
        )
      } finally {
        setIsLoading(false)
      }
    }

    !dontSaveReceive && shipNewTableDataToSave()
  }, [receiveTableData, dontSaveReceive])

  const handleCellEdit = ({ accessor, newValue, row }) => {
    console.log('Cell edit detected:', { accessor, newValue, row })
    setDontSaveReceive(false)
    setIsLoading(true)

    setRowForReceive(row)
    setNewValue(newValue)
    setAccessor(accessor)

    setReceiveTableRowData((prev) =>
      prev.map((item) => (item.id === row.id ? { ...item, [accessor]: newValue } : item))
    )
  }

  const columnHeaders = [
    { accessor: 'id', label: 'ID', width: 50, isSortable: true, type: 'number' },
    {
      accessor: 'dateofreceived',
      label: 'Date of Received',
      width: 150,
      isSortable: true,
      type: 'date',
      isEditable: true,
      filterable: true,
      valueFormatter: ({ value }) => {
        if (!value) return ''
        return formatInTimeZone(new Date(value), 'UTC', 'dd/MM/yyyy')
      }
    },
    {
      accessor: 'registrynumber',
      label: 'Registry Number',
      width: '150',
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
      accessor: 'towhomreceived',
      label: 'To Whom Received',
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
      accessor: 'dateofletter',
      label: 'Date of Letter',
      width: 150,
      isSortable: true,
      type: 'date',
      isEditable: true,
      filterable: true,
      valueFormatter: ({ value }) => {
        if (!value) return ''
        return formatInTimeZone(new Date(value), 'UTC', 'dd/MM/yyyy')
      }
    },
    {
      accessor: 'numberofletter',
      label: 'Number of Letter',
      width: '150',
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
      accessor: 'receiver',
      label: 'Receiver',
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
      accessor: 'remarks',
      label: 'Remarks',
      width: '150',
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
      accessor: 'signature',
      label: 'Signature',
      width: 150,
      isSortable: true,
      type: 'string',
      cellRenderer: ({ row }) => <SignatureCell row={row} />
    }
  ]

  const dynamicHeaders = useMemo(() => {
    const savedWidths = JSON.parse(localStorage.getItem('receiveColumnWidths') || '{}')
    const savedOrder = JSON.parse(localStorage.getItem('receiveColumnOrder'))

    const baseHeaders = columnHeaders.map((col) => ({
      ...col,
      isEditable: col.accessor === 'id' ? false : !tableSettings.receive_locked,
      width: savedWidths[col.accessor] || col.width,
      align: tableSettings[`align_${col.accessor}`] || 'left',
      excludeFromCsv: tableSettings[`exclude_${col.accessor}`] || false
    }))

    return savedOrder
      ? savedOrder.map((savedCol) => baseHeaders.find((h) => h.accessor === savedCol.accessor))
      : baseHeaders
  }, [tableSettings])

  return (
    <SimpleTable
      ref={tableApiRef}
      key={`table-receive-${totalNumberOfReceiveRows}`}
      serverSidePagination={true}
      shouldPaginate={true}
      totalRowCount={totalNumberOfReceiveRows}
      onPageChange={async (page) => {
        if (receivePageNumber !== page) {
          setReceivePageNumber(page)
        }
      }}
      rowsPerPage={1000}
      defaultHeaders={dynamicHeaders}
      rows={receiveTableData}
      height={'800px'}
      autoExpandColumns={true}
      theme={tableSettings.theme ?? 'light'}
      selectableCells={true}
      selectableColumns={true}
      columnResizing={tableSettings.columnResizing}
      columnReordering={tableSettings.columnReordering}
      onColumnWidthChange={(headers) => {
        localStorage.setItem(
          'receiveColumnWidths',
          JSON.stringify(Object.fromEntries(headers.map((h) => [h.accessor, h.width])))
        )
      }}
      onColumnOrderChange={(newHeaders) => {
        localStorage.setItem('receiveColumnOrder', JSON.stringify(newHeaders))
      }}
      columnBorders={tableSettings.columnBorders}
      useHoverRowBackground={tableSettings.useHoverRowBackground}
      useOddEvenRowBackground={tableSettings.useOddEvenRowBackground}
      customTheme={{ rowHeight: tableSettings.rowHeight }}
      onCellEdit={handleCellEdit}
      isLoading={isLoading}
      enableRowSelection={true}
    />
  )
})

export default ReceiveTable
