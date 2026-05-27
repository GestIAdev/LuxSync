# WAVE 4920 — THEIA ATOMIC PARADIGM

> **MACRO-DIRECTIVA · Blueprint puro · 0 código**
> **Fecha:** 2026-05-27 · **Tier:** OPUS / UX-EXPERT + SYSTEM-ARCHITECT
> **Estado:** WAVE 4910 (multi-cuepoint) queda DEPRECATED en la capa UX y datos. El backend cognitivo (4900-4903) se conserva pero se aplana.
> **Doctrina:** *Un archivo, una intención, un átomo. Los packs son frases; los átomos son palabras.*

---

## 0. RESUMEN EJECUTIVO

Theia pivota a un paradigma atómico inspirado en samplers (Ableton clips, NI Maschine pads, Resolume decks). Cada `.theia` es **un loop visual** con **un genoma cognitivo**. Los atoms se agrupan en carpetas-`Pack`. El operador trabaja en dos modos hard-split:

- **LIVE** — performance en tiempo real. Selene dispara átomos, operador puede forzar.
- **WORKSHOP** — taller offline. Drop de `.mp4` crudos → trim IN/OUT → tunear ADN → export.

Adiós a los timelines + cuepoints + FSMs por cue. Llega un modelo plano: **átomos pequeños, packs grandes, decisión por matching cognitivo**.

---

## 1. NOMENCLATURA Y DICCIONARIO OFICIAL

> Esta tabla es fuente única de verdad. Cualquier término ajeno está prohibido en código, UI strings y docs.

### 1.1 Glosario canónico

| Término | Definición | Sinónimos prohibidos |
|---------|------------|----------------------|
| **Atom** (`.theia`) | Unidad indivisible: un único loop visual + un único genoma cognitivo. Sin cuepoints. | "cue", "cuepoint", "clip", "asset" |
| **Pack** | Carpeta del filesystem que agrupa atoms temáticamente. Su identidad ES el nombre del folder. | "deck-set", "library", "collection" |
| **Genome** | Vector `{aggression, chaos, organicity, energyZone, validSections, textureAffinity}` en la raíz del atom. Selene matchea contra el `MusicalContext`. | "DNA" (genérico ok) |
| **Trim** | Recorte temporal `{startMs, endMs}` del `.mp4` subyacente. Define qué fragmento ES el loop. | "cuepoint", "range" |
| **LIVE** | Modo de performance en tiempo real. | "PERFORM" (legacy) |
| **WORKSHOP** | Modo de edición offline. | "AUTHOR", "EDIT" (legacy) |
| **Deck** | Carril inferior horizontal. Memoria visible del operador. | "rail", "tray" |
| **Pack Slot** | Posición en el deck. Contiene un pack desplegable. 4-8 slots. | "channel", "track" |
| **Output Surface** | Destino físico de luz: ventana proyector, totem, OSC, DMX, NDI. | "screen", "destination" |
| **Output Selector** | Componente UI del header que enruta a Output Surfaces. | — |
| **Force-Trigger** | Acción manual que dispara un atom saltándose a Selene. | "force-drop" (legacy parcial) |
| **Atom Match** | Decisión de Selene: atom con menor distancia genómica al contexto. | "cue-jump" (legacy) |
| **Atom Tile** | Card visual cuadrada del atom: thumbnail + nombre + microcube. | "card" |
| **Genome Cube** | Miniviz 3D del vector `(A, C, O)` en cubo unitario. | "DNA viz" |

### 1.2 Identidades canónicas

```
Pack ID:  <pack-name>                       e.g.  "Tiburon_cyberpunk"
Atom ID:  <pack-name>/<atom-name>           e.g.  "Tiburon_cyberpunk/peak_jaws"
Path:     <packs-root>/<pack>/<atom>.theia + .mp4
```

El **Atom ID** es relativo al pack — un atom no existe sin su pack. **El sistema de archivos ES la base de datos.**

### 1.3 Terminología deprecada

❌ `cuePoint`, `cuepoints[]`, `CueJumpIntent` (legacy en backend, NUNCA en UX strings)
❌ `PERFORM/AUTHOR` toggle → `LIVE/WORKSHOP`
❌ "timeline scrubbing" — solo trim IN/OUT en WORKSHOP
❌ "asset" para el archivo individual — usar **atom**

---

