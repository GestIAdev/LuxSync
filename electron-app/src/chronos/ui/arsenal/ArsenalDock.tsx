/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 ARSENAL DOCK - WAVE 2030.7: THE TITANS MEET
 * 
 * Panel horizontal inferior que reemplaza al Command Deck global en Chronos.
 * Diseño PRO con jerarquía visual: VIBES (contenedores) > EFFECTS (items)
 * 
 * WAVE 2030.7: Hephaestus integration - Custom FX panel added
 * 
 * LAYOUT (240px height fixed):
 * ┌─────────────┬──────────────────────┬──────────────┬─────────────┐
 * │ VIBE CARDS  │   CORE EFFECT GRID   │  CUSTOM FX   │   TRIGGER   │
 * │   (280px)   │   [2 rows × scroll]  │  (Heph .lfx) │    ZONE     │
 * │ ┌────┬────┐ │                      │              │   (200px)   │
 * │ │ 🎺 │ 🤖 │ │  ☀️ 🌴 🔥 🌙 ⚡ ...   │  ⚒️ Custom   │             │
 * │ │LATI│TECH│ │                      │  effects     │    🔴 ARM   │
 * │ ├────┼────┤ │                      │  [+] NEW     │             │
 * │ │ 🎸 │ 🌊 │ │                      │              │   MODE:     │
 * │ │ROCK│CHIL│ │                      │              │   DRAG/REC  │
 * │ └────┴────┘ │                      │              │             │
 * └─────────────┴──────────────────────┴──────────────┴─────────────┘
 * 
 * JERARQUÍA VISUAL:
 * - VIBES: Tarjetas grandes, oscuras, imponentes (CONTENEDORES)
 * - CORE FX: Pads pequeños, cyan border (ITEMS)
 * - CUSTOM FX: Pads pequeños, EMBER border (HEPHAESTUS)
 * 
 * @module chronos/ui/arsenal/ArsenalDock
 * @version WAVE 2030.7
 */

import React, { useCallback, useMemo, useState, memo } from 'react'
import { 
  type DragPayload,
  serializeDragPayload 
} from '../../core/TimelineClip'
import { 
  getEffectCategories, 
  type EffectMeta, 
  type EffectCategory,
  type EffectCategoryId,
} from '../../core/EffectRegistry'
import { getChronosRecorder } from '../../core/ChronosRecorder'
import { CustomFXDock } from './CustomFXDock'
import {
  RobotVibeIcon,
  TrumpetVibeIcon,
  GuitarVibeIcon,
  LoungeVibeIcon,
  ZapIcon,
  WaveFxIcon,
  MovementFxIcon,
  SunFxIcon,
  ChipFxIcon,
  StrobeIcon,
} from '../../../components/icons/LuxIcons'
import type { IconProps } from '../../../components/icons/LuxIcons'
import './ArsenalDock.css'

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2041: VIBE ICON MAP — Custom SVG per category
// ═══════════════════════════════════════════════════════════════════════════

