# 🔍 WAVE 4679 — THE GATEKEEPER AUDIT
## ADUANA-GATE-AUDIT.md

**Auditor:** Cascade (Sonnet/Opus)  
**Fecha:** 2026-05-08  
**Objetivo:** Rastrear el cable entre el botón GO de la UI y la Aduana, y auditar qué canales corta cuando la compuerta está cerrada (ARMED).  
**Restricción:** Investigación SÓLO LECTURA. Sin cambios de código.

---

## 🎯 EXECUTIVE SUMMARY

El cable entre la UI y la Aduana **está CONECTADO** en el pipeline Aether, pero su comportamiento de bloqueo es **DESTRUCTIVO** (todo a cero) en lugar de **INTELIGENTE** (Move in Black). Además, existe un **DESFASE CRÍTICO** entre la ruta legacy (CalibrationView) y la ruta Aether: la ruta legacy permite bypass manual, pero la ruta Aether **no lo hace**.

**Veredicto:** La compuerta Aether funciona, pero es demasiado tosca. Bloquea TODO (incluyendo Pan/Tilt manual) y no respeta los overrides manuales como sí lo hace la Aduana legacy.

---

## 🔎 VECTOR 1: EL BOTÓN DE LA UI (IPC Wiring)

### 1.1 Frontend → IPC

**Archivo:** `src/components/commandDeck/CommandDeck.tsx:167-185`

```typescript
const handleOutputToggle = useCallback(async () => {
    const newState = !outputEnabled
    try {
      const result = await window.lux?.aether?.setOutputEnabled(newState)
      if (result?.success) {
        setOutputEnabled(result.outputEnabled ?? newState)
        console.log(`[CommandDeck] 🚦 DMX Gate ${newState ? '🟢 OPEN' : '🔴 CLOSED'}`)
      }
    } catch (err) { /* fallback local */ }
  }, [outputEnabled, setOutputEnabled])
```

- La UI invoca `window.lux.aether.setOutputEnabled(newState)`.
- Este método está declarado en `vite-env.d.ts:783` como parte del API Aether.

### 1.2 IPC Bridge (Renderer → Main)

**Archivo:** `src/core/aether/AetherIPCHandlers.ts:217-230`

```typescript
ipcMain.handle('lux:aether:setOutputEnabled', (_event, { enabled }) => {
    try {
        const orchestrator = getTitanOrchestrator()
        orchestrator.setOutputEnabled(!!enabled)
        // Compat temporal con rutas legacy todavía vivas.
        masterArbiter.setOutputEnabled(!!enabled)
        return { success: true, outputEnabled: orchestrator.isOutputEnabled() }
    } catch (err) { /* ... */ }
})
```

- **Sí está conectado al Aether.** El handler escribe directamente en `TitanOrchestrator.setOutputEnabled()`.
- **Espejo legacy:** También escribe en `masterArbiter.setOutputEnabled()` para mantener sincronizado el pipeline legacy.

### 1.3 TitanOrchestrator → AetherSafetyMiddleware

**Archivo:** `src/core/orchestrator/TitanOrchestrator.ts:1943-1950`

```typescript
const aetherSafety = this._aetherSafety
// FASE 0: Set frame context + apply output gate
aetherSafety.setFrameContext(now, this._aetherCtx.vibe.name)
aetherSafety.setOutputEnabled(this._outputEnabled)
aetherSafety.setManualNodeIds(aetherArbiter.getManualOverrideNodeIds())

aetherSafety.applyOutputGate(arbitrated as Map<string, Record<string, number>>)
```

- ✅ **El cable NO está cortado.** El valor `_outputEnabled` del Orchestrator fluye directamente al `AetherSafetyMiddleware` en cada frame.
- El middleware recibe además la lista de `manualNodeIds` (L2 overrides) para potencialmente eximirlos del gate.

### 1.4 TitanOrchestrator → HAL Legacy Gate

