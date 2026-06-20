/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-A: KEYFORGE — KEY MAP STORE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Persistent Zustand store for KeyForge bindings.
 *
 * State surface (per Directive 4800-Batch1):
 *   - `bindings`     : Record<storageKey, KeyBinding>     (storage key = `${layer}::${key}`)
 *   - `chords`       : ChordBinding[]                     (max ~50, O(N) match)
 *   - `currentLayer` : LayerId                            (derived at runtime from heldKeys)
 *   - `isLearning`   : boolean                            (forge mode toggle)
 *
 * Public actions:
 *   - `bindKey(binding)` / `unbindKey(layer, key)`
 *   - `bindChord(chord)` / `unbindChord(chordId)`
 *   - `setLayer(layer)`
 *   - `toggleLearnMode()` / `enterLearnMode()` / `exitLearnMode()`
 *   - `clearLayer(layer)` / `clearAll()`
 *   - `startListeningSlot()` / `cancelListening()`
 *
 * Persistence:
 *   - `bindings`, `chords` → localStorage (`luxsync-keyforge`).
 *   - Transient (`currentLayer`, `isLearning`, `listeningSlot`, `lastBound`)
 *     are excluded via `partialize`.
 *
 * Action ID compatibility:
 *   Bindings store strings that MUST resolve via `KeyActionDispatcher.resolveAction`
 *   (either `MidiActionRegistry` IDs or KeyForge-native prefixes). The store
 *   does NOT validate at bind time — validation is responsibility of the UI
 *   (Forge Overlay in Batch 2). This keeps the store fast and lets stale IDs
 *   survive a registry change for later remapping wizards.
 *
 * @module stores/keyMapStore
 * @version WAVE 4800-A
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type ChordBinding,
  type KeyBinding,
  type KeyCode,
  type KeyForgeLoadout,
  type ModifierState,
  type LayerId,
  bindingKey,
} from '../keyforge/types'

// ═══════════════════════════════════════════════════════════════════════════
// STORE SHAPE
// ═══════════════════════════════════════════════════════════════════════════

/** Reference to a slot currently waiting for a key to be assigned (Forge mode). */
export interface ListeningSlot {
  readonly layer: LayerId
  readonly key:   KeyCode | null  // null = "any next key will claim this slot"
}

export interface KeyMapState {
  // ── Persistent ──
  readonly bindings:     Readonly<Record<string /* `${layer}::${key}` */, KeyBinding>>
  readonly chords:       readonly ChordBinding[]
  /** Name of the currently active loadout profile (persisted). */
  readonly loadoutName:  string

  // ── Transient (NOT persisted) ──
  readonly currentLayer:   LayerId
  readonly isLearning:     boolean
  readonly isLearnModeActive: boolean
  readonly pendingMappingAction: string | null
  readonly listeningSlot:  ListeningSlot | null
  readonly lastBoundKey:   string | null   // storageKey — for UI flash feedback
  readonly lastMappingWarning: string | null
  /**
   * WAVE 4808: Master Arm toggle.
   *
   * When `false` (default on boot), KeyForge does NOT intercept keyboard
   * events at all — the cortex’s `onKeyDown` / `onKeyUp` are no-ops.
   * The operator must consciously flip this to `true` before a show.
   * This state is intentionally ephemeral: it resets to `false` on every
   * app restart so the system boots in the safe “off” state.
   */
  readonly isArmed: boolean

  // ── Actions: bindings CRUD ──
  bindKey:     (binding: KeyBinding) => void
  setMapping:  (keyCombo: string, actionId: string) => boolean
  unbindKey:   (layer: LayerId, key: KeyCode) => void
  getBinding:  (layer: LayerId, key: KeyCode) => KeyBinding | undefined
  clearLayer:  (layer: LayerId) => void
  clearAll:    () => void

  // ── Actions: chords CRUD ──
  bindChord:   (chord: ChordBinding) => void
  unbindChord: (chordId: string) => void

  // ── Actions: layer control ──
  setLayer:    (layer: LayerId) => void

