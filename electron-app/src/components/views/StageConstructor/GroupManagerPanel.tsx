/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 GROUP MANAGER PANEL - WAVE 363
 * "El Comité de Poder - Organiza, Domina, Conquista"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Panel de gestión de grupos de fixtures. Permite:
 * - Crear grupos desde selección actual
 * - Seleccionar grupos con un click
 * - Renombrar grupos con doble click
 * - Asignar shortcuts 1-9
 * - Eliminar grupos
 * 
 * INTEGRACIÓN:
 * - stageStore: createGroup, deleteGroup, updateGroup
 * - selectionStore: selectMultiple para selección de grupo
 * 
 * @module components/views/StageConstructor/GroupManagerPanel
 * @version 363.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useStageStore } from '../../../stores/stageStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { Users, Plus, Trash2, Edit3, Keyboard, Check, X } from 'lucide-react'
import type { FixtureGroup } from '../../../core/stage/ShowFileV2'
import './GroupManagerPanel.css'

// ═══════════════════════════════════════════════════════════════════════════
// COLORS - Paleta determinista (NO Math.random)
// ═══════════════════════════════════════════════════════════════════════════

const GROUP_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#fbbf24', // Amber
  '#84cc16', // Lime
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
]

/**
 * Obtiene el siguiente color basándose en el contador de grupos
 * DETERMINÍSTICO - Axioma Anti-Simulación
 */
function getNextColor(groupCount: number): string {
  return GROUP_COLORS[groupCount % GROUP_COLORS.length]
}

// ═══════════════════════════════════════════════════════════════════════════
// GROUP ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface GroupItemProps {
  group: FixtureGroup
  isActive: boolean
  onSelect: () => void
  onRename: (newName: string) => void
  onDelete: () => void
  onAssignHotkey: (hotkey: string | undefined) => void
}

