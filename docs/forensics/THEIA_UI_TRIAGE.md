# THEIA_UI_TRIAGE.md — WAVE 8210

> **Theia UI & Component Triage (Audit Phase)**
> Escaneo forense de `src/components/views/TheiaEngineView/` + `src/components/theia/` + stores asociados.
> Compañero de `Theia_complete_audit.md` (WAVE 8206 — pipeline) y WAVE 8207 (quarantine lift + WebGL plumbing).
> **Solo análisis. Cero cambios de código.**

---

## 0. TL;DR — Veredicto

La UI de Theia son **5.519 LOC** repartidas en dos mitades que no se hablan:

| Mitad | Qué es | Estado real |
|---|---|---|
| **Shell performativo** (header, viewport, masters, inspector, LiveDeck) | UI de mando para el motor worker | Funciona, pero **~40% de sus datos son mock** (`MOCK_CLIPS`, heartbeat sintético, sliders que no llegan a ningún sitio) |
| **Taller de autoría** (WorkshopDeck + Trimmer + DNALab + editorStore) | Pipeline `.mp4 → trim → genoma → .theia export` | Completo y funcional — pero genera átomos que **solo Selene consumiría**, y el puente Selene→Theia está muerto (R4 diferido) |

El hallazgo más importante para el Hybrid Deck: **la UI ya separa limpiamente "media" de "autoría"** — el `packStore` es la única fuente de verdad de assets y `ingestFiles()` ya acepta `.theia` + vídeo en un mismo flujo. Añadir un tercer tipo de fuente (shader) es una extensión, no una reescritura.

> ⚠️ **Huérfanos backend descubiertos**: `TheiaRegistry` y `TheiaFileLoader` (~600 LOC de matching cognitivo + validación) tienen **cero callers vivos** — `useTheiaPackStore.ingestFiles()` parsea los `.theia` inline con `_isValidTheiaAtom()` y nunca toca el registry. El único importador restante es `SeleneTheiaWiring`, que nadie invoca. Decisión pendiente: resucitarlos como verdad de disco o eliminarlos.

---

## 1. Mapa de Dependencias UI/State

### 1.1 Árbol de componentes

```
TheiaEngineView (index.tsx, 1068 LOC)
├── header ──── logo/BETA · OUTPUT btn · LIVE◐WORKSHOP toggle · POWER
│                · masters (BRIGHT/SPEED/CONTRAST) · BLACKOUT · LOAD ASSETS · LOAD PACK
│
├── .theia-stage (left column)
│   ├── Viewport ──── canvas→OffscreenCanvas · RAW|PATCH toggle · scanlines
│   │                 · [workshop] video-slot nativo · [live] off-overlay
│   │                 · [patch] Totem×3 mock overlay
│   ├── [live]     → LiveDeck (269) ── pack slots + atom tiles + force-trigger
│   └── [workshop] → WorkshopDeck (181) + TheiaTrimmer (383)
│
└── right rail
    ├── [live]     → Inspector ── Section Monitor (mock) · Active Asset (mock)
    │                            · Manual Overrides (parcialmente real)
    └── [workshop] → TheiaDNALab (270) ── EXPORT · genome×3 · energyZone min/max
```

### 1.2 Stores — quién lee/escribe qué

