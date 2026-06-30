/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏱️ CLOCK SOURCE — WAVE 2501: THE SPITE-DRIVEN PROTOCOL SUITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Interfaz unificada para todas las fuentes de reloj externas.
 * ChronosEngine delega la sincronización temporal a un ClockSource
 * seleccionable en runtime: Internal, MIDI Clock, MTC, Art-Net TC, LTC/SMPTE.
 *
 * ARQUITECTURA:
 * ┌──────────────────────────────────────────┐
 * │             ChronosEngine                │
 * │   currentTimeMs ← clockSource.getTimeMs()│
 * └──────────────┬───────────────────────────┘
 *                │ implements IClockSource
 *    ┌───────────┼───────────┬──────────────┬──────────────┐
 *    ▼           ▼           ▼              ▼              ▼
 * Internal   MIDIClock    MTCParser   ArtNetTC Recv   LTC/SMPTE
 * (default)  (slave)      (position)  (UDP 6454)     (AudioWorklet)
 *
 * @module chronos/core/ClockSource
 * @version WAVE 2501
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🛠️ ABSTRACT BASE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Convenience base class with event bus boilerplate.
 * Concrete sources only implement the transport-specific logic.
 */
export class BaseClockSource {
    constructor() {
        this.connected = false;
        this.listeners = new Map();
    }
    isConnected() {
        return this.connected;
    }
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
        return () => this.listeners.get(event)?.delete(handler);
    }
    emit(event, payload) {
        this.listeners.get(event)?.forEach(h => {
            try {
                h(payload);
            }
            catch (e) {
                console.error(`[${this.name}] event error:`, e);
            }
        });
    }
    dispose() {
        this.stop();
        this.listeners.clear();
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// 🧮 SMPTE UTILITIES (shared by MTC, Art-Net TC, LTC)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Convert SMPTE timecode components to milliseconds.
 */
export function smpteToMs(tc) {
    const totalFrames = tc.hours * 3600 * tc.frameRate +
        tc.minutes * 60 * tc.frameRate +
        tc.seconds * tc.frameRate +
        tc.frames;
    // Handle 29.97 drop-frame approximation
    const effectiveRate = tc.frameRate === 29.97 ? 30000 / 1001 : tc.frameRate;
    return (totalFrames / effectiveRate) * 1000;
}
/**
 * Convert milliseconds to SMPTE timecode.
 *
 * Uses Math.round on totalFrames to avoid IEEE-754 floating-point truncation
 * (e.g. 5025.48 * 25 = 125636.999... instead of 125637). All field decomposition
 * is then derived from the integer frame count for perfect consistency.
 */
export function msToSmpte(ms, frameRate) {
    const effectiveRate = frameRate === 29.97 ? 30000 / 1001 : frameRate;
    const nominalRate = Math.round(effectiveRate); // 24, 25, 30
    const totalFrames = Math.round((ms / 1000) * effectiveRate);
    const frames = totalFrames % nominalRate;
    const totalSeconds = Math.floor(totalFrames / nominalRate);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600) % 24;
    return { hours, minutes, seconds, frames, frameRate };
}
