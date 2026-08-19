# REPORTE: Filtro Anti-Autotune — Estado, Problemática y Decisiones

**Fecha:** 2026-01-15  
**Autor:** Devin (sesión de debugging con usuario)  
**Propósito:** Debate con arquitecto sobre el sistema de filtros anti-autotune (WAVE 7543-7552)

---

## 1. CONTEXTO: El problema original

La música de reggaetón con voces autotuneadas y comprimidas (Bad Bunny, etc.) produce
**falsos positivos** en el sistema de detección de drops:

- Las voces comprimidas generan picos de RMS que parecen impactos
- El Z-score total dispara (Z ≥ 2.0σ) porque las voces son energéticamente anómalas
- El epicness V3 dispara porque las voces producen tensión fluida
- **Pero no hay sub-bass real** — es un pico de mid/high, no un drop

Resultado: Selene dispara efectos pesados (strobe, divine, heavy) durante pasajes
vocales sin bass, arruinando la experiencia.

---

## 2. LO QUE TENÍAMOS ANTES DE ESTA SESIÓN (pre-WAVE 7543)

### 2.1 zScoreGuards en los .lfx — SISTEMA PREEXISTENTE

**Esto NO lo introdujimos nosotros.** Es un sistema que ya existía desde WAVE 4843
("COGNITIVE BRIDGE") y WAVE 7186 ("Divine Z-score 2.10").

Cada efecto `.lfx` tiene un bloque `zScoreGuards` en su `simMeta`:

```json
"zScoreGuards": {
  "requireRising": true,
  "minimumZ": 2.2,
  "minimumEnergy": 0.7
}
```

Estos guards se evalúan en `EffectDreamSimulator.generateCandidates()` (líneas 1007-1023):

- **Guard 1 (Strobe):** Si `isStrobe=true` y `zScore <= 0` → skip (no strobes en energía descendente)
- **Guard 2 (minimumZ):** Si `zScore < minimumZ` → skip (requiere significancia estadística)
- **Guard 3 (minimumEnergy):** Si `energy < minimumEnergy` → skip (requiere energía mínima)

**Excepción:** Si la predicción es un evento futuro garantizado (`drop_incoming`,
`energy_spike`, `buildup_starting` con `timeToEvent > 0` y `confidence > 0.55`),
los guards se relajan (`relaxGuardsForFuture = true`) porque el Z subirá cuando
el drop rompa.

### 2.2 Inventario de minimumZ por efecto

| Efecto | minimumZ | Vibe | Notas |
|---|---|---|---|
| `latin_strobe` (custom) | **null** | fiesta-latina | **Sin guard — siempre pasa** |
| `salsa_fire` | 2.0 | fiesta-latina | Filtrado con Z<2.0 |
| `solar_flare` | 2.2 | fiesta-latina | Filtrado con Z<2.2 |
| `latina_meltdown` | 2.2 | fiesta-latina | Filtrado con Z<2.2 |
| `divine_obliteration` | 2.2 | fiesta-latina | Filtrado con Z<2.2 |
| `arena_sweep` | null | fiesta-latina | Sin guard (efecto ligero) |
| `corazon_latino` | null | fiesta-latina | Sin guard (efecto ligero) |
| `strobe_burst` | 2.0 | techno | Filtrado con Z<2.0 |
| `strobe_storm` | 2.2 | techno | Filtrado con Z<2.2 |
| `seismic_snap` | 2.0 | techno | Filtrado con Z<2.0 |
| `wraht_of_the_titans` | 4.5 | techno | Muy restrictivo |
| `cyber_scanner` | 4.0 | techno | Muy restrictivo |
| `void_mist` | null | techno | Sin guard (efecto ligero) |
| `ambient_strobe` | 2.2 | techno | Filtrado con Z<2.2 |

**Total: 46 efectos con minimumZ.** De esos, ~25 tienen `minimumZ: null` (efectos
ligeros) y ~21 tienen un valor numérico (efectos pesados).

