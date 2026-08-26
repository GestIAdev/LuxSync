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
import { applyDMXGovernors, buildGovernorLookupMap } from './DMXGovernorEvaluator';
import { NodeFamily } from '../types';
import { getColorTranslator } from '../../../hal/translation/ColorTranslator';
import { getHarmonicQuantizer } from '../../../hal/translation/HarmonicQuantizer';
import { solveInto, buildProfile } from '../../../engine/movement/InverseKinematicsEngine';
import { DEFAULT_FORGE_FRAME_CONTEXT } from '../../forge/compiler/types';
import { ForgeNodeEvaluator } from '../../forge/evaluator/ForgeNodeEvaluator';
// ── Canales de posición para calibración ────────────────────────────────
const PAN_CHANNELS = new Set(['pan', 'pan_fine']);
const TILT_CHANNELS = new Set(['tilt', 'tilt_fine']);
const PAN_COARSE = 'pan';
const TILT_COARSE = 'tilt';
const DIMMER_CHANNEL = 'dimmer';
// ── Canales cromáticos abstractos del Aether ────────────────────────────
// El ColorAdapter (L1) emite SIEMPRE r/g/b normalizados.
// El NodeResolver traduce estos a los canales físicos según mixingType.
const CH_R = 'r';
const CH_G = 'g';
const CH_B = 'b';
const CH_RED = 'red';
const CH_GREEN = 'green';
const CH_BLUE = 'blue';
const CH_WHITE = 'white';
const CH_CYAN = 'cyan';
const CH_MAGENTA = 'magenta';
const CH_YELLOW = 'yellow';
const CH_COLOR_WHEEL = 'color_wheel';
const CH_AMBER = 'amber';
const CH_UV = 'uv';
// ── Canales espaciales 3D — WAVE 4523.5 ──────────────────────────────────
// Emitidos por KineticAdapter cuando el nodo opera en flujo IK (metros).
const CH_TARGET_X = 'targetX';
const CH_TARGET_Y = 'targetY';
const CH_TARGET_Z = 'targetZ';
const SHUTTER_CHANNEL = 'shutter';
const STROBE_CHANNEL = 'strobe';
const SOFT_BLACKOUT_INTENSITY_CHANNELS = new Set([
    DIMMER_CHANNEL,
]);
const IK_WARN_INTERVAL_FRAMES = 44;
const MATH_TELEMETRY_EVERY_FRAMES = 30;
const IK_DEFAULT_PAN_RANGE_DEG = 540;
const IK_DEFAULT_TILT_RANGE_DEG = 270;
// 🏗️ WAVE 7179 (M4): VMM offset scale factors for post-solve DMX-domain fusion.
// Mirror NodeArbiter's RELATIVE_OFFSET_SCALE_PAN/TILT — preserves legacy visual behavior.
const VMM_OFFSET_SCALE_PAN = 0.5;
const VMM_OFFSET_SCALE_TILT = 0.5;
const VMM_GIMBAL_TILT_CENTER = 0.5;
const VMM_GIMBAL_TILT_FADE_HALFWIDTH = 10 / 255;
// WAVE 4735.3: auditoría de salud del tick Aether (~2.27s @ 44Hz)
const AETHER_TICK_HEALTH_EVERY_FRAMES = 100;
function sanitizeNormalizedValue(value, fallback = 0) {
    return value !== undefined && Number.isFinite(value) ? value : fallback;
}
function sanitizeDmxByte(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value < 0) {
        return 0;
    }
    if (value > 255) {
        return 255;
    }
    return value;
}
// ── Canales que deben pasar por traducción cromática ─────────────────────
// Si el mapa arbitrado del nodo contiene alguno de estos, es un nodo COLOR.
const COLOR_ABSTRACT_CHANNELS = new Set([CH_R, CH_G, CH_B]);
// WAVE 4735.1 HOTFIX: canales de mezcla electrónica.
// Si un nodo usa estos canales y NO tiene color_wheel físico, DarkSpin debe abortarse.
const ELECTRONIC_COLOR_CHANNELS = new Set([
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
]);
// ── Orientación IK por defecto — ceiling mount, sin rotación custom ───────
const DEFAULT_IK_ORIENTATION = {
    installation: 'ceiling',
    rotation: { pitch: 0, yaw: 0, roll: 0 },
};
// ── DMX universe size ────────────────────────────────────────────────────
const DMX_UNIVERSE_SIZE = 512;
// ── Contexto de frame para el HarmonicQuantizer ──────────────────────────
// Inyectado via setResolveContext() antes de cada llamada a resolve().
// Valores por defecto conservadores (sin cuantización activa).
let _currentBpm = 120;
let _currentBpmConfidence = 0.0;
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
export class NodeResolver {
    constructor(graph) {
        // ── Cache IKFixtureProfile por nodo — WAVE 4523.5 ─────────────────────
        // Construido lazy en primer uso. Los datos de perfil IK son readonly:
        // posición, orientación y calibración no cambian en runtime.
        // Invalidar únicamente en re-patch (implica crear un NodeResolver nuevo).
        this._ikProfiles = new Map();
        this._ikReachability = new Map();
        this._ikLastWarnFrame = new Map();
        // WAVE 7624: IK MEMORY ISOLATION — stores the PURE IK pan (before L0 offset)
        // for the anti-flip shortest-path heuristic. Without this, the offset-polluted
        // currentPosition.pan feeds back into solveInto's resolveShortestPanPath,
        // corrupting the flip decision when the offset pushes past the midpoint.
        this._ikPurePanMemory = new Map();
        this._resolveFrameIndex = 0;
        // 🛠️ WAVE 5034: Pre-allocated IKResult scratch — zero alloc en hot path.
        this._ikResultScratch = { pan: 0, tilt: 0, pan16: 0, tilt16: 0, reachable: false, antiFlipApplied: false };
        // 🛠️ WAVE 5034: Pre-allocated kinetic clamp scratch — zero alloc en hot path.
        this._kineticClampScratch = { pan: 0, tilt: 0 };
        // K0-BATCH-3c: Pre-allocated IK target scratch — zero alloc en hot path.
        this._ikTargetScratch = { x: 0, y: 0, z: 0 };
        // ── Scratch RGB — reutilizado en hot path sin alloc ──────────────────
        // Mutable in-place, pasado al ColorTranslator por referencia.
        // INVARIANTE: solo válido durante _translateColor(); no exponer.
        this._rgbScratch = { r: 0, g: 0, b: 0 };
        // ── WAVE 4735.2: Color output scratchpad — zero-alloc en hot path ────
        // Sustituye la creación de objetos literales con `...original` spread
        // en cada llamada a _translateColor(). Se muta y se retorna su referencia.
        // NaN = "no escrito en este frame" (sentinel para el fallback en _writeNode).
        // INVARIANTE: solo válido sincrónicamente durante _writeNode(); no retener.
        this._colorTranslateScratch = Object.create(null);
        // ── WAVE 4735.2: WeakMap cache para _aetherWheelToLegacy ─────────────
        // La conversión slots[] → colors[] solo ocurre una vez por rueda mecánica
        // durante la vida del show (las ruedas son patch-time, no cambian a 44Hz).
        this._wheelLegacyCache = new WeakMap();
        // 🛠️ WAVE 5034: Cache del profile wrapper { colorEngine: { mixing, colorWheel } }
        // para eliminar la creación de objeto literal cada frame por nodo wheel.
        this._wheelProfileCache = new Map();
        // 🛠️ WAVE 5034: Pre-allocated profile objects para RGBW y CMY — zero alloc per frame.
        this._rgbwProfile = Object.freeze({ colorEngine: { mixing: 'rgbw' } });
        this._cmyProfile = Object.freeze({ colorEngine: { mixing: 'cmy' } });
        // ── Buffers por universo ───────────────────────────────────────────────
        // Map<universe (0-based, ArtNet convention), Uint8Array(512)>
        // Pre-allocated en registerDevice(), re-usado frame a frame.
        this._universeBuffers = new Map();
        // Lleva registro de qué universos tienen datos reales este frame
        // para emitir solo los paquetes relevantes.
        this._activeUniverses = new Set();
        // ── Pool de salida pre-allocated ─────────────────────────────────────
        // Array de MutableDMXPacket reutilizados frame a frame.
        // Se crece en registerDevice() y se estabiliza tras patch-time.
        this._packetPool = [];
        // Map<universe, MutableDMXPacket> — solo los paquetes del frame actual
        this._framePackets = new Map();
        // 🛠️ WAVE 5034: Pre-allocated return array — zero alloc en hot path.
        // Se muta in-place cada frame en lugar de Array.from().
        this._packetArray = [];
        // ── Smart Blackout (WAVE 4656.1) ────────────────────────────────────
        // Máscara por universo de canales de intensidad que deben ir a 0
        // durante blackout blando (sin tocar pan/tilt/speed/rotation).
        this._softBlackoutMasks = new Map();
        // Buffers de salida pre-alloc para blackout por universo.
        this._softBlackoutBuffers = new Map();
        // Buffers de blackout duro (todos los canales a 0) por universo.
        this._hardBlackoutBuffers = new Map();
        // ── WAVE 4548.6: Forge compiled graphs por device ──────────────────
        // Si un device tiene un CompiledForgeGraph, _writeNode() delega
        // completamente al ForgeNodeEvaluator — bypass total del flujo legacy.
        this._forgeGraphs = new Map();
        // Acumulador por device para evaluar Forge UNA sola vez por fixture/frame.
        // Evita que múltiples nodos (golden-master + petal-l/c/r) se pisen entre sí.
        this._forgeAccumValues = new Map();
        this._forgeManualDevices = new Set();
        this._forgeValuePool = [];
        this._forgeValuePoolCursor = 0;
        this._forgeFrameContext = DEFAULT_FORGE_FRAME_CONTEXT;
        // 🛂 WAVE 4557: Safety middleware for velocity clamping, airbag, DarkSpin
        this._safetyMiddleware = null;
        // �️ WAVE 7179 (M4): VMM spatial params — dist_scale per node + global amplitude.
        // Mirrors NodeArbiter's state. Set by AetherIPCHandlers alongside the arbiter setters.
        // Used in _writeNodeIK to apply VMM offsets post-solve in DMX domain.
        this._spatialDistanceScales = new Map();
        this._relativeOffsetAmplitude = 1.0;
        // �� WAVE 4703: Tracks devices currently in DarkSpin transit to suppress per-frame log spam.
        // Cleared each sweep — log fires only on the first frame a device enters transit.
        this._darkSpinActiveDevices = new Set();
        // HS-2: Pre-allocated transit devices scratch — zero alloc @ 44Hz.
        this._transitDevicesScratch = new Set();
        // 🔥 WAVE 4720: IGNITION ENGINE — Pre-computed injection map (patch-time only)
        // Key: DeviceId  Value: array of IgnitionInjection rules
        // Built once in _precomputeIgnitionMap(); iterated O(2-4) times per frame in resolve().
        // ZERO ALLOC in hot path — all arrays created at patch time.
        this._ignitionMap = new Map();
        // �️ F9: Precomputed governor lookup maps — O(1) channelOffset → IDMXGovernor.
        // Built at patch time in registerDevice(). Zero-alloc in hot path.
        this._governorMaps = new Map();
        // �� WAVE 4685.1: DarkSpin buffer sweep — pre-computed wheel device entries.
        // Built at patch time in _precomputeWheelDeviceEntry().
        // Iterated zero-alloc in hot path — no new arrays, no spreads.
        this._wheelDeviceEntries = [];
        // Last known color_wheel DMX byte per device (mutated in-place, zero-alloc).
        this._lastWheelBytes = new Map();
        this._graph = graph;
        // Pre-establecer la forma del scratchpad para que V8 use hidden class fija.
        // NaN = sentinel (no escrito). Los valores reales se asignan en _translateColor().
        const s = this._colorTranslateScratch;
        s[CH_RED] = s[CH_GREEN] = s[CH_BLUE] = NaN;
        s[CH_R] = s[CH_G] = s[CH_B] = NaN;
        s[CH_WHITE] = s[CH_CYAN] = s[CH_MAGENTA] = s[CH_YELLOW] = NaN;
        s[CH_COLOR_WHEEL] = s[CH_AMBER] = s[CH_UV] = NaN;
        s[DIMMER_CHANNEL] = NaN;
    }
    /**
     * WAVE 4557: Inyecta el AetherSafetyMiddleware.
     * Llamar en patch-time, antes del primer frame.
     */
    setSafetyMiddleware(middleware) {
        this._safetyMiddleware = middleware;
    }
    /**
     * WAVE 7626: Getter for the safety middleware. Used by AetherIPCHandlers
     * to reset the velocity-clamp state on pattern switch.
     */
    getSafetyMiddleware() {
        return this._safetyMiddleware;
    }
    /**
     * 🏗️ WAVE 7179 (M4): Setter de la escala de distancia por nodo.
     * Espejo de NodeArbiter.setSpatialDistanceScale — llamado desde AetherIPCHandlers.
     */
    setSpatialDistanceScale(nodeId, scale) {
        if (!Number.isFinite(scale))
            return;
        const clamped = scale < 0.25 ? 0.25 : scale > 2 ? 2 : scale;
        this._spatialDistanceScales.set(nodeId, clamped);
    }
    /**
     * 🏗️ WAVE 7179 (M4): Setter de la amplitud global del offset relativo.
     * Espejo de NodeArbiter.setRelativeOffsetAmplitude — llamado desde AetherIPCHandlers.
     */
    setRelativeOffsetAmplitude(value) {
        if (!Number.isFinite(value))
            return;
        this._relativeOffsetAmplitude = value < 0 ? 0 : value > 2 ? 2 : value;
    }
    /** 🏗️ WAVE 7179 (M4): Limpiar la escala de distancia de un nodo (release). */
    clearSpatialDistanceScale(nodeId) {
        this._spatialDistanceScales.delete(nodeId);
        // WAVE 7624: Clear the pure pan memory on release to avoid stale flip
        // heuristic on re-activation.
        this._ikPurePanMemory.delete(nodeId);
    }
    /**
     * 🏗️ WAVE 7179 (M5): Invalida el cache del IKFixtureProfile para un nodo.
     * Llamado cuando la calibración del fixture cambia en runtime (Calibration Dock).
     * El siguiente frame re-construirá el perfil con la nueva calibración.
     */
    invalidateIKProfile(nodeId) {
        this._ikProfiles.delete(nodeId);
    }
    /**
     * WAVE 7610: Live calibration hot-reload.
     *
     * Directly mutates `node.ikCalibration` in the NodeGraph and invalidates
     * the IK profile cache. The very next TickEngine frame will rebuild the
     * IKFixtureProfile with the new calibration offsets — producing immediate
     * DMX output changes without requiring a full re-patch.
     *
     * Called by the Calibration Dock when the user drags the Offset Trim sliders.
     * Values are in DEGREES (panOffset, tiltOffset) and booleans (panInvert, tiltInvert).
     *
     * @param nodeId      - Target kinetic node ID (e.g. "fixture-01:kinetic")
     * @param calibration - New calibration values in degree domain
     */
    updateLiveCalibration(nodeId, calibration) {
        const node = this._graph.getNodeData(nodeId);
        if (!node || node.family !== NodeFamily.KINETIC) {
            console.warn(`[NodeResolver] updateLiveCalibration: node ${nodeId} not found or not KINETIC`);
            return;
        }
        // Direct mutation — getNodeData returns a live reference, not a copy.
        // The `readonly` on IKineticNodeData is a compile-time constraint; at runtime
        // the object is a plain mutable JS object. This is the same pattern used by
        // currentPosition updates in _writeNodeIK (line 1638).
        ;
        node.ikCalibration = {
            panOffset: calibration.panOffset,
            tiltOffset: calibration.tiltOffset,
            panInvert: calibration.panInvert,
            tiltInvert: calibration.tiltInvert,
        };
        // Invalidate cache so next frame rebuilds the profile with new calibration
        this._ikProfiles.delete(nodeId);
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
    registerDevice(deviceId) {
        this._ignitionMap.delete(deviceId); // limpiar si re-patch
        this._precomputeIgnitionMap(deviceId);
        this._precomputeWheelDeviceEntry(deviceId);
        this._precomputeGovernorMap(deviceId);
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
    setResolveContext(bpm, bpmConfidence) {
        _currentBpm = bpm;
        _currentBpmConfidence = bpmConfidence;
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
     * @param universe — Número de universo (0-based, ArtNet convention)
     * @returns Uint8Array(512) o undefined si el universo no está registrado
     */
    getUniverseBuffer(universe) {
        return this._universeBuffers.get(universe);
    }
    /**
     * WAVE 4656.1: Smart Blackout por universo.
     *
     * Copia el buffer resuelto del universo y fuerza a 0 únicamente los
      * canales de dimmer, preservando movimiento y el resto del estado
      * fotométrico/cinemático para seguridad mecánica.
     */
    getSoftBlackoutUniverseBuffer(universe, source) {
        let out = this._softBlackoutBuffers.get(universe);
        if (!out) {
            out = new Uint8Array(DMX_UNIVERSE_SIZE);
            this._softBlackoutBuffers.set(universe, out);
        }
        out.set(source);
        const mask = this._getOrBuildSoftBlackoutMask(universe);
        for (let i = 0; i < DMX_UNIVERSE_SIZE; i++) {
            if (mask[i] === 1)
                out[i] = 0;
        }
        return out;
    }
    /**
     * WAVE 4666: Hard blackout por universo.
     *
     * Retorna un buffer pre-allocated de 512 canales en 0 para blackout total.
     */
    getHardBlackoutUniverseBuffer(universe) {
        let out = this._hardBlackoutBuffers.get(universe);
        if (!out) {
            out = new Uint8Array(DMX_UNIVERSE_SIZE);
            this._hardBlackoutBuffers.set(universe, out);
        }
        return out;
    }
    /**
     * Lista de universos actualmente registrados (por registerUniverse()).
     * Útil para iterar en el Orchestrator sin crear un Array nuevo.
     */
    get registeredUniverses() {
        return this._universeBuffers.keys();
    }
    /**
     * WAVE 4680: Universos que tienen al menos un nodo no bloqueado este frame.
     * Útil para el egress loop cuando outputEnabled=false (Smart Gate).
     */
    get activeUniverses() {
        return this._activeUniverses.values();
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
    registerForgeGraph(deviceId, compiled) {
        this._forgeGraphs.set(deviceId, compiled);
    }
    /**
     * Retira el grafo Forge compilado de un device.
     * El device volverá al flujo legacy en el próximo frame.
     */
    unregisterForgeGraph(deviceId) {
        this._forgeGraphs.delete(deviceId);
    }
    /**
     * Inyecta el contexto de frame para el Forge evaluator.
     * Llamar desde el Orchestrator junto con setResolveContext().
     */
    setForgeFrameContext(ctx) {
        this._forgeFrameContext = ctx;
    }
    /**
     * Registra un universo DMX para este resolver.
     *
     * PATCH TIME — llamar cuando se registra un Device en el NodeGraph.
     * Si el universo ya existe, no hace nada.
     *
     * @param universe — Número de universo (0-based, ArtNet convention)
     */
    registerUniverse(universe) {
        if (this._universeBuffers.has(universe))
            return;
        // Pre-allocar buffer de 512 bytes para el universo
        this._universeBuffers.set(universe, new Uint8Array(DMX_UNIVERSE_SIZE));
        // Pre-allocar el packet del pool (channels como Array para compatibilidad IDMXPacket)
        const packet = {
            universe,
            address: 1, // siempre emitimos desde la dirección 1 del universo completo
            channels: new Array(DMX_UNIVERSE_SIZE).fill(0),
        };
        this._packetPool.push(packet);
        // Si el universo se registra/rearma, reconstruir máscara en siguiente uso.
        this._softBlackoutMasks.delete(universe);
        this._softBlackoutBuffers.delete(universe);
        this._hardBlackoutBuffers.delete(universe);
    }
    /**
     * Resuelve el ArbitratedNodeMap a DMXPackets listos para el driver.
     *
     * @param arbitrated — Valores finales por nodo/canal (normalizados 0-1)
     * @returns Array de IDMXPacket, uno por universo activo
     */
    resolve(arbitrated) {
        this._resolveFrameIndex++;
        // 1. Zero-fill y marcar universos como inactivos
        this._activeUniverses.clear();
        for (const [, buf] of this._universeBuffers) {
            buf.fill(0);
        }
        // Reset scratch de acumulación Forge (zero-alloc pool reuse)
        this._forgeAccumValues.clear();
        this._forgeManualDevices.clear();
        this._forgeValuePoolCursor = 0;
        // WAVE 7176: Clear pending color change state for this frame.
        // _translateColor() will re-add nodes if the quantizer blocks their color change.
        this._safetyMiddleware?.clearPendingColorChanges();
        // 2. Para cada nodo arbitrado:
        //    - legacy: escribir directo
        //    - forge: acumular por device y evaluar al final (una sola vez)
        for (const [nodeId, channelValues] of arbitrated) {
            const node = this._graph.getNodeData(nodeId);
            if (!node)
                continue;
            if (this._forgeGraphs.has(node.deviceId)) {
                this._accumulateForgeNodeValues(nodeId, node.deviceId, channelValues);
                continue;
            }
            this._writeNode(nodeId, channelValues);
        }
        // 2b. Evaluar cada fixture Forge una sola vez con el merge final.
        for (const [deviceId, mergedValues] of this._forgeAccumValues) {
            this._writeForgeDevice(deviceId, mergedValues);
        }
        // � WAVE 4685.1: DarkSpin buffer-level sweep — LEY FÍSICA DE ÚLTIMA MILLA.
        // Detecta cambios de color_wheel directamente desde el buffer DMX final,
        // sin depender del origen de la señal (L0-L4). Marca nodos COLOR como
        // "in transit" para que el cross-node sweep aplique el blackout de dimmer.
        this._applyDarkSpinBufferSweep();
        // �🌊 WAVE 4685: DarkSpin cross-node sweep.
        // DarkSpin state lives on COLOR nodes, but dimmer lives on IMPACT nodes.
        // After all nodes are written, zero IMPACT dimmer/shutter for any device
        // whose COLOR node is in wheel transit. This covers both manual fader
        // changes and Selene L1 global color effects.
        this._applyDarkSpinCrossNodeSweep();
        // 🔥 WAVE 4720: IGNITION INJECTION PASS — O(Σ injections per device)
        // Ejecutado DESPUÉS de todos los _writeNode() y DarkSpin.
        // Inyecta prerequisitos (ej. shutter=255) cuando el canal fuente está activo.
        // HTP: Math.max(buf[target], requiredValue) — nunca baja un valor más alto.
        this._applyIgnitionInjections();
        // 🌑 WAVE 7175: FINAL DARKSPIN LTP BLACKOUT — VETO ABSOLUTO.
        // Ejecutado DESPUÉS de _applyIgnitionInjections() para garantizar que
        // ninguna inyección HTP pueda restaurar el dimmer/shutter durante el tránsito.
        // LTP/Replace: asignación directa (no HTP) — el veto es incondicional.
        this._applyDarkSpinFinalBlackout();
        // 3. Ensamblar los packets de salida desde los buffers activos
        this._framePackets.clear();
        for (const universe of this._activeUniverses) {
            const buf = this._universeBuffers.get(universe);
            const packet = this._getOrCreatePacket(universe);
            // Copiar Uint8Array → number[] del packet (hot path, pero limitado a universos activos)
            const channels = packet.channels;
            for (let i = 0; i < DMX_UNIVERSE_SIZE; i++) {
                channels[i] = buf[i];
            }
            this._framePackets.set(universe, packet);
        }
        // Mutar array pre-allocado in-place — zero alloc.
        const out = this._packetArray;
        out.length = 0;
        for (const p of this._framePackets.values()) {
            out.push(p);
        }
        return out;
    }
    /**
     * 🔥 WAVE 4720: Pre-computa el mapa de inyección de ignición para un device.
     *
     * Recopila todos los canales del device, busca los que tienen ignitionDeps,
     * y construye IgnitionInjection[] con índices de buffer absolutos.
     *
     * PATCH TIME — cero alloc en hot path.
     */
    _precomputeIgnitionMap(deviceId) {
        const device = this._graph.getDevice(deviceId);
        if (!device)
            return;
        const nodeIds = this._graph.getDeviceNodes(deviceId);
        if (!nodeIds || nodeIds.length === 0)
            return;
        const baseAddr = device.dmxAddress - 1; // 1-based → 0-indexed
        // 1. Collect all channels across all nodes of this device for dep resolution
        const allChannels = [];
        for (const nodeId of nodeIds) {
            const node = this._graph.getNodeData(nodeId);
            if (!node)
                continue;
            for (const ch of node.channels) {
                allChannels.push({ type: ch.type, dmxOffset: ch.dmxOffset });
            }
        }
        // 2. Build injection rules from channels that declare ignitionDeps
        const injections = [];
        for (const nodeId of nodeIds) {
            const node = this._graph.getNodeData(nodeId);
            if (!node)
                continue;
            for (const ch of node.channels) {
                if (!ch.ignitionDeps || ch.ignitionDeps.length === 0)
                    continue;
                const sourceBufIdx = baseAddr + ch.dmxOffset;
                for (const dep of ch.ignitionDeps) {
                    const target = allChannels.find(c => c.type === dep.targetChannelType);
                    if (!target) {
                        console.warn(`[NodeResolver] ⚠️ WAVE 4720: Ignition dep target "${dep.targetChannelType}" ` +
                            `not found in device ${String(deviceId)} for source channel "${ch.type}"`);
                        continue;
                    }
                    injections.push({
                        targetBufIdx: baseAddr + target.dmxOffset,
                        requiredValue: dep.requiredValue,
                        sourceBufIdx,
                        mode: dep.mode,
                    });
                }
            }
        }
        if (injections.length > 0) {
            this._ignitionMap.set(deviceId, injections);
            // Ignition injection log silenced — fires on every setFixtures
        }
    }
    /**
     * 🌑 WAVE 4685.1: Pre-computa la entrada de barrido DarkSpin para un device.
     *
     * Busca el nodo COLOR del device con rueda mecánica elegible y registra
     * el offset absoluto del canal color_wheel en el buffer del universo.
     *
     * PATCH TIME — cero alloc en hot path.
     */
    _precomputeWheelDeviceEntry(deviceId) {
        const device = this._graph.getDevice(deviceId);
        if (!device)
            return;
        const nodeIds = this._graph.getDeviceNodes(deviceId);
        if (!nodeIds || nodeIds.length === 0)
            return;
        const baseAddr = device.dmxAddress - 1;
        for (let ni = 0; ni < nodeIds.length; ni++) {
            const node = this._graph.getNodeData(nodeIds[ni]);
            if (!node || node.family !== NodeFamily.COLOR)
                continue;
            const colorNode = node;
            if (!this._isDarkSpinEligibleColorNode(colorNode))
                continue;
            for (let ci = 0; ci < node.channels.length; ci++) {
                const chDef = node.channels[ci];
                if (chDef.type !== CH_COLOR_WHEEL)
                    continue;
                const wheelBufIdx = baseAddr + chDef.dmxOffset;
                if (wheelBufIdx < 0 || wheelBufIdx >= DMX_UNIVERSE_SIZE)
                    continue;
                const minTransitionMs = colorNode.colorWheel?.minTransitionMs ?? 0;
                // Remove existing entry for this device (re-patch safety)
                for (let ei = 0; ei < this._wheelDeviceEntries.length; ei++) {
                    if (this._wheelDeviceEntries[ei].deviceId === deviceId) {
                        this._wheelDeviceEntries.splice(ei, 1);
                        break;
                    }
                }
                this._wheelDeviceEntries.push({
                    deviceId,
                    colorNodeId: nodeIds[ni],
                    universe: device.universe,
                    wheelBufIdx,
                    minTransitionMs,
                    allowsContinuousSpin: colorNode.colorWheel?.allowsContinuousSpin ?? false,
                });
                // Initialize last known byte
                if (!this._lastWheelBytes.has(deviceId)) {
                    this._lastWheelBytes.set(deviceId, 0);
                }
                return; // One entry per device is sufficient
            }
        }
    }
    /**
     * 🏛️ F9: Precomputa el mapa O(1) de gobernadores para un device.
     *
     * Construye un array de 512 slots indexado por channelOffset, donde cada
     * slot contiene el IDMXGovernor cuyo channelIndex coincide, o undefined.
     * Esto elimina el scan lineal O(governors) en el hot path de _writeNode().
     *
     * PATCH TIME — cero alloc en hot path.
     */
    _precomputeGovernorMap(deviceId) {
        const device = this._graph.getDevice(deviceId);
        if (!device || !device.dmxGovernors || device.dmxGovernors.length === 0) {
            this._governorMaps.delete(deviceId);
            return;
        }
        this._governorMaps.set(deviceId, buildGovernorLookupMap(device.dmxGovernors));
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
    _applyIgnitionInjections() {
        for (const [deviceId, injections] of this._ignitionMap) {
            const device = this._graph.getDevice(deviceId);
            if (!device)
                continue;
            const buf = this._universeBuffers.get(device.universe);
            if (!buf)
                continue;
            for (let i = 0; i < injections.length; i++) {
                const inj = injections[i];
                if (inj.targetBufIdx < 0 || inj.targetBufIdx >= DMX_UNIVERSE_SIZE)
                    continue;
                if (inj.sourceBufIdx < 0 || inj.sourceBufIdx >= DMX_UNIVERSE_SIZE)
                    continue;
                // 'release': only inject when source channel is active (> 0)
                if (inj.mode === 'release' && buf[inj.sourceBufIdx] === 0)
                    continue;
                // HTP: never lower an existing value
                if (buf[inj.targetBufIdx] < inj.requiredValue) {
                    buf[inj.targetBufIdx] = inj.requiredValue;
                }
            }
        }
    }
    _traceFirstDeviceDmxBytes(activeNodeCount) {
        void activeNodeCount;
    }
    _traceProbeDeviceLayout(deviceId) {
        void deviceId;
    }
    _acquireForgeValueRecord() {
        if (this._forgeValuePoolCursor < this._forgeValuePool.length) {
            const record = this._forgeValuePool[this._forgeValuePoolCursor++];
            for (const key in record)
                delete record[key];
            return record;
        }
        const created = {};
        this._forgeValuePool.push(created);
        this._forgeValuePoolCursor++;
        return created;
    }
    _accumulateForgeNodeValues(nodeId, deviceId, channelValues) {
        let record = this._forgeAccumValues.get(deviceId);
        if (!record) {
            record = this._acquireForgeValueRecord();
            this._forgeAccumValues.set(deviceId, record);
        }
        // WAVE 7122.1: Cross-Cell Isolation — prefix channel keys with the cell
        // suffix extracted from nodeId so that homonymous channels in different
        // cells (e.g. strobe in golden-master vs wash) don't overwrite each other.
        //
        // The ForgeGraphCompiler inputMap uses `${aetherNodeId}:${channelType}` as
        // the key for cell-owned channels, and bare `${channelType}` for unassigned
        // (passthrough) channels. We check which form exists in inputMap to decide
        // whether to prefix.
        const compiled = this._forgeGraphs.get(deviceId);
        const colonIdx = nodeId.indexOf(':');
        const cellSuffix = colonIdx >= 0 ? nodeId.substring(colonIdx + 1) : '';
        for (const key in channelValues) {
            const value = channelValues[key];
            if (!Number.isFinite(value))
                continue;
            if (cellSuffix && compiled) {
                const prefixedKey = `${cellSuffix}:${key}`;
                if (compiled.inputMap.has(prefixedKey)) {
                    record[prefixedKey] = value;
                    continue;
                }
            }
            record[key] = value;
        }
        if (this._safetyMiddleware?.isManualNode(nodeId)) {
            this._forgeManualDevices.add(deviceId);
        }
    }
    _writeForgeDevice(deviceId, channelValues) {
        const compiled = this._forgeGraphs.get(deviceId);
        if (!compiled)
            return;
        const device = this._graph.getDevice(deviceId);
        if (!device)
            return;
        const buf = this._universeBuffers.get(device.universe);
        if (!buf)
            return;
        const gateOpen = !this._safetyMiddleware || this._safetyMiddleware.isOutputEnabled();
        const hasManualNode = this._forgeManualDevices.has(deviceId);
        if (!gateOpen && !hasManualNode)
            return;
        const baseAddr = device.dmxAddress - 1;
        ForgeNodeEvaluator.evaluate(compiled, channelValues, this._forgeFrameContext, buf, baseAddr);
        const sm = this._safetyMiddleware;
        if (sm) {
            const nodeIds = this._graph.getDeviceNodes(deviceId);
            for (let ni = 0; ni < nodeIds.length; ni++) {
                const node = this._graph.getNodeData(nodeIds[ni]);
                if (!node)
                    continue;
                if (node.family === NodeFamily.KINETIC) {
                    for (let ci = 0; ci < node.channels.length; ci++) {
                        const chDef = node.channels[ci];
                        const idx = baseAddr + chDef.dmxOffset;
                        if (idx < 0 || idx >= DMX_UNIVERSE_SIZE)
                            continue;
                        if (chDef.type === PAN_COARSE) {
                            buf[idx] = sm.clampKineticSingleAxis(node.nodeId, true, buf[idx]);
                            buf[idx] = sm.applyAirbag(buf[idx], true);
                        }
                        else if (chDef.type === TILT_COARSE) {
                            buf[idx] = sm.clampKineticSingleAxis(node.nodeId, false, buf[idx]);
                            buf[idx] = sm.applyAirbag(buf[idx], false);
                        }
                    }
                }
                if (node.family === NodeFamily.COLOR) {
                    let wheelDmx;
                    let wheelTransitMs = 0;
                    const colorNode = node;
                    const darkSpinEligible = this._isDarkSpinEligibleColorNode(colorNode);
                    for (let ci = 0; ci < node.channels.length; ci++) {
                        const chDef = node.channels[ci];
                        if (chDef.type !== CH_COLOR_WHEEL)
                            continue;
                        const idx = baseAddr + chDef.dmxOffset;
                        if (idx < 0 || idx >= DMX_UNIVERSE_SIZE)
                            continue;
                        wheelDmx = buf[idx];
                        wheelTransitMs = colorNode.colorWheel?.minTransitionMs ?? 0;
                        break;
                    }
                    if (darkSpinEligible && wheelDmx !== undefined && wheelTransitMs > 0) {
                        const inBlackout = sm.checkDarkSpin(node.nodeId, wheelDmx, wheelTransitMs, colorNode.colorWheel?.allowsContinuousSpin ?? false);
                        if (inBlackout) {
                            for (let ci = 0; ci < node.channels.length; ci++) {
                                const chDef = node.channels[ci];
                                if (chDef.type !== DIMMER_CHANNEL && chDef.type !== SHUTTER_CHANNEL)
                                    continue;
                                const idx = baseAddr + chDef.dmxOffset;
                                if (idx < 0 || idx >= DMX_UNIVERSE_SIZE)
                                    continue;
                                buf[idx] = 0;
                            }
                        }
                    }
                }
            }
        }
        this._activeUniverses.add(device.universe);
    }
    _getOrBuildSoftBlackoutMask(universe) {
        const cached = this._softBlackoutMasks.get(universe);
        if (cached)
            return cached;
        const mask = new Uint8Array(DMX_UNIVERSE_SIZE);
        const families = [
            NodeFamily.IMPACT,
            NodeFamily.COLOR,
            NodeFamily.KINETIC,
            NodeFamily.BEAM,
            NodeFamily.ATMOSPHERE,
        ];
        for (let fi = 0; fi < families.length; fi++) {
            const view = this._graph.getView(families[fi]);
            view.forEach((node) => {
                const device = this._graph.getDevice(node.deviceId);
                if (!device || device.universe !== universe)
                    return;
                const baseAddr = device.dmxAddress - 1;
                for (let ci = 0; ci < node.channels.length; ci++) {
                    const chDef = node.channels[ci];
                    if (!SOFT_BLACKOUT_INTENSITY_CHANNELS.has(chDef.type))
                        continue;
                    const idx = baseAddr + chDef.dmxOffset;
                    if (idx >= 0 && idx < DMX_UNIVERSE_SIZE) {
                        mask[idx] = 1;
                    }
                    if (chDef.is16bit) {
                        const fineIdx = idx + 1;
                        if (fineIdx >= 0 && fineIdx < DMX_UNIVERSE_SIZE) {
                            mask[fineIdx] = 1;
                        }
                    }
                }
            });
        }
        this._softBlackoutMasks.set(universe, mask);
        return mask;
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
    _writeNode(nodeId, channelValues) {
        const node = this._graph.getNodeData(nodeId);
        if (!node)
            return;
        const device = this._graph.getDevice(node.deviceId);
        if (!device)
            return;
        const buf = this._universeBuffers.get(device.universe);
        if (!buf) {
            console.warn(`[NodeResolver 🚨] _writeNode: universe ${device.universe} not registered for device ${device.deviceId}`);
            return; // universe no registrado — ignorar silenciosamente
        }
        // WAVE 4680 → WAVE 4822: Blind Mode — compuerta selectiva por L2 manual.
        //
        // gateOpen  (outputEnabled=true,  LIVE):
        //   → Todo pasa: L0 + L1 + L2 llegan al hardware.
        //
        // !gateOpen (outputEnabled=false, BLIND/ARMED):
        //   → Solo nodos con override L2 activo (isManualNode) escriben al buffer.
        //   → KINETIC sin L2: no recibe nuevos objetivos de Selene (retiene el
        //     buffer en 0 — el hardware queda en su última posición física).
        //   → currentPosition se actualiza igualmente para que la UI sea fiel
        //     (WAVE 4616: Pre-Vis rescue no se toca).
        const gateOpen = !this._safetyMiddleware || this._safetyMiddleware.isOutputEnabled();
        const isManualNode = this._safetyMiddleware ? this._safetyMiddleware.isManualNode(nodeId) : false;
        const nodeBlocked = !gateOpen && !isManualNode;
        const baseAddr = device.dmxAddress - 1; // convertir a 0-indexed
        const _t36probe = this._resolveFrameIndex % 20 === 0
            ? this._graph.getView(NodeFamily.IMPACT).count > 0
                ? this._graph.getView(NodeFamily.IMPACT).get(0)
                : undefined
            : undefined;
        const _t36watchDeviceId = _t36probe?.deviceId;
        // ═══ WAVE 4548.6: FORGE EVALUATOR BYPASS ═══
        // Si este device tiene un grafo Forge compilado,
        // delegar COMPLETAMENTE al ForgeNodeEvaluator.
        const compiled = this._forgeGraphs.get(node.deviceId);
        if (compiled) {
            if (nodeBlocked)
                return;
            ForgeNodeEvaluator.evaluate(compiled, channelValues, this._forgeFrameContext, buf, baseAddr);
            // ★ WAVE 4557: Post-Forge Safety Sweep — airbag + velocity clamp
            // The Forge evaluator bypasses ALL safety logic. Apply critical
            // protections on the buffer AFTER evaluation for kinetic outputs.
            const sm = this._safetyMiddleware;
            if (sm && node.family === NodeFamily.KINETIC) {
                for (let ci = 0; ci < node.channels.length; ci++) {
                    const chDef = node.channels[ci];
                    const idx = baseAddr + chDef.dmxOffset;
                    if (idx < 0 || idx >= DMX_UNIVERSE_SIZE)
                        continue;
                    if (chDef.type === PAN_COARSE) {
                        buf[idx] = sm.clampKineticSingleAxis(node.nodeId, true, buf[idx]);
                        buf[idx] = sm.applyAirbag(buf[idx], true);
                    }
                    else if (chDef.type === TILT_COARSE) {
                        buf[idx] = sm.clampKineticSingleAxis(node.nodeId, false, buf[idx]);
                        buf[idx] = sm.applyAirbag(buf[idx], false);
                    }
                }
            }
            if (sm && node.family === NodeFamily.COLOR) {
                let wheelDmx;
                let wheelTransitMs = 0;
                const colorNode = node;
                const darkSpinEligible = this._isDarkSpinEligibleColorNode(colorNode);
                for (let ci = 0; ci < node.channels.length; ci++) {
                    const chDef = node.channels[ci];
                    if (chDef.type !== CH_COLOR_WHEEL)
                        continue;
                    const idx = baseAddr + chDef.dmxOffset;
                    if (idx < 0 || idx >= DMX_UNIVERSE_SIZE)
                        continue;
                    wheelDmx = buf[idx];
                    wheelTransitMs = colorNode.colorWheel?.minTransitionMs ?? 0;
                    break;
                }
                if (darkSpinEligible && wheelDmx !== undefined && wheelTransitMs > 0) {
                    const inBlackout = sm.checkDarkSpin(node.nodeId, wheelDmx, wheelTransitMs, colorNode.colorWheel?.allowsContinuousSpin ?? false);
                    if (inBlackout) {
                        for (let ci = 0; ci < node.channels.length; ci++) {
                            const chDef = node.channels[ci];
                            if (chDef.type !== DIMMER_CHANNEL && chDef.type !== SHUTTER_CHANNEL)
                                continue;
                            const idx = baseAddr + chDef.dmxOffset;
                            if (idx < 0 || idx >= DMX_UNIVERSE_SIZE)
                                continue;
                            buf[idx] = 0;
                        }
                    }
                }
            }
            this._activeUniverses.add(device.universe);
            return; // BYPASS: no ejecutar flujo legacy
        }
        const calibration = device.calibration;
        if (!nodeBlocked)
            this._activeUniverses.add(device.universe);
        let invertClassicKineticAxes = false;
        // ── WAVE 4631: SPLIT-BRAIN GATEKEEPER DETERMINISTA ─────────────────────
        // La ruta KINETIC se decide SOLO por la presencia de targetX en los valores
        // arbitrados del frame. No depende de flags estructurales del fixture.
        //
        //   targetX presente   + !isContinuous → RUTA ESPACIAL (IK puro)
        //   targetX ausente    o isContinuous  → RUTA CLÁSICA (pan/tilt directo)
        if (node.family === NodeFamily.KINETIC) {
            const kineticNode = node;
            const hasSpatialTarget = channelValues[CH_TARGET_X] !== undefined;
            // WAVE 6020.9 SURVIVAL LOG: Confirm which path the resolver takes
            // 🩸 WAVE 6040: Silenciado — logs de supervivencia ya no necesarios en producción
            // if (Math.random() < 0.001) {
            //   console.log(`[WAVE-6020.9-SURVIVAL] NodeResolver ${node.nodeId}: hasSpatialTarget=${hasSpatialTarget} targetX=${channelValues[CH_TARGET_X] ?? 'undefined'} isContinuous=${kineticNode.isContinuous} → ${!kineticNode.isContinuous && hasSpatialTarget ? 'IK-PATH' : 'CLASSIC-PATH'}`)
            // }
            if (!kineticNode.isContinuous && hasSpatialTarget) {
                this._writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration, !nodeBlocked, device.orientation);
                return;
            }
            // 🩸 WAVE 6040-DIAG: Diagnostic log para tracear el bug "movers no responden al radar cuando hay color"
            if (this._resolveFrameIndex % 44 === 0) {
                const panVal = channelValues['pan'];
                const tiltVal = channelValues['tilt'];
                const hasPanTilt = panVal !== undefined || tiltVal !== undefined;
                // if (hasPanTilt) {
                //   console.log(
                //     `[KINETIC-DIAG] ${node.nodeId}: CLASSIC-PATH | pan=${panVal?.toFixed(3) ?? 'N/A'} tilt=${tiltVal?.toFixed(3) ?? 'N/A'} nodeBlocked=${nodeBlocked} gateOpen=${!this._safetyMiddleware || this._safetyMiddleware.isOutputEnabled()}`
                //   )
                // }
            }
            invertClassicKineticAxes = this._shouldInvertClassicKineticAxes(device.orientation, kineticNode);
            // isContinuous (fan/mirrorball) o sin targetX → classic path
        }
        // ── WAVE 4522.4: Traducción cromática ─────────────────────────────
        // Si el nodo es de familia COLOR y tiene valores r/g/b arbitrados,
        // calculamos el mapa de canales físicos traducidos ANTES del bucle DMX.
        // Esto es zero-alloc: reutilizamos _translatedChannelValues que es un
        // objeto pre-allocated a nivel de función (stack local, no heap).
        let translatedValues = channelValues;
        if (node.family === NodeFamily.COLOR) {
            const rNorm = channelValues[CH_R] ?? channelValues[CH_RED];
            const gNorm = channelValues[CH_G] ?? channelValues[CH_GREEN];
            const bNorm = channelValues[CH_B] ?? channelValues[CH_BLUE];
            if (rNorm !== undefined && gNorm !== undefined && bNorm !== undefined) {
                const colorData = node;
                translatedValues = this._translateColor(nodeId, colorData.mixingType, colorData.colorWheel, rNorm, gNorm, bNorm, channelValues);
            }
        }
        // ── Fin traducción cromática ───────────────────────────────────────
        // Telemetría legacy removida.
        for (let ci = 0; ci < node.channels.length; ci++) {
            const chDef = node.channels[ci];
            const bufIdx = baseAddr + chDef.dmxOffset;
            if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE)
                continue; // safety bound
            // WAVE 4735.2: Two-level lookup — zero-alloc.
            // translatedValues apunta al scratchpad (_colorTranslateScratch) para nodos COLOR,
            // o a channelValues directamente para el resto. El scratchpad usa NaN como centinela
            // ("no escrito este frame") para canales sin traducción específica.
            // En ese caso se cae al valor arbitrado original (channelValues).
            const _tv = translatedValues[chDef.type];
            let rawNormalized;
            let rawSource;
            if (_tv !== undefined && !Number.isNaN(_tv)) {
                rawNormalized = _tv;
                rawSource = 'translated';
            }
            else {
                const _cv = channelValues[chDef.type];
                if (_cv !== undefined) {
                    rawNormalized = _cv;
                    rawSource = 'channel';
                }
                else {
                    rawNormalized = this._getDefaultNormalizedValue(node, chDef);
                    rawSource = 'default';
                }
            }
            rawNormalized = sanitizeNormalizedValue(rawNormalized);
            // Telemetría legacy removida.
            // Aplicar TransferCurve
            let normalized = this._applyTransferCurve(rawNormalized, chDef, node.constraints.transferCurve);
            // Clamp al rango válido del constraint
            const maxDmx = node.constraints.maxValue;
            const maxNorm = maxDmx / 255;
            if (normalized > maxNorm)
                normalized = maxNorm;
            if (normalized < 0)
                normalized = 0;
            // Escalar a DMX: [0, 255]
            // WAVE 2523.3: DITHERING ELIMINADO — cuantización directa determinista.
            //
            // El dithering (WAVE 2523.1/2523.2) fue removido porque:
            //   1. Los LEDs responden instantáneamente (sin inercia térmica) → cualquier
            //      oscilación entre steps DMX adyacentes es visible como temblequeo.
            //   2. El modo chill es 100% desacoplado del audio (senos puros de 200s/240s)
            //      → los valores son siempre casi-estacionarios → el dithering siempre
            //      se activaba → temblequeo constante en air/ambient/PARs.
            //   3. Para un modo ambiental de cenas/previas, los steps de 8-bit (0.39%
            //      cada ~2s) son imperceptibles y preferibles al temblequeo del dithering.
            //
            // Los steps de 8-bit son inherentes al protocolo DMX. La única forma de
            // eliminarlos sería usar dimming 16-bit (canal fine), que depende del hardware.
            let dmxValue = sanitizeDmxByte(Math.round(normalized * 255));
            // Aplicar calibración específica de canal
            if (calibration) {
                dmxValue = sanitizeDmxByte(this._applyCalibration(dmxValue, chDef.type, calibration));
            }
            // WAVE 4639: La inversión por orientación en ruta clásica se aplica
            // en dominio DMX final para respetar offsets/límites y corregir pivote.
            // WAVE 4932.3: Pre-Vis actualiza currentPosition ANTES de la inversión de ejes.
            // currentPosition debe reflejar el espacio lógico (0=suelo, 1=techo en floor;
            // se invierte en pre-vis para ceiling via invertClassicKineticAxes).
            // Si se guardara post-invert, el visualizador vería tilt=0.86 para un ceiling
            // apuntando al suelo y lo renderizaría incorrectamente apuntando al techo.
            if (node.family === NodeFamily.KINETIC) {
                const kn = node;
                if (chDef.type === PAN_COARSE) {
                    kn.currentPosition.pan = dmxValue / 255;
                }
                else if (chDef.type === TILT_COARSE) {
                    kn.currentPosition.tilt = dmxValue / 255;
                }
            }
            if (chDef.type === TILT_COARSE) {
                if (invertClassicKineticAxes) {
                    dmxValue = sanitizeDmxByte(255 - dmxValue);
                }
            }
            // ★ WAVE 4557: Velocity clamp + Airbag for Classic pan/tilt path
            if (this._safetyMiddleware && node.family === NodeFamily.KINETIC) {
                if (PAN_CHANNELS.has(chDef.type) && chDef.type === PAN_COARSE) {
                    dmxValue = sanitizeDmxByte(this._safetyMiddleware.clampKineticSingleAxis(node.nodeId, true, dmxValue));
                    dmxValue = sanitizeDmxByte(this._safetyMiddleware.applyAirbag(dmxValue, true));
                }
                else if (TILT_CHANNELS.has(chDef.type) && chDef.type === TILT_COARSE) {
                    dmxValue = sanitizeDmxByte(this._safetyMiddleware.clampKineticSingleAxis(node.nodeId, false, dmxValue));
                    dmxValue = sanitizeDmxByte(this._safetyMiddleware.applyAirbag(dmxValue, false));
                }
            }
            // Clamp final de seguridad
            dmxValue = sanitizeDmxByte(dmxValue);
            // 🎛️ DMX PERSONALITY REMAPPER — última milla para hardware mecánico.
            // Zero-alloc: lee dmxPersonality pre-cargado en patch-time desde el fixture JSON.
            // Solo activa si el canal declara personality — el resto pasa sin overhead.
            const pers = chDef.dmxPersonality;
            if (pers) {
                if (chDef.type === DIMMER_CHANNEL && pers.minDimmer !== undefined) {
                    // Obturador mecánico: si hay intent (>0), elevar al mínimo físico.
                    // Si intent es exactamente 0.0, forzar 0 (blackout limpio).
                    if (rawNormalized > 0 && dmxValue < pers.minDimmer) {
                        dmxValue = pers.minDimmer;
                    }
                }
                else if (chDef.type === STROBE_CHANNEL &&
                    pers.strobeOpenValue !== undefined &&
                    pers.strobeRangeMin !== undefined &&
                    pers.strobeRangeMax !== undefined) {
                    // Estrobo no estándar: intent=0 → apertura total; intent>0 → rango físico.
                    if (rawNormalized <= 0) {
                        dmxValue = pers.strobeOpenValue;
                    }
                    else {
                        dmxValue = Math.floor(pers.strobeRangeMin + rawNormalized * (pers.strobeRangeMax - pers.strobeRangeMin));
                    }
                }
            }
            if (nodeBlocked)
                continue;
            // 🛂 WAVE 4735.3 FORENSIC: NaN sentinel defense-in-depth.
            // Nunca permitir NaN/Infinity fuera de [0..255] hacia el Uint8Array.
            const safeDmxValue = Number.isNaN(dmxValue)
                ? 0
                : sanitizeDmxByte(dmxValue);
            if (chDef.type === 'rotation' && safeDmxValue === 127) {
                // DYE rotation DMX write log silenced
            }
            buf[bufIdx] = safeDmxValue;
            // Strobe trace diagnostic removed (WAVE 2526)
            // 🩸 WAVE 6040-DIAG: Classic kinetic path — log pan/tilt writes
            // if (node.family === NodeFamily.KINETIC && (chDef.type === PAN_COARSE || chDef.type === TILT_COARSE) && this._resolveFrameIndex % 44 === 0) {
            //   console.log(`[KINETIC-DIAG] ${node.nodeId}: CLASSIC-WRITE ${chDef.type}=${safeDmxValue} rawSource=${rawSource} nodeBlocked=${nodeBlocked}`)
            // }
            // Telemetría legacy removida.
            // Canales 16-bit: escribir byte fine (LSB) en el slot siguiente
            if (chDef.is16bit) {
                const fineIdx = bufIdx + 1;
                if (fineIdx < DMX_UNIVERSE_SIZE) {
                    const raw16 = Math.round(normalized * 65535);
                    const safeRaw16 = Number.isFinite(raw16) ? raw16 : 0;
                    buf[fineIdx] = sanitizeDmxByte(safeRaw16 & 0xFF); // byte fine (LSB)
                    // El byte coarse (MSB) ya fue escrito como (raw16 >> 8) arriba,
                    // pero nuestro `dmxValue` ya redondeó al byte coarse.
                    // Corregir el coarse para coherencia 16-bit:
                    buf[bufIdx] = sanitizeDmxByte((safeRaw16 >> 8) & 0xFF);
                }
            }
            // 🏛️ DMX GOVERNOR ENGINE — evaluación declarativa de última milla. Zero-alloc.
            // F9: O(1) lookup via precomputed map — no linear scan.
            const _govMap = this._governorMaps.get(device.deviceId);
            let finalByte = safeDmxValue;
            if (_govMap !== undefined) {
                finalByte = sanitizeDmxByte(applyDMXGovernors(_govMap, chDef.dmxOffset, chDef.type, rawNormalized, safeDmxValue));
                // // 🚨 EL SONAR DEL GOBERNADOR (Loguea SOLO si altera el byte físico)
                // // Usamos Math.random() < 0.02 para que a 44Hz solo escupa el log aprox 1 vez por segundo y no congele la terminal.
                // if (finalByte !== safeDmxValue && Math.random() < 0.02) {
                //   console.log(`[Governor MUX 🏛️] Intercept: ${device.deviceId} (CH:${chDef.dmxOffset}|${chDef.type}) | Math: ${safeDmxValue} ──► CLAMP: ${finalByte}`)
                // }
                // // WAVE 7031 DIAG: Trace dimmer/strobe governor evaluation at 1Hz
                // if ((chDef.type === 'dimmer' || chDef.type === 'strobe') && this._resolveFrameIndex % 44 === 0) {
                //   console.log(`[WAVE-7031-DIAG] ${device.deviceId} ch=${chDef.dmxOffset} type=${chDef.type} norm=${rawNormalized.toFixed(3)} byte=${safeDmxValue} → final=${finalByte} govs=${_govs.length}`)
                // }
            }
            buf[bufIdx] = finalByte;
        }
    }
    /**
     * � WAVE 4685.1: DarkSpin buffer-level sweep — LEY FÍSICA DE ÚLTIMA MILLA.
     *
     * Lee el byte DMX final del canal color_wheel desde el buffer del universo
     * y lo compara con el frame anterior. Si cambió, activa el estado de tránsito
     * DarkSpin para ese nodo COLOR, independientemente del origen de la señal
     * (L0, L1, L2, L3, L4 — todos son detectados aquí).
     *
     * Debe ejecutarse ANTES de _applyDarkSpinCrossNodeSweep() para que el
     * cross-node sweep pueda encontrar los nodos recién marcados como "in transit"
     * y aplicar el blackout de dimmer/shutter en los nodos IMPACT.
     *
     * ZERO-ALLOC: itera sobre _wheelDeviceEntries[] pre-computado en patch-time.
     * _lastWheelBytes se muta in-place sin crear nuevos objetos.
     */
    _applyDarkSpinBufferSweep() {
        const sm = this._safetyMiddleware;
        if (!sm)
            return;
        const entries = this._wheelDeviceEntries;
        const len = entries.length;
        if (len === 0)
            return;
        for (let i = 0; i < len; i++) {
            const entry = entries[i];
            const buf = this._universeBuffers.get(entry.universe);
            if (!buf)
                continue;
            const currentByte = buf[entry.wheelBufIdx];
            const lastByte = this._lastWheelBytes.get(entry.deviceId) ?? 0;
            if (currentByte !== lastByte && entry.minTransitionMs > 0) {
                // Wheel byte changed — trigger DarkSpin transit state.
                // checkDarkSpin handles: new transit start, active transit blackout,
                // transit completion, and fail-safe timeout.
                sm.checkDarkSpin(entry.colorNodeId, currentByte, entry.minTransitionMs, entry.allowsContinuousSpin ?? false);
            }
            // Update last known byte in-place (zero-alloc)
            this._lastWheelBytes.set(entry.deviceId, currentByte);
        }
    }
    /**
     * �� WAVE 4685: Cross-node DarkSpin sweep.
     * Scans devices with COLOR nodes in active wheel transit and zeroes
     * dimmer/shutter on their IMPACT nodes. Must run AFTER all _writeNode()
     * calls so the actual wheel DMX has been evaluated and checkDarkSpin
     * state is up to date.
     */
    _applyDarkSpinCrossNodeSweep() {
        const sm = this._safetyMiddleware;
        if (!sm)
            return;
        const transitNodeIds = sm.getDarkSpinTransitNodeIds();
        if (transitNodeIds.length === 0)
            return;
        // HS-2: Reuse pre-allocated scratch — zero Set alloc per frame.
        const transitDevices = this._transitDevicesScratch;
        transitDevices.clear();
        for (const nodeId of transitNodeIds) {
            const node = this._graph.getNodeData(nodeId);
            if (!node || node.family !== NodeFamily.COLOR)
                continue;
            if (!this._isDarkSpinEligibleColorNode(node))
                continue;
            transitDevices.add(node.deviceId);
        }
        if (transitDevices.size === 0)
            return;
        // For each transit device, find its IMPACT nodes and kill dimmer/shutter
        for (const deviceId of transitDevices) {
            const device = this._graph.getDevice(deviceId);
            if (!device)
                continue;
            const buf = this._universeBuffers.get(device.universe);
            if (!buf)
                continue;
            const baseAddr = device.dmxAddress - 1;
            const nodeIds = this._graph.getDeviceNodes(deviceId);
            if (!nodeIds)
                continue;
            let killed = 0;
            for (const nid of nodeIds) {
                const node = this._graph.getNodeData(nid);
                if (!node || node.family !== NodeFamily.IMPACT)
                    continue;
                for (const chDef of node.channels) {
                    if (chDef.type !== DIMMER_CHANNEL && chDef.type !== SHUTTER_CHANNEL)
                        continue;
                    const idx = baseAddr + chDef.dmxOffset;
                    if (idx < 0 || idx >= DMX_UNIVERSE_SIZE)
                        continue;
                    if (buf[idx] > 0) {
                        buf[idx] = 0;
                        killed++;
                    }
                }
            }
            if (killed > 0) {
                // Log silenced — non-essential startup/transit noise
                this._darkSpinActiveDevices.add(deviceId);
            }
        }
        // Remove devices that are no longer in transit this frame
        for (const prevDeviceId of this._darkSpinActiveDevices) {
            if (!transitDevices.has(prevDeviceId)) {
                this._darkSpinActiveDevices.delete(prevDeviceId);
            }
        }
    }
    /**
     * 🌑 WAVE 7175: FINAL DarkSpin LTP blackout — VETO ABSOLUTO.
     *
     * Runs AFTER _applyIgnitionInjections(). Uses LTP (direct assignment, not HTP)
     * to guarantee that no ignition injection or any other post-resolve pass can
     * restore dimmer/shutter values during an active wheel transit.
     *
     * Scans ALL nodes (COLOR + IMPACT) of devices with active DarkSpin transit
     * and forces dimmer/shutter channels to 0 in the universe buffer.
     */
    _applyDarkSpinFinalBlackout() {
        const sm = this._safetyMiddleware;
        if (!sm)
            return;
        const transitNodeIds = sm.getDarkSpinTransitNodeIds();
        if (transitNodeIds.length === 0)
            return;
        // HS-2: Reuse pre-allocated scratch — zero Set alloc per frame.
        const transitDevices = this._transitDevicesScratch;
        transitDevices.clear();
        for (const nodeId of transitNodeIds) {
            const node = this._graph.getNodeData(nodeId);
            if (!node || node.family !== NodeFamily.COLOR)
                continue;
            if (!this._isDarkSpinEligibleColorNode(node))
                continue;
            transitDevices.add(node.deviceId);
        }
        if (transitDevices.size === 0)
            return;
        // For each transit device, zero ALL dimmer/shutter channels across ALL nodes
        for (const deviceId of transitDevices) {
            const device = this._graph.getDevice(deviceId);
            if (!device)
                continue;
            const buf = this._universeBuffers.get(device.universe);
            if (!buf)
                continue;
            const baseAddr = device.dmxAddress - 1;
            const nodeIds = this._graph.getDeviceNodes(deviceId);
            if (!nodeIds)
                continue;
            for (const nid of nodeIds) {
                const node = this._graph.getNodeData(nid);
                if (!node)
                    continue;
                for (let ci = 0; ci < node.channels.length; ci++) {
                    const chDef = node.channels[ci];
                    if (chDef.type !== DIMMER_CHANNEL && chDef.type !== SHUTTER_CHANNEL)
                        continue;
                    const idx = baseAddr + chDef.dmxOffset;
                    if (idx < 0 || idx >= DMX_UNIVERSE_SIZE)
                        continue;
                    buf[idx] = 0;
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
    _writeNodeIK(node, channelValues, baseAddr, buf, calibration, nodeWriteEnabled, deviceOrientation) {
        const txRaw = channelValues[CH_TARGET_X];
        if (!Number.isFinite(txRaw)) {
            // 🩸 WAVE 6040-DIAG: Early return diagnostic
            // if (this._resolveFrameIndex % 44 === 0) {
            //   console.log(`[KINETIC-DIAG] ${node.nodeId}: IK-PATH ABORTED — targetX not finite (value=${txRaw})`)
            // }
            return;
        }
        const tx = txRaw;
        const ty = sanitizeNormalizedValue(channelValues[CH_TARGET_Y], 1.5);
        const tz = sanitizeNormalizedValue(channelValues[CH_TARGET_Z], 2.0);
        // WAVE 7617: MATH-INPUT telemetry silenced — was flooding backend logs at 44Hz.
        // Re-enable with: if (DEBUG_IK && this._resolveFrameIndex % MATH_TELEMETRY_EVERY_FRAMES === 0) { ... }
        // if (this._resolveFrameIndex % MATH_TELEMETRY_EVERY_FRAMES === 0) {
        //   console.log(
        //     `[MATH-INPUT] id: ${String(node.deviceId)} | targetXYZ: ${tx.toFixed(3)},${ty.toFixed(3)},${tz.toFixed(3)}`,
        //   )
        // }
        const profile = this._getOrBuildIKProfile(node, calibration);
        // WAVE 7624: IK MEMORY ISOLATION — Feed the PURE IK pan (from last frame's
        // solveInto, before any L0 offset was applied) to the anti-flip heuristic.
        // The offset-polluted currentPosition.pan must NOT influence the flip
        // decision — it corrupts resolveShortestPanPath when the offset pushes
        // the physical head past the midpoint, causing a 180° teleport.
        // First frame fallback: currentPosition.pan (no pure memory yet).
        const purePanMemory = this._ikPurePanMemory.get(node.nodeId) ?? (node.currentPosition.pan * 255);
        // K0-BATCH-3c: Mutate pre-allocated scratch instead of creating {x:tx, y:ty, z:tz} literal.
        // WAVE 7621: Pure IK — no target mutation, no pattern fusion. The resolver
        // reads targetX/Y/Z directly and calls solveInto. Pattern offsets arrive
        // via pan_offset/tilt_offset (emitted by AetherKineticEngine in IK mode)
        // and are fused by the WAVE 7179 post-solve fusion below.
        this._ikTargetScratch.x = tx;
        this._ikTargetScratch.y = ty;
        this._ikTargetScratch.z = tz;
        solveInto(this._ikResultScratch, profile, this._ikTargetScratch, purePanMemory);
        const ikResult = this._ikResultScratch;
        // WAVE 7624: Save the PURE IK pan for next frame's anti-flip heuristic.
        // This is the solver's output BEFORE any L0/L2 offset is applied — it
        // reflects only the 3D target trajectory, not the orbital offset.
        this._ikPurePanMemory.set(node.nodeId, ikResult.pan);
        const reachable = ikResult.reachable !== false;
        this._ikReachability.set(node.nodeId, reachable);
        if (!reachable) {
            const lastWarnFrame = this._ikLastWarnFrame.get(node.nodeId) ?? -IK_WARN_INTERVAL_FRAMES;
            if ((this._resolveFrameIndex - lastWarnFrame) >= IK_WARN_INTERVAL_FRAMES) {
                this._ikLastWarnFrame.set(node.nodeId, this._resolveFrameIndex);
                console.warn(`[NodeResolver] IK unreachable | node=${String(node.nodeId)} device=${String(node.deviceId)} target=(${tx.toFixed(2)},${ty.toFixed(2)},${tz.toFixed(2)})`);
            }
        }
        // 🏗️ WAVE 7179 (M4): VMM Post-Solve Fusion — aplica offsets del VMM en dominio DMX.
        // Los offsets (pan_offset, tilt_offset) provienen del L0 (VibeMovementManager)
        // o del L2 Engine (AetherKineticEngine en modo IK) y están en espacio
        // normalizado [-1, +1]. Se escalan por amplitude, dist_scale y el factor
        // de gimbal lock fade, luego se convierten a DMX (0-255) y se suman al
        // resultado lógico del IK. Esto reemplaza la fusión que hacía NodeArbiter
        // en el dominio normalizado 0-1.
        //
        // WAVE 7621: This is Opus's intended merge path. The L2 engine emits
        // pan_offset/tilt_offset when a spatial target is active (IK mode), so
        // the pattern naturally orbits around the IK-solved position.
        let logicalPan = ikResult.pan;
        let logicalTilt = ikResult.tilt;
        const panOffset = channelValues['pan_offset'];
        const tiltOffset = channelValues['tilt_offset'];
        const hasPanOffset = panOffset !== undefined && Number.isFinite(panOffset);
        const hasTiltOffset = tiltOffset !== undefined && Number.isFinite(tiltOffset);
        if (hasPanOffset || hasTiltOffset) {
            const amp = this._relativeOffsetAmplitude;
            // WAVE 7627: Cap distScale to 1.0 so it never amplifies offsets — only
            // reduces them for far fixtures. The original distScale (up to 2.0) was
            // designed for the VMM's gentle L0 offsets, not the L2 engine's full
            // ±1.0 offsets. With distScale=2.0, the delta could reach ±127 DMX,
            // hitting the 0/255 boundary and causing the "chopped sine wave" clip.
            const rawDistScale = this._spatialDistanceScales.get(node.nodeId) ?? 1.0;
            const effectiveDistScale = rawDistScale > 1 ? 1 : rawDistScale;
            // WAVE 7628: DYNAMIC SOFT-CLPER (tanh compressor)
            // Save the pure IK base before applying any offset — this is the anchor
            // the IK solver computed. The headroom is the distance from this base
            // to the nearest DMX boundary (0 or 255). The tanh curve smoothly
            // compresses the delta as it approaches the boundary, preserving the
            // waveform shape without hard-clipping or flatlining.
            const basePan = logicalPan;
            const baseTilt = logicalTilt;
            if (hasPanOffset) {
                // Gimbal lock fade: atenuar pan_offset cuando tilt ≈ centro (0.5 norm = ~127 DMX)
                const tiltNorm = logicalTilt / 255;
                const tiltDist = Math.abs(tiltNorm - VMM_GIMBAL_TILT_CENTER);
                const gimbalFactor = tiltDist >= VMM_GIMBAL_TILT_FADE_HALFWIDTH
                    ? 1
                    : tiltDist / VMM_GIMBAL_TILT_FADE_HALFWIDTH;
                const panDelta = panOffset * amp * VMM_OFFSET_SCALE_PAN * effectiveDistScale * gimbalFactor * 255;
                // WAVE 7628: Soft-clip the delta based on available headroom.
                // tanh(|delta|/headroom) * headroom → asymptotically approaches the
                // boundary but never flatlines. For small deltas (delta << headroom),
                // tanh(x) ≈ x → no compression, waveform preserved.
                const panHeadroom = panDelta > 0 ? (255 - basePan) : basePan;
                let safePanDelta;
                if (panHeadroom > 0) {
                    safePanDelta = Math.tanh(Math.abs(panDelta) / panHeadroom) * panHeadroom * Math.sign(panDelta);
                }
                else {
                    safePanDelta = 0;
                }
                logicalPan = basePan + safePanDelta;
            }
            if (hasTiltOffset) {
                const tiltDelta = tiltOffset * amp * VMM_OFFSET_SCALE_TILT * effectiveDistScale * 255;
                // WAVE 7628: Same tanh soft-clip for tilt.
                const tiltHeadroom = tiltDelta > 0 ? (255 - baseTilt) : baseTilt;
                let safeTiltDelta;
                if (tiltHeadroom > 0) {
                    safeTiltDelta = Math.tanh(Math.abs(tiltDelta) / tiltHeadroom) * tiltHeadroom * Math.sign(tiltDelta);
                }
                else {
                    safeTiltDelta = 0;
                }
                logicalTilt = baseTilt + safeTiltDelta;
            }
        }
        // ★ WAVE 4557: Velocity clamp + Airbag via AetherSafetyMiddleware
        let safePan = sanitizeDmxByte(logicalPan);
        let safeTilt = sanitizeDmxByte(logicalTilt);
        const sm = this._safetyMiddleware;
        if (sm) {
            sm.clampKineticVelocityInto(this._kineticClampScratch, node.nodeId, safePan, safeTilt);
            safePan = sm.applyAirbag(this._kineticClampScratch.pan, true);
            safeTilt = sm.applyAirbag(this._kineticClampScratch.tilt, false);
        }
        // WAVE 7616: Apply orientation-based tilt inversion for ceiling/truss mounts.
        // The IK solver (solveInto) computes tilt in a coordinate frame where 0° = straight
        // down for floor mounts. For ceiling mounts, the physical tilt axis is inverted —
        // DMX 0 = straight up, DMX 255 = straight down. Without this inversion, ceiling
        // fixtures point in the opposite direction of the target.
        // Previously (WAVE 4547.1) this was skipped in the IK path to "avoid double
        // negation", but the IK solver never applied the inversion internally — only
        // calibration.tiltInvert (a separate per-fixture flag) was applied. This left
        // ceiling fixtures uncorrected, requiring a hacky `1.0 - safeTilt` compensation
        // in the RELEASE snapshot engine (AetherIPCHandlers.ts). Now that the IK path
        // applies the inversion natively, that hack has been removed.
        const invertIKTilt = this._shouldInvertClassicKineticAxes(deviceOrientation, node);
        if (invertIKTilt) {
            safeTilt = sanitizeDmxByte(255 - safeTilt);
        }
        // WAVE 4616: Pre-Vis rescue — siempre actualizar currentPosition con el
        // resultado matemático real, aunque la salida física esté desarmada.
        // WAVE 7616: currentPosition ahora refleja el valor POST-INVERSIÓN, para
        // que el snapshot del RELEASE engine capture el DMX correcto sin necesitar
        // la compensación `1.0 - safeTilt` que existía antes.
        node.currentPosition.pan = safePan / 255;
        node.currentPosition.tilt = safeTilt / 255;
        // WAVE 7617: MATH-OUTPUT telemetry silenced — was flooding backend logs at 44Hz.
        // if (this._resolveFrameIndex % MATH_TELEMETRY_EVERY_FRAMES === 0) {
        //   console.log(
        //     `[MATH-OUTPUT] id: ${String(node.deviceId)} | IK-Result: ${safePan.toFixed(1)}/${safeTilt.toFixed(1)} | currentPos: ${(node.currentPosition.pan * 255).toFixed(1)}/${(node.currentPosition.tilt * 255).toFixed(1)}`,
        //   )
        // }
        // WAVE 4616: Gate final absoluto en el write DMX.
        if (!nodeWriteEnabled)
            return;
        // WAVE 7608: 16-bit IK precision — extract 16-bit values from IK result
        // and apply the same VMM offsets + safety clamps in 16-bit domain.
        let safePan16 = ikResult.pan16;
        let safeTilt16 = ikResult.tilt16;
        // Apply VMM offsets in 16-bit domain (scale 255→65535 = ×257)
        // WAVE 7621: L2 pattern offsets (pan_offset/tilt_offset) emitted by
        // AetherKineticEngine in IK mode are fused here alongside L0 VMM offsets.
        if (hasPanOffset || hasTiltOffset) {
            const amp = this._relativeOffsetAmplitude;
            // WAVE 7627: Same distScale cap as 8-bit path — never amplify, only reduce.
            const rawDistScale = this._spatialDistanceScales.get(node.nodeId) ?? 1.0;
            const effectiveDistScale = rawDistScale > 1 ? 1 : rawDistScale;
            // WAVE 7628: Save the pure IK 16-bit base for headroom computation.
            const basePan16 = safePan16;
            const baseTilt16 = safeTilt16;
            if (hasPanOffset) {
                const tiltNorm16 = safeTilt16 / 65535;
                const tiltDist16 = Math.abs(tiltNorm16 - VMM_GIMBAL_TILT_CENTER);
                const gimbalFactor16 = tiltDist16 >= VMM_GIMBAL_TILT_FADE_HALFWIDTH
                    ? 1
                    : tiltDist16 / VMM_GIMBAL_TILT_FADE_HALFWIDTH;
                const panDelta16 = panOffset * amp * VMM_OFFSET_SCALE_PAN * effectiveDistScale * gimbalFactor16 * 65535;
                // WAVE 7628: tanh soft-clip in 16-bit domain.
                const panHeadroom16 = panDelta16 > 0 ? (65535 - basePan16) : basePan16;
                let safePanDelta16;
                if (panHeadroom16 > 0) {
                    safePanDelta16 = Math.tanh(Math.abs(panDelta16) / panHeadroom16) * panHeadroom16 * Math.sign(panDelta16);
                }
                else {
                    safePanDelta16 = 0;
                }
                safePan16 = basePan16 + safePanDelta16;
            }
            if (hasTiltOffset) {
                const tiltDelta16 = tiltOffset * amp * VMM_OFFSET_SCALE_TILT * effectiveDistScale * 65535;
                // WAVE 7628: Same tanh soft-clip for tilt 16-bit.
                const tiltHeadroom16 = tiltDelta16 > 0 ? (65535 - baseTilt16) : baseTilt16;
                let safeTiltDelta16;
                if (tiltHeadroom16 > 0) {
                    safeTiltDelta16 = Math.tanh(Math.abs(tiltDelta16) / tiltHeadroom16) * tiltHeadroom16 * Math.sign(tiltDelta16);
                }
                else {
                    safeTiltDelta16 = 0;
                }
                safeTilt16 = baseTilt16 + safeTiltDelta16;
            }
        }
        // Clamp 16-bit values to valid range
        safePan16 = Math.max(0, Math.min(65535, Math.round(safePan16)));
        safeTilt16 = Math.max(0, Math.min(65535, Math.round(safeTilt16)));
        // WAVE 7616: Apply the same orientation inversion to 16-bit tilt.
        if (invertIKTilt) {
            safeTilt16 = Math.max(0, Math.min(65535, 65535 - safeTilt16));
        }
        for (let ci = 0; ci < node.channels.length; ci++) {
            const chDef = node.channels[ci];
            const isPan = chDef.type === 'pan';
            const isTilt = chDef.type === 'tilt';
            if (!isPan && !isTilt)
                continue;
            const bufIdx = baseAddr + chDef.dmxOffset;
            if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE)
                continue;
            if (chDef.is16bit) {
                // WAVE 7608: Split 16-bit value into MSB (coarse) and LSB (fine)
                const val16 = isPan ? safePan16 : safeTilt16;
                const coarse = (val16 >> 8) & 0xFF; // MSB → pan/tilt channel
                const fine = val16 & 0xFF; // LSB → pan_fine/tilt_fine channel
                buf[bufIdx] = coarse;
                const fineIdx = bufIdx + 1;
                if (fineIdx < DMX_UNIVERSE_SIZE) {
                    buf[fineIdx] = fine;
                }
            }
            else {
                // 8-bit fixture — use coarse value only
                const dmxValue = isPan ? safePan : safeTilt;
                buf[bufIdx] = dmxValue;
            }
        }
        // 🩸 WAVE 6040-DIAG: Confirm IK path actually wrote to buffer
        // if (this._resolveFrameIndex % 44 === 0) {
        //   console.log(`[KINETIC-DIAG] ${node.nodeId}: IK-PATH WRITTEN pan=${safePan} tilt=${safeTilt} enabled=${nodeWriteEnabled}`)
        // }
    }
    /**
     * WAVE 4547.1: Telemetría de alcance IK para futura visualización Ghost Ray.
     * true=alcanzable, false=fuera de rango, undefined=nodo aún no resuelto.
     */
    getKineticReachability(nodeId) {
        return this._ikReachability.get(nodeId);
    }
    /**
     * WAVE 4637: Orientation awareness solo para la ruta clásica KINETIC.
     * IK NO pasa por este camino para evitar doble negación.
     */
    _shouldInvertClassicKineticAxes(deviceOrientation, node) {
        const orientation = deviceOrientation?.toLowerCase().trim();
        if (orientation?.includes('ceiling') || orientation?.startsWith('truss')) {
            return true;
        }
        const installation = node.ikOrientation?.installation;
        if (installation === 'ceiling' || installation === 'truss-front' || installation === 'truss-back') {
            return true;
        }
        const pitch = node.ikOrientation?.rotation?.pitch;
        return Number.isFinite(pitch) && Math.abs(Math.abs(pitch) - 180) < 0.001;
    }
    _getDefaultNormalizedValue(_node, chDef) {
        // WAVE 4682: _mapChannels ya defaulteó undefined→255 para shutter/strobe.
        // El fallback destructivo `(>0 ? dv : 255)` fue eliminado — ignoraba
        // defaultValue:0 explícito del fixture JSON y forzaba 255 (Open/strobe).
        return chDef.defaultValue / 255;
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
    _getOrBuildIKProfile(node, calibration) {
        const cached = this._ikProfiles.get(node.nodeId);
        if (cached !== undefined)
            return cached;
        const ori = node.ikOrientation ?? DEFAULT_IK_ORIENTATION;
        const lim = node.ikLimits;
        const tiltLimits = lim?.tiltLimits ??
            (calibration?.tiltLimitMin !== undefined && calibration.tiltLimitMax !== undefined
                ? { min: calibration.tiltLimitMin, max: calibration.tiltLimitMax }
                : undefined);
        const profile = buildProfile(node.deviceId, node.physicalPosition, ori.rotation, ori.installation, node.ikCalibration ?? {
            panOffset: 0,
            tiltOffset: 0,
            panInvert: calibration?.invertPan ?? false,
            tiltInvert: calibration?.invertTilt ?? false,
        }, lim?.panRangeDeg, lim?.tiltRangeDeg, tiltLimits);
        this._ikProfiles.set(node.nodeId, profile);
        return profile;
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
    _translateColor(nodeId, mixingType, aetherWheel, rNorm, gNorm, bNorm, original) {
        // 🌊 WAVE 4690: brightness (intensidad virtual L0) escala r/g/b de L1.
        // Fixtures RGB sin dimmer físico necesitan que brightness actúe como
        // master dimmer multiplicativo para que el DMX refleje la curva líquida.
        const brightnessMult = sanitizeNormalizedValue(original['brightness'], 1.0);
        // Escalar a 0-255 para el ColorTranslator (que trabaja en 255)
        const safeR = sanitizeNormalizedValue(rNorm) * brightnessMult;
        const safeG = sanitizeNormalizedValue(gNorm) * brightnessMult;
        const safeB = sanitizeNormalizedValue(bNorm) * brightnessMult;
        this._rgbScratch.r = sanitizeDmxByte(Math.round(safeR * 255));
        this._rgbScratch.g = sanitizeDmxByte(Math.round(safeG * 255));
        this._rgbScratch.b = sanitizeDmxByte(Math.round(safeB * 255));
        // WAVE 4735.2: Reset centinelos NaN — "no escrito este frame".
        // El scratchpad se reutiliza cada llamada sin alloc (zero-alloc hot path).
        // NaN != undefined en la lookup de _writeNode, así V8 mantiene hidden class fija.
        const s = this._colorTranslateScratch;
        s[CH_RED] = s[CH_GREEN] = s[CH_BLUE] = NaN;
        s[CH_R] = s[CH_G] = s[CH_B] = NaN;
        s[CH_WHITE] = s[CH_CYAN] = s[CH_MAGENTA] = s[CH_YELLOW] = NaN;
        s[CH_COLOR_WHEEL] = s[CH_AMBER] = s[CH_UV] = NaN;
        s[DIMMER_CHANNEL] = NaN;
        switch (mixingType) {
            // ── RGB / pass-through ──────────────────────────────────────────
            case 'rgb':
            default:
                // Emitir los canales físicos red/green/blue (nombres legacy del Aether).
                // También preservar r/g/b abstractos por si algún canal del nodo
                // tiene type='r'/'g'/'b' (fixtures puramente abstractos).
                s[CH_RED] = safeR;
                s[CH_GREEN] = safeG;
                s[CH_BLUE] = safeB;
                s[CH_R] = safeR;
                s[CH_G] = safeG;
                s[CH_B] = safeB;
                return s;
            // ── RGBW ────────────────────────────────────────────────────────
            case 'rgbw': {
                const result = getColorTranslator().translate(this._rgbScratch, this._rgbwProfile);
                const rgbw = result.rgbw;
                if (!rgbw) {
                    // Fallback: sin datos RGBW, pass-through RGB
                    s[CH_RED] = safeR;
                    s[CH_GREEN] = safeG;
                    s[CH_BLUE] = safeB;
                    return s;
                }
                s[CH_RED] = rgbw.r / 255;
                s[CH_GREEN] = rgbw.g / 255;
                s[CH_BLUE] = rgbw.b / 255;
                s[CH_WHITE] = rgbw.w / 255;
                s[CH_R] = safeR;
                s[CH_G] = safeG;
                s[CH_B] = safeB;
                return s;
            }
            // ── CMY ─────────────────────────────────────────────────────────
            case 'cmy': {
                const result = getColorTranslator().translate(this._rgbScratch, this._cmyProfile);
                const cmy = result.cmy;
                if (!cmy) {
                    s[CH_RED] = safeR;
                    s[CH_GREEN] = safeG;
                    s[CH_BLUE] = safeB;
                    return s;
                }
                s[CH_CYAN] = cmy.c / 255;
                s[CH_MAGENTA] = cmy.m / 255;
                s[CH_YELLOW] = cmy.y / 255;
                // Preservar abstractos por compatibilidad
                s[CH_R] = safeR;
                s[CH_G] = safeG;
                s[CH_B] = safeB;
                return s;
            }
            // ── COLOR WHEEL ─────────────────────────────────────────────────
            case 'wheel':
            case 'hybrid': {
                if (!aetherWheel || aetherWheel.slots.length === 0) {
                    // Sin datos de rueda: pass-through RGB
                    s[CH_RED] = safeR;
                    s[CH_GREEN] = safeG;
                    s[CH_BLUE] = safeB;
                    s[CH_R] = safeR;
                    s[CH_G] = safeG;
                    s[CH_B] = safeB;
                    return s;
                }
                // Convertir ColorWheelDefinition del Aether (slots[]) al formato
                // del ColorTranslator HAL (colors[]) sin alloc persistente.
                const legacyWheel = this._aetherWheelToLegacy(aetherWheel);
                let wheelProfile = this._wheelProfileCache.get(legacyWheel);
                if (!wheelProfile) {
                    wheelProfile = { colorEngine: { mixing: 'wheel', colorWheel: legacyWheel } };
                    this._wheelProfileCache.set(legacyWheel, wheelProfile);
                }
                const result = getColorTranslator().translate(this._rgbScratch, wheelProfile);
                // colorWheelDmx está en escala 0-255 — normalizar a 0-1 para el pipeline
                const wheelDmxRaw = result.colorWheelDmx ?? 0;
                let wheelDmxNorm = wheelDmxRaw / 255;
                // ── HarmonicQuantizer: gating musical de cambios de rueda ────
                // Solo bloquea si bpmConfidence > 0.3 (umbral interno del quantizer)
                const qResult = getHarmonicQuantizer().quantize(nodeId, this._rgbScratch, _currentBpm, _currentBpmConfidence, aetherWheel.minTransitionMs);
                if (!qResult.colorAllowed) {
                    // El quantizer bloquea el cambio: retener el último valor permitido.
                    // Recuperamos el estado del quantizer para el último color que pasó.
                    const qState = getHarmonicQuantizer().getFixtureState(nodeId);
                    if (qState?.lastAllowedColor) {
                        // El lastAllowedColor está en {r,g,b} 0-255.
                        // Pasarlo otra vez por el translator para obtener el DMX de rueda correcto.
                        const heldResult = getColorTranslator().translate(qState.lastAllowedColor, wheelProfile);
                        wheelDmxNorm = (heldResult.colorWheelDmx ?? 0) / 255;
                    }
                    // Si no hay lastAllowedColor, mantenemos el valor ya calculado
                    // (puede ser 0 = Open en la primera retención).
                    // WAVE 7176: Pre-emptive blackout — the color change is pending but
                    // gated by the quantizer. Notify the safety middleware so cross-node
                    // and final sweeps zero the dimmer BEFORE the wheel moves, preventing
                    // the 1-tick flash of the old color at full intensity.
                    if (this._safetyMiddleware) {
                        this._safetyMiddleware.notifyPendingColorChange(nodeId);
                    }
                }
                // ★ WAVE 4557: DarkSpin — transit blackout via AetherSafetyMiddleware
                // If the color wheel value changed, force dimmer=0 during mechanical transit.
                // Applied AFTER HarmonicQuantizer (which decides IF the change occurs).
                const darkSpinEligible = this._isDarkSpinEligibleColorNode(this._graph.getNodeData(nodeId));
                if (this._safetyMiddleware && darkSpinEligible && aetherWheel.minTransitionMs > 0) {
                    const wheelDmxForDarkSpin = Math.round(wheelDmxNorm * 255);
                    const inBlackout = this._safetyMiddleware.checkDarkSpin(nodeId, wheelDmxForDarkSpin, aetherWheel.minTransitionMs, aetherWheel.allowsContinuousSpin ?? false);
                    if (inBlackout) {
                        s[CH_COLOR_WHEEL] = wheelDmxNorm;
                        s[CH_R] = safeR;
                        s[CH_G] = safeG;
                        s[CH_B] = safeB;
                        s[DIMMER_CHANNEL] = 0; // ★ BLACKOUT: hide mechanical crystal transit
                        return s;
                    }
                }
                // Para hybrid: también emitir canales RGB si el nodo los tiene
                s[CH_COLOR_WHEEL] = wheelDmxNorm;
                s[CH_R] = safeR;
                s[CH_G] = safeG;
                s[CH_B] = safeB;
                return s;
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
    _isDarkSpinEligibleColorNode(node) {
        if (!node || node.family !== NodeFamily.COLOR)
            return false;
        let hasWheelChannel = false;
        let hasElectronicMixChannels = false;
        for (let i = 0; i < node.channels.length; i++) {
            const channelType = node.channels[i].type;
            if (channelType === CH_COLOR_WHEEL) {
                hasWheelChannel = true;
            }
            else if (ELECTRONIC_COLOR_CHANNELS.has(channelType)) {
                hasElectronicMixChannels = true;
            }
        }
        if (hasElectronicMixChannels && !hasWheelChannel)
            return false;
        return hasWheelChannel && !!node.colorWheel && node.colorWheel.minTransitionMs > 0;
    }
    /**
     * WAVE 4522.4: Adapta ColorWheelDefinition del Aether (slots[]) al formato
     * que espera el ColorTranslator del HAL (colors[] con {dmx, name, rgb}).
     *
     * El resultado es un objeto inline — se construye cada llamada pero
     * el ColorTranslator tiene su propio LRU cache que absorbe la repetición.
     * Esta conversión solo ocurre en nodos wheel/hybrid.
     */
    _aetherWheelToLegacy(wheel) {
        // WAVE 4735.2: WeakMap cache — las ColorWheelDefinition son estables durante un show
        // (solo cambian en patch). Evita el .map() en cada frame por nodo wheel.
        const cached = this._wheelLegacyCache.get(wheel);
        if (cached)
            return cached;
        const result = {
            colors: wheel.slots.map(slot => ({
                dmx: slot.dmxValue,
                name: slot.name,
                rgb: { r: slot.previewRgb.r, g: slot.previewRgb.g, b: slot.previewRgb.b },
            })),
            allowsContinuousSpin: wheel.allowsContinuousSpin ?? false,
            minChangeTimeMs: wheel.minTransitionMs,
        };
        this._wheelLegacyCache.set(wheel, result);
        return result;
    }
    /**
     * Aplica la TransferCurve al valor normalizado (0-1).
     *
     * Si no hay curva o el tipo es 'linear', retorna el valor sin modificar.
     * Las curvas codifican la relación perceptual entre el valor del System
     * (lineal) y el rango DMX del hardware.
     */
    _applyTransferCurve(value, _chDef, curve) {
        if (!curve || curve.type === 'linear')
            return value;
        // Noise gate: input por debajo del umbral → output 0
        if (curve.noiseGate && value < curve.noiseGate)
            return 0;
        switch (curve.type) {
            case 'exponential':
                return Math.pow(value, curve.exponent ?? 2.5);
            case 'logarithmic':
                // log(1 + value) / log(2) normalizado para que f(1) = 1
                return Math.log1p(value) / Math.log1p(1);
            case 'scurve':
                // Hermite S-curve suave: 3t²-2t³
                return value * value * (3 - 2 * value);
            case 'gamma':
                return Math.pow(value, 1 / (curve.gamma ?? 2.2));
            default:
                return value;
        }
    }
    /**
     * Aplica calibración física al valor DMX final.
     *
     * Gestiona inversión de ejes, offsets y límites de seguridad.
     * Solo toca los canales relevantes para cada parámetro.
     */
    _applyCalibration(dmxValue, channelType, calibration) {
        // ── Pan ──────────────────────────────────────────────────────────────
        if (PAN_CHANNELS.has(channelType)) {
            let v = dmxValue;
            if (calibration.invertPan)
                v = 255 - v;
            if (channelType === PAN_COARSE && calibration.panOffset) {
                v = v + calibration.panOffset;
            }
            return v;
        }
        // ── Tilt ─────────────────────────────────────────────────────────────
        if (TILT_CHANNELS.has(channelType)) {
            let v = dmxValue;
            if (calibration.invertTilt)
                v = 255 - v;
            if (channelType === TILT_COARSE && calibration.tiltOffset) {
                v = v + calibration.tiltOffset;
            }
            // Límites de seguridad (solo en el canal coarse)
            if (channelType === TILT_COARSE) {
                if (calibration.tiltLimitMin !== undefined && v < calibration.tiltLimitMin) {
                    v = calibration.tiltLimitMin;
                }
                if (calibration.tiltLimitMax !== undefined && v > calibration.tiltLimitMax) {
                    v = calibration.tiltLimitMax;
                }
            }
            return v;
        }
        // ── Dimmer scale + dead-zone floor ───────────────────────────────────
        if (channelType === DIMMER_CHANNEL) {
            let v = dmxValue;
            if (calibration.dimmerScale !== undefined) {
                v = Math.round(v * calibration.dimmerScale);
            }
            // WAVE 1135.3: Dead-zone floor — eleva valores no-cero por debajo del mínimo
            // real de encendido. 0 intencional (apagado) nunca se eleva.
            if (calibration.dimmerMin !== undefined && v > 0 && v < calibration.dimmerMin) {
                v = calibration.dimmerMin;
            }
            return v;
        }
        return dmxValue;
    }
    /**
     * Obtiene o crea un MutableDMXPacket del pool para un universo dado.
     * Zero-alloc si el universo ya existe en el pool.
     */
    _getOrCreatePacket(universe) {
        for (let i = 0; i < this._packetPool.length; i++) {
            if (this._packetPool[i].universe === universe) {
                return this._packetPool[i];
            }
        }
        // No debería llegar aquí si registerUniverse() fue llamado correctamente
        // en patch time. Creamos el packet como fallback.
        const packet = {
            universe,
            address: 1,
            channels: new Array(DMX_UNIVERSE_SIZE).fill(0),
        };
        this._packetPool.push(packet);
        return packet;
    }
}
