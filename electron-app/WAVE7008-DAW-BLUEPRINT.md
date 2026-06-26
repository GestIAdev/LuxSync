# WAVE 7008: UI ARCHITECTURAL BLUEPRINT
## Hephaestus V3 — 3-Tier DAW Layout Refactor

---

## 1. Anatomía del Shell (`HephaestusView/index.tsx`)

### 1.1 Estructura Raíz Post-Refactor

```tsx
const HephaestusView: React.FC = () => {

  // ── TIER 1 & 2: I/O state stays here (ver §1.3) ──
  // ── Zustand store connections retained ──
  // ── File I/O callbacks retained ──

  return (
    <div className="heph-view">

      {/* ══ TIER 1: GLOBAL I/O BAR — 40px, #111, flex-shrink:0 ══ */}
      <header className="heph-global-bar">
        {/* Logo + Clip Name (editable) + Duration (editable) */}
        {/* ZoneSelector + SafetyStrip */}
        {/* Undo / Redo + Load Show + New + Save + Save As + Library Toggle */}
      </header>

      {/* ══ TIER 2: WORKSPACE ROUTER SWITCHER — 36px, #1a1a1a, flex-shrink:0 ══ */}
      <nav className="heph-tab-rail">
        <button
          className={`heph-tab-rail__btn ${activeTab === 'sculpt' ? 'heph-tab-rail__btn--active' : ''}`}
          onClick={() => setActiveTab('sculpt')}
        >
          ✏️ SCULPT
        </button>
        <button
          className={`heph-tab-rail__btn ${activeTab === 'lab' ? 'heph-tab-rail__btn--active' : ''}`}
          onClick={() => setActiveTab('lab')}
        >
          📐 LABORATORY
        </button>
      </nav>

      {/* ══ TIER 3: ACTIVE WORKSPACE — flex:1 1 0, min-height:0, overflow:hidden ══ */}
      <div className="heph-tier3">
        {activeTab === 'sculpt' && (
          <ForgeTab
            library={library}
            isLoadingLibrary={isLoadingLibrary}
            isSaving={isSaving}
            showLibrary={showLibrary}
            liveBpm={liveBpm}
            clipCacheRef={clipCacheRef}
            onLoad={handleLoad}
            onDelete={handleDelete}
            onSetIsDirty={setIsDirty}
            temporalActions={temporalActions}
            setClip={setClip}
          />
        )}
        {activeTab === 'lab' && (
          <LabTab
            isSaving={isSaving}
            temporalActions={temporalActions}
            setClip={setClip}
            onSetIsDirty={setIsDirty}
          />
        )}
      </div>

      {/* ══ PORTAL: NewClipModal vive en Shell, nunca dentro de pestañas ══ */}
      <NewClipModal
        isOpen={showNewClipModal}
        onClose={() => setShowNewClipModal(false)}
        onCreate={handleCreateClip}
      />

    </div>
  )
}
```

---

### 1.2 CSS de las Nuevas Capas Tier

```css
/* Root container — orchestrador de los 3 tiers */
.heph-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Tier 1 — Global I/O Bar */
.heph-global-bar {
  height: 40px;
  flex: 0 0 40px;        /* No crece, no encoge */
  background: #111;
  display: flex;
  align-items: center;
  overflow: hidden;
  border-bottom: 1px solid #1e1e1e;
}

/* Tier 2 — Router Switcher */
.heph-tab-rail {
  height: 36px;
  flex: 0 0 36px;        /* No crece, no encoge */
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-bottom: 1px solid #2a2a2a;
}

.heph-tab-rail__btn {
  padding: 6px 24px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #888;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.heph-tab-rail__btn--active {
  color: #fff;
  border-bottom-color: #ff6600;
}

/* Tier 3 — Workspace host */
.heph-tier3 {
  flex: 1 1 0;           /* Toma todo el espacio restante */
  min-height: 0;         /* CRÍTICO: evita Flexbox Deadlock con flex-direction:column */
  display: flex;
  overflow: hidden;
}
```

---

### 1.3 Estado que Permanece en el Shell

