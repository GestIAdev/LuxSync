# TOPOGRAFÍA UI HEPHAESTUS

> **Misión:** Radiografía estructural de `HephaestusView` (React/TSX) para planificar el rediseño en pestañas [SCULPT/CURVES] + [MATRIX/LABORATORY].
> **Regla:** Solo lectura. Cero refactorización. Esta nota es la cartografía del DOM actual.

---

## 1. Árbol de Componentes Principal (`index.tsx`)

`@/electron-app/src/components/views/HephaestusView/index.tsx:1432-1946`

```jsx
<div className="heph-view">                  // Contenedor raíz (columna)
  <header className="heph-header">           // HEADER (56px)
    <div className="heph-header__left">
      <HephLogoIcon />
      <h1>HEPHAESTUS</h1>
      <span>STUDIO</span>
    </div>
    <div className="heph-header__center">
      <input />                // Editable clip name
      <span>│</span>
      <span>                // Editable duration
        <input />s
      </span>
      <span>│</span>
      <span>{paramCount} PARAMS</span>
      <ZoneSelector />         // Selector de zonas
      <span>│</span>
      <SafetyStrip />          // G1-G7 badges
      <span>│</span>
      <span>save message</span> // (condicional)
    </div>
    <div className="heph-header__right">
      <button>Undo</button>
      <button>Redo</button>
      <button>Load Show</button>
      <button>New</button>
      <button>Save</button>
      <button>Save As</button>
      <button>Toggle Library</button>
      <button>Toggle Radar</button>
      <button>Toggle DNA</button>
    </div>
  </header>

  <div className="heph-workspace">             // MAIN WORKSPACE (fila)
    {showLibrary && (
      <div className="heph-library">         // Library Panel (220px fijo)
        <div className="heph-library__header">...</div>
        <div className="heph-library__search">
          <input placeholder="Search clips..." />
          <button>✕</button>
        </div>
        <div className="heph-library__list">
          <div className="heph-library__category">
            <div className="heph-library__category-header">...</div>
            <div className="heph-library__category-items">
              <div className="heph-library__item">...</div>
            </div>
          </div>
        </div>
      </div>
    )}

    <div className="heph-param-sidebar">     // Sidebar parámetros (200px fijo)
      <div className="heph-param-sidebar__header">...</div>
      <div className="heph-param-sidebar__lanes">
        <ParameterLane />                    // Renderizado por cada paramId
        <ParameterLane />
        <ParameterLane />
        ...
      </div>
      <div className="heph-add-param">       // Botón +ADD + popover
        <button>+ ADD</button>
        <div className="heph-add-param__popover">...</div>
      </div>
      <div className="heph-phase-trigger">   // Botón + Floating Phase
        <button>PHASE ENGINE</button>
        <div className="heph-phase-float">
          <PhaseControls />                  // Modal/Pané de Distribución de Fase
        </div>
      </div>
    </div>

    <div className="heph-canvas-area">       // Área principal (flex:1)
      <div className="heph-canvas-area__editor">
        <CurveEditor />                      // Canvas SVG de curvas
      </div>
      {showRadar && (
        <div className="heph-canvas-area__radar">
          <div className="heph-canvas-area__radar-header">
            <span>RADAR PREVIEW</span>
            <button>✕</button>
          </div>
          <div className="heph-canvas-area__radar-content">
            <HephRadar />                      // Radar / Preview espacial
          </div>
        </div>
      )}
    </div>

    {showDna && (
      <DnaRail />                              // Rail derecho ADN Cognitivo
    )}
  </div>

  <HephaestusToolbar />                        // Barra inferior: Interpolación + Presets + Mode

  <NewClipModal />                             // Modal portal (document.body)
</div>
```

---

## 2. Ubicación de Piezas Clave

### Modal de Distribución de Fase (Phase Engine)

