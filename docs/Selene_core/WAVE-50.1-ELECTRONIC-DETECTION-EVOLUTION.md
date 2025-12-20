# WAVE 50.1: DETECCIÓN ELECTRÓNICA EVOLUCIONADA
## "¿Cómo meter a Skrillex en el equipo ELECTRONIC?"

**Fecha**: 2025-12-19  
**Estado**: 🧪 BLUEPRINT PARA PRÓXIMA FASE  
**Prerequisito**: WAVE 50 completado ✅

---

## 🎯 EL PROBLEMA

### Estado Actual (WAVE 50)

```typescript
// Lógica binaria actual
if (pattern === 'four_on_floor' && confidence > 0.5) {
  return 'ELECTRONIC_4X4';  // Techno, House, Trance
}
return 'LATINO_TRADICIONAL';  // Todo lo demás
```

### ¿Dónde falla?

| Artista | Género Real | Ritmo | Resultado Actual | ¿Correcto? |
|---------|-------------|-------|------------------|------------|
| Carl Cox | Techno | 4x4 | ELECTRONIC ❄️ | ✅ |
| Tiësto | Trance | 4x4 | ELECTRONIC ❄️ | ✅ |
| Shakira | Pop Latino | Off-beat | LATINO 🔥 | ✅ |
| Skrillex | Dubstep | Breakbeat | LATINO 🔥 | ❌ **INCORRECTO** |
| Pendulum | DnB | Breakbeat | LATINO 🔥 | ❌ **INCORRECTO** |
| Aphex Twin | IDM | Broken | LATINO 🔥 | ❌ **INCORRECTO** |
| Justice | Electro | Half-time | LATINO 🔥 | ⚠️ Debatible |

### El Dilema Filosófico

> ¿Qué hace que algo sea "electrónico" para efectos de iluminación?

**Opción A**: El ritmo (4x4 = máquina = electrónico)  
**Opción B**: El timbre (synth sucio/distorsionado = electrónico)  
**Opción C**: La energía + espectro (bass pesado + agudos metálicos)  

---

## 🔬 ANÁLISIS: ¿QUÉ DIFERENCIA SKRILLEX DE CUMBIA?

### Características de Audio

| Característica | Skrillex/Dubstep | Cumbia/Reggaeton |
|----------------|------------------|------------------|
| **Bass Frequency** | Sub-bass extremo (20-60 Hz) | Mid-bass (80-200 Hz) |
| **Bass Character** | Distorsionado, "growl" | Limpio, redondo |
| **Treble** | Harsh, metálico, "laser" | Suave, orgánico |
| **Mid-range** | Hueco (scooped) | Lleno (guitarras, voces) |
| **Dynamics** | Extremo (silencio → explosión) | Constante, cíclico |
| **Spectral Ratio** | Bass/Mid > 2.0 | Bass/Mid ≈ 1.0 |

### La Clave: SPECTRAL HARSHNESS

```typescript
// Concepto: "Synth Sucio" = ratio de frecuencias altas distorsionadas
const spectralHarshness = calculateHarshness(audio);

// Dubstep/DnB: Alto harsh ratio (synths agresivos)
// Cumbia: Bajo harsh ratio (instrumentos orgánicos)
```

---

## 💡 PROPUESTA: DETECCIÓN MULTI-SEÑAL

### Nueva Lógica (WAVE 50.1)

