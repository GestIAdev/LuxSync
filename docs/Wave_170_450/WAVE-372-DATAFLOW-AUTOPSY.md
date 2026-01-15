# WAVE 372: DATA FLOW AUTOPSY & ARBITER INSERTION BLUEPRINT

**Date:** 2026-01-12  
**Status:** 🔬 FORENSICS COMPLETE  
**Objective:** Rastrear flujo de datos exacto para insertar MasterArbiter

---

## 🩸 EXECUTIVE SUMMARY: LA SANGRE DEL SISTEMA

### Lo que encontramos
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LUXSYNC BLOOD FLOW - CURRENT STATE                                          │
└─────────────────────────────────────────────────────────────────────────────┘

  🎤 AUDIO CAPTURE
       │
       │ Float32Array (raw samples)
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ TRINITY WORKERS (BETA → GAMMA)                                       │
  │   FFT → Spectral Analysis → BPM/Key/Genre/Mood                       │
  └─────────────────────────────────────────────────────────────────────┘
       │
       │ MusicalContext
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ TITAN ENGINE (El Corazón)                                            │
  │                                                                      │
  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
  │   │ Stabilizers │  │ VibeManager │  │NervousSystem│                  │
  │   │ Key/Energy  │  │             │  │ SeleneLux   │                  │
  │   │ Mood/Strat  │  │             │  │             │                  │
  │   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
  │          │                │                │                         │
  │          └────────────────┼────────────────┘                         │
  │                           ▼                                          │
  │               SeleneColorEngine.generate()                           │
  │               VibeMovementManager.generateIntent()                   │
  │                           │                                          │
  │                           ▼                                          │
  │                   ┌───────────────┐                                  │
  │                   │ LightingIntent│ ← 🎯 PUNTO DE INTERCEPCIÓN       │
  │                   └───────────────┘                                  │
  └─────────────────────────────────────────────────────────────────────┘
       │
       │ LightingIntent (Abstract: palette, zones, movement, effects)
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ HAL - HARDWARE ABSTRACTION LAYER                                     │
  │                                                                      │
  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
  │   │ PhysicsEng  │  │ ZoneRouter  │  │FixturePhys  │                  │
  │   │ (Decay)     │  │ (Zone→Fix)  │  │(Pan/Tilt)   │                  │
  │   └─────────────┘  └─────────────┘  └─────────────┘                  │
  │                           │                                          │
  │                           ▼                                          │
  │               ┌─────────────────────┐                                │
  │               │   FixtureMapper     │                                │
  │               │ (Intent→FixtureState│                                │
  │               │  + ManualOverrides) │ ← ⚠️ AQUÍ HAY OVERRIDES        │
  │               └─────────────────────┘                                │
  │                           │                                          │
  │                           ▼                                          │
  │               ┌─────────────────────┐                                │
  │               │   DMX Driver        │                                │
  │               │  (State→Buffer)     │                                │
  │               └─────────────────────┘                                │
  └─────────────────────────────────────────────────────────────────────┘
       │
       │ Uint8Array (512 channels per universe)
       ▼
  ═══════════════════════════════════════════════════════════════════════
                         🔌 HARDWARE (USB/ArtNet)
  ═══════════════════════════════════════════════════════════════════════
```

### La Galería Subterránea (CONSCIOUSNESS - No Conectada)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🌙 CONSCIOUSNESS LAYER (EXISTS BUT DISCONNECTED)                           │
└─────────────────────────────────────────────────────────────────────────────┘

  Audio → AudioToMusicalMapper → MusicalPattern
             │
             ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ SELENE LUX CONSCIOUS                                                 │
  │                                                                      │
  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
  │   │ UltrasonicHear  │  │ EvolutionEngine │  │  DreamForge     │     │
  │   │ (Consonance)    │  │ (Learning)      │  │ (Simulation)    │     │
  │   └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
  │            │                    │                    │              │
  │            └────────────────────┼────────────────────┘              │
  │                                 ▼                                   │
  │                    ConsciousnessToLightMapper                       │
  │                                 │                                   │
  │                                 ▼                                   │
  │                          LightCommand                               │
  │                    (palette, movement, effects)                     │
  │                                                                     │
  │   ════════════════════════════════════════════════════════════════  │
  │   ⚠️ DESCONECTADO: Este output NO llega a TitanEngine              │
  │   La clase existe, procesa frames, pero su output se pierde        │
  │   ════════════════════════════════════════════════════════════════  │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## 1. 🔬 SIGNAL TRACE: AUDIO → DMX

### 1.1 Punto de Entrada: Audio Capture

```typescript
// Frontend: AudioContext → Float32Array
// IPC: lux:audioBuffer → TitanOrchestrator.processAudioBuffer()

