/**
 * 🎛️ VIBE SELECTOR - WAVE 63.9 POWER INTERLOCK + PROTEUS CUSTOM VIBE TRIGGER
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
 * - 🧬 PROTEUS: 5th "Custom" button opens a popover with saved custom vibes
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Zap, Flame, Mic2, Sofa, Loader2, ChevronUp } from 'lucide-react'
import { useSeleneVibe, VibeId, VibeInfo } from '../../../../hooks/useSeleneVibe'
import { useSystemPower } from '../../../../hooks/useSystemPower'
import { useNavigationStore } from '../../../../stores/navigationStore'
import { VibeAuraIcon } from '../../../icons/LuxIcons'

// ============================================================================
// ICON MAP — canonical vibes use Lucide (existing), Custom uses LuxIcon
// ============================================================================

const ICON_MAP: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
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

// 🧬 PROTEUS: Custom vibe color scheme — cyan-magenta gradient aura
const CUSTOM_STYLE = {
  bgActive: 'rgba(30, 10, 60, 0.6)',
  borderActive: '#a855f7',
  textActive: '#c084fc',
  shadow: '0 0 30px rgba(168, 85, 247, 0.5)',
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
  // PROTEUS FIX 7: Also disable when VibeLab is hijacking the engine.
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
// 🧬 PROTEUS: CUSTOM VIBE BUTTON — 5th button with popover trigger
// ============================================================================

interface CustomVibeButtonProps {
  isActive: boolean          // true if a custom vibe is currently active
  isTransitioning: boolean
  isSystemOn: boolean
  hasCustomVibes: boolean    // false = empty vault, show "no vibes" state
  popoverOpen: boolean
  onTogglePopover: () => void
}

const CustomVibeButton: React.FC<CustomVibeButtonProps> = ({
  isActive,
  isTransitioning,
  isSystemOn,
  hasCustomVibes,
  popoverOpen,
  onTogglePopover,
}) => {
  const showActiveState = isActive && isSystemOn
  const isDisabled = !isSystemOn || isTransitioning
  const colors = CUSTOM_STYLE

  const baseStyle: React.CSSProperties = {
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    outline: 'none',

    // Custom vibe gets a distinct purple-magenta aura
    backgroundColor: showActiveState
      ? colors.bgActive
      : popoverOpen
        ? 'rgba(40, 20, 70, 0.5)'
        : 'rgba(0, 0, 0, 0.4)',
    color: showActiveState
      ? colors.textActive
      : isSystemOn
        ? 'rgba(168, 85, 247, 0.7)'  // purple-500 dimmed
        : 'rgba(100, 100, 100, 0.4)',

    border: `2px solid ${showActiveState ? colors.borderActive : popoverOpen ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
    borderRadius: '12px',

    flex: 1,
    height: '80px',
    minHeight: '80px',

    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',

    boxShadow: showActiveState ? colors.shadow : popoverOpen ? '0 0 15px rgba(168, 85, 247, 0.2)' : 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',

    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isSystemOn ? (isTransitioning ? 0.5 : 1) : 0.4,
    transition: 'all 200ms ease-out',
    position: 'relative',
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

  const chevronStyle: React.CSSProperties = {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '12px',
    height: '12px',
    opacity: 0.5,
    transition: 'transform 200ms ease',
    transform: popoverOpen ? 'rotate(180deg)' : 'rotate(0deg)',
  }

  return (
    <button
      onClick={isDisabled ? undefined : onTogglePopover}
      disabled={isDisabled}
      style={baseStyle}
      title={!hasCustomVibes
        ? 'No custom vibes saved — open Vibe Lab to create one'
        : isSystemOn
          ? 'Browse custom vibes from the Vault'
          : 'System offline'}
      onMouseEnter={(e) => {
        if (!showActiveState && !popoverOpen && isSystemOn) {
          e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.08)'
          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)'
        }
      }}
      onMouseLeave={(e) => {
        if (!showActiveState && !popoverOpen && isSystemOn) {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
        }
      }}
    >
      {/* 🧬 Custom LuxIcon — VibeAura (concentric auras + energy rays) */}
      {isTransitioning && showActiveState ? (
        <Loader2 style={{ ...iconStyle, animation: 'spin 1s linear infinite' }} />
      ) : (
        <VibeAuraIcon size={32} color="currentColor" />
      )}

      <span style={labelStyle}>Custom</span>

      {/* Chevron indicator — shows popover state */}
      {hasCustomVibes && (
        <ChevronUp style={chevronStyle} />
      )}
    </button>
  )
}

// ============================================================================
// 🧬 PROTEUS: CUSTOM VIBE POPOVER — dropdown listing saved custom vibes
// ============================================================================

interface CustomVibePopoverProps {
  customVibes: VibeInfo[]
  activeVibe: string | null
  onSelect: (vibe: VibeInfo) => void
  onClose: () => void
}

