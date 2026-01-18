/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 MOOD CALIBRATION LAB - WAVE 700.5.2: SELENE LAB RELOADED
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * STRESS TESTING SUITE para calibrar los 3 modos del MoodController.
 * 
 * "Los efectos son como las virutas del helado... si pones demasiadas,
 *  no dejas disfrutar el helado." - Radwulf
 * 
 * 🎭 WAVE 700.5.2: CONSENSO DEL CÓNCLAVE
 * 
 * "Las luces ya bailan solas (paletas, físicas, movers). 
 *  Los efectos son ACENTOS, no el plato principal.
 *  Un solomillo se sirve solo; las patatas fritas se sirven a montones.
 *  CumbiaMoon es solomillo." - El Arquitecto
 * 
 * EXPECTATIVAS (Consenso del Cónclave):
 * - CALM: 1-3 EPM (1 efecto cada 20-60s) - Efectos mínimos, deja respirar la paleta
 * - BALANCED: 4-6 EPM (1 efecto cada 10-15s) - Narrativa visual, acentos en momentos clave
 * - PUNK: 8-10 EPM (1 efecto cada 6-8s) - Caos controlado, pero no epilepsia
 * 
 * @module tests/MoodCalibrationLab
 * @version WAVE 700.5.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MoodController, MOOD_PROFILES, MoodId } from '../index.js'
import { ContextualEffectSelector, ContextualSelectorInput } from '../../effects/ContextualEffectSelector.js'
import { MusicalContext } from '../../effects/types.js'
import { HuntDecision } from '../../intelligence/think/HuntEngine.js'
import { FuzzyDecision } from '../../intelligence/think/FuzzyDecisionMaker.js'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type SectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'buildup' | 'drop' | 'breakdown' | 'outro'

/**
 * 🎺 Frame sintético para simulación de audio
 * Incluye Hunt + Fuzzy decisions realistas
 */
interface SyntheticFrame {
  timestamp: number
  bpm: number
  energy: number
  zScore: number
  sectionType: SectionType
  energyTrend: 'rising' | 'stable' | 'falling'
  beatPhase: number
  inDrop: boolean
  vibeId: string
  huntDecision: HuntDecision | null
  fuzzyDecision: FuzzyDecision | null
}

// ═══════════════════════════════════════════════════════════════════════════
// HUNT + FUZZY SIMULATORS (basados en comportamiento real observado)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 HUNT DECISION GENERATOR
 * Simula el comportamiento del HuntEngine basado en el contexto musical
 * 
 * El Hunt real:
 * - stalking → evaluating → striking → learning
 * - Strike cuando detecta oportunidad (Z alto + timing correcto)
 * - Cooldown de ~1.5 segundos entre strikes
 */
function generateHuntDecision(
  zScore: number,
  section: SectionType,
  energy: number,
  frameIndex: number,
  lastHuntStrikeFrame: number
): HuntDecision {
  const framesSinceLastStrike = frameIndex - lastHuntStrikeFrame
  const huntCooldownFrames = 45 // ~1.5 segundos a 30fps
  
  // Condiciones para que Hunt considere strike:
  const isGoodSection = !['intro', 'outro'].includes(section)
  const isEpicMoment = zScore >= 2.5 && energy >= 0.5
  const isCooldownReady = framesSinceLastStrike >= huntCooldownFrames
  
  if (isGoodSection && isEpicMoment && isCooldownReady) {
    return {
      suggestedPhase: 'striking',
      shouldStrike: true,
      confidence: Math.min(0.95, 0.6 + (zScore - 2.5) * 0.15 + energy * 0.2),
      conditions: null,
      activeCandidate: null,
      reasoning: `Strike opportunity: Z=${zScore.toFixed(2)} E=${energy.toFixed(2)} Section=${section}`,
    }
  }
  
  return {
    suggestedPhase: zScore >= 1.5 ? 'stalking' : 'learning',
    shouldStrike: false,
    confidence: 0.3,
    conditions: null,
    activeCandidate: null,
    reasoning: 'Observing...',
  }
}

