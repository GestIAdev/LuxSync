/**
 * 🔮 WAVE 8242 — HYBRID DECK · U4 (Ignition & The Opus Library)
 *
 * Contrato del pack por defecto "Opus Infinite Genome": los dos shaders
 * de referencia §6 del blueprint viven físicamente en
 * `assets/shaders/*.glsl`, se importan `?raw` y `ensureEuclidShaderAtoms`
 * los registra al arranque junto al Oracle KIFS de prueba.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
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
import { getThetaOrchestrator } from '../../ThetaOrchestrator'

import AETHER_SRC from '../../../../assets/shaders/aether_serpent.glsl?raw'
import TRIBU_SRC from '../../../../assets/shaders/tribu_mental.glsl?raw'

const KIT_IDS = [
  'neon_conduit', 'sacred_bouncer', 'liquid_nebula',
  'voxel_monolith', 'morphing_core', 'quantum_swarm',
  'ferro_heart', 'event_horizon', 'turing_cannibals',
]
const OPUS_ALL_IDS = [AETHER_SERPENT_ATOM_ID, TRIBU_MENTAL_ATOM_ID, ...KIT_IDS]

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
    expect(atoms.map((a) => a.id)).toEqual(OPUS_ALL_IDS)
    const serpent = atoms.find((a) => a.id === AETHER_SERPENT_ATOM_ID)
    const tribu = atoms.find((a) => a.id === TRIBU_MENTAL_ATOM_ID)
    expect(serpent?.source).toEqual({ kind: 'shader', glsl: AETHER_SRC })
    expect(tribu?.source).toEqual({ kind: 'shader', glsl: TRIBU_SRC })
    expect(serpent?.energyZone).toEqual({ min: 'ambient', max: 'peak' })
    expect(tribu?.energyZone).toEqual({ min: 'gentle', max: 'peak' })
    expect(serpent?.aggression).toBeCloseTo(0.4)
    expect(serpent?.organicity).toBeCloseTo(0.9)
  })

  it('los 9 átomos del kit traen header @euclid completo y cuerpo', () => {
    for (const atom of buildOpusGenomeAtoms().filter((a) => KIT_IDS.includes(a.id))) {
      const glsl = atom.source.kind === 'shader' ? atom.source.glsl : ''
      const meta = parseEuclidMeta(glsl)
      expect(meta.name, atom.id).toBeTruthy()
      expect(meta.zone, atom.id).toBeDefined()
      expect(meta.params.length, atom.id).toBe(2)
      expect(meta.genes.length, atom.id).toBeGreaterThan(0)
      expect(glsl, atom.id).toContain('void mainImage(out vec4 c, in vec2 fragCoord)')
      expect(atom.compatibleVibes.length, atom.id).toBeGreaterThan(0)
    }
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
    for (const id of KIT_IDS) registry.unregister(id)
  })

  it('registra los átomos generativos y crea el pack Opus', () => {
    const ids = ensureEuclidShaderAtoms()
    expect(ids).toEqual([ORACLE_KIFS_ATOM_ID, ...OPUS_ALL_IDS])

    const registry = getTheiaRegistry()
    expect(registry.getAtom(AETHER_SERPENT_ATOM_ID)?.source.kind).toBe('shader')
    expect(registry.getAtom(TRIBU_MENTAL_ATOM_ID)?.source.kind).toBe('shader')

    const store = useTheiaPackStore.getState()
    const opus = store.packs.get(OPUS_PACK_ID)
    expect(opus).toBeDefined()
    expect(opus?.manifest.displayName).toBe(OPUS_PACK_LABEL)
    expect(opus?.atoms.map((a) => a.id)).toEqual(OPUS_ALL_IDS)
    for (const id of KIT_IDS) expect(registry.getAtom(id)?.source.kind, id).toBe('shader')
    // El KIFS de prueba conserva su pack propio (contrato E4).
    const euclid = store.packs.get(EUCLID_PACK_ID)
    expect(euclid?.atoms.map((a) => a.id)).toEqual([ORACLE_KIFS_ATOM_ID])
  })

  it('es idempotente — re-llamar no duplica átomos', () => {
    ensureEuclidShaderAtoms()
    ensureEuclidShaderAtoms()
    const opus = useTheiaPackStore.getState().packs.get(OPUS_PACK_ID)
    expect(opus?.atoms).toHaveLength(OPUS_ALL_IDS.length)
  })
})

describe('U4-hotfix — playAtom shader routing (WAVE 8243)', () => {
  /**
   * Contrato: un átomo `source.kind='shader'` registrado en el registry
   * toma el path generativo (`theia:load-shader` + `theia:activate-shader`)
   * AUNQUE `_shaderSourceResolver` sea null (wiring Selene detach) —
   * nunca cae al pipeline de vídeo (`theia:load-stream`). Además el
   * trigger auto-arranca el motor (ignition U4).
   */
  it('resuelve por registry fallback, ignora el vídeo y auto-arranca', async () => {
    const g = globalThis as Record<string, unknown>
    const origWindow = g.window
    const origWorker = g.Worker
    const posted: string[] = []
    g.window = {
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    g.Worker = class {
      addEventListener(): void {}
      removeEventListener(): void {}
      postMessage(msg: { type?: string }): void {
        if (msg?.type) posted.push(msg.type)
      }
      terminate(): void {}
    }

    try {
      ensureEuclidShaderAtoms()
      const theta = getThetaOrchestrator()
      await theta.playAtom({
        atomId: AETHER_SERPENT_ATOM_ID,
        startMs: 0,
        crossfadeMs: 80,
        reason: 'manual:test|opuS-routing',
      })

      // Path generativo alcanzado — genoma resuelto desde el registry.
      expect(theta.getActiveShaderId()).toBe(AETHER_SERPENT_ATOM_ID)
      expect(
        theta.getShaderMeta(AETHER_SERPENT_ATOM_ID)?.genome.aggression,
      ).toBeCloseTo(0.4)
      expect(posted).toContain('theia:load-shader')
      expect(posted).toContain('theia:activate-shader')
      // BYPASS de vídeo: jamás se intentó cargar stream ni se emitió seek.
      expect(posted).not.toContain('theia:load-stream')
    } finally {
      await getThetaOrchestrator().stop()
      g.window = origWindow
      g.Worker = origWorker
    }
  })
})

