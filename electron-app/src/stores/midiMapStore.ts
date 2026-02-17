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
 * Naming convention: category-name
 * - ctrl-*: ControlStore (intensity, saturation, output, etc.)
 * - fx-*: EffectsStore (strobe, blinder, smoke, etc.)
 * - lux-*: LuxSyncStore (blackout)
 * - flow-*: FlowParams (speed, spread)
 */
export type MappableControlId =
  // ControlStore — continuous (faders/knobs)
  | 'ctrl-intensity'
  | 'ctrl-saturation'
  // ControlStore — toggle (buttons/pads)
  | 'ctrl-output-toggle'
  | 'ctrl-ai-toggle'
  // LuxSyncStore
  | 'lux-blackout'
  // EffectsStore — toggle (pads)
  | 'fx-strobe'
  | 'fx-blinder'
  | 'fx-smoke'
  | 'fx-laser'
  | 'fx-rainbow'
  | 'fx-police'
  | 'fx-beam'
  | 'fx-prism'
  // FlowParams — continuous
  | 'flow-speed'
  | 'flow-spread'

/** Control metadata for UI display */
export interface MappableControlMeta {
  id: MappableControlId
  label: string
  category: 'fader' | 'button'
  /** Which store this maps to */
  store: 'control' | 'luxsync' | 'effects' | 'flow'
}

/** Registry of all mappable controls */
export const MAPPABLE_CONTROLS: MappableControlMeta[] = [
  // Faders (CC → 0-127 → 0.0-1.0)
  { id: 'ctrl-intensity',      label: 'Grand Master',      category: 'fader',  store: 'control' },
  { id: 'ctrl-saturation',     label: 'Saturation',        category: 'fader',  store: 'control' },
  { id: 'flow-speed',          label: 'Flow Speed',        category: 'fader',  store: 'flow' },
  { id: 'flow-spread',         label: 'Flow Spread',       category: 'fader',  store: 'flow' },
  // Buttons (Note → On/Off toggle)
  { id: 'ctrl-output-toggle',  label: 'Output ON/OFF',     category: 'button', store: 'control' },
  { id: 'ctrl-ai-toggle',      label: 'AI ON/OFF',         category: 'button', store: 'control' },
  { id: 'lux-blackout',        label: 'BLACKOUT',          category: 'button', store: 'luxsync' },
  { id: 'fx-strobe',           label: 'FX: Strobe',        category: 'button', store: 'effects' },
  { id: 'fx-blinder',          label: 'FX: Blinder',       category: 'button', store: 'effects' },
  { id: 'fx-smoke',            label: 'FX: Smoke',         category: 'button', store: 'effects' },
  { id: 'fx-laser',            label: 'FX: Laser',         category: 'button', store: 'effects' },
  { id: 'fx-rainbow',          label: 'FX: Rainbow',       category: 'button', store: 'effects' },
  { id: 'fx-police',           label: 'FX: Police',        category: 'button', store: 'effects' },
  { id: 'fx-beam',             label: 'FX: Beam',          category: 'button', store: 'effects' },
  { id: 'fx-prism',            label: 'FX: Prism',         category: 'button', store: 'effects' },
]

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

  /** Soft Takeover tracking: last known physical value per binding key */
  softTakeoverState: Record<string, number>

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
   */
  findControlForMessage: (msg: MidiMessage) => MappableControlId | null

  /** Update soft takeover state */
  updateSoftTakeover: (bindingKey: string, value: number) => void

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
      softTakeoverState: {},

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
        for (const [existingId, existingBinding] of Object.entries(newMappings)) {
          if (bindingKeyFromBinding(existingBinding) === newKey && existingId !== controlId) {
            console.log(`[MidiMap] ⚠️ Replacing mapping: ${existingId} → ${controlId} for ${newKey}`)
            delete newMappings[existingId]
          }
        }

        newMappings[controlId] = binding
        console.log(`[MidiMap] ✅ Mapped: ${controlId} → ${binding.type} ch${binding.channel} #${binding.control}`)

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
        set({ mappings: newMappings })
      },

      clearAll: () => {
        console.log('[MidiMap] 🗑️ All mappings cleared')
        set({ mappings: {}, softTakeoverState: {} })
      },

      // ── Lookups ──
      getBinding: (controlId) => {
        return get().mappings[controlId]
      },

      findControlForMessage: (msg) => {
        const type = msg.type === 'cc' ? 'cc' : 'note'
        const searchKey = bindingKey(type, msg.channel, msg.control)

        for (const [controlId, binding] of Object.entries(get().mappings)) {
          if (bindingKeyFromBinding(binding) === searchKey) {
            return controlId as MappableControlId
          }
        }

        return null
      },

      // ── Soft Takeover ──
      updateSoftTakeover: (key, value) => {
        set((state) => ({
          softTakeoverState: { ...state.softTakeoverState, [key]: value },
        }))
      },

      clearLastMapped: () => set({ lastMapped: null }),
    }),
    {
      name: 'luxsync-midi-mappings',
      // Only persist mappings, not transient UI state
      partialize: (state) => ({
        mappings: state.mappings,
      }),
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
