/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚖️  AETHER MATRIX — NODE ARBITER (IMPLEMENTACIÓN)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.4: Implementación concreta del INodeArbiter.
 * WAVE 4775: El Árbitro de Hierro — refactor forense completo.
 * WAVE 4752: THE SMART GATE — Máscara granular per-node/per-channel.
 *
 * El NodeArbiter resuelve conflictos multicapa sobre los CapabilityNodes.
 * Opera sobre valores normalizados (0-1) producidos por los 5 Systems
 * y los hooks externos (Selene, Manual, Effects, Playback).
 *
 * ESTRATEGIAS DE MERGE POR CANAL (WAVE 4752):
 * - `dimmer`, `brightness` → LTP absoluto: L2 gana cuando está activo.
 *   L0 sigue fluyendo mientras L2 NO toque ese canal específico.
 * - `strobe`, `shutter` → PRIORIDAD ESTRICTA POR CAPA (L4>LP>L3>L2>L1>L0).
 *   HTP solo dentro de L0 (multi-fuente en el mismo bus).
 * - todos los demás → LTP por canal-tocado: L0 escribe si L2/LP NO
 *   escribieron ese canal en ese nodo específico.
 *
 * SMART GATE (WAVE 4752 — reemplaza OPAQUE MASK fixture-wide de WAVE 4775):
 * - Tracking per-node de los canales que L2/LP están tocando este frame.
 * - L0/L1 solo bloqueados en los canales exactos que L2/LP escribieron.
 * - Un toque de dimmer en :impact NO bloquea color de L0 en :color.
 * - Un toque de color en :color NO afecta dimmer de :impact.
 * - Release Time: al liberar un override, fade ease-out al estado L0.
 *
 * CAPAS (menor a mayor prioridad):
 * - L0: IntentBus (Systems — ColorSystem, ImpactSystem, KineticSystem…)
 * - L1: Selene IA overrides
 * - L2: Manual overrides (MIDI, OSC, UI faders)
 * - L3: Effect intents (LiveFXEngine)
 * - LP: Playback intents (Chronos Timeline)
 * - L4: Blackout (state flag; el gate final se aplica en egress)
 *
 * ZERO-ALLOC EN HOT PATH:
 * - `_result` es un Map pre-existente que se muta in-place cada frame.
 * - Los Records internos se reusan vía `_resultPool` (object pool).
 * - `_opaqueNodeChannels` usa Set pool — sin alloc en hot path.
 * - No se crean nuevos Maps, Sets ni Arrays durante `arbitrate()`.
 *
 * WAVE 4914 — RELATIVE OFFSET ROUTING:
 * - Sustituye el pin absoluto del bloque L2-MOTOR por una fusión aditiva final.
 * - L2 (IK / AetherKineticEngine) escribe `pan_base`/`tilt_base` (centro de gravedad).
 * - L0 (KineticAdapter VMM) escribe `pan_offset`/`tilt_offset` ∈ [-1,+1] (órbita).
 * - Fórmula: `pan_final = clamp01(pan_base + pan_offset * amp * aspect * distScale * gimbalFactor)`.
 * - Gimbal Lock fade en pan_offset cuando tilt_base ≈ 0.5 (haz cenital/nadiral).
 *
 * @module core/aether/NodeArbiter
 * @version WAVE 4914 — Relative Offset Routing
 */
// ── Canales con prioridad estricta por capa (WAVE 4775 / 4752) ─────────────
// strobe/shutter: prioridad estricta descendente (L4>LP>L3>L2>L1>L0).
// HTP solo dentro de L0 (multi-fuente en el mismo bus).
// dimmer/brightness: ahora LTP absoluto — L2 gana cuando está activo;
// L0 sigue fluyendo si L2 NO toca ese canal en ese nodo.
const STRICT_PRIORITY_CHANNELS = new Set(['strobe', 'shutter']);
// ── WAVE 4752: SMART GATE — bloqueo per-node/per-channel ────────────────────
// Reemplaza OPAQUE_BLOCKED_CHANNELS_L0_L1 (fixture-wide).
// El tracking de canales-tocados se hace en _opaqueNodeChannels y
// _opaquePlaybackChannels, populados en arbitrate() antes de aplicar L0/L1.
// No es una lista estática — es un mapa dinámico por canal exacto.
const MOVER_SHIELD_BLOCKED_CHANNELS = new Set([
    'r', 'g', 'b',
    'red', 'green', 'blue',
    'white', 'amber',
]);
// ── Canales excluidos del Hard Lock (siguen lógica especial del motor cinético)
const MANUAL_HARD_LOCK_EXCLUDED_CHANNELS = new Set(['pan_base', 'tilt_base']);
// WAVE 4825: overrides flash de Tungsten no deben activar bloqueo fixture-wide
// legacy de WAVE 4713, o el wash del mismo fixture pierde L0 durante hold.
const FIXTURE_DIMMER_LOCK_EXEMPT_FAMILIES = new Set([
    'golden-master',
    'petal-l',
    'petal-c',
    'petal-r',
]);
// ── WAVE 4871: L3 LUMINANCE GAG — canales de luminancia del fixture padre ─────
// Si L3 (effect/hephaestus) escribe en CUALQUIER canal de un nodo :impact o
// :color, TODOS estos canales quedan dominados en _l3DominatedChannels para
// el fixture padre completo. L0 queda físicamente amordazado en luminancia.
const L3_LUMINANCE_GAG_CHANNELS = new Set([
    'dimmer', 'strobe', 'shutter', 'master_brightness', 'brightness',
]);
// Familias de nodo que disparan el Gag cuando L3 las escribe
const L3_GAG_TRIGGER_FAMILIES = new Set(['impact', 'color']);
// ── WAVE 4752: Canales con duración de release larga (movers) ────────────────
// Estos canales usan RELEASE_MS_SLOW (1000ms) al soltar el override.
// El resto usa RELEASE_MS_FAST (200ms).
const SLOW_RELEASE_CHANNELS = new Set(['pan', 'tilt', 'zoom', 'focus', 'rotation']);
const RELEASE_MS_FAST = 200;
const RELEASE_MS_SLOW = 1000;
const PHOTON_TRACER_EVERY_FRAMES = 20;
// ── WAVE 4914: Relative Offset Routing ────────────────────────────────
// Factor de escala que mapea offset ∈ [-1,+1] a desviación DMX normalizada.
// 0.5 = legacy split-brain: `(x+1)/2 = 0.5 + x*0.5` se preserva cuando
// la base es 0.5 (sin IK), garantizando cero regresión visual.
const RELATIVE_OFFSET_SCALE_PAN = 0.5;
const RELATIVE_OFFSET_SCALE_TILT = 0.5;
// WAVE 4980: Límite físico superior del tilt en espacio normalizado [0, 1].
// Corresponde a ~217 DMX — impide que la fusión empuje el haz a posiciones
// extremas de hardware independientemente del origen del valor (IK o VMM).
const TILT_ARBITER_MAX = 0.85;
// Gimbal Lock fade: cuando el haz apunta cerca del cenit (tilt_base ≈ 0.5),
// el pan offset rota la carcasa sin desplazamiento visual del beam. Atenuamos
// el offset de pan dentro de una banda de ±GIMBAL_TILT_FADE_HALFWIDTH alrededor
// del centro para evitar el "spinning hat" mecánico.
const GIMBAL_TILT_CENTER = 0.5;
const GIMBAL_TILT_FADE_HALFWIDTH = 10 / 255; // ~10 DMX byte = ~3.9% norm space
const RELATIVE_FUSION_LOG_EVERY_FRAMES = 220;
function isFiniteChannelValue(value) {
    return value !== undefined && Number.isFinite(value);
}
/**
 * NodeArbiter — Implementación zero-alloc del árbitro multicapa.
 */
