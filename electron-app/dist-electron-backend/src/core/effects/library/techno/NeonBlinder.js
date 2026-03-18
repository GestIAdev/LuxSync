/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💥 NEON BLINDER - THE FLASH WALL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
 * 🔥 WAVE 2183: APEX STEROIDS — Strobe pre-flash + color melt
 *
 * FILOSOFÍA:
 * Flash masivo que ciega la pista. Pero primero: UN LATIGAZO DE ESTROBO
 * blanco o de color a 20-25Hz que dura 150-200ms. Solo después de ese
 * ataque cegador, la sala "funde" al color elegido en decay lento.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR — necesita el negro previo para el impacto)
 * - Duración: ~1000ms total
 *   - Fase STROBE: 0-175ms — estrobo blanco/color a 22Hz (latigazo)
 *   - Fase MELT:   175-1000ms — decay exponencial al color elegido
 * - Pars: Strobe brutal → funde a color
 * - Movers: Color latched desde el inicio, dimmer sync con ADSR
 * - oneShot: true — un solo golpe, sin re-trigger
 *
 * COLORES (según Vibe/Intensity):
 * - Alta intensidad: Rojo Sangre (h:0, s:100, l:50) + strobe blanco
 * - Media intensidad: Magenta Eléctrico (h:300, s:100, l:55) + strobe magenta
 * - Default: Cian Eléctrico (h:185, s:100, l:55) + strobe cian
 *
 * @module core/effects/library/techno/NeonBlinder
 * @version WAVE 2183 — APEX STEROIDS
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 1000,
    attackMs: 50,
    strobePhaseMs: 175, // Latigazo de 175ms
    strobeHz: 22, // 22Hz — hipnótico y agresivo
};
// ═══════════════════════════════════════════════════════════════════════════
// NEON BLINDER EFFECT
// ═══════════════════════════════════════════════════════════════════════════
export class NeonBlinder extends BaseEffect {
    constructor(config) {
        super('neon_blinder');
        this.effectType = 'neon_blinder';
        this.name = 'Neon Blinder';
        this.category = 'physical';
        this.priority = 93; // Justo debajo de core_meltdown
        this.mixBus = 'global';
        this.isOneShot = true; // Un solo impacto, sin re-trigger
        this.flashColor = { h: 185, s: 100, l: 55 };
        /** Color del strobe inicial — igual al flash pero puede ser blanco puro */
        this.strobeColor = { h: 185, s: 100, l: 90 };
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        this.setDuration(this.config.durationMs);
        // Color según intensidad del trigger
        if (triggerConfig.intensity > 0.85) {
            this.flashColor = { h: 0, s: 100, l: 50 }; // Rojo Sangre
            this.strobeColor = { h: 0, s: 0, l: 100 }; // Blanco puro — máximo impacto
        }
        else if (triggerConfig.intensity > 0.6) {
            this.flashColor = { h: 300, s: 100, l: 55 }; // Magenta Eléctrico
            this.strobeColor = { h: 300, s: 100, l: 85 }; // Magenta muy saturado y brillante
        }
        else {
            this.flashColor = { h: 185, s: 100, l: 55 }; // Cian Eléctrico
            this.strobeColor = { h: 185, s: 100, l: 85 }; // Cian muy brillante
        }
        console.log(`[NeonBlinder 💥] TRIGGERED: color=h${this.flashColor.h} strobeHz=${this.config.strobeHz} ` +
            `strobePhase=${this.config.strobePhaseMs}ms intensity=${triggerConfig.intensity.toFixed(2)}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs < this.config.strobePhaseMs) {
            this.phase = 'attack'; // Fase strobe (latigazo)
        }
        else if (this.elapsedMs < this.config.durationMs) {
            this.phase = 'decay'; // Fase melt (color fund)
        }
        else {
            this.phase = 'finished';
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.getProgress();
        // ═════════════════════════════════════════════════════════════════════
        // FASE 1: STROBE LATIGAZO (0 - strobePhaseMs)
        // Estrobo a 22Hz. Color brillante. La sala parpadea como un rayo.
        // ═════════════════════════════════════════════════════════════════════
        let dimmer;
        let activeColor;
        if (this.elapsedMs < this.config.strobePhaseMs) {
            // Toggle determinístico — sin Math.random(), ciclo puro por tiempo
            const cycleMs = 1000 / this.config.strobeHz;
            const positionInCycle = this.elapsedMs % cycleMs;
            const isOn = positionInCycle < (cycleMs * 0.45); // 45% duty cycle
            dimmer = isOn ? this.triggerIntensity : 0;
            activeColor = this.strobeColor;
        }
        else {
            // ═══════════════════════════════════════════════════════════════════
            // FASE 2: COLOR MELT (strobePhaseMs - durationMs)
            // Decay exponencial al color elegido. La sala "funde".
            // ═══════════════════════════════════════════════════════════════════
            const meltProgress = (this.elapsedMs - this.config.strobePhaseMs)
                / (this.config.durationMs - this.config.strobePhaseMs);
            dimmer = Math.exp(-3 * meltProgress) * this.triggerIntensity;
            activeColor = this.flashColor;
        }
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            dimmerOverride: dimmer,
            colorOverride: activeColor,
            intensity: dimmer,
            zones: ['front', 'all-pars', 'back', 'all-movers'],
            globalComposition: 1.0,
            zoneOverrides: {},
        };
        // ═════════════════════════════════════════════════════════════════════
        // PARS: Strobe → Melt según fase
        // ═════════════════════════════════════════════════════════════════════
        const parZones = ['front', 'all-pars', 'back'];
        for (const zone of parZones) {
            output.zoneOverrides[zone] = {
                color: activeColor,
                dimmer,
                blendMode: 'max',
            };
        }
        // ═════════════════════════════════════════════════════════════════════
        // MOVERS: Color LATCHED desde el inicio (flashColor, no strobeColor)
        // "Pars strobe first, Movers melt the sky"
        // ═════════════════════════════════════════════════════════════════════
        output.zoneOverrides['all-movers'] = this.getMoverColorOverride(this.flashColor, dimmer, {
            pan: 0, // Frontal (hacia público)
            tilt: 0, // Horizontal
            isAbsolute: true,
            speed: 1.0, // Instantáneo
        });
        return output;
    }
}
