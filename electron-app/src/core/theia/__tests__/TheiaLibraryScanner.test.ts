/**
 * 🌊 WAVE 8299 — TheiaLibraryScanner tests.
 *
 * Escáner real sobre un árbol temporal en %TMP% — `electron` se mockea para
 * redirigir `app.getPath('userData')`. Cubre: creación del root, grouping por
 * carpeta, recursión libre, manifest parse/fail-silent, pack `loose`, cap de
 * tamaño y escritura atómica de `atomOverrides` con path-safety.
 */

import * as fsp from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let TMP_ROOT = ''

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key !== 'userData') throw new Error(`unexpected getPath('${key}')`)
      return TMP_ROOT
    },
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}))

import {
  bootstrapTheiaFactory,
  FACTORY_PACK_ID,
  getTheiaPacksRoot,
  LOOSE_PACK_ID,
  scanTheiaLibrary,
  writeAtomOverrides,
} from '../TheiaLibraryScanner'

const GLSL_A = `// @euclid name "Acid Worm"
void mainImage(out vec4 o, in vec2 f) { o = vec4(1.0); }`

beforeEach(async () => {
  TMP_ROOT = await fsp.mkdtemp(path.join(os.tmpdir(), 'lux-theia-test-'))
})

afterEach(async () => {
  await fsp.rm(TMP_ROOT, { recursive: true, force: true })
})

describe('scanTheiaLibrary', () => {
  it('crea el root y devuelve 0 packs sobre librería vacía', async () => {
    const res = await scanTheiaLibrary()
    expect(res.packsRoot).toBe(path.join(TMP_ROOT, 'theia', 'packs'))
    expect(res.packs).toEqual([])
  })

  it('agrupa .glsl por carpeta de nivel 1 y recoge recursivo en profundidad', async () => {
    const packsRoot = await getTheiaPacksRoot()
    const packDir = path.join(packsRoot, 'latin-pack')
    await fsp.mkdir(path.join(packDir, 'media', 'deep'), { recursive: true })
    await fsp.writeFile(path.join(packDir, 'a.glsl'), GLSL_A)
    await fsp.writeFile(path.join(packDir, 'media', 'deep', 'b.glsl'), GLSL_A)
    await fsp.writeFile(path.join(packDir, 'readme.md'), 'not an atom')

    const res = await scanTheiaLibrary()
    expect(res.packs).toHaveLength(1)
    expect(res.packs[0].id).toBe('latin-pack')
    expect(res.packs[0].rootPath).toBe(packDir)
    const names = res.packs[0].files.map((f) => f.fileName).sort()
    expect(names).toEqual(['a.glsl', 'b.glsl'])
    expect(res.packs[0].files.find((f) => f.fileName === 'b.glsl')?.relPath)
      .toBe(path.join('media', 'deep', 'b.glsl'))
  })

  it('los .glsl sueltos en root caen en el pack virtual `loose`', async () => {
    const packsRoot = await getTheiaPacksRoot()
    await fsp.writeFile(path.join(packsRoot, 'solo.glsl'), GLSL_A)

    const res = await scanTheiaLibrary()
    expect(res.packs).toHaveLength(1)
    expect(res.packs[0].id).toBe(LOOSE_PACK_ID)
    expect(res.packs[0].files).toHaveLength(1)
  })

  it('parsea pack.theiapack.json; manifest malformado → null fail-silent', async () => {
    const packsRoot = await getTheiaPacksRoot()
    const goodDir = path.join(packsRoot, 'with-manifest')
    const badDir = path.join(packsRoot, 'bad-manifest')
    await fsp.mkdir(goodDir, { recursive: true })
    await fsp.mkdir(badDir, { recursive: true })
    await fsp.writeFile(path.join(goodDir, 'x.glsl'), GLSL_A)
    await fsp.writeFile(path.join(badDir, 'y.glsl'), GLSL_A)
    await fsp.writeFile(
      path.join(goodDir, 'pack.theiapack.json'),
      JSON.stringify({ schemaVersion: 1, displayName: 'Latin Pack', accentColor: '#ff0' }),
    )
    await fsp.writeFile(path.join(badDir, 'pack.theiapack.json'), '{not json')

    const res = await scanTheiaLibrary()
    const good = res.packs.find((p) => p.id === 'with-manifest')
    const bad = res.packs.find((p) => p.id === 'bad-manifest')
    expect(good?.manifest?.displayName).toBe('Latin Pack')
    expect(bad?.manifest).toBeNull()
    expect(bad?.files).toHaveLength(1) // el átomo sobrevive al manifest roto
  })

  it('ignora dotfiles y el propio manifest como átomo', async () => {
    const packsRoot = await getTheiaPacksRoot()
    const packDir = path.join(packsRoot, 'clean')
    await fsp.mkdir(packDir, { recursive: true })
    await fsp.writeFile(path.join(packDir, '.hidden.glsl'), GLSL_A)
    await fsp.writeFile(path.join(packDir, 'pack.theiapack.json'),
      JSON.stringify({ schemaVersion: 1, displayName: 'x' }))

    const res = await scanTheiaLibrary()
    const pack = res.packs.find((p) => p.id === 'clean')
    expect(pack?.files).toEqual([])
  })
})

