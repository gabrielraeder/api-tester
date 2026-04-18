import { Topbar, Sidebar, TabBar, RequestBuilder, ResponseViewer } from '@api-tester/ui'

export function App() {
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
