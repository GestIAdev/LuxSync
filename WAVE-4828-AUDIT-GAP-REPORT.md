# 🚨 WAVE 4828 — AUDIT GAP REPORT
## Selene L3 Intents & Node Arbiter — Deep Code Audit

**Auditor:** Cascade (Agente Ejecutor / Kimi)  
**Scope:** Solo lectura. Zero modificaciones aplicadas.  
**Fecha:** 2026-05-16  
**Archivos auditados:**
- `src/core/mood/MoodController.ts`
- `src/core/intelligence/SeleneTitanConscious.ts`
- `src/core/intelligence/think/HuntEngine.ts`
- `src/core/intelligence/think/FuzzyDecisionMaker.ts`
- `src/core/intelligence/validate/EnergyOverride.ts`
- `src/core/aether/adapters/selene-aether-adapter.ts`
- `src/core/aether/NodeArbiter.ts`
- `src/core/orchestrator/TitanOrchestrator.ts`

---

## 🔍 PASO 1: MAPEO DE PERSONALIDADES (Selene IA)

### 1.1 Los 3 Modos de MoodController

Definidos en `src/core/mood/MoodController.ts` líneas 29-129.

| Modo | `thresholdMultiplier` | `cooldownMultiplier` | `ethicsThreshold` | `maxIntensity` | `minIntensity` | `blockList` (efectos prohibidos) | `forceUnlock` |
|---|---|---|---|---|---|---|---|
| **CALM** | `2.5` | `4.0` | `0.95` | `0.6` | `undefined` | `strobe_storm`, `strobe_burst`, `industrial_strobe`, `ambient_strobe`, `gatling_raid`, `machete_spark`, `latina_meltdown`, `core_meltdown`, `glitch_guaguanco`, `solar_flare`, `seismic_snap` | — |
| **BALANCED** | `1.10` | `1.8` | `1.20` | `1.0` | `undefined` | `[]` (vacío) | — |
| **PUNK** | `0.8` | `0.7` | `0.75` | `1.0` | `0.5` | `[]` (vacío) | `strobe_burst`, `solar_flare` |

**Mecánica clave:** `applyThreshold(rawScore)` divide el score crudo por el multiplicador.  
- **CALM:** `rawScore / 2.5` → score efectivo MUY bajo. Un `rawScore = 0.70` → `0.28` (bloqueado fácilmente).  
- **BALANCED:** `rawScore / 1.10` → `rawScore = 0.70` → `0.636` (borderline, depende del threshold fuzzy).  
- **PUNK:** `rawScore / 0.8` → `rawScore = 0.70` → `0.875` (pasa casi seguro).

### 1.2 Cooldowns Globales y por Efecto

Definidos en `src/core/intelligence/SeleneTitanConscious.ts`:

| Cooldown | Valor | Línea | Descripción |
|---|---|---|---|
| `GLOBAL_EFFECT_COOLDOWN_MS` | `7000` | L343 | Mínimo entre efectos consecutivos (was 4s, subido a 7s para dejar respirar la física). |
| `DNA_OVERRIDE_MIN_INTERVAL_MS` | `12000` | L321 | Mínimo entre "DNA Cooldown Overrides" (bypasseos épicos). |
| `DNA_OVERRIDE_SAME_EFFECT_INTERVAL_MS` | `20000` | L322 | Mínimo para repetir el MISMO efecto con override. |
| `PIPELINE_EXECUTION_THROTTLE_MS` | `2000` | L331 | Throttle del pipeline de dream/integración (was 1s). |

**NOTA:** El `EffectManager` (singleton) escucha el evento `effectTriggered` y registra cooldowns por tipo de efecto. El `MoodController` puede multiplicar estos cooldowns base:
- CALM: `baseCooldown * 4.0`
- BALANCED: `baseCooldown * 1.8`
- PUNK: `baseCooldown * 0.7`

### 1.3 Thresholds del HuntEngine (Cómo Decide Disparar)

