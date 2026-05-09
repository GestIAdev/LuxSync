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
 * WAVE 4613 FIX: COLOR r/g/b y KINETIC pan/tilt ahora leen del ArbitratedNodeMap
 * y de currentPosition actualizado por el IK engine respectivamente.
 *
 * @module core/aether/resolver/AetherUIProjector
 * @version WAVE 4613 — COLOR + KINETIC FIX
 */

import type { NodeGraph } from '../NodeGraph'
import { NodeFamily } from '../types'
import type { IKineticNodeData } from '../capability-node'
import type { ArbitratedNodeMap } from '../intent-bus'
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
   *
   * @param fixtures      Array mutable de FixtureState (mutado in-place)
   * @param graph         NodeGraph para leer pan/tilt y color de los nodos
   * @param arbitrated    ArbitratedNodeMap post-arbitraje — fuente de verdad para dimmers
   * @param blackoutActive Si es true, todos los canales emisores se fuerzan a 0 en la UI.
   *                       Pan/tilt/rotación se conservan para que la UI siga mostrando
   *                       la orientación mecánica aunque el fixture esté oscuro.
   */
  project(fixtures: FixtureState[], graph: NodeGraph, arbitrated: ArbitratedNodeMap, blackoutActive: boolean = false): void {
    for (const fixture of fixtures) {
      // DeviceId canónico: el UUID del fixture (no fixtureId ni name)
      // ⚡ WAVE 4559: fixtureId es el UUID canónico — el DeviceId que indexa el NodeGraph
      // (population: FixtureMapper.buildInitialState → fixtureId: fixture.id ?? fallback)
      const deviceId = fixture.fixtureId
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
          case NodeFamily.COLOR: {
            // WAVE 4613: Leer r/g/b del ArbitratedNodeMap (post-arbitraje real).
            // currentColor NO se actualiza en el pipeline actual: ColorAdapter emite
            // intents r/g/b al bus pero nunca escribe de vuelta al nodo.
            // El patrón es idéntico al fix de IMPACT (WAVE 4612).
            //
            // 🌊 WAVE 4690: brightness (intensidad virtual L0) actúa como master dimmer
            // para fixtures RGB sin canal físico de dimmer. Se aplica como escala
            // sobre r/g/b y se refleja en fixture.dimmer para que la UI preview
            // muestre intensidad proporcional.
            const colorChannels = arbitrated.get(nodeId)
            const brightnessNorm = colorChannels?.['brightness'] ?? 1.0
            fixture.r = toDmx((colorChannels?.['r'] ?? 0) * brightnessNorm)
            fixture.g = toDmx((colorChannels?.['g'] ?? 0) * brightnessNorm)
            fixture.b = toDmx((colorChannels?.['b'] ?? 0) * brightnessNorm)
            fixture.dimmer = toDmx(colorChannels?.['dimmer'] ?? brightnessNorm)
            // 🩺 WAVE 4690 TEMP TRACE 3b — UI RENDER (COLOR)
            if ((node as any).zoneId === 'ambient' || (node as any).zoneId === 'air') {
              console.log(`[UI RENDER 🎨 COLOR] nodeId=${nodeId} zone=${(node as any).zoneId ?? '?'} brightness=${brightnessNorm.toFixed(3)} r=${fixture.r} g=${fixture.g} b=${fixture.b}`)
            }
            break
          }
          case NodeFamily.IMPACT: {
            // WAVE 4612: Leer dimmer del ArbitratedNodeMap (post-arbitraje real).
            // state[1] NO se usa porque nadie lo escribe en el pipeline actual:
            // el PhysicsPostProcessor solo procesa KINETIC, y el arbiter
            // solo retorna el mapa sin escribir de vuelta al NodeGraph.
            //
            // 🌊 WAVE 4690: Fallback a brightness para nodos IMPACT sin dimmer físico
            // (parches universales de fixtures RGB-only clasificados como IMPACT).
            const arbitratedChannels = arbitrated.get(nodeId)
            const dimmerNorm = arbitratedChannels?.['dimmer'] ?? arbitratedChannels?.['brightness'] ?? 0
            fixture.dimmer = toDmx(dimmerNorm)
            // 🩺 WAVE 4686 TEMP TRACE 3 — UI RENDER (IMPACT)
            if ((node as any).zoneId === 'ambient' || (node as any).zoneId === 'air') {
              console.log(`[UI RENDER 🎨 IMPACT] nodeId=${nodeId} zone=${(node as any).zoneId ?? '?'} dimmer=${dimmerNorm.toFixed(3)}`)
            }
            break
          }
          case NodeFamily.BEAM: {
            // Zoom y focus los resuelve el NodeResolver directamente al FixtureState.
            // El pipeline AetherSafetyMiddleware → FixtureMapper ya los propaga.
            break
          }
          default:
            break
        }
      }

      // 🚨 WAVE 4634: BLACKOUT UI SYNC — Apagón visual del hot-frame.
      // Si blackout está activo, forzamos a 0 todos los canales emisores de luz
      // en la UI. Pan, tilt y rotación se conservan para que la interfaz siga
      // mostrando la orientación mecánica aunque el fixture esté oscuro.
      if (blackoutActive) {
        fixture.dimmer = 0
        fixture.r = 0
        fixture.g = 0
        fixture.b = 0
        if (fixture.white !== undefined) fixture.white = 0
        if (fixture.amber !== undefined) fixture.amber = 0
        if (fixture.uv !== undefined) fixture.uv = 0
        if (fixture.shutter !== undefined) fixture.shutter = 0
        if (fixture.strobe !== undefined) fixture.strobe = 0
      }
    }
  }
}
