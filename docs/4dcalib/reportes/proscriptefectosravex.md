Encontrados todos los archivos, incluyendo builtins ravex existentes. Leo el stack completo:

Hallazgo clave: el checksum se calcula sobre `JSON.stringify(clip)` del objeto parseado. Verifico cómo lo verifica `HephaestusClipIndex.upsert` (puede diferir) y el resto del stack:

Leo el resto del loader (donde debe estar `computeLfxChecksum`), el screening Genesis, y un `.lfx` ravex real como referencia:

Ahora los tipos cognitivos (`LfxClipInstance` con `ARCHETYPE_BIAS_MAP`/`ENERGY_ZONES`), el `EnergyZone` canónico, y cómo se cablean los builtins al build:

Ya existe `scripts/generate-ravex-fx.js` — lo leo junto al manifest generator y el resto de `toCognitiveDNA` (pressureRange):

Completan el mapa: `validSections` canónicas y `CanonicalZone`:

# REPORTE FORENSE — ARSENAL `.lfx` V3 + BLUEPRINT DEL GENERADOR

## 1. Anatomía del formato (verificado en disco)

Wrapper `.lfx v3.0` — estructura exacta de `fx_guillotina.lfx`:

```json
{ "$schema": "luxsync.lfx/3.0", "clip": { …HephAutomationClipV3… }, "checksum": "sha256:<hex>" }
```

El `clip` requiere: `id`, `name`, `author`, `category` (`physical|color|movement|optics|composite|beam|atmosphere`), `tags[]`, `vibeCompat[]` (**no vacío**), `durationMs>0`, `effectType`, `spatialZones[]`, `mixBus` (`global|htp|ambient|accent`), `priority`, `tracks[]` (**≥1**), `staticParams{}`, `schemaVersion:'3.0'`, y los bloques cognitivos `cognitiveDNA` / `simulationMeta` / `safetyDeclaration` / `executionHints?`.

**Track V3** (`HephTrack`): `id` (uuid), `paramId` (canónico G8), `zones[]` (CanonicalZone: `front|back|floor|movers-left|movers-right|strobe|air|ambient|unassigned` + helpers `all|all-pars|all-movers`), `curve{paramId,valueType,range,defaultValue,keyframes[],mode}`, `blendMode`, `phaseConfig` (PhaseConfigPro: `spreadDeg,symmetry,wings,blocks,shuffle,shuffleSeed,direction`).

