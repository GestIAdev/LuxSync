# WAVE 2710 — REPORTE DIAGNÓSTICO FORENSE

**Fecha:** 2025-07-10  
**Autor:** PunkOpus  
**Tipo:** Auditoría de código — **SIN MODIFICACIONES**  
**Estado:** ✅ AMBAS HIPÓTESIS CONFIRMADAS

---

## HIPÓTESIS 1: SECUESTRO CROMÁTICO EN LAYER 2

### Veredicto: ✅ CONFIRMADA

### Síntoma Reportado
Cuando el usuario activa el control manual de posición (PositionSection), el color del fixture se congela en el último valor previo. Layer 0 (Titan/Selene) y Layer 3 (efectos) pierden completamente la autoridad sobre el color, que queda estático hasta que se libera el override manual.

### Arma del Crimen: MEMORY MERGE (WAVE 440)

**Archivo:** `MasterArbiter.ts` — `setManualOverride()` (líneas 457-498)

Cuando se setea un override manual, si ya existe uno previo para el mismo fixture, se ejecuta un **merge acumulativo**:

```ts
const mergedControls = {
    ...existingOverride.controls,     // Controles viejos (ej: {red: 255, green: 100, blue: 50})
    ...override.controls,             // Controles nuevos (ej: {pan: 128, tilt: 64})
}
const mergedChannels = [...new Set([
    ...existingOverride.overrideChannels,   // ['red', 'green', 'blue']
    ...override.overrideChannels,           // ['pan', 'tilt']
])]
// Resultado: mergedChannels = ['red', 'green', 'blue', 'pan', 'tilt']
// Resultado: mergedControls = {red: 255, green: 100, blue: 50, pan: 128, tilt: 64}
```

### Cadena Causal Completa

```
┌────────────────────────────────────────────────────────────────────┐
│ T=0: Usuario toca ColorSection → envía override:                  │
│      controls: {red: 255, green: 100, blue: 50}                   │
│      channels: ['red', 'green', 'blue']                           │
│      → layer2_manualOverrides.set(fixtureId, override)            │
├────────────────────────────────────────────────────────────────────┤
│ T=1: Usuario toca PositionSection → envía override:               │
│      controls: {pan: 128, tilt: 64}                               │
│      channels: ['pan', 'tilt']                                    │
│      → MEMORY MERGE activa (existingOverride encontrado)          │
│                                                                    │
│      mergedControls = {red: 255, green: 100, blue: 50,            │
│                        pan: 128, tilt: 64}                         │
│      mergedChannels = ['red','green','blue','pan','tilt']          │
├────────────────────────────────────────────────────────────────────┤
│ T=2+: Cada frame, mergeChannelForFixture() evalúa 'red':          │
│                                                                    │
│      overrideChannels.includes('red') → TRUE                      │
│      → return getManualChannelValue(override, 'red')              │
│      → controls.red ?? 0 → 255 (valor congelado de T=0)           │
│      → DIRECT RETURN — Layer 0 y Layer 3 IGNORADOS                │
│                                                                    │
│      ¡El color NUNCA se actualiza porque PositionSection           │
│       solo envía pan/tilt, pero el merge preservó red/green/blue! │
├────────────────────────────────────────────────────────────────────┤
│ T=3: Usuario suelta ColorSection (clearManual channels:           │
│      ['red','green','blue'])                                       │
│      → releaseManualOverride con partial release                   │
│      → remainingChannels = ['pan', 'tilt']                         │
│      → AHORA sí: overrideChannels.includes('red') → FALSE         │
│      → Color vuelve a Layer 0/Layer 3 ✓                           │
│                                                                    │
│      PERO: Si el usuario suelta PositionSection PRIMERO y NO el   │
│      color, el override completo se elimina → color vuelve.       │
│      El bug solo persiste mientras AMBOS overrides coexisten.     │
└────────────────────────────────────────────────────────────────────┘
```

### Agravante: DIMMER AUTO-TAKE (WAVE 2497)

**Líneas 510-535:** Si Layer 0 dimmer es 0, se inyecta automáticamente `dimmer: 255` y `'dimmer'` en `overrideChannels`. Esto añade UN canal más al merge acumulativo. No causa el bug directamente, pero contribuye a la opacidad del override: el usuario ve luz (dimmer=255 inyectado) con un color congelado que no corresponde a nada.

### Archivos Involucrados

