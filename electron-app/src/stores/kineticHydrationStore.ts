/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💧 KINETIC HYDRATION STORE — WAVE 4712: L2 MIRROR & MIXED STATE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Espejo read-only del estado L2-MOTOR per-fixture, poblado por
 * KineticsBridge tras llamar `window.lux.aether.getKineticNodeStates(...)`.
 *
 * El bridge NUNCA se SUSCRIBE a este store — solo escribe. Como el bridge
 * solo dispara IPC en respuesta a cambios de `movementStore` (intent del
 * operador), la hidratación aquí es completamente silenciosa: no genera
 * ruido en la red.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ FLUJO DE DATOS                                                  │
 * │                                                                 │
 * │ Selección cambia ─► bridge ─► getKineticNodeStates IPC          │
 * │                              ─► setNodeStates(states)           │
 * │                              ─► recomputeAggregate(selectedIds) │
 * │                                                                 │
 * │ Operador clickea/drag ─► movementStore                          │
 * │                       ─► (bridge emite IPC)                     │
 * │                       ─► (tras ack) applyOperatorIntent(...)    │
 * │                                                                 │
 * │ UI ────────────────────► lee aggregate.{pattern,speed,...}      │
 * │                          null = MIXED  →  render "--"           │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * @module stores/kineticHydrationStore
 * @version WAVE 4712
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PatternType } from './movementStore'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Snapshot per-fixture devuelto por el IPC `getKineticNodeStates`. */
export interface NodeKineticSnapshot {
  active: boolean
  pattern: PatternType        // ya traducido a UI pattern (engine 'figure8' → ui 'eight')
  speed: number               // 0..100 (UI scale)
  amplitude: number           // 0..100 (UI scale)
  fan: number                 // -100..100 (UI scale)  — equivalente a chaos del slider
  panAnchor: number           // 0..540 (UI deg)
  tiltAnchor: number          // 0..270 (UI deg)
}

/**
 * Agregado para la selección activa.
 * Si todos los fixtures de la selección concuerdan en un campo → valor único.
 * Si hay divergencia → `null` (la UI muestra "--" o estado neutral).
 *
 * Cuando la selección está vacía, todos los campos son `null`.
 */
export interface KineticAggregate {
  pattern: PatternType | null
  speed: number | null        // 0..100
  amplitude: number | null    // 0..100
  fan: number | null          // -100..100
  panAnchor: number | null    // 0..540 deg
  tiltAnchor: number | null   // 0..270 deg
  /** ¿Todos los nodos de la selección tienen una pista activa en el motor? */
  anyActive: boolean
  /** ¿Cuántos fixtures cubre el agregado? */
  count: number
}

interface KineticHydrationState {
  /** Estado L2 per-fixture. Solo se actualiza desde el bridge. */
  nodes: Map<string, NodeKineticSnapshot>
  /** Vista agregada de la selección actual. */
  aggregate: KineticAggregate
}

interface KineticHydrationActions {
  /**
   * Bridge → store: reemplaza/actualiza los snapshots y recalcula aggregate.
   * Pasa `selectedIds` para que el aggregate refleje exactamente la selección.
   */
  setNodeStates: (states: Array<{ fixtureId: string; snapshot: NodeKineticSnapshot }>, selectedIds: string[]) => void

  /**
   * Recalcula el aggregate cuando cambia la selección sin un fetch nuevo.
   * Útil cuando los snapshots del bridge llegaron primero y luego la selección
   * se reordena (poco común, pero seguro).
   */
  recomputeAggregate: (selectedIds: string[]) => void

  /**
   * Optimistic update: aplica el intent del operador a los fixtures dados.
   * No emite IPC — eso lo hace el bridge a partir de movementStore.
   * Usado por la UI ANTES de que el IPC ack vuelva, para que el botón/slider
   * que el operador acaba de tocar muestre el valor nuevo inmediatamente.
   */
  applyOperatorIntent: (
    selectedIds: string[],
    intent: Partial<NodeKineticSnapshot>,
  ) => void

