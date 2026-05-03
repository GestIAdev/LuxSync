# WAVE 2671 — LA PARADOJA MECÁNICA
## Tormenta de Ideas Arquitectónicas

**Autor:** PunkOpus  
**Contexto:** WAVE 2662 completado. El Árbitro es absoluto. Ahora enfrentamos la tensión física: Selene piensa a 60fps, la rueda de color del Beam 2R necesita 500ms para girar. El `HardwareSafetyLayer` protege el motor pero mata energía del show al bloquear.  
**Restricción:** No Mocks, no simulaciones, no atajos. *Axioma Perfection First*.

---

## LA TENSIÓN FUNDAMENTAL

```
SELENE (mente):  Frame 1 → Frame 2 → Frame 3 → ... → Frame 30
                 ROJO       AZUL       VERDE            MAGENTA
                 ← ─────────── 500ms ─────────────── →

BEAM 2R (cuerpo): ROJO ████████████████████████████████ ROJO
                  "No puedo. Estoy girando."
                  
SAFETY LAYER:     ✋ BLOCK ✋ BLOCK ✋ BLOCK ... ✋ BLOCK
                  "Cierro todo hasta que termine."
```

El resultado: **el fixture se congela**. Pierde sincronía con el beat, pierde energía, se queda atrás del show. Los LEDs bailan y los movers se quedan mirando. El problema no es el bloqueo — el bloqueo es correcto. El problema es que **congelarse es la única respuesta al bloqueo**.

Las soluciones "obvias" (desacoplar canales, Dark-Spin, routing inteligente) ya las consideramos. Radwulf quiere algo nuevo. Aquí van.

---

## CONCEPTO 1: EL PÉNDULO ARMÓNICO
### *"La rueda no gira al ritmo del beat. El beat se adapta al ritmo de la rueda."*

#### Inspiración: Resonancia Mecánica

En física, cuando aplicas fuerza a un péndulo a su **frecuencia natural**, la amplitud se maximiza con mínima energía. Cuando aplicas fuerza a una frecuencia arbitraria, gastas energía luchando contra la inercia y obtienes oscilaciones caóticas.

La rueda de color de un Beam 2R ES un péndulo. Tiene una frecuencia natural de cambio: `1 / minChangeTimeMs` = 2Hz (un cambio cada 500ms). Actualmente, Selene intenta forzar cambios a 60Hz y el SafetyLayer bloquea 58 de cada 60 intentos. **Estamos luchando contra la resonancia.**

#### La Idea

Crear un **Harmonic Quantizer** — un componente que vive ENTRE el `EffectManager` y el `MasterArbiter` (o dentro del intent resolution del Orchestrator). Su trabajo: **cuantizar temporalmente** los cambios de color para fixtures mecánicos a la frecuencia resonante más cercana que sea armónica con el BPM del track.

#### Mecánica

1. **Input:** BPM actual (del AudioBrain), `minChangeTimeMs` del fixture (del perfil), color intent del EffectManager.
2. **Cálculo de armónicos viables:**

```
BPM = 128
beatPeriod = 60000 / 128 = 468.75ms

minChangeTimeMs = 500ms

// Encontrar el armónico más cercano que respete el hardware:
// Un cambio cada beat:      468.75ms  ← DEMASIADO RÁPIDO (< 500ms)
// Un cambio cada 2 beats:   937.50ms  ← VIABLE ✓ (1.07Hz)
// Un cambio cada 4 beats:  1875.00ms  ← VIABLE ✓ (0.53Hz)
// Un cambio cada bar:      1875.00ms  ← VIABLE ✓ (misma cosa en 4/4)

harmonicPeriod = nextHarmonicAbove(beatPeriod, minChangeTimeMs)
// Para BPM=128: harmonicPeriod = 937.5ms (cada 2 beats)
```

3. **Cuantización:** El Harmonic Quantizer NO envía cada frame un color diferente. Envía el **mismo color durante `harmonicPeriod` frames**, y cuando llega el beat cuantizado, envía el **siguiente color de la secuencia del efecto**.

