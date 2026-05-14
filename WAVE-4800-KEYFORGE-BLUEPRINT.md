# ⌨️ WAVE 4800 — KEYFORGE: THE OPERATOR'S MATRIX
## Master Blueprint V1 (Creative Directive)

> **Codename:** `KeyForge`
> **Tagline:** *"El teclado deja de ser un periférico. Se convierte en el Command Wing."*
> **Hermano arquitectónico:** WAVE 2047 (`MidiLearnOverlay` — Ghost Limbs)
> **Posición en el stack:** Peer del sistema MIDI. Comparte `MidiActionRegistry` como **catálogo unificado de capacidades disparables**. KeyForge es un *transport* alternativo; el bus de acciones es el mismo.

---

## Filosofía rectora

> **El teclado de un iluminador en 2026 no es una hoja de atajos. Es un instrumento.**

Inspiraciones declaradas:
- **GrandMA3 Command Wing:** páginas (`Page+`/`Page-`), ejecutores numerados, sintaxis posfija.
- **Ableton Push / FL Studio Performance Mode:** mode-switching con tecla pivote, layouts contextuales.
- **Street Fighter 6 / Tekken 8 Frame Data:** *chords*, *hold-and-release*, *charge moves*, *cancels*.
- **Cyberpunk 2077 Quickhack Menu:** *neuro-shortcuts* — la primera tecla cambia el rol semántico de las siguientes.
- **Vim / Kakoune:** modales con verbos y objetos. `d` (verbo) + `mover` (objeto). KeyForge: `S` (select) + `1` (group 1).

**Antifilosofía** (lo que KeyForge NO es):
- ❌ No es un mapeador `Ctrl+K → función()`. Eso lo hace cualquier IDE.
- ❌ No es Freestyler con teclas. Freestyler asume que cada tecla es un botón independiente; KeyForge asume que el teclado es una **superficie de gesto continuo**.
- ❌ No es un sistema de macros lineales. Una macro es una grabación; un *chord* es una expresión.

---

## Índice

