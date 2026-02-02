/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔨 FORGE VIEW - WAVE 1110: THE GREAT UNBUNDLING
 * "The Blacksmith's Workshop" - Full-screen Fixture Editor
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Forge is now a first-class citizen in the navigation, no longer a modal.
 * This view wraps FixtureForge in embedded mode (no overlay).
 * 
 * Tabs:
 *   - GENERAL: Basic fixture info (name, type, manufacturer)
 *   - CHANNEL RACK: DMX channel mapping (drag & drop)
 *   - PHYSICS ENGINE: Motor physics tuning
 *   - WHEELSMITH: Color wheel editor (NEW - embedded)
 *   - EXPORT: JSON generation
 * 
 * @module components/views/ForgeView
 * @version 1110.0.0
 */

import React, { useState, useCallback, Suspense, lazy } from 'react'
import { useStageStore } from '../../../stores/stageStore'
import type { FixtureDefinition } from '../../../types/FixtureDefinition'
import type { PhysicsProfile, FixtureV2 } from '../../../core/stage/ShowFileV2'
import './ForgeView.css'

// Lazy load the heavy Forge component
const FixtureForgeEmbedded = lazy(() => import('./FixtureForgeEmbedded'))

// Loading fallback
const ForgeFallback: React.FC = () => (
  <div className="forge-loading">
    <div className="forge-loading-icon">🔨</div>
    <span className="forge-loading-text">Heating up the Forge...</span>
    <span className="forge-loading-hint">Preparing channel editors</span>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// FORGE VIEW - Full Screen Wrapper
// ═══════════════════════════════════════════════════════════════════════════

const ForgeView: React.FC = () => {
  const { addFixture, fixtures } = useStageStore()
  
  // State for editing existing fixture
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null)
  const [existingDefinition, setExistingDefinition] = useState<FixtureDefinition | null>(null)
  
  // Find existing fixture if editing
  const editingFixture = editingFixtureId 
    ? fixtures.find(f => f.id === editingFixtureId) || null
    : null

  // Handle save from Forge
  const handleSave = useCallback((
    fixture: FixtureDefinition,
    physics: PhysicsProfile,
    patchData?: { dmxAddress?: number; universe?: number }
  ) => {
    console.log('[ForgeView] 🔨 Fixture forged:', fixture.name)
    console.log('[ForgeView] 📦 Physics profile:', physics.motorType, 'maxVel:', physics.maxVelocity)
    
    // If editing, update the existing fixture
    // If new, add to stage (optional, user might just want to export)
    if (editingFixtureId) {
      // TODO: Update existing fixture
      console.log('[ForgeView] ✏️ Updating fixture:', editingFixtureId)
    } else {
      // New fixture - just log for now, user can add from BUILD view
      console.log('[ForgeView] ✅ Fixture ready for export or adding to stage')
    }
    
    // Reset editing state
    setEditingFixtureId(null)
    setExistingDefinition(null)
  }, [editingFixtureId])

  // Open fixture for editing (called from library browser)
  const openForEdit = useCallback((fixtureId: string, definition: FixtureDefinition) => {
    setEditingFixtureId(fixtureId)
    setExistingDefinition(definition)
  }, [])

  return (
    <div className="forge-view">
      <Suspense fallback={<ForgeFallback />}>
        <FixtureForgeEmbedded
          onSave={handleSave}
          editingFixture={editingFixture}
          existingDefinition={existingDefinition}
        />
      </Suspense>
    </div>
  )
}

export default ForgeView
