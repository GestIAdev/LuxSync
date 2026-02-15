/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 SELECTION STORE - WAVE 30: Stage Command & Dashboard
 * Gestiona la selección de fixtures en las vistas 2D y 3D
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - selectedIds: Set de fixtures seleccionados
 * - hoveredId: Fixture bajo el cursor
 * - Multi-selección (Ctrl+Click, Shift+Range, Box Select)
 * - Integración con InspectorControls
 * 
 * @module stores/selectionStore
 * @version 30.1.0
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Modo de selección */
export type SelectionMode = 'replace' | 'add' | 'remove' | 'toggle'

/** Fuente de la selección */
export type SelectionSource = 'click' | 'box' | 'keyboard' | 'api'

/** Estado del Selection Store */
export interface SelectionState {
  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** IDs de fixtures seleccionados */
  selectedIds: Set<string>
  
  /** Fixture bajo el cursor (hover) */
  hoveredId: string | null
  
  /** Último fixture seleccionado (para Shift+Click range) */
  lastSelectedId: string | null
  
  /** Fuente de la última selección */
  selectionSource: SelectionSource
  
  // ═══════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Seleccionar un fixture
   * @param id - ID del fixture
   * @param mode - Modo de selección ('replace' por defecto)
   */
  select: (id: string, mode?: SelectionMode) => void
  
  /**
   * Seleccionar múltiples fixtures (box selection, etc.)
   * @param ids - Array de IDs
   * @param mode - Modo de selección ('replace' por defecto)
   */
  selectMultiple: (ids: string[], mode?: SelectionMode) => void
  
  /**
   * Deseleccionar un fixture específico
   */
  deselect: (id: string) => void
  
  /**
   * Limpiar toda la selección
   */
  deselectAll: () => void
  
  /**
   * Toggle de selección (Ctrl+Click)
   */
  toggleSelection: (id: string) => void
  
  /**
   * Establecer fixture hover
   */
  setHovered: (id: string | null) => void
  
  /**
   * Selección de rango (Shift+Click)
   * @param fromId - Desde fixture
   * @param toId - Hasta fixture
   * @param allIds - Lista ordenada de todos los IDs disponibles
   */
  selectRange: (fromId: string, toId: string, allIds: string[]) => void
  
  /**
   * Invertir selección (seleccionar no-seleccionados)
   */
  invertSelection: (allIds: string[]) => void
  
  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTED HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** ¿Está seleccionado este fixture? */
  isSelected: (id: string) => boolean
  
  /** ¿Hay alguna selección activa? */
  hasSelection: () => boolean
  
  /** Número de fixtures seleccionados */
  getSelectedCount: () => number
  