| Hook | Líneas actuales | Motivo |
|---|---|---|
| `activeTab` | 166 | Controla el renderizado del Tier 3 |
| `isSaving`, `isDirty`, `saveMessage` | 151–154 | Propiedad de las operaciones I/O del Shell |
| `showLibrary` | 153 | Toggleado desde botón en Tier 1 |
| `showNewClipModal` | 161 | El modal es Portal del Shell |
| `isEditingName`, `editNameValue` | 169–170 | Editor inline del Tier 1 |
| `isEditingDuration`, `editDurationValue` | 171–172 | Editor inline del Tier 1 |
| `nameInputRef`, `durationInputRef` | 173–174 | Refs para foco del Tier 1 |
| `isLoadingShow` | 192 | Botón en Tier 1 |
| `library`, `isLoadingLibrary` | 149–150 | Cargados por `loadLibrary` (I/O Shell); pasados como prop a ForgeTab |
| `clipCacheRef` | 200 | Poblado por `loadLibrary`; pasado como prop a ForgeTab |
| `capturedBpm` + `liveBpm` | 335–338 | Derivado de THE HANDOFF + audioStore; pasado como prop a ForgeTab |

**Estado a ELIMINAR del Shell (no se mueve a ninguna pestaña):**

| Hook | Líneas | Razón |
|---|---|---|
| `showPhasePanel` | 163 | Abolido — PhaseControls es ahora panel fijo en LabTab |
| `phasePanelRef` | 180 | Sin HUD flotante, la ref deja de ser necesaria |

---

### 1.4 Callbacks que Permanecen en el Shell

| Callback | Líneas | Motivo |
|---|---|---|
| `loadLibrary` | 361–401 | Escritura/lectura de disco |
| `handleSave`, `handleSaveAs` | 403–490 | I/O de archivo |
| `handleLoad` | 492–516 | I/O; se pasa como prop `onLoad` a ForgeTab |
| `handleDelete` | 542–559 | I/O; se pasa como prop `onDelete` a ForgeTab |
| `handleNew` | 561–564 | Abre `NewClipModal` (propio del Shell) |
| `handleLoadShow` | 567–586 | I/O de show file |
| `handleCreateClip` | 588–613 | I/O + respuesta del modal |
| `handleZonesChange` | 615–624 | Controla `ZoneSelector` en Tier 1 |
| `startEditName`, `commitEditName` | 1308–1322 | Editor inline en Tier 1 |
| `startEditDuration`, `commitEditDuration` | 1324–1341 | Editor inline en Tier 1 |

**Effect a ELIMINAR del Shell:**

| Effect | Líneas | Razón |
|---|---|---|
| `showPhasePanel` click-outside | 1368–1382 | HUD flotante abolido |

---

### 1.5 Estrategia de Paso de Props: Shell → Pestañas

**Regla central:** El Store Zustand (`useHephaestusEditorStore`) es la memoria canónica. Cada pestaña se suscribe **directamente** al Store para `clip`, `activeTrackId`, `undo`/`redo`, `viewport`, etc. El Shell **no** los refleja como props.

El Shell inyecta **únicamente** lo que las pestañas no pueden obtener del Store:

```
Shell → ForgeTab:
  - library           (estado React local del Shell, no está en Store)
  - isLoadingLibrary  (ídem)
  - isSaving          (ídem)
  - showLibrary       (toggleado desde botón del Tier 1)
  - liveBpm           (derivado de THE HANDOFF chain)
  - clipCacheRef      (ref poblada por loadLibrary)
  - onLoad            (callback I/O)
  - onDelete          (callback I/O)
  - onSetIsDirty      (setter de estado del Shell)
  - temporalActions   (shim V2→V3: snapshot/undo/redo/resetWithClip/setViewport)
  - setClip           (shim V2→V3: updater genérico de clip)

Shell → LabTab:
  - isSaving          (para deshabilitar inputs durante guardado)
  - temporalActions   (para mutations con snapshot)
  - setClip           (para mutations inline de cognitiveDNA / simulationMeta)
  - onSetIsDirty      (setter de estado del Shell)
```

---

## 2. Contrato de Interfaz de `<ForgeTab />` (`tabs/ForgeTab.tsx`)

### 2.1 Definición de Props

