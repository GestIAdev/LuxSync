# AUDITORÍA TÉCNICA DE ADQUISICIÓN — ÁREA 4

## Selene IA V3 «Iliquidcore» + Motor Predictivo Cassandra

**Documento:** Whitepaper arquitectónico de Due Diligence
**Alcance:** `electron-app/src/core/intelligence/` — núcleo cognitivo únicamente
**Auditor:** Chief Acquisition Auditor & Principal AI/DSP Architect
**Fecha:** 2026-08-10
**Revisión 2:** 2026-08-17 — post-intervención Cassandra 2.0 + True Crest Detector
**Mercados objetivo de evaluación:** Norteamérica (US/CA) y España
**Clasificación:** Confidencial — Proceso de adquisición de IP LuxSync

> **NOTA DE REVISIÓN 2 (2026-08-17).** Se han ejecutado §5.5 (Cassandra 2.0) y §5.6 (detector
> de crestas real), y se ha corregido un defecto material **no detectado en la revisión 1**:
> 4 de los 8 patrones de progresión —incluido el de mayor confianza del sistema— eran
> inalcanzables por construcción (§2.8). La puntuación pasa de **87** a **88.9/100**. El
> ajuste es modesto de forma deliberada: la subida por §5.5/§5.6 se compensa parcialmente con
> la corrección a la baja de la nota de *Arquitectura predictiva* de la revisión 1, que estaba
> inflada al puntuar una capacidad que nunca se ejecutó. Detalle en §4.1 y §4.4.

---

## RESUMEN EJECUTIVO

Selene V3 no es una iteración incremental sobre un motor audio-reactivo. Es un cambio de
paradigma computacional: la sustitución de un árbol de decisión booleano por un **sistema
dinámico continuo de una sola ecuación**.

El predicado completo de decisión del sistema es:

```
ignite ⟺ C(t) ≥ Q(t)
```

Donde `C(t)` es la confianza instantánea (media geométrica ponderada de 7 sensores acústicos
en dominio logarítmico) y `Q(t)` es un umbral adaptativo —«squelch»— que respira en función
de la tensión superficial cognitiva, la presión de vapor acumulada y la épica del momento.

Esta reducción elimina **~6.000 líneas** de lógica legacy (20+ vetos booleanos, jerarquía de
13 pasos, ramas por género musical) y las reemplaza por **1.771 líneas** de matemática fluida
determinista y zero-alloc.

**Veredicto preliminar:** Activo de IP de alto valor con deuda arquitectónica transicional
identificada y acotada. **Puntuación: 88.9/100** (revisión 1: 87.0).

**Adición de la revisión 2.** El motor predictivo ha dejado de ser estático. Cassandra 2.0
sustituye la última tabla de constantes del sistema por un posterior bayesiano jerárquico de 2º
orden que aprende online la gramática musical del repertorio real del operador, con los patrones
heredados degradados a prior —arranque en frío sin regresión— y olvido acotado para seguir un
estilo cambiante. En paralelo, el descriptor Π ha pasado de proxy a medida: un proceso de conteo
de crestas con estimador de tasa de Poisson cuya constante de normalización se deriva de la
teoría en lugar de calibrarse. Y en el camino se corrigió un defecto material que la revisión 1
no detectó: la mitad de los patrones de progresión, incluido el de mayor confianza, eran
inalcanzables por construcción.

---

## 1. EL PREDICADO ILIQUIDCORE — EVALUACIÓN MATEMÁTICA Y ARQUITECTÓNICA

### 1.1 El problema estructural de la compuerta booleana

La arquitectura V2 (el «Tribunal») operaba con una topología de decisión que, en términos de
teoría de control, es un **sistema discreto no diferenciable**:

```
fire = gate₁ ∧ gate₂ ∧ ... ∧ gate₂₀
```

Esta topología tiene tres patologías inherentes documentadas en el código legacy:

**(a) Discontinuidad de primera clase.** Cada compuerta es una función escalón. Un input que
se mueve de 0.6999 a 0.7001 en un umbral produce una discontinuidad total del output. En un
sistema que evalúa a 44 Hz, esto genera **chattering**: oscilación de alta frecuencia entre
estados fire/silence en la frontera del umbral. La solución clásica —añadir histéresis— fue
implementada en V2 mediante la proliferación de temporizadores de cooldown (el código aún
conserva 8+ timers independientes), lo que convirtió el sistema en una máquina de estados con
espacio de estados combinatorio intratable.

**(b) Colapso de información.** Una conjunción booleana destruye la magnitud. Si `gate₃` falla
por un margen de 0.001 y `gate₇` falla por 0.8, el sistema no puede distinguir «casi disparó»
de «ni de lejos». Esta información es precisamente la que un operador humano usa para modular
la intensidad. V2 la descartaba en cada frame.

**(c) Explosión combinatoria de calibración.** Con 20 umbrales independientes, el espacio de
parámetros es ℝ²⁰ con fronteras acopladas de forma no lineal. La calibración empírica es
computacionalmente inviable; de ahí las ramas por género (`if (vibe === 'techno')`) como
parche pragmático: no eran diseño, eran deuda de calibración cristalizada.

### 1.2 La solución: media geométrica en dominio logarítmico

`SensorFusionChamber` (`liquid/SensorFusionChamber.ts`, 212 líneas) computa:

```
ln C(t) = Σᵢ wᵢ · ln sᵢ(t)      →      C(t) = exp( Σᵢ wᵢ · ln sᵢ(t) )
```

Con Σwᵢ ≈ 1.0 y sᵢ ∈ [ε, 1], ε = 0.01.

Esta formulación no es una elección estética. Tiene tres propiedades matemáticas que resuelven
exactamente las tres patologías anteriores:

**Propiedad 1 — Veto suave (soft-AND).** La media geométrica es una **t-norma diferenciable**.
Preserva la semántica conjuntiva del AND booleano (si cualquier sensor → 0, entonces C → 0)
pero de forma continua y con gradiente definido en todo el dominio. Es el operador correcto
para «todos los sensores deben estar razonablemente de acuerdo», sin la fragilidad del escalón.

**Propiedad 2 — Aditividad en dominio log.** El cómputo se reduce a 7 multiplicaciones y 7
sumas sobre `Math.log`. No hay ramas condicionales por sensor. En términos de arquitectura de
CPU, esto significa **cero fallos de predicción de salto** en el hot path — crítico a 44 Hz
donde el presupuesto por frame es de 22,7 ms compartido con DSP, render 3D y salida DMX.

**Propiedad 3 — Calibración convexa.** El espacio de pesos `w₁..w₇` con Σwᵢ = 1 es un simplex
de dimensión 6, no un hipercubo de dimensión 20 con fronteras acopladas. El código documenta
calibración real por **Simulated Annealing multi-start sobre 10 tracks** (`ILiquidCognitionProfile.ts`,
WAVE 7004.4), con los pesos resultantes anotados inline junto a su valor previo. Esto es
ingeniería de calibración reproducible, no tuning por intuición.

### 1.3 Los 7 sensores — análisis individual

| Sensor | Formulación | Peso (MC) | Función DSP |
|--------|-------------|-----------|-------------|
| `s_DNA` | `exp(−‖g_fx − g_ctx‖² / 2σ_g²)` | 0.1699 | Kernel gaussiano en espacio ACO. Mide afinidad genómica entre el genoma del efecto candidato y el contexto acústico proyectado `g_ctx = ⟨Ê·CF̂, Δ, 1−Π⟩` |
| `s_Z` | `σ(κ_z·(I/T − 1) + b_z)` | 0.0291 | Anomalía **normalizada por tensión**. No mide Z-score absoluto sino el ratio impacto/barrera — un Z de 2.0 significa cosas distintas en un valle que en un clímax |
| `s_E` | `Ê^γ_e`, γ_e = 0.7 | 0.4518 | Energía con compresión de ley de potencias. γ<1 expande la resolución en la región baja (comportamiento perceptual, análogo a la ley de Stevens) |
| `s_V` | `1 − κ_vmax · σ(κ_v·(mid/bass − ρ_v))·(1−CF̂)` | 0.1515 | **Filtro anti-voz.** Detecta dominancia vocal por ratio mid/bass acoplado a factor de cresta bajo. Impide que una línea vocal sostenida sea interpretada como evento estructural |
| `s_X` | passthrough de `X(t)` | 0.0273 | Excitabilidad — recuperación post-ignición. Refractariedad biológica |
| `s_P` | `0.5 + 0.5·(P_prob · P_align)` | 0.1500 | **Prior de Cassandra.** Suelo en 0.5: una predicción ausente nunca penaliza, solo la presencia de predicción alineada bonifica |
| `s_B` | `0.6 + 0.4·(0.6·beauty + 0.4·consonance)` | 0.0204 | Estética: proporción áurea + consonancia cromática. Suelo en 0.6 (modulador, no compuerta) |

**Observación de auditoría de alto valor:** el diseño de `s_P` y `s_B` con **suelo positivo**
(0.5 y 0.6 respectivamente) es una decisión arquitectónica sofisticada. En una media geométrica,
un sensor que puede llegar a 0 tiene poder de veto absoluto. Al fijar suelos, los diseñadores
declararon explícitamente qué sensores son *vetadores* (`s_E`, `s_V`, `s_DNA`) y cuáles son
*moduladores* (`s_P`, `s_B`). Esta jerarquía de autoridad está codificada en la propia
estructura matemática, no en comentarios ni en ramas condicionales. Es autodocumentada y no
puede desincronizarse de la intención.

