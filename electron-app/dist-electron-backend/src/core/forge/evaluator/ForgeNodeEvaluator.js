/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE NODE EVALUATOR — Zero-Alloc Hot-Path Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4548.6 (N4b): Evalúa un CompiledForgeGraph en un frame.
 *
 * ZERO-ALLOC: No crea objetos, arrays, strings ni closures.
 * Solo escribe en Float64Arrays y Uint8Arrays pre-allocated.
 *
 * PIPELINE PER FRAME (4 steps):
 *   1. Inject inputs (from Aether ArbitratedNodeMap + AudioContext)
 *   2. Execute program (OPCODE_TABLE dispatch, linear scan)
 *      con propagación inmediata de edges tras cada instrucción
 *   4. Flush outputs to dmxBuffer (normalized → 8-bit/16-bit DMX)
 *
 * @module core/forge/evaluator/ForgeNodeEvaluator
 * @version WAVE 4548.6
 */
import { OPCODE_TABLE } from './opcodes';
import { AUDIO_BAND_INDEX } from '../compiler/ForgeGraphCompiler';
// ═══════════════════════════════════════════════════════════════════════════
// DMX CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const DMX_UNIVERSE_SIZE = 512;
// ═══════════════════════════════════════════════════════════════════════════
// FORGE NODE EVALUATOR
// ═══════════════════════════════════════════════════════════════════════════
export class ForgeNodeEvaluator {
    /**
     * Evalúa el grafo compilado de un fixture en un frame.
     *
     * ZERO-ALLOC: No crea objetos, arrays, strings ni closures.
     * Solo escribe en TypedArrays pre-allocated.
     *
     * @param compiled   — Grafo compilado (immutable after compile)
     * @param values     — Valores arbitrados del Aether para este device
     * @param ctx        — Contexto del frame (tiempo, BPM, audio)
     * @param dmxBuffer  — Uint8Array(512) del universo destino
     * @param baseAddr   — Dirección DMX base del device (0-indexed)
     */
    static evaluate(compiled, values, ctx, dmxBuffer, baseAddr) {
        const wire = compiled.wireBuffer;
        const state = compiled.stateBuffer;
        // ══════════════════════════════════════════════════════════════════
        // STEP 1: INJECT INPUTS (Aether → wireBuffer)
        // ══════════════════════════════════════════════════════════════════
        // 1a. Input DMX channels (from ArbitratedNodeMap)
        if (values !== undefined) {
            for (const [channelKey, wireIdx] of compiled.inputMap) {
                const v = values[channelKey];
                wire[wireIdx] = v !== undefined ? v : 0.0;
            }
        }
        else {
            // No arbitrated values — zero all input wires
            for (const [, wireIdx] of compiled.inputMap) {
                wire[wireIdx] = 0.0;
            }
        }
        // 1b. Audio bands
        if (compiled.audioInputMap.size > 0) {
            for (const [band, wireIdx] of compiled.audioInputMap) {
                const bandIdx = AUDIO_BAND_INDEX[band];
                wire[wireIdx] = bandIdx !== undefined ? ctx.audioBands[bandIdx] : 0.0;
            }
        }
        // 1c. Special context inputs
        if (compiled.beatInputIndex >= 0)
            wire[compiled.beatInputIndex] = ctx.isBeat ? 1.0 : 0.0;
        if (compiled.bpmInputIndex >= 0)
            wire[compiled.bpmInputIndex] = ctx.bpm / 300.0; // normalize to ~0-1
        if (compiled.energyInputIndex >= 0)
            wire[compiled.energyInputIndex] = ctx.energy;
        if (compiled.timeInputIndex >= 0)
            wire[compiled.timeInputIndex] = (ctx.timeMs % 60000) / 60000; // 0-1 ramp per minute
        // ══════════════════════════════════════════════════════════════════
        // STEP 2: EXECUTE PROGRAM (opcode dispatch, linear scan)
        // Cada instrucción empuja sus outputs a los inputs downstream en el
        // mismo frame. Esto elimina el frame-lag de las cadenas A -> B -> C.
        // ══════════════════════════════════════════════════════════════════
        const wiring = compiled.edgeWiring;
        const edgeCount = compiled.edgeCount;
        const program = compiled.program;
        const programLen = program.length;
        for (let pc = 0; pc < programLen; pc++) {
            const instr = program[pc];
            OPCODE_TABLE[instr.opcode](wire, state, instr, ctx);
            if (instr.outputCount <= 0 || edgeCount === 0)
                continue;
            const outputStart = instr.outputOffset;
            const outputEnd = outputStart + instr.outputCount;
            for (let e = 0; e < edgeCount; e++) {
                const srcIdx = wiring[e * 2];
                if (srcIdx < outputStart || srcIdx >= outputEnd)
                    continue;
                const dstIdx = wiring[e * 2 + 1];
                wire[dstIdx] = wire[srcIdx];
            }
        }
        // ══════════════════════════════════════════════════════════════════
        // STEP 3: FLUSH OUTPUTS (wireBuffer → dmxBuffer)
        // ══════════════════════════════════════════════════════════════════
        const outputs = compiled.outputs;
        const outputLen = outputs.length;
        for (let o = 0; o < outputLen; o++) {
            const out = outputs[o];
            let normalized = wire[out.wireIndex];
            // Clamp to [0, 1]
            if (normalized < 0)
                normalized = 0;
            if (normalized > 1)
                normalized = 1;
            const bufIdx = baseAddr + out.dmxOffset;
            if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE)
                continue; // safety
            if (out.is16bit) {
                const raw16 = Math.round(normalized * 65535);
                dmxBuffer[bufIdx] = (raw16 >> 8) & 0xFF; // coarse (MSB)
                const fineIdx = bufIdx + 1;
                if (fineIdx < DMX_UNIVERSE_SIZE) {
                    dmxBuffer[fineIdx] = raw16 & 0xFF; // fine (LSB)
                }
            }
            else {
                dmxBuffer[bufIdx] = Math.round(normalized * 255);
            }
        }
    }
}
