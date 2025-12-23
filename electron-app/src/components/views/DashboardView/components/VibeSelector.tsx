/**
 * 🎛️ VIBE SELECTOR - WAVE 63.9 POWER INTERLOCK
 * 
 * CSS NUCLEAR: Force dark mode with inline styles + !important.
 * Industrial-size buttons (h-20) at footer of SeleneBrain.
 * 
 * Design:
 * - INLINE STYLES to override any CSS contamination
 * - appearance: none to kill browser defaults
 * - h-20 (80px) industrial size buttons
 * - Large icons (w-8 h-8)
 * - 🔌 POWER INTERLOCK: Buttons disabled/dimmed when system is OFFLINE
 */

import React from 'react'
import { Zap, Flame, Mic2, Sofa, Loader2 } from 'lucide-react'
import { useSeleneVibe, VibeId, VibeInfo } from '../../../../hooks/useSeleneVibe'
import { useSystemPower } from '../../../../hooks/useSystemPower'

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
// COLOR CONFIG - NEON ACTIVE STATES
// ============================================================================

const VIBE_STYLES: Record<string, { 
  bgActive: string
  borderActive: string  
  textActive: string
  shadow: string
}> = {
  cyan: {
    bgActive: 'rgba(8, 51, 68, 0.5)',      // cyan-950/50
    borderActive: '#06b6d4',                // cyan-500
    textActive: '#22d3ee',                  // cyan-400
    shadow: '0 0 30px rgba(6, 182, 212, 0.4)'
  },
  orange: {
    bgActive: 'rgba(67, 20, 7, 0.5)',       // orange-950/50
    borderActive: '#f97316',                 // orange-500
    textActive: '#fb923c',                   // orange-400
    shadow: '0 0 30px rgba(249, 115, 22, 0.4)'
  },
  fuchsia: {
    bgActive: 'rgba(74, 4, 78, 0.5)',       // fuchsia-950/50
    borderActive: '#d946ef',                 // fuchsia-500
    textActive: '#e879f9',                   // fuchsia-400
    shadow: '0 0 30px rgba(217, 70, 239, 0.4)'
  },
  teal: {
    bgActive: 'rgba(4, 47, 46, 0.5)',       // teal-950/50
    borderActive: '#14b8a6',                 // teal-500
    textActive: '#2dd4bf',                   // teal-400
    shadow: '0 0 30px rgba(45, 212, 191, 0.4)'
  }
}

// ============================================================================
// VIBE BUTTON - INDUSTRIAL SIZE with INLINE STYLES
// ============================================================================

interface VibeButtonProps {
  vibe: VibeInfo
  isActive: boolean
  isTransitioning: boolean
  isSystemOn: boolean  // 🔌 WAVE 63.9: Power interlock
  onClick: () => void
}

const VibeButton: React.FC<VibeButtonProps> = ({ 
  vibe, 
  isActive, 
  isTransitioning,
  isSystemOn,
  onClick 
}) => {
  const Icon = ICON_MAP[vibe.icon] || Zap
  const colors = VIBE_STYLES[vibe.accentColor] || VIBE_STYLES.cyan
  
  // 🔌 WAVE 63.9: Only show active state if system is ON
  const showActiveState = isActive && isSystemOn
  const isDisabled = !isSystemOn || isTransitioning
  
  // NUCLEAR INLINE STYLES - Cannot be overridden
  const baseStyle: React.CSSProperties = {
    // RESET BROWSER DEFAULTS
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    outline: 'none',
    
    // FORCE DARK - dimmed when system is OFF
    backgroundColor: showActiveState ? colors.bgActive : 'rgba(0, 0, 0, 0.4)',
    color: showActiveState 
      ? colors.textActive 
      : isSystemOn 
        ? 'rgba(156, 163, 175, 0.8)' // gray-400 (normal inactive)
        : 'rgba(100, 100, 100, 0.4)', // very dim when system OFF
    
    // BORDERS - only colored if active AND system is ON
    border: `2px solid ${showActiveState ? colors.borderActive : 'rgba(255, 255, 255, 0.1)'}`,
    borderRadius: '12px',
    
    // SIZE - INDUSTRIAL
    flex: 1,
    height: '80px',
    minHeight: '80px',
    
    // LAYOUT
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    
    // EFFECTS - no glow when system is OFF
    boxShadow: showActiveState ? colors.shadow : 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    
    // INTERACTION
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isSystemOn ? (isTransitioning ? 0.5 : 1) : 0.4,
    transition: 'all 200ms ease-out',
  }
  
  const iconStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    color: 'inherit',
  }
  
  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    opacity: showActiveState ? 1 : 0.7,
    color: 'inherit',
    fontFamily: 'ui-monospace, monospace',
  }
  
  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      style={baseStyle}
      title={isSystemOn ? vibe.description : 'System offline'}
      onMouseEnter={(e) => {
        if (!showActiveState && isSystemOn) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
        }
      }}
      onMouseLeave={(e) => {
        if (!showActiveState && isSystemOn) {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
        }
      }}
    >
      {/* Icon - LARGE */}
      {isTransitioning && showActiveState ? (
        <Loader2 style={{ ...iconStyle, animation: 'spin 1s linear infinite' }} />
      ) : (
        <Icon style={iconStyle} />
      )}
      
      {/* Label */}
      <span style={labelStyle}>
        {vibe.name}
      </span>
    </button>
  )
}

// ============================================================================
// VIBE SELECTOR - FOOTER DOCK with mt-auto
// ============================================================================

export const VibeSelector: React.FC = () => {
  const { 
    activeVibe, 
    isTransitioning, 
    setVibe, 
    isGhostMode,
    allVibes 
  } = useSeleneVibe()
  
  // 🔌 WAVE 63.9: Power state interlock
  const { isOnline } = useSystemPower()
  
  // Hidden in Ghost Mode (not in Selene mode)
  if (isGhostMode) {
    return null
  }
  
  const containerStyle: React.CSSProperties = {
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    opacity: isOnline ? 1 : 0.5,
    transition: 'opacity 300ms ease',
  }
  
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
  }
  
  return (
    <div style={containerStyle}>
      {/* Dock Row */}
      <div style={rowStyle}>
        {allVibes.map((vibe: VibeInfo) => (
          <VibeButton
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

export default VibeSelector
