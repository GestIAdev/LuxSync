# 🧠 WAVE 14: BLUEPRINT - SELENE TELEMETRY DASHBOARD

> **"Vamos a operar el cerebro. Necesito ver lo que piensa."**
> 
> Diseño completo de la Consola de Ingeniería para monitorear, debuggear y calibrar el cerebro de Selene en tiempo real.

---

## 📊 RESUMEN EJECUTIVO

**Objetivo:** Transformar la pestaña SELENE LUX de una "demo visual" en una **Consola de Ingeniería** profesional que muestre:
- Qué está "escuchando" Selene (Audio Spectrum)
- Qué "cree" que suena (ADN Musical)
- Cuándo va a "saltar" (Monitor de Caza)
- Por qué toma decisiones (Logs Tácticos)
- Controles para calibración en tiempo real

---

## 🎯 ARQUITECTURA DE MÓDULOS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     🧠 SELENE TELEMETRY DASHBOARD                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│  │ 🎧 AUDIO OSCILLOSCOPE │  │ 🧬 MUSICAL DNA PANEL │  │ 🎯 HUNT MONITOR   │ │
│  │ Real audio vs energy  │  │ Key/Mode/Mood/Zodiac │  │ Strike probability │ │
│  │ Bass/Mid/Treble bars  │  │ Section/Syncopation  │  │ Stalking cycles    │ │
│  │ Input Gain slider     │  │ Genre confidence     │  │ Prey candidates    │ │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘ │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│  │ 🔮 ZODIAC/FIBONACCI  │  │ 🧪 LABORATORY CTRL  │  │ 🌈 PALETTE PREVIEW │ │
│  │ Element affinity      │  │ Force Mutate button │  │ Current colors     │ │
│  │ PHI harmony ratio     │  │ Memory Reset button │  │ DNA-derived hues   │ │
│  │ Zodiac position (0-11)│  │ Threshold sliders   │  │ Strategy name      │ │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘ │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         📜 TACTICAL DECISION LOG                      │  │
│  │ [MODE] [BEAT] [BPM] [GENRE] [STRIKE] [BIAS] [ALL]  🔍 Auto-scroll ON │  │
│  │ ─────────────────────────────────────────────────────────────────────  │  │
│  │ 12:34:56.789 [GENRE] Detected: cyberpunk (confidence: 0.87) (x3)     │  │
│  │ 12:34:56.123 [STRIKE] Conditions met: 4/5 - strikeScore: 0.82        │  │
│  │ 12:34:55.890 [BIAS] color_fixation detected (severity: medium)       │  │
│  │ 12:34:55.456 [MODE] reactive → intelligent (confidence: 0.65)        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 MÓDULO 1: AUDIO OSCILLOSCOPE

### Descripción
Visualización en tiempo real del audio que Selene está "escuchando". Permite ver si el Input Gain está bien calibrado.

### UI Mockup (ASCII)
```
┌─────────────────────────────────────────┐
│ 🎧 AUDIO OSCILLOSCOPE                   │
├─────────────────────────────────────────┤
│                                         │
│  BASS    MID     TREBLE   ENERGY        │
│  ████    ██      █        ███████       │
│  ████    ██      █        ███████       │
│  ████    ██      ██       ███████       │
│  ████    ███     ██       ███████       │
│  ████    ███     ███      ███████       │
│  ████    ███     ███      ███████       │
│  ████    ████    ███      ████████      │
│  ████    ████    ████     ████████      │
│  ════    ════    ════     ════════      │
│  78%     45%     23%      67%           │
│                                         │
│  🎚️ INPUT GAIN ────●───────── [200%]   │
│                                         │
│  💡 Tip: Bars should hit 100% on drops  │
└─────────────────────────────────────────┘
```