### 1.4 El squelch adaptativo Q(t) — el umbral que respira

`IgnitionChamber` (`liquid/IgnitionChamber.ts`, 147 líneas):

```
T̂ = clamp01( (T − T_min) / (T_max − T_min) )

Q(t) = Q_base · (1 + κ_T·T̂) · (1 − κ_V·V) · (1 + κ_E·(1 − epicness))
```

Coeficientes calibrados: `Q_base = 0.650`, `κ_T = 0.50`, `κ_V = 0.40`, `κ_E = 0.10`.

Los tres términos multiplicativos implementan tres bucles de control independientes:

- **(1 + κ_T·T̂) — Bucle de saturación.** La tensión superficial `T(t)` sube cuando el impacto
  supera la barrera de forma sostenida. Q sube con ella: **cuanto más ha disparado el sistema
  en clímax, más difícil es volver a disparar.** Es control automático de ganancia (AGC)
  aplicado a la decisión estética. Rango: Q se eleva hasta +50%.

- **(1 − κ_V·V) — Bucle de sed.** La presión de vapor `V(t)` se acumula durante el silencio
  (`beta_v = 0.015/s`). Q baja con ella: **cuanto más lleva el sistema sin disparar, más
  sensible se vuelve.** Esto elimina la necesidad de un temporizador de «max time without
  effect» — el comportamiento emerge de la física. Rango: Q se reduce hasta −40%.

- **(1 + κ_E·(1−epicness)) — Bucle de dignidad.** En valles (epicness≈0) Q sube un 10%,
  bloqueando spam ambiental. En clímax (epicness≈1) no hay penalización.

**Hallazgo forense relevante.** El comentario en `IgnitionChamber.ts:101-102` documenta que
`κ_E` fue reducido de 0.45 a 0.10 porque **con 0.45 el squelch superaba 1.0 en valles, haciendo
la ignición matemáticamente imposible** (C ≤ 1.0 < Q). Esto es evidencia de un equipo que
razona sobre las cotas analíticas de su propio sistema y las corrige, no que ajusta números
hasta que «se ve bien». Es un indicador positivo de madurez de ingeniería.

### 1.5 La intensidad como subproducto continuo

```
I_fx = I_min + (1 − I_min)·tanh(κ_i·(C−Q)/Q) + κ_vb·V
```

El **exceso de ruptura** `(C−Q)/Q` —la información que la compuerta booleana destruía— se
recupera aquí y se mapea a través de `tanh` (saturación suave, sin discontinuidad de derivada)
a la intensidad materializada del efecto. `I_min = 0.35`, `κ_i = 2.0`.

Esto significa que **el sistema no solo decide si disparar, sino con cuánta fuerza, derivado de
la misma magnitud escalar.** Un evento que rompe el umbral por un pelo produce un efecto sutil;
uno que lo pulveriza produce un efecto devastador. En V2 esto requería una tabla de mapeo
separada y desincronizable. Aquí es una identidad algebraica.

### 1.6 Eficiencia del hot path — evaluación cuantitativa

Auditoría de los 7 módulos de `liquid/`:

- **Cero asignaciones por frame.** Cada motor mantiene un `_snapshot` pre-asignado con una
  referencia mutable interna (`this._v`, `this._sensors`). Los getters escriben sobre el objeto
  existente y devuelven la misma referencia. Documentado con la advertencia «no retener
  referencia».
- **Estado en primitivos.** `CognitiveFluidState` mantiene las 8 variables de Ψ(t) como campos
  `number` privados. No hay objetos intermedios, no hay arrays temporales.
- **Telemetría en typed arrays.** `LiquidTelemetryRecorder` usa `Float64Array` / `Uint8Array`
  para 2.700 frames (~60 s de caja negra). Ring buffer, dump JSONL offline. Bloqueo cero.
- **Cero `Math.random()`.** Todo el pipeline líquido es una función pura de (input, estado
  previo). Verificado por inspección directa.
- **Clamps sin ramas.** Patrón `x < 0 ? 0 : x > 1 ? 1 : x` — expresión ternaria que el JIT
  compila a instrucciones de movimiento condicional, no a saltos.

**Implicación para producto:** presión de GC nula en el hilo cognitivo. En Electron, una pausa
de GC de 12 ms es un frame DMX perdido y un artefacto visible en pista. Esta arquitectura no
puede generar esa pausa por diseño estructural, no por optimización posterior.

### 1.7 Agnosticismo de género — los descriptores ΠMΔG

`FluidDescriptors.ts` extrae 4 descriptores con EMA de vida media 8 s (α ≈ 0.001968 @ 44 Hz):

| Descriptor | Formulación | Semántica |
|-----------|-------------|-----------|
| Π percusividad | `R/(R+R_ref)`, `R = Σᵢ (wᵢ/τ)·e^(−Δtᵢ/τ)` | Densidad de transitorios (tasa real de crestas CF>2) |
| M melodicidad | `clamp01((mid − 0.30)/0.40)` | Contenido melódico normalizado |
| Δ suciedad | `harshness · (0.5 + 0.5·flatness)` | Textura espectral sucia/limpia |
| G groove | `syncopation` | Desplazamiento rítmico |

**Este es el activo de IP más defendible del núcleo V3.** El sistema no clasifica géneros: los
géneros son **puntos en un espacio continuo de 4 dimensiones**. Techno minimal, reggaetón,
drum'n'bass y ambient no son etiquetas con ramas de código; son coordenadas. Un género que no
existía cuando se escribió el código se ubica automáticamente en el espacio y el sistema se
comporta de forma coherente sin modificación alguna.

Para un fabricante de hardware con distribución global esto es directamente relevante:
**el motor no requiere localización por mercado musical.** El mismo binario que funciona en un
club de techno de Berlín funciona en una sala de reggaetón en Medellín o en una verbena en
Sevilla — no por casualidad, sino porque no hay ninguna decisión codificada que dependa del
género.

### 1.7.1 Π — el proxy retirado (REVISIÓN 2: §5.6 RESUELTO ✅)

En la revisión 1, Π se computaba como `rhythmicIntensity`. La discrepancia era de **tipo
matemático, no de precisión**: el contrato del descriptor (`FluidDescriptors.ts:16`) pide una
*densidad* —«tasa de crestas CF > 2/s»— y `rhythmicIntensity` es una *magnitud*. Una es la
intensidad λ de un proceso de conteo; la otra es un nivel. No son aproximaciones una de la otra.

`liquid/CrestDetector.ts` implementa el proceso de conteo real en tres etapas:

```
L(t) = ln((ε+E)/(ε+B))                    ← cresta en dominio logarítmico
Schmitt(θ, h) + refractario 40 ms          ← proceso de conteo
R(t) = Σᵢ (wᵢ/τ)·e^(−(t−tᵢ)/τ)            ← estimador de tasa
Π_raw = R/(R + R_ref)                      ← saturación de Hill (n=1)
```

Cuatro propiedades de auditoría relevantes:

**(a) El umbral es un test de ratio convertido en resta.** `CF > 2 ⟺ L > ln2 = 0.6931`. Cero
divisiones en el hot path y la misma disciplina aditiva-log de `SensorFusionChamber` (§1.2).

**(b) La constante de normalización se deriva, no se calibra.** `R(t) = Σ(1/τ)e^(−Δt/τ)` cumple
`E[R] = λ` para un proceso de Poisson estacionario. `R` está en eventos/segundo **por
construcción**. Solo `R_ref` (el punto donde Π = 0.5) es un parámetro estético.

**(c) La baseline es un tracker asimétrico del suelo** (α_up = 0.015 ≈ 1 s, α_down = 0.080 ≈
190 ms): un transitorio no puede arrastrar su propia referencia hacia arriba, y una caída de
sección no deja un techo rancio suprimiendo la detección. Mismo idioma que `_impact`
(`CognitiveFluidState.ts:100-102`).

**(d) El umbral adaptativo solo puede SUBIR.** `θ = max(ln2, μ_L + k·σ_L)` con μ/σ actualizados
únicamente mientras el trigger está desarmado. Esta asimetría es deliberada y es el detalle no
obvio del diseño: un umbral plenamente adaptativo **auto-normalizaría la tasa de eventos** y
volvería Π constante —es decir, sin información— con independencia de la música. Con el suelo
absoluto en `ln2`, un mastering hipercomprimido reporta correctamente percusividad **baja** en
lugar de ser reescalado dentro de rango.

**Fusión multibanda.** La intensidad de Poisson de una superposición de procesos independientes
es la suma de intensidades, de modo que ejecutar el detector sobre `[bass, mid, high]` y sumar
tasas ponderadas es **exacto, no heurístico**. Un kick y un hi-hat simultáneos son dos
transitorios; una única envolvente de banda ancha registraría uno.
`SeleneTitanConscious` alimenta las tres bandas desde un `Float32Array(3)` pre-asignado.