4. **Efecto musical:** El mover cambia de color EN el beat (o cada 2 beats, o cada bar), nunca entre beats. El cambio es musicalmente coherente. No hay congelamiento porque no hay intentos bloqueados — los intentos son pre-filtrados para llegar exactamente cuando el hardware puede responderlos.

#### Lo Radical

El SafetyLayer NUNCA se activa para estos fixtures. No hay bloqueos, no hay chaos detection, no hay latch. El Harmonic Quantizer previene el conflicto antes de que exista.

Pero lo verdaderamente radical es esto: **los beats intermedios (los que no tienen cambio de color) no se desperdician**. Durante esos beats, el fixtures se compensa con otros canales:

- **Dimmer pulsing:** Mantiene el color, pero pulsa la intensidad al beat
- **Movement sync:** Usa los beats de "espera cromática" para movimientos expresivos
- **Gobo rotation:** Si el fixture tiene gobo, rota el gobo durante la espera del color

Es decir: la limitación mecánica se convierte en una **coreografía complementaria**. Mientras la rueda espera, el cuerpo del fixture baila con todo lo demás.

#### El Cálculo de Armónicos

```
function findResonantPeriod(bpm: number, minChangeMs: number): number {
  const beatMs = 60000 / bpm
  
  // Subdivisiones musicales: 1 beat, 2 beats, 1 bar, 2 bars, 4 bars
  const musicalDivisions = [1, 2, 4, 8, 16]
  
  for (const div of musicalDivisions) {
    const period = beatMs * div
    if (period >= minChangeMs * 1.1) {  // 10% headroom para jitter
      return period
    }
  }
  
  // Fallback: 4 bars siempre es seguro
  return beatMs * 16
}

// Ejemplos:
// BPM=128, min=500ms → 937.5ms (cada 2 beats)
// BPM=140, min=500ms → 857.1ms (cada 2 beats)  
// BPM=174 (D&B), min=500ms → 689.6ms (cada 2 beats)
// BPM=85 (reggaeton), min=500ms → 705.8ms (cada 1 beat) ← ¡Un beat basta!
// BPM=70 (hip-hop), min=500ms → 857.1ms (cada 1 beat)
```

#### Dónde Vive

En el pipeline WAVE 2662, justo donde el Orchestrator construye el `EffectIntentMap`:

```
EffectManager.getCombinedOutput()
  → Zone Resolution
  → ★ Harmonic Quantizer (per-fixture, per-channel) ★
  → EffectIntentMap (ya cuantizado)
  → MasterArbiter.setEffectIntents()
  → MasterArbiter.arbitrate()
  → HAL.renderFromTarget()
```

El Quantizer consulta el AudioBrain para el BPM y el perfil del fixture para el `minChangeTimeMs`. Los fixtures LED lo atraviesan sin cambios (pass-through). Solo los mecánicos se cuantizan.

#### Ventaja Artística

No es un "workaround". Es un UPGRADE. El mover mecánico deja de ser un fixture torpe que no puede seguir el ritmo — se convierte en un instrumento musical que toca en su propio compás. Como un contrabajo en una banda de jazz: no toca todas las notas del piano, pero las que toca caen exactamente en el pocket y con todo el peso.

---

## CONCEPTO 2: EL DEGRADÉ CINEMÁTICO
### *"La rueda no salta entre colores. La luz se transforma DURANTE el viaje."*

#### Inspiración: Interpolación Cinemática y Motion Blur

En cine, cuando la cámara se mueve rápido, no ves posiciones discretas — ves **motion blur**. El movimiento entre posiciones se convierte en una textura visual. En animación 3D, las curvas de Bézier no saltan entre keyframes — **interpolan suavemente** con easing.

La rueda de color, al girar de Rojo (DMX 15) a Azul (DMX 90), FÍSICAMENTE pasa por Orange (30), Yellow (45), Green (60) y Cyan (75). Esos colores intermedios **existen en la realidad** — los vemos como un flash feo y no deseado. Pero ¿y si los abrazamos?

#### La Idea

Crear un **Cinematic Gradient Engine** — un sistema que, cuando detecta que un cambio de color en la rueda va a ocurrir, **orquesta el dimmer y el shutter para esculpir la transición** en vez de ignorarla o esconderla.

