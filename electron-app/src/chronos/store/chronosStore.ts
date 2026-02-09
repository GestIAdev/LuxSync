/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ CHRONOS STORE - THE REACTIVE STATE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2001: THE FOUNDATION
 * 
 * Store Zustand para el estado reactivo del Timecoder.
 * Gestiona el proyecto, selección, y sincronización con ChronosEngine.
 * 
 * ARQUITECTURA:
 * - useChronosStore: Estado principal del proyecto
 * - useChronosPlayback: Estado de playback (separado para performance)
 * - useChronosTime: Hook optimizado para tiempo actual (60fps)
 * - useChronosSelection: Estado de selección en UI
 * 
 * @module chronos/store/chronosStore
 * @version 2001.0.0
 */

import { create } from 'zustand'
import { subscribeWithSelector, devtools } from 'zustand/middleware'
import type {
  ChronosProject,
  ChronosId,
  TimeMs,
  TimelineTrack,
  TimelineClip,
  TrackType,
  ClipType,
  ClipData,
  AutomationLane,
  AutomationPoint,
  AutomationTarget,
  ChronosMarker,
  MarkerType,
  PlaybackState,
  ChronosContext,
  TrackUpdate,
  ClipUpdate,
  AutomationPointUpdate,
  SnapResolution,
  ChronosOverrideMode,
} from '../core/types'
import {
  generateChronosId,
  createDefaultProject,
  createDefaultTrack,
  createAutomationLane,
  createAutomationPoint,
} from '../core/types'
import { ChronosEngine } from '../core/ChronosEngine'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 STORE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado principal del proyecto
 */
interface ChronosProjectState {
  /** Proyecto actual (null si no hay proyecto) */
  project: ChronosProject | null
  
  /** ¿Proyecto modificado desde último save? */
  isDirty: boolean
  
  /** Ruta del archivo del proyecto (null si nuevo) */
  filePath: string | null
  
  /** Historial de undo (para implementar después) */
  undoStack: ChronosProject[]
  
  /** Historial de redo */
  redoStack: ChronosProject[]
  
  /** Límite de historial */
  historyLimit: number
}

/**
 * Estado de playback (sincronizado con ChronosEngine)
 */
interface ChronosPlaybackState {
  /** Estado de reproducción */
  playbackState: PlaybackState
  
  /** Tiempo actual (ms) */
  currentTimeMs: TimeMs
  
  /** Velocidad de reproducción */
  playbackRate: number
  
  /** ¿Loop activo? */
  isLooping: boolean
  
  /** Región de loop */
  loopRegion: { startMs: TimeMs; endMs: TimeMs } | null
  
  /** ¿Audio cargado? */
  hasAudio: boolean
  
  /** Duración total */
  durationMs: TimeMs
}

/**
 * Estado de selección y UI
 */
interface ChronosSelectionState {
  /** ID del clip seleccionado */
  selectedClipId: ChronosId | null
  
  /** IDs de clips en selección múltiple */
  selectedClipIds: ChronosId[]
  
  /** ID de la track seleccionada */
  selectedTrackId: ChronosId | null
  
  /** ID del punto de automation seleccionado */
  selectedPointId: ChronosId | null
  
  /** Región de tiempo seleccionada */
  timeSelection: { startMs: TimeMs; endMs: TimeMs } | null
  
  /** ¿Está editando un clip? (renombrando, etc) */
  isEditing: boolean
  
  /** Clipboard para copy/paste */
  clipboard: TimelineClip[] | null
}

/**
 * Estado de UI del timeline
 */
interface ChronosUIState {
  /** Zoom horizontal (pixels por segundo) */
  zoomLevel: number
  
  /** Scroll horizontal (ms) */
  scrollPositionMs: TimeMs
  
  /** Ancho visible del viewport (pixels) */
  viewportWidth: number
  
  /** ¿Mostrar grid? */
  showGrid: boolean
  
  /** ¿Mostrar waveform? */
  showWaveform: boolean
  
  /** ¿Mostrar markers? */
  showMarkers: boolean
  
  /** ¿Snap activo? */
  snapEnabled: boolean
  
  /** Resolución de snap */
  snapResolution: SnapResolution
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎛️ ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

interface ChronosProjectActions {
  // Lifecycle
  createProject: (name?: string) => void
  loadProject: (project: ChronosProject, filePath?: string) => void
  saveProject: () => void
  closeProject: () => void
  
  // Tracks
  addTrack: (type: TrackType, name?: string) => ChronosId
  updateTrack: (trackId: ChronosId, updates: TrackUpdate) => void
  deleteTrack: (trackId: ChronosId) => void
  reorderTracks: (trackIds: ChronosId[]) => void
  duplicateTrack: (trackId: ChronosId) => ChronosId | null
  
