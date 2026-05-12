/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ AETHER IPC HANDLERS — WAVE 4529: THE PLUMBING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handlers IPC para los overrides manuales L2 del NodeArbiter.
 * Recibe payloads del ProgrammerAetherBridge (frontend) y los escribe
 * directamente en el NodeArbiter sin transformación alguna.
 *
 * Los valores que llegan YA están normalizados (0-1). La normalización
 * ocurre en el programmerStore del frontend.
 *
 * Canales IPC:
 *   lux:aether:setManualOverrides    — Batch de nodeId+channels
 *   lux:aether:clearManualOverrides  — Array de nodeIds a limpiar
 *   lux:aether:clearAllManualOverrides — Reset global L2
 *
 * @module core/aether/AetherIPCHandlers
 * @version WAVE 4652
 */
import { ipcMain } from 'electron';
import { getTitanOrchestrator } from '../orchestrator/TitanOrchestrator';
// 🚦 WAVE 4704: masterArbiter eliminado. IK solver nativo directo.
import { buildProfile, solveGroupWithFan } from '../../engine/movement/InverseKinematicsEngine';
// WAVE 4659: V3 — vibeMovementManager para propagar patrones manuales al pipeline Aether
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager';
// ⚡ WAVE 4700: Motor cinético nativo L2 — sustituye masterArbiter + VMM para patrones manuales
import { aetherKineticEngine } from './AetherKineticEngine';
// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Registra los handlers IPC del Aether Programmer.
 * Llamar desde main.ts durante la inicialización, DESPUÉS de que
 * el TitanOrchestrator esté disponible.
 */
