/**
 * 🜨 WAVE 8201 — EXPORT SANITIZER (The Diplomat)
 *
 * `prepareClipForExport` es el middleware puro pre-save:
 *   M1 · track.zones → ZoneTarget estricto + spatialZones recomputado.
 *   M2 · cognitiveDNA → G4-estricto (energyZone ≤2, vibes, sections).
 * El clip resultante debe pasar `evaluateGates` sin un solo 'fail'.
 */

import { describe, test, expect } from 'vitest'
import { prepareClipForExport } from '../exportSanitizer'
import { evaluateGates } from '../gateEvaluators'
import type {
  HephAutomationClipV3,
  HephTrack,
  ZoneTarget,
} from '../types'
import { DEFAULT_COGNITIVE_DNA } from '../defaults'
import type { CognitiveDNA } from '../../arsenal/lfxTypes'

// ─── FIXTURES ───────────────────────────────────────────────────────────────

function track(id: string, zones: string[]): HephTrack {
  return {
    id,
    paramId: 'dimmer',
    zones: zones as ZoneTarget[],
    curve: {
      paramId: 'dimmer',
      valueType: 'normalized',
      range: { min: 0, max: 1 },
      defaultValue: 0,
      keyframes: [
        { timeMs: 0, value: 0, interpolation: 'linear' },
        { timeMs: 1000, value: 1, interpolation: 'linear' },
      ],
      mode: 'continuous',
    },
    blendMode: 'replace',
  } as unknown as HephTrack
}

function clip(over: Partial<HephAutomationClipV3> = {}): HephAutomationClipV3 {
  return {
    id: 'heph_test_8201',
    name: 'Test Clip',
    author: 'test',
    category: 'custom',
    tags: [],
    vibeCompat: [],
    spatialZones: [],
    mixBus: 'master',
    priority: 'normal',
    durationMs: 4000,
    effectType: 'automation',
    tracks: [track('ast_dimmer_x', ['front'])],
    staticParams: {},
    cognitiveDNA: structuredClone(DEFAULT_COGNITIVE_DNA),
    schemaVersion: '3.0',
    ...over,
  } as HephAutomationClipV3
}

const FAILING = (c: HephAutomationClipV3) =>
  evaluateGates(c).filter((g) => g.status === 'fail')

// ─── M1 · HIGIENE ESPACIAL ─────────────────────────────────────────────────

describe('M1 · Higiene espacial', () => {
  test('zoneId sub-canónico del atlas → padre canónico', () => {
    const c = clip({ tracks: [track('ast_dimmer_a', ['front-left', 'back-right'])] })
    const { clip: out } = prepareClipForExport(c)
    expect(out.tracks[0].zones).toEqual(['front', 'back'])
  })

  test('zoneId ya canónico y helpers → intactos', () => {
    const c = clip({ tracks: [track('ast_dimmer_a', ['all', 'air'])] })
    const { clip: out } = prepareClipForExport(c)
    expect(out.tracks[0].zones).toEqual(['all', 'air'])
  })

  test('zona irreconocible → unassigned (zona muerta honesta, nunca all)', () => {
    const c = clip({ tracks: [track('ast_dimmer_a', ['wat_zone'])] })
    const { clip: out } = prepareClipForExport(c)
    expect(out.tracks[0].zones).toEqual(['unassigned'])
  })

  test('dedupe: sub-zonas que colapsan al mismo padre', () => {
    const c = clip({ tracks: [track('ast_dimmer_a', ['front-left', 'front-right', 'front'])] })
    const { clip: out } = prepareClipForExport(c)
    expect(out.tracks[0].zones).toEqual(['front'])
  })

  test('spatialZones = unión de todos los tracks (recompute, no stale)', () => {
    const c = clip({
      spatialZones: ['floor' as ZoneTarget], // stale heredado
      tracks: [
        track('ast_dimmer_a', ['front-left']),
        track('ast_dimmer_b', ['strobe']),
        track('ast_pan_c', ['all']),
      ],
    })
    const { clip: out } = prepareClipForExport(c)
    expect(out.spatialZones).toEqual(['front', 'strobe', 'all'])
    expect(out.spatialZones).not.toContain('floor')
  })

  test('tracks sin zonas saneables → no muta referencias', () => {
    const c = clip()
    const { clip: out } = prepareClipForExport(c)
    // spatialZones ya era union real? — no: fixture tiene spatialZones [].
    expect(out.spatialZones).toEqual(['front'])
  })

  test('input NO muta (pureza)', () => {
    const c = clip({ tracks: [track('ast_dimmer_a', ['front-left'])] })
    const zonesBefore = [...c.tracks[0].zones]
    prepareClipForExport(c)
    expect([...c.tracks[0].zones]).toEqual(zonesBefore)
    expect(c.spatialZones).toEqual([])
  })
})

