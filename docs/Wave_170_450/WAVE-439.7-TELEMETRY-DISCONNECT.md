# WAVE 439.7: TELEMETRY DISCONNECT

**STATUS**: 🔴 CRITICAL BUG FOUND  
**WAVE**: Pipeline Surgery Follow-up  
**DATE**: 2026-01-15

---

## 🎯 THE PROBLEM

**Position controls work, but Color/Intensity/Beam don't affect the 3D Simulator.**

User confirms GrandMaster slider DOES work (affects dimmer globally).

---

## 🔬 FORENSIC ANALYSIS

### ✅ WHAT WORKS

1. **Frontend → Backend**
   - TheProgrammer controls send correct data ✅
   - Preload bridge sends complete arrays ✅
   - Backend receives and validates parameters ✅

2. **Backend Storage**
   - MasterArbiter stores manual overrides in `layer2_manualOverrides` Map ✅
   - Values stored with correct keys (red/green/blue) ✅

3. **Backend Arbitration**
   - `mergeChannelForFixture()` extracts manual values ✅
   - `getManualChannelValue()` looks for correct keys ✅
   - Final `FixtureLightingTarget` built with merged values ✅

4. **Backend Output**
   - HAL receives `FinalLightingTarget` from Arbiter ✅
   - HAL extracts color values: `fixtureTarget.color.r/g/b` ✅
   - HAL sends to DMX driver ✅

5. **GrandMaster Path**
   - UI slider → `window.lux.arbiter.setGrandMaster(value)` ✅
   - Backend stores in `this.grandMaster` ✅
   - Applied in frame merge: `dimmer * this.grandMaster` ✅
   - **WORKS IN SIMULATOR** ✅

### 🔴 WHAT'S BROKEN

**The 3D Simulator Canvas does NOT receive manual override values.**

---

## 📊 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: TheProgrammer Controls                           │
│  ✅ Sends: { fixtureIds, controls: {red, green, blue} }    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  PRELOAD BRIDGE                                              │
│  ✅ IPC: 'arbiter:setManual' with complete fixtureIds array │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND: ArbiterIPCHandlers                                 │
│  ✅ Validates params, loops fixtures, calls setManualOverride│
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  MASTER ARBITER                                              │
│  ✅ Stores in layer2_manualOverrides Map                    │
│  ✅ Merges layers in arbitrate()                            │
│  ✅ Outputs FinalLightingTarget                             │
└─────────┬───────────────────────────────┬───────────────────┘
          │                               │
          ▼                               ▼
┌──────────────────────┐     ┌──────────────────────────────┐
│  HAL                 │     │  TelemetryCollector          │
│  ✅ Renders frames  │     │  🔴 GENERATES FAKE VALUES   │
│  ✅ Sends to driver │     │  ❌ Does NOT read HAL       │
└──────────────────────┘     └──────┬───────────────────────┘
                                    │
                                    ▼
                        ┌────────────────────────────┐
                        │  IPC: onTelemetryUpdate    │
                        │  🔴 SENDS FAKE FIXTURE DATA│
                        └──────┬─────────────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │  FRONTEND: DMXStore      │
                    │  Receives fake values    │
                    └──────┬───────────────────┘
                           │
                           ▼
                ┌──────────────────────────────┐
                │  useFixtureRender hook       │
                │  Reads from DMXStore         │
                └──────┬───────────────────────┘
                       │
                       ▼
            ┌──────────────────────────────┐
            │  Stage3DCanvas (Simulator)   │
            │  🔴 SHOWS FAKE COLORS       │
            └──────────────────────────────┘
