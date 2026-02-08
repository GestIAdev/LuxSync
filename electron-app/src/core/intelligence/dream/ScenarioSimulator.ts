/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 500 - PROJECT GENESIS: SCENARIO SIMULATOR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🚫🚫🚫 DEPRECATED - WAVE 1169 🚫🚫🚫
 * 
 * Este módulo está CONGELADO para V1.0.
 * Será reactivado cuando el MOTOR EVOLUTIVO y DB estén listos.
 * 
 * NO ENVÍA DATOS A LA UI.
 * NO MODIFICA LA PALETA.
 * DESCONECTADO DEL MUNDO.
 * 
 * TODO WAVE 2.0: Reactivar con el sistema de aprendizaje evolutivo.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ORIGINAL DESCRIPTION (preserved for future):
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * El SOÑADOR de Selene.
 * 
 * "¿Qué pasaría si...?" - La pregunta que separa la inteligencia
 * de la simple reacción. Selene no solo responde al presente,
 * SIMULA futuros alternativos antes de actuar.
 * 
 * Filosofía:
 * - Cada decisión tiene MÚLTIPLES caminos
 * - Simular ANTES de ejecutar
 * - Elegir el camino con mayor BELLEZA esperada
 * - Aprender de los sueños que NO se ejecutaron
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { TitanStabilizedState, SeleneMusicalPattern } from '../types'
import type { ConsciousnessOutput, ConsciousnessColorDecision } from '../../protocol/ConsciousnessOutput'
import type { SelenePalette } from '../../../engine/color/SeleneColorEngine'
import { senseBeauty, type BeautyAnalysis } from '../sense/BeautySensor'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de escenario a simular
 */
export type ScenarioType = 
  | 'hue_shift'           // Cambiar hue principal
  | 'saturation_boost'    // Aumentar saturación
  | 'saturation_reduce'   // Reducir saturación
  | 'temperature_warm'    // Calentar paleta
  | 'temperature_cool'    // Enfriar paleta
  | 'contrast_increase'   // Aumentar contraste
  | 'contrast_decrease'   // Reducir contraste
  | 'harmony_shift'       // Cambiar armonía de colores
  | 'energy_prepare'      // Preparar para subida de energía
  | 'energy_recover'      // Recuperar de bajada de energía
  | 'hold_steady'         // Mantener sin cambios

/**
 * Un escenario simulado con su resultado proyectado
 */
export interface SimulatedScenario {
  /** Tipo de escenario */
  type: ScenarioType
  
  /** Descripción humana del escenario */
  description: string
  
  /** Paleta resultante si se ejecutara */
  projectedPalette: SelenePalette
  
  /** Belleza proyectada de la paleta resultante */
  projectedBeauty: number
  
  /** Delta de belleza vs estado actual */
  beautyDelta: number
  
  /** Consonancia proyectada con estado anterior */
  projectedConsonance: number
  
  /** Riesgo del cambio (0 = seguro, 1 = arriesgado) */
  riskLevel: number
  
  /** Decisión que ejecutaría este escenario */
  decision: ConsciousnessColorDecision
  
  /** Confianza en la simulación (0-1) */
  simulationConfidence: number
}

/**
 * Resultado del proceso de simulación
 */
export interface DreamResult {
  /** Escenarios simulados (ordenados por belleza proyectada) */
  scenarios: SimulatedScenario[]
  
  /** Mejor escenario encontrado */
  bestScenario: SimulatedScenario | null
  
  /** Recomendación final */
  recommendation: 'execute' | 'modify' | 'abort'
  
  /** Razón de la recomendación */
  reason: string
  
  /** Tiempo de simulación (ms) */
  simulationTimeMs: number
}

/**
 * Configuración del simulador
 */
export interface SimulatorConfig {
  /** Número máximo de escenarios a simular */
  maxScenarios: number
  
  /** Umbral mínimo de mejora de belleza para recomendar ejecución */
  minBeautyImprovement: number
  
  /** Umbral máximo de riesgo aceptable */
  maxAcceptableRisk: number
  
  /** Peso del delta de belleza en la puntuación */
  beautyWeight: number
  
  /** Peso del riesgo en la puntuación (negativo) */
  riskWeight: number
  
