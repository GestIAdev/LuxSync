/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💾 USE CHRONOS PROJECT - WAVE 2014: THE MEMORY CORE
 * 
 * React hook for managing Chronos project state, persistence, and shortcuts.
 * 
 * FEATURES:
 * - Save/Load project files (.lux format)
 * - Keyboard shortcuts (Ctrl+S, Ctrl+O, Ctrl+N)
 * - Dirty state tracking
 * - Unsaved changes warning
 * 
 * @module chronos/hooks/useChronosProject
 * @version WAVE 2014
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getChronosStore, type SaveResult, type LoadResult, type StoreEventType } from '../core/ChronosStore'
import type { TimelineClip } from '../core/TimelineClip'
import type { LuxProject } from '../core/ChronosProject'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChronosProjectState {
  projectName: string
  hasUnsavedChanges: boolean
  isLoading: boolean
  lastError: string | null
}

export interface ChronosProjectActions {
  save: () => Promise<SaveResult>
  saveAs: () => Promise<SaveResult>
  load: () => Promise<LoadResult>
  newProject: () => void
  markDirty: () => void
  updateFromSession: (
    clips: TimelineClip[],
    audio: { name: string; path: string; bpm: number; durationMs: number } | null,
    playheadMs?: number
  ) => void
  // 🆔 WAVE 2014.5: Audio path management
  setAudioPath: (path: string) => void
  getAudioInfo: () => { path: string; bpm: number; durationMs: number } | null
}

export interface UseChronosProjectReturn extends ChronosProjectState, ChronosProjectActions {
  project: LuxProject | null
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useChronosProject(): UseChronosProjectReturn {
  const store = getChronosStore()
  
  // State
  const [projectName, setProjectName] = useState(store.projectName)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(store.hasUnsavedChanges)
  const [isLoading, setIsLoading] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [project, setProject] = useState<LuxProject | null>(store.currentProject)
  
  // Track if component is mounted (to avoid state updates after unmount)
  const mountedRef = useRef(true)
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENT SUBSCRIPTIONS
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    mountedRef.current = true
    
    const handleProjectNew = () => {
      if (!mountedRef.current) return
      setProjectName(store.projectName)
      setHasUnsavedChanges(false)
      setProject(store.currentProject)
      setLastError(null)
    }
    
    const handleProjectLoaded = (data: { project: LuxProject; path: string }) => {
      if (!mountedRef.current) return
      setProjectName(store.projectName)
      setHasUnsavedChanges(false)
      setProject(data.project)
      setLastError(null)
    }
    
    const handleProjectSaved = (data: { path: string; name?: string }) => {
      if (!mountedRef.current) return
      setHasUnsavedChanges(false)
      // 🆔 WAVE 2014.5: Update name if changed
      if (data.name) {
        setProjectName(data.name)
      }
    }
    
    const handleProjectModified = (data: { isDirty: boolean }) => {
      if (!mountedRef.current) return
      setHasUnsavedChanges(data.isDirty)
    }
    
    const handleAudioMissing = (data: { audioPath: string }) => {
      if (!mountedRef.current) return
      setLastError(`Audio file not found: ${data.audioPath}`)
    }
    
    // Subscribe
    store.on('project-new', handleProjectNew)
    store.on('project-loaded', handleProjectLoaded)
    store.on('project-saved', handleProjectSaved)
    store.on('project-modified', handleProjectModified)
    store.on('audio-missing', handleAudioMissing)
    
    return () => {
      mountedRef.current = false
      store.off('project-new', handleProjectNew)
      store.off('project-loaded', handleProjectLoaded)
      store.off('project-saved', handleProjectSaved)
      store.off('project-modified', handleProjectModified)
      store.off('audio-missing', handleAudioMissing)
    }
  }, [store])
  
  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  
  const save = useCallback(async (): Promise<SaveResult> => {
    setIsLoading(true)
    setLastError(null)
    try {
      const result = await store.save()
      if (!result.success && result.error && result.error !== 'Cancelled') {
        setLastError(result.error)
      }
      return result
    } finally {
      setIsLoading(false)
    }
  }, [store])
  
  const saveAs = useCallback(async (): Promise<SaveResult> => {
    setIsLoading(true)
    setLastError(null)
    try {
      const result = await store.save(true) // forceNewPath = true
      if (!result.success && result.error && result.error !== 'Cancelled') {
        setLastError(result.error)
      }
      return result
    } finally {
      setIsLoading(false)
    }
  }, [store])
  
  const load = useCallback(async (): Promise<LoadResult> => {
    // 🧹 WAVE 2014.5: Direct load, no confirmation dialog
    // The user clicked "Open" - they know what they're doing
    setIsLoading(true)
    setLastError(null)
    try {
      const result = await store.load()
      if (!result.success && result.error && result.error !== 'Cancelled') {
        setLastError(result.error)
      }
      return result
    } finally {
      setIsLoading(false)
    }
  }, [store])
  
  const newProject = useCallback(() => {
    // 🧹 WAVE 2014.5: Direct reset, no confirmation dialog
    // The user clicked "New" - they know what they're doing
    store.newProject('Untitled Project')
    console.log('[useChronosProject] 🆕 New project created')
  }, [store])
  
  const markDirty = useCallback(() => {
    store.markDirty()
  }, [store])
  
  const updateFromSession = useCallback((
    clips: TimelineClip[],
    audio: { name: string; path: string; bpm: number; durationMs: number } | null,
    playheadMs: number = 0
  ) => {
    store.updateFromSession(clips, audio, playheadMs)
  }, [store])
  
  // 🆔 WAVE 2014.5: Audio path management
  const setAudioPath = useCallback((path: string) => {
    store.setAudioPath(path)
  }, [store])
  
  const getAudioInfo = useCallback(() => {
    return store.getAudioInfo()
  }, [store])
  
  // ─────────────────────────────────────────────────────────────────────────
  // KEYBOARD SHORTCUTS
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if ((e.target as HTMLElement).tagName === 'INPUT' || 
          (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return
      }
      
      const isCtrl = e.ctrlKey || e.metaKey
      
      // Ctrl+S - Save
      if (isCtrl && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault()
        save()
        return
      }
      
      // Ctrl+Shift+S - Save As
      if (isCtrl && e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault()
        saveAs()
        return
      }
      
      // Ctrl+O - Open
      if (isCtrl && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        load()
        return
      }
      
      // Ctrl+N - New
      if (isCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        newProject()
        return
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [save, saveAs, load, newProject])
  
  // ─────────────────────────────────────────────────────────────────────────
  // BEFORE UNLOAD WARNING
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])
  
  // ─────────────────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────────────────
  
  return {
    // State
    projectName,
    hasUnsavedChanges,
    isLoading,
    lastError,
    project,
    // Actions
    save,
    saveAs,
    load,
    newProject,
    markDirty,
    updateFromSession,
    // 🆔 WAVE 2014.5
    setAudioPath,
    getAudioInfo,
  }
}

export default useChronosProject
