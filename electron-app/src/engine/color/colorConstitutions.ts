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
  
  // � WAVE 287: NEON PROTOCOL - "Neon or Nothing"
  // ═══════════════════════════════════════════════════════════════════════
  // FILOSOFÍA: "Si vas a ser cálido, tienes que quemarme la retina.
  //             Si no puedes brillar así, te vas al blanco hielo."
  //
  // Los colores derivados (Secondary, Ambient, Accent) que caigan en la
  // danger zone serán transformados a versiones EXTREMAS:
  //   - NEÓN: S>=90%, L>=75% (amarillo láser, naranja nuclear)
  //   - BLANCO: Si no puede ser neón, colapsar a blanco hielo
  //
  // Esto aplica a TODA la paleta, no solo al Primary.
  // ═══════════════════════════════════════════════════════════════════════
  neonProtocol: {
    enabled: true,
    dangerZone: [15, 80],       // Naranjas (15°) hasta Amarillo-Verde (80°)
    minSaturation: 90,          // Saturación mínima para neón
    minLightness: 75,           // Luminosidad mínima para evitar barro
    fallbackToWhite: true,      // Si no puede ser neón → blanco hielo
  },
  
  // �🔓 WAVE 148: AMBIENT UNLOCKED
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

  // ⏱️ WAVE 3490: SIDEREAL CLOCK TECHNO
  // 5 actos × 6 minutos = ciclo de 30 minutos.
  // El Neon Protocol + Thermal Gravity siguen activos en cada slot.
  // El slot solo restringe dónde puede caer el hue dentro del espectro frío.
  siderealClock: {
    slotDurationMs: 6 * 60 * 1000,  // 6 minutos por slot
    slots: [
      {
        label: 'BUNKER — Cyan Eléctrico Profundo',
        allowedHueRanges: [[170, 210]],  // Cyan-Turquesa puro
        lightnessRange: [40, 52],
      },
      {
        label: 'MAGENTA — Neón Rosa Industrial',
        allowedHueRanges: [[290, 340]],  // Magenta a Rosa Neón
        lightnessRange: [42, 55],
      },
      {
        label: 'LASER — Verde Ultravioleta',
        allowedHueRanges: [[110, 160]],  // Verde Láser a Turquesa oscuro
        lightnessRange: [40, 52],
      },
      {
        label: 'ABISAL — Azul Profundo',
        allowedHueRanges: [[210, 260]],  // Azul Rey a Índigo
        lightnessRange: [38, 50],        // Más oscuro — el piso del abismo
      },
      {
        label: 'TRANSGRESION — Rojo Magenta',
        allowedHueRanges: [[0, 20], [340, 360]],  // Rojo puro a Magenta oscuro
        lightnessRange: [40, 52],
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🌴 CONSTITUCIÓN FIESTA-LATINA: "CARIBE NOCTURNO" (WAVE 3490)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * WAVE 3490: CARIBE NOCTURNO — Escenografía cinematográfica.
 *
 * El reguetón moderno pide oscuridad y contraste, no fiesta de colores.
 * El Caribe tiene noche, profundidad, selva, neon de bar, flores tropicales.
 *
 * REFORMA WAVE 3490:
 * — Temperatura neutra (6200K): sin polo cálido que empuje todo al oro.
 * — Amarillo puro prohibido (45°+): el dorado es accent exclusivo.
 * — Lightness floor = 35%: oscuridad real disponible.
 * — Tropical Bias suprimido: el Sidereal Clock gestiona la zona.
 * — Sidereal Clock: 6 actos × 4min = ciclo de 24min.
 *
 * EL DORADO SOBREVIVE: solarFlareAccent { h:35 } = su trono, no su dictadura.
 *
 * SLOTS (actos):
 * 🌊 ENTRADA    — Azul Caribeño Profundo (190-255°)
 * 🌿 ASCENSO   — Verde Selva y Agua (90-190°)
 * 🔥 FUEGO     — Rojo Pasional y Magenta (0-44° | 300-360°)
 * 🟡 APEX      — Caribe Completo (forbidden rules solo)
 * 🌸 DESCENSO  — Flores Tropicales (285-360°)
 * 🌙 NOCHE     — Azul Nocturno Profundo (195-255°)
 */
export const LATINO_CONSTITUTION: GenerationOptions = {
  forceStrategy: undefined,

  // WAVE 3490: Temperatura neutra — sin polo cálido empujando al amarillo.
  // 6200K = zona neutra (5000-7000K), sin arrastre cromático dominante.
  atmosphericTemp: 6200,
  thermalGravityStrength: 0.12,  // Fuerza reducida: suave pero presente

  // WAVE 3490: Amarillo puro ahora prohibido.
  // El naranja pasional (0-44°) y el magenta siguen libres.
  // El agua caribeña (185-255°) sigue libre.
  // La selva (90-155°) sigue libre.
  forbiddenHueRanges: [
    [45, 90],    // AMARILLO + BARRO: 45° es el límite del naranja pasional
    [155, 185],  // VERDE BESUGO (ampliado desde 160-180)
    [255, 285],  // UV INDUSTRIAL (ampliado desde 260-280)
  ],

  // El Sidereal Clock refina allowedHueRanges dinámicamente por slot.
  allowedHueRanges: [[0, 360]],
  elasticRotation: 20,

  // WAVE 3490: Oscuridad disponible. Floor bajado de 50% a 35%.
  saturationRange: [75, 100],
  lightnessRange: [35, 60],

  // WAVE 3490: Suprimir Tropical Bias. El Sidereal Clock gestiona la zona.
  suppressTropicalBias: true,

  mudGuard: {
    enabled: true,
    swampZone: [45, 90],  // Actualizado para coincidir con new forbiddenHueRanges
    minLightness: 50,
    minSaturation: 80,
  },

  tropicalMirror: true,

  // El dorado es el accent — su trono, no su dictadura.
  accentBehavior: 'solar-flare',
  solarFlareAccent: { h: 35, s: 100, l: 55 },

  dimmingConfig: {
    floor: 0.08,
    ceiling: 1.0,
  },

  // WAVE 3490: EL RELOJ SIDÉREO
  // 6 actos × 4 minutos = ciclo de 24 minutos.
  siderealClock: {
    slotDurationMs: 4 * 60 * 1000,  // 4 minutos exactos por slot
    slots: [
      {
        label: 'ENTRADA — Azul Caribeño Profundo',
        allowedHueRanges: [[190, 255]],
        lightnessRange: [35, 50],
      },
      {
        label: 'ASCENSO — Verde Selva y Agua',
        allowedHueRanges: [[90, 190]],
        lightnessRange: [40, 55],
      },
      {
        label: 'FUEGO — Rojo Pasional y Magenta',
        allowedHueRanges: [[0, 44], [300, 360]],
        lightnessRange: [40, 60],
      },
      {
        label: 'APEX — Caribe Completo',
        allowedHueRanges: [[0, 360]],  // Todo el Caribe (solo rigen los forbidden)
        lightnessRange: [45, 62],
      },
      {
        label: 'DESCENSO — Flores Tropicales',
        allowedHueRanges: [[285, 360]],
        lightnessRange: [38, 55],
      },
      {
        label: 'NOCHE — Azul Nocturno Profundo',
        allowedHueRanges: [[195, 255]],
        lightnessRange: [35, 48],
      },
    ],
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
// 🌊 CONSTITUCIÓN CHILL-LOUNGE: "Bioluminiscencia" (WAVE 315)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * WAVE 315: EXPANDED SPECTRUM - El ecosistema submarino completo.
 * 
 * En el reino del Chill, la profundidad es infinita. Flotamos en luz líquida.
 * 
 * 🌿 ZONA ALGA:   135° - 170° (Verde Esmeralda → Turquesa)  [NUEVO]
 * 🌊 ZONA CORAL:  170° - 200° (Turquesa → Cian)
 * 🐋 ZONA ABISAL: 200° - 260° (Azul Profundo → Índigo)
 * 🪼 ZONA MEDUSA: 260° - 320° (Violeta → Magenta Suave)
 * 🌺 ZONA ROSA:   320° - 340° (Magenta Profundo → Rosa)    [NUEVO]
 * 
 * FILOSOFÍA: "El océano tiene TODO. Algas, corales, abismos, medusas, flores."
 */
export const CHILL_CONSTITUTION: GenerationOptions = {
  // Analogous para armonía
  forceStrategy: 'analogous',
  
  // 🌡️ WAVE 149.6: THERMAL GRAVITY - Polo Cian Suave
  // 8000K = Fuerza 0.33 hacia 240° (Cian/Agua)
  // Tirón suave hacia tonos acuáticos relajantes
  atmosphericTemp: 8000,
  
  // Prohibido: naranjas/amarillos (demasiado energéticos para el fondo marino)
  forbiddenHueRanges: [[30, 80]],
  
  // 🌊 WAVE 315: EXPANDED SPECTRUM
  // Antes: [[170, 320]] = 150° de espectro
  // Ahora: [[135, 340]] = 205° de espectro (+55°)
  // Nuevas zonas: Verde Alga (135-170°) + Magenta Rosa (320-340°)
  allowedHueRanges: [[135, 340]],
  
  // Saturación respirable (no neón)
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
  
  // 🌟 WAVE 315: Dimmer floor subido - bioluminiscencia siempre visible
  // La vida marina siempre brilla, nunca hay oscuridad total
  dimmingConfig: {
    floor: 0.10,   // Antes 0.05 - Ahora 10% mínimo (brillo residual)
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
