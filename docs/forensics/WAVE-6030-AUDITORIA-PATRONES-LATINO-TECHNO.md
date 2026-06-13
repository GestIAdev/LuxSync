# WAVE 6030 — Auditoría Forense de Patrones Automáticos: Latino & Techno

**Autor:** Kimi Forense  
**Scope:** `VibeMovementManager.ts` + `FiestaLatinaProfile.ts` + `TechnoClubProfile.ts`  
**Objetivo:** Diagnóstico matemático de por qué ciertos patrones automáticos fallan estética o mecánicamente, y blueprint de corrección.

---

## ⚡ TL;DR para el Arquitecto

| Patrón | Fallo raíz | Fix propuesto | Complejidad |
|--------|-----------|---------------|-------------|
| **ballyhoo** | Es un Lissajous 1:2 con radio variable, no un ballyhoo real. Sin identidad propia. | Reescribir como lemniscata pinched o "knot" trefoil. | Media |
| **botstep** | 8 pasos en 8 beats = salto cada 0.46s @ 130 BPM. SmoothStep pico de velocidad 1.5× lineal → ~720 DMX/s, dispara Airbag. | Reducir a 4 pasos, `cycleBeats: 16`, añadir `velocityClamp` interno. | Baja |
| **cadera_libre** | Deriva de fase apenas 10° (`0.18 rad`). Sin asimetría de "cadera" (swing). | Aumentar drift a 0.4 rad, añadir término cuadrático `sin²` para contoneo asimétrico. | Baja |
| **espiral_conga** | Radio casi constante (`±0.25`). La "espiral" no crece ni decrece. Acento de conga (0.18) inaudible frente a base (0.60). | Hacer espiral logarítmica real (`r ∝ √φ`). Aumentar acento de bombo a 0.35 con envolvente de beat. | Media |
| **figure8** | Lissajous 1:2 perfecto. Cruz central con tangente vertical. No es un "8" (lemniscata) real. | Implementar lemniscata de Bernoulli (`r² = cos(2θ)`) o modulación de cintura. | Baja |
| **Velocidad Techno** | `botstep` y `scan_x` con `cycleBeats` cortos + `panScale=0.92` hacen que el Gearbox no limite (cálculo por ciclo, no por paso). | Añadir `perStepMaxTravel` en patrones cuantizados o subir `cycleBeats` de 8→16. | Baja |
| **Amplitud general** | `scan_x` (`y*0.45`), `wave_y` (`y*0.40`), `cancan` (`x*0.15`) son conservadores. | Revisar multiplicadores raw en función de `tiltScale` del vibe. | Baja |

---

## 1. Matemática del Gearbox — Por qué Techno es "demasiado rápido"

```ts
// calculateEffectiveAmplitude (línea 1281)
const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
const requestedTravel = 255 * baseAmplitude * (1 + energy * 0.2)
const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel)
```

El Gearbox calcula **distancia total recorrible en un ciclo completo**. Esto funciona para patrones continuos (senos), pero **falla para patrones cuantizados** como `botstep`:

- **Escenario:** `botstep` @ 130 BPM, `cycleBeats = 8`, `fixtureMaxSpeed = 250`
- `secondsPerBeat = 60/130 ≈ 0.462 s`
- `maxTravelPerCycle = 250 * 0.462 * 8 = 923 DMX`
- `requestedTravel = 255 * 0.92 * 1.2 = 282 DMX`
- `gearboxFactor = 3.27 → clamp a 1.0` → **¡El Gearbox no frena nada!**

**Pero** `botstep` no recorre suavemente: da **8 saltos discretos**. En cada salto, la posición brinca de `sin(k·φ)` a `sin((k+1)·φ)`. El delta máximo entre pasos consecutivos es ~1.3 en unidades normalizadas (= 332 DMX) en apenas 0.46 segundos. La **velocidad instantánea pico** supera los **700 DMX/s**, triplicando el safety cap de 400 DMX/s del `AetherSafetyMiddleware`.

> **Diagnóstico:** El Gearbox protege el recorrido total del ciclo, no el salto entre pasos. Los patrones cuantizados necesitan un `perStepVelocityBudget` o un `cycleBeats` mayor.