## 2. MODELO DE DATOS

### 2.1 Filosofía

- **Aplanado**: el genoma vive en la raíz del atom, no anidado.
- **Determinístico**: el genoma es inmutable durante LIVE. Editar = volver a WORKSHOP y re-exportar.
- **Auto-contenido**: un `.theia` se lee sin referencias externas.
- **Filesystem = DB**: pack es directorio, atom es par `(meta.theia, video.mp4)`. Sin DB, sin SQLite.

### 2.2 Interface `ITheiaAtom` (reemplaza ITheiaAsset)

```typescript
export interface ITheiaAtom {
  schemaVersion: 2
  id: string                    // slug local dentro del pack
  packId: string                // folder name
  displayName: string
  tags: string[]

  videoFile: string             // ruta relativa al .mp4 hermano

  // RECORTE BÁSICO IN/OUT
  trim: {
    startMs: number
    endMs: number               // > startMs + 250
  }

  // GENOMA AL ROOT (antes vivía dentro de cuePoint)
  genome: {
    aggression: number          // 0..1
    chaos: number               // 0..1
    organicity: number          // 0..1
    energyZone: { min: EnergyZone; max: EnergyZone }
    validSections: SectionTag[]
    textureAffinity: 'clean' | 'dirty' | 'universal'
    compatibleVibes: string[]
  }

  flags: {
    isDefault: boolean          // default del pack (mutex en el pack)
    isDivineCandidate: boolean
    isHeavyCandidate: boolean
  }

  meta: {
    durationMs: number          // del .mp4 completo
    fps: number
    resolution: { w: number; h: number }
    videoHash: string | null
    exportedAt: string
    author: string | null
  }
}
```

### 2.3 Interface `ITheiaPack`

```typescript
export interface ITheiaPack {
  id: string                            // folder name
  rootPath: string                      // absolute
  atoms: ITheiaAtom[]                   // ordered
  manifest: ITheiaPackManifest | null   // pack.theiapack.json (opcional)
  scannedAt: number
}

export interface ITheiaPackManifest {
  schemaVersion: 1
  displayName: string
  description: string
  author: string | null
  atomOrder: string[]                   // override del orden
  defaultAtomId: string | null
  tags: string[]
  accentColor: string                   // hex
}
```

### 2.4 Validation gates

| Gate | Regla | Acción si falla |
|------|-------|-----------------|
| A1 | `id`, `packId`, `videoFile` no vacíos | Reject |
| A2 | `trim.endMs > trim.startMs + 250` | Reject |
| A3 | `trim.endMs ≤ meta.durationMs` | Warn + clamp |
| A4 | `genome.aggression/chaos/organicity ∈ [0,1]` | Reject |
| A5 | `energyZone.min ≤ energyZone.max` | Reject |
| A6 | `validSections` no vacío | Reject |
| A7 | `videoFile` existe en disco | Marcar atom como `degraded` |
| A8 | ≤1 atom con `isDefault=true` por pack | Last-write-wins + warn |
| P1 | Pack tiene ≥1 atom válido | Marcar pack `empty` (no error) |
| P2 | Pack tiene 1 atom con `isDefault=true` | Warn. Sin default, Selene usa `argmin(distance)` |

### 2.5 Migración v1 → v2

`migrateV1ToV2.ts` one-shot: por cada cuepoint v1, genera un atom v2 recortando el `.mp4` original en `[startMs, endMs]`. Los packs heredan el nombre del `.theia` v1. Backup automático del v1 antes de migrar. Reporte HTML con mapping cuepoint→atom.

---

## 3. REDISEÑO DEL LAYOUT (UI/UX)

### 3.1 Principios

| Principio | Aplicación |
|-----------|------------|
| **Una decisión por zona** | Header = nav + output. Sidebar = control/edit. Deck = selección. Viewport = monitor. Cero solapamiento. |
| **OUTPUT primero** | Output Selector es el segundo elemento más prominente del header (tras el logo). |
| **Cero faders en el centro** | Los faders manuales suben al sidebar. Header limpio. |
| **Deck = memoria del operador** | Carril inferior persistente y denso: lo que se puede disparar. |
| **Mode-aware contenido, no estructura** | La grilla del layout NO se mueve entre modos. Solo cambia el contenido de cada zona. |
| **Cyberpunk con disciplina** | Cyan en LIVE, magenta en WORKSHOP. Glassmorphism `blur(12px)`. Scanlines solo en viewport. |

