/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ LUX FILE V3 — THE INCORRUPTIBLE CORE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The canonical `.lux` V3 schema. Born clean, V3-only, no legacy V2 conversion.
 *
 * PREMISE:
 *   `.lux` nace LIMPIA en V3. No existen shows V2 previos. No hay conversores.
 *   Este schema es la CONSTITUCIÓN: se define primero, los consumidores se
 *   adaptan después. Nunca al revés.
 *
 * MARRIAGE WITH .lfx V3:
 *   FXClips embed a full `HephAutomationClipV3` (schemaVersion '3.0').
 *   The embedded clip is the runtime truth — `hephFilePath` is only a reference
 *   for re-importing from the UI. A `.lux` is fully self-contained.
 *
 * TWO REPRESENTATIONS:
 *   - LuxFileV3        → serialized to disk (immutable, portable)
 *   - ChronosProjectV3 → in-memory runtime (LuxFileV3 + ephemeral edit state)
 *
 * BPM STRATEGY (FFT detect + manual override):
 *   - analysis.detectedBpm → base BPM detected by the GodEar FFT worker.
 *   - runtime uses the live rBPM from the Worker; falls back to detectedBpm.
 *   - manualBpmOverride (runtime only) wins when present.
 *
 * @module chronos/core/LuxFileV3
 * @version V3.0
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/** Discriminator literal for `.lux` V3 files. Exact match required. */
export const LUX_V3_SCHEMA = 'luxsync.lux/3.0';
/** File extension for LuxSync V3 projects. */
export const LUX_V3_EXTENSION = '.lux';
/** MIME type for LuxSync V3 projects. */
export const LUX_V3_MIME = 'application/x-luxsync-project';
/** Absolute last-resort BPM when nothing else is available. */
export const LUX_DEFAULT_BPM = 120;
