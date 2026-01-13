/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌉 TITAN SYNC BRIDGE - WAVE 377
 * "El Sistema Nervioso - Conectando Frontend y Backend"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este componente INVISIBLE sincroniza automáticamente el stageStore con el
 * backend. Cuando el usuario modifica fixtures (añade, borra, mueve), los
 * cambios se propagan al MasterArbiter para que conozca el patch actual.
 *
 * ARQUITECTURA:
 * - Escucha cambios en stageStore.fixtures
 * - Debounce de 500ms para no saturar IPC
 * - Envía lux:arbiter:setFixtures cuando hay cambios
 *
 * INTEGRACIÓN:
 * - Montar en App.tsx (componente invisible, sin render visual)
 * - El backend recibe fixtures actualizados automáticamente
 *
 * AXIOMA PUNK:
 * - CERO Math.random()
 * - CERO polling
 * - Reactividad pura vía Zustand subscriptions
 *
 * @module core/sync/TitanSyncBridge
 * @version WAVE 377.1
 */
import { useEffect, useRef, useCallback } from 'react';
import { useStageStore } from '../../stores/stageStore';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/** Debounce time in ms - prevents IPC flooding when dragging fixtures */
const SYNC_DEBOUNCE_MS = 500;
// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
/**
 * TitanSyncBridge - Invisible component that syncs stageStore → Backend
 *
 * Mount this component once at the root level (App.tsx).
 * It watches for fixture changes and syncs them to the backend automatically.
 */
export const TitanSyncBridge = () => {
    // Get fixtures directly from store
    const fixtures = useStageStore((state) => state.fixtures);
    // Refs for debounce
    const debounceTimeoutRef = useRef(null);
    const lastSyncedHashRef = useRef('');
    const mountedRef = useRef(false);
    /**
     * Generate a hash from fixtures array to detect actual changes
     */
    const generateFixturesHash = useCallback((fixtureList) => {
        if (!fixtureList || fixtureList.length === 0)
            return 'empty';
        return fixtureList
            .map(f => `${f.id}:${f.dmxAddress}:${f.universe}:${f.zone}:${f.type}`)
            .sort()
            .join('|');
    }, []);
    /**
     * Sync fixtures to backend via IPC
     */
    const syncToBackend = useCallback(async (fixtureList) => {
        // Check if window.lux exists (Electron environment)
        const lux = window.lux;
        if (!lux) {
            console.warn('[TitanSyncBridge] ⚠️ window.lux not available');
            return;
        }
        // Convert stageStore fixtures to ArbiterFixture format
        const arbiterFixtures = fixtureList.map(f => ({
            id: f.id,
            name: f.name || f.id,
            dmxAddress: f.dmxAddress,
            universe: f.universe || 0,
            zone: f.zone || 'UNASSIGNED',
            type: f.type,
            channels: f.channels || [],
            capabilities: f.capabilities || {},
            position: f.position,
            rotation: f.rotation,
        }));
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
    }, []);
    // ═══════════════════════════════════════════════════════════════════════
    // EFFECT: Watch fixtures and sync
    // ═══════════════════════════════════════════════════════════════════════
    useEffect(() => {
        // Log on first mount only
        if (!mountedRef.current) {
            console.log('[TitanSyncBridge] 🌉 Bridge ONLINE - watching fixtures');
            mountedRef.current = true;
        }
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
        // Cleanup timeout on unmount or before next effect
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [fixtures, generateFixturesHash, syncToBackend]);
    // ═══════════════════════════════════════════════════════════════════════
    // RENDER - Invisible component
    // ═══════════════════════════════════════════════════════════════════════
    return null;
};
export default TitanSyncBridge;
