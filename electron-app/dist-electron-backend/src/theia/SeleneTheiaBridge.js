/**
 * 🌉 WAVE 4869 — SELENE-THEIA BRIDGE
 *
 * Observer pasivo del pipeline cognitivo de Selene.
 * Recibe un snapshot de FrameContext por tick desde TitanOrchestrator.processFrame()
 * y lo mapea a transiciones de estado en ThetaOrchestrator (ThumbSAB → THETA worker).
 *
 * DOCTRINA:
 *  - No modifica el pipeline de Selene.
 *  - No posee workers, timers ni async.
 *  - Llama forceState() SOLO al cambiar de estado (no cada frame).
 *  - Hysteresis + confirmation gating para evitar parpadeo visual.
 *
 * Fixture de estados target (TheiaAssetStateId):
 *   'ambient'  ←  energía baja, intro, break, outro
 *   'buildup'  ←  energía media, section buildup / pre-chorus
 *   'drop'     ←  energía alta, section drop / chorus, dropImminent
 *
 * ('idle' y 'decay' quedan para uso manual del operador.)
 */
// ──────────────────────────────────────────────────────────────────────────
// Constantes de comportamiento
// ──────────────────────────────────────────────────────────────────────────
/**
 * Ticks mínimos entre transiciones de estado (~600 ms a 44 Hz).
 * Evita que una espiga de energía puntual desencadene un flash visual.
 */
const MIN_DWELL_TICKS = 26;
/**
 * Frames consecutivos que el estado resuelto debe mantenerse antes de comprometerse.
 * Filtra transitorios de sección que el Brain reporte brevemente antes de estabilizarse.
 */
const CONFIRMATION_TICKS = 3;
/**
 * Umbrales de energía (hysteresis asimétrica):
 *   enter  → valor mínimo para activar este estado
 *   exit   → valor máximo para permanecer en él (si cae por debajo → cede al anterior)
 *
 * Nota: la resolución real combina sectionType + energy; esta tabla solo
 * cubre el path energy-only cuando section='unknown'.
 */
const ENERGY_THRESHOLD = {
    dropEnter: 0.72, // Energía para entrar en DROP
    dropExit: 0.50, // DROP cede a BUILDUP si energy < 0.50
    buildupEnter: 0.35, // Energía para entrar en BUILDUP
    buildupExit: 0.22, // BUILDUP cede a AMBIENT si energy < 0.22
};
// ──────────────────────────────────────────────────────────────────────────
// Secciones musicales → estado Theia (mapas prioritarios)
// ──────────────────────────────────────────────────────────────────────────
const SECTION_TO_DROP = new Set(['drop', 'chorus']);
const SECTION_TO_BUILDUP = new Set(['buildup', 'pre-chorus']);
const SECTION_TO_AMBIENT = new Set(['intro', 'outro', 'break', 'silence']);
// ──────────────────────────────────────────────────────────────────────────
// SeleneTheiaBridge
// ──────────────────────────────────────────────────────────────────────────
export class SeleneTheiaBridge {
    constructor() {
        this._theta = null;
        this._currentState = 'idle';
        this._pendingState = null;
        this._pendingCount = 0;
        this._lastTransitionTick = -MIN_DWELL_TICKS - 1;
    }
    // ── Lifecycle ──────────────────────────────────────────────────────────
    /**
     * Conecta el bridge con el ThetaOrchestrator.
     * Debe llamarse después de que ThetaOrchestrator.start() haya iniciado.
     */
    attach(theta) {
        this._theta = theta;
        this._currentState = 'idle';
        this._pendingState = null;
        this._pendingCount = 0;
        this._lastTransitionTick = -MIN_DWELL_TICKS - 1;
    }
    detach() {
        this._theta = null;
    }
    // ── Hot path (llamado desde TitanOrchestrator.processFrame() cada tick) ──
    /**
     * Evalúa el contexto del frame y dispara forceState() en el ThetaOrchestrator
     * cuando detecta un cambio de estado estable.
     *
     * Sin allocaciones. Sin async. Sin efectos secundarios fuera de forceState().
     */
    notify(ctx) {
        if (this._theta === null)
            return;
        const target = this._resolveTarget(ctx);
        // Fast path: sin cambio
        if (target === this._currentState) {
            this._pendingState = null;
            this._pendingCount = 0;
            return;
        }
        // Hysteresis dwell guard
        if (ctx.frameIndex - this._lastTransitionTick < MIN_DWELL_TICKS)
            return;
        // Confirmation gating
        if (target !== this._pendingState) {
            this._pendingState = target;
            this._pendingCount = 1;
            return;
        }
        this._pendingCount++;
        if (this._pendingCount < CONFIRMATION_TICKS)
            return;
        // Commit
        this._currentState = target;
        this._pendingState = null;
        this._pendingCount = 0;
        this._lastTransitionTick = ctx.frameIndex;
        this._theta.forceState(target, { manual: false });
    }
    // ── Diagnóstico ──────────────────────────────────────────────────────────
    getState() { return this._currentState; }
    isAttached() { return this._theta !== null; }
    // ── Resolución de estado (determinista, sin side-effects) ────────────────
    _resolveTarget(ctx) {
        const { energy, sectionType, dropImminent } = ctx;
        // 1. Section type tiene prioridad sobre la energía cruda.
        //    El Brain ya procesó el audio con modelo cognitivo → más señal / menos ruido.
        if (SECTION_TO_DROP.has(sectionType))
            return 'drop';
        if (SECTION_TO_BUILDUP.has(sectionType))
            return 'buildup';
        if (SECTION_TO_AMBIENT.has(sectionType))
            return 'ambient';
        // 2. Señal cognitiva de drop inminente (energy > 0.8 según Brain).
        if (dropImminent)
            return 'drop';
        // 3. Hysteresis por energía pura con umbrales asimétricos.
        //    Usa el _currentState para romper la simetría (histéresis Schmitt trigger).
        if (this._currentState === 'drop') {
            // En DROP: necesita caer bajo dropExit para salir
            if (energy >= ENERGY_THRESHOLD.dropExit)
                return 'drop';
            if (energy >= ENERGY_THRESHOLD.buildupEnter)
                return 'buildup';
            return 'ambient';
        }
        if (this._currentState === 'buildup') {
            // En BUILDUP: sube a DROP o cae a AMBIENT
            if (energy >= ENERGY_THRESHOLD.dropEnter)
                return 'drop';
            if (energy >= ENERGY_THRESHOLD.buildupExit)
                return 'buildup';
            return 'ambient';
        }
        // En AMBIENT / IDLE / DECAY (o estado inicial)
        if (energy >= ENERGY_THRESHOLD.dropEnter)
            return 'drop';
        if (energy >= ENERGY_THRESHOLD.buildupEnter)
            return 'buildup';
        return 'ambient';
    }
}
// ──────────────────────────────────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────────────────────────────────
let _bridgeInstance = null;
export function getSeleneTheiaBridge() {
    if (!_bridgeInstance)
        _bridgeInstance = new SeleneTheiaBridge();
    return _bridgeInstance;
}
