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
import { MIDINote } from '../core/interfaces.js';
import { Section } from '../structure/SongStructure.js';
export declare class DrumPatternEngine {
    private patterns;
    private tempo;
    private prng;
    private swingAmount;
    private humanizationFactor;
    constructor(tempo: number, seed?: number);
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
    private loadPatterns;
    /**
     * 🎵 Generar notas de drums con GROOVE + HUMANIZACIÓN
     * ✅ BUG #24 FIX (SCHERZO SONORO): Maneja secciones de 5, 6, 7 compases inteligentemente
     */
    generateForSection(section: Section, baseVelocity?: number): MIDINote[];
    /**
     * 🔧 HELPER: Generar notas de un patrón con offset
     * Extraído para reutilización en BUG #24 FIX
     */
    private generatePatternNotes;
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
    private generateFillForBars;
    /**
     * 🎯 Seleccionar patrón con PROGRESIÓN INTELIGENTE (NO aleatoriedad)
     * 🎭 FRENTE #3 (SCHERZO RÍTMICO): Selección basada en intensidad + índice
     *
     * LÓGICA DE PROGRESIÓN:
     * - Alta intensidad (>0.8) → Patrón complejo (_C)
     * - Primera aparición (index=0) → Patrón simple (_A)
     * - Secciones intermedias → Patrón medio (_B)
     */
    private selectPattern;
    /**
     * ⚡ Determinar si agregar fill de transición (inteligente)
     */
    private shouldAddFill;
    /**
     * 🔥 Generar fill glitchy (cyberpunk, no metralleta)
     * 🔧 BUG #24 FIX: Velocities fijas profesionales (no escalar por baseVelocity)
     */
    private generateFill;
    /**
     * Set new seed for deterministic generation
     */
    setSeed(seed: number): void;
}
//# sourceMappingURL=DrumPatternEngine.d.ts.map