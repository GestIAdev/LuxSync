# 🕵️ AUDIO PIPELINE DIAGNOSTICS
## OPERATION SENSORY AUDIT - Diciembre 2025

---

## 📊 RESUMEN EJECUTIVO

**VEREDICTO:** Se identificaron **3 BUGs CRÍTICOS** que explican por qué Energía, BPM, Sincopación y Zodiaco están "estancados":

| Bug | Severidad | Descripción |
|-----|-----------|-------------|
| **BUG-1** | 🔴 CRÍTICO | `inputGain` NUNCA se propaga al Worker Beta |
| **BUG-2** | 🟠 ALTO | AGC destruye información de ganancia manual |
| **BUG-3** | 🟡 MEDIO | SpectrumAnalyzer usa buffer temporal sin FFT |

---

## 🔍 HALLAZGO 1: inputGain NO LLEGA AL WORKER BETA

### Cadena de Propagación Actual (ROTA)
```
UI Slider → setInputGain IPC → SeleneLux.setInputGain() → this.inputGain = value
                                                              │
                                                              └── ❌ FIN DEL CAMINO
```

### Lo que DEBERÍA pasar:
```
UI Slider → setInputGain IPC → SeleneLux.setInputGain() → trinity.updateConfig({ inputGain })
                                                              │
                                                              └── Worker Beta recibe CONFIG_UPDATE
```

### Evidencia del Código

**`electron/main.ts` línea 1041-1053:**
```typescript
ipcMain.handle('lux:set-input-gain', (_event, value: number) => {
  selene.setInputGain(value)  // ✅ Actualiza SeleneLux
  return { success: true }
  // ❌ NO LLAMA: trinity.updateConfig({ inputGain: value })
})
```

**`SeleneLux.ts` línea 670-676:**
```typescript
setInputGain(value: number): void {
  this.inputGain = Math.max(0, Math.min(4, value))  // ✅ Variable local
  console.log(`[SeleneLux] 🎚️ Input Gain: ${...}`)
  // ❌ NO LLAMA: this.trinity?.updateConfig({ inputGain: this.inputGain })
}
```

**`WorkerProtocol.ts` línea 268-277:**
```typescript
export const DEFAULT_CONFIG: TrinityConfig = {
  heartbeatInterval: 1000,
  // ... otros valores ...
  // ❌ inputGain NO ESTÁ EN DEFAULTS
};
```

### RESULTADO
El Worker Beta **SIEMPRE** usa `config.inputGain ?? 1.0` = **1.0** (100%)
La UI puede mostrar 200%, pero el análisis real recibe 100%.

---

## 🔍 HALLAZGO 2: AGC APLANA LA SEÑAL

### Código del BeatDetector (senses.ts líneas 95-130)

```typescript
// 🚑 RESCUE DIRECTIVE: AGC - Track max energy over 30 seconds
this.maxEnergyHistory.push(energy);
if (this.maxEnergyHistory.length > this.maxEnergyWindowSize) {
  this.maxEnergyHistory.shift();
}

// Update current max (use 95th percentile)
if (this.maxEnergyHistory.length > 10) {
  const sorted = [...this.maxEnergyHistory].sort((a, b) => b - a);
  const percentile95Index = Math.floor(sorted.length * 0.05);
  this.currentMaxEnergy = Math.max(0.01, sorted[percentile95Index]);
}

// Normalize energy to 0-1 range based on dynamic max
const normalizedEnergy = Math.min(1, energy / this.currentMaxEnergy);  // ⚠️ AQUÍ
```

### El Problema
1. El usuario sube `inputGain` a 200% pensando "ahora la señal será más fuerte"
2. El buffer llega con amplitud 2x
3. **PERO** el AGC detecta que la energía máxima subió
4. `currentMaxEnergy` se actualiza a 2x
5. `normalizedEnergy = energy / currentMaxEnergy` = **mismo valor que antes**
6. El efecto de la ganancia se **CANCELA**

### Diagrama del Flujo
```
                  ┌─────────────────────────────────────────────┐
                  │         FLUJO DE GANANCIA ACTUAL            │
                  └─────────────────────────────────────────────┘
                  
Buffer Raw ──►  Apply inputGain ──►  BeatDetector.analyze()
    │                  │                     │
    │                  │                     ▼
    │                  │          ┌──────────────────────┐
    │                  │          │   AGC NORMALIZA      │
    │                  │          │   energy / maxEnergy │
    │                  │          └──────────────────────┘
    │                  │                     │
    │                  │                     ▼
    │                  │             normalizedEnergy
    │                  │             (SIEMPRE 0-1)
    │                  │             ┌────────────┐
    │                  │             │ Efecto del │
    │                  └────────────►│ inputGain  │◄── ❌ ANULADO
                                     │ = 0        │
                                     └────────────┘
```

