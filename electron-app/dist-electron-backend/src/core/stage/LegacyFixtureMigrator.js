/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 7670: Legacy Fixture Path Migrator
 *
 * One-shot, idempotent reconciliation of pre-WAVE-7605 fixture paths.
 * Older shows reference deprecated `.fxt` paths / legacy folders
 * (`librerias`, `factory`, `custom`), causing FixtureProfileResolver to
 * fail and leaving `stageStore` fixtures with empty `channels`.
 *
 * Algorithm:
 *   1. SKIP fixtures that already resolve or carry inline channels.
 *   2. DETECT legacy shape (.fxt extension, legacy folder segments).
 *   3. MATCH against the live userData/fixtures/*.json library.
 *   4. REWRITE on unique match (profileId, definitionPath, channels, channelCount).
 *   5. NEVER guess on ambiguity — log and leave untouched.
 *
 * Safety:
 *   - Idempotent (step 1 skips healthy fixtures).
 *   - Never deletes or invents channels — only copies from matched library entry.
 *   - Logs every skip/match/ambiguous/unmatched for operator audit.
 *   - Caller is responsible for backup before persisting.
 *
 * @module core/stage/LegacyFixtureMigrator
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { resolveRuntimeFixtureDefinition } from '../library/RuntimeFixtureLibrary';
// ── Custom Alias Dictionary (WAVE 7677) ─────────────────────────────────────
//
// Hardcoded overrides for known legacy UUIDs that fail standard string
// matching but ARE valid library entries. When a fixture's profileId
// matches a key here, we bypass the confidence-ordering and directly
// resolve via RuntimeFixtureLibrary.
//
// The alias target must be an EXACT id that exists in the live library
// (userData/fixtures/*.json). Verified against the runtime library at
// migration time — if the target isn't loaded, we fall through to the
// normal matching logic.
//
// To add a new stubborn UUID:
//   1. Find the fixture JSON in userData/fixtures/ and read its "id" field
//   2. Add an entry: 'legacy-uuid': 'actual-library-id'
const CUSTOM_ALIAS_MAP = {
    // EL 1140 TESTING (Chino moving-head, 10ch)
    // File: userData/fixtures/user-1770473024494-gooaf830g.json
    // Problem: shows reference this UUID as profileId but with empty
    // definitionPath and empty channels — the migrator's Step 1 skip
    // left them broken because resolveRuntimeFixtureDefinition found
    // the profile but didn't rewrite the missing channels/path.
    'user-1770473024494-gooaf830g': 'user-1770473024494-gooaf830g',
};
// ── Legacy detection ────────────────────────────────────────────────────────
const LEGACY_MARKERS = ['.fxt', 'librerias', '/factory/', '/custom/', '\\factory\\', '\\custom\\'];
function isLegacyPath(value) {
    if (!value || typeof value !== 'string')
        return false;
    const lower = value.toLowerCase();
    return LEGACY_MARKERS.some(marker => lower.includes(marker));
}
function hasLegacyShape(fixture) {
    return isLegacyPath(fixture.definitionPath) ||
        isLegacyPath(fixture.profileId) ||
        isLegacyPath(fixture.definitionId) ||
        isLegacyPath(fixture.fixtureDefId);
}
// ── Matching ────────────────────────────────────────────────────────────────
function extractStem(filePath) {
    const parts = filePath.split(/[\\/]/);
    const basename = parts[parts.length - 1] || filePath;
    const idx = basename.lastIndexOf('.');
    return idx > 0 ? basename.slice(0, idx).toLowerCase() : basename.toLowerCase();
}
function normalizeName(value) {
    return value.trim().toLowerCase().replace(/[_\-\s]/g, '');
}
/**
 * Attempt to match a legacy fixture against the live library.
 * Returns the matched definition, or null if no/ambiguous match.
 */
