/**
 * 🎤 USE AUDIO CAPTURE
 * Web Audio API hook para capturar y analizar audio en tiempo real
 * 
 * Envía métricas (bass, mid, treble, energy) al Main Process via lux.audioFrame()
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export interface AudioMetrics {
  bass: number      // 0-1 (20-250Hz)
  mid: number       // 0-1 (250-4000Hz)
  treble: number    // 0-1 (4000-20000Hz)
  energy: number    // 0-1 (RMS overall)
  bpm: number       // Estimated BPM
  beatPhase: number // 0-1 position in beat
  onBeat: boolean   // True if on beat
}

export interface UseAudioCaptureReturn {
  metrics: AudioMetrics
  isCapturing: boolean
  isPermissionGranted: boolean
  error: string | null
  startCapture: () => Promise<void>
  stopCapture: () => void
  setSimulationMode: (enabled: boolean) => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FFT_SIZE = 2048
const SMOOTHING = 0.8

// Frecuencias de corte para bandas
const BASS_MAX = 250
const MID_MAX = 4000

// BPM Detection
const BPM_MIN = 60
const BPM_MAX = 180
const BEAT_THRESHOLD = 0.6

// ============================================================================
// HOOK
// ============================================================================

export function useAudioCapture(): UseAudioCaptureReturn {
  const [metrics, setMetrics] = useState<AudioMetrics>({
    bass: 0, mid: 0, treble: 0, energy: 0, bpm: 120, beatPhase: 0, onBeat: false
  })
  const [isCapturing, setIsCapturing] = useState(false)
  const [isPermissionGranted, setIsPermissionGranted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [simulationMode, setSimulationMode] = useState(false)

  // Refs para audio context
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // BPM detection state
  const energyHistoryRef = useRef<number[]>([])
  const lastBeatTimeRef = useRef<number>(0)
  const beatIntervalsRef = useRef<number[]>([])

  // Simulation refs
  const simulationStartRef = useRef<number>(0)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
  }, [])

  // Process audio frame
  const processFrame = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) {
      if (simulationMode) {
        processSimulatedFrame()
      }
      return
    }

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)

    const sampleRate = audioContextRef.current.sampleRate
    const binWidth = sampleRate / FFT_SIZE

    // Calcular índices de frecuencia
    const bassMaxBin = Math.floor(BASS_MAX / binWidth)
    const midMaxBin = Math.floor(MID_MAX / binWidth)

    // Calcular energía por banda
    let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0

    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i] / 255

      if (i <= bassMaxBin) {
        bassSum += value
      } else if (i <= midMaxBin) {
        midSum += value
      } else {
        trebleSum += value
      }
      totalSum += value
    }

    // Normalizar (con smoothing aplicado por el AnalyserNode)
    const bass = Math.min(1, bassSum / bassMaxBin)
    const mid = Math.min(1, midSum / (midMaxBin - bassMaxBin))
    const treble = Math.min(1, trebleSum / (bufferLength - midMaxBin))
    const energy = Math.min(1, totalSum / bufferLength)

    // BPM Detection
    energyHistoryRef.current.push(energy)
    if (energyHistoryRef.current.length > 60) {
      energyHistoryRef.current.shift()
    }

    const avgEnergy = energyHistoryRef.current.reduce((a, b) => a + b, 0) / energyHistoryRef.current.length
    const now = performance.now()
    let onBeat = false

    // Detectar beat: energía supera umbral y cooldown
    if (energy > avgEnergy * 1.3 && energy > BEAT_THRESHOLD) {
      const timeSinceLastBeat = now - lastBeatTimeRef.current
      if (timeSinceLastBeat > 200) { // Min 200ms entre beats (300 BPM max)
        onBeat = true
        
        // Guardar intervalo para calcular BPM
        if (lastBeatTimeRef.current > 0) {
          beatIntervalsRef.current.push(timeSinceLastBeat)
          if (beatIntervalsRef.current.length > 8) {
            beatIntervalsRef.current.shift()
          }
        }
        lastBeatTimeRef.current = now
      }
    }

    // Calcular BPM promedio
    let bpm = 120
    if (beatIntervalsRef.current.length >= 3) {
      const avgInterval = beatIntervalsRef.current.reduce((a, b) => a + b, 0) / beatIntervalsRef.current.length
      bpm = Math.round(60000 / avgInterval)
      bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm))
    }

    // Beat phase
    const expectedBeatInterval = 60000 / bpm
    const timeSinceLastBeat = now - lastBeatTimeRef.current
    const beatPhase = Math.min(1, timeSinceLastBeat / expectedBeatInterval)

    const newMetrics: AudioMetrics = { bass, mid, treble, energy, bpm, beatPhase, onBeat }
    setMetrics(newMetrics)

    // Enviar al Main Process
    if (window.lux) {
      window.lux.audioFrame({ bass, mid, treble, energy, bpm })
    }

    animationFrameRef.current = requestAnimationFrame(processFrame)
  }, [simulationMode])

  // Simulated audio frame (cuando no hay micrófono)
  const processSimulatedFrame = useCallback(() => {
    const now = performance.now()
    const t = (now - simulationStartRef.current) / 1000

    // Simular música electrónica
    const bpm = 128
    const beatInterval = 60000 / bpm
    const beatPhase = ((now % beatInterval) / beatInterval)
    const onBeat = beatPhase < 0.1

    // Bass: pulsos en cada beat
    const bassPulse = Math.pow(Math.max(0, Math.sin(beatPhase * Math.PI * 2 - Math.PI / 2)), 2)
    const bass = 0.3 + bassPulse * 0.5 + Math.sin(t * 0.5) * 0.1

    // Mid: más constante con variación
    const mid = 0.4 + Math.sin(t * 1.3) * 0.15 + Math.sin(t * 2.7) * 0.1

    // Treble: hi-hats en off-beats
    const offBeatPhase = ((now + beatInterval / 2) % beatInterval) / beatInterval
    const treblePulse = Math.pow(Math.max(0, Math.sin(offBeatPhase * Math.PI * 2 - Math.PI / 2)), 4)
    const treble = 0.2 + treblePulse * 0.4 + Math.sin(t * 5) * 0.1

    // Energy: combinación
    const energy = (bass * 0.5 + mid * 0.3 + treble * 0.2)

    const newMetrics: AudioMetrics = {
      bass: Math.max(0, Math.min(1, bass)),
      mid: Math.max(0, Math.min(1, mid)),
      treble: Math.max(0, Math.min(1, treble)),
      energy: Math.max(0, Math.min(1, energy)),
      bpm,
      beatPhase,
      onBeat,
    }

    setMetrics(newMetrics)

    // Enviar al Main Process
    if (window.lux) {
      window.lux.audioFrame({
        bass: newMetrics.bass,
        mid: newMetrics.mid,
        treble: newMetrics.treble,
        energy: newMetrics.energy,
        bpm: newMetrics.bpm,
      })
    }

    if (simulationMode && isCapturing) {
      animationFrameRef.current = requestAnimationFrame(processSimulatedFrame)
    }
  }, [simulationMode, isCapturing])

  // Start capture
  const startCapture = useCallback(async () => {
    try {
      setError(null)

      if (simulationMode) {
        setIsCapturing(true)
        simulationStartRef.current = performance.now()
        animationFrameRef.current = requestAnimationFrame(processSimulatedFrame)
        console.log('[AudioCapture] 🎵 Simulation mode started')
        return
      }

      // Pedir permiso de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      })
      
      streamRef.current = stream
      setIsPermissionGranted(true)

      // Crear audio context
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      // Crear analyser
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = SMOOTHING
      analyserRef.current = analyser

      // Conectar stream al analyser
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      setIsCapturing(true)
      animationFrameRef.current = requestAnimationFrame(processFrame)
      
      console.log('[AudioCapture] 🎤 Real audio capture started')
    } catch (err) {
      console.error('[AudioCapture] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to access microphone')
      
      // Fallback a simulación
      console.log('[AudioCapture] ⚠️ Falling back to simulation mode')
      setSimulationMode(true)
      setIsCapturing(true)
      simulationStartRef.current = performance.now()
      animationFrameRef.current = requestAnimationFrame(processSimulatedFrame)
    }
  }, [simulationMode, processFrame, processSimulatedFrame])

  // Stop capture
  const stopCapture = useCallback(() => {
    cleanup()
    setIsCapturing(false)
    console.log('[AudioCapture] 🛑 Capture stopped')
  }, [cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    metrics,
    isCapturing,
    isPermissionGranted,
    error,
    startCapture,
    stopCapture,
    setSimulationMode,
  }
}

export default useAudioCapture
