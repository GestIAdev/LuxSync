/**
 * WAVE 4961 PHASE 6b — HardwareDispatcher
 * Extracted from TitanOrchestrator.ts processFrame Aether egress loop (~lines 2048-2136).
 *
 * Owns: DMX buffer dispatch to HAL, blackout handling, Golden Nuke bypass,
 *       safety telemetry logging, universe egress loop.
 */

import type { NodeResolver, AetherSafetyMiddleware } from '../../aether'
import type { HardwareAbstraction } from '../../../hal/HardwareAbstraction'
import type { StateManager } from '../lifecycle/StateManager'

export interface HardwareDispatcherContext {
  hal: HardwareAbstraction | null
  aetherResolver: NodeResolver | null
  aetherSafety: AetherSafetyMiddleware
  goldenNukeLocks: Map<string, { universe: number; dmxAddress: number }>
  fixtures: any[]
  stateManager: StateManager
  frameCount: number
}

export class HardwareDispatcher {
  constructor(private readonly ctx: HardwareDispatcherContext) {}

  /**
   * WAVE 4557/4681: Dispatch resolved Aether buffers to HAL.
   * Iterates registered universes, applies safety gate, blackout, Golden Nuke,
   * and sends raw DMX buffers to the hardware abstraction layer.
   */
  dispatchEgress(
    blackoutActive: boolean,
    now: number,
    engineAudioMetrics: { bpm: number; beatConfidence: number; isBeat: boolean; energy: number },
    audioBands: { subBass: number; bass: number; mid: number; highMid: number; presence: number; air: number },
    forgeFrameCtx: any,
    deltaMs: number,
    vibeName: string,
  ): void {
    const ctx = this.ctx
    const { hal, aetherResolver, aetherSafety, stateManager } = ctx

    if (!hal || !aetherResolver) return

    // FASE 0: Set frame context + apply output gate
    aetherSafety.setFrameContext(now, vibeName)
    aetherSafety.setOutputEnabled(stateManager._outputEnabled)

    const outputEnabled = stateManager._outputEnabled
    hal.setAetherOutputGateState(outputEnabled, blackoutActive)

    for (const universe of aetherResolver.registeredUniverses) {
      if (!aetherSafety.shouldSendUniverse(universe)) continue
      const rawBuf = aetherResolver.getUniverseBuffer(universe)
      if (!rawBuf) continue

      const egressBuf = blackoutActive
        ? aetherResolver.getSoftBlackoutUniverseBuffer(universe, rawBuf)
        : rawBuf

      // WAVE 4835 — Golden Nuke bypass
      for (const [, lockInfo] of ctx.goldenNukeLocks) {
        if (lockInfo.universe === universe && Array.isArray(egressBuf)) {
          const base = lockInfo.dmxAddress - 1
          egressBuf[base + 1] = 255
          egressBuf[base + 2] = 255
          egressBuf[base + 3] = 255
          egressBuf[base + 4] = 255
          egressBuf[base + 5] = 255
        }
      }

      // WAVE 4832 — DMX Sniffer (disabled)
      if (ctx.frameCount % 30 === 0) {
        const tungstenFixture = (ctx.fixtures as Array<{ name?: string; dmxAddress?: number; address?: number }>)
          .find(f => typeof f.name === 'string' && f.name.toLowerCase().includes('tungsten'))
        if (tungstenFixture) {
          void (tungstenFixture.dmxAddress ?? (tungstenFixture.address ?? 1))
        }
      }

      hal.sendUniverseRaw(universe, egressBuf)

      if (ctx.frameCount % 300 === 0) {
        let byteSum = 0
        for (let _bi = 0; _bi < egressBuf.length; _bi++) byteSum += egressBuf[_bi]
        console.log(
          `[Egress 📤] Universe ${universe} → HAL. ` +
          `Suma bytes: ${byteSum} | ` +
          `outputEnabled: ${outputEnabled} | ` +
          `blackout: ${blackoutActive}`,
        )
      }
    }

    hal.flushAetherEgress()

    // WAVE 4557: Safety telemetry (~1Hz)
    if (ctx.frameCount % 44 === 0) {
      const tel = aetherSafety.consumeTelemetry()
      if (tel.velocityClamps > 0 || tel.airbagHits > 0 || tel.aduanaBlocks > 0 || tel.darkSpinActive > 0) {
        console.log(
          `[AetherAduana 🛂] VelClamp:${tel.velocityClamps} Airbag:${tel.airbagHits} ` +
          `DarkSpin:${tel.darkSpinActive} AduanaGate:${tel.aduanaBlocks}`,
        )
      }
    }
  }
}
