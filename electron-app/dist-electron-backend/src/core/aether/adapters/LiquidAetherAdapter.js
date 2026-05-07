/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — LIQUID AETHER ADAPTER (Capa L0)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4521.2: THE LIQUID-AETHER BRIDGE
 *
 * Adaptador que consume ProcessedFrame + LiquidStereoResult de
 * LiquidEngineBase y los traduce a INodeIntent[] en la Capa L0
 * (priority = 0) del IIntentBus.
 *
 * PUNTO DE INTEGRACIÓN ÚNICO:
 * Esta clase es la única interfaz entre el motor líquido legacy y la
 * Aether Matrix. Ningún otro archivo dentro de aether/ debe importar
 * ProcessedFrame.
 *
 * RESPONSABILIDADES:
 *   1. _routeImpactNodes   → dimmer por zona para IMPACT nodes
 *   2. _routeStrobeNodes   → shutter + strobeRate para IMPACT con shutter
 *   3. _routeMoodToColorIntensity → brightness (no RGB) para COLOR nodes
 *
 * INVARIANTES:
 *   - L0 es base, no override. priority = 0 siempre.
 *   - Zero allocations en hot path (objetos pre-allocated en constructor).
 *   - Sin estado de sesión: la física temporal vive en LiquidEngineBase.
 *   - Solo escribe en el bus. Nunca lee del bus.
 *   - No importa nada de la capa Legacy (HAL, renderFromTarget, TitanEngine).
 *
 * FRECUENCIA: 44 Hz (cada ~22ms), sincronizado con el pipeline GodEar.
 *
 * @module core/aether/adapters/LiquidAetherAdapter
 * @version WAVE 4521.2
 */
import { NodeFamily } from '../types';
import { selectZoneFromResult, computeEpicenterFalloff } from './zoneUtils';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
/** Prioridad L0 — base energética del motor líquido. NUNCA cambiar. */
const L0_PRIORITY = 0;
/** Source string para telemetría */
const SOURCE = 'liquid-aether-l0';
const PHOTON_TRACER_EVERY_FRAMES = 20;
/** Radio máximo de influencia de la onda energética (metros). */
const DEFAULT_MAX_RADIUS_M = 12.0;
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INLINE
// ─────────────────────────────────────────────────────────────────────────────
/** Clamp inline [0, 1]. Sin alloc. */
function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
function average9Zones(result) {
    const avg = (result.frontLeftIntensity +
        result.frontRightIntensity +
        result.backLeftIntensity +
        result.backRightIntensity +
        result.moverLeftIntensity +
        result.moverRightIntensity +
        result.floorIntensity +
        result.ambientIntensity +
        result.airIntensity) / 9;
    return clamp01(avg);
}
// ─────────────────────────────────────────────────────────────────────────────
// LIQUID AETHER ADAPTER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * LiquidAetherAdapter — Puente L0 entre LiquidEngineBase y la Aether Matrix.
 *
 * NO es un IAetherSystem (no consume FrameContext ni implementa process()).
 * Es un Adaptador de Capa: consume ProcessedFrame + LiquidStereoResult
 * directamente y los traduce a INodeIntent[] para el IIntentBus.
 *
 * Uso:
 * ```ts
 * // En TitanOrchestrator.processFrame(), después de applyBands():
 * this._liquidAetherAdapter.ingest(frame, result, bus)
 * ```
 */
