import React, { createContext, useContext } from 'react'
import type { FixtureDefinition } from '../../../types/FixtureDefinition'

export interface ConstructorContextType {
  // Snap settings
  snapEnabled: boolean
  setSnapEnabled: (enabled: boolean) => void
  snapDistance: number
  snapRotation: number

  // Drag state
  draggedFixtureType: string | null
  setDraggedFixtureType: (type: string | null) => void

  // Tool mode
  toolMode: 'select' | 'boxSelect'
  setToolMode: (mode: 'select' | 'boxSelect') => void

  // Zone visibility
  showZones: boolean
  setShowZones: (show: boolean) => void

  // Voxel view toggles
  showCrystalBox: boolean
  setShowCrystalBox: (v: boolean) => void
  showFloorGrid: boolean
  setShowFloorGrid: (v: boolean) => void
  showDropLines: boolean
  setShowDropLines: (v: boolean) => void
  ghostCursorEnabled: boolean
  setGhostCursorEnabled: (v: boolean) => void

  // Fixture Forge
  openFixtureForge: (fixtureId?: string, existingDefinition?: FixtureDefinition) => void

  // 3D / 2D view mode
  viewMode: '3d' | '2d'
  setViewMode: (mode: '3d' | '2d') => void
}

export const ConstructorContext = createContext<ConstructorContextType | null>(null)

export const useConstructorContext = () => {
  const ctx = useContext(ConstructorContext)
  if (!ctx) throw new Error('useConstructorContext must be used within StageConstructorView')
  return ctx
}