function matchLegacyFixture(fixture) {
    // Build all candidate lookup keys from the fixture's legacy identifiers
    const candidateKeys = [];
    const profileId = fixture.profileId || fixture.definitionId || fixture.fixtureDefId;
    const definitionPath = fixture.definitionPath;
    const model = fixture.model;
    const name = fixture.name;
    // 1. Basename-stem of definitionPath vs library entry id
    if (definitionPath) {
        const stem = extractStem(definitionPath);
        if (stem)
            candidateKeys.push(stem);
    }
    // 2. profileId stem (might be 'EL_1140.fxt' → 'el_1140')
    if (profileId) {
        const stem = extractStem(profileId);
        if (stem)
            candidateKeys.push(stem);
        candidateKeys.push(profileId.toLowerCase());
    }
    // Try resolving via the library's normalized lookup (basename-stem matching)
    const matches = new Set();
    for (const key of candidateKeys) {
        const def = resolveRuntimeFixtureDefinition([key]);
        if (def)
            matches.add(def);
    }
    // 3. Exact case-insensitive model vs library entry name
    if (model) {
        const modelNorm = model.toLowerCase();
        // We need to scan the full library — but RuntimeFixtureLibrary doesn't
        // expose an iterator. We use resolveRuntimeFixtureDefinition with the
        // model name as a candidate (it normalizes and checks basename/stem).
        const def = resolveRuntimeFixtureDefinition([model, modelNorm]);
        if (def)
            matches.add(def);
    }
    // 4. Exact case-insensitive name vs library entry name
    if (name) {
        const nameNorm = name.toLowerCase();
        const def = resolveRuntimeFixtureDefinition([name, nameNorm]);
        if (def)
            matches.add(def);
    }
    // 5. Normalized name match (strip _ - and whitespace)
    if (model || name) {
        const normalizedKey = normalizeName(model || name || '');
        if (normalizedKey) {
            const def = resolveRuntimeFixtureDefinition([normalizedKey]);
            if (def)
                matches.add(def);
        }
    }
    if (matches.size === 0)
        return null;
    if (matches.size > 1) {
        // Ambiguous — collect all candidate IDs for logging
        const first = matches.values().next().value;
        return { definition: first, candidates: [...matches].map(d => d.id) };
    }
    return { definition: [...matches][0], candidates: [] };
}
// ── Main migrator ───────────────────────────────────────────────────────────
/**
 * Run legacy fixture reconciliation on a show file's fixtures array.
 * Mutates fixtures in-place. Returns a report of what happened.
 *
 * Idempotent: fixtures that already resolve or have inline channels are skipped.
 */
