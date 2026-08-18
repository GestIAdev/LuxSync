# CASSANDRA 2.0 MARKOV CONTEXT — Codebase Extraction
**Purpose:** Precise technical context for a frontier LLM (Opus) to implement a Zero-Allocation, 2nd-Order Markov Chain (Cassandra 2.0). No refactoring yet — data extraction only.

---

## 1. MSST Section States — Exact Enum/Type Definitions

There are **THREE** different `SectionType` definitions in the codebase. Cassandra 2.0 must choose the correct one.

### 1A. `SectionOutput['type']` — The MSST (MultiSpectralSectionTracker) ground truth
**File:** `src/workers/TrinityBridge.ts` (line 117)
**This is the ACTUAL section detector output — the source of truth.**

```typescript
export interface SectionOutput {
  type: 'intro' | 'verse' | 'chorus' | 'drop' | 'textural_drop' | 'breakdown' | 'bridge' | 'buildup' | 'outro' | 'unknown';
  energy: number;               // 0-1
  transitionLikelihood: number; // 0-1 (probability of section change)
  beatsSinceChange: number;
  confidence: number;
  /** Multi-spectral evidence bundle (M-SARFE Phase 1) */
  evidence?: SectionEvidence;
}
```

**Count: 10 states** (intro, verse, chorus, drop, textural_drop, breakdown, bridge, buildup, outro, unknown)

### 1B. `SectionClassification` — PredictionEngine's normalized type (LEGACY, 7 states)
**File:** `src/core/intelligence/types.ts` (line 225)

```typescript
export type SectionClassification = 
  | 'intro' 
  | 'verse' 
  | 'buildup' 
  | 'chorus' 
  | 'drop' 
  | 'breakdown' 
  | 'outro'
```

**Count: 7 states** — Missing `textural_drop`, `bridge`, `unknown`. This is the type used by the legacy `PROGRESSION_PATTERNS` and `predict()`.

### 1C. `SectionType` — ContextualMemory's type (10 states, matches MSST)
**File:** `src/core/intelligence/memory/ContextualMemory.ts` (line 24)

```typescript
export type SectionType = 
  | 'intro' 
  | 'verse' 
  | 'buildup' 
  | 'chorus' 
  | 'drop' 
  | 'textural_drop'
  | 'breakdown' 
  | 'outro' 
  | 'bridge'
  | 'unknown';
```

### 1D. `SectionType` — Engine musical types (11 states, has `pre_chorus`)
**File:** `src/engine/musical/types.ts` (line 249)

```typescript
export type SectionType =
  | 'intro'
  | 'verse'
  | 'pre_chorus'
  | 'chorus'
  | 'bridge'
  | 'buildup'
  | 'drop'
  | 'textural_drop'
  | 'breakdown'
  | 'outro'
  | 'unknown';
```

### 1E. MSST_SECTION_KEYS — The canonical ordered array
**File:** `src/workers/TrinityBridge.ts` (line 1248)

```typescript
const MSST_SECTION_KEYS: SectionOutput['type'][] = [
  'intro', 'verse', 'buildup', 'chorus', 'drop',
  'textural_drop', 'breakdown', 'bridge', 'outro', 'unknown',
];
```

**RECOMMENDATION FOR CASSANDRA 2.0:** Use the MSST 10-state alphabet (`MSST_SECTION_KEYS`). The 3D transition matrix should be `Float32Array(10 * 10 * 10)` = 1000 floats = 4KB. Map each section string to an index 0-9 via a frozen lookup table.

---

## 2. Legacy Cassandra Logic — PredictionEngine.ts

**File:** `src/core/intelligence/think/PredictionEngine.ts` (960 lines)

### 2A. PROGRESSION_PATTERNS — Hardcoded progression probabilities