/**
 * 🔮 FUZZY DECISION GENERATOR  
 * Simula el FuzzyDecisionMaker basado en el contexto
 */
function generateFuzzyDecision(
  zScore: number,
  section: SectionType,
  energy: number,
  energyTrend: string
): FuzzyDecision {
  // FORCE_STRIKE: Momento divino (Z >= 3.5)
  if (zScore >= 3.5) {
    return {
      action: 'force_strike',
      intensity: 1.0,
      confidence: 0.95,
      reasoning: `DIVINE MOMENT Z=${zScore.toFixed(2)}σ`,
      fuzzyScores: { hold: 0, prepare: 0.1, strike: 0.3, forceStrike: 0.95 },
      dominantRule: 'divine_zscore',
    }
  }
  
  // STRIKE: Epic moment (Z >= 2.8) o buildup climax
  if (zScore >= 2.8 || (section === 'buildup' && energyTrend === 'rising' && energy >= 0.7)) {
    return {
      action: 'strike',
      intensity: Math.min(1, 0.7 + (zScore - 2.8) * 0.1),
      confidence: Math.min(0.95, 0.75 + (zScore - 2.8) * 0.05),
      reasoning: `EPIC: Z=${zScore.toFixed(2)}σ Section=${section}`,
      fuzzyScores: { hold: 0.1, prepare: 0.2, strike: 0.8, forceStrike: 0.3 },
      dominantRule: 'epic_moment',
    }
  }
  
  // PREPARE: Elevated moment (Z >= 2.0)
  if (zScore >= 2.0 || (section === 'chorus' && energy >= 0.6)) {
    return {
      action: 'prepare',
      intensity: 0.5,
      confidence: 0.6,
      reasoning: `Building tension Z=${zScore.toFixed(2)}σ`,
      fuzzyScores: { hold: 0.2, prepare: 0.7, strike: 0.3, forceStrike: 0 },
      dominantRule: 'building_tension',
    }
  }
  
  // HOLD: Normal moment
  return {
    action: 'hold',
    intensity: 0.2,
    confidence: 0.8,
    reasoning: 'Holding steady',
    fuzzyScores: { hold: 0.8, prepare: 0.2, strike: 0.1, forceStrike: 0 },
    dominantRule: 'steady_state',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎺 FIESTA LATINA 128 BPM
 * Escenario realista basado en logs de prueba manual
 * - Drops cada ~30 segundos
 * - Z-Scores observados: 2.5-4.0 en momentos épicos
 */
function generateFiestaLatinaFrames(durationSeconds: number): SyntheticFrame[] {
  const frames: SyntheticFrame[] = []
  const fps = 30
  const totalFrames = durationSeconds * fps
  const bpm = 128
  const msPerBeat = 60000 / bpm
  
  // Estructura realista de canción latina
  const structure: Array<{start: number, end: number, section: SectionType}> = [
    { start: 0, end: 16, section: 'intro' },
    { start: 16, end: 48, section: 'verse' },
    { start: 48, end: 64, section: 'buildup' },
    { start: 64, end: 80, section: 'drop' },
    { start: 80, end: 112, section: 'verse' },
    { start: 112, end: 128, section: 'chorus' },
    { start: 128, end: 144, section: 'buildup' },
    { start: 144, end: 160, section: 'drop' },
    { start: 160, end: 192, section: 'breakdown' },
    { start: 192, end: 224, section: 'chorus' },
    { start: 224, end: 256, section: 'buildup' },
    { start: 256, end: 272, section: 'drop' },
    { start: 272, end: 300, section: 'outro' },
  ]
  
  // Z-Scores REALISTAS basados en logs
  // WAVE 700.5.2: Bajamos drop de 3.5 a 3.0 para que solo
  // algunos frames con variación positiva alcancen divine (>= 3.5)
  const sectionZScoreBase: Record<string, number> = {
    'intro': 1.0,
    'verse': 1.8,      // Observado: 1.5-2.5
    'buildup': 2.3,    // Observado: 2.0-3.0 (rising)
    'drop': 3.0,       // Observado: 2.8-3.5 (solo picos alcanzan divine)
    'chorus': 2.5,     // Observado: 2.3-3.0
    'breakdown': 1.2,
    'outro': 0.8,
  }
  
  const sectionEnergyBase: Record<string, number> = {
    'intro': 0.35,
    'verse': 0.55,
    'buildup': 0.70,
    'drop': 0.90,
    'chorus': 0.75,
    'breakdown': 0.30,
    'outro': 0.25,
  }
  
  let lastHuntStrikeFrame = -100 // Para cooldown del Hunt
  
  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = (i / fps) * 1000
    const timestampSec = timestampMs / 1000
    
    // Determinar sección actual
    let section: SectionType = 'outro'
    let sectionStartSec = 0
    for (const s of structure) {
      if (timestampSec >= s.start && timestampSec < s.end) {
        section = s.section
        sectionStartSec = s.start
        break
      }
    }
    
    const frameInSection = Math.floor((timestampSec - sectionStartSec) * fps)
    
    // Variación orgánica (determinista basada en timestamp)
    const variation = Math.sin(timestampMs * 0.002) * 0.3 + Math.sin(timestampMs * 0.007) * 0.15
    
    const energy = Math.max(0.1, Math.min(1, sectionEnergyBase[section] + variation * 0.2))
    const zScore = Math.max(0.5, sectionZScoreBase[section] + variation)
    
    const beatPhase = (timestampMs % msPerBeat) / msPerBeat
    
    const trend: 'rising' | 'stable' | 'falling' = 
      section === 'buildup' ? 'rising' :
      section === 'breakdown' || section === 'outro' ? 'falling' : 'stable'
    
    // Generar Hunt decision
    const huntDecision = generateHuntDecision(zScore, section, energy, i, lastHuntStrikeFrame)
    if (huntDecision.shouldStrike) {
      lastHuntStrikeFrame = i
    }
    
    // Generar Fuzzy decision
    const fuzzyDecision = generateFuzzyDecision(zScore, section, energy, trend)
    
    frames.push({
      timestamp: timestampMs,
      bpm,
      energy,
      zScore,
      sectionType: section,
      energyTrend: trend,
      beatPhase,
      inDrop: section === 'drop',
      vibeId: 'fiesta-latina',
      huntDecision,
      fuzzyDecision,
    })
  }
  
  return frames
}

/**
 * 🎵 TECHNO AGRESIVO 145 BPM
 * Energía constante alta - para testear blockList de CALM
 */
function generateTechnoAggressiveFrames(durationSeconds: number): SyntheticFrame[] {
  const frames: SyntheticFrame[] = []
  const fps = 30
  const totalFrames = durationSeconds * fps
  const bpm = 145
  const msPerBeat = 60000 / bpm
  
  let lastHuntStrikeFrame = -100
  
  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = (i / fps) * 1000
    const timestampSec = timestampMs / 1000
    
    // Techno: Casi todo es chorus/drop con pequeños buildups
    const cyclePos = timestampSec % 32
    const section: SectionType = 
      cyclePos < 4 ? 'buildup' :
      cyclePos < 12 ? 'drop' : 'chorus'
    
    // Energía constantemente alta
    const variation = Math.sin(timestampMs * 0.003) * 0.15
    const energy = Math.max(0.6, Math.min(1, 0.80 + variation))
    
    // Z-Score alto constantemente (techno = adrenalina)
    const zScore = 2.8 + Math.sin(timestampMs * 0.002) * 0.6
    
    const beatPhase = (timestampMs % msPerBeat) / msPerBeat
    
    const huntDecision = generateHuntDecision(zScore, section, energy, i, lastHuntStrikeFrame)
    if (huntDecision.shouldStrike) {
      lastHuntStrikeFrame = i
    }
    
    const fuzzyDecision = generateFuzzyDecision(zScore, section, energy, 'stable')
    
    frames.push({
      timestamp: timestampMs,
      bpm,
      energy,
      zScore,
      sectionType: section,
      energyTrend: 'stable',
      beatPhase,
      inDrop: section === 'drop',
      vibeId: 'techno',
      huntDecision,
      fuzzyDecision,
    })
  }
  
  return frames
}

