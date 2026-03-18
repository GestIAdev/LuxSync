/**
 * 🎸 ORCHESTRATOR
 * Separa notas en tracks y aplica mixing
 */
import { MIDINote } from '../core/interfaces.js';
import { Section } from '../structure/SongStructure.js';
import { StylePreset } from '../style/StylePreset.js';
import { ModeConfig } from '../core/types.js';
/**
 * ACORDE RESUELTO
 */
interface ResolvedChord {
    notes: number[];
    root: number;
    startTime: number;
    duration: number;
}
/**
 * CAPAS DE ORQUESTACIÓN
 */
interface OrchestrationLayers {
    harmony: MIDINote[];
    bass: MIDINote[];
    rhythm: MIDINote[];
    pad?: MIDINote[];
}
/**
 * ORCHESTRATOR CLASS
 */
export declare class Orchestrator {
    /**
     * Generar capas adicionales
     * ✅ REFACTORIZADO: Recibe totalLoad REAL calculado por MusicEnginePro
     * 🔥 BUG #25 FIX: Recibe DrumPatternEngine reutilizable (no crear en cada sección)
     */
    generateLayers(section: Section, chords: ResolvedChord[], melody: MIDINote[], style: StylePreset, seed: number, mode: ModeConfig, totalLoad?: number, // ✅ RECIBIR CARGA REAL (calculada por MusicEnginePro)
    drumEngine?: any): OrchestrationLayers;
    /**
     * Generar capa de armonía
     * 🎭 FRENTE #4 "SCHERZO ARMÓNICO": Fraseo Coral (Océano → Respiración)
     *
     * ARQUITECTURA:
     * - Duración máxima: 3.5s (límite de pulmón humano real)
     * - Fraseo inteligente basado en section.type e intensity
     * - Staccato (corto) en verse/intro (1-2s)
     * - Sostenuto (largo) en chorus/climax (3-3.5s)
     * - Respiración entre frases (gaps de 0.3-0.5s)
     *
     * IMPROVISACIÓN:
     * - Intensity < 0.5: "Staccato Respiratorio" (1-2s, gaps 0.5s)
     * - Intensity 0.5-0.8: "Sostenuto Moderado" (2-3s, gaps 0.3s)
     * - Intensity > 0.8: "Sostenuto Dramático" (3-3.5s, overlap legato)
     */
    private generateHarmonyLayer;
    /**
     * Generar línea de bajo
     * ✅ BUG #23 FIX (SCHERZO SONORO): Subdivide acordes largos (>3s) en notas rítmicas cortas
     * En lugar de 1 nota de 10s → genera 4 notas de 2.5s (más definición rítmica)
     */
    private generateBassLayer;
    /**
     * Generar capa rítmica
     * ✅ REFACTORIZADO BUG #24: Usa DrumPatternEngine (estructurado) en vez de lógica caótica
     */
    /**
     * 🥁 Generar capa rítmica con DrumPatternEngine
     * 🔥 BUG #25 FIX: Reutiliza instancia única de DrumPatternEngine (no crear en cada sección)
     */
    private generateRhythmLayer;
    /**
     * Generar pad atmosférico
     * ✅ BUG #23 FIX RADICAL (ARQUITECTO-34A): DURACIÓN MÁXIMA ABSOLUTA DE 4 SEGUNDOS
     * No importa chord.duration - El Pad NUNCA debe exceder 4s por nota
     * Estrategia: "Respiratory Pads" (inhale 4s, exhale 4s, repeat)
     */
    private generatePadLayer;
    /**
     * Separar en tracks
     */
    separateIntoTracks(melody: MIDINote[], layers: OrchestrationLayers, style: StylePreset): Map<string, MIDINote[]>;
    /**
     * 🐛 BUG FIX #7 (FASE 6.0b): Separar TODOS los tracks (incluyendo multicapa melody)
     * En FASE 6.0, melody puede tener múltiples layers ('melody', 'melody2', 'melody3', 'melody4')
     * Esta función copia TODOS los tracks directamente, preservando la separación multicapa
     */
    separateAllTracks(tracks: Map<string, MIDINote[]>, style: StylePreset): Map<string, MIDINote[]>;
    /**
     * Aplicar mixing
     * ✅ REFACTORIZADO BUG #31: NO aplicar mixWeight a velocity (ya viene en escala MIDI 0-127)
     * mixWeight causaba velocity corruption: 60 MIDI * 0.3 mixWeight = 18 MIDI (inaudible)
     */
    applyMixing(tracks: Map<string, MIDINote[]>, style: StylePreset): Map<string, MIDINote[]>;
    private getLayerConfig;
    /**
     * Calculate dynamic shaping based on phrase position and section type
     */
    private calculatePhrasingDynamic;
    /**
     * REGLA DE ACTIVIDAD MÍNIMA: Asegurar que al menos una capa esté siempre activa
     * Previene silencios no deseados en la composición
     */
    private ensureMinimumActivity;
    /**
     * Generar actividad mínima de Pad para rellenar silencios
     */
    private generateMinimumPadActivity;
    /**
     * Generar actividad mínima de Rhythm para rellenar silencios
     */
    private generateMinimumRhythmActivity;
}
export {};
//# sourceMappingURL=Orchestrator.d.ts.map