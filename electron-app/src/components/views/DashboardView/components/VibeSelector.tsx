/**
 * 🎛️ VIBE SELECTOR - WAVE 62
 * 
 * Cyberpunk UI component for selecting active Vibe context.
 * Rendered inside SeleneBrain panel, hidden in Ghost Mode.
 * 
 * Design:
 * - Grid 2x2 layout (responsive 1x4 on wide screens)
 * - Dark backdrop with neon accents
 * - Active state has colored glow per Vibe
 * - Transition animation on selection
 */

import React from 'react'
import { Zap, Flame, Mic2, Armchair, Loader2 } from 'lucide-react'
import { useSeleneVibe, VibeId, VibeInfo } from '../../../../hooks/useSeleneVibe'

// ============================================================================
// ICON MAP
// ============================================================================

const ICON_MAP: Record<string, React.ElementType> = {
  'Zap': Zap,
  'Flame': Flame,
  'Mic2': Mic2,
  'Armchair': Armchair
}

// ============================================================================
// VIBE BUTTON
// ============================================================================

interface VibeButtonProps {
  vibe: VibeInfo
  isActive: boolean
  isTransitioning: boolean
  onClick: () => void
}

const VibeButton: React.FC<VibeButtonProps> = ({ 
  vibe, 
  isActive, 
  isTransitioning,
  onClick 
}) => {
  const Icon = ICON_MAP[vibe.icon] || Zap
  
  // Dynamic classes based on vibe color
  const colorClasses: Record<string, { border: string; text: string; glow: string }> = {
    cyan: {
      border: 'border-cyan-500',
      text: 'text-cyan-400',
      glow: 'shadow-[0_0_15px_rgba(6,182,212,0.6)]'
    },
    orange: {
      border: 'border-orange-500',
      text: 'text-orange-400',
      glow: 'shadow-[0_0_15px_rgba(249,115,22,0.6)]'
    },
    fuchsia: {
      border: 'border-fuchsia-500',
      text: 'text-fuchsia-400',
      glow: 'shadow-[0_0_15px_rgba(217,70,239,0.6)]'
    },
    teal: {
      border: 'border-teal-500',
      text: 'text-teal-400',
      glow: 'shadow-[0_0_15px_rgba(45,212,191,0.6)]'
    }
  }
  
  const colors = colorClasses[vibe.accentColor] || colorClasses.cyan
  
  return (
    <button
      onClick={onClick}
      disabled={isTransitioning}
      className={`
        relative flex flex-col items-center justify-center gap-1 p-3 rounded-lg
        transition-all duration-300 ease-out
        ${isActive 
          ? `bg-black/60 ${colors.border} ${colors.glow} border-2` 
          : 'bg-black/40 border border-white/10 hover:border-white/30 hover:bg-black/50'
        }
        ${isTransitioning ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
        backdrop-blur-sm
      `}
      title={vibe.description}
    >
      {/* Glow ring when active */}
      {isActive && (
        <div className={`
          absolute inset-0 rounded-lg 
          bg-gradient-to-t from-transparent via-transparent to-white/5
          pointer-events-none
        `} />
      )}
      
      {/* Icon */}
      <div className={`
        relative z-10
        ${isActive ? colors.text : 'text-white/60'}
        transition-colors duration-300
      `}>
        {isTransitioning && isActive ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Icon className="w-5 h-5" />
        )}
      </div>
      
      {/* Label */}
      <span className={`
        text-xs font-medium tracking-wide relative z-10
        ${isActive ? colors.text : 'text-white/50'}
        transition-colors duration-300
      `}>
        {vibe.name}
      </span>
      
      {/* Active indicator dot */}
      {isActive && (
        <div className={`
          absolute -top-1 -right-1 w-2 h-2 rounded-full
          ${vibe.accentColor === 'cyan' && 'bg-cyan-400'}
          ${vibe.accentColor === 'orange' && 'bg-orange-400'}
          ${vibe.accentColor === 'fuchsia' && 'bg-fuchsia-400'}
          ${vibe.accentColor === 'teal' && 'bg-teal-400'}
          animate-pulse
        `} />
      )}
    </button>
  )
}

// ============================================================================
// VIBE SELECTOR COMPONENT
// ============================================================================

export const VibeSelector: React.FC = () => {
  const { 
    activeVibe, 
    isTransitioning, 
    setVibe, 
    isGhostMode,
    allVibes 
  } = useSeleneVibe()
  
  // Hidden in Ghost Mode (not in Selene mode)
  if (isGhostMode) {
    return null
  }
  
  return (
    <div className="vibe-selector mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-xs text-white/30 uppercase tracking-widest font-mono">
          Vibe Context
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
      </div>
      
      {/* Grid */}
      <div className="grid grid-cols-4 gap-2">
        {allVibes.map((vibe: VibeInfo) => (
          <VibeButton
            key={vibe.id}
            vibe={vibe}
            isActive={activeVibe === vibe.id}
            isTransitioning={isTransitioning}
            onClick={() => setVibe(vibe.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default VibeSelector
