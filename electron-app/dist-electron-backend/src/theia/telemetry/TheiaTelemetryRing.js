/**
 * TheiaTelemetryRing.ts — Euclid Oracle · Fase E0 (Telemetry Ring Core)
 *
 * Anillo de telemetría CPU→GPU de 512 bytes exactos (128 slots × 4 B).
 * Un único productor (TickEngine en main) escribe a 44 Hz; N lectores
 * (theta.worker, ventana de salida) pollean libremente.
 *
 * 🔮 WAVE 8278 · F1 — EXPANSIÓN A PÁGINA B (EUCLID_RING_EXPANSION_8276 §1):
 *   slots 0..63  → PÁGINA A — schema v1, BYTE-IDÉNTICO al layout original.
 *   slots 64..127 → PÁGINA B — física Liquid/GodEar (F3 la puebla; hoy
 *                   RESERVED_64..127, `kind:'none'` → pasan verbatim).
 *   SCHEMA_VERSION 1 → 2 (viaja en el byte 0 de ENUMS). Los lectores
 *   toleran buffers legados de 256 B: la página B queda a 0 y se expone
 *   `schemaVersion = 1` — un consumidor v2 nunca rompe con un productor v1.
 *
 * Sincronización: SEQLOCK sobre el slot 0.
 *   Escritor: SEQ→impar, escribe, SEQ→par.  Nunca espera.
 *   Lector:   copia si SEQ es par y no cambió durante la copia.
 *             Máx. 3 reintentos → fallback al último scratch válido.
 *
 * Zero-alloc en hot-path por contrato: el writer escribe directo sobre la
 * vista Float32 del SAB (fill callback, sin staging); el reader copia a un
 * scratch Float32Array(128) pre-asignado que `read()` devuelve SIEMPRE por
 * referencia — ningún objeto nace en ningún path.
 *
 * Fuente de verdad: EUCLID_ORACLE_BLUEPRINT §2.3 (layout) + §3.3 (schema)
 * + EUCLID_RING_EXPANSION_8276 §1.1 (página B).
 */
// ─────────────────────────── Dimensiones ───────────────────────────
/** Layout legado (schema v1) — los lectores lo toleran (página B = 0). */
export const TELEMETRY_RING_SLOTS_V1 = 64;
export const TELEMETRY_RING_BYTES_V1 = TELEMETRY_RING_SLOTS_V1 * 4; // 256 B
/** 🔮 WAVE 8278 · F1 — anillo v2: 128 slots = página A (0..63) + B (64..127). */
export const TELEMETRY_RING_SLOTS = 128;
export const TELEMETRY_RING_BYTES = TELEMETRY_RING_SLOTS * 4; // 512 B
/** Primer slot de la página B (frontera vec4 del payload: idx 60). */
export const TELEMETRY_PAGE_B_BASE = 64;
export const SCHEMA_VERSION = 2;
// ───────────────────────── Header (Int32) ──────────────────────────
export const SLOT_SEQ = 0; // seqlock — impar = escritura en curso
export const SLOT_TICK_ID = 1; // frameCount del TickEngine (correlación FrameContextRing)
export const SLOT_FLAGS = 2; // bitfield booleano
export const SLOT_ENUMS = 3; // schemaVersion | predictionType<<8 | huntState<<16 | energyZone<<24
export const SLOT_PAYLOAD_BASE = 4;
/** Slots Float32 de payload: 4..127 en v2 (124), 4..63 en v1 (60). */
export const TELEMETRY_PAYLOAD_SLOTS = TELEMETRY_RING_SLOTS - SLOT_PAYLOAD_BASE;
export const TELEMETRY_PAYLOAD_SLOTS_V1 = TELEMETRY_RING_SLOTS_V1 - SLOT_PAYLOAD_BASE;
/** FLAGS — bitfield booleano (blueprint §2.3). */
export const TEL_FLAG = {
    AUDIO_LIVE: 0,
    PLL_LOCKED: 1,
    ON_BEAT: 2,
    KICK: 3,
    KICK_EDGE: 4,
    SNARE: 5,
    HIHAT: 6,
    PREDICTION_ACTIVE: 7,
    BREAKDOWN: 8,
    APOCALYPSE: 9,
    ACID: 10,
    COLOR_SNAP: 11,
    RHYTHMIC_VOID: 12,
    // 🧠 WAVE 8275 — Cognitive payload coupling (Selene V3 / Iliquidcore)
    CREST_EVENT: 13, // cresta CF>2 — evento de latencia cero (FluidDescriptors)
    /** 🔮 WAVE 8276 §1.8 — DEPRECATED: siempre 0. La fuente GodEar estaba
     *  hardcodeada a inactiva y el motor de estrobo queda prohibido — los
     *  flashes pasan por pulsos + el limitador fotosensible del epílogo. */
    STROBE_ACTIVE: 14,
    SOVEREIGN_COUNTDOWN: 15, // pre-buffer Cassandra con predictedEventAt pendiente
    GLASS_BREAK: 16, // efecto soberano disparado antes del countdown (ruptura)
    // 🌊 WAVE 8279 · F3 — página B flags (EUCLID_RING_EXPANSION_8276 §2.3)
    REAL_SILENCE: 17, // nivel — physicsTel.realSilence (rama silencio/AGC-trap)
    VOCAL_ONSET: 18, // flanco — vocalIsolation cruza 0.35 al alza (rearme <0.2)
    NOISE_MODE: 19, // nivel — flatness > umbral del perfil
    GATE_DEAD: 20, // nivel — gateHealth < 0.1 (caja sintética / AND-gate muerta)
    SNARE_TRUE: 21, // flanco — onset MACD; fallback: edge de crack_flux > 0.25
    VOID_RELEASE: 22, // flanco — el vacío termina tras VOID_HOLD ≥ 2 s
};
export function telFlag(flags, bit) {
    return ((flags >>> bit) & 1) === 1;
}
export function packEnums(e) {
    return ((e.schemaVersion & 0xff) |
        ((e.predictionType & 0xff) << 8) |
        ((e.huntState & 0xff) << 16) |
        ((e.energyZone & 0xff) << 24));
}
export function unpackEnums(packed, out) {
    out.schemaVersion = packed & 0xff;
    out.predictionType = (packed >>> 8) & 0xff;
    out.huntState = (packed >>> 16) & 0xff;
    out.energyZone = (packed >>> 24) & 0xff;
    return out;
}
/**
 * TELEMETRY_SCHEMA — descriptor único que alimenta al writer, al reader,
 * al generador del preámbulo GLSL y a los tests. Los índices JAMÁS se
 * escriben a mano en otro sitio.
 */
