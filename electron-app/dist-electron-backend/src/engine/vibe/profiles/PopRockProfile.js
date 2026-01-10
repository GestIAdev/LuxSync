/**
 * 🎸 WAVE 222.5: POP ROCK PROFILE
 *
 * Perfil para música Rock/Pop: Estadios, conciertos, shows en vivo.
 *
 * CONSTITUCIÓN (de colorConstitutions.ts - ROCK_CONSTITUTION):
 * - forceStrategy: 'complementary' (máximo drama)
 * - atmosphericTemp: 3200K (Polo Ámbar)
 * - forbiddenHueRanges: [[80, 160], [260, 300]] (No verdes neón ni púrpuras sucios)
 * - allowedHueRanges: [[0, 60], [210, 260], [340, 360]] (Rojos, Azules, Ámbares)
 *
 * FILOSOFÍA: "Leyendas del Estadio"
 * - PAR64 reinan supremos
 * - Rojo sangre + Azul rey + Ámbar tungsteno
 * - Drum-reactive: flash en snare/kick
 *
 * @layer ENGINE/VIBE/PROFILES
 * @version TITAN 2.0
 */
export const VIBE_POP_ROCK = {
    id: 'pop-rock',
    name: 'Pop Rock Stadium',
    description: 'Classic stadium lighting. Red, blue, white. Drum-reactive.',
    icon: '🎸',
    // ═══════════════════════════════════════════════════════════════
    // MOOD CONSTRAINTS - WAVE 253
    // ═══════════════════════════════════════════════════════════════
    mood: {
        allowed: ['energetic', 'dramatic', 'euphoric', 'playful'],
        fallback: 'energetic',
        audioInfluence: 0.75,
    },
    color: {
        // 🏛️ CONSTITUCIÓN: Complementary para máximo drama (split-complementary en perfil)
        strategies: ['split-complementary', 'complementary'],
        temperature: {
            min: 3500,
            max: 5500,
        },
        // 🌡️ CONSTITUCIÓN: atmosphericTemp: 3200 (Polo Ámbar)
        // Gravedad 0.6 hacia 40° (Oro/Ámbar)
        atmosphericTemp: 3200,
        saturation: {
            min: 0.85,
            max: 1.0,
        },
        // WAVE 253: Cambios moderados para rock
        maxHueShiftPerSecond: 90,
        // 🏛️ CONSTITUCIÓN: forbiddenHueRanges: [[80, 160], [260, 300]]
        // Prohibido: verdes neón y púrpuras sucios
        forbiddenHueRanges: [[80, 160], [260, 300]],
        // 🏛️ CONSTITUCIÓN: allowedHueRanges: [[0, 60], [210, 260], [340, 360]]
        // Solo: rojos, azules, ámbares
        allowedHueRanges: [[0, 60], [210, 260], [340, 360]],
    },
    // ═══════════════════════════════════════════════════════════════
    // DROP CONSTRAINTS - WAVE 253
    // ═══════════════════════════════════════════════════════════════
    drop: {
        sensitivity: 0.8,
        energyThreshold: 0.75,
        curves: {
            attack: 'ease-in',
            sustain: 'linear',
            release: 'ease-out',
        },
        timing: {
            minAttack: 18,
            maxSustain: 180,
            releaseFrames: 60,
            cooldownFrames: 120,
        },
        allowMicroDrops: true,
    },
    dimmer: {
        // Floor con espacio para drama
        floor: 0.10,
        ceiling: 1.0,
        allowBlackout: true,
        transitionSpeed: 'fast',
        breakdownCurve: 'ease-in-out',
    },
    movement: {
        // Movimientos clásicos de rock
        allowedPatterns: ['sweep', 'chase', 'static', 'wave'],
        speedRange: {
            min: 0.3,
            max: 0.8,
        },
        allowAggressive: true,
        preferredSync: 'beat',
    },
    effects: {
        // Blinders permitidos, strobe moderado
        allowed: ['strobe', 'beam', 'blinder'],
        maxStrobeRate: 10, // 10 Hz para solos/climax
        maxIntensity: 1.0,
        autoFog: true,
    },
    meta: {
        baseEnergy: 0.7,
        volatility: 0.6, // Menos volátil que techno, más estructurado
        stabilityFirst: false,
        bpmHint: {
            min: 100,
            max: 160,
        },
    },
};
