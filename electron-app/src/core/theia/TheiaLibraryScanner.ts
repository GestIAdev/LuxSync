/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 8299 — THEIA LIBRARY SCANNER (Local Storage & Asset Pipeline)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Escáner recursivo asíncrono de `userData/theia/packs/` — la fuente de
 *  verdad en disco para los Packs de Theia. Hereda el idioma de
 *  `LfxFileLoader._loadDirectoryRecursive` (WAVE 2483/2524):
 *
 *    - `fs.readdir(dir, { withFileTypes: true })` async — no bloquea el main.
 *    - Política FAIL-SILENT: un archivo malformado/inaccesible se loggea con
 *      `console.warn` y se descarta; el sistema sigue con lo sano.
 *    - Recursión libre: el operador organiza con subcarpetas; los átomos
 *      encontrados en profundidad se pliegan al pack de nivel 1.
 *
 *  LAYOUT:
 *    userData/theia/packs/
 *      ├── <packId>/
 *      │   ├── pack.theiapack.json   ← manifest opcional (ITheiaPackManifest)
 *      │   └── *.glsl / *.theia      ← recursivo dentro del pack
 *      └── *.glsl / *.theia          ← archivos sueltos → pack virtual `loose`
 *
 *  ESCRITURA:
 *    `writeAtomOverrides()` persiste los ajustes del Inspector (genes/params)
 *    en `pack.theiapack.json` con write atómico (tmp + rename, patrón de
 *    `VibeLabPersistence`). packId se sanea contra path traversal antes de
 *    tocar el disco.
 *
 *  NO debe importarse desde renderer code — vive en el main process.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'

import type {
  ITheiaAtomOverrides,
  ITheiaLibraryScan,
  ITheiaPackManifest,
  ITheiaScannedAtomFile,
  ITheiaScannedPack,
  TheiaScannedFileKind,
} from '../../types/theiaTypes'

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const THEIA_ROOT = 'theia'
const PACKS_ROOT = 'packs'
const MANIFEST_NAME = 'pack.theiapack.json'

/** packId virtual para los `.glsl`/`.theia` sueltos a nivel raíz. */
export const LOOSE_PACK_ID = 'loose'

/** Cap por archivo — mismo presupuesto que USER_SAFETY_POLICY del arsenal. */
const MAX_FILE_SIZE_BYTES = 256 * 1024

/** Extensiones aceptadas (case-insensitive). */
const ACCEPTED_EXTENSIONS: Readonly<Record<string, TheiaScannedFileKind>> = {
  '.glsl': 'glsl',
  '.theia': 'theia',
}

// ─── ROOT ────────────────────────────────────────────────────────────────────

/**
 * Ruta raíz de la librería Theia (`userData/theia/packs`).
 * Crea el árbol si no existe — igual que `HephFileIO.getArsenalPath`.
 */
export async function getTheiaPacksRoot(): Promise<string> {
  const root = path.join(app.getPath('userData'), THEIA_ROOT, PACKS_ROOT)
  await fsp.mkdir(root, { recursive: true })
  return root
}

// ─── SCAN ────────────────────────────────────────────────────────────────────

/** ¿El nombre de archivo es un átomo soportado? (case-insensitive). */
function _fileKind(name: string): TheiaScannedFileKind | null {
  const ext = path.extname(name).toLowerCase()
  return ACCEPTED_EXTENSIONS[ext] ?? null
}

/**
 * Lee el archivo como UTF-8 con cap de tamaño.
 * Devuelve null (fail-silent) si es inaccesible o excede el límite.
 */
async function _readAtomFile(absPath: string): Promise<string | null> {
  try {
    const stat = await fsp.stat(absPath)
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      console.warn(`[TheiaLibrary ⚠️] Skipped oversized file (${stat.size}B): ${absPath}`)
      return null
    }
    return await fsp.readFile(absPath, 'utf-8')
  } catch (err) {
    console.warn(`[TheiaLibrary ⚠️] Cannot read ${absPath}:`, err)
    return null
  }
}

/**
 * Recolector recursivo: acumula `{fileName, relPath, absPath, kind, text}`
 * para cada `.glsl`/`.theia` bajo `dir`. Los manifiestos y demás archivos se
 * ignoran silenciosamente.
 */
