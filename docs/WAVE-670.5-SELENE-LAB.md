# 🔬 WAVE 670.5 - THE SELENE LAB

## EXECUTION REPORT

**Date:** 2026-01-16  
**Status:** ✅ COMPLETE  
**Commit:** Pending

---

## 📋 MISSION BRIEF

**Objective:** Create an automated calibration suite that injects mathematically perfect synthetic audio signals into Selene's brain and reports the resulting internal metrics.

**Philosophy:** "No assertions, no expectations. Just cold, hard telemetry."

**Key Principle:** Observer Mode - We don't tell the test what to expect. We ask it what it sees.

---

## 📦 COMPONENTS CREATED

### 1. SignalGenerator (`SignalGenerator.ts`)
**Lines:** ~450  
**Purpose:** Creates deterministic, reproducible synthetic audio signals

**Signals Available:**
| Signal | Description | Expected Characteristics |
|--------|-------------|-------------------------|
| `SILENCE` | Complete digital silence | Energy ≈ 0, All metrics ≈ 0 |
| `WHITE_NOISE` | Flat spectrum noise | High Harshness, High Flatness |
| `PINK_NOISE` | 1/f spectrum (natural) | Moderate Harshness |
| `SINE_440Hz` | Pure tone A4 | Single peak, Low Harshness |
| `SINE_50Hz` | Sub-bass | Strong Bass, Low Harshness |
| `TECHNO_KICK_128BPM` | 4-on-the-floor | Rhythmic Energy, Kick Detection |
| `TECHNO_KICK_174BPM` | D&B tempo | Faster Rhythm |
| `PODCAST` | Vocal simulation | Low Energy, Speech Rhythm |
| `THE_DROP` | 2s silence → 1s chaos | Z-Score SPIKE test |
| `BUILDUP` | Rising intensity 16s | Gradual Energy Increase |

**CRITICAL:** Uses deterministic PRNG (Linear Congruential Generator with fixed seed). Same input = Same output. Always.

### 2. CalibrationRunner (`CalibrationRunner.ts`)
**Lines:** ~300  
**Purpose:** Feeds signals through the brain pipeline and collects telemetry

**Interface for Brain:**
```typescript
interface BrainMetricProvider {
  processBuffer(buffer: Float32Array): void
  getMetrics(): { /* all metrics */ }
  reset(): void
}
```

**Output:** `CalibrationReport` containing:
- Per-signal statistics (min, max, avg, stdDev, percentiles)
- Peak moments (when max energy/harshness/z-score occurred)
- Detection counts (kicks, snares, drop bridge triggers)
- Section distribution
- Cross-signal analysis
- **Threshold Recommendations** ← The real gold

### 3. CalibrationReport (`CalibrationReport.ts`)
**Lines:** ~200  
**Purpose:** Formats raw data into human-readable reports

**Formats:**
- Markdown (full detailed report)
- JSON (machine-parseable)
- Summary (compact console output)
- Energy Graph (ASCII visualization)

### 4. SeleneBrainAdapter (`SeleneBrainAdapter.ts`)
**Lines:** ~450  
**Purpose:** Connects synthetic signals to REAL Selene pipeline

**Pipeline:**
```
Buffer → AGC → FFT → ContextualMemory → FuzzyDecisionMaker → DropBridge
                          ↓
                     MetricSnapshot
```

**Components Used:**
- `FFTAnalyzer` (real FFT implementation)
- `ContextualMemory` (Z-Score calculation)
- `FuzzyDecisionMaker` (WAVE 667)
- `DropBridge` (WAVE 668)

### 5. CLI Runner (`scripts/run-calibration.ts`)
**Purpose:** Command-line interface to run calibration

**Usage:**
```bash
npx ts-node scripts/run-calibration.ts
npx ts-node scripts/run-calibration.ts --output report.md
npx ts-node scripts/run-calibration.ts --json
```

---

## 🎯 USE CASES

### 1. Threshold Calibration
"The Drop only reaches Z-Score 2.4, not 3.0"
→ Adjust `EPIC_ZSCORE_THRESHOLD` from 3.0 to 2.2

### 2. Harshness Algorithm Validation
"White noise should be much harsher than techno kick"
→ Check if harshness calculation is correct

### 3. Section Detection Testing
Feed known patterns, see if sections are classified correctly

### 4. AGC Tuning
See how AGC gain responds to different signal levels

### 5. Regression Testing
Run after changes to verify behavior hasn't drifted

---

## 📊 EXPECTED OUTPUT EXAMPLE

```
╔══════════════════════════════════════════════════════════════╗
║            🔬 SELENE LAB - CALIBRATION SUMMARY              ║
╠══════════════════════════════════════════════════════════════╣
║  SILENCE              E:0.00   H:0.00   Z:0.0              ║
║  WHITE_NOISE          E:0.78   H:0.85   Z:2.1              ║
║  PINK_NOISE           E:0.65   H:0.42   Z:1.8              ║
║  TECHNO_KICK_128BPM   E:0.72   H:0.25   Z:2.4              ║
║  THE_DROP             E:0.45   H:0.38   Z:3.2              ║
╠══════════════════════════════════════════════════════════════╣
║  ⚠️  RECOMMENDATIONS:                                        ║
║     EPIC_ZSCORE_THRESHOLD: 3.0 → 2.80                       ║
║     Reason: "The Drop" peaks at 3.2, threshold is correct   ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🔧 FIXES APPLIED

### Import Path Corrections
- `FuzzyDecisionMaker.ts`: Changed `@/engine/types` → `../../../engine/types`
- `DropBridge.ts`: Changed `@/engine/types` → `../../../engine/types`

### Type Compatibility
- Created `mapSectionType()` to handle 'unknown' section type (only exists in memory module)

---

## 📁 FILES CREATED/MODIFIED

### Created (5 files)
```
electron-app/src/core/calibration/
├── index.ts              (~50 lines)  - Module exports
├── SignalGenerator.ts    (~450 lines) - Synthetic signal creation
├── CalibrationRunner.ts  (~300 lines) - Test runner & metrics
├── CalibrationReport.ts  (~200 lines) - Report formatting
└── SeleneBrainAdapter.ts (~450 lines) - Brain adapter

scripts/
└── run-calibration.ts    (~100 lines) - CLI runner
```

### Modified (2 files)
```
electron-app/src/core/intelligence/think/
├── FuzzyDecisionMaker.ts  - Fixed import path
└── DropBridge.ts          - Fixed import path
```

---

## 🚀 NEXT STEPS

1. **Run Calibration:** Execute the suite and generate baseline report
2. **Analyze Results:** Compare expected vs actual metrics
3. **Tune Thresholds:** Adjust fuzzy membership functions based on reality
4. **Iterate:** Run again to verify improvements

---

## 💡 PHILOSOPHICAL NOTE

> "The map is not the territory."
> 
> We've been tuning Selene's perception based on what we THINK audio should look like.
> Now we have a way to see what audio ACTUALLY looks like to Selene.
> 
> This is the difference between theoretical calibration and empirical calibration.
> This is the Selene Lab.

---

**WAVE 670.5 - THE SELENE LAB: COMPLETE** ✅
