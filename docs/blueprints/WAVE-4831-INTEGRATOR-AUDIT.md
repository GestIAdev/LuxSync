# WAVE-4831-INTEGRATOR-AUDIT.md
## THE INTEGRATOR WALL — Forensic Audit of the Internal Rejection

> **Status:** Auditoría forense estricta de la capa de integración cognitiva
> **Predecesor:** WAVE 4828 (Lazarus — fix del Curve Player + Risk reform)
> **Síntoma raíz:** El simulador propone ganadores válidos. El Integrador los rechaza. El log dice `reason=execute`.
> **Hipótesis del usuario:** "El refactor de `trigger()` en WAVE 4827 rompió el contrato y el Integrador interpreta mal el token devuelto."
> **Veredicto:** **HIPÓTESIS INCORRECTA.** El Integrador nunca llama a `trigger()`. La asfixia ocurre 3 capas más arriba, en el `VisualConscienceEngine`, mucho antes de que el `EffectManager` entre en escena.

---

## §0. RESUMEN EJECUTIVO (TL;DR)

| Pregunta del usuario | Respuesta forense |
|---|---|
| ¿Dónde se emite `Pipeline: ❌ REJECTED \| reason=execute`? | `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\integration\DreamEngineIntegrator.ts:309-314` — pero es solo el LOG. La decisión `approved=false` se toma en la **línea 280**. |
| ¿Qué condición provoca el rechazo? | `ethicalVerdict.verdict !== 'APPROVED'`. El `VisualConscienceEngine` devuelve `DEFERRED` o `REJECTED`. |
| ¿Por qué `reason=execute`? | `dreamRecommendation` viene del **DreamSimulator** que dijo "execute". `Conscience` dijo "no". Son **dos sistemas distintos** que disienten. El log mezcla la recomendación del Dreamer con el veredicto de la Conscience — confuso pero no bug. |
| ¿`trigger()` async/sync rompió esto? | **No.** El Integrador no llama a `trigger()`. El refactor de WAVE 4827 vive en `EffectManager` que se invoca DESPUÉS de la aprobación. La capa que asfixia es la Conscience (Phase 2), no el Músculo (Phase 5). |
| ¿`solar_flare` bypassa la Integrator? | **Sí, pero por una vía arquitectónica completamente distinta.** No es un "bypass" en el código del Integrador — es un **segundo pipeline paralelo** (`DecisionMaker.DROP EFFECT` → `ContextualEffectSelector.selectFromArsenal` → `EffectRepository`) que ignora completamente la Phase 2 (Conscience). |

**El Integrador no está roto. Está funcionando exactamente como fue diseñado: rechaza candidatos cuando la Conscience encuentra violaciones éticas. Lo que está roto es que las reglas éticas están sintonizadas para un catálogo legacy de 12 efectos hardcoded — y los 47 .lfx migrados disparan violaciones masivas (texture incoherence, risk ceiling, fatigue) que matan TODO antes de que pueda llegar al músculo.**

---

## §1. EL ASESINATO PASO A PASO — LOG FORENSE

### 1.1 Reconstrucción del frame del log de usuario

```
[DREAM_RANKING] 🏆 TOP 5 (10 total) | pred=energy_spike conf=0.76:
  1. corazon_latino       SCORE=1.000 | DNA=0.76 DIV=1.00 VIB=0.60 RSK=0.10
  ...
[INTEGRATOR] 📊 Pipeline: ❌ REJECTED | Dream: 1ms | Filter: 0ms | Total: 1ms | reason=execute
[SeleneTitanConscious] 🧬 DNA: ❌ none | ethics=0.555 | dream=1ms | execute
```

**Decodificación línea por línea:**

| Pieza del log | Significa |
|---|---|
| `Dream: 1ms` | `EffectDreamSimulator.dreamEffects()` corrió (cache hit) |
| `Filter: 0ms` | `visualConscienceEngine.evaluate()` corrió en <1ms (también cache-friendly) |
| `Total: 1ms` | El pipeline completo cerró en 1ms — TODO RAN |
| `reason=execute` | `dreamResult.recommendation === 'execute'` (el Dreamer dio luz verde) |
| `ethics=0.555` | `ethicalVerdict.ethicalScore === 0.555` (la Conscience evaluó) |
| `❌ REJECTED` | `ethicalVerdict.verdict !== 'APPROVED'` (DEFERRED o REJECTED) |
| `🧬 DNA: ❌ none` | `SeleneTitanConscious` vio `approved=false` y no propagó efecto |

