/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌉 TITAN SYNC BRIDGE - WAVE 377 + WAVE 378.6 FIX
 * "El Sistema Nervioso - Conectando Frontend y Backend"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este componente INVISIBLE sincroniza automáticamente el stageStore con el
 * backend. Cuando el usuario modifica fixtures (añade, borra, mueve), los
 * cambios se propagan al MasterArbiter para que conozca el patch actual.
 *
 * ARQUITECTURA:
 * - Escucha cambios en stageStore.fixtures VIA ZUSTAND SUBSCRIBE (no React)
 * - Debounce de 500ms para no saturar IPC
 * - Envía lux:arbiter:setFixtures cuando hay cambios
 *
 * WAVE 378.6 FIX:
 * - REMOVED: useStageStore hook subscription (caused re-renders)
 * - ADDED: Direct Zustand subscribe() - NO React re-renders
 * - This prevents WebGL Context Lost during fixture sync
 *
 * INTEGRACIÓN:
 * - Montar en App.tsx (componente invisible, sin render visual)
 * - El backend recibe fixtures actualizados automáticamente
 *
 * AXIOMA PUNK:
 * - CERO Math.random()
 * - CERO polling
 * - Reactividad pura vía Zustand subscriptions (NOT React hooks)
 *
 * @module core/sync/TitanSyncBridge
 * @version WAVE 378.6
 */
import { useEffect, useRef } from 'react';
import { useStageStore } from '../../stores/stageStore';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/** Debounce time in ms - prevents IPC flooding when dragging fixtures */
const SYNC_DEBOUNCE_MS = 500;
// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (outside component to prevent recreation)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Generate a hash from fixtures array to detect actual changes
 */
const generateFixturesHash = (fixtureList) => {
    if (!fixtureList || fixtureList.length === 0)
        return 'empty';
    return fixtureList
        .map(f => `${f.id}:${f.dmxAddress}:${f.universe}:${f.zone}:${f.type}`)
        .sort()
        .join('|');
};
/**
 * 🩸 WAVE 382: Sync fixtures to backend via IPC
 * Now includes hasMovementChannels for proper mover detection
 */
const syncToBackend = async (fixtureList) => {
    // Check if window.lux exists (Electron environment)
    const lux = window.lux;
    if (!lux) {
        console.warn('[TitanSyncBridge] ⚠️ window.lux not available');
        return;
    }
    // Convert stageStore fixtures to ArbiterFixture format
    const arbiterFixtures = fixtureList.map(f => {
        // 🩸 WAVE 382: Detect movers from type string
        const type = (f.type || '').toLowerCase();
        const hasMovementChannels = type.includes('moving') ||
            type.includes('spot') ||
            type.includes('beam') ||
            Boolean(f.capabilities?.hasMovement);
        return {
            id: f.id,
            name: f.name || f.id,
            dmxAddress: f.dmxAddress,
            universe: f.universe || 0,
            zone: f.zone || 'UNASSIGNED',
            type: f.type || 'generic',
            channels: f.channels || [],
            capabilities: f.capabilities || {},
            hasMovementChannels, // 🩸 WAVE 382: Explicit flag
            position: f.position,
            rotation: f.rotation,
        };
    });
    try {
        if (lux.arbiter?.setFixtures) {
            await lux.arbiter.setFixtures(arbiterFixtures);
            console.log(`[TitanSyncBridge] ✅ Synced ${arbiterFixtures.length} fixtures to Arbiter`);
        }
        else {
            console.warn('[TitanSyncBridge] ⚠️ lux.arbiter.setFixtures not available');
        }
    }
    catch (err) {
        console.warn('[TitanSyncBridge] ⚠️ Backend sync failed:', err);
    }
};
// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
/**
 * TitanSyncBridge - Invisible component that syncs stageStore → Backend
 *
 * WAVE 378.6: Uses Zustand subscribe() instead of hook to prevent re-renders
 *
 * Mount this component once at the root level (App.tsx).
 * It watches for fixture changes and syncs them to the backend automatically.
 */
export const TitanSyncBridge = () => {
    // Refs for debounce and tracking
    const debounceTimeoutRef = useRef(null);
    const lastSyncedHashRef = useRef('');
    // ═══════════════════════════════════════════════════════════════════════
    // EFFECT: Subscribe to store DIRECTLY (not via React hook)
    // This prevents re-renders and WebGL Context Lost
    // ═══════════════════════════════════════════════════════════════════════
    useEffect(() => {
        console.log('[TitanSyncBridge] 🌉 Bridge ONLINE - subscribing to fixtures (WAVE 378.6)');
        // Subscribe to store changes OUTSIDE of React's render cycle
        const unsubscribe = useStageStore.subscribe((state) => state.fixtures, (fixtures, prevFixtures) => {
            // Generate hash to detect actual content changes
            const currentHash = generateFixturesHash(fixtures);
            // Skip if no actual change
            if (currentHash === lastSyncedHashRef.current) {
                return;
            }
            // Clear existing debounce
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            // Debounce the sync
            debounceTimeoutRef.current = setTimeout(() => {
                lastSyncedHashRef.current = currentHash;
                console.log(`[TitanSyncBridge] 🌉 Fixtures changed (${fixtures.length}) → syncing...`);
                syncToBackend(fixtures);
            }, SYNC_DEBOUNCE_MS);
        }, { fireImmediately: true } // Sync on mount if fixtures already exist
        );
        // Cleanup on unmount
        return () => {
            console.log('[TitanSyncBridge] 🌉 Bridge OFFLINE');
            unsubscribe();
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, []); // Empty deps - only run once on mount
    // ═══════════════════════════════════════════════════════════════════════
    // RENDER - Invisible component (renders ONCE, never re-renders)
    // ═══════════════════════════════════════════════════════════════════════
    return null;
};
export default TitanSyncBridge;
