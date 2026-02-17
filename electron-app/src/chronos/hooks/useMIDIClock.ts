/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 USE MIDI CLOCK - WAVE 2045: OPERATION "UMBILICAL CORD"
 * 
 * Listens to an external MIDI Clock master (Ableton, Traktor, Pioneer DJM).
 * Derives BPM from 0xF8 (Clock) messages — 24 PPQ standard.
 * Responds to 0xFA (Start) and 0xFC (Stop) for remote transport control.
 * 
 * MIDI CLOCK PROTOCOL:
 * - 0xF8 (248) = Timing Clock — 24 pulses per quarter note
 * - 0xFA (250) = Start — Begin playback from position 0
 * - 0xFB (251) = Continue — Resume from current position
 * - 0xFC (252) = Stop — Stop playback
 * 
 * BPM CALCULATION:
 * - Collect intervals between 0xF8 messages
 * - Average over a sliding window (24 clocks = 1 beat)
 * - BPM = 60 / (avg_interval_per_beat_in_seconds)
 * - Hysteresis: Only update if delta > 0.5 BPM (anti-jitter)
 * 
 * ARCHITECTURE:
 * - Uses Web MIDI API (navigator.requestMIDIAccess)
 * - Zero external dependencies
 * - Deterministic BPM calculation (no random, no simulation)
 * - Cleanup on unmount (removes all listeners)
 * 
 * @module chronos/hooks/useMIDIClock
 * @version WAVE 2045
 */

