# WAVE 3450-C — THE CHROMATIC ENRICHMENT
## Blueprint de Implementacion: Fin del Monopolio Cian/Amarillo

**Modulo objetivo:** `electron-app/src/engine/color/SeleneColorEngine.ts`
**Funcion de insercion:** `SeleneColorEngine.generate()` — despues del bloque `applyThermalGravity` sobre `finalHue` y antes del `Constitutional HUE ENFORCEMENT`
**Autor:** PunkOpus / Lead Architect
**Estado:** Blueprint — PENDIENTE DE EJECUCION

---

## 1. DIAGNOSTICO DEL PROBLEMA

### Por que el Cian/Amarillo monopoliza la paleta

El `SeleneColorEngine.generate()` tiene un pipeline lineal que produce siempre el mismo hue para la misma Key+Vibe:

```
KEY -> baseHue -> modeMod.hue -> moodDrift (±30 fijo) -> thermalGravity -> Constitution -> OUTPUT
```

El `moodDrift` de WAVE 2204 solo tiene tres estados: `bright=+30`, `dark=-30`, `neutral=0`. Es correcto para desestancar moodArbiter, pero no tiene resolución armonico-espectral: si Anyma lleva 20 minutos en La Menor con mood `neutral`, el cian se fija como una losa.

La segunda capa del problema es que Saturation y Lightness son estaticos dentro de los rangos constitucionales (satMin/satMax, lightMin/lightMax), sin modulacion por contenido espectral intra-frame.

---

## 2. DATOS DISPONIBLES EN EL HOT PATH

El `data: ExtendedAudioAnalysis` que llega a `generate()` ya contiene todo lo necesario, sin coste adicional de computo:

| Campo | Descripcion | Uso en W3450-C |
|---|---|---|
| `data.chroma?: number[]` | Array 12 bins, nota C=0 ... B=11, normalizado 0-1 (WAVE 2301) | Chromagram Drift |
| `data.wave8?.harmony.key` | Key detectada, ej. `"A"` | Base tonica para calcular intervalos |
| `data.wave8?.harmony.mode` | `"minor"`, `"major"`, `"dorian"`, etc. | Contexto modal |
| `data.highMid` | Energia 2-6kHz (voces, sintes, hi-hats) | Respiracion de Saturacion |
| `data.bass` / `data.subBass` | Energia de graves y subgraves | Respiracion de Luminosidad |
| `data.wave8?.rhythm.drums.kickDetected` | Deteccion de bombo | Disparo de saturacion en drops |
| `data.mid` | Energia 500-2kHz (voces reales) | Desaturacion para modo "champagne" |
| `data.energy` | Energia global RMS | Amplitud de todos los efectos |

> NOTA: `data.chroma` puede ser `undefined` si GodEarFFT no produce chromagrama en ese frame. Toda la logica debe tener fallback a `chroma = undefined -> drift = 0`.

---

## 3. MECANICA 1 — CHROMAGRAM DRIFT

### Concepto DSP

El chromagrama de 12 bins representa la distribucion de energia en el espacio tonal. La tonica de la Key (bin `ROOT`) es el "centro gravitacional". Las notas fuera de la tonica (especialmente la Quinta, la Septima Mayor, la Segunda Mayor) representan **tension armonica**: el momento en que el sinte sale de la nota raiz y el oido espera resolucion.

Esa tension se puede medir como **energía ponderada fuera del root**, proyectada sobre los intervalos con mayor carga armonica.

### Matematica

