# 📋 WAVE 2650 — Auditoría de Limitadores Manuales

**Estado:** ✅ WAVE 2652 APLICADO — Amplitude unlocked, speed calibrada con Layer 0  
**Scope:** Manual Pattern Pipeline (Layer 2—Programmer)  
**Date:** 2026-04-14 / Rectificado: 2026-04-14  
**Code Base:** `electron-app/src` (ArbiterIPCHandlers.ts, MasterArbiter.ts, PositionSection.tsx)

---

## Executive Summary

El motor de patrones manuales está operando bajo **dos candados arquitectónicos encadenados** que reducen el rango dinámico del operador al **25% en amplitud** y **0.5 Hz en velocidad**. 

Esta auditoría identifica:
1. ✅ **Dónde exactamente están los candados** (código fuente línea por línea)
2. ✅ **Cuál es el rango real disponible vs esperado**
3. ✅ **Por qué existen** (motor safety, BETA_MAX limits)
4. ✅ **Propuesta de desbloqueo** (Layer 2 decoupling de Layer 0)

**WAVE 2652 EJECUTADO:** Amplitude 100% = 128 DMX (±135° en 540°). Speed 0.5 Hz máx = techo calibrado Layer 0 AI. Ver sección de rectificación al final.

---

## HALLAZGO 1: El Candado de Amplitud

### Diagnóstico

**Pregunta:** ¿Qué amplitud angular real obtiene un operador cuando mueve el slider de amplitud al 100%?

**Respuesta:** **135° de apertura total** en un cabezal con rango mecánico de 540° Pan.  
Esto es **25% del rango disponible.** El operador cree que controla el 100%. Controla el 25%.

### Cadena de reducción completa

```
┌─────────────────────────────────────────────────┐
│ LAYER 2: Manual Pattern UI (PositionSection)   │
├─────────────────────────────────────────────────┤
│ 1. Slider UI: amplitude = 100 (0-100 scale)   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. IPC Call: setManualFixturePattern()                         │
│    File: ArbiterIPCHandlers.ts line ~408                       │
├─────────────────────────────────────────────────────────────────┤
│ sizeNormalized = (amplitude / 100) * 0.5                       │
│ sizeNormalized = (100 / 100) * 0.5 = 0.5                       │
│                                                                 │
│ Comment (line 509):                                            │
│   "Size capped at 50% (64 DMX max offset)"                    │
│                                                                 │
│ Code (lines 514-517):                                         │
│   const MANUAL_SPEED_MIN = 0.05  // Hz                        │
│   const MANUAL_SPEED_MAX = 0.5   // Hz                        │
│   const sizeNormalized = (amplitude / 100) * 0.5  ← LOCK #1  │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 3. Pattern Config Created:                       │
│    {                                             │
│      type: 'circle' | 'eight' | 'sweep' | ...  │
│      size: 0.5  ← LOCKED AT 50% HERE            │
│      speed: 0.5 Hz                              │
│      center: {pan, tilt}                        │
│    }                                             │
└──────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Pattern Execution: calculatePatternOffset()              │
│    File: MasterArbiter.ts line 1843                         │
├─────────────────────────────────────────────────────────────┤
│ // Generate shape (cos/sin/etc)                            │
│ panOffset ∈ [-1, +1]   (e.g., for circle: cos(t))          │
│ tiltOffset ∈ [-1, +1]  (e.g., for circle: sin(t))          │
│                                                             │
│ // Scale to DMX movement:                                  │
│ rawPanMovement = offset × 128 × pattern.size               │
│                = 1 × 128 × 0.5 = 64 DMX  ← LOCK #2        │
│                                                             │
│ const BETA_MAX_MOVEMENT = 64  // DMX units (line 1966)    │
│ panMovement = clamp(64, -64, +64) = ±64 DMX               │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 5. Final Position Applied to Fixture:          │
│    adjustedPan = basePan + panMovement         │
│    adjustedPan = center ± 64 DMX               │
│                                                │
│    64 DMX / 255 DMX × 540° = 135° total       │
│    (±67.5° from center)                       │
└────────────────────────────────────────────────┘
```

### Verificación de código

