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
// 🌊 WAVE 8279 · F6 — pilotos del contrato v2 (D1 + D4).
const PILOT_IDS = ['atom_voice_mandala', 'atom_phase_mercury']
const OPUS_ALL_IDS = [AETHER_SERPENT_ATOM_ID, TRIBU_MENTAL_ATOM_ID, ...KIT_IDS, ...PILOT_IDS]

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

// ─────────────────── 🌊 WAVE 8279 · F6 — contrato Theia 2.0 ───────────────────

describe('F6 — todos los átomos de la Opus Library cumplen el contrato v2', () => {
  const code = (glsl: string) => glsl.split('\n').map((l) => l.split('//')[0]).join('\n')
  const atoms = buildOpusGenomeAtoms()
  const glslOf = (id: string) => {
    const a = atoms.find((x) => x.id === id)
    return a?.source.kind === 'shader' ? a.source.glsl : ''
  }

  it('los 13 átomos llevan el marcador v2 (migrate_atoms_v2 o nativos)', () => {
    expect(atoms.map((a) => a.id)).toEqual(OPUS_ALL_IDS)
    for (const a of atoms) expect(glslOf(a.id), a.id).toContain('Theia 2.0 · contract v2')
  })

  it('cero API deprecada en código: estrobo (Fase 5) ni array plano u_tel[ (v1)', () => {
    for (const a of atoms) {
      const c = code(glslOf(a.id))
      expect(c, a.id).not.toMatch(/\bu_strobeGate\b|\bSTROBE_ACTIVE\b/)
      expect(c, a.id).not.toMatch(/\bu_tel\s*\[/)
    }
  })

  it('la capa reactiva migrada: sin corte binario de vacío ni u_snarePulse crudo', () => {
    for (const a of atoms) {
      const c = code(glslOf(a.id))
      expect(c, a.id).not.toMatch(/if\s*\(\s*RHYTHMIC_VOID\s*\)/)
      // u_snarePulse solo sobrevive dentro del helper euSnare().
      const raw = c.split('\n').filter((l) => /\bu_snarePulse\b/.test(l) && !/float\s+euSnare\s*\(/.test(l))
      expect(raw, a.id).toEqual([])
    }
  })

  it('D1 Voice Mandala: la voz ordena vía euTimbre + reloj vocal + onset', () => {
    const c = code(glslOf('atom_voice_mandala'))
    expect(c).toContain('euTimbre()')
    expect(c).toContain('u_vocalTime')
    expect(c).toContain('u_melodicity')
    expect(c).toContain('u_vocalOnset')
    expect(parseEuclidMeta(glslOf('atom_voice_mandala')).params).toHaveLength(2)
  })

  it('D4 Phase Mercury: visc(synthSustain, percussiveness) gobierna smin, facetas y memoria', () => {
    const c = code(glslOf('atom_phase_mercury'))
    expect(c).toMatch(/smoothstep\(0\.15, 0\.75, u_synthSustain\) \* \(1\.0 - 0\.8 \* u_percussiveness\)/)
    expect(c).toContain('mix(0.008, 0.40, gVisc)')           // cristal → mercurio
    expect(c).toContain('floor(n0 * F + 0.5)')               // normales facetadas
    expect(c).toContain('mix(0.78, 0.94, gVisc)')            // estela del mercurio
    expect(c).toContain('u_snareTruePulse')                  // la caja MACD fractura
    expect(parseEuclidMeta(glslOf('atom_phase_mercury')).params).toHaveLength(2)
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
    for (const id of [...KIT_IDS, ...PILOT_IDS]) registry.unregister(id)
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

describe('U4-hotfix — playAtom shader routing (WAVE 8243 + 8268)', () => {
  /**
   * Contrato: un átomo `source.kind='shader'` registrado en el registry
   * toma el path generativo (`theia:load-shader` + `theia:activate-shader`)
   * AUNQUE `_shaderSourceResolver` sea null (wiring Selene detach) —
   * nunca cae al pipeline de vídeo (`theia:load-stream`).
   * 🖥️ WAVE 8268 — STRICT LIVE GATE: con el motor apagado el intent NO
   * auto-arranca — queda armado (`pendingPlayIntent`) y se dispara tras
   * `theia:ready` cuando el operador pulsa LIVE.
   */
  it('arma el intent apagado y al pulsar LIVE resuelve por registry fallback, ignorando el vídeo', async () => {
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

      // ── Motor APAGADO: el intent se arma, NO spawnea worker. ──────────
      await theta.playAtom({
        atomId: AETHER_SERPENT_ATOM_ID,
        startMs: 0,
        crossfadeMs: 80,
        reason: 'manual:test|opus-routing',
      })
      expect(theta.getStatus().isRunning).toBe(false)
      expect(theta.getActiveShaderId()).toBe('builtin')
      expect(posted).not.toContain('theia:init')

      // ── LIVE: start() spawnea y encola la hidratación atómica. ────────
      await theta.start()
      expect(posted).toContain('theia:init')
      expect(posted).toContain('theia:hydrate')

      // El worker real emitiría 'theia:ready' tras initGL — el fake no
      // responde, así que lo inyectamos (handleWorkerMessage es private
      // de TS, alcanzable en runtime).
      ;(theta as unknown as {
        handleWorkerMessage(m: { type: string }): void
      }).handleWorkerMessage({ type: 'theia:ready' })

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
