import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createRequest, createCollection, createEnvironment } from '@api-tester/core/collection'
import { loadCollectionsFromRepo, saveRequest, saveCollectionMeta, createCollectionInRepo, renameCollectionInRepo, deleteRequestFromRepo, deleteCollectionFromRepo } from '@api-tester/core/sync'

const autoSaveTimers = {}

export const useStore = create(
  persist(
    (set, get) => ({
      // Collections list (metadata + nested tree)
      collections: [],

      // sync: 'idle' | 'syncing' | 'saving' | 'error'
      syncStatus: 'idle',
      syncError: null,

      // Currently active tab requests (unsaved edits live here)
      tabs: [],
      activeTabId: null,

      // Environments
      environments: [],
      activeEnvId: null,

      // Response for active tab
      responses: {},

      // Loading state per tab
      loading: {},

      // History of executed requests (last 100)
      history: [],

      // GitHub auth
      githubToken: null,
      githubUser: null,
      githubRepo: null,

      // Tab IDs with changes not yet confirmed saved to GitHub
      dirtyTabIds: [],

      // --- Collections ---
      addCollection(col) {
        set(s => ({ collections: [...s.collections, col ?? createCollection()] }))
      },
      removeCollection(id) {
        set(s => ({ collections: s.collections.filter(c => c.id !== id) }))
      },
      updateCollection(id, patch) {
        set(s => ({
          collections: s.collections.map(c => c.id === id ? { ...c, ...patch } : c),
        }))
      },

      // --- Tabs ---
      openTab(request) {
        const existing = get().tabs.find(t => t.id === request.id)
        if (existing) {
          set({ activeTabId: request.id })
          return
        }
        set(s => ({
          tabs: [...s.tabs, { ...request }],
          activeTabId: request.id,
        }))
      },
      closeTab(id) {
        set(s => {
          const tabs = s.tabs.filter(t => t.id !== id)
          const activeTabId = s.activeTabId === id
            ? (tabs[tabs.length - 1]?.id ?? null)
            : s.activeTabId
          return { tabs, activeTabId, dirtyTabIds: s.dirtyTabIds.filter(d => d !== id) }
        })
      },
      newTab() {
        const req = createRequest()
        set(s => ({
          tabs: [...s.tabs, req],
          activeTabId: req.id,
        }))
      },
      updateTab(id, patch) {
        set(s => ({
          tabs: s.tabs.map(t => t.id === id ? { ...t, ...patch } : t),
          collections: updateRequestInCollections(s.collections, id,
            { ...(s.tabs.find(t => t.id === id) ?? {}), ...patch }
          ),
          dirtyTabIds: s.dirtyTabIds.includes(id) ? s.dirtyTabIds : [...s.dirtyTabIds, id],
        }))
        const { githubToken, githubRepo } = get()
        if (githubToken && githubRepo) {
          clearTimeout(autoSaveTimers[id])
          autoSaveTimers[id] = setTimeout(() => get().saveRequestToGitHub(id), 1500)
        }
      },
      setActiveTab(id) {
        set({ activeTabId: id })
      },

      // --- Responses ---
      setResponse(tabId, response) {
        set(s => ({ responses: { ...s.responses, [tabId]: response } }))
      },
      setLoading(tabId, val) {
        set(s => ({ loading: { ...s.loading, [tabId]: val } }))
      },

      // --- History ---
      addHistory(entry) {
        set(s => ({
          history: [entry, ...s.history].slice(0, 100),
        }))
      },

      // --- Environments ---
      addEnvironment(env) {
        set(s => ({ environments: [...s.environments, env ?? createEnvironment()] }))
      },
      removeEnvironment(id) {
        set(s => ({ environments: s.environments.filter(e => e.id !== id) }))
      },
      updateEnvironment(id, patch) {
        set(s => ({
          environments: s.environments.map(e => e.id === id ? { ...e, ...patch } : e),
          activeEnvId: s.activeEnvId,
        }))
      },
      setActiveEnv(id) {
        set({ activeEnvId: id })
      },

      // --- GitHub ---
      setGithubAuth(token, user) {
        set({ githubToken: token, githubUser: user })
      },
      setGithubRepo(repo) {
        set({ githubRepo: repo })
      },
      clearGithubAuth() {
        set({ githubToken: null, githubUser: null, githubRepo: null, collections: [], dirtyTabIds: [] })
      },

      // --- GitHub Sync ---
      async pullFromGitHub() {
        const { githubToken, githubRepo } = get()
        if (!githubToken || !githubRepo) return
        set({ syncStatus: 'syncing', syncError: null })
        try {
          const cols = await loadCollectionsFromRepo(githubToken, githubRepo.owner, githubRepo.name)
          set({ collections: cols, syncStatus: 'idle' })
        } catch (err) {
          set({ syncStatus: 'error', syncError: err.message })
        }
      },

      async saveRequestToGitHub(tabId) {
        const { githubToken, githubRepo, tabs, collections } = get()
        if (!githubToken || !githubRepo) return
        const tab = tabs.find(t => t.id === tabId)
        if (!tab) return

        const collection = findCollectionForRequest(collections, tab.id)
        if (!collection?._github) return

        set({ syncStatus: 'saving', syncError: null })
        try {
          const updated = await saveRequest(githubToken, githubRepo.owner, githubRepo.name, tab, collection._github)
          set(s => ({
            tabs: s.tabs.map(t => t.id === tabId ? updated : t),
            collections: updateRequestInCollections(s.collections, tabId, updated),
            dirtyTabIds: s.dirtyTabIds.filter(id => id !== tabId),
            syncStatus: 'idle',
          }))
        } catch (err) {
          set({ syncStatus: 'error', syncError: err.message })
        }
      },

      // Save all tabs with unsaved changes to GitHub
      async flushDirtyTabs() {
        const { githubToken, githubRepo, dirtyTabIds } = get()
        if (!githubToken || !githubRepo || dirtyTabIds.length === 0) return
        await Promise.allSettled(dirtyTabIds.map(id => get().saveRequestToGitHub(id)))
      },

      async createCollectionOnGitHub(collection) {
        const { githubToken, githubRepo } = get()
        if (!githubToken || !githubRepo) {
          set(s => ({ collections: [...s.collections, collection] }))
          return
        }
        set({ syncStatus: 'saving', syncError: null })
        try {
          const updated = await createCollectionInRepo(githubToken, githubRepo.owner, githubRepo.name, collection)
          set(s => ({ collections: [...s.collections, updated], syncStatus: 'idle' }))
        } catch (err) {
          set(s => ({ collections: [...s.collections, collection], syncStatus: 'error', syncError: err.message }))
        }
      },

      async renameCollection(collectionId, name) {
        const { githubToken, githubRepo, collections } = get()
        const col = collections.find(c => c.id === collectionId)
        if (!col) return
        set(s => ({ collections: s.collections.map(c => c.id === collectionId ? { ...c, name } : c) }))
        if (githubToken && githubRepo && col._github) {
          set({ syncStatus: 'saving', syncError: null })
          try {
            const updated = await renameCollectionInRepo(githubToken, githubRepo.owner, githubRepo.name, col, name)
            set(s => ({
              collections: s.collections.map(c => c.id === collectionId ? updated : c),
              syncStatus: 'idle',
            }))
          } catch (err) {
            set({ syncStatus: 'error', syncError: err.message })
          }
        }
      },

      async renameRequest(collectionId, requestId, name) {
        const { githubToken, githubRepo, collections } = get()
        const col = collections.find(c => c.id === collectionId)
        if (!col) return
        const req = col.requests?.find(r => r.id === requestId)
        if (!req) return
        const updatedReq = { ...req, name }
        const updatedCol = { ...col, requests: col.requests.map(r => r.id === requestId ? updatedReq : r) }
        set(s => ({
          collections: s.collections.map(c => c.id === collectionId ? updatedCol : c),
          tabs: s.tabs.map(t => t.id === requestId ? { ...t, name } : t),
        }))
        if (githubToken && githubRepo && req._github?.path) {
          set({ syncStatus: 'saving', syncError: null })
          try {
            const saved = await saveRequest(githubToken, githubRepo.owner, githubRepo.name, updatedReq, col._github)
            const finalCol = { ...updatedCol, requests: updatedCol.requests.map(r => r.id === requestId ? saved : r) }
            set(s => ({
              collections: s.collections.map(c => c.id === collectionId ? finalCol : c),
              tabs: s.tabs.map(t => t.id === requestId ? { ...t, name, _github: saved._github } : t),
              dirtyTabIds: s.dirtyTabIds.filter(id => id !== requestId),
              syncStatus: 'idle',
            }))
          } catch (err) {
            set({ syncStatus: 'error', syncError: err.message })
          }
        }
      },

      async deleteRequestWithSync(collectionId, requestId) {
        const { githubToken, githubRepo, collections } = get()
        const col = collections.find(c => c.id === collectionId)
        if (!col) return
        const req = col.requests?.find(r => r.id === requestId)
        set(s => ({
          collections: s.collections.map(c =>
            c.id === collectionId ? { ...c, requests: c.requests.filter(r => r.id !== requestId) } : c
          ),
          dirtyTabIds: s.dirtyTabIds.filter(id => id !== requestId),
        }))
        if (githubToken && githubRepo && req?._github?.sha) {
          set({ syncStatus: 'saving', syncError: null })
          try {
            await deleteRequestFromRepo(githubToken, githubRepo.owner, githubRepo.name, req)
            set({ syncStatus: 'idle' })
          } catch (err) {
            set({ syncStatus: 'error', syncError: err.message })
          }
        }
      },

      async deleteCollectionWithSync(collectionId) {
        const { githubToken, githubRepo, collections } = get()
        const col = collections.find(c => c.id === collectionId)
        set(s => ({ collections: s.collections.filter(c => c.id !== collectionId) }))
        if (githubToken && githubRepo && col?._github) {
          set({ syncStatus: 'saving', syncError: null })
          try {
            await deleteCollectionFromRepo(githubToken, githubRepo.owner, githubRepo.name, col)
            set({ syncStatus: 'idle' })
          } catch (err) {
            set({ syncStatus: 'error', syncError: err.message })
          }
        }
      },
    }),
    {
      name: 'api-tester-store',
      partialize: s => ({
        collections: s.collections,
        environments: s.environments,
        activeEnvId: s.activeEnvId,
        history: s.history,
        githubToken: s.githubToken,
        githubUser: s.githubUser,
        githubRepo: s.githubRepo,
        tabs: s.tabs,
        activeTabId: s.activeTabId,
        dirtyTabIds: s.dirtyTabIds,
      }),
    }
  )
)

export const activeTab = s => s.tabs.find(t => t.id === s.activeTabId) ?? null
export const activeEnv = s => s.environments.find(e => e.id === s.activeEnvId) ?? null

function findCollectionForRequest(collections, requestId) {
  for (const col of collections) {
    if (searchCollection(col, requestId)) return col
  }
  return null
}

function searchCollection(node, requestId) {
  if (node.requests?.some(r => r.id === requestId)) return true
  return node.folders?.some(f => searchCollection(f, requestId)) ?? false
}

function updateRequestInCollections(collections, requestId, updated) {
  return collections.map(col => updateRequestInNode(col, requestId, updated))
}

function updateRequestInNode(node, requestId, updated) {
  return {
    ...node,
    requests: node.requests?.map(r => r.id === requestId ? updated : r) ?? [],
    folders: node.folders?.map(f => updateRequestInNode(f, requestId, updated)) ?? [],
  }
}
