/**
 * 🌙 CONSCIOUSNESS INTEGRATION (LuxSync Simplified)
 * Integración simplificada de Selene Consciousness para LuxSync
 * 
 * CAPAS ACTIVAS:
 * 1. Hunting Layer - Caza de patrones (sentidos felinos)
 * 2. Dream Layer - Generación creativa
 * 3. Ethics Layer - Validación de seguridad
 * 4. Self-Analysis Layer - Aprendizaje
 * 5. Memory Layer - Persistencia (Redis opcional)
 * 
 * Nota: Esta es una versión STANDALONE que NO requiere dependencias pesadas de Selene
 */

import { MusicalPattern, MusicMood } from './AudioToPatternMapper.js';
import { LightScene, SceneGenes } from './SceneEvolver.js';

/**
 * TIPO DE PATRÓN ESTRUCTURAL
 */
export type StructuralPattern = 
    | 'intro'        // Intro/Apertura
    | 'verse'        // Verso
    | 'chorus'       // Estribillo/Coro
    | 'bridge'       // Puente
    | 'drop'         // Drop/Caída
    | 'breakdown'    // Breakdown/Ruptura
    | 'buildup'      // Build-up
    | 'outro';       // Outro/Cierre

/**
 * RESULTADO DE ANÁLISIS DE PATRÓN
 */
export interface PatternAnalysis {
    patternType: StructuralPattern;
    confidence: number;          // 0-1
    suggestions: string[];       // Sugerencias para la escena
    energyTrend: 'rising' | 'falling' | 'stable';
}

/**
 * SUGERENCIA CREATIVA (Dream Layer)
 */
export interface CreativeSuggestion {
    id: string;
    description: string;
    genes: Partial<SceneGenes>;
    novelty: number;             // 0-1 (qué tan nueva/experimental)
}

/**
 * VALIDACIÓN ÉTICA
 */
export interface EthicsValidation {
    safe: boolean;
    warnings: string[];
    adjustments: Partial<SceneGenes>;
}

/**
 * CONSCIENCIA SIMPLIFICADA
 */
export class ConsciousnessIntegration {
    private patternHistory: MusicalPattern[] = [];
    private sceneSuccessHistory: Map<string, number> = new Map();
    private patternCounts: Map<StructuralPattern, number> = new Map();
    
    // Thresholds para epilepsia
    private readonly MAX_STROBE_FREQUENCY = 10; // Hz
    private readonly MAX_BRIGHTNESS = 0.95;
    
    /**
     * HUNTING LAYER: Caza de patrones estructurales
     * Sentidos felinos detectan estructuras musicales
     */
    analyzePattern(pattern: MusicalPattern): PatternAnalysis {
        const { mood, energy, bpm, entropy } = pattern;
        
        // Detectar trend de energía (requiere historia)
        const energyTrend = this.detectEnergyTrend(pattern);
        
        // Inferir patrón estructural
        let patternType: StructuralPattern;
        let confidence = 0.7; // Base
        
        // Lógica de detección
        if (mood === 'break' && energy < 0.2) {
            patternType = 'breakdown';
            confidence = 0.9;
        } else if (mood === 'drop' && energy > 0.7) {
            patternType = 'drop';
            confidence = 0.95;
        } else if (mood === 'build' && energyTrend === 'rising') {
            patternType = 'buildup';
            confidence = 0.85;
        } else if (mood === 'chill' && energy < 0.4) {
            patternType = 'intro';
            confidence = 0.7;
        } else if (entropy > 0.6 && energy > 0.5) {
            patternType = 'chorus';
            confidence = 0.75;
        } else {
            patternType = 'verse';
            confidence = 0.6;
        }
        
        // Incrementar contador
        this.patternCounts.set(patternType, (this.patternCounts.get(patternType) || 0) + 1);
        
        // Generar sugerencias
        const suggestions = this.generateSuggestions(patternType, mood, energy);
        
        // Guardar en historia
        this.patternHistory.push(pattern);
        if (this.patternHistory.length > 100) {
            this.patternHistory.shift(); // Mantener solo últimos 100
        }
        
        return {
            patternType,
            confidence,
            suggestions,
            energyTrend
        };
    }
    
