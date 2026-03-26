# 🌊 WAVE 2401 — THE LIQUID STEREO BLUEPRINT

> **Estado**: BLUEPRINT — Pendiente de aprobación del Arquitecto  
> **Restricción**: `TechnoStereoPhysics.ts` NO se modifica hasta aprobación  
> **God Mode**: INTACTO para la Sunset Party de mañana  
> **Simulador**: `scripts/liquid-stereo-sim.ts` — ejecutable, determinista, cero heurísticas

---

## 1. MISIÓN

Evolucionar de **4 zonas hardcodeadas** a **7 bandas independientes** con una abstracción unificada (`LiquidEnvelope`) que encapsule TODA la morfología actual:

- Soft Knee (ghostPower)
- Velocity Gate (attack-only trigger + Undertow grace frame)
- Asymmetric Decay (EMA attack/decay con Tidal Gate)
- Ignition Squelch (anti-pad-ghost)
- Adaptive Floor + Peak Memory
- Sidechain Guillotine

Cada zona deja de ser código artesanal y pasa a ser una **instancia configurada** de LiquidEnvelope.

---

## 2. ARQUITECTURA ACTUAL vs PROPUESTA

### 2.1 God Mode — 4 Zonas (Estado Actual)

```
┌─────────────────────────────────────────────────────────────┐
│                    GodEarFFT (7 bandas)                     │
│  subBass │ bass │ lowMid │ mid │ highMid │ treble │ ultraAir│
└────┬─────┴──┬───┴───┬────┴──┬──┴────┬────┴───┬────┴───┬────┘
     │        │       │      │       │        │        │
     └───┬────┘       │      │       │        └───┬────┘
         │            ╳      │       ╳            │
         ▼         (no se    │    (se mezcla      ▼
  ┌──────────┐     usa)      ▼    con treble)  ┌──────────┐
  │ FRONT PAR│          ┌─────────┐            │ MOVER R  │
  │ bass+sub │          │ BACK PAR│            │ treble   │
  │ *0.5     │          │ mid     │            │ -20%mid  │
  └──────────┘          └─────────┘            └──────────┘
  Kick Pump              Snare Sniper    Schwarzenegger Mode
  
  toLegacyFormat():
    bass   = bands.bass + bands.subBass * 0.5   ← FRONT PAR input
    mid    = bands.mid                           ← BACK PAR input  
    treble = bands.treble + bands.ultraAir * 0.5 ← MOVER R input
    
  Bandas IGNORADAS por la física:
    lowMid  → NO se usa en ninguna zona
    highMid → Solo como proxy de "harshness" (acid mode trigger)
```

### 2.2 Liquid Stereo — 7 Bandas (Propuesto)

```
┌─────────────────────────────────────────────────────────────┐
│                    GodEarFFT (7 bandas)                     │
│  subBass │ bass │ lowMid │ mid │ highMid │ treble │ ultraAir│
└────┬─────┴──┬───┴───┬────┴──┬──┴────┬────┴───┬────┴───┬────┘
     │        │       │      │       │        │        │
     ▼        ▼       ▼      ▼       ▼        ▼        ▼
  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌────────┐
  │Liquid││Liquid││Liquid││Liquid││Liquid││Liquid││ Strobe │
  │Env#1 ││Env#2 ││Env#3 ││Env#4 ││Env#5 ││Env#6 ││ Binary │
  └──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└───┬────┘
     │       │       │      │       │        │        │
     ▼       ▼       ▼      ▼       ▼        ▼        ▼
  Front L  Front R  Back L  Back R  Mover L  Mover R  Strobe
  SubBass   Bass   LowMid   Mid   HighMid  Treble   UltraAir
  20-60Hz 60-250Hz 250-500 500-2k  2k-6kHz 6k-16kHz 16k-22k
```

