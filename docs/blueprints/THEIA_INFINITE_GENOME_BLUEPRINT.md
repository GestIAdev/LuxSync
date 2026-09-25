# 🧬 THEIA INFINITE GENOME — Blueprint maestro de gráficos procedurales

> **Estado**: diseño arquitectónico, nada implementado todavía (las fases G0–G5 del §9 son la ruta de implementación).
> **Depende de**: `EUCLID_ORACLE_BLUEPRINT.md` (E0–E5): anillo de 256 B, Uniform Bridge, contrato de shader, Dual-Mode.
> **Alcance**: matemática, diseño de sistemas generativos y GLSL ES 3.00 puro. Aquí no hay TypeScript ni React.
> **Autoridad**: si este documento contradice el contrato de Euclid (§4 del Oracle), manda Euclid. Este documento solo **añade** encima.

---

## 0. Tesis

El Oracle nos dio un sistema nervioso: 60 escalares suavizados a la frecuencia del display, además de derivados predictivos (`u_beatTime`, `u_approach`, `u_impact`). Hay que evitar el error típico, que es gastar ese sistema en *shaders* sueltos que reaccionan cada uno a su manera. El resultado sería un zoo de piezas sin gramática.

**Infinite Genome** fija tres cosas:

1. **Pocas físicas, bien entendidas.** Hay cuatro *Estados de la Materia* (familias matemáticas). Cada núcleo (*core*) pertenece a una o combina dos.
2. **Una sola sinestesia.** Existe un estándar obligatorio de cómo la telemetría se convierte en geometría. Un kick tiene que *sentirse igual* en un fluido que en un cristal, aunque cada familia lo exprese con su propia física.
3. **Variación infinita a partir de semillas.** Un core es una especie y un genoma es un individuo. De un core salen del orden de 10⁸ fenotipos distintos, sin que un artista escriba otra línea de código.

```
          TELEMETRÍA (60 slots + derivados)
                       │
          ┌────────────▼────────────┐
          │  CAPA SINESTÉSICA (§3)  │  ← estándar único: 9 canales
          └────────────┬────────────┘
                       │ canales normalizados
   ┌──────────┬────────┴─────┬──────────────┐
   │  ÉTER    │  CRISTAL     │  ENJAMBRE    │  CONFORME       ← familias (§2)
   │ volumen  │  KIFS / SDF  │  cargas/feed │  mapas complejos
   └────┬─────┴──────┬───────┴──────┬───────┴───────┬──────
        │   genes @euclid (§4) → constantes estructurales / expresivas
        ▼
     CORE (.glsl) × SEMILLA  ─►  FENOTIPO (átomo kind:'shader' con ADN propio)
```

---

## 1. Anatomía de un core

Todo core de Infinite Genome sigue el mismo esqueleto de seis bloques, en este orden. El orden importa: cada bloque consume lo que produce el anterior.

| # | Bloque | Qué hace | Coste |
|---|---|---|---|
| 1 | **Canales** | Traduce telemetría a los 9 canales sinestésicos (§3). Una vez por píxel, sin bucles | O(1) |
| 2 | **Glitch digital** | Perturba `fragCoord`, solo en régimen discreto (`APOCALYPSE`) | O(1) |
| 3 | **Espacio** | Transforma coordenadas: cámara, pliegues, mapas conformes, contracción de tensión | O(1)–O(iter) |
| 4 | **Campo** | Evalúa la física de la familia: densidad, SDF, potencial, teselado | **dominante** |
| 5 | **Color** | Paleta armónica, anillo de chroma, drenaje por tensión, estallido local | O(1) |
| 6 | **Post** | Tonemap y memoria (feedback `u_prevFrame`). El epílogo Euclid se encarga de masters, limitador y sRGB | O(1) |

**El artista escribe color lineal HDR y lo tonemapea a [0,1].** Nunca aplica gamma: el epílogo convierte a sRGB y aplica brillo, contraste, blackout, crossfade y el limitador fotosensible, y el shader no puede saltárselo.

---

## 2. Taxonomía — los Estados de la Materia

### 2.1 ÉTER VOLUMÉTRICO (fluidos, gases, auroras, túneles de humo)

**Idea.** La imagen es la **integral de luz** a lo largo de cada rayo que atraviesa un medio participante con densidad σ(x) y emisión e(x).

**Ecuación de transporte** (emisión-absorción, sin *scattering*):

$$L(\mathbf{r}) = \int_0^{t_{max}} T(t)\,\sigma(\mathbf{x}(t))\,e(\mathbf{x}(t))\,dt, \qquad T(t) = \exp\!\Big(-\!\int_0^t \sigma\,ds\Big)$$

Se discretiza *front-to-back*: en cada paso, α = 1 − e^(−σ·Δt) (Beer-Lambert), `col += T·α·e` y `T *= 1 − α`. El bucle termina cuando T < 0,01 (terminación temprana). El paso es adaptativo, Δt = a + b·t: los pasos cercanos son finos y los lejanos baratos.

**Campo de densidad.** σ(x) = *envolvente*(x) × *textura*(x):
- **Envolvente**: la forma macro, por ejemplo una cáscara de túnel `1 − smoothstep(0, w, |r − R|)`, una columna o una esfera blanda.
- **Textura**: fBm de ruido sobre un **dominio deformado**. Es el corazón del "fluido":

$$\text{fbm}_H(\mathbf{x}) = \sum_{k=0}^{n-1} H^k\,\text{noise}(\lambda^k \mathbf{x}), \qquad \mathbf{w}(\mathbf{x}) = \mathbf{x} + A\,\mathbf{f}(\mathbf{x} + A\,\mathbf{f}(\mathbf{x}))$$

  El exponente de Hurst **H** (persistencia) es *la rugosidad*: con H ≈ 0,4 el humo es sedoso y con H ≈ 0,75 es áspero, casi roca. La lacunaridad λ ≈ 2,02 (nunca 2,0 exacto: evita que los retículos se alineen).
- El **domain warping** (anidado, al estilo IQ) da el aspecto de fluido sin simular Navier-Stokes. Cuando se quiere un flujo **sin divergencia** (humo que no "nace" de la nada), se sustituye f por *curl noise*: **v** = ∇ × **ψ**.

**Cuándo.** Psytrance progresivo, ambient, dub techno, downtempo, cinematic, y los breakdowns de cualquier género.

**Coste.** O(pasos × octavas). Es la familia más cara: `@euclid steps` entre 40 y 64, y el governor escala.

### 2.2 ESTRUCTURAS CRISTALINAS (KIFS, SDF duros, fractales de escape)

**Idea.** Superficies implícitas definidas por un campo de distancia con signo (SDF) d(x), renderizadas por *sphere tracing*: `t += d(ro + rd·t)` hasta que d < ε.

**Motor fractal — KIFS** (Kaleidoscopic IFS). Iterar n veces un pliegue de simetría seguido de un escalado:

```
p = abs(p)                              // espejo en los 3 planos
if (p.x < p.y) p.xy = p.yx              // ordenar ejes (pliegue diédrico)
p = rot(θ) · p
p = s·p − o·(s − 1)                     // escalado desde el offset o
d = (|p| − r) · s^(−n)                  // distancia corregida por escala
```

- **Mandelbox** (alternativa blanda): *box fold* `p = clamp(p,−1,1)·2 − p` seguido de *sphere fold* (inversión en el rango r_min ≤ |p| ≤ 1).
- **Orbit traps** para el color: se registra min|p − c| durante la iteración y eso tiñe la pieza según su historia, no según su posición.
- **Normales** por gradiente tetraédrico (4 evaluaciones) y **AO** con 5 muestras a lo largo de la normal.

**Parámetros con significado.** Si la escala s > 2 los cristales son agresivos y afilados; si s ≈ 1,5 son orgánicos y bulbosos. La perturbación de θ controla cuánto se rompe la simetría. El offset o controla la densidad de la estructura.

**Cuándo.** Techno industrial, hard techno, EBM, neurofunk, riddim, metal. También es la familia de referencia actual del Oracle (`Oracle KIFS`, §5 del Oracle).

**Coste.** O(pasos × iteraciones). Se recomiendan 64–96 pasos y entre 4 y 8 iteraciones (fraccionales, §3.3).

### 2.3 ENJAMBRES DE PLASMA (cargas, atractores, memoria)

**Idea.** Un campo escalar **potencial** generado por N cargas que se mueven. Todo es *stateless*: la posición de cada partícula es una función cerrada del tiempo y de su índice.

