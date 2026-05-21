# 🧬 WAVE 4811 — DNA DESIGNER · DESIGN STRATEGY REPORT

**Target**: NOTIFY_OPUS_PRO_TIER / INTERFACE_ARCHITECT  
**Author**: Cascade (Interface Architect)  
**Status**: PROPUESTA — pendiente de aprobación  
**Restricción de Oro**: Cero saturación. La belleza de Hephaestus no se negocia.

---

## 0. TL;DR

> **El DNA Designer NO es una pestaña, NO es un modal, NO es un panel nuevo.**  
> **Es el "tercer toggle del trifecta" en el header, que materializa un rail derecho a juego con el rail izquierdo de la librería — con un pre-flight de Safety Guards anclado al botón Save.**

Tres movimientos quirúrgicos:

1. **🧬 Header Toggle** (al lado de 📚 LIBRARY y 🛰 RADAR) → muestra/oculta el **DNA Rail** (240px, espejo derecho de la librería).
2. **🛡 Safety Strip pre-save** — micro-badges G1–G7 incrustados en el header, junto al botón SAVE. Estado visual permanente; expansión on-click.
3. **`spatialBehavior` vive dentro del Phase Engine HUD** (no en el rail). Es semánticamente espacial → pertenece al espacio kinético, no al genoma.

---

## 1. CONTEXTO DEL LAYOUT ACTUAL

Tras leer `HephaestusView/index.tsx` + `HephaestusView.css` el esqueleto es:

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER 56px [⚒ HEPHAESTUS] [name│dur│params│zones] [↩↪ 📂 NEW SAVE 📚 🛰] │
├─────────┬─────────┬───────────────────────────────────────┬─────────┤
│ LIBRARY │ PARAMS  │                                       │         │
│  220px  │  200px  │         CURVE EDITOR (SVG)            │         │
│ togglable│ fixed  │         flex: 1                       │         │
│          │ (+PHASE │                                       │         │
│          │ Engine │                                       │         │
│          │ float) │                                       │         │
│          │        ├───────────────────────────────────────┤         │
│          │        │  RADAR PREVIEW 260px  (togglable)     │         │
│          │        │                                       │         │
├──────────┴────────┴───────────────────────────────────────┴─────────┤
│ TOOLBAR 48px  [Interp │ Preset │ Mode]                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Hallazgos clave**:

| Recurso disponible | Estado | Apto para DNA |
|---|---|---|
| Header `heph-header__right` | Toggles existentes (📚/🛰) | ✅ Patrón establecido — añadir un tercero es invisible |
| Right edge del workspace | **VACÍO** (la librería vive a la izquierda) | ✅ Espejo natural |
| Param Sidebar | Saturado: lanes + ADD + Phase Engine | ❌ No tocar |
| Phase Engine HUD (flotante) | Ya gestiona `selector.phase` | ✅ Casa natural para `spatialBehavior` |
| Radar (bottom canvas, 260px) | Live preview kinético | ❌ No mutar — propósito ortogonal |
| Toolbar (bottom 48px) | Interpolación + presets | ❌ Densidad alta — no tocar |

---

## 2. ANÁLISIS DE LAS TRES OPCIONES PLANTEADAS

### 2.A · Overlay flotante al guardar
**Veredicto: NO como solución única, SÍ como guardrail final.**

- ❌ Esconde el DNA del flujo creativo. El usuario no ve el genoma mientras esculpe la curva.
- ❌ "Modal de salida" castiga: si quieres salvar, antes pasa por aquí. Antipatrón.
- ✅ Útil como **pre-flight de Safety Guards** (Sección 4) cuando el clip NO cumple G6/G7 — pero como salvavidas, no como editor.

### 2.B · Segundo estado del panel lateral izquierdo (`[PARAMS | DNA]` tabs)
**Veredicto: NO.**

- ❌ Param Sidebar es el órgano de trabajo principal — esconder los lanes para editar DNA rompe el contexto.
- ❌ Tabs verticales son una "pestaña 2" disfrazada. La directiva lo prohíbe explícitamente.
- ❌ Conflicto con el Phase Engine HUD anclado al sidebar.

### 2.C · Botón "Edit DNA" dentro de inspector
**Veredicto: NO existe inspector en Hephaestus.**

- En Hephaestus el "clip seleccionado" siempre es el clip actual del editor (singular). No hay multi-selección, no hay inspector. Esa pieza vive en **Chronos** (`ContextualDataSheet`), no aquí.
- ⚠️ Confusión peligrosa: el clip que se edita en Hephaestus es el clip ENTERO; el DNA es metadata del clip, no del keyframe seleccionado. "Edit DNA" en un inspector implicaría un sub-modo confuso.

