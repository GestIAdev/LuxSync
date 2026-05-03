/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚙️  AETHER MATRIX — PHYSICS POST-PROCESSOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4518.1 — THE INERTIA ENGINE
 *
 * Procesa el ArbitratedNodeMap post-arbitración, pre-resolución.
 * Solo actúa sobre nodos KINETIC — el resto pasa transparente.
 *
 * POSICIÓN EN EL PIPELINE:
 *   IntentBus → NodeArbiter → [PhysicsPostProcessor] → NodeResolver
 *
 * RESPONSABILIDAD:
 * El NodeArbiter produce posiciones target instantáneas (0-1).
 * Este módulo aplica un modelo de inercia física realista:
 *   - Modo CLASSIC: rampa suave con aceleración/deceleración.
 *   - Modo SNAP:    seguimiento rápido con factor de porcentaje.
 * Ambos respetan los límites de velocidad máxima del motor.
 *
 * LA CLÁUSULA WOODSTOCK (Precisión Temporal):
 * PROHIBIDO usar Date.now(). El deltaMs llega del FrameScheduler
 * basado en performance.now(). Esta ley existe porque 1ms de
 * baja resolución temporal puede convertir una aceleración fluida
 * en un parón de hardware (división por cero o velocidad 0).
 *
 * ZERO-ALLOC HOT PATH:
 * - Estado por nodo en Float32Arrays pre-allocated.
 * - Sin new Map(), new Array(), ni spread operators en process().
 * - Los Records del ArbitratedNodeMap se mutan in-place (son mutables
 *   en runtime aunque el tipo diga Readonly<> — el Arbiter los produce
 *   como objetos planos y solo los castea a ReadonlyMap para el contrato).
 *
 * @module core/aether/resolver/PhysicsPostProcessor
 * @version WAVE 4518.1
 */

import type { NodeId }             from '../types'
import { NodeFamily }              from '../types'
import type { IKineticNodeData }   from '../capability-node'
import type { ArbitratedNodeMap }  from '../intent-bus'
import type { INodeGraph }         from '../node-graph'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — Seguridad mecánica
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tiempo delta máximo en ms antes de activar TELEPORT MODE.
 * Si el frame jump supera este umbral, asumimos que el motor
 * estuvo congelado (sleep, tab background) y saltamos directo al target.
 * Idéntico al comportamiento del FixturePhysicsDriver legacy.
 */
const TELEPORT_THRESHOLD_MS = 200

/**
 * Anti-jitter threshold (unidades normalizadas 0-1).
 * Deltas por debajo de este valor se ignoran para evitar ruido en motores
 * con tremor eléctrico. Equivalente al 3% de la velocidad máxima
 * en el FixturePhysicsDriver — aquí lo expresamos en espacio normalizado.
 */
const JITTER_THRESHOLD = 0.0005

/**
 * Factor de conversión: grados/segundo → unidades normalizadas/segundo.
 * Los motores pan/tilt tienen un rango físico de 540° → 1.0 normalizado.
 */
const DEG_PER_SEC_TO_NORM_PER_SEC = 1 / 540

/**
 * Aceleración máxima de seguridad en espacio normalizado/s².
 * Equivale al SAFETY_CAP del FixturePhysicsDriver (900 DMX/s² ≈ 900/255/540 norm/s²).
 * Usamos el tope físico más agresivo permitido.
 */
const SAFETY_MAX_ACCELERATION_NORM = 900 / 255 / 540  // ≈ 0.00654 norm/s²

/**
 * Velocidad máxima de seguridad en espacio normalizado/s.
 * Equivale a 400 DMX/s → 400/255/540 ≈ 0.00291 norm/s.
 */
const SAFETY_MAX_VELOCITY_NORM = 400 / 255 / 540  // ≈ 0.00291 norm/s

