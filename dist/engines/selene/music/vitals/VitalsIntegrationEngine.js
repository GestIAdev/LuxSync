/**
 * 🎸 VITALS INTEGRATION ENGINE
 * Traduce estado del sistema a decisiones musicales
 */
/**
 * VITALS INTEGRATION ENGINE
 * Traduce estado del sistema a decisiones musicales
 */
export class VitalsIntegrationEngine {
    mapper;
    previousState;
    constructor(influenceStrength = 0.7) {
        this.mapper = this.createDefaultMapper(influenceStrength);
    }
    /**
     * Aplicar influencia de vitals a estilo
     */
    applyVitalsToStyle(style, vitals) {
        // Deep copy para evitar mutación
        const modified = JSON.parse(JSON.stringify(style));
        // 1. Detectar estado emocional
        const emotionalState = this.detectEmotionalState(vitals);
        // 2. Aplicar mapeo de stress
        if (vitals.stress > 0.5) {
            const stressBoost = this.mapper.stressMapping.tempoMultiplier(vitals.stress);
            modified.musical.tempo *= stressBoost;
            const dissonanceBoost = this.mapper.stressMapping.dissonanceBoost(vitals.stress);
            modified.musical.harmonic.dissonanceLevel += dissonanceBoost;
            modified.musical.harmonic.dissonanceLevel = Math.min(1, modified.musical.harmonic.dissonanceLevel);
            const rhythmBoost = this.mapper.stressMapping.rhythmDensityBoost(vitals.stress);
            if (modified.musical.rhythmic.complexity === 'simple') {
                modified.musical.rhythmic.complexity = 'moderate';
            }
            else if (modified.musical.rhythmic.complexity === 'moderate') {
                modified.musical.rhythmic.complexity = 'complex';
            }
            const intensityBoost = this.mapper.stressMapping.intensityBoost(vitals.stress);
            // Ajustar intensidad de todas las secciones (se aplica después)
        }
        // 3. Aplicar mapeo de harmony
        if (vitals.harmony > 0.7) {
            const consonanceBoost = this.mapper.harmonyMapping.consonanceBoost(vitals.harmony);
            modified.musical.harmonic.dissonanceLevel -= consonanceBoost;
            modified.musical.harmonic.dissonanceLevel = Math.max(0, modified.musical.harmonic.dissonanceLevel);
            // Preferir modos consonantes
            if (modified.musical.mode === 'phrygian' || modified.musical.mode === 'locrian') {
                modified.musical.mode = 'dorian'; // Más suave
            }
            // Simplificar acordes si harmony es MUY alto
            if (vitals.harmony > 0.85) {
                if (modified.musical.harmonic.chordComplexity === 'extended') {
                    modified.musical.harmonic.chordComplexity = 'seventh';
                }
                else if (modified.musical.harmonic.chordComplexity === 'seventh') {
                    modified.musical.harmonic.chordComplexity = 'triads';
                }
            }
            // Más legato
            for (const layerKey in modified.layers) {
                const layer = modified.layers[layerKey];
                if (layer && typeof layer === 'object' && 'articulation' in layer) {
                    layer.articulation = 'legato';
                }
            }
        }
        // 4. Aplicar mapeo de creativity
        if (vitals.creativity > 0.6) {
            const entropyBoost = this.mapper.creativityMapping.entropyBoost(vitals.creativity);
            // Este boost se aplicará al entropyFactor del modo
            // Aumentar ornamentación
            const ornamentLevel = this.mapper.creativityMapping.ornamentationLevel(vitals.creativity);
            modified.musical.melodic.ornamentation = ornamentLevel;
            // Preferir progresiones complejas
            if (vitals.creativity > 0.8) {
                if (modified.musical.harmonic.progressionType === 'tonal') {
                    modified.musical.harmonic.progressionType = 'modal';
                }
            }
        }
        return modified;
    }
    /**
     * Detectar estado emocional desde vitals
     */
    detectEmotionalState(vitals) {
        const stress = vitals.stress;
        const harmony = vitals.harmony;
        const creativity = vitals.creativity;
        let primary;
        let intensity;
        // Lógica de detección (diagrama de decisión)
        if (stress < 0.3 && harmony > 0.7) {
            primary = 'calm';
            intensity = harmony;
        }
        else if (stress < 0.3 && harmony > 0.8) {
            primary = 'meditative';
            intensity = harmony;
        }
        else if (stress > 0.7 && harmony < 0.3) {
            primary = 'anxious';
            intensity = stress;
        }
        else if (stress > 0.6 && harmony < 0.4) {
            primary = 'tense';
            intensity = stress;
        }
        else if (creativity > 0.7 && harmony > 0.7) {
            primary = 'euphoric';
            intensity = (creativity + harmony) / 2;
        }
        else if (creativity > 0.6 && stress > 0.5) {
            primary = 'energetic';
            intensity = creativity;
        }
        else if (creativity < 0.4 && harmony < 0.4) {
            primary = 'melancholic';
            intensity = 1 - harmony;
        }
        else if (stress > 0.7 && creativity > 0.7 && harmony < 0.4) {
            primary = 'chaotic';
            intensity = stress;
        }
        else {
            // Estado neutral/mixto
            primary = 'calm';
            intensity = 0.5;
        }
        // Detectar transición si hay estado previo
        let transition = undefined;
        if (this.previousState && this.previousState.primary !== primary) {
            transition = {
                from: this.previousState.primary,
                to: primary,
                progress: 0.5 // Asumimos transición a mitad (se puede refinar)
            };
        }
        const state = {
            primary,
            intensity,
            transition
        };
        this.previousState = state;
        return state;
    }
    /**
     * Generar ajustes de modo desde vitals
     */
    generateModeAdjustments(vitals) {
        const adjustments = {};
        // Creativity → entropy
        if (vitals.creativity > 0.6) {
            const creativityBoost = Math.floor(vitals.creativity * 40);
            adjustments.entropyFactor = Math.min(100, creativityBoost);
        }
        // Stress → risk
        if (vitals.stress > 0.5) {
            const stressBoost = Math.floor(vitals.stress * 50);
            adjustments.riskThreshold = Math.min(100, 50 + stressBoost);
        }
        // Harmony inverso → punk
        if (vitals.harmony < 0.4) {
            const harmonyDeficit = 1 - vitals.harmony;
            const punkBoost = Math.floor(harmonyDeficit * 60);
            adjustments.punkProbability = Math.min(100, punkBoost);
        }
        return adjustments;
    }
    /**
     * Crear mapper por defecto
     */
    createDefaultMapper(strength) {
        return {
            stressMapping: {
                tempoMultiplier: (stress) => 1 + (stress * 0.4 * strength),
                dissonanceBoost: (stress) => stress * 0.3 * strength,
                rhythmDensityBoost: (stress) => stress * 0.4 * strength,
                intensityBoost: (stress) => stress * 0.2 * strength
            },
            harmonyMapping: {
                consonanceBoost: (harmony) => harmony * 0.4 * strength,
                modePreference: (harmony) => {
                    if (harmony > 0.8)
                        return 'major';
                    if (harmony > 0.6)
                        return 'lydian';
                    if (harmony > 0.4)
                        return 'dorian';
                    return 'phrygian';
                },
                chordSimplification: (harmony) => harmony * strength,
                textureSmoothing: (harmony) => harmony * strength
            },
            creativityMapping: {
                entropyBoost: (creativity) => creativity * 40 * strength,
                motifVariationBoost: (creativity) => creativity * strength,
                progressionComplexity: (creativity) => creativity * strength,
                ornamentationLevel: (creativity) => {
                    if (creativity > 0.8)
                        return 'heavy';
                    if (creativity > 0.6)
                        return 'moderate';
                    if (creativity > 0.4)
                        return 'minimal';
                    return 'none';
                }
            },
            influenceStrength: strength
        };
    }
}
/**
 * COHERENCE ENGINE
 * Asegura que MIDI y Poetry reflejen el mismo estado emocional
 */
