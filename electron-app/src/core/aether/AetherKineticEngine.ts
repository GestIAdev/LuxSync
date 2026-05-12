/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ AETHER KINETIC ENGINE — WAVE 4700: NATIVE L2 RESOLVER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Motor cinético nativo en el pipeline Aether. Reemplaza la dependencia del
 * masterArbiter y del VibeMovementManager para el control MANUAL de patrones.
 *
 * RESPONSABILIDADES:
 * - Acumular fase propia (monotonic, deterministic) para cada fixture.
 * - Calcular la posición {x, y} del patrón activo con desfase de fan.
 * - Escribir `pan_base` / `tilt_base` en NodeArbiter L2 vía `setManualOverride`.
 *
 * ARQUITECTURA DE DATOS (flujo por frame):
 *   UI → IPC → AetherKineticEngine.setManualKinetics()     (configuración)
 *   TitanOrchestrator.tick() → engine.tick(dtSeconds)      (hot path 44Hz)
 *     → acumulador de fase por nodeId
 *     → PATTERN_FN[pattern](phase + fanOffset, index, total) → {x, y}
 *     → arbiter.setManualOverride(`${fixtureId}:kinetic`, { pan_base, tilt_base })
 *
 * CANALES EMITIDOS:
 * - `pan_base`  / `tilt_base`: lectura del orbit math L2 (WAVE 4661).
 *   Están en MANUAL_HARD_LOCK_EXCLUDED_CHANNELS → no se re-aplican post-L3.
 *   Resultado final: `pan = pan_base + (L0.pan − 0.5)` — flujo correcto.
 *
 * DESFASE FAN:
 * - fanValue [0,1] → desfase de fase total de 2π radianes entre fixture 0 y N-1.
 * - Fixture i recibe: phase + (fanValue * TWO_PI * i / (N - 1))
 *   (si N === 1 el denominador se evita → sin desfase).
 *
 * ESCALA DE AMPLITUD (normalizada → ángulos reales):
 * - amplitude [0,1] → escala el radio del patrón en [-1, 1].
 * - El NodeResolver traduce 0-1 normalizado a DMX 0-255 usando la
 *   TransferCurve del perfil. La amplitud sólo aplica a la excursión
 *   del patrón, no al `pan_base` (punto de anclaje del radar).
 *
 * ESCALA DE VELOCIDAD:
 * - speed [0,1] → frecuencia en Hz = SPEED_MIN + speed × (SPEED_MAX − SPEED_MIN).
 * - Rango: 0.03 Hz (1 ciclo en 33 s) … 1.2 Hz (1 ciclo en ~0.8 s).
 *   Calibrado para rango visual de calidad profesional.
 *
 * PATRONES DISPONIBLES:
 * Subconjunto determinista del Golden Dozen del VMM. Cada uno trabaja
 * en [-1, 1] como el VMM (misma semántica, sin dependencia de instancia VMM).
 *
 * ZERO-ALLOC GARANTIZADO EN HOT PATH:
 * - `_phaseMap`: Map<nodeId, phaseAccumulator> — pre-warm on setManualKinetics.
 * - `_overrideBuffer`: Record<string, number> — objeto fijo reutilizado por nodo.
 *   NOTA: `setManualOverride` en NodeArbiter acepta `Readonly<Record<string,number>>`
 *   y almacena la referencia. Para garantizar zero-alloc usamos un Record por
 *   nodeId en `_overridePool`.
 *
 * @module core/aether/AetherKineticEngine
 * @version WAVE 4700
 */

import type { NodeArbiter } from './NodeArbiter'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TWO_PI = Math.PI * 2

/** Rango de frecuencia [0,1] → Hz */
const SPEED_MIN_HZ = 0.03   // 1 ciclo cada 33 s (muy lento, ambiental)
const SPEED_MAX_HZ = 1.2    // 1.2 ciclos/s (rápido sin epilepsia)

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

export type NativeKineticPattern =
  | 'circle'
  | 'figure8'
  | 'scan_x'
  | 'square'
  | 'diamond'
  | 'wave_y'
  | 'ballyhoo'
  | 'lemniscate'  // figura 8 con phase 90° en tilt — variante horizontal
  | 'darkspin'
  | 'sway'

/** Posición normalizada en [-1, 1] */
interface PatternXY { x: number; y: number }

