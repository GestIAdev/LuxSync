# WAVE 7112 — BPM CONTROL FORENSICS

**Date:** 2026-06-30  
**Severity:** HIGH — Demo-critical for production showcase  
**Component:** Chronos Transport Bar + BPM Pipeline  
**Symptom:** User cannot override incorrect auto-detected BPM (150BPM) via manual controls, causing erratic light show

---

## 🎯 PROBLEM STATEMENT

User reports:
- Song auto-detected as 150BPM (incorrect for the track)
- Light show plays "schizophrenic" due to wrong BPM
- Transport bar has BPM controls (+/- buttons, number input)
- **Question:** Are these controls connected and functional?

**Answer:** Controls are partially connected but **do not override the auto-detected BPM**. The manual BPM input is immediately overwritten by analysis results, and the ChronosEngine does not use the manual override.

---

## 🔍 CURRENT ARCHITECTURE

### 1. BPM State Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ ChronosLayout.tsx (UI State)                                         │
├─────────────────────────────────────────────────────────────────────┤
│ const [bpm, setBpm] = useState(120)  ← Local UI state only         │
│                                                                     │
│ useEffect(() => {                                                   │
│   if (audioLoader.result?.analysisData?.beatGrid?.bpm) {           │
│     setBpm(Math.round(audioLoader.result.analysisData.beatGrid.bpm))│
│   }                                                                 │
│ }, [audioLoader.result])  ← AUTO-OVERWRITES manual input! ❌       │
│                                                                     │
│ useEffect(() => {                                                   │
│   useAudioStore.getState().updateMetrics({ bpm })  ← Syncs to global│
│ }, [bpm, audioLoader.result])                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ TransportBar.tsx (UI Controls)                                      │
├─────────────────────────────────────────────────────────────────────┤
│ <input value={bpm} onChange={handleBpmInput} />  ← Calls setBpm()   │
│ <button onClick={handleBpmDecrease} />  ← Calls setBpm(bpm-1)      │
│ <button onClick={handleBpmIncrease} />  ← Calls setBpm(bpm+1)      │
│                                                                     │
│ ✅ Controls ARE connected to setBpm()                               │
│ ❌ But setBpm() is immediately overwritten by analysis useEffect    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. ChronosEngine BPM Usage

**File:** `src/chronos/core/ChronosEngine.ts:1016`

```typescript
// 📡 WAVE 2501: Tick MIDI Clock Master (outbound) if running
const bpm = this.projectV2?.runtimeBpm ?? this.projectV2?.audio?.detectedBpm ?? 120
this.clockSources.tickMIDIMaster(bpm)
```

**Problem:** ChronosEngine does **not** use the UI BPM state (`ChronosLayout.bpm`). It uses:
1. `projectV2.runtimeBpm` (ephemeral runtime field)
2. Falls back to `projectV2.audio.detectedBpm` (FFT detection)
3. Falls back to `120` (hardcoded default)

**Missing:** `manualBpmOverride` field exists in V3 schema but is **never used** in the pipeline.

### 3. V3 Schema BPM Intent

**File:** `src/chronos/core/LuxFileV3.ts:22-25`

```typescript
/**
 * BPM STRATEGY (FFT detect + manual override):
 *   - analysis.detectedBpm → base BPM detected by the GodEar FFT worker.
 *   - runtime uses the live rBPM from the Worker; falls back to detectedBpm.
 *   - manualBpmOverride (runtime only) wins when present.
 */
```

**File:** `src/chronos/core/LuxFileV3.ts:445-449`

```typescript
/** Current runtime BPM (live rBPM from Worker, or fallback). */
runtimeBpm: number

/** Manual BPM override from the operator (null = no override). */
manualBpmOverride: number | null
```

**Intent:** `manualBpmOverride` should win when present. **Reality:** This field is never set or used.

---

## 🐛 ROOT CAUSE ANALYSIS

### Bug #1: Auto-Overwrite of Manual Input

**Location:** `ChronosLayout.tsx:208-212`

```typescript
// Update BPM from analysis if available
useEffect(() => {
  if (audioLoader.result?.analysisData?.beatGrid?.bpm) {
    setBpm(Math.round(audioLoader.result.analysisData.beatGrid.bpm))
  }
}, [audioLoader.result])
```

**Problem:** This effect runs whenever `audioLoader.result` changes, which happens on every audio load/analysis. It **unconditionally overwrites** the manual BPM input with the detected BPM.

**Impact:** User cannot manually correct BPM — it gets immediately overwritten.

### Bug #2: ChronosEngine Ignores UI BPM

**Location:** `ChronosEngine.ts:1016`

```typescript
const bpm = this.projectV2?.runtimeBpm ?? this.projectV2?.audio?.detectedBpm ?? 120
```

**Problem:** ChronosEngine does not read from:
- `ChronosLayout.bpm` (UI state)
- `audioStore.bpm` (global state synced from UI)
- `manualBpmOverride` (V3 schema field)

**Impact:** Even if the user changes BPM in the UI, the engine continues using the detected BPM.

### Bug #3: manualBpmOverride Never Used

**Location:** V3 schema defines it, but no code path sets or reads it.

**Problem:** The V3 schema has a field for manual override, but:
- No UI control sets `project.manualBpmOverride`
- No engine logic checks `project.manualBpmOverride`
- The field is always `null`

**Impact:** The intended override mechanism is completely non-functional.

---

## 🎯 REQUIRED FIXES

### Fix #1: Add Manual Override Flag

Add a flag to track whether the user has manually overridden the BPM:

```typescript
const [bpm, setBpm] = useState(120)
const [bpmOverride, setBpmOverride] = useState(false)  // NEW
```

