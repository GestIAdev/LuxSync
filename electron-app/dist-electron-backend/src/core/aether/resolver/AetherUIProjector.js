/**
 * ⚛️ WAVE 3513.3: THE MIRROR — AetherUIProjector
 *
 * Proyecta el estado resuelto del NodeGraph Aether de vuelta
 * al array legacy de FixtureState[], permitiendo que Hyperion
 * visualice los fixtures controlados por Aether sin romper el pipeline.
 *
 * ARQUITECTURA:
 *   Aether Matrix (NodeGraph con ICapabilityNodes actualizados)
 *     → AetherUIProjector.project()
 *       → Mutación in-place de FixtureState (cero new Object())
 *         → Hyperion / HotFrame UI
 *
 * REGLA DE ORO:
 *   Solo sobreescribe un FixtureState si su universo está "claimed" por
 *   Aether (aetherConfig.ownsUniverse). Los universos legacy no se tocan.
 *
 * INVARIANTES:
 * - Zero-alloc en hot path: muta in-place, no crea objetos.
 * - No escribe a campos readonly (physicalPan, physicalTilt).
 * - No bloquea el frame si el device no tiene nodos de cierta familia.
 * - Los valores Aether son 0-1 normalizados → se escalan a 0-255 al escribir.
 *
 * @module core/aether/resolver/AetherUIProjector
 */
import { NodeFamily } from '../types';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTE DE ESCALA — Aether 0-1 → DMX 0-255
// ─────────────────────────────────────────────────────────────────────────────
const TO_DMX = 255;
/**
 * AetherUIProjector — Espejo de la Aether Matrix al estado visual legacy.
 *
 * INSTANCIA UNA SOLA VEZ en TitanOrchestrator (patch time).
 * Llamar project() en cada frame, antes del broadcast a Hyperion.
 *
 * No tiene estado interno mutable. Es una clase por coherencia
 * arquitectónica con el resto del pipeline Aether (Strategy pattern).
 */
export class AetherUIProjector {
    /**
     * Proyecta el estado actual del NodeGraph Aether sobre el array
     * de FixtureState[], mutando los objetos in-place.
     *
     * Solo modifica fixtures cuyos universos estén reclamados por Aether.
     * Para el resto, es un no-op O(n) donde n = fixtures.length.
     *
     * @param graph        — NodeGraph con nodos actualizados por los Systems
     * @param fixtures     — Array de FixtureState del pipeline HAL legacy (se muta in-place)
     * @param config       — AetherConfig singleton para verificar ownership de universos
     */
    project(graph, fixtures, config) {
        for (let i = 0; i < fixtures.length; i++) {
            const fixture = fixtures[i];
            // REGLA DE ORO: universo legacy (ArtNet 0-based) → verificar en Aether (1-based)
            // _ingestAetherDevices registra los universos sumando +1, por lo que
            // el check correcto es: config.ownsUniverse(fixture.universe + 1)
            if (!config.ownsUniverse(fixture.universe + 1))
                continue;
            // El device Aether tiene el mismo ID que el fixture legacy (fixtureId ?? name)
            const deviceId = (fixture.fixtureId ?? fixture.name);
            const nodeIds = graph.getDeviceNodes(deviceId);
            if (nodeIds.length === 0)
                continue;
            // Iterar sobre los nodos del device y proyectar cada familia
            for (let j = 0; j < nodeIds.length; j++) {
                const nodeData = graph.getNodeData(nodeIds[j]);
                if (!nodeData)
                    continue;
                switch (nodeData.family) {
                    // ───────────────────────────────────────────────────────────────────
                    // COLOR NODE → r, g, b + dimmer via IImpactNode
                    //
                    // currentColor es mutable in-place (lo actualiza el ColorSystem).
                    // Se escala de 0-1 a 0-255 en el momento de proyectar.
                    // ───────────────────────────────────────────────────────────────────
                    case NodeFamily.COLOR: {
                        const { currentColor } = nodeData;
                        fixture.r = (currentColor.r * TO_DMX + 0.5) | 0;
                        fixture.g = (currentColor.g * TO_DMX + 0.5) | 0;
                        fixture.b = (currentColor.b * TO_DMX + 0.5) | 0;
                        break;
                    }
                    // ───────────────────────────────────────────────────────────────────
                    // IMPACT NODE → dimmer
                    //
                    // envelopeState.currentLevel es el valor post-decay (0-1).
                    // Representa la intensidad actual del envolvente reactivo al audio.
                    // ───────────────────────────────────────────────────────────────────
                    case NodeFamily.IMPACT: {
                        const level = nodeData.envelopeState.current;
                        fixture.dimmer = (level * TO_DMX + 0.5) | 0;
                        break;
                    }
                    // ───────────────────────────────────────────────────────────────────
                    // KINETIC NODE → pan, tilt (posición TARGET del motor)
                    //
                    // currentPosition es mutable in-place (actualizado por el physics layer).
                    // Valores normalizados 0-1 → 0-255 DMX target.
                    // NO se escribe a physicalPan/physicalTilt (son del FixturePhysicsDriver,
                    // WAVE 2085: readonly — solo HAL los escribe).
                    // ───────────────────────────────────────────────────────────────────
                    case NodeFamily.KINETIC: {
                        const { currentPosition } = nodeData;
                        fixture.pan = (currentPosition.pan * TO_DMX + 0.5) | 0;
                        fixture.tilt = (currentPosition.tilt * TO_DMX + 0.5) | 0;
                        break;
                    }
                    // ───────────────────────────────────────────────────────────────────
                    // BEAM NODE → gobo, zoom, focus, prism
                    //
                    // Los valores de beam viven en phantomChannels del nodo.
                    // El defaultValue del canal se usa si el ICapabilityNode no tiene
                    // estado runtime mutable para beam (no hay currentBeam field).
                    // Aquí proyectamos lo que el ArbitratedNodeMap resolvió,
                    // que el NodeResolver ya escribió en sus Uint8Array.
                    // Para UI, usamos los defaultValues del canal como proxy.
                    // ───────────────────────────────────────────────────────────────────
                    case NodeFamily.BEAM: {
                        // Los valores de zoom/focus/gobo/prism resueltos por el Arbiter
                        // no tienen cache en el nodo (el nodo solo guarda capacidades).
                        // El proyector de BEAM se alimentará del ArbitratedNodeMap en una
                        // revisión futura cuando los Systems actualicen el nodo con
                        // su estado runtime. Por ahora es un no-op explícito.
                        // WAVE 3513.3: Beam projection pending System integration (WAVE 3514+).
                        break;
                    }
                    // ───────────────────────────────────────────────────────────────────
                    // ATMOSPHERE NODE → no tiene representación en FixtureState UI.
                    // Los dispositivos atmosféricos (máquinas de humo, confeti)
                    // no tienen posición ni color en Hyperion. Skip.
                    // ───────────────────────────────────────────────────────────────────
                    case NodeFamily.ATMOSPHERE: {
                        break;
                    }
                }
            }
        }
    }
}