export const TELEMETRY_SCHEMA = [
    // CLOCK
    { slot: 4, name: 'T_SEC', uniform: 'u_tSec', kind: 'none' },
    { slot: 5, name: 'BPM', uniform: 'u_bpm', kind: 'linear' },
    { slot: 6, name: 'BEAT_PHASE', uniform: 'u_beatPhase', kind: 'extrapolate' },
    { slot: 7, name: 'BAR_PHASE', uniform: 'u_barPhase', kind: 'circular' },
    { slot: 8, name: 'BEAT_CONFIDENCE', uniform: 'u_beatConfidence', kind: 'linear' },
    { slot: 9, name: 'ENERGY', uniform: 'u_energy', kind: 'linear' },
    // GODEAR — 7 bandas tácticas (post-AGC)
    { slot: 10, name: 'SUB_BASS', uniform: 'u_subBass', kind: 'linear', attack: 0.6, release: 0.1 },
    { slot: 11, name: 'BASS', uniform: 'u_bass', kind: 'linear' },
    { slot: 12, name: 'LOW_MID', uniform: 'u_lowMid', kind: 'linear' },
    { slot: 13, name: 'MID', uniform: 'u_mid', kind: 'linear' },
    { slot: 14, name: 'HIGH_MID', uniform: 'u_highMid', kind: 'linear' },
    { slot: 15, name: 'TREBLE', uniform: 'u_treble', kind: 'linear' },
    { slot: 16, name: 'ULTRA_AIR', uniform: 'u_ultraAir', kind: 'linear' },
    // GODEAR — métricas perceptuales
    { slot: 17, name: 'CENTROID_N', uniform: 'u_brightnessSpec', kind: 'linear' },
    { slot: 18, name: 'FLATNESS', uniform: 'u_flatness', kind: 'linear' },
    { slot: 19, name: 'CREST_N', uniform: 'u_crestN', kind: 'linear' },
    { slot: 20, name: 'HARSHNESS', uniform: 'u_harshness', kind: 'linear' },
    { slot: 21, name: 'SPECTRAL_FLUX', uniform: 'u_spectralFlux', kind: 'linear', attack: 0.8, release: 0.3 },
    { slot: 22, name: 'TRANSIENT_DENSITY', uniform: 'u_transientDensity', kind: 'linear' },
    { slot: 23, name: 'SATURATION', uniform: 'u_saturation', kind: 'linear' },
    { slot: 24, name: 'CHROMA_HUE', uniform: 'u_chromaHue', kind: 'circular' },
    { slot: 25, name: 'CHROMA_FLUX', uniform: 'u_chromaFlux', kind: 'linear' },
    // RITMO
    { slot: 26, name: 'KICK_ENERGY', uniform: 'u_kickEnergy', kind: 'linear', attack: 1.0, release: 0.25 },
    { slot: 27, name: 'SNARE_ENERGY', uniform: 'u_snareEnergy', kind: 'linear' },
    { slot: 28, name: 'HIHAT_ENERGY', uniform: 'u_hihatEnergy', kind: 'linear' },
    { slot: 29, name: 'SYNCOPATION', uniform: 'u_syncopation', kind: 'linear' },
    // SELENE / CASSANDRA
    { slot: 30, name: 'SEL_CONFIDENCE', uniform: 'u_seleneConfidence', kind: 'linear' },
    { slot: 31, name: 'SEL_PRED_PROB', uniform: 'u_predictionProb', kind: 'linear' },
    { slot: 32, name: 'SEL_ETA_MS', uniform: 'u_selEtaMs', kind: 'extrapolate' },
    { slot: 33, name: 'SEL_ETA_BEATS', uniform: 'u_selEtaBeats', kind: 'extrapolate' },
    { slot: 34, name: 'SEL_TENSION', uniform: 'u_tension', kind: 'linear' },
    { slot: 35, name: 'SEL_BEAUTY', uniform: 'u_beauty', kind: 'linear' },
    { slot: 36, name: 'SEL_ZSCORE_N', uniform: 'u_zScoreN', kind: 'linear' },
    { slot: 37, name: 'SPECTRAL_BUILDUP', uniform: 'u_spectralBuildup', kind: 'linear' },
    // OMNILIQUID
    { slot: 38, name: 'MORPH_FACTOR', uniform: 'u_morphFactor', kind: 'linear', attack: 0.05, release: 0.02 },
    { slot: 39, name: 'RECOVERY_FACTOR', uniform: 'u_recoveryFactor', kind: 'linear' },
    { slot: 40, name: 'LQ_FLOOR', uniform: 'u_lqFloor', kind: 'linear' },
    { slot: 41, name: 'LQ_AMBIENT', uniform: 'u_lqAmbient', kind: 'linear' },
    { slot: 42, name: 'LQ_AIR', uniform: 'u_lqAir', kind: 'linear' },
    // 🧠 WAVE 8275 — presión acústica "épica" de Iliquidcore (autoridad Divine)
    { slot: 43, name: 'EPICNESS', uniform: 'u_epicness', kind: 'linear', attack: 0.4, release: 0.1 },
    // CHROMAGRAMA — 12 bins C→B
    { slot: 44, name: 'CHROMA_0', uniform: 'u_chroma0', kind: 'linear' },
    { slot: 45, name: 'CHROMA_1', uniform: 'u_chroma1', kind: 'linear' },
    { slot: 46, name: 'CHROMA_2', uniform: 'u_chroma2', kind: 'linear' },
    { slot: 47, name: 'CHROMA_3', uniform: 'u_chroma3', kind: 'linear' },
    { slot: 48, name: 'CHROMA_4', uniform: 'u_chroma4', kind: 'linear' },
    { slot: 49, name: 'CHROMA_5', uniform: 'u_chroma5', kind: 'linear' },
    { slot: 50, name: 'CHROMA_6', uniform: 'u_chroma6', kind: 'linear' },
    { slot: 51, name: 'CHROMA_7', uniform: 'u_chroma7', kind: 'linear' },
    { slot: 52, name: 'CHROMA_8', uniform: 'u_chroma8', kind: 'linear' },
    { slot: 53, name: 'CHROMA_9', uniform: 'u_chroma9', kind: 'linear' },
    { slot: 54, name: 'CHROMA_10', uniform: 'u_chroma10', kind: 'linear' },
    { slot: 55, name: 'CHROMA_11', uniform: 'u_chroma11', kind: 'linear' },
    // WIRE — los slots 56/57 transportan FLAGS/ENUMS como BITS Int32 en el
    // wire buffer del pump (ver TelemetrySnapshotter). En el anillo
    // local de main quedan a 0 — el header Int32 es su casa real.
    { slot: 56, name: 'WIRE_FLAGS', uniform: '', kind: 'none' },
    { slot: 57, name: 'WIRE_ENUMS', uniform: '', kind: 'none' },
    // 🧬 WAVE 8233 · G1 — RELOJES INTEGRALES (Infinite Genome §Ley-1/§4.6):
    // ENERGY_TIME = ∫energy·dt acumulado en el host (monótono — el shader no
    // multiplica un reloj por señales cambiantes). BAR_COUNT = compases
    // absolutos → fronteras de frase para mutación del genoma. kind 'none':
    // ambos son crudos — suavizar un integral/discreto los corrompería.
    { slot: 58, name: 'ENERGY_TIME', uniform: 'u_energyTime', kind: 'none' },
    { slot: 59, name: 'BAR_COUNT', uniform: 'u_barCount', kind: 'none' },
    // 🧠 WAVE 8275 — Iliquidcore / FluidDescriptors (Selene V3 cognition)
    { slot: 60, name: 'VAPOR_PRESSURE', uniform: 'u_vaporPressure', kind: 'linear', attack: 0.3, release: 0.05 },
    { slot: 61, name: 'PERCUSSIVENESS', uniform: 'u_percussiveness', kind: 'linear' },
    { slot: 62, name: 'MELODICITY', uniform: 'u_melodicity', kind: 'linear' },
    { slot: 63, name: 'CREST_RATE', uniform: 'u_crestRate', kind: 'linear', attack: 0.7, release: 0.2 },
    // ── PÁGINA B (slots 64..127) — 🌊 WAVE 8279 · F3: física Liquid/GodEar
    // viva (EUCLID_RING_EXPANSION_8276 §2.2). Grupos alineados a vec4.
    // VOCAL — u_vocalVec = u_tel4[15]
    { slot: 64, name: 'VOCAL_SUSTAIN', uniform: 'u_vocalSustain', kind: 'linear', attack: 0.7, release: 0.3 },
    { slot: 65, name: 'VOCAL_ISOLATION', uniform: 'u_vocalIsolation', kind: 'linear', attack: 0.5, release: 0.15 },
    { slot: 66, name: 'CLEAN_MID', uniform: 'u_cleanMid', kind: 'linear', attack: 0.8, release: 0.4 },
    { slot: 67, name: 'SYNTH_SUSTAIN', uniform: 'u_synthSustain', kind: 'linear', attack: 0.4, release: 0.1 },
    // VOID — u_voidVec = u_tel4[16]
    { slot: 68, name: 'RHYTHMIC_VOID', uniform: 'u_rhythmicVoid', kind: 'linear', attack: 0.3, release: 0.3 },
    { slot: 69, name: 'PERC_ABSENCE', uniform: 'u_percAbsence', kind: 'linear' },
    { slot: 70, name: 'VOID_HOLD', uniform: 'u_voidHold', kind: 'none' },
    { slot: 71, name: 'VOCAL_TIME', uniform: 'u_vocalTime', kind: 'none' },
    // SNARE-C — u_snareVec = u_tel4[17] (detector MACD + fallback universal)
    { slot: 72, name: 'SNARE_DRIVE', uniform: 'u_snareDrive', kind: 'none' },
    { slot: 73, name: 'SNARE_MOMENTUM', uniform: 'u_snareMomentum', kind: 'none' },
    { slot: 74, name: 'GATE_HEALTH', uniform: 'u_gateHealth', kind: 'linear', attack: 0.3, release: 0.3 },
    { slot: 75, name: 'SNARE_CRACK', uniform: 'u_snareCrack', kind: 'linear', attack: 0.9, release: 0.35 },
    // ZONES-A — u_zoneA = u_tel4[18] (gemelo del rig físico)
    { slot: 76, name: 'Z_FRONT_L', uniform: 'u_zFrontL', kind: 'linear', attack: 0.9, release: 0.6 },
    { slot: 77, name: 'Z_FRONT_R', uniform: 'u_zFrontR', kind: 'linear', attack: 0.9, release: 0.6 },
    { slot: 78, name: 'Z_BACK_L', uniform: 'u_zBackL', kind: 'linear', attack: 0.9, release: 0.6 },
    { slot: 79, name: 'Z_BACK_R', uniform: 'u_zBackR', kind: 'linear', attack: 0.9, release: 0.6 },
    // ZONES-B — u_zoneB = u_tel4[19]
    { slot: 80, name: 'Z_MOVER_L', uniform: 'u_zMoverL', kind: 'linear', attack: 0.9, release: 0.6 },
    { slot: 81, name: 'Z_MOVER_R', uniform: 'u_zMoverR', kind: 'linear', attack: 0.9, release: 0.6 },
    { slot: 82, name: 'Z_SNARE_ATTACK', uniform: 'u_zSnareAttack', kind: 'linear', attack: 1.0, release: 0.6 },
    { slot: 83, name: 'RESERVED_83', uniform: '', kind: 'none' },
    // TEXTURE — u_textureVec = u_tel4[20]
    { slot: 84, name: 'WHITE_NOISE', uniform: 'u_whiteNoise', kind: 'linear', attack: 0.6, release: 0.2 },
    { slot: 85, name: 'WALL_INTENSITY', uniform: 'u_wallIntensity', kind: 'linear', attack: 0.3, release: 0.1 },
    { slot: 86, name: 'SPECTRAL_DENSITY', uniform: 'u_spectralDensity', kind: 'linear', attack: 0.4, release: 0.15 },
    { slot: 87, name: 'FLUX_BASELINE_N', uniform: 'u_fluxBaseline', kind: 'linear', attack: 0.3, release: 0.1 },
    // DELTAS — u_deltaVec = u_tel4[21] (crudos: interpolar un transitorio lo destruye)
    { slot: 88, name: 'RAW_MID_DELTA', uniform: 'u_midDelta', kind: 'none' },
    { slot: 89, name: 'RAW_HIGHMID_DELTA', uniform: 'u_highMidDelta', kind: 'none' },
    { slot: 90, name: 'RAW_TREBLE_DELTA', uniform: 'u_trebleDelta', kind: 'none' },
    { slot: 91, name: 'RAW_HH_DELTA', uniform: 'u_hhDelta', kind: 'none' },
    // MASTER — u_tel4[22]
    { slot: 92, name: 'AGC_STRESS', uniform: 'u_agcStress', kind: 'linear', attack: 0.2, release: 0.05 },
    // 93-95: reserva stereo width/corr/balance (wave futura — el pipeline
    // aún no retransmite GodEarSpectrum.stereo). 96-127: margen, generados.
    ...Array.from({ length: TELEMETRY_RING_SLOTS - 93 }, (_, i) => {
        const slot = 93 + i;
        return { slot, name: `RESERVED_${slot}`, uniform: '', kind: 'none' };
    }),
];
/** Lookup nombre → slot (para el writer del TickEngine sin literales). */
export const TELEMETRY_SLOT = (() => {
    const m = {};
    for (const d of TELEMETRY_SCHEMA)
        m[d.name] = d.slot;
    return Object.freeze(m);
})();
export function createIntegralClocks() {
    return { energyTime: 0, barCount: 0, prevNowMs: 0 };
}
/**
 * Avanza los relojes integrales un tick del motor.
 *  · `energyTime += max(0,energy) · dt` — dt real del reloj del tick,
 *    clamp [0, 0.5 s]: un stall/NTP jamás produce un salto del integral.
 *  · `barCount` = ratchet monótono de floor(beatCount/4): cruza en cada
 *    frontera de compás y nunca retrocede aunque el pacemaker reinicie.
 * Zero-alloc: muta `st` in-place.
 */
