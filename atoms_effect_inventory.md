# 🌊 WAVE 8296-RECON — Atom Reactivity & Intent Mapping

**Alcance:** inventario solo-lectura de los átomos GLSL registrados en
`src/theia/shader/atoms/opusLibrary.ts`. Fuentes auditadas:
`electron-app/assets/shaders/*.glsl`, preámbulo generado por
`src/theia/shader/ShaderAssembler.ts`, suavizado en
`src/theia/telemetry/TelemetrySmoother.ts` y anillo de slots en
`src/theia/telemetry/TheiaTelemetryRing.ts` (slots 96–99: `ACTIVE_FX_*`).

> **⚠️ Discrepancia 11 vs 13.** El brief habla de *11 átomos piloto*; el
> registro contiene **13**. Desglose del roster:
>
> - **2 de referencia Opus** (§6.1/§6.2 del blueprint): `aether_serpent`, `tribu_mental`
> - **9 del kit SHADER_ATOM_BASE**: `neon_conduit`, `sacred_bouncer`,
>   `liquid_nebula`, `voxel_monolith`, `morphing_core`, `quantum_swarm`,
>   `ferro_heart`, `event_horizon`, `turing_cannibals`
> - **2 pilotos contrato-v2 añadidos en WAVE 8279 F6** (`atom_*`):
>   `atom_voice_mandala` (D1 "La Voz Interior"), `atom_phase_mercury`
>   (D4 "Mercurio ↔ Cristal")
>
> Los "11 pilotos" del brief corresponden casi con seguridad a los
> 2+9 anteriores a WAVE 8279. Este inventario cubre los **13 registrados**.

---

## 0. Semántica de los canales (para leer la tabla)

| Canal | Qué es de verdad | τ / cadencia |
|---|---|---|
| `u_beatTime` | Beats integrados (reloj del host, no predicción) | monótono |
| `u_beatPhase` / `u_barPhase` | Fase de pulso / de compás ∈[0,1) | por beat / por compás |
| `u_speed` | Gobernador de tiempo efectivo (masterSpeed + halving audio-muerto). Los átomos lo aplican como `osc·u_speed` — doma la desviación, no el reloj | continuo |
| `u_kickPulse` / `u_snarePulse` | Envolvente exp tras flanco de bombo/caja | τ ≈ ¼ beat |
| `u_snareTruePulse` | Caja MACD verdadera, sin falsos positivos vocales | τ = ¼ beat |
| `u_bass` `u_subBass` `u_mid` | Bandas espectrales | suavizadas |
| `u_energy` / `u_energyTime` | Energía global / ∫energía·dt (reloj de energía) | suavizado / monótono |
| `u_hihatEnergy` `u_ultraAir` | Banda hi-hat / aire extremo | suavizadas |
| `u_spectralFlux` `u_flatness` `u_harshness` | Flux, flatness, aspereza | suavizadas |
| `u_chromaHue` `u_chroma(i)` `u_saturation` `u_brightnessSpec` | Tonalidad dominante, chromagrama 12 bins, saturación, centroide | suavizadas |
| `u_melodicity` `u_percussiveness` `u_synthSustain` `u_vocalSustain` `u_vocalTime` `u_vocalIsolation` `u_vocalOnset` | Página B: rasgos de timbre/voz; `u_vocalTime` = ∫voz·dt (se congela sin voz) | suavizadas; onset τ=600 ms |
| `u_morphFactor` | Complejidad desde Omniliquid | continuo |
| `u_lqAmbient` `u_lqFloor` | Setpoints de ambiente/suelo del motor Liquid | continuo |
| `u_syncopation` | Sincopación × groove (PLL_LOCKED) | suavizado |
| `u_rhythmicVoid` `u_voidRelease` | Vacío rítmico [0..1] / rebote ∝ voidHold previo | rampa / τ=450 ms |
| `u_activeEffectEnergy` (`fx`) | **Envolvente del clip DMX físico vivo en Hephaestus** — "disparo real" (Clean Shot WAVE 8287). 0 si no hay clip | envelope del clip |
| `u_activeEffectAge` (`fxAge`) | Edad del clip físico vivo | crece con el clip |
| `u_crestPulse` `u_strobeGate` `u_glassBreak` | Eventos cognitivos/soberanos: cresta CF>2 (τ=110 ms), gate del StrobeEngine GodEar, ruptura GLASS_BREAK (τ=380 ms) | — |
| `u_predictiveETA` `u_approach` `u_impact` | Aproximación cognitiva a impacto | — |
| `euChannels→glitch` | `u_harshness` solo si flag APOCALYPSE | gateado |
| `euChannels→live` | 1.0 si AUDIO_LIVE, si no 0.3 | flag |
| `euChannels→groove` | `u_beatConfidence` solo si PLL_LOCKED | flag |
| `euSnare()` | `max(u_snareTruePulse, u_snarePulse·(1−0.7·u_vocalIsolation))` — helper inyectado | — |
| `euVoidGate(k)` | `mix(1,k,smoothstep(0.6,0.9,u_rhythmicVoid))·(1+0.6·u_voidRelease)` — helper inyectado | — |
| `euTimbre()` | Pesos convexos voz/synth/percusión/grano — inyectado, solo lo invoca voice_mandala | — |
| `u_prevFrame` / `u_state` | Feedback frame anterior / ping-pong de simulación | por frame |

