# LuxSync · Plantilla de Átomo de Shader (Euclid Oracle)

Documento **autocontenido** para generar nuevos átomos `.glsl` para el motor
Theia/Euclid de LuxSync. Todo lo que un generador necesita está aquí — no hace
falta más contexto del repositorio.

> *Contrato al día: WAVE 8287 · **Clean Shot** — la aproximación cognitiva
> (`u_approach`/`u_impact`/`tc`/`td`) está extirpada de la geometría: el
> movimiento base es el reloj BPM y los bursts solo detonan con
> `u_activeEffectEnergy` (paridad video↔DMX, §8.1). Incluye la página B
> física de Liquid (§6.2), `euTimbre()` (§8.2) y la deprecación del
> estrobo (Fase 5).*

Los átomos viven en `electron-app/assets/shaders/*.glsl`. El motor compila cada
archivo como: **preámbulo generado → tus defines/meta → tu cuerpo → epílogo
generado**. El artista escribe `mainImage()`; el motor posee la salida.

---

## 1. Cabecera `@euclid` (meta — comentarios en las primeras líneas)

```glsl
// @euclid name    "Mi Átomo"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  ether                 // simple o compuesta: swarm+conformal
// @euclid genome  aggression=0.40 chaos=0.55 organicity=0.90   // 0..1, opcional
// @euclid zone    ambient..peak         // silence < valley < ambient < gentle < active < intense < peak
// @euclid seed    123456789             // opcional; 'auto' = hash del nombre
// @euclid param   u_warpBoost float -1.0 1.0 0.0 "Warp"        // slider de UI
// @euclid gene    G_SYM   struct int   3    9     5   a:+0.3 c:+0.2 o:-0.4
// @euclid gene    G_WARP  expr   float 0.4  2.2   1.25 a:+0.2 c:+0.8 o:+0.3
// @euclid steps   56                    // techo de iteraciones raymarch (def. 64)
```

Reglas:

- **`@euclid param`** declara un slider en el Inspector (`SHADER PARAMS`).
  Sintaxis: `u_nombre tipo min max default "Label"`. En el cuerpo debes
  declararlo tú: `uniform float u_warpBoost;`. **Regla del Cero Neutro**:
  `default = 0` y el shader debe verse canónico con el param a 0 (el param
  es modulación ±, no el valor base).
- **`@euclid gene G_X struct int min max default`** → literal inyectado en el
  código (constante por mutación de Darwin). En el cuerpo:
  `#ifndef G_SYM / #define G_SYM 5.0 / #endif`.
- **`@euclid gene G_X expr float min max default`** → uniform `u_gene[k]` en
  vivo (fader en `GENETIC PARAMETERS`, máx **8 genes expr** por átomo, en orden
  de declaración). Mismo guardia `#ifndef`.
- Los tags `a:+0.3 c:+0.2 o:+0.4` son afinidades del genoma
  (aggression/chaos/organicity) para la evolución — opcionales.
- `@euclid steps N` fija `MAX_STEPS` (define ya presente). Bájalo si tu
  raymarcher es caro; el governor también escala resolución bajo estrés.

---

## 2. Contrato de salida (Ley de oro — NO negociable)

```glsl
void mainImage(out vec4 c, in vec2 fragCoord) {
  vec3 col = /* ... tu arte ... */;
  c = vec4(col, 1.0);
}
```

- Escribe color en **espacio LINEAL puro**. El epílogo del motor aplica, en
  orden: contraste → brillo → blackout → crossfade → limitador fotosensible
  → tonemap **ACES** → clamp → sRGB.
- **PROHIBIDO** auto-tonemap (`1-exp(-x)`), gamma propio, o clamp manual al
  final. Si lo haces, la doble corrección lava los negros.
- Para "exposición por energía" multiplica en lineal:
  `col *= 1.0 + 0.6 * u_energy;` — ACES hará el rolloff y conservará el croma.
