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
  type ThetaErrorPayload,
  type ThetaHeartbeatAckPayload,
  type ThetaHeartbeatPayload,
  type ThetaInitPayload,
  type ThetaMessage,
  type ThetaMessageType,
  type ThetaStateReportPayload,
} from './protocol'

export { ThetaOrchestrator, getThetaOrchestrator, type ThetaOrchestratorConfig } from './ThetaOrchestrator'
