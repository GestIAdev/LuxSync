/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARSENAL DOCK — FASE 6a: .lfx Unification
 *
 * Panel horizontal inferior para Chronos.
 * FASE 6a: Legacy core effect grid + vibe cards demolished.
 * .lfx clips from Hephaestus are the ONLY source of truth for effects.
 *
 * LAYOUT (200px height fixed):
 * ┌──────────────────────────────────────────────┬─────────────┐
 * │  CUSTOM FX DOCK (.lfx clips from Hephaestus) │   TRIGGER   │
 * │  [Filter tabs] [Grid scroll] [+] NEW         │    ZONE     │
 * │                                              │   (200px)   │
 * │                                              │    ARM      │
 * └──────────────────────────────────────────────┴─────────────┘
 *
 * @module chronos/ui/arsenal/ArsenalDock
 */

import React, { useCallback, useState, memo } from 'react'
import type { DragPayload } from '../../core/TimelineClip'
import { CustomFXDock } from './CustomFXDock'
import './ArsenalDock.css'

// ═══════════════════════════════════════════════════════════════════════════
// ARM BUTTON
// ═══════════════════════════════════════════════════════════════════════════

interface ArmButtonProps {
  isArmed: boolean
  isRecording: boolean
  onToggle: () => void
}

const ArmButton: React.FC<ArmButtonProps> = memo(({ isArmed, isRecording, onToggle }) => {
  const state = isRecording ? 'recording' : isArmed ? 'armed' : 'idle'

  const stateLabels = {
    idle: 'ARM',
    armed: 'REC READY',
    recording: '\u25CF REC',
  }

  return (
    <button
      className={`arm-button ${state}`}
      onClick={onToggle}
      title={isRecording ? 'Stop Recording' : isArmed ? 'Start Recording' : 'Arm for Recording'}
    >
      <div className="arm-glow" />
      <div className="arm-ring" />
      <div className="arm-core">
        <span className="arm-icon">{'\u25CF'}</span>
      </div>
      <span className="arm-label">{stateLabels[state]}</span>
    </button>
  )
})

ArmButton.displayName = 'ArmButton'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export interface ArsenalDockProps {
  isRecording?: boolean
  isArmed?: boolean
  onRecordToggle?: () => void
  onArmToggle?: () => void
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
}

export const ArsenalDock: React.FC<ArsenalDockProps> = memo(({
  isRecording = false,
  isArmed = false,
  onRecordToggle,
  onArmToggle,
  onDragStart,
  onDragEnd,
}) => {
  const [internalArmed, setInternalArmed] = useState(false)
  const effectiveArmed = onArmToggle ? isArmed : internalArmed
  const effectiveRecording = isRecording

  const handleArmToggle = useCallback(() => {
    if (onArmToggle) {
      onArmToggle()
    } else if (onRecordToggle) {
      if (!effectiveArmed && !effectiveRecording) {
        setInternalArmed(true)
      } else if (effectiveArmed && !effectiveRecording) {
        onRecordToggle()
      } else {
        onRecordToggle()
        setInternalArmed(false)
      }
    }
  }, [onArmToggle, onRecordToggle, effectiveArmed, effectiveRecording])

  return (
    <div className={`arsenal-dock ${effectiveRecording ? 'recording' : ''} ${effectiveArmed ? 'armed' : ''}`}>
      <CustomFXDock
        isRecording={effectiveRecording}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />

      <div className="dock-trigger">
        <ArmButton
          isArmed={effectiveArmed}
          isRecording={effectiveRecording}
          onToggle={handleArmToggle}
        />

        <div className="trigger-status">
          <div className="status-row">
            <span className="status-label">MODE</span>
            <span className={`status-value ${effectiveRecording ? 'rec' : ''}`}>
              {effectiveRecording ? 'REC' : 'EDIT'}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">ACTION</span>
            <span className="status-value">
              {effectiveRecording ? 'CLICK' : 'DRAG'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

ArsenalDock.displayName = 'ArsenalDock'

export default ArsenalDock
