# SELENE V3 — CALIBRATION REPORT
## WAVE 7004.4 — V3 Batch Monte Carlo Calibration

**Fecha:** 2026-07-08
**Corpus:** 10 archivos `.jsonl` (2700 frames c/u @ ~44Hz, salvo `Badbunny_denbow_buildup.jsonl` con 1741 frames)
**Método:** Simulated Annealing multi-start (5 corridas × 2500 iteraciones), función de coste global ponderada

> Nota: la directiva original menciona "13 archivos"; el corpus disponible en `docs/Selene V3/jsones montecarlo/` contiene **10**. Se calibró sobre los 10 existentes.

---

## 1. Metodología

El JSONL grabado por `LiquidTelemetryRecorder` contiene el *output* del pipeline (no los inputs crudos pre-fusión de energía/espectro). Para hacer la calibración reproducible sin re-instrumentar el motor:

- **Sensores `s_DNA`...`s_B`**: grabados crudos, pre-fusión → se re-fusionan exactamente con pesos `w1..w7` candidatos (cero error).
- **`impact`, `crestFactor`, `temperature`, `viscosity`**: dependen de coeficientes (`w_z`, `w_cf`, `w_e`, `CF_ref`, `w_m/w_f/w_h/w_p`) que **no** forman parte de este lote de búsqueda → se reinyectan como señales exógenas grabadas (replay exacto).
- **`eHat`** (energía normalizada): recuperada invirtiendo `s_E = eHat^0.7` (gamma_e del perfil default usado en la grabación).
- **`T(t)` y `V(t)`**: re-simulados recursivamente frame-a-frame con los coeficientes candidatos, replicando exactamente `CognitiveFluidState.update()` e `IgnitionChamber.evaluate()`.

**Parámetros buscados (12 dims):** `T_base`, `kappa_sigma`, `alpha_rise`, `tau_sat`, `Q_base`, `w1..w7` (normalizados a suma 1).

**Función de coste por archivo:**
- Miss penalty (5000) si cero ignites en todo el clip.
- +300 por cada disparo adicional más allá del primero.
- +250·(3−gap)² por cada par de ignites con gap < 3.0s (jitter).

**Ponderación global:** peso 1.0 para todos los géneros electrónicos/latinos, peso 0.3 para el stress-test de rock (`toxicity_systemdown_intro_verse.jsonl`), tal como se solicitó — el rock se usa como comprobación de no-colapso, no como objetivo de ajuste fino.

---

## 2. El Perfil Ganador

**Coste global ponderado final: `32.26`** (9 de 10 archivos con coste `0` — ver §4 sobre el archivo restante).

