# 🔬 WAVE 26 - PRE-FLIGHT AUDIT BLUEPRINT
> **Objetivo:** Análisis completo del backend para diseñar el Setup Híbrido profesional
> **Fecha:** $(date)
> **Status:** ✅ AUDIT COMPLETE

---

## 🎯 RESUMEN EJECUTIVO

Este documento detalla las **capacidades actuales**, **gaps identificados** y la **propuesta de SetupStore** para el rediseño del Setup Wizard, orientado a empresas profesionales de audio/iluminación.

---

## 📊 CAPABILITY MATRIX

| Sistema | Feature | Status | Archivo Principal |
|---------|---------|--------|-------------------|
| 🔌 **DMX** | USB-Serial Detection | ✅ PRO | `UniversalDMXDriver.ts` |
| 🔌 **DMX** | Hot-Plug Watchdog | ✅ PRO | 2s reconnect cycle |
| 🔌 **DMX** | Multi-chip support | ✅ PRO | FTDI, CH340, PL2303, CP210x |
| 🔌 **DMX** | ArtNet | ⚠️ STUB | Interface exists, not implemented |
| 🔌 **DMX** | sACN/E1.31 | ⚠️ STUB | Interface exists, not implemented |
| 💡 **Fixtures** | .fxt Parser (FreeStyler) | ✅ PRO | `FXTParser.ts` |
| 💡 **Fixtures** | Type Detection | ✅ GOOD | Heuristic confidence scoring |
| 💡 **Fixtures** | Channel Mapping | ✅ GOOD | CHANNEL_SYNONYMS dictionary |
| 💡 **Fixtures** | Open Fixture Library | ❌ NONE | Not implemented |
| 💡 **Fixtures** | External Definition Load | ⚠️ PARTIAL | `registerDefinition()` exists |
| 🎵 **Audio** | Web Audio Capture | ✅ GOOD | `useAudioCapture.ts` |
| 🎵 **Audio** | System Audio (loopback) | ✅ GOOD | desktopCapturer hack |
| 🎵 **Audio** | Input Gain (Manual) | ✅ GOOD | 10%-400% range persisted |
| 🎵 **Audio** | Device Persistence | ⚠️ PARTIAL | deviceId saved but NOT restored |
| 🎵 **Audio** | AGC (Auto Gain) | ❌ NONE | Only manual gain slider |
| 🎵 **Audio** | Gain Staging Visual | ❌ NONE | No peak meter in setup |

---

## 🔌 DMX DRIVERS - DEEP DIVE

### ✅ Capacidades Actuales

#### **UniversalDMXDriver.ts** (659 líneas)
```typescript
// SUPPORTED CHIPS (línea ~60)
KNOWN_CHIPS = {
  'FTDI': { vendorId: ['0403'], productId: ['6001', '6010', '6011', '6014', '6015'] },
  'CH340': { vendorId: ['1a86'], productId: ['7523', '5523', 'e523'] },
  'Prolific PL2303': { vendorId: ['067b'], productId: ['2303', '23a3'] },
  'CP210x': { vendorId: ['10c4'], productId: ['ea60', 'ea61', 'ea63', 'ea70', 'ea80'] },
  'IMC UD7S': { vendorId: ['0403'], productId: ['6001'] }  // Tornado specific
}
```

#### **listDevices()** - Detección Completa
- Usa `node-serialport` para escanear todos los COM ports
- Genera `confidence` score basado en:
  - Chip conocido: +30%
  - Nombre contiene "DMX"/"USB"/"Serial": +20%
  - Path válido: +10%

#### **autoConnect()** - Auto-selección
```typescript
// Selecciona el puerto con mayor confidence
const bestDevice = devices.sort((a, b) => b.confidence - a.confidence)[0]
```

#### **Hot-Plug Watchdog**
- Monitoreo cada 2 segundos
- Detecta desconexión y reconecta automáticamente
- Emite eventos: `device:connected`, `device:disconnected`, `device:reconnecting`

### ❌ GAPS - DMX

| Gap | Impacto | Esfuerzo |
|-----|---------|----------|
| **ArtNet no implementado** | No soporta interfaces de red | ALTO (2-3 días) |
| **sACN/E1.31 no implementado** | No multicast profesional | ALTO (2-3 días) |
| **No multi-universe** | Limitado a 512 canales | MEDIO (1-2 días) |
| **No driver selection UI** | User no puede elegir manualmente | BAJO (4 horas) |