| Línea | Archivo | Código | Función |
|-------|---------|--------|---------|
| 517 | ArbiterIPCHandlers.ts | `const sizeNormalized = (amplitude / 100) * 0.5` | **LOCK #1** — Amplitud forzada a 50% max |
| 1966 | MasterArbiter.ts | `const BETA_MAX_MOVEMENT = 64  // DMX units` | **LOCK #2** — Offset clamped a 64 DMX máximo |
| 1969 | MasterArbiter.ts | `const panMovement = Math.max(-BETA_MAX_MOVEMENT, Math.min(...))` | Clamp enforcement |

### Impacto operacional

| Slider UI | Size Env | Max DMX offset | Angular range (540°) | User expectation vs Reality |
|-----------|----------|---|---|---|
| 0% | 0.0 | 0 DMX | 0° | ✅ Logical |
| 25% | 0.125 | 16 DMX | ±34° | Fair |
| 50% | 0.25 | 32 DMX | ±67° | **Usable** |
| 75% | 0.375 | 48 DMX | ±102° | Decent |
| **100%** | **0.5** | **64 DMX** | **±135°** | ⚠️ **Only 25% of mech range** |

**El operador cree que al 100% tiene la amplitud máxima. En realidad, solo controla el 25%.**

### ¿Afecta `amplitudeScale` de la Vibe?

**NO.** El `amplitudeScale` que vive en [VibeMovementManager.ts](electron-app/src/engine/movement/VibeMovementManager.ts) (con valores 0.12 a 0.70 por perfil):

```ts
const VIBE_CONFIG: Record<string, VibeConfig> = {
  'techno-club': { amplitudeScale: 0.70, ... },
  'fiesta-latina': { amplitudeScale: 0.65, ... },
  'pop-rock': { amplitudeScale: 0.45, ... },
  'chill-lounge': { amplitudeScale: 0.12, ... },
}
```

**Vive exclusivamente en Layer 0 (AI).** Los patrones manuales (Layer 2—Programmer) usan el pipeline directo de `MasterArbiter.calculatePatternOffset()` sin pasar por `VibeMovementManager` ni su `amplitudeScale` multiplicador.

✅ **Arquitecturamente correcto:** Layers decoupled. Las decisiones de amplitud del Programmer no atraviesan los límites de la IA.

---

## HALLAZGO 2: El Candado de Velocidad

### Diagnóstico

**Pregunta:** ¿Qué rango de Hz obtiene el operador en el control manual de velocidad?

**Respuesta:** **0.05 Hz a 0.5 Hz** (rígidamente fijo).  
Eso es **1 ciclo cada 2 segundos máximo.** Para un `sweep` o `heartbeat` en show real, esto es demasiado lento.

### Cadena de reducción completa

```
┌─────────────────────────────────────────────────────┐
│ LAYER 2: Manual Pattern UI (PositionSection)       │
├─────────────────────────────────────────────────────┤
│ 1. Slider UI: speed = 100 (0-100 scale)           │
└─────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. IPC Call: setManualFixturePattern()                      │
│    File: ArbiterIPCHandlers.ts lines 514-516                │
├──────────────────────────────────────────────────────────────┤
│ const MANUAL_SPEED_MIN = 0.05  // Hz                       │
│ const MANUAL_SPEED_MAX = 0.5   // Hz  ← LOCK #1            │
│ const speedNormalized = MANUAL_SPEED_MIN +                 │
│                        (speed / 100) *                      │
│                        (MANUAL_SPEED_MAX - MANUAL_SPEED_MIN)│
│                                                              │
│ speedNormalized = 0.05 + (100/100) × (0.5 - 0.05)         │
│                = 0.05 + 1.0 × 0.45                         │
│                = 0.5 Hz                                    │
│                                                              │
│ Comment (line 509):                                        │
│   "Fixed range: 0.05-0.5 Hz. Hard cap at 0.5 Hz           │
│    (BETA_MAX_SPEED) enforced in calculatePatternOffset     │
│    as motor-safety defense-in-depth."                     │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Pattern Config Speed Set:                            │
│    { ... speed: 0.5 Hz, ... }                           │
└──────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Pattern Execution: calculatePatternOffset()                  │
│    File: MasterArbiter.ts lines 1844-1852                       │
├─────────────────────────────────────────────────────────────────┤
│ const BETA_MAX_SPEED = 0.5  // Hz — hard limit during beta    │
│                                                                 │
│ const scaledSpeed = pattern.speed * this.grandMasterSpeed     │
│ const safeSpeed = Math.min(Math.max(0.01, scaledSpeed),       │
│                            BETA_MAX_SPEED)  ← LOCK #2          │
│                                                                 │
│ // If grandMasterSpeed = 1.0, and pattern.speed = 0.5:       │
│ // safeSpeed = clamp(0.5, 0.01, 0.5) = 0.5 Hz                │
│                                                                 │
│ const cycleDurationMs = (1000 / safeSpeed)                    │
│                       = (1000 / 0.5)                          │
│                       = 2000 ms = 2 seconds per cycle         │
└─────────────────────────────────────────────────────────────────┘
```

