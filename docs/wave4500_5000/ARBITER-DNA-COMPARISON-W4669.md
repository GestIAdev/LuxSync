# ARBITER DNA COMPARISON — WAVE 4669

**Auditoria realizada:** 2026-05-08  
**Scope:** MasterArbiter (ArbitrationDirector) legacy vs NodeArbiter (Aether Matrix)  
**Auditor:** Kimi (Forense comparativa de remiendos de negocio)

---

## RESUMEN EJECUTIVO

El `NodeArbiter` actual es un motor de merge **generico y limpio** (HTP/LTP puro, zero-alloc). El `ArbitrationDirector` legacy era un **monolito de logica de negocio** con 18+ remiendos (waves) que protegian fixtures, operadores y el show. **La mayoría NO han sido migrados.**

| # | Funcionalidad Perdida | Severidad | Estado en NodeArbiter | Linea Legacy |
|---|---|---|---|---|
| 1 | **MOVER SHIELD** (WAVE 3304/3307) | **CRITICO** | ❌ NO MIGRADO | `ArbitrationDirector.ts:525-538` |
| 2 | **DIMMER AUTO-TAKE** (WAVE 2497) | **CRITICO** | ❌ NO MIGRADO | `ArbitrationDirector.ts:346-354` |
| 3 | **POSITION RELEASE FADE** (WAVE 2074.3) | ALTO | ❌ NO MIGRADO | `ArbitrationDirector.ts:1037-1051` |
| 4 | **CROSSFADE ENGINE** (todos los canales) | ALTO | ❌ NO MIGRADO | `ArbitrationDirector.ts:447-453,1233-1238` |
| 5 | **TEST MODE HEARTBEAT** (WAVE 380) | MEDIO | ❌ NO MIGRADO | `ArbitrationDirector.ts:1161-1167` |
| 6 | **MOVE-IN-BLACK shutter=0** (WAVE 3240) | MEDIO | ⚠️ PARCIAL (egress?) | `ArbitrationDirector.ts:1131-1139` |
| 7 | **GHOST WHITE DETECTOR** (WAVE 2770) | BAJO | ❌ NO MIGRADO | `ArbitrationDirector.ts:927-954` |
| 8 | **LAYER LOSS DETECTOR** (WAVE 2770) | BAJO | ❌ NO MIGRADO | `ArbitrationDirector.ts:899-916` |
| 9 | **UNDEFINED SANITIZER** (WAVE 2772) | MEDIO | ⚠️ PARCIAL (WAVE 4664 fixed bridge) | `ArbitrationDirector.ts:330-341` |
| 10 | **NaN BOMB SHIELD** (WAVE 2750) | MEDIO | ❌ NO MIGRADO | `ArbitrationDirector.ts:1099` |
| 11 | **LAST-KNOWN COLORS FREEZE** (L2 color lock) | MEDIO | ❌ NO MIGRADO | `ArbitrationDirector.ts:1444-1457` |
| 12 | **PATTERN ENGINE** (7 tipos) | BAJO | ✅ REEMPLAZADO (VMM L0) | `ArbitrationDirector.ts:1250-1307` |
| 13 | **GROUP FORMATIONS** (fan/spread) | BAJO | ❌ NO MIGRADO | `ArbitrationDirector.ts:1310-1351` |
| 14 | **HSL→RGB per fixture** | BAJO | ✅ REEMPLAZADO (upstream) | `ArbitrationDirector.ts:1416-1457` |
| 15 | **ZONE STEREO ROUTING** (frontL/R) | BAJO | ✅ REEMPLAZADO (upstream) | `ArbitrationDirector.ts:1390-1408` |
| 16 | **PLAYBACK HYBRID** (HTP/LTP/ADD) | MEDIO | ❌ NO MIGRADO | `ArbitrationDirector.ts:785-846` |
| 17 | **CONTROL SOURCE TRACKING** (VIP Passport) | BAJO | ❌ NO MIGRADO | `ArbitrationDirector.ts:1011-1021` |
| 18 | **GRAND MASTER SPEED** | BAJO | ❌ NO MIGRADO | `ArbitrationDirector.ts:175,605` |

---

## 🔬 FORENSE POR CATEGORIA

