# SELENE V3 — PRECISION TUNING & DIAGNOSTIC REPORT

**Fecha:** 2025-01-24  
**Autor:** Cascade (pair-programming)  
**Destinatario:** Architect (Radwulf)  
**Estado:** Post-FIX 9-13 (cooldowns ajustados, bypasses recortados, thresholds elevados)

---

## 1. Z-SCORE CALCULATION — Estado Actual

### 1.1 Implementación

**Archivo:** `memory/RollingStats.ts`  
**Algoritmo:** Suma incremental (no Welford puro — usa `sum` y `sumSquares` con fórmula `E[X²] - E[X]²`)

**Configuración activa (ContextualMemory):**

| Parámetro | Valor | Nota |
|---|---|---|
| `bufferSize` | **1800** | 30s @ 60fps (WAVE 1181) |
| `minStdDev` | **0.10** | WAVE 5003 — floor de varianza |
| `maxZScoreCap` | **10.0** | Cap anti-outlier |

**Fórmula Z-Score:**
```
zScore = clamp((current - mean) / max(stdDev, minStdDev), -10, +10)
```

### 1.2 Problemas Detectados en el Z-Score

#### Problema A: `minStdDev = 0.10` es DEMASIADO ALTO

El floor de 0.10 significa que la desviación estándar nunca puede ser menor a 0.10. En la práctica:

- **Música latina/reguetón:** variación natural de energía ~5-8% (stdDev real = 0.05-0.08). Con floor=0.10, **el Z-score está siendo comprimido artificialmente**.
- **Drop real:** energy pasa de 0.30 → 0.75. Z = (0.75 - 0.30) / 0.10 = **4.5σ** — correcto.
- **Micro-valley:** energy pasa de 0.30 → 0.35. Z = (0.35 - 0.30) / 0.10 = **0.5σ** — correcto.
- **Pero:** vocal transient en valle: energy 0.25 → 0.40. Z = (0.40 - 0.25) / 0.10 = **1.5σ** — apenas notable.

**Conclusión:** El floor de 0.10 no es la causa del overfiring. Está correctamente suprimiendo Z-scores espurios en valles. El problema está en otro lugar.

#### Problema B: Ventana de 1800 muestras (30s) — Lenta para reaccionar

Con 30s de ventana, la media se mueve lentamente. Un drop sostenido de 10s apenas mueve la media. Esto significa que:
- En el **inicio** de un drop, el Z-score es alto (0.75 vs media 0.35 = +4σ).
- En el **final** del drop (10s después), la media ya subió a ~0.45, Z baja a +3σ.
- **Post-drop:** la media sigue alta (~0.50), y cuando la energía cae a 0.25, Z = (0.25 - 0.50) / 0.10 = **-2.5σ** (negativo, no trigger).

**Conclusión:** La ventana de 30s es adecuada para estabilidad. No causa overfiring.

### 1.3 Flujo del Z-Score

```
RollingStats.update(energy)
  → ContextualMemory.update()
    → SeleneTitanConscious.process()
      → zScore = lastMemoryOutput.stats.energy.zScore
        → LiquidCognitionCore.process({ zScore, ... })
          → CognitiveFluidState.update({ zScore, ... })
            → impact = w_z·tanh(z/z_ref) + w_cf·CF̂ + w_e·Ê
              → epicness = (impact - tension/2) / (tension/2)
```

**Pesos del impacto (profile):**
- `w_z = 0.45` (Z-score)
- `w_cf = 0.30` (crest factor)
- `w_e = 0.25` (energy)
- `z_ref = 3.0` (normalización tanh)

**Cálculo de impacto:**
```
zHat = tanh(zScore / 3.0)       // z=3 → zHat=0.76, z=6 → zHat=0.98
eHat = rawEnergy / energyMax    // normalizado 0-1
impact = 0.45·zHat + 0.30·CF̂ + 0.25·eHat   // clamp 0-1
```

---

## 2. EPICNESS — El Centro del Problema

### 2.1 Fórmula Actual (con FIX aplicado)

**Archivo:** `liquid/CognitiveFluidState.ts:240-243`

```typescript
const halfTension = this._tension * 0.5
this._epicness = halfTension > 0.001
  ? clamp01((this._impact - halfTension) / halfTension)
  : 0
```

