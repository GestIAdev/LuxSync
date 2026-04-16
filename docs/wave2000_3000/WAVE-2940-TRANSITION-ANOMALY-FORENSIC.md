# WAVE 2940 — THE TRANSITION ANOMALY: DIAGNÓSTICO FORENSE

**Fecha**: Junio 2025  
**Investigador**: PunkOpus  
**Estado**: INVESTIGACIÓN COMPLETA — ESPERANDO CONFIRMACIÓN PARA ACTUAR  

---

## 1. EL SÍNTOMA

Durante transiciones de sección musical (e.g. `drop → verse`, `verse → buildup`), **TODOS los fixtures** (movers + PARs) sufren un apagón/espasmo de ~1 frame. El Layer 2 wiretap confirma que los overrides manuales NO se eliminan — persisten intactos a través de la transición.

---

## 2. RUTA COMPLETA DE EJECUCIÓN RASTREADA

```
┌─────────────────────────────────────────────────────────────────────┐
│ WORKER (senses.ts)                                                  │
│  ├─ GodEarFFT → AudioAnalysis (bass, mid, treble, energy)          │
│  ├─ SimpleSectionTracker.analyze() → SectionOutput                  │
│  │   └─ {type: 'drop'|'verse'|'buildup'|'breakdown', energy, ...} │
│  ├─ MoodSynthesizer, HarmonyDetector, RhythmDetector               │
│  └─ RETURN: AudioAnalysis + wave8 { section, rhythm, harmony }     │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │ IPC
┌──────────────────────────────────────▼──────────────────────────────┐
│ MAIN THREAD                                                         │
│                                                                     │
│ TrinityBrain.handleContextUpdate(context)                           │
│   └─ Construye MusicalContext con context.section                   │
│                                                                     │
│ TitanOrchestrator.processFrame()                                    │
│   ├─ context = brain.getCurrentContext()                            │
│   ├─ audio = lastAudioData (bass, mid, high, energy)               │
│   │                                                                 │
│   ├─ TitanEngine.update(context, audio)                            │
│   │   ├─ EnergyStabilizer.update()     ← EMA 0.70, 30 frames      │
│   │   ├─ KeyStabilizer.update()        ← 12s buffer               │
│   │   ├─ MoodArbiter.update()          ← 10s buffer               │
│   │   ├─ StrategyArbiter.update()      ← 15s rolling              │
│   │   │                                                             │
│   │   ├─ SeleneColorEngine.generate()                               │
│   │   ├─ ColorInterpolator.update()    ← 240-frame LERP            │
│   │   ├─ selenePaletteToColorPalette() ← HSL→normalized            │
│   │   │                                                             │
│   │   ├─ SeleneLux.updateFromTitan()   ← NervousSystem             │
│   │   │   ├─ Palette effects per-genre (accent, strobe)            │
│   │   │   └─ Omni-Liquid Engine → applyBands()                     │
│   │   │       └─ LiquidEngine71 or LiquidEngine41                  │
│   │   │       └─ Returns: frontL/R, backL/R, moverL/R intensities  │
│   │   │                                                             │
│   │   ├─ calculateMasterIntensity()    ← floor + (energy × range)  │
│   │   ├─ Zone intents override by NervousSystem zoneIntensities    │
│   │   ├─ Movement (VMM or Mechanics bypass)                        │
│   │   ├─ SeleneTitanConscious.process() ← DNA/consciousness        │
│   │   ├─ EffectManager.trigger() (if consciousness decides)        │
│   │   └─ RETURN: LightingIntent {palette, masterIntensity, zones}  │
│   │                                                                 │
│   ├─ masterArbiter.setTitanIntent(Layer0)                          │
│   ├─ effectManager.getCombinedOutput() → effectIntents             │
│   ├─ masterArbiter.setEffectIntents(Layer3)                        │
│   ├─ masterArbiter.arbitrate()                                     │
│   │   └─ Per fixture: arbitrateFixture()                           │
│   │       ├─ getTitanValuesForFixture() → zone→dimmer, HSL→RGB     │
│   │       ├─ Merge Layer 0-4 channels (LTP/HTP)                   │
│   │       ├─ Layer 2 manual overrides (WAVE 2910 guard)            │
│   │       └─ Layer 3 effect intents (if not Chronos-sealed)        │
│   │                                                                 │
│   ├─ hal.renderFromTarget(arbitratedTarget, fixtures, audio)       │
│   │   ├─ translateColorToWheel() (mechanical only)                 │
│   │   │   ├─ HarmonicQuantizer → gate to BPM                      │
│   │   │   ├─ SafetyLayer → debounce                               │
│   │   │   └─ DarkSpinFilter → blackout during wheel transit        │
│   │   ├─ FixturePhysicsDriver → pan/tilt interpolation             │
│   │   └─ sendToDriver() → DMX512/ArtNet                           │
│   │                                                                 │
│   └─ onBroadcast(truth) → UI                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. COMPONENTES DESCARTADOS (PRUEBA FORENSE)

| Componente | Sospecha | Evidencia de descarte |
|:---|:---|:---|
| **Layer 4 Blackout** | ¿Se activa automáticamente? | `setBlackout()` solo tiene llamadores manuales (IPC). No hay caller automático durante transiciones. |
| **Layer 2 Deletion** | ¿Se borran los overrides? | WIRETAP WAVE 2910 confirma persistencia. `LAYER_LOSS` detector no reporta pérdida. |
| **EnergyStabilizer** | ¿Produce 0 repentino? | EMA factor 0.70 con ventana 30 frames. Matemáticamente imposible: `new = 0.70×old + 0.30×input`. Incluso con input=0, la caída es gradual. Silence reset requiere 720 frames. |
| **SeleneColorInterpolator** | ¿L=0 durante transición? | LERP lineal 240 frames (4s normal, 0.5s drop). `l = from.l + (to.l - from.l) × t`. Nunca cero si ambos extremos > 0. DesaturationDip solo afecta S, no L. |
| **DarkSpinFilter** | ¿Apaga todos los fixtures? | Solo aplica a fixtures con `profile.safety.blackoutOnColorChange=true` (mecánicos con rueda). PARs LED jamás pasan por DarkSpin. |
| **MasterArbiter.reset()** | ¿Se llama durante transición? | Solo en `stop()` manual y constructor. Nunca durante operación normal. |
| **MasterArbiter.clearTitanState()** | ¿Se llama durante sección? | Solo en `TitanOrchestrator.stop()`. No durante transiciones. |
| **DNA Cache Invalidation** | ¿Reset borra dimmer? | `SeleneTitanConscious` solo nulifica `cachedDNA` → afecta recommendaciones de efectos, no dimmer/color. |
| **Post-HAL Mutation** | ¿Algo escribe después? | Eliminado por WAVE 2662. Single Source of Truth. |
| **SimpleSectionTracker** | ¿Produce energía 0? | Solo cambia `currentSection` (string). Retorna `energy: recentEnergy` que es promedio de últimos 16 frames — nunca 0 repentino. |
| **LiquidEngine.applyBands()** | ¿`isBreakdown` produce ceros? | `isBreakdown` es un flag booleano que se pasa a `EnvelopeFollower.process()`. Los envelopes son EMA — nunca producen 0 instantáneo. Silence path solo si `isRealSilence=true`. |
| **calculateMasterIntensity()** | ¿Produce 0? | `floor + (energy × (ceiling - floor))`. Con floor típico 0.1, incluso energy=0 da 0.1. Nunca 0. |
| **getTitanValuesForFixture()** | ¿Zone undefined → dimmer 0? | Fallback: `zoneIntent?.intensity ?? intent.masterIntensity`. Si zone no existe, usa masterIntensity (siempre > floor). |
| **Stampede Guard** | ¿Salta frame? | Solo salta si `isProcessingFrame=true`. Frame anterior sigue activo — no produce cambio en el output actual (conserva estado previo del arbiter). |
| **VMM (VibeMovementManager)** | ¿Apaga algo? | Solo controla pan/tilt. No afecta dimmer ni color. 2s LERP en transiciones de patrón. |

---

## 4. HIPÓTESIS RESTANTES (REQUIEREN INSTRUMENTACIÓN)

### Hipótesis A: ASYNC FRAME DROP + STALE LAYER 3

**Mecanismo propuesto:**
1. Frame N: `processFrame()` empieza, `engine.update()` tarda >16ms (async consciousness)
2. Frame N+1: llega nueva señal del Worker con nueva sección
3. Frame N+1: `processFrame()` es bloqueada por Stampede Guard (`isProcessingFrame=true`)
4. Frame N sale, pero `layer3_effectIntents.clear()` ya se ejecutó en `arbitrate()`
5. El resultado: 1 frame con Layer 3 vacío + intent del frame anterior

**Probabilidad:** BAJA. Esto no apaga las luces — solo pierde efectos por 1 frame. Los valores base de Layer 0 siguen intactos.

### Hipótesis B: CROSSFADE ENGINE RESET

**Mecanismo propuesto:**
El `MasterArbiter` tiene un `crossfadeEngine` que podría estar reseteándose en alguna condición de sección, produciendo un frame de transición con valores interpolados a 0.

**Probabilidad:** MEDIA. No investigado completamente — requiere leer `CrossfadeEngine`.

### Hipótesis C: BEAT DETECTOR PLL GLITCH

**Mecanismo propuesto:**
Cuando la sección cambia, el PLL (Phase-Locked Loop) del BeatDetector podría momentáneamente perder lock. Si `pllOnBeat` produce un falso negativo durante 1 frame y algún componente depende de ello para la intensidad...

**Probabilidad:** BAJA. La intensidad de zonas viene del LiquidEngine que usa audio bands directamente, no PLL beats.

### Hipótesis D: SHUTTER CHANNEL DEFAULT

**Mecanismo propuesto:**
En `renderFromTarget()`, el `shutter` de un fixture se deja como `undefined` (WAVE 2190). Si durante un frame de transición algo causa que `shutter` se resuelva a 0 en vez de 255 (Open), TODOS los fixtures con canal shutter se cerrarían instantáneamente.

**Probabilidad:** MEDIA. Necesita verificar la cadena `shutter → FixtureMapper → DMX`. Si alguna capa del merge resuelve `undefined` como 0 en vez de 255...

### Hipótesis E: FIXTURE MAPPER DMX DEFAULT ERROR

**Mecanismo propuesto:**
El `FixtureMapper` que convierte `FixtureState` → bytes DMX podría tener un bug de default que, en condiciones de transición, envía 0 a todos los canales.

**Probabilidad:** MEDIA-BAJA. Más un problema de hardware mapping que de lógica de negocio.

---

## 5. PLAN DE ACCIÓN RECOMENDADO

### Paso 1: SONDA FORENSE EN PROCESSFRAME

Inyectar un log **CONDICIONAL** que solo dispara cuando se detecta una transición de sección:

```typescript
// En TitanOrchestrator.processFrame(), DESPUÉS de engine.update():
if (context.section?.type !== this._lastTrackedSection) {
    const zones = intent.zones
    const dimmerSample = Object.entries(zones).map(([k, v]: [string, any]) => 
      `${k}:${(v?.intensity ?? 0).toFixed(3)}`
    ).join(' ')
    console.warn(
      `[🔬 WAVE 2940 PROBE] SECTION TRANSITION: ${this._lastTrackedSection} → ${context.section?.type} | ` +
      `masterIntensity=${intent.masterIntensity.toFixed(3)} | zones=[${dimmerSample}] | ` +
      `energy=${engineAudioMetrics.energy.toFixed(3)}`
    )
    this._lastTrackedSection = context.section?.type
}
```

### Paso 2: SONDA FORENSE EN ARBITRATE

Inyectar un log en `MasterArbiter.arbitrate()` que detecte cuando más del 50% de fixtures tienen dimmer < 5:

```typescript
// En MasterArbiter.arbitrate(), DESPUÉS del loop de fixtures:
const lowDimmerCount = Array.from(result.fixtures.values())
    .filter(f => f.dimmer < 5).length
