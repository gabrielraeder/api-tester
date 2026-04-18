/**
 * Interpolate {{variable}} placeholders in a string using the active environment.
 */
export function interpolate(str, variables = {}) {
  if (!str) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}

/**
 * Apply interpolation recursively to all string values in a request object.
 */
export function interpolateRequest(request, variables) {
  return {
    ...request,
    url: interpolate(request.url, variables),
    headers: mapValues(request.headers, v => interpolate(v, variables)),
    params: mapValues(request.params, v => interpolate(v, variables)),
    body: typeof request.body === 'string' ? interpolate(request.body, variables) : request.body,
  }
}

function mapValues(obj = {}, fn) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]))
}
