/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 AETHER MATRIX — NODE RESOLVER (IMPLEMENTACIÓN)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.4: Implementación concreta del INodeResolver.
 * WAVE 4522.4: Traducción física cromática — CMY, RGBW, colorWheel.
 *
 * El NodeResolver es el último guardián antes del hardware.
 * Toma el ArbitratedNodeMap (valores normalizados 0-1 desde el
 * NodeArbiter) y produce DMXPackets listos para el driver HAL.
 *
 * PIPELINE POR FRAME:
 *   1. Zero-fill de todos los Uint8Array de universos activos
 *   2. Para cada nodo arbitrado:
 *      a. Obtener la IDeviceDefinition via NodeGraph.getDevice()
 *      b. Obtener los INodeChannelDef del nodo via NodeGraph.getNodeData()
 *      c. Si el nodo es COLOR: aplicar traducción física (CMY/RGBW/wheel)
 *         vía ColorTranslator. Para ruedas mecánicas, pasar por
 *         HarmonicQuantizer antes de escribir el canal color_wheel.
 *      d. Para cada canal: aplicar TransferCurve, escalar a DMX
 *      e. Aplicar calibración (invertPan, tiltLimits, panOffset, etc.)
 *      f. Clamp final a [0, constraints.maxValue] (safety layer)
 *      g. Escribir en el buffer del universo
 *   3. Emitir IDMXPackets desde los buffers (sin new Array)
 *
 * ZERO-ALLOC EN HOT PATH:
 * - `_universeBuffers`: Map pre-allocated de Uint8Array(512) por universo.
 *   Crece en registerDevice() y se estabiliza tras warm-up.
 * - `_outputPackets`: Pool de IDMXPacket-like mutable pre-allocated.
 *   Se reusan frame a frame.
 * - `_activeUniverses`: Set reutilizado, se limpia sin alloc.
 * - `_rgbScratch`: objeto RGB reutilizado en hot path (sin new).
 * - No se crean Arrays, Maps ni Uint8Arrays durante `resolve()`.
 *
 * NOTA SOBRE UNIVERSOS:
 * Los universes se registran al llamar `registerDevice()`.
 * El resolver necesita conocer el NodeGraph para obtener
 * IDeviceDefinition y ICapabilityNode simultáneamente.
 *
 * @module core/aether/resolver/NodeResolver
 * @version WAVE 4522.4
 */

import type { NodeId, DeviceId, ColorMixingType, ColorWheelDefinition } from '../types'
import type { INodeGraph } from '../node-graph'
import type { ArbitratedNodeMap, IDMXPacket, INodeResolver } from '../intent-bus'
import type { INodeChannelDef, IColorNodeData, IKineticNodeData } from '../capability-node'
import type { TransferCurve } from '../types'
import { NodeFamily } from '../types'
import { getColorTranslator } from '../../../hal/translation/ColorTranslator'
import type { RGB } from '../../../hal/translation/ColorTranslator'
import { getHarmonicQuantizer } from '../../../hal/translation/HarmonicQuantizer'
// ColorWheelDefinition en el Aether (slots[]) vs el formato legacy (colors[]) del ColorTranslator.
// El adaptador _aetherWheelToLegacy convierte entre ellos sin alloc en hot path.
import type { ColorWheelDefinition as HalColorWheelDefinition } from '../../../hal/translation/FixtureProfiles'
import type { IDeviceCalibration } from '../device'
import { solve, buildProfile } from '../../../engine/movement/InverseKinematicsEngine'
import type { IKFixtureProfile } from '../../../engine/movement/InverseKinematicsEngine'
// WAVE 4548.6: Forge Node Evaluator bypass
import type { CompiledForgeGraph, ForgeFrameContext } from '../../forge/compiler/types'
import { DEFAULT_FORGE_FRAME_CONTEXT } from '../../forge/compiler/types'
import { ForgeNodeEvaluator } from '../../forge/evaluator/ForgeNodeEvaluator'
// 🛂 WAVE 4557: Aether Safety Middleware — velocity clamp, airbag, DarkSpin
import type { AetherSafetyMiddleware } from '../egress/AetherSafetyMiddleware'

// ── Canales de posición para calibración ────────────────────────────────
const PAN_CHANNELS   = new Set<string>(['pan', 'pan_fine'])
const TILT_CHANNELS  = new Set<string>(['tilt', 'tilt_fine'])
const PAN_COARSE     = 'pan'
const TILT_COARSE    = 'tilt'
const DIMMER_CHANNEL = 'dimmer'

// ── Canales cromáticos abstractos del Aether ────────────────────────────
// El ColorAdapter (L1) emite SIEMPRE r/g/b normalizados.
// El NodeResolver traduce estos a los canales físicos según mixingType.
const CH_R           = 'r'
const CH_G           = 'g'
const CH_B           = 'b'
const CH_RED         = 'red'
const CH_GREEN       = 'green'
const CH_BLUE        = 'blue'
const CH_WHITE       = 'white'
const CH_CYAN        = 'cyan'
const CH_MAGENTA     = 'magenta'
const CH_YELLOW      = 'yellow'
const CH_COLOR_WHEEL = 'color_wheel'
const CH_AMBER       = 'amber'
const CH_UV          = 'uv'

// ── Canales espaciales 3D — WAVE 4523.5 ──────────────────────────────────
// Emitidos por KineticAdapter cuando el nodo opera en flujo IK (metros).
const CH_TARGET_X = 'targetX'
const CH_TARGET_Y = 'targetY'
const CH_TARGET_Z = 'targetZ'
const SHUTTER_CHANNEL = 'shutter'
const STROBE_CHANNEL = 'strobe'
const SOFT_BLACKOUT_INTENSITY_CHANNELS = new Set<string>([
  DIMMER_CHANNEL,
])

const IK_WARN_INTERVAL_FRAMES = 44
const MATH_TELEMETRY_EVERY_FRAMES = 30

const IK_DEFAULT_PAN_RANGE_DEG  = 540
const IK_DEFAULT_TILT_RANGE_DEG = 270

// WAVE 4735.3: auditoría de salud del tick Aether (~2.27s @ 44Hz)
const AETHER_TICK_HEALTH_EVERY_FRAMES = 100

function sanitizeNormalizedValue(value: number | undefined, fallback = 0): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback
}

function sanitizeDmxByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > 255) {
    return 255
  }
  return value
}

// ── Canales que deben pasar por traducción cromática ─────────────────────
// Si el mapa arbitrado del nodo contiene alguno de estos, es un nodo COLOR.
const COLOR_ABSTRACT_CHANNELS = new Set<string>([CH_R, CH_G, CH_B])

// WAVE 4735.1 HOTFIX: canales de mezcla electrónica.
// Si un nodo usa estos canales y NO tiene color_wheel físico, DarkSpin debe abortarse.
const ELECTRONIC_COLOR_CHANNELS = new Set<string>([
  CH_R,
  CH_G,
  CH_B,
  CH_RED,
  CH_GREEN,
  CH_BLUE,
  CH_WHITE,
  CH_CYAN,
  CH_MAGENTA,
  CH_YELLOW,
  CH_AMBER,
  CH_UV,
])

// ── Orientación IK por defecto — ceiling mount, sin rotación custom ───────
const DEFAULT_IK_ORIENTATION = {
  installation: 'ceiling' as const,
  rotation: { pitch: 0, yaw: 0, roll: 0 },
}

// ── DMX universe size ────────────────────────────────────────────────────
const DMX_UNIVERSE_SIZE = 512

// ── Contexto de frame para el HarmonicQuantizer ──────────────────────────
// Inyectado via setResolveContext() antes de cada llamada a resolve().
// Valores por defecto conservadores (sin cuantización activa).
let _currentBpm             = 120
let _currentBpmConfidence   = 0.0

// ── Mutable DMXPacket para hot path ─────────────────────────────────────
// No usa `readonly` internamente — se muta in-place y se expone
// como IDMXPacket (readonly por TypeScript covariance).
interface MutableDMXPacket {
  universe: number
  address: number
  channels: number[]   // Uint8Array-backed si se quiere cero-copy hacia el driver
}

// 🔥 WAVE 4720: Regla de inyección de ignición pre-computada.
// Creada en patch-time, iterada O(1) en hot path.
interface IgnitionInjection {
  /** Índice absoluto en el buffer del universo del canal TARGET (0-indexed) */
  readonly targetBufIdx: number
  /** Valor DMX requerido en el target */
  readonly requiredValue: number
  /** Índice absoluto en el buffer del canal SOURCE (el que tiene la dep) */
  readonly sourceBufIdx: number
  /** 'hold' = inyectar siempre; 'release' = solo si source > 0 */
  readonly mode: 'hold' | 'release'
}


