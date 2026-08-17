import { describe, it, expect, beforeEach } from 'vitest'
import {
  predict,
  observeSection,
  getCassandraState,
  resetPredictionEngine,
  validatePrediction,
  getSectionHistory,
} from '../PredictionEngine'
import { CrestDetector } from '../../liquid/CrestDetector'
import type { SeleneMusicalPattern } from '../../types'

function mkPattern(section: string, t: number): SeleneMusicalPattern {
  return {
    vibeId: 'techno-club',
    section: section as SeleneMusicalPattern['section'],
    energyPhase: 'building',
    bpm: 128,
    beatPhase: 0.25,
    syncopation: 0.2,
    rhythmicIntensity: 0.5,
    emotionalTension: 0.4,
    isBuilding: true,
    isReleasing: false,
    harmonicDensity: 0.5,
    bassPresence: 0.5,
    midPresence: 0.5,
    highPresence: 0.5,
    isDropActive: false,
    pllLocked: true,
    bpmConfidence: 0.9,
    timestamp: t,
  } as unknown as SeleneMusicalPattern
}

describe('Cassandra 2.0', () => {
  beforeEach(() => resetPredictionEngine())

  it('cold start: prior recovers breakdown→buildup→drop @ high mass', () => {
    observeSection('breakdown')
    observeSection('buildup')
    const p = predict(mkPattern('buildup', 1000))
    const st = getCassandraState()
    expect(st.prev2).toBe('breakdown')
    expect(st.prev1).toBe('buildup')
    expect(p.probableSection).toBe('drop')
    expect(p.type).toBe('drop_incoming')
    expect(st.probability).toBeGreaterThan(0.6)
  })

  it('never predicts self-loop nor unknown', () => {
    observeSection('verse')
    observeSection('chorus')
    predict(mkPattern('chorus', 1000))
    const st = getCassandraState()
    expect(st.probableSection).not.toBe('chorus')
    expect(st.probableSection).not.toBe('unknown')
  })

  it('unknown is a transparent skip (no learning, no context shift)', () => {
    observeSection('verse')
    observeSection('buildup')
    observeSection('unknown')
    const st = getCassandraState()
    expect(st.prev1).toBe('buildup')
    expect(st.prev2).toBe('verse')
  })

  it('online learning overrides the prior after repeated evidence', () => {
    // Teach an unusual structure: chorus → drop → outro, 12 times
    for (let i = 0; i < 12; i++) {
      observeSection('chorus')
      observeSection('drop')
      observeSection('outro')
    }
    observeSection('chorus')
    observeSection('drop')
    predict(mkPattern('drop', 5000))
    const st = getCassandraState()
    expect(st.probableSection).toBe('outro') // prior said 'breakdown'
    expect(st.evidenceMass2).toBeGreaterThan(5)
  })

  it('evidence mass is bounded by 1/(1-lambda)', () => {
    for (let i = 0; i < 5000; i++) {
      observeSection('verse')
      observeSection('buildup')
    }
    const st = getCassandraState()
    expect(st.evidenceMass2).toBeLessThan(1 / (1 - 0.94) + 0.01)
    expect(Number.isFinite(st.evidenceMass2)).toBe(true)
  })

  it('posterior is a normalized distribution with sane entropy confidence', () => {
    observeSection('intro')
    observeSection('verse')
    predict(mkPattern('verse', 1000))
    const st = getCassandraState()
    expect(st.probability).toBeGreaterThan(0)
    expect(st.probability).toBeLessThanOrEqual(1)
    expect(st.epistemicConfidence).toBeGreaterThan(0)
    expect(st.epistemicConfidence).toBeLessThanOrEqual(st.probability)
    expect(st.margin).toBeGreaterThanOrEqual(0)
  })

  it('validatePrediction moves hit-rate but not the kernel', () => {
    observeSection('breakdown')
    observeSection('buildup')
    const p = predict(mkPattern('buildup', 1000))
    const before = getCassandraState().evidenceMass2
    validatePrediction(p, 'drop')
    const after = getCassandraState()
    expect(after.evidenceMass2).toBe(before)
    expect(after.hitRate).toBeGreaterThan(0.5)
  })

  it('history ring exposes segments in order without unknowns', () => {
    predict(mkPattern('intro', 0))
    predict(mkPattern('verse', 1000))
    predict(mkPattern('unknown', 1500))
    predict(mkPattern('buildup', 2000))
    const h = getSectionHistory()
    expect(h.map(e => e.section)).toEqual(['intro', 'verse', 'buildup'])
    expect(h[0].durationMs).toBe(1000)
  })

  it('ETA is quantized to the PLL beat grid', () => {
    observeSection('breakdown')
    observeSection('buildup')
    const p = predict(mkPattern('buildup', 1000))
    const msPerBeat = 60000 / 128
    const residual = (p.estimatedTimeMs % msPerBeat) / msPerBeat
    expect(Math.abs(residual - 0.75)).toBeLessThan(0.001)
  })
})

describe('True Crest Detector', () => {
  it('percussive pulse train yields high Pi, sustained pad yields ~0', () => {
    const perc = new CrestDetector()
    const pad = new CrestDetector()
    const dt = 1 / 44
    let piPerc = 0
    let piPad = 0
    let events = 0
    for (let i = 0; i < 44 * 20; i++) {
      const t = i * dt
      // 4 hits/s with sharp transients over a 0.35 floor
      const phase = (i % 11)
      const e = phase === 0 ? 0.95 : 0.30
      piPerc = perc.tick(e, t, dt)
      if (perc.event) events++
      piPad = pad.tick(0.55 + 0.01 * Math.sin(t), t, dt)
    }
    expect(events).toBeGreaterThan(60)      // ~4/s × 20s
    expect(perc.rate).toBeGreaterThan(2.5)
    expect(piPerc).toBeGreaterThan(0.4)
    expect(piPad).toBeLessThan(0.05)
    expect(pad.rate).toBeLessThan(0.1)
  })

  it('refractory caps the event rate at 25/s', () => {
    const d = new CrestDetector()
    const dt = 1 / 44
    let events = 0
    for (let i = 0; i < 44 * 5; i++) {
      const e = i % 2 === 0 ? 0.9 : 0.2
      d.tick(e, i * dt, dt)
      if (d.event) events++
    }
    expect(events).toBeLessThanOrEqual(25 * 5 + 1)
  })

  it('energy gate blocks crests in silence', () => {
    const d = new CrestDetector()
    const dt = 1 / 44
    let events = 0
    for (let i = 0; i < 44 * 5; i++) {
      const e = i % 11 === 0 ? 0.10 : 0.001
      d.tick(e, i * dt, dt)
      if (d.event) events++
    }
    expect(events).toBe(0)
  })
})
