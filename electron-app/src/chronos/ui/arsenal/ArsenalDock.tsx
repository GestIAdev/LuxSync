/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARSENAL DOCK — WAVE 7109: PHOSPHOR NOIR / NEON BLOOM
 *
 * Split layout: VIBE RACK (20%) | FX ARSENAL (80%) | TRIGGER ZONE
 * Vibes shown as distinct cards. FX clips paginated with multi-zone filters.
 *
 * LAYOUT (220px height fixed):
 * ┌──────────┬──────────────────────────────────────┬─────────────┐
 * │ VIBE     │  FX ARSENAL (CustomFXDock)           │   TRIGGER   │
 * │ RACK     │  [Search] [Zone Filters] [Paginated] │    ZONE     │
 * │ (20%)    │  [2 rows × 8-10 pads per page]       │   (200px)   │
 * └──────────┴──────────────────────────────────────┴─────────────┘
 *
 * @module chronos/ui/arsenal/ArsenalDock
 */

import React, { useCallback, useState, useMemo, memo } from 'react'
import type { DragPayload } from '../../core/TimelineClip'
import { serializeDragPayload } from '../../core/TimelineClip'
import { CustomFXDock } from './CustomFXDock'
import { useMidiMapStore } from '../../../stores/midiMapStore'
import { getAllVibes } from '../../../engine/vibe/profiles/index'
import type { VibeProfile } from '../../../types/VibeProfile'
import './ArsenalDock.css'

// ═══════════════════════════════════════════════════════════════════════════
// VIBE RACK — WAVE 7109: Distinct vibe cards with Neon Bloom
// ═══════════════════════════════════════════════════════════════════════════

const VIBE_COLORS: Record<string, string> = {
  'fiesta-latina': '#ff6b35',
  'techno-club':   '#00f0ff',
  'chill-lounge':  '#a78bfa',
  'pop-rock':      '#ff3366',
  'idle':          '#6b7280',
}

interface VibeCardProps {
  vibe: VibeProfile
  isRecording: boolean
  isMidiListening: boolean
  isMidiMapped: boolean
  onDragStart?: (payload: DragPayload) => void
  onMidiClick?: (controlId: string) => void
}

const VibeCard: React.FC<VibeCardProps> = memo(({
  vibe,
  isRecording,
  isMidiListening,
  isMidiMapped,
  onDragStart,
  onMidiClick,
}) => {
  const vibeColor = VIBE_COLORS[vibe.id] ?? '#888'
  const midiControlId = `vibe-${vibe.id}`

  const handleDragStart = useCallback((e: React.DragEvent) => {
    const payload: DragPayload = {
      source: 'arsenal',
      clipType: 'vibe',
      subType: vibe.id,
      name: vibe.name,
      defaultDurationMs: 8000,
    }
    const serialized = serializeDragPayload(payload)
    e.dataTransfer.setData('application/luxsync-clip', serialized)
    e.dataTransfer.setData('application/luxsync-vibe', serialized)
    e.dataTransfer.effectAllowed = 'copyMove'

    const ghost = document.createElement('div')
    ghost.className = 'vibe-drag-ghost'
    ghost.textContent = vibe.name.toUpperCase()
    ghost.style.backgroundColor = vibeColor
    ghost.style.position = 'fixed'
    ghost.style.top = '-100px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)

    onDragStart?.(payload)
  }, [vibe, vibeColor, onDragStart])

  const handleClick = useCallback(() => {
    if (isRecording) {
      window.lux?.setVibe?.(vibe.id)
    } else if (isMidiListening) {
      onMidiClick?.(midiControlId)
    }
  }, [isRecording, isMidiListening, vibe.id, onMidiClick])

  return (
    <div
      className={`vibe-card ${isRecording ? 'rec-mode' : ''} ${isMidiListening ? 'midi-listening' : ''} ${isMidiMapped ? 'midi-mapped' : ''}`}
      draggable={!isRecording}
      onDragStart={isRecording ? undefined : handleDragStart}
      onClick={handleClick}
      data-midi-id={midiControlId}
      style={{ '--vibe-color': vibeColor } as React.CSSProperties}
      title={`${vibe.name}\n${vibe.description}`}
    >
      {isMidiMapped && <span className="vibe-card-midi-dot" />}
      <span className="vibe-card-icon">{vibe.icon}</span>
      <span className="vibe-card-name">{vibe.name}</span>
    </div>
  )
})
VibeCard.displayName = 'VibeCard'

const VibeRack: React.FC<{
  isRecording: boolean
  onDragStart?: (payload: DragPayload) => void
}> = memo(({ isRecording, onDragStart }) => {
  const vibes = useMemo(() => getAllVibes().filter(v => v.id !== 'idle'), [])
  const learnMode = useMidiMapStore(s => s.learnMode)
  const listeningControl = useMidiMapStore(s => s.listeningControl)
  const mappings = useMidiMapStore(s => s.mappings)
  const startListening = useMidiMapStore(s => s.startListening)

  const handleMidiClick = useCallback((controlId: string) => {
    startListening(controlId)
  }, [startListening])

  return (
    <div className="dock-vibe-rack">
      <div className="vibe-rack-header">
        <span className="vibe-rack-title">VIBES</span>
        <span className="vibe-rack-hint">{learnMode ? 'MIDI' : 'DRAG'}</span>
      </div>
      <div className="vibe-rack-grid">
        {vibes.map(vibe => (
          <VibeCard
            key={vibe.id}
            vibe={vibe}
            isRecording={isRecording}
            isMidiListening={learnMode && listeningControl === `vibe-${vibe.id}`}
            isMidiMapped={!!mappings[`vibe-${vibe.id}`]}
            onDragStart={onDragStart}
            onMidiClick={handleMidiClick}
          />
        ))}
      </div>
    </div>
  )
})
VibeRack.displayName = 'VibeRack'

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
      <VibeRack
        isRecording={effectiveRecording}
        onDragStart={onDragStart}
      />

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
