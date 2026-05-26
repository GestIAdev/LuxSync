# WAVE 4910 — BLUEPRINT THEIA UI: THE DNA ASSET EDITOR

> **DIRECTIVA FRONTEND — Diseño puro. No implementación.**
> **Misión:** transformar `TheiaEngineView` en una estación de trabajo completa para crear, editar y exportar archivos `.theia` con cuepoints cognitivos.
>
> **Backend dependencies:** WAVE 4900 (blueprint) · WAVE 4901 (`theiaTypes` + `TheiaRegistry`) · WAVE 4902 (`TheiaFileLoader` + `SeleneTheiaAdapter`) · WAVE 4903 (IPC wiring + `theia:seek`).
>
> **Estética rectora:** industrial-cyberpunk LuxSync — paneles glassmorphism, accent neón cyan/magenta, scanlines sutiles, sin chrome bloat. Cada control visible debe tener `data-midi-bind`.
>
> **Fecha:** 2026-05-26  |  **Tier:** OPUS_PRO_TIER / UX_UI_ARCHITECT

---

## 0. PRINCIPIOS DE DISEÑO

| Principio | Implementación |
|-----------|----------------|
| **Bi-modalidad clara** | Toggle `[PERFORM ◐ AUTHOR]` en header. PERFORM = vista actual (run-time, mockup). AUTHOR = estación de edición. Cero ambigüedad sobre qué hace cada click. |
| **Single source of truth** | El ADN del cuepoint seleccionado vive en un `useTheiaEditorStore` (Zustand). Todos los paneles leen del mismo store; ediciones son atómicas. |
| **Zero-loss workflow** | El draft se autoguarda en `localStorage` cada 2s. Cerrar la app no pierde el trabajo. |
| **Cyberpunk discipline** | Una sola dirección de luz neón por panel. Glassmorphism con `backdrop-filter: blur(12px) saturate(120%)`. Scanlines a 0.04 opacity. Tipografía monoespaciada para valores numéricos. |
| **Dense pero no abrumador** | Inspector lateral colapsable. DNA Panel solo aparece con un cuepoint seleccionado. Asset Deck es overlay al hover en zona inferior. |
| **MIDI-learn first** | Cada slider/knob/button del Author tiene `data-midi-bind="theia.author.<scope>.<param>"`. |

---

## 1. UX LAYOUT — ZONAS DE LA INTERFAZ

