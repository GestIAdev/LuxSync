# 🏛️ WAVE 1193: THE GREAT DIVIDE
## Blueprint de Reestructuración del Neural Command Center

**Versión:** 1.0  
**Autor:** PunkOpus  
**Fecha:** 2026-02-06  
**Estado:** BLUEPRINT - No implementar hasta aprobación

---

## 📐 PROBLEMA ACTUAL

```
┌─────────────────────────────────────────────────────────────┐
│  NEURAL COMMAND CENTER (Actual - UN INFIERNO)               │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │  AudioSpec   │ │  Chromatic   │ │   Context    │  ← 120px │
│ │  (aplastado) │ │  (truncado)  │ │  (overflow)  │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│ │AIState  │ │DreamFor │ │ Ethics  │ │ Oracle  │   ← 160px  │
│ │(cramped)│ │(cramped)│ │(no text)│ │(flicker)│             │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘             │
│ ┌───────────────────────────────────────────────┐           │
│ │  NEURAL STREAM (el único que respira)         │           │
│ │  ........................................     │           │
│ └───────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

**Síntomas:**
- Cards peleándose por 160px de altura
- Scroll interno en casi todo
- Información truncada/oculta
- CSS lleno de hacks (`min-height`, `max-height`, `overflow: hidden`)
- El Oracle parpadea porque alterna entre dos layouts

---

## 🎯 SOLUCIÓN: THE GREAT DIVIDE

Dividir el Neural Command Center en **3 sub-pestañas temáticas**, cada una ocupando el **100% del viewport disponible**.

```
┌─────────────────────────────────────────────────────────────┐
│  NEURAL COMMAND CENTER                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 🎛️ SENSORY  │ │ 🧠 CONSCIOUS │ │ 📜 STREAM    │        │
│  │   (active)   │ │              │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│           [CONTENIDO DE LA TAB ACTIVA]                      │
│              Ocupa 100% del espacio                         │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 🎛️ TAB A: SENSORY VIEW
## "Lo que Selene SIENTE"

### Layout: Asimétrico 2 columnas (70/30) + Footer