```typescript
export const CALIBRATED_LIQUID_PROFILE: Readonly<ILiquidCognitionProfile> = Object.freeze({
  // — Tensión Superficial — [CALIBRADOS]
  T_min: 0.30,           // sin cambio (no buscado)
  T_max: 0.85,           // sin cambio (no buscado)
  T_base: 0.800,         // ⬆ default 0.50 — mayor "dureza" basal de la superficie
  kappa_sigma: 0.800,    // ⬆ default 0.35 — fuerte acople a temperatura/dispersión
  alpha_rise: 0.010,     // ⬇ default 0.04 — endurecimiento por clímax más lento
  tau_sat: 1.0,          // ⬇ default 6.0 — saturación de tensión casi inmediata
  lambda_0: 0.008,       // sin cambio (no buscado)
  kappa_d: 2.5,          // sin cambio (no buscado)
  D_half: 8.0,           // sin cambio (no buscado)
  lambda_home: 0.015,    // sin cambio (no buscado)
  w_z: 0.45,             // sin cambio (no buscado — requiere inputs crudos)
  w_cf: 0.30,            // sin cambio (no buscado)
  w_e: 0.25,             // sin cambio (no buscado)
  z_ref: 3.0,            // sin cambio (no buscado)
  CF_ref: 3.5,           // sin cambio (no buscado)

  // — Inercia y Vapor — [NO BUSCADOS en este lote]
  tau_min: 1.5,
  tau_max: 9.0,
  w_m: 0.40,
  w_f: 0.25,
  w_h: 0.20,
  w_p: 0.30,
  beta_v: 0.03,
  kappa_vreset: 0.15,

  // — Fusión — [CALIBRADOS w1-w7]
  w1: 0.1699,   // ⬇ default 0.22  — s_DNA (afinidad genómica)
  w2: 0.0291,   // ⬇⬇ default 0.20 — s_Z (anomalía Z-score) — CASI IRRELEVANTE
  w3: 0.3252,   // ⬆⬆ default 0.15 — s_E (energía líquida) — DOMINANTE
  w4: 0.1515,   // ≈  default 0.15 — s_V (anti-voz) — SIN CAMBIO SIGNIFICATIVO
  w5: 0.0273,   // ⬇⬇ default 0.12 — s_X (excitabilidad) — CASI IRRELEVANTE
  w6: 0.2766,   // ⬆⬆ default 0.08 — s_P (prior Cassandra) — MUY REFORZADO
  w7: 0.0204,   // ⬇⬇ default 0.08 — s_B (belleza/consonancia) — CASI IRRELEVANTE
  sigma_g: 0.35,     // sin cambio (no buscado)
  kappa_z: 4.0,      // sin cambio (no buscado)
  b_z: 0.0,          // sin cambio (no buscado)
  gamma_e: 0.7,      // sin cambio (no buscado)
  kappa_v: 5.0,      // sin cambio (no buscado)
  rho_v: 1.6,        // sin cambio (no buscado)
  kappa_vmax: 0.75,  // sin cambio (no buscado)

  // — Ignición — [Q_base CALIBRADO]
  Q_base: 0.700,      // ⬆⬆ default 0.45 — squelch basal mucho más alto
  kappa_T: 0.50,      // sin cambio (no buscado)
  kappa_V: 0.40,      // sin cambio (no buscado)
  I_min: 0.35,        // sin cambio (no buscado)
  kappa_i: 2.0,       // sin cambio (no buscado)
  kappa_vb: 0.10,     // sin cambio (no buscado)
  kappa_rep: 0.6,     // sin cambio (no buscado)
  tau_novelty: 45.0,  // sin cambio (no buscado)
  epsilon_divine: 0.25, // sin cambio (no buscado)
})
```

**⚠️ Advertencia metodológica:** `T_base` y `kappa_sigma` convergieron al **borde superior** del espacio de búsqueda permitido (`[0.35, 0.80]` y `[0.10, 0.80]` respectivamente), al igual que `alpha_rise` y `tau_sat` al borde inferior. Esto sugiere que el óptimo real podría estar aún más allá de estos límites. Se recomienda un Lote 2 con bounds ampliados (`T_base` hasta 0.85 = `T_max`, `kappa_sigma` sin techo artificial) para confirmar si el sistema converge a un punto interior o sigue empujando al límite — lo cual indicaría que la "respiración" de la tensión superficial es menos determinante que el squelch base + vapor para la supresión de jitter, y podría simplificarse en una V3.1.

---

## 3. Comportamiento por Textura

| Archivo | Género | Frames | Duración | Ignitions | Offset(s) | T_max | T_min | V_max | μ̄ (viscosidad) |
|---|---|---|---|---|---|---|---|---|---|
| `076_djtiesto_buildup` | EDM (Tiësto) | 2700 | 121.5s | **1** | 58.28 | 0.850 | 0.640 | 0.550 | 0.082 |
| `adagioforstrings_djTiesto_buildup` | EDM (Tiësto) | 2700 | 157.8s | **1** | 115.39 | 0.850 | 0.631 | 0.739 | 0.160 |
| `Opus_Prydtz_buildup` | Techno (Prydz) | 2700 | 260.5s | **2*** | 31.66 / 165.08 | 0.850 | 0.475 | 0.948 | 0.037 |
| `gravity_brejcha_buildup` | Techno (Brejcha) | 2700 | 172.4s | **1** | 48.71 | 0.850 | 0.596 | 0.916 | 0.025 |
| `Youmakeme_Rufus_buildupsynths` | Electrónica orgánica (Rüfüs Du Sol) | 2700 | 217.9s | **1** | 110.16 | 0.850 | 0.558 | 0.592 | 0.035 |
| `Badbunny_denbow_buildup` | Dembow vocal (Bad Bunny) | 1741 | 71.0s | **1** | 70.65 | 0.850 | 0.691 | 0.465 | 0.169 |
| `nuevayol_badbunny_denbow` | Dembow vocal (Bad Bunny) | 2700 | 85.1s | **1** | 36.55 | 0.850 | 0.599 | 0.564 | 0.118 |
| `remixcumbia_introbuildpup` | Cumbia (buildup) | 2700 | 78.3s | **1** | 33.93 | 0.850 | 0.591 | 0.548 | 0.157 |
| `remixcumbia_verse` | Cumbia (verse) | 2700 | 85.6s | **1** | 46.52 | 0.850 | 0.587 | 0.666 | 0.076 |
| `toxicity_systemdown_intro_verse` | Rock/Nu-Metal (SOAD, stress test) | 2700 | 102.1s | **1** | 59.86 | 0.850 | 0.598 | 0.621 | 0.133 |

