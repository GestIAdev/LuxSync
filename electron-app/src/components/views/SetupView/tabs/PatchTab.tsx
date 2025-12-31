/**
 * 💡 PATCH TAB - The Patch Workshop
 * WAVE 26 Phase 3: Complete Implementation
 * 
 * Features:
 * - Dense professional table layout
 * - Real-time fixture status (Live Dot)
 * - Add Fixture modal with library scanner
 * - Auto-address calculation
 * - Zone assignment with dropdown
 * - Flash test & delete actions
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTruthStore, selectHardware } from '../../../../stores/truthStore'
import { AddFixtureModal, type LibraryItem } from './AddFixtureModal'
import { FixtureEditorModal } from '../../../modals/FixtureEditor/FixtureEditorModal'
import type { FixtureDefinition } from '../../../../types/FixtureDefinition'
import './PatchTab.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type FixtureZone = 'FRONT_PARS' | 'BACK_PARS' | 'MOVING_LEFT' | 'MOVING_RIGHT' | 'STROBES' | 'LASERS' | 'UNASSIGNED'

interface PatchedFixture {
  id: string
  name: string
  manufacturer: string
  channelCount: number
  type: string
  dmxAddress: number
  universe: number
  zone: FixtureZone
  filePath: string
}

// Zone display names
const ZONE_LABELS: Record<FixtureZone, string> = {
  'FRONT_PARS': 'Front',
  'BACK_PARS': 'Back',
  'MOVING_LEFT': 'Left',
  'MOVING_RIGHT': 'Right',
  'STROBES': 'Strobes',
  'LASERS': 'Lasers',
  'UNASSIGNED': 'None',
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const getLuxApi = () => (window as any).lux

/**
 * Format DMX address as 3-digit string
 */
const formatAddress = (addr: number): string => {
  return addr.toString().padStart(3, '0')
}

/**
 * Generate fixture ID from index
 */
const formatFixtureId = (index: number): string => {
  return `fix_${(index + 1).toString().padStart(2, '0')}`
}

/**
 * Get fixture type icon
 */
const getTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'moving_head': '🎯',
    'par': '💡',
    'wash': '🌊',
    'strobe': '⚡',
    'laser': '🔴',
    'generic': '○',
  }
  return icons[type] || '○'
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const PatchTab: React.FC = () => {
  // State
  const [fixtures, setFixtures] = useState<PatchedFixture[]>([])
  const [library, setLibrary] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showForgeModal, setShowForgeModal] = useState(false)
  const [flashingFixture, setFlashingFixture] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // WAVE 256: Edit mode
  const [editingFixture, setEditingFixture] = useState<PatchedFixture | null>(null)
  const [editForm, setEditForm] = useState({ dmxAddress: 0, name: '' })

  // Get real-time hardware data from truthStore (includes DMX state)
  const hardwareState = useTruthStore(selectHardware)

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD DATA
  // ─────────────────────────────────────────────────────────────────────────

  const loadFixtures = useCallback(async () => {
    try {
      const api = getLuxApi()
      if (!api) {
        console.warn('[PatchTab] window.lux not available')
        setLoading(false)
        return
      }

      // Load patched fixtures
      const patchResult = await api.getPatchedFixtures()
      if (patchResult?.success && patchResult.fixtures) {
        setFixtures(patchResult.fixtures)
      }

      // Scan library
      const scanResult = await api.scanFixtures()
      if (scanResult?.success && scanResult.fixtures) {
        // Normalize fixtures to ensure 'modes' exists for older files
        const normalized = scanResult.fixtures.map((f: any) => ({
          ...f,
          modes: f.modes ?? [{ name: 'Standard', channels: f.channels ?? [] }]
        }))
        setLibrary(normalized)
      }

      setLoading(false)
      setError(null)
    } catch (err) {
      console.error('[PatchTab] Load error:', err)
      setError('Error loading fixtures')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFixtures()
  }, [loadFixtures])

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate next available DMX address
   */
  const getNextAddress = useCallback((): number => {
    if (fixtures.length === 0) return 1
    
    // Find the highest end address
    let maxEnd = 0
    for (const fix of fixtures) {
      const endAddr = fix.dmxAddress + fix.channelCount - 1
      if (endAddr > maxEnd) maxEnd = endAddr
    }
    
    return maxEnd + 1
  }, [fixtures])

  /**
   * Handle adding new fixtures
   */
  /**
   * Handle adding new fixtures with Professional Config
   */
  const handleAddFixtures = async (
    modelId: string, 
    quantity: number, 
    startAddress: number,
    config: any // Ahora recibimos la config física
  ) => {
    const api = getLuxApi()
    if (!api) return

    try {
      const model = library.find(f => f.id === modelId)
      if (!model) {
        setError('Model not found in library')
        return
      }

      let currentAddr = startAddress
      for (let i = 0; i < quantity; i++) {
        // Enviar al backend incluyendo la config física
        // El backend debe pasar esto al PhysicsDriver.registerFixture
        await api.patchFixture(modelId, currentAddr, {
          // Metadata estándar
          universe: 1,
          // Configuración física PRO
          physics: {
            installationType: config.orientation,
            invert: { pan: config.invertPan, tilt: config.invertTilt },
            swapXY: config.swapXY
          }
        })
        currentAddr += model.channelCount
      }

      // Reload fixtures
      await loadFixtures()
      setShowAddModal(false)
    } catch (err) {
      console.error('[PatchTab] Add error:', err)
      setError('Error adding fixtures')
    }
  }

  const handleSaveFixtureDefinition = async (definition: FixtureDefinition) => {
    try {
      console.log("🔌 Connecting to Matrix...", definition);
      
      // 1. LLAMADA AL BRIDGE (Esto es lo que faltaba)
      const result = await window.lux.fixtures.saveDefinition(definition);
      
      if (result.success) {
        console.log("✅ Fixture saved at:", result.path);
        
        // 2. IMPORTANTE: Recargar la librería para ver el nuevo archivo
        const scanResult = await window.lux.scanFixtures();
        if (scanResult?.fixtures) {
          const normalized = scanResult.fixtures.map((f: any) => ({
            ...f,
            modes: f.modes ?? [{ name: 'Standard', channels: f.channels ?? [] }]
          }))
          setLibrary(normalized)
        }
        
        setShowForgeModal(false); // Cerrar modal
      } else {
        console.error("❌ Failed to save");
        setError("Failed to save fixture");
      }
    } catch (error) {
      console.error("❌ IPC Error:", error);
      setError("Error saving fixture definition");
    }
  }

  /**
   * Handle zone change
   */
  const handleZoneChange = async (dmxAddress: number, newZone: FixtureZone) => {
    // TODO: Implement zone update IPC
    // For now, update local state
    setFixtures(prev => prev.map(f => 
      f.dmxAddress === dmxAddress ? { ...f, zone: newZone } : f
    ))
    console.log(`[PatchTab] Zone changed: DMX ${dmxAddress} -> ${newZone}`)
  }

  /**
   * Flash test fixture
   */
  const handleFlash = async (fixture: PatchedFixture) => {
    const api = getLuxApi()
    if (!api?.dmx?.highlightFixture) return

    setFlashingFixture(fixture.dmxAddress)
    
    const isMovingHead = fixture.type === 'moving_head' || fixture.type === 'wash'
    await api.dmx.highlightFixture(
      fixture.dmxAddress, 
      fixture.channelCount, 
      isMovingHead
    )

    // Clear flash indicator after 1s
    setTimeout(() => {
      setFlashingFixture(null)
    }, 1000)
  }

  /**
   * Delete fixture
   */
  const handleDelete = async (dmxAddress: number) => {
    const api = getLuxApi()
    if (!api) return

    try {
      const result = await api.unpatchFixture(dmxAddress)
      if (result?.success) {
        setFixtures(prev => prev.filter(f => f.dmxAddress !== dmxAddress))
      }
    } catch (err) {
      console.error('[PatchTab] Delete error:', err)
      setError('Error removing fixture')
    }
  }

  /**
   * WAVE 256: Start editing a fixture
   */
  const handleStartEdit = (fixture: PatchedFixture) => {
    setEditingFixture(fixture)
    setEditForm({ 
      dmxAddress: fixture.dmxAddress, 
      name: fixture.name 
    })
  }

  /**
   * WAVE 256: Save fixture edits
   */
  const handleSaveEdit = async () => {
    if (!editingFixture) return
    
    const api = getLuxApi()
    if (!api) return

    try {
      // Call the edit handler with original DMX address, new DMX address, and universe
      const result = await api.editFixture?.(
        editingFixture.dmxAddress,  // Original DMX address
        editForm.dmxAddress,         // New DMX address
        editingFixture.universe      // Universe (optional)
      )
      
      if (result?.success) {
        // Update local state
        setFixtures(prev => prev.map(f => 
          f.dmxAddress === editingFixture.dmxAddress 
            ? { ...f, dmxAddress: editForm.dmxAddress, name: editForm.name }
            : f
        ))
        setEditingFixture(null)
        console.log(`[PatchTab] Fixture edited: DMX ${editingFixture.dmxAddress} → ${editForm.dmxAddress}`)
      } else {
        setError(result?.error || 'Failed to edit fixture')
      }
    } catch (err) {
      console.error('[PatchTab] Edit error:', err)
      setError('Error editing fixture')
    }
  }

  /**
   * WAVE 256: Cancel editing
   */
  const handleCancelEdit = () => {
    setEditingFixture(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get live dot color - simplified version using DMX connected state
   * In the future, this could read actual DMX values from a fixture state cache
   */
  const getLiveDotColor = (_dmxAddress: number): string => {
    // If DMX is connected, show a dim indicator
    if (hardwareState?.dmx?.connected) {
      return 'var(--cyan-dim)'
    }
    return 'var(--text-dim)'
  }

  /**
   * Check if fixture is connected/live (DMX connected = all fixtures potentially live)
   */
  const isLive = (_dmxAddress: number): boolean => {
    return hardwareState?.dmx?.connected === true
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="patch-tab">
        <div className="patch-loading">
          <div className="loading-spinner" />
          <span>Scanning fixtures...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="patch-tab">
      {/* HEADER */}
      <div className="patch-header">
        <div className="patch-header-info">
          <span className="patch-count">{fixtures.length} fixtures</span>
          <span className="patch-library">{library.length} in library</span>
        </div>
        <div className="patch-header-actions">
          <button 
            className="patch-forge-btn"
            onClick={() => setShowForgeModal(true)}
            title="Create new fixture definition"
          >
            ⚡ CREATE FIXTURE
          </button>
          <button 
            className="patch-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            ➕ ADD PATCH
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="patch-error">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* TABLE */}
      <div className="patch-table-container">
        <table className="patch-table">
          <thead>
            <tr>
              <th className="col-status">STATUS</th>
              <th className="col-id">ID</th>
              <th className="col-address">ADDRESS</th>
              <th className="col-fixture">FIXTURE</th>
              <th className="col-channels">CH</th>
              <th className="col-zone">ZONE</th>
              <th className="col-actions">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {fixtures.length === 0 ? (
              <tr className="patch-empty-row">
                <td colSpan={7}>
                  <div className="patch-empty">
                    <span className="empty-icon">💡</span>
                    <span>No fixtures patched</span>
                    <button onClick={() => setShowAddModal(true)}>
                      Add your first fixture
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              fixtures.map((fixture, index) => (
                <tr 
                  key={fixture.dmxAddress}
                  className={flashingFixture === fixture.dmxAddress ? 'flashing' : ''}
                >
                  {/* STATUS - Live Dot con lógica de color explícita */}
                  <td className="col-status">
                    <div 
                      className={`live-dot ${isLive(fixture.dmxAddress) ? 'live' : ''} ${flashingFixture === fixture.dmxAddress ? 'flashing' : ''}`}
                      style={{ 
                        // Lógica de color inline:
                        // 1. Si está flasheando -> AMARILLO ORO
                        // 2. Si está Online -> CYAN NEÓN
                        // 3. Si está Offline -> GRIS OSCURO (pero visible)
                        backgroundColor: flashingFixture === fixture.dmxAddress 
                          ? '#ffd700' 
                          : (isLive(fixture.dmxAddress) ? '#00f3ff' : '#333'),
                        
                        // Brillo (Glow)
                        boxShadow: flashingFixture === fixture.dmxAddress
                          ? '0 0 15px #ffd700'
                          : (isLive(fixture.dmxAddress) ? '0 0 8px #00f3ff' : 'none'),
                          
                        // Borde sutil para que el estado "offline" no desaparezca
                        border: '1px solid #555'
                      }}
                    />
                  </td>

                  {/* ID */}
                  <td className="col-id">
                    <span className="fixture-id">{formatFixtureId(index)}</span>
                  </td>

                  {/* ADDRESS */}
                  <td className="col-address">
                    <span className="dmx-address">{formatAddress(fixture.dmxAddress)}</span>
                    <span className="address-range">
                      -{formatAddress(fixture.dmxAddress + fixture.channelCount - 1)}
                    </span>
                  </td>

                  {/* FIXTURE */}
                  <td className="col-fixture">
                    <span className="fixture-icon">{getTypeIcon(fixture.type)}</span>
                    <span className="fixture-name">{fixture.name}</span>
                  </td>

                  {/* CHANNELS */}
                  <td className="col-channels">
                    <span className="channel-count">{fixture.channelCount}ch</span>
                  </td>

                  {/* ZONE */}
                  <td className="col-zone">
                    <select
                      className="zone-select"
                      value={fixture.zone}
                      onChange={(e) => handleZoneChange(
                        fixture.dmxAddress, 
                        e.target.value as FixtureZone
                      )}
                    >
                      {Object.entries(ZONE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>

                  {/* ACTIONS */}
                  <td className="col-actions">
                    <button 
                      className="action-btn edit-btn"
                      onClick={() => handleStartEdit(fixture)}
                      title="Edit fixture"
                    >
                      ✏️
                    </button>
                    <button 
                      className="action-btn flash-btn"
                      onClick={() => handleFlash(fixture)}
                      title="Flash test"
                    >
                      ⚡
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => handleDelete(fixture.dmxAddress)}
                      title="Remove fixture"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ADD FIXTURE MODAL */}
      {showAddModal && (
        <AddFixtureModal
          library={library}
          nextAddress={getNextAddress()}
          onAdd={handleAddFixtures}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* FIXTURE FORGE MODAL */}
      <FixtureEditorModal
        isOpen={showForgeModal}
        onClose={() => setShowForgeModal(false)}
        onSave={handleSaveFixtureDefinition}
      />

      {/* WAVE 256: EDIT FIXTURE MODAL */}
      {editingFixture && (
        <div className="edit-modal-overlay" onClick={handleCancelEdit}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <h3>✏️ Edit Fixture</h3>
            <div className="edit-form">
              <label>
                <span>Name:</span>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Fixture name"
                />
              </label>
              <label>
                <span>DMX Address:</span>
                <input
                  type="number"
                  min={1}
                  max={512}
                  value={editForm.dmxAddress}
                  onChange={e => setEditForm(prev => ({ ...prev, dmxAddress: parseInt(e.target.value) || 1 }))}
                />
              </label>
              <div className="edit-info">
                <span>Type: {editingFixture.type}</span>
                <span>Channels: {editingFixture.channelCount}</span>
              </div>
            </div>
            <div className="edit-actions">
              <button className="cancel-btn" onClick={handleCancelEdit}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveEdit}>
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PatchTab
