/**
 * 🌊 WAVE 8300 — FACTORY PIPELINE (Opus Library Extraction)
 *
 * Contrato del pack de fábrica DISK-NATIVE: los átomos viven físicamente en
 * `assets/shaders/*.glsl`, se siembran en `userData/theia/packs/Factory/`
 * al primer arranque (bootstrapTheiaFactory) y el renderer los materializa
 * ÚNICAMENTE desde el scan IPC (`loadLibraryFromDisk`). `opusLibrary.ts`
 * está extinto — no hay fallback estático: si el usuario borra Factory/
 * del disco, el Deck queda vacío.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getTheiaRegistry } from '../../../core/theia/TheiaRegistry'
import { useTheiaPackStore, buildGlslAtom } from '../../../stores/useTheiaPackStore'
import { parseEuclidMeta } from '../ShaderAssembler'
import { ORACLE_KIFS_ATOM_ID, EUCLID_PACK_ID } from './oracleKifs'
import { getThetaOrchestrator } from '../../ThetaOrchestrator'
import type { ITheiaScannedPack, ITheiaPackManifest } from '../../../types/theiaTypes'

// Corpus de fábrica leído directo de disco de desarrollo — misma fuente
// que el bootstrap copia a userData (single source of truth).
const FACTORY_GLSL = import.meta.glob('../../../../assets/shaders/*.glsl', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Espejo de FACTORY_ATOM_FILES en TheiaLibraryScanner.ts — los 13
// canónicos del extinto opusLibrary.ts + dosel_selvatico (graduado del
// pack latino, WAVE 8425). `assets/shaders/` puede contener
// WIP que aún no pasan el contrato v2: no forman parte de la siembra.
const FACTORY_ATOM_FILES = [
  'aether_serpent.glsl',
  'tribu_mental.glsl',
  'neon_conduit.glsl',
  'sacred_bouncer.glsl',
  'liquid_nebula.glsl',
  'voxel_monolith.glsl',
  'morphing_core.glsl',
  'quantum_swarm.glsl',
  'ferro_heart.glsl',
  'event_horizon.glsl',
  'turing_cannibals.glsl',
  'atom_voice_mandala.glsl',
  'atom_phase_mercury.glsl',
  'dosel_selvatico.glsl',
]
const FACTORY_NAMES = FACTORY_ATOM_FILES.filter((n) =>
  Object.keys(FACTORY_GLSL).some((p) => p.endsWith(`/${n}`)),
)
const _src = (fileName: string): string =>
  FACTORY_GLSL[`../../../../assets/shaders/${fileName}`]

import AETHER_SRC from '../../../../assets/shaders/aether_serpent.glsl?raw'
import TRIBU_SRC from '../../../../assets/shaders/tribu_mental.glsl?raw'

const AETHER_ID = 'glsl_aether_serpent'
const TRIBU_ID = 'glsl_tribu_mental'

/** Scan IPC simulado del pack Factory (forma ITheiaScannedPack). */
function _factoryScan(): { success: true; packsRoot: string; packs: ITheiaScannedPack[] } {
  const files = FACTORY_NAMES.map((fileName) => ({
    fileName,
    relPath: `Factory/${fileName}`,
    absPath: `C:\\theia\\packs\\Factory\\${fileName}`,
    kind: 'glsl' as const,
    text: _src(fileName),
  }))
  const manifest: ITheiaPackManifest = {
    schemaVersion: 1,
    displayName: 'Opus Infinite Genome',
    accentColor: '#a3e635',
    atomOrder: [TRIBU_ID, AETHER_ID], // orden invertido → prueba manifest.atomOrder
  }
  return {
    success: true,
    packsRoot: 'C:\\theia\\packs',
    packs: [{ id: 'Factory', rootPath: 'C:\\theia\\packs\\Factory', manifest, files }],
  }
}

