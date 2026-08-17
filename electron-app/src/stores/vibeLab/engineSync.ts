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
let lastBaseDNA: string | null = null
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
 *
 * PROTEUS FIX 3: This function is now async. It awaits the graftVibe IPC
 * BEFORE calling setVibe, eliminating the non-deterministic 404 race.
 * The rAF callback does not await this — the `pending` flag is cleared
 * synchronously at the top, so coalescing still works correctly.
 */
async function flush(): Promise<void> {
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
    // 🧬 STATE HIJACK: Activar el baseDNA puro en el motor via IPC directo.
    try {
      window.lux?.setVibe?.(draft.baseDNA)
    } catch (e) {
      console.warn('[engineSync] setVibe(base) IPC failed:', e)
    }
    lastBaseDNA = draft.baseDNA
    return
  }

  // A/B mode 'mutation': resolver y graft.
  const result = resolveCustomVibe(draft)

  // Actualizar diagnostics en el store (sin disparar re-render masivo:
  // es un setState parcial que sólo afecta al selector de diagnostics).
  useVibeLabStore.setState({ diagnostics: result.diagnostics })

  if (!result.ok || !result.bundle) return

  graft(result.bundle)
  const newKey = result.bundle.key

  // 🧬 PROTEUS GRAFT: Si la key cambió (nueva sesión) O el baseDNA cambió
  // (rebase con misma key pero diferente ADN), enviar el bundle al backend
  // para que injerte el custom vibe en los registrios del MAIN PROCESS,
  // y LUEGO activar el vibe. Sin el graft al backend, VibeManager no
  // encuentra la key 'custom:...' → 404 → fallback a idle → cero telemetry.
  //
  // PROTEUS FIX 3: Await graftVibe BEFORE setVibe. This eliminates the
  // race where setVibe reaches the backend before the graft is applied,
  // causing a 404 → idle fallback.
  const baseChanged = lastBaseDNA !== draft.baseDNA
  if (lastGrafted !== newKey || baseChanged) {
    if (window.lux?.graftVibe) {
      try {
        await window.lux.graftVibe(result.bundle)
      } catch (e) {
        console.warn('[engineSync] graftVibe IPC failed:', e)
        // Don't call setVibe if the graft failed — it would 404.
        lastGrafted = newKey
        lastBaseDNA = draft.baseDNA
        return
      }
    }
    try {
      window.lux?.setVibe?.(newKey)
    } catch (e) {
      console.warn('[engineSync] setVibe IPC failed:', e)
    }
  }
  lastGrafted = newKey
  lastBaseDNA = draft.baseDNA
}

/**
 * Encola un flush para el próximo frame de rAF. Si ya hay uno encolado,
 * no hace nada (coalescing).
 */
function scheduleSync(): void {
  if (pending) return
  pending = true
  // PROTEUS FIX 3: flush() is now async. We don't await it here (rAF
  // callbacks can't be async), but the `pending` flag is cleared
  // synchronously at the top of flush(), so coalescing still works.
  raf(() => { void flush() })
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

  // Suscripción selectiva: sólo se dispara cuando cambian las capas de genes
  // (physics/color/movement), livePreview o abMode.
  // PROTEUS FIX 6: Excluimos draft.meta y otros campos de UI del selector
  // para que editar metadatos en el MintDialog no dispare un resolve+graft
  // innecesario (la meta no afecta el bundle fusionado).
  unsubscribe = useVibeLabStore.subscribe(
    (s: VibeLabState) => ({
      physics: s.draft?.physics,
      color: s.draft?.color,
      movement: s.draft?.movement,
      livePreview: s.livePreview,
      abMode: s.abMode,
    }),
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
    lastBaseDNA = null
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
  void flush()
}

/**
 * PROTEUS FIX 4: Resets the graft cache so the next flush() will re-graft
 * and re-activate the vibe even if it was the "last grafted" key.
 *
 * Called by vibeLabStore.openFromVault() to ensure that re-loading a vibe
 * from the vault actually applies it to the engine, instead of being a no-op.
 */
export function resetGraftCache(): void {
  lastGrafted = null
  lastBaseDNA = null
}

/**
 * Devuelve la última key injertada. Para debugging.
 */
export function getLastGraftedKey(): CustomVibeKey | null {
  return lastGrafted
}