```
┌─────────────────────────────────────────────────────────────────────┐
│  🎛️ SENSORY                                                        │
├───────────────────────────────────────┬─────────────────────────────┤
│                                       │                             │
│       🎵 AUDIO SPECTRUM               │    🎨 CHROMATIC CORE        │
│          (EXPANDIDO)                  │       (COMPLETO)            │
│                                       │                             │
│   ┌─────────────────────────────┐    │   ┌───────────────────┐     │
│   │ ████████████████████████████│    │   │    COLOR WHEEL    │     │
│   │ █████████████████████░░░░░░░│    │   │       ◯           │     │
│   │ ████████████████░░░░░░░░░░░░│    │   │    Current: #8B5CF6│     │
│   │ ██████████████░░░░░░░░░░░░░░│    │   │    Temp: 6500K    │     │
│   │ ████████████░░░░░░░░░░░░░░░░│    │   └───────────────────┘     │
│   │ ██████████░░░░░░░░░░░░░░░░░░│    │                             │
│   │ ████████░░░░░░░░░░░░░░░░░░░░│    │   ┌───────────────────┐     │
│   │ ██████░░░░░░░░░░░░░░░░░░░░░░│    │   │   CHORD DISPLAY   │     │
│   │ ████░░░░░░░░░░░░░░░░░░░░░░░░│    │   │    Am7 → Dm9      │     │
│   │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░│    │   │   ♪ ♪ ♭ ♯ ♮       │     │
│   └─────────────────────────────┘    │   └───────────────────┘     │
│                                       │                             │
│   Band Labels:                        │   ┌───────────────────┐     │
│   SUB  BASS  LOW  MID  HIGH  AIR     │   │  HARMONY ENGINE   │     │
│   60   120   250  1k   4k    12k     │   │  Mode: Analogous  │     │
│                                       │   │  Spread: 30°      │     │
│   Peak Detection: ████████░░ 78%     │   │  Saturation: 85%  │     │
│   Spectral Flux:  ██████████ HIGH    │   └───────────────────┘     │
│                                       │                             │
├───────────────────────────────────────┴─────────────────────────────┤
│                                                                     │
│                    📊 CONTEXT MATRIX (EXPANDIDO)                    │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │   🎵 BPM   │ │   🎹 KEY   │ │  📍 SECT   │ │  ⚡ ENERGY │       │
│  │    128     │ │   Am       │ │   DROP     │ │    0.87    │       │
│  │  ±2 drift  │ │  -3 semi   │ │  bar 64    │ │   PEAK 🔥  │       │
│  │  ▁▂▃▅▇    │ │  Dorian?   │ │  4/4 time  │ │  ▂▃▅▇█    │       │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │  🌡️ VIBE  │ │  📈 TREND  │ │  🎭 MOOD   │ │  🕐 TIME   │       │
│  │  EUPHORIC  │ │   RISING   │ │  ENERGETIC │ │  03:24.5   │       │
│  │  conf: 92% │ │  +0.034/s  │ │  intensity │ │  /05:30    │       │
│  │  prev:DARK │ │  ↗ ↗ ↗    │ │  HIGH      │ │  ▓▓▓▓▓░░░  │       │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Componentes Expandidos

#### 1. 🎵 AUDIO SPECTRUM TITAN
**Dimensiones:** ~70% width, ~60% height  
**Mejoras:**
- **32 bandas** (actualmente ~12-16 comprimidas)
- **Height: 300px+** (actualmente ~100px)
- Etiquetas de frecuencia visibles (SUB 60Hz, BASS 120Hz, etc.)
- **Peak hold indicators** (líneas que marcan el pico reciente)
- **Spectral Flux meter** (qué tan "cambiante" es el espectro)
- **Gradient dinámico** basado en energía (azul→violeta→rojo)

```tsx
// Datos adicionales a mostrar:
interface AudioSpectrumExpanded {
  bands: number[]           // 32 bandas
  peakHold: number[]        // Picos retenidos 500ms
  spectralFlux: number      // 0-1, volatilidad
  dominantBand: string      // "MID", "BASS", etc
  energyDistribution: {
    sub: number             // % de energía en sub
    bass: number
    mid: number
    high: number
    air: number
  }
}
```

#### 2. 🎨 CHROMATIC CORE COMPLETO
**Dimensiones:** ~30% width, ~60% height  
**Mejoras:**
- **Color Wheel visual** (círculo cromático con el color actual)
- **Temperatura de color** (2000K cálido → 10000K frío)
- **Chord Display** (progresión armónica detectada)
- **Harmony Engine settings** visible:
  - Modo: Complementary, Analogous, Triadic, etc.
  - Spread angular
  - Saturation target

```tsx
interface ChromaticCoreExpanded {
  currentHue: number        // 0-360
  currentSaturation: number // 0-100
  currentBrightness: number // 0-100
  temperature: number       // Kelvin
  harmonyMode: 'complementary' | 'analogous' | 'triadic' | 'split'
  harmonySpread: number     // Grados
  detectedChord: string     // "Am7", "Dm9", etc
  chordProgression: string[] // Últimos 4 acordes
  colorHistory: string[]    // Últimos 8 colores hex
}
```

#### 3. 📊 CONTEXT MATRIX EXPANDIDO
**Dimensiones:** 100% width, ~35% height  
**Mejoras:**
- **8 cards** en vez de 4 comprimidas
- **Mini-sparklines** dentro de cada card
- **Valores secundarios** visibles (drift, confidence, etc.)
- **Previous state** para contexto temporal

```tsx
interface ContextMatrixExpanded {
  bpm: {
    current: number
    drift: number           // ±N variación
    history: number[]       // Últimos 30 valores
    confidence: number
  }
  key: {
    current: string         // "Am"
    mode: string            // "Dorian", "Minor"
    transposition: number   // Semitonos desde original
    confidence: number
  }
  section: {
    current: string         // "DROP", "BUILDUP", etc
    bar: number
    timeSignature: string   // "4/4"
    nextExpected: string
  }
  energy: {
    current: number         // 0-1
    zone: 'calm' | 'rising' | 'peak' | 'falling'
    history: number[]
  }
  vibe: {
    current: string         // "EUPHORIC"
    confidence: number
    previous: string
  }
  trend: {
    direction: 'rising' | 'falling' | 'stable'
    velocity: number        // Δ por segundo
    sparkline: number[]
  }
  mood: {
    current: string
    intensity: 'low' | 'medium' | 'high'
  }
  timing: {
    elapsed: number         // Segundos
    total: number           // Duración estimada
    progress: number        // 0-1
  }
}
```

---

# 🧠 TAB B: CONSCIOUSNESS VIEW
## "Lo que Selene PIENSA"

### Layout: Grid 2x2 equilibrado

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧠 CONSCIOUSNESS                                                   │
├─────────────────────────────────┬───────────────────────────────────┤
│                                 │                                   │
│     🐱 AI STATE (EXPANDIDO)     │      🔮 THE ORACLE (HÍBRIDO)      │
│                                 │                                   │
│  ┌───────────────────────────┐  │  ┌─────────────────────────────┐  │
│  │ 😺 STALKING               │  │  │  ⚠️ DROP INCOMING - 78%     │  │
│  │ ════════════════░░░░░░░░░ │  │  │     ETA: 4 beats            │  │
│  │ Confidence: 87%           │  │  │  ┌─────────────────────┐    │  │
│  └───────────────────────────┘  │  │  │      SPARKLINE      │    │  │
│                                 │  │  │   ╱╲  ╱╲    ╱╲      │    │  │
│  Hunt Duration: 4.2s            │  │  │  ╱  ╲╱  ╲╱╲╱  ╲──   │    │  │
│  Targets Acquired: 12           │  │  │                     │    │  │
│  Success Rate: 89%              │  │  └─────────────────────┘    │  │
│                                 │  │                             │  │
│  ┌───────────────────────────┐  │  │  ┌─────────────────────┐    │  │
│  │ REASONING                 │  │  │  │    TREND GAUGE      │    │  │
│  │ "Energy building toward   │  │  │  │ ← FALL │████│ RISE →│    │  │
│  │  peak, detecting classic  │  │  │  └─────────────────────┘    │  │
│  │  drop signature pattern"  │  │  │                             │  │
│  └───────────────────────────┘  │  │  Zone: RISING 📈            │  │
│                                 │  │  Velocity: +0.034/s         │  │
│  ┌───────────────────────────┐  │  └─────────────────────────────┘  │
│  │ Beauty: φ 1.247           │  │                                   │
│  │ ████████████░░░ 83%       │  │                                   │
│  │ Trend: ↗ Rising           │  │                                   │
│  └───────────────────────────┘  │                                   │
│                                 │                                   │
├─────────────────────────────────┼───────────────────────────────────┤
│                                 │                                   │
│     🎨 DREAM FORGE (COMPLETO)   │      ⚖️ ETHICS COUNCIL            │
│                                 │                                   │
│  ┌───────────────────────────┐  │  ┌─────────────────────────────┐  │
│  │ CURRENT DREAM             │  │  │  COUNCIL VOTE               │  │
│  │ ══════════════════════════│  │  │                             │  │
│  │ Effect: "Ethereal Wash"   │  │  │  ┌──────┐ ┌──────┐ ┌──────┐│  │
│  │ Type: COLOR_TRANSITION    │  │  │  │ 🦋   │ │ 🦊   │ │ 🐋   ││  │
│  │ Duration: 2.4s            │  │  │  │BEAUTY│ │ENERGY│ │CALM  ││  │
│  │ Fixtures: 8/12 active     │  │  │  │ +0.3 │ │ +0.1 │ │ -0.2 ││  │
│  │ Priority: 0.87            │  │  │  │ ✓ YES│ │ ✓ YES│ │ ✗ NO ││  │
│  └───────────────────────────┘  │  │  └──────┘ └──────┘ └──────┘│  │
│                                 │  │                             │  │
│  ┌───────────────────────────┐  │  │  FINAL VERDICT: APPROVED    │  │
│  │ WHY THIS DREAM?           │  │  │  Majority: 2/3 (67%)        │  │
│  │ ─────────────────────────│  │  │  Weight: 0.73               │  │
│  │ "Spectral buildup at 4kHz│  │  └─────────────────────────────┘  │
│  │  suggests incoming drop.  │  │                                   │
│  │  Wash effect prepares     │  │  ┌─────────────────────────────┐  │
│  │  visual anticipation."    │  │  │  REASONING                  │  │
│  └───────────────────────────┘  │  │  ──────────────────────────│  │
│                                 │  │  "Beauty wants smooth trans │  │
│  ┌───────────────────────────┐  │  │   but Energy needs impact.  │  │
│  │ DREAM HISTORY (últimos 5) │  │  │   Compromise: wash with     │  │
│  │ ─────────────────────────│  │  │   acceleration at end."     │  │
│  │ • Strobe Burst    [0.92] │  │  └─────────────────────────────┘  │
│  │ • Color Sweep     [0.78] │  │                                   │
│  │ • Intensity Pulse [0.85] │  │  Harmony Score: ████████░░ 84%    │
│  │ • Position Wave   [0.71] │  │  Ethics Violations: 0             │
│  │ • Gobo Rotation   [0.66] │  │  Overrides Today: 2               │
│  └───────────────────────────┘  │                                   │
│                                 │                                   │
└─────────────────────────────────┴───────────────────────────────────┘
```