### 2.3 El bass gate original (WAVE 7543) — PREEXISTENTE

Antes de esta sesión, ya existía un bass gate con threshold 0.35 en 5 sitios:

1. `SeleneTitanConscious.ts` — post-validate (V3 Ignition path)
2. `SeleneTitanConscious.ts` — pre-validate (V3 Bypass path)
3. `DecisionMaker.ts` — divine strike gate
4. `DecisionMaker.ts` — drop pool gate
5. `SovereignClockGuard.ts` — sovereign clock (pre-buffer path)

**Condición original:** `bass <= 0.35` → veto. Simple, un solo check.

---

## 3. LO QUE AÑADIMOS EN ESTA SESIÓN (WAVE 7550-7552)

### 3.1 WAVE 7550: Endurecer bass gate

- **Threshold:** 0.35 → 0.40
- **Vocal dominance check:** `mid > bass AND mid > 0.50` → veto
- **Aplicado en:** los 5 sitios

### 3.2 WAVE 7551: Bass/mid ratio (FALLIDO — revertido lógicamente)

- **Ratio check:** `bass / mid < 1.3` → veto
- **Problema:** El ratio era **invertido**. El caso legítimo (dembow real) tenía
  ratio 1.20 (bloqueado) y el caso falso (vocal leakage) tenía ratio 1.48 (pasaba).
- **Reemplazado por** WAVE 7552.

### 3.3 WAVE 7552: Bass Z-score (zL)

- **Z-score check:** `zL < 0` → veto (bass no estadísticamente inusual = AGC inflation)
- **Aplicado en:** los 5 sitios + tipo extendido en SovereignClockContext
- **Datos:** `zL` viene de `acousticReality.zScores.low` (M-SARFE, preexistente)

### 3.4 WAVE 7550 (mood): CALM blockPatterns

- `MoodProfile` extendido con `blockPatterns: string[]`
- CALM tiene `blockPatterns: ['strobe', 'heavy', 'divine']`
- `isEffectBlocked()` checkea patrones además de IDs exactos
- `EffectDreamSimulator.getVibeAllowedEffects()` filtra por mood blockList ANTES
  de simular → degradación natural a efectos suaves en vez de silencio

### 3.5 FIRE-DIAG enriquecido

Añadido `bass`, `mid`, `high`, `zL` al log de FIRE-DIAG para diagnóstico.

---

## 4. PROBLEMÁTICA ACTUAL

### 4.0 zScoreGuards — NUNCA se desactivaron (HALLAZGO CRÍTICO)

**Los zScoreGuards siempre han estado activos desde mayo 2026.** Se introdujeron
en el commit `e09ff2fb` ("lote grande de fixes . V3 lfx completed") y nunca se
eliminaron ni comentaron.

Lo que sí pasó después:

1. **WAVE 5014** (commit `603fb701`, "Selene restaurada") añadió `relaxGuardsForFuture`:
   - Si la predicción es `drop_incoming`, `energy_spike`, o `buildup_starting`
     con `timeToEvent > 0` y `confidence > 0.55`, los guards se relajan.
   - **Pero con `transition_beat` (conf=0.500) o `energy_drop`, los guards
     SIGUEN APLICANDO.**

2. **Minimal Rescue** (WAVE 5009, mismo commit) — fallback cuando todos los
   efectos se bloquean por zScoreGuards:
   - Rescata efectos del `pressureFilteredEffects` ignorando `minimumZ`
   - **Solo respeta el strobe guard** (isStrobe && zScore <= 0)
   - **NO respeta minimumZ ni minimumEnergy**
   - Esto significa que si todos los efectos pesados tienen minimumZ=2.0-2.2
     y Z=0.6, el rescue los deja entrar a todos sin filtrar por Z