### 📐 Propuesta: DMXConfig Interface

```typescript
interface SetupDMXConfig {
  // Connection type
  mode: 'usb-serial' | 'artnet' | 'sacn' | 'virtual'
  
  // USB-Serial
  usb?: {
    comPort: string | 'auto'  // 'auto' = autoConnect()
    baudRate: number          // default 250000
    preferredChip?: string    // 'FTDI' | 'CH340' | etc
  }
  
  // ArtNet (FUTURE)
  artnet?: {
    ip: string                // e.g., '2.0.0.1'
    port: number              // default 6454
    universe: number          // 0-32767
  }
  
  // sACN (FUTURE)
  sacn?: {
    universe: number
    priority: number          // 0-200
    multicast: boolean
  }
  
  // Multi-universe (FUTURE)
  universes: {
    id: number                // 1-based
    driver: 'usb' | 'artnet' | 'sacn'
    config: Record<string, unknown>
  }[]
}
```

---

## 💡 FIXTURE SYSTEM - DEEP DIVE

### ✅ Capacidades Actuales

#### **FXTParser.ts** (559+ líneas) - Parser Profesional

```typescript
// KNOWN MODELS (línea ~40-80)
KNOWN_MODELS = {
  'shehds': { type: 'moving_head', brand: 'SHEHDS' },
  'chauvet': { type: 'par', brand: 'Chauvet' },
  'adj': { type: 'par', brand: 'ADJ' },
  'martin': { type: 'moving_head', brand: 'Martin' },
  // ... 20+ modelos
}

// CHANNEL SYNONYMS (línea ~100-150)
CHANNEL_SYNONYMS = {
  'dimmer': ['master', 'intensity', 'brightness', 'level'],
  'red': ['r', 'red1', 'red-1'],
  'pan': ['pan_coarse', 'panc', 'horizontal'],
  'tilt': ['tilt_coarse', 'tiltc', 'vertical'],
  // ... 30+ sinónimos
}
```

#### **Heuristic Type Detection**
El parser detecta automáticamente:
- `moving_head`: Si tiene PAN + TILT
- `strobe`: Si tiene STROBE channel y pocos canales totales
- `laser`: Si nombre contiene "laser"
- `wash`: Si es moving_head + color mixing
- `par`: Default para RGB sin movimiento

#### **FixtureManager.ts** (333 líneas) - Runtime Management
```typescript
// HARDCODED DEFINITIONS (línea ~40-100)
BUILTIN_DEFINITIONS = {
  'generic-par-rgb': { channels: 3, order: ['R','G','B'] },
  'generic-par-rgbw': { channels: 4, order: ['R','G','B','W'] },
  'generic-moving-head': { channels: 16, hasPanTilt: true },
  'generic-strobe': { channels: 2, hasStrobe: true }
}
```

### ❌ GAPS - Fixtures

| Gap | Impacto | Esfuerzo |
|-----|---------|----------|
| **No Open Fixture Library** | Biblioteca limitada a .fxt | ALTO (3-4 días) |
| **Definiciones hardcoded** | Solo 4 fixtures genéricos | MEDIO (1 día) |
| **No import externo** | `registerDefinition()` no expuesto | BAJO (2 horas) |
| **No preview visual** | No se muestra fixture antes de asignar | MEDIO (1 día) |
| **No channel test** | No se pueden probar canales individuales | MEDIO (4 horas) |

### 📐 Propuesta: FixtureDefinition Schema

