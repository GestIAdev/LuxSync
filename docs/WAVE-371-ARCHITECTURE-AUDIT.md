# WAVE 371: ARCHITECTURE AUDIT & CONTROL HIERARCHY FORENSICS

**Date:** 2026-01-12  
**Status:** 📋 AUDIT COMPLETE  
**Objective:** Auditar sistema de control, proponer jerarquía limpia

---

## 🔍 EXECUTIVE SUMMARY

### The Good
- ✅ Architecture is **cleaner than expected** - TitanOrchestrator is the single orchestrator
- ✅ No "FlowEngine" class exists - it's conceptual, not zombie code
- ✅ ManualOverrides system exists and is properly layered

### The Problems
- ⚠️ **Mode confusion**: UI has Flow/Selene/Locked, Backend has auto/manual
- ⚠️ **No Master Arbiter**: Manual overrides bypass Selene but don't communicate back
- ⚠️ **Boot sequence starts automatically** - No explicit user action required
- ⚠️ **Calibration scenario broken**: Adjusting fixture position while Selene runs = conflict

---

## 1. 📊 BOOT SEQUENCE AUDIT

### Current Boot Flow (ASCII Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LUXSYNC BOOT SEQUENCE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  app.whenReady()
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ initTitan()                                                          │
  │                                                                      │
  │  1. stagePersistence.init()          ← Load/create shows             │
  │  2. effectsEngine = new EffectsEngine()                              │
  │  3. titanOrchestrator = new TitanOrchestrator()                      │
  │  4. titanOrchestrator.init()         ← Creates Brain, Engine, HAL    │
  │  5. titanOrchestrator.start() ────────────────────────────────────┐  │
  │  6. setupIPCHandlers(deps)                                        │  │
  │                                                                   │  │
  └───────────────────────────────────────────────────────────────────│──┘
                                                                      │
                                                                      ▼
                                                        ┌─────────────────────┐
                                                        │ setInterval @ 30fps │
                                                        │   processFrame()    │
                                                        │                     │
                                                        │ AUTOMATIC START!    │
                                                        │ No user action      │
                                                        │ required            │
                                                        └─────────────────────┘
                                                                      │
       ┌──────────────────────────────────────────────────────────────┘
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ processFrame() Loop                                                  │
  │                                                                      │
  │  1. Check audio staleness (500ms threshold)                          │
  │  2. Get MusicalContext from Brain                                    │
  │  3. If hasRealAudio → use lastAudioData, else → zeros (IDLE)         │
  │  4. TitanEngine.update(context, audioMetrics) → LightingIntent       │
  │  5. HAL.render(intent, fixtures, halMetrics) → FixtureStates         │
  │  6. Broadcast SeleneTruth to frontend                                │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
```

### Key Finding: Auto-Start Behavior

```typescript
// main.ts line 246
titanOrchestrator.start()  // ← AUTOMATIC! No button press required

// TitanOrchestrator.ts line 164
start(): void {
  this.isRunning = true
  this.mainLoopInterval = setInterval(() => {
    this.processFrame()
  }, 33) // ~30fps
}
```

**Verdict:** El loop DMX arranca **automáticamente** al iniciar la app. El botón "POWER" en BigSwitch.tsx es **puramente visual** - solo cambia `isActive` local state, no comunica con el backend.

### Initial State Decision

```typescript
// TitanOrchestrator.ts line 58
// WAVE 255: Force IDLE on startup - system starts in blackout
initialVibe: 'idle',

// TitanEngineConfig
initialVibe: config.initialVibe ?? 'idle',
```

**Verdict:** El sistema arranca en vibe `idle`, lo que significa blackout visual (dimmer 0), pero el loop **sigue corriendo**.

---

## 2. 🎮 ENGINE CLASH AUDIT

### Current Mode Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        MODE TERMINOLOGY CHAOS                                  │
└───────────────────────────────────────────────────────────────────────────────┘

  FRONTEND (UI)                          BACKEND (TitanOrchestrator)
  ──────────────────                     ───────────────────────────
  
  controlStore.ts:                       TitanOrchestrator.ts:
  ├─ GlobalMode:                         ├─ mode: 'auto' | 'manual'
  │   'manual' | 'flow' | 'selene'       │
  │   | null (idle)                      └─ useBrain: boolean
  │
  seleneStore.ts:
  ├─ SeleneMode:
  │   'flow' | 'selene' | 'locked'
  │
  ModeSwitcher.tsx:
  └─ Uses 'flow' | 'selene' | 'locked'

                    ▼ IPC TRANSLATION ▼
  
  window.lux.setMode('selene')  ──────▶  titanOrchestrator.setMode('selene')
                                         │
                                         ▼
                                   this.mode = 'selene' as 'auto' | 'manual'
                                   // ⚠️ TYPE MISMATCH! 'selene' ≠ 'auto'|'manual'
```

