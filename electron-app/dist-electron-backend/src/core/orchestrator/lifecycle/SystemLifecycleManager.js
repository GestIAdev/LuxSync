/**
 * WAVE 4964 PHASE 9: SYSTEM LIFECYCLE MANAGER
 * @module SystemLifecycleManager
 */
import { VirtualWireProvider } from '../../audio/VirtualWireProvider';
import { USBDirectLinkProvider } from '../../audio/USBDirectLinkProvider';
import { TitanEngine } from '../../../engine/TitanEngine';
import { HardwareAbstraction } from '../../../hal/HardwareAbstraction';
import { universalDMX } from '../../../hal/drivers/UniversalDMXDriver';
import { TrinityBrain } from '../../../brain/TrinityBrain';
import { getTrinity } from '../../../workers/TrinityOrchestrator';
import { OSCNexusProvider } from '../../audio/OSCNexusProvider';
import { vibeMovementManager } from '../../../engine/movement/VibeMovementManager';
export class SystemLifecycleManager {
    constructor(ctx) { this.ctx = ctx; }
    async init() {
        if (this.ctx.isInitialized) {
            return;
        }
        // Initialize Brain
        this.ctx.brain = new TrinityBrain();
        // Connect Brain to Trinity Orchestrator and START the neural network
        try {
            const trinity = getTrinity();
            this.ctx.trinity = trinity; // ðŸ§  WAVE 258: Save reference for audio feeding
            this.ctx.brain.connectToOrchestrator(trinity);
            // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            // ðŸ”¥ WAVE 1012.5: HYBRID SOURCE ARCHITECTURE
            // 
            // Frontend (30fps) â†’ bass/mid/high/energy â†’ processAudioFrame()
            // Worker (10fps) â†’ harshness/flatness/centroid/transients â†’ brain.on('audio-levels')
            // 
            // El Worker TAMBIÃ‰N envÃ­a bass/mid/high, pero los IGNORAMOS aquÃ­ porque
            // el Frontend tiene mayor frecuencia (30fps vs 10fps) y da fluidez visual.
            // El Worker es autoritativo SOLO para mÃ©tricas FFT extendidas.
            // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            // ðŸ”¥ WAVE 1012.5: HYBRID SOURCE ARCHITECTURE
            // 
            // Frontend (60fps) â†’ bass/mid/high/energy â†’ processAudioFrame()
            // Worker (10fps) â†’ harshness/flatness/centroid/transients â†’ brain.on('audio-levels')
            // 
            // Frontend tiene PRIORIDAD TEMPORAL para core bands (60fps > 10fps)
            // Worker es autoritativo SOLO para mÃ©tricas FFT extendidas.
            // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            // âš¡ WAVE 3060b PHOENIX: RESTAURADO â€” Frontend = core bands, Worker = extended FFT only
            this.ctx.audioPipeline.wireAudioLevelsHandler();
            await trinity.start();
            // WAVE 3401: Initialize OSC Nexus Provider
            // Register with AudioMatrix for bidirectional OSC + audio input
            this.ctx.oscProvider = new OSCNexusProvider();
            const audioMatrix = trinity.getAudioMatrix();
            if (audioMatrix) {
                audioMatrix.registerProvider(this.ctx.oscProvider);
            }
            try {
                await this.ctx.oscProvider.start();
                // OSCNexusProvider started log silenced
            }
            catch (oscErr) {
                console.error('[TitanOrchestrator] âš ï¸ OSCNexusProvider failed to start:', oscErr);
                // Non-fatal: LuxSync operates without OSC. Provider state â†’ error, AudioMatrix falls back.
            }
            // WAVE 3402: Register native audio providers (VirtualWire + USBDirectLink)
            // initialize() detects hardware / checks addon availability â€” never throws
            if (audioMatrix) {
                this.ctx.virtualWireProvider = new VirtualWireProvider();
                await this.ctx.virtualWireProvider.initialize({});
                audioMatrix.registerProvider(this.ctx.virtualWireProvider);
                // VirtualWireProvider registered log silenced
                this.ctx.usbDirectLinkProvider = new USBDirectLinkProvider();
                await this.ctx.usbDirectLinkProvider.initialize({});
                audioMatrix.registerProvider(this.ctx.usbDirectLinkProvider);
                // USBDirectLinkProvider registered log silenced
            }
        }
        catch (e) {
            console.error('[TitanOrchestrator] âŒ Trinity startup failed:', e);
        }
        // Initialize Engine with initial vibe
        this.ctx.engine = new TitanEngine({
            debug: this.ctx.config.debug,
            initialVibe: this.ctx.config.initialVibe
        });
        this.ctx.audioPipeline.initBeatDetector();
        this.ctx.engine.on('log', (logEntry) => {
            this.ctx.log(logEntry.category, logEntry.message, logEntry.data);
        });
        this.ctx.hal = new HardwareAbstraction({
            debug: this.ctx.config.debug,
            // ðŸ”¥ WAVE: USB por defecto. Si hay externalDriver, HardwareAbstraction lo usa y este valor no estorba.
            driverType: 'usb',
            externalDriver: this.ctx.config.dmxDriver
        });
        this.ctx.isInitialized = true;
        // WAVE 2098: Boot silence â€” all init logs removed, unified banner in main.ts
    }
    start() {
        if (!this.ctx.isInitialized) {
            console.error('[TitanOrchestrator] Cannot start - not initialized');
            return;
        }
        if (this.ctx.isRunning) {
            return;
        }
        this.ctx.isRunning = true;
        // âš¡ WAVE 3504.5: 44 Hz interval + Stampede Guard delegated to FrameScheduler
        this.ctx.scheduler.start();
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // ðŸ«€ OPERACIÃ“N CARDIOGRAMA â€” Event Loop Lag Monitor (Main Thread)
        // Detecta GC Stop-The-World pauses y saturaciÃ³n del event loop.
        // Un delta > 25ms indica que el event loop estuvo bloqueado mÃ¡s de
        // lo esperado â€” GC mayor, IPC backpressure, spin-lock, etc.
        // 5ms interval = detecta spikes con 5ms de resoluciÃ³n.
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // DEBUG PROBE â€” Reactivar para auditorÃ­a (WAVE 3290 OJO DEL HURACÃN)
        // let _cardiogramaLastTick = performance.now()
        // let _cardiogramaPeak = 0
        // let _cardiogramaCount = 0
        // this.ctx.cardiogramaInterval = setInterval(() => {
        //   const _now = performance.now()
        //   const _delta = _now - _cardiogramaLastTick
        //   _cardiogramaLastTick = _now
        //   if (_delta > _cardiogramaPeak) _cardiogramaPeak = _delta
        //   _cardiogramaCount++
        //   // Solo loguear si supera 40ms (bloqueo GRAVE, no baseline de 15ms)
        //   // o cada 600 ticks (~5s) como heartbeat de diagnÃ³stico
        //   if (_delta > 40) {
        //     const _msg = `ðŸ«€ HARD BLOCK ${_delta.toFixed(1)}ms â€” event loop frozen`
        //     console.warn(`[CARDIOGRAMA MAIN] âš ï¸ ${_msg}`)
        //     this.ctx.log('Error', `[CARDIOGRAMA MAIN] ${_msg}`)
        //   } else if (_cardiogramaCount % 600 === 0) {
        //     const _msg = `ðŸ«€ heartbeat â€” peak:${_cardiogramaPeak.toFixed(1)}ms (last 5s)`
        //     console.warn(`[CARDIOGRAMA MAIN] ${_msg}`)
        //     this.ctx.log('Error', `[CARDIOGRAMA MAIN] ${_msg}`)
        //     _cardiogramaPeak = 0
        //   }
        // }, 5)
        // Relay CARDIOGRAMA del USB Worker â†’ Tactical Log del frontend
        universalDMX.onWarning = (msg) => {
            console.warn(msg);
            this.ctx.log('Error', msg);
        };
        // WAVE 257: Log system start to Tactical Log (delayed to ensure callback is set)
        setTimeout(() => {
            this.ctx.log('System', 'ðŸš€ TITAN 2.0 ONLINE - Main loop started @ 44fps (WAVE 2510 hot-frame)');
            this.ctx.log('Info', `ðŸ“Š Fixtures loaded: ${this.ctx.fixtures.length}`);
        }, 100);
    }
    async stop() {
        // Paso 1: Blackout lÃ³gico en el HAL (si ya fue inicializado)
        if (this.ctx.hal) {
            this.ctx.hal.setBlackout(true);
        }
        // Paso 2: Forzar buffer de ceros directo al driver serial
        universalDMX.blackout();
        await universalDMX.sendAll();
        // Paso 3: Dar tiempo al chip FTDI para drenar los bytes al cable RS-485
        await new Promise(resolve => setTimeout(resolve, 30));
        // Paso 4: Ahora sÃ­ podemos matar el loop sin dejar zombis
        // WAVE 3504.5: scheduler encapsulates the interval and stampede guard
        await this.ctx.scheduler.stop();
        if (this.ctx.cardiogramaInterval) {
            clearInterval(this.ctx.cardiogramaInterval);
            this.ctx.cardiogramaInterval = null;
        }
        universalDMX.onWarning = null;
        this.ctx.isRunning = false;
        // WAVE 3401: Stop OSC Nexus Provider
        if (this.ctx.oscProvider) {
            this.ctx.oscProvider.stop();
            this.ctx.oscProvider = null;
        }
        // WAVE 3402: Stop native audio providers
        if (this.ctx.virtualWireProvider) {
            await this.ctx.virtualWireProvider.stop();
            this.ctx.virtualWireProvider = null;
        }
        if (this.ctx.usbDirectLinkProvider) {
            await this.ctx.usbDirectLinkProvider.stop();
            this.ctx.usbDirectLinkProvider = null;
        }
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // ðŸ§¹ WAVE 2227: REACTOR CLEANUP â€” Purgar estado residual
        // Sin esto, al re-armar el engine retoma desde la fase congelada:
        // VMM con acumuladores viejos, BeatDetector con BPM acumulado.
        // El resultado: saltos de posiciÃ³n al rearmar.
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // Purgar acumuladores de fase del movement engine
        vibeMovementManager.resetTime();
        // WAVE 4703: ArbitrationDirector bypased (WAVE 4592) â€” clearTitanState removed
        // Purgar estado acumulado del beat detector
        if (this.ctx.beatDetector) {
            this.ctx.beatDetector.reset();
        }
    }
}
