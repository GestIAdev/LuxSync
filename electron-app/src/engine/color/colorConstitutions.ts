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

import type { GenerationOptions } from './SeleneColorEngine';
import type { VibeId } from '../../types/VibeProfile';

// ═══════════════════════════════════════════════════════════════════════════
// 🏭 CONSTITUCIÓN TECHNO-CLUB: "Los Demonios de Neón"
// ═══════════════════════════════════════════════════════════════════════════
/**
 * En el reino del Techno, la calidez es herejía. Solo el frío sobrevive.
 * 
 * 🌡️ WAVE 151.2: OPEN BORDERS - Tratado de Libre Comercio Cromático
 * La Gravedad Térmica (9500K) hace el trabajo de "enfriar" a los inmigrantes.
 * Ya no necesitamos una policía tan estricta en la puerta.
 * 
 * FILOSOFÍA: Bunker en Noruega viendo auroras boreales 🌌
 * 
 * ZONA LIBRE: 0° - 20° (Rojos) → La gravedad los convierte en Magentas
 * ZONA LIBRE: 85° - 110° (Verde Lima) → La gravedad los convierte en Láser
 * ZONA LIBRE: 280° - 360° (Magentas/Rosas) → Ya son fríos, bienvenidos
 * 
 * ZONA PROHIBIDA: 25° - 80° (Naranja/Amarillo/Mostaza)
 * Este es el "núcleo duro" que incluso con gravedad queda feo.
 */
