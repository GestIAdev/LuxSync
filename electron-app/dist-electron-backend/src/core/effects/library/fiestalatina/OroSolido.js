/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥇 ORO SÓLIDO - EL TROMPETAZO LATINO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🌊 WAVE 2189: EL TROMPETAZO
 *
 * El drop latino no es ruido — es PESO y BRILLO.
 * Este efecto simula el golpe simultáneo de toda una sección de vientos
 * (trompetas/trombones) combinada con un bombo masivo.
 *
 * En lugar del parpadeo epiléptico del strobe_storm, oro_solido entrega un
 * impacto seco, majestuoso y simétrico. Perfecto para rBPM ~95 y Z-Score > 4.0.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MECÁNICA VISUAL (EL TROMPETAZO):
 *
 * FASE 1 — LATCH TOTAL (0ms → 250ms)
 *   · Todos los Pars (front + back) y todos los Movers: 100% instantáneo
 *   · Sin parpadeo. Muro de luz dorada sólida que ciega por 250ms.
 *   · Movers: Tilt 45° hacia el público, Pan centrado (simétrico)
 *
 * FASE 2 — EL BARRIDO (250ms → 1200ms)
 *   · Pars: decay exponencial lento (resonancia del bombo latino)
 *   · Movers izquierda: barren hacia la izquierda ↖
 *   · Movers derecha: barren hacia la derecha ↗
 *   · Movimiento de apertura/cadera, bajando intensidad suavemente
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PALETA: Oro Puro / Ámbar Saturado
 *   R:255  G:200  B:40  W:255  A:255  (peak — quema dorado)
 *   R:255  G:120  B:0   W:80   A:200  (decay — ámbar cálido)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DNA:
 *   aggression: 0.90  — Golpe brutal, sin reservas
 *   chaos:      0.15  — Coreografiado y simétrico, cero caos
 *   organicity: 0.40  — Cuerpo físico (vientos + bombo), no máquina pura
 *
 * mixBus: 'global' — Dictador absoluto. Apaga todo lo demás.
 * duration: 1200ms  — SHORT effect (puede usar color en movers)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * @module core/effects/library/fiestalatina/OroSolido
 * @version WAVE 2189
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    latchMs: 250, // 250ms de muro sólido
    totalMs: 1200, // 1200ms total (SHORT — puede usar color en movers)
    decayCurve: 2.5, // Decay exponencial moderado-rápido (resonancia bombo)
    decayFloor: 0.0, // Apagado completo
    // Movers DMX — valores en rango 0-255
    panLeft: 60, // Pan izquierda ~45° respecto al centro
    panRight: 195, // Pan derecha simétrico
    tiltFront: 80, // Tilt frontal ~45° hacia el público
    tiltSweep: 55, // Tilt barrido — sube ligeramente durante la apertura
    // 🥇 ORO PURO — quema dorado, no blanco frío
    colorPeak: {
        r: 255,
        g: 200,
        b: 40,
        w: 255,
        a: 255,
    },
    // 🟤 ÁMBAR CÁLIDO — resonancia del bombo, fade hacia naranja profundo
    colorDecay: {
        r: 255,
        g: 120,
        b: 0,
        w: 80,
        a: 200,
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// ORO SÓLIDO CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class OroSolido extends BaseEffect {
    constructor(config) {
        super('oro_solido');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'oro_solido';
        this.name = 'Oro Sólido';
        this.category = 'physical';
        this.priority = 98; // Entre latina_meltdown (95) y solar_flare (100)
        this.mixBus = 'global'; // 🥇 DICTADOR — silencia todo
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        this.zones = ['front', 'back', 'all-movers'];
        console.log(`[OroSolido 🥇] TROMPETAZO! Intensity=${this.triggerIntensity.toFixed(2)} Source=${this.source}`);
        console.log(`[OroSolido 🥇] DNA: A=0.90 C=0.15 O=0.40 | LATCH=${this.config.latchMs}ms TOTAL=${this.config.totalMs}ms`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.totalMs) {
            this.phase = 'finished';
            console.log(`[OroSolido 🥇] TROMPETAZO COMPLETE — ${this.elapsedMs}ms`);
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const { latchMs, totalMs, decayCurve, decayFloor, colorPeak, colorDecay } = this.config;
        const elapsed = this.elapsedMs;
        const inLatch = elapsed < latchMs;
        // ─── INTENSIDAD ───────────────────────────────────────────────────────
        // Fase 1: 100% plano (LATCH TOTAL)
        // Fase 2: decay exponencial desde 100% hasta decayFloor
        let intensity;
        if (inLatch) {
            intensity = 1.0;
        }
        else {
            const sweepProgress = (elapsed - latchMs) / (totalMs - latchMs); // 0→1
            const clampedProgress = Math.min(1, sweepProgress);
            intensity = decayFloor + Math.pow(1 - clampedProgress, decayCurve) * (1 - decayFloor);
        }
        const scaledIntensity = intensity * this.triggerIntensity;
        // ─── COLOR — interpolación peak→decay en Fase 2 ──────────────────────
        let color;
        if (inLatch) {
            color = colorPeak;
        }
        else {
            const t = intensity; // 1.0 = peak, 0.0 = decay
            color = {
                r: Math.round(colorPeak.r * t + colorDecay.r * (1 - t)),
                g: Math.round(colorPeak.g * t + colorDecay.g * (1 - t)),
                b: Math.round(colorPeak.b * t + colorDecay.b * (1 - t)),
                w: Math.round(colorPeak.w * t + colorDecay.w * (1 - t)),
                a: Math.round(colorPeak.a * t + colorDecay.a * (1 - t)),
            };
        }
        // ─── RGB → HSL (para colorOverride) ──────────────────────────────────
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0;
        let s = 0;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r)
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g)
                h = ((b - r) / d + 2) / 6;
            else
                h = ((r - g) / d + 4) / 6;
        }
        const hsl = { h: h * 360, s: s * 100, l: l * 100 };
        // ─── MOVIMIENTO DE MOVERS ─────────────────────────────────────────────
        // Fase 1 LATCH: Tilt frontal (45° al público), Pan centrado
        // Fase 2 BARRIDO: Movers izquierda abren a la izquierda, derecha a la derecha
        // Usamos zoneOverrides para dividir izquierda/derecha
        const sweepProgress = inLatch
            ? 0
            : Math.min(1, (elapsed - latchMs) / (totalMs - latchMs));
        // Interpolación de tilt: tiltFront → tiltSweep durante el barrido
        const tiltNow = Math.round(this.config.tiltFront + (this.config.tiltSweep - this.config.tiltFront) * sweepProgress);
        // Pan: en latch todo centrado (127), en barrido se separan
        const panLeftNow = Math.round(127 + (this.config.panLeft - 127) * sweepProgress);
        const panRightNow = Math.round(127 + (this.config.panRight - 127) * sweepProgress);
        // ─── OUTPUT ───────────────────────────────────────────────────────────
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: Math.min(1, elapsed / totalMs),
            zones: this.zones,
            intensity: scaledIntensity,
            // Dominio total — dictador
            dimmerOverride: scaledIntensity,
            whiteOverride: (color.w / 255) * scaledIntensity,
            amberOverride: (color.a / 255) * scaledIntensity,
            colorOverride: hsl,
            // Zone overrides: Pars global + Movers con apertura simétrica
            zoneOverrides: {
                // PARs front + back: muro de oro, decay uniforme
                front: {
                    color: hsl,
                    dimmer: scaledIntensity,
                    white: (color.w / 255) * scaledIntensity,
                    amber: (color.a / 255) * scaledIntensity,
                    blendMode: 'replace',
                },
                back: {
                    color: hsl,
                    dimmer: scaledIntensity,
                    white: (color.w / 255) * scaledIntensity,
                    amber: (color.a / 255) * scaledIntensity,
                    blendMode: 'replace',
                },
                // Movers izquierda: solo color/dimmer (WAVE 2690: movement PURGED)
                'movers-left': {
                    color: hsl,
                    dimmer: scaledIntensity,
                    // 🚨 WAVE 2690: movement PURGED — Selene no conduce posiciones
                    blendMode: 'replace',
                },
                // Movers derecha: solo color/dimmer (WAVE 2690: movement PURGED)
                'movers-right': {
                    color: hsl,
                    dimmer: scaledIntensity,
                    // 🚨 WAVE 2690: movement PURGED
                    blendMode: 'replace',
                },
            },
        };
    }
    isFinished() {
        return this.phase === 'finished';
    }
    abort() {
        this.phase = 'finished';
        console.log(`[OroSolido 🥇] Aborted`);
    }
    getDurationMs() {
        return this.config.totalMs;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createOroSolido(config) {
    return new OroSolido(config);
}
export const ORO_SOLIDO_DEFAULT_CONFIG = DEFAULT_CONFIG;