---

## 2. Ballyhoo — El Patrón que No Es Ballyhoo

### 2.1 Implementación actual
```ts
ballyhoo: (phase, audio, outPos) => {
  const r = 0.75 + 0.25 * Math.cos(phase * 2)
  outPos.x = Math.sin(phase) * r
  outPos.y = Math.cos(phase * 2) * r
}
```

### 2.2 Análisis matemático
Esto es un **Lissajous 1:2 con modulación radial**:
- `x = sin(φ) · (0.75 + 0.25·cos(2φ))`
- `y = cos(2φ) · (0.75 + 0.25·cos(2φ))`

Cuando `r` varía, la figura se hincha y contrae, pero **geométricamente es indistinguible de `figure8`** para el público. Un ballyhoo real en lighting design es una trayectoria que:
1. Barre un arco amplio en pan.
2. Cruza el centro con una "cola" o loop pequeño.
3. Tiene un punto de inflexión asimétrico (ej. pasa más tiempo arriba que abajo).

La implementación actual carece de estas 3 propiedades.

### 2.3 Fix propuesto — Trefoil Knot (Ballyhoo Real)
```ts
ballyhoo: (phase, audio, outPos) => {
  // Trefoil proyectado en 2D: loop grande + loop pequeño asimétrico
  const t = phase
  outPos.x = Math.sin(t) * (0.8 + 0.2 * Math.cos(t * 3))
  outPos.y = Math.sin(t * 2) * 0.5 + Math.cos(t) * 0.25
}
```
- `sin(t)·(0.8+0.2·cos(3t))` → pan con "resorte" cada tercer ciclo (la "cola").
- `sin(2t)*0.5 + cos(t)*0.25` → tilt asimétrico: loop superior más grande que inferior.

---

## 3. Bootstep — El Asesino del Airbag

### 3.1 Implementación actual
```ts
botstep: (phase, audio, outPos) => {
  const phi = 1.618033988749
  const totalSteps = 8
  const normalizedPhase = (phase / (2π)) * totalSteps  // 8 pasos por ciclo
  const currentStep = Math.floor(normalizedPhase) % 8
  let t = normalizedPhase - Math.floor(normalizedPhase)
  t = t * t * (3 - 2 * t)  // SmoothStep: pico de velocidad en t=0.5

  const fromX = Math.sin(currentStep * phi * π) * 0.65
  const toX = Math.sin((currentStep+1) * phi * π) * 0.65
  outPos.x = fromX + (toX - fromX) * t
  // idem para Y
}
```

### 3.2 Análisis de peligro mecánico
- **SmoothStep** tiene derivada máxima en `t=0.5`: `d/dt[smoothstep] = 6t(1-t) → máx = 1.5` en `t=0.5`.
- Esto significa que el fixture acelera desde 0 hasta **1.5× la velocidad media** en medio del paso.
- Como demostramos en §1, con `cycleBeats=8` @ 130 BPM, la velocidad pico supera 700 DMX/s.

### 3.3 Fix propuesto — Bootstep Seguro
```ts
botstep: (phase, audio, outPos) => {
  const phi = 1.618033988749
  const totalSteps = 4           // 🛡️ De 8→4: saltos más grandes pero menos frecuentes
  const normalizedPhase = (phase / (2π)) * totalSteps
  const currentStep = Math.floor(normalizedPhase) % totalSteps
  let t = normalizedPhase - Math.floor(normalizedPhase)

  // 🛡️ Ease-in-out cúbico (más suave que smoothstep en picos)
  t = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2

  // 🛡️ Reducir amplitud a 0.55 para acortar salto máximo
  const fromX = Math.sin(currentStep * phi * π) * 0.55
  const toX   = Math.sin((currentStep+1) * phi * π) * 0.55
  outPos.x = fromX + (toX - fromX) * t
  // ...Y idem
}
```

Y en `PATTERN_CONFIG`:
```ts
botstep: { cycleBeats: 16, phraseDuration: 64, ... }  // 🛡️ De 8→16
```