```

---

## 🔥 ROOT CAUSE

**File**: `electron-app/src/engine/musical/telemetry/SeleneTelemetryCollector.ts`  
**Line**: 959-996  
**Method**: `generateFixtureValues()`

### THE SMOKING GUN

```typescript
private generateFixtureValues(
  lastColors: { primary: { r: number; g: number; b: number }; ... },
  energy: number
): FixtureValuesData[] {
  const values: FixtureValuesData[] = [];
  
  // 🎨 Uses color PALETTE (not actual fixture states)
  const colorPalette = [
    lastColors.primary || { r: 255, g: 255, b: 255 },
    lastColors.secondary || { r: 0, g: 0, b: 0 },
    // ...
  ];
  
  // 📡 Generates FAKE fixtures
  for (let i = 0; i < fixtureCount; i++) {
    const colorIndex = i % colorPalette.length;
    const color = colorPalette[colorIndex];
    
    values.push({
      dmxAddress,
      dimmer: Math.max(0, Math.min(255, dimmerValue)),
      r: Math.max(0, Math.min(255, Math.round(color.r))),  // ❌ From palette
      g: Math.max(0, Math.min(255, Math.round(color.g))),  // ❌ From palette
      b: Math.max(0, Math.min(255, Math.round(color.b))),  // ❌ From palette
      pan: 128 + Math.sin(Date.now() / 1000 + i) * 20,      // ❌ FAKE MOVEMENT
      tilt: 128 + Math.cos(Date.now() / 1000 + i) * 20,     // ❌ FAKE MOVEMENT
    });
  }
  
  return values;
}
```

**PROBLEM**: This method generates SIMULATED values based on color palettes and trigonometric functions. It does NOT read the REAL fixture states from HAL.

**RESULT**: When you move the Color slider, the backend correctly stores and merges the value, HAL renders it correctly, but the TelemetryCollector sends FAKE values to the frontend, so the 3D Simulator never sees your changes.

---

## 🛠️ THE FIX

### STRATEGY

Replace fake `generateFixtureValues()` with REAL data from HAL.

### IMPLEMENTATION

1. **HAL already has the real data**: `HardwareAbstraction.lastFixtureStates`
   - This is updated every frame after `renderFromTarget()`
   - Contains the ACTUAL arbitrated values from MasterArbiter

2. **TelemetryCollector needs access to HAL**
   - Currently: TelemetryCollector is isolated, generates fake data
   - Solution: Pass `hal.lastFixtureStates` to `collect()` method

3. **Convert FixtureState[] → FixtureValuesData[]**
   - HAL uses `FixtureState` interface (r, g, b, pan, tilt, dimmer)
   - Frontend expects `FixtureValuesData` (dmxAddress, r, g, b, pan, tilt, dimmer)
   - Simple mapping, no computation needed

---

## 📝 EXECUTION PLAN

### STEP 1: Modify TelemetryCollector.collect()

**File**: `SeleneTelemetryCollector.ts`  
**Change**: Add `fixtureStates` parameter

```typescript
public collect(
  audio: AudioAnalysis,
  brainOutput: BrainOutput | null,
  inputGain: number,
  fixtureStates: FixtureState[] // ← ADD THIS
): SeleneTelemetryPacket | null
```

### STEP 2: Replace generateFixtureValues()

```typescript
// OLD (FAKE):
const fixtureValuesData = lastColors 
  ? this.generateFixtureValues(lastColors, audio.energy.current) 
  : undefined;

// NEW (REAL):
const fixtureValuesData = fixtureStates.length > 0
  ? this.convertFixtureStates(fixtureStates)
  : undefined;
```

### STEP 3: Add convertFixtureStates()

```typescript
private convertFixtureStates(states: FixtureState[]): FixtureValuesData[] {
  return states.map(state => ({
    dmxAddress: state.dmxAddress,
    dimmer: state.dimmer,
    r: state.r,
    g: state.g,
    b: state.b,
    pan: state.pan,
    tilt: state.tilt,
    // Optional: add zoom, focus if needed
  }));
}
```

### STEP 4: Update caller (TitanOrchestrator or wherever collect() is called)

Pass `hal.lastFixtureStates` to the collect method.

---

## 🎯 WHY THIS FIXES THE ISSUE

1. **Position works** because GrandMaster bypass path still updates something that reaches canvas
2. **Color/Intensity don't work** because they go through the FAKE generator
3. **After fix**: All values come from HAL → Real arbitrated data → Simulator shows reality

---

## 🔍 VALIDATION

After implementing the fix, test:

1. ✅ Move Color slider → Should see fixture color change in simulator
2. ✅ Move Intensity slider → Should see dimmer change in simulator
3. ✅ Move Position XY → Should still work (no regression)
4. ✅ Move GrandMaster → Should still work (no regression)
5. ✅ Release All → Fixtures should return to AI control smoothly

---

## 📊 DEBUG LOGGING

We added extensive logging in WAVE 439.6:

- `[MasterArbiter] setManualOverride:` - Shows values being stored
- `[MasterArbiter] Manual value extracted:` - Shows values during merge
- `[MasterArbiter] Final merged value (MANUAL):` - Shows final arbitrated values
- `[HAL] Rendering fixture with values:` - Shows values sent to driver

After the fix, we should see the SAME values in the frontend.

---

## ⚡ NEXT STEPS

1. Locate where `telemetryCollector.collect()` is called
2. Implement the 4-step fix above
3. Test in simulator
4. Remove debug logging once confirmed working
5. Close WAVE 439 series

---

**WAVE 439.7 STATUS**: Ready to execute  
**ESTIMATED TIME**: 15 minutes  
**RISK**: Low (isolated change, clear data flow)

