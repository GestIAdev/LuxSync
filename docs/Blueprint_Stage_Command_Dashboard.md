# 🌙 WAVE 30: STAGE COMMAND & DASHBOARD
## Blueprint Técnico - Selene LuxSync

**Fecha:** Diciembre 16, 2025  
**Versión:** 1.0  
**Autor:** Arquitectura de Software Senior  
**Proyecto:** Selene LuxSync - Control DMX Inteligente

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura de Alto Nivel](#2-arquitectura-de-alto-nivel)
3. [Estructura de Componentes](#3-estructura-de-componentes)
4. [Stores de Zustand](#4-stores-de-zustand)
5. [Motor de Prioridades (DMX Merging)](#5-motor-de-prioridades-dmx-merging)
6. [Interfaces TypeScript](#6-interfaces-typescript)
7. [Flujo de Datos](#7-flujo-de-datos)
8. [Roadmap de Implementación](#8-roadmap-de-implementación)
9. [Consideraciones de Performance](#9-consideraciones-de-performance)

---

## 1. RESUMEN EJECUTIVO

### Objetivo
Reestructurar la UI principal de Selene LuxSync en dos vistas diferenciadas:
- **Dashboard**: Vista de monitoreo y estado general
- **Stage**: Vista de control unificado con visor 3D y controles contextuales

### Problema a Resolver
Crear un sistema de control manual que coexista con la IA de Selene, permitiendo:
- Override manual de fixtures específicos
- Mezcla inteligente de valores AI + Flow + Manual
- Selección múltiple en visor 3D con controles contextuales

---

## 2. ARQUITECTURA DE ALTO NIVEL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SELENE LUXSYNC - WAVE 30                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐              ┌─────────────────────────────────┐  │
│  │     DASHBOARD       │              │           STAGE                 │  │
│  │   (Overview Mode)   │              │    (Unified Command Mode)       │  │
│  ├─────────────────────┤              ├─────────────────────────────────┤  │
│  │ • Metrics Panel     │              │ ┌─────────────┬───────────────┐ │  │
│  │ • Hardware Status   │              │ │             │  Contextual   │ │  │
│  │ • Recent Logs       │              │ │   3D Stage  │   Sidebar     │ │  │
│  │ • Mode Selector     │              │ │   Viewer    │               │ │  │
│  │   (Manual/Flow/AI)  │              │ │   (80%)     │   (20%)       │ │  │
│  └─────────────────────┘              │ │             │               │ │  │
│                                       │ └─────────────┴───────────────┘ │  │
│                                       └─────────────────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              ZUSTAND STORES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐│
│  │ selectionStore│  │ overrideStore│  │ controlStore │  │ dmxOutputStore   ││
│  │              │  │              │  │              │  │                  ││
│  │ • selected[] │  │ • overrides  │  │ • globalMode │  │ • finalValues[]  ││
│  │ • hovered    │  │ • masks      │  │ • flowParams │  │ • mergedOutput   ││
│  │ • lastAction │  │ • fadeTime   │  │ • aiEnabled  │  │ • debugInfo      ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘│
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         DMX MERGING ENGINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Priority Stack (High → Low):                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  1. MANUAL OVERRIDE  │  Valores forzados por usuario (Inspector)   │  │
│   ├──────────────────────┼──────────────────────────────────────────────┤  │
│   │  2. FLOW ENGINE      │  Patrones reactivos (chase, wave, etc.)     │  │
│   ├──────────────────────┼──────────────────────────────────────────────┤  │
│   │  3. SELENE AI        │  Decisiones automáticas basadas en audio    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   Formula: finalValue = override ?? (flow * mask) ?? aiValue                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ESTRUCTURA DE COMPONENTES

### Árbol de Carpetas Propuesto

```
src/
├── components/
│   ├── views/
│   │   ├── DashboardView/                    # Vista Dashboard (Overview)
│   │   │   ├── DashboardView.tsx             # Layout principal
│   │   │   ├── DashboardView.css
│   │   │   ├── panels/
│   │   │   │   ├── MetricsPanel.tsx          # Métricas de Selene
│   │   │   │   ├── HardwareStatusPanel.tsx   # Estado DMX, fixtures
│   │   │   │   ├── RecentLogsPanel.tsx       # Últimos logs
│   │   │   │   └── ModeSelector.tsx          # Manual/Flow/AI
│   │   │   └── index.ts
│   │   │
│   │   ├── StageView/                        # Vista Stage (Command)
│   │   │   ├── StageView.tsx                 # Layout principal
│   │   │   ├── StageView.css
│   │   │   ├── viewport/                     # Contenedor 3D
│   │   │   │   ├── StageViewport.tsx         # Wrapper del canvas 3D
│   │   │   │   ├── StageViewport.css
│   │   │   │   └── index.ts
│   │   │   ├── sidebar/                      # Sidebar contextual
│   │   │   │   ├── ContextualSidebar.tsx     # Router de contexto
│   │   │   │   ├── ContextualSidebar.css
│   │   │   │   ├── GlobalControls.tsx        # Sin selección
│   │   │   │   ├── InspectorControls.tsx     # Con selección
│   │   │   │   └── index.ts
│   │   │   ├── toolbar/                      # Barra de herramientas
│   │   │   │   ├── StageToolbar.tsx
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts
│   │
│   ├── stage3d/                              # Componentes Three.js
│   │   ├── Stage3DCanvas.tsx                 # Canvas principal (R3F)
│   │   ├── Stage3DCanvas.css
│   │   ├── fixtures/
│   │   │   ├── Fixture3D.tsx                 # Modelo genérico de fixture
│   │   │   ├── MovingHead3D.tsx              # Cabeza móvil
│   │   │   ├── ParCan3D.tsx                  # Par tradicional
│   │   │   └── index.ts
│   │   ├── environment/
│   │   │   ├── StageFloor.tsx
│   │   │   ├── StageLighting.tsx
│   │   │   └── index.ts
│   │   ├── controls/
│   │   │   ├── SelectionBox.tsx              # Selección rectangular
│   │   │   ├── TransformGizmo.tsx            # Mover fixtures
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── controls/                             # Controles UI reutilizables
│   │   ├── ColorWheel.tsx                    # Selector de color
│   │   ├── DimmerSlider.tsx                  # Slider de intensidad
│   │   ├── PanTiltJoystick.tsx               # Control de movimiento
│   │   ├── ChannelFader.tsx                  # Fader DMX individual
│   │   └── index.ts
│   │
│   └── shared/                               # Componentes compartidos
│       ├── ViewSwitcher.tsx                  # Switch Dashboard/Stage
│       └── index.ts
│
├── stores/
│   ├── selectionStore.ts                     # Estado de selección
│   ├── overrideStore.ts                      # Overrides manuales
│   ├── controlStore.ts                       # Modo global y parámetros
│   ├── dmxOutputStore.ts                     # Salida DMX final
│   └── index.ts
│
├── engines/
│   ├── dmx/
│   │   ├── DMXMerger.ts                      # Lógica de fusión
│   │   ├── PriorityStack.ts                  # Stack de prioridades
│   │   └── index.ts
│   └── index.ts
│
└── types/
    ├── stage.types.ts                        # Tipos de Stage/Dashboard
    ├── selection.types.ts                    # Tipos de selección
    ├── override.types.ts                     # Tipos de override
    └── index.ts
```

---

## 4. STORES DE ZUSTAND

### 4.1 SelectionStore

Gestiona la selección de fixtures en el visor 3D.

```typescript
// src/stores/selectionStore.ts

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ============================================================================
// TYPES
// ============================================================================

export interface SelectionState {
  // Estado principal
  selectedIds: Set<string>           // IDs de fixtures seleccionados
  hoveredId: string | null           // Fixture bajo el cursor
  lastSelectedId: string | null      // Último fixture seleccionado (para Shift+Click)
  
  // Metadatos de selección
  selectionMode: 'single' | 'multi' | 'additive'
  selectionSource: 'click' | 'box' | 'keyboard' | 'api'
  
  // Actions
  select: (id: string, mode?: SelectionMode) => void
  selectMultiple: (ids: string[], mode?: SelectionMode) => void
  deselect: (id: string) => void
  deselectAll: () => void
  toggleSelection: (id: string) => void
  setHovered: (id: string | null) => void
  selectRange: (fromId: string, toId: string, allIds: string[]) => void
  invertSelection: (allIds: string[]) => void
  
  // Computed helpers
  isSelected: (id: string) => boolean
  hasSelection: () => boolean
  getSelectedCount: () => number
  getSelectedArray: () => string[]
}

type SelectionMode = 'replace' | 'add' | 'remove' | 'toggle'

// ============================================================================
// STORE
// ============================================================================

export const useSelectionStore = create<SelectionState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    selectedIds: new Set<string>(),
    hoveredId: null,
    lastSelectedId: null,
    selectionMode: 'single',
    selectionSource: 'click',
    
    // ========================================================================
    // ACTIONS
    // ========================================================================
    
    /**
     * Seleccionar un fixture
     * @param id - ID del fixture
     * @param mode - Modo de selección (replace por defecto)
     */
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
          selectionSource: 'click'
        }
      })
    },
    
    /**
     * Seleccionar múltiples fixtures (ej: selección rectangular)
     */
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
          selectionSource: 'box'
        }
      })
    },
    
    /**
     * Deseleccionar un fixture específico
     */
    deselect: (id) => {
      set((state) => {
        const newSet = new Set(state.selectedIds)
        newSet.delete(id)
        return { selectedIds: newSet }
      })
    },
    
    /**
     * Limpiar toda la selección
     */
    deselectAll: () => {
      set({
        selectedIds: new Set(),
        lastSelectedId: null
      })
    },
    
    /**
     * Toggle de selección
     */
    toggleSelection: (id) => {
      get().select(id, 'toggle')
    },
    
    /**
     * Establecer fixture hover
     */
    setHovered: (id) => {
      set({ hoveredId: id })
    },
    
    /**
     * Selección de rango (Shift+Click)
     * @param fromId - Desde fixture
     * @param toId - Hasta fixture
     * @param allIds - Lista ordenada de todos los IDs
     */
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
        selectionSource: 'keyboard'
      }))
    },
    
    /**
     * Invertir selección
     */
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
    
    // ========================================================================
    // COMPUTED HELPERS
    // ========================================================================
    
    isSelected: (id) => get().selectedIds.has(id),
    hasSelection: () => get().selectedIds.size > 0,
    getSelectedCount: () => get().selectedIds.size,
    getSelectedArray: () => [...get().selectedIds],
  }))
)

// ============================================================================
// SELECTORS (Optimized)
// ============================================================================

export const selectSelectedIds = (state: SelectionState) => state.selectedIds
export const selectHoveredId = (state: SelectionState) => state.hoveredId
export const selectHasSelection = (state: SelectionState) => state.selectedIds.size > 0
export const selectSelectionCount = (state: SelectionState) => state.selectedIds.size
```

---

### 4.2 OverrideStore

Almacena los valores manuales forzados por el usuario.

```typescript
// src/stores/overrideStore.ts

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Valores que se pueden overridear por fixture
 */
export interface FixtureOverride {
  // Color (HSL for smooth transitions)
  h?: number           // 0-360
  s?: number           // 0-100
  l?: number           // 0-100
  
  // RGB directo (opcional, calculado desde HSL)
  r?: number           // 0-255
  g?: number           // 0-255
  b?: number           // 0-255
  w?: number           // 0-255 (white)
  
  // Intensidad
  dimmer?: number      // 0-255
  
  // Movimiento (cabezas móviles)
  pan?: number         // 0-540 (degrees)
  tilt?: number        // 0-270 (degrees)
  
  // Ópticos
  gobo?: number        // Índice de gobo
  prism?: boolean      // Prisma activo
  focus?: number       // 0-255
  zoom?: number        // 0-255
  
  // Timing
  fadeTime?: number    // ms para transición
}

/**
 * Máscara de canales - define qué canales están "bloqueados" por override
 */
export interface ChannelMask {
  color: boolean
  dimmer: boolean
  position: boolean
  optics: boolean
}

/**
 * Override completo con metadata
 */
export interface Override {
  values: FixtureOverride
  mask: ChannelMask
  timestamp: number
  source: 'inspector' | 'fader' | 'programmer' | 'cue'
  priority: number     // Para futuras cues
}

export interface OverrideState {
  // Map de overrides por fixture ID
  overrides: Map<string, Override>
  
  // Override global (aplica a todos)
  globalOverride: Partial<FixtureOverride> | null
  
  // Configuración
  defaultFadeTime: number
  
  // Actions
  setOverride: (fixtureId: string, values: Partial<FixtureOverride>, mask?: Partial<ChannelMask>) => void
  setMultipleOverrides: (fixtureIds: string[], values: Partial<FixtureOverride>, mask?: Partial<ChannelMask>) => void
  clearOverride: (fixtureId: string, channels?: (keyof ChannelMask)[]) => void
  clearAllOverrides: () => void
  setGlobalOverride: (values: Partial<FixtureOverride> | null) => void
  
  // Queries
  getOverride: (fixtureId: string) => Override | undefined
  hasOverride: (fixtureId: string) => boolean
  getEffectiveValue: (fixtureId: string, channel: keyof FixtureOverride) => number | undefined
  getMask: (fixtureId: string) => ChannelMask
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_MASK: ChannelMask = {
  color: false,
  dimmer: false,
  position: false,
  optics: false
}

// ============================================================================
// STORE
// ============================================================================

export const useOverrideStore = create<OverrideState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    overrides: new Map(),
    globalOverride: null,
    defaultFadeTime: 200, // ms
    
    // ========================================================================
    // ACTIONS
    // ========================================================================
    
    /**
     * Establecer override para un fixture
     */
    setOverride: (fixtureId, values, mask) => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        const existing = newOverrides.get(fixtureId)
        
        // Inferir máscara desde valores si no se proporciona
        const inferredMask: ChannelMask = {
          color: mask?.color ?? (values.h !== undefined || values.s !== undefined || values.l !== undefined || values.r !== undefined || values.g !== undefined || values.b !== undefined),
          dimmer: mask?.dimmer ?? (values.dimmer !== undefined),
          position: mask?.position ?? (values.pan !== undefined || values.tilt !== undefined),
          optics: mask?.optics ?? (values.gobo !== undefined || values.prism !== undefined || values.focus !== undefined || values.zoom !== undefined)
        }
        
        const newOverride: Override = {
          values: {
            ...existing?.values,
            ...values
          },
          mask: {
            ...DEFAULT_MASK,
            ...existing?.mask,
            ...inferredMask
          },
          timestamp: Date.now(),
          source: 'inspector',
          priority: 100
        }
        
        newOverrides.set(fixtureId, newOverride)
        
        return { overrides: newOverrides }
      })
    },
    
    /**
     * Establecer override para múltiples fixtures (selección)
     */
    setMultipleOverrides: (fixtureIds, values, mask) => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        const timestamp = Date.now()
        
        fixtureIds.forEach(id => {
          const existing = newOverrides.get(id)
          
          const inferredMask: ChannelMask = {
            color: mask?.color ?? (values.h !== undefined || values.s !== undefined || values.l !== undefined),
            dimmer: mask?.dimmer ?? (values.dimmer !== undefined),
            position: mask?.position ?? (values.pan !== undefined || values.tilt !== undefined),
            optics: mask?.optics ?? (values.gobo !== undefined || values.prism !== undefined)
          }
          
          newOverrides.set(id, {
            values: { ...existing?.values, ...values },
            mask: { ...DEFAULT_MASK, ...existing?.mask, ...inferredMask },
            timestamp,
            source: 'inspector',
            priority: 100
          })
        })
        
        return { overrides: newOverrides }
      })
    },
    
    /**
     * Limpiar override de un fixture
     * @param channels - Canales específicos a limpiar (todos si no se especifica)
     */
    clearOverride: (fixtureId, channels) => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        
        if (!channels) {
          // Limpiar todo
          newOverrides.delete(fixtureId)
        } else {
          // Limpiar canales específicos
          const existing = newOverrides.get(fixtureId)
          if (existing) {
            const newMask = { ...existing.mask }
            channels.forEach(ch => {
              newMask[ch] = false
            })
            
            // Si no quedan canales activos, eliminar el override
            if (!Object.values(newMask).some(v => v)) {
              newOverrides.delete(fixtureId)
            } else {
              newOverrides.set(fixtureId, {
                ...existing,
                mask: newMask
              })
            }
          }
        }
        
        return { overrides: newOverrides }
      })
    },
    
    /**
     * Limpiar todos los overrides
     */
    clearAllOverrides: () => {
      set({
        overrides: new Map(),
        globalOverride: null
      })
    },
    
    /**
     * Establecer override global
     */
    setGlobalOverride: (values) => {
      set({ globalOverride: values })
    },
    
    // ========================================================================
    // QUERIES
    // ========================================================================
    
    getOverride: (fixtureId) => get().overrides.get(fixtureId),
    
    hasOverride: (fixtureId) => get().overrides.has(fixtureId),
    
    getEffectiveValue: (fixtureId, channel) => {
      const override = get().overrides.get(fixtureId)
      return override?.values[channel] as number | undefined
    },
    
    getMask: (fixtureId) => {
      const override = get().overrides.get(fixtureId)
      return override?.mask ?? DEFAULT_MASK
    }
  }))
)

// ============================================================================
// SELECTORS
// ============================================================================

export const selectOverrides = (state: OverrideState) => state.overrides
export const selectGlobalOverride = (state: OverrideState) => state.globalOverride
```

---

### 4.3 ControlStore

Gestiona el modo global y parámetros de control.

```typescript
// src/stores/controlStore.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================================
// TYPES
// ============================================================================

export type GlobalMode = 'manual' | 'flow' | 'selene'

export interface FlowParams {
  pattern: 'static' | 'chase' | 'wave' | 'rainbow' | 'strobe'
  speed: number          // 0-100
  intensity: number      // 0-100
  direction: 'forward' | 'backward' | 'bounce' | 'random'
  spread: number         // 0-100 (para wave)
}

export interface ControlState {
  // Modo global
  globalMode: GlobalMode
  previousMode: GlobalMode | null
  
  // Flow Engine params
  flowParams: FlowParams
  flowEnabled: boolean
  
  // AI params
  aiEnabled: boolean
  aiReactivity: number   // 0-100 (qué tan agresivamente responde al audio)
  aiSmoothing: number    // 0-100 (suavizado de transiciones)
  
  // Blackout master
  blackout: boolean
  
  // Actions
  setGlobalMode: (mode: GlobalMode) => void
  toggleBlackout: () => void
  setFlowParams: (params: Partial<FlowParams>) => void
  setAIParams: (reactivity?: number, smoothing?: number) => void
  enableFlow: (enabled: boolean) => void
  enableAI: (enabled: boolean) => void
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_FLOW_PARAMS: FlowParams = {
  pattern: 'static',
  speed: 50,
  intensity: 100,
  direction: 'forward',
  spread: 50
}

// ============================================================================
// STORE
// ============================================================================

export const useControlStore = create<ControlState>()(
  persist(
    (set, get) => ({
      // Initial State
      globalMode: 'selene',
      previousMode: null,
      flowParams: DEFAULT_FLOW_PARAMS,
      flowEnabled: false,
      aiEnabled: true,
      aiReactivity: 70,
      aiSmoothing: 50,
      blackout: false,
      
      // ======================================================================
      // ACTIONS
      // ======================================================================
      
      setGlobalMode: (mode) => {
        set((state) => ({
          globalMode: mode,
          previousMode: state.globalMode,
          // Auto-enable/disable engines based on mode
          flowEnabled: mode === 'flow',
          aiEnabled: mode === 'selene'
        }))
      },
      
      toggleBlackout: () => {
        set((state) => ({ blackout: !state.blackout }))
      },
      
      setFlowParams: (params) => {
        set((state) => ({
          flowParams: { ...state.flowParams, ...params }
        }))
      },
      
      setAIParams: (reactivity, smoothing) => {
        set((state) => ({
          aiReactivity: reactivity ?? state.aiReactivity,
          aiSmoothing: smoothing ?? state.aiSmoothing
        }))
      },
      
      enableFlow: (enabled) => set({ flowEnabled: enabled }),
      enableAI: (enabled) => set({ aiEnabled: enabled })
    }),
    {
      name: 'lux-control-store',
      partialize: (state) => ({
        globalMode: state.globalMode,
        flowParams: state.flowParams,
        aiReactivity: state.aiReactivity,
        aiSmoothing: state.aiSmoothing
      })
    }
  )
)
```

---

## 5. MOTOR DE PRIORIDADES (DMX MERGING)

### 5.1 Concepto

El DMX Merger combina valores de múltiples fuentes respetando una jerarquía de prioridades:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DMX MERGING PIPELINE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Inputs:                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   SELENE AI  │  │  FLOW ENGINE │  │   OVERRIDE   │              │
│  │  (Base Layer)│  │ (Mid Layer)  │  │ (Top Layer)  │              │
│  │              │  │              │  │              │              │
│  │  Values from │  │  Pattern-    │  │  Manual user │              │
│  │  audio/music │  │  generated   │  │  adjustments │              │
│  │  analysis    │  │  values      │  │              │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         ▼                 ▼                 ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      MERGER LOGIC                           │   │
│  │                                                             │   │
│  │  for each fixture:                                          │   │
│  │    for each channel:                                        │   │
│  │      if (override.mask[channel]):                           │   │
│  │        output = override.value                              │   │
│  │      else if (flowEnabled && flow.hasValue):                │   │
│  │        output = lerp(aiValue, flowValue, flowIntensity)     │   │
│  │      else:                                                  │   │
│  │        output = aiValue                                     │   │
│  │                                                             │   │
│  │      output = clamp(output, 0, 255)                         │   │
│  │      if (blackout): output = 0                              │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│                    ┌──────────────────┐                            │
│                    │   FINAL OUTPUT   │                            │
│                    │   (512 channels) │                            │
│                    └──────────────────┘                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Implementación del Merger

```typescript
// src/engines/dmx/DMXMerger.ts

import { FixtureOverride, ChannelMask, Override } from '../../stores/overrideStore'
import { FlowParams } from '../../stores/controlStore'

// ============================================================================
// TYPES
// ============================================================================

export interface MergeInput {
  fixtureId: string
  
  // Valores de cada capa
  aiValues: FixtureChannelValues
  flowValues: FixtureChannelValues | null
  override: Override | null
  
  // Estado global
  flowEnabled: boolean
  flowIntensity: number // 0-1
  blackout: boolean
}

export interface FixtureChannelValues {
  r: number
  g: number
  b: number
  w: number
  dimmer: number
  pan: number
  tilt: number
  gobo: number
  prism: number
  focus: number
  zoom: number
}

export interface MergeOutput {
  fixtureId: string
  channels: FixtureChannelValues
  sources: {
    [K in keyof FixtureChannelValues]?: 'ai' | 'flow' | 'override'
  }
}

// ============================================================================
// MERGER CLASS
// ============================================================================

export class DMXMerger {
  private fadeStates: Map<string, Map<string, FadeState>> = new Map()
  
  /**
   * Merge values from all sources for a single fixture
   */
  mergeFixture(input: MergeInput): MergeOutput {
    const { fixtureId, aiValues, flowValues, override, flowEnabled, flowIntensity, blackout } = input
    
    const channels: FixtureChannelValues = { ...aiValues }
    const sources: MergeOutput['sources'] = {}
    
    // Lista de canales a procesar
    const channelKeys: (keyof FixtureChannelValues)[] = [
      'r', 'g', 'b', 'w', 'dimmer', 'pan', 'tilt', 'gobo', 'prism', 'focus', 'zoom'
    ]
    
    for (const channel of channelKeys) {
      let value = aiValues[channel]
      let source: 'ai' | 'flow' | 'override' = 'ai'
      
      // 1. Check Override (highest priority)
      if (override && this.isMasked(channel, override.mask)) {
        const overrideValue = this.getOverrideValue(channel, override.values)
        if (overrideValue !== undefined) {
          value = this.applyFade(fixtureId, channel, value, overrideValue, override.values.fadeTime ?? 200)
          source = 'override'
        }
      }
      // 2. Check Flow (medium priority)
      else if (flowEnabled && flowValues && flowValues[channel] !== undefined) {
        // Blend flow with AI based on intensity
        value = this.lerp(value, flowValues[channel], flowIntensity)
        source = 'flow'
      }
      // 3. Default: AI value (already assigned)
      
      // Apply blackout (master kill)
      if (blackout && this.isDimmerChannel(channel)) {
        value = 0
      }
      
      // Clamp to valid DMX range
      channels[channel] = this.clamp(value, 0, 255)
      sources[channel] = source
    }
    
    return { fixtureId, channels, sources }
  }
  
  /**
   * Merge all fixtures
   */
  mergeAll(inputs: MergeInput[]): MergeOutput[] {
    return inputs.map(input => this.mergeFixture(input))
  }
  
  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================
  
  /**
   * Check if a channel is masked by override
   */
  private isMasked(channel: keyof FixtureChannelValues, mask: ChannelMask): boolean {
    const channelToMask: Record<keyof FixtureChannelValues, keyof ChannelMask> = {
      r: 'color',
      g: 'color',
      b: 'color',
      w: 'color',
      dimmer: 'dimmer',
      pan: 'position',
      tilt: 'position',
      gobo: 'optics',
      prism: 'optics',
      focus: 'optics',
      zoom: 'optics'
    }
    
    return mask[channelToMask[channel]] ?? false
  }
  
  /**
   * Get override value for a channel
   */
  private getOverrideValue(channel: keyof FixtureChannelValues, values: FixtureOverride): number | undefined {
    // Mapeo directo para la mayoría de canales
    const directMap: Partial<Record<keyof FixtureChannelValues, keyof FixtureOverride>> = {
      r: 'r',
      g: 'g',
      b: 'b',
      w: 'w',
      dimmer: 'dimmer',
      pan: 'pan',
      tilt: 'tilt',
      gobo: 'gobo',
      focus: 'focus',
      zoom: 'zoom'
    }
    
    const key = directMap[channel]
    if (key && values[key] !== undefined) {
      return values[key] as number
    }
    
    // Para prism (boolean -> number)
    if (channel === 'prism' && values.prism !== undefined) {
      return values.prism ? 255 : 0
    }
    
    return undefined
  }
  
  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }
  
  /**
   * Clamp value to range
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }
  
  /**
   * Check if channel affects intensity (for blackout)
   */
  private isDimmerChannel(channel: keyof FixtureChannelValues): boolean {
    return channel === 'dimmer'
  }
  
  /**
   * Apply fade/transition to value
   */
  private applyFade(
    fixtureId: string,
    channel: string,
    currentValue: number,
    targetValue: number,
    fadeTimeMs: number
  ): number {
    // Para simplicidad, retornamos target directamente
    // En producción, esto debería manejar transiciones suaves
    // usando requestAnimationFrame o un timer
    return targetValue
  }
}

// ============================================================================
// FADE STATE (Para transiciones suaves)
// ============================================================================

interface FadeState {
  startValue: number
  targetValue: number
  startTime: number
  duration: number
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const dmxMerger = new DMXMerger()
```

### 5.3 Pseudocódigo del Flujo de Merge

```
FUNCTION calculateFinalDMX(fixtures, overrideStore, controlStore, aiValues, flowValues):
    
    FOR EACH fixture IN fixtures:
        fixtureId = fixture.id
        override = overrideStore.getOverride(fixtureId)
        mask = override?.mask OR DEFAULT_MASK
        
        FOR EACH channel IN fixture.channels:
            
            // PRIORITY 1: Manual Override
            IF override EXISTS AND mask[channel.type] IS TRUE:
                finalValue = override.values[channel.name]
                source = 'override'
            
            // PRIORITY 2: Flow Engine  
            ELSE IF controlStore.flowEnabled AND flowValues[fixtureId] EXISTS:
                aiValue = aiValues[fixtureId][channel.name]
                flowValue = flowValues[fixtureId][channel.name]
                intensity = controlStore.flowParams.intensity / 100
                
                finalValue = LERP(aiValue, flowValue, intensity)
                source = 'flow'
            
            // PRIORITY 3: Selene AI (Base)
            ELSE:
                finalValue = aiValues[fixtureId][channel.name]
                source = 'ai'
            
            // Apply Master Controls
            IF controlStore.blackout AND channel.type == 'dimmer':
                finalValue = 0
            
            // Clamp to DMX range
            finalValue = CLAMP(finalValue, 0, 255)
            
            // Apply fade if needed
            IF override?.fadeTime > 0:
                finalValue = APPLY_FADE(currentValue, finalValue, fadeTime)
            
            OUTPUT[fixtureId][channel.name] = finalValue
            OUTPUT[fixtureId].sources[channel.name] = source
    
    RETURN OUTPUT
```

---

## 6. INTERFACES TYPESCRIPT

### 6.1 Tipos de Stage

```typescript
// src/types/stage.types.ts

/**
 * Configuración de la vista Stage
 */
export interface StageConfig {
  viewportSize: 'full' | 'split' // Viewport 3D tamaño
  sidebarPosition: 'left' | 'right'
  sidebarWidth: number // px
  gridVisible: boolean
  labelsVisible: boolean
  beamsVisible: boolean
}

/**
 * Estado del viewport 3D
 */
export interface ViewportState {
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  zoom: number
  viewMode: 'perspective' | 'top' | 'front' | 'side'
}

/**
 * Contexto de la sidebar (determina qué controles mostrar)
 */
export type SidebarContext = 
  | { type: 'global' }                              // Sin selección
  | { type: 'single'; fixtureId: string }           // Un fixture
  | { type: 'multi'; fixtureIds: string[] }         // Múltiples fixtures
  | { type: 'group'; groupId: string }              // Grupo de fixtures

/**
 * Herramienta activa en Stage
 */
export type StageTool = 
  | 'select'    // Selección click/box
  | 'move'      // Mover fixtures en 3D
  | 'focus'     // Apuntar fixtures
  | 'measure'   // Medir distancias
```

### 6.2 Tipos de Fixture para 3D

```typescript
// src/types/fixture3d.types.ts

/**
 * Representación 3D de un fixture
 */
export interface Fixture3D {
  id: string
  name: string
  type: FixtureType
  
  // Posición en el espacio 3D
  position: {
    x: number
    y: number
    z: number
  }
  
  // Rotación base del fixture
  rotation: {
    x: number
    y: number
    z: number
  }
  
  // Estado visual actual (para renderizado)
  visualState: {
    color: { r: number; g: number; b: number }
    intensity: number // 0-1
    beamAngle: number // degrees
    beamVisible: boolean
  }
  
  // Estado de movimiento (cabezas móviles)
  movementState?: {
    pan: number   // degrees
    tilt: number  // degrees
  }
  
  // Metadata
  dmxAddress: number
  universe: number
  zone?: string
  groupIds?: string[]
}

export type FixtureType = 
  | 'par'
  | 'moving-head'
  | 'scanner'
  | 'strobe'
  | 'laser'
  | 'led-bar'
  | 'blinder'
  | 'generic'

/**
 * Eventos de interacción 3D
 */
export interface Fixture3DEvents {
  onClick: (fixtureId: string, event: MouseEvent) => void
  onDoubleClick: (fixtureId: string, event: MouseEvent) => void
  onHover: (fixtureId: string | null) => void
  onDrag: (fixtureId: string, newPosition: { x: number; y: number; z: number }) => void
}
```

### 6.3 Tipos de Dashboard

```typescript
// src/types/dashboard.types.ts

/**
 * Métricas de Selene para Dashboard
 */
export interface SeleneMetrics {
  // Audio
  bpm: number
  energy: number
  genre: string
  key: string
  mood: string
  
  // Performance
  fps: number
  latency: number
  cpuUsage: number
  
  // Session
  uptime: number
  decisionsPerMinute: number
  paletteChanges: number
}

/**
 * Estado del hardware
 */
export interface HardwareStatus {
  dmx: {
    connected: boolean
    device: string | null
    universe: number
    activeChannels: number
  }
  
  audio: {
    connected: boolean
    source: 'system' | 'microphone' | 'file'
    inputLevel: number
  }
  
  fixtures: {
    total: number
    active: number
    errors: number
  }
}

/**
 * Entrada de log reciente
 */
export interface RecentLog {
  id: string
  timestamp: number
  category: string
  message: string
  level: 'info' | 'warn' | 'error' | 'debug'
}
```

---

## 7. FLUJO DE DATOS

### 7.1 Diagrama de Flujo Principal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW - STAGE VIEW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │  User Input │ (Click en 3D, Slider, Color Wheel)                         │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    SELECTION STORE                          │           │
│  │  • User clicks fixture → select(id)                         │           │
│  │  • Box selection → selectMultiple(ids)                      │           │
│  │  • Ctrl+Click → toggleSelection(id)                         │           │
│  └──────┬──────────────────────────────────────────────────────┘           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │               CONTEXTUAL SIDEBAR (React)                    │           │
│  │                                                             │           │
│  │  hasSelection?                                              │           │
│  │    YES → <InspectorControls fixtures={selectedIds} />       │           │
│  │    NO  → <GlobalControls />                                 │           │
│  └──────┬──────────────────────────────────────────────────────┘           │
│         │                                                                   │
│         │ (User adjusts slider/color)                                       │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    OVERRIDE STORE                           │           │
│  │  • setMultipleOverrides(selectedIds, { dimmer: 200 })       │           │
│  │  • Mask auto-inferred: { dimmer: true }                     │           │
│  └──────┬──────────────────────────────────────────────────────┘           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    DMX MERGER (Engine)                      │           │
│  │                                                             │           │
│  │  for (fixture of allFixtures):                              │           │
│  │    merge(aiValue, flowValue, override) → finalValue         │           │
│  │                                                             │           │
│  └──────┬──────────────────────────────────────────────────────┘           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                   DMX OUTPUT (Backend)                      │           │
│  │  • 512-channel buffer updated                               │           │
│  │  • Sent to hardware via USB/Network                         │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Suscripciones y Reactividad

```typescript
// Ejemplo de cómo los componentes se suscriben a cambios

// En Stage3DCanvas.tsx
const selectedIds = useSelectionStore(state => state.selectedIds)
const overrides = useOverrideStore(state => state.overrides)

// Cada fixture 3D escucha su propio estado
function Fixture3DComponent({ id }: { id: string }) {
  const isSelected = useSelectionStore(state => state.selectedIds.has(id))
  const isHovered = useSelectionStore(state => state.hoveredId === id)
  const override = useOverrideStore(state => state.overrides.get(id))
  
  // ...render con estado visual
}

// En ContextualSidebar.tsx
function ContextualSidebar() {
  const hasSelection = useSelectionStore(state => state.selectedIds.size > 0)
  const selectedArray = useSelectionStore(state => [...state.selectedIds])
  
  if (!hasSelection) {
    return <GlobalControls />
  }
  
  return <InspectorControls fixtureIds={selectedArray} />
}
```

---

## 8. ROADMAP DE IMPLEMENTACIÓN

### Fase 1: Fundamentos (Semana 1)

| Día | Tarea | Entregable |
|-----|-------|------------|
| 1 | Crear estructura de carpetas | Árbol completo creado |
| 2 | Implementar `selectionStore.ts` | Store funcional con tests |
| 3 | Implementar `overrideStore.ts` | Store funcional con tests |
| 4 | Implementar `controlStore.ts` | Store funcional con persistencia |
| 5 | Crear interfaces TypeScript | Todos los tipos en `/types` |

### Fase 2: Vistas Base (Semana 2)

| Día | Tarea | Entregable |
|-----|-------|------------|
| 1-2 | `DashboardView` layout + panels | Vista funcional sin datos reales |
| 3-4 | `StageView` layout base | Viewport placeholder + sidebar |
| 5 | `ViewSwitcher` + navegación | Cambio entre vistas fluido |

### Fase 3: Stage 3D (Semana 3)

| Día | Tarea | Entregable |
|-----|-------|------------|
| 1-2 | `Stage3DCanvas` con React Three Fiber | Canvas básico renderizando |
| 3 | Fixtures 3D básicos (`Fixture3D`, `MovingHead3D`) | Modelos simples renderizando |
| 4 | Selección en 3D (click + box select) | Interacción funcional |
| 5 | Integración con `selectionStore` | Selección reactiva |

### Fase 4: Sidebar Contextual (Semana 4)

| Día | Tarea | Entregable |
|-----|-------|------------|
| 1 | `ContextualSidebar` router | Switch global/inspector |
| 2 | `GlobalControls` (paleta, movimiento global) | Controles funcionando |
| 3-4 | `InspectorControls` (color, dimmer, pan/tilt) | Controles enviando overrides |
| 5 | Controles reutilizables (`ColorWheel`, sliders) | Componentes pulidos |

### Fase 5: DMX Merger (Semana 5)

| Día | Tarea | Entregable |
|-----|-------|------------|
| 1-2 | `DMXMerger` class implementation | Lógica de merge funcional |
| 3 | Integración con backend existente | Pipeline completo |
| 4 | Tests de integración | Cobertura >80% |
| 5 | Debug tools (ver source de cada canal) | Herramientas de desarrollo |

### Fase 6: Polish & Integration (Semana 6)

| Día | Tarea | Entregable |
|-----|-------|------------|
| 1-2 | Transiciones y animaciones | UX fluida |
| 3 | Dashboard con datos reales | Métricas en vivo |
| 4 | Performance optimization | 60fps estable |
| 5 | Documentación + code review | Código listo para producción |

---

## 9. CONSIDERACIONES DE PERFORMANCE

### 9.1 Optimizaciones Críticas

```typescript
// 1. Selectores memoizados para evitar re-renders
const selectIsSelected = (id: string) => 
  (state: SelectionState) => state.selectedIds.has(id)

// 2. Shallow compare en Zustand
const selectedArray = useSelectionStore(
  state => [...state.selectedIds],
  shallow // import from zustand/shallow
)

// 3. Throttle para updates de alta frecuencia
import { throttle } from 'lodash-es'

const throttledSetOverride = throttle(
  (id: string, values: Partial<FixtureOverride>) => {
    overrideStore.getState().setOverride(id, values)
  },
  16 // ~60fps
)

// 4. Web Workers para cálculos pesados (DMX Merge)
const mergeWorker = new Worker(
  new URL('./workers/dmxMerge.worker.ts', import.meta.url)
)

// 5. Virtualización para listas largas de fixtures
import { FixedSizeList } from 'react-window'
```

### 9.2 Memory Management

```typescript
// Limpiar overrides antiguos periódicamente
setInterval(() => {
  const overrides = overrideStore.getState().overrides
  const now = Date.now()
  const staleThreshold = 30 * 60 * 1000 // 30 minutos
  
  overrides.forEach((override, id) => {
    if (now - override.timestamp > staleThreshold) {
      overrideStore.getState().clearOverride(id)
    }
  })
}, 60000)
```

---

## 📚 ANEXOS

### A. Checklist de Implementación

- [ ] Estructura de carpetas creada
- [ ] `selectionStore.ts` implementado
- [ ] `overrideStore.ts` implementado
- [ ] `controlStore.ts` implementado
- [ ] Tipos TypeScript definidos
- [ ] `DashboardView` funcional
- [ ] `StageView` funcional
- [ ] `Stage3DCanvas` renderizando
- [ ] Selección 3D funcional
- [ ] `ContextualSidebar` con switch de contexto
- [ ] `GlobalControls` funcional
- [ ] `InspectorControls` funcional
- [ ] `DMXMerger` integrado
- [ ] Tests unitarios >80% cobertura
- [ ] Performance validada (60fps)
- [ ] Documentación completa

### B. Dependencias Recomendadas

```json
{
  "dependencies": {
    "@react-three/fiber": "^8.x",
    "@react-three/drei": "^9.x",
    "three": "^0.160.x",
    "zustand": "^4.x",
    "immer": "^10.x",
    "lodash-es": "^4.x"
  },
  "devDependencies": {
    "@types/three": "^0.160.x",
    "@types/lodash-es": "^4.x"
  }
}
```

---

**FIN DEL BLUEPRINT**

*Documento generado para WAVE 30: Stage Command & Dashboard*  
*Selene LuxSync - Control DMX Inteligente*
