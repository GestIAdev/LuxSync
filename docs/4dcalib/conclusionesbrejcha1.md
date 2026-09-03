
### 📂 DOCUMENTO DE AFINACIÓN - V1 (Pre-Fix)

**Objetivo:** Calibración Maestra OmniLiquidEngine (Fase Brejcha / Minimal)

#### 🔍 1. El Fenómeno del "Bombo Fantasma" (The AGC-Breakdown Leak)

* **Síntoma:** En secciones de *breakdown* (solo bombo + piano), el Back R dispara falsos redobles/impactos de caja simultáneos al bombo.
* **Causa Raíz:** Una combinación letal de compresión de audio y bypasses permisivos.
* **El Multiplicador AGC:** Durante los parones, el sistema sube la ganancia a **~4.0x** para compensar la falta de volumen global.


* **El Suelo del Piano:** Los armónicos del piano mantienen la energía de la banda de caja (`SnareE`) flotando entre **0.40 y 0.66**, dejando el *Energy Bypass* siempre pre-armado.


* **El "Snap" del Bombo:** El ataque de agudos característico del bombo minimalista, multiplicado por 4 por el AGC, genera un `RawΔ` y un `Flux` masivos (hasta **0.65**).


* **Veredicto:** El sistema lee alta energía (piano) + alto flujo (ataque del bombo inflado) = dispara el *Energy Bypass* a pesar de que el indicador de ruido blanco (`WNS`) marca un perfecto **0.000**.



#### 🛡️ 2. Por qué fallaron las defensas actuales

* **El Cerrojo Morfológico (TCT):** Diseñado para bloquear sonidos *sostenidos* (como sintetizadores largos). Como los bombos en un *break* están separados por unos 6 fotogramas, el TCT tiene tiempo de sobra para rearmarse. No bloquea impactos espaciados.
* **Tonality Veto:** Diseñado para bloquear sonidos puramente tonales. Sin embargo, el ataque de un bombo es un evento transitorio que genera muchísimo `Flux` instantáneo. Ese flujo alto le otorga un "pase libre" al veto justo en el fotograma del impacto.



#### 🎯 3. Posibles Vectores de Solución (A evaluar tras recolectar más géneros)

1. **Exigir WNS en el Path de Energía:** No disparar el bypass inmediatamente. Si el `WNS` sigue en cero durante el fotograma actual y el siguiente, descartarlo como "transitorio de bombo/piano".
2. **Umbrales "AGC-Aware" (Dinámicos por ganancia):** Si el AGC está multiplicando por 4, el límite de disparo (`finalSnareThreshold`) no puede seguir siendo `0.12`. Debería escalar proporcionalmente al nivel de compresión.
3. **Suelo de Energía Adaptativo:** Si el piano mantiene el ambiente en `0.50`, el bypass no debería disparar en `0.40`. Debería exigir un salto relativo (ej. `Suelo + 0.20`).

---

### 📂 DOCUMENTO DE AFINACIÓN - V2 (Anyma "El Gran Jefe")

**Objetivo:** Análisis del log `anymacaos.md` — techno melódico pesado, el caso más difícil para Back R.

#### 🌊 4. El ADN de Anyma — Por qué es "El Gran Jefe"

Anyma es **100% sintético**. No hay caja acústica, no hay bombo con snap natural. Todo es:
- Sub-bajos sintetizados que actúan como bajos (confunden al Front R)
- Synths medios/pesados que sangran en la banda de caja (SnareE inflado)
- Snares sintéticos = ráfagas de ruido blanco (WNS alto) o claps electrónicos
- Sweep/risers que inundan todo de ruido (ambos canales disparan)

El log recorre ~1158 fotogramas con varias secciones MSST:
`verse → chorus → breakdown → textural_drop → chorus → verse → buildup → drop → chorus → breakdown`

#### 🧱 5. El "Muro Rodante" de Synth Bleed

**Patrón dominante:** `SnareE` se mantiene entre **0.30 y 0.80** durante decenas de fotogramas sin ningún onset real. Ejemplos:
- Líneas 1-7: `SnareE` 0.316→0.205, todo `[KICK]`, `OutSnare:0.000` (veto bloquea)
- Líneas 27-46: `SnareE` 0.744→0.650, onsets aislados pero `WNS` baja
- Líneas 528-535: `SnareE` 0.500→0.305, `Veto:0.000`, `OutSnare:0.000` — **sintet puro, sin caja**

