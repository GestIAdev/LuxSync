/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ TRANSIENT STORE - WAVE 348: TIERRA QUEMADA
 * "El Bypass de React para Actualizaciones de 60fps"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROBLEMA:
 * React/Zustand NO puede manejar 60 actualizaciones por segundo.
 * El "Reconciler" colapsa comparando DOM virtual.
 * 
 * SOLUCIÓN:
 * Store MUTABLE fuera de React. Sin setState, sin re-renders.
 * Three.js lee directamente con useFrame (bypaseando React).
 * 
 * FILOSOFÍA:
 * - React maneja LAYOUT (fixtures aparecen/desaparecen, cambio de vibe)
 * - Transient maneja PHYSICS (pan/tilt que cambian 60 veces/seg)
 * 
 * @module stores/transientStore
 * @version 348.0.0
 */

import type { SeleneTruth } from '../core/protocol/SeleneProtocol'

// ═══════════════════════════════════════════════════════════════════════════
// MUTABLE REFERENCE - "The Ghost Store"
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 👻 Store Fantasma: React no lo ve, no causa re-renders
 * 
 * Actualizado 60 veces/seg por IPC listener
 * Leído 60 veces/seg por Three.js useFrame
 * 
 * CERO overhead de React.
 */
const transientRef: {
  current: SeleneTruth | null
  frameCount: number
  lastUpdateTime: number
} = {
  current: null,
  frameCount: 0,
  lastUpdateTime: 0,
}

// ═══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 💉 Inyectar nueva verdad (llamado por IPC listener)
 * NO causa re-render. Solo actualiza la referencia mutable.
 */
export function injectTransientTruth(truth: SeleneTruth): void {
  transientRef.current = truth
  transientRef.frameCount++
  transientRef.lastUpdateTime = Date.now()
}

/**
 * 🔍 Leer verdad transiente (llamado por Three.js useFrame)
 * Acceso directo sin pasar por React.
 */
export function getTransientTruth(): SeleneTruth | null {
  return transientRef.current
}

/**
 * 🔍 Leer fixture específico por ID (optimización)
 */
export function getTransientFixture(fixtureId: string) {
  const truth = transientRef.current
  if (!truth?.hardware?.fixtures) return null
  
  return truth.hardware.fixtures.find(f => f?.id === fixtureId)
}

/**
 * 📊 Stats para debug
 */
export function getTransientStats() {
  return {
    frameCount: transientRef.frameCount,
    lastUpdateTime: transientRef.lastUpdateTime,
    hasData: transientRef.current !== null,
    fixtureCount: transientRef.current?.hardware?.fixtures?.length || 0,
  }
}
