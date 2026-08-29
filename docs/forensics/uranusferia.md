¡Vamos a cazar el jitter de Uranus! Modo auditoría activado. Déjame localizar el `SeleneColorEngine.ts` y las tres sospechosas.

Ahora déjame ver el `_generateUranus` path completo — cómo se calcula el primary hue, el secondary, y cómo se aplican:

Déjame leer el archivo de overflow para ver el resto de los matches y luego el bloque Uranus override:

Ahora déjame ver el bloque Uranus override para secondary/accent/ambient y cómo se aplica Pillar III:

Ahora déjame ver el bloque WAVE 7690 override (secondary/accent/ambient derivation) y dónde se llama `_evacuatePaletteRigid`:

Ahora déjame ver el bloque WAVE 7690 completo (líneas 2383-2430) para ver cómo se derivan secondary/accent/ambient:

Ahora tengo todo lo que necesito. Déjame ver también el `_rigidPsiEMA` alpha y el `GRAVITY_R_MIN` con más contexto, y verificar si hay algún EMA en el secondary/accent:

Tengo toda la imagen. Aquí está el reporte forense:

---

# 🔭 WAVE 7700: PROJECT URANUS — FORENSIC AUDIT REPORT
## "Feria Ambulante" Jitter Diagnosis

## SOSPECHOSA #1: Barycentric Damping (Pillar I — Gravity)

### Estado actual del EMA

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="1261-1286" />

```typescript
// Dual-rate architecture:
//   _slow* (α=0.005, τ≈4.5s) — key-level structure, drives primary hue
//   _fast* (α=0.15,  τ≈150ms) — chord-level reactivity, reserved for WAVE 7690
const GRAVITY_GAMMA = 3;
const GRAVITY_ALPHA_SLOW = 0.005;
const GRAVITY_ALPHA_FAST = 0.15;
const GRAVITY_R_MIN = 0.08;
```

### Veredicto: ✅ EL SLOW EMA ES CORRECTO

El slow accumulator (`α=0.005`, `τ≈4.5s`) es **extremadamente lento** — tarda 4.5 segundos en responder a un cambio armónico. Esto NO es la fuente del jitter del primary hue.

### ⚠️ PERO EL FAST EMA ES EL CULPABLE DEL ACCENT JITTER

El fast accumulator (`α=0.15`, `τ≈150ms`) alimenta el **accent color** directamente:

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2414-2420" />

```typescript
if (_gravityRFast > GRAVITY_R_MIN) {
  pal.accent.h = _gravityHueFast;   // ← ¡Sin EMA adicional! Directo al palette
} else {
  pal.accent.h = pal.primary.h;
}
```

**Problema:** `α=0.15` significa que el 15% del vector crudo entra cada frame (44Hz). Con un kick drum, el chroma vector salta rípidamente entre frames. El fast accumulator sigue el ruido percusivo, no la armonía. El accent hue puede rotar **30-60° dentro de un solo beat** (150ms = ~6.6 frames a 44Hz).

**Agravante:** `GRAVITY_R_MIN = 0.08` es **extremadamente bajo**. Cualquier contenido espectral (incluso ruido blanco) produce `R > 0.08`. El gate prácticamente nunca se activa — el accent siempre toma el fast hue ruidoso en vez de caer al primary estable.

### Propuesta

| Parámetro | Actual | Propuesto | Razón |
|-----------|--------|-----------|-------|
| `GRAVITY_ALPHA_FAST` | 0.15 (τ=150ms) | **0.04** (τ≈560ms) | 4x más lento — responde a cambios de acorde, no a transientes |
| `GRAVITY_R_MIN` (fast gate) | 0.08 | **0.25** | Solo aceptar accent cuando hay contenido tonal claro, no ruido percusivo |

---

## SOSPECHOSA #2: Secondary "Noise" Vector (Residual Mass)

### Estado actual

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="2440-2462" />