### Componentes Expandidos

#### 1. 🐱 AI STATE TITAN
**Dimensiones:** 50% width, 50% height  
**Mejoras:**
- **Barra de progreso LARGA** con gradiente
- **Reasoning completo** (no truncado)
- **Estadísticas de sesión:**
  - Hunt Duration
  - Targets Acquired
  - Success Rate
- **Beauty meter** con trend visual

```tsx
interface AIStateExpanded {
  huntState: AIHuntState
  confidence: number
  reasoning: string         // COMPLETO, no truncado
  beautyScore: number
  beautyTrend: 'rising' | 'falling' | 'stable'
  sessionStats: {
    huntDuration: number    // Segundos en estado actual
    targetsAcquired: number // Total de targets procesados
    successRate: number     // % de strikes exitosos
    stateHistory: AIHuntState[] // Últimos 10 estados
  }
}
```

#### 2. 🔮 THE ORACLE HÍBRIDO
**Dimensiones:** 50% width, 50% height  
**Mejoras:**
- **NO ALTERNA** - Todo visible siempre
- **Banner de alerta** arriba (cuando hay predicción)
- **Sparkline SIEMPRE visible** (más grande)
- **Trend Gauge** bidireccional
- **Zona y velocidad** con texto claro

```tsx
interface OracleHybrid {
  // SIEMPRE VISIBLE - ALERTA (arriba)
  alert: {
    type: 'drop_incoming' | 'spike' | 'buildup' | 'breakdown' | null
    probability: number
    timeUntilMs: number
    beatsETA: string
  }
  // SIEMPRE VISIBLE - GRÁFICA (medio)
  sparkline: {
    data: number[]          // 60 puntos (10 segundos)
    currentValue: number
  }
  // SIEMPRE VISIBLE - GAUGE (abajo)
  trend: {
    direction: 'rising' | 'falling' | 'stable'
    velocity: number
    gaugePercent: number    // -100 a +100
  }
  zone: {
    current: 'calm' | 'rising' | 'peak' | 'falling'
    emoji: string
    color: string
  }
}
```

