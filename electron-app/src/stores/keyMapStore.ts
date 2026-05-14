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
  readonly bindings: Readonly<Record<string /* `${layer}::${key}` */, KeyBinding>>
  readonly chords:   readonly ChordBinding[]

  // ── Transient (NOT persisted) ──
  readonly currentLayer:   LayerId
  readonly isLearning:     boolean
  readonly listeningSlot:  ListeningSlot | null
  readonly lastBoundKey:   string | null   // storageKey — for UI flash feedback

  // ── Actions: bindings CRUD ──
  bindKey:     (binding: KeyBinding) => void
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
  enterLearnMode:     () => void
  exitLearnMode:      () => void
  startListeningSlot: (slot: ListeningSlot) => void
  cancelListening:    () => void
  clearLastBound:     () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

const FLASH_FEEDBACK_MS = 1500

export const useKeyMapStore = create<KeyMapState>()(
  persist(
    (set, get) => ({
      // ── Initial state ──
      bindings: {},
      chords: [],
      currentLayer: 'base',
      isLearning: false,
      listeningSlot: null,
      lastBoundKey: null,

      // ── Bindings CRUD ──
      bindKey: (binding) => {
        const storageKey = bindingKey(binding.layer, binding.key)
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
        set({ bindings: {}, chords: [] })
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
          listeningSlot: next ? get().listeningSlot : null,
        })
      },

      enterLearnMode: () => {
        if (get().isLearning) return
        console.log('[KeyForge] ⌨ LEARN MODE: ON')
        set({ isLearning: true })
      },

      exitLearnMode: () => {
        if (!get().isLearning) return
        console.log('[KeyForge] ⌨ LEARN MODE: OFF')
        set({ isLearning: false, listeningSlot: null })
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
    }),
    {
      name: 'luxsync-keyforge',
      version: 1,
      // Persist ONLY user-owned data; transient runtime state is excluded.
      partialize: (state) => ({
        bindings: state.bindings,
        chords:   state.chords,
      }),
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
export const selectListening    = (s: KeyMapState): ListeningSlot | null => s.listeningSlot
export const selectLastBound    = (s: KeyMapState): string | null => s.lastBoundKey

export const selectKeyMapActions = (s: KeyMapState) => ({
  bindKey:            s.bindKey,
  unbindKey:          s.unbindKey,
  bindChord:          s.bindChord,
  unbindChord:        s.unbindChord,
  setLayer:           s.setLayer,
  toggleLearnMode:    s.toggleLearnMode,
  enterLearnMode:     s.enterLearnMode,
  exitLearnMode:      s.exitLearnMode,
  startListeningSlot: s.startListeningSlot,
  cancelListening:    s.cancelListening,
  clearLayer:         s.clearLayer,
  clearAll:           s.clearAll,
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
