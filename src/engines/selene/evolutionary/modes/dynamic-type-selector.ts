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
export class DynamicTypeSelector {
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
  public selectTypes(
    seed: number,
    modeConfig: ModeConfig,
    allTypes: EvolutionaryType[]
  ): EvolutionaryType[] {
    // Step 1: Filtrar por riesgo
    let viableTypes = this.filterByRisk(allTypes, modeConfig.riskThreshold);

    // Step 2: Boost punk types
    viableTypes = this.boostPunkTypes(viableTypes, modeConfig.punkProbability);

    // Step 3: Weighted selection (determinista con seed)
    return this.weightedSelection(viableTypes, seed);
  }

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
  private filterByRisk(
    types: EvolutionaryType[],
    riskThreshold: number
  ): EvolutionaryType[] {
    return types.filter(type => {
      const riskScore = this.calculateRiskScore(type);
      return riskScore <= riskThreshold;
    });
  }

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
  private calculateRiskScore(type: EvolutionaryType): number {
    if (type.riskScore !== undefined) {
      return type.riskScore;
    }

    // Calcular según categoría
    const riskMap: Record<string, number> = {
      destruction: 90,
      chaos: 80,
      rebellion: 70,
      exploration: 50,
      analysis: 20,
      harmony: 10
    };

    return riskMap[type.category] || 30; // Default medio
  }

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
  private boostPunkTypes(
    types: EvolutionaryType[],
    punkProbability: number
  ): EvolutionaryType[] {
    if (punkProbability === 0) {
      return types;
    }

    const punkCategories = ['destruction', 'chaos', 'rebellion'];
    const boostFactor = 1 + (punkProbability / 100) * 2; // 1x a 3x

    return types.map(type => ({
      ...type,
      weight: punkCategories.includes(type.category)
        ? (type.weight || 1) * boostFactor
        : type.weight || 1
    }));
  }

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
  private weightedSelection(
    types: EvolutionaryType[],
    seed: number
  ): EvolutionaryType[] {
    if (types.length === 0) {
      return [];
    }

    // Calcular total weight
    const totalWeight = types.reduce((sum, t) => sum + (t.weight || 1), 0);

    // Usar seed para selección determinista
    const sortedTypes = types.map(type => {
      const weight = type.weight || 1;
      const probability = weight / totalWeight;

      // Pseudo-random determinista basado en seed
      const hash = this.simpleHash(type.name + seed);
      const score = hash * probability;

      return { type, score };
    });

    // Ordenar por score
    sortedTypes.sort((a, b) => b.score - a.score);

    return sortedTypes.map(item => item.type);
  }

  /**
   * Hash simple para reproducibilidad
   * 
   * @param str - String a hashear
   * @returns Hash (0-1)
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash % 10000) / 10000; // Normalize to 0-1
  }
}