#### 3. 🎨 DREAM FORGE COMPLETO
**Dimensiones:** 50% width, 50% height  
**Mejoras:**
- **Current Dream** con todos los detalles
- **Why This Dream** - Reasoning del Dreamer
- **Dream History** - Últimos 5 con scores

```tsx
interface DreamForgeExpanded {
  currentDream: {
    name: string
    type: string
    duration: number
    fixtures: { active: number; total: number }
    priority: number
    parameters: Record<string, any>
  }
  reasoning: string         // Por qué se eligió este sueño
  history: Array<{
    name: string
    score: number
    timestamp: number
  }>
  queueSize: number
  ghostMode: boolean
}
```

#### 4. ⚖️ ETHICS COUNCIL EXPANDIDO
**Dimensiones:** 50% width, 50% height  
**Mejoras:**
- **Grid de 3 votos** con iconos y nombres
- **Cada voto visible** (contribución, veredicto)
- **Final verdict** destacado
- **Reasoning del consenso**
- **Métricas de sesión** (violations, overrides)

```tsx
interface EthicsCouncilExpanded {
  councilVotes: Array<{
    advisor: 'butterfly' | 'fox' | 'whale'
    name: string            // "BEAUTY", "ENERGY", "CALM"
    emoji: string
    contribution: number    // -1 a +1
    verdict: 'approve' | 'reject' | 'abstain'
    weight: number
  }>
  finalVerdict: 'approved' | 'rejected' | 'override'
  majorityRatio: string     // "2/3"
  consensusWeight: number   // 0-1
  reasoning: string
  sessionMetrics: {
    harmonyScore: number
    violations: number
    overrides: number
  }
}
```