async function _collectAtomFiles(
  dir: string,
  packRoot: string,
  out: ITheiaScannedAtomFile[],
): Promise<void> {
  let dirents: fs.Dirent[]
  try {
    dirents = await fsp.readdir(dir, { withFileTypes: true })
  } catch (err) {
    console.warn(`[TheiaLibrary ⚠️] readdir failed for ${dir}:`, err)
    return
  }

  for (const dirent of dirents) {
    const absPath = path.join(dir, dirent.name)
    if (dirent.isDirectory()) {
      // Symlinked dirs no son isDirectory() en Dirent — quedan excluidas
      // naturalmente, igual que en LfxFileLoader.
      await _collectAtomFiles(absPath, packRoot, out)
      continue
    }
    if (!dirent.isFile()) continue
    if (dirent.name.startsWith('.')) continue
    if (dirent.name === MANIFEST_NAME) continue

    const kind = _fileKind(dirent.name)
    if (!kind) continue

    const text = await _readAtomFile(absPath)
    if (text === null) continue

    out.push({
      fileName: dirent.name,
      relPath: path.relative(packRoot, absPath),
      absPath,
      kind,
      text,
    })
  }
}

/**
 * Parsea `pack.theiapack.json` si existe en `packDir`.
 * Fail-silent: JSON malformado o ausente → null (modo zero-conf).
 */
async function _readManifest(packDir: string): Promise<ITheiaPackManifest | null> {
  const manifestPath = path.join(packDir, MANIFEST_NAME)
  try {
    const raw = await fsp.readFile(manifestPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ITheiaPackManifest>
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.schemaVersion !== 1 ||
      typeof parsed.displayName !== 'string'
    ) {
      console.warn(`[TheiaLibrary ⚠️] Invalid manifest (schema) at ${manifestPath}`)
      return null
    }
    return parsed as ITheiaPackManifest
  } catch {
    return null // ausente o ilegible — modo zero-conf
  }
}

/**
 * Escaneo completo de la librería Theia.
 *
 * Devuelve un pack por subdirectorio de primer nivel de `packs/` (los
 * `.glsl`/`.theia` sueltos a nivel raíz se agrupan en el pack virtual
 * `loose`). Los packs se devuelven ordenados por id para un render
 * determinista.
 */
export async function scanTheiaLibrary(): Promise<ITheiaLibraryScan> {
  const packsRoot = await getTheiaPacksRoot()
  const packs: ITheiaScannedPack[] = []

  let dirents: fs.Dirent[]
  try {
    dirents = await fsp.readdir(packsRoot, { withFileTypes: true })
  } catch (err) {
    console.warn(`[TheiaLibrary ⚠️] readdir failed for ${packsRoot}:`, err)
    return { packsRoot, packs: [] }
  }

  const looseFiles: ITheiaScannedAtomFile[] = []
  const packDirs: string[] = []

  for (const dirent of dirents) {
    if (dirent.isDirectory()) {
      if (!dirent.name.startsWith('.')) packDirs.push(dirent.name)
      continue
    }
    if (!dirent.isFile() || dirent.name.startsWith('.')) continue
    const kind = _fileKind(dirent.name)
    if (!kind) continue
    const absPath = path.join(packsRoot, dirent.name)
    const text = await _readAtomFile(absPath)
    if (text === null) continue
    looseFiles.push({
      fileName: dirent.name,
      relPath: dirent.name,
      absPath,
      kind,
      text,
    })
  }

  // Un pack por directorio de nivel 1 — recursión libre dentro de cada pack.
  for (const dirName of packDirs.sort()) {
    const packDir = path.join(packsRoot, dirName)
    const files: ITheiaScannedAtomFile[] = []
    await _collectAtomFiles(packDir, packDir, files)
    const manifest = await _readManifest(packDir)
    packs.push({ id: dirName, rootPath: packDir, manifest, files })
  }

  if (looseFiles.length > 0) {
    packs.push({ id: LOOSE_PACK_ID, rootPath: packsRoot, manifest: null, files: looseFiles })
  }

  console.log(
    `[TheiaLibrary 📦] Scan: ${packs.length} pack(s), ` +
    `${packs.reduce((n, p) => n + p.files.length, 0)} atom file(s) @ ${packsRoot}`,
  )
  return { packsRoot, packs }
}

// ─── FACTORY BOOTSTRAP (WAVE 8300) ───────────────────────────────────────────

/** packId del pack de fábrica — carpeta sembrada al primer arranque. */
export const FACTORY_PACK_ID = 'Factory'

