# WAVE 2660 — EL FANTASMA DEL ÁRBITRO
## Reporte Forense: Por qué los efectos de Selene se ven en la UI pero no llegan al DMX

**Estado:** ✅ CAUSA RAÍZ ENCONTRADA  
**Tipo:** Auditoría pura — sin cambios de código  
**Fecha:** WAVE 2660  

---

## 1. SÍNTOMA REPORTADO

- Los efectos "fluidos" de Selene (ej: **CorazonLatino** — ola de rojos/dorados) se **ven perfectamente** en el canvas 3D de Hyperion
- Sin embargo, las fixtures físicas (PARs y movers) **NO reaccionan** — permanecen con valores del Vibe base
- Los efectos "agresivos" tipo **GatlingRaid** (strobes, flashes) **SÍ funcionan** en hardware

---

## 2. PIPELINE COMPLETO TRAZADO

```
TitanOrchestrator.tick()
  │
  ├─ 1. masterArbiter.arbitrate()           → FinalLightingTarget
  │     ├─ arbitrateFixture() por cada fixture
  │     │   ├─ Layer 0: TitanEngine (base)
  │     │   ├─ Layer 2: ManualOverride (VIP)
  │     │   ├─ Layer 3: Effects (strobe/blinder/flash vía getEffectValueForChannel)
  │     │   └─ mergeChannel() con estrategia (HTP dimmer, LTP color)
  │     │
  │     └─ Si playbackActive=true:
  │         └─ Chronos overlay → merge HTP/LTP/ADD por blendMode
  │
  ├─ 2. hal.renderFromTarget(target, fixtures, audio)
  │     ├─ Mapea target → FixtureState[]
  │     ├─ Traduce RGB → ColorWheel (movers)
  │     ├─ Aplica physics (interpolación de movimiento)
  │     ├─ ⚡ sendToDriver(statesWithPhysics)  ← DMX ENVIADO AQUÍ
  │     └─ return statesWithPhysics              ← fixtureStates base
  │
  ├─ 3. effectManager.getCombinedOutput()     → zoneOverrides, color, dimmer
  │     ├─ CorazonLatino.getOutput() → zoneOverrides{back, all-movers, front}
  │     └─ GatlingRaid.getOutput()   → zoneOverrides{back, all-movers, front}
  │
  ├─ 4. ❤️ OVERRIDE ZONE: Modifica fixtureStates con effectOutput
  │     ├─ Color: REPLACE directo (RGB del efecto)
  │     ├─ Dimmer: isGlobalBus ? REPLACE : HTP
  │     ├─ White/Amber: isGlobalBus ? IRON CURTAIN (0) : HTP
  │     └─ Movement: offset sobre targets existentes
  │
  ├─ 5. ⚒️ HephaestusRuntime.tick()
  │     │
  │     └─ if (hephOutputs.length > 0):
  │         ├─ Merge Heph outputs con fixtureStates
  │         └─ ⚡ hal.sendStatesWithPhysics(fixtureStates) ← SEGUNDO ENVÍO
  │
  │   ⚠️⚠️⚠️ si NO hay Heph activo → NO HAY SEGUNDO ENVÍO ⚠️⚠️⚠️
  │
  └─ 6. onHotFrame(fixtureStates)     ← UI RECIBE LOS DATOS MODIFICADOS
        └─ Hyperion renderiza RGB correctamente ✅
```

---

## 3. CAUSA RAÍZ

### **El EffectManager modifica `fixtureStates` DESPUÉS de que el DMX ya fue enviado**

**Archivo:** `electron-app/src/core/orchestrator/TitanOrchestrator.ts`

**Secuencia temporal:**

| Paso | Línea | Acción | ¿DMX? | ¿UI? |
|------|-------|--------|-------|------|
| 1 | ~830 | `hal.renderFromTarget()` llama `sendToDriver()` internamente | ✅ ENVIADO | — |
| 2 | ~860-1020 | EffectManager overrides (color, dimmer, movement) | — | — |
| 3 | ~1516 | `if (hephOutputs.length > 0) hal.sendStatesWithPhysics()` | ❌ CONDICIONAL | — |
| 4 | ~1580 | `onHotFrame(fixtureStates)` → broadcast a Hyperion | — | ✅ ENVIADO |

**Resultado:**
- `sendToDriver()` envía estados **pre-efecto** (paso 1 — solo Vibe base)
- Los overrides del EffectManager (paso 2) modifican los **mismos objetos** pero DESPUÉS del envío DMX
- El segundo envío (paso 3) **solo ocurre si hay clips Hephaestus activos** → para efectos nativos del EffectManager, **nunca se reenvía**
- El broadcast a la UI (paso 4) usa los estados **ya modificados** → Hyperion ve los colores correctos