// TitanOrchestrator.ts line 586
processAudioBuffer(data: { bass: number; mid: number; high: number; energy: number }): void {
  this.lastAudioData = data
  this.lastAudioTimestamp = Date.now()
  this.hasRealAudio = true
}
```

### 1.2 Trinity Processing (Workers)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TRINITY NEURAL NETWORK                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

  ALPHA (Orchestrator)
       │
       │ Raw Audio
       ▼
  BETA (FFT Worker)
       │ 
       │ Spectral Data (bands, peaks, RMS)
       ▼
  GAMMA (Analysis Worker)
       │
       │ MusicalAnalysis {
       │   bpm, key, mode, mood,
       │   genre, section, syncopation
       │ }
       ▼
  TRINITY BRAIN
       │
       │ MusicalContext (enriched)
       ▼
  TITAN ENGINE
```

### 1.3 Engine Processing Chain

```typescript
// TitanEngine.update() - THE MAIN LOOP
public update(context: MusicalContext, audio: EngineAudioMetrics): LightingIntent {
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: STABILIZATION (Anti-Epilepsy)
  // ═══════════════════════════════════════════════════════════════════
  const energyOutput = this.energyStabilizer.update(context.energy)
  const keyOutput = this.keyStabilizer.update(keyInput)
  const moodOutput = this.moodArbiter.update(moodInput)
  const strategyOutput = this.strategyArbiter.update(strategyInput)
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: COLOR GENERATION (SeleneColorEngine)
  // ═══════════════════════════════════════════════════════════════════
  const selenePalette = SeleneColorEngine.generate(audioAnalysis, constitution)
  const palette = this.selenePaletteToColorPalette(selenePalette)
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: NERVOUS SYSTEM (Genre-Specific Physics)
  // ═══════════════════════════════════════════════════════════════════
  const nervousOutput = this.nervousSystem.updateFromTitan(...)
  // Returns: { physicsApplied: 'techno'|'latino'|'rock'|'chill', zoneIntensities, isStrobeActive }
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: ZONE INTENSITIES
  // ═══════════════════════════════════════════════════════════════════
  let zones = this.calculateZoneIntents(audio, context, vibeProfile)
  
  // NervousSystem override (per-genre physics)
  if (nervousOutput.physicsApplied in ['techno', 'latino', 'rock', 'chill']) {
    zones = nervousOutput.zoneIntensities  // ← PHYSICS OVERRIDE AQUÍ
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: MOVEMENT GENERATION (VibeMovementManager)
  // ═══════════════════════════════════════════════════════════════════
  const movement = this.calculateMovement(audio, context, vibeProfile)
  // Internally calls: vibeMovementManager.generateIntent()
  // Returns: { x, y, pattern, speed, amplitude, phaseType }
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: EFFECTS
  // ═══════════════════════════════════════════════════════════════════
  const effects = this.calculateEffects(audio, context, vibeProfile)
  
  // ═══════════════════════════════════════════════════════════════════
  // OUTPUT: LightingIntent
  // ═══════════════════════════════════════════════════════════════════
  return {
    palette,           // ColorPalette (primary, secondary, accent, ambient)
    masterIntensity,   // 0-1
    zones,             // ZoneIntentMap (front, back, left, right, ambient)
    movement,          // MovementIntent (pattern, speed, amplitude, centerX, centerY)
    effects,           // EffectIntent[]
    source: 'procedural',
    timestamp: now,
  }
}
```

### 1.4 HAL Processing Chain