**Archivo:** `src/core/orchestrator/TitanOrchestrator.ts:1993-1994`

```typescript
const outputEnabled = this._outputEnabled
this.hal.setAetherOutputGateState(outputEnabled, blackoutActive)
```

- El Orchestrator también inyecta el estado de compuerta en el HAL legacy (`HardwareAbstraction.ts`) para que la Aduana legacy (WAVE 2228) opere con la misma señal.

---

## 🔎 VECTOR 2: LA LÓGICA DE BLOQUEO (¿Qué corta la Aduana?)

### 2.1 FASE 0: applyOutputGate (Pre-Resolve)

**Archivo:** `src/core/aether/egress/AetherSafetyMiddleware.ts:140-151`

```typescript
applyOutputGate(arbitrated: Map<NodeId, Record<string, number>>): void {
    if (this._outputEnabled) return

    // WAVE 4616: PRE-VIS RESCUE
    // No mutar canales pre-resolve. El cálculo (IK/currentPosition) debe permanecer
    // íntegro para UI aunque output esté desarmado. El bloqueo real de salida
    // se aplica en el write final al buffer DMX dentro del resolver.
    for (const [nodeId] of arbitrated) {
      if (this._manualNodeIds.has(nodeId)) continue
      this._aduanaBlocks++
    }
}
```

**Hallazgo CRÍTICO #1:** `applyOutputGate` **NO MUTA NADA**. Solo cuenta bloques. Los nodos manuales (`_manualNodeIds`) son contados como exentos, pero la función no modifica el mapa `arbitrated`. El comentario dice claramente: *"El bloqueo real se aplica en el write final al buffer DMX dentro del resolver."*

### 2.2 FASE 1: NodeResolver._writeNode (Intra-Resolve)

**Archivo:** `src/core/aether/resolver/NodeResolver.ts:479`

```typescript
const writeToDmx = !this._safetyMiddleware || this._safetyMiddleware.isOutputEnabled()
```

**Archivo:** `src/core/aether/resolver/NodeResolver.ts:669`

```typescript
if (!writeToDmx) continue   // SKIPS writing this channel to the buffer
```

**Archivo:** `src/core/aether/resolver/NodeResolver.ts:758` (ruta IK)

```typescript
if (!writeToDmx) return     // SKIPS writing ALL kinetic channels
```

**Hallazgo CRÍTICO #2:** `writeToDmx` es un **booleano global** para TODO el frame. No existe discriminación por nodo, por familia, ni por canal. Cuando `outputEnabled=false`:

- Todos los canales de TODOS los nodos son **omitidos** del buffer DMX.
- Los nodos manuales (`_manualNodeIds`) registrados en el middleware **NO reciben tratamiento especial** en `_writeNode`.
- El buffer DMX se zero-fillea al inicio de cada frame (`buf.fill(0)` en `resolve()`), y como ningún nodo escribe, **queda todo en 0**.

### 2.3 FASE 2: Orchestrator Egress Loop (Post-Resolve)

**Archivo:** `src/core/orchestrator/TitanOrchestrator.ts:1996-2011`

```typescript
for (const universe of aetherResolver.registeredUniverses) {
    // ARM/PREP: no enviar DMX al hardware.
    if (!outputEnabled) continue   // <-- Gate absoluto: ni siquiera llama al HAL

    if (!aetherSafety.shouldSendUniverse(universe)) continue
    const rawBuf = aetherResolver.getUniverseBuffer(universe)
    // ... smart blackout logic ...
    this.hal.sendUniverseRaw(universe, egressBuf)
}
```

**Hallazgo #3:** Incluso si alguien hubiera escrito en el buffer (vía bypass no autorizado), el loop de egress **nunca llama a `hal.sendUniverseRaw()`** cuando `outputEnabled=false`.

### 2.4 ¿Qué pasa con Pan/Tilt durante ARMED?

**Archivo:** `src/core/aether/resolver/NodeResolver.ts:656-664`