export class LiquidAetherAdapter {
    constructor(_nodeGraph, epicenter = { x: 0, y: 0, z: 0 }, maxRadiusM = DEFAULT_MAX_RADIUS_M) {
        this._nodeGraph = _nodeGraph;
        this.name = 'LiquidAetherAdapter';
        this._photonTracerFrame = 0;
        this._epicenter = { x: epicenter.x, y: epicenter.y, z: epicenter.z };
        this._maxRadiusM = maxRadiusM;
        // ── IMPACT scratch
        this._impactValues = { dimmer: 0 };
        this._impactScratch = {
            nodeId: '',
            values: this._impactValues,
            priority: L0_PRIORITY,
            confidence: 1.0,
            source: SOURCE,
        };
        // ── STROBE scratch
        this._strobeValues = { shutter: 0, strobeRate: 0 };
        this._strobeScratch = {
            nodeId: '',
            values: this._strobeValues,
            priority: L0_PRIORITY,
            confidence: 1.0,
            source: SOURCE,
        };
        // ── COLOR scratch
        this._colorValues = { brightness: 0 };
        this._colorScratch = {
            nodeId: '',
            values: this._colorValues,
            priority: L0_PRIORITY,
            confidence: 1.0,
            source: SOURCE,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // HOT PATH — 44 Hz
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Punto de entrada principal del adaptador.
     *
     * Llamar una vez por frame, después de que LiquidEngineBase.applyBands()
     * produzca el ProcessedFrame y el motor hijo produzca el LiquidStereoResult.
     *
     * Contrato:
     * - Solo escribe en el bus. No lee del bus.
     * - Zero allocations en hot path.
     * - Todos los intents tienen priority = 0 (L0).
     *
     * @param frame  - ProcessedFrame emitido por LiquidEngineBase.applyBands()
     * @param result - LiquidStereoResult con las 9 intensidades zonales
     * @param bus    - IIntentBus donde inyectar los intents L0
     */
    ingest(frame, result, bus) {
        this._photonTracerFrame++;
        // 1. Intensidades de dimmer para todos los IMPACT nodes por zona
        this._routeImpactNodes(result, bus);
        // 2. Señal de strobe — solo si está activa en el frame
        if (result.strobeActive) {
            this._routeStrobeNodes(result, bus);
        }
        // 3. Intensidad de mood para COLOR nodes (brightness, sin tocar RGB)
        this._routeMoodToColorIntensity(result, frame, bus);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SUBRUTAS DE ENRUTAMIENTO
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Enruta las intensidades zonales al canal `dimmer` de todos los
     * IMPACT nodes.
     *
     * Por cada nodo:
     *   1. Selecciona la intensidad de su zona mediante selectZoneFromResult
     *      usando el zoneId semántico del nodo.
     *   2. Aplica falloff por distancia al epicentro.
     *   3. Empuja el intent L0 al bus.
     */
    _routeImpactNodes(result, bus) {
        const impactNodes = this._nodeGraph.getView(NodeFamily.IMPACT);
        const epicenter = this._epicenter;
        const maxR = this._maxRadiusM;
        impactNodes.forEach((node, index) => {
            // ── Zero-alloc stale cleanup ──────────────────────────────────
            this._impactValues['dimmer'] = undefined;
            // ── Intensidad zonal por zoneId semántico del nodo ────────────
            const zoneIntensity = this._selectReactiveZoneIntensity(result, node.zoneId);
            // ── Falloff por distancia al epicentro de la onda ─────────────
            const falloff = computeEpicenterFalloff(node, epicenter, maxR);
            // ── Intent L0 ─────────────────────────────────────────────────
            this._impactValues['dimmer'] = clamp01(zoneIntensity * falloff);
            this._impactScratch.nodeId = node.nodeId;
            if (index === 0 && this._photonTracerFrame % PHOTON_TRACER_EVERY_FRAMES === 0) {
                const dmx = Math.round(this._impactValues['dimmer'] * 255);
                console.log(`[TRACER-1 INGEST] Fixture 0 -> Liquid Dimmer: ${dmx}`);
            }
            bus.push(this._impactScratch);
        });
    }
    /**
     * Enruta la señal de strobe a los IMPACT nodes que poseen canal `shutter`.
     *
     * Solo se llama cuando result.strobeActive === true.
     * Escribe `shutter = 1.0` y `strobeRate = result.strobeIntensity`.
     *
     * La presencia del canal shutter se determina verificando si
     * algún canal del nodo tiene type === 'shutter'.
     */
    _routeStrobeNodes(result, bus) {
        const impactNodes = this._nodeGraph.getView(NodeFamily.IMPACT);
        const strobeIntensity = result.strobeIntensity;
        impactNodes.forEach((node) => {
            // ── Verificar capacidad de shutter ────────────────────────────
            const hasShutter = node.channels.some((ch) => ch.type === 'shutter');
            if (!hasShutter)
                return;
            // ── Zero-alloc stale cleanup ──────────────────────────────────
            this._strobeValues['shutter'] = undefined;
            this._strobeValues['strobeRate'] = undefined;
            // ── Intent L0 — strobe binario modulado por intensidad ─────────
            this._strobeValues['shutter'] = 1.0; // abre el obturador
            this._strobeValues['strobeRate'] = strobeIntensity; // 0-1 normalizado
            this._strobeScratch.nodeId = node.nodeId;
            bus.push(this._strobeScratch);
        });
    }
    /**
     * Inyecta la intensidad de "mood" al canal `brightness` de todos los
     * COLOR nodes.
     *
     * NO escribe RGB (eso es responsabilidad exclusiva de ColorAdapter en L1).
     * Solo el canal `brightness` — el NodeArbiter usa MergeStrategy.MULTIPLY
     * para combinarlo con el color de ColorAdapter.
     *
     * mood = clamp01(morphFactor × recoveryFactor)
     * final_brightness = clamp01(mood × zoneIntensity × falloff)
     */
    _routeMoodToColorIntensity(result, frame, bus) {
        const colorNodes = this._nodeGraph.getView(NodeFamily.COLOR);
        const moodIntensity = clamp01(frame.morphFactor * frame.recoveryFactor);
        const epicenter = this._epicenter;
        const maxR = this._maxRadiusM;
        colorNodes.forEach((node) => {
            // ── Zero-alloc stale cleanup ──────────────────────────────────
            this._colorValues['brightness'] = undefined;
            // ── Intensidad zonal + falloff ────────────────────────────────
            const zoneIntensity = this._selectReactiveZoneIntensity(result, node.zoneId);
            const falloff = computeEpicenterFalloff(node, epicenter, maxR);
            // ── Intent L0 — solo brightness, no tinte ─────────────────────
            this._colorValues['brightness'] = clamp01(moodIntensity * zoneIntensity * falloff);
            this._colorScratch.nodeId = node.nodeId;
            bus.push(this._colorScratch);
        });
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PATCH-TIME API
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Actualiza la posición del epicentro de onda.
     *
     * SOLO llamar en patch-time o en reacción a eventos de sección musical
     * (drop, breakdown). NUNCA desde el hot-path de 44Hz.
     *
     * @param x - Posición X en metros (derecha positiva)
     * @param y - Posición Y en metros (altura positiva)
     * @param z - Posición Z en metros (frente positivo)
     */
    setEpicenter(x, y, z) {
        this._epicenter.x = x;
        this._epicenter.y = y;
        this._epicenter.z = z;
    }
    _selectReactiveZoneIntensity(result, zoneId) {
        switch ((zoneId || '').toLowerCase()) {
            case 'unassigned':
            case 'center':
            case 'mid':
                return average9Zones(result);
            case 'front':
                return clamp01((result.frontLeftIntensity + result.frontRightIntensity) * 0.5);
            case 'back':
                return clamp01((result.backLeftIntensity + result.backRightIntensity) * 0.5);
            case 'left':
                return clamp01((result.frontLeftIntensity + result.backLeftIntensity + result.moverLeftIntensity) / 3);
            case 'right':
                return clamp01((result.frontRightIntensity + result.backRightIntensity + result.moverRightIntensity) / 3);
            case 'movers-left':
                return result.moverLeftIntensity;
            case 'movers-right':
                return result.moverRightIntensity;
            default:
                return selectZoneFromResult(result, zoneId);
        }
    }
}
