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
 * - Envía lux:stage:updateFixtures cuando hay cambios
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
 * @version WAVE 377
 */

import { useEffect, useRef, useCallback } from 'react'
import { useStageStore } from '../../stores/stageStore'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Debounce time in ms - prevents IPC flooding when dragging fixtures */
const SYNC_DEBOUNCE_MS = 500

/** Debug logging */
const DEBUG = false

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TitanSyncBridge - Invisible component that syncs stageStore → Backend
 * 
 * Mount this component once at the root level (App.tsx).
 * It watches for fixture changes and syncs them to the backend automatically.
 */
export const TitanSyncBridge: React.FC = () => {
  // Refs for debounce
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedHashRef = useRef<string>('')
  
  /**
   * Generate a hash from fixtures array to detect actual changes
   * This avoids unnecessary syncs when the array reference changes but content doesn't
   */
  const generateFixturesHash = useCallback((fixtures: any[]): string => {
    if (!fixtures || fixtures.length === 0) return 'empty'
    
    // Create a deterministic hash from fixture properties that affect backend
    return fixtures
      .map(f => `${f.id}:${f.dmxAddress}:${f.universe}:${f.zone}:${f.type}`)
      .sort()
      .join('|')
  }, [])
  
  /**
   * Sync fixtures to backend via IPC
   */
  const syncToBackend = useCallback(async (fixtures: any[]) => {
    // Check if window.lux exists (Electron environment)
    if (typeof window === 'undefined' || !('lux' in window)) {
      if (DEBUG) console.log('[TitanSyncBridge] ⚠️ Not in Electron environment')
      return
    }
    
    const lux = window.lux as any
    
    // Convert stageStore fixtures to ArbiterFixture format
    const arbiterFixtures = fixtures.map(f => ({
      id: f.id,
      name: f.name || f.id,
      dmxAddress: f.dmxAddress,
      universe: f.universe || 0,
      zone: f.zone || 'UNASSIGNED',
      type: f.type,
      channels: f.channels || [],
      capabilities: f.capabilities || {},
      // Position data for 3D sync
      position: f.position,
      rotation: f.rotation,
    }))
    
    try {
      // Use arbiter's setFixtures or a dedicated sync channel
      // First try the arbiter status to verify connection
      if (lux.arbiter?.status) {
        // The backend MasterArbiter has setFixtures() method
        // We need an IPC channel for this - using custom invoke
        await (window as any).electron?.ipcRenderer?.invoke?.('lux:arbiter:setFixtures', {
          fixtures: arbiterFixtures
        })
        
        if (DEBUG) {
          console.log(`[TitanSyncBridge] ✅ Synced ${arbiterFixtures.length} fixtures to backend`)
        }
      }
    } catch (err) {
      // Silently fail if channel doesn't exist yet
      if (DEBUG) {
        console.warn('[TitanSyncBridge] ⚠️ Backend sync failed:', err)
      }
    }
  }, [])
  
  /**
   * Handle fixture changes with debounce
   */
  const handleFixturesChange = useCallback((fixtures: any[]) => {
    // Generate hash to detect actual content changes
    const currentHash = generateFixturesHash(fixtures)
    
    // Skip if no actual change
    if (currentHash === lastSyncedHashRef.current) {
      if (DEBUG) console.log('[TitanSyncBridge] 📋 No change detected, skipping')
      return
    }
    
    // Clear existing debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    // Debounce the sync
    debounceTimeoutRef.current = setTimeout(() => {
      lastSyncedHashRef.current = currentHash
      syncToBackend(fixtures)
      
      console.log(`[TitanSyncBridge] 🌉 Synced ${fixtures.length} fixtures → Backend`)
    }, SYNC_DEBOUNCE_MS)
  }, [generateFixturesHash, syncToBackend])
  
  // ═══════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    console.log('[TitanSyncBridge] 🌉 Bridge online - watching stageStore.fixtures')
    
    // Subscribe to fixtures changes
    const unsubscribe = useStageStore.subscribe(
      (state) => state.fixtures,
      (fixtures) => {
        handleFixturesChange(fixtures)
      },
      { fireImmediately: true }
    )
    
    // Cleanup
    return () => {
      console.log('[TitanSyncBridge] 🌉 Bridge offline')
      unsubscribe()
      
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [handleFixturesChange])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER - Invisible component
  // ═══════════════════════════════════════════════════════════════════════
  
  return null
}

export default TitanSyncBridge
