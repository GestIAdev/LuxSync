/**
 * AETHER MATRIX - BEAM SYSTEM
 * WAVE 3509: THE FINAL NODES (F3) -- Familia BEAM completa.
 *
 * Traduce el contexto musical (seccion, drop, energia) y el vibe activo
 * en NodeIntents de conformacion de haz para todos los BEAM_NODEs:
 * zoom, focus, iris, frost, gobo (seleccion), gobo_rotation, prism, prism_rotation.
 *
 * FILOSOFIA DE BEAM:
 * El haz no reacciona al audio frame a frame como el dimmer o el color.
 * Cambia de "estado estetico" segun la SECCION musical:
 * - intro/break  -> haz abierto, sin gobo, sin prisma
 * - build        -> haz cerrando, prisma entrando
 * - drop         -> haz cerrado, gobo activo, prisma rotando
 *
 * MECANICA DE GOBOS -- HOLD TIMER:
 * Los gobos y prismas son ruedas mecanicas (ResponseType: 'mechanical').
 * Cambiarlas demasiado rapido produce parpadeo y desgaste.
 * Hold time: GOBO=2000ms, PRISM=1500ms. Estado en node.darkSpinState (mutable in-place).
 *
 * ZERO-ALLOC:
 * - _intentScratch + _valuesDict heredados de BaseSystem, reutilizados.
 * - node.darkSpinState mutado in-place (no object spread).
 *
 * @module core/aether/systems/BeamSystem
 * @version WAVE 3509
 */
import { NodeFamily } from '../types';
import { BaseSystem, } from './BaseSystem';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const BEAM_INTENT_PRIORITY = 10;
/**
 * Tiempo minimo entre cambios de gobo/prisma (ms).
 * Blueprint &sect;3: "Cambio < 2000ms -> bloqueado"
 */
