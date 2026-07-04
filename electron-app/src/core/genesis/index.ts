// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — Genesis Engine — Barrel Export (Era I + II + III)
// ═══════════════════════════════════════════════════════════════════════════

// Era I — Cold Infrastructure
export { GenesisVaultService, getGenesisVault, __resetGenesisVaultForTests } from './GenesisVaultService'
export { AncestralIngestor, getAncestralIngestor, __resetAncestralIngestorForTests } from './AncestralIngestor'

// Era II — The Coliseum Awakens
export {
  pointMutation,
  geneDuplication,
  phaseEpigenetics,
  applyOperator,
  applyDelta,
} from './operators/GeneticOperators'
export type { JsonPatchOp, OperatorResult } from './operators/GeneticOperators'

export { prenatalScreening } from './screening/PrenatalScreening'
export type { PrenatalGateResult, ScreeningResult, GateId, GateStatus } from './screening/PrenatalScreening'

export { OrganismMaterializer, getOrganismMaterializer, __resetOrganismMaterializerForTests } from './OrganismMaterializer'
export type { MaterializedOrganism } from './OrganismMaterializer'

export { ColiseumService, getColiseumService, __resetColiseumServiceForTests } from './ColiseumService'
export type { SpawnResult } from './ColiseumService'

// Era III — Loot System & Passive Fitness
export {
  computeRarity,
  computeRaritySimple,
  tierFromScore,
  DRIFT_MAX,
  OPERATOR_WEIGHTS,
  NEONATAL_SHIELD,
  RARITY_BONUS,
} from './loot/RarityEngine'
export type { RarityInput, RarityOutput } from './loot/RarityEngine'

export {
  evaluateCustoms,
  evaluateContext,
  computeDeltaF,
  applyEMA,
  computeBirthFitness,
  updateFitnessInDB,
  evaluateFireEvent,
} from './fitness/FitnessEvaluator'
export type { FitnessUpdate, CustomsEvaluation, HeatmapContext } from './fitness/FitnessEvaluator'

export { HeatmapLogger, getHeatmapLogger, __resetHeatmapLoggerForTests } from './fitness/HeatmapLogger'
export type { FireEvent, HeatmapLoggerStats } from './fitness/HeatmapLogger'

export type {
  RarityTier,
  OrganismStatus,
  MutationOperator,
  SourceOrigin,
  ContextVector6D,
  LfxBlueprint,
  LfxOrganism,
  BlueprintRow,
  BlueprintInsertPayload,
  IngestionReport,
} from './types'
