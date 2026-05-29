/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ AETHER MATRIX — KINETIC ADAPTER (CLASSIC PIPE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4632: SPLIT-BRAIN Fase 3 — VMM → L0 clásico
 *
 * RESPONSABILIDAD:
 * Sustituye al VMMAdapter y emite intención cinemática clásica directa:
 * `pan`, `tilt`, `speed` normalizados (0-1) al IntentBus L0.
 *
 * FILOSOFÍA:
 * En Split-Brain, el flujo automático (VMM) pertenece a la ruta clásica.
 * El flujo espacial (targetX/Y/Z) queda reservado para overrides manuales L2.
 *
 * MAPPING (WAVE 4914 — Relative Offset Routing):
 * El VMM entrega `intent.x`/`intent.y` en [-1,+1]. Se emiten DIRECTAMENTE como
 * offsets relativos en los canales `pan_offset`/`tilt_offset`. La fusión final
 *   `pan_final  = clamp01(pan_base  + pan_offset  * amp * aspect)`
 *   `tilt_final = clamp01(tilt_base + tilt_offset * amp * aspect)`
 * ocurre en `NodeArbiter._applyRelativeOffsetFusion()`. Cuando no hay base IK
 * (`pan_base` ausente en motor/manual override), el arbiter usa 0.5 como
 * centro neutro y la fórmula degenera al mapeo legacy `(x+1)/2` con
 * `amp=1, aspect=0.5`. Cero regresión visual cuando el IK no está activo.
 *
 * NODOS CONTINUOS (fan, mirror ball):
 * Para `isContinuous === true`, el IK no aplica (no hay un "target 3D" para
 * rotación continua). Este adapter emite `rotation` + `speed` en canal
 * normalizado (flujo legacy) para que el NodeResolver los trate directamente.
 *
 * ZERO-ALLOC GARANTIZADO @ 44Hz:
 * - `_vmmAudio`: puente pre-allocado, mutado in-place.
 * - `_intentScratch` + `_valuesDict`: heredados de BaseSystem.
 * - La proyección holográfica usa solo aritmética de stack.
 *
 * @module core/aether/adapters/KineticAdapter
 * @version WAVE 4914 — RELATIVE OFFSET ROUTING
 */
import { NodeFamily } from '../types';
import { BaseSystem } from '../systems';
import { vibeMovementManager, } from '../../../engine/movement/VibeMovementManager';
import { aetherKineticEngine } from '../AetherKineticEngine';
import { fnv1aChaosPhase } from '../../../engine/movement/ChaosHash';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
/** Priority L0 — coreografía automática IA */
const INTENT_PRIORITY = 10;
/** Fuente identificable para debug y arbitraje */
const INTENT_SOURCE = 'kinetic-adapter';
const TWO_PI = Math.PI * 2;
/**
 * Fallback determinista si aún no llega stageBounds por IPC.
 * Se usa solo como red de seguridad de arranque.
 */
const DEFAULT_STAGE_BOUNDS = {
    width: 8.0,
    height: 4.0,
    depth: 2.0,
    centerY: 1.5,
};
function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
}
/**
 * Mapa de VibeProfile.name → VMM vibeId.
 * Inmutable para garantizar lookup O(1) sin alloc en el hot-path.
 */
const VIBE_ID_MAP = {
    'techno-club': 'techno-club',
    'techno': 'techno-club',
    'electro': 'techno-club',
    'fiesta-latina': 'fiesta-latina',
    'latino': 'fiesta-latina',
    'salsa': 'fiesta-latina',
    'reggaeton': 'fiesta-latina',
    'pop-rock': 'pop-rock',
    'rock': 'pop-rock',
    'pop': 'pop-rock',
    'chill-lounge': 'chill-lounge',
    'chill': 'chill-lounge',
    'lounge': 'chill-lounge',
    'ambient': 'chill-lounge',
    'jazz': 'chill-lounge',
    'idle': 'idle',
};
const FALLBACK_VIBE_ID = 'techno-club';
const CHILL_VIBE_ID = 'chill-lounge';
const GLACIER_LERP_ALPHA = 0.0005;
// ─────────────────────────────────────────────────────────────────────────────
// KINETIC ADAPTER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Adapter L0 (priority=10) para nodos KINETIC.
 *
 * Emite exclusivamente canales clásicos `pan`, `tilt` y `speed`.
 * No genera ni inyecta targetX/Y/Z.
 */
