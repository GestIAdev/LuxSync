/**
 * 🎯 DYNAMIC TYPE SELECTOR
 *
 * Selector dinámico de tipos evolutivos con soporte para modos.
 * Aplica risk filtering, punk boosting y weighted selection determinista.
 *
 * @author PunkClaude + Radwulf
 * @date 2025-10-23
 */
import type { ModeConfig } from './mode-manager.js';
/**
 * Tipo evolutivo con metadata
 */
export interface EvolutionaryType {
    name: string;
    category: string;
    riskScore?: number;
    weight?: number;
}
/**
 * Selector dinámico de tipos evolutivos
 *
 * Aplica:
 * - Risk filtering (según riskThreshold)
 * - Punk boosting (según punkProbability)
 * - Weighted selection (determinista con seed)
 */
export declare class DynamicTypeSelector {
    /**
     * Selecciona tipos según seed y modo
     *
     * @param seed - Seed calculado (0-100)
     * @param modeConfig - Configuración del modo
     * @param allTypes - Todos los tipos disponibles
     * @returns Tipos filtrados y ordenados
     *
     * Proceso:
     * 1. Filtrar por risk threshold
     * 2. Boost punk types si aplica
     * 3. Weighted selection con seed
     */
    selectTypes(seed: number, modeConfig: ModeConfig, allTypes: EvolutionaryType[]): EvolutionaryType[];
    /**
     * Filtra tipos por umbral de riesgo
     *
     * @param types - Tipos a filtrar
     * @param riskThreshold - Umbral de riesgo (0-100)
     * @returns Tipos que pasan el filtro
     *
     * Comportamiento:
     * - Threshold 10: Solo tipos ultra-safe (riskScore <= 10)
     * - Threshold 70: Permite tipos arriesgados (riskScore <= 70)
     */
    private filterByRisk;
    /**
     * Calcula risk score de un tipo
     *
     * @param type - Tipo a evaluar
     * @returns Risk score (0-100)
     *
     * Categorías riesgosas:
     * - destruction: 90
     * - chaos: 80
     * - rebellion: 70
     * - exploration: 50
     * - analysis: 20
     * - harmony: 10
     */
    private calculateRiskScore;
    /**
     * Boost para tipos punk
     *
     * @param types - Tipos a procesar
     * @param punkProbability - Probabilidad punk (0-100)
     * @returns Tipos con weights ajustados
     *
     * Comportamiento:
     * - Probability 0: Sin boost
     * - Probability 50: Boost moderado (×1.5 weight)
     * - Probability 100: Boost máximo (×3 weight)
     */
    private boostPunkTypes;
    /**
     * Selección weighted determinista
     *
     * @param types - Tipos con weights
     * @param seed - Seed (0-100)
     * @returns Tipos ordenados por probabilidad
     *
     * Usa seed para selección reproducible:
     * - Mismo seed + mismos types = mismo orden
     */
    private weightedSelection;
    /**
     * Hash simple para reproducibilidad
     *
     * @param str - String a hashear
     * @returns Hash (0-1)
     */
    private simpleHash;
}
//# sourceMappingURL=dynamic-type-selector.d.ts.map