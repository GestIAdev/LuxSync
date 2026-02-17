/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎤 USE LIVE AUDIO INPUT - WAVE 2045: OPERATION "UMBILICAL CORD"
 * 
 * Captures live audio from microphone or line-in (3.5mm jack / sound card).
 * Routes the captured stream to the GodEar analysis pipeline via IPC,
 * bypassing the PhantomWorker (which is for file-based analysis).
 * 
 * ARCHITECTURE:
 *   getUserMedia → MediaStreamSource → AnalyserNode → Float32Array
 *                                                      ↓
 *                                          window.lux.audioBuffer()
 *                                                      ↓
 *                                      Main Process → Senses Worker (GodEar)
 *                                                      ↓
 *                                      TrinityProvider → audioStore (BPM, etc.)
 * 
 * This is a PARALLEL pipeline to useAudioCapture. The difference:
 * - useAudioCapture: Used by TrinityProvider for the MAIN audio analysis
 * - useLiveAudioInput: Used by Chronos to REPLACE file playback with live input
 * 
 * When LIVE mode is active in Chronos:
 * 1. PhantomWorker + StreamingPlayback are disabled
 * 2. getUserMedia captures audio from selected device
 * 3. Raw PCM buffers are sent to the Senses Worker (same pipeline as useAudioCapture)
 * 4. GodEar processes audio → BPM, beat detection, spectrum
 * 5. Lights react in real-time to whatever is playing
 * 
 * SUPPORTED SOURCES:
 * - Microphone (built-in or external)
 * - Line-in / aux (via sound card settings)
 * - Loopback (system audio via getDisplayMedia)
 * 
 * @module chronos/hooks/useLiveAudioInput
 * @version WAVE 2045
 */