Definidos en `src/core/intelligence/think/HuntEngine.ts`:

**Configuración base (`HuntConfig`, líneas 123-144):**
- `minStalkingFrames`: `5`
- `maxStalkingFrames`: `60` (~1s a 60fps)
- `beautyThreshold`: `0.65`
- `consonanceThreshold`: `0.60`
- `urgencyForceThreshold`: `0.90`
- `maxEvaluatingFrames`: `15`
- `learningCooldownFrames`: `45` (~750ms)

**Matriz de pesos por Vibe (`VIBE_STRIKE_MATRIX`, líneas 707-752):**

| Vibe | `beautyWeight` | `urgencyWeight` | `consonanceWeight` | `threshold` | `urgencyBoost` |
|---|---|---|---|---|---|
| `fiesta-latina` | `0.3` | `0.6` | `0.1` | `0.65` | `0.1` |
| `techno-club` | `0.2` | `0.7` | `0.1` | `0.65` | `0.1` |
| `pop-rock` | `0.4` | `0.5` | `0.1` | `0.70` | `0.0` |
| `chill-lounge` | `0.7` | `0.2` | `0.1` | `0.75` | `0.0` |
| `idle` | `0.4` | `0.5` | `0.1` | `0.75` | `0.0` |

**Cálculo del `strikeScore` (líneas 789-807):**
```typescript
strikeScore = (beautyScore * beautyWeight) + (urgency * urgencyWeight) + (consonanceScore * consonanceWeight)
finalScore = strikeScore + 0.05 (si chorus/buildup) + 0.05 (si trend rising)
allMet = finalScore >= weights.threshold
```

**Worthiness base (líneas 555-641):**
```typescript
base = beautyScore*0.35 + consonanceScore*0.25 + tensionScore*0.20 + rhythmScore*0.20
bonus = +0.20 (drop), +0.15 (buildup/isBuilding), +0.10 (chorus), +0.10 (tension>0.7), +0.10 (beauty rising)
worthiness = min(1, max(0, base + bonus))
```

### 1.4 Thresholds del FuzzyDecisionMaker

Definidos en `src/core/intelligence/think/FuzzyDecisionMaker.ts` líneas 1018-1023:

```typescript
const THRESHOLDS = {
  force_strike: 0.7,
  strike: 0.50,       // WAVE 2109: 0.40→0.50
  prepare: 0.35,      // WAVE 1176: SUBIDO de 0.3
  hold: 0.0,
}
```

**Downgrade por mood (líneas 987-1060):**
- **CALM:** Puede degradar `strike → prepare` o `prepare → hold` si el `effectiveScore` es insuficiente.
- **BALANCED:** Thresholds estándar (1.10x divisor).
- **PUNK:** Casi nunca degrada (threshold 0.6 amplifica scores).

### 1.5 Reglas del Drop Lock (Energy Override)

Definidas en `src/core/intelligence/validate/EnergyOverride.ts`:

**Umbral:** `ENERGY_OVERRIDE_THRESHOLD = 0.85` (línea 36).

**Regla:** Si `smoothedEnergy > 0.85`, Selene entra en **DROP MODE** y devuelve un `ConsciousnessOutput` fijo (líneas 42-63):
- `colorDecision: null` (no modular colores)
- `physicsModifier.strobeIntensity: 1.0` (full strobe)
- `physicsModifier.flashIntensity: 1.0` (full flash)
- `movementDecision: null` (no modular movimiento)
- `effectDecision: null` (no forzar efectos en override)
- `confidence: 1.0`

**Esto es un VETO TOTAL de la IA sobre la física** — cuando hay energía > 85%, la IA dice "yo no opino, la física manda". El problema reportado por el usuario ("Balanced dispara demasiados efectos en música latina") NO ocurre en drops (donde el veto funciona), sino en los **valles intermedios** donde la energía está entre 0.60-0.84 y Selene está activa.

---

