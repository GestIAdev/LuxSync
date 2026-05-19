# WAVE 4913 — RELATIVE OFFSET ROUTING (IK + VMM FUSION BLUEPRINT)

> Tier: NOTIFY_OPUS_PRO_TIER / ARCHITECTURE_ENGINE
> Status: **DESIGN — NO PRODUCTION CODE YET**
> Depende de: WAVE 4912 (IK convergence stable) · WAVE 4700 (AetherKineticEngine L2) · WAVE 4631 (Split-Brain L0 classic / L2 spatial)
> Reemplaza: WAVE 4631 "L2 supremacy" gate (silenciamiento total del L0 cuando IK activo)

---

## 0. TL;DR

Hoy: **IK pisa al VMM** (override estático L2). El KineticAdapter L0 se silencia con `aetherKineticEngine.hasNode(nodeId)`.

Mañana: **IK = Centro de Gravedad** (`pan_base`/`tilt_base` en L2) y **VMM = Offset Orbital** (Δpan/Δtilt centrado en 0 en L0). El **NodeArbiter** suma por canal:

```
pan_final  = clamp01(IK_pan_base  + (VMM_pan_offset  * amplitudeScale * distanceScale))
tilt_final = clamp01(IK_tilt_base + (VMM_tilt_offset * amplitudeScale * distanceScale))
DMX_final  = clamp(0..255) ∘ (norm * 255)
```

El contrato relativo ya existe in-spirit en el comentario `AetherKineticEngine.ts:24` (`pan = pan_base + (L0.pan − 0.5)`). Esta wave lo **formaliza, generaliza al pipeline IK puro y agrega scaling, clamping y edge-case handling**.

---

## 1. Estado actual del flujo (post-WAVE 4912)

```
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND (KineticsBridge / SpatialTargetPad)                         │
│   ├─ Pattern manual    → IPC lux:aether:setManualPattern             │
│   └─ Spatial target    → IPC lux:aether:applySpatialTarget {x,y,z}   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ MAIN — AetherIPCHandlers.ts                                          │
│   ├─ setManualPattern  → aetherKineticEngine.setManualKinetics(…)    │
│   │                       (motor L2 nativo, escribe pan_base)        │
│   └─ applySpatialTarget→ solveGroupWithFan(profiles, target)         │
│                          → arbiter.setManualOverride('pan_base',pan) │
│                          → arbiter.setManualOverride('tilt_base',…)  │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (44Hz)
┌──────────────────────────────────────────────────────────────────────┐
│ AETHER TICK (TitanOrchestrator)                                      │
│   1. KineticAdapter.process()                                        │
│        ├─ if (aetherKineticEngine.hasNode(id)) return  ⛔ GATE       │
│        └─ else: emite pan/tilt absolutos L0 desde VMM                │
│   2. AetherKineticEngine.tick()                                      │
│        └─ escribe pan_base/tilt_base en L2 (orbita anchor)           │
│   3. NodeArbiter.arbitrate()                                         │
│        └─ pan_final = pan_base + (L0.pan − 0.5)  [SOLO si VMM viva]  │
│   4. NodeResolver.resolve() → DMX                                    │
└──────────────────────────────────────────────────────────────────────┘
```

**Problema:** Cuando IK puro corre, L0 está silenciado por gate. El "centro de gravedad" no orbita.

---

## 2. Arquitectura propuesta — Offset Routing

### 2.1 Punto de fusión: `NodeArbiter` (canónico)

La suma `BASE + OFFSET` se hace **por canal en el arbiter**, NO en el resolver ni en los adaptadores. Razones:

| Capa | ¿Por qué NO? | ¿Por qué SÍ? |
|---|---|---|
| `KineticAdapter` | No conoce L2/IK base. Romperíamos zero-alloc. | — |
| `AetherIPCHandlers` | Vive en main thread, fuera del hot path 44Hz. | — |
| `NodeResolver` | Es traductor norm→DMX. Mezclar L0/L2 ahí viola SRP. | — |
| **`NodeArbiter`** | — | **Ya es el merger oficial L0/L1/L2/L3.** Ya implementa HTP/LTP. Solo falta semántica `*_offset → +base`. |

### 2.2 Nuevos canales semánticos en L0

El KineticAdapter deja de emitir `pan`/`tilt` absolutos cuando hay IK activo. En su lugar emite:

```ts
// L0 priority=10, source='kinetic-adapter'
{
  pan_offset:  intent.x,   // [-1, +1] (centrado en 0)
  tilt_offset: intent.y,   // [-1, +1] (centrado en 0)
  speed:       intent.speed
}
```

L2 (IK + AetherKineticEngine) sigue emitiendo:

```ts
// L2 priority=80, source='ik-engine' | 'kinetic-engine-l2'
{
  pan_base:  panNorm,    // [0, 1] DMX center of gravity
  tilt_base: tiltNorm,   // [0, 1]
}
```

### 2.3 Reglas de merge en `NodeArbiter.arbitrate()`

```
Para cada nodeId:
  bp = L2.pan_base   ?? 0.5    // si no hay IK, centro neutro
  bt = L2.tilt_base  ?? 0.5
  ox = L0.pan_offset  ?? 0      // si no hay VMM, sin órbita
  oy = L0.tilt_offset ?? 0

  amp_pan  = node.config.relativeAmplitudePan   // [0..1] desde UI VMM scalars
  amp_tilt = node.config.relativeAmplitudeTilt
  dist_k   = node.spatialDistanceScale          // §3.2 — opcional, default 1

  out.pan  = clamp01(bp + ox * amp_pan  * dist_k * PAN_ASPECT_RATIO)
  out.tilt = clamp01(bt + oy * amp_tilt * dist_k)
```

`PAN_ASPECT_RATIO = 0.5` (270°/540°) — heredado de `AetherKineticEngine.ts:120` para que un círculo en la esfera sea círculo y no elipse pisada.

### 2.4 Fórmula de conversión `intent → DMX offset`

VMM emite `intent.x ∈ [-1,+1]`. Conversión a *offset DMX byte*:

```
offsetByte_pan  = intent.x * AMPLITUDE_PCT * 127 * PAN_ASPECT_RATIO
offsetByte_tilt = intent.y * AMPLITUDE_PCT * 127

DMX_pan_final  = clamp(0..255, round(IK_pan_byte  + offsetByte_pan))
DMX_tilt_final = clamp(0..255, round(IK_tilt_byte + offsetByte_tilt))
```

Donde `AMPLITUDE_PCT ∈ [0,1]` viene del slider de Amplitude del Programmer (ya existe en `aetherKineticEngine.amplitude` — se promociona a multiplicador del offset relativo).

> **Equivalencia con norm-space:** el merge se hace SIEMPRE en normalizado [0,1] dentro del arbiter. La traducción a DMX byte y el clamp 0–255 final ocurre en `NodeResolver._writeNode()` como hoy, con el mismo `sanitizeDmxByte`. **Doble-clamp explícito**: arbiter clamp01, resolver clamp 0–255 — ambos se mantienen.

### 2.5 Control de Amplitud (Scale)

| Origen | Default | Rango | Granularidad |
|---|---|---|---|
| `aetherKineticEngine.amplitude` (UI: slider Amplitude) | 0.5 | [0,1] | Global (todos los fixtures bajo motor L2) |
| `relativeAmplitudePan / Tilt` (futuro) | 1.0 | [0,1.5] | Por-fixture (override desde Cathedral) |
| `dist_k` distance scale | 1.0 | [0.25, 2.0] | Auto-derivado §3.2 |

El producto `amp * dist_k * aspect` se pre-computa en `setManualKinetics()` y `_updateScalars()` (ya patch-time) → zero-alloc en hot path.

### 2.6 Estrategia de clamping (defense in depth)

```
Layer 1 — Adapter:   clamp01(intent.x ∈ [-1,+1] preservado tal cual)
Layer 2 — Arbiter:   clamp01(base + offset)        ← previene wraparound DMX
Layer 3 — Resolver:  clamp(0..255) en sanitizeDmxByte()
Layer 4 — Safety:    AetherSafetyMiddleware.applyAirbag() y clampKineticVelocity()
```

Ningún canal puede emitir un DMX fuera de `[0, constraints.maxValue]`. El velocity clamp del Safety Middleware sigue activo (importante: la suma puede generar saltos > velocidad permitida).

---

## 3. Edge cases físicos

### 3.1 Gimbal Lock — IK Tilt = 127.5 (haz al cenit/nadir)

