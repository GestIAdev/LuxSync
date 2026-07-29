Actualizo el script de análisis para incluir los 3 nuevos campos y ejecuto el análisis de ronda 2.













Los fixes funcionaron, pero los datos revelan que mis constantes candidatas iniciales saturan. Voy a hacer una búsqueda sistemática de constantes óptimas en vez de estimarlas.





Un hallazgo importante requiere verificación en el código antes de cerrar el reporte.



Confirmado. Tengo todo lo necesario.

# Reporte de Calibración DSP — RONDA 2 (Cierre)

Los 4 fixes están verificados en los datos. `spectralFluxV3` ahora vive en `[0.31, 1.00]`, `transientDensity` ya no es cero en percusión aguda, y `flatness`/`whiteNoiseScore`/`strobeDriveRaw` son observables.

---

## 1. Calibración de White Noise

Distribución real de `flatness` (432 muestras):

| Grupo | min | p25 | med | p75 | p90 | max |
|---|---|---|---|---|---|---|
| **KICKS** | 0.0242 | 0.0382 | **0.0643** | 0.1021 | 0.2011 | 0.4705 |
| SNARES | 0.0588 | 0.1665 | 0.1994 | 0.2322 | 0.3132 | 0.4608 |
| **HIHATS** | 0.2115 | 0.2862 | **0.3139** | 0.3299 | 0.3501 | 0.3730 |
| **CYMBALS** | 0.1619 | 0.1815 | **0.1965** | 0.2723 | 0.4565 | 0.5511 |
| MELODIC | 0.0771 | 0.0996 | 0.1598 | 0.3110 | 0.3862 | 0.4605 |

Barrido de la ecuación `clamp((flatness - OFFSET) / SCALE)` — score medio resultante por grupo:

| OFFSET | SCALE | KICKS | SNARES | HIHATS | CYMBALS | MELODIC |
|---|---|---|---|---|---|---|
| **0.10** | **0.10** | **0.169** | 0.787 | **1.000** | **0.907** | 0.549 |
| 0.12 | 0.10 | 0.144 | 0.687 | 0.999 | 0.795 | 0.495 |
| 0.16 | 0.10 | 0.106 | 0.433 | 0.976 | 0.544 | 0.404 |
| 0.10 | 0.22 | 0.120 | 0.475 | 0.910 | 0.593 | 0.433 |

### Constantes recomendadas
```ts
FLATNESS_OFFSET = 0.10
FLATNESS_SCALE  = 0.10   // satura en flatness = 0.20
```

**Justificación:** `OFFSET = 0.10` cae exactamente en el p75 de kicks (`0.1021`), dejando el 75% de los bombos en cero absoluto. `SCALE = 0.10` satura en `flatness = 0.20`, justo por encima de la mediana de cymbals (`0.1965`) y muy por debajo de la de hi-hats (`0.3139`). Resultado: hi-hats `1.000`, cymbals `0.907`, kicks `0.169`.

**⚠️ Limitación honesta:** los pads/bajos no bajan a 0 — se quedan en `0.549` de media. No es ajustable: `samples_bass_melodies` tiene `flatness` mediana de `0.2656`, físicamente más ruidosa que los propios platillos (`0.1965`). Son bajos sintéticos/saturados con contenido genuinamente de banda ancha. **Ninguna ecuación sobre `flatness` puede separarlos.** Se necesita el gate tonal (sección 4) para eso.

---

## 2. Cierre del Estrobo

### Hallazgo bloqueante: `transientDensity` no es densidad

El fix del piso absoluto funcionó — los onsets ahora **se detectan** en percusión aguda. Pero el valor sigue siendo energía, no tasa:

```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts:1975
    const transientDensity = transients.any ? Math.min(1, transients.strength * 2) : 0;
```

Y `strength` es potencia de banda cruda:
```@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts:1962-1966
      strength: Math.max(
        kickDetected ? rawBands.subBass : 0,
        snareDetected ? rawBands.mid : 0,
        hihatDetected ? rawBands.treble : 0
      ),
```

Consecuencia medida:

| Grupo | med | p90 | max |
|---|---|---|---|
| KICKS | **0.0450** | 0.2170 | 0.4681 |
| SNARES | 0.0029 | 0.0117 | **0.0270** |
| HIHATS | 0.0013 | 0.0074 | 0.0095 |

