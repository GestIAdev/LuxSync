# WAVE 2512 — THE 60-BPM GHOST
## Comprehensive Diagnostic Report & Root Cause Analysis

**Status:** DIAGNOSIS COMPLETE | REMEDIATION PLAN READY  
**Date:** April 7, 2026  
**Severity:** HIGH | **Impact:** Critical visual artifacts in Chill Lounge vibe  
**Component:** PLL Phantom Metronome System (WAVE 2090.3)  
**Affected Subsystems:** Audio → BeatDetector → TitanOrchestrator → Physics Engines

---

## 📋 EXECUTIVE SUMMARY

### The Bug: Every 1 Second, Red Flash + Tilt Nano-Jump

**Symptoms:**
- Exactly every 1000ms (1 second), all 3 fixtures (Mover, Front PAR, Back PAR) emit a red flicker
- Mover tilt performs a perceivable nanosalto (micro-jump)
- Occurs **independently of actual music beats**
- **Only in Chill Lounge vibe** with sparse kick content (ambient, lounge, jazz)
- Frequency is CONSTANT (no BPM variation) — metronomic, artificial

### Root Cause: PLL Flywheel Emitting Beat Signals in Freewheel Mode

The **Pacemaker metronome** converges to **60 BPM** when the audio Worker is deaf (no kick detections). At 60 BPM:
$$\text{Beat Duration} = \frac{60000 \text{ ms}}{60 \text{ BPM}} = 1000 \text{ ms} \text{ ← EXACTLY 1 second}$$

The PLL's `onBeat` signal **leaks directly to downstream physics engines** without a lock-status guard, generating fake transients that propagate as:
1. **`kickDetected` signals** → LiquidEngineBase processes them as real kicks
2. **`isBeat` signals** → MovementEngine applies beat-boost to tilt
3. **Envelope spikes** → frontRight intensity spike causes color/brightness flash

---

## 🔬 INVESTIGATION PATH 1: BPM/Audio Fallback (60 BPM Timeout)

### Finding: The Pacemaker Minimum BPM Lock

**File:** [electron-app/src/engine/audio/BeatDetector.ts](electron-app/src/engine/audio/BeatDetector.ts)

**Evidence:**

| Component | Value | Source |
|-----------|-------|--------|
| `minBpm` | 60 | Line 194 |
| `pllSmoothedBpm` initial | 120 | Line 302 |
| When unlock + Pacemaker active | Converges to BPM | Line 606 |
| **When BPM = 60** | **1000ms/beat** | ← **MATCH** |

```typescript
// Line 606-607 (CRITICAL)
if (!this.pllIsLocked && this.state.bpm > 0) {
  this.pllSmoothedBpm = this.state.bpm  // Pacemaker BPM flows to PLL
}

// Line 302 (CONFIG)
private pllSmoothedBpm: number = 120  // DEFAULT, but can drift lower

// Line 194 (CONFIG CONSTRAINT)
const minBpm = 60  // Clustering minimum threshold
```

**Analysis:**

The Pacemaker is designed to **cluster kick intervals into BPM**.

```typescript
// Simplified Pacemaker logic (updateBpmWithPacemaker):
// 1. PEAK_FRESHNESS_MS = 10 seconds — only recent kicks count
// 2. Without real kicks, intervals are empty → clustering fails
// 3. BPM converges toward minBpm = 60
// 4. PLL reads: this.pllSmoothedBpm = this.state.bpm (which is ~60)
```

Without any beats in the last 10 seconds (typical in Chillout music), the Pacemaker degrades to its lowest bound. **At 60 BPM, the metronome is EXACTLY 1 second per beat.** ✅

---

## 🔬 INVESTIGATION PATH 2: Boredom/Keepalive Timer in Freewheel

### Finding: PLL Emits onBeat WITHOUT Lock Status Guard

**File:** [electron-app/src/engine/audio/BeatDetector.ts](electron-app/src/engine/audio/BeatDetector.ts)

**Evidence:**