La rueda de color del Beam 2R tiene 12 colores en orden cromático parcial. Cuando le pides ir de Rojo a Azul, pasa por 5 colores intermedios. En vez de:

```
Frame 0:   Rojo, Dimmer=255    (limpio)
Frame 1-29: Rojo→???→Azul      (basura visual, blur feo)
Frame 30:  Azul, Dimmer=255    (limpio)
```

El Cinematic Gradient Engine produce:

```
Frame 0:    Rojo, Dimmer=255        (último frame limpio del color anterior)
Frame 1:    Transitioning, Dimmer=180   (empieza a bajar — anticipación)
Frame 3:    Transitioning, Dimmer=80    (casi apagado — el blur se oculta)
Frame 5:    Transitioning, Dimmer=20    (mínimo — la rueda gira en semi-oscuridad)
Frame 15:   Transitioning, Dimmer=20    (la rueda sigue girando, invisible)
Frame 25:   Azul llegando, Dimmer=80    (empieza a subir — la reveal)
Frame 27:   Azul estable, Dimmer=180   (acelerando — build up)
Frame 30:   Azul, Dimmer=255           (full reveal — impacto)
```

#### La Curva

No es un fade lineal. Es una **curva de ataque cinematográfico**:

```
Dimmer
  255 ┤██                                    ██
      │  ██                                ██
  200 ┤    ██                            ██
      │      ██                        ██
  150 ┤        ██                    ██
      │          ████            ████
  100 ┤              ██        ██
      │                ██    ██
   50 ┤                  ████
      │                  ████  ← "Valle Cinemático"
    0 ┤─────────────────────────────────────────
      Frame 0   5   10   15   20   25   30
              ←─── Girar Rueda ───→
```

La curva tiene tres fases:
1. **Fade-Out (anticipación):** El dimmer baja con una curva ease-out (rápido al principio, suave al final). El público siente que algo va a cambiar.
2. **Valle Cinemático:** El dimmer está al mínimo mientras la rueda gira. La transición mecánica es invisible o casi invisible.
3. **Fade-In (revelación):** El dimmer sube con ease-in (suave al principio, explosivo al final). El nuevo color aparece con impacto dramático.

#### Mecánica

El sistema necesita saber tres cosas:
1. **Distancia cromática en la rueda:** ¿Cuántas posiciones tiene que girar? Rojo→Azul = 5 posiciones. Rojo→Orange = 1 posición.
2. **Tiempo de tránsito:** Proporcional a la distancia. 1 posición ≈ 100ms, 5 posiciones ≈ 500ms.
3. **Curva del dimmer:** Calculada para que el valle coincida exactamente con el tramo mecánico de tránsito.

```
// Distancia en la rueda (posiciones de diferencia)
function wheelDistance(fromDmx: number, toDmx: number, wheelColors: WheelColor[]): number {
  const fromIdx = wheelColors.findIndex(c => c.dmx === fromDmx)
  const toIdx = wheelColors.findIndex(c => c.dmx === toDmx)
  if (fromIdx === -1 || toIdx === -1) return wheelColors.length // worst-case
  
  // Distancia más corta (la rueda puede girar en ambas direcciones en muchos fixtures)
  const forward = (toIdx - fromIdx + wheelColors.length) % wheelColors.length
  const backward = (fromIdx - toIdx + wheelColors.length) % wheelColors.length
  return Math.min(forward, backward)
}

// Tiempo estimado de tránsito
function estimateTransitTime(distance: number, minChangeTimeMs: number): number {
  // Heurística: la primera posición cuesta minChangeTimeMs, 
  // las siguientes son más rápidas porque la rueda ya está en movimiento
  return minChangeTimeMs + (distance - 1) * (minChangeTimeMs * 0.4)
}

// Generar perfil de dimmer para la transición
function generateCinematicCurve(
  transitTimeMs: number, 
  fps: number
): number[] {
  const totalFrames = Math.ceil(transitTimeMs / (1000 / fps))
  const curve: number[] = []
  
  for (let i = 0; i < totalFrames; i++) {
    const t = i / (totalFrames - 1)  // 0 → 1
    
    // Curva simétrica con valle profundo:
    // cos² mapeado para que t=0 → 1, t=0.5 → 0, t=1 → 1
    const dimmerNormalized = Math.cos(Math.PI * t) ** 2
    
    // No llegar a 0 absoluto — dejar un rastro mínimo (5%) para que
    // el ojo no pierda tracking del fixture en la oscuridad total
    const dimmerFinal = Math.round(255 * Math.max(dimmerNormalized, 0.05))
    curve.push(dimmerFinal)
  }
  
  return curve
}
```

