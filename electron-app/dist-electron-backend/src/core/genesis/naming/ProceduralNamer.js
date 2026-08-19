// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 ADDENDUM — PROCEDURAL NAMING ENGINE
// ═══════════════════════════════════════════════════════════════════════════
//  Deterministic, pure name generator for Genesis Engine organisms.
//  Zero external dependencies. Same organism → same name, always.
//
//  Combinatorial space: 32 adjectives × 32 nouns × 21 suffix slots = 22,572
//  unique combinations (well above the 14,000 requirement).
//
//  Output format: "[Adjective] [Noun]" or "[Adjective] [Noun] [Suffix]"
//  Max length: < 24 characters in 100% of cases.
// ═══════════════════════════════════════════════════════════════════════════
// ─── DETERMINISTIC HASH (FNV-1a 32-bit) ─────────────────────────────────────
function fnv1aHash(input) {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    // Mix in additional entropy via XOR shift
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    return hash >>> 0; // unsigned 32-bit
}
// ─── VOCABULARY ─────────────────────────────────────────────────────────────
// Adjectives: by aggression band × texture affinity.
// 32 terms across 4 buckets (8 each).
const ADJECTIVES_HIGH_CLEAN = [
    'Savage', 'Primal', 'Feral', 'Wild', 'Brutal', 'Iron', 'Crimson', 'Blaze',
];
const ADJECTIVES_HIGH_DIRTY = [
    'Toxic', 'Viral', 'Vicious', 'Corrupt', 'Malign', 'Rogue', 'Foul', 'Rabid',
];
const ADJECTIVES_LOW_CLEAN = [
    'Glacial', 'Velvet', 'Pure', 'Silent', 'Ethereal', 'Crystal', 'Lunar', 'Aura',
];
const ADJECTIVES_LOW_DIRTY = [
    'Obsidian', 'Void', 'Shadow', 'Abyss', 'Dark', 'Umbra', 'Hollow', 'Gloom',
];
// Universal adjectives (used as fallback / extra pool)
const ADJECTIVES_UNIVERSAL = [
    'Neon', 'Cyber', 'Solar', 'Sonic', 'Astral', 'Plasma', 'Quantum', 'Chrome',
];
// All adjectives combined (32 total)
const ALL_ADJECTIVES = [
    ...ADJECTIVES_HIGH_CLEAN,
    ...ADJECTIVES_HIGH_DIRTY,
    ...ADJECTIVES_LOW_CLEAN,
    ...ADJECTIVES_LOW_DIRTY,
];
// Nouns: by chaos band + kinetic form.
// 32 terms across 4 buckets (8 each).
const NOUNS_HIGH_CHAOS = [
    'Storm', 'Rift', 'Surge', 'Maelstrom', 'Fracture', 'Cascade', 'Burst', 'Vortex',
];
const NOUNS_LOW_CHAOS = [
    'Orbit', 'Matrix', 'Core', 'Wave', 'Beam', 'Pulse', 'Echo', 'Drift',
];
const NOUNS_KINETIC = [
    'Sweep', 'Tide', 'Strike', 'Flash', 'Arc', 'Flux', 'Spiral', 'Blade',
];
const NOUNS_STRUCTURAL = [
    'Halo', 'Crown', 'Spear', 'Nova', 'Gate', 'Shield', 'Thorn', 'Mark',
];
// All nouns combined (32 total)
const ALL_NOUNS = [
    ...NOUNS_HIGH_CHAOS,
    ...NOUNS_LOW_CHAOS,
    ...NOUNS_KINETIC,
    ...NOUNS_STRUCTURAL,
];
// Suffixes: by rarity tier + generation.
// 20 variations + 1 empty slot = 21 options.
const SUFFIXES_COMMON = ['', '', '', '', 'Mk.II', 'Mk.III', 'Beta', 'Raw'];
const SUFFIXES_RARE = ['', '', 'Mk.IV', 'Prime', 'X', 'Plus', 'Alpha', 'EX'];
const SUFFIXES_EPIC = ['', 'Prime', 'X', 'Ultra', 'Apex', 'Omega', 'Z', 'REX'];
const SUFFIXES_LEGENDARY = ['Prime', 'Omega', 'Apex', 'Ultra', 'MAX', 'Z', 'REX', 'Nova'];
// 🔬 WAVE 7540: 'NULL' literal removed — was propagating to the UI as the
// literal string "NULL" for MYTHIC organisms. Replaced with 'Prime' to
// keep the pool at 8 entries and maintain combinatorial space integrity.
const SUFFIXES_MYTHIC = ['Omega', 'Apex', 'MAX', 'REX', 'Nova', 'Zero', 'Alpha', 'Prime'];
// ─── CORE ALGORITHM ─────────────────────────────────────────────────────────
/**
 * Generate a deterministic, compact name for a Genesis organism.
 *
 * @param organism The organism to name
 * @param blueprint Optional blueprint DNA context for richer vocabulary selection
 * @returns A short punchy name like "Obsidian Sweep Mk.IV" (always < 24 chars)
 */
