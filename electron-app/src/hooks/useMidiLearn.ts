/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 WAVE 2047: USE MIDI LEARN - OPERATION "GHOST LIMBS"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Global MIDI input hook that runs in DUAL MODE:
 * 
 * MODE 1 — LEARN (learnMode = true):
 *   Captures the FIRST incoming CC/Note and maps it to the listening control.
 *   Visual feedback: flash green on mapped control.
 * 
 * MODE 2 — RUNTIME (learnMode = false):
 *   Routes every incoming MIDI message through the mapping table.
 *   CC → injects value into appropriate store (0-127 → 0.0-1.0)
 *   Note → toggles corresponding button/effect
 *   Soft Takeover: CC only takes effect when physical matches digital (±5)
 * 
 * ARCHITECTURE:
 * ┌──────────────────────────────────────────────────────┐
 * │  Web MIDI API (navigator.requestMIDIAccess)          │
 * │  ┌──────────────────────────────────────────────┐    │
 * │  │  input.onmidimessage → parseMidiMessage()    │    │
 * │  └──────────┬───────────────────────────────────┘    │
 * │             │                                        │
 * │  ┌──────────▼───────────────────────────────────┐    │
 * │  │  if (learnMode && listeningControl)          │    │
 * │  │    → setMapping(control, binding)            │    │
 * │  │  else                                        │    │
 * │  │    → findControlForMessage(msg)              │    │
 * │  │    → dispatchToStore(controlId, value)       │    │
 * │  └──────────────────────────────────────────────┘    │
 * └──────────────────────────────────────────────────────┘
 * 
 * SOFT TAKEOVER:
 * When a physical fader doesn't match the digital value (e.g., fader at 0
 * but digital at 80%), moving the fader has NO EFFECT until it "catches up"
 * to within ±5 of the digital value. Prevents brutal jumps.
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * Real Web MIDI API. Real messages. Real store mutations.
 * 
 * @module hooks/useMidiLearn
 * @version WAVE 2047
 */

import { useEffect, useCallback, useRef } from 'react'
import {
  useMidiMapStore,
  type MidiMessage,
  type MidiBinding,
  type MappableControlId,
} from '../stores/midiMapStore'
import { useControlStore } from '../stores/controlStore'
import { useLuxSyncStore } from '../stores/luxsyncStore'
import { useEffectsStore } from '../stores/effectsStore'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** MIDI Status byte masks */
const STATUS_NOTE_OFF = 0x80
const STATUS_NOTE_ON = 0x90
const STATUS_CC = 0xB0

/** Soft takeover threshold (±5 out of 127) */
const SOFT_TAKEOVER_THRESHOLD = 5

// ═══════════════════════════════════════════════════════════════════════════
// MIDI MESSAGE PARSER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse raw MIDI bytes into structured message.
 * Returns null for system messages (clock, sysex, etc.)
 */
