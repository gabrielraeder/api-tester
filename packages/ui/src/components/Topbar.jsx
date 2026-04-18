import { useState } from 'react'
import { useStore } from '../store.js'
import { createEnvironment } from '@api-tester/core/collection'
import { GitHubAuthModal } from './GitHubAuthModal.jsx'
import { RepoPicker } from './RepoPicker.jsx'

export function Topbar() {
  const environments = useStore(s => s.environments)
  const activeEnvId = useStore(s => s.activeEnvId)
  const setActiveEnv = useStore(s => s.setActiveEnv)
  const addEnvironment = useStore(s => s.addEnvironment)
  const githubUser = useStore(s => s.githubUser)
  const githubRepo = useStore(s => s.githubRepo)
  const clearGithubAuth = useStore(s => s.clearGithubAuth)

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showRepoPicker, setShowRepoPicker] = useState(false)

  return (
    <>
      <header className="flex items-center justify-between px-4 py-2 bg-gray-950 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm tracking-wide">API Tester</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Environment switcher */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Env:</span>
            <select
              value={activeEnvId ?? ''}
              onChange={e => setActiveEnv(e.target.value || null)}
              className="bg-gray-800 text-xs text-white rounded px-2 py-1 border border-gray-600"
            >
              <option value="">No environment</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
            <button
              onClick={() => addEnvironment(createEnvironment())}
              className="text-xs text-gray-500 hover:text-white px-1"
              title="New environment"
            >+</button>
          </div>

          {/* GitHub section */}
          {githubUser ? (
            <div className="flex items-center gap-2">
              {githubRepo ? (
                <button
                  onClick={() => setShowRepoPicker(true)}
                  className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 rounded px-2 py-1 flex items-center gap-1.5"
                  title="Change repository"
                >
                  <RepoIcon />
                  {githubRepo.full_name}
                </button>
              ) : (
                <button
                  onClick={() => setShowRepoPicker(true)}
                  className="text-xs text-yellow-500 hover:text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded px-2 py-1"
                >
                  Select repo
                </button>
              )}

              <div className="flex items-center gap-1.5 group relative">
                <img
                  src={githubUser.avatar_url}
                  className="w-6 h-6 rounded-full cursor-pointer"
                  alt={githubUser.login}
                  title={githubUser.login}
                />
                <span className="text-xs text-gray-400">{githubUser.login}</span>
                <button
                  onClick={clearGithubAuth}
                  className="text-xs text-gray-600 hover:text-red-400 ml-1"
                  title="Disconnect GitHub"
                >✕</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded px-3 py-1.5"
            >
              <GitHubIcon />
              Connect GitHub
            </button>
          )}
        </div>
      </header>

      {showAuthModal && (
        <GitHubAuthModal
          onClose={() => {
            setShowAuthModal(false)
            // Read current state directly — avoid stale closure from render time
            const { githubUser: user, githubRepo: repo } = useStore.getState()
            if (user && !repo) setShowRepoPicker(true)
          }}
        />
      )}

      {showRepoPicker && githubUser && (
        <RepoPicker onClose={() => setShowRepoPicker(false)} />
      )}
    </>
  )
}

function GitHubIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

function RepoIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/>
    </svg>
  )
}
