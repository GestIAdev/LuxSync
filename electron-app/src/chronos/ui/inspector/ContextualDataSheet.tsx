/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📄 CONTEXTUAL DATA SHEET V2 — WAVE 2040.33: THE HOLOGRAM HUD 🤖✨
 * 
 * Replaces the old ClipInspector. Shows only when a clip is selected.
 * Absolute positioned in the bottom-right corner of the Timeline.
 * 
 * 🔧 WAVE 2040.33 UPGRADES:
 * - Black 90% + strong blur (deep glassmorphism)
 * - Animated neon border (cyberpunk gradient)
 * - Close button (X) — top right
 * - Click trap (e.stopPropagation) — protects Timeline from accidental clicks
 * - Enhanced curve preview SVG
 * 
 * DATA SOURCE: Reads directly from the TimelineClip (FXClip.hephClip
 * contains all automation data — no .lfx file dependency).
 * 
 * @module chronos/ui/inspector/ContextualDataSheet
 * @version WAVE 2040.33
 */

import React, { useMemo, useCallback, memo } from 'react'
import type { TimelineClip, FXClip, VibeClip } from '../../core/TimelineClip'
import {
  ClockIcon,
  ZapIcon,
  MasksIcon,
  MovingHeadIcon,
  TargetIcon,
  HephLogoIcon,
  XIcon,  // 🔧 WAVE 2040.33: Close button
} from '../../../components/icons/LuxIcons'
import './ContextualDataSheet.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ContextualDataSheetProps {
  /** Selected clip (null = hidden) */
  clip: TimelineClip | null

  /** Callback: close the datasheet (deselect) */
  onClose?: () => void

  /** Callback: open clip in Hephaestus editor */
  onEditInHephaestus?: (clipId: string) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Format milliseconds to human-readable duration */
