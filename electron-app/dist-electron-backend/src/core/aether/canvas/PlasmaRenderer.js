// ════════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 4812 — PLASMA RENDERER (Test Pattern Producer)
// ════════════════════════════════════════════════════════════════════════════
//
//  Produce un patrón "plasma" clásico (suma de sinusoides en UV + tiempo)
//  en el `back` buffer de un VirtualFrameBuffer y llama `flip()` cada frame.
//
//  DISEÑO:
//    - Zero-alloc en hot-path: todos los arrays son pre-allocated en el ctor.
//    - El renderer es autónomo: recibe canvasId + AetherCanvasManager y
//      genera la imagen en `tick(nowMs)`.
//    - Puede arrancarse y pararse independientemente del frame loop.
//    - Usado como test pattern en Sprint 2 de WAVE-4812.
//
//  PATRÓN PLASMA (fórmula clásica demoscene):
//    v1 = sin(x/freq1 + t)
//    v2 = sin(y/freq2 + t*0.7)
//    v3 = sin((x+y)/freq3 + t*0.5)
//    v4 = sin(sqrt((cx-x)²+(cy-y)²)/freq4 + t)
//    value = (v1+v2+v3+v4) / 4   ∈ [-1..1]
//    hue = value * 0.5 + 0.5     ∈ [0..1]
//    → HSL→RGB conversion
//
// ════════════════════════════════════════════════════════════════════════════
// ─── CONSTANTES ─────────────────────────────────────────────────────────────
/** Frecuencia horizontal de la primera onda (pixels). */
const FREQ1 = 8.0;
/** Frecuencia vertical de la segunda onda (pixels). */
const FREQ2 = 6.0;
/** Frecuencia diagonal de la tercera onda (pixels). */
const FREQ3 = 10.0;
/** Frecuencia radial de la cuarta onda (pixels). */
const FREQ4 = 5.0;
/** Velocidad temporal (radianes/ms). */
const TIME_SCALE = 0.0015;
// ─── RENDERER ───────────────────────────────────────────────────────────────
export class PlasmaRenderer {
    constructor(canvasId, manager) {
        this._running = false;
        /** Tiempo de inicio del renderer (ms). */
        this._startMs = 0;
        this._canvasId = canvasId;
        this._manager = manager;
    }
    /** Arranca el renderer. No-op si ya está corriendo. */
    start(nowMs) {
        if (this._running)
            return;
        this._running = true;
        this._startMs = nowMs;
    }
    /** Detiene el renderer y limpia el buffer a negro. */
    stop() {
        if (!this._running)
            return;
        this._running = false;
        this._manager.clear(this._canvasId, 0, 0, 0, 255);
        this._manager.flip(this._canvasId);
    }
    /** True si el renderer está activo. */
    get isRunning() {
        return this._running;
    }
    /**
     * Genera un frame del patrón plasma en el `back` buffer y llama `flip()`.
     *
     * **Hot path (44 Hz)** — zero-alloc, solo operaciones numéricas.
     *
     * @param nowMs — Timestamp actual (ms desde epoch o `performance.now()`).
     */
    tick(nowMs) {
        if (!this._running)
            return;
        const buf = this._manager.get(this._canvasId);
        if (!buf)
            return;
        const w = buf.width;
        const h = buf.height;
        const back = buf.back;
        const t = (nowMs - this._startMs) * TIME_SCALE;
        const cx = w * 0.5;
        const cy = h * 0.5;
        let idx = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const v1 = Math.sin(x / FREQ1 + t);
                const v2 = Math.sin(y / FREQ2 + t * 0.7);
                const v3 = Math.sin((x + y) / FREQ3 + t * 0.5);
                const dx = cx - x;
                const dy = cy - y;
                const v4 = Math.sin(Math.sqrt(dx * dx + dy * dy) / FREQ4 + t);
                // value ∈ [-1, 1] → hue ∈ [0, 1]
                const value = (v1 + v2 + v3 + v4) * 0.25;
                const hue = value * 0.5 + 0.5;
                // HSL → RGB (s=1, l=0.5)
                const [r, g, b] = _hsl2rgb(hue, 1.0, 0.5);
                back[idx] = r;
                back[idx + 1] = g;
                back[idx + 2] = b;
                back[idx + 3] = 255;
                idx += 4;
            }
        }
        this._manager.flip(this._canvasId);
    }
}
// ─── HELPERS ────────────────────────────────────────────────────────────────
/**
 * Conversión HSL → [R, G, B] con S=1, L=0.5 (fully saturated, mid lightness).
 * Retorna valores [0..255].
 * Zero-alloc por el tuple literal — V8 stack-allocates tuples peq.
 */
function _hsl2rgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = l - c * 0.5;
    let r = 0;
    let g = 0;
    let b = 0;
    const sector = (h * 6) | 0;
    switch (sector % 6) {
        case 0:
            r = c;
            g = x;
            b = 0;
            break;
        case 1:
            r = x;
            g = c;
            b = 0;
            break;
        case 2:
            r = 0;
            g = c;
            b = x;
            break;
        case 3:
            r = 0;
            g = x;
            b = c;
            break;
        case 4:
            r = x;
            g = 0;
            b = c;
            break;
        default:
            r = c;
            g = 0;
            b = x;
            break;
    }
    return [((r + m) * 255 + 0.5) | 0, ((g + m) * 255 + 0.5) | 0, ((b + m) * 255 + 0.5) | 0];
}