  /** Reset completo (Unlock). */
  reset: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — agregado y traducción de patrón engine ↔ UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapeo inverso del que vive en AetherIPCHandlers.mapToNativePattern.
 * El motor solo conoce nombres nativos; la UI usa los nombres de PatternType.
 */
const NATIVE_TO_UI_PATTERN: Record<string, PatternType> = {
  'circle':     'circle',
  'figure8':    'eight',
  'lemniscate': 'butterfly',
  'scan_x':     'sweep',
  'square':     'circle',     // no hay UI dedicada — fallback visual
  'diamond':    'circle',     // idem
  'wave_y':     'bounce',
  'ballyhoo':   'circle',     // sin UI dedicada → no se ilumina ninguno
  'darkspin':   'darkspin',
  'sway':       'pulse',
}

export function nativePatternToUI(native: string | null): PatternType {
  if (native === null) return 'none'
  return NATIVE_TO_UI_PATTERN[native] ?? 'none'
}

const EMPTY_AGGREGATE: KineticAggregate = {
  pattern: null,
  speed: null,
  amplitude: null,
  fan: null,
  panAnchor: null,
  tiltAnchor: null,
  anyActive: false,
  count: 0,
}

function computeAggregate(
  nodes: Map<string, NodeKineticSnapshot>,
  selectedIds: string[],
): KineticAggregate {
  if (selectedIds.length === 0) return { ...EMPTY_AGGREGATE }

  // Recoger snapshots de los fixtures seleccionados que sí existan en el mapa.
  const present: NodeKineticSnapshot[] = []
  for (const id of selectedIds) {
    const s = nodes.get(id)
    if (s) present.push(s)
  }
  if (present.length === 0) {
    return { ...EMPTY_AGGREGATE, count: selectedIds.length }
  }

  // Tolerancia para igualar floats (evita "mixed" por ruido de IPC).
  const EPS = 1e-3

  let pattern: PatternType | null = present[0].pattern
  let speed: number | null        = present[0].speed
  let amplitude: number | null    = present[0].amplitude
  let fan: number | null          = present[0].fan
  let panAnchor: number | null    = present[0].panAnchor
  let tiltAnchor: number | null   = present[0].tiltAnchor
  let anyActive                   = present[0].active

  for (let i = 1; i < present.length; i++) {
    const s = present[i]
    if (s.active) anyActive = true
    if (pattern   !== null && s.pattern   !== pattern)   pattern   = null
    if (speed     !== null && Math.abs(s.speed     - speed)     > EPS) speed     = null
    if (amplitude !== null && Math.abs(s.amplitude - amplitude) > EPS) amplitude = null
    if (fan       !== null && Math.abs(s.fan       - fan)       > EPS) fan       = null
    if (panAnchor  !== null && Math.abs(s.panAnchor  - panAnchor)  > EPS) panAnchor  = null
    if (tiltAnchor !== null && Math.abs(s.tiltAnchor - tiltAnchor) > EPS) tiltAnchor = null
  }

  return {
    pattern,
    speed,
    amplitude,
    fan,
    panAnchor,
    tiltAnchor,
    anyActive,
    count: selectedIds.length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useKineticHydrationStore = create<KineticHydrationState & KineticHydrationActions>()(
  subscribeWithSelector((set) => ({
    nodes: new Map(),
    aggregate: { ...EMPTY_AGGREGATE },

    setNodeStates: (states, selectedIds) => set(state => {
      const next = new Map(state.nodes)
      for (const { fixtureId, snapshot } of states) {
        next.set(fixtureId, snapshot)
      }
      return {
        nodes: next,
        aggregate: computeAggregate(next, selectedIds),
      }
    }),

    recomputeAggregate: (selectedIds) => set(state => ({
      aggregate: computeAggregate(state.nodes, selectedIds),
    })),

    applyOperatorIntent: (selectedIds, intent) => set(state => {
      if (selectedIds.length === 0) return state
      const next = new Map(state.nodes)
      for (const id of selectedIds) {
        const prev = next.get(id) ?? {
          active: false,
          pattern: 'none' as PatternType,
          speed: 50,
          amplitude: 50,
          fan: 0,
          panAnchor: 270,
          tiltAnchor: 135,
        }
        next.set(id, {
          ...prev,
          ...intent,
          active: intent.pattern !== undefined
            ? intent.pattern !== 'none' && intent.pattern !== 'static'
            : prev.active,
        })
      }
      return {
        nodes: next,
        aggregate: computeAggregate(next, selectedIds),
      }
    }),

    reset: () => set({
      nodes: new Map(),
      aggregate: { ...EMPTY_AGGREGATE },
    }),
  })),
)