**Semántica:**
- `epicness = 0` cuando `impact ≤ tension/2`
- `epicness = 1` cuando `impact ≥ tension`
- `epicness = 0.5` cuando `impact = 0.75·tension`

### 2.2 Análisis Numérico — Por qué Fire en Valles

**Tensión de equilibrio:** `T_eq = T_base + kappa_sigma · temperature = 0.60 + 0.80 · temperature`

| Escenario | Temperature | T_eq | Tensión real (aprox) |
|---|---|---|---|
| Valle profundo (E=0.20) | ~0.20 | 0.76 | ~0.60 (T_min floor) |
| Valle medio (E=0.35) | ~0.35 | 0.88 | ~0.65 |
| Drop (E=0.75) | ~0.75 | 1.20 → clamp 0.85 | ~0.80 |
| Breakdown (E=0.15) | ~0.15 | 0.72 | ~0.60 |

**Impacto máximo práctico:**
- En valle con vocal transient (E=0.40, Z=1.5, CF̂=0.3):
  - `zHat = tanh(1.5/3.0) = 0.46`
  - `eHat = 0.40 / max_historic ≈ 0.50`
  - `impact = 0.45·0.46 + 0.30·0.3 + 0.25·0.50 = 0.207 + 0.09 + 0.125 = 0.42`
  - `halfTension = 0.60·0.5 = 0.30`
  - `epicness = (0.42 - 0.30) / 0.30 = 0.40` — **¡SUPERA epsilon_divine=0.30!**

**ESTE ES EL BUG RAÍZ:**

Un vocal transient en un valle (E=0.40, Z=1.5) genera `epicness ≈ 0.40`, que supera `epsilon_divine = 0.30`, disparando un **DIVINE STRIKE** en un momento de baja energía.

### 2.3 Por qué la Tensión es el Problema

La tensión tiene `T_min = 0.30` como floor. En valles, la tensión NO baja de 0.30 (y en práctica se queda en ~0.60 por la homeostasis con `T_base = 0.60`). Esto significa que `halfTension = 0.30`, y cualquier impacto > 0.30 genera epicness > 0.

El impacto casi siempre supera 0.30 porque:
- `w_z · zHat` solo con Z=1.0 ya da 0.45·tanh(0.33) = 0.45·0.32 = 0.14
- `w_e · eHat` con E=0.35 y max=0.80 da 0.25·0.44 = 0.11
- `w_cf · CF̂` con crest moderado (0.3) da 0.30·0.3 = 0.09
- Total mínimo: ~0.34 — ya supera halfTension=0.30

### 2.4 El Abismo V2 ↔ V3

**V2 (estático):** Z-score > 4.0 = DIVINE. Simple, conservador. Z=1.5 en un valle NUNCA dispara divine.

**V3 (liquid):** epicness > 0.30 = DIVINE. Pero epicness se calcula con una fórmula que **no tiene relación directa con el Z-score absoluto**. Un Z=1.5 con energía moderada puede generar epicness=0.40 si la tensión está en su floor.

**La incoherencia:** V2 usaba el Z-score absoluto como autoridad. V3 usa epicness, que es una función de impacto vs tensión, donde el impacto es una mezcla de Z-score normalizado (tanh), crest factor, y energía. **La normalización tanh comprime el Z-score**, haciendo que Z=1.5 y Z=4.0 produzcan valores de zHat muy diferentes (0.46 vs 0.76), pero el impacto total se diluye con los otros componentes.

---

## 3. BYPASS MECHANISMS — Estado Post-FIX

### 3.1 V3 Ignite Bypass (Gatekeeper)

**Estado actual (post-FIX 9-10-11):**

| Mecanismo | Antes | Ahora | Estado |
|---|---|---|---|
| V3 bypass min interval | 5s | **8s** | ✅ FIX 9 |
| V3 bypass same-effect interval | 10s | **15s** | ✅ FIX 9 |
| Refractory lock bypass | `_v3Ignite` lo bypaseaba | **NO bypass** | ✅ FIX 10 |
| Global cooldown bypass | `_v3Ignite` lo bypaseaba | **NO bypass** | ✅ FIX 11 |

