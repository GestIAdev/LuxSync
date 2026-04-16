/**
 * 🎨 WAVE 153: ART-NET DRIVER (UDP Native)
 * ============================================================================
 * Driver nativo para protocolo Art-Net DMX sobre UDP.
 *
 * Características:
 * - Puerto UDP 6454 (estándar Art-Net)
 * - Broadcast (255.255.255.255) o unicast configurable
 * - Rate limiting integrado (evita saturación de red)
 * - Sequence rolling counter 1-255
 * - Soporte multi-universo
 *
 * Protocolo Art-Net (Art-DMX Packet):
 * - ID: "Art-Net\0" (8 bytes)
 * - OpCode: 0x5000 (2 bytes, little-endian)
 * - ProtVer: 0x0e00 (2 bytes, big-endian = 14)
 * - Sequence: 1-255 (1 byte, rolling)
 * - Physical: 0 (1 byte)
 * - SubUni/Net: Universe (2 bytes)
 * - Length: 512 (2 bytes, big-endian)
 * - Data: 512 bytes DMX
 *
 * @see https://art-net.org.uk/resources/art-net-specification/
 * ============================================================================
 */
import * as dgram from 'dgram';
import { EventEmitter } from 'events';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES ART-NET
// ─────────────────────────────────────────────────────────────────────────────
const ARTNET_PORT = 6454;
const ARTNET_HEADER = Buffer.from('Art-Net\0');
const ARTNET_OPCODE_DMX = 0x5000; // ArtDmx
const ARTNET_OPCODE_POLL = 0x2000; // ArtPoll  — handshake con nodos Pro
const ARTNET_PROTOCOL_VERSION = 14;
const DMX_CHANNELS = 512;
// Header Art-DMX packet (18 bytes antes de data)
const ARTDMX_HEADER_SIZE = 18;
// ArtPoll packet size (14 bytes exactos según spec Art-Net 4)
const ARTPOLL_PACKET_SIZE = 14;
// Intervalo de ArtPoll — spec Art-Net 4 §4: entre 1s y 3s
const ARTPOLL_INTERVAL_MS = 2500;
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export class ArtNetDriver extends EventEmitter {
    constructor(config = {}) {
        super();
        this.socket = null;
        this.state = 'disconnected';
        this.universeBuffers = new Map(); // 🌊 Multi-universe
        this.sequence = 1; // 1-255, 0 = disabled
        this.framesSent = 0;
        this.packetsDropped = 0;
        this.lastSendTime = 0;
        this.sendLatencies = [];
        this.lastFrameTime = 0;
        this.artPollTimer = null; // WAVE 2525: ArtPoll
        this.config = {
            // 🎯 WAVE 153.7: Default a IP del nodo IMC Pro H1 (no broadcast!)
            ip: config.ip ?? '10.0.0.10',
            port: config.port ?? ARTNET_PORT,
            // WAVE 2525: Universe 1 — interfaces Pro ignoran universo 0 por convención
            universe: config.universe ?? 1,
            // WAVE 2525: 44Hz para salida sincronizada con TitanOrchestrator
            refreshRate: config.refreshRate ?? 44,
            nodeName: config.nodeName ?? 'LuxSync',
            debug: config.debug ?? false,
        };
        // Buffer DMX (512 canales) - Legacy universe 0
        this.dmxBuffer = Buffer.alloc(DMX_CHANNELS, 0);
        // 🌊 WAVE 2020.2b: Initialize universe 0 in multi-universe map
        this.universeBuffers.set(0, this.dmxBuffer);
        // Intervalo mínimo entre envíos (rate limiting)
        this.minSendInterval = 1000 / this.config.refreshRate;
        // WAVE 2098: Boot silence
    }
    // ─────────────────────────────────────────────────────────────────────────
    // LIFECYCLE
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Inicializar socket UDP
     */
    async start() {
        if (this.socket) {
            this.log('⚠️ Socket already exists, closing first');
            await this.stop();
        }
        try {
            this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
            // ── WAVE 2542: Binding Estricto ──────────────────────────────────
            // Bind explícito a 0.0.0.0:6454 (puerto estándar Art-Net).
            // Los ArtPollReply del nodo llegan directamente a este puerto —
            // con puerto efímero el reply se perdía porque nadie escuchaba.
            // reuseAddr:true (arriba) evita conflictos si hay otra app Art-Net.
            await new Promise((resolve, reject) => {
                this.socket.bind(ARTNET_PORT, '0.0.0.0', () => {
                    this.log(`✅ Socket bound to port ${this.socket.address().port}`);
                    resolve();
                });
                this.socket.once('error', reject);
            });
            // Habilitar broadcast (siempre — necesario para ArtPoll de subred)
            this.socket.setBroadcast(true);
            // Event handlers
            this.socket.on('error', (err) => {
                this.log(`❌ Socket error: ${err.message}`);
                this.state = 'error';
                this.emit('error', err);
            });
            this.socket.on('close', () => {
                this.log('🔌 Socket closed');
                this.state = 'disconnected';
                this.emit('disconnected');
            });
            // ── WAVE 2525: ArtPollReply listener ──────────────────────────────
            // Escuchar respuestas de nodos Art-Net (ArtPollReply OpCode 0x2100).
            // Cuando la IMC responde, confirmamos que está viva y emitimos evento.
            this.socket.on('message', (msg, rinfo) => {
                if (msg.length < 10)
                    return;
                // Verificar ID Art-Net
                if (msg.toString('ascii', 0, 7) !== 'Art-Net')
                    return;
                const opcode = msg.readUInt16LE(8);
                if (opcode === 0x2100) { // ArtPollReply
                    this.log(`🟢 ArtPollReply from ${rinfo.address} — node alive`);
                    this.emit('node-discovered', { ip: rinfo.address });
                }
            });
            this.state = 'ready';
            this.emit('ready');
            this.log('✅ ArtNet ready');
            // ── WAVE 2525: ArtPoll inicial + timer periódico ──────────────────
            // Art-Net 4 §4: Los controladores DEBEN enviar ArtPoll al arrancar y
            // cada 2.5s para mantener el forwarding activo en interfaces Pro.
            this.sendArtPoll();
            this.artPollTimer = setInterval(() => this.sendArtPoll(), ARTPOLL_INTERVAL_MS);
            return true;
        }
        catch (error) {
            this.log(`❌ Failed to start: ${error}`);
            this.state = 'error';
            return false;
        }
    }
    /**
     * Cerrar socket
     */
    async stop() {
        // Detener ArtPoll timer
        if (this.artPollTimer) {
            clearInterval(this.artPollTimer);
            this.artPollTimer = null;
        }
        if (this.socket) {
            return new Promise((resolve) => {
                this.socket.close(() => {
                    this.socket = null;
                    this.state = 'disconnected';
                    this.log('🛑 ArtNet stopped');
                    resolve();
                });
            });
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // DMX OUTPUT
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🌊 WAVE 2020.2b: Get or create buffer for a universe
     */
    getUniverseBuffer(universe) {
        if (!this.universeBuffers.has(universe)) {
            this.universeBuffers.set(universe, Buffer.alloc(DMX_CHANNELS, 0));
        }
        return this.universeBuffers.get(universe);
    }
    /**
     * Setear un canal DMX (1-512)
     * 🌊 WAVE 2020.2b: Ahora soporta universe parameter (default 0 para backward compat)
     */
    setChannel(channel, value, universe = 0) {
        if (channel >= 1 && channel <= 512) {
            const buffer = this.getUniverseBuffer(universe);
            buffer[channel - 1] = Math.max(0, Math.min(255, value));
        }
    }
    /**
     * Setear múltiples canales desde una dirección base
     * 🌊 WAVE 2020.2b: Ahora soporta universe parameter
     */
    setChannels(startChannel, values, universe = 0) {
        for (let i = 0; i < values.length; i++) {
            this.setChannel(startChannel + i, values[i], universe);
        }
    }
    /**
     * Copiar buffer DMX completo
     * 🌊 WAVE 2020.2b: Ahora soporta universe parameter
     */
    setBuffer(buffer, universe = 0) {
        const targetBuffer = this.getUniverseBuffer(universe);
        if (Buffer.isBuffer(buffer)) {
            buffer.copy(targetBuffer, 0, 0, Math.min(512, buffer.length));
        }
        else {
            for (let i = 0; i < Math.min(512, buffer.length); i++) {
                targetBuffer[i] = Math.max(0, Math.min(255, buffer[i]));
            }
        }
    }
    /**
     * Enviar frame DMX actual (universe 0 - backward compat)
     * Incluye rate limiting para evitar saturación UDP
     * 🌊 WAVE 2020.2b: Para multi-universe, usar sendAll()
     */
    send() {
        return this.sendUniverse(this.config.universe);
    }
    /**
     * 🌊 WAVE 2020.2b: Enviar un universo específico
     * Rate limiting es PER-UNIVERSE para máximo throughput
     */
    sendUniverse(universe) {
        if (!this.socket || this.state !== 'ready') {
            return false;
        }
        const buffer = this.universeBuffers.get(universe);
        if (!buffer) {
            return false;
        }
        // Rate limiting (global para simplificar - 30Hz total)
        const now = Date.now();
        const elapsed = now - this.lastFrameTime;
        if (elapsed < this.minSendInterval) {
            // Skip this frame, too soon
            this.packetsDropped++;
            return false;
        }
        this.lastFrameTime = now;
        // Construir paquete Art-DMX para este universo
        const packet = this.buildArtDmxPacketForUniverse(universe, buffer);
        // Enviar UDP
        const sendStart = performance.now();
        this.socket.send(packet, this.config.port, this.config.ip, (error) => {
            if (error) {
                this.log(`❌ Send error (uni ${universe}): ${error.message}`);
                this.packetsDropped++;
            }
            else {
                const latency = performance.now() - sendStart;
                this.framesSent++;
                this.lastSendTime = now;
                // Track latency (last 100 samples)
                this.sendLatencies.push(latency);
                if (this.sendLatencies.length > 100) {
                    this.sendLatencies.shift();
                }
            }
        });
        // Increment sequence (1-255, wraps)
        this.sequence = this.sequence >= 255 ? 1 : this.sequence + 1;
        return true;
    }
    /**
     * 🌊 WAVE 2020.2b: MULTI-UNIVERSE BATCH SEND
     * Envía TODOS los universos activos en paralelo usando Promise.all
     * Este es el método principal para 50+ universos
     */
    async sendAll() {
        if (!this.socket || this.state !== 'ready') {
            return { success: false, universesSent: 0, errors: 0 };
        }
        // Rate limiting global
        const now = Date.now();
        const elapsed = now - this.lastFrameTime;
        if (elapsed < this.minSendInterval) {
            this.packetsDropped += this.universeBuffers.size;
            return { success: false, universesSent: 0, errors: 0 };
        }
        this.lastFrameTime = now;
        const promises = [];
        const sendStart = performance.now();
        // Crear promesas para cada universo
        for (const [universe, buffer] of this.universeBuffers) {
            const packet = this.buildArtDmxPacketForUniverse(universe, buffer);
            const promise = new Promise((resolve) => {
                this.socket.send(packet, this.config.port, this.config.ip, (error) => {
                    if (error) {
                        this.log(`❌ Send error (uni ${universe}): ${error.message}`);
                        this.packetsDropped++;
                        resolve(false);
                    }
                    else {
                        resolve(true);
                    }
                });
            });
            promises.push(promise);
        }
        // Esperar a que todos se envíen en paralelo
        const results = await Promise.all(promises);
        const successCount = results.filter(r => r).length;
        const errorCount = results.length - successCount;
        // Track metrics
        const latency = performance.now() - sendStart;
        this.framesSent += successCount;
        this.lastSendTime = now;
        this.sendLatencies.push(latency);
        if (this.sendLatencies.length > 100) {
            this.sendLatencies.shift();
        }
        // Increment sequence
        this.sequence = this.sequence >= 255 ? 1 : this.sequence + 1;
        // ── WAVE 2543: DMX PAYLOAD TRACE (solo cuando debug=true) ───────────
        if (this.config.debug && this.framesSent % 88 === 0) {
            for (const [uni, buf] of this.universeBuffers) {
                const nonZero = buf.filter(b => b > 0).length;
                if (nonZero === 0) {
                    this.log(`🔬 U${uni} | BUFFER VACÍO`);
                }
                else {
                    let firstActive = buf.findIndex(b => b > 0);
                    this.log(`🔬 U${uni} | nonZero:${nonZero}/512 | first active ch${firstActive + 1}`);
                }
            }
        }
        return {
            success: errorCount === 0,
            universesSent: successCount,
            errors: errorCount
        };
    }
    /**
     * Blackout - todos los canales a 0
     * 🌊 WAVE 2020.2b: Ahora limpia TODOS los universos
     */
    blackout() {
        for (const buffer of this.universeBuffers.values()) {
            buffer.fill(0);
        }
        this.sendAll(); // Fire and forget
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PACKET BUILDING
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * WAVE 2525: Enviar ArtPoll (OpCode 0x2000) en broadcast.
     *
     * Art-Net 4 §4.1: El controlador DEBE enviar ArtPoll periódicamente para:
     *   1. Anunciar su presencia en la red
     *   2. Solicitar ArtPollReply de todos los nodos visibles
     *   3. Mantener activo el forwarding DMX en interfaces Pro (IMC, etc.)
     *
     * Estructura ArtPoll (14 bytes):
     * [0-7]  ID: "Art-Net\0"
     * [8-9]  OpCode: 0x2000 (little-endian)
     * [10-11] ProtVer: 14 (big-endian)
     * [12]   TalkToMe: 0x02 (send reply on change)
     * [13]   Priority: 0x00 (DP_Low)
     */
    sendArtPoll() {
        if (!this.socket || this.state !== 'ready')
            return;
        const packet = Buffer.alloc(ARTPOLL_PACKET_SIZE, 0);
        ARTNET_HEADER.copy(packet, 0);
        packet.writeUInt16LE(ARTNET_OPCODE_POLL, 8);
        packet.writeUInt16BE(ARTNET_PROTOCOL_VERSION, 10);
        packet.writeUInt8(0x02, 12); // TalkToMe: reply on change
        packet.writeUInt8(0x00, 13); // Priority: DP_Low
        // ── WAVE 2542: Unicast Polling ───────────────────────────────────
        // Art-Net 4 §4.2: El unicast a la IP exacta del nodo es válido y
        // evita la lotería del routing cuando hay múltiples NICs.
        // Enviamos dos paquetes:
        //   1. Unicast directo → config.ip (10.0.0.10) — garantizado llega
        //   2. Subnet broadcast → x.x.x.255 — descubre otros nodos en la red
        const sendPoll = (target) => {
            this.socket.send(packet, ARTNET_PORT, target, (err) => {
                if (err) {
                    this.log(`⚠️ ArtPoll send error → ${target}: ${err.message}`);
                }
                else {
                    this.log(`📡 ArtPoll → ${target}`);
                }
            });
        };
        // 1. Unicast: directo a la interfaz (obligatorio, route explícita)
        sendPoll(this.config.ip);
        // 2. Subnet broadcast: x.x.x.255 calculado desde config.ip
        const parts = this.config.ip.split('.');
        if (parts.length === 4) {
            const subnetBroadcast = `${parts[0]}.${parts[1]}.${parts[2]}.255`;
            if (subnetBroadcast !== this.config.ip) {
                sendPoll(subnetBroadcast);
            }
        }
    }
    /**
     * Construir paquete Art-DMX (OpDmx 0x5000) - Legacy para universe config
     */
    buildArtDmxPacket() {
        return this.buildArtDmxPacketForUniverse(this.config.universe, this.dmxBuffer);
    }
    /**
     * 🌊 WAVE 2020.2b: Construir paquete Art-DMX para cualquier universo
     *
     * Structure:
     * [0-7]   ID: "Art-Net\0"
     * [8-9]   OpCode: 0x5000 (little-endian)
     * [10-11] ProtVer: 14 (big-endian)
     * [12]    Sequence: 1-255
     * [13]    Physical: 0
     * [14]    SubUni: Universe low byte
     * [15]    Net: Universe high byte (bits 14-8)
     * [16-17] Length: 512 (big-endian)
     * [18+]   DMX Data
     */
    buildArtDmxPacketForUniverse(universe, buffer) {
        const packet = Buffer.alloc(ARTDMX_HEADER_SIZE + DMX_CHANNELS);
        // Header
        ARTNET_HEADER.copy(packet, 0);
        // OpCode (little-endian)
        packet.writeUInt16LE(ARTNET_OPCODE_DMX, 8);
        // Protocol Version (big-endian)
        packet.writeUInt16BE(ARTNET_PROTOCOL_VERSION, 10);
        // Sequence
        packet.writeUInt8(this.sequence, 12);
        // Physical (input port, usually 0)
        packet.writeUInt8(0, 13);
        // Universe: SubUni (low byte) + Net (high byte)
        // Art-Net universe = (Net << 8) | SubUni
        const subUni = universe & 0xFF;
        const net = (universe >> 8) & 0x7F; // 7 bits
        packet.writeUInt8(subUni, 14);
        packet.writeUInt8(net, 15);
        // Length (big-endian, always 512)
        packet.writeUInt16BE(DMX_CHANNELS, 16);
        // DMX Data
        buffer.copy(packet, ARTDMX_HEADER_SIZE);
        return packet;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // 🌊 WAVE 2020.2b: UNIVERSE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Get number of active universes
     */
    getUniverseCount() {
        return this.universeBuffers.size;
    }
    /**
     * Get list of active universe numbers
     */
    getActiveUniverses() {
        return Array.from(this.universeBuffers.keys());
    }
    /**
     * Clear a specific universe (remove from active set)
     */
    clearUniverse(universe) {
        if (universe !== 0) { // Never remove universe 0 (legacy compat)
            this.universeBuffers.delete(universe);
        }
    }
    /**
     * Clear all universes except 0
     */
    clearAllUniverses() {
        const universe0 = this.universeBuffers.get(0);
        this.universeBuffers.clear();
        if (universe0) {
            this.universeBuffers.set(0, universe0);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // CONFIGURATION
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Actualizar configuración en caliente
     */
    configure(config) {
        if (config.ip !== undefined) {
            this.config.ip = config.ip;
            // Actualizar broadcast si cambió IP y el socket está activo
            // Solo podemos llamar setBroadcast si el socket está bound (state === 'ready')
            if (this.socket && this.state === 'ready') {
                try {
                    if (config.ip === '255.255.255.255' || config.ip.endsWith('.255')) {
                        this.socket.setBroadcast(true);
                    }
                }
                catch (err) {
                    this.log(`⚠️ Could not set broadcast: ${err}`);
                }
            }
        }
        if (config.port !== undefined) {
            this.config.port = config.port;
        }
        if (config.universe !== undefined) {
            this.config.universe = config.universe;
        }
        if (config.refreshRate !== undefined) {
            this.config.refreshRate = config.refreshRate;
            this.minSendInterval = 1000 / config.refreshRate;
        }
        this.log(`⚙️ Config updated: ${JSON.stringify(this.config)}`);
        this.emit('configured', this.config);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // STATUS
    // ─────────────────────────────────────────────────────────────────────────
    get isConnected() {
        return this.state === 'ready' && this.socket !== null;
    }
    get currentConfig() {
        return { ...this.config };
    }
    getStatus() {
        const avgLatency = this.sendLatencies.length > 0
            ? this.sendLatencies.reduce((a, b) => a + b, 0) / this.sendLatencies.length
            : 0;
        return {
            state: this.state,
            ip: this.config.ip,
            port: this.config.port,
            universe: this.config.universe,
            framesSent: this.framesSent,
            lastSendTime: this.lastSendTime,
            packetsDropped: this.packetsDropped,
            avgLatency: Math.round(avgLatency * 100) / 100,
        };
    }
    /**
     * Obtener buffer DMX actual (copia)
     */
    getBuffer() {
        return Buffer.from(this.dmxBuffer);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────
    log(message) {
        if (this.config.debug) {
            console.log(`[ArtNet] ${message}`);
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────
/** Instancia singleton del driver Art-Net */
export const artNetDriver = new ArtNetDriver({ debug: true });
export default ArtNetDriver;
