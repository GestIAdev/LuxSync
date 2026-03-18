# 🔴 WAVE 2085 — HYPERION TELEPORTATION BUG: PHYSICS AUDIT

**Fecha**: 2025-01-XX  
**Auditor**: PunkOpus  
**Severidad**: 🔴 CRÍTICA — Riesgo de daño a hardware real  
**Estado**: ROOT CAUSE IDENTIFICADA — CIRUGÍA PENDIENTE

---

## 📋 RESUMEN EJECUTIVO

Los moving heads se **teletransportan 180° instantáneamente** tanto en el simulador como en el DMX enviado al hardware real. El motor de físicas (`FixturePhysicsDriver`) funciona correctamente — el problema es que el `TitanOrchestrator` **lo bypasea completamente** en múltiples rutas de código, copiando el TARGET directamente como posición FÍSICA.

**Impacto**: Movimiento mecánico destructivo. Un mover recibiendo un salto instantáneo de pan=0 a pan=255 en un solo frame puede dañar engranajes, correas y servomotores.

---

## 🔬 ROOT CAUSE — LA TRIPLE HERIDA

### Herida #1: Hephaestus Pan/Tilt Override (PRINCIPAL)

**Archivo**: `TitanOrchestrator.ts`, líneas 1147-1155

```typescript
case 'pan': {
  newF.pan = output.value
  newF.physicalPan = newF.pan  // ← 💀 TELEPORT: target copiado a physical
  break
}
case 'tilt': {
  newF.tilt = output.value
  newF.physicalTilt = newF.tilt  // ← 💀 TELEPORT: target copiado a physical
  break
}
```

**Qué hace**: Cuando Hephaestus (el sistema de timelines/clips) genera un output de movimiento, el TitanOrchestrator copia el valor TARGET directamente como posición FÍSICA. Zero interpolación. Zero physics. Salto cuántico instantáneo.

### Herida #2: Stereo Zone Movement

**Archivo**: `TitanOrchestrator.ts`, líneas 955-985

```
Zona LEFT:  newPhysicalPan = newPan   // ← 💀 TELEPORT
Zona RIGHT: newPhysicalPan = newPan   // ← 💀 TELEPORT  
Default:    newPhysicalPan = newPan   // ← 💀 TELEPORT
```

**Qué hace**: El cálculo estéreo de movimiento también bypasea la física. Tres ramas, tres teletransportaciones.

### Herida #3: Global Movement Override

**Archivo**: `TitanOrchestrator.ts`, líneas 1015-1045

```
Pan override:  newPhysicalPan = newPan   // ← 💀 TELEPORT
Tilt override: newPhysicalTilt = newTilt // ← 💀 TELEPORT
```

**Qué hace**: Los overrides globales de movimiento también hacen la misma copia directa.

---

## 🗺️ DATA FLOW — EL VIAJE DEL TELETRANSPORTE

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRAME N — RUTA NORMAL (CORRECTA)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MasterArbiter                                                      │
│       │                                                             │
│       ▼                                                             │
│  TitanEngine (genera targetPan, targetTilt)                         │
│       │                                                             │
│       ▼                                                             │
│  HAL.renderFromTarget(states)                                       │
│       │                                                             │
│       ├──→ FixturePhysicsDriver.translateDMX(pan, tilt, dt)         │
│       │         │                                                   │
│       │         ├──→ Acceleration curves                            │
│       │         ├──→ Braking curves                                 │
│       │         ├──→ SAFETY_CAP (maxVelocity=400, maxAccel=900)     │
│       │         │                                                   │
│       │         ▼                                                   │
│       │    physicalPan = interpolated (CORRECTO ✅)                  │
│       │                                                             │
│       ├──→ FixtureMapper.statesToDMXPackets()                       │
│       │         │                                                   │
│       │         ▼                                                   │
│       │    case 'pan': return state.physicalPan ?? state.pan        │
│       │    (usa el valor interpolado → DMX CORRECTO ✅)             │
│       │                                                             │
│       └──→ Driver.send() → ArtNet UDP → Hardware 💡                │
│                                                                     │
│  RESULTADO: Movimiento suave, interpolado. Hardware seguro.         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                            ⚡ PERO ENTONCES ⚡