### Fix #2: Prevent Auto-Overwrite When Manual Override Active

Modify the analysis useEffect to respect the manual override:

```typescript
useEffect(() => {
  if (audioLoader.result?.analysisData?.beatGrid?.bpm && !bpmOverride) {
    setBpm(Math.round(audioLoader.result.analysisData.beatGrid.bpm))
  }
}, [audioLoader.result, bpmOverride])  // Add bpmOverride dependency
```

### Fix #3: Set Override Flag on Manual Input

When user manually changes BPM, set the override flag:

```typescript
const handleBpmChange = useCallback((newBpm: number) => {
  setBpm(newBpm)
  setBpmOverride(true)  // NEW: Mark as manually overridden
}, [])
```

### Fix #4: Sync manualBpmOverride to ChronosProjectV3

When saving/loading, persist the manual override:

```typescript
// In updateFromSession or save:
if (bpmOverride) {
  this.project.manualBpmOverride = bpm
} else {
  this.project.manualBpmOverride = null
}
```

### Fix #5: ChronosEngine Respect manualBpmOverride

Modify ChronosEngine to check the override:

```typescript
const bpm = 
  this.projectV2?.manualBpmOverride ??  // Manual override wins
  this.projectV2?.runtimeBpm ?? 
  this.projectV2?.audio?.detectedBpm ?? 
  120
```

### Fix #6: Add UI Indicator for Override

Add a visual indicator in TransportBar when BPM is manually overridden:

```typescript
<div className="ct-bpm-display">
  {bpmOverride && <span className="ct-bpm-override-badge">MANUAL</span>}
  <input value={bpm} onChange={handleBpmInput} />
</div>
```

---

## 📊 PROPOSED ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│ ChronosLayout (UI State)                                            │
├─────────────────────────────────────────────────────────────────────┤
│ bpm: number (current display value)                                 │
│ bpmOverride: boolean (user manually set?)                          │
│                                                                     │
│ TransportBar Controls:                                             │
│   - onBpmChange(bpm) → setBpm(bpm) + setBpmOverride(true)        │
│   - onResetBpm() → setBpm(detected) + setBpmOverride(false)       │
│                                                                     │
│ Analysis Effect:                                                    │
│   - if (!bpmOverride) → setBpm(detected)                          │
│   - if (bpmOverride) → skip (respect manual)                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ChronosStore (V1 + V2)                                              │
├─────────────────────────────────────────────────────────────────────┤
│ project.manualBpmOverride = bpmOverride ? bpm : null              │
│                                                                     │
│ updateFromSession():                                                 │
│   - Read bpm + bpmOverride from UI                                  │
│   - Set project.manualBpmOverride accordingly                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ChronosEngine (Runtime)                                             │
├─────────────────────────────────────────────────────────────────────┤
│ effectiveBpm =                                                     │
│   project.manualBpmOverride ??  // Manual override (highest priority)│
│   project.runtimeBpm ??              // Live rBPM from Worker        │
│   project.audio.detectedBpm ??       // FFT detection               │
│   120                                 // Hardcoded fallback          │
│                                                                     │
│ clockSources.tickMIDIMaster(effectiveBpm)                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: UI State (ChronosLayout.tsx)
1. Add `bpmOverride` state
2. Modify `handleBpmChange` to set override flag
3. Add "Reset to Detected" button in TransportBar
4. Modify analysis useEffect to respect override flag
5. Add visual indicator for manual override

### Phase 2: Store Integration (ChronosStore.ts)
1. Add `manualBpmOverride` to `updateFromSession` signature
2. Sync `manualBpmOverride` from UI state to project
3. Ensure `toLuxFileV3` strips `manualBpmOverride` (ephemeral only)
4. Ensure `toChronosProjectV3` initializes `manualBpmOverride` to null

### Phase 3: Engine Integration (ChronosEngine.ts)
1. Modify BPM resolution to check `manualBpmOverride` first
2. Log when using manual override vs detected
3. Ensure MIDI clock master uses effective BPM

### Phase 4: Session Persistence (sessionStore.ts)
1. Persist `bpmOverride` flag in session
2. Restore override state on session load

---

## 🧪 TESTING CHECKLIST

- [ ] User can manually set BPM via input field
- [ ] User can increment/decrement BPM via +/- buttons
- [ ] Manual BPM is NOT overwritten by analysis after first manual change
- [ ] "Reset to Detected" button restores auto-detected BPM
- [ ] Visual indicator shows when BPM is manually overridden
- [ ] ChronosEngine uses manual BPM when override is active
- [ ] MIDI clock master uses effective BPM (manual or detected)
- [ ] Session persistence saves/restore override state
- [ ] New project starts with no override (uses detected BPM)
- [ ] Loading project with saved override respects it

---

## 📝 NOTES

- **Confidence Threshold:** The V3 schema has `bpmConfidence` field but it's not used. We could add a threshold (e.g., if confidence < 0.7, prompt user to set manual BPM).
- **Live rBPM:** The Worker provides live rBPM that can drift from detected BPM. Manual override should lock to a fixed value, ignoring rBPM.
- **MIDI Clock:** If external MIDI clock is driving, it should override everything (highest priority). Current code checks `externalTimeMs` but not external BPM.

---

## 🔗 RELATED FILES

- `src/chronos/ui/ChronosLayout.tsx` — UI state, BPM hooks
- `src/chronos/ui/transport/TransportBar.tsx` — BPM controls
- `src/chronos/core/ChronosStore.ts` — Project state, save/load
- `src/chronos/core/ChronosEngine.ts` — Runtime BPM usage
- `src/chronos/core/LuxFileV3.ts` — Schema definition
- `src/chronos/core/LuxFileV3.factories.ts` — Runtime hydration
