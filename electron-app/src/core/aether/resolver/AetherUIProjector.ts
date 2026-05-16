/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 AETHER UI PROJECTOR — Universal Canvas (WAVE 4822)
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
 * - El proyector NUNCA aplica blackout a los datos de la UI (WAVE 4822).
 *   La Aduana de hardware vive en HAL.sendToDriver() (WAVE 3160), en capa de
 *   bytes DMX, sin tocar FixtureState. El Canvas muestra siempre el estado
 *   combinado real (L0 + L1 + L2) para permitir pre-programación en Blind Mode.
 *
 * WAVE 4822 DUCK-TYPING:
 *   El switch(node.family) fue eliminado. La proyección lee directamente los
 *   canales arbitrados del nodo sin importar su familia. Esto corrige el
 *   simulador a oscuras para familias ATMOSPHERE/EFFECT y fixtures multicelulares
 *   modernos como el Tungsten.
 *
 * @module core/aether/resolver/AetherUIProjector
 * @version WAVE 4822 — Universal Canvas
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

// 🌊 WAVE 4696 M1: Zonas atmosféricas — nunca compiten por luminancia con zonas
// rítmicas. Se suman aditivamente en su propio canal perceptual (ambiente / aire).
const ATMOSPHERIC_ZONES = new Set(['ambient', 'air', 'flash'])

/** Devuelve true si la zona normalizada es atmosférica (ambient, air, flash). */
function isAtmosphericZone(zoneId: string): boolean {
  const z = zoneId.toLowerCase().trim()
  return ATMOSPHERIC_ZONES.has(z)
}

