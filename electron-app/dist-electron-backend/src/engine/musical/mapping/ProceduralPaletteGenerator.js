/**
 * 🎨 PROCEDURAL PALETTE GENERATOR
 * ================================
 * Generador de paletas cromáticas basado en ADN musical
 *
 * PRINCIPIO FUNDAMENTAL:
 * "No le decimos a Selene qué colores usar.
 *  Le enseñamos a SENTIR la música y PINTAR lo que siente."
 *
 * FUNDAMENTOS:
 * - Círculo de Quintas → Círculo Cromático (Sinestesia)
 * - Modo → Temperatura emocional
 * - Energía → Estrategia de contraste
 * - Sincopación → Saturación del secundario
 *
 * Blueprint: BLUEPRINT-SELENE-CHROMATIC-FORMULA.md
 *
 * @module engines/musical/mapping/ProceduralPaletteGenerator
 */
import { EventEmitter } from 'events';
// ============================================================
// CONSTANTES - EL CORAZÓN DE LA FÓRMULA CROMÁTICA
// ============================================================
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
 * 🌡️ MODIFICADORES DE MODO
 *
 * Cada modo tiene una "temperatura" emocional que modifica
 * la saturación, luminosidad y hue del color base.
 */
const MODE_MODIFIERS = {
    // Modos mayores - Cálidos y brillantes
    'major': {
        saturationDelta: 15,
        lightnessDelta: 10,
        hueDelta: 15,
        emotionalWeight: 0.8,
        description: 'Alegre y brillante'
    },
    'ionian': {
        saturationDelta: 15,
        lightnessDelta: 10,
        hueDelta: 15,
        emotionalWeight: 0.8,
        description: 'Alegre y brillante'
    },
    'lydian': {
        saturationDelta: 20,
        lightnessDelta: 15,
        hueDelta: 25,
        emotionalWeight: 0.7,
        description: 'Etéreo y soñador'
    },
    'mixolydian': {
        saturationDelta: 10,
        lightnessDelta: 5,
        hueDelta: 10,
        emotionalWeight: 0.6,
        description: 'Funky y cálido'
    },
    // Modos menores - Fríos y profundos
    'minor': {
        saturationDelta: -10,
        lightnessDelta: -15,
        hueDelta: -15,
        emotionalWeight: 0.7,
        description: 'Triste y melancólico'
    },
    'aeolian': {
        saturationDelta: -10,
        lightnessDelta: -15,
        hueDelta: -15,
        emotionalWeight: 0.7,
        description: 'Triste y melancólico'
    },
    'dorian': {
        saturationDelta: 5,
        lightnessDelta: 0,
        hueDelta: -5,
        emotionalWeight: 0.6,
        description: 'Jazzy y sofisticado'
    },
    'phrygian': {
        saturationDelta: -5,
        lightnessDelta: -10,
        hueDelta: -20,
        emotionalWeight: 0.9,
        description: 'Español y tenso'
    },
    'locrian': {
        saturationDelta: -15,
        lightnessDelta: -20,
        hueDelta: -30,
        emotionalWeight: 0.5,
        description: 'Oscuro y disonante'
    },
    // Escalas especiales
    'harmonic_minor': {
        saturationDelta: -5,
        lightnessDelta: -10,
        hueDelta: -10,
        emotionalWeight: 0.8,
        description: 'Dramático y exótico'
    },
    'melodic_minor': {
        saturationDelta: 0,
        lightnessDelta: -5,
        hueDelta: -5,
        emotionalWeight: 0.6,
        description: 'Jazz avanzado'
    },
    'pentatonic_major': {
        saturationDelta: 10,
        lightnessDelta: 5,
        hueDelta: 10,
        emotionalWeight: 0.5,
        description: 'Simple y folk'
    },
    'pentatonic_minor': {
        saturationDelta: 5,
        lightnessDelta: -5,
        hueDelta: 0,
        emotionalWeight: 0.5,
        description: 'Blues y rock'
    },
    'blues': {
        saturationDelta: 5,
        lightnessDelta: -10,
        hueDelta: -10,
        emotionalWeight: 0.7,
        description: 'Bluesy y soul'
    },
};
/**
 * 📊 VARIACIONES POR SECCIÓN
 *
 * Cada sección modifica la intensidad y presencia
 * de los colores sin cambiar la paleta base.
 */