```typescript
// HardwareAbstraction.render() - THE DMX PIPELINE
public render(
  intent: LightingIntent,
  fixtures: PatchedFixture[],
  audioMetrics: AudioMetrics
): FixtureState[] {
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: VIBE SYNC (Update physics configs)
  // ═══════════════════════════════════════════════════════════════════
  this.updateVibeFromIntent(intent)  // Syncs physics driver with current vibe
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: PER-FIXTURE MAPPING
  // ═══════════════════════════════════════════════════════════════════
  for (const fixture of fixtures) {
    const zone = fixture.zone as PhysicalZone
    
    // A. Calculate intensity via ZoneRouter + PhysicsEngine
    const intensity = this.router.getIntensityForZone(intent, zone, audioMetrics)
    const physicsIntensity = this.physics.applyDecayWithPhysics(...)
    
    // B. Calculate movement for movers
    if (isMovingZone(zone)) {
      // Get base position from intent.movement
      const baseX = intent.movement.centerX
      const baseY = intent.movement.centerY
      
      // Apply phase offset (snake effect)
      const { x, y } = this.applyPhaseOffset(baseX, baseY, pattern, fixtureIndex, zone, ...)
      
      // Apply FixturePhysicsDriver (inertia, limits)
      const dmxPosition = this.movementPhysics.update(fixtureId, { x, y }, deltaTime)
    }
    
    // C. Map to FixtureState
    const state = this.mapper.mapFixture(fixture, intent, finalIntensity, movement)
    
    // D. Apply manual overrides ← ⚠️ AQUÍ ESTÁ EL OVERRIDE ACTUAL
    const finalState = this.mapper.applyEffectsAndOverrides([state], timestamp)
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: DMX BUFFER WRITE
  // ═══════════════════════════════════════════════════════════════════
  this.driver.send(dmxPacket)
}
```

---

## 2. 🔍 COMPONENT ANALYSIS

### 2.1 VibeMovementManager - Coordinates Output

**Location:** `src/engine/movement/VibeMovementManager.ts`

```typescript
export interface MovementIntent {
  x: number        // Posición X normalizada (-1 a +1)  ← RELATIVE TO CENTER
  y: number        // Posición Y normalizada (-1 a +1)  ← RELATIVE TO CENTER
  pattern: string  // Patrón activo
  speed: number    // Velocidad normalizada (0-1)
  amplitude: number // Amplitud del movimiento (0-1)
  phaseType?: 'linear' | 'polar'
}
```

**Clave:** Las coordenadas son **RELATIVAS AL CENTRO** (-1 a +1), no absolutas DMX.
- `x = 0, y = 0` = Centro del rango de movimiento
- `x = -1` = Extremo izquierdo
- `x = +1` = Extremo derecho

**Pattern Library (por género):**
```typescript
VIBE_CONFIG = {
  'techno-club': {
    amplitudeScale: 1.0,       // FULL RANGE
    patterns: ['sweep', 'skySearch', 'botStabs', 'mirror']
  },
  'fiesta-latina': {
    amplitudeScale: 0.85,      // 85% del rango
    patterns: ['figure8', 'circle', 'snake']
  },
  'pop-rock': {
    amplitudeScale: 0.75,
    patterns: ['blinder', 'vShape', 'wave']
  },
  'chill-lounge': {
    amplitudeScale: 0.35,      // MUY SUTIL
    patterns: ['ocean', 'drift', 'nebula']
  }
}
```

### 2.2 SeleneColorEngine - Output Format

**Location:** `src/engine/color/SeleneColorEngine.ts`

```typescript
export interface SelenePalette {
  primary: HSLColor    // Color principal (H: 0-360, S: 0-100, L: 0-100)
  secondary: HSLColor  // Fibonacci rotation (φ × 360° ≈ 222.5°)
  accent: HSLColor     // Highlights, strobes
  ambient: HSLColor    // Fills, background
  contrast: HSLColor   // Siluetas, sombras
  meta: PaletteMeta
}
```

**Color Generation Logic:**
```
KEY_TO_HUE[key] + MODE_MODIFIERS[mode].hueDelta = BASE HUE
Energy → Saturation/Lightness (NEVER Hue)
Syncopation → Strategy (analogous/triadic/complementary)
```

