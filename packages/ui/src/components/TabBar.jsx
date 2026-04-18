import { useStore } from '../store.js'
import { VscClose, VscAdd } from 'react-icons/vsc'

const METHOD_COLORS = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
}

export function TabBar() {
  const tabs = useStore(s => s.tabs)
  const activeTabId = useStore(s => s.activeTabId)
  const setActiveTab = useStore(s => s.setActiveTab)
  const closeTab = useStore(s => s.closeTab)
  const newTab = useStore(s => s.newTab)

  return (
    <div className="flex items-center bg-gray-900 border-b border-gray-700 overflow-x-auto min-h-[36px]">
      {tabs.map(tab => (
        <div
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-gray-700 cursor-pointer shrink-0 max-w-[180px] group ${
            activeTabId === tab.id ? 'bg-gray-800 border-b-2 border-b-blue-500' : 'hover:bg-gray-800'
          }`}
        >
          <span className={`text-xs font-mono font-bold ${METHOD_COLORS[tab.method] ?? 'text-gray-400'}`}>
            {tab.method}
          </span>
          <span className="text-xs text-gray-300 truncate">{tab.name || 'Untitled'}</span>
          <button
            onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
            className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 ml-auto p-0.5 rounded"
          ><VscClose className="w-3 h-3" /></button>
        </div>
      ))}
      <button
        onClick={newTab}
        className="px-2 py-1.5 text-gray-500 hover:text-white shrink-0 flex items-center"
        title="New tab"
      ><VscAdd className="w-4 h-4" /></button>
    </div>
  )
}