#### Dónde Vive — Y Aquí Está Lo Interesante

Este sistema NO vive en el SafetyLayer. No vive en el Arbiter. Vive como un **componente de transición** dentro del `HardwareAbstraction` layer, DESPUÉS del Arbiter pero ANTES del DMX send. Es puro hardware-awareness:

```
MasterArbiter.arbitrate()  →  FinalLightingTarget
  → HAL.renderFromTarget()
    → ColorTranslator.translate(targetRGB)
    → ★ CinematicGradientEngine.intercept(fixtureId, newWheelDmx, currentDimmer) ★
      → Si la rueda no cambia: pass-through (no hace nada)
      → Si la rueda cambia: inicia secuencia cinemática
        → Override del dimmer con la curva generada
        → El color_wheel se envía INMEDIATAMENTE (la rueda empieza a girar)
        → El dimmer sigue la curva hasta que la rueda llega
    → HardwareSafetyLayer.filter() ← YA NO BLOQUEA (no hay chaos porque solo hay 1 cambio)
    → sendToDriver() → DMX
```

#### Variantes de la Curva Según Contexto Musical

La curva no es fija. Se adapta al contexto:

| Contexto           | Comportamiento                                               |
| ------------------ | ------------------------------------------------------------ |
| **Drop incoming**  | Valle más profundo, reveal más explosiva (ease-in cúbico)    |
| **Buildup**        | Valle gradual, el dimmer baja lentamente dando tensión       |
| **Breakdown**      | Valle suave, transición casi imperceptible (ambient feel)    |
| **Beat fuerte**    | Valle agudo y corto — el cambio se alinea con el golpe       |
| **Sin audio**      | Coseno suave estándar — cinematográfico neutral              |

El `AudioBrain` ya provee `energyTrend`, `dropDetected`, `isBuildup`. El CinematicGradientEngine los consume para seleccionar la variante de curva.

#### Ventaja Artística

En el mundo real, los operadores de luces profesionales (los buenos) YA hacen esto manualmente: bajan el dimmer, cambian el color, suben el dimmer. Es una técnica clásica. Lo que hacemos es **automatizarla con precisión milimétrica y sincronización musical**, algo que un humano no puede hacer a 60fps.

El resultado: cada cambio de color de un mover mecánico se convierte en un **evento dramático**. No es un salto brusco ni un congelamiento — es un breath, una respiración visual. El fixture inhala (fade-out), muta (giro de rueda en la sombra), y exhala (fade-in del nuevo color).

---

## CONCEPTO 3: EL ESPECTRO DISCRETO
### *"No traduzcas el arcoíris a 12 crayones. Compón con los 12 crayones que tienes."*

#### Inspiración: Síntesis Granular en Audio

En síntesis de audio, la síntesis granular NO intenta reproducir un sonido continuo sample por sample. En lugar de eso, toma **granos** discretos de sonido y los combina, superpone, y reorganiza para crear texturas imposibles con samples continuos. Un violín granularizado no suena como un violín — suena como algo nuevo y fascinante.

La rueda de color del Beam 2R tiene 12 colores. El EffectManager produce un espectro HSL continuo (infinitos colores). Actualmente, el `ColorTranslator` busca el color de rueda más cercano (CIE76 ΔE*) y fuerza un mapeo 1:1. Esto genera dos problemas:

1. **Pérdida perceptual:** El color "ideal" (HSL arbitrario) casi nunca coincide con un color de la rueda. ΔE* > 20 es común. El público ve "algo parecido".
2. **Cambios innecesarios:** Dos HSL consecutivos diferentes pueden mapearse al MISMO color de rueda (ej: HSL(355°,100%,50%) y HSL(5°,100%,50%) ambos mapean a "Red"). La rueda no necesita moverse, pero el sistema no lo sabe hasta que el ColorTranslator ya procesó.