export class NodeArbiter {
    constructor() {
        // ── Estado por frame ──────────────────────────────────────────────────
        /** Bus de intents de los Systems (L0) */
        this._systemBus = null;
        /** Overrides Selene IA (L1) — array legacy */
        this._seleneOverrides = [];
        /**
         * WAVE 4663 — Bus dedicado de Selene (L1).
         * Se actualiza cada frame por TitanOrchestrator antes de arbitrate().
         * Cuando count === 0 (Silence Rule), la capa L1 es un no-op completo
         * y la capa L0 (Liquid/VMM) retoma el control instantáneamente.
         */
        this._seleneBus = null;
        /** Manual overrides (L2): nodeId → { channel: value } */
        this._manualOverrides = new Map();
        /** WAVE 4670: Mapa de nodos COLOR protegidos por Mover Shield en L1 */
        this._moverShieldNodeIds = new Set();
        /**
         * WAVE 4829: ABSOLUTE L3 OVERRIDE — Escudo Anti-Sangrado.
         * Registra los nodos + canales que L3 (effect/hephaestus) escribe en este frame.
         * L0 (system) y L1 (selene) NUNCA pueden sobrepasar a L3 en esos canales.
         * Limpiado al inicio de cada arbitrate(). Pool compartido con _opaqueNodeChannels.
         */
        this._l3DominatedChannels = new Map();
        /**
         * Pasaporte diplomático por frame para la capa Selene (L1).
         * Cuando está activo, los canales de color NO son bloqueados por Mover Shield.
         */
        this._seleneOverrideMoverShield = false;
        /**
         * WAVE 4918.5: Nodos COLOR que L3 (Hephaestus) escribió en este frame.
         * Cuando Hephaestus emite color a un nodo mover (rueda de colores físicas),
         * L0 (Selene IA) debe callar COMPLETAMENTE en ese nodo.
         * Limpiado al inicio de cada arbitrate() junto con _l3DominatedChannels.
         */
        this._l3HephColorNodeIds = new Set();
        /**
         * WAVE 4670: Lock de dimmer manual explícito (L2) por frame.
         * Si el operador toca dimmer, ese valor se vuelve piso HTP del canal.
         */
        /**
         * WAVE 4713: Fixtures con dimmer manual activo (prefijo fixtureId).
         * Se usa para bloquear intents L0 no cinéticos que causen tics visuales.
         */
        this._manualDimmerFixtureIds = new Set();
        this._manualDimmerLocks = new Map();
        this._manualChannelLocks = new Map();
        /**
         * Inhibit limits (L2.5 — post-arbitraje, pre-retorno):
         * nodeId → cap 0-1 aplicado al canal `dimmer` del nodo.
         * Semánticamente: Grand Master per-fixture. No afecta L4 (blackout).
         * WAVE 4531: Opción B — el cap vive aquí, no en el bridge ni en el store.
         */
        this._inhibitLimits = new Map();
        /** Effect intents (L3) */
        this._effectIntents = [];
        /** 🔬 WAVE 4832 DIAG: contador de frames con intents L3 (anti-spam). */
        this._diagL3FrameCount = 0;
        /** Hephaestus custom clip intents (L3+ — Diamond Data direct curves) */
        this._hephaestusIntents = [];
        /** Playback intents (LP — Chronos Timeline, prioridad entre L1-L3) */
        this._playbackIntents = [];
        /**
         * WAVE 4752: SMART GATE — Tracking per-node de canales tocados por L2.
         * Key = nodeId, Value = Set de nombres de canal que L2 escribió este frame.
         * L0/L1 solo bloqueados en los canales exactos presentes en estos Sets.
         * Populado y limpiado cada frame en arbitrate(). Pool de Sets para zero-alloc.
         */
        this._opaqueNodeChannels = new Map();
        /**
         * WAVE 4752: SMART GATE — Tracking per-node de canales tocados por LP.
         * Misma semántica que _opaqueNodeChannels pero para Playback Timeline.
         */
        this._opaquePlaybackChannels = new Map();
        /** Pool de Sets reutilizables para zero-alloc en _opaqueNodeChannels/LP */
        this._channelSetPool = [];
        this._channelSetCursor = 0;
        /**
         * WAVE 4752: RELEASE TIME — estados de fade al soltar overrides manuales.
         * Key = nodeId, Value = snapshot del override en el momento del clear.
         * Se interpola ease-out cúbico durante la duración configurada.
         */
        this._releaseStates = new Map();
        /** Grand Master (0-1) — multiplica todos los canales HTP */
        this._grandMaster = 1.0;
        /** Blackout flag (L4) — se aplica en egress selectivo de intensidad */
        this._blackout = false;
        // ── Buffers de salida pre-allocated ───────────────────────────────────
        /**
         * Mapa de resultado reutilizado frame a frame.
         * Key = nodeId, Value = Record<string, number> (valores 0-1 por canal).
         * Se muta in-place en `arbitrate()` — zero new Map() en hot path.
         */
        this._result = new Map();
        /**
         * Pool de Records reutilizables — evita `{} ` en el hot path.
         * Crece hasta el número máximo de nodos activos simultáneamente
         * y luego se estabiliza (amortización GC).
         */
        this._resultPool = [];
        this._poolCursor = 0;
        this._photonTracerFrame = 0;
        /**
         * WAVE L2-SUPREMACY: Output del motor cinético nativo (AetherKineticEngine).
         * Mapa separado de _manualOverrides — sin colisión con anchor del radar ni con
         * ProgrammerAetherBridge. Se aplica como última autoridad en arbitrate(),
         * después del MANUAL HARD LOCK y del Grand Master.
         * Key = `${fixtureId}:kinetic`, Value = { pan_base, tilt_base } computados.
         */
        this._motorKineticOverrides = new Map();
        /**
         * WAVE 4914: Amplitud global del flujo de offset relativo (escala el offset VMM).
         * 1.0 = legacy (preserva el mapeo `(intent.x+1)/2` cuando no hay base IK).
         * <1.0 = órbitas más pequeñas. >1.0 = sobrepasa el envelope (se recorta con clamp01).
         * Seteado externamente desde AetherIPCHandlers / Programmer UI.
         */
        this._relativeOffsetAmplitude = 1.0;
        /**
         * WAVE 4914: Scale por nodo derivado de la distancia fixture→target.
         * Pre-computado en patch-time por `applySpatialTarget`. Default 1.0.
         * Permite que un mismo offset DMX produzca un arco visual similar para
         * fixtures cercanos y lejanos al objetivo (ver blueprint §3.2).
         */
        this._spatialDistanceScales = new Map();
        /** WAVE 4914: contador throttled de logs de fusión. */
        this._fusionLogCounter = 0;
    }
    // ── INodeArbiter API ──────────────────────────────────────────────────
    setSystemIntents(bus) {
        this._systemBus = bus;
    }
    setSeleneOverrides(intents) {
        this._seleneOverrides = intents;
    }
    /**
     * WAVE 4663 — Registra el bus de L1 de Selene.
     * Llamado una vez durante la inicialización del motor.
     * El bus se limpia y rellena cada frame antes de arbitrate().
     */
    setSeleneBus(bus) {
        this._seleneBus = bus;
    }
    setManualOverride(nodeId, channels) {
        const existing = this._manualOverrides.get(nodeId);
        if (existing !== undefined) {
            // Merge in-place: los canales entrantes actualizan los existentes sin borrar otros.
            // Garantiza que KineticsBridge (anchor pan_base/tilt_base) y ProgrammerAetherBridge
            // (speed) no se destruyan mutuamente al escribir el mismo nodo :kinetic.
            const mutable = existing;
            for (const key in channels) {
                mutable[key] = channels[key];
            }
        }
        else {
            this._manualOverrides.set(nodeId, channels);
        }
        // WAVE 4828: Cancel release fade si está en progreso para este nodo
        // para evitar conflicto con el nuevo override
        this._releaseStates.delete(nodeId);
    }
    /**
     * WAVE 4670: Inyecta el set de nodos COLOR de movers con rueda física.
     * Se calcula en patch time desde TitanOrchestrator; costo 0 en hot-path.
     */
    setMoverShieldNodeIds(nodeIds) {
        this._moverShieldNodeIds.clear();
        for (let i = 0; i < nodeIds.length; i++) {
            this._moverShieldNodeIds.add(nodeIds[i]);
        }
    }
    /**
     * WAVE 4675: Permite a efectos diplomáticos de Selene colorear movers
     * con rueda física en ventanas controladas (DarkSpin + HarmonicQuantizer
     * siguen siendo la barrera mecánica real en resolver/egress).
     */
    setSeleneOverrideMoverShield(active) {
        this._seleneOverrideMoverShield = active;
    }
    clearManualOverride(nodeId, _releaseMs) {
        const channels = this._manualOverrides.get(nodeId);
        if (channels) {
            // Capturar snapshot para el fade de retorno
            const snapshot = {};
            const durationByChannel = {};
            for (const key in channels) {
                const v = channels[key];
                if (typeof v === 'number' && Number.isFinite(v)) {
                    snapshot[key] = v;
                    durationByChannel[key] = SLOW_RELEASE_CHANNELS.has(key) ? RELEASE_MS_SLOW : RELEASE_MS_FAST;
                }
            }
            if (Object.keys(snapshot).length > 0) {
                this._releaseStates.set(nodeId, {
                    channels: snapshot,
                    startedAtMs: performance.now(),
                    durationByChannel,
                });
            }
        }
        this._manualOverrides.delete(nodeId);
        // WAVE 4984 Paso 2: NO borrar _motorKineticOverrides aquí.
        // WAVE 4935 M2 lo hacía como "Ghost Anchor fix", pero causa amnesia IK:
        // apagar un patrón (clearManualOverride) borraba el target espacial IK,
        // de modo que al reactivar el patrón, ikPan/ikTilt eran undefined y el
        // fallback era anchorPan=0.5 → foco pierde su target y se va al centro.
        // Regla de Oro: _motorKineticOverrides SOLO se limpia desde clearMotorKineticOverride,
        // que es llamado exclusivamente por releaseSpatialTarget (botón Unlock del operador)
        // y removeNodes (cuando el engine elimina la pista por completo).
    }
    /**
     * WAVE L2-SUPREMACY: Registra el output computado del motor cinético nativo.
     * Solo AetherKineticEngine debe llamar este método.
     * Separado de _manualOverrides para evitar colisión anchor↔output.
     */
    setMotorKineticOverride(nodeId, channels) {
        this._motorKineticOverrides.set(nodeId, channels);
    }
    clearMotorKineticOverride(nodeId) {
        this._motorKineticOverrides.delete(nodeId);
    }
    /**
     * WAVE 4916: Lectura del override del motor cinético (IK puro o motor pattern).
     * Devuelve `{ pan_base, tilt_base }` si el fixture tiene un Spatial Target IK
     * activo. Usado por `setManualPattern` para preservar la posición IK como
     * anchor cuando el operador activa un patrón sobre un fixture ya apuntando
     * a un target 3D — evita el snap destructivo a (0.5, 0.5).
     */
    getMotorKineticOverride(nodeId) {
        return this._motorKineticOverrides.get(nodeId);
    }
    clearAllMotorKineticOverrides() {
        this._motorKineticOverrides.clear();
    }
    /**
     * WAVE 4718: Lectura del anchor de L2 para el motor cinético.
     * Devuelve los `pan_base`/`tilt_base` actuales del nodo (0-1),
     * o undefined si no hay override manual para ese nodeId.
     * Zero-lock: solo lectura del Map, sin alloc.
     */
    getManualOverride(nodeId) {
        return this._manualOverrides.get(nodeId);
    }
    setEffectIntents(intents) {
        this._effectIntents = intents;
    }
    setHephaestusIntents(intents) {
        this._hephaestusIntents = intents;
    }
    setPlaybackIntents(intents) {
        this._playbackIntents = intents;
    }
    setBlackout(active) {
        this._blackout = active;
    }
    isBlackoutActive() {
        return this._blackout;
    }
    setGrandMaster(value) {
        this._grandMaster = value < 0 ? 0 : value > 1 ? 1 : value;
    }
    getGrandMaster() {
        return this._grandMaster;
    }
    /**
     * Ejecuta el arbitraje para el frame actual.
     *
     * PIPELINE:
     * 1. Reset del _resultPool cursor (reuse sin alloc)
     * 2. Recoger todos los intents de todas las capas en el _result
     * 3. Para cada canal de cada nodo, aplicar la estrategia de merge
     * 4. Aplicar Grand Master sobre canales HTP
    * 5. Retornar el _result como ArbitratedNodeMap (sin copiar)
     *
     * @returns Mapa inmutable de valores finales por nodo/canal (0-1)
     */
    arbitrate() {
        this._photonTracerFrame++;
        // 1. Reset pool cursor — los objetos del pool se reusan
        this._poolCursor = 0;
        // Limpiar el mapa de resultado anterior
        this._result.clear();
        this._opaqueNodeChannels.clear();
        this._opaquePlaybackChannels.clear();
        this._l3DominatedChannels.clear();
        // WAVE 4752: SMART GATE — pre-computar canales tocados por L2/LP por nodo.
        // Sustituye el fixture-wide opaque mask de WAVE 4775.
        // L0/L1 solo bloqueados en los canales exactos que L2/LP están escribiendo.
        this._channelSetCursor = 0;
        this._opaqueNodeChannels.clear();
        this._opaquePlaybackChannels.clear();
        // WAVE 4829: ABSOLUTE L3 OVERRIDE — limpiar mapa de dominación L3 del frame anterior.
        this._l3DominatedChannels.clear();
        // WAVE 4918.5: limpiar nodos Hephaestus-color silenciadores de L0
        this._l3HephColorNodeIds.clear();
        // L2: registrar canales tocados por nodo
        for (const [nodeId, channels] of this._manualOverrides) {
            let set = this._opaqueNodeChannels.get(nodeId);
            if (!set) {
                set = this._acquireChannelSet();
                this._opaqueNodeChannels.set(nodeId, set);
            }
            for (const key in channels) {
                const v = channels[key];
                if (typeof v === 'number' && Number.isFinite(v))
                    set.add(key);
            }
        }
        // LP: registrar canales tocados por nodo
        for (let i = 0; i < this._playbackIntents.length; i++) {
            const intent = this._playbackIntents[i];
            let set = this._opaquePlaybackChannels.get(intent.nodeId);
            if (!set) {
                set = this._acquireChannelSet();
                this._opaquePlaybackChannels.set(intent.nodeId, set);
            }
            for (const key in intent.values) {
                const v = intent.values[key];
                if (typeof v === 'number' && Number.isFinite(v))
                    set.add(key);
            }
        }
        // WAVE 4713 COMPAT: dimmer fixture tracking sigue activo para bloquear
        // intents de familia completa (kinetic/atmosphere pasan igual).
        this._manualDimmerFixtureIds.clear();
        for (const [nodeId, channels] of this._manualOverrides) {
            const manualDimmer = channels['dimmer'];
            if (!isFiniteChannelValue(manualDimmer))
                continue;
            const sep = nodeId.lastIndexOf(':');
            if (sep <= 0)
                continue;
            const family = nodeId.slice(sep + 1);
            if (FIXTURE_DIMMER_LOCK_EXEMPT_FAMILIES.has(family))
                continue;
            this._manualDimmerFixtureIds.add(nodeId.slice(0, sep));
        }
        // ⚡ WAVE 4917: L3 DOMINANCE PRE-PASS.
        // Construir el mapa de dominación ANTES de aplicar L0/L1 para que
        // el blindaje intra-frame sea real (L0 no llega a escribir lo que L3
        // ya reclama en effect/hephaestus durante este mismo arbitrate()).
        this._primeL3DominancePrePass();
        // 2. Recolectar intents en orden ascendente de prioridad de capa.
        //    El orden de escritura garantiza que las capas superiores
        //    sobreescriban a las inferiores en el merge LTP.
        // L0: System intents (IntentBus)
        if (this._systemBus) {
            const all = this._systemBus.getAll();
            for (let i = 0; i < all.length; i++) {
                this._applyIntent(all[i], 'system');
            }
        }
        // L1: Selene IA overrides
        // WAVE 4663: bus dedicado (zero-alloc). Si count=0 (Silence Rule) → no-op total.
        // L0 (Liquid/VMM) retoma el control en el mismo frame en que Selene calla.
        if (this._seleneBus !== null) {
            const count = this._seleneBus.count;
            for (let i = 0; i < count; i++) {
                this._applyIntent(this._seleneBus.getAt(i), 'selene');
            }
        }
        else {
            // Fallback legacy: array de overrides pre-WAVE-4663
            for (let i = 0; i < this._seleneOverrides.length; i++) {
                this._applyIntent(this._seleneOverrides[i], 'selene');
            }
        }
        // LP: Playback (Chronos Timeline) — entre L1 y L3
        for (let i = 0; i < this._playbackIntents.length; i++) {
            this._applyIntent(this._playbackIntents[i], 'playback');
        }
        // L2: Manual overrides (UI Hold)
        // Se aplican directamente sobre el _result, sin pasar por _applyIntent
        this._manualDimmerLocks.clear();
        this._manualChannelLocks.clear();
        // 🔬 WAVE 4735.6 DIAG: log every 200 frames how many L2 overrides we have
        const _l2Count = this._manualOverrides.size;
        if (this._photonTracerFrame % 200 === 0 && _l2Count > 0) {
            const _sampleKeys = [...this._manualOverrides.keys()].slice(0, 3);
            console.log(`[NodeArbiter L2-DIAG] frame=${this._photonTracerFrame} | ` +
                `manualOverrides=${_l2Count} | samples:[${_sampleKeys.join(',')}]`);
        }
        for (const [nodeId, channels] of this._manualOverrides) {
            let record = this._result.get(nodeId);
            if (!record) {
                record = this._acquireRecord();
                this._result.set(nodeId, record);
            }
            const manualDimmer = channels['dimmer'];
            if (isFiniteChannelValue(manualDimmer)) {
                const clamped = manualDimmer < 0 ? 0 : manualDimmer > 1 ? 1 : manualDimmer;
                this._manualDimmerLocks.set(nodeId, clamped);
            }
            // WAVE 4661 PASO 1 — escritura directa + órbita relativa.
            // Canales estándar (pan, tilt, dimmer…): LTP normal.
            // Canales orbit (pan_base, tilt_base): en lugar de sobrescribir,
            //   suman la desviación del LFO de L0 respecto al centro (0.5).
            //   resultado = clamp01(base + (L0 - 0.5))
            //   → el patrón gira siempre alrededor del punto exacto del radar.
            for (const key in channels) {
                const incoming = channels[key];
                if (!isFiniteChannelValue(incoming)) {
                    continue;
                }
                if (!MANUAL_HARD_LOCK_EXCLUDED_CHANNELS.has(key)) {
                    let lockRecord = this._manualChannelLocks.get(nodeId);
                    if (!lockRecord) {
                        lockRecord = {};
                        this._manualChannelLocks.set(nodeId, lockRecord);
                    }
                    lockRecord[key] = incoming;
                }
                // pan_base/tilt_base en _manualOverrides son el anchor del radar (escritos por
                // KineticsBridge._flushClassic). Se almacenan tal cual — NO se traducen a pan/tilt
                // aquí. La traducción final ocurre exclusivamente en el bloque L2-MOTOR
                // (post-hardlock), ejecutado por AetherKineticEngine vía _motorKineticOverrides.
                record[key] = incoming;
            }
        }
        // L3: Effect intents (WAVE 4705 — autoridad sobre L2 manual)
        // WAVE 4829: Se aplica ANTES de L2 en el flujo de datos internos para
        // poder registrar dominación. El MANUAL HARD LOCK sigue siendo la
        // autoridad final del operador humano (paso post-L3 abajo).
        // 🔬 WAVE 4832 DIAG: contador para verificar arrival de intents L3.
        if (this._effectIntents.length > 0) {
            this._diagL3FrameCount++;
            if (this._diagL3FrameCount % 60 === 1) {
                // Sample 1ª intent para confirmar valores
                const sample = this._effectIntents[0];
                const sampleVals = Object.entries(sample.values)
                    .map(([k, v]) => `${k}=${v.toFixed(2)}`)
                    .join(',');
                console.log(`[NodeArbiter 🔬] L3 intents=${this._effectIntents.length} sample[${sample.nodeId}] merge=${sample.mergeStrategy ?? '?'} ${sampleVals}`);
            }
        }
        for (let i = 0; i < this._effectIntents.length; i++) {
            this._applyIntent(this._effectIntents[i], 'effect');
        }
        // L3+: Hephaestus custom intents (Diamond Data direct curves)
        for (let i = 0; i < this._hephaestusIntents.length; i++) {
            this._applyIntent(this._hephaestusIntents[i], 'hephaestus');
        }
        // 🔬 WAVE-4913 DIAG: log L3+ result ANTES del MANUAL HARD LOCK para confirmar
        // si el color de Hephaestus está ganando sobre L0 en el mapa arbitrado.
        if (this._hephaestusIntents.length > 0 && this._photonTracerFrame % 44 === 1) {
            const firstHeph = this._hephaestusIntents[0];
            const resultRecord = this._result.get(firstHeph.nodeId);
            const red = resultRecord?.['red'] ?? resultRecord?.['r'] ?? 'N/A';
            const green = resultRecord?.['green'] ?? resultRecord?.['g'] ?? 'N/A';
            const blue = resultRecord?.['blue'] ?? resultRecord?.['b'] ?? 'N/A';
            const l2Lock = this._manualChannelLocks.has(firstHeph.nodeId);
            console.log(`[NodeArbiter 🎨 HEPH-RESULT] frame=${this._photonTracerFrame} | ` +
                `node=${firstHeph.nodeId} | ` +
                `result red=${red} g=${green} b=${blue} | ` +
                `L2-lock-will-override=${l2Lock} | ` +
                `hephIntents=${this._hephaestusIntents.length}`);
        }
        // WAVE 4714: MANUAL HARD LOCK (ley del operador).
        // Reaplica todos los canales manuales L2 (salvo orbit base channels)
        // después de L3/L3+ para evitar intrusiones de capas automáticas.
        if (this._manualChannelLocks.size > 0) {
            for (const [nodeId, lockChannels] of this._manualChannelLocks) {
                let record = this._result.get(nodeId);
                if (!record) {
                    record = this._acquireRecord();
                    this._result.set(nodeId, record);
                }
                for (const ch in lockChannels) {
                    const v = lockChannels[ch];
                    if (!isFiniteChannelValue(v))
                        continue;
                    record[ch] = v;
                }
            }
        }
        // WAVE 4752: MANUAL INTENSITY LOCK — node-wide (no fixture-wide).
        // Solo el nodo que el operador tocó queda lockeado en dimmer/brightness.
        // Los nodos hermanos (otros cells, otras familias) siguen siendo
        // gobernados por L0 según sus propias reglas LTP.
        if (this._manualDimmerLocks.size > 0) {
            for (const [nodeId, lockValue] of this._manualDimmerLocks) {
                let record = this._result.get(nodeId);
                if (!record) {
                    record = this._acquireRecord();
                    this._result.set(nodeId, record);
                }
                record['dimmer'] = lockValue;
                record['brightness'] = lockValue;
            }
        }
        // 3. Aplicar Grand Master sobre canales de intensidad.
        // dimmer y brightness son ahora LTP (no están en STRICT_PRIORITY_CHANNELS)
        // pero sí escalan con el Grand Master.
        if (this._grandMaster !== 1.0) {
            for (const record of this._result.values()) {
                for (const ch of STRICT_PRIORITY_CHANNELS) {
                    if (ch in record) {
                        record[ch] = record[ch] * this._grandMaster;
                    }
                }
                if ('dimmer' in record)
                    record['dimmer'] = record['dimmer'] * this._grandMaster;
                if ('brightness' in record)
                    record['brightness'] = record['brightness'] * this._grandMaster;
            }
        }
        // 4. WAVE 4531: Aplicar inhibit limits (L2.5, post-arbitraje).
        // Cap sobre el canal 'dimmer' del nodo registrado.
        // Se aplica DESPUÉS del Grand Master, ANTES de retornar.
        // El blackout se aplica en egress selectivo, no en el arbitraje.
        if (this._inhibitLimits.size > 0) {
            for (const [nodeId, limit] of this._inhibitLimits) {
                const record = this._result.get(nodeId);
                if (record && 'dimmer' in record) {
                    const capped = record['dimmer'] * limit;
                    record['dimmer'] = capped < 0 ? 0 : capped > 1 ? 1 : capped;
                }
            }
        }
        // ⚡ WAVE 4914 — RELATIVE OFFSET FUSION (L2 Base + L0 Offset).
        // Sustituye al antiguo pin absoluto del L2-MOTOR. Para cada nodo:
        //   pan_final  = clamp01(pan_base  + pan_offset  * amp * aspect * dist_k)
        //   tilt_final = clamp01(tilt_base + tilt_offset * amp * aspect * dist_k)
        // Cuando no hay base, fallback a 0.5 (centro neutro → mapeo legacy).
        // Cuando no hay offset, fallback a 0 (base pura sin órbita).
        this._applyRelativeOffsetFusion();
        // WAVE 4984 Paso 1a: RELEASE FADES — interpolación ease-out al soltar overrides.
        // Se aplica DESPUÉS de _applyRelativeOffsetFusion para que el blend compare
        // el snapshot del manual contra el valor ya fusionado y clampeado (TILT_ARBITER_MAX).
        // Antes (WAVE 4752) corría antes de la fusión: el fade degradaba hacia 0 cuando
        // L0 no había escrito 'tilt', enviando el mover al techo en ceiling mounts.
        if (this._releaseStates.size > 0) {
            this._applyReleaseFades();
        }
        return this._result;
    }
    /**
     * WAVE 4914 — RELATIVE OFFSET FUSION.
     *
     * Mezclador aditivo final: combina la base estática del IK / radar (L2)
     * con el offset orbital del VMM (L0). Sustituye al gate de exclusión del
     * antiguo bloque L2-MOTOR.
     *
     * Fórmula por canal:
     *   final = clamp01(base + offset * amp * aspect * distScale * gimbalFactor)
     *
     * Donde:
     *   base       = motor.pan_base ∥ manual.pan_base ∥ 0.5 (centro neutro)
     *   offset     = record.pan_offset ∥ 0 (sin órbita)
     *   amp        = this._relativeOffsetAmplitude (slider del Programmer)
     *   aspect     = RELATIVE_OFFSET_SCALE_PAN (0.5 — preserva legacy)
     *   distScale  = this._spatialDistanceScales[nodeId] ∥ 1.0
     *   gimbalFactor = solo en pan, atenuado cuando tilt_base ≈ 0.5
     *
     * INVARIANTE: cero alloc. Solo aritmética + lookups O(1) en Maps existentes.
     */
    _applyRelativeOffsetFusion() {
        const amp = this._relativeOffsetAmplitude;
        const ampPan = amp * RELATIVE_OFFSET_SCALE_PAN;
        const ampTilt = amp * RELATIVE_OFFSET_SCALE_TILT;
        const intentsByFixture = Object.fromEntries(this._result);
        // Tracker para telemetría throttled.
        let sampleNodeId = null;
        let samplePan = 0;
        let sampleTilt = 0;
        let samplePanOffset = 0;
        let sampleTiltOffset = 0;
        let sampleBasePan = 0;
        let sampleBaseTilt = 0;
        let fusionCount = 0;
        // Garantizar que cualquier nodo con base IK/motor pero sin L0 offset
        // siga presente en _result (el VMM puede no haber emitido para él).
        for (const [nodeId] of this._motorKineticOverrides) {
            if (!this._result.has(nodeId)) {
                this._result.set(nodeId, this._acquireRecord());
            }
        }
        for (const [nodeId, record] of this._result) {
            const panOffset = record['pan_offset'];
            const tiltOffset = record['tilt_offset'];
            const hasPanOffset = isFiniteChannelValue(panOffset);
            const hasTiltOffset = isFiniteChannelValue(tiltOffset);
            const motor = this._motorKineticOverrides.get(nodeId);
            const manual = this._manualOverrides.get(nodeId);
            const motorPan = motor ? motor['pan_base'] : undefined;
            const motorTilt = motor ? motor['tilt_base'] : undefined;
            const manualPan = manual ? manual['pan_base'] : undefined;
            const manualTilt = manual ? manual['tilt_base'] : undefined;
            const hasMotorPan = isFiniteChannelValue(motorPan);
            const hasMotorTilt = isFiniteChannelValue(motorTilt);
            const hasManualPan = isFiniteChannelValue(manualPan);
            const hasManualTilt = isFiniteChannelValue(manualTilt);
            const hasBasePan = hasMotorPan || hasManualPan;
            const hasBaseTilt = hasMotorTilt || hasManualTilt;
            // Skip nodos sin base ni offset — no son cinéticos en este frame.
            if (!hasBasePan && !hasBaseTilt && !hasPanOffset && !hasTiltOffset) {
                continue;
            }
            // WAVE 4933.2: L2 ABSOLUTE SUPREMACY.
            // Si _manualOverrides tiene pan/tilt ABSOLUTO (radar touch sin patrón)
            // pero NO pan_base/tilt_base (que indicaría modo órbita con patrón activo),
            // el offset de L0 (VMM automático) se descarta por completo.
            // Los valores absolutos ya están en el record desde _applyIntent('manual').
            // Doctrina: tocar el radar = congelación total de la automatización L0.
            const manualAbsPan = manual ? manual['pan'] : undefined;
            const manualAbsTilt = manual ? manual['tilt'] : undefined;
            const hasAbsoluteManualLock = (isFiniteChannelValue(manualAbsPan) && !hasManualPan) ||
                (isFiniteChannelValue(manualAbsTilt) && !hasManualTilt);
            if (hasAbsoluteManualLock)
                continue;
            const sep = nodeId.indexOf(':');
            const fixtureId = sep >= 0 ? nodeId.slice(0, sep) : nodeId;
            // [WAVE 4936] RADAR TELEMETRY TRAP
            if (manual && (manual['pan'] !== undefined || manual['pan_base'] !== undefined)) {
                // Filtramos para loguear solo un fixture y evitar spam en consola
                if (fixtureId === Object.keys(intentsByFixture)[0]) {
                    console.warn(`[ARBITER DIAG] Fixture: ${fixtureId}`, {
                        payload_pan: manual['pan'],
                        payload_base: manual['pan_base'],
                        hasMotorPan: hasMotorPan,
                        isHoldActive: (!hasMotorPan && !hasMotorTilt)
                    });
                }
            }
            // WAVE 4934 M1: HOLD STATE DETECTION.
            // _manualOverrides tiene pan_base/tilt_base (anchor del radar escrito por
            // _flushClassic al activar el patrón) pero _motorKineticOverrides NO tiene
            // nada (removeNodes() fue llamado por HOLD → engine sacó el nodo).
            // En este estado el mover debe CONGELARSE exactamente en el anchor del radar.
            // Sin este check, L0 sumaba su offset al anchor (hasManualPan=true →
            // basePan=radarAnchor → final=radarAnchor + L0_offset * amp → deriva).
            // Doctrina: HOLD = posición estática absoluta, L0 completamente silenciado.
            // WAVE 4935: Sticky Clutch fix. Si hay un payload absoluto fresco ('pan'),
            // respetar su supremacía, no sobrescribir con el 'pan_base' congelado.
            const isHoldState = (hasManualPan || hasManualTilt) && !hasMotorPan && !hasMotorTilt;
            if (isHoldState) {
                if (hasManualPan && !isFiniteChannelValue(manualAbsPan))
                    record['pan'] = manualPan;
                if (hasManualTilt && !isFiniteChannelValue(manualAbsTilt))
                    record['tilt'] = manualTilt;
                continue;
            }
            // Resolver base con prioridad motor > manual > 0.5 (centro neutro).
            const basePan = hasMotorPan ? motorPan
                : hasManualPan ? manualPan
                    : 0.5;
            const baseTilt = hasMotorTilt ? motorTilt
                : hasManualTilt ? manualTilt
                    : 0.5;
            // Escala por distancia (WAVE 4914 §3.2) — default 1.0 si no se configuró.
            const distScale = this._spatialDistanceScales.get(nodeId) ?? 1.0;
            // ── Gimbal Lock fade sobre pan_offset ──────────────────────────
            // Cuando baseTilt ≈ 0.5 (haz cenital/nadiral), pan_offset rota la
            // carcasa sin mover el haz visualmente. Atenuar a 0 en la zona muerta
            // y crecer linealmente hasta 1 fuera de la banda de fade.
            let gimbalFactor = 1;
            if (hasBaseTilt) {
                const tiltDist = baseTilt - GIMBAL_TILT_CENTER;
                const tiltDistAbs = tiltDist < 0 ? -tiltDist : tiltDist;
                gimbalFactor = tiltDistAbs >= GIMBAL_TILT_FADE_HALFWIDTH
                    ? 1
                    : tiltDistAbs / GIMBAL_TILT_FADE_HALFWIDTH;
            }
            // ── Fusión aditiva — WAVE 4980: LTP SUPPRESSION + hard tilt cap ────────
            // REGLA LTP: si L2 tiene base activa, el offset L0 (VMM) se anula.
            // El operador está apuntando con IK; el patrón automático NO puede
            // sumar grados encima. Cuando no hay base L2, el offset fluye normal
            // (degeneración al comportamiento legacy orbit-around-0.5).
            if (hasBasePan || hasPanOffset) {
                const ox = (!hasBasePan && hasPanOffset) ? panOffset : 0;
                let final = basePan + ox * ampPan * distScale * gimbalFactor;
                if (final < 0)
                    final = 0;
                else if (final > 1)
                    final = 1;
                record['pan'] = final;
            }
            if (hasBaseTilt || hasTiltOffset) {
                const oy = (!hasBaseTilt && hasTiltOffset) ? tiltOffset : 0;
                let final = baseTilt + oy * ampTilt * distScale;
                if (final < 0)
                    final = 0;
                else if (final > TILT_ARBITER_MAX)
                    final = TILT_ARBITER_MAX;
                record['tilt'] = final;
            }
            fusionCount++;
            if (sampleNodeId === null && (hasBasePan || hasBaseTilt) && (hasPanOffset || hasTiltOffset)) {
                sampleNodeId = nodeId;
                samplePan = record['pan'] ?? basePan;
                sampleTilt = record['tilt'] ?? baseTilt;
                samplePanOffset = hasPanOffset ? panOffset : 0;
                sampleTiltOffset = hasTiltOffset ? tiltOffset : 0;
                sampleBasePan = basePan;
                sampleBaseTilt = baseTilt;
            }
        }
        // Telemetría throttled — confirma que la fusión está viva en producción.
        this._fusionLogCounter++;
        if (this._fusionLogCounter >= RELATIVE_FUSION_LOG_EVERY_FRAMES && sampleNodeId !== null) {
            this._fusionLogCounter = 0;
            console.log(`[NodeArbiter ⚡ WAVE-4914] fusion=${fusionCount} amp=${amp.toFixed(2)} ` +
                `sample[${sampleNodeId}] base=(${sampleBasePan.toFixed(3)},${sampleBaseTilt.toFixed(3)}) ` +
                `offset=(${samplePanOffset.toFixed(3)},${sampleTiltOffset.toFixed(3)}) ` +
                `→ final=(${samplePan.toFixed(3)},${sampleTilt.toFixed(3)})`);
        }
    }
    // ── WAVE 4914 PUBLIC API ─ RELATIVE OFFSET CONTROL ─────────────────────
    /**
     * WAVE 4914: Setter de la amplitud global del offset relativo.
     * Llamado por AetherIPCHandlers cuando el slider de Amplitude del
     * Programmer cambia. Rango [0, 2.0] (>1 sobrepasa el envelope pero el
     * clamp01 del fusion lo recorta).
     */
    setRelativeOffsetAmplitude(value) {
        if (!Number.isFinite(value))
            return;
        this._relativeOffsetAmplitude = value < 0 ? 0 : value > 2 ? 2 : value;
    }
    /** WAVE 4914: lectura del valor actual de amplitud (telemetría / UI sync). */
    getRelativeOffsetAmplitude() {
        return this._relativeOffsetAmplitude;
    }
    /**
     * WAVE 4914: Setter de la escala de distancia para un nodo.
     * Pre-computado por AetherIPCHandlers.applySpatialTarget — una vez por
     * target update, NO por frame. Mantiene el arco visual del patrón VMM
     * aproximadamente constante para fixtures cercanos y lejanos al objetivo.
     *
     * @param nodeId   NodeId formato `${fixtureId}:kinetic`
     * @param scale    [0.25, 2.0]. Default implícito 1.0 si no se setea.
     */
    setSpatialDistanceScale(nodeId, scale) {
        if (!Number.isFinite(scale))
            return;
        const clamped = scale < 0.25 ? 0.25 : scale > 2 ? 2 : scale;
        this._spatialDistanceScales.set(nodeId, clamped);
    }
    /** WAVE 4914: limpia la escala de distancia de un nodo. */
    clearSpatialDistanceScale(nodeId) {
        this._spatialDistanceScales.delete(nodeId);
    }
    /** WAVE 4914: limpia todas las escalas de distancia (release total). */
    clearAllSpatialDistanceScales() {
        this._spatialDistanceScales.clear();
    }
    // ── Métodos internos ──────────────────────────────────────────────────
    /**
     * Aplica un intent al _result usando la estrategia de merge correcta.
     *
     * WAVE 4775 — ÁRBITRO DE HIERRO:
     * - STRICT_PRIORITY_CHANNELS (dimmer/strobe/shutter/brightness):
     *   Prioridad estricta por capa. L4>LP>L3>L2>L1>L0.
     *   Un valor ya escrito por capa superior NO puede ser pisado por
     *   una capa inferior, ni siquiera con HTP (max).
     *   HTP solo aplica dentro de L0 (múltiples sources en el mismo bus).
     * - Canales LTP: LTP normal (última capa en escribir gana).
     * - Opaque Mask: si el fixture es opaco, L0/L1 no pueden inyectar
     *   canales estéticos (OPAQUE_BLOCKED_CHANNELS_L0_L1).
     *
     * ZERO-ALLOC: accede al Record pre-allocated del pool si el nodo
     * no existe aún en el _result.
     */
    _applyIntent(intent, layer) {
        // WAVE 4713: si un fixture está bajo dimmer manual, ignorar intents L0
        // para familias visuales no-cinéticas. Así no se cuelan tics de color/
        // intensidad desde rutas automáticas del extractor.
        if (layer === 'system' && this._manualDimmerFixtureIds.size > 0) {
            const sep = intent.nodeId.lastIndexOf(':');
            if (sep > 0) {
                const fixtureId = intent.nodeId.slice(0, sep);
                if (this._manualDimmerFixtureIds.has(fixtureId)) {
                    const family = intent.nodeId.slice(sep + 1);
                    if (family !== 'kinetic' && family !== 'atmosphere') {
                        return;
                    }
                }
            }
        }
        let record = this._result.get(intent.nodeId);
        if (!record) {
            record = this._acquireRecord();
            this._result.set(intent.nodeId, record);
        }
        // WAVE 4752: SMART GATE — obtener canales bloqueados para este nodo.
        // L0/L1 solo bloqueados en canales que L2/LP están tocando EN ESE NODO.
        const l2BlockedChannels = (layer === 'system' || layer === 'selene')
            ? this._opaqueNodeChannels.get(intent.nodeId)
            : undefined;
        const lpBlockedChannels = (layer === 'system' || layer === 'selene')
            ? this._opaquePlaybackChannels.get(intent.nodeId)
            : undefined;
        // WAVE 4829: ABSOLUTE L3 OVERRIDE — canales dominados por L3 en este frame.
        // L0/L1 no pueden escribir canales que L3 ya reclamó — zero blend.
        const l3DominatedChannels = (layer === 'system' || layer === 'selene')
            ? this._l3DominatedChannels.get(intent.nodeId)
            : undefined;
        const values = intent.values;
        const shieldedColorNode = layer === 'selene' &&
            !this._seleneOverrideMoverShield &&
            this._moverShieldNodeIds.has(intent.nodeId);
        // WAVE 4918.5: Si L0 quiere escribir a un nodo que Hephaestus (L3) ya
        // reclamó con color, L0 calla completamente. La rueda de color física del
        // mover es propiedad exclusiva del efecto en este frame.
        if (layer === 'system' && this._l3HephColorNodeIds.has(intent.nodeId)) {
            return;
        }
        // 🌊 WAVE 4836 — L3 SUPREMACY ABSOLUTA (Doctrina sellada en WAVE-4835):
        // Cuando L3 escribe un canal, L0/L1 callan en ese canal de ese nodo.
        // El campo `intent.mergeStrategy` queda preservado en los tipos para
        // arbitraje intra-L3 futuro (varios efectos L3 simultáneos), pero a
        // nivel inter-capas siempre es LTP. Esto restaura el carácter de los
        // efectos blandos (CumbiaMoon, CorazonLatino) — antes HTP per-canal
        // de WAVE 4832 los hacía perder ante L0 en un entorno musical activo.
        for (const channel in values) {
            // MoverShield: bloquea canales de color en L1 para movers con rueda física
            if (shieldedColorNode && MOVER_SHIELD_BLOCKED_CHANNELS.has(channel)) {
                continue;
            }
            // WAVE 4752: SMART GATE — bloqueo per-canal-tocado.
            // L0/L1 no pueden escribir un canal si L2 o LP lo están escribiendo
            // en ESTE NODO específico. Canales no tocados por L2/LP fluyen libres.
            if ((l2BlockedChannels?.has(channel) === true ||
                lpBlockedChannels?.has(channel) === true)) {
                continue;
            }
            // WAVE 4829: ABSOLUTE L3 OVERRIDE — L3 Supremacy.
            // Si L3 ya escribió este canal en este nodo, L0/L1 son silenciados.
            // Zero blend: el efecto de Selene se renderiza puro, sin sangrado físico.
            if (l3DominatedChannels?.has(channel) === true) {
                continue;
            }
            const incoming = values[channel];
            if (!isFiniteChannelValue(incoming)) {
                continue;
            }
            // WAVE 4829 + 🌊 WAVE 4836: Registrar dominación L3 para el Escudo Anti-Sangrado.
            // L3 SIEMPRE domina los canales que escribe — sin ramas HTP de coexistencia.
            // Los efectos blandos (CumbiaMoon/CorazonLatino) cargan su propio dimmer
            // (peakIntensity/heartIntensity) y no necesitan a L0 como soporte.
            if (layer === 'effect' || layer === 'hephaestus') {
                this._registerL3Dominance(intent.nodeId, channel);
                // WAVE 4918.5: Si Hephaestus escribe color a este nodo, marcarlo para
                // bloquear L0 completamente (silencio total en ese nodo este frame).
                if (layer === 'hephaestus' && (channel === 'r' || channel === 'g' || channel === 'b' ||
                    channel === 'red' || channel === 'green' || channel === 'blue' ||
                    channel === 'colorWheel' || channel === 'color_wheel')) {
                    this._l3HephColorNodeIds.add(intent.nodeId);
                }
            }
            if (STRICT_PRIORITY_CHANNELS.has(channel)) {
                // strobe/shutter: PRIORIDAD ESTRICTA POR CAPA.
                // Excepción: L3 (effect) con dimmer=0 tiene autoridad destructiva (WAVE 4705).
                if (layer === 'effect' && channel === 'dimmer' && incoming <= 0) {
                    record[channel] = 0;
                    continue;
                }
                // L3+ (hephaestus) tiene autoridad total sobre todos los canales.
                if (layer === 'hephaestus') {
                    record[channel] = incoming;
                    continue;
                }
                // Para L0 (system): HTP DENTRO de L0 — múltiples sources del mismo bus.
                if (layer === 'system') {
                    const current = record[channel];
                    if (current === undefined || incoming > current) {
                        record[channel] = incoming;
                    }
                    continue;
                }
                // L1, LP, L3 (effect no-zero): LTP estricto entre capas.
                record[channel] = incoming;
            }
            else {
                // 🌊 WAVE 4836: LTP universal entre capas.
                // La última escritura (capa más alta) gana. L3 ya bloqueó L0/L1
                // arriba vía _l3DominatedChannels, y L2/LP via Smart Gate.
                // Nota: `intent.mergeStrategy` se preserva en el tipo para futuro
                // arbitraje intra-L3 (varios efectos L3 escribiendo el mismo canal).
                record[channel] = incoming;
            }
        }
    }
    /**
     * ⚡ WAVE 4917: Pre-carga dominación L3 desde los intents ya presentes
     * en este frame. Esto permite bloquear L0/L1 desde el inicio del arbitraje.
     */
    _primeL3DominancePrePass() {
        for (let i = 0; i < this._effectIntents.length; i++) {
            const intent = this._effectIntents[i];
            const values = intent.values;
            for (const channel in values) {
                const incoming = values[channel];
                if (!isFiniteChannelValue(incoming))
                    continue;
                this._registerL3Dominance(intent.nodeId, channel);
            }
        }
        for (let i = 0; i < this._hephaestusIntents.length; i++) {
            const intent = this._hephaestusIntents[i];
            const values = intent.values;
            for (const channel in values) {
                const incoming = values[channel];
                if (!isFiniteChannelValue(incoming))
                    continue;
                this._registerL3Dominance(intent.nodeId, channel);
                // WAVE 4918.5: marcar el nodo para silenciar L0 completamente si Hephaestus escribe color
                if (channel === 'r' || channel === 'g' || channel === 'b' ||
                    channel === 'red' || channel === 'green' || channel === 'blue' ||
                    channel === 'colorWheel' || channel === 'color_wheel') {
                    this._l3HephColorNodeIds.add(intent.nodeId);
                }
            }
        }
    }
    /**
     * Registra dominación L3 por canal + aplica el gag de luminancia cross-family.
     * Reutilizado por pre-pass y por el flujo normal de _applyIntent.
     */
    _registerL3Dominance(nodeId, channel) {
        let dominated = this._l3DominatedChannels.get(nodeId);
        if (!dominated) {
            dominated = this._acquireChannelSet();
            this._l3DominatedChannels.set(nodeId, dominated);
        }
        dominated.add(channel);
        // ⚡ WAVE 4871 + WAVE 4917: L3 LUMINANCE GAG.
        // Si L3 escribe en :impact o :color, dominar también luminancia
        // en ambos nodos del fixture para apagar sangrado L0/L1.
        const sep = nodeId.lastIndexOf(':');
        if (sep <= 0)
            return;
        const family = nodeId.slice(sep + 1);
        if (!L3_GAG_TRIGGER_FAMILIES.has(family))
            return;
        const fixturePrefix = nodeId.slice(0, sep);
        for (const gagFamily of L3_GAG_TRIGGER_FAMILIES) {
            const gagNodeId = `${fixturePrefix}:${gagFamily}`;
            let gagDominated = this._l3DominatedChannels.get(gagNodeId);
            if (!gagDominated) {
                gagDominated = this._acquireChannelSet();
                this._l3DominatedChannels.set(gagNodeId, gagDominated);
            }
            for (const lumCh of L3_LUMINANCE_GAG_CHANNELS) {
                gagDominated.add(lumCh);
            }
        }
    }
    /**
     * WAVE 4529: Limpia TODOS los overrides manuales (L2) de golpe.
     * Equivalente semántico a "UNLOCK ALL" global.
     * Usado por AetherIPCHandlers cuando el Programmer libera todos los fixtures.
     */
    clearAllManualOverrides() {
        this._manualOverrides.clear();
        this._motorKineticOverrides.clear();
        this._releaseStates.clear();
    }
    /**
     * WAVE 4529: Lista los nodeIds que tienen overrides manuales activos.
     * Útil para debug/telemetría.
     */
    getManualOverrideNodeIds() {
        return [...this._manualOverrides.keys()];
    }
    // ── Inhibit Limit API (WAVE 4531) ─────────────────────────────────────────────────────
    /**
     * WAVE 4531: Registra un inhibit limit (cap 0-1) sobre el canal `dimmer`
     * del nodo indicado. El cap se aplica post-arbitraje, antes de retornar
     * el resultado — sin alterar ninguna capa.
     *
     * @param nodeId  NodeId en formato Aether (ej: 'fix-01:impact')
     * @param limit   Valor 0-1. 1.0 = sin límite. 0.0 = oscuro total.
     */
    setInhibitLimit(nodeId, limit) {
        const clamped = limit < 0 ? 0 : limit > 1 ? 1 : limit;
        this._inhibitLimits.set(nodeId, clamped);
    }
    /**
     * WAVE 4531: Elimina el inhibit limit de un nodo concreto.
     */
    clearInhibitLimit(nodeId) {
        this._inhibitLimits.delete(nodeId);
    }
    /**
     * WAVE 4531: Elimina TODOS los inhibit limits.
     */
    clearAllInhibitLimits() {
        this._inhibitLimits.clear();
    }
    // ── L2 Read API (WAVE 4653) ───────────────────────────────────────────
    /**
     * WAVE 4653: Devuelve los overrides manuales L2 actuales para los
     * nodeIds especificados. Cada nodeId tiene formato "<fixtureId>:<familyLabel>".
     *
     * El retorno es un objeto plano serializable (apto para IPC):
     *   { [nodeId]: Record<string, number> | null }
     * null significa que el nodo no tiene overrides activos en L2.
     *
     * @param nodeIds  Array de nodeIds a consultar
     */
    getManualOverridesForNodes(nodeIds) {
        const result = {};
        for (const nodeId of nodeIds) {
            const overrides = this._manualOverrides.get(nodeId);
            result[nodeId] = overrides != null ? { ...overrides } : null;
        }
        return result;
    }
    /** Zero-alloc Set pool para _opaqueNodeChannels / _opaquePlaybackChannels */
    _acquireChannelSet() {
        if (this._channelSetCursor < this._channelSetPool.length) {
            const s = this._channelSetPool[this._channelSetCursor++];
            s.clear();
            return s;
        }
        const s = new Set();
        this._channelSetPool.push(s);
        this._channelSetCursor++;
        return s;
    }
    /**
     * WAVE 4752: Aplica fades de retorno ease-out cúbico al soltar overrides.
     * Para cada nodo en _releaseStates, mezcla el snapshot del override
     * con el valor L0 ya en _result. Al terminar el fade (t=1), elimina el estado.
     */
    _applyReleaseFades() {
        const now = performance.now();
        for (const [nodeId, rel] of this._releaseStates) {
            let record = this._result.get(nodeId);
            let fadeCompleted = true;
            for (const key in rel.channels) {
                const duration = rel.durationByChannel[key] ?? RELEASE_MS_FAST;
                const elapsed = now - rel.startedAtMs;
                if (elapsed < duration)
                    fadeCompleted = false;
                const t = elapsed >= duration ? 1.0 : elapsed / duration;
                // Ease-out cúbico: suave al final — orgánico para movers
                const fadeWeight = 1.0 - t * t * t;
                if (fadeWeight <= 0)
                    continue;
                const releaseValue = rel.channels[key];
                // WAVE 4984 Paso 1b: Si el record no existe (nodo sin output L0 este frame),
                // no crear un record vacío y degradar hacia 0. Saltar este canal.
                // Degradar a 0 en tilt = apuntar al techo en ceiling mounts. Ignorar es más seguro.
                if (!record)
                    continue;
                const l0Value = record[key];
                if (l0Value !== undefined && Number.isFinite(l0Value)) {
                    // Blend: snapshot del manual → valor L0 ya fusionado + clampeado
                    let blended = releaseValue * fadeWeight + l0Value * (1.0 - fadeWeight);
                    // Guardia final: el blend nunca puede superar el límite físico del tilt.
                    if (key === 'tilt' && blended > TILT_ARBITER_MAX)
                        blended = TILT_ARBITER_MAX;
                    record[key] = blended;
                }
                // Si l0Value es undefined (L0 no escribió este canal), no actuamos.
                // El valor que dejó _applyRelativeOffsetFusion (si lo dejó) ya es correcto.
            }
            if (fadeCompleted) {
                this._releaseStates.delete(nodeId);
            }
        }
    }
    _acquireRecord() {
        if (this._poolCursor < this._resultPool.length) {
            const rec = this._resultPool[this._poolCursor++];
            // Limpiar el Record reutilizado de forma eficiente
            for (const key in rec) {
                delete rec[key];
            }
            return rec;
        }
        // Pool exhausto: crear nuevo (solo durante warm-up)
        const rec = {};
        this._resultPool.push(rec);
        this._poolCursor++;
        return rec;
    }
}
