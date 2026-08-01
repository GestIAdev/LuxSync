/**
 * WAVE 4960.1 PHASE 5a — FixtureHydrationEngine
 * Extracted from TitanOrchestrator.ts (~lines 492-613, 615-658, 665-700, 2816-2973).
 *
 * Owns: setFixtures(), _syncFixturesToAether(), registerAetherDevice(),
 *       unregisterAetherDevice(), _ensureAetherMatrixInitialized(),
 *       _refreshAetherMoverShieldMap().
 *
 * Injected with a HydrationContext that exposes all mutable orchestrator fields
 * this engine needs to read/write during fixture hydration.
 */

import { NodeArbiter, NodeResolver, NodeFamily, LiquidImpactAdapter, VMMAdapter } from '../../aether'
import type { NodeGraph, PhysicsPostProcessor, IntentBus } from '../../aether'
import type { IDeviceDefinition } from '../../aether'
import { ForgeGraphCompiler } from '../../forge/compiler/ForgeGraphCompiler'
import type { IForgeNodeGraph } from '../../forge/types'
import { NodeExtractionPipeline } from '../../aether/ingestion/NodeExtractionPipeline'
import { SeleneAetherAdapter } from '../../aether/adapters/selene-aether-adapter'
import { ZoneNodeRouter } from '../../aether/adapters/helpers/zone-node-router'
import { ColorAdapter } from '../../aether/adapters/ColorAdapter'
import { BeamAdapter } from '../../aether/adapters/BeamAdapter'
import { AtmosphereAdapter } from '../../aether/adapters/AtmosphereAdapter'
import { LiquidAetherAdapter } from '../../aether/adapters/LiquidAetherAdapter'
import { ChronosAetherAdapter } from '../../aether/adapters/ChronosAetherAdapter'
import { AetherSafetyMiddleware } from '../../aether/egress/AetherSafetyMiddleware'
import type { HardwareAbstraction } from '../../../hal/HardwareAbstraction'
import type { TacticalLogManager } from '../logging/TacticalLogManager'
import type { StateManager } from '../lifecycle/StateManager'
import type { VibeLifecycleManager } from '../lifecycle/VibeLifecycleManager'
import { FixtureProfileResolver } from './FixtureProfileResolver'
import { StageBoundsManager } from './StageBoundsManager'
import type { StageBoundsInput } from './StageBoundsManager'
import type { FixtureDefinition, FixtureChannel } from '../../../types/FixtureDefinition'

// ── Local helper ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectLiquidLayoutFromFixtures(fixtures: any[]): '4.1' | '7.1' {
  const frontBackPars = fixtures.filter(f =>
    (f.zone === 'front' || f.zone === 'back') &&
    (f.type === 'par' || f.model?.toLowerCase?.().includes('par') || f.name?.toLowerCase?.().includes('par'))
  )

  if (frontBackPars.length < 2) {
    return '4.1'
  }

  const byZone: { [key: string]: number[] } = {}
  for (const f of frontBackPars) {
    const zone = f.zone
    if (!byZone[zone]) byZone[zone] = []
    const x = f.position?.x ?? 0
    byZone[zone].push(x)
  }

  for (const zone in byZone) {
    const xs = byZone[zone]
    const hasLeft = xs.some(x => x < -0.1)
    const hasRight = xs.some(x => x > 0.1)
    if (hasLeft && hasRight) {
      return '7.1'
    }
  }

  return '4.1'
}

// ── Hydration Context ──────────────────────────────────────────────────────
/**
 * Mutable context injected by TitanOrchestrator.
 * FixtureHydrationEngine reads/writes these fields during hydration.
 */
