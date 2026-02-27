/**
 * 🎹 KEYBOARD PROVIDER - Global Keyboard Shortcuts
 * WAVE 9: Space=Blackout, 1-6=Effects, Tab=Navigation
 * WAVE 2074: Space/ESC now call REAL IPC blackout toggle (not just store)
 * 
 * CRÍTICO: Blackout SIEMPRE funciona, en cualquier pestaña!
 */

import React, { useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEffectsStore, EffectId, selectKeyboardEffects } from '../stores/effectsStore'
import { useNavigationStore, selectKeyboardNav } from '../stores/navigationStore'

// Mapeo de teclas a efectos
const EFFECT_KEYS: Record<string, EffectId> = {
  '1': 'strobe',
  '2': 'blinder',
  '3': 'smoke',
  '4': 'laser',
  '5': 'rainbow',
  '6': 'police',
}

// Teclas que siempre funcionan (incluso en inputs)
const GLOBAL_KEYS = ['Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']

interface KeyboardProviderProps {
  children: React.ReactNode
}

const KeyboardProvider: React.FC<KeyboardProviderProps> = ({ children }) => {
  // 🛡️ WAVE 2042.13.8: useShallow for stable references
  const { toggleBlackout, toggleEffect } = useEffectsStore(useShallow(selectKeyboardEffects))
  const { nextTab, prevTab } = useNavigationStore(useShallow(selectKeyboardNav))

  // Check if user is typing in an input
  const isTypingInInput = useCallback((e: KeyboardEvent): boolean => {
    const target = e.target as HTMLElement
    const tagName = target.tagName.toLowerCase()
    return tagName === 'input' || tagName === 'textarea' || target.isContentEditable
  }, [])

  // ⚡ WAVE 2074: Real blackout toggle — IPC + store in one action
  // This is THE canonical blackout handler for keyboard shortcuts
  const handleBlackoutToggle = useCallback(async () => {
    toggleBlackout() // Optimistic UI
    try {
      const result = await window.lux?.arbiter?.toggleBlackout()
      if (result?.success) {
        console.log(`[Keyboard] 🔴 Blackout: ${result.active ? 'ON' : 'OFF'}`)
      } else {
        console.error('[Keyboard] Blackout IPC failed:', result)
        toggleBlackout() // Rollback
      }
    } catch (err) {
      console.error('[Keyboard] Blackout IPC error:', err)
      toggleBlackout() // Rollback
    }
  }, [toggleBlackout])

  // Main keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isTyping = isTypingInInput(e)

    // BLACKOUT - Space - SIEMPRE FUNCIONA
    if (e.code === 'Space') {
      // Solo prevenir si no está escribiendo
      if (!isTyping) {
        e.preventDefault()
        handleBlackoutToggle()
      }
      return
    }

    // EFFECTS 1-6 - SIEMPRE FUNCIONAN (excepto si está escribiendo)
    if (!isTyping && EFFECT_KEYS[e.key]) {
      e.preventDefault()
      toggleEffect(EFFECT_KEYS[e.key])
      console.log(`[Keyboard] ⚡ Effect ${EFFECT_KEYS[e.key]} toggled`)
      return
    }

    // NAVIGATION - Tab - Solo cuando no está escribiendo
    if (!isTyping && e.code === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        prevTab()
        console.log('[Keyboard] ◀ Previous tab')
      } else {
        nextTab()
        console.log('[Keyboard] ▶ Next tab')
      }
      return
    }

    // ESC - Clear blackout / close modals
    if (e.code === 'Escape') {
      const { blackout } = useEffectsStore.getState()
      if (blackout) {
        handleBlackoutToggle()
      }
      return
    }

  }, [handleBlackoutToggle, toggleEffect, nextTab, prevTab, isTypingInInput])

  // Setup global listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    // 🧹 WAVE 63.7: Log silenciado
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return <>{children}</>
}

export default KeyboardProvider

// Hook para acceso directo a shortcuts info
export const useKeyboardShortcuts = () => ({
  blackout: 'Space',
  effects: EFFECT_KEYS,
  nextTab: 'Tab',
  prevTab: 'Shift+Tab',
  escape: 'Esc',
})
