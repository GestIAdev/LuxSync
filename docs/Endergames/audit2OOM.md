El `useMIDIClock` solo maneja clock/transport. Necesito encontrar el handler principal de MIDI para CC/notes/pads — ese es el que podría estar inundando React:

`useMidiLearn.ts` — este es el handler principal de CC/notes/pads. Tiene 7 matches. Veamos:

Ahora necesito verificar dos cosas críticas: (1) si `controlStore.setGlobalIntensity` dispara IPC o re-renders sin throttle, y (2) si hay conflicto entre los dos handlers `onmidimessage`:

Ahora déjame verificar quién subscribe a `globalIntensity` en React (para medir el impacto de los re-renders) y si hay conflicto entre los dos handlers:

Ahora veamos quién usa los selectores y si hay componentes que subscriben a `flowParams` (que cambia con cada CC de speed/spread):

Ahora verifiquemos si `useMIDIClock` activa sus listeners solo cuando se habilita, o si siempre está escuchando:

Ahora busquemos si hay MIDI procesado en el main process y enviado via IPC al renderer:

Ahora veamos el `MIDIClockSlave.ts` — este es el que recibe MIDI clock de un dispositivo externo y podría estar en el path del OOM:

El `MIDIClockSlave` emite 'sync' en CADA pulso de clock (56Hz). Veamos quién escucha ese evento:

Verifiquemos si el preload escucha `midi-master:pulse` y si hay algún bridge que reenvía MIDI del main al renderer:

Tengo toda la información. Déjame también verificar si hay algún throttle en el lado del `controlStore` para los `console.log`:

---

# REPORT: OPERACIÓN "MIDI FLOOD" — Auditoría de Hardware

## Veredicto Ejecutivo

**El MIDI NO es la causa primaria del CppHeap OOM.** El sistema tiene protecciones razonables contra spam de hardware. Las allocaciones C++ que genera son modestas (~112-168 objetos/segundo) comparadas con la FixtureLayer gradient storm (288,000/segundo) que ya parcheamos. Sin embargo, hay **3 issues reales** que contribuyen al presión sostenida sobre Oilpan.

---

## 1. Caza de Spam en el Input MIDI

### `useMidiLearn.ts` — Handler principal de CC/Notes/Pads

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useMidiLearn.ts" lines="97-146" />

**Filtrado de system messages: ✅ CORRECTO**

La función `parseMidiMessage` tiene un switch sobre `statusType = status & 0xF0` con cases solo para `0x80` (Note Off), `0x90` (Note On) y `0xB0` (CC). Todo lo demás (0xF0+) cae al `default: return null`:

| Mensaje | Status | ¿Filtrado? |
|---------|--------|------------|
| 0xF8 Timing Clock | 0xF8 → statusType 0xF0 | ✅ `return null` |
| 0xFE Active Sensing | 0xFE → statusType 0xF0 | ✅ `return null` |
| 0xF0 SysEx | 0xF0 → statusType 0xF0 | ✅ `return null` |
| 0xFA Start / 0xFC Stop | 0xFA → statusType 0xF0 | ✅ `return null` |

**Parser zero-allocation: ✅ CORRECTO**

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useMidiLearn.ts" lines="83-88" />

`_reusableMsg` es un objeto pre-alocado a nivel módulo, mutado in-place en cada mensaje. Cero allocaciones JS por mensaje MIDI.

**Debounce/throttle en CC continuos: ⚠️ AUSENTE**

No existe ningún mecanismo de debounce o throttle. Si un fader físico envía 300 CC/segundo, `dispatchToStore` se llama 300 veces/segundo. El soft-takeover (`checkSoftTakeover`) filtra algunos mensajes cuando el fader no ha "alcanzado" el valor digital, pero durante un sweep activo la mayoría pasan.

---

## 2. Inundación del Puente IPC (Node → Chromium)

### MIDI Clock Master — `main.ts` → IPC → Renderer

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts" lines="1094-1105" />

**IPC a 56Hz: ⚠️ PRESENTE pero acotado**

Cuando MIDI Clock Master está activo, `mainWindow?.webContents.send('midi-master:pulse', midiByte)` envía **56 IPC messages/segundo** (24ppq @ 140BPM). Cada `webContents.send` crea un objeto C++ IPC message en el renderer. El renderer los recibe via `MIDIClockMaster.ts` línea 255 y los reenvía a MIDI outputs con un buffer pre-asignado — cero allocaciones adicionales.

**MIDI CC/Notes NO van por IPC: ✅ CORRECTO**

Los eventos CC/Note se procesan enteramente en el renderer via Web MIDI API (`navigator.requestMIDIAccess`). No hay `webContents.send('midi-event', ...)` para mensajes de control. Solo los eventos discretos (`forceStrike`, `setVibe`, `setBlackout`) generan IPC, y estos son note_on (discretos), no continuos.

