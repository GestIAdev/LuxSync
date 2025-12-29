/**
 * FIESTA LATINA VIBE PROFILE
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * �️ WAVE 163.5: HONEY DROP (Disciplina Dorada)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CAMBIOS WAVE 163:
 * 1. drop.timing.cooldownFrames = 90 (1.5s de calma post-drop)
 * 2. drop.timing.maxSustain = 180 (drops más largos permitidos)
 * 
 * CAMBIOS WAVE 161-162 (histórico):
 * 1. ELIMINADO 'analogous' de strategies - El Arbiter ya no puede forzar monotonía
 * 2. atmosphericTemp 4200K (Atardecer) - "Ricitos de Oro" ni muy caliente ni muy frío
 * 3. melodyThreshold 0.35 - Ignora ruido de fondo, solo melodía real
 * 4. dimmer.floor 0.0 - SIN FLOOR, DELTA máximo para 3D real
 * 5. volatility 0.9 - Máxima volatilidad para cambios rápidos
 * 
 * FILOSOFÍA:
 * Solar Flare es CARO. Solo golpes maestros (bass > 0.75 + delta > 0.10)
 * disparan oro. El resto del tiempo = colores puros, no blanco.
 */

import type { VibeProfile } from '../../../types/VibeProfile';

export const VIBE_FIESTA_LATINA: VibeProfile = {
  id: 'fiesta-latina',
  name: 'Fiesta Latina 3D',
  description: 'High contrast. Neon colors. Dynamic movement.',
  icon: '🎉',

  mood: {
    allowed: ['festive', 'playful', 'euphoric', 'energetic'],
    fallback: 'festive',
    audioInfluence: 0.8,
  },

  color: {
    // ⚔️ WAVE 161: ATAQUE A LA ESTRATEGIA
    // Eliminamos 'analogous'. Si el StrategyArbiter quiere relajar,
    // tendrá que usar 'complementary', que al menos tiene dos colores opuestos.
    strategies: ['triadic', 'split-complementary', 'complementary'],
    
    temperature: {
      min: 2000,
      max: 7500,
    },
    
    // 🌡️ WAVE 161: Temperatura "Ricitos de Oro"
    // 4800K = Ni muy caliente (naranja), ni muy fría (azul)
    // Gravedad casi neutra con ligero tinte cálido
    atmosphericTemp: 3200,  // ðŸ¯ WAVE 163.5: Atardecer (antes 4800K)
    
    // Bloqueamos solo el azul triste corporativo
    forbiddenHueRanges: [[60, 130], [210, 250]],
    
    // Abrimos el espectro: fuego, turquesas, magentas
    allowedHueRanges: [[0, 60], [140, 190], [270, 360]],
    
    saturation: {
      min: 0.85,
      max: 1.0,
    },
    
    // WAVE 161: Más velocidad de cambio de hue
    maxHueShiftPerSecond: 120,
    
    preferredPalettes: ['fiesta', 'tropical', 'neon'],
  },

  drop: {
    sensitivity: 0.20,
    energyThreshold: 0.40,
    curves: {
      attack: 'ease-in',
      sustain: 'linear',
      release: 'ease-out',
    },
    timing: {
      minAttack: 20,
      maxSustain: 180,      // 🏛️ WAVE 163: Subido de 120 para drops más largos
      releaseFrames: 30,
      // 🏛️ WAVE 163: COOL DOWN EXTENDIDO
      // Después de un drop, Selene espera 1.5s antes de permitir locuras.
      // Esto evita el flashazo blanco inmediato al volver del drop.
      cooldownFrames: 90,   // 1.5 segundos de "calma" post-drop
    },
    allowMicroDrops: true,
  },

  dimmer: {
    // 🌑 WAVE 162: SIN FLOOR - DELTA MÁXIMO
    // El usuario quiere "música en 3D" = subidas y bajadas brutales.
    // Floor 0.0 = oscuridad TOTAL cuando no hay señal = máximo impacto.
    floor: 0.0,
    ceiling: 1.0,
    allowBlackout: true,
    transitionSpeed: 'fast',
    breakdownCurve: 'exponential',
  },

  movement: {
    allowedPatterns: ['figure8', 'circle', 'wave', 'sweep'],
    speedRange: {
      min: 0.4,
      max: 1.0,
    },
    allowAggressive: true,
    preferredSync: 'beat',
    stopOnDrop: false,
  },

  effects: {
    allowed: ['fog', 'beam'],
    maxStrobeRate: 0,
    autoFog: false,
    maxIntensity: 1.0,
  },

  meta: {
    baseEnergy: 0.8,
    
    // 🔥 WAVE 161: MÁXIMA VOLATILIDAD
    // Cambios rápidos para seguir la música
    volatility: 0.9,
    
    stabilityFirst: false,
    
    // 🔧 WAVE 161: melodyThreshold se maneja en main.ts VIBE_PRESETS
    // (El tipo VibeMetaConstraints no lo soporta aquí)
    
    bpmHint: {
      min: 85,
      max: 175,
    },
  },
};
