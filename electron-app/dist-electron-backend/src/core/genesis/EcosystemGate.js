// ═══════════════════════════════════════════════════════════════════════════
// 🔒 ECOSYSTEM GATE — UX HOTFIX: master switch state for the Genesis lab
// ═══════════════════════════════════════════════════════════════════════════
//  Single source of truth for "is the laboratory open".
//
//  WHY A SEPARATE MODULE: the spawn pipeline (ColiseumService) and the
//  live-fire path (EffectManager) must consult this flag, but they cannot
//  import it from GenesisIgnition — GenesisIgnition already imports
//  ColiseumService, so that arrow would close a dependency cycle.
//  A zero-import state module keeps the graph acyclic:
//    EcosystemGate ← GenesisIgnition, ColiseumService, EffectManager
//
//  WRITE DISCIPLINE: only GenesisIgnition (pause/resume) may write this flag.
//  Everything else is a reader.
// ═══════════════════════════════════════════════════════════════════════════
// 🔒 WAVE 7527 semantics preserved: the ecosystem boots PAUSED — OPT-IN per
// session. The operator must explicitly press "▶ START ECOSYSTEM" in the
// Genesis Lab.
let _genesisPaused = true;
/**
 * True while the ecosystem is OFF. When true, NO DNA generation is allowed —
 * no cohorts, no mitosis children, no hybrids — and live triggers fall back
 * to the factory .lfx blueprint.
 */
export function isGenesisPaused() {
    return _genesisPaused;
}
/**
 * Flips the master switch. Called ONLY by GenesisIgnition.pauseGenesisEngine()
 * and resumeGenesisEngine() — never by consumers of the spawn pipeline.
 */
export function setGenesisPaused(paused) {
    _genesisPaused = paused;
}