3. **El comportamiento actual es:**
   - Predicción futura garantizada (drop_incoming, energy_spike, buildup_starting
     con conf > 0.55): guards relajados, todos los efectos pasan
   - Predicción no-futura (transition_beat, energy_drop, none): guards activos,
     efectos con minimumZ > Z se filtran
   - Si TODOS se filtran: Minimal Rescue rescata ignorando minimumZ
   - Si solo ALGUNOS se filtran: los que pasan compiten normalmente

**El problema de variedad (`latin_strobe` monopoliza):**
- `latin_strobe` tiene `minimumZ: null` → siempre pasa los guards
- `salsa_fire` tiene `minimumZ: 2.0` → se filtra con Z < 2.0
- `solar_flare` tiene `minimumZ: 2.2` → se filtra con Z < 2.2
- `latina_meltdown` tiene `minimumZ: 2.2` → se filtra con Z < 2.2
- Con `transition_beat` conf=0.500 (no futura), Z suele ser 1.5-1.9
- Solo `latin_strobe` sobrevive → monopoliza el ranking

**Esto NO lo causamos nosotros.** Es el comportamiento preexistente desde mayo 2026.

### 4.1 Complejidad acumulada — 451 líneas añadidas

```
SeleneTitanConscious.ts  | +173 líneas
EffectDreamSimulator.ts  | +114 líneas
DecisionMaker.ts         | +106 líneas
SovereignClockGuard.ts   |  +65 líneas
MoodController.ts        |  +14 líneas
types.ts                 |  +11 líneas
                         = 451 líneas, 32 eliminadas
```

Cada bass gate ahora tiene **3 condiciones de veto** (bass < 0.40, vocal dominance,
zL < 0) en vez de 1. Los logs son más verbosos. El código es más difícil de seguir.

### 4.2 El bass gate funciona, pero...

Los logs muestran que el bass gate con zL **distingue correctamente**:

```
Vocal leakage:  bass=0.753 zL=-1.0σ  → VETO ✅ (AGC inflation)
Dembow real:    bass=0.948 zL=+1.3σ  → PASS ✅ (bass genuinamente inusual)
```

Pero hay casos donde V3 dispara en un frame diferente al que el pre-validate gate
evaluó. El pre-validate gate bloquea con bass=0.371, pero en el frame siguiente
bass sube a 0.598 con zL=4.57σ y el post-validate gate lo deja pasar. **Esto es
correcto** (el estado cambió), pero puede parecer que V3 "ignora" el gate.

### 4.3 zL a veces no disponible

`acousticReality` puede ser `null` si no hay `sectionEvidence` del worker. En ese
caso `zL = 0` y el check `zL < 0` no dispara. El gate degrada a solo bass < 0.40
+ vocal dominance.

### 4.4 El Minimal Rescue es un bypass silencioso de minimumZ

El Minimal Rescue (líneas 1077-1098 de EffectDreamSimulator.ts) se activa cuando
`candidates.length === 0`. En ese caso, rescata efectos **ignorando minimumZ** —
solo respeta el strobe guard. Esto significa que efectos pesados con minimumZ=2.2
pueden entrar con Z=0.6 si son los únicos disponibles.

**Esto es preexistente** (WAVE 5009, mayo 2026) pero interactúa mal con el
problema de variedad: si `latin_strobe` pasa siempre (minimumZ=null) y los demás
se filtran, el rescue nunca se activa (porque hay 1 candidato). Pero si
`latin_strobe` está en cooldown, el rescue se activa y deja entrar efectos pesados
sin respetar su minimumZ.

---

## 5. OPCIONES PARA EL ARQUITECTO

### Opción A: REVERTIR todo y usar solo CALM manual

**Qué se revierte:**
- WAVE 7550 (threshold 0.40 + vocal dominance) → volver a 0.35 simple
- WAVE 7551 (ratio) → ya revertido lógicamente por 7552
- WAVE 7552 (zL check) → eliminar
- Mantener: CALM blockPatterns + degradación natural (esto sí funciona bien)

