/**
 * WAVE 3403: OMNI MATRIX TELEMETRY PANEL
 *
 * Displays AudioMatrix diagnostics in a compact terminal-style panel:
 * - Active source + hot-swap status
 * - Ring buffer fill level
 * - Provider diagnostics (underruns, latency, uptime)
 * - AGC gain display (when USBDirectLink is active)
 * - Resampler status
 *
 * Polling-based (2Hz) — this is informational text, not animation.
 */

import React, { memo, useEffect, useRef, useState, useCallback } from 'react'
import { DataStreamIcon, BoltIcon, LiveDotIcon } from '../../icons/LuxIcons'
import './OmniMatrixTelemetry.css'

const getAudioMatrixApi = () => (window as any).luxsync?.audioMatrix

interface DiagSnapshot {
  activeSource: string | null
  hotSwapPhase: string
  ringBufferFill: number
  providerDiag: {
    bufferUnderruns: number
    bufferOverruns: number
    samplesProcessed: number
    avgLatencyMs: number
    peakLatencyMs: number
    uptimeMs: number
  } | null
  agc: {
    currentGainDb: number
    currentRmsDb: number
    targetDb: number
    isActive: boolean
  } | null
  resamplerActive: boolean
}

const EMPTY_DIAG: DiagSnapshot = {
  activeSource: null,
  hotSwapPhase: 'none',
  ringBufferFill: 0,
  providerDiag: null,
  agc: null,
  resamplerActive: false,
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export const OmniMatrixTelemetry: React.FC = memo(() => {
  const [diag, setDiag] = useState<DiagSnapshot>(EMPTY_DIAG)
  const [connected, setConnected] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    const api = getAudioMatrixApi()
    if (!api?.getDiagnostics) {
      setConnected(false)
      return
    }
    try {
      const res = await api.getDiagnostics()
      if (res?.success) {
        setConnected(true)
        setDiag({
          activeSource: res.status?.activeSource ?? null,
          hotSwapPhase: res.status?.hotSwapPhase ?? 'none',
          ringBufferFill: res.status?.ringBufferFillLevel ?? 0,
          providerDiag: res.providerDiagnostics ?? null,
          agc: res.agc ?? null,
          resamplerActive: res.resamplerActive ?? false,
        })
      } else {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 500)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [poll])

  const pd = diag.providerDiag

  return (
    <div className="omni-telemetry">
      <div className="omni-telemetry__header">
        <DataStreamIcon size={14} color="var(--accent-primary)" />
        <span className="omni-telemetry__title">OMNI MATRIX</span>
        <span className={`omni-telemetry__status ${connected ? 'omni-telemetry__status--on' : ''}`}>
          <LiveDotIcon size={8} color={connected ? '#22d3ee' : '#666'} />
          {connected ? 'LINKED' : 'OFFLINE'}
        </span>
      </div>

      <div className="omni-telemetry__grid">
        {/* Source */}
        <div className="omni-telemetry__cell">
          <span className="omni-telemetry__label">SOURCE</span>
          <span className="omni-telemetry__value omni-telemetry__value--source">
            {diag.activeSource?.toUpperCase() ?? 'NONE'}
          </span>
        </div>

        {/* Hot-swap phase */}
        <div className="omni-telemetry__cell">
          <span className="omni-telemetry__label">SWAP</span>
          <span className={`omni-telemetry__value ${diag.hotSwapPhase !== 'none' ? 'omni-telemetry__value--alert' : ''}`}>
            {diag.hotSwapPhase.toUpperCase()}
          </span>
        </div>

        {/* Ring Buffer */}
        <div className="omni-telemetry__cell">
          <span className="omni-telemetry__label">RING BUF</span>
          <div className="omni-telemetry__bar">
            <div
              className="omni-telemetry__bar-fill"
              style={{
                width: `${(diag.ringBufferFill * 100) | 0}%`,
                background: diag.ringBufferFill > 0.85 ? '#ef4444' : diag.ringBufferFill > 0.6 ? '#fbbf24' : '#22d3ee',
              }}
            />
          </div>
          <span className="omni-telemetry__value">{(diag.ringBufferFill * 100) | 0}%</span>
        </div>

        {/* Latency */}
        <div className="omni-telemetry__cell">
          <span className="omni-telemetry__label">LATENCY</span>
          <span className="omni-telemetry__value">
            {pd ? `${pd.avgLatencyMs.toFixed(1)}ms` : '--'}
          </span>
        </div>

        {/* Peak Latency */}
        <div className="omni-telemetry__cell">
          <span className="omni-telemetry__label">PEAK</span>
          <span className="omni-telemetry__value">
            {pd ? `${pd.peakLatencyMs.toFixed(1)}ms` : '--'}
          </span>
        </div>

        {/* Buffer errors */}
        <div className="omni-telemetry__cell">
          <span className="omni-telemetry__label">XRUNS</span>
          <span className={`omni-telemetry__value ${pd && (pd.bufferUnderruns + pd.bufferOverruns) > 0 ? 'omni-telemetry__value--alert' : ''}`}>
            {pd ? `${pd.bufferUnderruns}U/${pd.bufferOverruns}O` : '--'}
          </span>
        </div>

        {/* AGC */}
        <div className="omni-telemetry__cell">
          <span className="omni-telemetry__label">
            <BoltIcon size={10} color={diag.agc?.isActive ? '#22d3ee' : '#666'} />
            AGC
          </span>
          <span className="omni-telemetry__value">
            {diag.agc ? `${diag.agc.currentGainDb > 0 ? '+' : ''}${diag.agc.currentGainDb.toFixed(1)}dB` : 'OFF'}
          </span>
        </div>

        {/* Resampler */}
        <div className="omni-telemetry__cell">
          <span className="omni-telemetry__label">RESAMPLE</span>
          <span className={`omni-telemetry__value ${diag.resamplerActive ? 'omni-telemetry__value--active' : ''}`}>
            {diag.resamplerActive ? 'ACTIVE' : 'BYPASS'}
          </span>
        </div>

        {/* Uptime */}
        <div className="omni-telemetry__cell">
          <span className="omni-telemetry__label">UPTIME</span>
          <span className="omni-telemetry__value">
            {pd ? formatUptime(pd.uptimeMs) : '--'}
          </span>
        </div>
      </div>
    </div>
  )
})

OmniMatrixTelemetry.displayName = 'OmniMatrixTelemetry'

export default OmniMatrixTelemetry
