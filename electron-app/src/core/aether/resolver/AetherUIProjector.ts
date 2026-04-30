/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 AETHER UI PROJECTOR — Agnostic Ready (WAVE 3513.3.2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RESPONSABILIDAD:
 * Proyectar el estado interno del NodeGraph (capacidades) sobre el array
 * legacy FixtureState[] para que la UI, el preview y los monitores
 * sigan funcionando sin saber que existe Aether.
 *
 * FILOSOFÍA:
 * Este es un ADAPTADOR DE LECTURA. No escribe al pipeline DMX real.
 * Itera los fixtures legacy, consulta sus nodos en el NodeGraph,
 * y copia los valores agnósticos (0-1 normalizados) al formato legacy (0-255).
 *
 * REGLAS:
 * - fixture.id es el DeviceId canónico (UUID).
 * - Solo muta campos legacy in-place; nunca crea objetos nuevos.
 * - Si un fixture no tiene nodos Aether, se salta silenciosamente.
 *
 * @module core/aether/resolver/AetherUIProjector
 * @version WAVE 3513.3.2 — KINETIC EXPANSION
 */

import type { NodeGraph } from '../NodeGraph'
import { NodeFamily } from '../types'
import type { IKineticNodeData } from '../capability-node'
import type { FixtureState } from '../../../hal/mapping/FixtureMapper'

/** Conversión de valor normalizado 0-1 a rango DMX 0-255 */
const DMX_MAX = 255

function toDmx(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * DMX_MAX)
}

export class AetherUIProjector {

  /**
   * Proyecta el estado Aether sobre el array legacy de FixtureState.
   *
   * ZERO-ALLOC: solo lectura del graph + mutación in-place de fixtures.
   */
  project(fixtures: FixtureState[], graph: NodeGraph): void {
    for (const fixture of fixtures) {
      // DeviceId canónico: el UUID del fixture (no fixtureId ni name)
      const deviceId = fixture.fixtureId ?? fixture.name
      if (!deviceId) continue

      const nodeIds = graph.getDeviceNodes(deviceId)
      if (!nodeIds || nodeIds.length === 0) continue

      for (const nodeId of nodeIds) {
        const node = graph.getNodeData(nodeId)
        if (!node) continue

        switch (node.family) {
          case NodeFamily.KINETIC: {
            const kn = node as IKineticNodeData
            if (kn.isContinuous) {
              // ── Rotación continua: fan, pétalo, mirror ball ─────────────
              const rot = kn.currentPosition.rotation ?? 0.5
              fixture.rotation = toDmx(rot)
            } else {
              // ── Posicionado: pan / tilt ───────────────────────────────
              fixture.pan  = toDmx(kn.currentPosition.pan  ?? 0.5)
              fixture.tilt = toDmx(kn.currentPosition.tilt ?? 0.5)
            }
            break
          }
          // Futuro: COLOR, IMPACT, BEAM pueden proyectarse aquí.
          default:
            break
        }
      }
    }
  }
}