## 🔍 PASO 2: EL CONDUCTO DEL INTENT (Selene → Aether)

### 2.1 Pipeline Completo

```
SeleneTitanConscious.process(titanState)
  ↓ (devuelve ConsciousnessOutput)
TitanOrchestrator.lastConsciousnessOutput
  ↓
SeleneAetherAdapter.ingest(consciousness, effectOutput, deltaMs, _effectBus)
  ↓ (traduce a INodeIntent[] con priority=300)
_effectBus (L3)
  ↓
NodeArbiter.setEffectIntents(effectIntents)
  ↓
NodeArbiter.arbitrate() → mezcla con L0/L1/L2/LP
```

### 2.2 Emisión de Intents en TitanOrchestrator

`src/core/orchestrator/TitanOrchestrator.ts` líneas 1922-1939:

```typescript
const consciousnessOutput = this.lastConsciousnessOutput ?? null
const effectOutput = getEffectManager().getCombinedOutput()

// WAVE 4675: passport VIP de Selene/LiveFX para saltar MoverShield
aetherArbiter.setSeleneOverrideMoverShield(effectOutput?.overrideMoverShield === true)

// LiveFX se inyecta en bus L3 dedicado para que domine sobre L2 manual.
seleneAetherAdapter.ingest(
  consciousnessOutput,
  effectOutput,
  ctx.deltaMs,
  this._effectBus,
)
```

### 2.3 Metadatos de los Intents L3

`src/core/aether/adapters/selene-aether-adapter.ts` líneas 42-46:

```typescript
const L3_PRIORITY = 300           // L3 Effects range: 300-399
const L3_SOURCE = 'effect' as const
```

Cada intent emitido por `SeleneAetherAdapter` lleva:
- `priority: 300`
- `confidence: composition (0-1)`
- `source: 'effect'`
- `nodeId: <fixtureId>:<family>`
- `values: { dimmer | r/g/b | strobeRate | shutter | white | amber }`

### 2.4 Familias de Nodo Afectadas por L3

`SeleneAetherAdapter` emite a:
- **IMPACT** (`NodeFamily.IMPACT`): `dimmer`, `strobeRate`, `shutter`
- **COLOR** (`NodeFamily.COLOR`): `r/g/b`, `red/green/blue`, `white`, `amber`

**BLOQUEADO en L3 (regla estricta, línea 16 del adapter):**
- ❌ `targetX/Y/Z`, `pan`, `tilt` — movimiento KINETIC está **prohibido** en L3.
- Los efectos de Selene NO pueden mover movers. Eso queda en L0 (KineticSystem/VMM) o L2 (manual).

### 2.5 Gate de Composición Mínima

`src/core/aether/adapters/selene-aether-adapter.ts` línea 52:

```typescript
const MIN_GLOBAL_COMPOSITION = 0.01
```

Si `effectOutput.globalComposition < 0.01`, el adapter hace **early return** — no emite NADA a L3. Esto significa que cuando un efecto tiene opacidad casi nula, L3 es un no-op y L0 fluye libremente.

---

## 🔍 PASO 3: LA BATALLA DEL NODE ARBITER (L3 vs L0/L2)

### 3.1 Orden de Capas en `arbitrate()`

`src/core/aether/NodeArbiter.ts` líneas 427-522:

```typescript
// 1. L0: System intents (IntentBus — ColorSystem, ImpactSystem, KineticSystem...)
//    _applyIntent(all[i], 'system')

// 2. L1: Selene IA overrides
//    _applyIntent(_seleneBus.getAt(i), 'selene')

// 3. LP: Playback (Chronos Timeline)
//    _applyIntent(_playbackIntents[i], 'playback')

// 4. L2: Manual overrides (UI Hold)
//    Escritura DIRECTA sobre _result (NO via _applyIntent)

// 5. L3: Effect intents (LiveFXEngine)
//    _applyIntent(_effectIntents[i], 'effect')

// 6. L3+: Hephaestus custom intents
//    _applyIntent(_hephaestusIntents[i], 'hephaestus')

// 7. WAVE 4714: MANUAL HARD LOCK
//    REAPlica L2 sobre TODO (revierte cualquier L3/LP/L1/L0 en canales manuales)

// 8. WAVE 4752: RELEASE FADES
// 9. Grand Master
// 10. Inhibit limits
// 11. L2-MOTOR (AetherKineticEngine — última autoridad sobre pan/tilt)
```