const SECTION_VARIATIONS = {
    'intro': {
        primaryLightnessShift: -20,
        secondaryLightnessShift: -15,
        accentIntensity: 0.3,
        ambientPresence: 0.7,
    },
    'verse': {
        primaryLightnessShift: -10,
        secondaryLightnessShift: -5,
        accentIntensity: 0.5,
        ambientPresence: 0.5,
    },
    'pre_chorus': {
        primaryLightnessShift: 0,
        secondaryLightnessShift: 5,
        accentIntensity: 0.7,
        ambientPresence: 0.4,
    },
    'chorus': {
        primaryLightnessShift: 15,
        secondaryLightnessShift: 20,
        accentIntensity: 1.0,
        ambientPresence: 0.3,
    },
    'drop': {
        primaryLightnessShift: 20,
        secondaryLightnessShift: 25,
        accentIntensity: 1.0,
        ambientPresence: 0.1, // Casi sin ambiente, puro impacto
    },
    'buildup': {
        primaryLightnessShift: 5,
        secondaryLightnessShift: 10,
        accentIntensity: 0.8,
        ambientPresence: 0.3,
    },
    'breakdown': {
        primaryLightnessShift: -15,
        secondaryLightnessShift: -10,
        accentIntensity: 0.4,
        ambientPresence: 0.6,
    },
    'bridge': {
        primaryLightnessShift: -5,
        secondaryLightnessShift: 10,
        accentIntensity: 0.6,
        ambientPresence: 0.6,
    },
    'outro': {
        primaryLightnessShift: -15,
        secondaryLightnessShift: -20,
        accentIntensity: 0.2,
        ambientPresence: 0.8,
    },
    'unknown': {
        primaryLightnessShift: 0,
        secondaryLightnessShift: 0,
        accentIntensity: 0.5,
        ambientPresence: 0.5,
    },
};
/**
 * 🔮 WAVE 13.5: THE SOUL CONNECTION - Valores por defecto con influencias esotéricas
 * Key define el color, Energy solo el brillo/saturación, Zodiaco empuja el hue
 */
const DEFAULT_DNA = {
    key: null, // Si null, usamos MOOD para determinar el color
    mode: 'major',
    energy: 0.5,
    syncopation: 0.3,
    mood: 'neutral', // 🧠 WAVE 13: Mood es el respaldo cuando no hay Key
    section: 'unknown',
    zodiacElement: undefined, // 🔮 WAVE 13.5: Elemento zodiacal (opcional)
};
/**
 * 🧠 WAVE 13: MOOD → HUE MAPPING
 * Cuando no hay Key detectada, el MOOD define el color base
 * Esto es más inteligente que usar energía pura
 */
const MOOD_TO_HUE = {
    // Moods cálidos → Colores cálidos
    'happy': 45, // Amarillo-Naranja (alegría)
    'energetic': 30, // Naranja (energía)
    'euphoric': 60, // Amarillo (euforia)
    'aggressive': 0, // Rojo (agresión)
    'powerful': 15, // Rojo-Naranja (poder)
    // Moods fríos → Colores fríos
    'sad': 220, // Azul (tristeza)
    'melancholic': 240, // Índigo (melancolía)
    'peaceful': 180, // Cyan (paz)
    'calm': 160, // Verde-Azul (calma)
    'dreamy': 270, // Violeta (sueños)
    // Moods neutros → Colores intermedios
    'neutral': 280, // Magenta (neutral pero interesante)
    'mysterious': 290, // Púrpura (misterio)
    'tense': 300, // Magenta-Rosa (tensión)
    'dark': 250, // Azul-Violeta (oscuridad)
    // Moods especiales
    'groovy': 120, // Verde-Lima (groove)
    'funky': 90, // Lima (funky)
    'epic': 330, // Magenta-Rojo (épico)
};
/**
 * 🔮 WAVE 13.5: ZODIAC ELEMENT → HUE SHIFT
 * El elemento zodiacal empuja el color base hacia su territorio
 * Peso: 30% del color final (menos que Key, más que Energy)
 *
 * "Los astros no obligan, pero inclinan" - Selene escucha su susurro
 */
const ELEMENT_TO_HUE_SHIFT = {
    'fire': 15, // 🔥 Fuego → Empujar hacia Rojo-Naranja
    'water': 210, // 🌊 Agua → Empujar hacia Azul-Cyan
    'air': 55, // 💨 Aire → Empujar hacia Amarillo-Blanco
    'earth': 100, // 🌍 Tierra → Empujar hacia Verde-Ámbar
};
/**
 * 🌀 WAVE 13.5: PHI (Golden Ratio) para rotación secundaria
 * Fibonacci dicta el spacing armónico entre colores
 */
