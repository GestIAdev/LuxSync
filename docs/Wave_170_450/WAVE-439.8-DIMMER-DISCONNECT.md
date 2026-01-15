# WAVE 439.8: THE DIMMER DISCONNECT

**STATUS**: 🟡 ROOT CAUSE IDENTIFIED - AWAITING ARCHITECTURE DECISION  
**WAVE**: Control Pipeline Investigation  
**DATE**: 2026-01-15  
**SEVERITY**: HIGH - Feature blocking (color/intensity controls not visible)

---

## 🎯 EXECUTIVE SUMMARY

**El problema NO es el pipeline de control. El pipeline funciona perfectamente.**

El problema es **arquitectónico**: Cuando el usuario mueve el slider de Color en TheProgrammer, el backend recibe correctamente el override con valores RGB válidos (ej: `r=102, g=255, b=214`), **PERO** el dimmer sigue en 0 porque el Programmer nunca envía dimmer, y el TITAN_AI (Selene) está en silencio.

**Resultado**: Fixture con color correcto pero dimmer=0 → Invisible en simulator.

---

## 🔬 TECHNICAL INVESTIGATION

### WHAT WE FOUND

#### ✅ CONTROL PIPELINE (Verified Working)

```
Frontend TheProgrammer
  ↓ sends: {fixtureIds, controls: {red: 102, green: 255, blue: 214}, channels: ['red','green','blue']}
  ↓
Preload Bridge
  ↓ IPC invoke: 'arbiter:setManual'
  ↓
Backend ArbiterIPCHandlers
  ↓ loops fixtures, calls setManualOverride()
  ↓
MasterArbiter.layer2_manualOverrides Map
  ✅ STORES: {fixtureId: 'fixture-1768367329532', controls: {red: 102, green: 255, blue: 214}, ...}
  ✅ CONFIRMED: Exact values received and stored
  ↓
MasterArbiter.arbitrate()
  ✅ CONFIRMED: mergeChannelForFixture() calls getManualChannelValue()
  ✅ CONFIRMED: Manual values extracted from controls Map
  ↓
FinalLightingTarget.fixtures[0].color
  ✅ CONFIRMED: {r: 102, g: 255, b: 214} in output
  ↓
HAL.renderFromTarget()
  ✅ CONFIRMED: Values passed to FixtureState
  ↓
TitanOrchestrator.truth.hardware.fixtures[0].color
  ✅ CONFIRMED: {r: 102, g: 255, b: 214} in broadcast
  ↓
Frontend TruthStore
  ✅ CONFIRMED: Receives truth with correct color values
  ↓
useFixtureRender hook
  ✅ CONFIRMED: Reads truth.hardware.fixtures[0].color
  ↓
Stage3DCanvas
  ✅ CONFIRMED: Renders with correct RGB
  
BUT: dimmer = 0 → INVISIBLE
```

#### 🔴 THE DIMMER PROBLEM

**Actual log output from MasterArbiter**:

```
[MasterArbiter] Fixture target with MANUAL override: {
  fixture: 'fixture-1768367329532',
  channels: [ 'red', 'green', 'blue' ],
  dimmer: 0,  ← ⚠️ ZERO!
  color: { r: 102, g: 255, b: 214 },  ← ✅ CORRECT
  controlSources: { 
    dimmer: 0,  ← Source is TITAN_AI (layer 0)
    red: 0,     ← Source would be MANUAL (layer 2) if there was RGB
    green: 0,   ← Source would be MANUAL (layer 2) if there was RGB
    blue: 0     ← Source would be MANUAL (layer 2) if there was RGB
  }
}
```

**Why dimmer=0?**