---

### 1. FILTROS DE ENTRADA (Input Sanitizers)

#### 1A — MOVER SHIELD (WAVE 3304 + WAVE 3307)

**Legacy (ArbitrationDirector):**
```ts
ArbitrationDirector.ts:525-538
setEffectIntents(intents: EffectIntentMap): void {
  // WAVE 3305: Strip movement from ALL effect intents
  // WAVE 3307: Strip color/white/amber from movers on global effects
  for (const [fixtureId, intent] of intents) {
    delete intent.movement

    if (intent.mixBus === 'global' && !intent.overrideMoverShield) {
      const fixtureMeta = this.fixtures.get(fixtureId)
      if (fixtureMeta && this.isMovingFixture(fixtureMeta)) {
        delete intent.color
        delete intent.white
        delete intent.amber
      }
    }
  }
  this.layerState.setEffectIntents(intents)
}
```

**Analisis:** El legacy **protegia a los movers de efectos globales** (ej. blinder rojo sobre toda la pista) borrando `color`, `white`, `amber` del intent si el fixture era un mover y el efecto era `mixBus='global'`. Esto evitaba que un efecto global cambiara el color de un mover mecanico mientras este hacia un pattern o seguia al operador.

**NodeArbiter:**
- NO tiene concepto de `fixtureMeta` (no conoce tipos de fixture).
- NO tiene concepto de `isMovingFixture()`.
- NO filtra intents por tipo de fixture.
- L3 (effects) aplica HTP/LTP puro sobre todo nodo sin distincion.

**Riesgo:** Si Selene o un efecto L3/L3+ envia `color: {r:1,g:0,b:0}` a un nodo `COLOR` de un mover, el NodeArbiter lo aplica. El mover cambia de color mientras el operator lo maneja. **Esto puede causar parpadeos y perdida de foco en el show.**

**Recomendacion:** Inyectar Mover Shield en `SeleneAetherAdapter` (que SI conoce families/nodes) o anadir un filtro post-arbitraje en `AetherUIProjector`/`NodeResolver`.

#### 1B — STRIP MOVEMENT FROM EFFECT INTENTS (WAVE 3305)

**Legacy:** `delete intent.movement` en TODOS los effect intents.

**NodeArbiter:** `SeleneAetherAdapter._processZoneOverrides()` SI descarta `movement` (linea 301). Pero los efectos L3 (LiveFXEngine) y L3+ (Hephaestus) NO son filtrados. Si un grafo Forge o un Diamond Data curve envia `pan`/`tilt` como parte de un intent, el NodeArbiter lo aplica.

**Riesgo:** Movimiento no-autorizado desde efectos graficos (Forge/Hephaestus) puede sobreescribir posiciones manuales o de L0.

#### 1C — UNDEFINED SANITIZER (WAVE 2772)

**Legacy:**
```ts
ArbitrationDirector.ts:330-341
const sanitizedControls: Record<string, unknown> = {}
for (const [key, val] of Object.entries(override.controls)) {
  if (val !== undefined) sanitizedControls[key] = val
}
override = { ...override, controls: sanitizedControls }
override = {
  ...override,
  overrideChannels: override.overrideChannels.filter(
    ch => sanitizedControls[ch] !== undefined || ch === 'dimmer'
  ),
}
```

**NodeArbiter:** NO sanitiza. Recibe `Record<string, number>` desde `ProgrammerAetherBridge` (que fue corregido en WAVE 4664 para no enviar `undefined`). Pero si un consumidor directo llama `setManualOverride(nodeId, {pan: undefined})`, el valor `undefined` se escribe al record y luego se convierte en `NaN` al resolver.

**Riesgo:** `NaN` en DMX puede causar comportamiento indefinido en hardware.

---

### 2. LOGICA DE MEZCLA (Blending)

#### 2A — ESTRATEGIA HTP/LTP LEGACY vs NUEVA