| Archivo | Líneas | Rol |
|---------|--------|-----|
| `MasterArbiter.ts` | 457-498 | MEMORY MERGE — acumula `overrideChannels` |
| `MasterArbiter.ts` | 1857-1866 | `mergeChannelForFixture()` — Layer 2 ABSOLUTE PRIORITY |
| `MasterArbiter.ts` | 2471-2490 | `getManualChannelValue()` — devuelve valor congelado |
| `MasterArbiter.ts` | 510-535 | DIMMER AUTO-TAKE — inyecta dimmer |
| `PositionSection.tsx` | 283-310 | Envía `channels: ['pan', 'tilt']` — inocente |
| `ArbiterIPCHandlers.ts` | 160-310 | Construye `Layer2_Manual` desde IPC |
| `types.ts` | 262-315 | `ManualControls` (all optional), `Layer2_Manual` |

---

## HIPÓTESIS 2: CONFLICTO BÚNKER — SafetyLayer vs LatinaMeltdown

### Veredicto: ✅ CONFIRMADA

### Síntoma Reportado
Flash blanco y bloqueo permanente de color durante LatinaMeltdown en fixtures mecánicos (Beam 2R con rueda de color). El fixture queda enclavado en blanco después de un LatinaMeltdown.

### Mecanismo de Fallo: Triple Emboscada en el Pipeline

#### 1. LatinaMeltdown BYPASSEA el HarmonicQuantizer

El HarmonicQuantizer (WAVE 2672) **solo opera en TitanOrchestrator** sobre efectos de Layer 0 (EffectIntentMap). Los efectos del TimelineEngine/Chronos — como LatinaMeltdown — viajan por un pipeline COMPLETAMENTE DIFERENTE:

```
PIPELINE TITAN (Layer 0):
  EffectManager → intentMap → HarmonicQuantizer.quantize() → setEffectIntents() → Arbiter
  ✅ Colores cuantizados al ritmo del beat

PIPELINE CHRONOS (TimelineEngine):
  effect.getOutput() → dispatchZoneOverrides() → frameAccumulator → setPlaybackFrame() → Arbiter
  ❌ SIN cuantización — los colores llegan RAW al HAL
```

**Archivo:** `TitanOrchestrator.ts` líneas 960-1000 — El `harmonicQuantizer.quantize()` solo se invoca sobre `intentMap`, nunca sobre `currentPlaybackFrame`.

#### 2. LatinaMeltdown excede el Chaos Threshold

LatinaMeltdown genera 6 hits en 1500ms con configuración:
- `preBlackoutMs: 40ms`
- `flashDurationMs: 110ms`  
- `gapMs: 100ms`
- Ciclo por hit: 250ms
- **Frecuencia de cambio: 4 colores/segundo**

```
SafetyLayer chaos threshold: 3 cambios/segundo
LatinaMeltdown frecuencia:   4 cambios/segundo
              → EXCEDE THRESHOLD → CHAOS LATCH ACTIVADA
```

**Archivo:** `HardwareSafetyLayer.ts` líneas 135-180

#### 3. Chaos Latch congela en WHITE (DMX 0)

Cuando la chaos latch se activa:

```ts
state.isLatched = true
state.latchedColorDmx = state.lastColorDmx  // ← El color PREVIO al caos
state.latchStartTime = now
```

Si el fixture estaba en DMX 0 antes del LatinaMeltdown (estado por defecto, o después del último DarkSpin blackout), `latchedColorDmx = 0`.

En el perfil BEAM_2R_PROFILE:

```ts
{ dmx: 0, name: 'Open (White)', rgb: { r: 255, g: 255, b: 255 } }
```

**DMX 0 = WHITE/OPEN.** El latch congela en BLANCO durante `latchDurationMs = 2000ms`.

#### 4. Strobe Delegation amplifica el flash

Cuando `blockedChanges > 10`, SafetyLayer activa `delegateToStrobe: true`:

```ts
strobe: safetyResult.delegateToStrobe ? safetyResult.suggestedShutter : state.strobe
```

El shutter se sobreescribe con un strobe calculado (`128 + intensity * 127`). Si el color está latcheado en WHITE y el strobe arranca... **FLASH BLANCO ESTROBOSCÓPICO.**

#### 5. Cascada completa