### 1.1 Modo `AUTHOR` — Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER (60px) — [PERFORM ◐ AUTHOR]  [project: aurora-flow.theia]  [💾]  │
│                                              [DRAFT · 12s ago]  [EXPORT] │
├─────────────────────────────────────────────────────┬────────────────────┤
│                                                     │                    │
│   ┌─────────────────────────────────────────────┐   │  🧬 DNA LAB        │
│   │                                             │   │  (Cuepoint: lift)  │
│   │       MAIN VIEWPORT (Video + scanlines)     │   │                    │
│   │                                             │   │  ▰▰▰▰▰▱▱▱  Aggro   │
│   │       drop-zone overlay if empty            │   │  ▰▰▰▱▱▱▱▱  Chaos   │
│   │                                             │   │  ▰▰▰▰▰▰▰▰  Organic │
│   │                                             │   │                    │
│   │       ◀ ▶ ⏸    [ 1.0× ]    01:24 / 03:04   │   │  EnergyZone        │
│   └─────────────────────────────────────────────┘   │  [ambient → active]│
│                                                     │                    │
│   ┌─────────────────────────────────────────────┐   │  ValidSections     │
│   │  TIMELINE TRIMMER                           │   │  ☑ verse           │
│   │  ┌─────┬───────┬─────────────┬────────┐     │   │  ☑ buildup         │
│   │  │intro│ lift  │ drop-peak   │ outro  │     │   │  ☐ drop            │
│   │  └─────┴───────┴─────────────┴────────┘     │   │  ☐ peak            │
│   │  ──────────●──────────────────────────       │   │                    │
│   │             ↑playhead       ↑markers         │   │  Texture Affinity  │
│   │  [+ ADD CUEPOINT]    [DELETE]                │   │  ◉ clean ◯ dirty   │
│   └─────────────────────────────────────────────┘   │  ◯ universal       │
│                                                     │                    │
│   ┌─────────────────────────────────────────────┐   │  Flags             │
│   │  ASSET DECK (collapsible — hover handle ▲)  │   │  ☑ default         │
│   │  [aurora] [vortex] [monolith] [+ NEW]       │   │  ☐ divine          │
│   └─────────────────────────────────────────────┘   │  ☐ heavy           │
│                                                     │                    │
└─────────────────────────────────────────────────────┴────────────────────┘
```

### 1.2 Las cuatro zonas

#### Zona A — **Visor / Dropzone** (`<TheiaViewport>`)
- Ocupa ~60% del alto izquierdo. Heredado del componente actual, refactorizado.
- Cuando NO hay clip cargado en el draft → overlay drop-zone con mensaje *"Drop a `.mp4` to start authoring"*.
- En modo AUTHOR muestra el `<video>` element (ref del orchestrator) sin pasar por el SAB del worker — feedback inmediato al hacer scrub.
- **NO se duplica** el video element; el orchestrator expone `getVideoElementRef()` para que el editor lo monte. En modo PERFORM el viewport vuelve a ser el OffscreenCanvas-backed del worker.
- Controls inferiores (overlaid): `play/pause`, `step ±1f`, `playback rate`, `currentTime / duration`.

#### Zona B — **Timeline Trimmer** (`<TimelineTrimmer>`)
- Banda horizontal ~120px de alto debajo del viewport.
- Eje X = duración total del `.mp4`. Conversión `pixelsPerSecond = width / durationS`.
- **Tres capas visuales** (z-index ascendente):
  1. **Track bar**: gradiente espectral (frecuencias bajas en violeta, altas en cyan). Generado al cargar el clip vía un `OfflineAudioContext` que extrae el audio del .mp4 y dibuja el espectrograma en un `<canvas>` cacheado.
  2. **Cuepoint blocks**: rectángulos translúcidos con borde neón. Cada bloque muestra `[id]` y duración. Drag-edges para `startMs`/`endMs`. Click para seleccionar.
  3. **Playhead**: línea vertical 2px cyan brillante con label flotante `MM:SS.ms`.
- Acciones: `[+ ADD CUEPOINT]` (crea uno en `playhead..playhead+10s`), `[DELETE]` (selección actual), `[SPLIT AT PLAYHEAD]`, `[MERGE WITH NEXT]`.
- Snapping al beat opcional (toggle `[⊿ SNAP]`) — usa el BPM detectado del audio extraído.

#### Zona C — **DNA Lab** (`<DnaLab>`)
- Sidebar derecho ~340px, glassmorphism. Visible solo si hay un cuepoint seleccionado (sino muestra panel "Clip-Level DNA").
- Tres knobs verticales para `aggression`, `chaos`, `organicity` (∈ [0,1] step 0.01).
  - Knob = SVG circular con marca neón. Drag vertical = ajuste. Doble-click = reset a 0.5.
  - **Visualización 3D del genoma**: pequeño cubo unitario rotando lento con un punto representando la posición actual + puntos fantasma (fade) de los otros cuepoints del clip — útil para evitar genomas duplicados (diversity at-a-glance).
- Pickers `EnergyZone min` / `max`: dos selects encadenados de `silence | valley | ambient | gentle | active | intense | peak`. Validación: `min ≤ max` (UI bloquea selecciones inválidas).
- Multi-select de `validSections` (chips toggle): `intro · verse · buildup · drop · peak · breakdown · outro`.
- Radio group `textureAffinity`: `clean / dirty / universal`.
- Checkboxes flags: `default` (mutex en todo el clip), `isDivineCandidate`, `isHeavyCandidate`.
- Inputs auxiliares: `name` (free-text label) y `preferredVibes` (chip-input con autocomplete del `compatibleVibes` heredado).

#### Zona D — **Asset Deck** (`<AssetDeck>`)
- Banda inferior colapsable con un handle `▲`. En reposo: 60px (solo nombres). Expandida: 180px (thumbnails + meta).
- Lista horizontal scroll de cards: thumbnail + `name` + duración + badge cognitivo (mini-cubo del globalDNA).
- Cards: click = cargar en draft, doble-click = abrir en author, click derecho = menú (`Export · Duplicate · Remove from session`).
- Card especial al final: `[+ NEW] · drop a .mp4` (también acepta drop directo).
- Cards "modificadas sin guardar" muestran indicador `●` magenta.

#### Zona E — **Header / Toolbar** (`<TheiaHeader>`)
- Modo toggle `[PERFORM ◐ AUTHOR]` (gran switch glassmorphism).
- Project chip: nombre del `.theia` actualmente abierto. Click = file picker.
- Indicador de save: `DRAFT · saved 12s ago` o `● UNSAVED`.
- Botones: `💾 SAVE` (sobre disco), `EXPORT .theia` (file dialog), `IMPORT .theia`.
- Sección hidden detrás de chevron: `Validate (G1-G7)`, `Generate from audio analysis (BETA)`.

---

## 2. ÁRBOL DE COMPONENTES REACT

```
<TheiaEngineView>
├── <TheiaHeader>
│    ├── <ModeToggle perform|author>
│    ├── <ProjectChip>           ← project name + file picker
│    ├── <SaveIndicator>         ← debounced timestamp
│    └── <ExportImportButtons>
│
├── <TheiaWorkspace>              ← grid layout switch by mode
│    │
│    ├── (mode === 'perform')
│    │   └── <TheiaPerformLayout> ← layout actual (no se rompe)
│    │       ├── <TheiaViewport variant="perform">
│    │       ├── <SectionMonitor>
│    │       └── <PerformControls>
│    │
│    └── (mode === 'author')
│        ├── <TheiaViewport variant="author">
│        │   ├── <VideoElementMount>     ← ref del orchestrator
│        │   ├── <DropZoneOverlay>       ← visible si !draft.asset
│        │   └── <ScrubControls>
│        │
│        ├── <TimelineTrimmer>
│        │   ├── <TimelineSpectrogramLayer>   ← canvas del audio
│        │   ├── <TimelineCuepointsLayer>     ← bloques + handles
│        │   │   └── <CuepointBlock × N>
│        │   ├── <TimelinePlayheadLayer>      ← canvas/SVG playhead
│        │   ├── <TimelineRuler>              ← ticks de tiempo
│        │   └── <TimelineToolbar>            ← +ADD / DELETE / SPLIT / SNAP
│        │
│        ├── <DnaLab>                          ← solo si cuepoint seleccionado
│        │   ├── <CuepointHeader>              ← name + id
│        │   ├── <GenomeCubeViz>               ← 3D mini-viz
│        │   ├── <GenomeKnobGroup>
│        │   │   ├── <GenomeKnob param="aggression">
│        │   │   ├── <GenomeKnob param="chaos">
│        │   │   └── <GenomeKnob param="organicity">
│        │   ├── <EnergyZoneRangePicker>
│        │   ├── <ValidSectionsChips>
│        │   ├── <TextureAffinityRadio>
│        │   ├── <CuepointFlagsCheckboxes>
│        │   └── <PreferredVibesChipInput>
│        │
│        └── <AssetDeck>
│            ├── <AssetDeckHandle>             ← collapse toggle
│            └── <AssetDeckGrid>
│                ├── <AssetCard × N>
│                └── <NewAssetCard>
│
├── <TheiaInspectorOverlay>  ← retractable side panel (existente, modo PERFORM)
│
└── <TheiaToasts>             ← validate errors, save status, etc.
```

### 2.1 Decisiones de implementación

- **Layout switch**: `mode === 'author'` aplica `display: grid` con áreas declaradas (`viewport timeline asset-deck` × `dna-lab`) — UN solo container. No se desmonta el viewport entre modos (preserva el `<video>` element y evita re-buffering).
- **`<TimelineTrimmer>`**: implementación canvas-first para los layers (spectrogram + playhead) con un overlay React absoluto para los bloques (drag/drop nativo de React es suficiente con `pointerdown/move/up`).
- **`<DnaLab>` aparece/desaparece**: animación de 200ms `slide-right`. Cuando ningún cuepoint seleccionado → muestra "Clip-Level DNA" (edita el `globalDNA` y `compatibleVibes`).
- **`<GenomeCubeViz>`**: usa el R3F existente del proyecto. 3 axes con labels `A / C / O`. Punto activo neón cyan. Puntos fantasma (otros cuepoints) opacity 0.3 magenta.

---

## 3. STATE MANAGEMENT — DRAFT STATE

### 3.1 Por qué un store dedicado (no Zustand global)

El estado de edición es **transient** (no debe contaminar `useTruthStore` ni `useControlStore`). Vive solo mientras el modo es AUTHOR. Se persiste a `localStorage` para survivability, pero NO a `truthStore`. Aislado = testeable.

### 3.2 Tipos del store

```typescript
// src/stores/theiaEditorStore.ts (FUTURE)