describe('writeAtomOverrides', () => {
  it('crea manifest nuevo con atomOverrides y lo persiste al disco', async () => {
    const packsRoot = await getTheiaPacksRoot()
    await fsp.mkdir(path.join(packsRoot, 'p1'), { recursive: true })

    const ok = await writeAtomOverrides('p1', 'glsl_worm', {
      genes: { G_A: 0.7 },
      params: { u_speed: 0.4 },
    })
    expect(ok).toBe(true)

    const manifest = JSON.parse(
      await fsp.readFile(path.join(packsRoot, 'p1', 'pack.theiapack.json'), 'utf-8'),
    )
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.displayName).toBe('p1')
    expect(manifest.atomOverrides.glsl_worm.genes).toEqual({ G_A: 0.7 })
    expect(manifest.atomOverrides.glsl_worm.params).toEqual({ u_speed: 0.4 })
  })

  it('mergea sin destruir displayName ni otros overrides previos', async () => {
    const packsRoot = await getTheiaPacksRoot()
    const packDir = path.join(packsRoot, 'p2')
    await fsp.mkdir(packDir, { recursive: true })
    await fsp.writeFile(
      path.join(packDir, 'pack.theiapack.json'),
      JSON.stringify({
        schemaVersion: 1,
        displayName: 'Fancy Pack',
        accentColor: '#abc',
        atomOverrides: { glsl_old: { genes: { G_X: 1 } } },
      }),
    )

    const ok = await writeAtomOverrides('p2', 'glsl_new', { params: { u_fx: 2 } })
    expect(ok).toBe(true)

    const manifest = JSON.parse(
      await fsp.readFile(path.join(packDir, 'pack.theiapack.json'), 'utf-8'),
    )
    expect(manifest.displayName).toBe('Fancy Pack')
    expect(manifest.accentColor).toBe('#abc')
    expect(manifest.atomOverrides.glsl_old.genes).toEqual({ G_X: 1 })
    expect(manifest.atomOverrides.glsl_new.params).toEqual({ u_fx: 2 })
  })

  it('segundo write sobre el mismo átomo mergea genes + params', async () => {
    const packsRoot = await getTheiaPacksRoot()
    await fsp.mkdir(path.join(packsRoot, 'p3'), { recursive: true })

    await writeAtomOverrides('p3', 'a', { genes: { G_A: 1 } })
    await writeAtomOverrides('p3', 'a', { params: { u_p: 0.5 } })

    const manifest = JSON.parse(
      await fsp.readFile(path.join(packsRoot, 'p3', 'pack.theiapack.json'), 'utf-8'),
    )
    expect(manifest.atomOverrides.a).toEqual({ genes: { G_A: 1 }, params: { u_p: 0.5 } })
  })

  it('rechaza path traversal en packId', async () => {
    const ok = await writeAtomOverrides('..', 'evil', { genes: { G_A: 1 } })
    expect(ok).toBe(false)
    const ok2 = await writeAtomOverrides('a/b', 'evil', { genes: { G_A: 1 } })
    expect(ok2).toBe(false)
    const ok3 = await writeAtomOverrides('', 'evil', { genes: { G_A: 1 } })
    expect(ok3).toBe(false)
  })
})