```
┌─────────────────────────────────────────────────────────────────────┐
│ Frame N: LatinaMeltdown activo, zona 'movers'                      │
│   → NARANJA_FUSION (h:30) dispatchado vía TimelineEngine           │
│   → setPlaybackFrame() → Arbiter HYBRID mode                       │
│   → arbitrate() produce FixtureLightingTarget con color naranja    │
│   → HAL.translateColorToWheel()                                    │
│     → ColorTranslator: RGB naranja → DMX 30 (Orange)              │
│     → SafetyLayer.filter(fixtureId, 30, profile, dimmer)           │
│       → updateChangeHistory: recentChanges.push(now)               │
│       → calculateChangesPerSecond: ¡4 cambios en el último seg!    │
│       → changesPerSecond (4) > chaosThreshold (3)                  │
│       → ¡CHAOS LATCH ACTIVATED!                                    │
│       → latchedColorDmx = lastColorDmx (que era 0 = WHITE)        │
│       → return { finalColorDmx: 0, isInLatch: true }              │
│     → DarkSpinFilter: pendingColorDmx=0, lastColorDmx=15(Red)     │
│       → Color cambió → blackout transitorio                        │
│                                                                     │
│ Frames N+1 a N+120 (2000ms):                                      │
│   → Chaos latch activo                                              │
│   → SafetyLayer retorna SIEMPRE finalColorDmx=0 (WHITE)           │
│   → blockedChanges crece: 1, 2, 5, 10, 15...                      │
│   → blockedChanges > 10 → delegateToStrobe = true                  │
│   → suggestedShutter = 180 (strobe rápido)                         │
│   → HAL aplica: colorWheel=0 (WHITE) + strobe=180                  │
│   → RESULTADO: ¡FLASH BLANCO ESTROBOSCÓPICO!                       │
│                                                                     │
│ Frame N+120: Latch expira (2000ms)                                 │
│   → blockedChanges se resetea (WAVE 2095.1 KEA-006)               │
│   → SafetyLayer permite cambio normal                               │
│   → PERO: DarkSpinFilter detecta cambio 0→30 → blackout 500ms    │
│   → ¡OTRO blackout transitorio de medio segundo!                   │
│                                                                     │
│ Total tiempo perdido: ~2500ms de caos en un efecto de 1500ms       │
└─────────────────────────────────────────────────────────────────────┘
```

### Archivos Involucrados

| Archivo | Líneas | Rol |
|---------|--------|-----|
| `HardwareSafetyLayer.ts` | 135-180 | Chaos detection + latch activation |
| `HardwareSafetyLayer.ts` | 175-230 | Debounce blocking |
| `HardwareSafetyLayer.ts` | 320-340 | `shouldDelegateToStrobe()` + `calculateStrobeShutter()` |
| `HardwareAbstraction.ts` | 1430-1470 | Pipeline: SafetyLayer → DarkSpinFilter |
| `FixtureProfiles.ts` | 146 | DMX 0 = 'Open (White)' |
| `LatinaMeltdown.ts` | 70-85 | Config: 250ms/hit = 4 cambios/seg |
| `TitanOrchestrator.ts` | 960-1000 | HarmonicQuantizer SOLO en Layer 0 intents |
| `TimelineEngine.ts` | 620-790 | Timeline dispatch SIN cuantización |
| `HarmonicQuantizer.ts` | 1-290 | Módulo completo — no invocado por Timeline |

---

## BLUEPRINT: PLAN DE REFACTORING

### Fix 1: Aislamiento de Canales en Layer 2 (H1)

**Problema raíz:** `setManualOverride()` usa merge acumulativo de canales. Cada Section UI (Color, Position, Intensity) envía sus propios canales pero el merge los unifica en un solo override por fixture. Los canales de una Section quedan pegados incluso cuando otra Section los sobreescribe.

**Propuesta — Overrides Segmentados por Source:**

```
ACTUAL:
  layer2_manualOverrides: Map<fixtureId, Layer2_Manual>
  → UNA entrada por fixture con TODOS los canales mezclados

PROPUESTO:
  layer2_manualOverrides: Map<fixtureId, Map<SourceId, Layer2_Manual>>
  → UNA entrada por fixture POR CADA source (ColorSection, PositionSection, etc.)
  
  sourceId examples: 'color', 'position', 'intensity', 'beam'
```

**Merge en `mergeChannelForFixture()`:**
- Recorrer todos los sources activos para ese fixture
- Cada source solo reclama SUS canales
- Si dos sources reclaman el mismo canal → LTP (último gana)
- Cuando un source hace `clearManual` → solo se elimina ESE source

**Impacto:** MasterArbiter.ts — `setManualOverride()`, `releaseManualOverride()`, `mergeChannelForFixture()`. La interfaz IPC necesita agregar `sourceId` al payload.

**Archivos a modificar:**
- `electron-app/src/core/arbiter/MasterArbiter.ts`
- `electron-app/src/core/arbiter/ArbiterIPCHandlers.ts`
- `electron-app/src/core/arbiter/types.ts`
- `electron-app/src/components/hyperion/controls/PositionSection.tsx`
- `electron-app/src/components/hyperion/controls/ColorSection.tsx` (y todas las *Section.tsx)

