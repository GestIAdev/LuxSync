Voy a revisar el telemetry para entender qué está pasando con `bR_in` y `outBR`, y luego compilar todos los envelopes actuales del techno.

Ahora tengo el cuadro completo. Déjame analizar el log y compilar la recopilación.

## Análisis del log [consnare.md](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/docs/Selene%20V3/consnare.md:0:0-0:0)

**El FFT funciona correctamente.** Las bandas se comportan bien:
- **bass**: Trackea el kick perfectamente (0.76→1.0 en kicks, baja a 0.08 en breaks)
- **mid**: Responde a synths/voces (0.05-0.30, sube en breaks con melodías)
- **highMid/treble**: Responden a hi-hats y contenido agudo (0.03-0.33)

**El problema es el bypass path del snare**, no el FFT. Dos issues críticos:

1. **`snare_energy` nunca llega a 0** entre hits (WAVE8008 logs muestran 0.29-0.64 siempre). El EMA del tracker mantiene la energía alta porque en techno a 125 BPM hay percusión casi constante.
2. **`decay=0.88+0.08×morph`** es demasiado lento. Con morph=0.8 (típico ahora), decay=0.944. Esto significa que `outBR` tarda ~727ms en bajar de 1.0 a 0.17 — **nunca se apaga** entre beats (480ms a 125 BPM).

El resultado: `_snareBypassIntensity = Math.max(decayed, hybridSnare × 1.8)` se refresca continuamente porque `hybridSnare` nunca es 0 → **luz fija**.

---

## Recopilación de Envelopes Actuales — Techno 4.1

Aquí tienes la tabla completa para consultar con el arquitecto:

### 1. `envelopeSubBass` — Front L (SubBass Groove)
`@/electron-app/src/hal/physics/profiles/techno.ts:33-45`

| Parámetro | Valor | Función |
|-----------|-------|---------|
| gateOn | 0.08 | Umbral mínimo de subgraves para encender |
| boost | 2.7054 | Amplificación de señal |
| crushExponent | 1.0 | Lineal — sin compresión de curva |
| decayBase | 0.2218 | Decay base por frame (sin morph) |
| decayRange | 0.166 | Rango de modulación por morph |
| maxIntensity | 0.5291 | Cap de intensidad |
| squelchBase | 0.0613 | Piso de squelch (ruido) |
| squelchSlope | 0.5788 | Pendiente de squelch vs morph |
| ghostCap | 0.0357 | Cap de "ghost" (luz residual mínima) |
| gateMargin | 0.0288 | Margen del gate dinámico |

### 2. `envelopeKick` — Front R (Kick Sniper)
`@/electron-app/src/hal/physics/profiles/techno.ts:54-66`

| Parámetro | Valor | Función |
|-----------|-------|---------|
| gateOn | 0.28 | Umbral de bass para detectar kick |
| boost | 3.3013 | Amplificación |
| crushExponent | 1.0 | Lineal |
| decayBase | 0.0077 | Decay ultrarrápido — muere entre kicks |
| decayRange | 0.0329 | Rango estrecho, comportamiento uniforme |
| maxIntensity | 0.80 | Cap (headroom para snare) |
| squelchBase | 0.0388 | Squelch bajo |
| squelchSlope | 0.0 | Sin squelch dinámico |
| ghostCap | 0.00 | Negro entre golpes |
| gateMargin | 0.0213 | Margen del gate |

### 3. `envelopeSnare` — Back R (Percussion Slap)
`@/electron-app/src/hal/physics/profiles/techno.ts:91-103`

| Parámetro | Valor | Función |
|-----------|-------|---------|
| gateOn | 0.35 | **NO USADO en bypass path** (solo probe telemetry) |
| boost | 1.8 | Amplificación de snare_energy del tracker |
| crushExponent | 1.0 | Lineal |
| decayBase | 0.05 | **NO USADO en bypass** — el bypass usa `0.88+0.08×morph` |
| decayRange | 0.40 | **NO USADO en bypass** |
| maxIntensity | 1.0 | Sin cap |
| squelchBase | 0.20 | **NO USADO en bypass** (solo probe) |
| squelchSlope | 0.10 | **NO USADO en bypass** |
| ghostCap | 0.00 | — |
| gateMargin | 0.01 | — |

**⚠️ NOTA CRÍTICA**: Cuando `hasRhythmic=true`, el bypass path en `LiquidEngineBase.ts:591` **ignora** `gateOn`, `decayBase`, `decayRange`, `squelchBase`, `squelchSlope` y usa valores hardcodeados: `decay = 0.88 + 0.08 × morphFactor`. Solo `boost` y `maxIntensity` se usan del profile.