- Negros reales: escribe ~0 donde quieras negro. ACES+gamma respetan el 0.

## 3. Relojes (ya gobernados por el fader SPEED de la UI)

| Uniform | Qué es |
|---|---|
| `u_time` | Segundos acumulados, **escalados por SPEED** (suavizado τ160ms). |
| `u_beatTime` | Beats acumulados continuos, **escalados por SPEED**, con re-anclaje de fase al audio (se relaja a <1×). El motor de fase principal. |
| `u_dt` | Delta del frame (s). |
| `u_tSec` | Reloj de pared del host (sin gobernar). |
| `u_bpm`, `u_beatPhase`, `u_barPhase`, `u_beatConfidence` | Reloj musical crudo del tracker. |
| `u_energyTime` | ∫energy·dt — fase continua sin multiplicar señales. |
| `u_barCount` | Compases absolutos (fronteras de frase). |
| `iTime`, `iResolution`, `iFrameRate` | Aliases Shadertoy (`u_time`, `u_resolution`, `1/u_dt`). |

**Convención de los átomos existentes** (evolución continua a tempo):

```glsl
float gBeats = u_beatTime + u_time * 0.05;   // ~95% beat, 5% deriva libre
float gCamZ  = gBeats * 1.1 + u_time * 0.35; // viaje de cámara
```

## 4. Transitorios musicales (tiempo real — INMUNES al SPEED)

Estas envolventes nacen de eventos de audio, **no de los relojes**: un kick
golpea con la misma fuerza a 0.25× que a 2×. Úsalas para flashes, anillos y
temblores; usa los relojes para movimiento continuo.

| Uniform | Semántica | Origen |
|---|---|---|
| `u_kickPulse` | `exp(-t/τ)` desde flanco de bombo (τ=¼ beat) | KICK_EDGE |
| `u_snarePulse` | Ídem caja/redoblante | SNARE |
| `u_crestPulse` | `exp(-t/τ)` desde cresta CF>2 — **latencia cero**, τ=110ms absoluto (más rápido que kick/snare, sin tempo) | CREST_EVENT |
| `u_glassBreak` | Pulso de ruptura soberana (τ=380ms) — el drop llegó ANTES de agotar el countdown | GLASS_BREAK |
| `u_activeEffectEnergy` 🔫 | Envolvente del clip físico vivo: hold a la `intensity` exacta durante `durationMs` reales + release ~250ms — **paridad video↔DMX** | EFFECT_ACTIVE (pág. B, slots 96-99) |
| `u_activeEffectAge` 🔫 | Progreso normalizado 0→1 del clip (`elapsed/durationMs`) — curva tu propio ataque/final | slot 97 |
| `u_activeEffectId` 🔫 | Hash estable del arquetipo de efecto (0..1) | slot 98 |
| `u_activeEffectCount` 🔫 | Nº de clips concurrentes vivos | slot 99 |
| ~~`u_impact`~~ | ⛔ DEPRECADO en átomos (WAVE 8287) — pulso cognitivo congelable; usar `u_activeEffectEnergy` | — |
| ~~`u_approach`~~ | ⛔ DEPRECADO en átomos (WAVE 8287) — aproximación continua prohibida en geometría | — |
| ~~`u_predictiveETA`~~ | ⛔ DEPRECADO en átomos (WAVE 8287) | — |
| `u_vocalOnset` 🌊 | `exp(-t/600ms)` — la voz APARECE: respiración lenta, no un golpe | VOCAL_ONSET (pág. B) |
| `u_snareTruePulse` 🌊 | `exp(-t/¼beat)` — caja confirmada por el detector MACD (cero falsos positivos vocales) | SNARE_TRUE (pág. B) |
| `u_voidRelease` 🌊 | `A·exp(-t/450ms)` — rebote al salir del vacío rítmico; **A ∝ lo que duró** (0.25 → hold≥2s, 1.0 → hold≥8s) | VOID_RELEASE (pág. B) |