## 2. Checksum — doctrina LAZARUS B-4 (hallazgo crítico)

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\LfxFileLoader.ts:558-562`

**NO es JSON canónico con deep-sort.** Es `sha256(JSON.stringify(clip))` sobre el objeto parseado — el orden de claves del archivo determina el hash. El generador debe: construir el objeto clip → `crypto.createHash('sha256').update(JSON.stringify(clip))` → escribir `$schema/clip/checksum` con `JSON.stringify(…, null, 2)`. Prefijo `sha256:` aceptado en ambas formas (bare hex también pasa — WAVE 7520.1). Checksum incorrecto = **hard reject** en `HephaestusClipIndex.upsert` (línea 230); ausente = warning (permitido, pero **obligatorio para builtins** en G2 del loader, línea 412).

## 3. Gates descubiertos (los 3 validadores reales)

| Gate | Regla | Severidad |
|---|---|---|
| **G1** | `id`,`name`,`durationMs>0` | abort |
| **G2** | checksum SHA-256 correcto; obligatorio en builtin | abort |
| **G3** | `genome.{aggression,chaos,organicity} ∈ [0,1]` | abort |
| **G4** | `compatibleVibes≥1` + `validSections≥1` + **`energyZone` span ≤ 2** zonas contiguas (`indexOf(max)-indexOf(min)+1` en `silence…peak`) | abort |
| **G5** | `tracks≥1`; cada track `zones[]`+`keyframes[]` no vacíos; ≥1 track con ≥2 keyframes | abort |
| **G6** | `maxStrobeFreqHz ≤ 25Hz`; `>0` requiere track `strobe` o `intensity`; `=0` prohíbe track `strobe`. Si `simMeta.isStrobe`: track strobe con valores ∈[0,1] **o** intensity con ≥4 keyframes | abort |
| **G7** | redundancia (L2≥0.02, solo Genesis) + spatial warn-only | abort/warn |
| **G8** | todo `paramId` ∈ set canónico (24 IDs; **"strobeRate" NO existe** — usar `strobe`) | abort |

**GatekeeperLinter (reglas de arquetipo — el generador debe respetarlas de fábrica):**
- `ARCHETYPE_BIAS_MAP`: `divine` A≥0.9/C∈[0.3,0.7]/solo intense+peak · `strobe` A≥0.75/C≥0.4/O≤0.35 · `heavy` A≥0.7/C≥0.3/O≤0.45 · `ambient` A≤0.3/C≤0.3/O≥0.55/solo zonas bajas · `utility` libre.
- Ranges derivados (mirror de `toCognitiveDNA`): `aggressionRange` = hard ±0.15, ambient ±0.20, utility {0,1}; `pressureRange` = hard/A>0.7 → {0.5,1}, ambient → {0,0.5}; `textureAffinity` = strobe/heavy→`dirty`, ambient/divine→`clean`, utility→`universal`.
- Vibe bridge: `rave-highfreq` → **`'rave'`** (lo que va en `vibeCompat`/`compatibleVibes`).

## 4. Anomalías detectadas en builtins existentes

- `fx_ametralladora.lfx`: `spatialBehavior:"sweep"` — **valor inválido** (enum: `static|relative_offset|absolute|spatial`). Pasa por fail-open pero es deuda; el generador debe emitir `relative_offset` para barridos con pan/tilt `[-1,1]`.
- `fx_ametralladora.lfx`: `energyZone {active→peak}` = **span 3 > 2** — viola G4. Carga porque G4 solo corre en Genesis (PrenatalScreening/AncestralIngestor), pero si ese clip entra al Coliseum, aborta. **El generador debe forzar span ≤2.**

## 5. Pipeline de publicación

`builtins/ravex/*.lfx` → `npm run forge:manifest` (`scripts/generate-arsenal-manifest.ts`) → `manifest.json` → electron-builder `extraResources` (`builtins/`) → sync incremental a `userData/arsenal/` en boot (main.ts:746+). `custom/` queda excluido del manifest.

**Ya existe `scripts/generate-ravex-fx.js`** (patrón correcto de checksum incluido). La propuesta generaliza ese patrón a un generador blueprint-driven con validador de gates integrado:

## 6. Script propuesto — `electron-app/scripts/generate_factory_arsenal.js`

```js
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏭 FACTORY ARSENAL GENERATOR — .lfx V3 blueprint-driven
 * ═══════════════════════════════════════════════════════════════════════════
 * Recibe "blueprints" (metadata + specs de curva) y emite .lfx V3 que pasan
 * el 100% de los gates: Loader (G2/G5/G6), PrenatalScreening (G1-G8) y
 * GatekeeperLinter (R0-R6). Los archivos que fallan NO se escriben.
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
  'unassigned','all','all-pars','all-movers',
])
const STROBE_MAX_HZ = 25

// ARCHETYPE_BIAS_MAP (LfxClipInstance.ts:121) — clamp de fábrica
const ARCHETYPE_BIAS = {
  divine:  { aggressionMin:0.9,  chaosMin:0.3, chaosMax:0.7,  zones:['intense','peak'] },
  strobe:  { aggressionMin:0.75, chaosMin:0.4, organicityMax:0.35, zones:['active','intense','peak'] },
  heavy:   { aggressionMin:0.7,  chaosMin:0.3, organicityMax:0.45, zones:['active','intense','peak'] },
  ambient: { aggressionMax:0.3,  chaosMax:0.3, organicityMin:0.55, zones:['silence','valley','ambient','gentle'] },
  utility: { zones:['ambient','gentle','active'] },
}
const HARD_ARCHETYPES  = new Set(['strobe','heavy','divine'])

const clamp01 = v => Math.max(0, Math.min(1, v))
const uuid = () => crypto.randomUUID()

// ─── CHECKSUM — LAZARUS B-4 (idéntico a computeLfxChecksum) ─────────────────
function computeChecksum(clip) {
  return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(clip)).digest('hex')
}

// ─── CURVE BUILDERS ─────────────────────────────────────────────────────────
const kf = (timeMs, value, interpolation = 'hold', bezierHandles) =>
  bezierHandles ? { timeMs, value, interpolation, bezierHandles }
                : { timeMs, value, interpolation }

/** Tren de pulsos mecánicos (hold): hi durante widthMs cada periodMs. */
function pulseTrain(durationMs, periodMs, widthMs, hi = 1, lo = 0) {
  const kfs = []
  for (let t = 0; t < durationMs; t += periodMs) {
    kfs.push(kf(t, hi), kf(Math.min(t + widthMs, durationMs), lo))
  }
  kfs.push(kf(durationMs, lo))
  return kfs
}

