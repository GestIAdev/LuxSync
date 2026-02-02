/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💥 STROBE BURST - AMBIENT FLASH PULSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🌊 WAVE 691: DESATASCAR A LA DIOSA
 * 🎨 WAVE 962: CONTEXTUAL COLOR - UV techno, dorado latina
 * 🪜 WAVE 1004.4: THE LATINO LADDER - Recalibrado a AMBIENT ZONE (A=0.40)
 *
 * Efecto de flashes SUAVES para zona media-baja del espectro energético.
 * Recalibrado para THE LATINO LADDER - ya no es agresivo como StrobeStorm.
 *
 * FILOSOFÍA AMBIENT ZONE:
 * - Flashes más largos y espaciados (80ms flash, 200ms gap)
 * - Solo 2 flashes por ráfaga (no bombardeo)
 * - Transición suave fade-out entre flashes
 * - Intensidad contenida (~70%)
 *
 * 🎨 Color contextual según vibe:
 *   * TECHNO: UV (H=270°) - Ultravioleta industrial
 *   * LATINA: Dorado cálido - tonos amigables
 *
 * DNA PROFILE (THE LATINO LADDER):
 * ┌─────────────────────────────────────────────────┐
 * │ Aggression:  0.40 → AMBIENT ZONE (30-45%)      │
 * │ Complexity:  0.35 → Patrón simple y predecible │
 * │ Organicity:  0.50 → Balance mecánico/orgánico  │
 * │ Duration:    SHORT → COLOR PERMITIDO en movers │
 * └─────────────────────────────────────────────────┘
 *
 * PERFECT FOR:
 * - Acentos suaves en cumbia/bachata
 * - Momentos de énfasis sin romper el flow
 * - Transiciones calmadas con un toque de luz
 *
 * @module core/effects/library/StrobeBurst
 * @version WAVE 691, 962, 1004.4
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    flashCount: 2, // 🪜 LADDER: Solo 2 flashes (antes 4)
    flashDurationMs: 80, // 🪜 LADDER: 80ms por flash (antes 50ms) - más suave
    gapDurationMs: 200, // 🪜 LADDER: 200ms entre flashes (antes 100ms) - más espacio
    bpmSync: true, // Sincronizar con beat
    maxFrequencyHz: 6, // 🪜 LADDER: Máximo 6 Hz (antes 10 Hz) - más calmado
    flashColor: null, // Usar paleta del vibe
    colorIntensity: 0.7, // 🪜 LADDER: 70% saturación (antes 80%) - menos intenso
};
// ═══════════════════════════════════════════════════════════════════════════
// STROBE BURST CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class StrobeBurst extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('strobe_burst');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'strobe_burst';
        this.name = 'Strobe Burst';
        this.category = 'physical';
        this.priority = 85; // Alta pero menor que SolarFlare y StrobeStorm
        this.mixBus = 'global'; // 🚂 WAVE 800: Dictador - strobo manda
        this.currentFlash = 0;
        this.isFlashOn = false;
        this.flashTimer = 0;
        this.totalDurationMs = 0;
        this.calculatedColor = { h: 0, s: 0, l: 100 };
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.calculateTotalDuration();
    }
    calculateTotalDuration() {
        // Cada flash = flashDuration + gap (excepto el último que no tiene gap)
        this.totalDurationMs = this.config.flashCount * this.config.flashDurationMs +
            (this.config.flashCount - 1) * this.config.gapDurationMs;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // StrobeBurst es GLOBAL - afecta todo el escenario
        this.zones = ['front', 'back', 'movers'];
        this.currentFlash = 0;
        this.isFlashOn = true;
        this.flashTimer = 0;
        // Calcular color
        this.calculateFlashColor();
        // Ajustar timing si hay BPM
        this.adjustTimingToBPM();
        // 🎨 WAVE 962: Log con color contextual
        const vibeId = this.musicalContext?.vibeId || 'unknown';
        const colorName = vibeId === 'techno-club' ? '🟣 UV' : '🌟 Dorado/Vibrante';
        console.log(`[StrobeBurst 💥] TRIGGERED! Flashes=${this.config.flashCount} Duration=${this.totalDurationMs}ms Color=${colorName}`);
    }
    calculateFlashColor() {
        if (this.config.flashColor) {
            this.calculatedColor = this.config.flashColor;
        }
        else {
            // 🎨 WAVE 962: CONTEXTUAL COLOR - UV para techno, dorado para latina
            const vibeId = this.musicalContext?.vibeId;
            if (vibeId === 'techno-club') {
                // TECHNO: UV industrial (ultravioleta puro)
                this.calculatedColor = { h: 270, s: 100, l: 50 }; // 🟣 UV strobe
            }
            else {
                // FIESTA LATINA: usar colores vibrantes (magenta/cyan/amarillo dorado)
                const latinaColors = [
                    { h: 330, s: 100, l: 60 }, // Magenta vibrante
                    { h: 180, s: 100, l: 50 }, // Cyan
                    { h: 45, s: 90, l: 60 }, // 🌊 WAVE 805.6: SUPER DORADO unificado
                    { h: 0, s: 0, l: 100 }, // Blanco puro
                ];
                // Elegir según intensidad del trigger
                const colorIndex = Math.floor(this.triggerIntensity * (latinaColors.length - 1));
                this.calculatedColor = latinaColors[colorIndex];
            }
        }
    }
    adjustTimingToBPM() {
        if (!this.config.bpmSync || !this.musicalContext?.bpm)
            return;
        const msPerBeat = 60000 / this.musicalContext.bpm;
        // Ajustar gap para que los flashes caigan en subdivisiones del beat
        // Para reggaetón/cumbia: 16th notes feeling
        const sixteenthNote = msPerBeat / 4;
        // El gap debe ser múltiplo de 16th note
        this.config.gapDurationMs = Math.round(sixteenthNote);
        // Recalcular duración total
        this.calculateTotalDuration();
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.flashTimer += deltaMs;
        // Lógica de flash
        if (this.isFlashOn) {
            // Estamos en un flash
            if (this.flashTimer >= this.config.flashDurationMs) {
                // Flash terminado, ir a gap
                this.isFlashOn = false;
                this.flashTimer = 0;
                this.currentFlash++;
                // ¿Terminamos todos los flashes?
                if (this.currentFlash >= this.config.flashCount) {
                    this.phase = 'finished';
                    console.log(`[StrobeBurst 💥] Completed (${this.elapsedMs}ms)`);
                    return;
                }
            }
        }
        else {
            // Estamos en un gap
            if (this.flashTimer >= this.config.gapDurationMs) {
                // Gap terminado, siguiente flash
                this.isFlashOn = true;
                this.flashTimer = 0;
            }
        }
        // Safety timeout
        if (this.elapsedMs > this.totalDurationMs * 1.5) {
            this.phase = 'finished';
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // Si estamos en gap, output mínimo
        if (!this.isFlashOn) {
            return {
                effectId: this.id,
                category: this.category,
                phase: this.phase,
                progress: this.elapsedMs / this.totalDurationMs,
                zones: this.zones,
                intensity: 0.05, // Mínimo durante gap
                dimmerOverride: 0.05,
                // 🌊 WAVE 1080: globalComposition omitido = 0 (física manda)
            };
        }
        // FLASH ON - Intensidad máxima
        const flashIntensity = this.getIntensityFromZScore(this.triggerIntensity, 0.3);
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.totalDurationMs,
            zones: this.zones,
            intensity: flashIntensity,
            dimmerOverride: flashIntensity,
            colorOverride: this.calculatedColor,
            // White boost durante flash para punch extra
            whiteOverride: flashIntensity > 0.8 ? 0.5 : undefined,
            // NO strobe rate - nosotros manejamos el timing manualmente
            strobeRate: undefined,
            globalComposition: 1.0, // 🌊 WAVE 1080: Override global durante el burst
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createStrobeBurst(config) {
    return new StrobeBurst(config);
}