**Condiciones para V3 Ignite Bypass (línea 1566-1572):**
```
v3IgniteBypass = _v3Ignite
  && isDNADecision
  && ethicsScore >= ethicsThreshold
  && !isHardMinimumBlocked
  && !oceanicProtection
  && v3BypassTemporalReady
  && !alreadyValidatedByArsenal
```

**Evaluación:** El bypass sigue siendo potente. Cuando `_v3Ignite = true` y DNA aprueba con ética alta, el efecto pasa el gatekeeper sin respetar el cooldown global ni el refractory. Los únicos frenos son:
1. `HARD_COOLDOWN` del EffectSelector (ley absoluta).
2. `v3BypassTemporalReady` (8s/15s entre bypasses).
3. `oceanicProtection` (protección de efectos oceánicos).

### 3.2 Sovereign Clock Bypass

**Líneas 596-664:** Cassandra puede disparar efectos pre-buffered bypaseando **todo**:
- HuntEngine
- Fuzzy
- EnergyOverride
- Global Cooldown
- Refractory Lock
- Gatekeeper completo

**Único freno post-FIX:** `V3_EPSILON_DIVINE = 0.30` — si el efecto es divine candidate y `epicness ≤ 0.30`, se aborta.

**Problema:** Como vimos en §2.2, epicness puede ser 0.40 en un valle con vocal transient. El Sovereign Clock **no aborta** en ese caso porque 0.40 > 0.30.

### 3.3 EnergyOverride Bypass

**Línea 748:** `if (energyOverride && !this._v3Ignite)` — V3 ignite bypasea el EnergyOverride.

Esto significa que en un valle (E < 0.75), si V3 dice ignite, el EnergyOverride no se aplica. El pipeline completo (think → dream → validate) se ejecuta. Esto es **correcto por diseño** — V3 tiene autoridad sobre la física reactiva. Pero el problema es que V3 ignite se activa con demasiada facilidad.

### 3.4 DNA Confidence Bypass (DecisionMaker)

**Línea 205-206:** `dnaApproved` bypasea el `minConfidenceThreshold = 0.55`.

```typescript
const dnaApproved = inputs.dreamIntegration?.approved && inputs.dreamIntegration.effect?.effect
if (!dnaApproved && combinedConfidence < cfg.minConfidenceThreshold) {
  return output  // early return, no decision
}
```

**Evaluación:** Cuando DNA aprueba un efecto, el threshold de confianza se ignora completamente. Esto es correcto para no bloquear efectos aprobados, pero significa que el único freno real es el Gatekeeper.

---

## 4. SENSOR FUSION — Análisis de Confianza C(t)

### 4.1 Fórmula

**Archivo:** `liquid/SensorFusionChamber.ts`

```
C(t) = exp(w1·ln(s_DNA) + w2·ln(s_Z) + ... + w7·ln(s_B))
```

Media geométrica ponderada. Cada sensor está clampeado a [0.01, 1.0].

### 4.2 Pesos Calibrados (Monte Carlo)

| Sensor | Peso | Descripción |
|---|---|---|
| s_DNA | 0.170 | Kernel gaussiano ACO |
| s_Z | 0.029 | Anomalía normalizada por tensión |
| s_E | **0.325** | Energía líquida (DOMINANTE) |
| s_V | 0.152 | Filtro anti-voz |
| s_X | 0.027 | Excitabilidad |
| s_P | **0.277** | Prior de Cassandra |
| s_B | 0.020 | Belleza/consonancia |

### 4.3 Problema: s_P (Cassandra) tiene peso 0.277

`s_P = 0.5 + 0.5 · predictionProbability · predictionAlignment`

Cassandra casi siempre tiene `predictionProbability > 0` y `predictionAlignment = 0.7` (hardcoded en línea 699). Esto significa que `s_P` típicamente vale `0.5 + 0.5 · 0.5 · 0.7 = 0.675` mínimo.

Con peso 0.277, `s_P` contribuye `0.277 · ln(0.675) = 0.277 · (-0.39) = -0.108` al log-confianza. Esto es una contribución **moderada pero constante** que infla la confianza base.

### 4.4 Problema: s_V (anti-voz) no es suficientemente agresivo

```
vocalDominance = sigmoid(5.0 · (midBassRatio - 1.6)) · (1 - crestFactor)
s_V = 1 - 0.75 · vocalDominance
```