**Subproducto de mayor valor que Π.** El flag `crestEvent` es un detector de transitorio real
de **latencia cero** que el sistema no poseía en ninguna parte. Ya está cableado al Glass Break
Sensor (§2.6). El segundo consumidor natural es `s_V` (peso 0.1515), que hoy depende de
`(1−CF̂)` —un *nivel*— cuando una voz sostenida se caracteriza mucho mejor por tener **tasa de
cresta ≈ 0** pese a exhibir un CF instantáneo engañoso en masterings comprimidos.

**Verificación:** cobertura unitaria en `think/__tests__/Cassandra2.test.ts` — un tren de pulsos
a 4 hits/s produce Π > 0.4 con `rate > 2.5 ev/s`; un pad sostenido produce Π < 0.05 con
`rate < 0.1`; el refractario acota la tasa a 25 ev/s; el gate de energía absoluta anula eventos
en silencio.

---

## 2. PROJECT CASSANDRA — ARQUITECTURA PREDICTIVA

### 2.1 La diferencia categórica frente al mapeo audio-reactivo

Todo controlador DMX audio-reactivo comercial —sin excepción relevante en el mercado actual—
opera bajo el siguiente modelo causal:

```
t₀: evento acústico ocurre
t₀ + latencia_DSP:     el sistema lo mide         (~10-25 ms)
t₀ + latencia_lógica:  el sistema decide          (~5-15 ms)
t₀ + latencia_DMX:     la luz cambia              (~25-45 ms)
─────────────────────────────────────────────────────────────
Latencia percibida total: 40-85 ms POSTERIOR al evento
```

El resultado es estructuralmente un **eco visual**. El público percibe la luz *respondiendo* a
la música. Un operador humano competente no hace esto: anticipa. Levanta el fader durante los
últimos compases del buildup para que el blinder impacte **en** el kick, no 60 ms después.

Cassandra invierte el signo de la latencia.

### 2.2 El Fluid Timing Engine — ETA derivado, no tabulado

`PredictionEngine.estimateTimeToEvent()` (`think/PredictionEngine.ts:408-458`, WAVE 5016).

La implementación legacy retornaba enteros fijos (4 u 8 beats según tipo de evento). Si el DJ
adelantaba el drop, el reloj interno seguía contando hacia un número mágico. La versión actual
deriva el ETA de cuatro fuerzas físicas:

```javascript
baseBeats = { drop_incoming: 8, buildup_starting: 6, breakdown_imminent: 8, transition_beat: 4 }

// FLUID 1 — Aceleración de energía (hasta −75%)
velocityFactor = clamp01( calculateEnergyVelocity() / 0.02 )
beats = baseBeats · (1 − velocityFactor · 0.75)

// FLUID 2 — Histéresis de dwell (hasta −60%)
dwellBeats = timeInCurrentSectionMs / msPerBeat
if (dwellBeats > 8) beats *= (1 − min(1, (dwellBeats−8)/16) · 0.6)

// FLUID 3 — Compresión por tensión emocional
if (emotionalTension > 0.7) beats *= 0.8

beats = clamp(beats, 1, 16)

// FLUID 4 — ANCLAJE DE FASE PLL (la pieza crítica)
msToNextBeat = (1 − beatPhase) · msPerBeat
ms = msToNextBeat + (round(beats) − 1) · msPerBeat
```

**El anclaje de fase (FLUID 4) es la contribución no obvia.** El ETA no se expresa en
milisegundos arbitrarios sino **cuantizado a la rejilla de beats del PLL**. El sistema no
predice «algo pasará en 1.847 ms»; predice «algo pasará en el límite del beat que llega en
1.847 ms». Musicalmente, esto es la diferencia entre un disparo que suena a error y uno que
suena a decisión. Es la misma disciplina que aplica un ingeniero de mastering al cuantizar
automatización a la rejilla del proyecto.

### 2.3 Confianza orgánica y colapso por PLL

`computeOrganicConfidence()` (líneas 464-507):

```javascript
pllLock = pattern.pllLocked ? 1.0 : (bpmConfidence > 0.5 ? 0.5 : 0.0)

confidence  = baseProbability
confidence *= (0.55 + 0.45 · pllLock)                    // ORGANIC 1: colapso por PLL
confidence += min(1, dwellBeats/16) · 0.15               // ORGANIC 2: histéresis
if (isEnergeticType && isBuilding)
  confidence += velocityFactor · 0.12                    // ORGANIC 3: alineación energética
if (syncopation > 0.7) confidence *= 0.95                // ORGANIC 4: caos rítmico
```

**ORGANIC 1 es epistemológicamente correcto y merece señalarse.** Si la rejilla de beats no
está enganchada, cualquier predicción *basada en tiempo* es una conjetura, independientemente
de lo sólido que sea el patrón estructural detectado. El sistema **reconoce los límites de su
propio conocimiento** y colapsa la confianza a un suelo del 55%. Esto propaga hacia `s_P` en
la cámara de fusión, que a su vez reduce `C(t)`, que reduce la probabilidad de ignición.

La incertidumbre se propaga por el grafo de cómputo hasta la decisión final. La mayoría de los
sistemas comerciales tratan la confianza como un adorno de telemetría; aquí es una variable de
control de primera clase.

### 2.4 Detección de buildup espectral — evidencia física, no heurística

`predictCombined()` (líneas 860-938) arbitra entre tres fuentes:

1. **Predicción estructural** — REVISIÓN 2: cadena de Markov de 2º orden **aprendida**
   (Cassandra 2.0, §2.7). En la revisión 1 eran 8 patrones hardcodeados, de los cuales
   4 —incluido `buildup,buildup → drop` @ 0.90— eran inalcanzables por construcción (§2.8).
2. **Predicción energética** — `predictFromEnergy()`, umbrales de velocidad con perfiles por
   vibe (`chill-lounge` ×1.50, `ambient-organic` ×1.60, `techno-club` ×1.0).
3. **Buildup espectral** — `spectralBuildupScore` derivado de rolloff↑ + flatness↑ + subbass↓.

El punto crítico está en el comentario de la línea 874-876: *«Si detectamos buildup espectral
FÍSICO (>0.4), SABEMOS que viene algo. Esto NO es heurística, es análisis real del espectro de
frecuencias. El sonido LITERALMENTE está cambiando hacia un buildup.»*

Y el código respeta esa afirmación: con `spectralScore > 0.6` y sin predicción previa de
build/drop, el sistema **fabrica una predicción desde cero** con `probability = spectralScore ·
0.85`. La evidencia física puede originar una hipótesis, no solo reforzarla.

Esto es un detector de buildup basado en principios de DSP —el filtro high-pass progresivo y el
vaciado de sub-bajos son la firma espectral universal del buildup en música electrónica,
independiente del género y del tempo— no un clasificador entrenado sobre un dataset que
envejece.

### 2.5 El Reloj Soberano — materialización de latencia negativa

`SeleneTitanConscious.ts:667-1000`, ~330 líneas.

Cuando Cassandra emite una predicción de confianza suficiente, `EffectDreamSimulator`
**pre-selecciona y pre-bufferiza el efecto completo** con un sello temporal
`predictedEventAt`. En cada frame se evalúa:

```javascript
timeToEvent = bufferStatus.predictedEventAt − Date.now()
withinSovereignWindow = (timeToEvent <= 0 && timeToEvent >= −500)
```

Cuando la ventana se cumple, el candidato se dispara por **fast path**: sin HuntEngine, sin
`DecisionMaker`, sin simulación de escenarios. Todo el trabajo cognitivo pesado (matching de
ADN, evaluación ética, cálculo de riesgo) **ya se ejecutó segundos antes**.

La latencia entre el evento acústico y el cambio de luz es, en el caso nominal, el tiempo de
transporte DMX y nada más. Operacionalmente: **latencia cero, o negativa si la predicción
adelanta el transporte.**

### 2.6 El sensor Glass Break — el fallo del oráculo, resuelto

Toda arquitectura predictiva comparte el mismo modo de fallo: **la realidad contradice la
predicción**. Cassandra tenía la patología documentada en el comentario de la línea 657-665: si
faltaba 1 s para el disparo pre-bufferizado pero el DJ adelantaba el drop, *el sistema se
quedaba sordo esperando su propio countdown*. Esclavo de su reloj.

El Glass Break Sensor (WAVE 5016):

```javascript
valleyBreath  = (minEnergySinceLastEffect <= 0.45)
// REVISIÓN 2: corroboración física por evento de cresta real (§1.7.1)
crestCorroboration = crestEvent ? 0.5 : 0
GLASS_BREAK_Z = max(2.0, (valleyBreath ? 2.5 : 3.5) − crestCorroboration)

glassBreak = timeToEvent > 0
          && contextualMemory.isWarmedUp
          && currentZScore >= GLASS_BREAK_Z
          && titanState.rawEnergy > 0.55

if (withinSovereignWindow || glassBreak) { /* disparar AHORA */ }
```

**Refuerzo de la revisión 2.** Un Z-Score se computa sobre una ventana de 30 s y por tanto
**difumina el transitorio**: es evidencia estadística de que el nivel es anómalo, no evidencia de
que algo acaba de golpear. `crestEvent` sí lo es, con latencia cero. Se ha cableado como
corroboración que relaja el umbral Z medio sigma, con suelo absoluto en 2.0 — **nunca como
bypass**: una cresta aislada ocurre ~4 veces por segundo en techno y no es un drop. El diseño
respeta la jerarquía original: la predicción tiene autoridad sobre el *timing*, la evidencia
sensorial tiene autoridad de *interrupción*, y ahora esa evidencia incluye una medida física del
transitorio además de una estadística del nivel.

