/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — ZONE UTILS (Helpers Espaciales Compartidos)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4521.2: THE LIQUID-AETHER BRIDGE — Utilities de zona
 *
 * Funciones puras, deterministas y zero-alloc para el enrutamiento
 * espacial de intensidades zonales del LiquidStereoResult.
 *
 * Extraídas del ImpactAdapter y ColorAdapter (donde vivían duplicadas)
 * para ser el punto único de verdad del mapeo zona → intensidad.
 *
 * CONVENCIÓN DE COORDENADAS (WAVE 3506.1.1 — Y-up unificado):
 *   +X = derecha del escenario, -X = izquierda
 *   +Y = altura (no participa en zoning)
 *   +Z = frente / downstage; -Z = fondo / upstage
 *
 * @module core/aether/adapters/zoneUtils
 * @version WAVE 4521.2
 */

import type { LiquidStereoResult } from '../../../hal/physics/LiquidStereoPhysics'
import type { ICapabilityNode } from '../capability-node'

/**
 * Normaliza zoneId a kebab-case canónico para unificar Legacy camelCase y Aether.
 * Ejemplos: moversLeft -> movers-left, frontLeft -> front-left.
 */
export function normalizeZoneId(zoneId: string | null | undefined): string {
  if (!zoneId) return 'unassigned'
  const normalized = String(zoneId)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()

  // Alias legacy -> canónicos
  if (normalized === 'mover-left') return 'movers-left'
  if (normalized === 'mover-right') return 'movers-right'
  return normalized || 'unassigned'
}

// ═══════════════════════════════════════════════════════════════════════════
// EPICENTER FALLOFF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula el factor de atenuación por distancia al epicentro de la onda energética.
 *
 * El modelo es lineal inverso: a distancia 0 (epicentro), falloff = 1.0.
 * A distancia >= maxRadiusM, falloff = 0.0.
 *
 * Si el nodo no tiene posición asignada (SpatialRegistrar aún no ejecutado),
 * retorna 1.0 — el nodo recibe intensidad completa sin penalización.
 *
 * Fórmula: falloff = clamp01(1 - dist / maxRadiusM)
 * Donde: dist = sqrt((nx-ex)² + (ny-ey)² + (nz-ez)²)
 *
 * Math.sqrt es función nativa sin alloc (~2ns). Aceptado en hot path.
 *
 * @param node       - El nodo cuya posición se evalúa
 * @param epicenter  - Centro de la onda energética en coordenadas del escenario
 * @param maxRadiusM - Radio máximo de influencia en metros (default: 12.0)
 * @returns Factor de atenuación en [0, 1]
 */