🌊 *WAVE 8279 · Página B — pulsos físicos del DSP Liquid (ver §6.2).*

## 5. Bandas de audio (suavizadas por frame, ~0..1)

`u_energy` (global) · `u_subBass` (punchy: attack 0.6) · `u_bass` · `u_lowMid` ·
`u_mid` · `u_highMid` · `u_treble` · `u_ultraAir` ·
`u_kickEnergy` · `u_snareEnergy` · `u_hihatEnergy` · `u_syncopation`

Métricas perceptuales: `u_brightnessSpec` (centroide) · `u_flatness` ·
`u_crestN` · `u_harshness` · `u_spectralFlux` (attack rápido) ·
`u_transientDensity` · `u_saturation`

Tonalidad: `u_chromaHue` (circular, usar en `palette()`) · `u_chromaFlux` ·
`u_chroma(i)` — 12 bins cromáticos C→B, `i` en `0..11` (pitch class de GodEar).

## 6. Intents de Selene/Cassandra (el oráculo)

`u_seleneConfidence` · `u_predictionProb` · `u_selEtaMs` · `u_selEtaBeats` ·
`u_tension` · `u_beauty` · `u_zScoreN` · `u_spectralBuildup`

> ⛔ **WAVE 8287 · Clean Shot — diagnóstico, no geometría.** Estas variables
> describen *intención* (post-gate de Selene: se publican a 0 con la IA
> apagada — WAVE 8286). En átomos están **prohibidas** — el migrador las
> rechaza en `--check`. Para bursts cognitivos usa `u_activeEffectEnergy`
> (§4/§8.1): es el hecho físico — una luz ejecutándose — no la intención.

Omniliquid (capas de fondo): `u_morphFactor` (muy suave) · `u_recoveryFactor` ·
`u_lqFloor` · `u_lqAmbient` · `u_lqAir`

### 6.2 Liquid DSP — física acústica en vivo (Página B, WAVE 8279)

Lo que el motor Liquid **mide en el audio**, no lo que predice. Todo ~0..1
salvo los relojes (segundos) y los deltas crudos. *Suavizados* = attack/release
por frame; *crudo* = valor del instante, sin suavizar (rápido, usable tal cual).

**Voz y mezcla** (suavizadas): `u_vocalSustain` (sostén vocal, decae honesto
en silencio) · `u_vocalIsolation` (cuánta voz aislada hay — sustenta `VOCAL_ONSET`)
· `u_cleanMid` (medios limpios de percusión) · `u_synthSustain` (sostén sintético
continuo — la "calma viscosa" del synth)

**Vacío rítmico**: `u_rhythmicVoid` (nivel de vacío percusivo — la sequía que
alimenta `u_voidRelease`) · `u_percAbsence` · `u_voidHold` (**reloj crudo** —
segundos continuos de vacío ≥0.75; se resetea en el release) ·
`u_vocalTime` (**reloj** — ∫vocalIsolation·dt, fase lenta de presencia vocal)

**Caja verdadera** (detector MACD — inmune a falsos positivos vocales):
`u_snareDrive` · `u_snareMomentum` (crudos) · `u_gateHealth` (salud de la
compuerta — cae a 0 con caja sintética) · `u_snareCrack` (leading edge del
golpe)

**Zonas espaciales del rig** (intensidad 0..1 por parlante):
`u_zFrontL/R` · `u_zBackL/R` · `u_zMoverL/R` · `u_zSnareAttack`

**Naturaleza del material**: `u_whiteNoise` (score de ruido blanco) ·
`u_wallIntensity` (wall-of-sound del photon) · `u_spectralDensity` (densidad
de contenido) · `u_fluxBaseline` (baseline de flux normalizado) ·
`u_agcStress` (estrés del AGC — señal llegando aplastada, ~0..1)

**Deltas crudos** (cambio frame a frame, sin rectificar ni suavizar):
`u_midDelta` · `u_highMidDelta` · `u_trebleDelta` · `u_hhDelta`

