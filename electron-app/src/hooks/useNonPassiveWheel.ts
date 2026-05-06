/**
 * 🔧 useNonPassiveWheel — WAVE 4568
 *
 * Registra un wheel event listener con { passive: false } para poder
 * llamar e.preventDefault() sin triggear el warning del navegador:
 * "Unable to preventDefault inside passive event listener invocation"
 *
 * React sintético no soporta passive: false — hay que ir al DOM directamente.
 */

import { useEffect } from 'react'

export function useNonPassiveWheel(
  ref: React.RefObject<HTMLElement | null>,
  handler: (e: WheelEvent) => void,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('wheel', handler, { passive: false })
    return () => {
      el.removeEventListener('wheel', handler)
    }
  }, [ref, handler])
}
