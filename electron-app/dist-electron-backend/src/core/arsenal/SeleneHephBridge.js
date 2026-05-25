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
        // 🎨 WAVE 4812: hook para clips pixel-mapped.
        this._renderHook = null;
        // Telemetría
        this._hephRoutes = 0;
        this._legacyRoutes = 0;
        this._spatialSilenced = 0;
        // 🎨 WAVE 4812
        this._pixelmapRoutes = 0;
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
     * 🎨 WAVE 4812: Conecta el callback al `AetherCanvasManager`.
     * Si está null, los clips pixel-mapped degradan a `'legacy'` con
     * `reason='no-canvas-engine'` — útil en boot temprano.
     */
    setRenderHook(hook) {
        this._renderHook = hook;
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
        // 🎨 WAVE 4812: Discriminador vector vs pixel.
        // El default 'vector' garantiza retrocompat: clips pre-WAVE-4812
        // recorren exactamente la misma rama que antes.
        const domain = entry.executionDomain ?? 'vector';
        if (domain === 'pixel') {
            // Sin RenderHook → degradar a legacy, no pisar el flujo Hephaestus.
            if (!this._renderHook || !entry.pixelHints) {
                this._legacyRoutes++;
                return _LEGACY_NO_CANVAS_ENGINE;
            }
            const resolvedPx = _resolvePixelParams(entry, decision);
            let canvasId = null;
            try {
                canvasId = this._renderHook(resolvedPx, entry);
            }
            catch (err) {
                console.warn(`[SeleneArsenalBridge ⚠️] renderHook threw for "${decision.effectType}":`, err);
            }
            if (!canvasId) {
                this._legacyRoutes++;
                return _LEGACY_NO_CANVAS_ENGINE;
            }
            this._pixelmapRoutes++;
            return { kind: 'pixelmap', entry, resolved: resolvedPx, canvasId };
        }
        // domain === 'vector' o 'hybrid' (hybrid trata como vector aquí;
        // los canales pixel del híbrido los emite el caller en una segunda
        // pasada vía renderHook — ver blueprint §2.5).
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
            pixelmapRoutes: this._pixelmapRoutes,
        };
    }
    /** Reset de contadores (usar tras consume telemetry). */
    resetTelemetry() {
        this._hephRoutes = 0;
        this._legacyRoutes = 0;
        this._spatialSilenced = 0;
        this._pixelmapRoutes = 0;
    }
}
/**
 * 🎨 WAVE 4812 — Alias semántico.
 * El bridge enruta tres `kind`: 'hephaestus' (vectorial), 'pixelmap' (canvas)
 * y 'legacy' (fallback). Mantenemos `SeleneHephBridge` como nombre canónico
 * para no romper imports existentes; `SeleneArsenalBridge` documenta la
 * naturaleza multi-arsenal del componente.
 */
export const SeleneArsenalBridge = SeleneHephBridge;
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
/**
 * 🎨 WAVE 4812: Resuelve los parámetros de un clip pixel-mapped.
 * Pre-condición: `entry.executionDomain === 'pixel'` && `entry.pixelHints != null`.
 */
function _resolvePixelParams(entry, decision) {
    const intensity = entry.execHints.intensityScaling === 'fixed'
        ? 1.0
        : _clamp01(decision.intensity);
    // El caller garantiza pixelHints != null antes de llamar.
    return {
        effectId: entry.id,
        filePath: entry.filePath,
        intensity,
        durationMs: entry.durationMs,
        fixtureTargeting: entry.execHints.fixtureTargeting,
        pixelHints: entry.pixelHints,
    };
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
// 🎨 WAVE 4812
const _LEGACY_NO_CANVAS_ENGINE = Object.freeze({
    kind: 'legacy',
    reason: 'no-canvas-engine',
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