**Sobre "redobles de 22 Hz":** no existe uniform dedicado de redoble. Lo más
cercano: `u_snareTruePulse` (caja MACD, τ=¼beat), el jitter re-sorteado a
`floor(u_time·24)` de `quantum_swarm` (24 Hz) y los re-sorteos a
`floor(beats·8)`/`floor(beats·4)` (semicorchea/corchea) presentes en casi
todos. La bomba de telemetría corre a 44 Hz.

---

## 1. Tabla resumen

| # | Átomo | Primitiva visual | Canales audio¹ | Movimiento | Respuesta a `fx` (Selene) | Clase |
|---|---|---|---|---|---|---|
| 1 | `aether_serpent` | Volumen emisión-absorción (serpiente Lissajous + warp fBm) | 15 | Oscilador (vuelo por túnel + focal) | Radio +1.6, FOV −0.5, hue→complementario, burst local | **Geom+Cam+Color** |
| 2 | `tribu_mental` | Droste log-polar + 24 cargas potenciales | 16 | Oscilador (zoom integrado) + impulso snare | Dispersión enjambre ×1.8, zoom +0.6, feedback implosivo | **Geom+Color** |
| 3 | `neon_conduit` | SDF raymarch túnel n-gono + costillas neón | 11 | **Oscilador puro** (vuelo sin saltos) | FOV +0.35 + estallido en fuga | Cam+Color |
| 4 | `sacred_bouncer` | Kaleido KIFS + orbit trap (2D) | 11 | **Sísmico** (squash&stretch por kick) | Escala +0.15, grosor filamento ×2, halo | Color(+geom leve) |
| 5 | `liquid_nebula` | Doble domain-warp fBm (2D) | 10 | **Inercial total** (sin cámara) | Marea de luz complementaria | **Color solo** |
| 6 | `voxel_monolith` | Raymarch ciudad voxel por celdas | 11 | Cámara inercial; **geometría sísmica** (torres saltan) | Picado de cámara −0.6 + relámpago horizonte | Cam+Color |
| 7 | `morphing_core` | SDF blob esfera↔toro + boil + spikes + melt | 11 | Oscilador + dolly kick (sísmico-lite) | Spikes +0.45, boil +0.22, **melt ∝ fxAge**, acercamiento | **Geom+Cam+Color** ⭐ |
| 8 | `quantum_swarm` | Voronoi luciérnagas + sinapsis (2D, 24 Hz jitter) | 13 | Sísmico de dominio (burst kick) + jitter 24 Hz | Contracción dominio +1.4, sinapsis ×3 | Geom+Color |
| 9 | `ferro_heart` | Heightfield ferrofluido (Rosensweig hex) | 12 | Órbita inercial; geometría transient | **Inversión de campo** (picos→cráteres), torre +0.9 | **Geom/Física** ⭐ |
| 10 | `event_horizon` | Geodésicas Schwarzschild + disco acrección | 9 | Órbita inercial ultra-lenta | **Masa ×(1+0.55fx)** → lente cambia; caída de cámara | **Física+Cam** ⭐ |
| 11 | `turing_cannibals` | Gray-Scott RD en `u_state` + relieve húmedo | 9 | Sin cámara (la sim ES el movimiento) | **F/k mutan (inanición)**, esporas si fx>0.7 | **Simulación** ⭐ |
| 12 | `atom_voice_mandala` | Caos→mandala díedro (2D) guiado por voz | 13 | Oscilador + reloj vocal ∫voz·dt | Flash complementario + desaturación | Color solo |
| 13 | `atom_phase_mercury` | SDF material mercurio↔cristal + facetas | 11 | Órbita + dolly kick (sísmico-lite) | Flash + glow ×0.8 | Color solo |

¹ Nº aproximado de canales de audio/intención distintos consumidos (directos
+ vía helpers), excluyendo `u_time`/`u_resolution`/masters.

---

## 2. Inventario por átomo

### 1. `aether_serpent` — "Æther Serpent" (201 l)
- **Primitiva:** integral de emisión-absorción Beer-Lambert sobre un campo de
  densidad: espina Lissajous (`serpent(z)`), pliegue polar `G_SYM`, doble
  domain-warp fBm, pared de túnel y anillos de choque. Sin superficie.
- **Audio → visual:**
  - `u_beatTime`/`u_time` → `gBeats` → `gCamZ` (avance por el túnel) + roll.
  - `u_beatPhase·u_speed` (`beatP`) → focal +0.4 y gWarp ×(1+0.6) — respiración de lente y warp.
  - `u_barPhase·u_speed` (`swell`) → `gTwist` (paso de hélice del campo).
  - `u_subBass·live` → `gRadius` (+0.5) — el tubo se ensancha con el sub-bajo.
  - `u_bass` → `gWarp` (+0.9) — amplitud del domain warp (**geometría**).
  - `u_morphFactor` → octavas fBm 2→5 (detalle); `u_flatness`/`u_harshness` → exponente de Hurst (rugosidad).
  - `u_energy` → `gDensity` (densidad→alfa) + exposición.
  - `u_kickPulse` → anillo de choque que nace delante de cámara y viaja al fondo (emisión posicional — geometría del campo).
  - `u_hihatEnergy`/`u_ultraAir` → chispas granulares por `vnoise(p·9)`.
  - `u_chroma(pitch)` → anillo armónico: emisión por bin del chromagrama.
  - `u_chromaHue`/`u_saturation`/`u_brightnessSpec` → hue/saturación/temperatura de paleta.
  - `u_lqAmbient`/`u_lqFloor` → grosor de pared y niebla de suelo (setpoints Liquid).
  - `glitch` (APOCALYPSE) → desgarro por bandas del fragCoord. `ACID` → franjeo.
