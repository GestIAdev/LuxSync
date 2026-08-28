/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔧 CALIBRATION LAB - WAVE 1135
 * "El Laboratorio del Cirujano de Luz"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Vista profesional de calibración de hardware.
 * 
 * ARQUITECTURA DUAL-ZONE:
 * - Zone A (60%): Targeting Bay - Radar + Quick Position + Data
 * - Zone B (40%): Tool Rack - Fixture Rack + DMX Scanner + Offsets
 * - Zone C (Footer): Action Bar - Test buttons
 * 
 * INTEGRACIONES:
 * - Output Gate: La vista carga en SILENCIO — NO llama a powerOn() ni arma el sistema.
 *   Si el sistema está OFFLINE, la UI carga. Si está ONLINE, el Arbiter sigue corriendo.
 *   El modo calibración se activa vía enterCalibrationMode (priority 200 sobre el Gate).
 * - StageStore: Fuente de verdad para fixtures (no TruthStore)
 * 
 * CONTROLES WASD:
 * - W/↑: Tilt arriba     Q/E: Diagonal arriba
 * - S/↓: Tilt abajo      Z/C: Diagonal abajo
 * - A/←: Pan izquierda   Space: Centro
 * - D/→: Pan derecha     Tab: Siguiente fixture
 * - B: Blackout          F: Full ON
 * - 1-9: Selección rápida de fixtures
 * 
 * @module components/views/CalibrationView
 * @version 1135.0.0
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import { useKeyMapStore } from '../../../stores/keyMapStore'
import { useLibraryStore } from '../../../stores/libraryStore'
import { useCalibrationSession } from './useCalibrationSession'
import { TargetingPanel } from './TargetingPanel'
import { OffsetTrimPad } from '../erebus/calibration/OffsetTrimPad'
import type { FixtureV2 } from '../../../core/stage/ShowFileV2'
import './CalibrationView.css'

// Icons
import { 
  MovingHeadIcon, 
  ParCanIcon,
  TargetIcon,
  BlackoutIcon,
  FlashIcon
} from '../../icons/LuxIcons'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ChannelInfo {
  index: number
  name: string
  type: string
}

