







Now let me check the keyboard dispatcher path — how `KeyActionDispatcher` sends actions:

Now let me check how `window.lux` (the preload bridge) sends these to main — is it `ipcRenderer.send` or `ipcRenderer.invoke`:

Now let me check the Aether IPC handler side — does `setBlackout` write directly to the NodeArbiter (no round-trip to React)?

Now I have the complete picture. Let me check one more thing — the `onTruthUpdate` listener that sends truth back to React, to confirm the round-trip:

Now let me check how the TickEngine sends truth/hot-frames back to the renderer:

I now have the complete architectural picture. Here's the report:

---

# REPORTE ARQUITECTURAL: X-RAY DE RUTAS DE INPUT — WAVE 7592

## 1. Ruta del Teclado / UI Click (El "Double Ping-Pong IPC")

### Flujo completo:

```
Teclado Físico
    │
    ▼
┌─────────────────────────────────────────┐
│  RENDERER (React Main Thread)           │
│                                         │
│  window.addEventListener('keydown')     │
│    → useKeyboardCortex.ts               │
│    → KeyActionDispatcher.dispatch()     │
│    → window.lux.aether.setBlackout()    │  ← llama al preload bridge
│              │                          │
│  UI Click (mouse)                       │
│    → BlackoutButton onClick             │
│    → window.lux.aether.setBlackout()    │  ← mismo bridge
└──────────┬──────────────────────────────┘
           │
           │  ipcRenderer.invoke('lux:aether:setBlackout', { active })
           │  ← PROMESA (async/await) — espera respuesta del Main
           │
           ▼
┌─────────────────────────────────────────┐
│  MAIN PROCESS (Node.js)                 │
│                                         │
│  ipcMain.handle('lux:aether:setBlackout')│
│    → AetherIPCHandlers.ts               │
│    → arbiter.setBlackout(active)        │  ← escribe en NodeArbiter L4
│    → return { success: true, ... }      │  ← RESPONDE al renderer
└──────────┬──────────────────────────────┘
           │
           │  return value via ipcRenderer.invoke resolve
           │
           ▼
┌─────────────────────────────────────────┐
│  RENDERER (React Main Thread)           │
│                                         │
│  .then((result) => {                    │
│    useEffectsStore.setBlackout(result)  │  ← setState Zustand → RE-RENDER
│  })                                     │
└─────────────────────────────────────────┘
```

### Características críticas:

- **`ipcRenderer.invoke()`**: cada acción de teclado/UI usa `invoke` (no `send`). Esto significa que **cada input crea una promesa que espera una respuesta del Main process**. Es un round-trip completo Renderer → Main → Renderer.
- **Re-render React**: la respuesta del Main dispara `setBlackout()` en Zustand, que notifica a los suscriptores y dispara re-renders de React. Si el renderer está lagging, esta promesa se acumula en el microtask queue.
- **Canales IPC identificados**:
  - `lux:aether:setBlackout` → blackout toggle
  - `lux:forceStrike` → disparar efectos
  - `lux:setVibe` → cambio de vibe
  - `lux:cancel-all-effects` → kill all
  - `lux:arbiter:setGrandMaster` → grand master fader
  - `lux:aether:setSelInhibit` → selection kill
  - `lux:aether:fireTungstenNuke` → tungsten nuke

- **Round-trip confirmado (Double Ping-Pong)**: Sí. El input va al Main via IPC, el Main escribe en el NodeArbiter, y luego **responde** al renderer, que hace `setState` → re-render. La luz cambia en el siguiente frame del TickEngine (que lee el NodeArbiter), pero el renderer también recibe el `selene:truth` broadcast a ~7Hz que confirma el estado. Hay **dos viajes** por cada input.

## 2. Ruta del Hardware Pad / MIDI (El "Fast Track")

### Flujo completo:

```
MIDI Controller (USB)
    │
    ▼
┌─────────────────────────────────────────┐
│  RENDERER (React Main Thread)           │
│                                         │
│  navigator.requestMIDIAccess()          │  ← Web MIDI API (Chromium native)
│  input.onmidimessage = handler          │  ← callback SÍNCRONO del navegador
│    → parseMidiMessage(data)             │  ← zero-alloc, reutiliza _reusableMsg
│    → dispatchToStore(controlId, msg)    │
│                                         │
│  ┌── PREFIX ROUTING ──────────────────┐ │
│  │                                    │ │
│  │  fx-*  → window.lux.forceStrike()  │ │  ← IPC invoke (mismo path que teclado)
│  │  vibe-* → window.lux.setVibe()     │ │  ← IPC invoke
│  │  arb-* → window.lux.aether.*       │ │  ← IPC invoke
│  │  tung-* → window.lux.aether.*      │ │  ← IPC invoke
│  │                                    │ │
│  │  ctrl-* → controlStore.set*()      │ │  ← ZUSTAND DIRECTO (sin IPC!)
│  │  flow-* → controlStore.set*()      │ │  ← ZUSTAND DIRECTO (sin IPC!)
│  │  lux-*  → luxSyncStore.set*()      │ │  ← ZUSTAND DIRECTO (sin IPC!)
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Características críticas:

- **MIDI NO usa SAB**: el MIDI pad **NO** escribe directamente al SharedArrayBuffer ni al NodeArbiter. Usa la **Web MIDI API** (`navigator.requestMIDIAccess`), que es una API nativa de Chromium que se ejecuta en el renderer process.

- **MIDI SÍ pasa por el renderer**: el callback `onmidimessage` se dispara en el hilo del renderer. Pero es **síncrono y nativo** — no atraviesa la barrera IPC para llegar al renderer. Es Chromium quien lo entrega directamente.

- **Split de rutas según prefix**:
  - **`fx-*`, `vibe-*`, `arb-*`, `tung-*`**: usan `window.lux.*` → `ipcRenderer.invoke()` → **mismo IPC path que el teclado**. Estos inputs SÍ hacen round-trip.
  - **`ctrl-*`, `flow-*`, `lux-*`**: escriben **directamente en Zustand stores** (`controlStore.setGlobalIntensity()`, etc.) **sin IPC**. El cambio se aplica en el renderer instantáneamente. El backend lo recoge en el siguiente `selene:truth` broadcast o cuando el renderer envía el estado via otro canal.

- **NO hay bypass total**: la hipótesis del usuario es **parcialmente correcta**. El MIDI pad no escribe al SAB directamente, pero los faders CC (`ctrl-intensity`, `ctrl-saturation`, `flow-speed`) **escriben directo a Zustand sin IPC**, lo que es efectivamente un "fast track" que evita el round-trip. Los botones (`fx-*`, `arb-*`) sí usan IPC como el teclado.

- **Zero-alloc hot path**: `parseMidiMessage` reutiliza un objeto `_reusableMsg` pre-asignado. No hay allocation por mensaje MIDI. Esto es significativamente más barato que el path del teclado, que crea closures y promesas en cada input.

## 3. Vector de Bottleneck / Crash (El "Efecto Tsunami")

### Confirmación: SÍ, el renderer bloqueado puede causar un tsunami IPC.

```
Timeline durante lag severo del renderer:

