# MANUAL-CONTROL-MAP — WAVE 4648 Audit
> Auditoría forense del pipeline manual L2 (UI → NodeArbiter → DMX).  
> Fecha: 2026-05-08 | Solo lectura. Sin fixes aplicados.

---

## 🔍 VECTOR 1: ProgrammerStore & MovementStore

### ProgrammerStore.ts — Estado y llaves
- **Override keys**: `red`, `green`, `blue`, `pan`, `tilt`, `speed`, `gobo`, `prism`, `focus`, `zoom`, `iris`, `dimmer`, `strobe`, `shutter`, `targetX/Y/Z`.
- **Normalización**: 0-1 (clamp01). UI habla en %/°/255; el store traduce antes de exponer al bridge.
- **Dirty flags**: `dirtyFamilies: Set<ProgrammerFamily>` — IMPACT, COLOR, KINETIC, BEAM, EXTRAS.
- **Veredicto**: ✅ Las llaves coinciden 1:1 con lo que `NodeResolver` espera (`PAN_COARSE='pan'`, `CH_RED='red'`, etc.).

### MovementStore.ts — Hidratación y feedback
- `hydrateFromBackend({ pan, tilt, pattern, speed, amplitude })` solo hidrata **kinetic**.
- ❌ **No recibe color, beam, ni estado de override activo.**
- `manualOverrideFixtureIds: ReadonlySet<string>` existe como flag de UI, pero **ProgrammerAetherBridge nunca llama `setManualOverrideForFixtures()`**.
- **Veredicto**: ⚠️ Hidratación incompleta. El movimiento vuelve a la UI, pero color/beam no.

---

## 🔍 VECTOR 2: ProgrammerAetherBridge & KineticsBridge

### ProgrammerAetherBridge.ts — El pipeline L2 correcto
```
UI fader → programmerStore (dirty flag) → _flush() @ 44Hz
  → window.lux.aether.setManualOverrides(payloads)
  → IPC lux:aether:setManualOverrides
  → AetherIPCHandlers.ts → NodeArbiter.setManualOverride(nodeId, channels)
```
- `nodeId` construido como `${fixtureId}:${FAMILY_LABEL[family]}`  
  Ej: `fix-01:color`, `fix-01:kinetic`.
- **Veredicto**: ✅ Path moderno, conectado al NodeArbiter L2 real.

### KineticsBridge.ts — Split-brain crítico
El bridge tiene **DOS salidas** que van a sistemas distintos:

| Flujo | Método | Destino IPC | Backend handler | Sistema target |
|---|---|---|---|---|
| Spatial target | `window.lux.aether.applySpatialTarget()` | `lux:aether:applySpatialTarget` | AetherIPCHandlers | ✅ NodeArbiter (moderno) |
| Pattern + speed | `window.lux.arbiter.setManualFixturePattern()` | `lux:arbiter:setManualFixturePattern` | ArbiterHandlers.ts | ❌ **masterArbiter (LEGACY)** |

- **🚨 CABLE ROTO #1**: `_flushPattern()` envía patterns al `masterArbiter`, no al `NodeArbiter`. El `masterArbiter` es un sistema LEGACY que puede estar emitiendo DMX en paralelo (o muerto). Los pattern commands del KineticsCathedral **no llegan al pipeline Aether**.

- **🚨 CABLE ROTO #2**: `_flushSpatial()` tiene un guard:  
  `if (ids.every(id => manualOverrideFixtureIds.has(id))) return;`  
  Pero `manualOverrideFixtureIds` **nunca se llena** cuando ProgrammerAetherBridge envía pan/tilt manual. Por tanto, el spatial target **sobrescribe silenciosamente** los overrides manuales de posición.

---

## 🔍 VECTOR 3: NodeArbiter — Arbitraje y Liberación

### Prioridad de capas en `arbitrate()`
```
L0 SystemBus → L1 Selene → LP Playback → L3 Effects → L3+ Hephaestus → L2 Manual → L2.5 Inhibit → L4 Blackout
```
- L2 se aplica **después** de L3 (effects). Overrides manuales ganan a effects.
- `clearManualOverride(nodeId)` → `this._manualOverrides.delete(nodeId)`.
- Al liberar, el nodo desaparece del mapa L2; en el siguiente frame, L0/L1/L3 vuelven a escribir en `_result` y sus valores fluyen.
- **Veredicto**: ✅ No hay locks que bloqueen canales no-dimmer. La liberación funciona.

---

## 🔍 VECTOR 4: NodeResolver — De arbitrado a DMX

### `_writeNode(nodeId, channelValues)`
1. Obtiene `node` del `NodeGraph` por `nodeId`.
2. Si familia COLOR: `_translateColor()` usa `CH_R ?? CH_RED`, `CH_G ?? CH_GREEN`, `CH_B ?? CH_BLUE`.  
   Las llaves del bridge (`red`, `green`, `blue`) coinciden.