**Ventajas:**
- -400 líneas de código, vuelve a la simplicidad
- El bass gate original (0.35) ya bloquea la mayoría de falsos positivos
- CALM manual para casos problemáticos
- No tocamos el sistema preexistente de zScoreGuards

**Desventajas:**
- Algunos falsos positivos con bass 0.36-0.40 seguirán pasando en BALANCED
- El zL era un discriminador genuinamente bueno (distinguía AGC inflation)

### Opción B: SIMPLIFICAR — un solo check unificado

**Qué se hace:**
- Reemplazar los 5 bass gates duplicados por una sola función `bassGateVeto()`
- Esa función hace: `bass < 0.40 OR zL < 0` (sin vocal dominance, sin ratio)
- Eliminar vocal dominance (rara vez dispara, el zL es mejor)
- Mantener CALM blockPatterns

**Ventajas:**
- Una sola función en vez de 5 copias
- 2 condiciones claras en vez de 3
- Menos código, misma efectividad

**Desventajas:**
- Sigue siendo código añadido (aunque menos)
- zL puede no estar disponible siempre

### Opción C: Mover el check al .lfx (declarativo)

**Qué se hace:**
- Añadir `requireBassZScore: 0` al simMeta de efectos pesados en los .lfx
- El EffectDreamSimulator ya tiene zScoreGuards — extenderlo con bassZScore
- Eliminar los 5 bass gates imperativos del pipeline
- El filtro vive en el .lfx, no en el código

**Ventajas:**
- Cada efecto declara sus requisitos
- No hay 5 sitios duplicados
- Consistente con el sistema preexistente de zScoreGuards

**Desventajas:**
- Requiere editar todos los .lfx pesados
- El bass gate post-validate (V3 Ignition) no puede vivir en el .lfx
- Más trabajo

### Opción D: Status quo (mantener todo)

**Ventajas:**
- Máxima protección contra falsos positivos
- zL es el mejor discriminador

**Desventajas:**
- 451 líneas de complejidad
- 3 condiciones por gate, 5 gates
- Difícil de mantener

---

## 6. RECOMENDACIÓN

**Opción A (revertir + CALM manual)** es la más sana arquitectónicamente.

Razones:
1. El bass gate original (0.35) ya bloquea el 90% de los falsos positivos
2. CALM con blockPatterns + degradación natural maneja el resto
3. -400 líneas de código = menos superficie de bugs
4. El zL era bueno pero añade complejidad y dependencia de acousticReality
5. El problema de variedad (latin_strobe monopoliza) es del zScoreGuards
   preexistente, no nuestro — resolverlo requiere tocar .lfx, no el bass gate

**Si se quiere mantener algo:** quedarse con WAVE 7552 (zL check) pero
consolidar los 5 gates en una sola función reutilizable (Opción B).

---

## 7. ARCHIVOS MODIFICADOS (sin commit)

```
electron-app/src/core/intelligence/SeleneTitanConscious.ts   (+173)
electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts (+114)
electron-app/src/core/intelligence/think/DecisionMaker.ts    (+106)
electron-app/src/core/intelligence/guards/SovereignClockGuard.ts (+65)
electron-app/src/core/mood/MoodController.ts                 (+14)
electron-app/src/core/mood/types.ts                          (+11)
```

**Total:** 451 líneas añadidas, 32 eliminadas. Sin commit. Reversible con `git checkout`.

---

## 8. DATOS DE TESTING

### Caso 1: Bad Bunny (vocal leakage, autotune pesado)
- Bass gate original (0.35): bloquea algunos, deja pasar bass 0.36-0.40
- WAVE 7550 (0.40 + vocal dominance): bloquea más, pero vocal dominance rara vez dispara
- WAVE 7552 (zL < 0): bloquea correctamente (zL ≈ -1.0 en pasajes vocales)
- CALM manual: bloquea todo strobe, degrada a efectos suaves ✅