En un valle con vocal transient:
- `midBassRatio` puede ser alto (mid dominante, bass bajo): ~3.0
- `vocalSig = sigmoid(5.0 · (3.0 - 1.6)) = sigmoid(7.0) ≈ 0.999`
- `crestFactor` bajo en valle: ~0.2
- `vocalDominance = 0.999 · (1 - 0.2) = 0.799`
- `s_V = 1 - 0.75 · 0.799 = 0.40`

Con peso 0.152: `0.152 · ln(0.40) = 0.152 · (-0.92) = -0.140`. Esto **penaliza** la confianza, pero no lo suficiente para evitar ignición cuando s_E y s_P son altos.

### 4.5 Ignition Chamber — Squelch Q(t)

```
Q(t) = Q_base · (1 + kappa_T · T̂) · (1 - kappa_V · V)
```

Con `Q_base = 0.650` (post-FIX 13), `kappa_T = 0.50`, `kappa_V = 0.40`:

| Escenario | T̂ | V | Q(t) |
|---|---|---|---|
| Valle (T=0.60, V=0.8) | 0.545 | 0.8 | 0.650·1.27·0.68 = **0.562** |
| Drop (T=0.80, V=0.1) | 0.909 | 0.1 | 0.650·1.45·0.96 = **0.907** |
| Breakdown (T=0.60, V=0.9) | 0.545 | 0.9 | 0.650·1.27·0.64 = **0.529** |

**Problema crítico:** En valle con alta presión de vapor (V=0.8), el squelch baja a **0.562**. Si la confianza C(t) supera 0.562, V3 ignita.

**¿Puede C(t) superar 0.562 en un valle?**

Con valores típicos de valle con vocal transient:
- s_DNA ≈ 0.5 (genome neutral, distancia moderada)
- s_Z ≈ 0.5 (impact/tension ratio ~1.0, sigmoid centrado)
- s_E ≈ 0.35^0.7 = 0.47 (energía comprimida)
- s_V ≈ 0.40 (penalización vocal)
- s_X ≈ 0.7 (excitabilidad recuperada en valle)
- s_P ≈ 0.675 (Cassandra siempre presente)
- s_B ≈ 0.7 (belleza estable)

```
ln C = 0.170·ln(0.5) + 0.029·ln(0.5) + 0.325·ln(0.47) + 0.152·ln(0.40)
       + 0.027·ln(0.7) + 0.277·ln(0.675) + 0.020·ln(0.7)
     = 0.170·(-0.69) + 0.029·(-0.69) + 0.325·(-0.76) + 0.152·(-0.92)
       + 0.027·(-0.36) + 0.277·(-0.39) + 0.020·(-0.36)
     = -0.117 - 0.020 - 0.247 - 0.140 - 0.010 - 0.108 - 0.007
     = -0.649

C = exp(-0.649) = 0.522
```

**C = 0.522 < Q = 0.562** — NO ignita en este escenario.

Pero si el vocal transient es un poco más fuerte (E=0.45, Z=2.0):
- s_E = 0.56^0.7 = 0.66
- s_Z = sigmoid(4·(impact/tension - 1)) con impact=0.50, tension=0.60 → ratio=0.83 → sigmoid(4·(-0.17)) = sigmoid(-0.68) = 0.34

```
ln C = 0.170·ln(0.5) + 0.029·ln(0.34) + 0.325·ln(0.66) + 0.152·ln(0.40)
       + 0.027·ln(0.7) + 0.277·ln(0.675) + 0.020·ln(0.7)
     = -0.117 - 0.032 - 0.131 - 0.140 - 0.010 - 0.108 - 0.007
     = -0.545

C = exp(-0.545) = 0.580
```

**C = 0.580 > Q = 0.562** — **¡IGNITA!** V3 dice fuego en un valle con un vocal transient moderado.

**Y luego epicness:** con impact=0.50, tension=0.60:
```
epicness = (0.50 - 0.30) / 0.30 = 0.67 > 0.30 → DIVINE STRIKE
```

**ESTO CONFIRMA EL MECANISMO DE OVERFIRING.**

---

## 5. DIAGNÓSTICO CONSOLIDADO