### 3.2 Wireframe LIVE

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [▣]  [ LIVE ◐ WORKSHOP ]    OUTPUT: [▼Stage Wall] [+Totem] [+OSC]  60px    │
├────────────────────────────────────────────────────────────┬───────────────┤
│                                                            │  INSPECTOR    │
│              ╭──────────────────────────────╮              │  (LIVE)       │
│              │      MAIN VIEWPORT           │              │               │
│              │   (canvas real del worker)   │              │  ◉ NOW PLAYING│
│              │   scanlines · brackets       │              │  Tiburon/jaws │
│              │   01:24 · 25fps · LIVE ●     │              │  [Cube] A C O │
│              ╰──────────────────────────────╯              │               │
│  ┌───────────────────────────────────────────────────────┐ │  ── MANUAL ── │
│  │  DECK · Pack Slots                                    │ │  Brightness   │
│  │  ┌────────┬────────┬────────┬───────────┐             │ │  Speed        │
│  │  │▤Tiburon│CityNigh│GlassRm │ + slot    │             │ │  Blackout [○] │
│  │  │● 12 at │○  6 at │○  9 at │           │             │ │               │
│  │  └────────┴────────┴────────┴───────────┘             │ │  ── FORCE ─── │
│  │  ┌─[expanded: Tiburon_cyberpunk] ──────────────────┐  │ │  [DROP]       │
│  │  │ [tile] [tile] [tile] [tile] [tile] [tile]      │  │ │  [AMBIENT]    │
│  │  │ ★ ⚡    🌿    ● play  ⚡heavy                    │  │ │  [BUILDUP]    │
│  │  └─────────────────────────────────────────────────┘  │ │  [PEAK]       │
│  └───────────────────────────────────────────────────────┘ │               │
│                                                            │  ── SELENE ── │
│                                                            │  AI [●ON]     │
│                                                            │  conf 0.84    │
└────────────────────────────────────────────────────────────┴───────────────┘
```

### 3.3 Wireframe WORKSHOP

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [▣]  [ LIVE ◐ WORKSHOP ]    OUTPUT: [preview-only · disabled]              │
│                ↑magenta accent                                             │
├────────────────────────────────────────────────────────────┬───────────────┤
│              ╭──────────────────────────────╮              │  DNA LAB      │
│              │   MAIN VIEWPORT              │              │  Editing jaws │
│              │   (raw .mp4 preview)         │              │               │
│              │   00:08 / 01:14              │              │  ▰▰▱  A 0.62  │
│              ╰──────────────────────────────╯              │  ▰▱▱  C 0.34  │
│  ┌───────────────────────────────────────────────────────┐ │  ▰▰▰  O 0.91  │
│  │  TRIM TIMELINE                                        │ │  [CubeViz]    │
│  │  ░░░░░ [████████████████] ░░░░░░░░░░░░░░░░░░░░░░░    │ │               │
│  │       ▲IN  08.120        ▲OUT 16.480                 │ │  EnergyZone   │
│  │  [Reset full] [Snap 1s] [Snap 250ms]                 │ │  [active→peak]│
│  └───────────────────────────────────────────────────────┘ │               │
│  ┌───────────────────────────────────────────────────────┐ │  ValidSections│
│  │  WORKSHOP DECK · raw inputs queue                     │ │  ☑drop ☑peak  │
│  │  ┌────────┬────────┬────────┬─────────────────┐       │ │  ☑buildup     │
│  │  │jaws.mp4│city.mp4│neon.mp4│ + DROP MORE     │       │ │               │
│  │  │●editing│ queued │ queued │                 │       │ │  Texture clean│
│  │  └────────┴────────┴────────┴─────────────────┘       │ │  Flags ☑ deflt│
│  │  Pack target: [Tiburon_cyberpunk ▼]  [EXPORT ATOM]    │ │  [SIMULATE]   │
│  └───────────────────────────────────────────────────────┘ │  [💾 EXPORT]  │
└────────────────────────────────────────────────────────────┴───────────────┘
```

### 3.4 Anatomía del Header (60px)

```
[▣ THEIA]   [ LIVE ◐ WORKSHOP ]    OUTPUT: [▼Stage Wall] [+Totem3] [+OSC]
↑logo 40px  ↑mode toggle huge       ↑output selector prominente, derecha
```