**Justificación:** 4 posiciones en 16 beats = 1 posición cada 4 beats (~1.85s @ 130 BPM). El mover tiene tiempo de acelerar suavemente y el Airbag respira tranquilo.

---

## 4. Cadera Libre — Sin Cadera y Sin Libre

### 4.1 Implementación actual
```ts
cadera_libre: (phase, audio, outPos) => {
  const drift = Math.sin(phase * 0.137) * 0.18  // 0.18 rad ≈ 10°
  outPos.x = Math.sin(phase) * 0.90
  outPos.y = Math.cos(phase * 2 + drift) * 0.65
}
```

### 4.2 Análisis estético
- **"Libre":** El drift de 0.18 rad (10°) es imperceptible en una frase de 64 beats. Para que una deriva sea "libre" necesita acumularse ≥45° (0.8 rad) en un ciclo.
- **"Cadera":** Una cadera real tiene **asimetría**: el vaivén hacia la derecha no es igual que hacia la izquierda (swing). El coseno es simétrico. Falta un término cuadrático o cúbico que empuje más hacia un lado.

### 4.3 Fix propuesto — Cadera con Swing
```ts
cadera_libre: (phase, audio, outPos) => {
  // Deriva orgánica perceptible: 0.4 rad ≈ 23° de desfase en un ciclo
  const drift = Math.sin(phase * 0.25) * 0.40

  // Swing: el contoneo hacia +x es más lento y profundo que hacia -x
  const swing = Math.sin(phase) + 0.3 * Math.sin(phase) * Math.abs(Math.sin(phase))

  outPos.x = swing * 0.85
  outPos.y = Math.cos(phase * 2 + drift) * 0.70
}
```
- `swing` usa `sin(φ)·|sin(φ)|` → crea una onda diente de sierra suavizada (más tiempo en +x, menos en -x).
- `drift*0.40` hace que el 8 se tuerza visiblemente de un ciclo a otro.

---

## 5. Espiral Conga — Círculo con Ruido

### 5.1 Implementación actual
```ts
espiral_conga: (phase, audio, outPos, index = 0, total = 1) => {
  const fixturePhase = phase + (index / max(total,1)) * (π/3)
  const r = 0.75 + 0.25 * Math.sin(phase * 0.25)  // radio: 0.50→1.00
  outPos.x = Math.cos(fixturePhase) * r
  outPos.y = Math.sin(fixturePhase) * 0.60 + Math.sin(fixturePhase * 3) * 0.18
}
```

### 5.2 Análisis estético
- **"Espiral":** El radio oscila entre 0.5 y 1.0 sinusoidalmente. Una espiral real requiere que el radio **crezca o decrezca monótonamente** con el ángulo (espiral de Arquímedes o logarítmica). Aquí el radio sube y baja: es un anillo pulsante, no una espiral.
- **"Conga":** El acento de bombo es `sin(3φ)*0.18`. La base es `sin(φ)*0.60`. La relación señal/ruido es 3.3:1 — el acento es un murmullo, no un golpe.

### 5.3 Fix propuesto — Espiral Logarítmica con Golpe de Conga
```ts
espiral_conga: (phase, audio, outPos, index = 0, total = 1) => {
  const fixturePhase = phase + (index / max(total,1)) * (π/3)

  // 🌊 Espiral logarítmica real: radio crece con √φ (proporción áurea)
  const spiralTurns = (fixturePhase % (2π)) / (2π)  // 0→1 dentro de cada vuelta
  const r = 0.40 + 0.60 * Math.sqrt(spiralTurns)   // 0.40→1.00 monótono

  // 🥁 Acento de conga: bombo en beats 1 y 3 (asumiendo φ sincronizado a beat)
  const beatPhase = fixturePhase % (2π)
  const congaAccent = Math.max(0, Math.sin(beatPhase * 2)) * 0.35  // 0.35 >> 0.18

  outPos.x = Math.cos(fixturePhase) * r
  // Base circular + acento de bombo que "empuja" el tilt hacia arriba
  outPos.y = Math.sin(fixturePhase) * 0.55 + congaAccent
}
```

---

