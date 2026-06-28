/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS VIEW - WAVE 7012: THE GREAT GUTTING (DAW Shell)
 * 3-Tier DAW Layout: Tier 1 (I/O Bar) + Tier 2 (Tab Switcher) + Tier 3 (Forge/Lab)
 *
 * Shell retains: activeTab, isSaving, isDirty, showLibrary, showNewClipModal,
 *   library, clipCacheRef, liveBpm, I/O callbacks, editable header.
 * Tier 3 delegates to ForgeTab (sculpt) / LabTab (lab).
 *
 * @module views/HephaestusView
 * @version WAVE 7012
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { NewClipModal } from './NewClipModal'
import { ZoneSelector } from './ZoneSelector'
import { SafetyStrip } from './safety/SafetyStrip'
import { ForgeTab } from './tabs/ForgeTab'
import { LabTab } from './tabs/LabTab'
import type { TemporalActions, HephViewport } from './types/HephaestusShared'
import { useHephaestusEditorStore } from '../../../core/hephaestus/store/useHephaestusEditorStore'
import { useStageStore, selectFixtures } from '../../../stores/stageStore'
import { useNavigationStore } from '../../../stores/navigationStore'
import { useAudioStore } from '../../../stores/audioStore'
import { useHephLibrary } from './hooks/useHephLibrary'
import { HephLogoIcon } from '../../icons/LuxIcons'
import type {
  HephAutomationClipV3,
  HephAutomationClip,
  ZoneTarget
} from '../../../core/hephaestus/types'
import type { EffectZone } from '../../../core/effects/types'
import { serializeHephClip } from '../../../core/hephaestus/types'
import './HephaestusView.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const HephaestusView: React.FC = () => {
  // ── WAVE 7000: V3 Native Editor Store ──
  const clip = useHephaestusEditorStore(state => state.clip)
  const selectTrack = useHephaestusEditorStore(state => state.selectTrack)
  const undo = useHephaestusEditorStore(state => state.undo)
  const redo = useHephaestusEditorStore(state => state.redo)
  const undoStackLen = useHephaestusEditorStore(state => state._undoStack.length)
  const redoStackLen = useHephaestusEditorStore(state => state._redoStack.length)
  const viewport = useHephaestusEditorStore(state => state.viewport)
  const loadClip = useHephaestusEditorStore(state => state.loadClip)

  const setClip = useCallback((updater: (prev: HephAutomationClipV3) => HephAutomationClipV3) => {
    const { mutate, clip: currentClip } = useHephaestusEditorStore.getState()
    if (!currentClip) return
    mutate('Edit clip', (draft) => {
      return updater(draft as HephAutomationClipV3)
    })
  }, [])

  // TODO: Migrar a actions V3 — temporalActions shim: snapshot() is automatic in V3 via mutate()
  const temporalActions: TemporalActions = {
    snapshot: () => { /* no-op: V3 auto-snapshots via mutate() */ },
    undo,
    redo,
    resetWithClip: (newClip: HephAutomationClipV3) => loadClip(newClip),
    setViewport: (_vp: HephViewport) => { /* no-op: tabs use store.setViewport directly */ },
  }

  // ── Shell State (I/O only) ──
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showLibrary, setShowLibrary] = useState(true)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [showNewClipModal, setShowNewClipModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'sculpt' | 'lab'>('sculpt')

  // ── Editable Header State ──
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [isEditingDuration, setIsEditingDuration] = useState(false)
  const [editDurationValue, setEditDurationValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const durationInputRef = useRef<HTMLInputElement>(null)

  // ── Show File State ──
  const showFile = useStageStore(state => state.showFile)
  const stageFixtures = useStageStore(selectFixtures)
  const [isLoadingShow, setIsLoadingShow] = useState(false)

  // ── Derived: param count for header display ──
  const paramCount = useMemo(() => clip?.tracks.length ?? 0, [clip])

  // ── temporal shim for render section (undo/redo buttons) ──
  const temporal = {
    canUndo: undoStackLen > 0,
    canRedo: redoStackLen > 0,
    undoDepth: undoStackLen,
    redoDepth: redoStackLen,
    viewport,
  }

  /**
   * ⚒️ WAVE 7031: Library loading delegated to useHephLibrary singleton hook.
   * No more local clipCacheRef or loadLibrary.
   */
  const { refreshMetadata } = useHephLibrary()

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTS — Navigation Bridge + Library Load
  // ═══════════════════════════════════════════════════════════════════════

  // ⚒️ WAVE 2044: THE HANDOFF — Read navigation bridge from Chronos
  const targetHephClipId = useNavigationStore(state => state.targetHephClipId)
  const targetBpm = useNavigationStore(state => state.targetBpm)
  const clearTargetHephClip = useNavigationStore(state => state.clearTargetHephClip)

  // ⚒️ WAVE 2044.3: SYNAPSE REPAIR — BPM live injection
  const audioStoreBpm = useAudioStore(state => state.bpm)
  const [capturedBpm, setCapturedBpm] = useState<number | null>(null)
  const liveBpm = capturedBpm || audioStoreBpm || 120

  useEffect(() => {
    console.log(`[HephaestusView] 🔍 BPM changed → ${liveBpm} (capturedBpm: ${capturedBpm}, targetBpm: ${targetBpm})`)
  }, [liveBpm, capturedBpm, targetBpm])

  // Clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveMessage])

  // ═══════════════════════════════════════════════════════════════════════
  // FILE I/O — WAVE 2030.5 / WAVE 7031: Library via useHephLibrary
  // ═══════════════════════════════════════════════════════════════════════

  const handleSave = useCallback(async () => {
    if (!window.luxsync?.hephaestus?.save) {
      console.warn('[Hephaestus] IPC not available, cannot save')
      setSaveMessage('⚠️ Save not available (demo mode)')
      return
    }

    setIsSaving(true)
    try {
      const serialized = serializeHephClip(clip)
      const result = await window.luxsync.hephaestus.save(serialized)

      if (result.success) {
        console.log(`[Hephaestus] Saved clip to ${result.filePath}`)
        setSaveMessage('✅ Saved!')
        setIsDirty(false)
        await refreshMetadata()

        const serializedForEvent = serializeHephClip(clip)
        window.dispatchEvent(new CustomEvent('luxsync:heph-clip-saved', {
          detail: {
            clipId: clip.id,
            clip: serializedForEvent,
          },
        }))
        console.log(`[Hephaestus] ⚒️ HOT-RELOAD: Dispatched luxsync:heph-clip-saved → ${clip.id}`)
      } else {
        console.error('[Hephaestus] Save failed:', result.error)
        setSaveMessage(`❌ ${result.error}`)
      }
    } catch (error) {
      console.error('[Hephaestus] Save error:', error)
      setSaveMessage('❌ Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [clip, refreshMetadata])

  const handleSaveAs = useCallback(async () => {
    if (!window.luxsync?.hephaestus?.save) {
      console.warn('[Hephaestus] IPC not available, cannot save')
      setSaveMessage('⚠️ Save not available (demo mode)')
      return
    }

    setIsSaving(true)
    try {
      const clonedClip = structuredClone(clip)
      clonedClip.id = crypto.randomUUID()
      clonedClip.name = `${clip.name} (Copy)`

      const serialized = serializeHephClip(clonedClip)
      const result = await window.luxsync.hephaestus.save(serialized)

      if (result.success) {
        console.log(`[Hephaestus] Saved clone to ${result.filePath}`)
        setSaveMessage('✅ Copy saved!')
        temporalActions.resetWithClip(clonedClip)
        setIsDirty(false)
        await refreshMetadata()
      } else {
        setSaveMessage(`❌ ${result.error}`)
      }
    } catch (error) {
      console.error('[Hephaestus] Save As error:', error)
      setSaveMessage('❌ Clone failed')
    } finally {
      setIsSaving(false)
    }
  }, [clip, temporalActions, refreshMetadata])

  const handleLoad = useCallback(async (clipId: string) => {
    if (!window.luxsync?.hephaestus?.load) {
      console.warn('[Hephaestus] IPC not available, cannot load')
      return
    }

    try {
      const result = await window.luxsync.hephaestus.load(clipId)

      if (result.success && result.clip) {
        const v3Clip = result.clip as HephAutomationClipV3
        temporalActions.resetWithClip(v3Clip)
        setIsDirty(false)
        console.log(`[Hephaestus] Loaded clip: ${v3Clip.name}`)
      } else {
        console.error('[Hephaestus] Load failed:', result.error)
      }
    } catch (error) {
      console.error('[Hephaestus] Load error:', error)
    }
  }, [])

  // ⚒️ WAVE 2044: THE HANDOFF — Auto-load clip when arriving from Chronos
  useEffect(() => {
    if (!targetHephClipId) return

    console.log(`[Hephaestus] ⚒️ THE HANDOFF: Auto-loading clip from Chronos → ${targetHephClipId}`)

    if (targetBpm) {
      setCapturedBpm(targetBpm)
      console.log(`[Hephaestus] 🎵 BPM captured from THE HANDOFF → ${targetBpm}`)
    }

    clearTargetHephClip()
    handleLoad(targetHephClipId)
  }, [targetHephClipId, targetBpm, clearTargetHephClip, handleLoad])

  const handleDelete = useCallback(async (clipId: string) => {
    if (!window.luxsync?.hephaestus?.delete) {
      console.warn('[Hephaestus] IPC not available, cannot delete')
      return
    }

    if (!confirm('Delete this clip permanently?')) return

    try {
      const result = await window.luxsync.hephaestus.delete(clipId)
      if (result.success && result.deleted) {
        console.log(`[Hephaestus] Deleted clip: ${clipId}`)
        await refreshMetadata()
      }
    } catch (error) {
      console.error('[Hephaestus] Delete error:', error)
    }
  }, [refreshMetadata])

  const handleNew = useCallback(() => {
    setShowNewClipModal(true)
  }, [])

  // 🔥 WAVE 2213: Load Show desde Hephaestus
  const handleLoadShow = useCallback(async () => {
    setIsLoadingShow(true)
    try {
      const luxApi = (window as any).lux
      if (!luxApi?.stage?.openDialog) {
        console.error('[HephaestusView] window.lux.stage.openDialog not available')
        return
      }
      const result = await luxApi.stage.openDialog()
      if (result?.success) {
        console.log(`✅ [HephaestusView] Show loaded: ${result.filePath}`)
      } else if (!result?.cancelled) {
        console.error('[HephaestusView] Failed to load show')
      }
    } catch (err) {
      console.error('[HephaestusView] Error in load show dialog:', err)
    } finally {
      setIsLoadingShow(false)
    }
  }, [])

  // WAVE 2030.8: Create clip from modal and save immediately
  const handleCreateClip = useCallback(async (newClip: HephAutomationClip) => {
    temporalActions.resetWithClip(newClip)
    const intensityTrack = newClip.tracks.find(t => t.paramId === 'intensity')
    if (intensityTrack) selectTrack(intensityTrack.id)
    else if (newClip.tracks.length > 0) selectTrack(newClip.tracks[0].id)
    setIsDirty(true)

    if (window.luxsync?.hephaestus?.save) {
      try {
        const serialized = serializeHephClip(newClip)
        const result = await window.luxsync.hephaestus.save(serialized)
        if (result.success) {
          console.log(`[Hephaestus] Created & saved new clip: ${newClip.name}`)
          setSaveMessage('✅ Created!')
          setIsDirty(false)
          await refreshMetadata()
        }
      } catch (error) {
        console.error('[Hephaestus] Failed to save new clip:', error)
      }
    }
  }, [refreshMetadata])

  // WAVE 2030.13: Zone targeting handler
  const handleZonesChange = useCallback((zones: EffectZone[]) => {
    setClip(prev => ({
      ...prev,
      spatialZones: zones as readonly ZoneTarget[]
    }))
    setIsDirty(true)
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2030.26 — Editable Header (Name & Duration)
  // ═══════════════════════════════════════════════════════════════════════

  const startEditName = useCallback(() => {
    setEditNameValue(clip.name)
    setIsEditingName(true)
    requestAnimationFrame(() => nameInputRef.current?.select())
  }, [clip.name])

  const commitEditName = useCallback(() => {
    const trimmed = editNameValue.trim()
    if (trimmed.length > 0 && trimmed !== clip.name) {
      setClip(prev => ({ ...prev, name: trimmed }))
      setIsDirty(true)
    }
    setIsEditingName(false)
  }, [editNameValue, clip.name])

  const startEditDuration = useCallback(() => {
    setEditDurationValue(String(clip.durationMs / 1000))
    setIsEditingDuration(true)
    requestAnimationFrame(() => durationInputRef.current?.select())
  }, [clip.durationMs])

  const commitEditDuration = useCallback(() => {
    const parsed = parseFloat(editDurationValue)
    if (!isNaN(parsed) && parsed >= 0.1) {
      const newMs = Math.round(parsed * 1000)
      if (newMs !== clip.durationMs) {
        setClip(prev => ({ ...prev, durationMs: newMs }))
        setIsDirty(true)
      }
    }
    setIsEditingDuration(false)
  }, [editDurationValue, clip.durationMs])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — 3-Tier DAW Shell
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="heph-view">
      {/* ══ TIER 1: GLOBAL I/O BAR ══ */}
      <header className="heph-global-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '40px', padding: '0 16px', background: 'transparent', borderBottom: '1px solid rgba(255, 107, 43, 0.1)', userSelect: 'none', position: 'relative', zIndex: 1000 }}>

        {/* BLOQUE IZQUIERDO: Identity + Tab Rail */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="heph-logo" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HephLogoIcon size={20} className="heph-header__icon" />
            <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.05em', color: '#eee' }}>HEPHAESTUS</span>
          </div>
          <nav className="heph-tab-rail" style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', padding: '2px', borderRadius: '4px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('sculpt')}
              style={{
                padding: '4px 12px',
                border: 'none',
                borderRadius: '3px',
                background: activeTab === 'sculpt' ? '#ff6600' : 'transparent',
                color: activeTab === 'sculpt' ? '#fff' : '#888',
                textShadow: activeTab === 'sculpt' ? '0 0 8px rgba(255,85,0,0.6)' : 'none',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              ✏️ FORGE
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lab')}
              style={{
                padding: '4px 12px',
                border: 'none',
                borderRadius: '3px',
                background: activeTab === 'lab' ? '#ff6600' : 'transparent',
                color: activeTab === 'lab' ? '#fff' : '#888',
                textShadow: activeTab === 'lab' ? '0 0 8px rgba(255,85,0,0.6)' : 'none',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              📐 LABORATORY
            </button>
          </nav>
        </div>

        {/* BLOQUE CENTRAL: Active File Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#888', minWidth: 0, flex: '1 1 0' }}>
          {isEditingName ? (
            <input
              ref={nameInputRef}
              className="heph-header__edit-input heph-header__edit-input--name"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onBlur={commitEditName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEditName()
                if (e.key === 'Escape') setIsEditingName(false)
              }}
              spellCheck={false}
            />
          ) : (
            <span 
              className="heph-header__clip-name heph-header__clip-name--editable"
              onClick={startEditName}
              title="Click to edit name"
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '300px',
                display: 'inline-block',
                verticalAlign: 'middle',
              }}
            >
              {clip.name}
              {isDirty && <span className="heph-header__dirty">*</span>}
            </span>
          )}
          <span style={{ color: '#333' }}>│</span>
          {isEditingDuration ? (
            <span className="heph-header__edit-duration-wrap">
              <input
                ref={durationInputRef}
                className="heph-header__edit-input heph-header__edit-input--duration"
                value={editDurationValue}
                onChange={(e) => setEditDurationValue(e.target.value)}
                onBlur={commitEditDuration}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditDuration()
                  if (e.key === 'Escape') setIsEditingDuration(false)
                }}
                spellCheck={false}
              />
              <span className="heph-header__edit-unit">s</span>
            </span>
          ) : (
            <span 
              className="heph-header__duration heph-header__duration--editable"
              onClick={startEditDuration}
              title="Click to edit duration"
            >
              {(clip.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          <span style={{ color: '#333' }}>│</span>
          <span className="heph-header__param-count">{paramCount} PARAMS</span>
          <span style={{ color: '#333' }}>│</span>
          <ZoneSelector
            selectedZones={clip.spatialZones as unknown as EffectZone[]}
            onZonesChange={handleZonesChange}
            disabled={isSaving}
          />
          <span style={{ color: '#333' }}>│</span>
          <SafetyStrip
            clip={clip}
            onClipPatch={(patch) => {
              setClip(prev => ({ ...prev, ...patch } as HephAutomationClipV3))
              setIsDirty(true)
            }}
          />
          {saveMessage && (
            <>
              <span style={{ color: '#333' }}>│</span>
              <span className="heph-header__save-message">{saveMessage}</span>
            </>
          )}
        </div>

        {/* BLOQUE DERECHO: File System + Global State */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '8px' }}>
          <button
            className={`heph-header__btn heph-header__btn--temporal ${!temporal.canUndo ? 'heph-header__btn--disabled' : ''}`}
            onClick={temporalActions.undo}
            disabled={!temporal.canUndo}
            title={`Undo (Ctrl+Z)${temporal.canUndo ? ` — ${temporal.undoDepth} steps` : ''}`}
          >
            ↩
          </button>
          <button
            className={`heph-header__btn heph-header__btn--temporal ${!temporal.canRedo ? 'heph-header__btn--disabled' : ''}`}
            onClick={temporalActions.redo}
            disabled={!temporal.canRedo}
            title={`Redo (Ctrl+Shift+Z)${temporal.canRedo ? ` — ${temporal.redoDepth} steps` : ''}`}
          >
            ↪
          </button>

          <span style={{ color: '#333' }}>│</span>

          <div className="heph-header__load-show">
            <button
              className={`heph-header__btn heph-header__btn--load-show ${isLoadingShow ? 'heph-header__btn--disabled' : ''}`}
              onClick={handleLoadShow}
              disabled={isLoadingShow}
              title={showFile ? `Show: ${showFile.name} (${stageFixtures.length} fixtures)` : 'Load Show File (.luxshow)'}
            >
              {isLoadingShow ? '⏳' : '📂'}
              <span className="heph-header__btn-label">
                {isLoadingShow ? 'LOADING' : showFile ? `${stageFixtures.length}F` : 'LOAD'}
              </span>
            </button>
            {showFile && (
              <span className="heph-header__show-name" title={showFile.name}>
                {showFile.name}
              </span>
            )}
          </div>

          <button className="heph-header__btn" onClick={handleNew} title="New Clip">
            📄 NEW
          </button>
          <button 
            className={`heph-header__btn ${isDirty ? 'heph-header__btn--dirty' : ''}`} 
            onClick={handleSave}
            disabled={isSaving}
            title="Save Clip"
          >
            {isSaving ? '💾 SAVING...' : '💾 SAVE'}
          </button>
          <button 
            className="heph-header__btn heph-header__btn--clone" 
            onClick={handleSaveAs}
            disabled={isSaving}
            title="Save As... (Clone with new ID)"
          >
            📑 SAVE AS...
          </button>
          <button 
            className="heph-header__btn heph-header__btn--toggle" 
            onClick={() => setShowLibrary(!showLibrary)}
            title="Toggle Library"
          >
            📚
          </button>
        </div>
      </header>

      {/* ══ TIER 3: ACTIVE WORKSPACE HOST ══ */}
      <div className="heph-tier3-host" style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' }}>
        {activeTab === 'sculpt' && (
          <ForgeTab
            temporalActions={temporalActions}
            showAssetBrowser={showLibrary}
          />
        )}

        {activeTab === 'lab' && (
          <LabTab
            temporalActions={temporalActions}
            isSaving={isSaving}
          />
        )}
      </div>

      {/* ═══ NEW CLIP MODAL ═══ */}
      <NewClipModal
        isOpen={showNewClipModal}
        onClose={() => setShowNewClipModal(false)}
        onCreate={handleCreateClip}
      />
    </div>
  )
}

export default HephaestusView
