/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 WAVE 2047: MIDI MAP STORE - OPERATION "GHOST LIMBS"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Persistent store for MIDI-to-UI control mappings.
 * Survives app restart via zustand persist (localStorage).
 * 
 * ARCHITECTURE:
 * ┌──────────────────────────────────────────────────────┐
 * │  MidiMapStore (zustand + persist)                    │
 * │  ┌────────────────────────────────────────────────┐  │
 * │  │ mappings: Map<ControlId, MidiBinding>          │  │
 * │  │                                                │  │
 * │  │   'grand-master'  → { type:'cc', ch:0, cc:7 } │  │
 * │  │   'btn-blackout'  → { type:'note', ch:0, n:36}│  │
 * │  │   'intensity'     → { type:'cc', ch:0, cc:1 } │  │
 * │  │   'saturation'    → { type:'cc', ch:0, cc:2 } │  │
 * │  │   'flow-speed'    → { type:'cc', ch:0, cc:11} │  │
 * │  │   'fx-strobe'     → { type:'note', ch:0, n:48}│  │
 * │  └────────────────────────────────────────────────┘  │
 * │                                                      │
 * │  Methods:                                            │
 * │   setMapping(controlId, binding)                     │
 * │   removeMapping(controlId)                           │
 * │   clearAll()                                         │
 * │   getBinding(controlId)                              │
 * │   getControlForMessage(msg)  ← reverse lookup        │
 * └──────────────────────────────────────────────────────┘
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * All mappings are user-created via real MIDI input.
 * No default mappings. No guessing. No randomness.
 * 
 * @module stores/midiMapStore
 * @version WAVE 2047
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getAllActions, type MidiActionMeta } from '../midi/MidiActionRegistry'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A MIDI signal binding — identifies a specific control on a specific channel.
 * 
 * - type 'cc': Continuous Controller (faders, knobs)
 *   → channel + controller number
 * - type 'note': Note On/Off (pads, buttons)
 *   → channel + note number
 */
export interface MidiBinding {
  /** Message type: CC for continuous, Note for toggle */
  type: 'cc' | 'note'
  /** MIDI channel (0-15) */
  channel: number
  /** Controller number (0-127) for CC, or Note number (0-127) for Note */
  control: number
}

/**
 * Incoming MIDI message (parsed from raw bytes)
 */
export interface MidiMessage {
  /** Message type */
  type: 'cc' | 'note_on' | 'note_off'
  /** MIDI channel (0-15) */
  channel: number
  /** CC number or Note number */
  control: number
  /** Value (0-127) */
  value: number
}

/**
 * Mappable control IDs — every control in LuxSync that can be MIDI-mapped.
 * 
 * WAVE 3300: Widened from strict union to string.
 * Prefix routing in useMidiLearn.ts handles dispatch:
 * - ctrl-*: ControlStore (intensity, saturation, output, etc.)
 * - fx-*: Effects via forceStrike IPC (~50 real effects)
 * - lux-*: LuxSyncStore (blackout)
 * - flow-*: FlowParams (speed, spread)
 * - vibe-*: Vibe profiles via setVibe IPC
 * - arb-*: Arbiter overrides via arbiter IPC
 */
export type MappableControlId = string

/** Control metadata for UI display */
export interface MappableControlMeta {
  id: MappableControlId
  label: string
  category: 'fader' | 'button'
}

/**
 * Registry of all mappable controls.
 * WAVE 3300: Now sourced from MidiActionRegistry — ~60+ actions.
 * Re-exported as MappableControlMeta[] for backward compat.
 */
export const MAPPABLE_CONTROLS: MappableControlMeta[] = getAllActions().map(
  (a: MidiActionMeta) => ({ id: a.id, label: a.label, category: a.category })
)

/** @deprecated Use MidiActionRegistry directly for grouped/filtered access */
export { getAllActions, getEffectsByZone, getVibeActions, getArbiterActions, getSystemActions, getTungstenActions } from '../midi/MidiActionRegistry'