- **Movimiento:** oscilador/inercial — la cámara se integra sobre
  `u_beatTime`+`u_time·0.05`; **ningún salto absoluto por transitorio** en la
  cámara. El kick modifica el campo (anillo), no la posición.
- **Selene (`fx`):** `gRadius +1.6·fx` (geometría), `focal −0.5·fx` (cámara),
  `hueBase +0.5·fx` (salto a complementario), desaturación 45% + estallido
  local `exp(−3|uv|)`. → **Mutación real mixta** (radio+FOV+hue), no un flash.
- **Otros intents:** `u_activeEffectAge`, crest/strobe/glass, ETA/approach/
  impact, página B vocal/void — **ninguno consumido** (ni siquiera inyecta
  euSnare/euVoidGate; es el único sin void-gate).
- **Oportunidad:** único volumétrico puro; candidato natural para
  `u_activeEffectAge` (envejecimiento del anillo) y `u_voidRelease`.

### 2. `tribu_mental` — "Tribu Mental" (157 l)
- **Primitiva:** mandala conforme log-polar (Droste, `log(r)−zoom`) con pliegue
  diédrico `G_FOLD` + enjambre de ≤24 cargas puntuales sobre nudos Lissajous
  (campo potencial → isolíneas) + feedback conforme `u_prevFrame`.
- **Audio → visual:**
  - `beats` → fase de zoom, contrarrotación por anillo (`dir`), órbitas de nudos.
  - `swell` → zoom +0.5, spread −0.4, spin +0.6.
  - `u_syncopation·groove` → swing angular por carga (único uso real de `groove` del kit).
  - `euSnare()` → impulso rotatorio +0.15 rad (transitorio pequeño sobre el ángulo).
  - `u_kickPulse` → `spread ×(1+0.3)` + onda `kr` que recorre las isolíneas hacia fuera.
  - `u_morphFactor`/`u_swarm` → población 8→24 cargas.
  - `u_chroma(i)` → cada carga "canta" su nota (intensidad + hue por quintas).
  - `u_energy` → brillo de carga; `u_mid` → ancho/brillo de isolínea.
  - `u_subBass` → ojo central respirante; `u_bass` → velocidad de rotación del feedback.
  - `u_hihatEnergy`/`u_ultraAir` → polvo estelar re-sorteado a semicorchea.
  - `u_saturation`/`u_chromaHue`/`u_lqFloor` → paleta/fondo.
  - `euVoidGate(0.4)` → atenuación + persistencia extra del feedback.
- **Movimiento:** oscilador — el zoom es una **fase integrada** (Ley de la
  Derivada: "integración, no reloj×señal"), sin saltos; snare = impulso
  rotatorio pequeño, no sísmico.
- **Selene (`fx`):** `zoom +0.6·fx` (acelera el Droste — dominio),
  `spread ×(1+1.8·fx)` (**geometría** — dispersa el enjambre), denominador del
  potencial +0.0015·fx (ablanda el brillo), desat 0.5 + flash central,
  `f ×(0.992−0.03·fx)` → feedback implosivo. → **Geom+Color mixto.**
- **Otros intents:** euSnare (snareTrue+voiceIsolation), euVoid
  (rhythmicVoid+voidRelease), morphFactor, syncopation — **el consumidor de
  canales más ancho del kit**. Sin fxAge/crest/strobe/glass.
- **Nota:** feedback conforme con `max(col, prev·persist)` — estable, sin
  acumulación.

### 3. `neon_conduit` — "Neon Conduit" (168 l)
- **Primitiva:** SDF raymarch del interior de un n-gono (`sdNgon`, TUBE_R=2)
  con costillas emisivas periódicas; torsión relativa a cámara (fix W8290).
- **Audio → visual:**
  - `beats·G_VEL` → `camZ` (vuelo); `beatP` → `gTwist` +0.04 (torsión — geometría); `swell` → fov −0.2.
  - `u_kickPulse` → frente `gKickZ` viajero; emisión de costilla ×(1+1.8·wave); costura de pared ×2.5.
  - `u_bass` → emisión costillas +0.6.
  - `euSnare()` → barrido horizontal blanco.
  - `u_hihatEnergy` → luces de pista ×3; `u_chromaHue` → tinte (peso 0.25).
  - `u_lqFloor`, `u_energy` → suelo/exposición. `glitch` → torsión rota + cizalla por bloques (geometría) + aberración cromática.
  - `euVoidGate(0.35)`.