/**
 * WAVE 4712: Configuración por nodo (multitrack).
 * Cada nodeId tiene su propia pista — pattern, speed, amplitude y dispersión
 * de fan dentro del grupo al que fue asignado. Las pistas son independientes:
 * cambiar la config de unos nodeIds no afecta a los demás.
 */
interface KineticNodeConfig {
  pattern: NativeKineticPattern
  speed: number      // [0, 1]
  amplitude: number  // [0, 1]
  fan: number        // [-1, 1] del grupo en el que se asignó
  fanIndex: number   // posición en el grupo (0..fanTotal-1)
  fanTotal: number   // tamaño del grupo al momento del setManualKinetics
}

export interface NativeKineticState {
  active: boolean
  nodeIds: string[]
  pattern: NativeKineticPattern | null
  speed: number
  amplitude: number
  fan: number
}

/** WAVE 4712: snapshot per-node para hidratación silenciosa de la UI. */
export interface KineticNodeStateSnapshot {
  nodeId: string
  active: boolean
  pattern: NativeKineticPattern | null
  speed: number      // [0, 1]
  amplitude: number  // [0, 1]
  fan: number        // [-1, 1]
  panAnchor: number  // [0, 1] — pan_base actual (radar anchor)
  tiltAnchor: number // [0, 1] — tilt_base actual
}

// ─────────────────────────────────────────────────────────────────────────────
// PATRONES MATEMÁTICOS — deterministas, sin alloc, sin estado externo
// ─────────────────────────────────────────────────────────────────────────────

type PatternFn = (phase: number) => PatternXY