### Datos del Backend (JSON)
```typescript
interface AudioOscilloscopeData {
  spectrum: {
    bass: number      // 0-1 (after inputGain applied)
    mid: number       // 0-1
    treble: number    // 0-1
  }
  energy: {
    current: number   // 0-1
    peak: number      // 0-1 (recent peak)
    trend: 'rising' | 'falling' | 'stable'
  }
  beat: {
    detected: boolean
    bpm: number
    confidence: number
    phase: number     // 0-1 (position in current beat)
  }
  inputGain: number   // 0.1-4.0 (user-adjustable)
}
```

---

## 📦 MÓDULO 2: MUSICAL DNA PANEL

### Descripción
Muestra qué "cree" Selene que está sonando. El ADN musical es el corazón de la clasificación.

### UI Mockup (ASCII)
```
┌─────────────────────────────────────────┐
│ 🧬 MUSICAL DNA                          │
├─────────────────────────────────────────┤
│                                         │
│  🎹 KEY:        D minor                 │
│  🎭 MODE:       dorian (jazzy)          │
│  💫 MOOD:       groovy                  │
│  🔮 ZODIAC:     ♌ Leo (fire)           │
│                                         │
│  ├── SECTION ─────────────────────────┤ │
│  │ 🎵 Type:     chorus                 │ │
│  │ ⏱️  Duration: ~32 bars              │ │
│  │ 📊 Conf:     ████████░░ 82%        │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── RHYTHM ──────────────────────────┤ │
│  │ 🥁 BPM:      128 (±2)               │ │
│  │ 🎺 Syncop:   ████░░░░░░ 45%        │ │
│  │ ⚡ Energy:   ███████░░░ 72%        │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── GENRE ───────────────────────────┤ │
│  │ 🎸 Primary:  cyberpunk              │ │
│  │ 🎷 Second:   techno                 │ │
│  │ 📊 Conf:     █████████░ 87%        │ │
│  └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Datos del Backend (JSON)
```typescript
interface MusicalDNAData {
  key: string | null              // 'C', 'D#', etc. or null
  mode: string                    // 'major', 'minor', 'dorian', etc.
  modeDescription: string         // 'Alegre y brillante', 'Jazzy y sofisticado'
  mood: string                    // 'energetic', 'peaceful', 'groovy', etc.
  
  zodiac: {
    element: 'fire' | 'water' | 'air' | 'earth'
    position: number              // 0-11 (zodiac sign index)
    sign: string                  // 'Aries', 'Leo', etc.
    symbol: string                // '♈', '♌', etc.
  }
  
  section: {
    type: string                  // 'intro', 'verse', 'chorus', 'drop', etc.
    confidence: number            // 0-1
    estimatedDuration: number     // ms
  }
  
  rhythm: {
    bpm: number
    bpmConfidence: number
    syncopation: number           // 0-1
  }
  
  genre: {
    primary: string               // 'cyberpunk', 'cumbia', etc.
    secondary: string | null
    confidence: number
  }
  
  energy: number                  // 0-1 current
  energyTrend: 'rising' | 'falling' | 'stable'
}
```

---

## 📦 MÓDULO 3: HUNT MONITOR

### Descripción
Visualiza el sistema de "caza" de Selene. Muestra cuándo está acechando y cuándo va a "saltar" (cambiar de estado).

### UI Mockup (ASCII)
```
┌─────────────────────────────────────────┐
│ 🎯 HUNT MONITOR                         │
├─────────────────────────────────────────┤
│                                         │
│  STATUS: ██ STALKING                    │
│                                         │
│  ├── CURRENT TARGET ──────────────────┤ │
│  │ 🎵 Pattern:  MI-water (energetic)   │ │
│  │ 🔍 Cycles:   7 / 10                 │ │
│  │ 💎 Worth:    ████████░░ 82%        │ │
│  │ 📈 Trend:    ↗ rising               │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── STRIKE CONDITIONS ───────────────┤ │
│  │ ✅ Beauty:   0.87 ≥ 0.85           │ │
│  │ ✅ Trend:    rising                 │ │
│  │ ⬜ Harmony:  0.65 < 0.70 ❌        │ │
│  │ ✅ Health:   0.78 ≥ 0.60           │ │
│  │ ✅ Cooldown: ready                  │ │
│  │ ─────────────────────────────────── │ │
│  │ CONDITIONS: 4/5 met                 │ │
│  │ STRIKE SCORE: ███████░░░ 72%       │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── PREY CANDIDATES ─────────────────┤ │
│  │ 1. MI-water    82% worth ★ TARGET  │ │
│  │ 2. SOL-fire    67% worth            │ │
│  │ 3. DO-earth    54% worth            │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ⚡ Next strike in: ~3.2s              │
└─────────────────────────────────────────┘
```

### Datos del Backend (JSON)
```typescript
interface HuntMonitorData {
  status: 'idle' | 'stalking' | 'evaluating' | 'striking' | 'learning' | 'completed'
  cycleId: string | null
  