/**
 * 🌊 WAVE 8300 — Conjunto canónico de fábrica (los 13 átomos del extinto
 * `opusLibrary.ts`, en el orden del viejo `OPUS_SPECS`). El dir fuente
 * (`assets/shaders/`) puede contener shaders WIP que aún no pasan el
 * contrato v2 (`migrate_atoms_v2 --check`): el bootstrap siembra SOLO
 * esta lista — el filtro de calidad es el propio contrato.
 * Para graduar un shader a fábrica: pásale el check y añade su nombre aquí.
 */
export const FACTORY_ATOM_FILES: readonly string[] = [
  'aether_serpent.glsl',
  'tribu_mental.glsl',
  'neon_conduit.glsl',
  'sacred_bouncer.glsl',
  'liquid_nebula.glsl',
  'voxel_monolith.glsl',
  'morphing_core.glsl',
  'quantum_swarm.glsl',
  'ferro_heart.glsl',
  'event_horizon.glsl',
  'turing_cannibals.glsl',
  'atom_voice_mandala.glsl',
  'atom_phase_mercury.glsl',
  'dosel_selvatico.glsl',
]

/**
 * 🌊 WAVE 8300 — FACTORY BOOTSTRAP (Opus Library Extraction)
 *
 * Resuelve la "creación perezosa": en una instalación limpia la carpeta
 * `theia/packs/` no existía hasta el primer scan. Al arrancar, main.ts
 * llama aquí con el dir fuente de fábrica (dev → `assets/shaders/`,
 * prod → `process.resourcesPath/theia-factory/`).
 *
 * Si `packs/Factory/` ya existe → NO-OP. El pack es territorio del
 * usuario: nunca se re-siembra ni se sobrescribe — si el operador lo
 * borra de disco, el Deck se queda vacío (Mission 2: cero fallback
 * estático en el renderer).
 *
 * Siembra los `.glsl` del dir fuente listados en `FACTORY_ATOM_FILES`
 * (los WIP del dir se ignoran — deben pasar el contrato v2 antes de
 * graduarse) + un `pack.theiapack.json` con el orden canónico
 * (`atomOrder` usa los ids `glsl_<basename>` que produce `buildGlslAtom`
 * en el store).
 *
 * @returns true si sembró, false si no hizo nada. FAIL-SILENT (WAVE 2483):
 *          un fallo de FS solo deja warn — el renderer seguirá viendo un
 *          scan vacío, nunca un crash de arranque.
 */
export async function bootstrapTheiaFactory(factorySourceDir: string): Promise<boolean> {
  try {
    const factoryDir = path.join(await getTheiaPacksRoot(), FACTORY_PACK_ID)
    if (fs.existsSync(factoryDir)) return false

    const entries = await _collectFactoryShaders(factorySourceDir)
    if (entries.length === 0) return false

    await fsp.mkdir(factoryDir, { recursive: true })
    const atomOrder: string[] = []
    for (const e of entries) {
      await fsp.copyFile(e.absPath, path.join(factoryDir, e.fileName))
      // Id canónico = el que genera `_safeBasename` en useTheiaPackStore.
      atomOrder.push(`glsl_${e.fileName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_')}`)
    }

    const manifest: ITheiaPackManifest = {
      schemaVersion: 1,
      displayName: 'Opus Infinite Genome',
      description: 'Factory shader atoms seeded at first boot (WAVE 8300)',
      accentColor: '#a3e635',
      atomOrder,
    }
    await fsp.writeFile(
      path.join(factoryDir, MANIFEST_NAME),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    )
    console.log(`[TheiaLibrary 🌱] Factory bootstrap → ${entries.length} atom(s) seeded @ ${factoryDir}`)
    return true
  } catch (err) {
    console.warn('[TheiaLibrary ⚠️] Factory bootstrap failed:', err)
    return false
  }
}

/**
 * Resuelve los archivos de `FACTORY_ATOM_FILES` dentro del dir fuente de
 * fábrica (recursivo — el nombre de archivo es la clave, la ubicación es
 * libre). Devuelve en el orden canónico de la lista; un nombre ausente se
 * loggea y se omite (fail-silent WAVE 2483).
 */
