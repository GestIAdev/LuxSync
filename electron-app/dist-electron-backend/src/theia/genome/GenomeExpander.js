/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 WAVE 8234 — INFINITE GENOME · Fase G2: Genome Expander & Retroprojection
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El motor biológico del blueprint (§4.3–§4.5): convierte una semilla de
 * 32 bits en un FENOTIPO EXPRESADO — valores exactos de genes `G_*` —
 * y retroproyecta el ADN del individuo resultante para que Selene/Cassandra
 * lo clasifiquen con honestidad (matching por personalidad real, §4.4).
 *
 *   expand(core, seed) → {G_k}
 *
 *   1. Aleatoriedad por gen:  u_k = PCG(seed ⊕ hash(core) ⊕ k) / 2³²
 *   2. Sesgo por ADN:         μ_k = ½ + ½·tanh(2·α_k·d')
 *                             d' = (aggression, chaos, organicity) − 0.5
 *   3. Dispersión por caos:   σ = 0.15 + 0.6·chaos
 *                             t_k = clamp(μ_k + σ·(u_k − ½)·2, 0, 1)
 *   4. Expresión:             lin: G = min + t·(max−min)
 *                             exp: G = min·(max/min)^t
 *                             int → redondeo
 *   5. seed 0 = fenotipo canónico (defaults del artista).
 *
 *   Retroproyección (§4.4):  d_var = clamp(d_core + κ·Σ α_k·(t_k − t_kᵈᵉᶠ))
 *   Identidad (§4.5):        genomeId = FNV1a(coreHash ‖ G₀ ‖ … ‖ G_n)
 *                            con los valores cuantizados (float → 8 bits).
 *
 * Módulo PURO: sin estado, sin GL, sin stores — todo es testeable.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { hashSourceU32, } from '../shader/ShaderAssembler';
// ─────────────────────────── PCG-XSH-RR (§4.3-1) ───────────────────────────
const PCG_MUL = 6364136223846793005n;
const PCG_INC = 1442695040888963407n;
const MASK64 = 0xffffffffffffffffn;
/**
 * PCG32 (XSH-RR) de un solo paso — el blueprint siembra cada gen con un
 * estado propio (`seed ⊕ coreHash ⊕ k`), así que avanzamos una vez la LCG
 * y extraemos la salida permutada. BigInt: fuera de cualquier hot path.
 */
export function pcg32(seed) {
    const s = ((BigInt(seed >>> 0) * PCG_MUL + PCG_INC) & MASK64);
    const xsh = Number(((s >> 18n) ^ s) >> 27n) >>> 0;
    const rot = Number(s >> 59n);
    return ((xsh >>> rot) | (xsh << ((32 - rot) & 31))) >>> 0;
}
/** u_k ∈ [0,1) — aleatoriedad determinista del gen k para esta semilla. */
export function geneUniform(seed, coreHash, k) {
    return pcg32((seed ^ coreHash ^ k) >>> 0) / 0x100000000;
}
// ─────────────────────────── Internos ───────────────────────────
function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
/** ADN del core desde `meta.genome`; ejes ausentes → 0.5 (neutro). */
export function coreDna(meta) {
    return {
        aggression: clamp01(meta.genome.aggression ?? 0.5),
        chaos: clamp01(meta.genome.chaos ?? 0.5),
        organicity: clamp01(meta.genome.organicity ?? 0.5),
    };
}
/** ¿La curva `exp` es aplicable? (min/max deben ser > 0; si no → lin). */
function expOk(g) {
    return g.curve === 'exp' && g.min > 0 && g.max > 0;
}
/** Expresión §4.3-4: t ∈ [0,1] → valor (clamp + redondeo int). */
export function expressGene(g, t) {
    let v;
    if (expOk(g)) {
        v = g.min * Math.pow(g.max / g.min, t);
    }
    else {
        v = g.min + t * (g.max - g.min);
    }
    v = Math.min(g.max, Math.max(g.min, v));
    return g.type === 'int' ? Math.round(v) : v;
}
/**
 * Posición normalizada t ∈ [0,1] de un valor en el rango del gen
 * (inversa de `expressGene` — la usa la retroproyección para t_default).
 */
export function tOfGeneValue(g, value) {
    if (expOk(g)) {
        if (value <= 0)
            return 0;
        const span = Math.log(g.max / g.min);
        if (span === 0)
            return 0;
        return clamp01(Math.log(value / g.min) / span);
    }
    if (g.max === g.min)
        return 0;
    return clamp01((value - g.min) / (g.max - g.min));
}
// ─────────────────────────── Misión 1: expand() ───────────────────────────
/**
 * §4.3 — expansión determinista `seed → fenotipo`.
 *
 * La misma (meta, coreSource, seed) produce SIEMPRE el mismo individuo.
 * `seed === 0` devuelve el fenotipo canónico (defaults del artista, ADN
 * sin retroproyectar — Δ_k = 0 por construcción).
 *
 * @param meta       meta `@euclid` ya parseado del core.
 * @param coreSource fuente GLSL del core — su FNV-1a es `hash(core)`.
 * @param seed       semilla u32 del individuo (`core#seed`).
 */
export function expandGenome(meta, coreSource, seed) {
    const coreHash = hashSourceU32(coreSource);
    const dnaCore = coreDna(meta);
    const s32 = seed >>> 0;
    const genes = {};
    const ts = {};
    // d' — ADN centrado en 0 (§4.3-2).
    const dpA = dnaCore.aggression - 0.5;
    const dpC = dnaCore.chaos - 0.5;
    const dpO = dnaCore.organicity - 0.5;
    // σ — dispersión por caos: entropía literal de la variación (§4.3-3).
    const sigma = 0.15 + 0.6 * dnaCore.chaos;
    meta.genes.forEach((g, k) => {
        if (!/^G_[A-Za-z0-9_]+$/.test(g.name))
            return; // contrato G_*
        let t;
        if (s32 === 0) {
            // Semilla 0 = fenotipo canónico (§4.3-5): el artista manda.
            t = tOfGeneValue(g, g.defaultValue);
        }
        else {
            const u = geneUniform(s32, coreHash, k);
            const dot = (g.affinities.a ?? 0) * dpA +
                (g.affinities.c ?? 0) * dpC +
                (g.affinities.o ?? 0) * dpO;
            const mu = 0.5 + 0.5 * Math.tanh(2 * dot);
            t = clamp01(mu + sigma * (u - 0.5) * 2);
        }
        genes[g.name] = expressGene(g, t);
        ts[g.name] = t;
    });
    const dna = retroprojectDna(meta, ts, dnaCore);
    const genomeHash = genomeIdU32(coreHash, meta.genes, ts);
    return {
        genes,
        genomeId: genomeHash.toString(16).padStart(8, '0'),
        genomeHash,
        dna,
    };
}
// ───────────────────── Misión 3: retroproyección (§4.4) ─────────────────────
/** κ ≈ 0.25 — cuánto pesa la expresión real sobre el ADN declarado. */
export const RETROJECTION_KAPPA = 0.25;
/**
 * §4.4 — el individuo recalcula su ADN a partir de lo que expresó:
 *   d_var[i] = clamp01(d_core[i] + κ · Σ_k α_k[i]·(t_k − t_k^default))
 *
 * Un fenotipo que empuja genes con afinidad `a:+` declara más agresión
 * de la que el core anunciaba — Selene lo clasifica con honestidad.
 */
export function retroprojectDna(meta, ts, dnaCore) {
    const base = dnaCore ?? coreDna(meta);
    let a = base.aggression;
    let c = base.chaos;
    let o = base.organicity;
    for (const g of meta.genes) {
        const t = ts[g.name];
        if (t === undefined)
            continue;
        const dt = t - tOfGeneValue(g, g.defaultValue);
        if (dt === 0)
            continue;
        a += RETROJECTION_KAPPA * (g.affinities.a ?? 0) * dt;
        c += RETROJECTION_KAPPA * (g.affinities.c ?? 0) * dt;
        o += RETROJECTION_KAPPA * (g.affinities.o ?? 0) * dt;
    }
    return { aggression: clamp01(a), chaos: clamp01(c), organicity: clamp01(o) };
}
// ───────────────────── Misión 2: identidad genomeId (§4.5) ─────────────────────
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/** Mezcla FNV-1a de un u32 (byte a byte, little-endian estable). */
function fnv1aMix(h, v) {
    h ^= v & 0xff;
    h = Math.imul(h, FNV_PRIME);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, FNV_PRIME);
    h ^= (v >>> 16) & 0xff;
    h = Math.imul(h, FNV_PRIME);
    h ^= (v >>> 24) & 0xff;
    h = Math.imul(h, FNV_PRIME);
    return h >>> 0;
}
/** Cuantización §4.5: `int` → el valor exacto; `float` → t a 8 bits. */
function quantizeGene(g, t, value) {
    if (g.type === 'int')
        return Math.round(value) >>> 0;
    return Math.round(clamp01(t) * 255) >>> 0;
}
/**
 * §4.5 — `genomeId = FNV1a(coreHash ‖ G₀ ‖ … ‖ G_n)` sobre los valores
 * ya cuantizados. Dos semillas que expresan el mismo fenotipo (dentro
 * del umbral perceptual de 8 bits) producen el MISMO genomeId → el
 * LiveDeck colapsa duplicados.
 *
 * Orden de mezcla: orden de DECLARACIÓN del core (determinista — la
 * gramática §4.2 fija el orden de los `@euclid gene` en la fuente).
 */
