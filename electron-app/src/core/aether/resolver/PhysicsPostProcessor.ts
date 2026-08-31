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
 * En WAVE 4636 liberamos la ruta clásica: este cap ya no se deriva de DMX/255/540,
 * porque el dominio aquí ya es normalizado [0..1].
 */
const SAFETY_MAX_ACCELERATION_NORM = 20.0

/**
 * Velocidad máxima de seguridad en espacio normalizado/s.
 * En WAVE 4636 liberamos la ruta clásica: permitimos barridos rápidos en
 * espacio normalizado sin el cap microscópico heredado de DMX.
 */
const SAFETY_MAX_VELOCITY_NORM = 5.0

// ── WAVE 4617-B M3: Inercia espacial 3D parametrizada por escenario ─────
/**
 * Factor de conversión: grados → radianes.
 * Usado para derivar la velocidad lineal máxima a partir de la velocidad
 * angular del motor y la escala del escenario.
 *
 * maxVelLinear = motorSpeed(deg/s) * DEG_TO_RAD * stageHalf(m)
 *
 * Esto escala correctamente: un escenario de 16m produce el doble de
 * velocidad lineal que uno de 8m para el mismo motor, reflejando que
 * el motor necesita barrer más metros por segundo en un espacio grande.
 */
const DEG_TO_RAD = Math.PI / 180
/** Velocidad máxima de seguridad base en espacio métrico [m/s] */
const SAFETY_MAX_3D_VEL_BASE_MS = 5.0
/** Aceleración máxima de seguridad base en espacio métrico [m/s²] */
const SAFETY_MAX_3D_ACC_BASE_MS2 = 20.0
/** Escala de referencia del escenario (diagonal del default 8×4m) */
const REF_STAGE_DIAG = Math.sqrt(8 * 8 + 4 * 4)  // ≈ 8.94m
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

  /**
   * WAVE 4617-B M3: Actualiza las dimensiones del escenario para escalar
   * la inercia espacial proporcionalmente al espacio real.
   */
  setStageBounds(width: number, height: number, depth: number): void

  /**
   * WAVE 6020 SALVA-SHOWS: Exorciza el estado 3D de un nodo.
   * Borra la bandera de inicialización 3D y resetea posición/velocidad
   * a defaults neutros. Llamar al hacer Unlock espacial para evitar
   * que el próximo target 3D arranque desde coordenadas zombis.
   */
  resetSpatialState(nodeId: NodeId): void

  /**
   * WAVE 6020.6: Siembra el estado clásico de física (pan/tilt pos + vel=0)
   * desde el snapshot del fade. Llamar justo después de inyectar el snapshot
   * de Unlock para que el PhysicsPostProcessor arranque desde la posición
   * correcta (delta=0) en lugar de interpolar desde el estado stale previo
   * al modo espacial, lo que causaba que el fixture saltara a ceiling.
   *
   * WAVE 7734: Overload con velocidad opcional. Cuando el hand-off captura
   * la velocidad angular del IK, sembrarla aquí permite que el VMM continúe
   * el momentum orgánicamente sin snapping desde reposo.
   */
  seedClassicState(nodeId: NodeId, pan: number, tilt: number, panVel?: number, tiltVel?: number): void

  /**
   * WAVE 7734: HAND-OFF PASS-THROUGH.
   * Durante el hand-off Spatial→VMM, el Arbiter corre un fade ease-out cúbico
   * (snapshot → L0). Sin esta llamada, el PPP aplica SU PROPIA inercia clásica
   * encima del target en movimiento, apilando ~1s de lag sobre el fade del
   * Arbiter (~700ms) → ~2s freeze percibido.
   *
   * Mientras un nodeId esté en pass-through, el PPP trackea el valor arbitrado
   * en modo SNAP con factor 1.0 (seguimiento instantáneo), de modo que la
   * ÚNICA curva de suavizado durante el handoff es el fade del Arbiter.
   * La entrada se purga automáticamente al expirar `durationMs` (medido con
   * performance.now), así que el caller no necesita limpiarla explícitamente.
   */
  setHandoffPassThrough(nodeIds: readonly NodeId[], durationMs: number): void

  /**
   * WAVE 7734: Captura la velocidad angular actual de un nodo (norm/s)
   * calculada desde el delta de currentPosition entre frames recientes.
   * Usar justo antes de purgar el estado IK para sembrar seedClassicState
   * con momentum y evitar el snap desde reposo al retomar el VMM.
   * Retorna {0,0} si no hay historial suficiente (fallback seguro).
   */
  captureAngularVelocity(nodeId: NodeId): { panVel: number; tiltVel: number }
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

  // ── WAVE 5023: Bandera de inicialización 3D por nodo ─────────────────
  // Un nodo entra aquí la primera vez que recibe targetX en el ArbitratedNodeMap.
  // En ese primer frame se teleporta el state 3D al target real para evitar
  // el "salto mortal" por state zombie (DEFAULT_3D_Y=1.5 cuando el target
  // real puede estar en Y=0, causando lag y apuntado al techo en fixtures
  // centrales cercanos a X=0). Se borra al hacer Unlock (targetX desaparece)
  // para que el próximo L2 también arranque limpio.
  private readonly _3dInitialized = new Set<NodeId>()

  // ── WAVE 7734: HAND-OFF PASS-THROUGH ──────────────────────────────────
  // nodeId → expiryMs (performance.now-based). Mientras now < expiryMs,
  // process() trackea el valor arbitrado en SNAP factor 1.0 en lugar de
  // aplicar la inercia clásica, para que el fade del Arbiter sea la única
  // curva de suavizado durante el hand-off Spatial→VMM.
  private readonly _handoffPassThrough = new Map<NodeId, number>()

  // ── WAVE 7734: VELOCITY CAPTURE ───────────────────────────────────────
  // nodeId → Float32Array(3): [prevPan, prevTilt, prevMs].
  // Actualizado al final de process() para nodos KINETIC. Permite calcular
  // la velocidad angular (norm/s) en captureAngularVelocity() para sembrar
  // seedClassicState con momentum durante el hand-off.
  private readonly _prevKineticPos = new Map<NodeId, Float32Array>()

  // ── Configuración de modo ──────────────────────────────────────────────
  private _mode: PhysicsMode = 'classic'
  // WAVE 4990 Paso 2: 0.5 → 0.8 — convergencia más rápida del target IK espacial.
  // Con 0.5, el target suavizado necesita ~8 frames (≈180ms a 44Hz) para alcanzar
  // 99% del objetivo real. Durante ese tiempo, los focos centrales pueden quedar
  // en el borde de la singularidad (horizontalDist ≈ 0) y apuntar horizontal.
  // Con 0.8, la convergencia cae a ~4 frames (≈90ms) — reducción del 50% de lag.
  // Vibes SNAP (Techno, Latino, Rock) — El suavizado del target 3D NO afecta
  // al suavizado de pan/tilt físico (eso lo maneja applyPhysicsEasing). Safe.
  private _snapFactor = 0.8

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
  private _telemetryFrame = 0  // WAVE 4621-A: throttle para sondas

  // ── WAVE 4617-B M3: Stage bounds + temporales 3D (zero-alloc) ────────
  private _stageHalfW  = 4.0   // half width  (meters)
  private _stageHalfH  = 2.0   // half height (meters)
  private _stageHalfD  = 1.0   // half depth  (meters)
  private _stageDiag   = REF_STAGE_DIAG
  private _x3dTarget   = 0
  private _y3dTarget   = 0
  private _z3dTarget   = 0
  private _maxVelX3d   = 0
  private _maxVelY3d   = 0
  private _maxVelZ3d   = 0
  private _maxAcc3d    = 0

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

      // ── WAVE 4617-B M1+M3: Inercia espacial 3D parametrizada por escenario ──
      // La decisión de procesar en modo 3D depende de:
      //   1. El device está posicionado (isPlaced === true)
      //   2. Existen canales espaciales targetX en el ArbitratedNodeMap
      // Esto es consistente con el Gatekeeper de Hierro del NodeResolver.
      const device3d = entry['targetX'] !== undefined
        ? nodeGraph.getDevice(node.deviceId)
        : undefined
      if (device3d?.isPlaced === true && entry['targetX'] !== undefined) {
        const xT = entry['targetX']
        const yT = entry['targetY']
        const zT = entry['targetZ']
        this._x3dTarget = isFinite(xT)        ? xT                   : state[SLOT_X3D_POS]
        this._y3dTarget = isFinite(yT ?? NaN) ? (yT ?? DEFAULT_3D_Y) : state[SLOT_Y3D_POS]
        this._z3dTarget = isFinite(zT ?? NaN) ? (zT ?? DEFAULT_3D_Z) : state[SLOT_Z3D_POS]

        // WAVE 5023: Primer frame en modo 3D → teleportar estado al target real.
        // Sin esto, el suavizado arranca desde DEFAULT_3D_Y=1.5 hacia el target
        // real (ej. Y=0 en suelo), produciendo un arco de ~8 frames donde el
        // IK calcula ángulos incorrectos y los fixtures centrales apuntan al techo.
        if (!this._3dInitialized.has(node.nodeId)) {
          this._3dInitialized.add(node.nodeId)
          state[SLOT_X3D_POS] = this._x3dTarget
          state[SLOT_Y3D_POS] = this._y3dTarget
          state[SLOT_Z3D_POS] = this._z3dTarget
          state[SLOT_X3D_VEL] = 0
          state[SLOT_Y3D_VEL] = 0
          state[SLOT_Z3D_VEL] = 0
        }

        // WAVE 4617-B M3: Derivar límites de velocidad por eje a partir de
        // la velocidad angular del motor y la escala real del escenario.
        //
        //   maxVelLinear = motorAngularSpeed * DEG_TO_RAD * stageHalfDimension
        //
        // Esto reemplaza el factor fijo 4.0/270 que asumía un escenario de 8m.
        // Un escenario grande produce límites lineales más altos (correcto:
        // el motor barre más metros por segundo en un espacio grande).
        //
        // El safety cap escala con la diagonal del escenario vs la referencia
        // (8×4m) para no estrangular escenarios grandes.
        const stageScale = this._stageDiag / REF_STAGE_DIAG
        const safetyMaxVel = SAFETY_MAX_3D_VEL_BASE_MS * Math.max(1.0, stageScale)
        const safetyMaxAcc = SAFETY_MAX_3D_ACC_BASE_MS2 * Math.max(1.0, stageScale)

        this._maxVelX3d = Math.min(node.maxPanSpeed  * DEG_TO_RAD * this._stageHalfW, safetyMaxVel)
        this._maxVelY3d = Math.min(node.maxTiltSpeed * DEG_TO_RAD * this._stageHalfH, safetyMaxVel)
        this._maxVelZ3d = Math.min(node.maxPanSpeed  * DEG_TO_RAD * this._stageHalfD, safetyMaxVel)
        this._maxAcc3d  = Math.min(Math.max(this._maxVelX3d, this._maxVelY3d) * 4, safetyMaxAcc)

        // WAVE 4621-A: TELEMETRY — Spatial 3D physics limits (cada 60 frames)
        // WAVE 7617: Silenced — was flooding backend logs. Re-enable with a debug flag if needed.
        // if ((++this._telemetryFrame % 60) === 0) {
        //   console.log(
        //     `[PHYSICS-3D] node=${String(node.nodeId)} mode=${this._mode} ` +
        //     `stageHalf=(${this._stageHalfW.toFixed(2)},${this._stageHalfH.toFixed(2)},${this._stageHalfD.toFixed(2)}) ` +
        //     `diag=${this._stageDiag.toFixed(2)} stageScale=${stageScale.toFixed(2)} ` +
        //     `motorSpeeds=(pan=${node.maxPanSpeed},tilt=${node.maxTiltSpeed}) ` +
        //     `maxVel3D=(${this._maxVelX3d.toFixed(4)},${this._maxVelY3d.toFixed(4)},${this._maxVelZ3d.toFixed(4)}) ` +
        //     `maxAcc3D=${this._maxAcc3d.toFixed(4)} dt=${this._dt.toFixed(4)} ` +
        //     `target=(${this._x3dTarget.toFixed(2)},${this._y3dTarget.toFixed(2)},${this._z3dTarget.toFixed(2)})`,
        //   )
        // }

        if (this._mode === 'snap') {
          const dxSnap  = this._snapFactor * (this._x3dTarget - state[SLOT_X3D_POS])
          const dySnap  = this._snapFactor * (this._y3dTarget - state[SLOT_Y3D_POS])
          const dzSnap  = this._snapFactor * (this._z3dTarget - state[SLOT_Z3D_POS])
          const maxMoveX = this._maxVelX3d * this._dt
          const maxMoveY = this._maxVelY3d * this._dt
          const maxMoveZ = this._maxVelZ3d * this._dt
          state[SLOT_X3D_POS] += clampAbs(Math.abs(dxSnap) < JITTER_THRESHOLD ? 0 : dxSnap, maxMoveX)
          state[SLOT_Y3D_POS] += clampAbs(Math.abs(dySnap) < JITTER_THRESHOLD ? 0 : dySnap, maxMoveY)
          state[SLOT_Z3D_POS] += clampAbs(Math.abs(dzSnap) < JITTER_THRESHOLD ? 0 : dzSnap, maxMoveZ)
          state[SLOT_X3D_VEL] = 0
          state[SLOT_Y3D_VEL] = 0
          state[SLOT_Z3D_VEL] = 0
        } else {
          this._applyClassicAxis(state, SLOT_X3D_POS, SLOT_X3D_VEL, this._x3dTarget, this._maxVelX3d, this._maxAcc3d)
          this._applyClassicAxis(state, SLOT_Y3D_POS, SLOT_Y3D_VEL, this._y3dTarget, this._maxVelY3d, this._maxAcc3d)
          this._applyClassicAxis(state, SLOT_Z3D_POS, SLOT_Z3D_VEL, this._z3dTarget, this._maxVelZ3d, this._maxAcc3d)
        }

        entry['targetX'] = state[SLOT_X3D_POS]
        entry['targetY'] = state[SLOT_Y3D_POS]
        entry['targetZ'] = state[SLOT_Z3D_POS]
        return  // nodo espacial procesado — skip flujo legacy pan/tilt
      }

      // WAVE 5023: El nodo ha salido del modo 3D (targetX ya no está presente).
      // Seedear el estado clásico desde la posición física REAL que el NodeResolver
      // acaba de calcular por IK. Sin esto, state[SLOT_PAN_POS] sigue congelado en
      // un valor de hace minutos (zombie) y el primer delta clásico es un latigazo.
      if (this._3dInitialized.has(node.nodeId)) {
        const actualPan  = node.currentPosition?.pan
        const actualTilt = node.currentPosition?.tilt
        if (typeof actualPan === 'number' && isFinite(actualPan)) {
          state[SLOT_PAN_POS] = actualPan
        }
        if (typeof actualTilt === 'number' && isFinite(actualTilt)) {
          state[SLOT_TILT_POS] = actualTilt
        }
        state[SLOT_PAN_VEL]  = 0
        state[SLOT_TILT_VEL] = 0
        this._3dInitialized.delete(node.nodeId)
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

      // ── WAVE 7734: HAND-OFF PASS-THROUGH ──────────────────────────────
      // Si el nodo está en pass-through (hand-off Spatial→VMM en curso),
      // trackear el valor arbitrado con SNAP factor 1.0 (seguimiento instantáneo)
      // en lugar de la inercia clásica. Así el fade ease-out del Arbiter es la
      // ÚNICA curva de suavizado → se elimina el compound ~2s freeze.
      // Lazy cleanup: purgar entradas expiradas al tocar el nodo.
      const handoffExpiry = this._handoffPassThrough.get(node.nodeId)
      const inHandoff = handoffExpiry !== undefined && performance.now() < handoffExpiry
      if (handoffExpiry !== undefined && !inHandoff) {
        this._handoffPassThrough.delete(node.nodeId)
      }

      if (inHandoff) {
        // SNAP factor 1.0 = newPos = target (seguimiento instantáneo, sin inercia).
        // El clamp por maxVelPerFrame sigue protegiendo el hardware.
        const maxMovePerFrame = this._maxVelNorm * this._dt
        this._panDelta  = this._panTarget  - this._panPos
        this._tiltDelta = this._tiltTarget - this._tiltPos
        state[SLOT_PAN_POS]  = this._panPos  + clampAbs(this._panDelta,  maxMovePerFrame)
        state[SLOT_TILT_POS] = this._tiltPos + clampAbs(this._tiltDelta, maxMovePerFrame)
        state[SLOT_PAN_VEL]  = 0
        state[SLOT_TILT_VEL] = 0
      } else if (this._mode === 'snap') {
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

      // ── WAVE 7734: VELOCITY CAPTURE ───────────────────────────────────
      // Registrar la posición actual + timestamp para que captureAngularVelocity
      // pueda computar la velocidad angular en el próximo hand-off.
      // Reutilizar el Float32Array existente (zero-alloc tras warm-up).
      let prev = this._prevKineticPos.get(node.nodeId)
      if (!prev) {
        prev = new Float32Array(3)
        this._prevKineticPos.set(node.nodeId, prev)
      }
      prev[0] = state[SLOT_PAN_POS]
      prev[1] = state[SLOT_TILT_POS]
      prev[2] = performance.now()
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

  /**
   * WAVE 4617-B M3: Actualiza las dimensiones del escenario para escalar
   * la inercia espacial proporcionalmente.
   * Llamar cuando cambie el stageConfig (setFixtures, stage resize).
   */
  setStageBounds(width: number, height: number, depth: number): void {
    this._stageHalfW = width  > 0 ? width  * 0.5 : 4.0
    this._stageHalfH = height > 0 ? height * 0.5 : 2.0
    this._stageHalfD = depth  > 0 ? depth  * 0.5 : 1.0
    this._stageDiag  = Math.sqrt(width * width + height * height) || REF_STAGE_DIAG
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

  /**
   * WAVE 6020 SALVA-SHOWS: Exorciza el estado 3D de un nodo.
   * Borra la bandera de inicialización 3D y resetea posición/velocidad
   * a defaults neutros. Llamar al hacer Unlock espacial para evitar
   * que el próximo target 3D arranque desde coordenadas zombis.
   */
  resetSpatialState(nodeId: NodeId): void {
    this._3dInitialized.delete(nodeId)
    const state = this._states.get(nodeId)
    if (state) {
      state[SLOT_X3D_POS] = DEFAULT_3D_X
      state[SLOT_Y3D_POS] = DEFAULT_3D_Y
      state[SLOT_Z3D_POS] = DEFAULT_3D_Z
      state[SLOT_X3D_VEL] = 0
      state[SLOT_Y3D_VEL] = 0
      state[SLOT_Z3D_VEL] = 0
      console.log(`[ZOMBIE-DIAG] resetSpatialState ${nodeId}: 3D state exorcized`)
    }
  }

  /**
   * WAVE 6020.6: Siembra el estado clásico de física desde el snapshot.
   * Fija SLOT_PAN/TILT_POS al valor del snapshot y anula velocidad.
   * Con esto el PPP parte de delta=0 → no interpola → el fixture no se mueve.
   */
  /**
   * WAVE 6020.6 + WAVE 7734: Siembra el estado clásico de física desde el
   * snapshot. Fija SLOT_PAN/TILT_POS al valor del snapshot.
   * WAVE 7734: Si se proporciona panVel/tiltVel (capturados del IK), sembrarlos
   * en lugar de anularlos → el VMM continúa el momentum orgánicamente sin snap.
   */
  seedClassicState(nodeId: NodeId, pan: number, tilt: number, panVel?: number, tiltVel?: number): void {
    const state = this._states.get(nodeId)
    if (state) {
      state[SLOT_PAN_POS]  = pan
      state[SLOT_TILT_POS] = tilt
      state[SLOT_PAN_VEL]  = (typeof panVel  === 'number' && Number.isFinite(panVel))  ? panVel  : 0
      state[SLOT_TILT_VEL] = (typeof tiltVel === 'number' && Number.isFinite(tiltVel)) ? tiltVel : 0
    }
  }

  /**
   * WAVE 7734: HAND-OFF PASS-THROUGH. Ver interface doc arriba.
   * Registra nodeIds con un expiry basado en performance.now + durationMs.
   * process() purga entradas expiradas automáticamente (lazy cleanup).
   */
  setHandoffPassThrough(nodeIds: readonly NodeId[], durationMs: number): void {
    if (durationMs <= 0 || nodeIds.length === 0) return
    const expiry = performance.now() + durationMs
    for (let i = 0; i < nodeIds.length; i++) {
      this._handoffPassThrough.set(nodeIds[i], expiry)
    }
  }

  /**
   * WAVE 7734: Captura la velocidad angular actual (norm/s) desde el historial
   * de currentPosition entre los dos frames más recientes. Retorna {0,0} si
   * no hay historial suficiente (fallback seguro — equivalente al behavior pre-7734).
   */
  captureAngularVelocity(nodeId: NodeId): { panVel: number; tiltVel: number } {
    const prev = this._prevKineticPos.get(nodeId)
    if (!prev) return { panVel: 0, tiltVel: 0 }
    const prevMs = prev[2]
    if (!Number.isFinite(prevMs) || prevMs <= 0) return { panVel: 0, tiltVel: 0 }
    const state = this._states.get(nodeId)
    // Usar la posición actual del estado PPP (lo más fresco disponible).
    // Si no hay state, fallback a 0.
    const curPan  = state ? state[SLOT_PAN_POS]  : 0.5
    const curTilt = state ? state[SLOT_TILT_POS] : 0.5
    const dtSec = (performance.now() - prevMs) * 0.001
    if (dtSec <= 0) return { panVel: 0, tiltVel: 0 }
    const panVel  = (curPan  - prev[0]) / dtSec
    const tiltVel = (curTilt - prev[1]) / dtSec
    // Clamp de seguridad — velocidades absurdas (saltos de frame) se descartan.
    const MAX_VEL = SAFETY_MAX_VELOCITY_NORM * 2
    return {
      panVel:  Math.abs(panVel)  > MAX_VEL ? 0 : panVel,
      tiltVel: Math.abs(tiltVel) > MAX_VEL ? 0 : tiltVel,
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

      // WAVE 4617-B M1: Consistent isPlaced guard in teleport path
      const teleportDevice = entry['targetX'] !== undefined
        ? nodeGraph.getDevice(node.deviceId)
        : undefined
      if (teleportDevice?.isPlaced === true && entry['targetX'] !== undefined) {
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