describe('WAVE 8246 — Telemetry Watchdog (cut wire re-pull)', () => {
  /**
   * Contrato: mientras el motor corre sin link sano (port null o ring
   * stale), el watchdog re-emite `requestTheiaPort('telemetry-port')`
   * cada ~2s. El pull original era single-shot → un IPC perdido dejaba
   * NO LINK permanente (auditoría WAVE 8245).
   */
  it('re-pide telemetry-port a 2s mientras isRunning y el link no llega', async () => {
    const g = globalThis as Record<string, unknown>
    const origWindow = g.window
    const origWorker = g.Worker
    const reqs: Record<string, unknown>[] = []
    g.window = {
      postMessage: (m: Record<string, unknown>) => {
        reqs.push(m)
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    g.Worker = class {
      addEventListener(): void {}
      removeEventListener(): void {}
      postMessage(): void {}
      terminate(): void {}
    }

    const pulls = () =>
      reqs.filter((r) => r.__luxTheiaReq === 'telemetry-port').length

    vi.useFakeTimers()
    try {
      const theta = getThetaOrchestrator()
      await theta.start()
      // armGlassBridge() → pull inicial de ambos kinds.
      expect(pulls()).toBe(1)

      // Watchdog: port nunca llegó → re-pull en cada barrido de 2s.
      vi.advanceTimersByTime(2100)
      expect(pulls()).toBe(2)
      vi.advanceTimersByTime(2100)
      expect(pulls()).toBe(3)
    } finally {
      await getThetaOrchestrator().stop()
      vi.useRealTimers()
      g.window = origWindow
      g.Worker = origWorker
    }
  })
})
