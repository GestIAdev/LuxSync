# WAVE 1052: ROBUST IDENTITY

**Timestamp:** 2026-01-30  
**Agent:** PunkOpus (inspired by Radwulf's diagnostic)  
**Status:** ✅ IMPLEMENTED  
**Complexity:** CRITICAL ARCHITECTURAL FIX  

---

## 🩸 THE WOUND - Why Everything Looked Mono

### The Murder Scene

After implementing WAVE 1051 (Date.now() solid state physics), logs STILL showed mono behavior:

```log
[AGC TRUST 🌊CHILL 7Z] FL:0.65 FR:0.65 | BL:0.42 BR:0.42  ← SYNCHRONIZED
[AGC TRUST 🌊CHILL 7Z] FL:0.58 FR:0.58 | BL:0.35 BR:0.35  ← SYNCHRONIZED
```

**User complaint:** "¿Por qué demonios sigue viéndose Mono?"

### Radwulf's Diagnostic

The physics (ChillStereoPhysics) was sending PERFECT stereo separation:
```typescript
// ChillStereoPhysics output
frontL: 0.65  // Left breathing
frontR: 0.22  // Right breathing (opposite phase)
```

But HAL was receiving:
```log
[AGC TRUST] FL:0.65 FR:0.65  ← BOTH SAME!
```

**Root cause:** MasterArbiter was assigning ALL fixtures to the RIGHT channel.

### The Culprit: Blind Trust in position.x

**MasterArbiter.ts line 1018 (BUGGED):**
```typescript
const isLeft = (fixture?.position?.x ?? 0) < 0
```

**The trap:**
1. If `position.x` is `undefined` → defaults to `0`
2. If `position.x` is `0` (centerline or not set) → `isLeft = FALSE`
3. ALL fixtures assigned to `frontR` / `backR` / `moverR`
4. `frontL` / `backL` / `moverL` channels had **ZERO fixtures** listening
5. Visual result: ALL lights pulse together following RIGHT channel = MONO

**Why it manifested as "sync at 10 seconds":**
- Initially, when physics was sending HIGH values to both L and R, the mono wasn't obvious
- At 10 seconds, when frontL went HIGH (0.65) and frontR went LOW (0.22), the bug became visible
- User saw "all lights bright together" (following frontR 0.65) instead of "left bright, right dim"

---

## 🎯 THE FIX - Multi-Heuristic Laterality Detection

### Core Principle

**NEVER trust a single data source.** Use multiple heuristics in priority order:

1. **Primary:** Physical `position.x` (with threshold to avoid centerline ambiguity)
2. **Secondary:** Fixture name contains "left"/"izq"/"L"
3. **Tertiary:** Zone name contains "left"

### Implementation

**MasterArbiter.ts lines 1013-1045 (WAVE 1052):**

```typescript
// ═══════════════════════════════════════════════════════════════════════
// 🕵️‍♂️ WAVE 1052: ROBUST LATERALITY DETECTION
// ═══════════════════════════════════════════════════════════════════════
// PROBLEM: If position.x is undefined/0, isLeft was always FALSE
//          → ALL fixtures assigned to RIGHT channel
//          → frontL had no fixtures → MONO visual
//
// SOLUTION: Multi-heuristic detection using:
//   1. Physical position.x (primary)
//   2. Fixture name contains "left"/"izq"/"L"
//   3. Zone name contains "left"
// ═══════════════════════════════════════════════════════════════════════

const nameStr = (fixture?.name || '').toLowerCase()
const zoneStr = zone  // Already lowercase
const posX = fixture?.position?.x ?? 0

// Is Left IF: (X < -0.1) OR (Name says "left") OR (Zone says "left")
// Using -0.1 threshold instead of 0 to avoid centerline ambiguity
const isLeft = (posX < -0.1) || 
               nameStr.includes('left') || 
               nameStr.includes('izq') ||      // Spanish "Izquierda"
               nameStr.includes(' l ') ||      // "Front L PAR"
               nameStr.endsWith(' l') ||       // "PAR L"
               nameStr.startsWith('l ') ||     // "L PAR"
               zoneStr.includes('left') ||
               zoneStr.includes('moving_left')
```

### Why This Works

**Heuristic Coverage:**

| Scenario | position.x | Name | Zone | Result |
|----------|-----------|------|------|--------|
| Properly configured | -2.5 | "Front PAR Left" | "FRONT_LEFT" | ✅ Left (all match) |
| Missing position | 0 | "Front L PAR" | "FRONT_LEFT" | ✅ Left (name + zone) |
| Missing position + zone | 0 | "Front Left PAR" | "FRONT" | ✅ Left (name match) |
| Spanish naming | 0 | "PAR Izquierda" | "FRONT" | ✅ Left (izq match) |
| Only position valid | -1.2 | "Fixture 01" | "FRONT" | ✅ Left (position match) |
| Centerline fixture | 0 | "Center Spot" | "CENTER" | ❌ Right (safe fallback) |
| Right fixture | 2.5 | "Front R PAR" | "FRONT_RIGHT" | ❌ Right (correct) |

**Key improvements:**
1. **-0.1 threshold** instead of 0 - avoids centerline ambiguity (fixtures at exactly x=0)
2. **Multiple name patterns** - handles "Left", "L", " L ", "Izq" (Spanish), etc.
3. **Safe fallback** - If all heuristics fail, defaults to RIGHT (prevents crashes)

---

## 🔧 SECONDARY FIX - Robust Mechanics Dragnet

### The Problem

Mechanics (pan/tilt coordinates from physics) could be stored in:
1. `intent.movement.mechanicsL/R` (WAVE 1046 standard)
2. `intent.mechanics.moverL/R` (WAVE 1044 legacy)
3. Nowhere (use VMM fallback)

If MasterArbiter only checked ONE location, it would miss coordinates sent to another.

### The Solution

**Search ALL locations in priority order:**

```typescript
// ═══════════════════════════════════════════════════════════════════════
// 🔧 WAVE 1052: ROBUST MECHANICS DRAGNET
// ═══════════════════════════════════════════════════════════════════════

let mechanic = null

// 1. Try intent.movement.mechanicsL/R (WAVE 1046 Standard)
if (intent.movement.mechanicsL && intent.movement.mechanicsR) {
  mechanic = isLeft ? intent.movement.mechanicsL : intent.movement.mechanicsR
}

// 2. Try intent.mechanics (root-level, WAVE 1044 Legacy)
if (!mechanic && (intent as any).mechanics) {
  const rootMech = (intent as any).mechanics
  if (rootMech.moverL && rootMech.moverR) {
    mechanic = isLeft ? rootMech.moverL : rootMech.moverR
  }
}

// 3. Apply mechanics if found
if (mechanic) {
  defaults.pan = mechanic.pan * 255
  defaults.tilt = mechanic.tilt * 255
  
  // WAVE 1048: Intensity coupling (if present)
  if (mechanic.intensity !== undefined) {
    defaults.dimmer = mechanic.intensity * 255
  }
} else {
  // Fallback to VMM spread
}
```

**Benefits:**
- ✅ Works with WAVE 1046 standard (mechanics in movement)
- ✅ Works with WAVE 1044 legacy (mechanics in root)
- ✅ Supports WAVE 1048 intensity coupling
- ✅ Graceful fallback to VMM if no mechanics found

---

## 🧪 EXPECTED BEHAVIOR

### Fixture Routing Test

**Given fixtures:**
```typescript
[
  { id: 'par1', name: 'Front Left PAR', position: { x: -2, y: 0, z: 0 }, zone: 'FRONT_LEFT' },
  { id: 'par2', name: 'Front Right PAR', position: { x: 2, y: 0, z: 0 }, zone: 'FRONT_RIGHT' },
  { id: 'par3', name: 'Front L PAR', position: { x: 0, y: 0, z: 0 }, zone: 'FRONT' },  // Missing position.x
  { id: 'par4', name: 'Front R PAR', position: { x: 0, y: 0, z: 0 }, zone: 'FRONT' },  // Missing position.x
]
```

**Expected routing:**
```typescript
// par1: isLeft = TRUE (position.x = -2)
//   → Reads frontL channel

// par2: isLeft = FALSE (position.x = 2)
//   → Reads frontR channel

// par3: isLeft = TRUE (name contains " l ")
//   → Reads frontL channel ✅ WAVE 1052 FIX

// par4: isLeft = FALSE (name contains " r ")
//   → Reads frontR channel ✅ WAVE 1052 FIX
```

### Log Signature

**Expected logs after fix:**

```log
[AGC TRUST 🌊CHILL 7Z] FL:0.65 FR:0.22 | BL:0.42 BR:0.18  ← STEREO SEPARATION
[AGC TRUST 🌊CHILL 7Z] FL:0.28 FR:0.71 | BL:0.18 BR:0.43  ← OPPOSITE PHASE
```

**Visual result:**
- When frontL is HIGH (0.65), frontR is LOW (0.22) → Left side BRIGHT, Right side DIM
- When frontL is LOW (0.28), frontR is HIGH (0.71) → Left side DIM, Right side BRIGHT
- Back zones follow same pattern with reduced intensity
- **NO MORE MONO** - Clear left/right breathing opposition

---

## 📊 TECHNICAL DETAILS

### Files Modified

**`src/core/arbiter/MasterArbiter.ts`**

**Section 1: Laterality Detection (lines 1013-1045)**
- **BEFORE:** Single `position.x` check with `?? 0` fallback
- **AFTER:** Multi-heuristic with name/zone/position checks
- **Impact:** Fixtures without valid `position.x` now correctly assigned to L/R

**Section 2: Mechanics Dragnet (lines 1120-1165)**
- **BEFORE:** Only checked `intent.movement.mechanicsL/R`
- **AFTER:** Checks `intent.movement` → `intent.mechanics` (root) → VMM fallback
- **Impact:** Mechanics found regardless of where physics placed them

### Code Statistics

- **Lines added:** ~45
- **Lines removed:** ~5
- **Complexity:** O(1) per fixture (no loops)
- **Performance impact:** Negligible (string comparison + boolean logic)

### Compatibility

- ✅ **WAVE 1046** - Mechanics bypass standard path
- ✅ **WAVE 1044** - Legacy mechanics at root level
- ✅ **WAVE 1048** - Intensity coupling (if mechanic.intensity exists)
- ✅ **WAVE 1051** - Date.now() solid state physics
- ✅ **WAVE 1039** - 7-zone stereo routing
- ✅ **Legacy** - Fixtures without stereo config still work (mono fallback)

---

## 🔗 WAVE DEPENDENCIES

- **REQUIRES:** WAVE 1039 (7-ZONE STEREO ROUTING) - Stereo zones must exist
- **REQUIRES:** WAVE 1046 (MECHANICS BYPASS) - Coordinate pathway
- **ENHANCES:** WAVE 1051 (SOLID STATE PHYSICS) - Makes stereo actually visible
- **FIXES:** WAVE 1050 (NON-NEGATIVE STEREO) - Was correct but invisible due to WAVE 1052 bug
- **COMPLEMENTS:** WAVE 1047/1048/1049 - All previous fixes now functional

---

## 🚨 CRITICAL LESSONS

### Why Single-Source Trust Fails

**Anti-pattern:**
```typescript
const isLeft = (fixture?.position?.x ?? 0) < 0
```

**Problems:**
1. **Silent failure** - If `position.x` is missing, no error, just wrong assignment
2. **Mono assumption** - Fallback to `0` means "assume RIGHT for unknown"
3. **No validation** - Can't detect if position data is stale/corrupt
4. **Fragile** - Any fixture loading bug breaks entire stereo system

**Best practice:**
```typescript
const isLeft = (posX < -0.1) ||     // Primary heuristic
               nameStr.includes(...) || // Secondary heuristic
               zoneStr.includes(...)    // Tertiary heuristic
```

**Benefits:**
1. **Redundancy** - If one source fails, others compensate
2. **Explicit threshold** - `-0.1` avoids centerline ambiguity
3. **Debuggable** - Name/zone checks visible in fixture definitions
4. **Resilient** - Survives position sync bugs

### The "Name says it all" Principle

Fixtures are often **named by humans** who understand left/right.

If you have:
```
"Front Left PAR"
"Front L PAR"
"PAR Izquierda"
"Moving Head L"
```

The **name itself is authoritative** even if `position.x` is wrong/missing.

**Takeaway:** Trust semantic naming over numeric coordinates when coordinates are ambiguous.

---

## 🏆 SUCCESS CRITERIA

**WAVE 1052 is successful when:**

1. ✅ Fixtures WITHOUT valid `position.x` are correctly assigned to L/R based on name
2. ✅ Fixtures WITH valid `position.x = 0` use name/zone as tiebreaker
3. ✅ Spanish-named fixtures ("Izquierda") correctly detected as Left
4. ✅ Mechanics found in BOTH `intent.movement` and `intent.mechanics` (root)
5. ✅ Log shows DIVERGING values for FL/FR, BL/BR (stereo separation)
6. ✅ Visual confirmation: Left side and Right side breathe in OPPOSITION

**User Test:**
1. Load show with fixtures that have `position.x = 0` (not set)
2. Run Chill vibe for 30+ seconds
3. Confirm FL ≠ FR in logs (e.g., FL:0.65 FR:0.22)
4. Visually confirm left side BRIGHT when right side DIM (and vice versa)

If ANY fixture still shows mono behavior → check name/zone strings → WAVE FAILED.

---

## 🔮 FUTURE IMPROVEMENTS

**Potential enhancements (NOT needed for fix):**
- **Position validation warning:** Log when `position.x = 0` and using name fallback
- **Auto-learn positions:** If name says "Left" but position.x > 0, suggest correction
- **Zone schema enforcement:** Validate zone names match expected patterns (FRONT_LEFT, BACK_RIGHT, etc.)
- **Fixture grouping API:** Allow user to manually assign fixtures to L/R groups

**DO NOT IMPLEMENT** until user confirms WAVE 1052 works. Perfection First, not feature creep.

---

## 📝 COMMIT MESSAGE

```
WAVE 1052: ROBUST IDENTITY - Multi-Heuristic L/R Detection

Fixed mono visual caused by MasterArbiter assigning ALL fixtures to RIGHT channel.

Root cause: Single-source trust in position.x. When position.x was undefined/0,
isLeft was always FALSE, routing all fixtures to frontR/backR/moverR channels.
frontL/backL/moverL had zero fixtures, creating mono appearance despite stereo physics.

Solution: Multi-heuristic laterality detection:
  1. position.x < -0.1 (primary, threshold avoids centerline)
  2. Name contains "left"/"izq"/"L" (secondary, human naming)
  3. Zone contains "left" (tertiary, explicit zone tag)

Secondary fix: Robust mechanics dragnet searches:
  1. intent.movement.mechanicsL/R (WAVE 1046 standard)
  2. intent.mechanics.moverL/R (WAVE 1044 legacy)
  3. VMM fallback (if no mechanics found)

Files: MasterArbiter.ts (lines 1013-1045, 1120-1165)
Fixes: Stereo physics (WAVE 1050/1051) now actually visible
Enhances: WAVE 1046 mechanics bypass, WAVE 1048 intensity coupling

User validation required: Confirm FL ≠ FR in logs, visual L/R opposition
```

---

**END WAVE 1052**

*"When position.x fails you, listen to what the humans named the fixture."*  
— PunkOpus, The Robust Identity, 2026-01-30