export const TECHNO_CONSTITUTION: GenerationOptions = {
  // 🔓 WAVE 283: PRISM BREAK - ¡LIBERTAD ABSOLUTA!
  // Antes: forceStrategy: 'prism' - DICTADOR que ignoraba al StrategyArbiter
  // Ahora: Sin forceStrategy - El StrategyArbiter decide dinámicamente
  // 
  // RED DE SEGURIDAD:
  // - Gravedad Térmica (9500K) → Arrastra todo al frío
  // - Rangos Prohibidos → Si sale naranja, la gravedad lo empuja al magenta/cian
  // - SeleneColorEngine → Ya no genera basura aleatoria, usa armonía musical
  //
  // forceStrategy: 'prism',  // ← LIBERADO! El StrategyArbiter ahora gobierna
  
  // 🌡️ WAVE 149.6: THERMAL GRAVITY - Polo Azul Masivo
  // 9500K = Fuerza ~29% hacia 240° (Azul Rey) tras WAVE 150.6
  // Los rojos (0-20°) serán arrastrados hacia magenta (300°)
  // Los verdes (85-110°) serán arrastrados hacia cyan (180°)
  atmosphericTemp: 9500,
  
  // 🌬️ WAVE 285.5: GRAVITATIONAL BALANCE
  // WAVE 284: 0.15 (15%) - Demasiado suave, naranja 45° escapaba a 20°
  // WAVE 285.5: 0.22 (22%) - Balance: +10° seguridad, preserva diversidad
  //
  // Matemática: 45° con 22% gravedad → 45 - (165 × 0.22) = 45 - 36 = 9°
  //             9° está cerca del polo cálido, pero forbiddenHueRanges no lo atrapa
  //             PERO el hueRemapping [25-85] → frío con variación lo sanitiza
  thermalGravityStrength: 0.22,
  
  // 🌐 WAVE 285.5: Solo el núcleo naranja/amarillo es problemático
  forbiddenHueRanges: [[25, 80]],
  
  // 🌈 WAVE 285.5: Permitir todo, la gravedad + remapping hacen el trabajo
  allowedHueRanges: [[0, 360]],
  
  // Elastic Rotation de 15° para escapar zonas prohibidas
  elasticRotation: 15,
  
  // 🗺️ WAVE 285.5: Solo remapear el núcleo problemático (25-85°)
  // FILOSOFÍA: No destruir diversidad cromática por un puto naranja
  //
  // - Rojos (0-24°): LIBRES - La gravedad los empuja a Magenta naturalmente
  // - Naranjas/Amarillos (25-85°): Remapear a rango frío CON VARIACIÓN
  // - Verdes (86-110°): Remapear a Verde Láser (130°)
  //
  // VARIACIÓN: El target no es fijo, usa la posición dentro del rango
  // para distribuir en el espectro frío (150-200° = Cyan/Turquesa)
  hueRemapping: [
    { from: 25, to: 85, target: 170 },   // Naranjas → Cyan-Turquesa (centro del rango frío)
    { from: 86, to: 110, target: 130 },  // Verde césped → Verde Láser
  ],
  
  // Saturación neón obligatoria
  saturationRange: [90, 100],
  
  // Luminosidad sólida (evitar lavado)
  lightnessRange: [45, 55],
  
  // 🔓 WAVE 148: AMBIENT UNLOCKED
  // El ambient ahora fluye libremente. Con Thermal Gravity,
  // caerá naturalmente hacia violetas/magentas/cyans.
  
  // Comportamiento del strobe: Magenta Neón (WAVE 151)
  accentBehavior: 'strobe',
  strobeColor: { r: 255, g: 179, b: 255 },  // Magenta Neón (300° l:85)
  
  // ⚡ WAVE 148: Strobe no es el estado por defecto
  // El accent tiene color (Magenta/Cian) en reposo, blanco solo en drops
  strobeProhibited: false,  // Permitido pero no permanente
  
  // Dimming agresivo permitido
  dimmingConfig: {
    floor: 0.05,   // Casi blackout OK
    ceiling: 1.0,  // Full power
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🌴 CONSTITUCIÓN FIESTA-LATINA: "3D LIGHT" (WAVE 161)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * WAVE 161: STRATEGY ASSAULT & 3D LIGHT
 * 
 * "Queremos música en 3D como en techno" - contraste dramático con oscuridad.
 * 
 * ZONA SOLAR: 0° - 60° (Rojo → Naranja → Amarillo Oro)
 * ZONA SELVA: 120° - 200° (Verde → Turquesa → Cyan)
 * ZONA NEON:  260° - 360° (Magenta → Rosa → Rojo)
 * ZONA PROHIBIDA: 210° - 240° (Solo azul triste/metálico)
 */
export const LATINO_CONSTITUTION: GenerationOptions = {
  // Syncopation decide la estrategia (no forzada)
  forceStrategy: undefined,
  
  // � WAVE 159: ECOLOGICAL FIX - Clima Neutro
  // 5000K = Gravedad CERO - El algoritmo elige colores libremente
  // Antes: 3000K tiraba todo hacia el naranja (40°)
  atmosphericTemp: 4800,  // WAVE 161: Ricitos de Oro - Clima Neutro
  
  // Zona prohibida: azules metálicos corporativos
  // 🌿 WAVE 160: Eliminado - todo permitido
// 🎨 WAVE 160.5: Paleta Tropical + Gravedad Térmica
  // Gravedad 3500K corrige colores que escapen hacia marrones
  // 🚫 WAVE 161: Solo el azul triste está prohibido
  forbiddenHueRanges: [[210, 240]],  // WAVE 161: Zona mínima prohibida

  // 🌈 WAVE 161: Espectro ampliado para diversidad cromática
  allowedHueRanges: [[0, 60], [120, 200], [260, 360]],  // WAVE 161: Más cyans y magentas
  elasticRotation: 20,  // WAVE 161: Aumentado para escapar analogous
  
  // Saturación vibrante
  saturationRange: [75, 100],
  
  // Luminosidad brillante
  lightnessRange: [45, 65],
  
  // 🌿 WAVE 160: MudGuard desactivado - restringía colores
  // 🛡️ WAVE 160.5: MudGuard reactivado (relajado)
  mudGuard: {
    enabled: true,
    swampZone: [50, 90],
    minLightness: 50,
    minSaturation: 80,
  },
  
  // Tropical Mirror: Ambient = Secondary + 180°
  tropicalMirror: true,
  
  // 🌿 WAVE 160: Accent quaternary en vez de Solar Flare blanco
  // Antes: Solar Flare con S=10, L=95 = blanco lavado
  accentBehavior: 'quaternary',  // Colores variados en accent
  solarFlareAccent: { h: 40, s: 80, l: 60 },  // Oro vibrante si se usa
  
  // 🌑 WAVE 161: 3D LIGHT - Dimming AGRESIVO para contraste
  dimmingConfig: {
    floor: 0.05,   // WAVE 161: Casi blackout OK (como Techno)
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
  
  // 🌡️ WAVE 149.6: THERMAL GRAVITY - Polo Ámbar Medio
  // 3200K = Fuerza 0.6 hacia 40° (Oro/Ámbar)
  // Colores fríos se calientan, pero mantienen identidad
  atmosphericTemp: 3200,
  
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
  
  // 🌡️ WAVE 149.6: THERMAL GRAVITY - Polo Cian Suave
  // 8000K = Fuerza 0.33 hacia 240° (Cian/Agua)
  // Tirón suave hacia tonos acuáticos relajantes
  atmosphericTemp: 8000,
  
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
  
  // 🌡️ WAVE 149.6: THERMAL GRAVITY - Neutro (sin gravedad)
  // 6500K = Zona neutra (5000-7000K), sin arrastre cromático
  atmosphericTemp: 6500,
  
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