/** Sweep sinusoidal muestreado a 'linear' entre min..max, nCycles sobre durationMs. */
function sineSweep(durationMs, nCycles, min, max, samplesPerCycle = 16) {
  const n = Math.max(2, Math.round(nCycles * samplesPerCycle))
  const kfs = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * durationMs
    const v = min + (max - min) * (0.5 - 0.5 * Math.cos(2 * Math.PI * nCycles * (i / n)))
    kfs.push(kf(Math.round(t), +v.toFixed(4), 'linear'))
  }
  return kfs
}

/** Rampa lineal simple [t0→v0, t1→v1, end→vEnd]. */
function ramp(durationMs, points /* [[t,v],…] */, lastValue = 0) {
  const kfs = points.map(([t, v]) => kf(t, v, 'linear'))
  kfs.push(kf(durationMs, lastValue))
  return kfs
}

// ─── TRACK BUILDERS ─────────────────────────────────────────────────────────
function track(paramId, zones, curve, extra = {}) {
  return { id: uuid(), paramId, zones, curve, blendMode: 'replace', ...extra }
}
function numCurve(paramId, keyframes, range = [0, 1], defaultValue = 0, mode = 'absolute') {
  return { paramId, valueType: 'number', range, defaultValue, keyframes, mode }
}
const intensityTrack = (zones, kfs, extra) =>
  track('intensity', zones, numCurve('intensity', kfs), extra)
const strobeTrack = (zones, kfs, extra) =>
  track('strobe', zones, numCurve('strobe', kfs), extra)
const panTrack = (zones, kfs, extra) =>
  track('pan', zones, numCurve('pan', kfs, [-1, 1], 0, 'additive'), extra)
const colorTrack = (zones, kfs, extra) =>
  track('color', zones,
    { paramId:'color', valueType:'color', range:[0,360],
      defaultValue:{ h:0, s:0, l:50 }, keyframes:kfs, mode:'absolute' }, extra)

const NO_PHASE = { spreadDeg:0, symmetry:'linear', wings:1, blocks:1, shuffle:0, shuffleSeed:1, direction:1 }

// ─── DNA DERIVATION (mirror toCognitiveDNA — WAVE 7520/7159) ────────────────
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
    textureAffinity: isHard ? 'dirty' : isAmbient || bp.archetype === 'divine' ? 'clean' : 'universal',
    compatibleVibes: bp.vibes,                       // canonical: 'rave' para RaveX
    validSections: bp.sections,
    energyZone: bp.energyZone,                       // {min,max} — span ≤ 2 enforced en gates
    aggressionRange: isAmbient
      ? { min: clamp01(genome.aggression - 0.20), max: clamp01(genome.aggression + 0.20) }
      : isHard
        ? { min: clamp01(genome.aggression - 0.15), max: clamp01(genome.aggression + 0.15) }
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
  const outDir = path.join(BUILTINS_ROOT, bp.subdir)
  const outFile = path.join(outDir, `${bp.id}.lfx`)

  if (DRY_RUN) { console.log(`  ✅ [dry-run] ${bp.id} OK (${lfx.checksum.slice(0, 20)}…)`); return true }

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(lfx, null, 2) + '\n', 'utf-8')

  // Read-back verify: re-parsear y recomputar — garantía LAZARUS B-4
  const back = JSON.parse(fs.readFileSync(outFile, 'utf-8'))
  if (computeChecksum(back.clip) !== lfx.checksum)
    throw new Error(`Checksum drift post-escritura en ${outFile}`)
  console.log(`  ✅ ${outFile}`)
  return true
}

