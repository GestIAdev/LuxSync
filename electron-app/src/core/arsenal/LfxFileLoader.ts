// ════════════════════════════════════════════════════════════════════════════
// 🏛️ WAVE 2483 — INFINITE ARSENAL · LFX FILE LOADER
// ════════════════════════════════════════════════════════════════════════════
//  Servicio de carga física de `.lfx v2.1` desde disco hacia el Registry.
//
//  RESPONSABILIDAD ÚNICA:
//    - Escanear directorios designados (/builtin-effects/, /user-effects/).
//    - Parsear JSON + validar gates G2..G7.
//    - Inyectar entries válidas en el DynamicEffectRegistry.
//    - Trabaja en el main process (fs.promises). NO debe importarse desde
//      renderer code.
//
//  POLÍTICA DE FALLO SILENCIOSO (DIRECTIVA WAVE 2483):
//    Un `.lfx` malformado, malicioso o con safety-decl inconsistente
//    NO debe crashear el cargador ni provocar UI errors. Se loggea y
//    se descarta. El sistema sigue funcionando con `legacy` siempre.
// ════════════════════════════════════════════════════════════════════════════

import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'

import {
  getDynamicEffectRegistry,
  type DynamicEffectRegistry,
  type RegisterOptions,
} from './DynamicEffectRegistry'
import {
  isSeleneEligible,
  type CognitiveDNA,
  type LFXFileV3,
  type LfxClipV2,
  type SafetyDeclaration,
  type SpatialBehavior,
} from './lfxTypes'
import type { HephCurve } from '../hephaestus/types'

// ─── CONFIGURACIÓN ──────────────────────────────────────────────────────────

/** Origen del directorio — afecta la severidad de los gates. */
export type EffectSource = 'builtin' | 'user'

export interface DirectorySpec {
  readonly absolutePath: string
  readonly source: EffectSource
}

/** Resultado agregado de una pasada de carga. */
export interface LoadReport {
  readonly scanned: number
  readonly accepted: number
  readonly rejected: number
  readonly errors: number
  readonly entries: readonly string[] // ids aceptados
}

/** Política de safety aplicada a archivos `user`. */
const USER_SAFETY_POLICY = Object.freeze({
  /** Aggression máxima permitida en clips de comunidad. */
  MAX_AGGRESSION: 0.95,
  /** Frecuencia de strobe declarable máxima (Hz). */
  MAX_STROBE_HZ: 25,
  /** Tamaño máximo de archivo (bytes). 256KB de holgura. */
  MAX_FILE_SIZE_BYTES: 256 * 1024,
})

/** Valores válidos de textureAffinity en CognitiveDNA. */
const VALID_TEXTURE_AFFINITIES = new Set<string>(['clean', 'dirty', 'universal'])

// ─── LOADER ─────────────────────────────────────────────────────────────────

export class LfxFileLoader {
  private readonly _registry: DynamicEffectRegistry

  constructor(registry?: DynamicEffectRegistry) {
    this._registry = registry ?? getDynamicEffectRegistry()
  }

  /**
   * Carga TODOS los `.lfx` desde múltiples directorios.
   *
   * Ejecución secuencial (NO paralelo): el registry no es thread-safe y
   * la lectura de filesystem suele ser I/O-bound; el coste extra es
   * marginal y simplifica el código.
   *
   * Si un directorio no existe, se ignora silenciosamente — útil para
   * arrancar sin `/user-effects/` creado todavía.
   */
  public async loadAll(directories: readonly DirectorySpec[]): Promise<LoadReport> {
    let scanned = 0
    let accepted = 0
    let rejected = 0
    let errors = 0
    const entries: string[] = []

    for (const spec of directories) {
      const dirReport = await this._loadDirectory(spec)
      scanned += dirReport.scanned
      accepted += dirReport.accepted
      rejected += dirReport.rejected
      errors += dirReport.errors
      for (const id of dirReport.entries) entries.push(id)
    }

    console.log(
      `[LfxFileLoader 🏛️] Scan complete: scanned=${scanned} accepted=${accepted} ` +
      `rejected=${rejected} errors=${errors}`,
    )

    return Object.freeze({ scanned, accepted, rejected, errors, entries })
  }