```typescript
// WAVE 4616: Pre-Vis rescue — currentPosition siempre debe actualizarse
// con la matemática real aunque output esté desarmado.
if (node.family === NodeFamily.KINETIC) {
    if (chDef.type === PAN_COARSE) {
      kn.currentPosition.pan  = dmxValue / 255
    } else if (chDef.type === TILT_COARSE) {
      kn.currentPosition.tilt = dmxValue / 255
    }
}
```

- ✅ **La UI sigue viva:** `currentPosition.pan/tilt` se actualiza **antes** del gate `if (!writeToDmx) continue`.
- ❌ **El buffer DMX está muerto:** Pan/Tilt no se escriben al `Uint8Array(512)`.

### 2.5 Smart Blackout (Comparación)

**Archivo:** `src/core/orchestrator/TitanOrchestrator.ts:2005-2010`

```typescript
const egressBuf = blackoutActive
    ? aetherResolver.getSoftBlackoutUniverseBuffer(universe, rawBuf)
    : rawBuf
```

El `SoftBlackout` **SÍ discrimina por familia**: solo mascara canales emisivos (`dimmer`, `red`, `green`, `blue`, etc.) y deja pasar `pan`/`tilt`/`speed`. Pero esto solo se aplica cuando `blackoutActive=true` **Y** `outputEnabled=true`. Cuando `outputEnabled=false`, el buffer nunca llega al HAL.

---

## 🔎 VECTOR 3: EL BYPASS DE CALIBRACIÓN (Raw DMX)

### 3.1 CalibrationView — ¿Qué ruta usa?

**Archivo:** `src/components/views/CalibrationView/index.tsx:360-380`

```typescript
const sendPosition = useCallback(async (newPan, newTilt) => {
    // ...
    const arbiter = (window as any).luxsync?.arbiter ?? (window as any).lux?.arbiter
    await arbiter.setManual({
      fixtureIds: [activeFixtureId],
      controls: { pan: panDmx, tilt: tiltDmx },
      channels: ['pan', 'tilt'],
    })
}, [activeFixtureId])
```

**Archivo:** `src/components/views/CalibrationView/index.tsx:442-461`

```typescript
const sendDMX = useCallback(async (channelIndex, value) => {
    const arbiter = (window as any).luxsync?.arbiter ?? (window as any).lux?.arbiter
    await arbiter.setManual({
      fixtureIds: [activeFixtureId],
      controls: { [channelType]: value },
      channels: [channelType],
    })
}, [activeFixtureId, channels])
```

**Hallazgo CRÍTICO #4:** CalibrationView usa `window.luxsync?.arbiter.setManual()` / `window.lux?.arbiter.setManual()`. Este es el **API legacy del ArbitrationDirector**, NO el Aether IPC (`lux:aether:setManualOverrides`).

- La ruta es: **CalibrationView → `lux:arbiter:setManual` → `ArbiterIPCHandlers.ts` → `masterArbiter.setManualOverride()` → Legacy HAL path.**
- En la ruta legacy, el HAL (`HardwareAbstraction.ts:1827-1834`) **SÍ permite bypass manual**:
  > "When outputEnabled=false (ARMED, not LIVE): Channels controlled by MANUAL (Layer 2) → pass through"

### 3.2 dmx:sendDirect — The Nerve Link (God Mode)

**Archivo:** `src/core/orchestrator/IPCHandlers.ts:1660-1697`

```typescript
// WAVE 1007: THE NERVE LINK - Direct DMX injection for calibration tools
// GOD MODE: Bypasses HAL and TitanEngine for raw hardware access
ipcMain.handle('dmx:sendDirect', (_event, params: { universe, address, value }) => {
    // ... llama directamente a universalDMX.setChannel() / artNetDriver.setChannel()
    // SIN pasar por arbiter, SIN pasar por AetherSafetyMiddleware.
})
```