**Mecanismo:** Los synths medios de Anyma tienen contenido armónico en la banda 2-5kHz (crack band). El `SnareE` los lee como "energía de caja" pero el `Veto` los rechaza correctamente porque:
- `WNS = 0.000` (no hay ruido broadband)
- `Flux` bajo (0.001-0.020, señal sostenida)
- `flatness` moderada pero no explosiva

**Veredicto:** El veto tonal **está funcionando** aquí. El muro rodante NO produce falsos onsets. Back R se queda en silencio (correcto). La zona LEFT rellena el hueco.

#### 🎆 6. Las Inundaciones de Ruido (Sweeps/Risers)

**Sección crítica (líneas ~137-475):** Aquí vemos la "inundación de luz" que el usuario describe. Hay **decenas de onsets** en sucesión rápida:
- Líneas 137, 151, 165, 180, 198, 211, 215, 222, 229, 234, 238, 244, 250, 254, 261, 266, 274, 281, 287, 292, 297, 301, 308, 312, 317, 324, 337, 342, 348, 353, 357, 364, 368, 375, 381, 387, 391, 396, 402, 408, 414, 419, 424, 430, 435, 439, 444, 451, 455, 460, 464, 470, 476, 481...

**Características de estos onsets:**
- `WNS` frecuentemente alto (0.4-1.0) — ruido broadband real
- `Flux` alto (0.15-0.45) — cambio espectral explosivo
- `Veto` alto (0.7-1.0) — pasa el filtro tonal
- `SnareE` muy bajo (0.000-0.030) — **la energía NO está en la crack band**

**Interpretación:** Estos son **snares sintéticos reales** (claps/noise bursts de Anyma) intercalados con sweeps. El sistema los detecta por Path 1 (WNS-confirmed) o Path 2 (Flux bypass). La energía de la crack band es baja porque el ruido está distribuido en todo el espectro, no concentrado en 2-5kHz.

**¿Son falsos positivos?** Muscialmente, muchos sí lo son — son sweeps/risers que el productor usa para construir tensión, no snares rítmicos. Pero **acústicamente son ráfagas de ruido broadband** indistinguibles de un snare sintético. El sistema hace lo correcto desde el punto de vista físico.

**El problema musical:** Back R dispara en cada uno → la zona percusiva pura se satura. Pero como dice el usuario, la zona LEFT rellena con luz y el show se ve bien.

#### 🔊 7. El Sub-bajo que Confunde al Front R

**Sección del "drop" (líneas 488-560):** Aquí el bajo desaparece y vuelve con fuerza.
- `BassE` 0.55→0.93 (sub-bajo masivo)
- `BassΔ` 0.10-0.27 (transitorios de sub-bajo, no kicks)
- `OutKick:0.800` en TODOS los fotogramas
- `SnareE` 0.000-0.500 pero `Veto:0.000-0.078` → `OutSnare:0.000` (correcto)

**Mecanismo:** El sub-bajo sintetizado de Anyma tiene transitorios (`BassΔ` 0.10-0.27) que el detector de kick lee como impactos. `OutKick` satura a 0.800 en cada nota de sub-bajo, no solo en kicks reales.

**Veredicto:** Front R se inunda durante el drop. Esto es esperado en techno melódico — el bajo ES el instrumento rítmico. No es un bug, es la naturaleza del género. La zona LEFT compensa.

#### 🎯 8. Lo que SÍ funciona bien en Anyma

1. **WNS como discriminador estrella:** Cuando `WNS > 0.5`, casi siempre es un snare/ruido real. Path 1 acierta.
2. **Veto bloqueando synth bleed:** `Veto:0.000` en muros de synth → `OutSnare:0.000`. Correcto.
3. **fBL dinámico:** El `fBL` sube de 0.058 (normal) a 0.082 (buildup denso), y el `Gate` baja de 0.104 a 0.060. El threshold adaptativo funciona.
4. **TCT re-arm:** Los onsets de sweep están espaciados (3-5 frames), el TCT se rearma y permite disparar. No hay falsos sostenidos.
5. **Sustain choke:** Después de cada onset, `OutSnare` decae en 2-3 frames (0.720→0.518→0.373). No se sostiene.

#### ⚠️ 9. Lo que NO funciona (casos puntuales)

