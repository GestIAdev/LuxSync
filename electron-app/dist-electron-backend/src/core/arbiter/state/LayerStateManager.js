/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗂️ LAYER STATE MANAGER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3504 — PASO 2: Layer State Isolation.
 *
 * Owner único de las cinco capas de intents del pipeline de arbitración.
 * Extrae del MasterArbiter la responsabilidad de persistir el estado de las
 * capas, dejando al Arbiter libre de actuar solo como compositor.
 *
 * CAPAS (en orden de prioridad ascendente):
 *   L0  TITAN_AI     — Intent generado por TitanEngine cada frame.
 *   L1  CONSCIOUSNESS — Modificadores de SeleneLuxConscious (fósil/CORE 3).
 *   L2  MANUAL        — Overrides manuales por fixture (operador, MIDI, OSC).
 *   L3  EFFECTS       — Efectos temporales (WAVE 373 legacy) + EffectIntents (WAVE 2662).
 *   L4  BLACKOUT      — Booleano de emergencia. Gana sobre todo.
 *
 * CONTRATOS:
 *   ✓ Esta clase NO resuelve merge: sólo almacena y expone el estado por capa.
 *   ✓ NO importa singletons ni event bus. Sus dependencias llegan por constructor.
 *   ✓ Toda lógica de resolución/priorización pertenece al MergeStrategyResolver.
 *   ✓ Compatible con MasterArbiter actual: los métodos públicos mapean 1:1
 *     con el API existente para permitir migración sin regresión (WAVE 3505).
 *
 * ORIGEN DE LA LÓGICA:
 *   Estado extraído de MasterArbiter.ts lines 125–136 (layer fields) y los
 *   métodos CRUD lines 429–1100 (setTitanIntent, setManualOverride,
 *   releaseManualOverride, addEffect, setEffectIntents, setBlackout, etc.).
 *
 * @module core/arbiter/state/LayerStateManager
 * @version WAVE 3504
 */