export function stepIntegralClocks(st, nowMs, energy, beatCount) {
    const dtSec = st.prevNowMs > 0
        ? Math.min(0.5, Math.max(0, (nowMs - st.prevNowMs) * 0.001))
        : 0;
    st.prevNowMs = nowMs;
    st.energyTime += Math.max(0, energy) * dtSec;
    const barNow = Math.floor(Math.max(0, beatCount) / 4);
    if (barNow > st.barCount)
        st.barCount = barNow;
}
// ─────────────────────────── Construcción ───────────────────────────
export function createTelemetryRing() {
    return new SharedArrayBuffer(TELEMETRY_RING_BYTES);
}
/**
 * 🔮 WAVE 8278 · F1 — tamaños válidos del anillo: v2 (512B/128 slots) o
 * legado v1 (256B/64 slots). Devuelve los slots Int32 del buffer o 0 si el
 * tamaño no es ninguno de los dos — los lectores toleran v1 (página B = 0).
 */
export function ringSlotsFor(byteLength) {
    if (byteLength === TELEMETRY_RING_BYTES)
        return TELEMETRY_RING_SLOTS;
    if (byteLength === TELEMETRY_RING_BYTES_V1)
        return TELEMETRY_RING_SLOTS_V1;
    return 0;
}
function ringViews(sab) {
    if (sab.byteLength !== TELEMETRY_RING_BYTES) {
        throw new Error(`[TheiaTelemetryRing] expected ${TELEMETRY_RING_BYTES}B, got ${sab.byteLength}B`);
    }
    return {
        i32: new Int32Array(sab, 0, SLOT_PAYLOAD_BASE),
        f32: new Float32Array(sab),
    };
}
// ─────────────────────────── TelemetryWriter ───────────────────────────
/**
 * Escritor seqlock — proceso MAIN (TickEngine), una invocación por tick.
 * Presupuesto < 1 µs: 3 Atomics.store de header + fill directo sobre el f32.
 */
