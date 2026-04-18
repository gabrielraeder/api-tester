import { useEffect } from 'react'
import { Topbar, Sidebar, TabBar, RequestBuilder, ResponseViewer, useStore } from '@api-tester/ui'

export function App() {
  const flushDirtyTabs = useStore(s => s.flushDirtyTabs)

  useEffect(() => {
    // Flush any dirty tabs left from a previous session
    flushDirtyTabs()

    // Periodic flush every 30 seconds
    const interval = setInterval(flushDirtyTabs, 30_000)

    // Flush when the user switches away or closes the tab
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flushDirtyTabs() }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [flushDirtyTabs])

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-col flex-1 overflow-hidden">
          <TabBar />
          <div className="flex flex-1 overflow-hidden">
            {/* Left: request builder */}
            <div className="flex flex-col w-1/2 border-r border-gray-700 overflow-hidden">
              <RequestBuilder />
            </div>
            {/* Right: response viewer */}
            <div className="flex flex-col w-1/2 overflow-hidden">
              <ResponseViewer />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
