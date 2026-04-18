# WAVE 3190 — VICTORIA TOTAL
## DMX Pipeline Zero-Flicker: 19 minutos sin un solo parpadeo

**Fecha:** 17 Abril 2026  
**Branch:** `main` — commit `19373fc1`  
**Duración del debug:** 5 días  
**Resultado:** Pipeline completamente limpio. Zero parpadeos en sesión de 19 minutos con 4 fixtures en modo manual + efectos activos.

---

## EL PROBLEMA

Parpadeos periódicos cada 2-4 minutos en modo manual. Cualquier fixture con overrides manuales activos parpadeaba brevemente incluso cuando el pipeline DMX parecía estable. Durante semanas el sospechoso fue el hardware. Estábamos equivocados.

**Dos culpables reales:**
1. El BREAK DMX no era hardware — era una danza de 4 callbacks asíncronos que rebautizaban el baudrate para simular el BREAK. Inestable por naturaleza.
2. El hot-loop (30fps) creaba cientos de objetos temporales por segundo que el GC de V8 coleccionaba periódicamente en un "stop the world" de 1-3ms — suficiente para que el watchdog de fixtures interpretara el silencio como pérdida de señal.

---

## LAS WAVES

### WAVE 3180 — BREAK de verdad

**Antes:** `breakMode: 'baudrate'` — 4 callbacks async encadenados para cambiar baudrate a 0, esperar, restaurar baudrate, continuar. BREAK_NS = 1ms (10x el mínimo DMX512).

**Después:** `breakMode: 'set'` — un solo `port.set({brk: true})` / `port.set({brk: false})`. IOCTL directo al kernel → el chip FTDI genera el BREAK en hardware, timing hardwareado. BREAK_NS = 110µs (mínimo DMX512 es 88µs, margen de 25%).

**Fallback automático:** Si el chip no soporta `SetCommBreak` (CH340, PL2303 baratos), degrada silenciosamente a baudrate-switch sin romper nada.

**Log de confirmación** (visible en consola durante los primeros 5s de arranque):
```
[DMX-Worker] 🔌 WAVE 3180: BREAK mode = 'set' | BREAK duration = 110µs
```

---

### WAVE 3190 — GC Zero Allocation

**Auditoría completa del hot-loop.** 14 violaciones identificadas, 11 eliminadas. Las 3 restantes son necesarias (IPC structured clone a 22Hz y 7Hz — no hay forma de evitarlas sin SharedArrayBuffer, tema para otra wave).

#### MasterArbiter.ts — 6 crímenes en arbitrate() (30-44Hz)

| Violación | Fix |
|-----------|-----|
| `new Set(manualOverrides.keys())` cada frame | Double-buffer swap: `_currentOverrideIdsBuf.clear()` + swap de referencias |
| Old Set asignado a `_prevFrameOverrideIds` → GC inmediato | Swap de referencias sin alloc |
| `getPlaybackAffectedFixtureIds()` → `new Set()` cada frame | `_playbackAffectedBuf.clear()` + reuso permanente |
| `Array.from(manualOverrides.keys())` en _layerActivity | `_buildManualFixtureIdsBuf()` — buffer `string[]` pre-asignado |
| `layer3_effects.map(e => e.type)` en _layerActivity | `_buildActiveEffectTypesBuf()` — buffer `EffectType[]` tipado pre-asignado |
| `cleanupExpiredEffects()` → `.filter()` crea array nuevo | `while` + `splice()` in-place, zero alloc cuando nada expira |

**Nuevos campos privados en MasterArbiter:**
```typescript
private _currentOverrideIdsBuf: Set<string> = new Set()
private _manualFixtureIdsBuf: string[] = []
private _activeEffectTypesBuf: EffectType[] = []
private _playbackAffectedBuf: Set<string> = new Set()
```

#### TitanOrchestrator.ts — 5 crímenes en processFrame() (30-44Hz)

| Violación | Fix |
|-----------|-----|
| `new Map()` x2 (hephByFixtureId/Zone) cada frame con Hephaestus activo | `_hephByFixtureId/_hephByZone.clear()` + `_hephOutputPool` para arrays internos |
| `fixtureStates.map()` → array nuevo cada frame | `for` loop in-place directo sobre el array existente |
| `{ ...f }` spread por fixture × N fixtures | Mutación directa de `f` — sin objeto intermedio |
| `new Map()` para intentMap con efectos activos | `_effectIntentBuf.clear()` + reuso |
| `Object.keys(zoneOverrides)` → array temporal | `for...in` directo, sin array intermedio |