```typescript
interface ProgressionPattern {
  /** Secuencia de secciones que activan esta predicción */
  trigger: SectionClassification[]
  
  /** Sección probable siguiente */
  nextSection: SectionClassification
  
  /** Probabilidad base */
  probability: number
  
  /** Tipo de predicción */
  predictionType: PredictionType
  
  /** Acciones sugeridas */
  actions: PredictionAction[]
}

const PROGRESSION_PATTERNS: ProgressionPattern[] = [
  // Buildup prolongado → Drop inminente (90%)
  {
    trigger: ['buildup', 'buildup'],
    nextSection: 'drop',
    probability: 0.90,
    predictionType: 'drop_incoming',
    actions: [
      { type: 'prepare', effect: 'intensity_ramp', intensity: 0.8, durationMs: 2000, timingOffsetMs: -2000 },
      { type: 'execute', effect: 'flash', intensity: 1.0, durationMs: 200, timingOffsetMs: 0 },
      { type: 'recover', effect: 'strobe', intensity: 0.9, durationMs: 4000, timingOffsetMs: 200 },
    ],
  },
  
  // Buildup simple → Drop probable (75%)
  {
    trigger: ['buildup'],
    nextSection: 'drop',
    probability: 0.75,
    predictionType: 'drop_incoming',
    actions: [
      { type: 'prepare', effect: 'intensity_ramp', intensity: 0.6, durationMs: 1500, timingOffsetMs: -1500 },
      { type: 'execute', effect: 'flash', intensity: 1.0, durationMs: 150, timingOffsetMs: 0 },
    ],
  },
  
  // Verse + Buildup → Chorus probable (85%)
  {
    trigger: ['verse', 'buildup'],
    nextSection: 'chorus',
    probability: 0.85,
    predictionType: 'transition_beat',
    actions: [
      { type: 'prepare', effect: 'color_shift', intensity: 0.5, durationMs: 1000, timingOffsetMs: -1000 },
      { type: 'execute', effect: 'pulse', intensity: 0.8, durationMs: 500, timingOffsetMs: 0 },
    ],
  },
  
  // Chorus doble → Verse/Breakdown probable (70%)
  {
    trigger: ['chorus', 'chorus'],
    nextSection: 'verse',
    probability: 0.70,
    predictionType: 'transition_beat',
    actions: [
      { type: 'prepare', effect: 'breathe', intensity: 0.6, durationMs: 800, timingOffsetMs: -800 },
    ],
  },
  
  // Drop doble → Breakdown probable (75%)
  {
    trigger: ['drop', 'drop'],
    nextSection: 'breakdown',
    probability: 0.75,
    predictionType: 'breakdown_imminent',
    actions: [
      { type: 'execute', effect: 'intensity_ramp', intensity: 0.3, durationMs: 2000, timingOffsetMs: 0 },
      { type: 'recover', effect: 'breathe', intensity: 0.4, durationMs: 3000, timingOffsetMs: 2000 },
    ],
  },
  
  // Breakdown → Buildup probable (80%)
  {
    trigger: ['breakdown'],
    nextSection: 'buildup',
    probability: 0.80,
    predictionType: 'buildup_starting',
    actions: [
      { type: 'prepare', effect: 'color_shift', intensity: 0.4, durationMs: 500, timingOffsetMs: -500 },
      { type: 'execute', effect: 'intensity_ramp', intensity: 0.5, durationMs: 2000, timingOffsetMs: 0 },
    ],
  },
  
  // Intro → Verse probable (85%)
  {
    trigger: ['intro'],
    nextSection: 'verse',
    probability: 0.85,
    predictionType: 'transition_beat',
    actions: [
      { type: 'execute', effect: 'pulse', intensity: 0.6, durationMs: 300, timingOffsetMs: 0 },
    ],
  },
  
  // Verse doble → Buildup probable (65%)
  {
    trigger: ['verse', 'verse'],
    nextSection: 'buildup',
    probability: 0.65,
    predictionType: 'buildup_starting',
    actions: [
      { type: 'prepare', effect: 'intensity_ramp', intensity: 0.4, durationMs: 1000, timingOffsetMs: -1000 },
    ],
  },
]
```

**NOTE:** These are 1st-order patterns (trigger length 1-2). Cassandra 2.0 needs 2nd-order (trigger length 2 → next). The existing patterns with `trigger: ['buildup', 'buildup']` and `trigger: ['verse', 'buildup']` are already implicitly 2nd-order. The Markov chain would replace ALL of these with a single `Float32Array(10*10*10)` lookup.

