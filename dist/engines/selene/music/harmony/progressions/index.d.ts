/**
 * � CHORD PROGRESSIONS CATALOG
 * Catálogo completo de progresiones armónicas
 */
import { ChordProgression } from '../ChordProgression.js';
/**
 * Catálogo completo de progresiones armónicas
 * Organizado por géneros musicales
 */
export declare const CHORD_PROGRESSIONS: {
    readonly pop: Record<string, ChordProgression>;
    readonly rock: Record<string, ChordProgression>;
    readonly jazz: Record<string, ChordProgression>;
    readonly blues: Record<string, ChordProgression>;
    readonly modal: Record<string, ChordProgression>;
    readonly classical: Record<string, ChordProgression>;
};
/**
 * Lista plana de todas las progresiones disponibles
 */
export declare const ALL_PROGRESSIONS: Record<string, ChordProgression>;
/**
 * Tipos de progresiones disponibles
 */
export type ProgressionGenre = keyof typeof CHORD_PROGRESSIONS;
/**
 * Obtener progresiones por género
 */
export declare function getProgressionsByGenre(genre: ProgressionGenre): Record<string, ChordProgression>;
/**
 * Obtener una progresión específica por ID
 */
export declare function getProgressionById(id: string): ChordProgression | undefined;
/**
 * Obtener progresiones por tags
 */
export declare function getProgressionsByTags(tags: string[]): Record<string, ChordProgression>;
/**
 * Estadísticas del catálogo
 */
export declare const PROGRESSIONS_STATS: {
    readonly total: number;
    readonly byGenre: {
        [k: string]: number;
    };
};
//# sourceMappingURL=index.d.ts.map