**Output es HSL ABSTRACTO** - se convierte a RGB en HAL.

### 2.3 FixturePhysicsDriver - Movement Limiter

**Location:** `src/engine/movement/FixturePhysicsDriver.ts`

```typescript
// SAFETY CAPS (nunca exceder, protege hardware barato)
SAFETY_CAP = {
  maxAcceleration: 2500,  // DMX units/s² - Límite absoluto
  maxVelocity: 800,       // DMX units/s - Límite absoluto
}

// Per-vibe physics (within safety caps)
VIBE_PHYSICS = {
  'techno-club': { maxAcceleration: 2200, maxVelocity: 700, friction: 0.08 },
  'fiesta-latina': { maxAcceleration: 1200, maxVelocity: 400, friction: 0.15 },
  'chill-lounge': { maxAcceleration: 600, maxVelocity: 200, friction: 0.25 },
}
```

**Este ES el limitador final** antes de DMX:
- Convierte coordenadas abstractas (-1 a +1) → DMX (0-255)
- Aplica inercia física (aceleración/deceleración)
- Respeta límites mecánicos
- Anti-jitter filter

---

## 3. 🎯 PUNTO DE INTERCEPCIÓN: DÓNDE INSERTAR EL ARBITER

### Análisis de Candidatos

| Punto | Ubicación | Pro | Contra |
|-------|-----------|-----|--------|
| **A** | Antes de TitanEngine | Intercepta todo | Rompe estabilización |
| **B** | Después de TitanEngine | LightingIntent limpio | No ve Consciousness |
| **C** | En HAL (antes de Physics) | Ve todo, control total | Demasiado tarde para AI |
| **D** | En FixtureMapper | Per-fixture control | Solo override, no blend |

### 🏆 RECOMENDACIÓN: PUNTO B+

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INSERTION POINT: BETWEEN ENGINE AND HAL                                     │
└─────────────────────────────────────────────────────────────────────────────┘

  TitanEngine.update()
       │
       │ LightingIntent (Layer 0: AI Intent)
       ▼
  ═══════════════════════════════════════════════════════════════════════════
  │                       🆕 MASTER ARBITER                                  │
  │                                                                          │
  │   Input 1: Layer0_Titan (LightingIntent from AI)                         │
  │   Input 2: Layer1_Manual (from ManualOverrideStore)                      │
  │   Input 3: Layer2_FX (from EffectsQueue)                                 │
  │   Input 4: Layer3_Consciousness (FUTURE: from SeleneLuxConscious)        │
  │                                                                          │
  │   Logic: Priority merge per fixture, per channel                         │
  │   Output: FinalLightingTarget                                            │
  ═══════════════════════════════════════════════════════════════════════════
       │
       │ FinalLightingTarget
       ▼
  HardwareAbstraction.render()
       │
       │ (Physics applied AFTER arbiter)
       ▼
  FixturePhysicsDriver
       │
       │ DMX Buffer
       ▼
  Hardware
