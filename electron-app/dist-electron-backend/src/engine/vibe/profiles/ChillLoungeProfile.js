/**
 * 🍸 WAVE 7129: CHILL LOUNGE PROFILE — BOREAL OCEAN
 *
 * Perfil para música relajada: Lounge, Ambient, Jazz.
 *
 * FILOSOFÍA:
 * - Colores fríos oceánicos (Boreal Ocean)
 * - Transiciones lentas y orgánicas
 * - Sin efectos agresivos
 *
 * WAVE 7129.2: Bipolaridad cromática resuelta.
 * Profile alineado con CHILL_CONSTITUTION (8500K, cyan/blue/magenta).
 *
 * @layer ENGINE/VIBE/PROFILES
 * @version WAVE 7129
 */
export const VIBE_CHILL_LOUNGE = {
    id: 'chill-lounge',
    name: 'Chill Lounge',
    description: 'Boreal Ocean. Deep blues, cyan, violet. Slow transitions.',
    icon: '🍸',
    // ═══════════════════════════════════════════════════════════════
    // MOOD CONSTRAINTS - WAVE 253
    // ═══════════════════════════════════════════════════════════════
    mood: {
        allowed: ['peaceful', 'calm', 'dreamy'],
        fallback: 'calm',
        audioInfluence: 0.4, // Bajo - más estabilidad
    },
    color: {
        strategies: ['analogous', 'monochromatic'],
        temperature: {
            min: 7000,
            max: 10000,
        },
        // WAVE 7129.2: Boreal Ocean — alineado con CHILL_CONSTITUTION (8500K)
        atmosphericTemp: 8500,
        saturation: {
            min: 0.5,
            max: 0.85,
        },
        // WAVE 253: Cambios muy lentos para chill
        maxHueShiftPerSecond: 30,
        // WAVE 7129.2: Espectro abisal — alineado con CHILL_CONSTITUTION
        // Forbidden: rojos, naranjas, amarillos, verdes cálidos
        forbiddenHueRanges: [[340, 360], [0, 150]],
        // Allowed: Deep Blue, Boreal Green, Dark Magenta, Violet, Cyan
        allowedHueRanges: [[160, 260], [290, 330]],
    },
    // ═══════════════════════════════════════════════════════════════
    // DROP CONSTRAINTS - WAVE 253
    // ═══════════════════════════════════════════════════════════════
    drop: {
        sensitivity: 0.2, // Muy baja sensibilidad
        energyThreshold: 0.9, // Casi imposible de activar
        curves: {
            attack: 'ease-in',
            sustain: 'linear',
            release: 'ease-out',
        },
        timing: {
            minAttack: 120, // 2s mínimo
            maxSustain: 300, // 5s máximo
            releaseFrames: 180, // 3s release suave
            cooldownFrames: 600, // 10s entre drops
        },
        allowMicroDrops: false,
    },
    dimmer: {
        floor: 0.2,
        ceiling: 0.7,
        allowBlackout: false,
        transitionSpeed: 'glacial',
        breakdownCurve: 'linear',
    },
    movement: {
        // 🌊 WAVE 2471: MODO DERIVA — velocidades de anémona, no de turbina
        // Con el normalizador vibe-aware, este rango GOBIERNA el slider de la UI.
        // min=0.025 Hz → ciclo de 40s (meditación profunda)
        // max=0.08 Hz  → ciclo de 12.5s (respiración tranquila)
        // slider al 50% → 0.052 Hz → ciclo de ~19s
        allowedPatterns: ['circle', 'wave', 'static'],
        speedRange: {
            min: 0.025, // was 0.12 — 40s/ciclo, deriva de medusa
            max: 0.08, // was 0.30 — 12.5s/ciclo, respiración costera
        },
        allowAggressive: false,
        preferredSync: 'free',
    },
    effects: {
        allowed: [],
        maxStrobeRate: 0,
        maxIntensity: 0.5,
        autoFog: false,
    },
    meta: {
        baseEnergy: 0.3,
        volatility: 0.2,
        stabilityFirst: true,
        bpmHint: {
            min: 60,
            max: 110,
        },
    },
};