- ✅ Existe un bypass totalmente independiente que va directo al driver DMX.
- ⚠️ **PERO CalibrationView no lo usa.** Usa `arbiter.setManual()` que atraviesa el legacy HAL, donde la Aduana legacy sí respeta los overrides manuales.

### 3.3 WheelSmithEmbedded — SÍ usa el Nerve Link

**Archivo:** `src/components/views/ForgeView/WheelSmithEmbedded.tsx:424-425`

WheelSmith usa `sendDirectDMX` que es `dmx:sendDirect`. Esto **bypasea todo** (Aether + legacy) y toca el hardware directamente. Este es el único componente que usa el Nerve Link correctamente.

---

## 📊 DIAGNÓSTICO COMPARATIVO: Aduana Legacy vs Aduana Aether

| Característica | Aduana Legacy (HAL) | Aduana Aether (Middleware) |
|---|---|---|
| **Ubicación** | `HardwareAbstraction.ts:1820-1834` | `NodeResolver._writeNode():479` + `TitanOrchestrator.ts:1998` |
| **Bloqueo** | Selectivo (solo no-manual) | Destructivo (todo a 0, buffer no escrito) |
| **Manual Bypass** | ✅ Sí — canales L2 pasan | ❌ **NO** — `writeToDmx` es booleano global |
| **Pan/Tilt en ARMED** | ✅ Se conservan (Move in Black) | ❌ **NO** — buffer queda en 0 |
| **UI Pre-Vis** | N/A (no tenía) | ✅ `currentPosition` se actualiza antes del gate |
| **Calib. View** | ✅ Funciona (legacy path) | ❌ No participa (usa legacy arbiter) |

---

## 🚨 HALLAZGOS CRÍTICOS (Lost Functionalities)

### H-1: Move in Black NO existe en Aether
Cuando `outputEnabled=false`, el Aether buffer queda en 0 para **absolutamente todo**, incluyendo Pan/Tilt. Los movers pierden su orientación mecánica si se desarman durante una reposición. La Aduana legacy preservaba Pan/Tilt para los canales MANUAL.

### H-2: CalibrationView opera en legacy, no en Aether
CalibrationView inyecta overrides manuales en el **ArbitrationDirector legacy**. En el pipeline Aether, esos valores nunca llegan al `NodeArbiter`. Si el HAL migra completamente a Aether, la calibración dejará de funcionar en ARMED.

### H-3: AetherSafetyMiddleware._manualNodeIds es dead code
En `applyOutputGate()`, `_manualNodeIds` se usa solo para **no contar** esos nodos en el contador `aduanaBlocks`. Pero NO se usa para **eximirlos del bloqueo real**. El bloqueo real (`writeToDmx`) es un booleano ciego.

### H-4: Dualidad de compuertas
Existen DOS compuertas independientes:
1. **Aether gate** (`NodeResolver._writeNode()`: buffer fill skip)
2. **Legacy HAL gate** (`HardwareAbstraction.ts`: per-channel source filtering)

Ambas deben estar abiertas para que el DMX fluya. Si se abre una pero no la otra, el resultado depende de qué path toma el dato.

---