  /** Carga un único `.lfx` (útil para hot-reload o ingesta drag-and-drop). */
  public async loadFile(filePath: string, source: EffectSource): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath)
      if (!stats.isFile()) return false
      if (source === 'user' && stats.size > USER_SAFETY_POLICY.MAX_FILE_SIZE_BYTES) {
        console.warn(
          `[LfxFileLoader ⚠️] G2 fail: file too large (${stats.size}B) at ${filePath}`,
        )
        return false
      }

      const raw = await fs.readFile(filePath, 'utf-8')

      // Peek del schema para routing: V2.1 legacy vs V3 nativo
      let schemaHint: string | null = null
      try {
        const peeked = JSON.parse(raw) as Record<string, unknown>
        schemaHint = typeof peeked?.$schema === 'string' ? peeked.$schema : null
      } catch { /* JSON inválido — el parser lo reportará */ }

      const opts: RegisterOptions = {
        filePath,
        isBuiltin: source === 'builtin',
        keepSource: false,
      }

      if (schemaHint === 'luxsync.lfx/3.0') {
        const v3 = this._parseAndValidateV3(raw, filePath, source)
        if (!v3) return false
        const entry = this._registry.registerEffectV3(v3, opts)
        return entry !== null
      }

      const result = this._parseAndValidate(raw, filePath, source)
      if (!result) return false
      const entry = this._registry.registerEffect(result, opts)
      return entry !== null
    } catch (err) {
      console.warn(`[LfxFileLoader ⚠️] read/parse failed for ${filePath}:`, err)
      return false
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────────────────────────────────

  private async _loadDirectory(spec: DirectorySpec): Promise<LoadReport> {
    const entries: string[] = []
    let scanned = 0, accepted = 0, rejected = 0, errors = 0

    if (!fsSync.existsSync(spec.absolutePath)) {
      console.log(`[LfxFileLoader 🏛️] Directory not present: ${spec.absolutePath} (skip)`)
      return Object.freeze({ scanned: 0, accepted: 0, rejected: 0, errors: 0, entries: [] })
    }

    let dirEntries: import('fs').Dirent[]
    try {
      dirEntries = await fs.readdir(spec.absolutePath, { withFileTypes: true })
    } catch (err) {
      console.warn(`[LfxFileLoader ⚠️] readdir failed for ${spec.absolutePath}:`, err)
      return Object.freeze({ scanned: 0, accepted: 0, rejected: 0, errors: 1, entries: [] })
    }

    for (const dirent of dirEntries) {
      if (!dirent.isFile()) continue
      if (!dirent.name.toLowerCase().endsWith('.lfx')) continue
      scanned++

      const filePath = path.join(spec.absolutePath, dirent.name)
      try {
        const ok = await this.loadFile(filePath, spec.source)
        if (ok) {
          accepted++
          entries.push(filePath)
        } else {
          rejected++
        }
      } catch (err) {
        errors++
        console.warn(`[LfxFileLoader ⚠️] error loading ${filePath}:`, err)
      }
    }

    return Object.freeze({ scanned, accepted, rejected, errors, entries })
  }

  /**
   * Parsea + valida gates G2/G5/G6/G7 + safety policy.
   * Retorna el clip listo para registry, o null si fue rechazado.
   *
   * GATES (orden de ejecución):
   *   G2: checksum integrity (si el archivo declara `checksum`).
   *   G5: curve sanity (curvas no vacías, valores numéricos finitos).
   *   G6: strobe-rate cross-check (declaración vs. curva intensity).
   *   G7: relative_offset sanity (rangos válidos).
   *   USER POLICY: aggression ≤ 0.95, maxStrobeFreqHz ≤ 25.
   */
  private _parseAndValidate(
    raw: string,
    filePath: string,
    source: EffectSource,
  ): LfxClipV2 | null {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.warn(`[LfxFileLoader ⚠️] JSON parse fail at ${filePath}:`, err)
      return null
    }

    const clip = parsed as Partial<LfxClipV2>
    if (!_isStructurallyValid(clip)) {
      console.warn(`[LfxFileLoader ⚠️] Schema fail at ${filePath}: missing required fields`)
      return null
    }

    // Cast seguro tras structural check — TS narrowing no llega tan profundo.
    const validated = clip as LfxClipV2
    if (!isSeleneEligible(validated)) {
      // Clip Hephaestus puro (v1) — no es Selene-eligible. No es error;
      // simplemente no entra al Infinite Arsenal. Lo descartamos.
      return null
    }

    // ── G2: Checksum integrity ─────────────────────────────────────────────
    if (!_validateChecksum(validated, raw, filePath)) {
      console.warn(`[LfxFileLoader ⚠️] G2 fail: checksum mismatch at ${filePath}`)
      return null
    }

    // ── G5: Curve sanity ───────────────────────────────────────────────────
    if (!_validateCurves(validated.clip.curves)) {
      console.warn(`[LfxFileLoader ⚠️] G5 fail: curve sanity at ${filePath}`)
      return null
    }

    const dna: CognitiveDNA = validated.clip.cognitiveDNA!
    const safetyDecl: SafetyDeclaration | undefined = validated.clip.safetyDeclaration

    // ── G6: Strobe-rate consistency ────────────────────────────────────────
    if (safetyDecl && !_validateStrobeDeclaration(validated.clip.curves, safetyDecl)) {
      console.warn(`[LfxFileLoader ⚠️] G6 fail: strobe declaration mismatch at ${filePath}`)
      return null
    }

    // ── G7: relative_offset rangos coherentes ──────────────────────────────
    if (!_validateSpatialRanges(validated.clip.curves, dna.spatialBehavior)) {
      console.warn(`[LfxFileLoader ⚠️] G7 fail: spatial range mismatch at ${filePath}`)
      return null
    }

    // ── USER POLICY (sólo `/user-effects/`) ────────────────────────────────
    if (source === 'user') {
      if (dna.genome.aggression > USER_SAFETY_POLICY.MAX_AGGRESSION) {
        console.warn(
          `[LfxFileLoader ⚠️] USER policy: aggression=${dna.genome.aggression} > ` +
          `${USER_SAFETY_POLICY.MAX_AGGRESSION} at ${filePath} — rejected`,
        )
        return null
      }
      const declaredHz = safetyDecl?.maxStrobeFreqHz ?? 0
      if (declaredHz > USER_SAFETY_POLICY.MAX_STROBE_HZ) {
        console.warn(
          `[LfxFileLoader ⚠️] USER policy: strobeFreq=${declaredHz}Hz > ` +
          `${USER_SAFETY_POLICY.MAX_STROBE_HZ}Hz at ${filePath} — rejected`,
        )
        return null
      }
    }

    return validated
  }

  /**
   * Parsea + valida un clip `.lfx v3.0` nativo.
   *
   * GATES:
   *   Struct: id, name, author, category, tags, vibeCompat, durationMs, effectType, tracks[].
   *   G5: cada track tiene zones[] y curve.keyframes[] no vacíos.
   *   DNA: genome ∈ [0,1], compatibleVibes, textureAffinity válida.
   *   G2: checksum SHA-256 sobre clip (si declarado y no vacío).
   *   USER: aggression ≤ 0.95.
   *
   * `curves{}` NO es requerido. `staticParams`, `mixBus`, `priority` opcionales.
   */
  private _parseAndValidateV3(
    raw: string,
    filePath: string,
    source: EffectSource,
  ): LFXFileV3 | null {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.warn(`[LfxFileLoader ⚠️] V3 JSON parse fail at ${filePath}`)
      return null
    }

    const wrapper = parsed as Record<string, unknown>
    const clip = wrapper.clip as Record<string, unknown> | undefined
    if (!clip || typeof clip !== 'object') {
      console.warn(`[LfxFileLoader ⚠️] V3 struct fail: missing clip at ${filePath}`)
      return null
    }

    // ── Estructura mínima ─────────────────────────────────────────────────
    if (typeof clip.id !== 'string' || clip.id.length === 0) {
      console.warn(`[LfxFileLoader ⚠️] V3 struct fail: id at ${filePath}`); return null
    }
    if (typeof clip.name !== 'string') {
      console.warn(`[LfxFileLoader ⚠️] V3 struct fail: name at ${filePath}`); return null
    }
    if (typeof clip.author !== 'string') {
      console.warn(`[LfxFileLoader ⚠️] V3 struct fail: author at ${filePath}`); return null
    }
    if (typeof clip.category !== 'string') {
      console.warn(`[LfxFileLoader ⚠️] V3 struct fail: category at ${filePath}`); return null
    }
    if (!Array.isArray(clip.tags)) {
      console.warn(`[LfxFileLoader ⚠️] V3 struct fail: tags at ${filePath}`); return null
    }
    if (!Array.isArray(clip.vibeCompat) || clip.vibeCompat.length === 0) {
      console.warn(`[LfxFileLoader ⚠️] V3 struct fail: vibeCompat at ${filePath}`); return null
    }
    if (typeof clip.durationMs !== 'number' || !Number.isFinite(clip.durationMs) || clip.durationMs <= 0) {
      console.warn(`[LfxFileLoader ⚠️] V3 struct fail: durationMs at ${filePath}`); return null
    }
    if (typeof clip.effectType !== 'string') {
      console.warn(`[LfxFileLoader ⚠️] V3 struct fail: effectType at ${filePath}`); return null
    }

    // ── G5: tracks[] con al menos 1 track válido ──────────────────────────
    if (!Array.isArray(clip.tracks) || clip.tracks.length === 0) {
      console.warn(`[LfxFileLoader ⚠️] V3 G5 fail: missing/empty tracks at ${filePath}`)
      return null
    }
    for (const t of clip.tracks as Record<string, unknown>[]) {
      if (!t || typeof t !== 'object') {
        console.warn(`[LfxFileLoader ⚠️] V3 G5 fail: invalid track at ${filePath}`); return null
      }
      if (!Array.isArray(t.zones) || t.zones.length === 0) {
        console.warn(`[LfxFileLoader ⚠️] V3 G5 fail: track '${t.id}' has no zones at ${filePath}`); return null
      }
      const curve = t.curve as Record<string, unknown> | undefined
      if (!curve || typeof curve !== 'object') {
        console.warn(`[LfxFileLoader ⚠️] V3 G5 fail: track '${t.id}' missing curve at ${filePath}`); return null
      }
      if (!Array.isArray(curve.keyframes) || curve.keyframes.length === 0) {
        console.warn(`[LfxFileLoader ⚠️] V3 G5 fail: track '${t.id}' no keyframes at ${filePath}`); return null
      }
    }

    // ── cognitiveDNA ──────────────────────────────────────────────────────
    // Sin DNA el clip no entra al arsenal de Selene — lo pasamos al registry
    // que devuelve null silenciosamente. No es error del archivo.
    const rawDna = clip.cognitiveDNA as Record<string, unknown> | undefined
    if (rawDna) {
      const genome = rawDna.genome as Record<string, unknown> | undefined
      if (!genome || typeof genome !== 'object') {
        console.warn(`[LfxFileLoader ⚠️] V3 DNA fail: genome at ${filePath}`); return null
      }
      for (const k of ['aggression', 'chaos', 'organicity']) {
        const v = (genome as Record<string, unknown>)[k]
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
          console.warn(`[LfxFileLoader ⚠️] V3 DNA fail: genome.${k} at ${filePath}`); return null
        }
      }
      if (!Array.isArray(rawDna.compatibleVibes) || rawDna.compatibleVibes.length === 0) {
        console.warn(`[LfxFileLoader ⚠️] V3 DNA fail: compatibleVibes at ${filePath}`); return null
      }
      if (!VALID_TEXTURE_AFFINITIES.has(rawDna.textureAffinity as string)) {
        console.warn(`[LfxFileLoader ⚠️] V3 DNA fail: textureAffinity '${rawDna.textureAffinity}' at ${filePath}`)
        return null
      }
    }

    // ── USER policy ───────────────────────────────────────────────────────
    if (source === 'user' && rawDna) {
      const genome = rawDna.genome as Record<string, number>
      if (genome.aggression > USER_SAFETY_POLICY.MAX_AGGRESSION) {
        console.warn(`[LfxFileLoader ⚠️] USER policy: V3 aggression=${genome.aggression} at ${filePath}`)
        return null
      }
    }

    // ── G2: Checksum opcional ─────────────────────────────────────────────
    const checksum = typeof wrapper.checksum === 'string' ? wrapper.checksum : ''
    if (checksum.length > 0) {
      try {
        const canonical = JSON.stringify(clip)
        const hash = createHash('sha256').update(canonical).digest('hex')
        const declared = checksum.startsWith('sha256:') ? checksum.slice(7) : checksum
        if (hash !== declared) {
          console.warn(`[LfxFileLoader ⚠️] V3 G2 fail: checksum mismatch at ${filePath}`)
          return null
        }
      } catch {
        console.warn(`[LfxFileLoader ⚠️] V3 G2 fail: checksum compute error at ${filePath}`)
        return null
      }
    }

    // ── Ensamblar LFXFileV3 tipado ────────────────────────────────────────
    const v3File: LFXFileV3 = {
      $schema: 'luxsync.lfx/3.0',
      checksum,
      clip: {
        id: clip.id as string,
        name: clip.name as string,
        author: clip.author as string,
        category: clip.category as string,
        tags: clip.tags as string[],
        vibeCompat: clip.vibeCompat as string[],
        durationMs: clip.durationMs as number,
        effectType: clip.effectType as string,
        tracks: clip.tracks as import('../hephaestus/types').HephTrack[],
        cognitiveDNA: (clip.cognitiveDNA as any) || undefined,
        simulationMeta: (clip.simulationMeta as any) || undefined,
        schemaVersion: '3.0',
        staticParams: (clip.staticParams as Record<string, unknown>) ?? {},
        spatialZones: (clip.spatialZones as string[]) ?? [],
        mixBus: (clip.mixBus as 'global' | 'htp' | 'ambient' | 'accent') ?? 'htp',
        priority: typeof clip.priority === 'number' ? clip.priority : 70,
      } as import('../hephaestus/types').HephAutomationClipV3,
    }

    console.log(`[LfxFileLoader 🏛️] V3 accepted: ${clip.id} at ${filePath}`)
    return v3File
  }
}