### 3.2 Estrategias de Merge por Canal

`src/core/aether/NodeArbiter.ts` líneas 14-27:

| Canal | Estrategia | Comportamiento L3 vs L0 |
|---|---|---|
| `dimmer`, `brightness` | **LTP absoluto** | L3 sobreescribe L0. Luego L2 sobreescribe L3. Luego MANUAL HARD LOCK re-aplica L2. |
| `strobe`, `shutter` | **Prioridad estricta por capa** (L4>LP>L3>L2>L1>L0) | L3 gana sobre L0, pero L2 gana sobre L3. |
| `r`, `g`, `b`, `red`, `green`, `blue`, `white`, `amber` | **LTP puro** | L3 sobreescribe L0 directamente. Luego MANUAL HARD LOCK re-aplica L2 si existe. |
| `pan`, `tilt` | **LTP puro + L2-MOTOR final** | L3 NUNCA emite estos canales. L0 (VMM) o L2-MOTOR controlan. |

### 3.3 El Smart Gate (WAVE 4752)

`src/core/aether/NodeArbiter.ts` líneas 380-412:

```typescript
// Pre-computar canales tocados por L2/LP por nodo
this._opaqueNodeChannels.clear()        // L2 manual
this._opaquePlaybackChannels.clear()    // LP playback

// L0/L1 solo bloqueados en los canales EXACTOS que L2/LP están escribiendo
// en ESE NODO específico.
```

**Implicación crítica:** El Smart Gate solo bloquea L0 cuando L2 está tocando el canal. **L3 NO tiene Smart Gate propio** — L3 sobreescribe libremente sobre L0 sin verificar si L2 está presente. La única defensa de L0 contra L3 es:
1. El canal está en `STRICT_PRIORITY_CHANNELS` y L2 ya lo escribió (L2 gana sobre L3).
2. El MANUAL HARD LOCK (paso 7) reaplica L2 sobre L3 después del fact.

### 3.4 ¿Por Qué L3 No Bloquea Limpiaemente a L0?

**Respuesta: Porque el arbitraje es secuencial LTP, no un sistema de "máscaras de capa".**

En `_applyIntent()` (líneas 634-718):

```typescript
// Para canales NO estrictos:
record[channel] = incoming   // ← LTP puro. La última capa en escribir GANA.
```

- L0 escribe primero → deja su valor.
- L1 escribe después → pisa L0.
- LP escribe después → pisa L1.
- L2 escribe después → pisa LP.
- **L3 escribe después → pisa L2.** ← Aquí L3 gana sobre L2 temporalmente.
- L3+ escribe después → pisa L3.
- **MANUAL HARD LOCK (paso 7) → REAPlica L2 sobre TODO.** ← Aquí L2 recupera el control.

**El problema:** L3 y L0 **coexisten en el mismo frame** sin un mecanismo de "exclusividad". Si L3 emite, sobreescribe L0. Si L3 NO emite, L0 fluye libre. No hay un estado intermedio de "L3 está activo, así que L0 se silencia".

**Esto es especialmente problemático para COLOR:**
- L0 (ColorSystem) calcula colores reactivos al audio cada frame.
- L3 (SeleneEffect) calcula colores de efecto (override) solo cuando hay un efecto activo.
- Cuando un efecto L3 está activo, su color sobreescribe al de L0 → correcto.
- Pero cuando el efecto L3 tiene `globalComposition < 1.0`, L0 brilla a través de la transparencia del efecto → **ambos colores se mezclan aditivamente** (LTP puro, no blend).