// ═══════════════════════════════════════════════════════════════════════════
// ZERO-ALLOCATION REVERSE INDEX & SOFT TAKEOVER (REV. 2 — TACTICAL HUB FIX)
// ═══════════════════════════════════════════════════════════════════════════
//
// PROBLEM (per TACTICAL_HUB_DUE_DILIGENCE §2.2, §2.3):
//   findControlForMessage() called Object.entries() on every MIDI tick,
//   allocating O(N) arrays + strings per message. softTakeoverState lived
//   in the Zustand store, triggering object spreads + subscriber notifications
//   on every accepted CC value.
//
// SOLUTION:
//   1. A module-level Map<string, MappableControlId> reverse index, rebuilt
//      ONLY when mappings change (setMapping/removeMapping/clearAll).
//      findControlForMessage is now O(1) with zero hot-path allocation.
//   2. softTakeoverState is evicted from Zustand entirely. It lives in a
//      module-level Map<string, number>, mutated in place. No React
//      subscriber notifications, no object spreads.
//
// Both structures are internal tracking data, not UI state. They do not
// need immutable updates or React reactivity.

/** Reverse index: bindingKey → controlId. Rebuilt on mapping change only. */
let _reverseIndex: Map<string, MappableControlId> = new Map()

/** Soft takeover tracking: bindingKey → last known physical value (0-127).
 *  REV. 2: Evicted from Zustand — module-level Map, mutated in place.
 *  No React subscriber notifications, no object spreads. */
export const softTakeoverState: Map<string, number> = new Map()

