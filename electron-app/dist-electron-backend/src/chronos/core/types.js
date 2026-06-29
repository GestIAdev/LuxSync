/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ CHRONOS TYPES — THE RUNTIME DNA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 7100 FASE 2: V2 project types demolished. Only shared runtime types remain.
 *
 * This file defines SHARED types used by the Chronos editor UI, ChronosEngine,
 * and automation system. The V3 project schema lives in LuxFileV3.ts.
 *
 * Shared types: Primitives, PlaybackConfig, Automation, Analysis, Context.
 * V3 types: See LuxFileV3.ts (LuxFileV3, ChronosProjectV3, LuxTrackV3, etc.)
 *
 * This is NOT the serialized .lux format. For the file format, see
 * LuxFileV3 in ./LuxFileV3.ts.
 * For the architectural map and barrel imports, see ./ProjectTypes.ts.
 *
 * @module chronos/core/types
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🏭 FACTORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Genera un ID único para Chronos
 */
export function generateChronosId() {
    // Prefer stable, cryptographic UUID when available (no Math.random())
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `chr_${crypto.randomUUID()}`;
        }
    }
    catch (e) {
        // Fallthrough to deterministic fallback
    }
    // Fallback deterministic ID (time + monotonic counter) for older environments
    // This avoids Math.random() and remains unique within a single process.
    const now = Date.now().toString(36);
    generateChronosIdCounter = (generateChronosIdCounter + 1) % 0xFFFFFF;
    return `chr_${now}_${generateChronosIdCounter.toString(36)}`;
}
// Monotonic counter used by fallback path
let generateChronosIdCounter = 0;
// ═══════════════════════════════════════════════════════════════════════════
// � WAVE 7100 FASE 2: V2 PROJECT TYPES DEMOLISHED
// ═══════════════════════════════════════════════════════════════════════════
//
// ChronosProjectV2, TimelineTrackV2, TrackUpdateV2, ChronosProjectMeta,
// createDefaultProjectV2, createTrackV2, generateTrackV2Label — ALL REMOVED.
//
// V3 replacements live in LuxFileV3.ts:
//   ChronosProjectV3  ←  ChronosProjectV2
//   LuxTrackV3        ←  TimelineTrackV2
//   LuxMetaV3         ←  ChronosProjectMeta
//   LuxTrackUpdateV3  ←  TrackUpdateV2
//   createEmptyChronosProjectV3  ←  createDefaultProjectV2
//   createTrackV3               ←  createTrackV2
//   generateTrackLabelV3        ←  generateTrackV2Label
// ═══════════════════════════════════════════════════════════════════════════
