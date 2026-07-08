/**
 * SELENE V3 — LIQUID COGNITION
 * WAVE 7003.2 (Lote 2/3: Fusión e Ignición)
 *
 * Cámara de Ignición — Squelch adaptativo Q(t) + predicado único + intensidad.
 * Reemplaza la jerarquía de 13 pasos de V2 con un solo umbral que respira.
 *
 * Blueprint: SELENE_V3_LIQUID_COGNITION_BLUEPRINT.md §7
 */
// ═══════════════════════════════════════════════════════════════════════════
// Engine — zero-alloc, determinístico
// ═══════════════════════════════════════════════════════════════════════════
export class IgnitionChamber {
    constructor(profile) {
        this.profile = profile;
        // Snapshot pre-asignado — reutilizado entre llamadas
        this._verdict = {
            ignite: false,
            squelch: 0,
            confidence: 0,
            intensity: 0,
            excessRatio: 0,
        };
        this._v = this._verdict;
    }
    /**
     * Evalúa el predicado de ignición y computa la intensidad materializada.
     *
     * Q(t) = Q_base · (1 + κ_T · T̂) · (1 − κ_V · V)
     * ignite ⟺ C ≥ Q
     * I_fx = I_min + (1 − I_min) · tanh(κ_i · (C−Q)/Q) + κ_vb · V
     *
     * Hot path 44Hz — sin allocs, sin branches de género.
     *
     * @returns IgnitionVerdict pre-asignado (no retener referencia)
     */
    evaluate(input) {
        const p = this.profile;
        // ── Tensión normalizada T̂ = (T − T_min) / (T_max − T_min) ──
        const tRange = p.T_max - p.T_min;
        const tHat = tRange > 0.001
            ? (input.tension - p.T_min) / tRange
            : 0;
        const tHatClamped = tHat < 0 ? 0 : tHat > 1 ? 1 : tHat;
        // ── Squelch adaptativo Q(t) ──
        // Q = Q_base · (1 + κ_T · T̂) · (1 − κ_V · V)
        const squelch = p.Q_base * (1 + p.kappa_T * tHatClamped) * (1 - p.kappa_V * input.vaporPressure);
        // ── Predicado único ──
        const ignite = input.confidence >= squelch;
        // ── Exceso de ruptura ──
        const excessRatio = squelch > 0.001
            ? (input.confidence - squelch) / squelch
            : 0;
        // ── Intensidad materializada ──
        // I_fx = I_min + (1 − I_min) · tanh(κ_i · (C−Q)/Q) + κ_vb · V
        // Solo tiene sentido materializar si ignite es true, pero computamos
        // sin branch — tanh de valor negativo da resultado negativo que se
        // clampea a I_min naturalmente.
        const tanhTerm = Math.tanh(p.kappa_i * excessRatio);
        let intensity = p.I_min + (1 - p.I_min) * tanhTerm + p.kappa_vb * input.vaporPressure;
        // Clamp a [I_min, 1.0]
        intensity = intensity < p.I_min ? p.I_min : intensity > 1 ? 1 : intensity;
        // ── Si no ignite, intensidad = 0 (no hay efecto) ──
        // Esto es el único booleano que afecta el output — es el predicado mismo.
        const finalIntensity = ignite ? intensity : 0;
        // ── Escribir snapshot pre-asignado ──
        this._v.ignite = ignite;
        this._v.squelch = squelch;
        this._v.confidence = input.confidence;
        this._v.intensity = finalIntensity;
        this._v.excessRatio = excessRatio;
        return this._verdict;
    }
    reset() {
        this._v.ignite = false;
        this._v.squelch = 0;
        this._v.confidence = 0;
        this._v.intensity = 0;
        this._v.excessRatio = 0;
    }
}