/**
 * NodeResolver — Traducción zero-alloc de nodos abstractos a DMX físico.
 *
 * CONSTRUCCIÓN:
 * ```ts
 * const resolver = new NodeResolver(nodeGraph)
 * resolver.registerDevice(deviceId)  // llamar en patch time
 * ```
 *
 * USO EN HOT PATH:
 * ```ts
 * const packets = resolver.resolve(arbitrated)
 * for (const p of packets) hal.sendUniverse(p.universe, p.channels)
 * ```
 */
export class NodeResolver implements INodeResolver {

  private readonly _graph: INodeGraph

  // ── Cache IKFixtureProfile por nodo — WAVE 4523.5 ─────────────────────
  // Construido lazy en primer uso. Los datos de perfil IK son readonly:
  // posición, orientación y calibración no cambian en runtime.
  // Invalidar únicamente en re-patch (implica crear un NodeResolver nuevo).
  private readonly _ikProfiles = new Map<NodeId, IKFixtureProfile>()
  private readonly _ikReachability = new Map<NodeId, boolean>()
  private readonly _ikLastWarnFrame = new Map<NodeId, number>()
  private _resolveFrameIndex = 0

  // ── Scratch RGB — reutilizado en hot path sin alloc ──────────────────
  // Mutable in-place, pasado al ColorTranslator por referencia.
  // INVARIANTE: solo válido durante _translateColor(); no exponer.
  private readonly _rgbScratch: RGB = { r: 0, g: 0, b: 0 }

  // ── WAVE 4735.2: Color output scratchpad — zero-alloc en hot path ────
  // Sustituye la creación de objetos literales con `...original` spread
  // en cada llamada a _translateColor(). Se muta y se retorna su referencia.
  // NaN = "no escrito en este frame" (sentinel para el fallback en _writeNode).
  // INVARIANTE: solo válido sincrónicamente durante _writeNode(); no retener.
  private readonly _colorTranslateScratch: Record<string, number> = Object.create(null)

  // ── WAVE 4735.2: WeakMap cache para _aetherWheelToLegacy ─────────────
  // La conversión slots[] → colors[] solo ocurre una vez por rueda mecánica
  // durante la vida del show (las ruedas son patch-time, no cambian a 44Hz).
  private readonly _wheelLegacyCache = new WeakMap<ColorWheelDefinition, HalColorWheelDefinition>()

  // ── Buffers por universo ───────────────────────────────────────────────
  // Map<universe (1-based), Uint8Array(512)>
  // Pre-allocated en registerDevice(), re-usado frame a frame.
  private readonly _universeBuffers = new Map<number, Uint8Array>()

  // Lleva registro de qué universos tienen datos reales este frame
  // para emitir solo los paquetes relevantes.
  private readonly _activeUniverses = new Set<number>()

  // ── Pool de salida pre-allocated ─────────────────────────────────────
  // Array de MutableDMXPacket reutilizados frame a frame.
  // Se crece en registerDevice() y se estabiliza tras patch-time.
  private readonly _packetPool: MutableDMXPacket[] = []
  // Map<universe, MutableDMXPacket> — solo los paquetes del frame actual
  private readonly _framePackets = new Map<number, MutableDMXPacket>()

  // ── Smart Blackout (WAVE 4656.1) ────────────────────────────────────
  // Máscara por universo de canales de intensidad que deben ir a 0
  // durante blackout blando (sin tocar pan/tilt/speed/rotation).
  private readonly _softBlackoutMasks = new Map<number, Uint8Array>()
  // Buffers de salida pre-alloc para blackout por universo.
  private readonly _softBlackoutBuffers = new Map<number, Uint8Array>()
  // Buffers de blackout duro (todos los canales a 0) por universo.
  private readonly _hardBlackoutBuffers = new Map<number, Uint8Array>()

  // ── WAVE 4548.6: Forge compiled graphs por device ──────────────────
  // Si un device tiene un CompiledForgeGraph, _writeNode() delega
  // completamente al ForgeNodeEvaluator — bypass total del flujo legacy.
  private readonly _forgeGraphs = new Map<DeviceId, CompiledForgeGraph>()
  private _forgeFrameContext: ForgeFrameContext = DEFAULT_FORGE_FRAME_CONTEXT

  // 🛂 WAVE 4557: Safety middleware for velocity clamping, airbag, DarkSpin
  private _safetyMiddleware: AetherSafetyMiddleware | null = null
  // 🌊 WAVE 4703: Tracks devices currently in DarkSpin transit to suppress per-frame log spam.
  // Cleared each sweep — log fires only on the first frame a device enters transit.
  private readonly _darkSpinActiveDevices = new Set<DeviceId>()

  // 🔥 WAVE 4720: IGNITION ENGINE — Pre-computed injection map (patch-time only)
  // Key: DeviceId  Value: array of IgnitionInjection rules
  // Built once in _precomputeIgnitionMap(); iterated O(2-4) times per frame in resolve().
  // ZERO ALLOC in hot path — all arrays created at patch time.
  private readonly _ignitionMap = new Map<DeviceId, IgnitionInjection[]>()

  constructor(graph: INodeGraph) {
    this._graph = graph
    // Pre-establecer la forma del scratchpad para que V8 use hidden class fija.
    // NaN = sentinel (no escrito). Los valores reales se asignan en _translateColor().
    const s = this._colorTranslateScratch
    s[CH_RED] = s[CH_GREEN] = s[CH_BLUE] = NaN
    s[CH_R]   = s[CH_G]     = s[CH_B]   = NaN
    s[CH_WHITE] = s[CH_CYAN] = s[CH_MAGENTA] = s[CH_YELLOW] = NaN
    s[CH_COLOR_WHEEL] = s[CH_AMBER] = s[CH_UV] = NaN
    s[DIMMER_CHANNEL] = NaN
  }

  /**
   * WAVE 4557: Inyecta el AetherSafetyMiddleware.
   * Llamar en patch-time, antes del primer frame.
   */
  setSafetyMiddleware(middleware: AetherSafetyMiddleware): void {
    this._safetyMiddleware = middleware
  }

  /**
   * 🔥 WAVE 4720: Registra un device y pre-computa su mapa de ignición.
   *
   * Llamar DESPUÉS de NodeGraph.registerDevice() — el device debe estar
   * ya en el grafo para que getDeviceNodes() y getNodeData() funcionen.
   *
   * PATCH TIME — nunca llamar desde el hot path.
   *
   * @param deviceId — DeviceId del device recién registrado
   */
  registerDevice(deviceId: DeviceId): void {
    this._ignitionMap.delete(deviceId)  // limpiar si re-patch
    this._precomputeIgnitionMap(deviceId)
  }

  /**
   * WAVE 4522.4: Inyectar contexto musical antes de cada resolve().
   *
   * Llamar desde el Orchestrator inmediatamente ANTES de resolve().
   * El BPM y confidence se usan por el HarmonicQuantizer para gating
   * de cambios de rueda mecánica al tempo musical.
   *
   * Si no se llama, el resolver opera con confianza=0.0, lo que
   * desactiva el cuantizador (pass-through sin gating).
   *
   * @param bpm — BPM actual (del Worker, autoritativo)
   * @param bpmConfidence — Confianza del BPM (0-1, umbral activo: >0.3)
   */
  setResolveContext(bpm: number, bpmConfidence: number): void {
    _currentBpm           = bpm
    _currentBpmConfidence = bpmConfidence
  }

  /**
   * WAVE 3505.4: Acceso directo al buffer de universo pre-allocated.
   *
   * USO: llamar DESPUÉS de `resolve()` para obtener el Uint8Array que
   * ya fue escrito en ese frame y pasarlo directo al driver DMX sin copia.
   *
   * El buffer pertenece al NodeResolver — NO modificar desde fuera.
   * Es válido solo hasta el próximo tick de resolve() (siguiente frame).
   *
   * @param universe — Número de universo (1-based)
   * @returns Uint8Array(512) o undefined si el universo no está registrado
   */
  getUniverseBuffer(universe: number): Uint8Array | undefined {
    return this._universeBuffers.get(universe)
  }

