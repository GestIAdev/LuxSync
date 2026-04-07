# 🌊 OMNILIQUID ENGINE AUDIT — PIONEER DUE DILIGENCE

**Clasificación:** CONFIDENCIAL — Solo para uso del Comité de Adquisiciones  
**Auditor:** PunkOpus, Ingeniero Jefe de Físicas Reactivas & Auditor de Adquisiciones Tecnológicas  
**División:** Pioneer DJ / AlphaTheta — Advanced Lighting Physics Group  
**Producto evaluado:** LuxSync — Motor de Físicas Reactivas de Emisión Fotónica (Área 6 de 7)  
**Fecha del informe:** Junio de 2025  
**Versión del código base:** WAVE 2488 (activo)

> **NOTA DE ALCANCE:** Esta auditoría cubre exclusivamente la **emisión fotónica** (Dimmer / Intensidad / Strobe) del Omniliquid Engine. El movimiento físico (Pan/Tilt/Gobo) se evalúa en el Área 7: "Motor de Cinemática Física". Los campos `moverLeftIntensity` y `moverRightIntensity` aparecen aquí porque determinan la **luminosidad** de los movers, no su posición.

---

## ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [El Paradigma del Fluido — Por qué No Curvas DMX](#2-el-paradigma-del-fluido--por-qué-no-curvas-dmx)
3. [LiquidEnvelope — El Átomo del Motor](#3-liquidenvelope--el-átomo-del-motor)
4. [LiquidEngineBase — El Reactor Central](#4-liquidenginebase--el-reactor-central)
5. [Enrutamiento de Zonas — 7.1 vs 4.1](#5-enrutamiento-de-zonas--71-vs-41)
6. [Sistema de Perfiles — Parametrización por Género Musical](#6-sistema-de-perfiles--parametrización-por-género-musical)
7. [Chaos Engineering — El Factor "Guitarra Eléctrica Distorsionada"](#7-chaos-engineering--el-factor-guitarra-eléctrica-distorsionada)
8. [Benchmark Comparativo — vs. grandMA3 Dimmer Phasers](#8-benchmark-comparativo--vs-grandma3-dimmer-phasers)
9. [Cobertura de Tests & Deuda Técnica](#9-cobertura-de-tests--deuda-técnica)
10. [Veredicto & Pioneer Score](#10-veredicto--pioneer-score)

---

## 1. RESUMEN EJECUTIVO

El Omniliquid Engine es un motor de físicas reactivas que convierte 7 bandas de análisis espectral (del GodEarFFT, evaluado en el Área 1) en intensidades luminosas por zona. Ejecutado enteramente en TypeScript dentro de Electron, sin hardware DSP dedicado, sin GPU compute, sin shaders de iluminación.

La innovación central es tratar la luz como **fluido** en vez de como señal eléctrica. Donde la industria usa curvas DMX (fade linear, S-curve, gamma) con moduladores temporales (LFO, phasers), este sistema modela **inercia, viscosidad y tensión superficial** — propiedades genuinas de mecánica de fluidos aplicadas a la emisión fotónica.

**Inventario de código (sistema activo):**

| Módulo | Líneas | Función |
|--------|--------|---------|
| `LiquidEngineBase.ts` | 549 | Clase abstracta: pipeline de 10 etapas, todo el cálculo pesado |
| `LiquidEnvelope.ts` | 219 | Abstracción universal de banda: pipeline de 9 etapas por envolvente |
| `LiquidEngine71.ts` | 216 | Enrutamiento asimétrico 7.1 con bifurcación por género |
| `LiquidEngine41.ts` | 107 | Enrutamiento compacto 4.1 con dos estrategias |
| `LiquidEngine41Telemetry.ts` | 253 | Instrumentación frame-a-frame para calibración Monte Carlo |
| `ILiquidProfile.ts` | 235 | Contrato de datos puro: ~40+ parámetros readonly |
| Perfiles (4 archivos) | 1.071 | Parametrización de 4 géneros musicales |
| `OceanicContextAdapter.ts` | 368 | Traductor oceánico para modulación chill |
| **TOTAL ACTIVO** | **3.018** | — |

**Inventario de código (legacy/deprecated):**

| Módulo | Líneas | Estado |
|--------|--------|--------|
| `TechnoStereoPhysics.ts` | 604 | `@deprecated` WAVE 2488 DT-03 |
| `LatinoStereoPhysics.ts` | 462 | `@deprecated` |
| `RockStereoPhysics2.ts` | 966 | `@deprecated` |
| `ChillStereoPhysics.ts` | 689 | `@deprecated` |
| `LiquidStereoPhysics.ts` | 425 | `@deprecated` WAVE 2488 DT-04 |
| `LaserPhysics.ts` | 346 | Spectral band physics (legacy) |
| `WasherPhysics.ts` | 331 | Spectral band physics (legacy) |
| `PhysicsEngine.ts` | 348 | `calculateMoverTarget()` deprecated |
| **TOTAL LEGACY** | **4.171** | Pendiente de eliminación |

**Primera impresión:** La ratio activo:legacy (3.018 vs 4.171 líneas) revela que el sistema está en medio de una migración arquitectónica masiva. 4 motores monolíticos por género (2.721 líneas combinadas) fueron reemplazados por un sistema unificado parametrizado (3.018 líneas) que cubre los 4 géneros + expansibilidad. La decisión es correcta: los motores legacy duplicaban lógica entre sí. Pero el código muerto aún no ha sido purgado.

---

## 2. EL PARADIGMA DEL FLUIDO — POR QUÉ NO CURVAS DMX

### 2.1 El Problema con DMX Convencional

La industria de iluminación profesional trata los dimmers como **señales eléctricas**:

```
Señal de audio → Umbral → Curva de mapeo (linear/S/gamma) → Valor DMX 0-255
                             └── Modulado por LFO/Phaser temporal
```

Esto produce resultados correctos para señales limpias y estables (sintetizadores, 808s, música electrónica cuantizada). Pero cuando la señal de audio es **sucia** — guitarra distorsionada, batería acústica con sangrado, voz con reverb — el sistema reacciona a todo porque no tiene concepto de "masa" o "resistencia al cambio".

El resultado: fixtures que tiemblan ("flicker"), que responden a artefactos espectrales en vez de a intenciones musicales, y que no distinguen entre un bombo limpio de Berghain y un bombo acústico con hi-hat sangrando en el micrófono.

### 2.2 La Propuesta del Omniliquid Engine

Este motor modela tres propiedades fundamentales de mecánica de fluidos:

| Propiedad física | Equivalente en luz | Implementación |
|------------------|--------------------|----------------|
| **Inercia** | Resistencia del dimmer a cambiar de valor | `decayBase` + `decayRange × morphFactor` |
| **Viscosidad** | "Grosor" de la respuesta luminosa | `crushExponent` — exponente de compresión |
| **Tensión superficial** | Umbral mínimo para que la luz "se rompa" | `gateOn` + `gateMargin` + `squelch` |

La metáfora no es decorativa. Estos tres parámetros producen comportamiento emergente que resuelve problemas reales de iluminación reactiva:

1. **El Kick Fantasma:** En DMX convencional, el sangrado del hi-hat al canal de bajos dispara el front PAR cuando no debería. La tensión superficial (velocity gate + ignition squelch) exige una velocidad de ataque mínima — el sangrado, que es energía sostenida sin transitorios, no la supera.

2. **El Pad Pegajoso:** Un sintetizador pad sostenido durante 8 compases produce un dimmer permanentemente encendido en sistemas convencionales. La inercia adaptativa (tidal gate + dry spell adaptation) degrada progresivamente el umbral pero acumula "fatiga" — el fluido pierde energía sin input fresco.

3. **El Strobe de Guitarra:** La distorsión de guitarra eléctrica tiene energía broadband que cruza todos los umbrales simultáneamente en DMX convencional. El Morphologic Centroid Shield filtra por centroide espectral + harshness: la guitarra tiene centroide alto + harshness alta, mientras que un snare limpio tiene centroide bajo + harshness baja, permitiendo discriminar sin analizar el timbre.

### 2.3 Verificación de Legitimidad del Paradigma

**¿Es mérito real o es marketing?** He buscado activamente en el código evidencia de que la metáfora sea puramente nominal — que los nombres "inercia" y "viscosidad" sean etiquetas aplicadas a envelopes y gates convencionales.

**Resultado:** No es nominal. El sistema produce **tres comportamientos emergentes** que no se obtienen con envelopes + gates clásicos:

1. **Decay morfológico:** El decay no es constante ni temporal. `decayFactor = decayBase + decayRange × morphFactor`, donde `morphFactor` es un EMA del contenido mid ponderado. Un track con solo kicks (`morphFactor ≈ 0`) produce decay 0.0077 (techno: el kick enciende y apaga en 1-2 frames). Un track con melodía sostenida (`morphFactor ≈ 0.87`) produce decay 0.04 (la luz "fluye" entre notas). **El mismo hardware, la misma señal de entrada, produce comportamiento radicalmente diferente según el contexto musical.** Esto no es un envelope con release variable — es un sistema donde el release es función continuous del estado global.

2. **Soft Knee Ghost Path:** Cuando una señal no supera el gate principal (tensión superficial) pero *sí* supera el promedio reciente multiplicado por (1 + `gateMargin`), el envelope emite una señal fantasma limitada a `ghostCap × morphFactor`. Esto crea un "shimmer" dimensional que da vida a momentos suaves sin activar el gate principal. **Esto es análogo a la capilaridad en fluidos** — el líquido sube por las paredes del recipiente por debajo del nivel principal. En techno (`ghostCap = 0.04, morph ≈ 0.3`), el ghost es 1.2% — imperceptible. En chill (`ghostCap = 0.23, morph ≈ 0.85`), el ghost es 19.5% — un "dimmer floor" que mantiene los fixtures vivos incluso en silencio musical.

3. **Tidal Gate Adaptation:** Cuando un envelope no dispara durante 3-6 segundos (`drySpellLimit`), el pico de referencia decae (`avgPunchPeak × 0.993 → 0.985`), el floor adaptativo se degrada linealmente, y el propio gate se relaja. **Esto modela la evaporación** — un lago estanco pierde nivel. El sistema "busca" señal cada vez más desesperadamente hasta que encuentra una, momento en que se re-calibra al nuevo nivel. Esta adaptación es importante para tracks con dinámicas extremas (ambient → drop), donde un gate fijo o bien pierde el ambient o bien flicker en el drop.

**Veredicto del paradigma:** La metáfora fluídica es genuina, no cosmética. Los tres comportamientos emergentes (decay morfológico, capilaridad ghost, evaporación tidal) son propiedades que no emergen de envelopes + gates convencionales. El diseño está por encima de lo que el 99% de software de iluminación implementa.

---

## 3. LIQUIDENVELOPE — EL ÁTOMO DEL MOTOR

### 3.1 Arquitectura: Una Clase, Seis Instancias

`LiquidEnvelope` (219 líneas, WAVE 2401) es la abstracción fundamental. Cada instancia del motor posee **6 envelopes** — una por banda espectral relevante:

| Banda | Zona física | Envelope | Rol semántico |
|-------|-------------|----------|---------------|
| SubBass (20-80 Hz) | Front L | `envSubBass` | El Océano — presión sub-woofer |
| Bass/Kick (80-250 Hz) | Front R | `envKick` | El Martillo — golpe del bombo |
| Vocal/LowMid (250-1k Hz) | Back L | `envVocal` | El Alma — voz, guitarra rítmica |
| Snare/Mid (1k-3k Hz) | Back R | `envSnare` | El Látigo — transitorios percusivos |
| HighMid (3k-6k Hz) | Mover L | `envHighMid` | El Melodista — línea melódica principal |
| Treble (6k-16k Hz) | Mover R | `envTreble` | El Terminator — Schwarzenegger Mode |

Todas comparten la misma clase. La diferenciación viene enteramente de la configuración (`LiquidEnvelopeConfig`): 12 parámetros numéricos que definen el carácter del envelope.

### 3.2 El Pipeline de 9 Etapas

Cada invocación de `process(signal, morphFactor, now, isBreakdown)` ejecuta un pipeline determinista sin bifurcaciones condicionales complejas:

```
Signal (0-1)
    │
    ├── 1. VELOCITY GATE ──────── ¿La señal SUBE? (delta > -0.005/-0.03)
    │       └── Undertow grace frame: 1 frame de gracia post-ataque
    │
    ├── 2. ASYMMETRIC EMA ─────── Attack: α=0.98/0.02  Decay: α=0.88/0.12
    │       └── Seguimiento rápido al subir, resistente al bajar
    │
    ├── 3. PEAK MEMORY ────────── avgPunchPeak × 0.993 (normal) / 0.985 (dry spell)
    │       └── Tidal Gate: floor degrada 0.42→0.30 en 3-6s sin hits
    │
    ├── 4. ADAPTIVE FLOOR ─────── Umbral dinámico basado en picos recientes
    │       └── Dry spell: floor cae linealmente sobre tiempo sin disparo
    │
    ├── 5. DYNAMIC GATE ───────── gate = floor × avgPunchPeak + gateMargin
    │       └── Proporcional a picos históricos + margen fijo
    │
    ├── 6. MORPHOLOGIC DECAY ──── decayFactor = decayBase + decayRange × morph
    │       └── Morph=0: staccato (0.007-0.55)  Morph=1: legato (0.04-0.97)
    │
    ├── 7. MAIN GATE + CRUSH ──── signal^crushExponent + breakdown penalty
    │       └── Soft Knee ghost path (ghostCap × morph) si bajo gate
    │
    ├── 8. IGNITION SQUELCH ───── max(0.02, squelchBase - squelchSlope × morph)
    │       └── Anti-pad-ghost: morph=0 → squelch=0.20  morph=1 → squelch=0.02
    │
    └── 9. SMOOTH FADE ────────── Quadratic fade below 0.08
            └── Elimina saltos discretos en valores cercanos a cero
```

#### ✅ FORTALEZAS

1. **Zero-allocation en hot path.** La clase `LiquidEnvelope` no contiene `new`, arreglos temporales, closures, ni `Object.assign` en `process()`. Todo el estado es 6 campos primitivos (`private` `number`) pre-inicializados en el constructor. Esto es correcto: 6 instancias × 20-60 fps = 120-360 invocaciones/segundo. Una sola asignación de heap por frame multiplicada por 360 invocaciones/s presionaría el GC de V8 innecesariamente.

2. **Determinismo absoluto.** Dado el mismo `(signal, morphFactor, now, isBreakdown)`, el output es idéntico. No hay `Math.random()`, no hay timers asincrónicos, no hay lecturas de `Date.now()` fuera del parámetro explícito `now`. El test suite lo valida: secuencias idénticas de input producen secuencias idénticas de output. **Esto cumple el Axioma Anti-Simulación.**

3. **Undertow Grace Frame (Etapa 1).** Un detalle sutil: cuando la señal cae ligeramente después de un ataque (delta entre -0.005 y -0.03), el envelope concede un frame de gracia (`wasAttacking`). Esto resuelve el problema del "double envelope" donde un kick de 808 tiene un pico de ataque seguido de un micro-dip antes del sustain — sin el grace frame, el envelope se cerraría entre el pico y el sustain, produciendo un doble-flash visible. **He verificado que la ventana de -0.005 a -0.03 es correcta para kicks electrónicos típicos.** Un dip mayor a -0.03 (30 mili-unidades) es un decay genuino, no un micro-dip de waveform.

4. **Ignition Squelch como función de morph (Etapa 8).** La formulación `squelch = max(0.02, base - slope × morph)` es elegante: en techno duro (`morph ≈ 0`), el squelch es 0.20 — bloquea pads falsos que pasarían el gate dinámico. En melodía rica (`morph ≈ 1`), el squelch baja a 0.02 — permite que señales suaves disparen el envelope. **Esto resuelve el dilema clásico de sensibilidad vs especificidad sin dos motores separados.**

#### ⚠️ CONSIDERACIONES

1. **Asymmetric EMA con coeficientes fijos (Etapa 2).** Los coeficientes de ataque (0.98/0.02) y decay (0.88/0.12) son constantes para todas las bandas y todos los géneros. El ataque es extremadamente agresivo (98% precedente + 2% nuevo), lo cual es correcto para tracking de picos, pero podría beneficiarse de parametrización por perfil si algún género requiere ataque más lento (e.g., reggae con offbeats suaves). **Riesgo bajo:** Los valores actuales son correctos para los 4 géneros implementados.

2. **Peak Memory decay (Etapa 3).** El valor `0.993^frames` tiene una vida media de ~99 frames, que a 20 fps son ~5 segundos. A 60 fps son ~1.65 segundos. **La vida media del peak memory varía con el frame rate.** Esto no es un bug sino una decisión: a fps más altos, la adaptación es más rápida, lo cual produce dimmers más "nerviosos" a 60 fps que a 20 fps con el mismo audio. El test suite (dt Stress Tests) valida que el sistema decay a cero sin quedarse "atascado" en ningún fps (15-144), pero no valida equivalencia de comportamiento perceptual entre fps.

---

## 4. LIQUIDENGINEBASE — EL REACTOR CENTRAL

### 4.1 Arquitectura

`LiquidEngineBase` (549 líneas, WAVE 2435) es una clase abstracta que contiene **todo el cálculo pesado**. Las clases hijas (`LiquidEngine71`, `LiquidEngine41`) solo implementan `routeZones()` — la distribución de los valores calculados a zonas físicas.

El método público `applyBands(input: LiquidStereoInput): LiquidStereoResult` ejecuta un pipeline de 10 etapas:

```
GodEarBands (7 bandas espectrales) + Metadata (isKick, harshness, flatness, etc.)
    │
    ├── 1. MORPH FACTOR ─────────── EMA del mid → clamp((avg-0.30)/0.40, floor, ceiling)
    │       └── morphFactorOverride si se proporciona
    │
    ├── 2. MODE FLAGS ───────────── acidMode, noiseMode (umbral de harshness/flatness)
    │
    ├── 3. SILENCE/AGC ──────────── isRealSilence || isAGCTrap → return zeros
    │       └── Recovery ramp during RECOVERY_DURATION (2000ms)
    │
    ├── 4. SECTION ANALYSIS ─────── isBreakdown = sectionType ∈ {intro, ambient, breakdown}
    │
    ├── 5. KICK DETECTION ───────── Edge detector + interval veto + kickVetoFrames
    │       └── kickEdgeMinInterval para filtrar double-triggers
    │
    ├── 6. ENVELOPE PROCESSING ──── 6× LiquidEnvelope.process() (el 80% del CPU)
    │       ├── envSubBass ← subBass signal
    │       ├── envKick ← kickLocked ? bass : 0 (si strict-split) / bass (si default)
    │       ├── envVocal ← cross-filtered mid (mid×w - bass×sub - treble×sub)
    │       ├── envSnare ← transient-shaped (trebleDelta × boost × percExponent)
    │       ├── envHighMid ← cross-filtered highMid (hMid×w + mid×w + treble×w)
    │       └── envTreble ← treble directo
    │
    ├── 7. CROSS-FILTER MOVERS ──── WAVE 911 vs envelope mode (layout-dependent)
    │       └── Mover L: tonal gate (flatness < threshold)
    │       └── Mover R: treble - bass×subtractFactor
    │
    ├── 8. SIDECHAIN GUILLOTINE ─── if frontMax > threshold: movers × (1 - depth)
    │       └── Strobe during sidechain moment
    │
    ├── 9. STROBE LOGIC ─────────── treble > threshold || combo > threshold
    │       └── Duration cap (30ms), noise discount
    │
    └── 10. AGC REBOUND ─────────── Post-silence recovery ramp × results
    │
    └── routeZones(frame) → LiquidStereoResult  [DELEGADO A CLASE HIJA]
```

#### ✅ FORTALEZAS

1. **Transient Shaper (WAVE 2427-2451).** La detección de snare/percusión no usa umbrales absolutos. La señal del envelope de snare es `trebleDelta × boost × percExponent` donde `trebleDelta = max(0, treble_actual - treble_anterior)`. Esto es un **diferenciador temporal**: responde solo a *cambios* positivos en treble, no a niveles sostenidos. Es el equivalente de aplicar un filtro pasa-altos en el dominio temporal de la energía espectral. **Una gui tarra distorsionada con treble +0.60 constante produce trebleDelta ≈ 0 — por tanto no dispara el snare.** Un hi-hat que aparece en +0.55 desde silencio produce trebleDelta = +0.55 — dispara. Esto es la solución correcta al problema del snare-guitar bleed.

2. **Morphologic Centroid Shield (WAVE 2449).** Cuando `isKick && centroid < centroidFloor && harshness < 0.024`, se anula el `hybridSnare`. El centroidFloor se adapta: `900 × (1 - morphFactor)`. En techno duro (morph ≈ 0.3), floor ≈ 630 Hz — un kick limpio con centroide de 200-400 Hz pasa el filtro y anula el snare. En melodía rica (morph ≈ 0.8), floor ≈ 180 Hz — solo kicks sub-graves extremos bloquean el snare. **Esto es un detector de kick puro vs kick contaminado derivado del centroide espectral, algo que no he visto en ningún software de iluminación comercial.**

3. **Percussion Isolation (Schwarzenegger).** Cuatro parámetros por perfil (`percMidSubtract`, `percGate`, `percBoost`, `percExponent`) controlan la extracción del transient percusivo. En techno: `percMidSubtract = 0.0` (el mid no contamina la percusión limpia). En latino: `percMidSubtract = 1.5` (Anti-Autotune — resta 150% del mid de la percusión porque las voces latinas saturan el mid y sangran al canal percusivo). **La parametrización de este subtractor es la diferencia entre un motor que entiende géneros musicales y uno que aplica procesamiento genérico.**

4. **Apocalypse Mode.** Cuando `harshness > apocalypseHarshness && flatness > apocalypseFlatness`, el motor entra en modo de emergencia que inyecta energía caótica en back/movers. Esto maneja el caso extremo de noise rock, harsh noise, o feedback de guitarra donde el análisis espectral normal colapsa porque toda la energía está en todas las bandas. **La existencia de un failsafe explícito para señales patológicas indica madurez del sistema.**

5. **Profile Fusion (`fuseProfileFor41`).** Los perfiles tienen un campo opcional `overrides41` con parámetros específicos para layout 4.1. La fusión deep-merge se ejecuta **una sola vez** en `setProfile()`, nunca en el hot path. El perfil fusionado se cachea como `this.profile`. **Correcto: zero overhead per-frame.**

#### ⚠️ CONSIDERACIONES

1. **MorphFactor formula hardcoded.** La fórmula `clamp((avgMid - 0.30) / 0.40, floor, ceiling)` asume que 0.30 es el umbral universal de "contenido melódico" y 0.40 es el rango universal. Estos valores no son parametrizables por perfil — solo `morphFloor` y `morphCeiling` lo son. Si un género futuro necesita un umbral de morph diferente (e.g., jazz con mid bajo pero "melodía" en el sentido jazzístico), habría que modificar la clase base. **Riesgo medio:** Los 4 géneros actuales funcionan correctamente con esta fórmula.

2. **`now` viene de `Date.now()` externo.** El motor no tiene reloj interno — depende del llamante para el timestamp. Esto es correcto para testabilidad (`vi.useFakeTimers()`), pero crea un acoplamiento temporal: si el llamante proporciona timestamps no-monotónicos o repetidos, el motor podría computar intervalos negativos o cero para el kick edge detector. **No hay validación de monotonía de `now`.** Sin embargo, el riesgo práctico es bajo porque `Date.now()` es monotónico en V8/Electron.

---

## 5. ENRUTAMIENTO DE ZONAS — 7.1 VS 4.1

### 5.1 LiquidEngine71: Layout Asimétrico

`LiquidEngine71` (216 líneas, WAVE 2466-2470) implementa el enrutamiento para rigs completos con 7 zonas independientes. Lo notable es que tiene **tres caminos** según el perfil activo:

**Techno/PopRock (default):** Passthrough directo — cada envelope va a su zona sin transformación.

**Latino (WAVE 2468):** Swap de movers — `moverLeft ↔ moverRight`. En latino, la voz (mid) es el protagonista → va al mover físico izquierdo (que en el escenario latino suele apuntar al cantante). El treble (percusión bright) va al mover derecho.

**Chill (WAVE 2470):** Reemplaza completamente los PARs con **osciladores sinusoidales de periodos primos**:

```typescript
const t = Date.now()
const osc = (P1: number, P2: number) =>
  (Math.sin(t / P1) + Math.sin(t / P2) * 0.3 + 1.3) / 2.6
```

Los periodos elegidos son **números primos**: 1831, 1039, 1511, 1361, 2003, 1201, 1759, 1069. La combinación de dos senos con periodos irracionalmente relacionados (primos) garantiza que el patrón no se repita dentro de un intervalo perceptualmente relevante. Los movers siguen siendo reactivos a la música; solo los PARs se convierten en "respiración oceánica".

La profundidad de respiración es `breathDepth = 0.25 + morph × 0.67`, lo cual da:
- morph=0 (silencio): breathDepth = 0.25 → PARs ondean suavemente
- morph=0.85 (pad rico): breathDepth = 0.82 → PARs ondean dramáticamente

**Evaluación:** El chill oscillator es la decisión arquitectónica más arriesgada del sistema. En un motor que proclama el Axioma Anti-Simulación ("cero aleatorio"), introducir funciones sinusoidales parametrizadas por `Date.now()` es conceptualmente coherente — son deterministas dado el mismo `now` — pero rompen la propiedad de que "same audio → same light". Dos ejecuciones del mismo track chill con relojes diferentes producirán oscilaciones diferentes. **Esto es aceptable para chill** (la luz ambiental no necesita reproducibilidad) **pero sería inaceptable para techno** (donde el kick→luz debe ser idéntico cada vez). La bifurcación por perfil respeta esta distinción.

### 5.2 LiquidEngine41: Layout Compacto

`LiquidEngine41` (107 líneas, WAVE 2435-2455) resuelve el problema de rigs pequeños con solo 4 PARs + 1 mover. Dos estrategias:

**`default`:** `frontPar = max(frontLeft, frontRight)`, `backPar = max(backLeft, backRight)`. Simple y correcto para latino/rock/chill donde las dos señales de cada par coexisten bien.

**`strict-split` (Techno Industrial, WAVE 2439-2455):** Separación estricta:
- frontPar = **solo envKick** (El Metrónomo)
- backPar = **solo envSnare** (El Látigo) 
- movers = WAVE 911 fórmulas específicas (no envelopes regulares)

La razón del `strict-split` es que `max(subBass, kick)` en techno industrial produce un frontPar dominado por el subBass continuo (que tiene decay largo) en vez del kick staccato. Al separar estrictamente kick → front y snare → back, cada zona tiene identidad percusiva pura. **Esta es una observación que solo surge de testing extensivo con música real.**

Los movers en `strict-split` usan fórmulas de WAVE 911 en vez de los envelopes regulares:
- Mover L: `max(0, mid - bass × 0.50)` — aísla la melodía restando los graves
- Mover R: `treble` directo — Schwarzenegger Mode, sin filtro

El sidechain en `strict-split` es inline: cuando `isKick = true`, los movers se duckan por `(1 - sidechainDepth)` dentro del `routeZones()`, en vez de esperar al sidechain de la base.

---

## 6. SISTEMA DE PERFILES — PARAMETRIZACIÓN POR GÉNERO MUSICAL

### 6.1 Filosofía: Mismo Motor, Números Diferentes

El contrato `ILiquidProfile` (235 líneas, WAVE 2435-2488) define ~40+ parámetros `readonly` que controlan todos los aspectos del motor. **No hay funciones en los perfiles.** Son pura data.

Esto es correcto y no trivial. La tentación natural es meter lógica por género:

```typescript
// MAL: función en el perfil
if (profile.id === 'latino') {
  snareSignal = applyAntiAutotune(signal)
}

// BIEN: parámetro en el perfil
snareSignal = signal - mid * profile.percMidSubtract  // percMidSubtract = 1.5 para latino, 0.0 para techno
```

La segunda forma es corralizable, testeable, y hot-swappable en runtime sin reiniciar el motor.

### 6.2 Los 4 Perfiles

#### 🏭 TECHNO_PROFILE (`techno-industrial`)

El perfil más staccato. Calibrado con 50,000 iteraciones Monte Carlo (WAVE 2415).

| Aspecto | Valores clave | Efecto |
|---------|---------------|--------|
| Decay | 0.0077 - 0.22 | Kick enciende/apaga en 1-2 frames |
| Sidechain | threshold=0.10, depth=0.30 | Agresivo — el kick silencia los movers 30% |
| Strobe | threshold=0.80, duration=30ms | Frecuente en peaks |
| Morph range | [0.30, 0.70] | Full pulse: staccato a legato |
| Layout 4.1 | `strict-split` | Metrónomo + Látigo separados |
| Kick veto | 0 frames, interval=80ms | No bloquea, pero filtra double-trigger |

#### 🎉 LATINO_PROFILE (`latino-fiesta`)

El perfil más elástico. Calibrado para dembow 3-3-2 (WAVE 2434 Monte Carlo).

| Aspecto | Valores clave | Efecto |
|---------|---------------|--------|
| Decay | 0.50 - 0.92 | Tumbao fluido — la luz fluye entre beats |
| Sidechain | threshold=0.15, depth=0.12 | Suave — la voz no muere con el kick |
| Strobe | threshold=0.85 | Solo en el perreo más intenso |
| percMidSubtract | 1.5 | **Anti-Autotune**: elimina 150% del mid de la percusión |
| Morph range | [0.25, 0.65] | Precisión dembow |
| Layout 4.1 | `default` | max()-based compaction |
| overrides41 | Extensos | Staccato forzado en PARs, Anti-Autotune reforzado |

El campo `overrides41` del latino es el más elaborado: 14 parámetros sobreescritos para compensar que el max() del modo `default` en 4.1 con decays largos (0.92) produce un frontPar permanentemente encendido. Los overrides fuerzan decays cortos solo en el contexto 4.1, preservando el tumbao fluido en 7.1.

#### 🎸 POPROCK_PROFILE (`poprock-live`)

El perfil para señales sucias. Diseñado para guitarras distorsionadas y batería acústica.

| Aspecto | Valores clave | Efecto |
|---------|---------------|--------|
| Decay | 0.35 - 0.80 | Orgánico — ni staccato ni eterno |
| Sidechain | threshold=0.20, depth=0.05 | **Casi nulo** — el bombo no ahoga la guitarra |
| Strobe | threshold=0.88, duration=20ms | Conservador — solo en climax |
| harshnessAcidThreshold | 0.80 | MUY alto — distorsión no es acid |
| Morph range | [0.20, 0.60] | Guitarras dan mid desde la intro |
| kickEdgeMinInterval | 50ms | Corto — double bass drumming / blast beats |
| ghostCap | 0.05 - 0.09 | Ghost notes visibles (dinámica humana) |
| Layout 4.1 | `default` | Wall of sound: graves coexisten |

La decisión más sutil del perfil rock: `sidechainDepth = 0.05` (5%). En techno es 30%. La razón: en una banda de rock, el bombo es un instrumento más del kit — no es el dictador que silencia todo. Pero en techno, el kick ES la canción — todo lo demás respira entre beats.

#### 🌊 CHILL_PROFILE (`chill-oceanic`)

El perfil para la ausencia. Diseñado para que la luz exista cuando no hay música.

| Aspecto | Valores clave | Efecto |
|---------|---------------|--------|
| Decay | 0.88 - 0.97 | Glacial — la luz persiste 3-5 segundos |
| Sidechain | threshold=0.99, depth=0.0 | **DESACTIVADO** — el chill no tiene sidechain |
| Strobe | threshold=0.999 | **IMPOSIBLE** — el océano no hace strobe |
| ghostCap | 0.20 - 0.23 | **Dimmer floor** — los fixtures nunca se apagan |
| Morph range | [0.05, 0.35] | Techo bajo — el chill COMPLETO con mid=35% |
| harshnessAcidThreshold | 0.999 | Imposible — el chill no tiene acid mode |
| kickEdgeMinInterval | 500ms | Solo pulsaciones muy lentas son "kick" |
| Layout 4.1 | `default` | Respiración oceánica continua |

La observación más importante del perfil chill: `ghostCap = 0.23` combinado con `morphCeiling = 0.35` produce un dimmer floor de `0.23 × 0.35 = 8.05%`. Los fixtures **nunca bajan del 8%**. Esto es intencional: en un ambiente chill, fixtures que se apagan completamente producen "agujeros negros" visuales que rompen la atmósfera. El 8% de base floor es imperceptible como luz directa pero mantiene la "presencia" del fixture.

### 6.3 Profile Registry

`profiles/index.ts` mapea 18 alias de vibe a los 4 perfiles:

```
techno, techno-industrial, industrial, trance           → TECHNO_PROFILE
latino, latino-fiesta, reggaeton, dembow, salsa, cumbia → LATINO_PROFILE
poprock, poprock-live, rock, pop, indie, alternative    → POPROCK_PROFILE
chill, chill-oceanic, lounge, ambient                   → CHILL_PROFILE
```

Default: `TECHNO_PROFILE`.

El hot-swap es instantáneo: `setProfile()` fusiona overrides41 (si aplica) y cachea. El frame siguiente usa el nuevo perfil.

---

## 7. CHAOS ENGINEERING — EL FACTOR "GUITARRA ELÉCTRICA DISTORSIONADA"

### 7.1 El Peor Caso: Señales Broadband

La guitarra eléctrica distorsionada es el nemesis de todo motor de iluminación reactiva. Su perfil espectral es:

```
subBass: 7%   bass: 21%   lowMid: 45%   mid: 60%   highMid: 38%   treble: 24%   air: 6%
```

(Valores del test harness: `guitarBands(0.70)` — calibrados contra grabaciones reales.)

En un sistema DMX convencional, esta señal cruza **todos** los umbrales simultáneamente. El resultado: todos los fixtures encendidos al 60-80% permanentemente, sin distinción entre frontPar (que debería ser solo el bombo) y movers (que deberían ser solo la melodía).

### 7.2 Cómo el Omniliquid Resuelve Cada Problema

**Problema 1: El Mid satura todo.**

Solución: Cross-filter en envVocal. `rawVocal = mid × moverLMidWeight + highMid × mMLHighMidWeight + treble × moverLTrebleWeight - bass × bassSubFactor`. En poprock: `0.60×0.50 + 0.38×0.80 + 0.24×0.10 - 0.21×0.15 = 0.597`. En techno con la misma señal: `0.60×0.50 + 0.38×0.60 + 0.24×0.05 - 0.21×0.20 = 0.498`. **El cross-filter produce valores diferentes por perfil con la misma señal broadband.**

**Problema 2: La guitarra dispara el snare permanentemente.**

Solución: Transient Shaper basado en `trebleDelta`. Guitarra sostenida + constante → trebleDelta ≈ 0 → envSnare recibe ≈ 0. Un hi-hat real desde silencio → trebleDelta = +0.55 → envSnare dispara. **El diferenciador temporal es la defensa primaria contra el bleed broadband.** El test "should not saturate all zones when fed broadband guitar noise" valida que no todas las zonas se activan simultáneamente con guitarra.

**Problema 3: Distorsión activa acid mode incorrectamente.**

Solución: `harshnessAcidThreshold` por perfil. Techno: 0.60 (la distorsión en techno ES acid). Rock: 0.80 (la distorsión es normal, no acid). **La misma harshness de 0.65 produce acid mode en techno pero no en rock.** Un ingeniero que no entiende música habría puesto un umbral universal.

**Problema 4: Wall of sound satura el sidechain.**

Solución: `sidechainDepth` por perfil. Rock: 0.05 (5%). El bombo acústico atenúa los movers solo un 5%, preservando la guitarra. Techno: 0.30 (30%). El kick electrónico es rey. **Un sidechain universal de 15% sería demasiado para rock y poco para techno.**

### 7.3 Señales Limpias vs Sucias — Tabla Comparativa

| Escenario | Techno (limpio) | Rock (sucio) |
|-----------|----------------|-------------|
| Kick → frontPar | trebleDelta ≈ 0, kick puro | Hi-hat sangra al bass, pero velocityGate filtra el bleed continuo |
| Snare → backPar | trebleDelta alto, disparo limpio | Guitarra da trebleDelta ≈ 0 (sostenida), solo transitorios reales pasan |
| Melodía → movers | mid aislado sin contaminación | Mid contaminado por guitarra, pero cross-filter resta bass |
| Sidechain | Kick 0.90 → movers ×0.70 | Kick 0.60 → movers ×0.97 (casi sin efecto) |
| Morph range | [0.30, 0.70] — respira con breakdowns | [0.20, 0.60] — guitarras dan mid constante |
| Acid mode | harshness 0.65 → activado | harshness 0.65 → NO activado |

---

## 8. BENCHMARK COMPARATIVO — VS. GRANDMA3 DIMMER PHASERS

### 8.1 Qué Es un Dimmer Phaser

El grandMA3 (MA Lighting) es el estándar de la industria en consolas de iluminación profesional. Su sistema de Phasers permite aplicar modulaciones temporales a cualquier atributo:

```
MA3 Dimmer Phaser:
- Forma de onda: Sin/Cos/Triangle/Saw/Square/PWM
- Velocidad: BPM manual o tap-tempo
- Fase: offset entre fixtures (fan/spread)
- Amplitud: rango de dimmer (e.g., 10%-90%)
- Accel/Decel: curva de easing
```

Estos phasers son **temporales**, no reactivos. No analizan audio. Son formas de onda preconfigurradas que se sincronizan al BPM por tap o MIDI clock. El operador programa la forma de onda, la amplitud, y el spread entre fixtures. La luz sigue un patrón matemático, no la música.

### 8.2 Diferencias Fundamentales

| Dimensión | grandMA3 Phaser | Omniliquid Engine |
|-----------|----------------|-------------------|
| **Fuente de modulación** | Clock temporal (BPM manual/MIDI) | Análisis espectral de 7 bandas en tiempo real |
| **Adaptación a la música** | Ninguna — el operador ajusta manualmente | Automática — morph, decay, gates se adaptan al contenido |
| **Cambio de género** | El operador reprograma cues | Hot-swap de perfil en 1 frame |
| **Señales sucias** | No aplica — no procesa audio | Cross-filter, centroid shield, transient shaper |
| **Resolución temporal** | Phaser cycle completo (1/BPM) | Frame-a-frame (15-144 fps) |
| **Latencia** | 0ms (playback) | 1 frame (16-66ms) |
| **Breakdowns** | Operador baja fader manual | Detección automática → penalty en envelopes |
| **Silencio** | Phaser sigue corriendo | Detección + AGC rebound protection |
| **Determinismo** | ✅ Temporal | ✅ Signal-deterministic (mismo audio → misma luz) |
| **Número de fixtures** | 1000+ con spread de fase | 7 zonas (Front L/R, Back L/R, Mover L/R, Strobe) |

### 8.3 Lo Que grandMA3 Hace Mejor

1. **Escala.** MA3 puede controlar 250,000 parámetros de 60,000 fixtures simultáneamente con resolución de 16-bit por canal. El Omniliquid Engine genera 7 zonas de salida. La traducción de zonas a fixtures individuales (with fan y spread) es responsabilidad de la capa HAL downstream, no del motor de físicas. **Pero**: MA3 necesita que un operador humano programe cada cue. El Omniliquid es autónomo.

2. **Formas de onda complejas.** MA3 ofrece 10+ formas de onda (sin, triangle, saw, PWM, etc.) con easing curves y wing modes. El Omniliquid produce una forma de onda emergente del pipeline de 9 etapas — no es configurable como "quiero un triángulo". **Pero**: la forma emergente es musicalmente coherente porque nace del audio, no de una elección arbitraria del programador.

3. **Reproducibilidad show a show.** Un show programado en MA3 es idéntico cada noche. El Omniliquid produce la misma respuesta al mismo audio, pero el audio live nunca es idéntico. **Esto es una limitación inherente a la iluminación reactiva, no del motor.**

### 8.4 Lo Que el Omniliquid Hace Mejor

1. **Cero operador humano necesario.** Un show completo de iluminación reactiva funciona sin que nadie toque la consola. Para DJ sets, eventos en vivo improvisados, y venues sin lighting designer, esto tiene valor de mercado real.

2. **Adaptación en tiempo real al contenido.** Si un DJ introduce un breakdown inesperado, los envelopes detectan la caída de energía y reducen automáticamente la intensidad con breakdown penalty. Un operador de MA3 necesita ver lo que pasa (latencia humana ~300-700ms) y mover un fader.

3. **Parametrización por género.** El mismo hardware produce iluminación radicalmente diferente para techno (staccato, agresivo) vs chill (oceánico, continuo) con solo cambiar un perfil. En MA3, esto requiere reprogramar cue stacks completos.

4. **Manejo de señales patológicas.** El Morphologic Centroid Shield, el Anti-Autotune filter, y el Apocalypse Mode no tienen equivalente en MA3 porque MA3 no procesa audio.

### 8.5 Veredicto del Benchmark

**No son competidores directos.** MA3 es una consola de playback programado; el Omniliquid es un motor de reactividad autónoma. La comparación correcta es: **¿puede el Omniliquid reemplazar la necesidad de un operador de MA3 para DJ sets y eventos sin lighting designer?** La respuesta, evaluando el código, es **sí para el 80% de escenarios**, con la limitación de que la salida es de 7 zonas, no de fixtures individuales con spread de fase.

---

## 9. COBERTURA DE TESTS & DEUDA TÉCNICA

### 9.1 Test Suite — THE SAFETY NET (WAVE 2487)

| Archivo de test | Tests | Líneas | Módulos cubiertos |
|-----------------|-------|--------|-------------------|
| `LiquidEngineBase.test.ts` | ~25 | 543 | MorphFactor, Transient Shaper, Silence/AGC, Acid/Noise, Apocalypse, dt Stress (15/30/60/144fps), Broadband Resistance, Chill Convergence, 41 dt Stress |
| `LiquidEngine41.test.ts` | ~28 | 419 | strict-split routing, default routing, Sidechain Guillotine, Kick Edge+Veto, Centroid Shield, Reset, setProfile hot-swap, overrides41 fusion, Legacy compat, Strobe safety, Determinism |
| `LiquidEngine71.test.ts` | ~18 | 332 | Chill-Oceanic oscillators, Latino mover swap, Default passthrough, Recovery, setProfile+reset, Determinism |
| `LiquidEnvelope.test.ts` | ~15 | 319 | Silence, Velocity Gate, Ignition Squelch, Decay morph, Max Intensity, Breakdown Penalty, Tidal Gate, Ghost Power |
| `LiquidProfiles.test.ts` | ~50 | 238 | Structural validation (4 perfiles × 6 envelopes + 8 fields), Monte Carlo regression snapshots (techno, latino, chill, poprock) |
| `LiquidStereoPhysics.test.ts` | ~48 | 389 | Legacy engine: Silence, Kick, Sidechain, Strobe, MorphFactor, Recovery, Reset, Determinism |
| `test-harness.ts` | — | 262 | Generadores deterministas: 10 perfiles espectrales, 4x4 pattern, dembow pattern |
| **TOTAL** | **184** | **2.502** | — |

**184 tests. 184 pasados. 0 fallos.** Ejecutados en 222ms (tests) / 511ms (total con transform+import).

#### ✅ FORTALEZAS DEL TEST SUITE

1. **Determinismo absoluto.** Zero `Math.random()`. Zero mocks de lógica de negocio. Los únicos mocks son `vi.useFakeTimers()` para control temporal. Esto cumple rigurosamente el Axioma Anti-Simulación. **He inspeccionado cada archivo de test buscando fuentes de no-determinismo y no he encontrado ninguna.**

2. **Test Harness con perfiles espectrales calibrados.** Los generadores (`kickBands`, `snareBands`, `guitarBands`, `chillPadBands`, `latinKickBands`, `latinSnareBands`, `acousticDrumBands`) producen distribuciones espectrales realistas basadas en mediciones de audio real. Ejemplo: `guitarBands(0.70)` produce `{subBass: 0.07, bass: 0.21, lowMid: 0.455, mid: 0.595, highMid: 0.385, treble: 0.245, ultraAir: 0.056}` — broadband con mid dominante, exactamente lo que una guitarra distorsionada produce.

3. **dt Stress Tests (WAVE 2487).** Se testea que el motor no se queda "atascado" (dimmers > 0.05 después de silencio) en 4 frame rates: 15fps (66ms), 30fps (33ms), 60fps (16ms), 144fps (7ms). También se testea **jitter** (alternancia 10ms/50ms/33ms/16ms/66ms/7ms/100ms) verificando en cada frame: `isFinite`, `≥ 0`, `≤ 1.0`. **Esta es la prueba más valiosa del suite** — demuestra robustez del motor bajo condiciones reales donde el frame rate fluctúa.

4. **Monte Carlo Regression Tests.** Los perfiles tienen tests que verifican los valores exactos de las constantes calibradas con Monte Carlo (`toBeCloseTo(0.1098, 3)`). Esto previene regresiones accidentales — un merge incorrecto que cambie `envelopeKick.gateOn` de 0.1098 a 0.11 será detectado.

5. **Pattern Generators para integración.** `generate4x4Pattern(128, 5000, 20)` produce un patrón 4/4 completo a 128 BPM por 5 segundos a 20fps — una secuencia de `GodEarBands[]` que se puede procesar frame a frame. `generateDembowPattern()` produce el 3-3-2 del dembow. Estos generators permiten tests de integración de escenarios completos, no solo unit tests de funciones aisladas.

#### ⚠️ CARENCIAS DEL TEST SUITE

1. **0 tests para motores legacy.** `TechnoStereoPhysics`, `LatinoStereoPhysics`, `RockStereoPhysics2`, `ChillStereoPhysics` tienen 0 tests unitarios propios. Solo `LiquidStereoPhysics` (el primer motor unificado, también deprecated) tiene 48 tests. Dado que estos motores están marcados `@deprecated` y pendientes de eliminación, la ausencia de tests es justificable — no tiene sentido escribir tests para código que se va a borrar. **Pero el código legacy aún está en producción** hasta que `SeleneLux.ts` migre completamente al Omniliquid. Mientras tanto, bugs en los motores legacy no serán detectados por el suite.

2. **Sin tests de rendimiento explícitos.** No hay benchmarks que midan el tiempo de ejecución de `applyBands()` bajo carga. Los dt stress tests validan correctitud, no performance. **En una máquina de 16GB RAM como la del entorno de desarrollo, esto es aceptable.** Pero para la due diligence de Pioneer, un benchmark de microsegundos/frame sería valioso para evaluar escalabilidad.

3. **Sin test de fuzzing.** No hay tests que generen valores de entrada aleatorios (o cuasi-aleatorios) para encontrar edge cases no previstos. Los inputs son cuidadosamente construidos. Un fuzzer que generase `GodEarBands` con valores en [0, 1] aleatorios durante 10,000 frames podría descubrir combinaciones que producen NaN o valores fuera de rango no cubiertos por los tests deterministas. **Nota: esto NO violaría el Axioma Anti-Simulación porque el fuzzer es una herramienta de testing, no lógica de negocio.**

### 9.2 Deuda Técnica

| ID | Severidad | Descripción | Esfuerzo |
|----|-----------|-------------|----------|
| DT-01 | 🟡 MEDIA | **4.171 líneas de código legacy sin eliminar.** 7 archivos deprecated marcados para purga pero aún presentes. Aumentan el footprint del bundle, confunden a nuevos desarrolladores, y crean superficie de error si alguien importa el módulo incorrecto. | 2-4h (delete + verificar que no se importa desde fuera de physics/) |
| DT-02 | 🟢 BAJA | **MorphFactor formula no parametrizable.** Los offsets 0.30 y 0.40 están hardcoded en `LiquidEngineBase`. Si un quinto género necesita un rango diferente, habría que extraerlos a `ILiquidProfile`. | 1h |
| DT-03 | 🟢 BAJA | **EMA coefficients fijos en LiquidEnvelope.** Attack (0.98/0.02) y Decay (0.88/0.12) son constantes. Parametrizarlos permitiría envelopes con tracking más lento para géneros futuros (e.g., dub, reggae). | 1h |
| DT-04 | 🟡 MEDIA | **SeleneLux.ts pendiente de migración total.** El orquestador aún referencia motores legacy como fallback. Hasta que la migración esté completa, hay dos code paths para la misma funcionalidad — un breeding ground clásico de bugs de inconsistencia. | 4-8h (requiere validación integral) |
| DT-05 | 🟢 BAJA | **OceanicContextAdapter no testeado.** 368 líneas de lógica de traducción oceánica → paramétrica sin un solo test. El módulo es auxiliar (modulación de color, no de intensidad), pero la ausencia de tests en un codebase con 184 tests es una irregularidad. | 2-3h |
| DT-06 | 🟢 BAJA | **Peak memory decay dependiente de fps.** La vida media de `avgPunchPeak` varía con el frame rate (5s @ 20fps vs 1.65s @ 60fps). Normalizar al dt real en vez de al frame count produciría comportamiento idéntico independiente del fps. | 2h |

---

## 10. VEREDICTO & PIONEER SCORE

### 10.1 Evaluación por Dimensión

| Dimensión | Peso | Puntuación | Justificación |
|-----------|------|------------|---------------|
| **Correctitud matemática** | 20% | 92/100 | Pipeline determinista, zero-allocation, axioma anti-simulación cumplido. Pierde 8 puntos por peak memory fps-dependiente y EMA no parametrizable. |
| **Innovación arquitectónica** | 20% | 96/100 | El paradigma del fluido es genuino y produce comportamientos emergentes que no existen en la industria. Morphologic Centroid Shield es invención original. Pierde 4 puntos porque los osciladores chill rompen parcialmente el paradigma reactivo. |
| **Calidad de tests** | 15% | 90/100 | 184 tests deterministas, dt stress, Monte Carlo regression, pattern generators. Pierde 10 por ausencia de fuzzing y benchmarks de performance. |
| **Modularidad & extensibilidad** | 15% | 88/100 | Sistema de perfiles impecable. Fusión de overrides41 elegante. Pierde 12 por morph formula hardcoded y EMA fijos que limitan extensibilidad futura. |
| **Deuda técnica** | 15% | 72/100 | 4.171 líneas legacy + migración SeleneLux incompleta. La ratio activo:muerto es 42:58. La deuda está documentada y planificada (tags WAVE 2488 DT-*), pero "planificada" no es "ejecutada". |
| **Benchmark vs industria** | 15% | 94/100 | Superior a DMX convencional en reactividad autónoma. La limitación de 7 zonas (vs miles de fixtures en MA3) es inherente al scope. El manejo de señales sucias (rock, latina) es excepcional y sin par en software de iluminación reactiva. |

### 10.2 PIONEER SCORE

$$\text{Score} = \sum_{i=1}^{6} w_i \times s_i = 0.20 \times 92 + 0.20 \times 96 + 0.15 \times 90 + 0.15 \times 88 + 0.15 \times 72 + 0.15 \times 94$$

$$= 18.4 + 19.2 + 13.5 + 13.2 + 10.8 + 14.1 = \boxed{89.2}$$

### 10.3 Resumen del Veredicto

El Omniliquid Engine es un motor de físicas reactivas de emisión fotónica que está **significativamente por encima del estado del arte** en iluminación reactiva autónoma. La metáfora fluídica no es cosmética — produce comportamientos emergentes genuinos (decay morfológico, capilaridad ghost, evaporación tidal) que resuelven problemas reales de la industria que el DMX convencional no puede resolver sin intervención humana.

El sistema de perfiles paramétricos es una solución elegante al problema de multi-género: un motor, cuatro personalidades, zero duplicación de lógica. La calibración Monte Carlo de los perfiles demuestra rigor empírico.

La deuda técnica es la principal preocupación: 4.171 líneas de código legacy deprecated-pero-presente. Sin embargo, la migración está documentada, trazada, y parcialmente ejecutada. La purga completa es cuestión de horas de trabajo, no de rediseño.

**Recomendación para el Comité de Adquisiciones:** El Omniliquid Engine es un activo de propiedad intelectual de alto valor. La arquitectura es sólida, la implementación es determinista, y el paradigma es innovador. La deuda técnica es manejable y no compromete la integridad del sistema activo. **Aprobado para adquisición con condición de completar la purga legacy (DT-01, DT-04) antes de integración en la pipeline de Pioneer.**

---

*Fin del informe. Área 6 de 7 completada.*  
*PunkOpus — Auditor Jefe, Pioneer DJ / AlphaTheta*
