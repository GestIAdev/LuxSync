# 🎵 WAVE 15.4 - COMPENSACIÓN DE RUIDO ROSA

**Estado**: 🔧 Plan de Optimización
**Fecha**: Wave 15.4
**Prioridad**: 🔴 CRÍTICA - Bloquea toda la lógica de Selene

---

## 📋 RESUMEN EJECUTIVO

### Problema Identificado
Los valores de **Mid y Treble son extremadamente bajos** (mid: 0.01-0.16, treble: 0.00-0.03), mientras que Bass funciona correctamente (0.14-0.64). Esto causa que:

1. **Syncopation siempre sea bajo** - depende de mid/treble
2. **Zodiac no cambie** - los cálculos dependen de energía
3. **Key detection siempre "?"** - necesita armónicos (mid/treble)
4. **La UI parece "congelada"** - valores no significativos

### Causa Raíz
El archivo `FFT.ts` usa un **factor de normalización uniforme** (`rms * 20`) para todas las bandas de frecuencia, ignorando que la música real sigue el **perfil de ruido rosa (pink noise)**.

---

## 🔬 ANÁLISIS TÉCNICO

### ¿Qué es el Ruido Rosa?
La música real y la mayoría de señales de audio naturales siguen un espectro de **ruido rosa**, donde la energía decrece aproximadamente **3 dB por octava** a medida que aumenta la frecuencia.

```
Energía Espectral de Música Real
│
│ █████                           
│ ███████                         
│ █████████                       BASS (60-250 Hz)
│ ███████████                     Alta energía natural
│ █████████████                   
│ ███████████████                 
│ █████████████████               
│   ██████████████████            
│     ██████████████████          MID (500-2000 Hz)
│       ████████████████          Energía media
│         ██████████████          
│           ████████████          
│             ██████████          
│               ████████          TREBLE (4000+ Hz)
│                 ██████          Baja energía natural
│                   ████          
└───────────────────────────────► Frecuencia (Hz)
     60   250   500  2000  4000  20000
```

### Código Actual (FFT.ts líneas 221-226)
```typescript
const normalize = (energy: number, count: number): number => {
    if (count === 0) return 0;
    const rms = Math.sqrt(energy / count);
    // ⚠️ PROBLEMA: Factor fijo para todas las bandas
    return Math.min(1, rms * 20);
};
```

### Valores Medidos (logmusica.md)
| Banda   | Rango Observado | Esperado | Estado    |
|---------|-----------------|----------|-----------|
| Bass    | 0.14 - 0.64    | 0.1-0.9  | ✅ OK     |
| Mid     | 0.01 - 0.16    | 0.2-0.7  | ⚠️ MUY BAJO |
| Treble  | 0.00 - 0.03    | 0.1-0.5  | ❌ CASI CERO |
| Energy  | 0.02 - 0.36    | 0.3-0.8  | ⚠️ BAJO   |

---

## 💡 SOLUCIÓN PROPUESTA

### Opción A: Factores de Compensación por Banda (RECOMENDADA)
Aplicar factores de escalado diferentes por banda para compensar la distribución de ruido rosa:

```typescript
// Factores de compensación por banda (aproximados para ruido rosa)
const BAND_SCALE_FACTORS = {
  SUB_BASS: 15,    // Mucha energía natural, factor bajo
  BASS: 20,        // Base de referencia
  LOW_MID: 35,     // Empezando a necesitar boost
  MID: 60,         // Boost moderado
  HIGH_MID: 100,   // Boost significativo
  TREBLE: 200,     // Boost fuerte para compensar -3dB/octava
};

const normalize = (energy: number, count: number, scaleFactor: number): number => {
    if (count === 0) return 0;
    const rms = Math.sqrt(energy / count);
    return Math.min(1, rms * scaleFactor);
};
```

### Opción B: Escala Logarítmica Automática
Calcular el factor basándose en la frecuencia central de cada banda:

