/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 WAVE 8201 — EXPORT SANITIZER (The Diplomat)
 *
 * Middleware PURO pre-save: `AsteriaProject → tracks ast_*` producen curvas
 * V3-válidas, pero el clip hereda metadata inválida del template
 * (WAVE 8200 — Gap Analysis):
 *
 *   P1 · `track.zones` puede llevar zoneIds sub-canónicos del atlas
 *        ('front-left', 'back-right'…) — fuera de `ZoneTarget` y, peor,
 *        `resolveZone` los normaliza a 'unassigned' → targeting muerto.
 *        `clip.spatialZones` jamás se recomputa tras `injectAstTracks`
 *        (stale summary → pool de preview erróneo, useHephPreview:330).
 *
 *   P2 · `DEFAULT_COGNITIVE_DNA` (NewClipModal) declara
 *        `energyZone {ambient→peak}` = span 5 → **G4 fail** (máx. 2), y
 *        `compatibleVibes`/`validSections` vacíos → rechazo silencioso en
 *        `DynamicEffectRegistry.registerEffectV3` (G4: vibes ≠ ∅).
 *
 * Doctrina: patch-time, sin Electron, cero mutación del input. Nada que
 * no pase `evaluateGates` debe llegar al IPC `heph:save` ni a
 * `userData/arsenal`.
 *
 * @module core/hephaestus/exportSanitizer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  HephAutomationClipV3,
  HephTrack,
  ZoneTarget,
} from './types'
import {
  CANONICAL_ZONES,
  normalizeZone,
} from '../stage/ShowFileV2'
import { normalizeZoneId } from '../aether/adapters/zoneUtils'
import {
  ARCHETYPE_BIAS_MAP,
  ENERGY_ZONES,
  type EnergyZoneId,
} from '../arsenal/LfxClipInstance'
import type { CognitiveDNA } from '../arsenal/lfxTypes'

// ─── RESULTADO ──────────────────────────────────────────────────────────────

export interface ExportSanitizeResult {
  /** Clip saneado, listo para `serializeHephClip` → `heph:save`. */
  readonly clip: HephAutomationClipV3
  /** Notas de saneamiento aplicadas (para consola / saveMessage). */
  readonly notes: readonly string[]
}

// ─── HIGIENE ESPACIAL (M1) ──────────────────────────────────────────────────

/** Targets válidos del contrato V3: las 9 canónicas + helpers de grupo. */
const VALID_ZONE_TARGETS: ReadonlySet<string> = new Set<string>([
  ...CANONICAL_ZONES,
  'all',
  'all-pars',
  'all-movers',
])

/**
 * Mapea un tag de zona arbitrario a un `ZoneTarget` estricto.
 *
 * Cadena: ya-válido → normalizeZoneId (aliases aether/legacy kebab) →
 * sufijo lateral ('front-left' → 'front') → normalizeZone (legacy V1/V2) →
 * 'unassigned' (zona muerta honesta — jamás 'all': una zona irreconocible
 * no debe inundar el rig entero).
 */
function sanitizeTrackZone(raw: string): ZoneTarget {
  const z = String(raw).trim().toLowerCase()
  if (VALID_ZONE_TARGETS.has(z)) return z as ZoneTarget

  const n = normalizeZoneId(z)
  if (VALID_ZONE_TARGETS.has(n)) return n as ZoneTarget

  // Sub-zona lateral ('front-left', 'back-right'…) → padre canónico.
  // Mejor ensanchar al padre que caer al pool 'unassigned' (misroute vivo).
  const m = /^(.+)-(left|right)$/.exec(n)
  if (m && (CANONICAL_ZONES as readonly string[]).includes(m[1])) {
    return m[1] as ZoneTarget
  }

  const c = normalizeZone(n)
  if (c !== 'unassigned') return c as ZoneTarget
  return 'unassigned' as ZoneTarget
}

/** Zonas de track saneadas + dedupe, preservando orden de aparición. */
function sanitizeTrackZones(zones: readonly string[]): ZoneTarget[] {
  const seen = new Set<string>()
  const out: ZoneTarget[] = []
  for (const raw of zones) {
    const z = sanitizeTrackZone(raw)
    if (!seen.has(z)) {
      seen.add(z)
      out.push(z)
    }
  }
  return out.length > 0 ? out : ['all']
}

