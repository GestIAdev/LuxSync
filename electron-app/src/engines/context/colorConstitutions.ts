/**
 * 🏛️ WAVE 144: COLOR CONSTITUTIONS
 * =================================
 * Las 4 Leyes Cromáticas que gobiernan el alma visual de Selene.
 * 
 * Este archivo contiene las restricciones inmutables de cada Vibe,
 * codificadas según la especificación WAVE-143-COLOR-CONSTITUTION.md.
 * 
 * FILOSOFÍA: "LA CONSTITUCIÓN ES LEY"
 * - Cada Vibe tiene su propia Constitución
 * - El VibeManager consulta estas leyes
 * - El SeleneColorEngine las OBEDECE sin cuestionarlas
 * 
 * @see docs/audits/WAVE-143-COLOR-CONSTITUTION.md
 * @module engines/context/colorConstitutions
 * @version 144.0.0
 */

import type { GenerationOptions } from '../../main/selene-lux-core/engines/visual/SeleneColorEngine';
import type { VibeId } from '../../types/VibeProfile';

// ═══════════════════════════════════════════════════════════════════════════
// 🏭 CONSTITUCIÓN TECHNO-CLUB: "Los Demonios de Neón"
// ═══════════════════════════════════════════════════════════════════════════
/**
 * En el reino del Techno, la calidez es herejía. Solo el frío sobrevive.
 * 
 * ZONA SAGRADA: 170° - 302° (Cian → Violeta → Magenta)
 * ZONA PROHIBIDA: 0° - 75° y 330° - 360° (Toda Calidez)
 * ZONA LÁSER: 110° - 140° (Verde Ácido → Láser)
 */