```
KEY_TO_CHROMA_BIN: tabla de 12 notas -> indice de bin
  C=0, C#/Db=1, D=2, D#/Eb=3, E=4, F=5, F#/Gb=6, G=7
  G#/Ab=8, A=9, A#/Bb=10, B=11

rootBin = KEY_TO_CHROMA_BIN[data.wave8?.harmony.key] ?? -1

Si rootBin == -1 o chroma == undefined -> drift = 0, salir.

// Intervalo de la Quinta: bin (rootBin + 7) % 12
// Intervalo de la Septima Mayor: bin (rootBin + 11) % 12
// Intervalo de la Segunda Mayor: bin (rootBin + 2) % 12
// Nota: los intervalos de "tension tonal" mas cargados en techno/house

fifthBin   = (rootBin + 7) % 12
seventhBin = (rootBin + 11) % 12
secondBin  = (rootBin + 2) % 12

// Energia de tension = suma ponderada de intervalos de tension
// Pesos: Quinta tiene el mayor efecto en modulacion (es estable pero desplaza)
//        Septima mayor tiene la mayor tension (unresolved leading tone)
//        Segunda mayor: tension media

tensionEnergy =
    chroma[fifthBin]   * 1.0   +   // Quinta: desplazamiento espectral moderado
    chroma[seventhBin] * 1.5   +   // Septima: tension maxima, empuje fuerte
    chroma[secondBin]  * 0.7       // Segunda: tension suave

// Normalizar por la energia total del chromagrama para hacerlo independiente del volumen
totalChromaEnergy = sum(chroma) // suma de los 12 bins
normalizedTension = totalChromaEnergy > 0.01
    ? tensionEnergy / totalChromaEnergy
    : 0.0

// Clampar a [0, 1]
normalizedTension = clamp(normalizedTension, 0, 1)

// El drift maximo es ±20 grados (elegido para mantenerse dentro del vibe sin romper constituciones)
// La direccion del drift depende del modo:
//   minor -> empuje hacia el lado frio del circulo (angulo negativo)
//   major/dorian -> empuje hacia el lado calido (angulo positivo)

DRIFT_AMPLITUDE = 20  // grados maximos

driftSign = (mode === 'minor') ? -1 : +1

chromaDrift = driftSign * normalizedTension * DRIFT_AMPLITUDE

// Aplicar SOLO a secondary y ambient (los Movers). El Primary (PARs) NO se toca.
// El primary ya tiene el color de la Key anclado. Los movers son los "respiros armonicos".

secondary.h = normalizeHue(secondary.h + chromaDrift)
ambient.h   = normalizeHue(ambient.h   + chromaDrift * 0.6)
// El ambient recibe el 60% del drift para crear profundidad entre Mover L y Mover R
```

### Por que esta matematica es correcta

- No usa `Math.random()`. La unica fuente de variacion es el chromagrama real del audio.
- El drift maximo es 20 grados, inferior al `elasticRotation` de 15 que ya usa la Constitution. Va a sobrevivir a los guards constitucionales sin romperlos.
- La ponderacion por `totalChromaEnergy` significa que cuando el DJ pincha silencio o un loop muy monotono (toda la energia en el root), `tensionEnergy / totalChromaEnergy` se colapsa a valores bajos naturalmente. El drift se autosilencia cuando la musica es tonica.
- El factor `0.6` en ambient crea una separacion dinamica entre secondary y ambient que el `hasSignificantPaletteDifference` de WAVE 3454 detecta como micro-variacion real, activando el puente async sin forzar transiciones artificiales.

### Punto de insercion en el codigo

Despues de este bloque (aprox lineas 1912-1924 actuales, zona de `applyThermalGravity` sobre secondary/ambient/accent):

```typescript
// -- PUNTO DE INSERCION: WAVE 3450-C CHROMAGRAM DRIFT --
// Aplicar despues de ThermalGravity y antes de Constitutional Enforcement
secondary.h = applyThermalGravity(secondary.h, options?.atmosphericTemp, gravityStrength);
ambient.h   = applyThermalGravity(ambient.h,   options?.atmosphericTemp, gravityStrength);
accent.h    = applyThermalGravity(accent.h,    options?.atmosphericTemp, gravityStrength);
// <<<< AQUI VA EL BLOQUE DE chromaDrift >>>>
```

---

## 4. MECANICA 2 — RESPIRACION DE SATURACION/LUMINOSIDAD

### Concepto DSP

La Saturation y Lightness del `primary` (y por extension del secondary) son calculados con `correctedSat` y `correctedLight`, y luego restringidos a `[satMin, satMax]` / `[lightMin, lightMax]` constitucionales. Lo que proponemos es inyectar una modulacion espectral en esos valores ANTES de que el clamp constitucional los devuelva a su rango legal. El clamp sigue siendo la red de seguridad; nosotros solo movemos el valor dentro de ese rango.