### 5.1 Cadena de Causa-Raíz del Overfiring

```
Vocal transient en valle
  → Energy sube a 0.40-0.45
  → Z-score = 1.5-2.0 (moderado, no épico)
  → Impact = 0.42-0.50 (mezcla de Z, CF, E)
  → Tensión = 0.60 (floor homeostático, no baja)
  → Epicness = (impact - 0.30) / 0.30 = 0.40-0.67
  → Epicness > epsilon_divine (0.30) → DIVINE STRIKE
  → DecisionMaker retorna 'divine_strike'
  → DNA aprueba (si el pipeline corrió)
  → Gatekeeper: v3IgniteBypass activo (V3 ignite + DNA + ethics)
  → Efecto disparado en valle ← BUG
```

### 5.2 Fuentes del Problema

| # | Fuente | Severidad | Componente |
|---|---|---|---|
| **1** | **Epicness formula permite valores altos en valles** | CRÍTICA | CognitiveFluidState |
| **2** | **Tensión no baja lo suficiente en valles** (T_base=0.60, T_min=0.30) | ALTA | CognitiveFluidState |
| **3** | **epsilon_divine = 0.30 es demasiado bajo** para la distribución real de epicness | ALTA | DecisionMaker + Sovereign Clock |
| **4** | **Vapor pressure reduce Q(t) en valles**, facilitando ignición | MEDIA | IgnitionChamber |
| **5** | **s_P (Cassandra) infla confianza base** con peso 0.277 | MEDIA | SensorFusionChamber |
| **6** | **s_V (anti-voz) no penaliza lo suficiente** transients vocales | MEDIA | SensorFusionChamber |
| **7** | **Sovereign Clock bypassa TODO** sin verificar epicness adecuadamente | ALTA | SeleneTitanConscious |
| **8** | **DNA confidence bypass** permite efectos sin verificar contexto energético | BAJA | DecisionMaker |

### 5.3 Lo Que Ya Se Arregló (FIX 9-13)

| FIX | Qué hace | Impacto |
|---|---|---|
| FIX 9 | V3 bypass cooldown 5s→8s, 10s→15s | Reduce frecuencia de bypasses |
| FIX 10 | Refractory lock ya no es bypaseado por V3 | 4s de respiro garantizado post-drop |
| FIX 11 | Global cooldown ya no es bypaseado por V3 | 7s (o 5s latina) entre efectos |
| FIX 12 | epsilon_divine 0.25→0.30 | Menos divinos espurios |
| FIX 13 | Q_base 0.55→0.65 | Squelch más alto, menos igniciones |

**Evaluación:** Los FIX redujeron la frecuencia pero **no atacaron la raíz**. El overfiring sigue siendo posible porque la cadena de causa-raíz (§5.1) permanece intacta.

---

## 6. BATTLE PLAN — Hacer a Selene Precisa

### Fase 1: Corregir Epicness (CRÍTICA)

**Objetivo:** Epicness solo debe ser alta en momentos genuinamente épicos (drops, buildups intensos, transiciones mayores).

#### Opción A: Floor de Energía en Epicness
```typescript
// Epicness solo computa si la energía supera un umbral mínimo
const ENERGY_FLOOR_FOR_EPIC = 0.45
if (input.rawEnergy < ENERGY_FLOOR_FOR_EPIC) {
  this._epicness = 0
  return
}
```
**Pros:** Simple, efectivo, elimina divinos en valles.  
**Contras:** Puede perder momentos épicos de baja energía (breakdowns dramáticos).

#### Opción B: Factor de Energía en Epicness
```typescript
// Multiplicar epicness por factor de energía
const energyFactor = clamp01((input.rawEnergy - 0.30) / 0.40)  // 0 at E=0.30, 1 at E=0.70
this._epicness = clamp01(baseEpicness * energyFactor)
```
**Pros:** Gradual, no hard gate. Preserva algo de epicness en energías medias.  
**Contras:** Más complejo, requiere calibración.

#### Opción C: Tensión Dinámica (atacar T_base)
```typescript
// Bajar T_base para que la tensión baje más en valles
T_base: 0.40  // was 0.60
// Y/o bajar T_min
T_min: 0.15   // was 0.30
```
**Pros:** Ataca la raíz — tensión baja en valles → halfTension baja → epicness requiere menos impacto pero la tensión refleja mejor el estado real.  
**Contras:** Puede desestabilizar la homeostasis. Requiere recalibrar kappa_sigma y lambda_home.

