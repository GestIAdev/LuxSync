# WAVE 4871 — THEIA BRIDGE: DIAGNÓSTICO FORENSE Y BLUEPRINT CORRECTO

**Estado:** BLOQUEADO — NO EJECUTAR MISIÓN 2 HASTA RESOLVER  
**Emitido por:** PunkOpus (audit-first mode)  
**Fecha de audit:** 2026-05-26  
**Target:** TheiaEngineView / SeleneTheiaBridge / NodeArbiter

---

## 1. HALLAZGO CRÍTICO: EL NODEARBITER NO SABE NADA DE MÚSICA

La directiva WAVE 4871 propone:

> "Diseña el verdadero SeleneTheiaBridge. Debe suscribirse al flujo de Intents finales validados que emite el NodeArbiter."

**Esto es incorrecto. La evidencia del código:**

### Qué es un `INodeIntent` (fuente: `src/core/aether/intent-bus.ts`)

```typescript
export interface INodeIntent {
  readonly nodeId: NodeId          // ej. "fixture-42:color", "fixture-7:impact"
  readonly values: Readonly<Record<string, number>>  // ej. { r: 0.8, g: 0.1, b: 0.9, dimmer: 1.0 }
  readonly priority: number        // 0-99: L0 / 100-199: L1 / 200-299: L2 / 300-399: L3
  readonly confidence: number      // 0-1
  readonly source: IntentSource
  mergeStrategy?: MergeStrategy
}
```

Los `values` son canales DMX normalizados 0-1: `r`, `g`, `b`, `dimmer`, `strobe`, `shutter`, `pan`, `tilt`, `zoom`, `pan_base`, `tilt_base`, `pan_offset`, `tilt_offset`.

**No existe ningún campo `section`, `drop`, `ambient`, `buildup`, `sectionType`, ni nada de semántica musical en ningún `INodeIntent`.**

### Qué hace el NodeArbiter (fuente: `src/core/aether/NodeArbiter.ts`)

El NodeArbiter recibe intents de varias capas (L0 → IntentBus de los Systems, L1 → Selene IA overrides, L2 → Manual MIDI/OSC, L3 → Effects/Hephaestus, LP → Chronos playback) y los funde por canal usando LTP/HTP según el tipo de canal. Su output es un `ArbitratedNodeMap`: `Map<NodeId, Record<string, number>>` — valores DMX finales por nodo.

**El NodeArbiter opera en el dominio del hardware, no en el dominio cognitivo.** Procesa valores de canal de fixtures. No sabe nada de si estamos en un DROP o en un AMBIENT.

### Grep definitivo

```
grep "section|drop|ambient|buildup|sectionType|BrainFrameContext|SeleneTruth" NodeArbiter.ts
→ 1 resultado: un comentario mencionando "musical activo" en referencia a competencia L3 vs L0
```

**CONCLUSIÓN: Es arquitectónicamente imposible extraer "estamos en DROP" desde el NodeArbiter.** Quien lleva esa info es el `MusicalContext` que viene del Brain de Selene, ANTES del pipeline de Intents.

---

## 2. EL FLUJO REAL: DÓNDE VIVE LA INTELIGENCIA MUSICAL

```
Audio Input
    │
    ▼
[Selene Brain — 15 sub-motores]
    │  MusicalContext { section: { type: 'drop'|'buildup'|'verse'|... }, energy, bpm, ... }
    │
    ▼
TitanOrchestrator.processFrame()   ← AQUÍ ESTÁ LA INTELIGENCIA SEMÁNTICA
    │
    ├──► engine.update(context, audioMetrics) → LightingIntent
    │        │
    │        ▼
    │    [IntentBus / NodeArbiter]  ← Aquí ya NO hay semántica musical
    │        │
    │        ▼
    │    ArbitratedNodeMap (DMX values)
    │        │
    │        ▼
    │    HAL → ArtNet → Fixtures físicos
    │
    └──► SeleneTheiaBridge.notify(ctx)  ← WAVE 4869 hook, también en processFrame()
             │  BrainFrameContext { energy, sectionType, dropImminent, frameIndex }
             ▼
         ??? (broken — ver §3)
```

El único punto con acceso a `context.section?.type` (la semántica real) es `processFrame()` de `TitanOrchestrator`, que es donde WAVE 4869 puso correctamente el hook de notificación.

---

## 3. EL PROBLEMA REAL — ROTURA DE PROCESO

### Arquitectura de procesos en Electron