function _stubScan(scan: ReturnType<typeof _factoryScan>): void {
  const g = globalThis as Record<string, unknown>
  const w = (g.window ?? {}) as Record<string, unknown>
  g.window = { ...w, lux: { ...(w.lux as object ?? {}), theia: { scanLibrary: async () => scan } } }
}

describe('WAVE 8300 — corpus de fábrica (assets/shaders/*.glsl)', () => {
  it('los .glsl de fábrica existen en disco y llevan header @euclid completo', () => {
    expect(FACTORY_NAMES.length).toBe(14)
    expect(FACTORY_NAMES).toContain('aether_serpent.glsl')
    expect(FACTORY_NAMES).toContain('tribu_mental.glsl')
    for (const name of FACTORY_NAMES) {
      const src = _src(name)
      const meta = parseEuclidMeta(src)
      expect(meta.name, name).toBeTruthy()
      expect(meta.zone, name).toBeDefined()
      expect(src, name).toContain('void mainImage(out vec4 c, in vec2 fragCoord)')
      // 🌊 WAVE 8300 — el .glsl es su propio manifiesto: vibes requeridas
      // para que Selene siga matcheando tras la extracción (antes venían
      // hardcodeadas en OPUS_SPECS).
      expect(meta.vibes?.length, name).toBeGreaterThan(0)
    }
  })

  it('parsea el ADN + vibes de Æther Serpent desde su header @euclid', () => {
    const meta = parseEuclidMeta(AETHER_SRC)
    expect(meta.genome.aggression).toBeCloseTo(0.4)
    expect(meta.genome.chaos).toBeCloseTo(0.55)
    expect(meta.genome.organicity).toBeCloseTo(0.9)
    expect(meta.zone).toEqual({ from: 'ambient', to: 'peak' })
    expect(meta.steps).toBe(56)
    expect(meta.vibes).toEqual(['psytrance', 'ambient', 'techno'])
    expect(meta.params.map((p) => p.name)).toEqual(['u_warpBoost', 'u_densityBoost'])
  })

  it('buildGlslAtom materializa vibes/genoma/zona desde el header', () => {
    const atom = buildGlslAtom('aether_serpent.glsl', AETHER_SRC, 'Factory', 'C:\\f\\aether_serpent.glsl')
    expect(atom.id).toBe(AETHER_ID)
    expect(atom.source).toEqual({ kind: 'shader', glsl: AETHER_SRC })
    expect(atom.filePath).toBe('C:\\f\\aether_serpent.glsl')
    expect(atom.energyZone).toEqual({ min: 'ambient', max: 'peak' })
    expect(atom.compatibleVibes).toEqual(['psytrance', 'ambient', 'techno'])
    expect(atom.aggression).toBeCloseTo(0.4)
    // sin header vibes → 'generic' (solo disparo manual)
    const untagged = buildGlslAtom('x.glsl', 'void mainImage(){}', 'p')
    expect(untagged.compatibleVibes).toEqual(['generic'])
  })
})