export class KineticAdapter extends BaseSystem {
    constructor() {
        super();
        this.name = 'KineticAdapter';
        this.family = NodeFamily.KINETIC;
        this.source = INTENT_SOURCE;
        this._vmm = vibeMovementManager;
        /**
         * Puente de audio pre-allocado.
         * Sus campos se sobrescriben in-place en el hot-path — nunca se crea
         * un nuevo objeto dentro de process().
         */
        this._vmmAudio = {
            energy: 0,
            bass: 0,
            mids: 0,
            highs: 0,
            bpm: 120,
            beatPhase: 0,
            beatCount: 0,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // HOT-PATH — 44Hz
    // ─────────────────────────────────────────────────────────────────────────
    process(nodes, context, bus) {
        const { audio, vibe } = context;
        // ── 1. Resolver vibeId → VMM vibeId (lookup O(1), sin alloc)
        const vibeId = VIBE_ID_MAP[vibe.name] ?? FALLBACK_VIBE_ID;
        const isChillVibe = vibeId === CHILL_VIBE_ID;
        // ── 2. Actualizar puente de audio in-place (cero alloc)
        const va = this._vmmAudio;
        if (isChillVibe) {
            // WAVE 4845: Muro de Silencio — flujo cinético totalmente desacoplado del audio.
            va.energy = 0;
            va.bass = 0;
            va.mids = 0;
            va.highs = 0;
            va.bpm = 0;
            va.beatPhase = 0;
            va.beatCount = 0;
        }
        else {
            va.energy = audio.energy;
            va.bass = audio.bass;
            va.mids = audio.mid;
            va.highs = audio.highMid;
            va.bpm = audio.bpm;
            va.beatPhase = audio.beatPhase;
            va.beatCount = audio.beatCount ?? 0;
        }
        // ── 3. Preparar scratch de intent (campos invariantes al frame)
        this._intentScratch.priority = INTENT_PRIORITY;
        this._intentScratch.confidence = BaseSystem.clamp01(audio.energy * 0.8 + 0.2);
        this._intentScratch.source = INTENT_SOURCE;
        // ── 4. Iterar nodos KINETIC (forEach es zero-alloc)
        nodes.forEach((node, _index) => {
            // ── 4a. Limpiar slots del scratch del nodo anterior ────────────────
            // Solo los canales que este adapter puede escribir.
            // Canales espaciales legacy se limpian explícitamente para evitar fugas.
            this._valuesDict['targetX'] = undefined;
            this._valuesDict['targetY'] = undefined;
            this._valuesDict['targetZ'] = undefined;
            // Canales clásicos/continuos + canales de offset relativo (WAVE 4914).
            this._valuesDict['pan'] = undefined;
            this._valuesDict['tilt'] = undefined;
            this._valuesDict['pan_offset'] = undefined;
            this._valuesDict['tilt_offset'] = undefined;
            this._valuesDict['rotation'] = undefined;
            this._valuesDict['speed'] = undefined;
            // ── 4b. GATE L2-SUPREMACY: si el motor nativo L2 tiene este nodo bajo
            // control manual, NO emitir intent L0 — el engine ya escribió pan_base/tilt_base
            // en L2 antes de este tick. Emitir L0 aquí contaminaría el resultado final.
            if (aetherKineticEngine.hasNode(node.nodeId)) {
                return;
            }
            // 🛡️ WAVE 4824.1: KINETIC ADAPTER SHIELD — Early exit para rotación continua.
            //
            // Nodos isContinuous (ventiladores, fans, mirror balls) esperan velocidad
            // constante, NO LFOs posicionales. El VMM genera ondas senoidales sincronizadas
            // al BPM que, al mapearse a rotation, causan aceleraciones/frenadas violentas
            // ("clack" mecánico). Early return ANTES de llamar al VMM — cero trabajo innecesario.
            //
            // Control exclusivo de rotation continua:
            //   - L2 manual (override del operador desde The Programmer / Cathedral)
            //   - defaultValue del JSON del fixture (reposo absoluto, sin DMX)
            if (node.isContinuous) {
                return;
            }
            // ── 4c. Obtener intención 2D del VMM para este nodo ───────────────
            // 🎭 WAVE 4645: Left/Right phase asymmetry
            // Fixtures on the right side (x > 0) get π phase offset for counterpoint motion
            // 🎭 WAVE 4717.2: L2 fan phase offset — suma el desfase calculado por el bridge
            // según el orden de selección del usuario (determinista, cero alloc).
            const lrPhaseOffset = (node.physicalPosition?.x ?? 0) > 0 ? Math.PI : 0;
            const l2PhaseOffset = this._vmm._l2PhaseOverrides[node.nodeId] ?? 0;
            // 🌪️ WAVE 4708 T3: caos global del slider — desfase determinista por fixture.
            // Se extrae fixtureId puro (sin :kinetic) para que el hash coincida con el
            // usado por KineticsBridge._flushClassic en el frontend, unificando el
            // comportamiento caótico entre patrones manuales (L2) e IA (L0).
            const chaosAmount = this._vmm.globalChaosAmount;
            const fixtureId = node.nodeId.split(':')[0];
            const chaosPhase = chaosAmount > 0
                ? fnv1aChaosPhase(fixtureId, this._vmm.globalChaosSeed) * chaosAmount
                : 0;
            const phaseOffset = lrPhaseOffset + l2PhaseOffset + chaosPhase;
            if (isChillVibe) {
                // WAVE 4845: Movimiento de hielo — LFO paramétrico ultra-lento + lerp perezoso.
                // WAVE 4914: el LFO sigue acumulándose en currentPosition (para continuidad inter-frame),
                // pero se emite como OFFSET relativo al centro (∈ [-1,+1]) para que el arbiter lo sume
                // sobre la base IK / radar anchor.
                const tSec = context.nowMs / 1000;
                const total = node.stereoTotal > 0 ? node.stereoTotal : 1;
                const frac = node.stereoIndex / total;
                const phase = frac * TWO_PI + phaseOffset * 0.25;
                const targetPan = BaseSystem.clamp01(0.5 + Math.sin((TWO_PI * tSec) / 180 + phase) * 0.15);
                const targetTilt = BaseSystem.clamp01(0.5 + Math.cos((TWO_PI * tSec) / 240 + phase) * 0.10);
                const pan = node.currentPosition.pan + (targetPan - node.currentPosition.pan) * GLACIER_LERP_ALPHA;
                const tilt = node.currentPosition.tilt + (targetTilt - node.currentPosition.tilt) * GLACIER_LERP_ALPHA;
                // Convertir [0,1] → [-1,+1] (offset relativo centrado en 0).
                this._valuesDict['pan_offset'] = clamp(pan * 2 - 1, -1, 1);
                this._valuesDict['tilt_offset'] = clamp(tilt * 2 - 1, -1, 1);
                this._valuesDict['speed'] = 0.05;
            }
            else {
                const intent = this._vmm.generateIntent(vibeId, va, node.stereoIndex, node.stereoTotal, node.maxPanSpeed, phaseOffset, node.ikOrientation?.installation);
                // ── WAVE 4914 RELATIVE OFFSET ROUTING ────────────────────────────
                // VMM intent.x / intent.y ∈ [-1,+1] se emiten TAL CUAL como offsets.
                // El NodeArbiter._applyRelativeOffsetFusion suma con la base IK/anchor:
                //   pan_final = clamp01(pan_base + pan_offset * amp * aspect)
                // Cuando no hay base, el arbiter usa 0.5 como centro neutro y la
                // fórmula degenera al mapeo legacy `(x+1)/2` (con amp=1, aspect=0.5).
                this._valuesDict['pan_offset'] = clamp(intent.x, -1, 1);
                this._valuesDict['tilt_offset'] = clamp(intent.y, -1, 1);
                this._valuesDict['speed'] = BaseSystem.clamp01(intent.speed);
            }
            // ── 4c. Push al bus (IntentBus copia los valores — seguro reutilizar scratch)
            this._intentScratch.nodeId = node.nodeId;
            bus.push(this._intentScratch);
        });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY ALIAS
// El TitanOrchestrator referencia esta clase por nombre 'VMMAdapter' en
// todos los commits anteriores a WAVE 4523.4. Exportamos el alias para
// que no haya que tocar el orchestrator en este wave.
// ─────────────────────────────────────────────────────────────────────────────
/** @deprecated Usa KineticAdapter directamente. Este alias se elimina en WAVE 4525. */
export const VMMAdapter = KineticAdapter;