#### La Idea

Invertir la jerarquía creativa. En vez de que Selene piense en HSL continuo y la HAL reduzca a 12 colores, crear un **Discrete Spectrum Composer** que:

1. **Pre-compute:** Al cargar el fixture profile, genera el "palette DNA" — un mapa de las 12 posiciones de la rueda en CIE L*a*b* space con sus distancias perceptuales entre pares adyacentes.
2. **Effect-level awareness:** El EffectManager (o un adapter antes del intent resolution) recibe el palette DNA y compone sus secuencias de color DENTRO del espectro discreto disponible, no contra el continuo HSL.
3. **Transition-aware sequencing:** Las secuencias de color se optimizan para minimizar la distancia de rueda entre colores consecutivos, maximizando la velocidad aparente del efecto.

#### Mecánica: El Palette DNA

```
Beam 2R Color Wheel — Palette DNA:

Position │ Color        │ DMX │ L*a*b*              │ Distance to Next
─────────┼──────────────┼─────┼─────────────────────┼──────────────────
   0     │ White        │  0  │ (100, 0, 0)         │ ΔE=116 →
   1     │ Red          │ 15  │ (53, 80, 67)        │ ΔE=64  →
   2     │ Orange       │ 30  │ (69, 49, 64)        │ ΔE=38  →
   3     │ Yellow       │ 45  │ (97, -22, 94)       │ ΔE=137 →
   4     │ Green        │ 60  │ (88, -86, 83)       │ ΔE=68  →
   5     │ Cyan         │ 75  │ (91, -48, -14)      │ ΔE=85  →
   6     │ Blue         │ 90  │ (32, 79, -108)      │ ΔE=97  →
   7     │ Magenta      │ 105 │ (60, 98, -60)       │ ΔE=55  →
   8     │ Light Blue   │ 120 │ (57, 14, -47)       │ ΔE=74  →
   9     │ Pink         │ 135 │ (67, 55, -37)       │ ΔE=48  →
  10     │ UV Purple    │ 150 │ (25, 61, -78)       │ ΔE=160 →
  11     │ CTO          │ 165 │ (84, 8, 30)         │ ΔE=... →
```

#### Composición Discreta de Efectos

Cuando Selene quiere un efecto "rainbow chase" (recorrer el espectro), actualmente genera:

```
HSL: 0° → 30° → 60° → 90° → 120° → 150° → 180° → 210° → 240° → 270° → 300° → 330°
     Rojo  Nrnj   Amrl  Amrl   Vrde   Cian   Cian   Azul   Azul   Mgnta  Mgnt   Rosa

Wheel: 15 → 30 → 45 → 45 → 60 → 75 → 75 → 90 → 90 → 105 → 105 → 135
       (12 HSL values → solo 9 cambios reales de rueda, 3 son redundantes)
```

Con el Discrete Spectrum Composer:

```
Palette-native sequence (optimized):
Red → Orange → Yellow → Green → Cyan → Blue → Magenta → Pink → UV → CTO
15  →   30   →   45   →  60   →  75  →  90  →   105   → 135  → 150 → 165

Cada paso = 1 posición de rueda = mínimo tiempo de tránsito
Todo el rainbow en 10 pasos de ~100ms cada uno = 1 segundo total
```

En vez de 12 pasos con 3 redundantes y distancias variables, tenemos 10 pasos con distancia constante de 1 posición. **La rueda se mueve a velocidad constante — la pasamos al modo de giro continuo (spinStartDmx: 190).**

#### El Momento Eureka: El Modo Spin como Instrumento

El Beam 2R tiene `allowsContinuousSpin: true` con `spinStartDmx: 190`. DMX 190-255 = giro continuo a velocidades variables. Esto es un **rainbow automático controlado por hardware**.

El Discrete Spectrum Composer puede decidir:

