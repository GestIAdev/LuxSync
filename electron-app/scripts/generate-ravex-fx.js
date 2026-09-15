/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🩸 WAVE RAVEX-FX: GENERADOR DE EFECTOS LFX V3 — CYBERPUNK / RAVEX
 * ═══════════════════════════════════════════════════════════════════════════
 * Genera 3 efectos LFX V3 para la vibe RaveX con checksums SHA-256 correctos
 * y los escribe en AMBOS paths:
 *   1. Factory:  src/core/arsenal/builtins/ravex/   (bundle en install)
 *   2. UserData: %APPDATA%/luxsync-electron/arsenal/ravex/  (runtime)
 *
 * El checksum es sha256:${SHA-256(JSON.stringify(clip))} — coincide exactamente
 * con LfxFileLoader.computeLfxChecksum() y sync-factory-effects.ts.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const BUILTINS_DIR = path.resolve(__dirname, '..', 'src', 'core', 'arsenal', 'builtins', 'ravex')
const APPDATA = process.env.APPDATA || ''
const USERDATA_ARSENAL = path.join(APPDATA, 'luxsync-electron', 'arsenal', 'ravex')

function checksum(clip) {
  const hex = crypto.createHash('sha256').update(JSON.stringify(clip)).digest('hex')
  return `sha256:${hex}`
}

function writeLfx(filename, clip) {
  const lfx = {
    '$schema': 'luxsync.lfx/3.0',
    clip,
    checksum: checksum(clip)
  }
  const json = JSON.stringify(lfx, null, 2)

  // Factory
  fs.mkdirSync(BUILTINS_DIR, { recursive: true })
  fs.writeFileSync(path.join(BUILTINS_DIR, filename), json + '\n', 'utf-8')
  console.log(`[factory] ${path.join(BUILTINS_DIR, filename)}`)

  // UserData
  if (APPDATA) {
    fs.mkdirSync(USERDATA_ARSENAL, { recursive: true })
    fs.writeFileSync(path.join(USERDATA_ARSENAL, filename), json + '\n', 'utf-8')
    console.log(`[userdata] ${path.join(USERDATA_ARSENAL, filename)}`)
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID()
}

function intensityTrack(zones, keyframes, phaseConfig) {
  return {
    id: uuid(),
    paramId: 'intensity',
    zones,
    curve: {
      paramId: 'intensity',
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      keyframes,
      mode: 'absolute'
    },
    blendMode: 'replace',
    ...(phaseConfig ? { phaseConfig } : {})
  }
}

function colorTrack(zones, keyframes) {
  return {
    id: uuid(),
    paramId: 'color',
    zones,
    curve: {
      paramId: 'color',
      valueType: 'color',
      range: [0, 360],
      defaultValue: { h: 0, s: 0, l: 50 },
      keyframes,
      mode: 'absolute'
    },
    blendMode: 'replace'
  }
}

function strobeTrack(zones, keyframes) {
  return {
    id: uuid(),
    paramId: 'strobe',
    zones,
    curve: {
      paramId: 'strobe',
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      keyframes,
      mode: 'absolute'
    },
    blendMode: 'replace'
  }
}

function panTrack(zones, keyframes, phaseConfig) {
  return {
    id: uuid(),
    paramId: 'pan',
    zones,
    curve: {
      paramId: 'pan',
      valueType: 'number',
      range: [-1, 1],
      defaultValue: 0,
      keyframes,
      mode: 'additive'
    },
    blendMode: 'replace',
    ...(phaseConfig ? { phaseConfig } : {})
  }
}

// ─── 1. LA GUILLOTINA ────────────────────────────────────────────────────────

const guillotinaClip = {
  id: 'fx_guillotina',
  name: 'La Guillotina',
  author: 'LuxSync Factory',
  category: 'physical',
  tags: ['blinder', 'drop', 'blackout', 'ravex', 'cyberpunk', 'impact'],
  vibeCompat: ['rave'],
  spatialZones: ['all'],
  mixBus: 'global',
  priority: 99,
  durationMs: 2000,
  effectType: 'heph_custom',
  tracks: [
    // Intensidad: destello ciego instantáneo → blackout prolongado
    intensityTrack(
      ['all'],
      [
        { timeMs: 0,    value: 1.0, interpolation: 'hold' },
        { timeMs: 30,   value: 0.0, interpolation: 'hold' },
        { timeMs: 2000, value: 0.0, interpolation: 'hold' }
      ],
      { spreadDeg: 0, symmetry: 'linear', wings: 1, blocks: 1, shuffle: 0, shuffleSeed: 1, direction: 1 }
    ),
    // Color: blanco puro (S:0, L:100)
    colorTrack(
      ['all'],
      [
        { timeMs: 0, value: { h: 0, s: 0, l: 100 }, interpolation: 'hold' }
      ]
    ),
    // Strobe: máximo durante el destello de 30ms
    strobeTrack(
      ['all'],
      [
        { timeMs: 0,    value: 1.0, interpolation: 'hold' },
        { timeMs: 30,   value: 0.0, interpolation: 'hold' },
        { timeMs: 2000, value: 0.0, interpolation: 'hold' }
      ]
    )
  ],
  staticParams: {
    dominantColorH: 0,
    dominantColorS: 0,
    dominantColorL: 100,
    isOneShot: true,
    legacyMixBus: 'global',
    bpmRef: 128,
    attackMs: 0,
    strobeHz: 25
  },
  cognitiveDNA: {
    archetype: 'utility',
    genome: { aggression: 1.0, chaos: 0.1, organicity: 0.0 },
    textureAffinity: 'universal',
    compatibleVibes: ['rave'],
    validSections: ['drop', 'climax'],
    energyZone: { min: 'peak', max: 'peak' },
    aggressionRange: { min: 0.8, max: 1 },
    pressureRange: { min: 0.9, max: 1 },
    spatialBehavior: 'static'
  },
  simulationMeta: {
    beautyWeights: { base: 0.95, energyMultiplier: 1.5, vibeBonus: 0.15 },
    gpuCost: 0.2,
    fatigueImpact: 0.9,
    minDurationMs: 500,
    cooldownMs: 20000,
    isStrobe: true,
    isDivineCandidate: true,
    isHeavyCandidate: true,
    zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.85 }
  },
  safetyDeclaration: {
    maxStrobeFreqHz: 25,
    containsRapidFlash: true,
    communityTrusted: false
  },
  schemaVersion: '3.0'
}

