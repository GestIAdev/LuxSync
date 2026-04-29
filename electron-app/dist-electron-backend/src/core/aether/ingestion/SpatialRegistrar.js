/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌍 AETHER MATRIX — SPATIAL REGISTRAR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3507: THE SPATIAL GENESIS (F1)
 *
 * Cruza los ICapabilityNodes extraídos por el NodeExtractionPipeline
 * con la posición 3D real del fixture en el Stagebuilder, asigna
 * Position3D a cada nodo y registra el IDeviceDefinition enriquecido
 * en el TitanOrchestrator.
 *
 * ARQUITECTURA DE POSICIONAMIENTO:
 *   - Fixture single-emitter: el nodo hereda directamente la posición
 *     del fixture (x, y, z en metros reales del escenario).
 *   - Fixture multi-emitter (fan RGBW con N pétalos):
 *     * El nodo COLOR/IMPACT de cada pétalo recibe un offset radial
 *       respecto al centro del aparato.
 *     * Radio default: 0.15m (15cm), configurable vía options.
 *     * Distribución uniforme en 360° a partir del ángulo base.
 *   - Nodo KINETIC: hereda la posición central (el motor está en el eje).
 *   - Nodo BEAM/ATMOSPHERE: hereda la posición central.
 *
 * CICLO DE VIDA:
 *   1. UI añade fixture al Stage (StageConstructor / StageGrid3D).
 *   2. Se llama SpatialRegistrar.register() con FixtureV2 + IDeviceDefinition.
 *   3. SpatialRegistrar enriquece nodes[] con Position3D.
 *   4. SpatialRegistrar llama orchestrator.registerAetherDevice(enrichedDef).
 *   5. TitanOrchestrator → NodeGraph.registerDevice() → nodos en Aether.
 *
 * INVARIANTES:
 * - No muta la IDeviceDefinition de entrada.
 * - Solo ejecuta en patch time — NUNCA en el hot path (44Hz).
 * - La posición se expresa en metros (coordenadas del escenario).
 *   x: izquierda(-)/derecha(+), y: altura, z: profundidad escenario.
 *
 * @module core/aether/ingestion/SpatialRegistrar
 * @version WAVE 3507
 */
import { NodeFamily } from '../types';
const DEFAULT_PETAL_RADIUS_M = 0.15;
const DEFAULT_PETAL_BASE_DEG = 90;
// ═══════════════════════════════════════════════════════════════════════════
// SPATIAL REGISTRAR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Enriquece un IDeviceDefinition con posiciones 3D reales y lo registra
 * en el motor Aether a través del IAetherRegistrationTarget.
 *
 * Instanciar una vez y reutilizar — no tiene estado mutable.
 */
export class SpatialRegistrar {
    constructor(options = {}) {
        this._petalRadiusM = options.petalRadiusM ?? DEFAULT_PETAL_RADIUS_M;
        this._petalBaseAngleDeg = options.petalBaseAngleDeg ?? DEFAULT_PETAL_BASE_DEG;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Asigna posiciones 3D a los nodos del Device y lo registra en Aether.
     *
     * @param deviceDef       — IDeviceDefinition producida por NodeExtractionPipeline.
     *                          No se muta.
     * @param stagePosition   — Posición 3D real del fixture en el Stagebuilder (metros).
     * @param target          — Orquestador donde se registra el Device final.
     */
    register(deviceDef, stagePosition, target) {
        const enriched = this._enrichWithSpatialData(deviceDef, stagePosition);
        target.registerAetherDevice(enriched);
    }
    /**
     * Desregistra un Device del motor Aether.
     * Wrapper semántico para mantener la simetría con register().
     */
    unregister(deviceId, target) {
        target.unregisterAetherDevice(deviceId);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SPATIAL ENRICHMENT
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Construye un nuevo IDeviceDefinition con todos los nodos enriquecidos
     * con su posición 3D real. No muta el original.
     */
    _enrichWithSpatialData(deviceDef, stagePosition) {
        const center = {
            x: stagePosition.x,
            y: stagePosition.y,
            z: stagePosition.z,
        };
        // Contar cuántos nodos COLOR hay para calcular offsets de pétalos
        const colorNodeCount = deviceDef.nodes.filter(n => n.family === NodeFamily.COLOR).length;
        const isMultiEmitter = colorNodeCount > 1;
        // Calcular posiciones de pétalos si hay más de un emitter COLOR
        const petalPositions = isMultiEmitter
            ? this._calculatePetalPositions(center, colorNodeCount)
            : [];
        let petalCursor = 0;
        const enrichedNodes = deviceDef.nodes.map(node => {
            if (node.family === NodeFamily.COLOR && isMultiEmitter) {
                // Cada nodo COLOR de un multi-emitter recibe su posición de pétalo
                const pos = petalPositions[petalCursor++] ?? center;
                return this._cloneNodeWithPosition(node, pos);
            }
            // KINETIC, BEAM, IMPACT, ATMOSPHERE: posición central del aparato
            return this._cloneNodeWithPosition(node, center);
        });
        return {
            ...deviceDef,
            nodes: Object.freeze(enrichedNodes),
        };
    }
    /**
     * Calcula las posiciones de los pétalos distribuidas radialmente en el
     * plano XZ (horizontal) a partir del centro del aparato.
     *
     * XZ porque los aparatos típicamente están montados en altura y sus
     * pétalos apuntan hacia el escenario en distintas direcciones horizontales.
     *
     * @param center — Centro del aparato en metros.
     * @param count  — Número de pétalos.
     */
    _calculatePetalPositions(center, count) {
        const positions = [];
        const angleStep = 360 / count;
        const baseRad = (this._petalBaseAngleDeg * Math.PI) / 180;
        for (let i = 0; i < count; i++) {
            const angleDeg = this._petalBaseAngleDeg + angleStep * i;
            const angleRad = (angleDeg * Math.PI) / 180;
            positions.push({
                x: center.x + this._petalRadiusM * Math.cos(angleRad - baseRad + Math.PI / 2),
                y: center.y,
                z: center.z + this._petalRadiusM * Math.sin(angleRad - baseRad + Math.PI / 2),
            });
        }
        return positions;
    }
    /**
     * Crea una copia inmutable del nodo con la posición 3D asignada.
     * Object spread es seguro aquí porque ICapabilityNode es readonly-by-contract.
     */
    _cloneNodeWithPosition(node, position) {
        return { ...node, position };
    }
}