**Legacy (mergeChannelForFixture):**
```
Para cada canal:
  1. L0 (Titan) aporta valor base
  2. L2 (Manual) puede reemplazar base (si overrideChannels incluye el canal)
  3. L3 (EffectIntents) aplica con Mover Shield
     - mixBus='global' + dimmer → return directo
     - mixBus='global' + otro canal → return directo (si no shield)
     - mixBus!='global' + dimmer → Math.max(base, intent)
     - mixBus!='global' + otro canal → return intent
  4. Legacy L3 (strobe/blinder/flash/freeze) → return directo
  5. Crossfade back to AI (si habia release reciente)
  6. mergeChannel() final (HTP/LTP/BLEND segun DEFAULT_MERGE_STRATEGIES)
```

**NodeArbiter:**
```
Para cada canal:
  1. L0 (SystemBus) → LTP overwrite
  2. L1 (SeleneBus) → LTP overwrite
  3. LP (Playback) → LTP overwrite
  4. L3 (Effects) → LTP overwrite
  5. L3+ (Hephaestus) → LTP overwrite
  6. L2 (Manual) → LTP overwrite (con pan_base/tilt_base orbita)
  7. Grand Master * HTP channels
  8. Inhibit limits * dimmer
```

**Diferencias criticas:**
- **Dimmer en L3 no-mixBus global:** Legacy hacia `Math.max(base, intent)`. NodeArbiter hace `LTP overwrite` (el intent reemplaza completamente). Si L3 pone dimmer=0.5 y L0 tenia 0.8, legacy daba 0.8, NodeArbiter da 0.5.
- **Mover Shield:** Legacy bloqueaba L3 color en movers. NodeArbiter no.
- **Crossfade:** Legacy tenia transiciones suaves al soltar L2. NodeArbiter hace snap instantaneo.

#### 2B — CROSSFADE ENGINE

**Legacy:**
```ts
ArbitrationDirector.ts:437-478
releaseManualOverride(fixtureId, channels) {
  // Para cada canal liberado, inicia crossfade desde valor manual actual
  // hasta el valor Titan actual, usando override.releaseTransitionMs
  this.crossfadeEngine.startTransition(fixtureId, channel, currentValue, targetValue, durationMs)
}
```

```ts
ArbitrationDirector.ts:1232-1238
if (this.crossfadeEngine.isTransitioning(fixtureId, channel)) {
  const crossfadedValue = this.crossfadeEngine.getCurrentValue(fixtureId, channel, titanValue, titanValue)
  controlSources[channel] = ControlLayer.TITAN_AI
  return crossfadedValue
}
```

**NodeArbiter:** NO tiene CrossfadeEngine. Cuando `clearManualOverride()` es llamado, el nodo desaparece de `_manualOverrides` y en el siguiente frame L2 ya no aplica. **Snap instantaneo.**

**Riesgo:** Al soltar un fader de pan/tilt, el fixture salta instantaneamente a la posicion de L0/L1. Sin la inercia del `PhysicsPostProcessor` (que actua en valores ya arbitrados), esto seria violento. **Afortunadamente, el PhysicsPostProcessor amortigua el salto en la ruta clasica/IK.** Pero en ruta Forge, el salto es instantaneo.

#### 2C — POSITION RELEASE FADE (WAVE 2074.3)

**Legacy:**
```ts
ArbitrationDirector.ts:1037-1051
const releaseFade = this.positionReleaseFades.get(fixtureId)
if (releaseFade) {
  const elapsed = now - releaseFade.startTime
  if (elapsed >= releaseFade.durationMs) {
    this.positionReleaseFades.delete(fixtureId)
  } else {
    const t = elapsed / releaseFade.durationMs
    const smoothT = t * t * (3 - 2 * t)  // smoothstep
    pan = releaseFade.fromPan + (effectAdjustedPan - releaseFade.fromPan) * smoothT
    tilt = releaseFade.fromTilt + (effectAdjustedTilt - releaseFade.fromTilt) * smoothT
  }
}
```

**NodeArbiter:** NO tiene release fade. Al soltar pan/tilt manual, el valor L2 desaparece y L0/L1 toma el control instantaneamente.

**Riesgo:** Jarring UX para operadores. El salto se amortigua solo si pasa por PhysicsPostProcessor (ruta clasica/IK). Ruta Forge = salto brusco.

---

### 3. PROTECCIONES DINAMICAS (Dynamic Guards)

#### 3A — DIMMER AUTO-TAKE (WAVE 2497)