    /**
     * DREAM LAYER: Generación creativa
     * Exploración de ideas no obvias
     */
    dreamScenes(pattern: MusicalPattern, count: number = 3): CreativeSuggestion[] {
        const suggestions: CreativeSuggestion[] = [];
        
        // Sugerencia 1: Inversión de colores
        suggestions.push({
            id: `dream_${Date.now()}_1`,
            description: '¿Invertir colores? (Experimental)',
            genes: {
                colorPalette: this.invertColors(pattern.mood),
                complexity: 0.8
            },
            novelty: 0.7
        });
        
        // Sugerencia 2: Sincronización con armónicos
        suggestions.push({
            id: `dream_${Date.now()}_2`,
            description: 'Sincronizar con armónicos (Matemático)',
            genes: {
                movementSpeed: pattern.spectralProfile.treble * 0.5,
                fadeTime: 1000 / (pattern.bpm / 60) // Basado en BPM
            },
            novelty: 0.5
        });
        
        // Sugerencia 3: Extremo creativo
        suggestions.push({
            id: `dream_${Date.now()}_3`,
            description: 'Caos controlado (Artístico)',
            genes: {
                strobeIntensity: pattern.entropy * 0.6,
                complexity: 0.9,
                brightness: pattern.energy * 0.8
            },
            novelty: 0.9
        });
        
        return suggestions.slice(0, count);
    }
    
    /**
     * ETHICS LAYER: Validación de seguridad
     * Previene strobes peligrosos y cambios bruscos
     */
    ethicsCheck(scene: LightScene): EthicsValidation {
        const { genes } = scene;
        const warnings: string[] = [];
        const adjustments: Partial<SceneGenes> = {};
        let safe = true;
        
        // Check 1: Strobe demasiado intenso
        if (genes.strobeIntensity > 0.7 && genes.fadeTime < 100) {
            warnings.push('⚠️ Strobe intensity too high (epilepsy risk)');
            adjustments.strobeIntensity = 0.7;
            adjustments.fadeTime = Math.max(genes.fadeTime, 100);
            safe = false;
        }
        
        // Check 2: Brightness demasiado alto
        if (genes.brightness > this.MAX_BRIGHTNESS) {
            warnings.push('⚠️ Brightness too high (eye strain risk)');
            adjustments.brightness = this.MAX_BRIGHTNESS;
            safe = false;
        }
        
        // Check 3: Cambios demasiado rápidos
        if (genes.fadeTime < 50) {
            warnings.push('⚠️ Fade time too short (jarring transitions)');
            adjustments.fadeTime = 50;
            safe = false;
        }
        
        // Check 4: Movement speed extremo
        if (genes.movementSpeed > 0.95) {
            warnings.push('ℹ️ Movement speed very high (may be disorienting)');
            adjustments.movementSpeed = 0.9;
            // No marcar como unsafe, solo warning
        }
        
        return {
            safe,
            warnings,
            adjustments
        };
    }
    