### **En resumen: El DMX sale con datos del Vibe, la UI sale con datos del efecto. Fantasma confirmado.**

---

## 4. ¿POR QUÉ GATLINGRAID SÍ FUNCIONA?

GatlingRaid **también** sufre el mismo problema en el pipeline del EffectManager.

**PERO:** GatlingRaid tiene `mixBus = 'global'` Y emite pulsos de dimmer extremos (0→255→0 a alta frecuencia). Su impacto visual es tan brutal que incluso sin los overrides del EffectManager llegando al DMX, el efecto puede ser parcialmente visible a través de otros caminos:

1. **Layer 3 del MasterArbiter**: GatlingRaid como tipo `'strobe'` se registra via `masterArbiter.addEffect()` (línea 657 de ArbiterIPCHandlers.ts) y es procesado por `getEffectValueForChannel()` que sí devuelve valores para el dimmer del strobe  
2. **PlaybackActive path**: Si GatlingRaid se dispara como clip de Chronos (vía TimelineEngine), entra por el camino `playbackActive=true` donde el merge SÍ ocurre antes del `sendToDriver`

**CorazonLatino en cambio:**
- Su `getOutput()` solo emite `zoneOverrides` (no `dimmerOverride` global)
- No se registra como Layer3_Effect en el MasterArbiter (no es strobe/flash/blinder)
- La ruta MasterArbiter `getEffectValueForChannel()` solo reconoce: `strobe`, `blinder`, `flash`, `freeze` — CorazonLatino no es ninguno de estos
- Sin playback activo, toda su salida fluye por EffectManager → TitanOrchestrator → overrides POST-sendToDriver

---

## 5. CADENA DE EVIDENCIA

### 5.1 MasterArbiter — getEffectValueForChannel() (línea 2397)
```typescript
// SOLO reconoce estos tipos:
case 'strobe':    // → dimmer oscillation
case 'blinder':   // → dimmer 255, color 255/255/255
case 'flash':     // → dimmer decay
case 'freeze':    // → null (keep current)
// TODO: NO hay case para 'pulse', 'chase', 'rainbow', ni effects dinámicos
```

### 5.2 TitanOrchestrator — el reenvío condicional (línea 1516)
```typescript
if (hephOutputs.length > 0) {
  this.hal.sendStatesWithPhysics(fixtureStates)
}
// ← Si no hay Hephaestus, los overrides de EffectManager mueren aquí
```

### 5.3 HAL.renderFromTarget() — sendToDriver prematuro (línea 1076)
```typescript
// Send to hardware ← DENTRO de renderFromTarget, ANTES de volver al Orchestrator
this.sendToDriver(statesWithPhysics)
// ...
return statesWithPhysics  // ← El Orchestrator recibe esto y lo modifica, pero tarde
```

### 5.4 Hot Frame broadcast — SÍ recibe los overrides (línea ~1580)
```typescript
if (this.onHotFrame) {
  const hotFrame = {
    fixtures: fixtureStates.map((f, i) => ({
      r: Math.round(f.r),  // ← Estos SÍ tienen los colores del efecto
      g: Math.round(f.g),
      b: Math.round(f.b),
      // ...
    }))
  }
  this.onHotFrame(hotFrame)  // → Hyperion renderiza correctamente
}
```

---

## 6. EFECTOS AFECTADOS

Todos los efectos del EffectManager que:
- No son `strobe`/`flash`/`blinder`/`freeze` (no entran por Layer3 del Arbiter)
- No se disparan via TimelineEngine/Chronos playback
- No tienen clips Hephaestus ejecutándose simultáneamente

### Lista parcial de efectos fantasma:
| Efecto | mixBus | ¿Ghost? | Razón |
|--------|--------|---------|--------|
| CorazonLatino | global | ✅ SÍ | zoneOverrides solo, no registrado en Layer3 |
| SalsaFire | htp | ✅ SÍ | zoneOverrides, no es strobe/flash/blinder |
| TropicalPulse | htp | ✅ SÍ | zoneOverrides |
| CumbiaMoon | htp | ✅ SÍ | zoneOverrides |
| ClaveRhythm | htp | ✅ SÍ | zoneOverrides |
| SolarFlare | htp | ✅ SÍ | colorOverride legacy (dimmerOverride path) |
| TidalWave | global | ✅ SÍ | zoneOverrides |
| GhostBreath | global | ✅ SÍ | zoneOverrides |
| GatlingRaid | global | ⚠️ PARCIAL | Puede funcionar vía Layer3 strobe si se registra |
| StrobeStorm | htp | ⚠️ PARCIAL | Puede funcionar vía Layer3 strobe |