import type { ITheiaCuePoint, ITheiaGenome, EnergyZone } from '@/types/theiaTypes'

/**
 * Draft = manifesto .theia en construcción/edición. Se hidrata desde:
 *   - Importar un .theia existente (load + decode)
 *   - Drop de un .mp4 crudo (genera asset esqueleto + 1 cuepoint default)
 *   - Recovery desde localStorage (autosave)
 */
export interface TheiaDraftState {
  // ── Identity & file binding ─────────────────────────────────────────
  /** ID estable del draft (UUID). Cambia solo al "New". */
  draftId: string
  /** Nombre lógico para UI ("aurora-flow"). */
  name: string
  /** Path absoluto del .theia si fue cargado de disco. null = nuevo. */
  loadedFromPath: string | null
  /** Path del .mp4 binario asociado. */
  assetFilePath: string

  // ── Audio/video metadata (read-only, derived from .mp4) ─────────────
  durationMs: number
  fps: number
  resolution: { w: number; h: number }
  /** Cache del análisis de audio (BPM detectado, espectrograma, peaks). */
  audioAnalysis: AudioAnalysis | null

  // ── Cognitive content (editable) ────────────────────────────────────
  globalDNA: ITheiaGenome
  textureAffinity: 'clean' | 'dirty' | 'universal'
  compatibleVibes: string[]
  cuePoints: DraftCuePoint[]

