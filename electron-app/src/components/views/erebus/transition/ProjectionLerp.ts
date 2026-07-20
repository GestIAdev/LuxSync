import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// ProjectionLerp — Matemática de Cámara para Transición 2D↔3D
// PROYECTO EREBUS FASE 5
//
// Interpola la cámara R3F durante 600ms (ease-in-out) entre:
//   - Vista orbital de trabajo (3D): posición [8, 6, 12], fov 50°
//   - Vista cenital ortográfica (2D): posición [6, 20, 4], mirando -Y, fov 1°
//
// 3D → 2D: ascender, rotar pitch hacia abajo hasta cenital puro, estrechar FOV
// 2D → 3D: inverso — descender, recuperar ángulo de trabajo y perspectiva
//
// El FOV extremo (1°) emula proyección ortográfica sin cambiar el tipo de cámara.
// ═══════════════════════════════════════════════════════════════════════════

// ── Camera keyframes ───────────────────────────────────────────────────────

export interface CameraKeyframe {
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
}

/** Working 3D view — orbital perspective */
export const VIEW_3D: CameraKeyframe = {
  position: new THREE.Vector3(8, 6, 12),
  target: new THREE.Vector3(6, 0, 4),
  fov: 50,
}

/** Top-down cenital — emulates orthographic by using tiny FOV from high altitude */
export const VIEW_2D: CameraKeyframe = {
  position: new THREE.Vector3(6, 20, 4),
  target: new THREE.Vector3(6, 0, 4),
  fov: 1,
}

// ── Easing ─────────────────────────────────────────────────────────────────

/**
 * Ease-in-out (cubic) — smooth acceleration and deceleration.
 * t=0 → 0, t=1 → 1, derivative zero at both ends (no jerks).
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ── Transition duration ────────────────────────────────────────────────────

export const TRANSITION_DURATION_MS = 600

// ── Lerp logic ─────────────────────────────────────────────────────────────

/**
 * Interpolate between two camera keyframes.
 *
 * @param from Starting keyframe
 * @param to Ending keyframe
 * @param rawProgress Raw progress 0→1 (will be eased)
 * @returns Interpolated camera state (position, target, fov)
 */
export function lerpCamera(
  from: CameraKeyframe,
  to: CameraKeyframe,
  rawProgress: number,
): CameraKeyframe {
  const t = easeInOutCubic(Math.max(0, Math.min(1, rawProgress)))

  const position = new THREE.Vector3().lerpVectors(from.position, to.position, t)
  const target = new THREE.Vector3().lerpVectors(from.target, to.target, t)
  const fov = THREE.MathUtils.lerp(from.fov, to.fov, t)

  return { position, target, fov }
}

/**
 * Get the appropriate keyframe pair for a transition direction.
 *
 * @param direction '3d-to-2d' or '2d-to-3d'
 * @returns { from, to } keyframes
 */
export function getTransitionPair(
  direction: '3d-to-2d' | '2d-to-3d',
): { from: CameraKeyframe; to: CameraKeyframe } {
  return direction === '3d-to-2d'
    ? { from: VIEW_3D, to: VIEW_2D }
    : { from: VIEW_2D, to: VIEW_3D }
}

/**
 * Compute the crossfade opacity for each canvas given transition progress.
 *
 * 3D → 2D:
 *   - 3D canvas: opacity goes 1 → 0 (fade out)
 *   - 2D canvas: opacity goes 0 → 1 (fade in)
 *
 * 2D → 3D:
 *   - 2D canvas: opacity goes 1 → 0 (fade out)
 *   - 3D canvas: opacity goes 0 → 1 (fade in)
 *
 * @param direction Transition direction
 * @param rawProgress Raw progress 0→1
 * @returns { opacity3D, opacity2D } both 0→1
 */
export function getCrossfadeOpacities(
  direction: '3d-to-2d' | '2d-to-3d',
  rawProgress: number,
): { opacity3D: number; opacity2D: number } {
  const t = easeInOutCubic(Math.max(0, Math.min(1, rawProgress)))

  if (direction === '3d-to-2d') {
    return {
      opacity3D: 1 - t,
      opacity2D: t,
    }
  } else {
    return {
      opacity3D: t,
      opacity2D: 1 - t,
    }
  }
}