```
SI el efecto pide un chase multicolor a velocidad > umbral ENTONCES
  → No enviar colores discretos uno por uno
  → Enviar DMX 190 + (velocidadDeseada * 65) al canal color_wheel
  → La rueda gira SOLA a la velocidad correcta
  → El SafetyLayer ve UN SOLO cambio de DMX (de color discreto a spin)
  → Cero bloqueos, cero chaos, cero latch
  → La velocidad de spin se modula frame-a-frame (es un valor DMX continuo, no un cambio de posición)
```

La ironía hermosa: la solución más radical para un chase multicolor rápido en un fixture mecánico es **dejar de pelear contra la mecánica y dejar que el hardware haga lo que literalmente está diseñado para hacer**. El giro continuo EXISTE en el protocolo DMX de estos fixtures. Solo que nadie lo usa porque los softwares de iluminación piensan en "seleccionar UN color", no en "modular la velocidad de rotación como un instrumento".

#### Dónde Vive

Dos componentes:

**A) `PaletteDNA` (inicialización)** — Se genera al registrar un fixture con rueda de color. Pre-computa las distancias CIE76 entre todas las posiciones, identifica clusters perceptuales, y determina si el fixture soporta spin continuo.

**B) `DiscreteSpectrumAdapter` (runtime)** — Vive en el Orchestrator, ANTES del intent resolution. Cuando el EffectManager produce un `colorOverride` HSL para una zone que contiene fixtures mecánicos:

```
EffectManager.getCombinedOutput()
  → Zone Resolution
  → ★ DiscreteSpectrumAdapter.adapt(effectOutput, zoneFixtures) ★
    → Para fixtures LED: pass-through (HSL directo)
    → Para fixtures mecánicos:
      → ¿El efecto es un chase rápido? → Spin mode (DMX 190+)
      → ¿El efecto es cambios discretos? → Palette-optimized sequence
      → ¿El efecto es color estático? → Nearest wheel color (como hoy)
  → EffectIntentMap
  → MasterArbiter.setEffectIntents()
```

#### Ventaja Artística

El fixture mecánico deja de ser una aproximación inferior de un LED. Se convierte en un instrumento con su propia paleta: 12 colores con identidad propia, transiciones a velocidad controlada por motor, y un modo de giro continuo que produce un arcoíris real (no simulado con PWM). Es como la diferencia entre un sintetizador digital (infinita resolución, cero carácter) y un piano acústico (88 teclas fijas, pero cada una con armónicos, resonancia y alma).

---

## CONCEPTO BONUS: LA INERCIA EXPRESIVA
### *"El retraso mecánico no es latencia. Es swing."*

#### Inspiración: Swing y Feel en Música  

En jazz y hip-hop, los músicos deliberadamente tocan "detrás del beat" o "adelante del beat". No es un error — es **feel**. Un baterista que toca exactamente en el grid MIDI suena robótico. Un baterista que toca 20ms tarde suena groovy. La imperfección temporal es expresiva.

Los fixtures mecánicos tienen inercia inherente. La rueda no salta de Rojo a Azul — se **desliza** con un perfil de aceleración-desaceleración. El pan/tilt de un stepper motor no llega instantáneamente — es un smooth arrival con overshoot mínimo.

#### La Idea

En vez de compensar la inercia (como hace el FixturePhysicsDriver), **modelarla como parámetro expresivo** y hacerla visible al engine de efectos.

Cada fixture mecánico tendría un `InertiaProfile`:

```typescript
interface InertiaProfile {
  // Delay inherente antes de que el motor responda
  responseLatencyMs: number   // ~30ms para steppers de calidad
  
  // Curva de aceleración del motor (0→maxSpeed)
  accelerationCurve: 'linear' | 'ease-in' | 's-curve'
  
  // Overshoot: ¿el motor "pasa de largo" y vuelve?
  overshootFactor: number     // 0 = perfecto, 0.05 = ligero bounce
  
  // ¿El fixture es "delantero" o "trasero" respecto al beat?  
  // Se mide empíricamente con la calibración Monte Carlo
  mechanicalSwing: number     // -1 (adelantado) a +1 (retrasado), 0 = neutro
}
```

El `mechanicalSwing` se alimentaría al Orchestrator de esta forma: cuando Selene dispara un cambio de color/posición, el intent se **pre-envía** con un offset temporal para que el RESULTADO MECÁNICO coincida con el beat, no el COMANDO DMX.