// ── WAVE 4523.5: Constantes para inercia espacial 3D ──────────────────
/**
 * Conversión deg/s → m/s para el espacio 3D del escenario.
 * Calibrado para un escenario de 8m: a 270 deg/s → ~4 m/s de barrido lateral.
 */
const DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270
/** Velocidad máxima de seguridad en espacio métrico [m/s] */
const SAFETY_MAX_3D_VEL_MS  = 5.0
/** Aceleración máxima de seguridad en espacio métrico [m/s²] */
const SAFETY_MAX_3D_ACC_MS2 = 20.0
/** Posición 3D inicial X por defecto — centro del escenario [m] */
const DEFAULT_3D_X = 0.0
/** Posición 3D inicial Y por defecto — altura de trabajo [m] */
const DEFAULT_3D_Y = 1.5
/** Posición 3D inicial Z por defecto — profundidad nominal [m] */
const DEFAULT_3D_Z = 2.0

// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS MODE
// ═══════════════════════════════════════════════════════════════════════════

/** Modos de inercia del motor — replicados del FixturePhysicsDriver. */
export type PhysicsMode = 'snap' | 'classic'

// ═══════════════════════════════════════════════════════════════════════════
// IINTERFACE — Contrato público (Blueprint 3506 §2.6)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * IPhysicsPostProcessor — El Inertia Engine para nodos KINETIC.
 *
 * Se ubica entre el NodeArbiter y el NodeResolver en el pipeline:
 *
 * ```
 * arbitrated = arbiter.arbitrate()
 * physicsPostProcessor.process(arbitrated, nodeGraph, deltaMs, vibeId)
 * resolver.resolve(arbitrated)
 * ```
 *
 * Muta in-place los valores `pan` y `tilt` en el ArbitratedNodeMap
 * para suavizar la posición target con física de inercia real.
 */
export interface IPhysicsPostProcessor {
  /**
   * Procesa el ArbitratedNodeMap in-place, aplicando inercia
   * a los canales pan/tilt de nodos KINETIC.
   *
   * @param arbitrated — Mapa de intents arbitrados (se muta in-place en pan/tilt)
   * @param nodeGraph  — Para obtener datos del nodo (maxPanSpeed, maxTiltSpeed, family)
   * @param deltaMs    — Delta temporal del frame (performance.now()-based, NUNCA Date.now())
   * @param vibeId     — ID del vibe activo (para future REV_LIMIT lookup por género)
   */
  process(
    arbitrated: ArbitratedNodeMap,
    nodeGraph: INodeGraph,
    deltaMs: number,
    vibeId: string,
  ): void

  /**
   * Registra un nodo KINETIC para tracking de inercia en patch time.
   * Pre-aloca el estado de física (posición, velocidad) para este nodo.
   * Llamar cuando NodeGraph.registerDevice() agrega un nodo KINETIC.
   *
   * @param nodeId — ID del nodo recién registrado
   */
  registerNode(nodeId: NodeId): void

  /**
   * Limpia la velocidad residual cuando cambia el vibe activo.
   * Evita que la inercia acumulada de un vibe rápido (Techno)
   * persista al cambiar a uno lento (Ambient), causando overshoots.
   *
   * @param newVibeId — ID del nuevo vibe (para future presets por género)
   */
  onVibeChange(newVibeId: string): void

  /**
   * Configura el modo de física global.
   * SNAP:    seguimiento rápido con snapFactor (0-1).
   * CLASSIC: rampa suave con física de aceleración/frenado.
   */
  setPhysicsMode(mode: PhysicsMode, snapFactor?: number): void
}

// ═══════════════════════════════════════════════════════════════════════════
// SLOT INDICES — Para los Float32Arrays de estado
// ═══════════════════════════════════════════════════════════════════════════