### Matematica

```
// Inputs espectrales
highMidEnergy = data.highMid ?? data.mid ?? 0      // 0-1: voces, sintes, hi-hats
subBassEnergy = (data.subBass ?? data.bass ?? 0)   // 0-1: cuerpo del kick y sub
kickFired     = data.wave8?.rhythm.drums?.kickDetected ?? false

// Factor de "voces/melodia dominante"
// Cuando highMid supera a bass, el sonido esta en zona melodica/vocal
voiceRatio = clamp(highMidEnergy - subBassEnergy, 0, 1)
// -> 0.0 = bass domina (drop, bombo)
// -> 1.0 = highMid domina (voz sola, pad, sinte)

// Factor de "bombo activo"
// El kickFired es un bool por frame. Para no sobreactivar,
// usamos el subBassEnergy con un umbral (mismo que el gate en el perfil techno):
// si subBass > 0.4 (umbral equivalente al gateOn del envelopeKick) -> consideramos "drop activo"
dropActive = subBassEnergy > 0.40

// MODULACION DE SATURACION:
// En zona vocal/melodia (voiceRatio alto): desaturar -> blanco calido / champagne
// En zona de drop/bombo (dropActive activado): saturar al maximo permitido
// La amplitud de modulacion es parametrizable por rango constitucional

satRange = (satMax - satMin)  // ancho del rango permitido

// Desaturacion vocal: en voiceRatio=1 -> quita hasta el 35% del rango de saturacion
satVocalDelta   = -voiceRatio * satRange * 0.35

// Saturacion de drop: en dropActive -> empuja hacia satMax con fuerza 0.5
// No es binario: el sub da el empuje, el voiceRatio puede contrarrestarlo
satDropDelta    = dropActive ? subBassEnergy * satRange * 0.50 : 0

// Delta total de saturacion (ya sera clampado por el sistema constitucional)
satDelta = satVocalDelta + satDropDelta
// Nota: ambos pueden sumar o cancelarse. En un drop con voz (poco comun),
// se equilibran solos. No hace falta logica especial.

// MODULACION DE LUMINOSIDAD:
// En zona vocal: +luminosidad (el amarillo sube a champagne, el cian sube a agua clara)
// En zona de drop: -luminosidad (el oro se vuelve mas oscuro, mas potente visualmente)
lightRange = (lightMax - lightMin)

lightVocalDelta = voiceRatio * lightRange * 0.25
lightDropDelta  = dropActive ? -subBassEnergy * lightRange * 0.20 : 0

lightDelta = lightVocalDelta + lightDropDelta

// Aplicar los deltas al correctedSat y correctedLight, ANTES del clamp constitucional
// El clamp constitucional ya existente los devolvera al rango legal si se pasan.
correctedSat   = correctedSat   + satDelta
correctedLight = correctedLight + lightDelta
// El clamp que ya existe en el codigo a continuacion hace el trabajo de seguridad:
// correctedSat   = clamp(correctedSat,   satMin, satMax)
// correctedLight = clamp(correctedLight, lightMin, lightMax)
```

### Por que esta matematica es correcta

- `voiceRatio = highMid - subBass` es un clasificador espectral de un solo resta. Sin division, sin riesgo de NaN. El `clamp(x, 0, 1)` garantiza que no salga de rango.
- `dropActive = subBass > 0.40` usa el mismo umbral que el `gateOn` del `envelopeKick` en el perfil Techno (0.40, W3457). Coherencia de calibracion entre DSP fisico y color.
- Los factores `0.35` (desaturacion vocal) y `0.50` (saturacion drop) estan elegidos para trabajar dentro de un rango constitucional tipico de Latino (`satRange ≈ 30, lightRange ≈ 25`). El efecto maximo en saturacion es de `±10.5 puntos HSL` — perceptiblemente distinto pero suave. El clamp constitucional es inviolable.
- El sistema es completamente lineal y determinista. Mismo audio = mismo color. Cumple el Axioma Anti-Simulacion.