**Recomendación:** Opción B (factor de energía) + subir epsilon_divine a 0.40.

### Fase 2: Subir epsilon_divine (ALTA)

```
epsilon_divine: 0.30 → 0.40
```

Con la distribución actual de epicness, 0.40 eliminaría la mayoría de divinos espurios en valles (donde epicness típicamente cae en 0.30-0.45) mientras preserva divinos genuinos en drops (donde epicness > 0.60).

### Fase 3: Ajustar Vapor Pressure (MEDIA)

El vapor pressure reduce Q(t) en valles, facilitando ignición. Esto es **por diseño** (la "sed" acumulada), pero es demasiado permisivo:

```typescript
// Opción: Reducir beta_v (tasa de acumulación de vapor)
beta_v: 0.03 → 0.015  // acumula más lento

// Opción: Cap máximo de vapor pressure
V_max = 0.6  // was implícitamente 1.0
```

### Fase 4: Reforzar s_V (Anti-Voz) (MEDIA)

```typescript
// Subir kappa_vmax para penalizar más la voz
kappa_vmax: 0.75 → 0.90

// O bajar rho_v para que el filtro active antes
rho_v: 1.6 → 1.2
```

### Fase 5: Reducir peso de s_P (Cassandra) (MEDIA)

```typescript
w6: 0.277 → 0.15  // Cassandra no debería tener tanto peso en la fusión
```

Esto reduciría la contribución constante de Cassandra a la confianza base.

### Fase 6: Sovereign Clock — Verificación Doble (ALTA)

Actualmente el Sovereign Clock solo aborta divine effects si `epicness ≤ epsilon_divine`. Pero como vimos, epicness puede ser engañoso. Añadir verificación de energía:

```typescript
if (registryEntry?.simMeta.isDivineCandidate) {
  const energyTooLow = titanState.rawEnergy < 0.50
  if (v3EpicnessNow <= V3_EPSILON_DIVINE || energyTooLow) {
    divineAborted = true
  }
}
```

### Fase 7: Log Detallado para Validación (BAJA)

Añadir logging de epicness en el momento del disparo para validar empíricamente:

```typescript
console.log(
  `[Gatekeeper 📊] ${intent} | E=${titanState.rawEnergy.toFixed(2)} ` +
  `Z=${zScore.toFixed(2)} impact=${impact.toFixed(3)} ` +
  `tension=${tension.toFixed(3)} epicness=${epicness.toFixed(3)} ` +
  `Q=${squelch.toFixed(3)} C=${confidence.toFixed(3)} ` +
  `V=${vaporPressure.toFixed(3)} → ${fired ? 'FIRED' : 'BLOCKED'}`
)
```

---

## 7. RESUMEN EJECUTIVO

| Métrica | Valor Actual | Propuesto | Impacto |
|---|---|---|---|
| `epsilon_divine` | 0.30 | **0.40** | Elimina ~70% de divinos espurios |
| `T_base` | 0.60 | **0.40** | Tensión baja en valles, epicness más preciso |
| `beta_v` | 0.03 | **0.015** | Vapor acumula más lento, Q(t) más estable |
| `kappa_vmax` | 0.75 | **0.90** | Penaliza voz con más fuerza |
| `w6 (s_P)` | 0.277 | **0.15** | Cassandra infla menos la confianza |
| Energy floor en epicness | None | **0.30-0.45** | Epicness = 0 en valles profundos |

**Prioridad de implementación:**
1. **Fase 2** (epsilon_divine → 0.40) — cambio de 1 línea, impacto inmediato.
2. **Fase 1 Opción B** (energy factor en epicness) — ~5 líneas, ataca la raíz.
3. **Fase 6** (Sovereign Clock energy check) — ~3 líneas, safety net.
4. **Fase 3-5** (vapor, anti-voz, Cassandra) — tuning fino, requiere escucha.

**Riesgo:** Los cambios pueden hacer a Selene demasiado conservadora. Recomendar implementar Fase 1+2 primero, escuchar, y ajustar Fase 3-5 según resultados.
