/**
 * 🎣 HOOKS
 * Exportaciones centralizadas de React hooks
 */

export { useSelene, useSeleneColor, useSeleneAudio, useSeleneDimmer } from './useSelene'
export type { SeleneState, UseSeleneReturn } from './useSelene'

export { useAudioCapture } from './useAudioCapture'
export type { AudioMetrics, UseAudioCaptureReturn } from './useAudioCapture'

// 🌙 WAVE 25: Universal Truth Protocol
export { 
  useSeleneTruth,
  useTruthAudio,
  useTruthBeat,
  useTruthPalette,
  useTruthGenre,
  useTruthSection,
  useTruthRhythm,
  useTruthPrediction,
  useTruthCognitive,
  useTruthSystem,
  useTruthMovement,
  useTruthEffects,      // 🌙 WAVE 25.5
  useTruthColorParams,  // 🌙 WAVE 25.5
  useTruthConnected,
  useTruthFPS,
  // 🧠 WAVE 25.6: Cognitive Hooks
  useTruthSensory,
  useTruthMusicalDNA,
  useTruthHardware,
} from './useSeleneTruth'
