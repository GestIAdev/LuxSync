/**
 * 🐝 GROUPS PANEL - WAVE 432: HIVE MIND
 * UI para gestionar grupos de fixtures
 * 
 * Secciones:
 * - SYSTEM GROUPS: Auto-generados (All, By Type, By Zone)
 * - USER GROUPS: Persistentes en ShowFile
 * 
 * Interacción:
 * - Click en grupo → Selecciona fixtures + Auto-switch a CONTROLS
 * - Botón X → Borrar grupo de usuario
 * - "Save as Group" → Crea grupo desde selección actual
 */

import React, { useMemo, useCallback, useState } from 'react'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import { useTruthStore, selectHardware } from '../../../stores/truthStore'
import './GroupsPanel.css'

interface GroupsPanelProps {
  onSwitchToControls: () => void
}

// Zone colors for visual distinction
const ZONE_COLORS: Record<string, string> = {
  'ceiling-front': '#FFDD00',  // Yellow
  'ceiling-back': '#A855F7',   // Purple
  'ceiling-left': '#00FFFF',   // Cyan
  'ceiling-right': '#FF6B6B',  // Coral
  'ceiling-center': '#4ADE80', // Green
  'stage-left': '#00FFFF',
  'stage-right': '#FF6B6B',
  'stage-center': '#4ADE80',
  'floor-front': '#FFDD00',
  'floor-back': '#A855F7',
  'truss-1': '#F97316',
  'truss-2': '#06B6D4',
  'truss-3': '#EC4899',
  'unassigned': '#666666',
}

// Type colors
const TYPE_COLORS: Record<string, string> = {
  'moving-head': '#00FFFF',
  'par': '#4ADE80',
  'wash': '#F97316',
  'strobe': '#FFFF00',
  'laser': '#FF0040',
  'blinder': '#FFFFFF',
  'generic': '#888888',
}