/**
 * Unión de zonas sobre todos los tracks, orden canónico
 * (CANONICAL_ZONES primero, helpers al final) — el resumen `spatialZones`
 * que el V3 declara y el preview consume.
 */
function unionSpatialZones(tracks: readonly HephTrack[]): ZoneTarget[] {
  const seen = new Set<string>()
  for (const t of tracks) for (const z of t.zones) seen.add(z)
  const order = (z: string): number => {
    const i = (CANONICAL_ZONES as readonly string[]).indexOf(z)
    return i >= 0 ? i : CANONICAL_ZONES.length + (z === 'all' ? 0 : 1)
  }
  return [...seen].sort((a, b) => order(a) - order(b)) as ZoneTarget[]
}

// ─── PASAPORTE SELENE (M2) ──────────────────────────────────────────────────

/** Ventana energética de emergencia cuando el arquetipo no guía. */
const FALLBACK_ENERGY_WINDOW = { min: 'active', max: 'intense' } as const

/** Vibe genérica para clips sin afinidad declarada (el bridged "ambiental"). */
const GENERIC_VIBE = 'chill-lounge'

/** Secciones musicales por zona energética (vocabulario de los builtins). */
const ZONE_SECTIONS: Readonly<Record<EnergyZoneId, readonly string[]>> = {
  silence:  ['intro', 'breakdown', 'outro'],
  valley:   ['intro', 'breakdown', 'outro'],
  ambient:  ['intro', 'verse', 'breakdown'],
  gentle:   ['verse', 'breakdown'],
  active:   ['verse', 'build', 'chorus'],
  intense:  ['build', 'drop', 'chorus'],
  peak:     ['drop', 'chorus'],
}

/** Span del rango energético en el termómetro ENERGY_ZONES (−1 si inválido). */
function energyZoneSpan(dna: CognitiveDNA): number {
  const lo = ENERGY_ZONES.indexOf(dna.energyZone.min as EnergyZoneId)
  const hi = ENERGY_ZONES.indexOf(dna.energyZone.max as EnergyZoneId)
  if (lo < 0 || hi < 0 || hi < lo) return -1
  return hi - lo + 1
}

/**
 * Ventana ≤2 zonas para G4. Origen: `defaultZones` del arquetipo
 * (sesión bias — divine→[peak], ambient→[valley,ambient]…); si su rango
 * aún excede 2 (utility lleva 3), se toma la cola — la zona dominante
 * alta, donde el efecto realmente importa. Sin arquetipo → fallback.
 */
function clampEnergyWindow(
  dna: CognitiveDNA,
): { min: EnergyZoneId; max: EnergyZoneId } {
  const defaults =
    ARCHETYPE_BIAS_MAP[dna.archetype ?? 'utility']?.defaultZones ??
    ARCHETYPE_BIAS_MAP.utility.defaultZones
  if (defaults && defaults.length > 0) {
    const tail = defaults.slice(-2) // dominante: la cola más energética
    return {
      min: tail[0] as EnergyZoneId,
      max: tail[tail.length - 1] as EnergyZoneId,
    }
  }
  return { ...FALLBACK_ENERGY_WINDOW }
}

/** Secciones derivadas de la ventana energética ya saneada. */
function sectionsForWindow(min: EnergyZoneId, max: EnergyZoneId): string[] {
  const lo = ENERGY_ZONES.indexOf(min)
  const hi = ENERGY_ZONES.indexOf(max)
  const out = new Set<string>()
  for (let i = lo; i <= hi && i < ENERGY_ZONES.length; i++) {
    for (const s of ZONE_SECTIONS[ENERGY_ZONES[i]]) out.add(s)
  }
  return out.size > 0 ? [...out] : ['verse', 'chorus']
}

/**
 * Sanea el `cognitiveDNA` existente para que pase G4 (renderer + registry):
 *   - `energyZone` span → ≤ 2 (Montecarlo).
 *   - `compatibleVibes` vacío → vibe genérica + `visibility:'manual_only'`
 *     (honesto: sin afinidad declarada, Selene lo cataloga pero jamás lo
 *     auto-selecciona — disparo manual/MIDI/Chronos sigue abierto).
 *   - `validSections` vacío → secciones derivadas de la ventana energética.
 */
