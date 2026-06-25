/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ CUYO ARSENAL — Node Graph Presets
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 5 grafos de modulación pre-cableados, listos para disparar.
 * Cada preset es un IForgeNodeGraph completo y serializable.
 *
 * DOGMA: data pura. No importa stores ni componentes. Se carga vía
 * useForgeGraphStore.loadGraph() desde NodeGraphTab.
 *
 * @module components/views/ForgeView/tabs/nodegraph/palette/nodeGraphPresets
 */

import type {
  IForgeNode,
  IForgeEdge,
  IForgeNodeGraph,
  IForgePort,
  ForgeNodeId,
} from '../../../../../../core/forge/types'

// ── Port builders (espejo de forgePalette) ──────────────────────────────

function inP(id: string, label: string, dataType: IForgePort['dataType'], def = 0): IForgePort {
  return { id, label, dataType, direction: 'in', defaultValue: def, required: true }
}
function outP(id: string, label: string, dataType: IForgePort['dataType']): IForgePort {
  return { id, label, dataType, direction: 'out', defaultValue: 0 }
}

function edge(id: string, s: ForgeNodeId, sp: string, t: ForgeNodeId, tp: string): IForgeEdge {
  return { id, sourceNode: s, sourcePort: sp, targetNode: t, targetPort: tp }
}

function meta(wave: string, footprint: number) {
  return {
    createdAt: new Date().toISOString(),
    generatorWave: wave,
    autoMigrated: false,
    dmxFootprint: footprint,
  } as const
}

// ── Preset descriptor (para la UI del selector) ──────────────────────────

