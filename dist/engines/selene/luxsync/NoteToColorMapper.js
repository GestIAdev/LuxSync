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
export class NoteToColorMapper {
    /**
     * Color mapping table
     * Currently only 3 notes active (DO/RE/MI) due to RAM constraints
     */
    static colorMap = {
        // Active nodes (3 nodes for 16GB RAM)
        'DO': {
            r: 255, g: 0, b: 0,
            name: 'red',
            hex: '#FF0000'
        }, // Bass (rojo fuego)
        'RE': {
            r: 255, g: 127, b: 0,
            name: 'orange',
            hex: '#FF7F00'
        }, // Balanced (naranja cálido)
        'MI': {
            r: 255, g: 255, b: 0,
            name: 'yellow',
            hex: '#FFFF00'
        }, // Treble (amarillo brillante)
        // Future nodes (when RAM allows 7-node system)
        'FA': {
            r: 0, g: 255, b: 0,
            name: 'green',
            hex: '#00FF00'
        }, // Mid-range
        'SOL': {
            r: 0, g: 255, b: 255,
            name: 'cyan',
            hex: '#00FFFF'
        }, // High-mid
        'LA': {
            r: 0, g: 0, b: 255,
            name: 'blue',
            hex: '#0000FF'
        }, // High
        'SI': {
            r: 255, g: 0, b: 255,
            name: 'magenta',
            hex: '#FF00FF'
        } // Very high
    };
    /**
     * Map musical note to RGB color
     */
    static mapNoteToColor(note) {
        const color = this.colorMap[note];
        if (!color) {
            console.warn(`⚠️  Unknown note "${note}", defaulting to orange (RE)`);
            return this.colorMap['RE']; // Default fallback
        }
        return color;
    }
    /**
     * Map Selene's beauty score (0.0-1.0) to DMX intensity (0-255)
     */
    static mapBeautyToIntensity(beauty) {
        // Clamp beauty to valid range
        const clamped = Math.max(0.0, Math.min(1.0, beauty));
        // Linear mapping: 0.0 → 0, 1.0 → 255
        return Math.round(clamped * 255);
    }
    /**
     * Apply intensity to RGB color (dimming)
     */
    static applyIntensity(color, intensity) {
        // Clamp intensity to DMX range
        const factor = Math.max(0, Math.min(255, intensity)) / 255;
        return {
            r: Math.round(color.r * factor),
            g: Math.round(color.g * factor),
            b: Math.round(color.b * factor),
            name: color.name,
            hex: this.rgbToHex(Math.round(color.r * factor), Math.round(color.g * factor), Math.round(color.b * factor))
        };
    }
    /**
     * Convert RGB to hex string
     */
    static rgbToHex(r, g, b) {
        const toHex = (n) => {
            const hex = Math.round(n).toString(16).padStart(2, '0');
            return hex.toUpperCase();
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    /**
     * Get all active colors (for UI display)
     */
    static getActiveColors() {
        // Only return colors for active nodes
        return [
            this.colorMap['DO'],
            this.colorMap['RE'],
            this.colorMap['MI']
        ];
    }
    /**
     * Get color for frequency band (alternative mapping)
     */
    static getColorForBand(band) {
        switch (band) {
            case 'bass':
                return this.colorMap['DO']; // Red
            case 'mid':
                return this.colorMap['RE']; // Orange
            case 'treble':
                return this.colorMap['MI']; // Yellow
            default:
                return this.colorMap['RE']; // Default
        }
    }
    /**
     * Create gradient between two notes (for smooth transitions)
     */
    static createGradient(from, to, steps) {
        const color1 = this.mapNoteToColor(from);
        const color2 = this.mapNoteToColor(to);
        const gradient = [];
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1); // 0.0 to 1.0
            gradient.push({
                r: Math.round(color1.r + (color2.r - color1.r) * t),
                g: Math.round(color1.g + (color2.g - color1.g) * t),
                b: Math.round(color1.b + (color2.b - color1.b) * t),
                name: `${color1.name}-to-${color2.name}`,
                hex: this.rgbToHex(Math.round(color1.r + (color2.r - color1.r) * t), Math.round(color1.g + (color2.g - color1.g) * t), Math.round(color1.b + (color2.b - color1.b) * t))
            });
        }
        return gradient;
    }
    /**
     * Get color name for debugging
     */
    static getColorName(note) {
        return this.mapNoteToColor(note).name;
    }
    /**
     * Get complementary color (opposite on color wheel)
     */
    static getComplementaryColor(note) {
        const color = this.mapNoteToColor(note);
        return {
            r: 255 - color.r,
            g: 255 - color.g,
            b: 255 - color.b,
            name: `complementary-${color.name}`,
            hex: this.rgbToHex(255 - color.r, 255 - color.g, 255 - color.b)
        };
    }
}
//# sourceMappingURL=NoteToColorMapper.js.map