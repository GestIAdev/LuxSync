/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 useLoadAssetLibrary — WAVE 4549.2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hook que orquesta la carga de todos los assets (fixtures + ingenios)
 * desde el proceso main via IPC y los ingesta en assetLibraryStore.
 *
 * Se llama UNA VEZ desde el componente contenedor que monta el browser.
 * @module components/shared/AssetBrowser/useLoadAssetLibrary
 */

import { useEffect, useRef } from 'react'
import { useAssetLibraryStore } from '../../../stores/assetLibraryStore'
import type { FixtureDefinition } from '../../../types/FixtureDefinition'
import type { IIngenioDefinition } from '../../../core/forge/ingenio/types'

export function useLoadAssetLibrary(): { isLoading: boolean; lastError: string | null } {
  const ingestFixtures  = useAssetLibraryStore(s => s.ingestFixtures)
  const ingestIngenios  = useAssetLibraryStore(s => s.ingestIngenios)
  const isLoading       = useAssetLibraryStore(s => s.isLoading)
  const lastError       = useAssetLibraryStore(s => s.lastError)
  const setLoading      = useAssetLibraryStore(s => s.clear)   // clear resets loading state

  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    ;(async () => {
      useAssetLibraryStore.setState({ isLoading: true, lastError: null })

      try {
        // ── Fixtures ─────────────────────────────────────────────────────
        const fixtureResult = await window.lux?.library?.listAll?.()
        if (fixtureResult?.success) {
          const systemFilePaths = new Map<string, string>()
          const userFilePaths   = new Map<string, string>()
          ;(fixtureResult.systemFixtures as any[]).forEach((f: any) => {
            if (f.filePath) systemFilePaths.set(f.id, f.filePath)
          })
          ;(fixtureResult.userFixtures as any[]).forEach((f: any) => {
            if (f.filePath) userFilePaths.set(f.id, f.filePath)
          })
          ingestFixtures(
            fixtureResult.systemFixtures as FixtureDefinition[],
            fixtureResult.userFixtures as FixtureDefinition[],
            systemFilePaths,
            userFilePaths,
          )
        }

        // ── Ingenios ──────────────────────────────────────────────────────
        const ingenioResult = await window.lux?.ingenio?.listAll?.()
        if (ingenioResult?.success) {
          ingestIngenios(
            ingenioResult.systemIngenios as IIngenioDefinition[],
            ingenioResult.userIngenios   as IIngenioDefinition[],
          )
        }

        useAssetLibraryStore.setState({ isLoading: false })
      } catch (err) {
        console.error('[useLoadAssetLibrary] ❌ Load failed:', err)
        useAssetLibraryStore.setState({ isLoading: false, lastError: String(err) })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isLoading, lastError }
}