function parseMidiMessage(data: Uint8Array): MidiMessage | null {
  if (!data || data.length < 2) return null

  const status = data[0]
  const statusType = status & 0xF0
  const channel = status & 0x0F

  switch (statusType) {
    case STATUS_NOTE_ON: {
      const note = data[1]
      const velocity = data.length > 2 ? data[2] : 0
      // Velocity 0 = Note Off (MIDI convention)
      if (velocity === 0) {
        return { type: 'note_off', channel, control: note, value: 0 }
      }
      return { type: 'note_on', channel, control: note, value: velocity }
    }

    case STATUS_NOTE_OFF: {
      const note = data[1]
      return { type: 'note_off', channel, control: note, value: 0 }
    }

    case STATUS_CC: {
      const cc = data[1]
      const value = data.length > 2 ? data[2] : 0
      return { type: 'cc', channel, control: cc, value }
    }

    default:
      // Ignore system messages (0xF0-0xFF: clock, sysex, etc.)
      return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Global MIDI Learn hook.
 * Mount this ONCE at app root level (AppCommander.tsx).
 * Handles both learning and runtime execution.
 */
export function useMidiLearn() {
  const midiAccessRef = useRef<MIDIAccess | null>(null)
  const isInitializedRef = useRef(false)

  // ── Store references (stable via getState()) ──
  // We use getState() in the message handler to avoid re-render on every MIDI message
  const midiMapStoreRef = useRef(useMidiMapStore.getState)
  const controlStoreRef = useRef(useControlStore.getState)
  const luxSyncStoreRef = useRef(useLuxSyncStore.getState)

  // ── WAVE 3302: Stable dispatch ref to break useCallback dependency chain ──
  // Without this, handleMidiMessage → dispatchToStore → checkSoftTakeover
  // creates a cascade of useCallback re-creations that causes useEffect re-runs
  // and potential double-wiring of MIDI inputs during cleanup/reinit race.
  const dispatchRef = useRef<(controlId: MappableControlId, msg: MidiMessage) => void>(() => {})

  // ═══════════════════════════════════════════════════════════════════════
  // SOFT TAKEOVER CHECK
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check if a CC value should be accepted (soft takeover).
   * 
   * Returns true if:
   * 1. No previous physical value recorded (first touch)
   * 2. Physical value is within threshold of digital value
   * 3. Physical value has crossed over the digital value (catch-up)
   */
  const checkSoftTakeover = useCallback((
    bindingKeyStr: string,
    incomingValue: number,
    digitalValue: number,
  ): boolean => {
    const state = midiMapStoreRef.current()
    const lastPhysical = state.softTakeoverState[bindingKeyStr]

    // First touch: always accept (no previous reference)
    if (lastPhysical === undefined) {
      state.updateSoftTakeover(bindingKeyStr, incomingValue)
      return true
    }

    // Within threshold of digital value: accept (caught up)
    const digitalMidi = Math.round(digitalValue * 127)
    if (Math.abs(incomingValue - digitalMidi) <= SOFT_TAKEOVER_THRESHOLD) {
      state.updateSoftTakeover(bindingKeyStr, incomingValue)
      return true
    }

    // Check if physical crossed over digital (direction change)
    const wasBelowDigital = lastPhysical < digitalMidi
    const isNowAboveDigital = incomingValue >= digitalMidi
    const wasAboveDigital = lastPhysical > digitalMidi
    const isNowBelowDigital = incomingValue <= digitalMidi

    if ((wasBelowDigital && isNowAboveDigital) || (wasAboveDigital && isNowBelowDigital)) {
      state.updateSoftTakeover(bindingKeyStr, incomingValue)
      return true
    }

    // Not caught up yet: update tracking but reject
    state.updateSoftTakeover(bindingKeyStr, incomingValue)
    return false
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // DISPATCH TO STORES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Execute a MIDI message on the mapped control.
   * CC → set value (0-127 → 0.0-1.0)
   * Note On → toggle / fire effect
   * 
   * WAVE 3300: PREFIX ROUTING — The Bridge
   * - ctrl-*  → ControlStore (UI + internal)
   * - flow-*  → ControlStore flowParams
   * - lux-*   → LuxSyncStore
   * - fx-*    → window.lux.forceStrike() — REAL DMX via TitanEngine
   * - vibe-*  → window.lux.setVibe() — VibeProfile change
   * - arb-*   → window.lux.arbiter.* — MasterArbiter overrides
   */
  const dispatchToStore = useCallback((controlId: MappableControlId, msg: MidiMessage) => {
    const controlStore = controlStoreRef.current()
    const luxSyncStore = luxSyncStoreRef.current()

    // ── PREFIX ROUTING ──

    // ── fx-* → REAL EFFECT via forceStrike IPC ──
    if (controlId.startsWith('fx-')) {
      if (msg.type !== 'note_on') return
      const effectId = controlId.slice(3) // 'fx-strobe_storm' → 'strobe_storm'
      // WAVE 3303: Piano Syndrome fix — manual pad trigger = FULL POWER, always 1.0
      // Velocity from nanoPAD2 pads is physically inconsistent (0.42–0.78 range).
      // A manual trigger intent is binary: either fired or not. No half-measures.
      const intensity = 1.0
      window.lux.forceStrike({ effect: effectId, intensity })
      console.log(`[MidiLearn] ⚡ FORCE STRIKE: ${effectId} @ 100% (manual — velocity ignored)`)
      return
    }

    // ── vibe-* → Vibe change via setVibe IPC ──
    if (controlId.startsWith('vibe-')) {
      if (msg.type !== 'note_on') return
      const vibeId = controlId.slice(5) // 'vibe-fiesta-latina' → 'fiesta-latina'
      window.lux.setVibe(vibeId)
      console.log(`[MidiLearn] 🎭 VIBE CHANGE: ${vibeId}`)
      return
    }

    // ── arb-* → Arbiter overrides ──
    if (controlId.startsWith('arb-')) {
      const arbAction = controlId.slice(4) // 'arb-blackout' → 'blackout'
      switch (arbAction) {
        case 'blackout':
          if (msg.type !== 'note_on') return
          // 🔴 WAVE 3304: Absolute setter — lee estado actual del store, envía opuesto
          {
            const currentBlackout = useEffectsStore.getState().blackout
            const targetState = !currentBlackout
            window.lux.arbiter.setBlackout(targetState)
              .then((result: { success?: boolean; blackoutActive?: boolean }) => {
                if (result?.success) {
                  useEffectsStore.getState().setBlackout(result.blackoutActive ?? targetState)
                }
              })
              .catch(() => {})
            console.log(`[MidiLearn] 🎛️ ARBITER: Blackout → ${targetState ? 'ON' : 'OFF'}`)
          }
          return
        case 'grand-master':
          if (msg.type !== 'cc') return
          window.lux.arbiter.setGrandMaster(msg.value / 127)
          console.log(`[MidiLearn] 🎛️ ARBITER: Grand Master → ${(msg.value / 127 * 100).toFixed(0)}%`)
          return
        case 'kill-effects':
          if (msg.type !== 'note_on') return
          window.lux.cancelAllEffects()
          console.log('[MidiLearn] 🎛️ ARBITER: Kill All Effects')
          return
        default:
          return
      }
    }

    // ── SYSTEM CONTROLS (original exact-match routing) ──
    switch (controlId) {
      // ── Continuous Controls (CC → 0.0-1.0) ──
      case 'ctrl-intensity': {
        if (msg.type !== 'cc') return
        const bindKey = `cc:${msg.channel}:${msg.control}`
        const currentValue = controlStore.globalIntensity
        if (!checkSoftTakeover(bindKey, msg.value, currentValue)) return
        controlStore.setGlobalIntensity(msg.value / 127)
        break
      }

      case 'ctrl-saturation': {
        if (msg.type !== 'cc') return
        const bindKey = `cc:${msg.channel}:${msg.control}`
        const currentValue = controlStore.globalSaturation
        if (!checkSoftTakeover(bindKey, msg.value, currentValue)) return
        controlStore.setGlobalSaturation(msg.value / 127)
        break
      }

      case 'flow-speed': {
        if (msg.type !== 'cc') return
        const bindKey = `cc:${msg.channel}:${msg.control}`
        const currentNorm = controlStore.flowParams.speed / 100
        if (!checkSoftTakeover(bindKey, msg.value, currentNorm)) return
        controlStore.setFlowParams({ speed: Math.round((msg.value / 127) * 100) })
        break
      }

      case 'flow-spread': {
        if (msg.type !== 'cc') return
        const bindKey = `cc:${msg.channel}:${msg.control}`
        const currentNorm = controlStore.flowParams.spread / 100
        if (!checkSoftTakeover(bindKey, msg.value, currentNorm)) return
        controlStore.setFlowParams({ spread: Math.round((msg.value / 127) * 100) })
        break
      }

      // ── Toggle Controls (Note On → toggle) ──
      case 'ctrl-output-toggle': {
        if (msg.type !== 'note_on') return
        controlStore.toggleOutput()
        break
      }

      case 'ctrl-ai-toggle': {
        if (msg.type !== 'note_on') return
        controlStore.toggleAI()
        break
      }

      case 'lux-blackout': {
        if (msg.type !== 'note_on') return
        // 🔴 WAVE 3304: Absolute setter — lee estado, envía opuesto, sincroniza desde backend
        const currentBlackoutState = useEffectsStore.getState().blackout
        const targetBlackout = !currentBlackoutState
        window.lux.arbiter.setBlackout(targetBlackout)
          .then((result: { success?: boolean; blackoutActive?: boolean }) => {
            if (result?.success) {
              useEffectsStore.getState().setBlackout(result.blackoutActive ?? targetBlackout)
              luxSyncStore.setBlackout(result.blackoutActive ?? targetBlackout)
            }
          })
          .catch(() => {})
        break
      }
    }
  }, [checkSoftTakeover])

  // ── WAVE 3302: Keep dispatchRef always pointing to latest closure ──
  dispatchRef.current = dispatchToStore

  // ═══════════════════════════════════════════════════════════════════════
  // CORE MESSAGE HANDLER (STABLE — no useCallback deps, uses refs)
  // ═══════════════════════════════════════════════════════════════════════

  const handleMidiMessage = useCallback((event: Event) => {
    const midiEvent = event as MIDIMessageEvent
    if (!midiEvent.data) return
    const msg = parseMidiMessage(midiEvent.data)
    if (!msg) return

    const state = midiMapStoreRef.current()

    // ── MODE 1: LEARN ──
    if (state.learnMode && state.listeningControl) {
      // Only capture CC and Note On (ignore Note Off during learn)
      if (msg.type === 'note_off') return

      const binding: MidiBinding = {
        type: msg.type === 'cc' ? 'cc' : 'note',
        channel: msg.channel,
        control: msg.control,
      }

      state.setMapping(state.listeningControl, binding)
      console.log(`[MidiLearn] 🎹 CAPTURED: ${state.listeningControl} ← ${binding.type} ch${binding.channel} #${binding.control}`)
      return
    }

    // ── MODE 2: RUNTIME ──
    const controlId = state.findControlForMessage(msg)
    if (controlId) {
      dispatchRef.current(controlId, msg)
    }
  }, []) // STABLE — zero deps, reads via refs

  // ═══════════════════════════════════════════════════════════════════════
  // MIDI INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════

  const initMidi = useCallback(async () => {
    if (isInitializedRef.current) return
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      console.log('[MidiLearn] ⚠️ Web MIDI API not available')
      return
    }

    try {
      const access = await navigator.requestMIDIAccess({ sysex: false })
      midiAccessRef.current = access
      isInitializedRef.current = true

      console.log('[MidiLearn] 🎹 MIDI Access granted — Ghost Limbs ACTIVE')

      // Wire all current inputs
      const wireInputs = () => {
        access.inputs.forEach((input) => {
          input.onmidimessage = handleMidiMessage
        })
        console.log(`[MidiLearn] 🔌 Wired ${access.inputs.size} MIDI input(s)`)
      }

      wireInputs()

      // Re-wire on hot-plug
      access.onstatechange = () => {
        console.log('[MidiLearn] 🔄 MIDI device change')
        wireInputs()
      }
    } catch (err) {
      console.error('[MidiLearn] ❌ MIDI access denied:', err)
    }
  }, [handleMidiMessage])

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE (STABLE — initMidi and handleMidiMessage have zero deps)
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    initMidi()

    return () => {
      // Cleanup on unmount — kill all listeners
      const access = midiAccessRef.current
      if (access) {
        access.inputs.forEach((input) => {
          input.onmidimessage = null
        })
        access.onstatechange = null
      }
      // WAVE 3302: Do NOT reset isInitializedRef here.
      // The old code set isInitializedRef.current = false in cleanup,
      // allowing re-init on re-renders → double listeners during race.
      // Since initMidi is now stable (zero deps), this effect runs ONCE.
    }
  }, [initMidi])
}
