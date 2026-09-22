/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 useAsteriaCompiler — WAVE 8030-P7: LA CONEXIÓN VIVA
 *
 * El pegamento entre el Gesture Stack y el clip del editor:
 *
 *   project.stack cambia ──(debounce 150ms)──► fieldEngine.evaluate()
 *        ──► AsteriaCompiler.compile() ──► injectAstTracks()
 *        ──► useHephaestusEditorStore.replaceClipTransient()
 *
 * TRES PUNTOS CRÍTICOS (blueprint §8.1 + dogmas del proyecto):
 *
 * 1. DEBOUNCE 150 ms — un arrastre de Chrono-Brush o un slider del
 *    inspector muta el stack en ráfaga; compilamos UNA vez al asentarse,
 *    no 60 veces por segundo contra el editor store.
 *
 * 2. SUSTITUCIÓN QUIRÚRGICA — `injectAstTracks` filtra SOLO ids `ast_*`;
 *    los tracks manuales de Forge sobreviven intactos. La inyección usa
 *    `replaceClipTransient` (sin historial — el undo de Asteria es el
 *    Gesture Stack no destructivo, no el undo del clip).
 *
 * 3. ENGINE RECREADO POR ATLAS — los Float32Array del fieldEngine nacen
 *    sized-to-N; un atlas nuevo (topology_changed, re-patch) con otro N
 *    desbordaría los buffers. El engine se recrea cuando cambia la
 *    REFERENCIA de nodeAtlas (estable entre fetches).
 *
 * Dedupe: si los tracks ast_* compilados son byte-idénticos a los ya
 * inyectados, no se toca el store (cero churn de React/isDirty).
 *
 * @module HephaestusView/asteria/compiler/useAsteriaCompiler
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef } from 'react'
import { useAsteriaStore } from '../store/useAsteriaStore'
import { useHephaestusEditorStore } from '../../../../../core/hephaestus/store/useHephaestusEditorStore'
import { createFieldEngine, type FieldEngine } from '../model/fieldEngine'
import {
  compile,
  injectAstTracks,
} from './AsteriaCompiler'
import type { NodeAtlas } from '../store/useAsteriaStore'
import type { HephTrack } from '../../../../../core/hephaestus/types'

/** Debounce del recompile live — ms de silencio antes de compilar. */
export const ASTERIA_COMPILE_DEBOUNCE_MS = 150

/**
 * Monta el pipeline vivo de compilación. Llamar una vez desde
 * AsteriaView (patch-time — jamás en el tick de 44 Hz).
 */
export function useAsteriaCompiler(): void {
  // Engine + atlas que lo parió — recreado SOLO si la referencia cambia
  const engineRef = useRef<FieldEngine | null>(null)
  const engineAtlasRef = useRef<NodeAtlas | null>(null)
  // Firma JSON de los ast_* actualmente inyectados (dedupe)
  const injectedSigRef = useRef<string>('')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const flush = () => {
      const { nodeAtlas, project, rigDrift, driftReadOnly } =
        useAsteriaStore.getState()
      if (!nodeAtlas) return

      // 🜨 WAVE 8050 (M3): NUNCA un recompile silencioso con drift
      // pendiente — el campo mutilado hornearía tracks erróneos.
      // El HUD recibe un reporte honesto en lugar de pistas.
      if (rigDrift !== null || driftReadOnly) {
        useAsteriaStore.getState().setCompileReport({
          strategy: 'lambda',
          trackIds: [],
          keyframeCount: 0,
          overrideCount: 0,
          nodesCovered: 0,
          devicesTargeted: 0,
          bytes: 0,
          warnings: [
            rigDrift !== null
              ? `RIG_DRIFT — ${rigDrift.missing.length} nodo(s) perdido(s), ${rigDrift.unassigned.length} sin asignar — resuelve el banner para compilar`
              : 'READ_ONLY — proyecto abierto en solo lectura',
          ],
        })
        return
      }

      // ③ Engine recreado si el atlas cambió de referencia
      if (engineAtlasRef.current !== nodeAtlas) {
        engineAtlasRef.current = nodeAtlas
        engineRef.current = createFieldEngine(nodeAtlas)
        injectedSigRef.current = ''
      }
      const engine = engineRef.current
      if (!engine) return

      const field = engine.evaluate(project.stack)
      const editor = useHephaestusEditorStore.getState()
      const { tracks, report } = compile({
        atlas: nodeAtlas,
        field,
        clip: editor.clip,
        project,
      })

      // Dedupe: mismo payload ast_* → no tocar el store
      const sig = JSON.stringify(tracks)
      if (sig !== injectedSigRef.current) {
        injectedSigRef.current = sig
        const nextTracks = tracks as HephTrack[]
        const nextClip = injectAstTracks(editor.clip, nextTracks, project)
        useHephaestusEditorStore.getState().replaceClipTransient(nextClip)
      }
      useAsteriaStore.getState().setCompileReport(report)
    }

    const schedule = () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        flush()
      }, ASTERIA_COMPILE_DEBOUNCE_MS)
    }

    // ① Debounce: suscripción vanilla, comparamos referencias a mano
    const unsub = useAsteriaStore.subscribe((state, prev) => {
      if (state.project === prev.project && state.nodeAtlas === prev.nodeAtlas) {
        return
      }
      schedule()
    })

    // Compilación inicial (atlas puede haber llegado antes del mount)
    schedule()

    return () => {
      unsub()
      if (timer !== null) clearTimeout(timer)
    }
  }, [])
}
