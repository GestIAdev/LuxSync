/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎧 USE AUDIO LOADER PHANTOM - WAVE 2005.3: THE PHANTOM WORKER
 * 
 * Hook for loading and analyzing audio files using the PhantomWorker.
 * The analysis happens in a hidden BrowserWindow, completely isolated
 * from the main UI. Zero memory pressure on the renderer.
 * 
 * ARCHITECTURE:
 * - UI calls loadFile() → sends to Main Process via IPC
 * - Main Process forwards to PhantomWorker (hidden BrowserWindow)
 * - Phantom decodes with native Chromium AudioContext
 * - Phantom runs GodEarOffline analysis
 * - Result (lightweight JSON) sent back to UI
 * - UI uses <audio> element for playback (streaming from disk)
 * 
 * BENEFITS:
 * - Supports files of ANY size (tested up to 500MB)
 * - UI never freezes during analysis
 * - Zero external dependencies (no FFmpeg)
 * - Crash isolation (Phantom can crash without affecting UI)
 * 
 * @module chronos/hooks/useAudioLoaderPhantom
 * @version WAVE 2005.3
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { AnalysisData } from '../core/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AudioLoadResult {
  /** Analysis data for visualization */
  analysisData: AnalysisData
  
  /** Original filename */
  fileName: string
  
  /** File size in bytes */
  fileSize: number
  
  /** Duration in milliseconds */
  durationMs: number
  
  /** Path to audio file (for <audio> element) - can be blob: or file:// URL */
  audioPath: string
  
  /** 🧠 WAVE 2014.5: Real filesystem path for saving to project (optional) */
  realPath?: string
}

export interface AudioLoaderState {
  /** Is currently loading/analyzing */
  isLoading: boolean
  
  /** Current phase of loading */
  phase: 'idle' | 'uploading' | 'decoding' | 'analyzing' | 'complete' | 'error'
  
  /** Progress percentage (0-100) */
  progress: number
  
  /** Progress message */
  message: string
  
  /** Error message if failed */
  error: string | null
  
  /** Loaded audio data */
  result: AudioLoadResult | null
}

export interface UseAudioLoaderPhantomReturn extends AudioLoaderState {
  /** Load audio from File object */
  loadFile: (file: File) => Promise<AudioLoadResult | null>
  
