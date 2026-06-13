# WAVE-6040: Auditoría de Temperamento — Selene Lux V3

**Fecha:** 2026-06-12  
**Rol:** Ingeniero Core (Auditoría de Temperamento)  
**Scope:** Global Cooldown Gates, Pipeline Throttle, y Vulnerabilidad al Autotune (Energía Sostenida)

---

## 🔍 TAREA 1: Global Cooldown Gate & Pipeline Throttle

### 1.1 Fuentes de Verdad (Hardcoded Constants)

Todas las constantes viven en `@src/core/intelligence/SeleneTitanConscious.ts`.

| Gate | Valor Base (ms) | Afectado por Mood | Descripción |
|------|------------------|-------------------|-------------|
| `GLOBAL_EFFECT_COOLDOWN_MS` | **7000** | ✅ Sí (×mood) | Cooldown global post-disparo para **techno/pop-rock/chill**. |
| `LATINA_GLOBAL_EFFECT_COOLDOWN_MS` | **5000** | ✅ Sí (×mood) | Cooldown global post-disparo para **fiesta-latina** (más corto por groove). |
| `PIPELINE_EXECUTION_THROTTLE_MS` | **2000** | ❌ NO | Throttle hard entre ejecuciones del pipeline DNA. No se bypasea excepto por drops urgentes <800ms. |
| `JUST_FIRED_SHIELD_MS` | **2000** | ❌ NO | Escudo de inmunidad total. Ni drops urgentes pueden saltarlo. |
| `POST_DROP_REFRACTORY_MS` | **4000** | ❌ NO | Respiro retinal tras dictadores de alta severidad. |
| `DNA_OVERRIDE_MIN_INTERVAL_MS` | **12000** | ❌ NO | Mínimo entre overrides DNA (cualquier efecto). |
| `DNA_OVERRIDE_SAME_EFFECT_INTERVAL_MS` | **20000** | ❌ NO | Mínimo para repetir el **mismo** efecto vía DNA override. |

### 1.2 Multiplicadores de Mood (`MoodController.ts`)

El método `applyCooldown(baseMs)` multiplica los valores base:

| Mood | `cooldownMultiplier` | Efecto sobre `GLOBAL_EFFECT_COOLDOWN_MS` (7000ms) | Efecto sobre `LATINA_GLOBAL_EFFECT_COOLDOWN_MS` (5000ms) |
|------|----------------------|---------------------------------------------------|----------------------------------------------------------|
| **BALANCED** | **2.2** | **15.4 s** | **11.0 s** |
| **PUNK** | **0.7** | **4.9 s** | **3.5 s** |

> 📌 **Nota WAVE 4829:** El multiplicador BALANCED subió de 1.8 → 2.2 para bajar el EPM latino de 4-6 a 3-4 EPM objetivo.

### 1.3 Per-Effect Cooldowns (The Gatekeeper — `ContextualEffectSelector.ts`)

Los cooldowns por efecto (`EFFECT_COOLDOWNS`) también pasan por `applyCooldown(base)`:

| Efecto | Base (ms) | BALANCED (×2.2) | PUNK (×0.7) |
|--------|-----------|-----------------|-------------|
| `industrial_strobe` | 8000 | **17.6 s** | **5.6 s** |
| `acid_sweep` | 8000 | **17.6 s** | **5.6 s** |
| `cyber_dualism` | 10000 | **22.0 s** | **7.0 s** |
| `binary_glitch` | 8000 | **17.6 s** | **5.6 s** |
| `gatling_raid` | 8000 | **17.6 s** | **5.6 s** |
| `void_mist` | 12000 | **26.4 s** | **8.4 s** |
| `solar_flare` | 30000 | **66.0 s** | **21.0 s** |

Además existen `DICTATOR_HARD_MINIMUM_COOLDOWNS` (ej. `abyssal_rise` 20s, `latina_meltdown` 25s) que **NO** se bypasean por mood multiplier — son absolutos.

### 1.4 EPM Teórico Máximo (sin contar per-effect cooldowns)

| Mood | Vibe | Global Cooldown Efectivo | EPM Máximo Teórico |
|------|------|--------------------------|-------------------|
| BALANCED | techno-club | 15.4 s | **~3.9** |
| BALANCED | fiesta-latina | 11.0 s | **~5.5** |
| PUNK | techno-club | 4.9 s | **~12.2** |
| PUNK | fiesta-latina | 3.5 s | **~17.1** |