  // Clips
  addClip: <T extends ClipData>(
    trackId: ChronosId, 
    type: ClipType, 
    startMs: TimeMs, 
    durationMs: TimeMs,
    data: T
  ) => ChronosId | null
  updateClip: (clipId: ChronosId, updates: ClipUpdate) => void
  deleteClip: (clipId: ChronosId) => void
  moveClip: (clipId: ChronosId, newStartMs: TimeMs, newTrackId?: ChronosId) => void
  resizeClip: (clipId: ChronosId, newStartMs: TimeMs, newDurationMs: TimeMs) => void
  duplicateClip: (clipId: ChronosId) => ChronosId | null
  
  // Automation
  addAutomationLane: (trackId: ChronosId | null, target: AutomationTarget) => ChronosId | null
  deleteAutomationLane: (laneId: ChronosId) => void
  addAutomationPoint: (laneId: ChronosId, timeMs: TimeMs, value: number) => ChronosId | null
  updateAutomationPoint: (pointId: ChronosId, updates: AutomationPointUpdate) => void
  deleteAutomationPoint: (pointId: ChronosId) => void
  
  // Markers
  addMarker: (timeMs: TimeMs, type: MarkerType, label: string) => ChronosId
  updateMarker: (markerId: ChronosId, updates: Partial<ChronosMarker>) => void
  deleteMarker: (markerId: ChronosId) => void
  
  // Project config
  setProjectMeta: (meta: Partial<ChronosProject['meta']>) => void
  setPlaybackConfig: (config: Partial<ChronosProject['playback']>) => void
  
  // Undo/Redo
  undo: () => void
  redo: () => void
  clearHistory: () => void
}

interface ChronosPlaybackActions {
  // Playback control (proxy to ChronosEngine)
  play: () => void
  pause: () => void
  stop: () => void
  seek: (timeMs: TimeMs) => void
  setPlaybackRate: (rate: number) => void
  toggleLoop: () => void
  setLoopRegion: (startMs: TimeMs, endMs: TimeMs) => void
  
  // Scrubbing
  startScrubbing: () => void
  scrubTo: (timeMs: TimeMs) => void
  endScrubbing: (resume?: boolean) => void
  
  // Audio
  loadAudio: (arrayBuffer: ArrayBuffer) => Promise<void>
  unloadAudio: () => void
  
  // Sync state from engine
  syncFromEngine: () => void
  
  // Internal: update time (called from engine)
  _updateTime: (timeMs: TimeMs) => void
}

interface ChronosSelectionActions {
  selectClip: (clipId: ChronosId | null) => void
  selectMultipleClips: (clipIds: ChronosId[]) => void
  addToSelection: (clipId: ChronosId) => void
  removeFromSelection: (clipId: ChronosId) => void
  selectTrack: (trackId: ChronosId | null) => void
  selectPoint: (pointId: ChronosId | null) => void
  setTimeSelection: (startMs: TimeMs, endMs: TimeMs) => void
  clearTimeSelection: () => void
  clearSelection: () => void
  setEditing: (isEditing: boolean) => void
  
  // Clipboard
  copySelection: () => void
  cutSelection: () => void
  paste: (targetTimeMs?: TimeMs) => void
}

interface ChronosUIActions {
  setZoom: (level: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomToFit: () => void
  setScrollPosition: (ms: TimeMs) => void
  scrollToTime: (ms: TimeMs) => void
  setViewportWidth: (width: number) => void
  toggleGrid: () => void
  toggleWaveform: () => void
  toggleMarkers: () => void
  toggleSnap: () => void
  setSnapResolution: (resolution: SnapResolution) => void
}

/**
 * Internal actions (not exposed publicly)
 */
interface ChronosInternalActions {
  _pushHistory: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏪 COMBINED STORE TYPE
// ═══════════════════════════════════════════════════════════════════════════

type ChronosStore = 
  ChronosProjectState & 
  ChronosPlaybackState & 
  ChronosSelectionState & 
  ChronosUIState &
  ChronosProjectActions &
  ChronosPlaybackActions &
  ChronosSelectionActions &
  ChronosUIActions &
  ChronosInternalActions

// ═══════════════════════════════════════════════════════════════════════════
// 🏭 STORE CREATION
// ═══════════════════════════════════════════════════════════════════════════

const initialProjectState: ChronosProjectState = {
  project: null,
  isDirty: false,
  filePath: null,
  undoStack: [],
  redoStack: [],
  historyLimit: 50,
}

const initialPlaybackState: ChronosPlaybackState = {
  playbackState: 'stopped',
  currentTimeMs: 0,
  playbackRate: 1.0,
  isLooping: false,
  loopRegion: null,
  hasAudio: false,
  durationMs: 0,
}

const initialSelectionState: ChronosSelectionState = {
  selectedClipId: null,
  selectedClipIds: [],
  selectedTrackId: null,
  selectedPointId: null,
  timeSelection: null,
  isEditing: false,
  clipboard: null,
}

const initialUIState: ChronosUIState = {
  zoomLevel: 100, // 100 pixels per second
  scrollPositionMs: 0,
  viewportWidth: 1000,
  showGrid: true,
  showWaveform: true,
  showMarkers: true,
  snapEnabled: true,
  snapResolution: 'beat',
}

/**
 * 🏪 CHRONOS STORE
 * 
 * Store principal del Timecoder.
 */
export const useChronosStore = create<ChronosStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // ═════════════════════════════════════════════════════════════════════
      // INITIAL STATE
      // ═════════════════════════════════════════════════════════════════════
      ...initialProjectState,
      ...initialPlaybackState,
      ...initialSelectionState,
      ...initialUIState,
      
