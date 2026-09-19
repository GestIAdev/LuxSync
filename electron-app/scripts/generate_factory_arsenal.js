/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏭 FACTORY ARSENAL GENERATOR — .lfx V3 blueprint-driven
 * ═══════════════════════════════════════════════════════════════════════════
 * Recibe "blueprints" (metadata + specs de curva) y emite .lfx V3 que pasan
 * el 100% de los gates: Loader (G2/G5/G6), PrenatalScreening (G1-G8) y
 * GatekeeperLinter (R0-R6). Los archivos que fallan NO se escriben.
 *
 * LOTE 1 — RaveX: fx_kernel_panic, fx_depth_charge, fx_hydraulic_press
 * LOTE 2 — RaveX: fx_neon_flicker, fx_sector_purge, fx_acid_wash
 * LOTE 3 — RaveX: fx_grid_collapse, fx_dead_pixel, fx_core_meltdown
 * LOTE 4 — RaveX: fx_neon_buzz, fx_data_leak, fx_ghost_pulse (atmosféricos)
 * LOTE 5 — RaveX: fx_glitch_protocol, fx_laser_cage, fx_blackout_threat
 *         Latino (próximo): subdir 'latin', vibe 'fiesta-latina',
 *         cinemática permitida (pan/tilt, 'linear', organicity alta).
 * Restricciones globales del lote: CERO cinemática, spatialBehavior 'static',
 * interpolación 'hold' exclusiva (salvo arranque 'linear' del strobe plano),
 * strobe plano [{0,1,linear},{DUR,1,hold}], energyZone span ≤ 2.
 *
 * Uso:  node scripts/generate_factory_arsenal.js [--dry-run]
 * Post: npm run forge:manifest
 * ═══════════════════════════════════════════════════════════════════════════
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DRY_RUN = process.argv.includes('--dry-run')
const BUILTINS_ROOT = path.resolve(__dirname, '..', 'src', 'core', 'arsenal', 'builtins')
const APPDATA = process.env.APPDATA || ''
const USERDATA_ARSENAL = path.join(APPDATA, 'luxsync-electron', 'arsenal')

// ─── CANON (espejo de LfxClipInstance.ts / hephaestus/types.ts) ─────────────
const ENERGY_ZONES = ['silence','valley','ambient','gentle','active','intense','peak']
const VALID_PARAM_IDS = new Set([
  'intensity','color','white','amber','speed','pan','tilt','zoom','focus','iris',
  'gobo1','gobo2','prism','strobe','globalComp','width','direction',
  'scale_x','scale_y','rot_x','rot_y','gobo_rotation',
  'smoke_pump','smoke_density','fan_speed',
])
const VALID_ZONE_TARGETS = new Set([
  'front','back','floor','movers-left','movers-right','strobe','air','ambient',
  'unassigned','all','all-pars','all-movers','pars','movers',
  'all-left','all-right','left','right',
  // Compuestos estéreo canónicos (zone-node-router.ts: front-left, back-right…)
  'front-left','front-right','back-left','back-right','floor-left','floor-right',
])
const STROBE_MAX_HZ = 25

// ARCHETYPE_BIAS_MAP (LfxClipInstance.ts) — clamp de fábrica
const ARCHETYPE_BIAS = {
  divine:  { aggressionMin:0.9,  chaosMin:0.3, chaosMax:0.7,  zones:['intense','peak'] },
  strobe:  { aggressionMin:0.75, chaosMin:0.4, organicityMax:0.35, zones:['active','intense','peak'] },
  heavy:   { aggressionMin:0.7,  chaosMin:0.3, organicityMax:0.45, zones:['active','intense','peak'] },
  ambient: { aggressionMax:0.3,  chaosMax:0.3, organicityMin:0.55, zones:['silence','valley','ambient','gentle'] },
  utility: { zones:['ambient','gentle','active'] },
}
const HARD_ARCHETYPES = new Set(['strobe','heavy','divine'])

const clamp01 = v => Math.max(0, Math.min(1, v))
const round2 = v => Math.round(v * 100) / 100

// Track IDs deterministas: reproducible builds — regenerar sin cambios
// produce archivos idénticos (mismo checksum). Formato UUID-v4-shaped.
let _trackSeed = { clipId: '', n: 0 }
const trackId = (paramId, zones) => {
  const h = crypto.createHash('sha1')
    .update(`${_trackSeed.clipId}|${_trackSeed.n++}|${paramId}|${zones.join(',')}`)
    .digest('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`
}

// ─── CHECKSUM — LAZARUS B-4 (idéntico a computeLfxChecksum) ─────────────────
function computeChecksum(clip) {
  return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(clip)).digest('hex')
}

// ─── CURVE BUILDERS ─────────────────────────────────────────────────────────
const kf = (timeMs, value, interpolation = 'hold', bezierHandles) =>
  bezierHandles ? { timeMs, value, interpolation, bezierHandles }
                : { timeMs, value, interpolation }

/** Strobe plano canónico del lote: arranque 'linear' en 0ms, 'hold' al final. */
const strobeFlat = durationMs => [kf(0, 1, 'linear'), kf(durationMs, 1, 'hold')]

/**
 * Alternancia dura L/R estilo kernel_panic.
 * phase: 1 → arranca ON en t=0 (lado L); 0 → arranca OFF (lado R).
 * Genera el patrón de 50ms hasta `untilMs`, apagado hasta `resumeMs`,
 * flash final `resumeMs→endMs`, corte en `endMs`.
 */
function kernelPanicSide(durationMs, phase, untilMs, resumeMs) {
  const kfs = []
  for (let t = 0; t < untilMs; t += 50) {
    kfs.push(kf(t, (t / 50) % 2 === 0 ? phase : 1 - phase))
  }
  kfs.push(kf(untilMs, 0))
  kfs.push(kf(resumeMs, 1))
  kfs.push(kf(durationMs, 0))
  return kfs
}

/** Alternancia dura cada stepMs durante todo el clip; corta a 0 en endMs. */
function alternating(durationMs, phase, stepMs = 50) {
  const kfs = []
  for (let t = 0; t < durationMs; t += stepMs)
    kfs.push(kf(t, (t / stepMs) % 2 === 0 ? phase : 1 - phase))
  kfs.push(kf(durationMs, 0))
  return kfs
}

/** Ventana cuadrada: ON de onMs a offMs dentro de durationMs, OFF el resto. */
function window(durationMs, onMs, offMs, endValue = 0) {
  const kfs = []
  if (onMs > 0) kfs.push(kf(0, 0))
  kfs.push(kf(onMs, 1))
  if (offMs < durationMs) kfs.push(kf(offMs, 0))
  kfs.push(kf(durationMs, endValue))
  return kfs
}

// ─── TRACK BUILDERS ─────────────────────────────────────────────────────────
function track(paramId, zones, curve, extra = {}) {
  return { id: trackId(paramId, zones), paramId, zones, curve, blendMode: 'replace', ...extra }
}
function numCurve(paramId, keyframes, range = [0, 1], defaultValue = 0, mode = 'absolute') {
  return { paramId, valueType: 'number', range, defaultValue, keyframes, mode }
}
const intensityTrack = (zones, kfs, extra) =>
  track('intensity', zones, numCurve('intensity', kfs), extra)
const strobeTrack = (zones, kfs, extra) =>
  track('strobe', zones, numCurve('strobe', kfs), extra)
const colorTrack = (zones, kfs, extra) =>
  track('color', zones,
    { paramId:'color', valueType:'color', range:[0,360],
      defaultValue:{ h:0, s:0, l:50 }, keyframes:kfs, mode:'absolute' }, extra)
// ── Cinemática (factoría Latino: offsets relativos [-1,1] 'additive') ──────
const panTrack = (zones, kfs, extra) =>
  track('pan', zones, numCurve('pan', kfs, [-1, 1], 0, 'additive'), extra)
const tiltTrack = (zones, kfs, extra) =>
  track('tilt', zones, numCurve('tilt', kfs, [-1, 1], 0, 'additive'), extra)
/** Pan/Tilt absolutos [0,1] para spatialBehavior 'absolute'. */
const panAbsTrack = (zones, kfs, extra) =>
  track('pan', zones, numCurve('pan', kfs, [0, 1], 0.5), extra)
const tiltAbsTrack = (zones, kfs, extra) =>
  track('tilt', zones, numCurve('tilt', kfs, [0, 1], 0.5), extra)

const NO_PHASE = { spreadDeg:0, symmetry:'linear', wings:1, blocks:1, shuffle:0, shuffleSeed:1, direction:1 }

// ─── DNA DERIVATION (mirror toCognitiveDNA / bakeCognitiveDNA) ──────────────
function deriveDNA(bp) {
  const bias = ARCHETYPE_BIAS[bp.archetype] ?? {}
  const g = bp.genome
  const genome = {
    aggression: clamp01(Math.max(g.aggression, bias.aggressionMin ?? 0)),
    chaos:      clamp01(Math.min(Math.max(g.chaos, bias.chaosMin ?? 0), bias.chaosMax ?? 1)),
    organicity: clamp01(Math.min(Math.max(g.organicity, bias.organicityMin ?? 0), bias.organicityMax ?? 1)),
  }
  if (bias.aggressionMax !== undefined) genome.aggression = Math.min(genome.aggression, bias.aggressionMax)

  const isHard = HARD_ARCHETYPES.has(bp.archetype)
  const isAmbient = bp.archetype === 'ambient'
  return {
    archetype: bp.archetype,
    genome,
    textureAffinity: bp.textureAffinity ?? (isAmbient || bp.archetype === 'divine' ? 'clean'
      : bp.archetype === 'strobe' || bp.archetype === 'heavy' ? 'dirty' : 'universal'),
    compatibleVibes: bp.vibes,
    validSections: bp.sections,
    energyZone: bp.energyZone,
    aggressionRange: isAmbient
      ? { min: round2(clamp01(genome.aggression - 0.20)), max: round2(clamp01(genome.aggression + 0.20)) }
      : isHard
        ? { min: round2(clamp01(genome.aggression - 0.15)), max: round2(clamp01(genome.aggression + 0.15)) }
        : { min: 0.0, max: 1.0 },
    pressureRange: isHard || genome.aggression > 0.7
      ? { min: 0.5, max: 1.0 }
      : isAmbient ? { min: 0.0, max: 0.5 } : { min: 0.0, max: 1.0 },
    spatialBehavior: bp.spatialBehavior ?? 'static',
    ...(bp.ikCompatibility ? { ikCompatibility: bp.ikCompatibility } : {}),
    ...(bp.visibility ? { visibility: bp.visibility } : {}),
  }
}