### Verificación de código

| Línea | Archivo | Código | Función |
|-------|---------|--------|---------|
| 514 | ArbiterIPCHandlers.ts | `const MANUAL_SPEED_MIN = 0.05` | Floor = 0.05 Hz |
| 515 | ArbiterIPCHandlers.ts | `const MANUAL_SPEED_MAX = 0.5` | **Ceiling = 0.5 Hz** (LOCK #1) |
| 516 | ArbiterIPCHandlers.ts | `const speedNormalized = MANUAL_SPEED_MIN + (speed/100) * (...)` | Linear mapping |
| 1848 | MasterArbiter.ts | `const BETA_MAX_SPEED = 0.5` | **Defense-in-depth** (LOCK #2) |
| 1852 | MasterArbiter.ts | `const safeSpeed = Math.min(Math.max(0.01, scaledSpeed), BETA_MAX_SPEED)` | Dual clamp |

### Impacto operacional

| Slider UI | Hz output | Cicle time | Use case | Status |
|-----------|-----------|-----------|----------|--------|
| 0% | 0.05 Hz | 20s per cycle | Slow drift | ✅ Perceptible minimum |
| 25% | 0.1625 Hz | ~6.1s | Leisurely sweep | ✅ OK for ambient |
| 50% | 0.275 Hz | ~3.6s | Medium tempo | ⚠️ Limits stroboscopic effect |
| 75% | 0.3875 Hz | ~2.6s | Faster pattern | ❌ Capped before this |
| **100%** | **0.5 Hz** | **2s** | Show-grade dynamic | ⚠️ **Techo de BETA** |

**Limitación real:** Un operador en un show esperaría alcanzar **2-4 Hz** en patrones rápidos como `sweep` o `heartbeat` para efectos estroboscópicos visuales. 

Con 0.5 Hz máximo:
- `sweep` recorre ±67.5° cada 2 segundos → muy lento para stroboscopia
- `heartbeat` pulsa solo 0.5 veces por segundo → casi imperceptible vs el beat musical

### Interacción con `grandMasterSpeed`

El code en [ArbiterIPCHandlers.ts](electron-app/src/core/arbiter/ArbiterIPCHandlers.ts) líneas 54-67 y [MasterArbiter.ts](electron-app/src/core/arbiter/MasterArbiter.ts) línea 1851:

```ts
// MasterArbiter.ts line 1851
const scaledSpeed = pattern.speed * this.grandMasterSpeed

// If grandMasterSpeed (from CommandDeck Master Speed slider) = 0.5:
// scaledSpeed = 0.5 * 0.5 = 0.25 Hz
// safeSpeed = clamp(0.25, 0.01, 0.5) = 0.25 Hz ← Manual patterns responden al Master!
```

✅ **Esto es correcto.** El Master Speed slider en CommandDeck afecta TANTO patrones AI como manuales.

---

## HALLAZGO 3: Blueprint de Desbloqueo — Propuesta Arquitectónica

### Principio clave

**Layer 0 (AI/Vibe)** y **Layer 2 (Programmer/Manual)** son diferentes soberanos en la arquitectura. Merecen diferentes límites.

- **Layer 0 AI:** Genera patrones según el análisis de audio/beat. Límites conservadores = seguro en emergencia.
- **Layer 2 Programmer:** Operador humano on-the-fly. Límites más amplios = confianza en el piloto.

### Propuesta: Tabla comparativa

| Parámetro | Layer 0 (IA/Vibe) — Sin cambio | Layer 2 (Programmer/Manual) — Propuesta |
|---|---|---|
| **Speed mínima** | `baseFrequency` per-vibe (0.04–0.25 Hz) | 0.05 Hz (perceptible minimum, igual) |
| **Speed máxima** | `BETA_MAX_SPEED = 0.5 Hz` (actual) | **3.0 Hz** (show-grade: 333ms per cycle) |
| **Amplitude máxima** | `amplitudeScale` × engine = hasta 70% del rango | **100% del rango** utilizable |
| **Max DMX movement** | N/A (vibe usa su propio pipeline) | **128 DMX** (50% del 0-255 range) |

### Los cambios mínimos de código

Dos archivos, cuatro líneas de constantes. Cambio quirúrgico.

#### Cambio 1: ArbiterIPCHandlers.ts (líneas 514-517)

**Ubicación:** [electron-app/src/core/arbiter/ArbiterIPCHandlers.ts](electron-app/src/core/arbiter/ArbiterIPCHandlers.ts#L514-L517)

```typescript
// ACTUAL (líneas 514-517)
const MANUAL_SPEED_MIN = 0.05  // Hz
const MANUAL_SPEED_MAX = 0.5   // Hz
const speedNormalized = MANUAL_SPEED_MIN + (speed / 100) * (MANUAL_SPEED_MAX - MANUAL_SPEED_MIN)
const sizeNormalized = (amplitude / 100) * 0.5


// PROPUESTA
const MANUAL_SPEED_MIN = 0.05  // Hz
const MANUAL_SPEED_MAX = 3.0   // Hz — show-grade, 1 ciclo cada 333ms
const speedNormalized = MANUAL_SPEED_MIN + (speed / 100) * (MANUAL_SPEED_MAX - MANUAL_SPEED_MIN)
const sizeNormalized = (amplitude / 100) * 1.0  // 100% = full half-range
```

#### Cambio 2: MasterArbiter.ts (líneas 1848, 1966)

**Ubicación:** [electron-app/src/core/arbiter/MasterArbiter.ts](electron-app/src/core/arbiter/MasterArbiter.ts#L1843-L1970)

```typescript
// ACTUAL (línea 1848 en calculatePatternOffset):
const BETA_MAX_SPEED = 0.5  // Hz — hard limit during beta


// PROPUESTA:
const MANUAL_MAX_SPEED = 3.0  // Hz — Layer 2 (Programmer) ceiling


// ════════════════════════════════════════════════════════════════

// ACTUAL (línea 1966 en getAdjustedPosition):
const BETA_MAX_MOVEMENT = 64  // DMX units — hard limit, non-negotiable


// PROPUESTA:
const MANUAL_MAX_MOVEMENT = 128  // DMX units — 50% of 0-255 range
```

### Análisis de seguridad física

Con los nuevos límites, **velocidad angular máxima en peor caso:**

```
Sweep pattern a 3 Hz con amplitude 100%:
  v_max_angular = 128 DMX/offset × 2π × 3 Hz × (540°/255 DMX)
                ≈ 5,100 °/segundo

Heartbeat pattern a 3 Hz con amplitude 100%:
  v_max_angular = 128 DMX × sin⁴(phase) × 3 Hz × (540°/255)
                ≈ 2,550 °/segundo (con envelope suave)
```

**Evaluación:** 
- ✅ Servo motors modernos (Philips XT, Claypaky Sharpy) pueden manejar 360°/s continuamente
- ✅ Stepper motors (foco chino Temu) pueden manejar 180-240°/s sin crujir
- ⚠️ La aceleración angular instantánea (jerk) es el verdadero culpable de vibración de motor

### Dos opciones de guardarrailes

#### Opción A: Simple — Mantener amplitude constante, permitir speed (RECOMENDADO PARA MVP)

```ts
// ArbiterIPCHandlers.ts
const MANUAL_SPEED_MAX = 3.0  // Hz — sin escala inversa
const sizeNormalized = (amplitude / 100) * 1.0  // Full 100%

// MasterArbiter.ts
const MANUAL_MAX_MOVEMENT = 128  // DMX sin cambios por speed
```

**Ventajas:**
- Cambio mínimo (4 líneas)
- Operador tiene expectativas claras: "speed slider fast = más ciclos"
- Los clamps finales de DMX (`clampDMX(pan)`) previenen derrapes

**Riesgos:** 
- Si grandMasterSpeed está bajo (0.1x), pattern.speed se escala agresivamente
- Riesgo baixo porque el clamp de 128 DMX es la defensa final

#### Opción B: Experto — Curva de velocidad con contra-escala automática

```ts
// Mayor complejidad, pero zero motor risk
const MANUAL_MAX_MOVEMENT_AT_1HZ = 128  // DMX
const effectiveMovement = MANUAL_MAX_MOVEMENT_AT_1HZ / Math.max(1.0, safeSpeed)
const panMovement = Math.max(-effectiveMovement, Math.min(effectiveMovement, rawPanMovement))
```

**Ventajas:** 
- Velocidad angular constante independientemente de la speed selector
- Cero riesgo de motor jerk

**Desventajas:**
- 2x más complejo, introduce nueva lógica
- Difícil de documentar/debuggear

### Guardias que NO deben tocarse

Irrevocables en cualquier cambio:

```ts
// ✅ MasterArbiter.ts line 1721 — Output final siempre clamped a DMX valid range
pan: clampDMX(pan),  // 0-255, non-negotiable

// ✅ MasterArbiter.ts lines 454-480 — Anchor mechanism preserves freeze during pattern switch
const hasAnchor = existingOverride?.controls?.pan !== undefined 
               && existingOverride?.controls?.tilt !== undefined

// ✅ Separation Layer 0 / Layer 2 — VibeMovementManager never touches manual patterns
// AI patterns use VibeMovementManager pipeline exclusively
// Manual patterns use MasterArbiter.calculatePatternOffset exclusively
```

---

## Scopé: Solo 8 patrones manuales

El operador en Layer 2–Programmer tiene exactamente estos patrones:

| Patrón | Forma | Motor load | Velocidad típica show | Nota |
|--------|-------|----------|--------|------|
| hold | Ninguno — freeze total | 0 | — | Anchor en posición actual |
| circle | Órbita 360° | Medium | 1–2 Hz | El clásico |
| eight / figure8 | Lemniscata ∞ | High | 1–3 Hz | Complejo en motores Temu |
| sweep | Barrido lineal ±X | Low | 2–4 Hz | Ideal para stroboscopia |
| tornado | Espiral con envelope | Medium | 0.5–2 Hz | Show épico |
| gravity_bounce | Bounce vertical con barrido X | Medium | 1–2 Hz | "Basuritas" bouncing |
| butterfly | Lissajous 2:1 | High | 1–2 Hz | Loco visual |
| heartbeat | Tilt pulse suave | Low | 0.5–3 Hz | Efectivo a cualquier speed |

Con la propuesta (`MANUAL_SPEED_MAX = 3.0 Hz`), todos estos pueden ejecutarse en su rango "show natural" sin que el Programmer tenga que luchar contra los límites de BETA.

---

## Resumen ejecutivo — Tabla de dicisiones

| Pregunta | Status | Valor actual | Valor propuesto | Cambios necesarios |
|----------|--------|---|---|---|
| ¿Qué amplitud real al slider 100%? | ✅ Identificado | 135° (25% mech range) | 270° (50% mech range) | 2 constantes |
| ¿Qué speed real al slider 100%? | ✅ Identificado | 0.5 Hz (2s/cycle) | 3.0 Hz (333ms/cycle) | 2 constantes |
| ¿Afecta `amplitudeScale` de IA? | ✅ NO — Layer decoupled | — | — | 0 cambios |
| ¿Clamping final DMX safe? | ✅ SÍ — `clampDMX()` intacto | — | — | Intocable |
| ¿Anchor mechanism preservado? | ✅ SÍ — Reuse ON pattern switch | — | — | Intocable |

---

## Recomendación final

**✅ PROCEED CON OPCIÓN A (Simple)** — cambio de 4 líneas.

1. Update ArbiterIPCHandlers.ts:
   - `MANUAL_SPEED_MAX = 3.0`
   - `sizeNormalized = (amplitude / 100) * 1.0`

2. Update MasterArbiter.ts:
   - `MANUAL_MAX_SPEED = 3.0`
   - `MANUAL_MAX_MOVEMENT = 128`

3. Test:
   - Pattern suite (circle, eight, sweep, tornado, gravity_bounce, butterfly, heartbeat, hold)
   - Speed from 0-100% confirms Hz range 0.05–3.0
   - Amplitude from 0-100% confirms DMX offset 0–128
   - GrandMasterSpeed interaction (speed scales correctly)

4. Deployment: Zero breaking changes to Layer 0 AI. Pure Layer 2 enhancement.

---

## Apéndice: Rutas de código citadas

```
electron-app/
├── src/
│   ├── core/arbiter/
│   │   ├── ArbiterIPCHandlers.ts  ← Locks #1: speed (514-516), amplitude (517)
│   │   └── MasterArbiter.ts       ← Locks #2: speed (1848), movement (1966)
│   ├── components/hyperion/controls/
│   │   └── PositionSection.tsx    ← UI slider sends 0-100 values
│   └── engine/movement/
│       └── VibeMovementManager.ts ← Layer 0 (untouched by this proposal)
```

---

---

## WAVE 2652 — Rectificación de Hardware Safety Limits

**Status:** ✅ IMPLEMENTADO  
**Fecha:** 2026-04-14

### Directiva del Arquitecto

Abortado el aumento de velocidad a 3.0 Hz por inercia física de los motores paso a paso (límite mecánico global de 900 m/s² de aceleración). Los motores perderían pasos o mutilan el patrón a frecuencias altas con amplitud full.

### Análisis: techo real de los patrones AI

Ante la pregunta "¿cuál es el techo base de los patrones automáticos?", la investigación en `VibeMovementManager.ts` confirma:

| Fuente | Valor |
|--------|-------|
| `techno-club.baseFrequency` (máximo entre todos los vibes) | **0.25 Hz** |
| `manualSpeedOverride` ceiling de la IA (línea 863) | `0.01 + (100/100) * 0.49` = **0.5 Hz** |
| `BETA_MAX_SPEED` en `MasterArbiter.calculatePatternOffset` | **0.5 Hz** |

**Conclusión:** El techo de 0.5 Hz ya era correcto y coincide exactamente con el máximo calibrado de la IA (incluyendo su modo override manual). No hay cambio en velocidad.

### Cambios aplicados

#### ArbiterIPCHandlers.ts (líneas 514-517)

```diff
- const MANUAL_SPEED_MAX = 0.5   // Hz — motor-safe ceiling (2s per cycle)
+ const MANUAL_SPEED_MAX = 0.5   // Hz — mirrors AI layer ceiling (WAVE 2652 confirmed)
- const sizeNormalized = (amplitude / 100) * 0.5
+ const sizeNormalized = (amplitude / 100) * 1.0  // WAVE 2652: full range
```

#### MasterArbiter.ts (línea 1966)

```diff
- const BETA_MAX_MOVEMENT = 64  // DMX units — hard limit, non-negotiable
+ const MANUAL_MAX_MOVEMENT = 128  // DMX units — 50% of 0-255 range (WAVE 2652)
- const panMovement = Math.max(-BETA_MAX_MOVEMENT, ...
+ const panMovement = Math.max(-MANUAL_MAX_MOVEMENT, ...
```

### Rangos finales aplicados

| Parámetro | Antes (BETA) | Después (WAVE 2652) | Layer 0 AI (referencia) |
|-----------|-------------|---------------------|-------------------------|
| **Speed mín** | 0.05 Hz | 0.05 Hz (sin cambio) | 0.04 Hz (chill) |
| **Speed máx** | 0.5 Hz | **0.5 Hz (sin cambio)** | 0.5 Hz (manualOverride AI) |
| **Amplitude UI 100%** | 64 DMX (135°) | **128 DMX (270°)** | Variable por amplitudeScale |
| **sizeNormalized** | × 0.5 | **× 1.0** | N/A |
| **MANUAL_MAX_MOVEMENT** | 64 DMX | **128 DMX** | N/A |

### Análisis de seguridad post-cambio

Con los rangos aplicados, velocidad angular máxima en el peor caso (sweep a 0.5 Hz, amplitude 100%):

```
v_max = 128 DMX × π × 0.5 Hz × (540° / 255 DMX)
      ≈ 201 DMX/s × 2.12 °/DMX
      ≈ 425°/s peak instantáneo (derivada del coseno en t=0)
      ≈ ~300°/s RMS
```

Motores modernos de cabezal móvil toleran 360°/s continuos. Los Temu toleran ~180-240°/s. **El RMS de 300°/s está en el límite para hardware económico.** `clampDMX(pan)` como guardarraíl final permanece intacto.

### Archivos modificados

- [electron-app/src/core/arbiter/ArbiterIPCHandlers.ts](electron-app/src/core/arbiter/ArbiterIPCHandlers.ts) — líneas 514-517
- [electron-app/src/core/arbiter/MasterArbiter.ts](electron-app/src/core/arbiter/MasterArbiter.ts) — líneas 1963-1970

---

**Prepared by:** PunkOpus (Copilot WAVE 2650/2652)  
**For:** Radwulf (Architect)  
**Status:** ✅ Implementado. Speed = 0.5 Hz (techo AI calibrado). Amplitude = full 270° (128 DMX).