/**
 * 🌴 CHILL LOUNGE 95 BPM
 * Energía baja - para verificar que PUNK no satura en ambiente tranquilo
 */
function generateChillLoungeFrames(durationSeconds: number): SyntheticFrame[] {
  const frames: SyntheticFrame[] = []
  const fps = 30
  const totalFrames = durationSeconds * fps
  const bpm = 95
  const msPerBeat = 60000 / bpm
  
  let lastHuntStrikeFrame = -100
  
  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = (i / fps) * 1000
    const timestampSec = timestampMs / 1000
    
    // Chill: Mayormente verse con ocasionales chorus
    const cyclePos = timestampSec % 60
    const section: SectionType = 
      cyclePos < 15 ? 'intro' :
      cyclePos < 45 ? 'verse' :
      cyclePos < 52 ? 'chorus' : 'breakdown'
    
    // Energía baja con ondulaciones suaves
    const wave = Math.sin(timestampMs * 0.0008) * 0.12
    const energy = Math.max(0.2, Math.min(0.55, 0.38 + wave))
    
    // Z-Score bajo pero con picos ocasionales
    const zScore = 1.2 + Math.sin(timestampMs * 0.0005) * 0.5 + 
                   (section === 'chorus' ? 0.8 : 0)
    
    const beatPhase = (timestampMs % msPerBeat) / msPerBeat
    
    const huntDecision = generateHuntDecision(zScore, section, energy, i, lastHuntStrikeFrame)
    if (huntDecision.shouldStrike) {
      lastHuntStrikeFrame = i
    }
    
    const fuzzyDecision = generateFuzzyDecision(zScore, section, energy, 'stable')
    
    frames.push({
      timestamp: timestampMs,
      bpm,
      energy,
      zScore,
      sectionType: section,
      energyTrend: 'stable',
      beatPhase,
      inDrop: false,
      vibeId: 'chill-lounge',
      huntDecision,
      fuzzyDecision,
    })
  }
  
  return frames
}