const VIBE_ICON_MAP: Record<EffectCategoryId, React.FC<IconProps>> = {
  'fiesta-latina': TrumpetVibeIcon,
  'techno': RobotVibeIcon,
  'pop-rock': GuitarVibeIcon,
  'chill-lounge': LoungeVibeIcon,
  'universal': ChipFxIcon,
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2041: FX ICON MAPPING — Smart switch by effect properties
// Maps 45+ effects to icon categories instead of emojis.
// ═══════════════════════════════════════════════════════════════════════════

function getEffectIcon(effect: EffectMeta): React.ReactNode {
  // STROBE / BLINDER → ZapIcon (lightning bolt)
  if (effect.hasStrobe || effect.id.includes('strobe') || effect.id.includes('blinder')) {
    return <ZapIcon size={22} />
  }
  
  // COLOR / SWEEP / RAINBOW / WASH → WaveFxIcon
  if (
    effect.id.includes('sweep') || effect.id.includes('wave') || 
    effect.id.includes('rainbow') || effect.id.includes('fiber') ||
    effect.id.includes('rain') || effect.id.includes('caustic') ||
    effect.id.includes('shimmer') || effect.id.includes('wash')
  ) {
    return <WaveFxIcon size={22} />
  }
  
  // MOVEMENT / PAN / TILT / CHASE / SCAN → MovementFxIcon
  if (
    effect.id.includes('chase') || effect.id.includes('scan') ||
    effect.id.includes('saw') || effect.id.includes('dualism') ||
    effect.id.includes('gatling') || effect.id.includes('pulse') ||
    effect.id.includes('rhythm') || effect.id.includes('ping') ||
    effect.id.includes('current') || effect.id.includes('drift') ||
    effect.id.includes('school') || effect.id.includes('glitch')
  ) {
    return <MovementFxIcon size={22} />
  }
  
  // DIMMER / INTENSITY / SPOTLIGHT / FLARE / FIRE → SunFxIcon
  if (
    effect.id.includes('flare') || effect.id.includes('fire') ||
    effect.id.includes('heat') || effect.id.includes('spark') ||
    effect.id.includes('spotlight') || effect.id.includes('solo') ||
    effect.id.includes('thunder') || effect.id.includes('chord') ||
    effect.id.includes('meltdown') || effect.id.includes('snap')
  ) {
    return <SunFxIcon size={22} />
  }
  
  // ATMOSPHERIC / MIST / VOID / BREATH → StrobeIcon (repurpose for atmosphere)
  if (
    effect.id.includes('mist') || effect.id.includes('void') ||
    effect.id.includes('breath') || effect.id.includes('moon') ||
    effect.id.includes('rise') || effect.id.includes('spore') ||
    effect.id.includes('jellyfish') || effect.id.includes('whale') ||
    effect.id.includes('ghost') || effect.id.includes('plankton')
  ) {
    return <LoungeVibeIcon size={22} />
  }
  
  // DEFAULT → ChipFxIcon (integrated circuit)
  return <ChipFxIcon size={22} />
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ArsenalDockProps {
  /** Is recording mode active? */
  isRecording?: boolean
  
  /** Is armed (ready to record)? */
  isArmed?: boolean
  
  /** Toggle recording mode */
  onRecordToggle?: () => void
  
  /** Toggle armed state */
  onArmToggle?: () => void
  
  /** Callback when effect is clicked (for record mode) */
  onEffectClick?: (effect: EffectMeta) => void
  
  /** Callback when clip is being dragged */
  onDragStart?: (payload: DragPayload) => void
  
  /** Callback when drag ends */
  onDragEnd?: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE CARD - Large Container Style (2×2 Grid)
// ═══════════════════════════════════════════════════════════════════════════

interface VibeCardProps {
  category: EffectCategory
  isActive: boolean
  isRecording: boolean
  onClick: () => void
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
}

const VibeCard: React.FC<VibeCardProps> = memo(({ 
  category, 
  isActive,
  isRecording,
  onClick,
  onDragStart,
  onDragEnd,
}) => {
  
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const payload: DragPayload = {
      source: 'arsenal',
      clipType: 'vibe',
      subType: category.id,
      defaultDurationMs: 8000, // 8 seconds default for vibe clips
    }
    
    e.dataTransfer.setData('application/luxsync-vibe', serializeDragPayload(payload))
    e.dataTransfer.setData('application/luxsync-clip', serializeDragPayload(payload))
    e.dataTransfer.effectAllowed = 'copyMove'
    
    // Drag ghost (text-only, no emoji)
    const ghost = document.createElement('div')
    ghost.className = 'vibe-drag-ghost'
    ghost.textContent = `\u25C6 ${category.name} VIBE`
    ghost.style.backgroundColor = category.color
    ghost.style.position = 'fixed'
    ghost.style.top = '-100px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
    
    onDragStart?.(payload)
  }, [category, onDragStart])
  
  // 🎬 WAVE 2010: Click-to-record for Vibe Cards
  const handleClick = useCallback(() => {
    if (isRecording) {
      // Record vibe clip at current playhead (8 seconds default duration)
      const recorder = getChronosRecorder()
      recorder.recordVibe(
        category.id,
        category.name,
        8000, // Default vibe duration: 8 seconds
        category.color,
        category.icon
      )
    }
    onClick()
  }, [isRecording, category, onClick])
  
  return (
    <button
      className={`vibe-card ${isActive ? 'active' : ''} ${isRecording ? 'rec-mode' : ''}`}
      onClick={handleClick}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      style={{ '--vibe-color': category.color } as React.CSSProperties}
      title={isRecording 
        ? `REC: Click to RECORD ${category.name} Vibe at playhead` 
        : `Click: Select | Drag: Create ${category.name} Vibe`}
    >
      <span className="vibe-card-icon">
        {React.createElement(VIBE_ICON_MAP[category.id] ?? ChipFxIcon, { size: 28, color: category.color })}
      </span>
      <span className="vibe-card-name">{category.name}</span>
      <span className="vibe-card-count">{category.effects.length} FX</span>
      {isRecording && <span className="vibe-card-rec-dot">{'\u25CF'}</span>}
      <div className="vibe-card-drag-hint">{'\u205E\u205E'}</div>
    </button>
  )
})

VibeCard.displayName = 'VibeCard'

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT PAD (80×80 Launchpad button)
// ═══════════════════════════════════════════════════════════════════════════

interface EffectPadProps {
  effect: EffectMeta
  isRecording: boolean
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
  onClick?: (effect: EffectMeta) => void
}

const EffectPad: React.FC<EffectPadProps> = memo(({ 
  effect,
  isRecording,
  onDragStart,
  onDragEnd,
  onClick,
}) => {
  
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const payload: DragPayload = {
      source: 'arsenal',
      clipType: 'fx',
      subType: effect.id,
      effectId: effect.id,
      defaultDurationMs: effect.suggestedDuration,
    }
    
    e.dataTransfer.setData('application/luxsync-fx', serializeDragPayload(payload))
    e.dataTransfer.setData('application/luxsync-clip', serializeDragPayload(payload))
    e.dataTransfer.effectAllowed = 'copyMove'
    
    // Drag ghost (text-only, no emoji)
    const ghost = document.createElement('div')
    ghost.className = 'pad-drag-ghost'
    ghost.textContent = `\u25C6 ${effect.displayName}`
    ghost.style.backgroundColor = effect.color
    ghost.style.position = 'fixed'
    ghost.style.top = '-100px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
    
    onDragStart?.(payload)
  }, [effect, onDragStart])
  
  const handleClick = useCallback(() => {
    if (isRecording) {
      const recorder = getChronosRecorder()
      recorder.recordEffect(
        effect.id,
        effect.displayName,
        effect.suggestedDuration,
        effect.color,
        effect.icon
      )
      onClick?.(effect)
    }
  }, [effect, isRecording, onClick])
  
  return (
    <div
      className={`effect-pad ${isRecording ? 'rec-mode' : ''} ${effect.hasStrobe ? 'strobe' : ''}`}
      draggable={!isRecording}
      onDragStart={isRecording ? undefined : handleDragStart}
      onDragEnd={isRecording ? undefined : onDragEnd}
      onClick={handleClick}
      style={{ '--pad-color': effect.color } as React.CSSProperties}
      title={`${effect.displayName} - ${effect.description}`}
    >
      <span className="pad-icon">{getEffectIcon(effect)}</span>
      <span className="pad-name">{effect.displayName}</span>
      {effect.hasStrobe && <span className="pad-strobe"><ZapIcon size={11} /></span>}
    </div>
  )
})

