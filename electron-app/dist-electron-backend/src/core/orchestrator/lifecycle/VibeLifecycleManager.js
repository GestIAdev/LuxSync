/**
 * WAVE 4959 PHASE 3b — VibeLifecycleManager
 * Extracted from TitanOrchestrator.ts (~lines 2568-2788).
 *
 * Owns: vibe/mode/consciousness/liquid/mood lifecycle methods.
 * Delegates state mutations to StateManager and logging to TacticalLogManager.
 * Engine, Trinity, and HAL references are injected post-init (set during TitanOrchestrator.init()).
 */
import { MoodController } from '../../mood/MoodController';
export class VibeLifecycleManager {
    constructor(state, logManager) {
        this.state = state;
        this.logManager = logManager;
        this.engine = null;
        this.trinity = null;
        this.hal = null;
        this.pendingHeatmap = null;
    }
    // ── Reference injectors (called from TitanOrchestrator.init) ────────────
    setEngine(e) {
        this.engine = e;
        // WAVE 2439.5: Apply pending layout sync — AppCommander may have called
        // setLiquidLayout() before engine was injected (boot race condition).
        if (e) {
            e.setLiquidLayout(this.state.currentLiquidLayout);
            // Flush pending heatmap if one was set before engine was ready
            if (this.pendingHeatmap) {
                console.log('[VibeLifecycle] Flushing pending heatmap to engine');
                e.setChronosHeatmap(this.pendingHeatmap);
                this.pendingHeatmap = null;
            }
        }
    }
    setTrinity(t) { this.trinity = t; }
    setHal(h) { this.hal = h; }
    // ── Vibe ────────────────────────────────────────────────────────────────
    setVibe(vibeId) {
        if (!this.engine)
            return;
        this.engine.setVibe(vibeId);
        const normalizedVibeId = this.engine.getCurrentVibe();
        console.log(`[TitanOrchestrator] Vibe set to: ${normalizedVibeId}`);
        this.logManager.log('Mode', `🎭 Vibe changed to: ${normalizedVibeId.toUpperCase()}`);
        if (this.trinity) {
            this.trinity.setVibe(normalizedVibeId);
            console.log(`[TitanOrchestrator] 🎯 WAVE 289: Vibe propagated to Workers`);
        }
        if (this.hal) {
            this.hal.setVibe(normalizedVibeId);
            console.log(`[TitanOrchestrator] 🎛️ WAVE 338: Movement physics updated for vibe`);
        }
        // ❌ AMNESIA PROTOCOL EXTIRPADO (WAVE 2140 → FUEGO BLANCO)
        // El cambio de Vibe muta la representación visual (colores, perfiles de
        // envelope, asignación de zonas) pero la línea temporal de la música es
        // continua. Resetear el Pacemaker aquí mataba el kickLocked de strict-split
        // (Techno) al borrar stableBpm, confidence y totalKicks, forzando
        // kickSignal = 0 y frontPar apagado hasta que el tracker re-lock.
        this.engine.setActiveProfile(normalizedVibeId);
        console.log(`[TitanOrchestrator] 🧹 WAVE 3230: Clean Slate for vibe ${normalizedVibeId}`);
    }
    // ── Palette ─────────────────────────────────────────────────────────────
    forcePaletteSync() {
        if (this.engine) {
            this.engine.forcePaletteRefresh();
            console.log(`[TitanOrchestrator] 🎨 Palette forcefully synced to current vibe`);
        }
    }
    // ── Uranus Engine Toggle (WAVE 7691) ────────────────────────────────────
    setUranusEngine(enabled) {
        if (this.engine) {
            this.engine.setUranusEngine(enabled);
            this.logManager.log('Mode', `🌌 Uranus Engine: ${enabled ? 'ACTIVATED' : 'DEACTIVATED (legacy)'}`);
        }
    }
    isUranusEngineActive() {
        return this.engine?.isUranusEngineActive() ?? false;
    }
    // ── Mood ────────────────────────────────────────────────────────────────
    setMood(moodId) {
        if (this.engine) {
            MoodController.getInstance().setMood(moodId);
            console.log(`[TitanOrchestrator] 🎭 Mood set to: ${moodId.toUpperCase()}`);
            this.logManager.log('Mode', `🎭 Mood changed to: ${moodId.toUpperCase()}`);
        }
    }
    getMood() {
        return MoodController.getInstance().getCurrentMood();
    }
    // ── Chronos ─────────────────────────────────────────────────────────────
    setChronosHeatmap(heatmap) {
        if (this.engine) {
            this.engine.setChronosHeatmap(heatmap);
        }
        else {
            this.pendingHeatmap = heatmap;
            console.log(`[VibeLifecycle] Engine not ready — heatmap cached as pending (energyLen=${heatmap?.energy?.length ?? 0})`);
        }
    }
    setChronosPlayhead(timeMs, isPlaying) {
        if (this.engine) {
            this.engine.setChronosPlayhead(timeMs, isPlaying);
        }
    }
    // ── Mode ────────────────────────────────────────────────────────────────
    setMode(mode) {
        this.state.mode = mode;
        console.log(`[TitanOrchestrator] Mode set to: ${mode}`);
        this.logManager.log('System', `⚙️ Mode: ${mode.toUpperCase()}`);
    }
    // ── Brain ───────────────────────────────────────────────────────────────
    setUseBrain(enabled) {
        this.state.useBrain = enabled;
        console.log(`[TitanOrchestrator] Brain ${enabled ? 'enabled' : 'disabled'} (FULL SYSTEM)`);
        this.logManager.log('System', `🧠 Brain: ${enabled ? 'ONLINE' : 'OFFLINE'}`);
    }
    // ── Consciousness ───────────────────────────────────────────────────────
    setConsciousnessEnabled(enabled) {
        this.state.consciousnessEnabled = enabled;
        if (this.engine) {
            this.engine.setConsciousnessEnabled(enabled);
        }
        console.log(`[TitanOrchestrator] 🧬 Consciousness ${enabled ? 'ENABLED ✅' : 'DISABLED ⏸️'}`);
        this.logManager.log('Brain', `🧬 Consciousness: ${enabled ? 'ACTIVE' : 'STANDBY'}`);
    }
    isConsciousnessEnabled() {
        return this.state.consciousnessEnabled;
    }
    // ── Liquid ──────────────────────────────────────────────────────────────
    setLiquidStereo(enabled) {
        if (this.engine) {
            this.engine.setLiquidStereo(enabled);
        }
        // Liquid Stereo log silenced
        this.logManager.log('Physics', `🌊 Liquid Stereo: ${enabled ? '7-BAND' : 'GOD MODE'}`);
    }
    setLiquidLayout(mode) {
        this.state.currentLiquidLayout = mode;
        if (this.engine) {
            this.engine.setLiquidLayout(mode);
        }
        // Layout log silenced — fires on every setFixtures
        this.logManager.log('Physics', `🌊 Layout switched to ${mode}`);
    }
    getLiquidLayout() {
        return this.state.currentLiquidLayout;
    }
    // ── Input gain ──────────────────────────────────────────────────────────
    setInputGain(gain) {
        this.state.inputGain = Math.max(0, Math.min(2, gain));
        console.log(`[TitanOrchestrator] Input gain set to: ${this.state.inputGain}`);
    }
}
