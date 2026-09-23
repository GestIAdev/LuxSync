/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA STORE — WAVE 8010-P1: CÁMARA DEL LIENZO TÁCTICO
 *
 * Estado de la cámara del Tactical Canvas (proyección top-down del plano XZ).
 *
 * Semántica de la cámara:
 *   - `panX` / `panY` = el punto del MUNDO (en METROS) situado en el centro
 *     del viewport. `panX` es el eje X del stage; `panY` es el eje Z (depth)
 *     — el eje Y (altura) se ignora por decisión D-3 del blueprint.
 *   - `zoom` = píxeles de canvas por metro (px/m). 40 px/m ≈ vista 1:40.
 *
 * El tamaño del canvas (`canvasW`/`canvasH`, CSS px) vive aquí porque las
 * matemáticas mundo↔pantalla lo necesitan; `AsteriaCanvas` lo actualiza
 * vía ResizeObserver.
 *
 * El store es plano y efímero — NO se persiste en el `.lfx` (la cámara es
 * estado de UI, no de documento).
 *
 * @module HephaestusView/asteria/store/useAsteriaStore
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand'
import type { NodeAtlasEntry } from '../../../../../core/aether/types'
import type { AsteriaProject, Gesture } from '../model/AsteriaProject'
import { createDefaultProject } from '../model/AsteriaProject'
import {
  computeRigDrift,
  discardOrphans,
  remapByProximity,
  sealRig,
  type RigDrift,
} from '../model/rigDrift'
import type { CompileReport } from '../compiler/AsteriaCompiler'
import type { HephParamId } from '../../../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🜨 WAVE 8010-P2: el Node Atlas consumible por las capas del canvas.
 * `useNodeAtlas` lo construye UNA vez por fetch (patch-time) y lo deposita
 * aquí — las capas RAF lo leen via `useAsteriaStore.getState().nodeAtlas`
 * como REFERENCIA ESTABLE, sin suscripciones ni re-renders de React.
 */
export interface NodeAtlas {
  readonly entries: readonly NodeAtlasEntry[]
  readonly byNodeId: ReadonlyMap<string, NodeAtlasEntry>
}

/** Herramientas del Lienzo Táctico (WAVE 8020 + 8040B: chrono ✎ · cell ✜). */
export type AsteriaToolId =
  | 'select' | 'lasso' | 'radial' | 'chrono' | 'cell' | 'glyph'

/** Límites de zoom en píxeles por metro. */
export const ASTERIA_ZOOM_MIN = 4
export const ASTERIA_ZOOM_MAX = 600
/** Zoom inicial: 40 px/m — un stage de ~12 m cabe holgado en ~800 px. */
export const ASTERIA_ZOOM_DEFAULT = 40

export interface AsteriaCamera {
  /** Eje X del mundo (m) en el centro del viewport. */
  panX: number
  /** Eje Z del mundo (m) en el centro del viewport (+Z = abajo en pantalla). */
  panY: number
  /** Píxeles de canvas por metro. */
  zoom: number
}

export interface AsteriaStore extends AsteriaCamera {
  /** Tamaño CSS del canvas en píxeles (lo fija el ResizeObserver). */
  canvasW: number
  canvasH: number

  /**
   * 🜨 WAVE 8010-P2: fotografía del NodeGraph real (WAVE 8000) depositada
   * por useNodeAtlas. Referencia estable entre fetches — las capas de
   * dibujo la consumen por getState() dentro del RAF (zero React cost).
   * null = atlas aún no cargado o fetch fallido.
   */
  nodeAtlas: NodeAtlas | null
  /** Deposita el atlas tras un fetch exitoso (patch-time only). */
  setNodeAtlas: (atlas: NodeAtlas | null) => void

  // ── WAVE 8020: EL TACTO — herramienta, selección, hover, poke ──

  /** Herramienta activa del toolbox. */
  activeToolId: AsteriaToolId
  setActiveTool: (id: AsteriaToolId) => void