export class TelemetryWriter {
    constructor(sab) {
        const v = ringViews(sab);
        this.i32 = v.i32;
        this.f32 = v.f32;
    }
    /**
     * Publica un frame de telemetría. `fill` recibe la vista Float32 DEL
     * PROPIO ANILLO: el llamador escribe `p[TELEMETRY_SLOT.BPM] = 126.4`
     * directamente — cero staging, cero objetos. El seqlock (SEQ impar→par)
     * garantiza que un lector concurrente descarte cualquier lectura que
     * pise esta ventana.
     */
    publish(tickId, flags, enumsPacked, fill) {
        const s = Atomics.load(this.i32, SLOT_SEQ);
        Atomics.store(this.i32, SLOT_SEQ, s + 1); // impar — escritura en curso
        Atomics.store(this.i32, SLOT_TICK_ID, tickId | 0);
        Atomics.store(this.i32, SLOT_FLAGS, flags | 0);
        Atomics.store(this.i32, SLOT_ENUMS, enumsPacked | 0);
        fill(this.f32);
        Atomics.store(this.i32, SLOT_SEQ, s + 2); // par — commit
    }
}
// ─────────────────────────── TelemetryReader ───────────────────────────
const MAX_READ_ATTEMPTS = 3;
/**
 * Lector seqlock — worker / ventana de salida.
 * `read()` devuelve SIEMPRE el mismo `scratch` pre-asignado (o null):
 * nunca asigna. Novedad por SEQ: si no cambió, retorna null sin copiar
 * (idéntico a FrameContextReader.readIfChanged).
 */
