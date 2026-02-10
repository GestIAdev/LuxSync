/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 ARSENAL PANEL - WAVE 2008: THE LIVING ARSENAL
 * 
 * Panel dinámico que muestra TODOS los 45+ efectos reales de LuxSync
 * organizados por categorías (Fiesta Latina, Techno, Pop-Rock, Chill Lounge).
 * 
 * GENERACIÓN DINÁMICA:
 * - Los efectos se leen del EffectRegistry (fuente de verdad)
 * - Las categorías son Accordions colapsables
 * - No hay nombres hardcodeados - todo viene del registry
 * 
 * FUNCIONALIDAD DUAL:
 * - 🖱️ DRAG → Arrastra efecto al timeline para editar
 * - 🔴 CLICK (modo REC) → Graba efecto en playhead position
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * Estos son los efectos REALES. No mocks. No demos.
 * 
 * @module chronos/ui/arsenal/ArsenalPanel
 * @version WAVE 2008
 */

import React, { useCallback, useMemo, memo } from 'react'
import { 
  type VibeType, 
  type DragPayload,
  VIBE_COLORS,
  serializeDragPayload 
} from '../../core/TimelineClip'
import { 
  getEffectCategories, 
  type EffectMeta, 
  type EffectCategory,
  getTotalEffectCount,
} from '../../core/EffectRegistry'
import { getChronosRecorder } from '../../core/ChronosRecorder'
import { Accordion } from '../common/Accordion'
import './ArsenalPanel.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ArsenalPanelProps {
  /** Optional: currently selected clip ID for context */
  selectedClipId?: string | null
  
  /** Callback when clip is being dragged */
  onDragStart?: (payload: DragPayload) => void
  
  /** Callback when drag ends */
  onDragEnd?: () => void
  
  /** Callback when effect is clicked (for record mode) */
  onEffectClick?: (effect: EffectMeta) => void
  
  /** Is recording mode active? */
  isRecording?: boolean
  
  /** Toggle recording mode */
  onRecordToggle?: () => void
}

interface ArsenalVibeItemProps {
  id: string
  label: string
  color: string
  subType: VibeType
  icon: string
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE DEFINITIONS (static - these are mood presets, not effects)
// ═══════════════════════════════════════════════════════════════════════════

const VIBE_ITEMS: ArsenalVibeItemProps[] = [
  { id: 'vibe-chillout', label: 'CHILLOUT', color: VIBE_COLORS.chillout, subType: 'chillout', icon: '🌊' },
  { id: 'vibe-techno', label: 'TECHNO', color: VIBE_COLORS.techno, subType: 'techno', icon: '⚡' },
  { id: 'vibe-ambient', label: 'AMBIENT', color: VIBE_COLORS.ambient, subType: 'ambient', icon: '🌙' },
  { id: 'vibe-rock', label: 'ROCK', color: VIBE_COLORS.rock, subType: 'rock', icon: '🎸' },
  { id: 'vibe-electronic', label: 'ELECTRONIC', color: VIBE_COLORS.electronic, subType: 'electronic', icon: '🎹' },
  { id: 'vibe-ballad', label: 'BALLAD', color: VIBE_COLORS.ballad, subType: 'ballad', icon: '💜' },
  { id: 'vibe-fiesta', label: 'FIESTA', color: VIBE_COLORS['fiesta-latina'], subType: 'fiesta-latina', icon: '🎉' },
  { id: 'vibe-hiphop', label: 'HIP-HOP', color: VIBE_COLORS.hiphop, subType: 'hiphop', icon: '🎤' },
]

// ═══════════════════════════════════════════════════════════════════════════
// DRAGGABLE VIBE ITEM
// ═══════════════════════════════════════════════════════════════════════════

const DraggableVibeItem: React.FC<ArsenalVibeItemProps & { 
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
}> = memo(({ 
  label, 
  color, 
  subType, 
  icon,
  onDragStart,
  onDragEnd,
}) => {
  
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const payload: DragPayload = {
      source: 'arsenal',
      clipType: 'vibe',
      subType: subType,
      defaultDurationMs: 8000, // 8s for vibes
    }
    
    // Type-specific MIME type for dragover detection
    e.dataTransfer.setData('application/luxsync-vibe', serializeDragPayload(payload))
    e.dataTransfer.setData('application/luxsync-clip', serializeDragPayload(payload))
    e.dataTransfer.effectAllowed = 'copyMove'
    
    // Create drag image
    const dragImage = document.createElement('div')
    dragImage.className = 'arsenal-drag-ghost'
    dragImage.textContent = `${icon} ${label}`
    dragImage.style.backgroundColor = color
    dragImage.style.padding = '8px 12px'
    dragImage.style.borderRadius = '4px'
    dragImage.style.color = '#fff'
    dragImage.style.fontWeight = 'bold'
    dragImage.style.fontSize = '12px'
    dragImage.style.position = 'fixed'
    dragImage.style.top = '-100px'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    setTimeout(() => document.body.removeChild(dragImage), 0)
    
    onDragStart?.(payload)
  }, [subType, label, color, icon, onDragStart])
  
  return (
    <div
      className="arsenal-item vibe"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      style={{
        '--item-color': color,
        borderLeftColor: color,
      } as React.CSSProperties}
    >
      <span className="item-icon">{icon}</span>
      <span className="item-label">{label}</span>
    </div>
  )
})

DraggableVibeItem.displayName = 'DraggableVibeItem'

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT ITEM (DYNAMIC FROM REGISTRY)
// ═══════════════════════════════════════════════════════════════════════════

interface EffectItemProps {
  effect: EffectMeta
  isRecording: boolean
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
  onClick?: (effect: EffectMeta) => void
}