export class AetherUIProjector {
  /**
   * Proyecta el estado Aether sobre el array legacy de FixtureState.
   *
   * ZERO-ALLOC: solo lectura del graph + mutación in-place de fixtures.
   *
   * WAVE 4822: El proyector nunca aplica blackout. El parámetro blackoutActive
   * se mantiene por compatibilidad de firma pero se ignora deliberadamente.
   * La Aduana de hardware (WAVE 3160) opera en capa de bytes DMX y es la única
   * fuente de verdad para el apagón físico. El Canvas siempre muestra L0+L1+L2.
   *
   * @param fixtures      Array mutable de FixtureState (mutado in-place)
   * @param graph         NodeGraph para leer pan/tilt de nodos KINETIC
   * @param arbitrated    ArbitratedNodeMap post-arbitraje — fuente de verdad
   * @param _blackoutActive Ignorado (ver WAVE 4822). HAL es la única Aduana real.
   */
  project(fixtures: FixtureState[], graph: NodeGraph, arbitrated: ArbitratedNodeMap, _blackoutActive: boolean = false): void {
    for (const fixture of fixtures) {
      // DeviceId canónico: el UUID del fixture (no fixtureId ni name)
      // ⚡ WAVE 4559: fixtureId es el UUID canónico — el DeviceId que indexa el NodeGraph
      // (population: FixtureMapper.buildInitialState → fixtureId: fixture.id ?? fallback)
      const deviceId = fixture.fixtureId
      if (!deviceId) continue

      const nodeIds = graph.getDeviceNodes(deviceId)
      if (!nodeIds || nodeIds.length === 0) continue

      // 🌊 WAVE 4695: Pre-scan — does this device own at least one IMPACT node?
      // When yes, the IMPACT path handles luminance via fixture.dimmer and the
      // renderer scales color by it (HDR boost path). Scaling r/g/b by brightness
      // here would cause quadratic L0² attenuation (Moiré / besugo effect).
      // Pure-RGB fixtures with no IMPACT node keep the brightness-as-scale path.
      const hasImpactDimmer = nodeIds.some(
        nid => graph.getNodeData(nid)?.family === NodeFamily.IMPACT,
      )

      for (const nodeId of nodeIds) {
        const node = graph.getNodeData(nodeId)
        if (!node) continue

        // ── KINETIC: posición mecánica leída desde currentPosition (IK/physics) ──
        if (node.family === NodeFamily.KINETIC) {
          const kn = node as IKineticNodeData
          if (kn.isContinuous) {
            fixture.rotation = toDmx(kn.currentPosition.rotation ?? 0.5)
          } else {
            fixture.pan  = toDmx(kn.currentPosition.pan  ?? 0.5)
            fixture.tilt = toDmx(kn.currentPosition.tilt ?? 0.5)
          }
          continue
        }

        // ── DUCK-TYPING sobre canales arbitrados (WAVE 4822) ─────────────────
        // Proyectar cualquier familia (COLOR, IMPACT, ATMOSPHERE, BEAM, EFFECT,
        // y cualquier familia futura) usando los canales presentes en el mapa
        // arbitrado. No hay switch: la familia no determina qué se proyecta.
        const ch = arbitrated.get(nodeId)
        if (!ch) continue

        // ── Luminancia: dimmer / brightness ────────────────────────────────
        const dimmerNorm = ch['dimmer'] ?? ch['brightness']
        if (dimmerNorm !== undefined) {
          // 🌊 WAVE 4696 M2: Gain compensation para role='primary' (física de mover).
          const gainFactor = node.role === 'primary' ? 1.25 : 1.0
          fixture.dimmer = Math.max(fixture.dimmer, toDmx(dimmerNorm * gainFactor))
        }

        // ── Crominancia: r/g/b ────────────────────────────────────────────
        const rRaw = ch['r'] ?? ch['red']
        const gRaw = ch['g'] ?? ch['green']
        const bRaw = ch['b'] ?? ch['blue']
        if (rRaw !== undefined || gRaw !== undefined || bRaw !== undefined) {
          // 🌊 WAVE 4695: Luminance-chrominance decoupling.
          // Si existe nodo IMPACT en el device, brightness ya porta luminancia → no escalar.
          const brightnessScale = hasImpactDimmer ? 1.0 : (ch['brightness'] ?? 1.0)
          const projectedR = toDmx((rRaw ?? 0) * brightnessScale)
          const projectedG = toDmx((gRaw ?? 0) * brightnessScale)
          const projectedB = toDmx((bRaw ?? 0) * brightnessScale)

          // 🌊 WAVE 4696 M1: Zone-aware color routing.
          // Atmospheric zones (ambient, air, flash) → additive blending.
          // Rhythmic/spatial zones → channel-wise max blend.
          if (isAtmosphericZone(node.zoneId)) {
            fixture.r = Math.min(255, fixture.r + projectedR)
            fixture.g = Math.min(255, fixture.g + projectedG)
            fixture.b = Math.min(255, fixture.b + projectedB)
          } else {
            fixture.r = Math.max(fixture.r, projectedR)
            fixture.g = Math.max(fixture.g, projectedG)
            fixture.b = Math.max(fixture.b, projectedB)
          }
        }

        // ── Canales extendidos: white, amber, uv ────────────────────────
        const whiteNorm = ch['white'] ?? ch['w']
        if (whiteNorm !== undefined && fixture.white !== undefined) {
          fixture.white = Math.max(fixture.white, toDmx(whiteNorm))
        }
        const amberNorm = ch['amber'] ?? ch['a']
        if (amberNorm !== undefined && fixture.amber !== undefined) {
          fixture.amber = Math.max(fixture.amber, toDmx(amberNorm))
        }
        const uvNorm = ch['uv']
        if (uvNorm !== undefined && fixture.uv !== undefined) {
          fixture.uv = Math.max(fixture.uv, toDmx(uvNorm))
        }
      }

      // WAVE 4822: Blackout eliminado del proyector UI.
      // La Aduana de hardware vive en HAL.sendToDriver() (WAVE 3160) y opera
      // exclusivamente en la capa de bytes DMX, sin mutar FixtureState.
      // El simulador Canvas 2D/3D SIEMPRE recibe el estado combinado real
      // (L0 + L1 + L2) para permitir pre-programación a ciegas (Blind Mode).
    }
  }
}