| Módulo | Proceso |
|--------|---------|
| `electron/main.ts` | **Main Process** |
| `TitanOrchestrator` | **Main Process** (importado por main.ts) |
| `TheiaWindowManager` | **Main Process** |
| `electron/preload.ts` | Bridge (contextBridge) |
| `src/components/views/TheiaEngineView/index.tsx` | **Renderer Process** |
| `src/theia/ThetaOrchestrator.ts` | **Renderer Process** |
| `src/theia/SeleneTheiaBridge.ts` | **Renderer Process** (módulo src/) |

### El bug de WAVE 4869

```typescript
// En TitanOrchestrator.ts (MAIN PROCESS):
import { type SeleneTheiaBridge } from '../../theia/SeleneTheiaBridge'

private _seleneThetaBridge: SeleneTheiaBridge | null = null

attachSeleneTheiaBridge(bridge: SeleneTheiaBridge): void {
  this._seleneThetaBridge = bridge  // ← nadie llama este método desde main
}
```

`attachSeleneTheiaBridge()` **nunca es llamado desde ningún lugar del proceso main**. No existe código en `electron/main.ts` que llame `titanOrchestrator.attachSeleneTheiaBridge(...)`. Por tanto `_seleneThetaBridge` es siempre `null` y el `notify()` en processFrame es dead code.

La razón: `getSeleneTheiaBridge()` y `getThetaOrchestrator()` son singletons del proceso renderer. No son accesibles desde main. Una instancia renderer de `SeleneTheiaBridge` que internamente llama `theta.forceState()` (renderer) **no puede vivir en el proceso main**.

### El bug de WAVE 4870

```typescript
// En TheiaEngineView/index.tsx (RENDERER):
const audio     = useTruthStore(selectAudio)      // llega via selene:truth IPC (~7Hz)
const sectionCtx = useTruthStore(selectSection)

useEffect(() => {
  if (!aiEnabled || !audio) return
  bridge.notify({ energy: audio.energy, sectionType: sectionCtx?.type, ... })
}, [aiEnabled, audio, sectionCtx])
```

**Dos problemas:**

1. **Frecuencia incorrecta**: `SeleneTruth` se broadcastea a ~7Hz. La `SeleneTheiaBridge` tiene `MIN_DWELL_TICKS = 26` frames calibrado para 44Hz (= 600ms). A 7Hz, 26 ticks = 3.7 segundos de hysteresis — completamente roto.

2. **Datos intermediados**: `SeleneTruth` es una serialización del state para el frontend — atraviesa IPC structured clone y React renders. El `context.section?.type` en `TitanOrchestrator.processFrame()` es el dato primario; `useTruthStore(selectSection)` es una copia degradada a 7Hz.

Este bloque de código ha sido eliminado del índice en esta WAVE.

---

## 4. EL PROBLEMA DE LA DIRECTIVA: EL INTENT NO ES EL TRIGGER

La directiva asume que el Intent del NodeArbiter "includes the DROP/AMBIENT info". El usuario tenía razón:

> "El intent solo procesa el .lfx y manda el efecto correspondiente de luz, color y movimiento a la UI y de ahí al hardware"

Un efecto `.lfx` disparado por Selene NO le dice al NodeArbiter "esto es un DROP". Le dice al pipeline Aether: "fixture X:color quiere r=1.0, g=0.0, b=0.5 con prioridad 300" (L3). Es semántica de hardware, no semántica de sección musical.

El trigger para Theia debe ser **el evento cognitivo** (Brain detecta DROP), no **el efecto de hardware** (NodeArbiter resuelve qué DMX mandar). Son dos cosas radicalmente distintas en el pipeline:

```
Brain → [detecta DROP] → efecto Selene se dispara → NodeArbiter → DMX → Fixture
                │
                └──► Theia debe escuchar AQUÍ (en Brain/context)
                     No aquí ──────────────────────────────────┘
```

---

## 5. PROPUESTA ARQUITECTÓNICA CORRECTA (PENDIENTE DE VALIDACIÓN)

### Principio

- La inteligencia semántica vive en `TitanOrchestrator.processFrame()` → `context.section?.type`
- El actuador vive en el renderer → `ThetaOrchestrator.forceState()`
- La frontera de proceso se cruza via IPC: `webContents.send` → `ipcRenderer.on`

### Componentes

#### A) Lógica de hysteresis + resolución en Main (sin bridge renderer)

Mover la lógica de `SeleneTheiaBridge` al interior de `TitanOrchestrator`, o crear una clase `TheiaStateResolver` puramente Main, que:
- Recibe `context.section?.type` + `context.energy` a 44Hz
- Aplica la hysteresis y confirmación (MIN_DWELL_TICKS, CONFIRMATION_TICKS)
- Cuando el estado resuelto cambia, llama al callback de IPC