### 2B. validatePrediction() — Function signature and logic

```typescript
/**
 * Verifica si una predicción previa fue correcta
 * (para aprendizaje futuro)
 */
export function validatePrediction(
  prediction: MusicalPrediction,
  actualSection: SectionClassification
): boolean {
  return prediction.probableSection === actualSection
}
```

**NOTE:** This is a simple equality check. Cassandra 2.0 should extend this to update the transition matrix counts when a prediction is validated (online learning).

### 2C. predictCombined() — Where structural prediction is queried

```typescript
export function predictCombined(
  pattern: SeleneMusicalPattern,
  currentEnergy: number,
  spectralBuildupScore?: number
): MusicalPrediction {
  // Predicción tradicional por sección
  const sectionPrediction = predict(pattern)
  
  // Predicción reactiva por energía
  const energyPrediction = predictFromEnergy(pattern, currentEnergy, pattern.bpm)
  
  // ... spectral buildup boost logic ...
  
  let bestPrediction: MusicalPrediction
  if (energyPrediction.probability > sectionPrediction.probability) {
    bestPrediction = energyPrediction
  } else {
    bestPrediction = sectionPrediction
  }
  
  // ... spectral boost ...
  
  return bestPrediction
}
```

**Called from:** `src/core/intelligence/SeleneTitanConscious.ts` (line 1093):
```typescript
const spectralBuildupScore = this.calculateSpectralBuildupScore(state)
const prediction = predictCombined(pattern, state.smoothedEnergy, spectralBuildupScore)
```

### 2D. predict() — The core structural prediction function

```typescript
export function predict(pattern: SeleneMusicalPattern): MusicalPrediction {
  const timestamp = pattern.timestamp
  
  // Actualizar historial si cambió de sección
  updateHistory(pattern)
  
  // Buscar patrones de progresión que matcheen
  const matchedPattern = findMatchingPattern()
  
  if (matchedPattern) {
    const { beats: beatsToEvent, ms: estimatedTimeMs } = estimateTimeToEvent(pattern, matchedPattern)
    const adjustedProbability = computeOrganicConfidence(
      matchedPattern.probability,
      pattern,
      matchedPattern
    )
    
    const prediction: MusicalPrediction = {
      type: matchedPattern.predictionType,
      probableSection: matchedPattern.nextSection,
      probability: adjustedProbability,
      estimatedTimeMs,
      estimatedBeats: beatsToEvent,
      reasoning: buildReasoning(matchedPattern, pattern),
      suggestedActions: matchedPattern.actions,
      timestamp,
    }
    
    lastPrediction = prediction
    return prediction
  }
  
  // Sin predicción clara
  const noPrediction: MusicalPrediction = {
    type: 'none',
    probableSection: null,
    probability: 0,
    estimatedTimeMs: 0,
    estimatedBeats: 0,
    reasoning: 'No hay patrón de progresión reconocido',
    suggestedActions: [],
    timestamp,
  }
  
  lastPrediction = noPrediction
  return noPrediction
}
```

### 2E. History storage — Current implementation

```typescript
interface HistoryEntry {
  section: SectionClassification
  timestamp: number
  durationMs: number
  energyLevel: number
}

const MAX_HISTORY = 8
let sectionHistory: HistoryEntry[] = []
let lastPrediction: MusicalPrediction | null = null
```

**Storage type:** Standard JS array (`HistoryEntry[]`), max 8 entries.
**Update mechanism:**
```typescript
function updateHistory(pattern: SeleneMusicalPattern): void {
  const currentSection = pattern.section
  
  if (sectionHistory.length === 0 ||
      sectionHistory[sectionHistory.length - 1].section !== currentSection) {
    
    if (sectionHistory.length > 0) {
      const lastEntry = sectionHistory[sectionHistory.length - 1]
      lastEntry.durationMs = pattern.timestamp - lastEntry.timestamp
    }
    
    sectionHistory.push({
      section: currentSection,
      timestamp: pattern.timestamp,
      durationMs: 0,
      energyLevel: pattern.rhythmicIntensity,
    })
    
    if (sectionHistory.length > MAX_HISTORY) {
      sectionHistory.shift()  // ⚠️ ALLOCATION: shift() reallocates
    }
  }
}
```

