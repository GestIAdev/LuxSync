/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏪 WAVE 2083: CHRONOS TEST ARMY — PERIPHERAL COVERAGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 11: chronosStore (Zustand)
 * Tests: Initial state, CRUD (tracks, clips, markers, automation),
 * undo/redo with structuredClone, selection, UI state, zoom logic.
 * 
 * STRATEGY: Mock ChronosEngine.getInstance() to avoid AudioContext/RAF.
 * The store proxies playback calls to ChronosEngine — we verify the store
 * state mutations, NOT the engine behavior (ChronosEngine has its own tests).
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module chronos/__tests__/chronosStore
 * @version WAVE 2083
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { useChronosStore } from '../store/chronosStore'
import { createDefaultProject, generateChronosId } from '../core/types'
import type { ChronosProject, EffectTriggerData } from '../core/types'

// ─────────────────────────────────────────────────────────────────────
// CLIP DATA FIXTURE
// ─────────────────────────────────────────────────────────────────────
const CLIP_DATA: EffectTriggerData = {
  type: 'effect_trigger',
  effectId: 'strobe_burst',
  intensity: 0.8,
  speed: 1.0,
  zones: ['front'],
  bpmSync: false,
  params: {},
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎭 MOCK CHRONOS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

const mockEngine = {
  loadProject: vi.fn(),
  unloadProject: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  seek: vi.fn(),
  setPlaybackRate: vi.fn(),
  setLooping: vi.fn(),
  setLoopRegion: vi.fn(),
  startScrubbing: vi.fn(),
  scrubTo: vi.fn(),
  endScrubbing: vi.fn(),
  loadAudio: vi.fn().mockResolvedValue(undefined),
  unloadAudio: vi.fn(),
  getDurationMs: vi.fn().mockReturnValue(180000),
  getState: vi.fn().mockReturnValue({
    playbackState: 'stopped',
    currentTimeMs: 0,
    playbackRate: 1.0,
    looping: false,
    loopRegion: null,
    hasAudio: false,
    durationMs: 180000,
  }),
  on: vi.fn().mockReturnValue(() => {}),
}

vi.mock('../core/ChronosEngine', () => ({
  ChronosEngine: {
    getInstance: () => mockEngine,
    destroyInstance: vi.fn(),
  },
}))

// ═══════════════════════════════════════════════════════════════════════════
// 🏪 CHRONOS STORE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🏪 chronosStore — The Reactive State', () => {

  /** Reset store and mocks before each test */
  beforeEach(() => {
    // Reset Zustand store to initial state (partial — keeps actions)
    useChronosStore.setState({
      project: null,
      isDirty: false,
      filePath: null,
      undoStack: [],
      redoStack: [],
      historyLimit: 50,
      playbackState: 'stopped',
      currentTimeMs: 0,
      playbackRate: 1.0,
      isLooping: false,
      loopRegion: null,
      hasAudio: false,
      durationMs: 0,
      selectedClipId: null,
      selectedClipIds: [],
      selectedTrackId: null,
      selectedPointId: null,
      timeSelection: null,
      isEditing: false,
      clipboard: null,
      zoomLevel: 100,
      scrollPositionMs: 0,
      viewportWidth: 1000,
      showGrid: true,
      showWaveform: true,
      showMarkers: true,
      snapEnabled: true,
      snapResolution: 'beat',
    })

    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────
  // INITIAL STATE
  // ─────────────────────────────────────────────────────────────────────

  describe('🏁 Initial State', () => {

    test('starts with no project', () => {
      const state = useChronosStore.getState()
      expect(state.project).toBeNull()
      expect(state.isDirty).toBe(false)
      expect(state.filePath).toBeNull()
    })

    test('starts in stopped playback', () => {
      const state = useChronosStore.getState()
      expect(state.playbackState).toBe('stopped')
      expect(state.currentTimeMs).toBe(0)
      expect(state.playbackRate).toBe(1.0)
    })

    test('starts with no selection', () => {
      const state = useChronosStore.getState()
      expect(state.selectedClipId).toBeNull()
      expect(state.selectedClipIds).toEqual([])
      expect(state.selectedTrackId).toBeNull()
    })

    test('starts with default UI state', () => {
      const state = useChronosStore.getState()
      expect(state.zoomLevel).toBe(100)
      expect(state.showGrid).toBe(true)
      expect(state.snapEnabled).toBe(true)
      expect(state.snapResolution).toBe('beat')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // PROJECT LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────

  describe('📂 Project Lifecycle', () => {

    test('createProject generates a new project', () => {
      useChronosStore.getState().createProject('Test Show')

      const state = useChronosStore.getState()
      expect(state.project).not.toBeNull()
      expect(state.project!.meta.name).toBe('Test Show')
      expect(state.isDirty).toBe(false)
      expect(mockEngine.loadProject).toHaveBeenCalledTimes(1)
    })

    test('loadProject sets project and filePath', () => {
      const project = createDefaultProject('Loaded Show')
      useChronosStore.getState().loadProject(project, '/path/to/show.lux')

      const state = useChronosStore.getState()
      expect(state.project!.meta.name).toBe('Loaded Show')
      expect(state.filePath).toBe('/path/to/show.lux')
      expect(state.isDirty).toBe(false)
    })

    test('closeProject resets to initial', () => {
      useChronosStore.getState().createProject()
      useChronosStore.getState().closeProject()

      const state = useChronosStore.getState()
      expect(state.project).toBeNull()
      expect(mockEngine.unloadProject).toHaveBeenCalled()
    })

    test('saveProject clears isDirty', () => {
      useChronosStore.getState().createProject()
      // Simulate a mutation
      useChronosStore.getState().addTrack('vibe')
      expect(useChronosStore.getState().isDirty).toBe(true)

      useChronosStore.getState().saveProject()
      expect(useChronosStore.getState().isDirty).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TRACK CRUD
  // ─────────────────────────────────────────────────────────────────────

  describe('🎚️ Track CRUD', () => {

    beforeEach(() => {
      useChronosStore.getState().createProject('Track Test')
    })

    test('addTrack creates track and returns ID', () => {
      const trackId = useChronosStore.getState().addTrack('vibe', 'My Vibes')

      expect(typeof trackId).toBe('string')
      expect(trackId.length).toBeGreaterThan(0)

      const tracks = useChronosStore.getState().project!.tracks
      expect(tracks).toHaveLength(1)
      expect(tracks[0].name).toBe('My Vibes')
      expect(tracks[0].type).toBe('vibe')
    })

    test('addTrack marks project dirty', () => {
      useChronosStore.getState().addTrack('effect')
      expect(useChronosStore.getState().isDirty).toBe(true)
    })

    test('deleteTrack removes track', () => {
      const id = useChronosStore.getState().addTrack('vibe')
      useChronosStore.getState().deleteTrack(id)

      expect(useChronosStore.getState().project!.tracks).toHaveLength(0)
    })

    test('deleteTrack clears selectedTrackId if same', () => {
      const id = useChronosStore.getState().addTrack('vibe')
      useChronosStore.getState().selectTrack(id)
      expect(useChronosStore.getState().selectedTrackId).toBe(id)

      useChronosStore.getState().deleteTrack(id)
      expect(useChronosStore.getState().selectedTrackId).toBeNull()
    })

    test('updateTrack modifies track properties', () => {
      const id = useChronosStore.getState().addTrack('vibe', 'Original')
      useChronosStore.getState().updateTrack(id, { name: 'Renamed' } as any)

      const track = useChronosStore.getState().project!.tracks[0]
      expect(track.name).toBe('Renamed')
    })

    test('reorderTracks reorders tracks by ID array', () => {
      const idA = useChronosStore.getState().addTrack('vibe', 'A')
      const idB = useChronosStore.getState().addTrack('effect', 'B')

      useChronosStore.getState().reorderTracks([idB, idA])

      const tracks = useChronosStore.getState().project!.tracks
      expect(tracks[0].id).toBe(idB)
      expect(tracks[1].id).toBe(idA)
      expect(tracks[0].order).toBe(0)
      expect(tracks[1].order).toBe(1)
    })

    test('duplicateTrack creates copy with new ID', () => {
      const originalId = useChronosStore.getState().addTrack('vibe', 'Original')
      const copyId = useChronosStore.getState().duplicateTrack(originalId)

      expect(copyId).not.toBeNull()
      expect(copyId).not.toBe(originalId)

      const tracks = useChronosStore.getState().project!.tracks
      expect(tracks).toHaveLength(2)
      expect(tracks[1].name).toBe('Original (copy)')
    })

    test('addTrack on null project returns ID without crash', () => {
      useChronosStore.getState().closeProject()
      const id = useChronosStore.getState().addTrack('vibe')
      expect(typeof id).toBe('string')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // CLIP CRUD
  // ─────────────────────────────────────────────────────────────────────

  describe('🎬 Clip CRUD', () => {

    let trackId: string

    beforeEach(() => {
      useChronosStore.getState().createProject('Clip Test')
      trackId = useChronosStore.getState().addTrack('effect', 'FX Track')
    })

    test('addClip creates clip in track', () => {
      const clipId = useChronosStore.getState().addClip(
        trackId, 'effect_trigger' as any, 1000, 2000, CLIP_DATA
      )

      expect(clipId).not.toBeNull()
      const track = useChronosStore.getState().project!.tracks[0]
      expect(track.clips).toHaveLength(1)
      expect(track.clips[0].startMs).toBe(1000)
      expect(track.clips[0].durationMs).toBe(2000)
    })

    test('addClip auto-selects the new clip', () => {
      const clipId = useChronosStore.getState().addClip(
        trackId, 'effect_trigger' as any, 0, 1000, CLIP_DATA
      )
      expect(useChronosStore.getState().selectedClipId).toBe(clipId)
    })

    test('deleteClip removes clip from track', () => {
      const clipId = useChronosStore.getState().addClip(
        trackId, 'effect_trigger' as any, 0, 1000, CLIP_DATA
      )!
      useChronosStore.getState().deleteClip(clipId)

      const track = useChronosStore.getState().project!.tracks[0]
      expect(track.clips).toHaveLength(0)
    })

    test('deleteClip clears selection if deleted clip was selected', () => {
      const clipId = useChronosStore.getState().addClip(
        trackId, 'effect_trigger' as any, 0, 1000, CLIP_DATA
      )!
      expect(useChronosStore.getState().selectedClipId).toBe(clipId)

      useChronosStore.getState().deleteClip(clipId)
      expect(useChronosStore.getState().selectedClipId).toBeNull()
    })

    test('moveClip updates startMs within same track', () => {
      const clipId = useChronosStore.getState().addClip(
        trackId, 'effect_trigger' as any, 1000, 500, CLIP_DATA
      )!
      useChronosStore.getState().moveClip(clipId, 5000)

      const clip = useChronosStore.getState().project!.tracks[0].clips[0]
      expect(clip.startMs).toBe(5000)
    })

    test('resizeClip updates startMs and durationMs', () => {
      const clipId = useChronosStore.getState().addClip(
        trackId, 'effect_trigger' as any, 1000, 500, CLIP_DATA
      )!
      useChronosStore.getState().resizeClip(clipId, 800, 1200)

      const clip = useChronosStore.getState().project!.tracks[0].clips[0]
      expect(clip.startMs).toBe(800)
      expect(clip.durationMs).toBe(1200)
    })

    test('duplicateClip creates copy offset in time', () => {
      const origId = useChronosStore.getState().addClip(
        trackId, 'effect_trigger' as any, 1000, 500, CLIP_DATA
      )!
      const copyId = useChronosStore.getState().duplicateClip(origId)

      expect(copyId).not.toBeNull()
      expect(copyId).not.toBe(origId)

      const track = useChronosStore.getState().project!.tracks[0]
      expect(track.clips).toHaveLength(2)
      // Copy should be offset: startMs + durationMs + 100
      expect(track.clips[1].startMs).toBe(1000 + 500 + 100)
    })

    test('addClip on invalid trackId returns null', () => {
      const clipId = useChronosStore.getState().addClip(
        'nonexistent-track', 'effect_trigger' as any, 0, 1000, CLIP_DATA
      )
      expect(clipId).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // UNDO / REDO
  // ─────────────────────────────────────────────────────────────────────

  describe('⏮️ Undo / Redo', () => {

    beforeEach(() => {
      useChronosStore.getState().createProject('Undo Test')
    })

    test('addTrack pushes to undo stack', () => {
      useChronosStore.getState().addTrack('vibe', 'Track A')
      expect(useChronosStore.getState().undoStack.length).toBe(1)
    })

    test('undo restores previous project state', () => {
      useChronosStore.getState().addTrack('vibe', 'Track A')
      expect(useChronosStore.getState().project!.tracks).toHaveLength(1)

      useChronosStore.getState().undo()
      expect(useChronosStore.getState().project!.tracks).toHaveLength(0)
    })

    test('redo restores undone state', () => {
      useChronosStore.getState().addTrack('vibe', 'Track A')
      useChronosStore.getState().undo()
      expect(useChronosStore.getState().project!.tracks).toHaveLength(0)

      useChronosStore.getState().redo()
      expect(useChronosStore.getState().project!.tracks).toHaveLength(1)
      expect(useChronosStore.getState().project!.tracks[0].name).toBe('Track A')
    })

    test('undo with empty stack does nothing', () => {
      const before = useChronosStore.getState().project
      useChronosStore.getState().undo()
      const after = useChronosStore.getState().project
      expect(after).toBe(before)
    })

    test('redo with empty stack does nothing', () => {
      const before = useChronosStore.getState().project
      useChronosStore.getState().redo()
      const after = useChronosStore.getState().project
      expect(after).toBe(before)
    })

    test('new action clears redo stack', () => {
      useChronosStore.getState().addTrack('vibe')
      useChronosStore.getState().undo()
      expect(useChronosStore.getState().redoStack.length).toBe(1)

      useChronosStore.getState().addTrack('effect') // new action
      expect(useChronosStore.getState().redoStack.length).toBe(0)
    })

    test('undo uses structuredClone (deep copy isolation)', () => {
      useChronosStore.getState().addTrack('vibe', 'Original')
      
      // The undo stack should hold a DEEP copy
      const undoEntry = useChronosStore.getState().undoStack[0]
      expect(undoEntry).not.toBe(useChronosStore.getState().project)
      
      // Mutating the undo entry should NOT affect current project
      // (this tests that structuredClone was used correctly)
      const currentName = useChronosStore.getState().project!.meta.name
      undoEntry.meta.name = 'MUTATED'
      expect(useChronosStore.getState().project!.meta.name).toBe(currentName)
    })

    test('history respects historyLimit of 50', () => {
      // Add 55 tracks (each pushes to undo)
      for (let i = 0; i < 55; i++) {
        useChronosStore.getState().addTrack('vibe', `Track ${i}`)
      }

      expect(useChronosStore.getState().undoStack.length).toBeLessThanOrEqual(50)
    })

    test('clearHistory empties both stacks', () => {
      useChronosStore.getState().addTrack('vibe')
      useChronosStore.getState().addTrack('effect')
      useChronosStore.getState().undo()

      useChronosStore.getState().clearHistory()
      expect(useChronosStore.getState().undoStack).toHaveLength(0)
      expect(useChronosStore.getState().redoStack).toHaveLength(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // MARKERS
  // ─────────────────────────────────────────────────────────────────────

  describe('📍 Markers', () => {

    beforeEach(() => {
      useChronosStore.getState().createProject('Marker Test')
    })

    test('addMarker creates marker at time', () => {
      const id = useChronosStore.getState().addMarker(5000, 'drop', 'Big Drop')

      const markers = useChronosStore.getState().project!.markers
      expect(markers).toHaveLength(1)
      expect(markers[0].timeMs).toBe(5000)
      expect(markers[0].type).toBe('drop')
      expect(markers[0].label).toBe('Big Drop')
    })

    test('markers are sorted by time', () => {
      useChronosStore.getState().addMarker(5000, 'drop', 'Second')
      useChronosStore.getState().addMarker(1000, 'cue', 'First')

      const markers = useChronosStore.getState().project!.markers
      expect(markers[0].timeMs).toBe(1000)
      expect(markers[1].timeMs).toBe(5000)
    })

    test('deleteMarker removes marker', () => {
      const id = useChronosStore.getState().addMarker(5000, 'drop', 'Gone')
      useChronosStore.getState().deleteMarker(id)

      expect(useChronosStore.getState().project!.markers).toHaveLength(0)
    })

    test('updateMarker modifies marker', () => {
      const id = useChronosStore.getState().addMarker(5000, 'drop', 'Original')
      useChronosStore.getState().updateMarker(id, { label: 'Updated' })

      expect(useChronosStore.getState().project!.markers[0].label).toBe('Updated')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // SELECTION
  // ─────────────────────────────────────────────────────────────────────

  describe('🎯 Selection', () => {

    test('selectClip sets selectedClipId and selectedClipIds', () => {
      useChronosStore.getState().selectClip('clip-42')
      const s = useChronosStore.getState()
      expect(s.selectedClipId).toBe('clip-42')
      expect(s.selectedClipIds).toEqual(['clip-42'])
    })

    test('selectClip(null) clears', () => {
      useChronosStore.getState().selectClip('clip-42')
      useChronosStore.getState().selectClip(null)
      expect(useChronosStore.getState().selectedClipId).toBeNull()
      expect(useChronosStore.getState().selectedClipIds).toEqual([])
    })

    test('selectMultipleClips sets both', () => {
      useChronosStore.getState().selectMultipleClips(['a', 'b', 'c'])
      const s = useChronosStore.getState()
      expect(s.selectedClipIds).toEqual(['a', 'b', 'c'])
      expect(s.selectedClipId).toBe('a') // First in array
    })

    test('addToSelection adds clip without duplicates', () => {
      useChronosStore.getState().selectClip('a')
      useChronosStore.getState().addToSelection('b')
      expect(useChronosStore.getState().selectedClipIds).toEqual(['a', 'b'])

      // Adding same clip again → no duplicate
      useChronosStore.getState().addToSelection('b')
      expect(useChronosStore.getState().selectedClipIds).toEqual(['a', 'b'])
    })

    test('removeFromSelection removes clip', () => {
      useChronosStore.getState().selectMultipleClips(['a', 'b', 'c'])
      useChronosStore.getState().removeFromSelection('b')
      expect(useChronosStore.getState().selectedClipIds).toEqual(['a', 'c'])
    })

    test('clearSelection resets all selection state', () => {
      useChronosStore.getState().selectClip('clip-1')
      useChronosStore.getState().selectTrack('track-1')
      useChronosStore.getState().selectPoint('point-1')
      useChronosStore.getState().setTimeSelection(0, 5000)

      useChronosStore.getState().clearSelection()

      const s = useChronosStore.getState()
      expect(s.selectedClipId).toBeNull()
      expect(s.selectedClipIds).toEqual([])
      expect(s.selectedTrackId).toBeNull()
      expect(s.selectedPointId).toBeNull()
      expect(s.timeSelection).toBeNull()
    })

    test('setEditing toggles editing mode', () => {
      useChronosStore.getState().setEditing(true)
      expect(useChronosStore.getState().isEditing).toBe(true)
      useChronosStore.getState().setEditing(false)
      expect(useChronosStore.getState().isEditing).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // UI STATE
  // ─────────────────────────────────────────────────────────────────────

  describe('🖥️ UI State', () => {

    test('setZoom clamps between 10 and 500', () => {
      useChronosStore.getState().setZoom(5)
      expect(useChronosStore.getState().zoomLevel).toBe(10) // clamped min

      useChronosStore.getState().setZoom(999)
      expect(useChronosStore.getState().zoomLevel).toBe(500) // clamped max

      useChronosStore.getState().setZoom(200)
      expect(useChronosStore.getState().zoomLevel).toBe(200) // within range
    })

    test('zoomIn increases zoom by 1.2×', () => {
      useChronosStore.getState().setZoom(100)
      useChronosStore.getState().zoomIn()
      expect(useChronosStore.getState().zoomLevel).toBeCloseTo(120, 0)
    })

    test('zoomOut decreases zoom by ÷1.2', () => {
      useChronosStore.getState().setZoom(120)
      useChronosStore.getState().zoomOut()
      expect(useChronosStore.getState().zoomLevel).toBeCloseTo(100, 0)
    })

    test('toggleGrid flips showGrid', () => {
      expect(useChronosStore.getState().showGrid).toBe(true)
      useChronosStore.getState().toggleGrid()
      expect(useChronosStore.getState().showGrid).toBe(false)
      useChronosStore.getState().toggleGrid()
      expect(useChronosStore.getState().showGrid).toBe(true)
    })

    test('toggleSnap flips snapEnabled', () => {
      expect(useChronosStore.getState().snapEnabled).toBe(true)
      useChronosStore.getState().toggleSnap()
      expect(useChronosStore.getState().snapEnabled).toBe(false)
    })

    test('setScrollPosition clamps to >= 0', () => {
      useChronosStore.getState().setScrollPosition(-100)
      expect(useChronosStore.getState().scrollPositionMs).toBe(0)

      useChronosStore.getState().setScrollPosition(5000)
      expect(useChronosStore.getState().scrollPositionMs).toBe(5000)
    })

    test('setSnapResolution changes resolution', () => {
      useChronosStore.getState().setSnapResolution('bar')
      expect(useChronosStore.getState().snapResolution).toBe('bar')
    })

    test('setViewportWidth updates viewportWidth', () => {
      useChronosStore.getState().setViewportWidth(1920)
      expect(useChronosStore.getState().viewportWidth).toBe(1920)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // PLAYBACK (Store-side state mutations)
  // ─────────────────────────────────────────────────────────────────────

  describe('▶️ Playback State', () => {

    test('play sets playbackState to playing', () => {
      useChronosStore.getState().play()
      expect(useChronosStore.getState().playbackState).toBe('playing')
      expect(mockEngine.play).toHaveBeenCalled()
    })

    test('pause sets playbackState to paused', () => {
      useChronosStore.getState().pause()
      expect(useChronosStore.getState().playbackState).toBe('paused')
      expect(mockEngine.pause).toHaveBeenCalled()
    })

    test('stop sets playbackState to stopped and resets time', () => {
      useChronosStore.getState().play()
      useChronosStore.getState().stop()
      expect(useChronosStore.getState().playbackState).toBe('stopped')
      expect(useChronosStore.getState().currentTimeMs).toBe(0)
    })

    test('seek updates currentTimeMs', () => {
      useChronosStore.getState().seek(5000)
      expect(useChronosStore.getState().currentTimeMs).toBe(5000)
      expect(mockEngine.seek).toHaveBeenCalledWith(5000)
    })

    test('setPlaybackRate updates rate', () => {
      useChronosStore.getState().setPlaybackRate(2.0)
      expect(useChronosStore.getState().playbackRate).toBe(2.0)
      expect(mockEngine.setPlaybackRate).toHaveBeenCalledWith(2.0)
    })

    test('toggleLoop flips isLooping', () => {
      useChronosStore.getState().toggleLoop()
      expect(useChronosStore.getState().isLooping).toBe(true)
      expect(mockEngine.setLooping).toHaveBeenCalledWith(true)
    })

    test('_updateTime sets currentTimeMs directly', () => {
      useChronosStore.getState()._updateTime(9999)
      expect(useChronosStore.getState().currentTimeMs).toBe(9999)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // AUTOMATION
  // ─────────────────────────────────────────────────────────────────────

  describe('📈 Automation', () => {

    beforeEach(() => {
      useChronosStore.getState().createProject('Auto Test')
    })

    test('addAutomationLane as global automation', () => {
      const laneId = useChronosStore.getState().addAutomationLane(null, 'master.intensity')

      expect(laneId).not.toBeNull()
      const lanes = useChronosStore.getState().project!.globalAutomation
      expect(lanes).toHaveLength(1)
      expect(lanes[0].target).toBe('master.intensity')
    })

    test('addAutomationLane on track', () => {
      const trackId = useChronosStore.getState().addTrack('vibe')
      const laneId = useChronosStore.getState().addAutomationLane(trackId, 'master.speed')

      expect(laneId).not.toBeNull()
      const track = useChronosStore.getState().project!.tracks[0]
      expect(track.automation).toHaveLength(1)
    })

    test('addAutomationPoint adds sorted point to lane', () => {
      const laneId = useChronosStore.getState().addAutomationLane(null, 'master.intensity')!
      
      useChronosStore.getState().addAutomationPoint(laneId, 5000, 0.8)
      useChronosStore.getState().addAutomationPoint(laneId, 1000, 0.2)

      const lane = useChronosStore.getState().project!.globalAutomation[0]
      expect(lane.points).toHaveLength(2)
      // Should be sorted by time
      expect(lane.points[0].timeMs).toBe(1000)
      expect(lane.points[1].timeMs).toBe(5000)
    })

    test('deleteAutomationLane removes lane', () => {
      const laneId = useChronosStore.getState().addAutomationLane(null, 'master.intensity')!
      useChronosStore.getState().deleteAutomationLane(laneId)

      expect(useChronosStore.getState().project!.globalAutomation).toHaveLength(0)
    })

    test('deleteAutomationPoint removes point', () => {
      const laneId = useChronosStore.getState().addAutomationLane(null, 'master.intensity')!
      const pointId = useChronosStore.getState().addAutomationPoint(laneId, 5000, 0.8)!

      useChronosStore.getState().deleteAutomationPoint(pointId)

      const lane = useChronosStore.getState().project!.globalAutomation[0]
      expect(lane.points).toHaveLength(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // PROJECT CONFIG
  // ─────────────────────────────────────────────────────────────────────

  describe('⚙️ Project Config', () => {

    beforeEach(() => {
      useChronosStore.getState().createProject('Config Test')
    })

    test('setProjectMeta updates meta fields', () => {
      useChronosStore.getState().setProjectMeta({ bpm: 140, description: 'Fast show' })

      const meta = useChronosStore.getState().project!.meta
      expect(meta.bpm).toBe(140)
      expect(meta.description).toBe('Fast show')
    })

    test('setPlaybackConfig updates playback config', () => {
      useChronosStore.getState().setPlaybackConfig({ overrideMode: 'full' })
      expect(useChronosStore.getState().project!.playback.overrideMode).toBe('full')
    })
  })
})