function clampDmx(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function buildHydratedChannelValues(
  channels: ChannelInfo[],
  state: {
    dimmer?: number | null
    color?: string | null
    pan?: number | null
    tilt?: number | null
    zoom?: number | null
    focus?: number | null
  } | null | undefined
): Record<number, number> {
  if (!state) return {}

  const hydrated: Record<number, number> = {}
  const rgb = state.color && /^#[0-9a-f]{6}$/i.test(state.color)
    ? {
        red: parseInt(state.color.slice(1, 3), 16),
        green: parseInt(state.color.slice(3, 5), 16),
        blue: parseInt(state.color.slice(5, 7), 16),
      }
    : null

  for (const channel of channels) {
    let value: number | null = null

    switch (channel.type) {
      case 'dimmer':
        value = state.dimmer != null ? clampDmx(state.dimmer * 2.55) : null
        break
      case 'red':
        value = rgb?.red ?? null
        break
      case 'green':
        value = rgb?.green ?? null
        break
      case 'blue':
        value = rgb?.blue ?? null
        break
      case 'pan':
        value = state.pan != null ? clampDmx((state.pan / 540) * 255) : null
        break
      case 'tilt':
        value = state.tilt != null ? clampDmx((state.tilt / 270) * 255) : null
        break
      case 'zoom':
        value = state.zoom != null ? clampDmx(state.zoom * 2.55) : null
        break
      case 'focus':
        value = state.focus != null ? clampDmx(state.focus * 2.55) : null
        break
    }

    if (value != null && value > 0) {
      hydrated[channel.index] = value
    }
  }

  return hydrated
}

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SAFE_PAN_MAX = 513   // 95% of 540° - protects motor from strain
const SAFE_TILT_MAX = 256  // 95% of 270° - protects motor from strain
const STEP_OPTIONS = [1, 5, 15, 45]
const TRIM_STEP_OPTIONS = [0.5, 1, 5]

// WAVE 7669: IK eligibility for spatial targeting + rack badges
const IK_ELIGIBLE_TYPES = ['moving-head', 'movinghead', 'scanner', 'spot', 'beam', 'wash-mover']

function isIKEligible(fixture: FixtureV2 | null | undefined): boolean {
  if (!fixture) return false
  const t = (fixture.type || '').toLowerCase()
  return IK_ELIGIBLE_TYPES.some(et => t.includes(et))
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const CalibrationView: React.FC = () => {
  // ═══════════════════════════════════════════════════════════════════════
  // STORE CONNECTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  // 🔥 WAVE 1135: Use stageStore as source of truth (not truthStore!)
  const stageFixtures = useStageStore(state => state.fixtures)
  const updateFixture = useStageStore(state => state.updateFixture)
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const selectFixture = useSelectionStore(state => state.select)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  
  // ═══════════════════════════════════════════════════════════════════════
  // LOCAL STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  const [pan, setPan] = useState(Math.round(SAFE_PAN_MAX / 2))
  const [tilt, setTilt] = useState(Math.round(SAFE_TILT_MAX / 2))
  const [step, setStep] = useState(5)  // Degrees per step
  const [trimStep, setTrimStep] = useState(1)  // WAVE 7669: Trim D-Pad step
  const [activeTest, setActiveTest] = useState<string | null>(null)
  
  // � WAVE 7669: Control mode arbitration (spatial vs mechanical)
  // Default 'mechanical' preserves today's behaviour. The Spatial Gate (F3)
  // suppresses pan_base/tilt_base injection once targetX exists on a node,
  // so we must release the spatial target before mechanical aim can work.
  const [controlMode, setControlMode] = useState<'spatial' | 'mechanical'>('mechanical')
  
  // �🏛️ WAVE 3000: Multi-channel concurrent state (all channels independent)
  const [channelValues, setChannelValues] = useState<Record<number, number>>({})
  
  // 🔥 WAVE 1135.2: Save feedback state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // WAVE 7669: DMX connection status for header pill
  const dmxConnected = useLibraryStore(s => s.dmxStatus.connected)

  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════
  
  // All fixtures from show (not just moving heads - show ALL for debugging)
  const allFixtures = useMemo(() => {
    return stageFixtures || []
  }, [stageFixtures])
  
  // Get selected fixture
  const activeFixtureId = selectedIds.size > 0 ? [...selectedIds][0] : null

  // ═══════════════════════════════════════════════════════════════════════
  // 🔄 WAVE 7668: CALIBRATION SESSION (Phase 2 state migration)
  // Replaces standalone panOffset/tiltOffset/panInvert/tiltInvert useStates
  // and the fragile OFFSET SYNC useEffect that clobbered in-progress edits.
  //
  // R1 FIX: getFixture is backed by a ref so its identity never changes.
  // The hook's fixture-load effect depends on [fixtureId, getFixture] —
  // with a stable getFixture, it re-runs ONLY on fixtureId change, never
  // on unrelated stageFixtures mutations.
  // ═══════════════════════════════════════════════════════════════════════
  const stageFixturesRef = useRef(stageFixtures)
  stageFixturesRef.current = stageFixtures

  const getFixture = useCallback((id: string) => {
    return stageFixturesRef.current?.find(f => f.id === id)
  }, [])

  const { session, liveCalibration, updateCalibration, apply, revert, reset } =
    useCalibrationSession(activeFixtureId, getFixture, updateFixture)

  useEffect(() => {
    if (!activeFixtureId) {
      console.warn('[CalibrationLab] ⚠️ No activeFixtureId selected (selectedIds empty)')
    }
  }, [activeFixtureId])

  // 🔥 WAVE 1219.3: Auto-select a fixture on entry
  // Calibration without selection is a dead end (no fixtureId → no IPC calibration mode → no DMX).
  // This is deterministic: we pick the first fixture in stageFixtures order.
  useEffect(() => {
    if (activeFixtureId) return
    if (!allFixtures || allFixtures.length === 0) return

    const first = allFixtures[0]
    if (!first?.id) return

    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) {
        console.log(`[CalibrationLab] 🎯 Auto-selecting fixture for calibration: ${first.id} (${first.name ?? 'unnamed'})`)
        selectFixture(first.id, 'replace')
      }
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [activeFixtureId, allFixtures, selectFixture])
  
  const activeFixture = useMemo(() => {
    if (!activeFixtureId) return null
    return allFixtures.find(f => f.id === activeFixtureId) || null
  }, [activeFixtureId, allFixtures])
  
  // Get channels for selected fixture
  const channels: ChannelInfo[] = useMemo(() => {
    if (!activeFixture?.channels) return []
    return activeFixture.channels.map((ch: any, idx: number) => ({
      index: ch.index ?? idx,
      name: ch.name || `CH ${idx + 1}`,
      type: ch.type || 'unknown'
    }))
  }, [activeFixture])

  useEffect(() => {
    if (!activeFixtureId) {
      setChannelValues({})
      setActiveTest(null)
      return
    }

    let cancelled = false

    const hydrateCalibrationState = async () => {
      try {
        const arbiter = (window as any).luxsync?.arbiter ?? (window as any).lux?.arbiter
        if (!arbiter?.getFixturesState) return

        const result = await arbiter.getFixturesState([activeFixtureId])
        if (cancelled) return

        const hydrated = result?.success
          ? buildHydratedChannelValues(channels, result.state)
          : {}

        setChannelValues(hydrated)
        setActiveTest(null)

        if (result?.success && result.state?.pan != null) {
          setPan(Math.max(0, Math.min(SAFE_PAN_MAX, Math.round(result.state.pan))))
        }

        if (result?.success && result.state?.tilt != null) {
          setTilt(Math.max(0, Math.min(SAFE_TILT_MAX, Math.round(result.state.tilt))))
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[CalibrationLab] Hydration error:', err)
          setChannelValues({})
          setActiveTest(null)
        }
      }
    }

    void hydrateCalibrationState()

    return () => {
      cancelled = true
    }
  }, [activeFixtureId, channels])
  
  const dmxBaseAddress = activeFixture?.address || 1
  const universe = activeFixture?.universe ?? 0

  // ═══════════════════════════════════════════════════════════════════════
  // 🧹 WAVE 5035: GLOBAL CLEANUP — deselect all fixtures when leaving CalibrationView
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      deselectAll()
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current)
        saveStatusTimerRef.current = null
      }
      console.log('[CalibrationLab] 🧹 View unmount — selection cleared, timers killed')
    }
  }, [deselectAll])

  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 377 + 1219: CALIBRATION MODE (COLD DMX PATH)
  // Even if OutputEnabled=false (ARMED), manualOverride enables per-fixture output.
  // We enter calibration mode automatically for the currently selected fixture.
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const electron = (window as any).electron
    if (!electron?.ipcRenderer?.invoke) {
      console.warn('[CalibrationLab] ⚠️ window.electron.ipcRenderer.invoke unavailable (preload bridge missing?)')
      return
    }

  if (!activeFixtureId) return

    let cancelled = false

    const enter = async () => {
      try {
        const res = await electron.ipcRenderer.invoke('lux:arbiter:enterCalibrationMode', {
          fixtureId: activeFixtureId,
        })
        if (cancelled) return
        if (!res?.success) {
          console.warn('[CalibrationLab] ⚠️ enterCalibrationMode returned:', res)
        } else {
          console.log(`[CalibrationLab] 🎯 Calibration mode ENTER for ${activeFixtureId}`)
        }
      } catch (err) {
        if (!cancelled) console.error('[CalibrationLab] enterCalibrationMode error:', err)
      }
    }

    void enter()

    return () => {
      cancelled = true
      try {
        // 🎯 WAVE 4949: Forzar limpieza del Arbiter al cerrar el panel.
        // Los overrides manuales del fixture activo deben borrarse para evitar
        // que colores de calibración persistan y sobreescriban la Vibe.
        void electron.ipcRenderer.invoke('lux:aether:clearManualOverrides', [
          `${activeFixtureId}:color`,
          `${activeFixtureId}:impact`,
          `${activeFixtureId}:kinetic`,
        ])
      } catch (e) {
        console.warn('[CalibrationLab] Failed to clear overrides on unmount', e)
      }
      try {
        void electron.ipcRenderer.invoke('lux:arbiter:exitCalibrationMode', {
          fixtureId: activeFixtureId,
        })
        console.log(`[CalibrationLab] 🧹 Calibration EXIT for ${activeFixtureId}`)
      } catch {
        // ignore cleanup errors
      }
    }
  }, [activeFixtureId])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔄 WAVE 7668: OFFSET SYNC eliminated — useCalibrationSession handles
  // fixture-load + snapshot on activeFixtureId change. The old useEffect
  // depended on [activeFixtureId, stageFixtures] which re-ran on ANY
  // stageFixtures mutation and clobbered in-progress offset edits.
  // ═══════════════════════════════════════════════════════════════════════
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: POSITION CONTROL
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Send position to fixture via Aether pipeline (WAVE 4680).
   * Valores normalizados 0-1; NodeArbiter aplica L2 KINETIC con inmunidad
   * al Smart Gate cuando outputEnabled=false (Move-in-Black).
   */
  const sendPosition = useCallback(async (newPan: number, newTilt: number) => {
    if (!activeFixtureId) return

    // Safety clamps
    const safePan = Math.max(0, Math.min(SAFE_PAN_MAX, newPan))
    const safeTilt = Math.max(0, Math.min(SAFE_TILT_MAX, newTilt))

    setPan(safePan)
    setTilt(safeTilt)

    // WAVE 4680: Normalizar 0-1 para pipeline Aether (igual que KineticsBridge)
    const panNorm  = Math.max(0, Math.min(1, safePan / SAFE_PAN_MAX))
    const tiltNorm = Math.max(0, Math.min(1, safeTilt / SAFE_TILT_MAX))

    console.log(`[CalibrationLab] 🎯 Pan: ${safePan}° (norm ${panNorm.toFixed(3)}) Tilt: ${safeTilt}° (norm ${tiltNorm.toFixed(3)})`)

    try {
      await window.lux?.aether?.setManualOverrides([
        {
          nodeId: `${activeFixtureId}:kinetic`,
          channels: { pan: panNorm, tilt: tiltNorm },
        },
      ])
    } catch (err) {
      console.error('[CalibrationLab] Position error:', err)
    }
  }, [activeFixtureId])
  
  /**
   * Radar mouse/touch handler
   */
  const handleRadarChange = useCallback((normalizedX: number, normalizedY: number) => {
    const newPan = Math.round(normalizedX * SAFE_PAN_MAX)
    const newTilt = Math.round(normalizedY * SAFE_TILT_MAX)
    sendPosition(newPan, newTilt)
  }, [sendPosition])
  
  /**
   * Quick position buttons (8 directions + center)
   */
  const handleQuickPosition = useCallback((direction: string) => {
    let newPan = pan
    let newTilt = tilt
    
    switch (direction) {
      case 'up':    newTilt -= step; break
      case 'down':  newTilt += step; break
      case 'left':  newPan -= step; break
      case 'right': newPan += step; break
      case 'up-left':    newPan -= step; newTilt -= step; break
      case 'up-right':   newPan += step; newTilt -= step; break
      case 'down-left':  newPan -= step; newTilt += step; break
      case 'down-right': newPan += step; newTilt += step; break
      case 'center':
        newPan = Math.round(SAFE_PAN_MAX / 2)
        newTilt = Math.round(SAFE_TILT_MAX / 2)
        break
    }
    
    sendPosition(newPan, newTilt)
  }, [pan, tilt, step, sendPosition])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: DMX MULTI-CHANNEL GRID
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Send DMX via Aether pipeline (WAVE 4680).
   * Valores normalizados 0-1; NodeArbiter L2 aplica el override con inmunidad
   * al Smart Gate cuando outputEnabled=false.
   */
  const sendDMX = useCallback(async (channelIndex: number, value: number) => {
    if (!activeFixtureId) return

    const channelInfo = channels[channelIndex]
    const channelType = channelInfo?.type || 'unknown'

    // Update local state (concurrent — only this channel changes)
    setChannelValues(prev => ({ ...prev, [channelIndex]: value }))

    // WAVE 4680: Normalizar 0-1 para pipeline Aether
    const normValue = Math.max(0, Math.min(1, value / 255))
    console.log(`[CalibrationLab] 🔬 CH${channelIndex + 1} (${channelType}) = ${value} (norm ${normValue.toFixed(3)})`)

    // Mapear channelType a familia Aether para el nodeId
    let family = 'beam'
    if (['pan', 'tilt', 'speed'].includes(channelType)) family = 'kinetic'
    else if (['dimmer', 'strobe', 'shutter'].includes(channelType)) family = 'impact'
    else if (['red', 'green', 'blue', 'white', 'amber', 'uv', 'color_wheel'].includes(channelType)) family = 'color'

    try {
      await window.lux?.aether?.setManualOverrides([
        {
          nodeId: `${activeFixtureId}:${family}`,
          channels: { [channelType]: normValue },
        },
      ])
    } catch (err) {
      console.error('[CalibrationLab] DMX send error:', err)
    }
  }, [activeFixtureId, channels])
  
  /**
   * Reset all channels to 0
   */
  const resetAllChannels = useCallback(() => {
    const zeroed: Record<number, number> = {}
    channels.forEach((_, idx) => {
      zeroed[idx] = 0
      sendDMX(idx, 0)
    })
    setChannelValues(zeroed)
  }, [channels, sendDMX])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: TEST ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleTest = useCallback(async (testType: string) => {
    if (!activeFixtureId) return
    
    // Toggle off if same test
    if (activeTest === testType) {
      setActiveTest(null)
      // Blackout
      const dimmerIdx = channels.findIndex(c => c.type === 'dimmer')
      if (dimmerIdx >= 0) sendDMX(dimmerIdx, 0)
      return
    }
    
    setActiveTest(testType)
    
    const dimmerIdx = channels.findIndex(c => c.type === 'dimmer')
    const strobeIdx = channels.findIndex(c => c.type === 'strobe')
    const goboIdx = channels.findIndex(c => c.type === 'gobo')
    const colorWheelIdx = channels.findIndex(c => c.type === 'color_wheel')
    
    switch (testType) {
      case 'full':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 255)
        if (strobeIdx >= 0) sendDMX(strobeIdx, 0)
        break
      case 'strobe':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 255)
        if (strobeIdx >= 0) sendDMX(strobeIdx, 195)
        break
      case 'gobo':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 255)
        if (goboIdx >= 0) sendDMX(goboIdx, 39)
        break
      case 'color':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 255)
        if (colorWheelIdx >= 0) sendDMX(colorWheelIdx, 64)
        break
      case 'blackout':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 0)
        if (strobeIdx >= 0) sendDMX(strobeIdx, 0)
        break
    }
  }, [activeFixtureId, activeTest, channels, sendDMX])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: FIXTURE SELECTION
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleFixtureSelect = useCallback((fixtureId: string) => {
    selectFixture(fixtureId, 'replace')
    setActiveTest(null)
    setChannelValues({})
  }, [selectFixture])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 💾 WAVE 1135.2: OFFSET PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Save calibration offsets to the show file (WAVE 7668: delegates to hook.apply)
   * Persists to stageStore → ShowFile (saved to disk) + pushes live calibration
   * to the resolver immediately (unthrottled).
   */
  const handleSaveOffsets = useCallback(async () => {
    if (!activeFixtureId) {
      setSaveStatus('error')
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }
    
    setSaveStatus('saving')
    
    try {
      apply()
      console.log(`[CalibrationLab] 💾 Saved calibration for fixture ${activeFixtureId}:`, liveCalibration)
      setSaveStatus('saved')
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('[CalibrationLab] Failed to save calibration:', err)
      setSaveStatus('error')
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }, [activeFixtureId, apply, liveCalibration])
  
  /**
   * Revert offsets to the last snapshot (WAVE 7668: net new capability)
   */
  const handleRevertOffsets = useCallback(() => {
    revert()
    setSaveStatus('idle')
  }, [revert])
  
  /**
   * Reset offsets to zero (WAVE 7668: delegates to hook.reset)
   */
  const handleResetOffsets = useCallback(() => {
    reset()
    setSaveStatus('idle')
  }, [reset])

  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 7669: MODE SWITCH — Anti-Whiplash Arbitration
  //
  // When switching from SPATIAL → MECHANICAL, we must:
  //   1. Hydrate local pan/tilt from the fixture's current IK position
  //      (so the radar/D-Pad reflect where the head physically is)
  //   2. THEN release the spatial target (clears targetX/Y/Z from the
  //      motor override, exiting IK mode via the Spatial Gate)
  //
  // Without step 1, the radar would show the last mechanical position
  // (possibly stale), and the first D-Pad press would jump the head.
  // Without step 2, the Spatial Gate keeps suppressing pan_base/tilt_base
  // and mechanical aim is a no-op.
  // ═══════════════════════════════════════════════════════════════════════
  const handleModeSwitch = useCallback(async (newMode: 'spatial' | 'mechanical') => {
    if (newMode === controlMode) return

    if (newMode === 'mechanical' && controlMode === 'spatial' && activeFixtureId) {
      // Step 1: Hydrate pan/tilt from current IK position
      try {
        const arbiter = (window as any).luxsync?.arbiter ?? (window as any).lux?.arbiter
        if (arbiter?.getFixturesState) {
          const result = await arbiter.getFixturesState([activeFixtureId])
          if (result?.success && result.state?.pan != null) {
            setPan(Math.max(0, Math.min(SAFE_PAN_MAX, Math.round(result.state.pan))))
          }
          if (result?.success && result.state?.tilt != null) {
            setTilt(Math.max(0, Math.min(SAFE_TILT_MAX, Math.round(result.state.tilt))))
          }
        }
      } catch (err) {
        console.warn('[CalibrationLab] Mode switch hydration failed:', err)
      }

      // Step 2: Release spatial target
      try {
        await window.lux?.aether?.releaseSpatialTarget({ fixtureIds: [activeFixtureId] })
        console.log(`[CalibrationLab] 🎯 Spatial target released for ${activeFixtureId}`)
      } catch (err) {
        console.warn('[CalibrationLab] releaseSpatialTarget failed:', err)
      }
    }

    setControlMode(newMode)
  }, [controlMode, activeFixtureId])

  // WAVE 7669: Trim D-Pad handler — nudges offset by trimStep
  const handleTrimNudge = useCallback((direction: string) => {
    const snap = 0.5
    const clampTrim = (v: number) => Math.max(-30, Math.min(30, Math.round(v / snap) * snap))
    const p = liveCalibration.panOffset
    const t = liveCalibration.tiltOffset
    switch (direction) {
      case 'up':         updateCalibration({ tiltOffset: clampTrim(t - trimStep) }); break
      case 'down':       updateCalibration({ tiltOffset: clampTrim(t + trimStep) }); break
      case 'left':       updateCalibration({ panOffset:  clampTrim(p - trimStep) }); break
      case 'right':      updateCalibration({ panOffset:  clampTrim(p + trimStep) }); break
      case 'up-left':    updateCalibration({ panOffset: clampTrim(p - trimStep), tiltOffset: clampTrim(t - trimStep) }); break
      case 'up-right':   updateCalibration({ panOffset: clampTrim(p + trimStep), tiltOffset: clampTrim(t - trimStep) }); break
      case 'down-left':  updateCalibration({ panOffset: clampTrim(p - trimStep), tiltOffset: clampTrim(t + trimStep) }); break
      case 'down-right': updateCalibration({ panOffset: clampTrim(p + trimStep), tiltOffset: clampTrim(t + trimStep) }); break
      case 'center':     updateCalibration({ panOffset: 0, tiltOffset: 0 }); break
    }
  }, [liveCalibration.panOffset, liveCalibration.tiltOffset, trimStep, updateCalibration])

  // WAVE 7669: OffsetTrimPad onChange bridge
  const handleTrimPadChange = useCallback((pan: number, tilt: number) => {
    updateCalibration({ panOffset: pan, tiltOffset: tilt })
  }, [updateCalibration])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎮 WAVE 1135: KEYBOARD SHORTCUTS (WASD + Arrow Keys)
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Defer ALL calibration keys to KeyForge when armed.
      // The operator may have mapped WASD, B, F, 1-9, etc. for show control.
      if (useKeyMapStore.getState().isArmed) return

      // WAVE 7669: WASD/arrows only drive mechanical aim in MECHANICAL mode.
      // In SPATIAL mode, pan/tilt are owned by the IK solver — sending
      // manual overrides would fight the Spatial Gate (F3).
      const isMechanical = controlMode === 'mechanical'

      switch (e.key.toLowerCase()) {
        // Movement (mechanical mode only)
        case 'w': case 'arrowup':    if (isMechanical) handleQuickPosition('up'); break
        case 's': case 'arrowdown':  if (isMechanical) handleQuickPosition('down'); break
        case 'a': case 'arrowleft':  if (isMechanical) handleQuickPosition('left'); break
        case 'd': case 'arrowright': if (isMechanical) handleQuickPosition('right'); break
        case 'q': if (isMechanical) handleQuickPosition('up-left'); break
        case 'e': if (isMechanical) handleQuickPosition('up-right'); break
        case 'z': if (isMechanical) handleQuickPosition('down-left'); break
        case 'c': if (isMechanical) handleQuickPosition('down-right'); break
        case ' ': if (isMechanical) { e.preventDefault(); handleQuickPosition('center'); } break
        
        // Tests
        case 'b': handleTest('blackout'); break
        case 'f': handleTest('full'); break
        
        // Fixture selection (1-9)
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9':
          const idx = parseInt(e.key) - 1
          if (allFixtures[idx]) {
            handleFixtureSelect(allFixtures[idx].id)
          }
          break
        
        // Tab navigation
        case 'tab':
          e.preventDefault()
          const currentIdx = allFixtures.findIndex(f => f.id === activeFixtureId)
          const nextIdx = e.shiftKey 
            ? (currentIdx - 1 + allFixtures.length) % allFixtures.length
            : (currentIdx + 1) % allFixtures.length
          if (allFixtures[nextIdx]) {
            handleFixtureSelect(allFixtures[nextIdx].id)
          }
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleQuickPosition, handleTest, handleFixtureSelect, allFixtures, activeFixtureId, controlMode])
  
  // ═══════════════════════════════════════════════════════════════════════
  // FIXTURE ICON HELPER
  // ═══════════════════════════════════════════════════════════════════════
  
  const getFixtureIcon = (type?: string) => {
    const t = (type || '').toLowerCase()
    if (t.includes('moving') || t.includes('spot') || t.includes('beam')) {
      return <MovingHeadIcon size={16} />
    }
    if (t.includes('par') || t.includes('wash')) {
      return <ParCanIcon size={16} />
    }
    return <ParCanIcon size={16} />
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  // Normalized position for radar cursor (0-1)
  const normalizedPan = pan / SAFE_PAN_MAX
  const normalizedTilt = tilt / SAFE_TILT_MAX
  
  return (
    <div className="calibration-lab">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="lab-header">
        <div className="header-title">
          <TargetIcon size={20} className="header-icon" />
          <h1>CALIBRATION LAB</h1>
        </div>
        
        <div className="header-status">
          <span className={`dmx-pill ${dmxConnected ? 'live' : 'offline'}`}>
            {dmxConnected ? '● DMX LIVE' : '○ DMX OFFLINE'}
          </span>
          {activeFixture ? (
            <>
              <span className="fixture-name">{activeFixture.name}</span>
              <span className="fixture-badge">DMX {dmxBaseAddress}</span>
              {session.isDirty && <span className="dirty-dot" title="Unsaved calibration changes">●</span>}
            </>
          ) : (
            <span className="no-selection">Select a fixture to calibrate</span>
          )}
        </div>
      </header>
      
      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - DUAL ZONE (WAVE 3000 LAYOUT)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="lab-content">
        
        {/* ─────────────────────────────────────────────────────────────────
            ZONE A: TARGETING + CONTROLS (Left ~42%)
            ───────────────────────────────────────────────────────────────── */}
        <div className="zone-targeting">
          
          {/* WAVE 7669: MODE SWITCH — Spatial vs Mechanical */}
          <div className="mode-switch">
            <button
              className={`mode-btn ${controlMode === 'spatial' ? 'active' : ''}`}
              onClick={() => handleModeSwitch('spatial')}
              disabled={!activeFixtureId}
            >
              🎯 SPATIAL
            </button>
            <button
              className={`mode-btn ${controlMode === 'mechanical' ? 'active' : ''}`}
              onClick={() => handleModeSwitch('mechanical')}
              disabled={!activeFixtureId}
            >
              ⊕ MECHANICAL
            </button>
          </div>

          {/* WAVE 7669: SPATIAL TARGETING MODULE (Phase 3b) */}
          {controlMode === 'spatial' && (
            <TargetingPanel
              fixtureId={activeFixtureId}
              fixture={activeFixture}
              allFixtures={allFixtures}
            />
          )}

          {/* TARGETING RADAR (mechanical mode only) */}
          {controlMode === 'mechanical' && (
          <div className="targeting-radar">
            <div className="radar-container">
              {/* Grid */}
              <div className="radar-grid">
                <div className="grid-ring ring-outer" />
                <div className="grid-ring ring-mid" />
                <div className="grid-ring ring-inner" />
                <div className="grid-cross-h" />
                <div className="grid-cross-v" />
                <div className="grid-diagonal-1" />
                <div className="grid-diagonal-2" />
              </div>
              
              {/* Interactive area */}
              <div 
                className="radar-interactive"
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const update = (clientX: number, clientY: number) => {
                    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
                    handleRadarChange(x, y)
                  }
                  update(e.clientX, e.clientY)
                  
                  const handleMove = (ev: MouseEvent) => update(ev.clientX, ev.clientY)
                  const handleUp = () => {
                    window.removeEventListener('mousemove', handleMove)
                    window.removeEventListener('mouseup', handleUp)
                  }
                  window.addEventListener('mousemove', handleMove)
                  window.addEventListener('mouseup', handleUp)
                }}
                onDoubleClick={() => handleQuickPosition('center')}
              >
                {/* Cursor */}
                <div 
                  className="radar-cursor"
                  style={{
                    left: `${normalizedPan * 100}%`,
                    top: `${normalizedTilt * 100}%`,
                  }}
                >
                  <div className="cursor-core" />
                  <div className="cursor-ring" />
                  <div className="cursor-brackets">
                    <span className="bracket tl">┌</span>
                    <span className="bracket tr">┐</span>
                    <span className="bracket bl">└</span>
                    <span className="bracket br">┘</span>
                  </div>
                </div>
              </div>
              
              {/* Labels */}
              <div className="radar-labels">
                <span className="label l-top">0°</span>
                <span className="label l-bottom">270°</span>
                <span className="label l-left">0°</span>
                <span className="label l-right">540°</span>
              </div>
            </div>
          </div>
          )}

          {/* QUICK POSITION (mechanical mode only) */}
          {controlMode === 'mechanical' && (
          <div className="quick-position">
            <div className="position-grid">
              <button className="pos-btn" onClick={() => handleQuickPosition('up-left')} title="Q">↖</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('up')} title="W / ↑">↑</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('up-right')} title="E">↗</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('left')} title="A / ←">←</button>
              <button className="pos-btn center" onClick={() => handleQuickPosition('center')} title="Space">⊙</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('right')} title="D / →">→</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('down-left')} title="Z">↙</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('down')} title="S / ↓">↓</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('down-right')} title="C">↘</button>
            </div>
            
            <div className="step-selector">
              <span className="step-label">STEP</span>
              <div className="step-options">
                {STEP_OPTIONS.map(s => (
                  <button 
                    key={s}
                    className={`step-btn ${step === s ? 'active' : ''}`}
                    onClick={() => setStep(s)}
                  >
                    {s}°
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          {/* POSITION DATA (mechanical mode only) */}
          {controlMode === 'mechanical' && (
          <div className="position-data">
            <div className="data-row">
              <span className="data-label">PAN</span>
              <div className="data-bar">
                <div className="bar-fill" style={{ width: `${normalizedPan * 100}%` }} />
                <div className="bar-safe" style={{ width: '95%' }} />
              </div>
              <span className="data-value">{pan}°</span>
              <span className="data-max">/ 540°</span>
            </div>
            <div className="data-row">
              <span className="data-label">TILT</span>
              <div className="data-bar">
                <div className="bar-fill" style={{ width: `${normalizedTilt * 100}%` }} />
                <div className="bar-safe" style={{ width: '95%' }} />
              </div>
              <span className="data-value">{tilt}°</span>
              <span className="data-max">/ 270°</span>
            </div>
          </div>
          )}

          {/* OFFSET CONFIG (always visible — offsets are mode-independent) */}
          {/* WAVE 7669: Upgraded with OffsetTrimPad + Trim D-Pad */}
          <div className="tool-panel offset-config">
            <div className="panel-header">
              <span className="panel-title">OFFSET CONFIG</span>
            </div>
            
            <div className="offset-content">
              <div className="offset-row">
                <label>Pan Offset</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={liveCalibration.panOffset}
                  onChange={(e) => updateCalibration({ panOffset: Number(e.target.value) })}
                  disabled={!activeFixtureId}
                />
                <span className="offset-value">{liveCalibration.panOffset > 0 ? '+' : ''}{liveCalibration.panOffset}°</span>
              </div>
              
              <div className="offset-row">
                <label>Tilt Offset</label>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  value={liveCalibration.tiltOffset}
                  onChange={(e) => updateCalibration({ tiltOffset: Number(e.target.value) })}
                  disabled={!activeFixtureId}
                />
                <span className="offset-value">{liveCalibration.tiltOffset > 0 ? '+' : ''}{liveCalibration.tiltOffset}°</span>
              </div>
              
              <div className="offset-toggles">
                <button 
                  className={`toggle-btn ${liveCalibration.panInvert ? 'active' : ''}`}
                  onClick={() => updateCalibration({ panInvert: !liveCalibration.panInvert })}
                  disabled={!activeFixtureId}
                >
                  Pan ↔
                </button>
                <button 
                  className={`toggle-btn ${liveCalibration.tiltInvert ? 'active' : ''}`}
                  onClick={() => updateCalibration({ tiltInvert: !liveCalibration.tiltInvert })}
                  disabled={!activeFixtureId}
                >
                  Tilt ↕
                </button>
              </div>
              
              {/* WAVE 7669/7671: OffsetTrimPad + Trim D-Pad — side-by-side row */}
              <div className="trim-controls-row">
                <OffsetTrimPad
                  panOffset={liveCalibration.panOffset}
                  tiltOffset={liveCalibration.tiltOffset}
                  onChange={handleTrimPadChange}
                />
                <div className="trim-dpad-section">
                  <div className="trim-dpad">
                    <button className="trim-dpad-btn" onClick={() => handleTrimNudge('up-left')} disabled={!activeFixtureId}>↖</button>
                    <button className="trim-dpad-btn" onClick={() => handleTrimNudge('up')} disabled={!activeFixtureId}>↑</button>
                    <button className="trim-dpad-btn" onClick={() => handleTrimNudge('up-right')} disabled={!activeFixtureId}>↗</button>
                    <button className="trim-dpad-btn" onClick={() => handleTrimNudge('left')} disabled={!activeFixtureId}>←</button>
                    <button className="trim-dpad-btn center" onClick={() => handleTrimNudge('center')} disabled={!activeFixtureId} title="Zero offsets">⊙</button>
                    <button className="trim-dpad-btn" onClick={() => handleTrimNudge('right')} disabled={!activeFixtureId}>→</button>
                    <button className="trim-dpad-btn" onClick={() => handleTrimNudge('down-left')} disabled={!activeFixtureId}>↙</button>
                    <button className="trim-dpad-btn" onClick={() => handleTrimNudge('down')} disabled={!activeFixtureId}>↓</button>
                    <button className="trim-dpad-btn" onClick={() => handleTrimNudge('down-right')} disabled={!activeFixtureId}>↘</button>
                  </div>
                  <div className="trim-step-selector">
                    <span className="trim-step-label">TRIM STEP</span>
                    <div className="trim-step-options">
                      {TRIM_STEP_OPTIONS.map(s => (
                        <button
                          key={s}
                          className={`trim-step-btn ${trimStep === s ? 'active' : ''}`}
                          onClick={() => setTrimStep(s)}
                        >
                          {s}°
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="offset-actions">
                <button 
                  className="action-btn"
                  onClick={handleResetOffsets}
                  disabled={!activeFixtureId}
                >
                  RESET
                </button>
                <button
                  className="action-btn revert"
                  onClick={handleRevertOffsets}
                  disabled={!activeFixtureId || !session.snapshot || !session.isDirty}
                  title="Revert to last saved state"
                >
                  REVERT
                </button>
                <button 
                  className={`action-btn primary ${saveStatus === 'saved' ? 'saved' : ''} ${saveStatus === 'error' ? 'error' : ''}`}
                  onClick={handleSaveOffsets}
                  disabled={!activeFixtureId || saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? '...' : 
                   saveStatus === 'saved' ? '✓ SAVED' : 
                   saveStatus === 'error' ? '✗ ERROR' : 
                   'SAVE'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* ─────────────────────────────────────────────────────────────────
            ZONE B: FIXTURE RACK + CHANNEL GRID (Right ~58%)
            ───────────────────────────────────────────────────────────────── */}
        <div className="zone-channels">

          {/* FIXTURE RACK (fila superior, max-height fijo) */}
          <div className="tool-panel fixture-rack">
            <div className="panel-header">
              <span className="panel-title">FIXTURE RACK</span>
              <span className="panel-badge">{allFixtures.length}</span>
            </div>
            <div className="fixture-list">
              {allFixtures.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-text">No fixtures in show</span>
                </div>
              ) : (
                allFixtures.map((fixture, idx) => {
                  const eligible = isIKEligible(fixture)
                  const placed = fixture.isPlaced === true
                  const ikBadge = eligible && placed ? '✓IK' : eligible && !placed ? '⚠NP' : null
                  return (
                  <button
                    key={fixture.id}
                    className={`fixture-item ${activeFixtureId === fixture.id ? 'selected' : ''}`}
                    onClick={() => handleFixtureSelect(fixture.id)}
                  >
                    <span className="fixture-index">{idx + 1}</span>
                    <span className="fixture-icon">{getFixtureIcon(fixture.type)}</span>
                    <span className="fixture-name">{fixture.name}</span>
                    <span className="fixture-dmx">CH {fixture.address}</span>
                    {ikBadge && <span className={`fixture-ik-badge ${ikBadge === '✓IK' ? 'ik-ok' : 'ik-np'}`}>{ikBadge}</span>}
                  </button>
                  )
                })
              )}
            </div>
          </div>

          {/* CHANNEL GRID (fila inferior, ocupa espacio restante) */}
          <div className="tool-panel channel-grid-panel">
            <div className="panel-header">
              <span className="panel-title">DMX CHANNEL GRID</span>
              {activeFixture && <span className="panel-badge">DMX {dmxBaseAddress} · {channels.length}CH</span>}
              <button 
                className="reset-all-btn"
                onClick={resetAllChannels}
                disabled={!activeFixtureId || channels.length === 0}
              >
                RESET ALL
              </button>
            </div>
            
            {channels.length === 0 ? (
              <div className="empty-state">
                {activeFixture ? (
                  <>
                    <span className="empty-text">Profile unresolved</span>
                    <span className="empty-hint">
                      This fixture's definition ({activeFixture.definitionPath || activeFixture.profileId || 'unknown'})
                      {' '}is missing from the library. Re-assign a profile in the Forge.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="empty-text">No channels</span>
                    <span className="empty-hint">Select a fixture with channel data</span>
                  </>
                )}
              </div>
            ) : (
              <div className="channel-grid">
                {channels.map((ch, idx) => {
                  const val = channelValues[idx] ?? 0
                  const pct = Math.round((val / 255) * 100)
                  return (
                    <div key={idx} className={`channel-card ${val > 0 ? 'active' : ''}`}>
                      <div className="channel-card-header">
                        <span className="channel-number">{idx + 1}</span>
                        <span className="channel-type">{ch.type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="channel-name">{ch.name}</div>
                      <div className="channel-slider-row">
                        <input
                          type="range"
                          className="channel-slider"
                          min="0"
                          max="255"
                          value={val}
                          onChange={(e) => sendDMX(idx, Number(e.target.value))}
                          disabled={!activeFixtureId}
                        />
                      </div>
                      <div className="channel-value-row">
                        <span className="channel-dmx-value">{val}</span>
                        <span className="channel-pct">{pct}%</span>
                      </div>
                      <div className="channel-fill-bar">
                        <div className="channel-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
          ACTION BAR (Footer)
          ═══════════════════════════════════════════════════════════════════ */}
      <footer className="lab-actions">
        <button 
          className={`action-btn blackout ${activeTest === 'blackout' ? 'active' : ''}`}
          onClick={() => handleTest('blackout')}
          title="B"
        >
          <BlackoutIcon size={18} />
          <span>BLACKOUT</span>
        </button>
        
        <button 
          className={`action-btn strobe ${activeTest === 'strobe' ? 'active' : ''}`}
          onClick={() => handleTest('strobe')}
        >
          <FlashIcon size={18} />
          <span>STROBE</span>
        </button>
        
        <button 
          className={`action-btn color ${activeTest === 'color' ? 'active' : ''}`}
          onClick={() => handleTest('color')}
        >
          <span className="color-dot" />
          <span>COLOR</span>
        </button>
        
        <button 
          className={`action-btn gobo ${activeTest === 'gobo' ? 'active' : ''}`}
          onClick={() => handleTest('gobo')}
        >
          <span className="gobo-icon">◐</span>
          <span>GOBO</span>
        </button>
        
        <button 
          className={`action-btn full ${activeTest === 'full' ? 'active' : ''}`}
          onClick={() => handleTest('full')}
          title="F"
        >
          <span className="full-icon">☀</span>
          <span>FULL ON</span>
        </button>
      </footer>
    </div>
  )
}

export default CalibrationView
