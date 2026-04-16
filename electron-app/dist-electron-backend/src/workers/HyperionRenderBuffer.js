/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ☀️ HYPERION RENDER BUFFER — Transferrable Packing/Unpacking
 * "La Autopista de Datos entre Main Thread y Worker"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Packs per-frame fixture data into a Float32Array for zero-copy transfer
 * via postMessage Transferrable. The main thread PACKS, the worker UNPACKS.
 *
 * Layout: 10 Float32 per fixture:
 *   [r, g, b, intensity, physicalPan, physicalTilt, zoom, focus, panVelocity, tiltVelocity]
 *
 * At 64 fixtures: 64 × 10 × 4 bytes = 2,560 bytes per frame.
 * At 44Hz: ~113 KB/s. Trivial.
 *
 * @module workers/HyperionRenderBuffer
 * @since WAVE 2510 (Operación Hyperion — The 4th Worker)
 */
import { FLOATS_PER_FIXTURE, FIXTURE_FIELD } from './hyperion-render.types';
// ═══════════════════════════════════════════════════════════════════════════
// PACK — Main thread side (called in useSeleneTruth or TacticalCanvas)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Pack an array of fixture frame data into a Float32Array for Transferrable.
 * Returns a NEW Float32Array each call (previous one was transferred to worker).
 */
export function packFixtureFrames(fixtures) {
    const buffer = new Float32Array(fixtures.length * FLOATS_PER_FIXTURE);
    for (let i = 0; i < fixtures.length; i++) {
        const offset = i * FLOATS_PER_FIXTURE;
        const f = fixtures[i];
        buffer[offset + FIXTURE_FIELD.R] = f.r;
        buffer[offset + FIXTURE_FIELD.G] = f.g;
        buffer[offset + FIXTURE_FIELD.B] = f.b;
        buffer[offset + FIXTURE_FIELD.INTENSITY] = f.intensity;
        buffer[offset + FIXTURE_FIELD.PHYSICAL_PAN] = f.physicalPan;
        buffer[offset + FIXTURE_FIELD.PHYSICAL_TILT] = f.physicalTilt;
        buffer[offset + FIXTURE_FIELD.ZOOM] = f.zoom;
        buffer[offset + FIXTURE_FIELD.FOCUS] = f.focus;
        buffer[offset + FIXTURE_FIELD.PAN_VELOCITY] = f.panVelocity;
        buffer[offset + FIXTURE_FIELD.TILT_VELOCITY] = f.tiltVelocity;
    }
    return buffer;
}
// ═══════════════════════════════════════════════════════════════════════════
// UNPACK — Worker side (called in render loop)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Read a single fixture's frame data from packed buffer.
 * Zero-allocation: returns values via the pre-allocated `out` object.
 */
export function unpackFixtureFrame(buffer, index, out) {
    const offset = index * FLOATS_PER_FIXTURE;
    out.r = buffer[offset + FIXTURE_FIELD.R];
    out.g = buffer[offset + FIXTURE_FIELD.G];
    out.b = buffer[offset + FIXTURE_FIELD.B];
    out.intensity = buffer[offset + FIXTURE_FIELD.INTENSITY];
    out.physicalPan = buffer[offset + FIXTURE_FIELD.PHYSICAL_PAN];
    out.physicalTilt = buffer[offset + FIXTURE_FIELD.PHYSICAL_TILT];
    out.zoom = buffer[offset + FIXTURE_FIELD.ZOOM];
    out.focus = buffer[offset + FIXTURE_FIELD.FOCUS];
    out.panVelocity = buffer[offset + FIXTURE_FIELD.PAN_VELOCITY];
    out.tiltVelocity = buffer[offset + FIXTURE_FIELD.TILT_VELOCITY];
}