**Reglas duras del header:**
- Logo izquierda. Mode toggle centro-izquierda (180×40px, pulsante, accent dinámico).
- Output Selector centro-derecha (prominente, expandible).
- **NO faders. NO bpm. NO section monitor. NO blackout** — todo eso vive en el sidebar.

#### 3.4.1 Output Selector — detalle

```
[▼Stage Wall ●live]  [+Totem3 ●]  [+OSC]  [+NDI]  [⚙]

Al expandir:
┌──────────────────────────────────────────────────┐
│  ☑ Stage Wall          HDMI-1, 1920×1080         │
│  ☑ Totem-3             DMX U7, 256×512           │
│  ☐ Stadium-Side        OSC 192.168.1.50          │
│  ☐ Preview-NDI         NDI: theia-out            │
│  ────────                                        │
│  Latency offset: ▱▰▱▱▱  +12ms                    │
│  Test pattern: [SMPTE bars]                      │
│  [Save preset...] [Load preset...]               │
└──────────────────────────────────────────────────┘
```

Cada surface tiene toggle individual + offset de latencia. El operador siempre sabe a dónde va la luz.

### 3.5 Anatomía del Inspector (sidebar 340px, mode-aware)

**Estructura idéntica entre modos; cambia el contenido.**

#### 3.5.1 Inspector LIVE

- **Now Playing** — atom activo, microcube del genome, displayName, energyZone range. Fade 200ms al cambio.
- **Manual Controls** — Brightness fader, Speed fader, Blackout toggle. Todos con `data-midi-bind`.
- **Force Triggers** — botones grandes (60×60) `[DROP][AMBIENT][BUILDUP][PEAK]`. Disparan el primer atom del pack activo con esa sección + heavy/divine si aplica. Override de Selene durante 5s.
- **Selene Brain** — colapsable: AI ON/OFF, confidence, last-match latency, indicador "manual override active 4s left".
- **Diagnostics** — colapsable: fps, frame drops, worker state, circuit state.

#### 3.5.2 Inspector WORKSHOP (DNA Lab)

- **Genome Knobs** — A/C/O sliders verticales 0..1 step 0.01. Doble-click = reset 0.5.
- **GenomeCubeViz** — punto cyan del draft + puntos fantasma magenta de otros atoms del pack target. Si solapan → destello "diversity warning".
- **EnergyZone** — pickers min/max encadenados (silence→peak). Validación `min ≤ max`.
- **ValidSections** — chips toggle: `intro·verse·buildup·drop·peak·breakdown·outro`.
- **Texture** — radio `clean/dirty/universal`.
- **CompatibleVibes** — chip-input con autocomplete.
- **Flags** — `default in pack` (mutex), `divine`, `heavy`.
- **Pack Target** — selector + `[+ NEW PACK...]`.
- **Actions** — `[SIMULATE]` (corre matcher contra 200 mocks), `[💾 EXPORT ATOM]`.

### 3.6 Anatomía del Deck (carril inferior)

#### 3.6.1 Deck LIVE — Pack Slots

- **4-8 slots horizontales** (configurable). Cada slot = container glassmorphism.
- Slot muestra: pack name, atom count, accent color, indicador `●live`.
- **Click slot inactivo** → activa pack (Selene cambia pool de matching).
- **Solo un pack `●live` a la vez** en V1. Pack-crossfade en futuro.
- **Expand `▼`** → grilla horizontal scrolleable de Atom Tiles abajo del slot.

##### Atom Tile

```
┌─────────────────┐
│ ▤[thumb]        │  ← primer frame del trim
│                 │
│ peak_jaws       │
│ [Cube 32×32]    │
│ ⚡ heavy · ★    │  ← badges
└─────────────────┘
```

- **Click** → force-trigger inmediato (Selene override 5s)
- **Doble-click** → preview en viewport SIN enviar a OUTPUT
- **Click derecho** → context menu: `Edit in Workshop · Disable · Show in folder`
- **Drag** → reordenar (actualiza `atomOrder` del manifest)
- **Atom playing** → halo cyan animado

#### 3.6.2 Deck WORKSHOP — Trim Timeline + Raw Inputs Queue