  /**
   * Selección persistente de nodeIds (marquee/lasso/radial committed).
   * Nueva referencia de Set solo cuando el contenido cambia.
   */
  selectionNodeIds: ReadonlySet<string>
  /** Reemplaza o une (additive = Shift) la selección. */
  setSelection: (nodeIds: Iterable<string>, additive?: boolean) => void

  /**
   * Nodos bajo el cursor (hover). El setter dedupe por firma — el
   * pointermove puede llamar a 60 Hz sin churn de React.
   */
  hoverNodeIds: ReadonlySet<string>
  setHover: (nodeIds: Iterable<string>) => void

  /**
   * Preview fantasma de selección durante un drag de herramienta
   * (marquee/lasso/radial en vivo). Se dibuja distinto al commit
   * (GestureLayer) y se descarta al soltar — no entra a `selection`
   * hasta el commit con semántica Shift-additive correcta.
   */
  previewNodeIds: ReadonlySet<string>
  setPreview: (nodeIds: Iterable<string>) => void

  /**
   * Kill-switch del Protocolo Poke (seguridad L3++ — el poke pisa todo
   * menos Blackout). false = el tacto no publica al backend.
   */
  pokeEnabled: boolean
  setPokeEnabled: (on: boolean) => void

  /**
   * 🜨 WAVE 8040B (T7): deviceId del fixture expandido por el Cell
   * Surgeon — null = modo normal. La banda de estado y la tool lo leen;
   * las tools lo escriben via ctx.setSurgeonDevice.
   */
  surgeonDeviceId: string | null
  setSurgeonDevice: (deviceId: string | null) => void

  // ── WAVE 8030-P3: EL DOCUMENTO — Gesture Stack no destructivo ──

  /**
   * El proyecto Asteria — persiste en `clip.asteria` (D-4 embebido).
   * Documento (no UI): cada mutación crea una nueva referencia de
   * `project` y de `stack` — los suscriptores de React (Gesture Stack
   * UI) re-renderizan solo cuando la receta cambia.
   */
  project: AsteriaProject
  /** Carga un proyecto desde un `.lfx` abierto (reemplazo completo). */
  setProject: (project: AsteriaProject) => void
  /** Documento nuevo: pila con el único gesto `base` identidad. */
  resetProject: () => void
  /**
   * Empuja un gesto a la CIMA de la pila (final del array — el
   * fieldEngine evalúa en orden y los últimos mezclan sobre los primeros,
   * como las capas de Photoshop).
   */
  addGesture: (gesture: Gesture) => void
  /**
   * Merge paramétrico no destructivo: aplica un patch sobre el gesto
   * con ese `id` (edición en vivo — sliders del inspector). No-op si
   * el id no existe.
   */
  updateGesture: (id: string, patch: Partial<Gesture>) => void
  /** Retira un gesto de la pila por id. */
  removeGesture: (id: string) => void
  /**
   * Reordena la pila: mueve el gesto `id` al índice `toIndex`
   * (0 = fondo). Clampeado al rango válido.
   */
  moveGesture: (id: string, toIndex: number) => void
  /**
   * 🜨 WAVE 8055: gesto seleccionado en el panel del stack — la "capa
   * activa" del inspector. null = ninguna. No es una mutación del
   * documento (no la bloquea el modo solo-lectura).
   */
  selectedGestureId: string | null
  setSelectedGesture: (id: string | null) => void
  /**
   * 🜨 WAVE 8070 (M2): params Heph a los que el compilador aplica el
   * campo (`project.targetParams` — intensity, pan, tilt, zoom…).
   * Nunca vacío: el campo siempre tiene que apuntar a algo.
   */
  setTargetParams: (params: readonly HephParamId[]) => void
  /**
   * 🌈 WAVE 8120 (M1): color del canal 'color' — HEX '#rrggbb'.
   * Persiste en `project.targetColor` → viaja dentro del `.lfx` con el
   * resto de la receta. Rechaza formatos no-HEX y queda congelado en
   * solo-lectura (drift).
   */
  setTargetColor: (color: string) => void

  /**
   * 🜨 WAVE 8030-P7: último reporte del compilador Λ (useAsteriaCompiler).
   * El rail lo muestra como HUD de presupuesto — bytes, pistas, warnings.
   * null = aún no se ha compilado (o la compilación está deshabilitada).
   */
  lastCompileReport: CompileReport | null
  setCompileReport: (report: CompileReport | null) => void