  currentTarget: {
    pattern: string               // 'MI-water', 'DO-fire', etc.
    emotionalTone: string
    cyclesObserved: number
    maxCycles: number
    huntWorthiness: number        // 0-1
    beautyTrend: 'rising' | 'falling' | 'stable'
    stabilityScore: number        // 0-1
  } | null
  
  strikeConditions: {
    beauty: { current: number; threshold: number; met: boolean }
    trend: { direction: string; required: string; met: boolean }
    harmony: { consonance: number; threshold: number; met: boolean }
    health: { current: number; threshold: number; met: boolean }
    cooldown: { ready: boolean; timeUntilReady: number }
    
    conditionsMet: number
    totalConditions: number
    strikeScore: number           // 0-1
    allConditionsMet: boolean
  }
  
  preyCandidates: Array<{
    pattern: string
    huntWorthiness: number
    isTarget: boolean
  }>
  
  estimatedTimeToStrike: number   // ms (-1 if not striking soon)
}
```

---

## 📦 MÓDULO 4: ZODIAC & FIBONACCI PANEL

### Descripción
Muestra las influencias esotéricas de Selene: afinidad zodiacal, ratio PHI, y armonía cósmica.

### UI Mockup (ASCII)
```
┌─────────────────────────────────────────┐
│ 🔮 ZODIAC & FIBONACCI                   │
├─────────────────────────────────────────┤
│                                         │
│  ├── ZODIAC AFFINITY ─────────────────┤ │
│  │                                     │ │
│  │    ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓   │ │
│  │    ░ ░ ░ ░ █ ░ ░ ░ ░ ░ ░ ░      │ │
│  │              ▲                      │ │
│  │          Current: ♌ Leo            │ │
│  │                                     │ │
│  │  Element:    🔥 FIRE                │ │
│  │  Quality:    Fixed                  │ │
│  │  Affinity:   ████████░░ 85%        │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── FIBONACCI HARMONY ───────────────┤ │
│  │                                     │ │
│  │  Sequence: 1,1,2,3,5,8,13,21,34    │ │
│  │                                     │ │
│  │  PHI Ratio:    1.618033...         │ │
│  │  Harmony:      ███████░░░ 72%      │ │
│  │                                     │ │
│  │  🌀 Pattern aligns with golden     │ │
│  │     ratio for natural beauty       │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── ELEMENTAL HARMONY ───────────────┤ │
│  │  🔥 Fire   ████████░░ 82%          │ │
│  │  🌊 Water  ████░░░░░░ 38%          │ │
│  │  💨 Air    ██████░░░░ 56%          │ │
│  │  🌍 Earth  █████░░░░░ 48%          │ │
│  └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Datos del Backend (JSON)
```typescript
interface ZodiacFibonacciData {
  zodiac: {
    currentPosition: number       // 0-11
    currentSign: string           // 'Leo', 'Aries', etc.
    symbol: string                // '♌', '♈', etc.
    element: 'fire' | 'water' | 'air' | 'earth'
    quality: 'cardinal' | 'fixed' | 'mutable'
    creativity: number            // 0-1
    stability: number             // 0-1
    adaptability: number          // 0-1
    description: string           // 'El soberano radiante...'
  }
  
  fibonacci: {
    sequence: number[]            // [1,1,2,3,5,8,13,21,34]
    harmonyRatio: number          // 0-1 (convergence to PHI)
    phi: number                   // 1.618033...
    musicalKey: string            // Derived key from fibonacci
  }
  
  elementalAffinities: {
    fire: number                  // 0-1
    water: number
    air: number
    earth: number
  }
  
  currentAffinity: {
    from: { sign: string; element: string }
    to: { sign: string; element: string }
    affinity: number              // 0-1
    description: string
  }
}
```