**Legacy:**
```ts
ArbitrationDirector.ts:346-354
setManualOverride(override) {
  // ...sanitizado...
  const finalOverride = this.layerState.getManualOverride(fixtureId)
  if (finalOverride && !finalOverride.overrideChannels.includes('dimmer')) {
    const titanValues = this.getTitanValuesForFixture(fixtureId)
    if (titanValues.dimmer === 0) {
      finalOverride.controls = { ...finalOverride.controls, dimmer: 255 }
      finalOverride.overrideChannels = [...finalOverride.overrideChannels, 'dimmer']
    }
  }
}
```

**Logica de negocio:** Si un operator agarra el control de un fixture (pan/tilt) pero NO toco el dimmer, y el fixture esta apagado (dimmer=0 en L0), **auto-encenderlo a 255** para que el operator vea lo que esta haciendo.

**NodeArbiter:** NO implementado. Si L2 solo envia `pan`/`tilt` y L0/L1 tiene `dimmer=0`, el fixture permanece oscuro mientras el operator lo mueve.

**Riesgo:** **CRITICO para UX del operator.** Un mover que se agarra manualmente pero no enciende es invisible en el show.

**Recomendacion:** Inyectar en `ProgrammerAetherBridge` o en `programmerStore`. Cuando el operator envia un override sin dimmer, anadir dimmer=1.0 (o heredar el dimmer actual del fixture).

#### 3B — NaN BOMB SHIELD (WAVE 2750)

**Legacy:**
```ts
ArbitrationDirector.ts:1099-1103
const lastPos = this.lastKnownPositions.get(fixtureId)
const safePan = Number.isFinite(pan) ? pan : (lastPos?.pan ?? 128)
const safeTilt = Number.isFinite(tilt) ? tilt : (lastPos?.tilt ?? 128)
```

**NodeArbiter:** NO valida NaN/Infinity en los valores de entrada. Si un intent contiene `NaN`, se propaga hasta el buffer DMX.

**Riesgo:** Hardware DMX con `NaN` (o `undefined` que se convierte en `NaN`) puede causar comportamiento impredecible.

#### 3C — GHOST WHITE DETECTOR (WAVE 2770)

**Legacy:**
```ts
ArbitrationDirector.ts:927-954
if (r >= 250 && g >= 250 && b >= 250 && !paletteHasWhite) {
  console.warn(`[GHOST_WHITE] ${target.fixtureId} RGB(${r},${g},${b}) src=${srcLabel}...`)
}
```

**NodeArbiter:** NO tiene detector de blanco fantasma.

**Riesgo:** Si un bug envia blanco puro (RGB 255,255,255) cuando no deberia, no hay alerta.

#### 3D — LAYER LOSS DETECTOR (WAVE 2770)

**Legacy:**
```ts
ArbitrationDirector.ts:899-916
for (const prevId of this._prevFrameOverrideIds) {
  if (!this._currentOverrideIdsBuf.has(prevId)) {
    this._layerLossPending.push(prevId)
  }
}
if (this._layerLossPending.length > 0 && now - this._layerLossThrottleMs > 2000) {
  console.warn(`[LAYER_LOSS] ${this._layerLossPending.length} fixture(s) lost Layer 2 override`)
}
```

**NodeArbiter:** NO detecta perdida repentina de overrides manuales.

**Riesgo:** Un bug que borre L2 inadvertidamente no sera detectado.

#### 3E — LAST-KNOWN COLORS FREEZE

**Legacy:**
```ts
ArbitrationDirector.ts:1439-1457
const hasColorOverride = manualOverrideForBunker
  ? manualOverrideForBunker.overrideChannels.some(ch => getChannelCategory(ch) === 'color')
  : false

if (hasColorOverride) {
  const frozen = this.lastKnownColors.get(fixtureId)
  if (frozen) {
    defaults.red = frozen.r
    defaults.green = frozen.g
    defaults.blue = frozen.b
  }
}
```

**Logica:** Cuando L2 tiene override de color, el L0 (Titan) **congela** su color en el ultimo valor conocido en lugar de seguir animando. Esto evita que L0 "pelee" con L2 por el color.