En la práctica, el `PIPELINE_EXECUTION_THROTTLE_MS = 2000` hace que el pipeline solo se ejecute cada 2s como mínimo, pero el **Global Cooldown** es el cuello de botella real en BALANCED. En PUNK, los per-effect cooldowns y los dictator hard minimums son los que frenaan.

### 1.5 Código de Aplicación del Global Cooldown

```ts
// @src/core/intelligence/SeleneTitanConscious.ts:1106-1112
const baseCooldownMs = pattern.vibeId === 'fiesta-latina'
  ? this.LATINA_GLOBAL_EFFECT_COOLDOWN_MS   // 5000
  : this.GLOBAL_EFFECT_COOLDOWN_MS           // 7000

// 🎭 WAVE 4860: Conectar mood cooldownMultiplier al reloj global
// CALM x4.0 = 28s-32s | BALANCED x2.2 = 15s-18s | PUNK x0.7 = 5s-6s
const globalCooldownMs = MoodController.getInstance().applyCooldown(baseCooldownMs)
```

---

## 🔍 TAREA 2: Vulnerabilidad al Autotune (Energía Sostenida)

### 2.1 Hallazgo Forense Principal

**NO existe mecanismo de "fatiga" o cooldown sobre el Z-Score ni sobre el emotionalTension que exija un valle de energía previo antes de permitir un nuevo disparo.**

El sistema confía en que la energía fluctúe. Si el autotune (o cualquier señal con compresión extrema) mantiene `rawEnergy > 0.55` de forma continua, Selene entra en **estado de alerta perpetua**.

### 2.2 Análisis por Componente

#### A) FuzzyDecisionMaker — Reglas de Strike por Energía

Las tres reglas de strike que dependen de energía (y NO requieren `section.peak`):

1. **`Pure_Energy_Strike`** (`FuzzyDecisionMaker.ts:528`):
   ```ts
   const zGate = Math.min(1, zScore.notable + zScore.epic * 0.5)
   return energy.high * energyZone.highZone * zGate * 0.55
   // weight: 0.70
   ```
   - `energy.high` se activa desde `E ≥ 0.50` (WAVE 2107, spread 0.50).
   - Con autotune sostenido en E ≈ 0.55-0.70, `energy.high` ≈ 0.10-0.40 **permanentemente**.
   - `energyZone.highZone` también será > 0 mientras la zona de energía sea `active/intense/peak`.

2. **`Notable_Energy_Strike`** (`FuzzyDecisionMaker.ts:514`):
   ```ts
   return zScore.notable * energy.high * energyZone.highZone
   // weight: 0.75
   ```

3. **`Energy_Building_Strike`** (`FuzzyDecisionMaker.ts:552`):
   ```ts
   return energy.high * max(section.building, section.peak) * energyZone.highZone * 0.70
   // weight: 0.70
   ```

**Defuzzify threshold** (WAVE 2109):
```ts
else if (outputs.strike > outputs.hold + 0.08 && outputs.strike > 0.25) {
  action = 'strike'
}
```

Con autotune sostenido, `outputs.strike` puede mantenerse en ~0.25-0.35 constantemente. Cada vez que el Global Cooldown expire (15.4s en BALANCED), Fuzzy tenderá a emitir `strike`.

#### B) Glass Break Sensor (Drop Collision)

```ts
// @src/core/intelligence/SeleneTitanConscious.ts (WAVE 5016)
const glassBreak = (
  timeToEvent > 0 &&
  this.contextualMemory.isWarmedUp &&
  currentZScore >= 2.5 &&           // Threshold absoluto
  titanState.rawEnergy > 0.55      // Threshold absoluto
)
```

- **NO requiere valle previo.**
- Si el autotune mantiene `rawEnergy > 0.55` y el Z-Score histórico se adapta lentamente a la nueva media, `currentZScore >= 2.5` puede dispararse repetidamente.
- El único freno es el Global Cooldown, pero una vez expirado, el Glass Break rompe el cristal y dispara.

#### C) Emotional Tension (`MusicalPatternSensor.ts`)