export const GroupsPanel: React.FC<GroupsPanelProps> = ({ onSwitchToControls }) => {
  // Stores
  const selectedIds = useSelectionStore(state => [...state.selectedIds])
  const selectMultiple = useSelectionStore(state => state.selectMultiple)
  const hardware = useTruthStore(selectHardware)
  const userGroups = useStageStore(state => state.groups)
  const createGroup = useStageStore(state => state.createGroup)
  const deleteGroup = useStageStore(state => state.deleteGroup)
  
  // Local state for new group name input
  const [isCreating, setIsCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  
  // All fixtures from hardware
  const fixtures = useMemo(() => hardware?.fixtures || [], [hardware?.fixtures])
  
  // ═══════════════════════════════════════════════════════════════════════
  // SYSTEM GROUPS - Auto-generated
  // ═══════════════════════════════════════════════════════════════════════
  
  const systemGroups = useMemo(() => {
    const groups: Array<{
      id: string
      name: string
      fixtureIds: string[]
      color: string
      category: 'all' | 'type' | 'zone'
    }> = []
    
    // ALL FIXTURES
    if (fixtures.length > 0) {
      groups.push({
        id: 'sys-all',
        name: 'ALL FIXTURES',
        fixtureIds: fixtures.map((f: any) => f.id),
        color: '#00FFFF',
        category: 'all'
      })
    }
    
    // BY TYPE
    const typeMap = new Map<string, string[]>()
    fixtures.forEach((f: any) => {
      const type = f.type || 'generic'
      if (!typeMap.has(type)) typeMap.set(type, [])
      typeMap.get(type)!.push(f.id)
    })
    
    typeMap.forEach((ids, type) => {
      if (ids.length > 0) {
        groups.push({
          id: `sys-type-${type}`,
          name: `All ${type.replace('-', ' ').toUpperCase()}S`,
          fixtureIds: ids,
          color: TYPE_COLORS[type] || '#888888',
          category: 'type'
        })
      }
    })
    
    // BY ZONE
    const zoneMap = new Map<string, string[]>()
    fixtures.forEach((f: any) => {
      const zone = f.zone || 'unassigned'
      if (!zoneMap.has(zone)) zoneMap.set(zone, [])
      zoneMap.get(zone)!.push(f.id)
    })
    
    zoneMap.forEach((ids, zone) => {
      if (ids.length > 0 && zone !== 'unassigned') {
        groups.push({
          id: `sys-zone-${zone}`,
          name: zone.replace(/-/g, ' ').toUpperCase(),
          fixtureIds: ids,
          color: ZONE_COLORS[zone] || '#888888',
          category: 'zone'
        })
      }
    })
    
    return groups
  }, [fixtures])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Click on group → Select fixtures + Switch to CONTROLS
   */
  const handleGroupClick = useCallback((fixtureIds: string[]) => {
    selectMultiple(fixtureIds, 'replace')
    // Auto-switch to controls tab after small delay (allows UI update)
    setTimeout(() => {
      onSwitchToControls()
    }, 50)
  }, [selectMultiple, onSwitchToControls])
  
  /**
   * Create new group from current selection
   */
  const handleCreateGroup = useCallback(() => {
    if (selectedIds.length === 0) return
    
    const name = newGroupName.trim() || `Group ${userGroups.length + 1}`
    createGroup(name, selectedIds)
    
    setNewGroupName('')
    setIsCreating(false)
    console.log(`[GroupsPanel] 🐝 Created group "${name}" with ${selectedIds.length} fixtures`)
  }, [selectedIds, newGroupName, userGroups.length, createGroup])
  
  /**
   * Delete user group
   */
  const handleDeleteGroup = useCallback((e: React.MouseEvent, groupId: string) => {
    e.stopPropagation() // Don't trigger group selection
    deleteGroup(groupId)
    console.log(`[GroupsPanel] 🗑️ Deleted group ${groupId}`)
  }, [deleteGroup])
  
  /**
   * Check if all group members are selected
   */
  const isGroupActive = useCallback((fixtureIds: string[]) => {
    if (fixtureIds.length === 0) return false
    return fixtureIds.every(id => selectedIds.includes(id))
  }, [selectedIds])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  return (
    <div className="groups-panel">
      {/* SYSTEM GROUPS */}
      <div className="groups-section">
        <div className="section-label">SYSTEM GROUPS</div>
        <div className="groups-grid">
          {systemGroups.map(group => (
            <button
              key={group.id}
              className={`group-btn ${isGroupActive(group.fixtureIds) ? 'active' : ''}`}
              style={{ '--group-color': group.color } as React.CSSProperties}
              onClick={() => handleGroupClick(group.fixtureIds)}
            >
              <span className="group-name">{group.name}</span>
              <span className="group-count">({group.fixtureIds.length})</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* USER GROUPS */}
      <div className="groups-section">
        <div className="section-label">USER GROUPS</div>
        
        {userGroups.length === 0 && !isCreating ? (
          <div className="no-groups-hint">
            Select fixtures and save as group
          </div>
        ) : (
          <div className="groups-grid">
            {userGroups.map(group => (
              <button
                key={group.id}
                className={`group-btn user-group ${isGroupActive(group.fixtureIds) ? 'active' : ''}`}
                style={{ '--group-color': group.color || '#00FFFF' } as React.CSSProperties}
                onClick={() => handleGroupClick(group.fixtureIds)}
              >
                <span className="group-name">{group.name}</span>
                <span className="group-count">({group.fixtureIds.length})</span>
                <button
                  className="group-delete-btn"
                  onClick={(e) => handleDeleteGroup(e, group.id)}
                  title="Delete group"
                >
                  ×
                </button>
              </button>
            ))}
          </div>
        )}
        
        {/* CREATE NEW GROUP */}
        {selectedIds.length > 0 && (
          <div className="create-group-section">
            {isCreating ? (
              <div className="create-group-form">
                <input
                  type="text"
                  className="group-name-input"
                  placeholder="Group name..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateGroup()
                    if (e.key === 'Escape') setIsCreating(false)
                  }}
                  autoFocus
                />
                <button className="save-group-btn" onClick={handleCreateGroup}>
                  ✓
                </button>
                <button className="cancel-group-btn" onClick={() => setIsCreating(false)}>
                  ×
                </button>
              </div>
            ) : (
              <button 
                className="create-group-btn"
                onClick={() => setIsCreating(true)}
              >
                <span className="create-icon">+</span>
                SAVE SELECTION AS GROUP ({selectedIds.length})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default GroupsPanel