```typescript
// Dentro de TitanOrchestrator, post-processFrame():
const resolvedState = this._theiaStateResolver.resolve(sectionType, energy, frameIndex)
if (resolvedState !== null) {
  this._theiaStateSendCallback?.(resolvedState) // → IPC
}
```

#### B) IPC send callback inyectado desde main.ts

```typescript
// En electron/main.ts, después de registerTitanOrchestrator():
titanOrchestrator.setTheiaStateSendCallback((state) => {
  mainWindow?.webContents.send('theia:force-state', state)
})
```

#### C) Preload expone el listener

```typescript
// En electron/preload.ts, dentro de window.electron.theia:
onForceState: (callback: (state: 'ambient' | 'buildup' | 'drop') => void) => {
  const handler = (_: Electron.IpcRendererEvent, state: string) => callback(state as any)
  ipcRenderer.on('theia:force-state', handler)
  return () => ipcRenderer.removeListener('theia:force-state', handler)
},
```

#### D) Receptor en Renderer: useEffect en TheiaEngineView

```typescript
useEffect(() => {
  if (!aiEnabled) return
  const theta = getThetaOrchestrator()
  // window.electron.theia.onForceState devuelve cleanup fn
  return window.electron.theia.onForceState((state) => {
    theta.forceState(state, { manual: false })
  })
}, [aiEnabled])
```

### Ventajas sobre el enfoque actual

| Criterio | WAVE 4869/4870 (roto) | WAVE 4871 propuesta |
|----------|----------------------|---------------------|
| Dónde vive la semántica | Renderer (SeleneTruth 7Hz) | Main (context 44Hz) |
| Proceso boundary | Cruzado incorrectamente | IPC explícito ✅ |
| Hysteresis calibrada | NO (7Hz ≠ 44Hz) | SÍ (44Hz en main) ✅ |
| Dead code | attachSeleneTheiaBridge → null | Eliminado ✅ |
| Trigger semántico | SeleneTruth (copia degradada) | context directo (fuente) ✅ |

---

## 6. ESTADO DEL CÓDIGO TRAS WAVE 4871 (MISIÓN 1)

**Hecho:**
- `TheiaEngineView/index.tsx`: `killDragDefault` en root div → `e.preventDefault() + e.stopPropagation()` en `onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop`
- `handleDragOver` / `handleDragLeave` / `handleDrop` en drop zone: todos incluyen `stopPropagation()`
- El bloque `bridge.notify()` alimentado por `useTruthStore` (WAVE 4870, bug arquitectónico) ha sido eliminado
- `useTruthStore` imports eliminados del componente
- Zero TS errors

**Pendiente (Misión 2):**
- Implementar `TheiaStateResolver` en TitanOrchestrator (Main)
- Agregar `setTheiaStateSendCallback()` a TitanOrchestrator
- Agregar `onForceState()` al preload
- `useEffect` en TheiaEngineView que escucha el IPC
- Eliminar el dead code de `attachSeleneTheiaBridge` / `_seleneThetaBridge` de TitanOrchestrator (o bien repropósito como punto de extensión documentado)

---

## 7. PREGUNTA ABIERTA PARA RADWULF

El bridge debe disparar `forceState()` cuando Selene detecta una sección DROP, BUILDUP, etc. Pero el usuario señala correctamente:

> "No dispara en todos los drops obviamente, ni en todos los ambient..."

Esto significa que el trigger de Theia **no puede ser puramente un umbral de energía o sección musical**. Selene L3 tiene criterio propio (cuándo disparar un efecto de luz). ¿Debe Theia seguir exactamente ese mismo criterio, o tiene su propio criterio visual independiente?

**Opciones:**
1. **Theia tiene criterio propio**: El resolver en Main evalúa `section.type + energy` con sus propios umbrales. Es el enfoque actual del bridge. Theia cambia de video de forma independiente de cuándo Selene dispara efectos.
2. **Theia sigue exactamente a Selene L3**: El trigger es cuando el LiveFXEngine dispara un efecto de una familia determinada (ej. efectos con `intensity > 0.8`). Esto requeriría un hook en el EffectManager post-composición.
3. **Theia tiene un canal de intent dedicado**: Selene emite explícitamente un "theia state change" como parte de sus efectos (nuevo campo en `.lfx` files o en `CombinedEffectOutput`). Esto es la arquitectura más limpia a largo plazo.

**La opción 3 es la correcta según la doctrina LuxSync** (Axioma Perfección First). Pero tiene más trabajo que la opción 1, que funciona razonablemente y es implementable ahora.

Decisión pendiente de Radwulf.
