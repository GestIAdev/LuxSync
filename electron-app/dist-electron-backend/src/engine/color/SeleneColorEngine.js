/**
 * 🎨 SELENE COLOR ENGINE (WAVE 68.5)
 * ===================================
 * Motor procedural determinista para generación de paletas cromáticas
 * basado EXCLUSIVAMENTE en teoría musical y física del sonido.
 *
 * FILOSOFÍA:
 * "Selene pinta MATEMÁTICA MUSICAL PURA.
 *  El VibeProfile es el único jefe que define restricciones."
 *
 * FUNDAMENTOS:
 * - Círculo de Quintas → Círculo Cromático (KEY_TO_HUE)
 * - Modo → Temperatura emocional (MODE_MODIFIERS)
 * - Energía → Saturación y Brillo (NUNCA cambia el Hue)
 * - Syncopation → Estrategia de contraste (analogous/triadic/complementary)
 * - Rotación Fibonacci (φ × 360° ≈ 222.5°) → Color secundario
 *
 * WAVE 68.5 - PURGA DE GÉNERO:
 * ✅ Eliminado: MACRO_GENRES, GENRE_MAP, GenreProfile, tempBias, satBoost, lightBoost
 * ✅ El motor genera colores PUROS - sin bias de género
 * ✅ El VibeManager aplica clamps DESPUÉS (temperatura/saturación min/max)
 *
 * REGLA DE ORO:
 *   finalHue = KEY_TO_HUE[key] + MODE_MODIFIERS[mode].hueDelta
 *   energía SOLO afecta saturación y brillo, NUNCA el hue base
 *
 * @see docs/JSON-ANALYZER-PROTOCOL.md - Protocolo de entrada
 * @see docs/WAVE-17-SELENE-COLOR-MIND-AUDIT.md - Arquitectura original
 * @see docs/Wave60_70/WAVE-68-5-GENRE-PURGE.md - Eliminación de lógica de género
 *
 * @module engines/visual/SeleneColorEngine
 * @version 68.5.0
 */
// ============================================================
// 2. CONSTANTES - EL CORAZÓN DE LA FÓRMULA CROMÁTICA
// ============================================================
/**
 * 🌀 ROTACIÓN FIBONACCI (Proporción Áurea)
 * φ × 360° ≈ 222.492° → Rotación para color secundario
 * Garantiza variedad infinita sin repetición visual
 */
const PHI = 1.618033988749895;
const PHI_ROTATION = (PHI * 360) % 360; // ≈ 222.5°
/**
 * 🎵 CÍRCULO DE QUINTAS → CÍRCULO CROMÁTICO
 *
 * Mapeo sinestésico de notas musicales a ángulos HSL.
 * Basado en psicoacústica y sinestesia cromática.
 *
 * Do (C) = Rojo (0°) - Fundamental, primario
 * La (A) = Índigo (270°) - 440Hz, referencia
 */
const KEY_TO_HUE = {
    // Naturales
    'C': 0, // Do - Rojo
    'D': 60, // Re - Naranja
    'E': 120, // Mi - Amarillo
    'F': 150, // Fa - Verde-Amarillo
    'G': 210, // Sol - Cyan
    'A': 270, // La - Índigo
    'B': 330, // Si - Magenta
    // Sostenidos
    'C#': 30, // Do# - Rojo-Naranja
    'D#': 90, // Re# - Amarillo-Naranja
    'F#': 180, // Fa# - Verde (tritono de C)
    'G#': 240, // Sol# - Azul
    'A#': 300, // La# - Violeta
    // Bemoles (equivalentes enarmónicos)
    'Db': 30,
    'Eb': 90,
    'Gb': 180,
    'Ab': 240,
    'Bb': 300,
};
/**
 * � WAVE 89: MAPEO DE KEY → ROOT (nota raíz numérica 0-11)
 * Usado para cálculos de variación dentro de rangos de color
 */
const KEY_TO_ROOT = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
    'C#': 1, 'D#': 3, 'F#': 6, 'G#': 8, 'A#': 10,
    'Db': 1, 'Eb': 3, 'Gb': 6, 'Ab': 8, 'Bb': 10,
};
/**
 * �🎭 MAPEO DE MOOD → HUE BASE
 * Usado cuando la key no está disponible
 */
const MOOD_HUES = {
    'happy': 50, // Amarillo-Naranja (alegría)
    'sad': 240, // Azul (tristeza)
    'tense': 0, // Rojo (tensión)
    'dreamy': 280, // Violeta (ensueño)
    'bluesy': 30, // Naranja oscuro (blues)
    'jazzy': 260, // Índigo (jazz)
    'spanish_exotic': 15, // Rojo-Naranja (flamenco)
    'universal': 120, // Verde (neutro)
    // Moods simples del top-level
    'dark': 240, // Azul oscuro
    'bright': 50, // Amarillo
    'neutral': 120, // Verde
};
const MODE_MODIFIERS = {
    // Modos Mayores - Cálidos y brillantes
    'major': {
        hue: 15, sat: 10, light: 10,
        description: 'Alegre y brillante'
    },
    'ionian': {
        hue: 15, sat: 10, light: 10,
        description: 'Alegre y brillante'
    },
    'lydian': {
        hue: 20, sat: 15, light: 15,
        description: 'Etéreo y soñador'
    },
    'mixolydian': {
        hue: 10, sat: 10, light: 5,
        description: 'Funky y cálido'
    },
    // Modos Menores - Fríos y profundos
    'minor': {
        hue: -15, sat: -10, light: -10,
        description: 'Triste y melancólico'
    },
    'aeolian': {
        hue: -15, sat: -10, light: -10,
        description: 'Triste y melancólico'
    },
    'dorian': {
        hue: -5, sat: 0, light: 0,
        description: 'Jazzy y sofisticado'
    },
    'phrygian': {
        hue: -20, sat: 5, light: -10,
        description: 'Español y tenso'
    },
    'locrian': {
        hue: -30, sat: -15, light: -20,
        description: 'Oscuro y disonante'
    },
    // Escalas Especiales
    'harmonic_minor': {
        hue: -10, sat: -5, light: -10,
        description: 'Dramático y exótico'
    },
    'melodic_minor': {
        hue: -5, sat: 0, light: -5,
        description: 'Jazz avanzado'
    },
    'pentatonic_major': {
        hue: 10, sat: 10, light: 5,
        description: 'Simple y folk'
    },
    'pentatonic_minor': {
        hue: 0, sat: 5, light: -5,
        description: 'Blues y rock'
    },
    'blues': {
        hue: -10, sat: 5, light: -10,
        description: 'Bluesy y soul'
    },
};
// ============================================================
// 3. SISTEMA DE MACRO-GÉNEROS
// ============================================================
// ============================================================
// 4. UTILIDADES
// ============================================================
/**
 * Normaliza un valor de hue al rango 0-360
 */
function normalizeHue(h) {
    return ((h % 360) + 360) % 360;
}
/**
 * Clamp un valor entre min y max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
/**
 * 🔥 WAVE 287: NEON PROTOCOL - "Neon or Nothing"
 * ═══════════════════════════════════════════════════════════════════════════
 * Transforma colores en la "danger zone" a versiones EXTREMAS.
 *
 * FILOSOFÍA: "Si vas a ser cálido, tienes que quemarme la retina.
 *             Si no puedes brillar así, te vas al blanco hielo."
 *
 * @param hsl - Color a sanitizar
 * @param options - Configuración del Neon Protocol
 * @returns Color transformado (neón extremo o blanco hielo)
 */
function applyNeonProtocol(hsl, options) {
    const protocol = options?.neonProtocol;
    // Si no hay protocolo o está desactivado, devolver color original
    if (!protocol || !protocol.enabled) {
        return hsl;
    }
    const [dangerMin, dangerMax] = protocol.dangerZone;
    const hue = normalizeHue(hsl.h);
    // Verificar si el hue está en la danger zone
    // Soportar wrap-around (ej: [350, 20] = 350-360 y 0-20)
    const isInDanger = dangerMin <= dangerMax
        ? (hue >= dangerMin && hue <= dangerMax)
        : (hue >= dangerMin || hue <= dangerMax);
    if (!isInDanger) {
        return hsl; // Fuera de peligro, devolver original
    }
    // ═══════════════════════════════════════════════════════════════════
    // DENTRO DE LA DANGER ZONE: Aplicar reglas de transformación
    // ═══════════════════════════════════════════════════════════════════
    // 
    // WAVE 287.2: COLD ESCAPE ALWAYS - En Techno, SIEMPRE rotar a frío
    // El Arquitecto decidió: "Amarillo neón sigue siendo amarillo feo".
    // Para Techno, no hay excepciones: danger zone = zona fría.
    //
    // Filosofía: "En el bunker no hay sol. Solo neón frío."
    // ═══════════════════════════════════════════════════════════════════
    // 🧊 COLD ESCAPE: Rotar a cyan/turquesa/verde-frío
    // Distribuimos el rango [15-80] en el rango frío [170-210]
    // para mantener variedad cromática
    const dangerRange = dangerMax - dangerMin; // 80 - 15 = 65
    const positionInDanger = (hue - dangerMin) / dangerRange; // 0.0 - 1.0
    const coldHue = 170 + positionInDanger * 40; // 170° - 210° (cyan-turquesa)
    return {
        h: normalizeHue(coldHue),
        s: Math.max(hsl.s, 85), // Asegurar saturación neón
        l: hsl.l, // Mantener luminosidad original (oscuridad)
    };
}
/**
 * Mapea un valor de un rango a otro
 */