**Cambios clave**:
- `lowMid` (250-500Hz) **sale de la oscuridad** → Back L (warmth atmosférico)
- `highMid` (2-6kHz) **deja de ser solo "harshness"** → Mover L (presencia/ataque)
- `subBass` (20-60Hz) **tiene zona propia** → Front L (floor shaker puro)
- `ultraAir` (16-22kHz) → Strobe trigger (binario, sin envelope)
- **Sidechain se mantiene**: Front pair (SubBass + Bass) ducks Movers

---

## 3. LIQUID ENVELOPE — Diseño de la Abstracción

### 3.1 Interfaz

```typescript
interface LiquidEnvelopeConfig {
  name: string;           // Identificador de la banda
  gateOn: number;         // Umbral de activación
  gateOff: number;        // Histéresis inferior
  boost: number;          // Ganancia post-gate
  crushExponent: number;  // Compresión (>1 = selectivo, <1 = expansivo)
  decayBase: number;      // Decay por frame en morph=0
  decayRange: number;     // Modulación de decay por morphFactor
  maxIntensity: number;   // Cap de salida
  squelchBase: number;    // Ignition squelch en morph=0
  squelchSlope: number;   // Cuánto baja squelch con morph
  ghostCap: number;       // Brillo máximo de Soft Knee
  gateMargin: number;     // Margen fijo sobre gate adaptativo
}
```

### 3.2 Pipeline Interno (por frame)

```
signal ──┬── Velocity Gate ──── ¿isAttacking? ─── NO → ghostPower path
         │                                        │
         ├── Asymmetric EMA ──── avgSignal        YES
         │                                         │
         ├── Peak Memory ──── avgSignalPeak        │
         │   (Tidal Gate decay)                    │
         │                                         ▼
         ├── Adaptive Floor ──── adaptiveFloor    Raw Power
         │   (dry spell detection)                 │
         │                                         ▼
         └── Dynamic Gate ──── dynamicGate        Crush Exponent
                                                   │
                                                   ▼
                                              Ignition Squelch
                                                   │
                                     ┌─────────────┤
                                     │ YES         │ NO
                                     ▼             ▼
                                  kickPower    ghostPower → cap
                                     │
                                     ▼
                               boost × morphMod
                                     │
                                     ▼
                             max(intensity, hit)
                                     │
                                     ▼
                               Smooth Fade
                                     │
                                     ▼
                                  OUTPUT
```

### 3.3 Estado Interno por Instancia

```typescript
interface LiquidEnvelopeState {
  intensity: number;       // Salida con decay aplicado
  avgSignal: number;       // EMA asimétrico de la señal
  avgSignalPeak: number;   // Peak con Tidal Gate decay
  lastFireTime: number;    // Timestamp del último disparo (Tidal Gate)
  lastSignal: number;      // Señal frame anterior (Velocity Gate)
  wasAttacking: boolean;   // Grace frame flag (Undertow)
}
```

---

## 4. TABLA DE COEFICIENTES — Las 7 Bandas

### 4.1 Frontales (Kick Territory)

| Parámetro      | Front L (SubBass) | Front R (Bass)    | Herencia God Mode |
|:--------------:|:-----------------:|:-----------------:|:-----------------:|
| **gateOn**     | 0.55              | **0.50**          | Bass=0.50 ✓       |
| **gateOff**    | 0.40              | **0.35**          | Bass=0.35 ✓       |
| **boost**      | 2.5               | **3.0**           | VITAMIN=3.0 ✓     |
| **crushExp**   | 1.5               | **1.5**           | God Mode ✓        |
| **decayBase**  | 0.55              | **0.60**          | God Mode ✓        |
| **decayRange** | 0.20              | **0.20**          | God Mode ✓        |
| **maxIntens**  | 0.85              | **0.80**          | FRONT_MAX ✓       |
| **squelchB**   | 0.25              | **0.20**          | God Mode ✓        |
| **squelchS**   | 0.80              | **0.80**          | God Mode ✓        |
| **ghostCap**   | 0.03              | **0.04**          | God Mode ✓        |
| **gateMargin** | 0.02              | **0.02**          | God Mode ✓        |

