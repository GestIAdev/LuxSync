/**
 * 🎚️ WAVE 8305 — Playlist manual (Blueprint Ola C · §6).
 *
 * Certifica:
 *  - CRUD base: insertItem (append/index + shift de índices), removeItem
 *    (re-map active/cue), reorderItems.
 *  - Navegación: playNext/playPrev saltan `flags.skip`, hacen wrap y
 *    refirean una lista de un solo ítem; playAt es manual override.
 *  - Disparo: `theta.playAtom` recibe el atomId + trim del átomo.
 *  - Inmortalidad: un ítem `genome:{coreId,seed}` cuyo `core#seed` no está
 *    en el registry lo respawnea vía spawnGenomeVariant antes de disparar.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getTheiaRegistry,
  __resetTheiaRegistryForTests,
} from '../core/theia/TheiaRegistry'
import { getThetaOrchestrator } from '../theia/ThetaOrchestrator'
import { resetGenomePool } from '../theia/genome/GenomePool'
import { useTheiaPackStore } from './useTheiaPackStore'
import {
  parseTheiaAtomPayload,
  THEIA_ATOM_MIME,
  useTheiaPlaylistStore,
} from './useTheiaPlaylistStore'
import type { ITheiaAtom } from '../types/theiaTypes'

const CORE_GLSL = `// @euclid name    Playlist Core
// @euclid gene    G_FOLD struct int   5   12   8    a:+0.4 c:+0.3
// @euclid gene    G_ZOOM expr   float 0.05 0.5  0.25 a:+0.6
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`

function makeAtom(id: string, kind: 'shader' | 'video' = 'shader'): ITheiaAtom {
  return {
    id,
    packId: 'pack_test',
    filePath: `euclid://${id}`,
    aggression: 0.4,
    chaos: 0.6,
    organicity: 0.5,
    energyZone: { min: 'gentle', max: 'peak' },
    validSections: ['verse'],
    trim: { startMs: 1200, endMs: 8000 },
    compatibleVibes: ['techno'],
    source: kind === 'shader' ? { kind: 'shader', glsl: CORE_GLSL } : undefined,
  }
}

const draft = (id: string, kind: 'shader' | 'video' = 'shader') => ({
  atomId: id,
  label: id,
  kind,
})

function resetAll() {
  __resetTheiaRegistryForTests()
  resetGenomePool()
  useTheiaPackStore.setState({
    packs: new Map(),
    atomGeneValues: new Map(),
    atomParamValues: new Map(),
    armedAtomId: null,
    activeAtomId: null,
  })
  useTheiaPlaylistStore.setState({ items: [], activeIndex: -1, cueIndex: -1 })
}

describe('WAVE 8305 — useTheiaPlaylistStore', () => {
  beforeEach(() => {
    resetAll()
    const registry = getTheiaRegistry()
    for (const id of ['atom_a', 'atom_b', 'atom_c', 'atom_d']) {
      registry.register(makeAtom(id))
    }
    // El orquestador es singleton: el spy acumula entre tests → clear.
    vi.restoreAllMocks()
    vi.spyOn(getThetaOrchestrator(), 'playAtom').mockResolvedValue(undefined)
  })

  it('insertItem añade, genera uid y siembra cueIndex en lista vacía', () => {
    const s = useTheiaPlaylistStore.getState()
    const a = s.insertItem(draft('atom_a'))
    const b = s.insertItem(draft('atom_b'))
    const st = useTheiaPlaylistStore.getState()
    expect(st.items.map((i) => i.atomId)).toEqual(['atom_a', 'atom_b'])
    expect(a.id).not.toBe(b.id)
    expect(st.cueIndex).toBe(0)
    expect(st.activeIndex).toBe(-1)
  })

  it('insertItem en medio desplaza active/cue; removeItem los re-mapea', () => {
    const s = useTheiaPlaylistStore.getState()
    s.insertItem(draft('atom_a'))
    s.insertItem(draft('atom_b'))
    s.insertItem(draft('atom_c'))
    s.setActiveIndex(1)
    s.setCueIndex(2)
    s.insertItem(draft('atom_d'), 0)
    let st = useTheiaPlaylistStore.getState()
    expect(st.items.map((i) => i.atomId)).toEqual([
      'atom_d', 'atom_a', 'atom_b', 'atom_c',
    ])
    expect(st.activeIndex).toBe(2)
    expect(st.cueIndex).toBe(3)

    // Borrar el activo → activeIndex -1; el cue re-mapea al mismo ítem.
    st.removeItem(st.items[2].id)
    st = useTheiaPlaylistStore.getState()
    expect(st.activeIndex).toBe(-1)
    expect(st.items[st.cueIndex].atomId).toBe('atom_c')
  })

  it('reorderItems mueve el ítem y los índices siguen al mismo objeto', () => {
    const s = useTheiaPlaylistStore.getState()
    s.insertItem(draft('atom_a'))
    s.insertItem(draft('atom_b'))
    s.insertItem(draft('atom_c'))
    s.setActiveIndex(0)
    s.setCueIndex(2)
    s.reorderItems(0, 2)
    const st = useTheiaPlaylistStore.getState()
    expect(st.items.map((i) => i.atomId)).toEqual([
      'atom_b', 'atom_c', 'atom_a',
    ])
    expect(st.items[st.activeIndex].atomId).toBe('atom_a')
    expect(st.items[st.cueIndex].atomId).toBe('atom_c')
  })

  it('playNext dispara el cue y avanza índices (wrap incluido)', async () => {
    const theta = getThetaOrchestrator()
    const s = useTheiaPlaylistStore.getState()
    s.insertItem(draft('atom_a'))
    s.insertItem(draft('atom_b'))
    s.insertItem(draft('atom_c'))

    expect(s.playNext()).toBe(true)
    expect(theta.playAtom).toHaveBeenCalledWith(
      expect.objectContaining({ atomId: 'atom_a', startMs: 1200 }),
    )
    let st = useTheiaPlaylistStore.getState()
    expect(st.activeIndex).toBe(0)
    expect(st.cueIndex).toBe(1)

    st.playNext() // → atom_b
    st.playNext() // → atom_c
    st = useTheiaPlaylistStore.getState()
    expect(st.activeIndex).toBe(2)
    st.playNext() // wrap → atom_a
    st = useTheiaPlaylistStore.getState()
    expect(st.items[st.activeIndex].atomId).toBe('atom_a')
  })

  it('playNext/playPrev saltan ítems con flags.skip', () => {
    const theta = getThetaOrchestrator()
    const s = useTheiaPlaylistStore.getState()
    const a = s.insertItem(draft('atom_a'))
    const b = s.insertItem(draft('atom_b'))
    s.insertItem(draft('atom_c'))
    s.toggleSkip(b.id)

    s.playNext() // → a
    s.playNext() // salta b → c
    expect(theta.playAtom).toHaveBeenLastCalledWith(
      expect.objectContaining({ atomId: 'atom_c' }),
    )
    useTheiaPlaylistStore.getState().playPrev() // salta b → a
    expect(theta.playAtom).toHaveBeenLastCalledWith(
      expect.objectContaining({ atomId: 'atom_a' }),
    )
    expect(a.id).toBeTruthy()
  })

  it('lista de un solo ítem: NEXT lo redispara; playAt ignora skip', () => {
    const theta = getThetaOrchestrator()
    const s = useTheiaPlaylistStore.getState()
    const a = s.insertItem(draft('atom_a'))
    s.toggleSkip(a.id)

    // Todo está skip → NEXT no dispara nada.
    expect(s.playNext()).toBe(false)
    expect(theta.playAtom).not.toHaveBeenCalled()

    // Manual override: playAt sí dispara el ítem skippeado.
    expect(useTheiaPlaylistStore.getState().playAt(0)).toBe(true)
    expect(theta.playAtom).toHaveBeenCalledWith(
      expect.objectContaining({ atomId: 'atom_a' }),
    )

    // Quitamos skip → NEXT sobre lista única redispara el mismo.
    useTheiaPlaylistStore.getState().toggleSkip(a.id)
    expect(useTheiaPlaylistStore.getState().playNext()).toBe(true)
  })

  it('playNext en playlist vacía devuelve false sin disparar', () => {
    const theta = getThetaOrchestrator()
    expect(useTheiaPlaylistStore.getState().playNext()).toBe(false)
    expect(theta.playAtom).not.toHaveBeenCalled()
  })

  it('ítem genome inmortal: respawnea el core#seed ausente antes de disparar', () => {
    const theta = getThetaOrchestrator()
    const registry = getTheiaRegistry()
    registry.register(makeAtom('core_pl')) // solo el core, sin variantes

    const s = useTheiaPlaylistStore.getState()
    s.insertItem({
      genome: { coreId: 'core_pl', seed: 42 },
      label: 'core_pl#42',
      kind: 'shader',
    })

    expect(registry.getAtom('core_pl#42')).toBeUndefined()
    expect(s.playNext()).toBe(true)
    // El trigger respawneó la variante determinista y disparó ese atomId.
    expect(registry.getAtom('core_pl#42')).toBeDefined()
    expect(theta.playAtom).toHaveBeenCalledWith(
      expect.objectContaining({ atomId: 'core_pl#42' }),
    )
  })

  it('ítem file puro dispara con urlResolver propio', () => {
    const theta = getThetaOrchestrator()
    const s = useTheiaPlaylistStore.getState()
    s.insertItem({
      filePath: 'file:///tmp/clip.mp4',
      label: 'clip.mp4',
      kind: 'video',
    })
    expect(s.playNext()).toBe(true)
    const call = vi.mocked(theta.playAtom).mock.calls[0][0]
    expect(call.atomId).toContain('playlist-item:')
    expect(call.urlResolver?.('x')).toBe('file:///tmp/clip.mp4')
  })

  it('parseTheiaAtomPayload valida el MIME del deck', () => {
    const mk = (data: Record<string, string>) =>
      ({ getData: (t: string) => data[t] ?? '' }) as unknown as DataTransfer

    const good = mk({
      [THEIA_ATOM_MIME]: JSON.stringify({
        atomId: 'core#42',
        label: 'core#42',
        kind: 'shader',
        genome: { coreId: 'core', seed: 42 },
      }),
    })
    expect(parseTheiaAtomPayload(good)).toEqual({
      atomId: 'core#42',
      label: 'core#42',
      kind: 'shader',
      genome: { coreId: 'core', seed: 42 },
    })
    expect(parseTheiaAtomPayload(mk({}))).toBeNull()
    expect(
      parseTheiaAtomPayload(mk({ [THEIA_ATOM_MIME]: 'not json' })),
    ).toBeNull()
    expect(
      parseTheiaAtomPayload(mk({ [THEIA_ATOM_MIME]: '{"kind":"shader"}' })),
    ).toBeNull()
  })
})