export function migrateLegacyFixtures(fixtures) {
    const report = {
        scanned: 0,
        migrated: 0,
        ambiguous: 0,
        unmatched: 0,
        details: [],
    };
    for (const fixture of fixtures) {
        report.scanned++;
        // Step 0 (WAVE 7677): CUSTOM ALIAS DICTIONARY OVERRIDE
        // Check if the profileId is in the hardcoded alias map. If so,
        // directly resolve the target library entry and rewrite — bypassing
        // all other logic. This handles stubborn UUIDs that have empty
        // channels/definitionPath in shows but DO exist in the library.
        const profileId = fixture.profileId || fixture.definitionId || fixture.fixtureDefId;
        const aliasTarget = profileId ? CUSTOM_ALIAS_MAP[profileId] : undefined;
        if (aliasTarget) {
            const aliasDef = resolveRuntimeFixtureDefinition([aliasTarget]);
            if (aliasDef) {
                // Check if rewrite is actually needed (idempotency)
                const needsRewrite = fixture.profileId !== aliasDef.id ||
                    !fixture.definitionPath ||
                    !Array.isArray(fixture.channels) ||
                    fixture.channels.length === 0 ||
                    fixture.channelCount !== aliasDef.channels.length;
                if (!needsRewrite) {
                    report.details.push({
                        fixtureId: fixture.id,
                        fixtureName: fixture.name ?? fixture.id,
                        status: 'skipped',
                    });
                    continue;
                }
                const oldProfileId = profileId;
                const oldDefinitionPath = fixture.definitionPath;
                fixture.profileId = aliasDef.id;
                fixture.definitionPath = aliasDef.filePath ?? aliasDef.id;
                fixture.channels = aliasDef.channels;
                fixture.channelCount = aliasDef.channels.length;
                console.log(`[LegacyFixtureMigrator] ✓ ALIAS MIGRATED: fixture=${fixture.id} name="${fixture.name}" ` +
                    `"${oldProfileId}" → "${aliasDef.id}" (${aliasDef.channels.length}ch) [alias dict]`);
                report.details.push({
                    fixtureId: fixture.id,
                    fixtureName: fixture.name ?? fixture.id,
                    status: 'migrated',
                    oldProfileId,
                    oldDefinitionPath,
                    newProfileId: aliasDef.id,
                });
                report.migrated++;
                continue;
            }
            // If alias target not found in library, fall through to normal logic
            console.warn(`[LegacyFixtureMigrator] ⚠ ALIAS MISS: profileId="${profileId}" mapped to "${aliasTarget}" ` +
                `but target not in runtime library — falling through to normal matching.`);
        }
        // Step 1: SKIP if fixture already resolves AND has inline channels
        // WAVE 7677: Changed from OR to AND — a fixture that resolves but
        // has empty channels still needs repair (rewrite from library).
        const existingDef = resolveRuntimeFixtureDefinition([
            profileId,
            fixture.definitionPath,
            fixture.model,
            fixture.name,
        ]);
        const hasInlineChannels = Array.isArray(fixture.channels) && fixture.channels.length > 0;
        if (existingDef && hasInlineChannels) {
            report.details.push({
                fixtureId: fixture.id,
                fixtureName: fixture.name ?? fixture.id,
                status: 'skipped',
            });
            continue;
        }
        // WAVE 7677: If the fixture resolves but has NO channels, repair it
        // by copying channels + definitionPath from the resolved definition.
        if (existingDef && !hasInlineChannels) {
            const oldProfileId = profileId;
            const oldDefinitionPath = fixture.definitionPath;
            fixture.profileId = existingDef.id;
            fixture.definitionPath = existingDef.filePath ?? existingDef.id;
            fixture.channels = existingDef.channels;
            fixture.channelCount = existingDef.channels.length;
            console.log(`[LegacyFixtureMigrator] ✓ REPAIR: fixture=${fixture.id} name="${fixture.name}" ` +
                `resolved but had empty channels — copied ${existingDef.channels.length}ch from "${existingDef.id}"`);
            report.details.push({
                fixtureId: fixture.id,
                fixtureName: fixture.name ?? fixture.id,
                status: 'migrated',
                oldProfileId,
                oldDefinitionPath,
                newProfileId: existingDef.id,
            });
            report.migrated++;
            continue;
        }
        // Step 2: DETECT legacy shape
        if (!hasLegacyShape(fixture)) {
            // Not legacy and doesn't resolve — unmatched but not our concern
            report.details.push({
                fixtureId: fixture.id,
                fixtureName: fixture.name ?? fixture.id,
                status: 'unmatched',
                oldProfileId: profileId,
                oldDefinitionPath: fixture.definitionPath,
            });
            report.unmatched++;
            continue;
        }
        // Step 3: MATCH against live library
        const match = matchLegacyFixture(fixture);
        if (!match) {
            console.warn(`[LegacyFixtureMigrator] ✗ UNMATCHED: fixture=${fixture.id} name="${fixture.name}" ` +
                `model="${fixture.model}" oldPath="${fixture.definitionPath}" — no library candidate found.`);
            report.details.push({
                fixtureId: fixture.id,
                fixtureName: fixture.name ?? fixture.id,
                status: 'unmatched',
                oldProfileId: profileId,
                oldDefinitionPath: fixture.definitionPath,
            });
            report.unmatched++;
            continue;
        }
        if (match.candidates.length > 1) {
            // Step 5: AMBIGUOUS — do NOT guess
            console.warn(`[LegacyFixtureMigrator] ⚠ AMBIGUOUS: fixture=${fixture.id} name="${fixture.name}" ` +
                `matched ${match.candidates.length} candidates: [${match.candidates.join(', ')}] — leaving untouched.`);
            report.details.push({
                fixtureId: fixture.id,
                fixtureName: fixture.name ?? fixture.id,
                status: 'ambiguous',
                oldProfileId: profileId,
                oldDefinitionPath: fixture.definitionPath,
                candidates: match.candidates,
            });
            report.ambiguous++;
            continue;
        }
        // Step 4: REWRITE on unique match
        const def = match.definition;
        const oldProfileId = profileId;
        const oldDefinitionPath = fixture.definitionPath;
        fixture.profileId = def.id;
        fixture.definitionPath = def.filePath ?? def.id;
        fixture.channels = def.channels;
        fixture.channelCount = def.channels.length;
        console.log(`[LegacyFixtureMigrator] ✓ MIGRATED: fixture=${fixture.id} name="${fixture.name}" ` +
            `"${oldProfileId ?? oldDefinitionPath}" → "${def.id}" (${def.channels.length}ch)`);
        report.details.push({
            fixtureId: fixture.id,
            fixtureName: fixture.name ?? fixture.id,
            status: 'migrated',
            oldProfileId,
            oldDefinitionPath,
            newProfileId: def.id,
        });
        report.migrated++;
    }
    return report;
}