$$\Phi(\mathbf{x}) = \sum_{i=1}^{N} \frac{q_i}{\lVert \mathbf{x} - \mathbf{p}_i(t)\rVert^2 + \varepsilon}$$

- **Trayectorias**: nudos de Lissajous `p(a) = (sin(k_a·a + φ), sin(k_b·a + φ'))`, curvas rosa `r = cos(kθ)` o *atractores extraños* (Clifford: x' = sin(a·y) + c·cos(a·x)) iterados K pasos a partir de la semilla del índice. El coste es N·K por píxel; K ≤ 8.
- **Reparto**: fase inicial φ_i = i·2,39996 rad (**ángulo áureo**), que es la distribución de fases menos correlacionada posible. Así se evitan los racimos sin necesidad de ruido.
- **Lecturas del campo**: brillo = Φ (plasma o metaballs), **isolíneas** `fract(log(1+Φ)·k − fase)` (la topografía "tribal") y gradiente ∇Φ como campo de velocidad.
- **Memoria**: `u_prevFrame` da **un frame de estado**. Con `feedback(x) = prev(M·x)·ρ`, donde M es un zoom con rotación, salen estelas, túneles de eco y persistencia retiniana. La mezcla estable es **max-blend** (`max(col, prev·ρ)`): nunca se acumula por encima de la fuente, así que no satura aunque ρ → 1.
- **Límite honesto**: los autómatas celulares reales (Gray-Scott, Game of Life) necesitan estado en punto flotante. `u_prevFrame` es RGBA8 post-epílogo (sRGB, con masters aplicados), así que no sirve como sustrato de reacción-difusión. Eso llega en la fase G5 (§9).

**Cuándo.** Mental tribe, dark psy, forest, goa, minimal, tribal house y glitch.

**Coste.** O(N) por píxel, sin *raymarch*. Es barata y rinde a resolución nativa en Modo B.

### 2.4 TEJIDOS CONFORMES (mapas complejos, hiperbólico, mandalas)

**Idea.** El plano es ℂ. Se aplican **transformaciones conformes**, que preservan ángulos: un círculo pequeño sigue siendo un círculo en cualquier zoom. Por eso estos patrones hipnotizan, porque el ojo reconoce la misma forma a todas las escalas.

- **Log-polar** z ↦ (log|z|, arg z). Convierte el zoom en traslación y la rotación en desplazamiento. Si se tesela en log|z| con período P, sale un **zoom infinito** (efecto Droste). Si se pliega arg z en un grupo **diédrico D_n**, sale un kaleidoscopio exacto.
- **Möbius** z ↦ (az + b)/(cz + d). Lleva círculos a círculos y da flujos hiperbólicos, elípticos o loxodrómicos entre dos polos.
- **Disco de Poincaré** {p,q}: teselados hiperbólicos por reflexiones iteradas en tres espejos. Da una densidad infinita hacia el borde.
- **Retículas**: hexagonal, Truchet o *sacred geometry* sobre las coordenadas ya transformadas.

**Cuándo.** Es la familia *universal*: house, deep house, disco, pop, latin, reggaeton, hip-hop, goa. También es el **espacio anfitrión** para combinarse con otra familia (§2.5).

**Coste.** O(1), la más barata de las cuatro.

### 2.5 Quimeras (composición de familias)

Las familias son **ortogonales por bloque**: el Espacio de una familia puede alojar el Campo de otra.

| Quimera | Espacio | Campo | Resultado |
|---|---|---|---|
| Enjambre ∘ Conforme | log-polar + D_n | Φ de cargas | *Tribu Mental* (§6.2): mandala infinito habitado |
| Éter ∘ Conforme | pliegue polar D_n en el túnel | fBm volumétrico | *Æther Serpent* (§6.1): mandala de humo |
| Cristal ∘ Éter | sphere tracing del SDF | niebla volumétrica entre superficies | catedral en la niebla |
| Cristal ∘ Conforme | Möbius sobre la dirección del rayo | KIFS | cristal visto a través de una lente hiperbólica |

`@euclid family` declara la composición (`swarm+conformal`). El Espacio siempre va primero.

---

## 3. El Mapeo Sinestésico — estándar obligatorio

### 3.1 Los nueve canales

Cada core **tiene que** implementar los nueve canales. La familia elige *cómo* se expresa cada canal, pero *qué* dato lo alimenta y en qué dirección actúa es fijo.

| Canal | Fuente (telemetría) | Semántica perceptual | Éter | Cristal | Enjambre | Conforme |
|---|---|---|---|---|---|---|
| **PULSO** | `u_kickPulse`, `u_snarePulse` | Impacto instantáneo que decae | Anillo de densidad que viaja por el túnel | Desplazamiento del offset `o` del fold | Dilatación del enjambre | Onda radial que cruza el anillo log-polar |
| **FLUJO** | `u_beatTime` | Tiempo musical: *todo* lo periódico va aquí | Fase del warping y avance de la cámara | Rotación θ del fold | Fase de las trayectorias | Zoom y giro del kaleidoscopio |
| **COMPLEJIDAD** | `u_morphFactor` | Riqueza armónica → riqueza geométrica | Octavas del fBm | Iteraciones KIFS | Nº de cargas vivas | Profundidad de teselado |
| **RUGOSIDAD** | `u_flatness`, `u_harshness`, `u_crestN` | Textura del timbre | Hurst H | Ruido en la superficie del SDF | Jitter de las trayectorias | Grosor de las líneas y *aliasing* deliberado |
| **GLITCH** | `APOCALYPSE` × `u_harshness`, `u_spectralFlux` | Ruptura digital (régimen discreto) | Desgarro por bandas | Cuantización de los pliegues | Desgarro polar | Desgarro polar y bandas horizontales |
| **TENSIÓN** | `u_approach`, `u_predictiveETA`, `u_enums.y` | Anticipación (§3.4) | Contracción, torsión, FOV y drenaje de color | Compresión del fold y aumento de s | Implosión | Aceleración del zoom |
| **LIBERACIÓN** | `u_impact` | El drop y el pago de la deuda | Expansión, apertura del FOV y complementario | Explosión del offset | Explosión del enjambre | Salto de zoom |
| **COLOR** | `u_chromaHue`, `u_chroma(i)`, `u_saturation`, `u_brightnessSpec`, `COLOR_SNAP`, `ACID` | Armonía → cromatismo (§3.6) | Paleta y anillo armónico | Orbit traps × paleta | Nota por carga | Paleta por anillo |
| **ATMÓSFERA** | `u_lqFloor`, `u_lqAmbient`, `u_lqAir`, `u_recoveryFactor`, `BREAKDOWN`, `RHYTHMIC_VOID` | Física de sala Omniliquid | Niebla y grosor de pared | AO y niebla de profundidad | Persistencia y eco | Fondo por anillo |

### 3.2 Las cinco leyes

**Ley 1 — Integración (anti-salto).** Nunca se escribe `u_time * x` ni `u_beatTime * x` con **x variable** (telemetría o params de UI). Una fase es la integral de una velocidad: multiplicar el tiempo por una velocidad que cambia produce saltos de fase proporcionales a t, y a los 10 minutos cualquier variación de 1 % es un teletransporte.
- ✅ `fase = u_beatTime · k` con k **constante** (literal o gen, porque un gen es constante en su programa).
- ✅ `fase = u_beatTime · k + g(canal)`. La telemetría modula **offsets**, no velocidades.
- ❌ `fase = u_time · (1 + u_energy)`.
- Si hace falta "energía integrada", ese reloj lo integra el host (propuesta `u_energyTime`, §9·G1).

**Ley 2 — Rejilla temporal.** Todo movimiento periódico usa períodos de **2ᵏ beats** (¼, ½, 1, 2, 4, 8, 16, 32). Así, la rotación del cristal completa su ciclo en la frontera de 4 compases, *donde el DJ cambia la frase*. Se permite deriva libre solo como `u_time · k` con k ≤ 0,05: es el movimiento de reposo que mantiene la vida cuando no hay audio.

**Ley 3 — Derivada (aceleración sin saltos).** Para que la tensión **acelere** algo, se suma a la fase una función monótona del canal suavizado:

$$\phi(t) = u\_beatTime\cdot k + \kappa\,a(t)^2 \quad\Rightarrow\quad \dot\phi = k\,\dot b + 2\kappa\,a\,\dot a$$

La velocidad extra existe solo mientras `a` **sube**, se detiene cuando `a` se estabiliza y **se invierte** cuando `a` cae tras el drop. Esa inversión es un "retroceso" natural: la exhalación. Es continua por construcción, porque `a` es un canal suavizado.

**Ley 4 — Correspondencia Espectral.** Las bandas de frecuencia acústica se mapean a **frecuencias espaciales** en orden monótono:

| Banda | Escala espacial | Ejemplo |
|---|---|---|
| `u_subBass` | Macro: la estructura entera respira | Radio del túnel, escala global |
| `u_bass` | Rasgos grandes | Amplitud del domain warp |
| `u_lowMid`, `u_mid` | Octavas medias | Filamentos, isolíneas |
| `u_highMid`, `u_treble` | Micro detalle | Brillo especular, grano |
| `u_ultraAir`, `u_hihatEnergy` | Partículas sub-píxel | Chispas y polvo estelar |

Está **prohibido** invertir esta ley: un hi-hat que mueve la estructura entera, o un sub-bass que hace brillar el grano. El cerebro lo percibe como *mal sincronizado* aunque esté en fase.

**Ley 5 — Luminancia presupuestada.** El limitador del epílogo permite como mucho unas 3 excursiones de luminancia media ≥ 0,1 por segundo. **El impacto se diseña como geometría, color y contraste local, nunca como destello blanco a pantalla completa**: el limitador lo cortaría y el drop se sentiría *apagado*. Los estallidos van localizados (`exp(−k·r)`), preferiblemente en el color complementario (`hue + 0.5`).

### 3.3 COMPLEJIDAD — cómo `u_morphFactor` hace evolucionar la estructura

`u_morphFactor` ∈ [0,1] es el **perfil armónico de los medios** normalizado por vibe (Omniliquid: EMA lenta de `mid` entre `morphFloor` y `morphCeiling`), con ataque 0,05 y release 0,02 a 60 Hz. Evoluciona en **decenas de segundos**, a la escala de una frase y no de un beat. Es la variable de *evolución*: más armonía significa más geometría.

**Regla del LOD fraccional (obligatoria).** El número de iteraciones u octavas se deriva de morph de forma **continua**; nunca se trunca:

$$N(m) = N_{min} + m\,(N_{max} - N_{min}), \qquad w_i = \text{clamp}(N(m) - i,\ 0,\ 1)$$

La contribución i-ésima se pondera por w_i. Cuando morph cruza un entero, la octava, iteración o partícula nueva **aparece con un fundido**, sin *pop*. Se aplica a las octavas del fBm (Éter), a las iteraciones KIFS (Cristal, interpolando entre el estado n y n+1), a las cargas vivas (Enjambre) y a la profundidad de teselado (Conforme).

**Lectura musical.** Un track que se desnuda hasta el kick y el sub-bass converge a la geometría primordial (2 octavas, 4 iteraciones, 8 cargas). Cuando entran pads y acordes, la estructura florece. El público ve cómo crece la armonía.

### 3.4 TENSIÓN y LIBERACIÓN — la Ley de Conservación de la Tensión

`u_approach = (1 − clamp(etaBeats/8, 0, 1)) · predictionProb · confidence` ya viene **ponderado por la certeza de Cassandra**. Si Selene no está segura, la geometría no se tensa: la anticipación visual nunca miente.

**Principio.** Durante la aproximación, el sistema **toma prestada energía visual** de varias dimensiones a la vez y la **devuelve con intereses** en `u_impact`. El drop tiene impacto porque se ha visto venir.

| Dimensión | Préstamo (sube con `tc`) | Pago (`u_impact`) |
|---|---|---|
| Espacio | Contracción: escala × (1 − κ·tc) | Expansión con sobreimpulso: × (1 + κ'·impact) |
| Topología | Torsión creciente con la profundidad | Se deshace |
| Óptica | El FOV se estrecha (efecto túnel) | El FOV se abre por encima del reposo |
| Color | Drena hacia monocromo: `mix(col, lum, 0.65·tc)` | Estallido del complementario, local |
| Tiempo | Aceleración por la Ley 3 (zoom, giro) | Inversión de la aceleración (retroceso) |
| Enjambre | Implosión de las cargas al centro | Explosión radial |

**Curva perceptual.** Se usa `tc = u_approach²`, no el valor lineal. La tensión humana es convexa: los últimos 2 beats deben pesar más que los primeros 6. El `u_approach` lineal da la sensación de rampa aburrida.

**Rama según el tipo de predicción (`u_enums.y`).**
- `1` drop inminente o `2` buildup: **contracción** (la tabla anterior).
- `3` breakdown inminente: **disolución**, lo contrario. La densidad baja, el espacio se abre, el enjambre se difumina (ε de las cargas crece). Un breakdown no es un drop al revés, es *aire*.
- `4` transición: solo se usa el Tiempo (una aceleración leve), sin préstamo espacial.

**`u_predictiveETA` (segundos) directo.** Sirve para eventos que hay que clavar al beat, como un anillo que tiene que llegar al fondo del túnel *justo* en el drop: z_anillo = z_cam + v·ETA. Se extrapola a 60 fps entre publicaciones, así que la geometría fluye.

### 3.5 RUGOSIDAD frente a GLITCH — los dos regímenes

Son **dos canales distintos** y no se deben mezclar:

- **Rugosidad (continua, siempre activa).** Es la textura del timbre. En un fluido, **la rugosidad es el exponente de Hurst**:
  $$H = \text{clamp}\big(\text{mix}(0.42,\ 0.68,\ u\_flatness) + 0.15\,u\_harshness,\ 0.3,\ 0.8\big)$$
  Un sonido tonal y limpio (flatness baja) da humo sedoso. Un sonido ruidoso (flatness alta, *white-noise risers*, distorsión) da un medio áspero. `u_crestN` bajo (señal compresa, *brickwalled*) permite aplanar los picos de densidad.
- **Glitch (discreto, con compuerta).** Es la ruptura digital, solo cuando `APOCALYPSE` está activo (harshness ∧ flatness por encima de los umbrales del perfil de Omniliquid) y con amplitud `u_harshness`. Las formas autorizadas son: desplazamiento de bandas de `fragCoord` re-sorteado en la rejilla de semicorcheas (`floor(u_beatTime·4)`), cuantización del ángulo de pliegue y desgarro polar. **Siempre en rejilla temporal (Ley 2)**, porque un glitch aleatorio fuera de rejilla se lee como un bug de render.

### 3.6 COLOR — de la armonía al cromatismo

- **Tonalidad → matiz base.** `u_chromaHue` ∈ [0,1) es la tonalidad detectada por el ChromaCoupler (circular, se suaviza por el camino corto). Es el **matiz raíz** de toda paleta.
- **Anillo armónico.** Los 12 bins `u_chroma(i)` iluminan 12 sectores angulares o 12 cargas. La pieza **toca el acorde**: un Do menor enciende exactamente 3 sectores.
- **Círculo de quintas.** Cuando las notas tienen color propio, el matiz es `u_chromaHue + ((i·7) mod 12)/12`. Así las notas vecinas en el círculo de quintas (consonantes) comparten color y las disonantes contrastan.
- **Temperatura.** `u_brightnessSpec` (centroide espectral) desplaza la fase `d` de la paleta IQ: un sonido oscuro da colores cálidos y uno brillante, fríos.
- **Saturación.** `u_saturation` modula la amplitud `b` de la paleta.
- **`COLOR_SNAP`** permite cambios de paleta *discretos* (un salto de matiz en el beat). **`ACID`** (TB-303 detectado) activa bandas de resonancia cromática.

### 3.7 ATMÓSFERA, secciones y degradación

- **Omniliquid**: `u_lqFloor` es la luz de suelo o niebla baja, `u_lqAmbient` el grosor de las paredes o la densidad del medio, y `u_lqAir` las partículas en suspensión. `u_recoveryFactor` cae a 0 en los transitorios y se recupera después; sirve para hacer *ducking* visual, un bombeo de la niebla con el kick.
- **`BREAKDOWN`**: estado de reposo de la familia. Menos pasos, espacio abierto, rotaciones a la mitad de velocidad (cambio de k *solo a través de un gen o crossfade*, nunca multiplicando la fase: Ley 1).
- **`RHYTHMIC_VOID`**: el silencio rítmico se renderiza como **eco**. La fuente se atenúa y la persistencia del feedback sube.
- **Contrato de degradación** (el principio ORGANIC llega hasta el píxel):
  - `!AUDIO_LIVE`: solo respiración de reposo (amplitudes × ~0,3, deriva `u_time·k` pequeña).
  - `!PLL_LOCKED`: el swing, la sincopa y la modulación de rejilla se ponderan por `u_beatConfidence`. `u_approach` ya se atenúa solo.
  - `u_energy` bajo: menos densidad, nunca negro total (mantener la vida).

### 3.8 Reglas del contrato de parámetros

- **Regla del Cero Neutro.** Todo `@euclid param` tiene que ser **neutro en 0**. Los uniforms GLSL arrancan en 0 hasta que el host empuja el valor por defecto, y ese empuje ocurre al activarse el shader con el panel montado, así que puede no llegar nunca. Por eso los params se declaran como *boosts* bipolares `[-1, 1]` con default 0, y no como multiplicadores `[0, 2]` con default 1.
- **Paridad Modo A/Modo B.** El mismo core rinde a 64×64 (gemelo DMX) y a 4K (ventana HDMI). Todo tiene que expresarse en coordenadas **normalizadas** (`fragCoord / u_resolution`). Los detalles sub-píxel desaparecen en el gemelo, y es aceptable: el DMX solo necesita la masa de color.
- **`u_prevFrame` contiene la salida post-epílogo** (sRGB, con masters). Al leerla hay que linealizar (≈ γ2) y aceptar que un `u_brightness` < 1 acorta las estelas.

---

## 4. El Genoma — semillas, genes y evolución

### 4.1 Tres niveles de identidad

| Nivel | Qué es | Dónde vive | Quién lo usa |
|---|---|---|---|
| **ADN** (fenotipo social) | `genome aggression chaos organicity` | Cabecera → `ITheiaAtom` | Selene/Cassandra (matching del átomo) |
| **Genes** (fenotipo físico) | Constantes matemáticas del core | `@euclid gene` → `#define G_*` | El shader |
| **Semilla** | Entero de 32 bits | Id del átomo variante `core#seed` | El Genome Expander |

**Tesis.** Hoy el ADN solo sirve para *elegir* un átomo. Infinite Genome lo usa para **generar** el átomo: el ADN sesga la expresión de los genes y los genes expresados **re-escriben** el ADN del individuo. Una variante agresiva de un core orgánico se declara agresiva ante Selene y se usa en el momento adecuado.

### 4.2 Gramática `@euclid` extendida (EBNF)

Es compatible hacia atrás: el parser actual ignora las claves desconocidas, y así lo validan los tests de E4.

```ebnf
header     = { "// @euclid" , ws , directive , nl } ;
directive  = name | author | family | genome | zone | param | gene | seed | steps ;

family     = "family" ws fam { "+" fam } ;           (* el Espacio va primero *)
fam        = "ether" | "crystal" | "swarm" | "conformal" ;
seed       = "seed" ws ( uint32 | "auto" ) ;          (* 0 = fenotipo canónico *)
gene       = "gene" ws IDENT ws class ws type ws min ws max ws default
             { ws affinity } [ ws "curve=" ( "lin" | "exp" ) ] [ ws label ] ;
class      = "struct" | "expr" ;
type       = "int" | "float" ;
affinity   = ( "a" | "c" | "o" ) ":" sign number ;    (* afinidad con aggression/chaos/organicity *)
```

- Los genes usan el prefijo **`G_`**. En el cuerpo siempre llevan un fallback `#ifndef G_X / #define G_X <default> / #endif`: el core **compila hoy** con el pipeline E3 y se vuelve mutable en cuanto el assembler inyecte las definiciones (G1).
- **`struct`**: cambia la *topología* (orden de simetría, frecuencias de nudo, nº de iteraciones máximo). El assembler lo inyecta como `#define G_X 7.0` (**siempre como literal float**, redondeado si el tipo es `int`). Cada combinación da un programa distinto, con su hash FNV y entrada en la LRU de 8 del worker, compilado en paralelo con `KHR_parallel_shader_compile`.
- **`expr`**: modula de forma continua (amplitudes, semillas de fase, dispersión de matiz). En v1 también se inyecta como `#define` (programa distinto). En v2 (G3) pasa a un array `uniform float u_gene[8]` con `#define G_X u_gene[k]`, lo que permite mutarlo **sin recompilar**. Como el valor lo empuja el host al activar, queda exento de la Regla del Cero Neutro.

### 4.3 El Genome Expander — de semilla a fenotipo

Es una función determinista, pura y reproducible: `expand(core, seed) → {G_k}`. La misma semilla da siempre el mismo individuo.

1. **Aleatoriedad por gen.** u_k = PCG(seed ⊕ hash(core) ⊕ k) / 2³² ∈ [0,1).
2. **Sesgo por ADN.** Sea el ADN centrado **d'** = (aggression, chaos, organicity) − 0,5 y **α**_k ∈ [−1,1]³ la afinidad del gen k:
   $$\mu_k = \tfrac12 + \tfrac12\tanh\!\big(2\,\boldsymbol\alpha_k\cdot\mathbf d'\big)$$
3. **Dispersión por caos.** El `chaos` del ADN es literalmente la **entropía** de la variación:
   $$\sigma = 0.15 + 0.6\cdot\text{chaos}, \qquad t_k = \text{clamp}\big(\mu_k + \sigma\,(u_k - \tfrac12)\cdot 2,\ 0,\ 1\big)$$
   Un core ordenado (chaos 0,2) produce variantes cercanas al canónico. Un core caótico (0,8) explora todo el rango.
4. **Expresión.** `lin`: G_k = min + t_k·(max − min). `exp` (para genes de escala o frecuencia): G_k = min·(max/min)^(t_k). Si es `int`, se redondea.
5. **Semilla 0 = canónico.** Todos los genes toman su `default`. Es la versión del artista.

### 4.4 Retroproyección — el individuo declara su personalidad

Tras expandir, el ADN del átomo variante **se recalcula** a partir de lo que realmente expresó:

$$\mathbf d_{var} = \text{clamp}\Big(\mathbf d_{core} + \kappa\sum_k \boldsymbol\alpha_k\,(t_k - t_k^{default}),\ 0,\ 1\Big), \qquad \kappa \approx 0.25$$

Una *Tribu Mental* con `G_FOLD = 12` y `G_ZOOM = 0.45` (ambos con afinidad `a:+`) se registra con mayor `aggression` y Selene la reserva para los picos. **El matching sigue siendo honesto**: cada individuo se presenta como lo que es.

### 4.5 Espacio de fenotipos — ¿cuánto es "infinito"?

Si los genes `expr` se cuantizan a 8 bits para identidad (dos fenotipos cuya diferencia está por debajo del umbral perceptual son el mismo individuo):

| Core | Genes struct | Combinaciones struct | Genes expr | Fenotipos |
|---|---|---|---|---|
| Æther Serpent | G_SYM (7) | 7 | 3 × 256 | 7 · 256³ ≈ **1,2 · 10⁸** |
| Tribu Mental | G_FOLD (8) · G_KNOT_A (5) · G_KNOT_B (4) | 160 | 3 × 256 | 160 · 256³ ≈ **2,7 · 10⁹** |

**Identidad.** `genomeId = FNV1a(coreHash ‖ G₀ ‖ … ‖ G_n)` con los valores ya cuantizados. Dos semillas que expresan el mismo fenotipo **colapsan** al mismo átomo, sin duplicados en el LiveDeck.

### 4.6 Evolución en vivo

**Mutación en frontera de frase.** El host cuenta las vueltas de `BAR_PHASE`. Cada 16 u 32 compases, y **solo** si `u_approach < 0,2` y no hay drop activo (nunca se muta en el clímax):
1. Se elige una semilla hija con PCG(seed_actual, contador_de_frases).
2. Se compila en paralelo; el programa anterior sigue en pantalla (§4.4 del Oracle).
3. Se activa con un crossfade de 2 compases.
4. Si solo cambian genes `expr` (v2), no hay recompilación y se fijan por `u_gene`.

**Cruce (crossover).** Solo entre individuos del **mismo core** (sus genes son comparables). Cada gen del hijo se hereda del padre A o del B con probabilidad ½ según el RNG. Luego muta con probabilidad p_m = 0,05 + 0,25·chaos_hijo, con un desplazamiento de (u₁ + u₂ − 1)·0,15·rango (aproximadamente gaussiano, barato). El ADN del hijo se retroproyecta (§4.4).

**Bucle de Darwin (fitness).** Cada individuo acumula una EMA de fitness:
$$F \leftarrow 0.9\,F + 0.1\,\big(\,w_b\,\overline{u\_beauty} + w_f\,\text{favorito} - w_s\,\text{skip}\,\big)$$
- `u_beauty` (slot 35) es la estética que Selene mide *mientras ese individuo está en pantalla*.
- Favorito/skip son acciones del operador en el LiveDeck.
- La selección se hace por **torneo** de 3 en cada frontera de frase: los individuos mejor puntuados se reproducen y los peores se extinguen de la población viva (8 por core, igual que la LRU).

El resultado es un visual que **aprende el gusto de la sala** a lo largo de la noche.

---

## 5. Matriz de géneros

Las columnas son sugerencias por defecto del matching y de la población inicial; no obligan a nada. "Rejilla" es el período dominante de `FLUJO` (Ley 2).

| Género | Familia primaria | Secundaria | ADN inicial (a / c / o) | Rejilla | Firma sinestésica |
|---|---|---|---|---|---|
| **Psytrance** (full-on, prog) | Éter | Conforme | 0,6 / 0,6 / 0,7 | 1/4 (rolling bass) | `u_bass` domina el warp: el *rolling* se ve como pulsación del medio a 16avos. Tensión larga y morph alto |
| **Mental tribe / dark psy / forest** | Enjambre | Conforme | 0,6 / 0,8 / 0,6 | 1/4 + swing | `u_syncopation` × groove a las fases del enjambre. Isolíneas tribales. `ACID` activa la resonancia |
| **Goa** | Conforme | Enjambre | 0,5 / 0,5 / 0,7 | 1 | Mandalas D_n saturados, anillo armónico muy presente (melodías modales) |
| **Techno industrial / hard techno / EBM** | Cristal | Éter (niebla) | 0,85 / 0,4 / 0,2 | 1 | Kick → offset del fold cuantizado. `APOCALYPSE` → desgarro. Paleta casi monocroma: `u_saturation` bajo manda |
| **Minimal / deep tech** | Enjambre | — | 0,3 / 0,3 / 0,5 | 1/2 | Pocas cargas (morph bajo), mucha memoria. El espacio negro es protagonista |
| **House / deep house / disco** | Conforme | Enjambre | 0,4 / 0,4 / 0,8 | 1 | El chroma manda (acordes de 7ª y 9ª → anillos ricos). Hi-hats abiertos → polvo |
| **Drum & bass / neurofunk** | Cristal | Éter | 0,8 / 0,6 / 0,3 | 2 (*half-time*) | `u_snarePulse` es el PULSO principal (el 2 y el 4). Glitch en los *reese* (flatness) |
| **Dubstep / riddim / bass music** | Éter | Cristal | 0,8 / 0,5 / 0,4 | 2 | `u_subBass` a escala macro. Los *wobbles* → `u_spectralFlux` a la rugosidad. Tensión máxima en los buildups |
| **Ambient / downtempo / chill** | Éter | Conforme | 0,1 / 0,3 / 0,95 | 16–32 | Se sostiene sin PLL (confidence baja). `u_tension` y `u_spectralBuildup` sustituyen a los pulsos |
| **Pop / latin / reggaeton** | Conforme | Enjambre | 0,5 / 0,4 / 0,7 | 1 (dembow) | Saturación alta, `COLOR_SNAP` en los estribillos, swing del dembow por `u_syncopation` |
| **Hip-hop / trap** | Cristal | Conforme | 0,6 / 0,4 / 0,5 | 2 | 808 → escala macro (Ley 4). Redobles de hi-hat → chispas granulares |
| **Rock / metal** | Cristal | Éter | 0,8 / 0,6 / 0,3 | 1, confidence-weighted | Tempo humano: todo lo rítmico × `u_beatConfidence`. Harshness y flatness (distorsión) → rugosidad y glitch |
| **Clásica / cinematic** | Éter | Conforme | 0,2 / 0,3 / 0,9 | Libre | Sin pulsos. Color por `u_chroma(i)` (la armonía *es* la pieza). Tensión por `u_tension` |

---

## 6. Shaders de referencia

Los dos compilan contra el **contrato real**: se han ensamblado con `assembleFragmentShader` (preámbulo + epílogo de E3) y validado con `glslangValidator` como GLSL ES 3.00, tanto en forma canónica como con genes mutados inyectados como `#define`. No redeclaran nada del preámbulo y usan solo macros generadas desde `TELEMETRY_SCHEMA`.

### 6.1 ÆTHER SERPENT — Éter Volumétrico ∘ Conforme

**Qué es.** Un túnel serpenteante de humo luminoso con simetría D₅, visto desde dentro. La cámara vuela a lo largo de una espina de Lissajous 3D que avanza con el beat.

**Coreografía.**
- **Kick**: cada kick lanza un **anillo de densidad** que vuela hacia el fondo del túnel.
- **Sub-bass**: la pared respira.
- **Rolling bass**: agita la viscosidad del medio (warp).
- **Acordes**: los 12 sectores angulares encienden el acorde que suena.
- **Hi-hats**: salpican chispas granulares.
- **Buildup**: el túnel se estrecha, se retuerce, pierde el color y el FOV se cierra.
- **Drop**: todo se abre de golpe en el complementario.
- **Breakdown anunciado**: el humo se disuelve en lugar de tensarse.

| Canal | Implementación |
|---|---|
| PULSO | `ringZ = camZ + 1.5 + (1 − kickPulse)·14`: anillo que viaja |
| FLUJO | `gBeats = u_beatTime + u_time·0.05`. Giro de 16 beats, roll de 32 |
| COMPLEJIDAD | `gOct = mix(2, 5, u_morphFactor)`, fBm de octavas fraccionales |
| RUGOSIDAD | Hurst `mix(0.42, 0.68, flatness) + 0.15·harshness` |
| GLITCH | Bandas de `fragCoord` re-sorteadas cada semicorchea (solo APOCALYPSE) |
| TENSIÓN | `tc = approach²`: radio −1,1·tc, torsión, FOV +0,9·tc, drenaje del color |
| LIBERACIÓN | Radio +1,6·impact, FOV −0,5·impact, matiz +0,5, estallido radial local |
| COLOR | Matiz por tonalidad, anillo armónico de 12 sectores, temperatura por centroide |
| ATMÓSFERA | Grosor de pared = `u_lqAmbient`, niebla de fondo = `u_lqFloor` |

```glsl
// @euclid name    "Æther Serpent"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  ether
// @euclid genome  aggression=0.40 chaos=0.55 organicity=0.90
// @euclid zone    ambient..peak
// @euclid param   u_warpBoost    float -1.0 1.0 0.0 "Warp"
// @euclid param   u_densityBoost float -1.0 1.0 0.0 "Density"
// @euclid gene    G_SYM        struct int   3    9     5    a:+0.3 c:+0.2 o:-0.4
// @euclid gene    G_WARP       expr   float 0.4  2.2   1.25 a:+0.2 c:+0.8 o:+0.3
// @euclid gene    G_HUE_SPREAD expr   float 0.05 0.6   0.30 c:+0.6 o:+0.2
// @euclid gene    G_SEED       expr   float 0.0  100.0 0.0
// @euclid steps   56

uniform float u_warpBoost;     // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_densityBoost;

// ── Genes (el Genome Expander inyecta #define antes del cuerpo) ────────
#ifndef G_SYM
#define G_SYM 5.0
#endif
#ifndef G_WARP
#define G_WARP 1.25
#endif
#ifndef G_HUE_SPREAD
#define G_HUE_SPREAD 0.30
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI  3.14159265359
#define TAU 6.28318530718

// ── Canales sinestésicos (una evaluación por píxel en mainImage) ───────
float gBeats, gCamZ, gRadius, gWarp, gOct, gHurst, gTwist, gDensity, gLive;

// Hash 3D→1D sin senos (estable en highp, Hoskins).
float h13(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Value noise trilineal C1 en [-1,1].
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = h13(i);
  float n100 = h13(i + vec3(1.0, 0.0, 0.0));
  float n010 = h13(i + vec3(0.0, 1.0, 0.0));
  float n110 = h13(i + vec3(1.0, 1.0, 0.0));
  float n001 = h13(i + vec3(0.0, 0.0, 1.0));
  float n101 = h13(i + vec3(1.0, 0.0, 1.0));
  float n011 = h13(i + vec3(0.0, 1.0, 1.0));
  float n111 = h13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z) * 2.0 - 1.0;
}

// fBm con octavas FRACCIONALES — u_morphFactor añade detalle sin "pops".
// H = persistencia (exponente de Hurst): la rugosidad del fluido.
float fbm(vec3 p, float octaves, float H) {
  float amp = 0.5, sum = 0.0, norm = 0.0;
  for (int i = 0; i < 6; i++) {
    float w = clamp(octaves - float(i), 0.0, 1.0);
    sum  += amp * w * vnoise(p);
    norm += amp * w;
    p = p * 2.02 + vec3(1.7, -3.1, 2.3);
    amp *= H;
  }
  return sum / max(norm, 1e-4);
}

// Espina dorsal de la serpiente: curva de Lissajous 3D en z.
vec2 serpent(float z) {
  return vec2(sin(z * 0.23 + G_SEED) * 1.4 + sin(z * 0.11 + 1.3) * 0.8,
              cos(z * 0.19 + G_SEED * 1.7));
}

// Densidad σ(x): cáscara de túnel × fBm sobre dominio deformado + anillos
// de choque. `fil` devuelve el valor de filamento y `ang` el ángulo polar
// (para el anillo armónico del chromagrama).
float density(vec3 p, out float fil, out float ang) {
  vec3 q = p;
  q.xy -= serpent(q.z);
  // Torsión: base lenta en rejilla de 16 beats + tensión de Cassandra.
  q.xy *= rot2(q.z * gTwist + gBeats * TAU / 16.0);
  float r = length(q.xy);
  ang = atan(q.y, q.x);
  // Pliegue polar de orden G_SYM — simetría diédrica del mandala.
  float seg = TAU / G_SYM;
  float a = abs(mod(ang, seg) - 0.5 * seg);
  q.xy = vec2(cos(a), sin(a)) * r;
  // Domain warping analítico en 2 capas — la viscosidad del éter.
  vec3 w = q;
  w += gWarp * sin(w.zxy * 0.8 + vec3(gBeats * 0.50, gBeats * 0.37, gBeats * 0.29));
  w += gWarp * 0.5 * sin(w.yzx * 1.7 - gBeats * 0.23);
  fil = fbm(w * 0.9, gOct, gHurst);
  // Pared blanda: su grosor es la atmósfera ambient de Omniliquid.
  float wall  = 0.9 + 0.6 * u_lqAmbient;
  float shell = 1.0 - smoothstep(0.0, wall, abs(r - gRadius + fil * 0.8));
  // Anillo de choque: cada KICK lanza uno que vuela hacia el fondo.
  float ringZ = gCamZ + 1.5 + (1.0 - u_kickPulse) * 14.0;
  float ring  = u_kickPulse * exp(-abs(p.z - ringZ) * 3.0) * exp(-abs(r - gRadius) * 1.5);
  return max(shell * (0.55 + 0.45 * fil), 0.0) * gDensity + 2.0 * ring;
}

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES (§3.1 — euChannels del preámbulo: Ley de Uniformidad G6)
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  gLive  = live;
  gBeats = u_beatTime + u_time * 0.05;        // Ley de Integración: reloj del host
  gCamZ  = gBeats * 1.1 + u_time * 0.35;
  float rel = u_impact;

  gRadius  = 2.3 + 0.5 * u_subBass * gLive - 1.1 * tc + 1.6 * rel + 0.8 * td;
  gWarp    = G_WARP * max(0.35 + 0.9 * u_bass + 0.4 * u_warpBoost, 0.05) * (1.0 + tc);
  gOct     = mix(2.0, 5.0, u_morphFactor);                       // complejidad ← Omniliquid
  gHurst   = clamp(mix(0.42, 0.68, u_flatness) + 0.15 * u_harshness, 0.3, 0.8);
  gTwist   = 0.06 + 0.7 * tc;
  gDensity = max(0.6 + 0.8 * u_energy + 0.5 * u_densityBoost, 0.05) * (1.0 - 0.7 * td) * gLive;

  // ── 2. GLITCH DIGITAL (régimen discreto, solo con APOCALYPSE) ───────
  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float band = floor(fc.y / u_resolution.y * 24.0);
    float h = hash21(vec2(band, floor(gBeats * 4.0)));   // re-sorteo cada semicorchea
    fc.x += step(1.0 - 0.35 * glitch, h) * (h - 0.5) * u_resolution.x * 0.18 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;
  uv *= rot2(0.25 * sin(gBeats * TAU / 32.0));           // roll en rejilla de 8 compases

  // ── 3. CÁMARA — la tensión estrecha el FOV, el impacto lo abre ─────
  vec3 ro = vec3(serpent(gCamZ), gCamZ);
  vec3 ta = vec3(serpent(gCamZ + 2.5), gCamZ + 2.5);
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  float focal = 1.1 + 0.9 * tc - 0.5 * rel;
  vec3 rd = normalize(uv.x * rt + uv.y * up + focal * fw);

  // ── 4. INTEGRAL DE EMISIÓN-ABSORCIÓN (Beer-Lambert, front-to-back) ──
  vec3  col     = vec3(0.0);
  float trans   = 1.0;
  float t       = 0.2;
  float hueBase = u_chromaHue + 0.5 * rel;                     // impacto → complementario
  float sat     = 0.5 * (0.35 + 0.65 * u_saturation);
  vec3  phase   = vec3(0.0, 0.33, 0.67) + 0.15 * u_brightnessSpec;  // centroide → temperatura
  for (int i = 0; i < MAX_STEPS; i++) {
    float dt = 0.09 + t * 0.012;
    vec3 p = ro + rd * t;
    float fil, ang;
    float sigma = density(p, fil, ang);
    if (sigma > 0.002) {
      float alpha = 1.0 - exp(-sigma * dt * 2.4);
      int   pitch = int(mod(floor((ang + PI) / TAU * 12.0), 12.0));
      float harm  = 0.35 + 1.4 * u_chroma(pitch);              // anillo armónico
      vec3 e = palette(hueBase + G_HUE_SPREAD * fil + 0.015 * p.z,
                       vec3(0.5), vec3(sat), vec3(1.0), phase);
      e *= harm * (0.6 + 1.6 * fil * fil);
      if (u_hihatEnergy > 0.05) {
        e += u_hihatEnergy * 2.0 * (1.0 + u_ultraAir)
           * smoothstep(0.55, 0.8, vnoise(p * 9.0 + gBeats));  // chispas granulares
      }
      col   += trans * alpha * e;
      trans *= 1.0 - alpha;
      if (trans < 0.01) break;
    }
    t += dt;
  }
  // Fondo: la transmitancia restante ve la niebla de suelo de Omniliquid.
  col += trans * palette(hueBase + 0.5, vec3(0.02), vec3(0.03), vec3(1.0),
                         vec3(0.1, 0.2, 0.3)) * (0.3 + u_lqFloor);

  // ── 5. CONSERVACIÓN DE LA TENSIÓN — color ───────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum), 0.65 * tc);                        // la tensión drena el color
  col += rel * 0.35 * palette(hueBase, vec3(0.5), vec3(0.5), vec3(1.0), phase)
       * exp(-3.0 * length(uv));                               // estallido LOCAL, no full-field
  if (ACID) col *= 0.75 + 0.25 * sin(vec3(0.0, 2.1, 4.2) + length(uv) * 18.0 - gBeats * PI);

  // ── 6. TONEMAP + VIÑETA (el epílogo aplica masters, limitador y sRGB) ──
  col = 1.0 - exp(-col * (1.0 + 0.6 * u_energy));
  col *= 1.0 - 0.35 * dot(uv, uv);
  c = vec4(col, 1.0);
}
```

### 6.2 TRIBU MENTAL — Enjambre de Plasma ∘ Conforme

**Qué es.** Un mandala log-polar con zoom infinito. Cada anillo de profundidad contrarrota respecto al anterior y está habitado por un enjambre de hasta 24 cargas que bailan nudos de Lissajous. Las isolíneas de su potencial dibujan una topografía tribal que fluye con el beat, y un feedback conforme deja estelas.

**Coreografía.**
- **Notas**: cada carga es una nota. El enjambre **canta el acorde** coloreado en el círculo de quintas.
- **Groove**: la sincopa (con PLL fiable) hace swing en las trayectorias.
- **Kick**: una onda cruza cada anillo de dentro hacia fuera.
- **Snare**: sacude el kaleidoscopio.
- **Buildup**: el enjambre **implosiona** y el zoom se acelera (Ley 3).
- **Drop**: el enjambre estalla y el zoom da un salto.
- **Silencio rítmico**: deja la pieza en eco.

| Canal | Implementación |
|---|---|
| PULSO | Onda radial `kr` por anillo log-polar. Dilatación del enjambre con el kick. Sacudida del kaleidoscopio con el snare |
| FLUJO | Zoom `beats·G_ZOOM`, giro de 16 beats, nudos de 8 beats |
| COMPLEJIDAD | Cargas vivas `mix(8, 24, morph)` con aparición fraccional |
| RUGOSIDAD | Grosor de isolínea por `u_mid` |
| GLITCH | Desgarro polar (cuantización angular) + bandas (APOCALYPSE) |
| TENSIÓN | Implosión `spread × (1 − 0,8·tc)`. Zoom y giro acelerados por `tc²` (Ley 3). Drenaje del color |
| LIBERACIÓN | Explosión `× (1 + 1,8·impact)`, salto de zoom, complementario central |
| COLOR | Una nota por carga, círculo de quintas, paleta por profundidad de anillo |
| ATMÓSFERA | Fondo `u_lqFloor`, eco con `RHYTHMIC_VOID`, persistencia del feedback |

```glsl
// @euclid name    "Tribu Mental"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  swarm+conformal
// @euclid genome  aggression=0.60 chaos=0.75 organicity=0.65
// @euclid zone    gentle..peak
// @euclid param   u_trails float -1.0 1.0 0.0 "Trails"
// @euclid param   u_swarm  float -1.0 1.0 0.0 "Swarm"
// @euclid gene    G_FOLD   struct int   5    12    8    a:+0.4 c:+0.3
// @euclid gene    G_KNOT_A struct int   1    5     3    c:+0.7
// @euclid gene    G_KNOT_B struct int   1    4     2    c:+0.5 o:-0.2
// @euclid gene    G_PERIOD expr   float 0.6  1.4   0.9  o:+0.5 a:-0.3
// @euclid gene    G_ZOOM   expr   float 0.05 0.5   0.25 a:+0.6
// @euclid gene    G_SEED   expr   float 0.0  100.0 0.0

uniform float u_trails;   // Regla del Cero Neutro: 0 = diseño canónico
uniform float u_swarm;

#ifndef G_FOLD
#define G_FOLD 8.0
#endif
#ifndef G_KNOT_A
#define G_KNOT_A 3.0
#endif
#ifndef G_KNOT_B
#define G_KNOT_B 2.0
#endif
#ifndef G_PERIOD
#define G_PERIOD 0.9
#endif
#ifndef G_ZOOM
#define G_ZOOM 0.25
#endif
#ifndef G_SEED
#define G_SEED 0.0
#endif

#define PI        3.14159265359
#define TAU       6.28318530718
#define SWARM_MAX 24

void mainImage(out vec4 c, in vec2 fragCoord) {
  // ── 1. CANALES (§3.1 — euChannels del preámbulo: Ley de Uniformidad G6)
  float tc, td, glitch, live, groove;
  euChannels(tc, td, glitch, live, groove);
  float beats   = u_beatTime + u_time * 0.04;
  float rel     = u_impact;
  float aspect  = u_resolution.x / u_resolution.y;

  vec2 fc = fragCoord;
  if (glitch > 0.01) {
    float band = floor(fc.y / u_resolution.y * 32.0);
    float h = hash21(vec2(band, floor(beats * 4.0)));
    fc.x += step(1.0 - 0.3 * glitch, h) * (h - 0.5) * u_resolution.x * 0.12 * glitch;
  }
  vec2 uv = (fc - 0.5 * u_resolution.xy) / u_resolution.y;

  // ── 2. ESPACIO CONFORME: log-polar + zoom infinito (Droste) ─────────
  float r  = max(length(uv), 1e-4);
  float th = atan(uv.y, uv.x);
  // Ley de la Derivada: sumar tc (= a²) a la FASE acelera el zoom mientras
  // la tensión sube (velocidad extra = da²/dt) — jamás un salto.
  float zoom = beats * G_ZOOM + 0.8 * tc + 0.6 * rel;
  float lz   = log(r) - zoom;
  float ring = floor(lz / G_PERIOD);                    // profundidad del anillo
  float lw   = mod(lz, G_PERIOD) - 0.5 * G_PERIOD;      // [-P/2, P/2)
  float dir  = mod(ring, 2.0) * 2.0 - 1.0;              // contrarrotación tribal
  float spin = dir * (beats * TAU / 16.0 + 1.5 * tc) + u_snarePulse * 0.15;
  float seg  = TAU / G_FOLD;
  float ta   = abs(mod(th + spin, seg) - 0.5 * seg);    // grupo diédrico D_n
  if (glitch > 0.01) ta = mix(ta, floor(ta * 24.0) / 24.0, glitch);  // desgarro polar
  vec2 s = vec2(lw, ta);   // celda conforme: los ángulos se preservan en todo el zoom

  // ── 3. ENJAMBRE: N cargas sobre nudos de Lissajous ──────────────────
  float nLive  = mix(8.0, float(SWARM_MAX), clamp(u_morphFactor + 0.5 * u_swarm, 0.0, 1.0));
  float spread = (1.0 - 0.8 * tc) * (1.0 + 1.8 * rel) * (1.0 + 0.3 * u_kickPulse) * (1.0 + 0.6 * td);
  vec2  center = vec2(0.0, 0.25 * seg);
  vec2  ext    = vec2(0.42 * G_PERIOD, 0.25 * seg);
  float sat    = 0.5 * (0.35 + 0.65 * u_saturation);
  float pot    = 0.0;
  vec3  glow   = vec3(0.0);
  for (int i = 0; i < SWARM_MAX; i++) {
    float fi = float(i);
    float w  = clamp(nLive - fi, 0.0, 1.0);    // aparición fraccional: sin pops
    if (w <= 0.0) break;
    float ph    = fi * 2.39996323;             // ángulo áureo: reparto sin clusters
    float swing = groove * u_syncopation * 0.8 * sin(fi * 1.3 + G_SEED);
    float a     = beats * TAU / 8.0 + ph + swing;          // un ciclo cada 2 compases
    vec2  knot  = vec2(sin(G_KNOT_A * a + G_SEED), sin(G_KNOT_B * a + ph));
    vec2  dv    = s - (center + knot * ext * spread);
    int   pitch = i % 12;                                  // cada carga canta una nota
    float q     = w * (0.25 + 1.6 * u_chroma(pitch)) * (0.0009 + 0.0022 * u_energy) * live;
    float g     = q / (dot(dv, dv) + 0.00035 + 0.0015 * td);
    pot  += g;
    float hue = u_chromaHue + mod(float(pitch) * 7.0, 12.0) / 12.0;  // círculo de quintas
    glow += g * palette(hue, vec3(0.5), vec3(sat), vec3(1.0), vec3(0.0, 0.33, 0.67));
  }

  // ── 4. ISOLÍNEAS DEL POTENCIAL: tatuaje tribal que fluye con el beat ─
  float freq = ACID ? 7.0 : 3.0;                          // 303 → resonancia de contornos
  float iso  = fract(log(1.0 + pot) * freq - beats * 0.5);
  float line = 1.0 - smoothstep(0.0, 0.05 + 0.05 * u_mid, abs(iso - 0.5));
  line *= (0.2 + 0.8 * u_mid) * smoothstep(0.05, 0.6, pot);

  vec3 lineCol = palette(u_chromaHue + 0.5 + ring * 0.08, vec3(0.5), vec3(sat),
                         vec3(1.0), vec3(0.1, 0.35, 0.6));
  vec3 bg = palette(u_chromaHue + ring * 0.07, vec3(0.03), vec3(0.035), vec3(1.0),
                    vec3(0.2, 0.1, 0.3)) * (0.4 + u_lqFloor);
  // Onda de kick: nace en el borde interior del anillo y viaja hacia fuera.
  float kr = u_kickPulse * exp(-abs(lw - (0.5 - u_kickPulse) * G_PERIOD) * 60.0);
  // Hi-hats: polvo estelar granular re-sorteado cada semicorchea.
  float sp = hash21(floor(s * 140.0) + floor(beats * 8.0));

  vec3 col = bg + glow + (1.4 * line + 1.2 * kr) * lineCol;
  col += step(0.985 - 0.02 * u_ultraAir, sp) * u_hihatEnergy * vec3(1.2);
  col *= smoothstep(0.0, 0.06, r);                        // anti-alias de la singularidad
  // El ojo del mandala respira con el sub-bass.
  col += palette(u_chromaHue + 0.25, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67))
       * 0.015 / (r + 0.02) * (0.3 + u_subBass) * live;

  // ── 5. CONSERVACIÓN DE LA TENSIÓN — color ───────────────────────────
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(1.0, 0.95, 1.1), 0.6 * tc);
  col += rel * 0.3 * palette(u_chromaHue + 0.5, vec3(0.5), vec3(0.5), vec3(1.0),
                             vec3(0.0, 0.33, 0.67)) * exp(-2.0 * r);
  col = 1.0 - exp(-col * 1.2);
  if (RHYTHMIC_VOID) col *= 0.4;                          // el silencio rítmico deja eco

  // ── 6. MEMORIA: feedback conforme sobre u_prevFrame ─────────────────
  if (u_hasPrev > 0.5) {
    vec2 f = fragCoord / u_resolution.xy - 0.5;           // uv normalizado: paridad Modo A/B
    f.x *= aspect;
    f *= 0.992 - 0.03 * rel + 0.012 * tc;                 // <1 estela expansiva · >1 implosiva
    f  = rot2(0.006 * (1.0 + u_bass) * dir) * f;
    f.x /= aspect;
    vec3 prev = texture(u_prevFrame, f + 0.5).rgb;
    prev *= prev;                                         // sRGB → lineal (aprox. γ2)
    float persist = clamp(0.82 + 0.10 * u_trails + (RHYTHMIC_VOID ? 0.12 : 0.0)
                          - 0.25 * glitch, 0.0, 0.96);
    col = max(col, prev * persist);                       // max-blend: estable, sin acumulación
  }
  c = vec4(col, 1.0);
}
```

---

## 7. Presupuesto de rendimiento por familia

El governor (§4.5 del Oracle) degrada `u_renderScale` cuando la media de frame supera 15 ms. El diseño tiene que dejarle margen.

| Familia | Coste dominante | `@euclid steps` | Objetivo a 1080p×0,75 | Palanca de ahorro |
|---|---|---|---|---|
| Conforme | O(1) | — | < 2 ms | Ninguna necesaria |
| Enjambre | O(N) cargas | — | < 4 ms (N = 24) | `nLive` por morph. `break` temprano |
| Cristal | O(pasos × iter) | 64–96 | < 10 ms | Iteraciones fraccionales, ε relativo a t |
| Éter | O(pasos × octavas) | 40–64 | < 12 ms | Terminación por transmitancia, Δt adaptativo, warp analítico (senos) en vez de fBm anidado |

**Modo B (4K nativo).** La ventana HDMI tiene su propio governor. Éter y Cristal van a caer a `renderScale` 0,4–0,6 en 4K, y es el comportamiento esperado: el humo y la niebla toleran bien el upscale lineal. Conforme y Enjambre rinden a 1,0.

**Gemelo 64×64.** Cuesta muy poco en cualquier familia. El worker no necesita presupuesto.

---

## 8. Hallazgos sobre la infraestructura E0–E5 (verificados en el código)

Durante el diseño se revisó el contrato real para garantizar la compatibilidad. Aparecieron dos defectos que **condicionan** este blueprint:

| # | Defecto | Dónde | Efecto | Corrección propuesta |
|---|---|---|---|---|
| **H1** | Con el crossfade inactivo, `CrossfadeUnit.step()` devuelve `alphaSecondary = 0`, y el worker lo sube tal cual como `u_blend`. Como `genPrevValid` queda a `true` tras la primera captura, el epílogo hace `mix(prev, c, 0)` = **prev**: el frame queda congelado | `theta.worker.ts`, `renderGenerativeFrame`: `gl.uniform1f(L.blend, xfStep.alphaSecondary)` | En el worker (Modo A y gemelo 64×64 → **DMX**) el shader generativo se congela en su primer frame. Solo se mueve mientras dura un crossfade. `GenRuntime` (Modo B) **no** está afectado (usa blend = 1 en reposo) | `u_blend = xfStep.active ? xfStep.alphaSecondary : 1.0` |
| **H2** | `noise3()` del preámbulo aplica `hash21` sobre coordenadas **continuas** (el truco original de IQ interpola con una textura bilineal, que aquí no existe) | `ShaderAssembler.buildPreamble` | Ruido blanco en x,y (solo interpola en z): **no es ruido suave**. Cualquier fBm construido sobre él parpadea | Sustituir por value noise trilineal con hash en la retícula entera (el `vnoise` de §6.1) |

Por H2, los dos shaders de referencia **no usan `noise3`**: traen su propio `vnoise`. H1 impide ver *Tribu Mental* (feedback) y cualquier core en el gemelo DMX hasta que se corrija. Ambos van en la fase G0.

---

## 9. Roadmap de implementación

| Fase | Contenido | Depende de | Riesgo |
|---|---|---|---|
| **G0** | Corregir H1 (blend en reposo) y H2 (ruido del preámbulo). Tests de certificación: el frame generativo cambia en reposo; `noise3` es continuo (|Δ| acotado bajo Δx pequeño) | E5 | Bajo |
| **G1** | Parser `@euclid family/gene/seed`. El assembler inyecta los `#define G_*` antes del cuerpo (el hash del programa incluye los genes). Slots reservados 58–63: `u_energyTime` (∫energy·dt, integrado en el host, Ley 1) y `u_barCount` | G0 | Bajo |
| **G2** | Genome Expander (PCG + sesgo ADN + dispersión por caos + curvas). Retroproyección del ADN. Átomos variante `core#seed` en el registry; dedupe por `genomeId` | G1 | Medio |
| **G3** | `u_gene[8]` para genes `expr` (mutación sin recompilar). Mutación en frontera de frase con las compuertas del §4.6. Crossover | G2 | Medio |
| **G4** | Bucle de Darwin: fitness EMA desde `u_beauty` + favorito/skip del operador. Torneo. Población viva de 8 por core | G3 | Medio |
| **G5** | Estado float persistente (RGBA16F ping-pong + `EXT_color_buffer_float`) para autómatas reales: reacción-difusión Gray-Scott y Physarum. Nueva familia derivada: *Materia Viva* | G0 | Alto (dos contextos GL) |
| **G6** | Biblioteca estándar de canales en el preámbulo (`euChannels()` que calcula tc, td, glitch, live y groove de forma idéntica para todos los cores). Esto obliga a la Ley de Uniformidad por construcción | G1 | Bajo |

---

## 10. Definition of Done — certificación de un core

Un core entra en el arsenal solo si cumple todo esto:

- [ ] Compila contra preámbulo + epílogo (`glslangValidator -S frag`) en forma canónica **y** con cada gen en sus extremos min/max.
- [ ] Implementa los 9 canales (§3.1), cada uno con la fuente estándar.
- [ ] Cumple la Ley 1: ninguna expresión `u_time·x` ni `u_beatTime·x` con x variable (revisión estática: `grep` de productos con macros de telemetría).
- [ ] Cumple la Ley 2: todos los períodos son 2ᵏ beats; la deriva libre tiene k ≤ 0,05.
- [ ] Cumple la Ley 4: la tabla banda → escala no está invertida.
- [ ] Cumple la Ley 5: un drop sintético (`u_impact = 1`) no dispara el limitador más de una vez.
- [ ] Todos los params son neutros en 0.
- [ ] El LOD de complejidad es fraccional: un barrido de `u_morphFactor` 0 → 1 no produce ningún frame con salto de luminancia media > 0,02.
- [ ] Degradación: con `AUDIO_LIVE = false` hay vida (el frame no es constante ni negro).
- [ ] Rendimiento: dentro del objetivo del §7 a 1080p × 0,75 sin que el governor degrade.
- [ ] Paridad: el gemelo 64×64 conserva la masa de color de la versión nativa (error medio de color < 10 % tras downsample).
- [ ] Cabecera completa: name, author, family, genome, zone, genes con afinidades y steps si hay raymarch.

---

*El Oracle le dio a Theia un sistema nervioso. Infinite Genome le da una especie: cuerpos que nacen de semillas, se tensan antes del drop, estallan cuando llega y evolucionan a lo largo de la noche según lo que la sala aplaude.*
