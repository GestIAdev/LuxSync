/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🤖 CYBER DUALISM - THE PING-PONG TWINS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🤖 WAVE 810: THE TWINS AWAKENING
 * � WAVE 990: RAILWAY SWITCH - VÍA GLOBAL (Dictador)
 *
 * FILOSOFÍA:
 * El primer efecto que explota la dualidad espacial L/R de los movers.
 * Ping-pong visual: LEFT strobe → RIGHT strobe → repeat.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (WAVE 990: DICTADOR - Arregla sangrado de fondo)
 * - Patrón: Alternancia L/R sincronizada con beat
 * - Beat 1: LEFT=STROBE (Blanco) | RIGHT=DARK (NEGRO TOTAL)
 * - Beat 2: LEFT=DARK | RIGHT=STROBE (Blanco)
 * - Variante: LEFT=Cian | RIGHT=Magenta (chromatic mode)
 *
 * COLORES:
 * - Strobe Mode: Blanco puro (h:0, s:0, l:100)
 * - Chromatic Mode: Cian (h:180, s:100, l:70) vs Magenta (h:300, s:100, l:70)
 * - Dark: Negro (dimmer=0) - AHORA CON GLOBAL ES NEGRO REAL
 *
 * TARGETING:
 * - Usa 'movers_left' y 'movers_right' (WAVE 810)
 * - Sin targeting quirúrgico, aplastaría todo el rig
 *
 * @module core/effects/library/techno/CyberDualism
 * @version WAVE 990 - RAILWAY SWITCH GLOBAL
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 3000, // 🔫 WAVE 930.4: 3s total (was 2s) - más presencia
    cycles: 6, // 🔫 WAVE 930.4: 6 alternaciones (was 4) - más impacto L→R→L→R→L→R
    bpmSync: true,
    beatsPerCycle: 0.5, // Media beat por lado (rápido)
    chromaticMode: false, // Default: strobe blanco/negro
    strobeIntensity: 1.0, // 100% brightness
    flashDurationMs: 120, // 🔫 WAVE 930.4: 120ms de flash (was 100ms) - más visible
};
// ═══════════════════════════════════════════════════════════════════════════
// 🤖 CYBER DUALISM CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class CyberDualism extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('cyber_dualism');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'cyber_dualism';
        this.name = 'Cyber Dualism';
        this.category = 'physical';
        this.priority = 85; // Alta (mayor que acid_sweep, menor que industrial_strobe)
        this.mixBus = 'global'; // 🚂 WAVE 990: GLOBAL - Arregla sangrado de fondo
        this.currentCycle = 0; // 0-based cycle counter
        this.cyclePhase = 0; // 0-1 dentro del cycle actual
        this.actualCycleDurationMs = 500;
        this.currentSide = 'left';
        this.flashActive = false;
        // Colors
        this.leftColor = { h: 180, s: 100, l: 70 }; // Cian
        this.rightColor = { h: 300, s: 100, l: 70 }; // Magenta
        this.strobeColor = { h: 0, s: 0, l: 100 }; // Blanco
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // Reset state
        this.currentCycle = 0;
        this.cyclePhase = 0;
        this.currentSide = 'left';
        this.flashActive = true;
        this.triggerIntensity = config.intensity;
        // Calcular duración basada en BPM
        this.calculateCycleDuration();
        console.log(`[CyberDualism 🤖] TRIGGERED! Cycles=${this.config.cycles} Duration=${this.actualCycleDurationMs}ms/cycle ChromaticMode=${this.config.chromaticMode}`);
    }
    calculateCycleDuration() {
        if (this.config.bpmSync && this.musicalContext?.bpm) {
            const msPerBeat = 60000 / this.musicalContext.bpm;
            this.actualCycleDurationMs = msPerBeat * this.config.beatsPerCycle;
        }
        else {
            this.actualCycleDurationMs = this.config.durationMs / this.config.cycles;
        }
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Update cycle phase
        this.cyclePhase += deltaMs / this.actualCycleDurationMs;
        // Check if cycle completed
        if (this.cyclePhase >= 1) {
            this.currentCycle++;
            this.cyclePhase = this.cyclePhase % 1;
            // Alternar lado
            this.currentSide = this.currentSide === 'left' ? 'right' : 'left';
            this.flashActive = true;
            // ¿Terminamos todos los cycles?
            if (this.currentCycle >= this.config.cycles) {
                this.phase = 'finished';
                console.log(`[CyberDualism 🤖] FINISHED (${this.currentCycle} cycles, ${this.elapsedMs}ms)`);
                return;
            }
        }
        // Flash duration check (dentro de cada cycle)
        const cycleElapsed = this.cyclePhase * this.actualCycleDurationMs;
        this.flashActive = cycleElapsed < this.config.flashDurationMs;
    }
    /**
     * 📤 GET OUTPUT - Devuelve el output del frame actual
     * 🤖 WAVE 810: TARGETING L/R - El core del ping-pong
     * 🔦 WAVE 985: DIMMER LOCK - Blackout estricto en fase OFF
     */
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished') {
            return null;
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🔦 WAVE 985: DIMMER LOCK - NO MORE RETURN NULL
        // Incluso en fase DARK, emitimos override para aplastar el layer inferior
        // ═══════════════════════════════════════════════════════════════════════
        const intensity = this.flashActive
            ? this.triggerIntensity * this.config.strobeIntensity
            : 0; // 🔦 EXPLÍCITO: dimmer=0 en fase dark
        // Determinar color según modo
        let color;
        if (this.config.chromaticMode) {
            // Chromatic: cian o magenta según lado
            color = this.currentSide === 'left' ? this.leftColor : this.rightColor;
        }
        else {
            // Strobe: blanco puro
            color = this.strobeColor;
        }
        // 🔥 WAVE 810: TARGETING QUIRÚRGICO
        // Siempre afectamos AMBOS lados: uno ON, otro OFF
        const activeZone = this.currentSide === 'left' ? 'movers-left' : 'movers-right';
        const darkZone = this.currentSide === 'left' ? 'movers-right' : 'movers-left';
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.currentCycle / this.config.cycles,
            zones: ['movers-left', 'movers-right'], // 🔦 AMBOS LADOS SIEMPRE
            intensity,
            // 🤖 Zone overrides con Dimmer Lock
            zoneOverrides: {
                // LADO ACTIVO: Strobe ON con COLOR BLANCO
                [activeZone]: {
                    color, // � WAVE 985: Forzar blanco (CyberDualism <1s = SAFE para ruedas)
                    dimmer: intensity,
                    blendMode: 'replace', // 🔦 WAVE 985: LTP = Override estricto
                },
                // LADO DARK: Blackout forzado
                [darkZone]: {
                    dimmer: 0, // 🔦 EXPLÍCITO: Negro absoluto
                    blendMode: 'replace', // 🔦 APLASTA el layer inferior
                },
            },
        };
        return output;
    }
    isFinished() {
        return this.phase === 'finished';
    }
    abort() {
        this.phase = 'finished';
        this.triggerIntensity = 0;
        console.log(`[CyberDualism 🤖] Aborted`);
    }
    getPhase() {
        return this.phase;
    }
}