**⚠️ ALLOCATION ISSUE:** `sectionHistory.shift()` causes array reallocation. For zero-alloc, Cassandra 2.0 should use a fixed-size `Int8Array(8)` ring buffer storing section indices (0-9), not objects.

### 2F. findMatchingPattern() — Pattern matching logic

```typescript
function findMatchingPattern(): ProgressionPattern | null {
  if (sectionHistory.length === 0) return null
  
  // Ordenar patrones por longitud de trigger (más específicos primero)
  const sortedPatterns = [...PROGRESSION_PATTERNS].sort(
    (a, b) => b.trigger.length - a.trigger.length
  )
  
  for (const pattern of sortedPatterns) {
    if (matchesTrigger(pattern.trigger)) {
      return pattern
    }
  }
  
  return null
}

function matchesTrigger(trigger: SectionClassification[]): boolean {
  if (trigger.length > sectionHistory.length) return false
  
  const recentSections = sectionHistory.slice(-trigger.length)
  
  for (let i = 0; i < trigger.length; i++) {
    if (recentSections[i].section !== trigger[i]) {
      return false
    }
  }
  
  return true
}
```

**⚠️ ALLOCATION ISSUES:**
1. `[...PROGRESSION_PATTERNS].sort(...)` — spreads and sorts every call (allocation + O(n log n))
2. `sectionHistory.slice(-trigger.length)` — allocates a new array every call

---

## 3. Zero-Alloc Injection Point

### 3A. Module-level state (top of PredictionEngine.ts)

The current module uses **module-level `let` variables** (not a class). This is the injection point:

```typescript
// Line 204-206:
const MAX_HISTORY = 8
let sectionHistory: HistoryEntry[] = []
let lastPrediction: MusicalPrediction | null = null
```

**Cassandra 2.0 injection here:**
```typescript
// === CASSANDRA 2.0 MARKOV STATE ===
// 2nd-order transition matrix: P(next | s_{t-1}, s_{t-2})
// 10 states × 10 states × 10 states = 1000 floats = 4KB
// Indexed as: matrix[prev2 * 100 + prev1 * 10 + next]
const SECTION_COUNT = 10
const MARKOV_MATRIX = new Float32Array(SECTION_COUNT * SECTION_COUNT * SECTION_COUNT)
// Initialize with uniform prior (each cell = 1/10 = 0.1)
MARKOV_MATRIX.fill(1.0 / SECTION_COUNT)

// Ring buffer for last 2 section indices (zero-alloc)
// -1 = empty (no observation yet)
let markovPrev2: number = -1  // s_{t-2}
let markovPrev1: number = -1  // s_{t-1}

// Section string → index lookup (frozen, zero-alloc)
const SECTION_INDEX: ReadonlyMap<string, number> = new Map([
  ['intro', 0], ['verse', 1], ['buildup', 2], ['chorus', 3], ['drop', 4],
  ['textural_drop', 5], ['breakdown', 6], ['bridge', 7], ['outro', 8], ['unknown', 9],
])
// Index → string (for output)
const SECTION_NAMES: readonly string[] = [
  'intro', 'verse', 'buildup', 'chorus', 'drop',
  'textural_drop', 'breakdown', 'bridge', 'outro', 'unknown',
]
```

### 3B. resetPredictionEngine() — Reset point

```typescript
export function resetPredictionEngine(): void {
  sectionHistory = []
  lastPrediction = null
  energyHistory = []
  // === CASSANDRA 2.0 RESET ===
  // Option A: Reset to uniform prior (cold start)
  // MARKOV_MATRIX.fill(1.0 / SECTION_COUNT)
  // markovPrev2 = -1
  // markovPrev1 = -1
  // Option B: Keep learned matrix, only reset history
  // markovPrev2 = -1
  // markovPrev1 = -1
}
```

### 3C. updateHistory() — Observation ingestion point

The current `updateHistory()` is called from `predict()` on every section change. Cassandra 2.0 should hook here to:
1. Convert the new section string to an index
2. If `markovPrev1 >= 0 && markovPrev2 >= 0`: increment `MARKOV_MATRIX[markovPrev2 * 100 + markovPrev1 * 10 + newIndex]`
3. Shift: `markovPrev2 = markovPrev1; markovPrev1 = newIndex`

