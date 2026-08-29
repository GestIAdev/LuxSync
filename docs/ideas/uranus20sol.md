¡Esto sí que es diseñar de verdad! Me encanta el modelo Solar Gravity — es físicamente elegante y resuelve los tres problemas de raíz. Déjame pensar las matemáticas con cuidado.

---

# 🌌 URANUS 2.0 — MICRO-BLUEPRINT 1: SOLAR GRAVITY

## Metáfora Física

Imagina el Primary Hue como un **planeta orbitando un sistema binario**:
- **Estrella A (Croma):** la armonía musical — su masa (bass) determina cuánto tira
- **Estrella B (Sidereal Clock):** el vacío cósmico — siempre está ahí, rotando lentamente
- **El Planeta (Hue):** cuando la Estrella A tiene masa (bass denso), el planeta queda capturado en su órbita. Cuando la masa colapsa (breakdown, silencio), el planeta escapa y deriva por el vacío sidéreo.

---

## Ley 1: Bass is Mass — Cálculo de G (Gravity Strength)

```
G = clamp(bassEMA^γ_grav, 0, 1)
```

Donde:
- `bassEMA` = EMA del bass energy normalizado [0,1], con `α_bass = 0.03` (τ≈1.5s) — lo suficientemente lento para no jitterear en transientes de kick, pero suficientemente rápido para responder a un drop/breakdown en ~1.5s
- `γ_grav = 1.5` — suaviza la curva para que el bass medio no produzca gravedad máxima. Con γ=1.5, bass=0.5 produce G=0.35 (gravedad moderada), bass=0.9 produce G=0.85 (ancla fuerte)

```typescript
// Pseudo-code
let _bassEMA = 0;
const BASS_ALPHA = 0.03;
const GRAVITY_GAMMA = 1.5;

function computeGravity(bassRaw: number): number {
  _bassEMA = (1 - BASS_ALPHA) * _bassEMA + BASS_ALPHA * bassRaw;
  return Math.min(1, Math.pow(_bassEMA, GRAVITY_GAMMA));
}
```

**Propiedad clave:** Los agudos (cymbals, synths, voces) tienen **cero influencia** sobre G. Solo el bass determina la fuerza gravitacional. Un pasaje de hi-hats sobre bass silence produce G≈0 → el hue se entrega al Sidereal Clock.

---

## Ley 2: Barycenter Anchor — Dirección Cromática

La dirección (ángulo) sigue siendo el baricentro del chroma vector sobre la Circle of Fifths, **sin cambio**:

```
M = Σ w_i · û(θ_i),  donde w_i = c_i^γ_chroma
θ_chroma = atan2(M_y, M_x)
```

**Pero ahora la clave es:** `θ_chroma` solo importa cuando `G > 0`. Cuando `G → 0`, la dirección cromática se ignora completamente — el hue pertenece al Sidereal Clock.

```typescript
// Sin cambios respecto a Pillar I original
// Solo cambiamos CÓMO se usa θ_chroma downstream (ver Ley 4)
const Mx = Σ w_i * COS_THETA[i];
const My = Σ w_i * SIN_THETA[i];
const thetaChroma = (Math.atan2(My, Mx) * 180 / Math.PI + 360) % 360;
```

---

## Ley 3: The Sidereal Slingshot + Relativity — Drift Dinámico

Aquí está la magia. El Sidereal Clock ya no es una rotación a velocidad constante (8°/min). Ahora su velocidad angular es **inversamente proporcional a la gravedad**:

```
ω_dynamic(G) = ω_min + (ω_max - ω_min) · (1 - G)
```

Donde:
- `ω_min = 4°/min` (G=1, bass pesado) — arrastre majestuoso, casi imperceptible
- `ω_max = 36°/min` (G=0, vacío) — revolución completa cada 10 minutos, visible pero no nervioso
- `(1-G)` es el factor de "vacío" — cuando no hay bass, el universo se acelera

```typescript
// Pseudo-code — integración numérica del drift
let _siderealAngle = 0;  // estado persistente
const OMEGA_MIN = 4;      // °/min cuando G=1
const OMEGA_MAX = 36;     // °/min cuando G=0

function updateSidereal(G: number, dtMs: number): number {
  const omega = OMEGA_MIN + (OMEGA_MAX - OMEGA_MIN) * (1 - G);
  const dtMin = dtMs / 60000;
  _siderealAngle = (_siderealAngle + omega * dtMin) % 360;
  return _siderealAngle;
}
```

**Propiedad relativista:** Cuando el bass vuelve después de un breakdown, G sube, ω cae, y el hue es "recapturado" por la gravedad cromática. La transición de "drift libre" a "ancla cromática" es orgánica porque G cambia suavemente (EMA del bass).

**Fase acumulada:** `_siderealAngle` es un estado persistente que se acumula frame a frame. A diferencia del Φ(t) original que era función pura del tiempo, ahora el drift tiene memoria — la velocidad variable significa que la posición depende del historial de G, no solo del tiempo transcurrido.

---

## Ley 4: Interpolación del Hue Final — El Blended Anchor

El Primary Hue es una **interpolación circular** entre el ancla cromática y el drift sidéreo, ponderada por G:

```
H_primary = slerp(θ_chroma, Φ_dynamic, 1 - G)
```

Donde `slerp` es interpolación de arco más corto en el círculo:

