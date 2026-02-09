/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎧 USE AUDIO LOADER - WAVE 2005: THE PULSE
 * Hook for loading and analyzing audio files in Chronos
 * 
 * FEATURES:
 * - Drag-drop audio file handling
 * - File picker integration
 * - Audio decoding via AudioContext
 * - Analysis via GodEarOffline
 * - Progress tracking
 * 
 * @module chronos/hooks/useAudioLoader
 * @version WAVE 2005
 */

import { useState, useCallback, useRef } from 'react'
import { analyzeAudioFile, type AnalysisProgress } from '../analysis/GodEarOffline'
import type { AnalysisData } from '../core/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AudioLoadResult {
  /** Decoded audio buffer */
  audioBuffer: AudioBuffer
  
  /** Analysis data for visualization */
  analysisData: AnalysisData
  
  /** Original filename */
  fileName: string
  
  /** File size in bytes */
  fileSize: number
  
  /** Duration in milliseconds */
  durationMs: number
}

export interface AudioLoaderState {
  /** Is currently loading/analyzing */
  isLoading: boolean
  
  /** Current phase of loading */
  phase: 'idle' | 'decoding' | 'analyzing' | 'complete' | 'error'
  
  /** Progress percentage (0-100) */
  progress: number
  
  /** Progress message */
  message: string
  
  /** Error message if failed */
  error: string | null
  
  /** Loaded audio data */
  result: AudioLoadResult | null
}

export interface UseAudioLoaderReturn extends AudioLoaderState {
  /** Load audio from File object */
  loadFile: (file: File) => Promise<AudioLoadResult | null>
  
  /** Load audio from ArrayBuffer */
  loadBuffer: (buffer: ArrayBuffer, fileName?: string) => Promise<AudioLoadResult | null>
  
  /** Reset loader state */
  reset: () => void
  
  /** Supported file extensions */
  supportedFormats: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SUPPORTED_FORMATS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.webm']
const SUPPORTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/aac',
  'audio/webm',
]