Si la realidad acústica reporta un Z-Score anómalo confirmado por energía absoluta alta
**mientras el countdown está corriendo**, Selene rompe el cristal: aborta la cuenta atrás,
dispara el efecto retenido al instante y limpia el buffer.

Arquitectónicamente, esto es un **sistema predictivo con corrección de realidad**: la predicción
tiene autoridad sobre el *timing*, pero la evidencia sensorial tiene autoridad de interrupción.
La «Regla del Valle» (WAVE 6040) endurece el umbral Z de 2.5 a 3.5 si no ha habido un valle
energético real desde el último disparo — mitigación de falsos positivos en autotune sostenido
y en masterings hipercomprimidos. Detalle de calibración que solo aparece tras uso real en
pista.

### 2.7 Cassandra 2.0 — la matriz aprendida (REVISIÓN 2: §5.5 RESUELTO ✅)

`PROGRESSION_PATTERNS` —el último residuo de tabla mágica del motor predictivo— ha sido
eliminado. En su lugar, `think/PredictionEngine.ts` implementa un estimador bayesiano
jerárquico con aprendizaje online.

**Alfabeto.** 10 estados MSST. La revisión 1 operaba sobre `SectionClassification` de 7 estados
y `MusicalPatternSensor` colapsaba `bridge→breakdown`, descartaba `textural_drop` y —lo más
dañino— mapeaba `unknown→verse`, convirtiendo una detección de baja confianza en una
**observación estructural falsa**. Los tres estados perdidos son precisamente los de estructura
de 2º orden más nítida (`drop→textural_drop→breakdown`, `bridge→chorus`). El tipo se ha
ensanchado a los 10 estados y el mapeo es ahora inyectivo.

**Layout — stride 16, no stride 10.**

```
idx₂ = (p₂<<8) | (p₁<<4) | n        idx₁ = (p₁<<4) | n
```

Tres propiedades, todas gratuitas: (a) aritmética puramente bitwise —sin multiplicaciones
enteras, índices que permanecen SMI y no deoptimizan a double; (b) cada fila de 16 float32 es
**exactamente 64 B = una línea de caché, y toda fila queda alineada a línea de caché**: un scan
O(10) es un fallo de caché, no dos; (c) 4096 × 4 B = 16 KB, residente en L1. Cambiar 12 KB de
memoria por alineación perfecta y cero multiplicaciones es la decisión correcta a 44 Hz.

**Estimador — Dirichlet jerárquico de dos niveles con cuentas con fuga.**

```
p̂₁(n) = (C₁[p₁,n] + κ₁·T₁[p₁,n]) / (N₁[p₁] + κ₁)
m₂(n) = β·T₂[p₂,p₁,n] + (1−β)·p̂₁(n)
p̂₂(n) = (C₂[p₂,p₁,n] + κ₂·m₂(n)) / (N₂[p₂,p₁] + κ₂)
```

Cuatro juicios de auditoría sobre esta formulación:

**(a) El posterior de nivel 1 ES la media a priori del nivel 2.** La masa de evidencia `N`
gobierna la interpolación por sí sola: no hay λ de backoff ajustada a mano ni umbrales. Con
~15-25 cambios de segmento por track, un MLE de 2º orden puro estaría catastróficamente falto de
datos (810 celdas útiles, ~20 muestras); la jerarquía es la respuesta correcta, no un adorno.

**(b) Los 8 patrones legacy no se han borrado: se han reexpresado como pseudo-cuentas** en
`T₁`/`T₂`. El arranque en frío es por tanto equivalente al Cassandra legacy y el aprendizaje lo
**domina monótonamente**. Esto es lo que convierte la intervención en una mejora sin riesgo de
regresión conductual: el prior es el comportamiento anterior.

**(c) La no estacionariedad se maneja con fuga multiplicativa perezosa por fila.** Un set de DJ
no es i.i.d. La masa de fila queda acotada por `1/(1−λ)` y se actualiza en O(1) precisamente
porque la fuga es multiplicativa (`N ← λN + 1`), lo que evita la pasada de reducción en
`predict()`. Verificado empíricamente: 10.000 observaciones dejan la masa por debajo de 16.67 =
1/(1−0.94).

**(d) El aprendizaje NO refuerza predicciones acertadas — y eso es correcto.** El conteo de
frecuencias ya es el estimador de máxima verosimilitud del núcleo de transición. Premiar además
el acierto crearía un bucle *rich-get-richer*: el argmax recibiría masa extra **por ser** el
argmax, el estimador dejaría de ser consistente y la cadena se bloquearía en lo primero que
viese. `validatePrediction()` se ha reconvertido en **telemetría de calibración pura** (EMA de
hit-rate → ganancia de fiabilidad del oráculo) y tiene prohibido tocar la matriz. Es la
distinción entre aprender de la realidad y aprender de uno mismo.

**Incertidumbre estructural — nueva variable de control.** El posterior normalizado produce
entropía de Shannon, y de ahí:

```
pEntropyConf = p_max · (1 − H/ln S)
baseProbability = √(p_max · pEntropyConf) · oracleTrust
```

La revisión 1 destacaba (§2.3) que el colapso por PLL implementa consciencia epistémica
*temporal*: si la rejilla no está enganchada, cualquier predicción basada en tiempo es conjetura.
Cassandra 2.0 añade el eje **estructural**: un pico de 0.35 en una distribución plana no es
conocimiento, y el sistema lo declara. Ambos ejes se componen por media geométrica —preservando
la semántica de t-norma del núcleo— y propagan a `s_P`, a `C(t)` y a la decisión final.

Medición sobre contextos reales (BPM 128, PLL enganchado):

| Contexto | Predicción | p_max | H⁻¹ | Probabilidad final |
|---|---|---:|---:|---:|
| `breakdown → buildup` | drop | 0.798 | 0.545 | **0.659** |
| `verse → buildup` | chorus | 0.563 | 0.319 | 0.424 |
| `intro → verse` | buildup | 0.565 | 0.243 | 0.370 |
| `drop → chorus` | verse | 0.350 | 0.088 | 0.176 |
| `breakdown → buildup`, PLL suelto | drop | 0.798 | 0.545 | 0.511 |

El trigrama canónico supera el gate de `drop_incoming` (>0.65) de `DecisionMaker` — exactamente
la intención del patrón legacy @0.90 tras el descuento orgánico. Los contextos ambiguos caen a
0.18-0.42 y **no** disparan gates. El comportamiento es ordenado y auto-consistente.

**Coste.** `observeSection`: 20 multiplicaciones + 4 sumas, solo en cambio de segmento.
`predictStructural`: ~60 flops + ≤9 logaritmos, 2 líneas de caché. Cero asignaciones en ambos.
Huella estática: 20 KB de typed arrays, que además **serializan a un perfil de estilo aprendido**
— la tesis de «calibración como datos» de §4.4.3 aplicada ahora también a la estructura musical.

### 2.8 Hallazgo forense de la revisión 2 — 4 de 8 patrones eran código muerto

Este defecto **no fue detectado en la revisión 1** y es material. Se documenta con precisión
porque afecta a la interpretación de la nota de *Arquitectura predictiva* de aquella revisión.

El legacy `updateHistory()` empujaba al historial **solo cuando la sección cambiaba**:

```javascript
if (sectionHistory.length === 0 ||
    sectionHistory[sectionHistory.length - 1].section !== currentSection) { /* push */ }
```

Por tanto **dos entradas idénticas consecutivas eran imposibles por construcción**. Y
`matchesTrigger()` comparaba las últimas N entradas del historial contra el trigger. Conclusión:

| Patrón | Probabilidad declarada | Alcanzable |
|---|---:|---|
| `buildup, buildup → drop` | 0.90 | **NO** |
| `chorus, chorus → verse` | 0.70 | **NO** |
| `drop, drop → breakdown` | 0.75 | **NO** |
| `verse, verse → buildup` | 0.65 | **NO** |
| `verse, buildup → chorus` | 0.85 | Sí |
| `buildup → drop` | 0.75 | Sí |
| `breakdown → buildup` | 0.80 | Sí |
| `intro → verse` | 0.85 | Sí |

**El predictor de mayor confianza del sistema nunca se ejecutó ni una vez.** Cassandra era de
facto una cadena de **1er orden con 5 reglas vivas**, no la cadena de 2º orden con 8 patrones que
declaraban el código y la revisión 1 de esta auditoría.

**Lectura de auditoría.** Es un defecto de tipo *silencioso*: no produce excepción, no degrada
métricas visibles, no aparece en telemetría. Solo se detecta razonando sobre la alcanzabilidad
del espacio de estados —exactamente el tipo de análisis que la revisión 1 acreditó al equipo en
§1.4 (la corrección de `κ_E` por cotas analíticas). La lección para el proceso de adquisición es
que la disciplina analítica del equipo es real pero **no uniforme**: rigurosa en el núcleo
líquido, ausente en el motor de patrones heredado.

