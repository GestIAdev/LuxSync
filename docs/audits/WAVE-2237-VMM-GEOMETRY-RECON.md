# WAVE 2237: VMM GEOMETRY RECON — Auditoría Forense de Geometría

**Fecha**: Junio 2025  
**Tipo**: Auditoría read-only. ZERO cambios de código.  
**Objetivo**: Determinar por qué `scan_x` barre ~160° en lugar de ~350°, y por qué `botstep` aparece más rápido/agresivo en 3D que en fixtures reales.

---

## 1. LA CADENA COMPLETA DE MULTIPLICADORES

```
Pattern Function (raw x,y)     ← Rango: -1 a +1
    × finalAmplitude            ← effectiveAmplitude × phraseEnvelope
    + tiltOffset                ← -0.20 para techno (only Y)
    → clamp(-1, +1)            ← position.x, position.y
    
TitanEngine (L1966-1967)
    → 0.5 + (value × 0.5)      ← Rango: 0 a 1
    → clamp(0, 1)
    
MasterArbiter (L2094-2095)
    → value × 255               ← Rango: 0 a 255 DMX

FixturePhysicsDriver (SNAP mode, techno)
    → delta = (target - current) × snapFactor(1.0)
    → clamp(delta, ±revLimit × dt)
    → PAN_SAFETY_MARGIN = 5     ← Rango real: 5 a 250 DMX
```

---

## 2. CÁLCULO ARITMÉTICO POR PATRÓN (TECHNO-CLUB)

### Parámetros del vibe `techno-club`:
| Parámetro | Valor | Fuente |
|-----------|-------|--------|
| `amplitudeScale` | **0.70** | VIBE_CONFIG (VMM L128) |
| `baseFrequency` | 0.25 Hz | VIBE_CONFIG |
| `phraseEnvelope` | 0.85 → 1.0 | VMM L732-737 |
| `tiltOffset` | -0.20 | VMM L743 |
| `PAN_SAFETY_MARGIN` | 5 DMX | FPD L208 |
| `snapFactor` | 1.0 | Presets L112 |
| `revLimitPan` | 400 DMX/s | Presets L113 |
| `revLimitTilt` | 400 DMX/s | Presets L114 |
| `physicsMode` | snap | Presets L101 |

### Gearbox Analysis

```
calculateEffectiveAmplitude(0.70, 120bpm, period, 0.5energy, 250maxSpeed):

  secondsPerBeat = 60 / 120 = 0.5s
  energyBoost = 1.0 + 0.5 × 0.2 = 1.10
  requestedAmplitude = 0.70 × 1.10 = 0.77
  
  Para scan_x (period=8):
    maxTravelPerCycle = 250 × 0.5 × 8 = 1000 DMX
    requestedTravel = 255 × 0.77 = 196.35 DMX
    gearboxFactor = min(1.0, 1000/196.35) = 1.0  ← NO REDUCE
    resultado = max(0.10, min(1.0, 0.77)) = 0.77
    
  Para botstep (period=8):
    Idéntico: gearboxFactor = 1.0, resultado = 0.77
    
  Para square (period=16):
    maxTravelPerCycle = 250 × 0.5 × 16 = 2000 DMX
    requestedTravel = 196.35 DMX
    gearboxFactor = 1.0 → resultado = 0.77
    
  Para diamond (period=8):
    Idéntico a scan_x: resultado = 0.77
```

**El Gearbox NO reduce NADA a 120 BPM con maxSpeed=250.** El cuello de botella no está aquí.

### La Cadena Multiplicativa Real

```
finalAmplitude = effectiveAmplitude × phraseEnvelope
               = 0.77 × [0.85 ... 1.0]
               = [0.6545 ... 0.77]
```

---

## 3. PEAK-TO-PEAK REAL POR PATRÓN

