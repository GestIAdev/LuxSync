/**
 * 🎵 AUDIO TO PATTERN MAPPER
 * Convierte audio raw (FFT) → patrones musicales que Selene entiende
 * 
 * FLUJO:
 * AudioFrame (bass/mid/treble/beat/bpm) → MusicalPattern (mood/energy/features)
 */

import { AudioFrame } from '../audio/index.js';

/**
 * MOODS MUSICALES
 */
export type MusicMood = 'chill' | 'build' | 'drop' | 'break';

/**
 * PATRÓN MUSICAL
 * Formato que Selene Consciousness puede procesar
 */
export interface MusicalPattern {
    mood: MusicMood;
    energy: number;              // 0-1 (energía general)
    bpm: number;
    spectralProfile: {
        bass: number;            // 0-1
        mid: number;             // 0-1
        treble: number;          // 0-1
    };
    entropy: number;             // 0-1 (orden vs caos)
    density: number;             // 0-1 (beats por segundo normalizado)
    spectralCentroid: number;    // Hz (centro de masa del espectro)
    timestamp: number;
}

/**
 * FEATURES MUSICALES EXTENDIDOS
 */
export interface MusicalFeatures {
    energy: number;
    density: number;
    spectralCentroid: number;
    spectralFlux: number;        // Cambio espectral frame a frame
    harmonicRatio: number;       // Armonicidad (0-1)
    entropy: number;
}

/**
 * AUDIO TO PATTERN MAPPER
 */
export class AudioToPatternMapper {
    private previousFrame: AudioFrame | null = null;
    
    /**
     * Detectar mood musical
     */
    detectMood(frame: AudioFrame): MusicMood {
        const { bass, mid, treble, beat, bpm } = frame;
        const energy = (bass + mid + treble) / 3;
        
        // BREAK: Silencio relativo o cambio abrupto
        if (energy < 0.15) {
            return 'break';
        }
        
        // DROP: Bass explosivo + BPM alto + energía alta
        if (bass > 0.7 && bpm > 120 && energy > 0.7) {
            return 'drop';
        }
        
        // BUILD: Energía creciente (si tenemos frame anterior)
        if (this.previousFrame) {
            const prevEnergy = (this.previousFrame.bass + this.previousFrame.mid + this.previousFrame.treble) / 3;
            const energyIncrease = energy - prevEnergy;
            
            if (energyIncrease > 0.1 && energy > 0.4) {
                return 'build';
            }
        }
        
        // CHILL: Bass bajo, BPM bajo, energía moderada
        if (bass < 0.3 && bpm < 100 && energy < 0.5) {
            return 'chill';
        }
        
        // Default: Chill si no hay match claro
        return energy > 0.5 ? 'build' : 'chill';
    }
    
    /**
     * Extraer features musicales
     */
    extractFeatures(frame: AudioFrame): MusicalFeatures {
        const { bass, mid, treble, rms, spectralCentroid, bpm } = frame;
        
        // Energy: Promedio de bandas de frecuencia
        const energy = (bass + mid + treble) / 3;
        
        // Density: Beats por segundo normalizado (0-1)
        // BPM 60-180 → 1-3 beats/sec → normalizado a 0-1
        const beatsPerSecond = bpm / 60;
        const density = Math.min(beatsPerSecond / 3, 1);
        
        // Spectral Flux: Cambio espectral (si tenemos frame anterior)
        let spectralFlux = 0;
        if (this.previousFrame) {
            const prevEnergy = (this.previousFrame.bass + this.previousFrame.mid + this.previousFrame.treble) / 3;
            spectralFlux = Math.abs(energy - prevEnergy);
        }
        
        // Harmonic Ratio: Más mid/treble → más armónico
        const harmonicRatio = (mid * 0.5 + treble * 0.3) / (bass * 0.2 + mid * 0.5 + treble * 0.3);
        
        // Entropy: Qué tan dispersa está la energía
        // Más uniforme → menos entropía, Más desigual → más entropía
        const total = bass + mid + treble;
        const p_bass = bass / total;
        const p_mid = mid / total;
        const p_treble = treble / total;
        
        const entropy = -(
            (p_bass > 0 ? p_bass * Math.log2(p_bass) : 0) +
            (p_mid > 0 ? p_mid * Math.log2(p_mid) : 0) +
            (p_treble > 0 ? p_treble * Math.log2(p_treble) : 0)
        ) / Math.log2(3); // Normalizado 0-1
        
        return {
            energy,
            density,
            spectralCentroid: spectralCentroid || 1000, // Fallback
            spectralFlux,
            harmonicRatio: Math.min(harmonicRatio, 1),
            entropy
        };
    }
    
    /**
     * Convertir AudioFrame → MusicalPattern
     */
    toSelenePattern(frame: AudioFrame): MusicalPattern {
        const mood = this.detectMood(frame);
        const features = this.extractFeatures(frame);
        
        const pattern: MusicalPattern = {
            mood,
            energy: features.energy,
            bpm: frame.bpm,
            spectralProfile: {
                bass: frame.bass,
                mid: frame.mid,
                treble: frame.treble
            },
            entropy: features.entropy,
            density: features.density,
            spectralCentroid: features.spectralCentroid,
            timestamp: frame.timestamp
        };
        
        // Guardar frame para próxima comparación
        this.previousFrame = frame;
        
        return pattern;
    }
    
    /**
     * Reset state (útil para testing)
     */
    reset(): void {
        this.previousFrame = null;
    }
}
