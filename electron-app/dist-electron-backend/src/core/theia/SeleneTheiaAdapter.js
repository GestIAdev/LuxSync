/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🎬 SELENE THEIA ADAPTER — WAVE 4902 (Phase 2/3 of WAVE-4900-THEIADNA)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Puente cognitivo entre el cerebro de Selene (`SeleneTitanConscious.think()`)
 * y el `ThetaOrchestrator` del Main Process.
 *
 * RESPONSABILIDADES (acotadas):
 *   - Recibir un input cognitivo (target DNA + contexto musical).
 *   - Consultar `TheiaRegistry.findBestMatch()` para encontrar el cuepoint
 *     de vídeo más cercano en distancia euclidiana 3D.
 *   - Aplicar throttle anti-flicker (≤ 2000ms entre cues idénticos).
 *   - Emitir un `CueJumpIntent` formateado (sin enviar IPC — eso vive en el
 *     orchestrator).
 *
 * NO RESPONSABILIDADES:
 *   - NO toma decisiones cognitivas (Selene ya decidió).
 *   - NO carga vídeos ni envía IPC (eso lo hace `ThetaOrchestrator` aguas
 *     abajo, consumiendo el `CueJumpIntent`).
 *   - NO hace scoring ponderado (delegado a `TheiaRegistry.findBestMatch`).
 *
 * INTEGRACIÓN FUTURA (WAVE 4900.6):
 *   `SeleneTitanConscious.think()` adaptará su `ConsciousnessOutput` al
 *   shape `ISeleneTheiaInput` definido aquí. Hasta entonces, este adapter
 *   es invocable standalone (mock-friendly).
 * ════════════════════════════════════════════════════════════════════════════
 */
import { getTheiaRegistry } from './TheiaRegistry';
import { useTheiaPackStore } from '../../stores/useTheiaPackStore';
// ─── CONSTANTES DE THROTTLE / CROSSFADE ──────────────────────────────────────
/**
 * Ventana anti-flicker. Si Selene emite la misma decisión repetidamente
 * (frame 44Hz × varios segundos manteniendo el drop), el adapter no
 * republica el mismo cue hasta que pase este throttle.
 */
const REEMIT_THROTTLE_MS = 2000;
/**
 * Crossfades por defecto:
 *   - Drops urgentes / divine: corte casi duro (50ms) — sincroniza con el beat.
 *   - Buildup: fade medio (300ms).
 *   - Ambient / cualquier otra cosa: fade largo (500ms).
 */
const CROSSFADE_DRAMATIC_MS = 50;
const CROSSFADE_BUILDUP_MS = 300;
const CROSSFADE_AMBIENT_MS = 500;
/**
 * Bridge cognitivo Selene → Theia. Singleton-friendly via `getSeleneTheiaAdapter()`.
 */