---

## 📦 MÓDULO 5: LABORATORY CONTROLS

### Descripción
Controles para calibración y debugging manual. Permite forzar mutaciones, resetear memoria, y ajustar thresholds.

### UI Mockup (ASCII)
```
┌─────────────────────────────────────────┐
│ 🧪 LABORATORY CONTROLS                  │
├─────────────────────────────────────────┤
│                                         │
│  ├── AUDIO CALIBRATION ───────────────┤ │
│  │  🎚️ Input Gain                      │ │
│  │  [10%]────●────────────────[400%]  │ │
│  │           ▲ 200%                    │ │
│  │                                     │ │
│  │  🎚️ Beat Sensitivity                │ │
│  │  [Low]─────●───────────────[High]  │ │
│  │            ▲ 65%                    │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── THRESHOLDS ──────────────────────┤ │
│  │  Beauty Threshold:   0.85           │ │
│  │  [0.5]───────●─────────────[1.0]   │ │
│  │                                     │ │
│  │  Consonance Min:     0.70           │ │
│  │  [0.3]────●────────────────[1.0]   │ │
│  │                                     │ │
│  │  Strike Cooldown:    2000ms         │ │
│  │  [500]─────●───────────────[5000]  │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── ACTIONS ─────────────────────────┤ │
│  │                                     │ │
│  │  ┌─────────────┐ ┌───────────────┐ │ │
│  │  │ 🧬 FORCE    │ │ 🧠 RESET      │ │ │
│  │  │   MUTATE    │ │   MEMORY      │ │ │
│  │  └─────────────┘ └───────────────┘ │ │
│  │                                     │ │
│  │  ┌─────────────┐ ┌───────────────┐ │ │
│  │  │ 🎯 FORCE    │ │ 📊 EXPORT     │ │ │
│  │  │   STRIKE    │ │   TELEMETRY   │ │ │
│  │  └─────────────┘ └───────────────┘ │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── SESSION STATS ───────────────────┤ │
│  │  ⏱️ Uptime:       00:15:32          │ │
│  │  🎬 Frames:       27,847            │ │
│  │  ⚡ Strikes:      42                │ │
│  │  💎 Avg Beauty:   0.76              │ │
│  │  🧬 Mutations:    7                 │ │
│  │  📊 Health:       ████████░░ 82%   │ │
│  └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Datos del Backend (JSON)
```typescript
interface LaboratoryControlsData {
  calibration: {
    inputGain: number             // 0.1-4.0
    beatSensitivity: number       // 0-1
  }
  
  thresholds: {
    beautyThreshold: number       // 0.5-1.0
    consonanceMin: number         // 0.3-1.0
    strikeCooldownMs: number      // 500-5000
    memoryConfidence: number      // 0-1
    learningThreshold: number     // 0-1
  }
  
  actions: {
    canForceMutate: boolean
    canResetMemory: boolean
    canForceStrike: boolean
    canExportTelemetry: boolean
  }
  