// ═══════════════════════════════════════════════════════════════════════════
// STRESS TEST ENGINE
// ═══════════════════════════════════════════════════════════════════════════

interface StressTestResult {
  scenario: string
  mood: MoodId
  durationSeconds: number
  totalEffects: number
  effectsPerMinute: number
  effectDistribution: Record<string, number>
  peakEPM: number
  avgConfidence: number
  huntStrikes: number
  fuzzyStrikes: number
  strobesInCalm: number
}

/**
 * 🧪 MOOD STRESS TESTER
 * 
 * WAVE 700.5.2: Ahora mockea Date.now() para que los cooldowns funcionen
 * correctamente con los timestamps sintéticos de los frames.
 */
class MoodStressTester {
  private moodController: MoodController
  private selector: ContextualEffectSelector
  private currentMockedTime: number = 0
  
  constructor() {
    this.moodController = MoodController.getInstance()
    this.selector = new ContextualEffectSelector()
  }
  
  runScenario(scenarioName: string, frames: SyntheticFrame[], mood: MoodId): StressTestResult {
    this.moodController.setMood(mood)
    this.selector = new ContextualEffectSelector() // Reset cooldowns
    
    let lastEffectTimestamp = 0
    let lastEffectType: string | null = null
    const effectsFired: Array<{timestamp: number, effectType: string, reason: string}> = []
    const effectDistribution: Record<string, number> = {}
    let totalConfidence = 0
    let huntStrikes = 0
    let fuzzyStrikes = 0
    let strobesInCalm = 0
    
    // Contar strikes de Hunt/Fuzzy en los frames
    for (const frame of frames) {
      if (frame.huntDecision?.shouldStrike) huntStrikes++
      if (frame.fuzzyDecision?.action === 'strike' || frame.fuzzyDecision?.action === 'force_strike') {
        fuzzyStrikes++
      }
    }
    
    // 🔧 WAVE 700.5.2: MOCK DATE.NOW() - LA CLAVE!
    // El selector usa Date.now() para calcular cooldowns.
    // Debemos mockearlo para que retorne el timestamp del frame actual.
    const originalDateNow = Date.now
    
    for (const frame of frames) {
      // Mock Date.now() para este frame
      Date.now = () => frame.timestamp
      
      const musicalContext: MusicalContext = {
        bpm: frame.bpm,
        energy: frame.energy,
        zScore: frame.zScore,
        vibeId: frame.vibeId,
        beatPhase: frame.beatPhase,
        inDrop: frame.inDrop,
      }
      
      const input: ContextualSelectorInput = {
        musicalContext,
        huntDecision: frame.huntDecision ?? undefined,
        fuzzyDecision: frame.fuzzyDecision ?? undefined,
        sectionType: frame.sectionType,
        energyTrend: frame.energyTrend,
        lastEffectTimestamp,
        lastEffectType,
      }
      
      const selection = this.selector.select(input)
      
      if (selection.effectType) {
        effectsFired.push({
          timestamp: frame.timestamp,
          effectType: selection.effectType,
          reason: selection.reason,
        })
        
        effectDistribution[selection.effectType] = 
          (effectDistribution[selection.effectType] || 0) + 1
        
        // Track strobes en CALM (para validar blockList)
        if (mood === 'calm' && 
            (selection.effectType === 'strobe_storm' || selection.effectType === 'strobe_burst')) {
          strobesInCalm++
        }
        
        lastEffectTimestamp = frame.timestamp
        lastEffectType = selection.effectType
        totalConfidence += selection.confidence
        
        this.selector.registerEffectFired(selection.effectType)
      }
    }
    
    // Restaurar Date.now() original
    Date.now = originalDateNow
    
    const durationMinutes = frames[frames.length - 1].timestamp / 60000
    const epm = effectsFired.length / durationMinutes
    
    // Peak EPM (ventana de 1 minuto)
    let peakEPM = 0
    const windowMs = 60000
    for (let start = 0; start < frames[frames.length - 1].timestamp - windowMs; start += 10000) {
      const count = effectsFired.filter(e => e.timestamp >= start && e.timestamp < start + windowMs).length
      peakEPM = Math.max(peakEPM, count)
    }
    
    return {
      scenario: scenarioName,
      mood,
      durationSeconds: frames[frames.length - 1].timestamp / 1000,
      totalEffects: effectsFired.length,
      effectsPerMinute: Math.round(epm * 10) / 10,
      effectDistribution,
      peakEPM,
      avgConfidence: effectsFired.length > 0 
        ? Math.round((totalConfidence / effectsFired.length) * 100) / 100 
        : 0,
      huntStrikes,
      fuzzyStrikes,
      strobesInCalm,
    }
  }
  