## 🗺️ MAPA DE CABLES (Visual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │ CommandDeck │───▶│ controlStore    │───▶│ window.lux.aether.          │  │
│  │  GO button  │    │ toggleOutput()  │    │ setOutputEnabled(bool)      │  │
│  └─────────────┘    └─────────────────┘    └─────────────────────────────┘  │
│                                                      │                       │
└──────────────────────────────────────────────────────┼───────────────────────┘
                                                       │ IPC
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Main)                                 │
│                                                                             │
│  ┌────────────────────────┐      ┌──────────────────────────────────┐     │
│  │ AetherIPCHandlers.ts   │      │ ArbiterIPCHandlers.ts (legacy)   │     │
│  │ lux:aether:setOutput   │      │ lux:arbiter:setManual            │     │
│  │   → orchestrator.      │      │   → masterArbiter.setManual()    │     │
│  │      setOutputEnabled()│      │                                  │     │
│  └───────────┬────────────┘      └──────────────┬───────────────────┘     │
│              │                                  │                           │
│              ▼                                  ▼                           │
│  ┌────────────────────────┐      ┌──────────────────────────────────┐     │
│  │ TitanOrchestrator      │      │ HardwareAbstraction.ts (legacy)    │     │
│  │ ├─ _aetherSafety.      │      │ ├─ Aduana legacy (WAVE 2228)       │     │
│  │ │   setOutputEnabled() │      │ │  → MANUAL channels bypass gate   │     │
│  │ ├─ _outputEnabled      │      │ └─ sendToDriver()                  │     │
│  │ └─ hal.setAetherGate() │      └──────────────────────────────────┘     │
│  └───────────┬────────────┘                                                │
│              │                                                              │
│  ┌───────────▼────────────┐                                                │
│  │ AetherSafetyMiddleware │                                                │
│  │ ├─ applyOutputGate()   │  ← NO MUTA, solo cuenta blocks              │
│  │ ├─ isOutputEnabled()   │  ← booleano global                            │
│  │ └─ _manualNodeIds      │  ← dead code (no exime del gate real)       │
│  └───────────┬────────────┘                                                │
│              │                                                              │
│  ┌───────────▼────────────┐                                                │
│  │ NodeResolver._writeNode│                                                │
│  │ ├─ writeToDmx =        │  ← TRUE/FALSE global para TODO el frame    │
│  │ │   isOutputEnabled()   │                                              │
│  │ ├─ if (!writeToDmx)     │                                              │
│  │ │   continue;  // SKIP   │  ← TODOS los canales omitidos              │
│  │ │   return;    // SKIP IK│                                              │
│  │ └─ currentPosition      │  ← SÍ se actualiza (Pre-Vis Rescue)        │
│  │    se actualiza antes   │                                              │
│  └─────────────────────────┘                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 CONCLUSIÓN

| Pregunta | Respuesta |
|---|---|
| ¿El cable UI→Aduana está cortado? | **NO.** Fluye: CommandDeck → `lux:aether:setOutputEnabled` → Orchestrator → `AetherSafetyMiddleware`. |
| ¿El bloqueo es destructivo o inteligente? | **DESTRUCTIVO.** Cuando `outputEnabled=false`, el buffer DMX queda en 0 para **absolutamente todo** (Pan/Tilt incluidos). No hay discriminación por familia ni por nodo manual. |
| ¿CalibrationView bypass la Aduana? | **Indirectamente SÍ, pero por la ruta legacy.** Usa `arbiter.setManual()` (ArbitrationDirector), que atraviesa la Aduana legacy que SÍ respeta manuales. No toca el pipeline Aether. |
| ¿Existe un bypass total (raw DMX)? | **SÍ.** `dmx:sendDirect` (Nerve Link) va directo al driver universalDMX/ArtNet. Pero CalibrationView no lo usa. |

### 🔧 Recomendaciones para la fase de implementación (WAVE posterior)

1. **Move in Black para Aether:** Modificar `NodeResolver._writeNode()` para que, cuando `!writeToDmx`, en lugar de `continue`/`return`, escriba solo los canales KINETIC (pan/tilt/speed) si provienen de un nodo manual. O mejor: aplicar la lógica de SoftBlackout (máscara selectiva) incluso cuando `outputEnabled=false`.

2. **Unificar CalibrationView:** Migrar CalibrationView para que use `window.lux.aether.setManualOverrides` en lugar de `window.lux.arbiter.setManual`. Esto requiere que el gate Aether soporte bypass manual.

3. **Eliminar dead code:** `AetherSafetyMiddleware._manualNodeIds` y `applyOutputGate()` actualmente solo cuentan estadísticas. Deben convertirse en la fuente de verdad del gate inteligente, o eliminarse si la lógica se mueve al resolver.

---

*Fin del informe. Estado: AUDITORÍA COMPLETA — sin cambios de código.*