  /**
   * WAVE 4656.1: Smart Blackout por universo.
   *
   * Copia el buffer resuelto del universo y fuerza a 0 únicamente los
    * canales de dimmer, preservando movimiento y el resto del estado
    * fotométrico/cinemático para seguridad mecánica.
   */
  getSoftBlackoutUniverseBuffer(universe: number, source: Uint8Array): Uint8Array {
    let out = this._softBlackoutBuffers.get(universe)
    if (!out) {
      out = new Uint8Array(DMX_UNIVERSE_SIZE)
      this._softBlackoutBuffers.set(universe, out)
    }

    out.set(source)

    const mask = this._getOrBuildSoftBlackoutMask(universe)
    for (let i = 0; i < DMX_UNIVERSE_SIZE; i++) {
      if (mask[i] === 1) out[i] = 0
    }

    return out
  }

  /**
   * WAVE 4666: Hard blackout por universo.
   *
   * Retorna un buffer pre-allocated de 512 canales en 0 para blackout total.
   */
  getHardBlackoutUniverseBuffer(universe: number): Uint8Array {
    let out = this._hardBlackoutBuffers.get(universe)
    if (!out) {
      out = new Uint8Array(DMX_UNIVERSE_SIZE)
      this._hardBlackoutBuffers.set(universe, out)
    }
    return out
  }

  /**
   * Lista de universos actualmente registrados (por registerUniverse()).
   * Útil para iterar en el Orchestrator sin crear un Array nuevo.
   */
  get registeredUniverses(): IterableIterator<number> {
    return this._universeBuffers.keys()
  }

  /**
   * WAVE 4680: Universos que tienen al menos un nodo no bloqueado este frame.
   * Útil para el egress loop cuando outputEnabled=false (Smart Gate).
   */
  get activeUniverses(): IterableIterator<number> {
    return this._activeUniverses.values()
  }

  // ── WAVE 4548.6: Forge Graph Registration ──────────────────────────────

  /**
   * Registra un grafo Forge compilado para un device.
   * PATCH TIME — llamar cuando se registra un Device que tiene
   * FixtureDefinitionV2.nodeGraph.
   *
   * Cuando presente, el Forge evaluator REEMPLAZA el flujo legacy
   * de channel iteration + TransferCurve + calibration para ese device.
   */
  registerForgeGraph(deviceId: DeviceId, compiled: CompiledForgeGraph): void {
    this._forgeGraphs.set(deviceId, compiled)
  }

  /**
   * Retira el grafo Forge compilado de un device.
   * El device volverá al flujo legacy en el próximo frame.
   */
  unregisterForgeGraph(deviceId: DeviceId): void {
    this._forgeGraphs.delete(deviceId)
  }

  /**
   * Inyecta el contexto de frame para el Forge evaluator.
   * Llamar desde el Orchestrator junto con setResolveContext().
   */
  setForgeFrameContext(ctx: ForgeFrameContext): void {
    this._forgeFrameContext = ctx
  }

  /**
   * Registra un universo DMX para este resolver.
   *
   * PATCH TIME — llamar cuando se registra un Device en el NodeGraph.
   * Si el universo ya existe, no hace nada.
   *
   * @param universe — Número de universo (1-based)
   */
  registerUniverse(universe: number): void {
    if (this._universeBuffers.has(universe)) return

    // Pre-allocar buffer de 512 bytes para el universo
    this._universeBuffers.set(universe, new Uint8Array(DMX_UNIVERSE_SIZE))

    // Pre-allocar el packet del pool (channels como Array para compatibilidad IDMXPacket)
    const packet: MutableDMXPacket = {
      universe,
      address: 1,  // siempre emitimos desde la dirección 1 del universo completo
      channels: new Array<number>(DMX_UNIVERSE_SIZE).fill(0),
    }
    this._packetPool.push(packet)

    // Si el universo se registra/rearma, reconstruir máscara en siguiente uso.
    this._softBlackoutMasks.delete(universe)
    this._softBlackoutBuffers.delete(universe)
    this._hardBlackoutBuffers.delete(universe)
  }

  /**
   * Resuelve el ArbitratedNodeMap a DMXPackets listos para el driver.
   *
   * @param arbitrated — Valores finales por nodo/canal (normalizados 0-1)
   * @returns Array de IDMXPacket, uno por universo activo
   */
  resolve(arbitrated: ArbitratedNodeMap): readonly IDMXPacket[] {
    this._resolveFrameIndex++

    // 1. Zero-fill y marcar universos como inactivos
    this._activeUniverses.clear()
    for (const [, buf] of this._universeBuffers) {
      buf.fill(0)
    }

    // 2. Para cada nodo arbitrado, escribir en el buffer del universo
    for (const [nodeId, channelValues] of arbitrated) {
      this._writeNode(nodeId, channelValues)
    }

    // 🌊 WAVE 4685: DarkSpin cross-node sweep.
    // DarkSpin state lives on COLOR nodes, but dimmer lives on IMPACT nodes.
    // After all nodes are written, zero IMPACT dimmer/shutter for any device
    // whose COLOR node is in wheel transit. This covers both manual fader
    // changes and Selene L1 global color effects.
    this._applyDarkSpinCrossNodeSweep()

    // 🔥 WAVE 4720: IGNITION INJECTION PASS — O(Σ injections per device)
    // Ejecutado DESPUÉS de todos los _writeNode() y DarkSpin.
    // Inyecta prerequisitos (ej. shutter=255) cuando el canal fuente está activo.
    // HTP: Math.max(buf[target], requiredValue) — nunca baja un valor más alto.
    this._applyIgnitionInjections()

    this._traceFirstDeviceDmxBytes(arbitrated.size)

    // 3. Ensamblar los packets de salida desde los buffers activos
    this._framePackets.clear()
    for (const universe of this._activeUniverses) {
      const buf = this._universeBuffers.get(universe)!
      const packet = this._getOrCreatePacket(universe)
      // Copiar Uint8Array → number[] del packet (hot path, pero limitado a universos activos)
      const channels = packet.channels
      for (let i = 0; i < DMX_UNIVERSE_SIZE; i++) {
        channels[i] = buf[i]
      }
      this._framePackets.set(universe, packet)
    }

    // Retornar como Array readonly (sin new Array — reutiliza la misma ref)
    return Array.from(this._framePackets.values()) as readonly IDMXPacket[]
  }

  /**
   * 🔥 WAVE 4720: Pre-computa el mapa de inyección de ignición para un device.
   *
   * Recopila todos los canales del device, busca los que tienen ignitionDeps,
   * y construye IgnitionInjection[] con índices de buffer absolutos.
   *
   * PATCH TIME — cero alloc en hot path.
   */
  private _precomputeIgnitionMap(deviceId: DeviceId): void {
    const device = this._graph.getDevice(deviceId)
    if (!device) return

    const nodeIds = this._graph.getDeviceNodes(deviceId)
    if (!nodeIds || nodeIds.length === 0) return

    const baseAddr = device.dmxAddress - 1  // 1-based → 0-indexed

    // 1. Collect all channels across all nodes of this device for dep resolution
    const allChannels: { type: string; dmxOffset: number }[] = []
    for (const nodeId of nodeIds) {
      const node = this._graph.getNodeData(nodeId)
      if (!node) continue
      for (const ch of node.channels) {
        allChannels.push({ type: ch.type, dmxOffset: ch.dmxOffset })
      }
    }

    // 2. Build injection rules from channels that declare ignitionDeps
    const injections: IgnitionInjection[] = []
    for (const nodeId of nodeIds) {
      const node = this._graph.getNodeData(nodeId)
      if (!node) continue

      for (const ch of node.channels) {
        if (!ch.ignitionDeps || ch.ignitionDeps.length === 0) continue

        const sourceBufIdx = baseAddr + ch.dmxOffset

        for (const dep of ch.ignitionDeps) {
          const target = allChannels.find(c => c.type === dep.targetChannelType)
          if (!target) {
            console.warn(
              `[NodeResolver] ⚠️ WAVE 4720: Ignition dep target "${dep.targetChannelType}" ` +
              `not found in device ${String(deviceId)} for source channel "${ch.type}"`
            )
            continue
          }
          injections.push({
            targetBufIdx: baseAddr + target.dmxOffset,
            requiredValue: dep.requiredValue,
            sourceBufIdx,
            mode: dep.mode,
          })
        }
      }
    }

    if (injections.length > 0) {
      this._ignitionMap.set(deviceId, injections)
      console.log(
        `[NodeResolver] 🔥 WAVE 4720: ${injections.length} ignition injection(s) ` +
        `pre-computed for device ${String(deviceId)}`
      )
    }
  }