\* Ver §4 — no es ametrallamiento, son dos clímax reales separados por 133s.

### Tensión Superficial `T(t)`

En **todos** los 10 archivos, `T(t)` alcanza el techo `T_max=0.85` — con `T_base=0.80` y `alpha_rise` bajo, la superficie se endurece casi permanentemente durante cualquier tramo de energía sostenida. El `T_min` observado varía según la "profundidad de los valles":
- **Prydz (0.475)** tiene los valles más profundos — track largo (260s) con caídas de energía reales entre dos drops.
- **Bad Bunny buildup (0.691)** tiene el `T_min` más alto — la presencia vocal sostenida mantiene el impacto elevado casi todo el clip, sin valles profundos donde la tensión pueda evaporarse.

### Presión de Vapor `V(t)`

`V_max` correlaciona con la **duración de la sequía antes del primer disparo real**: Prydz (0.948) y Brejcha (0.916) acumulan vapor extremo durante buildups largos previos al drop; los tracks vocales (Bad Bunny 0.465-0.564) disparan más pronto en relación a su duración total, acumulando menos vapor.

### Viscosidad `μ(t)` (grabada, no calibrada en este lote)

Consistente con la intuición del diseño original: **contenido melódico/armónico sube la viscosidad** (`Badbunny_denbow_buildup` 0.169, `adagioforstrings` 0.160, `remixcumbia_intro` 0.157 — todos con líneas melódicas/vocales sostenidas), mientras que **techno percusivo la baja** (`Brejcha` 0.025, `Prydz` 0.037, `Rüfüs Du Sol` 0.035 pese a ser "orgánico", predominan synths percusivos).

### Confianza `C(t)` — voz (Bad Bunny) vs. instrumental (Tiësto)

**Hallazgo corregido tras verificación empírica** (la hipótesis inicial de "colapso por voz" no se sostuvo): se midió `avg(s_V)` y `avg(C)` con los pesos ganadores sobre los 5 archivos más contrastantes:

| Archivo | avg `s_V` (anti-voz) | avg `C(t)` (pesos ganadores) | avg `μ` |
|---|---|---|---|
| `Badbunny_denbow_buildup` | 0.975 | 0.567 | 0.169 |
| `nuevayol_badbunny_denbow` | 0.910 | 0.554 | 0.118 |
| `adagioforstrings_djTiesto` | 0.819 | 0.548 | 0.160 |
| `076_djtiesto_buildup` | 0.926 | 0.539 | 0.082 |
| `toxicity_systemdown` (rock) | 0.953 | 0.547 | 0.133 |

`avg(s_V)` es **similar o incluso más alto** en Bad Bunny que en Tiësto — el filtro anti-voz (`s_V = 1 − κ_vmax·vocalDominance·(1−CF̂)`) se ve atenuado por el factor de cresta: en dembow/reggaetón el contenido es muy percusivo (crest factor alto), lo que reduce `vocalDominance` pese a la voz sostenida. Por eso `w4` (peso de `s_V`) **casi no cambió** en la calibración (0.15 → 0.1515) — no es el lever relevante.

La confianza promedio se mantiene **muy similar** (0.54-0.57) en los 5 archivos comparados. La supresión de ametrallamiento en tracks vocales **no viene de suprimir la señal de confianza**, sino de la combinación `Q_base` alto (0.70) + `T_base/kappa_sigma` altos (squelch elevado casi todo el tiempo) + descarga de vapor tras cada ignición — el mismo mecanismo que en electrónica pura.

---

## 4. Desviaciones y hallazgos para futuros "Moods"

### 4.1 — Prydz: doble clímax, no jitter