async function _collectFactoryShaders(
  dir: string,
): Promise<{ absPath: string; fileName: string }[]> {
  const found = new Map<string, string>() // lowerName → absPath
  const walk = async (d: string): Promise<void> => {
    let dirents: fs.Dirent[]
    try {
      dirents = await fsp.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of dirents) {
      const abs = path.join(d, ent.name)
      if (ent.isDirectory()) await walk(abs)
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.glsl')) {
        if (!found.has(ent.name.toLowerCase())) found.set(ent.name.toLowerCase(), abs)
      }
    }
  }
  await walk(dir)

  const out: { absPath: string; fileName: string }[] = []
  for (const fileName of FACTORY_ATOM_FILES) {
    const abs = found.get(fileName.toLowerCase())
    if (abs) out.push({ absPath: abs, fileName })
    else console.warn(`[TheiaLibrary ⚠️] Factory atom ausente en fuente: ${fileName}`)
  }
  return out
}

// ─── WRITE (manifest overrides) ──────────────────────────────────────────────

/**
 * Sanea un packId para usarlo como nombre de directorio bajo `packs/`.
 * Devuelve null si el id es inseguro (path traversal, separadores, vacío).
 */
function _sanitizePackId(packId: string): string | null {
  if (!packId || packId === '.' || packId === '..') return null
  if (/[\\/]/.test(packId)) return null
  return packId
}

/**
 * Persiste los ajustes del Inspector de un átomo en `pack.theiapack.json`.
 *
 * Merge semántico: lee el manifest existente (preserva displayName /
 * accentColor / atomOrder), actualiza `atomOverrides[atomId]` y reescribe con
 * write atómico (`.tmp` + rename — patrón de `VibeLabPersistence`).
 *
 * packId `loose` escribe su manifest directamente en `packs/`
 * (rootPath del pack virtual = packsRoot).
 */
export async function writeAtomOverrides(
  packId: string,
  atomId: string,
  patch: { genes?: Record<string, number>; params?: Record<string, number> },
): Promise<boolean> {
  const safePackId = _sanitizePackId(packId)
  if (!safePackId || !atomId) {
    console.warn(`[TheiaLibrary ⚠️] Rejected manifest write: packId='${packId}' atomId='${atomId}'`)
    return false
  }

  const packsRoot = await getTheiaPacksRoot()
  const packDir = safePackId === LOOSE_PACK_ID
    ? packsRoot
    : path.join(packsRoot, safePackId)

  // Containment check — patrón `lux:delete-fixture-definition`.
  if (path.normalize(packDir) !== path.normalize(packsRoot) &&
      !path.normalize(packDir).startsWith(path.normalize(packsRoot) + path.sep)) {
    console.warn(`[TheiaLibrary ⚠️] Path escapes packs root: ${packDir}`)
    return false
  }

  await fsp.mkdir(packDir, { recursive: true })

  const manifestPath = path.join(packDir, MANIFEST_NAME)
  let manifest: Partial<ITheiaPackManifest> & { atomOverrides?: Record<string, ITheiaAtomOverrides> } = {}
  try {
    const raw = await fsp.readFile(manifestPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ITheiaPackManifest>
    if (parsed && typeof parsed === 'object') manifest = parsed
  } catch {
    // Manifest ausente/corrupto — se reconstruye con defaults.
  }

  const prev = manifest.atomOverrides?.[atomId] ?? {}
  const nextOverride: ITheiaAtomOverrides = {
    ...(patch.genes !== undefined ? { genes: { ...patch.genes } } : (prev.genes ? { genes: prev.genes } : {})),
    ...(patch.params !== undefined ? { params: { ...patch.params } } : (prev.params ? { params: prev.params } : {})),
  }

  const next: ITheiaPackManifest = {
    schemaVersion: 1,
    displayName: typeof manifest.displayName === 'string' ? manifest.displayName : safePackId,
    ...(manifest.description !== undefined ? { description: manifest.description } : {}),
    ...(manifest.accentColor !== undefined ? { accentColor: manifest.accentColor } : {}),
    ...(manifest.atomOrder !== undefined ? { atomOrder: manifest.atomOrder } : {}),
    atomOverrides: {
      ...(manifest.atomOverrides ?? {}),
      [atomId]: nextOverride,
    },
  }

  const tmpPath = manifestPath + '.tmp'
  await fsp.writeFile(tmpPath, JSON.stringify(next, null, 2), 'utf-8')
  await fsp.rename(tmpPath, manifestPath)
  return true
}