---

## 3. PROPUESTA PRINCIPAL — *THE TRIFECTA + THE SHIELD*

### 3.1 · El Trifecta del Header

El header derecho ya alberga **dos toggles simétricos**: `📚` (library, left rail) y `🛰` (radar, bottom rail). Agregar un tercero — `🧬` (DNA, **right rail**) — completa una **tríada geométrica perfecta**:

```
HEADER ⟶  [📚 LIBRARY-LEFT]   [🛰 RADAR-BOTTOM]   [🧬 DNA-RIGHT]
                  ↓                    ↓                    ↓
              left rail            bottom rail         right rail
              220px                 260px               240px
```

**El usuario ya entiende este idioma**. No hay nada que aprender. La memoria muscular del toggle se transfiere 1:1.

### 3.2 · El DNA Rail (derecho, 240px, espejo de la librería)

```
┌─ DNA RAIL ─────────────────────────────┐
│ 🧬 COGNITIVE DNA                       │ ← header bar (mismo estilo que LIBRARY)
├────────────────────────────────────────┤
│                                        │
│   ┌──── GENOME (3D Cube glyph) ────┐   │
│   │      ◢ ◣                       │   │
│   │     ◢   ◣      AGGRESSION 0.70 │   │
│   │    ◢  ●  ◣     CHAOS      0.45 │   │  ← visualización compacta
│   │     ◣   ◢      ORGANICITY 0.25 │   │     del cubo unitario (A,C,O)
│   │      ◣ ◢                       │   │     con punto draggable
│   └────────────────────────────────┘   │
│                                        │
│   Texture       ◉ clean ○ dirty ○ univ │
│                                        │
├─ COMPATIBILITY ────────────────────────┤
│   Vibes        [techno×][industrial×]+ │  ← chip-based, idéntico al
│   Sections     [drop×][buildup×]    +  │     "ADD PARAM" popover
│   Energy zone  ambient ─────── peak    │     (reuso visual)
│   Aggression   0.25 ──────●─── 1.00    │
│                                        │
├─ SIMULATION ───────────────────────────┤
│   Beauty       [▓▓▓▓▓▓▓░░░] 0.75       │
│   GPU cost     [▓▓░░░░░░░░] 0.25       │
│   Fatigue      [▓▓▓░░░░░░░] 0.06       │
│   ☐ isStrobe   ☐ Divine  ☐ Heavy       │
│                                        │
├─ EXEC HINTS ───────────────────────────┤
│   Overlay      ◉ abs ○ rel ○ add       │
│   Intensity    ◉ prop ○ fix ○ energy   │
│   Targeting    [all ▼]                 │
└────────────────────────────────────────┘
```

**Características arquitectónicas**:

- **CSS**: reutiliza variables del `heph-library` (mismo orange ember palette, mismo borde, mismo scrollbar). **Zero CSS nuevo de base** — solo overrides puntuales.
- **Render condicional**: `{showDna && <DnaRail clip={clip} onUpdate={setClip} />}` insertado **después** de `heph-canvas-area` en el JSX, antes del cierre del workspace. Flex se redistribuye solo.
- **Componente**: `<DnaRail>` puro, ~250 LOC, consume y muta `clip.cognitiveDNA` + `clip.simulationMeta` + `clip.executionHints` (los bloques del `.lfx v2.1`).
- **Inmediatez**: los cambios entran al `useTemporalStore` → **undo/redo gratis** (Ctrl+Z también funciona sobre cambios de DNA).
- **Compatibilidad**: si `clip.cognitiveDNA == null` (clip v1.x), el rail muestra un CTA `[+ ENABLE DNA]` que inicializa con defaults conservadores. Cero ruptura.

### 3.3 · El Cubo Genoma — micro-visualización

El widget central del rail es un **wireframe isométrico de 120×120px** del cubo unitario `(A, C, O)`:

- 3 ejes etiquetados con sliders proporcionales debajo (no encima — el cubo es lectura, los sliders edición).
- El punto del clip se renderiza como esfera glow ember (`#ff6b2b`).
- Mientras arrastras un slider, el punto se desplaza en tiempo real.
- Click en una cara → rotación auto (3 vistas: Front=A/C, Side=C/O, Top=A/O).

Esto **NO es Three.js**. Es un SVG con proyección isométrica fija. ~40 LOC. Cero peso runtime.

### 3.4 · Mutual exclusivity opcional

