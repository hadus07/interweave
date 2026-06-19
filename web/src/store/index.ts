import { createContext, useContext } from 'react'
import { createStore, useStore } from 'zustand'
import type { ExpandDirection } from '~shared/canvas'
import type { Graph } from '~shared/graph'
import { type GraphViewAction, graphView } from '../lib/graphView'

const excludedKey = (root: string) => `intertangle:excluded:${root}`
const hiddenKey = (root: string) => `intertangle:hidden:${root}`

function readSeeds(): Set<string> {
  const raw = new URLSearchParams(window.location.search).get('seeds')
  return raw ? new Set(raw.split(',')) : new Set<string>()
}

interface AppState {
  expanded: Set<string>
  excluded: Set<string>
  sourcePath: string | null
  chips: string[]
  theme: 'light' | 'dark'
  paletteOpen: boolean
  expand: (path: string, direction: ExpandDirection) => void
  seed: (path: string) => void
  showSource: (path: string) => void
  hideSource: () => void
  remove: (path: string) => void
  setExclusion: (files: string[], exclude: boolean) => void
  clear: () => void
  addChip: (pattern: string) => void
  removeChip: (pattern: string) => void
  toggleTheme: () => void
  setPaletteOpen: (open: boolean) => void
}

export const createAppStore = (graph: Graph) =>
  createStore<AppState>((set, get) => {
    function dispatch(action: GraphViewAction) {
      const { expanded, excluded, sourcePath } = graphView(graph, get(), action)
      set({ expanded, excluded, sourcePath })
    }

    return {
      expanded: readSeeds(),
      excluded: new Set<string>(JSON.parse(localStorage.getItem(excludedKey(graph.root)) ?? '[]')),
      sourcePath: null,
      chips: JSON.parse(localStorage.getItem(hiddenKey(graph.root)) ?? '[]') as string[],
      theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
      paletteOpen: false,

      expand: (path, direction) => dispatch({ type: 'expand', path, direction }),
      seed: path => dispatch({ type: 'seed', path }),
      showSource: path => dispatch({ type: 'showSource', path }),
      hideSource: () => dispatch({ type: 'showSource', path: null }),
      remove: path => dispatch({ type: 'remove', path }),
      setExclusion: (files, exclude) => {
        const next = new Set(get().excluded)
        for (const f of files) {
          if (exclude) next.add(f)
          else next.delete(f)
        }
        localStorage.setItem(excludedKey(graph.root), JSON.stringify([...next]))
        dispatch({ type: 'setExcluded', excluded: next })
      },
      clear: () => dispatch({ type: 'clear' }),
      addChip: pattern => {
        const { chips } = get()
        if (chips.includes(pattern)) return
        const next = [...chips, pattern]
        localStorage.setItem(hiddenKey(graph.root), JSON.stringify(next))
        set({ chips: next })
      },
      removeChip: pattern => {
        const next = get().chips.filter(p => p !== pattern)
        localStorage.setItem(hiddenKey(graph.root), JSON.stringify(next))
        set({ chips: next })
      },
      toggleTheme: () => {
        const next: 'light' | 'dark' = get().theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = next
        localStorage.setItem('intertangle:theme', next)
        set({ theme: next })
      },
      setPaletteOpen: open => set({ paletteOpen: open }),
    }
  })

export type AppStoreApi = ReturnType<typeof createAppStore>
export const AppStoreContext = createContext<AppStoreApi | null>(null)

export function useAppStore<T>(selector: (s: AppState) => T): T {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore outside AppStoreContext')
  return useStore(store, selector)
}

export function useAppStoreSnapshot() {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStoreSnapshot outside AppStoreContext')
  return store.getState()
}
