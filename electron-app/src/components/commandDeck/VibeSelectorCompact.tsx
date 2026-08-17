/**
 * 🎛️ VIBE SELECTOR COMPACT - WAVE 426 + PROTEUS CUSTOM VIBE TRIGGER
 * Versión compacta del VibeSelector para CommandDeck
 *
 * Diseño:
 * - Botones horizontales más pequeños
 * - Solo íconos con tooltip (nombres visibles en hover)
 * - Integrado con useSeleneVibe + useSystemPower
 * - 🧬 PROTEUS: 5th "Custom" button opens a popover with saved custom vibes
 *
 * Posición en CommandDeck:
 * GrandMaster > VIBES > Blackout
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Zap, Flame, Mic2, Sofa, Loader2 } from 'lucide-react'
import { useSeleneVibe, VibeId, VibeInfo } from '../../hooks/useSeleneVibe'
import { useSystemPower } from '../../hooks/useSystemPower'
import { useNavigationStore } from '../../stores/navigationStore'
import { VibeAuraIcon } from '../icons/LuxIcons'
import './VibeSelectorCompact.css'

// ============================================================================
// ICON MAP — canonical vibes use Lucide (existing)
// ============================================================================

const ICON_MAP: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
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
// 🧬 PROTEUS: CUSTOM VIBE BUTTON COMPACT — 5th button with popover trigger
// ============================================================================

interface CustomVibeButtonCompactProps {
  isActive: boolean
  isTransitioning: boolean
  isSystemOn: boolean
  hasCustomVibes: boolean
  popoverOpen: boolean
  onTogglePopover: () => void
}

const CustomVibeButtonCompact: React.FC<CustomVibeButtonCompactProps> = ({
  isActive,
  isTransitioning,
  isSystemOn,
  hasCustomVibes,
  popoverOpen,
  onTogglePopover,
}) => {
  const showActiveState = isActive && isSystemOn
  const isDisabled = !isSystemOn || isTransitioning

  const buttonClasses = [
    'vibe-btn-compact',
    'vibe-custom',
    showActiveState ? 'active' : '',
    popoverOpen ? 'popover-open' : '',
    isDisabled ? 'disabled' : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      className={buttonClasses}
      onClick={isDisabled ? undefined : onTogglePopover}
      disabled={isDisabled}
      title={!hasCustomVibes
        ? 'No custom vibes saved — open Vibe Lab to create one'
        : isSystemOn
          ? 'Browse custom vibes from the Vault'
          : 'System offline'}
    >
      {isTransitioning && showActiveState ? (
        <Loader2 className="vibe-icon spinning" />
      ) : (
        <VibeAuraIcon size={32} color="currentColor" className="vibe-icon" />
      )}
      <span className="vibe-label">Custom</span>
    </button>
  )
}

// ============================================================================
// 🧬 PROTEUS: CUSTOM VIBE POPOVER COMPACT — dropdown for CommandDeck
// ============================================================================

interface CustomVibePopoverCompactProps {
  customVibes: VibeInfo[]
  activeVibe: string | null
  onSelect: (vibe: VibeInfo) => void
  onClose: () => void
}

const CustomVibePopoverCompact: React.FC<CustomVibePopoverCompactProps> = ({
  customVibes,
  activeVibe,
  onSelect,
  onClose,
}) => {
  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    right: 0,
    width: '260px',
    maxHeight: '320px',
    overflowY: 'auto',
    backgroundColor: 'rgba(10, 8, 20, 0.96)',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    borderRadius: '10px',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(168, 85, 247, 0.15)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    padding: '6px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  }

  const headerStyle: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: 'rgba(168, 85, 247, 0.6)',
    padding: '5px 10px 6px',
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
          padding: '16px 12px',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.35)',
          fontSize: '11px',
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
        const glowColor = vibe.glowColor || 'rgba(168, 85, 247, 0.6)'

        const rowStyle: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 10px',
          borderRadius: '6px',
          cursor: 'pointer',
          backgroundColor: isActive ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
          border: `1px solid ${isActive ? 'rgba(168, 85, 247, 0.4)' : 'transparent'}`,
          transition: 'all 150ms ease-out',
        }

        const dotStyle: React.CSSProperties = {
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: glowColor.replace(/[\d.]+\)$/, '1)'),
          boxShadow: `0 0 6px ${glowColor}`,
          flexShrink: 0,
        }

        const nameStyle: React.CSSProperties = {
          fontSize: '12px',
          fontWeight: 600,
          color: isActive ? '#c084fc' : 'rgba(255, 255, 255, 0.85)',
          fontFamily: 'ui-monospace, monospace',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }

        return (
          <div
            key={vibe.id}
            style={rowStyle}
            onClick={() => {
              onSelect(vibe)
              onClose()
            }}
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
            <div style={dotStyle} />
            <span style={nameStyle}>{vibe.name}</span>
            {isActive && (
              <div style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: '#c084fc',
                boxShadow: '0 0 8px #c084fc',
                flexShrink: 0,
              }} />
            )}
          </div>
        )
      })}
    </div>
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

  // PROTEUS FIX 7: Disable vibe switching when VibeLab is hijacking the engine.
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

  // WAVE 428: Vibes are ALWAYS visible - they're show constraints, not mode-dependent
  // Removed isGhostMode check - vibes apply regardless of manual/selene mode

  return (
    <div
      ref={containerRef}
      className={`vibe-selector-compact ${!isOnline ? 'offline' : ''}`}
      style={{ position: 'relative' }}
    >
      <span className="vibe-label-header">VIBE</span>
      <div className="vibe-buttons-row">
        {canonicalVibes.map((vibe: VibeInfo) => (
          <VibeButtonCompact
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
        <CustomVibeButtonCompact
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

      {/* 🧬 PROTEUS: Custom Vibe Popover — renders above the bar */}
      {popoverOpen && (
        <CustomVibePopoverCompact
          customVibes={customVibes}
          activeVibe={activeVibe}
          onSelect={handleSelectCustom}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  )
}

export default VibeSelectorCompact