// ─── BLUEPRINTS — rellenar aquí las definiciones de curvas ──────────────────
// Ejemplo de referencia (RaveX strobe, span=1 zona, bias 'strobe' cumplido):
const BLUEPRINTS = [
  {
    id: 'fx_ravex_strobe', name: 'RaveX Strobe', subdir: 'ravex',
    category: 'physical', tags: ['strobe','ravex','peak'],
    vibes: ['rave'], sections: ['drop','climax'],
    energyZone: { min: 'peak', max: 'peak' },
    genome: { aggression: 0.85, chaos: 0.6, organicity: 0.2 },
    archetype: 'strobe', spatialBehavior: 'static',
    spatialZones: ['all'], mixBus: 'global', priority: 90,
    durationMs: 4000, strobeHz: 20, isOneShot: false,
    dominantColor: { h: 0, s: 0, l: 100 },
    buildTracks: () => [
      intensityTrack(['all'], pulseTrain(4000, 200, 60, 1, 0), { phaseConfig: NO_PHASE }),
      strobeTrack(['all'], [kf(0, 0.9), kf(4000, 0.9)]),
      colorTrack(['all'], [kf(0, { h: 0, s: 0, l: 100 })]),
    ],
    simMeta: {
      beautyWeights: { base: 0.8, energyMultiplier: 1.4, vibeBonus: 0.15 },
      gpuCost: 0.2, fatigueImpact: 0.8, minDurationMs: 500, cooldownMs: 10000,
      isStrobe: true, isDivineCandidate: false, isHeavyCandidate: true,
      zScoreGuards: { requireRising: true, minimumZ: null, minimumEnergy: 0.7 },
    },
  },
  // TODO: 'Ambient Wash', 'Techno Pulse', … — añadir blueprints aquí
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
console.log(`═══ FACTORY ARSENAL GENERATOR ${DRY_RUN ? '(DRY-RUN)' : ''} ═══`)
let ok = 0, ko = 0
for (const bp of BLUEPRINTS) emit(bp) ? ok++ : ko++
console.log(`\n${ok} escritos · ${ko} rechazados`)
if (!DRY_RUN && ok > 0) console.log('→ Siguiente paso: npm run forge:manifest')
process.exit(ko > 0 ? 1 : 0)
```

## Notas de diseño

- **Checksum identico al runtime**: `sha256(JSON.stringify(clip))` + prefijo `sha256:` — coincide con `computeLfxChecksum` y el script `generate-ravex-fx.js` existente. El read-back verify garantiza que lo escrito en disco firma igual.
- **Fail-closed**: cualquier `error` de gate → el archivo no se escribe y el script sale con código 1.
- **`deriveDNA` replica `toCognitiveDNA`**: bias clamps, bands de aggression/pressure y textureAffinity se derivan del arquetipo — el autor del blueprint solo declara `genome` + `archetype` + zonas.
- El bloque `BLUEPRINTS` es el único punto de edición: cada entrada define curvas vía `pulseTrain`/`sineSweep`/`ramp`/`kf` o arrays literales de keyframes (con `bezierHandles` cuando aplique).
- Para barridos de movers usar `spatialBehavior:'relative_offset'` + `panTrack` (range `[-1,1]`) — **no** `'sweep'` (bug latente en `fx_ametralladora`).

¿Quieres que materialice el script en `electron-app/scripts/` (fase de escritura) o ajustamos primero la lista de blueprints RaveX?