export interface NodeGraphPreset {
  readonly id: string
  readonly name: string
  readonly genre: string
  readonly icon: string
  readonly description: string
  /** Color de acento para la tarjeta del selector */
  readonly accent: string
  readonly build: () => IForgeNodeGraph
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESET 1 — "CARPENTER BRUT STROBE" (Synthwave)
// ═══════════════════════════════════════════════════════════════════════════
// Beat → threshold → gate sobre un LFO square rápido.
// El kick abre la compuerta; el LFO square genera el strobe duro.
// Energía RMS modula la amplitud del strobe (más fuerte = más brillo).

function buildCarpenterBrut(): IForgeNodeGraph {
  const beat: IForgeNode = {
    id: 'cb_beat', type: 'input_beat', category: 'input', label: 'Kick',
    uiPosition: { x: 40, y: 80 }, inputs: [], outputs: [outP('output', 'beat', 'boolean')],
    config: { nodeType: 'input_beat', mode: 'gate', pulseDurationMs: 40 },
  }
  const energy: IForgeNode = {
    id: 'cb_energy', type: 'input_energy', category: 'input', label: 'RMS',
    uiPosition: { x: 40, y: 240 }, inputs: [], outputs: [outP('output', 'rms', 'normalized')],
    config: { nodeType: 'input_energy', source: 'rms', smoothingMs: 60 },
  }
  const lfo: IForgeNode = {
    id: 'cb_lfo', type: 'proc_lfo', category: 'process', label: 'Strobe Core',
    uiPosition: { x: 320, y: 200 },
    inputs: [inP('amplitude', 'amplitude', 'normalized', 1), inP('modulation', 'mod rate', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'proc_lfo', waveform: 'square', frequencyHz: 12, syncToBpm: true, bpmDivisor: 0.25, phase: 0 },
  }
  const gate: IForgeNode = {
    id: 'cb_gate', type: 'logic_gate', category: 'logic', label: 'Kick Gate',
    uiPosition: { x: 600, y: 140 },
    inputs: [inP('signal', 'signal', 'normalized', 0), inP('gate', 'gate', 'boolean', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'logic_gate', threshold: 0.5 },
  }
  const out: IForgeNode = {
    id: 'cb_out', type: 'output_dmx', category: 'output', label: 'Dimmer',
    uiPosition: { x: 880, y: 140 }, inputs: [inP('input', 'value', 'normalized', 0)], outputs: [],
    config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 0, defaultDmxValue: 0, is16bit: false },
  }
  return {
    version: '1.0.0',
    nodes: [beat, energy, lfo, gate, out],
    edges: [
      edge('cb_e1', energy.id, 'output', lfo.id, 'amplitude'),
      edge('cb_e2', lfo.id, 'output', gate.id, 'signal'),
      edge('cb_e3', beat.id, 'output', gate.id, 'gate'),
      edge('cb_e4', gate.id, 'output', out.id, 'input'),
    ],
    meta: meta('CUYO-ARSENAL/carpenter-brut', 1),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESET 2 — "TECHNO PUMP" (Techno)
// ═══════════════════════════════════════════════════════════════════════════
// Sidechain clásico: LFO sawtooth invertido sincronizado a 1 beat genera el
// "pump" (la luz baja en el kick y sube entre kicks). Curva exponencial para
// que el pump sea agresivo. Clamp de seguridad.

function buildTechnoPump(): IForgeNodeGraph {
  const lfo: IForgeNode = {
    id: 'tp_lfo', type: 'proc_lfo', category: 'process', label: 'Pump LFO',
    uiPosition: { x: 60, y: 160 },
    inputs: [inP('amplitude', 'amplitude', 'normalized', 1), inP('modulation', 'mod rate', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'proc_lfo', waveform: 'sawtooth', frequencyHz: 2, syncToBpm: true, bpmDivisor: 1, phase: 0 },
  }
  const invert: IForgeNode = {
    id: 'tp_inv', type: 'proc_invert', category: 'process', label: 'Sidechain',
    uiPosition: { x: 340, y: 160 }, inputs: [inP('input', 'input', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')], config: { nodeType: 'proc_invert' },
  }
  const curve: IForgeNode = {
    id: 'tp_curve', type: 'proc_curve', category: 'process', label: 'Punch',
    uiPosition: { x: 600, y: 160 }, inputs: [inP('input', 'input', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'proc_curve', curveType: 'exponential', exponent: 2.5 },
  }
  const clamp: IForgeNode = {
    id: 'tp_clamp', type: 'proc_clamp', category: 'process', label: 'Safety',
    uiPosition: { x: 860, y: 160 }, inputs: [inP('input', 'input', 'unbounded', 0)],
    outputs: [outP('output', 'output', 'normalized')], config: { nodeType: 'proc_clamp', min: 0.05, max: 1 },
  }
  const out: IForgeNode = {
    id: 'tp_out', type: 'output_dmx', category: 'output', label: 'Wash',
    uiPosition: { x: 1120, y: 160 }, inputs: [inP('input', 'value', 'normalized', 0)], outputs: [],
    config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 0, defaultDmxValue: 0, is16bit: false },
  }
  return {
    version: '1.0.0',
    nodes: [lfo, invert, curve, clamp, out],
    edges: [
      edge('tp_e1', lfo.id, 'output', invert.id, 'input'),
      edge('tp_e2', invert.id, 'output', curve.id, 'input'),
      edge('tp_e3', curve.id, 'output', clamp.id, 'input'),
      edge('tp_e4', clamp.id, 'output', out.id, 'input'),
    ],
    meta: meta('CUYO-ARSENAL/techno-pump', 1),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESET 3 — "DUB REGGAE BREATH" (Dub / Reggae)
// ═══════════════════════════════════════════════════════════════════════════
// Respiración lenta y orgánica. Bass band → smooth largo → LFO triangular
// lento sumado (merge avg). Sensación de oleaje cálido, nunca duro.

function buildDubBreath(): IForgeNodeGraph {
  const bass: IForgeNode = {
    id: 'db_bass', type: 'input_audio_band', category: 'input', label: 'Bassline',
    uiPosition: { x: 40, y: 80 }, inputs: [], outputs: [outP('output', 'energy', 'normalized')],
    config: { nodeType: 'input_audio_band', band: 'bass' },
  }
  const smooth: IForgeNode = {
    id: 'db_smooth', type: 'proc_smooth', category: 'process', label: 'Breath',
    uiPosition: { x: 320, y: 80 }, inputs: [inP('input', 'input', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'proc_smooth', attackMs: 800, releaseMs: 1400 },
  }
  const lfo: IForgeNode = {
    id: 'db_lfo', type: 'proc_lfo', category: 'process', label: 'Tide',
    uiPosition: { x: 320, y: 280 },
    inputs: [inP('amplitude', 'amplitude', 'normalized', 0.4), inP('modulation', 'mod rate', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'proc_lfo', waveform: 'triangle', frequencyHz: 0.2, syncToBpm: false, bpmDivisor: 8, phase: 0 },
  }
  const merge: IForgeNode = {
    id: 'db_merge', type: 'proc_merge', category: 'process', label: 'Blend',
    uiPosition: { x: 620, y: 180 },
    inputs: [inP('a', 'A', 'normalized', 0), inP('b', 'B', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')], config: { nodeType: 'proc_merge', strategy: 'average' },
  }
  const out: IForgeNode = {
    id: 'db_out', type: 'output_dmx', category: 'output', label: 'Amber Wash',
    uiPosition: { x: 900, y: 180 }, inputs: [inP('input', 'value', 'normalized', 0)], outputs: [],
    config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 0, defaultDmxValue: 0, is16bit: false },
  }
  return {
    version: '1.0.0',
    nodes: [bass, smooth, lfo, merge, out],
    edges: [
      edge('db_e1', bass.id, 'output', smooth.id, 'input'),
      edge('db_e2', smooth.id, 'output', merge.id, 'a'),
      edge('db_e3', lfo.id, 'output', merge.id, 'b'),
      edge('db_e4', merge.id, 'output', out.id, 'input'),
    ],
    meta: meta('CUYO-ARSENAL/dub-breath', 1),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESET 4 — "DRUM & BASS RIPPER" (DnB)
// ═══════════════════════════════════════════════════════════════════════════
// Treble (hi-hats/snares) → threshold rápido dispara un LFO random_hold que
// salta valores caóticos. Curva scurve para contraste. Energía peak modula
// la amplitud del caos. Frenético pero musical.

function buildDnbRipper(): IForgeNodeGraph {
  const treble: IForgeNode = {
    id: 'dnb_tr', type: 'input_audio_band', category: 'input', label: 'Hats',
    uiPosition: { x: 40, y: 80 }, inputs: [], outputs: [outP('output', 'energy', 'normalized')],
    config: { nodeType: 'input_audio_band', band: 'treble' },
  }
  const peak: IForgeNode = {
    id: 'dnb_pk', type: 'input_energy', category: 'input', label: 'Peak',
    uiPosition: { x: 40, y: 260 }, inputs: [], outputs: [outP('output', 'rms', 'normalized')],
    config: { nodeType: 'input_energy', source: 'peak', smoothingMs: 30 },
  }
  const thr: IForgeNode = {
    id: 'dnb_thr', type: 'logic_threshold', category: 'logic', label: 'Trigger',
    uiPosition: { x: 320, y: 80 }, inputs: [inP('input', 'input', 'normalized', 0)],
    outputs: [outP('output', 'gate', 'boolean')], config: { nodeType: 'logic_threshold', threshold: 0.45, hysteresis: 0.08 },
  }
  const lfo: IForgeNode = {
    id: 'dnb_lfo', type: 'proc_lfo', category: 'process', label: 'Chaos',
    uiPosition: { x: 600, y: 180 },
    inputs: [inP('amplitude', 'amplitude', 'normalized', 1), inP('modulation', 'mod rate', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'proc_lfo', waveform: 'random_hold', frequencyHz: 16, syncToBpm: true, bpmDivisor: 0.125, phase: 0 },
  }
  const gate: IForgeNode = {
    id: 'dnb_gate', type: 'logic_gate', category: 'logic', label: 'Hat Gate',
    uiPosition: { x: 880, y: 140 },
    inputs: [inP('signal', 'signal', 'normalized', 0), inP('gate', 'gate', 'boolean', 0)],
    outputs: [outP('output', 'output', 'normalized')], config: { nodeType: 'logic_gate', threshold: 0.5 },
  }
  const curve: IForgeNode = {
    id: 'dnb_cv', type: 'proc_curve', category: 'process', label: 'Contrast',
    uiPosition: { x: 1140, y: 140 }, inputs: [inP('input', 'input', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')], config: { nodeType: 'proc_curve', curveType: 'scurve' },
  }
  const out: IForgeNode = {
    id: 'dnb_out', type: 'output_dmx', category: 'output', label: 'Strobe Bar',
    uiPosition: { x: 1400, y: 140 }, inputs: [inP('input', 'value', 'normalized', 0)], outputs: [],
    config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 0, defaultDmxValue: 0, is16bit: false },
  }
  return {
    version: '1.0.0',
    nodes: [treble, peak, thr, lfo, gate, curve, out],
    edges: [
      edge('dnb_e1', treble.id, 'output', thr.id, 'input'),
      edge('dnb_e2', peak.id, 'output', lfo.id, 'amplitude'),
      edge('dnb_e3', lfo.id, 'output', gate.id, 'signal'),
      edge('dnb_e4', thr.id, 'output', gate.id, 'gate'),
      edge('dnb_e5', gate.id, 'output', curve.id, 'input'),
      edge('dnb_e6', curve.id, 'output', out.id, 'input'),
    ],
    meta: meta('CUYO-ARSENAL/dnb-ripper', 1),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESET 5 — "AMBIENT AURORA" (Ambient / Chill)
// ═══════════════════════════════════════════════════════════════════════════
// Tres LFOs sine desfasados (phase 0, 0.33, 0.66) sobre la misma base lenta,
// mezclados con merge avg → un shimmer suave tipo aurora boreal. BPM ignorado,
// tiempo libre. El RMS apenas levanta el piso de brillo.

function buildAmbientAurora(): IForgeNodeGraph {
  const time: IForgeNode = {
    id: 'aa_time', type: 'input_time', category: 'input', label: 'Free Clock',
    uiPosition: { x: 40, y: 200 }, inputs: [], outputs: [outP('output', 'time', 'normalized')],
    config: { nodeType: 'input_time', mode: 'ramp' },
  }
  const lfoA: IForgeNode = {
    id: 'aa_a', type: 'proc_lfo', category: 'process', label: 'Aurora R',
    uiPosition: { x: 320, y: 60 },
    inputs: [inP('amplitude', 'amplitude', 'normalized', 0.7), inP('modulation', 'mod rate', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'proc_lfo', waveform: 'sine', frequencyHz: 0.08, syncToBpm: false, bpmDivisor: 16, phase: 0 },
  }
  const lfoB: IForgeNode = {
    id: 'aa_b', type: 'proc_lfo', category: 'process', label: 'Aurora G',
    uiPosition: { x: 320, y: 220 },
    inputs: [inP('amplitude', 'amplitude', 'normalized', 0.7), inP('modulation', 'mod rate', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'proc_lfo', waveform: 'sine', frequencyHz: 0.08, syncToBpm: false, bpmDivisor: 16, phase: 0.33 },
  }
  const lfoC: IForgeNode = {
    id: 'aa_c', type: 'proc_lfo', category: 'process', label: 'Aurora B',
    uiPosition: { x: 320, y: 380 },
    inputs: [inP('amplitude', 'amplitude', 'normalized', 0.7), inP('modulation', 'mod rate', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')],
    config: { nodeType: 'proc_lfo', waveform: 'sine', frequencyHz: 0.08, syncToBpm: false, bpmDivisor: 16, phase: 0.66 },
  }
  const mergeAB: IForgeNode = {
    id: 'aa_m1', type: 'proc_merge', category: 'process', label: 'Blend RG',
    uiPosition: { x: 620, y: 140 },
    inputs: [inP('a', 'A', 'normalized', 0), inP('b', 'B', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')], config: { nodeType: 'proc_merge', strategy: 'average' },
  }
  const mergeAll: IForgeNode = {
    id: 'aa_m2', type: 'proc_merge', category: 'process', label: 'Blend All',
    uiPosition: { x: 880, y: 240 },
    inputs: [inP('a', 'A', 'normalized', 0), inP('b', 'B', 'normalized', 0)],
    outputs: [outP('output', 'output', 'normalized')], config: { nodeType: 'proc_merge', strategy: 'average' },
  }
  const out: IForgeNode = {
    id: 'aa_out', type: 'output_dmx', category: 'output', label: 'Sky Wash',
    uiPosition: { x: 1140, y: 240 }, inputs: [inP('input', 'value', 'normalized', 0)], outputs: [],
    config: { nodeType: 'output_dmx', channelType: 'dimmer', dmxOffset: 0, defaultDmxValue: 0, is16bit: false },
  }
  return {
    version: '1.0.0',
    nodes: [time, lfoA, lfoB, lfoC, mergeAB, mergeAll, out],
    edges: [
      edge('aa_e1', time.id, 'output', lfoA.id, 'modulation'),
      edge('aa_e2', time.id, 'output', lfoB.id, 'modulation'),
      edge('aa_e3', time.id, 'output', lfoC.id, 'modulation'),
      edge('aa_e4', lfoA.id, 'output', mergeAB.id, 'a'),
      edge('aa_e5', lfoB.id, 'output', mergeAB.id, 'b'),
      edge('aa_e6', mergeAB.id, 'output', mergeAll.id, 'a'),
      edge('aa_e7', lfoC.id, 'output', mergeAll.id, 'b'),
      edge('aa_e8', mergeAll.id, 'output', out.id, 'input'),
    ],
    meta: meta('CUYO-ARSENAL/ambient-aurora', 1),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ARSENAL — Catálogo exportado
// ═══════════════════════════════════════════════════════════════════════════

export const CUYO_ARSENAL: readonly NodeGraphPreset[] = [
  {
    id: 'carpenter-brut', name: 'Carpenter Brut Strobe', genre: 'Synthwave', icon: '🌆',
    accent: '#ff2d9b', description: 'Kick-gated square strobe modulado por RMS. Brutal y retro.',
    build: buildCarpenterBrut,
  },
  {
    id: 'techno-pump', name: 'Techno Pump', genre: 'Techno', icon: '🔊',
    accent: '#00f3ff', description: 'Sidechain sawtooth invertido con punch exponencial. El bombo respira.',
    build: buildTechnoPump,
  },
  {
    id: 'dub-breath', name: 'Dub Reggae Breath', genre: 'Dub', icon: '🌿',
    accent: '#39ff14', description: 'Bassline suavizado + marea triangular. Oleaje cálido y orgánico.',
    build: buildDubBreath,
  },
  {
    id: 'dnb-ripper', name: 'Drum & Bass Ripper', genre: 'DnB', icon: '⚡',
    accent: '#ffb800', description: 'Hi-hats disparan caos random_hold con contraste scurve. Frenético.',
    build: buildDnbRipper,
  },
  {
    id: 'ambient-aurora', name: 'Ambient Aurora', genre: 'Ambient', icon: '🌌',
    accent: '#bf5af2', description: 'Tres senos desfasados en free-clock. Shimmer tipo aurora boreal.',
    build: buildAmbientAurora,
  },
] as const