**Escenario:** Ceiling-mounted moving head con `targetY ≈ posY_fixture` (objetivo justo debajo del pivote). El IK resuelve `tiltDMX ≈ 127.5` y `panDMX` indeterminado (cualquier pan apunta al mismo punto en el suelo).

**Comportamiento del motor actual:**
- `solve()` en `InverseKinematicsEngine.ts` retorna `panDMX = atan2(local.x, local.z) → 0/0` indefinido. El IK actual usa el `currentPanDMX` previo como hint para preservar continuidad (anti-flicker).
- **Resultado físico:** el haz apunta vertical y el pan offset relativo del VMM **no produce desplazamiento angular visible** del beam (rota la carcasa pero el haz sigue cenital).

**Propuesta de manejo:**

```
if (abs(tiltDMX_ik - 127.5) < GIMBAL_TILT_EPSILON_DMX) {  // ε ≈ 3 DMX → ~3°
  // Soft-fade del pan_offset: cerca del cenit, el offset visual es nulo,
  // así que escalar a 0 evita rotación parásita del yoke ("spinning hat").
  effective_pan_offset = pan_offset * tiltVisibilityFactor(tiltDMX_ik)
  // tilt_offset queda intacto — sigue moviendo al haz fuera del cenit
}

tiltVisibilityFactor(t) = clamp01( |t - 127.5| / GIMBAL_TILT_FADE_DMX )
                          // 0 en cenit exacto, 1 a >10 DMX del cenit
```

Esto **no soluciona el gimbal-lock matemático** (no se puede), pero evita el efecto cosmético de un yoke girando salvajemente cuando el haz no se mueve. Documentar en `docs/ik-edge-cases.md`.

### 3.2 Perspectiva de tiro (distance scaling)

**Problema:** Un offset DMX fijo de 10 unidades equivale a:
- ~14° de pan (en fixture con `panRange = 540°`).
- A **2 m** del haz: arco visual de ~50 cm.
- A **20 m** del haz: arco visual de ~5 m.

→ El mismo "círculo VMM" se ve enorme en fixtures lejanos al target y minúsculo en los cercanos. Romped la coherencia visual del patrón.

**Modelo propuesto (lineal simple — base teórica para iterar):**

```
distance_to_target = ||fixture.physicalPosition - target||
d_ref              = 8.0  // metros — distancia "de diseño"
dist_k             = clamp(d_ref / distance_to_target, 0.25, 2.0)
```

Comportamiento:
- A 8 m → `dist_k = 1.0` (offset nominal).
- A 16 m → `dist_k = 0.5` (offset DMX se reduce a la mitad → arco angular menor → arco visual ≈ constante).
- A 4 m  → `dist_k = 2.0` (offset DMX se duplica).

**Limitaciones documentadas (post-MVP):**

1. Modelo lineal asume **1° pan ≈ k·offsetDMX**, lo cual es cierto solo a tilts moderados. A tilts cercanos al cenit (§3.1) el ángulo subtendido degenera.
2. La proyección **trigonométrica correcta** es:
   ```
   arco_lineal_visual = distance * tan(Δangle_rad)
   ```
   Para mantener `arco_lineal_visual` constante:
   ```
   Δangle_rad = atan(arco_objetivo / distance)
   offsetDMX  = Δangle_rad * (255 / panRangeRad)
   ```
   Esto se pospone a WAVE 4914+. Por ahora el modelo lineal es suficientemente correcto para distancias típicas de venue (4–25 m).

3. Cuando el target se mueve, `distance_to_target` cambia y `dist_k` se re-pre-computa. Hacer esto **en `applySpatialTarget` IPC handler** (patch-time, una vez por target update) — NO por frame.

---

## 4. Módulos afectados (cambios concretos, sin código aún)

