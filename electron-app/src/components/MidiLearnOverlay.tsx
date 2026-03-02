/**
 * 🎹 WAVE 2047: MIDI LEARN OVERLAY - OPERATION "GHOST LIMBS"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Global floating button + learn mode overlay.
 * 
 * STATES:
 * 1. IDLE: Small "MIDI" button (top-right, near NET indicator)
 * 2. LEARN MODE: Full overlay with all mappable controls visible
 *    - Click a control → "Listening..."
 *    - Move a physical MIDI control → Mapped! (green flash)
 *    - ESC or click button again → Exit learn mode
 * 
 * @module components/MidiLearnOverlay
 * @version WAVE 2047
 */

import { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  useMidiMapStore,
  MAPPABLE_CONTROLS,
  type MappableControlId,
  type MidiBinding,
} from '../stores/midiMapStore'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function MidiLearnOverlay() {
  // ── Store ──
  const {
    learnMode,
    listeningControl,
    lastMapped,
    mappings,
  } = useMidiMapStore(useShallow((s) => ({
    learnMode: s.learnMode,
    listeningControl: s.listeningControl,
    lastMapped: s.lastMapped,
    mappings: s.mappings,
  })))

  const {
    enterLearnMode,
    exitLearnMode,
    startListening,
    removeMapping,
  } = useMidiMapStore(useShallow((s) => ({
    enterLearnMode: s.enterLearnMode,
    exitLearnMode: s.exitLearnMode,
    startListening: s.startListening,
    removeMapping: s.removeMapping,
  })))

  const mappingCount = Object.keys(mappings).length

  // ── ESC to exit learn mode ──
  useEffect(() => {
    if (!learnMode) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        exitLearnMode()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [learnMode, exitLearnMode])

  // ── Toggle learn mode ──
  const handleToggle = useCallback(() => {
    if (learnMode) {
      exitLearnMode()
    } else {
      enterLearnMode()
    }
  }, [learnMode, enterLearnMode, exitLearnMode])

  // ── Click on a mappable control ──
  const handleControlClick = useCallback((controlId: MappableControlId) => {
    startListening(controlId)
  }, [startListening])

  // ── Right-click to remove mapping ──
  const handleControlRightClick = useCallback((e: React.MouseEvent, controlId: MappableControlId) => {
    e.preventDefault()
    removeMapping(controlId)
  }, [removeMapping])

  // ── Clear all mappings with confirmation (WAVE 2049) ──
  const handleClearAll = useCallback(() => {
    const count = Object.keys(mappings).length
    if (count === 0) return
    
    const confirmed = window.confirm(
      `⚠️ MIDI LEARN: Clear All Mappings\n\n` +
      `This will remove ${count} mapping${count === 1 ? '' : 's'}.\n\n` +
      `Are you sure?`
    )
    
    if (confirmed) {
      useMidiMapStore.getState().clearAll()
    }
  }, [mappings])

  // ── Format binding for display ──
  function formatBinding(b: MidiBinding): string {
    if (b.type === 'cc') {
      return `CC ${b.control} · Ch ${b.channel + 1}`
    }
    return `Note ${b.control} · Ch ${b.channel + 1}`
  }

  // ── Get control state class ──
  function getControlStateClass(controlId: MappableControlId): string {
    if (lastMapped === controlId) return 'ml-control mapped'
    if (listeningControl === controlId) return 'ml-control listening'
    if (mappings[controlId]) return 'ml-control assigned'
    return 'ml-control'
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* ── MIDI PILL (always visible) — WAVE UX-1: Pill system ── */}
      <button
        className={`tb-pill tb-pill--midi ${learnMode ? 'active' : ''} ${mappingCount > 0 ? 'has-mappings' : ''}`}
        onClick={handleToggle}
        title={learnMode ? 'Exit MIDI Learn (ESC)' : 'Enter MIDI Learn mode'}
      >
        <span className="tb-pill-emoji">🎹</span>
        <span className="tb-pill-label">MIDI</span>
        {mappingCount > 0 && !learnMode && (
          <span className="tb-pill-count">{mappingCount}</span>
        )}
      </button>

      {/* ── LEARN MODE OVERLAY ── */}
      {learnMode && (
        <div className="ml-overlay">
          <div className="ml-panel">
            {/* Header */}
            <div className="ml-header">
              <div className="ml-header-left">
                <span className="ml-title">🎹 MIDI LEARN</span>
                <span className="ml-subtitle">Click a control, then move a MIDI fader/pad</span>
              </div>
              <div className="ml-header-right">
                <button className="ml-clear-btn" onClick={handleClearAll} title="Clear all mappings">
                  ✕ CLEAR ALL
                </button>
                <button className="ml-close-btn" onClick={exitLearnMode}>
                  ESC
                </button>
              </div>
            </div>

            {/* Controls Grid */}
            <div className="ml-grid">
              {/* Faders Section */}
              <div className="ml-section">
                <div className="ml-section-title">FADERS / KNOBS</div>
                {MAPPABLE_CONTROLS.filter(c => c.category === 'fader').map(control => (
                  <div
                    key={control.id}
                    className={getControlStateClass(control.id)}
                    onClick={() => handleControlClick(control.id)}
                    onContextMenu={(e) => handleControlRightClick(e, control.id)}
                  >
                    <div className="ml-control-header">
                      <span className="ml-control-name">{control.label}</span>
                      <span className="ml-control-type">CC</span>
                    </div>
                    <div className="ml-control-status">
                      {listeningControl === control.id
                        ? '👂 Listening...'
                        : lastMapped === control.id
                          ? '✅ Mapped!'
                          : mappings[control.id]
                            ? formatBinding(mappings[control.id])
                            : '—'
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* Buttons Section */}
              <div className="ml-section">
                <div className="ml-section-title">BUTTONS / PADS</div>
                {MAPPABLE_CONTROLS.filter(c => c.category === 'button').map(control => (
                  <div
                    key={control.id}
                    className={getControlStateClass(control.id)}
                    onClick={() => handleControlClick(control.id)}
                    onContextMenu={(e) => handleControlRightClick(e, control.id)}
                  >
                    <div className="ml-control-header">
                      <span className="ml-control-name">{control.label}</span>
                      <span className="ml-control-type">NOTE</span>
                    </div>
                    <div className="ml-control-status">
                      {listeningControl === control.id
                        ? '👂 Listening...'
                        : lastMapped === control.id
                          ? '✅ Mapped!'
                          : mappings[control.id]
                            ? formatBinding(mappings[control.id])
                            : '—'
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="ml-footer">
              <span>
                {mappingCount} mapping{mappingCount !== 1 ? 's' : ''} active
              </span>
              <span className="ml-footer-hint">
                Right-click to remove · ESC to exit
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ═══════════════════════════════════════════════════════════════ */
        /* WAVE UX-1: MIDI PILL — Purple accent variant of .tb-pill      */
        /* Base .tb-pill styles come from TitleBar.css                    */
        /* ═══════════════════════════════════════════════════════════════ */
        .tb-pill--midi {
          border-color: rgba(160, 80, 255, 0.2);
          color: rgba(160, 80, 255, 0.5);
        }

        .tb-pill--midi:hover {
          border-color: rgba(160, 80, 255, 0.45);
          color: rgba(160, 80, 255, 0.8);
          background: rgba(160, 80, 255, 0.06);
          box-shadow: 0 0 14px rgba(160, 80, 255, 0.12);
        }

        .tb-pill--midi.active {
          border-color: rgba(160, 80, 255, 0.7);
          color: #c084fc;
          background: rgba(160, 80, 255, 0.1);
          box-shadow: 0 0 24px rgba(160, 80, 255, 0.2);
          animation: midi-pill-glow 2s ease-in-out infinite;
        }

        .tb-pill--midi.active .tb-pill-label {
          text-shadow: 0 0 8px rgba(160, 80, 255, 0.5);
        }

        .tb-pill--midi.has-mappings {
          border-color: rgba(160, 80, 255, 0.4);
        }

        .tb-pill-emoji {
          font-size: 0.75rem;
          line-height: 1;
        }

        .tb-pill-count {
          font-size: 0.55rem;
          color: #c084fc;
          background: rgba(160, 80, 255, 0.18);
          padding: 0 4px;
          border-radius: 3px;
          font-weight: 700;
        }

        @keyframes midi-pill-glow {
          0%, 100% { box-shadow: 0 0 24px rgba(160,80,255,0.2); }
          50% { box-shadow: 0 0 36px rgba(160,80,255,0.35); }
        }

        /* ═══════════════════════════════════════════════════════════════ */
        /* LEARN MODE OVERLAY                                            */
        /* ═══════════════════════════════════════════════════════════════ */
        .ml-overlay {
          position: fixed;
          inset: 0;
          z-index: 99990;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: ml-fade-in 0.2s ease-out;
        }

        @keyframes ml-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .ml-panel {
          width: 720px;
          max-width: 90vw;
          max-height: 85vh;
          background: rgba(10, 10, 15, 0.97);
          border: 1px solid rgba(160, 80, 255, 0.4);
          border-radius: 16px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7),
                      0 0 60px rgba(160, 80, 255, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: ml-panel-in 0.2s ease-out;
        }

        @keyframes ml-panel-in {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Header */
        .ml-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(160, 80, 255, 0.1), transparent);
          border-bottom: 1px solid rgba(160, 80, 255, 0.2);
        }

        .ml-header-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ml-title {
          font-family: var(--font-mono, monospace);
          font-size: 1rem;
          font-weight: 700;
          color: #c084fc;
          letter-spacing: 0.08em;
        }

        .ml-subtitle {
          font-size: 0.7rem;
          color: var(--text-muted, #666);
        }

        .ml-header-right {
          display: flex;
          gap: 8px;
        }

        .ml-clear-btn,
        .ml-close-btn {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--border-subtle, #444);
          background: transparent;
          color: var(--text-secondary, #aaa);
          cursor: pointer;
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          font-weight: 600;
          transition: all 0.15s ease;
        }

        .ml-clear-btn:hover {
          border-color: #ef4444;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .ml-close-btn:hover {
          border-color: var(--text-primary, #fff);
          color: var(--text-primary, #fff);
          background: rgba(255, 255, 255, 0.08);
        }

        /* Grid */
        .ml-grid {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .ml-grid::-webkit-scrollbar {
          width: 4px;
        }

        .ml-grid::-webkit-scrollbar-thumb {
          background: rgba(160, 80, 255, 0.3);
          border-radius: 2px;
        }

        .ml-section-title {
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-muted, #666);
          letter-spacing: 0.1em;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Control Cards */
        .ml-control {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 6px;
        }

        .ml-control:hover {
          border-color: rgba(160, 80, 255, 0.4);
          background: rgba(160, 80, 255, 0.05);
        }

        /* Listening state — blue neon pulse */
        .ml-control.listening {
          border-color: rgba(0, 160, 255, 0.8);
          background: rgba(0, 160, 255, 0.08);
          box-shadow: 0 0 20px rgba(0, 160, 255, 0.2);
          animation: ml-listen-pulse 1s ease-in-out infinite;
        }

        @keyframes ml-listen-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 160, 255, 0.2); }
          50% { box-shadow: 0 0 35px rgba(0, 160, 255, 0.4); }
        }

        /* Mapped state — green flash */
        .ml-control.mapped {
          border-color: rgba(16, 185, 129, 0.8);
          background: rgba(16, 185, 129, 0.15);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
          animation: ml-mapped-flash 0.3s ease-out;
        }

        @keyframes ml-mapped-flash {
          0% { transform: scale(1.05); background: rgba(16, 185, 129, 0.3); }
          100% { transform: scale(1); background: rgba(16, 185, 129, 0.15); }
        }

        /* Assigned state — subtle purple */
        .ml-control.assigned {
          border-color: rgba(160, 80, 255, 0.3);
          background: rgba(160, 80, 255, 0.05);
        }

        .ml-control-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .ml-control-name {
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-primary, #e0e0e0);
        }

        .ml-control-type {
          font-family: var(--font-mono, monospace);
          font-size: 0.55rem;
          color: var(--text-muted, #555);
          background: rgba(255, 255, 255, 0.05);
          padding: 1px 6px;
          border-radius: 3px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .ml-control-status {
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          color: var(--text-muted, #666);
        }

        .ml-control.listening .ml-control-status {
          color: #38bdf8;
        }

        .ml-control.mapped .ml-control-status {
          color: #10b981;
          font-weight: 700;
        }

        .ml-control.assigned .ml-control-status {
          color: #c084fc;
        }

        /* Footer */
        .ml-footer {
          display: flex;
          justify-content: space-between;
          padding: 10px 20px;
          border-top: 1px solid rgba(160, 80, 255, 0.2);
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          color: var(--text-muted, #555);
        }

        .ml-footer-hint {
          font-style: italic;
          color: var(--text-muted, #444);
        }
      `}</style>
    </>
  )
}
