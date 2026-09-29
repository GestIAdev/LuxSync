/**
 * ✈️ WAVE 8306 — TheiaAutopilot (Blueprint Ola D1 · §6.2–6.3).
 *
 * El motor corre fuera de React: el test inyecta `telemetry`/`now`/`fire`
 * y llama a `tick()` a mano — determinismo total, sin rAF ni workers.
 *
 * Certifica:
 *  - Arranque: con lista y sin LIVE, dispara el primer ítem no-skip.
 *  - DWELL + QUANT: no corta al vencer el dwell hasta la frontera
 *    (bar edge / phrase edge) y el overshoot forzado es la red de seguridad.
 *  - Modos: SEQ se detiene al final (END), LOOP hace wrap, SHUFFLE agota
 *    la bolsa sin repetir y el re-shuffle no arranca con el último LIVE.
 *  - DROP SNAP: `dropIncoming` arma el corte al próximo downbeat ignorando
 *    el dwell restante.
 *  - Audio muerto: dwell en segundos y corte inmediato sin frontera.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TheiaAutopilot,
  shuffleBag,
  type AutopilotTelemetry,
} from './TheiaAutopilot'
import { useTheiaPlaylistStore } from '../stores/useTheiaPlaylistStore'
import { useTheiaAutopilotStore } from '../stores/useTheiaAutopilotStore'

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

interface Rig {
  engine: TheiaAutopilot
  tel: AutopilotTelemetry
  fired: number[]
  xfades: number[]
  advanceBar: (n?: number) => void
  setNow: (ms: number) => void
}

function makeRig(): Rig {
  const tel = baseTel()
  const fired: number[] = []
  const xfades: number[] = []
  let nowMs = 0
  const engine = new TheiaAutopilot({
    telemetry: () => tel,
    now: () => nowMs,
    fire: (index, xfadeMs) => {
      fired.push(index)
      xfades.push(xfadeMs)
      // playAt real haría esto — el test lo emula sin orquestador.
      useTheiaPlaylistStore.setState({ activeIndex: index })
      return true
    },
  })
  return {
    engine,
    tel,
    fired,
    xfades,
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
    dropSnap: true,
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

function seedItems(n: number, skip: number[] = []) {
  const s = useTheiaPlaylistStore.getState()
  for (let i = 0; i < n; i++) {
    s.insertItem({ atomId: `atom_${i}`, label: `atom_${i}`, kind: 'shader' })
  }
  for (const i of skip) {
    s.toggleSkip(useTheiaPlaylistStore.getState().items[i].id)
  }
}

describe('WAVE 8306 — TheiaAutopilot', () => {
  beforeEach(() => {
    resetStores()
    vi.restoreAllMocks()
  })

  it('arranque: sin LIVE dispara el primer ítem no-skip y ancla el dwell', () => {
    const rig = makeRig()
    seedItems(3)
    useTheiaAutopilotStore.getState().setMode('loop')
    rig.engine.tick()
    expect(rig.fired).toEqual([0])
    // X-FADE llega en ms al disparo.
    expect(rig.xfades).toEqual([2000])
  })

  it('dwell+quant bar: no corta al vencer hasta el bar edge', () => {
    const rig = makeRig()
    seedItems(3)
    useTheiaAutopilotStore.getState().setMode('loop')
    useTheiaAutopilotStore.getState().setDwell({ unit: 'bars', value: 5 })
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    rig.tel.barPhase = 0.5
    rig.engine.tick() // ancla en barFloat 0.5
    rig.tel.barCount = 5
    rig.tel.barPhase = 0.4 // elapsed 4.9 — aún dentro del dwell
    rig.engine.tick()
    expect(rig.fired).toEqual([])
    rig.tel.barPhase = 0.6 // elapsed 5.1 — dwell vencido, sin edge nuevo
    rig.engine.tick()
    expect(rig.fired).toEqual([]) // espera la frontera
    expect(useTheiaAutopilotStore.getState().syncWaiting).toBe(true)
    rig.tel.barCount = 6 // bar edge → dispara
    rig.tel.barPhase = 0
    rig.engine.tick()
    expect(rig.fired).toEqual([1])
  })

  it('SEQ se detiene al final y reporta END', () => {
    const rig = makeRig()
    seedItems(2)
    useTheiaAutopilotStore.getState().setMode('seq')
    useTheiaPlaylistStore.setState({ activeIndex: 1 }) // último en LIVE
    rig.engine.tick() // ancla
    rig.advanceBar(5)
    rig.engine.tick()
    expect(rig.fired).toEqual([])
    expect(useTheiaAutopilotStore.getState().countdownLabel).toBe('END')
  })

  it('LOOP hace wrap al primer ítem no-skip', () => {
    const rig = makeRig()
    seedItems(3)
    useTheiaAutopilotStore.getState().setMode('loop')
    useTheiaPlaylistStore.setState({ activeIndex: 2 }) // último
    rig.engine.tick()
    rig.advanceBar(4)
    rig.engine.tick()
    expect(rig.fired).toEqual([0]) // wrap
  })

  it('SKIP: la navegación salta ítems marcados', () => {
    const rig = makeRig()
    seedItems(3, [1]) // atom_1 skipped
    useTheiaAutopilotStore.getState().setMode('loop')
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    rig.engine.tick()
    rig.advanceBar(4)
    rig.engine.tick()
    expect(rig.fired).toEqual([2]) // saltó el 1
  })

  it('SHUFFLE: agota la bolsa sin repetir consecutivos', () => {
    const rig = makeRig()
    seedItems(4)
    useTheiaAutopilotStore.getState().setMode('shuffle')
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    rig.engine.tick() // ancla (0 ya está en LIVE)
    for (let i = 0; i < 8; i++) {
      rig.advanceBar(4)
      rig.engine.tick()
    }
    expect(rig.fired.length).toBe(8)
    // Consecutivos nunca iguales — incluye el salto de bolsa.
    for (let i = 1; i < rig.fired.length; i++) {
      expect(rig.fired[i]).not.toBe(rig.fired[i - 1])
    }
    // Y ninguno repite el ítem en LIVE al arrancar (0) de inmediato.
    expect(rig.fired[0]).not.toBe(0)
  })

  it('shuffleBag: permutación completa + primer ítem ≠ último tocado', () => {
    const bag = shuffleBag([0, 1, 2, 3, 4], 2, () => 0.5)
    expect([...bag].sort()).toEqual([0, 1, 2, 3, 4])
    expect(bag[0]).not.toBe(2)
    // Lista única → se acepta la repetición inevitable.
    expect(shuffleBag([7], 7, () => 0.9)).toEqual([7])
  })

  it('DROP SNAP: dropIncoming adelanta el corte al próximo downbeat', () => {
    const rig = makeRig()
    seedItems(2)
    useTheiaAutopilotStore.getState().setMode('loop')
    useTheiaAutopilotStore.getState().setDwell({ unit: 'bars', value: 32 })
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    rig.engine.tick() // ancla bar 0
    rig.tel.dropIncoming = true
    rig.tel.barCount = 0 // aún dentro del mismo compás — sin edge aún
    rig.tel.barPhase = 0.5
    rig.engine.tick() // arma el snap; sin bar edge → no dispara aún
    expect(rig.fired).toEqual([])
    expect(useTheiaAutopilotStore.getState().countdownLabel).toBe('DROP ▸')
    rig.tel.barCount = 1 // downbeat → dispara ignorando los 31 bars restantes
    rig.engine.tick()
    expect(rig.fired).toEqual([1])
  })

  it('audio muerto: dwell en segundos y corte sin frontera', () => {
    const rig = makeRig()
    seedItems(2)
    rig.tel.audioLive = false
    useTheiaAutopilotStore.getState().setMode('loop')
    useTheiaAutopilotStore.getState().setDwell({ unit: 'sec', value: 10 })
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    rig.engine.tick() // ancla now=0
    rig.setNow(5000)
    rig.engine.tick()
    expect(rig.fired).toEqual([])
    rig.setNow(10001)
    rig.engine.tick()
    expect(rig.fired).toEqual([1]) // sin audio no hay frontera: corta directo
  })

  it('re-ancla el dwell si el operador disparó otro ítem a mano', () => {
    const rig = makeRig()
    seedItems(3)
    useTheiaAutopilotStore.getState().setMode('loop')
    useTheiaPlaylistStore.setState({ activeIndex: 0 })
    rig.engine.tick()
    rig.advanceBar(3) // 3 de 4 bars
    rig.engine.tick()
    // Manual override: el VJ dispara el ítem 2 → dwell se reinicia.
    useTheiaPlaylistStore.setState({ activeIndex: 2 })
    rig.engine.onExternalFire(2)
    rig.advanceBar(1) // count 4, phase 0 → el re-ancla ocurre en este tick
    rig.tel.barPhase = 0.5
    rig.engine.tick()
    expect(rig.fired).toEqual([])
    rig.advanceBar(4) // count 8
    rig.tel.barPhase = 0.5 // barFloat 8.5 → 4.0 bars desde el re-ancla → corta
    rig.engine.tick()
    expect(rig.fired.length).toBe(1)
  })
})
