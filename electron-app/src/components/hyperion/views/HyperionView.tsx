/**
 * ☀️ HYPERION VIEW — Container Principal del Live View
 * 
 * Este es el componente raíz del módulo Hyperion.
 * Orquesta el viewport (2D/3D), toolbar, métricas y estado.
 * 
 * Filosofía: "No simulamos luz. La invocamos."
 * 
 * @module components/hyperion/views/HyperionView
 * @since WAVE 2042.3 (Project Hyperion — Phase 1)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useAudioStore } from '../../../stores/audioStore'
import { useStageStore } from '../../../stores/stageStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { QUALITY_PRESETS, type QualityMode, type ViewMode } from '../shared/types'
import { TacticalCanvas } from './tactical'
import { VisualizerCanvas } from './visualizer'
import { StageSidebar } from '../controls/sidebar/StageSidebar'
import './HyperionView.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HyperionViewProps {
  /** Callback cuando cambia el modo de vista */
  onViewModeChange?: (mode: ViewMode) => void
  /** Modo de vista inicial */
  initialViewMode?: ViewMode
  /** Modo de calidad inicial */
  initialQualityMode?: QualityMode
  /** ¿Mostrar toolbar? (default: true) */
  showToolbar?: boolean
  /** ¿Mostrar métricas en toolbar? (default: true) */
  showMetrics?: boolean
  /** Clase CSS adicional */
  className?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS — Estado local persistido
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook para persistir preferencias en localStorage.
 */