export class CoherenceEngine {
    /**
     * Validar coherencia entre MIDI y Poetry
     */
    validateCoherence(midiMetadata, poetry, vitals) {
        const emotionalState = this.detectEmotionalFromVitals(vitals);
        // Analizar mood de MIDI
        const midiMood = this.analyzeMIDIMood(midiMetadata);
        // Analizar mood de Poetry
        const poetryMood = this.analyzePoetryMood(poetry);
        // Calcular coherencia (0-1)
        const coherenceScore = this.calculateCoherence(emotionalState, midiMood, poetryMood);
        return {
            coherenceScore,
            emotionalState,
            midiMood,
            poetryMood,
            issues: coherenceScore < 0.7 ? this.identifyIssues(emotionalState, midiMood, poetryMood) : []
        };
    }
    /**
     * Analizar mood de MIDI
     */
    analyzeMIDIMood(metadata) {
        // Heurísticas simples
        const tempo = metadata.tempo;
        const mode = metadata.mode;
        if (tempo > 140 && (mode === 'minor' || mode === 'phrygian')) {
            return 'anxious';
        }
        else if (tempo > 120 && mode === 'major') {
            return 'energetic';
        }
        else if (tempo < 70 && (mode === 'phrygian' || mode === 'locrian')) {
            return 'melancholic';
        }
        else if (tempo < 70 && mode === 'major') {
            return 'calm';
        }
        return 'calm';
    }
    /**
     * Analizar mood de Poetry
     */
    analyzePoetryMood(poetry) {
        const text = poetry.fullText.toLowerCase();
        // Keywords por mood
        const keywords = {
            calm: ['sereno', 'tranquilo', 'paz', 'calma', 'suave'],
            anxious: ['caos', 'tormenta', 'angustia', 'fractura', 'colapso'],
            energetic: ['fuego', 'energía', 'explosión', 'fuerza', 'poder'],
            melancholic: ['sombra', 'vacío', 'nostalgia', 'pérdida', 'silencio']
        };
        // Contar matches
        let bestMood = 'calm';
        let maxMatches = 0;
        for (const [mood, words] of Object.entries(keywords)) {
            const matches = words.filter(w => text.includes(w)).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                bestMood = mood;
            }
        }
        return bestMood;
    }
    /**
     * Calcular coherencia
     */
    calculateCoherence(target, midi, poetry) {
        let score = 0;
        if (midi === target)
            score += 0.5;
        if (poetry === target)
            score += 0.5;
        // Bonus si MIDI y Poetry coinciden entre sí
        if (midi === poetry)
            score += 0.2;
        return Math.min(1, score);
    }
    detectEmotionalFromVitals(vitals) {
        // Simple mapping for coherence
        if (vitals.stress > 0.7)
            return 'anxious';
        if (vitals.harmony > 0.7)
            return 'calm';
        if (vitals.creativity > 0.7)
            return 'energetic';
        return 'calm';
    }
    identifyIssues(target, midi, poetry) {
        const issues = [];
        if (midi !== target) {
            issues.push(`MIDI mood (${midi}) no coincide con target (${target})`);
        }
        if (poetry !== target) {
            issues.push(`Poetry mood (${poetry}) no coincide con target (${target})`);
        }
        if (midi !== poetry) {
            issues.push(`MIDI y Poetry tienen moods diferentes (${midi} vs ${poetry})`);
        }
        return issues;
    }
}
//# sourceMappingURL=VitalsIntegrationEngine.js.map