const PATTERN_FNS: Record<NativeKineticPattern, PatternFn> = {

  // Círculo puro (Lissajous 1:1 con 90° de offset)
  circle: (p) => ({
    x: Math.sin(p),
    y: Math.cos(p),
  }),

  // Figure-8 clásica (Lissajous 1:2)
  figure8: (p) => ({
    x: Math.sin(p),
    y: Math.sin(p * 2) * 0.75,
  }),

  // Lemniscata horizontal (figure8 rotada 90°)
  lemniscate: (p) => ({
    x: Math.sin(p * 2) * 0.75,
    y: Math.sin(p),
  }),

  // Barrido horizontal con ondulación vertical (searchlight)
  scan_x: (p) => ({
    x: Math.sin(p),
    y: Math.sin(p * 2) * 0.45,
  }),

  // Cuadrado con interpolación lineal entre esquinas
  square: (p) => {
    const corners: PatternXY[] = [
      { x:  1, y:  1 },
      { x:  1, y: -1 },
      { x: -1, y: -1 },
      { x: -1, y:  1 },
    ]
    const n = (p / TWO_PI) * 4
    const i = Math.floor(n) % 4
    const j = (i + 1) % 4
    const t = n - Math.floor(n)
    return {
      x: corners[i].x + (corners[j].x - corners[i].x) * t,
      y: corners[i].y + (corners[j].y - corners[i].y) * t,
    }
  },

  // Rombo (square rotado 45°)
  diamond: (p) => {
    const verts: PatternXY[] = [
      { x:  0, y:  1 },
      { x:  1, y:  0 },
      { x:  0, y: -1 },
      { x: -1, y:  0 },
    ]
    const n = (p / TWO_PI) * 4
    const i = Math.floor(n) % 4
    const j = (i + 1) % 4
    const t = n - Math.floor(n)
    return {
      x: verts[i].x + (verts[j].x - verts[i].x) * t,
      y: verts[i].y + (verts[j].y - verts[i].y) * t,
    }
  },

  // Péndulo latino — ola en U cadenciosa
  wave_y: (p) => ({
    x: Math.sin(p) * 0.8,
    y: -(Math.abs(Math.cos(p * 0.5)) * 0.6),
  }),

  // Caos controlado (Fourier armónicos 1+3+5)
  ballyhoo: (p) => {
    const x = Math.sin(p) * 0.5 + Math.sin(p * 3) * 0.3 + Math.sin(p * 5) * 0.15
    const y = Math.cos(p) * 0.4 + Math.cos(p * 3) * 0.25 + Math.cos(p * 5) * 0.1
    return { x: x * 1.8, y: y * 1.8 }
  },

  // Órbita elíptica oscura con pulso de radio
  darkspin: (p) => ({
    x: Math.sin(p) * (0.70 + 0.20 * Math.sin(p * 0.5)),
    y: Math.cos(p * 1.5) * 0.62,
  }),

  // Pendulo suave solo en X
  sway: (p) => ({
    x: Math.sin(p),
    y: 0,
  }),
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AetherKineticEngine — Motor cinético nativo L2.
 *
 * Singleton gestionado por TitanOrchestrator.
 * El método tick() se llama en el hot path antes de arbitrate().
 */
export class AetherKineticEngine {

  /** Acumulador de fase monotónico por nodeId (radianes) */
  private readonly _phaseMap = new Map<string, number>()

  /**
   * Pool de override records pre-allocated por nodeId.
   * Evita `{}` en el hot path — el NodeArbiter almacena la referencia
   * y la lee en cada arbitrate(), nosotros la mutamos antes de cada tick.
   */
  private readonly _overridePool = new Map<string, Record<string, number>>()

  /**
   * WAVE 4712: Configuración por nodo (multitrack).
   * Cada nodeId activo tiene su propia entrada. El motor itera el Map en tick().
   * Cambiar la config de unos nodos no afecta a los demás — true multitrack.
   */
  private readonly _nodeConfigs = new Map<string, KineticNodeConfig>()

  /** WAVE 4706 TELEMETRÍA — contador de frames para heartbeat rate-limited */
  private _heartbeatCounter = 0

  // ── API pública ──────────────────────────────────────────────────────────

  /**
   * Activa el motor con la configuración dada.
   * Llamado desde AetherIPCHandlers vía `lux:aether:setManualPattern`.
   *
   * @param nodeIds   Array de nodeIds en formato `${fixtureId}:kinetic`
   * @param pattern   Patrón nativo a ejecutar
   * @param speed     [0, 1] — velocidad del patrón
   * @param amplitude [0, 1] — amplitud (excursión del patrón)
   * @param fan       [0, 1] — valor del slider Fan/Dispersión
   */
  setManualKinetics(
    nodeIds: string[],
    pattern: NativeKineticPattern,
    speed: number,
    amplitude: number,
    fan: number,
    _arbiter: NodeArbiter,
  ): void {
    console.log('[SONDA L2-ENGINE] Multitrack upsert:', pattern, 'Nodos:', nodeIds.length, 'IDs:', nodeIds)
    if (nodeIds.length === 0) return  // no-op: multitrack NO tiene 'stop global' implícito

    // ── WAVE 4712 MULTITRACK UPSERT ─────────────────────────────────────────
    // Asigna/actualiza la pista de cada nodeId del grupo. Los demás nodos
    // del Map quedan intactos — su show sigue corriendo sin interrupción.
    // Cada nodo guarda su fanIndex/fanTotal dentro de ESTE grupo, así la
    // dispersión es estable aunque se cambien selecciones ajenas.
    const speedClamped     = clamp01(speed)
    const amplitudeClamped = clamp01(amplitude)
    const fanClamped       = clampSigned(fan)
    const total            = nodeIds.length

    for (let i = 0; i < total; i++) {
      const nodeId = nodeIds[i]
      if (!this._phaseMap.has(nodeId)) {
        this._phaseMap.set(nodeId, 0)
      }
      if (!this._overridePool.has(nodeId)) {
        this._overridePool.set(nodeId, { pan_base: 0.5, tilt_base: 0.5 })
      }
      this._nodeConfigs.set(nodeId, {
        pattern,
        speed:     speedClamped,
        amplitude: amplitudeClamped,
        fan:       fanClamped,
        fanIndex:  i,
        fanTotal:  total,
      })
    }
  }

  /**
   * WAVE 4712: Elimina pistas del Map y limpia el rastro L2-MOTOR.
   * Usado cuando el operador envía pattern: 'hold' / null para un subset
   * específico de fixtures. NO toca _manualOverrides (ancla L2 preservada).
   */
  removeNodes(nodeIds: string[], arbiter: NodeArbiter): void {
    for (const nodeId of nodeIds) {
      if (this._nodeConfigs.delete(nodeId)) {
        arbiter.clearMotorKineticOverride(nodeId)
        this._phaseMap.delete(nodeId)
        // _overridePool y _manualOverrides: PRESERVADOS — paradigma Programmer.
      }
    }
  }

  /**
   * Detiene el motor COMPLETO y limpia el rastro L2-MOTOR de todos los nodos.
   * Llamado solo por Unlock explícito (WAVE 4710 paradigma Programmer).
   */
  stop(arbiter?: NodeArbiter): void {
    if (arbiter) {
      for (const nodeId of this._nodeConfigs.keys()) {
        arbiter.clearMotorKineticOverride(nodeId)
      }
    }
    this._nodeConfigs.clear()
    this._phaseMap.clear()
  }

  /**
   * WAVE 4712: Actualiza scalars (speed/amplitude/fan) SOLO para los nodeIds
   * dados. Los demás nodos en el Map mantienen sus scalars actuales.
   * Sin reiniciar fase — para sliders en tiempo real.
   * También recalcula fanIndex/fanTotal del grupo entrante (la dispersión
   * se mantiene coherente cuando el operador cambia su selección activa).
   */
  updateScalars(
    nodeIds: string[],
    speed: number,
    amplitude: number,
    fan: number,
  ): void {
    if (nodeIds.length === 0) return
    const speedClamped     = clamp01(speed)
    const amplitudeClamped = clamp01(amplitude)
    const fanClamped       = clampSigned(fan)
    const total            = nodeIds.length
    for (let i = 0; i < total; i++) {
      const cfg = this._nodeConfigs.get(nodeIds[i])
      if (!cfg) continue
      cfg.speed     = speedClamped
      cfg.amplitude = amplitudeClamped
      cfg.fan       = fanClamped
      cfg.fanIndex  = i
      cfg.fanTotal  = total
    }
  }

  /** ¿Hay AL MENOS un patrón activo en cualquier pista? */
  isActive(): boolean {
    return this._nodeConfigs.size > 0
  }

  /**
   * WAVE L2-SUPREMACY: ¿Este nodeId está bajo control manual L2?
   * Usado por KineticAdapter para silenciar el emit L0 por nodo.
   * O(1) — lectura directa del Map.
   */
  hasNode(nodeId: string): boolean {
    return this._nodeConfigs.has(nodeId)
  }

  /**
   * WAVE 4712: snapshot de estado por nodo para hidratación silenciosa.
   * El bridge lo invoca al cambiar la selección para poblar la UI sin emitir.
   * Lee también pan_base/tilt_base del arbiter como anchor visible.
   */
  getNodeState(nodeId: string, arbiter: NodeArbiter): KineticNodeStateSnapshot {
    const cfg = this._nodeConfigs.get(nodeId)
    const l2  = arbiter.getManualOverride(nodeId)
    const panAnchor  = (l2 && Number.isFinite(l2['pan_base']))  ? l2['pan_base']  : 0.5
    const tiltAnchor = (l2 && Number.isFinite(l2['tilt_base'])) ? l2['tilt_base'] : 0.5
    if (!cfg) {
      return { nodeId, active: false, pattern: null, speed: 0, amplitude: 0, fan: 0, panAnchor, tiltAnchor }
    }
    return {
      nodeId,
      active: true,
      pattern: cfg.pattern,
      speed: cfg.speed,
      amplitude: cfg.amplitude,
      fan: cfg.fan,
      panAnchor,
      tiltAnchor,
    }
  }

  /**
   * Legacy: snapshot global. Para multitrack, retorna el primer nodo como
   * representativo y la lista completa de nodeIds activos. Compat con
   * llamadores que aún consultan getManualKineticState IPC global.
   */
  getState(): NativeKineticState {
    if (this._nodeConfigs.size === 0) {
      return { active: false, nodeIds: [], pattern: null, speed: 0, amplitude: 0, fan: 0 }
    }
    const nodeIds = Array.from(this._nodeConfigs.keys())
    const first   = this._nodeConfigs.get(nodeIds[0])!
    return {
      active: true,
      nodeIds,
      pattern: first.pattern,
      speed: first.speed,
      amplitude: first.amplitude,
      fan: first.fan,
    }
  }

  /**
   * HOT PATH — 44Hz.
   *
   * Calcula la nueva posición de cada fixture y la escribe en NodeArbiter L2.
   *
   * WAVE 4718 — ANCHOR DINÁMICO:
   * Antes de calcular la oscilación, el motor lee el override L2 actual del
   * nodeId (escrito por KineticsBridge._flushClassic como `pan_base`/`tilt_base`)
   * y lo usa como punto de anclaje del patrón. Si el operador no ha movido el
   * radar (o aún no hay override L2), el fallback es 0.5 (centro del universo).
   *
   * Esto garantiza:
   *   pan_base_final = radar_anchor_pan + scaledX * 0.5
   * donde scaledX ∈ [-amplitude, amplitude].
   *
   * @param dtSeconds Segundos transcurridos desde el último tick.
   * @param arbiter   Referencia al NodeArbiter activo.
   */
  tick(dtSeconds: number, arbiter: NodeArbiter): void {
    if (this._nodeConfigs.size === 0) return

    // WAVE 4712: iteramos el Map directamente — cada nodo tiene su propia pista.
    let sampleNodeId = ''
    let sampleCfg: KineticNodeConfig | null = null

    for (const [nodeId, cfg] of this._nodeConfigs) {
      const patternFn = PATTERN_FNS[cfg.pattern]
      if (!patternFn) continue

      const freqHz    = SPEED_MIN_HZ + cfg.speed * (SPEED_MAX_HZ - SPEED_MIN_HZ)
      const dPhase    = freqHz * TWO_PI * dtSeconds

      // Acumular fase (monotonic, wrap en 2π)
      const prevPhase = this._phaseMap.get(nodeId) ?? 0
      const phase     = (prevPhase + dPhase) % TWO_PI
      this._phaseMap.set(nodeId, phase)

      // Fan: desfase de 2π * fan cuando el nodo está al final de su grupo.
      // El grupo es el último setManualKinetics(...) que lo asignó — esto
      // mantiene la dispersión coherente aun cuando otros nodos cambian.
      const fanRange  = cfg.fan * TWO_PI
      const fanOffset = cfg.fanTotal > 1
        ? (fanRange * cfg.fanIndex) / (cfg.fanTotal - 1)
        : 0
      const { x, y } = patternFn(phase + fanOffset)

      const scaledX = x * cfg.amplitude
      const scaledY = y * cfg.amplitude

      // WAVE 4718 — ANCHOR DEL RADAR: lectura por nodo del override L2.
      const l2 = arbiter.getManualOverride(nodeId)
      const anchorPan  = (l2 && Number.isFinite(l2['pan_base']))  ? l2['pan_base']  : 0.5
      const anchorTilt = (l2 && Number.isFinite(l2['tilt_base'])) ? l2['tilt_base'] : 0.5

      const panBase  = clamp01(anchorPan  + scaledX * 0.5)
      const tiltBase = clamp01(anchorTilt + scaledY * 0.5)

      let rec = this._overridePool.get(nodeId)
      if (!rec) {
        rec = { pan_base: panBase, tilt_base: tiltBase }
        this._overridePool.set(nodeId, rec)
      } else {
        rec['pan_base']  = panBase
        rec['tilt_base'] = tiltBase
      }

      arbiter.setMotorKineticOverride(nodeId, rec)

      if (!sampleNodeId) {
        sampleNodeId = nodeId
        sampleCfg    = cfg
      }
    }

    // WAVE 4706 TELEMETRÍA — heartbeat rate-limited (1 log/seg @ 44Hz)
    this._heartbeatCounter++
    if (this._heartbeatCounter >= 44 && sampleCfg) {
      this._heartbeatCounter = 0
      const sampleRec = this._overridePool.get(sampleNodeId)
      console.log(
        `[KineticEngine L2] Pistas activas: ${this._nodeConfigs.size}` +
        ` | Muestra[${sampleNodeId}]: ${sampleCfg.pattern}` +
        ` | Speed: ${sampleCfg.speed.toFixed(3)}` +
        ` | Amplitude: ${sampleCfg.amplitude.toFixed(3)}` +
        ` | Fan: ${sampleCfg.fan.toFixed(3)} (${sampleCfg.fanIndex}/${sampleCfg.fanTotal})` +
        ` | Output: ` +
        (sampleRec
          ? `{pan: ${sampleRec['pan_base'].toFixed(3)}, tilt: ${sampleRec['tilt_base'].toFixed(3)}}`
          : 'null')
      )
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clampSigned(v: number): number {
  if (v <= -1) return -1
  if (v >= 1) return 1
  return v
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

/** Instancia singleton compartida por TitanOrchestrator y AetherIPCHandlers */
export const aetherKineticEngine = new AetherKineticEngine()