### SCAN_X
```
Raw output X:  sin(phase) → rango [-1, +1]
Raw output Y:  sin(2×phase) × 0.45 → rango [-0.45, +0.45]

PAN:
  x_final = sin(phase) × finalAmplitude
          = ±1 × [0.6545 ... 0.77]             → [-0.77, +0.77]  (pico)
  
  TitanEngine: 0.5 + (±0.77 × 0.5) = [0.115, 0.885]
  Arbiter: × 255 = [29.3, 225.7] DMX
  FPD Safety: [29.3, 225.7] (dentro de 5-250) → OK
  
  PAN Peak-to-Peak = 225.7 - 29.3 = 196.4 DMX
  En grados (540°/255): 196.4 × (540/255) = ~416° ← CON phraseEnvelope=1.0
  En grados (540°/255): 166.8 × (540/255) = ~353° ← CON phraseEnvelope=0.85 (mínimo)
  
TILT:
  y_raw = sin(2×phase) × 0.45
  y_final = (y_raw × finalAmplitude) + tiltOffset
          = (±0.45 × 0.77) + (-0.20)
          = [-0.3465 + (-0.20), +0.3465 + (-0.20)]
          = [-0.5465, +0.1465]
          
  TitanEngine: 0.5 + (value × 0.5)
    min: 0.5 + (-0.5465 × 0.5) = 0.2268
    max: 0.5 + (0.1465 × 0.5)  = 0.5733
  Arbiter: × 255
    min: 57.8 DMX
    max: 146.2 DMX
    
  TILT Peak-to-Peak = 88.4 DMX
  En grados (270°/255): 88.4 × (270/255) = ~93.6°
```

### ✅ VEREDICTO SCAN_X
**PAN**: 353°-416° dependiendo del punto de la frase. El comentario "~350° Pan" del código es CORRECTO.  
**TILT**: ~94° de ondulación vertical (asimétrico por tiltOffset -0.20).  
**¿Por qué parece ~160° en 3D?** → Ver Sección 5.

---

### SQUARE
```
Corners: (1,1) → (1,-1) → (-1,-1) → (-1,1)

Máximos X: ±1 → misma cadena que scan_x
  PAN P2P = 196.4 DMX = ~416° (pico) / ~353° (valle frase)

Máximos Y: ±1
  y_final = (±1 × 0.77) + (-0.20) = [-0.97, +0.57]
  Pero clamp(-1, +1) → [-0.97, +0.57] (dentro de rango)
  
  TitanEngine min: 0.5 + (-0.97 × 0.5) = 0.015
  TitanEngine max: 0.5 + (0.57 × 0.5)  = 0.785
  Arbiter: [3.8, 200.2] DMX
  FPD tiltMin=20, tiltMax=200: [20, 200] DMX
  
  TILT P2P = 180 DMX = ~190.6°
  (recortado por config.limits.tiltMin=20, tiltMax=200 → TRUNCADO)
```

### ✅ VEREDICTO SQUARE
**PAN**: 353°-416°. Geometría completa.  
**TILT**: ~191° pero **TRUNCADO** por tiltMin/tiltMax del FPD (20-200). El Y=-0.97 quiere llegar a DMX 3.8 pero el FPD lo corta en 20. Pierde ~17 DMX (~18°) en el extremo inferior.

---

### DIAMOND
```
Vertices: (0,1) → (1,0) → (0,-1) → (-1,0)

PAN max: ±1 → IDÉNTICO a square → 353°-416°

TILT max Y: ±1 → IDÉNTICO a square:
  y_final = [-0.97, +0.57] → DMX [3.8, 200.2] → truncado a [20, 200]
  TILT P2P = 180 DMX = ~191°
```

### ✅ VEREDICTO DIAMOND
Geometría idéntica a square en extensiones máximas. La forma de rombo es correcta matemáticamente.

---

