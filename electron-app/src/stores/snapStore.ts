import { create } from 'zustand'

// ═══════════════════════════════════════════════════════════════════════════
// SnapStore — Configuración global de snap
// PROYECTO EREBUS — Snap Settings
//
// Controla el tamaño de la cuadrícula de voxel snap y si está activo.
// Usado por DragDropController2D, DragDropController3D, y RigSystem.
// ═══════════════════════════════════════════════════════════════════════════

export type SnapSize = 0.1 | 0.25 | 0.5 | 1.0

interface SnapStoreState {
  /** Whether snapping is enabled */
  snapEnabled: boolean
  /** Voxel grid size in meters */
  snapSize: SnapSize
  /** Toggle snap on/off */
  toggleSnap: () => void
  /** Set snap size */
  setSnapSize: (size: SnapSize) => void
  /** Snap a value to the current grid (returns value unchanged if disabled) */
  snap: (value: number) => number
}

export const useSnapStore = create<SnapStoreState>((set, get) => ({
  snapEnabled: true,
  snapSize: 0.25,

  toggleSnap: () => set(s => ({ snapEnabled: !s.snapEnabled })),

  setSnapSize: (size) => set({ snapSize: size }),

  snap: (value: number) => {
    const { snapEnabled, snapSize } = get()
    if (!snapEnabled) return value
    return Math.round(value / snapSize) * snapSize
  },
}))

export default useSnapStore