  // ── WAVE 8050 (M3): RIG DRIFT — el escenario cambió entre sesiones ──

  /**
   * Reporte de drift activo: nodos de la pila que ya no existen +
   * nodos nuevos sin asignar. null = rig íntegro (o sin huella).
   * Mientras sea != null el compilador NO recompila — nunca un
   * recompile silencioso sobre un campo mutilado (blueprint §Pers.).
   */
  rigDrift: RigDrift | null
  /** Recalcula el drift desde (project, nodeAtlas) — automático en
   *  setProject/setNodeAtlas. */
  refreshRigDrift: () => void
  /** Acción del banner: hereda coreografía al nuevo nodo más cercano. */
  resolveDriftRemap: () => void
  /** Acción del banner: elimina los ids muertos de máscaras/entries. */
  resolveDriftDiscard: () => void
  /**
   * Acción del banner: abre el proyecto en solo lectura — el drift
   * sigue pendiente (compilación bloqueada) y las mutaciones del
   * Gesture Stack quedan congeladas hasta resolver.
   */
  driftReadOnly: boolean
  setDriftReadOnly: (on: boolean) => void

  /** Merge parcial de cámara con clamp de zoom. */
  setCamera: (cam: Partial<AsteriaCamera>) => void
  /** Pan gestual: desplaza la vista por un delta en PÍXELES de pantalla. */
  panByScreen: (dxPx: number, dyPx: number) => void
  /**
   * Zoom centrado en un punto de pantalla (cursor): el punto del mundo bajo
   * el cursor permanece fijo mientras cambia la escala.
   */
  zoomAtScreen: (sxPx: number, syPx: number, factor: number) => void
  /** Actualiza el tamaño CSS del canvas (ResizeObserver). */
  setCanvasSize: (w: number, h: number) => void
  /** Vuelve a la cámara por defecto (centrada en el origen del stage). */
  resetCamera: () => void
  /**
   * Encuadra un rectángulo del mundo (centro + tamaño en metros) con un
   * margen en píxeles. Pensado para el Crystal Box del stage en P2.
   */
  fitRect: (centerX: number, centerZ: number, widthM: number, depthM: number, marginPx?: number) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function clampZoom(z: number): number {
  return Math.min(ASTERIA_ZOOM_MAX, Math.max(ASTERIA_ZOOM_MIN, z))
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useAsteriaStore = create<AsteriaStore>((set, get) => ({
  panX: 0,
  panY: 0,
  zoom: ASTERIA_ZOOM_DEFAULT,
  canvasW: 0,
  canvasH: 0,
  nodeAtlas: null,

  setNodeAtlas: (atlas) =>
    set((s) => {
      // 🜨 WAVE 8030-P3: sella la huella del rig SOLO en proyectos nuevos
      // (fingerprint vacía). Un proyecto cargado de un .lfx conserva la
      // suya — la diferencia con el atlas vivo ES el Rig Drift Report.
      let project = s.project
      if (atlas && project.rigFingerprint === '') {
        project = { ...project, ...sealRig(atlas) }
      }
      // 🜨 WAVE 8050 (M3): el drift se recalcula con cada atlas — un
      // re-patch en caliente también es un cambio de escenario.
      const rigDrift = computeRigDrift(project, atlas)
      return {
        nodeAtlas: atlas,
        project,
        rigDrift,
        // 'Solo lectura' sobrevive a un refresh del atlas mientras el
        // drift siga sin resolver — la decisión del operador no se pisa.
        driftReadOnly: rigDrift !== null && s.driftReadOnly,
      }
    }),

  activeToolId: 'select',
  // Al cambiar de herramienta se cierra cualquier cirugía celular abierta
  // (la tool no ve el store en cancel() — la higiene vive aquí).
  setActiveTool: (id) =>
    set((s) =>
      s.activeToolId === id
        ? {}
        : { activeToolId: id, surgeonDeviceId: null },
    ),

  selectionNodeIds: new Set<string>(),
  setSelection: (nodeIds, additive = false) =>
    set((s) => {
      const next = additive ? new Set(s.selectionNodeIds) : new Set<string>()
      for (const id of nodeIds) next.add(id)
      // Dedupe por tamaño+contenido: misma selección → misma referencia
      if (next.size === s.selectionNodeIds.size) {
        let same = true
        for (const id of next) if (!s.selectionNodeIds.has(id)) { same = false; break }
        if (same) return {}
      }
      return { selectionNodeIds: next }
    }),

  hoverNodeIds: new Set<string>(),
  setHover: (nodeIds) =>
    set((s) => {
      const arr = Array.from(nodeIds)
      if (arr.length === s.hoverNodeIds.size) {
        let same = true
        for (const id of arr) if (!s.hoverNodeIds.has(id)) { same = false; break }
        if (same) return {}
      }
      return { hoverNodeIds: new Set(arr) }
    }),

  previewNodeIds: new Set<string>(),
  setPreview: (nodeIds) =>
    set((s) => {
      const arr = Array.from(nodeIds)
      if (arr.length === s.previewNodeIds.size) {
        let same = true
        for (const id of arr) if (!s.previewNodeIds.has(id)) { same = false; break }
        if (same) return {}
      }
      return { previewNodeIds: new Set(arr) }
    }),

  pokeEnabled: true,
  setPokeEnabled: (on) => set({ pokeEnabled: on }),

  surgeonDeviceId: null,
  setSurgeonDevice: (deviceId) =>
    set((s) => (s.surgeonDeviceId === deviceId ? {} : { surgeonDeviceId: deviceId })),

  project: createDefaultProject(),
  setProject: (project) =>
    set((s) => {
      // 🜨 WAVE 8050 (M3): cargar un documento ajeno dispara el drift —
      // su huella describe OTRO rig. Si coincide, rigDrift = null.
      const rigDrift = computeRigDrift(project, s.nodeAtlas)
      return {
        project,
        rigDrift,
        driftReadOnly: rigDrift !== null && s.driftReadOnly,
        // Documento nuevo → la selección de capa no sobrevive
        selectedGestureId: null,
      }
    }),
  resetProject: () =>
    set((s) => {
      // 🜨 WAVE 8055: solo lectura también congela el reset — tirar el
      // documento cargado ES una mutación destructiva.
      if (s.driftReadOnly) return {}
      return {
        project: {
          ...createDefaultProject(),
          // El documento nuevo nace sobre el rig actual si el atlas ya llegó.
          ...(s.nodeAtlas ? sealRig(s.nodeAtlas) : {}),
        },
        rigDrift: null,
        driftReadOnly: false,
        selectedGestureId: null,
      }
    }),

  addGesture: (gesture) =>
    set((s) =>
      s.driftReadOnly
        ? {}
        : {
            project: { ...s.project, stack: [...s.project.stack, gesture] },
            // La capa nueva queda activa en el inspector (como Photoshop)
            selectedGestureId: gesture.id,
          },
    ),

  updateGesture: (id, patch) =>
    set((s) =>
      s.driftReadOnly
        ? {}
        : {
            project: {
              ...s.project,
              stack: s.project.stack.map((g) =>
                g.id === id ? ({ ...g, ...patch } as Gesture) : g,
              ),
            },
          },
    ),

  removeGesture: (id) =>
    set((s) =>
      s.driftReadOnly
        ? {}
        : {
            project: {
              ...s.project,
              stack: s.project.stack.filter((g) => g.id !== id),
            },
            // Si el gesto eliminado era el seleccionado, limpia la capa
            selectedGestureId:
              s.selectedGestureId === id ? null : s.selectedGestureId,
          },
    ),

  moveGesture: (id, toIndex) =>
    set((s) => {
      if (s.driftReadOnly) return {}
      const stack = s.project.stack
      const from = stack.findIndex((g) => g.id === id)
      if (from < 0) return {}
      const to = Math.max(0, Math.min(stack.length - 1, toIndex))
      if (to === from) return {}
      const next = stack.slice()
      const [g] = next.splice(from, 1)
      next.splice(to, 0, g)
      return { project: { ...s.project, stack: next } }
    }),

  selectedGestureId: null,
  setSelectedGesture: (id) =>
    set((s) => (s.selectedGestureId === id ? {} : { selectedGestureId: id })),

  setTargetParams: (params) =>
    set((s) =>
      s.driftReadOnly || params.length === 0
        ? {}
        : { project: { ...s.project, targetParams: params } },
    ),

  setTargetColor: (color) =>
    set((s) =>
      s.driftReadOnly || !/^#[0-9a-fA-F]{6}$/.test(color)
        ? {}
        : { project: { ...s.project, targetColor: color } },
    ),

  lastCompileReport: null,
  setCompileReport: (report) => set({ lastCompileReport: report }),

  // ── WAVE 8050 (M3): RIG DRIFT ──

  rigDrift: null,
  refreshRigDrift: () =>
    set((s) => ({ rigDrift: computeRigDrift(s.project, s.nodeAtlas) })),

  resolveDriftRemap: () =>
    set((s) => {
      if (!s.rigDrift || !s.nodeAtlas) return {}
      const r = remapByProximity(s.project, s.nodeAtlas, s.rigDrift)
      return {
        project: r.project,
        rigDrift: null,
        driftReadOnly: false,
        // Los unmappable se reportan en el reporte de compilación — el
        // operador ve qué ids quedaron colgados sin posición sellada.
        lastCompileReport: r.unmappable.length
          ? {
              strategy: 'lambda',
              trackIds: [],
              keyframeCount: 0,
              overrideCount: 0,
              nodesCovered: 0,
              devicesTargeted: 0,
              bytes: 0,
              warnings: [
                `RIG_REMAP_PARTIAL — ${r.unmappable.length} nodo(s) sin posición sellada: ${r.unmappable.join(', ')}`,
              ],
            }
          : s.lastCompileReport,
      }
    }),

  resolveDriftDiscard: () =>
    set((s) => {
      if (!s.rigDrift || !s.nodeAtlas) return {}
      return {
        project: discardOrphans(s.project, s.nodeAtlas, s.rigDrift),
        rigDrift: null,
        driftReadOnly: false,
      }
    }),

  driftReadOnly: false,
  setDriftReadOnly: (on) => set({ driftReadOnly: on }),

  setCamera: (cam) =>
    set((s) => ({
      panX: cam.panX ?? s.panX,
      panY: cam.panY ?? s.panY,
      zoom: cam.zoom !== undefined ? clampZoom(cam.zoom) : s.zoom,
    })),

  panByScreen: (dxPx, dyPx) =>
    set((s) => ({
      panX: s.panX - dxPx / s.zoom,
      panY: s.panY - dyPx / s.zoom,
    })),

  zoomAtScreen: (sxPx, syPx, factor) =>
    set((s) => {
      const zoom = clampZoom(s.zoom * factor)
      if (zoom === s.zoom || s.canvasW <= 0 || s.canvasH <= 0) {
        return { zoom }
      }
      // Punto del mundo bajo el cursor ANTES del zoom
      const wx = (sxPx - s.canvasW / 2) / s.zoom + s.panX
      const wz = (syPx - s.canvasH / 2) / s.zoom + s.panY
      // Nuevo pan para que ese mismo punto quede bajo el cursor tras el zoom
      return {
        zoom,
        panX: wx - (sxPx - s.canvasW / 2) / zoom,
        panY: wz - (syPx - s.canvasH / 2) / zoom,
      }
    }),

  setCanvasSize: (w, h) => set({ canvasW: w, canvasH: h }),

  resetCamera: () =>
    set({ panX: 0, panY: 0, zoom: ASTERIA_ZOOM_DEFAULT }),

  fitRect: (centerX, centerZ, widthM, depthM, marginPx = 48) => {
    const { canvasW, canvasH } = get()
    if (canvasW <= 0 || canvasH <= 0 || widthM <= 0 || depthM <= 0) return
    const zoom = clampZoom(
      Math.min((canvasW - marginPx * 2) / widthM, (canvasH - marginPx * 2) / depthM),
    )
    set({ panX: centerX, panY: centerZ, zoom })
  },
}))