```ts
function calculateEmotionalTension(state, changes) {
  let tension = 0
  tension += state.smoothedEnergy * 0.4
  if (changes.energyTrend > 0) tension += changes.energyTrend * 2
  if (changes.sectionChanged) tension += 0.2
  tension += (1 - changes.beatStability) * 0.15
  if (state.high > 0.6 && state.bass < 0.3) tension += 0.15
  return min(1, max(0, tension))
}
```

- **Sin histéresis.** No existe "tension debe bajar antes de volver a subir".
- `isBuilding: recentChanges.energyTrend > 0.05` — si el autotune tiene micro-variaciones de ±0.06, esto oscilará entre `true/false` sin necesidad de un valle real.
- `emotionalTension` se calcula frame a frame y se pasa al pipeline, pero **NO** hay un gate de "valley required".

#### D) ContextualMemory Z-Score

```ts
// @src/core/intelligence/SeleneTitanConscious.ts:419-424
this.contextualMemory = new ContextualMemory({
  bufferSize: 1800,      // 30s @ 60fps
  zScoreNotable: 1.5,
  zScoreSignificant: 2.0,
  zScoreEpic: 2.5,
})
```

- El Z-Score se calcula sobre una ventana de **30 segundos**.
- Si el autotune mantiene energía constante durante >30s, la media se eleva y el Z-Score se **aplanará** (tenderá a 0), lo cual es positivo.
- **PERO**: durante los primeros 30s de una canción con autotune, el Z-Score será alto porque la media histórica aún es baja (arranque del buffer). Esto crea un **período de vulnerabilidad crítica** al inicio de cada pista.

### 2.3 Resumen de la Brecha

| Mecanismo | ¿Protege contra autotune sostenido? | ¿Por qué?
|-----------|--------------------------------------|----------|
| Global Cooldown (7s / 5s base) | **Parcial** | Solo limita frecuencia, no detecta la naturaleza de la señal. |
| Per-Effect Cooldowns | **Parcial** | Igual que arriba; el pool de efectos disponibles se rota, pero siempre hay alguno listo. |
| Z-Score Gate (≥2.5) | **NO** | Es umbral absoluto; no exige valle previo. |
| `energy.high` fuzzificación | **NO** | Se activa desde E≥0.50; autotune E≈0.55-0.70 la mantiene viva. |
| Fuzzy defuzzify (>0.25) | **NO** | Con energía sostenida, strike puede mantenerse >0.25. |
| Emotional Tension | **NO** | Sin histéresis de valle; puede mantenerse alto indefinidamente. |
| ContextualMemory 30s buffer | **Mitiga a largo plazo** | Después de 30s el Z-Score se aplana, pero los primeros 30s son críticos. |

---

## 🎯 Conclusiones y Recomendaciones Arquitectónicas

1. **El EPM objetivo de 3-5 en BALANCED ya está cuberto matemáticamente** por el cooldown multiplier 2.2 (15.4s global). El problema de "8-9 EPM" observado probablemente proviene de:
   - **Punk override** activándose inadvertidamente.
   - **Fuzzy unlock** (`fuzzyUnlock` en `SeleneTitanConscious.ts:1089`) abriendo el pipeline antes de que Hunt esté listo.
   - **Glass Break** disparando drops en loop durante los primeros 30s de pista con autotune.

2. **La vulnerabilidad al autotune es REAL y carece de filtro de señal sostenida.**
   Se recomienda implementar un **Valley Requirement Gate**:
   - Trackear `minEnergySinceLastEffect`.
   - Requerir que `rawEnergy` baje por debajo de un umbral (ej. 0.40) antes de que cualquier regla de strike por energía pueda activarse de nuevo.
   - Esto rompería el ciclo de "alerta perpetua" del autotune.

3. **La ventana de 30s del ContextualMemory es un vector de ataque** al inicio de pistas.
   Considerar un **Z-Score warm-up penalty**: durante los primeros N segundos de pista, elevar los thresholds de Z-Score para compensar la media histórica incompleta.

---

**FASE DE AUDITORÍA COMPLETADA: Temperamento de Selene V3 mapeado. Global Cooldown = 15.4s@BAL / 4.9s@PUNK. Brecha de autotune confirmada: sin filtro de valle en Z-Score ni emotionalTension.**
