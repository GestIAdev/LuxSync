# ⚙️🎨 Kinetic-Chromatic Core — El Software que Protege tu Hardware

**Documento:** Ficha de producto — Motor Cinético + Motor Cromático de LuxSync  
**Audiencia:** Técnicos de iluminación, rental companies, operadores de sala, técnicos de touring, ingenieros de AV  
**Versión:** Beta 1.0 — Marzo 2026

---

## El problema que nadie menciona en los tutoriales

Hay un coste oculto en la automatización de iluminación que ningún software de la competencia te explica antes de comprarlo.

Los movers tienen steppers. Los steppers tienen belts. Cuando un software automatizado dispara movimientos demasiado rápido — demasiada aceleración, cambios de dirección sin física, comandos que el motor mecánicamente no puede seguir — **pierden pasos**. El belt salta. El fixture pierde la referencia de posición. El mover empieza a apuntar al público cuando debería apuntar al escenario. Y cuando eso no se detecta a tiempo, el motor se quema.

No es un problema raro. Es el **problema número uno** de los operadores que usan software de iluminación automatizado con hardware de gama media.

El coste de reparar un moving head. El coste de comprarse uno nuevo. El coste de llamar al técnico de servicio a mitad de una gira. Multiplicado por el número de fixtures de tu rig, por el número de shows al año.

**LuxSync Kinetic-Chromatic Core es el primer sistema de software de iluminación con un Motor Bodyguard integrado** — una capa de protección de física de motores que actúa entre lo que el software quiere hacer y lo que el hardware puede hacer sin romperse.

---

## El Motor Bodyguard — Tres Niveles de Protección

El FixturePhysicsDriver es el guardián que nunca duerme. Cada comando de movimiento pasa por tres niveles de validación antes de convertirse en señal DMX:

```
┌────────────────────────────────────────────────┐
│  NIVEL 1 — SAFETY_CAP (Hardcoded, inamovible) │
│  maxAcceleración: 900 DMX/s²                   │
│  maxVelocidad: 400 DMX/s                       │
│  → NUNCA SE SUPERA. SIN EXCEPCIONES.           │
├────────────────────────────────────────────────┤
│  NIVEL 2 — Vibe Request (Dinámico por género)  │
│  Techno: 2000 DMX/s²  (agresivo)              │
│  Chill:  100 DMX/s²   (glacial)               │
│  → min(solicitud, SAFETY_CAP)                  │
├────────────────────────────────────────────────┤
│  NIVEL 3 — Hardware Profile (Tu fixture real)  │
│  Mover budget chino: 566 DMX/s² / 189 DMX/s   │
│  Mover profesional: sin restricción adicional  │
│  → min(los tres niveles)                       │
└────────────────────────────────────────────────┘
```

El resultado: **un mover de 100€ chino recibe comandos que sus steppers pueden ejecutar sin perder pasos, aunque el show de Techno esté pidiendo máxima agresividad**. El software absorbe la diferencia entre lo que el arte quiere y lo que el hardware soporta.

Ese ajuste se hace en unidades físicas reales — la conversión de °/s a DMX/s usa el rango de pan real del fixture (540°, 360°, lo que tenga definido en la Forja). No es una aproximación artística. Es la física del motor.

> **Contexto de coste real:** Un mover de gama media con belt dañado por sobre-aceleración: entre 80€ y 250€ de reparación o sustitución. Si tienes 12 fixtures en el rig y los usas en 3 shows semanales durante un año con software sin protección — el ahorro del Motor Bodyguard se mide en cientos o miles de euros anuales. **Eso es el ROI real del Kinetic-Chromatic Core.**

---

## Dos Modos de Física — El Software Sabe Qué Pide Cada Género

El driver no aplica las mismas ecuaciones de física para Techno que para Chill. Son dos modelos matemáticos distintos, elegidos automáticamente según el género detectado:

### SNAP MODE — Para géneros de impacto (Techno, Latino, Rock)

El fixture *persigue* la posición objetivo con un factor de amortiguamiento calibrado por género:

| Género | Factor | Comportamiento |
|---|---|---|
| **Techno** | 0.85 | Persecución agresiva — los patrones se *dibujan* en el escenario |
| **Latino** | 0.70 | Seguimiento fiel con residuo orgánico — la curva tiene cadera |
| **Rock** | 0.65 | Movimiento con peso visible — gravedad de estadio |

### CLASSIC MODE — Para géneros de textura (Chill, Idle)