```typescript
// tabs/ForgeTab.tsx

interface LibraryClip {
  id: string
  name: string
  author: string
  category: string
  tags?: string[]
  durationMs: number
  paramCount: number
  modifiedAt: number
  filePath: string
  effectType?: string
}

interface TemporalActions {
  snapshot: () => void
  undo: () => void
  redo: () => void
  resetWithClip: (clip: HephAutomationClipV3) => void
  setViewport: (vp: HephViewport) => void
}

export interface ForgeTabProps {
  library: LibraryClip[]
  isLoadingLibrary: boolean
  isSaving: boolean
  showLibrary: boolean
  liveBpm: number
  clipCacheRef: React.MutableRefObject<Map<string, HephAutomationClipV3>>
  onLoad: (clipId: string) => Promise<void>
  onDelete: (clipId: string) => Promise<void>
  onSetIsDirty: (dirty: boolean) => void
  temporalActions: TemporalActions
  setClip: (updater: (prev: HephAutomationClipV3) => HephAutomationClipV3) => void
}
```

---

### 2.2 Árbol de Componentes Interno

```
<ForgeTab>
  │
  │  /* Tier 3A Toolbar — elevada al tope, 48px fija */
  ├── <HephaestusToolbar
  │       activeCurve={activeCurve}
  │       selectedKeyframeIdx={selectedKeyframeIdx}
  │       clipDurationMs={clip.durationMs}
  │       onInterpolationChange={handleInterpolationChange}
  │       onModeChange={handleModeChange}
  │       onApplyBezierPreset={handleApplyBezierPreset}
  │       onApplyTemplate={handleApplyTemplate}
  │   />
  │
  └── <div className="heph-forge-body">       /* flex: 1 1 0; flex-direction: row; overflow: hidden */
        │
        │  /* Columna izquierda: Library (colapsable) */
        ├── {showLibrary && (
        │     <div className="heph-library">    /* flex: 0 0 220px; overflow-y: auto */
        │       <LibraryHeader />
        │       <SearchBar />
        │       <CategoryList>
        │         <CategoryHeader />
        │         <LibraryItem draggable onDragStart={handleDragStart} />
        │       </CategoryList>
        │     </div>
        │   )}
        │
        │  /* Columna central-izquierda: Parameter Lanes */
        ├── <div className="heph-param-sidebar">  /* flex: 0 0 200px; overflow-y: auto */
        │     <ParameterLane × N />
        │     <AddParamPopover />
        │   </div>
        │
        └── <div className="heph-canvas-area">    /* flex: 1 1 0; min-width: 0; overflow: hidden */
              {activeCurve
                ? <CurveEditor ... />
                : <div className="heph-no-curve">No curve selected</div>
              }
            </div>
```

---

### 2.3 CSS de Aislamiento de `<ForgeTab />`

```css
/* Tier 3A: shell de la pestaña */
.heph-forge-tab {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* Cuerpo de tres columnas */
.heph-forge-body {
  display: flex;
  flex-direction: row;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

/* Library — fijo 220px */
.heph-library {
  flex: 0 0 220px;
  width: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid #222;
}

/* Parameter sidebar — fijo 200px */
.heph-param-sidebar {
  flex: 0 0 200px;
  width: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid #222;
}

/* Canvas area — dinámico */
.heph-canvas-area {
  flex: 1 1 0;
  min-width: 0;    /* CRÍTICO: el SVG tiene ancho intrínseco; sin esto se rompe el shrink */
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

---

### 2.4 Estado Interno de `ForgeTab`

Los siguientes hooks migran **íntegramente** de `index.tsx` a `ForgeTab.tsx`:

| Hook | Líneas en `index.tsx` |
|---|---|
| `useState<number \| null>(null)` → `selectedKeyframeIdx` | 142 |
| `useState<Set<number>>(new Set())` → `selectedIndices` | 144 |
| `useState(0)` → `playheadMs` | 145 |
| `useState(false)` → `isPlaying` | 146 |
| `useState('')` → `searchQuery` | 157 |
| `useState<Set<string>>(new Set())` → `expandedCategories` | 158 |
| `useState(false)` → `showAddParamDropdown` | 162 |
| `useRef<HTMLDivElement>(null)` → `addParamRef` | 177 |
| `useRef<Map<...>>(new Map())` → `batchOriginRef` | 208 |
| `useRef<Array<...>>([])` → `clipboardRef` | 216–221 |

Derivados via `useMemo` que también migran (todos consumen `clip` y `activeTrackId` del Store):

| Derivado | Líneas en `index.tsx` |
|---|---|
| `activeCurve` | 224–228 |
| `paramIds` | 230–233 |
| `availableParams` | 236–240 |
| `activeParam` + `setActiveParam` | 243–255 |
| `groupedAvailableParams` | 274–284 |
| `filteredLibrary` | 287–295 |
| `groupedLibrary` | 297–311 |

---

### 2.5 Solución Arquitectónica — Elevación de `HephaestusToolbar`

**Problema actual:** El Toolbar es un hermano de `.heph-workspace` en el Shell (líneas 1960–1971), posicionado **debajo** del canvas. En el DAW Layout, debe ser una franja fija **encima** del body de tres columnas (análogo al channel strip de un DAW).

**Solución:** `HephaestusToolbar` se convierte en el **primer hijo** de `.heph-forge-tab`, con `flex-shrink: 0` y altura fija de 48px. El `.heph-forge-body` ocupa `flex: 1` debajo de él.

```
.heph-forge-tab (flex-direction: column)
  ├── <HephaestusToolbar />   → flex: 0 0 48px  (tope fijo)
  └── .heph-forge-body        → flex: 1 1 0     (resto del espacio)
