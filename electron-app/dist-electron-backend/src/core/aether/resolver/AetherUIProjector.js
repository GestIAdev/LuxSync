/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 AETHER UI PROJECTOR — Agnostic Ready (WAVE 3513.3.2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RESPONSABILIDAD:
 * Proyectar el estado interno del NodeGraph (capacidades) sobre el array
 * legacy FixtureState[] para que la UI, el preview y los monitores
 * sigan funcionando sin saber que existe Aether.
 *
 * FILOSOFÍA:
 * Este es un ADAPTADOR DE LECTURA. No escribe al pipeline DMX real.
 * Itera los fixtures legacy, consulta sus nodos en el NodeGraph,
 * y copia los valores agnósticos (0-1 normalizados) al formato legacy (0-255).
 *
 * REGLAS:
 * - fixture.id es el DeviceId canónico (UUID).
 * - Solo muta campos legacy in-place; nunca crea objetos nuevos.
 * - Si un fixture no tiene nodos Aether, se salta silenciosamente.
 *
 * WAVE 4613 FIX: COLOR r/g/b y KINETIC pan/tilt ahora leen del ArbitratedNodeMap
 * y de currentPosition actualizado por el IK engine respectivamente.
 *
 * @module core/aether/resolver/AetherUIProjector
 * @version WAVE 4613 — COLOR + KINETIC FIX
 */
import { NodeFamily } from '../types';
/** Conversión de valor normalizado 0-1 a rango DMX 0-255 */
const DMX_MAX = 255;
function toDmx(v) {
    return Math.round(Math.max(0, Math.min(1, v)) * DMX_MAX);
}
// 🌊 WAVE 4696 M1: Zonas atmosféricas — nunca compiten por luminancia con zonas
// rítmicas. Se suman aditivamente en su propio canal perceptual (ambiente / aire).
const ATMOSPHERIC_ZONES = new Set(['ambient', 'air', 'flash']);
/** Devuelve true si la zona normalizada es atmosférica (ambient, air, flash). */
function isAtmosphericZone(zoneId) {
    const z = zoneId.toLowerCase().trim();
    return ATMOSPHERIC_ZONES.has(z);
}
export class AetherUIProjector {
    /**
     * Proyecta el estado Aether sobre el array legacy de FixtureState.
     *
     * ZERO-ALLOC: solo lectura del graph + mutación in-place de fixtures.
     *
     * @param fixtures      Array mutable de FixtureState (mutado in-place)
     * @param graph         NodeGraph para leer pan/tilt y color de los nodos
     * @param arbitrated    ArbitratedNodeMap post-arbitraje — fuente de verdad para dimmers
     * @param blackoutActive Si es true, todos los canales emisores se fuerzan a 0 en la UI.
     *                       Pan/tilt/rotación se conservan para que la UI siga mostrando
     *                       la orientación mecánica aunque el fixture esté oscuro.
     */
    project(fixtures, graph, arbitrated, blackoutActive = false) {
        for (const fixture of fixtures) {
            // DeviceId canónico: el UUID del fixture (no fixtureId ni name)
            // ⚡ WAVE 4559: fixtureId es el UUID canónico — el DeviceId que indexa el NodeGraph
            // (population: FixtureMapper.buildInitialState → fixtureId: fixture.id ?? fallback)
            const deviceId = fixture.fixtureId;
            if (!deviceId)
                continue;
            const nodeIds = graph.getDeviceNodes(deviceId);
            if (!nodeIds || nodeIds.length === 0)
                continue;
            // 🌊 WAVE 4695: Pre-scan — does this device own at least one IMPACT node?
            // When yes, the IMPACT case handles luminance via fixture.dimmer and the
            // renderer scales color by it (HDR boost path). Scaling r/g/b by brightness
            // here would cause quadratic L0² attenuation (Moiré / besugo effect).
            // Pure-RGB fixtures with no IMPACT node keep the brightness-as-scale path.
            const hasImpactDimmer = nodeIds.some(nid => graph.getNodeData(nid)?.family === NodeFamily.IMPACT);
            for (const nodeId of nodeIds) {
                const node = graph.getNodeData(nodeId);
                if (!node)
                    continue;
                switch (node.family) {
                    case NodeFamily.KINETIC: {
                        const kn = node;
                        if (kn.isContinuous) {
                            // ── Rotación continua: fan, pétalo, mirror ball ─────────────
                            const rot = kn.currentPosition.rotation ?? 0.5;
                            fixture.rotation = toDmx(rot);
                        }
                        else {
                            // ── Posicionado: pan / tilt ───────────────────────────────
                            fixture.pan = toDmx(kn.currentPosition.pan ?? 0.5);
                            fixture.tilt = toDmx(kn.currentPosition.tilt ?? 0.5);
                        }
                        break;
                    }
                    case NodeFamily.COLOR: {
                        // WAVE 4613: Leer r/g/b del ArbitratedNodeMap (post-arbitraje real).
                        // currentColor NO se actualiza en el pipeline actual: ColorAdapter emite
                        // intents r/g/b al bus pero nunca escribe de vuelta al nodo.
                        // El patrón es idéntico al fix de IMPACT (WAVE 4612).
                        //
                        // 🌊 WAVE 4695: Luminance-chrominance decoupling.
                        // Si existe IMPACT, fixture.dimmer ya porta la luminancia L0 → el renderer
                        // aplica HDR boost proporcional al dimmer sobre el color puro de Selene.
                        // Escalar r/g/b por brightness causaría L0² (Moiré): se evita.
                        // Para fixtures RGB puro sin IMPACT, brightness es la única fuente de
                        // intensidad y se mantiene como escala.
                        const colorNode = node;
                        const colorChannels = arbitrated.get(nodeId);
                        const brightnessNorm = hasImpactDimmer
                            ? 1.0
                            : (colorChannels?.['brightness'] ?? 1.0);
                        const projectedR = toDmx((colorChannels?.['r'] ?? 0) * brightnessNorm);
                        const projectedG = toDmx((colorChannels?.['g'] ?? 0) * brightnessNorm);
                        const projectedB = toDmx((colorChannels?.['b'] ?? 0) * brightnessNorm);
                        // 🌊 WAVE 4696 M1: Zone-aware color routing.
                        // Atmospheric zones (ambient, air, flash) → additive blending.
                        //   These nodes exist in a perceptual layer independent of rhythmic
                        //   fixtures. They must NEVER be discarded by luminance comparison
                        //   against front/back/mover nodes (Tungsten wash-color / beam-color).
                        // Rhythmic zones → luminance-dominant selection (WAVE 4695):
                        //   the emitter with higher total lumen output paints the fixture;
                        //   an inactive node (lum=0) can never displace an active one.
                        if (isAtmosphericZone(colorNode.zoneId)) {
                            fixture.r = Math.min(255, fixture.r + projectedR);
                            fixture.g = Math.min(255, fixture.g + projectedG);
                            fixture.b = Math.min(255, fixture.b + projectedB);
                        }
                        else {
                            const newLum = projectedR + projectedG + projectedB;
                            const currLum = fixture.r + fixture.g + fixture.b;
                            if (newLum > currLum) {
                                fixture.r = projectedR;
                                fixture.g = projectedG;
                                fixture.b = projectedB;
                            }
                        }
                        break;
                    }
                    case NodeFamily.IMPACT: {
                        // WAVE 4612: Leer dimmer del ArbitratedNodeMap (post-arbitraje real).
                        // state[1] NO se usa porque nadie lo escribe en el pipeline actual:
                        // el PhysicsPostProcessor solo procesa KINETIC, y el arbiter
                        // solo retorna el mapa sin escribir de vuelta al NodeGraph.
                        //
                        // 🌊 WAVE 4690: Fallback a brightness para nodos IMPACT sin dimmer físico
                        // (parches universales de fixtures RGB-only clasificados como IMPACT).
                        //
                        // 🌊 WAVE 4696 M2: Gain compensation para dimmers físicos (role='primary').
                        // Movers con dimmer físico reciben +25% de ganancia para recuperar punch
                        // visual perdido en el decoupling L0²-prevention de WAVE 4695.
                        // Nodos role='percussion' (shutter/strobe) no reciben ganancia.
                        const impactNode = node;
                        const arbitratedChannels = arbitrated.get(nodeId);
                        const dimmerNorm = arbitratedChannels?.['dimmer'] ?? arbitratedChannels?.['brightness'] ?? 0;
                        const gainFactor = impactNode.role === 'primary' ? 1.25 : 1.0;
                        const projectedDimmer = toDmx(dimmerNorm * gainFactor);
                        fixture.dimmer = Math.max(fixture.dimmer, projectedDimmer);
                        break;
                    }
                    case NodeFamily.BEAM: {
                        // Zoom y focus los resuelve el NodeResolver directamente al FixtureState.
                        // El pipeline AetherSafetyMiddleware → FixtureMapper ya los propaga.
                        break;
                    }
                    default:
                        break;
                }
            }
            // 🚨 WAVE 4634: BLACKOUT UI SYNC — Apagón visual del hot-frame.
            // Si blackout está activo, forzamos a 0 todos los canales emisores de luz
            // en la UI. Pan, tilt y rotación se conservan para que la interfaz siga
            // mostrando la orientación mecánica aunque el fixture esté oscuro.
            if (blackoutActive) {
                fixture.dimmer = 0;
                fixture.r = 0;
                fixture.g = 0;
                fixture.b = 0;
                if (fixture.white !== undefined)
                    fixture.white = 0;
                if (fixture.amber !== undefined)
                    fixture.amber = 0;
                if (fixture.uv !== undefined)
                    fixture.uv = 0;
                if (fixture.shutter !== undefined)
                    fixture.shutter = 0;
                if (fixture.strobe !== undefined)
                    fixture.strobe = 0;
            }
        }
    }
}
