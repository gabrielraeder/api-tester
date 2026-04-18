import { listDirectory, readFile, writeFile, deleteFile } from './github.js'
import { parseCollectionFile, serializeCollectionFile, createCollection } from './collection.js'

const ROOT = 'collections'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/**
 * Load all collections from the repo's `collections/` directory.
 * Returns an array of collection objects (with _github metadata on each request).
 */
export async function loadCollectionsFromRepo(token, owner, repo) {
  let topLevel
  try {
    topLevel = await listDirectory(token, owner, repo, ROOT)
  } catch (err) {
    if (err.message?.includes('404') || err.message?.includes('Not Found')) return []
    throw err
  }

  const dirs = topLevel.filter(item => item.type === 'dir')
  const collections = await Promise.all(dirs.map(dir => loadCollection(token, owner, repo, dir.path)))
  return collections.filter(Boolean)
}

async function loadCollection(token, owner, repo, dirPath) {
  let items
  try {
    items = await listDirectory(token, owner, repo, dirPath)
  } catch {
    return null
  }

  const metaFile = items.find(i => i.name === 'collection.json' || i.name === 'collection.yaml')
  let meta = {}
  if (metaFile) {
    try {
      const { content } = await readFile(token, owner, repo, metaFile.path)
      meta = parseCollectionFile(content, metaFile.name)
    } catch {}
  }

  const collection = createCollection({
    ...meta,
    name: meta.name ?? dirPath.split('/').pop(),
    _github: { path: dirPath },
    folders: [],
    requests: [],
  })

  for (const item of items) {
    if (item.name === 'collection.json' || item.name === 'collection.yaml') continue

    if (item.type === 'file' && isRequestFile(item.name)) {
      const req = await loadRequestFile(token, owner, repo, item)
      if (req) collection.requests.push(req)
    } else if (item.type === 'dir') {
      const folder = await loadFolder(token, owner, repo, item.path)
      if (folder) collection.folders.push(folder)
    }
  }

  return collection
}

async function loadFolder(token, owner, repo, dirPath) {
  let items
  try {
    items = await listDirectory(token, owner, repo, dirPath)
  } catch {
    return null
  }

  const metaFile = items.find(i => i.name === 'folder.json')
  let meta = {}
  if (metaFile) {
    try {
      const { content } = await readFile(token, owner, repo, metaFile.path)
      meta = JSON.parse(content)
    } catch {}
  }

  const folder = {
    id: meta.id ?? crypto.randomUUID(),
    name: meta.name ?? dirPath.split('/').pop(),
    _github: { path: dirPath },
    folders: [],
    requests: [],
  }

  for (const item of items) {
    if (item.name === 'folder.json') continue
    if (item.type === 'file' && isRequestFile(item.name)) {
      const req = await loadRequestFile(token, owner, repo, item)
      if (req) folder.requests.push(req)
    } else if (item.type === 'dir') {
      const sub = await loadFolder(token, owner, repo, item.path)
      if (sub) folder.folders.push(sub)
    }
  }

  return folder
}

async function loadRequestFile(token, owner, repo, item) {
  try {
    const { content, sha } = await readFile(token, owner, repo, item.path)
    const data = parseCollectionFile(content, item.name)
    return { ...data, _github: { path: item.path, sha } }
  } catch {
    return null
  }
}

/**
 * Save a request to the repo. Creates or updates the file.
 * If the name changed and the file path doesn't match the new slug, moves the file.
 * Returns the updated request with _github.sha set.
 */
export async function saveRequest(token, owner, repo, request, collectionGithub) {
  const { _github, ...data } = request
  const collectionPath = collectionGithub.path
  const newFilename = `${slugify(request.name) || request.id}.json`
  const newPath = `${collectionPath}/${newFilename}`
  const oldPath = _github?.path
  const oldSha = _github?.sha ?? null

  // Use old path if it's in the same collection and filename hasn't changed
  const sameFilename = oldPath && oldPath.split('/').pop() === newFilename
  const targetPath = (oldPath && sameFilename) ? oldPath : newPath
  const sha = targetPath === oldPath ? oldSha : null

  const content = JSON.stringify(data, null, 2)
  const result = await writeFile(token, owner, repo, targetPath, content, sha,
    `${sha ? 'update' : 'add'} request: ${request.name}`)

  // Delete old file if moved
  if (targetPath !== oldPath && oldPath && oldSha) {
    await deleteFile(token, owner, repo, oldPath, oldSha, `rename request: ${request.name}`)
  }

  return {
    ...request,
    _github: { path: targetPath, sha: result.content.sha },
  }
}

/**
 * Save collection metadata file to the repo.
 */
export async function saveCollectionMeta(token, owner, repo, collection) {
  const { _github, requests, folders, ...meta } = collection
  const collectionPath = _github?.path ?? `${ROOT}/${slugify(collection.name) || collection.id}`
  const path = `${collectionPath}/collection.json`

  let sha = null
  try {
    const existing = await readFile(token, owner, repo, path)
    sha = existing.sha
  } catch {}

  const content = JSON.stringify(meta, null, 2)
  await writeFile(token, owner, repo, path, content, sha,
    `chore: update collection ${collection.name}`)

  return {
    ...collection,
    _github: { ...(_github ?? {}), path: collectionPath },
  }
}