| Store | Campo | Consumers | Notas |
|---|---|---|---|
| `useTheiaEditorStore` (278) | `editorMode` | `index.tsx` (toggle + swap de columnas), `Viewport`, `useAuthoringShortcuts` | **Es el conmutador maestro LIVE/WORKSHOP.** Si colapsamos pestañas, este campo muere o se reinterpreta |
| | `draftAtom` | `TheiaTrimmer`, `TheiaDNALab`, `WorkshopDeck` (activo), `useAuthoringShortcuts` | El único objeto de autoría. `rawClipId` enlaza draft↔rawClip |
| | `isDirty` | `TheiaDNALab` (badge export) | + autosave debounced a `localStorage` (`luxsync.theia.atomDraft.*`) |
| | acciones: `updateTrim/updateGenome/updateEnergyZone/setValidSections` | Trimmer / DNALab | `setValidSections` **nunca se llama desde UI** — campo autorado a ciegas |
| `useTheiaPackStore` (358) | `packs` + `livePackId` + `expandedPackId` | `LiveDeck`, **`SeleneTheiaAdapter.process()`** (línea 145 — el matcher cognitivo lee el pack ●live) | La única fuente de assets reales |
| | `rawClips` | `WorkshopDeck`, `index.tsx` (ingest), `TheiaDNALab` (marca `exported`) | Cola del workshop; URLs `blob:` revocadas en `clearRawClips` ✔ |
| | `ingestFiles()` | `index.tsx` (ambos file inputs) | Ya es **polimórfico**: vídeo→rawClip, `.theia`→átomo en pack. Punto de extensión natural para `.glsl` |
| `controlStore` | `aiEnabled` | `index.tsx` → `getSeleneTheiaBridge().attach/detach` | Bridge renderer-side que **nadie alimenta** (R4) — efecto presente pero inerte |
| `keyMapStore` | `isArmed` | `TheiaTrimmer`, `useAuthoringShortcuts` | Guard para que MIDI-learn capture teclas |

### 1.3 Touchpoints con el motor (post-8207)

| UI → Orchestrator | Estado |
|---|---|
| `theta.start()/stop()` (POWER) | ✔ real — tras el lift |
| `theta.loadVideo(url)` (ingest + WorkshopDeck) | ✔ real |
| `theta.playAtom({atomId, startMs, crossfadeMs})` (LiveDeck tiles) | ✔ real — ⚠ `endMs` nunca se envía ni enforcea (G14 del audit previo) |
| `theta.forceState('drop'/'ambient')` | ✔ real — llega al worker FSM |
| `theta.setPlaybackRate()` (SPEED) | ✔ real → `theia:set-rate` |
| `theta.openOutputWindow()/closeOutputWindow()` | ✔ real → HDMI window |
| `theta.attachOffscreenCanvas()` (Viewport) | ✔ real — WAVE 8207 añadió `theia:attach-canvas` |
| `theta.getVideoElement()` (Trimmer playhead, Viewport workshop slot) | ✔ real — dependencia implícita: el `<video>` vive oculto en DOM |
| `BRIGHT`/`CONTRAST` sliders | ✘ **mock** — solo `setState` local, jamás sale del componente |
| `BLACKOUT` header | ✘ **semi-mock** — oscurece el overlay local del viewport; el output HDMI no se entera |
| Inspector `BLACK FRAME`/`RESET` | ✘ **muertos** — tienen `data-midi-bind` pero **ningún `onClick`** |
| Section Monitor / BPM / sparkline | ✘ **mock** — `setInterval` sintético 120ms (`index.tsx:223-243`) |
| `MOCK_CLIPS` / `ClipManifest` / `AssetZone` / palette/zones | ✘ **mock** — alimenta `activeClip` (Inspector ACTIVE ASSET, Totem patch overlay) |

---

## 2. Triaje

### 🟢 KEEP — mantener/refactorizar