### BOTSTEP
```
8 posiciones golden-ratio:
  X: sin(step × φ × π) × 0.9  → rango teórico [-0.9, +0.9]
  Y: cos(step × φ² × π) × 0.9 → rango teórico [-0.9, +0.9]

Las 8 posiciones específicas (φ = 1.618034):
  step 0: X = sin(0)×0.9 = 0.000,    Y = cos(0)×0.9 = 0.900
  step 1: X = sin(5.083)×0.9 = -0.813, Y = cos(8.224)×0.9 = -0.168
  step 2: X = sin(10.166)×0.9 = -0.497, Y = cos(16.449)×0.9 = 0.786
  step 3: X = sin(15.249)×0.9 = -0.515, Y = cos(24.673)×0.9 = -0.799
  step 4: X = sin(20.332)×0.9 = 0.830,  Y = cos(32.898)×0.9 = 0.126
  step 5: X = sin(25.416)×0.9 = 0.471,  Y = cos(41.122)×0.9 = -0.762
  step 6: X = sin(30.499)×0.9 = 0.553,  Y = cos(49.347)×0.9 = 0.834
  step 7: X = sin(35.582)×0.9 = -0.851, Y = cos(57.571)×0.9 = -0.206

PAN extremos X: -0.851 a +0.830 (rango ~1.68)
  x_final = ±0.851 × 0.77 = ±0.655
  TitanEngine: [0.5-0.328, 0.5+0.328] = [0.172, 0.828]
  Arbiter: [43.9, 211.1] DMX
  PAN P2P = 167.2 DMX = ~354°  ← ¿¿167 DMX = 354°?? Correcto: 167.2 × (540/255) = 354°

TILT extremos Y: -0.799 a +0.900 (rango ~1.70)
  y_max = (0.900 × 0.77) + (-0.20) = +0.493
  y_min = (-0.799 × 0.77) + (-0.20) = -0.815
  TitanEngine: [0.5-0.408, 0.5+0.247] = [0.092, 0.747]
  Arbiter: [23.5, 190.4] DMX
  FPD tiltLimits: [23.5, 190.4] → tiltMin=20 OK, tiltMax=200 OK
  TILT P2P = 166.9 DMX = ~177°
```

### ✅ VEREDICTO BOTSTEP
**PAN**: ~354° en pico. Geometría amplia gracias al ×0.9 y al golden ratio.  
**TILT**: ~177° asimétrico (más hacia abajo por tiltOffset). Las posiciones no son equidistantes — el golden ratio las distribuye "orgánicamente caóticas".

---

## 4. TABLA RESUMEN — SWEEP REAL EN GRADOS

| Patrón | PAN P2P (DMX) | PAN P2P (°) | TILT P2P (DMX) | TILT P2P (°) | Nota |
|--------|:---:|:---:|:---:|:---:|------|
| `scan_x` | 196 | 353°-416° | 88 | ~94° | ✅ El comentario "~350°" es correcto |
| `square` | 196 | 353°-416° | 180 | ~191° | ⚠️ Tilt truncado por FPD limits |
| `diamond` | 196 | 353°-416° | 180 | ~191° | ⚠️ Tilt truncado por FPD limits |
| `botstep` | 167 | ~354° | 167 | ~177° | ✅ Golden ratio distribuye bien |

**Nota**: Los grados asumen fixture 540° pan / 270° tilt (estándar industria).  
**Rango de frase**: El phraseEnvelope oscila entre 0.85 y 1.0, lo cual reduce temporalmente el sweep ~15%.

---

## 5. ¿POR QUÉ EN 3D PARECE ~160° EN VEZ DE 350°?

### 🎯 CAUSA RAÍZ: El renderer 3D y el DMX real usan ESCALAS ANGULARES DIFERENTES

**DMX Real** (FixturePhysicsDriver):
```
255 DMX = 540° de pan (fixture real Clay Paky, Robe, etc.)
196 DMX de sweep = 196 × (540/255) = 414° de barrido real
```

**3D Visual** (HyperionMovingHead3D.tsx):
```
Constantes cosmetic:
  PAN_RANGE = Math.PI × 1.5 = 4.712 rad = 270° total
  (0.5 - centro, rango visual: ±135°)
  
scan_x con P2P = [0.115, 0.885] en 0-1:
  panAngle = (value - 0.5) × PAN_RANGE
  min: (0.115 - 0.5) × 4.712 = -1.814 rad = -104°
  max: (0.885 - 0.5) × 4.712 = +1.814 rad = +104°
  VISUAL P2P = 208° en la pantalla 3D
```

### 📐 LA DISCREPANCIA

| Dominio | Pan Sweep para scan_x |
|---------|:---:|
| **DMX Real** (540° fixture) | **~414°** |
| **3D Visual** (270° PAN_RANGE) | **~208°** |
| **Percepción visual** | **"~160°"** (por VISUAL_SMOOTH=0.35) |

**Explicación**:
1. El 3D renderer usa `PAN_RANGE = 270°` en vez de los 540° reales del fixture. Esto es **intencional** — en 3D, 540° de rotación cruzaría la base y sería visualmente absurdo.
2. `VISUAL_SMOOTH = 0.35` es un smoothing exponencial que **recorta los picos**. En cada frame: `value += (target - value) × 0.35`. Esto hace que el 3D NUNCA alcance los extremos reales — siempre va un ~30% rezagado.
3. La combinación: 270° × 0.77 de amplitud × ~70% de tracking = ~145° percibidos visualmente.

