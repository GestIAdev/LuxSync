// ════════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 4817 — LFX CLIP INSTANCE  (FASE 1: La Clase Átomo)
// ════════════════════════════════════════════════════════════════════════════
//  Traductor oficial entre los Arquetipos del usuario (lenguaje semántico)
//  y la matriz cognitiva fría que consume Selene IA (ACO + EnergyZones).
//
//  Doctrina:
//   - El usuario nunca toca ACO directo (salvo Expert Mode).
//   - Cada `userArchetype` aplica un bias matemático determinista sobre la
//     tríada ACO y restringe las EnergyZones legales.
//   - La instancia es mutable durante la edición y se congela
//     (`Object.freeze` recursivo) antes de entrar al hot path / serializar.
//   - Es retrocompatible con `.lfx` v1.x (legacy sin cognitiveDNA).
//
//  Referencias:
//   - docs/blueprints/WAVE-4816-UX-BLUEPRINT.md  (blueprint conceptual)
//   - docs/SELENE-REALITY-MAPPING.md             (realidad matemática)
//   - src/core/arsenal/lfxTypes.ts               (tipos `.lfx v2.1`)
// ════════════════════════════════════════════════════════════════════════════
// ─── CONSTANTES INMUTABLES ──────────────────────────────────────────────────
/** Lista canónica ordenada de zonas (silence → peak). Útil para clamps. */
export const ENERGY_ZONES = Object.freeze([
    'silence',
    'valley',
    'ambient',
    'gentle',
    'active',
    'intense',
    'peak',
]);
/** Lista canónica de vibes. */
export const COMPATIBLE_VIBES = Object.freeze([
    'techno-dark',
    'latino-organic',
    'pop-rock',
    'chill-lounge',
]);
/** Lista canónica de arquetipos. */
export const USER_ARCHETYPES = Object.freeze([
    'strobe',
    'ambient',
    'heavy',
    'divine',
    'utility',
]);
export const ARCHETYPE_BIAS_MAP = Object.freeze({
    // ── DIVINE: agresión magnetizada ≥0.90, solo PEAK/INTENSE ──
    divine: Object.freeze({
        aggressionMin: 0.9,
        chaosMin: 0.3,
        chaosMax: 0.7,
        allowedZones: Object.freeze(['intense', 'peak']),
        defaultZones: Object.freeze(['peak']),
        centroid: Object.freeze({ aggression: 0.95, chaos: 0.5, organicity: 0.5 }),
    }),
    // ── STROBE: agresión y caos altos, zonas activas/peak ──
    strobe: Object.freeze({
        aggressionMin: 0.75,
        chaosMin: 0.4,
        organicityMax: 0.35,
        allowedZones: Object.freeze(['active', 'intense', 'peak']),
        defaultZones: Object.freeze(['intense', 'peak']),
        centroid: Object.freeze({ aggression: 0.85, chaos: 0.65, organicity: 0.2 }),
    }),
    // ── HEAVY: peso bruto, baja organicidad, zonas duras ──
    heavy: Object.freeze({
        aggressionMin: 0.7,
        chaosMin: 0.3,
        organicityMax: 0.45,
        allowedZones: Object.freeze(['active', 'intense', 'peak']),
        defaultZones: Object.freeze(['intense', 'peak']),
        centroid: Object.freeze({ aggression: 0.8, chaos: 0.55, organicity: 0.25 }),
    }),
    // ── AMBIENT: tope de agresión, alta organicidad, zonas bajas ──
    ambient: Object.freeze({
        aggressionMax: 0.3,
        chaosMax: 0.3,
        organicityMin: 0.55,
        allowedZones: Object.freeze([
            'silence',
            'valley',
            'ambient',
            'gentle',
        ]),
        defaultZones: Object.freeze(['valley', 'ambient']),
        centroid: Object.freeze({ aggression: 0.2, chaos: 0.2, organicity: 0.7 }),
    }),
    // ── UTILITY: passthrough; sin biases. Se usa para efectos de transición. ──
    utility: Object.freeze({
        defaultZones: Object.freeze(['ambient', 'gentle', 'active']),
        centroid: Object.freeze({ aggression: 0.5, chaos: 0.5, organicity: 0.5 }),
    }),
});
// ─── DEFAULTS Y HELPERS ─────────────────────────────────────────────────────
const NEUTRAL_ACO = Object.freeze({
    aggression: 0.5,
    chaos: 0.5,
    organicity: 0.5,
});
function clamp01(x) {
    if (!Number.isFinite(x))
        return 0.5;
    if (x < 0)
        return 0;
    if (x > 1)
        return 1;
    return x;
}
function clampRange(x, min, max) {
    let v = clamp01(x);
    if (typeof min === 'number' && v < min)
        v = min;
    if (typeof max === 'number' && v > max)
        v = max;
    return v;
}
function intersectZones(user, allowed) {
    if (!allowed || allowed.length === 0)
        return [...user];
    const set = new Set(allowed);
    return user.filter(z => set.has(z));
}
function uniqueOrder(arr) {
    const seen = new Set();
    const out = [];
    for (const item of arr) {
        if (!seen.has(item)) {
            seen.add(item);
            out.push(item);
        }
    }
    return out;
}
function isUserArchetype(x) {
    return typeof x === 'string' && USER_ARCHETYPES.includes(x);
}
function isCompatibleVibe(x) {
    return typeof x === 'string' && COMPATIBLE_VIBES.includes(x);
}
/** Mapeo inverso público: `'techno-club' → 'techno-dark'`, etc. */
export function reverseVibeBridge(value) {
    if (typeof value !== 'string')
        return null;
    if (isCompatibleVibe(value))
        return value;
    for (const [alias, real] of Object.entries(VIBE_BRIDGE)) {
        if (real === value)
            return alias;
    }
    return null;
}
function isEnergyZone(x) {
    return typeof x === 'string' && ENERGY_ZONES.includes(x);
}
function isSpatialBehavior(x) {
    return x === 'relative_offset' || x === 'absolute' || x === 'static';
}
/** Mapea las vibes de directiva a las vibes reales de Selene (puente). */
const VIBE_BRIDGE = Object.freeze({
    'techno-dark': 'techno-club',
    'latino-organic': 'fiesta-latina',
    'pop-rock': 'pop-rock',
    'chill-lounge': 'chill-lounge',
});
// ─── CLASE ÁTOMO ────────────────────────────────────────────────────────────
/**
 * Átomo unificador del Infinite Arsenal.
 *
 * Ciclo de vida típico:
 *  ```ts
 *  const clip = new LfxClipInstance({ id: 'abc', userArchetype: 'divine' })
 *  clip.setAcoTriad({ aggression: 0.5, chaos: 0.6, organicity: 0.4 })
 *  // → bake reescribe aggression a 0.9 (mínimo divine) y restringe zones a ['peak']
 *  clip.freeze() // listo para hot path / export
 *  ```
 */