Simulación newtoniana completa con cálculo de distancia de frenado, anti-overshoot y mecanismo anti-stuck en los límites de eje:

- Chill: `friction=0.80`, `maxVelocidad=50` — movimiento glacial, respiración orgánica
- Incluye protección de endstop: 5 DMX units de airbag en los extremos físicos de pan y tilt

**REV_LIMIT — El limitador de rev del software:** Un cap por frame que impide desplazamientos imposibles independientemente de la velocidad de fotograma. Si la laptop va lenta un frame, el fixture no intenta recuperar el tiempo perdido con un movimiento imposible.

---

## 16 Patrones Matemáticos — Geometría Real en el Escenario

El VibeMovementManager tiene 16 funciones de patrón — cada una es una ecuación matemática pura `(fase, audio, índice, total) → {x, y}`:

| Género | Patrones | Carácter |
|---|---|---|
| **Techno** (4) | scan_x, square, diamond, botstep | Geometría industrial, distribución φ |
| **Latino** (3) | figure8, wave_y, ballyhoo | Curvas de Lissajous, superposición armónica |
| **Pop-Rock** (3) | circle_big, cancan, dual_sweep | Arcos de estadio, barridos parabólicos |
| **Chill** (3) | drift, sway, breath | Movimiento browniano con frecuencias irracionales |
| **Nobles** (4) | slow_pan, tilt_nod, figure_of_4, chase_position | Vocabulario profesional expandido |

Los periodos de patrón están calibrados contra referencias de hardware real: un barrido de estadio dura 16-32 beats, no 1-4 (eso era la era del epiléptico). Referencia de calibración: Clay Paky Sharpy 540°/2.1s = 257°/s.

### El Acumulador de Fase Monótono — Adiós a las convulsiones

**El problema clásico del software de iluminación**: si el BPM fluctúa (de 70 a 184 entre dos frames de detección), la fase calculada salta — y el mover hace un movimiento convulsivo.

La solución implementada es un **flywheel de fase**:

```
smoothedBPM += (BPMreal - smoothedBPM) × 0.05  // Filtro paso bajo pesado
phaseDelta = (smoothedBPM / 60) × deltaTime / periodo × 2π
phaseAccumulator += phaseDelta  // Solo avanza. Nunca salta.
```

La fase es monótona: solo avanza, nunca retrocede, nunca teleporta. Las fluctuaciones de BPM tardan ~20 frames en afectar al movimiento. Los movers dibujan geometría limpia aunque el BPM oscile.

### Stereo Phase Offset — Efecto de grupo automático

Los fixtures de una misma escena reciben offsets de fase según el género:

| Género | Offset | Efecto visual |
|---|---|---|
| Techno | π (180°) | Mirror — L/R se abren y cierran como puertas del infierno |
| Latino | π/4 (45°) | Snake — cadena de cadera |
| Pop-Rock | π/3 (60°) | Ola ondulante de estadio |
| Chill | π/2 (90°) | Ola oceánica, 90° de separación |

---

## El Motor Cromático — Música → Color con Ciencia Real

### Circle of Fifths → Círculo Cromático

LuxSync no elige colores al azar. No tiene paletas predefinidas seleccionadas a ojo. Tiene un mapeado **psicoacústicamente fundamentado** entre la tonalidad de la música y el espacio de color:

```
Do  (C)  → 0°   Rojo     (fundamental, color primario)
La  (A)  → 270° Índigo   (referencia 440Hz)
Fa# (F#) → 180° Verde    (tritono de Do — máxima tensión)
```

La energía de la música modula **exclusivamente** la saturación y el brillo — **nunca el tono**. Esta es la decisión de diseño que previene el efecto "cambio de humor aleatorio" de los sistemas ingenuos: el color evoluciona con coherencia tonal aunque el show sea muy dinámico.

### Color Secundario con Número de Oro

El color secundario = color primario + φ × 360° ≈ 222.5°. φ es irracional — garantiza variedad infinita no repetitiva porque nunca cierra el ciclo. Es el mismo principio que hace que las semillas de girasol se distribuyan sin solapamiento.

### Las Cuatro Constituciones Cromáticas

Cada género tiene una Constitución inmutable — un conjunto de leyes cromáticas que el motor obedece:

