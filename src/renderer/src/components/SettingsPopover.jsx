/* eslint-disable react/prop-types */
import { AddCircle, Download, Refresh, RestartAlt } from '@mui/icons-material'
import Button from '@mui/material/Button'
import { useContext, useEffect, useRef } from 'react'
import { AppContext } from './state-provider'
import { Googledrivesvg } from './svgs'

export default function SettingsPopover({
  addNewEmptyDespatchPage,
  downloadFromGoogleDrive,
  exportToCSV
}) {
  const {
    tableSettings,
    setTableSettings,
    viewMode,
    isLoading,
    setIsLoading,
    setReMountDispatchComponent,
    DEFAULT_TABLE_SETTINGS,
    isTableSettingsRefresh,
    setIsTableSettingRefresh,
    isLoadingForPubSubTable,
    setIsLoadingForPubSubTable,
    reMountDispatchComponent,
    departmentEnumOptions,
    setDepartmentEnumOptions,
    peopleEnumOptions,
    setPeopleEnumOptions,
    departmentToDelete,
    setDepartmentToDelete,
    workerToDelete,
    setWorkerToDelete,
    setDepartmentenumOptions
  } = useContext(AppContext)

  const scrollRef = useRef(null)

  useEffect(() => {
    const savedScroll = localStorage.getItem('settingsPopoverScroll')
    if (savedScroll && scrollRef.current) {
      scrollRef.current.scrollTop = Number(savedScroll)
    }
  }, [])

  const handleScroll = (e) => {
    localStorage.setItem('settingsPopoverScroll', e.target.scrollTop)
  }

  const handleDeleteDepartment = async () => {
    if (!departmentToDelete) return
    const success = await window.electron.ipcRenderer.invoke(
      'delete-department-enum-option',
      departmentToDelete
    )
    if (success) {
      setIsLoading(true)

      setIsLoadingForPubSubTable(true)

      setTimeout(() => {
        setIsLoading(false)
        setIsLoadingForPubSubTable(false)
      }, 300)

      setDepartmentenumOptions((prev) => prev.filter((d) => d.value !== departmentToDelete))
      setDepartmentToDelete('')
    }
  }

  const handleDeleteWorker = async () => {
    if (!workerToDelete) return
    const success = await window.electron.ipcRenderer.invoke(
      'delete-people-enum-option',
      workerToDelete
    )
    if (success) {
      setIsLoading(true)

      setIsLoadingForPubSubTable(true)

      setTimeout(() => {
        setIsLoading(false)
        setIsLoadingForPubSubTable(false)
      }, 300)
      setPeopleEnumOptions((prev) => prev.filter((w) => w.value !== workerToDelete))
      setWorkerToDelete('')
      return
    }
    setIsLoading(false)
    setIsLoadingForPubSubTable(false)
  }
  const updateSetting = (key, value) => {
    setIsLoadingForPubSubTable(true)
    setIsLoading(true)
    setIsTableSettingRefresh(true)
    setTableSettings((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  const handleResetSettings = () => {
    setIsLoadingForPubSubTable(true)
    setIsLoading(true)
    setTimeout(() => {
      setIsLoadingForPubSubTable(false)
      setIsLoading(false)
    }, 300)
    setIsTableSettingRefresh(true)

    localStorage.removeItem('docutrack-table-settings')
    localStorage.removeItem('despatchColumnWidths')
    localStorage.removeItem('despatchColumnOrder')
    localStorage.removeItem('receiveColumnWidths')
    localStorage.removeItem('receiveColumnOrder')
    localStorage.removeItem('pubsubColumnWidths')
    localStorage.removeItem('pubsubColumnOrder')
    localStorage.removeItem('settingsPopoverScroll')

    setTableSettings(DEFAULT_TABLE_SETTINGS)
  }

  const handleReauthenticateDrive = async () => {
    setIsLoading(true)
    const response = await window.electron.ipcRenderer.invoke('delete-authentication-token')
    setIsLoading(false)
    if (response.status === 'success') {
      window.location.reload()
    } else if (response.status === 'error') {
      alert('Failed to clear credentials cleanly. Check application log data.')
    }
  }

  const despatchColumns = [
    { accessor: 'id', label: 'ID' },
    { accessor: 'dateofdespatch', label: 'Date of Despatch' },
    { accessor: 'registrynumber', label: 'Registry Number' },
    { accessor: 'towhomsent', label: 'To Whom Sent' },
    { accessor: 'dateofletter', label: 'Date of Letter' },
    { accessor: 'numberofletter', label: 'Number of Letter' },
    { accessor: 'subject', label: 'Subject' },
    { accessor: 'despatcher', label: 'Despatcher' },
    { accessor: 'remarks', label: 'Remarks' }
  ]

  const receiveColumns = [
    { accessor: 'id', label: 'ID' },
    { accessor: 'dateofreceived', label: 'Date of Received' },
    { accessor: 'registrynumber', label: 'Registry Number' },
    { accessor: 'towhomreceived', label: 'To Whom Received' },
    { accessor: 'dateofletter', label: 'Date of Letter' },
    { accessor: 'numberofletter', label: 'Number of Letter' },
    { accessor: 'subject', label: 'Subject' },
    { accessor: 'receiver', label: 'Receiver' },
    { accessor: 'remarks', label: 'Remarks' }
  ]

  const columnsToConfigure = viewMode === 'Receive' ? receiveColumns : despatchColumns

  const allExcluded = columnsToConfigure.every(
    (col) => tableSettings[`exclude_${col.accessor}`] === true
  )
  return (
    <div className="absolute right-0 top-full pt-4 -mt-4 w-72 z-50 text-slate-800">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="mt-2 rounded-lg border border-slate-200 bg-white p-4 shadow-xl max-h-[85vh] overflow-y-auto flex flex-col gap-4"
      >
        {/* ================= SECTION 1: VISUALS & SIZING ================= */}
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase pb-1 border-b">
            Visuals & Sizing
          </h3>
          <div className="space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer text-xs">
              <span>Show Column Borders</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={tableSettings.columnBorders ?? true}
                onChange={(e) => updateSetting('columnBorders', e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer text-xs">
              <span>Highlight Row on Hover</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={tableSettings.useHoverRowBackground ?? true}
                onChange={(e) => updateSetting('useHoverRowBackground', e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer text-xs">
              <span>Zebra Striping</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={tableSettings.useOddEvenRowBackground ?? false}
                onChange={(e) => updateSetting('useOddEvenRowBackground', e.target.checked)}
              />
            </label>

            <div className="flex items-center justify-between text-xs">
              <span>Row Height (px)</span>
              <input
                type="number"
                min="30"
                max="120"
                className="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-right focus:border-blue-500 focus:outline-none"
                value={tableSettings.rowHeight ?? 40}
                onChange={(e) => updateSetting('rowHeight', Number(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span>Table Theme</span>
              <select
                className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none w-32"
                value={tableSettings.theme ?? 'light'}
                onChange={(e) => updateSetting('theme', e.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="neutral">Neutral</option>
                <option value="modern-light">Modern Light</option>
                <option value="modern-dark">Modern Dark</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        </div>

        {/* ================= SECTION 2: INTERACTIVE FEATURES ================= */}
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase pb-1 border-b">
            Interactive Features
          </h3>
          <div className="space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer text-xs">
              <span>Enable Column Resizing</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={tableSettings.columnResizing ?? true}
                onChange={(e) => updateSetting('columnResizing', e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer text-xs">
              <span>Enable Column Reordering</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={tableSettings.columnReordering ?? true}
                onChange={(e) => updateSetting('columnReordering', e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* ================= SECTION 3: COLUMN ALIGNMENT ================= */}
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase pb-1 border-b">
            Column Alignment
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs bg-slate-50 p-1.5 rounded border border-slate-200">
              <span className="font-medium text-slate-600">Align All To:</span>
              <select
                className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                value={tableSettings.alignAllMode || 'individual'}
                onChange={(e) => {
                  const mode = e.target.value
                  setIsLoading(true)
                  updateSetting('alignAllMode', mode)
                  if (mode !== 'individual') {
                    columnsToConfigure.forEach((col) => {
                      updateSetting(`align_${col.accessor}`, mode)
                    })
                  }
                }}
              >
                <option value="individual">Individual</option>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>

            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
              {columnsToConfigure.map((col) => {
                const currentAlign = tableSettings[`align_${col.accessor}`] || 'left'
                return (
                  <div key={col.accessor} className="flex items-center justify-between text-xs">
                    <span className="truncate w-32" title={col.label}>
                      {col.label}
                    </span>
                    <select
                      className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                      value={currentAlign}
                      disabled={
                        tableSettings.alignAllMode && tableSettings.alignAllMode !== 'individual'
                      }
                      onChange={(e) => {
                        updateSetting('alignAllMode', 'individual')
                        updateSetting(`align_${col.accessor}`, e.target.value)
                      }}
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ================= REGROUPED SECTION: EXPORT TO CSV OPTIONS ================= */}
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase pb-1 border-b">
            Export to CSV Settings
          </h3>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs bg-slate-50 p-1.5 rounded border border-slate-200">
              <span className="font-medium text-slate-600">Exclude All</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                checked={allExcluded}
                onChange={(e) => {
                  const shouldExcludeAll = e.target.checked
                  setIsLoading(true)
                  columnsToConfigure.forEach((col) => {
                    updateSetting(`exclude_${col.accessor}`, shouldExcludeAll)
                  })
                }}
              />
            </div>

            <div className="space-y-2 max-h-32 overflow-y-auto pr-1 pl-0.5">
              {columnsToConfigure.map((col) => {
                const isExcluded = tableSettings[`exclude_${col.accessor}`] || false
                return (
                  <label
                    key={col.accessor}
                    className="flex items-center justify-between cursor-pointer text-xs"
                  >
                    <span className="truncate w-40" title={col.label}>
                      {col.label}
                    </span>
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      checked={isExcluded}
                      onChange={(e) => {
                        updateSetting(`exclude_${col.accessor}`, e.target.checked)
                      }}
                    />
                  </label>
                )
              })}
            </div>

            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<Download style={{ fontSize: '1.1rem' }} />}
              disabled={isLoading}
              sx={{
                width: '100%',
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                paddingY: 1,
                marginTop: 0.5,
                backgroundColor: '#1768da'
              }}
              onClick={() => exportToCSV()}
            >
              Export Table to CSV
            </Button>
          </div>
        </div>

        {/* ================= SECTION 5: TABLE ACTIONS ================= */}

        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase pb-1 border-b">
            Table Actions
          </h3>
          <div className="flex flex-col gap-3.5 w-full mt-2">
            {viewMode === 'Receive' && (
              <div className="border border-dashed border-slate-200 p-2 rounded bg-slate-50 flex flex-col gap-2">
                <span className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                  Receive Table Access
                </span>
                <label className="flex items-center justify-between cursor-pointer text-xs">
                  <span>Lock Receive Table (Read-Only)</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={tableSettings.receive_locked ?? false}
                    onChange={(e) => updateSetting('receive_locked', e.target.checked)}
                  />
                </label>
              </div>
            )}

            {/* Remove a Department Section */}
            <div className="border border-dashed border-slate-200 p-2 rounded bg-slate-50 flex flex-col gap-2">
              <span className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                Remove a Department
              </span>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  value={departmentToDelete}
                  onChange={(e) => setDepartmentToDelete(e.target.value)}
                >
                  <option value="">Select department...</option>
                  {departmentEnumOptions
                    .filter((d) => !d.value.startsWith('+ Add New'))
                    .map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                </select>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={handleDeleteDepartment}
                  disabled={!departmentToDelete}
                >
                  Remove
                </Button>
              </div>
            </div>

            {/* Remove a Worker Section (New) */}
            <div className="border border-dashed border-slate-200 p-2 rounded bg-slate-50 flex flex-col gap-2">
              <span className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                Remove a Worker
              </span>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  value={workerToDelete}
                  onChange={(e) => setWorkerToDelete(e.target.value)}
                >
                  <option value="">Select worker...</option>
                  {peopleEnumOptions
                    .filter((w) => !w.value.startsWith('+ Add New'))
                    .map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                </select>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={handleDeleteWorker}
                  disabled={!workerToDelete}
                >
                  Remove
                </Button>
              </div>
            </div>

            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddCircle style={{ fontSize: '1.1rem' }} />}
              disabled={viewMode !== 'Despatch' || isLoading}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                paddingY: 1,
                backgroundColor: viewMode === 'Despatch' && !isLoading ? '#1768da' : 'inherit'
              }}
              onClick={addNewEmptyDespatchPage}
            >
              Add New Empty Despatch Page
            </Button>

            <div className="border border-dashed border-slate-200 p-2 rounded bg-slate-50 flex flex-col gap-2">
              <span className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                Select Target Pages To Download from Google Drive
              </span>

              <div className="flex flex-col gap-1.5 pl-0.5">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="targetPagesToDownload"
                    className="h-3.5 w-3.5 border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={
                      (tableSettings.targetPagesToDownload ?? 'Current Page Only') ===
                      'Current Page Only'
                    }
                    onChange={() => updateSetting('targetPagesToDownload', 'Current Page Only')}
                  />
                  <span>Current Page Only</span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="targetPagesToDownload"
                    className="h-3.5 w-3.5 border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={tableSettings.targetPagesToDownload === 'All Pages'}
                    onChange={() => updateSetting('targetPagesToDownload', 'All Pages')}
                  />
                  <span>All Pages</span>
                </label>
              </div>

              <Button
                variant="contained"
                size="small"
                disabled={isLoading}
                sx={{
                  textTransform: 'none',
                  backgroundColor: '#1768da',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  paddingY: 1,
                  marginTop: 0.5
                }}
                onClick={downloadFromGoogleDrive}
              >
                <Googledrivesvg width="16" height="16" className="mr-1" />
                Load Page from Google Drive
              </Button>
            </div>
          </div>
        </div>

        {/* ================= SECTION 6: SYSTEM & MAINTENANCE ================= */}
        <div className="pt-2 border-t border-slate-200">
          <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase pb-1 border-b">
            System & Maintenance
          </h3>
          <div className="flex flex-col gap-2 w-full mt-2">
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<RestartAlt style={{ fontSize: '1.1rem' }} />}
              disabled={isLoading}
              sx={{
                textTransform: 'none',
                fontSize: '0.725rem',
                fontWeight: '600',
                paddingY: 0.75,
                borderColor: '#cbd5e1',
                color: '#475569',
                '&:hover': { backgroundColor: '#f8fafc', borderColor: '#94a3b8' }
              }}
              onClick={handleResetSettings}
            >
              Reset Layout & Settings
            </Button>

            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<Refresh style={{ fontSize: '1.1rem' }} />}
              disabled={isLoading}
              sx={{
                textTransform: 'none',
                fontSize: '0.725rem',
                fontWeight: '600',
                paddingY: 0.75
              }}
              onClick={handleReauthenticateDrive}
            >
              Reauthenticate Google Drive
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