### Punto de insercion en el codigo

Justo antes de las dos lineas de clamp constitucional que ya existen:

```typescript
// PUNTO DE INSERCION: WAVE 3450-C SPECTRAL BREATH
// Insertar despues de correctedSat y correctedLight calculados,
// antes de las lineas:
//   correctedSat   = clamp(correctedSat,   satMin, satMax)
//   correctedLight = clamp(correctedLight, lightMin, lightMax)
// <<<< AQUI VA EL BLOQUE DE spectralBreath >>>>
// Las lineas de clamp constitucional preexistentes actuan de red de seguridad.
```

---

## 5. CODIGO COMPLETO PARA INSERTAR

Los dos bloques son independientes entre si y pueden activarse/desactivarse por separado. Estan escritos para ser insertados tal cual en el cuerpo del metodo `generate()`.

### Bloque A — CHROMAGRAM DRIFT (para secondary.h y ambient.h)

```typescript
// WAVE 3450-C | CHROMAGRAM DRIFT
// Inyecta tension armonica real en los Movers usando el chromagrama de GodEar.
// Solo secondary y ambient se ven afectados. Primary (PARs frontales) se mantiene anclado en la Key.
// Insertar despues del bloque applyThermalGravity sobre secondary/ambient/accent.
{
  const chroma = data.chroma;
  const harmKey = data.wave8?.harmony?.key ?? data.key ?? null;
  const harmMode = data.wave8?.harmony?.mode ?? mode;

  const KEY_TO_BIN: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7,
    'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
  };

  if (chroma && chroma.length === 12 && harmKey && KEY_TO_BIN[harmKey] !== undefined) {
    const rootBin = KEY_TO_BIN[harmKey];
    const fifthBin   = (rootBin + 7)  % 12;
    const seventhBin = (rootBin + 11) % 12;
    const secondBin  = (rootBin + 2)  % 12;

    const tensionEnergy =
      chroma[fifthBin]   * 1.0 +
      chroma[seventhBin] * 1.5 +
      chroma[secondBin]  * 0.7;

    const totalChromaEnergy = chroma.reduce((acc, v) => acc + v, 0);
    const normalizedTension = totalChromaEnergy > 0.01
      ? Math.min(1, tensionEnergy / totalChromaEnergy)
      : 0;

    const DRIFT_AMPLITUDE = 20;
    const driftSign = harmMode === 'minor' ? -1 : 1;
    const chromaDrift = driftSign * normalizedTension * DRIFT_AMPLITUDE;

    secondary.h = normalizeHue(secondary.h + chromaDrift);
    ambient.h   = normalizeHue(ambient.h   + chromaDrift * 0.6);
  }
}
```

### Bloque B — SPECTRAL BREATH (para correctedSat y correctedLight)

```typescript
// WAVE 3450-C | SPECTRAL BREATH
// Modula Saturacion y Luminosidad segun la distribucion espectral del frame.
// Latino: blanco calido en voces, oro/amarillo-oro en drops.
// Techno: el rango constitucional estrecho absorbe el efecto con elegancia.
// Insertar ANTES del clamp constitucional de correctedSat / correctedLight.
{
  const highMidEnergy = data.highMid ?? data.mid ?? 0;
  const subBassEnergy = data.subBass ?? data.bass ?? 0;
  const kickFired     = data.wave8?.rhythm?.drums?.kickDetected ?? false;

  const voiceRatio = Math.max(0, Math.min(1, highMidEnergy - subBassEnergy));
  const dropActive  = subBassEnergy > 0.40 || kickFired;

  const satRange   = satMax - satMin;
  const lightRange = lightMax - lightMin;

  const satDelta   = (-voiceRatio * satRange * 0.35)
                   + (dropActive ? subBassEnergy * satRange * 0.50 : 0);

  const lightDelta = ( voiceRatio  * lightRange * 0.25)
                   + (dropActive ? -subBassEnergy * lightRange * 0.20 : 0);

  correctedSat   = correctedSat   + satDelta;
  correctedLight = correctedLight + lightDelta;
  // El clamp constitucional preexistente garantiza que no salgan de rango legal.
}
```

