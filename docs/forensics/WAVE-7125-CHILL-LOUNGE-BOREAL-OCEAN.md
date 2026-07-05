# WAVE 7125 — Chill-Lounge Forensics & "Boreal Ocean" Rebuild

**Autor:** Chief FX Architect & Lighting Designer  
**Fecha:** 2026-07-03  
**Operación:** WAVE 7125  
**Proyecto:** LuxSync — Aether Engine (V3 Vibes)

---

## 1. AUDITORÍA FORENSE DEL ESCALONAMIENTO

### 1.1 Archivos auditados

| Archivo | Rol |
|---|---|
| `src/core/arsenal/builtins/chill-lounge/surface_shimmer.lfx` | Clip .lfx V3 — efecto "Surface Shimmer" |
| `src/core/arsenal/builtins/chill/solar_caustics.lfx` | Clip .lfx V3 — efecto "Solar Caustics" |
| `src/engine/vibe/profiles/ChillLoungeProfile.ts` | VibeProfile — restricciones de color, dimmer, movimiento |
| `src/engine/movement/VibeMovementManager.ts` | VMM — avance de fase cinética atado a BPM |
| `src/hal/physics/ChillAmbientEngine.ts` | Motor ambient stateless (WAVE 6055) |
| `src/hal/physics/profiles/chilllounge.ts` | Perfil Omniliquid — envelopes, decays, ghostCaps |
| `src/engine/movement/VibeMovementPresets.ts` | Presets de física por vibe (friction, velocity, acceleration) |
| `src/core/hephaestus/runtime/HephaestusRuntime.ts` | Runtime — evaluación de curvas .lfx |
| `src/core/hephaestus/CurveEvaluator.ts` | Evaluador de keyframes + interpolación |

### 1.2 Causa raíz del escalonamiento

Se identificaron **tres causas convergentes** que producen los cambios a saltos:

#### CAUSA 1: Interpolación `hold` en keyframe final de los clips .lfx existentes

**Archivo:** `surface_shimmer.lfx:62-65` y `solar_caustics.lfx:130-134`

```json
{
  "timeMs": 8000,
  "value": 0,
  "interpolation": "hold"
}
```

El último keyframe de ambos clips usa `interpolation: "hold"`. En `CurveEvaluator.ts:547-550`, la interpolación `hold` es una **step function** que retorna `0`:

```typescript
case 'hold':
  // Step function: valor constante hasta el siguiente keyframe.
  return 0
```

Esto significa que cuando el playhead cruza el penúltimo keyframe, el valor **salta instantáneamente** al del último keyframe sin transición. En `surface_shimmer.lfx`, el salto es de `value: 1` (en `timeMs: 4000`) a `value: 0` (en `timeMs: 8000`) con `hold` — el dimmer se desploma de 1 a 0 en un solo frame.

**Impacto visual:** Apagón abrupto al final del ciclo del clip en lugar de un fundido suave.

#### CAUSA 2: `durationMs` corto + reinicio del ciclo

**Archivo:** `surface_shimmer.lfx:20` → `durationMs: 8000`  
**Archivo:** `solar_caustics.lfx:20` → `durationMs: 10000`

Ambos clips tienen duraciones de 8-10 segundos. Cuando el clip se reproduce en loop (`isOneShot: false`), el ciclo se reinicia cada 8-10 segundos. El reinicio provoca un salto desde el estado final (intensity=0 con `hold`) de vuelta al estado inicial (intensity=0 con bezier subiendo a 1). Aunque ambos extremos son 0, la **pendiente** cambia abruptamente de plana (hold) a ascendente (bezier), creando un escalón visible en la derivada.

Con `durationMs: 8000`, el clip completa 7.5 ciclos por minuto. Cada ciclo tiene un salto → 7.5 saltos por minuto visibles.

#### CAUSA 3: VMM atado a BPM inestable para movimiento de movers

**Archivo:** `VibeMovementManager.ts:998-1004`

```typescript
const beatsPerSecond = this.smoothedBPM / 60
const beatsThisFrame = beatsPerSecond * frameDeltaTime
const chillSedationFactor = vibeId === 'chill-lounge' ? 0.80 : 1.0
const effectiveBeats = beatsThisFrame * this.globalSpeedMultiplier * manualSpeedFactor * chillSedationFactor
```

El avance de fase de los patrones cinéticos (`drift`, `sway`, `breath`) está atado a `smoothedBPM`. Aunque existe un `chillSedationFactor = 0.80` que reduce la velocidad, **no la desacopla del BPM**. En chill-lounge:

- `ChillLoungeProfile.ts:112-115` define `bpmHint: { min: 60, max: 110 }`
- `ChillLoungeProfile.ts:93-96` define `speedRange: { min: 0.025, max: 0.08 }` (40s a 12.5s por ciclo)

Pero el VMM usa `smoothedBPM` (que viene del detector de BPM del audio) para calcular `beatsThisFrame`. Si el audio no tiene un BPM claro (silencio, ambient, charla), el detector puede reportar BPM inestable (saltando entre 60 y 120), lo que hace que `effectiveBeats` fluctúe, produciendo **movimiento errático y a saltos** en los movers.