Por defecto **los tres rails coexisten** (library + DNA + radar). En pantallas < 1280px, el toggle 🧬 activa un `mutex` que oculta `📚` automáticamente. Implementación: `useEffect` que escucha `window.innerWidth`. Suave, sin pelear con el usuario.

---

## 4. THE SHIELD — Safety Guards G1–G7 como Strip de Header

### 4.1 · Qué es

Una **banda horizontal de 7 micro-badges** incrustada en `heph-header__center`, **justo antes** del param-count. Cada badge corresponde a un gate:

```
HEADER CENTER:  [name] │ [duration] │ [params] │ 🛡 [G1][G2][G3][G4][G5][G6][G7] │ [zones] │ ...
                                                  ↑
                                            8×8px cada uno
                                            verde=pass, ámbar=warn, rojo=fail, gris=N/A
```

| Gate | Significado | Cuándo se evalúa |
|------|------------|------------------|
| G1 | Schema válido (`$schema === 'hephaestus/v2'`) | reactivo a cada edit |
| G2 | Checksum coherente | en save |
| G3 | DNA en rangos `[0,1]` | reactivo al rail |
| G4 | Al menos 1 vibe + 1 section compatibles | reactivo al rail |
| G5 | ≥1 curva con ≥2 keyframes | reactivo al editor |
| G6 | Strobo declarado consistente con `maxStrobeFreqHz` | reactivo |
| G7 | Pan/tilt range coherente con `spatialBehavior` | reactivo |

### 4.2 · Comportamiento

- **Estado permanente, visible siempre**. El usuario *sabe* en tiempo real si su clip es exportable.
- **Hover**: tooltip con la razón (`G6: strobe declarado pero curva 'intensity' no tiene pulsos > 5Hz`).
- **Click en cualquier badge**: abre un **mini-overlay flotante de 320px** (mismo estilo que `heph-phase-float`) con el detalle de los 7 gates, sugerencias de fix, y un botón `[AUTO-FIX]` para los gates auto-corregibles (G2 recomputado, G3 clamping, etc.).
- **Botón SAVE**: si hay rojos, el botón muestra un overlay rojo sutil + el click dispara primero el overlay del Shield. Si todo verde, save directo (comportamiento actual).

### 4.3 · Por qué aquí y no en el rail

Los gates **no son metadatos**, son **veredictos sobre el estado completo del clip** (curvas + DNA + safety). Vivir en el header los hace **omnipresentes** sin pertenecer a ninguna sección. Es la "barra de salud" del clip.

---

## 5. `spatialBehavior` — VIVE EN EL PHASE ENGINE

### 5.1 · Razón semántica

`spatialBehavior` decide si el clip habla en coordenadas **absolutas** del fixture o como **offset relativo** sobre el ancla IK. Eso es una **decisión espacial-kinética**, no genética.

El `Phase Engine HUD` ya gestiona `selector.phase` (spread, symmetry, wings, direction) — toda la **distribución espacial** del clip. Es la casa natural.

### 5.2 · Ubicación exacta

Dentro de `PhaseControls.tsx`, encima del slider de `spread`, una **sección nueva colapsable**:

```
┌─ SPATIAL BEHAVIOR ─────────────────────┐
│  ◉ Absolute      (clip controla DMX)    │
│  ○ Relative Offset (orbita sobre IK)    │
│  ○ Spatial 3D     (target xyz)          │
│  ○ Static         (sin distribución)    │
│                                        │
│  ⓘ Relative recommended para movers en │
│    showclips con anclas IK activas.    │
└────────────────────────────────────────┘
```

- **Default `'absolute'`** (backward compatible — clips v1 no tocados).
- Cuando se elige `relative_offset`, la curva de `pan`/`tilt` automáticamente se renormaliza en el editor a `[-1, +1]` (con grid centrado en 0). El cambio es **visual**, los keyframes mantienen su valor numérico crudo — la transformación `2v-1` ocurre en el adapter (ya implementado en WAVE 2483).
- Si G7 detecta inconsistencia, se enciende ámbar y propone auto-fix.

### 5.3 · Beneficio compositivo

Phase + spatialBehavior + zones cohabitan en un único HUD flotante. **Una sola fuente de verdad espacial** para todo el clip. Cero confusión.

---

## 6. ARQUITECTURA DE COMPONENTES (RESUMEN)

