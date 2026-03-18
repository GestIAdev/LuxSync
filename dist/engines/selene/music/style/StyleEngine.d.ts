/**
 * 🎸 STYLE ENGINE
 * Motor de resolución de estilos
 */
import { ResolvedStyle } from './StylePreset.js';
import { ModeConfig, VitalSigns } from '../core/types.js';
import { MusicGenerationParams } from '../core/interfaces.js';
export declare class StyleEngine {
    private presets;
    private customPresets;
    constructor();
    /**
     * Resolver estilo desde parámetros de generación
     */
    resolveStyle(params: MusicGenerationParams, modeConfig: ModeConfig, vitals?: VitalSigns): ResolvedStyle;
    /**
     * Cargar preset desde catálogo
     */
    private loadPreset;
    /**
     * Aplicar overrides de modo (entropy/risk/punk)
     */
    private applyModeOverrides;
    /**
     * Aplicar influencia de SystemVitals
     */
    private applyVitalsInfluence;
    /**
     * Generar estilo proceduralmente desde seed
     */
    private generateStyleFromSeed;
    /**
     * Aplicar overrides del usuario
     */
    private applyUserOverrides;
    /**
     * Validar y normalizar estilo
     */
    private validateAndNormalize;
    /**
     * Computar parámetros efectivos
     */
    private computeEffectiveParams;
}
//# sourceMappingURL=StyleEngine.d.ts.map