import { useState, useCallback, useRef, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const FFT_SIZE = 4096         // Match GodEar's analyzer size
const SMOOTHING = 0.3         // Lower = more reactive (live performance needs this)
const BUFFER_SEND_INTERVAL = 50  // 20fps buffer sends to Senses Worker
const METRICS_INTERVAL = 16      // 60fps for local metrics

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type LiveSourceType = 'microphone' | 'loopback'

export interface AudioInputDevice {
  deviceId: string
  label: string
  isDefault: boolean
}

export interface LiveAudioMetrics {
  /** RMS level (0-1) */
  level: number
  /** Is signal present (level > threshold) */
  hasSignal: boolean
  /** Peak level since last reset (0-1) */
  peak: number
}

export interface LiveAudioInputState {
  /** Is live input currently active */
  isActive: boolean
  
  /** Current source type */
  sourceType: LiveSourceType
  
  /** Available audio input devices */
  availableDevices: AudioInputDevice[]
  
  /** Currently selected device ID */
  selectedDeviceId: string | null
  
  /** Real-time metrics (level, signal presence) */
  metrics: LiveAudioMetrics
  
  /** Error message if capture failed */
  error: string | null
  
  /** Is currently enumerating devices */
  isEnumerating: boolean
}

export interface UseLiveAudioInputReturn extends LiveAudioInputState {
  /** Start live audio capture */
  start: (sourceType?: LiveSourceType) => Promise<void>
  
  /** Stop live audio capture */
  stop: () => void
  
  /** Switch input device */
  selectDevice: (deviceId: string) => Promise<void>
  
  /** Enumerate available audio input devices */
  enumerateDevices: () => Promise<void>
  
  /** Reset peak meter */
  resetPeak: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useLiveAudioInput(): UseLiveAudioInputReturn {
  // ── State ──
  const [isActive, setIsActive] = useState(false)
  const [sourceType, setSourceType] = useState<LiveSourceType>('microphone')
  const [availableDevices, setAvailableDevices] = useState<AudioInputDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isEnumerating, setIsEnumerating] = useState(false)
  const [metrics, setMetrics] = useState<LiveAudioMetrics>({
    level: 0,
    hasSignal: false,
    peak: 0,
  })
  
  // ── Refs (real-time processing, no re-renders) ──
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const metricsLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeDomainBufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const frequencyBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const peakRef = useRef(0)
  const isBufferBusyRef = useRef(false)
  const lastBufferSendRef = useRef(0)
  
  // ═══════════════════════════════════════════════════════════════════════
  // ENUMERATE DEVICES
  // ═══════════════════════════════════════════════════════════════════════
  
  const enumerateDevices = useCallback(async () => {
    setIsEnumerating(true)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Audio Input ${d.deviceId.slice(0, 8)}`,
          isDefault: d.deviceId === 'default',
        }))
      
      setAvailableDevices(audioInputs)
      console.log(`[LiveAudio] 🎤 Found ${audioInputs.length} input device(s):`,
        audioInputs.map(d => d.label).join(', '))
    } catch (err) {
      console.error('[LiveAudio] ❌ Device enumeration failed:', err)
    } finally {
      setIsEnumerating(false)
    }
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════
  
  const cleanup = useCallback(() => {
    // Stop processing loops
    if (processLoopRef.current) {
      clearInterval(processLoopRef.current)
      processLoopRef.current = null
    }
    if (metricsLoopRef.current) {
      clearInterval(metricsLoopRef.current)
      metricsLoopRef.current = null
    }
    
    // Disconnect audio nodes
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect() } catch { /* already disconnected */ }
      sourceNodeRef.current = null
    }
    
    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    analyserRef.current = null
    timeDomainBufferRef.current = null
    frequencyBufferRef.current = null
    peakRef.current = 0
    isBufferBusyRef.current = false
    
    setIsActive(false)
    setMetrics({ level: 0, hasSignal: false, peak: 0 })
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // PROCESSING LOOP — Feeds GodEar via IPC
  // ═══════════════════════════════════════════════════════════════════════
  
  const startProcessing = useCallback(() => {
    // Buffer send loop (20fps → Senses Worker)
    processLoopRef.current = setInterval(() => {
      const analyser = analyserRef.current
      if (!analyser || isBufferBusyRef.current) return
      
      const now = performance.now()
      if (now - lastBufferSendRef.current < BUFFER_SEND_INTERVAL) return
      lastBufferSendRef.current = now
      
      // Get time-domain data
      if (!timeDomainBufferRef.current) {
        timeDomainBufferRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
      }
      analyser.getFloatTimeDomainData(timeDomainBufferRef.current)
      
      // Send to Senses Worker via IPC bridge
      if (window.lux?.audioBuffer) {
        isBufferBusyRef.current = true
        window.lux.audioBuffer(timeDomainBufferRef.current)
        setTimeout(() => { isBufferBusyRef.current = false }, 0)
      }
      
      // Also send audioFrame for frontend metrics
      if (window.lux?.audioFrame && frequencyBufferRef.current) {
        analyser.getByteFrequencyData(frequencyBufferRef.current)
        
        const binCount = analyser.frequencyBinCount
        const sampleRate = audioContextRef.current?.sampleRate ?? 44100
        const binWidth = sampleRate / analyser.fftSize
        const bassMaxBin = Math.floor(250 / binWidth)
        const midMaxBin = Math.floor(4000 / binWidth)
        
        let bassSum = 0, midSum = 0, trebleSum = 0
        const freqData = frequencyBufferRef.current
        
        for (let i = 0; i < binCount; i++) {
          const val = freqData[i] / 255
          if (i <= bassMaxBin) bassSum += val
          else if (i <= midMaxBin) midSum += val
          else trebleSum += val
        }
        
        const bass = bassMaxBin > 0 ? Math.min(1, bassSum / bassMaxBin) : 0
        const mid = (midMaxBin - bassMaxBin) > 0 ? Math.min(1, midSum / (midMaxBin - bassMaxBin)) : 0
        const treble = (binCount - midMaxBin) > 0 ? Math.min(1, trebleSum / (binCount - midMaxBin)) : 0
        const energy = (bass * 0.5 + mid * 0.3 + treble * 0.2)
        
        // Build compact FFT bins (64 bins)
        const FFT_BINS = 64
        const binRatio = Math.floor(binCount / FFT_BINS)
        const fftBins: number[] = new Array(FFT_BINS)
        for (let i = 0; i < FFT_BINS; i++) {
          let sum = 0
          for (let j = 0; j < binRatio; j++) sum += freqData[i * binRatio + j]
          fftBins[i] = (sum / binRatio) / 255
        }
        
        window.lux.audioFrame({ bass, mid, treble, energy, bpm: 0, fftBins })
      }
    }, BUFFER_SEND_INTERVAL)
    
    // Metrics loop (60fps → UI level meter)
    metricsLoopRef.current = setInterval(() => {
      const analyser = analyserRef.current
      if (!analyser) return
      
      if (!timeDomainBufferRef.current) {
        timeDomainBufferRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
      }
      analyser.getFloatTimeDomainData(timeDomainBufferRef.current)
      
      // Calculate RMS level
      let sumSquares = 0
      const buffer = timeDomainBufferRef.current
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i]
      }
      const rms = Math.sqrt(sumSquares / buffer.length)
      const level = Math.min(1, rms * 5) // Scale up for visibility
      
      // Track peak
      if (level > peakRef.current) {
        peakRef.current = level
      }
      
      setMetrics({
        level,
        hasSignal: level > 0.01,
        peak: peakRef.current,
      })
    }, METRICS_INTERVAL)
    
    console.log('[LiveAudio] 🔄 Processing loops started')
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // START CAPTURE
  // ═══════════════════════════════════════════════════════════════════════
  
  const start = useCallback(async (type: LiveSourceType = 'microphone') => {
    // Cleanup any existing capture
    cleanup()
    setError(null)
    setSourceType(type)
    
    try {
      let stream: MediaStream
      
      if (type === 'microphone') {
        // ── Microphone / Line-in ──
        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            // High quality capture
            sampleRate: 44100,
            channelCount: 1,
          },
        }
        
        stream = await navigator.mediaDevices.getUserMedia(constraints)
        console.log('[LiveAudio] 🎤 Microphone/Line-in capture started')
        
      } else {
        // ── System Audio Loopback ──
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: { width: 1, height: 1 }, // Minimal video (required by API)
        })
        // Kill the video track immediately — we only want audio
        stream.getVideoTracks().forEach(track => track.stop())
        console.log('[LiveAudio] 🔊 System audio loopback started')
      }
      
      streamRef.current = stream
      
      // ── Build audio processing chain ──
      const audioContext = new AudioContext({ sampleRate: 44100 })
      audioContextRef.current = audioContext
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      const sourceNode = audioContext.createMediaStreamSource(stream)
      sourceNodeRef.current = sourceNode
      
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = SMOOTHING
      analyserRef.current = analyser
      
      // Pre-allocate buffers
      timeDomainBufferRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
      frequencyBufferRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
      
      // Connect: source → analyser (no output to speakers — prevents feedback!)
      sourceNode.connect(analyser)
      // Note: intentionally NOT connecting to audioContext.destination
      // This prevents audio feedback when using microphone
      
      setIsActive(true)
      
      // Start processing loops
      startProcessing()
      
      // Listen for track ending (user stops sharing)
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.onended = () => {
          console.log('[LiveAudio] ⚠️ Audio track ended (user stopped sharing)')
          cleanup()
        }
      }
      
      // Enumerate devices now that we have permission
      await enumerateDevices()
      
      console.log('[LiveAudio] ✅ Live audio pipeline ACTIVE')
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audio capture failed'
      setError(message)
      console.error('[LiveAudio] ❌ Capture failed:', message)
      cleanup()
    }
  }, [cleanup, selectedDeviceId, startProcessing, enumerateDevices])
  
  // ═══════════════════════════════════════════════════════════════════════
  // STOP CAPTURE
  // ═══════════════════════════════════════════════════════════════════════
  
  const stop = useCallback(() => {
    console.log('[LiveAudio] 🛑 Stopping live audio capture')
    cleanup()
  }, [cleanup])
  
  // ═══════════════════════════════════════════════════════════════════════
  // SWITCH DEVICE
  // ═══════════════════════════════════════════════════════════════════════
  
  const selectDevice = useCallback(async (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    
    // If currently active, restart with new device
    if (isActive) {
      console.log(`[LiveAudio] 🔄 Switching to device: ${deviceId}`)
      await start(sourceType)
    }
  }, [isActive, sourceType, start])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RESET PEAK
  // ═══════════════════════════════════════════════════════════════════════
  
  const resetPeak = useCallback(() => {
    peakRef.current = 0
    setMetrics(prev => ({ ...prev, peak: 0 }))
  }, [])
  
  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => cleanup()
  }, [cleanup])
  
  return {
    isActive,
    sourceType,
    availableDevices,
    selectedDeviceId,
    metrics,
    error,
    isEnumerating,
    start,
    stop,
    selectDevice,
    enumerateDevices,
    resetPeak,
  }
}
