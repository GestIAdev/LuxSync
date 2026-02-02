/**
 * 🛡️ AUDIENCE SAFETY CONTEXT
 * "El contexto de seguridad y estado que alimenta las decisiones éticas"
 *
 * WAVE 900.1 - Phase 1: Foundation
 * WAVE 1030 - THE GUARDIAN: Spectral Context Integration
 *
 * @module AudienceSafetyContext
 * @description Estructura de datos completa que describe el estado actual
 *              del sistema, audiencia, hardware y contexto musical para
 *              decisiones éticas de efectos visuales.
 *
 * RESPONSABILIDADES:
 * - Agregar estado de audiencia (tamaño, fatiga visual, epilepsia)
 * - Agregar estado de hardware (GPU load, luminosidad ambiente)
 * - Agregar contexto musical (vibe, energía, timestamp)
 * - Agregar historial de efectos recientes
 * - Agregar cooldowns activos
 * - Agregar insights del DreamEngine (warnings, bias reports)
 * - 🛡️ WAVE 1030: Agregar SpectralContext para decisiones éticas conscientes
 *
 * FILOSOFÍA:
 * "No puedes tomar decisiones éticas sin conocer el contexto completo."
 *
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-20
 */
// ═══════════════════════════════════════════════════════════════
// BUILDER HELPER
// ═══════════════════════════════════════════════════════════════
/**
 * Builder para crear AudienceSafetyContext con defaults sensatos
 */
export class AudienceSafetyContextBuilder {
    constructor() {
        this.context = {};
        // Defaults sensatos
        this.context = {
            crowdSize: 100,
            epilepsyMode: false,
            audienceFatigue: 0.0,
            ambientLuminosity: 0.0,
            gpuLoad: 0.0,
            lastIntenseEffect: 0,
            vibe: 'unknown',
            energy: 0.5,
            timestamp: Date.now(),
            recentEffects: [],
            activeCooldowns: new Map(),
            dreamWarnings: [],
            biasReport: undefined,
            spectral: undefined // 🛡️ WAVE 1030: Optional spectral context
        };
    }
    // ═══════════════════════════════════════════════════════════════
    // AUDIENCE METHODS
    // ═══════════════════════════════════════════════════════════════
    withCrowdSize(size) {
        this.context.crowdSize = Math.max(0, size);
        return this;
    }
    withEpilepsyMode(enabled) {
        this.context.epilepsyMode = enabled;
        return this;
    }
    withAudienceFatigue(fatigue) {
        this.context.audienceFatigue = Math.max(0, Math.min(1, fatigue));
        return this;
    }
    // ═══════════════════════════════════════════════════════════════
    // HARDWARE METHODS
    // ═══════════════════════════════════════════════════════════════
    withAmbientLuminosity(luminosity) {
        this.context.ambientLuminosity = Math.max(0, Math.min(1, luminosity));
        return this;
    }
    withGpuLoad(load) {
        this.context.gpuLoad = Math.max(0, Math.min(1, load));
        return this;
    }
    withLastIntenseEffect(timestamp) {
        this.context.lastIntenseEffect = timestamp;
        return this;
    }
    // ═══════════════════════════════════════════════════════════════
    // CONTEXT METHODS
    // ═══════════════════════════════════════════════════════════════
    withVibe(vibe) {
        this.context.vibe = vibe;
        return this;
    }
    withEnergy(energy) {
        this.context.energy = Math.max(0, Math.min(1, energy));
        return this;
    }
    // 🧠 WAVE 975.5: ZONE UNIFICATION
    withEnergyZone(zone) {
        this.context.energyZone = zone;
        return this;
    }
    withTimestamp(timestamp) {
        this.context.timestamp = timestamp;
        return this;
    }
    // ═══════════════════════════════════════════════════════════════
    // HISTORY METHODS
    // ═══════════════════════════════════════════════════════════════
    withRecentEffects(effects) {
        this.context.recentEffects = effects;
        return this;
    }
    withActiveCooldowns(cooldowns) {
        this.context.activeCooldowns = cooldowns;
        return this;
    }
    // ═══════════════════════════════════════════════════════════════
    // DREAM METHODS
    // ═══════════════════════════════════════════════════════════════
    withDreamWarnings(warnings) {
        this.context.dreamWarnings = warnings;
        return this;
    }
    withBiasReport(report) {
        this.context.biasReport = report;
        return this;
    }
    /**
     * 🛡️ WAVE 1030: THE GUARDIAN - Set spectral context
     *
     * Permite inyectar el contexto espectral del God Ear para
     * decisiones éticas conscientes de textura.
     */
    withSpectral(spectral) {
        this.context.spectral = spectral;
        return this;
    }
    // ═══════════════════════════════════════════════════════════════
    // BUILD
    // ═══════════════════════════════════════════════════════════════
    build() {
        // Validar campos requeridos
        if (!this.context.vibe) {
            throw new Error('AudienceSafetyContext: vibe is required');
        }
        return this.context;
    }
}
// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
/**
 * Calcula fatiga visual basada en historial de efectos
 *
 * Lógica:
 * - Efectos intensos (>0.7) aumentan fatiga rápidamente
 * - Efectos suaves (<0.3) reducen fatiga lentamente
 * - Fatiga decae naturalmente con el tiempo
 */