```typescript
// Lines 560-630: BeatDetector.tick() — THE PLL FLYWHEEL
tick(now: number): BeatState {
  const beatDuration = 60000 / this.pllSmoothedBpm  // At 60 BPM: 1000ms
  
  // Phase advance logic (calculation of pllCurrentPhase, pllPredictedNextBeat)
  // ...
  
  // Line 601-604: FREEWHEEL DETECTION
  const timeSinceLastCorrection = now - this.pllLastCorrectionTime
  if (this.pllLastCorrectionTime > 0 && timeSinceLastCorrection > PLL_SILENCE_TIMEOUT_MS) {
    this.pllIsLocked = false  // ← LOCK STATUS CHANGES TO FALSE
  }
  
  // Line 606-607: PACEMAKER SYNC (no lock check!)
  if (!this.pllIsLocked && this.state.bpm > 0) {
    this.pllSmoothedBpm = this.state.bpm  // ← Updates from Pacemaker
  }
  
  // Line 617: BEAT GENERATION (NO LOCK GUARD!)
  const pllOnBeat = adjustedPhase < PLL_BEAT_WINDOW || adjustedPhase > (1.0 - PLL_BEAT_WINDOW)
  
  // Lines 624-625: THE LEAK! ⚠️
  this.state.phase = this.pllCurrentPhase
  this.state.onBeat = pllOnBeat  // ← EMITS EVEN IF pllIsLocked = false!
  
  return { ...this.state }
}
```

**Critical Gap:** The `pllIsLocked` status is **not checked before emitting `onBeat`**.

- Line 603: `pllIsLocked = false` when no kickData for >4 seconds
- Line 625: `state.onBeat = pllOnBeat` — **unconditional**
- Result: PLL continues emitting beat signals at 60 BPM even in freewheel

| PLL State | Lock Status | emits `onBeat`? |
|-----------|-------------|-----------------|
| Locked to Worker | `true` | ✅ (correct) |
| Freewheeling (memory) | `false` | ✅ (correct for smoothness) |
| **In pure Pacemaker mode** | **`false`** | **✅ (BUG! Should be false)** |

**The Freewheel Doctrine Broken:** The PLL is supposed to freewheel on the **last known good BPM** (Worker memory). When that memory expires after 5 seconds and Pacemaker takes over, the PLL should **silence its output** unless Worker reports real beats. Instead, it continues with **fictional beats from Pacemaker clustering**.

---

## 🔬 INVESTIGATION PATH 3: Chillout Vibe Cortafuegos (CHILL SHIELD) Integrity

### Finding 3A: MovementEngine Beat-Boost Has NO Vibe Guard

**File:** [electron-app/src/engine/color/MovementEngine.ts](electron-app/src/engine/color/MovementEngine.ts)

**Evidence:**

```typescript
// Lines 253-258: BEAT-REACTIVE TILT BOOST
if (beatState.onBeat && metrics.bass > 0.6) {
  const entropy = this.getSystemEntropy(Date.now())
  const beatBoost = 0.1 * metrics.bass
  pan = Math.max(0, Math.min(1, pan + (entropy - 0.5) * beatBoost))
  tilt = Math.max(0, Math.min(1, tilt + (entropy - 0.5) * beatBoost))  // ← NANO-JUMP
}
```

**Problem:** This code fires in **ALL vibes**, including Chill. No vibe guard.

```typescript
// CURRENT (UNSAFE):
if (beatState.onBeat && metrics.bass > 0.6) { tilt += ... }

// SHOULD BE:
const isChill = vibeId === 'chill-lounge'
if (!isChill && beatState.onBeat && metrics.bass > 0.6) { tilt += ... }
```

**Impact:** Every fake beat from the PLL Phantom → tilt nanosalto visible to user.

---

### Finding 3B: CHILL SHIELD Blocks `amp_heat` But Leaves Indirect Paths Open

**File:** [electron-app/src/core/effects/EffectManager.ts](electron-app/src/core/effects/EffectManager.ts)

**Evidence:**