EffectPad.displayName = 'EffectPad'

// ═══════════════════════════════════════════════════════════════════════════
// ARM BUTTON - The Trigger That Scares You
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

export const ArsenalDock: React.FC<ArsenalDockProps> = memo(({
  isRecording = false,
  isArmed = false,
  onRecordToggle,
  onArmToggle,
  onEffectClick,
  onDragStart,
  onDragEnd,
}) => {
  // Get categories from registry
  const categories = useMemo(() => getEffectCategories(), [])
  
  // Active category tab
  const [activeCategoryId, setActiveCategoryId] = useState<EffectCategoryId>('fiesta-latina')
  
  // Internal armed state if no external control
  const [internalArmed, setInternalArmed] = useState(false)
  const effectiveArmed = onArmToggle ? isArmed : internalArmed
  const effectiveRecording = isRecording
  
  // Get active category's effects
  const activeCategory = useMemo(
    () => categories.find(c => c.id === activeCategoryId) ?? categories[0],
    [categories, activeCategoryId]
  )
  
  // Handle ARM toggle - cycles through: idle → armed → recording → idle
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
      
      {/* ═══════════════════════════════════════════════════════════════════
       * LEFT: VIBE CARDS (280px, 2×2 Grid - CONTAINER HIERARCHY)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="dock-vibes">
        <div className="vibes-header">
          <span className="vibes-title">VIBE</span>
          <span className="vibes-hint">DRAG TO TIMELINE</span>
        </div>
        <div className="vibes-grid">
          {categories.map(cat => (
            <VibeCard
              key={cat.id}
              category={cat}
              isActive={cat.id === activeCategoryId}
              isRecording={effectiveRecording}
              onClick={() => setActiveCategoryId(cat.id)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * CENTER: EFFECT GRID (Core FX - 2 rows × horizontal scroll)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="dock-grid">
        <div className="grid-header">
          <span className="grid-category" style={{ color: activeCategory.color }}>
            {React.createElement(VIBE_ICON_MAP[activeCategory.id] ?? ChipFxIcon, { size: 16, color: activeCategory.color })}
            {' '}{activeCategory.name}
          </span>
          <span className="grid-mode">
            {effectiveRecording ? '\u25CF CLICK TO RECORD' : '\u205E\u205E DRAG TO TIMELINE'}
          </span>
        </div>
        <div className="grid-scroll">
          <div className="grid-pads">
            {activeCategory.effects.map(effect => (
              <EffectPad
                key={effect.id}
                effect={effect}
                isRecording={effectiveRecording}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onClick={onEffectClick}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * CENTER-RIGHT: CUSTOM FX DOCK (Hephaestus .lfx clips) - WAVE 2030.7
       * ═══════════════════════════════════════════════════════════════════ */}
      <CustomFXDock
        isRecording={effectiveRecording}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
      
      {/* ═══════════════════════════════════════════════════════════════════
       * RIGHT: TRIGGER ZONE (200px)
       * ═══════════════════════════════════════════════════════════════════ */}
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