```

Esto elimina el actual `{activeTab === 'sculpt' && <HephaestusToolbar ... />}` en el Shell y lo convierte en renderizado **incondicional** dentro de ForgeTab (la pestaña solo existe cuando `activeTab === 'sculpt'`).

---

## 3. Contrato de Interfaz de `<LabTab />` (`tabs/LabTab.tsx`)

### 3.1 Definición de Props

```typescript
// tabs/LabTab.tsx

export interface LabTabProps {
  isSaving: boolean
  temporalActions: TemporalActions   // mismo tipo que en ForgeTab (extraer a shared/types)
  setClip: (updater: (prev: HephAutomationClipV3) => HephAutomationClipV3) => void
  onSetIsDirty: (dirty: boolean) => void
}
```

Consumo **directo del Store** dentro de `LabTab`:
- `clip` y `activeTrackId` → `useHephaestusEditorStore`
- `stageFixtures` → `useStageStore(selectFixtures)`
- `preview` → `useHephPreview(clip, stageFixtures)` (hook auto-contenido)

---

### 3.2 Árbol de Componentes Interno

```
<LabTab>
  <div className="heph-lab-body">        /* flex:1; flex-direction:row; overflow:hidden */
    │
    ├── <div className="heph-phase-rack">           /* flex: 0 0 340px; overflow-y: auto */
    │     <div className="heph-phase-rack__title">  /* label estático */
    │       🌊 PHASE DISTRIBUTION ENGINE
    │     </div>
    │     <PhaseControls
    │         config={activePhaseConfig}
    │         onPhaseChange={handlePhaseChange}
    │         disabled={isSaving}
    │         spatialBehavior={clip.cognitiveDNA?.spatialBehavior}
    │         onSpatialBehaviorChange={handleSpatialBehaviorChange}
    │     />
    │   </div>
    │
    ├── <div className="heph-radar-panel">           /* flex: 1 1 0; min-width:0; overflow:hidden */
    │     {showRadar
    │       ? <HephRadar
    │             preview={preview}
    │             durationMs={clip.durationMs}
    │             onPlay={preview.play}
    │             onPause={preview.pause}
    │             onStop={preview.stop}
    │             onSeek={preview.seek}
    │         />
    │       : <button onClick={() => setShowRadar(true)}>🛰 Show Radar</button>
    │     }
    │   </div>
    │
    └── {showDna && (
          <div className="heph-dna-rail-wrapper">   /* flex: 0 0 260px; overflow:hidden */
            <DnaRail
                dna={clip.cognitiveDNA}
                simMeta={clip.simulationMeta}
                onDnaChange={handleDnaChange}
                onSimMetaChange={handleSimMetaChange}
                onEnableDna={handleEnableDna}
            />
          </div>
        )}