const PHI = 1.618033988749895; // Φ = (1 + √5) / 2
// ============================================================
// FUNCIONES UTILITARIAS
// ============================================================
/**
 * Limita un valor a un rango
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
/**
 * Mapea un valor de un rango a otro
 */
function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}
/**
 * Normaliza un ángulo a 0-360
 */
function normalizeHue(hue) {
    return ((hue % 360) + 360) % 360;
}
/**
 * Convierte HSL a RGB
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
 * Convierte HSL a hex string
 */
export function hslToHex(hsl) {
    const rgb = hslToRgb(hsl);
    return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
}
// ============================================================
// CLASE PRINCIPAL
// ============================================================
/**
 * 🎨 PROCEDURAL PALETTE GENERATOR
 *
 * Genera paletas de color basadas en el ADN musical.
 *
 * Eventos:
 * - 'palette-generated': SelenePalette
 * - 'palette-variation': { section, palette }
 */
export class ProceduralPaletteGenerator extends EventEmitter {
    constructor() {
        super();
        this.lastGeneratedPalette = null;
        this.generationCount = 0;
        this.lastLoggedKeyMode = '';
        // 🔮 WAVE 13.5: Anti-estancamiento
        this.forceMutationNextGen = false;
        this.mutationReason = '';
        console.log('🎨 [PALETTE-GENERATOR] Initialized - Selene can now paint music');
    }
    /**
     * 🔮 WAVE 13.5: FORCE COLOR MUTATION
     * El SelfAnalysisEngine detecta color_fixation y ordena un cambio radical
     *
     * "Me observo a mí misma para ser mejor" - Selene, Gen 1
     */
    forceColorMutation(reason = 'Self-correction') {
        this.forceMutationNextGen = true;
        this.mutationReason = reason;
        console.log(`🧬 [PALETTE-GENERATOR] MUTATION FORCED: ${reason}`);
    }
    /**
     * 🔮 WAVE 13.5: CHECK IF MUTATION NEEDED
     * Returns true if SelfAnalysis forced a mutation
     */
    shouldMutate() {
        return this.forceMutationNextGen;
    }
    /**
     * 🔮 WAVE 13.5: CLEAR MUTATION FLAG
     * Llamar después de aplicar la mutación
     */
    clearMutationFlag() {
        this.forceMutationNextGen = false;
        this.mutationReason = '';
    }
    // ============================================================
    // MÉTODOS DE CONVERSIÓN KEY → HUE
    // ============================================================
    /**
     * 🔮 WAVE 13.5: THE SOUL CONNECTION
     * Convierte ADN musical a un ángulo HSL (Hue) con influencia zodiacal
     *
     * JERARQUÍA DE COLOR:
     * 1. KEY (Círculo de Quintas) - Si existe, es REY
     * 2. MOOD (Estado emocional) - Si no hay Key, el mood decide
     * 3. MODE (Mayor/Menor) - Modifica el hue base
     * 4. ZODIAC ELEMENT - Los astros empujan el color (30% weight)
     *
     * La ENERGÍA ya NO define el color, solo el brillo/saturación
     */
    keyToHue(key, mood, mode, zodiacElement) {
        // 1. Si hay KEY detectada → Círculo de Quintas (COLOR BASE)
        let baseHue;
        if (key) {
            const normalizedKey = key.replace(/[0-9]/g, '').trim();
            const keyHue = KEY_TO_HUE[normalizedKey];
            if (keyHue !== undefined) {
                baseHue = keyHue;
            }
            else {
                // Key inválida → fallback a mood
                const moodNormalized = (mood || 'neutral').toLowerCase();
                baseHue = MOOD_TO_HUE[moodNormalized] ?? 280;
            }
        }
        else {
            // 2. Sin Key → Usar MOOD para determinar el color
            const moodNormalized = (mood || 'neutral').toLowerCase();
            const moodHue = MOOD_TO_HUE[moodNormalized];
            baseHue = moodHue ?? 280; // Fallback a magenta neutral
        }
        // 🔮 WAVE 13.5: ZODIAC ELEMENT SHIFT (30% weight)
        // "Los astros no obligan, pero inclinan"
        if (zodiacElement && ELEMENT_TO_HUE_SHIFT[zodiacElement] !== undefined) {
            const elementTarget = ELEMENT_TO_HUE_SHIFT[zodiacElement];
            // Interpolar 30% hacia el color elemental
            const zodiacInfluence = 0.3;
            baseHue = normalizeHue(baseHue * (1 - zodiacInfluence) + elementTarget * zodiacInfluence);
        }
        // Retornar el hue calculado con todas las influencias
        return baseHue;
    }
    /**
     * Obtiene los modificadores de modo
     */
    getModeModifier(mode) {
        const normalizedMode = mode.toLowerCase().replace(/[^a-z_]/g, '');
        return MODE_MODIFIERS[normalizedMode] ?? MODE_MODIFIERS['major'];
    }
    // ============================================================
    // ESTRATEGIA DE COLOR SECUNDARIO
    // ============================================================
    /**
     * Determina la estrategia de color secundario basada en la energía
     *
     * - Baja energía → Análogos (suaves, armoniosos)
     * - Media energía → Triádicos (equilibrados)
     * - Alta energía → Complementarios (impactantes)
     */
    calculateColorStrategy(energy) {
        if (energy < 0.3) {
            return 'analogous';
        }
        else if (energy < 0.6) {
            return 'triadic';
        }
        else {
            return 'complementary';
        }
    }
    /**
     * Calcula el hue del color secundario
     */
    calculateSecondaryHue(baseHue, energy, syncopation) {
        const strategy = this.calculateColorStrategy(energy);
        let separation;
        switch (strategy) {
            case 'analogous':
                // Colores vecinos (30° de diferencia)
                separation = 30;
                break;
            case 'triadic':
                // Colores en triángulo (120° de diferencia)
                separation = 120;
                break;
            case 'complementary':
                // Colores opuestos (180° de diferencia)
                separation = 180;
                break;
        }
        // La sincopación determina la dirección en el círculo
        // Alta sincopación = hacia adelante (más cálido generalmente)
        const direction = syncopation > 0.5 ? 1 : -1;
        return normalizeHue(baseHue + separation * direction);
    }
    /**
     * Calcula la saturación del color secundario
     * Alta sincopación = más saturación (más "punch" visual)
     */
    calculateSecondarySaturation(baseSaturation, syncopation) {
        const saturationBoost = syncopation * 30; // 0-30% extra
        return clamp(baseSaturation + saturationBoost, 20, 100);
    }
    // ============================================================
    // GENERACIÓN DE PALETA PRINCIPAL
    // ============================================================
    /**
     * 🎨 GENERA UNA PALETA COMPLETA
     *
     * 🧠 WAVE 13: BRAIN UNLOCK
     * Este es el método principal que convierte ADN musical en colores.
     *
     * JERARQUÍA:
     * - KEY/MODE define el HUE (color)
     * - ENERGY define SATURACIÓN y BRILLO
     * - SYNCOPATION define ESTRATEGIA DE CONTRASTE
     *
     * @param dna - ADN musical (key, mode, energy, syncopation, section)
     * @returns SelenePalette - Paleta de 5 colores + metadata
     */
    generatePalette(dna = {}) {
        const fullDNA = { ...DEFAULT_DNA, ...dna };
        // 🔮 WAVE 13.5: COLOR BASE con influencia ZODIACAL
        let baseHue = this.keyToHue(fullDNA.key, fullDNA.mood, fullDNA.mode, fullDNA.zodiacElement);
        // 🧬 WAVE 13.5: FORCED MUTATION - Anti-estancamiento
        // Si SelfAnalysisEngine detectó color_fixation → INVERTIR color (180°)
        if (this.forceMutationNextGen) {
            baseHue = normalizeHue(baseHue + 180);
            console.log(`🧬 [PALETTE-GENERATOR] 🔥 MUTATION APPLIED: ${this.mutationReason} - Hue inverted to ${baseHue.toFixed(0)}°`);
            this.clearMutationFlag();
        }
        // 🔍 DEBUG WAVE 13.5
        if (Math.random() < 0.02) { // 2% de los frames
            const zodiacInfo = fullDNA.zodiacElement ? ` zodiac=${fullDNA.zodiacElement}` : '';
            console.log(`[PaletteGen] 🔮 WAVE 13.5: key=${fullDNA.key || 'null'} mood=${fullDNA.mood}${zodiacInfo} → baseHue=${baseHue.toFixed(0)}° | Energy=${fullDNA.energy.toFixed(2)} (solo brillo)`);
        }
        // 2. MODIFICADORES desde el modo
        const modeModifier = this.getModeModifier(fullDNA.mode);
        // 3. ESTRATEGIA de color desde SYNCOPATION (no energía)
        // Alta sincopación = colores más contrastados (complementarios)
        // Baja sincopación = colores más armoniosos (análogos)
        const colorStrategy = fullDNA.syncopation > 0.5 ? 'complementary' :
            fullDNA.syncopation > 0.25 ? 'triadic' : 'analogous';
        // 🧠 WAVE 13: ENERGY solo controla SATURACIÓN y BRILLO
        // Más energía = colores más VIBRANTES y BRILLANTES (pero mismo Hue!)
        const energySat = 50 + fullDNA.energy * 50; // 50-100% saturación
        const energyLight = 40 + fullDNA.energy * 30; // 40-70% brillo
        // 4. PRIMARY - Color base: KEY/MOOD define hue, MODE modifica, ENERGY da brillo
        const primaryHue = normalizeHue(baseHue + modeModifier.hueDelta);
        const primary = {
            h: primaryHue,
            s: clamp(energySat + modeModifier.saturationDelta, 50, 100),
            l: clamp(energyLight + modeModifier.lightnessDelta, 35, 75),
        };
        // 🌀 WAVE 13.5: SECONDARY - Rotación FIBONACCI (Back PARs)
        // NO usar complementario estático (aburrido)
        // Fibonacci dicta el spacing armónico: secondaryHue = (primary + PHI * 360) % 360
        // Esto crea un desplazamiento áureo (≈222.5°) que rompe el patrón predecible
        const fibonacciRotation = (PHI * 360) % 360; // ≈ 222.5°
        const secondaryHue = normalizeHue(primary.h + fibonacciRotation);
        const secondary = {
            h: secondaryHue,
            s: clamp(energySat + 10, 50, 100), // Ligeramente más saturado
            l: clamp(energyLight + (fullDNA.energy > 0.5 ? 10 : -5), 35, 80),
        };
        // 🧠 WAVE 13: ACCENT - SIEMPRE complementario (180°) para máximo contraste en móviles
        // Este es el color que usarán los Moving Heads
        const accent = {
            h: normalizeHue(primary.h + 180), // Opuesto exacto
            s: clamp(energySat + 20, 60, 100), // Muy saturado
            l: clamp(energyLight + 15, 45, 85), // Más brillante
        };
        // 7. AMBIENT - Desaturado y oscuro para atmósfera
        const ambient = {
            h: primary.h,
            s: clamp(energySat - 30, 15, 45),
            l: clamp(energyLight - 20, 15, 35),
        };
        // 8. CONTRAST - Color terciario para siluetas
        const contrast = {
            h: normalizeHue(primary.h + 120), // Triádico
            s: clamp(energySat - 10, 30, 60),
            l: 20,
        };
        // 9. VELOCIDAD DE TRANSICIÓN según energía
        const transitionSpeed = Math.round(mapRange(fullDNA.energy, 0, 1, 2000, 300));
        // 10. CONFIANZA de la paleta
        const confidence = this.calculatePaletteConfidence(fullDNA);
        // 11. DESCRIPCIÓN legible
        const description = this.generateDescription(fullDNA, modeModifier);
        const palette = {
            primary,
            secondary,
            accent,
            ambient,
            contrast,
            metadata: {
                generatedAt: Date.now(),
                musicalDNA: fullDNA,
                confidence,
                transitionSpeed,
                colorStrategy,
                description,
            },
        };
        // Guardar y emitir
        this.lastGeneratedPalette = palette;
        this.generationCount++;
        this.emit('palette-generated', palette);
        // 🔇 Solo loguear cuando cambia KEY o MODE (no energía)
        const keyModeSignature = `${fullDNA.key || 'Unknown'}-${fullDNA.mode}`;
        if (keyModeSignature !== this.lastLoggedKeyMode) {
            console.log(`🎨 [PALETTE] ${description} (confidence: ${(confidence * 100).toFixed(0)}%)`);
            this.lastLoggedKeyMode = keyModeSignature;
        }
        return palette;
    }
    /**
     * Calcula la confianza de la paleta basada en el DNA
     */
    calculatePaletteConfidence(dna) {
        let confidence = 0.5; // Base
        // Si tenemos key, más confianza
        if (dna.key) {
            confidence += 0.2;
        }
        // Si el modo no es genérico, más confianza
        if (dna.mode !== 'major' && dna.mode !== 'unknown') {
            confidence += 0.1;
        }
        // Si la sección es específica, más confianza
        if (dna.section !== 'unknown') {
            confidence += 0.1;
        }
        // Energía extrema (muy baja o muy alta) da más confianza
        if (dna.energy < 0.2 || dna.energy > 0.8) {
            confidence += 0.1;
        }
        return clamp(confidence, 0, 1);
    }
    /**
     * Genera una descripción legible de la paleta
     */
    generateDescription(dna, modifier) {
        const keyName = dna.key || 'Unknown';
        const modeName = dna.mode.charAt(0).toUpperCase() + dna.mode.slice(1);
        const energyDesc = dna.energy < 0.3 ? 'Baja energía' :
            dna.energy < 0.6 ? 'Energía media' :
                'Alta energía';
        return `${keyName} ${modeName} (${modifier.description}) - ${energyDesc}`;
    }
    // ============================================================
    // VARIACIONES POR SECCIÓN
    // ============================================================
    /**
     * Aplica variaciones de sección a una paleta existente
     *
     * Esto permite variar la intensidad sin cambiar los colores base.
     */
    applySectionVariation(palette, section) {
        const variation = SECTION_VARIATIONS[section] ?? SECTION_VARIATIONS['unknown'];
        const variedPalette = {
            primary: {
                ...palette.primary,
                l: clamp(palette.primary.l + variation.primaryLightnessShift, 10, 95),
            },
            secondary: {
                ...palette.secondary,
                l: clamp(palette.secondary.l + variation.secondaryLightnessShift, 10, 95),
            },
            accent: {
                ...palette.accent,
                s: clamp(palette.accent.s * variation.accentIntensity, 10, 100),
            },
            ambient: {
                ...palette.ambient,
                l: clamp(palette.ambient.l * (1 + (variation.ambientPresence - 0.5)), 5, 40),
            },
            contrast: palette.contrast, // Contraste no varía
            metadata: {
                ...palette.metadata,
                musicalDNA: {
                    ...palette.metadata.musicalDNA,
                    section,
                },
            },
        };
        this.emit('palette-variation', { section, palette: variedPalette });
        return variedPalette;
    }
    // ============================================================
    // MÉTODOS DE UTILIDAD
    // ============================================================
    /**
     * Obtiene la última paleta generada
     */
    getLastPalette() {
        return this.lastGeneratedPalette;
    }
    /**
     * Obtiene el número de paletas generadas
     */
    getGenerationCount() {
        return this.generationCount;
    }
    /**
     * Convierte toda la paleta a formato hex
     */
    paletteToHex(palette) {
        return {
            primary: hslToHex(palette.primary),
            secondary: hslToHex(palette.secondary),
            accent: hslToHex(palette.accent),
            ambient: hslToHex(palette.ambient),
            contrast: hslToHex(palette.contrast),
        };
    }
    /**
     * Convierte toda la paleta a formato RGB
     */
    paletteToRgb(palette) {
        return {
            primary: hslToRgb(palette.primary),
            secondary: hslToRgb(palette.secondary),
            accent: hslToRgb(palette.accent),
            ambient: hslToRgb(palette.ambient),
            contrast: hslToRgb(palette.contrast),
        };
    }
    /**
     * Reset del estado interno
     */
    reset() {
        this.lastGeneratedPalette = null;
        this.generationCount = 0;
        console.log('🎨 [PALETTE-GENERATOR] Reset');
    }
    /**
     * Obtiene estadísticas
     */
    getStats() {
        return {
            generationCount: this.generationCount,
            lastPaletteAge: this.lastGeneratedPalette
                ? Date.now() - this.lastGeneratedPalette.metadata.generatedAt
                : null,
            lastStrategy: this.lastGeneratedPalette
                ? this.lastGeneratedPalette.metadata.colorStrategy
                : null,
        };
    }
}
// ============================================================
// EXPORTS
// ============================================================
/**
 * Factory function
 */
export function createProceduralPaletteGenerator() {
    return new ProceduralPaletteGenerator();
}
// Re-export constantes para testing
export const CONSTANTS = {
    KEY_TO_HUE,
    MODE_MODIFIERS,
    SECTION_VARIATIONS,
};