import { useState, useCallback, useRef, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** MIDI System Real-Time messages */
const MIDI_CLOCK = 0xF8        // Timing Clock (24 PPQ)
const MIDI_START = 0xFA        // Start
const MIDI_CONTINUE = 0xFB    // Continue
const MIDI_STOP = 0xFC         // Stop

/** Pulses Per Quarter Note (MIDI standard) */
const PPQ = 24

/** Number of beats to average for BPM calculation (sliding window) */
const BPM_WINDOW_SIZE = 8

/** Minimum BPM change to trigger update (hysteresis, prevents jitter) */
const BPM_HYSTERESIS = 0.5

/** Valid BPM range */
const BPM_MIN = 20
const BPM_MAX = 300

/** Maximum clock interval before considering signal lost (2 seconds) */
const CLOCK_TIMEOUT_MS = 2000

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type MIDIClockSource = 'internal' | 'midi'

export interface MIDIDeviceInfo {
  id: string
  name: string
  manufacturer: string
}

export interface MIDIClockState {
  /** Current clock source mode */
  source: MIDIClockSource
  
  /** Is MIDI access available in this browser/environment */
  isSupported: boolean
  
  /** Is currently connected to a MIDI device */
  isConnected: boolean
  
  /** BPM derived from MIDI Clock (0 if no signal) */
  midiBpm: number
  
  /** Is transport running (received Start, not yet Stop) */
  isExternalPlaying: boolean
  
  /** List of available MIDI input devices */
  availableDevices: MIDIDeviceInfo[]
  
  /** Currently selected device ID (null = listen to all) */
  selectedDeviceId: string | null
  
  /** Error message if MIDI access failed */
  error: string | null
  
  /** Signal quality: 'none' | 'weak' | 'stable' */
  signalQuality: 'none' | 'weak' | 'stable'
}

export interface UseMIDIClockReturn extends MIDIClockState {
  /** Enable MIDI clock mode (start listening) */
  enableMIDI: () => Promise<void>
  
  /** Disable MIDI clock mode (stop listening, revert to internal) */
  disableMIDI: () => void
  
  /** Toggle between internal and MIDI */
  toggleSource: () => Promise<void>
  
  /** Select a specific MIDI input device */
  selectDevice: (deviceId: string | null) => void
  
  /** Refresh device list */
  refreshDevices: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useMIDIClock(): UseMIDIClockReturn {
  // ── State ──
  const [source, setSource] = useState<MIDIClockSource>('internal')
  const [isConnected, setIsConnected] = useState(false)
  const [midiBpm, setMidiBpm] = useState(0)
  const [isExternalPlaying, setIsExternalPlaying] = useState(false)
  const [availableDevices, setAvailableDevices] = useState<MIDIDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signalQuality, setSignalQuality] = useState<'none' | 'weak' | 'stable'>('none')
  
  // ── Refs (mutable state for real-time processing, no re-renders) ──
  const midiAccessRef = useRef<MIDIAccess | null>(null)
  const clockTimestampsRef = useRef<number[]>([])
  const beatIntervalsRef = useRef<number[]>([])
  const clockCountRef = useRef(0)
  const lastClockTimeRef = useRef(0)
  const lastReportedBpmRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messageHandlerRef = useRef<((event: MIDIMessageEvent) => void) | null>(null)
  
  // ── Check browser support ──
  const isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator

  // ── Clock timeout: detect signal loss ──
  const resetClockTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      // No clock received for 2 seconds — signal lost
      setSignalQuality('none')
      setMidiBpm(0)
      lastReportedBpmRef.current = 0
      clockTimestampsRef.current = []
      beatIntervalsRef.current = []
      clockCountRef.current = 0
      console.log('[MIDIClock] ⚠️ Clock signal lost (timeout)')
    }, CLOCK_TIMEOUT_MS)
  }, [])

  // ── Core MIDI message handler ──
  const handleMIDIMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data
    if (!data || data.length === 0) return
    
    const status = data[0]
    
    switch (status) {
      case MIDI_CLOCK: {
        // ═══════════════════════════════════════════════════════════
        // 0xF8 — TIMING CLOCK (24 PPQ)
        // ═══════════════════════════════════════════════════════════
        const now = performance.now()
        clockCountRef.current++
        
        // Store timestamp
        clockTimestampsRef.current.push(now)
        
        // Keep only enough timestamps for BPM_WINDOW_SIZE beats worth of clocks
        const maxClocks = PPQ * BPM_WINDOW_SIZE + 1
        if (clockTimestampsRef.current.length > maxClocks) {
          clockTimestampsRef.current.shift()
        }
        
        // Every PPQ (24) clocks = 1 beat. Calculate beat interval.
        if (clockCountRef.current % PPQ === 0 && clockTimestampsRef.current.length >= PPQ + 1) {
          // Interval between last 24 clocks = 1 beat duration
          const timestamps = clockTimestampsRef.current
          const beatInterval = timestamps[timestamps.length - 1] - timestamps[timestamps.length - 1 - PPQ]
          
          beatIntervalsRef.current.push(beatInterval)
          if (beatIntervalsRef.current.length > BPM_WINDOW_SIZE) {
            beatIntervalsRef.current.shift()
          }
          
          // Calculate BPM from averaged beat intervals
          if (beatIntervalsRef.current.length >= 2) {
            const avgInterval = beatIntervalsRef.current.reduce((a, b) => a + b, 0) 
              / beatIntervalsRef.current.length
            const calculatedBpm = 60000 / avgInterval
            
            // Clamp to valid range
            const clampedBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, calculatedBpm))
            const roundedBpm = Math.round(clampedBpm * 10) / 10 // 1 decimal precision
            
            // Hysteresis: only update if change exceeds threshold
            if (Math.abs(roundedBpm - lastReportedBpmRef.current) >= BPM_HYSTERESIS) {
              lastReportedBpmRef.current = roundedBpm
              setMidiBpm(roundedBpm)
              
              // Log every 4 beats (not every beat — too spammy)
              if (clockCountRef.current % (PPQ * 4) === 0) {
                console.log(`[MIDIClock] 🎹 BPM: ${roundedBpm} (${beatIntervalsRef.current.length} samples)`)
              }
            }
          }
          
          // Signal quality assessment
          if (beatIntervalsRef.current.length >= BPM_WINDOW_SIZE) {
            setSignalQuality('stable')
          } else if (beatIntervalsRef.current.length >= 2) {
            setSignalQuality('weak')
          }
        }
        
        lastClockTimeRef.current = now
        resetClockTimeout()
        break
      }
      
      case MIDI_START: {
        // ═══════════════════════════════════════════════════════════
        // 0xFA — START (Begin from position 0)
        // ═══════════════════════════════════════════════════════════
        console.log('[MIDIClock] ▶️ External START received')
        setIsExternalPlaying(true)
        // Reset clock counter on Start
        clockCountRef.current = 0
        clockTimestampsRef.current = []
        break
      }
      
      case MIDI_CONTINUE: {
        // ═══════════════════════════════════════════════════════════
        // 0xFB — CONTINUE (Resume from current position)
        // ═══════════════════════════════════════════════════════════
        console.log('[MIDIClock] ▶️ External CONTINUE received')
        setIsExternalPlaying(true)
        break
      }
      
      case MIDI_STOP: {
        // ═══════════════════════════════════════════════════════════
        // 0xFC — STOP
        // ═══════════════════════════════════════════════════════════
        console.log('[MIDIClock] ⏹️ External STOP received')
        setIsExternalPlaying(false)
        break
      }
    }
  }, [resetClockTimeout])

  // Keep handler ref updated for cleanup
  useEffect(() => {
    messageHandlerRef.current = handleMIDIMessage
  }, [handleMIDIMessage])

  // ── Scan available devices ──
  const refreshDevices = useCallback(() => {
    const access = midiAccessRef.current
    if (!access) return
    
    const devices: MIDIDeviceInfo[] = []
    access.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name || `MIDI Input ${input.id}`,
        manufacturer: input.manufacturer || 'Unknown',
      })
    })
    
    setAvailableDevices(devices)
    console.log(`[MIDIClock] 🔍 Found ${devices.length} MIDI input(s):`, 
      devices.map(d => d.name).join(', ') || 'none')
  }, [])

  // ── Wire/unwire message listeners on inputs ──
  const wireInputs = useCallback((access: MIDIAccess, deviceId: string | null) => {
    // Remove old listeners first
    access.inputs.forEach((input) => {
      input.onmidimessage = null
    })
    
    // Attach new listeners
    let connectedCount = 0
    access.inputs.forEach((input) => {
      if (deviceId === null || input.id === deviceId) {
        input.onmidimessage = (event: Event) => {
          // Web MIDI API types are imprecise — cast safely
          if (messageHandlerRef.current) {
            messageHandlerRef.current(event as MIDIMessageEvent)
          }
        }
        connectedCount++
      }
    })
    
    setIsConnected(connectedCount > 0)
    console.log(`[MIDIClock] 🔌 Wired ${connectedCount} MIDI input(s)`)
  }, [])

  // ── Enable MIDI Clock ──
  const enableMIDI = useCallback(async () => {
    if (!isSupported) {
      setError('Web MIDI API not available in this environment')
      console.error('[MIDIClock] ❌ Web MIDI API not supported')
      return
    }
    
    setError(null)
    
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false })
      midiAccessRef.current = access
      
      console.log('[MIDIClock] 🎹 MIDI Access granted!')
      
      // Scan devices
      refreshDevices()
      
      // Wire listeners
      wireInputs(access, selectedDeviceId)
      
      // Listen for device changes (hot-plug)
      access.onstatechange = () => {
        console.log('[MIDIClock] 🔄 MIDI device change detected')
        refreshDevices()
        wireInputs(access, selectedDeviceId)
      }
      
      setSource('midi')
      console.log('[MIDIClock] 🎹 MIDI Clock mode ENABLED')
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'MIDI access denied'
      setError(message)
      console.error('[MIDIClock] ❌ Failed to get MIDI access:', message)
    }
  }, [isSupported, selectedDeviceId, refreshDevices, wireInputs])

  // ── Disable MIDI Clock ──
  const disableMIDI = useCallback(() => {
    // Remove all listeners
    const access = midiAccessRef.current
    if (access) {
      access.inputs.forEach((input) => {
        input.onmidimessage = null
      })
      access.onstatechange = null
    }
    
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Reset state
    midiAccessRef.current = null
    clockTimestampsRef.current = []
    beatIntervalsRef.current = []
    clockCountRef.current = 0
    lastClockTimeRef.current = 0
    lastReportedBpmRef.current = 0
    
    setSource('internal')
    setIsConnected(false)
    setMidiBpm(0)
    setIsExternalPlaying(false)
    setSignalQuality('none')
    setError(null)
    
    console.log('[MIDIClock] 🎹 MIDI Clock mode DISABLED → Internal')
  }, [])

  // ── Toggle ──
  const toggleSource = useCallback(async () => {
    if (source === 'internal') {
      await enableMIDI()
    } else {
      disableMIDI()
    }
  }, [source, enableMIDI, disableMIDI])

  // ── Select specific device ──
  const selectDevice = useCallback((deviceId: string | null) => {
    setSelectedDeviceId(deviceId)
    
    // Re-wire if already connected
    const access = midiAccessRef.current
    if (access) {
      wireInputs(access, deviceId)
    }
  }, [wireInputs])

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      disableMIDI()
    }
  }, [disableMIDI])

  return {
    source,
    isSupported,
    isConnected,
    midiBpm,
    isExternalPlaying,
    availableDevices,
    selectedDeviceId,
    error,
    signalQuality,
    enableMIDI,
    disableMIDI,
    toggleSource,
    selectDevice,
    refreshDevices,
  }
}
