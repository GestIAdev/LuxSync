/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨️ KEYBOARD SHORTCUTS - WAVE 363
 * "Los Comandos de Batalla - Velocidad GrandMA"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Sistema de atajos de teclado para el Stage Constructor.
 * Implementa la velocidad de workflow de consolas profesionales.
 * 
 * SHORTCUTS:
 * - 1-9: Seleccionar Grupo 1-9 (asignados con hotkey)
 * - Ctrl+G / Cmd+G: Crear grupo con selección actual
 * - Escape: Deseleccionar todo
 * - Delete / Backspace: Eliminar fixtures seleccionados
 * - Ctrl+A / Cmd+A: Seleccionar todos
 * - V: Tool mode: Select
 * - B: Tool mode: Box Select
 * 
 * @module components/views/StageConstructor/KeyboardShortcuts
 * @version 363.0.0
 */

import { useEffect, useCallback, useRef } from 'react'
import { useStageStore } from '../../../stores/stageStore'
import { useSelectionStore } from '../../../stores/selectionStore'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ShortcutHandlers {
  /** Callback para crear grupo (abre modal/prompt) */
  onCreateGroup?: () => void
  
  /** Callback para cambiar tool mode */
  onToolModeChange?: (mode: 'select' | 'boxSelect') => void
  
  /** Callback para confirmar acción destructiva (eliminar) */
  onConfirmDelete?: () => boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook que registra todos los atajos de teclado del Stage Constructor
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   onCreateGroup: () => setShowGroupModal(true),
 *   onToolModeChange: (mode) => setToolMode(mode)
 * })
 * ```
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}): void {
  const { onCreateGroup, onToolModeChange, onConfirmDelete } = handlers
  
  // Store hooks
  const groups = useStageStore(state => state.groups)
  const fixtures = useStageStore(state => state.fixtures)
  const removeFixture = useStageStore(state => state.removeFixture)
  const createGroup = useStageStore(state => state.createGroup)
  
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const selectMultiple = useSelectionStore(state => state.selectMultiple)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  
  // Ref para evitar memory leaks
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: GROUP SELECTION (1-9)
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleGroupSelection = useCallback((key: string) => {
    // Buscar grupo con este hotkey
    const group = groups.find(g => g.hotkey === key)
    
    if (group && group.fixtureIds.length > 0) {
      selectMultiple(group.fixtureIds, 'replace')
      return true
    }
    
    return false
  }, [groups, selectMultiple])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: CREATE GROUP (Ctrl+G)
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleCreateGroup = useCallback(() => {
    if (selectedIds.size === 0) {
      // Nada seleccionado
      return false
    }
    
    if (handlersRef.current.onCreateGroup) {
      // Usar handler externo (abre modal)
      handlersRef.current.onCreateGroup()
    } else {
      // Crear grupo directamente con nombre automático
      const name = `Group ${groups.length + 1}`
      createGroup(name, Array.from(selectedIds))
    }
    
    return true
  }, [selectedIds, groups.length, createGroup])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: DELETE FIXTURES
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return false
    
    // Confirmar si hay handler de confirmación
    if (handlersRef.current.onConfirmDelete) {
      const confirmed = handlersRef.current.onConfirmDelete()
      if (!confirmed) return false
    }
    
    // Eliminar todos los seleccionados
    const idsToDelete = Array.from(selectedIds)
    for (const id of idsToDelete) {
      removeFixture(id)
    }
    
    deselectAll()
    return true
  }, [selectedIds, removeFixture, deselectAll])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: SELECT ALL (Ctrl+A)
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleSelectAll = useCallback(() => {
    if (fixtures.length === 0) return false
    
    const allIds = fixtures.map(f => f.id)
    selectMultiple(allIds, 'replace')
    return true
  }, [fixtures, selectMultiple])
  
  // ═══════════════════════════════════════════════════════════════════════
  // MAIN KEYBOARD HANDLER
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignorar si estamos escribiendo en un input
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return
    }
    
    const key = event.key
    const isCtrlOrCmd = event.ctrlKey || event.metaKey
    
    // ─────────────────────────────────────────────────────────────────────
    // 1-9: Selección rápida de grupos
    // ─────────────────────────────────────────────────────────────────────
    if (/^[1-9]$/.test(key) && !isCtrlOrCmd && !event.shiftKey && !event.altKey) {
      const handled = handleGroupSelection(key)
      if (handled) {
        event.preventDefault()
        return
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Ctrl+G / Cmd+G: Crear grupo
    // ─────────────────────────────────────────────────────────────────────
    if (key.toLowerCase() === 'g' && isCtrlOrCmd && !event.shiftKey) {
      event.preventDefault()
      handleCreateGroup()
      return
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Escape: Deseleccionar todo
    // ─────────────────────────────────────────────────────────────────────
    if (key === 'Escape') {
      event.preventDefault()
      deselectAll()
      return
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Delete / Backspace: Eliminar selección
    // ─────────────────────────────────────────────────────────────────────
    if ((key === 'Delete' || key === 'Backspace') && !isCtrlOrCmd) {
      // Evitar backspace como navegación del navegador
      event.preventDefault()
      handleDelete()
      return
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Ctrl+A / Cmd+A: Seleccionar todo
    // ─────────────────────────────────────────────────────────────────────
    if (key.toLowerCase() === 'a' && isCtrlOrCmd && !event.shiftKey) {
      event.preventDefault()
      handleSelectAll()
      return
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // V: Tool mode Select
    // ─────────────────────────────────────────────────────────────────────
    if (key.toLowerCase() === 'v' && !isCtrlOrCmd && !event.shiftKey) {
      event.preventDefault()
      handlersRef.current.onToolModeChange?.('select')
      return
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // B: Tool mode Box Select
    // ─────────────────────────────────────────────────────────────────────
    if (key.toLowerCase() === 'b' && !isCtrlOrCmd && !event.shiftKey) {
      event.preventDefault()
      handlersRef.current.onToolModeChange?.('boxSelect')
      return
    }
    
  }, [handleGroupSelection, handleCreateGroup, handleDelete, handleSelectAll, deselectAll])
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT: Register/Unregister listener
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}

// ═══════════════════════════════════════════════════════════════════════════
// SHORTCUT REFERENCE (for UI display)
// ═══════════════════════════════════════════════════════════════════════════

export interface ShortcutDefinition {
  key: string
  description: string
  category: 'selection' | 'groups' | 'tools' | 'editing'
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  // Selection
  { key: '1-9', description: 'Select Group 1-9', category: 'selection' },
  { key: 'Ctrl+A', description: 'Select All', category: 'selection' },
  { key: 'Escape', description: 'Deselect All', category: 'selection' },
  
  // Groups
  { key: 'Ctrl+G', description: 'Create Group from Selection', category: 'groups' },
  
  // Tools
  { key: 'V', description: 'Select Tool', category: 'tools' },
  { key: 'B', description: 'Box Selection Tool', category: 'tools' },
  
  // Editing
  { key: 'Delete', description: 'Delete Selected Fixtures', category: 'editing' },
]

export default useKeyboardShortcuts
