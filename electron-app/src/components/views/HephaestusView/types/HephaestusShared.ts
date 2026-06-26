import type { HephAutomationClipV3 } from '../../../../core/hephaestus/types'

export interface HephViewport {
  startMs: number
  endMs: number
  minVal: number
  maxVal: number
}

export interface TemporalActions {
  snapshot: () => void
  undo: () => void
  redo: () => void
  resetWithClip: (clip: HephAutomationClipV3) => void
  setViewport: (vp: HephViewport) => void
}
