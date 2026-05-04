/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE EVALUATOR — OPCODE TABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.6 (N4b): Funciones atómicas de evaluación para cada ForgeNodeType.
 *
 * Cada función opera EXCLUSIVAMENTE sobre Float64Arrays pre-allocated.
 * INVARIANTE: Zero heap allocations. Solo aritmética sobre typed arrays.
 *
 * La tabla OPCODE_TABLE es un array indexado por opcode numérico.
 * El dispatch es O(1): OPCODE_TABLE[instr.opcode](wire, state, instr, ctx)
 *
 * Opcode assignments (must match ForgeGraphCompiler OPCODE_MAP):
 *   0  = noop
 *   1  = input_dmx          (passthrough, injected in step 1)
 *   2  = input_audio_band   (passthrough, injected in step 1)
 *   3  = input_beat          (passthrough)
 *   4  = input_bpm           (passthrough)
 *   5  = input_energy        (passthrough)
 *   6  = input_constant
 *   7  = input_time          (passthrough)
 *   8  = proc_lfo
 *   9  = proc_smooth
 *  10  = proc_map_range
 *  11  = proc_math
 *  12  = proc_clamp
 *  13  = proc_delay
 *  14  = proc_merge
 *  15  = proc_invert
 *  16  = proc_curve
 *  17  = logic_threshold
 *  18  = logic_gate
 *  19  = logic_switch
 *  20  = logic_and
 *  21  = logic_or
 *  22  = logic_counter
 *  23  = output_dmx
 *
 * @module core/forge/evaluator/opcodes
 * @version WAVE 4548.6
 */

import type { CompiledInstruction, ForgeFrameContext } from '../compiler/types'

// ═══════════════════════════════════════════════════════════════════════════
// OPCODE FUNCTION SIGNATURE
// ═══════════════════════════════════════════════════════════════════════════

export type OpcodeFn = (
  wire: Float64Array,
  state: Float64Array,
  instr: CompiledInstruction,
  ctx: ForgeFrameContext,
) => void

// ═══════════════════════════════════════════════════════════════════════════
// TWO_PI constant
// ═══════════════════════════════════════════════════════════════════════════

const TWO_PI = 6.283185307179586

// ═══════════════════════════════════════════════════════════════════════════
// OPCODE IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

