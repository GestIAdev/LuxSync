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
import { NodeArbiter, NodeResolver, NodeFamily, VMMAdapter } from '../../aether';
import { ForgeGraphCompiler } from '../../forge/compiler/ForgeGraphCompiler';
import { NodeExtractionPipeline } from '../../aether/ingestion/NodeExtractionPipeline';
import { SeleneAetherAdapter } from '../../aether/adapters/selene-aether-adapter';
import { ZoneNodeRouter } from '../../aether/adapters/helpers/zone-node-router';
import { ColorAdapter } from '../../aether/adapters/ColorAdapter';
import { BeamAdapter } from '../../aether/adapters/BeamAdapter';
import { AtmosphereAdapter } from '../../aether/adapters/AtmosphereAdapter';
// 🚨 WAVE 7737: THE QUARANTINE — driver activo de ATMOSPHERE (4Hz, bus L3).
// AtmosphereAdapter se mantiene instanciado (línea abajo) pero ya no se
// invoca desde el hot path de TickEngine — ver ese archivo.
import { AtmosphereCueDriver } from '../../aether/atmosphere/AtmosphereCueDriver';
import { LiquidAetherAdapter } from '../../aether/adapters/LiquidAetherAdapter';
import { KineticStateStore } from '../../aether/KineticStateStore';
import { aetherKineticEngine } from '../../aether/AetherKineticEngine';
// 🌫️ WAVE 8416: canal mínimo por tipo cuando no hay perfil resuelto.
// Los ingenios obtienen su actuador real — nunca 'dimmer' (nodo IMPACT
// fantasma: pulso rítmico en canvas + escritura DMX en el slot de la bomba).
const MINIMAL_CHANNEL_FOR_TYPE = {
    'fog': { type: 'smoke_pump', name: 'Smoke Pump' },
    'pyro': { type: 'fire_valve', name: 'Fire Valve' },
    'mirror-ball': { type: 'rotation', name: 'Rotation' },
    'fan': { type: 'fan_speed', name: 'Fan Speed' },
    'generic': { type: 'dimmer', name: 'Dimmer' },
};
// ── Local helper ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectLiquidLayoutFromFixtures(fixtures) {
    const frontBackPars = fixtures.filter(f => (f.zone === 'front' || f.zone === 'back') &&
        (f.type === 'par' || f.model?.toLowerCase?.().includes('par') || f.name?.toLowerCase?.().includes('par')));
    if (frontBackPars.length < 2) {
        return '4.1';
    }
    const byZone = {};
    for (const f of frontBackPars) {
        const zone = f.zone;
        if (!byZone[zone])
            byZone[zone] = [];
        const x = f.position?.x ?? 0;
        byZone[zone].push(x);
    }
    for (const zone in byZone) {
        const xs = byZone[zone];
        const hasLeft = xs.some(x => x < -0.1);
        const hasRight = xs.some(x => x > 0.1);
        if (hasLeft && hasRight) {
            return '7.1';
        }
    }
    return '4.1';
}
export class FixtureHydrationEngine {
    constructor(ctx) {
        /**
         * 🧠 WAVE 8271: store persistente del estado cinético explícito del operador,
         * indexado por deviceId. Sobrevive a los repatches en caliente — los maps
         * del arbiter/engine lo espejan por referencia (gesture time only).
         * Ver docs/technical_audits/KINETIC_STATE_DEHYDRATION_AUDIT.md.
         */
        this._kineticStore = new KineticStateStore();
        this.ctx = ctx;
    }
    /** WAVE 8271: exposición del store para tests/IPC (read-only view). */
    get kineticStateStore() {
        return this._kineticStore;
    }
    /** Cableado idempotente del store a los subsystems L2 (patch-time only). */
    _ensureStoreWired() {
        if (this.ctx.aetherArbiter) {
            this.ctx.aetherArbiter.setKineticStateStore(this._kineticStore);
        }
        aetherKineticEngine.setKineticStateStore(this._kineticStore);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * WAVE 252: Set fixtures from ConfigManager (real data, no mocks)
     * WAVE 8271: `options.isShowLoad` distingue carga de show (wipe total)
     * de patch delta en caliente (estado cinético preservado por deviceId).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFixtures(fixtures, stageBounds, options) {
        const ctx = this.ctx;
        this._ensureStoreWired();
        if (options?.isShowLoad) {
            // Carga de show real — wipe del store persistente además de la
            // purga L2 que TitanOrchestrator ejecuta vía purgeForShow().
            this._kineticStore.clear();
        }
        ctx.fixtures = fixtures.map(f => ({
            ...f,
            // WAVE 7729: Prefer `address` (user-corrected via Auto-Patch) over
            // `dmxAddress` (may contain stale auto-generated values from the
            // constructor's old `fixtureCount * 4 + 1` formula). If `address` is
            // present and differs from `dmxAddress`, `address` wins — it's the
            // field the Visual Patcher and Auto-Patch write to.
            dmxAddress: (f.address != null ? f.address : f.dmxAddress) || 0,
            isVirtual: f.isVirtual ?? false,
        }));
        ctx.stageBoundsManager.updateStageBounds(stageBounds, ctx.fixtures);
        if (ctx.hal) {
            ctx.hal.invalidateProfileCache();
            // WAVE 7728: Purge DMX worker buffers + universe buffers on show change.
            // Without this, residual DMX values from the previous show persist in the
            // OpenDMX worker's child process buffer and bleed into the new show's fixtures.
            ctx.hal.purgeShowState();
        }
        const detectedLayout = detectLiquidLayoutFromFixtures(ctx.fixtures);
        ctx.vibeManager.setLiquidLayout(detectedLayout);
        let moverCount = 0;
        for (const fixture of fixtures) {
            if (fixture.hasMovementChannels) {
                if (fixture.isPlaced === false) {
                    continue;
                }
                if (ctx.hal) {
                    const installOrientation = fixture.orientation || fixture.installationType || 'ceiling';
                    ctx.hal.registerMover(fixture.id, installOrientation);
                    moverCount++;
                }
            }
        }
        void moverCount;
        this._syncFixturesToAether(ctx.fixtures);
        return detectedLayout;
    }
    /**
     * Registra un dispositivo en el Motor Agnostico Aether (WAVE 3505.4).
     */
    registerAetherDevice(definition, forgeGraph) {
        const ctx = this.ctx;
        this._ensureAetherMatrixInitialized();
        const resolver = ctx.aetherResolver;
        if (!resolver) {
            ctx.logManager.log('Error', '[Aether] Lazy-init failure: NodeResolver unavailable');
            return;
        }
        const nodeIds = ctx.aetherGraph.registerDevice(definition);
        ctx.chronosAetherAdapter.rebuildNodeIndex();
        resolver.registerUniverse(definition.universe);
        resolver.registerDevice(definition.deviceId);
        ctx.aetherHasDevices = true;
        for (const nodeId of nodeIds) {
            const nodeData = ctx.aetherGraph.getNodeData(nodeId);
            if (nodeData?.family === NodeFamily.KINETIC) {
                ctx.physicsPostProcessor.registerNode(nodeId);
                ctx.aetherSafety.registerKineticNode(nodeId);
            }
        }
        ctx.aetherSafety.registerDevice(definition.deviceId, definition.universe, definition.isVirtual ?? false);
        // 🧠 WAVE 8271 — KINETIC REHYDRATION: antes de que el device entre al
        // tick pipeline, re-inyectar cualquier estado mecánico guardado
        // (overrides manuales, target espacial, patrón L2, inhibit limit, locks,
        // posición física capturada pre-unregister). No-op para devices nuevos.
        this._rehydrateKineticState(definition.deviceId, nodeIds);
        if (forgeGraph && forgeGraph.nodes.length > 0) {
            try {
                const compiled = ForgeGraphCompiler.compile(forgeGraph, definition.deviceId);
                resolver.registerForgeGraph(definition.deviceId, compiled);
                ctx.logManager.log('Info', `[Forge] Compiled graph for device ${definition.deviceId}: ${forgeGraph.nodes.length} nodes, ${compiled.program.length} instructions`);
            }
            catch (err) {
                ctx.logManager.log('Error', `[Forge] Failed to compile graph for device ${definition.deviceId}: ${err}`);
            }
        }
        this._refreshAetherMoverShieldMap();
        this._refreshAetherNodeFixtureMap();
    }
    /**
     * Retira un dispositivo del Motor Agnostico Aether.
     * WAVE 8271: exorcismo completo — el device desaparece del grafo Y de
     * todos los subsistemas que cacheaban su estado (leak de WAVE 8270-RECON).
     */
    unregisterAetherDevice(deviceId) {
        this._exorcizeDevice(deviceId);
        this._refreshAetherMoverShieldMap();
        this._refreshAetherNodeFixtureMap();
    }
    /**
     * 🧹 WAVE 8271 — EXORCISMO POR DEVICE: purga el estado de un deviceId que
     * fue REALMENTE eliminado del patch (no presente en el staged set).
     *
     * Orden: capturar nodeIds antes de unregisterDevice (el grafo los olvida
     * permanentemente), luego limpiar grafo → arbiter → PPP → safety →
     * resolver → kinetic engine → store.
     *
     * PATCH TIME — nunca en hot path.
     */
    _exorcizeDevice(deviceId) {
        const ctx = this.ctx;
        const nodeIds = ctx.aetherGraph.getDeviceNodes(deviceId);
        ctx.aetherGraph.unregisterDevice(deviceId);
        ctx.aetherArbiter?.purgeForDevice(deviceId);
        for (const nodeId of nodeIds) {
            ctx.physicsPostProcessor.unregisterNode(nodeId);
        }
        ctx.aetherSafety.unregisterDevice(deviceId, nodeIds);
        ctx.aetherResolver?.unregisterDevice(deviceId, nodeIds);
        if (ctx.aetherArbiter) {
            aetherKineticEngine.unregisterDevice(deviceId, ctx.aetherArbiter);
        }
        this._kineticStore.deleteDevice(deviceId);
    }
    /**
     * 🧠 WAVE 8271 — SNAPSHOT PRE-UNREGISTER: captura la posición física clásica
     * (pan/tilt) de los nodos KINETIC de un device SUPERVIVIENTE justo antes de
     * que sus nodeIds mueran en el swap. El store los devuelve en rehydrate
     * para sembrar el PhysicsPostProcessor del nodo renombrado/reconstruido.
     */
    _captureDeviceKineticSnapshot(deviceId) {
        const ctx = this.ctx;
        for (const nodeId of ctx.aetherGraph.getDeviceNodes(deviceId)) {
            const nodeData = ctx.aetherGraph.getNodeData(nodeId);
            if (nodeData?.family !== NodeFamily.KINETIC)
                continue;
            const pos = ctx.physicsPostProcessor.getClassicPosition(nodeId);
            if (pos)
                this._kineticStore.capturePosition(nodeId, pos.pan, pos.tilt);
        }
    }
    /**
     * 🧠 WAVE 8271 — KINETIC REHYDRATION.
     *
     * Consulta el KineticStateStore por deviceId y re-inyecta el estado guardado
     * en los subsistemas vivos del device recién registrado:
     *   - manualChannels → NodeArbiter.setManualOverride (gobos, prismas, focus,
     *     anchors radar, rotación continua).
     *   - motorOverride  → NodeArbiter.setMotorKineticOverride (targetX/Y/Z IK).
     *   - spatialCoupled/distanceScale → locks espaciales del apuntado radar.
     *   - inhibitLimit   → cap L2.5 de intensidad.
     *   - pattern        → AetherKineticEngine.restoreNodeConfig (pista L2 viva).
     *   - lastPan/lastTilt → PhysicsPostProcessor.seedClassicState (continuidad
     *     mecánica — el primer frame NO teleporta a home).
     *
     * GUARDAS: solo se inyecta si el subsistema NO tiene ya un estado vivo
     * (el estado en vivo siempre gana — el store es solo el respaldo de
     * reconstrucción, nunca pisa una escritura más reciente del operador).
     * NodeIds guardados que ya no existen en la nueva definición se descartan
     * del store (fixture re-configurado — no resucitar canales zombis).
     */
    _rehydrateKineticState(deviceId, nodeIds) {
        const ctx = this.ctx;
        const arbiter = ctx.aetherArbiter;
        if (!arbiter)
            return;
        const saved = this._kineticStore.getDevice(deviceId);
        if (!saved || saved.size === 0)
            return;
        const liveNodeSet = new Set(nodeIds);
        for (const [nodeId, st] of saved) {
            if (!liveNodeSet.has(nodeId)) {
                // Nodo que desapareció en la nueva definición — limpiar el store y
                // cualquier resto vivo que pudiera quedar en el arbiter.
                this._kineticStore.deleteNode(nodeId);
                arbiter.clearManualOverride(nodeId);
                arbiter.clearMotorKineticOverride(nodeId);
                continue;
            }
            // ── L2 manual channels (gobos, prism, focus, radar anchors, rotation) ──
            if (st.manualChannels && !arbiter.getManualOverride(nodeId)) {
                arbiter.setManualOverride(nodeId, st.manualChannels);
            }
            // ── Motor kinetic override (spatial targetX/Y/Z, pan_base/tilt_base) ──
            if (st.motorOverride && !arbiter.getMotorKineticOverride(nodeId)) {
                arbiter.setMotorKineticOverride(nodeId, st.motorOverride);
            }
            // ── Locks espaciales (protección del apuntado radar contra L0/L2 clásico)
            if (st.spatialCoupled && !arbiter.isSpatialCoupledLocked(nodeId)) {
                arbiter.setSpatialCoupledLock([nodeId]);
            }
            if (st.distanceScale !== null && st.distanceScale !== undefined) {
                arbiter.setSpatialDistanceScale(nodeId, st.distanceScale);
            }
            // ── Inhibit limit (cap de intensidad por nodo)
            if (st.inhibitLimit !== null && st.inhibitLimit !== undefined) {
                arbiter.setInhibitLimit(nodeId, st.inhibitLimit);
            }
            // ── Manual pattern lock
            if (st.patternLock) {
                arbiter.setManualPatternLock([nodeId]);
            }
            // ── Pista L2 del motor cinético (rotación continua, círculos, fans)
            if (st.pattern) {
                aetherKineticEngine.restoreNodeConfig(nodeId, st.pattern, arbiter);
            }
            // ── Semilla de posición física (continuidad mecánica, cero teleport)
            if (Number.isFinite(st.lastPan) && Number.isFinite(st.lastTilt)) {
                ctx.physicsPostProcessor.seedClassicState(nodeId, st.lastPan, st.lastTilt);
            }
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Aether Matrix Init
    // ═══════════════════════════════════════════════════════════════════════════
    ensureAetherMatrixInitialized() {
        this._ensureAetherMatrixInitialized();
    }
    _ensureAetherMatrixInitialized() {
        const ctx = this.ctx;
        if (ctx.aetherArbiter &&
            ctx.aetherResolver &&
            ctx.colorAdapter &&
            ctx.kineticAdapter &&
            ctx.beamAdapter &&
            ctx.atmosphereAdapter &&
            ctx.atmosphereCueDriver &&
            ctx.liquidAetherAdapter &&
            ctx.seleneAetherAdapter) {
            return;
        }
        if (!ctx.aetherArbiter) {
            ctx.aetherArbiter = new NodeArbiter();
            // WAVE 4663 PASO 1: Conectar el bus L1 de Selene al Arbiter.
            // El bus es una referencia fija — se limpia y rellena cada frame.
            // NOTE: _seleneBus is still on TitanOrchestrator; we access it via a workaround.
            // The orchestrator wires this after construction.
        }
        if (!ctx.aetherResolver) {
            ctx.aetherResolver = new NodeResolver(ctx.aetherGraph);
            ctx.aetherResolver.setSafetyMiddleware(ctx.aetherSafety);
            ctx.aetherResolver.registerUniverse(0);
        }
        ctx.colorAdapter = ctx.colorAdapter ?? new ColorAdapter();
        ctx.kineticAdapter = ctx.kineticAdapter ?? new VMMAdapter();
        ctx.beamAdapter = ctx.beamAdapter ?? new BeamAdapter();
        ctx.atmosphereAdapter = ctx.atmosphereAdapter ?? new AtmosphereAdapter();
        // 🚨 WAVE 7737: THE QUARANTINE — driver activo, invocado desde TickEngine
        // en lugar de atmosphereAdapter. Ver comentario en import.
        ctx.atmosphereCueDriver = ctx.atmosphereCueDriver ?? new AtmosphereCueDriver();
        ctx.liquidAetherAdapter = ctx.liquidAetherAdapter ?? new LiquidAetherAdapter(ctx.aetherGraph);
        if (!ctx.zoneNodeRouter) {
            ctx.zoneNodeRouter = new ZoneNodeRouter(ctx.aetherGraph);
        }
        ctx.seleneAetherAdapter = ctx.seleneAetherAdapter ?? new SeleneAetherAdapter(ctx.zoneNodeRouter);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Mover Shield
    // ═══════════════════════════════════════════════════════════════════════════
    _refreshAetherMoverShieldMap() {
        const ctx = this.ctx;
        const arbiter = ctx.aetherArbiter;
        if (!arbiter) {
            return;
        }
        const moverDeviceIds = new Set();
        const kineticView = ctx.aetherGraph.getView(NodeFamily.KINETIC);
        kineticView.forEach((node) => {
            if (!node.isContinuous) {
                moverDeviceIds.add(node.deviceId);
            }
        });
        const protectedColorNodes = [];
        const moverColorNodeIds = [];
        const colorView = ctx.aetherGraph.getView(NodeFamily.COLOR);
        colorView.forEach((node) => {
            const hasPhysicalWheel = node.colorWheel !== undefined || node.mixingType === 'wheel' || node.mixingType === 'hybrid';
            if (moverDeviceIds.has(node.deviceId)) {
                moverColorNodeIds.push(node.nodeId);
                if (hasPhysicalWheel) {
                    protectedColorNodes.push(node.nodeId);
                }
            }
        });
        arbiter.setMoverShieldNodeIds(protectedColorNodes);
        if (ctx.colorAdapter) {
            ctx.colorAdapter.setMoverNodeIds(moverColorNodeIds);
        }
    }
    /**
     * WAVE 7790: Reconstruye el mapa nodeId → fixtureId (deviceId) para el NodeArbiter.
     * Iterera todas las familias del NodeGraph y registra cada nodo.
     * Permite que el escudo WAVE 4713 (_manualDimmerFixtureIds) reconozca
     * Cell Node IDs modernos (ej: "impact-20") que no contienen ':'.
     * Patch-time only — costo 0 en hot-path.
     */
    _refreshAetherNodeFixtureMap() {
        const ctx = this.ctx;
        const arbiter = ctx.aetherArbiter;
        if (!arbiter || !ctx.aetherGraph) {
            return;
        }
        const nodeFixtureMap = new Map();
        const families = [
            NodeFamily.IMPACT,
            NodeFamily.COLOR,
            NodeFamily.KINETIC,
            NodeFamily.BEAM,
            NodeFamily.ATMOSPHERE,
        ];
        for (let fi = 0; fi < families.length; fi++) {
            const view = ctx.aetherGraph.getView(families[fi]);
            view.forEach((node) => {
                nodeFixtureMap.set(node.nodeId, node.deviceId);
            });
        }
        arbiter.setNodeFixtureMap(nodeFixtureMap);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE — Aether Sync
    // ═══════════════════════════════════════════════════════════════════════════
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _syncFixturesToAether(fixtures) {
        const ctx = this.ctx;
        if (!ctx.aetherPipeline) {
            ctx.aetherPipeline = new NodeExtractionPipeline();
        }
        const pipeline = ctx.aetherPipeline;
        const staged = [];
        for (const fixture of fixtures) {
            if (!fixture.id)
                continue;
            try {
                let definition = ctx.profileResolver.resolveFixtureDefinitionForAether(fixture);
                // 🧩 COMPOUND FIXTURE: ensure internal channel graph reaches NodeExtractionPipeline.
                // The fixture may declare its wiring via forgeGraph (frontend) or nodeGraph (profile JSON).
                const fixtureGraph = fixture.forgeGraph ?? fixture.nodeGraph;
                if (fixtureGraph && definition) {
                    definition.nodeGraph = fixtureGraph;
                }
                if (!definition || definition.channels.length === 0) {
                    const profileId = ctx.profileResolver.resolveFixtureProfileId(fixture);
                    if (!profileId && !fixture.profileId && !fixture.id)
                        continue;
                    const normalizedType = ctx.profileResolver.normalizeFixtureType(fixture.type);
                    // 🌫️ WAVE 8416: los ingenios atmosféricos NUNCA reciben
                    // 'dimmer' sintético — un nodo IMPACT fantasma proyecta
                    // telemetría rítmica al canvas y escribe el byte DMX de la
                    // bomba/válvula (puerta trasera del bug de WAVE 8413).
                    const minimalChannel = {
                        index: 1,
                        ...(MINIMAL_CHANNEL_FOR_TYPE[normalizedType] ?? MINIMAL_CHANNEL_FOR_TYPE.generic),
                        defaultValue: 0,
                        is16bit: false,
                    };
                    definition = {
                        id: profileId ?? fixture.id,
                        name: fixture.name ?? fixture.id ?? 'Unknown Fixture',
                        manufacturer: fixture.manufacturer ?? 'Unknown',
                        type: normalizedType,
                        channels: [minimalChannel],
                        physics: fixture.physics,
                        capabilities: fixture.capabilities,
                        wheels: fixture.wheels,
                        nodeGraph: fixtureGraph, // 🧩 COMPOUND FIXTURE: preserve internal channel graph
                    };
                    console.warn(`[FixtureHydrationEngine] ⚡ WAVE 4610-B: Fixture "${fixture.id}" sin perfil resuelto — inyectando definición mínima (${minimalChannel.type})`);
                }
                const fixtureV2 = ctx.profileResolver.buildFixtureV2ForAether(fixture, definition);
                // GovernorEngine DIAG logs silenced — fires per-fixture on every setFixtures
                const deviceDef = pipeline.extract(definition, fixtureV2);
                const forgeGraph = fixture.forgeGraph ?? fixture.nodeGraph ?? undefined;
                staged.push({ deviceDef, forgeGraph });
            }
            catch (err) {
                console.warn(`[FixtureHydrationEngine] ⚡ WAVE 4594: Aether sync SKIPPED fixture "${fixture.id}" ` +
                    `(type="${fixture.type ?? '?'}", name="${fixture.name ?? '?'}"):`, err);
            }
        }
        // Phase 2 — WAVE 8271: DEVICE-SCOPED RECONCILIATION (reemplaza el swap nuclear).
        //
        // Antes: unregisterDevice() para TODOS + purgeForShow() global → la
        // "deshidratación cinética" (WAVE 8270-RECON) borraba el estado L2 de
        // devices que ni siquiera cambiaron.
        //
        // Ahora, por cada device existente:
        //   • Si sigue en el patch (deviceId estable) → SUPERVIVIENTE: capturamos
        //     su posición física en el KineticStateStore, desregistramos y
        //     re-registramos (def puede haber cambiado). Sus nodeIds se regeneran
        //     determinísticamente → los maps L2 del arbiter/engine siguen
        //     apuntando a los mismos ids → el estado mecánico NUNCA se pierde.
        //   • Si desapareció → REMOVIDO: exorcismo completo (grafo, arbiter,
        //     PPP, safety, resolver, kinetic engine y store).
        //
        // TickEngine no puede observar el gap — _isHydrating bloquea tick()
        // durante todo el setFixtures.
        const existingIds = [...ctx.aetherGraph.getDeviceIds()];
        const stagedIds = new Set(staged.map(s => s.deviceDef.deviceId));
        for (const deviceId of existingIds) {
            if (stagedIds.has(deviceId)) {
                // SUPERVIVIENTE — snapshot de posición + unregister (sin purgar estado L2)
                this._captureDeviceKineticSnapshot(deviceId);
                ctx.aetherGraph.unregisterDevice(deviceId);
            }
            else {
                // REMOVIDO — exorcismo completo con scope de device
                this._exorcizeDevice(deviceId);
            }
        }
        ctx.aetherHasDevices = false;
        let registered = 0;
        for (const { deviceDef, forgeGraph } of staged) {
            this.registerAetherDevice(deviceDef, forgeGraph);
            registered++;
        }
        ctx.zoneNodeRouter = new ZoneNodeRouter(ctx.aetherGraph);
        ctx.seleneAetherAdapter = new SeleneAetherAdapter(ctx.zoneNodeRouter);
        void registered;
    }
}
