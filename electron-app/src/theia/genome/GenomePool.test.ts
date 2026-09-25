/**
 * 🧬 WAVE 8234 — INFINITE GENOME · Fase G2: Genome Pool (registry glue).
 *
 * Certifica `spawnGenomeVariant`: instanciación de átomos `core#seed`,
 * dedupe por genomeId (§4.5), ADN retroproyectado (§4.4) y fenotipo
 * `source.genes` que G1 transporta al shader.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { TheiaRegistry } from '../../core/theia/TheiaRegistry'
import {
  atomIdForGenome,
  buildVariantAtom,
  resetGenomePool,
  spawnGenomeVariant,
} from './GenomePool'
import { expandGenome } from './GenomeExpander'
import { parseEuclidMeta } from '../shader/ShaderAssembler'
import type { ITheiaAtom } from '../../types/theiaTypes'

const CORE_GLSL = `// @euclid name    Pool Core
// @euclid family  conformal
// @euclid genome  aggression=0.4 chaos=0.6 organicity=0.5
// @euclid gene    G_FOLD struct int   5   12   8    a:+0.4 c:+0.3
// @euclid gene    G_ZOOM expr   float 0.05 0.5  0.25 a:+0.6
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`

function makeCore(id = 'core_test'): ITheiaAtom {
  return {
    id,
    packId: 'pack_test',
    filePath: 'euclid://core_test.glsl',
    aggression: 0.4,
    chaos: 0.6,
    organicity: 0.5,
    energyZone: { min: 'gentle', max: 'peak' },
    validSections: ['verse', 'drop'],
    trim: { startMs: 0, endMs: 8000 },
    compatibleVibes: ['techno'],
    source: { kind: 'shader', glsl: CORE_GLSL },
  }
}

describe('G2 — GenomePool.spawnGenomeVariant', () => {
  let registry: TheiaRegistry

  beforeEach(() => {
    registry = new TheiaRegistry()
    resetGenomePool()
    expect(registry.register(makeCore())).not.toBeNull()
  })

  it('instancia `core#seed` con fenotipo y ADN retroproyectado', () => {
    const r = spawnGenomeVariant('core_test', 42, registry)
    expect(r).not.toBeNull()
    expect(r!.created).toBe(true)
    expect(r!.atomId).toBe('core_test#42')
    expect(r!.genomeId).toMatch(/^[0-9a-f]{8}$/)

    const atom = registry.getAtom(r!.atomId)!
    expect(atom.source?.kind).toBe('shader')
    expect(atom.source?.glsl).toBe(CORE_GLSL)
    expect(atom.source?.genes).toEqual(r!.phenotype.genes)
    // §4.4 — el átomo declara su ADN REAL (retroproyectado), no el del core.
    expect(atom.aggression).toBeCloseTo(r!.phenotype.dna.aggression, 9)
    expect(atom.chaos).toBeCloseTo(r!.phenotype.dna.chaos, 9)
    expect(atom.organicity).toBeCloseTo(r!.phenotype.dna.organicity, 9)
    // Hereda contexto del core (zona, secciones, vibes, trim).
    expect(atom.compatibleVibes).toEqual(['techno'])
    expect(atom.validSections).toEqual(['verse', 'drop'])
    expect(atom.energyZone).toEqual({ min: 'gentle', max: 'peak' })
  })

  it('seed 0 = canónico: devuelve el propio core, sin registrar nada', () => {
    const before = registry.getAtomCount()
    const r = spawnGenomeVariant('core_test', 0, registry)
    expect(r).not.toBeNull()
    expect(r!.created).toBe(false)
    expect(r!.atomId).toBe('core_test')
    expect(registry.getAtomCount()).toBe(before)
    // y su fenotipo son los defaults declarados.
    expect(r!.phenotype.genes.G_FOLD).toBe(8)
  })

  it('dedupe §4.5: misma seed → mismo atomId; fenotipos idénticos colapsan', () => {
    const a = spawnGenomeVariant('core_test', 7, registry)
    const b = spawnGenomeVariant('core_test', 7, registry)
    expect(b!.created).toBe(false)
    expect(b!.atomId).toBe(a!.atomId)
    expect(atomIdForGenome(a!.genomeId)).toBe(a!.atomId)

    // Colapso real: un core cuyo gen no puede variar produce el MISMO
    // individuo desde semillas distintas → mismo átomo.
    registry.register({
      ...makeCore('flat_core'),
      filePath: 'euclid://flat.glsl',
      source: {
        kind: 'shader',
        glsl: `// @euclid gene G_X struct int 5 5 5
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`,
      },
    })
    const f1 = spawnGenomeVariant('flat_core', 100, registry)
    const f2 = spawnGenomeVariant('flat_core', 999, registry)
    expect(f1!.created).toBe(true)
    expect(f2!.created).toBe(false)
    expect(f2!.atomId).toBe(f1!.atomId) // `flat_core#100` absorbe #999
  })

  it('rechaza cores sin genes, no-shader y átomos inexistentes', () => {
    expect(spawnGenomeVariant('no_existe', 1, registry)).toBeNull()
    registry.register({ ...makeCore('video_core'), source: { kind: 'video' } })
    expect(spawnGenomeVariant('video_core', 1, registry)).toBeNull()
    registry.register({
      ...makeCore('geneless'),
      source: {
        kind: 'shader',
        glsl: 'void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }',
      },
    })
    expect(spawnGenomeVariant('geneless', 1, registry)).toBeNull()
  })

  it('el fenotipo del variante coincide con expandGenome(meta, glsl, seed)', () => {
    const meta = parseEuclidMeta(CORE_GLSL)
    const expected = expandGenome(meta, CORE_GLSL, 555)
    const r = spawnGenomeVariant('core_test', 555, registry)
    expect(r!.genomeId).toBe(expected.genomeId)
    expect(r!.phenotype.genes).toEqual(expected.genes)
    expect(r!.phenotype.dna).toEqual(expected.dna)
  })

  it('el fenotipo del variante fluye al shader vía source.genes (G1)', () => {
    const r = spawnGenomeVariant('core_test', 3, registry)!
    const atom = registry.getAtom(r.atomId)!
    // El contrato G1: el resolver emite meta.genes → resolveGeneValues →
    // #define G_* — los valores del átomo son ya el fenotipo efectivo.
    expect(atom.source?.genes?.G_FOLD).toBe(r.phenotype.genes.G_FOLD)
    expect(Object.keys(atom.source!.genes!)).toEqual(
      expect.arrayContaining(['G_FOLD', 'G_ZOOM']),
    )
  })

  it('buildVariantAtom: constructor puro (sin registry) respeta el shape', () => {
    const core = makeCore()
    const phenotype = expandGenome(parseEuclidMeta(CORE_GLSL), CORE_GLSL, 9)
    const v = buildVariantAtom(core, 9, phenotype)
    expect(v.id).toBe('core_test#9')
    expect(v.filePath).toBe('euclid://core_test.glsl#9')
    expect(v.source?.genes).toEqual(phenotype.genes)
    expect(v.aggression).toBe(phenotype.dna.aggression)
  })
})