| Pieza | Razón | Acción |
|---|---|---|
| **Shell `TheiaEngineView`** (header/grid) | Es la consola de mando: POWER, OUTPUT HDMI, LOAD — todo real post-8207 | Mantener layout; sustituir el toggle LIVE◐WORKSHOP por el deck unificado (§3) |
| **`Viewport`** (canvas + `attachOffscreenCanvas`) | Corazón del preview mirror; ya funciona con el worker WebGL | Keep. Podar: modo `patch`/Totem, `MOCK_CLIPS`, `activeClip`, video-slot si el trimmer se refrigera |
| **`LiveDeck`** | Es exactamente el modelo mental correcto: **slots = packs, tiles = fuentes triggerables**. `playAtom` manual ya funciona | Keep + generalizar `AtomTile` a "source tile" (vídeo ⋄ shader) |
| **`useTheiaPackStore`** | Fuente única de assets; `ingestFiles` polimórfico; blobs revocados correctamente | Keep + añadir `kind: 'video'\|'shader'` a `RawClip` y rama `.glsl/.frag` en `ingestFiles` |
| **`lux:theia:exportAsset` IPC** (`main.ts:669`, `preload.ts:929`) | Save-dialog funcional | Keep — servirá para exportar `.theia` (vídeo) y presets de shader |
| **Masters `SPEED`, `BRIGHT`, `CONTRAST`** | Con WebGL en worker son triviales de hacer reales: uniforms `u_rate/u_brightness/u_contrast` | Keep controles + **cablear** (nuevo msg `theia:set-uniform`). Hoy son placebo |
| **`BLACKOUT`** | Necesario en live shows | Keep + cablear al worker (`theia:force-state blackout` o uniform `u_blackout`) — hoy solo tinta el preview local |

### 🟡 FRIDGE — congelar/ocultar bajo el capó (sin romper)

| Pieza | Por qué no trash | Cómo congelar |
|---|---|---|
| **`TheiaDNALab`** (270+452 CSS) | Es el único editor del genoma, y el genoma es lo que hace a Theia *cognitivo* (matching A/C/O + energyZone). Pero ocupa un rail entero para 3 sliders + 14 tags | Colapsar a una **card "ATOM DNA"** en el inspector contextual — desplegada solo cuando hay draft. Genoma default 0.5 ya produce átomos válidos sin tocarla |
| **`useTheiaEditorStore`** | Sustenta DNALab/Trimmer/autosave. Si el workshop se pliega en el inspector, el store sigue siendo su estado | Mantener; `editorMode` pasa a ser foco de inspector, no swap de columnas. `loadAutosave` existe pero **nadie lo llama** — el autosave escribe y nunca restaura (bug menor documentado) |
| **`TheiaTrimmer`** (383+281 CSS) | Purga segura técnica (`newDraftFromPath` ya defaultea trim=clip completo, gate 250ms OK). **Pero** es la única UI que define loop bounds, y `playAtom` sí consume `startMs`. Perderlo deja los `.theia` como full-clip forever | **Fridge → mini-scrubber**: demote a una banda compacta IN/OUT dentro de la card SOURCE del inspector (no rail de ancho completo). Trash solo si aceptamos átomos siempre-full-clip |
| **`SeleneTheiaBridge` attach effect** (`index.tsx:202-220`) | R4 diferido — el puente se rediseñará a telemetría pura | Mantener el efecto (es inerte, cero coste), etiquetar `@deprecated pending R4` para que nadie lo confunda con wiring vivo |
| **`energyZone`/`validSections`/`compatibleVibes` authoring** | Sin UI real para sections/vibes; `setValidSections` muerto | Ocultar tras "ADVANCED" en la card DNA — defaults seguros ya pasan los gates A1-A5 |
| **`useAuthoringShortcuts`** | Documentado como noop: solo reimplementa Space→play/pause que `TheiaTrimmer` ya hace | Conservar el export (rompe imports si se borra) pero marcar para fusión con atajos globales |

### 🔴 TRASH — purga segura sin estados huérfanos