**Resolución estructural, no parche.** Al ser el alfabeto de nivel *segmento*, los self-loops no
son raros: son **imposibles**. Cassandra 2.0 los codifica como cero estructural (`next === prev1`
excluido del soporte, junto con `unknown`), de modo que ninguna masa de probabilidad se
desperdicia y el defecto no puede reaparecer. La semántica de «buildup prolongado» se reasigna a
donde pertenece —el **dwell**, ya modelado por FLUID 2 y ORGANIC 2— y el trigrama
`breakdown → buildup → drop` recupera la intención del patrón muerto siendo plenamente
alcanzable. Separación limpia: **Markov decide QUÉ; el dwell decide CUÁNDO y con CUÁNTA
certeza.**

### 2.9 Diferenciación competitiva — evaluación de mercado

| Dimensión | Mapeadores audio-reactivos (estado del arte comercial) | Selene V3 + Cassandra |
|-----------|--------------------------------------------------------|------------------------|
| Causalidad | Reacciona **después** del evento | Anticipa **antes** del evento |
| Latencia percibida | +40 a +85 ms | ~0 ms (pre-buffer) |
| Horizonte temporal | 0 (instantáneo) | 1-16 beats derivados |
| Alineación al beat | Ninguna o cuantización fija | Anclaje de fase PLL |
| Modelo de incertidumbre | Ausente | Colapso por PLL **+ entropía estructural** propagados a la decisión |
| Estructura musical | Presets o secuencias fijas | Markov 2º orden **aprendida online** (Dirichlet jerárquico) |
| Corrección de realidad | N/A | Glass Break con Regla del Valle **+ corroboración de cresta** |
| Cobertura de género | Presets por estilo | Espacio continuo ΠMΔG |
| Modulación de intensidad | Mapeo lineal de amplitud | `tanh` del exceso de ruptura |

**Conclusión de sección:** la brecha frente al estado del arte comercial no es de grado, es de
categoría. Un producto audio-reactivo y un producto predictivo con corrección de realidad no
compiten en la misma métrica. Esta es la base de la tesis de valoración de Área 4.

---

## 3. LA DEUDA CYBORG — EVALUACIÓN OBJETIVA DEL ESTADO TRANSICIONAL

### 3.1 Delimitación exacta de la autoridad

El sistema opera actualmente con una **bifurcación de autoridad** deliberada:

```
SELENE_V3_AUTHORITY = true          // SeleneTitanConscious.ts:235

┌─────────────────────────────────────────────────────────────────┐
│  ¿DISPARAR?  (WHETHER)                                          │
│  → V3 LiquidCognitionCore                                       │
│  → Predicado único: C(t) ≥ Q(t)                                 │
│  → 1.771 líneas, zero-alloc, determinista, agnóstico de género   │
│  → AUTORIDAD ABSOLUTA. V2 ya no puede vetar.                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼  _v3Ignite && !activeDictator
┌─────────────────────────────────────────────────────────────────┐
│  ¿QUÉ DISPARAR?  (WHAT)                                         │
│  → V2 EffectDreamSimulator          (89 KB, 1.829 líneas)       │
│  → V2 DreamEngineIntegrator         (33 KB,   722 líneas)       │
│  → V2 DecisionMaker                 (41 KB,   890 líneas)       │
│  →    VisualConscienceEngine        (23 KB,   639 líneas)       │
│  → Ranking por matching de ADN + evaluación ética               │
│  → Guarda de timeout: 15 ms                                     │
└─────────────────────────────────────────────────────────────────┘
```

El puente entre ambos mundos es un único booleano: `shouldRunDNA = _v3Ignite && !activeDictator`.

### 3.2 Lectura positiva — por qué esto es la decisión correcta

**(a) Es la separación de responsabilidades correcta, no un accidente.** «Cuándo disparar» es un
problema de **detección de eventos en señal**: continuo, sin estado externo, resoluble con
matemática fluida. «Qué disparar» es un problema de **búsqueda combinatoria con restricciones**:
matching de genoma sobre un arsenal de N efectos, detección de conflictos de cooldown,
evaluación ética, cálculo de riesgo de fatiga. Son dominios computacionales distintos y exigen
herramientas distintas. Forzar la selección de efectos dentro del paradigma líquido sería un
error de diseño peor que la duplicidad actual.

**(b) La refactorización se hizo en el orden correcto.** El equipo atacó primero el subsistema con
el mayor ratio complejidad/valor: 20 vetos booleanos que producían un solo bit de output. Ese
era el cuello de botella real, tanto en rendimiento como en mantenibilidad. `EffectDreamSimulator`
—aun con sus 89 KB— produce un output rico (efecto + intensidad + zonas + razonamiento) y su
complejidad está *justificada por el problema*, no por la implementación.

**(c) El acoplamiento fue reducido, no simplemente desplazado.** En V2, `EffectDreamSimulator` se
ejecutaba en **cada frame** como parte de la cadena de veto. En V3 se ejecuta **solo cuando V3
enciende**. Asumiendo una tasa de ignición realista del 2-5% de los frames, esto representa una
reducción del **95-98% en invocaciones del módulo más pesado del sistema**. El coste amortizado
por frame cayó en más de un orden de magnitud sin eliminar una sola línea de ese archivo.

**(d) La deuda está identificada, medida y documentada.** El informe interno
`SELENE_V3_LIQUID_CONSCIOUSNESS_AUDIT.md` lista explícitamente el monolito de 2.557 líneas, las
ramas por vibe residuales, la proliferación de cooldowns y el tamaño de `EffectDreamSimulator`
como preocupaciones abiertas. En due diligence, **deuda técnica documentada por el propio equipo
es un activo de gestión, no un pasivo oculto.** El riesgo de adquisición está en lo que no se
documenta.

### 3.3 Lectura negativa — riesgos cuantificados

| Riesgo | Evidencia | Severidad | Mitigación |
|--------|-----------|-----------|------------|
| **Monolito orquestador** | `SeleneTitanConscious.ts` = 2.303 líneas (rev. 1: 2.557; reducido por la extracción de `SovereignClockGuard`). El bloque del Reloj Soberano ocupa ~330 (líneas 667-1000) con compuertas de seguridad inline: veto de zona ARS, suelo de epicness, rango de presión, re-ruteo heavy/divine | **Alta** | Extracción a `SovereignClockGuard`. El propio informe interno lo recomienda antes de la integración con Genesis |
| **Proliferación de cooldowns** | 8+ temporizadores independientes (global, pipeline, DNA override, bypass V3, refractario post-drop, cadena de drop, escudo just-fired, específico Latina). Interactúan de forma no evidente | **Media-Alta** | Consolidar en el bucle de vapor `V(t)`, que ya implementa refractariedad de forma emergente. Riesgo: **actualmente todos están a 0 en modo DIAG** — el sistema corre sin cooldowns, intencionadamente para diagnóstico, pero es un estado no apto para producción |
| **`s_DNA` alimentado con genoma neutro** | `SeleneTitanConscious` pasa `NEUTRAL_GENOME` (0.5/0.5/0.5). El sensor con peso 0.1699 —el segundo más relevante tras `s_E`— opera con información constante | **Media** | El más grave desde la perspectiva de valor de IP: **un sensor completo del núcleo está en cortocircuito.** Ver §5.1 |
| **Ramas por vibe residuales** | `isTechnoVibe` / `isLatinVibe` persisten en `SeleneTitanConscious.ts` y `DecisionMaker.ts` para umbrales divinos, suelos RMS y compuertas de epicness. `PredictionEngine` mantiene `VIBE_THRESHOLD_PROFILES` con 7 entradas (solo en `predictFromEnergy`; el camino estructural ya es agnóstico) | **Baja-Media** | Fragmenta el principio de agnosticismo. El núcleo líquido es puro; la periferia no. Migrable a coordenadas ΠMΔG |
| **Alcanzabilidad no verificada en lógica heredada** (REV. 2) | 4 de 8 patrones de progresión eran inalcanzables por construcción y nunca se detectó (§2.8). Defecto silencioso: sin excepción, sin señal en telemetría | **Media** (resuelto en el caso conocido) | El caso concreto está resuelto estructuralmente. El riesgo **residual** es de proceso: no existe verificación sistemática de alcanzabilidad sobre el resto de tablas heredadas (`VIBE_THRESHOLD_PROFILES`, umbrales de `DecisionMaker`). Recomendación en §5.10 |
| **Dualidad conceptual** | Un ingeniero nuevo debe comprender ambos paradigmas para modificar el pipeline con seguridad | **Media** | Coste de onboarding. Mitigable con documentación de frontera y contratos de interfaz explícitos |

### 3.4 Veredicto de la sección

El estado actual es un **cyborg funcional, no un Frankenstein**. La frontera de autoridad está
definida por una única expresión booleana verificable, no difusa por el código. V3 no puede ser
vetado por V2 en la decisión de disparar; V2 no puede disparar sin autorización de V3. La
invariante es unidireccional y auditable.

El riesgo de adquisición no es la existencia de la dualidad —es arquitectónicamente defendible—
sino que **el cortocircuito de `s_DNA` significa que el sistema aún no ha ejercido su capacidad
completa.** El motor está calibrado y operativo con uno de sus siete sensores desconectado.
Esto es simultáneamente el defecto más notable y la oportunidad de upside más clara del activo.

---

## 4. PIONEER SCORE

### 4.1 Desglose por dimensión