export class TelemetryReader {
    constructor(sab) {
        this.lastSeq = -1;
        this.hasValid = false;
        // 🔮 WAVE 8278 · F1 — tolerante: acepta anillos v2 (512B) y legados v1
        // (256B). `scratch.set(f32)` copia min(64,128) — la página B permanece
        // a 0 con una fuente v1.
        if (ringSlotsFor(sab.byteLength) === 0) {
            throw new Error(`[TelemetryReader] expected ${TELEMETRY_RING_BYTES}B or ${TELEMETRY_RING_BYTES_V1}B, got ${sab.byteLength}B`);
        }
        this.i32 = new Int32Array(sab, 0, SLOT_PAYLOAD_BASE);
        this.f32 = new Float32Array(sab);
        this.scratch = new Float32Array(TELEMETRY_RING_SLOTS);
    }
    /**
     * Lee el anillo si hay datos nuevos.
     * @returns `scratch` con una copia consistente (fresca o, si los 3
     *          intentos colisionaron con una escritura, el último scratch
     *          válido), o `null` si SEQ no cambió desde la última lectura
     *          válida / nunca hubo lectura válida.
     */
    read() {
        if (this.hasValid) {
            if (Atomics.load(this.i32, SLOT_SEQ) === this.lastSeq)
                return null;
        }
        for (let attempt = 0; attempt < MAX_READ_ATTEMPTS; attempt++) {
            const s1 = Atomics.load(this.i32, SLOT_SEQ);
            if ((s1 & 1) !== 0)
                continue; // escritura en curso
            this.copyPayload();
            const s2 = Atomics.load(this.i32, SLOT_SEQ);
            if (s1 === s2) {
                this.lastSeq = s2;
                this.hasValid = true;
                return this.scratch;
            }
            // s1 !== s2: el writer interrumpió la copia — descartar y reintentar.
        }
        // Fallback: último scratch válido (o null si jamás hubo uno).
        return this.hasValid ? this.scratch : null;
    }
    /** Reinicia la detección de novedad (p.ej. tras recolgar el SAB). */
    resync() {
        this.lastSeq = Atomics.load(this.i32, SLOT_SEQ);
        this.hasValid = false;
    }
    /**
     * Copia los slots al scratch (128 v2 / 64 v1 — `set` copia el mínimo y la
     * página B queda a 0 en v1). Seam `protected`: los tests la sobreescriben
     * para simular un writer que interrumpe a mitad de copia.
     */
    copyPayload() {
        this.scratch.set(this.f32);
    }
}
// ─────────── Wire snapshot (pump → 512B buffer) · WAVE 8277 · F0 ───────────
/**
 * Layout del wire buffer de 512B (`TheiaTelemetryPump` → consumidores):
 *   slots 0..3   → FrameContextRing verbatim (tickId, tsLo, tsHi, generation)
 *                  — el reloj maestro viaja en la cabecera (amendment 8215).
 *   slots 4..127 → payload Float32 del anillo Euclid, verbatim (páginas A+B).
 *   slot  56     → FLAGS empaquetados como bits Int32 (WIRE_FLAGS).
 *   slot  57     → ENUMS empaquetados como bits Int32 (WIRE_ENUMS).
 * El SEQ/TICK_ID del header Euclid no cruza: tickId ya vive en el FC, y el
 * seqlock es una preocupación intra-proceso del lado del productor.
 * Los consumidores leen FLAGS/ENUMS con una vista Int32 sobre el espejo
 * local (los bits caben en cualquier slot — solo se interpretan distinto).
 */
