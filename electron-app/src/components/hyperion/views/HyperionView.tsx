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
import { useAudioStore, selectHyperionAudio } from '../../../stores/audioStore'
import { useTruthStore, selectStableEmotion } from '../../../stores/truthStore'
import { useStageStore } from '../../../stores/stageStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useNavigationStore } from '../../../stores/navigationStore'
import { useControlStore } from '../../../stores/controlStore'
import { useShallow } from 'zustand/shallow'
import { FolderIcon, NetworkIcon } from '../../icons/LuxIcons'
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
  // WAVE 2097.1: Removed fake setTimeout loading (Axioma Anti-Simulación).
  // Canvas mounts immediately — no simulated delay.

  // ── Stores ────────────────────────────────────────────────────────────────
  // 🛡️ WAVE 2042.13.5: useShallow para evitar infinite loop
  const { bpm, bpmConfidence, onBeat } = useAudioStore(useShallow(selectHyperionAudio))
  const stableEmotion = useTruthStore(selectStableEmotion)
  const fixtures = useStageStore(state => state.fixtures)
  const selectedIds = useSelectionStore(state => state.selectedIds)
  
  // 🌊 WAVE 2432: Omni-Liquid Layout switch (4.1 / 7.1)
  const liquidLayout = useControlStore(state => state.liquidLayout)
  const setLiquidLayout = useControlStore(state => state.setLiquidLayout)

  // ── Derived State ─────────────────────────────────────────────────────────
  const fixtureCount = useMemo(() => fixtures.length, [fixtures])
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds])
  const qualitySettings = useMemo(() => QUALITY_PRESETS[qualityMode], [qualityMode])
  const isEmpty = fixtureCount === 0

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    onViewModeChange?.(viewMode)
  }, [viewMode, onViewModeChange])

  // 🌊 WAVE 2436: Sync persisted liquidLayout → backend on mount
  // controlStore persists layout in localStorage. SeleneLux always boots '4.1'.
  // Without this, UI shows '7.1' but motor runs '4.1' after restart.
  useEffect(() => {
    window.lux?.setLiquidLayout?.(liquidLayout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount-only sync

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
  }, [setViewMode])

  const handleQualityToggle = useCallback(() => {
    setQualityMode(qualityMode === 'HQ' ? 'LQ' : 'HQ')
  }, [qualityMode, setQualityMode])

  // 🚀 WAVE 2073: Show Operations in Live Header
  const setActiveTab = useNavigationStore(state => state.setActiveTab)
  
  const handleLoadShow = useCallback(async () => {
    try {
      const luxApi = (window as any).lux
      if (luxApi?.stage?.openDialog) {
        const result = await luxApi.stage.openDialog()
        if (result?.success) {
          console.log(`[Hyperion] ✅ Show loaded: ${result.filePath}`)
        }
      }
    } catch (err) {
      console.error('[Hyperion] Load show error:', err)
    }
  }, [])

  const handleDmxNexus = useCallback(() => {
    setActiveTab('nexus')
  }, [setActiveTab])

  // 🌊 WAVE 2432: Omni-Liquid Layout switch — toggles 4.1 ↔ 7.1 via IPC
  const handleLiquidLayoutToggle = useCallback(async () => {
    const newMode = liquidLayout === '7.1' ? '4.1' : '7.1'
    setLiquidLayout(newMode)
    await window.lux?.setLiquidLayout?.(newMode)
  }, [liquidLayout, setLiquidLayout])

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

                {/* 🎭 WAVE 2205: MOOD — StableEmotion del MoodArbiter */}
                <div className="hyperion-metric">
                  <span className="hyperion-metric__icon">
                    {stableEmotion === 'BRIGHT' ? '☀️' : stableEmotion === 'DARK' ? '🌑' : '⚖️'}
                  </span>
                  <span className={`hyperion-metric__value hyperion-metric__mood--${(stableEmotion ?? 'neutral').toLowerCase()}`}>
                    {stableEmotion ?? 'NEUTRAL'}
                  </span>
                  <span className="hyperion-metric__label">MOOD</span>
                </div>
              </div>
            </div>
          )}

          {/* Right Section: Quality Toggle + Settings */}
          <div className="hyperion-toolbar__right">
            <button
              className="hyperion-show-btn"
              onClick={handleLoadShow}
              title="Load Show File"
            >
              <FolderIcon size={16} />
              <span>LOAD SHOW</span>
            </button>
            <button
              className="hyperion-nexus-btn"
              onClick={handleDmxNexus}
              title="DMX Nexus — Visual Patcher"
            >
              <NetworkIcon size={16} />
              <span>DMX NEXUS</span>
            </button>
            <div className="hyperion-liquid-layout-wrapper">
              <button
                className={`hyperion-liquid-toggle active mode-${liquidLayout.replace('.', '')}`}
                onClick={handleLiquidLayoutToggle}
                title={liquidLayout === '7.1' 
                  ? '7.1 Asymmetric Stereo — 7-zone per-band envelopes (click for 4.1)' 
                  : '4.1 Compact Stereo — 4-zone envelopes (click for 7.1)'
                }
              >
                <span className="liquid-mode-label">{liquidLayout === '7.1' ? '🌊' : '⚡'}</span>
                <span className="liquid-mode-value">{liquidLayout}</span>
              </button>
            </div>
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

          {/* Empty State */}
          {isEmpty && (
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
          {!isEmpty && (
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