- **Movimiento:** **el oscilador más puro del kit** — cámara = integración
  del reloj musical, fov por swell; cero saltos por transitorio.
- **Selene (`fx`):** `fov +0.35` (teleobjetivo), estallido complementario en
  el punto de fuga `exp(−4|uv|)` ×1.2, desat 0.5. → **Cam+Color; el SDF no muta.**

### 4. `sacred_bouncer` — "Sacred Bouncer" (140 l)
- **Primitiva:** caleidoscopio 2D + KIFS iterado (plegado `abs(q)−off` +
  escala) + orbit trap (gemas en nodos). Sin raymarch.
- **Audio → visual:**
  - `u_kickPulse`/`u_bass·live` → `punch` → `uv /= 1+0.55·punch` + squash&stretch
    asimétrico (y +16%, x −9%) — **salto de dominio por transitorio**.
  - `beats` → rotación del caleidoscopio (TAU/32) + deriva orgánica por ruido.
  - `euSnare()` → +0.25 rad de giro instantáneo (impulso angular).
  - `u_kickPulse`/`u_bass` → `sc` (escala KIFS +0.35·kick·gain +0.25·bass) y
    `ang` (+0.4·kick) — **mutan el pliegue fractal (geometría)**.
  - `u_kickPulse` → gemas ×(0.8+2.4·kick), rayos en costuras de espejo.
  - `u_subBass` → ojo; `u_hihatEnergy`/`u_ultraAir` → destellos en puntas.
  - `u_bounce`,`u_bloom` → gain del punch y brillo de gemas. `euVoidGate(0.4)`, `ACID`.
- **Movimiento:** **sísmico — el caso más claro de "salto absoluto"**: el
  dominio UV se reescala/re-deforma directamente con kick+bass (atenuable vía
  `u_bounce`), más impulso angular por caja. Rotación base = oscilador.
- **Selene (`fx`):** escala uv +0.15, `width ×(1+2·fx)` (engorda filamentos —
  geom leve), halo complementario `exp(−2.5r)`, desat 0.5. → **Color + geom leve.**

### 5. `liquid_nebula` — "Liquid Nebula" (137 l)
- **Primitiva:** nebulosa 2D de triple domain-warp fBm (IQ) + estela por
  `u_prevFrame` con deriva de ruido. Sin cámara.
- **Audio → visual:**
  - `u_time·G_FLOW·(1−0.5·u_viscosity)` + `0.02·u_beatTime` → reloj del fluido; `+0.6·swell` como **suma de fase** (Ley de Integración — sin saltos).
  - `live` → amplitud del warp (`0.55+0.45·live`); `beatP`/`u_bass` → `turb` (warp).
  - `u_subBass` → núcleo respirante difuso.
  - `u_kickPulse` → relámpago interno solo en nubes densas (`smoothstep(f)`) — emisión, no geometría.
  - `u_hihatEnergy`/`u_ultraAir` → polvo gaussiano suave.
  - `u_chromaHue` → hue; `u_energy` → brillo/exposición; `u_trails` → persistencia.
  - `euVoidGate(0.5)` — el gate más suave del kit.
- **Movimiento:** **inercial total** — fase integrada + respiración de
  oscilador; los transitorios solo afectan emisión.
- **Selene (`fx`):** marea de luz complementaria `fx·0.7·exp(−1.8|uv|)·f`
  (modulada por densidad f — emisión ponderada), blanqueado 0.4.
  → **Color/emisión únicamente.**

### 6. `voxel_monolith` — "Voxel Monolith" (218 l)
- **Primitiva:** raymarch por celdas de una ciudad voxel — `cellHeight(id)`
  decide la extrusión de cada torre (`sdBox` por celda); el paso nunca cruza
  el borde de celda.
- **Audio → visual:**
  - `u_kickPulse` → `h += jumpMask·kick·2·extrude` (**geometría**: torres que
    saltan al bombo) + `kickWave` (anillo rodante — geometría y luz) + emisión ×3.5·jump.
  - `u_bass` → `h += bass·0.7·hash(id)` (respiración de alturas).
  - `gBeatIdx = floor(u_beatTime)` → re-sorteo de qué torres saltan por beat.
  - `u_hihatEnergy` → probabilidad de ventanas encendidas.
  - `euSnare()` → grietas iluminadas ×3.5; `u_spectralFlux` → brillo basal de grietas (único consumidor de flux).
  - `swell` → camY −0.4, fov −0.15, pitch −0.06 (cámara domada por speed).
  - `u_chromaHue`,`u_neon`,`u_extrude`,`u_energy`.
  - `glitch` → scanline + **teletransporte de alturas** (`h = mix(h, hash·G_HEIGHT·1.5, g)` — salto discreto de geometría bajo APOCALYPSE) + swap gbr.
  - `euVoidGate(0.35)`.
- **Movimiento:** cámara **inercial** (avance + sway `sin(beats·π/32)` +
  swell + bob `sin(u_time·0.21)`); la componente sísmica vive en la
  **geometría** (torres), no en la cámara.
- **Selene (`fx`):** `ro.y −0.6·fx` (**picado sobre la ciudad** — desplazamiento
  de cámara), pitch −0.06, fov +0.35, relámpago de horizonte ×1.4, desat 0.5.
  → **Cámara + color; el SDF no muta por fx** (la extrusión la gobierna el kick).