El `ChillAmbientEngine` (WAVE 6055) **ya está desacoplado** del BPM (usa `performance.now()` puro), pero solo controla morphFactor, dimmer zonal y Lissajous de movers. Los clips .lfx de Hephaestus se evalúan con `Date.now()` (vía `HephaestusRuntime.tick(now)` donde `now` viene de `TickEngine`), que es tiempo absoluto — **pero las curvas son cortas y usan `hold` al final**.

### 1.3 Resumen de causas

| # | Causa | Archivo | Línea |
|---|---|---|---|
| 1 | `interpolation: "hold"` en keyframe final | `surface_shimmer.lfx` | 64 |
| 2 | `durationMs: 8000` corto → reinicio brusco del ciclo | `surface_shimmer.lfx` | 20 |
| 3 | VMM cinético atado a `smoothedBPM` inestable | `VibeMovementManager.ts` | 998-1004 |

---

## 2. BLUEPRINT DE RECONSTRUCCIÓN — "Boreal Ocean"

### 2.1 Filosofía de diseño

**Boreal Ocean** es un efecto de respiración oceánica que cambia imperceptiblemente a lo largo de **20 minutos** (1,200,000 ms). Ningún fixture sube su intensidad al mismo tiempo que el de al lado. La sala entera es un océano asimétrico donde la luz se mueve como bioluminiscencia boreal.

### 2.2 Decisiones arquitectónicas

| Decisión | Valor | Justificación |
|---|---|---|
| `durationMs` | `1200000` (20 min) | Desconecta el efecto de cualquier reloj musical. Un solo ciclo cubre toda la sesión de cena. |
| Interpolación | `bezier` en **todos** los keyframes | Elimina `hold` completamente. Transiciones suaves sin escalones. |
| Bezier handles | `[0.42, 0, 0.58, 1]` (ease-in-out) | Curva suave simétrica. Sin overshoot, sin snap. Aceleración y desaceleración gradual. |
| `bpmRef` | **Eliminado** | El efecto no referencia BPM. Tiempo absoluto puro. |
| `loop` | `false` (one-shot de 20 min) | No hay reinicio de ciclo → no hay salto de derivada. |
| `mixBus` | `ambient` | HTP con otros efectos ambientales. No toma control total. |

### 2.3 Pistas (Tracks)

#### Track 1: Intensity (Dimmer)
- **Zona:** `all` (todos los fixtures)
- **BlendMode:** `max` (HTP — nunca apaga, solo suma)
- **Curva:** 5 keyframes en 20 minutos, oscilando entre 0.30 y 0.50
  - `0ms: 0.30` → `300s: 0.45` → `600s: 0.35` → `900s: 0.50` → `1200s: 0.30`
  - Respiración de 10 minutos por ciclo (sube en 5 min, baja en 5 min)
- **PhaseConfigPro:**
  - `spreadDeg: 1440` (4 ciclos completos de desfase → el último fixture empieza 80 minutos después del primero, pero con wrap continuo del loop se distribuye uniformemente)
  - `wings: 2` (la onda recorre la sala dos veces)
  - `shuffle: 0.5` (50% ordenado, 50% caótico → asimetría orgánica)
  - `shuffleSeed: 7777` (semilla fija para reproducibilidad)

#### Track 2: Color (HSL)
- **Zona:** `all`
- **BlendMode:** `replace` (LTP — takeover completo de color)
- **Curva:** 6 keyframes recorriendo la paleta Boreal Ocean:
  - `0ms: H210 S65 L30` — Deep Ocean Blue
  - `240s: H320 S55 L28` — Dark Magenta
  - `480s: H160 S50 L32` — Boreal Green
  - `720s: H280 S60 L25` — Deep Violet
  - `960s: H190 S70 L30` — Cyan Glacial
  - `1200s: H210 S65 L30` — Vuelta al Deep Ocean Blue
- **PhaseConfigPro:**
  - `spreadDeg: 720` (2 ciclos de desfase → 40 min de separación entre primer y último fixture)
  - `symmetry: "mirror"` (efecto espejo — los fixtures del centro comparten fase, los de los extremos están desfasados)
  - `shuffle: 0.3` (30% caos — más ordenado que intensity, el color cambia en oleadas)

#### Track 3: Pan (Movers)
- **Zona:** `all-movers`
- **BlendMode:** `replace`
- **Curva:** 4 keyframes, deriva horizontal imperceptible
  - `0ms: 0` → `400s: 0.3` → `800s: -0.25` → `1200s: 0`
- **PhaseConfigPro:**
  - `spreadDeg: 1440`, `wings: 2`, `shuffle: 0.5`, `direction: 1`
  - Cada mover barre a su propio ritmo, ningún par de movers se sincroniza

#### Track 4: Tilt (Movers)
- **Zona:** `all-movers`
- **BlendMode:** `replace`
- **Curva:** 5 keyframes, deriva vertical aún más sutil
  - `0ms: 0` → `350s: 0.15` → `700s: -0.10` → `1050s: 0.20` → `1200s: 0`