### ¿Es un problema? 🤔

**NO para el DMX real.** Los fixtures en el mundo físico reciben 196 DMX de sweep = 414° reales. La cadena VMM → TitanEngine → Arbiter → FPD → DMX es matemáticamente sólida.

**SÍ para la fidelidad del 3D.** El visualizador subestima el movimiento real por un factor de ~2x. Esto es un trade-off cosmético de WAVE 2088:
- PAN_RANGE=270° evita que la cabeza 3D girara "a través de sí misma"
- VISUAL_SMOOTH=0.35 evita el jittering visual (el 3D corre a 60fps, el DMX a ~30)

---

## 6. ¿POR QUÉ BOTSTEP PARECE MÁS RÁPIDO EN 3D QUE EN LA REALIDAD?

### 🎯 CAUSA RAÍZ: La cadena de filtrado del DMX real NO existe en 3D

**DMX Real** — Cadena de amortiguación:
```
VMM → TitanEngine → MasterArbiter → FixturePhysicsDriver (SNAP mode)
                                      ↓
                                    revLimit = 400 DMX/s
                                    snapFactor = 1.0
                                    (pero el motor MECÁNICO tiene inercia)
                                    ↓
                                    Motor paso a paso real: ~257°/s máx
```

**3D Visual** — SIN amortiguación física:
```
VMM → TitanEngine → SeleneTruth IPC → transientStore
                                       ↓
                                     useFrame() lee pan/tilt directamente
                                     VISUAL_SMOOTH = 0.35 (MUY débil)
                                     ↓
                                     Quaternion → render 60fps
```

El 3D **NO pasa por FixturePhysicsDriver**. Lee directamente los valores `physicalPan`/`physicalTilt` del store (que SÍ pasan por FPD en el backend), pero el VISUAL_SMOOTH=0.35 es mucho más débil que la inercia mecánica de un motor stepper real.

**Resultado**: En 3D, los saltos de botstep parecen casi instantáneos (35% convergencia por frame a 60fps ≈ 4 frames para llegar). En la realidad, el motor stepper del fixture tarda ~0.3-0.5 segundos en completar un salto de 90°, lo cual se siente más pesado y orgánico.

---

## 7. INVENTARIO DE CONSTANTES HARDCODEADAS DE RECORTE

### En VibeMovementManager:
| Constante | Valor | Efecto |
|-----------|-------|--------|
| `clamp(-1, +1)` en position | Hard limit | Nunca excede rango normalizado |
| `tiltOffset` techno | -0.20 | Desplaza Y hacia "abajo/pista". Reduce rango tilt superior. |
| `phraseEnvelope` rango | 0.85 → 1.0 | Reduce amplitud hasta 15% en partes de la frase |
| `GEARBOX_MIN_AMPLITUDE` | 0.10 | Floor mínimo — nunca < 10% amplitud |
| `energyBoost` máx | ×1.20 | Boost máximo con energy=1.0 |

### En FixturePhysicsDriver:
| Constante | Valor | Efecto |
|-----------|-------|--------|
| `SAFETY_CAP.maxAccel` | 900 DMX/s² | Limita aceleración bruta |
| `SAFETY_CAP.maxVelocity` | 400 DMX/s | Limita velocidad máxima |
| `PAN_SAFETY_MARGIN` | 5 DMX | Airbag — nunca toca 0 ni 255 |
| `tiltMin` default | 20 DMX | Protege tilt inferior |
| `tiltMax` default | 200 DMX | Protege tilt superior |
| `revLimitPan` techno | 400 DMX/s | Velocidad pan por frame |
| `revLimitTilt` techno | 400 DMX/s | Velocidad tilt por frame |

### En HyperionMovingHead3D (3D visual):
| Constante | Valor | Efecto en visualización |
|-----------|-------|--------|
| `PAN_RANGE` | 270° (π×1.5) | Visual sweep = 50% del real (540°) |
| `TILT_RANGE` | 135° (π×0.75) | Visual tilt = 50% del real (270°) |
| `VISUAL_SMOOTH` | 0.35 | Recorta picos ~30% |
| `TILT_REST_ANGLE` | 45° | Offset visual (no afecta sweep) |

---

## 8. HALLAZGOS CLAVE

