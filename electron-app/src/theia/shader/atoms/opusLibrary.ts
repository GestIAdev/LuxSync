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
 *   + 9 átomos del kit SHADER_ATOM_BASE (neon_conduit … turing_cannibals).
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
import NEON_CONDUIT_GLSL from '../../../../assets/shaders/neon_conduit.glsl?raw'
import SACRED_BOUNCER_GLSL from '../../../../assets/shaders/sacred_bouncer.glsl?raw'
import LIQUID_NEBULA_GLSL from '../../../../assets/shaders/liquid_nebula.glsl?raw'
import VOXEL_MONOLITH_GLSL from '../../../../assets/shaders/voxel_monolith.glsl?raw'
import MORPHING_CORE_GLSL from '../../../../assets/shaders/morphing_core.glsl?raw'
import QUANTUM_SWARM_GLSL from '../../../../assets/shaders/quantum_swarm.glsl?raw'
import FERRO_HEART_GLSL from '../../../../assets/shaders/ferro_heart.glsl?raw'
import EVENT_HORIZON_GLSL from '../../../../assets/shaders/event_horizon.glsl?raw'
import TURING_CANNIBALS_GLSL from '../../../../assets/shaders/turing_cannibals.glsl?raw'

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
  // 🎨 Fases 1–3 del kit SHADER_ATOM_BASE — el id es el nombre del fichero.
  // Vibes canónicas de VibeCanon → el matcher de Selene puede elegirlos.
  { id: 'neon_conduit', fileName: 'neon_conduit.glsl', glsl: NEON_CONDUIT_GLSL,
    vibes: ['techno-club', 'rave'] },
  { id: 'sacred_bouncer', fileName: 'sacred_bouncer.glsl', glsl: SACRED_BOUNCER_GLSL,
    vibes: ['fiesta-latina', 'pop-rock'] },
  { id: 'liquid_nebula', fileName: 'liquid_nebula.glsl', glsl: LIQUID_NEBULA_GLSL,
    vibes: ['chill-lounge'] },
  { id: 'voxel_monolith', fileName: 'voxel_monolith.glsl', glsl: VOXEL_MONOLITH_GLSL,
    vibes: ['techno-club', 'rave'] },
  { id: 'morphing_core', fileName: 'morphing_core.glsl', glsl: MORPHING_CORE_GLSL,
    vibes: ['techno-club', 'chill-lounge', 'rave'] },
  { id: 'quantum_swarm', fileName: 'quantum_swarm.glsl', glsl: QUANTUM_SWARM_GLSL,
    vibes: ['techno-club', 'rave'] },
  { id: 'ferro_heart', fileName: 'ferro_heart.glsl', glsl: FERRO_HEART_GLSL,
    vibes: ['rave', 'techno-club', 'fiesta-latina'] },
  { id: 'event_horizon', fileName: 'event_horizon.glsl', glsl: EVENT_HORIZON_GLSL,
    vibes: ['chill-lounge', 'techno-club'] },
  { id: 'turing_cannibals', fileName: 'turing_cannibals.glsl', glsl: TURING_CANNIBALS_GLSL,
    vibes: ['fiesta-latina', 'chill-lounge'] },
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