```typescript
function classifyElectronic(rhythm: RhythmOutput, audio: AudioMetrics): MacroGenre {
  // SEÑAL 1: Patrón 4x4 (ya implementado)
  const isFourOnFloor = rhythm.pattern === 'four_on_floor' && rhythm.confidence > 0.5;
  
  // SEÑAL 2: Sub-bass extremo (< 60 Hz dominante)
  const hasSubBassExtreme = audio.subBass > 0.7 && audio.subBass > audio.bass * 1.5;
  
  // SEÑAL 3: Treble "harsh" (agudos metálicos/distorsionados)
  const hasHarshTreble = audio.treble > 0.6 && audio.spectralCentroid > 8000; // Hz
  
  // SEÑAL 4: Mid-range "scooped" (hueco en medios = synth moderno)
  const hasScoopedMids = audio.mid < 0.4 && audio.bass > 0.6;
  
  // === DECISIÓN ===
  // ELECTRONIC si cumple AL MENOS UNA de:
  // 1. Es 4x4 puro (techno, house)
  // 2. Tiene sub-bass extremo + treble harsh (dubstep, DnB)
  // 3. Tiene mids scooped + sub-bass (electro, bass music)
  
  if (isFourOnFloor) {
    return 'ELECTRONIC_4X4';  // Camino rápido para techno
  }
  
  if ((hasSubBassExtreme && hasHarshTreble) || (hasScoopedMids && hasSubBassExtreme)) {
    return 'ELECTRONIC_BASS';  // Nuevo perfil para bass music
  }
  
  return 'LATINO_TRADICIONAL';  // Warm fallback
}
```

### ¿Necesitamos un Tercer Perfil?

**Opción 1: Mantener 2 perfiles (SIMPLE)**
- ELECTRONIC_4X4 absorbe dubstep/DnB
- Solo cambiar la lógica de detección
- Mismo color frío para toda electrónica

**Opción 2: Agregar ELECTRONIC_BASS (MEDIO)**
- 3 perfiles: 4X4, BASS, ORGANIC
- BASS = más oscuro que 4X4, más strobes
- Mejor representación de bass music

**Opción 3: Perfil dinámico por energía (COMPLEJO)**
- ELECTRONIC base + modificadores
- Más intensidad = más oscuro + más contraste
- Máxima fidelidad pero más código

### Recomendación del Arquitecto

> **Opción 1: Mantener 2 perfiles**
> 
> Skrillex con colores fríos (azul/púrpura) es perfectamente aceptable.
> La diferencia entre ELECTRONIC_4X4 y un hipotético ELECTRONIC_BASS
> sería marginal (~5% del color).
> 
> **Prioridad: Mejorar la DETECCIÓN, no añadir perfiles.**

---

## 📊 MÉTRICAS NECESARIAS

### Actualmente Disponibles en AudioMetrics

```typescript
interface AudioMetrics {
  bass: number;        // ✅ Tenemos
  mid: number;         // ✅ Tenemos
  treble: number;      // ✅ Tenemos
  volume: number;      // ✅ Tenemos
  bpm: number;         // ✅ Tenemos
  // ... etc
}
```

### Métricas Faltantes para WAVE 50.1

```typescript
interface AudioMetricsExtended {
  // Ya existentes
  bass: number;
  mid: number;
  treble: number;
  
  // NUEVAS para detección Skrillex
  subBass: number;         // 20-60 Hz (sub-woofer range)
  spectralCentroid: number; // Centro de masa espectral (Hz)
  spectralFlux: number;     // Cambio espectral (para "drops")
  harshness: number;        // Ratio de armónicos distorsionados
}
```

### ¿De Dónde Salen Estas Métricas?

Ya tenemos la FFT en `senses.ts`. Solo hay que extraer:

```typescript
// En senses.ts, después del análisis FFT actual:
const fftData = analyzer.getByteFrequencyData();

// Sub-bass: bins 0-3 (aproximadamente 20-80 Hz @ 44.1kHz, 2048 FFT)
const subBass = avg(fftData.slice(0, 4)) / 255;

// Spectral Centroid: centro de masa del espectro
const spectralCentroid = calculateCentroid(fftData, sampleRate);

// Harshness: ratio de energía en 2-4 kHz vs total
const harshness = avg(fftData.slice(90, 180)) / avg(fftData);
```

---

## 🗓️ PLAN DE IMPLEMENTACIÓN

### Fase 1: Métricas (30 min)
1. Añadir `subBass` a AudioMetrics (fácil, ya tenemos la FFT)
2. Añadir `spectralCentroid` (calcular centro de masa)
3. Añadir `harshness` (ratio 2-4kHz vs total)

### Fase 2: Detección (20 min)
1. Modificar `SimpleBinaryBias.classify()`
2. Añadir condiciones para sub-bass extremo + harsh treble
3. Mantener 2 perfiles de salida