  // ── Editor-only metadata (NOT serialized to .theia) ─────────────────
  selectedCuepointId: string | null
  /** Posición actual del playhead en ms (sincronizada con videoElement). */
  playheadMs: number
  /** Si el cuepoint seleccionado debe "follow" el playhead durante drag. */
  scrubFollowsCuepoint: boolean
  /** Snapping al beat ON/OFF + valor del BPM (puede sobreescribir el detectado). */
  snapToBeat: boolean
  bpmOverride: number | null
  /** Zoom del timeline (1.0 = full clip; >1.0 = zoom in). */
  timelineZoom: number
  /** Offset del timeline cuando hay zoom (ms del extremo izquierdo). */
  timelineOffsetMs: number

  // ── Persistence flags ───────────────────────────────────────────────
  isDirty: boolean
  lastAutosaveAt: number | null
  validationErrors: ValidationError[]
}

/** Cuepoint en draft = ITheiaCuePoint + uuid local + flags de UI. */
export interface DraftCuePoint extends ITheiaCuePoint {
  /** UUID estable durante la sesión (separado del id de archivo). */
  uuid: string
  /** Color asignado para distinción visual en timeline. */
  swatchColor: string
  /** True si fue creado en esta sesión (para badge "NEW"). */
  isNew: boolean
}

export interface AudioAnalysis {
  detectedBpm: number | null
  spectrogramDataURL: string  // PNG cached
  beatGridMs: number[]        // posiciones de beats detectadas
  rmsCurve: Float32Array      // 1 sample per ms, downsampled
}

export interface ValidationError {
  gate: 'G1' | 'G3' | 'G4' | 'G7'
  message: string
  cuepointId?: string
}
```

### 3.3 Acciones del store (Zustand)

```typescript
export interface TheiaEditorActions {
  // ── Lifecycle ──────────────────────────────────────────────────────
  newDraftFromMp4(filePath: string, meta: { durationMs; fps; resolution }): void
  loadDraftFromTheia(theiaPath: string): Promise<void>
  hydrateFromAutosave(): boolean   // returns true si recovery exitoso
  discardDraft(): void

  // ── Cuepoint CRUD ───────────────────────────────────────────────────
  addCuepoint(at: { startMs: number; endMs: number }): string  // returns uuid
  removeCuepoint(uuid: string): void
  splitCuepointAtPlayhead(uuid: string): void
  mergeCuepointWithNext(uuid: string): void
  selectCuepoint(uuid: string | null): void
  updateCuepointTiming(uuid: string, startMs: number, endMs: number): void
  updateCuepointMeta(uuid: string, patch: Partial<DraftCuePoint>): void
  setDefaultCuepoint(uuid: string): void   // mutex: limpia el flag en otros

