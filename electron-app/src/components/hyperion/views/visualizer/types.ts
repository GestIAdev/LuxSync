/**
 * ☀️ HYPERION — Visualizer Types (3D)
 * 
 * Tipos específicos para el renderizado 3D con React Three Fiber.
 * Extiende los tipos compartidos con detalles específicos de Three.js.
 * 
 * @module components/hyperion/views/visualizer/types
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 */

import * as THREE from 'three'
import type { CanonicalZone } from '../../shared/ZoneLayoutEngine'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE 3D DATA — What the 3D renderer needs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Datos de un fixture para renderizado 3D.
 * Posición en metros, rotación en radianes.
 */
export interface Fixture3DData {
  /** ID único del fixture */
  id: string
  
  /** Nombre display */
  name: string
  
  /** Tipo de fixture (determina geometría 3D) */
  type: 'moving-head' | 'par' | 'wash' | 'strobe' | 'laser' | 'blinder' | 'generic'
  
  /** Zona canónica */
  zone: CanonicalZone
  
  // ── POSICIÓN 3D (metros) ──────────────────────────────────────────────
  
  /** Posición X (izquierda/derecha, -halfWidth a +halfWidth) */
  x: number
  
  /** Posición Y (altura, 0=suelo, trussHeight=techo) */
  y: number
  
  /** Posición Z (profundidad, -stageDepth a +stageDepth) */
  z: number
  
  // ── VALORES DMX LIVE ──────────────────────────────────────────────────
  
  /** Intensidad normalizada (0-1) */
  intensity: number
  
  /** Color THREE.Color-ready */
  color: THREE.Color
  
  /** Pan normalizado (0-1 → -180° a +180°) */
  pan: number
  
  /** Tilt normalizado (0-1 → -90° a +90°) */
  tilt: number
  
  /** Zoom normalizado (0-1, 0=spot, 1=wash) */
  zoom: number
  
  /** Focus normalizado (0-1) */
  focus: number
  
  // ── ESTADO UI ─────────────────────────────────────────────────────────
  
  /** ¿Está seleccionado? */
  selected: boolean
  
  /** ¿Tiene override manual activo? */
  hasOverride: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE CONFIGURATION — Physical dimensions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuración física del escenario 3D.
 * Dimensiones en metros.
 */
export interface StageConfig3D {
  /** Ancho total del escenario (metros) */
  width: number
  
  /** Profundidad del escenario (metros) */
  depth: number
  
  /** Altura del truss (metros) */
  trussHeight: number
  
  /** ¿Mostrar floor grid? */
  showFloor: boolean
  
  /** ¿Mostrar truss structures? */
  showTruss: boolean
  
  /** Color del floor (hex) */
  floorColor: string
}

/**
 * Configuración por defecto del escenario.
 * Basada en un escenario de club/venue medio.
 */
export const DEFAULT_STAGE_CONFIG: StageConfig3D = {
  width: 12,        // 12m de ancho
  depth: 8,         // 8m de profundidad
  trussHeight: 5,   // 5m de altura
  showFloor: true,
  showTruss: true,
  floorColor: '#080810',
}

// ═══════════════════════════════════════════════════════════════════════════
// VISUALIZER OPTIONS — Render configuration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Opciones del VisualizerCanvas.
 */
export interface VisualizerOptions {
  /** Modo de calidad (HQ/LQ) */
  quality: 'HQ' | 'LQ'
  
  /** ¿Activar post-processing (Bloom)? */
  postProcessing: boolean
  
  /** ¿Activar sombras? */
  shadows: boolean
  
  /** ¿Mostrar grid en el floor? */
  showFloorGrid: boolean
  
  /** ¿Mostrar truss? */
  showTruss: boolean
  
  /** ¿Mostrar beams de luz? */
  showBeams: boolean
  
  /** ¿Mostrar atmósfera/haze? */
  showAtmosphere: boolean
  
  /** DPR máximo permitido */
  maxDPR: number
}

/**
 * Opciones por defecto HQ.
 */
export const DEFAULT_VISUALIZER_OPTIONS_HQ: VisualizerOptions = {
  quality: 'HQ',
  postProcessing: true,
  shadows: true,
  showFloorGrid: true,
  showTruss: true,
  showBeams: true,
  showAtmosphere: true,
  maxDPR: 1.5,
}

/**
 * Opciones por defecto LQ.
 */
export const DEFAULT_VISUALIZER_OPTIONS_LQ: VisualizerOptions = {
  quality: 'LQ',
  postProcessing: false,
  shadows: false,
  showFloorGrid: true,
  showTruss: true,
  showBeams: true,
  showAtmosphere: false,
  maxDPR: 1,
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER METRICS — Performance monitoring
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Métricas de renderizado 3D.
 */
export interface Visualizer3DMetrics {
  /** FPS actual */
  fps: number
  
  /** Tiempo de frame en ms */
  frameTime: number
  
  /** Número de fixtures renderizados */
  fixtureCount: number
  
  /** Número de draw calls */
  drawCalls: number
  
  /** Triángulos totales */
  triangles: number
  
  /** Memoria GPU estimada (MB) */
  memoryMB: number
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTANCE MAPPING — For instanced rendering
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapa de instancia a fixture ID.
 * Usado para traducir clicks en InstancedMesh a fixture IDs reales.
 */
export interface InstanceMap {
  /** Tipo de fixture agrupado */
  type: 'par' | 'wash' | 'strobe' | 'blinder' | 'generic'
  
  /** Mapa: índice de instancia → fixture ID */
  indexToId: Map<number, string>
  
  /** Mapa inverso: fixture ID → índice de instancia */
  idToIndex: Map<string, number>
}
