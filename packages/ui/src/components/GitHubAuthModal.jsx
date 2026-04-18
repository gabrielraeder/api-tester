import { useState } from 'react'
import { startDeviceFlow, pollForToken, getAuthenticatedUser, authenticateWithPAT } from '@api-tester/core/github'
import { useStore } from '../store.js'

export function GitHubAuthModal({ onClose }) {
  const setGithubAuth = useStore(s => s.setGithubAuth)
  const [authMode, setAuthMode] = useState('device') // device | pat
  const [step, setStep] = useState('idle') // idle | loading | waiting | success | error
  const [deviceData, setDeviceData] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [pat, setPat] = useState('')
  const [patLoading, setPatLoading] = useState(false)

  async function startDevice() {
    setStep('loading')
    setError(null)
    try {
      const data = await startDeviceFlow()
      setDeviceData(data)
      setStep('waiting')
      const token = await pollForToken(data.device_code, data.interval ?? 5)
      console.log('[auth] poll resolved, token=', token?.slice(0, 10))
      await finalize(token)
    } catch (err) {
      setStep('error')
      setError(err.message)
    }
  }

  async function submitPAT() {
    const token = pat.trim()
    if (!token) return
    setPatLoading(true)
    setError(null)
    try {
      await finalize(token)
    } catch (err) {
      setError(err.message)
    } finally {
      setPatLoading(false)
    }
  }

  async function finalize(token) {
    console.log('[auth] finalize: fetching user...')
    const user = await getAuthenticatedUser(token)
    console.log('[auth] finalize: got user', user?.login)
    setGithubAuth(token, user)
    console.log('[auth] finalize: setGithubAuth done, setting success')
    setStep('success')
    setTimeout(() => onClose(), 1000)
  }

  function copyCode() {
    navigator.clipboard.writeText(deviceData.user_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openGitHub() {
    window.open(deviceData?.verification_uri ?? 'https://github.com/login/device', '_blank', 'noopener')
  }

  const isIdle = step === 'idle' || authMode === 'pat'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-base">Connect GitHub</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Mode tabs — only show when not in flow */}
        {(step === 'idle' || step === 'error' || authMode === 'pat') && (
          <div className="flex border-b border-gray-700 mb-4">
            <button
              onClick={() => { setAuthMode('device'); setStep('idle'); setError(null) }}
              className={`px-4 py-2 text-xs border-b-2 ${authMode === 'device' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Device Flow
            </button>
            <button
              onClick={() => { setAuthMode('pat'); setStep('idle'); setError(null) }}
              className={`px-4 py-2 text-xs border-b-2 ${authMode === 'pat' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Personal Access Token
            </button>
          </div>
        )}

        {/* ── Device flow ── */}
        {authMode === 'device' && (
          <>
            {step === 'idle' && (
              <div className="flex flex-col gap-4">
                <p className="text-gray-400 text-sm">
                  Authorize without sharing a password. GitHub will give you a one-time code to enter on their site.
                </p>
                <button
                  onClick={startDevice}
                  className="w-full bg-white hover:bg-gray-100 text-gray-900 text-sm font-semibold py-2.5 rounded flex items-center justify-center gap-2"
                >
                  <GitHubIcon />
                  Continue with GitHub
                </button>
              </div>
            )}

            {step === 'loading' && (
              <div className="flex items-center justify-center py-8 gap-3 text-gray-400 text-sm">
                <Spinner />
                Starting authorization…
              </div>
            )}

            {step === 'waiting' && deviceData && (
              <div className="flex flex-col gap-4">
                <p className="text-gray-400 text-sm">Copy the code below, then open GitHub to enter it.</p>

                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-800 border border-gray-600 rounded px-4 py-3 text-center font-mono text-xl font-bold tracking-widest text-white select-all">
                    {deviceData.user_code}
                  </div>
                  <button
                    onClick={copyCode}
                    className="bg-gray-700 hover:bg-gray-600 text-sm text-white px-3 py-3 rounded"
                    title="Copy"
                  >
                    {copied ? '✓' : '⧉'}
                  </button>
                </div>

                <button
                  onClick={openGitHub}
                  className="w-full bg-white hover:bg-gray-100 text-gray-900 text-sm font-semibold py-2.5 rounded flex items-center justify-center gap-2"
                >
                  <GitHubIcon />
                  Open GitHub to authorize
                </button>

                <div className="flex items-center gap-2 text-gray-500 text-xs justify-center">
                  <Spinner size="sm" />
                  Waiting for approval… (check browser console for poll status)
                </div>

                <p className="text-gray-600 text-xs text-center">
                  Expires in {Math.floor((deviceData.expires_in ?? 900) / 60)} min.
                  <button
                    onClick={() => { setAuthMode('pat'); setStep('idle') }}
                    className="ml-2 text-blue-500 hover:underline"
                  >
                    Use a token instead
                  </button>
                </p>
              </div>
            )}

            {step === 'error' && (
              <div className="flex flex-col gap-3">
                <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-400 text-sm break-all">
                  {error === 'expired_token' ? 'Code expired.' :
                   error === 'access_denied' ? 'Authorization denied on GitHub.' :
                   error}
                </div>
                <button onClick={startDevice} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded">
                  Try again
                </button>
              </div>
            )}
          </>
        )}

        {/* ── PAT flow ── */}
        {authMode === 'pat' && step !== 'success' && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">
              Create a token at{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=API+Tester"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                github.com/settings/tokens
              </a>{' '}
              with <code className="bg-gray-800 px-1 rounded text-xs">repo</code> scope, then paste it below.
            </p>
            <input
              type="password"
              value={pat}
              onChange={e => setPat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitPAT()}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="bg-gray-800 text-sm text-white font-mono rounded px-3 py-2 border border-gray-600 focus:border-blue-500 outline-none"
              autoFocus
            />
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded p-2 text-red-400 text-xs break-all">
                {error}
              </div>
            )}
            <button
              onClick={submitPAT}
              disabled={!pat.trim() || patLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded flex items-center justify-center gap-2"
            >
              {patLoading ? <><Spinner size="sm" /> Verifying…</> : 'Connect'}
            </button>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="flex flex-col items-center gap-3 py-6 text-green-400">
            <div className="text-3xl">✓</div>
            <p className="text-sm font-medium">GitHub connected</p>
          </div>
        )}
      </div>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

function Spinner({ size = 'md' }) {
  const cls = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  return (
    <svg className={`${cls} animate-spin text-gray-400`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}