```

> **Nota:** El botón para toggle de `showDna` (🧬) migra del header del Shell al propio `LabTab`, ya que es funcionalidad exclusiva del laboratorio. Si se decide mantenerlo en Tier 1, se pasa `showDna` + `setShowDna` como props adicionales de `LabTab`.

---

### 3.3 Reglas Explícitas de Flexbox para `<LabTab />`

```css
/* Tier 3B: shell de la pestaña */
.heph-lab-tab {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* Body de tres columnas */
.heph-lab-body {
  display: flex;
  flex-direction: row;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

/* ── Columna Izquierda: Phase Rack ── */
.heph-phase-rack {
  flex: 0 0 340px;   /* NO crece (flex-grow:0), NO encoge (flex-shrink:0) */
  width: 340px;      /* Redundante pero explícito para legibilidad */
  min-width: 0;      /* Previene overflow si el contenido tiene anchos fijos internos */
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid #222;
  padding: 16px;
}

/* ── Centro: Radar Canvas ── */
.heph-radar-panel {
  flex: 1 1 0;       /* Crece para llenar, encoge hasta 0 */
  min-width: 0;      /* CRÍTICO: el <canvas> tiene ancho intrínseco;
                        sin min-width:0 el panel no puede encoger por debajo
                        de su contenido → Flexbox Deadlock */
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* El canvas interno de HephRadar debe ser 100% de su contenedor */
/* (Añadir en HephRadar.tsx al elemento <canvas>): */
/* canvas { width: 100%; height: 100%; display: block; } */

/* ── Columna Derecha: DNA Rail ── */
.heph-dna-rail-wrapper {
  flex: 0 0 260px;   /* NO crece, NO encoge */
  width: 260px;
  min-width: 0;
  overflow: hidden;  /* El cubo WebGL de GenomeCube no debe sangrar */
  border-left: 1px solid #222;
}
```

**Tabla de propiedades críticas de Flexbox — Resumen:**

| Columna | `flex-grow` | `flex-shrink` | `flex-basis` | `min-width` | `overflow` |
|---|---|---|---|---|---|
| Phase Rack | `0` | `0` | `340px` | `0` | `auto/hidden` |
| Radar Panel | `1` | `1` | `0` | `0` | `hidden` |
| DNA Rail | `0` | `0` | `260px` | `0` | `hidden` |

**`min-width: 0` es obligatorio en los tres columnas** porque todos contienen hijos con dimensiones intrínsecas (canvas 2D, SVG, WebGL). Sin él, `flex-shrink` no puede reducir el elemento por debajo de su contenido natural, rompiendo el layout.

---

### 3.4 Estado Interno de `LabTab`

| Hook | Migra de `index.tsx` líneas |
|---|---|
| `useState(true)` → `showRadar` | 183 |
| `useState(false)` → `showDna` | 186 |
| `useStageStore(selectFixtures)` → `stageFixtures` | 187 |
| `useHephPreview(clip, stageFixtures)` → `preview` | 188 |
| `useMemo` → `activePhaseConfig` | 257–262 |

---

### 3.5 Callbacks que Migran a `LabTab`

Los siguientes callbacks se extraen de `index.tsx` y se declaran dentro de `LabTab`:

| Callback | Líneas en `index.tsx` | Notas |
|---|---|---|
| `handlePhaseChange` | 626–631 | Ya es nombrado; migración directa |
| `handleSpatialBehaviorChange` | 1893–1902 (inline JSX) | Extraer de inline a `useCallback` nombrado |
| `handleDnaChange` | 1936–1940 (inline JSX) | Extraer de inline a `useCallback` nombrado |
| `handleSimMetaChange` | 1941–1945 (inline JSX) | Extraer de inline a `useCallback` nombrado |
| `handleEnableDna` | 1946–1955 (inline JSX) | Extraer de inline a `useCallback` nombrado |

---

## 4. Plan de Desguace Quirúrgico (Paso a Paso)

### PASO 1 — Crear archivos stub

Crear los dos nuevos archivos con stubs de componente vacío:

- `src/components/views/HephaestusView/tabs/ForgeTab.tsx`
  ```tsx
  export const ForgeTab: React.FC<ForgeTabProps> = () => null
  ```
- `src/components/views/HephaestusView/tabs/LabTab.tsx`
  ```tsx
  export const LabTab: React.FC<LabTabProps> = () => null
  ```

Verificar: `tsc --noEmit` sin errores nuevos antes de continuar.

---

### PASO 2 — Migrar a `ForgeTab.tsx`: estado y refs

Cortar de `index.tsx` y pegar en el cuerpo de `ForgeTab`:

| Qué cortar | Líneas exactas |
|---|---|
| `selectedKeyframeIdx` state | 142 |
| `selectedIndices` state | 144 |
| `playheadMs` state | 145 |
| `isPlaying` state | 146 |
| `searchQuery` state | 157 |
| `expandedCategories` state | 158 |
| `showAddParamDropdown` state | 162 |
| `addParamRef` ref | 177 |
| `batchOriginRef` ref | 208 |
| `clipboardRef` ref | 216–221 |

---

### PASO 3 — Migrar a `ForgeTab.tsx`: derivados y effects

| Qué cortar | Líneas exactas |
|---|---|
| `activeCurve` useMemo | 224–228 |
| `paramIds` useMemo | 230–233 |
| `availableParams` useMemo | 236–240 |
| `activeParam` + `setActiveParam` useCallback | 243–255 |
| `groupedAvailableParams` useMemo | 274–284 |
| `filteredLibrary` useMemo | 287–295 |
| `groupedLibrary` useMemo | 297–311 |
| Auto-expand categories `useEffect` | 314–318 |
| BPM debug `useEffect` | 341–343 |

---

### PASO 4 — Migrar a `ForgeTab.tsx`: callbacks de curva

Cortar el bloque completo de callbacks de mutación (son lógicamente inseparables):

| Qué cortar | Líneas exactas |
|---|---|
| `handleCategoryToggle` | 637–647 |
| `handleDragStart` | 649–700 |
| `updateCurve` | 706–718 |
| `updateCurveWithSnapshot` | 720–729 |
| `handleKeyframeAdd` | 731–764 |
| `handleKeyframeMove` | 766–823 |
| `handleDragStartWithSnapshot` | 825–843 |
| `handleBatchKeyframeMove` | 845–883 |
| `handleKeyframeDelete` | 885–893 |
| `handleInterpolationChange` | 895–901 |
| `handleAudioBindingChange` | 903–910 |
| `handleBatchAudioBind` | 912–942 |
| `handleBezierHandleMove` | 944–950 |
| `handleKeyframeSelect` | 952–960 |
| `handleMultiSelect` | 966–975 |
| `handleCopyKeyframes` | 977–1002 |
| `handlePasteKeyframes` | 1004–1071 |
| `handlePasteAtTime` | 1073–1133 |
| `handleModeChange` | 1135–1137 |
| `handleAddParam` | 1144–1178 |
| `handleRemoveParam` | 1180–1202 |
| `handleApplyTemplate` | 1208–1215 |
| `handleApplyBezierPreset` | 1217–1228 |
| `handleApplyShapeToSelection` | 1242–1302 |
| Add-param click-outside `useEffect` | 1347–1362 |
| Keyboard handler `useEffect` | 1388–1429 |

---

### PASO 5 — Migrar a `ForgeTab.tsx`: JSX

| Qué cortar | Líneas exactas | Destino en ForgeTab |
|---|---|---|
| JSX del bloque sculpt (library panel + param sidebar + canvas area) | 1652–1880 | `return (...)` de ForgeTab, dentro de `.heph-forge-body` |
| JSX del toolbar (actualmente condicional en Shell) | 1960–1971 | Primero hijo del return de ForgeTab, ANTES de `.heph-forge-body` |

---

### PASO 6 — Migrar a `LabTab.tsx`

| Qué cortar de `index.tsx` | Líneas exactas |
|---|---|
| `showRadar` state | 183 |
| `showDna` state | 186 |
| `stageFixtures` hook | 187 |
| `preview` hook | 188 |
| `activePhaseConfig` useMemo | 257–262 |
| `handlePhaseChange` | 626–631 |
| JSX del bloque lab (phase + radar + DNA) | 1882–1957 |

Al pegar el JSX, extraer los handlers inline en `onSpatialBehaviorChange`, `onDnaChange`, `onSimMetaChange`, `onEnableDna` como `useCallback` nombrados **antes** del return.

---

### PASO 7 — Limpiar `index.tsx`

Operaciones sobre el Shell después de las migraciones:

1. **ELIMINAR** `showPhasePanel` state (línea 163) — `useState(false)`
2. **ELIMINAR** `phasePanelRef` ref (línea 180)
3. **ELIMINAR** `showPhasePanel` click-outside `useEffect` (líneas 1368–1382)
4. **REEMPLAZAR** `<header className="heph-header">` → `<header className="heph-global-bar">`
5. **EXTRAER** el tab switcher `<nav>` de dentro del `<header>` (líneas 1525–1563) hacia un elemento `<nav className="heph-tab-rail">` **hermano** del header.
6. **REEMPLAZAR** `<div className="heph-workspace">` → `<div className="heph-tier3">` con el renderizado condicional de `<ForgeTab />` / `<LabTab />`.
7. **ELIMINAR** los bloques `{activeTab === 'sculpt' && (<>...</>)}` y `{activeTab === 'lab' && (<>...</>)}` restantes (ya migrados en pasos 5 y 6).
8. **ELIMINAR** el conditional toolbar render (líneas 1960–1971) del Shell (ya está dentro de ForgeTab).

---

### PASO 8 — Actualizar imports

**Eliminar de `index.tsx`:**
- `CurveEditor`, `ParameterLane`, `PARAM_META`, `ALL_PARAM_IDS`, `PARAM_CATEGORIES`
- `HephaestusToolbar`
- `PhaseControls`
- `HephRadar`
- `DnaRail`, `DEFAULT_COGNITIVE_DNA`, `DEFAULT_SIMULATION_META`
- `useHephPreview`
- `useStageStore`, `selectFixtures`
- `getCategoryIcon`, `generateShapeInWindow`
- `createDummyClip`
- Tipos: `HephCurveMode`, `HephKeyframe`, `HephTrack` (si no los usa el Shell)

**Añadir a `index.tsx`:**
```typescript
import { ForgeTab } from './tabs/ForgeTab'
import { LabTab } from './tabs/LabTab'
```

**`ForgeTab.tsx` necesita** todos los imports que `index.tsx` usaba para su subárbol (ver listado completo en §2 del documento).

**`LabTab.tsx` necesita:**
```typescript
import { PhaseControls } from '../PhaseControls'
import { HephRadar } from '../HephRadar'
import { DnaRail, DEFAULT_COGNITIVE_DNA, DEFAULT_SIMULATION_META } from '../dna/DnaRail'
import { useHephPreview } from '../useHephPreview'
import { useStageStore, selectFixtures } from '../../../../stores/stageStore'
import type { CognitiveDNA, SimulationMeta, SpatialBehavior } from '../../../../core/arsenal/lfxTypes'
```

---

### PASO 9 — Verificación Final

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 40
```

Criterio de éxito: cero errores nuevos introducidos. Los errores pre-existentes en `TheiaTimeline.tsx` son irrelevantes para esta migración.

---

## Apéndice A — Tipo Compartido `TemporalActions`

Para evitar duplicación de la interfaz en Shell, ForgeTab y LabTab, extraer a:

**`src/components/views/HephaestusView/types/HephaestusShared.ts`**

```typescript
import type { HephAutomationClipV3 } from '../../../../core/hephaestus/types'

export interface HephViewport {
  startMs: number
  endMs: number
  minVal: number
  maxVal: number
}

export interface TemporalActions {
  snapshot: () => void
  undo: () => void
  redo: () => void
  resetWithClip: (clip: HephAutomationClipV3) => void
  setViewport: (vp: HephViewport) => void
}
```

Importar desde este archivo en `index.tsx`, `ForgeTab.tsx` y `LabTab.tsx`.

---

## Apéndice B — Garantía de Cero Pérdida de Estado

| Escenario | Garantía |
|---|---|
| Usuario alterna SCULPT → LAB | `useHephaestusEditorStore` (Zustand) permanece montado. `clip`, `activeTrackId`, `_undoStack`, `_redoStack`, `viewport` sobreviven íntegros. ForgeTab se desmonta pero el Store no. |
| Usuario alterna LAB → SCULPT | ForgeTab se remonta. Sus `useState` locales (`selectedKeyframeIdx`, `selectedIndices`, `playheadMs`) se reinician a sus valores iniciales — esto es **comportamiento correcto** ya que son estado de interacción UI, no datos del clip. |
| Usuario edita curva, cambia de tab, vuelve | La edición de curva se guardó en el Store vía `setClip` / `mutate`. Al volver a ForgeTab, `activeCurve` se recalcula desde el Store. Cero pérdida de datos de keyframes. |
| PlayheadMs se reinicia al volver a ForgeTab | Aceptable: `playheadMs` es posición de reproducción local, no canónica. Si se necesita persistir, mover `playheadMs` al Store o al Shell como prop. |