> **Front R (Bass) = clon EXACTO del God Mode actual.** Cero desviación.  
> **Front L (SubBass)** tiene gate +0.05 y squelch +0.05 porque la energía sub es más estable y necesita más filtrado anti-pad.

### 4.2 Traseros (Snare + Warmth)

| Parámetro      | Back L (LowMid)   | Back R (Mid)      | Herencia God Mode |
|:--------------:|:------------------:|:-----------------:|:-----------------:|
| **gateOn**     | 0.45               | **0.58**          | BACK_GATE_MAX ✓   |
| **gateOff**    | 0.30               | 0.18              | Dinámico ✓        |
| **boost**      | 2.0                | **2.0**           | SLAP_BASE ✓       |
| **crushExp**   | 1.8                | **2.0**           | God Mode ✓        |
| **decayBase**  | 0.70               | 0.65              | —                 |
| **decayRange** | 0.15               | 0.20              | —                 |
| **maxIntens**  | 0.65               | **1.0**           | Sin cap ✓         |
| **squelchB**   | 0.15               | 0.10              | —                 |
| **squelchS**   | 0.60               | 0.50              | —                 |
| **ghostCap**   | 0.06               | 0.03              | —                 |
| **gateMargin** | 0.02               | 0.02              | God Mode ✓        |

> **Back R (Mid) preserva la esencia del Snare Sniper** (gate 0.58, crush 2.0, slap base 2.0).  
> **Back L (LowMid) es NUEVA** — zona atmosférica con maxIntensity cappeado a 0.65 para que NUNCA compita con la protagonista. Ghost alto (0.06) para warmth persistente.

### 4.3 Movers (Sables de Luz)

| Parámetro      | Mover L (HighMid) | Mover R (Treble)  | Herencia God Mode |
|:--------------:|:------------------:|:-----------------:|:-----------------:|
| **gateOn**     | **0.20**           | **0.14**          | L=0.20, R=0.14 ✓  |
| **gateOff**    | 0.12               | 0.08              | —                 |
| **boost**      | **4.0**            | **8.0**           | L=4.0, R=8.0 ✓    |
| **crushExp**   | **1.2**            | **1.2**           | God Mode ✓        |
| **decayBase**  | 0.60               | 0.50              | —                 |
| **decayRange** | 0.15               | 0.20              | —                 |
| **maxIntens**  | 1.0                | 1.0               | Sin cap ✓          |
| **squelchB**   | 0.05               | 0.03              | —                 |
| **squelchS**   | 0.30               | 0.15              | —                 |
| **ghostCap**   | 0.05               | 0.04              | —                 |
| **gateMargin** | 0.01               | 0.01              | —                 |

> **Los movers son CLONES EXACTOS del God Mode** en gate, boost y crush.  
> La ÚNICA diferencia: ahora cada uno recibe su banda pura del GodEarFFT en vez de `mid - 30%*treble` / `treble - 20%*mid`. La sustracción cruzada se ELIMINA porque las bandas LR4 ya no tienen overlap.

### 4.4 Strobe (Binario)

| Parámetro          | Valor             | Herencia God Mode |
|:------------------:|:-----------------:|:-----------------:|
| **threshold**      | **0.80**          | STROBE_THRESHOLD ✓|
| **duration**       | **30ms**          | STROBE_DURATION ✓ |
| **noise discount** | **×0.80**         | God Mode ✓        |
| **trigger**        | treble > 0.80 OR (ultraAir > 0.70 AND treble > 0.60) | Expandido |

> Strobe no usa LiquidEnvelope — es disparo binario con duración fija.

---

## 5. SIDECHAIN — La Ley Absoluta

```
IF max(Front_L, Front_R) > 0.1:
    ducking = 1.0 - max(Front_L, Front_R) * 0.90
    Mover_L *= ducking
    Mover_R *= ducking
ELSE:
    IF harshness > 0.55 AND flatness > 0.55:  // APOCALIPSIS MODE
        chaos = max(mid, treble)
        Back_R = max(Back_R, chaos)
        Mover_L = max(Mover_L, chaos)
        Mover_R = max(Mover_R, chaos)
```