### What Each "Mode" Actually Does

| UI Mode | Backend Effect | Brain | Description |
|---------|---------------|-------|-------------|
| `flow` | `mode = 'flow'` (invalid cast) | ON | Semi-auto reactive |
| `selene` | `mode = 'selene'` (invalid cast) | ON | AI autonomous |
| `locked` | `mode = 'locked'` (invalid cast) | OFF? | Manual control |

**CRITICAL FINDING:** The backend only recognizes `'auto' | 'manual'`, but receives `'flow' | 'selene' | 'locked'` from UI. The type cast is **silently invalid**.

### Does FlowEngine Exist?

```bash
grep -r "FlowEngine|class.*Flow" → NO MATCHES
```

**Verdict:** ❌ **FlowEngine is NOT a real class**. "Flow" mode is conceptual:
- It sets `useBrain = true` 
- Uses TitanEngine with same code path as Selene
- The difference is in **UI perception**, not code execution

### Manual Override System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MANUAL OVERRIDE PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

  UI Manual Control
       │
       │ lux:setManualOverride(fixtureId, { pan, tilt, dimmer, r, g, b })
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ IPCHandlers.ts                                                       │
  │   manualOverrides.set(fixtureId, overrides)                          │
  └─────────────────────────────────────────────────────────────────────┘
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ FixtureMapper.ts                                                     │
  │                                                                      │
  │   const override = this.manualOverrides.get(fixtureId)               │
  │   if (override) {                                                    │
  │     // MERGE: Override wins for specified channels                   │
  │     state.pan = override.pan ?? state.pan                            │
  │     state.tilt = override.tilt ?? state.tilt                         │
  │     // etc.                                                          │
  │   }                                                                  │
  └─────────────────────────────────────────────────────────────────────┘
       │
       ▼
  DMX Buffer (with overrides applied)
```

**Verdict:** ✅ ManualOverrides exist and work, BUT they're applied **silently** - Selene doesn't know a fixture is being manually controlled.

---

## 3. 🎯 THE CALIBRATION SCENARIO

### Your Real-World Problem

> "En la discoteca, lo primero que hacemos es calibrar el foco y el apuntado de los móviles. 
> Si selecciono Selene IA mode y empiezo a cambiar las posiciones... ¿Se cortaría el flujo de Selene?"

### Current Behavior Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CALIBRATION SCENARIO - WHAT HAPPENS NOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

  User: "Quiero calibrar el Moving Head #3"
       │
       ├─ Modo Selene ACTIVO
       │
       ▼
  User ajusta Pan/Tilt en UI
       │
       │ lux:setManualOverride(3, { pan: 127, tilt: 64 })
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ FRAME N: TitanEngine calculates                                      │
  │   → Pan = 200 (following music pattern)                              │
  │   → Tilt = 180                                                       │
  │                                                                      │
  │ FixtureMapper applies override                                       │
  │   → Pan = 127 (MANUAL WINS)                                          │
  │   → Tilt = 64 (MANUAL WINS)                                          │
  │                                                                      │
  │ DMX Output: Pan=127, Tilt=64 ✓                                       │
  └─────────────────────────────────────────────────────────────────────┘
       │
       │ User saves calibration to Stage Constructor
       │ User clears manual override
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ FRAME N+1: TitanEngine calculates                                    │
  │   → Pan = 205 (music shifted)                                        │
  │   → Tilt = 175                                                       │
  │                                                                      │
  │ NO OVERRIDE - Selene takes over                                      │
  │   → Pan = 205                                                        │
  │   → Tilt = 175                                                       │
  │                                                                      │
  │ FIXTURE JUMPS! 127→205 instantáneo                                   │
  │ ⚠️ MECHANICAL STRESS + VISUAL JARRING                                │
  └─────────────────────────────────────────────────────────────────────┘
```

### The Missing Piece: **Crossfade on Override Release**

When manual override is cleared, there's no smooth transition back to Selene control.

---