- **PhaseConfigPro:**
  - `spreadDeg: 1080` (3 ciclos de desfase)
  - `symmetry: "center-out"` (los movers del centro van primero, los de los extremos después)
  - `shuffle: 0.4`, `direction: -1` (dirección invertida respecto al pan → movimiento cruzado)

#### Track 5: Zoom (Movers)
- **Zona:** `all-movers`
- **BlendMode:** `replace`
- **Curva:** 3 keyframes, wash total que se cierra levemente
  - `0ms: 0.90` → `600s: 0.75` → `1200s: 0.90`
- Sin PhaseConfigPro (todos los movers comparten zoom — coherencia visual del wash)

### 2.4 Paleta Boreal Ocean

| Color | H | S | L | Momento |
|---|---|---|---|---|
| Deep Ocean Blue | 210° | 65% | 30% | Inicio y cierre |
| Dark Magenta | 320° | 55% | 28% | Min 4 (atardecer boreal) |
| Boreal Green | 160° | 50% | 32% | Min 8 (aurora boreal) |
| Deep Violet | 280° | 60% | 25% | Min 12 (abismo nocturno) |
| Cyan Glacial | 190° | 70% | 30% | Min 16 (amanecer glacial) |

### 2.5 Distribución de fase — Por qué 1440° + shuffle 0.5

Con `spreadDeg: 1440` y `durationMs: 1,200,000`:

- El offset máximo entre el primer y último fixture es: `(1440/360) × 1,200,000 = 4,800,000 ms` (80 minutos)
- Pero con `wings: 2`, la onda recorre el array dos veces, así que cada fixture tiene un offset efectivo dentro del ciclo de 20 min
- Con `shuffle: 0.5`, el 50% del offset es determinista (orden físico) y 50% es pseudo-aleatorio (hash(seed, index))
- Resultado: **ningún fixture sube su intensidad al mismo tiempo que el de al lado**. La sala entera respira de forma asimétrica, como un océano real donde las olas no llegan todas a la vez.

### 2.6 Archivo generado

**Ruta:** `src/core/arsenal/builtins/chill-lounge/boreal_ocean.lfx`

El archivo está listo para ser inyectado en el catálogo V3. Cumple con:
- `$schema: "luxsync.lfx/3.0"`
- `schemaVersion: "3.0"`
- Estructura `HephAutomationClipV3` completa
- `PhaseConfigPro` en tracks de intensity, color, pan y tilt
- Cero referencias a BPM (`bpmRef` eliminado)
- Cero interpolaciones `hold`
- Todas las curvas usan `bezier` con handles `[0.42, 0, 0.58, 1]` (ease-in-out suave)

---

## 3. NOTAS DE INTEGRACIÓN

### 3.1 Activación del clip

El clip debe activarse con `loop: true` para que la respiración sea eterna. A pesar de que `durationMs: 1200000` (20 min), el modo loop asegura que si la sesión se extiende, el ciclo se reinicie sin saltos (todos los keyframes usan bezier, no hold, por lo que el reinicio es continuo en la derivada).

```typescript
hephaestusRuntime.play(
  'src/core/arsenal/builtins/chill-lounge/boreal_ocean.lfx',
  { loop: true, intensity: 1.0 }
)
```

### 3.2 Compatibilidad con ChillAmbientEngine

El `ChillAmbientEngine` (WAVE 6055) ya controla morphFactor, dimmer zonal y Lissajous de movers con `performance.now()` puro. El clip Boreal Ocean **complementa** este motor:

- **ChillAmbientEngine** controla la marea zonal (offsets entre front/back) y el movimiento Lissajous de los movers
- **Boreal Ocean .lfx** controla el color (HSL), la intensidad global con phase distribution, y añade deriva pan/tilt adicional con phase distribution propia

Ambos convergen en el NodeArbiter: ChillAmbientEngine en layer `selene` (L0), Boreal Ocean en layer `effect` (L3). L3 domina L0 según el escudo anti-sangrado (WAVE 4829).

### 3.3 Recomendación futura: Desacoplar VMM de BPM para chill

El `chillSedationFactor = 0.80` en `VibeMovementManager.ts:1000` es un parche parcial. Para eliminar completamente los saltos cinéticos en chill-lounge, se recomienda en una futura WAVE:

```typescript
// Propuesta: cuando vibeId === 'chill-lounge', usar performance.now() puro
// en lugar de beatsThisFrame para avanzar la fase
const phaseAdvance = vibeId === 'chill-lounge'
  ? frameDeltaTime * config.baseFrequency * 2 * Math.PI  // tiempo absoluto
  : effectiveBeats * phasePerBeat                         // tiempo musical
```

Esto desacoplaría completamente el movimiento de movers del BPM inestable, alineándolo con la filosofía del `ChillAmbientEngine`.

---

## 4. CHECKSUM

El archivo `boreal_ocean.lfx` no incluye campo `checksum` — el `LfxFileLoader` lo calculará automáticamente al cargarlo (WAVE 7003: serializador canónico V3).

---

**WAVE 7125 — Estado: COMPLETADO**