  runFullSuite(): { results: StressTestResult[], summary: string } {
    const results: StressTestResult[] = []
    
    const fiestaFrames = generateFiestaLatinaFrames(300)  // 5 minutos
    const technoFrames = generateTechnoAggressiveFrames(120) // 2 minutos
    const chillFrames = generateChillLoungeFrames(180)    // 3 minutos
    
    const scenarios = [
      { name: 'Fiesta Latina 128BPM', frames: fiestaFrames },
      { name: 'Techno Aggressive 145BPM', frames: technoFrames },
      { name: 'Chill Lounge 95BPM', frames: chillFrames },
    ]
    
    const moods: MoodId[] = ['calm', 'balanced', 'punk']
    
    for (const scenario of scenarios) {
      for (const mood of moods) {
        this.selector = new ContextualEffectSelector()
        results.push(this.runScenario(scenario.name, scenario.frames, mood))
      }
    }
    
    const summary = this.generateReport(results)
    return { results, summary }
  }
  
  private generateReport(results: StressTestResult[]): string {
    // 🎭 WAVE 700.5.2: EPM ideales del Consenso del Cónclave
    // "Los efectos son ACENTOS, no el plato principal"
    const idealEPM: Record<MoodId, {min: number, max: number}> = {
      'calm': { min: 1, max: 3 },      // 1 efecto cada 20-60s
      'balanced': { min: 4, max: 6 },  // 1 efecto cada 10-15s
      'punk': { min: 8, max: 10 },     // 1 efecto cada 6-8s
    }
    
    const lines = [
      '# 🧪 MOOD CALIBRATION REPORT - WAVE 700.5.2 (Consenso del Cónclave)',
      '',
      `**Fecha**: ${new Date().toISOString().split('T')[0]}`,
      `**Version**: Hunt+Fuzzy Simulation`,
      `**Filosofía**: "Solomillo vs Patatas Fritas" - Los efectos son acentos, no spam`,
      '',
      '## 📊 RESULTADOS POR ESCENARIO',
      '',
      '| Escenario | Modo | EPM | Ideal | Peak | Total | Hunt↯ | Fuzzy↯ | Veredicto |',
      '|-----------|------|-----|-------|------|-------|-------|--------|-----------|',
    ]
    
    for (const r of results) {
      const ideal = idealEPM[r.mood]
      let veredicto = '✅ OK'
      if (r.effectsPerMinute < ideal.min) veredicto = '⚠️ BAJO'
      else if (r.effectsPerMinute > ideal.max) veredicto = '🚨 SATURADO'
      
      lines.push(
        `| ${r.scenario} | ${r.mood.toUpperCase()} | ${r.effectsPerMinute} | ${ideal.min}-${ideal.max} | ${r.peakEPM} | ${r.totalEffects} | ${r.huntStrikes} | ${r.fuzzyStrikes} | ${veredicto} |`
      )
    }
    
    lines.push('')
    lines.push('## 🎨 DISTRIBUCIÓN DE EFECTOS (Balanced, Fiesta Latina)')
    
    const balancedLatina = results.find(r => r.mood === 'balanced' && r.scenario.includes('Latina'))
    if (balancedLatina && balancedLatina.totalEffects > 0) {
      lines.push('')
      lines.push('| Efecto | Count | % |')
      lines.push('|--------|-------|---|')
      const sorted = Object.entries(balancedLatina.effectDistribution).sort((a, b) => b[1] - a[1])
      for (const [effect, count] of sorted) {
        lines.push(`| ${effect} | ${count} | ${Math.round((count / balancedLatina.totalEffects) * 100)}% |`)
      }
    }
    
    lines.push('')
    lines.push('## 🔬 CONFIGURACIÓN ACTUAL DE MOODS')
    lines.push('')
    lines.push('| Modo | Threshold | Cooldown | MaxInt | BlockList |')
    lines.push('|------|-----------|----------|--------|-----------|')
    
    for (const mood of ['calm', 'balanced', 'punk'] as MoodId[]) {
      const p = MOOD_PROFILES[mood]
      lines.push(`| ${p.emoji} ${mood.toUpperCase()} | ${p.thresholdMultiplier}x | ${p.cooldownMultiplier}x | ${p.maxIntensity} | ${p.blockList.join(', ') || 'none'} |`)
    }
    
    lines.push('')
    lines.push('---')
    lines.push('*"Los efectos son como las virutas del helado..."* - Radwulf')
    
    return lines.join('\n')
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🧪 WAVE 700.5.1: Mood Calibration Lab (Hunt+Fuzzy)', () => {
  let tester: MoodStressTester
  
  beforeEach(() => {
    MoodController.resetInstance()
    tester = new MoodStressTester()
  })
  
  describe('📊 EPM Metrics by Mood', () => {
    
    // 🎭 WAVE 700.5.2: EPM targets del Cónclave
    // CALM: 1-3 EPM (1 efecto cada 20-60s)
    // BALANCED: 4-6 EPM (1 efecto cada 10-15s)
    // PUNK: 8-10 EPM (1 efecto cada 6-8s)
    
    it('CALM mode should have EPM between 0-4 on Fiesta Latina', () => {
      const frames = generateFiestaLatinaFrames(300)
      const result = tester.runScenario('Fiesta Latina', frames, 'calm')
      
      console.log(`[CALM] Fiesta Latina: EPM=${result.effectsPerMinute}, Total=${result.totalEffects}`)
      console.log(`[CALM] Hunt strikes in frames: ${result.huntStrikes}, Fuzzy strikes: ${result.fuzzyStrikes}`)
      console.log(`[CALM] Distribution:`, result.effectDistribution)
      
      // Target: 1-3 EPM, tolerancia 0-4
      expect(result.effectsPerMinute).toBeGreaterThanOrEqual(0)
      expect(result.effectsPerMinute).toBeLessThanOrEqual(4)
    })
    
    it('BALANCED mode should have EPM between 2-8 on Fiesta Latina', () => {
      const frames = generateFiestaLatinaFrames(300)
      const result = tester.runScenario('Fiesta Latina', frames, 'balanced')
      
      console.log(`[BALANCED] Fiesta Latina: EPM=${result.effectsPerMinute}, Total=${result.totalEffects}`)
      console.log(`[BALANCED] Hunt strikes: ${result.huntStrikes}, Fuzzy strikes: ${result.fuzzyStrikes}`)
      console.log(`[BALANCED] Distribution:`, result.effectDistribution)
      
      // Target: 4-6 EPM, tolerancia 2-8
      expect(result.effectsPerMinute).toBeGreaterThanOrEqual(2)
      expect(result.effectsPerMinute).toBeLessThanOrEqual(8)
    })
    
    it('PUNK mode should have EPM between 5-12 on Fiesta Latina', () => {
      const frames = generateFiestaLatinaFrames(300)
      const result = tester.runScenario('Fiesta Latina', frames, 'punk')
      
      console.log(`[PUNK] Fiesta Latina: EPM=${result.effectsPerMinute}, Total=${result.totalEffects}`)
      console.log(`[PUNK] Distribution:`, result.effectDistribution)
      
      // Target: 8-10 EPM, tolerancia 5-12
      expect(result.effectsPerMinute).toBeGreaterThanOrEqual(5)
      expect(result.effectsPerMinute).toBeLessThanOrEqual(12)
    })
  })
  
  describe('🚫 Hierarchy Tests (Calm Blocking)', () => {
    
    it('CALM mode should NOT fire strobes on aggressive techno', () => {
      const frames = generateTechnoAggressiveFrames(120)
      const result = tester.runScenario('Techno Aggressive', frames, 'calm')
      
      console.log(`[CALM TECHNO TEST] EPM=${result.effectsPerMinute}`)
      console.log(`[CALM TECHNO TEST] Full distribution:`, JSON.stringify(result.effectDistribution, null, 2))
      
      const strobeCount = (result.effectDistribution['strobe_storm'] || 0) +
                          (result.effectDistribution['strobe_burst'] || 0)
      
      console.log(`[CALM TECHNO TEST] Total strobes: ${strobeCount}`)
      
      expect(strobeCount).toBe(0)
    })
  })
  
  describe('📋 Full Suite Report', () => {
    
    it('should generate complete calibration report', () => {
      const { results, summary } = tester.runFullSuite()
      
      console.log('\n' + '='.repeat(80))
      console.log(summary)
      console.log('='.repeat(80) + '\n')
      
      expect(results.length).toBe(9)
      expect(summary).toContain('MOOD CALIBRATION REPORT')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export function runCalibrationLab(): string {
  MoodController.resetInstance()
  const tester = new MoodStressTester()
  const { summary } = tester.runFullSuite()
  return summary
}

export { 
  MoodStressTester,
  generateFiestaLatinaFrames,
  generateTechnoAggressiveFrames,
  generateChillLoungeFrames,
}
