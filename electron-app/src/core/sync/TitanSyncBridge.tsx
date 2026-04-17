/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌉 TITAN SYNC BRIDGE - WAVE 377 + WAVE 378.6 + WAVE 406 FIX
 * "El Sistema Nervioso - Conectando Frontend y Backend"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este componente INVISIBLE sincroniza automáticamente el stageStore con el
 * backend. Cuando el usuario modifica fixtures (añade, borra, mueve), los
 * cambios se propagan al MasterArbiter para que conozca el patch actual.
 * 
 * ARQUITECTURA:
 * - Escucha cambios en stageStore.fixtures VIA ZUSTAND SUBSCRIBE (no React)
 * - Debounce de 200ms para no saturar IPC (reducido de 500ms para mejor UX)
 * - Envía lux:arbiter:setFixtures cuando hay cambios
 * 
 * WAVE 378.6 FIX:
 * - REMOVED: useStageStore hook subscription (caused re-renders)
 * - ADDED: Direct Zustand subscribe() - NO React re-renders
 * - This prevents WebGL Context Lost during fixture sync
 * 
 * WAVE 406 FIX:
 * - ADDED: Backend Ready Check - waits for window.lux.arbiter.setFixtures
 * - ADDED: Retry logic with hash invalidation on IPC failure
 * - FIXED: Race condition eliminated - polling hasta 5 segundos
 * - FIXED: Silent failures replaced with loud error logs
 * 
 * INTEGRACIÓN:
 * - Montar en App.tsx (componente invisible, sin render visual)
 * - El backend recibe fixtures actualizados automáticamente
 * 
 * AXIOMA PUNK:
 * - CERO Math.random()
 * - CERO polling infinito (max 5 seg, luego error)
 * - Reactividad pura vía Zustand subscriptions (NOT React hooks)
 * 
 * @module core/sync/TitanSyncBridge
 * @version WAVE 406
 */

import { useEffect, useRef } from 'react'
import { useStageStore } from '../../stores/stageStore'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** 🔧 WAVE 406: Debounce reducido a 200ms (era 500ms) - mejor responsiveness */
const SYNC_DEBOUNCE_MS = 200

/** 🔧 WAVE 406: Timeout para IPC ready check - 5 segundos max */
const IPC_READY_TIMEOUT_MS = 5000

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (outside component to prevent recreation)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a hash from fixtures array to detect actual changes.
 * 🔥 WAVE 2241: Include channelCount + profileId so Forge profile edits
 * (channel additions, type changes, defaults) always trigger a backend resync.
 */
const generateFixturesHash = (fixtureList: any[]): string => {
  if (!fixtureList || fixtureList.length === 0) return 'empty'
  
  return fixtureList
    .map(f => `${f.id}:${f.dmxAddress}:${f.universe}:${f.zone}:${f.type}:${f.channelCount ?? f.channels?.length ?? 0}:${f.profileId ?? ''}`)
    .sort()
    .join('|')
}

/**
 * 🩸 WAVE 382: Sync fixtures to backend via IPC
 * 🔧 WAVE 406: Blindado contra fallos - retry logic + invalidación de hash
 * Now includes hasMovementChannels for proper mover detection
 */
