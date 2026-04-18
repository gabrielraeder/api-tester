const PROXY_BASE = 'https://proxy.writechoice.io'

/**
 * Execute an HTTP request through the cors-anywhere proxy.
 * In Electron, this module is replaced by the native http engine
 * that calls fetch directly without the proxy.
 *
 * @param {object} request
 * @param {string} request.method
 * @param {string} request.url
 * @param {Record<string, string>} request.headers
 * @param {Record<string, string>} request.params
 * @param {string|null} request.body
 * @param {'none'|'bearer'|'basic'|'apikey'} request.authType
 * @param {object} request.auth
 * @param {boolean} [useProxy=true]
 * @returns {Promise<Response>}
 */
export async function executeRequest(request, useProxy = true) {
  const { method, url, headers = {}, params = {}, body, authType, auth } = request

  const fullUrl = buildUrl(url, params)
  const finalHeaders = { ...headers, ...buildAuthHeaders(authType, auth) }

  const targetUrl = useProxy ? `${PROXY_BASE}/${fullUrl}` : fullUrl

  const proxyHeaders = useProxy
    ? { Origin: window.location.origin, 'X-Requested-With': 'XMLHttpRequest' }
    : {}

  const start = Date.now()

  const res = await fetch(targetUrl, {
    method,
    headers: { ...proxyHeaders, ...finalHeaders },
    body: method !== 'GET' && method !== 'HEAD' && body ? body : undefined,
  })

  const elapsed = Date.now() - start
  const resHeaders = {}
  res.headers.forEach((v, k) => { resHeaders[k] = v })

  const rawBody = await res.text()

  return {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
    body: rawBody,
    elapsed,
    size: new TextEncoder().encode(rawBody).length,
  }
}

function buildUrl(url, params) {
  if (!params || Object.keys(params).length === 0) return url
  const u = new URL(url)
  Object.entries(params).forEach(([k, v]) => {
    if (k && v !== undefined) u.searchParams.set(k, v)
  })
  return u.toString()
}

function buildAuthHeaders(authType, auth = {}) {
  switch (authType) {
    case 'bearer':
      return { Authorization: `Bearer ${auth.token}` }
    case 'basic': {
      const encoded = btoa(`${auth.username}:${auth.password}`)
      return { Authorization: `Basic ${encoded}` }
    }
    case 'apikey':
      return auth.in === 'header' ? { [auth.key]: auth.value } : {}
    default:
      return {}
  }
}