---

# 📜 TAB C: NEURAL STREAM
## "Lo que Selene DICE"

### Layout: Se mantiene igual (ya funciona bien)

```
┌─────────────────────────────────────────────────────────────────────┐
│  📜 NEURAL STREAM                                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [CONSCIOUSNESS] Energy peak detected at 4.2s mark           │   │
│  │ [PREDICTION] DROP probability: 78% in 4 beats               │   │
│  │ [DREAM] Executing "Ethereal Wash" on 8 fixtures             │   │
│  │ [ETHICS] Council approved (2/3 majority)                    │   │
│  │ [CHROMATIC] Color shift: #8B5CF6 → #22D3EE                  │   │
│  │ [AUDIO] Spectral flux spike: 0.87                           │   │
│  │ ...                                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Filter: [ALL] [CONSCIOUSNESS] [PREDICTION] [DREAM] [ETHICS]        │
│  Auto-scroll: [ON]                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 🏗️ ARQUITECTURA DE COMPONENTES

## Estructura de Archivos Propuesta

```
electron-app/src/components/telemetry/
├── NeuralCommandCenter/
│   ├── NeuralCommandCenter.tsx      # Container principal
│   ├── NeuralCommandCenter.css      # Estilos del container
│   ├── SubTabNavigation.tsx         # Navegación entre tabs
│   └── SubTabNavigation.css
│
├── SensoryView/                      # TAB A: SENSORY
│   ├── SensoryView.tsx              # Container de la vista
│   ├── SensoryView.css
│   ├── AudioSpectrumTitan.tsx       # Espectro expandido
│   ├── AudioSpectrumTitan.css
│   ├── ChromaticCoreComplete.tsx    # Color wheel + chords
│   ├── ChromaticCoreComplete.css
│   ├── ContextMatrixExpanded.tsx    # 8 cards de contexto
│   └── ContextMatrixExpanded.css
│
├── ConsciousnessView/                # TAB B: CONSCIOUSNESS
│   ├── ConsciousnessView.tsx        # Container de la vista
│   ├── ConsciousnessView.css
│   ├── AIStateTitan.tsx             # Estado expandido
│   ├── AIStateTitan.css
│   ├── OracleHybrid.tsx             # Predicción híbrida
│   ├── OracleHybrid.css
│   ├── DreamForgeComplete.tsx       # Forge expandido
│   ├── DreamForgeComplete.css
│   ├── EthicsCouncilExpanded.tsx    # Council expandido
│   └── EthicsCouncilExpanded.css
│
└── NeuralStream/                     # TAB C: STREAM (existente)
    ├── NeuralStream.tsx
    └── NeuralStream.css
```

## Componente Principal

```tsx
// NeuralCommandCenter.tsx - ESTRUCTURA APROXIMADA

import React, { useState } from 'react'
import { SubTabNavigation } from './SubTabNavigation'
import { SensoryView } from '../SensoryView/SensoryView'
import { ConsciousnessView } from '../ConsciousnessView/ConsciousnessView'
import { NeuralStream } from '../NeuralStream/NeuralStream'

type SubTab = 'sensory' | 'consciousness' | 'stream'

interface TabConfig {
  id: SubTab
  label: string
  icon: string
  shortcut: string
}

const TABS: TabConfig[] = [
  { id: 'sensory', label: 'SENSORY', icon: '🎛️', shortcut: '1' },
  { id: 'consciousness', label: 'CONSCIOUSNESS', icon: '🧠', shortcut: '2' },
  { id: 'stream', label: 'STREAM', icon: '📜', shortcut: '3' },
]