| Constitución | Temp. Color | Tonos Prohibidos | Característica Especial |
|---|---|---|---|
| **Techno** | 9500K (frío) | Naranja/Amarillo [25°-80°] | Protocolo Neón: los tonos prohibidos escapan a cian/turquesa |
| **Latino** | 3500K (cálido) | Zonas de barro y violeta frío | Espejo Tropical, Solar Flare, MudGuard |
| **Pop-Rock** | 5500K (neutro) | Zona de barro [55-75°] | Flash de caja, Punch de bombo — colores reactivos al ritmo |
| **Chill** | 7000K (frío-cálido) | Naranja cálido y rojo agresivo | Modulación Oceánica, pulso de respiración, strobe prohibido |

**Gravedad Térmica:** Los colores son atraídos físicamente hacia el polo térmico de cada género con fuerza 0.22. En Techno (9500K), los rojos se convierten en magentas. En Latino (3500K), los azules se calientan. Este valor fue calibrado empíricamente — 0.15 era demasiado débil, 0.35 colapsaba la diversidad.

**Protocolo Neón (Techno):** Los tonos que caen en la zona prohibida [15°-80°] no son simplemente descartados — son *transformados*. La posición dentro de la zona prohibida se mapea como posición dentro de la zona fría [170°-210°]. El naranja se convierte en cian. El amarillo en turquesa. La variedad cromática se preserva sin violar la Constitución.

---

## CIE L\*a\*b\* — La Traducción de Color que Diferencia Profesional de Amateur

Esta es la parte técnica que separa a LuxSync de los sistemas de lighting de precio similar.

Cuando el motor cromático decide "quiero este color RGB para este fixture", el sistema tiene que traducir ese color a DMX real. La mayoría del software hace esa conversión de forma naïve. LuxSync usa **ciencia del color perceptual real**:

```
RGB → sRGB (companding inverso) → CIE XYZ (D65) → CIE L*a*b* → ΔE*₇₆
```

**¿Por qué importa?** El espacio L\*a\*b\* es perceptualmente uniforme: una diferencia de 1 unidad en cualquier dirección equivale a la misma diferencia perceptual para el ojo humano. El RGB no — una diferencia de 10 en azul se ve mucho menos que una diferencia de 10 en verde.

El resultado: cuando LuxSync elige el color más parecido en una rueda de colores mecánica, está eligiendo el más parecido **según tu ojo**, no según la aritmética del espacio de color equivocado.

### Interpolación de Medio Color en Rueda Mecánica

Cuando el color objetivo cae entre dos ranuras físicas de la rueda, el sistema interpola el valor DMX para posicionar la rueda en el punto intermedio:

```
t = ΔE_ranura1 / (ΔE_ranura1 + ΔE_ranura2)
DMX_interpolado = round(DMX_A + (DMX_B - DMX_A) × t)
```

Esto **dobla efectivamente la resolución de color de una rueda física** sin cambiar el hardware. Una rueda de 8 posiciones se comporta como una de 16. Ningún competidor a este precio ofrece esto.

### El Bunker de Seguridad para Fixtures Mecánicos

Los movers con rueda de color mecánica tienen un tiempo mínimo de transición — la rueda necesita tiempo para girar físicamente de una posición a otra. Si el software pide cambios más rápido de lo que el motor puede girar la rueda, el fixture queda en una posición indefinida entre dos colores.

El HardwareSafetyLayer (internamente: **El Búnker**) protege esto:

| Mecanismo | Trigger | Acción |
|---|---|---|
| **DEBOUNCE** | Cambio de color antes del tiempo mínimo × 1.2 | Bloquea, mantiene color anterior |
| **CHAOS Detection** | >3 cambios/segundo | Activa LATCH |
| **LATCH** | Caos detectado | Bloquea el color 2 segundos |
| **Delegación a Strobe** | >10 bloqueos consecutivos | Sugiere crear efecto de parpadeo vía canal shutter en lugar de rotar la rueda |
| **Pass-through inteligente** | Fixture LED digital | Cero overhead — El Búnker no se activa |

El Búnker solo activa para fixtures mecánicos. Los LEDs RGB/RGBW nunca pasan por esta capa.

---

## El Pipeline Completo — De la Nota Musical al DMX del Fixture

```
Nota musical detectada (Do, La, Fa#...)
  → Circle of Fifths → ángulo de tono
  → Constitución del género → filtros y leyes
  → Gravedad Térmica → corrección hacia polo
  → Selección de contraste (Análogo / Triádico / Complementario)
  → RGB de intención artística
       ↓
  CIE L*a*b* ColorTranslator
       ↓
  Tipo de fixture:
    LED RGB → paso directo a DMX
    LED RGBW → descomposición W = min(R,G,B)
    CMY → conversión sustractiva (C=255-R...)
    Rueda mecánica → ΔE* + interpolación DMX
       ↓
  HardwareSafetyLayer (solo mecánicos)
       ↓
  DMX Output
```