| Módulo | Cambio | LOC | Riesgo |
|---|---|---|---|
| `core/aether/types.ts` | Añadir `pan_offset`, `tilt_offset` a channel name registry | ~5 | Bajo |
| `core/aether/adapters/KineticAdapter.ts` | Cambiar emit `pan`/`tilt` → `pan_offset`/`tilt_offset` cuando hay IK base presente. Detección: ¿el nodo tiene un `setManualOverride('pan_base')` activo? Cache patch-time. **Quitar el `hasNode` early-return absoluto** — convertirlo en flag de modo. | ~80 | Medio |
| `core/aether/AetherKineticEngine.ts` | Sigue escribiendo `pan_base`/`tilt_base`. Internamente ya hace `anchor + scaled` — esto se REEMPLAZA por solo escribir el anchor (la oscilación pasa al KineticAdapter relativo). **Refactor profundo del tick.** | ~150 | Alto |
| `core/aether/NodeArbiter.ts` | Añadir merge rule `*_offset + *_base → final` antes del clamp. Ver §2.3. | ~60 | Medio |
| `core/aether/AetherIPCHandlers.ts` | `applySpatialTarget` pre-computa `dist_k` por nodo y lo guarda en `node.spatialDistanceScale`. | ~30 | Bajo |
| `engine/movement/InverseKinematicsEngine.ts` | **Sin cambios.** `solve()` sigue retornando pan/tilt DMX absolutos. | 0 | — |
| `core/aether/resolver/NodeResolver.ts` | **Sin cambios.** Sigue siendo el traductor norm→DMX con clamp 0–255. | 0 | — |
| `core/orchestrator/TitanOrchestrator.ts` | Validar el orden de tick: IK→arbiter (L2 first, L0 ofcourse already L0). Documentar invariante. | ~10 | Bajo |
| `core/aether/__tests__/node-arbiter.test.ts` | Tests nuevos: base sin offset, offset sin base, base+offset, clamp boundary, gimbal fade. | ~200 | — |

---

## 5. Diagrama final (objetivo WAVE 4913)

```
                    ┌─────────────────────────────┐
                    │  IPC: applySpatialTarget     │
                    └──────────────┬──────────────┘
                                   │ (patch-time)
                                   ▼
                    ┌─────────────────────────────┐
                    │  IK solveGroupWithFan        │
                    │  → pan_base, tilt_base       │
                    │  → spatialDistanceScale      │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │ L2 priority=80     │                    │
              ▼                    ▼                    ▼
       ┌──────────────┐      ┌──────────┐       ┌──────────────┐
       │ NodeArbiter  │◄─────┤ Aether   │       │ KineticAdapter│
       │              │      │ Kinetic  │       │  (VMM)        │
       │  merge:      │      │ Engine   │       │  emite:       │
       │  base+offset │      │ (anchor) │       │   pan_offset  │
       │  *amp*dist   │      └──────────┘       │   tilt_offset │
       │  → clamp01   │                         │  L0 priority=10│
       │              │◄────────────────────────┤                │
       └──────┬───────┘                         └──────────────┘
              │
              ▼
       ┌──────────────┐         ┌──────────────────┐
       │ NodeResolver │ ──────► │ Safety Middleware │ ─► DMX 0–255
       └──────────────┘         └──────────────────┘
```

---

## 6. Definition of Done

- [ ] `KineticAdapter` emite `pan_offset`/`tilt_offset` ∈ [-1,+1] sin gate L2-supremacy.
- [ ] `NodeArbiter` ejecuta `clamp01(base + offset*amp*dist*aspect)` por canal.
- [ ] `applySpatialTarget` pre-computa `spatialDistanceScale` por fixture.
- [ ] Slider Amplitude del Programmer escala el offset relativo (no el base).
- [ ] Gimbal lock soft-fade activo a |tilt − 127.5| < ε.
- [ ] Clamp 0–255 garantizado en cuatro capas (Adapter, Arbiter, Resolver, Safety).
- [ ] Tests Vitest cubren: no-IK / no-VMM / IK+VMM / boundary clamp / gimbal fade / dist scaling.
- [ ] Comportamiento legacy (Split-Brain absoluto) preservable vía flag `__USE_LEGACY_SPLIT_BRAIN__` durante 1 release.
- [ ] Docs: `docs/ik-vmm-routing.md` con diagramas y referencias a este blueprint.

---

## 7. Notas para futuras waves

- **WAVE 4914** — Trigonometría no-lineal de `dist_k` (atan-based) para venues con depth > 15 m.
- **WAVE 4915** — VMM patterns con `radial`/`tangential` semantics (offset en coord. polares respecto al target, no cartesianas).
- **WAVE 4916** — Per-fixture relative amplitude curves (decoupling Programmer global vs Cathedral per-fixture).
- **WAVE 4917** — Telemetry overlay en Hyperion: visualizar `base`, `offset`, `final` por fixture en el visualizer 3D.

---

> _"El IK es el suelo, el VMM es el viento. El haz es la hoja: sigue el viento sin dejar de pertenecer al suelo."_