**El máximo absoluto de 230 cajas (`0.0270`) está por debajo del p25 de los bombos (`0.0324`).** La métrica mide "cuán grave y fuerte es el golpe", no "cuántos golpes por segundo". No existe `getTransientDensity()` en la clase — verifiqué, el método no está implementado.

**Implicación directa para tu requisito:** `transientDensity` no puede distinguir un redoble de un golpe suelto. Con el peso que le des, favorecerá bombos sobre cajas — exactamente lo contrario de lo que pides. La discriminación real la hace `flatness`.

### Búsqueda de pesos (con `OFFSET=0.10, SCALE=0.10` fijos)

| wT | wN | wF | fFloor | THR | KICKS | SNARES | HIHATS | CYMB | MELOD | KIT |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.40 | 0.30 | 0.30 | 0.95 | **0.45** | **2%** | 25% | 98% | 25% | **3%** | 46% |
| **0.40** | **0.30** | **0.30** | **0.95** | **0.40** | **2%** | **42%** | **98%** | **42%** | **22%** | 61% |
| 0.20 | 0.50 | 0.30 | 0.95 | 0.40 | 8% | 63% | 100% | 67% | 30% | 64% |
| 0.40 | 0.30 | 0.30 | 0.90 | 0.35 | 2% | 71% | 100% | 67% | 38% | 71% |

### Constantes recomendadas
```ts
WEIGHT_TRANSIENT     = 0.40
WEIGHT_NOISE         = 0.30
WEIGHT_FLUX          = 0.30
FLUX_FLOOR           = 0.95   // clamp((flux - 0.95) / 0.05)
ACTIVATION_THRESHOLD = 0.40
DEACTIVATION_THRESH  = 0.22   // ~55% del umbral, mantiene la histéresis original
```

**Justificación:**
- **`ACTIVATION_THRESHOLD = 0.40`** cumple tu requisito duro: **2% de bombos** lo superan (1 de 63, un outlier). Los hi-hats pasan al 98%.
- **`FLUX_FLOOR = 0.95`**: el flux normalizado está saturado arriba (medianas de 0.80–1.00). Sin restar el piso vuelve a ser un offset constante. Con `0.95` el rango `[0.95, 1.00]` se expande a `[0, 1]` y recupera poder discriminante.
- **`WEIGHT_NOISE = 0.30`** parece bajo, pero como `flatness` ya satura a 1.0 en hi-hats/cymbals, aporta los `0.30` completos donde importa.

**⚠️ Sobre el redoble:** los 19 JSONs contienen **golpes aislados**, no redobles. El "42% de snares" es la tasa de golpes individuales que superan el umbral en su pico. Un redoble real sostiene `flatness` alta durante múltiples frames consecutivos, así que la tasa efectiva será mayor — pero **no tengo datos para cuantificarlo**. Si quieres cerrar esto con rigor, necesito 5–10 samples de redobles reales.

---

## 3. Confirmación de Gates

### AGC — el headroom de 1.50 quedó sobredimensionado

| Grupo | n | >1.0 | >1.2 | >1.25 | >1.5 | absMax |
|---|---|---|---|---|---|---|
| KICKS | 63 | 4 (6.3%) | 1 | **0** | 0 | **1.2069** |
| MELODIC | 37 | 0 | 0 | 0 | 0 | 0.8383 |
| resto | 332 | 0 | 0 | 0 | 0 | ≤0.5406 |

`AGC_TARGET_SCALE = 0.64` hizo su trabajo: el p95 de kicks bajó de `1.4133` a `0.9608` (objetivo era 0.90). El overshoot >1.0 cayó del **28.6% al 6.3%**.

```ts
AGC_TARGET_SCALE = 0.64   // ✅ CONFIRMADO, sin cambios
AGC_HEADROOM     = 1.25   // ⬇ de 1.50 — cero muestras por encima
```

**Justificación:** `absMax = 1.2069` y **ninguna** de las 432 muestras supera `1.25`. Mantener `1.50` no aporta protección adicional y desperdicia rango DMX. Si prefieres margen conservador para material en vivo más caliente que la librería, `1.50` sigue siendo válido — es una decisión de riesgo, no de datos.