| Dimensión | Peso | Nota | Ponderado | Justificación |
|-----------|:----:|:----:|:---------:|---------------|
| **Innovación cognitiva** | 30% | 96 | 28.8 | El predicado `C(t) ≥ Q(t)` con squelch de tres bucles y media geométrica de 7 sensores no tiene equivalente conocido en el mercado de control de iluminación. El espacio ΠMΔG es IP defendible. **REV. 2:** la incertidumbre como variable de control gana un segundo eje independiente —entropía estructural del posterior de Markov (§2.7)— compuesto por media geométrica con el colapso temporal por PLL. Dos fuentes de duda ortogonales propagadas a la misma decisión escalar: +1 |
| **Eficiencia de hot path** | 25% | 97 | 24.25 | Zero-alloc verificado en los 7 módulos líquidos. Estado en primitivos. Typed arrays para telemetría. Sin ramas de género. Sin `Math.random()`. Presión de GC estructuralmente nula en el hilo cognitivo. **REV. 2:** eliminados `[...PROGRESSION_PATTERNS].sort()` y `slice()` por frame y el `shift()` del historial; Markov con filas alineadas a línea de caché e indexación bitwise; detector de crestas con 7 escalares y aproximación lineal de `exp` en lugar de `Math.pow`: +1 |
| **Reducción de código legacy** | 20% | 93 | 18.6 | ~6.000 líneas eliminadas, verificado contra el desglose modular. `FuzzyDecisionMaker` (~2.000 líneas) eliminado. `HuntEngine` de ~35 KB a 7 KB. `EthicalCoreEngine` (32 KB) desactivado. `ScenarioSimulator` (24 KB) deprecado. **REV. 2:** purgada la última tabla mágica del motor predictivo (`PROGRESSION_PATTERNS`, `findMatchingPattern`, `matchesTrigger`, historial por array) y el proxy de Π: +1. Penalización persistente: `EffectDreamSimulator` (89 KB) permanece activo |
| **Arquitectura predictiva** | 15% | 98 | 14.7 | Fluid Timing con anclaje de fase PLL. Glass Break con Regla del Valle **+ corroboración física de cresta**. Buildup espectral capaz de originar hipótesis. Pre-buffer soberano de 500 ms. Latencia negativa real. **REV. 2:** matriz de 2º orden aprendida online con Dirichlet jerárquico, priors legacy como pseudo-cuentas (arranque en frío sin regresión), fuga multiplicativa acotada, ceros estructurales y separación explícita de aprendizaje vs. autoconfirmación (§2.7). Defecto de alcanzabilidad resuelto de raíz (§2.8) |
| **Separación de responsabilidades** | 10% | 62 | 6.2 | El orquestador sigue siendo el defecto claro (2.303 líneas). 8 cooldowns acoplados. Ramas por vibe en la periferia. **REV. 2:** `SovereignClockGuard` extraído con contrato explícito; `CrestDetector` aislado como módulo DSP puro y testeable; la lógica estructural de Cassandra es ahora funciones puras sobre typed arrays: +4. El núcleo `liquid/` es ejemplar; el orquestador no |
| | | | | |
| **Subtotal ponderado** | 100% | | **92.55** | |
| **Ajuste por deuda `s_DNA`** | — | — | **−3.7** | Sensor con peso 0.1699 operando con constante. Capacidad no ejercida. **Único P0 abierto** |
| **PIONEER SCORE** | — | — | **88.85** | |

> ### 🏆 PIONEER SCORE: **88.9 / 100**  *(rev. 1: 87.0)*

**Nota de honestidad metodológica.** La subida neta es de +1.9 puntos, no de los +4 a +5 que
sugeriría el cierre de dos ítems de la ruta de evolución (§5.5 y §5.6). El motivo es explícito:
la nota de *Arquitectura predictiva* de la revisión 1 (93) **estaba inflada**. Puntuaba una
cadena de Markov de 2º orden con 8 patrones que en ejecución era una cadena de 1er orden con 5
reglas (§2.8). Valorada correctamente, esa dimensión merecía ~85 en la revisión 1, lo que habría
dejado el score anterior en ~85.8. Medido contra esa línea base corregida, la intervención vale
**+3.1 puntos reales**. Se documenta así para que la trazabilidad de la valoración sobreviva a
la diligencia debida de la contraparte.

### 4.2 Interpretación de la puntuación

**88.9/100 — Activo de IP estratégico, listo para integración con una reserva P0 acotada.**

Escala de referencia interna de adquisición:

- **95-100** — Estado del arte absoluto, sin deuda material identificable
- **85-94** — Innovación defendible con deuda técnica acotada y documentada ← **Selene V3**
- **70-84** — Ingeniería sólida, innovación incremental
- **50-69** — Funcional, sin diferenciación defendible
- **<50** — Prototipo o deuda estructural

### 4.3 Comparativa con el estado del arte comercial

| Producto / Categoría | Score estimado | Brecha vs. Selene V3 |
|---------------------|:--------------:|----------------------|
| Software DMX audio-reactivo estándar (mapeo FFT → parámetro) | 30-40 | Categoría distinta. Reacciona, no anticipa |
| Consolas profesionales con macros por timecode | 45-55 | Requiere programación manual completa. Cero autonomía |
| Sistemas «IA» comerciales con clasificación de género por presets | 55-65 | Ramas por género = el problema que V3 resuelve estructuralmente |
| Sistemas «IA» con progresión estructural fija (secuencias o timecode aprendido offline) | 60-70 | La matriz de Cassandra 2.0 aprende **online, por operador, sin dataset** |
| **Selene V3 «Iliquidcore» + Cassandra 2.0** | **88.9** | — |

### 4.4 Factores clave que sostienen la valoración

1. **El predicado único es defendible como IP.** No es una implementación de un paper conocido;
   es una síntesis original de teoría de control fluido, fusión de sensores en dominio log y
   teoría de la decisión aplicada a estética visual en tiempo real.
2. **El agnosticismo de género elimina el coste de localización por mercado.** Crítico para
   distribución simultánea en Norteamérica y Europa sin bifurcación de producto.
3. **La calibración es reproducible.** `ILiquidCognitionProfile.ts` es un objeto congelado y
   plano; Monte Carlo puede recalibrar sin tocar una línea de lógica. Esto permite perfiles
   regionales de mercado (US EDM / ES techno-latino) como **datos**, no como código.
4. **La telemetría de caja negra existe y es explotable.** 2.700 frames en typed arrays con dump
   JSONL. Base directa para calibración supervisada post-venta y para telemetría de producto.
5. **La deuda está mapeada.** Ninguna de las preocupaciones identificadas en esta auditoría era
   desconocida para el equipo. Riesgo de sorpresa: bajo. **Matiz de la revisión 2:** el hallazgo
   §2.8 es la excepción — era desconocido. Se acota como riesgo de proceso, no de arquitectura
   (§5.10), y su detección y resolución en la misma iteración es en sí un indicador positivo de
   capacidad de auditoría interna.
6. **La estructura musical aprendida es un activo que se aprecia con el uso** (REV. 2). La matriz
   de 20 KB es un perfil de estilo serializable por operador o por venue. A diferencia de un
   modelo entrenado sobre un dataset —que envejece—, este estimador converge al repertorio real
   de quien lo usa y olvida lo que deja de ser cierto (fuga multiplicativa acotada). Extiende la
   tesis de «calibración como datos» del punto 3 desde los coeficientes del fluido hasta la
   gramática musical.

---

## 5. RUTA DE EVOLUCIÓN RECOMENDADA — SIGUIENTES PASOS

Priorizado por ratio valor/riesgo. Las cinco primeras son las que recomendaría ejecutar antes
de la auditoría de integración completa.

### 5.1 [P0] Cerrar el bucle Genesis → `s_DNA` — cortocircuito activo

**Estado:** `SeleneTitanConscious` pasa `NEUTRAL_GENOME` (0.5/0.5/0.5) a
`LiquidProcessInput.effectGenome`. El sensor `s_DNA` —peso 0.1699, el segundo más pesado del
sistema— computa un kernel gaussiano contra una constante. Su gradiente informativo es nulo.

**Acción:** inyectar el `FrozenGenome` real del candidato pre-seleccionado. El registro ya lo
expone: `RegistryEntry.dna` está pre-aplanado precisamente para acceso O(1) en hot path.

**Complicación arquitectónica reconocida:** existe una inversión de dependencia. `s_DNA`
necesita saber *qué* efecto se evalúa, pero la selección del efecto ocurre *después* de que
`C(t)` decida disparar. Dos resoluciones viables:

- **(a) Genoma del contexto proyectado.** Sustituir el genoma del efecto por el genoma que el
  contexto acústico *demanda* (`g_ctx = ⟨Ê·CF̂, Δ, 1−Π⟩`, ya computado en la cámara). `s_DNA`
  pasa de medir «afinidad del candidato» a medir «coherencia interna del contexto». Barato,
  sin reordenar el pipeline.
- **(b) Doble pasada especulativa.** Fase 1 con genoma neutro para determinar si hay ignición
  potencial; fase 2 recalculando `C(t)` con el genoma real del top-1 del simulador. Coste: una
  invocación adicional de `fuse()` (~7 logaritmos) en los frames de ignición. Dado que la tasa
  de ignición es del 2-5%, el coste amortizado es despreciable y **cierra el bucle evolutivo
  Genesis ↔ Liquid de forma completa.**

**Impacto:** activa el 17% del peso de la ecuación de confianza que hoy está inerte. Es la
mejora de mayor retorno del sistema.