```
Sin compensación de swing:
  Beat:    ┃                    ┃                    ┃
  DMX:     ┃ → envía comando    ┃ → envía comando    ┃
  Motor:   ┃   ···llega···      ┃   ···llega···      ┃
  Resultado:    ↑ (30ms tarde)       ↑ (30ms tarde)
  
Con compensación de swing (pre-send):
  Beat:    ┃                    ┃                    ┃
  DMX:  ┃ → envía 30ms antes   ┃ → envía 30ms antes ┃
  Motor:┃  ···llega···         ┃  ···llega···        ┃
  Resultado: ↑ (EN el beat)         ↑ (EN el beat)
```

**Pero** — y aquí está el twist creativo — el sistema también permite EXAGERAR el swing intencionalmente. Si el DJ quiere un feel "laid-back" en un set de deep house, el `mechanicalSwing` se podría amplificar: los movers llegarían deliberadamente 50ms tarde, creando un efecto de "arrastre" visual que complementa el groove musical.

Es la diferencia entre un metrónomo y un músico. LuxSync ya piensa como una IA a 60fps milimétricos. Los movers mecánicos piensan como músicos de jazz. **En vez de forzar la precisión digital sobre el hardware análogo, abrazamos la expresividad orgánica de la inercia.**

---

## MATRIZ COMPARATIVA

| Aspecto              | Péndulo Armónico        | Degradé Cinemático       | Espectro Discreto         | Inercia Expresiva        |
| -------------------- | ----------------------- | ------------------------ | ------------------------- | ------------------------ |
| **Dónde vive**       | Pre-Arbiter (Orch.)     | Post-Arbiter (HAL)       | Pre-Arbiter (Orch.)       | Pre-Arbiter (Orch.)      |
| **Qué resuelve**     | Frecuencia de cambio    | Transición fea           | Paleta wrong              | Timing impreciso         |
| **Complejidad**      | Media                   | Alta                     | Media-Alta                | Baja                     |
| **Requiere BPM**     | Sí (es el core)         | Opcional (mejora curvas)  | No                        | Sí                       |
| **Requiere Profile** | Solo minChangeTimeMs    | minChangeTimeMs + wheel  | Wheel completa + spin     | Motor specs              |
| **SafetyLayer**      | Casi nunca se activa    | Casi nunca se activa     | Eliminado para spin mode  | Sin cambios              |
| **Impacto visual**   | Musical, rítmico        | Dramático, cinematográfico| Cromáticamente nativo    | Groove, feel orgánico    |
| **Combinable con**   | Todos                   | Péndulo + Inercia        | Péndulo + Degradé         | Todos                    |

---

## LA SÍNTESIS: EL MOTOR DE PRESENCIA MECÁNICA

Los cuatro conceptos no son mutuamente excluyentes. Pueden componerse en un stack:

```
EffectManager.getCombinedOutput()
  → Zone Resolution
  → [1] DiscreteSpectrumAdapter (¿spin mode? ¿palette-native?)
  → [2] HarmonicQuantizer (cuantizar al beat resonante)
  → [3] InertiaCompensator (pre-send con swing)
  → EffectIntentMap
  → MasterArbiter.arbitrate()
  → HAL.renderFromTarget()
    → [4] CinematicGradientEngine (esculpir dimmer durante tránsito)
  → DMX
```

1. Primero, el **Espectro Discreto** decide SI hay que cambiar de color y a cuál (palette-native) o si es mejor usar spin continuo.
2. Luego, el **Péndulo Armónico** decide CUÁNDO cambiar (cuantizado al beat).
3. Después, la **Inercia Expresiva** ajusta EXACTAMENTE cuándo enviar el comando (pre-send con swing).
4. Finalmente, el **Degradé Cinemático** esculpe CÓMO se ve la transición (curva de dimmer).

El fixture mecánico deja de ser "el fixture lento que no puede seguir el ritmo". Se convierte en **un instrumento expresivo con su propia voz, su propio ritmo, y su propia personalidad**. 

La paradoja mecánica no se resuelve — se transciende.

---

*WAVE 2671 — La mente y el cuerpo dejan de pelear. Bailan.*
