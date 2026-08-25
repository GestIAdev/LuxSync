/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌿 <EcoTacticalStage> — WAVE 7589: THE TRUE HOTPATH CONNECTION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Spec source: `hyperion_performance_audit2.md` §3.2 (conditional canvas mounting).
 *
 * What it kills (vs `TacticalCanvas`):
 *   • `transferControlToOffscreen()` — never called. No OffscreenCanvas, no
 *     worker thread, no irreversible transfer. Frees a full CPU core.
 *   • The 60 fps RAF render loop with 1000+ `drawImage`/`fill`/`stroke` calls
 *     per frame (FixtureLayer 6-pass pipeline × ~200 fixtures).
 *   • The `will-change` compositor layer promotions.
 *   • The Glass ping-pong buffer pool.
 *
 * What it keeps:
 *   • The operator can see which fixtures are active and what color they are.
 *   • Fixtures grouped by canonical zone — same zones the HQ TacticalCanvas
 *     uses, via `groupByCanonicalZone` from ZoneLayoutEngine.
 *   • Fixture count + active count readouts.
 *   • Fixture labels (name) inside each cell — never pitch-black.
 *   • Click-to-select interactivity via `useSelectionStore`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🩹 WAVE 7589: THE TRUE HOTPATH — window.glass.onFrame (Aether Glass SAB)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ROOT CAUSE (WAVE 7587 regression):
 *   The WAVE 7587 version read from `getTransientFixture(id)`, which reads from
 *   `transientRef.current.hardware.fixtures` — populated by `injectHotFrame()`
 *   from the `window.lux.onHotFrame` IPC listener. This is a SEPARATE, slower,
 *   serialized path than what the HQ `TacticalCanvas` actually uses.
 *
 *   The HQ `TacticalCanvas` gets its live colors from `window.glass.onFrame` —
 *   the Aether Glass SharedArrayBuffer (SAB). This is a zero-copy direct memory
 *   view from the backend's photonic engine. The `onHotFrame` IPC path is a
 *   serialized fallback that may lag, be throttled, or not fire at all in some
 *   configurations.
 *
 *   By unmounting the HQ `TacticalCanvas` in Eco-Mode, we did NOT break the
 *   `onHotFrame` listener (it lives in `useSeleneTruth` at the app root). But
 *   we DID lose the `window.glass.onFrame` subscription that was the actual
 *   source of truth for live colors. The `getTransientFixture` path was a
 *   stale/slow proxy, not the real hotpath.
 *
 * THE FIX:
 *   Subscribe to `window.glass.onFrame` DIRECTLY in `EcoTacticalStage` — the
 *   same subscription the HQ `TacticalCanvas` sets up in its Glass Pipeline
 *   useEffect. The Glass frame provides a `Float32Array` with 16 floats per
 *   fixture (R/G/B at offsets 0/1/2, dimmer at offset 5, all 0-255 raw DMX),
 *   indexed by fixture position matching `stageStore.fixtures` order.
 *
 *   In the callback, iterate through fixtures by index, read R/G/B/dimmer from
 *   the Glass `Float32Array`, look up the DOM node by fixture ID, and mutate
 *   `node.style.backgroundColor` directly. Zero React re-renders, zero-copy
 *   SAB read — the true photonic egress at 22-44 Hz.
 *
 *   FALLBACK: if `window.glass` is not available (SAB not set up, older
 *   backend), fall back to the `getTransientFixture(id)` interval pump at
 *   22 Hz. This ensures the Eco view always works, even without Glass.
 *
 * GLASS FRAME LAYOUT (from TacticalCanvas.tsx):
 *   Header floats [0..9]: bass, mid, high, energy, isBeat, reserved×5
 *   Fixture block i starts at: GLASS_HEADER_FLOATS + i * GLASS_FLOATS_PER_FIX
 *   GLASS_HEADER_FLOATS = 10, GLASS_FLOATS_PER_FIX = 16
 *   GF_R = 0, GF_G = 1, GF_B = 2, GF_DIMMER = 5
 *   All values are 0-255 raw DMX scale.
 *
 * @module components/hyperion/views/tactical/EcoTacticalStage
 * @version 7589.0.0 - True Hotpath Connection
 */