// ─── VALIDADORES PRIVADOS ───────────────────────────────────────────────────

function _isStructurallyValid(clip: Partial<LfxClipV2>): boolean {
  if (!clip || typeof clip !== 'object') return false
  if (clip.$schema !== 'hephaestus/v2.1') return false
  if (typeof clip.version !== 'string') return false
  if (typeof clip.checksum !== 'string') return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = clip.clip as any
  if (!c || typeof c !== 'object') return false
  if (typeof c.id !== 'string' || c.id.length === 0) return false
  if (typeof c.name !== 'string') return false
  if (typeof c.author !== 'string') return false
  if (typeof c.category !== 'string') return false
  if (typeof c.mixBus !== 'string') return false
  if (typeof c.priority !== 'number' || !Number.isFinite(c.priority)) return false
  if (typeof c.durationMs !== 'number' || !Number.isFinite(c.durationMs) || c.durationMs <= 0) return false
  if (typeof c.effectType !== 'string') return false
  if (!c.curves || typeof c.curves !== 'object') return false
  if (!c.staticParams || typeof c.staticParams !== 'object') return false
  if (!Array.isArray(c.tags)) return false
  if (!Array.isArray(c.vibeCompat)) return false
  if (!Array.isArray(c.zones)) return false
  return true
}