const EffectItem: React.FC<EffectItemProps> = memo(({ 
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
      subType: effect.id as any, // Effect ID as subType
      effectId: effect.id,
      defaultDurationMs: effect.suggestedDuration,
    }
    
    // Type-specific MIME type for dragover detection
    e.dataTransfer.setData('application/luxsync-fx', serializeDragPayload(payload))
    e.dataTransfer.setData('application/luxsync-clip', serializeDragPayload(payload))
    e.dataTransfer.effectAllowed = 'copyMove'
    
    // Create drag image with effect info
    const dragImage = document.createElement('div')
    dragImage.className = 'arsenal-drag-ghost'
    dragImage.textContent = `${effect.icon} ${effect.displayName}`
    dragImage.style.backgroundColor = effect.color
    dragImage.style.padding = '8px 12px'
    dragImage.style.borderRadius = '4px'
    dragImage.style.color = '#fff'
    dragImage.style.fontWeight = 'bold'
    dragImage.style.fontSize = '12px'
    dragImage.style.position = 'fixed'
    dragImage.style.top = '-100px'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    setTimeout(() => document.body.removeChild(dragImage), 0)
    
    onDragStart?.(payload)
  }, [effect, onDragStart])
  
  const handleClick = useCallback(() => {
    if (isRecording) {
      // Record mode: click adds clip at playhead
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
      className={`effect-item ${isRecording ? 'recording-mode' : ''} ${effect.hasStrobe ? 'has-strobe' : ''}`}
      draggable={!isRecording}
      onDragStart={isRecording ? undefined : handleDragStart}
      onDragEnd={isRecording ? undefined : onDragEnd}
      onClick={handleClick}
      style={{
        '--effect-color': effect.color,
      } as React.CSSProperties}
      title={effect.description}
    >
      <span className="effect-icon">{effect.icon}</span>
      <span className="effect-name">{effect.displayName}</span>
      <span className="effect-zone">{effect.zone}</span>
      {effect.hasStrobe && <span className="strobe-badge">⚡</span>}
    </div>
  )
})

EffectItem.displayName = 'EffectItem'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ArsenalPanel: React.FC<ArsenalPanelProps> = memo(({
  onDragStart,
  onDragEnd,
  onEffectClick,
  isRecording = false,
  onRecordToggle,
}) => {
  // Get effect categories from registry (dynamic!)
  const categories = useMemo(() => getEffectCategories(), [])
  const totalEffects = useMemo(() => getTotalEffectCount(), [])
  
  return (
    <div className={`chronos-arsenal ${isRecording ? 'recording' : ''}`}>
      {/* Header */}
      <div className="arsenal-header">
        <div className="arsenal-header-top">
          <span className="arsenal-icon">🎨</span>
          <span className="arsenal-title">THE ARSENAL</span>
          <span className="arsenal-count">{totalEffects}</span>
        </div>
        
        {/* Record Mode Toggle */}
        <button 
          className={`record-toggle ${isRecording ? 'active' : ''}`}
          onClick={onRecordToggle}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          <span className="rec-dot">●</span>
          <span className="rec-label">{isRecording ? 'REC' : 'ARM'}</span>
        </button>
      </div>
      
      {/* Mode Indicator */}
      <div className="mode-indicator">
        {isRecording ? (
          <span className="mode recording">🔴 Click to record at playhead</span>
        ) : (
          <span className="mode normal">🖱️ Drag to timeline</span>
        )}
      </div>
      
      {/* Content */}
      <div className="arsenal-content">
        {/* Vibes Section (static) */}
        <Accordion
          title="VIBES"
          icon="🎭"
          color="#9B59B6"
          count={VIBE_ITEMS.length}
          defaultExpanded={true}
        >
          <div className="section-hint">Mood presets for the VIBE track</div>
          <div className="arsenal-items vibes-grid">
            {VIBE_ITEMS.map(item => (
              <DraggableVibeItem
                key={item.id}
                {...item}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>
        </Accordion>
        
        {/* Dynamic Effect Categories */}
        {categories.map(category => (
          <EffectCategorySection
            key={category.id}
            category={category}
            isRecording={isRecording}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onEffectClick={onEffectClick}
          />
        ))}
        
        {/* Help Footer */}
        <div className="arsenal-help">
          <div className="help-item">
            <span className="help-icon">🖱️</span>
            <span>Drag → Timeline</span>
          </div>
          <div className="help-item">
            <span className="help-icon">🔴</span>
            <span>ARM + Click → Record</span>
          </div>
          <div className="help-item">
            <span className="help-icon">🧲</span>
            <span>Auto-snaps to beats</span>
          </div>
        </div>
      </div>
    </div>
  )
})

ArsenalPanel.displayName = 'ArsenalPanel'

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface EffectCategorySectionProps {
  category: EffectCategory
  isRecording: boolean
  onDragStart?: (payload: DragPayload) => void
  onDragEnd?: () => void
  onEffectClick?: (effect: EffectMeta) => void
}

const EffectCategorySection: React.FC<EffectCategorySectionProps> = memo(({
  category,
  isRecording,
  onDragStart,
  onDragEnd,
  onEffectClick,
}) => {
  return (
    <Accordion
      title={category.name}
      icon={category.icon}
      color={category.color}
      count={category.effects.length}
      defaultExpanded={false}
    >
      <div className="effects-grid">
        {category.effects.map(effect => (
          <EffectItem
            key={effect.id}
            effect={effect}
            isRecording={isRecording}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onEffectClick}
          />
        ))}
      </div>
    </Accordion>
  )
})

EffectCategorySection.displayName = 'EffectCategorySection'

export default ArsenalPanel