- **Archivo del componente:** `@/electron-app/src/components/views/HephaestusView/PhaseControls.tsx`
- **Renderizado en:** `@/electron-app/src/components/views/HephaestusView/index.tsx:1796-1832`
- **Contenedor DOM:** `div.heph-phase-trigger` → `div.heph-phase-float` (condicional `showPhasePanel`)
- **Notas:**
  - Es un **floating HUD** anclado en el `heph-param-sidebar`, no un modal centrado.
  - Recibe `activePhaseConfig` y `handlePhaseChange` derivados del track activo.
  - Incluye controles de `spreadDeg`, `symmetry`, `wings`, `blocks`, `shuffle`, `shuffleSeed`, `direction` y `spatialBehavior`.

### Radar / Preview Espacial

- **Archivo del componente:** `@/electron-app/src/components/views/HephaestusView/HephRadar.tsx`
- **Renderizado en:** `@/electron-app/src/components/views/HephaestusView/index.tsx:1874-1897`
- **Contenedor DOM:** `div.heph-canvas-area__radar` (condicional `showRadar`)
- **Notas:**
  - Canvas 2D con visualización de fixtures, posición pan/tilt, color, dimmer y strobe gate.
  - Barra de transporte (play/pause/stop) y progress bar integrados.

### Barra de Presets de Interpolación / Curvas

- **Archivo del componente:** `@/electron-app/src/components/views/HephaestusView/HephaestusToolbar.tsx`
- **Renderizado en:** `@/electron-app/src/components/views/HephaestusView/index.tsx:1928-1937`
- **Contenedor DOM:** `div.heph-toolbar` (hermano de `heph-workspace`, al pie)
- **Notas:**
  - Botones de interpolación: `HOLD`, `LINEAR`, `BEZIER`.
  - Dropdown de presets Bezier (`BEZIER_PRESETS`).
  - Dropdown de templates de curvas (`CURVE_TEMPLATES` con categorías).
  - Botones de modo: `ABS`, `REL`, `ADD`.
  - Readout de keyframe seleccionado.

### Panel del ADN Cognitivo (el del cubo 3D)

- **Archivo del componente principal:** `@/electron-app/src/components/views/HephaestusView/dna/DnaRail.tsx`
- **Subcomponente del cubo 3D:** `GenomeCube` (definido dentro de `DnaRail.tsx:137-184`)
- **Renderizado en:** `@/electron-app/src/components/views/HephaestusView/index.tsx:1900-1925`
- **Contenedor DOM:** `<aside className="dna-rail">` (condicional `showDna`)
- **Notas:**
  - Rail lateral derecho de 260px.
  - Secciones: Archetype Loadout, Genome Chamber (cubo 3D), ACO Sliders, Energy Thermometer, Vibe Compatibility, Gatekeeper Linter.
  - Si `dna` no existe, muestra CTA `+ ENABLE DNA`.

---

## 3. Gestión de Layout

### Estrategia: Flexbox puro + anchos fijos laterales

- **Sin librerías de paneles colapsables:** No se detecta `Allotment`, `react-resizable-panels`, `Resizable` ni `SplitPane` en el directorio.
- **Técnica:** CSS Flexbox con `width` / `min-width` fijos para los paneles laterales y `flex: 1` para el área central.

### Distribución estructural (CSS)

| Elemento | Clase | Layout | Ancho / Altura |
|---|---|---|---|
| Raíz | `.heph-view` | `display: flex; flex-direction: column` | 100% × 100% |
| Header | `.heph-header` | `display: flex; justify-content: space-between` | 56px altura fija |
| Workspace | `.heph-workspace` | `display: flex; flex: 1; overflow: hidden` | Resto vertical |
| Library | `.heph-library` | `display: flex; flex-direction: column` | 220px fijo |
| Param Sidebar | `.heph-param-sidebar` | `display: flex; flex-direction: column` | 200px fijo |
| Canvas Area | `.heph-canvas-area` | `display: flex; flex-direction: column; flex: 1` | Ocupa resto |
| Curve Editor | `.heph-canvas-area__editor` | `flex: 1` | Resto del canvas area |
| Radar | `.heph-canvas-area__radar` | `flex-shrink: 0` | 260px alto, min 180px, max 320px |
| DNA Rail | `.dna-rail` | panel lateral derecho | 260px fijo (por CSS de DnaRail.css) |
| Toolbar | `.heph-toolbar` | `display: flex; align-items: center` | 48px altura fija |

