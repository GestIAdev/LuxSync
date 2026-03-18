/**
 * 🥁 DRUM PATTERN ENGINE v2.0 - "RHYTHM DIVINE"
 *
 * Motor de patrones rítmicos con MAGIA MATEMÁTICA profesional.
 * Sistema de variaciones A/B/C + Groove/Swing + Humanización.
 *
 * DIRECTIVA 28B: SCHERZO SONORO (Architect + Radwulf + PunkClaude)
 *
 * FEATURES v2.0:
 * - ✅ 18+ patrones únicos con variaciones A/B/C por sección
 * - ✅ Swing automático (8-12ms offset en off-beats)
 * - ✅ Velocity humanizada (hihats 65-85, kicks 95-120, snares 85-110)
 * - ✅ Fills inteligentes (glitchy, rolls, no metralleta)
 * - ✅ Patrones cyberpunk (sincopados, glitches intencionados)
 * - ✅ Ghost notes dinámicos (40-55 velocity)
 * - ✅ Hi-hat rolls en transiciones
 * - ✅ 100% determinista (SeededRandom)
 *
 * MATANDO: Bug #24 (Drums Desordenados/Repetitivos)
 *
 * AUTHOR: PunkClaude + Radwulf + Architect
 * DATE: 2025-11-02
 * VERSION: 2.0 - "RHYTHM DIVINE"
 */