/** Posición actual de pan [0-1] */
const SLOT_PAN_POS = 0
/** Posición actual de tilt [0-1] */
const SLOT_TILT_POS = 1
/** Velocidad actual de pan [norm/s] */
const SLOT_PAN_VEL = 2
/** Velocidad actual de tilt [norm/s] */
const SLOT_TILT_VEL = 3
// ── WAVE 4523.5: Slots para inercia espacial 3D ──────────────────────
/** Posición actual X en escenario [metros] */
const SLOT_X3D_POS = 4
/** Posición actual Y en escenario [metros] */
const SLOT_Y3D_POS = 5
/** Posición actual Z en escenario [metros] */
const SLOT_Z3D_POS = 6
/** Velocidad actual X [m/s] */
const SLOT_X3D_VEL = 7
/** Velocidad actual Y [m/s] */
const SLOT_Y3D_VEL = 8
/** Velocidad actual Z [m/s] */
const SLOT_Z3D_VEL = 9
/** Tamaño del buffer de estado por nodo (4 legacy pan/tilt + 6 3D spatial) */
const STATE_SLOTS = 10

// ═══════════════════════════════════════════════════════════════════════════
// IMPLEMENTACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PhysicsPostProcessor — Implementación concreta del IPhysicsPostProcessor.
 *
 * Diseñado para 0 allocations en el hot path (44Hz).
 *
 * ESTADO INTERNO:
 * - `_states`: Map<NodeId, Float32Array> — buffer de 4 floats (panPos, tiltPos, panVel, tiltVel)
 *   pre-alocado en registerNode(). En el hot path solo se leen/escriben índices en arrays existentes.
 *
 * MODO CLASSIC (curva-S):
 * - Si la distancia al target supera la distancia de frenado, acelera.
 * - Si está dentro de la distancia de frenado, desacelera.
 * - Clampeado por velocidad máxima del motor (convertida a norm/s).
 * - Anti-jitter: deltas < JITTER_THRESHOLD ignorados.
 *
 * MODO SNAP (fracción de delta):
 * - Mueve snapFactor * (target - current) por frame.
 * - Clampeado por un REV_LIMIT por frame.
 * - Más simple y predecible para géneros electrónicos.
 */
export class PhysicsPostProcessor implements IPhysicsPostProcessor {

  // ── Estado de inercia por nodo (patch-time allocated) ─────────────────
  private readonly _states = new Map<NodeId, Float32Array>()

  // ── Configuración de modo ──────────────────────────────────────────────
  private _mode: PhysicsMode = 'classic'
  private _snapFactor = 0.5

  // ── Variables temporales reutilizadas en el hot path (zero-alloc) ─────
  // NO son const porque se mutan en cada iteración del process()
  private _panTarget   = 0
  private _tiltTarget  = 0
  private _panDelta    = 0
  private _tiltDelta   = 0
  private _panVel      = 0
  private _tiltVel     = 0
  private _panPos      = 0
  private _tiltPos     = 0
  private _dt          = 0  // deltaMs convertido a segundos
  private _maxVelNorm  = 0  // velocidad máxima normalizada para este nodo
  private _maxAccNorm  = 0  // aceleración máxima normalizada para este nodo
  private _brakeDist   = 0  // distancia de frenado actual

  // ── WAVE 4523.5: Temporales para inercia espacial 3D (zero-alloc) ───
  private _x3dTarget   = 0
  private _y3dTarget   = 0
  private _z3dTarget   = 0
  private _maxVel3dMs  = 0
  private _maxAcc3dMs2 = 0