Todo este pipeline se ejecuta en tiempo real, frame a frame, por cada fixture.

---

## Resolución de 16 bits para Pan y Tilt

Para fixtures con canales de posición en 16 bits (la mayoría de los movers profesionales), LuxSync envía la señal completa:

```
pan_grueso = floor(panFinal)        // Canal coarse: 0-255
pan_fino   = round((panFinal % 1) × 255)  // Canal fine: 0-255
```

65.536 pasos a través del rango completo de pan. Movimiento lento sin escalonado visible. Esencial para slow sweeps profesionales.

---

## Lo que el Kinetic-Chromatic Core no tiene (todavía)

| Limitación | Contexto |
|---|---|
| **Selene IA no controla movimiento ni color todavía** | Por decisión de diseño deliberada: durante el desarrollo, Selene IA solo dispara efectos. El movimiento y el color automáticos corren fuera de Selene, con el nivel de cuidado que merece el hardware. La integración Selene+Kinetic-Chromatic es el objetivo central de la v1.0 oficial, cuando el motor evolutivo esté listo. |
| **Escalabilidad a 50 universos (+2.500 fixtures)** | El bucle de fixtures es secuencial. A partir de ~2.500 fixtures el frame budget de 60fps se aproxima al límite. Para rigs de festival tier-1 extremo, la próxima versión implementará procesamiento paralelo por grupos de universo. |
| **Tests de regresión del PhysicsDriver** | El driver tiene las funciones más críticas para la seguridad del hardware, pero aún no tiene suite de tests automatizados. Está en el roadmap antes de la v1.0. |
| **`minChangeTimeMs` expuesto en WheelSmith** | Las ruedas con transición lenta (>500ms) dependen del margen de seguridad × 1.2. Un slider manual para este parámetro está en el roadmap. |

---

## A quién va dirigido

| Perfil | Por qué importa |
|---|---|
| **Rental company** | Su negocio son los fixtures. Cada mover que no se rompe es dinero que no sale por la puerta. El Motor Bodyguard es un argumento de ROI directo. |
| **Técnico de touring** | Hardware diferente cada parada. El Physics Profile por fixture viaja en el show file — las protecciones de cada mover concreto viajan con él. |
| **Operador de sala con hardware de gama media** | Movers de 200-500€ que duran como uno de 2.000€ gracias a límites de aceleración calibrados. |
| **DJ que usa movers** | No necesita saber nada de esto. Solo funciona — y sus movers no se rompen. |
| **Diseñador de iluminación** | Las 4 Constituciones Cromáticas y el Circle of Fifths dan coherencia visual automática que antes requería un LD experimentado tomando decisiones manuales en cada escena. |

---

## El Roadmap — Cuando Selene Aprenda a Moverse

El Kinetic-Chromatic Core y Selene IA son actualmente dos sistemas paralelos que coexisten: Selene dispara efectos, el Core gestiona movimiento y color automático.

**En la v1.0 oficial**, cuando el motor evolutivo y de aprendizaje de Selene esté operativo, estos dos sistemas se fusionan. Selene podrá emitir intenciones cinéticas y cromáticas que el Core ejecutará con la misma filosofía de protección de hardware que tiene hoy.

La promesa: **inteligencia artificial que aprende a hacer shows — con la garantía de que nunca va a quemar un motor haciéndolo.**

Eso no existe en ningún software del mercado. No existirá hasta que lo construyamos.

---

## Incluido en LuxSync Suite

El Kinetic-Chromatic Core no es un módulo separado. No hay tier "Pro" que lo desbloquee.

**Está incluido en LuxSync desde la instalación, activo en cada show.**

**Puntuación técnica independiente (Pioneer-grade due diligence, Enero 2026): 87/100 — Señal Fuerte de Adquisición — IP Única**

> *"El software que convierte un mover chino de 50€ en un fixture profesional — sin cambiar ni un engranaje."*  
> — Evaluación técnica independiente, sector pro mecatrónica y colorimetría, Enero 2026

---

## → Descarga en [mgmusicandlight.com](https://mgmusicandlight.com)

Beta 1.0 disponible para Windows. Gratuita. Sin límite de fixtures. Sin suscripción.

---

*LuxSync Kinetic-Chromatic Core — Parte de la suite LuxSync desarrollada por GestIAdev.*  
*El Motor Bodyguard. Porque el hardware que cuidas es el hardware que no tienes que reemplazar.*