// ─── GATE VALIDATOR (Loader G2/G5/G6 + Prenatal G1-G8 + Linter R0-R6) ───────
function gateValidate(clip) {
  const errors = [], warns = []
  const fail = m => errors.push(m), warn = m => warns.push(m)
  const dna = clip.cognitiveDNA, sim = clip.simulationMeta, saf = clip.safetyDeclaration

  // G1 estructura
  if (!clip.id?.length || !clip.name?.length || !(clip.durationMs > 0)) fail('G1: id/name/durationMs')
  if (!Array.isArray(clip.vibeCompat) || clip.vibeCompat.length === 0) fail('G1: vibeCompat vacío')
  if (!['physical','color','movement','optics','composite','beam','atmosphere'].includes(clip.category))
    fail(`G1: category '${clip.category}' inválida`)

  // G3 genoma
  for (const k of ['aggression','chaos','organicity']) {
    const v = dna?.genome?.[k]
    if (typeof v !== 'number' || v < 0 || v > 1) fail(`G3: genome.${k}=${v} fuera de [0,1]`)
  }

  // G4 compat — span energético ≤ 2
  const lo = ENERGY_ZONES.indexOf(dna?.energyZone?.min)
  const hi = ENERGY_ZONES.indexOf(dna?.energyZone?.max)
  const span = lo >= 0 && hi >= 0 ? hi - lo + 1 : 0
  if (span === 0) fail('G4: energyZone huérfano')
  if (span > 2)  fail(`G4: energyZone span ${span} > 2 (${dna.energyZone.min}→${dna.energyZone.max})`)
  if (!dna?.compatibleVibes?.length) fail('G4: compatibleVibes vacío')
  if (!dna?.validSections?.length)   fail('G4: validSections vacío')

  // G5 tracks
  if (!Array.isArray(clip.tracks) || clip.tracks.length === 0) fail('G5: tracks vacío')
  else {
    if (!clip.tracks.some(t => t.curve?.keyframes?.length >= 2))
      fail('G5: ningún track con ≥2 keyframes')
    for (const t of clip.tracks) {
      if (!t.zones?.length) fail(`G5: track '${t.id}' sin zones`)
      if (!t.curve?.keyframes?.length) fail(`G5: track '${t.id}' sin keyframes`)
      for (const z of t.zones ?? [])
        if (!VALID_ZONE_TARGETS.has(z)) fail(`G5: track '${t.id}' zone '${z}' no canónica`)
    }
  }

  // G6 strobe consistency + techo 25Hz
  const hasStrobe = clip.tracks?.some(t => t.paramId === 'strobe')
  const hasIntensity = clip.tracks?.some(t => t.paramId === 'intensity')
  const hz = saf?.maxStrobeFreqHz ?? 0
  if (hz > STROBE_MAX_HZ) fail(`G6: maxStrobeFreqHz ${hz} > ${STROBE_MAX_HZ}`)
  if (hz > 0 && !hasStrobe && !hasIntensity) fail('G6: Hz declarado sin track strobe/intensity')
  if (hz === 0 && hasStrobe) fail('G6: track strobe con 0Hz declarados')
  if (sim?.isStrobe) {
    const st = clip.tracks.find(t => t.paramId === 'strobe')
    const ok = st
      ? st.curve.keyframes.every(k => typeof k.value === 'number' && k.value >= 0 && k.value <= 1)
      : (clip.tracks.find(t => t.paramId === 'intensity')?.curve.keyframes.length ?? 0) >= 4
    if (!ok) fail('G6: isStrobe sin strobe track válido ni intensity ≥4 kfs')
  }

  // G8 paramIds canónicos
  for (const t of clip.tracks ?? []) {
    if (!VALID_PARAM_IDS.has(t.paramId)) fail(`G8: paramId '${t.paramId}' inválido`)
    if (t.curve?.paramId && !VALID_PARAM_IDS.has(t.curve.paramId))
      fail(`G8: curve.paramId '${t.curve.paramId}' inválido`)
  }

  // Linter: bias + coherencia zona/arquetipo
  const bias = ARCHETYPE_BIAS[dna?.archetype]
  if (bias && dna) {
    const { aggression: A, chaos: C, organicity: O } = dna.genome
    if (bias.aggressionMin !== undefined && A < bias.aggressionMin) fail(`R0: A=${A} < ${bias.aggressionMin}`)
    if (bias.aggressionMax !== undefined && A > bias.aggressionMax) fail(`R0: A=${A} > ${bias.aggressionMax}`)
    if (bias.chaosMin !== undefined && C < bias.chaosMin) fail(`R0: C=${C} < ${bias.chaosMin}`)
    if (bias.chaosMax !== undefined && C > bias.chaosMax) fail(`R0: C=${C} > ${bias.chaosMax}`)
    if (bias.organicityMin !== undefined && O < bias.organicityMin) fail(`R0: O=${O} < ${bias.organicityMin}`)
    if (bias.organicityMax !== undefined && O > bias.organicityMax) fail(`R0: O=${O} > ${bias.organicityMax}`)
  }
  if (dna?.archetype === 'ambient' && dna.genome.aggression > 0.35) fail('R1: ambient A>0.35')
  if (dna?.archetype === 'strobe' && hz === 0) fail('R3: strobe sin Hz declarado')
  if (dna?.archetype === 'strobe' && hz > 0 && hz < 3) warn('R3b: strobe <3Hz no perceptual')
  const zn = [dna?.energyZone?.min, dna?.energyZone?.max]
  const HARD = new Set(['active','intense','peak']), LOW = new Set(['silence','valley','ambient','gentle'])
  if (dna?.archetype === 'heavy' && !zn.some(z => HARD.has(z))) fail('R4: heavy sin zona dura')
  if (dna?.archetype === 'divine' && zn.some(z => z !== 'peak' && z !== 'intense'))
    fail('R4: divine fuera de peak/intense')
  if (dna?.archetype === 'ambient' && !zn.some(z => LOW.has(z))) warn('R4: ambient sin zona baja')

  // G7-spatial warn
  const hasMove = clip.tracks?.some(t => t.paramId === 'pan' || t.paramId === 'tilt')
  if (dna?.spatialBehavior === 'static' && hasMove) warn('G7: static con pan/tilt')
  if ((dna?.spatialBehavior === 'absolute' || dna?.spatialBehavior === 'relative_offset') && !hasMove)
    warn(`G7: ${dna.spatialBehavior} sin pan/tilt`)

  return { errors, warns }
}

