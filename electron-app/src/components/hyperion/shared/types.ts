/**
 * ☀️ HYPERION — Shared Types
 * 
 * Tipos unificados para los componentes de Hyperion.
 * Tanto TacticalCanvas (2D) como VisualizerCanvas (3D) usan estos tipos.
 * 
 * @module components/hyperion/shared/types
 * @since WAVE 2042.1 (Project Hyperion — Phase 0)
 */

import type { CanonicalZone } from './ZoneLayoutEngine'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE DATA — Lo que necesita el renderer
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Datos de un fixture para renderizado.
 * Combina datos de truthStore (DMX real) y stageStore (metadata).
 * Este es el "contrato" entre el data layer y el render layer.
 */
export interface HyperionFixtureData {
  /** ID único del fixture */
  id: string
  
  /** Nombre display (ej: "PAR 01") */
  name: string
  
  /** Tipo de fixture */
  type: 'moving-head' | 'par' | 'wash' | 'strobe' | 'laser' | 'blinder' | 'generic'
  
  /** Zona canónica (siempre normalizada) */
  zone: CanonicalZone
  
  /** Dirección DMX base (1-512) */
  dmxAddress: number
  
  // ── VALORES DMX LIVE ──────────────────────────────────────────────────
  
  /** Intensidad (0-1, normalizada de dimmer 0-255) */
  intensity: number
  
  /** Color RGB (0-255 cada componente) */
  color: { r: number; g: number; b: number }
  
  /** Pan (0-1, normalizado de 0-540° típico) */
  pan: number
  
  /** Tilt (0-1, normalizado de 0-270° típico) */
  tilt: number
  
  /** Zoom (0-1, 0=spot, 1=wash) — solo movers */
  zoom: number
  
  /** Focus (0-1, 0=blurry, 1=sharp) — solo movers */
  focus: number
  
  // ── ESTADO UI ─────────────────────────────────────────────────────────
  
  /** ¿Está seleccionado? */
  selected: boolean
  
  /** ¿Está en hover? */
  hovered: boolean
  
  /** ¿Tiene override manual activo? */
  hasOverride: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER QUALITY — HQ vs LQ mode
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modo de calidad de renderizado.
 * HQ = Todos los efectos (Bloom, partículas, shadows)
 * LQ = Sin post-processing (para laptops patata)
 */
export type QualityMode = 'HQ' | 'LQ'

/**
 * Configuración de calidad por modo.
 */
export interface QualitySettings {
  /** ¿Activar post-processing (Bloom, ChromaticAberration)? */
  postProcessing: boolean
  
  /** ¿Activar sombras en 3D? */
  shadows: boolean
  
  /** ¿Activar outer aura en fixtures 2D? */
  outerAura: boolean
  
  /** ¿Activar partículas de polvo en beams? */
  dustParticles: boolean
  
  /** DPR máximo (1 = 1x, 1.5 = 1.5x, 2 = 2x) */
  maxDPR: number
  
  /** ¿Usar instanced rendering para fixtures similares? */
  instancing: boolean
}

/**
 * Presets de calidad.
 */
export const QUALITY_PRESETS: Record<QualityMode, QualitySettings> = {
  'HQ': {
    postProcessing: true,
    shadows: true,
    outerAura: true,
    dustParticles: true,
    maxDPR: 1.5,
    instancing: true,
  },
  'LQ': {
    postProcessing: false,
    shadows: false,
    outerAura: false,
    dustParticles: false,
    maxDPR: 1,
    instancing: true,  // Siempre on — es optimización, no visual
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW MODE — 2D Tactical vs 3D Visualizer
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modo de vista activo.
 */
export type ViewMode = '2D' | '3D'

// ═══════════════════════════════════════════════════════════════════════════
// HIT TEST — Interacción con fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resultado de un hit test (click o hover sobre el canvas).
 */
export interface HitTestResult {
  /** ID del fixture bajo el cursor (null si ninguno) */
  fixtureId: string | null
  
  /** Posición del cursor en el canvas (píxeles) */
  canvasPosition: { x: number; y: number }
  
  /** ¿Es un fixture instanced (InstancedMesh)? */
  isInstanced: boolean
  
  /** Índice de instancia (solo si isInstanced) */
  instanceIndex?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOLTIP — HUD Táctico
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado del tooltip de fixture.
 */
export interface TooltipState {
  /** ¿Está visible? */
  visible: boolean
  
  /** ID del fixture (null si no hay tooltip) */
  fixtureId: string | null
  
  /** Posición del tooltip en CSS (relativa al viewport) */
  position: { x: number; y: number }
}

// ═══════════════════════════════════════════════════════════════════════════
// BEAT — Sincronización con música
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado del beat actual (para efectos visuales sync con música).
 */
export interface BeatState {
  /** ¿Estamos en el frame de un beat? */
  onBeat: boolean
  
  /** BPM actual (0 si no hay audio) */
  bpm: number
  
  /** Intensidad del beat (0-1, decay exponencial desde el último beat) */
  intensity: number
  
  /** Timestamp del último beat */
  lastBeatTimestamp: number
}