const GOBO_HOLD_TIME_MS = 2000;
const PRISM_HOLD_TIME_MS = 1500;
// Apertura de zoom por seccion musical (0=cerrado, 1=abierto)
const ZOOM_BY_SECTION = {
    intro: 0.80,
    verse: 0.75,
    build: 0.50,
    drop: 0.20,
    break: 0.85,
    outro: 0.70,
    unknown: 0.60,
};
// Focus por seccion (0=difuso, 1=nitido)
const FOCUS_BY_SECTION = {
    intro: 0.50,
    verse: 0.55,
    build: 0.65,
    drop: 0.95,
    break: 0.40,
    outro: 0.50,
    unknown: 0.55,
};
// Iris por seccion (0=cerrado, 1=abierto)
const IRIS_BY_SECTION = {
    intro: 0.70,
    verse: 0.65,
    build: 0.55,
    drop: 0.30,
    break: 0.85,
    outro: 0.65,
    unknown: 0.60,
};
// Gobo slot target por seccion (0=open, 1=slot maximo)
const GOBO_BY_SECTION = {
    intro: 0.0,
    verse: 0.0,
    build: 0.3,
    drop: 0.7,
    break: 0.0,
    outro: 0.0,
    unknown: 0.0,
};
// Frost por seccion (0=sin frost, 1=maximo)
const FROST_BY_SECTION = {
    intro: 0.20,
    verse: 0.25,
    build: 0.10,
    drop: 0.00,
    break: 0.60,
    outro: 0.30,
    unknown: 0.20,
};
// Prism insertado por seccion
const PRISM_BY_SECTION = {
    intro: false,
    verse: false,
    build: true,
    drop: true,
    break: false,
    outro: false,
    unknown: false,
};
// ─────────────────────────────────────────────────────────────────────────────
// BEAM SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
export class BeamSystem extends BaseSystem {
    constructor() {
        super();
        this.name = 'BeamSystem';
        this.family = NodeFamily.BEAM;
        this._intentScratch.source = 'beam_system';
        this._intentScratch.priority = BEAM_INTENT_PRIORITY;
        this._intentScratch.confidence = 1.0;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // HOT-PATH -- 44Hz
    // ─────────────────────────────────────────────────────────────────────────
    process(view, context, bus) {
        const { audio, musical, vibe } = context;
        const nowMs = context.nowMs;
        const section = musical.section;
        // Lookup O(1) en tablas const -- cero alloc
        const zoomBase = ZOOM_BY_SECTION[section] ?? ZOOM_BY_SECTION['unknown'];
        const focusBase = FOCUS_BY_SECTION[section] ?? FOCUS_BY_SECTION['unknown'];
        const irisBase = IRIS_BY_SECTION[section] ?? IRIS_BY_SECTION['unknown'];
        const goboBase = GOBO_BY_SECTION[section] ?? GOBO_BY_SECTION['unknown'];
        const frostBase = FROST_BY_SECTION[section] ?? FROST_BY_SECTION['unknown'];
        const wantPrism = PRISM_BY_SECTION[section] ?? false;
        // Punch transiente: el zoom se cierra brevemente en transientes fuertes
        const transientPunch = (audio.hasTransient && audio.transientStrength > 0.65 && wantPrism)
            ? audio.transientStrength * 0.25
            : 0;
        const zoomTarget = BaseSystem.clamp01(zoomBase - transientPunch);
        // Focus modulado por energia global
        const focusTarget = BaseSystem.clamp01(focusBase + (audio.energy - 0.5) * 0.1 * vibe.beamExpressiveness);
        // Velocidad de rotacion de prisma reactiva a BPM + energia
        const prismRotSpeed = BaseSystem.clamp01((audio.bpm / 300) * 0.4 + audio.energy * 0.6) * vibe.beamExpressiveness;
        view.forEach((node) => {
            // ── Zero-alloc cleanup: evitar valores stale del frame/nodo anterior ──
            this._valuesDict['zoom'] = undefined;
            this._valuesDict['focus'] = undefined;
            this._valuesDict['iris'] = undefined;
            this._valuesDict['frost'] = undefined;
            this._valuesDict['gobo'] = undefined;
            this._valuesDict['gobo_rotation'] = undefined;
            this._valuesDict['prism'] = undefined;
            this._valuesDict['prism_rotation'] = undefined;
            if (node.hasZoom) {
                this._valuesDict['zoom'] = zoomTarget;
            }
            if (node.hasFocus) {
                this._valuesDict['focus'] = focusTarget;
            }
            // Iris: se escribe siempre; el NodeResolver ignora si el canal no existe
            this._valuesDict['iris'] = irisBase;
            if (node.hasFrost) {
                this._valuesDict['frost'] = frostBase;
            }
            // GOBO: hold timer mecanico
            if (node.hasGobo) {
                const canChangeGobo = this._canChangeMechanical(node, nowMs, GOBO_HOLD_TIME_MS);
                if (canChangeGobo) {
                    this._valuesDict['gobo'] = goboBase;
                    this._stampMechanicalChange(node, nowMs);
                }
                // Si esta bloqueado -> no escribir 'gobo': el Arbiter mantiene el ultimo LTP
            }
            // GOBO ROTATION: continua, sin hold timer
            if (node.hasGoboRotation && goboBase > 0) {
                const goboRot = BaseSystem.clamp01(audio.energy * 0.5 + audio.mid * 0.3) * vibe.beamExpressiveness;
                this._valuesDict['gobo_rotation'] = goboRot;
            }
            else if (node.hasGoboRotation) {
                this._valuesDict['gobo_rotation'] = 0;
            }
            // PRISM: hold timer mecanico en transiciones de seccion
            if (node.hasPrism) {
                const prismInserted = wantPrism ? 1.0 : 0.0;
                const canChangePrism = this._canChangePrism(node, nowMs, prismInserted);
                if (canChangePrism) {
                    this._valuesDict['prism'] = prismInserted;
                    this._stampMechanicalChange(node, nowMs);
                }
                // PRISM ROTATION: solo si el prisma esta (o intenta estar) insertado
                if (node.hasPrismRotation) {
                    // prismInserted y prismRotSpeed son escalares del stack -- cero alloc
                    this._valuesDict['prism_rotation'] = prismRotSpeed * prismInserted;
                }
            }
            this._intentScratch.nodeId = node.nodeId;
            this._intentScratch.confidence = BaseSystem.clamp01(musical.sectionIntensity);
            bus.push(this._intentScratch);
        });
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE -- Hold timer helpers (zero-alloc, mutan in-place)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Retorna true si el nodo puede ejecutar un cambio de rueda mecanica (gobo).
     * Consulta node.darkSpinState en O(1) -- sin alloc.
     */
    _canChangeMechanical(node, nowMs, holdMs) {
        const ds = node.darkSpinState;
        if (!ds)
            return true;
        if (ds.isLocked)
            return false;
        return (nowMs - ds.lastChangeMs) >= holdMs;
    }
    /**
     * Para el prisma, ademas del hold timer verifica si el estado objetivo cambio.
     * Evita reescribir el mismo valor innecesariamente.
     */
    _canChangePrism(node, nowMs, targetValue) {
        const ds = node.darkSpinState;
        if (!ds)
            return true;
        if (ds.isLocked)
            return false;
        const currentNormalized = node.state[1];
        if (Math.abs(currentNormalized - targetValue) < 0.01)
            return false;
        return (nowMs - ds.lastChangeMs) >= PRISM_HOLD_TIME_MS;
    }
    /**
     * Estampa el timestamp del cambio mecanico en node.darkSpinState (in-place).
     * Unico punto donde se muta DarkSpinState. No hay object spread -- zero-alloc.
     */
    _stampMechanicalChange(node, nowMs) {
        if (!node.darkSpinState) {
            // Primera inicializacion -- unica allocation en patch time
            const ds = { lastChangeMs: nowMs, isLocked: false };
            node.darkSpinState = ds;
            return;
        }
        const ds = node.darkSpinState;
        ds.lastChangeMs = nowMs;
        ds.isLocked = false;
    }
}