// 🛡️ WAVE 2005.1: Memory protection limits
// WAV files are uncompressed = huge in memory
// A 5-minute stereo 44.1kHz 16-bit WAV = ~50MB file → ~100MB in AudioBuffer
const MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024  // 150MB max file size
const MAX_DURATION_SECONDS = 600               // 10 minutes max duration
const WARN_FILE_SIZE_BYTES = 50 * 1024 * 1024  // Warn above 50MB

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO CONTEXT SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let audioContextInstance: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContextInstance) {
    audioContextInstance = new AudioContext()
  }
  return audioContextInstance
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useAudioLoader(): UseAudioLoaderReturn {
  const [state, setState] = useState<AudioLoaderState>({
    isLoading: false,
    phase: 'idle',
    progress: 0,
    message: '',
    error: null,
    result: null,
  })
  
  const abortRef = useRef(false)
  
  /**
   * Update state helper
   */
  const updateState = useCallback((partial: Partial<AudioLoaderState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])
  
  /**
   * Handle analysis progress
   */
  const handleProgress = useCallback((progress: AnalysisProgress) => {
    // Map phase progress to overall progress
    const phaseWeights = {
      waveform: { start: 0, weight: 30 },
      energy: { start: 30, weight: 25 },
      beats: { start: 55, weight: 20 },
      sections: { start: 75, weight: 15 },
      transients: { start: 90, weight: 8 },
      complete: { start: 98, weight: 2 },
    }
    
    const phase = phaseWeights[progress.phase] || { start: 0, weight: 10 }
    const overallProgress = phase.start + (progress.progress / 100) * phase.weight
    
    updateState({
      progress: Math.round(overallProgress),
      message: progress.message,
    })
  }, [updateState])
  
  /**
   * Load audio from ArrayBuffer
   */
  const loadBuffer = useCallback(async (
    buffer: ArrayBuffer,
    fileName = 'audio.mp3'
  ): Promise<AudioLoadResult | null> => {
    abortRef.current = false
    
    try {
      // 🛡️ WAVE 2005.1: Check file size limit FIRST
      if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
        const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(1)
        const maxMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)
        console.error(`[useAudioLoader] ❌ File too large: ${sizeMB}MB (max ${maxMB}MB)`)
        updateState({
          isLoading: false,
          phase: 'error',
          error: `File too large (${sizeMB}MB). Maximum: ${maxMB}MB. Try a compressed format like MP3.`,
        })
        return null
      }
      
      // Warn for large files
      if (buffer.byteLength > WARN_FILE_SIZE_BYTES) {
        const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(1)
        console.warn(`[useAudioLoader] ⚠️ Large file: ${sizeMB}MB - this may take a while...`)
      }
      
      // Start loading
      updateState({
        isLoading: true,
        phase: 'decoding',
        progress: 0,
        message: 'Decoding audio...',
        error: null,
        result: null,
      })
      
      console.log('[useAudioLoader] 🎧 Decoding audio...', {
        size: buffer.byteLength,
        fileName,
      })
      
      // 🛡️ WAVE 2005.1: Give the event loop a breath before heavy operation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Decode audio with specific error handling for OOM
      // NOTE: decodeAudioData consumes the buffer, so we pass it directly
      // The .slice(0) was causing memory duplication - REMOVED
      const audioContext = getAudioContext()
      let audioBuffer: AudioBuffer
      
      try {
        audioBuffer = await audioContext.decodeAudioData(buffer)
      } catch (decodeErr) {
        console.error('[useAudioLoader] ❌ Decode failed:', decodeErr)
        const errMsg = decodeErr instanceof Error ? decodeErr.message : String(decodeErr)
        
        // Check for common decode errors
        if (errMsg.includes('Unable to decode') || errMsg.includes('EncodingError')) {
          updateState({
            isLoading: false,
            phase: 'error',
            error: 'Unable to decode audio file. The file may be corrupted or in an unsupported format.',
          })
        } else {
          updateState({
            isLoading: false,
            phase: 'error',
            error: `Decode error: ${errMsg}`,
          })
        }
        return null
      }
      
      if (abortRef.current) return null
      
      // 🛡️ WAVE 2005.1: Check duration limit
      if (audioBuffer.duration > MAX_DURATION_SECONDS) {
        const durationMin = (audioBuffer.duration / 60).toFixed(1)
        const maxMin = (MAX_DURATION_SECONDS / 60).toFixed(0)
        console.error(`[useAudioLoader] ❌ Audio too long: ${durationMin} min (max ${maxMin} min)`)
        updateState({
          isLoading: false,
          phase: 'error',
          error: `Audio too long (${durationMin} min). Maximum: ${maxMin} minutes.`,
        })
        return null
      }
      
      console.log('[useAudioLoader] ✅ Audio decoded:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
      })
      
      // 🛡️ WAVE 2005.1: Give the event loop another breath before analysis
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Analyze audio
      updateState({
        phase: 'analyzing',
        progress: 10,
        message: 'Analyzing waveform...',
      })
      
      const startTime = performance.now()
      const analysisData = await analyzeAudioFile(audioBuffer, {}, handleProgress)
      const analysisTime = performance.now() - startTime
      
      if (abortRef.current) return null
      
      console.log('[useAudioLoader] ✅ Analysis complete in', analysisTime.toFixed(0), 'ms')
      
      // Build result
      const result: AudioLoadResult = {
        audioBuffer,
        analysisData,
        fileName,
        fileSize: buffer.byteLength,
        durationMs: audioBuffer.duration * 1000,
      }
      
      // Complete
      updateState({
        isLoading: false,
        phase: 'complete',
        progress: 100,
        message: 'Ready',
        result,
      })
      
      return result
      
    } catch (err) {
      console.error('[useAudioLoader] ❌ Error:', err)
      
      updateState({
        isLoading: false,
        phase: 'error',
        progress: 0,
        message: '',
        error: err instanceof Error ? err.message : 'Failed to load audio',
      })
      
      return null
    }
  }, [updateState, handleProgress])
  
  /**
   * Load audio from File object
   */
  const loadFile = useCallback(async (file: File): Promise<AudioLoadResult | null> => {
    // 🛡️ WAVE 2005.1: Check file size BEFORE reading into memory
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
      const maxMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)
      console.error(`[useAudioLoader] ❌ File too large: ${sizeMB}MB (max ${maxMB}MB)`)
      updateState({
        isLoading: false,
        phase: 'error',
        error: `File too large (${sizeMB}MB). Maximum: ${maxMB}MB. Try a compressed format like MP3.`,
      })
      return null
    }
    
    // Validate file type
    const isSupported = SUPPORTED_MIME_TYPES.some(type => file.type.includes(type)) ||
      SUPPORTED_FORMATS.some(ext => file.name.toLowerCase().endsWith(ext))
    
    if (!isSupported) {
      updateState({
        isLoading: false,
        phase: 'error',
        error: `Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ')}`,
      })
      return null
    }
    
    console.log('[useAudioLoader] 📂 Loading file:', file.name, file.type, file.size)
    
    // Read file as ArrayBuffer
    updateState({
      isLoading: true,
      phase: 'decoding',
      progress: 0,
      message: 'Reading file...',
      error: null,
    })
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      return await loadBuffer(arrayBuffer, file.name)
    } catch (err) {
      console.error('[useAudioLoader] ❌ File read error:', err)
      
      updateState({
        isLoading: false,
        phase: 'error',
        error: 'Failed to read file',
      })
      
      return null
    }
  }, [loadBuffer, updateState])
  
  /**
   * Reset loader state
   */
  const reset = useCallback(() => {
    abortRef.current = true
    setState({
      isLoading: false,
      phase: 'idle',
      progress: 0,
      message: '',
      error: null,
      result: null,
    })
  }, [])
  
  return {
    ...state,
    loadFile,
    loadBuffer,
    reset,
    supportedFormats: SUPPORTED_FORMATS,
  }
}

export default useAudioLoader
