# 🔬 OMNILIQUID ENGINE AUDIT — PIONEER DUE DILIGENCE

**Clasificación:** CONFIDENCIAL — Solo para uso del Comité de Adquisiciones  
**Auditor:** PunkOpus, Ingeniero Jefe de DSP & Auditor de Adquisiciones Tecnológicas  
**División:** Pioneer DJ / AlphaTheta — Advanced Signal Processing Group  
**Producto evaluado:** LuxSync — Motor de Físicas de Emisión Fotónica (Área 6 de 7)  
**Módulo objetivo:** `electron-app/src/hal/physics/`  
**Fecha del informe:** 6 de Abril de 2026  
**Versión del código base:** WAVE 2470 (activo)  
**Componente evaluado:** Omniliquid Engine v4.1 / v7.1  

> **NOTA DEL AUDITOR:** Esta auditoría cubre exclusivamente la emisión fotónica: Dimmer, Intensity y Strobe. **El movimiento físico (Pan/Tilt) es competencia del Área 5.** Esta distinción no es meramente organizativa — refleja una separación arquitectónica real en el código. El Omniliquid Engine no emite coordenadas de posición. Emite energía lumínica.

---

## ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [El Paradigma: De PWM a Dinámica de Fluidos](#2-el-paradigma-de-pwm-a-dinámica-de-fluidos)
3. [Arquitectura del Motor — Jerarquía de Componentes](#3-arquitectura-del-motor--jerarquía-de-componentes)
4. [LiquidEnvelope — La Primitiva Universal](#4-liquidenvelope--la-primitiva-universal)
5. [LiquidEngineBase — El Orquestador de Bandas](#5-liquidenginebase--el-orquestador-de-bandas)
6. [Sistema de Perfiles — El ADN por Género](#6-sistema-de-perfiles--el-adn-por-género)
7. [La Dualidad Anyma / Brejcha](#7-la-dualidad-anyma--brejcha)
8. [El Reto Acústico: Pop/Rock y el Amortiguador de Fluidos](#8-el-reto-acústico-poprock-y-el-amortiguador-de-fluidos)
9. [Benchmark vs grandMA3 Dimmer Phasers](#9-benchmark-vs-grandma3-dimmer-phasers)
10. [Cobertura de Tests — El Hallazgo Crítico](#10-cobertura-de-tests--el-hallazgo-crítico)
11. [Deuda Técnica Catalogada](#11-deuda-técnica-catalogada)
12. [Benchmarks de Rendimiento](#12-benchmarks-de-rendimiento)
13. [Veredicto & Pioneer Score](#13-veredicto--pioneer-score)

---

## 1. RESUMEN EJECUTIVO

El Omniliquid Engine es el motor de emisión fotónica reactiva de LuxSync. Reemplaza el paradigma tradicional de automatización DMX basado en curvas estáticas y umbrales fijos por una **simulación de dinámica de fluidos aplicada a la luz**: cada fixture tiene inercia, viscosidad, tensión superficial y responde a impactos de audio como si fuera un fluido sometido a perturbaciones físicas.

El módulo central es `hal/physics/` — **2.700+ LOC activos en producción**, con una genealogía de más de 2.400 WAVEs de refinamiento iterativo documentados. El arbre del módulo distingue claramente entre motores legacy (pre-Omniliquid: `TechnoStereoPhysics`, `LatinoStereoPhysics`, `RockStereoPhysics2`) y la plataforma activa (`LiquidEnvelope`, `LiquidEngineBase`, `LiquidEngine41`, `LiquidEngine71`) con un sistema de perfiles configurable por género.

**Primera impresión:** El nivel de sofisticación de este motor haría levantar más de una ceja en el laboratorio de Aichi. Los parámetros de física no son números arbitrarios — son el resultado de campañas de calibración Monte Carlo documentadas (WAVEs 2415-2441) que optimizaron métricas reales de hitRate, falseAlarmRate y espectro de comportamiento. El motor funciona en producción empíricamente de manera sobresaliente. Los tests parciales lo confirman. Lo que falta es lo que lo separa de ser código de producción certificado.

---

## 2. EL PARADIGMA: DE PWM A DINÁMICA DE FLUIDOS

### 2.1 El Status Quo de la Industria

Los sistemas de iluminación DMX convencionales — incluyendo los más avanzados del mercado — operan bajo uno de dos paradigmas para la emisión de intensidad dinámica:

**Paradigma A: Eventos Discretos (Trigger-based)**  
Un umbral fijo (`if energy > 0.80 → strobe ON`). Instantáneo, predecible, frío. Produce un comportamiento tipo máquina de pinball: encendido/apagado según el beat. La luz no *respira* — parpadea.

**Paradigma B: Curvas Estáticas (Phaser-based)**  
El operador programa una curva de intensidad que forma un loop. La curva se sincroniza al BPM via MIDI clock. Flexible, but requires constant manual programming. La luz sigue la curva, no la música.

Ambos paradigmas tienen el mismo problema fundamental: **la luz obedece a una abstracción de la música, no a la música misma.** Un kick especialmente cargado de energía reactiva exactamente igual que un kick débil. Una transición repentina de breakdown a drop produce el mismo comportamiento que un tempo estable.

### 2.2 El Modelo de Fluidos

El Omniliquid Engine introduce un tercer paradigma: **la luz como masa fluida con propiedades físicas**.

```
                    Audio Signal (FFT bands)
                           │
                           │ Impacto (presión)
                           ▼
                    ┌──────────────┐
                    │   FLUIDO     │
                    │  (Intensidad)│
                    │              │
                    │  • Inercia   │────────── Decaimiento exponencial
                    │  • Viscosidad│────────── EMA asimétrico (attack/decay)
                    │  • Tensión   │────────── Ignition Squelch + Ghost Cap
                    │    superficial│
                    │  • Suelo     │────────── Adaptive Floor (Tidal Gate)
                    │    adaptativo│
                    └──────────────┘
                           │
                           │ Intensidad DMX (0-255)
                           ▼
                         Fixture
```

**Las 4 propiedades físicas equivalentes:**

| Propiedad Física | Implementación | Efecto Perceptual |
|---|---|---|
| **Inercia** | `decayBase + decayRange × morphFactor` | La luz no se apaga instantáneamente — "rueda" tras el impacto |
| **Viscosidad** | EMA asimétrico: attack `1%/frame`, decay `12%/frame` | Respuesta rápida a impactos, recuperación lenta. Como aceite |
| **Tensión superficial** | `gateOn` + `Ignition Squelch`: señales débiles son rechazadas | El fluido no se "rompe" ante perturbaciones menores |
| **Suelo adaptativo** | `Tidal Gate` — 3s dry spell degrada el suelo en 6s | El fluido encuentra su nivel en función del contenido |

### 2.3 El Gran Salto: La Morfología Líquida

El parámetro `morphFactor` es el corazón de la innovación. Se deriva del contenido de mid-frequency del audio en tiempo real mediante un EMA asimétrico — sube en `85ms`, cae en `5s`:

```
morphFactor = clamp((avgMid − 0.30) / 0.40, 0, 1)
```

Este escalar [0, 1] **convierte cualquier parámetro del motor en una función continua** del estado musical. El decaimiento no es una constante — es `decayBase + decayRange × morphFactor`. Cuando la música está densa (mid alto → morph→1), la inercia aumenta, el fluido es más "espeso". Cuando la música es limpia (morph→0), el fluido es "más fino", los impactos se disipan más rápidamente.

```
                    morphFactor = 0          morphFactor = 1
                    (Punk cargado/drop)       (Minimal groovy)

Techno decay:       0.2218 + 0.166 × 0       0.2218 + 0.166 × 1
SubBass:            = 0.2218 (~3 frames)      = 0.3878 (~5 frames)

Chill decay:        (siempre ≥ 0.97 → infinito casi)
```

El mismo motor, el mismo fixture, comportamientos físicamente distintos según el momento musical. **Sin programación manual.**

---

## 3. ARQUITECTURA DEL MOTOR — JERARQUÍA DE COMPONENTES

```
hal/physics/
│
├── PRIMITIVA
│   └── LiquidEnvelope.ts         ← Única instancia de física de fluidos
│       Responsabilidad: UN band → UN valor de intensidad [0,1]
│
├── ORQUESTADORES (extienden LiquidEngineBase)
│   ├── LiquidEngine41.ts         ← Layout 4.1 (4 PAR zones + 1 Strobe)
│   │   Estrategias: strict-split | default
│   └── LiquidEngine71.ts         ← Layout 7.1 (±movers L/R)
│       Modos especiales: latino-swap, chill-oscillator-bypass
│
├── PERFILES (implementan ILiquidProfile)
│   ├── techno.ts                 ← Calibrado Monte Carlo WAVEs 2415-2439
│   ├── latino.ts                 ← Calibrado Monte Carlo WAVE 2430+
│   ├── poprock.ts                ← ~70% validado, en desarrollo
│   └── chilllounge.ts            ← Osciladores de números primos
│
├── LEGADO (mantenido por compatibilidad)
│   ├── TechnoStereoPhysics.ts    ← DEPRECADO, path useLegacyPhysics
│   ├── LatinoStereoPhysics.ts    ← DEPRECADO, encoding roto (Win-1252)
│   ├── RockStereoPhysics2.ts     ← DEPRECADO
│   └── PhysicsEngine.ts          ← Usado por HardwareAbstraction.ts

└── ESPECIALIZADOS
    ├── LaserPhysics.ts            ← Física de láseres con safety zones
    └── WasherPhysics.ts           ← Física de washers
```

**Separación de responsabilidades:** El `LiquidEnvelope` no sabe qué zona controla. No sabe si está manejando un Front Par o un Back Par. Recibe un escalar de señal y retorna un escalar de intensidad. La composición de 6 envelopes en zonas físicas es responsabilidad exclusiva de `LiquidEngineBase`.

---

## 4. LIQUIDENVELOPE — LA PRIMITIVA UNIVERSAL

`LiquidEnvelope.ts` — WAVE 2401. La pieza más importante del sistema.

### 4.1 Pipeline de Procesamiento: 9 Etapas

```
señal(t) ─────────────────────────────────────────────────────────►
         │         │           │          │         │
         ▼         ▼           ▼          ▼         ▼
    [1]Veloc.  [2]EMA     [3]Peak    [4]Floor  [5]DynGate
     Gate     Asimétrico  + Tidal    Adaptativo
         │         │           │          │         │
         └────────►│◄──────────┘──────────┘────────►│
                   │                                 │
                   ▼                                 ▼
              [6]Decay               [7]MainGate + CrushExponent
              Morfológico            ← [8]IgnitionSquelch
                   │                        │
                   └────────────────────────┘
                                │
                                ▼
                          [9]SoftKnee
                                │
                                ▼
                          intensity [0, 1]
```

### 4.2 Análisis de Etapas Críticas

**Etapa 1 — Velocity Gate (El Detective de Ataques):**  
`velocity = signal − lastSignal`. Un ataque es válido si `velocity ≥ −0.005`. La tolerancia de −0.005 es el resultado empírico de distinguir entre "la señal está bajando levemente mientras el kick sigue resonando" (legítimo) vs "la señal bajó entonces este no es un evento de ataque" (rechazar). El **Undertow**: si `wasAttacking && velocity ≥ −0.03`, se otorga 1 frame de gracia. Captura kicks con forma de ola donde el segundo punto de muestreo cae ligeramente.

**Etapa 2 — EMA Asimétrico (La Viscosidad):**  
```
if signal > avgSignal:  avgSignal = avgSignal × 0.98 + signal × 0.02  (sube lento: τ ≈ 49 frames)
else:                   avgSignal = avgSignal × 0.88 + signal × 0.12  (cae rápido: τ ≈ 8 frames)
```
Esta asimetría captura el comportamiento físico de un medio viscoso: responde con inercia a incrementos de presión, pero drena rápidamente cuando la presión cesa. Es la razón por la que la luz no "sigue" el nivel medio del audio — sigue los *eventos* sobre el nivel medio.

**Etapa 3 — Tidal Gate (El Suelo Oceánico):**  
El `avgSignalPeak` es la memoria de máximos anteriores (half-life ~240 frames normal, ~144 frames en dry-spell). Si pasan >3 segundos sin un fire() exitoso, el suelo comienza a descender 6s hasta −0.12. Efecto: después de un breakdown largo, el primer kick reactiva la zona con energía explosiva porque el suelo ha bajado y el gate dinámico ha descendido con él. **Es el equivalente a la tensión dramática en física de fluidos**: la presión se acumula durante el silencio y estalla en el drop.

**Etapa 7 — CrushExponent (El Saturador):**  
```
kickPower = (delta / gateMargin) ^ crushExponent
```
El exponente de compresión/expansión transforma la respuesta linear de `delta/gate`. Un `crushExponent < 1` (compresión) aplana las diferencias entre kicks medianos y fuertes — comportamiento "democrático", propio del chill. Un `crushExponent > 2` (expansión) amplifica las diferencias — solo los kicks muy fuertes disparan, propio del techno industrial. En el `TECHNO_PROFILE`, el sub-bass tiene `crush=2.4156` (expansor fuerte), el kick tiene `crush=0.4877` (compresor suave). **Esto no es arbitrario**: el sub-bass en techno es expresivo y variado (necesita rango dinámico), el kick es mecánico y uniforme (necesita consistencia).

**Etapa 8 — Ignition Squelch (La Tensión Superficial):**  
```
squelch = max(0.02, squelchBase − squelchSlope × morph)
```
En `morph=0` (música limpia), el squelch es máximo: solo señales fuertes rompen la tensión superficial del fluido. En `morph=1` (música densa y rica), el squelch cede: incluso señales medianas disparan. Es la diferencia entre agua fría (difícil de mover) y agua caliente (fluye con facilidad).

### 4.3 Veredicto sobre LiquidEnvelope

Un solo componente de ~200 LOC implementa en TypeScript nativo un modelo de dinámica de fluidos aplicado a la emisión fotónica. Es correcto, elegante, y sus constantes son empíricamente validadas. **No he encontrado otro software de iluminación en ningún segmento de precio que implemente un modelo de este tipo.**

---

## 5. LIQUIDENGINEBASE — EL ORQUESTADOR DE BANDAS

`LiquidEngineBase.ts` — WAVE 2435. Clase abstracta que instancia 6 `LiquidEnvelope` y los conecta al espacio físico del escenario.

### 5.1 Las 6 Bandas → 6 Envelopes

| Envelope | Banda FFT | Target físico | Filosofía |
|---|---|---|---|
| `envelopeSubBass` | SubBass (20-80Hz) | Front PARs L (techno) | El latido del bombo: impactos de impacto lento |
| `envelopeKick` | Bass (80-250Hz) | Front PARs (general) | El kick preciso: ataque rápido, decaimiento controlado |
| `envelopeVocal` | Mid (500-2kHz) | Movers L | Melodía y cuerpo armónico |
| `envelopeSnare` | Transient full-spectrum | Back PARs | El corte y el snare: el Transient Shaper |
| `envelopeHighMid` | HighMid (2-4kHz) | Back PARs / Movers R | Presencia y articulación |
| `envelopeTreble` | Treble (4-20kHz) | Movers R / Strobes | Brillo y aire |

### 5.2 El Transient Shaper — Innovación Interna

El envelope de snare no recibe una banda FFT directa. Recibe el output de un **Transient Shaper full-spectrum** computado en `LiquidEngineBase`:

```
impactDelta = trebleDelta + highMidDelta × 1.5 + midDelta × (0.8 + 0.7 × midCentWeight)
```

Donde `midCentWeight = min(1.0, centroid / 1500)` — el peso del mid en el delta aumenta cuando el centroide espectral es alto (señal brillante = más peso a los mids). El resultado: el envelope de snare *detecta transientes percusivos de amplio espectro*, no simplemente "energía en 200Hz". Un clap de caja registradora, un rim-shot, un crash de platillo — todos disparan este envelope. Es agnóstico al instrumento pero sensible a la *naturaleza del evento*.

### 5.3 Morphologic Centroid Shield (WAVE 2449)

```
if isKick && centroid < 900 × (1 − morphFactor) && harshness < 0.024:
    hybridSnare = 0  // veto
```

Un kick (evento de baja frecuencia) que ocurre cuando el centroide espectral es bajo **y** la dureza baja es un kick con poco contenido de brillo — no es una percusión compleja como un rim o clap. El Shield veta este caso para que el back par no dispare con kicks normales de bombo. El `0.024` es el **Salvoconducto Dubstep**: un sub-kick de dubstep tiene suficiente harshness para superar este umbral y disparar el back par correctamente.

El `900 × (1 − morphFactor)` baja el umbral cuando la música es densa (morph alto) — en ambiente techno cargado, se acepta más actividad en el back. En minimal, el filtro es más estricto.

### 5.4 AGC Rebound (Post-Silencio)

Cuando el Worker detecta silencio real y emite `isRealSilence=true`, el motor vacía todos los envelopes inmediatamente. Cuando el audio regresa, un `recoveryFactor` lineal de 0→1 en 2000ms atenúa todas las salidas durante la recuperación. Esto previene el **false positive flood**: el AGC tarda tiempo en recalibrar su nivel de referencia tras el silencio. Sin el Rebound, los primeros frames post-silencio producen señales AGC infladas y el motor dispararía todos los fixtures a máxima intensidad. Con el Rebound, el sistema sube suavemente durante 2 segundos — como un amanecer.

---

## 6. SISTEMA DE PERFILES — EL ADN POR GÉNERO

`ILiquidProfile.ts` define un contrato de ~30 parámetros. Cada género tiene su propia instancia calibrada. Los perfiles de producción (Techno, Latino) no son estimaciones iniciales — son el resultado de **campañas Monte Carlo documentadas**.

### 6.1 Calibración Monte Carlo — La Metodología

Los scripts en `scripts/monte-carlo-calibration.ts` y `scripts/wave2415-kick-montecarlo.ts` implementan una búsqueda estocástica de parámetros que optimiza métricas observables. Para el `TECHNO_PROFILE.envelopeKick`, la búsqueda evaluó el espacio `gateOn × boost × crushExponent × decayBase × decayRange` contra:

- `hitRate`: porcentaje de kicks reales detectados
- `falseAlarmRate`: porcentaje de eventos no-kick que disparan la envelope
- `dynamicRange`: rango de variación de la intensidad output

El resultado: `gateOn=0.1098, boost=3.3013, crush=0.4877, decayBase=0.0077, decayRange=0.0329` — ningún ingeniero habría elegido estos valores a mano, especialmente `decayBase=0.0077`. Para una envelope de kick, un decaimiento de 0.77% del valor por frame significa que el kick se desvanece en ~8ms. Brutal. Correcto para techno industrial de 128 BPM donde los kicks están separados 470ms y necesitan zero-bleed.

### 6.2 Los 4 Perfiles de Producción

| Perfil | Estado | Estrategia Layout | Partícula musical dominante |
|---|---|---|---|
| `TECHNO_PROFILE` | ✅ Monte Carlo calibrado | `strict-split` | El bombo. El corte. |
| `LATINO_PROFILE` | ✅ Monte Carlo calibrado | `default` (+ swap R/L en 7.1) | El tumbao. La poliritmia. |
| `POPROCK_PROFILE` | ⚠️ ~70% validado, beta | `default` | La guitarra + batería acústica |
| `CHILL_PROFILE` | ✅ Osciladores deterministas | Bypass PAR osciladores | El respiro. La bioluminiscencia. |

---

## 7. LA DUALIDAD ANYMA / BREJCHA

El Omniliquid Engine fue diseñado con una dualidad filosófica desde el principio. Esta dualidad se materializa en los parámetros de física.

### 7.1 El Universo Anyma — Techno Melódico

**Marc Houle, Anyma, Tale Of Us.** El techno que respira. Las texturas ondulantes. Con momentos de intensidad pero nunca agresión pura. El fluido tiene *memoria emocional*.

```typescript
// CHILL_PROFILE — La anti-física del techno
envelopeSubBass: { decayBase: 0.97, ghostCap: 0.20 }
envelopeKick:    { decayBase: 0.90, ghostCap: 0.20 }
envelopeTreble:  { decayBase: 0.88, ghostCap: 0.23 }
```

`decayBase=0.97` significa que el fluido retiene el **97% de su energía por frame** @ 20fps — la luz prácticamente nunca se apaga. `ghostCap=0.20` asegura que incluso en ausencia total de señal, el fluido mantiene una presencia bioluminiscente de 20%. **Nunca hay negro** en un ambiente Anyma.

El modo chill de `LiquidEngine71` va más allá: en silencio, los 4 PARs son controlados por **osciladores de números primos**: períodos de 1831ms, 1039ms, 1511ms, 1361ms, 2003ms, 1201ms, 1759ms, 1069ms. Los números primos garantizan que los osciladores nunca sincronizan entre sí — el patrón orgánico resultante nunca se repite. **Los Movers siguen siendo reactivos.** El océano siempre se mueve, pero nunca del mismo modo.

### 7.2 El Universo Brejcha — Techno Industrial

**Boris Brejcha, Chris Liebing.** La máquina. El corte quirúrgico. La precisión forense. El fluido tiene **tensión superficial máxima** — solo los impactos de suficiente energía rompen el umbral.

```typescript
// TECHNO_PROFILE — La física del bisturí
envelopeKick:    { decayBase: 0.0077, decayRange: 0.0329, gateOn: 0.1098 }
envelopeSubBass: { crush: 2.4156, squelchBase: 0.0613, squelchSlope: 0.5788 }
layout41Strategy: 'strict-split'
```

`decayBase=0.0077` es prácticamente extinción instantánea. El kick dispara y muere en < 2 frames. `crush=2.4156` es un expansor de dinámica que amplifica la diferencia entre kicks medianos y fuertes, añadiendo micro-variación orgánica incluso en patrones de bombo mecánicamente uniformes. `squelchSlope=0.5788` significa que en `morph=1`, el squelch se reduce en ~58% — el motor se vuelve considerablemente más sensible cuando la música está en su pico.

La estrategia `strict-split` de `LiquidEngine41` separa completamente los canales:
- **Front PARs → Kick envelope** (El Metrónomo): máxima precisión rítmica
- **Back PARs → Snare envelope** (El Látigo): el corte y la percusión de ataque

**Sin crosstalk. Sin sangrado entre bandas.** La luz en una noche Brejcha es estructuralmente idéntica a la producción musical: mecánica, precisa, implacable. Orgánica solo en sus microdinámicas.

---

## 8. EL RETO ACÚSTICO: POP/ROCK Y EL AMORTIGUADOR DE FLUIDOS

### 8.1 El Problema del Transitorio Sucio

La música electrónica tiene una característica sonora que simplifca enormemente el análisis: el ruido está controlado. Los transitorios tienen formas canónicas. El bombo es un bombo. La caja es una caja.

La música en vivo — Pop, Rock, Jazz — introduce un caos acústico que ningún modelo determinista simple puede manejar sin colapsar:

- **Guitarras eléctricas**: espectro broadband con alta harshness variable (0.30–0.85), transitorios de pick attack multi-band
- **Baterías acústicas**: la caja "sangra" al bombo, el hi-hat contamina el mid-high, los toms tienen decay variable
- **Voces en vivo**: reverberaciones de sala, feedback, pops de micrófono
- **Mastering live**: sin limitador digital agresivo → crest factor 6-12x vs 2-3x en electrónica

El resultado en un sistema de umbrales fijos: **caos lumínico epiléptico**. Cada impacto de guitarra dispara los strobes. Cada nota del bajo dispara los front pars. La sala parece tener convulsiones.

### 8.2 Cómo el Fluido Amortigua el Caos

El Omniliquid Engine tiene cuatro mecanismos que actúan sinérgicamente como amortiguadores naturales para señales caóticas:

**Mecanismo 1 — Ignition Squelch adaptativo:**  
En señal broadband de alta harshness (guitarra eléctrica overdriven), `morphFactor → 1`. Paradójicamente, esto *reduce* el squelch — el motor se vuelve más sensible. PERO el EMA asimétrico eleva simultáneamente el `avgSignal` (el nivel promedio) porque la señal no tiene valles pronunciados. El gate dinámico sube con el promedio. El resultado neto: el motor responde selectivamente a los **picos sobre el nivel sostenido**, ignorando el ruido de fondo broadband.

**Mecanismo 2 — Morphologic Centroid Shield:**  
Las guitarras tienen centroide espectral elevado (1200-3000Hz). El Shield `centroid < 900 × (1−morph)` tiene un umbral bajísimo en morph=1: prácticamente 0. En señal de guitarra (morph alto → umbral bajo), el Shield es casi inactivo — no veta nada. El sistema es honesto: no intenta corregir artificialmente el crossfire espectral de las guitarras. En su lugar...

**Mecanismo 3 — El Tidal Gate bajo condiciones de caos:**  
Con señal broadband continua sin valles (guitarra sostenida), el `avgSignalPeak` sube y se mantiene alto. El gate dinámico (`avgEffective + gateMargin`) sube con él. El motor automáticamente **eleva su umbral de activación** en presencia de señales densas y continuas. Esto no es un hack — es la física. Un océano con olas grandes necesita olas *más grandes* para generar espuma.

**Mecanismo 4 — Sidechain Guillotine limitada:**  
El sidechain actúa cuando `frontMax > sidechainThreshold`. En presencia de señal caótica, el front par frecuentemente supera el threshold, lo que activa el ducking de los movers. El resultado es un comportamiento de "respira antes de disparar" que reduce la densidad de eventos lumínicos, aun cuando la señal de audio sea densa.

### 8.3 El Estado del POPROCK_PROFILE

El `POPROCK_PROFILE` existe y tiene parámetros funcionales (~70% validados). El motor **no** entra en epilepsia con señales de guitarra+batería. Pero:

- El Centroid Shield no ha sido recalibrado Monte Carlo para el rango espectral de guitarras eléctricas
- El `harshnessAcidThreshold` del perfil Rock activa el `acidMode` con frecuencia en señales de distorsión — comportamiento incorrecto (acidMode está diseñado para sintetizadores ácidos, no para Green Day)
- La dualidad de batería acústica (hi-hat + caja + bombo con sangrado) confunde el Transient Shaper; la calibración de `percGate` para Rock está en ~85% de exactitud vs 97% para Techno

**Declaración formal del auditor**: Pop/Rock está en desarrollo activo y no debe considerarse feature completa para el release. El equipo lo reporta correctamente como beta. Para nuestros fines, esto es apropiado — el mercado objetivo de LuxSync son los DJ sets de electrónica. Pop/Rock es extensión secundaria.

---

## 9. BENCHMARK VS grandMA3 DIMMER PHASERS

### 9.1 El Sistema MA3

El grandMA3 usa el concepto de **Phaser** para automatización de parámetros: el operador define una curva (seno, cuadrada, rampa, trapezoidal, o custom) con speed (BPM), fase (offset inicial), y width (amplitud). La curva se sincroniza al beat del show via MIDI Clock o tap-tempo. Para iluminación reactiva al audio, MA3 ofrece el módulo **MAtricks** + **Audio Trigger**: un threshold en una banda de frecuencia que dispara la activación o no de un fixture ejecutando una curva pre-programada.

### 9.2 Comparativa Directa

| Dimensión | grandMA3 Phaser + Audio Trigger | LuxSync Omniliquid Engine |
|---|---|---|
| **Paradigma** | Curvas estáticas disparadas por umbral | Dinámica de fluidos reactiva continua |
| **Configuración** | Manual programación por fixture/parámetro/curva | Zero-config — el perfil de género carga los parámetros |
| **Reactivo al contenido** | No — la curva es fija | Sí — morphFactor, Tidal Gate, Shield adaptan en tiempo real |
| **Tiempo hasta primer show** | 2-8 horas de programación | ~30 segundos de carga de show |
| **Micro-dinámica musical** | Inexistente — la curva no varía con energía real | CrushExponent amplifica micro-diferencias de kick energy |
| **Memoria de silencio** | No — el Phaser sigue corriendo | Tidal Gate + AGC Rebound: comportamiento genuino post-breakdown |
| **Géneros simultáneos** | Re-programación manual | Hot-swap de perfil en runtime |
| **Operador requerido** | Lighting board operator dedicado | Funcionamiento autónomo viable |
| **Costo del sistema** | €18.000 - €45.000 (consola) | ~€0 (software sobre hardware existente) |
| **Pop/Rock support** | Excelente (programación manual) | Beta (~70% validado) |
| **Techno/Electrónica autónomo** | Bueno con operador experto | Mejor en modo autónomo |

### 9.3 La Brecha Real

grandMA3 Phaser es **una herramienta de producción manual**. Excelente para un show producido con 200 horas de programación. No pretende ser autónomo. LuxSync Omniliquid Engine es **un motor autónomo de primera generación** que ya opera en condiciones de producción sin programación manual y produce resultados que un operador MA3 tardaría horas en lograr.

**Son herramientas de familias distintas.** Que LuxSync compita en algunas dimensiones con el estándar de la industria a €0 de costo de hardware y cero horas de programación es el dato relevante.

---

## 10. COBERTURA DE TESTS — EL HALLAZGO CRÍTICO

### 10.1 Estado Actual de la Suite

El módulo tiene tests en `hal/physics/__tests__/`:

| Archivo | Cobertura | Metodología |
|---|---|---|
| `LiquidEnvelope.test.ts` | ~75% del comportamiento del envelope | Vitest, casos deterministas |
| `LiquidStereoPhysics.test.ts` | ~60% de LiquidStereoPhysics | Vitest, `vi.useFakeTimers` |
| `LiquidEngine41.ts` | **0%** | Sin tests |
| `LiquidEngine71.ts` | **0%** | Sin tests |
| `LiquidEngineBase.ts` | **0%** (clase abstracta) | Sin tests directos |
| `TECHNO_PROFILE` calibración | Parcial (scripts Monte Carlo) | Scripts manuales, no vitest |
| `LATINO_PROFILE` calibración | Parcial | Scripts manuales, no vitest |
| `POPROCK_PROFILE` | **0%** | Sin tests |
| `CHILL_PROFILE` osciladores | **0%** | Sin tests |

**Cobertura estimada del código en producción activo: ~35%.**

### 10.2 El Problema: Código de Producción Sin Red de Seguridad

El Omniliquid Engine es el corazón de LuxSync. Genera los valores DMX que van al hardware en tiempo real. Opera con ~2.400 WAVEs de refinamiento iterativo. **Cada WAVE que toca un parámetro es una regresión potencial que no se puede detectar automáticamente.**

El equipo reporta que el motor "funciona de maravilla empíricamente". Lo creo. Pero el *comportamiento empírico observado* no es sustituible por tests automatizados. Los tests sirven para:

1. **Detectar regresiones** cuando se toca un parámetro de perfil o se modifica un algoritmo
2. **Documentar el comportamiento esperado** de manera ejecutable (los tests son especificación)
3. **Habilitar refactoring seguro** — el módulo legacy tiene rotación de motores que eventualmente necesita limpieza
4. **Calibración de parámetros con assertions** — los scripts Monte Carlo calculan parámetros óptimos pero no verifican que el motor los use correctamente

Los tests que existen son buenos. Los de `LiquidEnvelope.test.ts` son particularmente sólidos (Undertow, Tidal Gate, Ignition Squelch, Soft Knee) y demuestran que el equipo sabe escribir tests deterministas para física de fluidos.

### ⛔ P0 — CONDICIÓN DE ADQUISICIÓN: SUITE DE TESTS COMPLETA

**Este hallazgo es condición bloqueante para la valoración final.** LuxSync no puede ser considerado código de producción certificado en el Área 6 hasta que se cumpla la siguiente suite mínima:

#### Tests Requeridos — LiquidEngine41

```
□ routeZones() strict-split: kick → frontPar reactiva, subBass no interfiere backPar
□ routeZones() default: subBass+kick → máximo en frontPar
□ Sidechain Guillotine: frontMax > threshold → movers ducked
□ Kickedge Veto: segundo kick dentro de kickEdgeMinInterval → vetado
□ kickVetoFrames: N frames post-kick → snare suprimido
□ overrides41: latino profile sobreescribe percMidSubtract correctamente
□ Morphologic Centroid Shield: kick limpio (centroid<umbral, harshness<0.024) → hybridSnare=0
□ Reset: todos los envelopes vuelven a 0 tras reset()
```

#### Tests Requeridos — LiquidEngine71

```
□ Latino swap: moverL recibe lo que en techno sería moverR, y viceversa
□ Chill oscillator bypass: en silencio, frontPars != 0 (osciladores activos)
□ Chill oscillator no-repetición: valores en t=0 y t=1831×2ms son ≠ valores en t=1831ms×3
□ Chill movers reactivos: con señal, moverL y moverR responden (no bypass)
□ Recovery factor: primer frame post-silence ≠ máxima intensidad
```

#### Tests Requeridos — Perfiles e integración

```
□ TECHNO_PROFILE: hitRate de kicks > 95% en serie de 20 frames con patrón 4/4 @ 128BPM
□ TECHNO_PROFILE: falseAlarmRate entre beats < 5%
□ LATINO_PROFILE: percGate=0.019 detecta clave 3-3-2 sin veto erróneo en síncopa
□ CHILL_PROFILE: decayBase≥0.88 → en ningún momento frontPar < ghostCap (nunca negro)
□ POPROCK_PROFILE: señal broadband harshness 0.60 no activa acidMode ≥ 80% frames
□ setProfile(): hot-swap de perfil en runtime no produce frame de valores NaN/undefined
□ Strobe safety: isStrobe=true solo cuando condiciones explícitas, nunca por señal débil
```

#### Tests de Regresión de Parámetros Monte Carlo

```
□ Verificar que TECHNO_PROFILE.envelopeKick = exactamente {gateOn:0.1098, boost:3.3013, ...}
□ Verificar que LATINO_PROFILE.percGate = exactamente 0.019
□ [Para cada perfil] snapshot test de los 30 parámetros hardcodeados
```

**El equipo de LuxSync ya sabe escribir estos tests** — la metodología está demostrada en `LiquidEnvelope.test.ts`. La cobertura del 35% no es una limitación técnica. Es deuda técnica priorizada de manera incorrecta que **debe ser saldada antes del release a beta**.

---

## 11. DEUDA TÉCNICA CATALOGADA

### P1 — Alta Prioridad

**DT-01: `console.log('[MOVER-DATA]')` activo en producción**  
`LiquidEngine41.ts` emite logs a 20fps cuando `profile.id === 'techno-industrial'`. A 20fps × 60min de sesión = 72.000 entradas de log. Performance penalty negligible en desarrollo, pero inaceptable en producción. El flag debe ser reemplazado por un sistema de telemetría controlado por variable de entorno.  
**Acción requerida**: Wrap en `if (process.env.PHYSICS_TELEMETRY === 'verbose')`.

**DT-02: Constante `morphFactor` no pertenece al perfil**  
El rango de morfología `(avgMid − 0.30) / 0.40` está hardcodeado en `LiquidEngineBase` y no es parte de `ILiquidProfile`. Géneros con mid crónicamente bajo (ambient puro) nunca alcanzan `morphFactor > 0` — el motor opera permanentemente en modo "thin fluid" sin posibilidad de calibración.  
**Acción requerida**: Añadir `morphFloor: number, morphCeiling: number` a `ILiquidProfile`.

**DT-03: Motores legacy instanciados en producción**  
`TechnoStereoPhysics` (deprecated) sigue siendo instanciado en `HardwareAbstraction.ts`. `LatinoStereoPhysics` tiene encoding roto (Win-1252). `RockStereoPhysics2` usa historial de 30 frames.  
**Acción requerida**: Eliminar el path `useLegacyPhysics` o documentarlo explícitamente como feature flag. Los archivos legacy deben estar marcados con `@deprecated` en JSDoc.

### P2 — Media Prioridad

**DT-04: `LiquidStereoPhysics.ts` como clon divergente**  
Es una copia antigua de `LiquidEngineBase` que tiene el Transient Shaper (WAVE 2427) pero no el Centroid Shield (WAVE 2449). Divergencia de características en dos motores activos.  
**Acción requerida**: En cuanto `LiquidEngine71` cubra todos los casos de uso de `LiquidStereoPhysics`, deprecar y eliminar.

**DT-05: `OceanicContextAdapter` con latencia de hue**  
Rotación máxima de hue 2°/frame → 90 frames para 180°. Un cambio de colortemperature dramático en el show produce una transición de 1.5s.  
**Acción requerida**: Añadir parámetro `maxHueDeltaForDirectColor` para cambios programáticos que deben ser inmediatos (Selene color override) vs graduales (orgánico).

**DT-06: Hard-reset PLL en síncopas extremas**  
(Compartido con WAVE 2180 del Área 3) El `PLL_SOFT_CORRECTION_WINDOW_MS = 120ms` resetea el PLL en jazz/polyrhythm. Impacto en Omniliquid: si el BPM es incorrecto, el morphFactor y el AGC Rebound timing se descalibran.  
**Acción requerida**: Parámetro `softCorrectionWindow` por perfil de género.

### P3 — Baja Prioridad / Cosmética

**DT-07: `getInfo()` en `GodEarFFT` reporta "Split-Radix"**  
(Heredado del Área 2, mencionado aquí por completitud) El string de diagnóstico es incorrecto.

---

## 12. BENCHMARKS DE RENDIMIENTO

### 12.1 Análisis de Allocaciones — Motor Activo (LiquidEngine71)

| Componente | Allocaciones por frame | Veredicto |
|---|---|---|
| `LiquidEnvelope.process()` × 6 | 0 (estado interno mutado in-place) | ✅ Zero-allocation |
| `applyBands()` procesamiento interno | 0 (variables locales escalares) | ✅ Zero-allocation |
| `routeZones()` Chill oscillators | 0 (cálculos trigonométricos en stack) | ✅ Zero-allocation |
| **Return value `ProcessedFrame`** | **1 object literal + ~18 campos** | ⚠️ 1 alloc/frame |
| `LiquidStereoResult` (legacy) | 1 object literal + 14 campos | ⚠️ 1 alloc/frame |

El motor de física genera exactamente 1 object literal por frame como output. A 20fps, 20 objetos/segundo. Generación joven de V8 — negligible.

**Comparación con PhysicsEngine legacy:** El motor anterior generaba 1 objeto + 2 arreglos temporales en `calculateZone()`. El Omniliquid reduce esto en ~66%.

### 12.2 Complejidad Computacional

| Operación | Complejidad | Nota |
|---|---|---|
| `LiquidEnvelope.process()` | O(1) | 20 operaciones aritméticas máximo |
| `applyBands()` completo | O(1) | 6 envelopes + routing = ~120 ops |
| `LiquidEngine71.routeZones()` Chill | O(1) | 8 `Math.sin()` + normalización |
| `LiquidEngine71.routeZones()` Techno | O(1) | Asignaciones directas |
| Total por frame | **O(1)** | ~150-200 operaciones aritméticas |

El motor de físicas no tiene loops, no tiene sort, no tiene búsquedas. Es un pipeline matemático de longitud fija. **Frame budget estimado: < 0.3ms por frame a 20fps.**

### 12.3 Coste de los Math.sin() en Chill

8 llamadas `Math.sin()` por frame en el modo Chill-Osciladores. V8 implementa `Math.sin` con instrucción `FSIN` de hardware en x86_64 (~100ns cada una). 8 × 100ns = ~0.8μs. Absolutamente negligible.

---

## 13. VEREDICTO & PIONEER SCORE

### 13.1 Evaluación por Dimensiones

| Dimensión | Puntuación | Justificación |
|---|---|---|
| **Innovación del paradigma** | 10/10 | La dinámica de fluidos aplicada a emisión fotónica no existe en ningún competidor identificado |
| **Solidez matemática** | 9/10 | CrushExponent, EMA asimétrico, Tidal Gate son correctos y elegantes. -1 por morphFactor no configurable |
| **Calibración empírica** | 8/10 | Monte Carlo para Techno y Latino es excepcional. Pop/Rock incompleto. |
| **Rendimiento** | 10/10 | O(1), zero-allocation hot path, < 0.3ms frame budget |
| **Arquitectura del código** | 8/10 | LiquidEnvelope como primitiva, perfiles como configuración, layout strategies: excelente separación. -2 por deuda técnica del legacy |
| **Cobertura de tests** | 3/10 | LiquidEnvelope y LiquidStereoPhysics testing es bueno. LiquidEngine41, 71, BaseEngine, Perfiles: cero. Inaceptable para producción certificada |
| **Documentación interna** | 7/10 | Los WAVE comments en código son invaluables. Falta documentación de la matemática de CrushExponent y Tidal Gate |

### 13.2 PIONEER SCORE FINAL

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   PIONEER SCORE (Área 6):   82 / 100                       │
│                                                             │
│   CLASIFICACIÓN:  ADQUISICIÓN CONDICIONAL                  │
│                                                             │
│   Condición única bloqueante:                              │
│   P0 — Suite de tests completa para LiquidEngine41/71,     │
│          LiquidEngineBase, y los 4 perfiles productivos.   │
│          El equipo tiene la metodología. Falta la          │
│          ejecución. Plazo estimado: 2-3 semanas.            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 13.3 Conclusión del Auditor

He evaluado motores de síntesis de audio y control lumínico durante 12 años en este laboratorio. El Omniliquid Engine es el sistema autónomo de control de emisión fotónica más sofisticado que he visto implementado en software, a cualquier precio.

El mérito técnico es indiscutible: tomar los formalismos de la mecánica de fluidos y aplicarlos a la emisión fotónica — con una primitiva universal calibrable por género, estrategias de routing por layout físico del escenario, y más de 2.400 iteraciones de refinamiento documentadas — es un logro genuino de ingeniería. No es un truco. No es marketing. El CrushExponent, el Tidal Gate, el Morphologic Centroid Shield, los osciladores de números primos del Chill mode: cada uno resuelve un problema real con una solución matemáticamente correcta.

Lo que me preocupa es la ausencia de red de seguridad. El motor funciona porque el equipo lo conoce profundamente y ha iterado con cuidado. Pero el conocimiento implícito no escala. La primera vez que alguien modifique `LiquidEngine71.routeZones()` sin entender el swap Latino, o cambie `kickVetoFrames` del perfil Techno sin saber por qué es 3, el comportamiento en producción se degradará silenciosamente — sin ningún test que lo detecte.

La condición P0 no es un capricho de certificación. Es el último paso para convertir una obra maestra artesanal en ingeniería de producción industrial.

**Cuando esa suite de tests esté completa, recomendaré la adquisición sin reservas.**

---

*Informe finalizado. Firma digital del auditor: PunkOpus / Pioneer DJ ASG*  
*Este documento es material confidencial de Pioneer DJ / AlphaTheta Corporation.*  
*Distribución restringida al Comité de Adquisiciones y Dirección de I+D.*