export function computeEpicenterFalloff(
  node: Pick<ICapabilityNode, 'position'>,
  epicenter: { readonly x: number; readonly y: number; readonly z: number },
  maxRadiusM: number,
): number {
  if (!node.position) return 1.0

  const dx   = node.position.x - epicenter.x
  const dy   = node.position.y - epicenter.y
  const dz   = node.position.z - epicenter.z
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const v    = 1 - dist / maxRadiusM
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE → INTENSITY MAP (String-based — 9 zonas)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Selecciona la intensidad zonal del LiquidStereoResult según el zoneId
 * semántico del nodo.
 *
 * Mapa de zona → campo del LiquidStereoResult:
 *
 * | nodeZone       | Campo en result              | Descripción           |
 * |----------------|------------------------------|-----------------------|
 * | 'frontLeft'    | frontLeftIntensity           | El Océano (sub-bass)  |
 * | 'frontRight'   | frontRightIntensity          | El Francotirador (kick)|
 * | 'backLeft'     | backLeftIntensity            | El Coro (mid)         |
 * | 'backRight'    | backRightIntensity           | El Látigo (snare)     |
 * | 'moverLeft'    | moverLeftIntensity           | El Galán (treble)     |
 * | 'moverRight'   | moverRightIntensity          | La Dama (vocal)       |
 * | 'floor'        | floorIntensity               | WAVE 4520.2 — uplight |
 * | 'ambient'      | ambientIntensity             | WAVE 4520.2 — wash BG |
 * | 'air'          | airIntensity                 | WAVE 4520.2 — hazer   |
 *
 * Para zoneIds no reconocidos, fallback a la energía promedio de las
 * 6 zonas clásicas (representativa del nivel global del frame).
 *
 * Función pura, determinista, zero-alloc.
 *
 * @param result   - LiquidStereoResult producido por el motor
 * @param nodeZone - ZoneId semántico del nodo (e.g. 'floor', 'ambient')
 * @returns Intensidad en [0, 1]
 */
export function selectZoneFromResult(
  result: LiquidStereoResult,
  nodeZone: string,
): number {
  switch (normalizeZoneId(nodeZone)) {
    // ── 6 zonas clásicas ──────────────────────────────────────────────
    case 'front-left':   return result.frontLeftIntensity
    case 'front-right':  return result.frontRightIntensity
    case 'back-left':    return result.backLeftIntensity
    case 'back-right':   return result.backRightIntensity
    case 'movers-left':  return result.moverLeftIntensity
    case 'movers-right': return result.moverRightIntensity
    // ── 3 zonas WAVE 4520.2 ───────────────────────────────────────────
    case 'floor':       return result.floorIntensity
    case 'ambient':     return result.ambientIntensity
    case 'air':         return result.airIntensity
    // ── Zonas compuestas (WAVE 4655: fuente única de verdad) ────────────
    case 'front':
      return (result.frontLeftIntensity + result.frontRightIntensity) * 0.5
    case 'back':
      return (result.backLeftIntensity + result.backRightIntensity) * 0.5
    case 'left':
      return (result.frontLeftIntensity + result.backLeftIntensity + result.moverLeftIntensity) / 3
    case 'right':
      return (result.frontRightIntensity + result.backRightIntensity + result.moverRightIntensity) / 3
    // ── Zonas no asignadas / centrales → ambient sin inventar energía ────
    case 'unassigned':
    case 'center':
    case 'mid':
      return result.ambientIntensity
    // ── Zona desconocida → 0 explícito, sin promedios residuales ─────────
    default:
      return 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE INTENSITY — Selección posicional (legacy compat)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Selecciona la intensidad zonal del LiquidStereoResult según la posición
 * física (X/Z) del nodo en el escenario.
 *
 * Variante posicional compartida entre ImpactAdapter y ColorAdapter.
 * Compatible con las 6 zonas clásicas (sin floor/ambient/air).
 *
 * WAVE 3506.1.1: X = left/right, Z = front/back (no Y).
 *   Z >= 0 → frente (downstage, Z+)
 *   Z < 0  → fondo (upstage, Z-)
 *   |X| < 2.0m → zona central (movers)
 *
 * @param result - LiquidStereoResult del motor
 * @param nodeX  - Posición X del nodo en metros
 * @param nodeZ  - Posición Z del nodo en metros
 * @returns Intensidad en [0, 1]
 */
export function selectZoneIntensityXZ(
  result: LiquidStereoResult,
  nodeX: number,
  nodeZ: number,
): number {
  const isRight = nodeX >= 0
  const isFront = nodeZ >= 0
  const isMid   = Math.abs(nodeX) < 2.0

  if (isMid) {
    return isRight ? result.moverRightIntensity : result.moverLeftIntensity
  }

  if (isFront) {
    return isRight ? result.frontRightIntensity : result.frontLeftIntensity
  }

  return isRight ? result.backRightIntensity : result.backLeftIntensity
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR ROLE — Mapeo zona → rol cromático (WAVE 4522.3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapea el zoneId semántico de un nodo COLOR al rol cromático
 * que debe recibir desde SeleneLuxOutput.palette.
 *
 * Tabla de mapeo:
 * | zoneId                      | Rol      |
 * |-----------------------------|----------|
 * | frontLeft, frontRight, front| primary  |
 * | backLeft, backRight, back   | secondary|
 * | moverLeft, moverRight       | accent   |
 * | ambient, air, floor         | ambient  |
 * | (desconocido)               | ambient  |
 *
 * Función pura, determinista, zero-alloc.
 *
 * @param zoneId - ZoneId semántico del nodo (e.g. 'frontLeft', 'ambient')
 * @returns Rol cromático: 'primary' | 'secondary' | 'accent' | 'ambient'
 */
export function selectColorRoleFromZone(
  zoneId: string,
): 'primary' | 'secondary' | 'accent' | 'ambient' {
  switch (normalizeZoneId(zoneId)) {
    case 'front-left':
    case 'front-right':
    case 'front':
      return 'primary'
    case 'back-left':
    case 'back-right':
    case 'back':
    case 'left':
    case 'right':
      return 'secondary'
    case 'movers-left':
    case 'movers-right':
      return 'accent'
    case 'ambient':
    case 'air':
    case 'floor':
    default:
      return 'ambient'
  }
}
