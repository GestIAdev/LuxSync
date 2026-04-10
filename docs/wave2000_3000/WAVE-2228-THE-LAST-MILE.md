# WAVE 2228: THE LAST MILE — DMX Aduana at HAL Level

**Fecha**: 2026-03-25  
**Agente**: PunkOpus  
**Tipo**: Refactor arquitectónico (mover gate de Arbiter a HAL)  
**Estado**: ✅ COMPLETADO — Compilación limpia  
**Precede**: WAVE 2227 (Visual Gate removal + Reactor cleanup)

---

## EL PROBLEMA

### Fuga 1: El Visor 3D Ciego (post-2227 resuelto parcialmente)
WAVE 2227 eliminó el Visual Gate del TitanOrchestrator. El HyperionView ya recibe datos vivos. PERO el Arbiter seguía blackouteando fixtures sin override manual internamente. Resultado: el 3D solo mostraba fixtures con override manual activo.

### Fuga 2: El Contrabandista (LA razón de este WAVE)
El gate del Arbiter en `arbitrateFixture()` usaba un check fixture-level:
```typescript
if (!this._outputEnabled && !manualOverride) → return blackout
```
Si el operador creaba override en UN canal (ej: tilt), `manualOverride` era truthy → gate no se activaba → dimmer + color de Layer 0 pasaban al DMX real. El tilt le daba "pase VIP" a todo el foco.

### Raíz: Gate en el lugar equivocado
El Arbiter es cerebro. No debería censurarse a sí mismo. El gate debe estar en el ÚLTIMO milímetro antes del cable DMX.

---

## LA SOLUCIÓN: Mover la Aduana al HAL

### Principio
- **El Arbiter calcula el 100% del show siempre** — para UI, preview, todas las layers
- **El HAL filtra en `sendToDriver()`** — per-channel, usando `_controlSources` metadata
- **El HyperionView ve show vivo siempre** — ARM sin GO = preview privado funcional

### Cambios

#### 1. FixtureState (FixtureMapper.ts)
Nuevo campo opcional `_controlSources?: Record<string, number>` — propaga la metadata de quién controla cada canal (ControlLayer enum value) desde el Arbiter hasta el HAL.

#### 2. HAL renderFromTarget() (HardwareAbstraction.ts)
Propaga `_controlSources` del `FixtureLightingTarget` (arbiter output) al `FixtureState` (HAL internal) para que `sendToDriver()` pueda leerlo.

#### 3. HAL sendToDriver() (HardwareAbstraction.ts) — LA ADUANA
Nuevo bloque al inicio de `sendToDriver()`:
```
Si outputEnabled=false:
  Para cada fixture:
    Si _controlSources disponible:
      Per-channel: MANUAL → pasa, otros → valor seguro
    Sino:
      Full blackout (safety)
```

"Valor seguro" = dimmer:0, color:negro, posición:centro.

Esto es el ÚNICO lugar donde se filtra el DMX. Cubre TODOS los paths: `renderFromTarget()` y `sendStatesWithPhysics()` ambos terminan en `sendToDriver()`.

#### 4. MasterArbiter arbitrateFixture() — Gate ELIMINADO
El early return `if (!outputEnabled && !manualOverride) → blackout` fue eliminado. El Arbiter ahora calcula todo, siempre, para todos los fixtures, sin censurarse.

---

## ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---|---|
| `FixtureMapper.ts` | Nuevo campo `_controlSources` en interface `FixtureState` |
| `HardwareAbstraction.ts` | Import `masterArbiter` + `ControlLayer`, propagar `_controlSources` en `renderFromTarget()`, Aduana DMX en `sendToDriver()` |
| `MasterArbiter.ts` | Eliminar gate en `arbitrateFixture()`, actualizar log message |

---

## FLUJO FINAL

```
TitanEngine.update()
  → Genera intent (colores, posiciones, dimmer) para TODOS los fixtures
  
MasterArbiter.arbitrate()
  → Arbitra ALL layers (Titan L0, Manual L2, Effects L3, Blackout L4)
  → Marca _controlSources per-channel (quién controla qué)
  → NUNCA blackoutea por outputEnabled — calcula 100% siempre
  
HAL.renderFromTarget()
  → Physics, optics, color translation
  → Propaga _controlSources al FixtureState
  
HAL.sendToDriver()          ← LA ADUANA (último milímetro)
  → Si outputEnabled=false:
      dimmer channel (source=MANUAL?) → SÍ pasa / NO → 0
      red channel (source=MANUAL?)    → SÍ pasa / NO → 0
      tilt channel (source=MANUAL?)   → SÍ pasa / NO → 128
      etc.
  → Si outputEnabled=true:
      Todo pasa
  → driver.send(packets)    ← USB/ArtNet
  
IPC Broadcast → truthStore → HyperionView
  → Recibe datos VIVOS (sin filtrar) → Preview 3D funcional SIEMPRE
```

---

*"El cerebro no debe tener candados. Los candados van en la puerta de salida."*

— PunkOpus, WAVE 2228
