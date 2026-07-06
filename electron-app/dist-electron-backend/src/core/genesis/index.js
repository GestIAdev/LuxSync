// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — Genesis Engine — Barrel Export (Era I + II + III + IV + V)
// ═══════════════════════════════════════════════════════════════════════════
// Era I — Cold Infrastructure
export { GenesisVaultService, getGenesisVault, __resetGenesisVaultForTests } from './GenesisVaultService';
export { AncestralIngestor, getAncestralIngestor, __resetAncestralIngestorForTests } from './AncestralIngestor';
// Era II — The Coliseum Awakens
export { pointMutation, geneDuplication, phaseEpigenetics, temporalStretch, geneSplice, geneDeletion, interpolationDrift, crossover, blendCognitiveDNA, applyOperator, applyDelta, makeFatTailedRng, computeL2DistanceV2, } from './operators/GeneticOperators';
export { prenatalScreening } from './screening/PrenatalScreening';
export { OrganismMaterializer, getOrganismMaterializer, __resetOrganismMaterializerForTests } from './OrganismMaterializer';
export { ColiseumService, getColiseumService, __resetColiseumServiceForTests } from './ColiseumService';
// Era III — Loot System & Passive Fitness
export { computeRarity, computeRaritySimple, tierFromScore, DRIFT_MAX, OPERATOR_WEIGHTS, NEONATAL_SHIELD, RARITY_BONUS, } from './loot/RarityEngine';
export { evaluateCustoms, evaluateContext, computeDeltaF, applyEMA, computeBirthFitness, updateFitnessInDB, evaluateFireEvent, } from './fitness/FitnessEvaluator';
export { HeatmapLogger, getHeatmapLogger, __resetHeatmapLoggerForTests } from './fitness/HeatmapLogger';
// Era IV — Speciation & Lifecycle Transitions
export { SpeciationEngine, getSpeciationEngine, __resetSpeciationEngineForTests } from './ecology/SpeciationEngine';
export { LifecycleManager, getLifecycleManager, __resetLifecycleManagerForTests } from './ecology/LifecycleManager';
export { SpeciesQuotaSelector, getSpeciesQuotaSelector, __resetSpeciesQuotaSelectorForTests } from './ecology/SpeciesQuotaSelector';
// Era V — The Operator's Mirror (IPC + UI)
export { setupGenesisIPCHandlers } from './genesisIpc';
// Era VI — The Lamarckian Medium (Geological Loop Ignition)
export { igniteGenesisEngine, shutdownGenesisEngine } from './GenesisIgnition';
// Era V Addendum — Procedural Naming Engine
export { generateOrganismName, COMBINATORIAL_SPACE } from './naming/ProceduralNamer';