/**
 * Create a new collection directory in the repo (writes collection.json).
 */
export async function createCollectionInRepo(token, owner, repo, collection) {
  const collectionPath = `${ROOT}/${collection.id}`
  const content = JSON.stringify({
    id: collection.id,
    name: collection.name,
    description: collection.description ?? '',
  }, null, 2)

  await writeFile(token, owner, repo, `${collectionPath}/collection.json`, content, null,
    `feat: create collection ${collection.name}`)

  return { ...collection, _github: { path: collectionPath } }
}

/**
 * Rename a collection: moves all files from the old slug path to the new slug path.
 * Returns the updated collection with new _github paths throughout.
 */
export async function renameCollectionInRepo(token, owner, repo, collection, newName) {
  const oldPath = collection._github?.path
  const newSlug = slugify(newName) || collection.id
  const newPath = `${ROOT}/${newSlug}`

  if (!oldPath) return { ...collection, name: newName }

  // Same path — just update the name field inside collection.json
  if (oldPath === newPath) {
    return saveCollectionMeta(token, owner, repo, { ...collection, name: newName })
  }

  // Move all files, collect delete tasks to run after writes
  const { updatedNode, deleteTasks } = await moveNode(token, owner, repo, collection, oldPath, newPath, newName, true)
  await Promise.allSettled(deleteTasks)
  return updatedNode
}

async function moveNode(token, owner, repo, node, oldDirPath, newDirPath, newName, isCollection) {
  const deleteTasks = []
  const updatedRequests = []

  for (const req of node.requests ?? []) {
    const oldReqPath = req._github?.path
    const oldReqSha = req._github?.sha
    if (!oldReqPath || !oldReqSha) { updatedRequests.push(req); continue }

    const filename = oldReqPath.split('/').pop()
    const newReqPath = `${newDirPath}/${filename}`
    try {
      const { content } = await readFile(token, owner, repo, oldReqPath)
      const result = await writeFile(token, owner, repo, newReqPath, content, null, `move: ${req.name}`)
      deleteTasks.push(deleteFile(token, owner, repo, oldReqPath, oldReqSha, `move: ${req.name}`))
      updatedRequests.push({ ...req, _github: { path: newReqPath, sha: result.content.sha } })
    } catch {
      updatedRequests.push(req)
    }
  }

  const updatedFolders = []
  for (const folder of node.folders ?? []) {
    const oldFolderPath = folder._github?.path
    if (!oldFolderPath) { updatedFolders.push(folder); continue }
    const folderName = oldFolderPath.split('/').pop()
    const newFolderPath = `${newDirPath}/${folderName}`
    const { updatedNode: movedFolder, deleteTasks: subDeletes } = await moveNode(
      token, owner, repo, folder, oldFolderPath, newFolderPath, folder.name, false
    )
    updatedFolders.push(movedFolder)
    deleteTasks.push(...subDeletes)
  }

  // Write new collection.json / folder.json
  const metaFilename = isCollection ? 'collection.json' : 'folder.json'
  const { requests, folders, _github, ...meta } = node
  const metaContent = JSON.stringify(isCollection ? { ...meta, name: newName ?? node.name } : meta, null, 2)
  await writeFile(token, owner, repo, `${newDirPath}/${metaFilename}`, metaContent, null,
    `rename to ${newName ?? node.name}`)

  // Delete old meta file
  try {
    const oldMeta = await readFile(token, owner, repo, `${oldDirPath}/${metaFilename}`)
    deleteTasks.push(deleteFile(token, owner, repo, `${oldDirPath}/${metaFilename}`, oldMeta.sha, `rename`))
  } catch {}

  return {
    updatedNode: {
      ...node,
      name: newName ?? node.name,
      requests: updatedRequests,
      folders: updatedFolders,
      _github: { path: newDirPath },
    },
    deleteTasks,
  }
}

/**
 * Delete a request file from the repo.
 */
export async function deleteRequestFromRepo(token, owner, repo, request) {
  const { path, sha } = request._github ?? {}
  if (!path || !sha) return
  await deleteFile(token, owner, repo, path, sha, `remove request: ${request.name}`)
}

/**
 * Delete all files in a collection from the repo (collection.json + all request files).
 * GitHub doesn't support folder deletion — we delete every tracked file individually.
 */
export async function deleteCollectionFromRepo(token, owner, repo, collection) {
  const tasks = []

  function collectFiles(node) {
    for (const req of node.requests ?? []) {
      if (req._github?.path && req._github?.sha) {
        tasks.push(deleteFile(token, owner, repo, req._github.path, req._github.sha,
          `remove request: ${req.name}`))
      }
    }
    for (const folder of node.folders ?? []) collectFiles(folder)
  }

  collectFiles(collection)

  const collectionPath = collection._github?.path
  if (collectionPath) {
    try {
      const meta = await readFile(token, owner, repo, `${collectionPath}/collection.json`)
      tasks.push(deleteFile(token, owner, repo, `${collectionPath}/collection.json`,
        meta.sha, `remove collection: ${collection.name}`))
    } catch {}
  }

  await Promise.allSettled(tasks)
}

function isRequestFile(name) {
  return (name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml'))
    && name !== 'collection.json' && name !== 'collection.yaml' && name !== 'folder.json'
}