```typescript
function circularLerp(a: number, b: number, t: number): number {
  // Arco más corto de a → b, ponderado por t
  let delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

// G=1 → t=0 → H = θ_chroma (ancla cromática pura)
// G=0 → t=1 → H = Φ_dynamic (drift sidéreo puro)
const H_primary = circularLerp(thetaChroma, siderealAngle, 1 - G);
```

**Comportamiento en los dos regímenes:**

| Escena musical | Bass | G | ω sidéreo | H_primary | Efecto visual |
|---|---|---|---|---|---|
| Drop pesado (techno) | 0.9 | 0.85 | 5.4°/min | ≈ θ_chroma | Hue anclado a la armonía, drift imperceptible |
| Groove medio (latino) | 0.5 | 0.35 | 26°/min | blend 65% croma / 35% sidéreo | Hue sigue la armonía pero deriva lentamente |
| Breakdown ambient | 0.1 | 0.03 | 35°/min | ≈ Φ_dynamic | Hue libre, rotando por el color wheel |
| Silencio total | 0.0 | 0.00 | 36°/min | = Φ_dynamic | Deriva cósmica pura |

---

## Arquitectura del Frame Loop

```typescript
// ── Per-frame (44Hz) ──
function solarGravityTick(
  chroma: Float64Array,   // 12 bins
  bassRaw: number,        // normalized [0,1]
  dtMs: number,           // delta time since last frame
): number {
  // 1. Gravity strength from bass (EMA suavizado)
  const G = computeGravity(bassRaw);

  // 2. Chroma barycenter direction (Circle of Fifths)
  let Mx = 0, My = 0;
  for (let i = 0; i < 12; i++) {
    const w = Math.pow(chroma[i], GRAVITY_GAMMA_CHROMA);
    Mx += w * COS_THETA[i];
    My += w * SIN_THETA[i];
  }
  const thetaChroma = (Math.atan2(My, Mx) * 180 / Math.PI + 360) % 360;

  // 3. Sidereal drift with dynamic angular velocity
  const siderealAngle = updateSidereal(G, dtMs);

  // 4. Blended primary hue: gravity anchors to chroma, vacuum drifts to sidereal
  const H_primary = circularLerp(thetaChroma, siderealAngle, 1 - G);

  return H_primary;
}
```

---

## Por qué esto mata la "Feria Ambulante"

1. **El jitter cromático ya no importa cuando no hay bass.** En el modelo anterior, el chroma vector jittereaba siempre, sin importar el contenido. Ahora, si no hay bass (G≈0), el chroma se ignora — el hue deriva suavemente por el Sidereal Clock.

2. **El bass es inerente por naturaleza.** Un kick drum no cambia de frecuencia frame a frame — es un pulso de energía en 60-120Hz. El EMA del bass es **monotónico y estable** comparado con el chroma vector (que salta entre 12 pitch classes). G es un escalar suave, no un vector ruidoso.

3. **No hay derivaciones independientes.** Solar Gravity produce **un solo hue**. El legacy engine construye secondary/accent/ambient con teoría armónica estándar. Cero "feria".

4. **El drift sidéreo es orgánico.** Cuando el bass sube/baja, la velocidad del drift cambia suavemente. No hay saltos — la transición de "ancla" a "drift libre" es un continuum, no un switch.

5. **Breakdowns son visualmente mágicos.** En un breakdown donde el bass desaparece, el hue se "libera" y empieza a rotar por el color wheel. Cuando el drop vuelve, el hue es recapturado por la armonía. Esto es **teatro lumínico físico**, no un efecto arbitrario.

---

## Pregunta de Diseño para The Architect

**¿Necesitamos un EMA separado para `θ_chroma`?** 

El chroma direction puede jitterear incluso cuando G es alto (bass estable pero armonía cambiante). Opciones:
- **(A) Sin EMA:** confiar en que G suaviza suficientemente — cuando G es alto, el bass es estable, y la armonía probablemente también (las pistas con bass denso tienden a ser armónicamente estables)
- **(B) EMA vectorial lento (α=0.01, τ≈4s):** suavizar el chroma vector antes de atan2, igual que Pillar I original pero más lento
- **(C) EMA en el hue final:** suavizar `H_primary` después del blend — más simple pero puede causar lag

Mi recomendación: **(A)** para empezar. Si la armonía jitterea con bass alto, añadimos (B). Filosofía: empezar simple, añadir complejidad solo si se demuestra necesaria.

---

Espero tu aprobación o ajustes, Architect. Las matemáticas están listas para implementarse cuando des luz verde. 🌌

-------------------------------------------
---------------------------------------------------------

Me decanto sin dudarlo por la Opción B (EMA vectorial lento).
¿Por qué? Porque en el Techno y en la música de club, el bajo (el bombo o kick) es repetitivo (128 BPM), pero el resto de las frecuencias (los "ruidos" que el analizador musical lee como notas) son muy sucias. Aunque tengamos Gravedad alta, si no suavizamos el vector cromático, el planeta va a vibrar en su órbita.
Queremos que, cuando el bajo esté presente, el color se ancle a un punto y se mueva lentamente como una marea, no como un flan. Así que sí, mantén un acumulador vectorial con α = 0.01 antes de hacer el atan2.

********* APENDICE : Cuidado con el bajo estimado en latino. Una voz de autotune ya ronda el 0.4 , y un denbow pesado puede alcanzar 0.8 con facilidad .