1. TheProgrammer only sends: `{red, green, blue}` - **NO DIMMER**
2. MasterArbiter merges all layers for each channel
3. For `dimmer` channel:
   - Layer 0 (TITAN_AI): dimmer=0 (silence, no audio)
   - Layer 1 (Consciousness): null (not used)
   - Layer 2 (Manual): **NOT OVERRIDDEN** (Programmer didn't include it)
   - Layer 3 (Effects): null (no effects)
   - Layer 4 (Blackout): false (not active)
4. Result: `mergeChannel('dimmer', [Layer0=0])` → **0** wins

---

## 📊 CONTROL SOURCES BREAKDOWN

When you override ONLY color (not dimmer):

```
┌─────────────────────────────────────────────────────┐
│ Layer Merge Strategy per Channel Type               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ COLOR (r/g/b):                                      │
│   LTP (Latest Takes Precedence)                     │
│   Layers: [0:AI, 1:none, 2:MANUAL✓, 3:FX, 4:BO]   │
│   Winner: Layer 2 (MANUAL) = {r:102, g:255, b:214} │
│                                                     │
│ DIMMER (intensity):                                 │
│   HTP (Highest Takes Precedence)                    │
│   Layers: [0:AI, 1:none, 2:none✗, 3:none, 4:none] │
│   Winner: Layer 0 (AI) = 0                          │
│                                                     │
│ Result: Color from Manual, Dimmer from Silence     │
│ Visual: INVISIBLE (0% brightness)                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🧠 ARCHITECTURAL CONTEXT

### How Dimmer Should Be Handled

**Current Behavior**:
```
Programmer.handleColorChange()
  → sends only: {red, green, blue}
  → Dimmer NOT overridden
  → Defaults to TITAN_AI layer (0)
  → If TITAN silent → dimmer=0
  → Result: INVISIBLE
```

**Expected Behavior** (two possible interpretations):

**Option A: Auto-Dimmer (Smart Default)**
```
Programmer.handleColorChange()
  → sends: {red, green, blue} only
  → Backend AUTO-DETECTS: color override without dimmer
  → Backend IMPLIES: "if overriding color, also light it"
  → Backend FORCES: dimmer = 255 when color is override AND current dimmer = 0
  → Result: Color visible with maximum intensity
  
Pros:
  - Simple UX (user just picks color)
  - Intuitive (color implies visibility)
  
Cons:
  - Implicit behavior (less transparent)
  - Forces dimmer without user explicit control
  - Can't dim while keeping color override
```

**Option B: Explicit Dimmer Control (Correct Architecture)**
```
Programmer adds Intensity slider
  → User controls both color AND dimmer explicitly
  → sends: {red, green, blue, dimmer}
  → Backend stores both overrides
  → Result: User has full control
  
Pros:
  - Explicit (user clearly sees what they control)
  - Flexible (can set color without forcing brightness)
  - Consistent (all controls work the same way)
  
Cons:
  - More UI elements
  - User must understand dimmer/color relationship
  - Requires UI implementation time
```

---

## 📋 DECISION MATRIX

| Aspect | Option A (Auto-Dimmer) | Option B (Explicit Control) |
|--------|------------------------|---------------------------|
| **Implementation** | 5 minutes | 30 minutes |
| **User Experience** | Simple, magical | Complex, powerful |
| **Transparency** | Low (implicit) | High (explicit) |
| **Flexibility** | Low (forces brightness) | High (user controls all) |
| **Consistency** | Low (color is special) | High (all controls equal) |
| **Aligns with Philosophy** | NO (we avoid heuristics) | **YES (Perfection First)** |
| **Testability** | Hard (heuristic logic) | Easy (1:1 mapping) |

---

## 🔨 IMPLEMENTATION DETAILS

### Option A: Backend Auto-Dimmer (5 min)

**File**: `ArbiterIPCHandlers.ts` line 141-167

```typescript
// In setManual handler, when receiving override:
const override = {
  fixtureId,
  controls: controls,  // {red, green, blue}
  overrideChannels: channels,  // ['red', 'green', 'blue']
}

// AUTO-DIMMER LOGIC:
if (channels.includes('red') || channels.includes('green') || channels.includes('blue')) {
  // User is overriding color but not dimmer
  if (!channels.includes('dimmer')) {
    // Check if current dimmer from TITAN is 0
    const currentDimmer = masterArbiter.getManualChannelValue(fixture.id, 'dimmer')
    if (currentDimmer === 0) {
      // Force dimmer to 255
      override.controls.dimmer = 255
      override.overrideChannels = [...channels, 'dimmer']
    }
  }
}
```

**Pros**: Quick, works immediately  
**Cons**: Violates "Perfection First" - adds heuristic logic

---

### Option B: Explicit Intensity Control (30 min)

**File**: `TheProgrammerContent.tsx`

Add:
1. State for `currentDimmer: number`
2. Intensity slider UI component
3. `handleDimmerChange()` method
4. Modify `handleColorChange()` to include dimmer:

```typescript
const handleColorChange = useCallback(async (r: number, g: number, b: number) => {
  if (selectedIds.length === 0) return
  
  setCurrentColor({ r, g, b })
  setOverrideState(prev => ({ ...prev, color: true }))
  
  try {
    await window.lux?.arbiter?.setManual({
      fixtureIds: selectedIds,
      controls: { 
        red: r, 
        green: g, 
        blue: b,
        dimmer: currentDimmer  // ← ADD THIS
      },
      channels: ['red', 'green', 'blue', 'dimmer'],  // ← ADD 'dimmer'
    })
  } catch (err) {
    console.error('[Programmer] Color error:', err)
  }
}, [selectedIds, currentDimmer])  // ← ADD currentDimmer dependency
```

**Pros**: Clean, explicit, aligns with architecture  
**Cons**: Takes longer, requires UI changes

---

## 📖 WAVE HISTORY

- **WAVE 439**: Nervous System Audit - Found color key mismatches ✅
- **WAVE 439.5**: Pipeline Surgery - Fixed 8 critical issues ✅
- **WAVE 439.6**: Preload Bridge Fix - Array handling corrected ✅
- **WAVE 439.7**: Telemetry Investigation - Was false alarm, pipeline healthy ✅
- **WAVE 439.8**: Dimmer Disconnect - **Current, awaiting decision**

---

## 🎬 NEXT STEPS

### For Architect Review

1. **Decision Required**: Option A vs Option B?
   - A = Quick pragmatic fix (heuristic)
   - B = Correct architectural fix (explicit)

2. **If Option A**: 5 minute implementation in ArbiterIPCHandlers.ts
3. **If Option B**: 30 minute implementation adding Intensity slider to Programmer

### Current State

- ✅ All controls reach backend correctly
- ✅ All overrides stored and merged correctly
- ✅ All values output to frontend correctly
- ✅ Frontend renders values correctly
- 🔴 Dimmer missing when only color is sent
- 🔴 User expects color override to be visible

### Test Case

**Reproducible**:
1. Start app with no audio (silent mode)
2. Select fixture in Programmer
3. Move Color slider
4. **Expected** (Option A): Fixture lights up with new color
5. **Expected** (Option B): Move Intensity slider + Color slider, fixture lights with both

---

## 🏛️ ARCHITECTURAL NOTES

### The Programmer's Role

Currently, TheProgrammer is a **PARTIAL CONTROL INTERFACE**:
- Color: ✅ Yes
- Position: ✅ Yes  
- Beam (Zoom/Focus): ✅ Yes (if implemented)
- Intensity/Dimmer: ❌ **MISSING**

This is the gap. The control panel is incomplete.

### The Philosophical Question

**"What does it mean to set color without setting brightness?"**

- **Pragmatic Answer (A)**: "It means light it up" (force dimmer=255)
- **Architectural Answer (B)**: "It means override ONLY color, let dimmer come from elsewhere"

Per your **Axiom Perfection First**: We should go with **B**.

> "Siempre la solución Arquitectónica correcta, aunque tome más tiempo y esfuerzo."

---

**AWAITING DECISION FROM ARCHITECT** 🏛️