  /** 🧠 WAVE 2014.5: Load audio from file path (for project load) */
  loadFromPath: (filePath: string) => Promise<AudioLoadResult | null>
  
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

// ═══════════════════════════════════════════════════════════════════════════
// IPC ACCESS VIA PRELOAD API
// ═══════════════════════════════════════════════════════════════════════════

// Access Chronos IPC via window.luxsync.chronos (exposed by preload.ts)
interface ChronosAPI {
  analyzeAudio: (request: { buffer?: ArrayBuffer; filePath?: string; fileName: string }) => Promise<{
    success: boolean
    data?: any
    error?: string
    durationMs?: number
  }>
  onProgress: (callback: (data: { progress: number; phase: string }) => void) => () => void
  onComplete: (callback: (data: { analysisData: any; audioUrl: string }) => void) => () => void
  onError: (callback: (error: { message: string; code?: string }) => void) => () => void
  // 🧠 WAVE 2014.5: File existence check
  checkFileExists?: (filePath: string) => Promise<boolean>
}

function getChronosAPI(): ChronosAPI | null {
  const luxsync = (window as any).luxsync
  return luxsync?.chronos || null
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useAudioLoaderPhantom(): UseAudioLoaderPhantomReturn {
  const [state, setState] = useState<AudioLoaderState>({
    isLoading: false,
    phase: 'idle',
    progress: 0,
    message: '',
    error: null,
    result: null,
  })
  
  const abortRef = useRef(false)
  const tempPathRef = useRef<string | null>(null)
  
  /**
   * Update state helper
   */
  const updateState = useCallback((partial: Partial<AudioLoaderState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])
  
  /**
   * Listen for progress updates from Phantom
   */
  useEffect(() => {
    const chronos = getChronosAPI()
    if (!chronos) return
    
    // Subscribe using the preload API's onProgress
    const unsubscribe = chronos.onProgress((progress: any) => {
      // Map phantom phases to overall progress
      const phaseMap: Record<string, number> = {
        loading: 5,
        decoding: 15,
        waveform: 30,
        energy: 50,
        beats: 70,
        sections: 85,
        transients: 95,
        complete: 100,
      }
      
      const baseProgress = phaseMap[progress.phase] || 0
      
      updateState({
        phase: 'analyzing',
        progress: baseProgress,
        message: progress.message || `${progress.phase}...`,
      })
    })
    
    return unsubscribe
  }, [updateState])
  
  /**
   * Load audio from File object
   */
  const loadFile = useCallback(async (file: File): Promise<AudioLoadResult | null> => {
    const chronos = getChronosAPI()
    if (!chronos) {
      console.error('[useAudioLoaderPhantom] Chronos API not available')
      updateState({
        error: 'Chronos IPC not available',
        phase: 'error',
      })
      return null
    }
    
    abortRef.current = false
    
    console.log(`[useAudioLoaderPhantom] 📂 Loading: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
    
    // Validate file type
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!SUPPORTED_FORMATS.includes(ext) && !SUPPORTED_MIME_TYPES.includes(file.type)) {
      updateState({
        isLoading: false,
        phase: 'error',
        error: `Unsupported format: ${ext}. Supported: ${SUPPORTED_FORMATS.join(', ')}`,
      })
      return null
    }
    
    try {
      // Start loading
      updateState({
        isLoading: true,
        phase: 'uploading',
        progress: 0,
        message: 'Reading file...',
        error: null,
        result: null,
      })
      
      // Read file as ArrayBuffer
      const buffer = await file.arrayBuffer()
      
      if (abortRef.current) return null
      
      updateState({
        phase: 'analyzing',
        progress: 5,
        message: 'Sending to analyzer...',
      })
      
      // Send to main process for PhantomWorker analysis
      console.log('[useAudioLoaderPhantom] 📤 Sending to Phantom Worker...')
      
      const response = await chronos.analyzeAudio({
        buffer,
        fileName: file.name,
      })
      
      if (abortRef.current) return null
      
      if (!response.success) {
        throw new Error(response.error || 'Analysis failed')
      }
      
      console.log(`[useAudioLoaderPhantom] ✅ Analysis complete in ${response.durationMs}ms`)
      
      // Create blob URL for <audio> element
      const audioBlob = new Blob([buffer], { type: file.type || 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Build result
      const result: AudioLoadResult = {
        analysisData: response.data,
        fileName: file.name,
        fileSize: file.size,
        durationMs: response.data.durationMs,
        audioPath: audioUrl,
      }
      
      updateState({
        isLoading: false,
        phase: 'complete',
        progress: 100,
        message: 'Complete!',
        result,
      })
      
      return result
      
    } catch (err) {
      console.error('[useAudioLoaderPhantom] ❌ Error:', err)
      
      const errMsg = err instanceof Error ? err.message : String(err)
      
      updateState({
        isLoading: false,
        phase: 'error',
        error: errMsg,
      })
      
      return null
    }
  }, [updateState])
  
  /**
   * Reset loader state
   */
  const reset = useCallback(() => {
    abortRef.current = true
    
    // Revoke any blob URLs
    if (state.result?.audioPath?.startsWith('blob:')) {
      URL.revokeObjectURL(state.result.audioPath)
    }
    
    setState({
      isLoading: false,
      phase: 'idle',
      progress: 0,
      message: '',
      error: null,
      result: null,
    })
  }, [state.result?.audioPath])
  
  /**
   * 🧠 WAVE 2014.5: Load audio from file path (for project load)
   * Uses file:// URL for playback without copying to memory
   */
  const loadFromPath = useCallback(async (filePath: string): Promise<AudioLoadResult | null> => {
    const chronos = getChronosAPI()
    
    console.log(`[useAudioLoaderPhantom] 📂 Loading from path: ${filePath}`)
    
    // Check if file exists
    const exists = await chronos?.checkFileExists?.(filePath)
    if (!exists) {
      console.error(`[useAudioLoaderPhantom] ❌ File not found: ${filePath}`)
      updateState({
        error: `File not found: ${filePath}`,
        phase: 'error',
      })
      return null
    }
    
    // Extract filename from path
    const fileName = filePath.split(/[\\/]/).pop() || 'audio.mp3'
    
    updateState({
      isLoading: true,
      phase: 'analyzing',
      progress: 10,
      message: 'Loading from disk...',
      error: null,
    })
    
    try {
      // Send path directly to phantom for analysis
      const response = await chronos?.analyzeAudio({ filePath, fileName })
      
      if (!response?.success) {
        throw new Error(response?.error || 'Analysis failed')
      }
      
      // Create file:// URL for playback (no memory copy)
      const fileUrl = `file://${filePath.replace(/\\/g, '/')}`
      
      const result: AudioLoadResult = {
        fileName,
        audioPath: fileUrl, // file:// URL for playback
        realPath: filePath, // Actual filesystem path for saving
        fileSize: 0, // Not available for path-based load
        durationMs: response.data?.durationMs || 0,
        analysisData: response.data,
      }
      
      updateState({
        isLoading: false,
        phase: 'complete',
        progress: 100,
        message: 'Complete!',
        result,
      })
      
      console.log(`[useAudioLoaderPhantom] ✅ Loaded from path: ${filePath}`)
      return result
      
    } catch (err) {
      console.error('[useAudioLoaderPhantom] ❌ Load from path error:', err)
      updateState({
        isLoading: false,
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }, [updateState])
  
  return {
    ...state,
    loadFile,
    loadFromPath,
    reset,
    supportedFormats: SUPPORTED_FORMATS,
  }
}