// ─── 🌊 WAVE 8300 — FACTORY BOOTSTRAP ────────────────────────────────────────

describe('bootstrapTheiaFactory', () => {
  async function _makeFactorySource(): Promise<string> {
    const srcDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lux-factory-src-'))
    // Nombres canónicos de FACTORY_ATOM_FILES + un WIP que debe ignorarse.
    await fsp.writeFile(path.join(srcDir, 'aether_serpent.glsl'), GLSL_A)
    await fsp.writeFile(path.join(srcDir, 'tribu_mental.glsl'), GLSL_A)
    await fsp.writeFile(path.join(srcDir, 'wip_experiment.glsl'), '// WIP — no v2')
    await fsp.writeFile(path.join(srcDir, 'readme.md'), 'no es shader')
    return srcDir
  }

  it('siembra Factory/ con los .glsl canónicos + manifest con atomOrder', async () => {
    const srcDir = await _makeFactorySource()
    try {
      const seeded = await bootstrapTheiaFactory(srcDir)
      expect(seeded).toBe(true)

      const factoryDir = path.join(await getTheiaPacksRoot(), FACTORY_PACK_ID)
      expect(await fsp.readFile(path.join(factoryDir, 'aether_serpent.glsl'), 'utf-8')).toBe(GLSL_A)
      expect(await fsp.readFile(path.join(factoryDir, 'tribu_mental.glsl'), 'utf-8')).toBe(GLSL_A)
      // El WIP no canónico queda fuera de la siembra.
      await expect(fsp.stat(path.join(factoryDir, 'wip_experiment.glsl'))).rejects.toThrow()

      const manifest = JSON.parse(
        await fsp.readFile(path.join(factoryDir, 'pack.theiapack.json'), 'utf-8'),
      )
      expect(manifest.schemaVersion).toBe(1)
      expect(manifest.displayName).toBe('Opus Infinite Genome')
      // atomOrder sigue el orden canónico de FACTORY_ATOM_FILES
      // (aether_serpent antes que tribu_mental).
      expect(manifest.atomOrder).toEqual(['glsl_aether_serpent', 'glsl_tribu_mental'])

      // El pack sembrado es escaneable por la tubería normal.
      const res = await scanTheiaLibrary()
      expect(res.packs.find((p) => p.id === FACTORY_PACK_ID)?.files).toHaveLength(2)
    } finally {
      await fsp.rm(srcDir, { recursive: true, force: true })
    }
  })

  it('es NO-OP si Factory/ ya existe — no sobrescribe ni re-siembra', async () => {
    const srcDir = await _makeFactorySource()
    try {
      const packsRoot = await getTheiaPacksRoot()
      const factoryDir = path.join(packsRoot, FACTORY_PACK_ID)
      await fsp.mkdir(factoryDir, { recursive: true })
      await fsp.writeFile(path.join(factoryDir, 'custom.glsl'), '// custom del usuario')

      const seeded = await bootstrapTheiaFactory(srcDir)
      expect(seeded).toBe(false)
      // El contenido del usuario queda intacto.
      const files = await fsp.readdir(factoryDir)
      expect(files).toEqual(['custom.glsl'])
    } finally {
      await fsp.rm(srcDir, { recursive: true, force: true })
    }
  })

  it('fuente ausente/vacía → devuelve false sin crear Factory/', async () => {
    const seeded = await bootstrapTheiaFactory(path.join(TMP_ROOT, 'no-existe'))
    expect(seeded).toBe(false)
    const res = await scanTheiaLibrary()
    expect(res.packs.find((p) => p.id === FACTORY_PACK_ID)).toBeUndefined()
  })
})