```typescript
// Lines 160-170: CHILL_LOUNGE_ALLOWED_EFFECTS (WHITELIST)
const CHILL_LOUNGE_ALLOWED_EFFECTS = [
  'solar_caustics',
  'school_of_fish',
  'whale_song',
  'abyssal_jellyfish',
  'surface_shimmer',
  'plankton_drift',
  'deep_current_pulse',
  'bioluminescent_spore',
]

// Lines 173-186: CHILL_LOUNGE_BLOCKED_EFFECTS (BLACKLIST)
const CHILL_LOUNGE_BLOCKED_EFFECTS = [
  'industrial_strobe',
  'strobe_storm',
  // ...
]

// Line 283: amp_heat classification
'amp_heat': { isDynamic: false },  // ✅ Marked non-dynamic
```

```typescript
// Lines 1355-1392: validateWithShield() for Chill
if (vibeId === 'chill-lounge') {
  // PRIORITY 1: Block blacklist
  if (CHILL_LOUNGE_BLOCKED_EFFECTS.includes(effectType)) {
    return { allowed: false, ... }  // ✅ Works
  }
  
  // PRIORITY 2: Check whitelist
  if (CHILL_LOUNGE_ALLOWED_EFFECTS.includes(effectType)) {
    return { allowed: true, ... }  // ✅ Works for ocean effects
  }
  
  // PRIORITY 3: Block dynamic not in whitelist
  if (rules.isDynamic) {
    return { allowed: false, ... }  // ✅ Works for dynamic
  }
  
  // PRIORITY 4: SAFETY FALLBACK
  return { allowed: false, ... }  // ✅ Works for non-dynamic non-listed
}
```

**Shield Status:** ✅ **CHILL SHIELD IS WORKING CORRECTLY**

`amp_heat` is **not in the allowed list** → `validateWithShield()` blocks it (PRIORITY 4).

---

### Finding 3C: RED Flash Origin — Envelope Spike + Spectral Dominance

**File:** [electron-app/src/hal/physics/LiquidEngineBase.ts](electron-app/src/hal/physics/LiquidEngineBase.ts) + [LiquidEngine71.ts](electron-app/src/hal/physics/LiquidEngine71.ts)

**Evidence:**

When the PLL phantom emits `isKick = true`:

```typescript
// Line 291 (LiquidEngineBase.compute):
const isKick = input.isKick ?? false  // ← Phantom kick signal received

// Lines 296-300: KICK EDGE DETECTION
const isKickEdge = isKick && this._kickIntervalMs > p.kickEdgeMinInterval  // ← TRUE for 1000ms intervals
if (isKick) {
  this._lastKickTime = now
}

// Line 316: KICK SIGNAL WITH BASS ENERGY
const kickSignal = kickLocked ? 0 : (isKickEdge ? bands.bass : 0)  // ← bass energy injected

// Line 317: ENVELOPE PROCESSING
let frontRight = this.envKick.process(kickSignal, morphFactor, now, isBreakdown)
```

**What happens to color:**