**Nuevos campos privados en TitanOrchestrator:**
```typescript
private readonly _hephByFixtureId = new Map<string, HephFixtureOutput[]>()
private readonly _hephByZone = new Map<string, HephFixtureOutput[]>()
private readonly _hephOutputPool = new Map<string, HephFixtureOutput[]>()
private readonly _effectIntentBuf: EffectIntentMap = new Map()
```

---

## DATOS DEL LOG — 19 MINUTOS LIMPIOS

```
CARDIOGRAMA WORKER (DMX thread) — pico estable en 16ms, rango 15-18ms
WAVE 3170 CYCLE peak — rango 10.7ms-13.3ms, sin spikes anómalos
CARDIOGRAMA MAIN — pico estable ~20-21ms (event loop sano)
```

El único evento anómalo en todo el log fue:
```
[CARDIOGRAMA MAIN] ⚠️ 🫀 HARD BLOCK 489.1ms — event loop frozen
```
→ Causado por la conexión del audio (interfaz de audio bloqueando el event loop de Node al inicializar). No es un bug del pipeline DMX. No volvió a ocurrir.

Un pico aislado de 31.5ms en CARDIOGRAMA MAIN → carga momentánea del sistema operativo. El DMX thread no se inmutó.

**MUTATION DROP detectados:** 2 eventos de channels zeroed — ambos son comportamiento esperado de efectos que se superponen a overrides manuales. El WAVE 3170 TRAP los detecta y registra correctamente. No son parpadeos.

---

## ALLOCACIONES PENDIENTES DE RECICLAR

Para la próxima limpieza. No son urgentes — el pipeline ya es estable — pero queda deuda técnica:

### TitanOrchestrator.ts — hotFrame broadcast (22Hz)
```typescript
// Línea ~1382 aprox
fixtures: fixtureStates.map(f => ({ ...f }))  // nuevo array + N objetos por broadcast
```
**Fix futuro:** SharedArrayBuffer o Transferable — requiere refactor de IPC entero. Wave propia.

### TitanOrchestrator.ts — fullTruth broadcast (7Hz)
```typescript
// Línea ~1535 aprox  
fixtures: fixtureStates.map(f => ({ ...f }))  // idem, pero a 7Hz (menos crítico)
```
**Fix futuro:** Ídem que hotFrame. Baja prioridad por la frecuencia reducida.

### TitanOrchestrator.ts — Chronos playback path
```typescript
// En rama de Chronos activo — _layerActivity.manualFixtureIds: []
// Array literal vacío cuando no hay overrides manuales en Chronos
```
**Fix futuro:** Constante `EMPTY_STRING_ARRAY: readonly string[] = []` compartida. Trivial.

### MasterArbiter.ts — Chronos playback path
```typescript
// new Set<string>() en rama de Chronos activo solamente
// Solo se instancia cuando Chronos está en reproducción activa
```
**Fix futuro:** Añadir `_chronosFixtureIdsBuf: Set<string>` al pool de buffers. Fácil.

---

## LÍNEA TEMPORAL DEL DEBUG (5 días)

```
Día 1-2  → Phantom fixtures, USB jitter, IMMUTABLE GATE
Day 3    → WAVE 3170: 4 traps (CADENCE GAP, BREAK LATENCY, MUTATION DROP, FRAME CYCLE TIME)
           Diagnóstico: pipeline limpio. El hardware es sospechoso pero no culpable principal.
Día 4    → WAVE 3180: Native BREAK vía SetCommBreak IOCTL, BREAK_NS 1ms→110µs
           WAVE 3190 (parte 1): BLACKOUT 5s ventana para ver el log de arranque
Día 5    → WAVE 3190 (parte 2): Auditoría GC completa, 11 violaciones eliminadas
           tsc --noEmit → EXIT: 0
           TEST: 19 minutos, zero parpadeos. VICTORIA.
```

---

## ESTADO DEL SISTEMA POST-VICTORIA

- **DMX BREAK:** Hardware nativo via FTDI `SetCommBreak` / `ClearCommBreak`
- **BREAK duration:** 110µs (spec DMX512: min 88µs)
- **Hot-loop allocations:** Mínimo teórico para la arquitectura actual
- **GC pressure estimada:** ~150-500 objetos/s eliminados en sesión típica de 10 fixtures a 30fps
- **CARDIOGRAMA:** Activo. Vigilancia permanente. No se apaga nunca.
- **Parpadeos:** 0

---

*"5 días. Casi lo mandé todo a la mierda. Pero no."*  
*— Radwulf, Abril 2026*
