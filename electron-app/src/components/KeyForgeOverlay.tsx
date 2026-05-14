/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-B: KEYFORGE — HOLOGRAPHIC KEYBOARD OVERLAY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Floating, immersive holographic overlay that renders a QWERTY keyboard
 * color-coded by action family. Updates live when modifiers are held.
 *
 * Features:
 *   - Action-family color coding (Intensity, Kinetic, Selection, …)
 *   - Real-time layer switching (base / alt / kinetic / select / …)
 *   - Click to enter learn mode for a slot (starts listening).
 *   - Right-click to unbind a slot.
 *   - Fade + scale entrance / exit transitions.
 *   - Does NOT push or anchor layout elements — purely floating.
 *
 * @module components/KeyForgeOverlay
 * @version WAVE 4800-B
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useKeyMapStore, selectIsLearning, selectBindings, selectCurrentLayer, selectListening } from '../stores/keyMapStore'
import type { KeyCode, LayerId } from '../keyforge/types'
import { MODIFIER_KEYS } from '../keyforge/types'
import { isFireable } from '../keyforge/KeyActionDispatcher'

// ═══════════════════════════════════════════════════════════════════════════
// ACTION FAMILY CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

type ActionFamily =
  | 'intensity'   // ctrl-*, arb-grand-master
  | 'kinetic'     // kin-*
  | 'selection'   // sel-*
  | 'effect'      // fx-*
  | 'vibe'        // vibe-*
  | 'arbiter'     // arb-* (blackout, kill)
  | 'tungsten'    // tung-*
  | 'cue'         // cue-*
  | 'ui'          // ui-*, kf-*
  | 'unbound'

function classifyAction(actionId: string | undefined): ActionFamily {
  if (!actionId) return 'unbound'
  if (actionId.startsWith('ctrl-')) return 'intensity'
  if (actionId.startsWith('kin-'))  return 'kinetic'
  if (actionId.startsWith('sel-'))  return 'selection'
  if (actionId.startsWith('fx-'))   return 'effect'
  if (actionId.startsWith('vibe-')) return 'vibe'
  if (actionId.startsWith('arb-'))  return 'arbiter'
  if (actionId.startsWith('tung-')) return 'tungsten'
  if (actionId.startsWith('cue-'))  return 'cue'
  if (actionId.startsWith('ui-') || actionId.startsWith('kf-')) return 'ui'
  return 'unbound'
}

const FAMILY_COLORS: Record<ActionFamily, { bg: string; glow: string; text: string }> = {
  intensity:  { bg: '#1a0a2e', glow: '#a855f7', text: '#d8b4fe' },
  kinetic:    { bg: '#0a1e2e', glow: '#38bdf8', text: '#bae6fd' },
  selection:  { bg: '#0a2a1a', glow: '#34d399', text: '#a7f3d0' },
  effect:     { bg: '#2e1a0a', glow: '#fb923c', text: '#fed7aa' },
  vibe:       { bg: '#2e0a2a', glow: '#e879f9', text: '#f5d0fe' },
  arbiter:    { bg: '#2e0a0a', glow: '#f87171', text: '#fecaca' },
  tungsten:   { bg: '#1f1a0a', glow: '#fbbf24', text: '#fef08a' },
  cue:        { bg: '#0a1e1e', glow: '#2dd4bf', text: '#99f6e4' },
  ui:         { bg: '#141414', glow: '#9ca3af', text: '#d1d5db' },
  unbound:    { bg: '#0f0f0f', glow: '#374151', text: '#4b5563' },
}

const FAMILY_LABELS: Record<ActionFamily, string> = {
  intensity:  'Intensity',
  kinetic:    'Kinetic',
  selection:  'Selection',
  effect:     'Effect',
  vibe:       'Vibe',
  arbiter:    'Arbiter',
  tungsten:   'Tungsten',
  cue:        'Cue',
  ui:         'UI/Meta',
  unbound:    'Unbound',
}

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARD LAYOUT (QWERTY visual model)
// ═══════════════════════════════════════════════════════════════════════════

