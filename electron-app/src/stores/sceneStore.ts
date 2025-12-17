/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 SCENE STORE - WAVE 32: Scene Engine & Snapshots
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Gestiona escenas (snapshots del estado de fixtures):
 * - Guardar escenas con nombre, tags y metadata
 * - Cargar escenas inyectando valores en overrideStore
 * - Transiciones suaves entre escenas (fade)
 * - Persistencia en localStorage
 * 
 * @module stores/sceneStore
 * @version 32.0.0
 */

import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { useOverrideStore, Override, FixtureOverride, ChannelMask } from './overrideStore'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Metadata de una escena */
export interface SceneMetadata {
  /** Tiempo de transición al cargar la escena (ms) */
  fadeTime: number
  /** Tags para organización */
  tags: string[]
  /** Color preview (hex derivado de HSL) */
  previewColor: string
  /** Número de fixtures en la escena */
  fixtureCount: number
  /** Notas del usuario */
  notes: string
}

/** Snapshot serializable de un override */
export interface SerializedOverride {
  values: FixtureOverride
  mask: ChannelMask
}

/** Una escena guardada */
export interface Scene {
  /** ID único de la escena */
  id: string
  /** Nombre de la escena */
  name: string
  /** Timestamp de creación */
  createdAt: number
  /** Timestamp de última modificación */
  updatedAt: number
  /** Metadata */
  metadata: SceneMetadata
  /** Estado de fixtures (snapshot de overrideStore) */
  overrides: Record<string, SerializedOverride>
}

/** Estado de transición */
export interface TransitionState {
  isTransitioning: boolean
  targetSceneId: string | null
  progress: number
  startTime: number
  duration: number
}

/** Estado del Scene Store */
export interface SceneState {
  scenes: Scene[]
  activeSceneId: string | null
  transition: TransitionState
  defaultFadeTime: number
  
  // CRUD Actions
  saveScene: (name: string, options?: Partial<SceneMetadata>) => string
  loadScene: (sceneId: string, options?: { fadeTime?: number; merge?: boolean }) => void
  deleteScene: (sceneId: string) => void
  updateScene: (sceneId: string, updates: Partial<Pick<Scene, 'name' | 'metadata'>>) => void
  duplicateScene: (sceneId: string) => string | null
  
  // Transition Actions
  startTransition: (sceneId: string, fadeTime: number) => void
  cancelTransition: () => void
  
