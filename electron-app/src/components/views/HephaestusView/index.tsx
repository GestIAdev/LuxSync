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
import { SafetyStrip } from './safety/SafetyStrip'
import { ForgeTab } from './tabs/ForgeTab'
import { LabTab } from './tabs/LabTab'
import { GenesisLabView } from './GenesisLab/GenesisLabView'
import type { TemporalActions, HephViewport } from './types/HephaestusShared'
import { useHephaestusEditorStore } from '../../../core/hephaestus/store/useHephaestusEditorStore'
import { useStageStore, selectFixtures } from '../../../stores/stageStore'
import { useNavigationStore } from '../../../stores/navigationStore'
import { useAudioStore } from '../../../stores/audioStore'
import { useHephLibrary } from './hooks/useHephLibrary'
import { useLiveCalibration } from './useLiveCalibration'
import { useHephPreview } from './useHephPreview'
import { HephLogoIcon, TargetIcon } from '../../icons/LuxIcons'
import type {
  HephAutomationClipV3,
  HephAutomationClip,
} from '../../../core/hephaestus/types'
import { serializeHephClip } from '../../../core/hephaestus/types'
import { evaluateGates } from './safety/gateEvaluators'
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
  const setDuration = useHephaestusEditorStore(state => state.setDuration)

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
  const [activeTab, setActiveTab] = useState<'sculpt' | 'lab' | 'genesis'>('sculpt')

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

  // ── WAVE 7120: Live Calibration Mode ──
  // Single source of truth: useHephPreview drives both the UI preview and calibration
  const preview = useHephPreview(clip, stageFixtures)
  const { isActive: isCalibrationActive, toggle: toggleCalibration } = useLiveCalibration(
    clip,
    stageFixtures,
    preview.previewDataRef,
    preview.isPlaying,
  )

  // ── Derived: param count for header display ──
  const paramCount = useMemo(() => clip?.tracks.length ?? 0, [clip])

  // ── WAVE 7123: Gate evaluation for save blocking ──
  const gateResults = useMemo(() => clip ? evaluateGates(clip) : [], [clip])
  const failingGates = useMemo(() => gateResults.filter(g => g.status === 'fail'), [gateResults])
  const hasGateFailures = failingGates.length > 0

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

  // Clear save message after timeout (6s for gate failures, 3s otherwise)
  useEffect(() => {
    if (saveMessage) {
      const isGateFailure = saveMessage.startsWith('🛡')
      const timer = setTimeout(() => setSaveMessage(null), isGateFailure ? 6000 : 3000)
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

    // WAVE 7123: Block save if any safety gate is failing
    if (hasGateFailures) {
      const messages = failingGates.map(g => `${g.id}: ${g.description}`).join(' · ')
      setSaveMessage(`🛡 ${failingGates.length} gate(s) failing — ${messages}`)
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
  }, [clip, refreshMetadata, hasGateFailures, failingGates])

  const handleSaveAs = useCallback(async () => {
    if (!window.luxsync?.hephaestus?.save) {
      console.warn('[Hephaestus] IPC not available, cannot save')
      setSaveMessage('⚠️ Save not available (demo mode)')
      return
    }

    // WAVE 7123: Block save-as if any safety gate is failing
    if (hasGateFailures) {
      const messages = failingGates.map(g => `${g.id}: ${g.description}`).join(' · ')
      setSaveMessage(`🛡 ${failingGates.length} gate(s) failing — ${messages}`)
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
  }, [clip, temporalActions, refreshMetadata, hasGateFailures, failingGates])

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

  // 🧬 WAVE 5000.V3: Genesis → Forge bridge — listen for preview requests
  useEffect(() => {
    const handleGenesisPreview = async (e: Event) => {
      const { organismId } = (e as CustomEvent).detail
      if (!organismId) return

      const genesisApi = (window as any).luxsync?.genesis
      if (!genesisApi?.materializeClip) {
        console.warn('[Hephaestus] genesis.materializeClip IPC not available')
        return
      }

      try {
        const result = await genesisApi.materializeClip(organismId)
        if (!result.success || !result.clip) {
          console.warn(`[Hephaestus] Materialization failed for ${organismId}:`, result.error)
          return
        }

        const clipV3 = result.clip as HephAutomationClipV3
        loadClip(clipV3)
        setActiveTab('sculpt')
        console.log(`[Hephaestus] 🧬 Loaded mutant "${clipV3.name}" into Forge canvas`)
      } catch (err) {
        console.error('[Hephaestus] Genesis preview error:', err)
      }
    }

    window.addEventListener('luxsync:genesis-preview-organism', handleGenesisPreview)
    return () => window.removeEventListener('luxsync:genesis-preview-organism', handleGenesisPreview)
  }, [loadClip])

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
        setDuration(newMs)
        setIsDirty(true)
      }
    }
    setIsEditingDuration(false)
  }, [editDurationValue, clip.durationMs, setDuration])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — 3-Tier DAW Shell
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="heph-view">
      {/* ══ TIER 1: GLOBAL I/O BAR ══ */}
      <header className="heph-global-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '40px', padding: '0 16px', background: 'transparent', borderBottom: '1px solid rgba(255, 107, 43, 0.1)', userSelect: 'none', position: 'relative', zIndex: 1000, overflow: 'hidden', minWidth: 0, flexShrink: 0 }}>

        {/* BLOQUE IZQUIERDO: Identity + Clip Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="heph-logo" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HephLogoIcon size={20} className="heph-header__icon" />
            <span style={{
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#ff8c42',
              textShadow: '0 0 10px rgba(255, 107, 43, 0.5), 0 0 20px rgba(255, 107, 43, 0.2)',
            }}>HEPHAESTUS</span>
          </div>
          <span style={{ color: 'rgba(255, 107, 43, 0.2)' }}>│</span>

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
            className={`heph-header__btn ${isDirty ? 'heph-header__btn--dirty' : ''} ${hasGateFailures ? 'heph-header__btn--gate-blocked' : ''}`} 
            onClick={handleSave}
            disabled={isSaving || hasGateFailures}
            title={hasGateFailures ? `Blocked: ${failingGates.map(g => g.id).join(', ')} gate(s) failing` : 'Save Clip'}
          >
            {isSaving ? '💾 SAVING...' : hasGateFailures ? '🛡 BLOCKED' : '💾 SAVE'}
          </button>
          <button 
            className={`heph-header__btn heph-header__btn--clone ${hasGateFailures ? 'heph-header__btn--gate-blocked' : ''}`} 
            onClick={handleSaveAs}
            disabled={isSaving || hasGateFailures}
            title={hasGateFailures ? `Blocked: ${failingGates.map(g => g.id).join(', ')} gate(s) failing` : 'Save As... (Clone with new ID)'}
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
          <span style={{ color: '#333' }}>│</span>
          <button
            className={`heph-header__btn heph-header__btn--toggle ${isCalibrationActive ? 'heph-header__btn--calib-active' : ''}`}
            onClick={toggleCalibration}
            title="Live Calibration Mode (L3++ — overrides all layers except Blackout)"
          >
            <TargetIcon size={16} color={isCalibrationActive ? '#fff' : 'currentColor'} />
            <span className="heph-header__btn-label">
              {isCalibrationActive ? 'CALIB ON' : 'CALIB'}
            </span>
          </button>
        </div>
      </header>

      {/* ══ TIER 2: SUB-NAV BAR (Tab Switcher) ══ */}
      <nav className="heph-subnav" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: '30px',
        padding: '0 16px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        flexShrink: 0,
        overflow: 'hidden',
        minWidth: 0,
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(255, 255, 255, 0.03)', padding: '2px', borderRadius: '4px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('sculpt')}
            className="heph-subnav__tab"
            style={{
              padding: '3px 14px',
              border: 'none',
              borderRadius: '3px',
              background: activeTab === 'sculpt' ? '#ff6600' : 'transparent',
              color: activeTab === 'sculpt' ? '#fff' : '#888',
              textShadow: activeTab === 'sculpt' ? '0 0 8px rgba(255,85,0,0.6)' : 'none',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              transition: 'all 0.15s ease',
            }}
          >
            ✏️ FORGE
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lab')}
            className="heph-subnav__tab"
            style={{
              padding: '3px 14px',
              border: 'none',
              borderRadius: '3px',
              background: activeTab === 'lab' ? '#ff6600' : 'transparent',
              color: activeTab === 'lab' ? '#fff' : '#888',
              textShadow: activeTab === 'lab' ? '0 0 8px rgba(255,85,0,0.6)' : 'none',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              transition: 'all 0.15s ease',
            }}
          >
            📐 LABORATORY
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('genesis')}
            className="heph-subnav__tab heph-subnav__tab--genesis"
            style={{
              padding: '3px 14px',
              border: 'none',
              borderRadius: '3px',
              background: activeTab === 'genesis' ? '#00cc66' : 'transparent',
              color: activeTab === 'genesis' ? '#fff' : '#888',
              textShadow: activeTab === 'genesis' ? '0 0 8px rgba(0,204,102,0.6)' : 'none',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              transition: 'all 0.15s ease',
            }}
          >
            🧬 GENESIS
          </button>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '9px', color: '#444', letterSpacing: '0.08em' }}>
          {activeTab === 'sculpt' && 'SCULPT MODE — Curve Editor & Parameter Lanes'}
          {activeTab === 'lab' && 'LABORATORY — Phase Rack & DNA Profiler'}
          {activeTab === 'genesis' && 'GENESIS — Genetic Laboratory & Evolution Engine'}
        </span>
      </nav>

      {/* ══ TIER 3: ACTIVE WORKSPACE HOST ══ */}
      <div className="heph-tier3-host" style={{ minHeight: 0, minWidth: 0, width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
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
            preview={preview}
          />
        )}

        {activeTab === 'genesis' && (
          <GenesisLabView />
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
