/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 useAsteriaRigDrift — WAVE 8050 · M3: EL REGRESO DEL PROYECTO
 *
 * D-4 hace el viaje de IDA (injectAstTracks embebe `project` en
 * `clip.asteria`). Este hook hace el viaje de VUELTA: cuando un clip
 * abierto en el editor trae un proyecto Asteria distinto al vivo,
 * lo carga en el store — y el drift se dispara SOLO si su huella
 * describe otro rig (setProject → computeRigDrift).
 *
 * ANTI-LOOP: nuestra propia inyección escribe `clip.asteria === project`
 * — la comparación por firma JSON lo hace inerte. Un clip AJENO carga
 * una vez; el recompile posterior re-embebe el mismo proyecto → firma
 * idéntica → no hay rebote.
 *
 * Sincronía: la comprobación corre en el subscriber de Zustand (no en
 * render) — un clip nuevo se detecta antes de que cualquier debounce
 * pueda sobrescribir su receta embebida.
 *
 * @module HephaestusView/asteria/compiler/useAsteriaRigDrift
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect } from 'react'
import { useAsteriaStore } from '../store/useAsteriaStore'
import { useHephaestusEditorStore } from '../../../../../core/hephaestus/store/useHephaestusEditorStore'
import type {
  AsteriaProject,
  AsteriaProjectV1,
} from '../model/AsteriaProject'

/**
 * Último clip.id visto — MÓDULO, no ref: sobrevive a desmontar la
 * pestaña Asteria. Un remount con el MISMO clip no debe recargar el
 * `clip.asteria` embebido (podría ser más viejo que el proyecto vivo
 * si el último debounce no llegó a inyectar — nunca perder trabajo).
 */
let lastClipId: string | null = null

/**
 * ¿El `clip.asteria` del editor describe un proyecto DISTINTO al vivo?
 * Comparación por contenido (JSON) — referencias distintas del mismo
 * documento no disparan recarga.
 */
function foreignProject(
  clip: unknown,
): AsteriaProject | AsteriaProjectV1 | null {
  const embedded = (clip as { asteria?: unknown }).asteria
  if (!embedded || typeof embedded !== 'object') return null
  const live = useAsteriaStore.getState().project
  try {
    if (JSON.stringify(embedded) === JSON.stringify(live)) return null
  } catch {
    return null
  }
  // El envelope mínimo exige version + rigFingerprint — sin ellos no es
  // un documento Asteria válido (un .lfx corrupto no tumba la vista).
  // 🜨 WAVE 8192: version 1 y 2 son cargables — setProject migra v1→v2.
  const p = embedded as {
    version?: unknown
    rigFingerprint?: unknown
    stack?: unknown
  }
  if (
    (p.version !== 1 && p.version !== 2) ||
    typeof p.rigFingerprint !== 'string'
  )
    return null
  if (!Array.isArray(p.stack)) return null
  return p as AsteriaProject | AsteriaProjectV1
}

/** Monta la sincronía clip→proyecto. Llamar una vez desde AsteriaView. */
export function useAsteriaRigDrift(): void {
  useEffect(() => {
    const check = () => {
      const clip = useHephaestusEditorStore.getState().clip
      const clipId = (clip as { id?: string } | null)?.id ?? null
      if (clipId === lastClipId) return
      lastClipId = clipId
      const loaded = foreignProject(clip)
      const asteria = useAsteriaStore.getState()
      if (loaded !== null) {
        // setProject recalcula rigDrift internamente (store)
        asteria.setProject(loaded)
      } else {
        // 🜨 WAVE 8070 (M1): el documento nuevo NO trae receta espacial —
        // la pila del archivo anterior NO puede sobrevivir: la próxima
        // mutación la hornearía en este .lfx (contaminación cruzada).
        // El candado solo-lectura pertenece al documento anterior — se
        // libera antes del reset (es swap de documento, no mutación).
        asteria.setDriftReadOnly(false)
        asteria.resetProject()
      }
    }

    check() // el clip pudo llegar antes del mount de la pestaña
    const unsub = useHephaestusEditorStore.subscribe((state, prev) => {
      if (state.clip === prev.clip) return
      check()
    })
    return unsub
  }, [])
}