    /**
     * SELF-ANALYSIS LAYER: Aprendizaje continuo
     * Analiza qué escenas funcionan mejor
     */
    selfAnalysis(): {
        insights: string[];
        bestPatterns: StructuralPattern[];
        avgSuccessRate: number;
    } {
        const insights: string[] = [];
        
        // Calcular success rate promedio
        let totalSuccess = 0;
        let count = 0;
        this.sceneSuccessHistory.forEach(fitness => {
            totalSuccess += fitness;
            count++;
        });
        const avgSuccessRate = count > 0 ? totalSuccess / count : 0.5;
        
        // Identificar patrones más comunes
        const sortedPatterns = Array.from(this.patternCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        
        const bestPatterns = sortedPatterns.map(([pattern]) => pattern);
        
        // Generar insights
        if (avgSuccessRate > 0.7) {
            insights.push('✅ Sistema funcionando bien (avg fitness > 0.7)');
        } else if (avgSuccessRate < 0.4) {
            insights.push('⚠️ Rendimiento bajo - considerar ajustes');
        }
        
        if (bestPatterns.length > 0) {
            insights.push(`📊 Patrones más comunes: ${bestPatterns.join(', ')}`);
        }
        
        if (this.patternHistory.length > 50) {
            const recentEnergy = this.patternHistory.slice(-10).map(p => p.energy);
            const avgRecent = recentEnergy.reduce((a, b) => a + b, 0) / recentEnergy.length;
            insights.push(`⚡ Energía promedio reciente: ${(avgRecent * 100).toFixed(0)}%`);
        }
        
        return {
            insights,
            bestPatterns,
            avgSuccessRate
        };
    }
    
    /**
     * MEMORY LAYER: Recordar escenas exitosas
     * (Versión simplificada sin Redis)
     */
    rememberScene(scene: LightScene, success: number): void {
        this.sceneSuccessHistory.set(scene.id, success);
        
        // Mantener solo últimas 100 escenas
        if (this.sceneSuccessHistory.size > 100) {
            const oldestKey = this.sceneSuccessHistory.keys().next().value;
            if (oldestKey) {
                this.sceneSuccessHistory.delete(oldestKey);
            }
        }
    }
    
    /**
     * Recuperar escenas similares exitosas
     */
    recallSuccessfulScenes(mood: MusicMood, minFitness: number = 0.7): string[] {
        const successful: string[] = [];
        
        this.sceneSuccessHistory.forEach((fitness, sceneId) => {
            if (fitness >= minFitness) {
                successful.push(sceneId);
            }
        });
        
        return successful;
    }
    
    // ===== HELPERS PRIVADOS =====
    
    private detectEnergyTrend(pattern: MusicalPattern): 'rising' | 'falling' | 'stable' {
        if (this.patternHistory.length < 3) return 'stable';
        
        const recent = this.patternHistory.slice(-3);
        const energies = recent.map(p => p.energy);
        
        const first = energies[0];
        const last = energies[energies.length - 1];
        
        const delta = last - first;
        
        if (delta > 0.15) return 'rising';
        if (delta < -0.15) return 'falling';
        return 'stable';
    }
    
    private generateSuggestions(
        patternType: StructuralPattern,
        mood: MusicMood,
        energy: number
    ): string[] {
        const suggestions: string[] = [];
        
        switch (patternType) {
            case 'drop':
                suggestions.push('💥 Strobes intensos, colores cálidos');
                suggestions.push('⚡ Movimiento rápido, alta energía');
                break;
            case 'buildup':
                suggestions.push('📈 Incrementar intensidad gradualmente');
                suggestions.push('🌈 Transiciones suaves de color');
                break;
            case 'breakdown':
                suggestions.push('🌙 Colores suaves, movimiento lento');
                suggestions.push('✨ Fade in/out gradual');
                break;
            case 'chorus':
                suggestions.push('🎵 Colores vibrantes, alta complejidad');
                suggestions.push('🎸 Sincronización con beat');
                break;
            default:
                suggestions.push('🎨 Escena balanceada');
        }
        
        return suggestions;
    }
    
    private invertColors(mood: MusicMood): string[] {
        // Colores invertidos/complementarios
        switch (mood) {
            case 'chill':
                return ['#FF7F00', '#FF00FF', '#7F7F00']; // Complemento de blues
            case 'drop':
                return ['#00FFFF', '#00FF00', '#000080']; // Complemento de rojos
            case 'build':
                return ['#007FFF', '#0000FF', '#00FF7F']; // Complemento de naranjas
            default:
                return ['#FFFFFF', '#000000', '#808080'];
        }
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            patternHistorySize: this.patternHistory.length,
            sceneMemorySize: this.sceneSuccessHistory.size,
            patternCounts: Object.fromEntries(this.patternCounts)
        };
    }
}
