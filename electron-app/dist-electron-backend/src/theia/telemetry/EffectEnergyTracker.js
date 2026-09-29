/**
 * EffectEnergyTracker.ts — Euclid Oracle · WAVE 8287 (Clean Shot · F1)
 *
 * Envolvente de energía del EFECTO FÍSICO activo — paridad video↔luces.
 *
 * Fuente de verdad: `HephaestusRuntime.activeClips` — el mapa de clips
 * .lfx que están moviendo fixtures AHORA MISMO. Pertenecer al mapa ES el
 * ciclo de vida: play() inserta, el tick expira al llegar a durationMs,
 * stop()/stopAll() borran al instante. Al sondear el mapa ningún evento
 * puede perderse (los efectos bloqueados por Shield/cooldown jamás
 * entran; los aborts desaparecen solos).
 *
 * Envolvente:
 *   clip vivo (age < durationMs o loop) → energy = intensity  (hold exacto)
 *   mapa vacío tras actividad           → release lineal 250 ms desde la
 *                                       última energía (cola orgánica: el
 *                                       clip ya no mueve luz, el burst
 *                                       visual aterriza sin corte seco).
 *   clip loop                           → hold permanente; ageN = fract
 *                                         (efecto sostenido = energía alta
 *                                         mientras el loop siga vivo).
 *
 * Zero-alloc: `sample()` itera con Map.forEach + callback pre-bound y
 * escribe sobre el scratch `out` pasado por referencia — ningún objeto
 * nace ni por tick ni por clip.
 */
export function createFxEnergySample() {
    return { energy: 0, ageN: 0, typeId: 0, count: 0 };
}
/** Cola de aterrizaje tras el último clip vivo (ms). */
export const FX_RELEASE_MS = 250;
/** FNV-1a 32-bit → 0..1 — hash estable del clip.id (arquetipo), sin allocs. */
function hashClipId(id) {
    let h = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) / 4294967295;
}
export class EffectEnergyTracker {
    constructor() {
        /** Última energía dominante — base de la cola de release. */
        this._lastEnergy = 0;
        /** typeId del último dominante — persiste durante el release. */
        this._lastTypeId = 0;
        /** Stamp (ms) donde arrancó la cola de release. */
        this._releaseT0 = -1;
        // Scratch de iteración — `forEach` no acepta args extra: el estado del
        // barrido viaja en campos, no en closures ni capturas por llamada.
        this._now = 0;
        this._out = null;
        this._accumulate = (clip) => {
            const out = this._out;
            if (!out || clip.durationMs <= 0)
                return;
            const age = this._now - clip.startTimeMs;
            if (age < 0)
                return;
            if (!clip.loop && age >= clip.durationMs)
                return; // expira este tick
            out.count++;
            const e = clip.intensity;
            if (e > out.energy) {
                out.energy = e;
                out.ageN = clip.loop
                    ? (age % clip.durationMs) / clip.durationMs
                    : Math.min(1, age / clip.durationMs);
                out.typeId = hashClipId(clip.clip.id);
            }
        };
    }
    /**
     * Sondea el mapa de clips vivos y escribe la envolvente en `out`.
     * `clips` = `HephaestusRuntime.getActiveClips()` (vista read-only sin
     * copia). Dominante = max intensidad entre vivos.
     */
    sample(nowMs, clips, out) {
        out.energy = 0;
        out.ageN = 0;
        out.typeId = 0;
        out.count = 0;
        if (clips.size > 0) {
            this._now = nowMs;
            this._out = out;
            clips.forEach(this._accumulate);
            this._out = null;
        }
        if (out.count > 0) {
            // Hold: hay clip(s) vivos — la envolvente ES la intensidad física.
            this._lastEnergy = out.energy;
            this._lastTypeId = out.typeId;
            this._releaseT0 = -1;
            return;
        }
        // Sin clips vivos → cola de release desde la última energía conocida.
        if (this._lastEnergy > 0) {
            if (this._releaseT0 < 0)
                this._releaseT0 = nowMs;
            const t = (nowMs - this._releaseT0) / FX_RELEASE_MS;
            if (t < 1) {
                out.energy = this._lastEnergy * (1 - t);
                out.ageN = 1;
                out.typeId = this._lastTypeId;
                return;
            }
            this._lastEnergy = 0; // cola agotada — reset limpio
        }
    }
}
export function createEffectEnergyTracker() {
    return new EffectEnergyTracker();
}
