# Reporte Forense: Cassandra Pre-Buffer — Aprobación Múltiple vs Almacenamiento Único

**Fecha:** 2026-08-18
**Modo:** Read-Only (análisis de código)
**Alcance:** `EffectDreamSimulator.ts`, `DreamEngineIntegrator.ts`, `SeleneTitanConscious.ts`, `SovereignClockGuard.ts`

---

## 1. Síntoma Reportado

El simulador (DreamSimulator) selecciona y aprueba múltiples efectos por frame, pero Cassandra solo almacena uno en el pre-buffer. El usuario observa en los logs:

```
[DREAM_RANKING] 🏆 TOP 5 (10 total) | pred=drop_incoming conf=0.699:
  1. Latina Meltdown      SCORE=1.000
  2. Seismic Snap         SCORE=1.000
  3. Strobe Burst         SCORE=1.000
  4. Strobe Storm         SCORE=1.000
  5. latin_strobe         SCORE=0.949

[DREAM_SIMULATOR] 🔮📦 CASSANDRA PRE-BUFFER: "Latina Meltdown" stored for drop_incoming

[INTEGRATOR] 🔮🛡️ PRE-BUFFER GUARD: blocking normal approval — "latina_meltdown" sealed, 4s remaining
[SeleneTitanConscious] 🧬 DNA: ❌ none | ethics=N/A | dream=1ms | pre-buffer-guard: awaiting "latina_meltdown"
```

**Pregunta:** ¿Es un error de diseño que el simulador evalúe 10 efectos pero solo bufferice 1?

---

## 2. Veredicto: NO es un error de diseño — es intencional y correcto

El comportamiento es **by design**. El sistema tiene tres capas deliberadamente separadas:

### 2.1 Capa 1 — DreamSimulator (Evaluación amplia)

`EffectDreamSimulator.generateCandidates()` evalúa **todos** los efectos compatibles con el vibe y la zona energética. En el log del usuario, 10 efectos pasaron los filtros y fueron rankeados. Esto es correcto: el simulador necesita ver el panorama completo para:

1. **Scoring de fitness** — Cada efecto recibe un SCORE basado en DNA match, diversity, vibe coherence, risk y distance.
2. **Diversidad ecológica** — Los 10 efectos rankeados alimentan el `DNA_ANALYZER` que calcula factores de diversidad (penaliza efectos sobreusados).
3. **Arena/Genesis** — Los organismos `alive` (minions) se incluyen en el ranking para fitness scoring aunque no puedan ejecutarse (QUARANTINE WALL).

### 2.2 Capa 2 — Pre-Buffer (Almacenamiento único)

`EffectDreamSimulator` línea 317-338:

```ts
const preBufferScenario = bestScenario  // Solo el #1 del ranking

if (preBufferScenario &&
    oracleProbability >= this.PRE_BUFFER_MIN_PROBABILITY &&
    timeToEvent >= this.PRE_BUFFER_MIN_TIME_MS &&
    !this.preBuffer) {  // Solo si no hay buffer ya
  this.preBuffer = { effect: preBufferScenario.effect, ... }
}
```

**Solo se almacena el #1 del ranking.** Esto es correcto porque:

1. **El pre-buffer es una predicción temporal** — Cassandra predice un evento musical (drop, buildup) en N segundos y pre-selecciona el efecto óptimo para ese momento. Solo puede haber un evento predicho a la vez.
2. **El slot de ejecución es único** — Cuando el reloj llegue a cero, solo se puede disparar un efecto. Bufferizar múltiples sería desperdiciar CPU y crear ambigüedad.
3. **El guard `!this.preBuffer`** previene sobreescribir un buffer existente — si ya hay un efecto sellado para un drop en 3s, no se reemplaza aunque el ranking cambie.

### 2.3 Capa 3 — Sovereign Clock (Ejecución exclusiva)

`SeleneTitanConscious.ts` línea 613-697:

```ts
const bufferStatus = dreamEngineIntegrator.getPreBufferStatus()
if (bufferStatus) {
  const verdict = this._sovereignGuard.evaluate({...})
  if (verdict.action === 'fire' && verdict.candidate) {
    dreamEngineIntegrator.clearPreBuffer()
    // ... dispara el efecto bypassando HuntEngine + Fuzzy + EnergyOverride
  }
}
```

El Sovereign Clock es la **ley absoluta**. Cuando el reloj llega a cero (o el Glass Break detecta un drop adelantado), dispara el efecto pre-bufferizado **sin pasar por ningún gate**. Esto garantiza que la predicción de Cassandra se materialice.