### 3D. predict() — Prediction query point

Replace `findMatchingPattern()` with a direct matrix lookup:
1. If `markovPrev1 < 0 || markovPrev2 < 0`: return null (insufficient history)
2. Read the row: `baseOffset = markovPrev2 * 100 + markovPrev1 * 10`
3. Find argmax over `MARKOV_MATRIX[baseOffset..baseOffset+9]`
4. Map index back to section name
5. Probability = `MARKOV_MATRIX[baseOffset + argmax]` (normalized)

### 3E. SeleneTitanConscious.ts — Consumer

**File:** `src/core/intelligence/SeleneTitanConscious.ts` (line 1093)

```typescript
const prediction = predictCombined(pattern, state.smoothedEnergy, spectralBuildupScore)
```

This is the single call site. `predictCombined` calls `predict()` internally. No changes needed here if `predict()` signature stays the same.

---

## 4. PredictionType Enum (for reference)

```typescript
export type PredictionType =
  | 'drop_incoming'      // Drop inminente
  | 'buildup_starting'   // Buildup empezando
  | 'breakdown_imminent' // Breakdown cercano
  | 'transition_beat'    // Transición de sección
  | 'energy_spike'       // Pico de energía
  | 'energy_drop'        // Caída de energía
  | 'section_change'     // Cambio de sección genérico
  | 'none'               // Sin predicción
```

## 5. MusicalPrediction Interface (output contract — must be preserved)

```typescript
export interface MusicalPrediction {
  type: PredictionType
  probableSection: SectionClassification | null
  probability: number
  estimatedTimeMs: number
  estimatedBeats: number
  reasoning: string
  suggestedActions: PredictionAction[]
  timestamp: number
}
```

**⚠️ NOTE:** `probableSection` is typed as `SectionClassification` (7 states) but the MSST produces 10 states. Cassandra 2.0 should either:
- Widen `SectionClassification` to include `textural_drop`, `bridge`, `unknown`, OR
- Map MSST 10-state output to `SectionClassification` 7-state before storing in history

---

## 6. Summary — Key Numbers for Cassandra 2.0

| Parameter | Value |
|---|---|
| State alphabet size | **10** (MSST_SECTION_KEYS) |
| Markov order | **2nd** (P(next \| prev2, prev1)) |
| Transition matrix size | `10 × 10 × 10 = 1000` cells |
| Matrix storage | `Float32Array(1000)` = **4 KB** |
| History ring buffer | `Int8Array(8)` or 2 scalar vars (prev2, prev1) |
| Total zero-alloc footprint | **~4 KB** (matrix) + negligible (history) |
| Injection point | Top of `PredictionEngine.ts`, replacing `sectionHistory` + `PROGRESSION_PATTERNS` |
| Prediction query | O(10) scan over `MARKOV_MATRIX[baseOffset..baseOffset+9]` |
| Observation update | O(1) increment of `MARKOV_MATRIX[baseOffset + newIndex]` |
| Normalization | Lazy: normalize row on read, or batch-normalize every N observations |

---

## 7. Files Touched (for reference, do NOT modify yet)

| File | Role |
|---|---|
| `src/core/intelligence/think/PredictionEngine.ts` | **PRIMARY** — contains legacy logic, injection point, output contract |
| `src/core/intelligence/types.ts` | `SectionClassification` (7-state, may need widening) |
| `src/core/intelligence/memory/ContextualMemory.ts` | `SectionType` (10-state, matches MSST) |
| `src/workers/TrinityBridge.ts` | `SectionOutput['type']` + `MSST_SECTION_KEYS` (ground truth) |
| `src/core/intelligence/SeleneTitanConscious.ts` | Consumer of `predictCombined()` (line 1093) |
| `src/core/intelligence/think/index.ts` | Re-exports `predict`, `predictCombined`, `predictFromEnergy` |
| `src/engine/musical/context/PredictionMatrix.ts` | **LEGACY** parallel implementation (EventEmitter-based, not in hot path) |
