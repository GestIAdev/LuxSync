/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-C: KEYFORGE — KEY ACTION DISPATCHER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The BRIDGE between KeyForge intent and the existing action catalog.
 *
 * Two-stage contract:
 *   1. RESOLVE  — look up the `actionId` in `MidiActionRegistry` (single source
 *                 of truth for fireable actions). Returns `ResolvedAction`.
 *   2. DISPATCH — execute the resolved action via prefix-based routing,
 *                 mirroring the dispatch table already used by `useMidiLearn.ts`.
 *
 * Why a thin wrapper rather than calling `window.lux.*` directly?
 *   - It centralizes the prefix routing in ONE place.
 *   - It allows Batch 1 to ship WITHOUT refactoring `useMidiLearn.ts`
 *     (4800-C in the roadmap was flagged HIGH risk; that refactor will land
 *     when KeyForge is mounted in `AppCommander.tsx`).
 *   - It lets us add KeyForge-native prefixes (`sel-*`, `kin-*`, `kf-*`,
 *     `cue-*`, `ui-*`) without polluting the MIDI hook.
 *
 * IMPORTANT: this module ONLY emits side effects via the public `window.lux.*`
 * IPC surface. It does not import any store directly to keep the dependency
 * graph one-way (stores → dispatcher would be a cycle).
 *
 * @module keyforge/KeyActionDispatcher
 * @version WAVE 4800-C
 */