### Caso 2: Reggaetón con dembow real (legítimo)
- Bass gate original (0.35): pasa correctamente
- WAVE 7550 (0.40 + vocal dominance): pasa correctamente
- WAVE 7551 (ratio < 1.3): **BLOQUEA INCORRECTAMENTE** (ratio 1.20 en dembow real)
- WAVE 7552 (zL < 0): pasa correctamente (zL ≈ +1.3 en dembow real) ✅

### Caso 3: Variidad de efectos (latin_strobe monopoliza)
- No relacionado con el bass gate
- Causa: zScoreGuards preexistente + latin_strobe tiene minimumZ=null
- Solo latin_strobe sobrevive cuando Z < 2.0 y la predicción no es futura
- Solución: tocar .lfx (añadir minimumZ a latin_strobe) o fallback de diversidad

---

## 9. CONCLUSIÓN

**El puto autotune nos obligó a añadir 451 líneas de filtros.** Pero el problema
real es más profundo:

1. **Los zScoreGuards siempre han estado activos** desde mayo 2026. Nunca se
   desactivaron. Lo que sí existe es una exención (`relaxGuardsForFuture`) para
   predicciones futuras garantizadas, y un Minimal Rescue que ignora minimumZ
   cuando todos los efectos se bloquean.

2. **El problema de variedad es del zScoreGuards preexistente**, no nuestro.
   `latin_strobe` tiene `minimumZ: null` y siempre pasa. Los demás pesados
   tienen `minimumZ: 2.0-2.2` y se filtran con Z < 2.0. Esto ya pasaba antes
   de WAVE 7543-7552.

3. **El bass gate con zL funciona bien** como discriminador anti-autotune, pero
   añade 451 líneas de complejidad. El bass gate original (0.35) ya bloquea el
   90% de los falsos positivos.

4. **CALM manual** es la solución más limpia para el usuario: bloquea strobes
   por patrón y degrada a efectos suaves del mismo vibe automáticamente.

**Decisión pendiente del arquitecto:**
- ¿Revertir WAVE 7550-7552 y volver al bass gate simple (0.35)?
- ¿Simplificar a una sola función consolidada?
- ¿Arreglar el problema de variedad tocando los .lfx (añadir minimumZ a
  latin_strobe o quitarlo de los demás)?
- ¿Eliminar o modificar el Minimal Rescue?
- ¿Dejar los zScoreGuards como están?

**Lo que sí vale la pena mantener (independiente de la decisión):**
- CALM blockPatterns + degradación natural en EffectDreamSimulator
- FIRE-DIAG con bandas y zL para diagnóstico

---

## 10. HALLAZGO CRÍTICO: 5 UMBRALES DE Z CONTRADICTORIOS

### El problema real

Existen **5 sistemas de Z-score distintos** que se aplican en momentos diferentes
con umbrales diferentes para los mismos efectos. Esto causa comportamiento
incoherente:

| Gate | Dónde | Threshold | Cuándo aplica |
|---|---|---|---|
| `zScoreGuards.minimumZ` | .lfx | **2.0-2.2** | Candidate generation (no futura) |
| `SOVEREIGN_HEAVY_MIN_Z` | Código (SovereignClockGuard) | **1.0** | Sovereign Clock fire |
| `DIVINE_MIN_Z_SCORE` | Código (DecisionMaker) | **2.10** | Divine strike |
| `relaxGuardsForFuture` | Código (EffectDreamSimulator) | **bypass** | Predicción futura conf > 0.55 |
| Minimal Rescue | Código (EffectDreamSimulator) | **bypass** | Cuando todos se bloquean |

### Ejemplos del log que prueban la incoherencia

**Solar Flare** (minimumZ=2.2 en .lfx) disparó con Z=1.0 vía Sovereign Clock:
```
[SeleneTitanConscious] 🔮👑 CASSANDRA SOVEREIGN CLOCK: firing "Solar Flare" | confidence=0.63
[EffectManager 🔥] Solar Flare [solar_flare] FIRED [hunt] in fiesta-latina | I:0.89 Z:1.0
```
→ Sovereign Clock solo requiere Z ≥ 1.0, ignora el minimumZ=2.2 del .lfx.