import React, { memo, useMemo, useRef, useEffect, useCallback } from 'react'
import { getTransientFixture } from '../../../../stores/transientStore'
import { useStageStore } from '../../../../stores/stageStore'
import { useSelectionStore, selectSelectedIds } from '../../../../stores/selectionStore'
import {
  groupByCanonicalZone,
  ZONE_LABELS,
} from '../../shared/ZoneLayoutEngine'
import type { CanonicalZone } from '../../../../core/stage/ShowFileV2'
import type { FixtureV2 } from '../../../../core/stage/ShowFileV2'
import './EcoTacticalStage.css'

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Interval in ms for the fallback color pump (~22 Hz) when Glass is unavailable. */
const FALLBACK_INTERVAL_MS = 45

/** Dim base color for inactive fixtures (dimmer=0) — never pitch-black. */
const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.05)'

// ── Glass frame layout (mirrors TacticalCanvas.tsx) ──────────────────────────
const GLASS_HEADER_FLOATS = 10
const GLASS_FLOATS_PER_FIX = 16
const GF_R = 0, GF_G = 1, GF_B = 2, GF_DIMMER = 5

// ── Diagnostic logging interval (ms) ─────────────────────────────────────────
const DIAG_LOG_INTERVAL_MS = 2000

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const EcoTacticalStage: React.FC = memo(() => {
  // ── Structural data (changes per-show, not per-frame) ──────────────────────
  const fixtures = useStageStore((state) => state.fixtures)

  // ── Selection (changes on click only) ──────────────────────────────────────
  const selectedIds = useSelectionStore(selectSelectedIds)
  const toggleSelection = useSelectionStore((state) => state.toggleSelection)

  // ── DOM node registry — maps fixture ID → cell <div> ───────────────────────
  const cellNodesRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const activeCountRef = useRef<HTMLSpanElement | null>(null)

  // ── Ordered fixture IDs ref — mirrors stageStore.fixtures order for Glass
  //    frame index → fixture ID mapping. Updated on every render (cheap).
  const fixtureIdsRef = useRef<string[]>([])
  fixtureIdsRef.current = fixtures.map((f) => f.id)

  // ── Group fixtures by canonical zone ───────────────────────────────────────
  const zoneGroups = useMemo(() => {
    const groups = groupByCanonicalZone<FixtureV2>(fixtures)
    const nonEmpty: { zone: CanonicalZone; label: string; fixtures: FixtureV2[] }[] = []
    groups.forEach((fixs, zone) => {
      if (fixs.length > 0) {
        nonEmpty.push({ zone, label: ZONE_LABELS[zone], fixtures: fixs })
      }
    })
    return nonEmpty
  }, [fixtures])

  const totalCount = fixtures.length

  // ── Cell click handler ─────────────────────────────────────────────────────
  const handleCellClick = useCallback((id: string) => {
    toggleSelection(id)
  }, [toggleSelection])

  // ── Active count updater (shared by Glass + fallback paths) ────────────────
  const updateActiveCount = useCallback((count: number) => {
    if (activeCountRef.current) {
      activeCountRef.current.textContent = `${count}/${totalCount} active`
    }
  }, [totalCount])

  // ── Diagnostic logging (throttled to every 2s) ─────────────────────────────
  const lastDiagLogRef = useRef(0)

  const maybeDiagLog = useCallback((
    source: 'glass' | 'fallback',
    fixtureId: string,
    r: number, g: number, b: number, dimmer: number,
  ) => {
    const now = performance.now()
    if (now - lastDiagLogRef.current < DIAG_LOG_INTERVAL_MS) return
    lastDiagLogRef.current = now
    console.log(
      `[EcoTacticalStage] 🩺 DIAG [${source}] fixture="${fixtureId}" ` +
      `color=rgb(${r},${g},${b}) dimmer=${dimmer} ` +
      `(nodeMap.size=${cellNodesRef.current.size})`
    )
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIMARY DATA PUMP: window.glass.onFrame (Aether Glass SAB)
  // ═══════════════════════════════════════════════════════════════════════════
  // This is the SAME subscription the HQ TacticalCanvas sets up. The Glass SAB
  // provides a Float32Array with 16 floats/fixture at 22-44 Hz. We read R/G/B
  // (offsets 0/1/2, 0-255) and dimmer (offset 5, 0-255) per fixture, indexed by
  // position matching stageStore.fixtures order.
  //
  // If window.glass is not available, we fall back to the getTransientFixture
  // interval pump below.
  useEffect(() => {
    if (totalCount === 0) return

    let glassUnsub: (() => void) | null = null
    let fallbackInterval: ReturnType<typeof setInterval> | null = null

    // ── Helper: apply color to a DOM node from raw 0-255 values ────────────
    const applyColor = (
      node: HTMLDivElement,
      r: number, g: number, b: number, dimmer: number,
    ): boolean => {
      // 🛡️ NaN SHIELD — sanitize non-finite values to 0 (mirrors packGlassFrameInto)
      const safeR = Number.isFinite(r) ? r : 0
      const safeG = Number.isFinite(g) ? g : 0
      const safeB = Number.isFinite(b) ? b : 0
      const safeDim = Number.isFinite(dimmer) ? dimmer : 0

      // dimmer is 0-255 → normalize to 0-1
      const dim = safeDim / 255
      const isActive = dim > 0.01

      if (isActive) {
        // Intensity-scaled RGB: multiply each channel by dimmer ratio.
        // R/G/B are 0-255 raw DMX, dim is 0-1 → result is 0-255.
        const fr = Math.round(safeR * dim)
        const fg = Math.round(safeG * dim)
        const fb = Math.round(safeB * dim)
        node.style.backgroundColor = `rgb(${fr}, ${fg}, ${fb})`
        return true
      } else {
        node.style.backgroundColor = INACTIVE_COLOR
        return false
      }
    }

    // ── Glass SAB path — the true photonic hotpath ─────────────────────────
    const startGlassPipeline = () => {
      const g = (window as any).glass
      if (!g || typeof g.onFrame !== 'function') return false

      glassUnsub = g.onFrame((view: Float32Array) => {
        const nodeMap = cellNodesRef.current
        if (nodeMap.size === 0) return

        const ids = fixtureIdsRef.current
        const count = Math.min(ids.length, Math.floor(
          (view.length - GLASS_HEADER_FLOATS) / GLASS_FLOATS_PER_FIX
        ))

        let activeCount = 0
        let diagLogged = false

        for (let i = 0; i < count; i++) {
          const fixtureId = ids[i]
          const node = nodeMap.get(fixtureId)
          if (!node) continue

          const gOff = GLASS_HEADER_FLOATS + i * GLASS_FLOATS_PER_FIX
          const r = view[gOff + GF_R]
          const g = view[gOff + GF_G]
          const b = view[gOff + GF_B]
          const dimmer = view[gOff + GF_DIMMER]

          const wasActive = applyColor(node, r, g, b, dimmer)
          if (wasActive) activeCount++

          // Diagnostic: log first active fixture every 2s
          if (!diagLogged && wasActive) {
            maybeDiagLog('glass', fixtureId, r, g, b, dimmer)
            diagLogged = true
          }
        }

        updateActiveCount(activeCount)
      })

      console.log('[EcoTacticalStage] 🌿 Glass SAB hotpath connected.')
      return true
    }

    // ── Fallback path — getTransientFixture interval pump ──────────────────
    const startFallbackPump = () => {
      console.log('[EcoTacticalStage] ⚠️ Glass SAB unavailable — using getTransientFixture fallback pump.')
      fallbackInterval = setInterval(() => {
        const nodeMap = cellNodesRef.current
        if (nodeMap.size === 0) return

        let activeCount = 0
        let diagLogged = false

        nodeMap.forEach((node, fixtureId) => {
          const f = getTransientFixture(fixtureId)
          if (!f) {
            node.style.backgroundColor = INACTIVE_COLOR
            return
          }

          const r = (f.color?.r ?? 0)
          const g = (f.color?.g ?? 0)
          const b = (f.color?.b ?? 0)
          const dimmer = (f.dimmer ?? 0)

          const wasActive = applyColor(node, r, g, b, dimmer)
          if (wasActive) activeCount++

          if (!diagLogged && wasActive) {
            maybeDiagLog('fallback', fixtureId, r, g, b, dimmer)
            diagLogged = true
          }
        })

        updateActiveCount(activeCount)
      }, FALLBACK_INTERVAL_MS)
    }

    // ── Try Glass first, fall back to transient pump ───────────────────────
    if ((window as any).glass) {
      if (!startGlassPipeline()) {
        startFallbackPump()
      }
    } else {
      // Wait for glass:ready event, with a timeout fallback
      let glassStarted = false
      const onGlassReady = () => {
        if (glassStarted) return
        glassStarted = true
        if (startGlassPipeline()) {
          // Stop fallback if it was running
          if (fallbackInterval) {
            clearInterval(fallbackInterval)
            fallbackInterval = null
          }
        }
      }
      window.addEventListener('glass:ready', onGlassReady, { once: true })

      // Start fallback immediately — will be replaced if Glass becomes ready
      startFallbackPump()

      // Cleanup for the event listener
      return () => {
        window.removeEventListener('glass:ready', onGlassReady)
        glassUnsub?.()
        if (fallbackInterval) clearInterval(fallbackInterval)
      }
    }

    return () => {
      glassUnsub?.()
      if (fallbackInterval) clearInterval(fallbackInterval)
    }
  }, [totalCount, updateActiveCount, maybeDiagLog])

  // ── Empty state ────────────────────────────────────────────────────────────
  if (totalCount === 0) {
    return (
      <div className="eco-tactical eco-tactical--empty">
        <div className="eco-tactical__empty-icon">☀️</div>
        <div className="eco-tactical__empty-title">No Fixtures</div>
        <div className="eco-tactical__empty-sub">Load a show file to see the stage.</div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="eco-tactical">
      <div className="eco-tactical__header">
        <span className="eco-tactical__title">TACTICAL (ECO)</span>
        <span className="eco-tactical__count" ref={activeCountRef}>
          0/{totalCount} active
        </span>
      </div>

      <div className="eco-tactical__zones">
        {zoneGroups.map(({ zone, label, fixtures: zoneFixtures }) => {
          return (
            <div key={zone} className="eco-tactical__zone">
              <div className="eco-tactical__zone-label">{label}</div>
              <div className="eco-tactical__grid">
                {zoneFixtures.map((f) => {
                  const isSelected = selectedIds.has(f.id)
                  return (
                    <div
                      key={f.id}
                      ref={(el) => {
                        if (el) {
                          cellNodesRef.current.set(f.id, el)
                        } else {
                          cellNodesRef.current.delete(f.id)
                        }
                      }}
                      className={`eco-tactical__cell ${isSelected ? 'eco-tactical__cell--selected' : ''}`}
                      style={{ backgroundColor: INACTIVE_COLOR }}
                      onClick={() => handleCellClick(f.id)}
                      title={f.name}
                    >
                      <span className="eco-tactical__cell-label">{f.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

EcoTacticalStage.displayName = 'EcoTacticalStage'

export default EcoTacticalStage