  // ── Genome editing ──────────────────────────────────────────────────
  updateGlobalDNA(patch: Partial<ITheiaGenome>): void
  updateCuepointDNA(uuid: string, patch: Partial<ITheiaGenome>): void
  setEnergyZone(uuid: string, min: EnergyZone, max: EnergyZone): void
  toggleValidSection(uuid: string, section: string): void

  // ── Playhead / preview ──────────────────────────────────────────────
  setPlayheadMs(ms: number): void                    // ← driven by orchestrator
  jumpToCuepoint(uuid: string): void                 // = setPlayheadMs + seek
  setTimelineZoom(zoom: number, anchorMs?: number): void

  // ── Validation & export ─────────────────────────────────────────────
  validate(): ValidationError[]
  buildTheiaManifest(): TheiaFileV1
  exportToFile(targetPath: string): Promise<{ ok: boolean; error?: string }>
}
```

### 3.4 Sincronización playhead ↔ videoElement ↔ orchestrator

Tres bordes que deben mantenerse en fase:

```
┌────────────────────────────────────────────────────────────────┐
│  ① videoElement.currentTime (renderer DOM, source of truth)    │
│       ↑↓                                                       │
│  ② React state: draft.playheadMs (consumed by Timeline UI)     │
│       ↑↓                                                       │
│  ③ ThetaOrchestrator.handleCueJump (PERFORM) / scrub (AUTHOR)  │
└────────────────────────────────────────────────────────────────┘
```

**Estrategia:**
- **Read-side (DOM → React)**: un único `requestAnimationFrame` loop en `<TimelineTrimmer>` lee `videoElement.currentTime * 1000`. Si difiere del store en ≥10ms, llama `setPlayheadMs(ms)`. Throttle a 30Hz para no spammear el render React (la UI no necesita 60Hz para el playhead).
- **Write-side (React → DOM)**: `jumpToCuepoint` y scrub manual del playhead llaman `videoElement.currentTime = ms/1000` directamente. El RAF loop del read-side recogerá el valor en el siguiente tick — no hay double-update.
- **Modo AUTHOR ignora `handleCueJump`**: el orchestrator expone `setAuthoringMode(true)` que silencia el wiring de Selene. Los scrub del editor no compiten con cues cognitivos.
- **Suspende el bridge SAB**: en AUTHOR, `TheiaVideoRenderer` se desconecta del `AetherCanvasManager` para que el editor no proyecte luz mientras se autoriza (toggle visible: `[● PROJECT TO LIGHTS]`).

### 3.5 Autosave

- Middleware Zustand: cada mutación marca `isDirty=true`.
- Effect de top-level: `setInterval(saveDraftToLocalStorage, 2000)` solo si `isDirty`.
- Storage key: `luxsync.theia.draft.<draftId>`. TTL implícito (ignorar drafts >7 días).
- Recovery: al montar `<TheiaEngineView>` en modo AUTHOR, intentar `hydrateFromAutosave()` y mostrar toast "Draft recovered from session".

---

## 4. WORKFLOW DEL OPERADOR

### 4.1 Flujo principal: cero-a-published

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1 — DROP                                                      │
│                                                                     │
│  Usuario arrastra `aurora-flow.mp4` al viewport (cualquier zona).   │
│       ↓                                                             │
│  Editor:                                                            │
│   - Pide al main process el `path` real (security: ipc invoke).     │
│   - Crea videoElement hidden + extrae metadata via 'loadedmetadata' │
│   - Lanza análisis de audio en Web Worker (BPM + spectrogram).      │
│   - newDraftFromMp4() → store inicializado:                         │
│       · 1 cuepoint default cubriendo [0, durationMs]                │
│       · globalDNA = { 0.5, 0.5, 0.5 }   (neutro)                    │
│       · textureAffinity = 'universal'                               │
│       · compatibleVibes = ['unspecified']                           │
│   - Toast: "Drop accepted. Click anywhere on timeline to add cues." │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2 — CARVE CUEPOINTS                                           │
│                                                                     │
│  Usuario reproduce el clip. Cuando oye un drop:                     │
│   - Click [+ ADD CUEPOINT] (atajo `C`) → crea zona [t-3s, t+3s].   │
│   - Drag de los handles para ajustar inicio/fin.                    │
│   - Doble-click en el bloque → renombra ('drop-peak').              │
│   - Atajo `S` → split en playhead. `M` → merge with next.           │
│   - El cuepoint default se reduce automáticamente para no solapar.  │
│                                                                     │
│  Snap-to-beat (toggle): los handles se imantan a `beatGridMs[]`.    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3 — TUNE DNA                                                  │
│                                                                     │
│  Selecciona un cuepoint → DNA Lab aparece (slide-right 200ms).      │
│   - Knobs A/C/O: drag vertical o scroll.                            │
│   - GenomeCubeViz muestra el punto en 3D. Si está demasiado cerca   │
│     de otro cuepoint del mismo clip, el cubo destella magenta       │
│     (warning: "low diversity — Selene preferirá uno o el otro").    │
│   - EnergyZone min/max: pickers encadenados.                        │
│   - validSections: chips toggle. Selene filtra por esto.            │
│   - Flags `default` / `divine` / `heavy`.                           │
│                                                                     │
│  Preview en directo:                                                │
│   - Botón [SIMULATE] arriba del DNA Lab → llama directamente a      │
│     `getSeleneTheiaAdapter().process(mockInput)` con un input que   │
│     matchea el cuepoint. Muestra `score`, `distance`, `winner`.     │
│     Permite verificar que Selene escogerá este cuepoint cuando se   │
│     den las condiciones esperadas.                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4 — VALIDATE & EXPORT                                         │
│                                                                     │
│  Click [EXPORT .theia]:                                             │
│   - Corre `validate()` (gates G1/G3/G4/G7 — espejo del Loader).     │
│   - Si hay errores → highlight rojo en el componente afectado +     │
│     toast con la lista. NO permite exportar hasta arreglar.         │
│   - Si OK → buildTheiaManifest() + file dialog `Save .theia as...`. │
│   - Escribe a disco vía main process.                               │
│   - Llama a `getTheiaRegistry().register(asset)` para que el clip   │
│     esté disponible inmediatamente para Selene en runtime.          │
│   - Marca `isDirty=false`. Borra autosave.                          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5 — TEST IN PERFORM MODE                                      │
│                                                                     │
│  Toggle [PERFORM]. La sesión vuelve al runtime.                     │
│  El nuevo .theia ya está en el TheiaRegistry → Selene puede saltar  │
│  a sus cuepoints según el ADN matching.                             │
│                                                                     │
│  Atajo `Alt+A` vuelve al author con el último draft cargado.        │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Atajos de teclado (modo AUTHOR)

| Atajo | Acción |
|-------|--------|
| `Space` | Play/Pause |
| `←` / `→` | Step ±1 frame |
| `Shift+←` / `Shift+→` | Skip ±1s |
| `C` | Add cuepoint en playhead |
| `S` | Split cuepoint en playhead |
| `M` | Merge con siguiente |
| `Delete` | Remove cuepoint seleccionado |
| `Tab` / `Shift+Tab` | Cycle cuepoint selection |
| `Ctrl+S` | Save (export rápido al last path) |
| `Ctrl+E` | Export As... |
| `Alt+A` / `Alt+P` | Toggle Author / Perform |
| `,` / `.` | Zoom timeline ±10% |
| `1-7` | Quick-set energyZone min del cuepoint actual |

---

## 5. DECISIONES VISUALES — CYBERPUNK DISCIPLINE

### 5.1 Paleta y materiales

| Token | Valor | Uso |
|-------|-------|-----|
| `--theia-author-bg` | `#0a0e1a` | Fondo base |
| `--theia-author-panel` | `rgba(15, 22, 38, 0.72)` + blur 12px | Glass de DNA Lab / Asset Deck |
| `--theia-accent-primary` | `#06b6d4` (cyan-500) | Playhead, valores activos, knobs |
| `--theia-accent-warn` | `#a855f7` (purple-500) | Diversity warnings, dirty markers |
| `--theia-accent-danger` | `#ef4444` (red-500) | Validation errors, divine flag |
| `--theia-accent-ok` | `#22c55e` (green-500) | Save success, default cuepoint |
| `--theia-grid-line` | `rgba(255,255,255,0.04)` | Ruler ticks, scanlines |