function sanitizeCognitiveDNA(
  dna: CognitiveDNA,
  notes: string[],
): CognitiveDNA {
  let energyZone = dna.energyZone
  const span = energyZoneSpan(dna)
  if (span < 0 || span > 2) {
    energyZone = clampEnergyWindow(dna)
    notes.push(
      `G4: energyZone ${dna.energyZone.min}→${dna.energyZone.max} ` +
      `(span ${span < 0 ? 'inválido' : span}) → ${energyZone.min}→${energyZone.max}`,
    )
  }

  let compatibleVibes = dna.compatibleVibes
  let visibility = dna.visibility
  if (compatibleVibes.length === 0) {
    compatibleVibes = [GENERIC_VIBE]
    if (visibility === undefined) {
      visibility = 'manual_only'
      notes.push(
        `G4: compatibleVibes vacío → '${GENERIC_VIBE}' + visibility 'manual_only'`,
      )
    } else {
      notes.push(`G4: compatibleVibes vacío → '${GENERIC_VIBE}'`)
    }
  }

  let validSections = dna.validSections
  if (validSections.length === 0) {
    validSections = sectionsForWindow(
      energyZone.min as EnergyZoneId,
      energyZone.max as EnergyZoneId,
    )
    notes.push(`G4: validSections vacío → [${validSections.join(', ')}]`)
  }

  if (
    energyZone === dna.energyZone &&
    compatibleVibes === dna.compatibleVibes &&
    validSections === dna.validSections
  ) {
    return dna
  }

  return {
    ...dna,
    energyZone,
    compatibleVibes,
    validSections,
    visibility,
  }
}

// ─── API ────────────────────────────────────────────────────────────────────

/**
 * Sanea un clip para exportación `.lfx` V3-estricta. Función pura:
 * el input jamás muta; el output comparte estructura intacta.
 *
 * NO toca curvas/keyframes (P1 confirmó que son V3-válidas) ni el
 * envelope `clip.asteria` (la receta viaja intacta — D-4).
 */
export function prepareClipForExport(
  clip: HephAutomationClipV3,
): ExportSanitizeResult {
  const notes: string[] = []

  // ── M1 · Higiene espacial ──────────────────────────────────────────────
  let zonesChanged = false
  const tracks = clip.tracks.map((t) => {
    const zones = sanitizeTrackZones(t.zones)
    if (
      zones.length !== t.zones.length ||
      zones.some((z, i) => z !== t.zones[i])
    ) {
      zonesChanged = true
      return { ...t, zones }
    }
    return t
  })
  if (zonesChanged) {
    notes.push('zones: zoneIds no-canónicos mapeados a ZoneTarget estricto')
  }

  const spatialZones = unionSpatialZones(tracks)
  if (
    spatialZones.length !== clip.spatialZones.length ||
    spatialZones.some((z, i) => z !== clip.spatialZones[i])
  ) {
    zonesChanged = true
    notes.push(`spatialZones: recomputado → [${spatialZones.join(', ')}]`)
  }

  // ── M2 · Pasaporte Selene ──────────────────────────────────────────────
  let cognitiveDNA = clip.cognitiveDNA
  let vibeCompat = clip.vibeCompat
  if (cognitiveDNA) {
    const clean = sanitizeCognitiveDNA(cognitiveDNA, notes)
    if (clean !== cognitiveDNA) {
      cognitiveDNA = clean
      // Espejo de serializeHephClip: vibeCompat = dna.compatibleVibes.
      vibeCompat = [...clean.compatibleVibes]
    }
  } else {
    notes.push('NO_DNA — clip Hephaestus-only (invisible para Selene)')
  }

  if (!zonesChanged && cognitiveDNA === clip.cognitiveDNA) {
    return { clip, notes }
  }

  return {
    clip: {
      ...clip,
      tracks,
      spatialZones,
      cognitiveDNA,
      vibeCompat,
    },
    notes,
  }
}
