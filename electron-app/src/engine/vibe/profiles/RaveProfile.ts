/**
 * 🎆 FASE 4: RAVEX PROFILE (EDM / Dubstep / Neurofunk / Hardstyle)
 *
 * Clonado de la estructura de TechnoClubProfile (blueprint §5.5 paso 4.2).
 * Nombrado "RaveX" en sus metadatos. La constitución cromática real vive
 * en `RAVE_CONSTITUTION` (colorConstitutions.ts) y se referencia por
 * VibeId ('rave') — el VibeProfile NO lleva la constitución inline, sólo
 * los rangos/estrategias que el VibeManager consume.
 *
 * FILOSOFÍA: "El Caos Controlado"
 * - Festival main stage, drops brutales, wobble de sub-bass
 * - Strobes a máxima frecuencia, haces láser, UV saturado
 * - Comprimido (brickwall) — AGC y gates más sensibles
 * - Vocales prominentes (D2: bypassVocalPenalty=false en VIBE_TRAITS)
 *
 * @layer ENGINE/VIBE/PROFILES
 * @version FASE 4 — VIBE CANON
 */

import type { VibeProfile } from '../../../types/VibeProfile'

export const VIBE_RAVE: VibeProfile = {
  id: 'rave',
  name: 'RaveX',
  description: 'EDM / Dubstep / Neurofunk. High-frequency strobe, wobble sub-bass, split-complementary neon.',
  icon: '🎆',

  // ═══════════════════════════════════════════════════════════════
  // MOOD CONSTRAINTS - WAVE 253
  // ═══════════════════════════════════════════════════════════════
  mood: {
    allowed: ['dark', 'dramatic', 'aggressive', 'energetic', 'tense', 'euphoric'],
    fallback: 'energetic',
    audioInfluence: 0.95,  // Máxima influencia del audio — drops lo son todo
  },

  color: {
    // 🏛️ CONSTITUCIÓN: forceStrategy: 'split-complementary' (RAVE_CONSTITUTION)
    strategies: ['split-complementary', 'prism', 'complementary'],

    temperature: {
      min: 7000,
      max: 10000,
    },

    // 🏛️ CONSTITUCIÓN: atmosphericTemp: 9500 (Polo Azul Masivo — heredado techno)
    atmosphericTemp: 9500,

    // 🏛️ CONSTITUCIÓN: saturationRange: [95, 100] (saturación extrema)
    saturation: {
      min: 0.95,
      max: 1.0,
    },

    // WAVE 253: Límite de cambio de hue — rave permite cortes más bruscos
    maxHueShiftPerSecond: 220,  // 220°/s — drops con saltos cromáticos violentos

    // 🏛️ CONSTITUCIÓN: forbiddenHueRanges: [[20, 60]]
    // Prohibir núcleo naranja/amarillo cálido — el rave es frío + magenta + verde láser
    forbiddenHueRanges: [[20, 60]],

    // 🏛️ CONSTITUCIÓN: allowedHueRanges: [[260, 340], [100, 160]]
    // Azul/Magenta frío + Verde Láser/Cyan — split-complementary puro
    allowedHueRanges: [[260, 340], [100, 160]],
  },

  // ═══════════════════════════════════════════════════════════════
  // DROP CONSTRAINTS - WAVE 253
  // ═══════════════════════════════════════════════════════════════
  drop: {
    sensitivity: 0.95,          // Máxima sensibilidad — drops son el corazón del EDM
    energyThreshold: 0.65,      // Umbral alto pero el AGC comprime todo hacia arriba
    curves: {
      attack: 'exponential',    // Ataque explosivo (build-up → drop)
      sustain: 'linear',
      release: 'ease-out',      // Release suave para el aftermath
    },
    timing: {
      minAttack: 4,             // 0.07s @ 60fps — snap instantáneo al drop
      maxSustain: 480,          // 8s máximo — los drops de EDM son largos
      releaseFrames: 90,        // 1.5s release
      cooldownFrames: 60,      // 1s entre drops (EDM encadena drops)
    },
    allowMicroDrops: true,      // Micro-drops en build-ups
  },

  dimmer: {
    // 🏛️ CONSTITUCIÓN: dimmingConfig.floor: 0.05 (casi blackout)
    floor: 0.0,                 // 0.0 para oscuridad total entre drops (heredado techno)
    ceiling: 1.0,
    allowBlackout: true,
    transitionSpeed: 'instant',
    breakdownCurve: 'ease-out',
  },

  movement: {
    // ⚠️ MovementPattern (VibeProfile.ts:56) sólo permite: static | sweep |
    // circle | figure8 | random | mirror | chase | wave. Los GoldenPattern
    // del VMM ('laser_grid', 'darkspin', 'scan_x', etc.) viven en
    // VIBE_CONFIG.patterns (VibeMovementManager.ts) y son los que realmente
    // controlan el movimiento. Aquí declaramos los MovementPattern válidos
    // que el VibeManager consume para validación de constraints.
    allowedPatterns: ['sweep', 'chase', 'static', 'mirror', 'circle', 'figure8'],
    speedRange: {
      min: 0.7,
      max: 1.0,
    },
    allowAggressive: true,
    preferredSync: 'beat',
  },

  effects: {
    // 🏛️ CONSTITUCIÓN: strobeColor heredado techno (Magenta Neón 300° l:85)
    allowed: ['strobe', 'beam', 'laser', 'uv'],
    maxStrobeRate: 18,          // 18 Hz — más agresivo que techno (15 Hz)
    maxIntensity: 1.0,
    autoFog: true,
  },

  meta: {
    baseEnergy: 0.85,           // Más alto que techno (0.7) — EDM es energía constante
    volatility: 0.9,            // Máxima volatilidad — drops cambian todo
    stabilityFirst: false,
    bpmHint: {
      min: 128,                 // EDM 128-150 BPM (techno 120-150)
      max: 150,
    },
  },
}
