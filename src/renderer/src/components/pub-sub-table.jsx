/* eslint-disable react/prop-types */
import { SimpleTable } from '@simple-table/react'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext } from './state-provider'

const failedSignaturesCache = new Set()

const SignatureCell = ({ row }) => {
  const workerName =
    row.pubsub_receiver && row.pubsub_receiver.trim() !== '' ? row.pubsub_receiver : null
  const [hasFailed, setHasFailed] = useState(() =>
    workerName ? failedSignaturesCache.has(workerName) : false
  )

  if (!workerName || hasFailed) {
    return (
      <span className="text-gray-400 text-xs italic whitespace-pre-line">
        {'No Receiver Signature\n Assigned'}
      </span>
    )
  }

  return (
    <div
      title="Signature of Despatcher"
      className="w-full max-h-10 flex justify-center items-center"
    >
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

const PubSubTable = () => {
  const {
    pubSubTableHasData,
    pubSubTableData,
    setPubSubTableData,
    peopleEnumOptions,
    setPeopleEnumOptions,
    newWorker,
    signatureBase64,
    setOpenNewWorkerDialogBox,
    receiveTableData,
    setReceiveTableRowData,
    receiveTableRef,
    viewMode,
    setViewMode,
    tableSettings,

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
    isOnline,
    setIsOnline,
    departmentEnumOptions,
    setDepartmentenumOptions,
    setTotalNumberOfReceiveRows,
    receivePageNumber,
    isTableRefresh,
    setNewDepartment,
    open,
    setOpen,
    newDepartment,
    setNewWorker,
    setIsLoading,
    isPublishingActive
  } = useContext(AppContext)

  const [isSavingForPubSubTable, setIsSavingForPubSubTable] = useState(false)
  const [isEditingForPubSubTable, setIsEditingForPubSubTable] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSelectable, setIsSelectable] = useState(false)
  const isFirstMountForPubSub = useRef(true)
  const isDeletingRowRef = useRef(null)
  const [dontSave, setDontSave] = useState(true)

  useEffect(() => {
    const initializeTableAssets = async () => {
      try {
        const [peopleData, deptData, pubSubTableFileRows] = await Promise.all([
          window.electron.ipcRenderer.invoke('load-people-enum-data-asynchronous'),
          window.electron.ipcRenderer.invoke('load-department-enum-data-asynchronous'),
          window.electron.ipcRenderer.invoke('load-pub-sub-table-data-asynchronous')
        ])

        if (peopleData) setPeopleEnumOptions(peopleData)
        if (deptData) setDepartmentenumOptions(deptData)
        if (pubSubTableFileRows) setPubSubTableData(pubSubTableFileRows)

        setTimeout(() => {
          setIsLoadingForPubSubTable(false)
        }, 300)
      } catch (error) {
        console.error('Failed to concurrently load assets on initial boot:', error)
      }
    }

    initializeTableAssets()

    window.api.onRawRowAppend((newRow) => {
      setDontSave(false)

      setPubSubTableData((prev) => {
        const safePrev = Array.isArray(prev) ? prev : []

        if (safePrev.length > 0) {
          const exists = safePrev.some(
            (item) =>
              item.id === newRow.id && item.subscriptionNameOrId === newRow.subscriptionNameOrId
          )

          if (exists) {
            return safePrev.map((item) =>
              item.id === newRow.id && item.subscriptionNameOrId === newRow.subscriptionNameOrId
                ? newRow
                : item
            )
          } else {
            return [...safePrev, newRow]
          }
        } else {
          return [...safePrev, newRow]
        }
      })
    })
    window.api.onRawRowRemove(({ id, subscriptionNameOrId }) => {
      setDontSave(false)
      setPubSubTableData((prev) => {
        const safePrev = Array.isArray(prev) ? prev : []
        return safePrev.filter(
          (item) => !(item.id === id && item.subscriptionNameOrId === subscriptionNameOrId)
        )
      })
    })

    return () => {
      window.api.removeRawRowListener()
      window.api.removeRawRowRemoveListener()
    }
  }, [])

  useEffect(() => {
    if (!pubSubTableData || pubSubTableData.length === 0) return

    let needsCleanup = false
    const cleanedData = pubSubTableData.map((row) => {
      const isReceiverEmpty = !row.pubsub_receiver || row.pubsub_receiver.toString().trim() === ''
      if (isReceiverEmpty && row.pubsub_signature && row.pubsub_signature !== '') {
        needsCleanup = true
        return { ...row, pubsub_signature: '' }
      }
      return row
    })

    if (needsCleanup) {
      setPubSubTableData(cleanedData)
      return
    }

    const shipNewPubSubDataToSave = async () => {
      setLoadingMessagePubSubTable('Saving PubSub Table Data...')
      await window.electron.ipcRenderer.invoke(
        'save-pub-sub-table-data-asynchronous',
        pubSubTableData
      )
      setTimeout(() => setIsLoadingForPubSubTable(false), 100)
      setIsEditingForPubSubTable(false)
    }

    if (!dontSave && !isDeleting && pubSubTableData.length !== 0) {
      shipNewPubSubDataToSave()
    }
  }, [pubSubTableData, dontSave, isDeleting, pubSubTableData.length])

  useEffect(() => {
    async function publishMessage(message) {
      const columnsToIgnoreForPubSubTable = [
        'id',
        'pubsub_signature',
        'pubsub_registrynumber',
        'pubsub_numberofletter',
        'pubsub_remarks'
      ]
      const allValuesFilledForPubSubTable = Object.keys(message).every((key) => {
        if (columnsToIgnoreForPubSubTable.includes(key)) return true
        const rowValue = message[key]
        return rowValue !== undefined && rowValue !== null && String(rowValue).trim() !== ''
      })

      if (!allValuesFilledForPubSubTable) {
        return
      }

      try {
        const targetName = message.pubsub_receiver
        const workerBase64Signature = await window.electron.ipcRenderer.invoke(
          'get-worker-signature',
          targetName
        )

        if (!workerBase64Signature) {
          return
        }

        if (allValuesFilledForPubSubTable) {
          isPublishingActive.current = true
          setIsLoading(true)

          const rowDeleted = await window.electron.ipcRenderer.invoke(
            'delete-row',
            JSON.stringify(message)
          )

          if (!rowDeleted) {
            console.error('Failed to delete row from local storage before publishing:', message)
            return
          }

          setIsDeleting(true)

          setPubSubTableData((prev) => {
            const safePrev = Array.isArray(prev) ? prev : []
            return safePrev.filter(
              (item) =>
                !(
                  item.id === message.id &&
                  item.subscriptionNameOrId === message.subscriptionNameOrId
                )
            )
          })

          const messageWithBase64Signature = {
            id: message.id,
            dateofreceived: message.pubsub_dateofreceived,
            registrynumber: message.pubsub_registrynumber,
            towhomreceived: message.pubsub_towhomreceived,
            dateofletter: message.pubsub_dateofletter,
            numberofletter: message.pubsub_numberofletter,
            subject: message.pubsub_subject,
            receiver: message.pubsub_receiver,
            remarks: message.pubsub_remarks,
            signature: workerBase64Signature,
            iDOnDespatchTable: message.id,
            ReceiveStatus: 'true',
            subscriptionNameOrId: message.subscriptionNameOrId
          }

          const response = await window.electron.ipcRenderer.invoke(
            'publish-row-to-receive-table',
            messageWithBase64Signature,
            isTableRefresh
          )

          if (response) {
            if (typeof response.newTotalNumberOfRows === 'number') {
              setTotalNumberOfReceiveRows(response.newTotalNumberOfRows)
            }

            if (receiveTableRef?.current) {
              await receiveTableRef.current.setPage(response.pageNumber)
            }

            const freshPageData = await window.electron.ipcRenderer.invoke(
              'load-receive-table-data-asynchronous',
              response.pageNumber
            )
            if (receiveTableRef?.current) {
              receiveTableRef.current.setSkipNextAutosave()
            }
            if (freshPageData) setReceiveTableRowData(freshPageData)
          } else {
            console.error(
              'publish-row-to-receive-table returned nothing — check main-process logs.'
            )
          }

          await window.electron.ipcRenderer.invoke(
            'publish-message',
            JSON.stringify(messageWithBase64Signature)
          )

          setIsDeleting(false)
        }
      } finally {
        isPublishingActive.current = false
        setIsLoading(false)
      }
    }

    isOnline &&
      rowForPubSubTable !== null &&
      rowForPubSubTable !== undefined &&
      publishMessage(rowForPubSubTable)
  }, [rowForPubSubTable])

  useEffect(() => {
    if (viewMode === 'Despatch') {
      setIsSelectable(false)
    } else if (viewMode === 'Receive') {
      setIsSelectable(true)
    }

    if (isFirstMountForPubSub.current) {
      isFirstMountForPubSub.current = false
      return
    }

    setIsLoadingForPubSubTable(true)
    setTimeout(() => {
      setIsLoadingForPubSubTable(false)
    }, 300)
  }, [viewMode])

  const handleCellEdit = ({ accessor, newValue, row }) => {
    console.log('[pubsub] handleCellEdit fired:', { accessor, newValue, rowId: row.id })
    if (newValue === '+ Add New Department') {
      localStorage.setItem('pubsubActiveEditedRow', JSON.stringify(row))
      localStorage.setItem('pubsubActiveEditedAccessor', accessor)
      window.electron.ipcRenderer.invoke('open-department-window')
      return
    }

    if (newValue === '+ Add New Worker') {
      localStorage.setItem('pubsubActiveEditedRow', JSON.stringify(row))
      localStorage.setItem('pubsubActiveEditedAccessor', accessor)
      window.electron.ipcRenderer.invoke('open-worker-window')
      return
    }

    setDontSave(false)
    setIsLoadingForPubSubTable(true)
    setRowForPubSubTable(row)
    setNewValueForPubSubTable(newValue)
    setAccessorForPubSubTable(accessor)

    setPubSubTableData((prev) => {
      const safePrev = Array.isArray(prev) ? prev : []
      return safePrev.map((item) => (item.id === row.id ? { ...item, [accessor]: newValue } : item))
    })
  }
  useEffect(() => {
    if (!rowForPubSubTable) return

    const isRowEmpty =
      (!rowForPubSubTable.pubsub_dateofreceived ||
        String(rowForPubSubTable.pubsub_dateofreceived).trim() === '') &&
      (!rowForPubSubTable.pubsub_registrynumber ||
        rowForPubSubTable.pubsub_registrynumber.trim() === '') &&
      (!rowForPubSubTable.pubsub_towhomreceived ||
        rowForPubSubTable.pubsub_towhomreceived.trim() === '') &&
      (!rowForPubSubTable.pubsub_numberofletter ||
        rowForPubSubTable.pubsub_numberofletter.trim() === '') &&
      (!rowForPubSubTable.pubsub_receiver || rowForPubSubTable.pubsub_receiver.trim() === '') &&
      (!rowForPubSubTable.pubsub_remarks || rowForPubSubTable.pubsub_remarks.trim() === '')

    if (!isRowEmpty) return

    const rowKey = `${rowForPubSubTable.id}-${rowForPubSubTable.subscriptionNameOrId}`
    if (isDeletingRowRef.current === rowKey) return
    isDeletingRowRef.current = rowKey

    const removeRow = async () => {
      setIsDeleting(true)
      const rowDeleted = await window.electron.ipcRenderer.invoke(
        'delete-row',
        JSON.stringify(rowForPubSubTable)
      )
      if (rowDeleted) {
        setPubSubTableData((prev) =>
          prev.filter(
            (item) =>
              !(
                item.id === rowForPubSubTable.id &&
                item.subscriptionNameOrId === rowForPubSubTable.subscriptionNameOrId
              )
          )
        )
      } else {
        console.warn('[pubsub-cleanup] delete-row failed for:', rowForPubSubTable.id)
      }
      isDeletingRowRef.current = null
      setIsDeleting(false)
      setRowForPubSubTable(null)
    }
    removeRow()
  }, [rowForPubSubTable])

  const columnHeaders = [
    { accessor: 'id', label: 'ID', width: 50, isSortable: true, type: 'number' },
    {
      accessor: 'pubsub_dateofreceived',
      label: 'Date of Received',
      width: '150',
      isSortable: true,
      isEditable: isSelectable,
      type: 'date',
      filterable: true,
      valueFormatter: ({ value }) => (value ? new Date(value).toLocaleDateString('en-GB') : '')
    },
    {
      accessor: 'pubsub_registrynumber',
      label: 'Registry Number',
      width: '150',
      isSortable: true,
      isEditable: isSelectable,
      type: 'string',
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
      accessor: 'pubsub_towhomreceived',
      label: 'To Whom Received',
      width: 150,
      isSortable: true,
      isEditable: isSelectable,
      type: 'enum',
      enumOptions: departmentEnumOptions,
      filterable: true
    },
    {
      accessor: 'pubsub_dateofletter',
      label: 'Date of Letter',
      width: 150,
      isSortable: true,
      type: 'date',
      filterable: true,
      valueFormatter: ({ value }) => (value ? new Date(value).toLocaleDateString('en-GB') : '')
    },
    {
      accessor: 'pubsub_numberofletter',
      label: 'Number of Letter',
      width: '150',
      isSortable: true,
      isEditable: isSelectable,
      type: 'string',
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
      accessor: 'pubsub_subject',
      label: 'Subject',
      width: '150',
      isSortable: true,
      type: 'string',
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
      accessor: 'pubsub_receiver',
      label: 'Receiver',
      width: '150',
      isSortable: true,
      type: 'enum',
      isEditable: isSelectable,
      filterable: true,
      enumOptions: peopleEnumOptions
    },
    {
      accessor: 'pubsub_remarks',
      label: 'Remarks',
      width: '150',
      isSortable: true,
      isEditable: isSelectable,
      type: 'string',
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
      accessor: 'pubsub_signature',
      label: 'Signature',
      width: 150,
      isSortable: true,
      type: 'string',
      cellRenderer: ({ row }) => <SignatureCell row={row} />
    }
  ]

  const dynamicHeaders = useMemo(() => {
    const savedWidths = JSON.parse(localStorage.getItem('pubsubColumnWidths') || '{}')
    const savedOrder = JSON.parse(localStorage.getItem('pubsubColumnOrder'))

    const baseHeaders = columnHeaders.map((col) => ({
      ...col,
      width: savedWidths[col.accessor] || col.width,
      align: tableSettings?.[`align_${col.accessor}`] || 'left',
      excludeFromCsv: tableSettings?.[`exclude_${col.accessor}`] || false
    }))

    return savedOrder
      ? savedOrder.map((savedCol) => baseHeaders.find((h) => h.accessor === savedCol.accessor))
      : baseHeaders
  }, [tableSettings, departmentEnumOptions, peopleEnumOptions, isSelectable])

  return (
    <SimpleTable
      key={`pubsub-table-${peopleEnumOptions.length}-${departmentEnumOptions.length}-${isSelectable}`}
      defaultHeaders={dynamicHeaders}
      rows={pubSubTableData || []}
      height={'100px'}
      autoExpandColumns={true}
      theme={tableSettings?.theme ?? 'light'}
      selectableCells={true}
      selectableColumns={true}
      columnResizing={true}
      columnReordering={tableSettings?.columnReordering}
      onColumnWidthChange={(headers) => {
        localStorage.setItem(
          'pubsubColumnWidths',
          JSON.stringify(Object.fromEntries(headers.map((h) => [h.accessor, h.width])))
        )
      }}
      onColumnOrderChange={(newHeaders) => {
        localStorage.setItem('pubsubColumnOrder', JSON.stringify(newHeaders))
      }}
      columnBorders={tableSettings?.columnBorders}
      useHoverRowBackground={tableSettings?.useHoverRowBackground}
      useOddEvenRowBackground={tableSettings?.useOddEvenRowBackground}
      customTheme={{ rowHeight: tableSettings?.rowHeight ?? 50 }}
      onCellEdit={handleCellEdit}
      isLoading={isLoadingForPubSubTable}
      enableRowSelection={true}
    />
  )
}

export default PubSubTable
