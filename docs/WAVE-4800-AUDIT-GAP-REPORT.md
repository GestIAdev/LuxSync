# WAVE 4800 — KEYFORGE AUDIT & GAP REPORT

> Fecha: 2026-05-18
> Estado: Fases A–F cerradas / G–I parciales

---

## 1. Resumen Ejecutivo

| Fase | Blueprint | Estado | Nota |
|---|---|---|---|
| **4800-A** | Store + types | **✅ DONE** | `keyMapStore.ts` + `keyforge/types.ts` — persistencia, CRUD bindings/chords, learn mode |
| **4800-B** | Loop + capture + resolver | **✅ DONE** | `useKeyboardCortex.ts` montado en `AppCommander.tsx`, captura global activa |
| **4800-C** | Refactor `dispatchAction` compartido | **🟡 PARTIAL** | `KeyActionDispatcher.ts` existe y funciona, pero `useMidiLearn.dispatchToStore` sigue siendo independiente (no consume `dispatchAction`) |
| **4800-D** | Extender IPC `forceStrike` con `scope` | **❌ MISSING** | `window.lux.forceStrike` no acepta `scope?: CellKey[]`; chords disparan sin scoping real |
| **4800-E** | Chord matcher + charge/repeat | **✅ DONE** | `chordMatcher.ts` con ventana temporal, `charge` y `repeat` ejecutan en `useKeyboardCortex` |
| **4800-F** | Default loadout | **✅ DONE** | `stadiumLoadout.ts` aplica 37 bindings + 2 chords al boot si store vacío |
| **4800-G** | Holographic overlay + learn UI | **🟡 PARTIAL** | `KeyForgeOverlay.tsx` (~830 LOC) renderiza teclado QWERTY en tiempo real, pero **falta heatmap, drag-and-drop, chord builder visual** |
| **4800-H** | Loadouts multi-profile + export/import | **❌ MISSING** | No hay concepto de `KeyForgeLoadout` múltiple, ni export/import JSON, ni `capabilityHash` |
| **4800-I** | Vitest property tests | **❌ MISSING** | Zero tests en `src/keyforge/__tests__/` |

---

## 2. Qué SÍ está implementado

### Core runtime (fases A–F)
- `src/stores/keyMapStore.ts` — Zustand con persistencia `localStorage` (`luxsync-keyforge`).
- `src/keyforge/types.ts` — `KeyCode`, `LayerId`, `KeyBinding`, `ChordBinding`, `KeyBehavior`, `ActionPayload`.
- `src/keyforge/normalizeKeyCode.ts` — Normalización de `KeyboardEvent.code` → `KeyCode` (layout-independent).
- `src/keyforge/captureGuard.ts` — 5 anillos defensivos (IME, editable tags, contenteditable, bypass, claim).
- `src/keyforge/layerResolver.ts` — Resolución de layer en tiempo real (`base` → `alt` → `cmd` → `select` → `kinetic` → `forge`).
- `src/keyforge/chordMatcher.ts` — Detección de chords con ventana temporal `CHORD_WINDOW_MS = 150`.
- `src/keyforge/KeyActionDispatcher.ts` — Dispatch unificado con routing por prefijo (`fx-*`, `vibe-*`, `sel-*`, `kin-*`, `cue-*`, `ui-*`, `arb-*`, `tung-*`).
- `src/keyforge/stadiumLoadout.ts` — Loadout `stadium-default` con 37 bindings y 2 chords.
- `src/hooks/useKeyboardCortex.ts` — Hook global montado en `AppCommander.tsx`; maneja keydown/keyup/blur, behaviors (tap/hold/toggle/momentary/charge/repeat), chord suppression.

### UI de overlay (fase G parcial)
- `src/components/KeyForgeOverlay.tsx` — Teclado QWERTY visual funcional:
  - Color coding por action family (`fx-*` naranja, `sel-*` verde, etc.).
  - Tabs de layer (base / alt / kinetic / select / cmd / forge).
  - Click en tecla → `onBind` (enter learn mode con action armada).
  - Right-click → `onUnbind`.
  - Pulse animation en `listeningSlot`.
  - `ActionPalette.tsx` — Panel lateral con acciones filtrables por categoría.

---

## 3. Gaps por fase

### 3.1 Fase 4800-C — Dispatch unificado (🟡)

**Problema:** `useMidiLearn.ts` no usa `dispatchAction`. Tiene su propio `dispatchToStore` inline.

```ts
// En useMidiLearn.ts (no auditado en este reporte):
dispatchToStore(controlId, msg) → window.lux.* directo
// Ideal:
dispatchAction(controlId, { source: 'midi', intensity: msg.value/127 })
```

**Impacto:** Un nuevo effect registrado en `MidiActionRegistry` aparece en KeyForge, pero un binding MIDI y un binding KeyForge del mismo efecto todavía usan pipelines ligeramente diferentes.

### 3.2 Fase 4800-D — IPC `forceStrike` con `scope` (❌)

**Problema:** El blueprint §5.2 dice:
> "el campo `scope` del `forceStrike` permite que un chord `1+F` dispare strobe **solo sobre el grupo 1**"