---

## 3. Impacto en el State de React

### `controlStore.setGlobalIntensity` — Sin throttle, con console.log

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/stores/controlStore.ts" lines="397-401" />

**Re-renders: ✅ NO HAY storm**

`useFixtureRender` (único subscriber de `globalIntensity`/`globalSaturation`/`flowParams`) está definido pero **no importado por ningún componente**. El TacticalCanvas renderiza via OffscreenCanvas worker, no via React per-fixture. Los `set()` de Zustand no disparan re-renders porque no hay subscribers.

**console.log spam: 🔴 ISSUE REAL**

`setGlobalIntensity` y `setGlobalSaturation` llaman `console.log` en CADA invocación. Durante un fader sweep a 300 CC/segundo:
- 300 `console.log`/segundo
- Cada `console.log` crea un **C++ string en el devtools protocol layer** (V8 inspector)
- Cada `console.log` con template string crea además un JS string concatenado

`setFlowParams` es peor: crea un **nuevo objeto** `{ ...current, ...params }` + `console.log('[ControlStore] 🌊 Flow params updated:', updated)` que serializa el objeto entero.

### `MIDIClockSlave.resetTimeout` — 56 setTimeout/segundo

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/protocols/MIDIClockSlave.ts" lines="355-365" />

**Timer churn: ⚠️ ISSUE MENOR**

Cada pulso de clock (56Hz @ 140BPM) llama `resetTimeout()` que hace `clearTimeout` + `setTimeout`. Esto crea **56 C++ timer objects/segundo** en Blink's timer heap. Son short-lived (cleared en el siguiente pulso) pero es presión continua.

### `useMIDIClock.resetClockTimeout` — Mismo patrón

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/hooks/useMIDIClock.ts" lines="146-159" />

Idéntico: 56 setTimeout + 56 clearTimeout/segundo cuando MIDI Clock está activo.

---

## 4. Bug Arquitectural: Dual-Handler Conflict

**🔴 BUG: `useMidiLearn` y `useMIDIClock`/`MIDIClockSlave` compiten por `input.onmidimessage`**

Ambos hooks asignan `input.onmidimessage` a sus propios handlers:
- `useMidiLearn` línea 475: `input.onmidimessage = handleMidiMessage`
- `useMIDIClock` línea 292: `input.onmidimessage = (event) => { ... }`
- `MIDIClockSlave` línea 239: `input.onmidimessage = (event) => this.handleMessage(event)`

El último en montar **sobrescribe** al anterior. Cuando MIDI Clock mode se activa, `useMidiLearn` se deshabilita silenciosamente — todos los CC/note messages se pierden. No es causa de OOM pero es un bug funcional.

---

## Tabla Resumen de Allocaciones C++ (Oilpan)

| Fuente | Objetos C++/seg | Condición | Severidad |
|---------|-----------------|-----------|-----------|
| FixtureLayer gradients (YA FIXEADO) | 288,000 | 200 fixtures @ 60fps | 🔴 CRÍTICA |
| `controlStore` console.log | ~300 | Fader sweep activo | 🟡 MODERADA |
| `MIDIClockSlave.resetTimeout` | 112 | MIDI Clock Slave activo | 🟡 MODERADA |
| `useMIDIClock.resetClockTimeout` | 112 | MIDI Clock hook activo | 🟡 MODERADA |
| MIDI Master IPC pulse | 56 | MIDI Master mode activo | 🟢 BAJA |
| `MIDIMessageEvent` (browser) | 300-500 | Active Sensing controller | 🟢 BAJA (browser-level) |

**Total MIDI (peor caso, todos activos simultáneamente):** ~680-980 objetos C++/segundo — **300x menor** que la FixtureLayer gradient storm que ya eliminamos.

---

## Conclusión

El MidiRegistry **NO está desprotegido** contra spam de hardware:
- ✅ System messages (clock, active sensing, sysex) filtrados en el parser
- ✅ Parser zero-allocation con objeto pre-asignado
- ✅ Store access via refs, sin re-renders
- ✅ CC/Notes no van por IPC

Pero tiene **3 issues reales** que contribuyen al presión sostenida:
1. 🔴 `console.log` en `setGlobalIntensity`/`setGlobalSaturation`/`setFlowParams` — C++ strings a 300Hz durante fader sweeps
2. ⚠️ Timer churn en `resetTimeout` — 112 C++ timer objects/segundo cuando MIDI Clock está activo
3. ⚠️ Sin debounce/throttle en CC continuos — no causa OOM directo pero desperdicia CPU

**Recomendación:** El issue #1 (console.log spam) es el más impactante y fácil de fixear. Los issues #2 y #3 son optimizaciones secundarias que se pueden abordar después.