export function genomeIdU32(coreHash, genes, ts) {
    let h = fnv1aMix(FNV_OFFSET, coreHash >>> 0);
    for (const g of genes) {
        if (!/^G_[A-Za-z0-9_]+$/.test(g.name))
            continue;
        const t = ts[g.name] ?? tOfGeneValue(g, g.defaultValue);
        const value = expressGene(g, t);
        h = fnv1aMix(h, quantizeGene(g, t, value));
    }
    return h >>> 0;
}
// ───────────────────── Reproducción (§4.6 — WAVE 8235 · G3) ─────────────────────
/** Probabilidad de mutación base (p_m = BASE + CHAOS·chaos_hijo). */
export const CROSS_MUT_BASE = 0.05;
/** Ganancia de chaos en la probabilidad de mutación. */
export const CROSS_MUT_CHAOS = 0.25;
/** Amplitud del desplazamiento mutante, en fracción del rango del gen. */
export const CROSS_MUT_DISP = 0.15;
/**
 * §4.6 — semilla hija `PCG(seed_actual ⊕ contador_de_frases)`. El mixer
 * de golden-ratio evita correlación entre frases consecutivas.
 */
export function genomeChildSeed(seed, phraseCount) {
    return pcg32((seed >>> 0) ^ (Math.imul(phraseCount >>> 0, 0x9e3779b9) >>> 0));
}
/**
 * §4.6 — crossover entre dos individuos del MISMO core (genes homólogos):
 *
 *   1. Herencia: cada gen del hijo viene del padre A o del B con p = ½
 *      (lane `4k` del RNG por-gen).
 *   2. chaos_hijo: se retroproyecta el fenotipo recién heredado para
 *      conocer el temperamento del hijo antes de mutarlo.
 *   3. Mutación espontánea con p_m = 0.05 + 0.25·chaos_hijo (lane `4k+1`):
 *      desplazamiento gaussiano barato `Δv = (u1 + u2 − 1)·0.15·rango`
 *      (lanes `4k+2`, `4k+3`), clamp al rango y redondeo `int`.
 *   4. Retroproyección final (§4.4) + genomeId §4.5.
 *
 * Determinista: la misma (A, B, seed) produce siempre el mismo hijo.
 */
