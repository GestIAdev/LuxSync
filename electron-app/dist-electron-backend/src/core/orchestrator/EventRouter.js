/**
 * 🌊 WAVE 240: EVENT ROUTER
 *
 * Centraliza el flujo de eventos internos (no IPC).
 * Configura las tuberías: Brain → Engine → HAL
 *
 * @module EventRouter
 */
import { EventEmitter } from 'events';
/**
 * 🔄 EventRouter - La Centralita de TITAN 2.0
 *
 * Conecta los módulos principales y enruta eventos entre ellos:
 * - Brain (TrinityBrain) produce MusicalContext
 * - Engine (TitanEngine) produce LightingIntent
 * - HAL (HardwareAbstraction) produce DMX Output
 */
export class EventRouter extends EventEmitter {
    constructor() {
        super();
        this.brain = null;
        this.engine = null;
        this.hal = null;
        this.isRunning = false;
        this.frameCount = 0;
        this.lastLogTime = 0;
        console.log('[EventRouter] 🔄 Initialized (WAVE 240)');
    }
    /**
     * Conecta los tres módulos principales
     */
    connect(brain, engine, hal) {
        this.brain = brain;
        this.engine = engine;
        this.hal = hal;
        console.log('[EventRouter] 🔗 Connecting modules...');
        // ═══════════════════════════════════════════════════════════════════════
        // BRAIN → ENGINE: MusicalContext
        // ═══════════════════════════════════════════════════════════════════════
        brain.on('context-update', (context) => {
            if (!this.isRunning)
                return;
            this.frameCount++;
            try {
                // Procesar en el engine
                const intent = engine.process(context);
                // Emitir para el siguiente paso
                this.emit('lighting-intent', intent);
                // Log throttled (cada 30 frames)
                if (this.frameCount % 30 === 0) {
                    const now = Date.now();
                    if (now - this.lastLogTime > 1000) {
                        console.log(`[EventRouter] 🔄 Frame ${this.frameCount}: context → intent`);
                        this.lastLogTime = now;
                    }
                }
            }
            catch (err) {
                this.emit('error', err, 'brain→engine');
            }
        });
        // ═══════════════════════════════════════════════════════════════════════
        // ENGINE → HAL: LightingIntent
        // ═══════════════════════════════════════════════════════════════════════
        this.on('lighting-intent', (intent) => {
            if (!this.isRunning)
                return;
            try {
                // Renderizar en HAL
                const dmxPackets = hal.render(intent);
                // Enviar cada paquete DMX
                for (const packet of dmxPackets) {
                    this.emit('dmx-output', packet);
                    hal.sendDMX?.(packet);
                }
            }
            catch (err) {
                this.emit('error', err, 'engine→hal');
            }
        });
        // ═══════════════════════════════════════════════════════════════════════
        // HAL → DMX (Final output)
        // ═══════════════════════════════════════════════════════════════════════
        this.on('dmx-output', (packet) => {
            // El HAL ya envía directamente, esto es para observadores externos
            // (visualizadores, logging, etc.)
        });
        console.log('[EventRouter] ✅ All modules connected');
        console.log('[EventRouter]    Brain  → [context-update] → Engine');
        console.log('[EventRouter]    Engine → [lighting-intent] → HAL');
        console.log('[EventRouter]    HAL    → [dmx-output] → Hardware');
    }
    /**
     * Inicia el routing de eventos
     */
    start() {
        if (this.isRunning) {
            console.warn('[EventRouter] ⚠️ Already running');
            return;
        }
        this.isRunning = true;
        this.frameCount = 0;
        this.lastLogTime = Date.now();
        console.log('[EventRouter] ▶️ Started');
        this.emit('system-start');
    }
    /**
     * Detiene el routing de eventos
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        console.log(`[EventRouter] ⏹️ Stopped after ${this.frameCount} frames`);
        this.emit('system-stop');
    }
    /**
     * Inyecta un contexto manualmente (para tests o modo manual)
     */
    injectContext(context) {
        if (!this.engine) {
            console.warn('[EventRouter] ⚠️ No engine connected');
            return;
        }
        const intent = this.engine.process(context);
        this.emit('lighting-intent', intent);
    }
    /**
     * Inyecta audio analysis directamente al brain
     */
    injectAudio(analysis) {
        this.emit('audio-analysis', analysis);
    }
    /**
     * Obtiene estadísticas del router
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            frameCount: this.frameCount,
            hasBrain: this.brain !== null,
            hasEngine: this.engine !== null,
            hasHAL: this.hal !== null,
        };
    }
    /**
     * Destruye el router y limpia listeners
     */
    destroy() {
        this.stop();
        this.removeAllListeners();
        this.brain = null;
        this.engine = null;
        this.hal = null;
        console.log('[EventRouter] 🗑️ Destroyed');
    }
}
/**
 * Singleton instance para uso global
 */
let eventRouterInstance = null;
export function getEventRouter() {
    if (!eventRouterInstance) {
        eventRouterInstance = new EventRouter();
    }
    return eventRouterInstance;
}
export function resetEventRouter() {
    if (eventRouterInstance) {
        eventRouterInstance.destroy();
        eventRouterInstance = null;
    }
}
