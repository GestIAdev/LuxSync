# 🗺️ MUSICAL CONTEXT DEPENDENCY MAP

## 🚨 CRITICAL LEGACY FIELDS

### `zScore` Usage:
- [x] Used in `src/engine/TitanEngine.ts` (Line 1223) - Purpose: Debug info fallback for energy Z-score
- [x] Used in `src/core/intelligence/think/FuzzyDecisionMaker.ts` (Lines 303, 419, 425, 431, 453, 481, 515, 974) - Purpose: Fuzzy logic antecedents for energy zones (epic, notable, normal), decision making with Z-score thresholds
- [x] Used in `src/core/intelligence/think/DropBridge.ts` (Lines 154, 156, 185, 214, 249, 250) - Purpose: Drop detection with Z-score thresholds, excess calculation
- [x] Used in `src/core/intelligence/SeleneTitanConscious.ts` (Line 630) - Purpose: Memory output stats tracking
- [x] Used in `src/core/intelligence/integration/DreamEngineIntegrator.ts` (Lines 461, 462) - Purpose: Builder integration with Z-score context
- [x] Used in `src/tests/EnergyConsciousnessTest.ts` (Multiple lines) - Purpose: Test scenarios with Z-score values
- [x] Used in `src/tests/DiversityStressTest.ts` (Multiple lines) - Purpose: Stress test scenarios

### `vibeId` Usage:
- [x] Used in `src/workers/senses.ts` (Lines 1098, 1099) - Purpose: Setting vibe for SectionTracker
- [x] Used in `src/workers/mind.ts` (Lines 461, 462) - Purpose: Setting active vibe state
- [x] Used in `src/hooks/useSeleneVibe.ts` (Lines 124, 126, 127, 144, 146) - Purpose: Vibe state management and updates
- [x] Used in `src/core/intelligence/think/HuntEngine.ts` (Lines 376, 377, 437, 761, 797, 800) - Purpose: Vibe-based weighting for hunt decisions, scoring thresholds
- [x] Used in `src/core/intelligence/think/DecisionMaker.ts` (Lines 386, 556, 557) - Purpose: Pattern vibe identification, silence decision reasoning
- [x] Used in `src/core/intelligence/SeleneTitanConscious.ts` (Lines 779, 926, 963) - Purpose: Divine arsenal selection, chill vibe detection

## 🧬 DNA CONNECTION

**Does EffectDNA use zScore?** [NO DIRECT USAGE]
- EffectDNA.ts does NOT directly reference zScore
- EffectDNA uses Mood and SectionType from protocol, but no zScore dependency found

**How is zScore used in the system?**
- **Energy Classification**: Z-score drives energy zone detection (normal=1.5σ, epic=2.8σ, divine=4.0σ+)
- **Drop Detection**: Critical threshold for identifying musical drops
- **Fuzzy Logic**: Antecedents in decision making (epic × section.peak, notable × building, etc.)
- **Hunt Engine**: Beauty, urgency, and consonance scoring multipliers based on vibe

## 📦 IMPORT FRACTURE

### Files using Legacy (`effects/types`):
- `src/core/effects/ContextualEffectSelector.ts` (Line 34) - Imports `MusicalContext` from `./types`

### Files using Official (`protocol/MusicalContext`):
- `src/workers/mind.ts`
- `src/tests/EnergyConsciousnessTest.ts`
- `src/core/orchestrator/EventRouter.ts`
- `src/core/orchestrator/TitanOrchestrator.ts`
- `src/engine/TitanEngine.ts`
- `src/core/intelligence/think/FuzzyDecisionMaker.ts`
- `src/core/intelligence/think/DecisionMaker.ts`
- `src/core/intelligence/EnergyLogger.ts`
- `src/core/intelligence/EnergyConsciousnessEngine.ts`
- `src/core/intelligence/dream/EffectDreamSimulator.ts`
- `src/core/intelligence/dna/EffectDNA.ts`
- `src/core/intelligence/dream/AudienceSafetyContext.ts`
- `src/core/effects/ContextualEffectSelector.ts` (also imports EnergyZone, SpectralContext)
- `src/core/calibration/SeleneBrainAdapter.ts`
- `src/engine/color/ColorLogic.ts`

## ⚖️ GAP ANALYSIS: Legacy vs Official

### Fields MISSING in Official Protocol:
- `zScore: number` - Critical for energy classification and drop detection
- `vibeId: string` - Essential for vibe-based effect filtering and hunt decisions
- `inDrop?: boolean` - Direct drop state (vs inferred from energy zones)

### Fields in Official but NOT in Legacy:
- `key: MusicalKey | null` - Harmonic analysis
- `mode: MusicalMode` - Major/minor detection
- `syncopation: number` - Rhythmic complexity
- `section: SectionContext` - Structural analysis
- `mood: Mood` - Emotional classification
- `genre: GenreContext` - Genre classification
- `spectral?: SpectralContext` - FFT spectral data
- `narrative?: NarrativeContext` - Story arc analysis
- `confidence: number` - Analysis reliability

## ⚖️ MIGRATION STRATEGY

Based on findings, we have **CRITICAL DEPENDENCIES** that prevent simple unification:

**A) Add Legacy Fields to Official Protocol?**
- ✅ **RECOMMENDED**: zScore and vibeId are system-critical
- ✅ Maintains existing logic without breaking changes
- ✅ EffectDNA can remain unchanged
- ⚠️ Protocol becomes "bloated" but functional

**B) Refactor Code to Use Official Fields?**
- ❌ **NOT FEASIBLE**: zScore drives core energy classification
- ❌ Would require massive FuzzyDecisionMaker rewrite
- ❌ HuntEngine vibe logic deeply integrated
- ❌ Risk of breaking drop detection and effect selection

**C) Hybrid Approach:**
- Add zScore/vibeId to Official Protocol as **LEGACY COMPATIBILITY FIELDS**
- Mark as deprecated with migration path
- Gradually refactor consumers to use official fields
- EffectDNA remains stable during transition

**CONCLUSION: Option A (Extend Official Protocol) is the only safe path forward.**