// ─── 2. FALLO DE SISTEMA ─────────────────────────────────────────────────────

const MAGENTA = { h: 300, s: 100, l: 50 }
const CYAN    = { h: 180, s: 100, l: 50 }

const sysfailClip = {
  id: 'fx_sysfail',
  name: 'Fallo de Sistema',
  author: 'LuxSync Factory',
  category: 'physical',
  tags: ['strobe', 'glitch', 'ravex', 'breakdown', 'fluorescent', 'asymmetric'],
  vibeCompat: ['rave'],
  spatialZones: ['all', 'all-pars', 'all-movers'],
  mixBus: 'global',
  priority: 85,
  durationMs: 4000,
  effectType: 'heph_custom',
  tracks: [
    // Intensidad: ráfagas epilépticas asimétricas (1,0,1,0,0,1...) con hold
    intensityTrack(
      ['all'],
      [
        { timeMs: 0,    value: 1.0, interpolation: 'hold' },
        { timeMs: 200,  value: 0.0, interpolation: 'hold' },
        { timeMs: 400,  value: 1.0, interpolation: 'hold' },
        { timeMs: 600,  value: 0.0, interpolation: 'hold' },
        { timeMs: 900,  value: 0.0, interpolation: 'hold' },
        { timeMs: 1200, value: 1.0, interpolation: 'hold' },
        { timeMs: 1400, value: 0.0, interpolation: 'hold' },
        { timeMs: 1700, value: 1.0, interpolation: 'hold' },
        { timeMs: 1900, value: 0.0, interpolation: 'hold' },
        { timeMs: 2200, value: 0.0, interpolation: 'hold' },
        { timeMs: 2500, value: 1.0, interpolation: 'hold' },
        { timeMs: 2700, value: 0.0, interpolation: 'hold' },
        { timeMs: 3000, value: 1.0, interpolation: 'hold' },
        { timeMs: 3300, value: 0.0, interpolation: 'hold' },
        { timeMs: 3600, value: 0.0, interpolation: 'hold' },
        { timeMs: 4000, value: 0.0, interpolation: 'hold' }
      ],
      { spreadDeg: 180, symmetry: 'linear', wings: 1, blocks: 2, shuffle: 1, shuffleSeed: 42, direction: 1 }
    ),
    // Color: alternando magenta/cian puro con hold
    colorTrack(
      ['all'],
      [
        { timeMs: 0,    value: MAGENTA, interpolation: 'hold' },
        { timeMs: 400,  value: CYAN,    interpolation: 'hold' },
        { timeMs: 1200, value: MAGENTA, interpolation: 'hold' },
        { timeMs: 1700, value: CYAN,    interpolation: 'hold' },
        { timeMs: 2500, value: MAGENTA, interpolation: 'hold' },
        { timeMs: 3000, value: CYAN,    interpolation: 'hold' },
        { timeMs: 4000, value: MAGENTA, interpolation: 'hold' }
      ]
    ),
    // Strobe: pulsos sincronizados con las ráfagas
    strobeTrack(
      ['all'],
      [
        { timeMs: 0,    value: 0.95, interpolation: 'hold' },
        { timeMs: 200,  value: 0,    interpolation: 'hold' },
        { timeMs: 400,  value: 0.95, interpolation: 'hold' },
        { timeMs: 600,  value: 0,    interpolation: 'hold' },
        { timeMs: 1200, value: 0.95, interpolation: 'hold' },
        { timeMs: 1400, value: 0,    interpolation: 'hold' },
        { timeMs: 1700, value: 0.95, interpolation: 'hold' },
        { timeMs: 1900, value: 0,    interpolation: 'hold' },
        { timeMs: 2500, value: 0.95, interpolation: 'hold' },
        { timeMs: 2700, value: 0,    interpolation: 'hold' },
        { timeMs: 3000, value: 0.95, interpolation: 'hold' },
        { timeMs: 3300, value: 0,    interpolation: 'hold' },
        { timeMs: 4000, value: 0,    interpolation: 'hold' }
      ]
    )
  ],
  staticParams: {
    dominantColorH: 300,
    dominantColorS: 100,
    dominantColorL: 50,
    isOneShot: false,
    legacyMixBus: 'global',
    bpmRef: 128,
    attackMs: 0,
    strobeHz: 20
  },
  cognitiveDNA: {
    archetype: 'utility',
    genome: { aggression: 0.6, chaos: 1.0, organicity: 0.2 },
    textureAffinity: 'dirty',
    compatibleVibes: ['rave'],
    validSections: ['breakdown', 'textural'],
    energyZone: { min: 'active', max: 'intense' },
    aggressionRange: { min: 0.3, max: 0.9 },
    pressureRange: { min: 0.4, max: 0.9 },
    spatialBehavior: 'static'
  },
  simulationMeta: {
    beautyWeights: { base: 0.75, energyMultiplier: 1.2, vibeBonus: 0.15 },
    gpuCost: 0.2,
    fatigueImpact: 0.7,
    minDurationMs: 1000,
    cooldownMs: 8000,
    isStrobe: true,
    isDivineCandidate: false,
    isHeavyCandidate: true,
    zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.5 }
  },
  safetyDeclaration: {
    maxStrobeFreqHz: 20,
    containsRapidFlash: true,
    communityTrusted: false
  },
  schemaVersion: '3.0'
}