| Pieza | LOC | Por qué es seguro |
|---|---|---|
| **`MOCK_CLIPS` + `ClipManifest`/`AssetZone`/`SectionTag` types** | ~120 en index.tsx | Estado mock puro. `handleSelectClip`, `activeClip.palette/zones` no tocan nada real. Sustituir `ACTIVE ASSET` por el átomo real del `state-report` del worker |
| **Heartbeat mock** (`index.tsx:222-243`) | ~20 | `setInterval` sintético que simula energía/sección. Morirá cuando llegue telemetría real (FFT/zone por tick — pendiente en protocolo) |
| **`PATCH PREVIEW` + `Totem`** + `ViewportMode='patch'` | ~60 | Overlay mock de 3 tótems — nunca leyó un patch real. Concepto válido pero la implementación es decoración |
| **Inspector dead buttons** (`BLACK FRAME`, `RESET`) | ~15 | `data-midi-bind` sin `onClick` — ni siquiera placebo funcional. Wire o delete; hoy son mentira |
| **`video-slot` nativo + overrides de estilo del `<video>`** (Viewport 648-689) | ~40 | Solo sirve al taller. Si el trimmer se refrigera a mini-scrubber, el preview del draft lo hace el canvas del worker (ya lo renderiza) — el trasplante DOM de `getVideoElement()` con `position:fixed -9999px` hacks es la parte más frágil del archivo |
| **`SeleneTheiaAdapter` constructor arg `_registry`** | — | El adapter recibe `TheiaRegistry` pero tras WAVE-4923 lee `packStore` — la dependencia es parásita |
| **`TheiaRegistry` + `TheiaFileLoader`** (~600) | backend | **Zero callers.** Decisión: eliminar, o invertir la flecha (registry = verdad de disco que *alimenta* packStore). No mantener ambos |

---

## 3. Propuesta — THE HYBRID DECK

### 3.1 Principio rector

> **Un átomo es una fuente visual con genoma. Vídeo `.mp4` y shader `.glsl` son dos *kinds* del mismo concepto.**

El matching cognitivo (aggression/chaos/organicity/energyZone) no depende del medio — un shader plasma puede ser igual de "aggressive" que un vídeo de llamas. Esto significa: **registry, matcher, packs, LiveDeck y crossfade no cambian de forma**.

### 3.2 Modelo de datos — extensión mínima

```ts
// theiaTypes.ts — ITheiaAtom gana source discriminator
interface ITheiaAtom {
  // ... genoma, energyZone, validSections, compatibleVibes (sin cambios)
  source:
    | { kind: 'video'; filePath: string; trim: { startMs: number; endMs: number } }
    | { kind: 'shader'; filePath: string; /* o fragment inline */ }
  // trim sale del root → vive dentro de source.kind==='video'
}
```

- `trim` migra dentro de `source.video` — un shader no tiene bounds (loop infinito por construcción).
- `RawClip` gana `kind: 'video' | 'shader'`; `ingestFiles` añade `.glsl`/`.frag` al filtro y crea rawClips shader que **saltan el trimmer directo a la card de genoma**.
- `playAtom` protocol msg gana `source` o el worker resuelve por atomId contra un mapa.

### 3.3 Protocolo worker (nuevos mensajes)

```
theia:load-shader   { atomId, fragmentSrc }        → compile + cache program por atomId
theia:play-atom     { atomId, source, startMs? }   → shader path: swap program + crossfade (prevTex→newTex ya funciona)
theia:set-uniform   { name, value }                → masters BRIGHT/CONTRAST/SPEED por fin reales
```

El pipeline SAB/WebGL de WAVE 8207 ya soporta esto estructuralmente: el fragment shader actual mezcla `videoTex`/`prevTex`/procedural — un shader de átomo es "procedural parametrizado por uniforms".

### 3.4 Layout — una vista, cero pestañas

