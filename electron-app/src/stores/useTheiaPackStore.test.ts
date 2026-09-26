/**
 * 🎛️ WAVE 8239 · U1 — Universal Media Pool + Transport Store.
 *
 * Cobertura:
 *   - `useTheiaTransportStore`: sync/loop/reset (el orchestrator lo alimenta).
 *   - `ingestFiles`: vídeo → clip + átomo kind:'video' jugable (registry+pack),
 *     `.theia` → átomo serializado, `.glsl` → átomo kind:'shader' con meta
 *     `@euclid` parseada, dedup por id, filtro de extensiones.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { __resetTheiaRegistryForTests, getTheiaRegistry } from '../core/theia/TheiaRegistry'
import {
  buildGlslAtom,
  isSupportedMediaFile,
  MEDIA_POOL_ACCEPT,
  useTheiaPackStore,
} from './useTheiaPackStore'
import { useTheiaTransportStore } from './useTheiaTransportStore'

const GLSL_FIXTURE = `// @euclid name    "Acid Worm"
// @euclid genome  aggression=0.7 chaos=0.9 organicity=0.2
// @euclid zone    active..intense
void mainImage(out vec4 o, in vec2 f) { o = vec4(1.0); }
`

function makeFile(name: string, body = 'x', relPath = ''): File {
  const f = new File([body], name)
  if (relPath) {
    Object.defineProperty(f, 'webkitRelativePath', { value: relPath })
  }
  return f
}

beforeEach(() => {
  __resetTheiaRegistryForTests()
  useTheiaPackStore.setState({
    packs: new Map(),
    rawClips: [],
    livePackId: null,
    expandedPackId: null,
  })
  useTheiaTransportStore.getState().resetTransport()
  useTheiaTransportStore.getState().setLoop(true)
})

// ═══════════════════════════════════════════════════════════════════════════
// TRANSPORT STORE
// ═══════════════════════════════════════════════════════════════════════════

describe('🎛️ U1 — useTheiaTransportStore', () => {
  it('syncFromVideo aplica patches parciales', () => {
    useTheiaTransportStore.getState().syncFromVideo({
      isPlaying: true,
      currentTime: 12.5,
      duration: 60,
      hasVideo: true,
    })
    const s = useTheiaTransportStore.getState()
    expect(s.isPlaying).toBe(true)
    expect(s.currentTime).toBe(12.5)
    expect(s.duration).toBe(60)
    expect(s.hasVideo).toBe(true)
    expect(s.loop).toBe(true) // intacto — patch parcial
  })

  it('setLoop persiste la preferencia; resetTransport la conserva', () => {
    useTheiaTransportStore.getState().setLoop(false)
    expect(useTheiaTransportStore.getState().loop).toBe(false)
    useTheiaTransportStore.getState().syncFromVideo({ isPlaying: true, hasVideo: true })
    useTheiaTransportStore.getState().resetTransport()
    const s = useTheiaTransportStore.getState()
    expect(s.isPlaying).toBe(false)
    expect(s.hasVideo).toBe(false)
    expect(s.loop).toBe(false) // preferencia de operador — no se resetea
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA POOL — filtro de extensiones
// ═══════════════════════════════════════════════════════════════════════════

describe('🎛️ U1 — extensiones del media pool', () => {
  it('acepta exactamente el set U1', () => {
    for (const ok of ['a.mp4', 'b.webm', 'c.MKV', 'd.mov', 'e.avi', 'f.theia', 'g.glsl']) {
      expect(isSupportedMediaFile(ok)).toBe(true)
    }
    for (const nope of ['h.mp3', 'i.png', 'j.exe', 'k.glslx', 'l.theia.bak', 'm.txt']) {
      expect(isSupportedMediaFile(nope)).toBe(false)
    }
  })

  it('MEDIA_POOL_ACCEPT cubre video + atom extensions', () => {
    expect(MEDIA_POOL_ACCEPT).toContain('.mp4')
    expect(MEDIA_POOL_ACCEPT).toContain('.avi')
    expect(MEDIA_POOL_ACCEPT).toContain('.glsl')
    expect(MEDIA_POOL_ACCEPT).toContain('.theia')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA POOL — ingestFiles
// ═══════════════════════════════════════════════════════════════════════════

describe('🎛️ U1 — ingestFiles (Universal Media Pool)', () => {
  it('vídeo → RawClip + átomo kind:video registrado y jugable', async () => {
    const { clips, atoms } = await useTheiaPackStore
      .getState()
      .ingestFiles([makeFile('tribu.mp4')])
    expect(clips).toHaveLength(1)
    expect(atoms).toHaveLength(1)

    const atom = atoms[0]
    expect(atom.source?.kind).toBe('video')
    expect(atom.filePath).toBe(clips[0].url) // blob URL — resoluble por loadVideo
    expect(getTheiaRegistry().getAtom(atom.id)).toBeDefined()

    const pack = useTheiaPackStore.getState().packs.get(atom.packId)
    expect(pack?.atoms.map((a) => a.id)).toContain(atom.id)
  })

  it('.glsl → átomo kind:shader con meta @euclid (genoma + zona)', async () => {
    const { atoms } = await useTheiaPackStore
      .getState()
      .ingestFiles([makeFile('acid_worm.glsl', GLSL_FIXTURE)])
    expect(atoms).toHaveLength(1)

    const atom = atoms[0]
    expect(atom.id).toBe('glsl_acid_worm')
    expect(atom.source?.kind).toBe('shader')
    expect(atom.source?.glsl).toBe(GLSL_FIXTURE)
    expect(atom.aggression).toBeCloseTo(0.7)
    expect(atom.chaos).toBeCloseTo(0.9)
    expect(atom.organicity).toBeCloseTo(0.2)
    expect(atom.energyZone).toEqual({ min: 'active', max: 'intense' })
    expect(getTheiaRegistry().getAtom('glsl_acid_worm')).toBeDefined()
  })

  it('.glsl sin header @euclid → defaults neutros', async () => {
    const { atoms } = await useTheiaPackStore
      .getState()
      .ingestFiles([makeFile('bare.glsl', 'void mainImage(out vec4 o,in vec2 f){o=vec4(0);}')])
    expect(atoms[0].aggression).toBe(0.5)
    expect(atoms[0].energyZone).toEqual({ min: 'gentle', max: 'peak' })
  })

  it('re-dropear el mismo .glsl reemplaza (dedup por id)', async () => {
    const store = useTheiaPackStore.getState()
    await store.ingestFiles([makeFile('worm.glsl', GLSL_FIXTURE)])
    await store.ingestFiles([makeFile('worm.glsl', GLSL_FIXTURE + '\n// v2')])
    const pack = [...useTheiaPackStore.getState().packs.values()]
      .find((p) => p.atoms.some((a) => a.id === 'glsl_worm'))
    expect(pack?.atoms.filter((a) => a.id === 'glsl_worm')).toHaveLength(1)
  })

  it('folder drop → átomos agrupados por carpeta (webkitRelativePath)', async () => {
    const { atoms } = await useTheiaPackStore.getState().ingestFiles([
      makeFile('a.glsl', GLSL_FIXTURE, 'Tribu/a.glsl'),
      makeFile('b.glsl', GLSL_FIXTURE, 'Tribu/b.glsl'),
      makeFile('c.mp4', 'x', 'Other/c.mp4'),
    ])
    const tribu = atoms.filter((a) => a.packId === 'Tribu')
    expect(tribu).toHaveLength(2)
    expect(atoms.some((a) => a.packId === 'Other')).toBe(true)
  })

  it('buildGlslAtom — helper standalone estable', () => {
    const a = buildGlslAtom('x.glsl', GLSL_FIXTURE, 'PackX')
    expect(a.packId).toBe('PackX')
    expect(a.source?.kind).toBe('shader')
    expect(a.trim.endMs).toBeGreaterThan(0)
  })
})
