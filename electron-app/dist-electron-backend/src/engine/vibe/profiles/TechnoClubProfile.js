/**
 * 🎛️ WAVE 222.5: TECHNO CLUB PROFILE (Deep Techno)
 *
 * Perfil para música electrónica: Techno, House, Trance.
 *
 * CONSTITUCIÓN (de colorConstitutions.ts - TECHNO_CONSTITUTION):
 * - forceStrategy: 'prism' (tetraédrica)
 * - atmosphericTemp: 9500K (Polo Azul Masivo - Thermal Gravity)
 * - forbiddenHueRanges: [[25, 80]] (Solo prohibir núcleo mostaza/naranja)
 * - allowedHueRanges: [[0, 24], [81, 360]] (Todo excepto naranja/amarillo)
 *
 * FILOSOFÍA: "Los Demonios de Neón"
 * - Bunker en Noruega viendo auroras boreales 🌌
 * - La calidez es herejía, solo el frío sobrevive
 * - Los rojos se enfrían a Magenta, los verdes a Cyan
 *
 * @layer ENGINE/VIBE/PROFILES
 * @version TITAN 2.0
 */
export const VIBE_TECHNO_CLUB = {
    id: 'techno-club',
    name: 'Techno Deep Club',
    description: 'Deep cold tones. UV/Cyan/Magenta. Strobe-ready.',
    icon: '🎛️',
    // ═══════════════════════════════════════════════════════════════
    // MOOD CONSTRAINTS - WAVE 253
    // ═══════════════════════════════════════════════════════════════
    mood: {
        allowed: ['dark', 'dramatic', 'aggressive', 'energetic', 'tense'],
        fallback: 'energetic',
        audioInfluence: 0.9, // Alta influencia del audio
    },
    color: {
        // 🏛️ CONSTITUCIÓN: forceStrategy: 'prism' (tetraédrica)
        strategies: ['prism', 'complementary', 'split-complementary'],
        temperature: {
            min: 7000,
            max: 10000,
        },
        // 🏛️ CONSTITUCIÓN: atmosphericTemp: 9500 (Polo Azul Masivo)
        // Fuerza ~29% hacia 240° (Azul Rey)
        // Los rojos (0-20°) → Magenta, Los verdes (85-110°) → Cyan
        atmosphericTemp: 9500,
        // 🏛️ CONSTITUCIÓN: saturationRange: [90, 100] (Neón obligatorio)
        saturation: {
            min: 0.90,
            max: 1.0,
        },
        // WAVE 253: Límite de cambio de hue para evitar epilepsia
        maxHueShiftPerSecond: 180, // 180°/s = máximo agresivo para techno
        // 🏛️ CONSTITUCIÓN: forbiddenHueRanges: [[25, 80]]
        // Solo prohibir el núcleo mostaza/naranja feo
        forbiddenHueRanges: [[25, 80]],
        // 🏛️ CONSTITUCIÓN: allowedHueRanges: [[0, 24], [81, 360]]
        // Open Borders - confiar en Thermal Gravity para enfriar
        allowedHueRanges: [[0, 24], [81, 360]],
    },
    // ═══════════════════════════════════════════════════════════════
    // DROP CONSTRAINTS - WAVE 253
    // ═══════════════════════════════════════════════════════════════
    drop: {
        sensitivity: 0.9, // Muy sensible a drops
        energyThreshold: 0.7, // Umbral moderado-alto
        curves: {
            attack: 'exponential', // Ataque explosivo
            sustain: 'linear',
            release: 'ease-out', // Release suave
        },
        timing: {
            minAttack: 6, // 0.1s @ 60fps
            maxSustain: 240, // 4s máximo de sustain
            releaseFrames: 60, // 1s release
            cooldownFrames: 120, // 2s entre drops
        },
        allowMicroDrops: true, // Permite micro-drops techno
    },
    dimmer: {
        // 🏛️ CONSTITUCIÓN: dimmingConfig.floor: 0.05 (casi blackout)
        // WAVE 222.5: 0.0 para oscuridad total entre golpes
        floor: 0.0,
        ceiling: 1.0,
        allowBlackout: true,
        transitionSpeed: 'instant',
        breakdownCurve: 'ease-out',
    },
    movement: {
        allowedPatterns: ['sweep', 'chase', 'static', 'mirror'],
        speedRange: {
            min: 0.6,
            max: 1.0,
        },
        allowAggressive: true,
        preferredSync: 'beat',
    },
    effects: {
        // 🏛️ CONSTITUCIÓN: strobeColor: Magenta Neón (300° l:85)
        allowed: ['strobe', 'beam', 'laser', 'uv'],
        maxStrobeRate: 15, // 15 Hz máximo
        maxIntensity: 1.0,
        autoFog: true,
    },
    meta: {
        baseEnergy: 0.7,
        volatility: 0.8, // Alta volatilidad para cambios dramáticos
        stabilityFirst: false,
        bpmHint: {
            min: 120,
            max: 150,
        },
    },
};
