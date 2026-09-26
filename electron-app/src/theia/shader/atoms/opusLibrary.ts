/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔮 WAVE 8242 — HYBRID DECK · Fase U4: THE OPUS LIBRARY (pack por defecto)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Los dos shaders de referencia de Opus (§6.1/§6.2 del
 * THEIA_INFINITE_GENOME_BLUEPRINT) viven FÍSICAMENTE en
 * `electron-app/assets/shaders/` como `.glsl` y llegan al renderer por
 * `?raw` (Vite los inyecta como string en build — cero fetch, cero IPC,
 * cero dependencia del fs en tiempo de ejecución).
 *
 *   aether_serpent.glsl   — Éter: integral emisión-absorción, serpiente
 *                           Lissajous, domain warping analítico (§6.1)
 *   tribu_mental.glsl     — Enjambre conforme: mandala log-polar Droste +
 *                           24 cargas que cantan el cromagrama (§6.2)
 *
 * Cada fichero es su propio manifiesto (§4.2): el header `@euclid` se
 * parsea con `parseEuclidMeta` y de ahí salen genoma, zona y parámetros —
 * el mismo ADN que un `.theia` de vídeo, Selene no distingue el medio.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ITheiaAtom } from '../../../types/theiaTypes'
import { parseEuclidMeta } from '../ShaderAssembler'

import AETHER_SERPENT_GLSL from '../../../../assets/shaders/aether_serpent.glsl?raw'
import TRIBU_MENTAL_GLSL from '../../../../assets/shaders/tribu_mental.glsl?raw'

export const OPUS_PACK_ID = 'opus-infinite-genome'
export const OPUS_PACK_LABEL = 'Opus Infinite Genome'

export const AETHER_SERPENT_ATOM_ID = 'aether_serpent'
export const TRIBU_MENTAL_ATOM_ID = 'tribu_mental'

interface OpusAtomSpec {
  readonly id: string
  readonly fileName: string
  readonly glsl: string
  readonly vibes: readonly string[]
}

const OPUS_SPECS: readonly OpusAtomSpec[] = [
  {
    id: AETHER_SERPENT_ATOM_ID,
    fileName: 'aether_serpent.glsl',
    glsl: AETHER_SERPENT_GLSL,
    vibes: ['psytrance', 'ambient', 'techno'],
  },
  {
    id: TRIBU_MENTAL_ATOM_ID,
    fileName: 'tribu_mental.glsl',
    glsl: TRIBU_MENTAL_GLSL,
    vibes: ['psytrance', 'mental-tribe', 'techno-industrial'],
  },
]

/**
 * Construye un `ITheiaAtom` generativo desde su fuente `.glsl` — genoma,
 * zona y params derivados del propio header `@euclid` (`parseEuclidMeta`
 * es laxo: nunca lanza, lo ilegible queda en defaults).
 */
function buildOpusAtom(spec: OpusAtomSpec): ITheiaAtom {
  const meta = parseEuclidMeta(spec.glsl)
  const min = (meta.zone?.from ?? 'gentle') as ITheiaAtom['energyZone']['min']
  const max = (meta.zone?.to ?? 'peak') as ITheiaAtom['energyZone']['max']

  return {
    id: spec.id,
    packId: OPUS_PACK_ID,
    filePath: `assets/shaders/${spec.fileName}`,
    aggression: meta.genome.aggression ?? 0.5,
    chaos: meta.genome.chaos ?? 0.5,
    organicity: meta.genome.organicity ?? 0.5,
    energyZone: { min, max },
    validSections: ['verse', 'buildup', 'drop', 'breakdown', 'outro'],
    trim: { startMs: 0, endMs: 8000 }, // bucle infinito — trim nominal
    compatibleVibes: [...spec.vibes],
    source: { kind: 'shader', glsl: spec.glsl },
  }
}

/**
 * Instancia los átomos de la Opus Library.
 */
export function buildOpusGenomeAtoms(): readonly ITheiaAtom[] {
  return OPUS_SPECS.map(buildOpusAtom)
}