```

**Razón:** 
1. Recibe LightingIntent PURO del AI (Layer 0)
2. Puede mezclar con Manual/FX antes de physics
3. Physics se aplica DESPUÉS (respeta límites de hardware)
4. Canal abierto para Consciousness (Layer 3)

---

## 4. 🏗️ MASTER ARBITER BLUEPRINT

### 4.1 Interfaces

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// src/core/arbiter/MasterArbiter.ts
// ═══════════════════════════════════════════════════════════════════════════

import type { LightingIntent, HSLColor, MovementIntent } from '../protocol/LightingIntent'

// ─────────────────────────────────────────────────────────────────────────
// LAYER DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────

/** Priority layers (higher number = higher priority) */
export enum ControlLayer {
  TITAN_AI = 0,      // Base: AI-generated intent
  CONSCIOUSNESS = 1, // Future: SeleneLuxConscious modifications
  MANUAL = 2,        // User manual overrides (faders, joystick)
  EFFECTS = 3,       // Temporary effects (strobe, flash)
  BLACKOUT = 4,      // Emergency blackout (highest priority)
}

/** Channel types that can be controlled */
export type ChannelType = 
  | 'dimmer'
  | 'color'      // r, g, b as unit
  | 'pan'
  | 'tilt'
  | 'zoom'
  | 'focus'
  | 'gobo'
  | 'prism'

/** Control source for a channel */
export interface ChannelControl {
  layer: ControlLayer
  value: number | HSLColor    // number for dimmer/pan/tilt, HSLColor for color
  timestamp: number           // When this control was set
  ttl?: number               // Time-to-live in ms (for effects)
  crossfadeMs?: number       // Smooth transition time
}

// ─────────────────────────────────────────────────────────────────────────
// INPUT LAYERS
// ─────────────────────────────────────────────────────────────────────────

/** Layer 0: AI Intent (from TitanEngine) */
export interface Layer0_Titan {
  intent: LightingIntent
  timestamp: number
}

/** Layer 1: Consciousness Modifier (from SeleneLuxConscious - FUTURE) */
export interface Layer1_Consciousness {
  active: boolean
  paletteModifier?: {
    hueShift: number     // -180 to +180
    satScale: number     // 0-2 (1 = no change)
    lightScale: number   // 0-2
  }
  movementModifier?: {
    amplitudeScale: number  // 0-2
    speedScale: number      // 0-2
    patternOverride?: string
  }
  emotionalOverlay?: {
    mood: 'aggressive' | 'peaceful' | 'chaotic' | 'harmonious'
    intensity: number  // 0-1
  }
  timestamp: number
}

/** Layer 2: Manual Override (from UI/MIDI) */
export interface Layer2_Manual {
  fixtureId: string
  controls: Partial<{
    dimmer: number       // 0-255
    r: number            // 0-255
    g: number            // 0-255
    b: number            // 0-255
    pan: number          // 0-255
    tilt: number         // 0-255
    zoom: number         // 0-255
    focus: number        // 0-255
  }>
  /** Channels to override (others fall through to AI) */
  overrideChannels: ChannelType[]
  timestamp: number
}

/** Layer 3: Effect Overlay (temporary) */
export interface Layer3_Effect {
  type: 'strobe' | 'flash' | 'blackout' | 'blinder'
  intensity: number
  duration: number      // ms
  startTime: number
  /** Affected fixtures (empty = all) */
  fixtureIds: string[]
}

// ─────────────────────────────────────────────────────────────────────────
// OUTPUT
// ─────────────────────────────────────────────────────────────────────────

/** Final target for a fixture (what gets sent to HAL) */
export interface FixtureLightingTarget {
  fixtureId: string
  dimmer: number
  color: { r: number; g: number; b: number }
  pan: number
  tilt: number
  zoom: number
  focus: number
  /** Which layer is controlling each channel (for debug) */
  _controlSources: Record<ChannelType, ControlLayer>
}

/** Complete output from arbiter */
export interface FinalLightingTarget {
  fixtures: FixtureLightingTarget[]
  globalEffects: {
    strobeActive: boolean
    strobeSpeed: number
    blackoutActive: boolean
  }
  timestamp: number
  /** Debug: layer activity */
  _layerActivity: {
    titanActive: boolean
    consciousnessActive: boolean
    manualOverrides: number
    effectsActive: number
  }
}

// ─────────────────────────────────────────────────────────────────────────
// MERGE STRATEGIES
// ─────────────────────────────────────────────────────────────────────────

/** How to merge values from different layers */
export type MergeStrategy = 
  | 'HTP'     // Highest Takes Precedence (for dimmers)
  | 'LTP'     // Latest Takes Precedence (for position, color)
  | 'BLEND'   // Weighted blend (for smooth transitions)
  | 'OVERRIDE' // Complete override (for blackout)

export const CHANNEL_MERGE_STRATEGY: Record<ChannelType, MergeStrategy> = {
  dimmer: 'HTP',    // ← INDUSTRY STANDARD: HTP for intensity
  color: 'LTP',     // ← LTP for color
  pan: 'LTP',       // ← LTP for position
  tilt: 'LTP',
  zoom: 'LTP',
  focus: 'LTP',
  gobo: 'LTP',
  prism: 'LTP',
}
```