function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`hyperion:${key}`)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setPersistedState = useCallback((value: T) => {
    setState(value)
    try {
      localStorage.setItem(`hyperion:${key}`, JSON.stringify(value))
    } catch {
      // localStorage no disponible
    }
  }, [key])

  return [state, setPersistedState]
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function HyperionView({
  onViewModeChange,
  initialViewMode = '2D',
  initialQualityMode = 'HQ',
  showToolbar = true,
  showMetrics = true,
  className = '',
}: HyperionViewProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('viewMode', initialViewMode)
  const [qualityMode, setQualityMode] = usePersistedState<QualityMode>('qualityMode', initialQualityMode)
  const [isLoading, setIsLoading] = useState(true)

  // ── Stores ────────────────────────────────────────────────────────────────
  const { bpm, bpmConfidence, onBeat } = useAudioStore()
  const fixtures = useStageStore(state => state.fixtures)
  const selectedIds = useSelectionStore(state => state.selectedIds)

  // ── Derived State ─────────────────────────────────────────────────────────
  const fixtureCount = useMemo(() => fixtures.length, [fixtures])
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds])
  const qualitySettings = useMemo(() => QUALITY_PRESETS[qualityMode], [qualityMode])
  const isEmpty = fixtureCount === 0

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    // Simular tiempo de carga inicial (canvas setup)
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    onViewModeChange?.(viewMode)
  }, [viewMode, onViewModeChange])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
  }, [setViewMode])

  const handleQualityToggle = useCallback(() => {
    setQualityMode(qualityMode === 'HQ' ? 'LQ' : 'HQ')
  }, [qualityMode, setQualityMode])

  // ── BPM Display ───────────────────────────────────────────────────────────
  const bpmDisplay = useMemo(() => {
    if (bpm === 0) return '---'
    return Math.round(bpm).toString()
  }, [bpm])

  const bpmConfidenceLevel = useMemo(() => {
    if (bpmConfidence >= 0.8) return 'high'
    if (bpmConfidence >= 0.5) return 'medium'
    return 'low'
  }, [bpmConfidence])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`hyperion-view ${className}`}>
      {/* ═══════════════════════════════════════════════════════════════════
       * TOOLBAR — Command Strip
       * ═══════════════════════════════════════════════════════════════════ */}
      {showToolbar && (
        <div className="hyperion-toolbar">
          {/* Left Section: View Toggle */}
          <div className="hyperion-toolbar__left">
            <div className="hyperion-view-toggle">
              <button
                className={`hyperion-view-toggle__btn ${viewMode === '2D' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('2D')}
                title="Vista 2D Táctica"
              >
                2D
              </button>
              <button
                className={`hyperion-view-toggle__btn ${viewMode === '3D' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('3D')}
                title="Vista 3D Visualizer"
              >
                3D
              </button>
            </div>

            {/* Selection Info (si hay selección) */}
            {selectedCount > 0 && (
              <div className="hyperion-selection-info">
                <span className="hyperion-selection-info__icon">✦</span>
                <span className="hyperion-selection-info__count">{selectedCount}</span>
                <span>selected</span>
              </div>
            )}
          </div>

          {/* Center Section: Metrics */}
          {showMetrics && (
            <div className="hyperion-toolbar__center">
              <div className="hyperion-metrics">
                {/* BPM */}
                <div className="hyperion-metric">
                  <span className={`hyperion-metric__heart ${onBeat ? 'beating' : ''}`}>
                    ❤
                  </span>
                  <span className={`hyperion-metric__value ${bpmConfidenceLevel === 'low' ? 'warning' : ''}`}>
                    {bpmDisplay}
                  </span>
                  <span className="hyperion-metric__label">BPM</span>
                </div>

                {/* Confidence */}
                <div className="hyperion-metric">
                  <span className="hyperion-metric__icon">⚡</span>
                  <span className={`hyperion-metric__value ${
                    bpmConfidenceLevel === 'high' ? '' : 
                    bpmConfidenceLevel === 'medium' ? 'warning' : 'danger'
                  }`}>
                    {Math.round(bpmConfidence * 100)}%
                  </span>
                  <span className="hyperion-metric__label">CONF</span>
                </div>
              </div>
            </div>
          )}

          {/* Right Section: Quality Toggle + Settings */}
          <div className="hyperion-toolbar__right">
            <button
              className={`hyperion-quality-toggle ${qualityMode.toLowerCase()}`}
              onClick={handleQualityToggle}
              title={qualityMode === 'HQ' 
                ? 'High Quality — Full effects (click to reduce)' 
                : 'Low Quality — Better performance (click to enhance)'
              }
            >
              {qualityMode === 'HQ' ? '✨ HQ' : '⚡ LQ'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * MAIN CONTENT — Viewport + Sidebar (flex row)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="hyperion-main-content">
        {/* ═══════════════════════════════════════════════════════════════════
         * VIEWPORT — El Escenario
         * ═══════════════════════════════════════════════════════════════════ */}
        <div className={`hyperion-viewport ${onBeat ? 'on-beat' : ''}`}>
          {/* Animated Border */}
          <div className="hyperion-viewport-border" />

          {/* Loading State */}
          {isLoading && (
            <div className="hyperion-loading">
              <div className="hyperion-loading__spinner" />
              <div className="hyperion-loading__text">Initializing Hyperion</div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && isEmpty && (
            <div className="hyperion-empty-state">
              <div className="hyperion-empty-state__icon">☀️</div>
              <div className="hyperion-empty-state__title">No Fixtures</div>
              <div className="hyperion-empty-state__subtitle">
                Load a show file or add fixtures to see them here.
                The stage awaits your vision.
              </div>
            </div>
          )}

          {/* Canvas Container — TacticalCanvas (2D) or VisualizerCanvas (3D) */}
          {!isLoading && !isEmpty && (
            <div className="hyperion-canvas-container">
              {viewMode === '2D' ? (
                <TacticalCanvas 
                  quality={qualityMode}
                  showGrid={true}
                  showZoneLabels={true}
                />
              ) : (
                <VisualizerCanvas
                  quality={qualityMode}
                  showFloorGrid={true}
                  showTruss={true}
                  showBeams={true}
                />
              )}
            </div>
          )}

          {/* Mode Badge */}
          <div className="hyperion-mode-badge">
            {viewMode === '2D' ? 'TACTICAL' : 'VISUALIZER'}
          </div>

          {/* Fixture Count Badge */}
          {!isEmpty && (
            <div className="hyperion-fixture-count">
              <span className="hyperion-fixture-count__number">{fixtureCount}</span> fixtures
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
         * SIDEBAR — The Commander (Controles)
         * ═══════════════════════════════════════════════════════════════════ */}
        <div className="hyperion-sidebar-container">
          <StageSidebar />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY — Alias para imports legacy
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated Use HyperionView instead */
export const StageViewDual = HyperionView

/** Default export for lazy loading */
export default HyperionView