t=0s    Operador machaca teclado → 50 keydown events en 2s
        │
        ├─ Cada keydown → KeyActionDispatcher → window.lux.aether.setBlackout()
        ├─ Cada invoke() crea una PROMESA pendiente en el microtask queue
        ├─ El renderer está bloqueado renderizando → no procesa .then()
        ├─ Las promesas se acumulan: 50 promesas pendientes
        │
t=2s    El renderer desbloquea (termina el render)
        │
        ├─ Las 50 promesas resuelven EN CASCADA (microtask queue drain)
        ├─ Cada .then() → useEffectsStore.setBlackout() → ZUSTAND setState
        ├─ 50 setStates en un solo frame → 50 re-renders en cascada
        ├─ Los re-renders bloquean el renderer OTRA VEZ
        ├─ Nuevos keydowns se acumulan durante el re-render
        ├─ Ciclo repetitivo → "Tsunami Effect"
        │
t=4s    El main thread del renderer colapsa por GC pressure +
        re-render flooding → crash o freeze
```

### Por qué el MIDI pad NO crashea:

1. **Faders CC (`ctrl-*`)**: escriben directo a Zustand con `controlStore.setGlobalIntensity()`. No crean promesas IPC. Aunque el renderer esté lagging, el `onmidimessage` callback se ejecuta síncronamente (es nativo de Chromium, no pasa por el event loop de React). El `setState` de Zustand es O(1) — no bloquea.

2. **Soft Takeover**: el MIDI hook tiene un filtro de soft takeover que **rechaza** mensajes CC cuando el fader físico no coincide con el digital (±5). Esto actúa como un **rate limiter natural** — durante lag, los faders que no se mueven físicamente no generan eventos.

3. **Zero-alloc**: `parseMidiMessage` no crea objetos. El path del teclado crea closures (`useCallback`), promesas (`invoke`), y objetos de respuesta por cada input.

4. **Botones MIDI (`fx-*`, `arb-*`)**: estos SÍ usan IPC como el teclado, pero un pad físico típicamente envía 1-2 eventos por tap (note_on + note_off), mientras que un teclado en autorepeat puede generar 30+ eventos/segundo. El volumen es fundamentalmente diferente.

### Resumen comparativo:

| Característica | Teclado/UI | MIDI Faders (CC) | MIDI Botones |
|---|---|---|---|
| Transporte | IPC `invoke` (round-trip) | Zustand directo (sin IPC) | IPC `invoke` (round-trip) |
| Promesas por input | 1 (async/await) | 0 | 1 (async/await) |
| Re-render React | Sí (`.then()` → setState) | Sí (setState directo) | Sí (`.then()` → setState) |
| Rate limiter natural | No (autorepeat del browser filtrado, pero el dispatcher puede re-disparar) | Sí (soft takeover ±5) | No (pero volumen bajo) |
| Allocation por input | Closure + Promesa + objeto respuesta | 0 (reutiliza `_reusableMsg`) | Closure + Promesa + objeto respuesta |
| Escribe al SAB | No | No | No |
| Bypass del renderer | No | Parcial (síncrono nativo, pero en renderer thread) | No |

### Conclusión:

El crash vector es el **Tsunami de Promesas IPC** en el path del teclado. Cuando el renderer se bloquea, los `ipcRenderer.invoke()` se acumulan como promesas pendientes. Al desbloquear, todas resuelven en cascada, disparando N setStates que re-bloquean el renderer. El MIDI pad no crashea porque (a) los faders CC bypass IPC via Zustand directo, (b) soft takeover filtra eventos redundantes, y (c) el volumen de eventos por tap es ~10x menor que el autorepeat del teclado.

**Nadie escribe al SAB directamente** — ni teclado ni MIDI. El SAB (`window.glass`) es un canal **unidireccional Main → Renderer** para el photonic egress. Los inputs siempre van por IPC o Zustand, nunca por SAB.