### Fase 3: Validación (1 hora)
1. Test con Skrillex - "Bangarang" → Debe ser ELECTRONIC
2. Test con Pendulum - "Propane Nightmares" → Debe ser ELECTRONIC
3. Test con Shakira - "Hips Don't Lie" → Debe ser LATINO
4. Test con Carl Cox - "I Want You" → Debe ser ELECTRONIC

---

## 🎨 IMPACTO EN ILUMINACIÓN

### Skrillex Actual (LATINO - incorrecto)
- Colores: Ámbar, Magenta, Sunset
- Sensación: Cálida, festiva
- Problema: No match con la energía agresiva

### Skrillex WAVE 50.1 (ELECTRONIC - correcto)
- Colores: Cyan, Púrpura, Neón
- Sensación: Fría, industrial, agresiva
- Match: Perfecto con drops de dubstep

---

## 📝 CÓDIGO DE REFERENCIA

### Cálculo de Spectral Centroid

```typescript
function calculateSpectralCentroid(fftData: Uint8Array, sampleRate: number): number {
  const binWidth = sampleRate / (2 * fftData.length);
  let weightedSum = 0;
  let totalMagnitude = 0;
  
  for (let i = 0; i < fftData.length; i++) {
    const frequency = i * binWidth;
    const magnitude = fftData[i];
    weightedSum += frequency * magnitude;
    totalMagnitude += magnitude;
  }
  
  return totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
}
```

### Cálculo de Harshness

```typescript
function calculateHarshness(fftData: Uint8Array, sampleRate: number): number {
  const binWidth = sampleRate / (2 * fftData.length);
  
  // Harsh frequencies: 2000-5000 Hz (synths agresivos, distorsión)
  const harshStart = Math.floor(2000 / binWidth);
  const harshEnd = Math.floor(5000 / binWidth);
  
  const harshEnergy = avg(fftData.slice(harshStart, harshEnd));
  const totalEnergy = avg(fftData);
  
  return totalEnergy > 0 ? harshEnergy / totalEnergy : 0;
}
```

---

## ⚠️ CONSIDERACIONES

### Falsos Positivos Potenciales

| Audio | ¿Podría detectar ELECTRONIC? | Riesgo |
|-------|------------------------------|--------|
| Rock con distorsión | Sí (harsh treble) | Medio |
| Metal | Sí (harsh + scooped mids) | Alto |
| Jazz con contrabajo | No (sub-bass pero sin harsh) | Bajo |

### Mitigación

```typescript
// Añadir check de BPM para evitar metal (generalmente > 140)
// y rock (generalmente 100-140)
if (hasHarshTreble && bpm > 120 && bpm < 180) {
  // Probablemente electrónico
}
if (hasHarshTreble && bpm > 180) {
  // Probablemente metal → mantener ORGANIC
}
```

---

## 🎯 CONCLUSIÓN

### Lo Que Tenemos (WAVE 50)
- ✅ Sistema binario funcionando
- ✅ 4x4 → ELECTRONIC
- ✅ Todo lo demás → ORGANIC
- ❌ Dubstep/DnB clasificado como ORGANIC

### Lo Que Necesitamos (WAVE 50.1)
- Métricas adicionales: `subBass`, `spectralCentroid`, `harshness`
- Lógica expandida: detectar "synth sucio" además de 4x4
- Mantener simplicidad: 2 perfiles de salida

### Esfuerzo Estimado
- **Tiempo**: 2-3 horas
- **Riesgo**: Bajo (mejora de detección, no cambio de arquitectura)
- **Impacto**: Skrillex, Pendulum, Aphex Twin → correctamente fríos

---

## 💬 PARA EL ARQUITECTO

> "El problema no es la cantidad de perfiles, es la calidad de la detección.
> 
> Con 2 perfiles podemos representar el 95% de la música comercial.
> Skrillex es ELECTRÓNICO. Cumbia es ORGÁNICA.
> 
> La diferencia está en el ESPECTRO, no en el RITMO.
> 
> WAVE 50.1: Añadir sub-bass + harshness detection.
> Sin añadir perfiles. Sin añadir complejidad de votación.
> Solo mejores señales de entrada."

---

*WAVE 50.1: Electronic Detection Evolution - El Espectro No Miente* 🔊
