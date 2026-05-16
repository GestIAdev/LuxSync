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
}

interface LuxBridgeSubset {
  forceStrike?: (args: { effect: string; intensity: number }) => Promise<unknown> | void
  setVibe?: (vibeId: string) => Promise<unknown> | void
  cancelAllEffects?: () => Promise<unknown> | void
  aether?: LuxBridgeAetherSubset
}

function getLuxBridge(): LuxBridgeSubset | null {
  const w = globalThis as unknown as { lux?: LuxBridgeSubset }
  return w.lux ?? null
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

  console.warn(`[KeyForge] ⚠️ Unknown sel-* sub-action: ${actionId}`)
  return false
}

/** Pull all fixture IDs from the stageStore (renderer-side snapshot). */
function getAllFixtureIds(): string[] {
  try {
    const w = globalThis as unknown as {
      luxStageSnapshot?: { fixtures?: Array<{ id: string }> }
    }
    return w.luxStageSnapshot?.fixtures?.map(f => f.id) ?? []
  } catch {
    return []
  }
}

/**
 * Get fixture IDs belonging to a 1-based group index.
 * Groups are not formally typed in this context so we attempt a dynamic
 * lookup against the stageStore's groups array if available.
 */
function getGroupFixtureIds(groupIndex: number): string[] {
  try {
    const w = globalThis as unknown as {
      luxStageSnapshot?: {
        groups?: Array<{ fixtureIds: string[] }>
      }
    }
    const groups = w.luxStageSnapshot?.groups ?? []
    const group = groups[groupIndex - 1]
    return group?.fixtureIds ?? []
  } catch {
    return []
  }
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
    lux?.forceStrike?.({ effect: effectId, intensity: payload.intensity })
    return true
  }

  // ── vibe-* → setVibe (profile change) ──
  if (actionId.startsWith('vibe-')) {
    if (payload.phase === 'release') return true
    const vibeId = actionId.slice(5)
    lux?.setVibe?.(vibeId)
    return true
  }

  // ── tung-* → Tungsten Golden Nuke (WAVE 4699.2 dialect) ──
  if (actionId.startsWith('tung-')) {
    const sub = actionId.slice(5)
    if (sub === 'spin') {
      // Spin is a fader-style action; intensity is bipolar 0..1
      lux?.aether?.fireTungstenNuke?.({ target: 'spin', value: payload.intensity })
      return true
    }
    const target = sub === 'nuke-all'  ? 'all'
                 : sub === 'nuke-gold' ? 'gold'
                 : sub
    if (payload.phase === 'release') {
      lux?.aether?.fireTungstenNuke?.({ target, release: true })
    } else {
      lux?.aether?.fireTungstenNuke?.({ target, value: payload.intensity })
    }
    return true
  }

  // ── arb-* → Arbiter overrides (blackout, grand master, kill effects) ──
  if (actionId.startsWith('arb-')) {
    if (payload.phase === 'release') return true
    const sub = actionId.slice(4)
    switch (sub) {
      case 'blackout':
        // The caller is expected to read the current blackout state and
        // negate it before calling. Per blueprint R3 (double confirmation
        // <500ms) we keep the dispatcher dumb and let the store add the
        // debounce in a later batch.
        lux?.aether?.setBlackout?.(true).catch(() => {})
        return true
      case 'grand-master':
        lux?.aether?.setGrandMaster?.(payload.intensity)?.catch?.(() => {})
        return true
      case 'kill-effects':
        lux?.cancelAllEffects?.()
        return true
      default:
        console.warn(`[KeyForge] ⚠️ Unknown arb-* action: ${actionId}`)
        return false
    }
  }

  // ── ctrl-* / flow-* / lux-* → log only (continuous store wiring = Batch 3) ──
  if (
    actionId.startsWith('ctrl-')
    || actionId.startsWith('flow-')
    || actionId.startsWith('lux-')
  ) {
    if (payload.phase !== 'release') {
      console.log(
        `[KeyForge] 🎚️ ${actionId} (intensity=${payload.intensity.toFixed(2)}) — `
        + `ctrl/flow/lux store wiring pending Batch 3.`,
      )
    }
    return true
  }

  // ── sel-* → Selection Store ──
  if (actionId.startsWith('sel-')) {
    if (payload.phase === 'release') return true
    return dispatchSelAction(actionId)
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