export interface HydrationContext {
  aetherGraph: NodeGraph
  aetherArbiter: NodeArbiter | null
  aetherResolver: NodeResolver | null
  aetherPipeline: NodeExtractionPipeline | null
  aetherHasDevices: boolean
  physicsPostProcessor: PhysicsPostProcessor
  aetherSafety: AetherSafetyMiddleware
  chronosAetherAdapter: ChronosAetherAdapter
  colorAdapter: ColorAdapter | null
  kineticAdapter: InstanceType<typeof VMMAdapter> | null
  beamAdapter: BeamAdapter | null
  atmosphereAdapter: AtmosphereAdapter | null
  liquidAetherAdapter: LiquidAetherAdapter | null
  seleneAetherAdapter: SeleneAetherAdapter | null
  zoneNodeRouter: ZoneNodeRouter | null
  hal: HardwareAbstraction | null
  logManager: TacticalLogManager
  stateManager: StateManager
  vibeManager: VibeLifecycleManager
  fixtures: any[]
  profileResolver: FixtureProfileResolver
  stageBoundsManager: StageBoundsManager
  seleneBus: IntentBus
}

export class FixtureHydrationEngine {
  private readonly ctx: HydrationContext

  constructor(ctx: HydrationContext) {
    this.ctx = ctx
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * WAVE 252: Set fixtures from ConfigManager (real data, no mocks)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFixtures(fixtures: any[], stageBounds?: StageBoundsInput): '4.1' | '7.1' {
    const ctx = this.ctx

    ctx.fixtures = fixtures.map(f => ({
      ...f,
      dmxAddress: f.dmxAddress || f.address,
      isVirtual: f.isVirtual ?? false,
    }))

    ctx.stageBoundsManager.updateStageBounds(stageBounds, ctx.fixtures)

    if (ctx.hal) {
      ctx.hal.invalidateProfileCache()
    }

    const detectedLayout = detectLiquidLayoutFromFixtures(ctx.fixtures)
    ctx.vibeManager.setLiquidLayout(detectedLayout)

    let moverCount = 0
    for (const fixture of fixtures) {
      if (fixture.hasMovementChannels) {
        if (fixture.isPlaced === false) {
          continue
        }
        if (ctx.hal) {
          const installOrientation = fixture.orientation || fixture.installationType || 'ceiling'
          ctx.hal.registerMover(fixture.id, installOrientation)
          moverCount++
        }
      }
    }
    void moverCount

    this._syncFixturesToAether(ctx.fixtures)

    return detectedLayout
  }

  /**
   * Registra un dispositivo en el Motor Agnostico Aether (WAVE 3505.4).
   */
  public registerAetherDevice(definition: IDeviceDefinition, forgeGraph?: IForgeNodeGraph): void {
    const ctx = this.ctx
    this._ensureAetherMatrixInitialized()

    const resolver = ctx.aetherResolver
    if (!resolver) {
      ctx.logManager.log('Error', '[Aether] Lazy-init failure: NodeResolver unavailable')
      return
    }

    const nodeIds = ctx.aetherGraph.registerDevice(definition)
    ctx.chronosAetherAdapter.rebuildNodeIndex()
    resolver.registerUniverse(definition.universe)
    resolver.registerDevice(definition.deviceId)
    ctx.aetherHasDevices = true

    for (const nodeId of nodeIds) {
      const nodeData = ctx.aetherGraph.getNodeData(nodeId)
      if (nodeData?.family === NodeFamily.KINETIC) {
        ctx.physicsPostProcessor.registerNode(nodeId)
        ctx.aetherSafety.registerKineticNode(nodeId)
      }
    }

    ctx.aetherSafety.registerDevice(
      definition.deviceId, definition.universe, definition.isVirtual ?? false,
    )

    if (forgeGraph && forgeGraph.nodes.length > 0) {
      try {
        const compiled = ForgeGraphCompiler.compile(forgeGraph, definition.deviceId)
        resolver.registerForgeGraph(definition.deviceId, compiled)
        ctx.logManager.log('Info', `[Forge] Compiled graph for device ${definition.deviceId}: ${forgeGraph.nodes.length} nodes, ${compiled.program.length} instructions`)
      } catch (err) {
        ctx.logManager.log('Error', `[Forge] Failed to compile graph for device ${definition.deviceId}: ${err}`)
      }
    }

    this._refreshAetherMoverShieldMap()
  }

  /**
   * Retira un dispositivo del Motor Agnostico Aether.
   */
  public unregisterAetherDevice(deviceId: string): void {
    this.ctx.aetherGraph.unregisterDevice(deviceId as import('../../aether/types').DeviceId)
    this._refreshAetherMoverShieldMap()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE — Aether Matrix Init
  // ═══════════════════════════════════════════════════════════════════════════

  public ensureAetherMatrixInitialized(): void {
    this._ensureAetherMatrixInitialized()
  }

  private _ensureAetherMatrixInitialized(): void {
    const ctx = this.ctx
    if (
      ctx.aetherArbiter &&
      ctx.aetherResolver &&
      ctx.colorAdapter &&
      ctx.kineticAdapter &&
      ctx.beamAdapter &&
      ctx.atmosphereAdapter &&
      ctx.liquidAetherAdapter &&
      ctx.seleneAetherAdapter
    ) {
      return
    }

    if (!ctx.aetherArbiter) {
      ctx.aetherArbiter = new NodeArbiter()
      // WAVE 4663 PASO 1: Conectar el bus L1 de Selene al Arbiter.
      // El bus es una referencia fija — se limpia y rellena cada frame.
      // NOTE: _seleneBus is still on TitanOrchestrator; we access it via a workaround.
      // The orchestrator wires this after construction.
    }
    if (!ctx.aetherResolver) {
      ctx.aetherResolver = new NodeResolver(ctx.aetherGraph)
      ctx.aetherResolver.setSafetyMiddleware(ctx.aetherSafety)
      ctx.aetherResolver.registerUniverse(0)
    }
    ctx.colorAdapter = ctx.colorAdapter ?? new ColorAdapter()
    ctx.kineticAdapter = ctx.kineticAdapter ?? new VMMAdapter()
    ctx.beamAdapter = ctx.beamAdapter ?? new BeamAdapter()
    ctx.atmosphereAdapter = ctx.atmosphereAdapter ?? new AtmosphereAdapter()
    ctx.liquidAetherAdapter = ctx.liquidAetherAdapter ?? new LiquidAetherAdapter(ctx.aetherGraph)

    if (!ctx.zoneNodeRouter) {
      ctx.zoneNodeRouter = new ZoneNodeRouter(ctx.aetherGraph)
    }
    ctx.seleneAetherAdapter = ctx.seleneAetherAdapter ?? new SeleneAetherAdapter(ctx.zoneNodeRouter)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE — Mover Shield
  // ═══════════════════════════════════════════════════════════════════════════

  private _refreshAetherMoverShieldMap(): void {
    const ctx = this.ctx
    const arbiter = ctx.aetherArbiter
    if (!arbiter) {
      return
    }

    const moverDeviceIds = new Set<string>()
    const kineticView = ctx.aetherGraph.getView(NodeFamily.KINETIC)
    kineticView.forEach((node) => {
      if (!node.isContinuous) {
        moverDeviceIds.add(node.deviceId)
      }
    })

    const protectedColorNodes: string[] = []
    const moverColorNodeIds: string[] = []
    const colorView = ctx.aetherGraph.getView(NodeFamily.COLOR)
    colorView.forEach((node) => {
      const hasPhysicalWheel = node.colorWheel !== undefined || node.mixingType === 'wheel' || node.mixingType === 'hybrid'
      if (moverDeviceIds.has(node.deviceId)) {
        moverColorNodeIds.push(node.nodeId)
        if (hasPhysicalWheel) {
          protectedColorNodes.push(node.nodeId)
        }
      }
    })

    arbiter.setMoverShieldNodeIds(protectedColorNodes)

    if (ctx.colorAdapter) {
      ctx.colorAdapter.setMoverNodeIds(moverColorNodeIds)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE — Aether Sync
  // ═══════════════════════════════════════════════════════════════════════════

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _syncFixturesToAether(fixtures: any[]): void {
    const ctx = this.ctx

    if (!ctx.aetherPipeline) {
      ctx.aetherPipeline = new NodeExtractionPipeline()
    }
    const pipeline = ctx.aetherPipeline

    // F4: ATOMIC AETHER SWAP
    // Phase 1 — Build all new device definitions in a staging array WITHOUT touching
    // the live graph. The graph stays intact (old show) while we resolve profiles.
    // This is the expensive / failure-prone part; isolating it keeps the swap window tiny.
    type StagedDevice = { deviceDef: IDeviceDefinition; forgeGraph: IForgeNodeGraph | undefined }
    const staged: StagedDevice[] = []

    for (const fixture of fixtures) {
      if (!fixture.id) continue
      try {
        let definition = ctx.profileResolver.resolveFixtureDefinitionForAether(fixture)

        // 🧩 COMPOUND FIXTURE: ensure internal channel graph reaches NodeExtractionPipeline.
        // The fixture may declare its wiring via forgeGraph (frontend) or nodeGraph (profile JSON).
        const fixtureGraph = (fixture as any).forgeGraph ?? (fixture as any).nodeGraph
        if (fixtureGraph && definition) {
          (definition as any).nodeGraph = fixtureGraph
        }

        if (!definition || definition.channels.length === 0) {
          const profileId = ctx.profileResolver.resolveFixtureProfileId(fixture)
          if (!profileId && !fixture.profileId && !fixture.id) continue
          const minimalDimmerChannel: FixtureChannel = {
            index: 1,
            name: 'Dimmer',
            type: 'dimmer',
            defaultValue: 0,
            is16bit: false,
          }
          definition = {
            id: profileId ?? fixture.id,
            name: fixture.name ?? fixture.id ?? 'Unknown Fixture',
            manufacturer: fixture.manufacturer ?? 'Unknown',
            type: ctx.profileResolver.normalizeFixtureType(fixture.type),
            channels: [minimalDimmerChannel],
            physics: fixture.physics,
            capabilities: fixture.capabilities,
            wheels: fixture.wheels,
            nodeGraph: fixtureGraph, // 🧩 COMPOUND FIXTURE: preserve internal channel graph
          } as FixtureDefinition
          console.warn(
            `[FixtureHydrationEngine] ⚡ WAVE 4610-B: Fixture "${fixture.id}" sin perfil resuelto — inyectando definición mínima (dimmer)`,
          )
        }

        const fixtureV2 = ctx.profileResolver.buildFixtureV2ForAether(fixture, definition)

        // GovernorEngine DIAG logs silenced — fires per-fixture on every setFixtures

        const deviceDef = pipeline.extract(definition, fixtureV2)
        const forgeGraph: IForgeNodeGraph | undefined = fixture.forgeGraph ?? (fixture as any).nodeGraph ?? undefined
        staged.push({ deviceDef, forgeGraph })
      } catch (err) {
        console.warn(
          `[FixtureHydrationEngine] ⚡ WAVE 4594: Aether sync SKIPPED fixture "${fixture.id}" ` +
          `(type="${fixture.type ?? '?'}", name="${fixture.name ?? '?'}"):`, err,
        )
      }
    }

    // Phase 2 — Atomic swap: unregister ALL old devices then immediately register
    // ALL new ones. The window where the graph is empty is now as short as possible
    // (two tight synchronous loops). TickEngine cannot observe this gap because the
    // _isHydrating flag from F2 blocks tick() for the entire setFixtures call.
    const existingIds = [...ctx.aetherGraph.getDeviceIds()]
    for (const deviceId of existingIds) {
      ctx.aetherGraph.unregisterDevice(deviceId)
    }
    ctx.aetherHasDevices = false

    let registered = 0
    for (const { deviceDef, forgeGraph } of staged) {
      this.registerAetherDevice(deviceDef, forgeGraph)
      registered++
    }

    ctx.zoneNodeRouter = new ZoneNodeRouter(ctx.aetherGraph)
    ctx.seleneAetherAdapter = new SeleneAetherAdapter(ctx.zoneNodeRouter)

    void registered
  }
}
