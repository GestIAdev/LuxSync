BLUEPRINT 1: THE V3 NATIVE STORE
Filosofía de diseño
El store deja de ser un wrapper de hook (useState + refs) y pasa a ser un Zustand store con Immer middleware. Immer es la pieza clave: nos permite escribir mutaciones "drafty" sobre un árbol profundo de tracks[] mientras Zustand recibe un objeto inmutable nuevo. Sin Immer, cada updateCurveInTrack requeriría 3-4 niveles de spread manual ({...clip, tracks: clip.tracks.map(t => t.id === id ? {...t, curve: {...t.curve, keyframes: [...]}} : t)}), que es donde nacen los bugs.

Selección, no parámetro activo
El concepto activeParam muere. En V3 dos tracks pueden compartir paramId: 'intensity' sobre zonas distintas, así que el discriminador único es activeTrackId. La selección de keyframes también se vuelve relativa al track activo.

Interfaz del store


typescript
import type {
  HephAutomationClipV3,
  HephTrack,
  HephCurve,
  HephKeyframe,
  HephParamId,
  ZoneTarget,
} from '../core/hephaestus/types'
import type { PhaseConfigPro } from '../core/hephaestus/phase/PhaseConfigPro'
 
// ─────────────────────────────────────────────────────────────────────────
// SELECTION & VIEWPORT (efímero — NO entra al historial)
// ─────────────────────────────────────────────────────────────────────────
 
interface EditorSelection {
  /** Track actualmente en edición. null = ningún track seleccionado. */
  activeTrackId: string | null
  /** Keyframes seleccionados DENTRO del track activo (índices). */
  selectedKeyframeIndices: ReadonlySet<number>
  /** Playhead en ms para preview/scrub. */
  playheadMs: number
}
 
interface EditorViewport {
  zoom: number
  scrollX: number
  /** Altura por lane (px) — el editor V3 apila tracks verticalmente. */
  laneHeight: number
}
 
// ─────────────────────────────────────────────────────────────────────────
// HISTORY (estructural — Command Pattern, no snapshots completos)
// ─────────────────────────────────────────────────────────────────────────
 
interface HistoryFrame {
  /** Patches de Immer para deshacer (inverse). */
  undo: Patch[]
  /** Patches de Immer para rehacer (forward). */
  redo: Patch[]
  /** Etiqueta semántica para UI ("Add keyframe", "Move track"). */
  label: string
}
 
// ─────────────────────────────────────────────────────────────────────────
// STORE STATE
// ─────────────────────────────────────────────────────────────────────────
 
export interface HephaestusEditorState {
  // ── Single source of truth ──
  clip: HephAutomationClipV3
 
  // ── Selección / viewport efímero ──
  selection: EditorSelection
  viewport: EditorViewport
 
  // ── Dirty tracking ──
  isDirty: boolean
 
  // ── Historial (Command Pattern) ──
  _undoStack: HistoryFrame[]
  _redoStack: HistoryFrame[]
}
 
export interface HephaestusEditorActions {
  // ═══ CLIP-LEVEL ═══
  loadClip: (clip: HephAutomationClipV3) => void          // resetea historial
  renameClip: (name: string) => void
  setDuration: (durationMs: number) => void
  setMixBus: (bus: HephAutomationClipV3['mixBus']) => void
 
  // ═══ TRACK CRUD ═══
  addTrack: (init: Partial<HephTrack> & { paramId: HephParamId; zones: ZoneTarget[] }) => string  // → new trackId
  removeTrack: (trackId: string) => void
  duplicateTrack: (trackId: string) => string            // → new trackId
  reorderTrack: (trackId: string, toIndex: number) => void
  setTrackZones: (trackId: string, zones: ZoneTarget[]) => void
  setTrackBlendMode: (trackId: string, mode: HephTrack['blendMode']) => void
  setTrackDimmerScale: (trackId: string, scale: number) => void
 
  // ═══ CURVE MUTATION (scoped al track) ═══
  updateCurveInTrack: (trackId: string, recipe: (curve: HephCurve) => void) => void
  addKeyframe: (trackId: string, kf: HephKeyframe) => void
  removeKeyframes: (trackId: string, indices: number[]) => void
  moveKeyframes: (trackId: string, delta: { dtMs: number; dValue: number }, indices: number[]) => void
  setKeyframeInterpolation: (trackId: string, index: number, interp: HephKeyframe['interpolation']) => void
 
  // ═══ PHASE (per-track) ═══
  updatePhaseInTrack: (trackId: string, recipe: (phase: PhaseConfigPro) => void) => void
  clearPhaseInTrack: (trackId: string) => void
 