export const TECHNO_CONSTITUTION: GenerationOptions = {
  // Estrategia tetraédrica (Prism)
  forceStrategy: 'prism',
  
  // Zonas prohibidas: naranjas, amarillos, rojos cálidos
  forbiddenHueRanges: [[0, 75], [330, 360]],
  
  // Solo espectro frío permitido
  allowedHueRanges: [[110, 302]],
  
  // Elastic Rotation de 15° para escapar zonas prohibidas
  elasticRotation: 15,
  
  // Mapeo forzado: Verde césped (90-110) → Verde Láser (130)
  hueRemapping: [{ from: 90, to: 110, target: 130 }],
  
  // Saturación neón obligatoria
  saturationRange: [90, 100],
  
  // Luminosidad sólida (evitar lavado)
  lightnessRange: [45, 55],
  
  // UV Floor: Ambient fijo en Índigo UV
  ambientLock: { h: 275, s: 100, l: 20 },
  
  // Comportamiento del strobe: blanco nuclear
  accentBehavior: 'strobe',
  strobeColor: { r: 255, g: 255, b: 255 },
  
  // Dimming agresivo permitido
  dimmingConfig: {
    floor: 0.05,   // Casi blackout OK
    ceiling: 1.0,  // Full power
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🌴 CONSTITUCIÓN FIESTA-LATINA: "La Jungla Tropical"
// ═══════════════════════════════════════════════════════════════════════════
/**
 * En el reino Latino, la vida es exuberancia. Los muertos no bailan.
 * 
 * ZONA SOLAR: 0° - 60° (Rojo → Naranja → Amarillo Oro)
 * ZONA SELVA: 120° - 180° (Verde Esmeralda → Turquesa)
 * ZONA PROHIBIDA: 200° - 240° (Azul Metálico → Gris)
 */
export const LATINO_CONSTITUTION: GenerationOptions = {
  // Syncopation decide la estrategia (no forzada)
  forceStrategy: undefined,
  
  // Zona prohibida: azules metálicos corporativos
  forbiddenHueRanges: [[200, 240]],
  
  // Permitido: cálidos + selva + magenta
  allowedHueRanges: [[0, 60], [120, 195], [280, 330]],
  
  // Elastic Rotation estándar
  elasticRotation: 15,
  
  // Saturación vibrante
  saturationRange: [75, 100],
  
  // Luminosidad brillante
  lightnessRange: [45, 65],
  
  // Anti-Barro: proteger zona pantanosa
  mudGuard: {
    enabled: true,
    swampZone: [40, 75],       // Naranja/oliva
    minLightness: 55,          // L mínimo en pantano
    minSaturation: 85,         // S mínimo en pantano
  },
  
  // Tropical Mirror: Ambient = Secondary + 180°
  tropicalMirror: true,
  
  // Solar Flare: flash dorado cálido
  accentBehavior: 'solar-flare',
  solarFlareAccent: { h: 40, s: 10, l: 95 },
  
  // Dimming suave
  dimmingConfig: {
    floor: 0.15,   // Nunca muy oscuro
    ceiling: 1.0,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎸 CONSTITUCIÓN POP-ROCK: "Leyendas del Estadio"
// ═══════════════════════════════════════════════════════════════════════════
/**
 * En el reino del Rock, la simplicidad es poder. Los PAR64 reinan supremos.
 * 
 * ZONA SANGRE: 350° - 10° (Rojo Puro Stadium)
 * ZONA REAL: 220° - 250° (Azul Rey → Índigo)
 * ZONA ÁMBAR: 35° - 50° (Tungsteno → Oro)
 */
export const ROCK_CONSTITUTION: GenerationOptions = {
  // Complementario para máximo drama
  forceStrategy: 'complementary',
  
  // Prohibido: verdes neón y púrpuras sucios
  forbiddenHueRanges: [[80, 160], [260, 300]],
  
  // Solo: rojos, azules, ámbares
  allowedHueRanges: [[0, 60], [210, 260], [340, 360]],
  
  // Mapeo: Verde → Rojo, Púrpura sucio → Ámbar
  hueRemapping: [
    { from: 80, to: 160, target: 0 },    // Verde → Rojo sangre
    { from: 260, to: 300, target: 40 },  // Púrpura sucio → Ámbar
  ],
  
  // Saturación sólida
  saturationRange: [85, 100],
  
  // Luminosidad punch
  lightnessRange: [50, 65],
  
  // Drum-reactive: flash en snare/kick
  accentBehavior: 'drum-reactive',
  snareFlash: { h: 40, s: 20, l: 95 },   // Tungsteno
  kickPunch: { usesPrimary: true, l: 80 },
  
  // Dimming con espacio para drama
  dimmingConfig: {
    floor: 0.10,
    ceiling: 1.0,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 CONSTITUCIÓN CHILL-LOUNGE: "Bioluminiscencia"
// ═══════════════════════════════════════════════════════════════════════════
/**
 * En el reino del Chill, la profundidad es infinita. Flotamos en luz líquida.
 * 
 * ZONA ABISAL: 200° - 260° (Azul Profundo → Índigo)
 * ZONA MEDUSA: 270° - 310° (Violeta → Magenta Suave)
 * ZONA CORAL: 170° - 195° (Turquesa → Cian)
 */
export const CHILL_CONSTITUTION: GenerationOptions = {
  // Analogous para armonía
  forceStrategy: 'analogous',
  
  // Prohibido: naranjas/amarillos (demasiado energéticos)
  forbiddenHueRanges: [[30, 80]],
  
  // Solo espectro oceánico frío
  allowedHueRanges: [[170, 320]],
  
  // Saturación respirable
  saturationRange: [50, 80],
  
  // Luminosidad profunda
  lightnessRange: [35, 55],
  
  // Sin strobes (constitucional)
  strobeProhibited: true,
  
  // Breathing: pulso lento
  accentBehavior: 'breathing',
  pulseConfig: { duration: 4000, amplitude: 0.15 },
  
  // Transiciones líquidas
  transitionConfig: {
    minDuration: 2000,        // 2 segundos mínimo
    easing: 'sine-inout',     // Ondas suaves
  },
  
  // Dimming suave, nunca negro total
  dimmingConfig: {
    floor: 0.05,   // Siempre algo de luz
    ceiling: 0.85, // Nunca cegador
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 💤 CONSTITUCIÓN IDLE: "El Limbo"
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Estado neutro de espera. Sin restricciones, pura matemática musical.
 */
export const IDLE_CONSTITUTION: GenerationOptions = {
  // Sin restricciones de estrategia
  forceStrategy: undefined,
  
  // Todo el espectro permitido
  allowedHueRanges: undefined,
  forbiddenHueRanges: undefined,
  
  // Saturación y luz estándar
  saturationRange: [70, 100],
  lightnessRange: [35, 60],
  
  // Accent cuaternario (color derivado)
  accentBehavior: 'quaternary',
  
  // Dimming suave
  dimmingConfig: {
    floor: 0.10,
    ceiling: 0.90,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 📚 REGISTRO DE CONSTITUCIONES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapa de VibeId → GenerationOptions
 * Usado por VibeManager para obtener las restricciones del Vibe activo.
 */
export const COLOR_CONSTITUTIONS: Record<VibeId, GenerationOptions> = {
  'idle': IDLE_CONSTITUTION,
  'techno-club': TECHNO_CONSTITUTION,
  'fiesta-latina': LATINO_CONSTITUTION,
  'pop-rock': ROCK_CONSTITUTION,
  'chill-lounge': CHILL_CONSTITUTION,
};

/**
 * Obtiene la Constitución de Color para un VibeId.
 * Fallback a IDLE si no existe.
 * 
 * @param vibeId - ID del Vibe activo
 * @returns GenerationOptions con las restricciones cromáticas
 */
export function getColorConstitution(vibeId: VibeId | string): GenerationOptions {
  return COLOR_CONSTITUTIONS[vibeId as VibeId] ?? IDLE_CONSTITUTION;
}

/**
 * Verifica si un hue está en zona prohibida para un Vibe.
 * Útil para debugging y UI.
 * 
 * @param hue - Hue a verificar (0-360)
 * @param vibeId - ID del Vibe
 * @returns true si el hue está prohibido
 */
export function isHueForbidden(hue: number, vibeId: VibeId | string): boolean {
  const constitution = getColorConstitution(vibeId);
  if (!constitution.forbiddenHueRanges) return false;
  
  const normalizedHue = ((hue % 360) + 360) % 360;
  
  for (const [min, max] of constitution.forbiddenHueRanges) {
    const isInRange = min <= max
      ? (normalizedHue >= min && normalizedHue <= max)
      : (normalizedHue >= min || normalizedHue <= max);
    
    if (isInRange) return true;
  }
  
  return false;
}

/**
 * Aplica Elastic Rotation a un hue hasta escapar de zonas prohibidas.
 * 
 * @param hue - Hue inicial
 * @param vibeId - ID del Vibe
 * @returns Hue rotado fuera de zonas prohibidas
 */
export function applyElasticRotation(hue: number, vibeId: VibeId | string): number {
  const constitution = getColorConstitution(vibeId);
  if (!constitution.forbiddenHueRanges) return hue;
  
  const step = constitution.elasticRotation ?? 15;
  const maxIterations = Math.ceil(360 / step);
  let resultHue = ((hue % 360) + 360) % 360;
  
  for (let i = 0; i < maxIterations; i++) {
    if (!isHueForbidden(resultHue, vibeId)) {
      return resultHue;
    }
    resultHue = ((resultHue + step) % 360);
  }
  
  return resultHue;  // Fallback si todo está prohibido
}

// Export default para importación directa
export default COLOR_CONSTITUTIONS;