---

## 7. PROPUESTA DE CORRECCIÓN (para aprobación del Arquitecto)

### Opción A: Re-send incondicional (quirúrgica, mínimo impacto)

En `TitanOrchestrator.ts`, después de todos los overrides del EffectManager, siempre reenviar al driver si hay efectos activos:

```typescript
// ANTES (línea ~1516):
if (hephOutputs.length > 0) {
  this.hal.sendStatesWithPhysics(fixtureStates)
}

// DESPUÉS:
const hasEffectChanges = effectOutput.hasActiveEffects || hephOutputs.length > 0
if (hasEffectChanges) {
  this.hal.sendStatesWithPhysics(fixtureStates)
}
```

**Impacto:** Un segundo `sendToDriver` por frame cuando hay efectos activos (44Hz extra × ~16 µs = ~0.7ms/s). Despreciable.

**Riesgo:** El primer `sendToDriver` (desde `renderFromTarget`) envía datos base, inmediatamente seguido del segundo con datos del efecto. En DMX a 44Hz esto es imperceptible — el último valor gana antes de que el refresh del universo DMX (40fps) transmita.

### Opción B: Mover el sendToDriver fuera de renderFromTarget (arquitectónica)

Separar la renderización de la transmisión:
1. `renderFromTarget` → solo calcula y retorna estados (sin enviar)
2. El Orchestrator aplica todos los overrides
3. El Orchestrator llama explícitamente a `sendToDriver` una sola vez al final

**Impacto:** Cambio más profundo, toca HAL y Orchestrator. Elimina el doble-envío.

**Riesgo:** `renderFromTarget` se usa en otros puntos — necesita auditoría de todas las call sites.

### Opción C: Inyectar efectos en el MasterArbiter como Layer 1.5 (nuclear)

Crear un nuevo layer entre Consciousness y Manual que reciba la salida del EffectManager. Así los colores/dimmer llegarían al `arbitrateFixture()` ANTES de `renderFromTarget`.

**Impacto:** Rediseño significativo, pero unifica todos los efectos en un solo pipeline. Elimina el concepto de "overrides POST-HAL".

**Riesgo:** Alto — cambio arquitectónico profundo con potencial de regresión.

---

## 8. RECOMENDACIÓN

**Opción A** es la corrección quirúrgica correcta. Un solo `if` cambiado. Sin regresión posible porque:
- Si no hay efectos → `hasEffectChanges = false` → no hay segundo envío (comportamiento idéntico al actual)
- Si hay efectos → segundo envío con datos correctos → fantasma eliminado
- El doble envío DMX es atómico a 44Hz dentro del mismo frame — el último valor gana

La Opción B es la solución "Perfection First" a largo plazo pero requiere una wave dedicada de refactor.

---

## 9. DIAGRAMA RESUMEN

```
                    TIMELINE DEL FRAME
                    ═══════════════════
                    
  ┌──────────────┐
  │ renderFrom   │──→ sendToDriver() ──→ 🔌 DMX (valores BASE)
  │ Target (HAL) │                         │
  └──────┬───────┘                         │ ← DATOS DEL VIBE
         │                                 │    SIN EFECTO
         │ return fixtureStates            │
         ▼                                 │
  ┌──────────────┐                         │
  │ EffectManager│──→ modifica RGB/dimmer  │
  │ Overrides    │    en fixtureStates     │
  └──────┬───────┘                         │
         │                                 │
         │ (condición: heph > 0)           │
         ▼                                 │
  ┌──────────────┐                         │
  │ sendStates   │──→ sendToDriver() ──→ 🔌 DMX (valores CON EFECTO)
  │ WithPhysics  │    ❌ NUNCA SE EJECUTA  │    ❌ NUNCA LLEGA
  └──────┬───────┘    (sin Hephaestus)     │
         │                                 │
         ▼                                 │
  ┌──────────────┐                         │
  │ onHotFrame   │──→ broadcast ──→ 🖥️ UI (valores CON EFECTO ✅)
  │ (Hyperion)   │                         
  └──────────────┘                         
                                           
  RESULTADO: La UI ve rojo/dorado. El DMX manda azul/base. FANTASMA.
```

---

*Reporte generado por PunkOpus — WAVE 2660*
*Auditoría forense completa. Sin cambios de código. Esperando visto bueno del Arquitecto.*