---

## 🔍 HALLAZGO 3: SimpleRhythmDetector - Sincopación

### Código (TrinityBridge.ts líneas 375-395)

```typescript
analyze(audio: AudioMetrics): RhythmOutput {
  // Track energy at different beat phases
  this.phaseHistory.push({
    phase: audio.beatPhase,
    energy: audio.bass + audio.mid * 0.5,  // ⚠️ Depende de bass/mid
  });
  
  // Calculate syncopation (off-beat energy ratio)
  for (const frame of this.phaseHistory) {
    const isOnBeat = frame.phase < 0.15 || frame.phase > 0.85;
    if (isOnBeat) {
      onBeatEnergy += frame.energy;
    } else {
      offBeatEnergy += frame.energy;
    }
  }
  
  const totalEnergy = onBeatEnergy + offBeatEnergy;
  const syncopation = totalEnergy > 0 ? offBeatEnergy / totalEnergy : 0;  // ⚠️
}
```

### El Problema
Si `audio.bass` y `audio.mid` son consistentemente bajos (~0.05-0.15):
- `onBeatEnergy` ≈ 0.5
- `offBeatEnergy` ≈ 0.5
- `syncopation` = 0.5 **CONSTANTE** (sin variación)

La sincopación se estanca porque no hay contraste entre beats fuertes y débiles.

---

## 🔍 HALLAZGO 4: SimpleHarmonyDetector - Zodiaco/Elemento

### Código (TrinityBridge.ts líneas 431-457)

```typescript
analyze(audio: AudioMetrics): HarmonyOutput {
  let mood: HarmonyOutput['mood'] = 'neutral' as any;
  let temperature: HarmonyOutput['temperature'] = 'neutral';
  
  const bassToTreble = audio.bass / (audio.treble + 0.01);  // ⚠️ Si ambos bajos = ~1.0
  
  if (bassToTreble > 2) {
    mood = 'sad'; temperature = 'cool';
  } else if (bassToTreble < 0.5) {
    mood = 'happy'; temperature = 'warm';
  } else if (audio.mid > 0.7) {
    mood = 'tense'; temperature = 'neutral';
  } else {
    mood = 'universal'; temperature = 'neutral';  // ⚠️ DEFAULT CONSTANTE
  }
}
```

### El Problema
Con señal débil:
- `bass ≈ 0.1`, `treble ≈ 0.1`
- `bassToTreble = 0.1 / 0.11 ≈ 0.9` (entre 0.5 y 2)
- `mid ≈ 0.1 < 0.7`
- **RESULTADO:** `mood = 'universal'`, `temperature = 'neutral'` SIEMPRE

El elemento zodiacal probablemente usa `temperature` para decidir Fire/Water/Earth/Air.
Si siempre es "neutral", se queda en un valor default.

---

## 🔍 HALLAZGO 5: SpectrumAnalyzer - Sin FFT Real

### Código (senses.ts líneas 208-270)

```typescript
class SpectrumAnalyzer {
  analyze(buffer: Float32Array): { bass, mid, treble } {
    // ⚠️ ESTO NO ES ANÁLISIS ESPECTRAL REAL
    // Es simplemente dividir el buffer en 3 partes por ÍNDICE
    
    const length = Math.min(buffer.length, 256);
    const lowEnd = Math.floor(length * 0.15);   // índices 0-38
    const midEnd = Math.floor(length * 0.5);    // índices 39-127
    
    for (let i = 0; i < length; i++) {
      const value = Math.abs(buffer[i]);
      if (i < lowEnd) bassEnergy += value;
      else if (i < midEnd) midEnergy += value;
      else trebleEnergy += value;
    }
```

### El Problema
**Esto NO es análisis de frecuencia.** Un buffer de audio es tiempo-dominio.
- El índice `i=0` no es "frecuencia 0Hz"
- El índice `i=255` no es "frecuencia 22050Hz"

El código trata el buffer temporal como si fuera un espectro FFT.
**Los valores bass/mid/treble son MEANINGLESS desde un punto de vista frecuencial.**

Sin embargo, "funciona" parcialmente porque:
- Las muestras al inicio del buffer pueden correlacionar con transitorios (kicks)
- Pero la correlación es débil e inconsistente

---

## 🛠️ PLAN DE REPARACIÓN

### FIX 1: Propagar inputGain al Worker (URGENTE)

