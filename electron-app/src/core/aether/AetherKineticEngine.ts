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

/**
 * WAVE 4713 — Rango de frecuencia [0,1] → Hz.
 *
 * Cap absoluto en 2.0 Hz: por encima, el muestreo a 44 Hz produce aliasing
 * temporal (efecto rueda de carreta — el patrón parece girar al revés o
 * detenerse). Bajo este límite las cabezas siguen el patrón fielmente.
 */
const SPEED_MIN_HZ = 0.02  // 1 ciclo cada 50 s (ambiente glacial)
const SPEED_MAX_HZ = 0.60  // 1 ciclo cada ~1.7 s — headroom restaurado (SAFETY_CAP 400 aguanta)

/**
 * 🔥 WAVE 4731 FIX GEOMÉTRICO — PAN ASPECT RATIO.
 *
 * Pan range típico = 540°, Tilt range típico = 270° → ratio 2:1.
 * Sin corrección, un "circle" en espacio DMX normalizado [0,1] produce una
 * elipse 2× más ancha en Pan que en Tilt (porque 1 unidad DMX de Pan = 2.12°
 * pero 1 unidad DMX de Tilt = 1.06°).
 *
 * Multiplicando X por 0.5 igualamos la excursión angular: ambos ejes barren
 * la misma cantidad de grados → circle = circle REAL en el espacio físico.
 *
 * NOTA: Este factor se aplica en tick(), NO en las funciones de patrón.
 * Las funciones de patrón emiten [-1,1] simétrico puro.
 */
const PAN_ASPECT_RATIO = 0.5  // 270° / 540° = 0.5

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WAVE 4713 — Diccionario de patrones ALINEADO con `PatternArsenal.tsx`.
 * Las keys del motor son idénticas a las de la UI. Cero traducciones.
 *
 * `'static'` se incluye como guardia defensiva: el flujo normal lo intercepta
 * en el IPC handler (lo deriva a `removeNodes`), pero si por alguna razón
 * llegara aquí, su PATTERN_FN devuelve {0,0} → la cabeza permanece en su ancla.
 */
export type NativeKineticPattern =
  | 'static'
  | 'circle'
  | 'eight'
  | 'sweep'
  | 'darkspin'
  | 'bounce'
  | 'butterfly'
  | 'pulse'

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
// PATRONES MATEMÁTICOS — WAVE 4713 BESPOKE (deterministas, sin alloc)
// ─────────────────────────────────────────────────────────────────────────────
//
// Macros de ESTADIO para programación manual L2. Cada función:
//   • Retorna (x, y) ∈ [-1, 1]² (envelope completo — la amplitud DMX se aplica
//     fuera, en `tick()`).
//   • NO incluye atenuaciones internas (el operador es dueño del rango).
//   • Es trigonometría pura: determinista, sin alloc, monotonic en `phase`.
//
// La salida cruda se convierte después así (en `tick()`):
//     panBase  = clamp01( anchorPan  + (x * amplitude) * 0.5 )
//     tiltBase = clamp01( anchorTilt + (y * amplitude) * 0.5 )
// → con amplitude=1 el patrón barre 100% del eje DMX (0..255) alrededor del
//   ancla. Equivalente exacto a "salida * amplitude * 127" en escala DMX.

type PatternFn = (phase: number) => PatternXY

