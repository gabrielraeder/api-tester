import { useState } from 'react'
import { useStore, activeTab } from '../store.js'
import { executeRequest } from '@api-tester/core/http'
import { interpolateRequest } from '@api-tester/core/env'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const BODY_TYPES = ['none', 'json', 'form', 'raw']

export function RequestBuilder({ onSend } = {}) {
  const tab = useStore(activeTab)
  const updateTab = useStore(s => s.updateTab)
  const setResponse = useStore(s => s.setResponse)
  const setLoading = useStore(s => s.setLoading)
  const loading = useStore(s => s.loading)
  const addHistory = useStore(s => s.addHistory)
  const environments = useStore(s => s.environments)
  const activeEnvId = useStore(s => s.activeEnvId)
  const saveRequestToGitHub = useStore(s => s.saveRequestToGitHub)
  const syncStatus = useStore(s => s.syncStatus)
  const githubRepo = useStore(s => s.githubRepo)
  const [innerTab, setInnerTab] = useState('params')

  if (!tab) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Open a request or create a new tab
      </div>
    )
  }

  const activeEnvVars = environments.find(e => e.id === activeEnvId)?.variables ?? {}
  const isLoading = loading[tab.id]

  async function send() {
    if (onSend) return onSend()
    setLoading(tab.id, true)
    try {
      const resolved = interpolateRequest(tab, activeEnvVars)
      const response = await executeRequest(resolved, true)
      setResponse(tab.id, response)
      addHistory({ ...resolved, timestamp: Date.now(), response })
    } catch (err) {
      setResponse(tab.id, { error: err.message })
    } finally {
      setLoading(tab.id, false)
    }
  }

  function patch(field, value) {
    updateTab(tab.id, { [field]: value })
  }

  return (
    <div className="flex flex-col h-full">
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-700">
        <input
          className="text-sm text-gray-200 bg-transparent border-none outline-none w-32"
          value={tab.name}
          onChange={e => patch('name', e.target.value)}
          placeholder="Request name"
        />
        <select
          value={tab.method}
          onChange={e => patch('method', e.target.value)}
          className="bg-gray-700 text-sm text-white rounded px-2 py-1.5 border border-gray-600"
        >
          {METHODS.map(m => <option key={m}>{m}</option>)}
        </select>
        <input
          value={tab.url}
          onChange={e => patch('url', e.target.value)}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 bg-gray-800 text-sm text-white rounded px-3 py-1.5 border border-gray-600 focus:border-blue-500 outline-none font-mono"
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button
          onClick={send}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded font-medium"
        >
          {isLoading ? 'Sending…' : 'Send'}
        </button>
        {githubRepo && (
          <button
            onClick={() => saveRequestToGitHub(tab.id)}
            disabled={syncStatus === 'saving'}
            title="Save to GitHub"
            className="text-gray-400 hover:text-white disabled:opacity-40 text-sm px-2 py-1.5 rounded border border-gray-700 hover:border-gray-500"
          >
            {syncStatus === 'saving' ? '↑…' : '↑'}
          </button>
        )}
      </div>

      {/* Inner Tabs: Params / Headers / Body / Auth */}
      <div className="flex border-b border-gray-700 px-3">
        {['params', 'headers', 'body', 'auth'].map(t => (
          <button
            key={t}
            onClick={() => setInnerTab(t)}
            className={`px-3 py-2 text-xs capitalize border-b-2 ${
              innerTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {innerTab === 'params' && (
          <KVEditor
            label="Query Params"
            data={tab.params}
            onChange={v => patch('params', v)}
          />
        )}
        {innerTab === 'headers' && (
          <KVEditor
            label="Headers"
            data={tab.headers}
            onChange={v => patch('headers', v)}
          />
        )}
        {innerTab === 'body' && (
          <BodyEditor tab={tab} patch={patch} />
        )}
        {innerTab === 'auth' && (
          <AuthEditor tab={tab} patch={patch} />
        )}
      </div>
    </div>
  )
}

function KVEditor({ label, data = {}, onChange }) {
  const entries = Object.entries(data)

  function set(key, value, oldKey) {
    const next = { ...data }
    if (oldKey !== key) delete next[oldKey]
    if (key) next[key] = value
    onChange(next)
  }

  function remove(key) {
    const next = { ...data }
    delete next[key]
    onChange(next)
  }

  function add() {
    onChange({ ...data, '': '' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        <button onClick={add} className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
      </div>
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <input
              value={k}
              onChange={e => set(e.target.value, v, k)}
              placeholder="Key"
              className="flex-1 bg-gray-800 text-sm text-white rounded px-2 py-1 border border-gray-600 focus:border-blue-500 outline-none font-mono"
            />
            <input
              value={v}
              onChange={e => set(k, e.target.value, k)}
              placeholder="Value"
              className="flex-1 bg-gray-800 text-sm text-white rounded px-2 py-1 border border-gray-600 focus:border-blue-500 outline-none font-mono"
            />
            <button onClick={() => remove(k)} className="text-gray-500 hover:text-red-400 text-sm px-1">✕</button>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-gray-600 text-xs">No {label.toLowerCase()} yet.</p>
        )}
      </div>
    </div>
  )
}

function BodyEditor({ tab, patch }) {
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex gap-2">
        {BODY_TYPES.map(t => (
          <label key={t} className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="radio"
              name="bodyType"
              value={t}
              checked={tab.bodyType === t}
              onChange={() => patch('bodyType', t)}
              className="accent-blue-500"
            />
            {t}
          </label>
        ))}
      </div>
      {tab.bodyType !== 'none' && (
        <textarea
          value={tab.body}
          onChange={e => patch('body', e.target.value)}
          placeholder={tab.bodyType === 'json' ? '{\n  "key": "value"\n}' : ''}
          className="flex-1 bg-gray-800 text-sm text-white rounded p-2 border border-gray-600 focus:border-blue-500 outline-none font-mono resize-none"
          spellCheck={false}
        />
      )}
    </div>
  )
}

function AuthEditor({ tab, patch }) {
  const AUTH_TYPES = ['none', 'bearer', 'basic', 'apikey']

  function setAuth(field, value) {
    patch('auth', { ...tab.auth, [field]: value })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {AUTH_TYPES.map(t => (
          <label key={t} className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="radio"
              name="authType"
              value={t}
              checked={tab.authType === t}
              onChange={() => patch('authType', t)}
              className="accent-blue-500"
            />
            {t}
          </label>
        ))}
      </div>

      {tab.authType === 'bearer' && (
        <input
          value={tab.auth?.token ?? ''}
          onChange={e => setAuth('token', e.target.value)}
          placeholder="Token"
          className="bg-gray-800 text-sm text-white rounded px-2 py-1 border border-gray-600 outline-none font-mono"
        />
      )}

      {tab.authType === 'basic' && (
        <div className="flex gap-2">
          <input
            value={tab.auth?.username ?? ''}
            onChange={e => setAuth('username', e.target.value)}
            placeholder="Username"
            className="flex-1 bg-gray-800 text-sm text-white rounded px-2 py-1 border border-gray-600 outline-none"
          />
          <input
            type="password"
            value={tab.auth?.password ?? ''}
            onChange={e => setAuth('password', e.target.value)}
            placeholder="Password"
            className="flex-1 bg-gray-800 text-sm text-white rounded px-2 py-1 border border-gray-600 outline-none"
          />
        </div>
      )}

      {tab.authType === 'apikey' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={tab.auth?.key ?? ''}
              onChange={e => setAuth('key', e.target.value)}
              placeholder="Key name"
              className="flex-1 bg-gray-800 text-sm text-white rounded px-2 py-1 border border-gray-600 outline-none"
            />
            <input
              value={tab.auth?.value ?? ''}
              onChange={e => setAuth('value', e.target.value)}
              placeholder="Value"
              className="flex-1 bg-gray-800 text-sm text-white rounded px-2 py-1 border border-gray-600 outline-none font-mono"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            Add to:
            <select
              value={tab.auth?.in ?? 'header'}
              onChange={e => setAuth('in', e.target.value)}
              className="bg-gray-700 text-white rounded px-2 py-0.5 text-xs"
            >
              <option value="header">Header</option>
              <option value="query">Query param</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