## 4. 🏗️ PROPOSED ARCHITECTURE: THE NEW ORDER

### Control Hierarchy (Proposed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROPOSED: UNIFIED CONTROL CHAIN                           │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────┐
  │ INPUT LAYER                                                          │
  │                                                                      │
  │  Audio Capture ──┐                                                   │
  │                  ├──▶ TrinityBrain ──▶ MusicalContext                │
  │  MIDI Input ─────┘                                                   │
  │                                                                      │
  │  UI Commands ──────────────────────────▶ ControlIntents              │
  └─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ 🆕 MASTER ARBITER (New Component)                                    │
  │                                                                      │
  │  Decides WHO controls WHAT at any moment                             │
  │                                                                      │
  │  Per-Fixture Control Assignment:                                     │
  │  ┌─────────────────────────────────────────────────────────────────┐│
  │  │ Fixture #1: { color: 'selene', movement: 'manual', dimmer: 'UI' }││
  │  │ Fixture #2: { color: 'selene', movement: 'selene', dimmer: 'selene' }││
  │  │ Fixture #3: { color: 'BLACKOUT', movement: 'frozen', dimmer: 0 } ││
  │  └─────────────────────────────────────────────────────────────────┘│
  │                                                                      │
  │  Global Modes:                                                       │
  │  • SELENE: AI controls everything (default)                          │
  │  • CALIBRATE: Movement frozen, user adjusts offsets                  │
  │  • MANUAL: User controls everything                                  │
  │  • BLACKOUT: Emergency stop                                          │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ ACTIVE ENGINE (TitanEngine)                                          │
  │                                                                      │
  │  Receives: MusicalContext + ControlAssignments                       │
  │  Produces: LightingIntent (respects assignments)                     │
  │                                                                      │
  │  If fixture.movement === 'manual':                                   │
  │    → Skip movement calculation, use last known position              │
  │  If fixture.movement === 'selene':                                   │
  │    → Calculate normally                                              │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ 🆕 OVERRIDE LAYER (Enhanced)                                         │
  │                                                                      │
  │  Priority Stack (highest wins):                                      │
  │  1. BLACKOUT (dimmer = 0 for all)                                    │
  │  2. FLASH/STROBE (temporary full intensity)                          │
  │  3. MANUAL OVERRIDE (per-fixture, per-channel)                       │
  │  4. BASE INTENT (from TitanEngine)                                   │
  │                                                                      │
  │  🆕 Crossfade on Override Release:                                   │
  │  When override cleared → blend to Selene over 500ms                  │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ OUTPUT LIMITER                                                       │
  │                                                                      │
  │  • Max Pan/Tilt velocity (protect mechanics)                         │
  │  • Master dimmer cap                                                 │
  │  • DMX rate limiting (40Hz)                                          │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ DMX BUFFER → Hardware                                                │
  └─────────────────────────────────────────────────────────────────────┘
```

### Proposed Mode Simplification

```typescript
// BEFORE: Confusing mix
type GlobalMode = 'manual' | 'flow' | 'selene' | null  // Frontend
type BackendMode = 'auto' | 'manual'                    // Backend (mismatched!)

// AFTER: Unified
type SystemMode = 
  | 'selene'     // AI fully controls (was: flow + selene combined)
  | 'calibrate'  // Movement frozen, user adjusts offsets
  | 'manual'     // User controls everything
  | 'blackout'   // Emergency - all off

type ChannelControl = 'selene' | 'manual' | 'frozen' | 'blackout'