**NodeArbiter:** NO tiene este freeze. L0 y L1 siguen animando debajo de L2. Como L2 es LTP y se aplica despues, el color final es el de L2. **Pero** L0/L1 estan consumiendo CPU y generando intents que se descartan. Ademas, si L2 libera el color, el salto es abrupto al color actual de L0/L1 (que puede ser muy diferente del ultimo conocido).

**Riesgo:** Ineficiencia + snap brusco al soltar color manual.

---

### 4. FEATURES REEMPLAZADAS vs PERDIDAS

#### 4A — REEMPLAZADAS (Funcionan en nuevo pipeline)

| Feature | Reemplazo | Estado |
|---|---|---|
| HSL→RGB | `SeleneAetherAdapter` (Selene ya exporta RGB) | ✅ Funcional |
| Zone Stereo Routing | `ZoneNodeRouter` + `SeleneAetherAdapter` | ✅ Funcional |
| Pattern Engine (7 tipos) | `VibeMovementManager` (L0 KineticSystem) | ✅ Funcional |
| Inhibit Limits | `_inhibitLimits` en NodeArbiter | ✅ Preservado |
| Grand Master | `_grandMaster` en NodeArbiter | ✅ Preservado |
| Blackout flag | `_blackout` en NodeArbiter + egress gate | ✅ Preservado |

#### 4B — PERDIDAS (Sin reemplazo en Aether)

| Feature | Impacto | Archivo/Linea a inyectar |
|---|---|---|
| **Mover Shield** | Efectos globales colorean movers | `SeleneAetherAdapter.ts` o `NodeArbiter.ts` |
| **Dimmer Auto-Take** | Mover manual oscuro | `ProgrammerAetherBridge.ts` o `programmerStore.ts` |
| **Position Release Fade** | Snap brusco al soltar | `PhysicsPostProcessor.ts` o `NodeArbiter.ts` |
| **Crossfade Engine** | Snap en todos los canales | Nuevo archivo `AetherCrossfader.ts` |
| **Test Mode Heartbeat** | Fixtures apagados sin Titan | `ImpactSystem.ts` o `NodeArbiter.ts` |
| **Playback Hybrid Blend** | Chronos sin modos HTP/LTP/ADD | `NodeArbiter.ts` (capa LP) |
| **Group Formations** | Sin fan/spread de grupo | Nuevo archivo `AetherFormationSystem.ts` |
| **Grand Master Speed** | Sin control de velocidad de patterns | `VibeMovementManager.ts` |
| **Control Source Tracking** | Sin telemetria de capa | `NodeArbiter.ts` (campos `_controlSources`) |

---

## RECOMENDACIONES DE RE-INYECCION (Ordenadas por Riesgo)

### 🔴 P0 — Antes de conectar hardware real

**1. Mover Shield**
- **Donde inyectar:** `SeleneAetherAdapter._processZoneOverrides()` o `NodeArbiter._applyIntent()`
- **Logica:** Si el intent es de L3 (effects) o L1 (Selene global) y el nodo pertenece a un fixture `isMovingFixture()`, descartar canales `red`, `green`, `blue`, `white`, `amber` del intent.
- **Nota:** El NodeArbiter no conoce fixtures. Hay dos opciones:
  - Opcion A: `SeleneAetherAdapter` filtra por `ZoneNodeRouter` + metadata de fixture (si la tiene).
  - Opcion B: Anadir `fixtureType` metadata a `INodeGraph`/`INodeData` y que NodeArbiter la consulte.

**2. Dimmer Auto-Take**
- **Donde inyectar:** `ProgrammerAetherBridge.ts:extractImpact()` o `programmerStore.ts:setPosition()`
- **Logica:** Si se envia un override de pan/tilt pero NO hay override de dimmer, anadir `dimmer: 1.0` al intent.
- **Cuidado:** Solo si el fixture actualmente tiene dimmer=0. Si ya esta encendido, no interferir.

### 🟡 P1 — Mejora de UX antes de produccion

**3. Position Release Fade**
- **Donde inyectar:** `PhysicsPostProcessor.ts` o nuevo `AetherCrossfader.ts`
- **Logica:** Cuando L2 libera `pan`/`tilt`, interpolar suavemente desde la ultima posicion manual hacia la nueva posicion L0/L1 durante 500ms usando smoothstep.
- **Nota:** El `PhysicsPostProcessor` ya maneja inercia. Podria extenderse para manejar "fades de release" como un tipo especial de inercia con target fijo.

