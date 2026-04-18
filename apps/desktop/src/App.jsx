import { useEffect } from 'react'
import { Topbar, Sidebar, TabBar, RequestBuilder, ResponseViewer, useStore, activeTab } from '@api-tester/ui'
import { interpolateRequest } from '@api-tester/core/env'

// Override the send logic for desktop: use native IPC, no proxy needed
function useDesktopSend() {
  const tab = useStore(activeTab)
  const setResponse = useStore(s => s.setResponse)
  const setLoading = useStore(s => s.setLoading)
  const addHistory = useStore(s => s.addHistory)
  const environments = useStore(s => s.environments)
  const activeEnvId = useStore(s => s.activeEnvId)

  return async function send() {
    if (!tab) return
    const activeEnvVars = environments.find(e => e.id === activeEnvId)?.variables ?? {}
    setLoading(tab.id, true)
    try {
      const resolved = interpolateRequest(tab, activeEnvVars)
      const start = Date.now()
      const result = await window.electronAPI.executeRequest(resolved)
      const elapsed = Date.now() - start
      if (!result.ok) throw new Error(result.error)
      const response = {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: result.body,
        elapsed,
        size: new TextEncoder().encode(result.body).length,
      }
      setResponse(tab.id, response)
      addHistory({ ...resolved, timestamp: Date.now(), response })
    } catch (err) {
      setResponse(tab.id, { error: err.message })
    } finally {
      setLoading(tab.id, false)
    }
  }
}

export function App() {
  const send = useDesktopSend()

  // Expose send to RequestBuilder via a global so it can be overridden
  useEffect(() => {
    window.__desktopSend = send
  }, [send])

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-col flex-1 overflow-hidden">
          <TabBar />
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-col w-1/2 border-r border-gray-700 overflow-hidden">
              <RequestBuilder onSend={send} />
            </div>
            <div className="flex flex-col w-1/2 overflow-hidden">
              <ResponseViewer />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