```typescript
const autoScale = (freqCenter: number): number => {
  // Más frecuencia = más boost (compensación logarítmica)
  // Referencia: 100Hz = factor 20
  return 20 * Math.sqrt(freqCenter / 100);
};
```

### Tabla de Factores Calculados (Opción B)
| Banda    | Freq Central | Factor Calculado |
|----------|--------------|------------------|
| Sub-Bass | 40 Hz        | 12.6            |
| Bass     | 155 Hz       | 24.9            |
| Low-Mid  | 375 Hz       | 38.7            |
| Mid      | 1250 Hz      | 70.7            |
| High-Mid | 3000 Hz      | 109.5           |
| Treble   | 12000 Hz     | 219.1           |

---

## 🔧 IMPLEMENTACIÓN

### Paso 1: Modificar FFT.ts
Archivo: `electron-app/src/main/workers/FFT.ts`

```typescript
// Añadir después de FREQ_BANDS (línea ~62)

/**
 * Factores de compensación de ruido rosa por banda.
 * La música real tiene ~3dB menos de energía por octava.
 * Estos factores normalizan las bandas para uso en visualización.
 */
const PINK_NOISE_COMPENSATION = {
  SUB_BASS: 15,
  BASS: 20,
  LOW_MID: 40,
  MID: 70,
  HIGH_MID: 120,
  TREBLE: 200,
} as const;
```

### Paso 2: Modificar computeBandEnergies()
```typescript
// Reemplazar la función normalize (líneas 221-226)

const normalize = (energy: number, count: number, scaleFactor: number = 20): number => {
    if (count === 0) return 0;
    const rms = Math.sqrt(energy / count);
    return Math.min(1, rms * scaleFactor);
};

// Y en el return (líneas 228-236):
return {
    subBass: normalize(subBassEnergy, subBassCount, PINK_NOISE_COMPENSATION.SUB_BASS),
    bass: normalize(bassEnergy + subBassEnergy, bassCount + subBassCount, PINK_NOISE_COMPENSATION.BASS),
    lowMid: normalize(lowMidEnergy, lowMidCount, PINK_NOISE_COMPENSATION.LOW_MID),
    mid: normalize(midEnergy, midCount, PINK_NOISE_COMPENSATION.MID),
    highMid: normalize(highMidEnergy, highMidCount, PINK_NOISE_COMPENSATION.HIGH_MID),
    treble: normalize(trebleEnergy + highMidEnergy, trebleCount + highMidCount, PINK_NOISE_COMPENSATION.TREBLE),
    dominantFrequency: frequencies[dominantBin] || 0,
    spectralCentroid: totalMag > 0 ? weightedFreqSum / totalMag : 0,
};
```

---

## 📊 RESULTADOS ESPERADOS

### Antes (actual)
```
bass=0.64   mid=0.01   treble=0.00   energy=0.23
bass=0.14   mid=0.16   treble=0.03   energy=0.11
```

### Después (con compensación)
```
bass=0.64   mid=0.35   treble=0.30   energy=0.43
bass=0.14   mid=0.56   treble=0.48   energy=0.39
```

### Impacto en Selene
| Métrica        | Antes | Después | Mejora |
|----------------|-------|---------|--------|
| Syncopation    | 0-12% | 30-80%  | ✅     |
| Energy         | 2-36% | 30-70%  | ✅     |
| Key Detection  | "?"   | Detecta | ✅     |
| Zodiac Updates | Stuck | Fluido  | ✅     |

---

## 🧪 PLAN DE PRUEBAS

### Test 1: Valores Numéricos
1. Ejecutar con música YouTube
2. Verificar en logs:
   - `mid` debe estar entre 0.2-0.7 durante música
   - `treble` debe estar entre 0.1-0.5 durante música
   - `energy` promedio debe superar 0.3

### Test 2: UI Responde
1. Verificar que Syncopation NO es 0% constante
2. Verificar que los valores zodiac cambian
3. Verificar que Key detection muestra valores

### Test 3: Visualización
1. El osciloscopio debe mostrar actividad en todas las bandas
2. Los efectos de luz deben responder a mid/treble

---