**Zona superior — TrimTimeline:**
```
┌──────────────────────────────────────────────┐
│ ░░░░░ [████████████████] ░░░░░░░░░░░░░░░░░  │
│       ▲IN              ▲OUT                  │
│       08:120          16:480                 │
│ [reset full] [snap-frame] [snap-250ms] [1s]  │
└──────────────────────────────────────────────┘
```
Una pista, dos tiradores (IN/OUT). Playhead libre. Space=play. ←/→=±1f. I/O=set IN/OUT al playhead. Snap modes toggle. **El loop se previsualiza en bucle infinito automáticamente entre los tiradores.**

**Zona inferior — RawInputsQueue:** cards de los `.mp4` dropeados esta sesión. Estados: `editing · queued · exported ✓`. Última card = `+ DROP MORE`.

### 3.7 Z-index oficial

```
  0 background  · 10 viewport canvas · 20 viewport overlays
 30 deck/tiles  · 40 sidebar         · 50 header
 60 output dropdown · 70 context menus · 80 toasts
 90 modals     · 100 MIDI-learn overlay
```

### 3.8 Paleta

| Token | Valor | Uso |
|-------|-------|-----|
| `--theia-bg` | `#080b14` | Fondo base |
| `--theia-panel` | `rgba(15,22,38,0.72)` + blur 12px | Sidebar, deck, header |
| `--theia-live` | `#06b6d4` cyan | Modo LIVE, atom playing, AI ON |
| `--theia-workshop` | `#a855f7` magenta | Modo WORKSHOP, draft, diversity warn |
| `--theia-ok` | `#22c55e` | exported, default badge |
| `--theia-warn` | `#f59e0b` | low confidence |
| `--theia-danger` | `#ef4444` | validation hard, degraded atoms |

**Regla de oro:** nunca mezclar cyan y magenta en el mismo panel. El mode toggle es el único sitio donde coexisten.

---

## 4. WORKFLOWS

### 4.1 Workflow A — WORKSHOP: crear un Pack

```
STEP 0  Toggle WORKSHOP → sidebar = DNA Lab, deck = Raw Inputs Queue.
        OUTPUT selector deshabilitado (preview-only).

STEP 1  Drop 1+ .mp4 al viewport o deck. Cada uno aparece como card en
        Raw Inputs. El primero se carga en viewport. Trim inicial = clip
        completo.

STEP 2  TRIM. Space = play. Drag tirador IN al inicio del loop bueno.
        Drag tirador OUT al final. Atajos I/O = set al playhead.
        Snap a 250ms para beat-align. Loop preview infinito entre tiradores.

STEP 3  TUNE GENOME en DNA Lab. Knobs A/C/O. EnergyZone min/max.
        ValidSections chips. Texture. Tags libres. Flags (default/divine/heavy).
        GenomeCube muestra puntos fantasma de otros atoms del pack target
        → diversity warning si solapa.

STEP 4  PACK TARGET. Dropdown packs existentes + [+ NEW PACK].
        NEW PACK → modal: nombre + accent color + descripción.
        Crea carpeta + pack.theiapack.json.

STEP 5  [SIMULATE] (opcional). Corre 200 mocks cubriendo el espacio
        cognitivo. Reporta:
          ▰▰▰▰▰▱▱  this atom wins  62%
          ▰▰▰▱▱▱▱  default wins    18%
          ▰▱▱▱▱▱▱  other atoms     20%
        Gana <5% → "too narrow". Gana >80% → "too greedy".

STEP 6  [💾 EXPORT ATOM]. Validation A1-A8. Si OK:
          - copia/recodifica .mp4 al folder del pack (con trim aplicado)
          - escribe .theia hermano
          - actualiza pack.theiapack.json
          - TheiaPackRegistry.register(pack) → disponible en LIVE
        Card en Raw Inputs se marca exported ✓.

STEP 7  Click siguiente card → loop a STEP 2. Cuando el pack tenga
        8-20 atoms, toggle LIVE.
```

### 4.2 Workflow B — LIVE con Selene (AI ON)