export const NeuralCommandCenter: React.FC<NeuralCommandCenterProps> = ({
  telemetry,
  neuralLog,
  // ... otros props
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('consciousness')

  return (
    <div className="neural-command-center">
      {/* Navegación de sub-tabs */}
      <SubTabNavigation 
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Contenido de la tab activa */}
      <div className="neural-command-center__content">
        {activeTab === 'sensory' && (
          <SensoryView 
            audioSpectrum={telemetry.audioSpectrum}
            chromaticCore={telemetry.chromaticCore}
            context={telemetry.context}
          />
        )}
        
        {activeTab === 'consciousness' && (
          <ConsciousnessView 
            aiState={telemetry.aiState}
            prediction={telemetry.prediction}
            dreamForge={telemetry.dreamForge}
            ethics={telemetry.ethics}
          />
        )}
        
        {activeTab === 'stream' && (
          <NeuralStream 
            entries={neuralLog}
          />
        )}
      </div>
    </div>
  )
}
```

## CSS Base

```css
/* NeuralCommandCenter.css */

.neural-command-center {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.neural-command-center__content {
  flex: 1;
  overflow: hidden; /* Las vistas internas manejan su propio scroll si lo necesitan */
  padding: 12px;
}

/* Sub-tab Navigation */
.subtab-navigation {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid var(--border-subtle);
}

.subtab-navigation__tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.subtab-navigation__tab:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border-subtle);
}