**Disparo de efecto** (slots 96-99, WAVE 8287): `u_activeEffectEnergy`
(envolvente del clip físico vivo — hold a `intensity` durante `durationMs`
reales + release ~250ms) · `u_activeEffectAge` (progreso 0→1 del clip) ·
`u_activeEffectId` (hash del arquetipo) · `u_activeEffectCount` (clips
concurrentes). Gate barato: `EFFECT_ACTIVE`. **El único canal cognitivo
permitido en geometría** — describe el hecho físico (luces ejecutándose),
no la intención.

**Iliquidcore — cognición estructural (Selene V3, WAVE 8275):**

| Uniform | Semántica | Uso canónico |
|---|---|---|
| `u_epicness` | Presión "épica" del veredicto de Liquid Cognition [0,1] — autoridad Divine del clímax | Escala de grandeza: apertura de cámara, profundidad de campo, octave-doubling del fractal |
| `u_vaporPressure` | V(t) — presión de vapor refractaria del fluido cognitivo [0,1]. **CRECE con el tiempo sin disparo** (sed del sistema) | Distorsión gravitacional/refracción sostenida que se intensifica en sequía de eventos — no necesita un beat |
| `u_percussiveness` | Π — densidad Poisson de crestas [0,1] | Densidad geométrica: más crestas → más filos, más partículas |
| `u_melodicity` | M — contenido armónico/melódico [0,1] | Tinte armónico: curvas suaves vs. angulosas |
| `u_crestRate` | Crestas CF>2 por segundo — **sin clamp** (>1 legal) | Excitación por tasa: `min(1.0, u_crestRate * 0.2)` |
| ~~`u_strobeGate`~~ | ⚠️ **DEPRECADO (Fase 5)** — siempre 0.0; el StrobeEngine está desactivado | No usar — se conserva solo para que shaders viejos sigan compilando |

`ivec4 u_enums`: `x`=schema `y`=predictionType
(0 none · 1 drop_incoming · 2 buildup_starting · 3 breakdown_imminent ·
4 transition_beat) `z`=huntState (0 sleeping·1 stalking·2 evaluating·
3 striking·4 learning) `w`=energyZone (0 calm·1 rising·2 peak·3 falling).
*Clean Shot: `y`/`z`/`w` son post-gate — solo para diagnóstico/TELDIAG,
no para geometría.*

## 7. Flags — `telFlag(bit)` y defines booleanos

```glsl
AUDIO_LIVE  PLL_LOCKED  ON_BEAT  KICK  KICK_EDGE  SNARE  HIHAT
PREDICTION_ACTIVE  BREAKDOWN  APOCALYPSE  ACID  COLOR_SNAP  RHYTHMIC_VOID
CREST_EVENT  STROBE_ACTIVE  SOVEREIGN_COUNTDOWN  GLASS_BREAK   // 🧠 WAVE 8275
REAL_SILENCE  VOCAL_ONSET  NOISE_MODE  GATE_DEAD  SNARE_TRUE  VOID_RELEASE  // 🌊 WAVE 8279
EFFECT_ACTIVE                                                     // 🔫 WAVE 8287
```

🔫 `EFFECT_ACTIVE` (bit 23): nivel — hay ≥1 clip físico ejecutándose en
Hephaestus (`u_activeEffectCount > 0`). Gate barato para early-outs:
`if (EFFECT_ACTIVE) { /* burst */ }`.

Uso: `if (glitch > 0.01) {...}`, `if (ACID) col *= ...`,
`if (RHYTHMIC_VOID) col *= 0.4;` (el silencio rítmico deja eco).