### 7. `morphing_core` — "Morphing Core" (204 l) ⭐
- **Primitiva:** raymarch SDF acotado — núcleo `mix(esfera, toro, gMorph)` +
  ebullición `boil` (ruido), pinchos `ridge` (ruido ridged) y goteo `melt`;
  metal iridiscente sobre envmap procedural.
- **Audio → visual:**
  - `beats` → `gRotY` (rotación), `gPhase` (reloj de ebullición), `gMorph` oscilante esfera↔toro.
  - `u_kickPulse` → `gAmp +0.38` (**amplitud SDF — geometría**), `camD +0.4`
    (**dolly directo — sísmico-lite**), magma ×0.9, corona ×1.6.
  - `u_bass` → gAmp +0.10.
  - `euSnare()` → `gSpike +0.22` (**amplitud de pinchos — SDF**), puntas +0.8.
  - `beatP` → gSpike +0.12.
  - `u_hihatEnergy`/`u_ultraAir` → chispas fresnel; `u_chromaHue` → film/envmap.
  - `u_lqAmbient` → halo de fondo; `u_energy` → exposición; `u_melt`,`u_spikes`.
  - `euVoidGate(0.4)`; `glitch` → scanline + brg.
- **Movimiento:** oscilador + **dolly por kick** (`camD = 4.6 −0.6fx +0.4·kick`)
  — el transitorio tira la cámara (0.4 u máx).
- **Selene (`fx`) — el consumidor de intent más profundo:**
  - `gAmp +0.22·fx` (boil), `gSpike +0.45·fx` (pinchos) — **mutación SDF**.
  - **`gMelt = 0.7·fx·fxAge`** — único átomo que lee `u_activeEffectAge`:
    el derretido **crece con la edad del clip** (mutación acumulativa real).
  - `camD −0.6·fx` (cámara), magma ×1.4, puntas ×2.5, desat 0.45.
  → **Mutación geométrica real + cámara + color.**

### 8. `quantum_swarm` — "Quantum Swarm" (210 l)
- **Primitiva:** campo celular de luciérnagas voronoi + enlaces sinápticos con
  paquetes de datos, capas en parallax, estelas por `u_prevFrame`.
- **Audio → visual:**
  - `suv = uv·contract/burst`: `contract = 1+0.8·gBeatP+1.4·fx`,
    `burst = 1+1.5·u_kickPulse+0.35·u_bass·live` — **escala de dominio que
    salta con el bombo** (sísmico de dominio, no de cámara).
  - `rot2(beats·TAU/64 + 0.8·gBeatP·r + 0.3·swell)` → enroscado radial.
  - `u_time·24` → **jitter cuantizado a 24 Hz** amplificado por `u_hihatEnergy` (temblor nervioso).
  - `u_kickPulse` → brillo luciérnaga ×(1+2.5), `gLinkGain` +2.0, deriva de estela.
  - `euSnare()` → relleno de celda (re-sorteo por golpe) + linkGain +0.8.
  - `u_chroma(floor(h0·12))` → cada luciérnaga canta su clase de altura.
  - `u_bass` → burst +0.35·live; `u_subBass` → núcleo gravitatorio.
  - `gBeatP` → contracción de `lmax` (longitud de sinapsis).
  - `u_chromaHue`,`u_energy`,`u_links`,`u_trails`; `euVoidGate(0.4)`;
    `glitch` → teletransporte + split RGB cuántico.
- **Movimiento:** **mixto** — osciladores (órbitas, twist) + salto de dominio
  por kick + jitter discreto 24 Hz.
- **Selene (`fx`):** `contract +1.4` (**compresión de dominio — geometría**),
  linkGain ×3 (emisión), estela implosiva +0.01, flash central, desat 0.45.
  → **Geom+Color mixto.**

### 9. `ferro_heart` — "Ferro Heart" (185 l) ⭐
- **Primitiva:** raymarch de campo de alturas — inestabilidad de Rosensweig:
  red hexagonal de picos (3 ondas a 120°), espejo negro con envmap.
- **Audio → visual:**
  - `u_subBass`/`u_bass` → `gH` altura de picos — **el bajo ES el campo magnético** (geometría).
  - `u_kickPulse` → `gH +0.45` (picos que saltan — geometría transient), puntas incandescentes ×3.
  - `euSnare()` → `gTilt` — **latigazo lateral del campo** (cizalla geométrica, dirección re-sorteada por golpe).
  - `beatP` → `gK` +0.8 (densidad de red respira); `swell` → `gEnvK` +0.3 (el imán se agolpa) + `camR −0.8`.
  - `u_hihatEnergy` → **micro-rizado de la superficie** (ruido en `heightAt` — geometría).
  - `u_energy` → softbox superior; `u_chromaHue`,`u_field`,`u_gloss`.
  - `glitch` → **terrazas digitales** (`floor(h·10)/10` — cuantiza la altura, geometría) + gbr.
  - `euVoidGate(0.4)`.
- **Movimiento:** cámara inercial (órbita `az = beats·G_ORBIT·TAU/96`, radio
  por swell, bob `sin(u_time·0.13)`); la sísmica está en la geometría
  (kick→altura, snare→tilt), no en la cámara.
