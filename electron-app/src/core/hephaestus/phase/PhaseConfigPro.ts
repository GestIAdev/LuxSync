/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚙️ HEPHAESTUS PRO PHASE ENGINE — WAVE 7001
 * Motor matemático de distribución de fase de grado militar.
 * Módulo puro: cero dependencias de Zustand, React, o UI.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export type PhaseSymmetryMode = 'linear' | 'mirror' | 'center-out'

export interface PhaseConfigPro {
  /**
   * Spread total expresado en GRADOS de ciclo de animación.
   * 360º = el último elemento del grupo arranca exactamente un ciclo
   * completo (durationMs) después del primero.
   * Permitimos >360 (multi-ciclo) y rango canónico [0, 1440].
   */
  spreadDeg: number

  /** Modo de simetría aplicado dentro de cada wing. */
  symmetry: PhaseSymmetryMode

  /**
   * Wings = número de ciclos de la onda a lo largo del array.
   * wings=1 → un solo barrido. wings=2 → la onda recorre el grupo dos veces.
   * Es un MULTIPLICADOR de frecuencia espacial, no una subdivisión dura.
   */
  wings: number

  /**
   * Blocks = agrupar de a N fixtures consecutivas para que COMPARTAN
   * exactamente la misma fase. blocks=1 → cada fixture individual.
   * blocks=4 → grupos de 4 se mueven al unísono (efecto "escalera"/columnas).
   */
  blocks: number

  /**
   * Shuffle = caos controlado. 0 = orden determinista perfecto.
   * 1 = permutación pseudo-aleatoria total del orden de fase.
   * Mezcla el offset ordenado con un offset basado en hash(seed, index).
   */
  shuffle: number

  /** Semilla del shuffle. Fija → reproducible. */
  shuffleSeed: number

  /** Dirección de propagación. */
  direction: 1 | -1
}

export const DEFAULT_PHASE_CONFIG_PRO: Readonly<PhaseConfigPro> = {
  spreadDeg: 0,
  symmetry: 'linear',
  wings: 1,
  blocks: 1,
  shuffle: 0,
  shuffleSeed: 1,
  direction: 1,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PURAS
// ═══════════════════════════════════════════════════════════════════════════

/** Hash determinista [0,1) — sin estado, reproducible. */
function hash01(seed: number, k: number): number {
  const x = Math.sin(k * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)   // fract
}

function fract(x: number): number {
  return x - Math.floor(x)
}

/** Simetría: [0,1] → [0,1] */
function applySymmetry(u: number, mode: PhaseSymmetryMode): number {
  switch (mode) {
    case 'linear':     return u
    case 'mirror':     return 1 - Math.abs(2 * u - 1)  // pico al centro
    case 'center-out': return Math.abs(2 * u - 1)      // valle al centro
    default:           return u
  }
}

/**
 * Calcula el offset de fase (en ms) para UNA fixture.
 * Función pura: mismos inputs → mismo output. Sin side-effects.
 *
 * @param index        Índice físico de la fixture (0-based) en el grupo resuelto.
 * @param totalFixtures Tamaño del grupo.
 * @param config       Configuración Pro.
 * @param durationMs   Duración del clip (1 ciclo de animación).
 */
export function computeOffsetPro(
  index: number,
  totalFixtures: number,
  config: PhaseConfigPro,
  durationMs: number,
): number {
  if (totalFixtures <= 1 || config.spreadDeg === 0) return 0

  const spreadDeg = Math.max(0, Math.min(1440, config.spreadDeg))
  const blocks  = Math.max(1, Math.floor(config.blocks))
  const wings   = Math.max(1, config.wings)
  const shuffle = Math.max(0, Math.min(1, config.shuffle))

  // ① BLOCKING — división entera cuantiza el índice
  const iBlock = Math.floor(index / blocks)
  const nBlock = Math.ceil(totalFixtures / blocks)

  if (nBlock <= 1) return 0   // un solo bloque → todos en fase

  // ② SHUFFLE — mezcla ordenado ↔ caótico determinista
  const iRandom = hash01(config.shuffleSeed, iBlock) * (nBlock - 1)
  const iEff    = (1 - shuffle) * iBlock + shuffle * iRandom

  // ③ NORMALIZE → [0,1]
  const u = iEff / (nBlock - 1)

  // ④ SYMMETRY
  const s = applySymmetry(u, config.symmetry)

  // ⑤ WINGS — frecuencia espacial, parte fraccionaria continua
  const w = wings === 1 ? s : fract(s * wings)

  // ⑥ DIRECTION
  const d = config.direction === -1 ? 1 - w : w

  // ⑦ SPREAD → TIME (grados de ciclo → ms)
  return d * (spreadDeg / 360) * durationMs
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOLVEDOR DE ARREGLO
// ═══════════════════════════════════════════════════════════════════════════

export interface FixturePhase {
  fixtureId: string
  phaseOffsetMs: number
  normalizedIndex: number
}

export function resolvePro(
  fixtureIds: string[],
  config: PhaseConfigPro,
  durationMs: number,
): FixturePhase[] {
  const N = fixtureIds.length
  const out: FixturePhase[] = new Array(N)

  for (let i = 0; i < N; i++) {
    const offset = computeOffsetPro(i, N, config, durationMs)
    out[i] = {
      fixtureId: fixtureIds[i],
      phaseOffsetMs: offset,
      normalizedIndex: N > 1 ? i / (N - 1) : 0,
    }
  }

  // Orden ASC por offset → garantiza queries temporales monótonas
  out.sort((a, b) => a.phaseOffsetMs - b.phaseOffsetMs)
  return out
}
