#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 8279 · F6 — migrate_atoms_v2: átomos legacy → Theia 2.0 (contrato v2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Actualiza los átomos `.glsl` de `electron-app/assets/shaders/` al
 * contrato v2 del Euclid Ring (EUCLID_RING_EXPANSION_8276) SIN tocar el
 * arte central: solo se reescribe la CAPA REACTIVA, línea a línea, con
 * reglas mecánicas y trazables.
 *
 *   R1  STROBE    u_strobeGate → 0.0 · STROBE_ACTIVE → false   (Fase 5: deprecado)
 *   R2  TEL_V1    u_tel[N] (array plano v1) → macro del schema / u_tel4[k].c
 *                 · `uniform float u_tel[..];` redeclarado → eliminado
 *   R3  VOID      `if (RHYTHMIC_VOID) x *= K;` → `x *= euVoidGate(K);`
 *                 `(RHYTHMIC_VOID ? A : B)`   → `mix(B, A, euVoidAmt())`
 *                 (corte binario ≥0.75 → rampa suave centrada igual +
 *                  rebote ∝ a lo que duró el vacío vía u_voidRelease)
 *   R4  SNARE     u_snarePulse → euSnare()
 *                 (caja MACD verdadera + pulso legado atenuado por voz)
 *
 * Solo se inyectan los helpers que el átomo usa, justo tras su bloque de
 * uniforms/defines. Un marcador `Theia 2.0 · contract v2` hace la
 * migración idempotente.
 *
 * Validación (antes de escribir NADA):
 *   · ADN intacto — parseEuclidMeta(original) ≡ parseEuclidMeta(migrado)
 *   · Invariancia del arte — toda línea original que difiere fue tocada
 *     por una regla (el resto es byte-idéntico)
 *   · Contrato — mainImage canónico, cero u_tel[ / strobo en código
 *   · 🔫 WAVE 8287 · Clean Shot — geometría libre de aproximación
 *     cognitiva: prohibido u_approach/u_impact/predicción y la firma
 *     v1 de euChannels (≥4 args); movimiento base = BPM, bursts = fx
 *   · Compilación REAL — se ensambla con el ShaderAssembler del repo
 *     (preámbulo v2: UBO EuclidTel, euTimbre, pulsos) con los genes por
 *     defecto y se compila con glslangValidator (GLSL ES 3.00, pase
 *     escena + pase de simulación si hay mainState)
 *
 * Uso:
 *   node scripts/migrate_atoms_v2.js              # dry-run: plan + validación
 *   node scripts/migrate_atoms_v2.js --write      # aplica (solo lo que compila)
 *   node scripts/migrate_atoms_v2.js --check      # CI: exit 1 si algo no es v2 o no compila
 *   node scripts/migrate_atoms_v2.js --diff       # muestra las líneas cambiadas
 *   node scripts/migrate_atoms_v2.js [--dir <carpeta>] [a.glsl b.glsl …]
 *
 * Requisitos: esbuild (dependencia de electron-app). glslangValidator
 * (Vulkan SDK) para la compilación real — si falta, se avisa y se valida
 * solo la estructura (con --check es error).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = path.join(ROOT, 'electron-app')
const DEFAULT_DIR = path.join(APP, 'assets', 'shaders')

const MARKER = 'Theia 2.0 · contract v2'
const MARKER_LINE = `// ${MARKER} — migrated by scripts/migrate_atoms_v2.js (WAVE 8279)`
const MAIN_SIG = /void\s+mainImage\s*\(\s*out\s+vec4\s+\w+\s*,\s*in\s+vec2\s+\w+\s*\)/

// ─────────────────────────── CLI ───────────────────────────

const argv = process.argv.slice(2)
const opt = { write: false, check: false, diff: false, dir: DEFAULT_DIR, files: [] }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--write') opt.write = true
  else if (a === '--check') opt.check = true
  else if (a === '--diff') opt.diff = true
  else if (a === '--dir') opt.dir = path.resolve(argv[++i] ?? '.')
  else if (a === '-h' || a === '--help') {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0])
    process.exit(0)
  } else opt.files.push(path.resolve(a))
}
if (opt.write && opt.check) fail('--write y --check son excluyentes')

function fail(msg) {
  console.error(`✖ ${msg}`)
  process.exit(2)
}

// ─────────────────── ShaderAssembler real (TS del repo vía esbuild) ───────────────────