```
STEP 0  Toggle LIVE. Sidebar = Manual + Selene. Deck = Pack Slots.
        OUTPUT selector se habilita.

STEP 1  OUTPUT. Expandir Output Selector → activar surfaces (Stage Wall
        + Totem-3). Test pattern SMPTE para verificar. Save preset.

STEP 2  Cargar Pack en Slot. Click slot vacío → dropdown packs.
        Seleccionar "Tiburon_cyberpunk". Slot marca ●live con accentColor.
        Selene empieza a observar MusicalContext.

STEP 3  SELENE MATCHEA. En cada cambio significativo del context, corre
        AtomMatcher(pack.atoms, context). Atom ganador = menor distancia
        genómica. ThetaOrchestrator carga el atom + crossfade (WAVE 4903).
        Inspector > Now Playing se actualiza. Confidence visible.

STEP 4  OPERADOR INTERVIENE (opcional):
        - Force Triggers: [DROP]/[PEAK] → busca atom con esa sección
          + flag heavy/divine, dispara. Selene override 5s.
        - Manual faders: brightness/speed sin afectar Selene.
        - Click en Atom Tile: force-trigger directo de ese atom (5s override).
        - Blackout: corte instantáneo hasta toggle off.

STEP 5  SWAP PACK durante el set. Click otro slot → crossfade entre
        atom activo del pack viejo y default del nuevo. Selene resetea
        historia y matchea sobre el pack nuevo.
```

### 4.3 Workflow C — LIVE manual (AI OFF)

```
STEP 0  Como B pero Selene OFF en sidebar.

STEP 1  Cargar Pack en slot. Expandir ▼. Grilla de Atom Tiles visible.

STEP 2  CLICK en Atom Tile → atom va a OUTPUT inmediatamente y
        loopea entre trim.startMs y trim.endMs hasta el siguiente disparo.

        Atajos: 1-8 disparan los atoms 0-7 de la grilla visible.
        MIDI: cada tile tiene data-midi-bind="theia.live.pack.X.atom.Y" —
        mapeable a un pad del controlador.

STEP 3  FADERS y BLACKOUT siguen activos. Force-Triggers también
        (re-activan Selene 1 disparo y vuelven a OFF).
```

### 4.4 Workflow D — Híbrido (V2, opcional)

Selene sugiere pero no dispara. Inspector muestra `Suggested next: peak_jaws (0.91)`. Operador acepta (Enter) o rechaza (Esc, cooldown 30s sobre ese atom). Útil para festivales grandes con supervisión humana.

---

## 5. ARQUITECTURA DE CARPETAS

```
<packs-root>/                         (default ~/LuxSync/packs/)
├── Tiburon_cyberpunk/
│   ├── pack.theiapack.json
│   ├── peak_jaws.theia
│   ├── peak_jaws.mp4
│   ├── ambient_swim.theia
│   ├── ambient_swim.mp4
│   └── ...
├── CityNight/
│   └── ...
└── GlassRoom/
    └── ...
```

**Registry runtime:** `TheiaPackRegistry` (renombrado desde `TheiaRegistry`) con `scan(rootPath)`, `watchForChanges()`, `getPack(id)`, `getAtom(packId, atomId)`. La lógica de `TheiaFileLoader` se simplifica drásticamente (sin cuepoints).

---

## 6. ÁRBOL DE COMPONENTES

```
<TheiaEngineView>
├── <TheiaHeader>
│   ├── <BrandLogo>
│   ├── <ModeToggle>             ← [LIVE ◐ WORKSHOP]
│   └── <OutputSelector>         ← prominente, expandible
│
├── <TheiaWorkspace>             ← grid: viewport / inspector / deck
│   │
│   ├── <TheiaViewport>          ← CANVAS REAL (fix WAVE 4910.9)
│   │   ├── <ViewportCanvas>     ← OffscreenCanvas attach al worker
│   │   ├── <ViewportOverlays>   ← scanlines, brackets, HUD
│   │   └── <DropZoneOverlay>    ← solo WORKSHOP + sin clip
│   │
│   ├── <Inspector>              ← sidebar, mode-aware
│   │   ├── (live)   <LiveInspector>
│   │   │            ├── <NowPlayingCard>
│   │   │            ├── <ManualFaders>
│   │   │            ├── <ForceTriggerGrid>
│   │   │            ├── <SelenePanel>
│   │   │            └── <DiagnosticsBlock>
│   │   └── (workshop) <DnaLab>
│   │                  ├── <GenomeKnobs>
│   │                  ├── <GenomeCubeViz>
│   │                  ├── <EnergyZonePicker>
│   │                  ├── <ValidSectionsChips>
│   │                  ├── <TextureAffinityRadio>
│   │                  ├── <CompatibleVibesChipInput>
│   │                  ├── <AtomFlagsCheckboxes>
│   │                  ├── <PackTargetSelector>
│   │                  ├── <SimulateButton>
│   │                  └── <ExportAtomButton>
│   │
│   └── <Deck>                   ← mode-aware
│       ├── (live)   <PackSlotsRow>
│       │            ├── <PackSlot × N>
│       │            └── <ExpandedAtomGrid>
│       │                └── <AtomTile × M>
│       └── (workshop) <WorkshopDeck>
│                      ├── <TrimTimeline>
│                      │   ├── <TrimRuler>
│                      │   ├── <TrimHandleIn>
│                      │   ├── <TrimHandleOut>
│                      │   └── <TrimPlayhead>
│                      └── <RawInputsQueue>
│                          └── <RawClipCard × N>
│
└── <TheiaToasts>
```

