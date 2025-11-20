/**
 * 🎸 FEEDBACK ENGINE
 * Procesa feedback y ajusta pesos para evolución
 */

import { ModeConfig } from '../core/types.js'

/**
 * FEEDBACK DEL USUARIO
 */
export interface EngineFeedback {
    // Tags descriptivos
    tags: string[]

    // Rating 1-5
    rating: number

    // Timestamp
    timestamp: number

    // Metadata opcional
    metadata?: {
        generationId?: string
        stylePreset?: string
        duration?: number
    }
}

/**
 * FEEDBACK PROCESADO
 * Interpretación estructurada del feedback de usuario
 */
export interface ProcessedFeedback {
    // Feedback original
    original: EngineFeedback

    // Tags categorizados
    categorizedTags: CategorizedTags

    // Ajustes derivados
    derivedAdjustments: FeedbackAdjustments

    // Confianza en la interpretación
    confidence: number          // 0-1
}

/**
 * TAGS CATEGORIZADOS
 */
export interface CategorizedTags {
    // Tempo/Ritmo
    tempo: string[]             // ['too-fast', 'too-slow', 'perfect-tempo']
    rhythm: string[]            // ['too-busy', 'boring', 'good-rhythm']

    // Armonía
    harmony: string[]           // ['too-dissonant', 'too-simple', 'nice-chords']

    // Melodía
    melody: string[]            // ['repetitive', 'unpredictable', 'catchy']

    // Estructura
    structure: string[]         // ['too-short', 'too-long', 'good-flow']

    // Emoción
    emotion: string[]           // ['too-sad', 'uplifting', 'tense']

    // General
    general: string[]           // ['amazing', 'meh', 'weird']
}

/**
 * AJUSTES DERIVADOS DEL FEEDBACK
 */
export interface FeedbackAdjustments {
    // Ajustes de pesos
    weights: {
        tempoMultiplier?: number        // ×0.9 si 'too-fast', ×1.1 si 'too-slow'
        varietyWeight?: number          // +0.1 si 'repetitive'
        creativityWeight?: number       // +0.1 si 'boring'
        dissonanceReduction?: number    // -0.2 si 'too-dissonant'
        complexityBoost?: number        // +0.1 si 'too-simple'
    }

    // Ajustes de preferencias
    preferences: {
        preferredModes?: string[]
        preferredProgressions?: string[]
        preferredStyles?: string[]
        avoidedCharacteristics?: string[]
    }

    // Metadata
    appliedAt: number
    expiresAt?: number          // Opcional: cuándo expiran estos ajustes
}

/**
 * LEARNING WEIGHTS
 * Pesos que evolucionan con el feedback acumulado
 */
export interface LearningWeights {
    // Pesos de estilo
    styleWeights: Map<string, number>       // 'cyberpunk-ambient' → 0.8 (usuario lo prefiere)

    // Pesos de progresión
    progressionWeights: Map<string, number> // 'jazz-251' → 0.9

    // Pesos de modo
    modeWeights: Map<string, string>    // 'dorian' → 0.85

    // Pesos de tempo
    tempoPreference: {
        min: number
        max: number
        ideal: number
    }

    // Pesos de complejidad
    complexityPreference: {
        harmonic: number        // 0-1
        melodic: number         // 0-1
        rhythmic: number        // 0-1
    }

    // Historial
    totalFeedbackCount: number
    positiveCount: number
    negativeCount: number
    lastUpdated: number
}

/**
 * FEEDBACK ENGINE
 * Procesa feedback y ajusta pesos para evolución
 */
export class FeedbackEngine {
    private weights: LearningWeights
    private feedbackHistory: ProcessedFeedback[]
    // private redisClient: RedisClient  // TODO: Implementar cuando esté disponible

    constructor() {
        this.weights = this.initializeWeights()
        this.feedbackHistory = []
    }

