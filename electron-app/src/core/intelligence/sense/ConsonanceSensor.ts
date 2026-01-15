// ═══════════════════════════════════════════════════════════════════════════
//  🎧 CONSONANCE SENSOR - El Oído que Escucha la Coherencia
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 2
//  "Qué tan bien fluye un estado al siguiente"
// ═══════════════════════════════════════════════════════════════════════════

import type { SelenePalette } from '../../../engine/color/SeleneColorEngine'
import type { SeleneMusicalPattern } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES - Teoría de intervalos simplificada
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pesos de consonancia para intervalos cromáticos (distancia en hue)
 * Basado en teoría musical aplicada a color
 * 
 * 0° = Unísono (mismo color) = perfecta consonancia
 * 30° = Análogo = muy consonante
 * 60° = Triádico parcial = consonante
 * 90° = Cuadrado parcial = tensión moderada
 * 120° = Triádico = consonante
 * 150° = Split-complementario = tensión sofisticada
 * 180° = Complementario = máxima tensión (pero armónica)
 */
const HUE_CONSONANCE_MAP: Array<{ angle: number; consonance: number; name: string }> = [
  { angle: 0, consonance: 1.0, name: 'unison' },
  { angle: 30, consonance: 0.85, name: 'analogous' },
  { angle: 60, consonance: 0.75, name: 'split-triadic' },
  { angle: 90, consonance: 0.55, name: 'square-partial' },
  { angle: 120, consonance: 0.70, name: 'triadic' },
  { angle: 150, consonance: 0.60, name: 'split-complementary' },
  { angle: 180, consonance: 0.50, name: 'complementary' },
]

// ═══════════════════════════════════════════════════════════════════════════
// RESULTADO DEL ANÁLISIS
// ═══════════════════════════════════════════════════════════════════════════

export interface ConsonanceAnalysis {
  /** Consonancia total (0-1) */
  totalConsonance: number
  
  /** Consonancia cromática (entre paletas) */
  chromaticConsonance: number
  
  /** Consonancia rítmica (flujo de energía) */
  rhythmicConsonance: number
  
  /** Consonancia emocional (tensión alineada) */
  emotionalConsonance: number
  
  /** Nombre del intervalo cromático dominante */
  dominantInterval: string
  
  /** ¿Es una transición suave o abrupta? */
  transitionType: 'smooth' | 'moderate' | 'abrupt'
  
  /** Sugerencia de velocidad de transición (ms) */
  suggestedTransitionMs: number
  