function mapRange(value, inMin, inMax, outMin, outMax) {
    return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
}
/**
 * Convierte HSL a RGB
 * @see https://www.w3.org/TR/css-color-4/#hsl-to-rgb
 */
export function hslToRgb(hsl) {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}
/**
 * Convierte RGB a HSL
 */
export function rgbToHsl(rgb) {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}
/**
 * Convierte paleta HSL completa a RGB
 */
export function paletteToRgb(palette) {
    return {
        primary: hslToRgb(palette.primary),
        secondary: hslToRgb(palette.secondary),
        accent: hslToRgb(palette.accent),
        ambient: hslToRgb(palette.ambient),
        contrast: hslToRgb(palette.contrast),
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// 🌡️ WAVE 149.6: THERMAL GRAVITY - Motor de Física Cromática
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Aplica gravedad térmica a un hue, arrastrándolo hacia el polo
 * correspondiente a la temperatura atmosférica del Vibe.
 *
 * FÍSICA:
 * - > 7000K: Polo Frío (240° Azul Rey)
 * - < 5000K: Polo Cálido (40° Oro)
 * - 5000-7000K: Zona Neutra (sin gravedad)
 *
 * La fuerza de arrastre es proporcional a la distancia del polo neutral (6000K).
 *
 * @param hue - Hue original (0-360)
 * @param atmosphericTemp - Temperatura atmosférica en Kelvin (2000-10000)
 * @param maxForce - Fuerza máxima de arrastre (0.0-1.0). Default: 0.35
 * @returns Hue modificado por la gravedad térmica
 *
 * @example
 * // Techno (9500K) arrastra amarillo 60° hacia verde/cian
 * applyThermalGravity(60, 9500) → ~140° (Verde Cian)
 *
 * // Latino (3000K) arrastra azul 240° hacia magenta/rojo
 * applyThermalGravity(240, 3000) → ~160° (Cian/Turquesa, menos frío)
 */
export function applyThermalGravity(hue, atmosphericTemp, maxForce) {
    // Sin temperatura definida = sin gravedad
    if (!atmosphericTemp)
        return hue;
    // ═══════════════════════════════════════════════════════════════════════
    // 🌡️ WAVE 162.5: THERMAL GRAVITY AMPLIFICADA
    // 🌬️ WAVE 284: GRAVITATIONAL RELAXATION - maxForce ahora es configurable
    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 284: El problema era que 35% de gravedad colapsaba diversidad
    // Verdes (135°) se convertían en Cyan (172°) - ¡37° de migración!
    //
    // SOLUCIÓN: Cada Vibe puede definir su thermalGravityStrength
    // - Techno: 0.15 (suave, preserva Verdes/Magentas/Violetas)
    // - Latino: 0.35 (agresivo, arrastra hacia el Oro)
    // ═══════════════════════════════════════════════════════════════════════
    // Zona neutral más estrecha: daylight verdadero (5800K-6200K)
    if (atmosphericTemp >= 5800 && atmosphericTemp <= 6200) {
        return hue;
    }
    // 🌬️ WAVE 284: Fuerza máxima configurable (default 0.35 para legacy)
    const MAX_THERMAL_FORCE = maxForce ?? 0.35;
    // Definir polo de atracción
    let pole;
    let rawForce;
    if (atmosphericTemp > 6200) {
        // POLO FRÍO: Azul Rey (240°)
        pole = 240;
        // Fuerza bruta: 6200K → 0, 9000K → 1
        rawForce = Math.min((atmosphericTemp - 6200) / 2800, 1.0);
    }
    else {
        // POLO CÁLIDO: Oro (40°)
        pole = 40;
        // Fuerza bruta: 5800K → 0, 3000K → 1
        rawForce = Math.min((5800 - atmosphericTemp) / 2800, 1.0);
    }
    // Limitar la fuerza al máximo permitido
    const force = rawForce * MAX_THERMAL_FORCE;
    // Calcular distancia más corta en el círculo cromático
    let delta = pole - hue;
    // Normalizar a camino más corto (-180 a 180)
    if (delta > 180)
        delta -= 360;
    if (delta < -180)
        delta += 360;
    // ═══════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 285: ESCAPE VELOCITY - Forzar dirección de escape para zona cálida
    // ═══════════════════════════════════════════════════════════════════════
    // PROBLEMA: Hue 45° con polo 240° tiene camino corto HACIA ATRÁS (45→0→360→240)
    // Esto EMPUJA el color hacia más naranja (45° → 20°) en vez de hacia cyan.
    //
    // SOLUCIÓN: Si el hue está en zona naranja (0-85°) y el polo es frío (240°),
    // forzar la dirección HACIA ADELANTE para escapar hacia cyan/verde.
    // Esto significa usar delta positivo (ir por 45→90→180→240).
    // ═══════════════════════════════════════════════════════════════════════
    if (pole === 240 && hue >= 0 && hue <= 85) {
        // Forzar escape hacia adelante: delta debe ser positivo
        // Distancia "hacia adelante" = 240 - hue (siempre positivo)
        delta = Math.abs(pole - hue); // Ir hacia cyan/verde/azul
        // Nota: Con hue=45, delta=195 → newHue = 45 + 195*0.15 = 74° (verde-amarillo, escapando)
    }
    // Aplicar vector de arrastre (ahora moderado)
    const newHue = hue + (delta * force);
    const resultHue = normalizeHue(newHue);
    // 🧹 WAVE 671.5: Commented ThermalGravity log (useful for future debug - Radwulf request)
    // 🔌 WAVE 150: DEBUG LOG (Chivato) - Ver si el aire acondicionado está encendido
    // if (Math.random() < 0.01) {  // Solo 1% de frames para no saturar consola
    //   console.log(`[ThermalGravity] 🌡️ VibeTemp=${atmosphericTemp}K | Pole=${pole}° | Force=${(force * 100).toFixed(0)}% | Hue: ${hue.toFixed(0)}° → ${resultHue.toFixed(0)}°`);
    // }
    return resultHue;
}
// ============================================================
// 5. LA CLASE PRINCIPAL - SELENE COLOR ENGINE
// ============================================================
/**
 * 🎨 SELENE COLOR ENGINE
 *
 * Motor procedural determinista para generación de paletas cromáticas.
 * Convierte análisis musical en colores coherentes.
 *
 * @example
 * ```typescript
 * const palette = SeleneColorEngine.generate({
 *   energy: 0.34,
 *   wave8: {
 *     harmony: { key: 'A', mode: 'minor', mood: 'tense' },
 *     rhythm: { syncopation: 0.27 },
 *     genre: { primary: 'techno' },
 *     section: { type: 'drop' }
 *   }
 * });
 *
 * console.log(palette.primary); // { h: 255, s: 57, l: 40 }
 * console.log(palette.meta.macroGenre); // 'ELECTRONIC_4X4'
 * ```
 */
export class SeleneColorEngine {
    /**
     * 🔬 WAVE 65: CHROMATIC AUDIT LOG
     *
     * Log compacto en formato JSON que se dispara SOLO cuando:
     * - Cambia la key musical
     * - Cambia la estrategia de color
     * - Cambia el vibe activo
     * - O han pasado 3 segundos desde el último log
     *
     * @param data - Datos del análisis actual
     * @param palette - Paleta generada
     * @param vibeId - ID del vibe activo
     * @param overrideReason - Razón del override si aplica
     */
    static logChromaticAudit(data, palette, vibeId = 'unknown', overrideReason = null) {
        const currentKey = data.key || 'null';
        const currentStrategy = palette.meta.strategy;
        // Decrementar cooldown
        if (this.logCooldownFrames > 0) {
            this.logCooldownFrames--;
        }
        // Solo loguear si algo cambió O pasó el cooldown
        const keyChanged = currentKey !== this.lastLoggedKey;
        const strategyChanged = currentStrategy !== this.lastLoggedStrategy;
        const vibeChanged = vibeId !== this.lastLoggedVibe;
        const cooldownExpired = this.logCooldownFrames === 0;
        if (keyChanged || strategyChanged || vibeChanged || cooldownExpired) {
            // Calcular temperatura en Kelvin aproximada
            // Warm = 2700-3500K, Neutral = 4000-5000K, Cool = 5500-6500K
            let tempKelvin = 4500;
            // 🔥 WAVE 68: HARD CLAMP FINAL - Si el vibe es Latino, forzar temperatura cálida
            // Esto es un failsafe adicional al clamp en generate()
            const isLatinoVibe = vibeId.toLowerCase().includes('latin') || vibeId.toLowerCase().includes('fiesta');
            let effectiveTemp = palette.meta.temperature;
            if (isLatinoVibe && effectiveTemp !== 'warm') {
                effectiveTemp = 'warm'; // Forzar cálido para vibes Latino
            }
            if (effectiveTemp === 'warm') {
                tempKelvin = 3000 + Math.floor(palette.primary.h / 360 * 500);
            }
            else if (effectiveTemp === 'cool') {
                tempKelvin = 5500 + Math.floor((360 - palette.primary.h) / 360 * 1000);
            }
            // 🔥 WAVE 68: Clamp final de temperatura para Latino
            if (isLatinoVibe) {
                tempKelvin = Math.min(tempKelvin, 4500); // Máximo 4500K para Latino
            }
            const audit = {
                vibe: vibeId,
                key: currentKey,
                strategy: currentStrategy,
                reason: overrideReason || 'vibe_optimal',
                temp: tempKelvin,
                mood: data.mood || 'neutral',
                hue: Math.round(palette.primary.h),
                sat: Math.round(palette.primary.s),
                light: Math.round(palette.primary.l), // 🛡️ WAVE 83: Añadido L para diagnóstico completo
                energy: Math.round(data.energy * 100)
            };
            // 🔇 WAVE 982.5: Silenciado (arqueología del día 2)
            // console.log(`[COLOR_AUDIT] 🎨 ${JSON.stringify(audit)}`);
            // Actualizar tracking
            this.lastLoggedKey = currentKey;
            this.lastLoggedStrategy = currentStrategy;
            this.lastLoggedVibe = vibeId;
            this.logCooldownFrames = this.LOG_COOLDOWN;
        }
    }
    /**
     * Genera una paleta cromática completa a partir del análisis de audio
     *
     * @param data - Análisis de audio extendido (ExtendedAudioAnalysis)
     * @param options - Opciones de generación (WAVE 142: Vibe Constraints)
     * @returns Paleta de 5 colores HSL con metadata
     */
    static generate(data, options) {
        // 🎯 WAVE 2096.1: Deterministic frame counter (replaces Math.random for log throttling)
        this.generateCallCount++;
        // === A. EXTRAER DATOS CON FALLBACKS ===
        const wave8 = data.wave8 || {
            harmony: { key: null, mode: 'minor', mood: 'universal' },
            rhythm: { syncopation: 0 },
            genre: { primary: 'unknown' },
            section: { type: 'unknown' },
        };
        const key = wave8.harmony.key || data.key || null;
        const mode = wave8.harmony.mode || 'minor';
        const mood = wave8.harmony.mood || data.mood || 'universal';
        const syncopation = wave8.rhythm.syncopation ?? data.syncopation ?? 0;
        const energy = clamp(data.energy ?? 0.5, 0, 1);
        // 🎨 WAVE 90: Detectar vibeId temprano (necesario para Golden Reversal)
        const vibeId = data.vibeId || 'idle';
        // === B. DETERMINAR HUE BASE (Matemática Pura) ===
        // 🎨 WAVE 68.5: PURE COLOR - Solo Key, Mode y Mood
        // NO género, NO bias, solo matemática musical pura
        // 🔥 WAVE 74: MOOD OVERRIDE - Si mood es 'bright', forzar Hue cálido
        // 🎯 WAVE 161.5: LATINO EXCEPTION - No restringir hue para permitir triadic
        let baseHue = 120; // Default: Verde (neutro)
        let hueSource = 'default';
        // 🎯 WAVE 161.5: Detectar si es Latino para NO restringir hue
        const isLatinoHueFree = vibeId.includes('latin') || vibeId.includes('fiesta') ||
            vibeId.includes('cumbia') || vibeId.includes('salsa') ||
            vibeId.includes('reggae');
        // ═══════════════════════════════════════════════════════════════════════
        // 🔓 WAVE 285.5: KEY IDENTITY LIBERATION
        // ═══════════════════════════════════════════════════════════════════════
        // ANTES (WAVE 74): mood 'bright' → keyHue % 60 → DESTRUÍA la identidad de Key
        //   - D major (60°) → 0° (rojo)
        //   - E major (120°) → 0° (rojo)
        //   - A major (270°) → 30° (naranja)
        //   ¡TODAS las keys major colapsaban a solo 2 valores!
        //
        // AHORA: La Key SIEMPRE determina el Hue base. El mood y la constitución
        // (thermalGravity + hueRemapping + forbiddenHueRanges) ajustan el resultado
        // SIN destruir la identidad cromática de la Key.
        //
        // La temperatura y la estrategia son FILTROS, no DICTADORES.
        // ═══════════════════════════════════════════════════════════════════════
        if (key && KEY_TO_HUE[key] !== undefined) {
            // Comportamiento original: Key determina Hue
            // 🎯 WAVE 161.5: Latino SIEMPRE usa este path (Key completa)
            baseHue = KEY_TO_HUE[key];
            // 🌴 WAVE 162: TROPICAL BIAS - Latino rota keys frías hacia cálidos
            // Problema: A=270°, E=120°, F=150° son fríos, pero Latino quiere fiesta
            // Solución: Keys en zona fría (150-270°) rotan hacia zona cálida
            if (isLatinoHueFree && baseHue >= 150 && baseHue <= 270) {
                // Rotar hacia zona tropical: 0-60° (rojos/naranjas) o 300-360° (magentas)
                // Alternar según paridad del root para variedad
                const root = KEY_TO_ROOT[key] ?? 0;
                if (root % 2 === 0) {
                    // Par: Rotar hacia naranjas (30-50°)
                    baseHue = 30 + (baseHue % 30); // 30-59°
                }
                else {
                    // Impar: Rotar hacia magentas (300-330°)
                    baseHue = 300 + (baseHue % 30); // 300-329°
                }
            }
            hueSource = isLatinoHueFree ? `key:${key}(tropical-bias)` : `key:${key}`;
        }
        else if (mood && MOOD_HUES[mood] !== undefined) {
            baseHue = MOOD_HUES[mood];
            hueSource = `mood:${mood}`;
        }
        // === C. APLICAR MODIFICADORES DE MODO ===
        // Solo aplicamos el modifier del modo musical (major/minor)
        const modeMod = MODE_MODIFIERS[mode] || MODE_MODIFIERS['minor'];
        // El Hue final es: Base + Modo (SIN GÉNERO)
        let finalHue = normalizeHue(baseHue + modeMod.hue);
        // 🌡️ WAVE 149.6: THERMAL GRAVITY - Aplicar Gravedad Térmica
        // Antes de restricciones constitucionales, el hue se aclimata al clima del Vibe.
        // Techno (9500K) → arrastra hacia Azul Rey (240°)
        // Latino (3000K) → arrastra hacia Oro (40°)
        // Idle (6500K) → sin gravedad (neutro)
        // 🌬️ WAVE 284: Ahora usa thermalGravityStrength configurable
        finalHue = applyThermalGravity(finalHue, options?.atmosphericTemp, options?.thermalGravityStrength);
        // ═══════════════════════════════════════════════════════════════════════
        // 🏛️ WAVE 144: CONSTITUTIONAL HUE ENFORCEMENT
        // ═══════════════════════════════════════════════════════════════════════
        // Aplicar las restricciones de hue según la Constitución del Vibe activo.
        // Orden de aplicación:
        //   1. hueRemapping (mapeos forzados)
        //   2. forbiddenHueRanges (Elastic Rotation)
        //   3. allowedHueRanges (snap to nearest)
        // ═══════════════════════════════════════════════════════════════════════
        // 1️⃣ HUE REMAPPING: Mapeos forzados de zonas cromáticas
        // Ejemplo: Rock mapea verde (80-160) → rojo (0)
        let remapApplied = false;
        if (options?.hueRemapping) {
            for (const mapping of options.hueRemapping) {
                const { from, to, target } = mapping;
                const isInRange = from <= to
                    ? (finalHue >= from && finalHue <= to)
                    : (finalHue >= from || finalHue <= to); // wrap-around
                if (isInRange) {
                    finalHue = normalizeHue(target);
                    remapApplied = true;
                    break; // Solo aplicar el primer match
                }
            }
        }
        // 2️⃣ FORBIDDEN HUE RANGES: Elastic Rotation
        // Si el hue cae en zona prohibida, rotar hasta escapar
        const elasticStep = options?.elasticRotation ?? 15; // grados por iteración
        const maxIterations = Math.ceil(360 / elasticStep); // prevenir loop infinito
        if (options?.forbiddenHueRanges) {
            let iterations = 0;
            let isInForbidden = true;
            while (isInForbidden && iterations < maxIterations) {
                isInForbidden = false;
                for (const [min, max] of options.forbiddenHueRanges) {
                    const normalizedMin = normalizeHue(min);
                    const normalizedMax = normalizeHue(max);
                    // Handle wrap-around (e.g., [330, 30] means 330-360 and 0-30)
                    const isInRange = normalizedMin <= normalizedMax
                        ? (finalHue >= normalizedMin && finalHue <= normalizedMax)
                        : (finalHue >= normalizedMin || finalHue <= normalizedMax);
                    if (isInRange) {
                        // Elastic Rotation: rotar +elasticStep grados
                        finalHue = normalizeHue(finalHue + elasticStep);
                        isInForbidden = true;
                        iterations++;
                        break;
                    }
                }
            }
        }
        // 3️⃣ ALLOWED HUE RANGES: Snap to nearest
        // Si el hue cae fuera de todos los rangos permitidos, ir al más cercano
        // ⚠️ WAVE 286 BUG FIX: [0, 360] debe significar "todo permitido"
        if (options?.allowedHueRanges && options.allowedHueRanges.length > 0) {
            // 🛡️ CHECK: Si el rango es [0, 360] o similar (abarca todo), skip
            const isFullCircle = options.allowedHueRanges.some(([min, max]) => {
                return (max - min) >= 359 || (min === 0 && max >= 359);
            });
            if (!isFullCircle) {
                let isAllowed = false;
                let closestRange = null;
                let minDistance = Infinity;
                for (const [min, max] of options.allowedHueRanges) {
                    const normalizedMin = normalizeHue(min);
                    const normalizedMax = normalizeHue(max);
                    const isInRange = normalizedMin <= normalizedMax
                        ? (finalHue >= normalizedMin && finalHue <= normalizedMax)
                        : (finalHue >= normalizedMin || finalHue <= normalizedMax);
                    if (isInRange) {
                        isAllowed = true;
                        break;
                    }
                    // Calcular distancia al rango más cercano
                    const distToMin = Math.min(Math.abs(finalHue - normalizedMin), 360 - Math.abs(finalHue - normalizedMin));
                    const distToMax = Math.min(Math.abs(finalHue - normalizedMax), 360 - Math.abs(finalHue - normalizedMax));
                    const distance = Math.min(distToMin, distToMax);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestRange = [normalizedMin, normalizedMax];
                    }
                }
                if (!isAllowed && closestRange) {
                    // Rotar al punto más cercano del rango permitido más cercano
                    const [rangeMin, rangeMax] = closestRange;
                    const distToMin = Math.min(Math.abs(finalHue - rangeMin), 360 - Math.abs(finalHue - rangeMin));
                    const distToMax = Math.min(Math.abs(finalHue - rangeMax), 360 - Math.abs(finalHue - rangeMax));
                    finalHue = distToMin <= distToMax ? rangeMin : rangeMax;
                }
            }
        }
        // === D. ENERGÍA → SATURACIÓN Y BRILLO ===
        // ═══════════════════════════════════════════════════════════════════════
        // 🛡️ WAVE 87: SATURATION GUARD - Evitar "whitewashing"
        // ═══════════════════════════════════════════════════════════════════════
        // PROBLEMA: baseLight llegaba a 95% con alta energía, lavando los colores.
        // SOLUCIÓN: Mantener L cerca del 50% (color puro). La "fuerza" visual
        // vendrá del canal DIMMER (Intensity), no de HSL Lightness.
        // ═══════════════════════════════════════════════════════════════════════
        // 🌴 WAVE 87: Nuevo cálculo de Lightness (más conservador)
        // - Base: 50% (color puro)
        // - Influencia de energía: máximo +10% (antes era +70%)
        // - Rango final: 50-60% (antes 25-95%)
        const baseSat = 85 + (energy * 15); // 🛡️ WAVE 87: Siempre >85%, máx 100%
        const baseLight = 50 + (energy * 10); // 🛡️ WAVE 87: 50-60% (antes 25-95%)
        // Aplicar solo modifiers de modo (SIN GÉNERO BOOST)
        const primarySat = clamp(baseSat + modeMod.sat, 70, // 🛡️ WAVE 87: Mínimo 70% (antes 20%)
        100);
        const primaryLight = clamp(baseLight + modeMod.light, 35, // Mínimo absoluto
        60 // 🛡️ WAVE 87: Máximo 60% (antes 95%) - ANTI-WHITEWASH
        );
        // ═══════════════════════════════════════════════════════════════════════
        // 🛡️ WAVE 81: ANTI-MUD PROTOCOL (VIBRANCY ENFORCEMENT)
        // Evitar que la baja energía cree colores marrones/sucios en contextos festivos.
        // ═══════════════════════════════════════════════════════════════════════
        // Variables mutables para permitir corrección Anti-Mud
        let correctedSat = primarySat;
        let correctedLight = primaryLight;
        // Detectar si el contexto requiere pureza de color (mood festivo)
        const isFestiveContext = mood === 'bright' ||
            mood === 'energetic' ||
            mood === 'euphoric';
        // Detectar contexto oscuro (Techno, Dark, etc)
        const isDarkContext = mood === 'dark';
        if (isFestiveContext) {
            // 1. Detección de "Zona de Peligro Marrón" (Naranjas/Amarillos oscuros)
            // Hue 20-55 es naranja/amarillo. Si L < 0.45, se ve marrón/sucio.
            const isDangerZone = finalHue > 20 && finalHue < 55;
            if (isDangerZone) {
                // 🎨 FORZAR LUMINOSIDAD MÍNIMA:
                // Mantenemos el pigmento vivo. Si la energía baja, que baje el DIMMER,
                // pero NO la luminosidad del color HSL.
                correctedLight = Math.max(correctedLight, 45);
                // 🎨 BOOST DE SATURACIÓN:
                // Los amarillos/naranjas necesitan mucha saturación para no parecer beige.
                correctedSat = Math.max(correctedSat, 80);
            }
            else {
                // Suelo general para vibes festivas (evitar grises en cualquier hue)
                correctedLight = Math.max(correctedLight, 30);
                correctedSat = Math.max(correctedSat, 60);
            }
        }
        if (isDarkContext) {
            // 2. TECHNO / DARK CONTEXT (Permitir oscuridad, pero evitar lavado)
            // Permitir L bajo (deep colors), pero mantener S alta para colores "neón"
            correctedSat = Math.max(correctedSat, 70);
        }
        // Aplicar clamps finales
        // 🛡️ WAVE 87: Límites más estrictos para evitar whitewashing
        // 🎛️ WAVE 142: GenerationOptions pueden sobrescribir estos límites
        const satMin = options?.saturationRange?.[0] ?? 70;
        const satMax = options?.saturationRange?.[1] ?? 100;
        const lightMin = options?.lightnessRange?.[0] ?? 35;
        const lightMax = options?.lightnessRange?.[1] ?? 60;
        correctedSat = clamp(correctedSat, satMin, satMax);
        correctedLight = clamp(correctedLight, lightMin, lightMax);
        // ═══════════════════════════════════════════════════════════════════════
        // 🌊 WAVE 1072: THE OCEAN TRANSLATOR - Oceanic Modulation
        // ═══════════════════════════════════════════════════════════════════════
        // Si oceanicModulation está activo, modulamos el hue, sat y light
        // basándonos en la profundidad oceánica traducida a contexto musical.
        // Esto reemplaza el viejo "colorOverride" que bypaseaba el engine.
        // ═══════════════════════════════════════════════════════════════════════
        if (options?.oceanicModulation?.enabled) {
            const ocean = options.oceanicModulation;
            // 1. HUE BLEND: Mezclar hue actual con influencia oceánica
            // La fuerza determina cuánto "arrastra" el océano el color hacia su sugestión
            const hueDiff = ocean.hueInfluence - finalHue;
            // Normalizar la diferencia para el camino más corto en el círculo
            const normalizedDiff = ((hueDiff + 180) % 360) - 180;
            finalHue = normalizeHue(finalHue + normalizedDiff * ocean.hueInfluenceStrength);
            // 2. SATURATION MOD: Aplicar modificador oceánico
            correctedSat = clamp(correctedSat + ocean.saturationMod, satMin, satMax);
            // 3. LIGHTNESS MOD: Aplicar modificador oceánico
            correctedLight = clamp(correctedLight + ocean.lightnessMod, lightMin, lightMax);
            // 4. BREATHING: Modulación sutil por audio (±15%)
            // Afecta tanto saturación como luminosidad para "pulso vital"
            const breathDelta = (ocean.breathingFactor - 1.0) * 10; // ±1.5 aprox
            correctedSat = clamp(correctedSat + breathDelta, satMin, satMax);
            correctedLight = clamp(correctedLight + breathDelta * 0.5, lightMin, lightMax);
            // Log de modulación oceánica (deterministic throttle — ~1% of frames)
            // 🎯 WAVE 2096.1: Replaced Math.random() with deterministic counter (Axiom Anti-Simulación)
            if (this.generateCallCount % 100 === 0) {
                console.log(`[🌊 OCEAN→COLOR] Zone:${ocean.zone ?? '?'} Depth:${ocean.depth?.toFixed(0) ?? '?'}m | ` +
                    `Hue:${finalHue.toFixed(0)}° (influence:${ocean.hueInfluence.toFixed(0)}° @${(ocean.hueInfluenceStrength * 100).toFixed(0)}%) | ` +
                    `S:${correctedSat.toFixed(0)} L:${correctedLight.toFixed(0)}`);
            }
        }
        // === E. COLOR PRIMARIO ===
        // 🛡️ WAVE 81: Usar valores corregidos por Anti-Mud Protocol
        const primary = {
            h: finalHue,
            s: correctedSat,
            l: correctedLight,
        };
        // === F. COLOR SECUNDARIO (Rotación Fibonacci) ===
        // 🎨 WAVE 90: GOLDEN REVERSAL - Rotación condicional para fiesta-latina
        // - Default: φ × 360° ≈ 222.5° (Golden Angle B) → Azules/Morados
        // - Fiesta Latina: 360° - 222.5° = 137.5° (Golden Angle A) → Verdes/Violetas
        // Esto nos libera del lock artificial, la naturaleza matemática hace el trabajo.
        const isLatinoVibe = vibeId === 'fiesta-latina';
        const fibonacciRotation = isLatinoVibe ? 137.5 : PHI_ROTATION; // 137.5° o 222.5°
        // 🛡️ WAVE 81: Usar valores corregidos como base
        // 🧂 WAVE 94.2: SALT CROMÁTICO (Diferenciación de Gemelas)
        // F Major y A Major naturalmente caen en zonas similares tras warm filter
        // F Major (root 5): Empuja hacia LIMA/Verde (-35°)
        // A Major (root 9): Empuja hacia ROSA MIAMI/Magenta (+35°)
        let saltRotation = 0;
        if (isLatinoVibe && key) {
            const keyIndex = KEY_TO_ROOT[key]; // 0=C, 5=F, 9=A
            if (keyIndex === 5)
                saltRotation = -35; // F → Lima
            else if (keyIndex === 9)
                saltRotation = +35; // A → Miami Pink
        }
        const secondaryHue = normalizeHue(finalHue + fibonacciRotation + saltRotation);
        const secondary = {
            h: secondaryHue,
            s: clamp(correctedSat + 5, 20, 100), // Ligeramente más saturado
            l: clamp(correctedLight - 10, 20, 80), // Ligeramente más oscuro
        };
        // 🏛️ WAVE 94.3: MINT & NAVY OVERRIDE (Luxury Signatures)
        // F Major y A Major obtienen colores signature de lujo en lugar de rotación
        // F Major -> MINT (160°) | A Major -> NAVY (230°)
        // El TROPICAL MIRROR (WAVE 85) luego creará los complementarios automáticamente
        if (isLatinoVibe && key) {
            const keyIndex = KEY_TO_ROOT[key]; // 0=C, 5=F, 9=A
            if (keyIndex === 5) {
                // F MAJOR -> MINT & BERRY
                secondary.h = 160; // Verde Menta / Espuma de mar
                secondary.s = Math.min(secondary.s, 85); // Saturación pastel/menta
            }
            else if (keyIndex === 9) {
                // A MAJOR -> NAVY & GOLD
                secondary.h = 230; // Azul Marino / Royal Blue
                // Saturación alta mantenida para azul eléctrico
            }
            // Nota: ambient.h se recalcula en WAVE 85 TROPICAL MIRROR (secondary.h + 180)
        }
        // === G. COLOR DE ACENTO (Estrategia de Contraste) ===
        // 🎨 WAVE 91: STRATEGY THRESHOLDS - Alineado con StrategyArbiter (0.40-0.65)
        // Expandimos zona triadic para que sea más alcanzable en música latina
        // 🎛️ WAVE 142: forceStrategy puede sobrescribir la decisión
        let accentHue;
        let strategy;
        // WAVE 142: Si hay estrategia forzada, usarla
        if (options?.forceStrategy && options.forceStrategy !== 'prism') {
            strategy = options.forceStrategy;
            switch (strategy) {
                case 'analogous':
                    accentHue = finalHue + 30;
                    break;
                case 'triadic':
                    accentHue = finalHue + 120;
                    break;
                case 'complementary':
                    accentHue = finalHue + 180;
                    break;
            }
        }
        else if (options?.forceStrategy === 'prism') {
            // 🔮 PRISM: Estrategia especial de Techno (Tetraédrica)
            // Primary → Secondary (+60°) → Ambient (+120°) → Accent (+180°)
            strategy = 'complementary'; // Label para metadata
            accentHue = finalHue + 180;
        }
        else {
            // Decisión basada solo en syncopation
            if (syncopation < 0.40) {
                strategy = 'analogous';
                accentHue = finalHue + 30; // Vecino
            }
            else if (syncopation < 0.65) {
                strategy = 'triadic';
                accentHue = finalHue + 120; // Triángulo
            }
            else {
                strategy = 'complementary';
                accentHue = finalHue + 180; // Opuesto
            }
        }
        const accent = {
            h: normalizeHue(accentHue),
            s: 100, // Beams siempre a máxima saturación
            l: Math.max(70, primaryLight + 20), // Siempre brillante
        };
        // ═══════════════════════════════════════════════════════════════════════
        // 🌴 WAVE 84: AMBIENT STEREO MODE + PALETA CARIBEÑA
        // ═══════════════════════════════════════════════════════════════════════
        // ANTES: Ambient era una copia desaturada del Primary (aburrido)
        // AHORA: Ambient es un COLOR INDEPENDIENTE según la estrategia:
        //   - Triadic: 3er punto del triángulo cromático
        //   - Complementary: Split-Complementary (+30° del secondary)
        //   - Analogous: -30° del primary
        //
        // PALETA CARIBEÑA: En vibes latinas, permitir Secondary/Ambient FRÍOS
        // (Verde/Turquesa/Magenta) mientras Primary se mantiene cálido.
        // ═══════════════════════════════════════════════════════════════════════
        // Detectar si es vibe tropical
        const isTropicalVibe = vibeId.toLowerCase().includes('latin') ||
            vibeId.toLowerCase().includes('fiesta') ||
            vibeId.toLowerCase().includes('reggae') ||
            vibeId.toLowerCase().includes('cumbia') ||
            vibeId.toLowerCase().includes('salsa');
        // 🌴 WAVE 84: Calcular Ambient Hue según estrategia
        let ambientHue;
        switch (strategy) {
            case 'triadic':
                // 3er punto del triángulo: +240° (o -120°) del primary
                ambientHue = normalizeHue(finalHue + 240);
                break;
            case 'complementary':
                // Split-Complementary: Secondary +30°
                ambientHue = normalizeHue(secondaryHue + 30);
                break;
            case 'analogous':
            default:
                // Vecino opuesto: -30° del primary
                ambientHue = normalizeHue(finalHue - 30);
                break;
        }
        // 🌴 WAVE 84: Para vibes tropicales, empujar Ambient hacia gama fría
        // si el Primary es cálido (para crear contraste Tierra/Selva)
        if (isTropicalVibe) {
            const isPrimaryWarm = (finalHue >= 0 && finalHue <= 60) || finalHue >= 300;
            if (isPrimaryWarm) {
                // Primary es cálido (naranja/rojo) → Ambient va a VERDE/TURQUESA/MAGENTA
                // Rotar hacia zona fría (150°-200° = verde/turquesa) o (280°-320° = magenta)
                const tropicalOptions = [
                    normalizeHue(finalHue + 150), // Hacia verde
                    normalizeHue(finalHue + 180), // Hacia turquesa
                    normalizeHue(finalHue + 270), // Hacia magenta
                ];
                // Elegir según energía (más energía = más magenta/contraste)
                const optionIndex = energy > 0.7 ? 2 : (energy > 0.4 ? 1 : 0);
                ambientHue = tropicalOptions[optionIndex];
            }
        }
        const ambient = {
            h: ambientHue,
            s: clamp(correctedSat - 10, 40, 90), // Saturación media-alta (no lavado)
            l: clamp(correctedLight - 5, 30, 70), // Luminosidad media
        };
        // ═══════════════════════════════════════════════════════════════════════
        // 🏛️ WAVE 144: SMART PRISM LOGIC (4th Color Algorithm)
        // ═══════════════════════════════════════════════════════════════════════
        // El Ambient debe ser DISTINTO del Secondary y respetar la Constitución.
        // Si cae en zona prohibida, aplicar Elastic Rotation hasta encontrar hueco.
        // ═══════════════════════════════════════════════════════════════════════
        // 1️⃣ PRISM MODE: Si strategy es 'prism', recalcular ambient como tetraédrico
        if (options?.forceStrategy === 'prism') {
            // Tetraedro cromático: Primary → +90° → +180° → +270°
            ambient.h = normalizeHue(finalHue + 90); // 90° del primary (no del secondary)
            ambient.s = 100; // Saturación máxima para prisma
            ambient.l = 35; // Oscuro para "suelo UV"
        }
        // 2️⃣ AMBIENT LOCK: Bloquear ambient en color fijo (UV Floor de Techno)
        if (options?.ambientLock) {
            ambient.h = options.ambientLock.h;
            ambient.s = options.ambientLock.s;
            ambient.l = options.ambientLock.l;
        }
        // 3️⃣ TROPICAL MIRROR: Ambient = Secondary + 180° (máximo contraste Latino)
        if (options?.tropicalMirror) {
            ambient.h = normalizeHue(secondary.h + 180);
            ambient.s = Math.max(secondary.s, 70); // Mantener saturado
            ambient.l = clamp(secondary.l * 1.1, 40, 60); // Variación sutil
        }
        // 4️⃣ ELASTIC ROTATION para Ambient (si hay zonas prohibidas)
        if (options?.forbiddenHueRanges && !options?.ambientLock) {
            const elasticStep = options.elasticRotation ?? 15;
            const maxIterations = Math.ceil(360 / elasticStep);
            let iterations = 0;
            let isInForbidden = true;
            while (isInForbidden && iterations < maxIterations) {
                isInForbidden = false;
                for (const [min, max] of options.forbiddenHueRanges) {
                    const normalizedMin = normalizeHue(min);
                    const normalizedMax = normalizeHue(max);
                    const isInRange = normalizedMin <= normalizedMax
                        ? (ambient.h >= normalizedMin && ambient.h <= normalizedMax)
                        : (ambient.h >= normalizedMin || ambient.h <= normalizedMax);
                    if (isInRange) {
                        ambient.h = normalizeHue(ambient.h + elasticStep);
                        isInForbidden = true;
                        iterations++;
                        break;
                    }
                }
            }
        }
        // 5️⃣ MINIMUM SEPARATION: Ambient debe estar a mínimo 30° del Secondary
        const hueDistance = Math.abs(ambient.h - secondary.h);
        const shortestDistance = Math.min(hueDistance, 360 - hueDistance);
        if (shortestDistance < 30 && !options?.ambientLock && !options?.tropicalMirror) {
            // Rotar ambient +45° para separarse
            ambient.h = normalizeHue(ambient.h + 45);
        }
        // === I. COLOR CONTRASTE (Siluetas, muy oscuro) ===
        const contrast = {
            h: normalizeHue(finalHue + 180),
            s: 30,
            l: 10,
        };
        // === J. DETERMINAR TEMPERATURA VISUAL ===
        // 🌡️ WAVE 68.5: Temperatura PURA basada solo en HUE
        // Hue 0-60 y 300-360 = warm (reds, oranges, magentas)
        // Hue 180-300 = cool (cyans, blues, purples)
        // Hue 60-180 = neutral/warm (yellows, greens)
        let temperature;
        if ((finalHue >= 0 && finalHue <= 60) || finalHue >= 300) {
            temperature = 'warm';
        }
        else if (finalHue >= 180 && finalHue < 300) {
            temperature = 'cool';
        }
        else {
            temperature = 'neutral';
        }
        // === K. CALCULAR VELOCIDAD DE TRANSICIÓN ===
        // Alta energía = transiciones rápidas
        // Baja energía = transiciones lentas
        const baseTransitionSpeed = 1200; // ms (default moderado)
        const transitionSpeed = mapRange(energy, 0, 1, baseTransitionSpeed * 1.5, // Lento (1800ms)
        baseTransitionSpeed * 0.5 // Rápido (600ms)
        );
        // === L. CONSTRUIR DESCRIPCIÓN ===
        // 🎨 WAVE 68.5: Descripción PURA sin género
        const description = [
            key ? `${key} ${mode}` : mood,
            `${temperature}`,
            `E=${(energy * 100).toFixed(0)}%`,
            `S=${(syncopation * 100).toFixed(0)}%`,
        ].join(' ');
        // ═══════════════════════════════════════════════════════════════════════
        // 🌴 WAVE 85: LATINO PRO - Paleta "Fiesta Latina" de alta calidad
        // vibeId ya declarado arriba (línea ~798)
        // ═══════════════════════════════════════════════════════════════════════
        const isLatinoVibeW85 = vibeId.toLowerCase().includes('latin') ||
            vibeId.toLowerCase().includes('fiesta') ||
            vibeId.toLowerCase().includes('reggaeton') ||
            vibeId.toLowerCase().includes('cumbia');
        if (isLatinoVibeW85) {
            // 🛡️ 1. ANTI-CIENO PROTOCOL (Mud Guard)
            // Detectar zona pantanosa (Hue 15-75: naranjas sucios, verdes oliva)
            // y forzar brillo/saturación para convertir en Oro o Lima vibrante
            const fixDirtyColor = (c) => {
                const isSwamp = c.h > 40 && c.h < 75; // Zona Lima/Oliva
                const isMud = c.h >= 15 && c.h <= 40; // Zona Naranja/Marrón
                if (isSwamp || isMud) {
                    // "Si es pantano, hazlo neón o oro"
                    c.l = Math.max(c.l, 55); // 🛡️ WAVE 87: Reducido de 65 a 55 (evitar whitewash)
                    c.s = Math.max(c.s, 85); // Mucha saturación
                }
            };
            fixDirtyColor(primary);
            fixDirtyColor(secondary);
            fixDirtyColor(ambient);
            // 🪞 2. TROPICAL MIRROR (Stereo Contrast Máximo)
            // Ambient = Complementario exacto del Secondary
            // Esto garantiza Verde↔Magenta, Turquesa↔Coral, Azul↔Naranja
            ambient.h = normalizeHue(secondary.h + 180);
            // Variación en luz para profundidad (no plano)
            // 🛡️ WAVE 87: Limitar luz máxima del ambient
            ambient.l = clamp(secondary.l * 1.1, 40, 60);
            ambient.s = Math.max(secondary.s, 70); // Mantener saturado
            // ☀️ 3. WAVE 288.9: ACCENT = COLOR VIBRANTE (no blanco)
            // ANTES: accent.s = 10 (blanco hospitalario - ¡ELIMINADO!)
            // AHORA: El accent hereda saturación de la Constitución (80-100%)
            // Si queremos "flash blanco" en picos, lo hace LatinoStereoPhysics con brillo
            accent.h = normalizeHue(primary.h + 30); // Hue shifted para contraste con primary
            accent.s = Math.max(80, primary.s); // ✅ Saturación vibrante (mínimo 80%)
            accent.l = clamp(primary.l * 1.1, 55, 75); // Brillo moderado-alto
        }
        // ═══════════════════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════════════
        // 🗑️ WAVE 149: THE SECOND PURGE - TECHNO DICTATORSHIP REMOVED
        // ═══════════════════════════════════════════════════════════════════════
        // PROBLEMA: Bloque "TECHNO DICTATORSHIP" (Wave 96.5) sobrescribía TODA la paleta
        // ignorando completamente la Constitution (TECHNO_CONSTITUTION) definida en
        // colorConstitutions.ts.
        //
        // SÍNTOMAS:
        //   - Ambient FIJO en 275° (Violeta UV) → No reaccionaba al beat
        //   - Accent FIJO en h:190 s:20 l:100 → Blanco nuclear permanente
        //   - Primary FORZADO a Cold Spectrum → Ignoraba Key detection
        //
        // RAZÓN DEL PURGE:
        //   - Contradecía la arquitectura WAVE 147 (Great Purge): 
        //     VibeManager → Constitution → ColorEngine → Physics
        //   - El ColorEngine NO debe tomar decisiones por Vibe, debe RESPETAR
        //     las GenerationOptions que recibe.
        //   - La lógica de "Cold Spectrum" ya está en TECHNO_CONSTITUTION con:
        //     * forbiddenHueRanges: [[0, 75], [330, 360]] (bloquea warm)
        //     * allowedHueRanges: [[110, 302]] (permite cold)
        //   - El strobe del accent debe venir de TechnoStereoPhysics.apply(),
        //     no estar hardcoded.
        //
        // SOLUCIÓN:
        //   - ELIMINAR todo el bloque if(isTechnoVibe)
        //   - Dejar que la Constitution aplique las reglas (forbiddenHueRanges, etc.)
        //   - Dejar que TechnoStereoPhysics controle el strobe del accent
        //   - El ambient ahora fluye con la música dentro del cold spectrum
        //
        // CÓDIGO PURGADO (67 líneas):
        //   ❌ if (isTechnoVibe) { ambient.h=275; primary.h=coldHue; accent.l=100; ... }
        // ═══════════════════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════════════
        // 🛡️ WAVE 149.5: CONSTITUTIONAL ENFORCEMENT - Policía Cromática
        // ═══════════════════════════════════════════════════════════════════════
        // PROBLEMA: Tras eliminar Techno Dictatorship, el accent mostraba 65° (amarillo)
        // violando forbiddenHueRanges: [[0, 75], [330, 360]].
        // 
        // CAUSA: La lógica de forbiddenHueRanges solo se aplicaba al PRIMARY en
        // la sección C (líneas ~880-920), pero SECONDARY, AMBIENT y ACCENT se
        // calculan DESPUÉS con rotaciones Fibonacci/Triadic sin re-validación.
        //
        // SOLUCIÓN: GUARDIÁN FINAL que inspecciona TODOS los colores de la paleta
        // y expulsa cualquier hue que caiga en zona prohibida, usando rotación
        // elástica hasta encontrar zona legal.
        // ═══════════════════════════════════════════════════════════════════════
        if (options?.forbiddenHueRanges) {
            const elasticStep = options.elasticRotation ?? 15;
            const maxIterations = Math.ceil(360 / elasticStep);
            // 1️⃣ POLICÍA DE ZONAS PROHIBIDAS - Revisar CADA color
            [primary, secondary, ambient, accent].forEach(color => {
                let iterations = 0;
                let isInForbidden = true;
                while (isInForbidden && iterations < maxIterations) {
                    isInForbidden = false;
                    for (const [min, max] of options.forbiddenHueRanges) {
                        const normalizedMin = normalizeHue(min);
                        const normalizedMax = normalizeHue(max);
                        const isInRange = normalizedMin <= normalizedMax
                            ? (color.h >= normalizedMin && color.h <= normalizedMax)
                            : (color.h >= normalizedMin || color.h <= normalizedMax);
                        if (isInRange) {
                            // 🚨 ILEGAL - Expulsar con rotación elástica
                            color.h = normalizeHue(color.h + elasticStep);
                            isInForbidden = true;
                            iterations++;
                            break;
                        }
                    }
                }
            });
            // 2️⃣ RESOLUCIÓN DE COLISIONES - Evitar "verde sobre verde"
            // Si Ambient está demasiado cerca de Secondary (< 30°), separarlos
            const minDistance = 30;
            let ambientSecondaryDiff = Math.abs(ambient.h - secondary.h);
            if (ambientSecondaryDiff > 180)
                ambientSecondaryDiff = 360 - ambientSecondaryDiff;
            if (ambientSecondaryDiff < minDistance) {
                // Empujar Ambient +60° para crear contraste real
                ambient.h = normalizeHue(ambient.h + 60);
                // Re-validar que no cayó en zona prohibida tras el empujón
                let iterations = 0;
                let isInForbidden = true;
                while (isInForbidden && iterations < maxIterations) {
                    isInForbidden = false;
                    for (const [min, max] of options.forbiddenHueRanges) {
                        const normalizedMin = normalizeHue(min);
                        const normalizedMax = normalizeHue(max);
                        const isInRange = normalizedMin <= normalizedMax
                            ? (ambient.h >= normalizedMin && ambient.h <= normalizedMax)
                            : (ambient.h >= normalizedMin || ambient.h <= normalizedMax);
                        if (isInRange) {
                            ambient.h = normalizeHue(ambient.h + elasticStep);
                            isInForbidden = true;
                            iterations++;
                            break;
                        }
                    }
                }
            }
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🔌 WAVE 150.5: ALLOW-LIST ENFORCEMENT - Solo lo permitido vive
        // ═══════════════════════════════════════════════════════════════════════
        // PROBLEMA: forbiddenHueRanges bloquea [0,80] pero allowedHueRanges=[110,302]
        // significa que 86° y 98° deberían ser ILEGALES (están fuera de allowed).
        //
        // SOLUCIÓN: Si hay allowedHueRanges, todo lo que esté FUERA es ilegal.
        // Empujar hacia el borde más cercano del rango permitido.
        // ═══════════════════════════════════════════════════════════════════════
        if (options?.allowedHueRanges && options.allowedHueRanges.length > 0) {
            const isInAllowedRange = (hue) => {
                for (const [min, max] of options.allowedHueRanges) {
                    if (min <= max) {
                        if (hue >= min && hue <= max)
                            return true;
                    }
                    else {
                        // Rango que cruza 0° (ej: [330, 30])
                        if (hue >= min || hue <= max)
                            return true;
                    }
                }
                return false;
            };
            const findNearestAllowedHue = (hue) => {
                let nearestHue = hue;
                let minDistance = Infinity;
                for (const [min, max] of options.allowedHueRanges) {
                    // Distancia al borde inferior
                    let distToMin = Math.abs(hue - min);
                    if (distToMin > 180)
                        distToMin = 360 - distToMin;
                    // Distancia al borde superior
                    let distToMax = Math.abs(hue - max);
                    if (distToMax > 180)
                        distToMax = 360 - distToMax;
                    if (distToMin < minDistance) {
                        minDistance = distToMin;
                        nearestHue = min;
                    }
                    if (distToMax < minDistance) {
                        minDistance = distToMax;
                        nearestHue = max;
                    }
                }
                return normalizeHue(nearestHue);
            };
            [primary, secondary, ambient, accent].forEach(color => {
                if (!isInAllowedRange(color.h)) {
                    color.h = findNearestAllowedHue(color.h);
                }
            });
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🗺️ WAVE 150.5: HUE REMAPPING - Transformación de zonas
        // ═══════════════════════════════════════════════════════════════════════
        // PROBLEMA: hueRemapping: [{ from: 90, to: 110, target: 130 }] no se aplicaba.
        // Cualquier verde césped (90-110) debería transformarse en verde láser (130).
        // ═══════════════════════════════════════════════════════════════════════
        if (options?.hueRemapping && options.hueRemapping.length > 0) {
            [primary, secondary, ambient, accent].forEach(color => {
                for (const mapping of options.hueRemapping) {
                    if (color.h >= mapping.from && color.h <= mapping.to) {
                        color.h = mapping.target;
                        break; // Solo aplicar el primer match
                    }
                }
            });
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🌡️ WAVE 150.5: THERMAL GRAVITY PARA TODOS
        // 🌬️ WAVE 284: GRAVITATIONAL RELAXATION - Fuerza configurable
        // ═══════════════════════════════════════════════════════════════════════
        // PROBLEMA: applyThermalGravity solo se aplicaba al PRIMARY (finalHue).
        // Los colores derivados (secondary, ambient, accent) nunca sentían el frío.
        //
        // SOLUCIÓN: Aplicar Thermal Gravity a TODOS los colores de la paleta.
        // WAVE 284: Ahora con thermalGravityStrength configurable por vibe.
        // ═══════════════════════════════════════════════════════════════════════
        if (options?.atmosphericTemp) {
            const gravityStrength = options.thermalGravityStrength;
            secondary.h = applyThermalGravity(secondary.h, options.atmosphericTemp, gravityStrength);
            ambient.h = applyThermalGravity(ambient.h, options.atmosphericTemp, gravityStrength);
            accent.h = applyThermalGravity(accent.h, options.atmosphericTemp, gravityStrength);
        }
        // ═══════════════════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════════════
        // 🔥 WAVE 287: NEON PROTOCOL - "Neon or Nothing"
        // ═══════════════════════════════════════════════════════════════════════
        // Aplicar el protocolo a TODA la paleta para eliminar marrones/mostazas.
        // Los colores en la danger zone se transforman en:
        //   1. NEÓN EXTREMO (alta saturación + luminosidad)
        //   2. BLANCO HIELO (si no pueden ser neón)
        // ═══════════════════════════════════════════════════════════════════════
        const sanitizedPrimary = applyNeonProtocol(primary, options);
        const sanitizedSecondary = applyNeonProtocol(secondary, options);
        const sanitizedAmbient = applyNeonProtocol(ambient, options);
        const sanitizedAccent = applyNeonProtocol(accent, options);
        // ═══════════════════════════════════════════════════════════════════════
        // === M. RETORNAR PALETA COMPLETA ===
        return {
            primary: sanitizedPrimary,
            secondary: sanitizedSecondary,
            accent: sanitizedAccent,
            ambient: sanitizedAmbient,
            contrast,
            meta: {
                strategy: strategy,
                temperature,
                description,
                confidence: 1.0, // 🎨 WAVE 68.5: Confianza siempre 100% (matemática determinista)
                transitionSpeed: Math.round(transitionSpeed),
            },
        };
    }
    /**
     * Genera paleta y convierte a RGB en un solo paso
     * @param data - Análisis de audio extendido
     * @param options - Opciones de generación (WAVE 142)
     */
    static generateRgb(data, options) {
        const palette = this.generate(data, options);
        return {
            ...paletteToRgb(palette),
            meta: palette.meta,
        };
    }
    /**
     * Obtiene el hue base para una key musical
     */
    static getKeyHue(key) {
        return KEY_TO_HUE[key];
    }
    /**
     * Obtiene el modificador de un modo musical
     */
    static getModeModifier(mode) {
        return MODE_MODIFIERS[mode];
    }
}
// 🎯 WAVE 2096.1: Deterministic frame counter for throttled logging (replaces Math.random)
SeleneColorEngine.generateCallCount = 0;
// 🔌 WAVE 65: Smart Logging - Tracking para evitar logs repetitivos
SeleneColorEngine.lastLoggedKey = null;
SeleneColorEngine.lastLoggedStrategy = null;
SeleneColorEngine.lastLoggedVibe = null;
SeleneColorEngine.logCooldownFrames = 0;
SeleneColorEngine.LOG_COOLDOWN = 180; // 3 segundos entre logs similares
// ============================================================
// 6. EXPORTS
// ============================================================
export { KEY_TO_HUE, MOOD_HUES, MODE_MODIFIERS, PHI_ROTATION, normalizeHue, clamp, mapRange, };
// ============================================================
// 7. WAVE 49: COLOR INTERPOLATOR (Smooth Transitions)
// ============================================================
/**
 * 🎨 WAVE 49: SELENE COLOR INTERPOLATOR
 * ====================================
 * Wrapper con estado para interpolación suave de colores.
 * Evita "epilepsia cromática" cuando cambia Key o Mood.
 *
 * REGLAS:
 * - Transición normal: 4 beats (~2 segundos a 120 BPM)
 * - Transición DROP: 0.5 segundos (rápido pero no instantáneo)
 * - NUNCA cambio instantáneo (0 frames)
 * - Reset en nueva canción
 */
export class SeleneColorInterpolator {
    constructor() {
        // Estado actual (lo que se envía a fixtures)
        this.currentPalette = null;
        // Estado objetivo (hacia donde interpolamos)
        this.targetPalette = null;
        // Progreso de interpolación (0 = inicio, 1 = completado)
        this.transitionProgress = 1.0;
        // Velocidad de transición (incremento por frame)
        this.transitionSpeed = 0.02; // ~50 frames = ~0.8s default
        // Configuración
        // WAVE 55: Transiciones lentas para evitar parpadeo en Cumbia
        this.NORMAL_TRANSITION_FRAMES = 240; // 8 beats @ 120bpm @ 60fps ≈ 4s
        this.DROP_TRANSITION_FRAMES = 30; // 0.5 segundos
        this.MIN_TRANSITION_FRAMES = 6; // Mínimo 0.1s (nunca instantáneo)
        // Frame counter para logging
        this.frameCount = 0;
        this.lastLogFrame = 0;
    }
    /**
     * Actualiza el color interpolado cada frame
     *
     * @param targetData - Datos de análisis de audio
     * @param isDrop - Si estamos en un DROP (transición rápida)
     * @param options - GenerationOptions de la Constitución del Vibe activo (WAVE 148)
     * @returns Paleta interpolada para enviar a fixtures
     *
     * 🌊 WAVE 70.5: Tolerancia de jitter - solo resetear transición si cambio > 15°
     * ⚡ WAVE 148: Ahora acepta GenerationOptions para aplicar Constitution
     */
    update(targetData, isDrop = false, options) {
        this.frameCount++;
        // ⚡ WAVE 148: Generar paleta CON las restricciones de la Constitution
        const newTarget = SeleneColorEngine.generate(targetData, options);
        // Si no hay paleta actual, inicializar sin transición
        if (!this.currentPalette) {
            this.currentPalette = newTarget;
            this.targetPalette = newTarget;
            this.transitionProgress = 1.0;
            return newTarget;
        }
        // � WAVE 70.5: Calcular diferencia de Hue con camino más corto en el círculo
        const currentTargetHue = normalizeHue(this.targetPalette.primary.h);
        const newTargetHue = normalizeHue(newTarget.primary.h);
        let hueDiff = Math.abs(currentTargetHue - newTargetHue);
        if (hueDiff > 180)
            hueDiff = 360 - hueDiff; // Camino más corto
        // 🌊 WAVE 70.5: Solo es cambio REAL si supera tolerancia de 15°
        // Evita flicker por jitter/oscilación del análisis
        const isRealChange = hueDiff > 15;
        if (isRealChange) {
            // Cambio significativo de Key/Mood - iniciar nueva transición
            this.targetPalette = newTarget;
            this.transitionProgress = 0;
            // Velocidad según contexto
            const transitionFrames = isDrop ? this.DROP_TRANSITION_FRAMES : this.NORMAL_TRANSITION_FRAMES;
            this.transitionSpeed = 1.0 / Math.max(transitionFrames, this.MIN_TRANSITION_FRAMES);
        }
        else if (hueDiff > 0) {
            // 🌊 WAVE 70.5: Jitter detectado - actualizar target silenciosamente
            // NO reseteamos transitionProgress, permitiendo corrección suave del rumbo
            this.targetPalette = newTarget;
        }
        // Avanzar transición
        if (this.transitionProgress < 1.0) {
            this.transitionProgress = Math.min(1.0, this.transitionProgress + this.transitionSpeed);
            // Interpolar todos los colores de la paleta
            this.currentPalette = this.lerpPalette(this.currentPalette, this.targetPalette, this.transitionProgress);
        }
        return this.currentPalette;
    }
    /**
     * Interpola entre dos paletas completas
     */
    lerpPalette(from, to, t) {
        return {
            primary: this.lerpHSL(from.primary, to.primary, t),
            secondary: this.lerpHSL(from.secondary, to.secondary, t),
            accent: this.lerpHSL(from.accent, to.accent, t),
            ambient: this.lerpHSL(from.ambient, to.ambient, t),
            contrast: this.lerpHSL(from.contrast, to.contrast, t),
            meta: t >= 0.5 ? to.meta : from.meta, // Metadata cambia a mitad de transición
        };
    }
    /**
     * Interpola entre dos colores HSL
     * Usa el camino más corto en el círculo de hue (evita saltos de 350° a 10°)
     *
     * 🔥 WAVE 67.5: DESATURATION DIP
     * Si la diferencia de Hue es > 60°, desaturamos en el punto medio (t ≈ 0.5)
     * Esto crea un efecto de 'lavado' (blanco/gris) en el cruce, evitando el efecto arcoíris sucio
     */
    lerpHSL(from, to, t) {
        // Hue: usar el camino más corto en el círculo
        let hueDiff = to.h - from.h;
        if (hueDiff > 180)
            hueDiff -= 360;
        if (hueDiff < -180)
            hueDiff += 360;
        const h = normalizeHue(from.h + hueDiff * t);
        // S y L: interpolación lineal simple
        let s = from.s + (to.s - from.s) * t;
        const l = from.l + (to.l - from.l) * t;
        // 🔥 WAVE 67.5: DESATURATION DIP
        // Si el salto de hue es grande (> 60°), desaturar en el punto medio
        // Esto evita ver "todos los colores intermedios" (arcoíris sucio)
        const absHueDiff = Math.abs(hueDiff);
        if (absHueDiff > 60) {
            // Curva de desaturación: máximo en t=0.5, mínimo en t=0 y t=1
            // Usamos una función gaussiana centrada en 0.5
            const dipCenter = 0.5;
            const dipWidth = 0.25; // Ancho de la "zona de lavado"
            const distanceFromCenter = Math.abs(t - dipCenter);
            // Si estamos cerca del centro, aplicar desaturación
            if (distanceFromCenter < dipWidth) {
                // Factor de desaturación: 1.0 (sin efecto) → 0.3 (máximo lavado) en el centro
                // Curva suave: 1 - (1 - 0.3) * cos²(...)
                const dipStrength = 0.3; // Saturación mínima en el dip (30% de la original)
                const normalizedDist = distanceFromCenter / dipWidth; // 0 en centro, 1 en bordes
                const dipFactor = dipStrength + (1 - dipStrength) * (normalizedDist * normalizedDist);
                s = s * dipFactor;
            }
        }
        return { h, s, l };
    }
    /**
     * 🧹 WAVE 49: HARD RESET - Limpiar estado para nueva canción
     */
    reset() {
        console.log('[ColorInterpolator] 🧹 RESET: Estado limpiado para nueva canción');
        this.currentPalette = null;
        this.targetPalette = null;
        this.transitionProgress = 1.0;
        this.frameCount = 0;
        this.lastLogFrame = 0;
    }
    /**
     * Obtiene el progreso actual de la transición (0-1)
     */
    getTransitionProgress() {
        return this.transitionProgress;
    }
    /**
     * Comprueba si hay una transición en curso
     */
    isTransitioning() {
        return this.transitionProgress < 1.0;
    }
    /**
     * Fuerza una transición inmediata (para casos especiales)
     * ⚠️ Usar con precaución - puede causar saltos visuales
     */
    forceImmediate(palette) {
        this.currentPalette = palette;
        this.targetPalette = palette;
        this.transitionProgress = 1.0;
    }
}
// Default export
export default SeleneColorEngine;
