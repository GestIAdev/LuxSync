/**
 * 🎨 NOTE TO COLOR MAPPER
 *
 * Maps Selene's musical notes to RGB colors for DMX lighting.
 * Simple 1:1 mapping for 3-node system (DO/RE/MI).
 *
 * Color Philosophy:
 * - DO (Red): Bass-heavy, energetic, fire
 * - RE (Orange): Balanced, warm, harmonious
 * - MI (Yellow): Treble-heavy, bright, clarity
 *
 * @date 2025-11-20
 * @author LuxSync Integration Team
 */
export type MusicalNote = 'DO' | 'RE' | 'MI' | 'FA' | 'SOL' | 'LA' | 'SI';
export interface RGB {
    r: number;
    g: number;
    b: number;
    name: string;
    hex: string;
}
export declare class NoteToColorMapper {
    /**
     * Color mapping table
     * Currently only 3 notes active (DO/RE/MI) due to RAM constraints
     */
    private static readonly colorMap;
    /**
     * Map musical note to RGB color
     */
    static mapNoteToColor(note: MusicalNote): RGB;
    /**
     * Map Selene's beauty score (0.0-1.0) to DMX intensity (0-255)
     */
    static mapBeautyToIntensity(beauty: number): number;
    /**
     * Apply intensity to RGB color (dimming)
     */
    static applyIntensity(color: RGB, intensity: number): RGB;
    /**
     * Convert RGB to hex string
     */
    private static rgbToHex;
    /**
     * Get all active colors (for UI display)
     */
    static getActiveColors(): RGB[];
    /**
     * Get color for frequency band (alternative mapping)
     */
    static getColorForBand(band: 'bass' | 'mid' | 'treble'): RGB;
    /**
     * Create gradient between two notes (for smooth transitions)
     */
    static createGradient(from: MusicalNote, to: MusicalNote, steps: number): RGB[];
    /**
     * Get color name for debugging
     */
    static getColorName(note: MusicalNote): string;
    /**
     * Get complementary color (opposite on color wheel)
     */
    static getComplementaryColor(note: MusicalNote): RGB;
}
//# sourceMappingURL=NoteToColorMapper.d.ts.map