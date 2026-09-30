/**
 * 🎬 WAVE 8307 — Director, HOLD y Selene (Blueprint Ola D2 · §6.4).
 *
 * Igual que el test D1: telemetría/reloj/disparo inyectados y `tick()` a
 * mano — determinismo total, sin rAF ni workers.
 *
 * Certifica:
 *  - Store: coherencia modo⇄director, take-over (regla de oro), HOLD.
 *  - Engine HOLD: silencio durante la ventana, cuenta atrás, reanudación
 *    automática + re-ancla del dwell, cancelación instantánea.
 *  - Selene: ganador por distancia ACO + energía, bonus de vibe, anti-repeat,
 *    ignora SEQ/LOOP/SHUFFLE, respeta `skip`, fallback a catálogo con
 *    playlist vacía, no corta lo que suena al activarse, CUE = peek.
 *  - Gate del orquestador sobre la IA legacy.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TheiaAutopilot,
  type AutopilotDeps,
  type AutopilotTelemetry,
} from './TheiaAutopilot'
import { useTheiaPlaylistStore } from '../stores/useTheiaPlaylistStore'
import { useTheiaAutopilotStore } from '../stores/useTheiaAutopilotStore'
import {
  __resetTheiaRegistryForTests,
  getTheiaRegistry,
} from '../core/theia/TheiaRegistry'
import { getThetaOrchestrator } from './ThetaOrchestrator'
import type { ITheiaAtom } from '../types/theiaTypes'

const baseTel = (): AutopilotTelemetry => ({
  bpm: 120,
  beatPhase: 0,
  barPhase: 0,
  barCount: 0,
  audioLive: true,
  onBeat: false,
  dropIncoming: false,
  crestEvent: false,
  energy: 0.5,
  harshness: 0.3,
  flatness: 0.3,
  transientDensity: 0.3,
  spectralFlux: 0.3,
})

const HOT = { energy: 0.9, harshness: 0.8, flatness: 0.3, transientDensity: 0.7, spectralFlux: 0.8 }
const COLD = { energy: 0.12, harshness: 0.05, flatness: 0.2, transientDensity: 0.05, spectralFlux: 0.05 }

interface Rig {
  engine: TheiaAutopilot
  tel: AutopilotTelemetry
  fired: number[]
  advanceBar: (n?: number) => void
  setNow: (ms: number) => void
}

function makeRig(extra: Partial<AutopilotDeps> = {}): Rig {
  const tel = baseTel()
  const fired: number[] = []
  let nowMs = 0
  const engine = new TheiaAutopilot({
    ...extra,
    telemetry: () => tel,
    now: () => nowMs,
    fire: (index) => {
      fired.push(index)
      useTheiaPlaylistStore.setState({ activeIndex: index })
      return true
    },
  })
  return {
    engine,
    tel,
    fired,
    advanceBar: (n = 1) => {
      tel.barCount += n
      tel.barPhase = 0
      tel.beatPhase = 0
    },
    setNow: (ms) => {
      nowMs = ms
    },
  }
}

function resetStores() {
  useTheiaPlaylistStore.setState({ items: [], activeIndex: -1, cueIndex: -1 })
  useTheiaAutopilotStore.setState({
    mode: 'off',
    dwell: { unit: 'bars', value: 4 },
    quant: 'bar',
    xFadeSec: 2,
    director: 'manual',
    resumeDirector: null,
    holdBars: 16,
    holdEpoch: 0,
    holdLabel: '',
    countdownLabel: '—',
    dwellFrac: 0,
    syncWaiting: false,
    engineRunning: false,
  })
}

const mkAtom = (
  id: string,
  aco: [number, number, number],
  vibes: string[] = ['generic'],
): ITheiaAtom => ({
  id,
  packId: 'pack_dir',
  filePath: `euclid://${id}`,
  aggression: aco[0],
  chaos: aco[1],
  organicity: aco[2],
  energyZone: { min: 'gentle', max: 'peak' },
  validSections: ['verse'],
  trim: { startMs: 0, endMs: 8000 },
  compatibleVibes: vibes,
  source: { kind: 'shader', glsl: '// x' },
})

function seedAtoms(atoms: ITheiaAtom[]) {
  __resetTheiaRegistryForTests()
  const reg = getTheiaRegistry()
  for (const a of atoms) expect(reg.register(a)).not.toBeNull()
  const st = useTheiaPlaylistStore.getState()
  for (const a of atoms) st.insertItem({ atomId: a.id, label: a.id, kind: 'shader' })
}

describe('WAVE 8307 — store: coherencia modo⇄director y take-over', () => {
  beforeEach(() => {
    resetStores()
  })

  it('setMode ≠OFF activa PLAYLIST desde MANUAL; OFF vuelve a MANUAL', () => {
    useTheiaAutopilotStore.getState().setMode('loop')
    expect(useTheiaAutopilotStore.getState().director).toBe('playlist')
    useTheiaAutopilotStore.getState().setMode('off')
    expect(useTheiaAutopilotStore.getState().director).toBe('manual')
  })

  it('setDirector(playlist) con modo OFF fija LOOP; selene no toca el modo', () => {
    useTheiaAutopilotStore.getState().setDirector('playlist')
    expect(useTheiaAutopilotStore.getState().mode).toBe('loop')
    useTheiaAutopilotStore.getState().setMode('shuffle')
    useTheiaAutopilotStore.getState().setDirector('selene')
    const st = useTheiaAutopilotStore.getState()
    expect(st.director).toBe('selene')
    expect(st.mode).toBe('shuffle')
  })

  it('takeOver: MANUAL es no-op; PLAYLIST/SELENE pasan a HOLD con resume', () => {
    useTheiaAutopilotStore.getState().takeOver()
    expect(useTheiaAutopilotStore.getState().director).toBe('manual')

    for (const d of ['playlist', 'selene'] as const) {
      useTheiaAutopilotStore.getState().setDirector(d)
      useTheiaAutopilotStore.getState().takeOver()
      const st = useTheiaAutopilotStore.getState()
      expect(st.director).toBe('hold')
      expect(st.resumeDirector).toBe(d)
      st.cancelHold()
      expect(useTheiaAutopilotStore.getState().director).toBe(d)
      expect(useTheiaAutopilotStore.getState().resumeDirector).toBeNull()
    }
  })

  it('un take-over dentro de un HOLD re-arma la ventana (epoch++) sin perder el resume', () => {
    useTheiaAutopilotStore.getState().setDirector('selene')
    useTheiaAutopilotStore.getState().takeOver()
    const e1 = useTheiaAutopilotStore.getState().holdEpoch
    useTheiaAutopilotStore.getState().takeOver()
    const st = useTheiaAutopilotStore.getState()
    expect(st.holdEpoch).toBe(e1 + 1)
    expect(st.director).toBe('hold')
    expect(st.resumeDirector).toBe('selene')
  })

  it('mode OFF durante un HOLD de playlist cancela la reanudación', () => {
    useTheiaAutopilotStore.getState().setMode('loop')
    useTheiaAutopilotStore.getState().takeOver()
    useTheiaAutopilotStore.getState().setMode('off')
    const st = useTheiaAutopilotStore.getState()
    expect(st.director).toBe('manual')
    expect(st.resumeDirector).toBeNull()
  })

  it('disparos del playlist store: manual ⇒ HOLD, auto ⇒ no', () => {
    seedAtoms([mkAtom('a', [0.5, 0.5, 0.5]), mkAtom('b', [0.4, 0.4, 0.6])])
    vi.spyOn(getThetaOrchestrator(), 'playAtom').mockResolvedValue(undefined)
    useTheiaAutopilotStore.getState().setDirector('playlist')

    useTheiaPlaylistStore.getState().playAt(0, 500, { auto: true })
    expect(useTheiaAutopilotStore.getState().director).toBe('playlist')

    useTheiaPlaylistStore.getState().playNext() // NEXT humano
    expect(useTheiaAutopilotStore.getState().director).toBe('hold')

    useTheiaAutopilotStore.getState().cancelHold()
    useTheiaPlaylistStore.getState().playAt(1) // click humano en tarjeta / 1–9
    expect(useTheiaAutopilotStore.getState().director).toBe('hold')
  })

  it('el gate del orquestador solo deja pasar forceState autónomo si se permite', () => {
    const theta = getThetaOrchestrator()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    theta.setAutomationGate(() => false)
    theta.forceState('drop', { manual: false })
    expect(warn).not.toHaveBeenCalled() // silenciado por el árbitro
    theta.setAutomationGate(() => true)
    theta.forceState('drop', { manual: false })
    expect(warn).toHaveBeenCalled() // pasó el gate (worker aún no listo)
    theta.setAutomationGate(null)
    warn.mockRestore()
  })
})

describe('WAVE 8307 — engine: HOLD', () => {
  beforeEach(() => {
    resetStores()
    vi.restoreAllMocks()
  })

  const items = (n: number) => {
    const s = useTheiaPlaylistStore.getState()
    for (let i = 0; i < n; i++) s.insertItem({ atomId: `x_${i}`, label: `x_${i}`, kind: 'shader' })
  }

  it('durante el HOLD la automatización calla; al expirar reanuda y re-ancla el dwell', () => {
    const rig = makeRig()
    items(3)
    const ap = useTheiaAutopilotStore.getState()
    ap.setMode('loop') // → director playlist · dwell 4 bars · quant bar
    ap.setHoldBars(4)
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    rig.engine.tick() // ancla dwell en bar 0
    rig.advanceBar(3)
    rig.engine.tick() // elapsed 3/4 — todavía no

    useTheiaAutopilotStore.getState().takeOver() // 🖐 humano
    expect(useTheiaAutopilotStore.getState().director).toBe('hold')

    rig.engine.tick() // ancla la ventana HOLD en bar 3
    expect(useTheiaAutopilotStore.getState().holdLabel).toBe('4.0 bars')
    rig.advanceBar(2)
    rig.engine.tick()
    expect(useTheiaAutopilotStore.getState().holdLabel).toBe('2.0 bars')
    expect(rig.fired).toEqual([]) // el dwell hubiera vencido: silenciado

    rig.advanceBar(2) // ventana agotada
    rig.engine.tick()
    expect(useTheiaAutopilotStore.getState().director).toBe('playlist')
    rig.engine.tick() // reanuda: re-ancla — NO dispara de inmediato
    expect(rig.fired).toEqual([])

    rig.advanceBar(4) // dwell completo desde la reanudación + bar edge
    rig.engine.tick()
    expect(rig.fired).toEqual([1])
  })

  it('cancelHold (click en el indicador) reanuda al instante y re-ancla', () => {
    const rig = makeRig()
    items(2)
    useTheiaAutopilotStore.getState().setMode('loop')
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    rig.engine.tick()
    useTheiaAutopilotStore.getState().takeOver()
    rig.engine.tick()
    useTheiaAutopilotStore.getState().cancelHold()
    expect(useTheiaAutopilotStore.getState().director).toBe('playlist')
    rig.advanceBar(2)
    rig.engine.tick() // reanudado, re-ancla — 2 bars < dwell 4
    expect(rig.fired).toEqual([])
  })

  it('audio muerto: la ventana HOLD cuenta en segundos', () => {
    const rig = makeRig()
    items(2)
    rig.tel.audioLive = false
    useTheiaAutopilotStore.getState().setMode('loop')
    useTheiaAutopilotStore.getState().setHoldBars(4) // 4 bars @120 = 8 s
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    rig.engine.tick()
    useTheiaAutopilotStore.getState().takeOver()
    rig.setNow(1000)
    rig.engine.tick() // ancla
    rig.setNow(5000)
    rig.engine.tick()
    expect(useTheiaAutopilotStore.getState().director).toBe('hold')
    rig.setNow(9100) // > 8 s desde el ancla
    rig.engine.tick()
    expect(useTheiaAutopilotStore.getState().director).toBe('playlist')
  })
})

describe('WAVE 8307 — Selene como operadora', () => {
  beforeEach(() => {
    resetStores()
    vi.restoreAllMocks()
  })

  it('con energía alta elige el ítem agresivo; con energía baja el orgánico', () => {
    seedAtoms([mkAtom('calm', [0.1, 0.1, 0.9]), mkAtom('brutal', [0.9, 0.6, 0.1])])
    useTheiaAutopilotStore.getState().setDirector('selene')

    const hot = makeRig({ hasLive: () => false })
    Object.assign(hot.tel, HOT)
    hot.engine.tick() // arranque sin LIVE → Selene decide ya
    expect(hot.fired).toEqual([1]) // 'brutal'

    useTheiaPlaylistStore.setState({ activeIndex: -1 })
    const cold = makeRig({ hasLive: () => false })
    Object.assign(cold.tel, COLD)
    cold.engine.tick()
    expect(cold.fired).toEqual([0]) // 'calm'
  })

  it('cruza el vibe: a igual ACO, gana el átomo que declara el vibe activo', () => {
    seedAtoms([
      mkAtom('a_techno', [0.5, 0.5, 0.5], ['techno-club']),
      mkAtom('b_rave', [0.5, 0.5, 0.5], ['rave']),
    ])
    useTheiaAutopilotStore.getState().setDirector('selene')
    const rig = makeRig({ hasLive: () => false, vibe: () => 'rave' })
    rig.engine.tick()
    expect(rig.fired).toEqual([1])
  })

  it('no repite el átomo en LIVE al re-decidir tras el dwell', () => {
    seedAtoms([mkAtom('brutal', [0.9, 0.6, 0.1]), mkAtom('brutal2', [0.85, 0.6, 0.15])])
    useTheiaAutopilotStore.getState().setDirector('selene')
    const rig = makeRig({ hasLive: () => false })
    Object.assign(rig.tel, HOT)
    rig.engine.tick()
    expect(rig.fired.length).toBe(1)
    const first = rig.fired[0]
    rig.advanceBar(4) // dwell 4 bars + bar edge
    rig.engine.tick()
    expect(rig.fired.length).toBe(2)
    expect(rig.fired[1]).not.toBe(first)
  })

  it('Selene ignora el modo secuencial: SEQ no avanza en orden', () => {
    seedAtoms([
      mkAtom('calm', [0.1, 0.1, 0.9]),
      mkAtom('mid', [0.5, 0.5, 0.5]),
      mkAtom('brutal', [0.9, 0.6, 0.1]),
    ])
    useTheiaAutopilotStore.getState().setMode('seq')
    useTheiaAutopilotStore.getState().setDirector('selene')
    const rig = makeRig({ hasLive: () => false })
    Object.assign(rig.tel, HOT)
    rig.engine.tick()
    expect(rig.fired).toEqual([2]) // salta directo al ganador, no al índice 0
  })

  it('los ítems skip quedan fuera del arsenal de Selene', () => {
    seedAtoms([mkAtom('brutal', [0.9, 0.6, 0.1]), mkAtom('calm', [0.1, 0.1, 0.9])])
    const first = useTheiaPlaylistStore.getState().items[0]
    useTheiaPlaylistStore.getState().toggleSkip(first.id) // el ganador natural
    useTheiaAutopilotStore.getState().setDirector('selene')
    const rig = makeRig({ hasLive: () => false })
    Object.assign(rig.tel, HOT)
    rig.engine.tick()
    expect(rig.fired).toEqual([1])
  })

  it('playlist vacía: fallback al catálogo completo (fireCatalog)', () => {
    __resetTheiaRegistryForTests()
    const catalog = [mkAtom('cat_calm', [0.1, 0.1, 0.9]), mkAtom('cat_brutal', [0.9, 0.6, 0.1])]
    useTheiaAutopilotStore.getState().setDirector('selene')
    const catalogFired: string[] = []
    const rig = makeRig({
      hasLive: () => false,
      catalog: () => catalog,
      fireCatalog: (id) => {
        catalogFired.push(id)
        return true
      },
    })
    Object.assign(rig.tel, HOT)
    rig.engine.tick()
    expect(rig.fired).toEqual([]) // no hay playlist a la que indexar
    expect(catalogFired).toEqual(['cat_brutal'])
  })

  it('no corta lo que ya suena al activar SELENE: espera al dwell', () => {
    seedAtoms([mkAtom('a', [0.1, 0.1, 0.9]), mkAtom('b', [0.9, 0.6, 0.1])])
    useTheiaAutopilotStore.getState().setDirector('selene')
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    const rig = makeRig({ hasLive: () => true })
    Object.assign(rig.tel, HOT)
    rig.engine.tick() // ancla — no dispara
    expect(rig.fired).toEqual([])
    rig.advanceBar(4)
    rig.engine.tick() // dwell 4 + bar edge → decide
    expect(rig.fired).toEqual([1])
  })

  it('peek: el CUE del lane refleja la inclinación actual de Selene', () => {
    seedAtoms([mkAtom('calm', [0.1, 0.1, 0.9]), mkAtom('brutal', [0.9, 0.6, 0.1])])
    useTheiaAutopilotStore.getState().setDirector('selene')
    useTheiaPlaylistStore.setState({ activeIndex: 0, cueIndex: -1 })
    const rig = makeRig({ hasLive: () => true })
    Object.assign(rig.tel, HOT)
    rig.engine.tick() // ancla
    rig.setNow(1000)
    rig.engine.tick() // peek (≥500 ms)
    expect(useTheiaPlaylistStore.getState().cueIndex).toBe(1)
  })
})