┌─────────────────────────────────────────────────────────────────────┐
│                    FRAME N — RUTA HEPHAESTUS (EL BUG)               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Después de renderFromTarget():                                     │
│                                                                     │
│  HephaestusRuntime.getOutputsForFixture()                           │
│       │                                                             │
│       ▼                                                             │
│  TitanOrchestrator.applyHephaestusOverrides()                       │
│       │                                                             │
│       ├──→ case 'pan':                                              │
│       │      newF.pan = output.value         (target = 255)         │
│       │      newF.physicalPan = newF.pan     💀 TELEPORT!           │
│       │      (physicalPan = 255, SIN PHYSICS)                       │
│       │                                                             │
│       ▼                                                             │
│  hal.sendStates(fixtureStates)     ← RE-ENVÍO SIN PHYSICS          │
│       │                                                             │
│       ├──→ FixtureMapper.statesToDMXPackets()                       │
│       │         │                                                   │
│       │         ▼                                                   │
│       │    case 'pan': return state.physicalPan ?? state.pan        │
│       │    physicalPan = 255 (TELETRANSPORTADO) 💀                  │
│       │                                                             │
│       └──→ Driver.send() → ArtNet UDP → Hardware 💥 BOOM!          │
│                                                                     │
│  RESULTADO: Mover salta 180° en un frame. Hardware en riesgo.       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                            ⚡ ADEMÁS ⚡