  /**
   * 🔥 WAVE 4720: Inyecta valores de ignición en el buffer DMX — HOT PATH.
   *
   * Para cada device con ignition rules:
   *   'hold'    → buf[target] = max(buf[target], requiredValue) siempre
   *   'release' → idem, pero solo si buf[source] > 0
   *
   * HTP: NUNCA baja un valor que ya estuviera más alto (ej: operador
   * tiene shutter a 255 manualmente — la inyección no lo toca).
   *
   * Complejidad: O(Σ injections) ≈ O(2-4) por device de descarga.
   * Cero alloc. Cero búsqueda por tipo.
   */
  private _applyIgnitionInjections(): void {
    for (const [deviceId, injections] of this._ignitionMap) {
      const device = this._graph.getDevice(deviceId)
      if (!device) continue

      const buf = this._universeBuffers.get(device.universe)
      if (!buf) continue

      for (let i = 0; i < injections.length; i++) {
        const inj = injections[i]

        if (inj.targetBufIdx < 0 || inj.targetBufIdx >= DMX_UNIVERSE_SIZE) continue
        if (inj.sourceBufIdx < 0 || inj.sourceBufIdx >= DMX_UNIVERSE_SIZE) continue

        // 'release': only inject when source channel is active (> 0)
        if (inj.mode === 'release' && buf[inj.sourceBufIdx] === 0) continue

        // HTP: never lower an existing value
        if (buf[inj.targetBufIdx] < inj.requiredValue) {
          buf[inj.targetBufIdx] = inj.requiredValue
        }
      }
    }
  }

  private _traceFirstDeviceDmxBytes(activeNodeCount: number): void {
    if (this._resolveFrameIndex % AETHER_TICK_HEALTH_EVERY_FRAMES !== 0) return

    let sampleUniverse = this._activeUniverses.values().next().value as number | undefined
    if (sampleUniverse === undefined) {
      sampleUniverse = this._universeBuffers.keys().next().value as number | undefined
    }
    if (sampleUniverse === undefined) {
      console.log(
        `AETHER TICK | Nodos activos: ${activeNodeCount} | Primeros 10 bytes DMX: [] | Universos registrados: 0`
      )
      return
    }

    const sampleBuf = this._universeBuffers.get(sampleUniverse)
    if (!sampleBuf) return

    const dmxHead: number[] = []
    for (let i = 0; i < 10 && i < sampleBuf.length; i++) {
      dmxHead.push(sampleBuf[i])
    }

    const darkSpinTransit = this._safetyMiddleware
      ? this._safetyMiddleware.getDarkSpinTransitNodeIds().length
      : 0

    console.log(
      `AETHER TICK | Nodos activos: ${activeNodeCount} | `
      + `Primeros 10 bytes DMX: [${dmxHead.join(', ')}] | `
      + `Universos activos: ${this._activeUniverses.size} | `
      + `DarkSpin transit: ${darkSpinTransit}`
    )
  }

  private _traceProbeDeviceLayout(deviceId: NodeId): void {
    void deviceId
  }

  private _getOrBuildSoftBlackoutMask(universe: number): Uint8Array {
    const cached = this._softBlackoutMasks.get(universe)
    if (cached) return cached

    const mask = new Uint8Array(DMX_UNIVERSE_SIZE)
    const families: NodeFamily[] = [
      NodeFamily.IMPACT,
      NodeFamily.COLOR,
      NodeFamily.KINETIC,
      NodeFamily.BEAM,
      NodeFamily.ATMOSPHERE,
    ]

    for (let fi = 0; fi < families.length; fi++) {
      const view = this._graph.getView(families[fi])
      view.forEach((node) => {
        const device = this._graph.getDevice(node.deviceId)
        if (!device || device.universe !== universe) return

        const baseAddr = device.dmxAddress - 1
        for (let ci = 0; ci < node.channels.length; ci++) {
          const chDef = node.channels[ci]
          if (!SOFT_BLACKOUT_INTENSITY_CHANNELS.has(chDef.type)) continue

          const idx = baseAddr + chDef.dmxOffset
          if (idx >= 0 && idx < DMX_UNIVERSE_SIZE) {
            mask[idx] = 1
          }
          if (chDef.is16bit) {
            const fineIdx = idx + 1
            if (fineIdx >= 0 && fineIdx < DMX_UNIVERSE_SIZE) {
              mask[fineIdx] = 1
            }
          }
        }
      })
    }

    this._softBlackoutMasks.set(universe, mask)
    return mask
  }

  // ── Internos ──────────────────────────────────────────────────────────

  /**
   * Escribe los canales de un nodo en el buffer de universo correspondiente.
   *
   * WAVE 4522.4: Para nodos COLOR, los canales abstractos r/g/b del Aether
   * se traducen a los canales físicos del fixture (rgb, rgbw, cmy, wheel)
   * antes de escribir en el buffer DMX.
   *
   * Obtiene la IDeviceDefinition y el ICapabilityNode desde el NodeGraph,
   * aplica TransferCurve, calibración y constraints, y escribe en el buffer.
   */
  private _writeNode(nodeId: NodeId, channelValues: Readonly<Record<string, number>>): void {
    const node = this._graph.getNodeData(nodeId)
    if (!node) return

    const device = this._graph.getDevice(node.deviceId)
    if (!device) return

    const buf = this._universeBuffers.get(device.universe)
    if (!buf) return   // universe no registrado — ignorar silenciosamente

    // WAVE 4680: Smart Gate — bloqueo selectivo por familia + bypass manual.
    // gateOpen     → todo pasa normalmente.
    // !gateOpen    → solo KINETIC y nodos L2 (manual) escriben al buffer.
    //                IMPACT/COLOR/BEAM/ATMOSPHERE se bloquean (buffer ya en 0).
    const gateOpen = !this._safetyMiddleware || this._safetyMiddleware.isOutputEnabled()
    const isManualNode = this._safetyMiddleware ? this._safetyMiddleware.isManualNode(nodeId) : false
    const nodeBlocked = !gateOpen && !isManualNode && node.family !== NodeFamily.KINETIC

    const baseAddr = device.dmxAddress - 1  // convertir a 0-indexed
    const _t36probe = this._resolveFrameIndex % 20 === 0
      ? this._graph.getView(NodeFamily.IMPACT).count > 0
        ? this._graph.getView(NodeFamily.IMPACT).get(0)
        : undefined
      : undefined
    const _t36watchDeviceId = _t36probe?.deviceId

    // ═══ WAVE 4548.6: FORGE EVALUATOR BYPASS ═══
    // Si este device tiene un grafo Forge compilado,
    // delegar COMPLETAMENTE al ForgeNodeEvaluator.
    const compiled = this._forgeGraphs.get(node.deviceId)
    if (compiled) {
      if (nodeBlocked) return

      ForgeNodeEvaluator.evaluate(
        compiled,
        channelValues,
        this._forgeFrameContext,
        buf,
        baseAddr,
      )

      // ★ WAVE 4557: Post-Forge Safety Sweep — airbag + velocity clamp
      // The Forge evaluator bypasses ALL safety logic. Apply critical
      // protections on the buffer AFTER evaluation for kinetic outputs.
      const sm = this._safetyMiddleware
      if (sm && node.family === NodeFamily.KINETIC) {
        for (let ci = 0; ci < node.channels.length; ci++) {
          const chDef = node.channels[ci]
          const idx = baseAddr + chDef.dmxOffset
          if (idx < 0 || idx >= DMX_UNIVERSE_SIZE) continue

          if (chDef.type === PAN_COARSE) {
            buf[idx] = sm.clampKineticSingleAxis(node.nodeId, true, buf[idx])
            buf[idx] = sm.applyAirbag(buf[idx], true)
          } else if (chDef.type === TILT_COARSE) {
            buf[idx] = sm.clampKineticSingleAxis(node.nodeId, false, buf[idx])
            buf[idx] = sm.applyAirbag(buf[idx], false)
          }
        }
      }

      if (sm && node.family === NodeFamily.COLOR) {
        let wheelDmx: number | undefined
        let wheelTransitMs = 0
        const colorNode = node as IColorNodeData
        const darkSpinEligible = this._isDarkSpinEligibleColorNode(colorNode)

        for (let ci = 0; ci < node.channels.length; ci++) {
          const chDef = node.channels[ci]
          if (chDef.type !== CH_COLOR_WHEEL) continue

          const idx = baseAddr + chDef.dmxOffset
          if (idx < 0 || idx >= DMX_UNIVERSE_SIZE) continue

          wheelDmx = buf[idx]
          wheelTransitMs = colorNode.colorWheel?.minTransitionMs ?? 0
          break
        }

        if (darkSpinEligible && wheelDmx !== undefined && wheelTransitMs > 0) {
          const inBlackout = sm.checkDarkSpin(node.nodeId, wheelDmx, wheelTransitMs)
          if (inBlackout) {
            for (let ci = 0; ci < node.channels.length; ci++) {
              const chDef = node.channels[ci]
              if (chDef.type !== DIMMER_CHANNEL && chDef.type !== SHUTTER_CHANNEL) continue

              const idx = baseAddr + chDef.dmxOffset
              if (idx < 0 || idx >= DMX_UNIVERSE_SIZE) continue
              buf[idx] = 0
            }
          }
        }
      }

      this._activeUniverses.add(device.universe)
      return  // BYPASS: no ejecutar flujo legacy
    }

    const calibration = device.calibration
    if (!nodeBlocked) this._activeUniverses.add(device.universe)
    let invertClassicKineticAxes = false

    // ── WAVE 4631: SPLIT-BRAIN GATEKEEPER DETERMINISTA ─────────────────────
    // La ruta KINETIC se decide SOLO por la presencia de targetX en los valores
    // arbitrados del frame. No depende de flags estructurales del fixture.
    //
    //   targetX presente   + !isContinuous → RUTA ESPACIAL (IK puro)
    //   targetX ausente    o isContinuous  → RUTA CLÁSICA (pan/tilt directo)
    if (node.family === NodeFamily.KINETIC) {
      const kineticNode = node as IKineticNodeData
      const hasSpatialTarget = channelValues[CH_TARGET_X] !== undefined
      if (!kineticNode.isContinuous && hasSpatialTarget) {
        this._writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration, !nodeBlocked)
        return
      }
      invertClassicKineticAxes = this._shouldInvertClassicKineticAxes(device.orientation, kineticNode)
      // isContinuous (fan/mirrorball) o sin targetX → classic path
    }

