/**
 * ☀️ HYPERION — useFixtureTooltip Hook
 * 
 * Hook para gestionar el estado del tooltip de fixtures.
 * Maneja debounce de aparición, posición, y datos en tiempo real.
 * 
 * Comportamiento:
 * - Aparece 150ms después del hover (debounce)
 * - Desaparece inmediatamente al salir
 * - Se actualiza en tiempo real mientras está visible
 * 
 * @module components/hyperion/widgets/useFixtureTooltip
 * @since WAVE 2042.4 (Project Hyperion — Phase 2)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { FixtureTooltipData } from './FixtureTooltip'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TooltipPosition {
  x: number
  y: number
}

export interface UseFixtureTooltipOptions {
  /** Delay antes de mostrar el tooltip (ms) */
  showDelay?: number
  /** ¿Está el sistema habilitado? */
  enabled?: boolean
}

export interface UseFixtureTooltipReturn {
  /** ¿Está visible el tooltip? */
  visible: boolean
  
  /** Datos del fixture actual (null si no hay hover) */
  data: FixtureTooltipData | null
  
  /** Posición del tooltip (CSS pixels) */
  position: TooltipPosition
  
  /** Llamar cuando el mouse entra en un fixture */
  onFixtureEnter: (
    fixtureId: string,
    data: FixtureTooltipData,
    position: TooltipPosition
  ) => void
  
  /** Llamar cuando el mouse se mueve sobre un fixture */
  onFixtureMove: (position: TooltipPosition) => void
  
  /** Llamar cuando el mouse sale de un fixture */
  onFixtureLeave: () => void
  
  /** Actualizar datos del fixture actual (para real-time updates) */
  updateData: (data: Partial<FixtureTooltipData>) => void
  
  /** Forzar cierre del tooltip */
  close: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useFixtureTooltip({
  showDelay = 150,
  enabled = true,
}: UseFixtureTooltipOptions = {}): UseFixtureTooltipReturn {
  // ── State ─────────────────────────────────────────────────────────────────
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<FixtureTooltipData | null>(null)
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0 })
  
  // ── Refs ──────────────────────────────────────────────────────────────────
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentFixtureIdRef = useRef<string | null>(null)
  const pendingDataRef = useRef<FixtureTooltipData | null>(null)
  
  // ── Cleanup Timer ─────────────────────────────────────────────────────────
  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
  }, [])
  
  // ── Effect: Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearShowTimer()
    }
  }, [clearShowTimer])
  
  // ── Handlers ──────────────────────────────────────────────────────────────
  
  const onFixtureEnter = useCallback((
    fixtureId: string,
    fixtureData: FixtureTooltipData,
    pos: TooltipPosition
  ) => {
    if (!enabled) return
    
    // Clear any pending show timer
    clearShowTimer()
    
    // Store pending data
    currentFixtureIdRef.current = fixtureId
    pendingDataRef.current = fixtureData
    setPosition(pos)
    
    // Start debounce timer
    showTimerRef.current = setTimeout(() => {
      if (pendingDataRef.current && currentFixtureIdRef.current === fixtureId) {
        setData(pendingDataRef.current)
        setVisible(true)
      }
    }, showDelay)
  }, [enabled, showDelay, clearShowTimer])
  
  const onFixtureMove = useCallback((pos: TooltipPosition) => {
    setPosition(pos)
  }, [])
  
  const onFixtureLeave = useCallback(() => {
    // Clear timer and hide immediately
    clearShowTimer()
    currentFixtureIdRef.current = null
    pendingDataRef.current = null
    setVisible(false)
    // Keep data for exit animation
    // setData(null) — delay this for smoother animation
    setTimeout(() => {
      if (!currentFixtureIdRef.current) {
        setData(null)
      }
    }, 200)
  }, [clearShowTimer])
  
  const updateData = useCallback((updates: Partial<FixtureTooltipData>) => {
    setData(current => {
      if (!current) return null
      return { ...current, ...updates }
    })
    // Also update pending data if we're in debounce phase
    if (pendingDataRef.current) {
      pendingDataRef.current = { ...pendingDataRef.current, ...updates }
    }
  }, [])
  
  const close = useCallback(() => {
    clearShowTimer()
    currentFixtureIdRef.current = null
    pendingDataRef.current = null
    setVisible(false)
    setData(null)
  }, [clearShowTimer])
  
  // ── Return ────────────────────────────────────────────────────────────────
  return {
    visible,
    data,
    position,
    onFixtureEnter,
    onFixtureMove,
    onFixtureLeave,
    updateData,
    close,
  }
}

export default useFixtureTooltip