WAVE 8275 (soberanos): `CREST_EVENT` es **flanco** (está encendido el tick
de la cresta — para pulsos usa `u_crestPulse`, ya suavizado).
`SOVEREIGN_COUNTDOWN` es **nivel**: pre-buffer de Cassandra armado con
`predictedEventAt` pendiente — abre el portal/anticipación visual antes del
drop. ~~`STROBE_ACTIVE`~~ es ⚠️ **DEPRECADO — siempre apagado** (Fase 5:
el StrobeEngine está desactivado; conservado solo para que shaders viejos
compilen — los flashes reales usan `u_*Pulse` + el limitador del epílogo).
`GLASS_BREAK` es ventana ~250ms tras la ruptura — para el efecto sostenido
usa `u_glassBreak` (pulso).

WAVE 8279 (página B — física Liquid): **niveles** — `REAL_SILENCE` (silencio
físico real: el DSP está en rama silencio/AGC-trap — apaga efectos de
audio, no el latido libre), `NOISE_MODE` (el espectro es ruido, flatness
alto), `GATE_DEAD` (compuerta de caja muerta — caja sintética o
indetectable). **Flancos** — `VOCAL_ONSET` (la voz entra), `SNARE_TRUE`
(caja confirmada por MACD), `VOID_RELEASE` (el vacío rítmico termina tras
≥2s de hold). Para los tres hay pulso suavizado ya calculado:
`u_vocalOnset` · `u_snareTruePulse` · `u_voidRelease` — **usa siempre el
pulso**, el bit es solo el tick del evento.

## 8. `euChannels` — los 3 canales derivados (evaluar UNA vez por píxel)

```glsl
float glitch, live, groove;
euChannels(glitch, live, groove);
```

| Canal | Fórmula | Uso canónico |
|---|---|---|
| `glitch` | `u_harshness` solo si `APOCALYPSE` | Desgarro digital: desplaza scanlines, cuantiza ángulos |
| `live` | 1.0 si `AUDIO_LIVE`, si no 0.3 | Factor de vida global — sin audio el átomo respira suave |
| `groove` | `u_beatConfidence` si `PLL_LOCKED`, si no 0.25 | Swing solo con pulso fiable |

### 8.1 🔫 Doctrina Clean Shot (WAVE 8287)

`tc`/`td` fueron **extirpados** de la firma: la aproximación cognitiva de
Selene (`u_approach`, `u_impact`, `u_predictiveETA`…) ya no gobierna
geometría — es continua, se congela y describe *intención*, no *hechos*.

- **Movimiento base** → relojes musicales: `u_beatTime`, `u_beatPhase`
  (pulso por beat), `u_barPhase` (respiración por compás), `u_barCount`.
  Patrones: `beatP = 0.5+0.5*cos(6.2831853*u_beatPhase)` ·
  `swell = sin(3.1415927*u_barPhase)`.
- **Bursts / eventos extremos** → `u_activeEffectEnergy` (hold durante la
  duración REAL del clip Hephaestus) esculpida por `u_activeEffectAge`.
  Si una luz DMX no está ejecutando un efecto, el átomo no detona.
- **Transitorios físicos** (kick, caja, voz, vacío, cresta) siguen
  permitidos — son audio, no cognición.

### 8.2 `euTimbre()` — mezcla de texturas físicas (WAVE 8279 · F4)

```glsl
vec4 euTimbre()   // ya inyectada — llámala directo, una vez por píxel
```

Devuelve **pesos convexos (Σ=1)** de las 4 "texturas" que el DSP Liquid mide
en el audio en este instante:

| Componente | Textura | Fuente |
|---|---|---|
| `tb.x` | **Voz** — presencia humana | `u_vocalIsolation` |
| `tb.y` | **Synth** — sostén sintético viscoso | `u_synthSustain` |
| `tb.z` | **Percusión** — densidad de golpes | `u_percussiveness` |
| `tb.w` | **Grano/ruido** — textura estática | `max(u_whiteNoise, u_spectralDensity)` |

Los pesos son **lineales** (`w / s` directo) — la textura dominante no
aplasta a las minoritarias: una voz al 30% convive con un synth al 60%.
*(WAVE 8282: antes se elevaban al cuadrado y la mezcla colapsaba al
dominante en material masterizado.)*
En silencio total devuelve `(0,1,0,0)` — calma viscosa (synth puro) en
lugar de un NaN.