// ─── M2 · PASAPORTE SELENE (G4) ─────────────────────────────────────────────

describe('M2 · Pasaporte Selene', () => {
  test('DEFAULT DNA: energyZone ambient→peak (span 5) → ventana ≤2', () => {
    const { clip: out, notes } = prepareClipForExport(clip())
    const ez = out.cognitiveDNA!.energyZone
    expect(ez.min).toBe('gentle')
    expect(ez.max).toBe('active')
    expect(notes.some((n) => n.includes('energyZone'))).toBe(true)
  })

  test('arquetipo divine → ventana derivada del bias (peak)', () => {
    const dna = {
      ...structuredClone(DEFAULT_COGNITIVE_DNA),
      archetype: 'divine',
    } as CognitiveDNA
    const { clip: out } = prepareClipForExport(clip({ cognitiveDNA: dna }))
    expect(out.cognitiveDNA!.energyZone).toEqual({ min: 'peak', max: 'peak' })
  })

  test('energyZone huérfano (valores fuera del termómetro) → fallback', () => {
    const dna = {
      ...structuredClone(DEFAULT_COGNITIVE_DNA),
      archetype: 'zzz_unknown' as never,
      energyZone: { min: 'bogus', max: 'bogus' } as never,
    }
    const { clip: out } = prepareClipForExport(clip({ cognitiveDNA: dna }))
    // arquetipo desconocido → bias 'utility' → cola dominante [gentle, active]
    expect(out.cognitiveDNA!.energyZone).toEqual({ min: 'gentle', max: 'active' })
  })

  test('compatibleVibes vacío → vibe genérica + manual_only', () => {
    const { clip: out } = prepareClipForExport(clip())
    expect(out.cognitiveDNA!.compatibleVibes).toEqual(['chill-lounge'])
    expect(out.cognitiveDNA!.visibility).toBe('manual_only')
    expect(out.vibeCompat).toEqual(['chill-lounge'])
  })

  test('vibes declarados → visibility intacta (no degradar)', () => {
    const dna = {
      ...structuredClone(DEFAULT_COGNITIVE_DNA),
      compatibleVibes: ['techno-club'],
      energyZone: { min: 'intense', max: 'peak' },
    } as CognitiveDNA
    const { clip: out } = prepareClipForExport(clip({ cognitiveDNA: dna }))
    expect(out.cognitiveDNA!.compatibleVibes).toEqual(['techno-club'])
    expect(out.cognitiveDNA!.visibility).toBeUndefined()
    expect(out.cognitiveDNA!.energyZone).toEqual({ min: 'intense', max: 'peak' })
  })

  test('visibility explícita se respeta aunque inyectemos vibe', () => {
    const dna = {
      ...structuredClone(DEFAULT_COGNITIVE_DNA),
      visibility: 'all',
    } as CognitiveDNA
    const { clip: out } = prepareClipForExport(clip({ cognitiveDNA: dna }))
    expect(out.cognitiveDNA!.visibility).toBe('all')
  })

  test('validSections vacío → secciones derivadas de la ventana', () => {
    const { clip: out } = prepareClipForExport(clip())
    const s = out.cognitiveDNA!.validSections
    expect(s.length).toBeGreaterThan(0)
  })

  test('sin cognitiveDNA → no se inventa (Hephaestus-only honesto)', () => {
    const c = clip({ cognitiveDNA: undefined })
    const { clip: out, notes } = prepareClipForExport(c)
    expect(out.cognitiveDNA).toBeUndefined()
    expect(notes.some((n) => n.includes('NO_DNA'))).toBe(true)
  })
})

// ─── M3 · INTEGRACIÓN CON GATES ─────────────────────────────────────────────

describe('M3 · Gate-strict post-saneamiento', () => {
  test('clip tipo NewClipModal: pre-sanitize G4 falla, post-sanitize pasa', () => {
    const raw = clip()
    expect(FAILING(raw).map((g) => g.id)).toContain('G4')
    const { clip: out } = prepareClipForExport(raw)
    expect(FAILING(out)).toEqual([])
  })

  test('clip ya válido → identidad estable', () => {
    const dna = {
      ...structuredClone(DEFAULT_COGNITIVE_DNA),
      compatibleVibes: ['techno-club'],
      validSections: ['drop'],
      energyZone: { min: 'active', max: 'intense' },
    } as CognitiveDNA
    const c = clip({ cognitiveDNA: dna, spatialZones: ['front' as ZoneTarget] })
    const { clip: out, notes } = prepareClipForExport(c)
    expect(FAILING(out)).toEqual([])
    expect(out.cognitiveDNA).toBe(c.cognitiveDNA) // compartido, no copiado
    expect(notes).toEqual([])
  })
})