```typescript
interface UnifiedFixtureDefinition {
  // Metadata
  id: string                     // UUID o slug único
  name: string                   // "SHEHDS 7x40W Moving Head"
  brand: string
  category: 'par' | 'moving_head' | 'wash' | 'strobe' | 'laser' | 'bar' | 'generic'
  
  // Source tracking
  source: {
    type: 'builtin' | 'fxt' | 'ofl' | 'manual'
    file?: string               // Path al archivo original
    confidence: number          // 0-1 del parser
  }
  
  // Physical
  physical?: {
    dimensions?: { width: number, height: number, depth: number }
    weight?: number
    powerConsumption?: number
  }
  
  // DMX
  modes: {
    name: string                // "16-Channel Mode"
    channelCount: number
    channels: ChannelDefinition[]
  }[]
  
  // Capabilities
  capabilities: {
    hasColor: boolean
    colorMode: 'rgb' | 'rgbw' | 'cmy' | 'wheel' | 'none'
    hasPan: boolean
    hasTilt: boolean
    hasZoom: boolean
    hasStrobe: boolean
    hasGobo: boolean
    hasPrism: boolean
  }
}

interface ChannelDefinition {
  index: number                 // 0-based
  name: string                  // "Red" | "Pan Coarse"
  type: ChannelType             // enum
  defaultValue: number          // 0-255
  
  // For wheels
  wheelSlots?: { name: string, dmxRange: [number, number] }[]
  
  // For 16-bit channels
  fine?: number                 // Index del canal fine
}

type ChannelType = 
  | 'dimmer' | 'strobe' 
  | 'red' | 'green' | 'blue' | 'white' | 'amber' | 'uv'
  | 'pan' | 'pan_fine' | 'tilt' | 'tilt_fine'
  | 'zoom' | 'focus'
  | 'gobo' | 'gobo_rotation' | 'prism' | 'color_wheel'
  | 'speed' | 'macro' | 'reset' | 'generic'
```

---

## 🎵 AUDIO SYSTEM - DEEP DIVE

### ✅ Capacidades Actuales

#### **useAudioCapture.ts** (524 líneas) - Web Audio Hook
```typescript
// Pre-amplification (línea ~380)
const preAmpGain = inputGain * 10  // inputGain 0.1-4.0 → preAmp 1-40
amplifiedBuffer[i] = Math.max(-1, Math.min(1, rawSample * preAmpGain))
```

#### **AudioConfig Persisted** (ConfigManager.ts)
```typescript
interface AudioConfig {
  source: 'microphone' | 'system' | 'simulation'
  deviceId?: string         // ⚠️ Se guarda pero NO se restaura
  sensitivity: number       // No se usa activamente
  inputGain: number         // ✅ SE USA - 0.1 a 4.0
}
```

#### **System Audio Capture**
- Usa `desktopCapturer` de Electron
- Hack: Captura video ficticio para obtener audio stream
- Funciona en Windows/Mac, problemas conocidos en Linux

### ❌ GAPS - Audio

| Gap | Impacto | Esfuerzo |
|-----|---------|----------|
| **deviceId no se restaura** | Usuario debe reseleccionar cada vez | BAJO (2 horas) |
| **No AGC (Auto Gain)** | Clipping o bajo nivel manual | MEDIO (1 día) |
| **No peak meter en Setup** | No hay feedback visual de nivel | BAJO (4 horas) |
| **No gain staging presets** | No hay "DJ booth", "PA system", etc | BAJO (2 horas) |
| **No latency compensation** | Desfase potencial audio→luz | MEDIO (1 día) |

### 📐 Propuesta: AudioSetupConfig

```typescript
interface SetupAudioConfig {
  // Source
  source: 'microphone' | 'system' | 'simulation' | 'external'
  
  // Device (NUEVO: persistencia real)
  device: {
    id: string
    name: string
    rememberedAt: string      // ISO date para stale check
  } | null
  
  // Gain Staging
  gainStaging: {
    mode: 'manual' | 'auto' | 'preset'
    manualGain: number        // 0.1 - 4.0
    
    // AGC settings (NUEVO)
    agc?: {
      targetLevel: number     // dB target (-12 typical)
      attackMs: number        // 50-500
      releaseMs: number       // 100-2000
      maxGain: number         // 4.0 max boost
      minGain: number         // 0.5 min
    }
    
    // Presets
    preset?: 'dj-booth' | 'pa-system' | 'home-studio' | 'mobile-phone'
  }
  
  // Calibration (NUEVO)
  calibration?: {
    noiseFloor: number        // dB del ruido ambiente
    peakHeadroom: number      // dB antes de clip
    lastCalibrated: string    // ISO date
  }
  
  // Beat Detection Tuning
  beatDetection: {
    sensitivity: number       // 0-1
    minBpm: number           // 60 default
    maxBpm: number           // 180 default
  }
}
```

---

## 🏪 PROPOSED: SetupStore Interface

