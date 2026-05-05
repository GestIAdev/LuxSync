/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎲 CHAOS HASH — Deterministic Fixture Scatter (WAVE 4561)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * AXIOMA 0: Math.random() PROHIBIDO.
 * Todo scatter es derivado de un hash determinista FNV-1a sobre el UUID del
 * fixture. Mismo grupo + mismo seed = misma distribución siempre.
 *
 * @module engine/movement/ChaosHash
 * @version WAVE 4561
 */

// ─────────────────────────────────────────────────────────────────────────────
// FNV-1a 32-bit
// ─────────────────────────────────────────────────────────────────────────────

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

/**
 * Hash FNV-1a 32-bit sobre una cadena UTF-8.
 * Devuelve un entero sin signo de 32 bits.
 */
function fnv1a(input: string): number {
  let hash = FNV_OFFSET_BASIS >>> 0
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // Multiplicación modular 32-bit sin signo
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }
  return hash
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hash determinista para un fixture en un eje dado.
 *
 * @param fixtureId - UUID canónico del fixture
 * @param seed      - Semilla de sesión (16-bit, e.g. Date.now() & 0xFFFF)
 * @param axis      - Discriminador de eje (0=X, 1=Z, 2=Y, etc.)
 * @returns Valor en rango [-1, 1]
 */
export function fixtureHash(fixtureId: string, seed: number, axis: number): number {
  const key = `${fixtureId}:${seed & 0xFFFF}:${axis}`
  const h = fnv1a(key)
  return (h / 0xFFFFFFFF) * 2 - 1
}

/**
 * Calcula offsets XZ de caos determinista para un array de fixtures.
 *
 * @param fixtureIds  - UUIDs de los fixtures en el grupo
 * @param seed        - Semilla de sesión
 * @param chaosAmount - [0, 1] — 0 = sin caos, 1 = caos máximo
 * @param amplitude   - Amplitud base en metros (e.g. fanAmplitude)
 * @returns Map de fixtureId → { dx, dz } en metros
 */
export function computeChaosOffsets(
  fixtureIds: string[],
  seed: number,
  chaosAmount: number,
  amplitude: number
): Map<string, { dx: number; dz: number }> {
  const result = new Map<string, { dx: number; dz: number }>()
  const chaos = Math.max(0, Math.min(1, chaosAmount))
  const maxOffset = amplitude * 0.5 * chaos

  for (const id of fixtureIds) {
    result.set(id, {
      dx: fixtureHash(id, seed, 0) * maxOffset,
      dz: fixtureHash(id, seed, 1) * maxOffset,
    })
  }
  return result
}

/**
 * Genera un seed de sesión nuevo a partir del timestamp actual.
 * Es determinista dentro de la sesión (mismo valor toda la sesión si no se resembra).
 * El operador hace click en RESEED para obtener otro.
 *
 * @returns Entero 16-bit (0..65535)
 */
export function generateSeed(): number {
  return Date.now() & 0xFFFF
}
