/**
 * 🎛️ VIBE SELECTOR COMPACT - WAVE 426
 * Versión compacta del VibeSelector para CommandDeck
 * 
 * Diseño:
 * - Botones horizontales más pequeños
 * - Solo íconos con tooltip (nombres visibles en hover)
 * - Integrado con useSeleneVibe + useSystemPower
 * 
 * Posición en CommandDeck:
 * GrandMaster > VIBES > Blackout
 */

import React from 'react'
import { Zap, Flame, Mic2, Sofa, Loader2 } from 'lucide-react'
import { useSeleneVibe, VibeId, VibeInfo } from '../../hooks/useSeleneVibe'
import { useSystemPower } from '../../hooks/useSystemPower'
import './VibeSelectorCompact.css'

// ============================================================================
// ICON MAP
// ============================================================================

const ICON_MAP: Record<string, React.ElementType> = {
  'Zap': Zap,
  'Flame': Flame,
  'Mic2': Mic2,
  'Armchair': Sofa
}

// ============================================================================
// VIBE BUTTON - COMPACT VERSION
// ============================================================================

interface VibeButtonCompactProps {
  vibe: VibeInfo
  isActive: boolean
  isTransitioning: boolean
  isSystemOn: boolean
  onClick: () => void
}

const VibeButtonCompact: React.FC<VibeButtonCompactProps> = ({ 
  vibe, 
  isActive, 
  isTransitioning,
  isSystemOn,
  onClick 
}) => {
  const Icon = ICON_MAP[vibe.icon] || Zap
  const showActiveState = isActive && isSystemOn
  const isDisabled = !isSystemOn || isTransitioning
  
  const buttonClasses = [
    'vibe-btn-compact',
    `vibe-${vibe.accentColor}`,
    showActiveState ? 'active' : '',
    isDisabled ? 'disabled' : '',
  ].filter(Boolean).join(' ')
  
  return (
    <button
      className={buttonClasses}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      title={isSystemOn ? `${vibe.name}: ${vibe.description}` : 'System offline'}
    >
      {isTransitioning && showActiveState ? (
        <Loader2 className="vibe-icon spinning" />
      ) : (
        <Icon className="vibe-icon" />
      )}
      <span className="vibe-label">{vibe.name}</span>
    </button>
  )
}

// ============================================================================
// VIBE SELECTOR COMPACT - For CommandDeck
// ============================================================================

export const VibeSelectorCompact: React.FC = () => {
  const { 
    activeVibe, 
    isTransitioning, 
    setVibe, 
    allVibes 
  } = useSeleneVibe()
  
  const { isOnline } = useSystemPower()
  
  // WAVE 428: Vibes are ALWAYS visible - they're show constraints, not mode-dependent
  // Removed isGhostMode check - vibes apply regardless of manual/selene mode
  
  return (
    <div className={`vibe-selector-compact ${!isOnline ? 'offline' : ''}`}>
      <span className="vibe-label-header">VIBE</span>
      <div className="vibe-buttons-row">
        {allVibes.map((vibe: VibeInfo) => (
          <VibeButtonCompact
            key={vibe.id}
            vibe={vibe}
            isActive={activeVibe === vibe.id}
            isTransitioning={isTransitioning}
            isSystemOn={isOnline}
            onClick={() => setVibe(vibe.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default VibeSelectorCompact
