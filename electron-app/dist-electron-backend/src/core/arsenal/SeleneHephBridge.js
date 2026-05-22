// ════════════════════════════════════════════════════════════════════════════
// 🏛️ WAVE 2482 — INFINITE ARSENAL · SELENE-HEPHAESTUS BRIDGE
// ════════════════════════════════════════════════════════════════════════════
//  Pieza central de enrutamiento dual-path entre Selene IA y Hephaestus.
//
//  FLUJO:
//    Selene DecisionMaker → ConsciousnessEffectDecision { effectType, ... }
//      ↓
//    SeleneHephBridge.route(decision, context)
//      ├─ HIT  → DynamicEffectRegistry encuentra `.lfx` v2.1 compatible.
//      │         Spatial filter: si spatialBehavior='absolute' Y hay IK
//      │         target activo, silenciamos pan/tilt del clip pero
//      │         dejamos pasar dimmer/color (BridgeRoute.silenceSpatial).
//      │         Invoca el `playHook` (HephaestusRuntime.play) si existe.
//      │         → { kind: 'hephaestus', entry, resolved }
//      │
//      └─ MISS → Sin entry o no eligible. NO toca pipeline legacy.
//                → { kind: 'legacy' }
//                El caller (selene-aether-adapter) continúa como hoy:
//                EffectManager.triggerEffect() / dream simulator.
//
//  REGLA DE ORO (WAVE 2482):
//    - El bridge nunca llama directamente a EffectDreamSimulator ni a
//      EffectManager. Solo decide si el efecto va por Hephaestus o no.
//    - Si retorna { kind:'legacy' } el caller hace EXACTAMENTE lo que
//      hacía antes — retrocompatibilidad estricta.
//    - El bridge no toca el NodeArbiter directamente; la inyección a L3+
//      la realiza HephaestusAetherAdapter ya existente, alimentado por
//      los outputs que HephaestusRuntime.tick() produce tras play().
// ════════════════════════════════════════════════════════════════════════════
import { getDynamicEffectRegistry, } from './DynamicEffectRegistry';
// ─── BRIDGE ─────────────────────────────────────────────────────────────────
export class SeleneHephBridge {
    constructor(registry) {
        this._playHook = null;
        // Telemetría
        this._hephRoutes = 0;
        this._legacyRoutes = 0;
        this._spatialSilenced = 0;
        this._registry = registry ?? getDynamicEffectRegistry();
    }
    /**
     * Conecta el callback real al HephaestusRuntime.
     * En Fase 0/1 (plumbing) este hook puede no estar conectado; el bridge
     * igualmente decide correctamente y devuelve los `resolved` params.
     */
    setPlayHook(hook) {
        this._playHook = hook;
    }
    /**
     * Punto de entrada principal del enrutamiento.
     *
     * @returns BridgeRoute — el caller actúa según `kind`.
     */
    route(decision, context) {
        const entry = this._registry.getEntry(decision.effectType);
        if (!entry) {
            this._legacyRoutes++;
            return _LEGACY_NO_ENTRY;
        }
        // Spatial compatibility check.
        const silenceSpatial = _shouldSilenceSpatial(entry.spatialBehavior, context);
        if (silenceSpatial && entry.spatialBehavior === 'absolute') {
            // Política WAVE 2482: si el clip es ABSOLUTO y hay IK activo,
            // NO lo silenciamos completo — dejamos pasar dimmer/color pero
            // bloqueamos pan/tilt. La decisión final de qué hacer con
            // pan/tilt vive en el HephaestusAetherAdapter (Fase 2).
            this._spatialSilenced++;
        }
        // 'spatial' es futuro — todavía no hay IK ingress de clips.
        if (entry.spatialBehavior === 'spatial') {
            this._legacyRoutes++;
            return _LEGACY_SPATIAL_INCOMPATIBLE;
        }
        const resolved = _resolvePlayParams(entry, decision, silenceSpatial);
        let instanceId = -1;
        if (this._playHook) {
            try {
                instanceId = this._playHook(resolved, entry);
            }
            catch (err) {
                console.warn(`[SeleneHephBridge ⚠️] playHook threw for "${decision.effectType}":`, err);
            }
        }
        this._hephRoutes++;
        return { kind: 'hephaestus', entry, resolved, instanceId };
    }
    /**
     * Consulta rápida: ¿este effectType es enrutable por Hephaestus?
     * Útil para que el caller decida ANTES de armar la decision.
     */
    canRoute(effectType) {
        return this._registry.has(effectType);
    }
    /** Telemetría acumulada (lectura no destructiva). */
    getTelemetry() {
        return {
            hephRoutes: this._hephRoutes,
            legacyRoutes: this._legacyRoutes,
            spatialSilenced: this._spatialSilenced,
        };
    }
    /** Reset de contadores (usar tras consume telemetry). */
    resetTelemetry() {
        this._hephRoutes = 0;
        this._legacyRoutes = 0;
        this._spatialSilenced = 0;
    }
}
// ─── HELPERS ────────────────────────────────────────────────────────────────
function _shouldSilenceSpatial(behavior, ctx) {
    if (behavior !== 'absolute')
        return false;
    const ik = ctx.ikActiveNodeIds;
    return ik != null && ik.size > 0;
}
function _resolvePlayParams(entry, decision, silenceSpatial) {
    // Intensity scaling: 'fixed' ignora la intensity de Selene.
    const intensity = entry.execHints.intensityScaling === 'fixed'
        ? 1.0
        : _clamp01(decision.intensity);
    return {
        effectId: entry.id,
        filePath: entry.filePath,
        intensity,
        durationMs: entry.durationMs,
        fixtureTargeting: entry.execHints.fixtureTargeting,
        overlayMode: entry.execHints.overlayMode,
        intensityScaling: entry.execHints.intensityScaling,
        silenceSpatial,
    };
}
function _clamp01(n) {
    if (!Number.isFinite(n))
        return 0;
    if (n < 0)
        return 0;
    if (n > 1)
        return 1;
    return n;
}
// ─── ROUTE LITERALS pre-congelados (zero-alloc misses) ──────────────────────
const _LEGACY_NO_ENTRY = Object.freeze({
    kind: 'legacy',
    reason: 'no-entry',
});
const _LEGACY_SPATIAL_INCOMPATIBLE = Object.freeze({
    kind: 'legacy',
    reason: 'spatial-incompatible',
});
// ─── SINGLETON ──────────────────────────────────────────────────────────────
let _instance = null;
/** Acceso al singleton compartido. */
export function getSeleneHephBridge() {
    if (_instance == null)
        _instance = new SeleneHephBridge();
    return _instance;
}
/** SOLO para tests: resetea el singleton. */
export function __resetSeleneHephBridgeForTests() {
    _instance = null;
}