```typescript
// src/stores/setupStore.ts

interface SetupState {
  // === WIZARD STATE ===
  currentStep: number                // 0-4
  stepsCompleted: boolean[]
  isConfigurationValid: boolean
  
  // === DMX CONFIGURATION ===
  dmx: SetupDMXConfig
  detectedPorts: DetectedPort[]      // From listDevices()
  dmxConnectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  
  // === FIXTURE CONFIGURATION ===
  fixtures: {
    definitions: Map<string, UnifiedFixtureDefinition>
    patched: PatchedFixture[]
    librarySource: 'builtin' | 'fxt-imported' | 'ofl'
  }
  
  // === AUDIO CONFIGURATION ===
  audio: SetupAudioConfig
  detectedAudioDevices: AudioDevice[]
  audioStatus: 'inactive' | 'listening' | 'calibrating' | 'ready'
  realtimeLevel: number              // dB para peak meter
  
  // === VENUE LAYOUT ===
  venue: {
    shape: 'rectangle' | 'circle' | 'custom'
    dimensions: { width: number, depth: number, height: number }
    stagePosition: 'front' | 'center' | 'none'
    installationType: 'ceiling' | 'floor' | 'truss'
  }
  
  // === ACTIONS ===
  
  // Navigation
  nextStep: () => void
  prevStep: () => void
  jumpToStep: (step: number) => void
  
  // DMX
  scanDMXPorts: () => Promise<DetectedPort[]>
  connectDMX: (config: SetupDMXConfig) => Promise<boolean>
  testDMXOutput: () => void          // Flash all at 50%
  
  // Fixtures
  importFixtureFile: (path: string) => Promise<UnifiedFixtureDefinition>
  loadFromOFL: (manufacturer: string, fixture: string) => Promise<UnifiedFixtureDefinition>
  addPatch: (definition: UnifiedFixtureDefinition, address: number) => void
  testFixture: (id: string) => void   // Ramp colors
  
  // Audio
  scanAudioDevices: () => Promise<AudioDevice[]>
  selectAudioDevice: (id: string) => Promise<boolean>
  startCalibration: () => void       // 5 second noise floor measurement
  stopCalibration: () => void
  setGainPreset: (preset: string) => void
  
  // Persistence
  saveConfiguration: () => Promise<void>
  loadConfiguration: () => Promise<void>
  exportConfiguration: () => string   // JSON for backup
}
```

---

## 📋 IMPLEMENTATION PRIORITY

### 🔴 WAVE 26 - Core (Esta semana)
| Task | Files | Effort |
|------|-------|--------|
| Create `setupStore.ts` | NEW | 4h |
| Add peak meter to SetupView | SetupView.tsx | 2h |
| Restore audio deviceId on load | useAudioCapture.ts, main.ts | 2h |
| DMX port dropdown selector | SetupView.tsx | 2h |

### 🟡 WAVE 27 - Professional Features
| Task | Files | Effort |
|------|-------|--------|
| AGC implementation | useAudioCapture.ts | 8h |
| Fixture test mode | FixtureManager.ts, IPC | 4h |
| .fxt file import UI | SetupView.tsx, IPC | 4h |
| Gain staging presets | audioStore.ts, UI | 2h |

### 🟢 WAVE 28 - Enterprise (Futuro)
| Task | Files | Effort |
|------|-------|--------|
| Open Fixture Library client | NEW OFLClient.ts | 16h |
| ArtNet implementation | DMXDriver.ts | 16h |
| sACN/E1.31 implementation | DMXDriver.ts | 16h |
| Multi-universe support | UniversalDMXDriver.ts | 8h |

---

## 🎯 SUCCESS METRICS

El Setup profesional debe lograr:

1. **< 30 segundos** para detectar DMX interface
2. **< 60 segundos** para importar fixture desde archivo
3. **< 10 segundos** para calibrar audio
4. **0 clicks** para usuario habitual (restore config)
5. **100% persistencia** entre sesiones

---

## 📚 ARCHIVOS AUDITADOS

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `electron/UniversalDMXDriver.ts` | 659 | USB-Serial DMX communication |
| `electron/FXTParser.ts` | 559+ | .fxt fixture parsing |
| `src/main/selene-lux-core/hardware/DMXDriver.ts` | 263 | Abstract DMX driver |
| `src/main/selene-lux-core/hardware/FixtureManager.ts` | 333 | Runtime fixture management |
| `src/hooks/useAudioCapture.ts` | 524+ | Web Audio capture hook |
| `src/stores/audioStore.ts` | 142 | Audio state zustand store |
| `electron/ConfigManager.ts` | 314 | User config persistence |

---

**WAVE 26 AUDIT COMPLETE** ✅

> *"Ahora sabemos exactamente lo que tenemos bajo el capó. Es hora de construir el motor profesional."*