### 5.2 Reglas de composición

- **Una sola dirección de luz neón por panel.** El DNA Lab brilla cyan (left edge). El timeline pulsa cyan en el playhead. El asset deck cyan en hover. No mezclar magenta + cyan en el mismo panel salvo para warnings explícitos.
- **Glassmorphism con disciplina.** `backdrop-filter: blur(12px) saturate(120%)`. NUNCA blur dentro del viewport del vídeo (artifacts de codec).
- **Tipografía**: `Inter` para UI, `JetBrains Mono` para valores numéricos (timecodes, valores de knobs, IDs).
- **Animaciones**: solo 3 timings: `120ms` (toggles, hovers), `200ms` (panel slides), `400ms` (mode switch). Easing `cubic-bezier(0.16, 1, 0.3, 1)` (overshoot suave).
- **Scanlines**: solo sobre el viewport, opacity 0.04, no sobre paneles de control.

### 5.3 Anti-caos: jerarquía visual

```
Z-INDEX:
   0  · workspace background
  10  · viewport video element
  20  · timeline tracks/cuepoints
  30  · playhead overlay
  40  · DNA Lab sidebar
  50  · Asset Deck (when expanded)
  60  · drop-zone overlay
  70  · toasts
  90  · modal dialogs (export, file pickers)
 100  · MIDI-learn overlay
```