  // ═════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Procesa el ArbitratedNodeMap in-place.
   *
   * ESTRATEGIA DE ITERACIÓN:
   * En lugar de iterar todo el ArbitratedNodeMap buscando nodos KINETIC
   * (O(N) con lookup en NodeGraph por cada entry), iteramos el view KINETIC
   * del NodeGraph directamente — solo nodos que nos importan, zero-alloc.
   * Luego accedemos al entry del ArbitratedNodeMap por nodeId (O(1) Map.get).
   */
  process(
    arbitrated: ArbitratedNodeMap,
    nodeGraph: INodeGraph,
    deltaMs: number,
    _vibeId: string,
  ): void {

    // TELEPORT MODE: frame jump demasiado grande → skip physics, el motor
    // habría estado congelado de todos modos (background tab, sleep, etc.)
    if (deltaMs <= 0 || deltaMs > TELEPORT_THRESHOLD_MS) {
      if (deltaMs > TELEPORT_THRESHOLD_MS) {
        this._teleportAll(arbitrated, nodeGraph)
      }
      return
    }

    // Convertir delta a segundos — una sola vez por frame
    this._dt = deltaMs * 0.001

    const kineticView = nodeGraph.getView(NodeFamily.KINETIC)

    kineticView.forEach((node: IKineticNodeData) => {
      const entry = (arbitrated as Map<NodeId, Record<string, number>>).get(node.nodeId)
      if (entry === undefined) return  // nodo sin intent este frame → skip

      const state = this._states.get(node.nodeId)
      if (state === undefined) return  // nodo no registrado → skip (no debería ocurrir)

      // ── WAVE 4523.5: Inercia espacial 3D (canales targetX/Y/Z en metros) ──
      if (entry['targetX'] !== undefined) {
        const xT = entry['targetX']
        const yT = entry['targetY']
        const zT = entry['targetZ']
        this._x3dTarget = isFinite(xT)        ? xT                   : state[SLOT_X3D_POS]
        this._y3dTarget = isFinite(yT ?? NaN) ? (yT ?? DEFAULT_3D_Y) : state[SLOT_Y3D_POS]
        this._z3dTarget = isFinite(zT ?? NaN) ? (zT ?? DEFAULT_3D_Z) : state[SLOT_Z3D_POS]

        this._maxVel3dMs  = Math.min(node.maxPanSpeed * DEG_PER_SEC_TO_METERS_PER_SEC, SAFETY_MAX_3D_VEL_MS)
        this._maxAcc3dMs2 = Math.min(this._maxVel3dMs * 4, SAFETY_MAX_3D_ACC_MS2)

        if (this._mode === 'snap') {
          const maxMove = this._maxVel3dMs * this._dt
          const dxSnap  = this._snapFactor * (this._x3dTarget - state[SLOT_X3D_POS])
          const dySnap  = this._snapFactor * (this._y3dTarget - state[SLOT_Y3D_POS])
          const dzSnap  = this._snapFactor * (this._z3dTarget - state[SLOT_Z3D_POS])
          state[SLOT_X3D_POS] += clampAbs(Math.abs(dxSnap) < JITTER_THRESHOLD ? 0 : dxSnap, maxMove)
          state[SLOT_Y3D_POS] += clampAbs(Math.abs(dySnap) < JITTER_THRESHOLD ? 0 : dySnap, maxMove)
          state[SLOT_Z3D_POS] += clampAbs(Math.abs(dzSnap) < JITTER_THRESHOLD ? 0 : dzSnap, maxMove)
          state[SLOT_X3D_VEL] = 0
          state[SLOT_Y3D_VEL] = 0
          state[SLOT_Z3D_VEL] = 0
        } else {
          this._applyClassicAxis(state, SLOT_X3D_POS, SLOT_X3D_VEL, this._x3dTarget, this._maxVel3dMs, this._maxAcc3dMs2)
          this._applyClassicAxis(state, SLOT_Y3D_POS, SLOT_Y3D_VEL, this._y3dTarget, this._maxVel3dMs, this._maxAcc3dMs2)
          this._applyClassicAxis(state, SLOT_Z3D_POS, SLOT_Z3D_VEL, this._z3dTarget, this._maxVel3dMs, this._maxAcc3dMs2)
        }

        entry['targetX'] = state[SLOT_X3D_POS]
        entry['targetY'] = state[SLOT_Y3D_POS]
        entry['targetZ'] = state[SLOT_Z3D_POS]
        return  // nodo espacial procesado — skip flujo legacy pan/tilt
      }

      // Leer target del ArbitratedNodeMap
      this._panTarget  = entry['pan']  ?? 0.5
      this._tiltTarget = entry['tilt'] ?? 0.5

      // NaN guard — si el arbiter produce un NaN, mantener posición anterior
      if (!isFinite(this._panTarget))  this._panTarget  = state[SLOT_PAN_POS]
      if (!isFinite(this._tiltTarget)) this._tiltTarget = state[SLOT_TILT_POS]

      // Leer estado de inercia (posición y velocidad actuales)
      this._panPos  = state[SLOT_PAN_POS]
      this._tiltPos = state[SLOT_TILT_POS]
      this._panVel  = state[SLOT_PAN_VEL]
      this._tiltVel = state[SLOT_TILT_VEL]

      // Calcular límites del motor en espacio normalizado/s
      // maxPanSpeed y maxTiltSpeed están en grados/segundo
      // 540° → 1.0 normalizado
      this._maxVelNorm = Math.min(
        node.maxPanSpeed * DEG_PER_SEC_TO_NORM_PER_SEC,
        SAFETY_MAX_VELOCITY_NORM,
      )
      this._maxAccNorm = Math.min(
        // Usamos maxPanSpeed como proxy para aceleración si no hay dato explícito
        // (el FixturePhysicsDriver hace lo mismo con el physicsProfile)
        node.maxPanSpeed * DEG_PER_SEC_TO_NORM_PER_SEC * 4,
        SAFETY_MAX_ACCELERATION_NORM,
      )

      if (this._mode === 'snap') {
        this._applySnap(state)
      } else {
        this._applyClassic(state, node)
      }

      // Clamp final a [0, 1] — la posición física no puede salir del rango
      state[SLOT_PAN_POS]  = clamp01(state[SLOT_PAN_POS])
      state[SLOT_TILT_POS] = clamp01(state[SLOT_TILT_POS])

      // Escribir los valores suavizados de vuelta al ArbitratedNodeMap (in-place)
      entry['pan']  = state[SLOT_PAN_POS]
      entry['tilt'] = state[SLOT_TILT_POS]

      // Actualizar también el campo mutable del nodo para que el KineticSystem
      // del siguiente frame tenga la posición correcta como base de cálculo
      node.currentPosition.pan  = state[SLOT_PAN_POS]
      node.currentPosition.tilt = state[SLOT_TILT_POS]
    })
  }