`Opus_Prydtz_buildup.jsonl` (260.5s, el track más largo del corpus) disparó **2 veces** con gap de **133.42s** — muy por encima del umbral de jitter (3s). Verificación directa del `impact` crudo confirma **dos picos reales**: `0.999` @ 31.68s y `0.772` @ 165.08s (media de ventana ±3s: 0.331 y 0.195 respectivamente). **Esto es comportamiento correcto**, no un fallo de calibración — un track de 4+ minutos con dos drops separados *debería* generar dos catarsis. La función de coste usada penaliza (+300) cualquier disparo extra sin importar la separación temporal; para el próximo lote se recomienda ajustar el coste para que **solo** penalice gaps < 3s, no el conteo absoluto de disparos — el coste real de este archivo debería ser `0`, no `300`.

### 4.2 — Fusión de sensores: reestructuración drástica de pesos

El hallazgo más importante del batch es la redistribución de `w1..w7`:
- **`s_E` (energía líquida, w3) y `s_P` (prior de Cassandra, w6) se vuelven dominantes** (0.325 y 0.277 respectivamente, sumando >60% del peso total) — señales robustas y genéricas across géneros.
- **`s_Z` (anomalía Z-score, w2), `s_X` (excitabilidad, w5) y `s_B` (belleza/consonancia, w7) colapsan a casi-irrelevantes** (0.02-0.03 cada uno) — son señales más ruidosas o específicas de género que no generalizan bien en un perfil único.

Esto sugiere que **un solo perfil global sacrifica especificidad de género**: `s_Z` podría ser muy informativo específicamente en techno (anomalía de energía bien definida en un género con dinámica de rango amplio) pero ruidoso en rock/vocal donde el rango dinámico es más comprimido. **Recomendación:** considerar un "Mood" o perfil condicional por macro-género donde `w2` se reactive para texturas electrónicas puras (Techno/EDM) y se mantenga suprimido para vocal/rock.

### 4.3 — Rock/Nu-Metal (SOAD): no colapsó, pero sin ajuste fino

`toxicity_systemdown_intro_verse.jsonl` logró **coste 0** (1 disparo limpio @ 59.86s) pese a peso 0.3 en la función de coste — el motor **no colapsó** sin DSP dedicado, validando la robustez base del pipeline. Sin embargo, al no haberse priorizado en el ajuste, no hay garantía de que capture bien los "drops" característicos del género (breakdowns, cambios de riff) — solo se confirma que no genera falsos positivos masivos. **Recomendación:** un futuro Mood "PUNK"/"METAL" dedicado si se busca esa textura específicamente, con telemetría adicional de tracks de ese género con pesos de ajuste fino ≥1.0.

### 4.4 — Bordes de búsqueda alcanzados

`T_base` (0.80, techo del rango buscado) y `kappa_sigma` (0.80, techo) sugieren que el sistema "quiere" una superficie aún más dura/reactiva a la temperatura de lo que el Lote 1 permitió explorar. `alpha_rise` (0.01, piso) y `tau_sat` (1.0, piso) sugieren que el endurecimiento por saturación casi no aporta cuando `T_base` ya está muy alto — son coeficientes parcialmente redundantes entre sí en este régimen. Ver §2 para la recomendación de Lote 2 con bounds ampliados.

---

## 5. Limitaciones y próximos pasos

1. **27 de 39 coeficientes no fueron calibrados** en este lote (requieren inputs crudos pre-fusión no capturados en la telemetría grabada: `w_z/w_cf/w_e`, `w_m/w_f/w_h/w_p`, `sigma_g/kappa_z/b_z`, `kappa_v/rho_v/kappa_vmax`, coeficientes de `I(t)`/intensidad, arsenal/novedad). Para calibrarlos se necesitaría instrumentar el `LiquidTelemetryRecorder` para grabar también los inputs crudos (`zScore`, `rawEnergy`, descriptores ΠMΔG, genoma del efecto).
2. **Función de coste a refinar** — no penalizar disparos extra bien separados (>3s), solo jitter real (ver §4.1).
3. **Lote 2 sugerido:** ampliar bounds de `T_base`/`kappa_sigma`, explorar coeficientes de vapor (`beta_v`, `kappa_vreset`) y de intensidad materializada (`kappa_i`, `I_min`), y considerar Moods por macro-género dado el hallazgo de §4.2.
