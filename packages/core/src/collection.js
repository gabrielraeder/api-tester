import yaml from 'js-yaml'

/**
 * Parse a collection file (JSON or YAML) by content string + filename.
 */
export function parseCollectionFile(content, filename) {
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
    return yaml.load(content)
  }
  return JSON.parse(content)
}

/**
 * Serialize a collection item to string.
 */
export function serializeCollectionFile(data, filename) {
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
    return yaml.dump(data, { indent: 2 })
  }
  return JSON.stringify(data, null, 2)
}

/**
 * Create a blank request object.
 */
export function createRequest(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'New Request',
    method: 'GET',
    url: '',
    headers: {},
    params: {},
    body: '',
    bodyType: 'none',
    authType: 'none',
    auth: {},
    ...overrides,
  }
}

/**
 * Create a blank collection object.
 */
export function createCollection(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'New Collection',
    description: '',
    folders: [],
    requests: [],
    ...overrides,
  }
}

/**
 * Create a blank environment object.
 */
export function createEnvironment(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'New Environment',
    variables: {},
    ...overrides,
  }
}

/**
 * Find a request by id anywhere in a collection tree.
 */
export function findRequest(collection, requestId) {
  for (const req of collection.requests ?? []) {
    if (req.id === requestId) return req
  }
  for (const folder of collection.folders ?? []) {
    const found = findRequest(folder, requestId)
    if (found) return found
  }
  return null
}
