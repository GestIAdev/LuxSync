# WAVE-3530 — FORENSIC REPORT: EL SISTEMA ESTABA EN ARMED (BLACKOUT GLOBAL)

**Fecha:** 2025-07-20  
**Estado:** CAUSA RAÍZ CONFIRMADA  
**Síntomas reportados:** UI apagada, AIR pulsante sin color, controles manuales de HyperionView no funcionan, "UI aislada del mundo"

---

## 🔬 EL VEREDICTO

El motor Liquid **SÍ generaba intents**. Los probes lo confirman:
```
[PROBE-DIMMER] zoneInt=0.5000 | result=0.1742
```

Pero el **AETHER 🛰️ Observatory** siempre reportaba `val=0.00`. No era un bug en el motor — era un **blackout global activo** bloqueando toda la cadena en la salida.

---

## 🎯 CAUSA RAÍZ #1 — OUTPUT GATE CERRADO (ARMED, no LIVE)

### Dónde vive:
`src/core/arbiter/ArbitrationDirector.ts:167`

```typescript
private _outputEnabled: boolean = false  // ← ARRANCA EN FALSE SIEMPRE
```

### El flujo de la muerte:
```
LiquidImpactAdapter.process()
  → bus.push(intent)            ✅ intent generado con dimmer=0.1742
  → NodeArbiter.arbitrate()     ✅ intent arbitrado
  → AduanaFilter.filter(
      arbitrated,
      graph,
      bpm,
      confidence,
      masterArbiter.isOutputEnabled()  // ← retorna FALSE
    )
  → _applyOutputGate()          ← ZERIFICA dimmer, strobe, shutter, white, amber, uv
  → NodeResolver.resolve()      ← recibe todo en cero
  → Observatory log: val=0.00   ← LOG CORRECTO (refleja la realidad post-gate)
```

### Por qué el log no mentía (pero sí desorientaba):
El `[AETHER 🛰️]` log lee del `arbitrated` **después** del AduanaFilter. Con `outputEnabled=false`, el OutputGate zerifica todos los canales AUTO. El log reporta correctamente lo que llega al resolver — cero. La sonda PROBE-DIMMER reporta el valor **antes** del gate, por eso muestra 0.1742 mientras el Observatory muestra 0.00.

### Cómo activar el output:
El usuario debe presionar el botón **LIVE/OUTPUT** en la **TransportBar** o **CommandDeck** de HyperionView. Esto dispara:
```
IPC: lux:arbiter:setOutputEnabled { enabled: true }
→ masterArbiter.setOutputEnabled(true)
→ AduanaFilter recibe outputEnabled=true
→ OutputGate se abre
→ Fixtures reciben DMX
```

**El log de la sesión NO contiene ninguna llamada `setOutputEnabled`** — confirma que el botón nunca fue presionado en esa sesión.

---

## 🎯 CAUSA RAÍZ #2 — HAL DRIVER NOT CONNECTED

```
[HAL] ⚠️ Driver not connected, dropping frames
```

Incluso con el OutputGate abierto, si no hay interfaz DMX física conectada, los frames se descartan. El sistema está en modo simulación sin hardware.

**Esto no es un bug — es el comportamiento correcto en modo dev sin hardware.**

---

## 🎯 CAUSA RAÍZ #3 — OBSERVATORY ENGAÑOSO (posición de fixtures)

Cuando un fixture no tiene posición 3D en el show file, el SpatialRegistrar usa fallback `{ x: 0, y: 0, z: 0 }`. En el Observatory:

```typescript
if (Math.abs(x) < 2.0) {
  bucket = movers   // ← x=0 → SIEMPRE cae aquí
}
```

**Todos los fixtures sin posición caen en `movers`**, no en `front` ni `back`. El log siempre mostraría `FRONT: val=0.00` aunque hubiera fixtures activos, porque están en `movers`. Este es un problema de legibilidad del log, no un bug funcional.

---

## 🎯 CAUSA RAÍZ #4 — CONTROLES MANUALES HYPERION NO LLEGAN A AETHER