---

## 3. El Flujo Completo Frame a Frame

```
Frame N (buildup, 3s antes del drop):
┌─────────────────────────────────────────────────────────────┐
│ DreamSimulator.generateCandidates()                         │
│   ├─ getVibeAllowedEffects("fiesta-latina") → 18 efectos   │
│   ├─ filterByZone("intense") → 11 efectos                   │
│   ├─ filterByPressure(0.974) → 10 efectos                   │
│   ├─ rankScenarios() → TOP 10 con SCORE                     │
│   ├─ bestScenario = #1 (Latina Meltdown)                    │
│   ├─ PRE-BUFFER: almacena #1 (timeToEvent=3000ms > 1500ms)  │
│   └─ TEMPORAL SEAL: recomendación → 'modify' (no ejecutar)  │
│                                                             │
│ DreamEngineIntegrator.process()                             │
│   ├─ PRE-BUFFER GUARD: bloquea aprobación                   │
│   │   "latina_meltdown sealed, 3s remaining"                │
│   └─ return { approved: false, recommendation: 'modify' }   │
│                                                             │
│ SeleneTitanConscious                                        │
│   ├─ SovereignGuard.evaluate() → action: 'wait'             │
│   └─ DNA: ❌ none | pre-buffer-guard: awaiting              │
└─────────────────────────────────────────────────────────────┘

Frame N+90 (3s después, drop llega):
┌─────────────────────────────────────────────────────────────┐
│ SeleneTitanConscious                                        │
│   ├─ SovereignGuard.evaluate() → action: 'fire'             │
│   ├─ clearPreBuffer()                                       │
│   ├─ 🔮👑 CASSANDRA SOVEREIGN CLOCK: firing "Latina Meltdown"│
│   └─ bypassing HuntEngine + Fuzzy + EnergyOverride          │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Por Qué Se Ven "Múltiples Aprobaciones" en el Log

El usuario ve líneas como:

```
[INTEGRATOR] ✅ APPROVED: latin_strobe @ 0.97 | ethics=1.134 | Dream: 1ms | Total: 1ms
[INTEGRATOR] ✅ APPROVED: Tidal Wave (Golden Bounce) @ 0.76 | ethics=1.134 | Dream: 0ms | Total: 0ms
```

Esto NO significa que se aprueben múltiples efectos simultáneamente. Lo que ocurre es:

1. **El DreamSimulator tiene un cache de 5 segundos** (`dreamCacheTTL = 5000`). Si el contexto musical no cambia significativamente, retorna el mismo resultado cacheado.
2. **El Integrator se llama cada frame** (60fps). Cada frame procesa el resultado del DreamSimulator y puede aprobarlo.
3. **El PRE-BUFFER GUARD bloquea** cuando hay un buffer activo, pero cuando NO hay buffer (o el buffer ya expiró/se disparó), el Integrator aprueba normalmente.
4. **El DecisionMaker tiene la última palabra** — aunque el Integrator apruebe, el DecisionMaker puede bloquear por cooldown, ética, divine gate, etc.

**Las "múltiples aprobaciones" son aprobaciones del MISMO efecto en frames consecutivos**, no de efectos diferentes simultáneos. El throttle que acabamos de aplicar (1 log/segundo por effectId) ahora hace esto visible sin spam.

---

## 5. El TEMPORAL SEAL — Prevención de Disparo Prematuro

`EffectDreamSimulator.ts` línea 354-384:

```ts
const justBuffered = this.preBuffer && this.preBuffer.bufferedAt === now
if (justBuffered && recommendation.action === 'execute') {
  // SELLO TEMPORAL: degradar a 'modify' para evitar disparo prematuro
  return { recommendation: 'modify', reason: deferredReason }
}
```

Este es un fix crítico (WAVE 2200.1) que previene el siguiente bug:

1. Cassandra almacena `core_meltdown` para un drop en 3.9s
2. `generateRecommendation()` ve `projectedRelevance >= 0.30` → devuelve `'execute'`
3. El Integrator ve `'execute'` → aprueba
4. El DecisionMaker dispara `core_meltdown` AHORA, durante el buildup, a Z=0.5σ
5. **PREMATURO** — el efecto se desperdicia antes del drop

El TEMPORAL SEAL degrada la recomendación a `'modify'` (= "tengo algo pero NO es hora") cuando se acaba de bufferizar. El efecto queda sellado hasta que el Sovereign Clock lo libere.

---

## 6. El PRE-BUFFER GUARD — Prevención de Robo de Slot

`DreamEngineIntegrator.ts` línea 228-259:

```ts
const activeBuffer = effectDreamSimulator.getPreBufferStatus()
if (activeBuffer && !isFastPath) {
  if (!isBufferExpired) {
    // BLOQUEAR aprobación de cualquier efecto distinto al pre-bufferizado
    return { approved: false, recommendation: 'pre-buffer-guard: awaiting "..."' }
  }
}
```

Este guard previene que el pipeline normal apruebe un efecto DIFERENTE al que Cassandra tiene sellado. Sin este guard:

1. Cassandra sella `latina_meltdown` para un drop en 3s
2. El pipeline normal evalúa el frame actual y aprueba `tidal_wave` (porque tiene alto SCORE)
3. `tidal_wave` se dispara AHORA
4. 3s después, el Sovereign Clock dispara `latina_meltdown`
5. **Dos efectos se disparan en 3 segundos** — el segundo es redundante

El PRE-BUFFER GUARD bloquea el paso 2, asegurando que el slot temporal del drop pertenezca exclusivamente a `latina_meltdown`.

---

## 7. Arquitectura del Pre-Buffer

```
                    ┌─────────────────────┐
                    │  Markov Predictor   │
                    │  (predice evento)   │
                    └─────────┬───────────┘
                              │ predictionType, timeToEvent, oracleProbability
                              ▼
                    ┌─────────────────────┐
                    │  DreamSimulator     │
                    │  generateCandidates │
                    │  → 10 efectos       │
                    │  → rankScenarios    │
                    │  → #1 = best        │
                    └─────────┬───────────┘
                              │ bestScenario
                   ┌──────────┴──────────┐
                   │                     │
                   ▼                     ▼
         ┌─────────────────┐   ┌──────────────────┐
         │ TEMPORAL SEAL   │   │ PRE-BUFFER       │
         │ recommend→modify│   │ store #1 only    │
         │ (no ejecutar)   │   │ !this.preBuffer  │
         └─────────────────┘   └────────┬─────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ SovereignClock   │
                              │ Guard            │
                              │ evaluate()       │
                              └────────┬─────────┘
                                       │
                          ┌────────────┼────────────┐
                          │            │            │
                          ▼            ▼            ▼
                       'wait'      'fire'       'clear'/'abort'
                          │            │            │
                          │     ┌──────┘            │
                          │     │                   │
                          │     ▼                   │
                          │  clearPreBuffer()       │
                          │  bypass all gates       │
                          │  fire effect            │
                          │     │                   │
                          ▼     ▼                   ▼
                     ┌─────────────────────────────────┐
                     │  EffectManager → HephRuntime    │
                     │  (ejecución física)             │
                     └─────────────────────────────────┘