### 5.4 Densidad informativa controlada

- DNA Lab: máximo **8 controles principales visibles** (3 knobs + 2 zone pickers + texture radio + flags grupo + chips). Más controles → desplegable "Advanced".
- Timeline: máximo 16 cuepoints visibles a la vez sin scroll. Si más → mini-mapa abajo.
- Asset Deck colapsado: solo nombres. Hover sobre uno → tooltip con metadatos. Mantiene la pantalla limpia durante la edición intensiva.

### 5.5 Estados visuales claros

| Estado | Indicador |
|--------|-----------|
| Cuepoint default | Borde verde + badge `★` |
| Cuepoint seleccionado | Glow cyan animado + border 2px |
| Cuepoint divine candidate | Mini-icono ⚡ magenta esquina superior |
| Cuepoint heavy candidate | Mini-icono 💪 esquina inferior |
| Cuepoint con error de validación | Borde rojo pulsante |
| Draft con cambios sin guardar | Punto magenta junto al nombre del proyecto |
| Diversity warning entre cuepoints | Líneas finas magenta entre puntos del cubo 3D |

---

## 6. INTERFACE WITH BACKEND (WAVE 4900-4903)

### 6.1 Llamadas que el editor hace

| Call | Cuándo | Layer |
|------|--------|-------|
| `getTheiaRegistry().register(asset)` | Tras export exitoso | WAVE 4901 |
| `getTheiaRegistry().getAsset(id)` | Al cargar un .theia existente | WAVE 4901 |
| `new TheiaFileLoader(reg).load(json)` | Import de .theia desde disco | WAVE 4902 |
| `getSeleneTheiaAdapter().process(mock)` | Botón [SIMULATE] del DNA Lab | WAVE 4902 |
| `getThetaOrchestrator().setAuthoringMode(true)` | Entrar en AUTHOR | WAVE 4903 (NEW) |
| `getThetaOrchestrator().getVideoElementRef()` | Mount del viewport | WAVE 4903 (NEW) |

### 6.2 Cambios menores requeridos en backend

Para soportar AUTHOR sin pelearse con PERFORM:

1. **`ThetaOrchestrator.setAuthoringMode(boolean)`** — silencia `handleCueJump` mientras está en true. Los scrubs manuales del editor pasan directos al `videoElement`.
2. **`ThetaOrchestrator.getVideoElementRef()`** — expone el `<video>` element para que el editor lo monte en el viewport (PERFORM lo deja en `position: fixed; top:-9999px`; AUTHOR lo restituye al viewport).
3. **`TheiaRegistry.update(asset)`** — actualizar (no solo registrar) un asset si ya existe (para hot-reload de drafts exportados).

Estas tres adiciones son one-liners; se documentan aquí para que la implementación frontend tenga contrato claro.

---

## 7. ÁRBOL DE ARCHIVOS PROPUESTO