      // ═════════════════════════════════════════════════════════════════════
      // PROJECT ACTIONS
      // ═════════════════════════════════════════════════════════════════════
      
      createProject: (name = 'Untitled Show') => {
        const project = createDefaultProject(name)
        const engine = ChronosEngine.getInstance()
        engine.loadProject(project)
        
        set({
          project,
          isDirty: false,
          filePath: null,
          undoStack: [],
          redoStack: [],
          durationMs: project.meta.durationMs,
        })
      },
      
      loadProject: (project, filePath) => {
        const engine = ChronosEngine.getInstance()
        engine.loadProject(project)
        
        set({
          project,
          isDirty: false,
          filePath: filePath ?? null,
          undoStack: [],
          redoStack: [],
          durationMs: project.meta.durationMs,
        })
      },
      
      saveProject: () => {
        // TODO: Implementar persistencia a disco
        set({ isDirty: false })
      },
      
      closeProject: () => {
        const engine = ChronosEngine.getInstance()
        engine.unloadProject()
        
        set({
          ...initialProjectState,
          ...initialPlaybackState,
          ...initialSelectionState,
        })
      },
      
      // Track actions
      addTrack: (type, name) => {
        const { project } = get()
        if (!project) return generateChronosId() // Return dummy ID
        
        const order = project.tracks.length
        const track = createDefaultTrack(type, name, order)
        
        const newProject = {
          ...project,
          tracks: [...project.tracks, track],
          meta: { ...project.meta, modifiedAt: new Date().toISOString() },
        }
        
        get()._pushHistory()
        set({ project: newProject, isDirty: true })
        
        return track.id
      },
      
