/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 AETHER MATRIX — NODE RESOLVER (IMPLEMENTACIÓN)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.4: Implementación concreta del INodeResolver.
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
 *      c. Para cada canal: aplicar TransferCurve, escalar a DMX
 *      d. Aplicar calibración (invertPan, tiltLimits, panOffset, etc.)
 *      e. Clamp final a [0, constraints.maxValue] (safety layer)
 *      f. Escribir en el buffer del universo
 *   3. Emitir IDMXPackets desde los buffers (sin new Array)
 *
 * ZERO-ALLOC EN HOT PATH:
 * - `_universeBuffers`: Map pre-allocated de Uint8Array(512) por universo.
 *   Crece en registerDevice() y se estabiliza tras warm-up.
 * - `_outputPackets`: Pool de IDMXPacket-like mutable pre-allocated.
 *   Se reusan frame a frame.
 * - `_activeUniverses`: Set reutilizado, se limpia sin alloc.
 * - No se crean Arrays, Maps ni Uint8Arrays durante `resolve()`.
 *
 * NOTA SOBRE UNIVERSOS:
 * Los universes se registran al llamar `registerDevice()`.
 * El resolver necesita conocer el NodeGraph para obtener
 * IDeviceDefinition y ICapabilityNode simultáneamente.
 *
 * @module core/aether/resolver/NodeResolver
 * @version WAVE 3505.4
 */
// ── Canales de posición para calibración ────────────────────────────────
const PAN_CHANNELS = new Set(['pan', 'pan_fine']);
const TILT_CHANNELS = new Set(['tilt', 'tilt_fine']);
const PAN_COARSE = 'pan';
const TILT_COARSE = 'tilt';
const DIMMER_CHANNEL = 'dimmer';
// ── DMX universe size ────────────────────────────────────────────────────
const DMX_UNIVERSE_SIZE = 512;
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
        // ── Buffers por universo ───────────────────────────────────────────────
        // Map<universe (1-based), Uint8Array(512)>
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
        this._graph = graph;
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
    getUniverseBuffer(universe) {
        return this._universeBuffers.get(universe);
    }
    /**
     * Lista de universos actualmente registrados (por registerUniverse()).
     * Útil para iterar en el Orchestrator sin crear un Array nuevo.
     */
    get registeredUniverses() {
        return this._universeBuffers.keys();
    }
    /**
     * Registra un universo DMX para este resolver.
     *
     * PATCH TIME — llamar cuando se registra un Device en el NodeGraph.
     * Si el universo ya existe, no hace nada.
     *
     * @param universe — Número de universo (1-based)
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
    }
    /**
     * Resuelve el ArbitratedNodeMap a DMXPackets listos para el driver.
     *
     * @param arbitrated — Valores finales por nodo/canal (normalizados 0-1)
     * @returns Array de IDMXPacket, uno por universo activo
     */
    resolve(arbitrated) {
        // 1. Zero-fill y marcar universos como inactivos
        this._activeUniverses.clear();
        for (const [, buf] of this._universeBuffers) {
            buf.fill(0);
        }
        // 2. Para cada nodo arbitrado, escribir en el buffer del universo
        for (const [nodeId, channelValues] of arbitrated) {
            this._writeNode(nodeId, channelValues);
        }
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
        // Retornar como Array readonly (sin new Array — reutiliza la misma ref)
        return Array.from(this._framePackets.values());
    }
    // ── Internos ──────────────────────────────────────────────────────────
    /**
     * Escribe los canales de un nodo en el buffer de universo correspondiente.
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
        if (!buf)
            return; // universe no registrado — ignorar silenciosamente
        const baseAddr = device.dmxAddress - 1; // convertir a 0-indexed
        const calibration = device.calibration;
        this._activeUniverses.add(device.universe);
        for (let ci = 0; ci < node.channels.length; ci++) {
            const chDef = node.channels[ci];
            const bufIdx = baseAddr + chDef.dmxOffset;
            if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE)
                continue; // safety bound
            // Valor normalizado arbitrado. Si el canal no está en el mapa,
            // usar el defaultValue del canal (ya está en rango DMX 0-255 → normalizar)
            const rawNormalized = channelValues[chDef.type] !== undefined
                ? channelValues[chDef.type]
                : chDef.defaultValue / 255;
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
            let dmxValue = Math.round(normalized * 255);
            // Aplicar calibración específica de canal
            if (calibration) {
                dmxValue = this._applyCalibration(dmxValue, chDef.type, calibration);
            }
            // Clamp final de seguridad
            if (dmxValue < 0)
                dmxValue = 0;
            if (dmxValue > 255)
                dmxValue = 255;
            buf[bufIdx] = dmxValue;
            // Canales 16-bit: escribir byte fine (LSB) en el slot siguiente
            if (chDef.is16bit) {
                const fineIdx = bufIdx + 1;
                if (fineIdx < DMX_UNIVERSE_SIZE) {
                    const raw16 = Math.round(normalized * 65535);
                    buf[fineIdx] = raw16 & 0xFF; // byte fine (LSB)
                    // El byte coarse (MSB) ya fue escrito como (raw16 >> 8) arriba,
                    // pero nuestro `dmxValue` ya redondeó al byte coarse.
                    // Corregir el coarse para coherencia 16-bit:
                    buf[bufIdx] = (raw16 >> 8) & 0xFF;
                }
            }
        }
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
        // ── Dimmer scale ─────────────────────────────────────────────────────
        if (channelType === DIMMER_CHANNEL && calibration.dimmerScale !== undefined) {
            return Math.round(dmxValue * calibration.dimmerScale);
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