Uso canónico — **morphing entre materiales/geometrías por naturaleza del
sonido**:

```glsl
vec4 tb = euTimbre();

// Mezcla cromática por textura (voz cálida, synth frío, percusión dura):
vec3 col = tb.x * colVoice + tb.y * colSynth + tb.z * colPerc + tb.w * colGrain;

// Morfología: percusión dominante → filos; synth → superficie lisa
float edges  = mix(3.0, 9.0, tb.z + tb.w * 0.5);
float viscos = tb.y;   // más synth → más lodo/menos detalle

// La voz respira con su onset (τ=600ms) — no necesitas el flag:
col += u_vocalOnset * tb.x * vec3(0.9, 0.7, 0.4);
```

## 9. Biblioteca inyectada (gratis — no redefinir)

```glsl
mat2 rot2(float a);
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d); // cosine IQ
float hash21(vec2 p);  float hash31(vec3 p);           // Hoskins, sin senos
float noise3(vec3 p);                                   // value noise trilineal C1
float sdSphere(vec3 p, float r);  float sdBox(vec3 p, vec3 b);
float sdTorus(vec3 p, vec2 t);    float smin(float a, float b, float k);
vec3 opRep(vec3 p, vec3 c);                             // repetición de dominio
vec4 euTimbre();                                        // §8.2 — 4 texturas Σ=1
void euChannels(out float glitch, out float live,
                out float groove);                      // §8 — Clean Shot 8287
#define MAX_STEPS N    // del hint @euclid steps (def. 64)
#define iTime iResolution iFrameRate                    // compat Shadertoy
```

## 10. Memoria entre frames

```glsl
// Feedback tipo "estelas" — u_prevFrame es la salida YA codificada (sRGB)
// del frame anterior; decodifícala antes de mezclar (prev*prev ≈ γ²):
if (u_hasPrev > 0.5) {
  vec3 prev = texture(u_prevFrame, uv).rgb;
  prev *= prev;                                  // sRGB → lineal aprox
  float persist = clamp(0.82 + 0.10 * u_trails - 0.25 * glitch, 0.0, 0.96);
  col = max(col, prev * persist);                // max-blend: estable
}
// `u_blend` (0→1) crossfadea en cambios de shader — no lo toques, el
// epílogo lo aplica.

// Autómatas (Gray-Scott, Physarum) — u_state: textura RGBA16F LINEAL y
// cruda (no pasa por el epílogo). u_stateInit==1.0 solo el primer frame:
if (u_stateInit > 0.5) { /* siembra el estado */ }
vec4 st = texture(u_state, uv);                  // estado del frame anterior
```

Masters UI (ya aplicados por el epílogo — no los uses salvo necesidad):
`u_brightness` · `u_contrast` · `u_blackout` · `u_renderScale` (resolución
del governor).

## 11. Esqueleto mínimo compilable