  /** Array de IDs seleccionados */
  getSelectedArray: () => string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useSelectionStore = create<SelectionState>()(
  subscribeWithSelector((set, get) => ({
    // ═══════════════════════════════════════════════════════════════════════
    // INITIAL STATE
    // ═══════════════════════════════════════════════════════════════════════
    
    selectedIds: new Set<string>(),
    hoveredId: null,
    lastSelectedId: null,
    selectionSource: 'click',
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    select: (id, mode = 'replace') => {
      set((state) => {
        const newSet = new Set(state.selectedIds)
        
        switch (mode) {
          case 'replace':
            newSet.clear()
            newSet.add(id)
            break
          case 'add':
            newSet.add(id)
            break
          case 'remove':
            newSet.delete(id)
            break
          case 'toggle':
            if (newSet.has(id)) {
              newSet.delete(id)
            } else {
              newSet.add(id)
            }
            break
        }
        
        return {
          selectedIds: newSet,
          lastSelectedId: id,
          selectionSource: 'click' as const,
        }
      })
    },
    
    selectMultiple: (ids, mode = 'replace') => {
      set((state) => {
        let newSet: Set<string>
        
        switch (mode) {
          case 'replace':
            newSet = new Set(ids)
            break
          case 'add':
            newSet = new Set([...state.selectedIds, ...ids])
            break
          case 'remove':
            newSet = new Set([...state.selectedIds].filter(id => !ids.includes(id)))
            break
          case 'toggle':
            newSet = new Set(state.selectedIds)
            ids.forEach(id => {
              if (newSet.has(id)) {
                newSet.delete(id)
              } else {
                newSet.add(id)
              }
            })
            break
          default:
            newSet = new Set(ids)
        }
        
        return {
          selectedIds: newSet,
          lastSelectedId: ids[ids.length - 1] || null,
          selectionSource: 'box' as const,
        }
      })
    },
    
    deselect: (id) => {
      set((state) => {
        const newSet = new Set(state.selectedIds)
        newSet.delete(id)
        return { selectedIds: newSet }
      })
    },
    
    deselectAll: () => {
      set({
        selectedIds: new Set(),
        lastSelectedId: null,
      })
    },
    
    toggleSelection: (id) => {
      get().select(id, 'toggle')
    },
    
    setHovered: (id) => {
      set({ hoveredId: id })
    },
    
    selectRange: (fromId, toId, allIds) => {
      const fromIndex = allIds.indexOf(fromId)
      const toIndex = allIds.indexOf(toId)
      
      if (fromIndex === -1 || toIndex === -1) return
      
      const start = Math.min(fromIndex, toIndex)
      const end = Math.max(fromIndex, toIndex)
      const rangeIds = allIds.slice(start, end + 1)
      
      set((state) => ({
        selectedIds: new Set([...state.selectedIds, ...rangeIds]),
        lastSelectedId: toId,
        selectionSource: 'keyboard' as const,
      }))
    },
    
    invertSelection: (allIds) => {
      set((state) => {
        const newSet = new Set<string>()
        allIds.forEach(id => {
          if (!state.selectedIds.has(id)) {
            newSet.add(id)
          }
        })
        return { selectedIds: newSet }
      })
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // COMPUTED HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    
    isSelected: (id) => get().selectedIds.has(id),
    hasSelection: () => get().selectedIds.size > 0,
    getSelectedCount: () => get().selectedIds.size,
    getSelectedArray: () => [...get().selectedIds],
  }))
)

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS (Optimized for React rerenders)
// ═══════════════════════════════════════════════════════════════════════════

export const selectSelectedIds = (state: SelectionState) => state.selectedIds
export const selectHoveredId = (state: SelectionState) => state.hoveredId
export const selectLastSelectedId = (state: SelectionState) => state.lastSelectedId
export const selectHasSelection = (state: SelectionState) => state.selectedIds.size > 0
export const selectSelectionCount = (state: SelectionState) => state.selectedIds.size
export const selectSelectionSource = (state: SelectionState) => state.selectionSource

/**
 * Selector para verificar si un fixture específico está seleccionado
 * Uso: const isSelected = useSelectionStore(selectIsSelected('fixture-1'))
 */
export const selectIsSelected = (id: string) => (state: SelectionState) => 
  state.selectedIds.has(id)

/**
 * Selector para obtener array de IDs seleccionados
 * Nota: Crea un nuevo array en cada llamada, usar con shallow comparison
 */
export const selectSelectedArray = (state: SelectionState) => [...state.selectedIds]

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 2042.13: REACT 19 FIX - Stable Hook for selectSelectedArray
// ═══════════════════════════════════════════════════════════════════════════
import { useShallow } from 'zustand/shallow'

export const useSelectedArray = () => {
  return useSelectionStore(useShallow(selectSelectedArray))
}

/** Selector: VisualizerCanvas - selection actions */
export const selectVisualizerActions = (state: SelectionState) => ({
  toggleSelection: state.toggleSelection,
  select: state.select,
  selectMultiple: state.selectMultiple,
  deselectAll: state.deselectAll,
})

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook para manejar click con modificadores (Ctrl, Shift)
 * @returns Función handler para onClick
 */
export const useSelectionClick = () => {
  const { select, toggleSelection, selectRange, lastSelectedId, getSelectedArray } = useSelectionStore()
  
  return (id: string, event: React.MouseEvent | MouseEvent, allIds: string[]) => {
    if (event.shiftKey && lastSelectedId) {
      // Shift+Click: Selección de rango
      selectRange(lastSelectedId, id, allIds)
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Toggle individual
      toggleSelection(id)
    } else {
      // Click normal: Reemplazar selección
      select(id, 'replace')
    }
  }
}

export default useSelectionStore