/** One key in the visual layout. `w` is relative width (1 = 1 unit). */
interface LayoutKey {
  code: KeyCode
  label: string
  w?: number   // default 1
  h?: number   // default 1
}

type LayoutRow = LayoutKey[]

const LAYOUT_ROWS: LayoutRow[] = [
  // ── Row 0: Digits + Backspace ─────────────────────────────────────────
  [
    { code: 'Backquote', label: '`' },
    { code: '1', label: '1' }, { code: '2', label: '2' },
    { code: '3', label: '3' }, { code: '4', label: '4' },
    { code: '5', label: '5' }, { code: '6', label: '6' },
    { code: '7', label: '7' }, { code: '8', label: '8' },
    { code: '9', label: '9' }, { code: '0', label: '0' },
    { code: 'Minus', label: '-' }, { code: 'Equal', label: '=' },
    { code: 'Backspace', label: '⌫', w: 2 },
  ],
  // ── Row 1: QWERTYUIOP ─────────────────────────────────────────────────
  [
    { code: 'Tab', label: 'TAB', w: 1.5 },
    { code: 'Q', label: 'Q' }, { code: 'W', label: 'W' },
    { code: 'E', label: 'E' }, { code: 'R', label: 'R' },
    { code: 'T', label: 'T' }, { code: 'Y', label: 'Y' },
    { code: 'U', label: 'U' }, { code: 'I', label: 'I' },
    { code: 'O', label: 'O' }, { code: 'P', label: 'P' },
    { code: 'BracketLeft', label: '[' }, { code: 'BracketRight', label: ']' },
    { code: 'Backslash', label: '\\', w: 1.5 },
  ],
  // ── Row 2: ASDFGHJKL ──────────────────────────────────────────────────
  [
    { code: 'CapsLock', label: 'CAPS', w: 1.75 },
    { code: 'A', label: 'A' }, { code: 'S', label: 'S' },
    { code: 'D', label: 'D' }, { code: 'F', label: 'F' },
    { code: 'G', label: 'G' }, { code: 'H', label: 'H' },
    { code: 'J', label: 'J' }, { code: 'K', label: 'K' },
    { code: 'L', label: 'L' },
    { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" },
    { code: 'Enter', label: 'ENTER', w: 2.25 },
  ],
  // ── Row 3: ZXCVBNM ────────────────────────────────────────────────────
  [
    { code: 'Shift', label: 'SHIFT', w: 2.25 },
    { code: 'Z', label: 'Z' }, { code: 'X', label: 'X' },
    { code: 'C', label: 'C' }, { code: 'V', label: 'V' },
    { code: 'B', label: 'B' }, { code: 'N', label: 'N' },
    { code: 'M', label: 'M' },
    { code: 'Comma', label: ',' }, { code: 'Period', label: '.' },
    { code: 'Slash', label: '/' },
    { code: 'Shift', label: 'SHIFT', w: 2.75 },
  ],
  // ── Row 4: Spacebar ───────────────────────────────────────────────────
  [
    { code: 'Control', label: 'CTRL', w: 1.25 },
    { code: 'Meta',    label: 'WIN',  w: 1.25 },
    { code: 'Alt',     label: 'ALT',  w: 1.25 },
    { code: 'Space',   label: '',     w: 6.25 },
    { code: 'Alt',     label: 'ALT',  w: 1.25 },
    { code: 'Control', label: 'CTRL', w: 1.25 },
  ],
]

// ═══════════════════════════════════════════════════════════════════════════
// LAYER BADGE METADATA
// ═══════════════════════════════════════════════════════════════════════════

const LAYER_META: Record<LayerId, { label: string; color: string }> = {
  base:    { label: 'BASE',    color: '#9ca3af' },
  alt:     { label: 'ALT',     color: '#e879f9' },
  cmd:     { label: 'CMD',     color: '#60a5fa' },
  select:  { label: 'SELECT',  color: '#34d399' },
  kinetic: { label: 'KINETIC', color: '#38bdf8' },
  forge:   { label: 'FORGE',   color: '#fb923c' },
}

// ═══════════════════════════════════════════════════════════════════════════
// KEY CELL
// ═══════════════════════════════════════════════════════════════════════════

interface KeyCellProps {
  code: KeyCode
  label: string
  w: number
  layer: LayerId
  bindings: Readonly<Record<string, { actionId: string; behavior: { kind: string } }>>
  listeningSlot: { layer: LayerId; key: KeyCode | null } | null
  lastBoundKey: string | null
  isLearning: boolean
  onBind: (code: KeyCode) => void
  onUnbind: (code: KeyCode) => void
  unitPx: number
}

const UNIT_GAP_PX = 3

const KeyCell: React.FC<KeyCellProps> = ({
  code, label, w, layer, bindings, listeningSlot, lastBoundKey,
  isLearning, onBind, onUnbind, unitPx,
}) => {
  const isModifier = MODIFIER_KEYS.has(code)
  const storageKey = `${layer}::${code}`
  const binding = bindings[storageKey]
  const actionId = binding?.actionId
  const family = classifyAction(actionId)
  const colors = FAMILY_COLORS[family]

  const isListening = !!listeningSlot
    && listeningSlot.layer === layer
    && (listeningSlot.key === null || listeningSlot.key === code)

  const isFlashing = lastBoundKey === storageKey

  const widthPx = w * unitPx + (w - 1) * UNIT_GAP_PX

  const handleClick = useCallback(() => {
    if (!isLearning || isModifier) return
    onBind(code)
  }, [isLearning, isModifier, onBind, code])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!isLearning || isModifier) return
    onUnbind(code)
  }, [isLearning, isModifier, onUnbind, code])

  const glowColor = isListening
    ? '#fb923c'
    : isFlashing
    ? '#ffffff'
    : colors.glow

  const bgColor = isListening
    ? '#2e1800'
    : colors.bg

  const opacity = isModifier ? 0.45 : (family === 'unbound' ? 0.55 : 1)

  const actionShort = actionId
    ? actionId.length > 12 ? actionId.slice(0, 10) + '…' : actionId
    : null

  return (
    <div
      className="kfo-key"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={actionId
        ? `${layer}::${code} → ${actionId} (${binding?.behavior.kind})\nClick to rebind · Right-click to unbind`
        : `${layer}::${code} — unbound\nClick to bind`}
      style={{
        width:    `${widthPx}px`,
        minWidth: `${widthPx}px`,
        height:   `${unitPx}px`,
        background: bgColor,
        boxShadow: family !== 'unbound'
          ? `0 0 8px ${glowColor}60, inset 0 0 4px ${glowColor}30`
          : 'none',
        border: `1px solid ${glowColor}`,
        opacity,
        cursor: isLearning && !isModifier ? 'pointer' : 'default',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px',
        boxSizing: 'border-box',
        transition: 'box-shadow 0.15s, background 0.15s, border-color 0.15s',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Physical key label */}
      <span style={{
        fontSize: '9px',
        fontFamily: 'monospace',
        color: isModifier ? '#6b7280' : colors.text,
        lineHeight: 1,
        fontWeight: 700,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        textShadow: family !== 'unbound'
          ? `0 0 6px ${glowColor}`
          : 'none',
      }}>
        {label}
      </span>

      {/* Action label (only if bound) */}
      {actionShort && (
        <span style={{
          fontSize: '7px',
          fontFamily: 'monospace',
          color: `${colors.text}bb`,
          lineHeight: 1,
          marginTop: '2px',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          textAlign: 'center',
        }}>
          {actionShort}
        </span>
      )}

      {/* Listening pulse ring */}
      {isListening && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '3px',
          boxShadow: '0 0 0 2px #fb923c',
          animation: 'kfo-pulse 0.9s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGEND ROW
// ═══════════════════════════════════════════════════════════════════════════

const LegendRow: React.FC = () => (
  <div style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  }}>
    {(Object.keys(FAMILY_LABELS) as ActionFamily[])
      .filter(f => f !== 'unbound')
      .map(family => {
        const c = FAMILY_COLORS[family]
        return (
          <div key={family} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '2px',
              background: c.bg,
              border: `1px solid ${c.glow}`,
              boxShadow: `0 0 4px ${c.glow}`,
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: '9px',
              fontFamily: 'monospace',
              color: c.text,
              letterSpacing: '0.04em',
            }}>
              {FAMILY_LABELS[family]}
            </span>
          </div>
        )
      })}
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// MAIN OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

