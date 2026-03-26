/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📊 DATA CARDS - WAVE 35.2: Truth Store Wiring
 * System status cards connected to real hardware state
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState } from 'react'
import { useHardware, useAudio, useBeat } from '../../../../stores/truthStore'
import {
  IconBpmPulse,
  IconFixture,
  IconDmxBolt,
  IconFpsGauge,
  IconAudioLevel,
  IconUptime
} from './HudIcons'
import './DataCards.css'

interface DataCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  unit?: string
  status?: 'ok' | 'warning' | 'error' | 'neutral'
  sublabel?: string
}

const DataCard: React.FC<DataCardProps> = ({ 
  icon, 
  label, 
  value, 
  unit = '', 
  status = 'neutral',
  sublabel 
}) => (
  <div className={`data-card status-${status}`}>
    <div className="card-icon">{icon}</div>
    <div className="card-content">
      <div className="card-label">{label}</div>
      <div className="card-value">
        {value}
        {unit && <span className="card-unit">{unit}</span>}
      </div>
      {sublabel && <div className="card-sublabel">{sublabel}</div>}
    </div>
    <div className="card-glow" />
  </div>
)

const getDmxApi = () => (window as any).luxsync?.dmx

export const DataCards: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [fps, setFps] = useState(60)
  const [frameCount, setFrameCount] = useState(0)
  // 🔒 WAVE 2240: Estado IPC reactivo — no espera el ciclo de SeleneTruth
  const [dmxIpcState, setDmxIpcState] = useState<'connected' | 'disconnected' | 'connecting' | null>(null)
  
  // Store data - REAL from truthStore
  const hardware = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  const beat = useBeat() // 🛡️ WAVE 2042.13: React 19 stable hook
  const audio = useAudio() // 🛡️ WAVE 2042.12: React 19 stable hook
  
  // Real hardware data
  const fixtureCount = hardware?.fixturesTotal || 0
  const fixturesActive = hardware?.fixturesActive || 0
  // IPC events tienen prioridad sobre SeleneTruth (llegada más rápida)
  const dmxConnected = dmxIpcState === 'connected'
    ? true
    : dmxIpcState === 'disconnected'
      ? false
      : hardware?.dmx?.connected || false
  const dmxConnecting = dmxIpcState === 'connecting'
  const bpm = beat?.bpm || 0
  const energy = audio?.energy || 0
  // Audio level from peak/average, connected if we have energy
  const level = audio?.peak || audio?.average || 0
  const audioConnected = energy > 0 || (audio?.peak ?? 0) > 0
  
  // 🔒 WAVE 2240: Suscribir a eventos IPC de DMX para reflejar estado inmediato
  useEffect(() => {
    const dmxApi = getDmxApi()
    if (!dmxApi) return

    const unsubConnecting = dmxApi.onConnecting?.(() => setDmxIpcState('connecting'))
    const unsubConnected = dmxApi.onConnected?.(() => setDmxIpcState('connected'))
    const unsubDisconnected = dmxApi.onDisconnected?.(() => setDmxIpcState('disconnected'))

    return () => {
      unsubConnecting?.()
      unsubConnected?.()
      unsubDisconnected?.()
    }
  }, [])

  // FPS counter
  useEffect(() => {
    let lastTime = performance.now()
    let frames = 0
    
    const countFrame = () => {
      frames++
      const now = performance.now()
      
      if (now - lastTime >= 1000) {
        setFps(frames)
        setFrameCount(prev => prev + frames)
        frames = 0
        lastTime = now
      }
      
      requestAnimationFrame(countFrame)
    }
    
    const animId = requestAnimationFrame(countFrame)
    return () => cancelAnimationFrame(animId)
  }, [])
  
  return (
    <div className={`data-cards ${className}`}>
      <DataCard
        icon={<IconBpmPulse />}
        label="BPM"
        value={Math.round(bpm)}
        status={bpm > 0 ? 'ok' : 'warning'}
        sublabel={audioConnected ? 'Audio Connected' : 'No Audio'}
      />
      
      <DataCard
        icon={<IconFixture />}
        label="FIXTURES"
        value={fixtureCount}
        unit="units"
        status={fixtureCount > 0 ? 'ok' : 'warning'}
        sublabel={`${Math.round(fixtureCount * 512 / 100) * 100}+ DMX channels`}
      />
      
      <DataCard
        icon={<IconDmxBolt />}
        label="DMX"
        value={dmxConnecting ? 'CONNECTING' : dmxConnected ? 'ONLINE' : 'OFFLINE'}
        status={dmxConnecting ? 'warning' : dmxConnected ? 'ok' : 'error'}
        sublabel={dmxConnecting ? 'Scanning...' : dmxConnected ? 'Enttec Open DMX' : 'No device found'}
      />
      
      <DataCard
        icon={<IconFpsGauge />}
        label="RENDER"
        value={fps}
        unit="FPS"
        status={fps >= 55 ? 'ok' : fps >= 30 ? 'warning' : 'error'}
        sublabel={`${(frameCount / 1000).toFixed(1)}k frames`}
      />
      
      <DataCard
        icon={<IconAudioLevel />}
        label="AUDIO LVL"
        value={Math.round((level || 0) * 100)}
        unit="%"
        status={audioConnected ? 'ok' : 'warning'}
        sublabel="Peak amplitude"
      />
      
      <DataCard
        icon={<IconUptime />}
        label="UPTIME"
        value={formatUptime(performance.now())}
        status="neutral"
        sublabel="Session duration"
      />
    </div>
  )
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  return `${minutes}m ${seconds % 60}s`
}

export default DataCards