  registerNode(nodeId: NodeId): void {
    if (this._states.has(nodeId)) return  // idempotente

    // Pre-aloca el buffer de estado inicializado a posición neutra (0.5, 0.5)
    const state = new Float32Array(STATE_SLOTS)
    state[SLOT_PAN_POS]  = 0.5
    state[SLOT_TILT_POS] = 0.5
    state[SLOT_PAN_VEL]  = 0
    state[SLOT_TILT_VEL] = 0
    state[SLOT_X3D_POS]  = DEFAULT_3D_X
    state[SLOT_Y3D_POS]  = DEFAULT_3D_Y
    state[SLOT_Z3D_POS]  = DEFAULT_3D_Z
    state[SLOT_X3D_VEL]  = 0
    state[SLOT_Y3D_VEL]  = 0
    state[SLOT_Z3D_VEL]  = 0
    this._states.set(nodeId, state)
  }

  onVibeChange(_newVibeId: string): void {
    // Zerear velocidades en todos los nodos para evitar overshoot residual
    // entre vibes de distinto tempo. La posición se mantiene (no teleport).
    for (const state of this._states.values()) {
      state[SLOT_PAN_VEL]  = 0
      state[SLOT_TILT_VEL] = 0
      state[SLOT_X3D_VEL]  = 0
      state[SLOT_Y3D_VEL]  = 0
      state[SLOT_Z3D_VEL]  = 0
    }
  }

