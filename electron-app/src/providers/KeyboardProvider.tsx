/**
 * 🎹 KEYBOARD PROVIDER - Global Keyboard Shortcuts
 * WAVE 9: Space=Blackout, 1-6=Effects, Tab=Navigation
 * WAVE 3304: Space/ESC use absolute setBlackout — sin toggle, sin deadlock
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

interface KeyboardProviderProps {
  children: React.ReactNode
}

const KeyboardProvider: React.FC<KeyboardProviderProps> = ({ children }) => {
  const { blackout, setBlackout, toggleEffect } = useEffectsStore(useShallow(selectKeyboardEffects))
  const { nextTab, prevTab } = useNavigationStore(useShallow(selectKeyboardNav))

  const isTypingInInput = useCallback((e: KeyboardEvent): boolean => {
    const target = e.target as HTMLElement
    const tagName = target.tagName.toLowerCase()
    return tagName === 'input' || tagName === 'textarea' || target.isContentEditable
  }, [])

  // 🔴 WAVE 3304: Absolute blackout setter — lee estado actual, envía opuesto
  const handleBlackoutToggle = useCallback(() => {
    const currentBlackout = useEffectsStore.getState().blackout
    const targetState = !currentBlackout

    window.lux?.arbiter?.setBlackout(targetState)
      .then((result: { success?: boolean; blackoutActive?: boolean }) => {
        if (result?.success) {
          setBlackout(result.blackoutActive ?? targetState)
          console.log(`[Keyboard] 🔴 Blackout: ${result.blackoutActive ? 'ON' : 'OFF'}`)
        } else {
          console.error('[Keyboard] Blackout IPC failed:', result)
        }
      })
      .catch((err: unknown) => {
        console.error('[Keyboard] Blackout IPC error:', err)
      })
  }, [setBlackout])

  // 🔴 WAVE 3304: ESC = release absoluto, siempre false
  const handleBlackoutRelease = useCallback(() => {
    window.lux?.arbiter?.setBlackout(false)
      .then((result: { success?: boolean; blackoutActive?: boolean }) => {
        if (result?.success) {
          setBlackout(result.blackoutActive ?? false)
          console.log('[Keyboard] 🔴 Blackout released via ESC')
        }
      })
      .catch((err: unknown) => {
        console.error('[Keyboard] Blackout release IPC error:', err)
      })
  }, [setBlackout])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isTyping = isTypingInInput(e)

    // BLACKOUT - Space - SIEMPRE FUNCIONA
    if (e.code === 'Space') {
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

    // ESC - Release blackout (si activo)
    if (e.code === 'Escape') {
      const { blackout: isBlackout } = useEffectsStore.getState()
      if (isBlackout) {
        handleBlackoutRelease()
      }
      return
    }

  }, [handleBlackoutToggle, handleBlackoutRelease, toggleEffect, nextTab, prevTab, isTypingInInput])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
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