### Chroma — el Tonal Gate funciona, pero el umbral es mejorable

Ratio tonal `scaledKick / (scaledHighs + 1e-6)`:

| Grupo | med | p25 |
|---|---|---|
| KICKS | 152.0 | 76.9 |
| MELODIC | 9.22 | 6.27 |
| SNARES | 1.77 | 0.87 |
| CYMBALS | 0.165 | 0.083 |
| HIHATS | 0.078 | 0.036 |

Matriz de disparo (`chromaFlux > cfT` **AND** `tonalRatio > R`):

| cfT | R | KICKS | SNARES | HIHATS | CYMB | **MELODIC** |
|---|---|---|---|---|---|---|
| 0.0130 | 1.0 *(actual)* | 2% | 23% | **0%** | **0%** | 54% |
| 0.0130 | 3.0 | 2% | 8% | 0% | 0% | 54% |
| **0.0100** | **3.0** | 6% | **13%** | **0%** | **0%** | **84%** |
| 0.0100 | 5.0 | 6% | 6% | 0% | 0% | 76% |

**El gate tonal funciona perfectamente**: hi-hats y cymbals quedan en **0%** de falsos positivos, resolviendo la inversión que reporté en la ronda 1.

```ts
SNAP_THRESHOLD   = 0.0100   // ⬇ de 0.0130
TONAL_GATE_RATIO = 3.0      // ⬆ de 1.0
```

**Justificación:** bajar el umbral a `0.010` y subir el ratio a `3.0` mejora la detección de cambios armónicos reales del **54% al 84%** mientras *reduce* los falsos positivos de caja del **23% al 13%**. El ratio `3.0` cae entre la mediana de snares (`1.77`) y el p25 de melodic (`6.27`), que es el punto de corte natural.

---

## Resumen de constantes finales

```ts
// ── whiteNoiseScore (analyze) ────────────────────────────────
FLATNESS_OFFSET      = 0.10    // era 0.20
FLATNESS_SCALE       = 0.10    // era 0.35
// whiteNoiseScore = clamp((flatness - 0.10) / 0.10)

// ── StrobeEngine ─────────────────────────────────────────────
WEIGHT_TRANSIENT     = 0.40    // era 0.50
WEIGHT_NOISE         = 0.30    // sin cambio
WEIGHT_FLUX          = 0.30    // era 0.20
FLUX_FLOOR           = 0.95    // nuevo: clamp((flux - 0.95) / 0.05)
ACTIVATION_THRESHOLD = 0.40    // era 0.45
DEACTIVATION_THRESH  = 0.22    // era 0.25

// ── AGCTrustZone ─────────────────────────────────────────────
AGC_TARGET_SCALE     = 0.64    // ✅ confirmado
AGC_HEADROOM         = 1.25    // ⬇ de 1.50

// ── ChromaCoupler ────────────────────────────────────────────
SNAP_THRESHOLD       = 0.0100  // ⬇ de 0.0130
TONAL_GATE_RATIO     = 3.0     // ⬆ de 1.0
```

---

## Qué está cerrado y qué no

**Cerrado con datos sólidos (432 muestras):**
- Mapeo de `flatness` → `whiteNoiseScore`
- `AGC_HEADROOM` y `AGC_TARGET_SCALE`
- `SNAP_THRESHOLD` + `TONAL_GATE_RATIO` — el gate tonal está validado, 0% de falsos positivos en platillos

**Cerrado con una salvedad:**
- `ACTIVATION_THRESHOLD = 0.40` garantiza que el bombo no dispara (2%). Pero **la mitad de tu requisito — "un redoble rápido sí"— sigue sin poder verificarse**: la librería no contiene ni un solo redoble.

**Pendiente arquitectónico (no es tuning):**
- `transientDensity` mide energía de transitorio, no densidad. Para detectar redobles de verdad hace falta una métrica nueva: contar onsets en una ventana deslizante (p.ej. onsets/segundo sobre 500ms) en lugar de `strength * 2`. Es un cambio de ~15 líneas en [SlopeBasedOnsetDetector](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1569:0-1628:1).

¿Quiero que (a) aplique estas constantes al motor, (b) implemente la densidad de onsets real, o ambas?