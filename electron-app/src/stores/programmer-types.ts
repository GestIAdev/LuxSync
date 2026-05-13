/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🦎 PROGRAMMER TYPES — WAVE 4724: CAMALEÓN FOUNDATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Contratos de la nueva capa Multi-Cell del Programmer.
 *
 * FILOSOFÍA:
 *   El programmer ya no habla con fixtures, habla con CÉLULAS DE CAPACIDAD.
 *   Una célula es una proyección 1:1 (o 1:N en twin-selection) sobre uno o
 *   más `ICapabilityNode` del nodeGraph Aether.
 *
 *   CellKey = identificador estable de la célula UI.
 *   nodeIds[] = nodos reales del Aether que esta célula controla.
 *
 * ZERO-ALLOC:
 *   Todas las CellKey y los arrays de nodeIds se pre-construyen en el momento
 *   de la selección del fixture (`registerFixtureCells`). El hot path del
 *   bridge a 44Hz NUNCA construye strings ni arrays — solo itera estructuras
 *   pre-existentes con iteradores nativos `for...of`.
 *
 * COEXISTENCIA:
 *   Esta capa convive con `ProgrammerOverrides` (legacy fixture-flat) durante
 *   la migración. El bridge da prioridad a las celdas; los nodeIds cubiertos
 *   por cellOverrides se EXCLUYEN del path legacy en el mismo tick para
 *   evitar dobles escrituras y carreras.
 *
 * @module stores/programmer-types
 * @version WAVE 4724
 */

import type { DeviceId, NodeId, NodeRole } from '../core/aether/types'
import { NodeFamily } from '../core/aether/types'

// ─────────────────────────────────────────────────────────────────────────────
// CELL KEY — Identidad estable de una célula de UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identificador único de una célula del Programmer.
 *
 * Formato canónico:  `<deviceId>:<nodeLabel>`
 * Ejemplo:           `tungsteno-01:petal-1`
 *
 * INVARIANTE: una `CellKey` se construye **una sola vez** al registrar la
 * selección y se reutiliza durante toda la vida de esa célula en la UI.
 * Nunca se concatena en el hot path (44Hz).
 *
 * NOTA TIPADO: usamos branded template literal type para que TypeScript
 * pueda distinguir CellKey de string genérico, pero a nivel runtime es
 * un string normal — sin overhead.
 */
export type CellKey = string & { readonly __brand: 'CellKey' }

/**
 * Constructor canónico de CellKey.
 *
 * USO: SOLO en patch time / selección. NUNCA en el hot path 44Hz.
 *
 * @example
 *   const key = makeCellKey('tungsteno-01', 'petal-1')
 *   // key === 'tungsteno-01:petal-1' (CellKey branded)
 */
export const makeCellKey = (deviceId: DeviceId, nodeLabel: string): CellKey =>
  (`${deviceId}:${nodeLabel}`) as CellKey

/**
 * Extrae el deviceId desde una CellKey.
 * Útil para `releaseDevice()` y telemetría.
 * Llamar solo en frío — no en hot path.
 */
