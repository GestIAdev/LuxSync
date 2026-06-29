/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEMOLISHED — V2 CODE REMOVED IN FASE 2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 7100 FASE 2: All V2 types and functions have been demolished.
 * The incorruptible V3 core lives in:
 *   - LuxFileV3.ts           (schema interfaces)
 *   - LuxFileV3.schema.ts    (type guards)
 *   - LuxFileV3.factories.ts (factories + bridges)
 *   - LuxFileV3.serializer.ts(serialize/deserialize + checksum)
 *
 * This file is kept as a thin re-export shim so that consumers importing
 * from './ChronosProject' get V3 types during the FASE 3 transition.
 * Consumers WILL have type errors — that's expected. Fix them in FASE 3.
 *
 * @module chronos/core/ChronosProject
 * @status DEMOLISHED — see LuxFileV3.ts
 */
export { LUX_V3_SCHEMA, LUX_V3_EXTENSION, LUX_V3_MIME, LUX_DEFAULT_BPM, } from './LuxFileV3';
export { createEmptyLuxFileV3 as createEmptyProject, createEmptyChronosProjectV3, toChronosProjectV3, toLuxFileV3, createTrackV3, createVibeClipV3, createFXClipV3, createMarkerV3, createVibeBaseV3, generateLuxId, generateTrackLabelV3, } from './LuxFileV3.factories';
export { serializeLuxV3 as serializeProject, deserializeLuxV3 as deserializeProject, computeLuxChecksum, verifyLuxChecksum, canonicalStringify, } from './LuxFileV3.serializer';
export { validateLuxFileV3 as validateProject, isLuxFileV3 } from './LuxFileV3.schema';