interface FixtureControlState {
  fixtureId: string
  color: ChannelControl
  movement: ChannelControl
  dimmer: ChannelControl
  // Calibration offsets (persist to ShowFile)
  panOffset: number   // -128 to +128
  tiltOffset: number  // -128 to +128
}
```

### Mode Change Strategy: HOT-SWAP with Crossfade

```typescript
// Proposed: MasterArbiter.setMode()
async setMode(newMode: SystemMode): Promise<void> {
  const previousMode = this.currentMode
  
  // 1. If leaving CALIBRATE → save offsets to ShowFile
  if (previousMode === 'calibrate') {
    await this.saveCalibrationOffsets()
  }
  
  // 2. Start crossfade (500ms for movement, 200ms for color)
  this.startCrossfade({
    duration: newMode === 'selene' ? 500 : 200,
    from: this.captureCurrentState(),
    to: newMode,
  })
  
  // 3. Update mode (affects next frame calculation)
  this.currentMode = newMode
  
  // 4. Notify UI
  this.emit('mode-changed', { previous: previousMode, current: newMode })
}
```

---

## 5. 📝 CALIBRATION WORKFLOW (Proposed)

### New User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CALIBRATION WORKFLOW - THE NEW WAY                                          │
└─────────────────────────────────────────────────────────────────────────────┘

  User: "Voy a calibrar los móviles"
       │
       │ Click "CALIBRATE" button in UI
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ MasterArbiter.setMode('calibrate')                                   │
  │                                                                      │
  │ • All fixtures: movement = 'frozen'                                  │
  │ • Selene keeps calculating (for preview)                             │
  │ • But movement output = LAST KNOWN + USER OFFSET                     │
  │ • Color can still react (or frozen if user wants)                    │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
       │
       │ User adjusts Pan/Tilt offset for each fixture
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ UI: Per-Fixture Offset Controls                                      │
  │                                                                      │
  │  ┌─────────────────────────────────────────────────────────────────┐│
  │  │ Moving Head #1 (Beam 2R)                                        ││
  │  │   Pan Offset:  [-30°]═══════●═══════════[+30°]  = +12°          ││
  │  │   Tilt Offset: [-30°]════●══════════════[+30°]  = -8°           ││
  │  │   [Reset] [Apply] [Test Pattern]                                 ││
  │  └─────────────────────────────────────────────────────────────────┘│
  │                                                                      │
  │  Offsets saved to: ShowFileV2.fixtures[n].calibration.panOffset     │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
       │
       │ User clicks "EXIT CALIBRATE" or "SELENE MODE"
       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ MasterArbiter.setMode('selene')                                      │
  │                                                                      │
  │ • Crossfade: Current position → Selene position (500ms)              │
  │ • Offsets REMAIN APPLIED (they're calibration, not override)         │
  │ • Selene output = calculated + offset                                │
  │                                                                      │
  │ SMOOTH TRANSITION - NO JUMP!                                         │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 🧹 LOGGING CLEANUP STRATEGY

### Current State: Noise Overload

```
[Main] ===============================================
[Main]   BOOTING TITAN 2.0 - WAVE 254: THE SPARK
[Main]   WAVE 365: SYSTEM INTEGRATION
[TitanOrchestrator] Created (WAVE 243.5)
[Brain] 🧠 TrinityBrain initialized (WAVE 227 - REAL RECEPTOR + WAVE 260 MEMORY)
[ALPHA] Worker paths: { beta: '...', gamma: '...' }
[ALPHA] 🛡️ Trinity Orchestrator initialized
[ALPHA] 🚀 Starting Trinity...
[FFT] 🧮 Initialized: 2048 bins, 44100Hz sample rate
[BETA] 👂 Senses initialized
[GAMMA] 🧠 WAVE 230.5: Pure Musical Analyst ready
[Titan] 🫁 Heartbeat #150: Audio flowing? true | Last Packet: 23ms ago
[Titan] 🌉 SYNAPTIC BRIDGE: Key=Am Minor | Genre=latin/cumbia | BPM=95
[HAL] Phase offset applied...
[📡 BROADCAST] fix_0 | pan=0.456 tilt=0.234 | physPan=0.458
... (infinite loop of debug spam)
```

### Proposed: Structured Logging Levels

```typescript
// src/core/logging/Logger.ts (New File)

export enum LogLevel {
  ERROR = 0,   // Always shown
  WARN = 1,    // Warnings
  INFO = 2,    // Important events (mode change, fixtures loaded)
  DEBUG = 3,   // Development details
  TRACE = 4,   // Frame-by-frame spam (off by default)
}

export interface LogConfig {
  level: LogLevel
  modules: {
    [key: string]: LogLevel  // Per-module override
  }
}

class Logger {
  private config: LogConfig = {
    level: LogLevel.INFO,
    modules: {
      'HAL': LogLevel.WARN,      // Silence physics spam
      'ALPHA': LogLevel.INFO,    // Only important worker events
      'Titan': LogLevel.INFO,    // No heartbeat spam in production
    }
  }
  
  info(module: string, message: string, data?: object): void {
    if (this.shouldLog(module, LogLevel.INFO)) {
      console.log(`[${module}] ${message}`, data || '')
    }
  }
  
  // ... debug, warn, error, trace
}

