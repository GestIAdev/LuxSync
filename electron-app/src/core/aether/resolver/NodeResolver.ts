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

import type { NodeId, ColorMixingType, ColorWheelDefinition } from '../types'
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

// ── Canales espaciales 3D — WAVE 4523.5 ──────────────────────────────────
// Emitidos por KineticAdapter cuando el nodo opera en flujo IK (metros).
const CH_TARGET_X = 'targetX'
const CH_TARGET_Y = 'targetY'
const CH_TARGET_Z = 'targetZ'

const IK_WARN_INTERVAL_FRAMES = 44

// ── Canales que deben pasar por traducción cromática ─────────────────────
// Si el mapa arbitrado del nodo contiene alguno de estos, es un nodo COLOR.
const COLOR_ABSTRACT_CHANNELS = new Set<string>([CH_R, CH_G, CH_B])

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

  constructor(graph: INodeGraph) {
    this._graph = graph
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
   * Lista de universos actualmente registrados (por registerUniverse()).
   * Útil para iterar en el Orchestrator sin crear un Array nuevo.
   */
  get registeredUniverses(): IterableIterator<number> {
    return this._universeBuffers.keys()
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

    const baseAddr = device.dmxAddress - 1  // convertir a 0-indexed
    const calibration = device.calibration
    this._activeUniverses.add(device.universe)

    // ── WAVE 4523.5: Flujo IK — canales espaciales (metros) ───────────────
    // Si el nodo KINETIC contiene targetX, desviar al IKEngine en lugar del
    // flujo legacy pan/tilt normalizado. El IKEngine aplica toda la calibración
    // internamente → NO llamar _applyCalibration() (anti-double-calibration).
    if (channelValues[CH_TARGET_X] !== undefined && node.family === NodeFamily.KINETIC) {
      const kineticNode = node as IKineticNodeData
      if (!kineticNode.isContinuous) {
        this._writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration)
      }
      return  // nodo continuo (fan/mirrorball) ignora IK de apuntado
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

    for (let ci = 0; ci < node.channels.length; ci++) {
      const chDef: INodeChannelDef = node.channels[ci]
      const bufIdx = baseAddr + chDef.dmxOffset

      if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE) continue  // safety bound

      // Valor normalizado arbitrado (usando translatedValues que puede ser
      // el mapa original o el mapa con canales físicos ya calculados).
      const rawNormalized: number = translatedValues[chDef.type] !== undefined
        ? translatedValues[chDef.type]
        : chDef.defaultValue / 255

      // Aplicar TransferCurve
      let normalized = this._applyTransferCurve(rawNormalized, chDef, node.constraints.transferCurve)

      // Clamp al rango válido del constraint
      const maxDmx  = node.constraints.maxValue
      const maxNorm = maxDmx / 255
      if (normalized > maxNorm) normalized = maxNorm
      if (normalized < 0) normalized = 0

      // Escalar a DMX: [0, 255]
      let dmxValue = Math.round(normalized * 255)

      // Aplicar calibración específica de canal
      if (calibration) {
        dmxValue = this._applyCalibration(dmxValue, chDef.type, calibration)
      }

      // Clamp final de seguridad
      if (dmxValue < 0)   dmxValue = 0
      if (dmxValue > 255) dmxValue = 255

      buf[bufIdx] = dmxValue

      // Canales 16-bit: escribir byte fine (LSB) en el slot siguiente
      if (chDef.is16bit) {
        const fineIdx = bufIdx + 1
        if (fineIdx < DMX_UNIVERSE_SIZE) {
          const raw16 = Math.round(normalized * 65535)
          buf[fineIdx] = raw16 & 0xFF  // byte fine (LSB)
          // El byte coarse (MSB) ya fue escrito como (raw16 >> 8) arriba,
          // pero nuestro `dmxValue` ya redondeó al byte coarse.
          // Corregir el coarse para coherencia 16-bit:
          buf[bufIdx] = (raw16 >> 8) & 0xFF
        }
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
  ): void {
    const tx = channelValues[CH_TARGET_X]!
    const ty = channelValues[CH_TARGET_Y] ?? 1.5
    const tz = channelValues[CH_TARGET_Z] ?? 2.0

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

    for (let ci = 0; ci < node.channels.length; ci++) {
      const chDef  = node.channels[ci]
      const isPan  = chDef.type === 'pan'
      const isTilt = chDef.type === 'tilt'
      if (!isPan && !isTilt) continue

      const bufIdx = baseAddr + chDef.dmxOffset
      if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE) continue

      const dmxValue = isPan ? ikResult.pan : ikResult.tilt
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
    // Escalar a 0-255 para el ColorTranslator (que trabaja en 255)
    this._rgbScratch.r = Math.round(rNorm * 255)
    this._rgbScratch.g = Math.round(gNorm * 255)
    this._rgbScratch.b = Math.round(bNorm * 255)

    switch (mixingType) {

      // ── RGB / pass-through ──────────────────────────────────────────
      case 'rgb':
      default:
        // Emitir los canales físicos red/green/blue (nombres legacy del Aether).
        // También preservar r/g/b abstractos por si algún canal del nodo
        // tiene type='r'/'g'/'b' (fixtures puramente abstractos).
        return {
          ...original,
          [CH_RED]:   rNorm,
          [CH_GREEN]: gNorm,
          [CH_BLUE]:  bNorm,
          [CH_R]:     rNorm,
          [CH_G]:     gNorm,
          [CH_B]:     bNorm,
        }

      // ── RGBW ────────────────────────────────────────────────────────
      case 'rgbw': {
        const result = getColorTranslator().translate(this._rgbScratch, {
          colorEngine: { mixing: 'rgbw' },
        })
        const rgbw = result.rgbw
        if (!rgbw) {
          // Fallback: sin datos RGBW, pass-through RGB
          return { ...original, [CH_RED]: rNorm, [CH_GREEN]: gNorm, [CH_BLUE]: bNorm }
        }
        return {
          ...original,
          [CH_RED]:   rgbw.r / 255,
          [CH_GREEN]: rgbw.g / 255,
          [CH_BLUE]:  rgbw.b / 255,
          [CH_WHITE]: rgbw.w / 255,
          [CH_R]:     rNorm,
          [CH_G]:     gNorm,
          [CH_B]:     bNorm,
        }
      }

      // ── CMY ─────────────────────────────────────────────────────────
      case 'cmy': {
        const result = getColorTranslator().translate(this._rgbScratch, {
          colorEngine: { mixing: 'cmy' },
        })
        const cmy = result.cmy
        if (!cmy) {
          return { ...original, [CH_RED]: rNorm, [CH_GREEN]: gNorm, [CH_BLUE]: bNorm }
        }
        return {
          ...original,
          [CH_CYAN]:    cmy.c / 255,
          [CH_MAGENTA]: cmy.m / 255,
          [CH_YELLOW]:  cmy.y / 255,
          // Preservar abstractos por compatibilidad
          [CH_R]: rNorm,
          [CH_G]: gNorm,
          [CH_B]: bNorm,
        }
      }

      // ── COLOR WHEEL ─────────────────────────────────────────────────
      case 'wheel':
      case 'hybrid': {
        if (!aetherWheel || aetherWheel.slots.length === 0) {
          // Sin datos de rueda: pass-through RGB
          return {
            ...original,
            [CH_RED]: rNorm, [CH_GREEN]: gNorm, [CH_BLUE]: bNorm,
            [CH_R]:   rNorm, [CH_G]:     gNorm, [CH_B]:    bNorm,
          }
        }

        // Convertir ColorWheelDefinition del Aether (slots[]) al formato
        // del ColorTranslator HAL (colors[]) sin alloc persistente.
        const legacyWheel = this._aetherWheelToLegacy(aetherWheel)
        const profile = { colorEngine: { mixing: 'wheel' }, colorEngine_wheel: legacyWheel }
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

        // Para hybrid: también emitir canales RGB si el nodo los tiene
        return {
          ...original,
          [CH_COLOR_WHEEL]: wheelDmxNorm,
          [CH_R]: rNorm,
          [CH_G]: gNorm,
          [CH_B]: bNorm,
        }
      }
    }
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
    return {
      colors: wheel.slots.map(slot => ({
        dmx:  slot.dmxValue,
        name: slot.name,
        rgb:  { r: slot.previewRgb.r, g: slot.previewRgb.g, b: slot.previewRgb.b },
      })),
      allowsContinuousSpin: false,
      minChangeTimeMs:      wheel.minTransitionMs,
    }
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
