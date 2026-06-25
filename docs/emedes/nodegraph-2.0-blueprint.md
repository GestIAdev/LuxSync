# NodeGraph 2.0 — Blueprint Maestro ("Operación Cuyo Arsenal")

> **Autor:** UI/UX Systems Architect — LuxSync (Mendoza, Cuyo)
> **Estado:** Diseño. Código NO implementado todavía. Este documento es el plano.
> **Dogmas respetados:** Fuente de verdad `useForgeGraphStore`. Lienzo local React Flow (`rfNodes`/`rfEdges`). NO se toca `NodeCanvas.tsx` ni reductores globales. Solo `NodeGraphTab.tsx` (envoltura) + nuevo `nodeGraphPresets.ts`.

---

## 1. Visión UX — Por qué GrandMA3 va a llorar

GrandMA3 te obliga a pensar como una consola de 1998: cue lists, executors, sintaxis de línea de comandos arcana. Para hacer parpadear una luz al ritmo necesitás un manual de 400 páginas y media hora.

**LuxSync invierte la pirámide.** El NodeGraph no es una hoja de cálculo de canales: es un **sintetizador modular Eurorack para luz**. La filosofía robada de Ableton/Bitwig:

- **Time-to-First-Flash < 10 segundos.** Abrís el tab, clickeás un preset del *Cuyo Arsenal*, y la luz ya respira con el kick. Cero cableado manual para empezar.
- **El preset es un punto de partida, no una jaula.** Como los racks de Ableton: cargás "Techno Pump" y después reconectás un cable, cambiás un LFO de sine a square, y es tuyo.
- **Feedback constante, ciberpunk, oscuro.** Contador de nodos vivo, indicador `isDirty` pulsante, botón de pánico (Blackout lógico). El operador siempre sabe el estado del sistema de un vistazo.
- **Ergonomía destructiva segura.** Atajos rápidos (cargar preset, duplicar, limpiar) pero con confirmación en los irreversibles. Velocidad sin accidentes.

GrandMA3 te hace *programar*. LuxSync te hace *jugar*. Esa es la humillación.

---

## 2. El Cockpit — Anatomía de `NodeGraphTab.tsx`

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚡ CUYO ARSENAL [▼]   │  ◉ 12 nodes · 9 wires   │  ● DIRTY  │ 🧹 PANIC │  ← Command Bar
├──────────────────────────────────────────────────────────────────────┤
│          │                                              │              │
│  PALETTE │            NODE CANVAS (React Flow)          │  INSPECTOR   │
│  (drag)  │            rfNodes / rfEdges                 │  (selected)  │
│          │                                              │              │
└──────────────────────────────────────────────────────────────────────┘
```

**Command Bar (nuevo):** barra superior flotante, glassmorphism oscuro.
- **Selector de Presets** (dropdown "CUYO ARSENAL") — el corazón de la innovación.
- **Telemetría viva:** contador de nodos/cables leído del store.
- **Indicador `isDirty`:** dot ámbar pulsante cuando hay cambios sin guardar.
- **Botón PÁNICO:** limpia el lienzo (con confirmación). Reemplaza el viejo "Clear Canvas".
- **Pack as Ingenio:** se mantiene, aparece contextualmente con selección.

---

## 3. Fases de Ejecución Propuestas

| Fase | Entregable | Riesgo | Archivos |
|---|---|---|---|
| **F1 — Arsenal** | `nodeGraphPresets.ts`: 5 grafos completos + helper de carga | Bajo (data pura) | Nuevo archivo |
| **F2 — Cockpit** | `NodeGraphTab.tsx` rediseñado: Command Bar + selector + telemetría | Bajo (solo envoltura) | `NodeGraphTab.tsx` |
| **F3 — Atajos** | Keyboard layer: `Ctrl+1..5` cargar preset, `Ctrl+Shift+K` pánico | Medio (listeners globales) | `NodeGraphTab.tsx` |
| **F4 — CSS** | Estética ciberpunk: glassmorphism, glow por categoría, animaciones | Bajo | `NodeGraphTab.css` |
| **F5 — Polish** | Toast de confirmación al cargar preset, mini-preview del grafo | Bajo | `NodeGraphTab.tsx` |

**Decisión arquitectónica clave:** Los presets se cargan vía `loadGraph(graph, fixtureId, false)` — una action que YA existe en el store. Reemplaza el lienzo con el grafo del preset, preservando el `fixtureId` actual. **Cero modificación del store.** Para "inyectar sin reemplazar" (modo aditivo futuro), se itera `addNode`/`addEdge` — también API existente.

---

## 4. Código — `nodeGraphPresets.ts`

> Puertos e IDs verificados contra las factories reales de `forgePalette.ts`.
> `output_dmx.channelType` usa valores de `ChannelType`; ajustar a los exactos del proyecto si difieren.

```typescript
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
 * @module components/views/ForgeView/palette/nodeGraphPresets
 */

