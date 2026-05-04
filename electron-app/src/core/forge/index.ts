/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE NODE GRAPH — PUBLIC API
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.2: Barrel export for the Forge Node Graph kernel.
 *
 * @module core/forge
 * @version WAVE 4548.2
 */

// ── Types ────────────────────────────────────────────────────────────────
export type {
  ForgeNodeId,
  ForgePortId,
  ForgeEdgeId,
  ForgeDataType,
  IForgePort,
  ForgeNodeCategory,
  ForgeNodeType,
  IForgeNodeConfig,
  IInputDmxConfig,
  IInputAudioBandConfig,
  IInputConstantConfig,
  IProcLfoConfig,
  IProcSmoothConfig,
  IProcMapRangeConfig,
  IProcMathConfig,
  IProcClampConfig,
  IProcDelayConfig,
  IProcMergeConfig,
  IProcCurveConfig,
  ILogicThresholdConfig,
  ILogicCounterConfig,
  ILogicSwitchConfig,
  IOutputDmxConfig,
  ICompoundIngenioConfig,
  IEmptyConfig,
  IForgeNode,
  IForgeEdge,
  ForgeGraphMeta,
  IForgeNodeGraph,
  FixtureDefinitionV2,
  ForgeValidationErrorCode,
  ForgeValidationError,
} from './types'

// ── Builder ──────────────────────────────────────────────────────────────
export { NodeGraphBuilder } from './NodeGraphBuilder'

// ── Compiler (Patch Time) ────────────────────────────────────────────────
export { ForgeGraphCompiler } from './compiler/ForgeGraphCompiler'
export { AUDIO_BAND_INDEX } from './compiler/ForgeGraphCompiler'
export type {
  CompiledForgeGraph,
  CompiledInstruction,
  CompiledOutput,
  ForgeFrameContext,
  MutableForgeFrameContext,
} from './compiler/types'
export { DEFAULT_FORGE_FRAME_CONTEXT } from './compiler/types'

// ── Evaluator (Hot-Path) ─────────────────────────────────────────────────
export { ForgeNodeEvaluator } from './evaluator/ForgeNodeEvaluator'
export { OPCODE_TABLE } from './evaluator/opcodes'
export type { OpcodeFn } from './evaluator/opcodes'
