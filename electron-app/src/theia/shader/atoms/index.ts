/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔮 WAVE 8230 — EUCLID · E4: instalación de átomos generativos (kind:'shader')
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registra los átomos shader builtin en el `TheiaRegistry` (para que el
 * matcher cognitivo los trate como cualquier `.theia`) y expone el pack
 * `euclid-oracle` en el `useTheiaPackStore` para que el LiveDeck los liste.
 *
 * Idempotente — seguro de llamar en cada mount del EngineView.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getTheiaRegistry } from '../../../core/theia/TheiaRegistry'
import { useTheiaPackStore } from '../../../stores/useTheiaPackStore'
import type { ITheiaAtom, ITheiaPack } from '../../../types/theiaTypes'
import {
  buildOracleKifsAtom,
  EUCLID_PACK_ID,
  ORACLE_KIFS_LABEL,
} from './oracleKifs'
import {
  buildOpusGenomeAtoms,
  OPUS_PACK_ID,
  OPUS_PACK_LABEL,
} from './opusLibrary'

let installed = false

function upsertMemoryPack(
  packId: string,
  displayName: string,
  accentColor: string,
  atoms: readonly ITheiaAtom[],
): void {
  const store = useTheiaPackStore.getState()
  const existing = store.packs.get(packId)
  const incomingIds = new Set(atoms.map((a) => a.id))
  // Preserva átomos extra que el usuario hubiera agregado al pack en sesión.
  const extras = (existing?.atoms ?? []).filter((a) => !incomingIds.has(a.id))
  const merged = [...atoms, ...extras]
  const pack: ITheiaPack = {
    id: packId,
    rootPath: '',
    atoms: merged,
    manifest: {
      schemaVersion: 1,
      displayName,
      accentColor,
      atomOrder: merged.map((a) => a.id),
    },
    scannedAt: Date.now(),
    pending: true, // pack en memoria — los .glsl viven en assets/, no en userdata
  }
  store.upsertPack(pack)
}

/**
 * Idempotente: registra los átomos generativos builtin —
 * pack `euclid-oracle` (KIFS de prueba) + pack `Opus Infinite Genome`
 * (aether_serpent / tribu_mental leídos de `assets/shaders/*.glsl`).
 * Devuelve los atomIds instalados.
 */
export function ensureEuclidShaderAtoms(): readonly string[] {
  const registry = getTheiaRegistry()

  const kifs = buildOracleKifsAtom()
  const opus = buildOpusGenomeAtoms()
  for (const atom of [kifs, ...opus]) registry.register(atom)

  upsertMemoryPack(EUCLID_PACK_ID, `${ORACLE_KIFS_LABEL} · EUCLID`, '#a855f7', [kifs])
  upsertMemoryPack(OPUS_PACK_ID, OPUS_PACK_LABEL, '#a3e635', opus)

  installed = true
  return [kifs.id, ...opus.map((a) => a.id)] as const
}

/** ¿Ya se instalaron los átomos generativos en esta sesión? */
export function euclidShaderAtomsInstalled(): boolean {
  return installed
}