  // ── Actions: learn mode ──
  toggleLearnMode:    () => void
  setLearnModeActive: (active: boolean) => void
  enterLearnMode:     () => void
  exitLearnMode:      () => void
  setPendingMappingAction: (actionId: string | null) => void
  startListeningSlot: (slot: ListeningSlot) => void
  cancelListening:    () => void
  clearLastBound:     () => void
  clearLastMappingWarning: () => void

  // ── Actions: master arm (WAVE 4808) ──
  /**
   * Flip the Master Arm on/off. When off, `useKeyboardCortex` drops all
   * keyboard events immediately — the teclado vuelve a ser un teclado normal.
   */
  toggleArmed: () => void

  // ── Actions: loadout I/O (WAVE 4805) ──
  /**
   * Snapshot the current bindings + chords into an immutable `KeyForgeLoadout`.
   * Pure renderer operation — does NOT trigger any IPC or file I/O.
   * Call `window.lux.keyforge.exportLoadout(loadout)` to persist to disk.
   */
  exportCurrentAsLoadout: (name: string) => KeyForgeLoadout
  /**
   * Hydrate the store from a `KeyForgeLoadout`.
   * Replaces ALL bindings and chords; updates `loadoutName`.
   * Pure renderer operation — localStorage persistence is automatic via Zustand.
   */
  importLoadout: (loadout: KeyForgeLoadout) => void
  /**
   * Wipe all bindings + chords, then re-apply the stadium-default loadout.
   * Convenience reset button for the UI.
   */
  resetToStadiumDefaults: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

const FLASH_FEEDBACK_MS = 1500

const MODIFIER_ORDER: ReadonlyArray<keyof Pick<ModifierState, 'shift' | 'ctrl' | 'alt' | 'meta'>> = [
  'shift',
  'ctrl',
  'alt',
  'meta',
]

function sameRequiredMods(
  left: Partial<ModifierState> | undefined,
  right: Partial<ModifierState> | undefined,
): boolean {
  const leftMods = left ?? {}
  const rightMods = right ?? {}

  return Boolean(leftMods.shift) === Boolean(rightMods.shift)
    && Boolean(leftMods.ctrl) === Boolean(rightMods.ctrl)
    && Boolean(leftMods.alt) === Boolean(rightMods.alt)
    && Boolean(leftMods.meta) === Boolean(rightMods.meta)
}

function formatKeyCombo(key: KeyCode, requiredMods?: Partial<ModifierState>): string {
  const parts: string[] = []

  for (const mod of MODIFIER_ORDER) {
    if (!requiredMods?.[mod]) continue
    if (mod === 'ctrl') {
      parts.push('Control')
      continue
    }
    parts.push(mod.charAt(0).toUpperCase() + mod.slice(1))
  }

  parts.push(key)
  return parts.join('+')
}

function parseKeyCombo(keyCombo: string): { key: KeyCode; requiredMods?: Partial<ModifierState> } | null {
  const tokens = keyCombo.split('+').map(token => token.trim()).filter(Boolean)
  if (tokens.length === 0) return null

  const requiredMods: Record<string, boolean> = {}
  let key: KeyCode | null = null

  for (const token of tokens) {
    const normalized = token.toLowerCase()
    if (normalized === 'shift') {
      requiredMods['shift'] = true
      continue
    }
    if (normalized === 'control' || normalized === 'ctrl') {
      requiredMods['ctrl'] = true
      continue
    }
    if (normalized === 'alt' || normalized === 'option') {
      requiredMods['alt'] = true
      continue
    }
    if (normalized === 'meta' || normalized === 'cmd' || normalized === 'win' || normalized === 'super') {
      requiredMods['meta'] = true
      continue
    }

    if (key !== null) return null
    key = token as KeyCode
  }

  if (key === null) return null
  return Object.keys(requiredMods).length > 0
    ? { key, requiredMods: requiredMods as Partial<ModifierState> }
    : { key }
}

export const useKeyMapStore = create<KeyMapState>()(
  persist(
    (set, get) => ({
      // ── Initial state ──
      bindings: {},
      chords: [],
      loadoutName: 'stadium-default',
      currentLayer: 'base',
      isLearning: false,
      isLearnModeActive: false,
      pendingMappingAction: null,
      listeningSlot: null,
      lastBoundKey: null,
      lastMappingWarning: null,
      isArmed: false,      // WAVE 4808: safe-off on every boot

      // ── Bindings CRUD ──
      bindKey: (binding) => {
        const storageKey = bindingKey(binding.layer, binding.key)
        const current = get().bindings[storageKey]
        if (current !== undefined && (
          current.actionId !== binding.actionId
          || !sameRequiredMods(current.requiredMods, binding.requiredMods)
        )) {
          const warning = `[KeyForge] Collision rejected: ${formatKeyCombo(binding.key, binding.requiredMods)} is already bound to ${current.actionId}`
          console.warn(warning)
          set({ lastMappingWarning: warning })
          return
        }

        const nextBindings: Record<string, KeyBinding> = { ...get().bindings }
        nextBindings[storageKey] = binding

        console.log(
          `[KeyForge] ✅ Bound ${binding.layer}::${binding.key} → ${binding.actionId} `
          + `(${binding.behavior.kind})`,
        )

        set({
          bindings: nextBindings,
          lastBoundKey: storageKey,
          // If we were listening on this slot, clear it.
          listeningSlot: get().listeningSlot?.layer === binding.layer
            && get().listeningSlot?.key === binding.key
            ? null
            : get().listeningSlot,
        })

        // Clear flash feedback after FLASH_FEEDBACK_MS
        if (typeof window !== 'undefined') {
          window.setTimeout(() => {
            if (get().lastBoundKey === storageKey) {
              set({ lastBoundKey: null })
            }
          }, FLASH_FEEDBACK_MS)
        }
      },

      setMapping: (keyCombo, actionId) => {
        const parsed = parseKeyCombo(keyCombo)
        if (parsed === null) {
          const warning = `[KeyForge] Invalid key combo: ${keyCombo}`
          console.warn(warning)
          set({ lastMappingWarning: warning })
          return false
        }

        const layer = get().currentLayer
        const storageKey = bindingKey(layer, parsed.key)
        const current = get().bindings[storageKey]

        // If slot is occupied by a DIFFERENT action, force-unbind it first.
        // setMapping is the UI remapping path — the user explicitly wants to overwrite.
        if (current !== undefined && (
          current.actionId !== actionId
          || !sameRequiredMods(current.requiredMods, parsed.requiredMods)
        )) {
          const nextBindings: Record<string, KeyBinding> = { ...get().bindings }
          delete nextBindings[storageKey]
          set({ bindings: nextBindings })
          console.log(
            `[KeyForge] ♻️ setMapping: freed ${layer}::${parsed.key} from ${current.actionId} → reassigning to ${actionId}`,
          )
        }

        get().bindKey({
          layer,
          key: parsed.key,
          actionId,
          behavior: { kind: 'tap' },
          ...(parsed.requiredMods !== undefined ? { requiredMods: parsed.requiredMods } : {}),
        })

        set({
          pendingMappingAction: null,
          listeningSlot: null,
          isLearnModeActive: false,
          isLearning: false,
          lastMappingWarning: null,
        })

        return true
      },

      unbindKey: (layer, key) => {
        const storageKey = bindingKey(layer, key)
        const nextBindings: Record<string, KeyBinding> = { ...get().bindings }
        if (storageKey in nextBindings) {
          delete nextBindings[storageKey]
          console.log(`[KeyForge] 🗑 Unbound ${layer}::${key}`)
          set({ bindings: nextBindings })
        }
      },

      getBinding: (layer, key) => {
        return get().bindings[bindingKey(layer, key)]
      },

      clearLayer: (layer) => {
        const prefix = `${layer}::`
        const nextBindings: Record<string, KeyBinding> = {}
        for (const [k, v] of Object.entries(get().bindings)) {
          if (!k.startsWith(prefix)) nextBindings[k] = v
        }
        console.log(`[KeyForge] 🧹 Cleared layer: ${layer}`)
        set({ bindings: nextBindings })
      },

      clearAll: () => {
        console.log('[KeyForge] 💥 Cleared ALL bindings + chords')
        set({
          bindings: {},
          chords: [],
          pendingMappingAction: null,
          listeningSlot: null,
          lastMappingWarning: null,
        })
      },

      // ── Chords CRUD ──
      bindChord: (chord) => {
        const next: ChordBinding[] = get().chords.filter(c => c.chordId !== chord.chordId)
        next.push(chord)
        console.log(
          `[KeyForge] 🥊 Bound chord [${chord.keys.join('+')}] @ ${chord.layer} → ${chord.actionId}`,
        )
        set({ chords: next })
      },

      unbindChord: (chordId) => {
        const next = get().chords.filter(c => c.chordId !== chordId)
        if (next.length !== get().chords.length) {
          console.log(`[KeyForge] 🗑 Unbound chord: ${chordId}`)
          set({ chords: next })
        }
      },

      // ── Layer ──
      setLayer: (layer) => {
        if (get().currentLayer === layer) return
        set({ currentLayer: layer })
      },

      // ── Learn mode ──
      toggleLearnMode: () => {
        const next = !get().isLearning
        console.log(`[KeyForge] ⌨ LEARN MODE: ${next ? 'ON' : 'OFF'}`)
        set({
          isLearning: next,
          isLearnModeActive: next,
          listeningSlot: next ? get().listeningSlot : null,
          pendingMappingAction: next ? get().pendingMappingAction : null,
        })
      },

      setLearnModeActive: (active) => {
        if (active) {
          set({
            isLearning: true,
            isLearnModeActive: true,
          })
          return
        }

        set({
          isLearning: false,
          isLearnModeActive: false,
          pendingMappingAction: null,
          listeningSlot: null,
        })
      },

      enterLearnMode: () => {
        if (get().isLearning) return
        console.log('[KeyForge] ⌨ LEARN MODE: ON')
        set({ isLearning: true, isLearnModeActive: true })
      },

      exitLearnMode: () => {
        if (!get().isLearning) return
        console.log('[KeyForge] ⌨ LEARN MODE: OFF')
        set({
          isLearning: false,
          isLearnModeActive: false,
          listeningSlot: null,
          pendingMappingAction: null,
        })
      },

      setPendingMappingAction: (actionId) => {
        set({ pendingMappingAction: actionId })
      },

      startListeningSlot: (slot) => {
        console.log(`[KeyForge] 👂 Listening on ${slot.layer}::${slot.key ?? '<any>'}`)
        set({ listeningSlot: slot })
      },

      cancelListening: () => {
        if (get().listeningSlot === null) return
        set({ listeningSlot: null })
      },

      clearLastBound: () => set({ lastBoundKey: null }),

      clearLastMappingWarning: () => set({ lastMappingWarning: null }),

      // ── Master Arm (WAVE 4808) ──
      toggleArmed: () => {
        const next = !get().isArmed
        set({ isArmed: next })
        console.log(`[KeyForge] 🔐 Master Arm → ${next ? '⚡ ARMED' : '🔒 SAFE'}`)
      },

      // ── Loadout I/O (WAVE 4805) ──
      exportCurrentAsLoadout: (name) => {
        const { bindings, chords } = get()
        const now = new Date().toISOString()
        const loadout: KeyForgeLoadout = {
          id:        crypto.randomUUID(),
          name,
          version:   1,
          createdAt: now,
          updatedAt: now,
          bindings:  { ...bindings },
          chords:    [...chords],
        }
        console.log(`[KeyForge] 📦 Loadout snapshot: "${name}" — ${Object.keys(bindings).length} bindings, ${chords.length} chords`)
        return loadout
      },

      importLoadout: (loadout) => {
        console.log(`[KeyForge] 📥 Importing loadout: "${loadout.name}" (v${loadout.version})`)
        set({
          bindings:    loadout.bindings,
          chords:      loadout.chords as ChordBinding[],
          loadoutName: loadout.name,
          // Reset transient learn state after a full loadout swap
          isLearning:          false,
          isLearnModeActive:   false,
          pendingMappingAction: null,
          listeningSlot:       null,
        })
        console.log(
          `[KeyForge] ✅ Loadout applied: ${Object.keys(loadout.bindings).length} bindings, ${loadout.chords.length} chords`,
        )
      },

      resetToStadiumDefaults: () => {
        console.log('[KeyForge] 🔄 Resetting to stadium-default loadout…')
        // Clear everything, then let initStadiumLoadoutIfEmpty run unconditionally.
        // We bypass the "skip if bindings present" guard by clearing first.
        set({ bindings: {}, chords: [], loadoutName: 'stadium-default' })
        // Deferred import to avoid circular dependency at module load time.
        import('../keyforge/stadiumLoadout').then(({ initStadiumLoadoutIfEmpty }) => {
          initStadiumLoadoutIfEmpty()
        }).catch((err) => {
          console.error('[KeyForge] ❌ Failed to reset to stadium defaults:', err)
        })
      },
    }),
    {
      name: 'luxsync-keyforge',
      version: 3,
      // Persist user-owned data + arm state (WAVE 4914: isArmed now persists so
      // the operator doesn't have to re-arm on every reboot).
      partialize: (state) => ({
        bindings:    state.bindings,
        chords:      state.chords,
        loadoutName: state.loadoutName,
        isArmed:     state.isArmed,
      }),
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = persistedState as Record<string, unknown>
        // v1 → v2: add loadoutName
        if (fromVersion <= 1) {
          s.loadoutName = s.loadoutName ?? 'stadium-default'
        }
        // v2 → v3: add isArmed (default true — operator experience, not safety risk;
        //          captureGuard already protects text inputs)
        if (fromVersion <= 2) {
          s.isArmed = s.isArmed ?? true
        }
        return s
      },
    },
  ),
)

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS — co-located stable references for `useShallow` consumers
// ═══════════════════════════════════════════════════════════════════════════

