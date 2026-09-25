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
import type { ITheiaPack } from '../../../types/theiaTypes'
import {
  buildOracleKifsAtom,
  EUCLID_PACK_ID,
  ORACLE_KIFS_LABEL,
} from './oracleKifs'

let installed = false

/**
 * Idempotente: registra el pack `euclid-oracle` + sus átomos shader.
 * Devuelve los atomIds instalados.
 */
export function ensureEuclidShaderAtoms(): readonly string[] {
  const atom = buildOracleKifsAtom()
  const registry = getTheiaRegistry()
  registry.register(atom)

  const store = useTheiaPackStore.getState()
  const existing = store.packs.get(EUCLID_PACK_ID)
  if (!existing || existing.atoms.every((a) => a.id !== atom.id)) {
    const pack: ITheiaPack = {
      id: EUCLID_PACK_ID,
      rootPath: '',
      atoms: existing ? [...existing.atoms.filter((a) => a.id !== atom.id), atom] : [atom],
      manifest: {
        schemaVersion: 1,
        displayName: `${ORACLE_KIFS_LABEL} · EUCLID`,
        accentColor: '#a855f7',
        atomOrder: [atom.id],
      },
      scannedAt: Date.now(),
      pending: true, // pack en memoria — no vive en disco
    }
    store.upsertPack(pack)
  }

  installed = true
  return [atom.id] as const
}

/** ¿Ya se instalaron los átomos generativos en esta sesión? */
export function euclidShaderAtomsInstalled(): boolean {
  return installed
}