Hoy `KeyActionDispatcher.ts`:
```ts
lux?.forceStrike?.({ effect: effectId, intensity: payload.intensity })
```
No existe `scope` en la firma IPC.

**Impacto:** Los chords de `stadiumLoadout.ts` (`1+F`, `2+F`) disparan strobe sobre la selección actual, no sobre el grupo del chord. Esto rompe el DoD #4 del blueprint.

### 3.3 Fase 4800-G — Overlay holográfico (🟡)

**Lo que falta:**

| Feature | Estado | Nota |
|---|---|---|
| Drag-and-drop acción → tecla | **❌** | `ActionPalette` muestra acciones, pero no hay `onDragStart`/`onDrop` en `KeyCell` |
| Chord builder visual | **❌** | No hay UI para construir chords arrastrando teclas a una "constellation" |
| Heatmap de uso | **❌** | No se trackea uso de teclas ni se renderiza altura proporcional al log |
| Panel de detalle (doble-click) | **❌** | No hay modal para cambiar `behavior` o `requiredMods` de una tecla |
| Overlay como floating (no view) | **❌** | Hoy `KeyForgeOverlay.tsx` es una página/view, no un overlay translúcido que se monta sobre la UI con `position: fixed` |
| Feedback de layer (barra inferior) | **❌** | No hay barra de 8px que cambie de color según layer activo |

### 3.4 Fase 4800-H — Loadouts multi-profile (❌)

**Lo que falta:**
- Interface `KeyForgeLoadout` no existe en código.
- No hay múltiples loadouts (`stadium-default`, `bedroom-producer`, `grandma-vim`).
- No hay save/load/export/import JSON.
- No hay `capabilityHash` ni wizard de "Re-bind missing actions".
- Atajos `Ctrl+Shift+S` (save) y `Ctrl+Shift+E` (export) no implementados.

### 3.5 Fase 4800-I — Tests (❌)

**Lo que falta:**
- `src/keyforge/__tests__/captureGuard.test.ts`
- `src/keyforge/__tests__/layerResolver.test.ts`
- `src/keyforge/__tests__/chordMatcher.test.ts`
- `src/keyforge/__tests__/normalizeKeyCode.test.ts`
- `src/keyforge/__tests__/KeyActionDispatcher.test.ts` (mock de `window.lux`)
- `src/keyforge/__tests__/stadiumLoadout.test.ts`

---

## 4. Otros gaps menores

| Gap | Archivo(s) | Nota |
|---|---|---|
| `ctrl-*` / `flow-*` / `lux-*` solo loguean | `KeyActionDispatcher.ts:449-461` | Acciones como `ctrl-intensity`, `ctrl-tap-tempo` emiten `console.log` pero no disparan nada real |
| `kf-*` meta actions solo loguean | `KeyActionDispatcher.ts:487-496` | `kf-toggle-learn`, `kf-save-loadout` sin implementar |
| `sel-add-last` skipped | `KeyActionDispatcher.ts:143` | Requiere contexto de puntero (último fixture clickeado) |
| Numpad no mapeado | `normalizeKeyCode.ts` | `Numpad1`..`Numpad9` caen en fallback (aceptado pero no ideal) |

---

## 5. Ruta sugerida para cerrar G–I

```
4800-G.1 — Transformar KeyForgeOverlay en overlay flotante (position: fixed)
4800-G.2 — Agregar drag-and-drop entre ActionPalette y KeyCell
4800-G.3 — Agregar chord builder visual (panel "NEW CHORD" con 2-4 slots)
4800-G.4 — Agregar panel de detalle al doble-click (behavior selector)
4800-G.5 — Agregar barra de feedback de layer (8px, color por layer)
4800-G.6 — Agregar heatmap (tracking de uso en keyMapStore + altura visual)

4800-H.1 — Definir KeyForgeLoadout interface + persistencia
4800-H.2 — Agregar loadout picker (save/load/switch)
4800-H.3 — Agregar export/import JSON + Ctrl+Shift+E
4800-H.4 — Agregar capability hash + wizard de drift detection

4800-I.1 — Tests de captureGuard (focus detection, IME, always-intercept)
4800-I.2 — Tests de layerResolver (prioridad, pivot keys, modifiers)
4800-I.3 — Tests de chordMatcher (ventana temporal, specificity, order-independent)
4800-I.4 — Tests de KeyActionDispatcher (mock window.lux, prefix routing)
4800-I.5 — Tests de stadiumLoadout (idempotencia, bindings aplicados)
```

---

## 6. Veredicto

> **Fases A–F están esencialmente terminadas.** El motor de KeyForge (store, loop, dispatch, chords, loadout default) está vivo y operativo en producción.
>
> **Fases G–I quedan abiertas.** El overlay visual existe y es funcional para learn-mode básico, pero le faltan las interacciones avanzadas (drag, chord builder, heatmap). Los loadouts múltiples y los tests son las piezas más grandes que faltan para declarar WAVE 4800 como **DONE** según el Definition of Done del blueprint.