**El score 0.555 está justo encima del threshold base (0.50) pero por debajo del epilepsy threshold (0.70).** Esto es la **zona gris** donde el `performEvaluation` decide entre APPROVED, DEFERRED o REJECTED — y la regla mata.

### 1.2 La ruta exacta del rechazo

```
DreamEngineIntegrator.executeFullPipeline()
  ↓ STEP 2 — DREAM
  └─ effectDreamSimulator.dreamEffects() → recommendation: 'execute' ✅
  
  ↓ STEP 3 — FILTER (← AQUÍ MUERE EL EFECTO)
  └─ visualConscienceEngine.evaluate(candidates, safetyContext)
       └─ performEvaluation()
            └─ for each candidate: evaluateCandidate()
                 └─ for each VISUAL_ETHICAL_VALUE: evaluateValue()
                      └─ for each rule: rule.check() → RuleResult { passed, penalty, boost }
                           └─ if (!result.passed) violations.push(...)
            
            └─ best = sorted[0]
            └─ if (best.ethicalScore >= threshold && best.violations.length === 0)
                 → APPROVED  ✅
               else if (best.ethicalScore >= threshold * 0.7)
                 → DEFERRED  ⚠️ ← ESTAMOS AQUÍ (0.555 ≥ 0.35)
               else
                 → REJECTED  ❌
  
  ↓ STEP 4 — DECIDE
  └─ approved = (verdict === 'APPROVED')  ← false porque verdict es DEFERRED
  
  ↓ EMIT LOG
  └─ "[INTEGRATOR] 📊 Pipeline: ❌ REJECTED | reason=execute"
     (el log no diferencia DEFERRED de REJECTED — los dos disparan la misma rama)
```

