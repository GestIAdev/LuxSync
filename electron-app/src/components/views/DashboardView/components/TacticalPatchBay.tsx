/**
 * 🔌 TACTICAL PATCH BAY - WAVE 1201: STANDALONE COMPONENT
 * 
 * Lives in right column with VERTICAL FREEDOM
 * Features:
 * - DMX address editing with collision detection
 * - SAVE PATCH button (dirty state = yellow border)
 * - Infinite scroll for any number of fixtures
 * - Dark background for visual separation
 */

import React, { useState, useMemo, useCallback } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { MovingHeadIcon } from '../../../icons/LuxIcons'
import './TacticalPatchBay.css'

export const TacticalPatchBay: React.FC = () => {
  const fixtures = useStageStore(state => state.fixtures)
  const updateFixture = useStageStore(state => state.updateFixture)
  const showFile = useStageStore(state => state.showFile)
  
  // Track dirty state (unsaved changes)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Detect DMX collisions — O(n²) but n is always small for fixtures
  const collisions = useMemo(() => {
    const collisionSet = new Set<string>()
    
    for (let i = 0; i < fixtures.length; i++) {
      const a = fixtures[i]
      const aEnd = a.address + a.channelCount - 1
      
      for (let j = i + 1; j < fixtures.length; j++) {
        const b = fixtures[j]
        if (a.universe !== b.universe) continue
        
        const bEnd = b.address + b.channelCount - 1
        
        // Check overlap: A starts before B ends AND A ends after B starts
        if (a.address <= bEnd && aEnd >= b.address) {
          collisionSet.add(a.id)
          collisionSet.add(b.id)
        }
      }
    }
    
    return collisionSet
  }, [fixtures])
  
  const handleAddressChange = useCallback((fixtureId: string, newAddress: number) => {
    // Clamp to valid DMX range
    const clamped = Math.max(1, Math.min(512, newAddress))
    updateFixture(fixtureId, { address: clamped })
    setIsDirty(true)
  }, [updateFixture])
  
  const handleUniverseChange = useCallback((fixtureId: string, newUniverse: number) => {
    const clamped = Math.max(0, Math.min(15, newUniverse))
    updateFixture(fixtureId, { universe: clamped })
    setIsDirty(true)
  }, [updateFixture])
  
  const handleSavePatch = useCallback(async () => {
    if (!showFile) return
    
    setIsSaving(true)
    try {
      const luxApi = (window as any).lux
      if (luxApi?.stage?.save) {
        await luxApi.stage.save()
        setIsDirty(false)
        console.log('[TacticalPatchBay] 💾 Patch saved!')
      }
    } catch (err) {
      console.error('[TacticalPatchBay] Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [showFile])
  
  const hasCollisions = collisions.size > 0
  
  return (
    <div className="patch-bay-standalone">
      {/* Header with Save Button */}
      <div className="patch-bay-header">
        <div className="patch-bay-title">
          <span className="patch-icon">
            <MovingHeadIcon size={16} color="#22d3ee" />
          </span>
          <span className="patch-bay-label">PATCH BAY</span>
          <span className="patch-bay-count">{fixtures.length}</span>
        </div>
        
        <button
          className={`patch-save-btn ${isDirty ? 'dirty' : ''}`}
          onClick={handleSavePatch}
          disabled={!isDirty || isSaving || !showFile}
          title={!showFile ? 'No show loaded' : isDirty ? 'Save pending changes' : 'No changes'}
        >
          <span className="save-icon">💾</span>
          <span className="save-text">{isDirty ? 'SAVE *' : 'SAVE'}</span>
        </button>
      </div>
      
      {hasCollisions && (
        <div className="patch-collision-warning">
          ⚠️ DMX channel collision detected
        </div>
      )}
      
      {fixtures.length > 0 ? (
        <>
          {/* Table Header */}
          <div className="patch-table-header">
            <span className="col-fixture">FIXTURE</span>
            <span className="col-addr">ADDR</span>
            <span className="col-ch">CH</span>
            <span className="col-uni">UNI</span>
          </div>
          
          {/* Fixture List - Scrollable */}
          <div className="patch-list">
            {fixtures.map(fixture => (
              <div 
                key={fixture.id}
                className={`patch-row ${collisions.has(fixture.id) ? 'collision' : ''}`}
              >
                <div className="col-fixture">
                  <div className="patch-fixture-name">{fixture.name}</div>
                  <div className="patch-fixture-model">{fixture.model}</div>
                </div>
                
                <input
                  type="number"
                  className="patch-address-input"
                  value={fixture.address}
                  onChange={(e) => handleAddressChange(fixture.id, parseInt(e.target.value) || 1)}
                  min={1}
                  max={512}
                />
                
                <span className="patch-channels">{fixture.channelCount}</span>
                
                <input
                  type="number"
                  className="patch-universe-input"
                  value={fixture.universe + 1}
                  onChange={(e) => handleUniverseChange(fixture.id, (parseInt(e.target.value) || 1) - 1)}
                  min={1}
                  max={16}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="patch-empty">
          <span className="patch-empty-icon">
            <MovingHeadIcon size={40} color="rgba(255,255,255,0.15)" />
          </span>
          <span className="patch-empty-text">No fixtures loaded</span>
          <span className="patch-empty-hint">Load a show or add fixtures in Constructor</span>
        </div>
      )}
    </div>
  )
}

export default TacticalPatchBay