import type {
  IForgeNode,
  IForgeEdge,
  IForgeNodeGraph,
  IForgePort,
  ForgeNodeId,
} from '../../../../core/forge/types'

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
```

---

## 5. Código — `NodeGraphTab.tsx` (rediseñado)

> Respeta los dogmas: solo envoltura. Carga presets vía `loadGraph` (API existente).
> El `fixtureId` actual se preserva. `NodeCanvas` re-hidrata automáticamente vía su `useEffect` sobre `graph.nodes/edges`.

```tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️  NODE GRAPH TAB 2.0 — "The Cockpit"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Envoltura del canvas de nodos. Command Bar ciberpunk con:
 *  - Selector "Cuyo Arsenal" (presets de modulación)
 *  - Telemetría viva (nodos / cables / dirty)
 *  - Botón de Pánico (limpiar lienzo)
 *  - Pack as Ingenio (contextual)
 *
 * DOGMA: NO toca NodeCanvas ni reductores. Carga presets vía store.loadGraph.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useForgeGraphStore } from '../../../../stores/forgeGraphStore'
import { CUYO_ARSENAL, type NodeGraphPreset } from '../palette/nodeGraphPresets'
import { ForgeCanvasLayout } from '../canvas/ForgeCanvasLayout'
import { NodePalette } from '../canvas/NodePalette'
import NodeCanvas from '../canvas/NodeCanvas'
import { NodeInspector } from '../inspector/NodeInspector'
import { PackIngenioModal } from './PackIngenioModal'
import './NodeGraphTab.css'

