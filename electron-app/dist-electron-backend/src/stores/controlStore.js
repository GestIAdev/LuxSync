/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎮 CONTROL STORE - WAVE 422: Mode Termination
 * Gestiona el modo global y parámetros de control de la UI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Responsabilidades:
 * - viewMode: Alternar entre vista 2D (Tactical) y 3D (Visualizer)
 * - globalMode: Manual / Selene AI / null (idle when system OFF)
 * - aiEnabled: Override para habilitar/deshabilitar Selene
 * - activePalette: Paleta de colores vivos activa (WAVE 33.2)
 * - globalSaturation/globalIntensity: Controles globales (WAVE 33.2)
 *
 * WAVE 422: Eliminado 'flow' mode - sistema Auto-Override
 *
 * @module stores/controlStore
 * @version 422.0.0
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_FLOW_PARAMS = {
    pattern: 'static',
    speed: 50,
    intensity: 50,
    direction: 'forward',
    spread: 50,
    // WAVE 33.4: Kinetic Radar defaults
    basePan: 0.5, // Center
    baseTilt: 0.5, // Center
    size: 0.5, // 50% amplitude
};
const DEFAULT_STATE = {
    viewMode: '2D',
    globalMode: null, // 🔌 WAVE 63.9: Start idle (system OFF)
    // 🧠 WAVE 1133: AI LOBOTOMY - Selene starts SEDATED, not creative
    // User must explicitly enable Conscious mode after GO
    aiEnabled: false,
    // ⚛️ WAVE 2073.1: System arm - motor starts COLD
    systemArmed: false,
    // 🚦 WAVE 1132: Cold Start Protocol - output disabled by default
    outputEnabled: false,
    flowParams: DEFAULT_FLOW_PARAMS,
    showDebugOverlay: false,
    sidebarExpanded: true,
    // WAVE 33.2 + 34.5: Color & Palette with transitions
    activePalette: 'fuego',
    targetPalette: null,
    transitionProgress: 1, // 1 = no transition in progress
    globalSaturation: 1.0,
    globalIntensity: 1.0,
    // 🌊 WAVE 2432: Omni-Liquid always active, default 4.1 layout
    useLiquidStereo: true,
    liquidLayout: '4.1',
    // 🏛️ WAVE 4561: Sidebar mode — empieza en controls (normal)
    sidebarMode: 'controls',
};
// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════
export const useControlStore = create()(persist((set, get) => ({
    // Initial state
    ...DEFAULT_STATE,
    // ═══════════════════════════════════════════════════════════════════
    // VIEW MODE ACTIONS
    // ═══════════════════════════════════════════════════════════════════
    setViewMode: (mode) => {
        console.log(`[ControlStore] 🎬 View mode changed: ${get().viewMode} → ${mode}`);
        set({ viewMode: mode });
    },
    toggleViewMode: () => {
        const current = get().viewMode;
        const next = current === '2D' ? '3D' : '2D';
        console.log(`[ControlStore] 🔄 Toggle view mode: ${current} → ${next}`);
        set({ viewMode: next });
    },
    // ═══════════════════════════════════════════════════════════════════
    // GLOBAL MODE ACTIONS
    // ═══════════════════════════════════════════════════════════════════
    setGlobalMode: (mode) => {
        console.log(`[ControlStore] 🎛️ Global mode changed: ${get().globalMode} → ${mode}`);
        set({ globalMode: mode });
    },
    setFlowParams: (params) => {
        const current = get().flowParams;
        const updated = { ...current, ...params };
        console.log('[ControlStore] 🌊 Flow params updated:', updated);
        set({ flowParams: updated });
    },
    toggleAI: () => {
        const current = get().aiEnabled;
        console.log(`[ControlStore] 🤖 AI toggled: ${current} → ${!current}`);
        set({ aiEnabled: !current });
    },
    enableAI: (enabled) => {
        console.log(`[ControlStore] 🤖 AI explicitly set: ${enabled}`);
        set({ aiEnabled: enabled });
    },
    // ═══════════════════════════════════════════════════════════════════
    // ⚛️ WAVE 2073.1: SYSTEM ARM ACTIONS - THE REACTOR SWITCH
    // ═══════════════════════════════════════════════════════════════════
    toggleSystemArm: () => {
        const current = get().systemArmed;
        const newState = !current;
        console.log(`[ControlStore] ⚛️ System ARM toggled: ${current ? 'ARMED' : 'COLD'} → ${newState ? 'ARMED' : 'COLD'}`);
        set({ systemArmed: newState });
    },
    setSystemArmed: (armed) => {
        if (get().systemArmed === armed)
            return;
        const state = armed ? 'ARMED' : 'COLD';
        console.log(`[ControlStore] ⚛️ System ARM explicitly set: ${state}`);
        set({ systemArmed: armed });
    },
    // ═══════════════════════════════════════════════════════════════════
    // 🚦 WAVE 1132: OUTPUT GATE ACTIONS - THE COLD START PROTOCOL
    // ═══════════════════════════════════════════════════════════════════
    toggleOutput: () => {
        const current = get().outputEnabled;
        const newState = !current;
        console.log(`[ControlStore] 🚦 Output toggled: ${current ? 'LIVE' : 'ARMED'} → ${newState ? 'LIVE' : 'ARMED'}`);
        set({ outputEnabled: newState });
    },
    setOutputEnabled: (enabled) => {
        if (get().outputEnabled === enabled)
            return;
        const state = enabled ? 'LIVE' : 'ARMED';
        console.log(`[ControlStore] 🚦 Output explicitly set: ${state}`);
        set({ outputEnabled: enabled });
    },
    // ═══════════════════════════════════════════════════════════════════
    // UI STATE ACTIONS
    // ═══════════════════════════════════════════════════════════════════
    toggleDebugOverlay: () => {
        set((state) => ({ showDebugOverlay: !state.showDebugOverlay }));
    },
    toggleSidebar: () => {
        set((state) => ({ sidebarExpanded: !state.sidebarExpanded }));
    },
    // ═══════════════════════════════════════════════════════════════════
    // COLOR & PALETTE ACTIONS - WAVE 33.2 + 34.5 (Smooth Transitions)
    // ═══════════════════════════════════════════════════════════════════
    setPalette: (palette) => {
        const current = get().activePalette;
        if (current === palette)
            return; // No change needed
        console.log(`[ControlStore] 🎨 Palette transition: ${current} → ${palette}`);
        // Start transition animation
        set({
            targetPalette: palette,
            transitionProgress: 0
        });
        // Animate over 2 seconds
        const duration = 2000;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            if (progress < 1) {
                set({ transitionProgress: progress });
                requestAnimationFrame(animate);
            }
            else {
                // Transition complete
                set({
                    activePalette: palette,
                    targetPalette: null,
                    transitionProgress: 1
                });
                console.log(`[ControlStore] 🎨 Palette transition complete: ${palette}`);
            }
        };
        requestAnimationFrame(animate);
    },
    updateTransition: (progress) => {
        set({ transitionProgress: Math.max(0, Math.min(1, progress)) });
    },
    setGlobalSaturation: (value) => {
        const clamped = Math.max(0, Math.min(1, value));
        console.log(`[ControlStore] 🌈 Saturation: ${clamped.toFixed(2)}`);
        set({ globalSaturation: clamped });
    },
    setGlobalIntensity: (value) => {
        const clamped = Math.max(0, Math.min(1, value));
        console.log(`[ControlStore] 💡 Intensity: ${clamped.toFixed(2)}`);
        set({ globalIntensity: clamped });
    },
    // ═══════════════════════════════════════════════════════════════════
    // 🌊 WAVE 2432: OMNI-LIQUID LAYOUT SWITCH
    // ═══════════════════════════════════════════════════════════════════
    setLiquidLayout: (mode) => {
        console.log(`[ControlStore] 🌊 Layout: ${mode}`);
        set({ liquidLayout: mode, useLiquidStereo: true });
    },
    setLiquidStereo: (enabled) => {
        // Legacy compat — always liquid, just log
        console.log(`[ControlStore] 🌊 Liquid Stereo: ${enabled ? 'ON' : 'OFF (compat)'}`);
        set({ useLiquidStereo: enabled });
    },
    reset: () => {
        console.log('[ControlStore] 🔄 Reset to defaults');
        set(DEFAULT_STATE);
    },
    // ═══════════════════════════════════════════════════════════════════
    // 🏛️ WAVE 4561: SIDEBAR MODE — KINETICS CATHEDRAL
    // ═══════════════════════════════════════════════════════════════════
    setSidebarMode: (mode) => {
        console.log(`[ControlStore] 🏛️ Sidebar mode: ${mode}`);
        set({ sidebarMode: mode });
    },
}), {
    name: 'luxsync-control-store',
    version: 3, // Bumped for WAVE 2401: Liquid Stereo flag
    partialize: (state) => ({
        // Solo persistir preferencias de UI, no estados temporales
        viewMode: state.viewMode,
        showDebugOverlay: state.showDebugOverlay,
        sidebarExpanded: state.sidebarExpanded,
        flowParams: state.flowParams,
        // WAVE 33.2: Persist palette preferences
        activePalette: state.activePalette,
        globalSaturation: state.globalSaturation,
        globalIntensity: state.globalIntensity,
        // WAVE 2432: Persist Liquid Layout preference
        useLiquidStereo: state.useLiquidStereo,
        liquidLayout: state.liquidLayout,
    }),
}));
// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS (Optimized)
// ═══════════════════════════════════════════════════════════════════════════
export const selectViewMode = (state) => state.viewMode;
export const selectGlobalMode = (state) => state.globalMode;
export const selectAIEnabled = (state) => state.aiEnabled;
export const selectFlowParams = (state) => state.flowParams;
export const selectIs3DMode = (state) => state.viewMode === '3D';
export const selectIs2DMode = (state) => state.viewMode === '2D';
// 🚦 WAVE 1132: Output Gate selector
export const selectOutputEnabled = (state) => state.outputEnabled;
// ⚛️ WAVE 2073.1: System ARM selector
export const selectSystemArmed = (state) => state.systemArmed;
// WAVE 33.2: Palette selectors
export const selectActivePalette = (state) => state.activePalette;
export const selectGlobalSaturation = (state) => state.globalSaturation;
export const selectGlobalIntensity = (state) => state.globalIntensity;
// 🛡️ WAVE 2042.13.8: Cinema simulator selector (useShallow required!)
export const selectCinemaControl = (state) => ({
    globalMode: state.globalMode,
    flowParams: state.flowParams,
    activePaletteId: state.activePalette,
    globalIntensity: state.globalIntensity,
    globalSaturation: state.globalSaturation,
    targetPalette: state.targetPalette,
    transitionProgress: state.transitionProgress,
});