**Archivo:** `electron/main.ts`
```typescript
ipcMain.handle('lux:set-input-gain', (_event, value: number) => {
  selene.setInputGain(value)
  
  // 🔧 FIX: Propagar al Worker Beta
  const trinity = getTrinity()
  if (trinity) {
    trinity.updateConfig({ inputGain: value })
  }
  
  return { success: true, inputGain: selene.getInputGain() }
})
```

**Archivo:** `WorkerProtocol.ts`
```typescript
export const DEFAULT_CONFIG: TrinityConfig = {
  // ... existing ...
  inputGain: 1.0,  // 🔧 ADD DEFAULT
};
```

### FIX 2: Bypass AGC Parcial

**Archivo:** `senses.ts` - BeatDetector
```typescript
// OPCIÓN A: Usar energía RAW para beatStrength
beatStrength: Math.min(1, energy * 2),  // Sin normalizar

// OPCIÓN B: AGC más suave (factor de mezcla)
const agcFactor = 0.5; // 50% AGC, 50% raw
const mixedEnergy = energy * (1 - agcFactor) + normalizedEnergy * agcFactor;
```

### FIX 3: Umbrales Dinámicos para Harmony

**Archivo:** `TrinityBridge.ts` - SimpleHarmonyDetector
```typescript
// Umbrales adaptativos basados en energía global
const energyLevel = audio.volume;
const bassThreshold = energyLevel > 0.3 ? 2.0 : 1.5;
const trebleThreshold = energyLevel > 0.3 ? 0.5 : 0.7;

if (bassToTreble > bassThreshold) { mood = 'sad'; }
else if (bassToTreble < trebleThreshold) { mood = 'happy'; }
```

### FIX 4: FFT Real (Futuro)

Para análisis espectral correcto, se necesita:
1. Librería FFT (fft.js, kissfft)
2. Ventana de Hanning pre-FFT
3. Calcular magnitud de bins de frecuencia
4. Mapear bins a bandas (bass: 20-200Hz, mid: 200-2kHz, treble: 2-20kHz)

---

## 📋 LOGS DE DIAGNÓSTICO SUGERIDOS

Agregar temporalmente en `processAudioBuffer` de `senses.ts`:

```typescript
function processAudioBuffer(buffer: Float32Array): ExtendedAudioAnalysis {
  // 🔍 DIAGNOSTIC LOG - Cada 100 frames
  if (state.frameCount % 100 === 0) {
    // Raw RMS antes de ganancia
    let rawRms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rawRms += buffer[i] * buffer[i];
    }
    rawRms = Math.sqrt(rawRms / buffer.length);
    
    console.log(`[SENSES AUDIT] Frame ${state.frameCount}:`, {
      rawRms: rawRms.toFixed(4),
      configGain: config.inputGain ?? 'UNDEFINED',
      postGainRms: (rawRms * (config.inputGain ?? 1)).toFixed(4),
    });
  }
  
  // ... resto del código ...
```

Y en `BeatDetector.analyze`:
```typescript
// 🔍 DIAGNOSTIC - AGC Status
if (this.energyHistory.length % 100 === 0) {
  console.log(`[BEAT AGC]`, {
    rawEnergy: energy.toFixed(4),
    maxEnergy: this.currentMaxEnergy.toFixed(4),
    normalizedEnergy: normalizedEnergy.toFixed(4),
    agcRatio: (this.currentMaxEnergy / 0.01).toFixed(2) + 'x',
  });
}
```

---

## ✅ CHECKLIST DE VALIDACIÓN

Después de aplicar fixes, verificar:

- [ ] Al subir inputGain en UI, el log `[SENSES AUDIT]` muestra `configGain` actualizado
- [ ] `postGainRms` varía proporcionalmente al slider
- [ ] Con música alta, `bass > 0.3` frecuentemente
- [ ] Sincopación varía entre 0.2-0.7 con música variada
- [ ] Mood alterna entre 'happy', 'sad', 'tense' según la música

---

## 📝 NOTAS FINALES

**Prioridad de Fixes:**
1. 🔴 **FIX 1** (inputGain propagation) - Sin esto, nada más importa
2. 🟠 **FIX 2** (AGC bypass) - Para que el gain tenga efecto
3. 🟡 **FIX 3** (Umbrales dinámicos) - Para variedad en mood
4. 🟢 **FIX 4** (FFT real) - Mejora de calidad a largo plazo

**Arquitecto:** GitHub Copilot (Claude)  
**Fecha:** Diciembre 2025  
**Versión:** Wave 14.9.3
