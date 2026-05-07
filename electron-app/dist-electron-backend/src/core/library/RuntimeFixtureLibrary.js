const runtimeFixtureLibrary = new Map();
const runtimeFixtureLibraryNormalized = new Map();
function normalizeLookupKey(value) {
    return value.trim().toLowerCase();
}
function extractBasename(value) {
    const parts = value.split(/[\\/]/);
    return parts[parts.length - 1] || value;
}
function stripExtension(value) {
    const idx = value.lastIndexOf('.');
    return idx > 0 ? value.slice(0, idx) : value;
}
function buildCandidateKeys(value) {
    const normalized = normalizeLookupKey(value);
    const basename = normalizeLookupKey(extractBasename(value));
    const stem = normalizeLookupKey(stripExtension(basename));
    return [normalized, basename, stem];
}
function indexDefinition(definition) {
    runtimeFixtureLibrary.set(definition.id, definition);
    for (const key of buildCandidateKeys(definition.id)) {
        runtimeFixtureLibraryNormalized.set(key, definition);
    }
}
export function setRuntimeFixtureLibrary(definitions) {
    runtimeFixtureLibrary.clear();
    runtimeFixtureLibraryNormalized.clear();
    for (const definition of definitions) {
        if (!definition?.id)
            continue;
        indexDefinition(definition);
    }
}
export function upsertRuntimeFixtureDefinition(definition) {
    if (!definition?.id)
        return;
    indexDefinition(definition);
}
export function getRuntimeFixtureDefinition(profileId) {
    return resolveRuntimeFixtureDefinition([profileId]);
}
export function resolveRuntimeFixtureDefinition(candidates) {
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string')
            continue;
        const direct = runtimeFixtureLibrary.get(candidate);
        if (direct)
            return direct;
        for (const key of buildCandidateKeys(candidate)) {
            const normalized = runtimeFixtureLibraryNormalized.get(key);
            if (normalized)
                return normalized;
        }
    }
    return undefined;
}
