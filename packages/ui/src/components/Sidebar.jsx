import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store.js'
import { createCollection, createRequest } from '@api-tester/core/collection'
import {
  VscChevronDown, VscChevronRight, VscEllipsis, VscAdd, VscClose,
  VscCloudDownload, VscNewFolder, VscNewFile,
} from 'react-icons/vsc'

const METHOD_COLORS = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
}

function ContextMenu({ items }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      // close unless clicking inside the portal menu
      if (!e.target.closest('[data-context-menu]') && !btnRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle(e) {
    e.stopPropagation()
    if (!open) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(o => !o)
  }

  const menu = open && createPortal(
    <div
      data-context-menu
      style={{ top: pos.top, left: pos.left }}
      className="fixed bg-gray-800 border border-gray-700 rounded shadow-xl z-[9999] py-1 min-w-[160px]"
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        item === 'divider'
          ? <div key={i} className="border-t border-gray-700 my-1" />
          : (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.action() }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-700 ${item.danger ? 'text-red-400 hover:text-red-300' : 'text-gray-200'}`}
            >
              {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0" />}
              {item.label}
            </button>
          )
      ))}
    </div>,
    document.body
  )

  return (
    <div onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={toggle}
        className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-gray-700 opacity-0 group-hover:opacity-100 flex items-center"
        title="More options"
      >
        <VscEllipsis className="w-3.5 h-3.5" />
      </button>
      {menu}
    </div>
  )
}

export function Sidebar() {
  const collections = useStore(s => s.collections)
  const openTab = useStore(s => s.openTab)
  const newTab = useStore(s => s.newTab)
  const pullFromGitHub = useStore(s => s.pullFromGitHub)
  const createCollectionOnGitHub = useStore(s => s.createCollectionOnGitHub)
  const syncStatus = useStore(s => s.syncStatus)
  const syncError = useStore(s => s.syncError)
  const githubRepo = useStore(s => s.githubRepo)

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Collections</span>
        <div className="flex gap-1 items-center">
          {githubRepo && (
            <button
              onClick={pullFromGitHub}
              disabled={syncStatus === 'syncing'}
              title="Pull from GitHub"
              className="text-gray-400 hover:text-white disabled:opacity-40 p-1 rounded hover:bg-gray-700"
            >
              <VscCloudDownload className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={newTab} title="New request" className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700">
            <VscNewFile className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => createCollectionOnGitHub(createCollection())}
            title="New collection"
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
          >
            <VscNewFolder className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {syncError && (
        <div className="px-3 py-1 text-xs text-red-400 bg-red-900/20 border-b border-red-900 truncate" title={syncError}>
          {syncError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {collections.length === 0 && syncStatus !== 'syncing' && (
          <div className="p-4 flex flex-col gap-2">
            <p className="text-gray-500 text-xs">No collections yet.</p>
            {githubRepo
              ? <p className="text-gray-600 text-xs">Use <strong className="text-gray-400">new folder</strong> to create one in <span className="text-gray-400">{githubRepo.full_name}</span>.</p>
              : <p className="text-gray-600 text-xs">Use <strong className="text-gray-400">new folder</strong> to create a local collection.</p>
            }
          </div>
        )}
        {syncStatus === 'syncing' && (
          <p className="text-gray-500 text-xs p-4 animate-pulse">Pulling from GitHub…</p>
        )}
        {collections.map(col => (
          <CollectionNode key={col.id} col={col} onOpen={openTab} isRoot />
        ))}
      </div>
    </aside>
  )
}

function CollectionNode({ col, onOpen, depth = 0, isRoot = false }) {
  const updateCollection = useStore(s => s.updateCollection)
  const renameCollection = useStore(s => s.renameCollection)
  const deleteCollectionWithSync = useStore(s => s.deleteCollectionWithSync)
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(col.name)
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function commitRename() {
    const name = draft.trim() || col.name
    setDraft(name)
    setEditing(false)
    if (name !== col.name) {
      if (isRoot) renameCollection(col.id, name)
      else updateCollection(col.id, { name })
    }
  }

  function addRequest() {
    const req = createRequest({ name: 'New Request' })
    updateCollection(col.id, { requests: [...(col.requests ?? []), req] })
    onOpen(req)
  }

  const menuItems = [
    { label: 'Rename', icon: VscEllipsis, action: () => setEditing(true) },
    ...(isRoot ? [
      'divider',
      { label: 'Delete collection', icon: VscClose, danger: true, action: () => { if (confirm(`Delete "${col.name}"?`)) deleteCollectionWithSync(col.id) } },
    ] : []),
  ]

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1.5 hover:bg-gray-800 group pr-2"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <button onClick={() => setCollapsed(c => !c)} className="text-gray-600 hover:text-gray-400 w-4 shrink-0 flex items-center justify-center">
          {collapsed
            ? <VscChevronRight className="w-3 h-3" />
            : <VscChevronDown className="w-3 h-3" />
          }
        </button>

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setDraft(col.name); setEditing(false) }
            }}
            className="flex-1 bg-gray-700 text-sm text-white rounded px-1 outline-none border border-blue-500 min-w-0"
          />
        ) : (
          <span
            className="flex-1 text-sm text-gray-200 truncate cursor-pointer select-none"
            onClick={() => setCollapsed(c => !c)}
          >
            {col.name}
          </span>
        )}

        {!editing && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={e => { e.stopPropagation(); addRequest() }}
              className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-gray-700 opacity-0 group-hover:opacity-100 flex items-center"
              title="Add request"
            >
              <VscNewFile className="w-3.5 h-3.5" />
            </button>
            <ContextMenu items={menuItems} />
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {(col.requests ?? []).map(req => (
            <RequestRow key={req.id} req={req} depth={depth + 1} onOpen={onOpen} collectionId={col.id} />
          ))}
          {(col.folders ?? []).map(folder => (
            <CollectionNode key={folder.id} col={folder} onOpen={onOpen} depth={depth + 1} />
          ))}
        </>
      )}
    </div>
  )
}

function RequestRow({ req, depth, onOpen, collectionId }) {
  const renameRequest = useStore(s => s.renameRequest)
  const deleteRequestWithSync = useStore(s => s.deleteRequestWithSync)
  const activeTabId = useStore(s => s.activeTabId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(req.name)
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function commitRename() {
    const name = draft.trim() || req.name
    setDraft(name)
    setEditing(false)
    if (name === req.name) return
    renameRequest(collectionId, req.id, name)
  }

  function deleteRequest() {
    deleteRequestWithSync(collectionId, req.id)
  }

  const menuItems = [
    { label: 'Rename', icon: VscEllipsis, action: () => setEditing(true) },
    'divider',
    { label: 'Delete request', icon: VscClose, danger: true, action: deleteRequest },
  ]

  const isActive = activeTabId === req.id

  return (
    <div
      className={`flex items-center gap-2 py-1 hover:bg-gray-800 cursor-pointer group pr-2 ${isActive ? 'bg-gray-800' : ''}`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => !editing && onOpen(req)}
    >
      <span className={`text-xs font-mono font-bold w-14 shrink-0 ${METHOD_COLORS[req.method] ?? 'text-gray-400'}`}>
        {req.method}
      </span>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') { setDraft(req.name); setEditing(false) }
          }}
          className="flex-1 bg-gray-700 text-sm text-white rounded px-1 outline-none border border-blue-500 min-w-0"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-sm text-gray-300 truncate">{req.name}</span>
      )}

      {!editing && <ContextMenu items={menuItems} />}
    </div>
  )
}