```typescript
let dominantIdx = 0;
let dominantC = 0;
for (let i = 0; i < 12; i++) {
  if (_chromaMirror[i] > dominantC) {
    dominantC = _chromaMirror[i];
    dominantIdx = i;
  }
}
const dominantW = Math.pow(dominantC, GRAVITY_GAMMA);
let resMx = _slowMx - dominantW * COS_THETA[dominantIdx];
let resMy = _slowMy - dominantW * SIN_THETA[dominantIdx];

const resMag = Math.sqrt(resMx * resMx + resMy * resMy);
if (resMag > 0.001) {                                    // ← ¡UMBRAL CASI CERO!
  const resHueRaw = (Math.atan2(resMy, resMx) * 180 / Math.PI + 360) % 360;
  pal.secondary.h = (resHueRaw + Phi + 360000) % 360;    // ← ¡SIN EMA!
} else {
  pal.secondary.h = (pal.primary.h + 30) % 360;
}
```

### Veredicto: 🔴 CULPABLE PRINCIPAL DEL JITTER DE LA FERIA

**Tres problemas críticos:**

1. **`resMag > 0.001` es un umbral absurdamente bajo.** Con `γ=3`, incluso un chroma de 0.1 produce `w = 0.001`. Cualquier micro-ruido espectral supera este umbral. El residual casi nunca cae al fallback `+30°`.

2. **El residual se calcula del `_slowMx/_slowMy` (EMA lento) PERO se le resta el `dominantW` del chroma CRUDO del frame actual.** Esto es una **inconsistencia temporal**: el slow vector ya suavizó el dominant bin, pero la resta usa el valor instantáneo. Si el dominant bin salta de C a G entre frames (común en percusión), la resta produce un residual que apunta en direcciones opuestas frame a frame → **el secondary hue oscila salvajemente**.

3. **CERO EMA en el secondary hue.** El resultado de `atan2(resMy, resMx)` se escribe directamente a `pal.secondary.h` sin ningún suavizado. El secondary hue hereda todo el jitter del chroma instantáneo.

### Propuesta

```typescript
// 1. Subir el umbral de residual a algo significativo
const RESIDUAL_MIN_MAG = 0.05;  // era 0.001 — 50x más estricto

// 2. Restar el dominantW del SLOW vector (consistencia temporal)
//    Necesitamos guardar el dominantIdx/w del slow path, no del crudo
//    Alternativa simple: restar w_max_smoothed en vez de w_max_raw

// 3. Añadir EMA vectorial al residual (igual que Pillar I)
let _resMxEMA = 0, _resMyEMA = 0;
const RESIDUAL_ALPHA = 0.02;  // τ≈2.5s — entre slow (4.5s) y fast (560ms)
_resMxEMA = (1 - RESIDUAL_ALPHA) * _resMxEMA + RESIDUAL_ALPHA * resMx;
_resMyEMA = (1 - RESIDUAL_ALPHA) * _resMyEMA + RESIDUAL_ALPHA * resMy;
// Usar _resMxEMA/_resMyEMA para atan2
```

| Parámetro | Actual | Propuesto | Razón |
|-----------|--------|-----------|-------|
| `RESIDUAL_MIN_MAG` | 0.001 | **0.05** | Solo derivar secondary cuando hay segundo centro tonal real |
| Residual EMA | Ninguno | **α=0.02** (τ≈2.5s) | Suavizar el residual antes de atan2 |
| Resta temporal | raw dominant | **slow dominant** | Consistencia: restar del mismo dominio temporal |

---

## SOSPECHOSA #3: Pillar III — Rigid-Body Repulsion

### Estado actual

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts" lines="1435-1461" />

```typescript
// Hysteresis: accept new ψ only if it improves J by a margin
const currentJ = _voidPenalty((pal.primary.h + _rigidPsiEMA + 360) % 360)
  + _voidPenalty((pal.secondary.h + _rigidPsiEMA + 360) % 360)
  + _voidPenalty((pal.accent.h + _rigidPsiEMA + 360) % 360)
  + _voidPenalty((pal.ambient.h + _rigidPsiEMA + 360) % 360);

if (bestJ < currentJ - 1.0) {           // ← margin = 1.0
  let delta = bestPsi - _rigidPsiEMA;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  _rigidPsiEMA += delta * 0.3;          // ← α=0.3, smooth over ~3 frames
  // ...
}
```