- **Selene (`fx`) — inversión física literal:**
  - `gTower = 0.9·fx` → torre central (geometría).
  - **`gFlip = 1−2·smoothstep(0.35,0.9,fx)`** → **el campo se INVIERTE: picos →
    cráteres**; los cráteres exhalan luz blanca desde el pozo.
  - Cámara `ro.y −0.5`, target `+0.3` (mirar dentro del cráter), desat 0.5.
  → **La respuesta de intent más "física" del kit — inversión de campo + cámara.**

### 10. `event_horizon` — "Event Horizon" (203 l) ⭐
- **Primitiva:** agujero negro relativista — integración de **geodésicas de
  fotón** (aprox. Schwarzschild: esfera de fotones r=1.5M, anillo de Einstein,
  imagen secundaria del disco) + disco de acreción por flow-map + chorros
  polares + starfield con lente.
- **Audio → visual:**
  - `u_kickPulse` → temperatura del disco ×(1+0.55) (**vira a azul** — color/emit), chorros ×2.8.
  - `u_bass` → chorros +0.8·live.
  - `euSnare()` → **fulguración de reconexión magnética** en un punto del disco ×5 (posición re-sorteada por `floor(beatTime·2)`).
  - `u_hihatEnergy` → parpadeo estelar ×1.5.
  - `swell` → distancia orbital `D −1.5`.
  - `u_chromaHue` → tinte; `u_mass`,`u_disk` params; `u_energy` exposición.
  - `glitch` → desgarro del espacio-tiempo + gbr. `euVoidGate(0.4)`.
- **Movimiento:** órbita ultra-lenta `az = beats·TAU/128` + inclinación
  `sin(u_time·0.05)` + respiración por compás — **inercial total**.
- **Selene (`fx`) — mutación del simulador:**
  - **`M = clamp((1+0.25·u_mass)·(1+0.55·fx), 0.6, 1.75)`** — la **masa del
    agujero crece con el clip → la curvatura geodésica cambia** (el propio
    integrador/raymarch muta: esfera de fotones, anillo de Einstein, disco doblado).
  - `D −4.5·fx` (**la cámara cae hacia el horizonte**), focal `+0.4·fx`.
  - desat 0.4.
  → **Mutación de parámetro físico + buceo de cámara. Nada de flash estático.**

### 11. `turing_cannibals` — "Turing Cannibals" (202 l) ⭐
- **Primitiva:** **simulación Gray-Scott** sobre ping-pong `u_state`
  (RGBA16F) + render de tejido con relieve húmedo. Sin cámara.
- **Audio → visual (¡en el propio `mainState`!):**
  - `u_energy`/`u_hunger` → **alimentación F** (crecen/dividen/devoran).
  - `u_bass` → **muerte k −0.0015** (células se estiran en gusanos).
  - `euSnare()` → `+0.03·k` a lo largo de `snareStripe(cuv)` — **la guadaña:
    mata una franja con ángulo nuevo por golpe**.
  - `u_kickPulse >0.75` → **nuevas colonias caen en la placa** (evento de sim).
  - Render: `u_kickPulse` → relieve ×1.6 + membrana ×2.0; `u_hihatEnergy` →
    cilios; `u_energy` → frentes de alimentación ×1.8; `u_chromaHue`,
    `u_lqAmbient`; `u_relief`,`u_hunger`; `euVoidGate(0.45)`.
- **Movimiento:** sin cámara — el estado de la sim ES el movimiento. La luz
  orbita a `beats·π/8`. Los transitorios **mutan el autómata** (siembra,
  guadaña, parámetros) — el acoplamiento audio↔estado más profundo del kit.
- **Selene (`fx`) — mutación de la química:**
  - **`F −0.004·fx`, `k +0.0035·fx`** — **régimen de inanición** mientras el
    clip vive (las colonias pasan hambre — cambio real de parámetros PDE).
  - `fx >0.7` → **esporas por todas partes** (evento de siembra en la sim).
  - Bioluminiscencia ×2.2 sobre núcleos `v∈[0.22,0.42]`, desat.
  → **Mutación del estado de simulación — la forma más profunda de intent.**

### 12. `atom_voice_mandala` — "Voice Mandala" (176 l)
- **Primitiva:** mandala díedro caos→orden — campo fBm con domain warp que se
  **ordena** con la voz: warp se relaja, pliegues se duplican (6→12) y nace
  una garganta de anillos estacionarios.
- **Audio → visual:**
  - `euTimbre().x·(0.55+0.45·u_vocalSustain)` → `voice`→`bloom`→`order`:
    **el orden es el piloto** — relaja el warp `(1−order)·G_WARP`, duplica el
    pliegue (`foldEase` cúbico 6→12), enciende garganta y mandala.
  - `u_vocalTime·G_BREATH` → `vt` — **reloj vocal ∫voz·dt**: respiración de
    anillos y garganta; **se congela sin voz (no salta)**.
  - `u_melodicity` → densidad de anillos `k` ×3 (más melodía → más armónicos).
  - `u_vocalOnset` → bloom de garganta + halo (entrada de frase).
  - `u_kickPulse`/`u_snareTruePulse` → golpes sobre la capa caos, atenuados por
    `hitMask = 1−0.7·order` — **el orden blinda al mandala**.
  - `u_hihatEnergy`/`u_ultraAir` → chispas; `u_chromaHue`; `u_energy`.
  - `u_rhythmicVoid`/`u_voidRelease` → gate inline.
  - `u_prevFrame` persist `0.55+0.35·order` — **la voz alarga el eco**.
  - `u_throat`,`u_order` params.