const CustomVibePopover: React.FC<CustomVibePopoverProps> = ({
  customVibes,
  activeVibe,
  onSelect,
  onClose,
}) => {
  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    right: 0,
    width: '280px',
    maxHeight: '360px',
    overflowY: 'auto',
    backgroundColor: 'rgba(10, 8, 20, 0.96)',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    borderRadius: '12px',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(168, 85, 247, 0.15)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    padding: '8px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  }

  const headerStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: 'rgba(168, 85, 247, 0.6)',
    padding: '6px 10px 8px',
    borderBottom: '1px solid rgba(168, 85, 247, 0.15)',
    fontFamily: 'ui-monospace, monospace',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  if (customVibes.length === 0) {
    return (
      <div style={popoverStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span>Custom Vibes</span>
        </div>
        <div style={{
          padding: '20px 14px',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.35)',
          fontSize: '12px',
          fontFamily: 'ui-monospace, monospace',
          lineHeight: 1.5,
        }}>
          No custom vibes saved.<br />
          Open the <span style={{ color: 'rgba(168, 85, 247, 0.8)' }}>Vibe Lab</span> to craft one.
        </div>
      </div>
    )
  }

  return (
    <div style={popoverStyle} onClick={(e) => e.stopPropagation()}>
      <div style={headerStyle}>
        <span>Custom Vibes</span>
        <span style={{ opacity: 0.5 }}>{customVibes.length}</span>
      </div>
      {customVibes.map((vibe) => {
        const isActive = activeVibe === vibe.id
        return (
          <CustomVibeRow
            key={vibe.id}
            vibe={vibe}
            isActive={isActive}
            onClick={() => {
              onSelect(vibe)
              onClose()
            }}
          />
        )
      })}
    </div>
  )
}

// ============================================================================
// 🧬 PROTEUS: CUSTOM VIBE ROW — single entry in the popover
// ============================================================================

interface CustomVibeRowProps {
  vibe: VibeInfo
  isActive: boolean
  onClick: () => void
}

const CustomVibeRow: React.FC<CustomVibeRowProps> = ({ vibe, isActive, onClick }) => {
  const glowColor = vibe.glowColor || 'rgba(168, 85, 247, 0.6)'

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: isActive ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
    border: `1px solid ${isActive ? 'rgba(168, 85, 247, 0.4)' : 'transparent'}`,
    transition: 'all 150ms ease-out',
    position: 'relative',
  }

  const dotStyle: React.CSSProperties = {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: glowColor.replace(/[\d.]+\)$/, '1)'),  // full opacity
    boxShadow: `0 0 8px ${glowColor}`,
    flexShrink: 0,
  }

  const nameStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: isActive ? '#c084fc' : 'rgba(255, 255, 255, 0.85)',
    fontFamily: 'ui-monospace, monospace',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  const descStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.35)',
    fontFamily: 'ui-monospace, monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '120px',
  }

  return (
    <div
      style={rowStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.06)'
          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
        }
      }}
    >
      {/* Glow dot — accentHex */}
      <div style={dotStyle} />

      {/* Name + description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
        <span style={nameStyle}>{vibe.name}</span>
        <span style={descStyle}>{vibe.description}</span>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: '#c084fc',
          boxShadow: '0 0 10px #c084fc',
          flexShrink: 0,
        }} />
      )}
    </div>
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

  // 🧬 STATE HIJACK GUARD: Si el Vibe Lab está montado, el Command Deck no
  // debe cambiar el vibe — el Vibe Lab tiene control exclusivo del motor.
  // Keep it stupid simple: just check the active tab.
  const activeTab = useNavigationStore((s) => s.activeTab)
  const isVibeLabHijacking = activeTab === 'vibe-lab'

  // 🧬 PROTEUS: Popover state for custom vibe selection
  const [popoverOpen, setPopoverOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [popoverOpen])

  // Close popover on Escape key
  useEffect(() => {
    if (!popoverOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [popoverOpen])

  // 🧬 PROTEUS: Split allVibes into canonical (4 presets) and custom (custom:*)
  const canonicalVibes = allVibes.filter((v) => !v.id.startsWith('custom:'))
  const customVibes = allVibes.filter((v) => v.id.startsWith('custom:'))
  const hasCustomVibes = customVibes.length > 0
  const isCustomActive = activeVibe?.startsWith('custom:') ?? false

  const handleTogglePopover = useCallback(() => {
    setPopoverOpen((prev) => !prev)
  }, [])

  const handleSelectCustom = useCallback((vibe: VibeInfo) => {
    setVibe(vibe.id)
    setPopoverOpen(false)
  }, [setVibe])

  // Hidden in Ghost Mode (not in Selene mode)
  if (isGhostMode) {
    return null
  }

  const containerStyle: React.CSSProperties = {
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    opacity: isOnline ? (isVibeLabHijacking ? 0.4 : 1) : 0.5,
    transition: 'opacity 300ms ease',
    position: 'relative',  // 🧬 PROTEUS: anchor for popover
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
  }

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      title={isVibeLabHijacking ? 'Vibe Lab has engine control (live preview ON)' : undefined}
    >
      {/* 🧬 PROTEUS: Custom Vibe Popover — renders above the bar */}
      {popoverOpen && (
        <CustomVibePopover
          customVibes={customVibes}
          activeVibe={activeVibe}
          onSelect={handleSelectCustom}
          onClose={() => setPopoverOpen(false)}
        />
      )}

      {/* Dock Row — 4 canonical + 1 Custom trigger */}
      <div style={rowStyle}>
        {canonicalVibes.map((vibe: VibeInfo) => (
          <VibeButton
            key={vibe.id}
            vibe={vibe}
            isActive={activeVibe === vibe.id}
            isTransitioning={isTransitioning}
            isSystemOn={isOnline && !isVibeLabHijacking}
            onClick={() => {
              if (isVibeLabHijacking) return
              setVibe(vibe.id)
            }}
          />
        ))}

        {/* 🧬 PROTEUS: 5th Custom Vibe trigger button */}
        <CustomVibeButton
          isActive={isCustomActive}
          isTransitioning={isTransitioning}
          isSystemOn={isOnline && !isVibeLabHijacking}
          hasCustomVibes={hasCustomVibes}
          popoverOpen={popoverOpen}
          onTogglePopover={() => {
            if (isVibeLabHijacking) return
            handleTogglePopover()
          }}
        />
      </div>
    </div>
  )
}

export default VibeSelector