export const WIRE_FLAGS_SLOT = 56;
export const WIRE_ENUMS_SLOT = 57;
/**
 * 🔧 WAVE 8277 · Fase 0 (EUCLID_RING_EXPANSION_8276 §F0) — snapshotter con
 * vistas PRE-ASIGNADAS. Las 4 TypedArray views (src Int32/Float32, dst
 * Int32/Float32) nacen en el constructor y `snapshot()` no ejecuta NI UN
 * `new`: la copia seqlock corre íntegra sobre vistas fijas.
 *
 * La instancia queda ligada a un par (src ring, dst wire). Si la fuente
 * cambia de identidad (re-attach del SAB), el caller crea una nueva — en el
 * steady-state jamás se asigna.
 */
export class TelemetrySnapshotter {
    constructor(src, dst) {
        // 🔮 WAVE 8278 · F1 — tolerante en src: un anillo legado de 256B copia
        // su página A (4..63) y la página B del wire queda a 0 (el pump la
        // rellena con fill(0) antes de cada snapshot). El wire dst es siempre
        // v2 — el pump crea su scratch con TELEMETRY_RING_BYTES.
        this.srcSlots = ringSlotsFor(src.byteLength);
        /** Tamaños validados en ctor — un par inválido queda inerte (snapshot→false). */
        this.valid = this.srcSlots > 0 && dst.byteLength === TELEMETRY_RING_BYTES;
        if (!this.valid) {
            this.srcI32 = new Int32Array(0);
            this.srcF32 = new Float32Array(0);
            this.dstI32 = new Int32Array(0);
            this.dstF32 = new Float32Array(0);
            return;
        }
        this.srcI32 = new Int32Array(src, 0, SLOT_PAYLOAD_BASE);
        this.srcF32 = new Float32Array(src);
        this.dstI32 = new Int32Array(dst);
        this.dstF32 = new Float32Array(dst);
    }
    /**
     * Copia seqlock-verificada anillo → wire buffer. Cero asignaciones.
     * @returns `true` si la copia fue consistente; `false` si los 3 intentos
     *          colisionaron con una escritura (o el par src/dst era inválido).
     */
    snapshot() {
        if (!this.valid)
            return false;
        const srcI32 = this.srcI32;
        const srcF32 = this.srcF32;
        const dstI32 = this.dstI32;
        const dstF32 = this.dstF32;
        for (let attempt = 0; attempt < MAX_READ_ATTEMPTS; attempt++) {
            const s1 = Atomics.load(srcI32, SLOT_SEQ);
            if ((s1 & 1) !== 0)
                continue;
            const flags = Atomics.load(srcI32, SLOT_FLAGS);
            const enums = Atomics.load(srcI32, SLOT_ENUMS);
            for (let i = SLOT_PAYLOAD_BASE; i < this.srcSlots; i++) {
                dstF32[i] = srcF32[i];
            }
            dstI32[WIRE_FLAGS_SLOT] = flags;
            dstI32[WIRE_ENUMS_SLOT] = enums;
            const s2 = Atomics.load(srcI32, SLOT_SEQ);
            if (s1 === s2)
                return true;
            // s1 !== s2: escritura concurrente — destino rasgado; reintentar.
        }
        return false;
    }
}
// ───────────── TelemetryWireReader (worker, WAVE 8228 · E2) ─────────────
/** Slot Int32 de la barrera `generation` en el layout wire (= FrameContext). */
const WIRE_GEN_SLOT = 3;
/**
 * Lector del ESPEJO local del wire buffer (worker/renderer). El mirror
 * (`mirrorTelemetryIntoRing`) escribe el payload antes que `generation`
 * (Atomics.store final) → la doble lectura de gen es una barrera válida:
 * `g1 === g2` certifica que el payload copiado es íntegro de un frame.
 *
 * A diferencia del `TelemetryReader` (seqlock sobre SEQ en el ring de main),
 * aquí slot 0 es el TICK_ID del FrameContext — la novedad se detecta por gen.
 *
 * Zero-alloc: `scratch` y los campos escalares se reutilizan; `read()`
 * devuelve `true` solo cuando consumió un frame nuevo.
 */