### Fix 2: La Ley Ecléctica Extendida — Quantizer en Chronos (H2)

**Problema raíz:** El HarmonicQuantizer solo opera en TitanOrchestrator (Layer 0 intents). Los efectos de Chronos/TimelineEngine llegan RAW al HAL, donde el SafetyLayer reacciona con fuerza bruta.

**Propuesta — HarmonicQuantizer universal:**

Inyectar el HarmonicQuantizer en el pipeline de `translateColorToWheel()`, ANTES del SafetyLayer. Así:

```
ACTUAL:
  translateColorToWheel()
    → ColorTranslator.translate(RGB → colorWheelDmx)
    → SafetyLayer.filter(colorWheelDmx)
    → DarkSpinFilter.filter()

PROPUESTO:
  translateColorToWheel()
    → ColorTranslator.translate(RGB → colorWheelDmx)
    → HarmonicQuantizer.quantize(RGB, bpm, minChangeTimeMs)
      → Si colorAllowed=false → usar último color permitido
    → SafetyLayer.filter(quantizedColorDmx)
      → Casi nunca se activa porque el Quantizer ya gatea
    → DarkSpinFilter.filter()
```

**Beneficio:** El SafetyLayer se convierte en red de seguridad de ÚLTIMA instancia. El Quantizer resuelve el 95% de los conflictos musicalmente. No más chaos latch, no más strobe delegation, no más white flash.

**Problema secundario: BPM desde HAL.** El HAL no tiene acceso directo al BPM. Opciones:
1. Pasar BPM como parámetro adicional a `translateColorToWheel()`
2. Usar un singleton/global de audio state
3. Inyectar BPM en el ciclo de `update()` del HAL

**Archivos a modificar:**
- `electron-app/src/hal/HardwareAbstraction.ts` — `translateColorToWheel()`
- `electron-app/src/hal/translation/HarmonicQuantizer.ts` — posible refactor para aceptar DMX directo además de RGB
- `electron-app/src/core/orchestrator/TitanOrchestrator.ts` — remover invocación redundante del Quantizer (ya opera en HAL)

### Fix 3: SafetyLayer — Degradación Elegante (H2 complementario)

**Problema residual:** SafetyLayer existe como protección de hardware legítima. No debe eliminarse. Pero su chaos latch es demasiado agresiva (congela en white, delega a strobe).

**Propuesta — Chaos Latch Inteligente:**

1. **Cuando latch activa, NO congelar en `lastColorDmx` (que puede ser 0=WHITE).** En cambio, congelar en el **último color POSITIVO** (DMX > 0). Mantener un `lastPositiveColorDmx` separado.

2. **Eliminar strobe delegation.** Si DarkSpinFilter ya existe y maneja el blackout transitorio, el strobe delegation del SafetyLayer es redundante y peligroso. El SafetyLayer debería SOLO bloquear + mantener color anterior.

3. **Reducir latch duration de 2000ms a 1000ms.** 2 segundos de latch es excesivo para un efecto de 1500ms.

**Archivos a modificar:**
- `electron-app/src/hal/translation/HardwareSafetyLayer.ts`

---

## PRIORIDAD DE EJECUCIÓN

| Orden | Fix | Impacto | Riesgo |
|-------|-----|---------|--------|
| 1 | Fix 1: Overrides Segmentados | CRÍTICO — afecta toda interacción manual | MEDIO — refactor del Map interno |
| 2 | Fix 3: SafetyLayer inteligente | ALTO — elimina white flash inmediato | BAJO — cambios localizados |
| 3 | Fix 2: Quantizer en HAL | ALTO — solución sistémica | ALTO — requiere routing de BPM al HAL |

---

## NOTA FINAL

Ambos bugs son consecuencia del crecimiento orgánico del sistema. El MEMORY MERGE (WAVE 440) fue diseñado cuando solo había un tipo de override. La HardwareSafetyLayer (WAVE 1000) fue diseñada antes del HarmonicQuantizer (WAVE 2672) y del DarkSpinFilter (WAVE 2690). Cada solución fue correcta en su contexto original; el conflicto emerge de la interacción entre capas que nunca fueron diseñadas para coexistir.

No son bugs. Son fantasmas de decisiones arquitectónicas que se quedaron viviendo en el código sin saber que el mundo cambió a su alrededor.

— PunkOpus, Cónclave WAVE 2710
