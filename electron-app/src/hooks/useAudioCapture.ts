/**
 * WAVE 267: OPERATION PHOENIX - COMPLETE REWRITE
 * 
 * Principios de Ingenieria de Rendimiento Estricta:
 * 1. ZERO-GC: No crear objetos/arrays dentro del loop
 * 2. BACKPRESSURE: Semaforo para auto-regulacion IPC
 * 3. RELOJ REAL: Throttling basado en performance.now()
 * 4. SEPARACION: Loop actualiza refs, React lee refs
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAudioStore } from '../stores/audioStore'
import { usePowerStore } from './useSystemPower'

export type AudioSource = 'microphone' | 'system' | 'simulation' | 'none'

export interface AudioMetrics {
  bass: number
  mid: number
  treble: number
  energy: number
  bpm: number
  beatPhase: number
  onBeat: boolean
}

export interface UseAudioCaptureReturn {
  metrics: AudioMetrics
  isCapturing: boolean
  isPermissionGranted: boolean
  error: string | null
  audioSource: AudioSource
  startCapture: (source?: AudioSource) => Promise<void>
  stopCapture: () => void
  setSimulationMode: (enabled: boolean) => void
  startSystemAudio: () => Promise<void>
  startMicrophone: () => Promise<void>
}

const FFT_SIZE = 2048
const SMOOTHING = 0.8
const BASS_MAX_HZ = 250
const MID_MAX_HZ = 4000
const BPM_MIN = 60
const BPM_MAX = 180
const BEAT_THRESHOLD = 0.5
const METRICS_INTERVAL_MS = 33
const BUFFER_INTERVAL_MS = 100
const UI_UPDATE_INTERVAL_MS = 33

interface MutableMetrics {
  bass: number
  mid: number
  treble: number
  energy: number
  bpm: number
  beatPhase: number
  onBeat: boolean
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const [metrics, setMetrics] = useState<AudioMetrics>({
    bass: 0, mid: 0, treble: 0, energy: 0, bpm: 120, beatPhase: 0, onBeat: false
  })
  const [isCapturing, setIsCapturing] = useState(false)
  const [isPermissionGranted, setIsPermissionGranted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioSource, setAudioSource] = useState<AudioSource>('none')

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const uiIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // 🔥 WAVE 267.5: Audio loop con setInterval (no RAF que se pausa)
  const audioLoopRef = useRef<NodeJS.Timeout | null>(null)
  const AUDIO_LOOP_INTERVAL_MS = 16 // ~60fps
  
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeDomainDataRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const fftBinsRef = useRef<number[]>(new Array(64).fill(0))
  
  const mutableMetricsRef = useRef<MutableMetrics>({
    bass: 0, mid: 0, treble: 0, energy: 0, bpm: 120, beatPhase: 0, onBeat: false
  })
  
  const lastMetricsSendRef = useRef<number>(0)
  const lastBufferSendRef = useRef<number>(0)
  const isBufferBusyRef = useRef<boolean>(false)
  
  const energyHistoryRef = useRef<number[]>([])
  const lastBeatTimeRef = useRef<number>(0)
  const beatIntervalsRef = useRef<number[]>([])
  
  const inputGain = useAudioStore(state => state.inputGain)
  const inputGainRef = useRef<number>(inputGain)
  inputGainRef.current = inputGain

  const cleanup = useCallback(() => {
    // 🔥 WAVE 267.5: Limpiar audio loop (setInterval)
    if (audioLoopRef.current !== null) {
      clearInterval(audioLoopRef.current)
      audioLoopRef.current = null
    }
    if (uiIntervalRef.current !== null) {
      clearInterval(uiIntervalRef.current)
      uiIntervalRef.current = null
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
    setIsCapturing(false)
    setAudioSource('none')
  }, [])

  const processFrame = useCallback(() => {
    const analyser = analyserRef.current
    const audioContext = audioContextRef.current
    if (!analyser || !audioContext) return
    
    const now = performance.now()
    const bufferLength = analyser.frequencyBinCount
    
    if (!frequencyDataRef.current || frequencyDataRef.current.length !== bufferLength) {
      frequencyDataRef.current = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>
    }
    if (!timeDomainDataRef.current || timeDomainDataRef.current.length !== analyser.fftSize) {
      timeDomainDataRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
    }
    
    analyser.getByteFrequencyData(frequencyDataRef.current)
    analyser.getFloatTimeDomainData(timeDomainDataRef.current)
    
    const sampleRate = audioContext.sampleRate
    const binWidth = sampleRate / FFT_SIZE
    const bassMaxBin = Math.floor(BASS_MAX_HZ / binWidth)
    const midMaxBin = Math.floor(MID_MAX_HZ / binWidth)
    
    let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0
    const freqData = frequencyDataRef.current
    
    for (let i = 0; i < bufferLength; i++) {
      const value = freqData[i] / 255
      if (i <= bassMaxBin) bassSum += value
      else if (i <= midMaxBin) midSum += value
      else trebleSum += value
      totalSum += value
    }
    
    const gain = inputGainRef.current
    const bass = Math.min(1, (bassSum / bassMaxBin) * gain)
    const mid = Math.min(1, (midSum / (midMaxBin - bassMaxBin)) * gain)
    const treble = Math.min(1, (trebleSum / (bufferLength - midMaxBin)) * gain)
    const energy = Math.min(1, (totalSum / bufferLength) * gain)
    
    energyHistoryRef.current.push(energy)
    if (energyHistoryRef.current.length > 60) energyHistoryRef.current.shift()
    
    const avgEnergy = energyHistoryRef.current.reduce((a, b) => a + b, 0) / energyHistoryRef.current.length
    let onBeat = false
    
    if (energy > avgEnergy * 1.2 && energy > BEAT_THRESHOLD) {
      const timeSinceLastBeat = now - lastBeatTimeRef.current
      if (timeSinceLastBeat > 200) {
        onBeat = true
        if (lastBeatTimeRef.current > 0) {
          beatIntervalsRef.current.push(timeSinceLastBeat)
          if (beatIntervalsRef.current.length > 8) beatIntervalsRef.current.shift()
        }
        lastBeatTimeRef.current = now
      }
    }
    
    let bpm = 120
    if (beatIntervalsRef.current.length >= 3) {
      const avgInterval = beatIntervalsRef.current.reduce((a, b) => a + b, 0) / beatIntervalsRef.current.length
      bpm = Math.round(60000 / avgInterval)
      bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm))
    }
    
    const expectedBeatInterval = 60000 / bpm
    const timeSinceLastBeat = now - lastBeatTimeRef.current
    const beatPhase = Math.min(1, timeSinceLastBeat / expectedBeatInterval)
    
    const m = mutableMetricsRef.current
    m.bass = bass
    m.mid = mid
    m.treble = treble
    m.energy = energy
    m.bpm = bpm
    m.beatPhase = beatPhase
    m.onBeat = onBeat
    
    if (now - lastMetricsSendRef.current >= METRICS_INTERVAL_MS) {
      lastMetricsSendRef.current = now
      const FFT_BINS = 64
      const binRatio = Math.floor(bufferLength / FFT_BINS)
      const fftBins = fftBinsRef.current
      for (let i = 0; i < FFT_BINS; i++) {
        let sum = 0
        for (let j = 0; j < binRatio; j++) sum += freqData[i * binRatio + j]
        fftBins[i] = (sum / binRatio) / 255
      }
      if (window.lux?.audioFrame) {
        window.lux.audioFrame({ bass, mid, treble, energy, bpm, fftBins })
      }
    }
    
    if (now - lastBufferSendRef.current >= BUFFER_INTERVAL_MS && !isBufferBusyRef.current) {
      lastBufferSendRef.current = now
      const rawBuffer = timeDomainDataRef.current
      const preAmpGain = inputGainRef.current * 10
      for (let i = 0; i < rawBuffer.length; i++) {
        rawBuffer[i] = Math.max(-1, Math.min(1, rawBuffer[i] * preAmpGain))
      }
      if (window.lux?.audioBuffer) {
        isBufferBusyRef.current = true
        window.lux.audioBuffer(rawBuffer)
        setTimeout(() => { isBufferBusyRef.current = false }, 0)
      }
    }
  }, [])

  const startUiUpdates = useCallback(() => {
    if (uiIntervalRef.current) return
    uiIntervalRef.current = setInterval(() => {
      const m = mutableMetricsRef.current
      setMetrics({
        bass: m.bass, mid: m.mid, treble: m.treble,
        energy: m.energy, bpm: m.bpm, beatPhase: m.beatPhase, onBeat: m.onBeat
      })
    }, UI_UPDATE_INTERVAL_MS)
  }, [])

  const setupAudioFromStream = useCallback(async (stream: MediaStream, sourceName: string) => {
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setError('No audio tracks found!')
      throw new Error('No audio tracks')
    }
    console.log(`[PHOENIX] Setting up ${sourceName}`)
    streamRef.current = stream
    setIsPermissionGranted(true)
    
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext
    if (audioContext.state === 'suspended') await audioContext.resume()
    
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = SMOOTHING
    analyserRef.current = analyser
    
    const source = audioContext.createMediaStreamSource(stream)
    const keepAlive = audioContext.createGain()
    keepAlive.gain.value = 0.001
    source.connect(analyser)
    analyser.connect(keepAlive)
    keepAlive.connect(audioContext.destination)
    
    setIsCapturing(true)
    // 🔥 WAVE 267.5: Usar setInterval en lugar de RAF
    // RAF se pausa cuando la ventana pierde foco - setInterval no
    audioLoopRef.current = setInterval(processFrame, AUDIO_LOOP_INTERVAL_MS)
    startUiUpdates()
    console.log(`[PHOENIX] ${sourceName} ACTIVE - setInterval @ ${AUDIO_LOOP_INTERVAL_MS}ms`)
  }, [processFrame, startUiUpdates])

  const startSystemAudio = useCallback(async () => {
    const powerState = usePowerStore.getState().powerState
    if (powerState === 'OFFLINE') {
      setError('System is offline')
      return
    }
    cleanup()
    setError(null)
    setAudioSource('system')
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: { width: 1, height: 1 }
      })
      stream.getVideoTracks().forEach(track => track.stop())
      await setupAudioFromStream(stream, 'System Audio')
    } catch (err) {
      console.error('[PHOENIX] System audio failed:', err)
      setError(err instanceof Error ? err.message : 'Failed')
      setAudioSource('none')
    }
  }, [cleanup, setupAudioFromStream])

  const startMicrophone = useCallback(async () => {
    const powerState = usePowerStore.getState().powerState
    if (powerState === 'OFFLINE') {
      setError('System is offline')
      return
    }
    cleanup()
    setError(null)
    setAudioSource('microphone')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      })
      await setupAudioFromStream(stream, 'Microphone')
    } catch (err) {
      console.error('[PHOENIX] Microphone failed:', err)
      setError(err instanceof Error ? err.message : 'Failed')
      setAudioSource('none')
    }
  }, [cleanup, setupAudioFromStream])

  const startCapture = useCallback(async (source: AudioSource = 'system') => {
    if (source === 'system') await startSystemAudio()
    else if (source === 'microphone') await startMicrophone()
  }, [startSystemAudio, startMicrophone])

  const stopCapture = useCallback(() => {
    console.log('[PHOENIX] Stopping')
    cleanup()
  }, [cleanup])

  const setSimulationMode = useCallback((_enabled: boolean) => {
    console.log('[PHOENIX] Simulation disabled - Anti-Simulacion Axiom')
  }, [])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  return {
    metrics, isCapturing, isPermissionGranted, error, audioSource,
    startCapture, stopCapture, setSimulationMode, startSystemAudio, startMicrophone
  }
}