## 🚨 ISSUE SECUNDARIO: Syncopation 0% en UI

### Observación
El log del backend muestra `syncopation: 0.12 - 1.00` pero la UI muestra `0%`.

### Posibles Causas
1. **IPC no transmite syncopation** - verificar que `trinity:audio-analysis` incluye syncopation
2. **telemetryStore no procesa** - verificar `updateFromTrinityAudio()`
3. **UI no lee el campo** - verificar componente de visualización

### Archivos a Revisar
- `TrinityOrchestrator.ts` - ¿emite syncopation en el evento?
- `telemetryStore.ts` - ¿guarda syncopation?
- `AudioPanel.tsx` / Dashboard - ¿lee syncopation del store?

---

## 📁 ARCHIVOS AFECTADOS

| Archivo | Acción | Líneas |
|---------|--------|--------|
| `FFT.ts` | Modificar | 62-70, 221-236 |
| `telemetryStore.ts` | Verificar | updateFromTrinityAudio |
| Documentación | Crear | Este archivo |

---

## ⏱️ ESTIMACIÓN

| Tarea | Tiempo |
|-------|--------|
| Implementar compensación | 10 min |
| Probar con música | 5 min |
| Ajustar factores | 10 min |
| Debug syncopation UI | 15 min |
| **Total** | ~40 min |

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Añadir `PINK_NOISE_COMPENSATION` constantes
- [x] Modificar función `normalize()` con parámetro `scaleFactor`
- [x] Actualizar return de `computeBandEnergies()`
- [x] Fix `updateFromTrinityAudio()` para extraer syncopation
- [ ] Recompilar Workers
- [ ] Probar con música real
- [ ] Verificar valores mid/treble en logs
- [ ] Verificar syncopation en UI
- [ ] Ajustar factores si es necesario

---

## 📝 CAMBIOS REALIZADOS (Wave 15.4)

### 1. FFT.ts - Compensación de Ruido Rosa
**Archivo**: `electron-app/src/main/workers/FFT.ts`

```typescript
// AÑADIDO: Constantes de compensación
const PINK_NOISE_COMPENSATION = {
  SUB_BASS: 15,
  BASS: 20,
  LOW_MID: 40,
  MID: 70,
  HIGH_MID: 120,
  TREBLE: 200,
} as const;

// MODIFICADO: normalize() ahora acepta scaleFactor
const normalize = (energy: number, count: number, scaleFactor: number = 20)

// MODIFICADO: computeBandEnergies() usa factores por banda
return {
  subBass: normalize(subBassEnergy, subBassCount, PINK_NOISE_COMPENSATION.SUB_BASS),
  bass: normalize(..., PINK_NOISE_COMPENSATION.BASS),
  mid: normalize(..., PINK_NOISE_COMPENSATION.MID),
  treble: normalize(..., PINK_NOISE_COMPENSATION.TREBLE),
  ...
}
```

### 2. telemetryStore.ts - Syncopation Pipeline
**Archivo**: `electron-app/src/stores/telemetryStore.ts`

```typescript
// AÑADIDO: Campos extraídos de Trinity audio-analysis
updateFromTrinityAudio: (analysis: unknown) => {
  const data = analysis as {
    ...
    syncopation?: number    // NUEVO
    groove?: number         // NUEVO
    key?: string           // NUEVO
    mood?: 'dark' | 'bright' | 'neutral'  // NUEVO
    bpmConfidence?: number  // NUEVO
  }
  
  // AÑADIDO: Actualiza dna.rhythm.syncopation
  const updatedDna: MusicalDNATelemetry | null = currentState.dna ? {
    ...currentState.dna,
    rhythm: {
      ...currentState.dna.rhythm,
      syncopation: data.syncopation ?? currentState.dna.rhythm.syncopation,
    },
    mood: data.mood ?? currentState.dna.mood,
    key: data.key ?? currentState.dna.key,
  } : null
}
```

---

**Autor**: GitHub Copilot
**Wave**: 15.4
**Siguiente**: Probar con música real y validar valores