export const cellKeyDeviceId = (cellKey: CellKey): DeviceId => {
  const idx = (cellKey as string).indexOf(':')
  return idx >= 0 ? (cellKey as string).slice(0, idx) : (cellKey as string)
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYLOADS POR FAMILIA — Valores normalizados 0-1, sparse (omit = no override)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload de la familia COLOR.
 * Todos los valores normalizados 0-1. Campos omitidos = no override en ese canal.
 */
export interface ColorCellPayload {
  readonly r?: number
  readonly g?: number
  readonly b?: number
  readonly white?: number
  readonly amber?: number
}

/**
 * Payload de la familia IMPACT (intensidad / strobe / shutter / inhibit).
 * Todos los valores normalizados 0-1.
 */
export interface ImpactCellPayload {
  readonly dimmer?: number
  readonly strobe?: number
  readonly shutter?: number
  readonly limit?: number
}

/**
 * Payload de la familia BEAM (óptica: zoom/focus/iris + ruedas mecánicas).
 * Todos los valores normalizados 0-1.
 */
export interface BeamCellPayload {
  readonly focus?: number
  readonly zoom?: number
  readonly iris?: number
  readonly gobo?: number
  readonly prism?: number
}

/**
 * Payload de la familia KINETIC (movimiento + rotaciones continuas).
 * `pan`/`tilt`/`speed` normalizados 0-1; `targetX/Y/Z` en metros (IK puro).
 * `rotation` normalizado 0-1 (para rotores continuos como pétalos).
 */
export interface KineticCellPayload {
  readonly pan?: number
  readonly tilt?: number
  readonly speed?: number
  readonly targetX?: number
  readonly targetY?: number
  readonly targetZ?: number
  readonly rotation?: number
}

/**
 * Payload de la familia ATMOSPHERE / phantoms residuales.
 * Map<channelKey, normalized 0-1>.
 *
 * NOTA: usamos ReadonlyMap para que el bridge pueda iterar con for-of sin
 * miedo a mutaciones concurrentes desde la UI.
 */
export type ExtrasCellPayload = ReadonlyMap<string, number>

/**
 * Discriminated union de payloads por familia.
 *
 * Permite pattern matching exhaustivo en el bridge:
 * ```ts
 * switch (cell.payload.family) {
 *   case NodeFamily.COLOR:      // payload.data: ColorCellPayload
 *   case NodeFamily.IMPACT:     // payload.data: ImpactCellPayload
 *   case NodeFamily.BEAM:       // payload.data: BeamCellPayload
 *   case NodeFamily.KINETIC:    // payload.data: KineticCellPayload
 *   case NodeFamily.ATMOSPHERE: // payload.data: ExtrasCellPayload
 * }
 * ```
 */
export type CellOverridePayload =
  | { readonly family: NodeFamily.COLOR;      readonly data: ColorCellPayload }
  | { readonly family: NodeFamily.IMPACT;     readonly data: ImpactCellPayload }
  | { readonly family: NodeFamily.BEAM;       readonly data: BeamCellPayload }
  | { readonly family: NodeFamily.KINETIC;    readonly data: KineticCellPayload }
  | { readonly family: NodeFamily.ATMOSPHERE; readonly data: ExtrasCellPayload }

// ─────────────────────────────────────────────────────────────────────────────
// CELL OVERRIDE — Entrada del Map<CellKey, CellOverride>
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Override activo de una célula del programmer.
 *
 * Lo guarda el `programmerStore` en `cellOverrides: Map<CellKey, CellOverride>`.
 * Es la unidad atómica de control manual en la nueva arquitectura.
 *
 * INVARIANTES:
 * - `nodeIds` es un array CONGELADO en patch/selection time — el bridge nunca
 *   lo recrea ni lo filtra.
 * - `deviceId` está pre-extraído para que `releaseDevice()` no necesite parsear
 *   strings.
 * - `payload.family` SIEMPRE coincide con la familia real de los nodos en
 *   `nodeIds` (validado al registrar).
 */
export interface CellOverride {
  readonly cellKey: CellKey
  /**
   * NodeIds reales del Aether que esta célula controla simultáneamente.
   * En single-fixture: 1 elemento. En twin-selection (N fixtures gemelos
   * con la misma capacidad): N elementos.
   *
   * Pre-construido en `registerFixtureCells` — congelado durante la vida
   * del cell override.
   */
  readonly nodeIds: readonly NodeId[]
  /** DeviceId padre — pre-extraído para releaseDevice O(1). */
  readonly deviceId: DeviceId
  /** Payload normalizado, discriminado por familia. */
  readonly payload: CellOverridePayload
  /** Timestamp del último write — útil para LRU/telemetría, opcional en lectura. */
  readonly lastWriteMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY CONTEXT — Lo que la UI recibe para renderizar una sección
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contexto de capacidad que se pasa a las atomic sections (UI).
 *
 * Es el dual *read-only* del CellOverride: la UI lo recibe del
 * `useCapabilityCells` selector (Wave 2 del plan) y lo usa para hidratar
 * sus props sin necesidad de conocer el nodeGraph.
 *
 * Genérico sobre la familia para que TypeScript pueda inferir el shape
 * del payload válido al pasarlo a setters específicos:
 *
 * ```ts
 * function ColorSection({ ctx }: { ctx: CapabilityContext<NodeFamily.COLOR> }) { ... }
 * ```
 */
export interface CapabilityContext<F extends NodeFamily = NodeFamily> {
  /** Identificador estable de la célula UI. */
  readonly cellKey: CellKey
  /** Familia Aether de la capacidad. */
  readonly family: F
  /** NodeIds reales que esta célula UI controla (puede ser N en twin-selection). */
  readonly nodeIds: readonly NodeId[]
  /** Device padre (pre-extraído). */
  readonly deviceId: DeviceId
  /** FixtureId asociado en el showfile (alias de deviceId en la mayoría de casos). */
  readonly fixtureId: DeviceId
  /** Rol semántico para iconografía/agrupación visual ('wash', 'petal', 'beam', 'master'...). */
  readonly role: NodeRole
  /** Etiqueta legible: 'Pétalo 1', 'Wash', 'Master', 'Rayo'... */
  readonly label: string
  /** Posición de la célula dentro del device (0..N) — para ordenar UI. */
  readonly cellIndex: number
}

// ─────────────────────────────────────────────────────────────────────────────
// CELL DESCRIPTOR — Lo que la UI envía al store al registrar la selección
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Descriptor mínimo para registrar una célula en el store.
 *
 * El hook `useCapabilityCells(selectedFixtureIds)` lo construye iterando el
 * nodeGraph y se lo pasa al store vía `registerFixtureCells`. Es la frontera
 * entre el mundo Aether (read-only) y el store (mutable).
 */
export interface CellDescriptor {
  readonly cellKey: CellKey
  readonly family: NodeFamily
  readonly nodeIds: readonly NodeId[]
  readonly deviceId: DeviceId
  readonly fixtureId: DeviceId
  readonly role: NodeRole
  readonly label: string
  readonly cellIndex: number
}

// ─────────────────────────────────────────────────────────────────────────────
// CANALES TIPADOS — Helpers exhaustivos para los setters granulares
// ─────────────────────────────────────────────────────────────────────────────

export type ImpactChannelName  = keyof ImpactCellPayload
export type ColorChannelName   = keyof ColorCellPayload
export type BeamChannelName    = keyof BeamCellPayload
export type KineticChannelName = keyof KineticCellPayload

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS DE CONVENIENCIA
// ─────────────────────────────────────────────────────────────────────────────

export { NodeFamily }
export type { DeviceId, NodeId, NodeRole }