.subtab-navigation__tab--active {
  background: rgba(139, 92, 246, 0.15);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.subtab-navigation__tab-icon {
  font-size: 1rem;
}

.subtab-navigation__tab-shortcut {
  font-size: 0.6rem;
  opacity: 0.5;
  margin-left: 4px;
}
```

---

# 📊 MÉTRICAS EXPANDIDAS DISPONIBLES

## Desde TitanEngine (ya disponibles)

```typescript
// Datos que YA existen y podemos mostrar con más espacio:

interface TitanTelemetry {
  // SENSORY
  audioLevel: number              // Nivel general
  audioPeaks: number[]            // Picos por banda
  bpm: number
  key: string
  section: string
  
  // CONSCIOUSNESS  
  huntState: AIHuntState
  confidence: number
  beautyScore: number
  beautyTrend: 'rising' | 'falling' | 'stable'
  
  // PREDICTION
  predictionText: string | null
  predictionProbability: number
  predictionTimeMs: number
  energyTrend: 'rising' | 'falling' | 'stable' | 'spike'
  energyZone: 'calm' | 'rising' | 'peak' | 'falling'
  energyValue: number
  energyVelocity: number
  
  // DREAM
  activeDream: { name: string; type: string } | null
  dreamQueue: number
  ghostMode: boolean
  
  // ETHICS
  ethicsContributions: number[]
  harmonyScore: number
}
```

## Nuevos Datos a Exponer (requiere backend work)

```typescript
// Datos que PODRÍAMOS exponer con cambios menores en backend:

interface TitanTelemetryExpanded extends TitanTelemetry {
  // AUDIO (de AudioAnalyzerNode)
  spectrumBands: number[]         // 32 bandas completas
  peakHold: number[]              // Picos retenidos
  spectralFlux: number            // Volatilidad
  dominantFrequency: number       // Hz dominante
  
  // CHROMATIC (de ChromaticCore)
  currentHue: number
  currentSaturation: number
  currentBrightness: number
  colorTemperature: number
  harmonyMode: string
  detectedChord: string
  
  // AI STATE (de SeleneTitanConscious)
  reasoning: string               // Ya existe, solo no se pasa completo
  huntDuration: number
  stateTransitions: number
  
  // DREAM (de EffectDreamSimulator)
  dreamReasoning: string          // Por qué se eligió
  dreamHistory: Array<{ name: string; score: number }>
  
  // ETHICS (de EthicsCouncil)
  individualVotes: Array<{
    advisor: string
    contribution: number
    verdict: string
  }>
  ethicsReasoning: string
  violationCount: number
}
```

---

# 🎨 GUÍA DE ESTILO VISUAL

## Paleta de Colores (mantener)

```css
:root {
  /* Backgrounds */
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-card: rgba(18, 18, 26, 0.8);
  
  /* Accents */
  --accent-primary: #8b5cf6;      /* Violeta */
  --accent-secondary: #22d3ee;    /* Cyan */
  --accent-tertiary: #f97316;     /* Naranja */
  
  /* States */
  --state-success: #22c55e;
  --state-warning: #fbbf24;
  --state-danger: #ef4444;
  --state-info: #3b82f6;
  
  /* Text */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  
  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.1);
  --border-accent: rgba(139, 92, 246, 0.3);
}
```

## Tipografía

```css
/* Headers de cards */
.card-header {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* Valores principales */
.value-primary {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Labels secundarios */
.label-secondary {
  font-size: 0.6rem;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

## Efectos Cyberpunk

```css
/* Glow en elementos activos */
.glow-active {
  box-shadow: 
    0 0 10px rgba(139, 92, 246, 0.3),
    0 0 20px rgba(139, 92, 246, 0.1);
}

/* Scanlines sutiles */
.scanlines::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.1) 2px,
    rgba(0, 0, 0, 0.1) 4px
  );
  pointer-events: none;
  opacity: 0.3;
}

/* Borders con gradiente */
.gradient-border {
  border: 1px solid transparent;
  background: 
    linear-gradient(var(--bg-card), var(--bg-card)) padding-box,
    linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)) border-box;
}
```

---

# 📋 CHECKLIST DE IMPLEMENTACIÓN

## Fase 1: Estructura Base
- [ ] Crear `SubTabNavigation.tsx` y `.css`
- [ ] Modificar `NeuralCommandCenter.tsx` para usar tabs
- [ ] Crear carpetas `SensoryView/` y `ConsciousnessView/`
- [ ] Crear containers vacíos para cada vista

## Fase 2: Sensory View
- [ ] `AudioSpectrumTitan.tsx` - Espectro expandido 32 bandas
- [ ] `ChromaticCoreComplete.tsx` - Color wheel + chords
- [ ] `ContextMatrixExpanded.tsx` - 8 cards de contexto
- [ ] Integrar en `SensoryView.tsx`

## Fase 3: Consciousness View
- [ ] `AIStateTitan.tsx` - Estado expandido con stats
- [ ] `OracleHybrid.tsx` - Predicción híbrida (alerta + gráfica)
- [ ] `DreamForgeComplete.tsx` - Forge con history
- [ ] `EthicsCouncilExpanded.tsx` - Council con votos visibles
- [ ] Integrar en `ConsciousnessView.tsx`

## Fase 4: Backend Telemetry
- [ ] Expandir `TitanEngine.getConsciousnessTelemetry()` con nuevos datos
- [ ] Exponer `spectrumBands[]` desde audio analyzer
- [ ] Exponer `reasoning` completo desde consciousness
- [ ] Exponer `individualVotes` desde ethics council

## Fase 5: Polish & Performance
- [ ] Optimizar re-renders con `useMemo`/`memo`
- [ ] Añadir transiciones entre tabs
- [ ] Keyboard shortcuts (1, 2, 3 para cambiar tabs)
- [ ] Responsive breakpoints si es necesario

---

# 🎯 RESULTADO ESPERADO

## Antes (Actual)
- 4 cards de 160px comprimidas
- Scroll interno en todo
- Información oculta/truncada
- Alternancia molesta en Oracle
- CSS con 50+ hacks de overflow

## Después (The Great Divide)
- 3 vistas especializadas con espacio ilimitado
- Sin scroll interno (todo visible)
- Información completa y legible
- Oracle híbrido (todo siempre visible)
- CSS limpio y mantenible

---

# 💬 NOTAS DEL ARQUITECTO

> "El problema nunca fue el contenido - fue el contenedor. 
> Estábamos tratando de meter el océano en una pecera.
> The Great Divide no es una feature - es una liberación."
> 
> — PunkOpus, WAVE 1193

---

**Estado:** BLUEPRINT COMPLETO - Esperando aprobación para implementación  
**Estimación:** 4-6 horas de implementación  
**Riesgo:** BAJO (refactor de UI, no toca lógica de negocio)  
**Impacto:** ALTO (mejora dramática de UX y mantenibilidad)