export function generateOrganismName(organism, blueprint) {
    // ── Seed: deterministic hash from organism identity + metrics ──
    const seedSource = `${organism.organismId}:${organism.rarityScore.toFixed(4)}:${organism.fitnessScore.toFixed(4)}:${organism.generation}`;
    const seed = fnv1aHash(seedSource);
    // ── Adjective selection ──
    let adjective;
    if (blueprint) {
        const aggressionHigh = blueprint.dnaAggression >= 0.5;
        const textureDirty = blueprint.textureAffinity === 'dirty';
        let pool;
        if (aggressionHigh && !textureDirty)
            pool = ADJECTIVES_HIGH_CLEAN;
        else if (aggressionHigh && textureDirty)
            pool = ADJECTIVES_HIGH_DIRTY;
        else if (!aggressionHigh && !textureDirty)
            pool = ADJECTIVES_LOW_CLEAN;
        else
            pool = ADJECTIVES_LOW_DIRTY;
        // Mix in universal adjectives occasionally (deterministic)
        if ((seed & 0x0f) === 0) {
            pool = ADJECTIVES_UNIVERSAL;
        }
        adjective = pool[seed % pool.length];
    }
    else {
        // Fallback: use rarityScore + l2Distance as proxies
        const aggressive = organism.rarityScore > 0.6 || organism.l2DistanceParent > 0.4;
        const pool = aggressive
            ? [...ADJECTIVES_HIGH_CLEAN, ...ADJECTIVES_HIGH_DIRTY]
            : [...ADJECTIVES_LOW_CLEAN, ...ADJECTIVES_LOW_DIRTY];
        adjective = pool[seed % pool.length];
    }
    // ── Noun selection ──
    let nounPool;
    if (blueprint) {
        const chaosHigh = blueprint.dnaChaos >= 0.5;
        const organic = blueprint.dnaOrganicity >= 0.5;
        nounPool = chaosHigh
            ? (organic ? NOUNS_KINETIC : NOUNS_HIGH_CHAOS)
            : (organic ? NOUNS_STRUCTURAL : NOUNS_LOW_CHAOS);
    }
    else {
        // Use operator type as a proxy for chaos
        const chaosLikeOps = ['gene_augmentation', 'crossover', 'proportional_stretch'];
        const isChaotic = chaosLikeOps.includes(organism.operatorUsed);
        nounPool = isChaotic ? NOUNS_HIGH_CHAOS : NOUNS_LOW_CHAOS;
    }
    // Second hash word for noun index
    const nounSeed = fnv1aHash(`${organism.organismId}:noun:${organism.generation}`);
    const noun = nounPool[nounSeed % nounPool.length];
    // ── Suffix selection (by rarity + generation) ──
    // 🔬 WAVE 7540: Use resolveSuffix() for null-safe suffix resolution.
    const suffixSeed = fnv1aHash(`${organism.organismId}:suffix:${organism.rarityTier}`);
    const suffix = resolveSuffix(organism.rarityTier, suffixSeed);
    // ── Assemble ──
    const base = `${adjective} ${noun}`;
    const fullName = suffix ? `${base} ${suffix}` : base;
    // Safety clamp — should never exceed 24 chars with our vocabulary
    if (fullName.length > 24) {
        // Drop suffix if too long
        return base.length <= 24 ? base : base.substring(0, 24);
    }
    return fullName;
}
// ─── HELPERS ────────────────────────────────────────────────────────────────
function getSuffixPool(tier) {
    switch (tier) {
        case 'COMMON': return SUFFIXES_COMMON;
        case 'RARE': return SUFFIXES_RARE;
        case 'EPIC': return SUFFIXES_EPIC;
        case 'LEGENDARY': return SUFFIXES_LEGENDARY;
        case 'MYTHIC': return SUFFIXES_MYTHIC;
        default: return SUFFIXES_COMMON;
    }
}
/**
 * 🔬 WAVE 7540: Safe suffix resolver — guarantees a non-null, non-empty
 * string suffix for any tier. If the suffix pool returns an empty string
 * or an invalid value, this falls back to "Variant" so the UI never
 * displays "NULL" or "undefined".
 */
function resolveSuffix(tier, seed) {
    const pool = getSuffixPool(tier);
    if (pool.length === 0)
        return 'Variant';
    const suffix = pool[seed % pool.length];
    // Empty string is valid (means no suffix) — but null/undefined is not
    if (suffix == null)
        return 'Variant';
    return suffix;
}
// ─── COMBINATORIAL SPACE VERIFICATION ───────────────────────────────────────
/**
 * Returns the theoretical combinatorial space size.
 * 32 adjectives × 32 nouns × 21 suffix slots (including empty) = 22,572.
 */
export const COMBINATORIAL_SPACE = ALL_ADJECTIVES.length * ALL_NOUNS.length * 21; // 22,572