    /**
     * Procesar feedback de usuario
     */
    async processFeedback(feedback: EngineFeedback): Promise<ProcessedFeedback> {
        // 1. Categorizar tags
        const categorizedTags = this.categorizeTags(feedback.tags)

        // 2. Derivar ajustes
        const derivedAdjustments = this.deriveAdjustments(
            categorizedTags,
            feedback.rating
        )

        // 3. Calcular confianza
        const confidence = this.calculateConfidence(feedback)

        const processed: ProcessedFeedback = {
            original: feedback,
            categorizedTags,
            derivedAdjustments,
            confidence
        }

        // 4. Aplicar ajustes a weights
        await this.applyAdjustments(processed)

        // 5. Guardar en historial
        this.feedbackHistory.push(processed)

        // 6. Persistir weights
        await this.saveWeights()

        return processed
    }

    /**
     * Categorizar tags
     */
    private categorizeTags(tags: string[]): CategorizedTags {
        const categorized: CategorizedTags = {
            tempo: [],
            rhythm: [],
            harmony: [],
            melody: [],
            structure: [],
            emotion: [],
            general: []
        }

        const categoryKeywords = {
            tempo: ['fast', 'slow', 'tempo', 'speed', 'bpm'],
            rhythm: ['rhythm', 'beat', 'groove', 'busy', 'sparse'],
            harmony: ['chord', 'harmony', 'dissonant', 'consonant', 'progression'],
            melody: ['melody', 'tune', 'repetitive', 'catchy', 'boring'],
            structure: ['structure', 'long', 'short', 'section', 'flow'],
            emotion: ['sad', 'happy', 'tense', 'calm', 'energetic', 'mood']
        }

        for (const tag of tags) {
            const tagLower = tag.toLowerCase()
            let categorized_flag = false

            for (const [category, keywords] of Object.entries(categoryKeywords)) {
                if (keywords.some(kw => tagLower.includes(kw))) {
                    categorized[category as keyof CategorizedTags].push(tag)
                    categorized_flag = true
                    break
                }
            }

            if (!categorized_flag) {
                categorized.general.push(tag)
            }
        }

        return categorized
    }

    /**
     * Derivar ajustes desde tags
     */
    private deriveAdjustments(
        tags: CategorizedTags,
        rating: number
    ): FeedbackAdjustments {
        const weights: FeedbackAdjustments['weights'] = {}
        const preferences: FeedbackAdjustments['preferences'] = {}

        // TEMPO
        if (tags.tempo.some(t => t.includes('too-fast') || t.includes('fast'))) {
            weights.tempoMultiplier = 0.9  // Reducir 10%
        } else if (tags.tempo.some(t => t.includes('too-slow') || t.includes('slow'))) {
            weights.tempoMultiplier = 1.1  // Aumentar 10%
        }

        // MELODÍA
        if (tags.melody.some(t => t.includes('repetitive'))) {
            weights.varietyWeight = 0.15  // Aumentar variedad
        } else if (tags.melody.some(t => t.includes('boring'))) {
            weights.creativityWeight = 0.15
            weights.varietyWeight = 0.1
        } else if (tags.melody.some(t => t.includes('unpredictable') || t.includes('chaotic'))) {
            weights.varietyWeight = -0.1  // Reducir variedad
        }

        // ARMONÍA
        if (tags.harmony.some(t => t.includes('dissonant') || t.includes('harsh'))) {
            weights.dissonanceReduction = 0.2  // Reducir disonancia
        } else if (tags.harmony.some(t => t.includes('simple') || t.includes('boring-chords'))) {
            weights.complexityBoost = 0.15  // Aumentar complejidad
        }

        // ESTRUCTURA
        if (tags.structure.some(t => t.includes('too-short'))) {
            // Se maneja en siguiente generación
        } else if (tags.structure.some(t => t.includes('too-long'))) {
            // Se maneja en siguiente generación
        }

        // RATING GENERAL
        if (rating >= 4) {
            // Feedback positivo: reforzar características usadas
            // (se extrae del metadata de la generación)
        } else if (rating <= 2) {
            // Feedback negativo: evitar características usadas
        }

        return {
            weights,
            preferences,
            appliedAt: Date.now()
        }
    }