### 4.2 MasterArbiter Class

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// MASTER ARBITER CLASS
// ═══════════════════════════════════════════════════════════════════════════

import { EventEmitter } from 'events'

export class MasterArbiter extends EventEmitter {
  // Layer state
  private layer0_titan: Layer0_Titan | null = null
  private layer1_consciousness: Layer1_Consciousness | null = null
  private layer2_manual: Map<string, Layer2_Manual> = new Map()
  private layer3_effects: Layer3_Effect[] = []
  
  // Global state
  private blackoutActive = false
  private crossfadeState: Map<string, CrossfadeState> = new Map()
  
  // Config
  private defaultCrossfadeMs = 500
  
  constructor() {
    super()
    console.log('[MasterArbiter] 🎛️ Initialized')
  }
  
  // ─────────────────────────────────────────────────────────────────────
  // LAYER SETTERS
  // ─────────────────────────────────────────────────────────────────────
  
  /** Update Layer 0: AI Intent (called every frame by TitanOrchestrator) */
  setTitanIntent(intent: LightingIntent): void {
    this.layer0_titan = {
      intent,
      timestamp: Date.now()
    }
  }
  
  /** Update Layer 1: Consciousness (called by SeleneLuxConscious when active) */
  setConsciousnessModifier(modifier: Layer1_Consciousness): void {
    this.layer1_consciousness = modifier
    this.emit('consciousness-updated', modifier)
  }
  
  /** Clear consciousness (when disabled) */
  clearConsciousness(): void {
    this.layer1_consciousness = null
  }
  
  /** Set manual override for a fixture */
  setManualOverride(override: Layer2_Manual): void {
    this.layer2_manual.set(override.fixtureId, {
      ...override,
      timestamp: Date.now()
    })
    this.emit('manual-override-set', override.fixtureId)
  }
  
  /** Clear manual override for a fixture */
  clearManualOverride(fixtureId: string, channels?: ChannelType[]): void {
    if (channels) {
      const existing = this.layer2_manual.get(fixtureId)
      if (existing) {
        existing.overrideChannels = existing.overrideChannels.filter(
          ch => !channels.includes(ch)
        )
        if (existing.overrideChannels.length === 0) {
          this.layer2_manual.delete(fixtureId)
        }
      }
    } else {
      this.layer2_manual.delete(fixtureId)
    }
    
    // Start crossfade back to AI
    this.startCrossfade(fixtureId, this.defaultCrossfadeMs)
    this.emit('manual-override-cleared', fixtureId)
  }
  
  /** Trigger effect (auto-expires) */
  triggerEffect(effect: Omit<Layer3_Effect, 'startTime'>): void {
    this.layer3_effects.push({
      ...effect,
      startTime: Date.now()
    })
    this.emit('effect-triggered', effect.type)
  }
  
  /** Emergency blackout */
  setBlackout(active: boolean): void {
    this.blackoutActive = active
    this.emit('blackout', active)
  }
  
  // ─────────────────────────────────────────────────────────────────────
  // MAIN ARBITER LOGIC
  // ─────────────────────────────────────────────────────────────────────
  
  /** 
   * Arbitrate all layers and produce final lighting targets
   * Called every frame by TitanOrchestrator
   */
  arbitrate(fixtures: PatchedFixture[]): FinalLightingTarget {
    const now = Date.now()
    
    // Clean up expired effects
    this.layer3_effects = this.layer3_effects.filter(
      fx => now - fx.startTime < fx.duration
    )
    
    // Check blackout first (highest priority)
    if (this.blackoutActive) {
      return this.generateBlackoutTarget(fixtures, now)
    }
    
    // Process each fixture
    const fixtureTargets: FixtureLightingTarget[] = fixtures.map(fixture => {
      return this.arbitrateFixture(fixture, now)
    })
    
    return {
      fixtures: fixtureTargets,
      globalEffects: {
        strobeActive: this.layer3_effects.some(fx => fx.type === 'strobe'),
        strobeSpeed: this.getStrobeSpeed(),
        blackoutActive: false
      },
      timestamp: now,
      _layerActivity: {
        titanActive: this.layer0_titan !== null,
        consciousnessActive: this.layer1_consciousness?.active ?? false,
        manualOverrides: this.layer2_manual.size,
        effectsActive: this.layer3_effects.length
      }
    }
  }
  
