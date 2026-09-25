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
