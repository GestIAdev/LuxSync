BLUEPRINT 2: THE PRO PHASE ENGINE
Interfaz PhaseConfigPro


typescript
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
Pipeline conceptual
El offset de cada fixture se calcula como una cadena de transformaciones de su índice, antes de convertirlo en tiempo. El orden importa muchísimo:



índice físico i
   │
   ▼  ① BLOCKING        →  i_block = floor(i / blocks)          (cuantización)
   │                       N_block = ceil(totalFixtures / blocks)
   ▼  ② SHUFFLE          →  i_eff   = lerp(i_block, hash(seed,i_block), shuffle)
   │
   ▼  ③ NORMALIZE        →  u = i_eff / (N_block - 1)            ∈ [0,1]
   │
   ▼  ④ SYMMETRY         →  s = symmetryFn(u)                    ∈ [0,1]
   │
   ▼  ⑤ WINGS (freq)     →  w = frac(s · wings)                  ∈ [0,1)
   │
   ▼  ⑥ DIRECTION        →  d = direction === -1 ? (1 - w) : w
   │
   ▼  ⑦ SPREAD → TIME    →  offsetMs = d · (spreadDeg / 360) · durationMs
Razonamiento matemático paso a paso
① Blocking primero (cuantización del índice).
La clave conceptual: blocking opera sobre el índice ANTES de normalizar. Si agrupamos de a blocks, todas las fixtures en el mismo bloque deben colapsar a un único índice de fase. Esto es división entera:



i_block = ⌊ i / blocks ⌋
N_block = ⌈ totalFixtures / blocks ⌉
Ejemplo: 8 fixtures, blocks=2 → índices físicos [0..7] mapean a i_block = [0,0,1,1,2,2,3,3]. Tenemos N_block = 4 posiciones de fase distintas. Las parejas (0,1), (2,3)... comparten fase → efecto de columnas/escalones. Hacer blocking después de normalizar produciría redondeos sucios; hacerlo sobre el entero es exacto.

② Shuffle (caos controlado por interpolación).
Queremos desorden reproducible y dosificable. Usamos un hash determinista del índice de bloque para generar una posición pseudo-aleatoria, y la mezclamos linealmente con la ordenada según el factor shuffle:



h(seed, k)  = fract( sin(k · 127.1 + seed · 311.7) · 43758.5453 )   ∈ [0,1)
i_random    = h(seed, i_block) · (N_block - 1)
i_eff       = (1 - shuffle) · i_block  +  shuffle · i_random
Con shuffle=0 → orden perfecto. Con shuffle=1 → posición totalmente caótica pero idéntica en cada render (mismo seed → mismo resultado), lo cual es esencial para que un efecto guardado se vea igual en cada reproducción.

③ Normalización.
Llevamos i_eff al dominio canónico [0,1]:



u = N_block > 1 ? i_eff / (N_block - 1) : 0
Trabajar en [0,1] desacopla la matemática de simetría del número real de fixtures — la misma fórmula sirve para 4 o 400 aparatos.

④ Simetría (remapeo del dominio).
Cada modo es una función pura f: [0,1] → [0,1]:



linear      : f(u) = u
mirror      : f(u) = 1 - |2u - 1|        (triángulo: 0 en extremos, 1 en centro... 
                                          o invertido según convención — aquí pico al centro)
center-out  : f(u) = |2u - 1|            (V: 0 en centro, 1 en extremos)
mirror y center-out son reflejos uno del otro respecto a la línea y = 0.5. Esto produce el clásico "fold" simétrico sin necesidad de lógica de mitades manual como en el motor legacy.

⑤ Wings (frecuencia espacial).
Aquí está la mejora más potente sobre el motor viejo. En lugar de subdividir duramente en sub-grupos, wings es un multiplicador de frecuencia sobre el dominio normalizado, y tomamos la parte fraccionaria:



w = frac(f(u) · wings)
wings=1 → un solo barrido. wings=3 → la onda de fase se repite 3 veces a lo largo del array (3 "olas" viajando). Como es frac(), las transiciones son perfectamente continuas y periódicas — equivalente espacial a la frecuencia de un LFO.

⑥ Dirección.
Reflejo trivial del resultado normalizado:



d = direction === -1 ? (1 - w) : w
⑦ Spread → tiempo.
Finalmente convertimos el offset normalizado de fase a milisegundos. spreadDeg se interpreta como fracción de ciclo, y un ciclo = durationMs:



offsetMs = d · (spreadDeg / 360) · durationMs
spreadDeg=360 → el último elemento arranca un durationMs completo después → modelo grandMA3 puro. spreadDeg=180 → medio ciclo de desfase. Permitir >360 habilita efectos multi-ciclo.

Implementación pura en TypeScript


typescript
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
  return d * (config.spreadDeg / 360) * durationMs
}
resolvePro — capa de arreglo + orden cache-friendly
Mantenemos la invariante del motor legacy (salida ordenada por phaseOffsetMs ASC) para que el cursor cache del CurveEvaluator siga siendo O(1) amortizado:



typescript
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
Por qué este orden de operaciones es el correcto
El error más común sería aplicar spread o symmetry antes del blocking. Si normalizas primero y luego intentas agrupar, las fixtures de un mismo bloque tendrían u ligeramente distintos y nunca compartirían fase exacta. Blocking debe ser la primera transformación porque es la única que opera sobre el índice entero discreto. Una vez cuantizado, todo lo demás (shuffle, normalize, symmetry, wings) opera sobre un dominio limpio donde "elementos del mismo bloque" son literalmente el mismo número.

wings como frac(s · wings) en lugar de subdivisión dura es lo que separa este motor del legacy: produce ondas espaciales continuas y periódicas (pensamiento de LFO/frecuencia), no bloques con discontinuidades en los bordes de cada wing.

Ambos blueprints son independientes: el store V3 puede adoptar PhaseConfigPro reemplazando el tipo de track.phaseConfig, y updatePhaseInTrack ya está tipado para mutarlo vía Immer recipe