export function registerAetherIPCHandlers() {
    /**
     * Set manual overrides — batch de payloads.
     * El bridge envía máximo 1 batch por tick de 44Hz.
     * Cada payload escribe directamente en L2 del NodeArbiter.
     */
    ipcMain.handle('lux:aether:setManualOverrides', (_event, payloads) => {
        if (!Array.isArray(payloads) || payloads.length === 0) {
            return { success: false, error: 'Empty or invalid payloads' };
        }
        try {
            // 🔬 WAVE 4681: Log de supervivencia — confirma que el canal IPC llega al backend.
            console.log('[Aether IPC] 📥 Recibidos overrides manuales:', payloads.length);
            const arbiter = getTitanOrchestrator().getAetherArbiter();
            for (const { nodeId, channels } of payloads) {
                if (typeof nodeId === 'string' && nodeId.length > 0 && channels && typeof channels === 'object') {
                    arbiter.setManualOverride(nodeId, channels);
                }
            }
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] setManualOverrides error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * Clear manual overrides para un array de nodeIds.
     * El bridge lo llama cuando un fixture pierde todos sus overrides
     * activos en el store (release por familia o release individual).
     */
    ipcMain.handle('lux:aether:clearManualOverrides', (_event, nodeIds) => {
        if (!Array.isArray(nodeIds)) {
            return { success: false, error: 'nodeIds must be an array' };
        }
        try {
            const arbiter = getTitanOrchestrator().getAetherArbiter();
            for (const nodeId of nodeIds) {
                if (typeof nodeId === 'string') {
                    arbiter.clearManualOverride(nodeId);
                }
            }
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] clearManualOverrides error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * Clear ALL manual overrides — UNLOCK ALL global.
     * El L2 del NodeArbiter queda completamente vacío.
     * L0/L1/L3/LP fluyen sin impedimento.
     */
    ipcMain.handle('lux:aether:clearAllManualOverrides', () => {
        try {
            getTitanOrchestrator().getAetherArbiter().clearAllManualOverrides();
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] clearAllManualOverrides error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * WAVE 4708 T3 — CAOS UNIFICADO:
     * Propaga la posición del slider ChaosOrderSlider al motor IA (L0).
     * El KineticAdapter lo usa como desfase de fase determinista por nodo,
     * unificando el comportamiento del caos entre patrones manuales y IA.
     * Payload: { amount: 0..1, seed: uint16 }
     */
    ipcMain.handle('lux:aether:setGlobalKineticChaos', (_event, { amount, seed }) => {
        try {
            vibeMovementManager.setGlobalChaos(typeof amount === 'number' && Number.isFinite(amount) ? amount : 0, typeof seed === 'number' && Number.isFinite(seed) ? seed : 0);
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] setGlobalKineticChaos error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * WAVE L2-SUPREMACY: Limpia todas las entradas del motor cinético nativo
     * (_motorKineticOverrides) del NodeArbiter. Los nodos dejan de tener
     * autoridad L2-MOTOR sobre pan/tilt — L0 retoma el control inmediatamente.
     * Útil como safety net al hacer Unlock cuando el motor fue detenido
     * sin arbiter (stop() sin argumento) y quedan overrides huérfanos.
     */
    ipcMain.handle('lux:aether:clearAllMotorKineticOverrides', () => {
        try {
            getTitanOrchestrator().getAetherArbiter().clearAllMotorKineticOverrides();
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] clearAllMotorKineticOverrides error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * WAVE 4709 T1 — EXORCISMO POR LISTA:
     * Limpia entradas del Dual-Map del motor cinético por nodeId. Usado por
     * KineticsBridge cuando un fixture cae fuera de la selección activa
     * (orphan diffing) para evitar movers congelados en la última coordenada
     * L2 que el engine les calculó antes del despido.
     */
    ipcMain.handle('lux:aether:clearMotorKineticOverrides', (_event, nodeIds) => {
        if (!Array.isArray(nodeIds)) {
            return { success: false, error: 'nodeIds must be an array' };
        }
        try {
            const arbiter = getTitanOrchestrator().getAetherArbiter();
            for (const nodeId of nodeIds) {
                if (typeof nodeId === 'string') {
                    arbiter.clearMotorKineticOverride(nodeId);
                }
            }
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] clearMotorKineticOverrides error:', err);
            return { success: false, error: String(err) };
        }
    });
    // ── Inhibit Limit (WAVE 4531) ──────────────────────────────────────────
    /**
     * Set inhibit limits para un array de nodeIds.
     * El limit es un cap 0-1 sobre el canal `dimmer` del nodo, aplicado
     * post-arbitraje en el NodeArbiter (no en el bridge ni en el store).
     *
     * Payload: { nodeIds: string[], limit: number }
     */
    ipcMain.handle('lux:aether:setInhibitLimit', (_event, { nodeIds, limit }) => {
        if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
            return { success: false, error: 'nodeIds must be a non-empty array' };
        }
        if (typeof limit !== 'number') {
            return { success: false, error: 'limit must be a number' };
        }
        try {
            const arbiter = getTitanOrchestrator().getAetherArbiter();
            for (const nodeId of nodeIds) {
                if (typeof nodeId === 'string' && nodeId.length > 0) {
                    arbiter.setInhibitLimit(nodeId, limit);
                }
            }
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] setInhibitLimit error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * Clear inhibit limits para un array de nodeIds.
     * El canal `dimmer` vuelve a fluir sin cap.
     */
    ipcMain.handle('lux:aether:clearInhibitLimit', (_event, nodeIds) => {
        if (!Array.isArray(nodeIds)) {
            return { success: false, error: 'nodeIds must be an array' };
        }
        try {
            const arbiter = getTitanOrchestrator().getAetherArbiter();
            for (const nodeId of nodeIds) {
                if (typeof nodeId === 'string') {
                    arbiter.clearInhibitLimit(nodeId);
                }
            }
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] clearInhibitLimit error:', err);
            return { success: false, error: String(err) };
        }
    });
    // ── G1/G2: Blackout + GrandMaster globales (WAVE 4702) ─────────────────────
    // Atacan NodeArbiter (pipeline Aether). masterArbiter extinto — WAVE 4702.
    /**
     * G1: Set blackout global.
     * Escribe en NodeArbiter L4.
     * Payload: active boolean
     * Devuelve: { success, blackoutActive }
     */
    ipcMain.handle('lux:aether:setBlackout', (_event, { active }) => {
        try {
            const arbiter = getTitanOrchestrator().getAetherArbiter();
            arbiter.setBlackout(active);
            return { success: true, blackoutActive: active };
        }
        catch (err) {
            console.error('[AetherIPC] setBlackout error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * G1b: Set output gate global (ARM/LIVE) para pipeline Aether.
     * Payload: enabled boolean
     */
    ipcMain.handle('lux:aether:setOutputEnabled', (_event, { enabled }) => {
        try {
            const orchestrator = getTitanOrchestrator();
            orchestrator.setOutputEnabled(!!enabled);
            return { success: true, outputEnabled: orchestrator.isOutputEnabled() };
        }
        catch (err) {
            console.error('[AetherIPC] setOutputEnabled error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * G1c: Read control gate state para hidratación de CommandDeck.
     */
    ipcMain.handle('lux:aether:getControlState', () => {
        try {
            const orchestrator = getTitanOrchestrator();
            const arbiter = orchestrator.getAetherArbiter();
            return {
                success: true,
                outputEnabled: orchestrator.isOutputEnabled(),
                blackoutActive: arbiter.isBlackoutActive(),
                grandMaster: arbiter.getGrandMaster(),
                grandMasterSpeed: vibeMovementManager.getGlobalSpeedMultiplier(),
            };
        }
        catch (err) {
            console.error('[AetherIPC] getControlState error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * G2: Set grand master dimmer global (0-1).
     * Escribe en NodeArbiter L4.
     * Payload: value (0-1)
     */
    ipcMain.handle('lux:aether:setGrandMaster', (_event, { value }) => {
        try {
            const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
            getTitanOrchestrator().getAetherArbiter().setGrandMaster(clamped);
            return { success: true, grandMaster: clamped };
        }
        catch (err) {
            console.error('[AetherIPC] setGrandMaster error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * G3: Set grand master speed (0.1-2.0) — escala velocidad AI global.
     * Controla VMM nativo del pipeline Aether.
     * Payload: value (0.1-2.0)
     */
    ipcMain.handle('lux:aether:setGrandMasterSpeed', (_event, { value }) => {
        try {
            const clamped = value < 0.1 ? 0.1 : value > 2.0 ? 2.0 : value;
            // Aether kinetic flow consumes VMM in hot-path. This is the canonical speed control.
            vibeMovementManager.setGlobalSpeedMultiplier(clamped);
            return { success: true, grandMasterSpeed: vibeMovementManager.getGlobalSpeedMultiplier() };
        }
        catch (err) {
            console.error('[AetherIPC] setGrandMasterSpeed error:', err);
            return { success: false, error: String(err) };
        }
    });
    // ── E11/E12: Kinetic pattern engine + IK spatial solver ─────────────────────
    // WAVE 4700: El motor cinético nativo (AetherKineticEngine) reemplaza a
    // masterArbiter.setPattern() + vibeMovementManager en el flujo de patrones
    // manuales. El engine acumula fase propia, calcula la posición con fan offset
    // determinista, y escribe pan_base/tilt_base en NodeArbiter L2 directamente.
    //
    // El IPC lux:aether:setKineticFanOffsets ya NO es necesario como canal
    // separado — el fan se integra en setManualPattern como parámetro `fan`.
    // El canal legacy queda como no-op para compatibilidad de llamadas antiguas
    // (KineticsBridge.ts lo sigue invocando en WAVE 4717.2).
    /**
     * E11: Set manual kinetic pattern para fixtures.
     * Ruta: lux:aether:setManualPattern (Aether IPC)
     * Engine: aetherKineticEngine — MOTOR NATIVO L2 (WAVE 4700).
     *
    * Payload: { fixtureIds, pattern, speed (0-100), amplitude (0-100), fan? (-100..100) }
     *
     * El motor escribe pan_base/tilt_base por fixture en cada tick de 44Hz.
     * El VMM se desactiva (setManualPattern(null)) para evitar doble oscilación:
     * el L0 queda en home (0.5) y el orbit math del Arbiter pasa pan_base sin suma.
     */
    ipcMain.handle('lux:aether:setManualPattern', (_event, { fixtureIds, pattern, speed, amplitude, fan, anchorPan, anchorTilt }) => {
        console.log('[SONDA L2-IPC] Payload recibido:', { fixtureIds: fixtureIds?.length, pattern, speed, amplitude, fan, anchorPan, anchorTilt });
        if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
            return { success: false, error: 'fixtureIds must be a non-empty array' };
        }
        try {
            const arbiter = getTitanOrchestrator().getAetherArbiter();
            if (pattern === null || pattern === 'static' || pattern === 'hold') {
                // Detener motor nativo y limpiar L2
                aetherKineticEngine.stop(arbiter);
                // Limpiar VMM por si quedaron overrides del modo legacy (backward compat)
                vibeMovementManager.setManualPattern(null);
                vibeMovementManager.setManualSpeed(null);
                vibeMovementManager.setManualAmplitude(null);
                vibeMovementManager.setKineticFanOffsets({});
                return { success: true };
            }
            // Normalizar speed/amplitude de rango UI [0–100] a [0, 1]
            const speedNorm = (speed ?? 50) / 100;
            const amplitudeNorm = (amplitude ?? 50) / 100;
            const fanNorm = (fan ?? 0) / 100;
            // Construir nodeIds en formato Aether: `${fixtureId}:kinetic`
            const nodeIds = fixtureIds.map(id => `${id}:kinetic`);
            // Mapear nombre de patrón UI → NativeKineticPattern
            const nativePattern = mapToNativePattern(pattern);
            // Silenciar VMM — con L2 supremacy el delta L0 ya no llega al resultado
            // final de pan/tilt, pero silenciar VMM evita el coste de CPU inútil.
            vibeMovementManager.setManualPattern(null);
            vibeMovementManager.setManualSpeed(null);
            vibeMovementManager.setManualAmplitude(null);
            vibeMovementManager.setKineticFanOffsets({});
            // WAVE L2-SUPREMACY: guardar estado previo para limpiar L2 de fixtures
            // que ya no forman parte de la nueva selección.
            // Si no se limpian, quedan congelados en su última posición cinética.
            const prevKineticState = aetherKineticEngine.getState();
            // WAVE 4708 T2 — ANCHOR HYDRATION ATÓMICA:
            // Si el cliente envió anchorPan/anchorTilt (posición actual del radar),
            // los inyectamos en _manualOverrides como pan_base/tilt_base ANTES de
            // activar el motor. Garantiza que el primer tick del engine lea el
            // anchor correcto en lugar del fallback 0.5 (centro), eliminando el
            // "snap a centro" cuando el operador activa un patrón sin haber
            // disparado un _flushClassic previo en el mismo frame lógico.
            if (typeof anchorPan === 'number' && typeof anchorTilt === 'number'
                && Number.isFinite(anchorPan) && Number.isFinite(anchorTilt)) {
                const pan_base = anchorPan < 0 ? 0 : anchorPan > 1 ? 1 : anchorPan;
                const tilt_base = anchorTilt < 0 ? 0 : anchorTilt > 1 ? 1 : anchorTilt;
                for (const nodeId of nodeIds) {
                    // Merge no-destructivo con overrides existentes (preserva otros canales L2).
                    const prev = arbiter.getManualOverride(nodeId) ?? {};
                    arbiter.setManualOverride(nodeId, { ...prev, pan_base, tilt_base });
                }
            }
            // Activar motor nativo con la configuración completa
            aetherKineticEngine.setManualKinetics(nodeIds, nativePattern, speedNorm, amplitudeNorm, fanNorm);
            // Limpiar overrides L2 para fixtures que salieron de la selección.
            // WAVE 4709 T1: además de _manualOverrides (ancla), limpiar también
            // _motorKineticOverrides (salida del engine) — sin esto, el último
            // tick antes del despido dejaba la coordenada motor congelada y el
            // mover quedaba en una postura zombie.
            if (prevKineticState.active) {
                const newNodeSet = new Set(nodeIds);
                for (const prevNodeId of prevKineticState.nodeIds) {
                    if (!newNodeSet.has(prevNodeId)) {
                        arbiter.clearManualOverride(prevNodeId);
                        arbiter.clearMotorKineticOverride(prevNodeId);
                    }
                }
            }
            return { success: true, pattern: nativePattern };
        }
        catch (err) {
            console.error('[AetherIPC] setManualPattern error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * E11b: Actualizar escalares (speed/amplitude/fan) sin reiniciar la fase.
     * Ruta: lux:aether:updateKineticScalars (Aether IPC) — NUEVO WAVE 4700.
     * Para cambios en tiempo real de los sliders de UI sin glitch de fase.
     * Payload: { speed (0-100), amplitude (0-100), fan (-100..100) }
     */
    ipcMain.handle('lux:aether:updateKineticScalars', (_event, { speed, amplitude, fan }) => {
        try {
            aetherKineticEngine.updateScalars((speed ?? 50) / 100, (amplitude ?? 50) / 100, (fan ?? 0) / 100);
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] updateKineticScalars error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * E11d WAVE 4701: Snapshot de estado manual del motor cinético nativo.
     * Se usa para hidratar UI (pattern/speed/amplitude/fan) al cambiar selección.
     */
    ipcMain.handle('lux:aether:getManualKineticState', () => {
        try {
            return { success: true, ...aetherKineticEngine.getState() };
        }
        catch (err) {
            console.error('[AetherIPC] getManualKineticState error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * E11c: Canal legacy para compatibilidad con WAVE 4717.2.
     * El fan ahora se pasa directamente en setManualPattern como parámetro `fan`.
     * Este handler queda como no-op (el motor nativo ignora el mapa de offsets VMM).
     */
    ipcMain.handle('lux:aether:setKineticFanOffsets', (_event, _offsets) => {
        // No-op: los fan offsets se calculan nativamente en AetherKineticEngine.tick().
        // El canal IPC se mantiene para no romper llamadas desde KineticsBridge legacy.
        return { success: true };
    });
    /**
     * E12: Apply spatial target (IK solve) para fixtures.
     * Ruta: lux:aether:applySpatialTarget (Aether IPC)
     * Engine: InverseKinematicsEngine.solveGroupWithFan() — WAVE 4704 (masterArbiter eliminado)
     * Payload: { target: {x,y,z}, fixtureIds, fanMode?, fanAmplitude? }
     */
    ipcMain.handle('lux:aether:applySpatialTarget', (_event, { target, fixtureIds, fanMode, fanAmplitude }) => {
        if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
            return { success: false, error: 'fixtureIds must be a non-empty array' };
        }
        try {
            const orchestrator = getTitanOrchestrator();
            const arbiter = orchestrator.getAetherArbiter();
            const allFixtures = orchestrator.fixtures ?? [];
            const profiles = [];
            const validIds = [];
            for (const id of fixtureIds) {
                const f = allFixtures.find((x) => x.id === id);
                if (!f || !f.position)
                    continue;
                const cal = f.calibration;
                const physics = f.physics;
                const profile = buildProfile(id, f.position, f.rotation, f.orientation ?? f.installationType ?? 'ceiling', cal ? {
                    panOffset: cal.panOffset ?? 0,
                    tiltOffset: cal.tiltOffset ?? 0,
                    panInvert: cal.panInvert ?? false,
                    tiltInvert: cal.tiltInvert ?? false,
                } : undefined, f.panRangeDeg, f.tiltRangeDeg, physics?.tiltLimits);
                profiles.push(profile);
                validIds.push(id);
            }
            if (profiles.length === 0)
                return { success: true, results: {} };
            const results = solveGroupWithFan(profiles, target, (fanMode ?? 'converge'), fanAmplitude ?? 0, null);
            const serialized = {};
            for (const id of validIds) {
                const ikResult = results.get(id);
                if (!ikResult)
                    continue;
                // Inject into Aether L2 as pan_base/tilt_base (0-1 normalized)
                arbiter.setManualOverride(`${id}:kinetic`, {
                    pan_base: ikResult.pan / 255,
                    tilt_base: ikResult.tilt / 255,
                });
                serialized[id] = ikResult;
            }
            return { success: true, results: serialized };
        }
        catch (err) {
            console.error('[AetherIPC] applySpatialTarget error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * E12: Release spatial target — devuelve fixtures al control AI.
     * Ruta: lux:aether:releaseSpatialTarget (Aether IPC)
     * Engine: NodeArbiter.clearManualOverride — WAVE 4704 (masterArbiter eliminado)
     */
    ipcMain.handle('lux:aether:releaseSpatialTarget', (_event, { fixtureIds }) => {
        if (!Array.isArray(fixtureIds)) {
            return { success: false, error: 'fixtureIds must be an array' };
        }
        try {
            const arbiter = getTitanOrchestrator().getAetherArbiter();
            for (const id of fixtureIds) {
                arbiter.clearManualOverride(`${id}:kinetic`);
            }
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] releaseSpatialTarget error:', err);
            return { success: false, error: String(err) };
        }
    });
    // ── F1: FIXTURE SYNC — Canal canónico → TitanOrchestrator (WAVE 4702) ───────
    /**
     * F1: Sync fixtures desde stageStore al NodeGraph de Aether.
     * Reemplaza lux:arbiter:setFixtures como canal canónico.
     * Llama a TitanOrchestrator.setFixtures() que internamente:
     *   - Actualiza HAL
     *   - Llama _syncFixturesToAether (NodeGraph full-resync)
     * Devuelve: { success, fixtureCount, liquidLayout }
     */
    ipcMain.handle('lux:aether:setFixtures', (_event, { fixtures, stageBounds }) => {
        try {
            // WAVE TYPECAST: El store puede serializar fixtures como Record<id, Fixture>
            // en lugar de Array. Normalizamos aquí antes de tocar el Orchestrator.
            const fixtureArray = Array.isArray(fixtures)
                ? fixtures
                : Object.values(fixtures);
            const orchestrator = getTitanOrchestrator();
            const liquidLayout = orchestrator.setFixtures(fixtureArray, stageBounds);
            return { success: true, fixtureCount: fixtureArray.length, liquidLayout };
        }
        catch (err) {
            console.error('[AetherIPC] setFixtures error:', err);
            return { success: false, error: String(err) };
        }
    });
    // ── G1: TUNGSTEN GOLDEN NUKE (WAVE 4699.2) ───────────────────────────────
    /**
     * G1: Dispara un override L2 sobre los nodos flash del Tungsten.
     *
     * Payload:
     *   target  — 'all' | 'petal-l' | 'petal-c' | 'petal-r' | 'spin'
     *   release — true = clearManualOverride (Note Off / fader a 0)
     *   value   — [0,1] intensidad (solo para 'spin': valor bipolar norm 0–1)
     *
     * Color dorado puro = #FFD700 → r=1.0, g=0.843, b=0.0
     * Zona flash es aditiva (WAVE 4696) → "quema" sobre la luz actual.
     */
    ipcMain.handle('lux:aether:fireTungstenNuke', (_event, { target, release, value }) => {
        try {
            const orchestrator = getTitanOrchestrator();
            const arbiter = orchestrator.getAetherArbiter();
            const tungstenList = orchestrator.getTungstenNodeIds();
            if (tungstenList.length === 0) {
                return { success: false, error: 'No Tungsten fixture registered in NodeGraph' };
            }
            for (const t of tungstenList) {
                if (target === 'spin') {
                    // Bipolar spin: value 0–1 (0=full-left, 0.5=stop, 1=full-right)
                    const norm = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 0.5;
                    if (release) {
                        arbiter.setManualOverride(t.kinetic, { rotation: 0.5 });
                    }
                    else {
                        arbiter.setManualOverride(t.kinetic, { rotation: norm });
                    }
                }
                else if (target === 'all') {
                    if (release) {
                        arbiter.clearManualOverride(t.goldenMaster);
                        arbiter.clearManualOverride(t.petalL);
                        arbiter.clearManualOverride(t.petalC);
                        arbiter.clearManualOverride(t.petalR);
                    }
                    else {
                        const intensity = typeof value === 'number' ? value : 1.0;
                        // #FFD700 dorado puro → r=1.0, g=0.843, b=0.0
                        // 🌊 WAVE 4701 M2: golden-master incluye strobe (canal 4) al maximo (1.0)
                        arbiter.setManualOverride(t.goldenMaster, { dimmer: intensity, strobe: 1.0 });
                        arbiter.setManualOverride(t.petalL, { dimmer: intensity });
                        arbiter.setManualOverride(t.petalC, { dimmer: intensity });
                        arbiter.setManualOverride(t.petalR, { dimmer: intensity });
                    }
                }
                else if (target === 'petal-l' || target === 'petal-c' || target === 'petal-r') {
                    const nodeId = target === 'petal-l' ? t.petalL
                        : target === 'petal-c' ? t.petalC
                            : t.petalR;
                    if (release) {
                        arbiter.clearManualOverride(nodeId);
                    }
                    else {
                        const intensity = typeof value === 'number' ? value : 1.0;
                        arbiter.setManualOverride(nodeId, { dimmer: intensity });
                    }
                }
                else {
                    return { success: false, error: `Unknown target: ${target}` };
                }
            }
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] fireTungstenNuke error:', err);
            return { success: false, error: String(err) };
        }
    });
    // ── R1: L2 State Reader (WAVE 4653) ─────────────────────────────────────
    /**
     * R1: Devuelve los overrides manuales L2 activos para los nodeIds pedidos.
     *
     * La UI lo llama al seleccionar fixtures para hidratar los sliders con el
     * estado real del arbiter en lugar de usar defaults engañosos.
     *
     * Payload: { nodeIds: string[] }
     * Retorno: { success, overrides: { [nodeId]: Record<string,number> | null } }
     */
    ipcMain.handle('lux:aether:getL2State', (_event, { nodeIds }) => {
        if (!Array.isArray(nodeIds)) {
            return { success: false, error: 'nodeIds must be an array' };
        }
        try {
            const overrides = getTitanOrchestrator()
                .getAetherArbiter()
                .getManualOverridesForNodes(nodeIds);
            return { success: true, overrides };
        }
        catch (err) {
            console.error('[AetherIPC] getL2State error:', err);
            return { success: false, error: String(err) };
        }
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// WAVE 4700: PATTERN NAME MAPPER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Mapea nombres de patrón de la UI (string libre del movementStore)
 * al tipo `NativeKineticPattern` del AetherKineticEngine.
 *
 * Garantiza que siempre haya un fallback válido para evitar que
 * un nombre desconocido silencie el motor.
 */
function mapToNativePattern(pattern) {
    const MAP = {
        // Nombres de la UI (movementStore / PatternArsenal)
        'circle': 'circle',
        'circle_big': 'circle',
        'figure8': 'figure8',
        'figure_8': 'figure8',
        'lemniscate': 'lemniscate',
        'scan_x': 'scan_x',
        'sweep': 'scan_x',
        'square': 'square',
        'diamond': 'diamond',
        'wave_y': 'wave_y',
        'wave': 'wave_y',
        'ballyhoo': 'ballyhoo',
        'darkspin': 'darkspin',
        'sway': 'sway',
        // Patrones legacy del masterArbiter (backward compat)
        'eight': 'figure8',
        'tornado': 'darkspin',
        'gravity_bounce': 'wave_y',
        'butterfly': 'lemniscate',
        'heartbeat': 'sway',
    };
    return MAP[pattern] ?? 'circle';
}