---

## 7. ROLLOUT INCREMENTAL

| Sub-wave | Scope | Bloqueante para |
|----------|-------|-----------------|
| **4920.1** | Tipos `ITheiaAtom` v2 + `ITheiaPack` + migrator v1→v2 | Todo |
| **4920.2** | `TheiaPackRegistry.scan()` + fs.watch | Loading |
| **4920.3** | `AtomMatcher` (simplificación de SeleneTheiaAdapter sin cuepoints) | Selene |
| **4920.4** | `TheiaHeader` rediseñado (mode toggle + OUTPUT) | UX skeleton |
| **4920.5** | `<ViewportCanvas>` real + attach OffscreenCanvas al worker | Visibility (fix WAVE 4910.9) |
| **4920.6** | `<Inspector>` mode-aware (Live + DNA Lab) | Control + edición |
| **4920.7** | `<Deck>` LIVE (PackSlots + AtomTiles) | LIVE workflow |
| **4920.8** | `<Deck>` WORKSHOP (TrimTimeline + RawInputsQueue) | WORKSHOP workflow |
| **4920.9** | Export pipeline (.mp4 recortado + .theia + manifest) | Production-ready |
| **4920.10** | MIDI bindings universales + atajos teclado | Pro UX |
| **4920.11** | Output Selector real (Stage Wall, Totem, OSC, NDI) | Multi-surface |
| **4920.12** | SIMULATE + diversity warnings | Authoring quality |

Cada sub-wave es vertical y demoable.

---

## 8. ATAJOS DE TECLADO

| Scope | Atajo | Acción |
|-------|-------|--------|
| Global | `Alt+L` / `Alt+W` | Switch LIVE / WORKSHOP |
| Global | `Ctrl+Shift+O` | Abrir Output Selector |
| Global | `B` | Toggle Blackout |
| Global | `Space` | Play/pause (contexto-aware) |
| LIVE | `1-8` | Force-trigger atom N del pack expandido |
| LIVE | `Q/W/E/R` | Force-trigger drop/ambient/buildup/peak |
| LIVE | `Shift+1-8` | Switch pack slot N |
| LIVE | `Tab` | Toggle Selene AI |
| WORKSHOP | `I` / `O` | Set trim IN / OUT al playhead |
| WORKSHOP | `←` / `→` | Step ±1 frame |
| WORKSHOP | `Shift+←/→` | Skip ±1s |
| WORKSHOP | `Ctrl+E` | Export atom |
| WORKSHOP | `Ctrl+S` | Save draft |
| WORKSHOP | `,` / `.` | Snap mode toggle |

---

## 9. RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|--------|------------|
| Packs grandes (200+ atoms) lagueando | Virtualización del grid, lazy thumbnails, max 8 packs simultáneos |
| Migrator v1→v2 pierde info | Backup automático del v1 + reporte HTML del mapping |
| Operador olvida default | Sin default, Selene usa `argmin(distance)`. Warning visible |
| Match devuelve siempre el mismo atom | SIMULATE detecta en WORKSHOP. En LIVE: cooldown 30s sobre último disparado |
| Conflicto LIVE/WORKSHOP sobre videoElement | Modos MUTEX. WORKSHOP silencia Selene + bridge SAB. LIVE deshabilita drop zones |
| fs.watch spurious reloads en edición | Debounce 500ms. Pause durante export |
| Renombrar pack rompe atoms | Op atómica: reescribe `packId` de todos los atoms en memoria + en disco |
| Trim mal calibrado deja saltos en loop | `loop-preview` infinito en WORKSHOP. Operador verifica antes de exportar |
| Output mal enrutado | Test pattern SMPTE por surface. Telemetría "Stage Wall: 44fps, last 12ms ago" |
| Canvas mock invisible (bug WAVE 4910.9) | `<ViewportCanvas>` real con `transferControlToOffscreen` antes de `theta.start()` |