const GroupItem: React.FC<GroupItemProps> = ({
  group,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onAssignHotkey
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(group.name)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Focus input cuando entramos en modo edición
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])
  
  const handleDoubleClick = useCallback(() => {
    if (!group.isSystem) {
      setIsEditing(true)
      setEditValue(group.name)
    }
  }, [group.isSystem, group.name])
  
  const handleConfirmRename = useCallback(() => {
    if (editValue.trim() && editValue !== group.name) {
      onRename(editValue.trim())
    }
    setIsEditing(false)
  }, [editValue, group.name, onRename])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmRename()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(group.name)
    }
  }, [handleConfirmRename, group.name])
  
  // Hotkey display (1-9)
  const hotkeyNumber = group.hotkey?.match(/^[1-9]$/)?.[0]
  
  return (
    <div 
      className={`group-item-row ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
    >
      {/* Color indicator */}
      <span 
        className="group-color-dot"
        style={{ backgroundColor: group.color }}
      />
      
      {/* Name / Edit Field */}
      {isEditing ? (
        <div className="group-edit-container">
          <input
            ref={inputRef}
            type="text"
            className="group-edit-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleConfirmRename}
          />
          <button 
            className="group-edit-btn confirm"
            onClick={handleConfirmRename}
            title="Confirm"
          >
            <Check size={12} />
          </button>
          <button 
            className="group-edit-btn cancel"
            onClick={() => {
              setIsEditing(false)
              setEditValue(group.name)
            }}
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <span className="group-name">{group.name}</span>
          
          {/* Fixture count */}
          <span className="group-fixture-count">
            {group.fixtureIds.length}
          </span>
          
          {/* Hotkey badge */}
          {hotkeyNumber && (
            <span className="group-hotkey-badge">
              {hotkeyNumber}
            </span>
          )}
          
          {/* Actions (only for non-system groups) */}
          {!group.isSystem && (
            <div className="group-actions">
              <button
                className="group-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDoubleClick()
                }}
                title="Rename"
              >
                <Edit3 size={12} />
              </button>
              <button
                className="group-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  // Cycle hotkey 1-9, then undefined
                  const next = hotkeyNumber 
                    ? (parseInt(hotkeyNumber) < 9 ? String(parseInt(hotkeyNumber) + 1) : undefined)
                    : '1'
                  onAssignHotkey(next)
                }}
                title={hotkeyNumber ? `Hotkey: ${hotkeyNumber}` : 'Assign Hotkey'}
              >
                <Keyboard size={12} />
              </button>
              <button
                className="group-action-btn delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                title="Delete Group"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface GroupManagerPanelProps {
  className?: string
}

const GroupManagerPanel: React.FC<GroupManagerPanelProps> = ({ className }) => {
  // Stores
  const groups = useStageStore(state => state.groups)
  const createGroup = useStageStore(state => state.createGroup)
  const deleteGroup = useStageStore(state => state.deleteGroup)
  const updateGroup = useStageStore(state => state.updateGroup)
  
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const selectMultiple = useSelectionStore(state => state.selectMultiple)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  
  // Local state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const newGroupInputRef = useRef<HTMLInputElement>(null)
  
  // Derived: selected fixtures count
  const selectedCount = selectedIds.size
  const canCreateGroup = selectedCount > 0
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Crear grupo desde selección actual
   */
  const handleCreateGroup = useCallback(() => {
    if (!canCreateGroup) return
    
    const name = newGroupName.trim() || `Group ${groups.length + 1}`
    const fixtureIds = Array.from(selectedIds)
    
    // Crear grupo con color determinístico
    const group = createGroup(name, fixtureIds)
    
    // Asignar color
    const color = getNextColor(groups.length)
    updateGroup(group.id, { color })
    
    // Reset modal
    setShowCreateModal(false)
    setNewGroupName('')
  }, [canCreateGroup, newGroupName, groups.length, selectedIds, createGroup, updateGroup])
  
  /**
   * Seleccionar todos los fixtures de un grupo
   */
  const handleSelectGroup = useCallback((group: FixtureGroup) => {
    if (group.fixtureIds.length === 0) return
    selectMultiple(group.fixtureIds, 'replace')
  }, [selectMultiple])
  
  /**
   * Renombrar grupo
   */
  const handleRenameGroup = useCallback((groupId: string, newName: string) => {
    updateGroup(groupId, { name: newName })
  }, [updateGroup])
  
  /**
   * Asignar hotkey a grupo
   */
  const handleAssignHotkey = useCallback((groupId: string, hotkey: string | undefined) => {
    // Quitar hotkey de otros grupos que la tengan
    if (hotkey) {
      const existingGroup = groups.find(g => g.hotkey === hotkey)
      if (existingGroup && existingGroup.id !== groupId) {
        updateGroup(existingGroup.id, { hotkey: undefined })
      }
    }
    updateGroup(groupId, { hotkey })
  }, [groups, updateGroup])
  
  /**
   * Eliminar grupo (con confirmación implícita por el diseño)
   */
  const handleDeleteGroup = useCallback((groupId: string) => {
    deleteGroup(groupId)
  }, [deleteGroup])
  
  // Focus en input cuando se abre el modal
  useEffect(() => {
    if (showCreateModal && newGroupInputRef.current) {
      newGroupInputRef.current.focus()
    }
  }, [showCreateModal])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  return (
    <div className={`group-manager-panel ${className || ''}`}>
      {/* Header */}
      <div className="panel-header">
        <Users size={16} className="header-icon" />
        <span className="header-title">Groups</span>
        <span className="header-count">{groups.length}</span>
      </div>
      
      {/* Create Group Button */}
      <div className="create-group-section">
        {showCreateModal ? (
          <div className="create-group-modal">
            <input
              ref={newGroupInputRef}
              type="text"
              className="create-group-input"
              placeholder={`Group ${groups.length + 1}`}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateGroup()
                if (e.key === 'Escape') setShowCreateModal(false)
              }}
            />
            <div className="create-group-actions">
              <button
                className="create-confirm-btn"
                onClick={handleCreateGroup}
                disabled={!canCreateGroup}
              >
                <Check size={14} />
                Create
              </button>
              <button
                className="create-cancel-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={14} />
              </button>
            </div>
            {!canCreateGroup && (
              <span className="create-hint">Select fixtures first</span>
            )}
          </div>
        ) : (
          <button
            className="create-group-btn"
            onClick={() => setShowCreateModal(true)}
            disabled={!canCreateGroup}
            title={canCreateGroup 
              ? `Create group from ${selectedCount} selected fixture${selectedCount > 1 ? 's' : ''}`
              : 'Select fixtures to create a group'}
          >
            <Plus size={14} />
            <span>Create from Selection</span>
            {canCreateGroup && (
              <span className="selection-count">{selectedCount}</span>
            )}
          </button>
        )}
      </div>
      
      {/* Groups List */}
      <div className="groups-list">
        {groups.length === 0 ? (
          <div className="empty-groups">
            <Users size={24} className="empty-icon" />
            <p>No groups created</p>
            <span>Select fixtures and click "Create from Selection"</span>
          </div>
        ) : (
          groups
            .sort((a, b) => a.order - b.order)
            .map(group => (
              <GroupItem
                key={group.id}
                group={group}
                isActive={group.fixtureIds.every(id => selectedIds.has(id)) && group.fixtureIds.length > 0}
                onSelect={() => handleSelectGroup(group)}
                onRename={(name) => handleRenameGroup(group.id, name)}
                onDelete={() => handleDeleteGroup(group.id)}
                onAssignHotkey={(hotkey) => handleAssignHotkey(group.id, hotkey)}
              />
            ))
        )}
      </div>
      
      {/* Keyboard Shortcuts Hint */}
      <div className="shortcuts-hint">
        <Keyboard size={12} />
        <span>1-9: Quick select groups • Ctrl+G: Create group</span>
      </div>
    </div>
  )
}

export default GroupManagerPanel