export function crossoverGenome(meta, coreSource, genesA, genesB, seed) {
    const coreHash = hashSourceU32(coreSource);
    const s32 = seed >>> 0;
    const genes = {};
    const ts = {};
    const decl = meta.genes.filter((g) => /^G_[A-Za-z0-9_]+$/.test(g.name));
    // Pase 1 — herencia homóloga: cada gen viene de A o de B (p = ½).
    decl.forEach((g, k) => {
        const fromA = geneUniform(s32, coreHash, k * 4) < 0.5;
        const v = (fromA ? genesA : genesB)[g.name] ?? g.defaultValue;
        genes[g.name] = v;
        ts[g.name] = tOfGeneValue(g, v);
    });
    // chaos_hijo = ADN retroproyectado del hijo ANTES de mutar (§4.6).
    const chaosChild = retroprojectDna(meta, ts).chaos;
    const pMut = CROSS_MUT_BASE + CROSS_MUT_CHAOS * chaosChild;
    // Pase 2 — mutación espontánea (gaussiana aproximada, barata).
    decl.forEach((g, k) => {
        if (geneUniform(s32, coreHash, k * 4 + 1) >= pMut)
            return;
        const range = g.max - g.min;
        if (!(range > 0))
            return;
        const u1 = geneUniform(s32, coreHash, k * 4 + 2);
        const u2 = geneUniform(s32, coreHash, k * 4 + 3);
        const t = tOfGeneValue(g, genes[g.name] + (u1 + u2 - 1) * CROSS_MUT_DISP * range);
        genes[g.name] = expressGene(g, t); // clamp + redondeo int
        ts[g.name] = t;
    });
    const dna = retroprojectDna(meta, ts);
    const genomeHash = genomeIdU32(coreHash, meta.genes, ts);
    return {
        genes,
        genomeId: genomeHash.toString(16).padStart(8, '0'),
        genomeHash,
        dna,
    };
}
