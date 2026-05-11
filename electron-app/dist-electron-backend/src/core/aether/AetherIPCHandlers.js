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
// WAVE 4651: masterArbiter delegado temporal para pattern engine e IK solver.
// WAVE 4652: masterArbiter compartido para blackout/grandmaster mientras el HAL
// sigue leyendo de el. Ambos pipelines reciben la misma senal en paralelo.
import { masterArbiter } from '../arbiter';
// WAVE 4659: V3 — vibeMovementManager para propagar patrones manuales al pipeline Aether
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager';
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
    // ── G1/G2: Blackout + GrandMaster globales (WAVE 4652) ─────────────────────
    // Atacan NodeArbiter (pipeline Aether) Y masterArbiter (pipeline legacy + HAL)
    // de forma simultanea. Cuando el HAL migre al pipeline Aether, se elimina
    // la llamada a masterArbiter de aqui.
    /**
     * G1: Set blackout global.
     * Escribe en NodeArbiter L4 Y en masterArbiter (HAL legacy).
     * Payload: active boolean
     * Devuelve: { success, blackoutActive }
     */
    ipcMain.handle('lux:aether:setBlackout', (_event, { active }) => {
        try {
            const arbiter = getTitanOrchestrator().getAetherArbiter();
            arbiter.setBlackout(active);
            // WAVE 4652: espejo al pipeline legacy hasta que HAL migre a Aether
            masterArbiter.setBlackout(active);
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
            // Compat temporal con rutas legacy todavía vivas.
            masterArbiter.setOutputEnabled(!!enabled);
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
     * Escribe en NodeArbiter Y en masterArbiter.
     * Payload: value (0-1)
     */
    ipcMain.handle('lux:aether:setGrandMaster', (_event, { value }) => {
        try {
            const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
            getTitanOrchestrator().getAetherArbiter().setGrandMaster(clamped);
            // WAVE 4652: espejo al pipeline legacy
            masterArbiter.setGrandMaster(clamped);
            return { success: true, grandMaster: clamped };
        }
        catch (err) {
            console.error('[AetherIPC] setGrandMaster error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * G3: Set grand master speed (0.1-2.0) — escala velocidad AI global.
     * Delegado a masterArbiter (controla el VMM legacy).
     * Payload: value (0.1-2.0)
     */
    ipcMain.handle('lux:aether:setGrandMasterSpeed', (_event, { value }) => {
        try {
            const clamped = value < 0.1 ? 0.1 : value > 2.0 ? 2.0 : value;
            // Aether kinetic flow consumes VMM in hot-path. This is the canonical speed control.
            vibeMovementManager.setGlobalSpeedMultiplier(clamped);
            // Compat temporal con rutas legacy aún conectadas al ArbitrationDirector.
            masterArbiter.setGrandMasterSpeed(clamped);
            return { success: true, grandMasterSpeed: vibeMovementManager.getGlobalSpeedMultiplier() };
        }
        catch (err) {
            console.error('[AetherIPC] setGrandMasterSpeed error:', err);
            return { success: false, error: String(err) };
        }
    });
    // ── E11/E12: Kinetic pattern engine + IK spatial solver (WAVE 4651) ─────────
    // El NodeArbiter opera sobre canales abstractos (pan, tilt, speed...).
    // La logica de pattern (timing matematico, anchor, sweep) y la resolucion
    // IK (giroscopio de cables, calibracion, pan range) viven en el ArbitrationDirector.
    // WAVE 4651: la RUTA IPC es 100% Aether. El engine de movimiento fisico
    // permanece en masterArbiter como motor compartido hasta WAVE 4700 (KineticSystem Aether).
    /**
     * E11: Set manual kinetic pattern para fixtures.
     * Ruta: lux:aether:setManualPattern (Aether IPC)
     * Engine: masterArbiter.setPattern() — motor cinematico compartido.
     * Payload: { fixtureIds, pattern, speed (0-100), amplitude (0-100) }
     */
    ipcMain.handle('lux:aether:setManualPattern', (_event, { fixtureIds, pattern, speed, amplitude }) => {
        if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
            return { success: false, error: 'fixtureIds must be a non-empty array' };
        }
        try {
            if (pattern === null || pattern === 'static' || pattern === 'hold') {
                masterArbiter.clearPattern(fixtureIds);
                // WAVE 4659 + 4661: limpiar también speed/amplitude/pattern en VMM
                vibeMovementManager.setManualPattern(null);
                vibeMovementManager.setManualSpeed(null);
                vibeMovementManager.setManualAmplitude(null);
                // WAVE 4717.2: limpiar L2 phase offsets (fan distribute)
                vibeMovementManager.setKineticFanOffsets({});
                return { success: true };
            }
            // Normalizacion speed: 0.05-0.5 Hz (rango WAVE 2652, constante fija)
            const SPEED_MIN = 0.05;
            const SPEED_MAX = 0.5;
            const speedNorm = SPEED_MIN + (speed / 100) * (SPEED_MAX - SPEED_MIN);
            const sizeNorm = (amplitude / 100) * 1.0;
            // Anchor: posicion actual del primer fixture como centro del patron
            const anchorPos = masterArbiter.getCurrentPosition(fixtureIds[0]);
            masterArbiter.setPattern(fixtureIds, {
                type: pattern,
                speed: speedNorm,
                size: sizeNorm,
                center: { pan: anchorPos.pan, tilt: anchorPos.tilt },
            });
            // WAVE 4659 + 4661: propagar patrón, speed y amplitude al VMM
            // para que KineticAdapter los use en el hot-path Aether.
            vibeMovementManager.setManualPattern(pattern);
            vibeMovementManager.setManualSpeed(speed); // 0-100 → VMM escala a Hz internamente
            vibeMovementManager.setManualAmplitude(amplitude); // 0-100 → VMM escala a [0.05, 1.0]
            return { success: true, pattern };
        }
        catch (err) {
            console.error('[AetherIPC] setManualPattern error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * E11b WAVE 4717.2: Set L2 phase offsets para fan distribute.
     * Ruta: lux:aether:setKineticFanOffsets (Aether IPC)
     * Engine: vibeMovementManager._l2PhaseOverrides — lookup O(1) en hot-path.
     * Payload: Record<nodeId, phaseOffset (rad)>
     * El KineticAdapter lee este mapa en process() antes de generateIntent().
     */
    ipcMain.handle('lux:aether:setKineticFanOffsets', (_event, offsets) => {
        if (typeof offsets !== 'object' || offsets === null) {
            return { success: false, error: 'offsets must be a non-null object' };
        }
        try {
            vibeMovementManager.setKineticFanOffsets(offsets);
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] setKineticFanOffsets error:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * E12: Apply spatial target (IK solve) para fixtures.
     * Ruta: lux:aether:applySpatialTarget (Aether IPC)
     * Engine: masterArbiter.applySpatialTarget() — IK resolver compartido.
     * Payload: { target: {x,y,z}, fixtureIds, fanMode?, fanAmplitude? }
     */
    ipcMain.handle('lux:aether:applySpatialTarget', (_event, { target, fixtureIds, fanMode, fanAmplitude }) => {
        if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
            return { success: false, error: 'fixtureIds must be a non-empty array' };
        }
        try {
            const results = masterArbiter.applySpatialTarget(target, fixtureIds, fanMode ?? 'converge', fanAmplitude ?? 0);
            const serialized = {};
            results.forEach((result, id) => { serialized[id] = result; });
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
     * Engine: masterArbiter.releaseSpatialTarget() — IK release compartido.
     */
    ipcMain.handle('lux:aether:releaseSpatialTarget', (_event, { fixtureIds }) => {
        if (!Array.isArray(fixtureIds)) {
            return { success: false, error: 'fixtureIds must be an array' };
        }
        try {
            masterArbiter.releaseSpatialTarget(fixtureIds);
            return { success: true };
        }
        catch (err) {
            console.error('[AetherIPC] releaseSpatialTarget error:', err);
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