    /**
     * Aplicar ajustes a learning weights
     */
    private async applyAdjustments(feedback: ProcessedFeedback): Promise<void> {
        const adjustments = feedback.derivedAdjustments
        const confidence = feedback.confidence

        // Aplicar con factor de confianza
        if (adjustments.weights.tempoMultiplier) {
            const currentIdeal = this.weights.tempoPreference.ideal
            const adjustment = adjustments.weights.tempoMultiplier
            this.weights.tempoPreference.ideal = currentIdeal * (1 + (adjustment - 1) * confidence)
        }

        if (adjustments.weights.dissonanceReduction) {
            // Ajustar preferencia de complejidad armónica
            this.weights.complexityPreference.harmonic -= adjustments.weights.dissonanceReduction * confidence
            this.weights.complexityPreference.harmonic = Math.max(0, this.weights.complexityPreference.harmonic)
        }

        if (adjustments.weights.complexityBoost) {
            this.weights.complexityPreference.harmonic += adjustments.weights.complexityBoost * confidence
            this.weights.complexityPreference.harmonic = Math.min(1, this.weights.complexityPreference.harmonic)
        }

        if (adjustments.weights.varietyWeight) {
            this.weights.complexityPreference.melodic += adjustments.weights.varietyWeight * confidence
            this.weights.complexityPreference.melodic = Math.min(1, Math.max(0, this.weights.complexityPreference.melodic))
        }

        // Actualizar contadores
        this.weights.totalFeedbackCount++
        if (feedback.original.rating >= 4) {
            this.weights.positiveCount++
        } else if (feedback.original.rating <= 2) {
            this.weights.negativeCount++
        }
        this.weights.lastUpdated = Date.now()
    }

    /**
     * Calcular confianza en interpretación
     */
    private calculateConfidence(feedback: EngineFeedback): number {
        let confidence = 0.5  // Base

        // Más tags = más confianza
        if (feedback.tags.length >= 3) confidence += 0.2
        if (feedback.tags.length >= 5) confidence += 0.1

        // Rating extremo = más confianza
        if (feedback.rating === 5 || feedback.rating === 1) confidence += 0.2

        return Math.min(1, confidence)
    }

    /**
     * Cargar weights desde Redis
     */
    async loadWeights(): Promise<void> {
        // TODO: Implementar cuando redisClient esté disponible
        // const stored = await this.redisClient.get('music-engine:learning-weights')
        // if (stored) {
        //     this.weights = JSON.parse(stored)
        // }
    }

    /**
     * Guardar weights en Redis
     */
    async saveWeights(): Promise<void> {
        // TODO: Implementar cuando redisClient esté disponible
        // await this.redisClient.set(
        //     'music-engine:learning-weights',
        //     JSON.stringify(this.weights),
        //     'EX',
        //     60 * 60 * 24 * 365  // 1 año
        // )
    }

    /**
     * Aplicar learning weights a generación
     */
    applyWeightsToParams(params: import('../core/interfaces.js').MusicGenerationParams): import('../core/interfaces.js').MusicGenerationParams {
        const adjusted = { ...params }

        // Ajustar tempo según preferencia aprendida
        if (params.advanced?.tempo) {
            const tempoAdjustment = this.weights.tempoPreference.ideal / 120  // 120 = base
            adjusted.advanced = {
                ...params.advanced,
                tempo: params.advanced.tempo * tempoAdjustment
            }
        }

        // Ajustar complejidad
        adjusted.complexity = (adjusted.complexity + this.weights.complexityPreference.harmonic) / 2

        return adjusted
    }

    /**
     * Inicializar weights por defecto
     */
    private initializeWeights(): LearningWeights {
        return {
            styleWeights: new Map(),
            progressionWeights: new Map(),
            modeWeights: new Map(),
            tempoPreference: {
                min: 60,
                max: 160,
                ideal: 120
            },
            complexityPreference: {
                harmonic: 0.5,
                melodic: 0.5,
                rhythmic: 0.5
            },
            totalFeedbackCount: 0,
            positiveCount: 0,
            negativeCount: 0,
            lastUpdated: Date.now()
        }
    }
}