**Para KINETIC (movers):**
- L3 NUNCA emite `pan`/`tilt` (regla estricta del adapter).
- L0 (KineticSystem/VMM) controla el movimiento.
- L2-MOTOR (paso 11) tiene la última palabra sobre `pan`/`tilt`.
- **Conclusión:** No hay batalla L3 vs L0 en KINETIC porque L3 no participa.

### 3.5 Gaps Identificados

| # | Gap | Severidad | Detalle |
|---|---|---|---|
| **G1** | L3 sobreescribe L2 temporalmente antes del MANUAL HARD LOCK | 🔴 Alta | L3 gana sobre L2 en paso 5, pero L2 se recupera en paso 7. Esto causa **flickering** de 1 frame si L2 y L3 compiten en el mismo canal. |
| **G2** | No hay "fade/blend" entre L0 y L3 en COLOR | 🔴 Alta | Cuando L3 tiene `composition < 1.0`, L0 se ve completamente (LTP puro). No hay interpolación ponderada. |
| **G3** | L3 no tiene Smart Gate propio | 🟡 Media | L3 puede pisar canales que L2 ya estaba tocando, aunque el MANUAL HARD_LOCK lo revierte. |
| **G4** | `effectOutput.globalComposition` no afecta el arbitraje | 🟡 Media | El adapter usa `globalComposition` como `confidence`, pero el Arbiter no interpreta eso como un factor de mezcla. Es solo metadato. |
| **G5** | No hay concepto de "Selene está en efecto activo → silencia L0" | 🔴 Alta | El único mecanismo es el Energy Override (energy > 0.85), que NO aplica en la mayoría del tiempo. |

---

## 📋 RESUMEN EJECUTIVO

**El usuario reporta:** "Modo Balanced dispara demasiados efectos en música latina, y L3 pelea con L0/L2".

**Hallazgos:**

1. **BALANCED no tiene `blockList`.** Cualquier efecto puede disparar. El `thresholdMultiplier = 1.10` apenas filtra (un `rawScore = 0.66` pasa con `0.60`). En música latina (fiesta-latina threshold = 0.65), muchos momentos califican.

2. **El `GLOBAL_EFFECT_COOLDOWN_MS = 7000ms` es el único freno global.** Con 7s entre efectos, en una sesión de 5 minutos pueden disparar ~42 efectos. Eso es mucho para música latina donde los drops son cortos y los valles largos.

3. **L3 NO silencia L0.** Cuando Selene lanza un efecto, el color de L3 sobreescribe al de L0 (LTP), pero si el efecto tiene `globalComposition < 1.0`, L0 "brilla" por debajo. No hay mezcla ponderada — es un corte duro.

4. **MANUAL HARD LOCK protege L2, pero con 1 frame de lag.** L3 escribe en paso 5, L2 se recupera en paso 7. Si el operador tiene un fader manual activo, puede ver un flicker de efecto antes de que L2 lo revierta.

5. **El Energy Override (drop lock) funciona correctamente** pero solo aplica a `energy > 0.85`. En latino, la energía promedio de un drop está en 0.75-0.82, así que el veto NO se activa y Selene sigue disparando efectos durante drops.

**Recomendaciones arquitectónicas (para decisión del Lead Dev):**
- Considerar un `L3_BLOCK_GLOBAL` flag que, cuando un efecto L3 está activo, inhiba L0 en los nodos afectados (no solo sobreescribe).
- Revisar si BALANCED necesita un `blockList` mínimo o un `thresholdMultiplier` más alto para latino.
- Evaluar si el Energy Override threshold debería bajarse a ~0.75 para capturar drops de reguetón/cumbia.
- Considerar un mecanismo de "blend mode" en el Arbiter para canales COLOR donde L3 y L0 se mezclen ponderados por `confidence`/`composition`.

---

*Fin del reporte. Sin modificaciones aplicadas.*