/** Props injected from TitleBar pill button */
interface KeyForgeOverlayProps {
  isVisible: boolean
  onClose: () => void
}

const LAYER_ORDER: LayerId[] = ['base', 'alt', 'kinetic', 'select', 'cmd', 'forge']
const UNIT_PX = 46   // 1 key-unit = 46px

const KeyForgeOverlay: React.FC<KeyForgeOverlayProps> = ({ isVisible, onClose }) => {
  // ── Store selectors ──────────────────────────────────────────────────────
  const isLearning   = useKeyMapStore(selectIsLearning)
  const bindings     = useKeyMapStore(selectBindings)
  const currentLayer = useKeyMapStore(selectCurrentLayer)
  const listeningSlot = useKeyMapStore(selectListening)
  const lastBoundKey = useKeyMapStore(s => s.lastBoundKey)

  const {
    toggleLearnMode,
    startListeningSlot,
    unbindKey,
    cancelListening,
    clearLayer,
  } = useKeyMapStore.getState()

  // ── Local state ──────────────────────────────────────────────────────────
  const [viewLayer, setViewLayer] = useState<LayerId>('base')
  const [mounted, setMounted]     = useState(false)
  const overlayRef                = useRef<HTMLDivElement>(null)

  // Sync viewed layer with active layer
  useEffect(() => {
    setViewLayer(currentLayer)
  }, [currentLayer])

  // Mount / unmount for transition
  useEffect(() => {
    if (isVisible) {
      requestAnimationFrame(() => setMounted(true))
    } else {
      setMounted(false)
    }
  }, [isVisible])

  // Close on Escape
  useEffect(() => {
    if (!isVisible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [isVisible, onClose])

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      cancelListening()
      onClose()
    }
  }, [cancelListening, onClose])

  // Binding click → start listening on that slot
  const handleBind = useCallback((code: KeyCode) => {
    startListeningSlot({ layer: viewLayer, key: code })
  }, [startListeningSlot, viewLayer])

  // Right-click → unbind
  const handleUnbind = useCallback((code: KeyCode) => {
    unbindKey(viewLayer, code)
  }, [unbindKey, viewLayer])

  // Count bound keys in active layer
  const boundCount = useMemo(() => {
    const prefix = `${viewLayer}::`
    return Object.keys(bindings).filter(k => k.startsWith(prefix)).length
  }, [bindings, viewLayer])

  if (!isVisible && !mounted) return null

  const layerMeta = LAYER_META[viewLayer]

  return (
    <>
      {/* Inject keyframe animation */}
      <style>{`
        @keyframes kfo-pulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes kfo-enter {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes kfo-exit {
          from { opacity: 1; transform: translateY(0)  scale(1); }
          to   { opacity: 0; transform: translateY(6px) scale(0.98); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: '32px',
          animation: mounted
            ? 'kfo-enter 0.2s ease-out forwards'
            : 'kfo-exit 0.15s ease-in forwards',
        }}
      >
        {/* Panel */}
        <div
          ref={overlayRef}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(180deg, #0c0c14 0%, #080810 100%)',
            border: `1px solid ${layerMeta.color}40`,
            borderRadius: '10px',
            boxShadow: `0 0 40px ${layerMeta.color}25, 0 24px 64px rgba(0,0,0,0.8)`,
            padding: '16px',
            maxWidth: '900px',
            width: '100%',
          }}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            {/* Glowing title */}
            <span style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: '#ffffff',
              textShadow: '0 0 10px #fb923c',
              textTransform: 'uppercase',
            }}>
              ⌨ KEYFORGE
            </span>

            {/* Layer badge */}
            <span style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              color: layerMeta.color,
              background: `${layerMeta.color}18`,
              border: `1px solid ${layerMeta.color}50`,
              borderRadius: '4px',
              padding: '2px 6px',
              textShadow: `0 0 8px ${layerMeta.color}`,
            }}>
              {layerMeta.label}
            </span>

            {/* Bound count */}
            <span style={{
              fontSize: '9px',
              fontFamily: 'monospace',
              color: '#6b7280',
            }}>
              {boundCount} bound
            </span>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Learn mode toggle */}
            <button
              onClick={toggleLearnMode}
              style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                letterSpacing: '0.08em',
                fontWeight: 700,
                color: isLearning ? '#fb923c' : '#6b7280',
                background: isLearning ? '#2e1800' : '#1a1a1a',
                border: `1px solid ${isLearning ? '#fb923c80' : '#374151'}`,
                borderRadius: '4px',
                padding: '3px 10px',
                cursor: 'pointer',
                textShadow: isLearning ? '0 0 8px #fb923c' : 'none',
                boxShadow: isLearning ? '0 0 12px #fb923c40' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {isLearning ? '● LEARNING' : '○ LEARN'}
            </button>

            {/* Clear layer button */}
            <button
              onClick={() => clearLayer(viewLayer)}
              title={`Clear all bindings in "${viewLayer}" layer`}
              style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                letterSpacing: '0.08em',
                color: '#9ca3af',
                background: '#1a1a1a',
                border: '1px solid #374151',
                borderRadius: '4px',
                padding: '3px 10px',
                cursor: 'pointer',
              }}
            >
              CLR LAYER
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              title="Close KeyForge [Esc]"
              style={{
                fontSize: '11px',
                lineHeight: 1,
                color: '#6b7280',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              ✕
            </button>
          </div>

          {/* ── Layer tab row ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
            {LAYER_ORDER.map(lid => {
              const meta = LAYER_META[lid]
              const isActive = lid === viewLayer
              const prefix = `${lid}::`
              const cnt = Object.keys(bindings).filter(k => k.startsWith(prefix)).length
              return (
                <button
                  key={lid}
                  onClick={() => setViewLayer(lid)}
                  style={{
                    fontSize: '9px',
                    fontFamily: 'monospace',
                    letterSpacing: '0.08em',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? meta.color : '#6b7280',
                    background: isActive ? `${meta.color}18` : 'transparent',
                    border: `1px solid ${isActive ? meta.color + '60' : '#374151'}`,
                    borderRadius: '4px',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    textShadow: isActive ? `0 0 6px ${meta.color}` : 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  {meta.label}
                  {cnt > 0 && (
                    <span style={{ marginLeft: '4px', color: `${meta.color}cc` }}>{cnt}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Keyboard ──────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${UNIT_GAP_PX}px` }}>
            {LAYOUT_ROWS.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: `${UNIT_GAP_PX}px` }}>
                {row.map((key, ki) => (
                  <KeyCell
                    key={`${key.code}-${ki}`}
                    code={key.code}
                    label={key.label}
                    w={key.w ?? 1}
                    layer={viewLayer}
                    bindings={bindings}
                    listeningSlot={listeningSlot}
                    lastBoundKey={lastBoundKey}
                    isLearning={isLearning}
                    onBind={handleBind}
                    onUnbind={handleUnbind}
                    unitPx={UNIT_PX}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* ── Legend ─────────────────────────────────────────────────── */}
          <LegendRow />

          {/* ── Learn mode hint ─────────────────────────────────────────── */}
          {isLearning && (
            <div style={{
              marginTop: '8px',
              fontSize: '9px',
              fontFamily: 'monospace',
              color: '#fb923c',
              letterSpacing: '0.06em',
              textShadow: '0 0 6px #fb923c80',
            }}>
              {listeningSlot
                ? `👂 Waiting for key press → ${listeningSlot.layer}::${listeningSlot.key ?? '<next>'}`
                : '⌨ Click a key to bind it · Right-click to unbind'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default KeyForgeOverlay