const PATTERN_FNS: Record<NativeKineticPattern, PatternFn> = {

  // ── STATIC ─────────────────────────────────────────────────────────────
  // Guardia defensiva: si llega 'static' (no debería; el IPC lo intercepta),
  // la cabeza permanece exactamente en su ancla.
  static: (_p) => ({ x: 0, y: 0 }),

  // ── CIRCLE — Lissajous 1:1 con 90° de offset ───────────────────
  // Círculo trigonométrico perfecto. Radio constante = 1.
  // 🔥 WAVE 4731 FIX GEOMÉTRICO:
  //   ANTES: x * 0.5 pretendía corregir ratio Pan/Tilt (540°/270°).
  //   PERO: eso creaba asimetría en el clamp01 → cuando amplitude era alto,
  //   el eje Y (sin cap) clipea arriba/abajo generando "lóbulos" de 8.
  //   FIX: Pattern emite [-1,1] simétrico. La compensación angular se aplica
  //   FUERA (en tick() con PAN_ASPECT_RATIO) donde hay contexto de rango.
  circle: (p) => ({
    x: Math.sin(p),
    y: Math.cos(p),
  }),

  // ── EIGHT — Lissajous 1:2 canónico (infinito horizontal) ─────────────
  // Tumbado: x oscila a frecuencia base, y al doble → "∞" acostado.
  // WAVE 4740 — REVERT del cambio cos→sin de WAVE 4731:
  //   El cos(p) era una corrección FALSA. La causa real de los "4 pétalos"
  //   era el clipping en eje Y (scale 0.5 → tiltBase=0 y 1 a amplitude=1).
  //   Ese clipping se resuelve cambiando 0.5→0.45 en tick().
  //   La forma del eight (sin/sin) es idéntica en ambos (solo cambia fase
  //   inicial). Restoreamos sin(p) como Lissajous canónico.
  eight: (p) => ({
    x: Math.sin(p),
    y: Math.sin(p * 2),
  }),

  // ── SWEEP — Barrido horizontal puro ────────────────────────────────────
  // Senoidal acotada solo en X. Punta-a-punta del escenario.
  // No hay deriva en Y → la cabeza se queda en la altura del ancla.
  sweep: (p) => ({
    x: Math.sin(p),
    y: 0,
  }),

  // ── BOUNCE — Rebote parabólico (bote físico en Y) ──────────────────────
  // |sin(p)| genera "joroba" rectificada en [0,1]; remapeada a [-1,1]
  // simula el rebote de un balón.
  //
  // BUG 4720 CORREGIDO — x: sin(p*0.5)
  // Con phase ∈ [0, 2π), phase*0.5 ∈ [0, π) → sin siempre ≥ 0 →
  // x solo alcanzaba [0, 1], NUNCA el lado izquierdo [-1, 0].
  // Corrección: x = sin(p), período 2π → rango completo [-1, 1].
  //
  // Trayectoria final:
  //   p=0   → (0, 1)   top-centro
  //   p=π/2 → (1, -1)  right-bottom
  //   p=π   → (0, 1)   top-centro
  //   p=3π/2 → (-1,-1) left-bottom
  // = arco péndulo / pelota rebotando entre dos paredes bajo gravedad.
  bounce: (p) => ({
    x: Math.sin(p),
    y: 1 - 2 * Math.abs(Math.sin(p)),
  }),

  // ── BUTTERFLY — Lissajous 1:3 simétrico ────────────────────────────────
  // Patrón en cuatro pétalos cuadrados. La asimetría visual de 1:3
  // produce el efecto "alas batiendo" característico.
  butterfly: (p) => ({
    x: Math.sin(p),
    y: Math.cos(p * 3),
  }),

  // ── PULSE — Roseta r=cos(2θ) (cuatro pétalos pulsantes) ────────────────
  // Una rosa polar de 4 pétalos. El "latido" sale de que el radio
  // (cos(2p)) cae a 0 cuatro veces por ciclo y rebota agresivamente
  // hacia ±1 en los lóbulos. Puro y matemático — sin Math.random.
  pulse: (p) => {
    const r = Math.cos(p * 2)        // ∈ [-1, 1] — radio firmado
    return {
      x: r * Math.cos(p),
      y: r * Math.sin(p),
    }
  },

  // ── DARKSPIN — Epitrocoide (círculo con bucle interno) ─────────────────
  // Órbita base más una secundaria al triple de frecuencia → la cabeza
  // dibuja "loops" hacia el centro mientras gira. Espiral desfasada,
  // perfecta para climaxes oscuros.
  darkspin: (p) => {
    // Coeficientes dimensionados para que el envelope quede en [-1, 1].
    const k = 0.75
    return {
      x: k * Math.sin(p) - (1 - k) * Math.sin(p * 3),
      y: k * Math.cos(p) - (1 - k) * Math.cos(p * 3),
    }
  },
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

  /**
   * 🔥 WAVE 4731 PASO 3: Grand Master Speed multiplicador para L2.
   * Escala la frecuencia del motor L2 igual que globalSpeedMultiplier escala L0.
   * Default 1.0 = sin escala. Rango [0.1, 2.0].
   * Seteado desde AetherIPCHandlers vía setGrandMasterSpeed.
   */
  private _gmSpeed: number = 1.0

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
    // Asigna/actualiza ÚNICAMENTE la pista de los nodeIds recibidos.
    // Los demás nodos del Map NO se tocan: siguen ejecutando su patrón propio,
    // independientemente de la selección actual del operador.
    // La selección NO define la ejecución — es solo el scope del gesto.
    // Un nodo abandona el motor únicamente por removeNodes() o stop() explícito.
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
   * 🔥 WAVE 4731 PASO 3: Set Grand Master Speed para L2.
   * Permite que el fader físico de Speed Master altere L2 además de L0.
   * @param mult Multiplicador [0.1, 2.0]
   */
  setGrandMasterSpeed(mult: number): void {
    this._gmSpeed = mult < 0.1 ? 0.1 : mult > 2.0 ? 2.0 : mult
  }

  getGrandMasterSpeed(): number {
    return this._gmSpeed
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

      // ── WAVE 4713/4720 — FRECUENCIA ACOTADA ─────────────────────────────
      // freqHz ∈ [SPEED_MIN_HZ, SPEED_MAX_HZ].
      // SPEED_MAX_HZ = 0.35 → máximo físicamente alcanzable por hardware real.
      // A 0.35 Hz, amplitude=0.5: velocidad pico Pan ≈ 297°/s — dentro del rango
      // de la mayoría de moving heads (150-600°/s). Elimina el clipping de
      // velocidad que distorsionaba circle→8 y eight→doble-eight.
      const freqHz    = SPEED_MIN_HZ + cfg.speed * (SPEED_MAX_HZ - SPEED_MIN_HZ)
      // 🔥 WAVE 4731 PASO 3: GM escala la frecuencia de L2 igual que L0.
      const dPhase    = freqHz * TWO_PI * dtSeconds * this._gmSpeed

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

      // ── WAVE 4713 — AMPLITUDE BOOST + CLAMP DE SEGURIDAD ─────────────────
      // El factor 0.5 mapea el envelope nativo [-1,1] al rango DMX completo:
      //   amplitude=1 ⇒ excursión nominal de ±0.5 sobre el ancla en escala
      //   normalizada [0,1], i.e. ±127 en DMX 0-255 → barrido punta-a-punta.
      // El clamp01 garantiza que NUNCA escribimos fuera de [0, 1] (≡ DMX
      // [0, 255] tras la curva de transferencia del NodeResolver).
      //
      // ── WAVE 4740 — SCALE 0.5 → 0.45 (EL FIX GEOMÉTRICO REAL) ──────────────
      // L a causa de "circle→8" y "eight→4 pétalos" era clipping en eje Y:
      //   Con factor 0.5 y amplitude=1, scaledY max = 0.5 → tiltBase toca
      //   exactamente 0.0 y 1.0 (límites del clamp). Con ancla ≠ 0.5 se sale.
      //   Los segmentos planos del clip visual = figura-8 / pétalo.
      //
      // Con 0.45: tiltBase ∈ [0.05, 0.95] → margen de 5% en cada extremo.
      //   PAN_ASPECT_RATIO mantiene paridad angular:
      //   Pan: ±(0.5 × 0.45) × 540° = ±121° | Tilt: ±0.45 × 270° = ±121° ✓
      //   → Círculo real en espacio físico. Sin deformación. Sin clipping.
      const scaledX = x * PAN_ASPECT_RATIO * cfg.amplitude * 0.45
      const scaledY = y * cfg.amplitude * 0.45

      // WAVE 4718 — ANCHOR DEL RADAR: lectura por nodo del override L2.
      const l2 = arbiter.getManualOverride(nodeId)
      const anchorPan  = (l2 && Number.isFinite(l2['pan_base']))  ? l2['pan_base']  : 0.5
      const anchorTilt = (l2 && Number.isFinite(l2['tilt_base'])) ? l2['tilt_base'] : 0.5

      const panBase  = clamp01(anchorPan  + scaledX)
      const tiltBase = clamp01(anchorTilt + scaledY)

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