### Veredicto: ⚠️ AMPLIFICADOR DEL JITTER (no causa raíz, pero lo agrava)

El rigid-body solver **no es la causa raíz** del jitter — su hysteresis (`margin=1.0`) y EMA (`α=0.3`) son razonables. **PERO** es un amplificador:

1. **El problema:** El secondary hue jittera (Sospechosa #2) dentro y fuera de la void zone `[25°, 80°]` cada pocos frames. Cuando el secondary entra en la void, `currentJ` sube, el solver encuentra un nuevo `ψ` que lo evacúa, y rota **TODA la paleta** (primary, secondary, accent, ambient) por `_rigidPsiEMA`.

2. **`α=0.3` es demasiado rápido para una rotación de paleta completa.** Con 44Hz, `τ ≈ 3 frames ≈ 68ms`. Si el secondary oscila a 10Hz (cada ~4 frames), el rigid solver responde cada ~3 frames → **la paleta completa rota siguiendo al jitter del secondary**.

3. **El margin `1.0` es bajo.** La void penalty puede ser hasta `~27.5` (half-width). Un jitter de 1-2° en el secondary dentro de la void supera el margin fácilmente.

### Propuesta

| Parámetro | Actual | Propuesto | Razón |
|-----------|--------|-----------|-------|
| Rigid margin | 1.0 | **5.0** | Solo rotar la paleta si la mejora es significativa, no por micro-fluctuaciones |
| `_rigidPsiEMA` α | 0.3 (τ≈68ms) | **0.05** (τ≈680ms) | Rotación de paleta completa debe ser lenta y majestuosa, no nerviosa |
| Rigid cooldown | Ninguno | **30 frames (~680ms)** | Después de una rotación, ignorar nuevas candidatos por N frames |

---

## RESUMEN EJECUTIVO

```
┌──────────────────────────────────────────────────────────────────────┐
│  CAUSA RAÍZ: Sospechosa #2 — Residual Mass sin EMA + umbral casi 0  │
│                                                                      │
│  El secondary hue se calcula restando el dominant bin CRUDO del      │
│  slow vector EMA. Esta inconsistencia temporal + falta de EMA en     │
│  el residual hace que el secondary hue oscile frame a frame.         │
│                                                                      │
│  AMPLIFICADOR: Sospechosa #3 — Rigid-body rotation sigue al jitter  │
│  del secondary, rotando TODA la paleta con α=0.3 (muy rápido).       │
│                                                                      │
│  COLABORADOR: Sospechosa #1 (fast) — Accent sin EMA, R_MIN=0.08      │
│  demasiado bajo, accent sigue ruido percusivo.                       │
│                                                                      │
│  SÍNTOMA DARKSPIN: Los movers hacen blackout porque la rueda de      │
│  color transita constantemente (hues cambiando 30-60° por beat),     │
│  y DarkSpin detecta "color wheel in transit" → shutter off.          │
└──────────────────────────────────────────────────────────────────────┘
```

## ORDEN DE FIX RECOMENDADO

1. **Fix #2 (Residual Mass):** Añadir EMA vectorial al residual + subir umbral + usar slow dominant. Esto elimina el jitter del secondary.
2. **Fix #3 (Rigid-body):** Bajar α a 0.05 + subir margin a 5.0 + añadir cooldown. Esto evita que la paleta completa rote por jitter.
3. **Fix #1 (Fast/Accent):** Bajar `GRAVITY_ALPHA_FAST` a 0.04 + subir `R_MIN` fast gate a 0.25. Esto estabiliza el accent.

¿Quieres que implemente las tres fixes o prefieres ir una por una con verificación?