**Idéntico al God Mode.** El Back PAR sigue siendo LIBRE — el ducking solo aplasta movers.

---

## 6. MORPHFACTOR — Herencia Intacta

```typescript
// Cálculo IDÉNTICO al God Mode actual:
if (mid > avgMidProfiler) {
    avgMidProfiler = avgMidProfiler * 0.85 + mid * 0.15;  // Attack rápido
} else {
    avgMidProfiler = avgMidProfiler * 0.98 + mid * 0.02;  // Decay lento
}
morphFactor = clamp((avgMidProfiler - 0.30) / 0.40, 0.0, 1.0);
```

El morphFactor modula **TODAS** las instancias de LiquidEnvelope simultáneamente — decay, squelch, crushExponent y ghostCap escalan con morph. Esto preserva el comportamiento:
- **morph bajo** (Hard Techno): gates altos, squelch agresivo, decay corto → OSCURIDAD SELECTIVA
- **morph alto** (Melodic): gates bajos, squelch permisivo, decay largo → LUZ MELÓDICA

---

## 7. ELIMINACIÓN DE toLegacyFormat()

### Estado Actual (Cuello de Botella)

```
GodEarFFT → 7 bandas → toLegacyFormat() → 3 bandas legacy → TechnoStereoPhysics
                              ↓
                        PÉRDIDA DE DATOS:
                        - subBass se mezcla con bass (×0.5)
                        - highMid se mezcla con treble (×0.3)  
                        - ultraAir se mezcla con treble (×0.5)
                        - lowMid NO se usa
```

### Estado Propuesto (Zero Loss)

```
GodEarFFT → 7 bandas → LiquidStereoPhysics → 7 zonas independientes
                              ↓
                        SIN PÉRDIDA:
                        - Cada banda → su propia instancia LiquidEnvelope
                        - toLegacyFormat() solo se usa para SeleneLux legacy
```

---

## 8. RESULTADOS DE SIMULACIÓN

Ejecutado con `npx tsx scripts/liquid-stereo-sim.ts` — 300 frames por perfil, 30fps.

### 8.1 Matriz de Validación

| Perfil                        | God Avg | Liquid Avg | Ratio | Estado    |
|:-----------------------------:|:-------:|:----------:|:-----:|:---------:|
| Boris Brejcha (Hard Techno)   | 0.998   | 0.951      | 0.953 | ✅ PASS   |
| Rufus Du Sol (Melodic)        | 1.840   | 1.644      | 0.893 | ✅ PASS   |
| Cumbia Digital                | 1.989   | 1.984      | 0.997 | ✅ PASS   |

> **Criterio**: Ratio entre 0.85 y 1.20 = PASS. Los 3 perfiles cumplen.

### 8.2 Distribución por Banda — Boris Brejcha

| Zona      | Avg Output | Observación |
|:---------:|:----------:|:-----------:|
| SubBass   | 0.163      | Floor shaker activo en kicks |
| Bass      | 0.162      | Kick body — clon del God Mode |
| LowMid    | 0.000      | Correctamente oscuro (gate 0.45 > señal 0.20) |
| Mid       | 0.179      | Snare hits puntuales |
| HighMid   | 0.112      | Presencia con sidechain ducking |
| Treble    | 0.334      | Schwarzenegger Mode activo |

> **LowMid = 0 en Brejcha es CORRECTO.** Hard techno tiene mud zone vacía. La banda se activa solo en géneros con warmth (melódico, cumbia).

### 8.3 Distribución por Banda — Rufus Du Sol

