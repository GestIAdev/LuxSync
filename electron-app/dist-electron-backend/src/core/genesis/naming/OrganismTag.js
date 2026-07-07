// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 6000.V5 — Organism Tag (Short Fallback Labels)
// ═══════════════════════════════════════════════════════════════════════════
//  Military-style short tags for organisms that haven't earned a name.
//  Format: RARITY-xxxx (4 hex chars from UUID)
//  If custom_name exists, it takes precedence (champion baptism).
// ═══════════════════════════════════════════════════════════════════════════
export function getOrganismTag(org) {
    if (org.custom_name)
        return org.custom_name;
    const uuidPart = org.organism_id.includes(':')
        ? org.organism_id.split(':')[1]
        : org.organism_id;
    const shortId = uuidPart.substring(0, 4).toLowerCase();
    return `${org.rarity_tier.toUpperCase()}-${shortId}`;
}