1. **Onsets con WNS=0 y SnareE alto (Path 3 Energy bypass):**
   - Línea 632: `SnareE:0.602 RawΔ:0.323 Flux:0.180 WNS:0.000 Veto:0.391 [ONSET]`
   - Línea 668: `SnareE:0.482 RawΔ:0.323 Flux:0.163 WNS:0.000 Veto:0.306 [ONSET]`
   - Línea 704: `SnareE:0.508 RawΔ:0.302 Flux:0.178 WNS:0.000 Veto:0.352 [ONSET]`
   - Línea 720: `SnareE:0.589 RawΔ:0.231 Flux:0.163 WNS:0.000 Veto:0.377 [ONSET]`
   - Línea 727: `SnareE:0.464 RawΔ:0.141 Flux:0.229 WNS:0.000 Veto:0.418 [ONSET]`
   - Línea 731: `SnareE:0.615 RawΔ:0.251 Flux:0.185 WNS:0.000 Veto:0.418 [ONSET]`
   - Línea 846: `SnareE:0.511 RawΔ:0.163 Flux:0.200 WNS:0.000 Veto:0.393 [ONSET]`
   - Línea 855: `SnareE:0.544 RawΔ:0.229 Flux:0.199 WNS:0.000 Veto:0.418 [ONSET]`
   - Línea 1028: `SnareE:0.780 RawΔ:0.326 Flux:0.152 WNS:0.022 Veto:0.479 [ONSET] [KICK]`
   
   **Patrón:** `SnareE` 0.46-0.78 + `RawΔ` 0.14-0.33 + `Flux` 0.15-0.23 + `WNS` ≈ 0. El **Energy Bypass (Path 3)** dispara porque `SnareE > 0.40` y `_snareReArmed`. `Veto` 0.30-0.48 (Flux le da el pase).
   
   **¿Son reales?** En Anyma, estos podrían ser **claps sintéticos sin contenido HF** (el ruido está en mid, no en HF) o **stabs de synth con transitorio agudo**. Es ambiguo. El `WNS=0` sugiere que NO son snares de ruido, pero el `Flux` alto sugiere que sí hay transitorio. **Este es el mismo patrón del "Bombo Fantasma" de Brejcha** — el Energy bypass disparando sin confirmación WNS.

2. **Cola de envSnare sangrando al siguiente kick:**
   - Línea 557: `OutSnare:0.320` en frame `[KICK]` (cola del onset de línea 555)
   - Línea 662-664: `OutSnare:0.320→0.102→0.005` decay sobre kicks
   - Línea 848-850: `OutSnare:0.438→0.192→0.084` decay sobre kicks
   
   **Patrón:** Después de un onset real, la envSnare decae en 3-4 frames. Si un kick cae en esos frames, `OutSnare` aún tiene valor 0.1-0.5 → Back R y Front R se solapan por 1-2 frames. No es falso positivo, es cola natural.

#### 📊 10. Comparativa Brejcha vs Anyma

| Métrica | Brejcha (break) | Anyma (caos) |
|--------|-----------------|--------------|
| Género | Minimal techno | Melodic techno |
| SnareE en kicks | 0.40-0.66 (piano) | 0.30-0.80 (synth bleed) |
| WNS | 0.000 (siempre) | 0.000-1.000 (variable) |
| Path que falla | Path 3 (Energy) | Path 3 (Energy) + Path 2 (Flux) |
| Falsos por segundo | ~2 (cada kick) | ~0.5 (esporádicos) |
| Causa raíz | AGC 4x + piano floor | Synth bleed masivo + sweeps |
| Veto efectivo | NO (Flux del kick lo pasa) | SÍ para muro, NO para stabs |

**Conclusión clave:** El **Energy Bypass (Path 3) es el culpable común** en ambos casos. Dispara sin confirmación WNS cuando `SnareE` está inflado por contenido no-percusivo (piano en Brejcha, synths en Anyma) y un transitorio (kick o stab) genera `RawΔ` + `Flux` suficientes.

#### 🎵 11. Impacto Musical Real

A pesar de los falsos onsets, el show de Anyma **se ve bien** porque:
1. La zona LEFT (Front L + Back L) rellena con luz continua durante synths/bajos
2. Back R dispara en los snares/sweeps reales (WNS confirmado) — efecto percusivo
3. Los falsos del Energy bypass son rápidos (1 frame) y se diluyen en la densidad visual
4. El "muro rodante" de synth no produce onsets → Back R en silencio → contraste dramático

**El usuario lo confirma:** "si activo la zona left, esa rellena con luz el ritmo roto de la zona RIGHT percusiva pura... y ya. se queda un show con mucha luz de relleno que mola ademas :)"

---

### 📂 DOCUMENTO DE AFINACIÓN - V3 (Silence/Redoble Anyma)

**Objetivo:** Análisis del log `silenceredoubleanyma.md` — Anyma en modo 128 BPM con redobles y silencios.

*Pendiente de análisis en siguiente sesión.*

---