---

## 10. DECISIONES UX CRÍTICAS

### 10.1 Por qué un atom = un loop (no cuepoints)

- **Cognición humana**: el VJ recuerda "el del tiburón", no "el cuepoint 3 del .theia de aurora". Un nombre = una identidad.
- **MIDI bindings 1:1**: cada atom → un pad. Sin jerarquías.
- **Matching más simple**: distancia lineal en lugar de jerárquica. Algoritmo más rápido y debuggable.
- **Drag&drop natural**: los operadores piensan en archivos. `.mp4` arrastrado = nuevo atom.
- **Filesystem como DB**: pack es folder, share es zip, sync es Dropbox. Sin servicios.

### 10.2 Por qué dos modos hard-split

- En directo no quieres ver knobs de edición. En taller no quieres ver faders.
- **Seguridad**: en LIVE, los cambios al genoma están bloqueados. Previene catástrofes en festival.
- **Selene foco**: en WORKSHOP, OFF siempre. En LIVE, ON (o explícitamente OFF). Nunca ambigüedad sobre quién manda.

### 10.3 Por qué OUTPUT en el header

- Es la pregunta crítica del VJ: *"¿qué surface recibe qué?"*.
- En otros softwares está enterrado en submenú. Aquí, al lado del logo.
- Visible y persistente reduce el riesgo nº1 en festival: "estaba mandando luz a la surface equivocada".

### 10.4 Por qué el deck cambia de contenido entre modos (no de posición)

- **Memoria muscular**: el operador sabe que "el carril inferior es donde está el material". No importa el modo.
- **Cero re-aprendizaje**: cambiar modo no reorganiza la pantalla; solo cambia lo que se muestra.
- **Transición rápida**: en mitad de un set puedes editar un atom (WORKSHOP rápido) y volver sin perder mapa mental.

---

## 11. INTEGRACIÓN CON BACKEND EXISTENTE

### 11.1 Qué se conserva (WAVE 4900-4903)

- `ThetaOrchestrator` + `theta.worker.ts`: el render pipeline sigue intacto.
- `CrossfadeUnit` y `AssetStateMachine`: se usan en LIVE para transiciones entre atoms.
- `theia:seek` IPC: cuando Selene cambia de atom, sigue siendo un seek con crossfade.
- `SharedVideoFrameBuffer` y `ThumbFrameWriter`: sin cambios.

### 11.2 Qué se simplifica

- `SeleneTheiaAdapter` → `AtomMatcher`: input simplificado (sin cuepointId, target = pack actual).
- `TheiaRegistry` → `TheiaPackRegistry`: indexado por (packId, atomId).
- `TheiaFileLoader` → `TheiaAtomLoader`: parsing plano sin cuepoints.

### 11.3 Qué se elimina

- `ITheiaCuePoint`, `CueJumpIntent`, `theiaCueJumpBus` (eventbus interno): obsoleto.
- `forceState` con totalTicks y waitAnchor: reemplazado por `playAtom(atomId, opts)` con crossfade simple.

---

## 12. CIERRE

WAVE 4920 reduce drásticamente la superficie cognitiva del sistema:
- **Datos**: `cuePoints[]` desaparece. Genome al root. Trim simple {in,out}.
- **UX**: dos modos hard-split. Header limpio. OUTPUT prominente. Deck mode-aware.
- **Workflow**: drop → trim → tune → export → disparar. Sin abstracciones intermedias.
- **Selene**: matchea contra atoms planos. Decisión por distancia, no por jerarquía de cuepoints.

El operador piensa en **packs y átomos**, no en timelines. Selene piensa en **vectores y matches**, no en estados de FSM por cue. Cada decisión arquitectónica reduce ambigüedad y aumenta la velocidad de uso real en escena.

*Fin del blueprint WAVE 4920. 0 código ejecutado.*