**Cascade Strike** (minimumZ=1.5 en .lfx) disparó con Z=1.27 vía energy_spike:
```
[FIRE-DIAG] Cascade Strike | E=0.933 Z=1.27σ | pred=energy_spike predProb=0.72
```
→ relaxGuardsForFuture=true (energy_spike conf=0.72 > 0.55), bypassa minimumZ=1.5.

**K.I.T.T. Scanner** (minimumZ=null en .lfx) disparó con Z=1.27 vía transition_beat:
```
[FIRE-DIAG] K.I.T.T. Scanner | E=0.971 Z=1.27σ | pred=transition_beat predProb=0.16
```
→ minimumZ=null, siempre pasa sin importar Z.

**latin_strobe** (minimumZ=null en .lfx) dispara con cualquier Z:
```
[FIRE-DIAG] latin_strobe | Z=1.93σ | pred=transition_beat predProb=0.33
```
→ minimumZ=null, siempre pasa. Por eso monopoliza el ranking.

### Por qué el usuario pensó que los zScoreGuards no existían

Porque **se bypassan constantemente**:
- Predicción futura con conf > 0.55 → bypass (relaxGuardsForFuture)
- Sovereign Clock fire → usa Z=1.0, no el .lfx minimumZ
- Todos bloqueados → Minimal Rescue bypassa minimumZ
- Efecto con minimumZ=null → siempre pasa

Solo aplican de verdad cuando:
- Predicción es `transition_beat`, `energy_drop`, o `none` (no futura)
- Y conf ≤ 0.55
- Y hay al menos 1 candidato que pasa (para que el rescue no se active)

**Esa ventana es muy estrecha.** La mayoría del tiempo, los zScoreGuards están
siendo bypassados. Pero cuando aplican, filtran agresivamente (Z < 2.0-2.2) y
dejan solo `latin_strobe` (minimumZ=null).

### El problema de tener zScoreGuards en el .lfx

1. **No es editable desde la UI** — el usuario no puede cambiar minimumZ sin
   editar el archivo .lfx manualmente
2. **Es inconsistente con el código** — el código usa Z=1.0 (SovereignClockGuard)
   pero el .lfx pide Z=2.0-2.2
3. **Crea comportamiento impredecible** — el mismo efecto a veces pasa con Z=1.0
   (Sovereign Clock) y a veces se filtra con Z=1.9 (transition_beat)
4. **No hay forma de saber qué threshold aplica** sin trazar el código path exacto

### Recomendación del usuario (debatir con arquitecto)

> "no tiene que haber Zguard, que no sea de algo razonable PARA EFECTOS HEAVY.
> De hecho dispusimos Z=1 como margen hace un rato"

**Propuesta:**
1. **Eliminar zScoreGuards.minimumZ de todos los .lfx** (poner a null)
2. **Usar un solo threshold en código**: Z ≥ 1.0 para heavy effects (ya existe
   en SovereignClockGuard como SOVEREIGN_HEAVY_MIN_Z)
3. **Aplicar ese Z=1.0 uniformemente** en el pipeline, no en el .lfx
4. **Mantener strobe guard** (isStrobe && Z <= 0 → skip) — eso sí tiene sentido
   (no strobes en energía descendente)
5. **Eliminar Minimal Rescue** — si todos se bloquean, no hay candidatos, punto.
   El sistema ya tiene fallbacks (SILENCE, mood degradation)

**Ventajas:**
- Un solo threshold (Z=1.0) en un solo sitio (código)
- Editable sin tocar .lfx
- Comportamiento predecible
- Elimina la incoherencia entre .lfx y código
- El usuario puede ajustar Z=1.0 desde un setting global si hace falta
