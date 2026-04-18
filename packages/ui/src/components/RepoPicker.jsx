import { useState, useEffect } from 'react'
import { listRepos } from '@api-tester/core/github'
import { useStore } from '../store.js'

export function RepoPicker({ onClose }) {
  const githubToken = useStore(s => s.githubToken)
  const githubUser = useStore(s => s.githubUser)
  const setGithubRepo = useStore(s => s.setGithubRepo)
  const githubRepo = useStore(s => s.githubRepo)
  const pullFromGitHub = useStore(s => s.pullFromGitHub)

  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(githubRepo?.full_name ?? null)

  useEffect(() => {
    listRepos(githubToken)
      .then(setRepos)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [githubToken])

  const filtered = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  async function confirm() {
    const repo = repos.find(r => r.full_name === selected)
    if (repo) {
      setGithubRepo({ full_name: repo.full_name, owner: repo.owner.login, name: repo.name })
      onClose()
      // Trigger pull using getState so we always read the freshly-set repo
      await useStore.getState().pullFromGitHub()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-base">Select a repository</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <p className="text-gray-400 text-sm">
          Collections (JSON/YAML files) will be stored in the selected repo. You can change this later.
        </p>

        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search repositories…"
          className="bg-gray-800 text-sm text-white rounded px-3 py-2 border border-gray-600 focus:border-blue-500 outline-none"
        />

        <div className="flex-1 overflow-y-auto border border-gray-700 rounded divide-y divide-gray-800" style={{ minHeight: 0 }}>
          {loading && (
            <div className="flex items-center justify-center py-8 text-gray-500 text-sm">Loading repositories…</div>
          )}
          {error && (
            <div className="p-4 text-red-400 text-sm">Failed to load repos: {error}</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-4 text-gray-500 text-sm">No repositories found.</div>
          )}
          {filtered.map(repo => (
            <button
              key={repo.full_name}
              onClick={() => setSelected(repo.full_name)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-800 transition-colors ${
                selected === repo.full_name ? 'bg-blue-900/30 border-l-2 border-blue-500' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">{repo.full_name}</div>
                {repo.description && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{repo.description}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
                {repo.private && <span className="bg-gray-700 px-1.5 py-0.5 rounded">Private</span>}
                {repo.language && <span>{repo.language}</span>}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!selected}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded"
          >
            Use this repository
          </button>
        </div>
      </div>
    </div>
  )
}