const formatDuration = (ms: number): string => {
  const seconds = ms / 1000
  if (seconds < 1) return `${Math.round(ms)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Convert ms to bars (assuming 4/4 time) */
const msToBars = (ms: number, bpm: number): string => {
  const beatMs = 60000 / bpm
  const barMs = beatMs * 4
  const bars = ms / barMs
  return `${bars.toFixed(1)} bars`
}

/** Get zone icons for display */
const getZoneSummary = (zones?: string[]): string => {
  if (!zones || zones.length === 0) return 'ALL'
  if (zones.length <= 3) return zones.join(', ')
  return `${zones.slice(0, 2).join(', ')} +${zones.length - 2}`
}

/** Get category label from clip */
const getCategoryLabel = (clip: TimelineClip): string => {
  if (clip.type === 'vibe') return (clip as VibeClip).vibeType.toUpperCase()
  const fx = clip as FXClip
  if (fx.isHephCustom) return 'HEPHAESTUS FX'
  return fx.fxType.toUpperCase()
}

/** Get mixBus label */
const getMixBusLabel = (clip: TimelineClip): string | null => {
  if (clip.type !== 'fx') return null
  const fx = clip as FXClip
  if (!fx.mixBus) return null
  const labels: Record<string, string> = {
    global: '🔴 GLOBAL',
    htp: '🟡 HTP',
    ambient: '🟢 AMBIENT',
    accent: '🔵 ACCENT',
  }
  return labels[fx.mixBus] || fx.mixBus.toUpperCase()
}

// ═══════════════════════════════════════════════════════════════════════════
// MINI CURVE PREVIEW (SVG)
// ═══════════════════════════════════════════════════════════════════════════

/** Simple curve shape preview based on FX type */
const CurvePreview: React.FC<{ clip: TimelineClip; color: string }> = memo(({ clip, color }) => {
  const path = useMemo(() => {
    if (clip.type === 'vibe') {
      // Vibes: flat intensity bar
      return 'M 0,20 L 80,20'
    }
    const fx = clip as FXClip
    // Generate path from keyframes if available
    if (fx.keyframes && fx.keyframes.length > 1) {
      const durationMs = fx.endMs - fx.startMs
      if (durationMs <= 0) return 'M 0,30 L 80,30'
      const points = fx.keyframes.map(kf => {
        const x = (kf.offsetMs / durationMs) * 80
        const y = 30 - kf.value * 28 // Invert Y (0=bottom, 1=top)
        return `${x},${y}`
      })
      return `M ${points.join(' L ')}`
    }
    // Fallback: generic wave based on fxType
    switch (fx.fxType) {
      case 'strobe': return 'M 0,30 L 10,2 L 10,30 L 20,2 L 20,30 L 30,2 L 30,30 L 40,2 L 40,30 L 50,2 L 50,30 L 60,2 L 60,30 L 70,2 L 70,30 L 80,2'
      case 'sweep': return 'M 0,30 L 40,2 L 80,30'
      case 'pulse': return 'M 0,30 Q 20,2 40,30 Q 60,2 80,30'
      case 'chase': return 'M 0,30 L 10,2 L 20,30 L 30,2 L 40,30 L 50,2 L 60,30 L 70,2 L 80,30'
      default: return 'M 0,30 Q 40,2 80,30'
    }
  }, [clip])

  return (
    <svg width="80" height="32" viewBox="0 0 80 32" className="datasheet-curve">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  )
})
CurvePreview.displayName = 'CurvePreview'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — WAVE 2040.33: THE HOLOGRAM HUD
// ═══════════════════════════════════════════════════════════════════════════

export const ContextualDataSheet: React.FC<ContextualDataSheetProps> = memo(({
  clip,
  onClose,
  onEditInHephaestus,
}) => {
  // Don't render if no selection
  if (!clip) return null

  const durationMs = clip.endMs - clip.startMs
  const categoryLabel = getCategoryLabel(clip)
  const mixBusLabel = getMixBusLabel(clip)
  const isHeph = clip.type === 'fx' && (clip as FXClip).isHephCustom
  const zones = clip.type === 'fx' ? (clip as FXClip).zones : undefined
  const zoneSummary = getZoneSummary(zones)
  
  // 🔧 WAVE 2040.33: Click trap — stop propagation to protect Timeline
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])
  
  // 🔧 WAVE 2040.33: Handle close button
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose?.()
  }, [onClose])

  return (
    <div 
      className="datasheet"
      onClick={handleContainerClick}
      onMouseDown={handleContainerClick}
    >
      {/* 🔧 WAVE 2040.33: Close button */}
      {onClose && (
        <button className="datasheet-close" onClick={handleClose} title="Close">
          <XIcon size={12} />
        </button>
      )}
      
      {/* ═══ HEADER: Name + Category ═══ */}
      <div className="datasheet-header">
        <div className="datasheet-icon">
          {clip.type === 'vibe' ? <MasksIcon /> : isHeph ? <HephLogoIcon /> : <ZapIcon />}
        </div>
        <div className="datasheet-title">
          <span className="datasheet-name">{clip.label || 'Unnamed'}</span>
          <span className="datasheet-category" style={{ color: clip.color }}>
            {categoryLabel}
          </span>
        </div>
      </div>

      {/* ═══ BODY: Zones + Timing + Curve ═══ */}
      <div className="datasheet-body">
        {/* Zones */}
        <div className="datasheet-row">
          <TargetIcon />
          <span className="datasheet-label">ZONES</span>
          <span className="datasheet-value">{zoneSummary}</span>
        </div>

        {/* MixBus */}
        {mixBusLabel && (
          <div className="datasheet-row">
            <MovingHeadIcon />
            <span className="datasheet-label">BUS</span>
            <span className="datasheet-value">{mixBusLabel}</span>
          </div>
        )}

        {/* Timing */}
        <div className="datasheet-row">
          <ClockIcon />
          <span className="datasheet-label">TIME</span>
          <span className="datasheet-value">{formatDuration(durationMs)}</span>
        </div>

        {/* Curve Preview */}
        <div className="datasheet-row datasheet-row--curve">
          <CurvePreview clip={clip} color={clip.color} />
        </div>
      </div>

      {/* ═══ FOOTER: Edit Button ═══ */}
      {isHeph && onEditInHephaestus && (
        <button
          className="datasheet-edit"
          onClick={(e) => { e.stopPropagation(); onEditInHephaestus(clip.id) }}
        >
          <HephLogoIcon />
          EDIT
        </button>
      )}
    </div>
  )
})

ContextualDataSheet.displayName = 'ContextualDataSheet'
