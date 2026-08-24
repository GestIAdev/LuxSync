Vamos a explorar el undo/redo de Hephaestus y la barra de herramientas del Chronos:

Tengo todo el contexto. El undo/redo de Hephaestus usa Immer patches con `produceWithPatches`/`applyPatches` — muy eficiente. Pero ChronosStore es una clase (no Zustand) y los clips viven en `useTimelineClips` (React state). Voy a implementar un sistema de snapshots manuales más simple que se adapte a esta arquitectura.

Primero déjame leer `useTimelineClips.ts` completo para entender todos los mutadores y cómo integrar el historial:

Ahora veo el TransportBar para saber exactamente dónde añadir los botones:

Ahora veo cómo se renderiza el TransportBar en ChronosLayout:

Ahora tengo todo. Voy a crear un hook `useChronosHistory` que envuelve `useTimelineClips` y añade undo/redo con snapshots. Es el enfoque más limpio: intercepta los mutadores y guarda snapshots del array de clips antes de cada operación.

Ahora cambio `ChronosLayout.tsx` para usar `useChronosHistory` en vez de `useTimelineClips`:

Ahora encuentra dónde se llama `useTimelineClips` en ChronosLayout:

Ahora añado los atajos de teclado Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. Déjame ver el hook de keyboard existente:

Voy a añadir undo/redo al keyboard hook. Primero añado las props opcionales:

Ahora añado el destructuring y los casos en el switch:

Ahora añado los casos `z`/`y` en el switch. Déjame ver el final del switch:

Añado los casos `z`/`y` antes del cierre del switch:

Ahora añado `onUndo` y `onRedo` al array de dependencias del effect:

Ahora veo cómo se llama `useTimelineKeyboard` en ChronosLayout para añadir `onUndo`/`onRedo`:

Ahora añado los botones al TransportBar. Primero las props:

Ahora veo el destructuring de props en el componente:

Ahora añado los botones en la zona central, después del BPM group y antes del MIDI Clock:

Ahora añado los estilos CSS para los botones. Déjame ver el CSS del TransportBar:

Añado los estilos después de `.ct-bpm-adj:hover`:

Ahora paso las props `onUndo`/`onRedo`/`canUndo`/`canRedo` al `TransportBar` desde `ChronosLayout`:

TypeScript limpio. Ahora los tests:

Listo. Resumen completo:

---

## WAVE 7565.4: THE TIME TRAVELER — Undo/Redo Complete

### 1. `useChronosHistory.ts` — El hook del historial

**Archivo nuevo:** `src/chronos/hooks/useChronosHistory.ts` <ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\hooks\useChronosHistory.ts" />

Wraps `useTimelineClips` y añade undo/redo con snapshots del array de clips.

**Diseño inspirado en Hephaestus** (200-step limit, `HistoryFrame` con `undo`/`redo`/`label`), pero adaptado a la arquitectura de Chronos (React `useState` en vez de Zustand/Immer):

- **`HISTORY_LIMIT = 200`** — mismo límite que Hephaestus
- **Snapshots completos del array de clips** (no Immer patches) — los clips son pequeños (<2KB cada uno), 200 snapshots ≈ 40MB max
- **`pushHistory(label, beforeClips)`** — captura el estado "antes", usa `setTimeout(0)` para capturar el "después" de que React procese el `setClips`
- **`undo()` / `redo()`** — mueven frames entre las stacks y restauran el array de clips
- **`setClips`** (load/new project) — **limpia ambas stacks** (no es undoable, sería confuso deshacer una carga de proyecto)

**Mutadores envueltos** (todos los destructivos):
`addClip`, `removeClip`, `updateClip`, `deleteSelected`, `moveClip`, `resizeClip`, `duplicateClip`, `cloneClip`, `duplicateSelected`, `pasteClips`, `splitClipAtTime`, `createClipFromDrop`

### 2. `ChronosLayout.tsx` — Integración

Cambié `useTimelineClips` → `useChronosHistory` (una sola línea de cambio, la interfaz es compatible):

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\ChronosLayout.tsx" lines="55-57" />
<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\ChronosLayout.tsx" lines="176" />

Y pasé las props al `TransportBar`: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\ChronosLayout.tsx" lines="1377-1385" />

### 3. `useTimelineKeyboard.ts` — Shortcuts

Añadí `onUndo` / `onRedo` opcionales y los casos en el switch: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\hooks\useTimelineKeyboard.ts" lines="225-247" />

| Shortcut | Acción |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+Shift+Z` | Redo (alternativa) |

Y wired en `ChronosLayout`: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\ChronosLayout.tsx" lines="1305-1310" />

### 4. `TransportBar.tsx` — Botones UI

**Props añadidas:** `onUndo`, `onRedo`, `canUndo`, `canRedo`

**Botones renderizados** en la zona central, entre el BPM y el MIDI Clock: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\transport\TransportBar.tsx" lines="614-638" />

Usan los símbolos Unicode ⏪ (undo) y ⏩ (redo), con estado `disabled` cuando no hay nada que deshacer/rehacer.

**CSS** en `TransportBar.css`: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\transport\TransportBar.css" lines="502-544" />

### Verificación

| Check | Result |
|-------|--------|
| `tsc --noEmit` | exit 0, zero errors |
| 14 test files | 273/273 passed |