3. Si familia KINETIC clásico: lee `channelValues['pan']`, `channelValues['tilt']`.  
   `PAN_COARSE = 'pan'`, `TILT_COARSE = 'tilt'`. Coinciden.
4. Fallback: `this._getDefaultNormalizedValue(node, chDef)` devuelve `defaultValue/255` (típicamente 128/255 = 0.5).  
   Este fallback solo se dispara si **ninguna capa** escribió ese canal en el frame.
- **Veredicto**: ✅ Los cables L2 llegan al buffer DMX. Sin traducciones rotas.

---

## 🗺️ MAPA DE CABLES ROTOS

### CRÍTICO — Arreglar antes del show

| # | Archivo:Línea | Problema | Fix requerido |
|---|---|---|---|
| **1** | `KineticsBridge.ts:172` | `_flushPattern` llama a `window.lux.arbiter.setManualFixturePattern()` — **legacy masterArbiter**. | Migrar a `window.lux.aether.setManualOverrides()` con familia KINETIC (pattern/speed/amplitude como override L2), o desconectar pattern del KineticsBridge y dejar que el VMM (L0) lo controle. |
| **2** | `KineticsBridge.ts:107-108` | Guard `manualOverrideFixtureIds.has(id)` nunca es true porque ProgrammerAetherBridge no marca overrides. | Sincronizar `movementStore.setManualOverrideForFixtures()` desde `ProgrammerAetherBridge` cuando envía posición, o eliminar el guard y dejar que L2 (manual) gane por prioridad de capa en NodeArbiter. |
| **3** | `movementStore.ts:120-126` | `hydrateFromBackend` solo recibe `pan, tilt, pattern, speed, amplitude`. | Extender el contrato IPC `lux:aether:getNodeState` (o crearlo) para devolver también `red, green, blue, gobo, prism, focus, zoom, iris` y todos los extras del nodo, o al menos los que estén en override L2. |

### MEDIO — Perdida de datos silenciosa

| # | Archivo:Línea | Problema | Fix requerido |
|---|---|---|---|
| **4** | `ProgrammerAetherBridge.ts:187-188` | `consumeDirty()` se llama **antes** de resolver la Promise IPC. Si el IPC falla, los dirty flags ya están limpios y no se reintenta. | Mover `consumeDirty()` al `.then()` de la Promise, o implementar reintentos con dirty persistente hasta confirmación. |

### BAJO — Hidración inconsistente

| # | Archivo:Línea | Problema | Fix requerido |
|---|---|---|---|
| **5** | `movementStore.ts:196-204` | `hydrateFromBackend` no normaliza color/beam; sliders de UI muestran defaults (255,255,255) aunque el fixture tenga override L2 de color. | Incluir color/beam en la respuesta de hidratación del backend, o hacer que `TheProgrammer.tsx` consulte `programmerStore.fixtureOverrides` directamente para inicializar sliders. |

---

## 🔌 RESUMEN EJECUTIVO

- **Intensidad (dimmer)**: ✅ Funciona. Bridge → NodeArbiter L2 → NodeResolver → DMX.
- **Color**: ✅ Funciona mecánicamente, pero la UI no se hidrata correctamente (slider muestra defaults).
- **Movimiento pan/tilt manual**: ✅ Funciona por ProgrammerAetherBridge, pero **KineticsBridge puede pisarlo** con spatial targets porque no detecta el override.
- **Pattern/speed/amplitude**: ❌ **Roto.** Va al `masterArbiter` legacy, no al Aether moderno.
- **Beam (gobo, prism, etc.)**: ✅ Funciona mecánicamente, mismo problema de hidratación UI que color.
- **Soltar fader (clear override)**: ✅ Funciona. `NodeArbiter.clearManualOverride()` elimina la entrada; L0/L1 recuperan control en el siguiente frame.

---

## 🎯 ORDEN DE REPARACIÓN RECOMENDADO

1. **Cable #1**: Desconectar `_flushPattern` de `masterArbiter` — migrarlo a `NodeArbiter` L2 o eliminar si el VMM (L0) ya cubre patterns.
2. **Cable #2**: Asegurar que `KineticsBridge` respete overrides manuales (sincronizar flag o eliminar guard innecesario).
3. **Cable #4**: Proteger dirty flags contra fallo IPC (mover consumeDirty al `.then()`).
4. **Cables #3 + #5**: Extender hidratación backend para color/beam.

> Dictamen: La cadena L2 está **viva para dimmer/color/beam/posición**, pero tiene **un bypass crítico al legacy** en patterns y una **fuga de sincronización** entre MovementStore y ProgrammerAetherBridge.