function loadAssembler() {
  const req = createRequire(path.join(APP, 'package.json'))
  let esbuild
  try {
    esbuild = req('esbuild')
  } catch {
    fail('esbuild no encontrado — ejecuta `npm install` en electron-app/')
  }
  const out = esbuild.buildSync({
    entryPoints: [path.join(APP, 'src/theia/shader/ShaderAssembler.ts')],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    logLevel: 'silent',
  })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, req)
  return mod.exports
}

function loadSchemaUniforms() {
  // slot absoluto → nombre de macro (para R2); se lee del mismo bundle.
  const req = createRequire(path.join(APP, 'package.json'))
  const esbuild = req('esbuild')
  const out = esbuild.buildSync({
    entryPoints: [path.join(APP, 'src/theia/telemetry/TheiaTelemetryRing.ts')],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    logLevel: 'silent',
  })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, req)
  const { TELEMETRY_SCHEMA, SLOT_PAYLOAD_BASE } = mod.exports
  const byIdx = new Map()
  for (const d of TELEMETRY_SCHEMA) if (d.uniform) byIdx.set(d.slot - SLOT_PAYLOAD_BASE, d.uniform)
  return byIdx
}

// ─────────────────────────── glslangValidator ───────────────────────────

function findGlslang() {
  const exe = process.platform === 'win32' ? 'glslangValidator.exe' : 'glslangValidator'
  const dirs = (process.env.PATH ?? '').split(path.delimiter)
  if (process.env.VULKAN_SDK) dirs.push(path.join(process.env.VULKAN_SDK, 'Bin'), path.join(process.env.VULKAN_SDK, 'bin'))
  if (process.platform === 'win32' && fs.existsSync('C:/VulkanSDK')) {
    for (const v of fs.readdirSync('C:/VulkanSDK').sort().reverse()) dirs.push(path.join('C:/VulkanSDK', v, 'Bin'))
  }
  for (const d of dirs) {
    const p = path.join(d, exe)
    if (d && fs.existsSync(p)) return p
  }
  return null
}

function compileGLSL(glslang, src) {
  try {
    execFileSync(glslang, ['--stdin', '-S', 'frag'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] })
    return null
  } catch (e) {
    return String(e.stdout ?? '') + String(e.stderr ?? '')
  }
}

// ─────────────────────────── Reglas ───────────────────────────

const HELPERS = {
  euVoidAmt: [
    '// Vacío rítmico v2: rampa suave sobre u_rhythmicVoid (el flag binario',
    '// RHYTHMIC_VOID era ≥0.75 — mismo centro, sin salto de fotograma).',
    'float euVoidAmt() { return smoothstep(0.6, 0.9, u_rhythmicVoid); }',
  ],
  euVoidGate: [
    '// Atenuación del vacío + rebote ∝ a lo que duró (u_voidRelease, §2.3).',
    'float euVoidGate(float k) { return mix(1.0, k, euVoidAmt()) * (1.0 + 0.6 * u_voidRelease); }',
  ],
  euSnare: [
    '// Caja v2: manda la caja MACD verdadera; el pulso legado se atenúa con',
    '// la presencia vocal (su fuente de falsos positivos). Sin página B viva',
    '// (u_vocalIsolation = 0) el pulso legado queda intacto.',
    'float euSnare() { return max(u_snareTruePulse, u_snarePulse * (1.0 - 0.7 * u_vocalIsolation)); }',
  ],
}
const HELPER_DEPS = { euVoidGate: ['euVoidAmt'] }
const HELPER_ORDER = ['euVoidAmt', 'euVoidGate', 'euSnare']

/** Separa código y comentario `//` de una línea (sin tocar strings: GLSL no tiene). */
function splitComment(line) {
  const i = line.indexOf('//')
  return i < 0 ? [line, ''] : [line.slice(0, i), line.slice(i)]
}