// ─── 3. AMETRALLADORA CONVERGENTE ────────────────────────────────────────────

// Tren de pulsos con aceleración logarítmica: gaps comienzan en ~800ms y
// se comprimen hasta ~40ms. Usa hold para cortes mecánicos puros.
function generateAcceleratingPulses(durationMs, numPulses) {
  const kfs = []
  for (let i = 0; i < numPulses; i++) {
    // t = D * (1 - (1 - i/n)^2.5) — aceleración logarítmica
    const t = Math.round(durationMs * (1 - Math.pow(1 - i / numPulses, 2.5)))
    kfs.push({ timeMs: t, value: 1.0, interpolation: 'hold' })
    // Gap tras el pulso (duración del pulso = 10% del gap restante, mínimo 20ms)
    const nextT = i < numPulses - 1
      ? Math.round(durationMs * (1 - Math.pow(1 - (i + 1) / numPulses, 2.5)))
      : durationMs
    const gap = nextT - t
    const pulseWidth = Math.max(20, Math.round(gap * 0.35))
    kfs.push({ timeMs: Math.min(t + pulseWidth, durationMs), value: 0.0, interpolation: 'hold' })
  }
  // Asegurar keyframe final a 0
  if (kfs[kfs.length - 1].timeMs < durationMs) {
    kfs.push({ timeMs: durationMs, value: 0.0, interpolation: 'hold' })
  }
  return kfs
}