/**
 * G2: Si el clip declara un checksum SHA-256 sobre `clip` (sin el campo
 * checksum en sí), recalculamos y comparamos. Si no declara checksum,
 * el gate se considera satisfecho (los builtin firmados deben declararlo;
 * los user no necesariamente).
 */
function _validateChecksum(clip: LfxClipV2, _raw: string, _filePath: string): boolean {
  if (!clip.checksum || clip.checksum.length === 0) return true
  try {
    const canonical = JSON.stringify(clip.clip)
    const hash = createHash('sha256').update(canonical).digest('hex')
    // Los archivos .lfx declaran el formato "sha256:<hex>" — normalizar antes de comparar.
    const declaredHash = clip.checksum.startsWith('sha256:')
      ? clip.checksum.slice(7)
      : clip.checksum
    return hash === declaredHash
  } catch {
    return false
  }
}

function _validateCurves(curves: Readonly<Record<string, HephCurve>>): boolean {
  const keys = Object.keys(curves)
  if (keys.length === 0) return false
  for (const k of keys) {
    const curve = curves[k]
    if (!curve || typeof curve !== 'object') return false
    if (curve.valueType !== 'number' && curve.valueType !== 'color') return false
    if (!Array.isArray(curve.range) || curve.range.length !== 2) return false
    const [lo, hi] = curve.range
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return false
  }
  return true
}

