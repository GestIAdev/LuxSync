/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 SCENE BROWSER - WAVE 7566.2: HYPERION SCENE DECK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Compact "Live Deck" layout for the Scene Player.
 * - Active Deck (top): track name, transport, KILL, progress
 * - Queue / Load Area (bottom): inactive scenes list + compact import
 *
 * Typography unified with CONTROLS tab (uppercase, monospace, tight).
 *
 * @module components/hyperion/controls/sidebar/SceneBrowser
 * @version WAVE 7566.2
 */

import React, { useState, useCallback, useRef } from 'react'
// ⚡ WAVE 7566.3: Use context instead of calling hook directly
// ⚡ WAVE 7566.4: Context now also holds the scene library (scenes[] + selectedId)
import { useScenePlayerContext } from './ScenePlayerContext'
import type { LoadedScene } from './ScenePlayerContext'
import type { PlayerState } from '../../../../hooks/useScenePlayer'
import { deserializeLuxV3 as deserializeProject } from '../../../../chronos/core/LuxFileV3.serializer'
import { toChronosProjectV3 } from '../../../../chronos/core/LuxFileV3.factories'
import type { ChronosProjectV3 } from '../../../../chronos/core/LuxFileV3'
import {
  ScenesIcon,
  PlayCircleIcon,
  FileIcon,
  BoltIcon,
} from '../../../icons/LuxIcons'
import './SceneBrowser.css'

// ═══════════════════════════════════════════════════════════════════════════
// TRANSPORT ICONS — Custom SVG (no lucide, no emoji)
// ═══════════════════════════════════════════════════════════════════════════

const PlayIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 5v14l11-7z" />
  </svg>
)

const PauseIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
)

const StopIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
)

const LoopIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)

const ImportIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const TrashIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const EjectIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <polygon points="12 4 2 14 22 14" />
    <rect x="2" y="17" width="20" height="3" rx="1" />
  </svg>
)

const MuteIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
)

const AudioOnIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
)

const KillIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
)

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const SceneBrowser: React.FC = () => {
  // ── Scene Player Engine + Library (via Context — persists across remounts) ──
  const {
    status,
    loadScene,
    unloadScene,
    play,
    pause,
    stop,
    kill,
    toggleLoop,
    // WAVE 7566.4: Scene library lifted to context — survives tab/mode switches
    scenes,
    selectedId,
    addScene,
    removeScene,
    updateScene,
    setSelectedId,
  } = useScenePlayerContext()

  // ── Local UI State (drag-only, ephemeral) ──
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)  // WAVE 2051: Audio picker

  // ── Derived ──
  // WAVE 7566.4: selectedScene derived from context's selectedId + scenes.
  // Falls back to status.project reconstruction if selectedId is stale
  // (e.g., context was reset but engine still has a project loaded).
  const selectedScene = scenes.find(s => s.id === selectedId) ?? null
  const isPlaying = status.state === 'playing'
  const isLoaded = status.state !== 'idle'
  const inactiveScenes = scenes.filter(s => s.id !== selectedId)

  // ─────────────────────────────────────────────────────────────────────────
  // 📂 IMPORT — File picker + processor
  // ─────────────────────────────────────────────────────────────────────────

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const processFile = useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const result = await deserializeProject(text)

      if (!result.file) {
        console.error('[SceneBrowser] Invalid .lux file:', file.name)
        return
      }

      const project = toChronosProjectV3(result.file)
      // Audio — future: extract from project.audio.relativePath
      let audioUrl: string | null = null
      if (project.audio?.relativePath) {
        console.log(`[SceneBrowser] Audio reference: ${project.audio.fileName}`)
      }

      const newScene: LoadedScene = {
        id: `scene-${Date.now()}-${file.name}`,
        project,
        audioUrl,
        fileName: file.name,
        displayName: resolveProjectName(project, file.name),
      }

      addScene(newScene)
      setSelectedId(newScene.id)

      // Auto-load into player engine
      await loadScene(project, audioUrl || undefined)

      console.log(
        `[SceneBrowser] 🎬 Imported: "${newScene.displayName}" ` +
        `(${project.tracks.flatMap(t => t.clips).length} clips, ${formatTime(project.meta.durationMs)})`
      )
    } catch (err) {
      console.error('[SceneBrowser] Import failed:', err)
    }
  }, [loadScene])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    for (const file of Array.from(files)) {
      processFile(file)
    }

    // Reset so the same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [processFile])

  // ─────────────────────────────────────────────────────────────────────────
  // 📂 DRAG & DROP
  // ─────────────────────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.lux') || file.name.endsWith('.json')) {
        processFile(file)
      }
    }
  }, [processFile])

  // ─────────────────────────────────────────────────────────────────────────
  // 🎯 SELECT / DELETE
  // ─────────────────────────────────────────────────────────────────────────

  const handleSelectScene = useCallback(async (scene: LoadedScene) => {
    setSelectedId(scene.id)
    await loadScene(scene.project, scene.audioUrl || undefined)
  }, [loadScene])

  const handleDeleteScene = useCallback((sceneId: string) => {
    if (!window.confirm('Remove this scene from the list?')) return

    if (selectedId === sceneId) {
      unloadScene()
      setSelectedId(null)
    }

    removeScene(sceneId)
  }, [selectedId, unloadScene, removeScene])

  // ─────────────────────────────────────────────────────────────────────────
  // ⚡ WAVE 7566.3: KILL — Local blackout (zero DMX) WITHOUT unloading project
  // The scene stays loaded; user can press PLAY to resume.
  // ─────────────────────────────────────────────────────────────────────────

  const handleKill = useCallback(() => {
    kill()
    console.log('[SceneBrowser] ⚡ KILL — Blackout (project stays loaded)')
  }, [kill])

  // ─────────────────────────────────────────────────────────────────────────
  // 💿 WAVE 2051: LINK AUDIO — Manual audio file selection for scene
  // ─────────────────────────────────────────────────────────────────────────

  const handleLinkAudioClick = useCallback(() => {
    audioFileInputRef.current?.click()
  }, [])

  const handleAudioFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return

    try {
      // Create Blob URL for audio file
      const audioUrl = URL.createObjectURL(file)

      // Update scene with new audio URL (via context — persists)
      updateScene(selectedId, { audioUrl })

      // Reload scene with new audio
      const updatedScene = scenes.find(s => s.id === selectedId)
      if (updatedScene) {
        await loadScene(updatedScene.project, audioUrl)
        console.log(`[SceneBrowser] 🔊 Audio linked: ${file.name}`)
      }
    } catch (err) {
      console.error('[SceneBrowser] Audio link failed:', err)
    }

    // Reset input
    if (audioFileInputRef.current) audioFileInputRef.current.value = ''
  }, [selectedId, scenes, loadScene, updateScene])

  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="scene-browser">
      {/* ══════════ HEADER ══════════ */}
      <div className="scene-browser-header">
        <h4 className="section-title">
          <ScenesIcon size={14} className="title-icon-svg" />
          SCENES
          {scenes.length > 0 && (
            <span className="scene-count">{scenes.length}</span>
          )}
        </h4>
        <span className={`player-state-badge ${status.state}`}>
          {getStateLabel(status.state)}
        </span>
      </div>

      {/* ══════════ ACTIVE DECK (Top) ══════════ */}
      {selectedScene ? (
        <div className="active-deck">
          {/* ── Track Name Header ── */}
          <div className="deck-header">
            <div className="deck-title-row">
              <BoltIcon size={12} className="deck-bolt" />
              <span className="deck-title" title={selectedScene.displayName}>
                {selectedScene.displayName}
              </span>
            </div>
            <div className="deck-meta-row">
              {status.hasAudio ? (
                <AudioOnIcon size={11} className="audio-badge on" />
              ) : (
                <MuteIcon size={11} className="audio-badge mute" />
              )}
              <button
                className="link-audio-btn"
                onClick={handleLinkAudioClick}
                title={status.hasAudio ? 'Replace audio file' : 'Link audio file'}
              >
                AUDIO
              </button>
              <input
                ref={audioFileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                onChange={handleAudioFileChange}
                style={{ display: 'none' }}
              />
              <button
                className="deck-eject"
                onClick={() => { unloadScene(); setSelectedId(null) }}
                title="Eject scene"
              >
                <EjectIcon size={10} />
              </button>
            </div>
          </div>

          {/* ── Progress Bar (thick, compact) ── */}
          <div className="deck-progress">
            <div className="deck-progress-bar">
              <div
                className="deck-progress-fill"
                style={{ width: `${status.progress * 100}%` }}
              />
            </div>
            <div className="deck-progress-time">
              <span>{formatTime(status.currentTimeMs)}</span>
              <span>{formatTime(status.durationMs)}</span>
            </div>
          </div>

          {/* ── Active Clip Count (if any) ── */}
          {status.activeClipCount > 0 && (
            <div className="deck-active-clips">
              {status.activeClipCount} CLIP{status.activeClipCount !== 1 ? 'S' : ''} ACTIVE
            </div>
          )}

          {/* ── Transport Row (rectangular hit areas, all separate) ── */}
          <div className="deck-transport">
            {/* PLAY */}
            <button
              className="deck-btn deck-btn-play"
              onClick={play}
              disabled={isPlaying}
              title="Play"
            >
              <PlayIcon size={16} />
              <span className="deck-btn-label">PLAY</span>
            </button>

            {/* PAUSE */}
            <button
              className="deck-btn deck-btn-pause"
              onClick={pause}
              disabled={!isPlaying}
              title="Pause"
            >
              <PauseIcon size={16} />
              <span className="deck-btn-label">PAUSE</span>
            </button>

            {/* STOP — pause + reset playhead to 0, keeps project loaded */}
            <button
              className="deck-btn deck-btn-stop"
              onClick={stop}
              disabled={!isLoaded}
              title="Stop (reset to 0)"
            >
              <StopIcon size={14} />
              <span className="deck-btn-label">STOP</span>
            </button>

            {/* LOOP */}
            <button
              className={`deck-btn deck-btn-loop ${status.loop ? 'active' : ''}`}
              onClick={toggleLoop}
              title={status.loop ? 'Loop ON' : 'Loop OFF'}
            >
              <LoopIcon size={14} />
              <span className="deck-btn-label">LOOP</span>
            </button>

            {/* KILL — Local blackout (zero DMX), project stays loaded */}
            <button
              className="deck-btn deck-btn-kill"
              onClick={handleKill}
              title="KILL — Blackout (zero DMX, project stays loaded)"
            >
              <KillIcon size={14} />
              <span className="deck-btn-label">KILL</span>
            </button>
          </div>
        </div>
      ) : (
        /* ══════════ EMPTY STATE ══════════ */
        <div className="empty-state">
          <PlayCircleIcon size={28} className="empty-icon-svg" />
          <span className="empty-text">NO SCENE LOADED</span>
          <span className="empty-hint">Import .lux files from Chronos</span>
        </div>
      )}

      {/* ══════════ QUEUE / LOAD AREA (Bottom) ══════════ */}
      <div className="deck-queue">
        {/* Inactive scenes list */}
        {inactiveScenes.length > 0 && (
          <div className="scene-list">
            {inactiveScenes.map(scene => (
              <div
                key={scene.id}
                className="scene-item"
                onClick={() => handleSelectScene(scene)}
              >
                <div className="scene-item-icon">
                  <FileIcon size={12} />
                </div>
                <div className="scene-item-info">
                  <span className="scene-item-name">{scene.displayName}</span>
                  <span className="scene-item-meta">
                    {scene.project.tracks.flatMap(t => t.clips).length} CLIPS · {formatTime(scene.project.meta.durationMs)}
                  </span>
                </div>
                <button
                  className="scene-item-delete"
                  onClick={(e) => { e.stopPropagation(); handleDeleteScene(scene.id) }}
                  title="Remove scene"
                >
                  <TrashIcon size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* WAVE 7566.3: Compact Import Dropzone — only when no scene loaded
            (when a scene IS loaded, import is available via the queue list
            above; no redundant placeholder). Still allows drag-drop anywhere. */}
        {!selectedScene && (
          <div
            className={`import-zone-compact ${isDragging ? 'dragging' : ''}`}
            onClick={handleImportClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <ImportIcon size={14} className="import-icon" />
            <span className="import-text">IMPORT SCENE</span>

            <input
              ref={fileInputRef}
              type="file"
              accept=".lux,.json"
              multiple
              onChange={handleFileChange}
              className="import-input-hidden"
            />
          </div>
        )}

        {/* WAVE 7566.3: When scene IS loaded, show a minimal import hint
            at the bottom of the queue (not a full dropzone). Drag-drop still
            works on the whole queue area. */}
        {selectedScene && (
          <div
            className="import-zone-minimal"
            onClick={handleImportClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            title="Click or drop .lux file to add more scenes"
          >
            <ImportIcon size={12} />
            <span>+ ADD SCENE</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PURE HELPERS (outside component — no re-creation per render)
// ═══════════════════════════════════════════════════════════════════════════

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function getStateLabel(state: PlayerState): string {
  switch (state) {
    case 'idle': return 'NO SCENE'
    case 'loaded': return 'READY'
    case 'playing': return 'PLAYING'
    case 'paused': return 'PAUSED'
  }
}

/**
 * WAVE 2050.1 → 7566.2: Smart Title Parsing
 * Busca el nombre en múltiples rutas del JSON del proyecto.
 * Diferentes versiones de .lux pueden tener el nombre en distintos campos.
 *
 * WAVE 7566.2 FIX: Now also filters 'Untitled Show' (the default from
 * createEmptyLuxFileV3 / createEmptyChronosProjectV3) so it falls through
 * to the filename instead of showing the placeholder.
 */
function resolveProjectName(project: ChronosProjectV3, fileName: string): string {
  // Cast through unknown for safe property probing on variant JSON shapes
  const raw = project as unknown as Record<string, unknown>
  const meta = raw.meta as Record<string, unknown> | undefined
  const header = raw.header as Record<string, unknown> | undefined

  // Priority chain: meta.name > top-level name > header.name > meta.title > fileName sans extension
  const candidates = [
    meta?.name,
    raw.name,
    header?.name,
    meta?.title,
  ]

  // WAVE 7566.2: Also filter 'Untitled Show' (default placeholder)
  const PLACEHOLDER_NAMES = new Set([
    'Untitled Project',
    'Untitled',
    'Untitled Show',
    'New Project',
  ])

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() && !PLACEHOLDER_NAMES.has(c.trim())) {
      return c.trim()
    }
  }

  // Fallback: nombre del archivo sin extensión
  return fileName.replace(/\.(lux|json)$/i, '') || 'Untitled'
}

export default SceneBrowser