1. [The Cortex — KeyMapStore & Event Loop](#1-the-cortex--keymapstore--event-loop)
2. [The Layer Stack — Modal Operator Semantics](#2-the-layer-stack--modal-operator-semantics)
3. [The Combat Layout — Default Battle Plan](#3-the-combat-layout--default-battle-plan)
4. [Chords & Modifiers — Fighting Game Logic](#4-chords--modifiers--fighting-game-logic)
5. [The Action Bus — Bridging KeyForge & MidiActionRegistry](#5-the-action-bus--bridging-keyforge--midiactionregistry)
6. [The Key-Learn Overlay — Holographic Keyboard](#6-the-key-learn-overlay--holographic-keyboard)
7. [Persistence & Profiles — Multi-Show Loadouts](#7-persistence--profiles--multi-show-loadouts)
8. [Safety & Anti-Patterns](#8-safety--anti-patterns)
9. [Roadmap & Definition of Done](#9-roadmap--definition-of-done)

---

## 1. The Cortex — KeyMapStore & Event Loop

### 1.1 Arquitectura general

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       KEYFORGE CORTEX (root-mounted)                        │
│                                                                              │
│   window.keydown ──┐                                                         │
│   window.keyup   ──┤                                                         │
│                    ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  CaptureGuard        │  ← descarta si target es <input>,         │
│           │  (focus detection)   │     <textarea>, [contenteditable], etc.   │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  HoldRegistry        │  ← tracker de teclas físicamente abajo   │
│           │  Set<KeyCode>        │     (zero-alloc; mutación in-place)       │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  LayerResolver       │  ← qué Layer está activo                  │
│           │  (Base/Alt/Cmd/Sel)  │     basado en holdRegistry                │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  ChordMatcher        │  ← combos `1+F`, `S+1+F`, charge moves   │
│           │  (intent compiler)   │     emite KeyIntent normalizado           │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  ActionDispatcher    │  ← idéntico al de useMidiLearn:           │
│           │  (prefix routing)    │     fx-*, vibe-*, arb-*, sel-*, ctrl-*    │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│            Backend (window.lux.*) / Stores                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Captura global sin interferir con inputs (el problema clásico)

**Estrategia:** *Focus-aware capture* con tres anillos defensivos.

```ts
// src/keyforge/captureGuard.ts
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function shouldInterceptKey(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  if (!target) return true

  // Anillo 1: tag estructural editable
  if (EDITABLE_TAGS.has(target.tagName)) return false

  // Anillo 2: contenteditable (rich editors, code mirrors)
  if (target.isContentEditable) return false

  // Anillo 3: opt-out explícito de un panel (componentes que quieren su propio loop)
  //          ej. el editor de timecode dentro del Cue Sheet
  if (target.closest('[data-keyforge-bypass="true"]')) return false

  // Anillo 4: opt-in explícito (ej. focus en TheProgrammer para WASD pan/tilt)
  //          override: aunque haya un input dentro, el contenedor reclama el control
  if (target.closest('[data-keyforge-claim="true"]')) return true

  return true
}
```

> **Regla maestra:** KeyForge nunca compite con `<input>`. Si el operador está escribiendo el nombre de un fixture, su `Space` es un espacio en blanco, no un blackout.
>
> **Excepción:** `Escape` y `F1` (help) son **siempre globales** porque son escapes naturales de cualquier modal/input.

### 1.3 El loop (zero-alloc en hot path)

```ts
// src/keyforge/keyForgeLoop.ts
import { useKeyMapStore } from '../stores/keyMapStore'

const heldKeys = new Set<KeyCode>()       // ← reused, no realloc
const chordBuffer: KeyCode[] = []          // ← pre-allocated, reset()-style

window.addEventListener('keydown', (e) => {
  if (!shouldInterceptKey(e)) return

  // Repetidos del SO → ignorar (KeyForge no quiere autorepeat)
  if (e.repeat) return

  const code = normalizeKeyCode(e)        // 'KeyA' → 'A', 'Digit1' → '1'
  heldKeys.add(code)

  // Dispatch sincrónico — la decisión Layer/Chord ocurre AHORA
  useKeyMapStore.getState().handleKeyDown(code, e, heldKeys)

  // Default browser action (e.g. Space=scroll) → preventDefault si fue
  // consumido. Si la tecla no está mapeada en NINGÚN layer, dejar pasar.
  if (useKeyMapStore.getState().wasLastEventConsumed()) {
    e.preventDefault()
  }
})

window.addEventListener('keyup', (e) => {
  const code = normalizeKeyCode(e)
  heldKeys.delete(code)
  useKeyMapStore.getState().handleKeyUp(code, e, heldKeys)
})

window.addEventListener('blur', () => {
  // Operador hace Alt+Tab → liberar todo, evitar teclas "atascadas"
  heldKeys.clear()
  useKeyMapStore.getState().releaseAll()
})
```

**Decisiones técnicas declaradas:**

| Decisión | Justificación |
|---|---|
| **`Set` mutable, reusada** | El hot path de teclado es < 100 events/s pero el principio "zero-alloc en hot paths" del Aether se mantiene como cultura. |
| **Ignorar `e.repeat`** | Autorepeat del SO es ruido para chords. KeyForge implementa su propio "tap-and-hold" semántico (§4.4). |
| **Capture en `window`, no `document.body`** | `window` recibe los eventos antes de que un componente con `stopPropagation()` los consuma. KeyForge tiene prioridad absoluta cuando el guard pasa. |
| **`normalizeKeyCode()`** | Usar `e.code` (físico, layout-independent) en lugar de `e.key` (afectado por layout AZERTY/QWERTY). Esto garantiza que `WASD` funcione igual en cualquier teclado del mundo. |
| **`blur` libera holdRegistry** | Sin esto, Alt+Tab podría dejar `Shift` atascado y arrojar el `LayerResolver` a un estado fantasma. |

### 1.4 Contrato del store

```ts
// src/stores/keyMapStore.ts
import type { MidiActionMeta } from '../midi/MidiActionRegistry'

/** Identificador físico de tecla, layout-independent. */
export type KeyCode =
  | 'A' | 'B' | 'C' | /* ... */ | 'Z'
  | '0' | '1' | /* ... */ | '9'
  | 'F1' | /* ... */ | 'F12'
  | 'Space' | 'Enter' | 'Tab' | 'Escape'
  | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
  | 'Shift' | 'Control' | 'Alt' | 'Meta'
  | 'Comma' | 'Period' | 'Slash' | 'Backslash'
  | (string & {})  // escape hatch tipado

/** Layer = "página" del Command Wing. Cambia el significado completo del teclado. */
export type LayerId =
  | 'base'        // página por defecto (efectos + grupos)
  | 'alt'         // hold Alt — segunda página (vibes + macros)
  | 'cmd'         // hold Ctrl/Cmd — comandos sintácticos (`G 1 Enter` = select group 1)
  | 'select'      // hold S — modo selección (1-9 = pick group)
  | 'kinetic'     // hold K — WASD = pan/tilt de la selección
  | 'forge'       // tap F2 — Layer-Learn Mode (editar mapeos)

/** Modificadores físicos en estado de hold. */
export interface ModifierState {
  readonly shift: boolean
  readonly ctrl:  boolean
  readonly alt:   boolean
  readonly meta:  boolean
}

/**
 * KeyBinding: el contrato de qué hace una tecla en un layer.
 *
 * Reutiliza el ID de MidiActionMeta como targetActionId — un fader/pad/efecto
 * puede ser disparado tanto por MIDI como por teclado sin duplicar registros.
 */
export interface KeyBinding {
  readonly key:           KeyCode
  readonly layer:         LayerId
  /** ID de acción del MidiActionRegistry (`fx-strobe_storm`, `vibe-techno-club`…) o ID nativo KeyForge (`sel-group-1`, `kin-pan-left`). */
  readonly actionId:      string
  /** Comportamiento temporal del binding. */
  readonly behavior:      KeyBehavior
  /** Modificadores REQUERIDOS además del Layer. Permite Shift+1 ≠ 1. */
  readonly requiredMods?: Partial<ModifierState>
}

/**
 * Comportamiento de la tecla. Inspirado en fighting games + DAWs.
 */
export type KeyBehavior =
  | { kind: 'tap' }                            // press+release < 200ms → fire once
  | { kind: 'hold' }                           // mientras esté abajo, action está "ON"
  | { kind: 'toggle' }                         // press → flip estado, release ignorado
  | { kind: 'momentary'; releaseActionId?: string }  // press = fire, release = otra acción
  | { kind: 'charge';   thresholdMs: number }  // hold > N ms → fire intensified
  | { kind: 'repeat';   periodMs: number }     // mientras esté abajo → fire cada N ms

/**
 * Chord = combinación simultánea. Si TODAS las keys están held cuando se
 * presiona la última, dispara el chord en lugar de las acciones individuales.
 *
 * Ejemplo Tekken: `1+F` con `1`=mover-select y `F`=strobe → chord especial
 *                 `chord-strobe-on-movers`.
 */
export interface ChordBinding {
  readonly chordId:  string                    // 'chord-strobe-on-movers'
  readonly keys:     readonly KeyCode[]        // ['1', 'F'] — orden NO importa
  readonly layer:    LayerId
  readonly actionId: string
  readonly behavior: KeyBehavior
}

/**
 * El store. Persistido (excepto state transient: `heldKeys`, `learnMode`).
 */
export interface KeyMapState {
  // ── Mappings ──
  readonly bindings: ReadonlyMap<string /* `${layer}:${key}` */, KeyBinding>
  readonly chords:   readonly ChordBinding[]   // O(N) match — N esperado < 50

  // ── Active state (transient) ──
  readonly activeLayer:   LayerId              // derivado de heldKeys via LayerResolver
  readonly heldKeys:      ReadonlySet<KeyCode>
  readonly chargeBuffer:  ReadonlyMap<KeyCode, number /* tStart ms */>

  // ── Learn / Forge mode ──
  readonly learnMode:        boolean
  readonly listeningSlot:    { layer: LayerId; key: KeyCode } | null
  readonly lastBound:        string | null      // actionId — flash feedback

  // ── Actions (CRUD) ──
  bind:        (binding: KeyBinding) => void
  unbind:      (layer: LayerId, key: KeyCode) => void
  bindChord:   (chord: ChordBinding) => void
  unbindChord: (chordId: string) => void
  clearLayer:  (layer: LayerId) => void
  resetToDefaults: () => void

  // ── Runtime ──
  handleKeyDown: (code: KeyCode, e: KeyboardEvent, held: ReadonlySet<KeyCode>) => void
  handleKeyUp:   (code: KeyCode, e: KeyboardEvent, held: ReadonlySet<KeyCode>) => void
  releaseAll:    () => void
  wasLastEventConsumed: () => boolean

  // ── Learn ──
  enterLearnMode: () => void
  exitLearnMode:  () => void
  startListeningSlot: (layer: LayerId, key: KeyCode) => void
  cancelListening:    () => void
}
```

---

## 2. The Layer Stack — Modal Operator Semantics

### 2.1 El modelo de capas (la idea clave)

KeyForge **no** es 100+ atajos sueltos. Es un teclado con **6 caras** que el operador rota con la mano izquierda mientras la derecha dispara.

```
                       ┌─────────────────────┐
                       │   LAYER STACK       │
                       │                      │
   forge (F2 toggle)─▶ │  ╔═══════════════╗   │
                       │  ║ Editor mode    ║   │
                       │  ╚═══════════════╝   │
                       │      kinetic (hold K)│
                       │  ╔═══════════════╗   │
                       │  ║ WASD = pan/tilt║   │
                       │  ╚═══════════════╝   │
                       │       select (hold S)│
                       │  ╔═══════════════╗   │
                       │  ║ 1-9 = groups   ║   │
                       │  ╚═══════════════╝   │
                       │          cmd (hold ⌘)│
                       │  ╔═══════════════╗   │
                       │  ║ Vim-style verbs║   │
                       │  ╚═══════════════╝   │
                       │           alt (hold ⎇)│
                       │  ╔═══════════════╗   │
                       │  ║ Macros & Vibes ║   │
                       │  ╚═══════════════╝   │
                       │         base (always) │
                       │  ╔═══════════════╗   │
                       │  ║ Effects + Drop ║   │
                       │  ╚═══════════════╝   │
                       └─────────────────────┘
                       Topología: layers se aplican
                       en orden de hold; última gana.
```

### 2.2 Resolución de Layer (`LayerResolver`)

```ts
// src/keyforge/layerResolver.ts
const LAYER_PRIORITY: readonly LayerId[] = [
  'forge',   // editor mode supera todo (toggle, no hold)
  'kinetic', // hold K
  'select',  // hold S
  'cmd',     // hold Ctrl/Cmd
  'alt',     // hold Alt
  'base',    // fallback
]

export function resolveActiveLayer(
  held: ReadonlySet<KeyCode>,
  forgeMode: boolean,
): LayerId {
  if (forgeMode) return 'forge'
  if (held.has('K') && held.has('Shift')) return 'kinetic'   // K+Shift evita
                                                              // confundir K-tap=cue-go
  if (held.has('S') && held.size > 1) return 'select'
  if (held.has('Control') || held.has('Meta')) return 'cmd'
  if (held.has('Alt')) return 'alt'
  return 'base'
}
```

> **Decisión de UX:** Layers `kinetic` y `select` requieren tecla *pivot* (`K`, `S`) en lugar de un modificador genérico. Esto deja `Shift`, `Ctrl`, `Alt` libres para *combinatoria fina* dentro de cualquier layer (ej. `Shift+1` en base = "tap 1 sin clear previous selection").

### 2.3 Visual feedback de Layer

Una barra inferior fija (8px alto) cambia de color según el layer activo:

| Layer | Color neon | Glow intensity |
|---|---|---|
| `base` | `#0f0f12` (off — invisible) | 0% |
| `alt` | `#a855f7` (purple) | 60% |
| `cmd` | `#22d3ee` (cyan) | 80% |
| `select` | `#fbbf24` (gold) | 90% |
| `kinetic` | `#22c55e` (green — match ROLE_NEON) | 90% |
| `forge` | `#ec4899` (magenta, pulsing) | 100% |

Esto da feedback periférico sin obstruir la UI principal. El operador *siente* qué cara del teclado tiene activa sin mirar.

---

## 3. The Combat Layout — Default Battle Plan

> **Manifiesto:** Un operador no debería levantar las manos de la zona `WASD ↔ 1-9 ↔ Space` durante un drop. Todo lo crítico cae en 3 filas físicas.

### 3.1 Layer `base` (default — sin modificadores)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BASE LAYER — Default                                 │
│                                                                              │
│  Esc   F1=Help  F2=KeyForge  F3=MIDI  F4=Forge   F5=Reload                  │
│  ─────────────────────────────────────────────────────────────              │
│  `   1   2   3   4   5   6   7   8   9   0   -   =   ⌫                      │
│     [G1] [G2] [G3] [G4] [G5] [G6] [G7] [G8] [G9] [ALL]                      │
│       ▲ Numbers = INSTANT GROUP RECALL (tap = select+go)                    │
│                                                                              │
│  Tab  Q   W   E   R   T   Y   U   I   O   P   [   ]                         │
│       [DIM↓][FLOW][DIM↑][REW][TAP][YIELD][   ][   ][CUE-][CUE+]              │
│                                                                              │
│  Caps A   S   D   F   G   H   J   K   L   ;   '   Enter                     │
│       [AI*][SEL*][DARK][STROBE][GO][HOLD][JOIN][KIN*][LIVE][CUE-NEXT]        │
│                                                                              │
│  Sh   Z   X   C   V   B   N   M   ,   .   /   Shift                         │
│       [UNDO][CUT][COPY][VIBE-][VIBE+][NUKE][MAGIC][TEMPO][TAP][PANIC]        │
│                                                                              │
│              ─────────── SPACE = DROP / BLACKOUT-TOGGLE ───────────          │
│                                                                              │
│  Arrow keys: ◄ ▼ ▲ ► = Time-scrub on cue / fixture-cycle / preset-cycle      │
└─────────────────────────────────────────────────────────────────────────────┘

  *  = Pivot key (hold para abrir su Layer)
```

**Highlights del layout `base`:**

| Tecla | Acción | actionId | Behavior | Nota |
|---|---|---|---|---|
| `Space` | **DROP** — Blackout-toggle táctico | `arb-blackout` | tap | El gesto más universal. Tap durante el drop = blackout instantáneo. |
| `F` | **STROBE** | `fx-strobe_storm` | hold | Hold para mantener el strobe activo solo mientras la tecla esté abajo. *Momentary trigger* — release apaga. |
| `G` | **GO** | `ctrl-cue-go` | tap | Avanza al siguiente cue de la lista. Vocabulario MA3. |
| `B` | **NUKE GOLD** | `tung-nuke-all` | tap | Big Bang dorado del Tungsten. La N de "Nuclear". |
| `N` | **MAGIC** | `fx-oro_solido` | tap | El "yo no sé qué hacer, sorpréndeme" del 100% de los operadores. |
| `M` | **TAP TEMPO** | `ctrl-tap-tempo` | tap | Cada tap registra un beat. 4 taps → BPM seteado. |
| `,` | **TEMPO −1** | `ctrl-tempo-nudge-down` | repeat 100ms | Ajuste fino. |
| `.` | **TEMPO +1** | `ctrl-tempo-nudge-up` | repeat 100ms | Ajuste fino. |
| `/` | **PANIC** | `arb-kill-effects` | tap | Cancela TODOS los efectos en curso. |
| `1`-`9` | Group recall instantáneo | `sel-group-N` | tap | Tap = clear+select. Shift+N = additive select. |
| `0` | Select ALL fixtures | `sel-all` | tap | |
| `Q` / `E` | Dimmer −10% / +10% del Grand Master | `ctrl-intensity-nudge-down/up` | repeat 80ms | Mano izquierda controla luminancia mientras la derecha dispara. |
| `W` | Trigger "Flow" effect (Selene IA) | `fx-tidal_wave` | tap | |
| `R` | Rewind 1 cue | `ctrl-cue-rewind` | tap | |
| `T` | TAP en metronomo principal | `ctrl-tap-tempo-master` | tap | Duplicado de `M` por preferencia ergonómica. |
| `Y` | Y de "Yield" — pausa IA Selene | `ctrl-ai-toggle` | toggle | |
| `D` | DarkSpin manual — fuerza dimmer=0 sin blackout total | `arb-darkspin` | hold | Útil durante transit de movers. |
| `H` | Hold current state — congela el frame actual | `arb-freeze-frame` | toggle | "Snapshot vivo": congela DMX hasta nuevo hold. |
| `J` | Join — agrega último fixture clickeado a la selección | `sel-add-last` | tap | |
| `L` | Live mode — overlay HUD con valores DMX en tiempo real | `ui-toggle-live-hud` | toggle | |
| `V` / `C` | Vibe `−` / `+` (cicla vibe profiles) | `vibe-prev/next` | tap | |

### 3.2 Layer `alt` (hold `Alt`)

Foco: **macros, vibes, escenas guardadas**. Cuando el operador suelta Alt, vuelve a `base`.

```
Alt + 1-9      → Recall vibe slot (`vibe-slot-1` … `vibe-slot-9`)
Alt + Q-P      → Recall macro slot 1-10 (`macro-slot-N`)
Alt + A-L      → Recall preset slot 1-9 (`preset-slot-N`)
Alt + Z-M      → Quick-fire signature effects (`fx-corazon_latino`, `fx-cumbia_moon`, …)
Alt + Space    → "Smart drop" — Selene IA elige el mejor drop según vibe actual
Alt + Enter    → Save current state to next free slot (UI prompt para confirmar)
```

### 3.3 Layer `select` (hold `S`)

Foco: **multi-selección compleja**. La idea es que `S` es el verbo "Select" y los siguientes inputs son objetos.

```
S + 1-9        → Pick group N (replace current selection)
S + Shift + N  → Add group N to selection (additive)
S + Ctrl + N   → Subtract group N from selection
S + A          → Select All
S + I          → Invert selection
S + ~          → Clear selection
S + Arrow      → Cycle through fixtures (left/right) o groups (up/down)
S + M          → Movers only
S + P          → PARs only
S + W          → Washes only
S + B          → Beams only
```

### 3.4 Layer `kinetic` (hold `K + Shift`)

Foco: **control directo de pan/tilt de la selección**. Se eleva la jugabilidad a nivel FPS.

```
K + WASD       → Pan/Tilt continuo (mientras la tecla esté held, el mover se mueve)
                 W = tilt up, S = tilt down, A = pan left, D = pan right
                 Speed = inversamente proporcional a tiempo held (carga progresiva)
K + Q/E        → Roll/rotation continuo (para fixtures con rotation channel)
K + R          → Reset to home position (pan=128, tilt=128)
K + F          → Focus to "center stage" (IK target = posición central calibrada)
K + 1-9        → Recall posición guardada N
K + Shift + N  → Save current pan/tilt as position N
K + Space      → Pan/tilt FOLLOW mode: el cursor del mouse arrastra los movers
                 hasta release de Space (modo "spotlight follow")
```

> **Truco letal:** Mantener `K` + `W` durante 800ms = el sistema interpreta "charge move" → el tilt sube **a velocidad máxima permitida** (con airbag respetado). Soltar la tecla detiene el movimiento. Esto reemplaza el joystick de un Avo Quartz.

### 3.5 Layer `cmd` (hold `Ctrl` / `Cmd`)

Foco: **sintaxis posfija estilo GrandMA3**. Para usuarios pro que vienen de consolas.

```
Ctrl + G + 1 + Enter   → "Group 1"  — equivalente al MA3 `Group 1 Please`
Ctrl + F + 5 + Enter   → "Fixture 5"
Ctrl + S + 3 + Enter   → "Store cue 3"
Ctrl + C + 2 + Enter   → "Copy cue 2"
Ctrl + D + 4 + Enter   → "Delete cue 4"
Ctrl + Backspace       → Clear command line
```

Hay una **barra de comando** flotante (estilo MA3) que se materializa al entrar al layer cmd y desaparece al soltar Ctrl si no se completó el comando.

```
┌──────────────────────────────────────────────────────┐
│  ▸ Group 1 _                                          │
└──────────────────────────────────────────────────────┘
```

---

## 4. Chords & Modifiers — Fighting Game Logic

### 4.1 El principio: el teclado piensa en *intenciones combinadas*

Inspiración explícita: **Tekken**. En Tekken, `1` es jab y `2` es punch, pero `1+2` es throw. No es la suma de las acciones; es una **acción tercera** con identidad propia.

**KeyForge implementa el mismo principio** con `ChordBinding`. La clave es que **un chord cancela las acciones individuales de sus componentes** si todas las teclas están held cuando se dispara la última.

### 4.2 Ejemplo canónico: `1 + F`

| Estado | Resultado |
|---|---|
| Tap `1` solo | Selecciona grupo 1 (`sel-group-1`) |
| Tap `F` solo | Dispara strobe en selección actual (`fx-strobe_storm`) |
| Hold `1`, después tap `F` | **CHORD:** dispara strobe SOLO en grupo 1, **sin modificar la selección activa**. Al release `F` y `1`, la selección previa permanece intacta. |
| Tap `1`, después tap `F` | Selecciona grupo 1, luego strobe sobre grupo 1 (modificó la selección). |

### 4.3 Detección de chord — algoritmo

```ts
// src/keyforge/chordMatcher.ts
function detectChord(
  newKey: KeyCode,
  held: ReadonlySet<KeyCode>,
  layer: LayerId,
  chords: readonly ChordBinding[],
): ChordBinding | null {
  // El "ancla" es la última tecla presionada (newKey).
  // Para que un chord dispare, TODAS sus keys deben estar held AHORA mismo.
  for (const chord of chords) {
    if (chord.layer !== layer && chord.layer !== 'base') continue
    if (!chord.keys.includes(newKey)) continue
    if (chord.keys.every(k => k === newKey || held.has(k))) {
      return chord
    }
  }
  return null
}
```

**Garantías:**
1. **Orden-independiente:** `1` luego `F` ≡ `F` luego `1`. El chord se evalúa cuando se presiona la **última** tecla.
2. **Cancela individuales:** si `1+F` mapea a un chord, ni `1` ni `F` dispararon sus acciones solitarias mientras esperaban al partner.
3. **Latencia controlada:** existe una ventana `CHORD_WINDOW_MS = 150ms`. Si pasaron > 150ms entre `1↓` y `F↓`, se interpreta como tap + tap separado, no como chord. Esto evita falsos positivos en operadores lentos.

### 4.4 Charge moves

```ts
{ kind: 'charge', thresholdMs: 800 }
```

Una tecla con behavior `charge` distingue entre tap (< threshold) y hold (≥ threshold). El `chargeBuffer` del store almacena el `tStart` de cada tecla held. En el `keyup`, si `now - tStart >= thresholdMs`, dispara la versión **charged**; si no, la versión **light**.

Ejemplo:
```ts
bindings: [
  { layer: 'base', key: 'B', actionId: 'tung-petal-l',
    behavior: { kind: 'charge', thresholdMs: 600 } },
]

// Resolución al keyup:
//   - held < 600ms  → `tung-petal-l` (single burst)
//   - held ≥ 600ms  → `tung-nuke-all` (Big Bang dorado)
```

El **payload** del chord incluye la duración del charge, para que el dispatcher pueda escalar intensidad:
```ts
window.lux.aether.fireTungstenNuke({ target: 'all', value: chargeRatio }) // 0..1
```

### 4.5 Repeat moves (Vim-style `5j`)

```ts
{ kind: 'repeat', periodMs: 80 }
```

Útil para `Q`/`E` (nudge dimmer), `<`/`>` (nudge tempo), arrow keys (scrub cue). Mientras la tecla esté abajo, dispara la acción cada `periodMs` con `intensityRamp` opcional.

### 4.6 Combo grammar — Vim-inspired prefixes (Layer `cmd`)

En `cmd`, KeyForge interpreta secuencias como **verbo + objeto + sufijo**:

```
Ctrl + [verb] + [object_number] + Enter
        │           │              └─ commit
        │           └─ ID numérico
        └─ G=Group, F=Fixture, S=Store, C=Copy, D=Delete, R=Recall

Ejemplos:
  Ctrl G 1 Enter       → Group 1 Please
  Ctrl S C 3 Enter     → Store Cue 3
  Ctrl D G 5 Enter     → Delete Group 5
  Ctrl C C 2 At 7 Enter → Copy Cue 2 At Cue 7  (sintaxis MA3 completa)
```

Esto es **opt-in** (solo si el operador entra al `cmd` layer). Los demás siguen viviendo en el mundo `tap`.

---

## 5. The Action Bus — Bridging KeyForge & MidiActionRegistry

### 5.1 El catálogo unificado

> **Principio:** Un efecto se registra UNA VEZ. Puede ser disparado desde MIDI, desde teclado, desde MQTT, desde un cue. El `MidiActionRegistry.ts` se renombra conceptualmente a **`ActionRegistry`** (mismo archivo, ampliación de naming):

```ts
// src/midi/MidiActionRegistry.ts → conceptualmente: src/actions/ActionRegistry.ts
// (alias re-export para no romper imports legacy en MIDI)

export interface ActionMeta extends MidiActionMeta {
  // ── NUEVOS CAMPOS WAVE 4800 ──
  /** ¿La acción acepta payload de intensidad (charge moves)? */
  readonly acceptsIntensity?: boolean
  /** ¿La acción es seguro disparar en chord (no rompe selección)? */
  readonly chordSafe?: boolean
  /** ¿Default suggested key (para autopopular el layout default)? */
  readonly defaultKey?: { layer: LayerId; key: KeyCode }
}
```

### 5.2 Dispatcher unificado

```ts
// src/actions/dispatchAction.ts
export interface ActionPayload {
  readonly source:    'midi' | 'keyforge' | 'cue' | 'osc' | 'mqtt'
  readonly intensity: number          // 0..1 (charge ratio o velocity)
  readonly target?:   readonly CellKey[]  // si proviene de chord con selección scoped
  readonly modifiers?: ModifierState  // útil para diferenciar Shift+key
}

export function dispatchAction(actionId: string, payload: ActionPayload): void {
  // Prefix routing — idéntico al de useMidiLearn (líneas 203-289).
  // Esta función ABSORBE el código que hoy vive in-line en useMidiLearn.dispatchToStore.
  // Resultado: una sola tabla de dispatch consume MIDI y teclado.

  if (actionId.startsWith('fx-')) {
    const effectId = actionId.slice(3)
    window.lux.forceStrike({
      effect:    effectId,
      intensity: payload.intensity,
      scope:     payload.target,        // ★ ESTO ES LA CLAVE DEL CHORD ★
    })
    return
  }
  // ... vibe-*, arb-*, tung-*, sel-*, kin-*, ctrl-* …
}
```

**Lo crucial:** el campo `scope` del `forceStrike` permite que un chord `1+F` dispare strobe **solo sobre el grupo 1** sin tocar la selección persistente. Hoy el `forceStrike` no acepta scope; **WAVE 4800-D extiende el contrato IPC** para aceptar este parámetro opcional (default = selección actual).

### 5.3 Migración del MidiLearn dispatcher

```
ANTES (WAVE 2047):
  useMidiLearn.dispatchToStore() ─→ window.lux.*

DESPUÉS (WAVE 4800):
  useMidiLearn.dispatchToStore() ─┐
                                  ├─→ dispatchAction() ─→ window.lux.*
  useKeyForge.dispatchKey()       ─┘
```

`useMidiLearn.dispatchToStore` se reduce a **3 líneas**:
```ts
const dispatchToStore = useCallback((controlId, msg) => {
  const intensity = msg.type === 'cc' ? msg.value / 127 : 1.0
  dispatchAction(controlId, { source: 'midi', intensity })
}, [])
```

> **Beneficio colateral:** desbloquea trivialmente futuras integraciones (OSC, MQTT, gamepad).

---

## 6. The Key-Learn Overlay — Holographic Keyboard

### 6.1 La visión

Cuando el operador presiona `F2`, la pantalla se atenúa al 30% y emerge un **teclado holográfico 3D** ocupando el viewport. Cada tecla es un cubo de neon con altura proporcional a su uso reciente (heatmap). El layer activo se elige con un selector circular (radial menu) en el centro.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⌨ KEYFORGE LEARN MODE                              ESC to exit · F1 help    │
│                                                                              │
│  ┌──── LAYER SELECTOR ────┐    ┌──── DRAG ACTIONS HERE ──────────────────┐  │
│  │   ◉ base               │    │  🎚 GRAND MASTER                         │  │
│  │   ○ alt                │    │  🎚 SATURATION                           │  │
│  │   ○ cmd                │    │  💣 STROBE STORM    ⚡ NEON BLINDER       │  │
│  │   ○ select             │    │  💥 SOLAR FLARE      ☢️ TIDAL WAVE        │  │
│  │   ○ kinetic            │    │  🎭 FIESTA LATINA   🌃 TECHNO CLUB        │  │
│  │   ○ forge              │    │  💛 NUKE GOLD       💛 PETAL LEFT/CENTER  │  │
│  └────────────────────────┘    └─────────────────────────────────────────┘  │
│                                                                              │
│  ┌─── KEYBOARD HOLOGRAM ────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │     ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌──┐           │   │
│  │     │`│ │1│ │2│ │3│ │4│ │5│ │6│ │7│ │8│ │9│ │0│ │-│ │= │           │   │
│  │     └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └──┘           │   │
│  │          🟢G1 🟢G2 🟢G3 🟢G4 ─── ─── ─── ─── ─── 🟡ALL                │   │
│  │                                                                       │   │
│  │      ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐           │   │
│  │      │Q│ │W│ │E│ │R│ │T│ │Y│ │U│ │I│ │O│ │P│ │[│ │]│ │\│           │   │
│  │      └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘           │   │
│  │      🔵DIM↓ 🟣FLOW 🔵DIM↑ ─── 🟢TAP ─── ─── ─── ─── ─── ─── ─── ─── │   │
│  │                                                                       │   │
│  │       ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌──────┐         │   │
│  │       │A│ │S│ │D│ │F│ │G│ │H│ │J│ │K│ │L│ │;│ │'│ │ENTER │         │   │
│  │       └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └──────┘         │   │
│  │       🟡AI* 🟡SEL* 🟠DARK 🔴STROBE 🟢GO ─── ─── 🟡KIN* ─── ─── ─── ─── │
│  │                                                                       │   │
│  │  ┌────┐  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐  ┌─────────┐     │   │
│  │  │Shft│  │Z│ │X│ │C│ │V│ │B│ │N│ │M│ │,│ │.│ │/│  │  Shift  │     │   │
│  │  └────┘  └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘  └─────────┘     │   │
│  │           ──── ──── ──── 🎭VIBE 💛NUKE 🌟MAGIC 🥁TAP ─── ─── 🚨PNC   │   │
│  │                                                                       │   │
│  │             ┌──────────────────────────────────────────────┐         │   │
│  │             │         SPACEBAR — DROP (Blackout)           │         │   │
│  │             └──────────────────────────────────────────────┘         │   │
│  │                                                                       │   │
│  │   Legend:                                                             │   │
│  │   🔴 critical  🟡 pivot/mode  🟢 selection  🔵 continuous  🟣 vibe   │   │
│  │   🟠 darkroom  💛 tungsten  🚨 panic  ⬛ unassigned                   │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  TIP: Drag any action from the right panel onto a key. Right-click a key     │
│       to unbind. Tap a key on your physical keyboard to highlight it.        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Interacciones de la Forge Overlay

| Acción del operador | Resultado |
|---|---|
| **Click sobre tecla vacía** | "Listening… presiona algo en el catálogo o teclado físico para asignar". |
| **Drag acción → tecla** | Bind directo. Flash verde + sonido sutil. |
| **Tecla en teclado físico** | Highlight la tecla en pantalla. Si Listening está activo, dispara la asignación con la última acción seleccionada. |
| **Right-click sobre tecla** | Menú contextual: `Unbind`, `Change behavior`, `Mark as chord-anchor`. |
| **Hold modifier físico** | Cambia el layer mostrado. El operador puede mantener `Alt` para ver/editar el layout `alt`. |
| **Shift+drag entre teclas** | Mueve un binding de una tecla a otra. |
| **Doble-click tecla** | Abre panel de detalle: behavior (tap/hold/charge), required modifiers, chord membership. |
| **`/` para buscar acción** | Foco en searchbar; resultado filtrado en panel derecho. |

### 6.3 Chord builder visual

En el panel derecho hay una sub-sección **"CHORDS"** donde el operador puede construir chords arrastrando 2-4 teclas a una "constellation":

```
┌─────── NEW CHORD ────────┐
│                           │
│      ┌───┐    ┌───┐       │
│      │ 1 │ ╳  │ F │       │
│      └───┘    └───┘       │
│       ──────────           │
│       Action: ▼ Strobe    │
│       Behavior: ▼ tap     │
│       [Save chord]         │
└───────────────────────────┘
```

### 6.4 Heatmap (sintonía con la mano)

Mientras el operador trabaja (fuera de forge mode), KeyForge cuenta cuántas veces cada tecla se ha disparado en las últimas 24h. En forge mode, cada cubo de tecla tiene **altura proporcional al log del uso**. Esto revela:
- Teclas frías → candidatas a re-mapear con acciones críticas.
- Teclas calientes → no tocarlas, ya están en músculo.

> **Easter egg:** después de 100 horas registradas, KeyForge sugiere un "**Personal Loadout**" optimizado para los patrones del operador. Esto es un *bait* para que el usuario se identifique con su instrumento.

---

## 7. Persistence & Profiles — Multi-Show Loadouts

### 7.1 Profiles (loadouts)

```ts
export interface KeyForgeLoadout {
  readonly id:          string                  // 'tungsten-stadium-v3'
  readonly name:        string                  // "Tungsten Stadium V3"
  readonly description?: string
  readonly bindings:    readonly KeyBinding[]
  readonly chords:      readonly ChordBinding[]
  readonly createdAt:   number
  readonly updatedAt:   number
  /** Hash del set de actionIds disponibles cuando se guardó — para detectar drift. */
  readonly capabilityHash: string
}
```

**Operaciones:**
- `Ctrl+Shift+S` (en forge mode) → guardar loadout actual.
- `Ctrl+Shift+L` → abrir loadout picker.
- Loadouts se serializan a `~/luxsync/keyforge-loadouts/*.json`.
- Al cargar, se compara `capabilityHash`: si cambió (ej. un effectId fue eliminado), KeyForge muestra un wizard "**Re-bind missing actions**".

### 7.2 Defaults — el "Stadium" loadout

KeyForge embarca **3 loadouts curados** por defecto:

| Loadout | Filosofía | Para quién |
|---|---|---|
| **`stadium-default`** | El descrito en §3. WASD libre, 1-9 = grupos, F = strobe, Space = drop. | Operadores de eventos en vivo. |
| **`bedroom-producer`** | 1-9 = vibes, QWERTY = efectos por zona energética (peak→silence). Sin layers complejos. | DJs/productores en sala. |
| **`grandma-vim`** | Vacío en `base` (forzar uso del layer `cmd`). Sintaxis posfija total. | Pros que vienen de MA3/GMA. |

El operador puede importar/exportar loadouts vía JSON (`Ctrl+Shift+E`).

---

## 8. Safety & Anti-Patterns

### 8.1 Reglas de oro

| # | Regla | Justificación |
|---|---|---|
| **R1** | KeyForge **NUNCA** intercepta `Escape`, `F1`, `F5` de manera bloqueante. Estas siempre llegan al navegador o modal activo. | Escape natural. Una tecla atascada que mate `Escape` deja al operador sin escape. |
| **R2** | Layer `forge` **NO DISPARA** acciones de show. Mientras estás editando, ninguna tecla puede causar blackout. | Evita catástrofes al re-mapear. |
| **R3** | `Space` como blackout requiere doble confirmación si **lastBlackout < 500ms**. | Evita "espasmo de blackout" durante pánico. |
| **R4** | Chord moves **NUNCA** sobreviven a un `blur` window. | Si el operador hace Alt+Tab con `1+F` held, el chord se cancela. |
| **R5** | `repeat: true` del browser **siempre se descarta**. KeyForge implementa su propio repeat. | Autorepeat del SO es inconsistente entre OSes. |
| **R6** | Layer changes NUNCA cancelan acciones `hold` en curso. Si tienes `F` held y entras a layer `alt`, el strobe sigue activo. | "Modifier mid-action" es un caso real (operadores buscan macro mientras strobe está on). |
| **R7** | Layout `kinetic` requiere `K + Shift` (no solo `K`). | `K` solo es muy fácil de presionar accidentalmente. La doble tecla baja el riesgo. |

### 8.2 Anti-patrones declarados (NO HACER)

- ❌ **No usar `e.key`** — depende del layout del SO. Siempre `e.code` normalizado.
- ❌ **No persistir `heldKeys` ni `chargeBuffer`** — son transient.
- ❌ **No leer/escribir el store dentro del listener** sin pasar por `useKeyMapStore.getState()`. React subscriptions reactivas en un listener son una receta para race conditions.
- ❌ **No usar `KeyboardEvent.keyCode`** — deprecated.
- ❌ **No mapear acciones críticas (blackout, panic) a teclas que requieran modificador**. El operador en pánico solo dispondrá de teclas simples.
- ❌ **No permitir loops infinitos de layers.** El layer `forge` no puede contener bindings que entren a layer `forge`.

### 8.3 Defensa contra IME (Input Method Editor)

En sistemas con IME activo (japonés, chino, coreano), `keydown` puede llegar **antes** de que el IME compose el caracter final. Detección:

```ts
window.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return  // IME en proceso → no interceptar
  // ... resto del flow
})
```

---

## 9. Roadmap & Definition of Done

### 9.1 Fases de implementación

| Fase | Alcance | LOC aprox | Riesgo | Dependencias |
|---|---|---|---|---|
| **4800-A** | `keyMapStore.ts` + `KeyCode`/`LayerId`/`KeyBinding` types. Persistencia básica con Zustand. | 350 | Bajo | — |
| **4800-B** | `keyForgeLoop.ts` + `captureGuard.ts` + `layerResolver.ts`. Loop sin dispatch real (solo logging). | 300 | Bajo | A |
| **4800-C** | Refactor `useMidiLearn.dispatchToStore` → `dispatchAction()` compartido. Migración del catálogo. | 250 | **Alto** | A — toca código vivo. |
| **4800-D** | Extender IPC `forceStrike` con `scope?: CellKey[]`. Backend support para chord scoping. | 200 | Medio | C |
| **4800-E** | `chordMatcher.ts` + charge moves + repeat moves. | 350 | Medio | B, C |
| **4800-F** | Default loadout (`stadium-default`) cableado y testeable. | 200 | Bajo | E |
| **4800-G** | `KeyForgeOverlay.tsx` (holographic keyboard) + chord builder + heatmap. | 700 | Medio | F |
| **4800-H** | Loadouts (save/load/export/import) + capability hash. | 250 | Bajo | F |
| **4800-I** | Vitest property tests: chord detection, layer resolution, capture guard. | 300 | Bajo | E |

### 9.2 Definition of Done

WAVE 4800 se considera **HECHA** cuando se cumplen los 9 criterios:

1. ✅ **El default loadout `stadium-default`** está cargado al primer arranque. Un operador nuevo puede disparar Strobe (`F`), Drop (`Space`), Group 1 (`1`), Nuke Gold (`B`) sin configurar nada.
2. ✅ **Captura global no interfiere con inputs.** Test E2E: escribir el nombre de un fixture incluyendo `Space`, `1-9`, `F` no dispara ninguna acción.
3. ✅ **Layers funcionan con feedback visual.** Hold Alt → barra inferior purple. Hold S → barra gold. Release → vuelve a base.
4. ✅ **Chord `1+F` dispara strobe SOLO en grupo 1**, dejando la selección persistente intacta. Verificable en `useSelectionStore`.
5. ✅ **Charge `B` < 600ms vs ≥ 600ms** dispara `tung-petal-l` vs `tung-nuke-all` respectivamente.
6. ✅ **KeyForge Overlay (`F2`)** permite drag-and-drop de cualquier acción del `ActionRegistry` sobre cualquier tecla, en cualquier layer.
7. ✅ **`useMidiLearn` y KeyForge comparten `dispatchAction()`**. No hay dispatch duplicado. Un nuevo effect aparece en MIDI y en KeyForge al mismo tiempo (single source of truth).
8. ✅ **Loadout export/import funcional.** `Ctrl+Shift+E` produce JSON portable que otro operador puede cargar.
9. ✅ **`tsc --noEmit`** = 0 errores. **Vitest** verde sobre chord detection, layer resolution, capture guard.

---

## Apéndice A — La poesía del producto

> Cuando el operador presione `B` durante 1.2 segundos antes de soltar, el Tungsten no le va a dar un *burst*. Le va a dar **el Big Bang dorado** que el escenario merece. Y mientras tanto, la barra de feedback va a llenarse de oro hasta saturarse, igual que el medidor de un Hadouken en Street Fighter.
>
> Cuando mantenga `K+Shift` con la mano izquierda y mueva los movers con `WASD` con la derecha como si estuviera mirando alrededor en un FPS, va a sentir que el escenario es su mapa. Los 8 ojos del rig son **su** mirada.
>
> Cuando deje los dedos en reposo sobre `ASDF` y `Space` al alcance del pulgar, va a saber que tiene la mano sobre un instrumento — no sobre un periférico genérico que cualquier hijo de vecino tiene.
>
> Eso es KeyForge. No es un mapeador. Es **una postura**.

---

## Apéndice B — Inspiraciones reconocidas

- **GrandMA3 Command Wing** — sintaxis posfija, ejecutores numerados, vocabulario `Group N Please`.
- **Vim / Kakoune** — modales, verbos+objetos, repeat-counts.
- **Tekken 8 / Street Fighter 6** — chord cancels, charge moves, frame data thinking.
- **Cyberpunk 2077 Quickhacks** — capas de neuro-shortcut que reinterpretan la siguiente entrada.
- **FL Studio Performance Mode** — layout de pads contextual por escena.
- **Ableton Push** — modes (clip/note/device) con pivot key.
- **Avolites Quartz** — playbacks fader + go button como vocabulario de show.
- **HTML5 Web MIDI API** — patrón `addEventListener` + ref-based dispatch (ya usado en `useMidiLearn.ts`).

---

*Master Blueprint V1 — congelado en WAVE 4800.*
*KeyForge transforma el teclado del operador en un Command Wing. El show necesita más que botones; necesita una postura.*
*Próximo paso: implementación de la fase 4800-A (store + types).*