### 4. `envelopeHighMid` — Back L (Mid Synths)
`@/electron-app/src/hal/physics/profiles/techno.ts:110-122`

| Parámetro | Valor | Función |
|-----------|-------|---------|
| gateOn | 0.15 | Umbral de mid para encender |
| boost | 1.5 | Amplificación moderada |
| crushExponent | 1.0 | Lineal |
| decayBase | 0.62 | Decay lento — colchón atmosférico |
| decayRange | 0.25 | Modulación por morph |
| maxIntensity | 0.85 | Cap |
| squelchBase | 0.25 | Piso de squelch |
| squelchSlope | 0.10 | Pendiente |
| ghostCap | 0.00 | Negro entre golpes |
| gateMargin | 0.005 | Margen mínimo |

### 5. `envelopeVocal` — Mover R (Vocal & Synth Wash)
`@/electron-app/src/hal/physics/profiles/techno.ts:70-82`

| Parámetro | Valor | Función |
|-----------|-------|---------|
| gateOn | 0.25 | Bozal — mínimo obligatorio |
| boost | 1.5 | Amplificación |
| crushExponent | 3.5 | Agresivo — solo picos afilados pasan |
| decayBase | 0.70 | Decay lento — sustain de voces |
| decayRange | 0.05 | Morph sutil |
| maxIntensity | 0.80 | Cap |
| squelchBase | 0.30 | Piso estricto |
| squelchSlope | 0.10 | Pendiente |
| ghostCap | 0.00 | — |
| gateMargin | 0.01 | — |

### 6. `envelopeTreble` — Mover L (Tonal Melodies)
`@/electron-app/src/hal/physics/profiles/techno.ts:126-138`

| Parámetro | Valor | Función |
|-----------|-------|---------|
| gateOn | 0.25 | Bozal — mínimo obligatorio |
| boost | 4.0 | Alta amplificación (arpegios débiles) |
| crushExponent | 3.5 | Solo picos afilados |
| decayBase | 0.78 | Decay muy lento — sustain de arpegios |
| decayRange | 0.03 | Morph casi no afecta |
| maxIntensity | 1.0 | Sin cap |
| squelchBase | 0.30 | Piso estricto |
| squelchSlope | 0.10 | Pendiente |
| ghostCap | 0.00 | Negro absoluto entre arpegios |
| gateMargin | 0.005 | Margen mínimo |

### Morphology
`@/electron-app/src/hal/physics/profiles/techno.ts:228-229`

| Parámetro | Valor | Función |
|-----------|-------|---------|
| morphFloor | 0.08 | avgMid mínimo para activar morph |
| morphCeiling | 0.25 | avgMid para morph pleno (1.0) |

### Routing 4.1 (strict-split)
`@/electron-app/src/hal/physics/profiles/techno.ts:202`

- **Front** = `frontRight` (Kick)
- **Back** = `backRight` (Snare/Hi-hat)
- **Back L** = `backLeft` (Mid synths) — **siempre 0.000 en el log** (gateOn=0.15 > señal mid)
- **Movers** = cross-filter atmosférico

### Bypass path snare (hardcodeado, NO usa profile)
`@/electron-app/src/hal/physics/LiquidEngineBase.ts:591`

| Parámetro | Valor | Función |
|-----------|-------|---------|
| decay | `0.88 + 0.08 × morph` | **Hardcodeado** — ignora profile |
| gate | **Ninguno** | Sin gate — snare_energy pasa directo |
| boost | 1.8 (del profile) | Amplificación |
| maxIntensity | 1.0 (del profile) | Cap |

---

## Diagnóstico para el arquitecto

**El FFT funciona bien.** El problema está en el **bypass path del snare**:

1. `snare_energy` del tracker **nunca es 0** (EMA con release lento + percusión frecuente en techno)
2. El bypass no tiene gate → `hybridSnare × 1.8` refresca `_snareBypassIntensity` continuamente
3. `decay=0.88+` es demasiado lento → la luz nunca se apaga
4. `envelopeSnare.gateOn/decayBase/decayRange/squelch` del profile **se ignoran** en el bypass

**Opciones a discutir con el arquitecto:**
- **A)** Restaurar el `LiquidEnvelope` completo para el path rítmico (usar [envSnare.process()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/workers/GodEarFFT.ts:1517:2-1581:3) en vez del bypass) y ajustar `gateOn` más bajo
- **B)** Añadir un gate mínimo en el bypass (ej: `if hybridSnare < 0.08 → 0`) + bajar decay a `0.75+0.10×morph`
- **C)** Hacer que el tracker produzca 0 real entre hits (EMA con release más rápido o gate más estricto)