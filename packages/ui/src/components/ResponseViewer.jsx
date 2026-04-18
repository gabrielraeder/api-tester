import { useStore, activeTab } from '../store.js'

const STATUS_COLORS = {
  2: 'text-green-400',
  3: 'text-yellow-400',
  4: 'text-red-400',
  5: 'text-red-500',
}

export function ResponseViewer() {
  const tab = useStore(activeTab)
  const responses = useStore(s => s.responses)
  const loading = useStore(s => s.loading)

  if (!tab) return null

  const isLoading = loading[tab.id]
  const response = responses[tab.id]

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Sending request…
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Hit Send to see a response
      </div>
    )
  }

  if (response.error) {
    return (
      <div className="flex-1 p-4 text-red-400 text-sm font-mono">
        Error: {response.error}
      </div>
    )
  }

  const statusColor = STATUS_COLORS[Math.floor(response.status / 100)] ?? 'text-gray-400'
  const prettyBody = tryPrettify(response.body)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-700 bg-gray-900 text-xs shrink-0">
        <span className={`font-bold ${statusColor}`}>
          {response.status} {response.statusText}
        </span>
        <span className="text-gray-400">{response.elapsed}ms</span>
        <span className="text-gray-400">{formatSize(response.size)}</span>
      </div>

      {/* Response tabs: Body / Headers */}
      <ResponseTabs response={response} prettyBody={prettyBody} />
    </div>
  )
}

function ResponseTabs({ response, prettyBody }) {
  const [tab, setTab] = useState('body')

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex border-b border-gray-700 px-3 shrink-0">
        {['body', 'headers'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs capitalize border-b-2 ${
              tab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
            {t === 'headers' && (
              <span className="ml-1 text-gray-600">({Object.keys(response.headers).length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'body' && (
          <pre className="p-4 text-xs font-mono text-gray-200 whitespace-pre-wrap break-all leading-relaxed">
            {prettyBody}
          </pre>
        )}
        {tab === 'headers' && (
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(response.headers).map(([k, v]) => (
                <tr key={k} className="border-b border-gray-800">
                  <td className="px-4 py-1.5 text-gray-400 font-mono w-1/3">{k}</td>
                  <td className="px-4 py-1.5 text-gray-200 font-mono break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// useState needs to be imported — add it
import { useState } from 'react'

function tryPrettify(body) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