/** Rebuild the reverse index from the current mappings record. */
function _rebuildReverseIndex(mappings: Record<string, MidiBinding>): void {
  _reverseIndex = new Map()
  for (const controlId in mappings) {
    const b = mappings[controlId]
    _reverseIndex.set(bindingKeyFromBinding(b), controlId)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE STATE
// ═══════════════════════════════════════════════════════════════════════════

interface MidiMapState {
  /**
   * Active mappings: ControlId → MidiBinding
   * Serialized as array of [key, value] pairs for persist compatibility.
   */
  mappings: Record<string, MidiBinding>

  /** Whether MIDI Learn mode is active */
  learnMode: boolean

  /** Which control is currently listening for MIDI input (null = none) */
  listeningControl: MappableControlId | null

  /** Last successfully mapped control (for flash feedback) */
  lastMapped: MappableControlId | null

  // ── Actions ──

  /** Enter MIDI Learn mode */
  enterLearnMode: () => void

  /** Exit MIDI Learn mode */
  exitLearnMode: () => void

  /** Start listening on a specific control */
  startListening: (controlId: MappableControlId) => void

  /** Stop listening (cancel without mapping) */
  stopListening: () => void

  /** Set a mapping (called when MIDI input captured during learn) */
  setMapping: (controlId: MappableControlId, binding: MidiBinding) => void

  /** Remove a single mapping */
  removeMapping: (controlId: MappableControlId) => void

  /** Clear all mappings */
  clearAll: () => void

  /** Get binding for a control ID */
  getBinding: (controlId: MappableControlId) => MidiBinding | undefined

  /**
   * Reverse lookup: given a MIDI message, find which control it maps to.
   * Returns null if no mapping exists.
   *
   * REV. 2: O(1) Map lookup, zero allocation. The reverse index is rebuilt
   * only when mappings change (setMapping/removeMapping/clearAll).
   */
  findControlForMessage: (msg: MidiMessage) => MappableControlId | null

  /** Clear last mapped (after animation) */
  clearLastMapped: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Generate a unique key for a binding (for reverse lookup) */
function bindingKey(type: 'cc' | 'note', channel: number, control: number): string {
  return `${type}:${channel}:${control}`
}

/** Generate binding key from MidiBinding */
function bindingKeyFromBinding(b: MidiBinding): string {
  return bindingKey(b.type, b.channel, b.control)
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE CREATION
// ═══════════════════════════════════════════════════════════════════════════

export const useMidiMapStore = create<MidiMapState>()(
  persist(
    (set, get) => ({
      // ── State ──
      mappings: {},
      learnMode: false,
      listeningControl: null,
      lastMapped: null,

      // ── Learn Mode ──
      enterLearnMode: () => {
        console.log('[MidiMap] 🎹 LEARN MODE: ON')
        set({ learnMode: true, listeningControl: null })
      },

      exitLearnMode: () => {
        console.log('[MidiMap] 🎹 LEARN MODE: OFF')
        set({ learnMode: false, listeningControl: null })
      },

      startListening: (controlId) => {
        console.log(`[MidiMap] 👂 Listening for MIDI on: ${controlId}`)
        set({ listeningControl: controlId })
      },

      stopListening: () => {
        set({ listeningControl: null })
      },

      // ── Mapping CRUD ──
      setMapping: (controlId, binding) => {
        const state = get()
        const newMappings = { ...state.mappings }

        // Remove any existing mapping that uses the same MIDI signal
        // (one MIDI control → one UI control, no conflicts)
        const newKey = bindingKeyFromBinding(binding)
        for (const existingId in newMappings) {
          if (bindingKeyFromBinding(newMappings[existingId]) === newKey && existingId !== controlId) {
            console.log(`[MidiMap] ⚠️ Replacing mapping: ${existingId} → ${controlId} for ${newKey}`)
            delete newMappings[existingId]
          }
        }

        newMappings[controlId] = binding
        console.log(`[MidiMap] ✅ Mapped: ${controlId} → ${binding.type} ch${binding.channel} #${binding.control}`)

        // REV. 2: Rebuild reverse index (rare — user-driven MIDI Learn event)
        _rebuildReverseIndex(newMappings)

        set({
          mappings: newMappings,
          listeningControl: null,  // Stop listening after capture
          lastMapped: controlId,
        })

        // Clear flash feedback after 1.5s
        setTimeout(() => {
          if (get().lastMapped === controlId) {
            set({ lastMapped: null })
          }
        }, 1500)
      },

      removeMapping: (controlId) => {
        const newMappings = { ...get().mappings }
        delete newMappings[controlId]
        console.log(`[MidiMap] 🗑️ Removed mapping: ${controlId}`)

        // REV. 2: Rebuild reverse index
        _rebuildReverseIndex(newMappings)

        set({ mappings: newMappings })
      },

      clearAll: () => {
        console.log('[MidiMap] 🗑️ All mappings cleared')
        _reverseIndex = new Map()
        softTakeoverState.clear()
        set({ mappings: {} })
      },

      // ── Lookups ──
      getBinding: (controlId) => {
        return get().mappings[controlId]
      },

      findControlForMessage: (msg) => {
        // REV. 2: O(1) Map lookup — zero allocation on the hot path.
        // The reverse index is rebuilt only when mappings change.
        const type = msg.type === 'cc' ? 'cc' : 'note'
        const searchKey = bindingKey(type, msg.channel, msg.control)
        return _reverseIndex.get(searchKey) ?? null
      },

      clearLastMapped: () => set({ lastMapped: null }),
    }),
    {
      name: 'luxsync-midi-mappings',
      // Only persist mappings, not transient UI state
      partialize: (state) => ({
        mappings: state.mappings,
      }),
      // REV. 2: Rebuild reverse index when mappings are rehydrated from localStorage
      onRehydrateStorage: () => (state) => {
        if (state?.mappings) {
          _rebuildReverseIndex(state.mappings)
        }
      },
    }
  )
)

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

export const selectLearnMode = (state: MidiMapState) => state.learnMode
export const selectListeningControl = (state: MidiMapState) => state.listeningControl
export const selectLastMapped = (state: MidiMapState) => state.lastMapped
export const selectMappingCount = (state: MidiMapState) => Object.keys(state.mappings).length
export const selectAllMappings = (state: MidiMapState) => state.mappings

export const selectMidiMapActions = (state: MidiMapState) => ({
  enterLearnMode: state.enterLearnMode,
  exitLearnMode: state.exitLearnMode,
  startListening: state.startListening,
  stopListening: state.stopListening,
  setMapping: state.setMapping,
  removeMapping: state.removeMapping,
  clearAll: state.clearAll,
})