┌─────────────────────────────────────────────────────────────────────┐
│                    BROADCAST A FRONTEND (TAMBIÉN ROTO)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TitanOrchestrator.broadcastToFrontend() [línea 1444]               │
│       │                                                             │
│       ▼                                                             │
│  physicalPan: (f.physicalPan ?? f.pan) / 255                        │
│       │         ↑                                                   │
│       │    f.physicalPan = pan (TELETRANSPORTADO)                   │
│       │    (fue seteado por Herida #1/#2/#3)                        │
│       │                                                             │
│       ▼                                                             │
│  IPC → truthStore.fixtures → StageSimulatorCinema                   │
│       │                                                             │
│       ▼                                                             │
│  Beam renderizado en posición final INSTANTÁNEAMENTE                │
│  El usuario ve el "teleport" en pantalla. 💀                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ EVALUACIÓN DE SEGURIDAD DMX

### ¿El hardware recibe el teletransporte?

**SÍ. CONFIRMADO.**

La secuencia temporal en un frame es:

1. `hal.renderFromTarget(states)` → aplica physics → envía DMX interpolado ✅
2. Hephaestus override → `physicalPan = pan` (TELEPORT) 💀
3. `hal.sendStates(fixtureStates)` → envía DMX teletransportado 💀

El paso 3 **SOBREESCRIBE** el paso 1 en el mismo frame. El hardware recibe **dos paquetes DMX en un frame**: primero el interpolado, luego el teletransportado. El último gana.

### Ruta del re-envío (confirmado en código):

```
hal.sendStates(fixtureStates)                    [TitanOrchestrator.ts:1249]
  └──→ this.mapper.statesToDMXPackets(states)    [HardwareAbstraction.ts:1268]
         └──→ case 'pan':
                return state.physicalPan ?? state.pan  [FixtureMapper.ts:476]
                       ↑
                       VALOR TELETRANSPORTADO (physicalPan = pan = target)
  └──→ this.driver.send(packet)                  [HardwareAbstraction.ts:1277]
         └──→ ArtNet UDP → Hardware 💥
```

### ¿Qué tan grave es?

| Escenario | Riesgo | Probabilidad |
|-----------|--------|--------------|
| Mover con pan 0→255 en 1 frame | 🔴 ALTO — 540°/seg (normal ~60°/seg) | Alta (cualquier timeline con movimiento) |
| Mover con tilt 0→255 en 1 frame | 🔴 ALTO — Misma situación | Alta |
| Stereo spread activándose | 🟡 MEDIO — Depende del spread amount | Media |
| Movement override manual | 🟡 MEDIO — Solo en overrides de usuario | Baja |

---

## 🔍 COMPONENTES AUDITADOS

### FixturePhysicsDriver.ts — ✅ LIMPIO
- Motor de físicas correcto
- Dos modos: SNAP (snapFactor, para techno/rock) y CLASSIC (aceleración/frenado, para chill)
- SAFETY_CAP: maxAcceleration=900, maxVelocity=400
- Protección TELEPORT: deltaTime > 200ms → salto instantáneo (scrub de timeline)
- **Veredicto**: Funciona perfectamente. El problema es que NUNCA se usa en las rutas con bug.

### HardwareAbstraction.ts — ✅ LIMPIO (parcialmente)
- `renderFromTarget()`: CORRECTO — llama `translateDMX()` + `getPhysicsState()`
- `sendStates()`: PELIGROSO — envía directo a driver SIN pasar por physics
- `sendToDriver()`: Neutral — solo checkea connected y llama `mapper.statesToDMXPackets()`
- **Veredicto**: La HAL tiene una puerta trasera (`sendStates`) que bypasea sus propias protecciones.

### FixtureMapper.ts — ✅ LIMPIO
- `getChannelValue()` para pan: `return Math.round(state.physicalPan ?? state.pan)`
- Lee lo que le dan. Si `physicalPan` es basura teletransportada, envía basura teletransportada.
- **Veredicto**: Víctima inocente. Hace su trabajo correctamente.

### StageSimulatorCinema.tsx — ✅ LIMPIO
- Lee `physicalPan` de `calculateFixtureRenderValues()` (no tiene smoothing propio)
- Muestra lo que le dan. Si `physicalPan` está teletransportado, muestra teletransporte.
- **Veredicto**: Víctima inocente. Refleja fielmente el estado del store.

### TitanOrchestrator.ts — 💀 EPICENTRO DEL BUG
- **3 rutas que setean `physicalPan = pan`** (bypass total de physics)
- **1 re-envío** (`sendStates`) que manda estados sin physics al hardware
- **1 broadcast** que envía physicalPan teletransportado al frontend
- **Veredicto**: 5 puntos de corrupción en un solo archivo.

---

## 🔧 PLAN DE CIRUGÍA

### Fase 1: STOP THE BLEEDING — Eliminar las 3 heridas

**Principio**: El `TitanOrchestrator` **NUNCA** debe escribir `physicalPan`. Solo debe escribir `pan` (el TARGET). `physicalPan` es propiedad EXCLUSIVA del `FixturePhysicsDriver`.

#### Cirugía 1.1 — Hephaestus Override (líneas ~1147-1155)

```typescript
// ANTES (💀 TELEPORT):
case 'pan': {
  newF.pan = output.value
  newF.physicalPan = newF.pan  // ← ELIMINAR
  break
}
case 'tilt': {
  newF.tilt = output.value
  newF.physicalTilt = newF.tilt  // ← ELIMINAR
  break
}

// DESPUÉS (✅ CORRECTO):
case 'pan': {
  newF.pan = output.value
  // physicalPan será calculado por FixturePhysicsDriver en el próximo render
  break
}
case 'tilt': {
  newF.tilt = output.value
  // physicalTilt será calculado por FixturePhysicsDriver en el próximo render
  break
}
```

#### Cirugía 1.2 — Stereo Movement (líneas ~955-985)

Eliminar TODAS las líneas `newPhysicalPan = newPan` y `newPhysicalTilt = newTilt` en las ramas LEFT/RIGHT/DEFAULT. Solo setear `pan` y `tilt`.

#### Cirugía 1.3 — Movement Override (líneas ~1015-1045)

Mismo tratamiento. Eliminar los seteos de `physicalPan` / `physicalTilt`.

### Fase 2: CERRAR LA PUERTA TRASERA — Re-envío de Hephaestus

**Problema**: Después de que Hephaestus modifica los estados, se re-envían con `hal.sendStates()` que bypasea physics.

**Solución**: En lugar de `sendStates()` (que envía raw), usar un método que aplique physics:

```typescript
// ANTES (💀):
if (hephOutputs.length > 0) {
  this.hal.sendStates(fixtureStates)  // Bypasea physics
}

// DESPUÉS (✅):  
if (hephOutputs.length > 0) {
  // Re-renderizar con physics aplicada a los nuevos targets de Hephaestus
  const physicsApplied = this.hal.renderFromTarget(fixtureStates)
  // El render ya envía al driver internamente
}
```

**Alternativa más quirúrgica**: Crear un método `hal.sendWithPhysics(states)` que solo aplique physics de movimiento sin re-calcular ópticas dinámicas.

### Fase 3: BROADCAST CORRECTO

**Problema**: El broadcast al frontend lee `physicalPan` del fixtureState (que puede estar teletransportado).

**Solución**: Después de la Fase 1 y 2, esto se resuelve automáticamente — `physicalPan` solo será escrito por el physics engine con valores interpolados. Pero como medida defensiva:

```typescript
// Línea ~1444: Preferir physicalPan del último render de HAL
physicalPan: (f.physicalPan ?? f.pan) / 255
// Con las cirugías 1.1-1.3, f.physicalPan vendrá del physics engine ✅
```

### Fase 4: HARDENING (Post-cirugía)

1. **Type Guard**: Hacer `physicalPan` readonly en `FixtureState` para que solo el physics engine pueda escribirlo (o usar un wrapper type)
2. **Assertion en FixtureMapper**: Si `|physicalPan - pan| > SAFETY_THRESHOLD` en un solo frame, logear warning
3. **Unit Test**: Simular secuencia de targets incrementales y verificar que physicalPan nunca salta más de MAX_VELOCITY * dt

---

## 📊 RESUMEN DE IMPACTO

| Ruta | Visual (Simulador) | DMX (Hardware) | Fix |
|------|-------------------|----------------|-----|
| Hephaestus pan/tilt | 💀 TELEPORT | 💀 TELEPORT | Cirugía 1.1 + 2 |
| Stereo movement | 💀 TELEPORT | 💀 TELEPORT | Cirugía 1.2 + 2 |
| Movement override | 💀 TELEPORT | 💀 TELEPORT | Cirugía 1.3 + 2 |
| renderFromTarget() | ✅ OK | ✅ OK | No necesita fix |
| Visual Gate (ARMED) | N/A (blackout) | N/A | No necesita fix |

---

## 🎯 ORDEN DE EJECUCIÓN

1. **Fase 1** (10 min): Eliminar los 3 seteos de `physicalPan = pan` en TitanOrchestrator
2. **Fase 2** (15 min): Reemplazar `sendStates()` por re-render con physics  
3. **Fase 3** (5 min): Verificar broadcast (debería resolverse automáticamente)
4. **Fase 4** (30 min): Hardening, type guards, assertions

**Esfuerzo total estimado**: ~1 hora de cirugía limpia.

---

## 📎 ARCHIVOS INVOLUCRADOS

| Archivo | Líneas | Rol |
|---------|--------|-----|
| `src/core/orchestrator/TitanOrchestrator.ts` | ~955, ~970, ~983, ~1019, ~1031, ~1044, ~1147-1155, ~1249, ~1444 | 💀 EPICENTRO |
| `src/hal/HardwareAbstraction.ts` | ~684-694, ~1243-1250 | 🔧 Puerta trasera (sendStates) |
| `src/hal/mapping/FixtureMapper.ts` | ~476-477 | Víctima (lee physicalPan corrupto) |
| `src/engine/movement/FixturePhysicsDriver.ts` | Completo | ✅ Funciona (pero es ignorado) |
| `src/chronos/ui/stage/StageSimulatorCinema.tsx` | ~786 | Víctima (muestra physicalPan corrupto) |

---

*"El motor de físicas es una obra maestra que nadie usa. Como un Stradivarius en un desván."*
— PunkOpus, WAVE 2085
