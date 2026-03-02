/**
 * ⚙️ WAVE UX-1: TACTICAL HUB — THE NERVE CENTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dropdown hub in the TitleBar that consolidates system tools:
 *   • Art-Net Discovery (migrated from standalone NetIndicator)
 *   • [Future] OSC Configuration
 *   • [Future] sACN Bridge
 *   • [Future] System Diagnostics
 *
 * ARCHITECTURE:
 *   - Pill button "⚙️ HUB" in TitleBar → click toggles dropdown
 *   - Dropdown: glassmorphism cyberpunk panel, closes on outside click
 *   - Art-Net section: full discovery UI (start/stop/poll/node list)
 *   - Placeholder sections: commented, ready for future expansion
 *
 * @module components/layout/TacticalHub
 * @version WAVE UX-1
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (mirror of ArtNetDiscovery.ts — same as NetIndicator)
// ═══════════════════════════════════════════════════════════════════════════

interface ArtNetNode {
  ip: string
  shortName: string
  longName: string
  mac: string
  firmwareVersion: number
  outputUniverses: number[]
  inputUniverses: number[]
  nodeStyle: number
  lastSeen: number
  responseCount: number
}

interface DiscoveryStatus {
  state: 'idle' | 'polling' | 'error'
  nodeCount: number
  nodes: ArtNetNode[]
  pollCount: number
  broadcastAddress: string
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getNodeStyleLabel(style: number): string {
  switch (style) {
    case 0: return 'Node'
    case 1: return 'Controller'
    case 2: return 'Media Server'
    case 3: return 'Route'
    case 4: return 'Backup'
    case 5: return 'Config'
    case 6: return 'Visual'
    default: return 'Unknown'
  }
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'ahora'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m`
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function TacticalHub() {
  // ── State ──
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // ── Art-Net Discovery State (migrated from NetIndicator) ──
  const [artnetStatus, setArtnetStatus] = useState<DiscoveryStatus>({
    state: 'idle',
    nodeCount: 0,
    nodes: [],
    pollCount: 0,
    broadcastAddress: '2.255.255.255',
  })
  const [isDiscoveryActive, setIsDiscoveryActive] = useState(false)

  // ── Art-Net summary for pill badge ──
  const artnetNodeCount = artnetStatus.nodeCount
  const artnetState = artnetStatus.state

  // ═══════════════════════════════════════════════════════════════════════
  // ART-NET IPC EVENTS
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const api = (window as any).luxsync?.discovery
    if (!api) return

    const cleanups: Array<() => void> = []

    cleanups.push(
      api.onNodeDiscovered((node: ArtNetNode) => {
        setArtnetStatus(prev => ({
          ...prev,
          nodeCount: prev.nodeCount + 1,
          nodes: [...prev.nodes.filter(n => n.ip !== node.ip), node],
        }))
      })
    )

    cleanups.push(
      api.onNodeLost((ip: string) => {
        setArtnetStatus(prev => ({
          ...prev,
          nodeCount: Math.max(0, prev.nodeCount - 1),
          nodes: prev.nodes.filter(n => n.ip !== ip),
        }))
      })
    )

    cleanups.push(
      api.onNodeUpdated((node: ArtNetNode) => {
        setArtnetStatus(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => n.ip === node.ip ? node : n),
        }))
      })
    )

    cleanups.push(
      api.onStateChange((state: string) => {
        setArtnetStatus(prev => ({ ...prev, state: state as DiscoveryStatus['state'] }))
        setIsDiscoveryActive(state === 'polling')
      })
    )

    return () => cleanups.forEach(fn => fn())
  }, [])

  // ── Close on outside click ──
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    // Delay to avoid closing on the same click that opened
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // ═══════════════════════════════════════════════════════════════════════
  // ART-NET ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  const toggleDiscovery = useCallback(async () => {
    const api = (window as any).luxsync?.discovery
    if (!api) return

    if (isDiscoveryActive) {
      await api.stop()
      setIsDiscoveryActive(false)
      setArtnetStatus(prev => ({ ...prev, state: 'idle' }))
    } else {
      const result = await api.start()
      if (result?.success) {
        setIsDiscoveryActive(true)
        setArtnetStatus(prev => ({ ...prev, state: 'polling' }))
      }
    }
  }, [isDiscoveryActive])

  const refreshNodes = useCallback(async () => {
    const api = (window as any).luxsync?.discovery
    if (!api) return

    const freshStatus = await api.getStatus()
    if (freshStatus) {
      setArtnetStatus(freshStatus)
      setIsDiscoveryActive(freshStatus.state === 'polling')
    }
  }, [])

  const pollNow = useCallback(async () => {
    const api = (window as any).luxsync?.discovery
    if (!api) return
    await api.pollNow()
  }, [])

  const handleToggle = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) refreshNodes()
      return !prev
    })
  }, [refreshNodes])

  // ═══════════════════════════════════════════════════════════════════════
  // DOT CLASS (Art-Net status dot on the pill)
  // ═══════════════════════════════════════════════════════════════════════

  const dotClass = artnetState === 'polling'
    ? (artnetNodeCount > 0 ? 'hub-dot hub-dot--active' : 'hub-dot hub-dot--polling')
    : artnetState === 'error'
      ? 'hub-dot hub-dot--error'
      : 'hub-dot'

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* ── HUB PILL BUTTON — uses .tb-pill base from TitleBar.css ── */}
      <button
        ref={btnRef}
        className={`tb-pill tb-pill--hub ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        title="Tactical Hub — System tools & network"
      >
        <span className={dotClass} />
        <span className="tb-pill-label">HUB</span>
        {artnetNodeCount > 0 && (
          <span className="hub-pill-count">{artnetNodeCount}</span>
        )}
      </button>

      {/* ── DROPDOWN PANEL ── */}
      {isOpen && (
        <div className="hub-panel" ref={panelRef}>
          {/* Panel Header */}
          <div className="hub-panel-header">
            <span className="hub-panel-title">⚙️ TACTICAL HUB</span>
            <button className="hub-panel-close" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {/* ═══ SECTION: ART-NET DISCOVERY ═══ */}
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">📡</span>
              <span className="hub-section-title">ART-NET DISCOVERY</span>
              <div className="hub-section-actions">
                <button
                  className="hub-action-btn"
                  onClick={pollNow}
                  title="Force poll now"
                  disabled={!isDiscoveryActive}
                >
                  ↻
                </button>
                <button
                  className={`hub-action-btn ${isDiscoveryActive ? 'active' : ''}`}
                  onClick={toggleDiscovery}
                  title={isDiscoveryActive ? 'Stop discovery' : 'Start discovery'}
                >
                  {isDiscoveryActive ? '■' : '▶'}
                </button>
              </div>
            </div>

            {/* Node List */}
            {artnetStatus.nodes.length === 0 ? (
              <div className="hub-section-empty">
                {isDiscoveryActive
                  ? 'Escaneando red...'
                  : 'Discovery inactivo — pulsa ▶ para iniciar'
                }
              </div>
            ) : (
              <div className="hub-node-list">
                {artnetStatus.nodes.map(node => (
                  <div key={node.ip} className="hub-node">
                    <div className="hub-node-row">
                      <span className="hub-node-name">
                        {node.shortName || node.ip}
                      </span>
                      <span className="hub-node-seen">{timeAgo(node.lastSeen)}</span>
                    </div>
                    <div className="hub-node-row">
                      <span className="hub-node-ip">{node.ip}</span>
                      <span className="hub-node-mac">{node.mac}</span>
                    </div>
                    <div className="hub-node-tags">
                      <span className="hub-node-tag">{getNodeStyleLabel(node.nodeStyle)}</span>
                      {node.outputUniverses.length > 0 && (
                        <span className="hub-node-tag hub-node-tag--uni">
                          OUT: {node.outputUniverses.join(', ')}
                        </span>
                      )}
                      {node.inputUniverses.length > 0 && (
                        <span className="hub-node-tag hub-node-tag--uni">
                          IN: {node.inputUniverses.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Art-Net Footer */}
            <div className="hub-section-footer">
              <span>Polls: {artnetStatus.pollCount}</span>
              <span>{artnetStatus.broadcastAddress}</span>
            </div>
          </div>

          {/* ═══ SECTION: FUTURE — OSC ═══ */}
          {/* 
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">🔗</span>
              <span className="hub-section-title">OSC BRIDGE</span>
            </div>
            <div className="hub-section-empty">Próximamente</div>
          </div>
          */}

          {/* ═══ SECTION: FUTURE — sACN ═══ */}
          {/*
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">🌐</span>
              <span className="hub-section-title">sACN BRIDGE</span>
            </div>
            <div className="hub-section-empty">Próximamente</div>
          </div>
          */}

          {/* ═══ SECTION: FUTURE — DIAGNOSTICS ═══ */}
          {/*
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">🔬</span>
              <span className="hub-section-title">DIAGNOSTICS</span>
            </div>
            <div className="hub-section-empty">Próximamente</div>
          </div>
          */}

          {/* Panel Footer */}
          <div className="hub-panel-footer">
            WAVE UX-1 · TACTICAL HUB
          </div>
        </div>
      )}

      <style>{`
        /* ═══════════════════════════════════════════════════════════════ */
        /* HUB PILL — Cyan variant, extends .tb-pill from TitleBar.css   */
        /* ═══════════════════════════════════════════════════════════════ */
        .tb-pill--hub {
          border-color: rgba(0, 240, 255, 0.25);
          color: rgba(0, 240, 255, 0.5);
        }

        .tb-pill--hub:hover {
          border-color: rgba(0, 240, 255, 0.5);
          color: rgba(0, 240, 255, 0.8);
          background: rgba(0, 240, 255, 0.06);
          box-shadow: 0 0 14px rgba(0, 240, 255, 0.12);
        }

        .tb-pill--hub.active {
          border-color: rgba(0, 240, 255, 0.7);
          color: var(--accent-primary, #00ffff);
          background: rgba(0, 240, 255, 0.08);
          box-shadow: 0 0 24px rgba(0, 240, 255, 0.2);
        }

        .hub-pill-count {
          font-size: 0.55rem;
          color: #10b981;
          background: rgba(16, 185, 129, 0.15);
          padding: 0 4px;
          border-radius: 3px;
          font-weight: 700;
        }

        /* ── Status Dot ── */
        .hub-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .hub-dot--polling {
          background: #f59e0b;
          box-shadow: 0 0 6px #f59e0b;
        }

        .hub-dot--active {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: hub-dot-pulse 2s ease-in-out infinite;
        }

        .hub-dot--error {
          background: #ef4444;
          box-shadow: 0 0 6px #ef4444;
        }

        @keyframes hub-dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ═══════════════════════════════════════════════════════════════ */
        /* DROPDOWN PANEL — Glassmorphism Cyberpunk                      */
        /* ═══════════════════════════════════════════════════════════════ */
        .hub-panel {
          position: fixed;
          top: 38px;
          right: 150px;
          width: 400px;
          max-height: 560px;
          background: rgba(8, 8, 14, 0.96);
          backdrop-filter: blur(16px) saturate(1.3);
          border: 1px solid rgba(0, 240, 255, 0.2);
          border-radius: 12px;
          box-shadow:
            0 8px 40px rgba(0, 0, 0, 0.7),
            0 0 60px rgba(0, 240, 255, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          z-index: 99998;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: hub-panel-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes hub-panel-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Panel Header ── */
        .hub-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: linear-gradient(135deg, rgba(0, 240, 255, 0.06), transparent);
          border-bottom: 1px solid rgba(0, 240, 255, 0.12);
        }

        .hub-panel-title {
          font-family: var(--font-mono, 'Orbitron', monospace);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--accent-primary, #00ffff);
          letter-spacing: 0.12em;
          text-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
        }

        .hub-panel-close {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          font-size: 0.65rem;
          transition: all 0.15s ease;
        }

        .hub-panel-close:hover {
          border-color: rgba(255, 100, 100, 0.5);
          color: #ff6464;
          background: rgba(255, 100, 100, 0.08);
        }

        /* ── Section ── */
        .hub-section {
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .hub-section:last-of-type {
          border-bottom: none;
        }

        .hub-section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px 6px;
        }

        .hub-section-icon {
          font-size: 0.85rem;
        }

        .hub-section-title {
          flex: 1;
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
          letter-spacing: 0.1em;
        }

        .hub-section-actions {
          display: flex;
          gap: 4px;
        }

        .hub-action-btn {
          width: 24px;
          height: 24px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          background: transparent;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .hub-action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary, #fff);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .hub-action-btn:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .hub-action-btn.active {
          border-color: #10b981;
          color: #10b981;
        }

        /* ── Section Empty ── */
        .hub-section-empty {
          padding: 20px 14px;
          text-align: center;
          color: rgba(255, 255, 255, 0.3);
          font-size: 0.75rem;
          font-style: italic;
        }

        /* ── Section Footer ── */
        .hub-section-footer {
          display: flex;
          justify-content: space-between;
          padding: 4px 14px 8px;
          font-family: var(--font-mono, monospace);
          font-size: 0.55rem;
          color: rgba(255, 255, 255, 0.2);
        }

        /* ── Node List ── */
        .hub-node-list {
          max-height: 300px;
          overflow-y: auto;
          padding: 4px 10px 6px;
        }

        .hub-node-list::-webkit-scrollbar {
          width: 3px;
        }

        .hub-node-list::-webkit-scrollbar-thumb {
          background: rgba(0, 240, 255, 0.2);
          border-radius: 2px;
        }

        .hub-node {
          padding: 8px 10px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid transparent;
          margin-bottom: 4px;
          transition: all 0.15s ease;
        }

        .hub-node:hover {
          border-color: rgba(0, 240, 255, 0.15);
          background: rgba(0, 240, 255, 0.03);
        }

        .hub-node-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3px;
        }

        .hub-node-row:last-child {
          margin-bottom: 0;
        }

        .hub-node-name {
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
        }

        .hub-node-seen {
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.3);
          font-family: var(--font-mono, monospace);
        }

        .hub-node-ip {
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          color: #60a5fa;
        }

        .hub-node-mac {
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.25);
        }

        .hub-node-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .hub-node-tag {
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.04);
          padding: 1px 6px;
          border-radius: 3px;
          font-family: var(--font-mono, monospace);
        }

        .hub-node-tag--uni {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }

        /* ── Panel Footer ── */
        .hub-panel-footer {
          padding: 6px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          font-family: var(--font-mono, monospace);
          font-size: 0.5rem;
          color: rgba(0, 240, 255, 0.2);
          letter-spacing: 0.15em;
          text-align: center;
        }
      `}</style>
    </>
  )
}
