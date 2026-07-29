Plan claro. Verifico el estado actual del [StrobeEngine](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1224:0-1303:1) y el [SlopeBasedOnsetDetector](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1569:0-1628:1) antes de editar.
Aplicando ambos bloques: constantes maestras + refactor temporal.

Todas las ediciones aplicadas. Verifico compilación.
0 errores. Pero el refactor introduce una dependencia temporal que el calibrador mide mal: usa [performance.now()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/scripts/GodEarCalibrator.ts:153:2-153:38) (tiempo real de CPU, ~1ms por chunk) en vez del tiempo de audio (92.88ms por chunk de 4096 @ 44.1kHz). Eso saturaría la ventana de 500ms artificialmente.

El calibrador calcula `deltaMs` pero nunca lo pasa — [analyze()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1880:2-2169:3) lo computa internamente. Verifico cómo.


Añado un override opcional de `deltaMs` para que el análisis offline use tiempo de audio real, no tiempo de CPU.



`tsc --noEmit`: **0 errores**. Verifico el comportamiento real re-ejecutando la calibración.

19 JSONs regenerados. Verifico el efecto real del refactor.


El refactor funciona. Reviso los barridos de umbral con los datos nuevos.
Implementación completa y verificada. `tsc --noEmit`: **0 errores**.

# Entregable — Cierre DSP V3

## Constantes inyectadas

| Constante | Antes | Ahora | Ubicación |
|---|---|---|---|
| `FLATNESS_OFFSET` | 0.20 | **0.10** | `@c:\...\GodEarFFT.ts:363` |
| `FLATNESS_SCALE` | 0.35 | **0.10** | `@c:\...\GodEarFFT.ts:364` |
| `WEIGHT_TRANSIENT` | 0.50 | **0.40** | [StrobeEngine](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1231:0-1332:1) |
| `WEIGHT_NOISE` | 0.30 | **0.30** | [StrobeEngine](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1231:0-1332:1) |
| `WEIGHT_FLUX` | 0.20 | **0.30** | [StrobeEngine](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1231:0-1332:1) |
| `FLUX_FLOOR` / `FLUX_RANGE` | — | **0.95 / 0.05** | [StrobeEngine](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1231:0-1332:1) |
| `ACTIVATION_THRESHOLD` | 0.45 | **0.40** | [StrobeEngine](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1231:0-1332:1) |
| `DEACTIVATION_THRESH` | 0.25 | **0.22** | [StrobeEngine](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1231:0-1332:1) |
| `AGC_HEADROOM` | 1.50 | **1.25** | módulo |
| `AGC_TARGET_SCALE` | 0.64 | **0.64** ✓ | módulo |
| `SNAP_THRESHOLD` | 0.0130 | **0.0100** | [ChromaCoupler](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1312:0-1422:1) |
| `TONAL_GATE_RATIO` | 1.0 | **3.0** | [ChromaCoupler](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1312:0-1422:1) |

Todos los valores mágicos hardcodeados quedaron promovidos a `static readonly` con referencia simbólica (el getter [activationThreshold](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1323:2-1323:81) y el mapeo de rate ahora derivan de la constante, ya no hay `0.45` suelto).

## Refactor temporal — `transientDensity`

Nuevo bloque en [SlopeBasedOnsetDetector](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1601:0-1724:1) (`@c:\...\GodEarFFT.ts:1607-1674`):

```
DENSITY_WINDOW_MS      = 500
DENSITY_SATURATION_HITS = 6
DENSITY_BASE           = 0.15
DENSITY_CAPACITY       = 32
```

[updateTemporalDensity(onsetDetected, deltaMs)](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1631:2-1670:3) mantiene un `Float64Array(32)` con timestamps monótonos, hace compactación in-place para desalojar los onsets fuera de ventana, y mapea el conteo linealmente: **0→0.0, 1→0.15, 6+→1.0**. Zero-alloc en hot path. [reset()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1580:2-1588:3) limpia `onsetCount` y `elapsedMs`.

En [analyze()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1880:2-2173:3) la línea `transients.strength * 2` fue reemplazada por la llamada temporal.

### Corrección adicional necesaria

El refactor rompía la medición offline: [analyze()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1880:2-2173:3) derivaba `deltaMs` de [performance.now()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/scripts/GodEarCalibrator.ts:153:2-153:38), que en batch es ~1ms por chunk en vez de los 92.88ms de audio real. La ventana de 500ms se habría saturado artificialmente. Añadí un parámetro opcional `deltaMsOverride` (`@c:\...\GodEarFFT.ts:1894`) y el calibrador ahora pasa `(fftSize / sampleRate) * 1000`. **Comportamiento en tiempo real sin cambios** — el override es `undefined` en producción.

## Verificación empírica (432 muestras re-procesadas)

**El sesgo hacia bombos desapareció.** `transientDensity` ahora cuantiza a la escalera de densidad y kicks/snares comparten mediana `0.15` — ambos son golpes aislados, que es lo correcto:

| Grupo | med | max | antes (max) |
|---|---|---|---|
| KICKS | 0.1500 | **0.3200** | 0.4681 |
| SNARES | 0.1500 | 0.3200 | 0.0270 |
| HIHATS | 0.1500 | 0.4900 | 0.0095 |
| CYMBALS | 0.3200 | 0.4900 | 0.0188 |

`whiteNoiseScore` cumple el objetivo: **KICKS mediana `0.0000`**, SNARES `0.9937`, HIHATS saturado.

### El requisito del bombo está garantizado

Barrido sobre `strobeDrive` (suavizado) con `ACTIVATION_THRESHOLD = 0.40`:

| Grupo | ≥0.30 | ≥0.35 | **≥0.40** |
|---|---|---|---|
| KICKS | 0% | 0% | **0%** |
| SNARES | 7% | 0% | 0% |
| HIHATS | 66% | 5% | 0% |
| CYMBALS | 8% | 0% | 0% |

**Bombo aislado: 0% de disparo** (máximo absoluto `0.2707`). Ya no es "2%", es cero.

## Dos cosas que debes saber

**1. El suavizador asimétrico quedó siendo el detector de redobles — y eso es correcto.**

Sobre `strobeDriveRaw` la separación es limpia: KICKS máximo `0.3600` (por debajo del umbral), SNARES mediana `0.4298`, HIHATS mediana `0.6470`. Pero `driveSmooth` con ataque `k=0.35` necesita ~3 frames consecutivos de drive alto para cruzar `0.40`. Un golpe suelto no sostiene; un redoble sí. Los one-shots de la librería dan 0% precisamente porque son one-shots. **Es el comportamiento que pediste**, pero sigo sin poder cuantificarlo — hacen falta samples de redobles reales.

**2. Efecto secundario del refactor: los pads/bajos ahora son la principal fuente de falso positivo.**

`MELODIC` pasó a `transientDensity` mediana `0.66` (antes `0.156`) porque el detector de slope dispara repetidamente sobre notas sostenidas, vibrato y colas de reverb. Con `WEIGHT_TRANSIENT = 0.40` eso aporta `0.264` de base, y `MELODIC` es el único grupo que cruza el umbral (35% a `0.40`).

No lo he tocado porque no estaba en la directiva y cambiar pesos ahora invalidaría la calibración que acabas de aprobar. La solución limpia sería un gate de transitoriedad (exigir caída de energía entre onsets) o reutilizar el `tonalRatio` que ya existe para el chroma. Dime si quieres que lo aborde.