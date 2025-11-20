/**
 * 🎸 STYLE ENGINE
 * Motor de resolución de estilos
 */

import { StylePreset, ResolvedStyle } from './StylePreset.js'
import { ModeConfig, VitalSigns } from '../core/types.js'
import { PRESET_CATALOG } from './presets/index.js'
import { MusicGenerationParams } from '../core/interfaces.js'

export class StyleEngine {
    private presets: Map<string, StylePreset>
    private customPresets: Map<string, StylePreset>

    constructor() {
        this.presets = new Map(Object.entries(PRESET_CATALOG))
        this.customPresets = new Map()
    }

    /**
     * Resolver estilo desde parámetros de generación
     */
    resolveStyle(
        params: MusicGenerationParams,
        modeConfig: ModeConfig,
        vitals?: VitalSigns
    ): ResolvedStyle {
        // 1. Cargar preset base
        let style: StylePreset

        if (params.stylePreset) {
            style = this.loadPreset(params.stylePreset)
        } else {
            // Sin preset explícito: generar desde beauty/seed
            style = this.generateStyleFromSeed(params.seed, params.beauty)
        }

        // 2. Aplicar overrides de modo
        style = this.applyModeOverrides(style, modeConfig)

        // 3. Aplicar influencia de SystemVitals
        if (vitals) {
            style = this.applyVitalsInfluence(style, vitals)
        }

        // 4. Aplicar overrides explícitos del usuario
        if (params.styleOverrides) {
            style = this.applyUserOverrides(style, params.styleOverrides)
        }

        // 5. Validar y normalizar
        style = this.validateAndNormalize(style)

        return {
            preset: style,
            effectiveParams: this.computeEffectiveParams(style, modeConfig)
        }
    }

    /**
     * Cargar preset desde catálogo
     */
    private loadPreset(presetId: string): StylePreset {
        const preset = this.presets.get(presetId) || this.customPresets.get(presetId)
        if (!preset) {
            throw new Error(`Preset not found: ${presetId}`)
        }
        return { ...preset } // Retornar copia
    }

    /**
     * Aplicar overrides de modo (entropy/risk/punk)
     */
    private applyModeOverrides(
        style: StylePreset,
        mode: ModeConfig
    ): StylePreset {
        const modified = { ...style }

        // ENTROPY afecta variación melódica y rítmica
        const entropyFactor = mode.entropyFactor / 100

        modified.musical.melodic.noteDensity *= (1 + entropyFactor * 0.5)
        modified.musical.melodic.restProbability *= (1 - entropyFactor * 0.3)
        modified.musical.rhythmic.syncopation *= (1 + entropyFactor * 0.4)

        // RISK afecta complejidad armónica y disonancia
        const riskFactor = mode.riskThreshold / 100

        if (riskFactor < 0.3) {
            modified.musical.harmonic.chordComplexity = 'triads'
        } else if (riskFactor < 0.6) {
            modified.musical.harmonic.chordComplexity = 'seventh'
        } else {
            modified.musical.harmonic.chordComplexity = 'extended'
        }

        modified.musical.harmonic.dissonanceLevel *= (1 + riskFactor * 0.5)

        // PUNK afecta textura y caos
        const punkFactor = mode.punkProbability / 100

        if (punkFactor > 0.7) {
            modified.texture.density = 'ultra-dense'
            modified.musical.harmonic.dissonanceLevel *= 1.5
            modified.musical.rhythmic.complexity = 'polyrhythmic'
        }

        return modified
    }

    /**
     * Aplicar influencia de SystemVitals
     */
    private applyVitalsInfluence(
        style: StylePreset,
        vitals: VitalSigns
    ): StylePreset {
        const modified = { ...style }

        // Stress → tempo y disonancia
        const stressFactor = vitals.stress
        modified.musical.tempo *= (1 + stressFactor * 0.4)
        modified.musical.harmonic.dissonanceLevel += stressFactor * 0.3
        modified.texture.density = stressFactor > 0.5 ? 'dense' : modified.texture.density

        // Harmony → consonancia y modo
        const harmonyFactor = vitals.harmony
        modified.musical.harmonic.dissonanceLevel *= (1 - harmonyFactor * 0.4)
        if (harmonyFactor > 0.7) {
            modified.musical.mode = 'lydian' // Modo más consonante
        }

        // Creativity → entropy y variación
        const creativityFactor = vitals.creativity
        modified.musical.melodic.noteDensity *= (1 + creativityFactor * 0.4)
        modified.musical.melodic.motifRepetition *= (1 - creativityFactor * 0.5)

        return modified
    }

    /**
     * Generar estilo proceduralmente desde seed
     */
    private generateStyleFromSeed(seed: number, beauty: number): StylePreset {
        // TODO: Implementar generación procedural
        // Por ahora retornar cyberpunk como fallback
        return this.loadPreset('cyberpunkpreset')  // 🎨 FASE 4.4 - Reparación "Gregoriano"
    }

    /**
     * Aplicar overrides del usuario
     */
    private applyUserOverrides(
        style: StylePreset,
        overrides: any
    ): StylePreset {
        // TODO: Implementar overrides del usuario
        return style
    }

    /**
     * Validar y normalizar estilo
     */
    private validateAndNormalize(style: StylePreset): StylePreset {
        const normalized = { ...style }

        // Asegurar rangos válidos
        normalized.musical.tempo = Math.max(40, Math.min(200, normalized.musical.tempo))
        normalized.musical.harmonic.dissonanceLevel = Math.max(0, Math.min(1, normalized.musical.harmonic.dissonanceLevel))
        normalized.musical.melodic.noteDensity = Math.max(0, Math.min(1, normalized.musical.melodic.noteDensity))

        return normalized
    }

    /**
     * Computar parámetros efectivos
     */
    private computeEffectiveParams(style: StylePreset, mode: ModeConfig): any {
        // TODO: Implementar computación de parámetros efectivos
        return {}
    }
}

