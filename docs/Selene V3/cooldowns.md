

Necesito leer las secciones exactas del Sovereign Clock y del log V3 para hacer las ediciones precisas.

Necesito ver el `FluidStateSnapshot` para saber qué campos están disponibles para la telemetría:

Necesito ver si los descriptores ΠMΔG son accesibles desde el [LiquidVerdict](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/intelligence/liquid/LiquidCognitionCore.ts:26:0-43:1) o si están encapsulados:



Necesito ver cómo DecisionMaker usa `v3Epicness` para alinear el Sovereign Clock:

Tengo toda la información necesaria. Procedo con las ediciones.

**PASO 1:** Sovereign Clock — reemplazar Z-score hardcodeado con V3 epicness.
**PASO 2:** Telemetría alta fidelidad en V3 IGNITE log.

Primero, necesito exponer los descriptores ΠMΔG desde [LiquidCognitionCore](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/intelligence/liquid/LiquidCognitionCore.ts:100:0-293:1):

Ahora añado un getter para los descriptores en [LiquidCognitionCore](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/intelligence/liquid/LiquidCognitionCore.ts:100:0-293:1):
Ahora el **PASO 1**: Extirpar el Z-score hardcodeado del Sovereign Clock y reemplazarlo con `v3Epicness`:

PASO 1 completo. Ahora **PASO 2**: Telemetría de alta fidelidad en el V3 IGNITE log:

Ahora verifico que `tsc --noEmit` esté limpio:

`tsc --noEmit` limpio (0 errores). PASOS 1 y 2 completados. Ahora el reporte de cooldowns. Necesito revisar todos los cooldowns del sistema para dar el reporte completo:

Ahora déjame revisar los cooldowns del EffectManager (HARD_COOLDOWN individual por efecto):







Ahora déjame también revisar el V3.4 mood multiplier en LiquidCognitionCore para el reporte:



Tengo toda la información. Ahora compile el reporte completo de cooldowns.

Todo completado. `tsc --noEmit` limpio (0 errores). Aquí va el reporte:

---

# PASO 1 + 2: Cambios aplicados

## PASO 1 — Sovereign Clock curado

**Archivo:** `SeleneTitanConscious.ts:593-609`

El bloque `DIVINE LEAK FIX B` del Sovereign Clock usaba Z-score hardcodeado (2.0/2.5/3.5σ). Ahora usa **V3 epicness** con el mismo `V3_EPSILON_DIVINE = 0.25` que `DecisionMaker.ts:271`. Si el efecto es divine y `epicness ≤ 0.25`, se aborta. Si `epicness > 0.25`, Cassandra dispara con confianza.

## PASO 2 — Telemetría de alta fidelidad V3 IGNITE

**Archivo:** `SeleneTitanConscious.ts:736-754`

El log ahora muestra en cada IGNITE:
- `C` (confianza), `Q` (squelch), `I_fx` (intensidad), [epicness](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/intelligence/liquid/CognitiveFluidState.ts:283:2-283:50)
- `I(t)` (impacto raw), `CF` (crest factor), `T` (tensión), `μ` (viscosidad), `V` (presión vapor), `X` (excitabilidad)
- `Π` (percusividad), `M` (melodicidad), `Δ` (suciedad), `G` (groove)

**Getter añadido** en `LiquidCognitionCore.ts:192` para exponer los descriptores sin alloc.

---

# PASO 3: Reporte completo del estado de cooldowns en V3

Hay **5 capas de cooldown** activas en V3. Cada una puede bloquear independientemente. Las listo de fuera hacia dentro:

## Capa 1: Global Effect Cooldown (pipeline gate)

**Ubicación:** `SeleneTitanConscious.ts:374,377,1231-1244`

| Vibe | Base | × CALM (4.0) | × BALANCED (2.2) | × PUNK (0.7) |
|------|------|-------------|-------------------|-------------|
| fiesta-latina | 5000ms | 20s | **11s** | 3.5s |
| resto | 7000ms | 28s | **15.4s** | 4.9s |

**Bypasses:** `isDropUrgent`, `isDropIncoming`, `_v3Ignite` — todos bypassean esta capa.

**Just-Fired Shield:** 2000ms adicionales **sin bypass posible** — ni drops ni V3 ignite lo saltan.

## Capa 2: Pipeline Execution Throttle

**Ubicación:** `SeleneTitanConscious.ts:362`

- **2000ms** entre ejecuciones del pipeline del Dreamer
- **Bypass:** Solo drops urgentes (`estimatedTimeMs < 800` && `probability > 0.80`)
- Si el global cooldown bypassea (V3 ignite), el pipeline corre, pero este throttle puede bloquear la **segunda ejecución** si la primera fue hace <2s

## Capa 3: Post-Drop Refractory Lock

**Ubicación:** `SeleneTitanConscious.ts:387,1536-1551`

- **4000ms** de bloqueo post-efecto de alta severidad (heavy/divine/strobe)
- Solo bloquea candidatos **menores** — otro heavy/divine sí puede pasar
- **No tiene bypass de V3** — V3 ignite no está en la condición de bypass

