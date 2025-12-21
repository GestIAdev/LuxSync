/**
 * 🎛️ VIBE SELECTOR - WAVE 62.5 REDESIGN
 * 
 * Cyberpunk dock-style component for Vibe context switching.
 * Glassmorphism dark theme - NO WHITE BACKGROUNDS.
 * 
 * Design:
 * - Horizontal flex row (dock/footer style)
 * - Transparent/dark backgrounds only
 * - Subtle neon accents on active state only
 * - Compact h-12 buttons, small icons
 */

import React from 'react'
import { Zap, Flame, Mic2, Sofa, Loader2 } from 'lucide-react'
import { useSeleneVibe, VibeId, VibeInfo } from '../../../../hooks/useSeleneVibe'

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
// COLOR CONFIG - Active state colors per vibe
// ============================================================================

const VIBE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  cyan: {
    bg: 'bg-cyan-900/20',
    border: 'border-cyan-500',
    text: 'text-cyan-400',
    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.4)]'
  },
  orange: {
    bg: 'bg-orange-900/20',
    border: 'border-orange-500',
    text: 'text-orange-400',
    glow: 'shadow-[0_0_12px_rgba(249,115,22,0.4)]'
  },
  fuchsia: {
    bg: 'bg-fuchsia-900/20',
    border: 'border-fuchsia-500',
    text: 'text-fuchsia-400',
    glow: 'shadow-[0_0_12px_rgba(217,70,239,0.4)]'
  },
  teal: {
    bg: 'bg-teal-900/20',
    border: 'border-teal-500',
    text: 'text-teal-400',
    glow: 'shadow-[0_0_12px_rgba(45,212,191,0.4)]'
  }
}

// ============================================================================
// VIBE BUTTON - Compact dock-style button
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
  const colors = VIBE_COLORS[vibe.accentColor] || VIBE_COLORS.cyan
  
  // INACTIVE: Dark transparent, subtle border
  // ACTIVE: Colored tint, bright border, glow
  const baseClasses = `
    flex-1 h-12 flex items-center justify-center gap-2
    rounded-md transition-all duration-200 ease-out
    ${isTransitioning ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
  `
  
  const inactiveClasses = `
    bg-black/20 border border-white/10 
    hover:bg-white/5 hover:border-white/20
    text-gray-500
  `
  
  const activeClasses = `
    ${colors.bg} ${colors.border} ${colors.glow}
    border ${colors.text}
  `
  
  return (
    <button
      onClick={onClick}
      disabled={isTransitioning}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
      title={vibe.description}
    >
      {/* Icon */}
      {isTransitioning && isActive ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      
      {/* Label - small mono text */}
      <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
        {vibe.name}
      </span>
    </button>
  )
}

// ============================================================================
// VIBE SELECTOR - Dock/Footer component
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
    <div className="vibe-selector-dock pt-2 border-t border-white/5">
      {/* Dock Row */}
      <div className="flex gap-2">
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
