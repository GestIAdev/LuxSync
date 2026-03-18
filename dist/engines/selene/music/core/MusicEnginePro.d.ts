/**
 * 🎸 MUSIC ENGINE PRO - API PRINCIPAL
 */
import { MusicGenerationParams, MusicEngineOutput } from './interfaces.js';
import { VitalSigns } from './types.js';
export interface TrackMetadata {
    empiricalIndex: number;
    trackType: string;
    instrumentKey: string;
    instrumentType: 'multisample' | 'oneshot';
}
export declare class MusicEnginePro {
    private styleEngine;
    private structureEngine;
    private harmonyEngine;
    private melodyEngine;
    private vitalsEngine;
    private orchestrator;
    private renderer;
    private drumEngine;
    private sonicPalette;
    private melodicLayers;
    constructor();
    generate(params: MusicGenerationParams, vitals?: VitalSigns): Promise<MusicEngineOutput>;
    generateFromConsensus(result: any): Promise<MusicEngineOutput>;
    quickGenerate(style: string, duration: number, seed: number): Promise<MusicEngineOutput>;
    private consensusToParams;
    /**
     * � FASE 5.9: CREAR PALETA SÓNICA DETERMINISTA
     *
     * Crea la paleta completa de instrumentos para la canción:
     * - Decide el VIBE global (chill vs dubchill) basado en seed
     * - Elige UN instrumento de harmony (se queda toda la canción)
     * - Elige UN instrumento de melody (se queda toda la canción)
     * - Copia los pools completos de rhythm/bass (para elegir según intensity)
     *
     * LLAMAR UNA SOLA VEZ al inicio de generate(), antes del loop de secciones.
     */
    private createSonicPalette;
    /**
     * � FASE 6.0 - FRENTE #A: Selección Multicapa (AND logic)
     *
     * En lugar de elegir 1 solo instrumento melódico, elige 2-4 capas simultáneas
     * usando los pools temáticos (strings, plucks, vocals, leads) según estrategia del vibe.
     *
     * COMPORTAMIENTO:
     * - Chill: 2-3 capas (strings base + plucks/vocals)
     * - Dubchill: 3-4 capas (strings + plucks + vocals + leads)
     * - Selección determinista usando SeededRandom
     * - Sin repetir instrumentos en la misma canción
     *
     * @param preset - StylePreset con melodicLayerPools y layerStrategies
     * @param prng - SeededRandom para selección determinista
     * @returns Array de 2-4 InstrumentSelection (capas simultáneas)
     */
    private selectMelodicLayers;
    /**
     * �🎨 SCHERZO SÓNICO - Fase 4.1: Selección Dinámica de Instrumentos
     * 🎸 FASE 5.9: REFACTORIZADO para usar SonicPalette
     *
     * COMPORTAMIENTO:
     * - Harmony/Melody: SIEMPRE retornar el instrumento fijo de la paleta (no cambia)
     * - Rhythm/Bass: Elegir del pool según intensity de la sección (cambia dinámicamente)
     *
     * @param section - Sección actual (contiene intensity en profile)
     * @param layer - Layer musical ('melody', 'harmony', 'bass', 'rhythm', 'pad')
     * @param stylePreset - Preset de estilo con arsenal de instrumentos
     * @returns InstrumentSelection con key y type, o fallback
     */
    private selectInstrumentForSection;
    private addToTrack;
    /**
     * ✅ HELPER: Convertir MIDINote[][] (chords del HarmonyEngine) a ResolvedChord[]
     * Respeta section.duration y section.bars para calcular tiempos correctos
     */
    private convertToResolvedChords;
    private generatePoetry;
    private persistOutput;
    private reportMetrics;
    /**
     * Generate transition fills between sections
     */
    private generateTransitionFill;
}
//# sourceMappingURL=MusicEnginePro.d.ts.map