    // ── WAVE 4522.4: Traducción cromática ─────────────────────────────
    // Si el nodo es de familia COLOR y tiene valores r/g/b arbitrados,
    // calculamos el mapa de canales físicos traducidos ANTES del bucle DMX.
    // Esto es zero-alloc: reutilizamos _translatedChannelValues que es un
    // objeto pre-allocated a nivel de función (stack local, no heap).
    let translatedValues: Readonly<Record<string, number>> = channelValues
    if (node.family === NodeFamily.COLOR) {
      const rNorm = channelValues[CH_R] ?? channelValues[CH_RED]
      const gNorm = channelValues[CH_G] ?? channelValues[CH_GREEN]
      const bNorm = channelValues[CH_B] ?? channelValues[CH_BLUE]
      if (rNorm !== undefined && gNorm !== undefined && bNorm !== undefined) {
        const colorData = node as IColorNodeData
        translatedValues = this._translateColor(
          nodeId,
          colorData.mixingType,
          colorData.colorWheel,
          rNorm, gNorm, bNorm,
          channelValues,
        )
      }
    }
    // ── Fin traducción cromática ───────────────────────────────────────

    // Telemetría legacy removida.

    for (let ci = 0; ci < node.channels.length; ci++) {
      const chDef: INodeChannelDef = node.channels[ci]
      const bufIdx = baseAddr + chDef.dmxOffset

      if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE) continue  // safety bound

      // WAVE 4735.2: Two-level lookup — zero-alloc.
      // translatedValues apunta al scratchpad (_colorTranslateScratch) para nodos COLOR,
      // o a channelValues directamente para el resto. El scratchpad usa NaN como centinela
      // ("no escrito este frame") para canales sin traducción específica.
      // En ese caso se cae al valor arbitrado original (channelValues).
      const _tv = translatedValues[chDef.type]
      let rawNormalized: number
      if (_tv !== undefined && !Number.isNaN(_tv)) {
        rawNormalized = _tv
      } else {
        const _cv = channelValues[chDef.type]
        rawNormalized = _cv !== undefined ? _cv : this._getDefaultNormalizedValue(node, chDef)
      }
      rawNormalized = sanitizeNormalizedValue(rawNormalized)

      // Telemetría legacy removida.

      // Aplicar TransferCurve
      let normalized = this._applyTransferCurve(rawNormalized, chDef, node.constraints.transferCurve)

      // Clamp al rango válido del constraint
      const maxDmx  = node.constraints.maxValue
      const maxNorm = maxDmx / 255
      if (normalized > maxNorm) normalized = maxNorm
      if (normalized < 0) normalized = 0

      // Escalar a DMX: [0, 255]
      let dmxValue = sanitizeDmxByte(Math.round(normalized * 255))

      // Aplicar calibración específica de canal
      if (calibration) {
        dmxValue = sanitizeDmxByte(this._applyCalibration(dmxValue, chDef.type, calibration))
      }

      // WAVE 4639: La inversión por orientación en ruta clásica se aplica
      // en dominio DMX final para respetar offsets/límites y corregir pivote.
      if (invertClassicKineticAxes && chDef.type === TILT_COARSE) {
        dmxValue = sanitizeDmxByte(255 - dmxValue)
      }

      // ★ WAVE 4557: Velocity clamp + Airbag for Classic pan/tilt path
      if (this._safetyMiddleware && node.family === NodeFamily.KINETIC) {
        if (PAN_CHANNELS.has(chDef.type) && chDef.type === PAN_COARSE) {
          dmxValue = sanitizeDmxByte(this._safetyMiddleware.clampKineticSingleAxis(node.nodeId, true, dmxValue))
          dmxValue = sanitizeDmxByte(this._safetyMiddleware.applyAirbag(dmxValue, true))
        } else if (TILT_CHANNELS.has(chDef.type) && chDef.type === TILT_COARSE) {
          dmxValue = sanitizeDmxByte(this._safetyMiddleware.clampKineticSingleAxis(node.nodeId, false, dmxValue))
          dmxValue = sanitizeDmxByte(this._safetyMiddleware.applyAirbag(dmxValue, false))
        }
      }

      // WAVE 4616: Pre-Vis rescue — currentPosition siempre debe actualizarse
      // con la matemática real aunque output esté desarmado.
      if (node.family === NodeFamily.KINETIC) {
        const kn = node as IKineticNodeData
        if (chDef.type === PAN_COARSE) {
          kn.currentPosition.pan  = dmxValue / 255
        } else if (chDef.type === TILT_COARSE) {
          kn.currentPosition.tilt = dmxValue / 255
        }
      }

      // Clamp final de seguridad
      dmxValue = sanitizeDmxByte(dmxValue)

      // 🔬 WAVE 4682: Strobe Ghost diagnostic
      if (chDef.type === STROBE_CHANNEL && dmxValue > 0) {
        // Leer desde channelValues, NO desde scratchpad (NaN para canales no-color)
        const arbStrobe = channelValues[STROBE_CHANNEL]
        console.log(
          `[StrobeGhost 🔎] nodeId=${nodeId} type=${chDef.type} ` +
          `dmxOut=${dmxValue} arbValue=${arbStrobe} defaultRaw=${chDef.defaultValue}`,
        )
      }

      if (nodeBlocked) continue

      // 🛂 WAVE 4735.3 FORENSIC: NaN sentinel defense-in-depth.
      // Nunca permitir NaN/Infinity fuera de [0..255] hacia el Uint8Array.
      buf[bufIdx] = Number.isNaN(dmxValue)
        ? 0
        : sanitizeDmxByte(dmxValue)

      // Telemetría legacy removida.