  /** Arbitrate a single fixture */
  private arbitrateFixture(fixture: PatchedFixture, now: number): FixtureLightingTarget {
    const fixtureId = fixture.id || fixture.name
    const controlSources: Record<ChannelType, ControlLayer> = {} as any
    
    // Start with Layer 0 (AI) as base
    const base = this.getBaseFromTitan(fixture)
    
    // Apply Layer 1 (Consciousness) modifications
    let modified = this.applyConsciousness(base, fixture)
    
    // Check Layer 2 (Manual) overrides
    const manual = this.layer2_manual.get(fixtureId)
    if (manual) {
      modified = this.applyManualOverride(modified, manual, controlSources)
    }
    
    // Apply Layer 3 (Effects)
    modified = this.applyEffects(modified, fixtureId, now, controlSources)
    
    // Apply crossfade if active
    modified = this.applyCrossfade(modified, fixtureId, now)
    
    return {
      fixtureId,
      ...modified,
      _controlSources: controlSources
    }
  }
  
  // ... (implementation methods: applyConsciousness, applyManualOverride, etc.)
}
```

### 4.3 Integration with TitanOrchestrator

```typescript
// TitanOrchestrator.ts - MODIFIED

class TitanOrchestrator {
  private arbiter: MasterArbiter  // 🆕 ADD
  
  async init(): Promise<void> {
    // ... existing init ...
    
    // 🆕 Initialize Master Arbiter
    this.arbiter = new MasterArbiter()
    console.log('[TitanOrchestrator] MasterArbiter created')
  }
  
  private processFrame(): void {
    // ... existing code until Engine update ...
    
    // 3. Engine processes context -> produces LightingIntent
    const intent = this.engine.update(context, engineAudioMetrics)
    
    // 🆕 4. MASTER ARBITER: Merge all layers
    this.arbiter.setTitanIntent(intent)
    const finalTarget = this.arbiter.arbitrate(this.fixtures)
    
    // 5. HAL renders FINAL TARGET (not raw intent)
    const fixtureStates = this.hal.renderFromTarget(finalTarget, halAudioMetrics)
    
    // ... rest of frame processing ...
  }
  
  // 🆕 IPC handlers for manual control
  setManualOverride(fixtureId: string, override: ManualOverride): void {
    this.arbiter.setManualOverride({
      fixtureId,
      controls: override,
      overrideChannels: Object.keys(override) as ChannelType[],
      timestamp: Date.now()
    })
  }
  
  clearManualOverride(fixtureId: string): void {
    this.arbiter.clearManualOverride(fixtureId)
  }
  
  setBlackout(active: boolean): void {
    this.arbiter.setBlackout(active)
  }
}
```

---

## 5. 🔮 CORE 3 INTEGRATION STRATEGY

### Canal Abierto para Consciousness

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// FUTURE: Connecting SeleneLuxConscious to MasterArbiter
// ═══════════════════════════════════════════════════════════════════════════

// SeleneLuxConscious emits decisions:
consciousEngine.on('light-command', (command: LightCommand) => {
  // Convert LightCommand to Layer1_Consciousness
  arbiter.setConsciousnessModifier({
    active: true,
    paletteModifier: {
      hueShift: command.paletteHueShift,
      satScale: command.intensityMultiplier,
      lightScale: 1.0
    },
    movementModifier: {
      amplitudeScale: command.movement === 'aggressive' ? 1.5 : 1.0,
      speedScale: command.speed,
      patternOverride: command.movementPattern
    },
    emotionalOverlay: {
      mood: command.emotionalTone,
      intensity: command.confidence
    },
    timestamp: Date.now()
  })
})

// DreamForge can propose changes:
dreamForge.on('dream-completed', (result: DreamResult) => {
  if (result.recommendation === 'execute') {
    // Apply dream result as consciousness modifier
    arbiter.setConsciousnessModifier(
      dreamToConsciousnessModifier(result)
    )
  }
})
```