### Canvas Area interna

`.heph-canvas-area` es una columna flex:
- El editor ocupa todo el espacio disponible (`flex: 1`).
- El radar aparece **debajo** del editor como panel de altura fija cuando `showRadar` es `true`.

### Overlay modales

- `NewClipModal` renderiza via `createPortal` directo en `document.body`, por fuera del árbol de `HephaestusView`.
- El detalle de `SafetyStrip` (`heph-safety__detail`) es un overlay absoluto dentro del header.
- El panel de fase (`heph-phase-float`) es un popover absoluto dentro del param sidebar.

---

## 4. Mapa de Subcomponentes Directos

| Componente | Archivo | Función principal | Renderizado en (padre) |
|---|---|---|---|
| `HephaestusView` | `index.tsx` | Vista raíz, layout, estado, handlers | `AppRouter` (externo) |
| `CurveEditor` | `CurveEditor.tsx` | Canvas SVG de keyframes/curvas | `index.tsx` |
| `ParameterLane` | `ParameterLane.tsx` | Mini-lane de parámetro con sparkline | `index.tsx` (mapeado) |
| `MiniCurvePreview` | `ParameterLane.tsx:82-124` | SVG miniatura de la curva | `ParameterLane` |
| `HephaestusToolbar` | `HephaestusToolbar.tsx` | Barra interpolación/presets/modo | `index.tsx` |
| `PhaseControls` | `PhaseControls.tsx` | Panel distribución de fase | `index.tsx` (dentro de `heph-phase-float`) |
| `HephRadar` | `HephRadar.tsx` | Radar 2D preview de fixtures | `index.tsx` (dentro de `heph-canvas-area__radar`) |
| `DnaRail` | `dna/DnaRail.tsx` | Rail ADN cognitivo | `index.tsx` |
| `GenomeCube` | `dna/DnaRail.tsx:137-184` | Cubo 3D CSS del genoma | `DnaRail` |
| `LinterCard` | `dna/DnaRail.tsx:605-637` | Tarjeta de advertencia del linter | `DnaRail` |
| `SafetyStrip` | `safety/SafetyStrip.tsx` | Badges de seguridad G1-G7 | `index.tsx` (header) |
| `NewClipModal` | `NewClipModal.tsx` | Modal crear clip (portal body) | `index.tsx` (portal) |
| `SmartZoneSelector` | `SmartZoneSelector.tsx` | Selector de zonas dentro del modal | `NewClipModal` |
| `ZoneSelector` | `ZoneSelector.tsx` | Selector de zonas del header | `index.tsx` (header) |
| `KeyframeContextMenu` | `KeyframeContextMenu.tsx` | Menú contextual de keyframes | `CurveEditor` |
| `useHephPreview` | `useHephPreview.ts` | Hook preview (no JSX, es estado) | Consumido por `HephRadar` e `index.tsx` |

---

## 5. Observaciones para el Rediseño en Pestañas

- **SCULPT/CURVES** puede absorber: `heph-workspace` (library + param sidebar + canvas area + toolbar) y la floating phase panel.
- **MATRIX/LABORATORY** puede absorber: `HephRadar` (preview), `DnaRail` (cubo 3D + ADN), `SafetyStrip` y `ZoneSelector`.
- **Transición cero-fricción:** todo el árbol es plano y basado en Flexbox; mover secciones entre pestañas es principalmente reorganizar el JSX de `index.tsx` sin romper componentes internos.
- **Puntos de anclaje clave:**
  - `HephaestusToolbar` es un hermano de `heph-workspace`, lo que la hace "global" a la vista. Si [SCULPT/CURVES] pierde su toolbar, conviene convertirla en propiedad de la pestaña.
  - `DnaRail` es un panel condicional lateral; en MATRIX puede ser el panel principal en vez de un rail opcional.
  - `PhaseControls` es un floating HUD dentro del param sidebar; si SCULPT/CURVES se despliega en el nuevo layout, este panel debe re-anclarse o convertirse en panel fijo.

---

*Fin del mapa topográfico. No se realizó refactorización.*
