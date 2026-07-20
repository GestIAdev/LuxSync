import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  TRANSITION_DURATION_MS,
  getCrossfadeOpacities,
  getTransitionPair,
  lerpCamera,
  type CameraKeyframe,
} from './ProjectionLerp'

// ═══════════════════════════════════════════════════════════════════════════
// ViewTransitionDirector — El Coreógrafo
// PROYECTO EREBUS FASE 5
//
// Orquesta la transición cinematográfica 2D↔3D de 600ms.
// Gobierna:
//   - isTransitioning: boolean
//   - transitionProgress: 0→1 (raw, before easing)
//   - currentCamera: CameraKeyframe interpolada (para R3F useFrame)
//   - opacity3D / opacity2D: crossfade values
//
// Durante la transición, ambos lienzos coexisten superpuestos.
// Al terminar, se desmonta el lienzo inactivo.
// ═══════════════════════════════════════════════════════════════════════════

export type TransitionDirection = '3d-to-2d' | '2d-to-3d'

export interface TransitionState {
  /** Whether a transition is currently in progress */
  isTransitioning: boolean
  /** Raw progress 0→1 (not yet eased) */
  transitionProgress: number
  /** Direction of current transition */
  direction: TransitionDirection | null
  /** Interpolated camera keyframe (for R3F useFrame consumption) */
  currentCamera: CameraKeyframe | null
  /** Opacity for the 3D canvas (0→1) */
  opacity3D: number
  /** Opacity for the 2D canvas (0→1) */
  opacity2D: number
  /** Whether the 3D canvas should be mounted */
  mount3D: boolean
  /** Whether the 2D canvas should be mounted */
  mount2D: boolean
}

export interface ViewTransitionDirectorApi extends TransitionState {
  /** Trigger a transition to the target view mode */
  transitionTo: (target: '3d' | '2d') => void
  /** Get the latest camera keyframe (for useFrame inside R3F) */
  getCameraKeyframe: () => CameraKeyframe | null
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * useViewTransition — React hook that manages transition state.
 *
 * @param currentView The current view mode ('3d' | '2d')
 * @param onViewChange Callback when transition completes (to update parent state)
 */
export function useViewTransition(
  currentView: '3d' | '2d',
  onViewChange: (view: '3d' | '2d') => void,
): ViewTransitionDirectorApi {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionProgress, setTransitionProgress] = useState(0)
  const [direction, setDirection] = useState<TransitionDirection | null>(null)
  const [settledView, setSettledView] = useState<'3d' | '2d'>(currentView)

  // Refs for animation loop (avoid re-renders during RAF)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const directionRef = useRef<TransitionDirection | null>(null)
  const targetViewRef = useRef<'3d' | '2d'>('3d')
  const cameraRef = useRef<CameraKeyframe | null>(null)
  const currentViewRef = useRef<'3d' | '2d'>(currentView)

  // Keep currentViewRef in sync
  useEffect(() => {
    currentViewRef.current = currentView
  }, [currentView])

  // ── Transition trigger ───────────────────────────────────────────────────
  const transitionTo = useCallback(
    (target: '3d' | '2d') => {
      const from = currentViewRef.current
      if (from === target) return

      const dir: TransitionDirection = from === '3d' ? '3d-to-2d' : '2d-to-3d'
      directionRef.current = dir
      targetViewRef.current = target
      startTimeRef.current = performance.now()

      setDirection(dir)
      setIsTransitioning(true)
      setTransitionProgress(0)

      // Initialize camera at the 'from' keyframe
      const { from: fromKF } = getTransitionPair(dir)
      cameraRef.current = fromKF
    },
    [],
  )

  // ── Animation loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTransitioning || !direction) return

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current
      const rawProgress = Math.min(elapsed / TRANSITION_DURATION_MS, 1)

      setTransitionProgress(rawProgress)

      // Update camera keyframe
      const dir = directionRef.current
      if (dir) {
        const { from, to } = getTransitionPair(dir)
        cameraRef.current = lerpCamera(from, to, rawProgress)
      }

      if (rawProgress >= 1) {
        // Transition complete — update settledView synchronously to avoid mount flash
        setSettledView(targetViewRef.current)
        setIsTransitioning(false)
        setDirection(null)
        setTransitionProgress(0)
        cameraRef.current = null
        directionRef.current = null
        onViewChange(targetViewRef.current)
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isTransitioning, direction, onViewChange])

  // ── Compute crossfade opacities ──────────────────────────────────────────
  const { opacity3D, opacity2D } = getCrossfadeOpacities(
    direction ?? '3d-to-2d',
    transitionProgress,
  )

  // ── Mount logic ──────────────────────────────────────────────────────────
  // During transition: both canvases mounted
  // After transition: only the target canvas mounted (using settledView, not currentView prop,
  // to avoid a one-frame flash where currentView hasn't propagated yet)
  const mount3D = isTransitioning
    ? true // both during transition
    : settledView === '3d'

  const mount2D = isTransitioning
    ? true // both during transition
    : settledView === '2d'

  // ── getCameraKeyframe getter ─────────────────────────────────────────────
  const getCameraKeyframe = useCallback(() => cameraRef.current, [])

  return {
    isTransitioning,
    transitionProgress,
    direction,
    currentCamera: cameraRef.current,
    opacity3D,
    opacity2D,
    mount3D,
    mount2D,
    transitionTo,
    getCameraKeyframe,
  }
}

// ── Component wrapper (for mounting inside R3F <Canvas>) ───────────────────

/**
 * CameraLerpController — mounts inside <Canvas> and applies the interpolated
 * camera transform every frame during a transition.
 *
 * Usage: <CameraLerpController getCameraKeyframe={...} isTransitioning={...} />
 */
export { CameraLerpController }

import { useFrame, useThree } from '@react-three/fiber'

interface CameraLerpControllerProps {
  getCameraKeyframe: () => CameraKeyframe | null
  isTransitioning: boolean
}

function CameraLerpController({ getCameraKeyframe, isTransitioning }: CameraLerpControllerProps) {
  const { camera } = useThree()

  useFrame(() => {
    if (!isTransitioning) return
    const kf = getCameraKeyframe()
    if (!kf) return

    camera.position.copy(kf.position)
    camera.lookAt(kf.target)

    // Update FOV if it's a perspective camera
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const pCam = camera as THREE.PerspectiveCamera
      pCam.fov = kf.fov
      pCam.updateProjectionMatrix()
    }
  })

  return null
}