---

## 6. FLUJO COMPLETO CON CONTEXTO

Para hacer la implementacion quirurgica y no romper nada, aqui esta el pseudocodigo del `generate()` con las dos inyecciones marcadas:

```
generate(data, options):
  ...
  finalHue = baseHue + modeMod + moodDrift
  finalHue = applyThermalGravity(finalHue, ...)
  
  [CONSTITUTIONAL HUE ENFORCEMENT]
    hueRemapping
    forbiddenHueRanges
    allowedHueRanges
  
  correctedSat, correctedLight = calcular segun energy, syncopation, ocean...
  
  <<< BLOQUE B — SPECTRAL BREATH >>>  <-- antes del clamp constitucional
  
  correctedSat   = clamp(correctedSat,   satMin, satMax)   // red de seguridad original
  correctedLight = clamp(correctedLight, lightMin, lightMax) // red de seguridad original
  
  primary = { h: finalHue, s: correctedSat, l: correctedLight }
  
  [CALCULO DE secondary, ambient, accent segun estrategia (triadic/complementary/...)]
  [AMBIENT LOCK, TROPICAL MIRROR, MINIMUM SEPARATION...]
  
  [applyThermalGravity sobre secondary, ambient, accent]
  
  <<< BLOQUE A — CHROMAGRAM DRIFT >>>  <-- despues de ThermalGravity, antes de Constitutional
  
  [CONSTITUTIONAL HUE ENFORCEMENT sobre secondary, ambient, accent]
  [NEON PROTOCOL]
  [BREATHING FACTOR del ocean...]
  
  return { primary, secondary, ambient, accent, contrast, meta }
```

---

## 7. COMPORTAMIENTO ESPERADO POR ESCENARIO

### Techno en La Menor (loop de 20 min)

| Momento | chromaDrift | satDelta | lightDelta | Resultado visual |
|---|---|---|---|---|
| Sinte unisono en tonica | ~0° (toda energia en root) | ~0 | ~0 | Cian puro de la Key |
| Sinte con acorde Quinta dominante | -14° (minor, tension alta) | ~0 | ~0 | Cian se mueve hacia Azul Profundo |
| Drop con kick + bass fuerte | -8° (minor, tension media) | +satRange*0.35 (sube) | -lightRange*0.1 (baja) | Azul mas oscuro, mas saturado |
| Breakdown atmosferico (solo highMid) | -12° | -satRange*0.28 (baja) | +lightRange*0.22 (sube) | Verde Agua / Teal claro |

### Latino en Sol Mayor (voces + percusion)

| Momento | chromaDrift | satDelta | lightDelta | Resultado visual |
|---|---|---|---|---|
| Voz sola sin instrumento | +6° (major, poca tension) | -satRange*0.35 | +lightRange*0.25 | Amarillo -> Champagne / Blanco Calido |
| Riff de piano con quinta | +14° (major, tension) | -satRange*0.18 | +lightRange*0.12 | Naranja-Dorado medio |
| Drop de regueton (bombo+bass) | +4° | +satRange*0.50 | -lightRange*0.20 | Amarillo -> Oro Saturado / Explosivo |
| Percusion + voces simultaneous | +8° | satVocal cancela satDrop parcialmente | idem | Amarillo-Dorado equilibrado |

---

## 8. GARANTIAS DE SEGURIDAD

1. **Axioma Anti-Simulacion**: cero `Math.random()`. Toda variacion proviene de `data.chroma` y `data.highMid/subBass` — datos reales del audio, inmediatos, deterministas.

2. **Constituciones intactas**: el Bloque A aplica su drift antes del Constitutional Enforcement. La Elastic Rotation de la Constitution ajusta el resultado si se sale del allowedHueRange. El Bloque B aplica sus deltas antes del clamp constitucional existente. Ninguna ley constitucional se rompe.

3. **Mono-frame, sin estado**: ambos bloques son puros (sin variables de instancia). No hay acumulacion de estado entre frames. Entran datos de audio, salen offsets. La suavidad temporal la da el `SeleneColorInterpolator` con su LERP/snap de WAVE 3440.