  /** Peso de la consonancia en la puntuación */
  consonanceWeight: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PHI = 1.618033988749895

const DEFAULT_CONFIG: SimulatorConfig = {
  maxScenarios: 7,
  minBeautyImprovement: 0.05,      // 5% mejora mínima
  maxAcceptableRisk: 0.6,
  beautyWeight: PHI,               // La belleza es lo más importante
  riskWeight: -1.0,                // El riesgo resta
  consonanceWeight: 0.618          // Inverso de PHI
}

/**
 * Deltas de hue para explorar (en grados)
 * Basados en Fibonacci para armonía natural
 */
const HUE_EXPLORATION_DELTAS = [
  0,      // Sin cambio
  13,     // Fibonacci pequeño
  21,     // Fibonacci
  34,     // Fibonacci
  -13,    // Negativo
  -21,    
  55,     // Salto mayor
  -55,
  89,     // Complementario parcial
  144,    // Casi triádico
  180     // Complementario total
]

/**
 * Escenarios base a considerar según contexto
 */
const SCENARIO_PRIORITIES: Record<string, ScenarioType[]> = {
  // En secciones de baja energía: explorar más
  'low_energy': [
    'hue_shift', 'harmony_shift', 'temperature_warm', 
    'saturation_boost', 'contrast_increase'
  ],
  
  // En buildup: preparar para el drop
  'building': [
    'energy_prepare', 'saturation_boost', 'contrast_increase',
    'temperature_cool', 'hue_shift'
  ],
  
  // Post-drop: recuperar suavemente
  'recovering': [
    'energy_recover', 'saturation_reduce', 'temperature_warm',
    'contrast_decrease', 'hold_steady'
  ],
  
  // Estado estable: mantener o mejorar sutilmente
  'stable': [
    'hold_steady', 'hue_shift', 'harmony_shift',
    'saturation_boost', 'temperature_warm'
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

let lastDream: DreamResult | null = null
let dreamCount = 0

// ═══════════════════════════════════════════════════════════════════════════
// MAIN API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simula múltiples escenarios y elige el mejor
 * 
 * @param state - Estado actual de Titan
 * @param pattern - Patrón musical detectado
 * @param currentBeauty - Belleza actual
 * @param config - Configuración (opcional)
 */
export function dream(
  state: TitanStabilizedState,
  pattern: SeleneMusicalPattern,
  currentBeauty: number,
  config: Partial<SimulatorConfig> = {}
): DreamResult {
  const startTime = performance.now()
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  // Determinar qué escenarios priorizar según contexto
  const context = determineContext(state, pattern)
  const prioritizedTypes = SCENARIO_PRIORITIES[context] ?? SCENARIO_PRIORITIES['stable']
  
  // Generar escenarios
  const scenarios: SimulatedScenario[] = []
  
  for (const scenarioType of prioritizedTypes) {
    if (scenarios.length >= cfg.maxScenarios) break
    
    const scenario = simulateScenario(
      scenarioType,
      state,
      pattern,
      currentBeauty
    )
    
    if (scenario) {
      scenarios.push(scenario)
    }
  }
  
  // Añadir exploraciones de hue si hay espacio
  if (scenarios.length < cfg.maxScenarios) {
    const hueExplorations = exploreHueShifts(
      state,
      pattern,
      currentBeauty,
      cfg.maxScenarios - scenarios.length
    )
    scenarios.push(...hueExplorations)
  }
  
  // Ordenar por puntuación combinada
  const scoredScenarios = scenarios.map(s => ({
    scenario: s,
    score: calculateScenarioScore(s, cfg)
  }))
  
  scoredScenarios.sort((a, b) => b.score - a.score)
  
  const sortedScenarios = scoredScenarios.map(s => s.scenario)
  const bestScenario = sortedScenarios[0] ?? null
  
  // Determinar recomendación
  const { recommendation, reason } = determineRecommendation(
    bestScenario,
    currentBeauty,
    cfg
  )
  
  const result: DreamResult = {
    scenarios: sortedScenarios,
    bestScenario,
    recommendation,
    reason,
    simulationTimeMs: performance.now() - startTime
  }
  
  // Guardar para análisis
  lastDream = result
  dreamCount++
  
  return result
}

/**
 * Obtiene el último sueño (para debug)
 */
export function getLastDream(): DreamResult | null {
  return lastDream
}

/**
 * Estadísticas de sueños
 */
export function getDreamStats(): { totalDreams: number; lastDream: DreamResult | null } {
  return { totalDreams: dreamCount, lastDream }
}

/**
 * Reset para tests
 */
export function resetDreamEngine(): void {
  lastDream = null
  dreamCount = 0
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function determineContext(
  state: TitanStabilizedState,
  pattern: SeleneMusicalPattern
): string {
  if (pattern.isBuilding) return 'building'
  if (pattern.energyPhase === 'valley') return 'recovering'  // Valley = post-drop recovery
  if (state.smoothedEnergy < 0.3) return 'low_energy'
  return 'stable'
}

function simulateScenario(
  type: ScenarioType,
  state: TitanStabilizedState,
  pattern: SeleneMusicalPattern,
  currentBeauty: number
): SimulatedScenario | null {
  
  const palette = state.currentPalette
  if (!palette) return null
  
  let projectedPalette: SelenePalette
  let decision: ConsciousnessColorDecision
  let description: string
  let riskLevel: number
  
  switch (type) {
    case 'hue_shift': {
      const delta = selectOptimalHueDelta(palette, pattern)
      const newHue = (palette.primary.h + delta + 360) % 360
      projectedPalette = projectPaletteWithHue(palette, newHue)
      decision = { suggestedHue: newHue, saturationMod: 1.0, brightnessMod: 1.0, confidence: 0.8 }
      description = `Shift hue ${delta > 0 ? '+' : ''}${delta}° → ${newHue.toFixed(0)}°`
      riskLevel = Math.abs(delta) / 180  // Mayor cambio = mayor riesgo
      break
    }
    
    case 'saturation_boost': {
      const boost = 1.15  // +15% como multiplicador
      projectedPalette = projectPaletteWithSaturation(palette, 0.15)
      decision = { saturationMod: boost, brightnessMod: 1.0, confidence: 0.75 }
      description = `Boost saturation +15%`
      riskLevel = 0.2
      break
    }
    
    case 'saturation_reduce': {
      const reduction = 0.9  // -10% como multiplicador
      projectedPalette = projectPaletteWithSaturation(palette, -0.1)
      decision = { saturationMod: reduction, brightnessMod: 1.0, confidence: 0.7 }
      description = `Reduce saturation -10%`
      riskLevel = 0.15
      break
    }
    
    case 'temperature_warm': {
      // Mover hacia amarillos/naranjas
      const warmShift = palette.primary.h < 60 ? 15 : -15
      const newHue = (palette.primary.h + warmShift + 360) % 360
      projectedPalette = projectPaletteWithHue(palette, newHue)
      decision = { suggestedHue: newHue, saturationMod: 1.05, brightnessMod: 1.05, confidence: 0.7 }
      description = `Warm palette → ${newHue.toFixed(0)}°`
      riskLevel = 0.25
      break
    }
    
    case 'temperature_cool': {
      // Mover hacia azules
      const coolShift = palette.primary.h > 240 ? -20 : 20
      const newHue = (palette.primary.h + coolShift + 360) % 360
      projectedPalette = projectPaletteWithHue(palette, newHue)
      decision = { suggestedHue: newHue, saturationMod: 1.0, brightnessMod: 0.95, confidence: 0.7 }
      description = `Cool palette → ${newHue.toFixed(0)}°`
      riskLevel = 0.25
      break
    }
    
    case 'contrast_increase': {
      projectedPalette = projectPaletteWithContrast(palette, 0.15)
      decision = { saturationMod: 1.1, brightnessMod: 1.1, confidence: 0.65 }
      description = 'Increase contrast +15%'
      riskLevel = 0.3
      break
    }
    
    case 'contrast_decrease': {
      projectedPalette = projectPaletteWithContrast(palette, -0.1)
      decision = { saturationMod: 0.95, brightnessMod: 0.95, confidence: 0.7 }
      description = 'Decrease contrast -10%'
      riskLevel = 0.2
      break
    }
    
    case 'harmony_shift': {
      // Cambio triádico
      const triadicShift = 120
      const newHue = (palette.primary.h + triadicShift) % 360
      projectedPalette = projectPaletteWithHue(palette, newHue)
      decision = { suggestedHue: newHue, saturationMod: 1.0, brightnessMod: 1.0, confidence: 0.6 }
      description = `Triadic harmony shift → ${newHue.toFixed(0)}°`
      riskLevel = 0.5  // Alto riesgo pero potencialmente alto reward
      break
    }
    
    case 'energy_prepare': {
      // Preparar para drop: saturar y enfriar ligeramente
      projectedPalette = projectPaletteWithSaturation(
        projectPaletteWithHue(palette, (palette.primary.h + 10) % 360),
        0.2
      )
      decision = { saturationMod: 1.2, brightnessMod: 1.1, confidence: 0.75 }
      description = 'Prepare for energy peak'
      riskLevel = 0.35
      break
    }
    
    case 'energy_recover': {
      // Recuperar de drop: desaturar y calentar
      projectedPalette = projectPaletteWithSaturation(palette, -0.15)
      decision = { saturationMod: 0.85, brightnessMod: 0.9, confidence: 0.7 }
      description = 'Recover from energy peak'
      riskLevel = 0.2
      break
    }
    
    case 'hold_steady':
    default: {
      projectedPalette = palette
      decision = { saturationMod: 1.0, brightnessMod: 1.0, confidence: 0.9 }
      description = 'Hold steady - no change'
      riskLevel = 0
      break
    }
  }
  
  // Calcular belleza proyectada
  const beautyAnalysis = senseBeauty(projectedPalette, pattern)
  const projectedBeauty = beautyAnalysis.totalBeauty
  const beautyDelta = projectedBeauty - currentBeauty
  
  // Calcular consonancia (simplificada - qué tan diferente es)
  const hueDiff = Math.abs(projectedPalette.primary.h - palette.primary.h)
  const normalizedDiff = Math.min(hueDiff, 360 - hueDiff) / 180
  const projectedConsonance = 1 - normalizedDiff * 0.5
  
  return {
    type,
    description,
    projectedPalette,
    projectedBeauty,
    beautyDelta,
    projectedConsonance,
    riskLevel,
    decision,
    simulationConfidence: 0.8 - riskLevel * 0.3  // Mayor riesgo = menor confianza
  }
}

function exploreHueShifts(
  state: TitanStabilizedState,
  pattern: SeleneMusicalPattern,
  currentBeauty: number,
  maxCount: number
): SimulatedScenario[] {
  const palette = state.currentPalette
  if (!palette) return []
  
  const explorations: SimulatedScenario[] = []
  
  // Explorar deltas Fibonacci
  for (const delta of HUE_EXPLORATION_DELTAS) {
    if (explorations.length >= maxCount) break
    if (delta === 0) continue  // Ya cubierto por hold_steady
    
    const newHue = (palette.primary.h + delta + 360) % 360
    const projectedPalette = projectPaletteWithHue(palette, newHue)
    
    const beautyAnalysis = senseBeauty(projectedPalette, pattern)
    const projectedBeauty = beautyAnalysis.totalBeauty
    const beautyDelta = projectedBeauty - currentBeauty
    
    // Solo incluir si hay mejora potencial
    if (beautyDelta > -0.1) {
      const hueDiff = Math.abs(delta)
      const normalizedDiff = Math.min(hueDiff, 360 - hueDiff) / 180
      
      explorations.push({
        type: 'hue_shift',
        description: `Explore hue ${delta > 0 ? '+' : ''}${delta}° → ${newHue.toFixed(0)}°`,
        projectedPalette,
        projectedBeauty,
        beautyDelta,
        projectedConsonance: 1 - normalizedDiff * 0.5,
        riskLevel: normalizedDiff,
        decision: { suggestedHue: newHue, saturationMod: 1.0, brightnessMod: 1.0, confidence: 0.7 },
        simulationConfidence: 0.7
      })
    }
  }
  
  return explorations
}

// ═══════════════════════════════════════════════════════════════════════════
// PALETTE PROJECTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function projectPaletteWithHue(palette: SelenePalette, newHue: number): SelenePalette {
  const hueDelta = newHue - palette.primary.h
  
  return {
    primary: { ...palette.primary, h: newHue },
    secondary: { ...palette.secondary, h: (palette.secondary.h + hueDelta + 360) % 360 },
    accent: { ...palette.accent, h: (palette.accent.h + hueDelta + 360) % 360 },
    ambient: { ...palette.ambient, h: (palette.ambient.h + hueDelta + 360) % 360 },
    contrast: { ...palette.contrast, h: (palette.contrast.h + hueDelta + 360) % 360 },
    meta: palette.meta
  }
}

function projectPaletteWithSaturation(palette: SelenePalette, boost: number): SelenePalette {
  const clampS = (s: number) => Math.max(0, Math.min(1, s + boost))
  
  return {
    primary: { ...palette.primary, s: clampS(palette.primary.s) },
    secondary: { ...palette.secondary, s: clampS(palette.secondary.s) },
    accent: { ...palette.accent, s: clampS(palette.accent.s) },
    ambient: { ...palette.ambient, s: clampS(palette.ambient.s) },
    contrast: { ...palette.contrast, s: clampS(palette.contrast.s) },
    meta: palette.meta
  }
}

function projectPaletteWithContrast(palette: SelenePalette, boost: number): SelenePalette {
  // Aumentar/reducir la diferencia de luminosidad entre colores
  const avgL = (palette.primary.l + palette.secondary.l + palette.accent.l) / 3
  
  const adjustL = (l: number) => {
    const diff = l - avgL
    return Math.max(0, Math.min(1, l + diff * boost))
  }
  
  return {
    primary: { ...palette.primary, l: adjustL(palette.primary.l) },
    secondary: { ...palette.secondary, l: adjustL(palette.secondary.l) },
    accent: { ...palette.accent, l: adjustL(palette.accent.l) },
    ambient: { ...palette.ambient, l: adjustL(palette.ambient.l) },
    contrast: { ...palette.contrast, l: adjustL(palette.contrast.l) },
    meta: palette.meta
  }
}

function selectOptimalHueDelta(palette: SelenePalette, pattern: SeleneMusicalPattern): number {
  // Seleccionar delta basado en tensión emocional
  const tension = pattern.emotionalTension
  
  if (tension > 0.7) {
    // Alta tensión: cambios más dramáticos
    return HUE_EXPLORATION_DELTAS[Math.floor(tension * 5) + 3] ?? 55
  } else if (tension < 0.3) {
    // Baja tensión: cambios sutiles
    return HUE_EXPLORATION_DELTAS[Math.floor(tension * 3)] ?? 13
  }
  
  // Tensión media: cambio moderado
  return 34
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORING & RECOMMENDATION
// ═══════════════════════════════════════════════════════════════════════════

function calculateScenarioScore(scenario: SimulatedScenario, cfg: SimulatorConfig): number {
  return (
    scenario.beautyDelta * cfg.beautyWeight +
    scenario.riskLevel * cfg.riskWeight +
    scenario.projectedConsonance * cfg.consonanceWeight
  ) * scenario.simulationConfidence
}

function determineRecommendation(
  bestScenario: SimulatedScenario | null,
  currentBeauty: number,
  cfg: SimulatorConfig
): { recommendation: 'execute' | 'modify' | 'abort'; reason: string } {
  
  if (!bestScenario) {
    return { recommendation: 'abort', reason: 'No viable scenarios found' }
  }
  
  // ¿El mejor escenario es "hold"?
  if (bestScenario.type === 'hold_steady') {
    return { 
      recommendation: 'abort', 
      reason: 'Best option is to hold steady - current state is optimal' 
    }
  }
  
  // ¿Mejora suficiente?
  if (bestScenario.beautyDelta < cfg.minBeautyImprovement) {
    return { 
      recommendation: 'abort', 
      reason: `Insufficient beauty improvement: ${(bestScenario.beautyDelta * 100).toFixed(1)}% < ${(cfg.minBeautyImprovement * 100).toFixed(1)}%` 
    }
  }
  
  // ¿Riesgo aceptable?
  if (bestScenario.riskLevel > cfg.maxAcceptableRisk) {
    return { 
      recommendation: 'modify', 
      reason: `Risk too high (${(bestScenario.riskLevel * 100).toFixed(0)}%) - consider reducing change magnitude` 
    }
  }
  
  // ¡Ejecutar!
  return { 
    recommendation: 'execute', 
    reason: `Beauty +${(bestScenario.beautyDelta * 100).toFixed(1)}%, Risk ${(bestScenario.riskLevel * 100).toFixed(0)}%, Consonance ${(bestScenario.projectedConsonance * 100).toFixed(0)}%` 
  }
}