```
electron-app/src/components/views/HephaestusView/
├── index.tsx                  ← +1 toggle, +1 condicional render, +Shield strip
├── HephaestusView.css         ← +variables compartidas (sin duplicar)
├── dna/                       ⟵ NUEVA CARPETA, autocontenida
│   ├── DnaRail.tsx            ← contenedor (200 LOC)
│   ├── DnaRail.css            ← reusa tokens de --heph-library-*
│   ├── GenomeCube.tsx         ← SVG isométrico (50 LOC)
│   ├── SimulationPanel.tsx    ← sliders + checkboxes (60 LOC)
│   ├── CompatibilityPicker.tsx← chips reutilizando estilo "ADD PARAM" (70 LOC)
│   └── ExecHintsPanel.tsx     ← radios + dropdown (40 LOC)
├── safety/
│   ├── SafetyStrip.tsx        ← 7 badges en header (80 LOC)
│   ├── SafetyDetailHud.tsx    ← overlay 320px (100 LOC)
│   ├── SafetyStrip.css        ← reusa estilos de heph-phase-float
│   └── gateEvaluators.ts      ← funciones puras G1..G7 (150 LOC)
└── PhaseControls.tsx          ← +SpatialBehaviorSection (40 LOC nuevas)
```

**Total**: ~790 LOC en componentes aislados + ~80 LOC tocadas en `index.tsx`. Ninguna mutación a `CurveEditor`, `ParameterLane`, `HephRadar`, `HephaestusToolbar`.

---

## 7. INTEGRACIÓN CON EL BACKEND (WAVE 2483)

Todo el rail escribe sobre la estructura `.lfx v2.1` ya tipada en `src/core/arsenal/lfxTypes.ts`:

- `clip.cognitiveDNA` ← rail principal
- `clip.simulationMeta` ← bloque simulation del rail
- `clip.executionHints` ← bloque exec del rail
- `clip.executionHints.spatialBehavior` ← Phase HUD
- `clip.safetyDeclaration` ← derivado/auto-rellenado por gateEvaluators

Cuando se hace SAVE:
1. `gateEvaluators.evaluateAll(clip)` → matriz de 7 booleanos.
2. Si todos pasan → `serializeHephClip()` + checksum + persist.
3. Si hay rojos → abre `SafetyDetailHud` con CTA `[Save anyway]` o `[Auto-fix and save]`.

Esto cierra el loop con la Fase 1 (autoría de `.lfx`) sin tocar el LfxFileLoader ni el registry.

---

## 8. ANIMACIÓN Y MICROINTERACCIÓN

- **Toggle 🧬**: mismo `transition: all 0.15s ease` de los otros toggles. Slide-in del rail desde la derecha (transform translateX + opacity, 200ms).
- **Cube genoma**: el punto draggable tiene un `box-shadow` glow que pulsa sutilmente cuando G3 está rojo.
- **Safety badges**: transición de color en 120ms al cambiar de estado. Cero flicker.
- **Save button**: tinte rojo de 12% opacity cuando hay G fail. Sin border, sin shake. Discreto.

---

## 9. ALTERNATIVAS EVALUADAS Y DESCARTADAS

| Alternativa | Por qué NO |
|---|---|
| Bottom strip de 80px con DNA horizontal | El espacio vertical bajo el editor está reservado a radar/toolbar; un tercer strip rompe la pirámide visual |
| Modal full-screen tipo NewClipModal | Saca al usuario del flujo. Modal = ruptura |
| Sub-tabs `[PARAMS \| DNA \| SAFETY]` en sidebar | Es la "Pestaña 2" prohibida por la directiva |
| Toolbar enriquecida con DNA inputs | Toolbar ya está saturada y es bottom-priority visual |
| DNA en NewClipModal solamente | Excluye la edición post-creación. Inaceptable |
| Floating draggable HUD estilo Photoshop | Carga cognitiva alta. Hephaestus no es Photoshop |

---

## 10. CONCLUSIÓN

> El DNA Designer **no debe ser un panel nuevo**. Debe ser **el tercer toggle del trifecta del header**, materializando un **rail derecho** simétrico al de la librería, con un **Safety Shield strip** permanente junto al botón Save, y con `spatialBehavior` viviendo donde semánticamente pertenece — el **Phase Engine HUD**.

**Tres movimientos. Cero pestañas. Cero modales editores. Cero saturación.**  
La armonía orange-ember de Hephaestus permanece intacta. La memoria muscular del usuario se extiende sin reaprender. Y el `.lfx v2.1` queda completamente autoreable desde la UI.

Tu llamada.

---

*Reporte preparado por Cascade. La arquitectura es un instrumento, no un obstáculo. Cada pixel sirve a la música.*