describe('WAVE 8300 — todos los átomos de fábrica cumplen el contrato v2', () => {
  const code = (glsl: string) => glsl.split('\n').map((l) => l.split('//')[0]).join('\n')

  it('marcador v2 + cero API deprecada (estrobo Fase 5, array plano u_tel[)', () => {
    for (const name of FACTORY_NAMES) {
      const src = _src(name)
      expect(src, name).toContain('Theia 2.0 · contract v2')
      const c = code(src)
      expect(c, name).not.toMatch(/\bu_strobeGate\b|\bSTROBE_ACTIVE\b/)
      expect(c, name).not.toMatch(/\bu_tel\s*\[/)
      expect(c, name).not.toMatch(/if\s*\(\s*RHYTHMIC_VOID\s*\)/)
      const raw = c.split('\n').filter((l) => /\bu_snarePulse\b/.test(l) && !/float\s+euSnare\s*\(/.test(l))
      expect(raw, name).toEqual([])
    }
  })
})

describe('WAVE 8300 — loadLibraryFromDisk (DISK-ONLY)', () => {
  const g = globalThis as Record<string, unknown>
  let origWindow: unknown

  beforeEach(() => {
    origWindow = g.window
    const store = useTheiaPackStore.getState()
    store.removePack('Factory')
    store.removePack(EUCLID_PACK_ID)
    const registry = getTheiaRegistry()
    for (const id of [AETHER_ID, TRIBU_ID, ORACLE_KIFS_ATOM_ID]) registry.unregister(id)
  })
  afterEach(() => {
    g.window = origWindow
  })

  it('hidrata Factory desde el scan IPC: pending=false, registry, orden y vibes', async () => {
    _stubScan(_factoryScan())
    const count = await useTheiaPackStore.getState().loadLibraryFromDisk()
    expect(count).toBe(1)

    const pack = useTheiaPackStore.getState().packs.get('Factory')
    expect(pack).toBeDefined()
    expect(pack?.pending).toBe(false)
    expect(pack?.rootPath).toBe('C:\\theia\\packs\\Factory')
    expect(pack?.manifest?.displayName).toBe('Opus Infinite Genome')
    // manifest.atomOrder manda: tribu antes que aether.
    expect(pack?.atoms.slice(0, 2).map((a) => a.id)).toEqual([TRIBU_ID, AETHER_ID])

    const registry = getTheiaRegistry()
    const serpent = registry.getAtom(AETHER_ID)
    expect(serpent?.source.kind).toBe('shader')
    expect(serpent?.compatibleVibes).toEqual(['psytrance', 'ambient', 'techno'])
  })

  it('hidrata atomOverrides del manifest en atomGeneValues/atomParamValues', async () => {
    const scan = _factoryScan()
    scan.packs[0].manifest!.atomOverrides = {
      [AETHER_ID]: { genes: { G_WARP: 2.5 }, params: { u_densityBoost: 0.8 } },
    }
    _stubScan(scan)
    await useTheiaPackStore.getState().loadLibraryFromDisk()
    const s = useTheiaPackStore.getState()
    expect(s.atomGeneValues.get(AETHER_ID)).toEqual({ G_WARP: 2.5 })
    expect(s.atomParamValues.get(AETHER_ID)).toEqual({ u_densityBoost: 0.8 })
  })

  it('Factory borrado de disco → el Deck queda vacío (cero fallback estático)', async () => {
    _stubScan(_factoryScan())
    await useTheiaPackStore.getState().loadLibraryFromDisk()
    expect(useTheiaPackStore.getState().packs.has('Factory')).toBe(true)

    // El usuario borra packs/Factory → el siguiente scan no lo devuelve.
    _stubScan({ success: true, packsRoot: 'C:\\theia\\packs', packs: [] })
    await useTheiaPackStore.getState().loadLibraryFromDisk()
    expect(useTheiaPackStore.getState().packs.has('Factory')).toBe(false)
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
      // 🌊 WAVE 8300 — el átomo entra por la MISMA vía que en producción:
      // materializado desde el .glsl de disco y registrado en el registry.
      getTheiaRegistry().register(
        buildGlslAtom('aether_serpent.glsl', AETHER_SRC, 'Factory', 'C:\\f\\aether_serpent.glsl'),
      )
      const theta = getThetaOrchestrator()

      // ── Motor APAGADO: el intent se arma, NO spawnea worker. ──────────
      await theta.playAtom({
        atomId: AETHER_ID,
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

      ;(theta as unknown as {
        handleWorkerMessage(m: { type: string }): void
      }).handleWorkerMessage({ type: 'theia:ready' })

      // Path generativo alcanzado — genoma resuelto desde el registry.
      expect(theta.getActiveShaderId()).toBe(AETHER_ID)
      expect(theta.getShaderMeta(AETHER_ID)?.genome.aggression).toBeCloseTo(0.4)
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
