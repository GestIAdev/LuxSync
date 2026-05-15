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
import { selectZoneFromResult, normalizeZoneId } from './zoneUtils';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
/** Prioridad L0 — base energética del motor líquido. NUNCA cambiar. */
const L0_PRIORITY = 0;
/** Source string para telemetría */
const SOURCE = 'liquid-aether-l0';
/** Radio máximo de influencia de la onda energética (metros). */
const DEFAULT_MAX_RADIUS_M = 12.0;
// ── WAVE 4752: Zonas donde el strobe está PROHIBIDO ─────────────────────────
// floor/ambient/air = zonas de luz base. El strobe debe reservarse para
// flash, front y movers. Cualquier zona no listada aquí permite strobe.
const STROBE_BLOCKED_ZONES = new Set([
    'floor',
    'ambient',
    'air',
]);
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INLINE
// ─────────────────────────────────────────────────────────────────────────────
/** Clamp inline [0, 1]. Sin alloc. */
function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
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
        // ── IMPACT scratch (WAVE 4687: dimmer-only L0 resurrection)
        this._impactValues = { dimmer: 0 };
        this._impactScratch = {
            nodeId: '',
            values: this._impactValues,
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
    ingest(_frame, result, bus) {
        this._photonTracerFrame++;
        // 🌊 WAVE 4689: UNIVERSAL INTENSITY ROUTING
        // IMPACT:
        // - con dimmer físico: publicar dimmer
        // - sin dimmer físico (RGB/W puro): publicar brightness virtual
        // COLOR:
        // - publicar brightness (atenuación nativa para cruce con color de Selene)
        const impactNodes = this._nodeGraph.getView(NodeFamily.IMPACT);
        impactNodes.forEach((node) => {
            const zoneIntensity = clamp01(selectZoneFromResult(result, node.zoneId ?? ''));
            if (zoneIntensity <= 0.005)
                return;
            const hasPhysicalDimmer = node.channels.some((ch) => ch.type === 'dimmer');
            // limpiar scratch previo (zero-alloc, anti-stale)
            this._impactValues['dimmer'] = undefined;
            this._impactValues['brightness'] = undefined;
            if (hasPhysicalDimmer) {
                this._impactValues['dimmer'] = zoneIntensity;
            }
            else {
                // Fallback universal para nodos sin dimmer físico.
                // `brightness` es la señal canónica de atenuación de color en Aether.
                this._impactValues['brightness'] = zoneIntensity;
                // Compat forward: si aparece soporte de dimmer virtual aguas abajo,
                // este valor ya viaja en el intent.
                this._impactValues['dimmer'] = zoneIntensity;
            }
            this._impactScratch.nodeId = node.nodeId;
            bus.push(this._impactScratch);
        });
        const colorNodes = this._nodeGraph.getView(NodeFamily.COLOR);
        colorNodes.forEach((node) => {
            const zoneIntensity = clamp01(selectZoneFromResult(result, node.zoneId ?? ''));
            if (zoneIntensity <= 0.005)
                return;
            this._colorValues['brightness'] = zoneIntensity;
            this._colorScratch.nodeId = node.nodeId;
            bus.push(this._colorScratch);
        });
        // WAVE 4817: Universal L0 — extensión a nodos KINETIC y ATMOSPHERE.
        // IMPACT y COLOR ya tienen loops dedicados arriba. Las familias restantes
        // se inspeccionan por duck-typing sobre node.channels:
        //   · canal 'dimmer' presente  → bus de impacto (_impactScratch)
        //   · canales RGB/W presentes  → bus de color   (_colorScratch)
        //   · solo rotation/speed/control → sin luz, se ignora
        // Esto corrige el caso Tungsteno donde nodos de zona ambient/air quedan
        // en familia KINETIC o ATMOSPHERE con dimmer/RGB y nunca reciben L0.
        const kineticNodes = this._nodeGraph.getView(NodeFamily.KINETIC);
        kineticNodes.forEach((node) => {
            const zoneIntensity = clamp01(selectZoneFromResult(result, node.zoneId ?? ''));
            if (zoneIntensity <= 0.005)
                return;
            const hasPhysicalDimmer = node.channels.some((ch) => ch.type === 'dimmer');
            const hasColorCh = node.channels.some((ch) => ch.type === 'red' || ch.type === 'green' || ch.type === 'blue' ||
                ch.type === 'white' || ch.type === 'amber' || ch.type === 'uv');
            if (hasPhysicalDimmer) {
                this._impactValues['dimmer'] = undefined;
                this._impactValues['brightness'] = undefined;
                this._impactValues['dimmer'] = zoneIntensity;
                this._impactScratch.nodeId = node.nodeId;
                bus.push(this._impactScratch);
            }
            else if (hasColorCh) {
                this._colorValues['brightness'] = undefined;
                this._colorValues['brightness'] = zoneIntensity;
                this._colorScratch.nodeId = node.nodeId;
                bus.push(this._colorScratch);
            }
            // Nodo puramente cinético (solo rotation/pan/tilt/speed): sin canal de luz → skip.
        });
        const atmosphereNodes = this._nodeGraph.getView(NodeFamily.ATMOSPHERE);
        atmosphereNodes.forEach((node) => {
            const zoneIntensity = clamp01(selectZoneFromResult(result, node.zoneId ?? ''));
            if (zoneIntensity <= 0.005)
                return;
            const hasPhysicalDimmer = node.channels.some((ch) => ch.type === 'dimmer');
            const hasColorCh = node.channels.some((ch) => ch.type === 'red' || ch.type === 'green' || ch.type === 'blue' ||
                ch.type === 'white' || ch.type === 'amber' || ch.type === 'uv');
            if (hasPhysicalDimmer) {
                this._impactValues['dimmer'] = undefined;
                this._impactValues['brightness'] = undefined;
                this._impactValues['dimmer'] = zoneIntensity;
                this._impactScratch.nodeId = node.nodeId;
                bus.push(this._impactScratch);
            }
            else if (hasColorCh) {
                this._colorValues['brightness'] = undefined;
                this._colorValues['brightness'] = zoneIntensity;
                this._colorScratch.nodeId = node.nodeId;
                bus.push(this._colorScratch);
            }
            // Máquinas de efecto puro (fog/haze/fan) sin dimmer/RGB: no reciben L0.
        });
        // WAVE 4752 F5: Strobe gating — solo rutar strobe si está activo.
        // _routeStrobeNodes filtra internamente por zona (floor/ambient/air = block).
        if (result.strobeActive) {
            this._routeStrobeNodes(result, bus);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SUBRUTAS DE ENRUTAMIENTO
    // ─────────────────────────────────────────────────────────────────────────
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
            // ── WAVE 4752 F5: Gating por zona ────────────────────────────
            // Zonas base (floor/ambient/air) reciben strobe=0 garantizado.
            // El strobe se reserva para flash, front, movers y zonas dinámicas.
            const zoneNormalized = normalizeZoneId(node.zoneId ?? '');
            if (STROBE_BLOCKED_ZONES.has(zoneNormalized))
                return;
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
     * final_brightness = clamp01(mood × zoneIntensity)
     */
    _routeMoodToColorIntensity(result, frame, bus) {
        const colorNodes = this._nodeGraph.getView(NodeFamily.COLOR);
        const moodIntensity = clamp01(frame.morphFactor * frame.recoveryFactor);
        colorNodes.forEach((node) => {
            // ── Zero-alloc stale cleanup ────────────────────────────
            this._colorValues['brightness'] = undefined;
            // ── Intensidad zonal — uniforme por zona semántica, sin falloff (F3) ────
            const zoneIntensity = selectZoneFromResult(result, node.zoneId);
            // ── Intent L0 — solo brightness, no tinte ─────────────────
            this._colorValues['brightness'] = clamp01(moodIntensity * zoneIntensity);
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
}
