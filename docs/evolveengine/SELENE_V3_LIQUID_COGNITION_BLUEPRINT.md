# 🌊 SELENE V3 — LIQUID COGNITION BLUEPRINT
## Arquitectura Cerebral de Cognición Fluídica para Inferencia Autónoma de Efectos

> **Autor:** FABLE — Chief AI Architect & Mathematician
> **Proyecto:** LuxSync — Genesis Selene Matrix (GSM)
> **Operación:** SELENE V3 — "LIQUID COGNITION"
> **Estado:** BLUEPRINT — Coeficientes pendientes de calibración Monte Carlo
> **Documentos base:** `SELENEV3-CONTEXT-PACK.md`, `OMNILIQUID-ENGINE-AUDIT.md`, `MAPEO-SELENE-COGNITION.md`

---

## ÍNDICE

1. [Manifiesto — Por Qué el Cerebro Debe Ser Líquido](#1-manifiesto)
2. [El Vector de Estado Fluídico Ψ(t)](#2-el-vector-de-estado-fluídico)
3. [Tensión Superficial Cognitiva — El Tidal Gate](#3-tensión-superficial-cognitiva)
4. [Inercia Cognitiva — Refractariedad Líquida](#4-inercia-cognitiva)
5. [Presión de Vapor — La Sed de Eventos](#5-presión-de-vapor)
6. [Sensor Fusion — La Ecuación de Confianza](#6-sensor-fusion)
7. [Ignition Chamber — Squelch y Materialización](#7-ignition-chamber)
8. [Agnosticismo Musical — El Espacio ΠMΔG](#8-agnosticismo-musical)
9. [Topología de Clases y Flujo de Datos](#9-topología-de-clases)
10. [Integración con el Pipeline Existente](#10-integración)
11. [Tabla Maestra de Coeficientes](#11-tabla-de-coeficientes)
12. [Telemetría y Calibración Monte Carlo](#12-telemetría-y-calibración)
13. [Plan de Demolición V2](#13-plan-de-demolición-v2)

---

## 1. MANIFIESTO

### 1.1 La Enfermedad de V2

El `DecisionMaker` V2 es una **cascada de guillotinas booleanas**. Auditando
`MAPEO-SELENE-COGNITION.md` contamos **20 mecanismos de veto** apilados
(Absolute Energy Gate, Spectral Gate, Anti-Fake-Drop, Valley Protection,
Breakdown Protection, Drop Lock, Refractory Lock, Global Cooldown,
Just-Fired Shield...). Cada gate nació como parche a un falso positivo
específico (WAVE 2200.2, 4860, 4861, 4864, 5000, 5018-B...).

El patrón patológico es siempre el mismo:

```
IF (zScore > 2.2) AND (energy > 0.48) AND (lowBand >= max×0.75) AND ... THEN Strike
```

Cada condición es un **precipicio binario**. Un track que produce
`zScore = 2.19` no dispara nada; `zScore = 2.21` dispara todo. El sistema no
tiene noción de *casi*. Y como los umbrales son estáticos, cada género nuevo
exige otra rama `if (isLatino)` — la entropía del código crece linealmente
con los géneros soportados.

**Síntomas documentados:** hipersensibilidad, ametrallamiento de efectos,
falsos positivos con autotune sostenido (el "Anti-Bad-Bunny" es un parche a
esto), y la necesidad de tablas de umbral por vibe (DIVINE: 4.0σ estándar /
2.5σ techno / 2.2σ latino) que nadie sabe recalibrar.

### 1.2 La Cura: Lo que el Omniliquid ya Demostró

El Omniliquid Engine (Área 6) resolvió el problema análogo en la capa física
tratando la luz como fluido. Sus tres comportamientos emergentes verificados:

| Propiedad física | En el Omniliquid (luz) | En Selene V3 (cognición) |
|------------------|------------------------|--------------------------|
| **Tensión superficial** | `gateOn + gateMargin + squelch` — la luz no "rompe" sin velocidad de ataque | El umbral de Épico escala con la historia — un clímax sostenido sube la barrera |
| **Inercia / Viscosidad** | `decayBase + decayRange × morph` — la luz resiste el cambio según densidad musical | El período refractario post-disparo se dilata en texturas densas |
| **Evaporación (Tidal)** | `avgPunchPeak × 0.993`, floor degrada en dry spells | El umbral épico se evapora en sequías — un golpe modesto tras un breakdown se siente épico |
| **Capilaridad (Ghost)** | Soft Knee: señal fantasma bajo el gate principal | Confianza sub-umbral acumula presión de vapor — anticipación en vez de amnesia |

La tesis de V3: **la decisión de disparar un efecto es un evento de ruptura
de tensión superficial en un fluido cognitivo**, no la salida de un árbol de
decisión.

### 1.3 Axiomas de Diseño

1. **Cero umbrales duros estáticos.** Toda barrera es una variable de estado con dinámica temporal propia.
2. **Cero booleanos en la ruta de decisión.** Los sensores emiten valores continuos en `(ε, 1]`; la fusión es multiplicativa (un sensor ≈ 0 veta *suavemente*, sin `if`).
3. **Cero etiquetas de género.** El fluido se caracteriza por descriptores espectrales continuos (§8), nunca por `vibeId` en la matemática. (El vibe sigue restringiendo el *arsenal* — qué efectos son elegibles — pero no la *física de la decisión*.)
4. **Determinismo absoluto.** Mismo `(inputs, now)` → misma decisión. Sin `Math.random()`. Compatible con el Axioma Anti-Simulación del Omniliquid.
5. **Zero-alloc en hot path.** Todo el estado son primitivos `number` pre-asignados. El presupuesto es ~60 ops de coma flotante por frame a 44 Hz.
6. **Los coeficientes son datos, no código.** Un solo `ILiquidCognitionProfile` (paralelo a `ILiquidProfile`) contiene todos los κ, τ y λ — calibrables por Monte Carlo sin tocar la clase.

---

## 2. EL VECTOR DE ESTADO FLUÍDICO

El cerebro V3 mantiene un único vector de estado — el **Fluido Cognitivo**:

```
Ψ(t) = ⟨ T(t), μ(t), V(t), X(t), Θ(t) ⟩
```

| Símbolo | Nombre | Rango | Semántica |
|---------|--------|-------|-----------|
| `T(t)` | **Tensión superficial** | [T_min, T_max] | Barrera de energía que un impacto debe romper para ser "Épico" |
| `μ(t)` | **Viscosidad** | [0, 1] | Densidad cognitiva del track — dilata la refractariedad |
| `V(t)` | **Presión de vapor** | [0, 1] | Sed acumulada de eventos durante sequías — rebaja el squelch |
| `X(t)` | **Excitabilidad** | [0, 1] | Recuperación post-disparo — reemplaza a los cooldowns binarios |
| `Θ(t)` | **Temperatura** | [0, 1] | Agitación media reciente del espectro — normaliza percepciones |

Los cinco escalares se actualizan **cada frame** (44 Hz) con ecuaciones en
diferencias de primer orden (EMAs y decays exponenciales — O(1), sin buffers
nuevos; reutilizan `RollingStats` existente para σ y máximos).

**La decisión final es un solo predicado continuo:**

```
IGNICIÓN ⟺ C(t) ≥ Q(t)
```

donde `C(t)` es la Confianza fusionada (§6) y `Q(t)` el Ignition Squelch (§7)
— ambos funciones de Ψ(t). No hay ninguna otra puerta en la ruta V3.

---

## 3. TENSIÓN SUPERFICIAL COGNITIVA
### (El Tidal Gate — Suelos Adaptativos)

### 3.1 El Impacto Normalizado I(t)

Primero definimos qué golpea la superficie. El **impacto** es la presión
instantánea que la música ejerce sobre el fluido:

```
I(t) = w_z · ẑ(t) + w_cf · CF̂(t) + w_e · Ê(t)          con w_z + w_cf + w_e = 1
```

- **ẑ(t)** — Z-Score saturado: `ẑ = tanh(z(t) / z_ref)`. El `tanh` elimina la
  necesidad del `maxZScoreCap = 10.0` de V2: outliers saturan orgánicamente.
  `z_ref ≈ 3.0` (punto de saturación al 76%).
- **CF̂(t)** — Factor de Cresta normalizado: la derivada temporal del impacto.
  ```
  CF(t)  = E_peak,w(t) / max(E_rms,w(t), ε)        ventana w ≈ 350 ms
  CF̂(t)  = clamp01((CF(t) − 1) / (CF_ref − 1))     CF_ref ≈ 3.5
  ```
  Un kick seco de Berghain produce CF ≈ 4-6 (transitorio puro). Un muro de
  autotune produce CF ≈ 1.1-1.4 (energía sostenida sin cresta). **Este único
  término reemplaza al Spectral Gate "Anti-Bad-Bunny" de V2** — la voz
  sostenida no tiene cresta, no importa cuánta energía tenga.
- **Ê(t)** — Energía líquida relativa: `Ê = rawEnergy / max(energyMaxHistoric, E_floor)`.
  Relativa al máximo de 30s, no absoluta — hereda el Absolute Energy Gate de
  V2 pero como término continuo, no como guillotina al 48%.

### 3.2 Dinámica de la Tensión T(t)

La tensión superficial es el umbral vivo que `I(t)` debe romper. Su ecuación
de evolución tiene **tres fuerzas**:

```
T(t+Δt) = T(t) + ΔT_rise − ΔT_evap − ΔT_relax
```

**(a) Endurecimiento por saturación (climax fatigue):**

Si la canción vive en el clímax, la superficie se endurece — lo extraordinario
sostenido se vuelve ordinario:

```
ΔT_rise = α_rise · max(0, I(t) − T(t)) · S(t)

S(t) = sigmoid_k( t_high(t) / τ_sat )          — exposición a saturación
t_high(t) = segundos continuos con Ê(t) > 0.70
```

`S(t)` es la clave anti-ametrallamiento: los primeros 2-3 segundos de clímax
casi no suben la tensión (S ≈ 0.1), pero a los 15 segundos S ≈ 0.9 y cada
frame de clímax empuja la barrera hacia arriba. **Para romperla entonces se
necesita un impacto genuinamente masivo** — exactamente la directiva.

**(b) Evaporación por sequía (dry spell / tidal):**

Espejo del Tidal Gate del Omniliquid (`avgPunchPeak × 0.993 → 0.985`):

```
ΔT_evap = λ_evap(t) · (T(t) − T_min)

λ_evap(t) = λ_0 · ( 1 + κ_d · D(t) / (D(t) + D_half) )
D(t) = segundos desde la última ignición (o desde el último I > T·0.8)
```

La tasa de evaporación crece hiperbólicamente con la sequía y satura en
`λ_0·(1+κ_d)`. Tras un breakdown de 20 segundos, `T` ha caído hacia `T_min` y
**un golpe modesto rompe la superficie y se siente épico** — la segunda
directiva, sin ningún `if (isBreakdown)`.

**(c) Relajación homeostática:**

```
ΔT_relax = λ_home · (T(t) − T_eq(t))
T_eq(t)  = T_base + κ_σ · σ̂_E(t)
```

donde `σ̂_E` es la desviación estándar del buffer de 30s (de `RollingStats`),
normalizada. Un track muy dinámico (σ alta) mantiene una tensión de equilibrio
más alta que un track plano. **Esto absorbe las tablas de umbral por vibe de
V2:** el techno (Z plano, σ baja) converge naturalmente a T_eq baja ≈ el
antiguo 2.2σ; el dembow (σ inflada) converge a T_eq alta ≈ el antiguo 3.5σ.
Nadie codificó "latino" — la estadística del fluido lo descubre sola.

### 3.3 El Evento Épico

```
epicness(t) = max(0, I(t) − T(t)) / T(t)          — ruptura relativa
isEpicBreach = epicness(t) > 0                     — derivado, no gate
```

`epicness` es un escalar continuo que entra a la fusión (§6) como el sensor
más potente, y modula la intensidad del efecto materializado (§7). El
"DIVINE MOMENT" de V2 deja de ser una rama especial: es simplemente la región
`epicness > ε_divine` del mismo continuo.

---

## 4. INERCIA COGNITIVA
### (Refractariedad Líquida — Cooldowns Morfológicos)

### 4.1 Viscosidad μ(t)

La viscosidad mide la **densidad cognitiva** de la textura musical. Se deriva
exclusivamente de descriptores espectrales (nunca del vibe):

```
μ(t) = clamp01( w_m · M(t) + w_f · flatness(t) + w_h · harmonicDensity(t) − w_p · Π(t) )
```

- **M(t)** — Melodicidad: EMA del contenido mid ponderado (idéntico en
  espíritu al `morphFactor` del Omniliquid: `clamp((avgMid − 0.30)/0.40)`).
- **flatness** — `spectralFlatness` del estado estabilizado: ruido/muro de sonido.
- **harmonicDensity** — densidad armónica del patrón.
- **Π(t)** — Percusividad (§8): *resta* viscosidad. Un track staccato limpio
  fluye rápido.

Interpretación:

| Textura | μ típica | Comportamiento |
|---------|----------|----------------|
| Techno staccato limpio | 0.10-0.25 | Fluido acuoso — transitorios rápidos permitidos |
| Pop-rock wall of sound | 0.55-0.75 | Miel — el cerebro se espesa |
| Pad latino denso / autotune | 0.70-0.90 | Brea — refractariedad máxima |

### 4.2 Excitabilidad X(t) — La Muerte del Cooldown

V2 usa cooldowns binarios (7000ms base × mood multiplier + Just-Fired Shield
2000ms + Refractory Lock 4000ms — tres sistemas superpuestos). V3 los unifica
en **una sola curva de recuperación neuronal**:

```
X(t) = 1 − exp( −(t − t_fire) / τ_r(t) )

τ_r(t) = τ_min + (τ_max − τ_min) · μ(t) · (0.5 + I_last)
```

- `t_fire` = timestamp de la última ignición.
- `I_last` = intensidad del último efecto disparado ∈ [0,1]. Un efecto divino
  a intensidad 1.0 produce τ_eff = 1.5× el refractario base; un shimmer suave
  a 0.3 apenas 0.8×.
- `μ(t)` — la viscosidad dilata la recuperación: en brea (μ=0.9) el mismo
  τ base se multiplica ~×0.95+; en agua (μ=0.15) ~×0.57.

**Propiedad crítica:** X(t) nunca es 0 ni 1 de golpe. A los 2 segundos de un
disparo en techno, X ≈ 0.55 — un evento *extraordinario* (C alta) todavía
puede disparar porque X multiplica en la fusión en vez de vetar. A los mismos
2 segundos en un pad denso, X ≈ 0.25 — se necesitaría un impacto colosal.
**El ametrallamiento muere no por prohibición sino por atenuación geométrica.**

> **Nota de preservación:** `HARD_COOLDOWN` del ArsenalRepository permanece
> como ley absoluta *fuera* del fluido (es protección de hardware/época,
> no cognición). Igual que el Manual Hard Lock L2. Ver §10.

---

## 5. PRESIÓN DE VAPOR
### (La Sed — Capilaridad Cognitiva)

El dual de la evaporación de T: mientras la tensión *baja* en sequía, la
presión de vapor *sube* — el fluido acumula ganas de evento:

```
V(t+Δt) = clamp01( V(t) + β_v · Δt · 1[sin ignición] · (1 − Ê(t)) )
V(t)    → V(t) · κ_vreset        al momento de ignición   (κ_vreset ≈ 0.15)
```

El término `(1 − Ê)` es deliberado: la sed solo crece en valles reales.
Un clímax sin disparos NO acumula vapor (eso sería re-crear la
hipersensibilidad).

**Efecto:** V rebaja el Ignition Squelch (§7) y aporta un bonus de intensidad
sutil. Es la versión cognitiva del **Soft Knee Ghost Path** del Omniliquid:
la anticipación sub-umbral no se descarta, se acumula como presión. Tras un
breakdown largo, `V ≈ 0.8` + `T` evaporada = el primer kick del drop rompe
la superficie con violencia catártica. Exactamente lo que siente la pista.

---

## 6. SENSOR FUSION
### (Decisiones No-Newtonianas — La Ecuación de Confianza)

### 6.1 La Forma General

La confianza es una **media geométrica ponderada** de sensores — computada en
dominio logarítmico para estabilidad numérica y zero-alloc:

```
ln C(t) = Σᵢ wᵢ · ln sᵢ(t)              con Σᵢ wᵢ = 1,  sᵢ ∈ [ε, 1],  ε = 0.01

⟹  C(t) = Πᵢ sᵢ(t)^wᵢ
```

**Por qué geométrica y no aritmética:** la media geométrica es
*no-compensatoria cerca de cero*. Si el filtro anti-voz dice `s_V = 0.05`
(esto es voz, no beat), ninguna suma de otros sensores lo compensa — la
confianza colapsa. Pero no hay `if`: un sensor en 0.4 solo *atenúa*. Es un
AND difuso con gradiente continuo. Los 20 vetos booleanos de V2 se convierten
en 7 factores multiplicativos.

### 6.2 Los Siete Sensores

```
C(t) = s_DNA^w1 · s_Z^w2 · s_E^w3 · s_V^w4 · s_X^w5 · s_P^w6 · s_B^w7
```

**s_DNA — Afinidad Genómica (el alma del efecto):**

Kernel gaussiano en el cubo ACO (`FrozenGenome`):

```
g_ctx(t) = ⟨ aggression: Ê·CF̂,  chaos: Δ(t),  organicity: 1−Π(t) ⟩
s_DNA    = exp( −‖g_fx − g_ctx‖² / (2σ_g²) )
```

El contexto musical se proyecta al mismo espacio genómico que los efectos.
Un `industrial_strobe` (A=0.9, C=0.7, O=0.1) tiene afinidad alta cuando el
fluido está agresivo-caótico-mecánico. La selección de arsenal deja de ser
`compatibleVibes.includes(vibe)` + diversity ranking: es distancia geométrica
pura (el vibe sigue filtrando la *lista elegible*, pero el *ranking* es ACO).

**s_Z — Anomalía Normalizada por Tensión:**

```
s_Z = σ_k( κ_z · ( I(t)/T(t) − 1 ) + b_z )        σ_k = sigmoide logística
```

Nótese la elegancia: el Z-Score no se compara contra un umbral estático sino
contra la **tensión superficial viva**. `I/T = 1` es el punto de ruptura →
s_Z = σ(b_z) ≈ 0.5. Ruptura franca (I/T = 1.5) → s_Z ≈ 0.9.

**s_E — Energía Líquida:**

```
s_E = Ê(t)^γ_e          γ_e ≈ 0.7  (compresión — misma familia que crushExponent)
```

**s_V — Filtro Espectral Anti-Voz (el exorcista del autotune):**

```
vocalDominance = σ_k( κ_v · ( mid/(bass+ε) − ρ_v ) ) · ( 1 − CF̂(t) )
s_V            = 1 − κ_vmax · vocalDominance
```

Doble evidencia: dominancia del mid sobre el bass (firma de voz) **y**
ausencia de cresta (energía sostenida). Un rapero a capela: mid alto + CF
bajo → vocalDominance ≈ 0.9 → s_V ≈ 0.28 → la confianza colapsa
geométricamente. Un drop con voz *y* kick pesado: CF alto → `(1−CF̂) ≈ 0.2`
→ vocalDominance amortiguada → el drop pasa. **Anti-Bad-Bunny sin conocer
la palabra "latino".**

**s_X — Excitabilidad (§4.2):** entra directa. `w5` controla cuán punitiva
es la refractariedad.

**s_P — Prior de Cassandra:**

```
s_P = 0.5 + 0.5 · P_aligned(t)
P_aligned = prediction.probability · alignment(prediction.type, fase actual)
```

Cassandra nunca veta (mínimo 0.5) — solo *amplifica* hasta 2× en dominio
log cuando el Oráculo predijo este momento. El Sovereign Clock y Glass Break
permanecen fuera del fluido (§10) como bypass de latencia.

**s_B — Belleza y Consonancia (el esteta):**

```
s_B = 0.6 + 0.4 · ( 0.6 · totalBeauty + 0.4 · consonance )
```

Suavemente modulador (rango [0.6, 1.0]), nunca dominante. La belleza inclina,
no decide.

### 6.3 Propiedades Emergentes de la Fusión

1. **Reología no-newtoniana:** la "resistencia al disparo" del sistema no es
   constante — depende de la tasa de cambio del estímulo. Impactos con cresta
   alta (shear rápido) encuentran un fluido que se *adelgaza* (s_Z y s_DNA
   suben juntos); presión sostenida sin cresta encuentra un fluido que se
   *espesa* (S(t) sube T, s_V castiga). Es un fluido dilatante al autotune
   y pseudoplástico al kick. De ahí el nombre: **decisiones no-newtonianas**.
2. **Ningún sensor conoce el género.** Todos operan sobre descriptores
   espectrales y estado fluídico.
3. **Grados de libertad acotados:** 7 pesos wᵢ (6 libres) + ~10 κ. Un espacio
   calibrable por Monte Carlo en horas, no días.

---

## 7. IGNITION CHAMBER
### (Squelch Adaptativo y Materialización)

### 7.1 El Umbral de Ignición Q(t)

```
Q(t) = Q_base · ( 1 + κ_T · T̂(t) ) · ( 1 − κ_V · V(t) )

T̂(t) = (T(t) − T_min) / (T_max − T_min)         — tensión normalizada
```

El squelch respira con el fluido: tensión alta (clímax sostenido) lo sube
hasta `Q_base·(1+κ_T)`; sed alta (sequía) lo rebaja hasta `Q_base·(1−κ_V)`.
Con `Q_base ≈ 0.45, κ_T ≈ 0.5, κ_V ≈ 0.4`: rango efectivo [0.27, 0.68].

### 7.2 El Predicado Único

```
IGNICIÓN ⟺ C(t) ≥ Q(t)
```

Eso es todo. No hay jerarquía de 13 pasos. La jerarquía V2
(DIVINE > DNA > Hunt > Drop > Buildup > Hold) **emerge** del continuo:

| Situación V2 | En V3 |
|--------------|-------|
| DIVINE MOMENT | `epicness > ε_divine` → s_Z ≈ 1, C rompe Q con margen enorme → intensidad máxima + arsenal divino |
| DNA Strike | s_DNA alta domina la fusión |
| Hunt worthiness | absorbido por s_Z + s_B (el worthiness era una fusión aritmética primitiva) |
| Valley Protection | Ê ≈ 0.1 → s_E ≈ 0.20 → C colapsa geométricamente. Sin gate |
| Breakdown Protection | ídem + S(t)=0 mantiene T evaporándose para el drop que viene |
| Hold (silencio) | `C < Q` — el estado natural del fluido en reposo |

### 7.3 Intensidad Materializada

La intensidad del efecto es función del **exceso de ruptura**:

```
I_fx = I_min + (1 − I_min) · tanh( κ_i · (C − Q) / Q ) + κ_vb · V(t)
I_fx = clamp(I_fx, I_min, 1.0)
```

- Ruptura marginal (C = Q+ε): efecto sutil ≈ I_min (0.35).
- Ruptura épica (C = 2Q): tanh satura → intensidad plena.
- El bonus de vapor `κ_vb·V` (≈ +0.1 máx) hace que el primer efecto tras
  la sequía golpee más fuerte — catarsis.

### 7.4 Selección de Efecto (Post-Ignición)

La ignición decide *cuándo*; el genoma decide *qué*:

```
candidato* = argmax_{fx ∈ elegibles(vibe, section, energyZone)} [ s_DNA(fx) · fresh(fx) ]

fresh(fx) = 1 − κ_rep · exp( −(t − t_lastUse(fx)) / τ_novelty )
```

`fresh` hereda el diversity-aware ranking de WAVE 2183 como decay exponencial
continuo. El pipeline ético (VisualConscienceEngine) y el `HARD_COOLDOWN`
se aplican al candidato ganador — si lo bloquean, **silencio** (Fallthrough
Abolished se preserva: WAVE 2111 es doctrina, no implementación).

---

## 8. AGNOSTICISMO MUSICAL
### (El Espacio ΠMΔG — Género como Punto, no como Etiqueta)

Todo coeficiente que en V2 era una tabla por vibe se convierte en función
lineal de **cuatro descriptores fluídicos continuos**, todos derivables del
`TitanStabilizedState` + `SeleneMusicalPattern` existentes:

| Eje | Nombre | Derivación | Rango |
|-----|--------|-----------|-------|
| **Π** | Percusividad | EMA de densidad de transitorios (tasa de crestas CF > 2 por segundo, normalizada) | [0,1] |
| **M** | Melodicidad | EMA del mid ponderado (≡ morphFactor del Omniliquid) | [0,1] |
| **Δ** | Suciedad | `harshness × (0.5 + 0.5·spectralFlatness)` | [0,1] |
| **G** | Groove | `syncopation` del patrón | [0,1] |

Los géneros existentes son **puntos** en este espacio (medidos, no declarados):

```
Techno industrial  ≈ ⟨Π=0.85, M=0.25, Δ=0.55, G=0.15⟩
Dembow/reggaetón   ≈ ⟨Π=0.60, M=0.65, Δ=0.35, G=0.80⟩
Pop-rock live      ≈ ⟨Π=0.50, M=0.70, Δ=0.70, G=0.35⟩
Chill lounge       ≈ ⟨Π=0.15, M=0.55, Δ=0.10, G=0.30⟩
```

Cualquier coeficiente contextual se expresa como blend:

```
κ(t) = κ_0 + κ_Π·Π(t) + κ_M·M(t) + κ_Δ·Δ(t) + κ_G·G(t)
```

**Ejemplo — el peso del filtro anti-voz w4:** en vez de "activar Spectral
Gate solo si latino" (V2), `w4 = w4_0 + w4_M·M + w4_G·G` — sube orgánicamente
donde hay melodía vocal y groove sincopado, que es *la firma medible* de la
música vocal-céntrica. Un track de jazz vocal que jamás fue etiquetado
recibe la misma protección que el reggaetón. **El género muere; la textura
reina.**

Los cuatro ejes se actualizan por EMA lenta (τ ≈ 8s) — son la "composición
química" del fluido, no su agitación instantánea.

---

## 9. TOPOLOGÍA DE CLASES

### 9.1 Estructura de Módulos

```
electron-app/src/core/intelligence/liquid/
├── LiquidCognitionCore.ts        — Orquestador. process(inputs) → LiquidVerdict
├── CognitiveFluidState.ts        — Ψ(t): 5 escalares + update(Δt). Zero-alloc
├── TidalGate.ts                  — T(t): rise/evaporación/homeostasis (§3)
├── ViscosityMeter.ts             — μ(t) + X(t): refractariedad líquida (§4)
├── VaporChamber.ts               — V(t): presión de sed (§5)
├── SensorFusionChamber.ts        — ln C = Σ wᵢ ln sᵢ  (§6)
├── IgnitionChamber.ts            — Q(t), predicado, I_fx, selección ACO (§7)
├── FluidDescriptors.ts           — Π, M, Δ, G (§8)
├── ILiquidCognitionProfile.ts    — TODOS los coeficientes, readonly, pura data
└── LiquidTelemetry.ts            — snapshot por frame para Monte Carlo (§12)
```

### 9.2 Contratos Clave

```typescript
/** Estado del fluido cognitivo — 100% primitivos, zero-alloc */
export interface FluidStateSnapshot {
  readonly tension: number          // T(t)
  readonly viscosity: number        // μ(t)
  readonly vaporPressure: number    // V(t)
  readonly excitability: number     // X(t)
  readonly temperature: number      // Θ(t)
  readonly impact: number           // I(t)
  readonly crestFactor: number      // CF̂(t)
  readonly epicness: number         // max(0, I−T)/T
}

/** Descriptores del espacio agnóstico */
export interface FluidDescriptors {
  readonly percussiveness: number   // Π
  readonly melodicity: number       // M
  readonly dirtiness: number        // Δ
  readonly groove: number           // G
}

/** Veredicto del fluido — reemplaza la cascada del DecisionMaker */
export interface LiquidVerdict {
  readonly ignite: boolean          // C ≥ Q — el ÚNICO predicado
  readonly confidence: number       // C(t)
  readonly squelch: number          // Q(t)
  readonly intensity: number        // I_fx (0 si !ignite)
  readonly epicness: number         // para ruteo a arsenal divino
  readonly sensors: SensorReadout   // los 7 sᵢ para debug/telemetría
  readonly fluid: FluidStateSnapshot
  readonly reasoning: string        // humano-legible, throttled
}

export interface SensorReadout {
  readonly dna: number; readonly anomaly: number; readonly energy: number
  readonly antiVocal: number; readonly excitability: number
  readonly oracle: number; readonly aesthetics: number
}

/** El núcleo — API de un solo método */
export class LiquidCognitionCore {
  constructor(profile: ILiquidCognitionProfile)
  /** Hot path 44Hz. Sin allocs. Determinista dado (inputs, now). */
  process(inputs: DecisionInputs, now: number): LiquidVerdict
  /** Notificación de disparo materializado (actualiza t_fire, I_last, V reset) */
  notifyIgnition(intensity: number, now: number): void
  reset(): void
  getTelemetry(): LiquidTelemetryFrame
}
```

### 9.3 Flujo de Datos V3

```
TitanStabilizedState ──→ SENSE (sin cambios: sensores + Z + Cassandra)
                              │
                              ▼
                    DecisionInputs (contrato existente, intacto)
                              │
                              ▼
              ┌─────────────────────────────────┐
              │  LiquidCognitionCore.process()  │
              │                                 │
              │  1. FluidDescriptors (Π,M,Δ,G)  │  ← EMA lenta 8s
              │  2. Impact I(t) + CF̂(t)         │  ← ventana 350ms
              │  3. TidalGate → T(t)            │  ← rise/evap/homeo
              │  4. ViscosityMeter → μ, X       │
              │  5. VaporChamber → V            │
              │  6. SensorFusion → ln C         │  ← 7 sensores
              │  7. IgnitionChamber → Q, I_fx   │
              │                                 │
              │  LiquidVerdict                  │
              └────────────┬────────────────────┘
                           ▼
         ignite? ──NO──→ HOLD (silencio, físicas reactivas mandan)
            │
           YES
            ▼
   Selección ACO (argmax s_DNA·fresh sobre arsenal elegible)
            ▼
   VisualConscienceEngine (ética) + HARD_COOLDOWN (ley absoluta)
            ▼                          │ bloqueado → SILENCIO (WAVE 2111)
   ConsciousnessOutput (contrato existente, intacto)
```

---

## 10. INTEGRACIÓN

### 10.1 Qué se Preserva (Fuera del Fluido)

| Mecanismo | Razón |
|-----------|-------|
| **Cassandra Sovereign Clock + Glass Break** | Bypass de latencia — armar efectos con antelación es ortogonal a decidir. El fluido alimenta s_P; el Clock dispara pre-buffers |
| **EnergyOverride (E > 0.75)** | Doctrina física: "en los drops, la física manda". V3 no piensa durante el clímax absoluto — coherente con el veto V2 |
| **Manual Hard Lock L2** | El operador es ley. Nunca negociable |
| **HARD_COOLDOWN (ArsenalRepository)** | Protección de hardware/época del efecto, no cognición |
| **ConstitutionGuard** | Validación cromática post-decisión |
| **VisualConscienceEngine** | Ética post-selección |
| **Fallthrough Abolished** | Doctrina: candidato bloqueado → silencio |
| **SENSE completo** | MusicalPatternSensor, BeautySensor, RollingStats, Cassandra — el fluido consume sus salidas |

### 10.2 Qué se Extirpa (Absorbido por el Fluido)

| Víctima V2 | Absorbido por |
|------------|---------------|
| DIVINE thresholds por vibe (4.0/2.5/2.2σ) | T(t) homeostática + epicness |
| Absolute Energy Gate (0.60/0.48 ratios) | Ê dentro de I(t) y s_E |
| Spectral Gate Anti-Bad-Bunny | s_V (anti-voz por CF + mid/bass) |
| Anti-Fake-Drop Z sanity (1.1/0.5/0.2σ) | s_Z normalizado por T(t) |
| Valley/Breakdown Protection | Colapso geométrico de s_E |
| Global Cooldown + Just-Fired + Refractory | X(t) — una sola curva |
| FuzzyDecisionMaker (1135 líneas) | La fusión ES la lógica difusa, con álgebra honesta |
| HuntEngine worthiness + VIBE_STRIKE_MATRIX | s_Z, s_B, s_DNA |
| Drop Lock (uno por drop) | S(t) endurece T tras la ruptura — re-romper cuesta más |
| Tablas mood multiplier sobre cooldowns | mood escala τ_r y Q_base (2 números, no 3 sistemas) |

**Balance estimado:** ~3.300 líneas de gates V2 (FuzzyDecisionMaker 1135 +
HuntEngine 836 + mitad del DecisionMaker 660 + DropBridge 425 + parches) →
~900 líneas de fluido V3 parametrizado.

### 10.3 Estrategia de Convivencia (Shadow Mode)

Fase 1: `LiquidCognitionCore` corre **en paralelo** dentro de
`SeleneTitanConscious.process()`, emitiendo telemetría sin autoridad.
El campo `debugInfo.liquidVerdict` expone C, Q, Ψ por frame. Se comparan
decisiones V2 vs V3 sobre sesiones reales (Brejcha, dembow, rock, chill).
Fase 2: flag `SELENE_V3_AUTHORITY` conmuta la autoridad. Fase 3: demolición.

---

## 11. TABLA DE COEFICIENTES

Todos viven en `ILiquidCognitionProfile` — pura data, calibrable sin recompilar.
Valores iniciales = priors razonados; rangos = espacio de búsqueda Monte Carlo.

### Tensión Superficial (§3)

| Coef | Inicial | Rango MC | Semántica |
|------|---------|----------|-----------|
| `T_min / T_max` | 0.30 / 0.85 | ±0.15 | Suelo/techo de la barrera épica |
| `T_base` | 0.50 | [0.35, 0.65] | Tensión de equilibrio base |
| `κ_σ` | 0.35 | [0.1, 0.6] | Acople dispersión→equilibrio |
| `α_rise` | 0.04 | [0.01, 0.10] | Endurecimiento por frame de clímax |
| `τ_sat` | 6 s | [3, 15] | Vida media de la saturación S(t) |
| `λ_0` | 0.008 | [0.002, 0.02] | Evaporación base por frame |
| `κ_d / D_half` | 2.5 / 8 s | [1,4] / [4,16] | Ganancia/semisaturación de sequía |
| `λ_home` | 0.015 | [0.005, 0.04] | Relajación homeostática |
| `w_z / w_cf / w_e` | 0.45/0.30/0.25 | simplex | Composición del impacto I(t) |
| `z_ref / CF_ref` | 3.0 / 3.5 | [2,4] / [2.5,5] | Puntos de saturación |

### Inercia y Vapor (§4-5)

| Coef | Inicial | Rango MC | Semántica |
|------|---------|----------|-----------|
| `τ_min / τ_max` | 1.5 s / 9 s | [1,3] / [6,15] | Refractariedad agua/brea |
| `w_m / w_f / w_h / w_p` | 0.40/0.25/0.20/0.30 | [0,0.6] | Composición de μ |
| `β_v` | 0.03 /s | [0.01, 0.08] | Tasa de acumulación de sed |
| `κ_vreset` | 0.15 | [0, 0.4] | Vapor residual post-ignición |

### Fusión e Ignición (§6-7)

| Coef | Inicial | Rango MC | Semántica |
|------|---------|----------|-----------|
| `w1..w7` | 0.22/0.20/0.15/0.15/0.12/0.08/0.08 | simplex | Pesos de sensores |
| `σ_g` | 0.35 | [0.2, 0.6] | Anchura del kernel ACO |
| `κ_z / b_z` | 4.0 / 0.0 | [2,8] / [−1,1] | Pendiente/bias de s_Z |
| `γ_e` | 0.7 | [0.4, 1.0] | Compresión de energía |
| `κ_v / ρ_v / κ_vmax` | 5.0 / 1.6 / 0.75 | — | Filtro anti-voz |
| `Q_base` | 0.45 | [0.30, 0.60] | Squelch de reposo |
| `κ_T / κ_V` | 0.50 / 0.40 | [0.2, 0.8] | Respiración del squelch |
| `I_min / κ_i / κ_vb` | 0.35 / 2.0 / 0.10 | — | Materialización de intensidad |
| `κ_rep / τ_novelty` | 0.6 / 45 s | — | Frescura del arsenal |
| `ε_divine` | 0.25 | [0.1, 0.5] | Ruptura mínima para arsenal divino |

---

## 12. TELEMETRÍA Y CALIBRACIÓN

### 12.1 LiquidTelemetryFrame

Cada frame, el núcleo emite (ring buffer de 2700 frames ≈ 60s, volcado a
JSONL bajo demanda — patrón idéntico a `LiquidEngine41Telemetry`):

```
{ t, I, T, CF, μ, X, V, Q, C, s1..s7, Π, M, Δ, G, ignite, intensity, epicness }
```

### 12.2 Protocolo Monte Carlo

1. **Corpus:** sesiones grabadas etiquetadas a mano — timestamps de "aquí
   DEBERÍA disparar" (ground truth de un LJ humano) sobre ≥4 géneros.
2. **Función de coste:**
   ```
   J = w_fp·FP + w_fn·FN + w_j·Jitter + w_epm·|EPM − EPM_target|²
   ```
   FP = igniciones fuera de ventanas ground-truth; FN = ventanas sin ignición;
   Jitter = varianza del intervalo entre efectos; EPM_target ≈ 3-4
   efectos/minuto (doctrina BALANCED).
3. **Búsqueda:** CMA-ES o simulated annealing sobre los ~30 coeficientes
   (los simplex se muestrean con Dirichlet). El motor es determinista →
   cada evaluación es un replay exacto, paralelizable.
4. **Validación cruzada por género:** calibrar en 3 géneros, validar en el
   4to. Si el coste generaliza, el agnosticismo es real y no memorizado.

---

## 13. PLAN DE DEMOLICIÓN V2

| Fase | Alcance | Riesgo |
|------|---------|--------|
| **V3.0** | `liquid/` completo + shadow mode + telemetría | Cero (sin autoridad) |
| **V3.1** | Calibración MC sobre corpus + tuning de pesos | Cero |
| **V3.2** | `SELENE_V3_AUTHORITY` on: LiquidVerdict decide; DecisionMaker degradado a traductor Verdict→ConsciousnessOutput | Medio — rollback por flag |
| **V3.3** | Extirpación: FuzzyDecisionMaker, VIBE_STRIKE_MATRIX, DropBridge (thresholds), gates §10.2. HuntEngine queda solo como generador de candidatos | Alto — punto de no retorno |
| **V3.4** | Mood re-mapeado: CALM/BALANCED/PUNK = 3 presets de `(Q_base, τ_r scale)` | Bajo |

---

## CODA — LA FRASE QUE RESUME EL DISEÑO

> V2 preguntaba: *"¿pasó todas las aduanas?"* — veinte funcionarios con sellos.
> V3 pregunta: *"¿rompió la superficie?"* — una sola ley física con memoria.
>
> La música ejerce presión. El fluido acumula tensión, viscosidad y sed.
> Cuando la presión rompe la tensión, la luz golpea con la fuerza exacta
> del exceso. Cuando no, el silencio es la respuesta correcta del agua.

*Fin del Blueprint — SELENE V3: LIQUID COGNITION.*
*Coeficientes sujetos a calibración Monte Carlo (§12). La topología es la tesis.*
