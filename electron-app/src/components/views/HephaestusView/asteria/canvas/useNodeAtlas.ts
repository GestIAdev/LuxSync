/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 WAVE 8000 — USE NODE ATLAS (ASTERIA, Pixel Mapper Inverso)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hook de consumo del Node Atlas: la fotografía ONE-SHOT de la topología
 * espacial REAL del NodeGraph del main process — cada sub-nodo/celda
 * (incluidos los pétalos sintéticos de 15cm que solo existen en el
 * backend), con su posición en metros y su nodeId exacto.
 *
 * FLUJO:
 *   mount ──► lux.aether.getNodeAtlas() ──► { entries, byNodeId }
 *   main  ──► lux:aether:topology_changed ──► reload SILENTE (debounced 200ms)
 *
 * DECISIONES:
 * - El reload por evento va DEBOUNCED: `setFixtures` dispara en cada
 *   `updateFixturePosition` (ráfaga a ~60Hz durante un arrastre) y el
 *   grafo solo cambia cuando el resync termina — nunca a 44Hz.
 * - El reload por evento es SILENTE (mantiene el atlas anterior visible
 *   hasta que llega el nuevo). Solo la carga inicial y el refresh()
 *   manual encienden `loading`.
 * - Guard generation: descarta respuestas de fetchs obsoletos (races
 *   entre evento, mount y refresh manual).
 * - CERO DATOS SIMULADOS: si el endpoint no existe (demo mode) o falla,
 *   el hook expone el error. Nunca inventa nodos.
 *
 * NOTA DE ORDEN: `entries` llega en orden de familia × dense array del
 * grafo (orden de registro). La ordenación canónica (deviceId, cellSuffix)
 * y el rigFingerprint son responsabilidad de fases posteriores (8030+).
 *
 * @module views/HephaestusView/asteria/canvas/useNodeAtlas
 * @version WAVE 8000
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeAtlasEntry } from '../../../../../core/aether/types'
import { useAsteriaStore, type NodeAtlas } from '../store/useAsteriaStore'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

// NodeAtlas { entries, byNodeId } vive en useAsteriaStore — es la forma del
// estado del store (capa inferior). Re-export para no romper consumidores.
export type { NodeAtlas }

export interface UseNodeAtlasResult {
  /** Atlas del grafo real. null hasta la primera carga exitosa. */
  atlas: NodeAtlas | null
  /** true durante la carga inicial o un refresh() manual. */
  loading: boolean
  /** Mensaje de error del último fetch fallido (endpoint ausente/fallo IPC). */
  error: string | null
  /** Fuerza una recarga inmediata (bypassa el debounce del evento). */
  refresh: () => void
}

/** Ventana del renderer — window.lux puede no existir en demo mode. */
interface LuxWindow {
  lux?: {
    aether?: {
      getNodeAtlas?: () => Promise<{
        success: boolean
        atlas?: NodeAtlasEntry[]
        error?: string
      }>
      onTopologyChanged?: (callback: (summary: { timestamp: number }) => void) => () => void
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Debounce del reload por topología_changed. 200ms absorbe la ráfaga de un
 * arrastre (un setFixtures por pointer-event) sin delay perceptible.
 */
const TOPOLOGY_RELOAD_DEBOUNCE_MS = 200

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useNodeAtlas(): UseNodeAtlasResult {
  // WAVE 8010-P2: el atlas vive en el store — única fuente de verdad.
  // React se suscribe aquí (HUD/consumidores); el RAF lee getState()
  // directamente, sin pasar por el reconciler.
  const atlas = useAsteriaStore((s) => s.nodeAtlas)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Generación del fetch en vuelo — descarta respuestas obsoletas. */
  const fetchGenRef = useRef(0)
  /** Timer del debounce de topología. */
  const debounceTimerRef = useRef<number>(0)

  /**
   * Fetch del atlas desde el endpoint real.
   * @param silent — true para reload en background (no toca `loading`).
   */
  const fetchAtlas = useCallback(async (silent: boolean): Promise<void> => {
    const aether = (window as unknown as LuxWindow).lux?.aether
    if (!aether?.getNodeAtlas) {
      setError(
        'Node Atlas no disponible — IPC bridge ausente (demo mode o preload desactualizado)',
      )
      setLoading(false)
      return
    }

    const gen = ++fetchGenRef.current
    if (!silent) setLoading(true)
    setError(null)

    try {
      const result = await aether.getNodeAtlas()

      // Respuesta obsoleta — hay un fetch más nuevo en vuelo
      if (gen !== fetchGenRef.current) return

      if (!result || result.success !== true || !Array.isArray(result.atlas)) {
        const msg =
          (result && typeof result.error === 'string' && result.error) ||
          'Respuesta inválida de lux:aether:getNodeAtlas'
        setError(msg)
        useAsteriaStore.getState().setNodeAtlas(null)
        return
      }

      // Índice O(1) — construido UNA vez por fetch, nunca por render.
      const byNodeId = new Map<string, NodeAtlasEntry>()
      for (const entry of result.atlas) {
        if (entry && typeof entry.nodeId === 'string') {
          byNodeId.set(entry.nodeId, entry)
        }
      }
      useAsteriaStore.getState().setNodeAtlas({ entries: result.atlas, byNodeId })
    } catch (err) {
      if (gen !== fetchGenRef.current) return
      setError(err instanceof Error ? err.message : String(err))
      useAsteriaStore.getState().setNodeAtlas(null)
    } finally {
      if (gen === fetchGenRef.current && !silent) setLoading(false)
    }
  }, [])

  // ── Carga inicial ──────────────────────────────────────────────────────
  useEffect(() => {
    void fetchAtlas(false)
  }, [fetchAtlas])

  // ── Recarga automática por cambio de topología (debounced, silenciosa) ──
  useEffect(() => {
    const onTopologyChanged = (): void => {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = window.setTimeout(() => {
        void fetchAtlas(true)
      }, TOPOLOGY_RELOAD_DEBOUNCE_MS)
    }

    const unsubscribe = (window as unknown as LuxWindow).lux?.aether?.onTopologyChanged?.(
      onTopologyChanged,
    )

    return () => {
      window.clearTimeout(debounceTimerRef.current)
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [fetchAtlas])

  // ── Refresh manual — intención explícita del usuario, sin debounce ────
  const refresh = useCallback(() => {
    window.clearTimeout(debounceTimerRef.current)
    void fetchAtlas(false)
  }, [fetchAtlas])

  return { atlas, loading, error, refresh }
}