  setPhysicsMode(mode: PhysicsMode, snapFactor = 0.5): void {
    this._mode = mode
    this._snapFactor = clamp01(snapFactor)
    // Al cambiar de modo, limpiar velocidades residuales
    for (const state of this._states.values()) {
      state[SLOT_PAN_VEL]  = 0
      state[SLOT_TILT_VEL] = 0
      state[SLOT_X3D_VEL]  = 0
      state[SLOT_Y3D_VEL]  = 0
      state[SLOT_Z3D_VEL]  = 0
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE — Modos de física
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * SNAP MODE: desplazamiento fraccional directo al target.
   *
   * newPos = currentPos + snapFactor * (target - current)
   *
   * Clampeado por un REV_LIMIT por frame: el motor no puede mover
   * más de maxVel * dt en un solo tick, incluso en modo snap.
   */
  private _applySnap(state: Float32Array): void {
    const maxMovePerFrame = this._maxVelNorm * this._dt

    this._panDelta  = this._snapFactor * (this._panTarget  - this._panPos)
    this._tiltDelta = this._snapFactor * (this._tiltTarget - this._tiltPos)

    // Anti-jitter
    if (Math.abs(this._panDelta)  < JITTER_THRESHOLD) this._panDelta  = 0
    if (Math.abs(this._tiltDelta) < JITTER_THRESHOLD) this._tiltDelta = 0

    // REV_LIMIT clamp
    this._panDelta  = clampAbs(this._panDelta,  maxMovePerFrame)
    this._tiltDelta = clampAbs(this._tiltDelta, maxMovePerFrame)

    state[SLOT_PAN_POS]  = this._panPos  + this._panDelta
    state[SLOT_TILT_POS] = this._tiltPos + this._tiltDelta
    // Snap no acumula velocidad física — resetear a 0
    state[SLOT_PAN_VEL]  = 0
    state[SLOT_TILT_VEL] = 0
  }

  /**
   * CLASSIC MODE: física de curva-S con aceleración y frenado.
   *
   * Algoritmo:
   * 1. Calcular distancia al target.
   * 2. Calcular distancia de frenado: d_brake = v² / (2 * maxAcc)
   * 3. Si |delta| > d_brake → acelerar (hasta maxVel)
   * 4. Si |delta| <= d_brake → frenar (hasta 0)
   * 5. Integrar posición: pos += vel * dt
   *
   * Fuente: FixturePhysicsDriver.applyPhysicsEasing() adaptado a espacio normalizado.
   */
  private _applyClassic(state: Float32Array, node: IKineticNodeData): void {
    // Calcular maxVel diferenciado por eje si el motor tiene velocidades distintas
    const maxVelTilt = Math.min(
      node.maxTiltSpeed * DEG_PER_SEC_TO_NORM_PER_SEC,
      SAFETY_MAX_VELOCITY_NORM,
    )

    this._applyClassicAxis(
      state,
      SLOT_PAN_POS, SLOT_PAN_VEL,
      this._panTarget, this._maxVelNorm, this._maxAccNorm,
    )
    this._applyClassicAxis(
      state,
      SLOT_TILT_POS, SLOT_TILT_VEL,
      this._tiltTarget, maxVelTilt, this._maxAccNorm,
    )
  }

  /**
   * Aplica física de curva-S en un eje único (pan o tilt).
   * Inline para evitar overhead de call en el hot path.
   */
  private _applyClassicAxis(
    state: Float32Array,
    posSlot: number,
    velSlot: number,
    target: number,
    maxVel: number,
    maxAcc: number,
  ): void {
    let pos = state[posSlot]
    let vel = state[velSlot]

    const delta = target - pos
    const absDelta = Math.abs(delta)

    // Anti-jitter: si el delta es microscópico y la velocidad ya es mínima, stop
    if (absDelta < JITTER_THRESHOLD && Math.abs(vel) < JITTER_THRESHOLD) {
      state[posSlot] = target  // snap al target exacto para evitar drift
      state[velSlot] = 0
      return
    }

    // Distancia de frenado = v² / (2 * maxAcc)
    this._brakeDist = (vel * vel) / (2 * maxAcc + 0.000001)  // +epsilon evita div/0

    const sign = delta >= 0 ? 1 : -1

    if (absDelta > this._brakeDist) {
      // Fase de aceleración
      vel += sign * maxAcc * this._dt
    } else {
      // Fase de frenado
      vel -= sign * maxAcc * this._dt
      // Evitar overshoot de velocidad en sentido contrario durante frenado
      if (sign > 0 && vel < 0) vel = 0
      if (sign < 0 && vel > 0) vel = 0
    }

    // Clamp de velocidad máxima (cap de seguridad)
    vel = clampAbs(vel, maxVel)

    // Integrar posición
    pos += vel * this._dt

    // Si cruzamos el target, snap y stop para evitar oscilación
    if ((sign > 0 && pos >= target) || (sign < 0 && pos <= target)) {
      pos = target
      vel = 0
    }

    state[posSlot] = pos
    state[velSlot] = vel
  }

  /**
   * TELEPORT MODE: si deltaMs > TELEPORT_THRESHOLD_MS, copiar targets directamente.
   * El motor estuvo congelado — no tiene sentido simular inercia de ese gap.
   */
  private _teleportAll(arbitrated: ArbitratedNodeMap, nodeGraph: INodeGraph): void {
    const kineticView = nodeGraph.getView(NodeFamily.KINETIC)
    kineticView.forEach((node: IKineticNodeData) => {
      const entry = (arbitrated as Map<NodeId, Record<string, number>>).get(node.nodeId)
      if (entry === undefined) return

      const state = this._states.get(node.nodeId)
      if (state === undefined) return

      if (entry['targetX'] !== undefined) {
        const xT = isFinite(entry['targetX'])        ? entry['targetX']          : state[SLOT_X3D_POS]
        const yT = isFinite(entry['targetY'] ?? NaN) ? (entry['targetY'] ?? DEFAULT_3D_Y) : state[SLOT_Y3D_POS]
        const zT = isFinite(entry['targetZ'] ?? NaN) ? (entry['targetZ'] ?? DEFAULT_3D_Z) : state[SLOT_Z3D_POS]
        state[SLOT_X3D_POS] = xT
        state[SLOT_Y3D_POS] = yT
        state[SLOT_Z3D_POS] = zT
        state[SLOT_X3D_VEL] = 0
        state[SLOT_Y3D_VEL] = 0
        state[SLOT_Z3D_VEL] = 0
        entry['targetX'] = xT
        entry['targetY'] = yT
        entry['targetZ'] = zT
        return
      }

      const panT  = isFinite(entry['pan']  ?? NaN) ? (entry['pan']  ?? 0.5) : state[SLOT_PAN_POS]
      const tiltT = isFinite(entry['tilt'] ?? NaN) ? (entry['tilt'] ?? 0.5) : state[SLOT_TILT_POS]

      state[SLOT_PAN_POS]  = panT
      state[SLOT_TILT_POS] = tiltT
      state[SLOT_PAN_VEL]  = 0
      state[SLOT_TILT_VEL] = 0

      entry['pan']  = panT
      entry['tilt'] = tiltT

      node.currentPosition.pan  = panT
      node.currentPosition.tilt = tiltT
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES — Inline para zero-overhead en hot path
// ═══════════════════════════════════════════════════════════════════════════

/** Clamp a [0, 1] */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Clamp el valor absoluto a [-maxAbs, +maxAbs] */
function clampAbs(v: number, maxAbs: number): number {
  return v > maxAbs ? maxAbs : v < -maxAbs ? -maxAbs : v
}
