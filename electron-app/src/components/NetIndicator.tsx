/**
 * 📡 WAVE 2048: NET INDICATOR - Art-Net Network Discovery UI
 * ============================================================================
 * 
 * Fixed position indicator in system-status bar showing network state.
 * Click to reveal discovered Art-Net nodes panel.
 * 
 * VISUAL STATES:
 *   ● NET (green pulse)  = Nodes found
 *   ● NET (amber steady) = Polling, no nodes yet
 *   ○ NET (dim)          = Discovery inactive
 * 
 * @module components/NetIndicator
 * @version WAVE 2048
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (mirror of ArtNetDiscovery.ts)
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
// NODE STYLE LABELS
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

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function NetIndicator() {
  const [status, setStatus] = useState<DiscoveryStatus>({
    state: 'idle',
    nodeCount: 0,
    nodes: [],
    pollCount: 0,
    broadcastAddress: '2.255.255.255',
  })
  const [showPanel, setShowPanel] = useState(false)
  const [isDiscoveryActive, setIsDiscoveryActive] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const api = (window as any).luxsync?.discovery
    if (!api) return

    // Listen for live updates from main process
    const cleanups: Array<() => void> = []

    cleanups.push(
      api.onNodeDiscovered((node: ArtNetNode) => {
        setStatus(prev => ({
          ...prev,
          nodeCount: prev.nodeCount + 1,
          nodes: [...prev.nodes.filter(n => n.ip !== node.ip), node],
        }))
      })
    )

    cleanups.push(
      api.onNodeLost((ip: string) => {
        setStatus(prev => ({
          ...prev,
          nodeCount: Math.max(0, prev.nodeCount - 1),
          nodes: prev.nodes.filter(n => n.ip !== ip),
        }))
      })
    )

    cleanups.push(
      api.onNodeUpdated((node: ArtNetNode) => {
        setStatus(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => n.ip === node.ip ? node : n),
        }))
      })
    )

    cleanups.push(
      api.onStateChange((state: string) => {
        setStatus(prev => ({ ...prev, state: state as DiscoveryStatus['state'] }))
        setIsDiscoveryActive(state === 'polling')
      })
    )

    return () => cleanups.forEach(fn => fn())
  }, [])

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPanel])

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const toggleDiscovery = useCallback(async () => {
    const api = (window as any).luxsync?.discovery
    if (!api) return

    if (isDiscoveryActive) {
      await api.stop()
      setIsDiscoveryActive(false)
      setStatus(prev => ({ ...prev, state: 'idle' }))
    } else {
      const result = await api.start()
      if (result?.success) {
        setIsDiscoveryActive(true)
        setStatus(prev => ({ ...prev, state: 'polling' }))
      }
    }
  }, [isDiscoveryActive])

  const refreshNodes = useCallback(async () => {
    const api = (window as any).luxsync?.discovery
    if (!api) return

    const freshStatus = await api.getStatus()
    if (freshStatus) {
      setStatus(freshStatus)
      setIsDiscoveryActive(freshStatus.state === 'polling')
    }
  }, [])

  const pollNow = useCallback(async () => {
    const api = (window as any).luxsync?.discovery
    if (!api) return
    await api.pollNow()
  }, [])

  const handleIndicatorClick = useCallback(() => {
    setShowPanel(prev => !prev)
    if (!showPanel) {
      refreshNodes()
    }
  }, [showPanel, refreshNodes])

  // ═══════════════════════════════════════════════════════════════════════════
  // TIME AGO HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  function timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 5) return 'ahora'
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m`
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const dotClass = status.state === 'polling' 
    ? (status.nodeCount > 0 ? 'net-dot active' : 'net-dot polling')
    : status.state === 'error' 
      ? 'net-dot error'
      : 'net-dot'

  return (
    <>
      {/* Indicator Badge */}
      <div className="net-indicator" onClick={handleIndicatorClick} title="Art-Net Network Discovery">
        <span className={dotClass} />
        <span className="net-label">NET</span>
        {status.nodeCount > 0 && (
          <span className="net-count">{status.nodeCount}</span>
        )}
      </div>

      {/* Nodes Panel */}
      {showPanel && (
        <div className="net-panel" ref={panelRef}>
          <div className="net-panel-header">
            <span className="net-panel-title">📡 ART-NET NODES</span>
            <div className="net-panel-actions">
              <button 
                className="net-btn" 
                onClick={pollNow} 
                title="Force poll now"
                disabled={!isDiscoveryActive}
              >
                ↻
              </button>
              <button 
                className={`net-btn ${isDiscoveryActive ? 'active' : ''}`} 
                onClick={toggleDiscovery}
                title={isDiscoveryActive ? 'Stop discovery' : 'Start discovery'}
              >
                {isDiscoveryActive ? '■' : '▶'}
              </button>
            </div>
          </div>

          {status.nodes.length === 0 ? (
            <div className="net-panel-empty">
              {isDiscoveryActive 
                ? 'Escaneando red...' 
                : 'Discovery inactivo'
              }
            </div>
          ) : (
            <div className="net-panel-nodes">
              {status.nodes.map(node => (
                <div key={node.ip} className="net-node">
                  <div className="net-node-header">
                    <span className="net-node-name">
                      {node.shortName || node.ip}
                    </span>
                    <span className="net-node-seen">{timeAgo(node.lastSeen)}</span>
                  </div>
                  <div className="net-node-details">
                    <span className="net-node-ip">{node.ip}</span>
                    <span className="net-node-mac">{node.mac}</span>
                  </div>
                  <div className="net-node-meta">
                    <span className="net-node-style">{getNodeStyleLabel(node.nodeStyle)}</span>
                    {node.outputUniverses.length > 0 && (
                      <span className="net-node-universes">
                        OUT: {node.outputUniverses.join(', ')}
                      </span>
                    )}
                    {node.inputUniverses.length > 0 && (
                      <span className="net-node-universes">
                        IN: {node.inputUniverses.join(', ')}
                      </span>
                    )}
                  </div>
                  {node.longName && node.longName !== node.shortName && (
                    <div className="net-node-long">{node.longName}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="net-panel-footer">
            <span>Polls: {status.pollCount}</span>
            <span>Broadcast: {status.broadcastAddress}</span>
          </div>
        </div>
      )}

      <style>{`
        /* ═══════════════════════════════════════════════════════════════ */
        /* NET INDICATOR BADGE - WAVE 2049: TITLE BAR INTEGRATION       */
        /* ═══════════════════════════════════════════════════════════════ */
        .net-indicator {
          /* 🎨 INLINE badge en TitleBar (no position:fixed) */
          display: flex;
          align-items: center;
          gap: 6px;
          
          /* Estilo minimalista tipo nativo */
          background: transparent;
          backdrop-filter: blur(6px);
          border: 1px solid rgba(0, 240, 255, 0.25);
          border-radius: 12px;
          padding: 3px 8px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          
          /* Interacción */
          cursor: pointer;
          user-select: none;
          transition: all 0.2s ease;
        }

        .net-indicator:hover {
          background: rgba(10, 10, 15, 0.85);
          border-color: rgba(0, 240, 255, 0.5);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5),
                      0 0 20px rgba(0, 240, 255, 0.2);
          transform: translateY(-1px);
        }

        .net-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-muted, #555);
          transition: all 0.3s ease;
        }

        .net-dot.polling {
          background: #f59e0b;
          box-shadow: 0 0 6px #f59e0b;
        }

        .net-dot.active {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: net-pulse 2s ease-in-out infinite;
        }

        .net-dot.error {
          background: #ef4444;
          box-shadow: 0 0 6px #ef4444;
        }

        .net-label {
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          color: var(--text-muted, #888);
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        .net-count {
          font-family: var(--font-mono, monospace);
          font-size: 0.55rem;
          color: #10b981;
          background: rgba(16, 185, 129, 0.15);
          padding: 0 4px;
          border-radius: 3px;
          font-weight: 700;
        }

        @keyframes net-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ═══════════════════════════════════════════════════════════════ */
        /* NODES PANEL                                                   */
        /* ═══════════════════════════════════════════════════════════════ */
        .net-panel {
          position: fixed;
          top: 54px;  /* Debajo del badge (14px + 40px badge height) */
          right: 20px;  /* Alineado a la derecha */
          width: 380px;
          max-height: 520px;
          background: rgba(10, 10, 15, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(0, 240, 255, 0.3);
          border-radius: var(--radius-lg, 12px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6),
                      0 0 40px rgba(0, 240, 255, 0.15);
          z-index: 99998;  /* Justo debajo del badge */
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: net-panel-in 0.15s ease-out;
        }

        @keyframes net-panel-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .net-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), transparent);
          border-bottom: 1px solid var(--border-subtle, #333);
        }

        .net-panel-title {
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-primary, #e0e0e0);
          letter-spacing: 0.08em;
        }

        .net-panel-actions {
          display: flex;
          gap: 4px;
        }

        .net-btn {
          width: 24px;
          height: 24px;
          border: 1px solid var(--border-subtle, #444);
          border-radius: 4px;
          background: transparent;
          color: var(--text-secondary, #aaa);
          cursor: pointer;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .net-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary, #fff);
        }

        .net-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .net-btn.active {
          border-color: #10b981;
          color: #10b981;
        }

        /* Empty State */
        .net-panel-empty {
          padding: 32px 14px;
          text-align: center;
          color: var(--text-muted, #666);
          font-size: 0.8rem;
          font-style: italic;
        }

        /* Node List */
        .net-panel-nodes {
          flex: 1;
          overflow-y: auto;
          padding: 6px;
        }

        .net-panel-nodes::-webkit-scrollbar {
          width: 4px;
        }

        .net-panel-nodes::-webkit-scrollbar-thumb {
          background: var(--border-subtle, #444);
          border-radius: 2px;
        }

        .net-node {
          padding: 8px 10px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid transparent;
          margin-bottom: 4px;
          transition: border-color 0.15s ease;
        }

        .net-node:hover {
          border-color: var(--border-subtle, #444);
          background: rgba(255, 255, 255, 0.04);
        }

        .net-node-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .net-node-name {
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-primary, #e0e0e0);
        }

        .net-node-seen {
          font-size: 0.65rem;
          color: var(--text-muted, #666);
          font-family: var(--font-mono, monospace);
        }

        .net-node-details {
          display: flex;
          gap: 12px;
          margin-bottom: 4px;
        }

        .net-node-ip {
          font-family: var(--font-mono, monospace);
          font-size: 0.7rem;
          color: #60a5fa;
        }

        .net-node-mac {
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          color: var(--text-muted, #666);
        }

        .net-node-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .net-node-style {
          font-size: 0.65rem;
          color: var(--text-secondary, #aaa);
          background: rgba(255, 255, 255, 0.05);
          padding: 1px 6px;
          border-radius: 3px;
        }

        .net-node-universes {
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
          padding: 1px 6px;
          border-radius: 3px;
        }

        .net-node-long {
          font-size: 0.65rem;
          color: var(--text-muted, #666);
          margin-top: 4px;
          font-style: italic;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Footer */
        .net-panel-footer {
          display: flex;
          justify-content: space-between;
          padding: 6px 14px;
          border-top: 1px solid var(--border-subtle, #333);
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          color: var(--text-muted, #555);
        }
      `}</style>
    </>
  )
}