export const logger = new Logger()
```

### Migration Path

```typescript
// BEFORE
console.log('[TitanOrchestrator] Frame ' + this.frameCount + ': Vibe=' + currentVibe)

// AFTER
logger.trace('Titan', `Frame ${this.frameCount}`, { vibe: currentVibe })

// BEFORE
console.log('[Main] ===============================================')
console.log('[Main]   BOOTING TITAN 2.0 - WAVE 254: THE SPARK')

// AFTER
logger.info('Main', '🚀 TITAN 2.0 BOOTING', { version: '2.0', wave: 371 })
```

---

## 7. 💡 VERDICT: Is Flow Mode Worth Keeping?

### Analysis

| Factor | Flow | Selene | Manual |
|--------|------|--------|--------|
| Code Path | Same as Selene | TitanEngine | Override Layer |
| User Perception | "Simpler reactive" | "Full AI" | "Direct control" |
| Technical Difference | None (useBrain=true) | None (useBrain=true) | useBrain=false |
| UX Value | Placebo | Real | Real |

### Recommendation: **KILL FLOW MODE**

**Reasons:**
1. Flow and Selene execute **identical code paths**
2. The distinction is **marketing**, not technical
3. It creates UI confusion ("which one do I pick?")
4. Three-way toggle → Two-way toggle is simpler

### Proposed New Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIMPLIFIED MODE SELECTOR                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │                 │    │                 │    │                 │
  │    🧠 SELENE    │    │  🎛️ CALIBRATE   │    │  🔒 MANUAL      │
  │                 │    │                 │    │                 │
  │  AI Reactive    │    │  Adjust Offsets │    │  Full Control   │
  │  Music → Light  │    │  Test Patterns  │    │  No AI          │
  │                 │    │                 │    │                 │
  └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
    Brain: ON             Brain: ON (preview)     Brain: OFF
    Movement: AI          Movement: FROZEN        Movement: USER
    Color: AI             Color: AI or FROZEN     Color: USER
```

---

## 8. 📋 ACTION ITEMS FOR IMPLEMENTATION

### Phase 1: Foundation (WAVE 372)
- [ ] Create `MasterArbiter` class
- [ ] Unify mode types (kill the mismatch)
- [ ] Add crossfade on override release

### Phase 2: Calibration (WAVE 373)
- [ ] Add `calibration` field to ShowFileV2 fixtures
- [ ] Create Calibrate mode UI
- [ ] Implement offset application in HAL

### Phase 3: Logging Cleanup (WAVE 374)
- [ ] Create Logger utility
- [ ] Migrate all `console.log` calls
- [ ] Add log level configuration in preferences

### Phase 4: Mode Simplification (WAVE 375)
- [ ] Kill "Flow" mode from UI
- [ ] Rename modes: Selene | Calibrate | Manual
- [ ] Update all stores and IPC

---

## 📊 ARCHITECTURE COMPARISON

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BEFORE vs AFTER                                      │
└─────────────────────────────────────────────────────────────────────────────┘

  BEFORE (Current):                      AFTER (Proposed):
  
  ┌──────────┐                           ┌──────────┐
  │ UI Modes │ flow/selene/locked        │ UI Modes │ selene/calibrate/manual
  └────┬─────┘                           └────┬─────┘
       │ ← Type mismatch                      │ ← Clean 1:1 mapping
       ▼                                      ▼
  ┌──────────┐                           ┌─────────────────┐
  │ Backend  │ auto/manual               │ MasterArbiter   │
  └────┬─────┘                           └────────┬────────┘
       │ ← Silent override               │        │ ← Per-fixture control
       ▼                                 │        ▼
  ┌──────────┐                           │   ┌──────────┐
  │ HAL      │ manualOverrides           │   │ Engine   │ Respects assignments
  └────┬─────┘                           │   └────┬─────┘
       │ ← No crossfade                  │        │
       ▼                                 │        ▼
  ┌──────────┐                           │   ┌────────────────┐
  │ DMX Out  │                           │   │ Override Layer │ + Crossfade
  └──────────┘                           │   └────────┬───────┘
                                         │            │
                                         │            ▼
                                         │       ┌──────────┐
                                         │       │ DMX Out  │
                                         │       └──────────┘
                                         │
                                         └── Calibration offsets persist
                                             in ShowFileV2
```

---

**WAVE 371 Status:** ✅ AUDIT COMPLETE

*"Conocer el problema es el primer paso. Ahora a demoler y reconstruir."* 🔧