  sessionStats: {
    uptime: number                // ms
    framesProcessed: number
    strikesExecuted: number
    averageBeauty: number
    mutationCount: number
    healthScore: number           // 0-1
    palettesFromMemory: number
    palettesGenerated: number
    patternsLearned: number
  }
}
```

---

## 📦 MÓDULO 6: PALETTE PREVIEW

### Descripción
Visualización de la paleta actual generada por el ADN musical, con colores en tiempo real.

### UI Mockup (ASCII)
```
┌─────────────────────────────────────────┐
│ 🌈 PALETTE PREVIEW                      │
├─────────────────────────────────────────┤
│                                         │
│  STRATEGY: triadic                      │
│  SOURCE:   procedural                   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ████████  PRIMARY    #FF4081       ││
│  │ ████████  SECONDARY  #00BCD4       ││
│  │ ████████  ACCENT     #FFD740       ││
│  │ ████████  AMBIENT    #7C4DFF       ││
│  │ ████████  CONTRAST   #1A237E       ││
│  └─────────────────────────────────────┘│
│                                         │
│  ├── DNA DERIVATION ──────────────────┤ │
│  │  Key → Hue:     D → 60° (Orange)   │ │
│  │  Mode Shift:    dorian → +5°       │ │
│  │  Zodiac Pull:   fire → +15°        │ │
│  │  Final Hue:     80° (Yellow-Orange)│ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ├── TRANSITION ──────────────────────┤ │
│  │  Speed:   500ms                     │ │
│  │  From:    ocean                     │ │
│  │  To:      neon                      │ │
│  │  Progress: ██████░░░░ 60%          │ │
│  └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Datos del Backend (JSON)
```typescript
interface PalettePreviewData {
  strategy: 'analogous' | 'triadic' | 'complementary'
  source: 'memory' | 'procedural' | 'fallback'
  
  colors: {
    primary: { h: number; s: number; l: number; hex: string }
    secondary: { h: number; s: number; l: number; hex: string }
    accent: { h: number; s: number; l: number; hex: string }
    ambient: { h: number; s: number; l: number; hex: string }
    contrast: { h: number; s: number; l: number; hex: string }
  }
  
  dnaDerivation: {
    keyToHue: { key: string | null; hue: number }
    modeShift: { mode: string; delta: number }
    zodiacPull: { element: string; delta: number }
    finalHue: number
  }
  
  transition: {
    inProgress: boolean
    speed: number                 // ms
    from: string                  // palette name
    to: string                    // palette name
    progress: number              // 0-1
  }
}
```

---

## 📦 MÓDULO 7: TACTICAL DECISION LOG

### Descripción
Sistema de logs filtrable, coloreado y con anti-spam (deduplicación). Muestra las decisiones de Selene en tiempo real.