/** Reemplaza `u_tel[expr]` con corchetes balanceados. */
function rewriteTelV1(code, telMap, hits) {
  let out = ''
  let i = 0
  const re = /\bu_tel\s*\[/g
  let m
  while ((m = re.exec(code)) !== null) {
    let depth = 1
    let j = m.index + m[0].length
    while (j < code.length && depth > 0) {
      if (code[j] === '[') depth++
      else if (code[j] === ']') depth--
      j++
    }
    if (depth !== 0) break
    const expr = code.slice(m.index + m[0].length, j - 1).trim()
    let rep
    if (/^\d+$/.test(expr)) {
      const n = parseInt(expr, 10)
      rep = telMap.get(n) ?? `u_tel4[${n >> 2}].${'xyzw'[n & 3]}`
    } else {
      rep = `u_tel4[(${expr}) >> 2][(${expr}) & 3]`
    }
    out += code.slice(i, m.index) + rep
    i = j
    re.lastIndex = j
    hits.push(`u_tel[${expr}] → ${rep}`)
  }
  return out + code.slice(i)
}

function migrate(src, telMap) {
  const lines = src.split(/\r?\n/)
  const eol = src.includes('\r\n') ? '\r\n' : '\n'
  const touched = new Set()
  const log = []
  const used = new Set()
  const review = []

  for (let n = 0; n < lines.length; n++) {
    const [code0, comment] = splitComment(lines[n])
    let code = code0
    const hits = []

    // R2 — redeclaración del array plano v1: la línea entera sobra.
    if (/^\s*uniform\s+float\s+u_tel\s*\[[^\]]*\]\s*;\s*$/.test(code)) {
      lines[n] = `// [v2] eliminado: ${lines[n].trim()}  (el payload vive en el UBO EuclidTel)`
      touched.add(n)
      log.push({ line: n + 1, rule: 'R2', what: 'uniform u_tel[] redeclarado → eliminado' })
      continue
    }

    // R1 — estrobo deprecado (Fase 5): siempre 0 en el host.
    if (/\bu_strobeGate\b/.test(code)) {
      code = code.replace(/\bu_strobeGate\b/g, '0.0')
      hits.push('u_strobeGate → 0.0')
    }
    if (/\bSTROBE_ACTIVE\b/.test(code)) {
      code = code.replace(/\bSTROBE_ACTIVE\b/g, 'false')
      hits.push('STROBE_ACTIVE → false')
    }

    // R2 — índices planos v1.
    if (/\bu_tel\s*\[/.test(code)) code = rewriteTelV1(code, telMap, hits)

    // R3 — vacío rítmico: sentencia de corte binario.
    code = code.replace(
      /if\s*\(\s*RHYTHMIC_VOID\s*\)\s*(\w+(?:\.\w+)?)\s*\*=\s*([^;]+);/g,
      (_m, lhs, k) => {
        used.add('euVoidGate')
        hits.push(`if (RHYTHMIC_VOID) ${lhs} *= ${k.trim()} → euVoidGate`)
        return `${lhs} *= euVoidGate(${k.trim()});`
      },
    )
    // R3 — vacío rítmico: ternario con operandos simples.
    code = code.replace(
      /\(\s*RHYTHMIC_VOID\s*\?\s*([^?:()]+?)\s*:\s*([^?:()]+?)\s*\)/g,
      (_m, a, b) => {
        used.add('euVoidAmt')
        hits.push(`(RHYTHMIC_VOID ? ${a} : ${b}) → mix(…, euVoidAmt())`)
        return `mix(${b}, ${a}, euVoidAmt())`
      },
    )
    if (/\bRHYTHMIC_VOID\b/.test(code)) review.push({ line: n + 1, text: lines[n].trim() })

    // R4 — caja v2.
    if (/\bu_snarePulse\b/.test(code)) {
      const c = (code.match(/\bu_snarePulse\b/g) ?? []).length
      code = code.replace(/\bu_snarePulse\b/g, 'euSnare()')
      used.add('euSnare')
      hits.push(`u_snarePulse → euSnare() ×${c}`)
    }

    if (code !== code0) {
      lines[n] = code + comment
      touched.add(n)
      for (const h of hits) log.push({ line: n + 1, rule: ruleOf(h), what: h })
    }
  }

  // Cierre de dependencias + orden estable.
  for (const h of [...used]) for (const d of HELPER_DEPS[h] ?? []) used.add(d)
  const helpers = HELPER_ORDER.filter((h) => used.has(h))

  // Punto de inyección: tras la última línea #…/uniform del bloque de cabecera.
  let lastHeader = -1
  for (let n = 0; n < lines.length; n++) {
    const t = lines[n].trim()
    if (t === '' || t.startsWith('//')) continue
    if (t.startsWith('#') || /^uniform\s[^;]*;/.test(t)) { lastHeader = n; continue }
    break
  }
  const block = helpers.length
    ? ['', '// ── Theia 2.0 · capa reactiva v2 (inyectado por migrate_atoms_v2) ──',
       ...helpers.flatMap((h) => HELPERS[h])]
    : []

  // Marcador tras la última línea `// @euclid`.
  let lastMeta = -1
  for (let n = 0; n < lines.length; n++) if (/^\s*\/\/\s*@euclid\b/.test(lines[n])) lastMeta = n

  const outLines = []
  const injected = new Set()
  for (let n = 0; n < lines.length; n++) {
    if (n === 0 && lastMeta < 0) { injected.add(outLines.length); outLines.push(MARKER_LINE) }
    outLines.push(lines[n])
    if (n === lastMeta) { injected.add(outLines.length); outLines.push(MARKER_LINE) }
    if (n === lastHeader) for (const b of block) { injected.add(outLines.length); outLines.push(b) }
  }
  if (lastHeader < 0 && block.length) {
    // Sin cabecera de uniforms/defines: helpers justo tras el marcador.
    const at = [...injected][0] + 1
    outLines.splice(at, 0, ...block)
    const shifted = new Set([...injected].map((i) => (i >= at ? i + block.length : i)))
    injected.clear()
    for (const i of shifted) injected.add(i)
    for (let k = 0; k < block.length; k++) injected.add(at + k)
  }

  return { out: outLines.join(eol), outLines, injected, touched, log, helpers, review }
}

function ruleOf(h) {
  if (h.startsWith('u_strobeGate') || h.startsWith('STROBE')) return 'R1'
  if (h.startsWith('u_tel')) return 'R2'
  if (h.includes('RHYTHMIC_VOID')) return 'R3'
  return 'R4'
}

// ─────────────────────────── Validación ───────────────────────────

function sameMeta(A, a, b) {
  const pick = (m) => JSON.stringify({ n: m.name, f: m.family, g: m.genome, z: m.zone, p: m.params, e: m.genes, s: m.steps, sd: m.seed })
  return pick(A.parseEuclidMeta(a)) === pick(A.parseEuclidMeta(b))
}

/** Toda línea original que difiere debe haber sido tocada por una regla. */
function artInvariant(origSrc, res) {
  const orig = origSrc.split(/\r?\n/)
  const kept = res.outLines.filter((_, i) => !res.injected.has(i))
  if (kept.length !== orig.length) return `recuento de líneas del arte ${kept.length} ≠ ${orig.length}`
  for (let n = 0; n < orig.length; n++) {
    if (kept[n] !== orig[n] && !res.touched.has(n)) return `línea ${n + 1} alterada sin regla`
  }
  return null
}

function codeOnly(src) {
  return src.split(/\r?\n/).map((l) => splitComment(l)[0]).join('\n')
}

function validate(A, glslang, src) {
  const errs = []
  const code = codeOnly(src)
  if (!MAIN_SIG.test(code)) errs.push('falta `void mainImage(out vec4 c, in vec2 fragCoord)`')
  if (/\bu_tel\s*\[/.test(code)) errs.push('queda acceso plano u_tel[ (v1)')
  if (/\bu_strobeGate\b|\bSTROBE_ACTIVE\b/.test(code)) errs.push('queda estrobo deprecado en código')
  // 🔫 WAVE 8287 · Clean Shot — la geometría no puede depender de la
  // aproximación cognitiva: ni la firma v1 de euChannels ni los canales
  // de predicción/impacto. El movimiento base vive en u_beatPhase/
  // u_barPhase/u_beatTime; los bursts solo via u_activeEffectEnergy.
  if (/\beuChannels\s*\(\s*[\w.]+\s*,\s*[\w.]+\s*,\s*[\w.]+\s*,/.test(code))
    errs.push('euChannels() con firma v1 (≥4 args) — migrar a (glitch, live, groove)')
  if (/\bu_(approach|impact|predictiveETA|predictionProb|selEtaMs|selEtaBeats|seleneConfidence|tension|beauty|zScoreN|spectralBuildup|glassBreak|strobeGate)\b/.test(code))
    errs.push('canal cognitivo prohibido en átomos (Clean Shot) — usa u_activeEffectEnergy/Age para bursts')
  if (!src.includes(MARKER)) errs.push(`falta el marcador "${MARKER}"`)
  const meta = A.parseEuclidMeta(src)
  if (!meta.name) errs.push('cabecera @euclid sin name')

  let compiled = 'skip'
  if (glslang) {
    const exprGenes = A.layoutExprGenes(meta)
    const genes = A.resolveGeneValues(meta)
    const steps = meta.steps ?? A.DEFAULT_MAX_STEPS
    const passes = [['escena', A.assembleFragmentShader(src, steps, genes, exprGenes)]]
    if (A.hasMainState(src)) passes.push(['sim', A.assembleSimFragmentShader(src, steps, genes, exprGenes)])
    compiled = passes.map((p) => p[0]).join('+')
    for (const [name, asm] of passes) {
      const raw = compileGLSL(glslang, asm.fragSource)
      if (raw) {
        const { log } = A.remapShaderLog(raw, asm.preambleLines, asm.bodyLines)
        const first = log.split('\n').filter((l) => /ERROR/.test(l)).slice(0, 4).join('\n      ')
        errs.push(`GLSL (${name}) no compila:\n      ${first}`)
        compiled = 'FAIL'
      }
    }
  }
  return { errs, compiled }
}

// ─────────────────────────── Main ───────────────────────────

const A = loadAssembler()
const telMap = loadSchemaUniforms()
const glslang = findGlslang()

const files = opt.files.length
  ? opt.files
  : fs.readdirSync(opt.dir).filter((f) => f.endsWith('.glsl')).sort().map((f) => path.join(opt.dir, f))
if (files.length === 0) fail(`no hay .glsl en ${opt.dir}`)

const mode = opt.write ? 'WRITE' : opt.check ? 'CHECK' : 'DRY-RUN'
console.log(`\n🌊 migrate_atoms_v2 · ${mode} · ${files.length} átomos · ${path.relative(ROOT, opt.dir) || '.'}`)
console.log(glslang
  ? `   compilación real: ${glslang}`
  : '   ⚠ glslangValidator no encontrado — solo validación estructural (instala el Vulkan SDK)')
console.log('')

let bad = 0
let pending = 0
let written = 0
for (const file of files) {
  const name = path.basename(file)
  const src = fs.readFileSync(file, 'utf8')
  const already = src.includes(MARKER)

  if (already) {
    const v = validate(A, glslang, src)
    const ok = v.errs.length === 0
    if (!ok) bad++
    console.log(`${ok ? '✔' : '✖'} ${name.padEnd(26)} ya v2 · glsl:${v.compiled}`)
    for (const e of v.errs) console.log(`    ✖ ${e}`)
    continue
  }

  pending++
  const res = migrate(src, telMap)
  const errs = []
  if (!sameMeta(A, src, res.out)) errs.push('el ADN @euclid cambió (abortado)')
  const inv = artInvariant(src, res)
  if (inv) errs.push(`invariancia del arte: ${inv}`)
  const v = validate(A, glslang, res.out)
  errs.push(...v.errs)
  if (glslang && !opt.check) {
    // Referencia: ¿compilaba el original? (diagnóstico, no bloquea).
    const orig = validate(A, glslang, `${MARKER_LINE}\n${src}`)
    if (orig.compiled === 'FAIL') console.log(`    ℹ ${name}: el ORIGINAL tampoco compilaba`)
  }

  const counts = res.log.reduce((m, l) => ((m[l.rule] = (m[l.rule] ?? 0) + 1), m), {})
  const summary = Object.entries(counts).map(([r, c]) => `${r}×${c}`).join(' ') || 'solo marcador'
  const ok = errs.length === 0
  if (!ok) bad++
  let action = opt.check ? 'PENDIENTE' : 'plan'
  if (opt.write && ok) {
    fs.writeFileSync(file, res.out)
    written++
    action = 'escrito'
  } else if (opt.write) action = 'NO escrito'
  console.log(`${ok ? '✔' : '✖'} ${name.padEnd(26)} ${action.padEnd(10)} ${summary.padEnd(16)} helpers:[${res.helpers.join(', ')}] glsl:${v.compiled}`)
  for (const e of errs) console.log(`    ✖ ${e}`)
  for (const r of res.review) console.log(`    ⚠ revisión manual L${r.line}: ${r.text}`)
  if (opt.diff) {
    const orig = src.split(/\r?\n/)
    for (const n of [...res.touched].sort((a, b) => a - b)) {
      console.log(`    L${String(n + 1).padStart(3)} - ${orig[n].trim()}`)
      console.log(`         + ${res.outLines.filter((_, i) => !res.injected.has(i))[n].trim()}`)
    }
  }
}

console.log('')
if (opt.write) console.log(`→ ${written}/${pending} migrados · ${bad} con errores`)
else if (opt.check) console.log(`→ ${pending} sin migrar · ${bad} con errores`)
else console.log(`→ ${pending} por migrar · ${bad} con errores · ejecuta con --write para aplicar`)

if (opt.check) process.exit(pending > 0 || bad > 0 || !glslang ? 1 : 0)
process.exit(bad > 0 ? 1 : 0)
