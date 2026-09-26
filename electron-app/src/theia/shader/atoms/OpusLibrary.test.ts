/**
 * 🔮 WAVE 8242 — HYBRID DECK · U4 (Ignition & The Opus Library)
 *
 * Contrato del pack por defecto "Opus Infinite Genome": los dos shaders
 * de referencia §6 del blueprint viven físicamente en
 * `assets/shaders/*.glsl`, se importan `?raw` y `ensureEuclidShaderAtoms`
 * los registra al arranque junto al Oracle KIFS de prueba.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getTheiaRegistry } from '../../../core/theia/TheiaRegistry'
import { useTheiaPackStore } from '../../../stores/useTheiaPackStore'
import { parseEuclidMeta } from '../ShaderAssembler'
import {
  buildOpusGenomeAtoms,
  OPUS_PACK_ID,
  OPUS_PACK_LABEL,
  AETHER_SERPENT_ATOM_ID,
  TRIBU_MENTAL_ATOM_ID,
} from './opusLibrary'
import { ensureEuclidShaderAtoms } from './index'
import { ORACLE_KIFS_ATOM_ID, EUCLID_PACK_ID } from './oracleKifs'

import AETHER_SRC from '../../../../assets/shaders/aether_serpent.glsl?raw'
import TRIBU_SRC from '../../../../assets/shaders/tribu_mental.glsl?raw'

describe('U4 — Opus Library (.glsl físicos)', () => {
  it('importa los dos shaders §6 como fuente GLSL cruda', () => {
    expect(AETHER_SRC).toContain('// @euclid name    "Æther Serpent"')
    expect(TRIBU_SRC).toContain('// @euclid name    "Tribu Mental"')
    // Cuerpos reales, no placeholders
    expect(AETHER_SRC).toContain('void mainImage')
    expect(TRIBU_SRC).toContain('SWARM_MAX 24')
  })

  it('parsea el ADN de Æther Serpent desde su header @euclid', () => {
    const meta = parseEuclidMeta(AETHER_SRC)
    expect(meta.genome.aggression).toBeCloseTo(0.4)
    expect(meta.genome.chaos).toBeCloseTo(0.55)
    expect(meta.genome.organicity).toBeCloseTo(0.9)
    expect(meta.zone).toEqual({ from: 'ambient', to: 'peak' })
    expect(meta.steps).toBe(56)
    expect(meta.params.map((p) => p.name)).toEqual([
      'u_warpBoost',
      'u_densityBoost',
    ])
    const genes = new Map(meta.genes.map((g) => [g.name, g.cls]))
    expect(genes.get('G_SYM')).toBe('struct')
    expect(genes.get('G_WARP')).toBe('expr')
    expect(genes.get('G_SEED')).toBe('expr')
  })

  it('parsea el ADN de Tribu Mental desde su header @euclid', () => {
    const meta = parseEuclidMeta(TRIBU_SRC)
    expect(meta.genome.aggression).toBeCloseTo(0.6)
    expect(meta.genome.chaos).toBeCloseTo(0.75)
    expect(meta.genome.organicity).toBeCloseTo(0.65)
    expect(meta.zone).toEqual({ from: 'gentle', to: 'peak' })
    expect(meta.params.map((p) => p.name)).toEqual(['u_trails', 'u_swarm'])
    const genes = new Map(meta.genes.map((g) => [g.name, g.cls]))
    expect(genes.get('G_FOLD')).toBe('struct')
    expect(genes.get('G_PERIOD')).toBe('expr')
  })

  it('construye átomos kind:shader válidos para el registry', () => {
    const atoms = buildOpusGenomeAtoms()
    expect(atoms).toHaveLength(2)
    const serpent = atoms.find((a) => a.id === AETHER_SERPENT_ATOM_ID)
    const tribu = atoms.find((a) => a.id === TRIBU_MENTAL_ATOM_ID)
    expect(serpent?.source).toEqual({ kind: 'shader', glsl: AETHER_SRC })
    expect(tribu?.source).toEqual({ kind: 'shader', glsl: TRIBU_SRC })
    expect(serpent?.energyZone).toEqual({ min: 'ambient', max: 'peak' })
    expect(tribu?.energyZone).toEqual({ min: 'gentle', max: 'peak' })
    expect(serpent?.aggression).toBeCloseTo(0.4)
    expect(serpent?.organicity).toBeCloseTo(0.9)
  })
})

describe('U4 — ensureEuclidShaderAtoms (arranque)', () => {
  beforeEach(() => {
    const store = useTheiaPackStore.getState()
    store.removePack(OPUS_PACK_ID)
    store.removePack(EUCLID_PACK_ID)
    const registry = getTheiaRegistry()
    registry.unregister(AETHER_SERPENT_ATOM_ID)
    registry.unregister(TRIBU_MENTAL_ATOM_ID)
    registry.unregister(ORACLE_KIFS_ATOM_ID)
  })

  it('registra los 3 átomos generativos y crea el pack Opus', () => {
    const ids = ensureEuclidShaderAtoms()
    expect(ids).toEqual([
      ORACLE_KIFS_ATOM_ID,
      AETHER_SERPENT_ATOM_ID,
      TRIBU_MENTAL_ATOM_ID,
    ])

    const registry = getTheiaRegistry()
    expect(registry.getAtom(AETHER_SERPENT_ATOM_ID)?.source.kind).toBe('shader')
    expect(registry.getAtom(TRIBU_MENTAL_ATOM_ID)?.source.kind).toBe('shader')

    const store = useTheiaPackStore.getState()
    const opus = store.packs.get(OPUS_PACK_ID)
    expect(opus).toBeDefined()
    expect(opus?.manifest.displayName).toBe(OPUS_PACK_LABEL)
    expect(opus?.atoms.map((a) => a.id)).toEqual([
      AETHER_SERPENT_ATOM_ID,
      TRIBU_MENTAL_ATOM_ID,
    ])
    // El KIFS de prueba conserva su pack propio (contrato E4).
    const euclid = store.packs.get(EUCLID_PACK_ID)
    expect(euclid?.atoms.map((a) => a.id)).toEqual([ORACLE_KIFS_ATOM_ID])
  })

  it('es idempotente — re-llamar no duplica átomos', () => {
    ensureEuclidShaderAtoms()
    ensureEuclidShaderAtoms()
    const opus = useTheiaPackStore.getState().packs.get(OPUS_PACK_ID)
    expect(opus?.atoms).toHaveLength(2)
  })
})