## 6. Figure-8 — El Lissajous Impostor

### 6.1 Implementación actual
```ts
figure8: (phase, audio, outPos) => {
  outPos.x = Math.sin(phase)
  outPos.y = Math.sin(phase * 2) * 0.75
}
```

### 6.2 Análisis geométrico
Un **Lissajous 1:2** (`sin t`, `sin 2t`) genera una figura en forma de "8" **pero no es una lemniscata**:
- En el cruce central (`t = 0, π`), la tangente es **vertical** (dy/dx → ∞).
- En un "8" real (lemniscata de Bernoulli), el cruce es **pinched**: la tangente es horizontal, creando una "cintura" definida.
- Visualmente, el Lissajous parece un 8 "gordo" sin cintura. Con `tiltScale=0.85` se estira verticalmente y pierde la forma.

### 6.3 Fix propuesto — Lemniscata Real
```ts
figure8: (phase, audio, outPos) => {
  // Lemniscata de Bernoulli en coordenadas paramétricas
  const t = phase
  const sinT = Math.sin(t)
  const cosT = Math.cos(t)
  const denominator = 1 + sinT * sinT

  outPos.x = cosT / denominator        // [-1, +1]
  outPos.y = (sinT * cosT) / denominator * 1.4  // escalado para usar rango tilt
}
```
- `x = cos(t)/(1+sin²t)` → el pan barre casi todo el rango.
- `y = sin(t)cos(t)/(1+sin²t)` → tilt con "cintura" pinched en el centro.
- El factor `1.4` compensa que la lemniscata natural tiene menor extensión en Y.

---

## 7. Amplitud Global — Patrones Planos

### 7.1 Problema de arquitectura
Los patrones definen `outPos.x/y` con multiplicadores hardcodeados (ej. `scan_x: y*0.45`), pero estos valores se diseñaron cuando `tiltScale` era 0.68. Ahora `tiltScale` es 0.60 (techno) y 0.85 (latino). El resultado:

| Patrón | Raw Y | × tiltScale Techno (0.60) | × tiltScale Latino (0.85) |
|--------|-------|---------------------------|---------------------------|
| `scan_x` | `sin(2φ)*0.45` | 0.27 | 0.38 |
| `wave_y` | `sin(2φ)*0.40` | 0.24 | 0.34 |
| `cancan` | `sin(φ)*1.0` | 0.59 | 0.84 |

**`scan_x` y `wave_y`** son barridos casi planos en Techno. Se ven como "puertas de garaje" en vez de olas.

### 7.2 Fix propuesto
Unificar el multiplicador raw de cada patrón para que, tras aplicar `tiltScale`, ocupe **~70-80% del rango tilt disponible**:

```ts
// scan_x: aumentar y de 0.45 → 0.75
scan_x: (phase, audio, outPos) => {
  const detuneX = Math.sin((phase + fixtureOffset) * 3) * 0.03
  outPos.x = Math.sin(phase + fixtureOffset) + detuneX
  outPos.y = Math.sin((phase + fixtureOffset) * 2) * 0.75  // 🛡️ 0.45→0.75
}

// wave_y: aumentar y de 0.40 → 0.70
wave_y: (phase, audio, outPos) => {
  outPos.x = Math.sin(phase) * 0.85
  outPos.y = Math.sin(phase * 2) * 0.70  // 🛡️ 0.40→0.70
}
```

---

## 8. Dos Patrones Nuevos para Techno

### 8.1 `laser_grid` — Corte Q-Lab Profesional
Barrido que "rebota" en una cuadrícula invisible, como un láser industrial en una fábrica. Ideal para techno minimal/hard.