export const selectBindings     = (s: KeyMapState): Readonly<Record<string, KeyBinding>> => s.bindings
export const selectChords       = (s: KeyMapState): readonly ChordBinding[] => s.chords
export const selectCurrentLayer = (s: KeyMapState): LayerId => s.currentLayer
export const selectIsLearning   = (s: KeyMapState): boolean => s.isLearning
export const selectIsLearnModeActive = (s: KeyMapState): boolean => s.isLearnModeActive
export const selectPendingMappingAction = (s: KeyMapState): string | null => s.pendingMappingAction
export const selectListening    = (s: KeyMapState): ListeningSlot | null => s.listeningSlot
export const selectLastBound    = (s: KeyMapState): string | null => s.lastBoundKey
export const selectLastMappingWarning = (s: KeyMapState): string | null => s.lastMappingWarning
// ⌨ WAVE 4805: Loadout name (persisted profile label)
export const selectLoadoutName  = (s: KeyMapState): string => s.loadoutName
// ⌨ WAVE 4808: Master Arm — ephemeral session flag
export const selectIsArmed      = (s: KeyMapState): boolean => s.isArmed

export const selectKeyMapActions = (s: KeyMapState) => ({
  bindKey:            s.bindKey,
  setMapping:         s.setMapping,
  unbindKey:          s.unbindKey,
  bindChord:          s.bindChord,
  unbindChord:        s.unbindChord,
  setLayer:           s.setLayer,
  toggleLearnMode:    s.toggleLearnMode,
  setLearnModeActive: s.setLearnModeActive,
  enterLearnMode:     s.enterLearnMode,
  exitLearnMode:      s.exitLearnMode,
  setPendingMappingAction: s.setPendingMappingAction,
  startListeningSlot: s.startListeningSlot,
  cancelListening:    s.cancelListening,
  clearLayer:         s.clearLayer,
  clearAll:           s.clearAll,
  clearLastMappingWarning: s.clearLastMappingWarning,
  // ⌨ WAVE 4805: Loadout I/O
  exportCurrentAsLoadout: s.exportCurrentAsLoadout,
  importLoadout:          s.importLoadout,
  resetToStadiumDefaults: s.resetToStadiumDefaults,
})

// ═══════════════════════════════════════════════════════════════════════════
// LOOKUP UTILS (non-reactive — for runtime hook hot path)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Non-reactive binding lookup. Designed to be called from `useKeyboardCortex`
 * inside a `keydown` listener WITHOUT triggering re-renders.
 *
 * Usage: `getBindingSnapshot(layer, key)` instead of subscribing.
 */
export function getBindingSnapshot(layer: LayerId, key: KeyCode): KeyBinding | undefined {
  return useKeyMapStore.getState().bindings[bindingKey(layer, key)]
}

export function getChordsSnapshot(): readonly ChordBinding[] {
  return useKeyMapStore.getState().chords
}