### 5.2 [P0] Extraer `SovereignClockGuard` — RESOLVED ✅

**Estado:** ~330 líneas inline en `SeleneTitanConscious.ts:667-1000`. Contiene veto de zona ARS,
suelo de epicness, veto de rango de presión, re-ruteo heavy/divine, cuarentena de minions y el
Universal Reality Clamp.

**Resolución:** El bloque inline fue extraído a `guards/SovereignClockGuard.ts` con contrato
explícito `SovereignVerdict`. El orquestador bajó de ~2.557 a ~2.284 líneas. Las compuertas de
seguridad (ARS zone veto, epicness floor, pressure range, heavy/divine re-route, Glass Break)
son ahora testeables de forma unitaria. El orquestador invoca `this._sovereignGuard.evaluate()`
y actúa según el verdict retornado. Prerrequisito para integración con Genesis cumplido.

**Acción:** módulo dedicado con contrato explícito:

```typescript
interface SovereignVerdict {
  readonly action: 'fire' | 'abort' | 'reroute' | 'wait'
  readonly candidate: PreBufferedCandidate | null
  readonly reason: SovereignAbortReason | null
  readonly trigger: 'sovereign_window' | 'glass_break' | null
}
```

**Impacto:** el orquestador baja a ~2.200 líneas. Las compuertas de seguridad se vuelven
testeables de forma unitaria. **Prerrequisito para la integración con Genesis** — sin esta
extracción, la complejidad se compone.

### 5.3 [P1] Consolidar los 8 cooldowns en el bucle de vapor `V(t)` — PARTIALLY RESOLVED ⚠️

**Estado:** 8 temporizadores independientes, todos a 0 en modo DIAG. El sistema corre sin
refractariedad.

**Nota de progreso:** Los campos y constantes de cooldown fueron aislados como miembros
privados readonly con comentario de migración pendiente. El bloque inline del Reloj Soberano
(fuente de ~270 líneas de lógica de cooldown acoplada) fue eliminado del orquestador. La
consolidación real en `V(t)` permanece pendiente — los temporizadores siguen operando como
restricciones discretas. `V(t)` con `beta_v = 0.015/s` y `kappa_vreset = 0.15` ya implementa
refractariedad emergente que reemplazaría la mayoría de estos cooldowns.

**Observación arquitectónica:** `V(t)` con `beta_v = 0.015/s` y `kappa_vreset = 0.15` **ya
implementa refractariedad emergente**. Tras una ignición el vapor se resetea al 15%, lo que
eleva `Q(t)` hasta un +34% (vía `1 − κ_V·V`), suprimiendo naturalmente disparos consecutivos. Y
lo hace de forma continua, sin discontinuidades.

**Acción:** auditar cada cooldown y determinar cuáles son redundantes con `V(t)`. Los
supervivientes (probablemente solo HARD_COOLDOWN como límite de seguridad fotosensible) se
declaran explícitamente como **restricciones de seguridad**, no como lógica estética.

**Impacto:** reducción sustancial del espacio de estados. Elimina interacciones no evidentes.
Restaura refractariedad apta para producción sin reintroducir compuertas discretas.

### 5.4 [P1] Migrar las ramas por vibe a coordenadas ΠMΔG — PARTIALLY RESOLVED ⚠️

**Estado:** `isTechnoVibe` / `isLatinVibe` en el orquestador y en `DecisionMaker`;
`VIBE_THRESHOLD_PROFILES` con 7 entradas en `PredictionEngine`.

**Nota de progreso:** Las ramas por vibe permanecen activas en la periferia del orquestador
(umbrales divinos, suelos RMS, compuertas de epicness). La migración a interpolación continua
sobre coordenadas ΠMΔG está pendiente. El núcleo líquido (`liquid/`) ya es puro y agnóstico
de género; la deuda está acotada a la capa V2 heredada.

**Acción:** cada rama por vibe es una función escalón sobre el espacio ΠMΔG. Sustituir por
interpolación continua:

```
divineThreshold = f(Π, M, Δ, G)   en lugar de   if (isTechnoVibe) 0.50 else 0.60
```

Los umbrales por vibe existentes son **muestras** de esa función; una interpolación
multilineal sobre los 7 puntos conocidos generaliza a géneros no vistos.

**Impacto:** completa el principio de agnosticismo. Elimina el mantenimiento de tablas por
género. **Relevante para la estrategia de mercados dual (US/ES):** ningún género regional
requiere una entrada nueva en ninguna tabla.

### 5.5 [P1] Cassandra 2.0 — progresión aprendida — RESOLVED ✅

**Estado en rev. 1:** `PROGRESSION_PATTERNS` = 8 patrones hardcodeados con probabilidades fijas.
El último residuo de tabla mágica del motor predictivo — y, según §2.8, con la mitad de sus
reglas inalcanzables.

**Resolución (detalle técnico en §2.7).** Cadena de 2º orden sobre el alfabeto MSST completo de
10 estados, `Float32Array` con stride 16 (filas de 64 B alineadas a línea de caché, 16 KB),
estimador Dirichlet jerárquico de dos niveles con los 8 patrones legacy reexpresados como
pseudo-cuentas, fuga multiplicativa perezosa por fila, ceros estructurales para self-loops y
`unknown`, argmax O(10) con entropía de Shannon como confianza epistémica estructural.
`observeSection()` aprende; `validatePrediction()` quedó reducido a telemetría de calibración
—deliberadamente sin autoridad sobre la matriz, para no introducir autoconfirmación.

**Desviación respecto de la acción recomendada en rev. 1, y su justificación.** La recomendación
original era una «regla delta acotada con `validatePrediction()`». Se ha implementado
**conteo de frecuencias con fuga** en su lugar. Motivo: la regla delta sobre predicciones
validadas es un estimador **sesgado** —refuerza el argmax por el hecho de ser argmax— mientras
que el conteo de frecuencias es el estimador de máxima verosimilitud del núcleo de transición.
La recomendación de la revisión 1 era, en este punto, técnicamente incorrecta; se documenta el
cambio de criterio en lugar de silenciarlo.

**Impacto medido:** el trigrama canónico `breakdown→buildup→drop` alcanza 0.659 de probabilidad
final (supera el gate de `drop_incoming`) y los contextos ambiguos caen a 0.18-0.42 sin disparar
gates. Cobertura unitaria en `think/__tests__/Cassandra2.test.ts` (12 casos): recuperación del
prior, exclusión estructural, dominio del aprendizaje sobre el prior tras 12 observaciones, cota
de masa `1/(1−λ)`, inmutabilidad de la matriz frente a `validatePrediction`, cuantización del ETA
a la rejilla del PLL.

**Nota conductual para despliegue:** el descuento por entropía hace que los contextos
genuinamente ambiguos reporten probabilidades más bajas que las constantes legacy. Se esperan
**menos predicciones que superan gates durante los primeros ~10 segmentos** de cada track, hasta
que las cuentas se afilan. Es el estimador funcionando como se diseñó, no una regresión; el
parámetro de ajuste, si se desea un arranque más agresivo, es `BETA` (0.55 → 0.75).

### 5.6 [P2] Reemplazar el proxy Π por un detector de crestas real — RESOLVED ✅

**Estado en rev. 1:** `FluidDescriptors.ts:91` documentaba que Π usaba `rhythmicIntensity` como
proxy pendiente de refinar.

**Resolución (detalle técnico en §1.7.1).** `liquid/CrestDetector.ts`: cresta en dominio
logarítmico contra baseline asimétrica, Schmitt trigger con histéresis de `ln(1.25)` y
refractario de 40 ms, estimador de tasa por kernel de Poisson (`E[R] = λ` por construcción),
normalización de Hill. Variante multibanda exacta por superposición de procesos independientes,
alimentada desde `[bass, mid, high]`. Umbral adaptativo monótonamente creciente para evitar la
degeneración por auto-normalización. Zero-alloc, zero-latencia, 7 escalares de estado.

**Impacto realizado:** Π pasa de ser una magnitud a ser la densidad que su contrato declara.
Mejora simultáneamente la viscosidad μ(t) (`w_p = 0.10`) y el genoma de contexto de `s_DNA`
—lo que **incrementa el retorno de §5.1**, todavía abierto—. Subproducto: flag `crestEvent` de
latencia cero, ya consumido por el Glass Break Sensor y disponible para endurecer `s_V`.

### 5.7 [P2] Perfiles regionales de calibración como datos

**Estado:** `DEFAULT_LIQUID_PROFILE` es un perfil global único, calibrado sobre 10 tracks.

**Acción:** dado que el perfil es un objeto plano congelado, generar perfiles adicionales por
mercado mediante el pipeline de Monte Carlo existente:

- `PROFILE_US_EDM` — festival/club, masterings hipercomprimidos, drops de alto contraste
- `PROFILE_ES_TECHNO_LATINO` — techno peninsular + verbena/reggaetón, dinámica de sección más
  irregular, mayor peso de groove G
- `PROFILE_AMBIENT_LOUNGE` — hostelería, hoteles, retail

**Impacto:** localización de comportamiento **sin bifurcación de código**. Un perfil es un JSON
de 40 coeficientes. Habilita SKUs regionales y actualizaciones de calibración OTA sin release
de binario. Relevante directamente para la estrategia de lanzamiento dual US/ES.