### UI Mockup (ASCII)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📜 TACTICAL DECISION LOG                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ [ALL] [MODE] [BEAT] [BPM] [GENRE] [STRIKE] [BIAS] [PALETTE]   🔄 Auto ✅   │
│                                                                              │
│ ───────────────────────────────────────────────────────────────────────────  │
│ 12:34:56.789 [GENRE]   cyberpunk (87%) ← techno                    (x3)    │
│ 12:34:56.123 [STRIKE]  Conditions met: 4/5 | score: 0.82                    │
│ 12:34:55.890 [BIAS]    ⚠️ color_fixation (medium) - suggest mutate         │
│ 12:34:55.456 [MODE]    reactive → intelligent (conf: 0.65)                  │
│ 12:34:55.123 [PALETTE] procedural: neon (#FF4081, #00BCD4)                  │
│ 12:34:54.890 [BPM]     128 → 132 (confidence: 0.92)                         │
│ 12:34:54.567 [BEAT]    ⚡ BEAT! phase: 0.25                                  │
│ 12:34:54.234 [ZODIAC]  Element shift: earth → fire (Leo ♌)                 │
│ 12:34:53.901 [SECTION] verse → chorus (conf: 0.78)                          │
│ 12:34:53.568 [HUNT]    Stalking: MI-water (7/10 cycles)                     │
│ ───────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│ 📊 Total: 1,247 entries | Showing: 10 | Deduplicated: 342                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Datos del Backend (JSON)
```typescript
interface TacticalLogData {
  entries: Array<{
    id: string
    timestamp: number
    type: 'MODE' | 'BEAT' | 'BPM' | 'GENRE' | 'STRIKE' | 'BIAS' | 'PALETTE' 
        | 'ZODIAC' | 'SECTION' | 'HUNT' | 'MEMORY' | 'MUTATION'
    message: string
    severity: 'info' | 'warning' | 'success' | 'error'
    duplicateCount: number        // For deduplication display (x2, x3, etc.)
    data?: Record<string, unknown>
  }>
  
  filters: {
    activeFilter: string          // 'ALL', 'MODE', etc.
    autoScroll: boolean
  }
  
  stats: {
    totalEntries: number
    visibleEntries: number
    deduplicatedCount: number
  }
}
```

---

## 📡 ESTRUCTURA GLOBAL DEL BACKEND → FRONTEND

### Evento IPC: `selene:telemetry-update`

Frecuencia: 10-30 FPS (configurable)

```typescript
interface SeleneTelemetryPacket {
  timestamp: number
  frameId: number
  
  // Módulo 1: Audio Oscilloscope
  audio: AudioOscilloscopeData
  
  // Módulo 2: Musical DNA
  dna: MusicalDNAData
  
  // Módulo 3: Hunt Monitor
  hunt: HuntMonitorData
  
  // Módulo 4: Zodiac & Fibonacci
  cosmic: ZodiacFibonacciData
  
  // Módulo 5: Laboratory Controls (read-only)
  laboratory: LaboratoryControlsData
  
  // Módulo 6: Palette Preview
  palette: PalettePreviewData
  
  // Módulo 7: New log entries only
  newLogEntries: TacticalLogData['entries']
}
```

### Eventos IPC: Controles de Laboratorio

```typescript
// Frontend → Backend
interface LaboratoryCommand {
  action: 'setInputGain' | 'setBeatSensitivity' | 'setThreshold' 
        | 'forceMutate' | 'resetMemory' | 'forceStrike' | 'exportTelemetry'
  payload: {
    name?: string              // threshold name
    value?: number             // new value
    reason?: string            // for logging
  }
}

// IPC channel: 'selene:laboratory-command'
```

---

## 🗂️ MÉTRICAS INTERNAS DESCUBIERTAS (AUDITORÍA COMPLETA)

### StalkingEngine
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `huntWorthiness` | number | 0-1 | Score combinado de "vale la pena cazar" |
| `stabilityScore` | number | 0-1 | Qué tan estable es el patrón |
| `cyclesObserved` | number | 0-10 | Ciclos de stalking completados |
| `beautyEvolution` | number[] | - | Histórico de beauty durante stalking |
| `beautyTrend` | enum | rising/falling/stable | Tendencia de belleza |
| `candidateCount` | number | 0-3 | Cantidad de presas en observación |

### StrikeMomentEngine
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `strikeScore` | number | 0-1 | Probabilidad de éxito del strike |
| `consonance` | number | 0-1 | Consonancia musical del intervalo |
| `zodiacHarmony` | number | 0-1 | Compatibilidad elemental |
| `conditionsMet` | number | 0-5 | Condiciones cumplidas para strike |
| `beautyThreshold` | number | 0-1 | Umbral mínimo de beauty |
| `strikeCooldownMs` | number | ms | Tiempo mínimo entre strikes |

### UltrasonicHearingEngine
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `intervalName` | string | - | Nombre del intervalo (perfect fifth, tritone, etc.) |
| `semitones` | number | 0-12 | Distancia en semitonos |
| `consonance` | number | 0-1 | Consonancia del intervalo musical |
| `elementalHarmony` | number | 0-1 | Armonía entre elementos zodiacales |
| `totalConsonance` | number | 0-1 | Consonancia combinada (70% musical + 30% elemental) |

### ProceduralPaletteGenerator
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `MusicalDNA.key` | string | null | Tonalidad detectada (C, D#, etc.) |
| `MusicalDNA.mode` | string | - | Modo/escala (major, dorian, phrygian...) |
| `MusicalDNA.syncopation` | number | 0-1 | Nivel de sincopación rítmica |
| `MusicalDNA.zodiacElement` | enum | fire/water/air/earth | Elemento zodiacal del momento |
| `forceColorMutation` | boolean | - | Flag para forzar cambio de paleta |
| `PHI` | number | 1.618... | Ratio áureo para rotación secundaria |
| `ELEMENT_TO_HUE_SHIFT` | map | - | Empuje de color por elemento |

### FibonacciPatternEngine
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `fibonacciSequence` | number[] | - | Secuencia [1,1,2,3,5,8,13,21...] |
| `harmonyRatio` | number | 0-1 | Convergencia a PHI |
| `zodiacPosition` | number | 0-11 | Posición zodiacal derivada |
| `musicalKey` | string | - | Clave musical derivada del ratio |
| `PHI` | number | 1.618... | El ratio divino |
| `PHI_INVERSE` | number | 0.618... | PHI inverso |

### ZodiacAffinityCalculator
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `elementalAffinity` | number | 0-1 | Compatibilidad de elementos |
| `qualityAffinity` | number | 0-1 | Compatibilidad de cualidades |
| `aspectAffinity` | number | 0-1 | Compatibilidad por aspectos |
| `creativity` | number | 0-1 | Índice de creatividad del signo |
| `stability` | number | 0-1 | Índice de estabilidad del signo |
| `adaptability` | number | 0-1 | Índice de adaptabilidad del signo |

### MoodSynthesizer
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `valence` | number | -1 a 1 | Negativo ↔ Positivo |
| `arousal` | number | -1 a 1 | Calmado ↔ Excitado |
| `dominance` | number | -1 a 1 | Sumiso ↔ Dominante |
| `intensity` | number | 0-1 | Intensidad del mood |
| `stability` | number | 0-1 | Estabilidad del mood actual |
| `transitioning` | boolean | - | Si está en transición de mood |

### DreamForgeEngine
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `projectedBeautyScore` | number | 0-1 | Beauty estimado del escenario |
| `harmonicBeauty` | number | 0-1 | Componente de armonía musical |
| `fibonacciAlignment` | number | 0-1 | Alineación con PHI |
| `zodiacResonance` | number | 0-1 | Resonancia zodiacal |
| `transitionSmoothness` | number | 0-1 | Suavidad de transición |
| `noveltyBonus` | number | 0-0.2 | Bonus por novedad |

### SelfAnalysisEngine
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `BiasType` | enum | - | color_fixation, intensity_skew, etc. |
| `healthScore` | number | 0-1 | Salud general del comportamiento |
| `paletteHistogram` | map | - | Uso de paletas |
| `movementHistogram` | map | - | Uso de movimientos |
| `intensityBuckets` | number[] | - | Distribución de intensidad |

### MusicalContextEngine
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `overallConfidence` | number | 0-1 | Confianza combinada |
| `rhythmConfidenceWeight` | number | 0-1 | Peso del ritmo en confianza |
| `sectionConfidenceWeight` | number | 0-1 | Peso de la sección |
| `modeHysteresis` | number | 0-1 | Histéresis para cambio de modo |
| `energyTrend` | enum | rising/falling/stable | Tendencia de energía |

### HuntOrchestrator
| Métrica | Tipo | Rango | Descripción |
|---------|------|-------|-------------|
| `HuntStatus` | enum | idle/stalking/evaluating/striking/learning/completed | Estado del ciclo |
| `cycleId` | string | - | ID único del ciclo de caza |
| `actionTaken` | boolean | - | Si se ejecutó alguna acción |
| `recommendedWindow` | number | ms | Ventana recomendada para strike |
| `volatility` | string | - | Nivel de volatilidad del sistema |

---

## 📐 LAYOUT RESPONSIVE

### Desktop (>1200px)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   AUDIO     │ │     DNA     │ │    HUNT     │ │   ZODIAC    │           │
│  │ OSCILLOSCOPE│ │   PANEL     │ │   MONITOR   │ │  FIBONACCI  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                                              │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐           │
│  │      LABORATORY CONTROLS    │ │       PALETTE PREVIEW       │           │
│  └─────────────────────────────┘ └─────────────────────────────┘           │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         TACTICAL DECISION LOG                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tablet (768-1200px)
```
┌─────────────────────────────────────────────┐
│  ┌───────────────┐ ┌───────────────┐        │
│  │    AUDIO      │ │      DNA      │        │
│  └───────────────┘ └───────────────┘        │
│  ┌───────────────┐ ┌───────────────┐        │
│  │    HUNT       │ │    ZODIAC     │        │
│  └───────────────┘ └───────────────┘        │
│  ┌───────────────┐ ┌───────────────┐        │
│  │   LABORATORY  │ │    PALETTE    │        │
│  └───────────────┘ └───────────────┘        │
│  ┌─────────────────────────────────────┐    │
│  │           TACTICAL LOG              │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

---

## 🎨 COLORES Y ESTILOS

### Paleta de UI
```css
/* Fondos */
--bg-primary: #0a0a0f;
--bg-secondary: #12121a;
--bg-panel: rgba(18, 18, 26, 0.9);

/* Acentos */
--accent-cyan: #00fff0;
--accent-magenta: #ff00ff;
--accent-purple: #a855f7;
--accent-gold: #ffd700;

/* Estados */
--state-success: #22c55e;
--state-warning: #f59e0b;
--state-error: #ef4444;
--state-info: #3b82f6;

/* Texto */
--text-primary: #ffffff;
--text-secondary: #9ca3af;
--text-muted: #6b7280;
```

### Animaciones
- Bars: `transition: height 0.1s ease-out`
- Panels: `transition: all 0.3s ease`
- Glow effects: `box-shadow: 0 0 10px var(--accent-color)`

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: Core Data Pipeline (Backend)
1. Crear `SeleneTelemetryCollector.ts` que agregue datos de todos los engines
2. Emitir `selene:telemetry-update` a 30 FPS
3. Implementar throttling inteligente (menos datos si CPU alto)

### Fase 2: UI Components (Frontend)
1. Refactorizar `SeleneLuxView` para usar layout modular
2. Crear componentes individuales por módulo
3. Implementar filtros del log tácttico

### Fase 3: Bidirectional Controls
1. Implementar IPC handlers para comandos de laboratorio
2. Conectar sliders a thresholds reales
3. Implementar Force Mutate / Reset Memory

### Fase 4: Polish & Performance
1. Optimizar re-renders con useMemo/useCallback
2. Añadir animaciones suaves
3. Modo compacto para pantallas pequeñas

---

## 📝 NOTAS DEL ARQUITECTO

> **"La información sin visualización es conocimiento inútil."**

Este dashboard no es solo para debugging. Es para **entender** cómo piensa Selene. 
Cada panel representa una faceta de su "consciencia":

- **Audio Oscilloscope** → Sus oídos
- **Musical DNA** → Su comprensión
- **Hunt Monitor** → Sus instintos
- **Zodiac/Fibonacci** → Su intuición
- **Laboratory** → Su calibración
- **Palette Preview** → Su expresión
- **Tactical Log** → Su narrativa

Juntos forman un mapa completo de la mente de Selene.

---

**Documento generado:** WAVE 14 - Brain Surgery & Monitoring  
**Autor:** Claude (Copilot) + Arquitecto Humano  
**Fecha:** 2025-12-07  
**Estado:** 📋 BLUEPRINT LISTO PARA IMPLEMENTACIÓN