export class LfxClipInstance {
    // ─────────────────────────────────────────────────────────────────────────
    constructor(init) {
        // ── Estado de freeze ─────────────────────────────────────────────────────
        this._frozen = false;
        if (!init || typeof init.id !== 'string' || init.id.length === 0) {
            throw new Error('[LfxClipInstance] `id` is required and must be a non-empty string.');
        }
        this.id = init.id;
        this.title = typeof init.title === 'string' ? init.title : 'Untitled Clip';
        this.author = typeof init.author === 'string' ? init.author : 'unknown';
        this._userArchetype = isUserArchetype(init.userArchetype)
            ? init.userArchetype
            : 'utility';
        this.spatialBehavior = isSpatialBehavior(init.spatialBehavior)
            ? init.spatialBehavior
            : 'static';
        this.maxStrobeFreqHz =
            typeof init.maxStrobeFreqHz === 'number' && Number.isFinite(init.maxStrobeFreqHz)
                ? Math.max(0, init.maxStrobeFreqHz)
                : 0;
        this.compatibleVibes = Array.isArray(init.compatibleVibes)
            ? uniqueOrder(init.compatibleVibes.filter(isCompatibleVibe))
            : [];
        this.energyZones = Array.isArray(init.energyZones)
            ? uniqueOrder(init.energyZones.filter(isEnergyZone))
            : [];
        const a = init.acoTriad;
        this.acoTriad = {
            aggression: clamp01(a?.aggression ?? NEUTRAL_ACO.aggression),
            chaos: clamp01(a?.chaos ?? NEUTRAL_ACO.chaos),
            organicity: clamp01(a?.organicity ?? NEUTRAL_ACO.organicity),
        };
        // Aplicar bias del arquetipo en construcción (idempotente).
        this.bakeCognitiveDNA();
    }
    // ─── GETTERS / SETTERS ────────────────────────────────────────────────────
    get userArchetype() {
        return this._userArchetype;
    }
    setUserArchetype(arch) {
        this._assertMutable();
        if (!isUserArchetype(arch)) {
            throw new Error(`[LfxClipInstance] Invalid userArchetype: ${String(arch)}`);
        }
        this._userArchetype = arch;
        this.bakeCognitiveDNA();
    }
    setAcoTriad(triad) {
        this._assertMutable();
        if (typeof triad.aggression === 'number')
            this.acoTriad.aggression = clamp01(triad.aggression);
        if (typeof triad.chaos === 'number')
            this.acoTriad.chaos = clamp01(triad.chaos);
        if (typeof triad.organicity === 'number')
            this.acoTriad.organicity = clamp01(triad.organicity);
        this.bakeCognitiveDNA();
    }
    setEnergyZones(zones) {
        this._assertMutable();
        this.energyZones = uniqueOrder(zones.filter(isEnergyZone));
        this.bakeCognitiveDNA();
    }
    setCompatibleVibes(vibes) {
        this._assertMutable();
        this.compatibleVibes = uniqueOrder(vibes.filter(isCompatibleVibe));
    }
    setSpatialBehavior(b) {
        this._assertMutable();
        if (!isSpatialBehavior(b)) {
            throw new Error(`[LfxClipInstance] Invalid spatialBehavior: ${String(b)}`);
        }
        this.spatialBehavior = b;
    }
    setMaxStrobeFreqHz(hz) {
        this._assertMutable();
        if (!Number.isFinite(hz) || hz < 0) {
            throw new Error(`[LfxClipInstance] maxStrobeFreqHz must be a finite number ≥0.`);
        }
        this.maxStrobeFreqHz = hz;
    }
    // ─── EL TRADUCTOR — bakeCognitiveDNA() ────────────────────────────────────
    /**
     * Aplica las reglas de bias del arquetipo activo sobre la realidad ACO y
     * sobre la lista de zonas. Determinista, idempotente y zero-alloc-friendly.
     *
     * Orden de operaciones:
     *  1. Clamp ACO contra `aggressionMin/Max`, `chaosMin/Max`, `organicityMin/Max`.
     *  2. Intersectar `energyZones` actuales con `allowedZones` (si existe).
     *  3. Si la intersección es vacía → caer en `defaultZones`.
     *  4. Si `energyZones` queda vacía aún → cae en `defaultZones`.
     */
    bakeCognitiveDNA() {
        this._assertMutable();
        const bias = ARCHETYPE_BIAS_MAP[this._userArchetype];
        // 1. ACO clamps
        this.acoTriad.aggression = clampRange(this.acoTriad.aggression, bias.aggressionMin, bias.aggressionMax);
        this.acoTriad.chaos = clampRange(this.acoTriad.chaos, bias.chaosMin, bias.chaosMax);
        this.acoTriad.organicity = clampRange(this.acoTriad.organicity, bias.organicityMin, bias.organicityMax);
        // 2-3. Zone intersection
        const filtered = intersectZones(this.energyZones, bias.allowedZones);
        if (filtered.length > 0) {
            this.energyZones = filtered;
        }
        else if (this.energyZones.length === 0 || bias.allowedZones != null) {
            this.energyZones = [...bias.defaultZones];
        }
        // 4. Fallback general si quedó vacío
        if (this.energyZones.length === 0) {
            this.energyZones = [...bias.defaultZones];
        }
    }
    // ─── HOT-PATH SAFETY — freeze() ───────────────────────────────────────────
    /**
     * Congela recursivamente el átomo. Tras `freeze()`:
     *   - cualquier `set*` lanza Error.
     *   - los arrays `compatibleVibes`/`energyZones` y el objeto `acoTriad`
     *     son inmutables (`Object.freeze`).
     *   - la propia instancia es congelada.
     *
     * Garantiza zero-alloc safety al entrar al runtime y permite a Selene
     * cachear referencias confiando en que nada mutará.
     */
    freeze() {
        if (this._frozen)
            return this;
        Object.freeze(this.acoTriad);
        Object.freeze(this.compatibleVibes);
        Object.freeze(this.energyZones);
        this._frozen = true;
        Object.freeze(this);
        return this;
    }
    get isFrozen() {
        return this._frozen;
    }
    // ─── SERIALIZACIÓN / EXPORT ──────────────────────────────────────────────
    /**
     * Snapshot plano (PoD) listo para JSON / IPC. Independiente del freeze.
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            author: this.author,
            userArchetype: this._userArchetype,
            spatialBehavior: this.spatialBehavior,
            maxStrobeFreqHz: this.maxStrobeFreqHz,
            compatibleVibes: [...this.compatibleVibes],
            energyZones: [...this.energyZones],
            acoTriad: { ...this.acoTriad },
        };
    }
    /**
     * Proyecta el átomo a un bloque `CognitiveDNA` (formato `.lfx v2.1`).
     *
     * - `genome`: tríada ACO directa.
     * - `compatibleVibes`: vibes traducidas a las etiquetas reales de Selene
     *   (vía `VIBE_BRIDGE`).
     * - `energyZone`: rango [min..max] derivado del primer y último elemento
     *   de `energyZones` ordenados por la lista canónica `ENERGY_ZONES`.
     * - `aggressionRange`: rango [agg, agg] cerrado sobre el valor actual.
     * - `textureAffinity`: derivada del arquetipo (`strobe`/`heavy`→`dirty`,
     *   `ambient`/`divine`→`clean`, `utility`→`universal`).
     * - `spatialBehavior`: mapeado al subset de `lfxTypes` (`'static'`
     *   pasa tal cual; los otros también son válidos en lfx).
     */
    toCognitiveDNA() {
        const genome = Object.freeze({
            aggression: this.acoTriad.aggression,
            chaos: this.acoTriad.chaos,
            organicity: this.acoTriad.organicity,
        });
        // Calcular min/max de zone respetando orden canónico
        const order = ENERGY_ZONES;
        let minIdx = order.length - 1;
        let maxIdx = 0;
        for (const z of this.energyZones) {
            const i = order.indexOf(z);
            if (i < 0)
                continue;
            if (i < minIdx)
                minIdx = i;
            if (i > maxIdx)
                maxIdx = i;
        }
        if (this.energyZones.length === 0) {
            minIdx = 0;
            maxIdx = order.length - 1;
        }
        const energyZone = Object.freeze({
            min: order[minIdx],
            max: order[maxIdx],
        });
        const textureAffinity = this._userArchetype === 'strobe' || this._userArchetype === 'heavy'
            ? 'dirty'
            : this._userArchetype === 'ambient' || this._userArchetype === 'divine'
                ? 'clean'
                : 'universal';
        const compatibleVibes = Object.freeze(this.compatibleVibes.map(v => VIBE_BRIDGE[v]));
        const aggression = this.acoTriad.aggression;
        const aggressionRange = Object.freeze({ min: aggression, max: aggression });
        const pressureRange = Object.freeze({ min: 0, max: 0 });
        const spatialBehavior = this.spatialBehavior;
        return Object.freeze({
            genome,
            textureAffinity,
            compatibleVibes,
            validSections: Object.freeze([]),
            energyZone,
            aggressionRange,
            pressureRange,
            spatialBehavior,
            ikCompatibility: undefined,
        });
    }
    // FASE 3: fromLegacyLfx (V2.1 compat bridge) demolished.
    // _reverseVibeBridge and _inferArchetypeFromLegacy also removed — no callers.
    // ─── INTERNALS ───────────────────────────────────────────────────────────
    _assertMutable() {
        if (this._frozen) {
            throw new Error('[LfxClipInstance] Instance is frozen. Clone via toJSON() and re-instantiate to mutate.');
        }
    }
}