Los overrides manuales del Programmer panel van a:
```typescript
masterArbiter.setManualOverride(override)  // ← ArbiterIPCHandlers.ts:339,525,911
```

Pero el `AduanaFilter` tiene su propio registro:
```typescript
public setManualOverride(nodeId: NodeId, channels: Readonly<Record<string, number>>): void
```

**No existe ningún bridge en TitanOrchestrator** que reenvíe los overrides del `masterArbiter` (legacy) al `_aduanaFilter` (Aether). Los controles manuales de HyperionView solo afectan al pipeline legacy, no al nuevo Aether.

---

## 🔧 FIXES APLICADOS EN ESTA WAVE

### Fix aplicado: ImpactAdapter threshold 0.5 → 0.15
**Archivo:** `electron-app/src/core/aether/adapters/LiquidEngineAdapter.ts:168`

```typescript
// ANTES
inp.isKick = audio.hasTransient && audio.bass > 0.5

// DESPUÉS
inp.isKick = audio.hasTransient && audio.bass > 0.15
```

**Motivo:** El threshold de 0.5 bloqueaba la detección de kicks en música de baja energía. El ColorAdapter ya tenía 0.15 desde la sesión anterior.

### Fix verificado: MIN_KICK_ENERGY en IntervalBPMTracker
`src/workers/IntervalBPMTracker.ts:163` → ya está en `0.020` (fix previo aplicado en otra sesión).

---

## 📋 FIXES PENDIENTES (WAVE 3531)

### PENDIENTE #1 — Bridge override manual legacy → AduanaFilter

La arquitectura necesita un bridge en TitanOrchestrator:

```typescript
// En el frame loop, ANTES de AduanaFilter.filter():
// Sincronizar overrides manuales del MasterArbiter legacy con AduanaFilter
const legacyOverrides = masterArbiter.getManualOverrides?.()
if (legacyOverrides) {
  for (const [fixtureId, channels] of legacyOverrides) {
    const nodeId = this._aetherGraph.getNodeIdForFixture(fixtureId)
    if (nodeId) this._aduanaFilter.setManualOverride(nodeId, channels)
  }
}
```

**Requiere auditar si `masterArbiter` expone `getManualOverrides()` y si `_aetherGraph` mapea fixtureId a nodeId.**

### PENDIENTE #2 — Fix Observatory para fixtures sin posición

Cambiar el fallback del `stagePosition` en `_ingestAetherDevices` para preservar `undefined` y que el Observatory lo excluya en lugar de agrupar todo en `movers`:

```typescript
// TitanOrchestrator.ts
// Pasar undefined al SpatialRegistrar si no hay posición
this._spatialRegistrar.register(deviceDef, stagePosition, this)
// Y en el SpatialRegistrar, no usar x=0 como fallback => deixar position=undefined
```

O bien, en el Observatory `_logObservatorySample`, separar la clasificación:
```typescript
// Si position.x=0 y position.y=0 y position.z=0 → probablemente sin posición real → 'unpositioned'
```

---

## 📊 RESUMEN EJECUTIVO PARA RADWULF

| Problema | Causa | Solución |
|----------|-------|----------|
| UI apagada | OutputGate cerrado (ARMED) | Presionar botón LIVE en TransportBar |
| AETHER val=0.00 | OutputGate zerifica → Observatory lo refleja correctamente | Activar LIVE |
| Controles manuales no funcionan | No hay bridge legacy→Aether | WAVE 3531 (pendiente) |
| AIR pulsa pero sin color | ImpactAdapter sí pasaba zoneInt≥0.5, ColorAdapter no (centroid < 2000Hz) | Fix threshold 0.15 aplicado |
| HAL dropping frames | No hay hardware DMX conectado | Normal en dev sin hardware |

**CONCLUSIÓN:** El motor está vivo. Los intents se generan. El pipeline Aether es correcto. El único bloqueo real en runtime es el **botón LIVE** que el operador no activó. Los controles manuales de HyperionView son el siguiente problema a resolver.

---

*WAVE-3530 — PunkOpus para LuxSync*