```
electron-app/src/components/views/TheiaEngineView/
├── index.tsx                       ← orquestador (mode switch + layout grid)
├── TheiaEngineView.css             ← estilos compartidos
│
├── header/
│   ├── TheiaHeader.tsx
│   ├── ModeToggle.tsx
│   └── SaveIndicator.tsx
│
├── viewport/
│   ├── TheiaViewport.tsx
│   ├── DropZoneOverlay.tsx
│   └── ScrubControls.tsx
│
├── timeline/
│   ├── TimelineTrimmer.tsx
│   ├── TimelineSpectrogramLayer.tsx
│   ├── TimelineCuepointsLayer.tsx
│   ├── TimelinePlayheadLayer.tsx
│   ├── TimelineRuler.tsx
│   ├── TimelineToolbar.tsx
│   └── CuepointBlock.tsx
│
├── dna-lab/
│   ├── DnaLab.tsx
│   ├── GenomeCubeViz.tsx           ← R3F mini scene
│   ├── GenomeKnobGroup.tsx
│   ├── GenomeKnob.tsx
│   ├── EnergyZoneRangePicker.tsx
│   ├── ValidSectionsChips.tsx
│   ├── TextureAffinityRadio.tsx
│   ├── CuepointFlagsCheckboxes.tsx
│   └── PreferredVibesChipInput.tsx
│
├── asset-deck/
│   ├── AssetDeck.tsx
│   ├── AssetCard.tsx
│   └── NewAssetCard.tsx
│
└── hooks/
    ├── usePlayheadSync.ts          ← RAF loop videoElement → store
    ├── useTimelineZoom.ts
    ├── useDropZone.ts
    ├── useAuthoringShortcuts.ts
    └── useAudioAnalysisWorker.ts

electron-app/src/stores/
└── theiaEditorStore.ts             ← Zustand draft store (§3)

electron-app/src/workers/
└── theiaAudioAnalysis.worker.ts    ← BPM + spectrogram offline
```

---

## 8. ROLLOUT INCREMENTAL

| Sub-wave | Scope | Bloqueante para |
|----------|-------|-----------------|
| **4910.1** | `theiaEditorStore` + tipos del draft | Todo lo demás |
| **4910.2** | `TheiaHeader` + ModeToggle (sin AUTHOR funcional aún) | UX flow básico |
| **4910.3** | `TheiaViewport` AUTHOR + DropZoneOverlay + drop handler | 4910.4 |
| **4910.4** | `TimelineTrimmer` (sin spectrogram, sin snap) | 4910.5 |
| **4910.5** | `DnaLab` completo (incluye GenomeCubeViz) | Editing real |
| **4910.6** | `AssetDeck` AUTHOR mode | Multi-clip workflow |
| **4910.7** | Audio analysis worker + spectrogram + beat snap | Polish |
| **4910.8** | Validation + export + autosave + recovery | Production-ready |
| **4910.9** | Atajos de teclado + MIDI-learn bindings | Pro UX |

Cada sub-wave es vertical: deliverable testeable end-to-end.

---

## 9. RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|--------|------------|
| **Pelea entre PERFORM y AUTHOR** sobre el videoElement | `setAuthoringMode(true)` silencia el wiring de Selene. Único dueño durante AUTHOR. |
| **Lag al editar cuepoints en clips largos** (tracks con miles de keyframes en Timeline) | Renderizado canvas-first (no DOM-per-cuepoint). Virtualization si >32 cuepoints. |
| **localStorage quota** (drafts grandes con spectrogram cacheado) | Spectrogram se guarda en `IndexedDB` no en localStorage. localStorage solo para metadata. |
| **Dropear `.mp4` con codec no soportado** | Validar codec via `videoElement.canPlayType()` antes de aceptar. Toast informativo si rechazado. |
| **Usuario edita en modo AUTHOR mientras Selene corre** | El toggle PERFORM/AUTHOR es modal — entrar a AUTHOR pone Selene en pause de cue-jumps (no de pensar; las luces L3 siguen). |
| **Pérdida del draft por crash** | Autosave 2s + recovery toast al abrir. |

---

## 10. ALINEACIÓN FILOSÓFICA

> *"El operador es un autor. Selene es la intérprete. El editor es el atelier donde se compone el genoma de cada cuadro de luz."*

El editor NO es un timeline tradicional de NLE. Es un **microscopio cognitivo**: cada cuepoint es una declaración matemática sobre cómo Selene debe percibir un fragmento de música. Tres knobs, una zona, un default — y el algoritmo encuentra el match perfecto. Toda la complejidad del backend (4900-4903) se reduce a 8 controles visibles. **Esa es la victoria de UX.**

---

*Fin del blueprint WAVE 4910. Ningún código fue ejecutado durante el diseño de esta directiva.*