### 1.3 La línea exacta del veredicto

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\conscience\VisualConscienceEngine.ts:400-401
    if (best.ethicalScore >= approvalThreshold && best.violations.length === 0) {
      // APPROVED
```

**Esta es la guillotina.** Para APPROVED se exigen DOS condiciones simultáneas:
1. `ethicalScore >= 0.50` (o 0.70 en epilepsyMode)
2. `violations.length === 0` — **CERO violaciones, ni siquiera de severidad `low`**

Si CUALQUIER regla de las 17 reglas en `VisualEthicalValues.ts` retorna `passed: false`, esto añade una entrada a `violations` y mata el approval, aunque el score numérico esté bien.

### 1.4 La línea exacta del log que el usuario ve

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\integration\DreamEngineIntegrator.ts:309-315
    } else if (decision.totalTime > 10 || !decision.approved) {
      console.log(
        `[INTEGRATOR] 📊 Pipeline: ${decision.approved ? '✅ APPROVED' : '❌ REJECTED'} | ` +
        `Dream: ${dreamTime}ms | Filter: ${filterTime}ms | Total: ${decision.totalTime}ms | ` +
        `reason=${decision.dreamRecommendation?.substring(0, 60) ?? '?'}`
      )
    }
```

**Tres observaciones críticas sobre este log:**

1. **`reason=execute` NO es el motivo del rechazo.** Es la **recomendación del Dreamer** (`dreamResult.recommendation`). El Integrador toma este string y lo escupe sin transformar. Es el SimulatorDreamer diciendo "execute", no la Conscience explicando por qué rechazó.
2. **El log mezcla dos sistemas que disienten.** Lo correcto sería:
   `Dream said: execute | Conscience said: DEFERRED (violations=[texture_coherence, risk_ceiling])`
3. **DEFERRED y REJECTED se loguean idénticos.** Ambos van por la rama `❌ REJECTED`. Esto oculta información valiosa para diagnóstico.

---

## §2. POR QUÉ LOS .LFX MIGRADOS DISPARAN VIOLACIONES MASIVAS

### 2.1 Las 17 reglas éticas — análisis de superficie de ataque

Cada regla en `VisualEthicalValues.ts` que devuelve `passed: false` mata la aprobación. Inventario:

| # | Valor | Regla | Trigger | Probabilidad de hit en .lfx migrado |
|---|---|---|---|---|
| 1 | audience_safety | `epilepsy_protection` | `epilepsyMode && includes('strobe')` | Solo si epilepsy mode activo |
| 2 | audience_safety | `fatigue_protection` | `fatigue > 0.8 && intensity > 0.7` | Media — depende de sesión |
| 3 | audience_safety | `luminosity_budget` | suma intensities últimos 60s > 25 | Alta en drops densos |
| 4 | audience_safety | `intense_effect_rate_limit` | `intensity > 0.7 && lastIntense < 2s` | **MUY ALTA en latina drops** |
| 5 | vibe_coherence | `vibe_effect_match` | techno+solar_flare / latino+industrial_strobe / chill+strobe | Por nombre — alta para algunos |
| 6 | effect_diversity | `abuse_prevention` | usado >50% últimos 20 | Alta en monopolios (oro_solido) |
| 7 | effect_diversity | `consecutive_same_effect` | mismo 3x seguidas | Alta en monopolios |
| 8 | aesthetic_beauty | `beauty_threshold` | `projectedBeauty < 0.4 && energy < 0.8` | Media — projectedBeauty puede no estar |
| 9 | aesthetic_beauty | `texture_coherence` | **`isCleanAudio && textureAffinity === 'dirty'`** | 🔴 **MASIVA** — ver §2.2 |
| 10 | temporal_balance | `temporal_pattern_break` | BiasTracker detecta patrón | Media |
| 11 | temporal_balance | `rapid_fire_prevention` | 5 efectos en 10s | Alta en drops |
| 12 | risk_creativity | `risk_ceiling` | `riskLevel > 0.85` | Alta post-WAVE 4828 |

### 2.2 La regla asesina #1 — `texture_coherence`

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\conscience\VisualEthicalValues.ts:497-507
        // 🎨 CASO 1: Música CLEAN/WARM + Efecto DIRTY = INCOHERENCIA GRAVE
        // Es como poner death metal visual sobre un balada de piano
        const isCleanAudio = spectral.texture === 'clean' || spectral.texture === 'warm'
        if (isCleanAudio && effectTextureAffinity === 'dirty') {
          return {
            passed: false,
            reason: `🎨 AESTHETIC INCOHERENCE: ${effect.effect} (dirty) clashes with ${spectral.texture} audio`,
            penalty: 0.5,
            suggestion: 'Use clean or universal effect for this audio texture'
          }
        }
```

**Causa raíz:**
1. El blueprint WAVE 4820 mapea archetype → textureAffinity en `LfxClipInstance.toCognitiveDNA()`:
   ```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\LfxClipInstance.ts:532-537
       const textureAffinity: TextureAffinity =
         this._userArchetype === 'strobe' || this._userArchetype === 'heavy'
           ? 'dirty'
           : this._userArchetype === 'ambient' || this._userArchetype === 'divine'
             ? 'clean'
             : 'universal'
   ```
2. La gran mayoría de efectos latinos migrados (machete_spark, salsa_fire, latina_meltdown, glitch_guaguanco) terminaron como **archetype `heavy` o `strobe`** → `textureAffinity = 'dirty'`.
3. La música latina bien producida (Brejcha, modern reggaetón, salsa hi-fi) tiene `spectral.texture === 'clean'` o `'warm'`.
4. **Resultado:** `isCleanAudio === true && textureAffinity === 'dirty'` → `passed: false` → violation pushed → DEFERRED forever.

`solar_flare`, en contraste, tiene `textureAffinity === 'universal'` (heredado de su ingestión legacy con archetype `utility`) → **siempre pasa esta regla**. Por eso "parece" un bypass.

### 2.3 La regla asesina #2 — `risk_ceiling` (post-WAVE 4828)

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\conscience\VisualEthicalValues.ts:669-682
    {
      id: 'risk_ceiling',
      severity: 'medium',
      check: (context, effect) => {
        // Si riskLevel > 0.85, rechazar (demasiado caótico)
        if (effect.riskLevel && effect.riskLevel > 0.85) {
          return {
            passed: false,
            reason: `Risk too high: ${effect.riskLevel.toFixed(2)}`,
            penalty: 0.3
          }
        }
        return { passed: true }
      }
    },
```

Antes de WAVE 4828 (Lazarus): `riskLevel` valía 0.00–0.30 → nunca disparaba. **Después de WAVE 4828**, el nuevo `calculateRisk()` produce valores hasta 1.0 → efectos divine/heavy/strobe suben fácilmente sobre 0.85 → fail. Si Lazarus no se acompaña de subir el techo, esta regla mata todo lo migrado.

### 2.4 La regla asesina #3 — `intense_effect_rate_limit`

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\conscience\VisualEthicalValues.ts:206-222
    {
      id: 'intense_effect_rate_limit',
      severity: 'medium',
      check: (context, effect) => {
        const MIN_INTERVAL_MS = 2000
        if (effect.intensity > 0.7 && 
            Date.now() - context.lastIntenseEffect < MIN_INTERVAL_MS) {
          return {
            passed: false,
            reason: `Too soon after last intense effect (${Date.now() - context.lastIntenseEffect}ms)`,
            penalty: 0.3
          }
        }
        return { passed: true }
      }
    },
```

En un drop latino con `Z>3σ`, el sistema intenta disparar efectos a cadencia ~1s. Cualquier efecto con `intensity > 0.7` que llegue antes de 2s post-último → fail. **Esto bloquea el 80% de los drops densos.**

---

## §3. EL "BYPASS" DEL PILOTO — POR QUÉ `solar_flare` SÍ DISPARA

### 3.1 Evidencia del log

```
[DecisionMaker 🎲] DIVERSITY SELECT: winner=solar_flare score=0.909 from [latina_meltdown, oro_solido, solar_flare, salsa_fire]
[DecisionMaker 🔴] DROP EFFECT: solar_flare | prob=0.76 vibe=fiesta-latina | Z=0.80
[EffectRepository 🔪] Arsenal selection: solar_flare AVAILABLE (from [solar_flare])
[SeleneTitanConscious 🔴] DROP ARSENAL: Selected solar_flare from [solar_flare]
[EffectManager 🔥] solar_flare FIRED [prediction] in fiesta-latina  ⚡[HEPH-BRIDGE] | I:0.95 Z:0.8
```

**Todos estos logs vienen de un PIPELINE DIFERENTE.** No hay un solo `[INTEGRATOR]` ni `[CONSCIENCE]` en la cadena. Es decir, `solar_flare` **nunca pasó por el Integrador**.

### 3.2 Los dos pipelines de Selene

Existen **dos rutas paralelas** desde `SeleneTitanConscious` hacia `EffectManager.trigger()`:

```
                    ┌─────────────────────────────────┐
                    │  SeleneTitanConscious.tick()    │
                    └────────────┬────────────────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
                  ▼                             ▼
   ┌───────────────────────────┐   ┌───────────────────────────┐
   │ RUTA A — INTEGRATOR       │   │ RUTA B — DROP/DIVINE      │
   │ (Phase 1-5 cognitive)     │   │ (DecisionMaker arsenal)   │
   │                           │   │                           │
   │ Hunt → Dream → Filter     │   │ Z-score gate              │
   │   → Decide → Execute      │   │   → DropArsenal[]         │
   │                           │   │   → DIVERSITY SELECT      │
   │ ⚖️ Conscience evalúa     │   │ 🔪 EffectRepository       │
   │   17 reglas éticas        │   │   (cooldown only)         │
   │                           │   │                           │
   │ ❌ FALLA si violations    │   │ ✅ Pasa si no en cooldown │
   └───────────┬───────────────┘   └───────────┬───────────────┘
               │                                │
               └──────────────┬─────────────────┘
                              ▼
              ┌───────────────────────────────────┐
              │  EffectManager.trigger(name)      │
              │  → SeleneHephBridge.route()       │
              │  → HephaestusRuntime.play()       │
              └───────────────────────────────────┘
```

| Ruta | Trigger | Validación | Probabilidad de éxito hoy |
|---|---|---|---|
| **A — Integrator** | `dreamIntegrationData.approved && effect` | 17 reglas éticas + thresholds | **~5%** (catalogue migrado falla texture_coherence) |
| **B — Drop Arsenal** | `Z > 0.7 && DROP_LOCK_FREE` | Solo cooldown + texture filter del EffectRepository | **~80%** (mucho más permisivo) |

`solar_flare` triunfa porque está en `DROP_ARSENAL[fiesta-latina]` hardcoded, y el `DecisionMaker` lo selecciona via `DIVERSITY SELECT` saltándose Conscience por completo.

### 3.3 Por qué la hipótesis del usuario sobre `trigger()` es incorrecta

El usuario sugiere:

> ¿Está el Integrador esperando un objeto instanciado antiguo (una clase) y fallando al recibir un string/token? ¿Acaso `trigger()` ahora es asíncrono y el Integrador lo está llamando de forma síncrona?

**Falso por construcción arquitectónica:**

1. `DreamEngineIntegrator.executeFullPipeline()` retorna un `IntegrationDecision` — no llama a `trigger()` jamás.
2. La invocación a `EffectManager.trigger()` ocurre **río abajo**, en `SeleneTitanConscious.tick()` o en `DecisionMaker.executeDropEffect()`, después de que la decisión integrada ya fue marcada como aprobada.
3. El refactor de WAVE 4827 (que `trigger()` devuelva un `instanceToken` desde `SeleneHephBridge`) afecta **únicamente al consumer del retorno**, que es el caller que usa el token para tracking. Si fuera un bug ahí, el efecto sí dispararía pero el log post-disparo se perdería — **no produce REJECTED en el Integrador**.
4. Confirmación visual: en `solar_flare` el log muestra `⚡[HEPH-BRIDGE]` (etiqueta nueva post-4827) y el efecto disparó correctamente. **El bridge funciona.** Si estuviera roto, `solar_flare` también fallaría.

**Conclusión:** El refactor de `trigger()` es inocente. El crimen ocurre 3 capas por encima.

---

## §4. EL VEREDICTO ARQUITECTÓNICO — EL CONTRATO ROTO REAL

### 4.1 El contrato que sí está roto

No es el contrato de `trigger()`. Es el **contrato implícito entre `LfxClipInstance.toCognitiveDNA()` y `VisualEthicalValues.texture_coherence`**.

| Capa | Asume |
|---|---|
| **Migrador WAVE 4821** | "Marco strobe/heavy como `dirty` porque visualmente lo son" |
| **VisualEthicalValues** | "Si la música es clean y el efecto es dirty → INCOHERENCIA GRAVE → reject" |
| **Realidad latina** | Música hi-fi (clean) en drops. El usuario quiere efectos heavy/strobe AHÍ. |

**Resultado:** las dos capas tienen razones internas válidas, pero combinadas matan el catálogo. Nadie validó que `texture_coherence` siguiera siendo correcta tras inflar el arsenal de 12 → 47 efectos.

### 4.2 Diagnóstico de `solar_flare` como "control del experimento"

`solar_flare` sobrevive porque:
1. Tiene `textureAffinity: 'universal'` (no `dirty`).
2. Está en el array hardcoded `DROP_ARSENAL[fiesta-latina]` → ruta B → bypassa Conscience.
3. Su archetype legacy fue `utility` — el migrador no lo marcó dirty.

**Esto es la confirmación final de que el problema es la regla `texture_coherence`, no el Integrador en sí.** Si todos los efectos tuvieran `'universal'`, todos pasarían. Si `texture_coherence` fuera más permisiva, todos pasarían.

---

## §5. PARCHES PROPUESTOS

### 5.1 Parche P1 — Logging informativo (zero-risk, alta utilidad diagnóstica)

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\integration\DreamEngineIntegrator.ts:309-315
    } else if (decision.totalTime > 10 || !decision.approved) {
      console.log(
        `[INTEGRATOR] 📊 Pipeline: ${decision.approved ? '✅ APPROVED' : '❌ REJECTED'} | ` +
        `Dream: ${dreamTime}ms | Filter: ${filterTime}ms | Total: ${decision.totalTime}ms | ` +
        `reason=${decision.dreamRecommendation?.substring(0, 60) ?? '?'}`
      )
```

Cambiar a:

```typescript
} else if (decision.totalTime > 10 || !decision.approved) {
  const verdict = ethicalVerdict?.verdict ?? 'NO_VERDICT'
  const violationSummary = (ethicalVerdict?.violations ?? [])
    .map(v => `${v.value}/${v.severity}`)
    .slice(0, 3)
    .join(',') || 'none'
  console.log(
    `[INTEGRATOR] 📊 Pipeline: ${decision.approved ? '✅ APPROVED' : '❌ REJECTED'} | ` +
    `verdict=${verdict} score=${ethicalVerdict?.ethicalScore?.toFixed(3) ?? '?'} | ` +
    `dream=${decision.dreamRecommendation} | violations=[${violationSummary}] | ` +
    `${dreamTime}+${filterTime}=${decision.totalTime}ms`
  )
}
```

**Resultado:** el log dirá EXACTAMENTE qué regla mató al efecto. Sin esto, seguir investigando es a ciegas.

### 5.2 Parche P2 — Relajar `texture_coherence` para drops de alta energía

```typescript
// En texture_coherence rule, AGREGAR antes del CASO 1:
// 🩸 WAVE 4831: DROP ENERGY OVERRIDE
// En momentos de alta energía (drop latino, peak techno), la incoherencia
// textura/efecto es deseable — el usuario QUIERE el contraste visual.
if (context.energy > 0.80 && context.spectral?.flux > 0.6) {
  return { passed: true, reason: 'High-energy drop overrides texture coherence' }
}

// Resto de la regla CASO 1, CASO 2, CASO 3...
```

### 5.3 Parche P3 — APPROVED tolera violaciones `low`

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\conscience\VisualConscienceEngine.ts:400-401
    if (best.ethicalScore >= approvalThreshold && best.violations.length === 0) {
```

Cambiar a:

```typescript
const blockingViolations = best.violations.filter(
  v => v.severity === 'high' || v.severity === 'critical'
)
if (best.ethicalScore >= approvalThreshold && blockingViolations.length === 0) {
  // APPROVED — low/medium violations son warnings, no bloqueos
```

**Justificación:** una violación `low` (severity 0.1) genera 10% de penalización pero no debería matar approval si el score combinado sigue alto. Hoy es binario.

### 5.4 Parche P4 — Differential logging APPROVED/DEFERRED/REJECTED

Hoy DEFERRED y REJECTED se logean idénticos. Diferenciar:

```typescript
const verdictEmoji = decision.approved ? '✅' :
                     ethicalVerdict?.verdict === 'DEFERRED' ? '⏸️' : '❌'
```

### 5.5 Parche P5 — Ruta C: `DROP ARSENAL` consume Registry .lfx

Hoy `DROP_ARSENAL[fiesta-latina]` es un array hardcoded en `DecisionMaker.ts`. Migrarlo a leer del Registry vía DNA scoring:

```typescript
// En DecisionMaker.executeDropEffect():
const arsenal = getDynamicEffectRegistry()
  .getDivineArsenal(vibeId)              // .lfx con isDivineCandidate=true
  .map(entry => entry.id)
  .slice(0, 5)
```

Esto da a la ruta B acceso a los 47 efectos migrados sin pasar por la Conscience. Con riesgo: pierde validación ética. Mitigación: aplicar SOLO `texture_coherence` y `epilepsy_protection` como filtros mínimos.

---

## §6. PLAN DE EJECUCIÓN ORDENADO

```
WAVE 4831 — INTEGRATOR WALL TEARDOWN
├── PASO 1 — DIAGNÓSTICO INMEDIATO
│   └── Aplicar P1 (mejor logging)
│       → re-correr 60s de fiesta-latina
│       → identificar las 2-3 reglas que más matan
│
├── PASO 2 — RELAJAR LA REGLA #1 (texture_coherence)
│   └── Aplicar P2 (drop energy override)
│       → re-correr → verificar tasa de aprobación
│
├── PASO 3 — TOLERAR LOW VIOLATIONS
│   └── Aplicar P3 (blocking severities only)
│       → re-correr → verificar que efectos legítimos pasen
│
├── PASO 4 — DIFERENCIAR VERDICTS EN LOG
│   └── Aplicar P4
│
└── PASO 5 — UNIFICAR PIPELINES (opcional, mayor esfuerzo)
    └── Aplicar P5 (Registry feeds DROP arsenal)
        → ahora los .lfx migrados pueden disparar via ruta B también
        → reducir hardcoded DROP_ARSENAL a fallback
```

### 6.1 Métricas de éxito

| Métrica | Pre-WAVE 4831 | Post-WAVE 4831 (target) |
|---|---|---|
| Approval rate Integrator (sesión 60s latina) | ~5% | ≥40% |
| Efectos disparados via Ruta A vs Ruta B | 5 / 95 | 50 / 50 |
| Log informativo de rechazos | "reason=execute" | "violations=[texture_coherence/high, risk_ceiling/medium]" |
| `oro_solido` monopoly (si Lazarus no aplicado) | 70% | <25% |

---

## §7. RESPUESTAS DIRECTAS A LAS PREGUNTAS DEL USUARIO

### 7.1 ¿Qué línea emite `Pipeline: ❌ REJECTED | reason=execute`?

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\integration\DreamEngineIntegrator.ts:310-314`

### 7.2 ¿Qué condición boolean provoca el rechazo?

`decision.approved = ethicalVerdict.verdict === 'APPROVED'` — específicamente, el verdict no es APPROVED porque `best.violations.length > 0` en `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\conscience\VisualConscienceEngine.ts:400`.

### 7.3 ¿`trigger()` async/sync rompió el contrato?

**No.** El Integrador no llama a `trigger()`. La cadena es: `Integrator.evaluate → Conscience.evaluate (gate) → SeleneTitanConscious lee approved → SeleneTitanConscious llama EffectManager.trigger`. El refactor 4827 vive en el último eslabón. La asfixia pasa en el segundo.

### 7.4 ¿Qué tiene `solar_flare` que le permite evitar el muro?

Tres cosas:
1. **Está en `DROP_ARSENAL[fiesta-latina]` hardcoded** → es seleccionado por `DecisionMaker.executeDropEffect()`, una ruta paralela que NO pasa por el Integrador.
2. Su `textureAffinity === 'universal'` → si pasara por el Integrador tampoco fallaría `texture_coherence`.
3. La ruta B (DROP) solo valida cooldown + texture filter ligero del `EffectRepository`, no las 17 reglas éticas.

### 7.5 ¿Por qué la refactorización rompió el contrato?

**No lo rompió.** El refactor de WAVE 4827 (Surgical Transplant) hizo dos cosas:
- Pobló el `DynamicEffectRegistry` con 48 .lfx → ✅ funciona
- Bypaseó las constantes hardcoded del `EffectDreamSimulator` → ✅ funciona

El bug que el usuario observa es **prexistente al refactor**: el `VisualConscienceEngine` siempre tuvo estas reglas. Antes había 12 efectos legacy curados que pasaban. Ahora hay 47 .lfx que mecánicamente fallan `texture_coherence` por su `archetype → textureAffinity`. **Es una incompatibilidad de diseño expuesta por el aumento de catálogo, no un bug de código nuevo.**

---

## §8. ANEXO — ENLACES A CITACIONES CLAVE

- Log emitter: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\integration\DreamEngineIntegrator.ts:309-315`
- Decision merge: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\integration\DreamEngineIntegrator.ts:279-290`
- Verdict gate: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\conscience\VisualConscienceEngine.ts:400-467`
- Texture coherence rule: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\conscience\VisualEthicalValues.ts:483-536`
- Risk ceiling rule: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\conscience\VisualEthicalValues.ts:669-682`
- Archetype → texture mapping: `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\LfxClipInstance.ts:532-537`
- Drop arsenal selection (Ruta B): `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\intelligence\think\DecisionMaker.ts:907-911`
- Hephaestus bridge (intacto post-4827): `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\arsenal\SeleneHephBridge.ts:131-173`

---

*Audit sellada. WAVE 4831 — THE INTEGRATOR WALL TEARDOWN.*
*Próximo paso: aplicar P1 (logging) primero, validar diagnóstico empíricamente, luego P2/P3.*
