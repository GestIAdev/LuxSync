/**
 * 🎬 WAVE 4860 — THEIA ENGINE BARREL
 *
 * Phase 1 exports: orquestación e infraestructura. Sin lógica de vídeo.
 */

export {
  createFrameContextSAB,
  FrameContextReader,
  FrameContextWriter,
  FRAME_CONTEXT_BYTE_LENGTH,
  FRAME_CONTEXT_INT32_LENGTH,
  type FrameContextSnapshot,
} from './FrameContextRing'

export {
  makeThetaMessage,
  type TheiaAssetStateId,
  type ThetaAssetStatePayload,
  type ThetaErrorPayload,
  type ThetaForceStatePayload,
  type ThetaHeartbeatAckPayload,
  type ThetaHeartbeatPayload,
  type ThetaInitPayload,
  type ThetaMessage,
  type ThetaMessageType,
  type ThetaStateReportPayload,
} from './protocol'

export { ThetaOrchestrator, getThetaOrchestrator, ENABLE_THETA_ORCHESTRATOR, type ThetaOrchestratorConfig } from './ThetaOrchestrator'

// 🎬 WAVE 4864 / 🌊 WAVE 8215 — transferable frame buffers (Glass Bridge)
export {
  createVideoFrameBuffer,
  readVideoFrame,
  VideoFrameWriter,
  THEIA_VIDEO_FRAME_MSG,
  isVideoFrameMessage,
  isAckMessage,
  VIDEO_MAX_WIDTH,
  VIDEO_MAX_HEIGHT,
  VIDEO_FRAME_BUFFER_BYTES,
  VIDEO_META_BYTES,
  type VideoFrameSnapshot,
  type TheiaVideoFrameMessage,
  type TheiaAckMessage,
} from './SharedVideoFrameBuffer'

// 🌊 WAVE 8215 — Glass Bridge page-world relay + telemetry ring (Modo B)
export {
  onTheiaGlassMessage,
  requestTheiaPort,
  type TheiaGlassMessage,
  type TheiaGlassPortKind,
} from './glassBridge'

export {
  ackTelemetryFrame,
  createTelemetryRing,
  isTelemetryMessage,
  mirrorTelemetryIntoRing,
  THEIA_TELEMETRY_MSG,
  TELEMETRY_RING_BYTES,
  type TheiaTelemetryMessage,
  type TheiaTelemetryAck,
} from './TheiaTelemetryRing'

// 🔮 WAVE 8226 — Euclid Oracle · Fase E0: telemetry ring core (seqlock 256B).
// Namespaced: `createTelemetryRing`/`TELEMETRY_RING_BYTES` ya pertenecen al
// contrato de transporte Glass Bridge de arriba.
export * as EuclidTelemetry from './telemetry/TheiaTelemetryRing'

// 🔮 WAVE 8228 — Euclid Oracle · Fase E2: Uniform Bridge & Smoother
// (worker-side; isomórfico y testeable en Node).
export { TelemetrySmoother } from './telemetry/TelemetrySmoother'

// 🔮 WAVE 8229 — Euclid Oracle · Fase E3: Shader Contract & Assembler
export {
  assembleFragmentShader,
  buildPreamble,
  buildEpilogue,
  remapShaderLog,
  parseStepsHint,
  hasMainImage,
  hashSource,
  GEN_VERTEX_SRC,
  BLIT_VERTEX_SRC,
  BLIT_FRAG_SRC,
  FLASH_STATS_FRAG_SRC,
  EUCLID_GLSL_VERSION,
  DEFAULT_MAX_STEPS,
  DEFAULT_FLASH_MAX_DELTA,
  FLASH_BUDGET,
  FLASH_BUDGET_RATE,
  parseEuclidMeta,
  resolveGeneValues,
  geneSignature,
  buildGeneDefines,
  glslFloatLiteral,
  hashSourceU32,
  layoutExprGenes,
  exprGeneValues,
  structGenesDiffer,
  EUCLID_GENE_SLOTS,
  type AssembledShader,
  type RemappedLog,
  type EuclidMeta,
  type EuclidParam,
  type EuclidGene,
} from './shader/ShaderAssembler'

// 🧬 WAVE 8234 — Infinite Genome · Fase G2: Expander + Pool de variantes
export {
  expandGenome,
  retroprojectDna,
  geneUniform,
  pcg32,
  coreDna,
  expressGene,
  tOfGeneValue,
  genomeIdU32,
  RETROJECTION_KAPPA,
  type GenomeDNA,
  type ExpandedPhenotype,
} from './genome/GenomeExpander'
export {
  spawnGenomeVariant,
  spawnCrossoverVariant,
  buildVariantAtom,
  atomIdForGenome,
  resetGenomePool,
  type SpawnResult,
} from './genome/GenomePool'

// 🧬 WAVE 8235 — Infinite Genome · Fase G3: crossover + mutación §4.6
export {
  crossoverGenome,
  genomeChildSeed,
  CROSS_MUT_BASE,
  CROSS_MUT_CHAOS,
  CROSS_MUT_DISP,
} from './genome/GenomeExpander'
export {
  GenomeEvolver,
  getGenomeEvolver,
  GENOME_PHRASE_BARS,
  GENOME_APPROACH_GATE,
  GENOME_MUTATE_BARS,
} from './genome/GenomeEvolver'

// 🔮 WAVE 8230 — Euclid Oracle · Fase E4: átomo generativo builtin
export {
  ORACLE_KIFS_SOURCE,
  ORACLE_KIFS_ATOM_ID,
  EUCLID_PACK_ID,
  buildOracleKifsAtom,
} from './shader/atoms/oracleKifs'
export { ensureEuclidShaderAtoms } from './shader/atoms'
export {
  RenderGovernor,
  GOVERNOR_DEFAULTS,
  type GovernorConfig,
} from './shader/RenderGovernor'

export {
  AssetStateMachine,
  type AssetStateId,
  type TransitionResult,
} from './AssetStateMachine'

export {
  CrossfadeUnit,
  type CrossfadeCurve,
  type CrossfadeState,
  type CrossfadeStartOptions,
  type CrossfadeStep,
} from './CrossfadeUnit'

// 🎬 WAVE 4867 — Phase 6: Thumb SAB (64×64 RGBA8) for twin-output LED/DMX bridge
export {
  createThumbSAB,
  ThumbFrameWriter,
  ThumbFrameReader,
  THUMB_W,
  THUMB_H,
  THUMB_PIXELS,
  THUMB_RGBA_BYTES,
  THUMB_SAB_BYTE_LENGTH,
} from './TheiaThumbBuffer'

// 🌉 WAVE 4869 — SeleneTheiaBridge: Observer cognitivo Selene → ThetaOrchestrator
export {
  SeleneTheiaBridge,
  getSeleneTheiaBridge,
  type BrainFrameContext,
} from './SeleneTheiaBridge'