const DEFAULT_LAYER_STATE_CONFIG = {
    maxManualOverrides: 64,
    maxActiveEffects: 8,
    consciousnessEnabled: false,
};
// ═══════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════
export class LayerStateManager {
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config = {}) {
        // ── Layer storage ─────────────────────────────────────────────────────────
        /** L0 — TitanEngine intent. Null before first frame. */
        this._layer0 = null;
        /** L1 — SeleneLuxConscious modifier. Null until CORE 3. */
        this._layer1 = null;
        /**
         * L2 — Manual overrides. keyed by fixtureId.
         * WAVE 2711: merge semántico por categoría de canal (posición vs color vs intensidad).
         */
        this._layer2 = new Map();
        /**
         * L3 legacy — Efectos temporales (strobe, flash, blinder…).
         * Predatan la API de EffectIntents (WAVE 373 → WAVE 2662).
         */
        this._layer3Effects = [];
        /**
         * L3 intents — EffectManager output pre-resuelto a fixtureId.
         * Se limpia al final de cada frame (garantía de frescura).
         * WAVE 2662.
         */
        this._layer3Intents = new Map();
        /** L4 — Blackout de emergencia. Dimmer → 0 en todos los fixtures. */
        this._layer4Blackout = false;
        // ── WAVE 3190: reuse buffers ─────────────────────────────────────────────
        this._manualIdsBuf = [];
        this._effectTypesBuf = [];
        this.config = { ...DEFAULT_LAYER_STATE_CONFIG, ...config };
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // LAYER 0 — TITAN AI
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Recibe el LightingIntent producido por TitanEngine cada frame.
     * Llamado por TitanOrchestrator / OrchestratorPipeline inmediatamente
     * antes de arbitrate().
     */
    setTitanIntent(intent) {
        this._layer0 = intent;
    }
    /** Devuelve el último intent de Titan. Null antes del primer frame. */
    getTitanIntent() {
        return this._layer0;
    }
    /** Limpia el intent de Titan (usado en reset / shutdown). */
    clearTitanIntent() {
        this._layer0 = null;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // LAYER 1 — CONSCIOUSNESS (FÓSIL / CORE 3)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Recibe modificadores de SeleneLuxConscious.
     * Es un no-op silencioso mientras consciousnessEnabled === false (CORE 3).
     * Retrocompatible con MasterArbiter.setConsciousnessModifier().
     */
    setConsciousnessModifier(modifier) {
        if (!this.config.consciousnessEnabled)
            return;
        this._layer1 = modifier;
    }
    /** Devuelve el modificador activo. Null hasta CORE 3. */
    getConsciousnessModifier() {
        return this._layer1;
    }
    /** Limpia el modificador de consciencia. */
    clearConsciousnessModifier() {
        this._layer1 = null;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // LAYER 2 — MANUAL OVERRIDE
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Registra o actualiza el override manual para un fixture.
     *
     * Semántica de merge (WAVE 3479.7 deep merge — retrocompatible con WAVE 2711):
     *   - Si ya existe un override para este fixture, los controles se fusionan
     *     en profundidad: el nuevo payload reemplaza los campos que trae, y
     *     preserva los campos que no trae (no-stomp por categoría de canal).
     *   - phantomChannels se fusionan de forma independiente (WAVE 2084).
     *   - overrideChannels es la unión de ambos sets.
     *
     * NOTA: la lógica de validación de fixtures (si el fixture existe en el
     * registro) es responsabilidad del caller (ArbitrationDirector / MasterArbiter).
     * LayerStateManager es agnóstico al patch de fixtures — sólo guarda overrides.
     */
    setManualOverride(override) {
        if (this._layer2.size >= this.config.maxManualOverrides &&
            !this._layer2.has(override.fixtureId)) {
            console.warn(`[LayerStateManager] L2 capacity reached (${this.config.maxManualOverrides}). Override for ${override.fixtureId} rejected.`);
            return;
        }
        const existing = this._layer2.get(override.fixtureId);
        if (existing) {
            // ── WAVE 3479.7: Deep merge ───────────────────────────────────────────
            const existingControls = existing.controls;
            const newControls = override.controls;
            // Merge phantom channels independently
            const mergedPhantom = {
                ...(existingControls['phantomChannels'] ?? {}),
                ...(newControls['phantomChannels'] ?? {}),
            };
            const mergedControls = {
                ...existingControls,
                ...newControls,
            };
            if (Object.keys(mergedPhantom).length > 0) {
                mergedControls['phantomChannels'] = mergedPhantom;
            }
            else {
                delete mergedControls['phantomChannels'];
            }
            // Union of channels — WAVE 2711: no stomp, both sets survive
            const mergedChannels = [
                ...new Set([...existing.overrideChannels, ...override.overrideChannels]),
            ];
            this._layer2.set(override.fixtureId, {
                ...existing,
                ...override,
                controls: mergedControls,
                overrideChannels: mergedChannels,
                timestamp: performance.now(),
            });
        }
        else {
            // ── New override ──────────────────────────────────────────────────────
            this._layer2.set(override.fixtureId, {
                ...override,
                timestamp: performance.now(),
            });
        }
    }
    /** Devuelve el override activo para un fixture, o undefined si no existe. */
    getManualOverride(fixtureId) {
        return this._layer2.get(fixtureId);
    }
    /**
     * Verifica si un fixture tiene override activo y, opcionalmente,
     * si ese override incluye un canal concreto.
     */
    hasManualOverride(fixtureId, channel) {
        const ov = this._layer2.get(fixtureId);
        if (!ov)
            return false;
        if (channel !== undefined)
            return ov.overrideChannels.includes(channel);
        return true;
    }
    /**
     * Libera canales específicos (o todos) del override de un fixture.
     *
     * Si `channels` es undefined → release total del fixture.
     * Si `channels` es un array → release parcial; el override sobrevive
     * con los canales restantes.
     *
     * NOTA: La lógica de crossfade, PositionReleaseFade y pattern-annihilation
     * que hoy vive en MasterArbiter.releaseManualOverride() se extraerá en WAVE 3505
     * como servicios independientes (PositionReleaseFader, MovementPatternEngine).
     * Esta clase solo gestiona el estado bruto de Layer 2.
     */
    releaseManualOverride(fixtureId, channels) {
        const ov = this._layer2.get(fixtureId);
        if (!ov)
            return;
        if (!channels) {
            // Full release
            this._layer2.delete(fixtureId);
            return;
        }
        // Partial release
        const remaining = ov.overrideChannels.filter(c => !channels.includes(c));
        if (remaining.length === 0) {
            this._layer2.delete(fixtureId);
        }
        else {
            ov.overrideChannels = remaining;
        }
    }
    /** Libera todos los overrides manuales (nuke total de L2). */
    releaseAllManualOverrides() {
        this._layer2.clear();
    }
    /**
     * Devuelve los fixture IDs con override activo.
     * WAVE 3190: reutiliza buffer para cero alloc en hot path.
     */
    getManualOverrideFixtureIds() {
        this._manualIdsBuf.length = 0;
        for (const k of this._layer2.keys())
            this._manualIdsBuf.push(k);
        return this._manualIdsBuf;
    }
    /** Número de overrides manuales activos. */
    getManualOverrideCount() {
        return this._layer2.size;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // LAYER 3 — LEGACY EFFECTS (WAVE 373 — pre-EffectIntents)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Registra un efecto temporal.
     * Si se alcanza el límite, elimina el más antiguo (FIFO).
     * startTime se estampa aquí para garantizar un reloj determinista.
     */
    addEffect(effect) {
        if (this._layer3Effects.length >= this.config.maxActiveEffects) {
            this._layer3Effects.shift();
        }
        this._layer3Effects.push({ ...effect, startTime: performance.now() });
    }
    /** Elimina un efecto por tipo. */
    removeEffect(type) {
        const idx = this._layer3Effects.findIndex(e => e.type === type);
        if (idx !== -1)
            this._layer3Effects.splice(idx, 1);
    }
    /** Elimina todos los efectos legacy. */
    clearEffects() {
        this._layer3Effects.length = 0;
    }
    /** Devuelve una vista de sólo lectura de los efectos activos. */
    getActiveEffects() {
        return this._layer3Effects;
    }
    /**
     * Expira efectos cuya duración ha vencido.
     * Devuelve los tipos que fueron eliminados (para que el caller emita eventos).
     *
     * WAVE 3190: muta en-place, cero alloc cuando no hay expirados.
     * Debe llamarse UNA VEZ al inicio de cada ciclo de arbitración.
     */
    tickExpiredEffects(now) {
        const expired = [];
        let i = this._layer3Effects.length - 1;
        while (i >= 0) {
            const fx = this._layer3Effects[i];
            if (now - fx.startTime >= fx.durationMs) {
                expired.push(fx.type);
                this._layer3Effects.splice(i, 1);
            }
            i--;
        }
        return expired;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // LAYER 3 — EFFECT INTENTS (WAVE 2662)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Inyecta el mapa de intents pre-resueltos (zona → fixtureId).
     * Llamado por TitanOrchestrator / OrchestratorPipeline ANTES de arbitrate().
     * Los intents se limpian al final del frame con clearEffectIntents().
     *
     * Retrocompatible con MasterArbiter.setEffectIntents():
     * La lógica de mover-shield (WAVE 3305/3307) y strip-movement (WAVE 3305)
     * es responsabilidad del caller antes de llamar aquí, o será extraída al
     * IntentComposer en WAVE 3505. LayerStateManager sólo almacena.
     */
    setEffectIntents(intents) {
        this._layer3Intents = intents;
    }
    /**
     * Devuelve el EffectIntent para un fixture concreto, o undefined si no existe.
     * Hot path: llamado por ArbitrationDirector para cada fixture × canal.
     */
    getEffectIntent(fixtureId) {
        return this._layer3Intents.get(fixtureId);
    }
    /** Devuelve el mapa completo de intents activos (read-only). */
    getEffectIntentsMap() {
        return this._layer3Intents;
    }
    /**
     * Limpia el mapa de intents al final de cada frame.
     * Garantía de frescura: si el Orchestrator no inyecta intents el siguiente
     * frame, ningún efecto queda zombie.
     * WAVE 2662: "frame freshness guarantee".
     */
    clearEffectIntents() {
        this._layer3Intents.clear();
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // LAYER 4 — BLACKOUT
    // ═══════════════════════════════════════════════════════════════════════════
    /** Activa el blackout (L4). Todos los dimmers → 0. Solo MOVE IN BLACK activo. */
    enableBlackout() {
        this._layer4Blackout = true;
    }
    /** Desactiva el blackout. */
    disableBlackout() {
        this._layer4Blackout = false;
    }
    /**
     * Alterna el estado del blackout.
     * Retrocompatible con MasterArbiter.toggleBlackout().
     * @returns true si el blackout quedó ACTIVO tras el toggle.
     */
    toggleBlackout() {
        this._layer4Blackout = !this._layer4Blackout;
        return this._layer4Blackout;
    }
    /** true si el blackout está activo. */
    isBlackoutActive() {
        return this._layer4Blackout;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // GLOBAL RESET
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Limpia el estado de todas las capas a sus valores por defecto.
     * Usado en shutdown, cambio de vibe radical (Amnesia Protocol), y tests.
     *
     * L4 (blackout) NO se toca: un resetAllLayers no debería levantar un
     * blackout de emergencia activo. Para eso existe disableBlackout() explícito.
     */
    resetAllLayers() {
        this._layer0 = null;
        this._layer1 = null;
        this._layer2.clear();
        this._layer3Effects.length = 0;
        this._layer3Intents.clear();
        // L4 intencionalmente preservado — ver doc arriba
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // DIAGNOSTICS
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Captura instantánea del estado de todas las capas.
     * WAVE 3504 §6: usada por tests de paridad frame-por-frame.
     */
    snapshot() {
        // WAVE 3190: buffer reutilizado para effect types
        this._effectTypesBuf.length = 0;
        for (const e of this._layer3Effects)
            this._effectTypesBuf.push(e.type);
        const manualIds = [];
        for (const k of this._layer2.keys())
            manualIds.push(k);
        return {
            layer0: this._layer0,
            layer1: this._layer1,
            layer2Count: this._layer2.size,
            layer2FixtureIds: manualIds,
            layer3EffectCount: this._layer3Effects.length,
            layer3EffectTypes: [...this._effectTypesBuf],
            layer3IntentCount: this._layer3Intents.size,
            layer4Blackout: this._layer4Blackout,
        };
    }
}