export function calculateAudienceFatigue(recentEffects, currentFatigue, decayRate = 0.01 // Por minuto
) {
    const now = Date.now();
    const MINUTE_MS = 60000;
    // Decay natural
    const minutesSinceLastEffect = recentEffects.length > 0
        ? (now - recentEffects[recentEffects.length - 1].timestamp) / MINUTE_MS
        : 0;
    let fatigue = currentFatigue - (decayRate * minutesSinceLastEffect);
    // Acumular fatiga de efectos recientes (últimos 5 minutos)
    const recentWindow = recentEffects.filter(e => now - e.timestamp < 5 * MINUTE_MS);
    for (const effect of recentWindow) {
        if (effect.intensity > 0.7) {
            // Efecto intenso aumenta fatiga
            fatigue += 0.02 * effect.intensity;
        }
        else if (effect.intensity < 0.3) {
            // Efecto suave reduce fatiga
            fatigue -= 0.01 * (1 - effect.intensity);
        }
    }
    return Math.max(0, Math.min(1, fatigue));
}
/**
 * Estima GPU load basado en efectos activos
 *
 * Simplificado para Phase 1 (sin integración real con GPU)
 */
export function estimateGpuLoad(recentEffects) {
    if (recentEffects.length === 0)
        return 0.0;
    // Últimos 5 efectos
    const recent = recentEffects.slice(-5);
    // Efectos "pesados" conocidos (WAVE 902.1: TRUTH - strobes + acid)
    const HEAVY_EFFECTS = new Set([
        'industrial_strobe',
        'acid_sweep',
        'cyber_dualism',
        'strobe_storm',
        'strobe_burst'
    ]);
    let load = 0.0;
    for (const effect of recent) {
        if (HEAVY_EFFECTS.has(effect.effect)) {
            load += 0.15 * effect.intensity;
        }
        else {
            load += 0.05 * effect.intensity;
        }
    }
    return Math.min(1.0, load);
}
/**
 * Detecta si último efecto fue "intenso" (>0.7 intensity)
 */
export function getLastIntenseEffectTimestamp(recentEffects) {
    for (let i = recentEffects.length - 1; i >= 0; i--) {
        if (recentEffects[i].intensity > 0.7) {
            return recentEffects[i].timestamp;
        }
    }
    return 0; // Nunca hubo efecto intenso
}
/**
 * Crea un contexto "de emergencia" con defaults seguros
 * Usado cuando no hay datos suficientes
 */
export function createEmergencyContext(vibe = 'unknown') {
    return new AudienceSafetyContextBuilder()
        .withVibe(vibe)
        .withEpilepsyMode(true) // SAFETY FIRST en emergencia
        .withAudienceFatigue(0.5) // Asumir fatiga moderada
        .withGpuLoad(0.3) // Asumir carga moderada
        .withEnergy(0.5)
        .build();
}
/**
 * Log del contexto para debugging
 */
export function logContext(context) {
    console.log('[SAFETY_CONTEXT] 🛡️ Current State:');
    console.log(`  👥 Crowd: ${context.crowdSize} | Fatigue: ${(context.audienceFatigue * 100).toFixed(1)}% | Epilepsy: ${context.epilepsyMode ? 'ON' : 'OFF'}`);
    console.log(`  💡 GPU: ${(context.gpuLoad * 100).toFixed(1)}% | Ambient: ${(context.ambientLuminosity * 100).toFixed(1)}%`);
    console.log(`  🎭 Vibe: ${context.vibe} | Energy: ${(context.energy * 100).toFixed(1)}%`);
    console.log(`  📊 Recent Effects: ${context.recentEffects.length} | Cooldowns: ${context.activeCooldowns.size}`);
    if (context.dreamWarnings && context.dreamWarnings.length > 0) {
        console.log(`  🔮 Dream Warnings: ${context.dreamWarnings.join(', ')}`);
    }
    if (context.biasReport) {
        console.log(`  🔬 Bias: Diversity=${(context.biasReport.diversityScore * 100).toFixed(1)}% | Critical=${context.biasReport.hasCriticalBias ? 'YES' : 'NO'}`);
    }
}
