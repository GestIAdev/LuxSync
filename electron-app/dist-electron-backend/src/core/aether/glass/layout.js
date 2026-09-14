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
export const MAX_UNIVERSES = 50;
export const CHANNELS_PER_UNI = 512;
export const DMX_DATA_BYTES = MAX_UNIVERSES * CHANNELS_PER_UNI; // 25 600
export const DMX_HEADER_I32 = 16; // slots Int32
export const DMX_HEADER_BYTES = DMX_HEADER_I32 * 4; // 64 bytes
export const DMX_SAB_BYTES = DMX_HEADER_BYTES + DMX_DATA_BYTES; // 25 664 bytes
// ═══════════════════════════════════════════════════════════════════════════
// GLASS VIEW — Float32Array layout constants
// Used by TickEngine._glassView and BufferPoolManager for the UI mirror.
// The fixture SAB (SharedArrayBuffer) infrastructure was removed (F3/F4):
// the UI mirror uses transferable ArrayBuffer ping-pong, not SAB.
// ═══════════════════════════════════════════════════════════════════════════
export const MAX_FIXTURES = 2048;
// ─────────────────────────────────────────────────────────────────────────────
// 🩸 WAVE 7761 (Multi-RGB): Glass layout expandido para sub-zonas desagregadas.
//
// FLOATS_PER_FIX 16 → 32 (Opción C del Plan Corregido de Opus).
// No por AVX2 — por payload: 16 campos existentes + 9 nuevos (3 celdas × RGB)
// = 25, que no cabe en 24. 32 deja holgura para 4 celdas × 3 canales (offsets
// 16..27) + 4 floats de reserva (28..31). Cuando quieras Floor o MoverL/MoverR
// desagregados, es un MAX_CELLS_PER_FIX++, no otra cirugia de punteros.
//
// GLASS_HEADER_FLOATS 10 → 16 (pad a 64 bytes / cacheline). El header real
// sigue usando 10 floats (bass, mid, high, energy, isBeat, ...); los 6 extra
// son reserva alineada. TickEngine serializa con esta constante a partir de
// Fase 2; mientras tanto el header efectivo sigue siendo 10 (hardcodeado).
//
// FIX_DATA_FLOATS ahora INCLUYE el header. Antes era solo MAX_FIXTURES *
// FLOATS_PER_FIX (32768), lo que dejaba capacidad real para 2047 fixtures
// (off-by-one implicito). Ahora: 16 + 2048 * 32 = 65552 floats (256 KB).
// ─────────────────────────────────────────────────────────────────────────────
export const GLASS_HEADER_FLOATS = 16; // 64 bytes (cacheline)
export const FLOATS_PER_FIX = 32; // 128 bytes/fixture
export const MAX_CELLS_PER_FIX = 4; // ambient, air, strobe, +1 reserva
export const CELL_COLOR_BASE = 16; // celda c → CELL_COLOR_BASE + c*3
export const FIX_DATA_FLOATS = GLASS_HEADER_FLOATS + MAX_FIXTURES * FLOATS_PER_FIX; // 65 552 floats
export const MAX_GLASS_FIXTURES = MAX_FIXTURES; // ya no hay off-by-one