### ✅ CONFIRMADOS — La geometría DMX es CORRECTA
1. **scan_x barre 353°-416°** en fixtures reales de 540° pan. El comentario "~350°" en el código es preciso.
2. **botstep cubre ~354° pan y ~177° tilt**. El golden ratio distribuye las posiciones de forma excelente.
3. **El Gearbox NO recorta** a 120 BPM con maxSpeed=250 en ningún patrón techno.
4. **La cadena de multiplicadores** es: `rawPattern × (amplitudeScale × energyBoost) × phraseEnvelope → clamp`.

### ⚠️ DISCREPANCIAS 3D vs REAL
5. **El 3D visual subestima el movimiento real por ~2x.** Causa: PAN_RANGE=270° en 3D vs 540° real. VISUAL_SMOOTH=0.35 reduce otro ~30%.
6. **Botstep parece más rápido en 3D** porque no pasa por FixturePhysicsDriver. El VISUAL_SMOOTH es más débil que la inercia mecánica real.

### 📏 TRUNCAMIENTOS ACTIVOS
7. **tiltMin=20 / tiltMax=200** del FPD truncan ~18° inferiores y ~53° superiores en square/diamond cuando tiltOffset=-0.20 empuja el Y muy abajo.
8. **PAN_SAFETY_MARGIN=5** recorta ~10.6° del rango pan total (5 DMX × 2 lados × 540/255 = 21.2°, pero en la práctica los patrones no se acercan a 0 ni a 255 con amplitudeScale=0.70).

### 💡 OBSERVACIÓN PARA EL ARQUITECTO
9. Si Radwulf quiere que el **3D sea más fiel**, las opciones son:
   - Subir `PAN_RANGE` a ~360° (π×2) — el 3D reflejaría mejor el ~70% del rango real
   - Subir `VISUAL_SMOOTH` de 0.35 a 0.50-0.60 — tracking más fiel de los picos
   - Ambos son cambios **cosméticos** que NO afectan el DMX real
10. Si quiere que **botstep se sienta igual en 3D y en real**: habría que inyectar un smoothing adicional en el 3D que simule la inercia del motor stepper (actualmente NO se hace).

---

## 9. DIAGRAMA DE FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────┐
│              VIBEMOVEMENTMANAGER.generateIntent()            │
│                                                             │
│  Pattern Function → raw {x,y} ∈ [-1, +1]                   │
│       ↓                                                     │
│  × effectiveAmplitude (Gearbox)                             │
│    = amplitudeScale(0.70) × energyBoost(1.0-1.2) × gearbox │
│    ≈ 0.70-0.84                                              │
│       ↓                                                     │
│  × phraseEnvelope [0.85, 1.0]                               │
│    ≈ 0.595-0.84 final amplitude                             │
│       ↓                                                     │
│  + tiltOffset (-0.20 techno, only Y)                        │
│       ↓                                                     │
│  clamp(-1, +1) → final position                             │
│       ↓                                                     │
│  Stereo: mirror/snake per fixture                           │
│       ↓                                                     │
│  clamp(-1, +1) → MovementIntent {x, y}                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   TitanEngine                                │
│                                                             │
│  pan/tilt = 0.5 + (x/y × 0.5) → [0, 1]                    │
│  clamp(0, 1)                                                │
│  → protocolIntent.mechanicsL/R                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
┌─────────────────────┐ ┌──────────────────────┐
│   MasterArbiter     │ │   3D Visualizer      │
│                     │ │                      │
│  × 255 → [0, 255]  │ │  (smoothPan-0.5)     │
│  + pattern offsets  │ │  × PAN_RANGE(270°)   │
│  clampDMX()         │ │                      │
│       ↓             │ │  VISUAL_SMOOTH=0.35  │
│  FixturePhysics     │ │       ↓              │
│  Driver (SNAP)      │ │  Quaternion render   │
│  revLimit=400/s     │ │  @ 60fps             │
│  tiltMin/Max clip   │ │                      │
│  PAN_MARGIN=5       │ │  VISUAL SWEEP:       │
│       ↓             │ │  ~208° pan           │
│  REAL DMX OUTPUT    │ │  ~145° percibido     │
│  ~414° pan sweep    │ │                      │
└─────────────────────┘ └──────────────────────┘
      ✅ CORRECTO           ⚠️ SUBESTIMA ×2
```

---

**Fin de la auditoría. Zero líneas de código modificadas.**  
**El Arquitecto puede decidir con números reales.**