const NUM_PULSES = 28
const intensityKfs = generateAcceleratingPulses(8000, NUM_PULSES)

// Strobe sigue la misma aceleración
const strobeKfs = intensityKfs.map(kf => ({
  timeMs: kf.timeMs,
  value: kf.value > 0.5 ? 0.95 : 0.0,
  interpolation: 'hold'
}))

const ametralladoraClip = {
  id: 'fx_ametralladora',
  name: 'Ametralladora Convergente',
  author: 'LuxSync Factory',
  category: 'physical',
  tags: ['strobe', 'buildup', 'riser', 'ravex', 'cyberpunk', 'convergent', 'pan-sweep'],
  vibeCompat: ['rave'],
  spatialZones: ['all', 'all-movers', 'all-pars'],
  mixBus: 'global',
  priority: 88,
  durationMs: 8000,
  effectType: 'heph_custom',
  tracks: [
    // Pan: barrido amplio con bezier — efecto espejo center-out para cruce
    panTrack(
      ['all-movers'],
      [
        { timeMs: 0,    value: -1.0, interpolation: 'bezier', bezierHandles: [0.33, 0, 0.67, 1] },
        { timeMs: 4000, value: 1.0,  interpolation: 'bezier', bezierHandles: [0.33, 1, 0.67, 0] },
        { timeMs: 8000, value: -1.0, interpolation: 'bezier', bezierHandles: [0.33, 0, 0.67, 1] }
      ],
      { spreadDeg: 360, symmetry: 'center-out', wings: 2, blocks: 1, shuffle: 0, shuffleSeed: 1, direction: 1 }
    ),
    // Intensidad: tren de pulsos con aceleración logarítmica (hold = cortes mecánicos)
    intensityTrack(
      ['all'],
      intensityKfs,
      { spreadDeg: 360, symmetry: 'center-out', wings: 2, blocks: 1, shuffle: 0, shuffleSeed: 1, direction: 1 }
    ),
    // Color: cian puro (firma cyberpunk) — mantiene coherencia durante el buildup
    colorTrack(
      ['all'],
      [
        { timeMs: 0,    value: CYAN,    interpolation: 'hold' },
        { timeMs: 6000, value: MAGENTA, interpolation: 'hold' },
        { timeMs: 8000, value: { h: 0, s: 0, l: 100 }, interpolation: 'hold' }
      ]
    ),
    // Strobe: acelerando con los pulsos
    strobeTrack(
      ['all'],
      strobeKfs
    )
  ],
  staticParams: {
    dominantColorH: 180,
    dominantColorS: 100,
    dominantColorL: 50,
    isOneShot: false,
    legacyMixBus: 'global',
    bpmRef: 128,
    attackMs: 0,
    strobeHz: 25
  },
  cognitiveDNA: {
    archetype: 'utility',
    genome: { aggression: 0.8, chaos: 0.4, organicity: 0.5 },
    textureAffinity: 'universal',
    compatibleVibes: ['rave'],
    validSections: ['buildup'],
    energyZone: { min: 'active', max: 'peak' },
    aggressionRange: { min: 0.5, max: 1 },
    pressureRange: { min: 0.5, max: 1 },
    spatialBehavior: 'sweep'
  },
  simulationMeta: {
    beautyWeights: { base: 0.85, energyMultiplier: 1.35, vibeBonus: 0.12 },
    gpuCost: 0.25,
    fatigueImpact: 0.75,
    minDurationMs: 2000,
    cooldownMs: 12000,
    isStrobe: true,
    isDivineCandidate: false,
    isHeavyCandidate: true,
    zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.6 }
  },
  safetyDeclaration: {
    maxStrobeFreqHz: 25,
    containsRapidFlash: true,
    communityTrusted: false
  },
  schemaVersion: '3.0'
}

// ─── ESCRIBIR LOS 3 ARCHIVOS ─────────────────────────────────────────────────

console.log('═══ GENERANDO EFECTOS LFX V3 — RAVEX ═══\n')

writeLfx('fx_guillotina.lfx', guillotinaClip)
writeLfx('fx_sysfail.lfx', sysfailClip)
writeLfx('fx_ametralladora.lfx', ametralladoraClip)

console.log('\n═══ DONE — 3 efectos escritos en factory + userdata ═══')
console.log('Ahora ejecuta: npm run forge:manifest  para regenerar manifest.json')