const NodeGraphTab: React.FC = () => {
  // ── Store (selección granular, sin re-render innecesario) ──────────────
  const { fixtureId, nodeCount, edgeCount, isDirty, selectedCount } =
    useForgeGraphStore(
      useShallow((s) => ({
        fixtureId: s.fixtureId,
        nodeCount: s.graph?.nodes.length ?? 0,
        edgeCount: s.graph?.edges.length ?? 0,
        isDirty: s.isDirty,
        selectedCount: s.selectedNodeIds.size,
      }))
    )
  const loadGraph = useForgeGraphStore((s) => s.loadGraph)
  const clearGraph = useForgeGraphStore((s) => s.clearGraph)

  const [arsenalOpen, setArsenalOpen] = useState(false)
  const [showPackModal, setShowPackModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // ── Cargar preset (reemplaza lienzo, preserva fixtureId) ───────────────
  const loadPreset = useCallback(
    (preset: NodeGraphPreset) => {
      const hasContent = nodeCount > 0
      if (hasContent && !window.confirm(
        `Cargar "${preset.name}"? Esto reemplaza el grafo actual.`
      )) return

      loadGraph(preset.build(), fixtureId ?? 'preset-scratch', false)
      setArsenalOpen(false)
      setToast(`⚡ ${preset.name} cargado`)
    },
    [loadGraph, fixtureId, nodeCount]
  )

  // ── Pánico: limpiar lienzo ─────────────────────────────────────────────
  const handlePanic = useCallback(() => {
    if (nodeCount === 0) return
    if (window.confirm('PÁNICO: vaciar el lienzo completo?')) clearGraph()
  }, [clearGraph, nodeCount])

  // ── Toast auto-dismiss ─────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  // ── F3: Atajos de teclado (Time-to-First-Flash) ───────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return // no robar foco de campos

      // Ctrl+1..5 → cargar preset N del arsenal
      if (e.ctrlKey && !e.shiftKey && e.key >= '1' && e.key <= '5') {
        const idx = Number(e.key) - 1
        if (CUYO_ARSENAL[idx]) {
          e.preventDefault()
          loadPreset(CUYO_ARSENAL[idx])
        }
      }
      // Ctrl+Shift+K → pánico
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handlePanic()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loadPreset, handlePanic])

  const arsenalLabel = useMemo(
    () => (arsenalOpen ? 'CUYO ARSENAL ▲' : 'CUYO ARSENAL ▼'),
    [arsenalOpen]
  )

  return (
    <div className="ng-cockpit">
      {/* ═══ COMMAND BAR ═══ */}
      <div className="ng-commandbar">
        {/* Arsenal selector */}
        <div className="ng-arsenal">
          <button
            className="ng-arsenal__trigger"
            onClick={() => setArsenalOpen((o) => !o)}
            title="Cargar un preset de modulación (Ctrl+1..5)"
          >
            <span className="ng-arsenal__bolt">⚡</span> {arsenalLabel}
          </button>

          {arsenalOpen && (
            <div className="ng-arsenal__menu" role="menu">
              {CUYO_ARSENAL.map((p, i) => (
                <button
                  key={p.id}
                  className="ng-arsenal__item"
                  style={{ ['--accent' as string]: p.accent }}
                  onClick={() => loadPreset(p)}
                  role="menuitem"
                >
                  <span className="ng-arsenal__icon">{p.icon}</span>
                  <span className="ng-arsenal__text">
                    <span className="ng-arsenal__name">{p.name}</span>
                    <span className="ng-arsenal__desc">{p.description}</span>
                  </span>
                  <span className="ng-arsenal__hotkey">Ctrl+{i + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Telemetría viva */}
        <div className="ng-telemetry">
          <span className="ng-stat" title="Nodos en el grafo">
            ◉ {nodeCount} <em>nodes</em>
          </span>
          <span className="ng-stat" title="Conexiones activas">
            ⌥ {edgeCount} <em>wires</em>
          </span>
          {isDirty && (
            <span className="ng-stat ng-stat--dirty" title="Cambios sin guardar">
              ● DIRTY
            </span>
          )}
        </div>

        {/* Acciones */}
        <div className="ng-actions">
          {selectedCount > 0 && (
            <button
              className="ng-btn ng-btn--pack"
              onClick={() => setShowPackModal(true)}
              title="Empaquetar selección como Ingenio reusable"
            >
              📦 Pack ({selectedCount})
            </button>
          )}
          <button
            className="ng-btn ng-btn--panic"
            onClick={handlePanic}
            title="Vaciar el lienzo (Ctrl+Shift+K)"
          >
            🧹 PANIC
          </button>
        </div>
      </div>

      {/* ═══ CANVAS ═══ */}
      <React.Suspense fallback={<div className="ng-loading">Loading canvas…</div>}>
        <ForgeCanvasLayout
          palette={<NodePalette />}
          canvas={<NodeCanvas />}
          inspector={<NodeInspector />}
        />
      </React.Suspense>

      {/* ═══ TOAST ═══ */}
      {toast && <div className="ng-toast">{toast}</div>}

      {showPackModal && <PackIngenioModal onClose={() => setShowPackModal(false)} />}
    </div>
  )
}

export default NodeGraphTab
```

---

## 6. CSS — Esqueleto ciberpunk (`NodeGraphTab.css`, fase F4)

```css
.ng-cockpit { display: flex; flex-direction: column; height: 100%; position: relative; }

.ng-commandbar {
  display: flex; align-items: center; gap: 16px;
  padding: 8px 14px;
  background: linear-gradient(180deg, rgba(10,10,18,0.92), rgba(10,10,18,0.72));
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0,243,255,0.15);
  z-index: 20;
}

.ng-arsenal { position: relative; }
.ng-arsenal__trigger {
  background: rgba(0,243,255,0.08); color: #00f3ff;
  border: 1px solid rgba(0,243,255,0.35); border-radius: 6px;
  padding: 6px 12px; font-weight: 700; letter-spacing: 0.5px; cursor: pointer;
  transition: box-shadow .15s, background .15s;
}
.ng-arsenal__trigger:hover { box-shadow: 0 0 16px rgba(0,243,255,0.35); }

.ng-arsenal__menu {
  position: absolute; top: 110%; left: 0; width: 360px;
  background: rgba(12,12,20,0.97); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 6px; box-shadow: 0 18px 50px rgba(0,0,0,0.6);
}
.ng-arsenal__item {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 10px; background: transparent; border: none; border-radius: 8px;
  cursor: pointer; text-align: left; border-left: 3px solid var(--accent, #888);
  transition: background .12s;
}
.ng-arsenal__item:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.ng-arsenal__icon { font-size: 22px; }
.ng-arsenal__name { display: block; color: #fff; font-weight: 700; }
.ng-arsenal__desc { display: block; color: #9aa; font-size: 11px; }
.ng-arsenal__hotkey { margin-left: auto; color: #667; font-size: 10px; font-family: monospace; }

.ng-telemetry { display: flex; gap: 14px; margin-left: 8px; }
.ng-stat { color: #cdd; font-size: 12px; font-family: monospace; }
.ng-stat em { color: #788; font-style: normal; }
.ng-stat--dirty { color: #ffb800; animation: ng-pulse 1.2s infinite; }
@keyframes ng-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

.ng-actions { display: flex; gap: 8px; margin-left: auto; }
.ng-btn { border-radius: 6px; padding: 6px 12px; cursor: pointer; font-weight: 700; border: 1px solid transparent; }
.ng-btn--pack { background: rgba(191,90,242,0.12); color: #bf5af2; border-color: rgba(191,90,242,0.4); }
.ng-btn--panic { background: rgba(255,45,85,0.12); color: #ff2d55; border-color: rgba(255,45,85,0.4); }
.ng-btn--panic:hover { box-shadow: 0 0 16px rgba(255,45,85,0.4); }

.ng-toast {
  position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: rgba(0,243,255,0.12); color: #00f3ff;
  border: 1px solid rgba(0,243,255,0.4); border-radius: 8px;
  padding: 10px 20px; font-weight: 700; backdrop-filter: blur(8px);
  animation: ng-toast-in .25s ease-out; z-index: 30;
}
@keyframes ng-toast-in { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
```

---

## 7. Notas de Integración y Verificación

- **Import paths:** `NodeGraphTab` está actualmente inline en `FixtureForgeEmbedded.tsx`. Al extraerlo a su propio archivo, ajustar el import en `FixtureForgeEmbedded.tsx` y verificar las rutas relativas de `NodePalette`, `NodeCanvas`, `NodeInspector`, `PackIngenioModal`.
- **`loadGraph` y selección:** tras cargar un preset, conviene resetear selección/inspector. `loadGraph` ya reinicia el grafo; si persiste un `inspectedNodeId` viejo, llamar `inspectNode(null)` tras `loadPreset` (ambas son API existente).
- **`ChannelType`:** los presets usan `'dimmer'`. Para grafos multicolor (Aurora, Synthwave) mapear outputs a `red/green/blue` según los valores reales del enum `ChannelType` del proyecto antes de implementar.
- **Blindaje confirmado:** todos los edges de los presets conectan 1 output → 1 input único. Ninguno viola la regla anti multi-conexión del store; cargarán sin rechazos.
- **Verificación final (al implementar):** `npx tsc --noEmit` debe pasar con 0 errores nuevos. Smoke test: cargar cada uno de los 5 presets, confirmar render del grafo en el canvas y que el contador de telemetría refleje nodos/cables correctos.