export class SeleneTheiaAdapter {
    constructor(_registry) {
        this._registry = _registry;
        this._lastEmitted = null;
    }
    /**
     * Procesa el output cognitivo de Selene y produce un `CueJumpIntent`
     * o `null` si no procede tocar el vídeo.
     *
     * ZERO-ALLOC en hot-path cuando el resultado es deduplicado (early return
     * sin construir objetos intermedios).
     *
     * WAVE 4923 — M3: Solo busca dentro del pack activo (livePackId).
     * Si no hay pack activo, el adapter permanece en standby.
     */
    process(input) {
        // GUARD 1: hold → no tocar el vídeo.
        if (input.decision === 'hold')
            return null;
        // GUARD 2: blackout → emitir intent especial con clip vacío.
        if (input.decision === 'blackout') {
            return this._emitBlackout();
        }
        // GUARD 3 (WAVE 4923): standby si no hay pack activo.
        const packStore = useTheiaPackStore.getState();
        const { livePackId, packs } = packStore;
        if (!livePackId)
            return null;
        const pack = packs.get(livePackId);
        if (!pack || pack.atoms.length === 0)
            return null;
        // STEP 1: matching cognitivo dentro del pack activo.
        const match = this._findBestMatchFromAtoms(pack.atoms, input);
        if (!match)
            return null;
        // STEP 2: throttle anti-flicker.
        if (this._isRedundant(match))
            return null;
        // STEP 3: derivar crossfade y construir intent.
        const atom = pack.atoms.find((a) => a.id === match.atomId);
        if (!atom)
            return null; // race con hot-reload — defensivo.
        const crossfadeMs = this._deriveCrossfade(input);
        const intent = {
            atomId: match.atomId,
            startMs: atom.trim.startMs,
            crossfadeMs,
            reason: this._buildReason(input, match),
        };
        // STEP 4: registrar emisión para el throttle de la próxima llamada.
        this._lastEmitted = {
            atomId: intent.atomId,
            t: Date.now(),
        };
        return intent;
    }
    /**
     * Reset del throttle. Útil al cambiar de canción / showfile / blackout
     * para que el siguiente cue legítimo se emita sin esperar la ventana.
     */
    resetThrottle() {
        this._lastEmitted = null;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // INTERNALS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Busca el átomo más cercano al targetDNA dentro de un conjunto acotado de
     * átomos (el pack activo). Aplica filtro de energyZone antes de comparar.
     */
    _findBestMatchFromAtoms(atoms, input) {
        // Filtrar por solapamiento de energyZone
        const ZONES = [
            'silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak',
        ];
        const targetIdx = ZONES.indexOf(input.energyZone);
        const compatible = atoms.filter((a) => {
            const minIdx = ZONES.indexOf(a.energyZone.min);
            const maxIdx = ZONES.indexOf(a.energyZone.max);
            return targetIdx >= minIdx && targetIdx <= maxIdx;
        });
        const candidates = compatible.length > 0 ? compatible : atoms;
        return this._closestAtom(candidates, input.targetDNA);
    }
    /**
     * Distancia euclidiana en el espacio (aggression, chaos, organicity).
     * Devuelve el ITheiaMatch con score e distance calculados.
     */
    _closestAtom(atoms, genome) {
        if (atoms.length === 0)
            return null;
        let bestAtom = atoms[0];
        let bestDist = Infinity;
        for (const atom of atoms) {
            const da = atom.aggression - genome.aggression;
            const dc = atom.chaos - genome.chaos;
            const do_ = atom.organicity - genome.organicity;
            const dist = Math.sqrt(da * da + dc * dc + do_ * do_);
            if (dist < bestDist) {
                bestDist = dist;
                bestAtom = atom;
            }
        }
        // score ∈ [0,1]: 0 = distancia máxima posible (√3), 1 = match perfecto.
        const MAX_DIST = Math.sqrt(3);
        return {
            atomId: bestAtom.id,
            distance: bestDist,
            score: Math.max(0, 1 - bestDist / MAX_DIST),
        };
    }
    _isRedundant(match) {
        const last = this._lastEmitted;
        if (!last)
            return false;
        if (last.atomId !== match.atomId)
            return false;
        return (Date.now() - last.t) < REEMIT_THROTTLE_MS;
    }
    _deriveCrossfade(input) {
        if (input.decision === 'divine_strike')
            return CROSSFADE_DRAMATIC_MS;
        if (input.decision === 'strike') {
            // Solo corte duro si la zona soporta el drama.
            if (input.energyZone === 'intense' || input.energyZone === 'peak') {
                return CROSSFADE_DRAMATIC_MS;
            }
            return CROSSFADE_AMBIENT_MS;
        }
        if (input.decision === 'prepare_for_drop' || input.decision === 'buildup_enhance') {
            return CROSSFADE_BUILDUP_MS;
        }
        return CROSSFADE_AMBIENT_MS;
    }
    _buildReason(input, match) {
        const parts = [
            'dna-match',
            `score=${match.score.toFixed(2)}`,
            `dist=${match.distance.toFixed(3)}`,
            `dec=${input.decision}`,
            `sec=${input.section}`,
            `vibe=${input.vibe}`,
            `zone=${input.energyZone}`,
        ];
        if (input.effectId)
            parts.push(`fx=${input.effectId}`);
        return parts.join('|');
    }
    _emitBlackout() {
        this._lastEmitted = null;
        return {
            atomId: '',
            startMs: 0,
            crossfadeMs: CROSSFADE_AMBIENT_MS,
            reason: 'blackout',
        };
    }
}
// ─── SINGLETON ───────────────────────────────────────────────────────────────
let _instance = null;
/** Obtiene el singleton compartido del adapter. */
export function getSeleneTheiaAdapter() {
    if (!_instance)
        _instance = new SeleneTheiaAdapter(getTheiaRegistry());
    return _instance;
}
/** Reset destructivo — solo tests. */
export function __resetSeleneTheiaAdapterForTests() {
    _instance = null;
}