  // ═══ DNA / SimMeta (clip-level) ═══
  setCognitiveDNA: (recipe: (dna: NonNullable<HephAutomationClipV3['cognitiveDNA']>) => void) => void
  enableDNA: () => void
 
  // ═══ SELECTION (efímero — NO historial) ═══
  selectTrack: (trackId: string | null) => void
  selectKeyframes: (indices: number[], additive?: boolean) => void
  setPlayhead: (ms: number) => void
  setViewport: (partial: Partial<EditorViewport>) => void
 
  // ═══ HISTORY ═══
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
 
  // ═══ DERIVED (selectors helper) ═══
  getActiveTrack: () => HephTrack | null
}
 
export type HephaestusEditorStore = HephaestusEditorState & HephaestusEditorActions
Undo/Redo eficiente: Command Pattern con Immer Patches
Aquí está el corazón de la elegancia. No clonamos el clip entero en cada acción (el viejo useTemporalStore hacía structuredClone(clip) — O(N) en tamaño del clip por cada keyframe movido). En V3, con docenas de tracks y miles de keyframes, eso es inviable.

En su lugar usamos produceWithPatches de Immer. Cada mutación produce un diff mínimo bidireccional:



typescript
import { produceWithPatches, enablePatches, applyPatches, type Patch } from 'immer'
enablePatches()
 
const HISTORY_LIMIT = 100
 
/**
 * Wrapper universal de mutación. TODA acción destructiva pasa por aquí.
 * Produce patches inversos (undo) y forward (redo), empuja un HistoryFrame,
 * e invalida la rama de redo.
 */
function mutate(
  set: SetState<HephaestusEditorStore>,
  get: GetState<HephaestusEditorStore>,
  label: string,
  recipe: (draft: HephAutomationClipV3) => void,
) {
  const current = get().clip
  const [nextClip, redoPatches, undoPatches] = produceWithPatches(current, recipe)
 
  if (redoPatches.length === 0) return  // no-op, no ensucia el historial
 
  set(state => {
    state.clip = nextClip as HephAutomationClipV3
    state.isDirty = true
    state._undoStack.push({ undo: undoPatches, redo: redoPatches, label })
    if (state._undoStack.length > HISTORY_LIMIT) state._undoStack.shift()
    state._redoStack.length = 0  // nueva acción mata la rama futura
  })
}
undo / redo simplemente aplican patches — operación O(tamaño del diff), no O(tamaño del clip):



typescript
undo: () => set(state => {
  const frame = state._undoStack.pop()
  if (!frame) return
  state.clip = applyPatches(state.clip, frame.undo)
  state._redoStack.push(frame)
}),
 
redo: () => set(state => {
  const frame = state._redoStack.pop()
  if (!frame) return
  state.clip = applyPatches(state.clip, frame.redo)
  state._undoStack.push(frame)
}),
Por qué es superior:

Memoria O(Σ diffs) en lugar de O(snapshots × tamaño_clip). Mover un keyframe guarda ~2 patches de unos bytes, no un clon de todo el árbol.
Coalescing de drags: durante un drag continuo (moveKeyframes en cada mousemove), NO llamamos mutate. Capturamos el estado en mousedown con un beginInteraction() que guarda los patches de inicio, y al mouseUp emitimos un único HistoryFrame con el delta acumulado. Un drag = un undo.
Etiquetas semánticas (label) alimentan un panel de historial estilo Photoshop gratis.
Ejemplo de acción real


typescript
updateCurveInTrack: (trackId, recipe) =>
  mutate(set, get, 'Edit curve', draft => {
    const track = draft.tracks.find(t => t.id === trackId)
    if (track) recipe(track.curve)   // Immer trackea la mutación profunda
  }),
 
updatePhaseInTrack: (trackId, recipe) =>
  mutate(set, get, 'Edit phase', draft => {
    const track = draft.tracks.find(t => t.id === trackId)
    if (!track) return
    track.phaseConfig ??= DEFAULT_PHASE_CONFIG_PRO
    recipe(track.phaseConfig as PhaseConfigPro)
  }),
 
addTrack: (init) => {
  const id = crypto.randomUUID()
  mutate(set, get, 'Add track', draft => {
    draft.tracks.push(buildTrack(id, init))
    // recompute spatialZones = unión de todas las zonas
    draft.spatialZones = computeSpatialUnion(draft.tracks)
  })
  set(s => { s.selection.activeTrackId = id })  // selección fuera del historial
  return id
},
Nota: la selección (activeTrackId, selectedKeyframeIndices) se muta fuera de mutate, porque seleccionar un track no debe ser una acción de undo.