/**
 * G6: Si `safetyDecl.maxStrobeFreqHz > 0` debe haber una curva `intensity`
 * o `strobe` real; si declara strobe-free (0Hz), no debe haber `strobe`.
 * No medimos la frecuencia exacta — heurística simple y honest by-design.
 */
function _validateStrobeDeclaration(
  curves: Readonly<Record<string, HephCurve>>,
  decl: SafetyDeclaration,
): boolean {
  const hasStrobeCurve = curves['strobe'] != null
  if (decl.maxStrobeFreqHz > 0 && !hasStrobeCurve && !curves['intensity']) {
    return false
  }
  if (decl.maxStrobeFreqHz === 0 && hasStrobeCurve) {
    // Tiene curva strobe pero declaró 0Hz — inconsistente.
    return false
  }
  return true
}

/**
 * G7: Cuando `spatialBehavior === 'relative_offset'`, las curvas pan/tilt
 * (si existen) deben tener un range razonable. Aceptamos:
 *   - [0, 1]   → la convención estándar (0.5 = neutral)
 *   - [-1, 1]  → autoría avanzada con offset directo
 * Cualquier otro range se rechaza.
 *
 * Para `absolute` y `static`, los rangos pan/tilt deben ser [0,1].
 */
function _validateSpatialRanges(
  curves: Readonly<Record<string, HephCurve>>,
  behavior: SpatialBehavior,
): boolean {
  for (const param of ['pan', 'tilt']) {
    const curve = curves[param]
    if (!curve) continue
    const [lo, hi] = curve.range
    if (behavior === 'relative_offset') {
      const isStandard = lo === 0 && hi === 1
      const isExplicitOffset = lo === -1 && hi === 1
      if (!isStandard && !isExplicitOffset) return false
    } else {
      if (lo !== 0 || hi !== 1) return false
    }
  }
  return true
}

// ─── SINGLETON ──────────────────────────────────────────────────────────────

let _instance: LfxFileLoader | null = null

export function getLfxFileLoader(): LfxFileLoader {
  if (_instance == null) _instance = new LfxFileLoader()
  return _instance
}

export function __resetLfxFileLoaderForTests(): void {
  _instance = null
}
