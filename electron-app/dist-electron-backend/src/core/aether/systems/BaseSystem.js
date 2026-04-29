/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — BASE SYSTEM CONTRACT & AUDIO CONTEXT TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.3: El contrato y los tipos de contexto que todos los Systems
 * deben implementar.
 *
 * FILOSOFÍA:
 * Un System en nuestra arquitectura ECS es pura lógica de transformación:
 * recibe datos del mundo (audio, vibe, estado) y produce NodeIntents.
 * No guarda estado persistente de business logic — si necesita trackear
 * algo entre frames (ej. un envolvente), ese estado vive en el nodo mismo
 * (pre-allocated en ICapabilityNode.state o en los campos mutable del nodo).
 *
 * CONTRATO DEL FRAME LOOP (44 Hz):
 * ```
 * 1. Orchestrator llama  system.process(view, context, bus)
 * 2. System itera        view.forEach((node) => { ... })
 * 3. System escribe      bus.push(intent)  ← zero-alloc
 * 4. Orchestrator pasa   el bus al NodeArbiter
 * ```
 *
 * ZERO-ALLOC OBLIGATORIO:
 * El método `process()` no puede crear objetos en el heap.
 * Las subclases deben pre-alocar toda estructura en el constructor.
 *
 * @module core/aether/systems/BaseSystem
 * @version WAVE 3509.1 — GOD EAR SYNC (7-Band Alignment)
 */
// ═══════════════════════════════════════════════════════════════════════════
// BASE SYSTEM — Clase abstracta con utilidades compartidas
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Clase base abstracta para los Systems de Aether.
 *
 * Proporciona:
 * - Un intent pre-allocated reutilizable (zero-alloc hot path).
 * - Métodos de curva de transferencia como funciones puras estáticas.
 * - Helpers de mezcla de bandas de audio.
 * - Logging de telemetría sin overhead en producción.
 *
 * Los Systems concretos heredan de esta clase e implementan `process()`.
 *
 * PATRÓN DE USO:
 * ```ts
 * class MySystem extends BaseSystem<IImpactNodeData> implements IAetherSystem<IImpactNodeData> {
 *   process(view, context, bus) {
 *     view.forEach((node) => {
 *       // Reutiliza this._intentScratch — zero-alloc
 *       this._intentScratch.nodeId  = node.nodeId
 *       this._intentScratch.values['dimmer'] = computedValue
 *       bus.push(this._intentScratch as INodeIntent)
 *     })
 *   }
 * }
 * ```
 */
export class BaseSystem {
    constructor() {
        // Pre-allocar el objeto de values separado primero
        this._valuesDict = {};
        this._intentScratch = {
            nodeId: '',
            values: this._valuesDict,
            priority: 0,
            confidence: 1.0,
            source: '',
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // TRANSFER CURVES — Funciones puras, sin alloación
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Curva lineal: `output = input`.
     * Para valores donde la proporcionalidad directa tiene sentido (posición).
     */
    static applyLinear(input) {
        return input < 0 ? 0 : input > 1 ? 1 : input;
    }
    /**
     * Curva exponencial: `output = input ^ exponent`.
     * El "Snappy Attack" para dimmers de percusión.
     * Exponent 2.5 default = casi nada hasta 0.7, luego latigazo brutal.
     *
     * Con noiseGate: todo input < noiseGate → output = 0. Silencio absoluto.
     */
    static applyExponential(input, exponent = 2.5, noiseGate = 0) {
        if (input < noiseGate)
            return 0;
        const clamped = input < 0 ? 0 : input > 1 ? 1 : input;
        return Math.pow(clamped, exponent);
    }
    /**
     * Curva logarítmica: `output = log(1 + input * 9) / log(10)`.
     * Respuesta orgánica y suave para breath/ambient.
     * Sube rápido al principio, luego se va aplanando.
     */
    static applyLogarithmic(input) {
        const clamped = input < 0 ? 0 : input > 1 ? 1 : input;
        return Math.log(1 + clamped * 9) / Math.LN10;
    }
    /**
     * Curva S (Hermite cubic): `output = 3t² - 2t³`.
     * Arranque y final suaves. Ideal para fades cinematográficos.
     */
    static applySCurve(input) {
        const t = input < 0 ? 0 : input > 1 ? 1 : input;
        return t * t * (3 - 2 * t);
    }
    /**
     * Curva gamma: `output = input ^ (1 / gamma)`.
     * Corrección perceptual del ojo humano. Gamma 2.2 = estándar sRGB.
     */
    static applyGamma(input, gamma = 2.2) {
        const clamped = input < 0 ? 0 : input > 1 ? 1 : input;
        return Math.pow(clamped, 1 / gamma);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // BAND MIX — Mezcla ponderada de bandas de audio
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Calcula la energía mezclada para un nodo según sus BandMixWeights
     * y las métricas de audio del frame actual.
     *
     * Resultado normalizado: la suma de (banda * peso) no se normaliza
     * por la suma de pesos — el diseñador elige los pesos consciente de
     * que valores > 1 son posibles, y el clamp final lo gestiona.
     *
     * @returns Energía mezclada, clamped a [0, 1].
     */
    static computeBandMix(audio, weights) {
        const raw = audio.subBass * weights.subBass +
            audio.bass * weights.bass +
            audio.lowMid * weights.lowMid +
            audio.mid * weights.mid +
            audio.highMid * weights.highMid +
            audio.treble * weights.treble +
            audio.ultraAir * weights.ultraAir +
            audio.energy * weights.energy;
        return raw < 0 ? 0 : raw > 1 ? 1 : raw;
    }
    /**
     * Clamp rápido a [0, 1]. Función inline para el hot path.
     */
    static clamp01(v) {
        return v < 0 ? 0 : v > 1 ? 1 : v;
    }
    /**
     * Interpolación lineal entre a y b.
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
    /**
     * Convierte HSL (0-1 cada uno) a RGB (0-1 cada uno).
     * Función pura, sin alloc. Escribe directamente en el target.
     */
    static hslToRgb(h, s, l, out) {
        if (s === 0) {
            out.r = l;
            out.g = l;
            out.b = l;
            return;
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        out.r = BaseSystem._hueToRgb(p, q, h + 1 / 3);
        out.g = BaseSystem._hueToRgb(p, q, h);
        out.b = BaseSystem._hueToRgb(p, q, h - 1 / 3);
    }
    static _hueToRgb(p, q, t) {
        if (t < 0)
            t += 1;
        if (t > 1)
            t -= 1;
        if (t < 1 / 6)
            return p + (q - p) * 6 * t;
        if (t < 1 / 2)
            return q;
        if (t < 2 / 3)
            return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }
}