- **Movimiento:** sin cámara — respiración de dominio por `swell` + spin por
  beats + **fase vocal integrada**. Inercial/oscilador.
- **Selene (`fx`):** flash complementario `0.4·exp(−2.5r)` + desat 0.4.
  → **Color/brillo únicamente** — irónico: el piloto vocal más rico trata el
  disparo de forma cosmética.
- **Nota:** consumidor de página B más profundo (vocalIsolation, vocalSustain,
  vocalOnset, vocalTime, melodicity, snareTrue).

### 13. `atom_phase_mercury` — "Phase Mercury" (221 l)
- **Primitiva:** raymarch SDF de **transición de fase** — núcleo cubo↔esfera +
  satélites esquirla↔gota fundidos por `smin(k)`; normales cuantizadas a
  facetas en estado cristal.
- **Audio → visual:**
  - `u_synthSustain·(1−0.8·u_percussiveness)` → `visc` — **EL parámetro de
    fase** (pads→mercurio, percusión seca→cristal): gobierna wobble del
    dominio, mezcla de SDF, `k` de smin, cuantización de normales a facetas,
    exponente de especular, material (metal↔vidrio+dispersión) y
    persistencia de estela (0.78↔0.94).
  - `u_energyTime` (`gET` = ∫energía·dt) → reloj del wobble del mercurio.
  - `u_kickPulse` → `gAmp` +0.10 (**rizado de piel — geometría, solo mercurio**),
    `camR +0.3` (**dolly directo**), fresnel de piel ×0.6.
  - `u_bass` → gAmp +0.05.
  - `u_snareTruePulse` → **fractura del cristal por los filos de faceta** ×2.4
    (emisión sobre máscara geométrica de arista).
  - `u_hihatEnergy`/`u_ultraAir` → chispas en aristas.
  - `u_chromaHue` → envmap/dispersión; `u_energy` → softbox/spec/exposición.
  - `swell` → `camR −0.5`; `beats` → órbita satelital + rotación.
  - Gate de vacío inline; `glitch` → gbr + scanline.
- **Movimiento:** órbita + **`camR +0.3·u_kickPulse`** (dolly sísmico-lite) +
  swell. Oscilador dominante.
- **Selene (`fx`):** flash central 0.45·exp(−2.5r) + glow ×0.8 + desat 0.45.
  → **Color/brillo únicamente** — el mutador de material más sofisticado
  responde al intent solo de forma cosmética.

---

## 3. Resumen cruzado

### Audio-reactividad (amplitud de canales consumidos)
1. **`tribu_mental`** (16 canales — syncopation, groove, mid, morphFactor,
   saturation, chroma, floor… el oído más completo)
2. **`aether_serpent`** (15 — único con flatness, harshness, brightnessSpec,
   lqAmbient+lqFloor)
3. **`atom_voice_mandala`** (13 — monopolio de la página B vocal)
4. **`quantum_swarm`** (13)
5. `ferro_heart` (12) · `neon_conduit`/`sacred_bouncer`/`morphing_core`/
   `voxel_monolith`/`atom_phase_mercury` (11) · `liquid_nebula` (10) ·
   `event_horizon`/`turing_cannibals` (9)

### Canales usados por UN solo átomo (nichos de diseño)
| Canal | Único consumidor |
|---|---|
| `u_flatness`, `u_harshness`(→Hurst), `u_brightnessSpec`, `u_lqAmbient`+`u_lqFloor` juntos | aether_serpent |
| `u_syncopation`, `u_mid`, `groove` real | tribu_mental |
| `u_spectralFlux` | voxel_monolith |
| `u_activeEffectAge` | morphing_core |
| `u_energyTime` | atom_phase_mercury |
| `u_melodicity`, `u_vocalSustain`, `u_vocalTime`, `u_vocalOnset`, `euTimbre()` | atom_voice_mandala |
| `u_synthSustain`, `u_percussiveness` (semántico, no vía timbre) | atom_phase_mercury |
| `u_morphFactor` | aether_serpent, tribu_mental |

### Movimiento de cámara/dominio
- **Sísmico/transient dominante:** `sacred_bouncer` (squash&stretch UV por
  kick+bass — el "salto absoluto" del brief), `quantum_swarm` (burst de
  dominio por kick + jitter 24 Hz), `morphing_core` y `atom_phase_mercury`
  (dolly directo por kick, ±0.3–0.4 u — sísmico-lite), `voxel_monolith`
  (cámara inercial pero **geometría sísmica**: torres saltan por bombo).
- **Impulso angular transient (leve):** `tribu_mental`, `sacred_bouncer`,
  `ferro_heart` (tilt de campo por snare).
