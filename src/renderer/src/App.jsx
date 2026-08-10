import 'handsontable/styles/handsontable.css'
import 'handsontable/styles/ht-theme-main.css'
import { useContext, useEffect, useRef } from 'react'
import mosrLogo from '../src/assets/mosr_logo/mosr-logo.png'
import { Googledrivesvg } from '../src/components/svgs'

import Mode from '../src/components/drop-down'

import { registerAllModules } from 'handsontable/registry'
import { useState } from 'react'

import CircularProgress from '@mui/material/CircularProgress'
import AddNewDepartmentDialogBox from './components/add-new-department'
import AddNewWorkerDialogBox from './components/add-new-worker'
import DespatchTable from './components/despatch-table'
import Oauth2 from './components/oauth2'
import PubSubTable from './components/pub-sub-table'
import ReceiveTable from './components/receive-table'
import SettingsPopover from './components/SettingsPopover'
import { AppContext } from './components/state-provider'

registerAllModules()

const App = () => {
  const currentHash = window.location.hash
  if (currentHash.includes('add-department')) {
    return (
      <AddNewDepartmentDialogBox
        open={true}
        handleClose={() => window.electron.ipcRenderer.invoke('close-department-window')}
      />
    )
  }
  if (currentHash.includes('add-worker')) {
    return (
      <AddNewWorkerDialogBox
        open={true}
        handleClose={() => window.electron.ipcRenderer.invoke('close-worker-window')}
      />
    )
  }

  const {
    isTokenCreatedAndSavedSuccessfully,
    setIsTokenCreatedAndSavedSuccessfully,
    isAuthenticatedWithGoogle,
    setIsAuthenticatedWithGoogle,
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
    open,
    setOpen,
    openNewWorkerDialogBox,
    setOpenNewWorkerDialogBox,
    viewMode,
    setViewMode,
    isLoading,
    setIsLoading,
    authCode,
    setPubSubTableData,
    pubSubTableData,
    isLoadingForPubSubTable,
    setIsLoadingForPubSubTable,
    loadingMessagePubSubTable,
    setLoadingMessagePubSubTable,
    departmentEnumOptions,
    peopleEnumOptions,
    pageNumber,

    tableSettings,
    setTableSettings,
    reMountDispatchComponent,
    setReMountDispatchComponent,
    reMountReceiveComponent,
    setReMountReceiveComponent,
    receiveTableRef,
    setIsRendered
  } = useContext(AppContext)
  const [authUrl, setAuthUrl] = useState(null)

  const despatchTableRef = useRef()
  const [isMosrHovered, setIsMosrHovered] = useState(false)
  useEffect(() => {
    console.log(
      'isTokenCreatedAndSavedSuccessfully in App component:',
      isTokenCreatedAndSavedSuccessfully
    )
  }, [isTokenCreatedAndSavedSuccessfully])

  useEffect(() => {
    if (isAuthenticatedWithGoogle) {
      console.log('User is authenticated with Google. Loading client...')
    } else {
      console.log('User is not authenticated with Google. Generating auth URL...')
      ;(async () => {
        const generatedAuthUrl = await window.electron.ipcRenderer.invoke('generate-auth-url')
        setAuthUrl(generatedAuthUrl)
      })()
    }
  }, [isAuthenticatedWithGoogle])

  useEffect(() => {
    const initialize = async () => {
      const tokenExists = await window.electron.ipcRenderer.invoke('check-google-token-existence')
      setIsAuthenticatedWithGoogle(tokenExists)
    }
    initialize()

    window.api.onTokenExpired(() => {
      setIsTokenCreatedAndSavedSuccessfully(false)
    })

    return () => {
      window.api.removeTokenExpiredListener()
    }
  }, [])
  const addNewEmptyDespatchPage = () => {
    despatchTableRef.current.addNewEmptyDespatchPage()
  }
  const downloadFromGoogleDrive = () => {
    const activeRef = viewMode === 'Despatch' ? despatchTableRef : receiveTableRef
    if (!activeRef.current) return

    if (tableSettings.targetPagesToDownload === 'All Pages') {
      activeRef.current.downloadAllPages()
    } else {
      activeRef.current.downloadCurrentPage()
    }
  }

  const exportToCSV = () => {
    if (viewMode === 'Despatch') {
      despatchTableRef.current?.exportToCSV()
    } else {
      receiveTableRef.current?.exportToCSV()
    }
  }

  return (
    <>
      <div className="animate-slideshow bg-[#eaf4ff] min-h-screen w-screen flex flex-col items-center">
        {!isAuthenticatedWithGoogle && !isTokenCreatedAndSavedSuccessfully ? (
          <div className="w-full flex flex-col items-center justify-center p-80">
            <Oauth2 authUrl={authUrl} />
          </div>
        ) : (
          <>
            {/* Navigation Bar */}
            <div className="sticky top-0 z-150 bg-[#1768da] w-full py-2 flex flex-row items-center justify-center">
              <Googledrivesvg className="absolute left-2 z-0" width="37" height="37" />
              <h2 className="absolute left-13 text-white text-2xl font-bold">
                Linked to Google Drive
              </h2>
              <Mode />
              <span className="text-white text-2xl font-bold ml-2">Document</span>
              <div className="flex flex-row items-center justify-center text-center absolute right-16">
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-white text-sm font-bold leading-tight">
                    MINISTRY OF SPORTS
                  </span>
                  <span className="text-white text-lg font-bold leading-tight">AND RECREATION</span>
                </div>
                <div className="h-8 w-[1px] bg-white mx-1" />
              </div>

              <div
                className="absolute right-5 h-11 w-11 flex justify-center items-center rounded-full bg-white cursor-pointer"
                onMouseEnter={() => setIsMosrHovered(true)}
                onMouseLeave={() => setIsMosrHovered(false)}
              >
                <img style={{ width: '100%', height: '100%' }} src={mosrLogo} alt="mosr-logo" />
                {isMosrHovered && (
                  <SettingsPopover
                    addNewEmptyDespatchPage={addNewEmptyDespatchPage}
                    downloadFromGoogleDrive={downloadFromGoogleDrive}
                    exportToCSV={exportToCSV}
                  />
                )}
              </div>
            </div>

            {/* THE PUBSUB LIVE STATUS */}

            <div className="w-full flex flex-col items-center mt-12 px-24 min-w-0">
              <div
                className="w-full min-w-0 flex flex-col items-center relative"
                style={{ minHeight: isLoadingForPubSubTable ? '100px' : undefined }}
              >
                {/* PubSub Skeleton Loader */}
                {isLoadingForPubSubTable && (
                  <div
                    style={{ height: '100px' }}
                    className="absolute top-0 left-0 w-full bg-white rounded-sm flex flex-col items-center justify-center animate-pulse z-20"
                  >
                    <div className="flex flex-col items-center justify-center mb-1 rounded-sm p-1 relative">
                      <img src={mosrLogo} alt="Loading..." className="h-8 w-8" />
                      <CircularProgress
                        className="absolute z-10"
                        size="2.5rem"
                        aria-label="Loading…"
                      />
                    </div>
                    <span className="font-bold text-black text-sm">
                      {loadingMessagePubSubTable}
                    </span>
                  </div>
                )}

                {pubSubTableData.length > 0 && (
                  <div className="absolute -top-3.5 -left-1.5 z-110 bg-red-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 border border-red-500 transform -rotate-12 origin-bottom-right">
                    {/* Bell Icon */}
                    <svg
                      className="w-3.5 h-3.5 text-white animate-bounce"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      ></path>
                    </svg>
                    <span className="bg-red-800 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                      {pubSubTableData.length || 0}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    opacity: isLoadingForPubSubTable ? 0 : 1,
                    visibility: isLoadingForPubSubTable ? 'hidden' : 'visible'
                  }}
                  className="w-full min-w-0 overflow-x-auto transition-opacity duration-200 ease-in-out z-100"
                >
                  <PubSubTable key={`${JSON.stringify(tableSettings)}`} />
                </div>
              </div>
            </div>

            {/* TABLES CONTAINER */}
            <div className="w-full flex flex-col items-center px-24 mt-6 mb-12 min-w-0">
              <div
                className="w-full min-w-0 flex flex-col items-center relative"
                style={{ minHeight: isLoading ? '800px' : undefined }}
              >
                {/* Tables Skeleton Loader */}
                {isLoading && (
                  <div
                    style={{ height: '800px' }}
                    className="absolute top-0 left-0 w-full bg-white rounded-sm flex flex-col items-center justify-center animate-pulse z-20"
                  >
                    <div className="flex flex-col items-center justify-center mb-3 rounded-sm p-3 relative">
                      <img src={mosrLogo} alt="Loading..." className="h-17 w-17" />
                      <CircularProgress
                        className="absolute z-10"
                        size="5rem"
                        aria-label="Loading…"
                      />
                    </div>
                    <span className="font-bold text-black text-2xl">{loadingMessage}</span>
                  </div>
                )}

                {/* Despatch / Receive Table Components */}
                <div
                  style={{
                    opacity: isLoading ? 0 : 1,
                    visibility: isLoading ? 'hidden' : 'visible'
                  }}
                  className={`w-full min-w-0 overflow-x-auto transition-opacity duration-200 ease-in-out ${viewMode === 'Despatch' ? 'z-110' : 'z-10'}`}
                >
                  {viewMode === 'Despatch' ? (
                    <DespatchTable
                      ref={despatchTableRef}
                      key={`${JSON.stringify(tableSettings)}-${reMountDispatchComponent}`}
                    />
                  ) : (
                    <ReceiveTable
                      ref={receiveTableRef}
                      key={`${JSON.stringify(tableSettings)}-${reMountReceiveComponent}`}
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default App