```glsl
// @euclid name    "Núcleo"
// @euclid author  "LuxSync · Infinite Genome"
// @euclid family  ether
// @euclid genome  aggression=0.50 chaos=0.50 organicity=0.80
// @euclid zone    ambient..peak
// @euclid param   u_pulseGain float -1.0 1.0 0.0 "Pulse"
// @euclid gene    G_FOLD  struct int   3    9     6    c:+0.4
// @euclid gene    G_SPEED expr   float 0.5  2.0   1.0  a:+0.3
// @euclid steps   48

uniform float u_pulseGain;   // Regla del Cero Neutro: 0 = diseño canónico

#ifndef G_FOLD
#define G_FOLD 6.0
#endif
#ifndef G_SPEED
#define G_SPEED 1.0
#endif

#define PI  3.14159265359
#define TAU 6.28318530718

void mainImage(out vec4 c, in vec2 fragCoord) {
  // 1. Canales derivados (una sola evaluación) — firma Clean Shot
  float glitch, live, groove;
  euChannels(glitch, live, groove);

  // 2. Relojes — continuo gobernado por el BPM; burst = clip físico vivo
  float beats = u_beatTime + u_time * 0.05;
  float swell = sin(3.1415927 * u_barPhase);            // respiración de compás
  float fx    = u_activeEffectEnergy;                   // 🔫 paridad video↔DMX

  // 3. Coordenadas centradas con aspecto corregido
  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // 4. Geometría — la fase avanza con beats (obedece SPEED)
  float fold  = G_FOLD;
  float phase = beats * TAU * G_SPEED + 0.8 * swell + 0.6 * fx;
  float mand  = 0.5 + 0.5 * cos(a * fold + phase + noise3(vec3(uv * 2.0, beats * 0.3)));

  // 5. Color — hue del chromagrama; el disparo drena a gris
  vec3 col = palette(u_chromaHue + mand * 0.3,
                     vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  col *= mand * (0.25 + 0.75 * u_energy) * live;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum), 0.5 * fx);

  // 6. Transitorios — TIEMPO REAL: golpean igual a cualquier SPEED
  col += u_kickPulse * 0.6 * exp(-abs(r - 0.4) * 8.0);            // anillo
  col += fx * 0.3 * palette(u_chromaHue + 0.5,
         vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0)) * exp(-2.0 * r);
  col += step(0.985 - 0.02 * u_ultraAir, hash21(uv + beats)) *
         u_hihatEnergy * vec3(1.2);                               // chispas
  if (glitch > 0.01) {
    float h = hash21(vec2(floor(fragCoord.y / 8.0), floor(beats * 8.0)));
    col = mix(col, col.bgr, step(1.0 - 0.3 * glitch, h) * glitch);
  }
  if (RHYTHMIC_VOID) col *= 0.4;

  // 7. Exposición lineal — el epílogo posee ACES + sRGB (NO tonemapear)
  col *= (1.0 + 0.5 * u_energy) * (1.0 + max(u_pulseGain, -0.9));
  col *= 1.0 - 0.35 * dot(uv, uv);                                // viñeta
  c = vec4(col, 1.0);
}
```

## 12. Checklist de aceptación

- [ ] Cabecera `@euclid` completa (name + family; genes con guardia `#ifndef`).
- [ ] Params `@euclid` declarados como `uniform` y neutros a 0.
- [ ] `mainImage(out vec4 c, in vec2 fragCoord)` — firma exacta.
- [ ] Movimiento continuo sobre `u_beatTime`/`u_beatPhase`/`u_barPhase`
      (obedece SPEED); impactos físicos sobre `u_kickPulse`/`u_*Energy`
      (tiempo real); bursts cognitivos SOLO sobre `u_activeEffectEnergy` —
      prohibidos `u_approach`/`u_impact`/predicción en geometría (§8.1).
- [ ] `euChannels` evaluado una vez (firma de 3 canales); `live`
      multiplica la vida del átomo.
- [ ] Texturas/morphs por naturaleza del audio via `euTimbre()` (§8.2) —
      pulsos físicos con `u_vocalOnset`/`u_snareTruePulse`/`u_voidRelease`,
      no con los flags crudos.
- [ ] ⚠️ `u_strobeGate`/`STROBE_ACTIVE` DEPRECADOS (Fase 5, siempre 0) —
      no los uses; flashes → pulsos + el limitador fotosensible del epílogo.
- [ ] Salida LINEAL — sin `pow(`, `exp(-` tonemap ni `clamp` final propios.
- [ ] Bucles de marcha acotados por `MAX_STEPS` y early-out (`if (trans < eps) break`).
- [ ] Nada de `textureLod`/cubemaps externos — solo `u_prevFrame`, `u_state`,
      `u_flashState` (interno, no tocar).
- [ ] Aspecto corregido con `u_resolution.y` (o `.xy` normalizando) — el
      preview y la salida HDMI tienen aspectos distintos.