### 5.8 [P3] Reducir `EffectDreamSimulator` (89 KB)

**Estado:** archivo más grande del directorio. Ejecuta simulación de escenarios, matching de
ADN, cálculo de riesgo y detección de conflictos de cooldown.

**Acción:** descomponer en `DnaMatcher` (scoring puro), `RiskEvaluator` y `CandidateRanker`.
Puramente estructural.

**Prioridad baja justificada:** en V3 solo se ejecuta cuando V3 enciende (2-5% de frames). El
impacto en rendimiento es marginal; el beneficio es exclusivamente de mantenibilidad.

### 5.9 [P3] Ciclo de calibración cerrado sobre la caja negra

**Estado:** `LiquidTelemetryRecorder` produce 2.700 frames en JSONL. El análisis es offline y
manual.

**Acción:** pipeline automatizado — recorder → función de coste (falsos positivos en valles,
falsos negativos en drops, alineación al beat) → Simulated Annealing → nuevo perfil → A/B en
sesión siguiente.

**Impacto:** el sistema se autocalibra por venue. Un club con acústica de 8 s de reverberación
y un festival al aire libre convergen a perfiles distintos automáticamente. Ventaja competitiva
de producto instalado.

**Ampliación de la revisión 2:** el mismo pipeline debe persistir ahora también la matriz de
Cassandra 2.0 (`C₁`/`C₂`/`N₁`/`N₂`, 17 KB de typed arrays) como parte del perfil de venue u
operador. El estimador ya está diseñado para ello: `onTrackChange()` halva la evidencia para
conservar la estructura de estilo y descartar las idiosincrasias de un track concreto.

### 5.10 [P2] Verificación sistemática de alcanzabilidad en tablas heredadas (NUEVO, REV. 2)

**Estado:** el defecto §2.8 se detectó por razonamiento manual sobre el espacio de estados. No
existe ninguna verificación automatizada que garantice que una regla declarada en una tabla pueda
efectivamente activarse.

**Acción:** para cada tabla de umbrales/reglas heredada (`VIBE_THRESHOLD_PROFILES`, umbrales de
`DecisionMaker`, `pressureRange` del registro de efectos, `validSections` de los `.lfx`), añadir
un test de **cobertura de activación** que, sobre la telemetría de caja negra de una sesión real,
afirme que cada entrada se ha evaluado a verdadero al menos una vez. Una entrada que nunca se
activa es o código muerto o una regla mal condicionada; en ambos casos hay que saberlo.

**Impacto:** convierte un defecto de clase «silencioso» en un fallo de test. Coste bajo: el
`LiquidTelemetryRecorder` ya produce el corpus necesario.

---

## 6. CONCLUSIÓN DE AUDITORÍA

Selene V3 «Iliquidcore» representa una reformulación genuina del problema del control autónomo
de iluminación. La reducción de un árbol de decisión de 20+ compuertas booleanas a un predicado
escalar continuo `C(t) ≥ Q(t)` no es simplificación cosmética: es la **elección de la
herramienta matemática correcta para el dominio del problema**. La media geométrica en dominio
logarítmico es la t-norma diferenciable adecuada para fusión conjuntiva de sensores; el squelch
de tres bucles multiplicativos es control automático de ganancia aplicado a decisión estética;
la intensidad derivada del exceso de ruptura vía `tanh` recupera la información que la
arquitectura anterior destruía en cada frame.

Project Cassandra invierte el signo de la latencia del sistema. El anclaje de fase PLL garantiza
alineación musical del disparo; el colapso de confianza por PLL implementa consciencia
epistémica real —el sistema sabe cuándo no sabe— y propaga esa incertidumbre hasta la decisión
final; el Glass Break Sensor resuelve el modo de fallo canónico de toda arquitectura predictiva
mediante autoridad de interrupción sensorial sobre el reloj interno. La combinación de latencia
negativa con corrección de realidad no tiene equivalente en el mercado auditado.

**Revisión 2.** Cassandra 2.0 completa el argumento anterior en su punto más débil. El motor
predictivo ya no consulta una tabla de constantes: mantiene un posterior bayesiano sobre la
gramática musical del repertorio que efectivamente escucha, con los patrones heredados
degradados a prior —de modo que el arranque en frío no puede ser peor que el comportamiento
anterior— y con olvido acotado para seguir a un operador que cambia de estilo. La consciencia
epistémica gana un eje ortogonal: además de saber cuándo su reloj no es fiable, el sistema ahora
sabe cuándo su **gramática** no lo es, y ambas dudas se componen multiplicativamente sobre la
misma decisión escalar. Y el descriptor Π ha dejado de ser un proxy: mide la densidad real de
transitorios mediante un proceso de conteo cuya constante de normalización se deriva de la teoría
de Poisson en lugar de calibrarse. El subproducto —un detector de transitorio de latencia cero—
aporta al Glass Break la evidencia física que antes solo tenía en forma estadística.

La revisión 2 también obliga a una corrección de la revisión 1: la dimensión *Arquitectura
predictiva* estaba sobrevalorada porque puntuaba una capacidad que, por un defecto de
alcanzabilidad no detectado, nunca se ejecutó (§2.8). Se documenta explícitamente en §4.1. El
hallazgo no altera la tesis de valoración —la corrige y la refuerza—, pero sí introduce una
recomendación de proceso nueva (§5.10): la disciplina analítica del equipo es real en el núcleo
líquido y era inexistente en la lógica heredada, y esa asimetría debe cerrarse con verificación
automatizada, no con confianza.

El espacio de descriptores ΠMΔG es el activo de IP más defendible del núcleo: elimina
estructuralmente la clasificación por género, y con ella el coste de localización por mercado
musical. El mismo binario opera coherentemente en Norteamérica y en España sin bifurcación de
producto ni tablas de presets regionales.

La deuda cyborg es real, está acotada y está documentada por el propio equipo. La frontera de
autoridad V3/V2 se expresa en una única invariante booleana verificable. El defecto material
más notable —`s_DNA` alimentado con genoma constante— es simultáneamente el mayor upside
disponible: un 17% del peso de la ecuación de confianza está inerte y es activable con una
inyección de dependencia acotada. Tras la revisión 2 es el **único P0 abierto**, y su retorno ha
aumentado: el genoma de contexto que alimentaría a `s_DNA` se construye sobre `⟨Ê·CF̂, Δ, 1−Π⟩`,
y Π acaba de dejar de ser un proxy.

**Puntuación final: 88.9/100** *(revisión 1: 87.0; línea base corregida por §2.8: ~85.8).*

**Recomendación:** proceder con la adquisición. §5.2, §5.5 y §5.6 están cerradas. Ejecutar §5.1
(único P0 restante) como condición previa a la auditoría de integración con Genesis y DnaRail, y
§5.10 como salvaguarda de proceso antes de aceptar cualquier tabla heredada como funcional. El
activo es estratégico; la deuda restante es de refactorización y de verificación, no de
arquitectura.

---

*Fin del informe. Auditoría Área 4 — Selene IA V3 «Iliquidcore» + Motor Predictivo Cassandra 2.0.*
*Revisión 2 — 2026-08-17. Documento confidencial. Proceso de adquisición de IP LuxSync.*

---

## ANEXO A — Registro de cambios de la revisión 2

| Archivo | Naturaleza del cambio |
|---|---|
| `core/intelligence/types.ts` | `SectionClassification` ensanchado de 7 a los 10 estados MSST |
| `core/intelligence/sense/MusicalPatternSensor.ts` | Eliminado el tipo local de 7 estados y los colapsos con pérdida de `SECTION_MAP` (`bridge→breakdown`, `unknown→verse`) |
| `core/intelligence/liquid/CrestDetector.ts` | **NUEVO** — `CrestDetector` + `MultiBandCrestDetector` |
| `core/intelligence/liquid/FluidDescriptors.ts` | Π derivado del proceso de conteo; expuestos `crestEvent` / `crestRate` |
| `core/intelligence/liquid/LiquidCognitionCore.ts` | Propaga `rawEnergy` / `now` / `bandEnergies`; reexpone el flag de cresta |
| `core/intelligence/think/PredictionEngine.ts` | Cassandra 2.0 completa. Eliminados `PROGRESSION_PATTERNS`, `ProgressionPattern`, `sectionHistory`, `findMatchingPattern`, `matchesTrigger` |
| `core/intelligence/SeleneTitanConscious.ts` | Buffer de bandas pre-asignado `Float32Array(3)`; cablea `crestEvent` al Reloj Soberano |
| `core/intelligence/guards/SovereignClockGuard.ts` | Glass Break con corroboración de cresta (−0.5σ, suelo 2.0) |
| `core/intelligence/think/__tests__/Cassandra2.test.ts` | **NUEVO** — 12 casos: Markov 2.0 + detector de crestas |
| `core/intelligence/index.ts`, `think/index.ts` | Superficie pública: `observeSection`, `getCassandraState`, `onTrackChange` |

**Estado de verificación:** `tsc --noEmit` limpio salvo un error preexistente y ajeno
(`workers/hyperion-render.worker.ts:612`). Los 12 casos de `Cassandra2.test.ts` pasan. Los fallos
de suite en `dna/`, `dream/` e `integration/` son preexistentes y de causa ajena (manifiesto del
arsenal no generado en el entorno de test).