const syncToBackend = async (fixtureList: any[], lastSyncedHashRef: React.MutableRefObject<string>) => {
  const lux = (window as any).lux
  
  if (!lux?.arbiter?.setFixtures) {
    console.warn('[TitanSyncBridge] ⚠️ Lost connection to Backend during sync!')
    return
  }
  
  // Convert stageStore fixtures to ArbiterFixture format
  const arbiterFixtures = fixtureList.map(f => {
    // 🩸 WAVE 382: Detect movers from type string
    const type = (f.type || '').toLowerCase()
    const hasMovementChannels = type.includes('moving') || 
                                type.includes('spot') || 
                                type.includes('beam') ||
                                Boolean(f.capabilities?.hasMovement)
    
    return {
      id: f.id,
      name: f.name || f.id,
      dmxAddress: f.dmxAddress || (f as any).address,  // 🎨 WAVE 686.11.5: Normalize address (ShowFileV2 uses "address")
      universe: f.universe || 0,
      zone: f.zone || 'UNASSIGNED',
      type: f.type || 'generic',
      channels: f.channels || [],
      capabilities: f.capabilities || {},
      hasMovementChannels,  // 🩸 WAVE 382: Explicit flag
      // 🎨 WAVE 1001: HAL Color Translation - Pass color capability flags
      hasColorWheel: (f as any).hasColorWheel || Boolean(f.capabilities?.hasColorWheel) || false,
      hasColorMixing: (f as any).hasColorMixing || Boolean(f.capabilities?.hasColorMixing) || false,
      profileId: (f as any).profileId || f.id,  // Use fixture ID as default profile ID
      // 🔧 WAVE 2221: Pass orientation from Forge physics → backend installationType
      // Without this, TitanOrchestrator always falls back to 'ceiling'
      installationType: f.physics?.orientation || 'ceiling',
      position: f.position,
      rotation: f.rotation,
      // 🛡️ WAVE 3110: VIRTUAL FIXTURE FLAG — propagate to backend
      isVirtual: f.isVirtual ?? false,
    }
  })
  
  try {
    // 📡 WAVE 2770: THE BLACK BOX — Store Sync Monitor
    // Log every setFixtures invocation with fixture count, hash, and timestamp.
    // This reveals if TitanSyncBridge re-fires and wipes state unexpectedly.
    const syncHash = generateFixturesHash(arbiterFixtures)
    console.log(
      `[📡 SYNC_BRIDGE] setFixtures FIRED: ${arbiterFixtures.length} fixtures | Hash: ${syncHash.slice(0, 16)}… | Time: ${new Date().toISOString()}`
    )

    const result = await lux.arbiter.setFixtures(arbiterFixtures)
    // 🔧 WAVE 406: Log de éxito visual
    console.log(`[TitanSyncBridge] ✅ SYNC OK: ${result?.fixtureCount || arbiterFixtures.length} fixtures active.`)
  } catch (err) {
    console.error('[TitanSyncBridge] ❌ SYNC FAILED:', err)
    // 🔧 WAVE 406: Invalidar hash para reintentar en siguiente cambio
    lastSyncedHashRef.current = ''
  }
}

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
export const TitanSyncBridge: React.FC = () => {
  // Refs for debounce and tracking
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedHashRef = useRef<string>('')
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT: WAVE 406 - Backend Ready Check (The Waiting Game)
  // Wait for IPC to be ready BEFORE subscribing to prevent race condition
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    let isMounted = true
    let unsubscribeStore: (() => void) | undefined
    
    const initBridge = async () => {
      console.log('[TitanSyncBridge] 🌉 Bridge STARTING - Waiting for IPC...')
      
      // 🔧 WAVE 406: Polling para esperar a window.lux (Max 5 seg)
      let attempts = 0
      const maxAttempts = Math.ceil(IPC_READY_TIMEOUT_MS / 100) // 5000ms / 100ms = 50 attempts
      while (attempts < maxAttempts) {
        const lux = (window as any).lux
        if (lux && lux.arbiter && lux.arbiter.setFixtures) {
          console.log(`[TitanSyncBridge] ✅ IPC Ready after ${attempts * 100}ms`)
          break
        }
        await new Promise(r => setTimeout(r, 100))
        attempts++
        if (!isMounted) return // Si desmontamos mientras esperamos
      }
      
      if (!(window as any).lux?.arbiter?.setFixtures) {
        console.error('[TitanSyncBridge] ❌ CRITICAL: IPC TIMEOUT. Backend unreachable.')
        return // TODO: Notificación UI
      }
      
      // 🔧 WAVE 406: Suscribirse SOLO cuando el backend está listo
      console.log('[TitanSyncBridge] 🔗 Subscribing to StageStore...')
      
      unsubscribeStore = useStageStore.subscribe(
        (state) => state.fixtures,
        (fixtures) => {
          // Generate hash to detect actual content changes
          const currentHash = generateFixturesHash(fixtures)
          
          // Skip if no actual change
          if (currentHash === lastSyncedHashRef.current) {
            return
          }
          
          // Clear existing debounce
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current)
          }
          
          // 🔧 WAVE 406: Debounce reducido (mejor respuesta)
          debounceTimeoutRef.current = setTimeout(() => {
            if (!isMounted) return
            lastSyncedHashRef.current = currentHash
            console.log(`[TitanSyncBridge] 🔄 Syncing ${fixtures.length} fixtures...`)
            syncToBackend(fixtures, lastSyncedHashRef)
          }, SYNC_DEBOUNCE_MS) // WAVE 406: 200ms (era 500ms)
        },
        { fireImmediately: true } // Sync on mount if fixtures already exist
      )
    }
    
    initBridge()
    
    // Cleanup on unmount
    return () => {
      isMounted = false
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (unsubscribeStore) {
        unsubscribeStore()
      }
      console.log('[TitanSyncBridge] 🌉 Bridge STOPPED')
    }
  }, []) // Empty deps - only run once on mount
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT: WAVE 2241 — THE FORGE HOT-RELOAD
  // Listen for lux:profile:updated (pushed by backend after Forge save).
  // 1. Reconcile stage fixtures in Zustand (names, channels, capabilities, physics)
  // 2. Invalidate the hash so the Zustand subscriber above ALWAYS fires a resync
  //    to TitanOrchestrator, even when dmxAddress/universe didn't change.
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const lux = (window as any).lux
    if (!lux?.library?.onProfileUpdated) return

    const unsubProfileUpdated = lux.library.onProfileUpdated((updatedProfile: any) => {
      console.log(`[TitanSyncBridge] 🔥 WAVE 2241: Profile hot-reload — id: ${updatedProfile.id}, name: ${updatedProfile.name}`)

      // Step 1: Bust the hash BEFORE mutating the store.
      // Zustand may call the subscriber synchronously inside reconcile,
      // so if we invalidate after, the subscriber sees the old hash and skips the resync.
      lastSyncedHashRef.current = ''

      // Step 2: Hydrate stageStore fixtures that use this profileId.
      // This calls _syncDerivedState() which triggers the Zustand subscriber above,
      // which (with the busted hash) will schedule syncToBackend with the updated channels.
      useStageStore.getState().reconcileFixturesWithProfile(updatedProfile)
    })

    return () => unsubProfileUpdated?.()
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER - Invisible component (renders ONCE, never re-renders)
  // ═══════════════════════════════════════════════════════════════════════
  
  return null
}

export default TitanSyncBridge