  /** Timestamp */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO ANTERIOR (para comparar)
// ═══════════════════════════════════════════════════════════════════════════

interface PreviousState {
  palette: SelenePalette
  pattern: SeleneMusicalPattern
  timestamp: number
}

let previousState: PreviousState | null = null

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analiza la consonancia entre el estado actual y el anterior
 * 
 * @param currentPalette - Paleta actual
 * @param currentPattern - Patrón musical actual
 * @returns Análisis de consonancia
 */
export function senseConsonance(
  currentPalette: SelenePalette,
  currentPattern: SeleneMusicalPattern
): ConsonanceAnalysis {
  const timestamp = currentPattern.timestamp
  
  // Si no hay estado anterior, asumimos consonancia perfecta
  if (!previousState) {
    previousState = {
      palette: currentPalette,
      pattern: currentPattern,
      timestamp,
    }
    
    return {
      totalConsonance: 1.0,
      chromaticConsonance: 1.0,
      rhythmicConsonance: 1.0,
      emotionalConsonance: 1.0,
      dominantInterval: 'unison',
      transitionType: 'smooth',
      suggestedTransitionMs: 500,
      timestamp,
    }
  }
  
  // Calcular componentes
  const chromatic = calculateChromaticConsonance(previousState.palette, currentPalette)
  const rhythmic = calculateRhythmicConsonance(previousState.pattern, currentPattern)
  const emotional = calculateEmotionalConsonance(previousState.pattern, currentPattern)
  
  // Pesos (ritmo y emoción pesan más que color puro)
  const weights = {
    chromatic: 0.30,
    rhythmic: 0.35,
    emotional: 0.35,
  }
  
  const totalConsonance = 
    chromatic.consonance * weights.chromatic +
    rhythmic * weights.rhythmic +
    emotional * weights.emotional
  
  // Determinar tipo de transición y velocidad sugerida
  const transitionType = categorizeTransition(totalConsonance)
  const suggestedTransitionMs = calculateTransitionSpeed(totalConsonance, currentPattern)
  
  // Actualizar estado anterior
  previousState = {
    palette: currentPalette,
    pattern: currentPattern,
    timestamp,
  }
  
  return {
    totalConsonance,
    chromaticConsonance: chromatic.consonance,
    rhythmicConsonance: rhythmic,
    emotionalConsonance: emotional,
    dominantInterval: chromatic.intervalName,
    transitionType,
    suggestedTransitionMs,
    timestamp,
  }
}

/**
 * Evalúa la consonancia de un cambio de hue propuesto
 * 
 * @param currentHue - Hue actual (0-360)
 * @param proposedHue - Hue propuesto (0-360)
 * @returns Score de consonancia (0-1)
 */
export function evaluateHueChange(currentHue: number, proposedHue: number): number {
  let distance = Math.abs(currentHue - proposedHue)
  if (distance > 180) distance = 360 - distance
  
  return getConsonanceForDistance(distance)
}

/**
 * Sugiere el mejor hue consonante dado un hue actual y un objetivo de consonancia
 * 
 * @param currentHue - Hue actual
 * @param targetConsonance - Consonancia objetivo (0-1)
 * @returns Array de hues sugeridos ordenados por consonancia
 */
export function suggestConsonantHues(
  currentHue: number,
  targetConsonance: number
): number[] {
  // Encontrar intervalos con consonancia cercana al target
  const candidates = HUE_CONSONANCE_MAP
    .filter(i => Math.abs(i.consonance - targetConsonance) < 0.2)
    .sort((a, b) => Math.abs(a.consonance - targetConsonance) - Math.abs(b.consonance - targetConsonance))
  
  if (candidates.length === 0) {
    // Si no hay match, usar análogo
    return [(currentHue + 30) % 360, (currentHue - 30 + 360) % 360]
  }
  
  // Generar hues en ambas direcciones para cada intervalo
  const suggestions: number[] = []
  for (const interval of candidates.slice(0, 3)) {
    suggestions.push((currentHue + interval.angle) % 360)
    if (interval.angle !== 0 && interval.angle !== 180) {
      suggestions.push((currentHue - interval.angle + 360) % 360)
    }
  }
  
  return suggestions
}

/**
 * Resetea estado de consonancia
 */
export function resetConsonanceState(): void {
  previousState = null
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PRIVADAS
// ═══════════════════════════════════════════════════════════════════════════

interface ChromaticResult {
  consonance: number
  intervalName: string
}

function calculateChromaticConsonance(
  prevPalette: SelenePalette,
  currPalette: SelenePalette
): ChromaticResult {
  // Comparar hues primarios
  const prevHue = prevPalette.primary?.h ?? 0
  const currHue = currPalette.primary?.h ?? 0
  
  let distance = Math.abs(prevHue - currHue)
  if (distance > 180) distance = 360 - distance
  
  // Buscar intervalo más cercano
  let bestMatch = HUE_CONSONANCE_MAP[0]
  let bestDelta = 180
  
  for (const interval of HUE_CONSONANCE_MAP) {
    const delta = Math.abs(distance - interval.angle)
    if (delta < bestDelta) {
      bestDelta = delta
      bestMatch = interval
    }
  }
  
  // Ajustar consonancia por qué tan cerca estamos del intervalo ideal
  const proximityBonus = Math.exp(-bestDelta / 20) // Más cerca = más bonus
  const adjustedConsonance = bestMatch.consonance * (0.7 + 0.3 * proximityBonus)
  
  return {
    consonance: Math.min(1, adjustedConsonance),
    intervalName: bestMatch.name,
  }
}

function calculateRhythmicConsonance(
  prevPattern: SeleneMusicalPattern,
  currPattern: SeleneMusicalPattern
): number {
  // Consonancia rítmica = qué tan suave es el cambio de energía
  
  // 1. Cambio de BPM (grande = disonante)
  const bpmDelta = Math.abs(prevPattern.bpm - currPattern.bpm)
  const bpmConsonance = Math.exp(-bpmDelta / 20) // 20 BPM de tolerancia
  
  // 2. Cambio de intensidad rítmica
  const intensityDelta = Math.abs(prevPattern.rhythmicIntensity - currPattern.rhythmicIntensity)
  const intensityConsonance = 1 - intensityDelta // Lineal
  
  // 3. Cambio de sección (cambio de sección = naturalmente menos consonante)
  const sectionConsonance = prevPattern.section === currPattern.section ? 1.0 : 0.6
  
  // 4. Coherencia de dirección (ambos building o ambos releasing = consonante)
  let directionConsonance = 0.7 // Default neutral
  if (prevPattern.isBuilding === currPattern.isBuilding) directionConsonance = 1.0
  if (prevPattern.isReleasing === currPattern.isReleasing) directionConsonance = 1.0
  // Cambio de dirección = disonancia natural (pero esperada)
  if (prevPattern.isBuilding && currPattern.isReleasing) directionConsonance = 0.5
  if (prevPattern.isReleasing && currPattern.isBuilding) directionConsonance = 0.5
  
  // Combinar
  return (
    bpmConsonance * 0.2 +
    intensityConsonance * 0.3 +
    sectionConsonance * 0.25 +
    directionConsonance * 0.25
  )
}

function calculateEmotionalConsonance(
  prevPattern: SeleneMusicalPattern,
  currPattern: SeleneMusicalPattern
): number {
  // Consonancia emocional = coherencia en la tensión
  
  // 1. Cambio de tensión emocional
  const tensionDelta = Math.abs(prevPattern.emotionalTension - currPattern.emotionalTension)
  const tensionConsonance = 1 - tensionDelta
  
  // 2. Cambio de fase de energía
  const phaseConsonance = prevPattern.energyPhase === currPattern.energyPhase ? 1.0 : 0.6
  
  // 3. Coherencia de densidad armónica
  const densityDelta = Math.abs(prevPattern.harmonicDensity - currPattern.harmonicDensity)
  const densityConsonance = 1 - densityDelta
  
  // 4. Drop handling especial
  // Entrar o salir de drop es naturalmente disonante pero necesario
  let dropConsonance = 1.0
  if (prevPattern.isDropActive !== currPattern.isDropActive) {
    dropConsonance = 0.4 // Cambio de drop = disonancia fuerte (pero intencionada)
  }
  
  return (
    tensionConsonance * 0.35 +
    phaseConsonance * 0.25 +
    densityConsonance * 0.20 +
    dropConsonance * 0.20
  )
}

function getConsonanceForDistance(distance: number): number {
  // Buscar entre los intervalos conocidos
  let bestMatch = HUE_CONSONANCE_MAP[0]
  let bestDelta = 180
  
  for (const interval of HUE_CONSONANCE_MAP) {
    const delta = Math.abs(distance - interval.angle)
    if (delta < bestDelta) {
      bestDelta = delta
      bestMatch = interval
    }
  }
  
  // Ajustar por proximidad
  const proximityFactor = Math.exp(-bestDelta / 15)
  return bestMatch.consonance * proximityFactor
}

function categorizeTransition(consonance: number): 'smooth' | 'moderate' | 'abrupt' {
  if (consonance >= 0.7) return 'smooth'
  if (consonance >= 0.4) return 'moderate'
  return 'abrupt'
}

function calculateTransitionSpeed(
  consonance: number,
  pattern: SeleneMusicalPattern
): number {
  // Base speed según consonancia
  // Alta consonancia = transición lenta y elegante
  // Baja consonancia = transición rápida (el cambio ya es abrupto, no lo prolonguemos)
  
  let baseMs = 500 // Default
  
  if (consonance >= 0.8) {
    baseMs = 800 // Muy suave = slow crossfade
  } else if (consonance >= 0.6) {
    baseMs = 500 // Normal
  } else if (consonance >= 0.4) {
    baseMs = 300 // Moderado = más rápido
  } else {
    baseMs = 150 // Abrupto = muy rápido (o instantáneo)
  }
  
  // Ajustar por urgencia del momento musical
  if (pattern.isDropActive) {
    baseMs = Math.min(baseMs, 100) // En drop = instantáneo
  } else if (pattern.section === 'drop' || pattern.section === 'chorus') {
    baseMs = Math.min(baseMs, 250) // Alta energía = rápido
  } else if (pattern.section === 'verse' || pattern.section === 'breakdown') {
    baseMs = Math.max(baseMs, 600) // Baja energía = lento
  }
  
  // Ajustar por BPM (tempo rápido = transiciones más rápidas)
  const bpmFactor = pattern.bpm > 140 ? 0.8 : pattern.bpm < 100 ? 1.2 : 1.0
  
  return Math.round(baseMs * bpmFactor)
}