- **Oscilador/inercial puro (`u_speed`-domado, integración de fase):**
  `aether_serpent`, `neon_conduit` (el más limpio), `liquid_nebula`,
  `event_horizon`, `tribu_mental`, `ferro_heart` (cámara),
  `atom_voice_mandala`.
- **Sin cámara:** `tribu_mental`, `liquid_nebula`, `sacred_bouncer`,
  `quantum_swarm`, `turing_cannibals`, `atom_voice_mandala` (2D; el
  "movimiento" es la transformación de dominio o la propia simulación).

### Respuesta a intents de Selene
| Clase | Átomos | Qué hace fx |
|---|---|---|
| **Mutación de física/simulación** | `ferro_heart` (inversión de campo picos↔cráteres + torre), `event_horizon` (masa Schwarzschild → lente), `turing_cannibals` (F/k PDE + esporas fx>0.7) | Cambia las reglas del sistema, no el aspecto |
| **Mutación geométrica SDF/dominio** | `morphing_core` (spikes+boil+melt∝fxAge), `tribu_mental` (spread enjambre + zoom + feedback implosivo), `aether_serpent` (radio+FOV+hue), `quantum_swarm` (contracción dominio + sinapsis) | Geometría/distancia/dominio cambian |
| **Cámara + color** | `neon_conduit` (fov+burst fuga), `voxel_monolith` (picado+relámpago), `morphing_core` (también cámara), `event_horizon` (caída+FOV) | Desplazamiento/óptica de cámara |
| **Solo color/brillo** | `liquid_nebula`, `atom_voice_mandala`, `atom_phase_mercury`, `sacred_bouncer` (≈, +grosor de línea) | Flash complementario + desaturación |

### Vocabulario de intent declarado pero NO consumido (o casi)
- **`u_activeEffectAge`:** 1/13 (morphing_core). 12 átomos ignoran la edad
  del clip → oportunidad inmediata para "efectos que maduran".
- **`u_crestPulse`, `u_strobeGate`, `u_glassBreak`:** **0/13** — inyectados
  en todos los programas por GenRuntime, leídos por ninguno.
- **`u_predictiveETA`, `u_approach`, `u_impact`:** **0/13** — la
  aproximación cognitiva quedó extirpada en WAVE 8287 y nadie la retomó.
- **`u_vocalOnset`:** 1/13 (voice_mandala). **`u_snareTruePulse` directo:**
  2/13 (voice_mandala, phase_mercury); 9 más lo consumen dentro de `euSnare()`.
- **`u_rhythmicVoid`/`u_voidRelease`:** 12/13 vía `euVoidGate` o inline;
  solo `aether_serpent` carece de gate.
- **`u_melodicity`, `u_vocalSustain`, `u_vocalTime`, `u_synthSustain`,
  `u_percussiveness`, `u_energyTime`, `u_spectralFlux`, `u_flatness`,
  `u_brightnessSpec`, `u_mid`, `u_syncopation`:** ≤2 átomos cada uno —
  la mayor parte del vocabulario de timbre/rasgos está **sub-explotada**.
- **`euTimbre()`:** inyectado en todos, invocado solo por voice_mandala
  (los demás reciben `u_vocalIsolation` gratis dentro de `euSnare`).

### Patrón común observado (convención, no excepción)
1. `float fx = u_activeEffectEnergy` en `mainImage` → patrones compartidos:
   desaturación `mix(col, lum, ~0.4–0.5·fx)` + estallido complementario
   `palette(u_chromaHue+0.5)·exp(−k·r)` — **la "firma Clean Shot"** está en
   los 13.
2. `beatP`/`swell` = oscilador reescalado por `u_speed` (WAVE 8290) en 12/13
   (solo `turing_cannibals` no usa ninguno — su movimiento es el autómata).
3. Re-sorteo determinista por `floor(u_beatTime·k)` para posiciones de
   evento (flare, guadaña, torres, tilt) — el "azar con reloj".
4. Feedback `u_prevFrame` con `max-blend` en 5/13 (tribu, liquid, quantum,
   voice, mercury); simulación real solo en turing_cannibals.

### Oportunidades de diseño (recomendaciones — NO observación)
- `crestPulse`/`strobeGate`/`glassBreak` están cableados y muertos: tres
  canales soberanos esperando átomo.
- `u_activeEffectAge` ya demuestra "maduración" en morphing_core; copiar el
  patrón a serpent (anillo que envejece) u horizon (espaguetización por edad).
- `liquid_nebula`, `voice_mandala`, `phase_mercury` tratan `fx` como flash:
  son los candidatos baratos para subir a mutación real.
- Los "seísmicos" actuales (`sacred_bouncer`, `quantum_swarm`) son de
  dominio 2D; **ningún átomo hace cámara sísmica fuerte en 3D** — hueco
  claro para el Director Creativo.
- Página B (voz/timbre) solo la explotan los 2 pilotos v2: portar
  `u_percussiveness`/`u_melodicity` a átomos estructurales (voxel, swarm)
  ampliaría el espectro reactivo sin tocar la física.

---

*Generado por WAVE 8296-RECON. Cero líneas de código modificadas. Toda
clasificación deriva de lectura directa del GLSL (expresiones en uso), no de
declaraciones ni comentarios.*