const totalFixtures = result.fixtures.size
if (lowDimmerCount > totalFixtures * 0.5 && totalFixtures > 0) {
    console.error(
      `[🔬 WAVE 2940 PROBE] MASS BLACKOUT DETECTED: ${lowDimmerCount}/${totalFixtures} ` +
      `fixtures have dimmer < 5 | frame=${this.frameNumber}`
    )
}
```

### Paso 3: VERIFICAR SHUTTER CHAIN

Auditar `FixtureMapper` para verificar que `shutter=undefined` siempre se resuelve como 255 (Open) y nunca como 0 (Closed).

---

## 6. VEREDICTO PROVISIONAL

**La cadena de señal principal es CORRECTA y LIMPIA.** No hay ningún componente que, bajo condiciones normales de transición de sección, produzca ceros en la señal de dimmer o color.

El bug es probablemente **temporal y de sincronización**: algo ocurre en la INTERACCIÓN entre la llegada de la nueva sección, el procesamiento async del frame, y el estado transitorio de algún componente de merge o caché.

**Las hipótesis D (Shutter) y B (CrossfadeEngine) son las más probables** y requieren instrumentación activa para confirmar.

---

## 7. ARCHIVOS AUDITADOS

| Archivo | Líneas revisadas | Resultado |
|:---|:---|:---|
| `TrinityBridge.ts` (SimpleSectionTracker) | 1005-1250 | LIMPIO — solo cambia string |
| `senses.ts` (Worker) | 940-1170 | LIMPIO — datos frame-a-frame |
| `TrinityBrain.ts` | 130-230 | LIMPIO — pass-through de context |
| `TitanOrchestrator.ts` | 485-1060 | LIMPIO — pipeline lineal |
| `TitanEngine.ts` | 430-1320, 1895-2080 | LIMPIO — todo gradual/EMA |
| `SeleneLux.ts` | 415-750 | LIMPIO — NervousSystem routing |
| `LiquidEngineBase.ts` | 220-400 | LIMPIO — envelopes EMA |
| `SeleneColorEngine.ts` (Interpolator) | 2045-2200 | LIMPIO — 240-frame LERP |
| `EnergyStabilizer.ts` | 1-380 | LIMPIO — EMA 0.70 |
| `MasterArbiter.ts` | 1426-1950, 2342-2650, 3000-3030 | LIMPIO — merge correcto |
| `HardwareAbstraction.ts` | 880-1560 | LIMPIO — pass-through |
| `DarkSpinFilter.ts` | 1-200 | LIMPIO — solo mecánicos |

---

*"He abierto cada vena de esta bestia y toda la sangre fluye correcta. El bug no está en la anatomía — está en el pulso."*