```ts
laser_grid: (phase, audio, outPos) => {
  // Grid de 3×2: el láser salta entre 6 nodos con snap instantáneo + hold
  const t = (phase / (2π)) * 6  // 6 nodos por ciclo
  const node = Math.floor(t) % 6
  const hold = t - Math.floor(t)

  // Posiciones de los 6 nodos (esquinas + centro de una elipse)
  const grid = [
    { x: -0.9, y:  0.7 },  // arriba-izq
    { x:  0.0, y:  0.9 },  // arriba-centro
    { x:  0.9, y:  0.7 },  // arriba-der
    { x:  0.9, y: -0.7 },  // abajo-der
    { x:  0.0, y: -0.9 },  // abajo-centro
    { x: -0.9, y: -0.7 },  // abajo-izq
  ]

  const pos = grid[node]
  // Micro-dither para que el láser "vibre" mientras apunta
  const dither = (Math.random() - 0.5) * 0.04
  outPos.x = pos.x + dither
  outPos.y = pos.y + dither
}
```

Config:
```ts
laser_grid: { cycleBeats: 12, phraseDuration: 48, safeHarborPhase: 0, safeHarborWindow: π/4, hardDeadlineExtra: 12, transitionBeats: 2 }
```

### 8.2 `industrial_pendulum` — Péndulo con Fricción
Un péndulo que oscila en X con amortiguamiento exponencial, luego se reinicia. Mecánico, pesado, determinista.

```ts
industrial_pendulum: (phase, audio, outPos) => {
  // 4 ciclos de amortiguamiento por vuelta
  const localPhase = phase % (2π)
  const decay = Math.exp(-localPhase / π)  // e^(-t/π): amortiguamiento suave
  outPos.x = Math.sin(localPhase * 2) * decay
  outPos.y = Math.cos(localPhase) * 0.3 * decay
}
```

Config:
```ts
industrial_pendulum: { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0, safeHarborWindow: π/4, hardDeadlineExtra: 16, transitionBeats: 3 }
```

---

## 9. Checklist de Implementación

- [ ] **WAVE 6030.1** — Fix `ballyhoo` → trefoil knot con asimetría.
- [ ] **WAVE 6030.2** — Fix `botstep` → 4 pasos + ease-in-out cúbico + `cycleBeats: 16`.
- [ ] **WAVE 6030.3** — Fix `cadera_libre` → drift 0.40 rad + término swing `sin·|sin|`.
- [ ] **WAVE 6030.4** — Fix `espiral_conga` → espiral logarítmica real + acento de conga 0.35.
- [ ] **WAVE 6030.5** — Fix `figure8` → lemniscata de Bernoulli pinched.
- [ ] **WAVE 6030.6** — Aumentar raw multipliers de `scan_x` (0.45→0.75) y `wave_y` (0.40→0.70).
- [ ] **WAVE 6030.7** — Añadir `laser_grid` e `industrial_pendulum` a `GoldenPattern`, `PATTERNS`, `PATTERN_CONFIG`, y `VIBE_CONFIG['techno-club'].patterns`.
- [ ] **WAVE 6030.8** — Verificar que `PATTERN_PERIOD` legacy esté alineado con `PATTERN_CONFIG.cycleBeats` para todos los patrones modificados.
- [ ] **WAVE 6030.9** — Test de velocidad: confirmar que `botstep` modificado no dispara Airbag @ 130 BPM con `fixtureMaxSpeed=250`.

---

## 10. Apéndice: Referencia de Constantes

| Constante | Valor actual | Significado |
|-----------|-------------|-------------|
| `techno-club.panScale` | 0.92 | ~497° de pan |
| `techno-club.tiltScale` | 0.60 | ~162° de tilt |
| `techno-club.baseFrequency` | 0.15 | ~9 oscilaciones/min @ 120 BPM |
| `fiesta-latina.panScale` | 0.95 | ~513° de pan |
| `fiesta-latina.tiltScale` | 0.85 | ~230° de tilt |
| `fiesta-latina.baseFrequency` | 0.12 | ~7 oscilaciones/min @ 120 BPM |
| `GEARBOX_MIN_AMPLITUDE` | 0.10 | Floor del gearbox (no afecta presets >0.10) |
| `HARDWARE_MAX_SPEED` | per-fixture | Default 250 DMX/s |
| `KINETIC_SAFETY_CAP_VEL` | 400 DMX/s | Airbag dispara por encima |

---

*"El problema no es que los movers sean rápidos. El problema es que las matemáticas les mienten sobre cuánto pueden ir."* — Kimi Forense, WAVE 6030.