import { SeededRandom } from '../utils/SeededRandom.js';
export class DrumPatternEngine {
    patterns;
    tempo;
    prng;
    swingAmount = 0.12; // 🎭 SCHERZO: 12% swing (más shuffle feel en cyberpunk)
    humanizationFactor = 0.06; // 🎭 SCHERZO: 6% variación (menos saltos bruscos)
    constructor(tempo, seed = 12345) {
        this.tempo = tempo;
        this.prng = new SeededRandom(seed);
        this.patterns = this.loadPatterns();
        console.log(`🥁 [DrumPatternEngine] Initialized at ${tempo} BPM (v2.0 - Rhythm Divine)`);
    }
    /**
     * 🎵 PATRONES v2.0 - RHYTHM DIVINE (18+ variaciones únicas)
     *
     * SISTEMA DE VARIACIONES:
     * - A: Patrón básico (groove estándar) → complexity: 'low'
     * - B: Variación intermedia (más sincopado) → complexity: 'medium'
     * - C: Variación compleja (cyberpunk/glitchy) → complexity: 'high'
     *
     * HUMANIZACIÓN:
     * - Kicks: 100-120 velocity (potentes)
     * - Snares: 85-110 velocity (dinámicos)
     * - Hi-hats: 65-85 velocity (suaves)
     * - Ghost notes: 40-55 velocity (barely audible)
     *
     * 🎭 FRENTE #3 (SCHERZO RÍTMICO): Añadida propiedad 'complexity' para progresión inteligente
     */
    loadPatterns() {
        return {
            // ═══════════════════════════════════════════════════════════
            // INTRO PATTERNS (Minimal pero audible)
            // ═══════════════════════════════════════════════════════════
            intro_A: {
                bars: 4,
                complexity: 'low',
                notes: [
                    // Minimal hi-hats en beats principales
                    { beat: 1, midi: 42, velocity: 75 }, // HH closed
                    { beat: 2, midi: 42, velocity: 68 }, // HH closed (más suave)
                    { beat: 3, midi: 42, velocity: 72 }, // HH closed
                    { beat: 4, midi: 42, velocity: 68 } // HH closed
                ]
            },
            intro_B: {
                bars: 4,
                complexity: 'medium',
                notes: [
                    // Intro con kick suave + shaker
                    { beat: 1, midi: 36, velocity: 85 }, // Kick (suave)
                    { beat: 1, midi: 70, velocity: 65 }, // Shaker
                    { beat: 2.5, midi: 70, velocity: 68 }, // Shaker
                    { beat: 3, midi: 36, velocity: 80 }, // Kick (ghost)
                    { beat: 4, midi: 70, velocity: 70 } // Shaker
                ]
            },
            // ═══════════════════════════════════════════════════════════
            // VERSE PATTERNS (Basic Grooves - 3 variaciones)
            // ═══════════════════════════════════════════════════════════
            verse_A: {
                bars: 4,
                complexity: 'low',
                notes: [
                    // Groove básico 4/4
                    { beat: 1, midi: 36, velocity: 110 }, // Kick
                    { beat: 1, midi: 42, velocity: 78 }, // HH closed
                    { beat: 1.5, midi: 42, velocity: 65 }, // HH closed (ghost)
                    { beat: 2, midi: 42, velocity: 72 }, // HH closed
                    { beat: 2.5, midi: 38, velocity: 95 }, // Snare
                    { beat: 2.5, midi: 42, velocity: 68 }, // HH closed
                    { beat: 3, midi: 36, velocity: 105 }, // Kick
                    { beat: 3, midi: 42, velocity: 78 }, // HH closed
                    { beat: 3.5, midi: 42, velocity: 65 }, // HH closed (ghost)
                    { beat: 4, midi: 42, velocity: 72 }, // HH closed
                    { beat: 4.5, midi: 38, velocity: 90 }, // Snare
                    { beat: 4.5, midi: 46, velocity: 70 } // HH open
                ]
            },
            verse_B: {
                bars: 4,
                complexity: 'medium',
                notes: [
                    // Groove sincopado (kicks en off-beats)
                    { beat: 1, midi: 36, velocity: 112 }, // Kick
                    { beat: 1, midi: 42, velocity: 80 }, // HH closed
                    { beat: 1.75, midi: 36, velocity: 88 }, // Kick (ghost sincopado)
                    { beat: 2, midi: 42, velocity: 75 }, // HH closed
                    { beat: 2.5, midi: 38, velocity: 98 }, // Snare
                    { beat: 2.5, midi: 42, velocity: 70 }, // HH closed
                    { beat: 3, midi: 36, velocity: 108 }, // Kick
                    { beat: 3, midi: 42, velocity: 78 }, // HH closed
                    { beat: 3.25, midi: 42, velocity: 50 }, // HH closed (ghost)
                    { beat: 3.5, midi: 42, velocity: 66 }, // HH closed
                    { beat: 4, midi: 42, velocity: 72 }, // HH closed
                    { beat: 4.5, midi: 38, velocity: 92 }, // Snare
                    { beat: 4.5, midi: 46, velocity: 75 }, // HH open
                    { beat: 4.75, midi: 37, velocity: 55 } // Rim (ghost)
                ]
            },
            verse_C: {
                bars: 4,
                complexity: 'high',
                notes: [
                    // Groove cyberpunk (glitchy hi-hats)
                    { beat: 1, midi: 36, velocity: 115 }, // Kick (fuerte)
                    { beat: 1, midi: 42, velocity: 82 }, // HH closed
                    { beat: 1.25, midi: 42, velocity: 68 }, // HH closed (glitch)
                    { beat: 1.5, midi: 42, velocity: 48 }, // HH closed (ghost glitch)
                    { beat: 2, midi: 42, velocity: 75 }, // HH closed
                    { beat: 2.5, midi: 38, velocity: 100 }, // Snare
                    { beat: 2.5, midi: 39, velocity: 70 }, // Clap (layered)
                    { beat: 3, midi: 36, velocity: 110 }, // Kick
                    { beat: 3, midi: 42, velocity: 80 }, // HH closed
                    { beat: 3.5, midi: 42, velocity: 45 }, // HH closed (ghost)
                    { beat: 3.75, midi: 70, velocity: 60 }, // Shaker (textura)
                    { beat: 4, midi: 42, velocity: 72 }, // HH closed
                    { beat: 4.5, midi: 38, velocity: 95 }, // Snare
                    { beat: 4.5, midi: 46, velocity: 78 } // HH open
                ]
            },
            // ═══════════════════════════════════════════════════════════
            // CHORUS PATTERNS (Complex/Powerful - 3 variaciones)
            // ═══════════════════════════════════════════════════════════
            chorus_A: {
                bars: 4,
                complexity: 'low',
                notes: [
                    // Chorus potente con crash
                    { beat: 1, midi: 36, velocity: 120 }, // Kick (máximo)
                    { beat: 1, midi: 49, velocity: 110 }, // Crash
                    { beat: 1, midi: 42, velocity: 85 }, // HH closed
                    { beat: 1.5, midi: 42, velocity: 70 }, // HH closed
                    { beat: 2, midi: 42, velocity: 78 }, // HH closed
                    { beat: 2.5, midi: 38, velocity: 110 }, // Snare (fuerte)
                    { beat: 2.5, midi: 39, velocity: 95 }, // Clap (layered)
                    { beat: 2.5, midi: 42, velocity: 72 }, // HH closed
                    { beat: 3, midi: 36, velocity: 115 }, // Kick
                    { beat: 3, midi: 42, velocity: 82 }, // HH closed
                    { beat: 3.25, midi: 36, velocity: 90 }, // Kick (ghost)
                    { beat: 3.5, midi: 42, velocity: 68 }, // HH closed
                    { beat: 4, midi: 42, velocity: 75 }, // HH closed
                    { beat: 4.5, midi: 38, velocity: 105 }, // Snare
                    { beat: 4.5, midi: 46, velocity: 80 }, // HH open
                    { beat: 4.75, midi: 50, velocity: 88 } // Tom high (fill mini)
                ]
            },
            chorus_B: {
                bars: 4,
                complexity: 'medium',
                notes: [
                    // Chorus sincopado (double kicks)
                    { beat: 1, midi: 36, velocity: 118 }, // Kick
                    { beat: 1, midi: 49, velocity: 108 }, // Crash
                    { beat: 1, midi: 42, velocity: 83 }, // HH closed
                    { beat: 1.25, midi: 36, velocity: 95 }, // Kick (double)
                    { beat: 1.5, midi: 42, velocity: 72 }, // HH closed
                    { beat: 2, midi: 42, velocity: 76 }, // HH closed
                    { beat: 2.5, midi: 38, velocity: 108 }, // Snare
                    { beat: 2.5, midi: 39, velocity: 90 }, // Clap
                    { beat: 2.75, midi: 42, velocity: 50 }, // HH closed (ghost)
                    { beat: 3, midi: 36, velocity: 116 }, // Kick
                    { beat: 3, midi: 42, velocity: 80 }, // HH closed
                    { beat: 3.5, midi: 36, velocity: 92 }, // Kick (ghost)
                    { beat: 3.5, midi: 42, velocity: 68 }, // HH closed
                    { beat: 4, midi: 42, velocity: 74 }, // HH closed
                    { beat: 4.25, midi: 42, velocity: 55 }, // HH closed (ghost)
                    { beat: 4.5, midi: 38, velocity: 106 }, // Snare
                    { beat: 4.5, midi: 46, velocity: 82 }, // HH open
                    { beat: 4.75, midi: 47, velocity: 85 } // Tom mid
                ]
            },
            chorus_C: {
                bars: 4,
                complexity: 'high',
                notes: [
                    // Chorus cyberpunk (glitches + tambourine)
                    { beat: 1, midi: 36, velocity: 120 }, // Kick (máximo)
                    { beat: 1, midi: 49, velocity: 112 }, // Crash
                    { beat: 1, midi: 42, velocity: 85 }, // HH closed
                    { beat: 1, midi: 54, velocity: 65 }, // Tambourine (textura)
                    { beat: 1.25, midi: 42, velocity: 70 }, // HH closed (glitch)
                    { beat: 1.5, midi: 42, velocity: 48 }, // HH closed (ghost)
                    { beat: 2, midi: 42, velocity: 78 }, // HH closed
                    { beat: 2.5, midi: 38, velocity: 110 }, // Snare
                    { beat: 2.5, midi: 39, velocity: 92 }, // Clap
                    { beat: 2.5, midi: 54, velocity: 68 }, // Tambourine
                    { beat: 3, midi: 36, velocity: 117 }, // Kick
                    { beat: 3, midi: 42, velocity: 82 }, // HH closed
                    { beat: 3.25, midi: 36, velocity: 88 }, // Kick (double)
                    { beat: 3.5, midi: 42, velocity: 45 }, // HH closed (ghost)
                    { beat: 3.5, midi: 70, velocity: 58 }, // Shaker (textura)
                    { beat: 4, midi: 42, velocity: 75 }, // HH closed
                    { beat: 4.5, midi: 38, velocity: 108 }, // Snare
                    { beat: 4.5, midi: 46, velocity: 80 }, // HH open
                    { beat: 4.5, midi: 54, velocity: 70 }, // Tambourine
                    { beat: 4.75, midi: 50, velocity: 90 } // Tom high
                ]
            },
            // ═══════════════════════════════════════════════════════════
            // BRIDGE PATTERNS (Break/Sparse - 2 variaciones)
            // ═══════════════════════════════════════════════════════════
            bridge_A: {
                bars: 4,
                complexity: 'low',
                notes: [
                    // Bridge minimal (shaker + tambourine)
                    { beat: 1, midi: 70, velocity: 72 }, // Shaker
                    { beat: 2, midi: 70, velocity: 68 }, // Shaker
                    { beat: 3, midi: 54, velocity: 70 }, // Tambourine
                    { beat: 4, midi: 70, velocity: 70 } // Shaker
                ]
            },
            bridge_B: {
                bars: 4,
                complexity: 'medium',
                notes: [
                    // Bridge con kick suave + rim
                    { beat: 1, midi: 36, velocity: 75 }, // Kick (muy suave)
                    { beat: 1, midi: 70, velocity: 65 }, // Shaker
                    { beat: 2.5, midi: 37, velocity: 60 }, // Rim (ghost)
                    { beat: 3, midi: 54, velocity: 68 }, // Tambourine
                    { beat: 4, midi: 70, velocity: 70 }, // Shaker
                    { beat: 4.5, midi: 37, velocity: 55 } // Rim (ghost)
                ]
            },
            // ═══════════════════════════════════════════════════════════
            // BUILDUP PATTERN (Glitchy/Tenso/Crescendo - NO BOMBARDEO)
            // 🎭 SCHERZO SONORO: Builds atmosférico con crescendo gradual
            // ═══════════════════════════════════════════════════════════
            buildup: {
                bars: 4,
                complexity: 'high', // Siempre complejo
                notes: [
                    // Bar 1: Minimal (HH + Kick suaves - tensión inicial)
                    { beat: 1, midi: 36, velocity: 80 }, // Kick (suave)
                    { beat: 1, midi: 42, velocity: 68 }, // HH closed
                    { beat: 2.5, midi: 38, velocity: 75 }, // Snare (ghost)
                    { beat: 3.5, midi: 42, velocity: 72 }, // HH closed
                    { beat: 4, midi: 42, velocity: 65 }, // HH closed (ghost)
                    // Bar 2: Añadir glitches (shaker + clap ligeros)
                    { beat: 5, midi: 70, velocity: 70 }, // Shaker (glitch)
                    { beat: 6.5, midi: 39, velocity: 72 }, // Clap (suave)
                    { beat: 7.5, midi: 36, velocity: 85 }, // Kick (subiendo)
                    { beat: 8, midi: 42, velocity: 75 }, // HH closed
                    // Bar 3: Intensificar (más hihats, snare roll)
                    { beat: 9, midi: 36, velocity: 92 }, // Kick (creciendo)
                    { beat: 9, midi: 42, velocity: 80 }, // HH closed
                    { beat: 10.5, midi: 38, velocity: 80 }, // Snare
                    { beat: 11, midi: 38, velocity: 68 }, // Snare (ghost roll)
                    { beat: 11.25, midi: 38, velocity: 60 }, // Snare (ghost roll)
                    { beat: 11.5, midi: 42, velocity: 85 }, // HH closed (acelerando)
                    // Bar 4: Clímax moderado (preparar drop, NO explotar)
                    { beat: 13, midi: 36, velocity: 98 }, // Kick (forte pero no máximo)
                    { beat: 13, midi: 49, velocity: 90 }, // Crash (moderado)
                    { beat: 14.5, midi: 38, velocity: 95 } // Snare final (transición)
                ]
            },
            // ═══════════════════════════════════════════════════════════
            // OUTRO PATTERN (Fade gradual)
            // ═══════════════════════════════════════════════════════════
            outro: {
                bars: 4,
                complexity: 'low', // Simple fade
                notes: [
                    // Mismo que verse_A pero con fade automático
                    { beat: 1, midi: 36, velocity: 110 }, // Kick
                    { beat: 1, midi: 42, velocity: 78 }, // HH closed
                    { beat: 2.5, midi: 38, velocity: 95 }, // Snare
                    { beat: 3, midi: 36, velocity: 105 }, // Kick
                    { beat: 4.5, midi: 46, velocity: 70 } // HH open
                ]
            },
            // ═══════════════════════════════════════════════════════════
            // FILL LIBRARY (🎭 FRENTE #3: SCHERZO RÍTMICO)
            // Fills musicales de 1-2 compases para reemplazar truncamiento
            // ═══════════════════════════════════════════════════════════
            // 🥁 FILLS DE 1 COMPÁS
            fill_1bar_hihat: {
                bars: 1,
                complexity: 'low',
                notes: [
                    // Hi-hat roll simple (16avos espaciados)
                    { beat: 1, midi: 42, velocity: 72 }, // HH closed
                    { beat: 1.25, midi: 42, velocity: 68 }, // HH closed
                    { beat: 1.5, midi: 42, velocity: 75 }, // HH closed
                    { beat: 1.75, midi: 42, velocity: 70 }, // HH closed
                    { beat: 2, midi: 42, velocity: 78 }, // HH closed
                    { beat: 2.5, midi: 42, velocity: 72 }, // HH closed
                    { beat: 3, midi: 42, velocity: 80 }, // HH closed
                    { beat: 3.5, midi: 42, velocity: 75 }, // HH closed
                    { beat: 4, midi: 46, velocity: 85 } // HH open (finaliza)
                ]
            },
            fill_1bar_snare: {
                bars: 1,
                complexity: 'medium',
                notes: [
                    // Snare build con kicks
                    { beat: 1, midi: 36, velocity: 105 }, // Kick
                    { beat: 2, midi: 38, velocity: 80 }, // Snare (ghost)
                    { beat: 2.5, midi: 38, velocity: 85 }, // Snare
                    { beat: 3, midi: 38, velocity: 90 }, // Snare
                    { beat: 3.5, midi: 38, velocity: 95 }, // Snare (crescendo)
                    { beat: 4, midi: 38, velocity: 100 }, // Snare (clímax)
                    { beat: 4, midi: 49, velocity: 105 } // Crash (finaliza)
                ]
            },
            fill_1bar_toms: {
                bars: 1,
                complexity: 'high',
                notes: [
                    // Tom descent (high → mid → low)
                    { beat: 1, midi: 50, velocity: 95 }, // Tom high
                    { beat: 1.5, midi: 50, velocity: 88 }, // Tom high
                    { beat: 2, midi: 47, velocity: 100 }, // Tom mid
                    { beat: 2.5, midi: 47, velocity: 92 }, // Tom mid
                    { beat: 3, midi: 45, velocity: 105 }, // Tom low
                    { beat: 3.5, midi: 45, velocity: 98 }, // Tom low
                    { beat: 4, midi: 36, velocity: 115 }, // Kick (potente)
                    { beat: 4, midi: 49, velocity: 110 } // Crash (finaliza)
                ]
            },
            // 🥁 FILLS DE 2 COMPASES
            fill_2bar_progressive: {
                bars: 2,
                complexity: 'medium',
                notes: [
                    // Bar 1: Build gradual con hi-hats
                    { beat: 1, midi: 36, velocity: 100 }, // Kick
                    { beat: 1, midi: 42, velocity: 75 }, // HH closed
                    { beat: 2, midi: 42, velocity: 72 }, // HH closed
                    { beat: 2.5, midi: 38, velocity: 85 }, // Snare
                    { beat: 3, midi: 42, velocity: 78 }, // HH closed
                    { beat: 3.5, midi: 42, velocity: 70 }, // HH closed
                    { beat: 4, midi: 42, velocity: 80 }, // HH closed
                    { beat: 4.5, midi: 38, velocity: 88 }, // Snare
                    // Bar 2: Clímax con tom descent
                    { beat: 5, midi: 50, velocity: 92 }, // Tom high
                    { beat: 5.5, midi: 50, velocity: 88 }, // Tom high
                    { beat: 6, midi: 47, velocity: 95 }, // Tom mid
                    { beat: 6.5, midi: 47, velocity: 90 }, // Tom mid
                    { beat: 7, midi: 45, velocity: 100 }, // Tom low
                    { beat: 7.5, midi: 38, velocity: 95 }, // Snare
                    { beat: 8, midi: 36, velocity: 115 }, // Kick (potente)
                    { beat: 8, midi: 49, velocity: 110 } // Crash (finaliza)
                ]
            },
            fill_2bar_glitchy: {
                bars: 2,
                complexity: 'high',
                notes: [
                    // Bar 1: Glitches con shaker + rim
                    { beat: 1, midi: 70, velocity: 68 }, // Shaker
                    { beat: 1.5, midi: 37, velocity: 60 }, // Rim (ghost)
                    { beat: 2, midi: 70, velocity: 72 }, // Shaker
                    { beat: 2.5, midi: 42, velocity: 55 }, // HH closed (ghost)
                    { beat: 3, midi: 70, velocity: 70 }, // Shaker
                    { beat: 3.25, midi: 37, velocity: 58 }, // Rim (ghost)
                    { beat: 3.5, midi: 42, velocity: 50 }, // HH closed (ghost)
                    { beat: 4, midi: 70, velocity: 75 }, // Shaker
                    { beat: 4.5, midi: 38, velocity: 80 }, // Snare (build)
                    // Bar 2: Explosión controlada
                    { beat: 5, midi: 36, velocity: 110 }, // Kick
                    { beat: 5, midi: 42, velocity: 82 }, // HH closed
                    { beat: 5.25, midi: 42, velocity: 65 }, // HH closed (glitch)
                    { beat: 6, midi: 38, velocity: 95 }, // Snare
                    { beat: 6, midi: 39, velocity: 85 }, // Clap (layered)
                    { beat: 7, midi: 50, velocity: 92 }, // Tom high
                    { beat: 7.5, midi: 47, velocity: 95 }, // Tom mid
                    { beat: 8, midi: 36, velocity: 118 }, // Kick (máximo)
                    { beat: 8, midi: 49, velocity: 112 } // Crash (épico)
                ]
            },
            // 🌌 FASE 6.0 - FRENTE #C: TRON LEGACY PATTERNS
            // Minimalismo atmosférico: crashes con reverb largo, kicks espaciados, NO snares/hihats
            tron_minimal: {
                bars: 4,
                complexity: 'low',
                notes: [
                    // Bar 1: Crash + Kick
                    { beat: 1, midi: 49, velocity: 100 }, // Crash (beat 1, reverb largo)
                    { beat: 1, midi: 36, velocity: 108 }, // Kick
                    // Bar 2: Solo kick
                    { beat: 5, midi: 36, velocity: 105 }, // Kick beat 5
                    // Bar 3: Silencio atmosférico
                    // Bar 4: Kick final
                    { beat: 13, midi: 36, velocity: 110 } // Kick beat 13
                ]
            },
            tron_epic: {
                bars: 4,
                complexity: 'medium',
                notes: [
                    // Bar 1: Crash épico + Kick potente
                    { beat: 1, midi: 49, velocity: 115 }, // Crash (máximo reverb)
                    { beat: 1, midi: 36, velocity: 118 }, // Kick (máximo)
                    // Bar 2: Kick + ghost kick
                    { beat: 5, midi: 36, velocity: 110 }, // Kick
                    { beat: 6.5, midi: 36, velocity: 75 }, // Ghost kick (sutil)
                    // Bar 3: Crash secundario
                    { beat: 9, midi: 49, velocity: 95 }, // Crash (menor intensidad)
                    { beat: 9, midi: 36, velocity: 105 }, // Kick
                    // Bar 4: Resolución
                    { beat: 13, midi: 36, velocity: 115 } // Kick final
                ]
            }
        };
    }
    /**
     * 🎵 Generar notas de drums con GROOVE + HUMANIZACIÓN
     * ✅ BUG #24 FIX (SCHERZO SONORO): Maneja secciones de 5, 6, 7 compases inteligentemente
     */
    generateForSection(section, baseVelocity = 60) {
        const patternName = this.selectPattern(section); // 🎭 FRENTE #3: Ahora recibe Section completa
        const pattern = this.patterns[patternName];
        if (!pattern) {
            console.warn(`⚠️  [DrumPatternEngine] No pattern for section: ${section.type}`);
            return [];
        }
        const notes = [];
        const beatDuration = (60 / this.tempo); // Segundos por beat (4/4)
        const barDuration = beatDuration * 4; // 4 beats por bar
        // ✅ BUG #24 FIX: Adaptar patrones a secciones de duración variable
        const sectionBars = section.bars || Math.round(section.duration / barDuration);
        const patternBars = pattern.bars;
        // Calcular cuántas repeticiones completas del patrón caben
        const fullRepeats = Math.floor(sectionBars / patternBars);
        const remainingBars = sectionBars % patternBars;
        console.log(`🥁 [RHYTHM DIVINE] Section "${section.type}" has ${sectionBars} bars, pattern "${patternName}" has ${patternBars} bars. Full repeats: ${fullRepeats}, remaining: ${remainingBars}`);
        // Generar repeticiones completas del patrón
        for (let repeat = 0; repeat < fullRepeats; repeat++) {
            const repeatOffset = repeat * (barDuration * patternBars);
            this.generatePatternNotes(pattern, patternName, section, repeatOffset, beatDuration, notes);
        }
        // ✅ FRENTE #3 (SCHERZO RÍTMICO): FILLS > TRUNCAMIENTO
        // Si hay compases sobrantes, generar fill musical en lugar de truncar
        if (remainingBars > 0) {
            const fillStartTime = section.startTime + (fullRepeats * barDuration * patternBars);
            console.log(`[RHYTHM DIVINE] Aplicando fill de ${remainingBars} compases para ${section.type}`);
            // Generar fill dinámico
            const fillNotes = this.generateFillForBars(remainingBars, section, fillStartTime, beatDuration);
            notes.push(...fillNotes);
        }
        // Agregar fill al final si corresponde
        if (this.shouldAddFill(section)) {
            const fillNotes = this.generateFill(section, baseVelocity);
            notes.push(...fillNotes);
        }
        return notes;
    }
    /**
     * 🔧 HELPER: Generar notas de un patrón con offset
     * Extraído para reutilización en BUG #24 FIX
     */
    generatePatternNotes(pattern, patternName, section, repeatOffset, beatDuration, notes) {
        pattern.notes.forEach(note => {
            let noteTime = section.startTime + repeatOffset + ((note.beat - 1) * beatDuration);
            // 🎭 SWING: Desplazar off-beats (1.5, 2.5, 3.5, 4.5) ligeramente
            const beatPosition = note.beat % 1;
            if (beatPosition === 0.5) {
                // Off-beat: añadir swing (8-12ms delay)
                const swingDelay = this.swingAmount * beatDuration;
                noteTime += swingDelay;
            }
            // 🔥 FASE 5.3 (SCHERZO QUIRÚRGICO): Prevenir acumulación de error flotante
            // Redondear a 12 decimales después de todas las operaciones
            noteTime = Math.round(noteTime * 1e12) / 1e12;
            // No agregar notas que excedan la duración de la sección
            if (noteTime < section.startTime + section.duration) {
                // Aplicar fade en outro
                let velocity = note.velocity;
                if (patternName.startsWith('outro')) {
                    const fadeProgress = (noteTime - section.startTime) / section.duration;
                    velocity = note.velocity * (1 - fadeProgress * 0.6); // Fade 60%
                }
                // 🎨 HUMANIZACIÓN: Variación aleatoria ±10% en velocity
                // (pero determinista via SeededRandom)
                const humanizationVariation = (this.prng.next() - 0.5) * 2 * this.humanizationFactor;
                velocity = velocity * (1 + humanizationVariation);
                // ✅ VELOCITIES PROFESIONALES: Ya vienen correctas del patrón (60-120 MIDI)
                const scaledVelocity = Math.floor(velocity);
                const finalVelocity = Math.max(35, Math.min(127, scaledVelocity));
                // 🔥 RHYTHM LOGGER: Partitura exacta con Swing + Humanización
                console.log(`🥁 [RHYTHM DIVINE] Section: ${section.type}, Pattern: ${patternName}, MIDI: ${note.midi}, Beat: ${note.beat.toFixed(2)}, Time(s): ${noteTime.toFixed(3)}, Velocity: ${finalVelocity}`);
                notes.push({
                    pitch: note.midi,
                    velocity: finalVelocity,
                    startTime: noteTime,
                    duration: 0.1, // Percusión = corta
                    channel: 9 // Channel 9 = drums
                });
            }
        });
    }
    /**
     * 🔥 FRENTE #3 (SCHERZO RÍTMICO): Generar fill musical para compases restantes
     * Reemplaza el truncamiento con fills profesionales de la biblioteca
     *
     * @param bars - Número de compases restantes (1 o 2)
     * @param section - Sección actual
     * @param fillStartTime - Tiempo de inicio del fill
     * @param beatDuration - Duración de un beat
     * @returns Array de MIDINote para el fill
     */
    generateFillForBars(bars, section, fillStartTime, beatDuration) {
        const notes = [];
        // Seleccionar fill apropiado según compases restantes
        let fillPatternName;
        if (bars === 1) {
            // 1 compás: Seleccionar entre fills de 1 bar según intensidad
            const fillOptions = ['fill_1bar_hihat', 'fill_1bar_snare', 'fill_1bar_toms'];
            const intensityIndex = section.profile && section.profile.intensity > 0.8 ? 2 :
                section.profile && section.profile.intensity > 0.5 ? 1 : 0;
            fillPatternName = fillOptions[intensityIndex];
        }
        else {
            // 2 compases: Seleccionar entre fills de 2 bars según intensidad
            const fillOptions = ['fill_2bar_progressive', 'fill_2bar_glitchy'];
            fillPatternName = section.profile && section.profile.intensity > 0.7 ?
                fillOptions[1] : fillOptions[0];
        }
        const fillPattern = this.patterns[fillPatternName];
        if (!fillPattern) {
            console.warn(`⚠️  [RHYTHM DIVINE] Fill pattern '${fillPatternName}' no encontrado`);
            return notes;
        }
        console.log(`[RHYTHM DIVINE] Aplicando patrón de fill '${fillPatternName}' para ${bars} compases restantes en ${section.type}`);
        // Generar notas del fill (similar a generatePatternNotes pero sin repetición)
        fillPattern.notes.forEach(note => {
            let noteTime = fillStartTime + ((note.beat - 1) * beatDuration);
            // Aplicar swing a off-beats
            const beatPosition = note.beat % 1;
            if (beatPosition === 0.5) {
                const swingDelay = this.swingAmount * beatDuration;
                noteTime += swingDelay;
            }
            // 🔥 FASE 5.3 (SCHERZO QUIRÚRGICO): Prevenir acumulación de error flotante
            // Redondear a 12 decimales después de todas las operaciones
            noteTime = Math.round(noteTime * 1e12) / 1e12;
            // Aplicar humanización
            let velocity = note.velocity;
            const humanizationVariation = (this.prng.next() - 0.5) * 2 * this.humanizationFactor;
            velocity = velocity * (1 + humanizationVariation);
            const finalVelocity = Math.max(35, Math.min(127, Math.floor(velocity)));
            console.log(`🥁 [RHYTHM DIVINE] Section: ${section.type}, Pattern: ${fillPatternName}, MIDI: ${note.midi}, Beat: ${note.beat.toFixed(2)}, Time(s): ${noteTime.toFixed(3)}, Velocity: ${finalVelocity}`);
            notes.push({
                pitch: note.midi,
                velocity: finalVelocity,
                startTime: noteTime,
                duration: 0.1,
                channel: 9
            });
        });
        return notes;
    }
    /**
     * 🎯 Seleccionar patrón con PROGRESIÓN INTELIGENTE (NO aleatoriedad)
     * 🎭 FRENTE #3 (SCHERZO RÍTMICO): Selección basada en intensidad + índice
     *
     * LÓGICA DE PROGRESIÓN:
     * - Alta intensidad (>0.8) → Patrón complejo (_C)
     * - Primera aparición (index=0) → Patrón simple (_A)
     * - Secciones intermedias → Patrón medio (_B)
     */
    selectPattern(section) {
        const { type, profile, index } = section;
        // 🌌 FASE 6.0 - FRENTE #C: Detectar contexto atmosférico para patrones Tron
        // Si la intensidad es muy baja (< 0.4), usar minimalismo Tron Legacy
        const intensity = profile?.intensity || 0.5;
        if (intensity < 0.4) {
            // Alternar entre tron_minimal (más común) y tron_epic (ocasional)
            const useTronEpic = this.prng.next() > 0.75; // 25% chance de epic
            const tronPattern = useTronEpic ? 'tron_epic' : 'tron_minimal';
            console.log(`[RHYTHM DIVINE] 🌌 Contexto atmosférico detectado (Intensity: ${intensity.toFixed(2)}) → Patrón Tron: '${tronPattern}'`);
            return tronPattern;
        }
        // Mapeo de tipos base (patrones tradicionales)
        const baseMapping = {
            'intro': 'intro',
            'verse': 'verse',
            'pre-chorus': 'verse', // Pre-chorus usa verse con variación
            'chorus': 'chorus',
            'interlude': 'bridge',
            'bridge': 'bridge',
            'buildup': 'buildup', // Buildup tiene patrón único
            'outro': 'outro' // Outro tiene patrón único
        };
        const basePattern = baseMapping[type] || 'verse';
        // Patrones únicos (sin variaciones A/B/C)
        if (basePattern === 'buildup' || basePattern === 'outro') {
            console.log(`[RHYTHM DIVINE] Selección progresiva: Section '${type}' (Index: ${index}) → Patrón único: '${basePattern}'`);
            return basePattern;
        }
        // Determinar variación según progresión inteligente
        let variation = 'A';
        if (profile && profile.intensity > 0.8) {
            // 🔥 Alta intensidad → Complejidad alta
            variation = 'C';
        }
        else if (index === 0) {
            // 🌱 Primera aparición → Patrón simple
            variation = 'A';
        }
        else {
            // 📈 Secciones intermedias → Patrón medio
            variation = 'B';
        }
        const patternName = `${basePattern}_${variation}`;
        // Validar que el patrón existe
        if (!this.patterns[patternName]) {
            console.warn(`⚠️  [RHYTHM DIVINE] Patrón '${patternName}' no encontrado, usando fallback: ${basePattern}_A`);
            return `${basePattern}_A`;
        }
        console.log(`[RHYTHM DIVINE] Selección progresiva: Section '${type}' (Index: ${index}, Intensity: ${profile?.intensity.toFixed(2) || 'N/A'}) → Patrón elegido: '${patternName}'`);
        return patternName;
    }
    /**
     * ⚡ Determinar si agregar fill de transición (inteligente)
     */
    shouldAddFill(section) {
        // Fills inteligentes:
        // ✅ Verse → antes del chorus
        // ✅ Pre-chorus → antes del chorus
        // ✅ Bridge → transición dramática
        // ✅ Chorus → antes del drop/verse (ocasional)
        // ❌ Buildup → ya tiene patrón interno complejo
        // ❌ Outro → fade natural, no fill
        // ❌ Intro → minimalista, no necesita fill
        return section.type === 'verse' ||
            section.type === 'pre-chorus' ||
            section.type === 'bridge' ||
            (section.type === 'chorus' && this.prng.next() > 0.6); // 40% chance en chorus
    }
    /**
     * 🔥 Generar fill glitchy (cyberpunk, no metralleta)
     * 🔧 BUG #24 FIX: Velocities fijas profesionales (no escalar por baseVelocity)
     */
    generateFill(section, baseVelocity) {
        const beatDuration = (60 / this.tempo);
        const fillStart = section.startTime + section.duration - (beatDuration * 4); // Último bar
        // Alternar entre hi-hat roll y snare build (determinista)
        const fillType = this.prng.choice(['hihat_roll', 'snare_build']);
        const notes = [];
        if (fillType === 'hihat_roll') {
            // 🎭 SCHERZO SONORO: Hi-hat roll glitchy (4 notas espaciadas, no metralleta)
            const rollLength = 4; // Reducido de 6-7 a 4 (menos densidad)
            for (let i = 0; i < rollLength; i++) {
                // 🔧 BUG #24 FIX: Velocities fijas (65-85), no escalar
                const finalVelocity = 65 + Math.floor((i / rollLength) * 20); // 65 → 85 gradual
                const noteTime = fillStart + (i * beatDuration * 0.1875); // 32avos en vez de 16avos (más espaciado)
                // 🔥 RHYTHM LOGGER: Fill hi-hat roll
                console.log(`🥁 [RHYTHM DIVINE] Section: ${section.type}, Pattern: FILL_HIHAT, MIDI: 42, Beat: ${(noteTime / beatDuration).toFixed(2)}, Time(s): ${noteTime.toFixed(3)}, Velocity: ${finalVelocity}`);
                notes.push({
                    pitch: 42, // Hi-hat close
                    velocity: finalVelocity,
                    startTime: noteTime,
                    duration: 0.08, // Staccato
                    channel: 9
                });
            }
            // Crash final (50% chance)
            if (this.prng.next() > 0.5) {
                const crashTime = fillStart + (rollLength * beatDuration * 0.1875); // Ajustado timing
                const crashVelocity = 110; // 🔧 BUG #24 FIX: Fijo, no escalar
                console.log(`🥁 [RHYTHM DIVINE] Section: ${section.type}, Pattern: FILL_CRASH, MIDI: 49, Beat: ${(crashTime / beatDuration).toFixed(2)}, Time(s): ${crashTime.toFixed(3)}, Velocity: ${crashVelocity}`);
                notes.push({
                    pitch: 49, // Crash
                    velocity: crashVelocity,
                    startTime: crashTime,
                    duration: 0.5,
                    channel: 9
                });
            }
        }
        else {
            // 🎭 DIRECTIVA 32A: Snare accent minimalista (2 ghost + 1 acento, NO metralleta)
            // Solo 2 ghost snares muy suaves + acento final
            for (let i = 0; i < 2; i++) {
                const finalVelocity = 50 + (i * 10); // 50 → 60 (ghost suaves)
                const noteTime = fillStart + (i * beatDuration * 0.375); // Más espaciado (3/8 beats)
                console.log(`🥁 [RHYTHM DIVINE] Section: ${section.type}, Pattern: FILL_SNARE_GHOST, MIDI: 38, Beat: ${(noteTime / beatDuration).toFixed(2)}, Time(s): ${noteTime.toFixed(3)}, Velocity: ${finalVelocity}`);
                notes.push({
                    pitch: 38, // Snare
                    velocity: finalVelocity,
                    startTime: noteTime,
                    duration: 0.12,
                    channel: 9
                });
            }
            // Acento final (más suave que antes)
            const accentTime = fillStart + (2 * beatDuration * 0.375);
            const accentVelocity = 95; // 🎭 SCHERZO: Reducido de 105 a 95 (menos agresivo)
            console.log(`🥁 [RHYTHM DIVINE] Section: ${section.type}, Pattern: FILL_SNARE_ACCENT, MIDI: 38, Beat: ${(accentTime / beatDuration).toFixed(2)}, Time(s): ${accentTime.toFixed(3)}, Velocity: ${accentVelocity}`);
            notes.push({
                pitch: 38, // Snare
                velocity: accentVelocity,
                startTime: accentTime,
                duration: 0.18,
                channel: 9
            });
        }
        return notes;
    }
    /**
     * Set new seed for deterministic generation
     */
    setSeed(seed) {
        this.prng = new SeededRandom(seed);
    }
}
//# sourceMappingURL=DrumPatternEngine.js.map