```
┌──────────────────────────────────────────────────────────────────────┐
│ THEIA  ◉POWER  BRIGHT SPEED CONTRAST  ◉BLACKOUT   [LOAD MEDIA] [OUTPUT▶]│
├───────────────────────────────────────────────┬──────────────────────┤
│                                               │  INSPECTOR (context)  │
│   VIEWPORT — worker canvas (siempre vivo)     │  ┌──────────────────┐ │
│   scanlines · section tag · off-overlay       │  │ SOURCE           │ │
│                                               │  │  name · kind ▣   │ │
│                                               │  │  [video] IN/OUT  │ │
│                                               │  │  [shader] unif.  │ │
│                                               │  ├──────────────────┤ │
│                                               │  │ ATOM DNA ▸(coll.)│ │
│                                               │  │  A/C/O · zones   │ │
│                                               │  │  [EXPORT .theia] │ │
│                                               │  ├──────────────────┤ │
│                                               │  │ LIVE TELEMETRY   │ │
│                                               │  │  section·energy  │ │
│                                               │  ├──────────────────┤ │
│                                               │  │ OVERRIDES        │ │
│                                               │  │  DROP·AMBIENT·◉  │ │
│                                               │  └──────────────────┘ │
├───────────────────────────────────────────────┤                      │
│ MEDIA BAY                                     │                      │
│ [●Tiburon][CityNight][GLSL-Plasma][ + raw ]   │                      │
│  └─ tiles: [mp4·lift][mp4·drop][◈plasma]…     │                      │
└───────────────────────────────────────────────┴──────────────────────┘
```

- **`editorMode` desaparece como swap de columnas.** El inspector es contextual: seleccionas raw `.mp4` → card SOURCE muestra mini-trim + DNA colapsable; seleccionas `.glsl` → muestra uniforms + DNA; nada seleccionado → LIVE telemetry + overrides.
- **Media Bay unifica LiveDeck + WorkshopDeck**: slots de packs (con ●live) + una zona `raw` de archivos dropeados aún no exportados. Los tiles distinguen kind por icono (`▣` vídeo / `◈` shader) — mismo click-to-trigger.
- **`LOAD MEDIA`** único (los dos inputs actuales se funden: `accept=".mp4,.webm,.mkv,.mov,.theia,.glsl,.frag"` + webkitdirectory para packs).
- **El taller deja de ser "otro modo"**: es el mismo deck con la card SOURCE enfocada. Esto elimina la bifurcación `theia-main--author`, el video-slot DOM hack, y la pregunta "¿dónde estoy?".
- **MIDI intacto**: todos los `data-midi-bind` existentes sobreviven; los del trimmer se renombran a `theia.source.trim.*`.

### 3.5 Orden de ejecución propuesto (waves futuras)

| Paso | Contenido | Riesgo |
|---|---|---|
| **H1** | Podar mocks: MOCK_CLIPS, heartbeat sintético, patch overlay, dead buttons. Inspector ACTIVE ASSET ← `theia:state-report` real | Bajo — todo es local state |
| **H2** | Cablear masters + blackout → `theia:set-uniform` / `force-state` | Bajo — protocolo +1 msg |
| **H3** | `source.kind` en tipos + `ingestFiles .glsl` + `theia:load-shader` + tile iconos | Medio — toca schema `.theia` (loader tolera campos extra ✔) |
| **H4** | Colapsar editorMode → inspector contextual; DNALab→card; Trimmer→mini-scrubber | Medio — reestructura JSX pero sin tocar worker |
| **H5** | Resolver huérfanos: registry↔packStore (elegir verdad) + telemetría real (R4) | Alto — depende del rediseño Selene |

---

## 4. Riesgos y notas

1. **`getVideoElement()` es un acoplamiento oculto**: Trimmer, WorkshopDeck y Viewport asumen que el `<video>` existe en DOM renderer. En el modelo shader-first, los atoms `.glsl` no tienen elemento — cualquier código que pida `vid.duration` debe guardarse por `source.kind`.
2. **Autosave huérfano**: `loadAutosave()` nunca se llama → los drafts se guardan en localStorage y no se restauran. Fridge o fix en H4.
3. **`trim.endMs` no enforceado en runtime** (G14): el mini-scrubber es cosmético hasta que el worker corte en `endMs` — anotado para H3/H4.
4. **Nada aquí rompe DMX**: todo el triaje es renderer-local; el worker y el SAB quedan intactos salvo el msg `set-uniform` (H2) y `load-shader` (H3).

*Fin del triaje — listo para que el arquitecto decida el orden de las waves H1–H5.*