**4. Crossfade Engine (todos los canales)**
- **Donde inyectar:** Nuevo `AetherCrossfader.ts` llamado desde `TitanOrchestrator` post-arbitraje.
- **Logica:** Al detectar que un nodo perdio un canal en L2, iniciar transicion desde valor anterior hacia nuevo valor durante `defaultCrossfadeMs`.

**5. NaN Shield + Undefined Sanitizer**
- **Donde inyectar:** `NodeArbiter._applyIntent()` o `NodeResolver`
- **Logica:** `if (!Number.isFinite(incoming)) continue;` en `_applyIntent`. Y en `setManualOverride`: `for (const k in channels) if (channels[k] === undefined) delete channels[k]`.

### 🟢 P2 — Nice to have

**6. Ghost White Detector**
- Inyectar en `AetherUIProjector` o `NodeResolver` como log de telemetria.

**7. Layer Loss Detector**
- Inyectar en `ProgrammerAetherBridge` o `NodeArbiter` comparando `_manualOverrides.size` frame a frame.

**8. Playback Hybrid Blend Modes**
- Extender `NodeArbiter` para que la capa LP (playback) soporte HTP/LTP/ADD en lugar de LTP puro.

---

## DIAGRAMA DE PERDIDAS EN EL PIPELINE

```
LEGACY (ArbitrationDirector)                    NUEVO (NodeArbiter + Aether)
═══════════════════════════════════════════════════════════════════════════════

Selene/EffectManager                              SeleneAetherAdapter
       │                                                   │
       ▼                                                   ▼
[MOVER SHIELD] ──────── ❌ PERDIDO ───────► [NO FILTER] ───┐
[Strip movement] ────── ✅ REEMPLAZADO ──► [Descarta en   │
                                             _processZone]  │
       │                                                   │
       ▼                                                   ▼
LayerStateManager                                 IIntentBus (L0/L1/L2/L3/LP)
       │                                                   │
       ▼                                                   ▼
ArbitrationDirector.arbitrate()                   NodeArbiter.arbitrate()
       │                                                   │
       ├──► mergeChannelForFixture()                ├──► _applyIntent()
       │     ├──► HTP/LTP/BLEND/OVERRIDE            │     ├──► HTP (dimmer)
       │     ├──► Mover Shield (L3)                 │     ├──► LTP (resto)
       │     ├──► Crossfade (release)               │     ├──► L2 orbita (pan_base)
       │     └──► Control Sources                   │     └──► Grand Master
       │                                                   │
       ├──► getTitanValuesForFixture()              ├──► (Upstream en adapters)
       │     ├──► Zone stereo routing                 │
       │     ├──► Palette role assignment             │
       │     ├──► HSL→RGB per fixture                 │
       │     ├──► Last-known color freeze              │
       │     └──► Position from intent                 │
       │                                                   │
       ├──► getAdjustedPosition()                   ├──► (En L0 systems)
       │     ├──► Pattern Engine (7 types)              │
       │     ├──► Group Formations                    │
       │     └──► Position Release Fade                │
       │                                                   │
       ├──► Dimmer Auto-Take (L2)                    ├──► (NO IMPLEMENTADO)
       │                                                   │
       ├──► NaN Shield / Ghost White                  ├──► (NO IMPLEMENTADO)
       │                                                   │
       └──► Playback Hybrid (HTP/LTP/ADD)            └──► LP como LTP puro
       │                                                   │
       ▼                                                   ▼
FinalLightingTarget                               ArbitratedNodeMap
       │                                                   │
       ├──► Move-In-Black (shutter=0)                 ├──► Blackout en egress
       │                                                   │
       ▼                                                   ▼
HAL.renderFromTarget()                            NodeResolver.resolve()
                                                          + AetherSafetyMiddleware
```

---

*Fin del informe WAVE 4669. Proxima accion recomendada: implementar MOVER SHIELD (P0) y DIMMER AUTO-TAKE (P0) antes de la conexion de hardware real.*
