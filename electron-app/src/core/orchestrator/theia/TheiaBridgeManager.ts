/**
 * WAVE 4959 PHASE 2 — TheiaBridgeManager
 * Extracted from TitanOrchestrator.ts (~lines 435, 437, 841-916).
 *
 * Owns: TheiaVideoRenderer lifecycle, SeleneTheiaBridge attach/detach,
 *       and the wiring between Theia thumb SAB → AetherCanvas → PixelMapAdapter.
 */

import { TheiaVideoRenderer } from '../../aether/canvas/renderers/TheiaVideoRenderer'
import type { SeleneTheiaBridge } from '../../../theia/SeleneTheiaBridge'
import type { AetherCanvasManager } from '../../aether/canvas/AetherCanvasManager'
import type { PixelMapAetherAdapter } from '../../aether/canvas/PixelMapAetherAdapter'
import type { NodeGraph } from '../../aether'

export interface TheiaStageBounds {
  width: number
  height: number
  depth: number
  centerY: number
}

export class TheiaBridgeManager {
  private _theiaVideoRenderer: TheiaVideoRenderer | null = null
  private _seleneThetaBridge: SeleneTheiaBridge | null = null

  constructor(
    private readonly _aetherCanvasManager: AetherCanvasManager,
    private readonly _pixelMapAdapter: PixelMapAetherAdapter,
    private readonly _aetherGraph: NodeGraph,
    private readonly _stageBounds: TheiaStageBounds,
  ) {}

  // ── Theia Video Renderer ────────────────────────────────────────────────

  attachTheiaRenderer(
    canvasId: string,
    thumbPixelSAB: SharedArrayBuffer,
    opts: {
      intensity?: number
      alphaToDimmer?: boolean
    } = {},
  ): void {
    this._theiaVideoRenderer?.stop()
    this._theiaVideoRenderer = new TheiaVideoRenderer(
      canvasId,
      this._aetherCanvasManager,
      thumbPixelSAB,
    )
    this._theiaVideoRenderer.active = true

    const stageRect = {
      x0: -this._stageBounds.width * 0.5,
      z0: -this._stageBounds.depth * 0.5,
      x1:  this._stageBounds.width * 0.5,
      z1:  this._stageBounds.depth * 0.5,
    }
    this._pixelMapAdapter.bindWorldSamplers(
      canvasId,
      {
        intensity: opts.intensity ?? 1.0,
        alphaToDimmer: opts.alphaToDimmer ?? false,
      },
      this._aetherGraph,
      stageRect,
      64,
      64,
    )

    // eslint-disable-next-line no-console
    console.log(`[TheiaBridgeManager 🎬] TheiaVideoRenderer attached (canvasId='${canvasId}')`)
  }

  detachTheiaRenderer(): void {
    if (this._theiaVideoRenderer) {
      this._theiaVideoRenderer.stop()
      const canvasId = this._theiaVideoRenderer.getTelemetry().canvasId
      this._pixelMapAdapter.unbindCanvas(canvasId)
      this._aetherCanvasManager.release(canvasId)
      this._theiaVideoRenderer = null
      // eslint-disable-next-line no-console
      console.log('[TheiaBridgeManager 🎬] TheiaVideoRenderer detached')
    }
  }

  // ── SeleneTheiaBridge ───────────────────────────────────────────────────

  attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void {
    this._seleneThetaBridge = bridge
    // eslint-disable-next-line no-console
    console.log('[TheiaBridgeManager 🌉] SeleneTheiaBridge attached')
  }

  detachSeleneTheiaBridge(): void {
    this._seleneThetaBridge = null
    // eslint-disable-next-line no-console
    console.log('[TheiaBridgeManager 🌉] SeleneTheiaBridge detached')
  }

  // ── Getters for hot-path ────────────────────────────────────────────────

  getTheiaVideoRenderer(): TheiaVideoRenderer | null {
    return this._theiaVideoRenderer
  }

  getSeleneThetaBridge(): SeleneTheiaBridge | null {
    return this._seleneThetaBridge
  }
}