| Zona      | Avg Output | Observación |
|:---------:|:----------:|:-----------:|
| SubBass   | 0.000      | Correcto — kicks melódicos no tienen sub fuerte |
| Bass      | 0.155      | Bass line suave |
| LowMid    | 0.196      | **NUEVA LUZ** — warmth de pads activo |
| Mid       | 0.465      | Voces dominan → luz protagonista |
| HighMid   | 0.372      | Presencia vocal alta |
| Treble    | 0.456      | Reverb tails capturados |

> **LowMid = 0.196 en Rufus es la VICTORIA clave.** Esta energía antes se PERDÍA. Ahora ilumina los pads atmosféricos con warmth independiente.

### 8.4 Distribución por Banda — Cumbia Digital

| Zona      | Avg Output | Observación |
|:---------:|:----------:|:-----------:|
| SubBass   | 0.000      | Tambora no tiene sub profundo |
| Bass      | 0.174      | Body de tambora |
| LowMid    | 0.202      | Bajo del acordeón |
| Mid       | 0.543      | **Acordeón DOMINA** — correcto |
| HighMid   | 0.504      | Presencia alta |
| Treble    | 0.561      | **Güira ritmo constante** |

> **Cumbia: ratio 0.997 = CASI IDÉNTICO al God Mode.** La güira en treble + acordeón en mid recrean la distribución del God Mode actual pero con 3 bandas extra de resolución.

---

## 9. PLAN DE IMPLEMENTACIÓN

### Fase 1: Crear `LiquidEnvelope.ts` (Nuevo Archivo)
- Clase pura con `process(signal, morphFactor, now, isBreakdown): number`
- Configurable vía `LiquidEnvelopeConfig`
- Estado aislado por instancia
- **Tests unitarios** con frames deterministas

### Fase 2: Crear `LiquidStereoPhysics.ts` (Nuevo Archivo)
- 6 instancias de `LiquidEnvelope` + 1 strobe binario
- Recibe `GodEarBands` directo (sin toLegacyFormat)
- Mismos `morphFactor`, `sidechain`, `recoveryFactor` que God Mode
- Output: `LiquidStereoResult` con 7 intensidades

### Fase 3: Integrar en `SeleneLux.ts`
- Switch entre `technoStereoPhysics.applyZones()` y `liquidStereoPhysics.applyBands()`
- Feature flag: `useLiquidStereo: boolean` en config

### Fase 4: Retirar toLegacyFormat del camino crítico
- `toLegacyFormat()` sigue existiendo para backward compat
- Pero la física ya no pasa por ella

### ⚠️ RESTRICCIÓN ABSOLUTA
- `TechnoStereoPhysics.ts` **NO SE TOCA**
- God Mode sigue vivo y funcional
- El Arquitecto puede revertir con un flip de flag

---

## 10. RIESGOS IDENTIFICADOS

| Riesgo | Mitigación |
|:------:|:----------:|
| 7 bandas = 7 fixtures consumiendo DMX channels | Documentado: máximo 7 universos. La laptop de 16GB puede con ello |
| LowMid ghost demasiado brillante en rock | `maxIntensity: 0.65` cap + `ghostCap: 0.06` moderado |
| SubBass pad leak (psytrance LFOs) | `squelchBase: 0.25` + `gateOn: 0.55` (más estricto que bass) |
| Energy split debilita la percepción total | Simulación prueba ratio 0.89-1.00 vs God Mode |
| morphFactor basado solo en mid | Futuro: agregar `spectralCentroid` como segundo eje de morph |

---

## 11. ARCHIVOS A CREAR (NO modificar ninguno existente)

```
src/hal/physics/LiquidEnvelope.ts          ← Abstracción core
src/hal/physics/LiquidStereoPhysics.ts     ← 7-band engine
src/hal/physics/__tests__/LiquidEnvelope.test.ts
src/hal/physics/__tests__/LiquidStereoPhysics.test.ts
```

---

*Blueprint generado por PunkOpus — WAVE 2401*  
*Simulación: 900 frames, 3 géneros, 0 modificaciones a código existente*  
*Timestamp: ${new Date().toISOString().slice(0, 10)}*