  // Utility
  clearActiveScene: () => void
  getScene: (sceneId: string) => Scene | undefined
  getScenesByTag: (tag: string) => Scene[]
  setDefaultFadeTime: (fadeTime: number) => void
  exportScenes: () => string
  importScenes: (json: string) => boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Generar ID único */
const generateId = (): string => {
  return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/** Convertir HSL a Hex para preview */
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Extraer color preview de los overrides (primer color válido) */
const extractPreviewColor = (overrides: Record<string, SerializedOverride>): string => {
  const values = Object.values(overrides)
  if (values.length === 0) return '#00ffff'
  
  for (const override of values) {
    const v = override.values
    if (v.h !== undefined && v.s !== undefined && v.l !== undefined) {
      return hslToHex(v.h, v.s, v.l)
    }
    if (v.r !== undefined && v.g !== undefined && v.b !== undefined) {
      return `#${v.r.toString(16).padStart(2, '0')}${v.g.toString(16).padStart(2, '0')}${v.b.toString(16).padStart(2, '0')}`
    }
  }
  return '#00ffff'
}

/** Interpolar entre dos valores numéricos */
const lerp = (a: number | undefined, b: number | undefined, t: number): number | undefined => {
  if (a === undefined && b === undefined) return undefined
  const aVal = a ?? 0
  const bVal = b ?? 0
  return aVal + (bVal - aVal) * t
}

/** Interpolar FixtureOverride completo */
const interpolateOverride = (
  current: FixtureOverride | undefined, 
  target: FixtureOverride, 
  t: number
): FixtureOverride => {
  const curr = current || {}
  return {
    h: lerp(curr.h, target.h, t),
    s: lerp(curr.s, target.s, t),
    l: lerp(curr.l, target.l, t),
    r: lerp(curr.r, target.r, t),
    g: lerp(curr.g, target.g, t),
    b: lerp(curr.b, target.b, t),
    w: lerp(curr.w, target.w, t),
    dimmer: lerp(curr.dimmer, target.dimmer, t),
    pan: lerp(curr.pan, target.pan, t),
    tilt: lerp(curr.tilt, target.tilt, t),
    focus: lerp(curr.focus, target.focus, t),
    zoom: lerp(curr.zoom, target.zoom, t),
    gobo: target.gobo,  // Gobo no se interpola, cambio instantáneo
    prism: target.prism,
    fadeTime: target.fadeTime
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useSceneStore = create<SceneState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // ═════════════════════════════════════════════════════════════════════
      // INITIAL STATE
      // ═════════════════════════════════════════════════════════════════════
      
      scenes: [],
      activeSceneId: null,
      transition: {
        isTransitioning: false,
        targetSceneId: null,
        progress: 0,
        startTime: 0,
        duration: 0
      },
      defaultFadeTime: 500,
      
      // ═════════════════════════════════════════════════════════════════════
      // CRUD ACTIONS
      // ═════════════════════════════════════════════════════════════════════
      
      saveScene: (name, options = {}) => {
        const overrideStore = useOverrideStore.getState()
        const currentOverrides = overrideStore.overrides
        
        // Convertir Map<string, Override> a Record<string, SerializedOverride>
        const overridesRecord: Record<string, SerializedOverride> = {}
        currentOverrides.forEach((override, key) => {
          overridesRecord[key] = {
            values: { ...override.values },
            mask: { ...override.mask }
          }
        })
        
        const id = generateId()
        const now = Date.now()
        
        const newScene: Scene = {
          id,
          name: name || `Scene ${get().scenes.length + 1}`,
          createdAt: now,
          updatedAt: now,
          metadata: {
            fadeTime: options.fadeTime ?? get().defaultFadeTime,
            tags: options.tags ?? [],
            previewColor: extractPreviewColor(overridesRecord),
            fixtureCount: Object.keys(overridesRecord).length,
            notes: options.notes ?? ''
          },
          overrides: overridesRecord
        }
        
        set(state => ({
          scenes: [...state.scenes, newScene],
          activeSceneId: id
        }))
        
        console.log(`[SceneStore] 📸 Scene saved: "${name}" (${Object.keys(overridesRecord).length} fixtures)`)
        
        return id
      },
      
      loadScene: (sceneId, options = {}) => {
        const scene = get().getScene(sceneId)
        if (!scene) {
          console.warn(`[SceneStore] Scene not found: ${sceneId}`)
          return
        }
        
        const fadeTime = options.fadeTime ?? scene.metadata.fadeTime
        
        if (fadeTime > 0) {
          // Transición suave
          get().startTransition(sceneId, fadeTime)
        } else {
          // Carga instantánea
          const overrideStore = useOverrideStore.getState()
          
          if (!options.merge) {
            // Limpiar overrides existentes primero
            overrideStore.clearAllOverrides()
          }
          
          // Inyectar todos los overrides de la escena
          Object.entries(scene.overrides).forEach(([fixtureId, serialized]) => {
            overrideStore.setOverride(fixtureId, serialized.values, serialized.mask)
          })
          
          set({ activeSceneId: sceneId })
          console.log(`[SceneStore] ▶️ Scene loaded: "${scene.name}"`)
        }
      },
      
      deleteScene: (sceneId) => {
        set(state => ({
          scenes: state.scenes.filter(s => s.id !== sceneId),
          activeSceneId: state.activeSceneId === sceneId ? null : state.activeSceneId
        }))
        console.log(`[SceneStore] 🗑️ Scene deleted: ${sceneId}`)
      },
      
      updateScene: (sceneId, updates) => {
        set(state => ({
          scenes: state.scenes.map(scene => {
            if (scene.id !== sceneId) return scene
            return {
              ...scene,
              ...updates,
              updatedAt: Date.now(),
              metadata: {
                ...scene.metadata,
                ...(updates.metadata || {})
              }
            }
          })
        }))
      },
      
      duplicateScene: (sceneId) => {
        const scene = get().getScene(sceneId)
        if (!scene) return null
        
        const id = generateId()
        const now = Date.now()
        
        const duplicate: Scene = {
          ...scene,
          id,
          name: `${scene.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
          overrides: JSON.parse(JSON.stringify(scene.overrides)) // Deep copy
        }
        
        set(state => ({
          scenes: [...state.scenes, duplicate]
        }))
        
        return id
      },
      
      // ═════════════════════════════════════════════════════════════════════
      // TRANSITION ACTIONS
      // ═════════════════════════════════════════════════════════════════════
      
      startTransition: (sceneId, fadeTime) => {
        const scene = get().getScene(sceneId)
        if (!scene) return
        
        set({
          transition: {
            isTransitioning: true,
            targetSceneId: sceneId,
            progress: 0,
            startTime: performance.now(),
            duration: fadeTime
          }
        })
        
        console.log(`[SceneStore] 🎬 Starting transition to "${scene.name}" (${fadeTime}ms)`)
        
        // Iniciar loop de animación
        const animate = () => {
          const state = get()
          if (!state.transition.isTransitioning) return
          
          const elapsed = performance.now() - state.transition.startTime
          const progress = Math.min(elapsed / fadeTime, 1)
          
          // Actualizar progreso
          set(s => ({
            transition: { ...s.transition, progress }
          }))
          
          // Interpolar valores
          const overrideStore = useOverrideStore.getState()
          const targetScene = get().getScene(sceneId)
          
          if (targetScene) {
            Object.entries(targetScene.overrides).forEach(([fixtureId, targetSerialized]) => {
              const currentOverride = overrideStore.getOverride(fixtureId)
              const currentValues = currentOverride?.values
              
              // Interpolar valores
              const interpolated = interpolateOverride(currentValues, targetSerialized.values, progress)
              
              overrideStore.setOverride(fixtureId, interpolated, targetSerialized.mask)
            })
          }
          
          if (progress < 1) {
            requestAnimationFrame(animate)
          } else {
            // Transición completa
            set({
              activeSceneId: sceneId,
              transition: {
                isTransitioning: false,
                targetSceneId: null,
                progress: 0,
                startTime: 0,
                duration: 0
              }
            })
            console.log(`[SceneStore] ✅ Transition complete: "${scene.name}"`)
          }
        }
        
        requestAnimationFrame(animate)
      },
      
      cancelTransition: () => {
        set({
          transition: {
            isTransitioning: false,
            targetSceneId: null,
            progress: 0,
            startTime: 0,
            duration: 0
          }
        })
        console.log('[SceneStore] ❌ Transition cancelled')
      },
      
      // ═════════════════════════════════════════════════════════════════════
      // UTILITY ACTIONS
      // ═════════════════════════════════════════════════════════════════════
      
      clearActiveScene: () => {
        set({ activeSceneId: null })
      },
      
      getScene: (sceneId) => {
        return get().scenes.find(s => s.id === sceneId)
      },
      
      getScenesByTag: (tag) => {
        return get().scenes.filter(s => s.metadata.tags.includes(tag))
      },
      
      setDefaultFadeTime: (fadeTime) => {
        set({ defaultFadeTime: fadeTime })
      },
      
      exportScenes: () => {
        const { scenes } = get()
        return JSON.stringify(scenes, null, 2)
      },
      
      importScenes: (json) => {
        try {
          const imported = JSON.parse(json) as Scene[]
          if (!Array.isArray(imported)) return false
          
          // Validar estructura básica
          const valid = imported.every(s => s.id && s.name && s.overrides)
          if (!valid) return false
          
          set(state => ({
            scenes: [...state.scenes, ...imported]
          }))
          
          console.log(`[SceneStore] 📥 Imported ${imported.length} scenes`)
          return true
        } catch (e) {
          console.error('[SceneStore] Import failed:', e)
          return false
        }
      }
    })),
    {
      name: 'luxsync-scenes',
      partialize: (state) => ({
        scenes: state.scenes,
        defaultFadeTime: state.defaultFadeTime
      })
    }
  )
)

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

export const selectScenes = (state: SceneState) => state.scenes
export const selectActiveSceneId = (state: SceneState) => state.activeSceneId
export const selectTransition = (state: SceneState) => state.transition
export const selectIsTransitioning = (state: SceneState) => state.transition.isTransitioning
export const selectSceneCount = (state: SceneState) => state.scenes.length

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/** Hook para obtener la escena activa */
export const useActiveScene = (): Scene | null => {
  const activeId = useSceneStore(selectActiveSceneId)
  const scenes = useSceneStore(selectScenes)
  return scenes.find(s => s.id === activeId) || null
}

/** Hook para verificar si una escena está activa */
export const useIsSceneActive = (sceneId: string): boolean => {
  const activeId = useSceneStore(selectActiveSceneId)
  return activeId === sceneId
}

export default useSceneStore