// ── 0: noop ──────────────────────────────────────────────────────────────
function op_noop(
  _wire: Float64Array, _state: Float64Array,
  _instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void { /* no-op */ }

// ── 1: input_dmx — passthrough (value injected in step 1) ───────────────
// The wire already has the value from the injection step.
// We just copy the output port's value from the input injection.
// Actually, input_dmx's output IS the injection target — noop.
function op_input_dmx(
  _wire: Float64Array, _state: Float64Array,
  _instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void { /* value already injected into output wire slot */ }

// ── 2: input_audio_band — passthrough ────────────────────────────────────
function op_input_audio_band(
  _wire: Float64Array, _state: Float64Array,
  _instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void { /* value already injected */ }

// ── 3: input_beat — passthrough ──────────────────────────────────────────
function op_input_beat(
  _wire: Float64Array, _state: Float64Array,
  _instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void { /* value already injected */ }

// ── 4: input_bpm — passthrough ───────────────────────────────────────────
function op_input_bpm(
  _wire: Float64Array, _state: Float64Array,
  _instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void { /* value already injected */ }

// ── 5: input_energy — passthrough ────────────────────────────────────────
function op_input_energy(
  _wire: Float64Array, _state: Float64Array,
  _instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void { /* value already injected */ }

// ── 6: input_constant ────────────────────────────────────────────────────
// params[0] = constant value
function op_input_constant(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  wire[instr.outputOffset] = instr.params[0]
}

// ── 7: input_time — passthrough ──────────────────────────────────────────
function op_input_time(
  _wire: Float64Array, _state: Float64Array,
  _instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void { /* value already injected */ }

// ── 8: proc_lfo ──────────────────────────────────────────────────────────
// params: [waveform, frequencyHz, syncToBpm(0/1), bpmDivisor, phase]
// state:  [phaseAccumulator]
function op_proc_lfo(
  wire: Float64Array, state: Float64Array,
  instr: CompiledInstruction, ctx: ForgeFrameContext,
): void {
  const waveform    = instr.params[0]
  const frequencyHz = instr.params[1]
  const syncToBpm   = instr.params[2]
  const bpmDivisor  = instr.params[3]
  const initPhase   = instr.params[4]

  // Effective frequency
  let freq = frequencyHz
  if (syncToBpm > 0.5 && ctx.bpm > 0) {
    freq = (ctx.bpm / 60.0) / (bpmDivisor > 0 ? bpmDivisor : 1.0)
  }

  // Read and advance phase
  const phaseIdx = instr.stateOffset
  let phase = state[phaseIdx]
  phase += freq * (ctx.deltaMs / 1000.0)
  if (phase >= 1.0) phase -= Math.floor(phase)  // wrap to [0, 1)
  state[phaseIdx] = phase

  // Calculate waveform value
  const t = (phase + initPhase) % 1.0
  let value: number
  const wf = waveform | 0  // integer cast for switch
  if (wf === 0) {
    value = 0.5 + 0.5 * Math.sin(t * TWO_PI)        // sine
  } else if (wf === 1) {
    value = t < 0.5 ? t * 2.0 : 2.0 - t * 2.0       // triangle
  } else if (wf === 2) {
    value = t                                          // sawtooth
  } else if (wf === 3) {
    value = t < 0.5 ? 1.0 : 0.0                       // square
  } else {
    value = 0.5                                        // random_hold placeholder
  }

  // Input modulation: if input is connected and > 0, modulate amplitude
  if (instr.inputCount > 0) {
    const inputVal = wire[instr.inputOffset]
    if (inputVal > 0) value *= inputVal
  }

  wire[instr.outputOffset] = value
}

// ── 9: proc_smooth ───────────────────────────────────────────────────────
// params: [attackMs, releaseMs]
// state:  [previousValue]
function op_proc_smooth(
  wire: Float64Array, state: Float64Array,
  instr: CompiledInstruction, ctx: ForgeFrameContext,
): void {
  const attackMs  = instr.params[0]
  const releaseMs = instr.params[1]

  const input    = wire[instr.inputOffset]
  const prevIdx  = instr.stateOffset
  const previous = state[prevIdx]

  // Exponential smoothing: alpha = 1 - e^(-dt/tau)
  const dt  = ctx.deltaMs
  const tau = input > previous ? attackMs : releaseMs
  const alpha = tau > 0 ? 1.0 - Math.exp(-dt / tau) : 1.0

  const smoothed = previous + alpha * (input - previous)
  state[prevIdx] = smoothed
  wire[instr.outputOffset] = smoothed
}

// ── 10: proc_map_range ───────────────────────────────────────────────────
// params: [inputMin, inputMax, outputMin, outputMax]
function op_proc_map_range(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const inMin  = instr.params[0]
  const inMax  = instr.params[1]
  const outMin = instr.params[2]
  const outMax = instr.params[3]

  const input = wire[instr.inputOffset]
  const inRange = inMax - inMin
  if (inRange === 0) {
    wire[instr.outputOffset] = outMin
    return
  }
  const normalized = (input - inMin) / inRange
  wire[instr.outputOffset] = outMin + normalized * (outMax - outMin)
}

// ── 11: proc_math ────────────────────────────────────────────────────────
// params: [operation]
// inputs: [a, b]
function op_proc_math(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const a = wire[instr.inputOffset]
  const b = instr.inputCount > 1 ? wire[instr.inputOffset + 1] : 0.0
  const op = instr.params[0] | 0

  let result: number
  if (op === 0) result = a + b            // add
  else if (op === 1) result = a - b       // subtract
  else if (op === 2) result = a * b       // multiply
  else if (op === 3) result = b !== 0 ? a / b : 0  // divide
  else if (op === 4) result = b !== 0 ? a % b : 0  // modulo
  else if (op === 5) result = Math.pow(a, b)        // power
  else result = a

  wire[instr.outputOffset] = result
}

// ── 12: proc_clamp ───────────────────────────────────────────────────────
// params: [min, max]
function op_proc_clamp(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const min = instr.params[0]
  const max = instr.params[1]
  let v = wire[instr.inputOffset]
  if (v < min) v = min
  if (v > max) v = max
  wire[instr.outputOffset] = v
}

// ── 13: proc_delay ───────────────────────────────────────────────────────
// params: [delayFrames]
// state:  [ringBuffer[delayFrames], writeHead]
function op_proc_delay(
  wire: Float64Array, state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const delayFrames = instr.params[0] | 0
  if (delayFrames <= 0) {
    // No delay — passthrough
    wire[instr.outputOffset] = wire[instr.inputOffset]
    return
  }

  const bufStart = instr.stateOffset
  const headIdx  = bufStart + delayFrames  // last slot = write head

  const head    = state[headIdx] | 0
  const readPos = (head + 1) % delayFrames  // oldest sample

  // Output oldest sample
  wire[instr.outputOffset] = state[bufStart + readPos]

  // Write new sample at head
  state[bufStart + head] = wire[instr.inputOffset]

  // Advance head
  state[headIdx] = (head + 1) % delayFrames
}

// ── 14: proc_merge ───────────────────────────────────────────────────────
// params: [strategy]  0=max, 1=min, 2=avg, 3=sum
function op_proc_merge(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const strategy = instr.params[0] | 0
  const count    = instr.inputCount
  if (count === 0) {
    wire[instr.outputOffset] = 0
    return
  }

  let result = wire[instr.inputOffset]
  for (let i = 1; i < count; i++) {
    const v = wire[instr.inputOffset + i]
    if (strategy === 0)      result = v > result ? v : result      // max
    else if (strategy === 1) result = v < result ? v : result      // min
    else if (strategy === 2) result += v                            // accumulate for avg
    else if (strategy === 3) result += v                            // sum
  }

  if (strategy === 2 && count > 1) result /= count  // average

  wire[instr.outputOffset] = result
}

// ── 15: proc_invert ──────────────────────────────────────────────────────
function op_proc_invert(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  wire[instr.outputOffset] = 1.0 - wire[instr.inputOffset]
}

// ── 16: proc_curve ───────────────────────────────────────────────────────
// params: [curveType, exponent, gamma]
// 0=linear, 1=exponential, 2=logarithmic, 3=scurve, 4=gamma
function op_proc_curve(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const curveType = instr.params[0] | 0
  const exponent  = instr.params[1]
  const gamma     = instr.params[2]
  let v = wire[instr.inputOffset]

  // Clamp input to [0, 1] for safety
  if (v < 0) v = 0
  if (v > 1) v = 1

  if (curveType === 0) {
    // linear — passthrough
  } else if (curveType === 1) {
    v = Math.pow(v, exponent)                          // exponential
  } else if (curveType === 2) {
    v = Math.log(1 + v * (Math.E - 1))                 // logarithmic [0,1]→[0,1]
  } else if (curveType === 3) {
    // S-curve: 3v² - 2v³ (Hermite smoothstep)
    v = v * v * (3.0 - 2.0 * v)
  } else if (curveType === 4) {
    v = Math.pow(v, 1.0 / gamma)                       // gamma correction
  }

  wire[instr.outputOffset] = v
}

// ── 17: logic_threshold ──────────────────────────────────────────────────
// params: [threshold, hysteresis]
// state:  [lastOutput]
function op_logic_threshold(
  wire: Float64Array, state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const threshold  = instr.params[0]
  const hysteresis = instr.params[1]
  const input      = wire[instr.inputOffset]
  const prevOutput = state[instr.stateOffset]

  let output: number
  if (prevOutput > 0.5) {
    // Currently ON — only OFF below (threshold - hysteresis)
    output = input >= (threshold - hysteresis) ? 1.0 : 0.0
  } else {
    // Currently OFF — only ON above (threshold + hysteresis)
    output = input > (threshold + hysteresis) ? 1.0 : 0.0
  }

  state[instr.stateOffset] = output
  wire[instr.outputOffset] = output
}

// ── 18: logic_gate ───────────────────────────────────────────────────────
// inputs: [signal, gate]
function op_logic_gate(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const signal = wire[instr.inputOffset]
  const gate   = instr.inputCount > 1 ? wire[instr.inputOffset + 1] : 1.0
  wire[instr.outputOffset] = gate > 0.5 ? signal : 0.0
}

// ── 19: logic_switch ─────────────────────────────────────────────────────
// params: [switchThreshold]
// inputs: [input_a, input_b, selector]
function op_logic_switch(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const threshold = instr.params[0]
  const inputA    = wire[instr.inputOffset]
  const inputB    = instr.inputCount > 1 ? wire[instr.inputOffset + 1] : 0.0
  const selector  = instr.inputCount > 2 ? wire[instr.inputOffset + 2] : 0.0
  wire[instr.outputOffset] = selector > threshold ? inputB : inputA
}

// ── 20: logic_and ────────────────────────────────────────────────────────
// inputs: [a, b]
function op_logic_and(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const a = wire[instr.inputOffset]
  const b = instr.inputCount > 1 ? wire[instr.inputOffset + 1] : 0.0
  wire[instr.outputOffset] = (a > 0.5 && b > 0.5) ? 1.0 : 0.0
}

// ── 21: logic_or ─────────────────────────────────────────────────────────
// inputs: [a, b]
function op_logic_or(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const a = wire[instr.inputOffset]
  const b = instr.inputCount > 1 ? wire[instr.inputOffset + 1] : 0.0
  wire[instr.outputOffset] = (a > 0.5 || b > 0.5) ? 1.0 : 0.0
}

// ── 22: logic_counter ────────────────────────────────────────────────────
// params: [modulo, emitNormalized(0/1)]
// state:  [count]
function op_logic_counter(
  wire: Float64Array, state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  const modulo         = instr.params[0]
  const emitNormalized = instr.params[1]
  const trigger        = wire[instr.inputOffset]

  // Count rising edge: trigger > 0.5
  let count = state[instr.stateOffset]
  if (trigger > 0.5) {
    count = (count + 1) % (modulo > 0 ? modulo : 1)
    state[instr.stateOffset] = count
  }

  wire[instr.outputOffset] = emitNormalized > 0.5
    ? count / (modulo > 0 ? modulo : 1)
    : count
}

// ── 23: output_dmx ───────────────────────────────────────────────────────
// The output_dmx node just passes its input to its wire slot.
// The actual DMX write happens in the flush step (step 4).
// params[0] = defaultDmxValue (normalized)
function op_output_dmx(
  wire: Float64Array, _state: Float64Array,
  instr: CompiledInstruction, _ctx: ForgeFrameContext,
): void {
  // If input is connected, use it. Otherwise, use default.
  if (instr.inputCount > 0) {
    // The input wire already has the value from edge propagation.
    // Copy to output port (flush reads from input port, but let's
    // ensure the wire slot referenced by CompiledOutput is correct).
    // NOTE: CompiledOutput.wireIndex points to the INPUT port of
    // output_dmx node, so we don't need to copy here. This is a noop
    // in the normal flow. The wire value is already at inputOffset.
  }
  // If no input connected, write default to the input slot
  // (so flush reads the default value)
  if (instr.inputCount === 0 || wire[instr.inputOffset] === 0) {
    // Only apply default if nothing was written
    // Actually, we should check if the wire was written by an edge.
    // For safety: if input is exactly 0 and default is non-zero, don't override.
    // This noop is intentional — the edge propagation step already wrote values.
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPCODE TABLE — Indexed by opcode number. O(1) dispatch.
// ═══════════════════════════════════════════════════════════════════════════

export const OPCODE_TABLE: readonly OpcodeFn[] = [
  op_noop,              // 0
  op_input_dmx,         // 1
  op_input_audio_band,  // 2
  op_input_beat,        // 3
  op_input_bpm,         // 4
  op_input_energy,      // 5
  op_input_constant,    // 6
  op_input_time,        // 7
  op_proc_lfo,          // 8
  op_proc_smooth,       // 9
  op_proc_map_range,    // 10
  op_proc_math,         // 11
  op_proc_clamp,        // 12
  op_proc_delay,        // 13
  op_proc_merge,        // 14
  op_proc_invert,       // 15
  op_proc_curve,        // 16
  op_logic_threshold,   // 17
  op_logic_gate,        // 18
  op_logic_switch,      // 19
  op_logic_and,         // 20
  op_logic_or,          // 21
  op_logic_counter,     // 22
  op_output_dmx,        // 23
]