// ─── EMISIÓN ────────────────────────────────────────────────────────────────
function emit(bp) {
  _trackSeed = { clipId: bp.id, n: 0 }
  const clip = {
    id: bp.id, name: bp.name, author: 'LuxSync Factory', category: bp.category,
    tags: bp.tags, vibeCompat: bp.vibes, spatialZones: bp.spatialZones,
    mixBus: bp.mixBus ?? 'htp', priority: bp.priority ?? 70,
    durationMs: bp.durationMs, effectType: 'heph_custom',
    tracks: bp.buildTracks(),
    staticParams: {
      dominantColorH: bp.dominantColor?.h ?? 0,
      dominantColorS: bp.dominantColor?.s ?? 0,
      dominantColorL: bp.dominantColor?.l ?? 50,
      isOneShot: !!bp.isOneShot, legacyMixBus: bp.mixBus ?? 'htp',
      bpmRef: bp.bpmRef ?? 140, attackMs: bp.attackMs ?? 0,
      strobeHz: bp.strobeHz ?? 0,
    },
    cognitiveDNA: deriveDNA(bp),
    simulationMeta: bp.simMeta,
    safetyDeclaration: {
      maxStrobeFreqHz: bp.strobeHz ?? 0,
      containsRapidFlash: (bp.strobeHz ?? 0) > 3,
      communityTrusted: false,
    },
    ...(bp.executionHints ? { executionHints: bp.executionHints } : {}),
    schemaVersion: '3.0',
  }

  const { errors, warns } = gateValidate(clip)
  for (const w of warns) console.warn(`  ⚠️  [${bp.id}] ${w}`)
  if (errors.length) {
    for (const e of errors) console.error(`  ❌ [${bp.id}] ${e}`)
    console.error(`  ⛔ ${bp.id} RECHAZADO — no se escribe archivo`)
    return false
  }

  const lfx = { $schema: 'luxsync.lfx/3.0', clip, checksum: computeChecksum(clip) }
  const json = JSON.stringify(lfx, null, 2) + '\n'
  const outDir = path.join(BUILTINS_ROOT, bp.subdir)
  const outFile = path.join(outDir, `${bp.id}.lfx`)

  if (DRY_RUN) { console.log(`  ✅ [dry-run] ${bp.id} OK (${lfx.checksum.slice(0, 24)}…)`); return true }

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outFile, json, 'utf-8')

  // Read-back verify: re-parsear y recomputar — garantía LAZARUS B-4
  const back = JSON.parse(fs.readFileSync(outFile, 'utf-8'))
  if (computeChecksum(back.clip) !== lfx.checksum)
    throw new Error(`Checksum drift post-escritura en ${outFile}`)
  console.log(`  ✅ [factory] ${outFile}`)

  // Mirror al arsenal de runtime (userdata) — convención generate-ravex-fx.js
  if (APPDATA) {
    const userDir = path.join(USERDATA_ARSENAL, bp.subdir)
    fs.mkdirSync(userDir, { recursive: true })
    fs.writeFileSync(path.join(userDir, `${bp.id}.lfx`), json, 'utf-8')
    console.log(`  ✅ [userdata] ${path.join(userDir, `${bp.id}.lfx`)}`)
  }
  return true
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧬 BLUEPRINTS — LOTE 1 RAVEX
// ═══════════════════════════════════════════════════════════════════════════
const BLUEPRINTS = [

  // ── EFECTO 1: KERNEL PANIC — glitch asimétrico L/R → blackout → flashazo ──
  {
    id: 'fx_kernel_panic', name: 'Kernel Panic', subdir: 'ravex',
    category: 'physical',
    tags: ['strobe','glitch','panic','ravex','cyberpunk','asymmetric','left-right'],
    vibes: ['rave'], sections: ['drop','climax'],
    energyZone: { min: 'peak', max: 'peak' },
    genome: { aggression: 0.9, chaos: 1.0, organicity: 0.1 },
    archetype: 'strobe', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 95,
    durationMs: 1000, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 180, s: 100, l: 50 },
    buildTracks: () => [
      // Front-L + Movers-L: alternancia 50ms (ON en pares de 100) 0→400, apagado, flashazo 800→1000
      intensityTrack(['front','movers-left','all-left'], kernelPanicSide(1000, 1, 400, 800), { phaseConfig: NO_PHASE }),
      // Front-R + Movers-R: inverso (ON en impares de 100)
      intensityTrack(['front','movers-right','all-right'], kernelPanicSide(1000, 0, 400, 800), { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], strobeFlat(1000)),
      colorTrack(['all'], [kf(0, { h:180, s:100, l:50 }), kf(1000, { h:180, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.9, energyMultiplier: 1.5, vibeBonus: 0.15 },
      gpuCost: 0.25, fatigueImpact: 0.9, minDurationMs: 500, cooldownMs: 15000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.8 },
    },
  },

  // ── EFECTO 2: DEPTH CHARGE — cascada eje Z: back → movers → front ─────────
  {
    id: 'fx_depth_charge', name: 'Depth Charge', subdir: 'ravex',
    category: 'physical',
    tags: ['impact','depth','cascade','ravex','z-axis','sequential','one-shot'],
    vibes: ['rave'], sections: ['drop','climax'],
    energyZone: { min: 'intense', max: 'peak' },
    genome: { aggression: 0.85, chaos: 0.4, organicity: 0.2 },
    archetype: 'heavy', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 90,
    durationMs: 1200, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 0, s: 0, l: 100 },
    buildTracks: () => [
      // Back + Air: ON 0→300
      intensityTrack(['back','air'], window(1200, 0, 300), { phaseConfig: NO_PHASE }),
      // Movers L+R: ON 300→600
      intensityTrack(['movers-left','movers-right'], window(1200, 300, 600), { phaseConfig: NO_PHASE }),
      // Front + Floor: ON 600→1200 (termina encendido — el impacto llega al público)
      intensityTrack(['front','floor'], window(1200, 600, 1200, 1), { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], strobeFlat(1200)),
      // Sin track de color: hereda dominante del rig (blanco puro declarado en staticParams)
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 1.4, vibeBonus: 0.15 },
      gpuCost: 0.2, fatigueImpact: 0.7, minDurationMs: 500, cooldownMs: 12000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.7 },
    },
  },

  // ── EFECTO 3: HYDRAULIC PRESS — aplastamiento opresivo + 2 parpadeos ──────
  {
    id: 'fx_hydraulic_press', name: 'Hydraulic Press', subdir: 'ravex',
    category: 'physical',
    tags: ['press','heavy','industrial','ravex','warning','solid','one-shot'],
    vibes: ['rave'], sections: ['drop','climax'],
    energyZone: { min: 'intense', max: 'intense' },
    // Spec: chaos 0.2 "muy ordenado" — el bias heavy exige ≥0.3, queda clampado
    // a 0.3 en deriveDNA (idéntico al bakeCognitiveDNA de runtime).
    genome: { aggression: 0.95, chaos: 0.3, organicity: 0.15 },
    archetype: 'heavy', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 88,
    durationMs: 4000, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 120, s: 100, l: 50 },
    buildTracks: () => [
      // Sólido 0→2000 · negro 2000→3500 · parpadeo 3500→3600 · negro · parpadeo 3700→3800 · off
      intensityTrack(['all'], [
        kf(0, 1), kf(2000, 0),
        kf(3500, 1), kf(3600, 0),
        kf(3700, 1), kf(3800, 0),
        kf(4000, 0),
      ], { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], strobeFlat(4000)),
      // Verde tóxico durante el bloque, rojo en los parpadeos finales
      colorTrack(['all'], [
        kf(0, { h:120, s:100, l:50 }),
        kf(3500, { h:0, s:100, l:50 }),
        kf(4000, { h:0, s:100, l:50 }),
      ]),
    ],
    simMeta: {
      beautyWeights: { base: 0.8, energyMultiplier: 1.35, vibeBonus: 0.1 },
      gpuCost: 0.15, fatigueImpact: 0.6, minDurationMs: 1000, cooldownMs: 12000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.7 },
    },
  },

  // ── EFECTO 4: NEON FLICKER — tubo fluorescente agónico que se estabiliza ──
  {
    id: 'fx_neon_flicker', name: 'Neon Flicker', subdir: 'ravex',
    category: 'physical',
    tags: ['flicker','neon','fluorescent','ravex','cyberpunk','alley','ignition'],
    vibes: ['rave'], sections: ['breakdown','drop'],
    energyZone: { min: 'active', max: 'intense' },
    genome: { aggression: 0.75, chaos: 0.9, organicity: 0.15 },
    archetype: 'strobe', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 91,
    durationMs: 1500, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 0, s: 0, l: 100 },
    buildTracks: () => [
      // Cortes asimétricos rápidos 0→400, luego ON sostenido desde 450 hasta el final
      intensityTrack(['all'], [
        kf(0, 1), kf(50, 0), kf(100, 1), kf(120, 0), kf(200, 1),
        kf(300, 0), kf(350, 1), kf(400, 0), kf(450, 1), kf(1500, 1),
      ], { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], strobeFlat(1500)),
      colorTrack(['all'], [kf(0, { h:0, s:0, l:100 }), kf(1500, { h:0, s:0, l:100 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 1.35, vibeBonus: 0.15 },
      gpuCost: 0.2, fatigueImpact: 0.8, minDurationMs: 500, cooldownMs: 12000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.6 },
    },
  },

  // ── EFECTO 5: SECTOR PURGE — reinicio eléctrico sectorial front→back ──────
  {
    id: 'fx_sector_purge', name: 'Sector Purge', subdir: 'ravex',
    category: 'physical',
    tags: ['purge','sector','blackout','restart','ravex','industrial','cascade'],
    vibes: ['rave'], sections: ['breakdown','buildup'],
    energyZone: { min: 'intense', max: 'peak' },
    genome: { aggression: 0.8, chaos: 0.3, organicity: 0.15 },
    archetype: 'heavy', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 86,
    durationMs: 3000, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 300, s: 100, l: 50 },
    buildTracks: () => [
      // Cascada inversa: el club se reinicia de adelante hacia atrás, abajo→arriba
      intensityTrack(['front','floor'], window(3000, 1000, 3000, 1), { phaseConfig: NO_PHASE }),
      intensityTrack(['movers-left','movers-right'], window(3000, 2000, 3000, 1), { phaseConfig: NO_PHASE }),
      intensityTrack(['back','air'], window(3000, 2500, 3000, 1), { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], strobeFlat(3000)),
      colorTrack(['all'], [kf(0, { h:300, s:100, l:50 }), kf(3000, { h:300, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 1.4, vibeBonus: 0.1 },
      gpuCost: 0.2, fatigueImpact: 0.65, minDurationMs: 1000, cooldownMs: 15000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.7 },
    },
  },

  // ── EFECTO 6: ACID WASH — muro verde sostenido + estrobo-baliza 0.2 ────────
  {
    id: 'fx_acid_wash', name: 'Acid Wash', subdir: 'ravex',
    category: 'physical',
    tags: ['acid','wash','wall','green','ravex','beacon','sustained','divine'],
    vibes: ['rave'], sections: ['drop','climax'],
    energyZone: { min: 'peak', max: 'peak' },
    genome: { aggression: 0.95, chaos: 0.5, organicity: 0.5 },
    archetype: 'divine', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 93,
    // Strobe override del spec: baliza 0.2 (~5Hz) en vez del plano a 1
    durationMs: 5000, strobeHz: 5, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 100, s: 100, l: 50 },
    buildTracks: () => [
      // Muro sólido 0→4800, apagado al final — cero parpadeos de intensidad
      intensityTrack(['all'], [kf(0, 1), kf(4800, 0), kf(5000, 0)], { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], [kf(0, 0.2, 'linear'), kf(4800, 0), kf(5000, 0)]),
      colorTrack(['all'], [kf(0, { h:100, s:100, l:50 }), kf(5000, { h:100, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.95, energyMultiplier: 1.5, vibeBonus: 0.15 },
      gpuCost: 0.15, fatigueImpact: 0.5, minDurationMs: 2000, cooldownMs: 8000,
      isStrobe: true, isDivineCandidate: true, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.85 },
    },
  },

  // ── EFECTO 7: GRID COLLAPSE — fallo en cascada front→movers→back ──────────
  {
    id: 'fx_grid_collapse', name: 'Grid Collapse', subdir: 'ravex',
    category: 'physical',
    tags: ['grid','collapse','cascade','ravex','cyberpunk','sequential','16th'],
    vibes: ['rave'], sections: ['drop','climax'],
    energyZone: { min: 'intense', max: 'peak' },
    genome: { aggression: 0.85, chaos: 0.9, organicity: 0.1 },
    archetype: 'strobe', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 94,
    durationMs: 1200, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 180, s: 100, l: 50 },
    buildTracks: () => [
      // Front + Floor: parpadeos 16avas 0→200, OFF el resto
      intensityTrack(['front','floor'], [
        kf(0, 1), kf(50, 0), kf(100, 1), kf(150, 0), kf(1200, 0),
      ], { phaseConfig: NO_PHASE }),
      // Movers L+R: mismos parpadeos desplazados 200→400
      intensityTrack(['movers-left','movers-right'], [
        kf(0, 0), kf(200, 1), kf(250, 0), kf(300, 1), kf(350, 0), kf(1200, 0),
      ], { phaseConfig: NO_PHASE }),
      // Back + Air: últimos parpadeos 400→600, muere
      intensityTrack(['back','air'], [
        kf(0, 0), kf(400, 1), kf(450, 0), kf(500, 1), kf(550, 0), kf(1200, 0),
      ], { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], strobeFlat(1200)),
      // Cian 0→300 → Magenta 300→fin (corte directo, hold)
      colorTrack(['all'], [
        kf(0, { h:180, s:100, l:50 }),
        kf(300, { h:300, s:100, l:50 }),
        kf(1200, { h:300, s:100, l:50 }),
      ]),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 1.4, vibeBonus: 0.15 },
      gpuCost: 0.25, fatigueImpact: 0.85, minDurationMs: 500, cooldownMs: 15000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.7 },
    },
  },

  // ── EFECTO 8: DEAD PIXEL — fogonazos aislados desincronizados ─────────────
  {
    id: 'fx_dead_pixel', name: 'Dead Pixel', subdir: 'ravex',
    category: 'physical',
    tags: ['pixel','dead','sparse','flicker','ravex','industrial','dirty','minimal'],
    vibes: ['rave'], sections: ['breakdown','textural'],
    energyZone: { min: 'valley', max: 'ambient' },
    // Spec: chaos 0.8 / organicity 0.1 violan bias ambient (C≤0.3, O≥0.55) —
    // deriveDNA los clampea a {0.3, 0.55}, idéntico al bakeCognitiveDNA de runtime.
    // textureAffinity override a 'dirty': el derivado ambient→'clean' contradice
    // el "sucio industrial" explícito del diseño.
    textureAffinity: 'dirty',
    genome: { aggression: 0.2, chaos: 0.3, organicity: 0.55 },
    archetype: 'ambient', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 65,
    durationMs: 2000, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 60, s: 50, l: 80 },
    buildTracks: () => [
      // Fogonazos solitarios: air 300→350, movers-R 1100→1150, floor 1700→1800
      intensityTrack(['air'], window(2000, 300, 350), { phaseConfig: NO_PHASE }),
      intensityTrack(['movers-right'], window(2000, 1100, 1150), { phaseConfig: NO_PHASE }),
      intensityTrack(['floor'], window(2000, 1700, 1800), { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], strobeFlat(2000)),
      colorTrack(['all'], [kf(0, { h:60, s:50, l:80 }), kf(2000, { h:60, s:50, l:80 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.6, energyMultiplier: 1.1, vibeBonus: 0.05 },
      gpuCost: 0.1, fatigueImpact: 0.3, minDurationMs: 1000, cooldownMs: 10000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.15 },
    },
  },

  // ── EFECTO 9: CORE MELTDOWN — saturación termonuclear total ───────────────
  {
    id: 'fx_core_meltdown', name: 'Core Meltdown', subdir: 'ravex',
    category: 'physical',
    tags: ['meltdown','core','thermonuclear','ravex','blinder','climax','divine'],
    vibes: ['rave'], sections: ['drop','climax'],
    energyZone: { min: 'peak', max: 'peak' },
    // Spec: chaos 0.0 viola chaosMin 0.3 del bias divine → clamp a 0.3.
    genome: { aggression: 1.0, chaos: 0.3, organicity: 0.0 },
    archetype: 'divine', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 97,
    durationMs: 4000, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 30, s: 100, l: 50 },
    buildTracks: () => [
      // Blinder total 0→3800, corte a negro — cero parpadeos de intensidad
      intensityTrack(['all'], [kf(0, 1), kf(3800, 0), kf(4000, 0)], { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], strobeFlat(4000)),
      colorTrack(['all'], [kf(0, { h:30, s:100, l:50 }), kf(4000, { h:30, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.98, energyMultiplier: 1.6, vibeBonus: 0.2 },
      gpuCost: 0.3, fatigueImpact: 0.95, minDurationMs: 1000, cooldownMs: 20000,
      isStrobe: true, isDivineCandidate: true, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.9 },
    },
  },

  // ── EFECTO 10: NEON BUZZ — zumbido débil de neón defectuoso ───────────────
  {
    id: 'fx_neon_buzz', name: 'Neon Buzz', subdir: 'ravex',
    category: 'physical',
    tags: ['buzz','neon','ambient','ravex','defective','garage','hum'],
    vibes: ['rave'], sections: ['breakdown','textural'],
    energyZone: { min: 'valley', max: 'ambient' },
    // Spec: chaos 0.5 viola chaosMax 0.3 del bias ambient → clamp a 0.3.
    // textureAffinity 'dirty': "tubo defectuoso en garaje" = industrial grime.
    textureAffinity: 'dirty',
    genome: { aggression: 0.25, chaos: 0.3, organicity: 0.8 },
    archetype: 'ambient', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 55,
    durationMs: 2000, strobeHz: 0, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 180, s: 50, l: 20 },
    buildTracks: () => [
      // Zumbido al 50% con dos microcortes de 50ms (800-850, 1600-1650)
      intensityTrack(['back'], [
        kf(0, 0.5), kf(800, 0), kf(850, 0.5),
        kf(1600, 0), kf(1650, 0.5), kf(2000, 0.5),
      ], { phaseConfig: NO_PHASE }),
      // Floor: hum constante al 20%
      intensityTrack(['floor'], [kf(0, 0.2), kf(2000, 0.2)], { phaseConfig: NO_PHASE }),
      // Sin track de strobe — zumbido sin flash
      colorTrack(['back','floor'], [kf(0, { h:180, s:50, l:20 }), kf(2000, { h:180, s:50, l:20 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.55, energyMultiplier: 1.05, vibeBonus: 0.05 },
      gpuCost: 0.08, fatigueImpact: 0.15, minDurationMs: 1000, cooldownMs: 5000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.05 },
    },
  },

  // ── EFECTO 11: DATA LEAK — chispas mínimas front→back, alta tensión ────────
  {
    id: 'fx_data_leak', name: 'Data Leak', subdir: 'ravex',
    category: 'physical',
    tags: ['data','leak','spark','minimal','ravex','cybernetic','tension','cold'],
    vibes: ['rave'], sections: ['breakdown','textural'],
    energyZone: { min: 'silence', max: 'valley' },
    // Spec: chaos 0.8 / organicity 0.2 violan bias ambient (C≤0.3, O≥0.55) →
    // clamps {0.3, 0.55} en deriveDNA (mismo resultado que bakeCognitiveDNA).
    genome: { aggression: 0.15, chaos: 0.3, organicity: 0.55 },
    archetype: 'ambient', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 50,
    durationMs: 1500, strobeHz: 0, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 120, s: 100, l: 30 },
    buildTracks: () => [
      // Pulsos ultracortos al 30% viajando front→air→back
      intensityTrack(['front'], [kf(0, 0), kf(100, 0.3), kf(150, 0), kf(1500, 0)], { phaseConfig: NO_PHASE }),
      intensityTrack(['air'],   [kf(0, 0), kf(700, 0.3), kf(750, 0), kf(1500, 0)], { phaseConfig: NO_PHASE }),
      intensityTrack(['back'],  [kf(0, 0), kf(1300, 0.3), kf(1350, 0), kf(1500, 0)], { phaseConfig: NO_PHASE }),
      colorTrack(['front','air','back'], [kf(0, { h:120, s:100, l:30 }), kf(1500, { h:120, s:100, l:30 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.5, energyMultiplier: 1.05, vibeBonus: 0.05 },
      gpuCost: 0.08, fatigueImpact: 0.1, minDurationMs: 500, cooldownMs: 5000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.05 },
    },
  },

  // ── EFECTO 12: GHOST PULSE — sala entera a media luz 1s, corte seco ────────
  {
    id: 'fx_ghost_pulse', name: 'Ghost Pulse', subdir: 'ravex',
    category: 'physical',
    tags: ['ghost','pulse','ambient','tension','ravex','cold','breath','static'],
    vibes: ['rave'], sections: ['breakdown','intro'],
    energyZone: { min: 'silence', max: 'valley' },
    // Spec: organicity 0.5 viola organicityMin 0.55 del bias ambient → clamp 0.55.
    genome: { aggression: 0.1, chaos: 0.1, organicity: 0.55 },
    archetype: 'ambient', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 45,
    durationMs: 2500, strobeHz: 0, isOneShot: true, bpmRef: 140,
    // HOTFIX L4: spec L:20 rendía ≈rgb(46,53,56) → "negro indefinido" en
    // runtime (S:10 casi sin saturación + L mínimo). L:50 = blanco frío
    // visible que conserva el carácter tenue del diseño.
    dominantColor: { h: 200, s: 10, l: 50 },
    buildTracks: () => [
      // Muro tenue al 40% entre 500→1500, corte seco — sin parpadeos
      intensityTrack(['all'], [kf(0, 0), kf(500, 0.4), kf(1500, 0), kf(2500, 0)], { phaseConfig: NO_PHASE }),
      colorTrack(['all'], [kf(0, { h:200, s:10, l:50 }), kf(2500, { h:200, s:10, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.65, energyMultiplier: 1.1, vibeBonus: 0.05 },
      gpuCost: 0.08, fatigueImpact: 0.2, minDurationMs: 1000, cooldownMs: 8000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.05 },
    },
  },

  // ═══════════════ LOTE 5 — RAVEX ═══════════════

  // ── EFECTO 13: GLITCH PROTOCOL — estrobo asimétrico front/back ────────────
  {
    id: 'fx_glitch_protocol', name: 'Glitch Protocol', subdir: 'ravex',
    category: 'physical',
    tags: ['glitch','protocol','strobe','asymmetric','ravex','cyberpunk','front-back'],
    vibes: ['rave'], sections: ['drop','climax'],
    energyZone: { min: 'peak', max: 'peak' },
    genome: { aggression: 0.95, chaos: 1.0, organicity: 0.0 },
    archetype: 'strobe', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 96,
    durationMs: 1000, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 0, s: 0, l: 100 },
    buildTracks: () => [
      // Front: 50ms ON / 50ms OFF durante todo el clip
      intensityTrack(['front'], alternating(1000, 1), { phaseConfig: NO_PHASE }),
      // Back: inverso (ON cuando Front está OFF)
      intensityTrack(['back'], alternating(1000, 0), { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], strobeFlat(1000)),
      colorTrack(['all'], [kf(0, { h:0, s:0, l:100 }), kf(1000, { h:0, s:0, l:100 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.9, energyMultiplier: 1.5, vibeBonus: 0.15 },
      gpuCost: 0.25, fatigueImpact: 0.9, minDurationMs: 500, cooldownMs: 15000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.85 },
    },
  },

  // ── EFECTO 14: LASER CAGE — prisión estática floor+air ────────────────────
  {
    id: 'fx_laser_cage', name: 'Laser Cage', subdir: 'ravex',
    category: 'physical',
    tags: ['laser','cage','prison','static','ravex','red','floor-air'],
    vibes: ['rave'], sections: ['drop','climax'],
    energyZone: { min: 'intense', max: 'intense' },
    // Spec: chaos 0.2 viola chaosMin 0.3 del bias heavy → clamp a 0.3.
    genome: { aggression: 0.85, chaos: 0.3, organicity: 0.1 },
    archetype: 'heavy', spatialBehavior: 'static',
    spatialZones: ['floor','air'], mixBus: 'global', priority: 89,
    durationMs: 2000, strobeHz: 0, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 0, s: 100, l: 50 },
    buildTracks: () => [
      // Suelo + aire encendidos fijos — el resto apagado (sin track = off)
      intensityTrack(['floor','air'], [kf(0, 1), kf(2000, 1)], { phaseConfig: NO_PHASE }),
      // Sin strobe — "estática", un strobe plano rompería la prisión de luz
      colorTrack(['floor','air'], [kf(0, { h:0, s:100, l:50 }), kf(2000, { h:0, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 1.4, vibeBonus: 0.1 },
      gpuCost: 0.15, fatigueImpact: 0.6, minDurationMs: 1000, cooldownMs: 10000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.7 },
    },
  },

  // ── EFECTO 15: BLACKOUT THREAT — oscuridad + micropulso cada 2s ───────────
  {
    id: 'fx_blackout_threat', name: 'Blackout Threat', subdir: 'ravex',
    category: 'physical',
    tags: ['blackout','threat','dark','micropulse','ravex','toxic','tension'],
    vibes: ['rave'], sections: ['breakdown','textural'],
    energyZone: { min: 'silence', max: 'valley' },
    // Spec: chaos 0.9 / organicity 0.1 violan bias ambient (C≤0.3, O≥0.55) →
    // clamps {0.3, 0.55}. textureAffinity 'dirty': amarillo tóxico industrial.
    textureAffinity: 'dirty',
    genome: { aggression: 0.3, chaos: 0.3, organicity: 0.55 },
    archetype: 'ambient', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 48,
    durationMs: 2000, strobeHz: 0, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 60, s: 100, l: 50 },
    buildTracks: () => [
      // Fogonazo eléctrico 0→20ms, oscuridad total el resto
      intensityTrack(['all'], [kf(0, 1), kf(20, 0), kf(2000, 0)], { phaseConfig: NO_PHASE }),
      colorTrack(['all'], [kf(0, { h:60, s:100, l:50 }), kf(2000, { h:60, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.6, energyMultiplier: 1.1, vibeBonus: 0.05 },
      gpuCost: 0.1, fatigueImpact: 0.3, minDurationMs: 500, cooldownMs: 8000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.1 },
    },
  },

  // ═══════════════ LOTE 5B — LATINO (vibe 'fiesta-latina', subdir 'latin') ═══
  // Cinemática permitida, transiciones 'linear', colores cálidos.

  // ── EFECTO 16: FUEGO LENTO — respiración orgánica tipo brasa ───────────────
  {
    id: 'fx_fuego_lento', name: 'Fuego Lento', subdir: 'latin',
    category: 'physical',
    tags: ['fuego','lento','braza','breathing','latino','warm','amber','organic'],
    vibes: ['fiesta-latina'], sections: ['breakdown','valley','outro'],
    // Spec: 'valley→gentle' = span 3 en escala canónica (incluye 'ambient')
    // → G4 exige ≤2. Ajustado a 'ambient→gentle' (extremo cálido del rango).
    energyZone: { min: 'ambient', max: 'gentle' },
    // Spec completo dentro del bias ambient (A≤0.3, C≤0.3, O≥0.55) — sin clamps.
    genome: { aggression: 0.1, chaos: 0.1, organicity: 0.9 },
    archetype: 'ambient', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 42,
    durationMs: 4000, strobeHz: 0, isOneShot: true, bpmRef: 90,
    dominantColor: { h: 35, s: 100, l: 50 },
    buildTracks: () => [
      // Respiración: sube a 1.0 en 2000ms, baja a 0 en 4000ms — LINEAR
      intensityTrack(['all'],
        [kf(0, 0, 'linear'), kf(2000, 1, 'linear'), kf(4000, 0, 'linear')],
        { phaseConfig: NO_PHASE }),
      colorTrack(['all'], [kf(0, { h:35, s:100, l:50 }), kf(4000, { h:35, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.7, energyMultiplier: 1.0, vibeBonus: 0.15 },
      gpuCost: 0.1, fatigueImpact: 0.15, minDurationMs: 2000, cooldownMs: 6000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.05 },
    },
  },

  // ── EFECTO 17: BRISA CARIBE — barrido color + pan en movers ────────────────
  {
    id: 'fx_brisa_caribe', name: 'Brisa del Caribe', subdir: 'latin',
    category: 'composite',
    tags: ['brisa','caribe','sweep','color-pan','latino','fresh','cyan-magenta'],
    vibes: ['fiesta-latina'], sections: ['verse','build'],
    energyZone: { min: 'gentle', max: 'active' },
    // Utility: sin clamps de bias — spec pasa limpio.
    genome: { aggression: 0.4, chaos: 0.2, organicity: 0.8 },
    archetype: 'utility', spatialBehavior: 'relative_offset',
    spatialZones: ['all-movers'], mixBus: 'global', priority: 55,
    durationMs: 4000, strobeHz: 0, isOneShot: true, bpmRef: 96,
    dominantColor: { h: 180, s: 100, l: 50 },
    buildTracks: () => [
      // Spec no declara intensidad → 0.6 constante en 'all' (sin ella el
      // barrido de color/pan sería invisible — fix de transcripción).
      intensityTrack(['all'], [kf(0, 0.6), kf(4000, 0.6)], { phaseConfig: NO_PHASE }),
      // Color 'all': cian → magenta LINEAR sobre 4000ms
      colorTrack(['all'],
        [kf(0, { h:180, s:100, l:50 }, 'linear'), kf(4000, { h:300, s:100, l:50 }, 'linear')]),
      // Pan 'all-movers' (canonical para "movers-all" del spec): -0.5 → 0.5
      panTrack(['all-movers'], [kf(0, -0.5, 'linear'), kf(4000, 0.5, 'linear')],
        { phaseConfig: NO_PHASE }),
    ],
    simMeta: {
      beautyWeights: { base: 0.75, energyMultiplier: 1.1, vibeBonus: 0.15 },
      gpuCost: 0.2, fatigueImpact: 0.3, minDurationMs: 2000, cooldownMs: 8000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.2 },
    },
  },

  // ── EFECTO 18: PERREO PEAK — golpe reguetón con decaimiento orgánico ───────
  {
    id: 'fx_perreo_peak', name: 'Perreo Peak', subdir: 'latin',
    category: 'physical',
    tags: ['perreo','peak','reggaeton','hit','latino','hot-pink','punch'],
    vibes: ['fiesta-latina'], sections: ['drop','chorus'],
    energyZone: { min: 'active', max: 'intense' },
    // Spec: organicity 0.7 viola organicityMax 0.45 del bias heavy → clamp a 0.45.
    genome: { aggression: 0.8, chaos: 0.4, organicity: 0.7 },
    archetype: 'heavy', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 88,
    durationMs: 1500, strobeHz: 0, isOneShot: true, bpmRef: 96,
    dominantColor: { h: 330, s: 100, l: 50 },
    buildTracks: () => [
      // Golpe a 1.0 que decae suavemente a 0.2 — LINEAR (orgánico, no strobe)
      intensityTrack(['all'], [kf(0, 1, 'linear'), kf(1500, 0.2, 'linear')],
        { phaseConfig: NO_PHASE }),
      colorTrack(['all'], [kf(0, { h:330, s:100, l:50 }), kf(1500, { h:330, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 1.4, vibeBonus: 0.15 },
      gpuCost: 0.15, fatigueImpact: 0.5, minDurationMs: 750, cooldownMs: 8000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.5 },
    },
  },

  // ═══════════ LOTE 6 — LATINO 2 (vibe 'fiesta-latina', subdir 'latin') ═══
  // Club + restaurante Sunset. Cinemática permitida, 'linear' preferido.

  // ── EFECTO 19: CALOR URBANO — pulso dembow, respiración orgánica ───────────
  {
    id: 'fx_calor_urbano', name: 'Calor Urbano', subdir: 'latin',
    category: 'physical',
    tags: ['calor','urbano','dembow','pulso','latino','warm','orange','breathing'],
    vibes: ['fiesta-latina'], sections: ['verse','chorus','build'],
    energyZone: { min: 'gentle', max: 'active' },
    // Spec pide archetype 'active': NO existe en USER_ARCHETYPES
    // (strobe|ambient|heavy|divine|utility) → isUserArchetype() caería a
    // 'utility' silenciosamente al cargar. Emitimos 'utility' directamente:
    // passthrough de bias → ACO {0.6,0.2,0.8} pasa SIN clamps (heavy habría
    // clampeado A0.6→0.7 y O0.8→0.45, destruyendo la organicidad pedida).
    genome: { aggression: 0.6, chaos: 0.2, organicity: 0.8 },
    archetype: 'utility', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 60,
    durationMs: 2000, strobeHz: 0, isOneShot: true, bpmRef: 96,
    dominantColor: { h: 30, s: 100, l: 50 },
    buildTracks: () => [
      // Pulso de calor: 0.2 → 1.0 → 0.2 en 2000ms, todo LINEAR
      intensityTrack(['all'],
        [kf(0, 0.2, 'linear'), kf(1000, 1, 'linear'), kf(2000, 0.2, 'linear')],
        { phaseConfig: NO_PHASE }),
      colorTrack(['all'], [kf(0, { h:30, s:100, l:50 }), kf(2000, { h:30, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.7, energyMultiplier: 1.2, vibeBonus: 0.15 },
      gpuCost: 0.15, fatigueImpact: 0.35, minDurationMs: 1000, cooldownMs: 6000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.3 },
    },
  },

  // ── EFECTO 20: SALSA FLASH — rebote rítmico con fade (metales) ─────────────
  {
    id: 'fx_salsa_flash', name: 'Salsa Flash', subdir: 'latin',
    category: 'physical',
    tags: ['salsa','flash','rebote','brass','latino','gold','bounce','rhythmic'],
    vibes: ['fiesta-latina'], sections: ['chorus','drop'],
    energyZone: { min: 'active', max: 'intense' },
    // Spec 'active' → no canónico: emitido 'utility' (ver fx_calor_urbano).
    // heavy habría clampeado O0.7→0.45 — el rebote necesita su organicidad.
    genome: { aggression: 0.75, chaos: 0.4, organicity: 0.7 },
    archetype: 'utility', spatialBehavior: 'static',
    spatialZones: ['front','all-movers'], mixBus: 'global', priority: 75,
    durationMs: 1000, strobeHz: 0, isOneShot: true, bpmRef: 100,
    dominantColor: { h: 50, s: 100, l: 50 },
    buildTracks: () => [
      // Doble rebote triangular LINEAR: 0→1 en 200ms, 0 en 500, 1 en 700, 0 en 1000.
      // Parpadeo con fade, no estrobo duro — acompaña metales sin agredir.
      intensityTrack(['front','all-movers'],
        [kf(0, 0, 'linear'), kf(200, 1, 'linear'), kf(500, 0, 'linear'),
         kf(700, 1, 'linear'), kf(1000, 0, 'linear')],
        { phaseConfig: NO_PHASE }),
      colorTrack(['all'], [kf(0, { h:50, s:100, l:50 }), kf(1000, { h:50, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.75, energyMultiplier: 1.3, vibeBonus: 0.15 },
      gpuCost: 0.15, fatigueImpact: 0.4, minDurationMs: 500, cooldownMs: 5000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.4 },
    },
  },

  // ── EFECTO 21: OCASO LATINO — crossfade rosa→naranja + balanceo ────────────
  {
    id: 'fx_ocaso_latino', name: 'Ocaso Latino', subdir: 'latin',
    category: 'composite',
    tags: ['ocaso','sunset','crossfade','rosa','naranja','latino','slow','restaurant'],
    vibes: ['fiesta-latina'], sections: ['intro','breakdown','outro'],
    energyZone: { min: 'silence', max: 'valley' },
    // Bias ambient: A0.15≤0.3 ✓ C0.1≤0.3 ✓ O0.9≥0.55 ✓ — spec pasa limpio.
    genome: { aggression: 0.15, chaos: 0.1, organicity: 0.9 },
    archetype: 'ambient', spatialBehavior: 'relative_offset',
    spatialZones: ['all'], mixBus: 'global', priority: 35,
    durationMs: 5000, strobeHz: 0, isOneShot: true, bpmRef: 80,
    dominantColor: { h: 330, s: 100, l: 50 },
    buildTracks: () => [
      // Intensidad sostenida tenue — el crossfade de color es el protagonista
      intensityTrack(['all'], [kf(0, 0.4), kf(5000, 0.4)], { phaseConfig: NO_PHASE }),
      // Rosa → naranja LINEAR sobre 5000ms (transición de ocaso, one-way)
      colorTrack(['all'],
        [kf(0, { h:330, s:100, l:50 }, 'linear'), kf(5000, { h:30, s:100, l:50 }, 'linear')]),
      // Spec dice pan "oscila" -0.3→0.3: triángulo -0.3→0.3→-0.3 en 5000ms.
      // Loop seamless (punta final = punta inicial), no el barrido one-way
      // de brisa_caribe. 'relative_offset' + panTrack additive [-1,1].
      panTrack(['all-movers'],
        [kf(0, -0.3, 'linear'), kf(2500, 0.3, 'linear'), kf(5000, -0.3, 'linear')],
        { phaseConfig: NO_PHASE }),
    ],
    simMeta: {
      beautyWeights: { base: 0.8, energyMultiplier: 0.8, vibeBonus: 0.15 },
      gpuCost: 0.2, fatigueImpact: 0.1, minDurationMs: 3000, cooldownMs: 8000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.05 },
    },
  },

  // ═══ LOTE 7 — MIX QUINCHO: ROCK + CUMBIA + ELECTRO LIGHT (fiesta-latina) ═══
  // ADN asimétrico 3 decimales: evita empates en el simulador y maximiza
  // mutaciones (minions) en el Coliseo de Genesis. Todos van a vibe
  // 'fiesta-latina' — la distribución por género se hace en UI.

  // ── EFECTO 22: FURIA NACIONAL — rasgueo rock, picos contundentes ───────────
  {
    id: 'fx_furia_nacional', name: 'Furia Nacional', subdir: 'latin',
    category: 'physical',
    tags: ['rock','nacional','guitarra','rasgueo','furia','latino','argentina','hit'],
    vibes: ['fiesta-latina'], sections: ['chorus','drop','climax'],
    energyZone: { min: 'active', max: 'intense' },
    // Utility por diseño del spec: sin bias → genoma asimétrico pasa intacto.
    genome: { aggression: 0.714, chaos: 0.428, organicity: 0.681 },
    archetype: 'utility', spatialBehavior: 'static',
    spatialZones: ['front','back'], mixBus: 'global', priority: 80,
    durationMs: 1200, strobeHz: 0, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 200, s: 100, l: 50 },
    buildTracks: () => [
      // Rasgueo: pico@0 → caída 0.2@300 → segundo pico@600 → fade a 0@1200
      intensityTrack(['front','back'],
        [kf(0, 1, 'linear'), kf(300, 0.2, 'linear'), kf(600, 1, 'linear'),
         kf(1200, 0, 'linear')],
        { phaseConfig: NO_PHASE }),
      // "Blanco puro a Celeste": golpe blanco (s=0,l=100) que asienta a
      // celeste H200 — flash de acorde que decae al color de la bandera.
      colorTrack(['all'],
        [kf(0, { h:0, s:0, l:100 }, 'linear'), kf(1200, { h:200, s:100, l:50 }, 'linear')]),
    ],
    simMeta: {
      beautyWeights: { base: 0.8, energyMultiplier: 1.35, vibeBonus: 0.15 },
      gpuCost: 0.15, fatigueImpact: 0.45, minDurationMs: 600, cooldownMs: 5000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.45 },
    },
  },

  // ── EFECTO 23: CUMBIA SWING — vaivén tropical + pan cadencioso ─────────────
  {
    id: 'fx_cumbia_swing', name: 'Cumbia Swing', subdir: 'latin',
    category: 'composite',
    tags: ['cumbia','swing','tropical','vaiven','latino','amarillo','lima','pan'],
    vibes: ['fiesta-latina'], sections: ['verse','chorus'],
    energyZone: { min: 'gentle', max: 'active' },
    // Utility: genoma asimétrico intacto.
    genome: { aggression: 0.412, chaos: 0.185, organicity: 0.843 },
    archetype: 'utility', spatialBehavior: 'relative_offset',
    spatialZones: ['all-movers'], mixBus: 'global', priority: 55,
    durationMs: 2000, strobeHz: 0, isOneShot: true, bpmRef: 96,
    dominantColor: { h: 50, s: 100, l: 50 },
    buildTracks: () => [
      // Spec no declara intensidad → all @ 0.6 (mismo fix que brisa_caribe:
      // sin ella el vaivén de color/pan sería invisible).
      intensityTrack(['all'], [kf(0, 0.6), kf(2000, 0.6)], { phaseConfig: NO_PHASE }),
      // Tropical: amarillo → verde lima LINEAR sobre 2000ms
      colorTrack(['all'],
        [kf(0, { h:50, s:100, l:50 }, 'linear'), kf(2000, { h:90, s:100, l:50 }, 'linear')]),
      // Pan "oscila" → triángulo -0.35→0.35→-0.35 en 2000ms (loop seamless,
      // mismo criterio que ocaso_latino).
      panTrack(['all-movers'],
        [kf(0, -0.35, 'linear'), kf(1000, 0.35, 'linear'), kf(2000, -0.35, 'linear')],
        { phaseConfig: NO_PHASE }),
    ],
    simMeta: {
      beautyWeights: { base: 0.75, energyMultiplier: 1.1, vibeBonus: 0.15 },
      gpuCost: 0.2, fatigueImpact: 0.3, minDurationMs: 1000, cooldownMs: 6000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.2 },
    },
  },

  // ── EFECTO 24: PSY DUB — atmósfera lisérgica de respiración lenta ──────────
  {
    id: 'fx_psy_dub', name: 'Psy Dub', subdir: 'latin',
    category: 'physical',
    tags: ['psydub','electro','liso','deep','morado','toxico','latino','breathing'],
    vibes: ['fiesta-latina'], sections: ['intro','breakdown','outro'],
    energyZone: { min: 'valley', max: 'ambient' },
    // Spec: chaos 0.615 viola chaosMax 0.3 del bias ambient → emitido 0.3
    // (= bakeCognitiveDNA). La lisergia vive en el crossfade de color, no en
    // el caos cognitivo. A0.237≤0.3 ✓ · O0.892≥0.55 ✓ pasan intactos.
    genome: { aggression: 0.237, chaos: 0.615, organicity: 0.892 },
    archetype: 'ambient', spatialBehavior: 'static',
    spatialZones: ['floor','ambient'], mixBus: 'global', priority: 40,
    durationMs: 6000, strobeHz: 0, isOneShot: true, bpmRef: 70,
    dominantColor: { h: 270, s: 100, l: 30 },
    buildTracks: () => [
      // Lecho constante tenue: floor + ambient al 0.45 sostenido
      intensityTrack(['floor','ambient'], [kf(0, 0.45), kf(6000, 0.45)],
        { phaseConfig: NO_PHASE }),
      // Morado profundo → verde tóxico LINEAR sobre 6000ms (ambos L:30)
      colorTrack(['all'],
        [kf(0, { h:270, s:100, l:30 }, 'linear'), kf(6000, { h:120, s:100, l:30 }, 'linear')]),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 0.7, vibeBonus: 0.15 },
      gpuCost: 0.1, fatigueImpact: 0.08, minDurationMs: 4000, cooldownMs: 10000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.05 },
    },
  },

  // ═══ LOTE 8 — CLUB (vibe 'techno-club', subdir 'techno') ═══
  // Física asimétrica del perfil techno: colchón back-left (mid synths),
  // cortes secos front-right (kick sniper). ADN asimétrico 3 decimales.

  // ── EFECTO 25: CLUB HYPNOTIC BOUNCE — groove tech house ────────────────────
  {
    id: 'fx_club_hypnotic_bounce', name: 'Hypnotic Bounce', subdir: 'techno',
    category: 'composite',
    tags: ['club','tech-house','groove','hipnotico','bounce','techno','cyan','minimal'],
    vibes: ['techno-club'], sections: ['verse','build','groove'],
    energyZone: { min: 'active', max: 'active' },
    // Utility: genoma asimétrico intacto (sin bias).
    genome: { aggression: 0.513, chaos: 0.287, organicity: 0.731 },
    archetype: 'utility', spatialBehavior: 'relative_offset',
    spatialZones: ['back-left','front-right','all-movers'], mixBus: 'global', priority: 65,
    durationMs: 2000, strobeHz: 0, isOneShot: true, bpmRef: 124,
    dominantColor: { h: 180, s: 100, l: 40 },
    buildTracks: () => [
      // Colchón back-left: río de luz pulsando suave 0.4↔0.7 (2 respiraciones)
      intensityTrack(['back-left'],
        [kf(0, 0.4, 'linear'), kf(500, 0.7, 'linear'), kf(1000, 0.4, 'linear'),
         kf(1500, 0.7, 'linear'), kf(2000, 0.4, 'linear')],
        { phaseConfig: NO_PHASE }),
      // Kick sniper front-right: picos 0.8 con caída LINEAR a 0 en 80ms
      // (diente de sierra) — 4 golpes al compás cada 500ms
      intensityTrack(['front-right'],
        [kf(0, 0.8, 'linear'), kf(80, 0, 'linear'),
         kf(500, 0.8, 'linear'), kf(580, 0, 'linear'),
         kf(1000, 0.8, 'linear'), kf(1080, 0, 'linear'),
         kf(1500, 0.8, 'linear'), kf(1580, 0, 'linear'), kf(2000, 0, 'linear')],
        { phaseConfig: NO_PHASE }),
      // Cyan profundo → azul oscuro LINEAR sobre 2000ms
      colorTrack(['all'],
        [kf(0, { h:180, s:100, l:40 }, 'linear'), kf(2000, { h:240, s:100, l:30 }, 'linear')]),
      // Tilt respiración: 0.1 → -0.1 → 0.1 triángulo seamless en movers
      tiltTrack(['all-movers'],
        [kf(0, 0.1, 'linear'), kf(1000, -0.1, 'linear'), kf(2000, 0.1, 'linear')],
        { phaseConfig: NO_PHASE }),
    ],
    simMeta: {
      beautyWeights: { base: 0.8, energyMultiplier: 1.15, vibeBonus: 0.15 },
      gpuCost: 0.25, fatigueImpact: 0.3, minDurationMs: 1500, cooldownMs: 5000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.35 },
    },
  },

  // ── EFECTO 26: CLUB ACID RISER — túnel ascendente hacia el drop ────────────
  {
    id: 'fx_club_acid_riser', name: 'Acid Riser', subdir: 'techno',
    category: 'composite',
    tags: ['club','acid','riser','buildup','tunel','edm','techno','magenta','tension'],
    vibes: ['techno-club'], sections: ['buildup','build'],
    // Spec 'buildup→intense': 'buildup' no es EnergyZoneId canónico (es una
    // sección). Mapeado a 'active→intense' (span 2) — cubre la subida al drop.
    energyZone: { min: 'active', max: 'intense' },
    genome: { aggression: 0.784, chaos: 0.419, organicity: 0.352 },
    archetype: 'utility', spatialBehavior: 'relative_offset',
    spatialZones: ['all-movers','all'], mixBus: 'global', priority: 78,
    durationMs: 4000, strobeHz: 0, isOneShot: true, bpmRef: 128,
    dominantColor: { h: 300, s: 100, l: 40 },
    buildTracks: () => [
      // Rampa de intensidad 0.2 → 0.95 en todas las zonas (adrenalina)
      intensityTrack(['all'], [kf(0, 0.2, 'linear'), kf(4000, 0.95, 'linear')],
        { phaseConfig: NO_PHASE }),
      // Magenta ácido → blanco cegador LINEAR agresivo
      colorTrack(['all'],
        [kf(0, { h:300, s:100, l:40 }, 'linear'), kf(4000, { h:0, s:0, l:100 }, 'linear')]),
      // Túnel: movers-left converge desde -0.5, movers-right desde +0.5 → 0
      panTrack(['movers-left'], [kf(0, -0.5, 'linear'), kf(4000, 0, 'linear')],
        { phaseConfig: NO_PHASE }),
      panTrack(['movers-right'], [kf(0, 0.5, 'linear'), kf(4000, 0, 'linear')],
        { phaseConfig: NO_PHASE }),
      // Tilt: rampa 0 → 0.8 (apuntando al cielo al llegar el drop)
      tiltTrack(['all-movers'], [kf(0, 0, 'linear'), kf(4000, 0.8, 'linear')],
        { phaseConfig: NO_PHASE }),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 1.4, vibeBonus: 0.15 },
      gpuCost: 0.3, fatigueImpact: 0.45, minDurationMs: 3000, cooldownMs: 8000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.5 },
    },
  },

  // ── EFECTO 27: CLUB BERLIN DROP — violencia industrial estroboscópica ──────
  {
    id: 'fx_club_berlin_drop', name: 'Berlin Drop', subdir: 'techno',
    category: 'physical',
    tags: ['club','berlin','drop','industrial','strobe','hard','techno','toxico'],
    vibes: ['techno-club'], sections: ['drop','climax'],
    energyZone: { min: 'peak', max: 'peak' },
    // Spec pide archetype 'impact': NO canónico (fallback utility al cargar).
    // Emitido 'strobe': genoma {0.941,0.762,0.115} pasa el bias LIMPIO
    // (A≥0.75, C≥0.4, O≤0.35) y casa con los latigazos mecánicos pedidos.
    genome: { aggression: 0.941, chaos: 0.762, organicity: 0.115 },
    archetype: 'strobe', spatialBehavior: 'static',
    spatialZones: ['air','front-right','all-movers'], mixBus: 'global', priority: 92,
    // R3: strobe exige Hz — hold 50ms ≈ 10Hz mecánico en los 7R
    durationMs: 1500, strobeHz: 10, isOneShot: true, bpmRef: 135,
    dominantColor: { h: 120, s: 100, l: 50 },
    buildTracks: () => [
      // 5 latigazos binarios cada 300ms: 1.0 con hold 50ms → caída a 0
      // en air (cuchillas espectrales) + front-right
      intensityTrack(['air','front-right'],
        [kf(0, 1), kf(50, 0), kf(300, 1), kf(350, 0), kf(600, 1), kf(650, 0),
         kf(900, 1), kf(950, 0), kf(1200, 1), kf(1250, 0), kf(1500, 0)],
        { phaseConfig: NO_PHASE }),
      // Verde tóxico con destellos blancos puros en cada impacto (hold = cortes)
      colorTrack(['all'],
        [kf(0, { h:0, s:0, l:100 }), kf(50, { h:120, s:100, l:50 }),
         kf(300, { h:0, s:0, l:100 }), kf(350, { h:120, s:100, l:50 }),
         kf(600, { h:0, s:0, l:100 }), kf(650, { h:120, s:100, l:50 }),
         kf(900, { h:0, s:0, l:100 }), kf(950, { h:120, s:100, l:50 }),
         kf(1200, { h:0, s:0, l:100 }), kf(1250, { h:120, s:100, l:50 }),
         kf(1500, { h:120, s:100, l:50 })]),
      // Estrobo plano mecánico 10Hz en los movers (7R)
      strobeTrack(['all-movers'], strobeFlat(1500)),
    ],
    simMeta: {
      beautyWeights: { base: 0.9, energyMultiplier: 1.5, vibeBonus: 0.15 },
      gpuCost: 0.2, fatigueImpact: 0.6, minDurationMs: 800, cooldownMs: 10000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.7 },
    },
  },

  // ═══ LOTE 9 — CLUB 2: BREAKDOWN & LÁTIGO (techno-club) ═══
  // CINÉTICA CERO: ningún pan/tilt — el motor base mueve las máquinas.
  // Solo intensity, color y strobe. Todos 'static' (G7).

  // ── EFECTO 28: ABYSSAL BREAKDOWN — valle deep techno subacuático ───────────
  {
    id: 'fx_club_abyssal_breakdown', name: 'Abyssal Breakdown', subdir: 'techno',
    category: 'physical',
    tags: ['club','abyssal','breakdown','deep','subacuatico','techno','valley','abisal'],
    vibes: ['techno-club'], sections: ['breakdown','valley','outro'],
    energyZone: { min: 'valley', max: 'ambient' },
    // Bias ambient: A0.112≤0.3 ✓ C0.285≤0.3 ✓ O0.814≥0.55 ✓ — limpio.
    genome: { aggression: 0.112, chaos: 0.285, organicity: 0.814 },
    archetype: 'ambient', spatialBehavior: 'static',
    spatialZones: ['back-left','floor','ambient'], mixBus: 'global', priority: 38,
    durationMs: 8000, strobeHz: 0, isOneShot: true, bpmRef: 120,
    dominantColor: { h: 240, s: 100, l: 20 },
    buildTracks: () => [
      // Senoidal extremadamente lenta 0.1↔0.45 en el colchón trasero-izq,
      // el suelo y el ambiente — 2 respiraciones completas en 8000ms
      intensityTrack(['back-left','floor','ambient'],
        [kf(0, 0.1, 'linear'), kf(2000, 0.45, 'linear'), kf(4000, 0.1, 'linear'),
         kf(6000, 0.45, 'linear'), kf(8000, 0.1, 'linear')],
        { phaseConfig: NO_PHASE }),
      // Azul abisal ↔ púrpura oscuro pulsando lento (loop seamless)
      colorTrack(['all'],
        [kf(0, { h:240, s:100, l:20 }, 'linear'), kf(4000, { h:280, s:100, l:20 }, 'linear'),
         kf(8000, { h:240, s:100, l:20 }, 'linear')]),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 0.7, vibeBonus: 0.15 },
      gpuCost: 0.1, fatigueImpact: 0.08, minDurationMs: 5000, cooldownMs: 8000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.05 },
    },
  },

  // ── EFECTO 29: INDUSTRIAL WHIP — látigo percusivo en back-right ────────────
  {
    id: 'fx_club_industrial_whip', name: 'Industrial Whip', subdir: 'techno',
    category: 'physical',
    tags: ['club','industrial','whip','latigo','slap','percusive','techno','needle'],
    vibes: ['techno-club'], sections: ['chorus','drop'],
    energyZone: { min: 'active', max: 'intense' },
    // Spec pide 'rhythmic': NO canónico → fallback utility al cargar.
    // Emitido 'heavy': genoma {0.884,0.612,0.211} pasa el bias LIMPIO
    // (A≥0.7, C≥0.3, O≤0.45) y casa con "golpe seco brutal".
    genome: { aggression: 0.884, chaos: 0.612, organicity: 0.211 },
    archetype: 'heavy', spatialBehavior: 'static',
    spatialZones: ['back-right'], mixBus: 'global', priority: 70,
    durationMs: 600, strobeHz: 0, isOneShot: true, bpmRef: 130,
    dominantColor: { h: 210, s: 40, l: 90 },
    buildTracks: () => [
      // 3 golpes de ametralladora SOLO en back-right (El Látigo / transient
      // detector): salto instantáneo a 1.0 (hold previo a 0) + caída LINEAR
      // a 0 absoluto en 100ms. Golpes a 0/200/400ms.
      intensityTrack(['back-right'],
        [kf(0, 1, 'linear'), kf(100, 0),
         kf(200, 1, 'linear'), kf(300, 0),
         kf(400, 1, 'linear'), kf(500, 0), kf(600, 0)],
        { phaseConfig: NO_PHASE }),
      // Blanco frío CTB constante — el látigo no canta, solo pega
      colorTrack(['all'], [kf(0, { h:210, s:40, l:90 }), kf(600, { h:210, s:40, l:90 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.8, energyMultiplier: 1.35, vibeBonus: 0.15 },
      gpuCost: 0.1, fatigueImpact: 0.5, minDurationMs: 400, cooldownMs: 4000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.5 },
    },
  },

  // ── EFECTO 30: ACID STABS — destellos rítmicos on/off bruscos ──────────────
  {
    id: 'fx_club_acid_stabs', name: 'Acid Stabs', subdir: 'techno',
    category: 'physical',
    tags: ['club','acid','stabs','synth','arpegio','techno','verde','rhythmic'],
    vibes: ['techno-club'], sections: ['verse','chorus','build'],
    energyZone: { min: 'active', max: 'active' },
    // Spec pide 'rhythmic': NO canónico. 'heavy' clampearía A0.618→0.7 y
    // 'strobe'→0.75; 'utility' preserva el genoma asimétrico intacto.
    genome: { aggression: 0.618, chaos: 0.354, organicity: 0.419 },
    archetype: 'utility', spatialBehavior: 'static',
    spatialZones: ['all-movers','air'], mixBus: 'global', priority: 60,
    durationMs: 1000, strobeHz: 0, isOneShot: true, bpmRef: 128,
    dominantColor: { h: 120, s: 100, l: 50 },
    buildTracks: () => [
      // Onda cuadrada 250ms: ON 0.8 durante 100ms / OFF durante 150ms.
      // Spec dice zona 'mover' → canonical 'all-movers' (+ láseres air).
      // 4 ciclos en 1000ms. HOLD = cortes secos, no fades.
      intensityTrack(['all-movers','air'],
        [kf(0, 0.8), kf(100, 0), kf(250, 0.8), kf(350, 0),
         kf(500, 0.8), kf(600, 0), kf(750, 0.8), kf(850, 0), kf(1000, 0)],
        { phaseConfig: NO_PHASE }),
      // Verde ácido constante — los stabs manipulan intensidad, no color
      colorTrack(['all'], [kf(0, { h:120, s:100, l:50 }), kf(1000, { h:120, s:100, l:50 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.75, energyMultiplier: 1.25, vibeBonus: 0.15 },
      gpuCost: 0.15, fatigueImpact: 0.4, minDurationMs: 500, cooldownMs: 4000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.4 },
    },
  },

  // ═══ LOTE 10 — CLUB 3: TRACA DE ESTROBOS & CEGADORAS (techno-club) ═══
  // Cero cinética. Arquetipos nativos (strobe/heavy). maxStrobeFreqHz=25 =
  // techo de seguridad del sistema (convención builtins techno): NO es la
  // frecuencia artística — el runtime gobierna el rate real dentro del límite.

  // ── EFECTO 31: XENON FRENZY — metralla estroboscópica de clímax ────────────
  {
    id: 'fx_club_xenon_frenzy', name: 'Xenon Frenzy', subdir: 'techno',
    category: 'physical',
    tags: ['club','xenon','frenzy','strobe','metralla','edm','peak','blinder'],
    vibes: ['techno-club'], sections: ['drop','climax'],
    // Spec 'peak→intense' descendente → normalizado a intense→peak (span 2).
    energyZone: { min: 'intense', max: 'peak' },
    // Bias strobe: A0.972≥0.75 ✓ C0.841≥0.4 ✓ O0.103≤0.35 ✓ — limpio.
    genome: { aggression: 0.972, chaos: 0.841, organicity: 0.103 },
    archetype: 'strobe', spatialBehavior: 'static',
    spatialZones: ['all-movers','air','front'], mixBus: 'global', priority: 95,
    durationMs: 1800, strobeHz: 25, isOneShot: true, bpmRef: 140,
    dominantColor: { h: 0, s: 0, l: 100 },
    buildTracks: () => [
      // Intensidad clavada al 1.0 — el estrobo hace la metralla
      intensityTrack(['all-movers','air','front'], [kf(0, 1), kf(1800, 1)],
        { phaseConfig: NO_PHASE }),
      // Blanco puro frío constante
      colorTrack(['all'], [kf(0, { h:0, s:0, l:100 }), kf(1800, { h:0, s:0, l:100 })]),
      // Estrobo plano — rate real lo decide el runtime bajo el techo 25Hz
      strobeTrack(['all-movers','air','front'], strobeFlat(1800)),
    ],
    simMeta: {
      beautyWeights: { base: 0.9, energyMultiplier: 1.5, vibeBonus: 0.15 },
      gpuCost: 0.25, fatigueImpact: 0.65, minDurationMs: 1000, cooldownMs: 12000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.75 },
    },
  },

  // ── EFECTO 32: TUNGSTEN SLAM — cegadora de festival con caída térmica ──────
  {
    id: 'fx_club_tungsten_slam', name: 'Tungsten Slam', subdir: 'techno',
    category: 'physical',
    tags: ['club','tungsten','slam','blinder','cegadora','festival','amber','crowd'],
    vibes: ['techno-club'], sections: ['drop','climax'],
    energyZone: { min: 'peak', max: 'peak' },
    // Spec: organicity 0.528 viola organicityMax 0.45 del bias heavy →
    // emitido 0.45 (= bakeCognitiveDNA). A0.894≥0.7 ✓ C0.312≥0.3 ✓.
    genome: { aggression: 0.894, chaos: 0.312, organicity: 0.528 },
    archetype: 'heavy', spatialBehavior: 'static',
    spatialZones: ['front','ambient','floor'], mixBus: 'global', priority: 88,
    durationMs: 2400, strobeHz: 0, isOneShot: true, bpmRef: 130,
    dominantColor: { h: 38, s: 100, l: 55 },
    buildTracks: () => [
      // Blinder: salto a 1.0, sostenido 150ms (hold), caída térmica LINEAR
      // a 0 en 1400ms, negro hasta el final — la cegadora respira su tungsteno
      intensityTrack(['front','ambient','floor'],
        [kf(0, 1), kf(150, 1, 'linear'), kf(1400, 0), kf(2400, 0)],
        { phaseConfig: NO_PHASE }),
      // Ámbar cálido constante — la lámpara no cambia de color, se apaga
      colorTrack(['all'], [kf(0, { h:38, s:100, l:55 }), kf(2400, { h:38, s:100, l:55 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.9, energyMultiplier: 1.4, vibeBonus: 0.15 },
      gpuCost: 0.15, fatigueImpact: 0.55, minDurationMs: 1200, cooldownMs: 10000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.65 },
    },
  },

  // ── EFECTO 33: LASER CUTTER — cuchillas aéreas quirúrgicas ─────────────────
  {
    id: 'fx_club_laser_cutter', name: 'Laser Cutter', subdir: 'techno',
    category: 'physical',
    tags: ['club','laser','cutter','cuchillas','aereo','contrafase','cyan','surgical'],
    vibes: ['techno-club'], sections: ['drop','climax'],
    energyZone: { min: 'intense', max: 'intense' },
    // Bias strobe: A0.931≥0.75 ✓ C0.674≥0.4 ✓ O0.179≤0.35 ✓ — limpio.
    genome: { aggression: 0.931, chaos: 0.674, organicity: 0.179 },
    archetype: 'strobe', spatialBehavior: 'static',
    spatialZones: ['air','back-right'], mixBus: 'global', priority: 90,
    durationMs: 2000, strobeHz: 25, isOneShot: true, bpmRef: 135,
    dominantColor: { h: 185, s: 100, l: 50 },
    buildTracks: () => [
      // Tren de pulsos cuadrados quirúrgico: ON 80ms / OFF 120ms (periodo
      // 200ms, 10 cortes) SOLO en air + back-right — contrafase aérea
      intensityTrack(['air','back-right'],
        [kf(0, 1), kf(80, 0), kf(200, 1), kf(280, 0), kf(400, 1), kf(480, 0),
         kf(600, 1), kf(680, 0), kf(800, 1), kf(880, 0), kf(1000, 1), kf(1080, 0),
         kf(1200, 1), kf(1280, 0), kf(1400, 1), kf(1480, 0), kf(1600, 1),
         kf(1680, 0), kf(1800, 1), kf(1880, 0), kf(2000, 0)],
        { phaseConfig: NO_PHASE }),
      // Cyan eléctrico constante — el láser no tinta, corta
      colorTrack(['all'], [kf(0, { h:185, s:100, l:50 }), kf(2000, { h:185, s:100, l:50 })]),
      // Estrobo plano en las cuchillas — rate bajo techo sistema 25Hz
      strobeTrack(['air','back-right'], strobeFlat(2000)),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 1.45, vibeBonus: 0.15 },
      gpuCost: 0.2, fatigueImpact: 0.55, minDurationMs: 1200, cooldownMs: 8000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.6 },
    },
  },

  // ═══ LOTE 11 — CLUB 4: THE LONG HOLDS (techno-club) ═══
  // Tiempos mecánicos ≥3500ms para las ruedas de color de las cabezas de
  // 25kg (darkspinfilter). Cero cinética — solo intensity/color/strobe.

  // ── EFECTO 34: DEEP RESONANCE — oleaje tech house de larga duración ────────
  {
    id: 'fx_club_deep_resonance', name: 'Deep Resonance', subdir: 'techno',
    category: 'physical',
    tags: ['club','deep','resonance','swell','tech-house','oleaje','techno','long'],
    vibes: ['techno-club'], sections: ['build','breakdown','groove'],
    // Spec 'active' fuera de allowedZones ambient (LOW) → warn R4, no fail.
    // Emitido tal cual: la subida elegante puede vivir en zona activa.
    energyZone: { min: 'active', max: 'active' },
    // Bias ambient: A0.215≤0.3 ✓ C0.184≤0.3 ✓ O0.892≥0.55 ✓ — limpio.
    genome: { aggression: 0.215, chaos: 0.184, organicity: 0.892 },
    archetype: 'ambient', spatialBehavior: 'static',
    spatialZones: ['back-left','floor','ambient'], mixBus: 'global', priority: 45,
    durationMs: 6000, strobeHz: 0, isOneShot: true, bpmRef: 122,
    dominantColor: { h: 230, s: 100, l: 25 },
    buildTracks: () => [
      // Swell: rampa ease-in-out aproximada (0.1→0.45→0.8) en 3000ms,
      // hold 1000ms, fade-out lento 2000ms hasta 0
      intensityTrack(['back-left','floor','ambient'],
        [kf(0, 0.1, 'linear'), kf(1500, 0.45, 'linear'), kf(3000, 0.8, 'linear'),
         kf(4000, 0.8, 'linear'), kf(6000, 0, 'linear')],
        { phaseConfig: NO_PHASE }),
      // Azul marino → magenta profundo, transición hiper-lenta (ruedas de
      // color tienen tiempo de clavar el hue)
      colorTrack(['all'],
        [kf(0, { h:230, s:100, l:25 }, 'linear'), kf(6000, { h:300, s:100, l:30 }, 'linear')]),
    ],
    simMeta: {
      beautyWeights: { base: 0.85, energyMultiplier: 1.0, vibeBonus: 0.15 },
      gpuCost: 0.1, fatigueImpact: 0.15, minDurationMs: 4000, cooldownMs: 8000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.15 },
    },
  },

  // ── EFECTO 35: TITANIUM HIT — slam masivo congelado en el aire ─────────────
  {
    id: 'fx_club_titanium_hit', name: 'Titanium Hit', subdir: 'techno',
    category: 'physical',
    tags: ['club','titanium','hit','slam','frozen','blinder','techno','ice','heavy'],
    vibes: ['techno-club'], sections: ['drop','climax'],
    energyZone: { min: 'intense', max: 'intense' },
    // Spec: organicity 0.621 viola organicityMax 0.45 del bias heavy →
    // emitido 0.45 (= bakeCognitiveDNA). A0.863≥0.7 ✓ C0.417≥0.3 ✓.
    genome: { aggression: 0.863, chaos: 0.417, organicity: 0.621 },
    archetype: 'heavy', spatialBehavior: 'static',
    spatialZones: ['front','air','back-right'], mixBus: 'global', priority: 90,
    durationMs: 4000, strobeHz: 0, isOneShot: true, bpmRef: 130,
    dominantColor: { h: 200, s: 30, l: 90 },
    buildTracks: () => [
      // Salto instantáneo a 1.0 (hold previo a 0 implícito), hold 1500ms de
      // ceguera fija, decaimiento parabólico aproximado en 2500ms: lento al
      // inicio (0.9→0.7), se acelera al final (0.3→0)
      intensityTrack(['front','air','back-right'],
        [kf(0, 1), kf(1500, 1, 'linear'), kf(2500, 0.7, 'linear'),
         kf(3300, 0.3, 'linear'), kf(4000, 0)],
        { phaseConfig: NO_PHASE }),
      // Blanco hielo CTB constante — la rueda clava el frío y se queda
      colorTrack(['all'], [kf(0, { h:200, s:30, l:90 }), kf(4000, { h:200, s:30, l:90 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.9, energyMultiplier: 1.4, vibeBonus: 0.15 },
      gpuCost: 0.15, fatigueImpact: 0.5, minDurationMs: 3500, cooldownMs: 12000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.6 },
    },
  },

  // ── EFECTO 36: CHROMATIC PULSE — pumper largo para saltos de rueda ─────────
  {
    id: 'fx_club_chromatic_pulse', name: 'Chromatic Pulse', subdir: 'techno',
    category: 'physical',
    tags: ['club','chromatic','pulse','pumper','synth','techno','yellow','red'],
    vibes: ['techno-club'], sections: ['verse','chorus','build'],
    energyZone: { min: 'active', max: 'intense' },
    // Utility: genoma asimétrico intacto.
    genome: { aggression: 0.548, chaos: 0.382, organicity: 0.514 },
    archetype: 'utility', spatialBehavior: 'static',
    spatialZones: ['all-movers','ambient'], mixBus: 'global', priority: 62,
    durationMs: 5000, strobeHz: 0, isOneShot: true, bpmRef: 126,
    dominantColor: { h: 60, s: 100, l: 50 },
    buildTracks: () => [
      // 3 pulsos anchos back-to-back (ciclo 1600ms): sube 400ms a 0.85,
      // hold 800ms, baja 400ms a 0. Los cruces por 0 = puntos ciegos donde
      // la rueda de color salta. Cola final 200ms a 0.
      intensityTrack(['all-movers','ambient'],
        [kf(0, 0, 'linear'), kf(400, 0.85, 'linear'), kf(1200, 0.85, 'linear'), kf(1600, 0, 'linear'),
         kf(2000, 0.85, 'linear'), kf(2800, 0.85, 'linear'), kf(3200, 0, 'linear'),
         kf(3600, 0.85, 'linear'), kf(4400, 0.85, 'linear'), kf(4800, 0, 'linear'),
         kf(5000, 0)],
        { phaseConfig: NO_PHASE }),
      // Amarillo tóxico → rojo sangre LINEAR sobre los 5s completos
      colorTrack(['all'],
        [kf(0, { h:60, s:100, l:50 }, 'linear'), kf(5000, { h:0, s:100, l:40 }, 'linear')]),
    ],
    simMeta: {
      beautyWeights: { base: 0.8, energyMultiplier: 1.25, vibeBonus: 0.15 },
      gpuCost: 0.15, fatigueImpact: 0.35, minDurationMs: 3500, cooldownMs: 6000,
      isStrobe: false, isDivineCandidate: false, isHeavyCandidate: false,
      zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: 0.4 },
    },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
console.log(`═══ FACTORY ARSENAL GENERATOR — LOTE 1 RAVEX ${DRY_RUN ? '(DRY-RUN)' : ''} ═══`)
let ok = 0, ko = 0
for (const bp of BLUEPRINTS) emit(bp) ? ok++ : ko++
console.log(`\n${ok} escritos · ${ko} rechazados`)
if (!DRY_RUN && ok > 0) console.log('→ Siguiente paso: npm run forge:manifest')
process.exit(ko > 0 ? 1 : 0)