export class TelemetryWireReader {
    constructor(sab) {
        /** Copia verbatim del ring (128 slots v2 · 64 en un espejo v1 — la página
         *  B queda a 0). Los slots 56/57 quedan a 0: FLAGS/ENUMS llegan como bits
         *  Int32 y se exponen en `flags`/`enums`. */
        this.scratch = new Float32Array(TELEMETRY_RING_SLOTS);
        /** FLAGS del último frame consistente (bits — ver TEL_FLAG). */
        this.flags = 0;
        /** ENUMS empaquetados (schemaVersion|predictionType|huntState|energyZone). */
        this.enums = 0;
        /** tickId del FrameContext — correlación con el master tick. */
        this.tickId = 0;
        /** Timestamp epoch-ms del FrameContext. */
        this.timestampMs = 0;
        /** generation consumida (diagnóstico). */
        this.generation = 0;
        /** 🔮 WAVE 8278 · F1 — versión de schema detectada: el byte 0 de ENUMS en
         *  v2; 1 forzado si el mirror es un frame legado de 256B (no transporta
         *  página B — el tamaño es la verdad, no el byte declarado). */
        this.schemaVersion = 0;
        this.lastGen = -1;
        this.hasValid = false;
        // 🔮 WAVE 8278 · F1 — tolerancia de versión: acepta el mirror v2 (512B)
        // y el legado v1 (256B — el pump desplegado puede ser de un build previo).
        this.srcSlots = ringSlotsFor(sab.byteLength);
        if (this.srcSlots === 0) {
            throw new Error(`[TelemetryWireReader] expected ${TELEMETRY_RING_BYTES}B or ${TELEMETRY_RING_BYTES_V1}B, got ${sab.byteLength}B`);
        }
        this.i32 = new Int32Array(sab);
        this.f32 = new Float32Array(sab);
    }
    /**
     * Intenta consumir un frame nuevo.
     * @returns `true` si generation cambió y la copia fue consistente.
     *          `false` si no hay novedad o los reintentos colisionaron (el
     *          caller reutiliza el scratch anterior — jamás data rasgada).
     */
    read() {
        const i32 = this.i32;
        const f32 = this.f32;
        const out = this.scratch;
        for (let attempt = 0; attempt < MAX_READ_ATTEMPTS; attempt++) {
            const g1 = Atomics.load(i32, WIRE_GEN_SLOT);
            if (g1 === this.lastGen)
                return false;
            const tickId = Atomics.load(i32, 0);
            const tsLo = Atomics.load(i32, 1) >>> 0;
            const tsHi = Atomics.load(i32, 2);
            // Payload verbatim (slots 4..srcSlots — 63 en v1, 127 en v2).
            for (let i = SLOT_PAYLOAD_BASE; i < this.srcSlots; i++) {
                out[i] = f32[i];
            }
            // 56/57 transportan bits Int32 — se leen como bits, no como float.
            const flags = Atomics.load(i32, WIRE_FLAGS_SLOT);
            const enums = Atomics.load(i32, WIRE_ENUMS_SLOT);
            out[WIRE_FLAGS_SLOT] = 0;
            out[WIRE_ENUMS_SLOT] = 0;
            const g2 = Atomics.load(i32, WIRE_GEN_SLOT);
            if (g1 === g2) {
                this.tickId = tickId;
                this.timestampMs = tsHi * 0x100000000 + tsLo;
                this.flags = flags;
                this.enums = enums;
                this.schemaVersion =
                    this.srcSlots < TELEMETRY_RING_SLOTS ? 1 : enums & 0xff;
                this.generation = g1;
                this.lastGen = g1;
                this.hasValid = true;
                return true;
            }
            // g1 !== g2: el mirror escribió durante la copia — descartar, reintentar.
        }
        return false;
    }
    /** Devuelve el scratch si alguna vez se consumió un frame válido. */
    getScratch() {
        return this.hasValid ? this.scratch : null;
    }
    /** Reinicia la detección de novedad (tras recolgar el SAB). */
    resync() {
        this.lastGen = Atomics.load(this.i32, WIRE_GEN_SLOT);
        this.hasValid = false;
    }
}