### Architecture Post-CORE3

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POST-CORE3 ARCHITECTURE                                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────────────┐
                         │      AUDIO CAPTURE          │
                         └──────────────┬──────────────┘
                                        │
               ┌────────────────────────┼────────────────────────┐
               │                        │                        │
               ▼                        ▼                        ▼
      ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
      │  TRINITY BRAIN  │     │ SELENE CONSCIOUS│     │  EFFECTS QUEUE  │
      │  (Analysis)     │     │ (Hunt/Dream)    │     │ (Strobe/Flash)  │
      └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
               │                       │                       │
               │ MusicalContext        │ LightCommand          │ EffectIntent
               │                       │                       │
               ▼                       │                       │
      ┌─────────────────┐              │                       │
      │  TITAN ENGINE   │              │                       │
      │  (Color/Move)   │              │                       │
      └────────┬────────┘              │                       │
               │                       │                       │
               │ Layer0_Titan          │ Layer1_Consciousness  │ Layer3_Effect
               │ (LightingIntent)      │ (Modifier)            │
               │                       │                       │
               └───────────────────────┼───────────────────────┘
                                       │
                                       ▼
                          ┌─────────────────────────────┐
                          │      MASTER ARBITER         │
                          │                             │
                          │  Priority: BLACKOUT > FX    │
                          │           > MANUAL > AI     │
                          │                             │
                          │  Per-Fixture, Per-Channel   │
                          │  HTP for Dimmer, LTP rest   │
                          └──────────────┬──────────────┘
                                         │
                                         │ FinalLightingTarget
                                         ▼
                          ┌─────────────────────────────┐
                          │           HAL               │
                          │  (Physics + DMX)            │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                                    HARDWARE
```

---

## 6. 📋 CALIBRATION SCENARIO SOLUTION

### El Problema Original

> "Si selecciono Selene IA mode y empiezo a cambiar las posiciones... ¿Se cortaría el flujo de Selene?"

### La Solución con MasterArbiter

```typescript
// CALIBRATION MODE: Manual override ONLY for movement, AI keeps color

// 1. User selects fixture #3 for calibration
arbiter.setManualOverride({
  fixtureId: 'fixture_3',
  controls: {
    pan: 127,   // Manual position
    tilt: 64,
  },
  overrideChannels: ['pan', 'tilt'],  // ONLY movement
  timestamp: Date.now()
})

// Result:
// - fixture_3.pan = 127 (MANUAL - Layer 2)
// - fixture_3.tilt = 64 (MANUAL - Layer 2)
// - fixture_3.dimmer = AI (TITAN - Layer 0)
// - fixture_3.color = AI (TITAN - Layer 0)
// - All other fixtures = AI (TITAN - Layer 0)

// 2. User finishes calibration
arbiter.clearManualOverride('fixture_3')

// Result:
// - fixture_3 crossfades back to AI over 500ms
// - NO JUMP - smooth transition
```

---

## 7. 📊 SUMMARY

### Puntos Clave del Data Flow

1. **Audio → Engine:** Trinity Workers → MusicalContext → TitanEngine
2. **Engine Output:** `LightingIntent` es ABSTRACTO (no DMX)
3. **Movement Coords:** Relativas al centro (-1 a +1), no absolutas
4. **Color Output:** HSL abstracto, convertido a RGB en HAL
5. **Physics:** FixturePhysicsDriver es el ÚLTIMO limitador

### MasterArbiter Insertion

- **Ubicación:** Entre TitanEngine y HAL
- **Input:** LightingIntent (L0) + Consciousness (L1) + Manual (L2) + Effects (L3)
- **Output:** FinalLightingTarget (per-fixture, per-channel arbitrado)
- **Merge:** HTP para dimmer, LTP para el resto

### Core 3 Compatibility

- `Layer1_Consciousness` interfaz lista para SeleneLuxConscious
- DreamForge puede proponer modificaciones via el mismo canal
- No requiere reescribir el Arbiter cuando se conecte Consciousness

---

**WAVE 372 Status:** ✅ AUTOPSY COMPLETE

*"Ahora sabemos exactamente dónde late el corazón. El bisturí está listo."* 🔬