import {
  type MidiActionMeta,
  findAction,
  isKnownAction,
} from '../midi/MidiActionRegistry'
import { useSelectionStore } from '../stores/selectionStore'
import { useMovementStore } from '../stores/movementStore'
import { useSceneStore } from '../stores/sceneStore'
import { useNavigationStore } from '../stores/navigationStore'
import type { TabId } from '../stores/navigationStore'
import { useEffectsStore } from '../stores/effectsStore'
import { throttleFn } from '../utils/throttleIpc'
import { useStageStore } from '../stores/stageStore'
import { useControlStore } from '../stores/controlStore'
import { useAudioStore } from '../stores/audioStore'
import type { FixtureGroup } from '../core/stage/ShowFileV2'
import type {
  ActionPayload,
  ResolvedAction,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// LUX BRIDGE TYPING (loose — mirrors what exists in production)
// ═══════════════════════════════════════════════════════════════════════════
//
// `window.lux` is exposed by the Electron preload script. The full type lives
// in `vite-env.d.ts`. We re-declare a STRUCTURAL subset here for the calls
// this dispatcher needs — keeps this module type-safe without coupling to
// the global ambient declaration.

interface LuxBridgeAetherSubset {
  setBlackout?: (active: boolean) => Promise<{ success?: boolean; blackoutActive?: boolean }>
  setGrandMaster?: (value: number) => Promise<unknown>
  fireTungstenNuke?: (args: {
    target: string
    value?: number
    release?: boolean
  }) => Promise<unknown> | void
  // WAVE 5020: Selection Kill — inhibit selectivo por fixture
  setSelInhibit?: (fixtureIds: string[], active: boolean) => Promise<{ success?: boolean }>
}

interface LuxBridgeSubset {
  /** ⌨ WAVE 4802-D: scope added — optional array of fixture IDs to target. */
  forceStrike?: (args: { effect: string; intensity: number; scope?: string[] }) => Promise<unknown> | void
  setVibe?: (vibeId: string) => Promise<unknown> | void
  cancelAllEffects?: () => Promise<unknown> | void
  aether?: LuxBridgeAetherSubset
}

function getLuxBridge(): LuxBridgeSubset | null {
  const w = globalThis as unknown as { lux?: LuxBridgeSubset }
  return w.lux ?? null
}

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 7594: SILK THROTTLE — Category A live triggers
// ═══════════════════════════════════════════════════════════════════════════
// Leading-edge 25ms throttle. OS keyboard autorepeat fires 30+ keydown/sec;
// without this, each event floods the main process with IPC sends.
// The first tap executes immediately (zero-latency); excess within 25ms is dropped.

const throttledForceStrike = throttleFn(
  (effect: string, intensity: number, scope: string[] | undefined) => {
    getLuxBridge()?.forceStrike?.({ effect, intensity, scope })
  },
)

const throttledSetVibe = throttleFn(
  (vibeId: string) => {
    getLuxBridge()?.setVibe?.(vibeId)
  },
)

const throttledSetGrandMaster = throttleFn(
  (value: number) => {
    const bridge = getLuxBridge()?.aether
    // fire-and-forget — send returns void, no .catch needed
    bridge?.setGrandMaster?.(value)
  },
)

const throttledFireTungstenNuke = throttleFn(
  (target: string, release: boolean | undefined, value: number | undefined) => {
    getLuxBridge()?.aether?.fireTungstenNuke?.({ target, release, value })
  },
)

const throttledCancelAllEffects = throttleFn(
  () => {
    getLuxBridge()?.cancelAllEffects?.()
  },
)

const throttledSetSelInhibit = throttleFn(
  (fixtureIds: string[], active: boolean) => {
    getLuxBridge()?.aether?.setSelInhibit?.(fixtureIds, active)
  },
)

/**
 * Blackout toggle — optimistic update + fire-and-forget IPC.
 * WAVE 7594: The backend no longer returns { blackoutActive }.
 * We set the Zustand state BEFORE the send so the UI reflects the toggle
 * immediately. The ~7Hz selene:truth broadcast will confirm or correct.
 */
function fireBlackoutToggle(): void {
  const currentBlackout = useEffectsStore.getState().blackout
  const targetBlackout = !currentBlackout
  // Optimistic update — immediate visual feedback
  useEffectsStore.getState().setBlackout(targetBlackout)
  // Fire-and-forget — no .then(), no .catch()
  getLuxBridge()?.aether?.setBlackout?.(targetBlackout)
}

// ═══════════════════════════════════════════════════════════════════════════
// KEYFORGE-NATIVE PREFIXES
// ═══════════════════════════════════════════════════════════════════════════
//
// These prefixes are NOT in the MidiActionRegistry today. They are owned by
// KeyForge and may be wired to backend handlers in later batches. For Batch 1
// they log + no-op so the contract is observable in dev tools.

const KEYFORGE_NATIVE_PREFIXES: readonly string[] = [
  'sel-',   // selection ops (sel-group-1, sel-all, sel-invert…)
  'grp-',   // WAVE 5021: group-target ops (grp-1-blackout, grp-2-clear…)
  'kin-',   // kinetic ops (kin-pan-left, kin-tilt-up, kin-home…)
  'cue-',   // cue transport (cue-go, cue-prev, cue-next…)
  'ui-',    // UI ops (ui-toggle-live-hud, ui-cycle-tab…)
  'kf-',    // KeyForge meta (kf-toggle-learn, kf-save-loadout…)
] as const

function isKeyForgeNativeAction(actionId: string): boolean {
  for (const p of KEYFORGE_NATIVE_PREFIXES) {
    if (actionId.startsWith(p)) return true
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve an `actionId` against the unified catalog.
 *
 * Resolution order:
 *   1. MidiActionRegistry — fx-*, vibe-*, arb-*, tung-*, ctrl-*, flow-*, lux-*.
 *   2. KeyForge-native prefix — meta returned as `null` but `known = true`.
 *   3. Unknown → `known = false` (consumers should log + skip).
 */
export function resolveAction(actionId: string): ResolvedAction {
  const meta: MidiActionMeta | undefined = findAction(actionId)
  if (meta !== undefined) {
    return { actionId, meta, known: true }
  }
  if (isKeyForgeNativeAction(actionId)) {
    return { actionId, meta: null, known: true }
  }
  return { actionId, meta: null, known: false }
}

/** Convenience: is this actionId fireable at all (MIDI or KeyForge-native)? */
export function isFireable(actionId: string): boolean {
  return isKnownAction(actionId) || isKeyForgeNativeAction(actionId)
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCH
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// SEL-* HANDLER — Selection Store
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dispatch a `sel-*` action against `useSelectionStore`.
 *
 * Supported sub-actions:
 *   sel-group-N   → selectMultiple(groupN)   — requires stageStore groups (best-effort)
 *   sel-all       → selectMultiple(allIds)   — best-effort from stageStore snapshot
 *   sel-clear     → deselectAll()
 *   sel-invert    → invertSelection(allIds)
 *   sel-add-last  → no-op (requires pointer context; skipped)
 */
function dispatchSelAction(actionId: string): boolean {
  const selStore = useSelectionStore.getState()
  const sub = actionId.slice(4) // 'sel-group-1' → 'group-1'

  if (sub === 'clear') {
    selStore.deselectAll()
    return true
  }

  if (sub === 'all') {
    // Best-effort: pull all fixture IDs from stageStore if available.
    const allIds = getAllFixtureIds()
    selStore.selectMultiple(allIds, 'replace')
    return true
  }

  if (sub === 'invert') {
    const allIds = getAllFixtureIds()
    selStore.invertSelection(allIds)
    return true
  }

  // sel-group-N : numeric group index (1-based). The stageStore may have
  // fixture groups; we try to resolve them. If not available, log and skip.
  const groupMatch = sub.match(/^group-(\d+)$/)
  if (groupMatch) {
    const groupIds = getGroupFixtureIds(parseInt(groupMatch[1], 10))
    if (groupIds.length > 0) {
      selStore.selectMultiple(groupIds, 'replace')
    } else {
      console.log(`[KeyForge] sel-group-${groupMatch[1]}: group not found or empty.`)
    }
    return true
  }

  // sel-blackout : WAVE 5020 — Selection Kill contextual / panic global.
  // Si hay selección → inhibit 0.0 en esos fixtures (latch toggle).
  // Si NO hay selección → PANIC: blackout global (Safety Rule).
  if (sub === 'blackout') {
    const selectedIds = Array.from(selStore.selectedIds)
    if (selectedIds.length === 0) {
      // PANIC MODE — comportamiento idéntico a arb-blackout
      fireBlackoutToggle()
      console.log('[KeyForge] 🚨 sel-blackout PANIC — no selection, firing global blackout')
    } else {
      // SELECTION KILL — toggle latch sobre los fixtures seleccionados
      const action = selStore.toggleMute(selectedIds)
      const active = action === 'muted'
      throttledSetSelInhibit(selectedIds, active)
      console.log(`[KeyForge] 🔇 sel-blackout ${action.toUpperCase()} — ${selectedIds.length} fixture(s)`)
    }
    return true
  }

  // sel-assign-group-N : RTS-style group assignment.
  // Current selection → assigned to group N (create if not exists, replace if exists).
  // Ctrl+1..9 in the `cmd` layer triggers this.
  // WAVE 2526: Si el grupo existente es del sistema (isSystem: true), se convierte
  // a grupo de usuario (isSystem: false) para que ensureSystemGroups no lo
  // sobreescriba al recargar el show.
  const assignMatch = sub.match(/^assign-group-(\d+)$/)
  if (assignMatch) {
    const groupIndex = parseInt(assignMatch[1], 10)
    const selectedIds = Array.from(useSelectionStore.getState().selectedIds)
    if (selectedIds.length === 0) {
      console.log(`[KeyForge] sel-assign-group-${groupIndex}: nothing selected — ignored.`)
      return true
    }
    const stageState = useStageStore.getState()
    const groups = stageState.groups
    const byHotkey = groups.find(g => g.hotkey === String(groupIndex))
    const byIndex  = groups[groupIndex - 1]
    const existing = byHotkey ?? byIndex
    if (existing !== undefined) {
      // WAVE 2526: Si es grupo del sistema, convertirlo a usuario para persistir
      const updates: Partial<FixtureGroup> = { fixtureIds: selectedIds }
      if (existing.isSystem) {
        updates.isSystem = false
        updates.hotkey = String(groupIndex)
      }
      stageState.updateGroup(existing.id, updates)
      console.log(`[KeyForge] ✅ Group ${groupIndex} updated (${selectedIds.length} fixtures)${existing.isSystem ? ' [system→user]' : ''}`)
    } else {
      const created = stageState.createGroup(`Group ${groupIndex}`, selectedIds)
      stageState.updateGroup(created.id, { hotkey: String(groupIndex), order: groupIndex - 1 })
      console.log(`[KeyForge] ✅ Group ${groupIndex} created (${selectedIds.length} fixtures)`)
    }
    return true
  }

  console.warn(`[KeyForge] ⚠️ Unknown sel-* sub-action: ${actionId}`)
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// GRP-* HANDLER — Group Targeted Actions (WAVE 5021)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dispatch a `grp-*` action against a SAVED group WITHOUT modifying the
 * current visual selection.
 *
 * Supported sub-actions:
 *   grp-N-blackout → toggle inhibit on ALL fixtures in group N (latch)
 *
 * This is the KEY to the Freestyler-style macro workflow:
 *   1. Select fixtures → Ctrl+1 (sel-assign-group-1) to save
 *   2. Map 'A' → grp-1-blackout
 *   3. Map 'S' → grp-2-blackout
 *   4. Press A/S any time — group toggles independently of UI selection.
 */
function dispatchGrpAction(actionId: string): boolean {
  const match = actionId.match(/^grp-(\d+)-(.+)$/)
  if (!match) {
    console.warn(`[KeyForge] ⚠️ Unknown grp-* format: ${actionId}`)
    return false
  }
  const groupIndex = parseInt(match[1], 10)
  const sub = match[2]
  const fixtureIds = getGroupFixtureIds(groupIndex)

  if (fixtureIds.length === 0) {
    console.log(`[KeyForge] grp-${groupIndex}-${sub}: group empty or not found.`)
    return true
  }

  if (sub === 'blackout') {
    const selStore = useSelectionStore.getState()
    // Toggle latch: reutiliza la misma lógica de mutedFixtureIds
    const action = selStore.toggleMute(fixtureIds)
    const active = action === 'muted'

    const bridge = getLuxBridge()?.aether
    if (bridge?.setSelInhibit) {
      throttledSetSelInhibit(fixtureIds, active)
      console.log(`[KeyForge] 🔇 grp-${groupIndex}-blackout setSelInhibit OK (${fixtureIds.length} fixtures)`)
    } else {
      console.warn(`[KeyForge] ⚠️ setSelInhibit unavailable on lux bridge — blackout will not reach DMX`)
    }

    console.log(`[KeyForge] 🔇 grp-${groupIndex}-blackout ${action.toUpperCase()} — ${fixtureIds.length} fixture(s): [${fixtureIds.join(', ')}]`)
    return true
  }

  console.warn(`[KeyForge] ⚠️ Unknown grp-* sub-action: ${actionId}`)
  return false
}

/**
 * ⌨ WAVE 4802-D: Resolve fixture IDs for a 1-based group index.
 * Re-exported so `useKeyboardCortex` can populate `ActionPayload.scope`
 * for chords that declare `scopeGroupIndex`.
 */
export function resolveGroupScope(groupIndex: number): string[] {
  return getGroupFixtureIds(groupIndex)
}

/** Pull all fixture IDs directly from stageStore (authoritative source). */
function getAllFixtureIds(): string[] {
  return useStageStore.getState().fixtures.map(f => f.id)
}

/**
 * Get fixture IDs belonging to a 1-based group index.
 * Resolves against the live stageStore: tries explicit hotkey assignment
 * first, then falls back to positional index (groups[N-1]).
 */
function getGroupFixtureIds(groupIndex: number): string[] {
  const groups = useStageStore.getState().groups
  const byHotkey = groups.find(g => g.hotkey === String(groupIndex))
  if (byHotkey !== undefined) return byHotkey.fixtureIds
  return groups[groupIndex - 1]?.fixtureIds ?? []
}

// ═══════════════════════════════════════════════════════════════════════════
// CUE-* HANDLER — Scene Store (WAVE 4800 Batch 3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dispatch a `cue-*` action against `useSceneStore`.
 *
 * Supported sub-actions:
 *   cue-go / cue-next  → advance to the next scene (wraps around)
 *   cue-prev           → go to the previous scene (wraps around)
 *   cue-play           → load first scene if none active (resume intent)
 *   cue-pause          → cancel any active transition (freeze mid-fade)
 */
function dispatchCueAction(actionId: string): boolean {
  const sceneState = useSceneStore.getState()
  const { scenes, activeSceneId } = sceneState
  const sub = actionId.slice(4) // 'cue-go' → 'go'

  if (scenes.length === 0) {
    console.log('[KeyForge] 🎬 cue-*: no scenes loaded.')
    return true
  }

  const currentIdx = activeSceneId !== null
    ? scenes.findIndex(s => s.id === activeSceneId)
    : -1

  switch (sub) {
    case 'go':
    case 'next': {
      const nextIdx = currentIdx < scenes.length - 1 ? currentIdx + 1 : 0
      sceneState.loadScene(scenes[nextIdx].id)
      return true
    }
    case 'prev': {
      const prevIdx = currentIdx > 0 ? currentIdx - 1 : scenes.length - 1
      sceneState.loadScene(scenes[prevIdx].id)
      return true
    }
    case 'play': {
      if (activeSceneId === null) {
        sceneState.loadScene(scenes[0].id)
      }
      return true
    }
    case 'pause': {
      sceneState.cancelTransition()
      return true
    }
    default:
      console.warn(`[KeyForge] ⚠️ Unknown cue-* sub-action: ${actionId}`)
      return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI-* HANDLER — Navigation Store (WAVE 4800 Batch 3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dispatch a `ui-*` action against `useNavigationStore`.
 *
 * Toggle semantics: if already on the target tab → go back.
 *
 * Supported sub-actions:
 *   ui-toggle-forge     → toggle BUILD (constructor) programmer view
 *   ui-toggle-zen       → toggle LIVE performance stage
 *   ui-toggle-3d        → toggle CHRONOS timeline/automation view
 *   ui-toggle-live-hud  → alias for toggle-zen (go to LIVE)
 *   ui-toggle-keyforge  → KeyForge overlay (handled by captureGuard; no-op here)
 */
function dispatchUiAction(actionId: string): boolean {
  const navState = useNavigationStore.getState()
  const { activeTab, setActiveTab, goBack } = navState
  const sub = actionId.slice(3) // 'ui-toggle-forge' → 'toggle-forge'

  function toggleTab(targetTab: TabId): boolean {
    if (activeTab === targetTab) {
      goBack()
    } else {
      setActiveTab(targetTab)
    }
    return true
  }

  switch (sub) {
    case 'toggle-forge':     return toggleTab('constructor')
    case 'toggle-zen':       return toggleTab('live')
    case 'toggle-3d':        return toggleTab('chronos')
    case 'toggle-live-hud':  return toggleTab('live')
    case 'toggle-keyforge':  return true  // overlay is toggled upstream by captureGuard
    default:
      console.warn(`[KeyForge] ⚠️ Unknown ui-* sub-action: ${actionId}`)
      return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// KIN-* HANDLER — Movement Store
// ═══════════════════════════════════════════════════════════════════════════

/** Pan/Tilt nudge step in degrees (per key event). */
const KIN_STEP_DEG = 5
const KIN_STEP_FAST_DEG = 15  // used on `charge` actions or repeat

/**
 * Dispatch a `kin-*` action against `useMovementStore`.
 *
 * Supported sub-actions:
 *   kin-pan-left    → pan  −step
 *   kin-pan-right   → pan  +step
 *   kin-tilt-up     → tilt −step  (tilt-up = lower degrees in classic mode)
 *   kin-tilt-down   → tilt +step
 *   kin-home        → reset to defaults (pan=270, tilt=135)
 *   kin-speed-up    → patternSpeed +10
 *   kin-speed-down  → patternSpeed −10
 */
function dispatchKinAction(actionId: string, payload: ActionPayload): boolean {
  const mvStore = useMovementStore.getState()
  const sub = actionId.slice(4) // 'kin-pan-left' → 'pan-left'
  const step = payload.intensity >= 1.0 ? KIN_STEP_FAST_DEG : KIN_STEP_DEG

  switch (sub) {
    case 'pan-left':
      mvStore.setPanTilt(Math.max(0, mvStore.pan - step), mvStore.tilt)
      return true
    case 'pan-right':
      mvStore.setPanTilt(Math.min(540, mvStore.pan + step), mvStore.tilt)
      return true
    case 'tilt-up':
      mvStore.setPanTilt(mvStore.pan, Math.max(0, mvStore.tilt - step))
      return true
    case 'tilt-down':
      mvStore.setPanTilt(mvStore.pan, Math.min(270, mvStore.tilt + step))
      return true
    case 'home':
      if (payload.phase === 'release') return true
      mvStore.setPanTilt(270, 135)
      return true
    case 'speed-up':
      mvStore.setPatternSpeed(Math.min(100, mvStore.patternSpeed + 10))
      return true
    case 'speed-down':
      mvStore.setPatternSpeed(Math.max(0, mvStore.patternSpeed - 10))
      return true
    default:
      console.warn(`[KeyForge] ⚠️ Unknown kin-* sub-action: ${actionId}`)
      return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CTRL-* HANDLER — Control & Audio Stores (KEYSTONE POLISH K1)
// ═══════════════════════════════════════════════════════════════════════════

/** Intensity nudge step per repeat tick (0-1 range). */
const CTRL_INTENSITY_STEP = 0.05

/** Tempo nudge step per repeat tick (BPM). */
const CTRL_TEMPO_STEP = 1

/** Tap-tempo: max intervals kept for averaging. */
const TAP_TEMPO_MAX_INTERVALS = 4

/** Tap-tempo: timeout to reset tap history (ms). */
const TAP_TEMPO_RESET_MS = 2000

/** Module-level tap-tempo state (persists across dispatches). */
let _tapTimestamps: number[] = []
let _lastTapTime = 0

/**
 * Dispatch a `ctrl-*` action against controlStore / audioStore.
 *
 * Supported sub-actions:
 *   ctrl-intensity-up     → nudge globalIntensity +step
 *   ctrl-intensity-down   → nudge globalIntensity -step
 *   ctrl-tap-tempo        → tap tempo (averages intervals → audioStore.bpm)
 *   ctrl-tempo-nudge-up   → nudge audioStore.bpm +1
 *   ctrl-tempo-nudge-down → nudge audioStore.bpm -1
 *   ctrl-ai-toggle        → toggleAI()
 *   ctrl-output-toggle    → toggleOutput()
 *   ctrl-saturation       → setGlobalSaturation(intensity)
 */
function dispatchCtrlAction(actionId: string, payload: ActionPayload): boolean {
  const ctrlStore = useControlStore.getState()
  const sub = actionId.slice(5) // 'ctrl-intensity-up' → 'intensity-up'

  switch (sub) {
    case 'intensity-up': {
      if (payload.phase === 'release') return true
      const next = Math.min(1, ctrlStore.globalIntensity + CTRL_INTENSITY_STEP)
      ctrlStore.setGlobalIntensity(next)
      return true
    }
    case 'intensity-down': {
      if (payload.phase === 'release') return true
      const next = Math.max(0, ctrlStore.globalIntensity - CTRL_INTENSITY_STEP)
      ctrlStore.setGlobalIntensity(next)
      return true
    }
    case 'tap-tempo': {
      if (payload.phase === 'release') return true
      const now = performance.now()
      if (now - _lastTapTime > TAP_TEMPO_RESET_MS) {
        _tapTimestamps = []
      }
      _tapTimestamps.push(now)
      if (_tapTimestamps.length > TAP_TEMPO_MAX_INTERVALS + 1) {
        _tapTimestamps.shift()
      }
      _lastTapTime = now
      if (_tapTimestamps.length >= 2) {
        const intervals: number[] = []
        for (let i = 1; i < _tapTimestamps.length; i++) {
          intervals.push(_tapTimestamps[i] - _tapTimestamps[i - 1])
        }
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length
        if (avgMs > 0) {
          const bpm = Math.round(60000 / avgMs)
          const clamped = Math.max(40, Math.min(300, bpm))
          useAudioStore.getState().updateMetrics({ bpm: clamped, bpmConfidence: 0.8 })
        }
      }
      return true
    }
    case 'tempo-nudge-up': {
      if (payload.phase === 'release') return true
      const audioStore = useAudioStore.getState()
      const next = Math.min(300, (audioStore.bpm || 120) + CTRL_TEMPO_STEP)
      audioStore.updateMetrics({ bpm: next })
      return true
    }
    case 'tempo-nudge-down': {
      if (payload.phase === 'release') return true
      const audioStore = useAudioStore.getState()
      const next = Math.max(40, (audioStore.bpm || 120) - CTRL_TEMPO_STEP)
      audioStore.updateMetrics({ bpm: next })
      return true
    }
    case 'ai-toggle': {
      if (payload.phase === 'release') return true
      ctrlStore.toggleAI()
      return true
    }
    case 'output-toggle': {
      if (payload.phase === 'release') return true
      ctrlStore.toggleOutput()
      return true
    }
    case 'saturation': {
      if (payload.phase === 'release') return true
      ctrlStore.setGlobalSaturation(payload.intensity)
      return true
    }
    default:
      console.warn(`[KeyForge] ⚠️ Unknown ctrl-* sub-action: ${actionId}`)
      return false
  }
}

/**
 * Dispatch a `flow-*` action against controlStore flowParams.
 *
 * Supported sub-actions:
 *   flow-speed   → setFlowParams({ speed })
 *   flow-spread  → setFlowParams({ spread })
 */
function dispatchFlowAction(actionId: string, payload: ActionPayload): boolean {
  const ctrlStore = useControlStore.getState()
  const sub = actionId.slice(5) // 'flow-speed' → 'speed'

  switch (sub) {
    case 'speed': {
      if (payload.phase === 'release') return true
      ctrlStore.setFlowParams({ speed: Math.round(payload.intensity * 100) })
      return true
    }
    case 'spread': {
      if (payload.phase === 'release') return true
      ctrlStore.setFlowParams({ spread: Math.round(payload.intensity * 100) })
      return true
    }
    default:
      console.warn(`[KeyForge] ⚠️ Unknown flow-* sub-action: ${actionId}`)
      return false
  }
}

/**
 * Dispatch a `lux-*` action via the lux bridge.
 *
 * Supported sub-actions:
 *   lux-blackout → toggle blackout via IPC + effectsStore sync
 */
function dispatchLuxAction(actionId: string, payload: ActionPayload): boolean {
  const lux = getLuxBridge()
  const sub = actionId.slice(4) // 'lux-blackout' → 'blackout'

  switch (sub) {
    case 'blackout': {
      if (payload.phase === 'release') return true
      fireBlackoutToggle()
      return true
    }
    default:
      console.warn(`[KeyForge] ⚠️ Unknown lux-* sub-action: ${actionId}`)
      return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DISPATCH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dispatch a resolved action with a payload.
 *
 * The dispatcher is INERT for unknown actions (logs a warning and returns
 * `false`). It NEVER throws — keyboard input must remain robust against
 * stale loadouts.
 *
 * @returns true if the action was dispatched (or queued via IPC), false if
 *          unknown or filtered.
 */
export function dispatchAction(actionId: string, payload: ActionPayload): boolean {
  const resolved = resolveAction(actionId)
  if (!resolved.known) {
    console.warn(`[KeyForge] ⚠️ Unknown actionId: "${actionId}" — ignoring.`)
    return false
  }

  const lux = getLuxBridge()

  // ── fx-* → forceStrike (effect trigger) ──
  if (actionId.startsWith('fx-')) {
    if (payload.phase === 'release') return true  // only fire on press
    const effectId = actionId.slice(3)
    // ⌨ WAVE 4802-D: pass scope when present so the backend targets only those fixtures
    // 🛡️ WAVE 7594: throttled 25ms to prevent IPC flooding from keyboard autorepeat
    throttledForceStrike(effectId, payload.intensity, payload.scope)
    return true
  }

  // ── vibe-* → setVibe (profile change) ──
  if (actionId.startsWith('vibe-')) {
    if (payload.phase === 'release') return true
    const vibeId = actionId.slice(5)
    // 🛡️ WAVE 7594: throttled 25ms
    throttledSetVibe(vibeId)
    return true
  }

  // ── tung-* → Tungsten Golden Nuke (WAVE 4699.2 dialect) ──
  if (actionId.startsWith('tung-')) {
    const sub = actionId.slice(5)
    if (sub === 'spin') {
      // Spin is a fader-style action; intensity is bipolar 0..1
      // 🛡️ WAVE 7594: throttled 25ms
      throttledFireTungstenNuke('spin', undefined, payload.intensity)
      return true
    }
    const target = sub === 'nuke-all'  ? 'all'
                 : sub === 'nuke-gold' ? 'gold'
                 : sub
    // 🛡️ WAVE 7594: throttled 25ms
    if (payload.phase === 'release') {
      throttledFireTungstenNuke(target, true, undefined)
    } else {
      throttledFireTungstenNuke(target, undefined, payload.intensity)
    }
    return true
  }

  // ── arb-* → Arbiter overrides (blackout, grand master, kill effects) ──
  if (actionId.startsWith('arb-')) {
    if (payload.phase === 'release') return true
    const sub = actionId.slice(4)
    switch (sub) {
      case 'blackout': {
        // 🛡️ WAVE 7594: optimistic update + fire-and-forget (throttled via fireBlackoutToggle)
        fireBlackoutToggle()
        return true
      }
      case 'grand-master':
        // 🛡️ WAVE 7594: throttled 25ms — MIDI CC fader can fire 300+ events/sec
        throttledSetGrandMaster(payload.intensity)
        return true
      case 'kill-effects':
        // 🛡️ WAVE 7594: throttled 25ms
        throttledCancelAllEffects()
        return true
      default:
        console.warn(`[KeyForge] ⚠️ Unknown arb-* action: ${actionId}`)
        return false
    }
  }

  // ── ctrl-* → Control / Audio stores ──
  if (actionId.startsWith('ctrl-')) {
    return dispatchCtrlAction(actionId, payload)
  }

  // ── flow-* → Flow params (controlStore) ──
  if (actionId.startsWith('flow-')) {
    return dispatchFlowAction(actionId, payload)
  }

  // ── lux-* → Lux bridge passthrough ──
  if (actionId.startsWith('lux-')) {
    return dispatchLuxAction(actionId, payload)
  }

  // ── sel-* → Selection Store ──
  if (actionId.startsWith('sel-')) {
    if (payload.phase === 'release') return true
    return dispatchSelAction(actionId)
  }

  // ── grp-* → Group Targeted Actions (WAVE 5021) ──
  if (actionId.startsWith('grp-')) {
    if (payload.phase === 'release') return true
    return dispatchGrpAction(actionId)
  }

  // ── kin-* → Movement Store ──
  if (actionId.startsWith('kin-')) {
    return dispatchKinAction(actionId, payload)
  }

  // ── cue-* → Scene Store (Batch 3) ──
  if (actionId.startsWith('cue-')) {
    if (payload.phase === 'release') return true
    return dispatchCueAction(actionId)
  }

  // ── ui-* → Navigation Store (Batch 3) ──
  if (actionId.startsWith('ui-')) {
    if (payload.phase === 'release') return true
    return dispatchUiAction(actionId)
  }

  // ── kf-* → KeyForge meta (Batch 4) ──
  if (actionId.startsWith('kf-')) {
    if (payload.phase !== 'release') {
      console.log(
        `[KeyForge] 🖹 ${actionId} (phase=${payload.phase ?? 'press'}) — `
        + `kf-* meta wiring pending Batch 4.`,
      )
    }
    return true
  }

  // Unreachable — resolved.known guards us, but TS wants exhaustiveness.
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// CATALOG REFLECTION (re-export for symmetry with WAVE 2047 ergonomics)
// ═══════════════════════════════════════════════════════════════════════════

export { findAction, isKnownAction } from '../midi/MidiActionRegistry'
export {
  getAllActions,
  getSystemActions,
  getEffectsByZone,
  getVibeActions,
  getArbiterActions,
  getTungstenActions,
} from '../midi/MidiActionRegistry'