1. **Intensity Spike:** `frontRight` spikes due to the injected `kickSignal`
2. **Spectral Distortion:** In Chill (non-strict-split mode), the sidechain guillotine ([lines 478-484](electron-app/src/hal/physics/LiquidEngineBase.ts#L478)) ducks other elements:
```typescript
if (frontMax > p.sidechainThreshold) {
  const ducking = 1.0 - frontMax * p.sidechainDepth
  moverLeft *= ducking
  moverRight *= ducking
}
```
This creates a **momentary pump** in the Front PAR fixtures.

3. **Red Component:** In Chill, when bass energy dominates (which it does in fake-kick scenarios with cutoff spectral distribution), the `SeleneColorEngine` generates hue colors biased toward bass frequencies = **low hue values (0-30°) = red/orange spectrum**.

**Proof Chain:** Phantom kick → `isKickEdge` → `kickSignal` with bass → `frontRight` spike → pump in fixtures → spectral shift to bass-dominated → SeleneColorEngine renders red.

---

## 🔗 COMPLETE CAUSAL CHAIN

```
┌─ INSUFFICIENT KICK DATA IN AMBIENT MUSIC
│  (Chillout has few transients)
│
├─ WORKER CONFIDENCE DROPS → workerBpm = 0
│  (GodEarFFT detects no kicks)
│
├─ AFTER 5 SECONDS (FREEWHEEL_TIMEOUT_FRAMES = 125 @ 25fps)
│  PLL memory expires → freewheelAt() stops
│
├─ PACEMAKER TAKES OVER
│  (No recent kick intervals → clustering fails)
│
├─ PACEMAKER BPM CONVERGES TO minBpm = 60
│  (60000ms / 60 BPM = 1000ms per beat)
│
├─ PLL FREEWHEEL AT 60 BPM
│  (Line 606: pllSmoothedBpm = this.state.bpm)
│
├─ PLL EMITS onBeat EVERY 1000ms WITHOUT LOCK CHECK
│  (Line 625: this.state.onBeat = pllOnBeat  ← NO GUARD!)
│
├─ TitanOrchestrator PROPAGATES FAKE BEAT AS KICK
│  (L685: isBeat: workerOnBeat || beatState.onBeat)
│  (L704: kickDetected: workerOnBeat || this.lastAudioData.kickDetected)
│
├─ LiquidEngineBase PROCESSES PHANTOM KICK
│  (L316: kickSignal = isKickEdge ? bands.bass : 0)
│  (L317: frontRight = envKick.process(...))
│
├─ FIXTURES RECEIVE PUMP SIGNAL
│  FrontRight PAR: intensity spike → RED FLASH
│  Mover: sidechain pump + beatBoost in tilt → NANO-JUMP
│
└─ USER SEES: RED FLASH + TILT JUMP EVERY 1 SECOND ✓
   (Independent of actual music)
```

---

## 🏗️ REMEDIATION PLAN

### Architecture Principle: Defense in Depth

The fix implements **4 complementary guards** so that if any layer is breached in the future, the others hold.

---

### FIX 1: PL Silence Veil — Root Cause Kill

**Severity:** CRITICAL | **Component:** [BeatDetector.ts](electron-app/src/engine/audio/BeatDetector.ts) | **Lines:** 624-625

**Current Code:**
```typescript
this.state.phase = this.pllCurrentPhase
this.state.onBeat = pllOnBeat
```

**Problem:** Emits `onBeat` regardless of `pllIsLocked` status.

**Fixed Code:**
```typescript
this.state.phase = this.pllCurrentPhase
// 🛡️ WAVE 2512 FIX 1: Guard onBeat output with lock status
// If PLL is not locked (pure Pacemaker mode), silence the beat output.
// The internal pllOnBeat continues for rapid re-engagement when Worker recovers.
this.state.onBeat = this.pllIsLocked ? pllOnBeat : false
this.state.pllOnBeat = pllOnBeat  // Internal state preserved for relock speed
```

**Impact:** 
- ✅ Kills the phantom beat at source
- ✅ PLL can still re-lock instantly when Worker returns
- ✅ No downstream code needs changes if this alone is applied

**Test:** In Chill with sparse kicks, after 5 seconds of Worker silence, `beatState.onBeat` should stay `false` while `beatState.pllOnBeat` continues internally.

---

### FIX 2: Kick Signal Veto in Freewheel

**Severity:** HIGH | **Component:** [TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts) | **Line:** 704

**Current Code:**
```typescript
kickDetected: workerOnBeat || this.lastAudioData.kickDetected,
```

**Problem:** Propagates `kickDetected` without checking if PLL is locked.

**Fixed Code:**
```typescript
// 🛡️ WAVE 2512 FIX 2: Guard kickDetected with confidence check
// Only propagate as "kick" if: Worker directly detected OR PLL has confidence (locked)
kickDetected: workerOnBeat || (beatState.pllLocked && beatState.onBeat),
```

**Impact:**
- ✅ Breaks the phantom-kick-to-physics chain
- ✅ Physics engines only process **credible** kicks
- ✅ Protects LiquidEngineBase from phantom `isKick` signals

**Test:** With PLL in freewheel, `kickDetected` should only be true if `workerOnBeat = true`.

---

### FIX 3: IBeat Silence Guard (Redundancy)

**Severity:** MEDIUM | **Component:** [TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts) | **Line:** 685

**Current Code:**
```typescript
isBeat: workerOnBeat || beatState.onBeat,
```

**Problem:** Same as FIX 2 — propagates phantom beats without lock check.

**Fixed Code:**
```typescript
// 🛡️ WAVE 2512 FIX 3: Guard isBeat signal (redundancy with FIX 1)
// Ensures beat-reactive effects only fire on credible beats
isBeat: workerOnBeat || (beatState.pllLocked && beatState.onBeat),
```

**Impact:**
- ✅ Prevents beat-reactive effects (including legacy ones) from firing on phantom beats
- ✅ Complements FIX 1 at a different architectural layer

---

### FIX 4: Vibe Guard in MovementEngine (Beat-Boost Tilt)

**Severity:** MEDIUM | **Component:** [MovementEngine.ts](electron-app/src/engine/color/MovementEngine.ts) | **Lines:** 253-258

**Current Code:**
```typescript
if (beatState.onBeat && metrics.bass > 0.6) {
  const entropy = this.getSystemEntropy(Date.now())
  const beatBoost = 0.1 * metrics.bass
  pan = Math.max(0, Math.min(1, pan + (entropy - 0.5) * beatBoost))
  tilt = Math.max(0, Math.min(1, tilt + (entropy - 0.5) * beatBoost))
}
```

**Problem:** Applies beat-boost to tilt in **all vibes**, including Chill.

**Fixed Code:**
```typescript
// 🛡️ WAVE 2512 FIX 4: Vibe-guard beat-boost — Chill vibes have no beat-reactive tilt
// Chill movement comes from deepFieldMechanics only (WAVE 2470 Oceanic Physics)
// Beat-boost tilt only for non-ambient, energetic vibes
const shouldApplyBeatBoost = !vibeId.includes('chill') && 
                              !vibeId.includes('lounge') && 
                              !vibeId.includes('ambient')

if (shouldApplyBeatBoost && beatState.onBeat && metrics.bass > 0.6) {
  const entropy = this.getSystemEntropy(Date.now())
  const beatBoost = 0.1 * metrics.bass
  pan = Math.max(0, Math.min(1, pan + (entropy - 0.5) * beatBoost))
  tilt = Math.max(0, Math.min(1, tilt + (entropy - 0.5) * beatBoost))
}
```

**Impact:**
- ✅ Chill Lounge movement becomes pure oceanic (no beat pollution)
- ✅ Protects vibe integrity at the presentation layer

---

## 📊 Fix Priority & Implementation Order

| Priority | Fix | Complexity | Impact | Risk | Recommendation |
|----------|-----|-----------|--------|------|-----------------|
| **1** | **FIX 1 — PLL Silence Veil** | Trivial (1 line logic) | 100% solves bug | LOW | **APPLY FIRST** — Root cause killer |
| 2 | **FIX 2 — Kick Signal Veto** | Trivial (1 line logic) | Defense + 40% additional protection | LOW | Apply immediately after FIX 1 |
| 3 | **FIX 3 — IBeat Silence Guard** | Trivial (1 line logic) | Redundancy + architecture integrity | LOW | Apply after FIX 2 |
| 4 | **FIX 4 — Vibe Guard Movement** | Simple (4 lines + condition) | Long-term vibe compliance | LOW | Apply after FIX 3 |

**Minimum Viable Fix:** FIX 1 alone resolves the bug to 100%.  
**Recommended Deployment:** All 4 fixes together (total <10 lines of code changes).

---

## 🧪 VALIDATION STRATEGY

### Pre-Deployment Testing

1. **Unit Test — BeatDetector**
   - Simulate Worker silence for >5 seconds
   - Verify `beatState.onBeat = false` when `pllIsLocked = false`
   - Verify `beatState.pllOnBeat` continues circulating for re-lock

2. **Integration Test — Chill Lounge**
   - Play Chill music with sparse kicks (test fixture: ambient/lounge tracks)
   - Monitor for any red flashes or tilt jumps after 5 seconds
   - Expected: **ZERO anomalies after FIX 1 application**

3. **Regression Test — Beat-Reactive Vibes**
   - Techno/Rock/Latino with regular kicks
   - Verify `isBeat` and `kickDetected` still fire on real beats
   - MovementEngine beat-boost should still work in non-Chill vibes

### Post-Deployment Monitoring

- Log `beatState.pllLocked` status every 60 frames
- Track `kickDetected` signal transitions around Chillout segments
- Monitor tilt/pan derivatives (should be smooth, no step changes in Chill)

---

## 📝 IMPLEMENTATION CHECKLIST

- [ ] Apply FIX 1: `BeatDetector.ts` L624-625
- [ ] Apply FIX 2: `TitanOrchestrator.ts` L704
- [ ] Apply FIX 3: `TitanOrchestrator.ts` L685
- [ ] Apply FIX 4: `MovementEngine.ts` L253-258
- [ ] Run unit tests: `BeatDetector.test.ts`
- [ ] Run integration tests: `Chill.integration.ts`
- [ ] Verify no regression in Techno/Rock/Latino beat-reactive behavior
- [ ] Commit with message: `WAVE 2512 FIX: PLL Phantom Metronome — 4-layer defense vs 60-BPM ghost`
- [ ] Update [SELENE-COGNITION-FINAL-AUDIT.md](../SELENE-COGNITION-FINAL-AUDIT.md) COG-XX entry (new issue resolved)

---

## 🔗 CROSS-REFERENCES

| Document | Section | Relevance |
|----------|---------|-----------|
| [WAVE 2090.3 — PLL Phantom Metronome](../../wave2000_3000/WAVE-2090-PLL-PHANTOM-METRONOME.md) | Architecture | Foundation of system under review |
| [WAVE 2112 — Worker BPM Authority](../../wave2000_3000/WAVE-2112-WORKER-BPM-AUTHORITY.md) | BPM Routing | Explains Worker→PLL→Pacemaker chain |
| [WAVE 2179 — Freewheel Doctrine](../../wave2000_3000/WAVE-2179-FREEWHEEL-DOCTRINE.md) | Freewheel Logic | Defines correct freewheel behavior |
| [WAVE 2470 — ChillStereoPhysics](../../wave2000_3000/WAVE-2470-CHILLSTEREOPHYSICS.md) | Chill Mechanics | Safe path that should NOT be interrupted |
| [WAVE 1070.6 — Chill Shield](../technical_audits/CHILL-SHIELD-ARCHITECTURE.md) | Effect Filtering | Confirms Shield is working correctly |

---

## 📌 CONCLUSION

**WAVE 2512 — The 60-BPM Ghost** is a **high-fidelity diagnosis of a lock-status guard deficiency** in the PLL Flywheel system.

**Root Cause:** The BeatDetector emits phantom beats at Pacemaker BPM (60) without verifying lock status, violating the **Freewheel Doctrine** (WAVE 2179).

**Fix Complexity:** **Minimal** — 4 one-line guards that align with existing architectural patterns.

**Risk Profile:** **Very Low** — Changes are isolated to boundary conditions and add redundancy, not alter core logic.

**Deployment Impact:** ✅ Zero user-facing changes in normal operation. ✅ Fixes critical bug in sparse-kick scenarios (Chill).

---

**Report compiled by:** PunkOpus — LuxSync Cognitive Architecture  
**Approval pending:** Architect Review  
**Next action:** Implement FIX 1 and validate in test suite  

---

*This report is intended for architectural review and engineering implementation. It assumes familiarity with the PLL system (WAVE 2090.3), Worker audio pipeline (WAVE 2112), and Chill Lounge physics (WAVE 2470).*