## Capa 4: HARD_COOLDOWN individual por efecto (Dictator)

**Ubicación:** `ContextualEffectSelector.ts:84-98`

Estos son **mínimos absolutos** que **ningún bypass puede saltar** (ni V3, ni DNA override, ni drops):

| Efecto | Hard Minimum |
|--------|-------------|
| latina_meltdown | 25s |
| solar_flare | 20s |
| abyssal_rise | 20s |
| oro_solido | 22s |
| gatling_raid | 15s |
| core_meltdown | 12s |
| neon_blinder | 12s |
| strobe_storm | 12s |
| surgical_strike | 10s |
| industrial_strobe | 8s |

## Capa 5: Cooldown normal por efecto (EFFECT_COOLDOWNS)

**Ubicación:** `ContextualEffectSelector.ts:100-168`

Cada efecto tiene un cooldown base que **se multiplica por `cooldownMultiplier` del mood**:

| Efecto | Base | × BALANCED (2.2) | × CALM (4.0) | × PUNK (0.7) |
|--------|------|-------------------|-------------|-------------|
| solar_flare | 30s | 66s | 120s | 21s |
| corazon_latino | 30s | 66s | 120s | 21s |
| cumbia_moon | 25s | 55s | 100s | 17.5s |
| strobe_burst | 25s | 55s | 100s | 17.5s |
| oro_solido | 28s | 61.6s | 112s | 19.6s |
| tropical_pulse | 28s | 61.6s | 112s | 19.6s |
| abyssal_rise | 30s | 66s | 120s | 21s |
| industrial_strobe | 8s | 17.6s | 32s | 5.6s |
| acid_sweep | 8s | 17.6s | 32s | 5.6s |
| gatling_raid | 8s | 17.6s | 32s | 5.6s |
| cyber_dualism | 10s | 22s | 40s | 7s |

**Fallback:** Si un efecto no está en `EFFECT_COOLDOWNS`, usa `minCooldownMs = 800ms` (o `15000ms` si es mutante con `:`).

## Capa V3: Mood multipliers en Liquid Cognition (NUEVO V3.4)

**Ubicación:** `LiquidCognitionCore.ts:110-113`

Estos **no son cooldowns** pero afectan la frecuencia de ignición:

| Mood | Q_base × | tau_min/max × | Efecto |
|------|---------|---------------|--------|
| calm | 1.25 | 1.5 | Squelch más alto + refractariedad más larga → menos ignitions |
| balanced | 1.0 | 1.0 | Perfil base |
| punk | 0.75 | 0.5 | Squelch bajo + refractariedad corta → más ignitions |

**Valores base:** `Q_base = 0.550`, `tau_min = 1.5s`, `tau_max = 9.0s`, `epsilon_divine = 0.25`

## EnergyOverride (no es cooldown pero mata efectos)

**Ubicación:** `SeleneTitanConscious.ts:677-689`, [ConsciousnessOutput.ts](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/core/protocol/ConsciousnessOutput.ts:0:0-0:0)

- Si `smoothedEnergy > 0.75` → retorna output fijo con `effectDecision: null`
- **Return inmediato** — V3 ni se ejecuta en esos frames
- En fiesta-latina, la energía vive en 0.75-0.84 → override intermitente

---

## Análisis: ¿Por qué solo 1 efecto en 5 minutos?

El problema es **acumulación de capas**. En BALANCED con fiesta-latina:

1. **Global cooldown:** 11s entre oportunidades (5000 × 2.2)
2. **Pipeline throttle:** 2s entre ejecuciones del dreamer
3. **HARD_COOLDOWN de latina_meltdown:** 25s mínimo absoluto
4. **HARD_COOLDOWN de solar_flare:** 20s mínimo absoluto
5. **Post-Drop Refractory:** 4s bloqueando candidatos menores tras un heavy
6. **EnergyOverride:** corta el pipeline en frames donde energía > 0.75

El efecto que se disparó (EPIC-6c5c por Sovereign Clock) fue el único que:
- Pasó el global cooldown (Sovereign Clock bypassea)
- Pasó el HARD_COOLDOWN individual (era un efecto sin hard minimum)
- No fue divine (o tenía epicness > 0.25)

Los divine candidates (latina_meltdown, solar_flare) se abortaban por Z-score en el Sovereign Clock — **eso ya está curado**. Pero sus HARD_COOLDOWN de 25s/20s siguen siendo ley absoluta.

## Recomendaciones (no aplicadas)

- **El `cooldownMultiplier = 2.2` de BALANCED es muy agresivo** para fiesta-latina. 5000 × 2.2 = 11s significa que después de cada efecto, hay 11s donde ni siquiera V3 ignite puede disparar (a menos que bypasse). Considerar reducir a 1.5-1.8.
- **El Post-Drop Refractory no tiene bypass de V3** — V3 ignite debería poder saltarlo si el fluido dice "fuego ahora".
- **EnergyOverride return prematuro** — debería permitir que V3 se ejecute y vetoar solo el output final, no cortar todo el pipeline.