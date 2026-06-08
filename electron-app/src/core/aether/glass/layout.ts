// ─────────────────────────────────────────────────────────────────────────────
// WAVE 6005 — GLASS MEMORY LAYOUT
// Constantes, offsets y enums matemáticos para los SharedArrayBuffers del
// "Puente de Cristal". Isomorfo: válido en Node, renderer y Web Workers.
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// DMX_UNIVERSE_SAB
// Layout: [Header Int32 × 16][Data Uint8 × 25600]
// Total : 64 + 25 600 = 25 664 bytes (~25 KB)
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_UNIVERSES    = 50
export const CHANNELS_PER_UNI = 512
export const DMX_DATA_BYTES   = MAX_UNIVERSES * CHANNELS_PER_UNI    // 25 600

export const DMX_HEADER_I32   = 16                                  // slots Int32
export const DMX_HEADER_BYTES = DMX_HEADER_I32 * 4                  // 64 bytes
export const DMX_SAB_BYTES    = DMX_HEADER_BYTES + DMX_DATA_BYTES   // 25 664 bytes

/**
 * Offsets del header del DMX_UNIVERSE_SAB (índices sobre Int32Array).
 *
 * SEQLOCK: par = frame estable; impar = escritura en curso.
 * UNIVERSE_MASK + UNIVERSE_MASK_HI: bitmask de 64 bits indicando qué
 *   universos se actualizaron en este frame (universo N → bit N).
 */
export const enum DmxHdr {
  SEQLOCK        = 0,
  FRAME_ID       = 1,
  UNIVERSE_MASK  = 2,
  UNIVERSE_MASK_HI = 3,
  ACTIVE_UNIS    = 4,
  TIMESTAMP_LO   = 5,
  TIMESTAMP_HI   = 6,
  // 7..15 reservados para expansión futura
}

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE_STATE_SAB
// Layout: [Header Int32 × 32][Data Float32 × (2048 × 16)]
// Total : 128 + 131 072 = 131 200 bytes (~128 KB)
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_FIXTURES     = 2048
export const FLOATS_PER_FIX   = 16                                   // 64 bytes/fixture
export const FIX_DATA_FLOATS  = MAX_FIXTURES * FLOATS_PER_FIX        // 32 768 floats

export const FIX_HEADER_I32   = 32                                   // slots Int32
export const FIX_HEADER_BYTES = FIX_HEADER_I32 * 4                   // 128 bytes
export const FIX_DATA_BYTES   = FIX_DATA_FLOATS * 4                  // 131 072 bytes
export const FIX_SAB_BYTES    = FIX_HEADER_BYTES + FIX_DATA_BYTES    // 131 200 bytes

/**
 * Offsets del header del FIXTURE_STATE_SAB (índices sobre Int32Array).
 *
 * FIXTURE_COUNT: número de fixtures activos escritos en este frame.
 * SEQLOCK sigue el mismo protocolo par/impar que DmxHdr.
 */
export const enum FixHdr {
  SEQLOCK        = 0,
  FRAME_ID       = 1,
  FIXTURE_COUNT  = 2,
  TIMESTAMP_LO   = 3,
  TIMESTAMP_HI   = 4,
  // 5..31 reservados
}

/**
 * Offsets de cada campo dentro del bloque de un fixture
 * (índices sobre Float32Array, relativo al inicio del fixture).
 *
 * Tamaño total: FLOATS_PER_FIX = 16 floats = 64 bytes por fixture.
 */
export const enum FixField {
  R        = 0,   // red   0-255
  G        = 1,   // green 0-255
  B        = 2,   // blue  0-255
  W        = 3,   // white 0-255
  A        = 4,   // amber 0-255
  DIMMER   = 5,   // 0-1 normalizado
  PAN      = 6,   // DMX 0-255
  TILT     = 7,   // DMX 0-255
  PHYS_PAN = 8,   // 0-1 normalizado (para visualizer 3D)
  PHYS_TILT= 9,   // 0-1 normalizado
  ZOOM     = 10,  // DMX 0-255
  FOCUS    = 11,  // DMX 0-255
  PAN_VEL  = 12,  // firmado, rad/s estimado
  TILT_VEL = 13,  // firmado, rad/s estimado
  STROBE   = 14,  // DMX 0-255
  FLAGS    = 15,  // bit0=active, bit1=blackout, bit2..15 reservados
}
