/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 engineSync.ts — COALESCER rAF (CANAL A → MOTOR)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Puente entre el store Zustand (edición, baja frecuencia) y el motor
 * (resolve + graft, alta frecuencia durante drag).
 *
 * ── PROBLEMA ───────────────────────────────────────────────────────────────
 * Arrastrar un slider dispara `setGene` a ~60 Hz. Cada `setGene` actualiza
 * el draft. Si hiciéramos resolve+graft en cada cambio, el motor recibiría
 * 60 resolve+graft por segundo, cada uno clonando 7 configs. Eso es
 * ~420 clones/s — demasiado.
 *
 * ── SOLUCIÓN ───────────────────────────────────────────────────────────────
 * El coalescer encola un único flush por frame de rAF. Si llegan 10
 * `setGene` en un mismo frame, sólo el último estado del draft se envía
 * al motor. El motor ve como máximo 60 resolve+graft/s (uno por frame),
 * que es la frecuencia máxima perceptible.
 *
 * ── A/B MODE ───────────────────────────────────────────────────────────────
 * Si `abMode === 'base'`, el coalescer aplica el ADN base puro (sin
 * mutaciones) en lugar del draft. Esto permite comparar instantáneamente
 * el vibe original vs el mutado.
 *
 * @module stores/vibeLab/engineSync
 * @version FASE 1B — The Fusion Core
 */

import { useVibeLabStore } from '../vibeLabStore'
import { resolveCustomVibe } from '../../engine/vibe/custom/VibeFusionResolver'
import { graft, ungraftAll } from '../../engine/vibe/custom/VibeGraftRegistry'
import type { CustomVibeKey } from '../../types/CustomVibe'
import type { VibeLabState } from '../vibeLabStore'

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO DEL COALESCER
// ═══════════════════════════════════════════════════════════════════════════

let pending = false
let lastGrafted: CustomVibeKey | null = null
let unsubscribe: (() => void) | null = null
let initialized = false

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK: rAF polyfill para Node (tests)
// ═══════════════════════════════════════════════════════════════════════════

const raf =
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16)

// ═══════════════════════════════════════════════════════════════════════════
// FLUSH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ejecuta un resolve+graft del draft actual. Se llama desde el rAF,
 * como máximo una vez por frame.
 */
function flush(): void {
  pending = false
  const state = useVibeLabStore.getState()
  const { draft, livePreview, abMode } = state

  if (!draft) return

  // Si livePreview está apagado, no tocamos el motor.
  if (!livePreview) return

  // A/B mode 'base': aplicar el ADN base puro (desactivar mutaciones).
  if (abMode === 'base') {
    // Desactivar cualquier graft previo del custom vibe.
    if (lastGrafted) {
      ungraftAll()
      lastGrafted = null
    }
    // El motor se activa con el baseDNA puro. El caller (UI) debe llamar
    // a vibeManager.setActiveVibe(draft.baseDNA) por separado.
    return
  }

  // A/B mode 'mutation': resolver y graft.
  const result = resolveCustomVibe(draft)

  // Actualizar diagnostics en el store (sin disparar re-render masivo:
  // es un setState parcial que sólo afecta al selector de diagnostics).
  useVibeLabStore.setState({ diagnostics: result.diagnostics })

  if (!result.ok || !result.bundle) return

  graft(result.bundle)
  lastGrafted = result.bundle.key
}

/**
 * Encola un flush para el próximo frame de rAF. Si ya hay uno encolado,
 * no hace nada (coalescing).
 */
function scheduleSync(): void {
  if (pending) return
  pending = true
  raf(() => flush())
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT / TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inicializa el coalescer. Se llama una vez al montar el Vibe Lab.
 * Se suscribe a cambios del draft/livePreview/abMode del store.
 *
 * @returns Función de teardown (desuscribe y limpia).
 */
export function initVibeLabEngineSync(): () => void {
  if (initialized) {
    console.warn('[engineSync] Ya estaba inicializado. Llama al teardown primero.')
    return () => {}
  }
  initialized = true

  // Suscripción selectiva: sólo se dispara cuando cambian draft/livePreview/abMode.
  // subscribeWithSelector permite esto sin montar un componente React.
  unsubscribe = useVibeLabStore.subscribe(
    (s: VibeLabState) => ({ draft: s.draft, livePreview: s.livePreview, abMode: s.abMode }),
    () => scheduleSync(),
  )

  return () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    if (lastGrafted) {
      ungraftAll()
      lastGrafted = null
    }
    pending = false
    initialized = false
  }
}

/**
 * Fuerza un flush inmediato (sin esperar al rAF). Usado por `flushToEngine`
 * del store cuando el usuario suelta el slider o hace click en "apply".
 */
export function forceFlush(): void {
  if (pending) {
    pending = false
  }
  flush()
}

/**
 * Devuelve la última key injertada. Para debugging.
 */
export function getLastGraftedKey(): CustomVibeKey | null {
  return lastGrafted
}
