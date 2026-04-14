/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ☀️ HYPERION RENDER WORKER — Shared Types
 * "El Contrato entre Main Thread y el 4th Worker"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Tipos compartidos entre el main thread (TacticalCanvas.tsx) y el
 * RenderWorker (hyperion-render.worker.ts).
 * 
 * REGLA: Este archivo NO importa NADA de React, DOM, o Zustand.
 * Solo tipos puros y constantes serializables.
 * 
 * @module workers/hyperion-render.types
 * @since WAVE 2510 (Operación Hyperion — The 4th Worker)
 */

import type { CanonicalZone } from '../components/hyperion/shared/ZoneLayoutEngine'

// ═══════════════════════════════════════════════════════════════════════════
// WORKER FIXTURE — Minimal per-frame data for rendering
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lightweight fixture data packed for Transferrable transport.
 * Contains ONLY the fields that change every frame.
 * Structural data (id, name, zone, position) lives in WorkerFixtureScaffold.
 */
export interface WorkerFixtureFrame {
  /** Red 0-255 */
  r: number
  /** Green 0-255 */
  g: number
  /** Blue 0-255 */
  b: number
  /** Intensity 0-1 (already: dimmer/255 * globalIntensity) */
  intensity: number
  /** Physical pan 0-1 */
  physicalPan: number
  /** Physical tilt 0-1 */
  physicalTilt: number
  /** Zoom 0-255 DMX */
  zoom: number
  /** Focus 0-255 DMX */
  focus: number
  /** Pan velocity (signed) for motion trails */
  panVelocity: number
  /** Tilt velocity (signed) for motion trails */
  tiltVelocity: number
}

/**
 * Structural scaffold — sent once (or on config change).
 * This is the "cold" data that rarely changes.
 */
export interface WorkerFixtureScaffold {
  /** Unique ID */
  id: string
  /** Normalized X position 0-1 */
  x: number
  /** Normalized Y position 0-1 */
  y: number
  /** Fixture type */
  type: 'par' | 'moving' | 'strobe' | 'laser' | 'wash'
  /** Canonical zone */
  zone: CanonicalZone
  /** Gobo wheel */
  gobo: number
  /** Prism */
  prism: number
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES: Main Thread → Worker
// ═══════════════════════════════════════════════════════════════════════════

/** Initialize worker with OffscreenCanvas */
export interface WorkerMsgInit {
  type: 'INIT'
  canvas: OffscreenCanvas
  width: number
  height: number
  dpr: number
  quality: 'HQ' | 'LQ'
  showGrid: boolean
  showZoneLabels: boolean
}

/** Canvas resized — worker must update internal dimensions */
export interface WorkerMsgResize {
  type: 'RESIZE'
  width: number
  height: number
  dpr: number
}

/** 
 * Fixture scaffold update — structural data changed.
 * Sent on show load, fixture add/remove, zone reassignment.
 */
export interface WorkerMsgScaffold {
  type: 'SCAFFOLD'
  fixtures: WorkerFixtureScaffold[]
  zoneCounts: Array<[string, number]>
}

/**
 * Hot frame — per-frame dynamic data via Transferrable.
 * This is the high-frequency path (~44Hz from backend).
 * 
 * `frameData` is a Float32Array packed with WorkerFixtureFrame fields.
 * Layout: 10 floats per fixture × N fixtures.
 */
export interface WorkerMsgFrame {
  type: 'FRAME'
  frameNumber: number
  timestamp: number
  onBeat: boolean
  beatIntensity: number
  fixtureCount: number
  /** Packed Float32Array: [r,g,b,intensity,physicalPan,physicalTilt,zoom,focus,panVelocity,tiltVelocity] × N */
  frameData: Float32Array
}

/** Selection state changed (click, lasso, keyboard) */
export interface WorkerMsgSelection {
  type: 'SELECTION'
  selectedIds: string[]
  hoveredId: string | null
  lassoBounds: { startX: number; startY: number; endX: number; endY: number } | null
}

/** Mouse event forwarded for hit testing */
export interface WorkerMsgMouse {
  type: 'MOUSE'
  action: 'move' | 'down' | 'up' | 'leave'
  x: number
  y: number
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

/** Quality or render options changed */
export interface WorkerMsgOptions {
  type: 'OPTIONS'
  quality?: 'HQ' | 'LQ'
  showGrid?: boolean
  showZoneLabels?: boolean
}

/** Shutdown — stop RAF loop and cleanup */
export interface WorkerMsgShutdown {
  type: 'SHUTDOWN'
}

/** 
 * WAVE 2515: Hibernation Protocol — pause/resume RAF loop.
 * When the canvas is CSS-hidden, we stop burning GPU cycles.
 */
export interface WorkerMsgHibernate {
  type: 'HIBERNATE'
  /** true = pause RAF, false = resume RAF */
  sleep: boolean
}

export type WorkerInboundMessage =
  | WorkerMsgInit
  | WorkerMsgResize
  | WorkerMsgScaffold
  | WorkerMsgFrame
  | WorkerMsgSelection
  | WorkerMsgMouse
  | WorkerMsgOptions
  | WorkerMsgShutdown
  | WorkerMsgHibernate

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES: Worker → Main Thread
// ═══════════════════════════════════════════════════════════════════════════

/** Worker is ready and rendering */
export interface WorkerOutReady {
  type: 'READY'
}

/** Hit test result from mouse interaction */
export interface WorkerOutHitTest {
  type: 'HIT_TEST'
  fixtureId: string | null
  fixtureIndex: number | null
  distance: number | null
  /** Client position for tooltip positioning */
  mouseX: number
  mouseY: number
  action: 'move' | 'down' | 'up'
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

/** Lasso selection completed in worker */
export interface WorkerOutLassoComplete {
  type: 'LASSO_COMPLETE'
  fixtureIds: string[]
  additive: boolean
}

/** Performance metrics from worker RAF loop */
export interface WorkerOutMetrics {
  type: 'METRICS'
  fps: number
  frameTime: number
  fixtureCount: number
}

/** Worker crashed or encountered fatal error */
export interface WorkerOutError {
  type: 'ERROR'
  message: string
}

export type WorkerOutboundMessage =
  | WorkerOutReady
  | WorkerOutHitTest
  | WorkerOutLassoComplete
  | WorkerOutMetrics
  | WorkerOutError

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER LAYOUT — Constants for Float32Array packing
// ═══════════════════════════════════════════════════════════════════════════

/** Number of Float32 fields per fixture in the frame buffer */
export const FLOATS_PER_FIXTURE = 10

/** Field offsets within each fixture's 10-float block */
export const FIXTURE_FIELD = {
  R: 0,
  G: 1,
  B: 2,
  INTENSITY: 3,
  PHYSICAL_PAN: 4,
  PHYSICAL_TILT: 5,
  ZOOM: 6,
  FOCUS: 7,
  PAN_VELOCITY: 8,
  TILT_VELOCITY: 9,
} as const
