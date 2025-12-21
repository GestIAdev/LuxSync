/**
 * 🎛️ VIBE SELECTOR - WAVE 62.7 NUCLEAR DARK MODE
 * 
 * CSS NUCLEAR: Force dark mode with inline styles + !important.
 * Industrial-size buttons (h-20) at footer of SeleneBrain.
 * 
 * Design:
 * - INLINE STYLES to override any CSS contamination
 * - appearance: none to kill browser defaults
 * - h-20 (80px) industrial size buttons
 * - Large icons (w-8 h-8)
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
  onClick: () => void
}

const VibeButton: React.FC<VibeButtonProps> = ({ 
  vibe, 
  isActive, 
  isTransitioning,
  onClick 
}) => {
  const Icon = ICON_MAP[vibe.icon] || Zap
  const colors = VIBE_STYLES[vibe.accentColor] || VIBE_STYLES.cyan
  
  // NUCLEAR INLINE STYLES - Cannot be overridden
  const baseStyle: React.CSSProperties = {
    // RESET BROWSER DEFAULTS
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    outline: 'none',
    
    // FORCE DARK
    backgroundColor: isActive ? colors.bgActive : 'rgba(0, 0, 0, 0.4)',
    color: isActive ? colors.textActive : 'rgba(156, 163, 175, 0.8)', // gray-400
    
    // BORDERS
    border: `2px solid ${isActive ? colors.borderActive : 'rgba(255, 255, 255, 0.1)'}`,
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
    
    // EFFECTS
    boxShadow: isActive ? colors.shadow : 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    
    // INTERACTION
    cursor: isTransitioning ? 'wait' : 'pointer',
    opacity: isTransitioning ? 0.5 : 1,
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
    opacity: isActive ? 1 : 0.7,
    color: 'inherit',
    fontFamily: 'ui-monospace, monospace',
  }
  
  return (
    <button
      onClick={onClick}
      disabled={isTransitioning}
      style={baseStyle}
      title={vibe.description}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
        }
      }}
    >
      {/* Icon - LARGE */}
      {isTransitioning && isActive ? (
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
  
  // Hidden in Ghost Mode (not in Selene mode)
  if (isGhostMode) {
    return null
  }
  
  const containerStyle: React.CSSProperties = {
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
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
            onClick={() => setVibe(vibe.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default VibeSelector