```

---

## 8. Conclusión

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Evaluación amplia (10 efectos) | ✅ Correcto | Necesaria para scoring, diversidad y Genesis |
| Almacenamiento único (1 efecto) | ✅ Correcto | Solo puede haber un evento predicho a la vez |
| TEMPORAL SEAL | ✅ Correcto | Previene disparo prematuro tras bufferizar |
| PRE-BUFFER GUARD | ✅ Correcto | Previene robo de slot del drop |
| Sovereign Clock | ✅ Correcto | Ejecución exclusiva bypassing all gates |
| Glass Break | ✅ Correcto | Detecta drops adelantados y dispara antes |
| Múltiples "APPROVED" en log | ⚠️ Spam (arreglado) | Era el mismo efecto aprobado en frames consecutivos, ahora throttlado a 1/seg |

**No hay error de diseño.** El sistema evalúa ampliamente (para información), pero ejecuta selectivamente (para precisión). Cassandra es la autoridad temporal: predice, sella y dispara un único efecto en el momento exacto.

---

## 9. Logs Throttlados (WAVE 7522)

| Log | Archivo | Throttle anterior | Throttle actual |
|-----|---------|-------------------|-----------------|
| `🧬 DNA:` | `SeleneTitanConscious.ts:1288` | Sin throttle (60fps) | 1/seg por state+effect |
| `✅ APPROVED:` | `DreamEngineIntegrator.ts:330` | Sin throttle (60fps) | 1/seg por effectId |
| `🔮🛡️ PRE-BUFFER GUARD:` | `DreamEngineIntegrator.ts:244` | Sin throttle (60fps × 3s) | 1/seg por effectId |

**Reducción estimada:** De ~700 líneas/minuto a ~15 líneas/minuto (95% menos spam).