4. **Degradacion elegante**: si `data.chroma` es `undefined` (GodEar no entrego chromagrama ese frame), chromaDrift = 0. Si `data.highMid` es `undefined`, highMidEnergy = `data.mid ?? 0`. El sistema nunca se cuelga.

5. **Compatibilidad con hasSignificantPaletteDifference (WAVE 3454)**: los offsets son continuos y proporcionales a la musica. Un cambio de acorde (nueva tension) produce un chromaDrift real que activa el diff gate naturalmente, enviando la actualizacion al HAL via el puente async sin necesidad de tocar nada mas.

---

## 9. NOTAS DE IMPLEMENTACION

- Los dos bloques son **independientes**. Se puede implementar y probar el Bloque B (Spectral Breath) primero sin riesgo, ya que solo afecta S/L dentro de rangos ya clampados.
- El Bloque A requiere que `data.chroma` llegue con contenido. Verificar en `senses.ts` que el chromagrama de GodEarFFT se incluye en el `ExtendedAudioAnalysis` que llega al ColorEngine. Si no se propaga, es un cable de datos que conectar en el pipeline previo.
- El `kickFired` en el Bloque B usa `data.wave8?.rhythm?.drums?.kickDetected`. Si el `wave8` no esta presente en el frame actual (modo fallback), el fallback a `false` es seguro: el Bloque B seguira trabajando con `subBassEnergy` y `voiceRatio`.
- Los valores de los coeficientes (`DRIFT_AMPLITUDE=20`, `0.35`, `0.50`, `0.25`, `0.20`, `0.40`) son puntos de partida calibrados para las constituciones actuales de Techno y Latino. Pueden ajustarse como parametros si se quieren exponer en `GenerationOptions` en una wave futura.

---

## 10. TAREAS DE IMPLEMENTACION

1. Localizar en `generate()` el bloque de `applyThermalGravity` sobre `secondary/ambient/accent` (aprox linea 1912). Insertar Bloque A despues de ese bloque.
2. Localizar en `generate()` las lineas `correctedSat = clamp(...)` y `correctedLight = clamp(...)`. Insertar Bloque B inmediatamente antes de esas lineas.
3. Ejecutar `get_errors` sobre `SeleneColorEngine.ts` para confirmar zero errores de TypeScript.
4. Test manual: cargar show `3locos.v2.luxshow` en techno, observar que el secondary oscila entre 185°-200° (Cian-Agua) segun la tension del sinte en el monitor de paleta.
5. Test manual: cargar en Latino, verificar que voz sola desatura el primary hacia champagne y el drop lo dispara al dorado.

🛑 ADDENDUM AL BLUEPRINT (LA CLÁUSULA DE INERCIA)
REGLA CRÍTICA PARA EL CHROMAGRAM DRIFT:
La Arquitecta recuerda que PROHIBIMOS los cambios de color fugaces. Los movers tienen ruedas mecánicas y sufren con el jitter. Los acentos rápidos ya tienen su propio motor de FX. Esta actualización es para la armonía ambiental.

Amortiguador Masivo (Asymmetric EMA): El valor que extraigas del Chromagrama NO puede aplicarse directamente al HUE. Tienes que pasarlo por un filtro de inercia pesado (ej. un EMA muy lento). Si la tensión armónica sube, el HUE debe tardar al menos 4 a 8 segundos en "derivar" hacia ese nuevo matiz. Debe ser una marea lenta.

Compuerta Anti-Dither (Deadzone):
Asegúrate de que los micro-cambios generados por esta respiración no superen el umbral que dispara las transiciones en SeleneColorEngine. El HUE debe acumular suficiente "tensión" antes de registrar un cambio válido para el hardware, o fluir por debajo del radar para los LEDs (PARs) sin estresar a los Movers.

Saturación/Luminosidad SÍ pueden respirar:
La respiración de Saturación/Lightness (Bloque B) es segura porque se traduce en PWM (Dimmer) en los LEDs y no mueve ruedas mecánicas. Pero el HUE (Bloque A) debe ser geológicamente lento.