      updateTrack: (trackId, updates) => {
        const { project } = get()
        if (!project) return
        
        const newTracks = project.tracks.map(track =>
          track.id === trackId ? { ...track, ...updates } : track
        )
        
        set({
          project: { 
            ...project, 
            tracks: newTracks,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      deleteTrack: (trackId) => {
        const { project, selectedTrackId } = get()
        if (!project) return
        
        get()._pushHistory()
        
        const newTracks = project.tracks.filter(t => t.id !== trackId)
        
        set({
          project: { 
            ...project, 
            tracks: newTracks,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
          selectedTrackId: selectedTrackId === trackId ? null : selectedTrackId,
        })
      },
      
      reorderTracks: (trackIds) => {
        const { project } = get()
        if (!project) return
        
        const trackMap = new Map(project.tracks.map(t => [t.id, t]))
        const reordered = trackIds
          .map(id => trackMap.get(id))
          .filter((t): t is TimelineTrack => t !== undefined)
          .map((t, i) => ({ ...t, order: i }))
        
        set({
          project: { 
            ...project, 
            tracks: reordered,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      duplicateTrack: (trackId) => {
        const { project } = get()
        if (!project) return null
        
        const track = project.tracks.find(t => t.id === trackId)
        if (!track) return null
        
        get()._pushHistory()
        
        const newTrack: TimelineTrack = {
          ...track,
          id: generateChronosId(),
          name: `${track.name} (copy)`,
          order: project.tracks.length,
          clips: track.clips.map(clip => ({
            ...clip,
            id: generateChronosId(),
          })),
        }
        
        set({
          project: { 
            ...project, 
            tracks: [...project.tracks, newTrack],
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
        
        return newTrack.id
      },
      
      // Clip actions
      addClip: (trackId, type, startMs, durationMs, data) => {
        const { project } = get()
        if (!project) return null
        
        const track = project.tracks.find(t => t.id === trackId)
        if (!track) return null
        
        get()._pushHistory()
        
        const clip: TimelineClip = {
          id: generateChronosId(),
          trackId,
          type,
          startMs,
          durationMs,
          data,
          easeIn: 'linear',
          easeOut: 'linear',
          loop: false,
          priority: 0,
          enabled: true,
          meta: { label: type },
        }
        
        const newTracks = project.tracks.map(t =>
          t.id === trackId
            ? { ...t, clips: [...t.clips, clip] }
            : t
        )
        
        set({
          project: { 
            ...project, 
            tracks: newTracks,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
          selectedClipId: clip.id,
        })
        
        return clip.id
      },
      
      updateClip: (clipId, updates) => {
        const { project } = get()
        if (!project) return
        
        const newTracks = project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip =>
            clip.id === clipId ? { ...clip, ...updates } : clip
          ),
        }))
        
        set({
          project: { 
            ...project, 
            tracks: newTracks,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      deleteClip: (clipId) => {
        const { project, selectedClipId, selectedClipIds } = get()
        if (!project) return
        
        get()._pushHistory()
        
        const newTracks = project.tracks.map(track => ({
          ...track,
          clips: track.clips.filter(c => c.id !== clipId),
        }))
        
        set({
          project: { 
            ...project, 
            tracks: newTracks,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
          selectedClipId: selectedClipId === clipId ? null : selectedClipId,
          selectedClipIds: selectedClipIds.filter(id => id !== clipId),
        })
      },
      
      moveClip: (clipId, newStartMs, newTrackId) => {
        const { project } = get()
        if (!project) return
        
        get()._pushHistory()
        
        let clipToMove: TimelineClip | null = null
        let sourceTrackId: ChronosId | null = null
        
        // Find the clip
        for (const track of project.tracks) {
          const clip = track.clips.find(c => c.id === clipId)
          if (clip) {
            clipToMove = clip
            sourceTrackId = track.id
            break
          }
        }
        
        if (!clipToMove || !sourceTrackId) return
        
        const targetTrackId = newTrackId ?? sourceTrackId
        
        const newTracks = project.tracks.map(track => {
          if (track.id === sourceTrackId && track.id === targetTrackId) {
            // Same track: just update position
            return {
              ...track,
              clips: track.clips.map(c =>
                c.id === clipId ? { ...c, startMs: newStartMs } : c
              ),
            }
          } else if (track.id === sourceTrackId) {
            // Remove from source
            return {
              ...track,
              clips: track.clips.filter(c => c.id !== clipId),
            }
          } else if (track.id === targetTrackId) {
            // Add to target
            return {
              ...track,
              clips: [...track.clips, { ...clipToMove!, startMs: newStartMs, trackId: targetTrackId }],
            }
          }
          return track
        })
        
        set({
          project: { 
            ...project, 
            tracks: newTracks,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      resizeClip: (clipId, newStartMs, newDurationMs) => {
        const { project } = get()
        if (!project) return
        
        const newTracks = project.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip =>
            clip.id === clipId
              ? { ...clip, startMs: newStartMs, durationMs: newDurationMs }
              : clip
          ),
        }))
        
        set({
          project: { 
            ...project, 
            tracks: newTracks,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      duplicateClip: (clipId) => {
        const { project } = get()
        if (!project) return null
        
        for (const track of project.tracks) {
          const clip = track.clips.find(c => c.id === clipId)
          if (clip) {
            get()._pushHistory()
            
            const newClip: TimelineClip = {
              ...clip,
              id: generateChronosId(),
              startMs: clip.startMs + clip.durationMs + 100, // Offset slightly
              meta: { ...clip.meta, label: `${clip.meta.label} (copy)` },
            }
            
            const newTracks = project.tracks.map(t =>
              t.id === track.id
                ? { ...t, clips: [...t.clips, newClip] }
                : t
            )
            
            set({
              project: { 
                ...project, 
                tracks: newTracks,
                meta: { ...project.meta, modifiedAt: new Date().toISOString() },
              },
              isDirty: true,
              selectedClipId: newClip.id,
            })
            
            return newClip.id
          }
        }
        
        return null
      },
      
      // Automation actions
      addAutomationLane: (trackId, target) => {
        const { project } = get()
        if (!project) return null
        
        const lane = createAutomationLane(target)
        
        if (trackId === null) {
          // Global automation
          set({
            project: {
              ...project,
              globalAutomation: [...project.globalAutomation, lane],
              meta: { ...project.meta, modifiedAt: new Date().toISOString() },
            },
            isDirty: true,
          })
        } else {
          // Track automation
          const newTracks = project.tracks.map(t =>
            t.id === trackId
              ? { ...t, automation: [...t.automation, lane] }
              : t
          )
          
          set({
            project: { 
              ...project, 
              tracks: newTracks,
              meta: { ...project.meta, modifiedAt: new Date().toISOString() },
            },
            isDirty: true,
          })
        }
        
        return lane.id
      },
      
      deleteAutomationLane: (laneId) => {
        const { project } = get()
        if (!project) return
        
        // Check global automation
        if (project.globalAutomation.some(l => l.id === laneId)) {
          set({
            project: {
              ...project,
              globalAutomation: project.globalAutomation.filter(l => l.id !== laneId),
              meta: { ...project.meta, modifiedAt: new Date().toISOString() },
            },
            isDirty: true,
          })
          return
        }
        
        // Check track automation
        const newTracks = project.tracks.map(t => ({
          ...t,
          automation: t.automation.filter(l => l.id !== laneId),
        }))
        
        set({
          project: { 
            ...project, 
            tracks: newTracks,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      addAutomationPoint: (laneId, timeMs, value) => {
        const { project } = get()
        if (!project) return null
        
        const point = createAutomationPoint(timeMs, value)
        
        // Helper to add point to lane
        const addToLane = (lanes: AutomationLane[]): AutomationLane[] =>
          lanes.map(lane =>
            lane.id === laneId
              ? { ...lane, points: [...lane.points, point].sort((a, b) => a.timeMs - b.timeMs) }
              : lane
          )
        
        // Check global
        if (project.globalAutomation.some(l => l.id === laneId)) {
          set({
            project: {
              ...project,
              globalAutomation: addToLane(project.globalAutomation),
              meta: { ...project.meta, modifiedAt: new Date().toISOString() },
            },
            isDirty: true,
          })
          return point.id
        }
        
        // Check tracks
        const newTracks = project.tracks.map(t => ({
          ...t,
          automation: addToLane(t.automation),
        }))
        
        set({
          project: { 
            ...project, 
            tracks: newTracks,
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
        
        return point.id
      },
      
      updateAutomationPoint: (pointId, updates) => {
        const { project } = get()
        if (!project) return
        
        const updatePoints = (lanes: AutomationLane[]): AutomationLane[] =>
          lanes.map(lane => ({
            ...lane,
            points: lane.points.map(p =>
              p.id === pointId ? { ...p, ...updates } : p
            ),
          }))
        
        set({
          project: {
            ...project,
            globalAutomation: updatePoints(project.globalAutomation),
            tracks: project.tracks.map(t => ({
              ...t,
              automation: updatePoints(t.automation),
            })),
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      deleteAutomationPoint: (pointId) => {
        const { project, selectedPointId } = get()
        if (!project) return
        
        const deleteFromLanes = (lanes: AutomationLane[]): AutomationLane[] =>
          lanes.map(lane => ({
            ...lane,
            points: lane.points.filter(p => p.id !== pointId),
          }))
        
        set({
          project: {
            ...project,
            globalAutomation: deleteFromLanes(project.globalAutomation),
            tracks: project.tracks.map(t => ({
              ...t,
              automation: deleteFromLanes(t.automation),
            })),
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
          selectedPointId: selectedPointId === pointId ? null : selectedPointId,
        })
      },
      
      // Marker actions
      addMarker: (timeMs, type, label) => {
        const { project } = get()
        if (!project) return generateChronosId()
        
        const marker: ChronosMarker = {
          id: generateChronosId(),
          timeMs,
          type,
          label,
          color: getMarkerColor(type),
          autoGenerated: false,
        }
        
        set({
          project: {
            ...project,
            markers: [...project.markers, marker].sort((a, b) => a.timeMs - b.timeMs),
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
        
        return marker.id
      },
      
      updateMarker: (markerId, updates) => {
        const { project } = get()
        if (!project) return
        
        set({
          project: {
            ...project,
            markers: project.markers.map(m =>
              m.id === markerId ? { ...m, ...updates } : m
            ),
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      deleteMarker: (markerId) => {
        const { project } = get()
        if (!project) return
        
        set({
          project: {
            ...project,
            markers: project.markers.filter(m => m.id !== markerId),
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      // Config actions
      setProjectMeta: (meta) => {
        const { project } = get()
        if (!project) return
        
        set({
          project: {
            ...project,
            meta: { ...project.meta, ...meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      setPlaybackConfig: (config) => {
        const { project } = get()
        if (!project) return
        
        set({
          project: {
            ...project,
            playback: { ...project.playback, ...config },
            meta: { ...project.meta, modifiedAt: new Date().toISOString() },
          },
          isDirty: true,
        })
      },
      
      // Undo/Redo
      undo: () => {
        const { undoStack, redoStack, project } = get()
        if (undoStack.length === 0 || !project) return
        
        const prevState = undoStack[undoStack.length - 1]
        
        set({
          project: prevState,
          undoStack: undoStack.slice(0, -1),
          redoStack: [...redoStack, project].slice(-get().historyLimit),
          isDirty: true,
        })
      },
      
      redo: () => {
        const { redoStack, undoStack, project } = get()
        if (redoStack.length === 0 || !project) return
        
        const nextState = redoStack[redoStack.length - 1]
        
        set({
          project: nextState,
          redoStack: redoStack.slice(0, -1),
          undoStack: [...undoStack, project].slice(-get().historyLimit),
          isDirty: true,
        })
      },
      
      clearHistory: () => {
        set({ undoStack: [], redoStack: [] })
      },
      
      // Internal: push to undo stack
      _pushHistory: () => {
        const { project, undoStack, historyLimit } = get()
        if (!project) return
        
        set({
          undoStack: [...undoStack, structuredClone(project)].slice(-historyLimit),
          redoStack: [], // Clear redo on new action
        })
      },
      
      // ═════════════════════════════════════════════════════════════════════
      // PLAYBACK ACTIONS
      // ═════════════════════════════════════════════════════════════════════
      
      play: () => {
        const engine = ChronosEngine.getInstance()
        engine.play()
        set({ playbackState: 'playing' })
      },
      
      pause: () => {
        const engine = ChronosEngine.getInstance()
        engine.pause()
        set({ playbackState: 'paused' })
      },
      
      stop: () => {
        const engine = ChronosEngine.getInstance()
        engine.stop()
        set({ playbackState: 'stopped', currentTimeMs: 0 })
      },
      
      seek: (timeMs) => {
        const engine = ChronosEngine.getInstance()
        engine.seek(timeMs)
        set({ currentTimeMs: timeMs })
      },
      
      setPlaybackRate: (rate) => {
        const engine = ChronosEngine.getInstance()
        engine.setPlaybackRate(rate)
        set({ playbackRate: rate })
      },
      
      toggleLoop: () => {
        const { isLooping } = get()
        const engine = ChronosEngine.getInstance()
        engine.setLooping(!isLooping)
        set({ isLooping: !isLooping })
      },
      
      setLoopRegion: (startMs, endMs) => {
        const engine = ChronosEngine.getInstance()
        engine.setLoopRegion(startMs, endMs)
        set({ loopRegion: { startMs, endMs } })
      },
      
      startScrubbing: () => {
        const engine = ChronosEngine.getInstance()
        engine.startScrubbing()
        set({ playbackState: 'scrubbing' })
      },
      
      scrubTo: (timeMs) => {
        const engine = ChronosEngine.getInstance()
        engine.scrubTo(timeMs)
        set({ currentTimeMs: timeMs })
      },
      
      endScrubbing: (resume = false) => {
        const engine = ChronosEngine.getInstance()
        engine.endScrubbing(resume)
        set({ playbackState: resume ? 'playing' : 'paused' })
      },
      
      loadAudio: async (arrayBuffer) => {
        const engine = ChronosEngine.getInstance()
        await engine.loadAudio(arrayBuffer)
        set({ 
          hasAudio: true,
          durationMs: engine.getDurationMs(),
        })
      },
      
      unloadAudio: () => {
        const engine = ChronosEngine.getInstance()
        engine.unloadAudio()
        set({ hasAudio: false })
      },
      
      syncFromEngine: () => {
        const engine = ChronosEngine.getInstance()
        const state = engine.getState()
        set({
          playbackState: state.playbackState,
          currentTimeMs: state.currentTimeMs,
          playbackRate: state.playbackRate,
          isLooping: state.looping,
          loopRegion: state.loopRegion,
          hasAudio: state.hasAudio,
          durationMs: state.durationMs,
        })
      },
      
      _updateTime: (timeMs) => {
        set({ currentTimeMs: timeMs })
      },
      
      // ═════════════════════════════════════════════════════════════════════
      // SELECTION ACTIONS
      // ═════════════════════════════════════════════════════════════════════
      
      selectClip: (clipId) => {
        set({ 
          selectedClipId: clipId, 
          selectedClipIds: clipId ? [clipId] : [],
        })
      },
      
      selectMultipleClips: (clipIds) => {
        set({ 
          selectedClipIds: clipIds,
          selectedClipId: clipIds[0] ?? null,
        })
      },
      
      addToSelection: (clipId) => {
        const { selectedClipIds } = get()
        if (selectedClipIds.includes(clipId)) return
        
        set({ 
          selectedClipIds: [...selectedClipIds, clipId],
          selectedClipId: clipId,
        })
      },
      
      removeFromSelection: (clipId) => {
        const { selectedClipIds, selectedClipId } = get()
        const newSelection = selectedClipIds.filter(id => id !== clipId)
        
        set({ 
          selectedClipIds: newSelection,
          selectedClipId: selectedClipId === clipId 
            ? (newSelection[0] ?? null) 
            : selectedClipId,
        })
      },
      
      selectTrack: (trackId) => {
        set({ selectedTrackId: trackId })
      },
      
      selectPoint: (pointId) => {
        set({ selectedPointId: pointId })
      },
      
      setTimeSelection: (startMs, endMs) => {
        set({ timeSelection: { startMs, endMs } })
      },
      
      clearTimeSelection: () => {
        set({ timeSelection: null })
      },
      
      clearSelection: () => {
        set({
          selectedClipId: null,
          selectedClipIds: [],
          selectedTrackId: null,
          selectedPointId: null,
          timeSelection: null,
        })
      },
      
      setEditing: (isEditing) => {
        set({ isEditing })
      },
      
      copySelection: () => {
        const { project, selectedClipIds } = get()
        if (!project || selectedClipIds.length === 0) return
        
        const clips: TimelineClip[] = []
        for (const track of project.tracks) {
          for (const clip of track.clips) {
            if (selectedClipIds.includes(clip.id)) {
              clips.push(clip)
            }
          }
        }
        
        set({ clipboard: clips })
      },
      
      cutSelection: () => {
        get().copySelection()
        
        const { selectedClipIds } = get()
        for (const clipId of selectedClipIds) {
          get().deleteClip(clipId)
        }
      },
      
      paste: (targetTimeMs) => {
        const { clipboard, currentTimeMs, project } = get()
        if (!clipboard || clipboard.length === 0 || !project) return
        
        const pasteTime = targetTimeMs ?? currentTimeMs
        
        // Find earliest clip time as offset base
        const earliestTime = Math.min(...clipboard.map(c => c.startMs))
        
        for (const clip of clipboard) {
          const offset = clip.startMs - earliestTime
          const newStartMs = pasteTime + offset
          
          // Find matching track type
          let targetTrack = project.tracks.find(t => t.id === clip.trackId)
          if (!targetTrack) {
            // Find any track of same type
            targetTrack = project.tracks.find(t => 
              t.type === getTrackTypeForClip(clip.type)
            )
          }
          
          if (targetTrack) {
            get().addClip(
              targetTrack.id,
              clip.type,
              newStartMs,
              clip.durationMs,
              clip.data
            )
          }
        }
      },
      
      // ═════════════════════════════════════════════════════════════════════
      // UI ACTIONS
      // ═════════════════════════════════════════════════════════════════════
      
      setZoom: (level) => {
        set({ zoomLevel: Math.max(10, Math.min(level, 500)) })
      },
      
      zoomIn: () => {
        const { zoomLevel } = get()
        set({ zoomLevel: Math.min(zoomLevel * 1.2, 500) })
      },
      
      zoomOut: () => {
        const { zoomLevel } = get()
        set({ zoomLevel: Math.max(zoomLevel / 1.2, 10) })
      },
      
      zoomToFit: () => {
        const { durationMs, viewportWidth } = get()
        if (durationMs === 0) return
        
        const pixelsPerMs = viewportWidth / durationMs
        const pixelsPerSecond = pixelsPerMs * 1000
        
        set({ zoomLevel: pixelsPerSecond, scrollPositionMs: 0 })
      },
      
      setScrollPosition: (ms) => {
        set({ scrollPositionMs: Math.max(0, ms) })
      },
      
      scrollToTime: (ms) => {
        const { zoomLevel, viewportWidth } = get()
        const msPerPixel = 1000 / zoomLevel
        const viewportDurationMs = viewportWidth * msPerPixel
        
        // Center the time in viewport
        const newScroll = ms - viewportDurationMs / 2
        set({ scrollPositionMs: Math.max(0, newScroll) })
      },
      
      setViewportWidth: (width) => {
        set({ viewportWidth: width })
      },
      
      toggleGrid: () => {
        set(s => ({ showGrid: !s.showGrid }))
      },
      
      toggleWaveform: () => {
        set(s => ({ showWaveform: !s.showWaveform }))
      },
      
      toggleMarkers: () => {
        set(s => ({ showMarkers: !s.showMarkers }))
      },
      
      toggleSnap: () => {
        set(s => ({ snapEnabled: !s.snapEnabled }))
      },
      
      setSnapResolution: (resolution) => {
        set({ snapResolution: resolution })
      },
    } as ChronosStore)),
    { name: 'ChronosStore' }
  )
)

// ═══════════════════════════════════════════════════════════════════════════
// 🪝 SPECIALIZED HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook optimizado para obtener tiempo actual
 * 
 * Usa subscribeWithSelector para evitar re-renders innecesarios.
 * Solo se actualiza cuando currentTimeMs cambia significativamente.
 */
import { useEffect, useState } from 'react'

export function useChronosTime(): TimeMs {
  const [time, setTime] = useState(0)
  
  useEffect(() => {
    const engine = ChronosEngine.getInstance()
    
    const unsubscribe = engine.on('playback:tick', ({ timeMs }) => {
      setTime(timeMs)
    })
    
    return unsubscribe
  }, [])
  
  return time
}

/**
 * Hook para obtener estado de playback
 */
export function useChronosPlayback() {
  return useChronosStore(state => ({
    playbackState: state.playbackState,
    isPlaying: state.playbackState === 'playing',
    isPaused: state.playbackState === 'paused',
    isStopped: state.playbackState === 'stopped',
    isScrubbing: state.playbackState === 'scrubbing',
    playbackRate: state.playbackRate,
    isLooping: state.isLooping,
    loopRegion: state.loopRegion,
    hasAudio: state.hasAudio,
    durationMs: state.durationMs,
    // Actions
    play: state.play,
    pause: state.pause,
    stop: state.stop,
    seek: state.seek,
    setPlaybackRate: state.setPlaybackRate,
    toggleLoop: state.toggleLoop,
  }))
}

/**
 * Hook para obtener tracks del proyecto
 */
export function useChronosTracks(): TimelineTrack[] {
  return useChronosStore(state => state.project?.tracks ?? [])
}

/**
 * Hook para obtener una track específica
 */
export function useChronosTrack(trackId: ChronosId): TimelineTrack | null {
  return useChronosStore(state => 
    state.project?.tracks.find(t => t.id === trackId) ?? null
  )
}

/**
 * Hook para obtener clips de una track
 */
export function useChronosTrackClips(trackId: ChronosId): TimelineClip[] {
  return useChronosStore(state => {
    const track = state.project?.tracks.find(t => t.id === trackId)
    return track?.clips ?? []
  })
}

/**
 * Hook para obtener estado de selección
 */
export function useChronosSelection() {
  return useChronosStore(state => ({
    selectedClipId: state.selectedClipId,
    selectedClipIds: state.selectedClipIds,
    selectedTrackId: state.selectedTrackId,
    selectedPointId: state.selectedPointId,
    timeSelection: state.timeSelection,
    isEditing: state.isEditing,
    hasSelection: state.selectedClipIds.length > 0,
    // Actions
    selectClip: state.selectClip,
    selectMultipleClips: state.selectMultipleClips,
    addToSelection: state.addToSelection,
    removeFromSelection: state.removeFromSelection,
    selectTrack: state.selectTrack,
    clearSelection: state.clearSelection,
  }))
}

/**
 * Hook para obtener estado de UI
 */
export function useChronosUI() {
  return useChronosStore(state => ({
    zoomLevel: state.zoomLevel,
    scrollPositionMs: state.scrollPositionMs,
    viewportWidth: state.viewportWidth,
    showGrid: state.showGrid,
    showWaveform: state.showWaveform,
    showMarkers: state.showMarkers,
    snapEnabled: state.snapEnabled,
    snapResolution: state.snapResolution,
    // Actions
    setZoom: state.setZoom,
    zoomIn: state.zoomIn,
    zoomOut: state.zoomOut,
    zoomToFit: state.zoomToFit,
    setScrollPosition: state.setScrollPosition,
    scrollToTime: state.scrollToTime,
    toggleGrid: state.toggleGrid,
    toggleSnap: state.toggleSnap,
  }))
}

// ═══════════════════════════════════════════════════════════════════════════
// 🛠️ HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getMarkerColor(type: MarkerType): string {
  const colors: Record<MarkerType, string> = {
    drop: '#ef4444',
    breakdown: '#3b82f6',
    buildup: '#f59e0b',
    section: '#10b981',
    cue: '#8b5cf6',
    note: '#6b7280',
  }
  return colors[type]
}

function getTrackTypeForClip(clipType: ClipType): string {
  const mapping: Record<ClipType, string> = {
    vibe_change: 'vibe',
    effect_trigger: 'effect',
    intensity_curve: 'intensity',
    zone_override: 'zone',
    color_override: 'color',
    parameter_lock: 'automation',
  }
  return mapping[clipType]
}