      // Canales 16-bit: escribir byte fine (LSB) en el slot siguiente
      if (chDef.is16bit) {
        const fineIdx = bufIdx + 1
        if (fineIdx < DMX_UNIVERSE_SIZE) {
          const raw16 = Math.round(normalized * 65535)
          const safeRaw16 = Number.isFinite(raw16) ? raw16 : 0
          buf[fineIdx] = sanitizeDmxByte(safeRaw16 & 0xFF)  // byte fine (LSB)
          // El byte coarse (MSB) ya fue escrito como (raw16 >> 8) arriba,
          // pero nuestro `dmxValue` ya redondeó al byte coarse.
          // Corregir el coarse para coherencia 16-bit:
          buf[bufIdx] = sanitizeDmxByte((safeRaw16 >> 8) & 0xFF)
        }
      }
    }
  }

  /**
   * 🌊 WAVE 4685: Cross-node DarkSpin sweep.
   * Scans devices with COLOR nodes in active wheel transit and zeroes
   * dimmer/shutter on their IMPACT nodes. Must run AFTER all _writeNode()
   * calls so the actual wheel DMX has been evaluated and checkDarkSpin
   * state is up to date.
   */
  private _applyDarkSpinCrossNodeSweep(): void {
    const sm = this._safetyMiddleware
    if (!sm) return

    const transitNodeIds = sm.getDarkSpinTransitNodeIds()
    if (transitNodeIds.length === 0) return

    // Collect unique deviceIds in transit
    const transitDevices = new Set<DeviceId>()
    for (const nodeId of transitNodeIds) {
      const node = this._graph.getNodeData(nodeId)
      if (!node || node.family !== NodeFamily.COLOR) continue
      if (!this._isDarkSpinEligibleColorNode(node as IColorNodeData)) continue
      transitDevices.add(node.deviceId)
    }
    if (transitDevices.size === 0) return

    // For each transit device, find its IMPACT nodes and kill dimmer/shutter
    for (const deviceId of transitDevices) {
      const device = this._graph.getDevice(deviceId)
      if (!device) continue
      const buf = this._universeBuffers.get(device.universe)
      if (!buf) continue
      const baseAddr = device.dmxAddress - 1
      const nodeIds = this._graph.getDeviceNodes(deviceId)
      if (!nodeIds) continue

      let killed = 0
      for (const nid of nodeIds) {
        const node = this._graph.getNodeData(nid)
        if (!node || node.family !== NodeFamily.IMPACT) continue

        for (const chDef of node.channels) {
          if (chDef.type !== DIMMER_CHANNEL && chDef.type !== SHUTTER_CHANNEL) continue
          const idx = baseAddr + chDef.dmxOffset
          if (idx < 0 || idx >= DMX_UNIVERSE_SIZE) continue
          if (buf[idx] > 0) {
            buf[idx] = 0
            killed++
          }
        }
      }

      if (killed > 0) {
        // Log only once when a device newly enters transit (not every frame)
        if (!this._darkSpinActiveDevices.has(deviceId)) {
          console.log(
            `[DarkSpin 🌑 WAVE 4685] device=${String(deviceId)} ` +
            `IMPACT dimmer/shutter zeroed (${killed} channels) — wheel in transit`
          )
        }
        this._darkSpinActiveDevices.add(deviceId)
      }
    }

    // Remove devices that are no longer in transit this frame
    for (const prevDeviceId of this._darkSpinActiveDevices) {
      if (!transitDevices.has(prevDeviceId)) {
        this._darkSpinActiveDevices.delete(prevDeviceId)
      }
    }
  }

  /**
   * WAVE 4523.5: Resuelve pan/tilt DMX para un nodo KINETIC con canales
   * espaciales (targetX/Y/Z en metros) vía IKEngine.
   *
   * Escribe directamente en el buffer DMX sin TransferCurve ni
   * _applyCalibration() — el IKEngine integra calibración en grados
   * internamente (anti-double-calibration).
   */
  private _writeNodeIK(
    node: IKineticNodeData,
    channelValues: Readonly<Record<string, number>>,
    baseAddr: number,
    buf: Uint8Array,
    calibration: IDeviceCalibration | undefined,
    nodeWriteEnabled: boolean,
  ): void {
    const txRaw = channelValues[CH_TARGET_X]
    if (!Number.isFinite(txRaw)) return
    const tx = txRaw
    const ty = sanitizeNormalizedValue(channelValues[CH_TARGET_Y], 1.5)
    const tz = sanitizeNormalizedValue(channelValues[CH_TARGET_Z], 2.0)

    if (this._resolveFrameIndex % MATH_TELEMETRY_EVERY_FRAMES === 0) {
      console.log(
        `[MATH-INPUT] id: ${String(node.deviceId)} | targetXYZ: ${tx.toFixed(3)},${ty.toFixed(3)},${tz.toFixed(3)}`,
      )
    }

    const profile      = this._getOrBuildIKProfile(node, calibration)
    const currentPanDMX = node.currentPosition.pan * 255

    const ikResult = solve(profile, { x: tx, y: ty, z: tz }, currentPanDMX)
    const reachable = ikResult.reachable !== false
    this._ikReachability.set(node.nodeId, reachable)

    if (!reachable) {
      const lastWarnFrame = this._ikLastWarnFrame.get(node.nodeId) ?? -IK_WARN_INTERVAL_FRAMES
      if ((this._resolveFrameIndex - lastWarnFrame) >= IK_WARN_INTERVAL_FRAMES) {
        this._ikLastWarnFrame.set(node.nodeId, this._resolveFrameIndex)
        console.warn(
          `[NodeResolver] IK unreachable | node=${String(node.nodeId)} device=${String(node.deviceId)} target=(${tx.toFixed(2)},${ty.toFixed(2)},${tz.toFixed(2)})`,
        )
      }
    }

    // ★ WAVE 4557: Velocity clamp + Airbag via AetherSafetyMiddleware
    let safePan  = sanitizeDmxByte(ikResult.pan)
    let safeTilt = sanitizeDmxByte(ikResult.tilt)
    const sm = this._safetyMiddleware
    if (sm) {
      const clamped = sm.clampKineticVelocity(node.nodeId, safePan, safeTilt)
      safePan  = sm.applyAirbag(clamped.pan, true)
      safeTilt = sm.applyAirbag(clamped.tilt, false)
    }

    // WAVE 4616: Pre-Vis rescue — siempre actualizar currentPosition con el
    // resultado matemático real, aunque la salida física esté desarmada.
    node.currentPosition.pan  = safePan  / 255
    node.currentPosition.tilt = safeTilt / 255

    if (this._resolveFrameIndex % MATH_TELEMETRY_EVERY_FRAMES === 0) {
      console.log(
        `[MATH-OUTPUT] id: ${String(node.deviceId)} | IK-Result: ${safePan.toFixed(1)}/${safeTilt.toFixed(1)} | currentPos: ${(node.currentPosition.pan * 255).toFixed(1)}/${(node.currentPosition.tilt * 255).toFixed(1)}`,
      )
    }

    // WAVE 4616: Gate final absoluto en el write DMX.
    if (!nodeWriteEnabled) return

    for (let ci = 0; ci < node.channels.length; ci++) {
      const chDef  = node.channels[ci]
      const isPan  = chDef.type === 'pan'
      const isTilt = chDef.type === 'tilt'
      if (!isPan && !isTilt) continue

      const bufIdx = baseAddr + chDef.dmxOffset
      if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE) continue

      const dmxValue = isPan ? safePan : safeTilt
      buf[bufIdx] = dmxValue

      if (chDef.is16bit) {
        const fineIdx = bufIdx + 1
        if (fineIdx < DMX_UNIVERSE_SIZE) {
          buf[fineIdx] = 0  // IKEngine produce resolución 8-bit; fine byte = 0
        }
      }
    }
  }

  /**
   * WAVE 4547.1: Telemetría de alcance IK para futura visualización Ghost Ray.
   * true=alcanzable, false=fuera de rango, undefined=nodo aún no resuelto.
   */
  getKineticReachability(nodeId: NodeId): boolean | undefined {
    return this._ikReachability.get(nodeId)
  }

  /**
   * WAVE 4637: Orientation awareness solo para la ruta clásica KINETIC.
   * IK NO pasa por este camino para evitar doble negación.
   */
  private _shouldInvertClassicKineticAxes(
    deviceOrientation: string | undefined,
    node: IKineticNodeData,
  ): boolean {
    const orientation = deviceOrientation?.toLowerCase().trim()
    if (orientation?.includes('ceiling') || orientation?.startsWith('truss')) {
      return true
    }

    const installation = node.ikOrientation?.installation
    if (installation === 'ceiling' || installation === 'truss-front' || installation === 'truss-back') {
      return true
    }

    const pitch = node.ikOrientation?.rotation?.pitch
    return Number.isFinite(pitch) && Math.abs(Math.abs(pitch as number) - 180) < 0.001
  }

  private _getDefaultNormalizedValue(
    _node: { family: NodeFamily; channels: readonly INodeChannelDef[] },
    chDef: INodeChannelDef,
  ): number {
    // WAVE 4682: _mapChannels ya defaulteó undefined→255 para shutter/strobe.
    // El fallback destructivo `(>0 ? dv : 255)` fue eliminado — ignoraba
    // defaultValue:0 explícito del fixture JSON y forzaba 255 (Open/strobe).
    return chDef.defaultValue / 255
  }

  /**
   * WAVE 4523.5: Construye y cachea el IKFixtureProfile para un nodo KINETIC.
   * Llamado lazy en la primera iteración del nodo — zero-alloc en steady state.
   *
   * Precedencia de calibración:
   *   1. node.ikCalibration (grados, formato nativo del IKEngine) — uso directo.
   *   2. device.calibration (DMX, formato legacy) — se extraen invert flags como
   *      fallback; offsets se dejan a 0 (no hay conversión DMX→grados fiable).
   */
  private _getOrBuildIKProfile(
    node: IKineticNodeData,
    calibration: IDeviceCalibration | undefined,
  ): IKFixtureProfile {
    const cached = this._ikProfiles.get(node.nodeId)
    if (cached !== undefined) return cached

    const ori = node.ikOrientation ?? DEFAULT_IK_ORIENTATION
    const lim = node.ikLimits

    const tiltLimits =
      lim?.tiltLimits ??
      (calibration?.tiltLimitMin !== undefined && calibration.tiltLimitMax !== undefined
        ? { min: calibration.tiltLimitMin, max: calibration.tiltLimitMax }
        : undefined)

    const profile = buildProfile(
      node.deviceId,
      node.physicalPosition,
      ori.rotation,
      ori.installation,
      node.ikCalibration ?? {
        panOffset:  0,
        tiltOffset: 0,
        panInvert:  calibration?.invertPan  ?? false,
        tiltInvert: calibration?.invertTilt ?? false,
      },
      lim?.panRangeDeg,
      lim?.tiltRangeDeg,
      tiltLimits,
    )

    this._ikProfiles.set(node.nodeId, profile)
    return profile
  }

  /**
   * WAVE 4522.4: Traduce r/g/b normalizados (0-1) a canales físicos
   * según el mixingType del nodo COLOR.
   *
   * RETORNA un Record<string, number> con los valores normalizados (0-1)
   * de los canales físicos resultantes. La llamada es zero-alloc porque
   * el objeto se construye como literal (escapa al stack en V8 hasta
   * que el JIT lo promueve; aceptable dado que ocurre solo en nodos COLOR).
   *
   * ESTRATEGIA POR TIPO:
   * - rgb  → red, green, blue (0-1)
   * - rgbw → red, green, blue, white (0-1, con W=min(r,g,b)/255)
   * - cmy  → cyan, magenta, yellow (0-1, inversión sustractiva)
   * - wheel → color_wheel (0-1 mapeado al slot DMX más cercano)
   *           gateado por HarmonicQuantizer al tempo musical
   * - hybrid → color_wheel + fallback a rgb si rueda no disponible
   *
   * @param nodeId - ID del nodo (para el quantizer)
   * @param mixingType - Tipo de mezcla de color del nodo
   * @param aetherWheel - Definición de rueda (Aether format, slots[])
   * @param rNorm - Canal R normalizado (0-1 del Aether)
   * @param gNorm - Canal G normalizado (0-1 del Aether)
   * @param bNorm - Canal B normalizado (0-1 del Aether)
   * @param original - Mapa original (para pass-through de otros canales)
   */
  private _translateColor(
    nodeId: NodeId,
    mixingType: ColorMixingType,
    aetherWheel: ColorWheelDefinition | undefined,
    rNorm: number,
    gNorm: number,
    bNorm: number,
    original: Readonly<Record<string, number>>,
  ): Readonly<Record<string, number>> {
    // 🌊 WAVE 4690: brightness (intensidad virtual L0) escala r/g/b de L1.
    // Fixtures RGB sin dimmer físico necesitan que brightness actúe como
    // master dimmer multiplicativo para que el DMX refleje la curva líquida.
    const brightnessMult = sanitizeNormalizedValue(original['brightness'], 1.0)
    // Escalar a 0-255 para el ColorTranslator (que trabaja en 255)
    const safeR = sanitizeNormalizedValue(rNorm) * brightnessMult
    const safeG = sanitizeNormalizedValue(gNorm) * brightnessMult
    const safeB = sanitizeNormalizedValue(bNorm) * brightnessMult
    this._rgbScratch.r = sanitizeDmxByte(Math.round(safeR * 255))
    this._rgbScratch.g = sanitizeDmxByte(Math.round(safeG * 255))
    this._rgbScratch.b = sanitizeDmxByte(Math.round(safeB * 255))

    // WAVE 4735.2: Reset centinelos NaN — "no escrito este frame".
    // El scratchpad se reutiliza cada llamada sin alloc (zero-alloc hot path).
    // NaN != undefined en la lookup de _writeNode, así V8 mantiene hidden class fija.
    const s = this._colorTranslateScratch
    s[CH_RED] = s[CH_GREEN] = s[CH_BLUE] = NaN
    s[CH_R]   = s[CH_G]    = s[CH_B]    = NaN
    s[CH_WHITE] = s[CH_CYAN] = s[CH_MAGENTA] = s[CH_YELLOW] = NaN
    s[CH_COLOR_WHEEL] = s[CH_AMBER] = s[CH_UV] = NaN
    s[DIMMER_CHANNEL] = NaN

    switch (mixingType) {

      // ── RGB / pass-through ──────────────────────────────────────────
      case 'rgb':
      default:
        // Emitir los canales físicos red/green/blue (nombres legacy del Aether).
        // También preservar r/g/b abstractos por si algún canal del nodo
        // tiene type='r'/'g'/'b' (fixtures puramente abstractos).
        s[CH_RED] = safeR; s[CH_GREEN] = safeG; s[CH_BLUE] = safeB
        s[CH_R]   = safeR; s[CH_G]    = safeG;  s[CH_B]   = safeB
        return s

      // ── RGBW ────────────────────────────────────────────────────────
      case 'rgbw': {
        const result = getColorTranslator().translate(this._rgbScratch, {
          colorEngine: { mixing: 'rgbw' },
        })
        const rgbw = result.rgbw
        if (!rgbw) {
          // Fallback: sin datos RGBW, pass-through RGB
          s[CH_RED] = safeR; s[CH_GREEN] = safeG; s[CH_BLUE] = safeB
          return s
        }
        s[CH_RED]   = rgbw.r / 255
        s[CH_GREEN] = rgbw.g / 255
        s[CH_BLUE]  = rgbw.b / 255
        s[CH_WHITE] = rgbw.w / 255
        s[CH_R]     = safeR; s[CH_G] = safeG; s[CH_B] = safeB
        return s
      }

      // ── CMY ─────────────────────────────────────────────────────────
      case 'cmy': {
        const result = getColorTranslator().translate(this._rgbScratch, {
          colorEngine: { mixing: 'cmy' },
        })
        const cmy = result.cmy
        if (!cmy) {
          s[CH_RED] = safeR; s[CH_GREEN] = safeG; s[CH_BLUE] = safeB
          return s
        }
        s[CH_CYAN]    = cmy.c / 255
        s[CH_MAGENTA] = cmy.m / 255
        s[CH_YELLOW]  = cmy.y / 255
        // Preservar abstractos por compatibilidad
        s[CH_R] = safeR; s[CH_G] = safeG; s[CH_B] = safeB
        return s
      }

      // ── COLOR WHEEL ─────────────────────────────────────────────────
      case 'wheel':
      case 'hybrid': {
        if (!aetherWheel || aetherWheel.slots.length === 0) {
          // Sin datos de rueda: pass-through RGB
          s[CH_RED] = safeR; s[CH_GREEN] = safeG; s[CH_BLUE] = safeB
          s[CH_R]   = safeR; s[CH_G]    = safeG;  s[CH_B]   = safeB
          return s
        }

        // Convertir ColorWheelDefinition del Aether (slots[]) al formato
        // del ColorTranslator HAL (colors[]) sin alloc persistente.
        const legacyWheel = this._aetherWheelToLegacy(aetherWheel)
        const result = getColorTranslator().translate(this._rgbScratch, {
          colorEngine: { mixing: 'wheel', colorWheel: legacyWheel },
        })

        // colorWheelDmx está en escala 0-255 — normalizar a 0-1 para el pipeline
        const wheelDmxRaw  = result.colorWheelDmx ?? 0
        let   wheelDmxNorm = wheelDmxRaw / 255

        // ── HarmonicQuantizer: gating musical de cambios de rueda ────
        // Solo bloquea si bpmConfidence > 0.3 (umbral interno del quantizer)
        const qResult = getHarmonicQuantizer().quantize(
          nodeId,
          this._rgbScratch,
          _currentBpm,
          _currentBpmConfidence,
          aetherWheel.minTransitionMs,
        )
        if (!qResult.colorAllowed) {
          // El quantizer bloquea el cambio: retener el último valor permitido.
          // Recuperamos el estado del quantizer para el último color que pasó.
          const qState = getHarmonicQuantizer().getFixtureState(nodeId)
          if (qState?.lastAllowedColor) {
            // El lastAllowedColor está en {r,g,b} 0-255.
            // Pasarlo otra vez por el translator para obtener el DMX de rueda correcto.
            const heldResult = getColorTranslator().translate(
              qState.lastAllowedColor,
              { colorEngine: { mixing: 'wheel', colorWheel: legacyWheel } },
            )
            wheelDmxNorm = (heldResult.colorWheelDmx ?? 0) / 255
          }
          // Si no hay lastAllowedColor, mantenemos el valor ya calculado
          // (puede ser 0 = Open en la primera retención).
        }

        // ★ WAVE 4557: DarkSpin — transit blackout via AetherSafetyMiddleware
        // If the color wheel value changed, force dimmer=0 during mechanical transit.
        // Applied AFTER HarmonicQuantizer (which decides IF the change occurs).
        const darkSpinEligible = this._isDarkSpinEligibleColorNode(
          this._graph.getNodeData(nodeId) as IColorNodeData | undefined,
        )
        if (this._safetyMiddleware && darkSpinEligible && aetherWheel.minTransitionMs > 0) {
          const wheelDmxForDarkSpin = Math.round(wheelDmxNorm * 255)
          const inBlackout = this._safetyMiddleware.checkDarkSpin(
            nodeId,
            wheelDmxForDarkSpin,
            aetherWheel.minTransitionMs,
          )
          if (inBlackout) {
            s[CH_COLOR_WHEEL] = wheelDmxNorm
            s[CH_R] = safeR; s[CH_G] = safeG; s[CH_B] = safeB
            s[DIMMER_CHANNEL] = 0  // ★ BLACKOUT: hide mechanical crystal transit
            return s
          }
        }

        // Para hybrid: también emitir canales RGB si el nodo los tiene
        s[CH_COLOR_WHEEL] = wheelDmxNorm
        s[CH_R] = safeR; s[CH_G] = safeG; s[CH_B] = safeB
        return s
      }
    }
  }

  /**
   * WAVE 4735.1 HOTFIX — DarkSpin solo para ruedas físicas.
   *
   * Regla de oro:
   * - RGB/CMY/electrónico puro (sin color_wheel) => DarkSpin abortado.
   * - Solo elegible cuando existe canal `color_wheel` y rueda mecánica válida.
   */
  private _isDarkSpinEligibleColorNode(node: IColorNodeData | undefined): boolean {
    if (!node || node.family !== NodeFamily.COLOR) return false

    let hasWheelChannel = false
    let hasElectronicMixChannels = false

    for (let i = 0; i < node.channels.length; i++) {
      const channelType = node.channels[i].type
      if (channelType === CH_COLOR_WHEEL) {
        hasWheelChannel = true
      } else if (ELECTRONIC_COLOR_CHANNELS.has(channelType)) {
        hasElectronicMixChannels = true
      }
    }

    if (hasElectronicMixChannels && !hasWheelChannel) return false

    return hasWheelChannel && !!node.colorWheel && node.colorWheel.minTransitionMs > 0
  }

  /**
   * WAVE 4522.4: Adapta ColorWheelDefinition del Aether (slots[]) al formato
   * que espera el ColorTranslator del HAL (colors[] con {dmx, name, rgb}).
   *
   * El resultado es un objeto inline — se construye cada llamada pero
   * el ColorTranslator tiene su propio LRU cache que absorbe la repetición.
   * Esta conversión solo ocurre en nodos wheel/hybrid.
   */
  private _aetherWheelToLegacy(wheel: ColorWheelDefinition): HalColorWheelDefinition {
    // WAVE 4735.2: WeakMap cache — las ColorWheelDefinition son estables durante un show
    // (solo cambian en patch). Evita el .map() en cada frame por nodo wheel.
    const cached = this._wheelLegacyCache.get(wheel)
    if (cached) return cached
    const result: HalColorWheelDefinition = {
      colors: wheel.slots.map(slot => ({
        dmx:  slot.dmxValue,
        name: slot.name,
        rgb:  { r: slot.previewRgb.r, g: slot.previewRgb.g, b: slot.previewRgb.b },
      })),
      allowsContinuousSpin: false,
      minChangeTimeMs:      wheel.minTransitionMs,
    }
    this._wheelLegacyCache.set(wheel, result)
    return result
  }


  /**
   * Aplica la TransferCurve al valor normalizado (0-1).
   *
   * Si no hay curva o el tipo es 'linear', retorna el valor sin modificar.
   * Las curvas codifican la relación perceptual entre el valor del System
   * (lineal) y el rango DMX del hardware.
   */
  private _applyTransferCurve(
    value: number,
    _chDef: INodeChannelDef,
    curve: TransferCurve | undefined,
  ): number {
    if (!curve || curve.type === 'linear') return value

    // Noise gate: input por debajo del umbral → output 0
    if (curve.noiseGate && value < curve.noiseGate) return 0

    switch (curve.type) {
      case 'exponential':
        return Math.pow(value, curve.exponent ?? 2.5)

      case 'logarithmic':
        // log(1 + value) / log(2) normalizado para que f(1) = 1
        return Math.log1p(value) / Math.log1p(1)

      case 'scurve':
        // Hermite S-curve suave: 3t²-2t³
        return value * value * (3 - 2 * value)

      case 'gamma':
        return Math.pow(value, 1 / (curve.gamma ?? 2.2))

      default:
        return value
    }
  }

  /**
   * Aplica calibración física al valor DMX final.
   *
   * Gestiona inversión de ejes, offsets y límites de seguridad.
   * Solo toca los canales relevantes para cada parámetro.
   */
  private _applyCalibration(
    dmxValue: number,
    channelType: string,
    calibration: NonNullable<NonNullable<ReturnType<INodeGraph['getDevice']>>['calibration']>,
  ): number {
    // ── Pan ──────────────────────────────────────────────────────────────
    if (PAN_CHANNELS.has(channelType)) {
      let v = dmxValue
      if (calibration.invertPan) v = 255 - v
      if (channelType === PAN_COARSE && calibration.panOffset) {
        v = v + calibration.panOffset
      }
      return v
    }

    // ── Tilt ─────────────────────────────────────────────────────────────
    if (TILT_CHANNELS.has(channelType)) {
      let v = dmxValue
      if (calibration.invertTilt) v = 255 - v
      if (channelType === TILT_COARSE && calibration.tiltOffset) {
        v = v + calibration.tiltOffset
      }
      // Límites de seguridad (solo en el canal coarse)
      if (channelType === TILT_COARSE) {
        if (calibration.tiltLimitMin !== undefined && v < calibration.tiltLimitMin) {
          v = calibration.tiltLimitMin
        }
        if (calibration.tiltLimitMax !== undefined && v > calibration.tiltLimitMax) {
          v = calibration.tiltLimitMax
        }
      }
      return v
    }

    // ── Dimmer scale ─────────────────────────────────────────────────────
    if (channelType === DIMMER_CHANNEL && calibration.dimmerScale !== undefined) {
      return Math.round(dmxValue * calibration.dimmerScale)
    }

    return dmxValue
  }

  /**
   * Obtiene o crea un MutableDMXPacket del pool para un universo dado.
   * Zero-alloc si el universo ya existe en el pool.
   */
  private _getOrCreatePacket(universe: number): MutableDMXPacket {
    for (let i = 0; i < this._packetPool.length; i++) {
      if (this._packetPool[i].universe === universe) {
        return this._packetPool[i]
      }
    }
    // No debería llegar aquí si registerUniverse() fue llamado correctamente
    // en patch time. Creamos el packet como fallback.
    const packet: MutableDMXPacket = {
      universe,
      address: 1,
      channels: new Array<number>(DMX_UNIVERSE_SIZE).fill(0),
    }
    this._packetPool.push(packet)
    return packet
  }
}
