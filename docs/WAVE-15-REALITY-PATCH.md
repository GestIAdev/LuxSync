# 🧮 WAVE 15: "MATH IS TRUTH" - Reality Patch
## Diciembre 2025

---

## 📊 RESUMEN EJECUTIVO

**WAVE 15** implementa correcciones críticas al pipeline de audio para uso **profesional** en eventos de élite.

| Componente | Antes | Después |
|------------|-------|---------|
| **InputGain** | No llegaba al Worker | ✅ Propagado + Persistido |
| **FFT** | Pseudo-análisis (índices) | ✅ Cooley-Tukey matemático real |
| **Bandas** | Sin sentido frecuencial | ✅ Bass=20-250Hz, Mid=500-2kHz, etc. |
| **Harmony** | Siempre "universal" | ✅ Umbrales dinámicos |

---

## 🔧 FIX 1: Propagación de InputGain

### Problema
El slider de ganancia actualizaba `SeleneLux.inputGain` pero **nunca** llegaba al Worker Beta donde se procesa el audio.

### Solución

**`electron/main.ts`:**
```typescript
ipcMain.handle('lux:set-input-gain', (_event, value: number) => {
  selene.setInputGain(value)
  
  // 🔧 WAVE 15: Propagar al Worker Beta
  const trinity = getTrinity()
  if (trinity) {
    trinity.updateConfig({ inputGain: value })
  }
  
  // 🔧 WAVE 15: Persistir en config
  configManager.setAudioConfig({ inputGain: value })
  
  return { success: true, inputGain: value }
})
```

**`lux:initialize-system`:**
```typescript
// 🔧 WAVE 15: Restaurar inputGain al arrancar
const savedGain = configManager.getConfig().audio?.inputGain ?? 1.0
trinity?.updateConfig({ inputGain: savedGain })
selene?.setInputGain(savedGain)
```

**`WorkerProtocol.ts`:**
```typescript
export const DEFAULT_CONFIG: TrinityConfig = {
  // ...
  inputGain: 1.0,  // 🔧 WAVE 15: Default 100%
};
```

**`ConfigManager.ts`:**
```typescript
export interface AudioConfig {
  source: 'microphone' | 'system' | 'simulation'
  deviceId?: string
  sensitivity: number
  inputGain: number  // 🔧 WAVE 15
}
```

---

## 🧮 FIX 2: FFT Real (Cooley-Tukey Radix-2)

### Problema
El `SpectrumAnalyzer` anterior dividía el buffer por **índice**, no por **frecuencia**. Trataba datos de tiempo-dominio como si fueran frecuencia-dominio.

### Solución
Nuevo archivo **`FFT.ts`** con implementación matemática pura:

```typescript
/**
 * Calcula la FFT usando Cooley-Tukey Radix-2.
 * 
 * 1. Aplica ventana de Hanning (reduce spectral leakage)
 * 2. Bit-reversal ordering
 * 3. Butterfly operations iterativas
 * 4. Extrae magnitudes normalizadas
 */
export function computeFFT(buffer: Float32Array, sampleRate: number): FFTResult
```

### Bandas de Frecuencia REALES

| Banda | Rango Hz | Uso |
|-------|----------|-----|
| Sub-Bass | 20-60 | Kicks profundos |
| Bass | 60-250 | Graves |
| Low-Mid | 250-500 | Calidez |
| Mid | 500-2000 | Melodía, voz |
| High-Mid | 2000-4000 | Presencia |
| Treble | 4000-20000 | Brillo, hi-hats |

### Detección de Transientes

```typescript
// Detecta kicks, snares, hi-hats por ratio de energía
kickDetected = detectTransient(bands.subBass + bands.bass, prevBass, 1.8)
snareDetected = detectTransient(bands.mid + bands.lowMid, prevMid, 1.5)
hihatDetected = detectTransient(bands.treble, prevTreble, 1.4)
```

---

## 🔧 FIX 3: Integración en SpectrumAnalyzer

El `SpectrumAnalyzer` en `senses.ts` ahora usa el `FFTAnalyzer`:

```typescript
class SpectrumAnalyzer {
  private readonly fftAnalyzer: FFTAnalyzer;
  
  constructor(sampleRate: number = 44100) {
    this.fftAnalyzer = new FFTAnalyzer(sampleRate, 2048);
    console.log('[BETA] 🧮 FFT Analyzer initialized (Cooley-Tukey Radix-2)');
  }
  
  analyze(buffer: Float32Array): {
    bass, mid, treble,           // Principales
    subBass, lowMid, highMid,    // Detalle
    dominantFrequency,           // Hz del pico
    kickDetected, snareDetected, // Transientes
    ...
  }
}
```

---

## 🔧 FIX 4: Umbrales Dinámicos en HarmonyDetector

### Problema
Con señal débil, siempre caía en `mood = 'universal'`, `temperature = 'neutral'`.

### Solución
Umbrales que se ajustan según la energía global:

```typescript
// Con más energía, umbrales más estrictos (música clara)
// Con menos energía, umbrales relajados (evitar defaults)
const bassThresholdHigh = energyLevel > 0.3 ? 2.0 : 1.4;
const bassThresholdLow = energyLevel > 0.3 ? 0.5 : 0.7;

// Nuevo: detección de varianza para música dinámica
if (ratioVariance > 0.3) {
  mood = 'spanish_exotic';
  temperature = 'warm';
}
```

### Moods Mejorados

| Mood | Condición |
|------|-----------|
| `sad` | Bass dominante, mids bajos |
| `happy` | Treble dominante |
| `bluesy` | Bass + mids altos |
| `dreamy` | Treble alto, mids bajos |
| `tense` | Mids muy dominantes |
| `jazzy` | Mids altos, bass bajo |
| `spanish_exotic` | Alta varianza espectral |

---

## 📊 LOGS DE DIAGNÓSTICO

### En Worker Beta (cada 100 frames):

```
[BETA 🎚️] Frame 100: RawRMS=0.0234, Gain=1.5, PostRMS=0.0351
[BETA 🧮] FFT: bass=0.42, mid=0.31, treble=0.18, dominantHz=127Hz
```

### Al cambiar InputGain:

```
[Main] 🎚️ Input Gain propagado a Worker: 150%
```

### Al iniciar sistema:

```
[Main] 🎚️ Restored inputGain from config: 150%
```

---

## ✅ CHECKLIST DE VALIDACIÓN

Después de ejecutar la app:

- [ ] Ver en consola: `[BETA] 🧮 FFT Analyzer initialized`
- [ ] Ver en consola: `[BETA 🎚️] Frame X: Gain=` con el valor del slider
- [ ] Ver en consola: `[BETA 🧮] FFT: bass=X.XX` con valores > 0.1 con música
- [ ] El Zodiaco/Elemento cambia durante la música
- [ ] La Sincopación varía (no está fija en 0.5)
- [ ] El mood varía entre 'happy', 'sad', 'tense', etc.

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `electron/main.ts` | Propagación inputGain, restauración al iniciar |
| `electron/ConfigManager.ts` | Añadido `inputGain` a AudioConfig |
| `src/main/workers/WorkerProtocol.ts` | `inputGain: 1.0` en DEFAULT_CONFIG |
| `src/main/workers/FFT.ts` | **NUEVO** - FFT Cooley-Tukey puro |
| `src/main/workers/senses.ts` | Integración FFT, logs diagnóstico |
| `src/main/workers/TrinityBridge.ts` | HarmonyDetector con umbrales dinámicos |
| `src/components/telemetry/AudioOscilloscope/AudioOscilloscope.tsx` | **WAVE 15.1** - Sync gain to audioStore |
| `src/providers/TrinityProvider.tsx` | **WAVE 15.1** - Restore gain from backend |
| `src/vite-env.d.ts` | **WAVE 15.1** - Updated start() return type |

---

## 🔧 FIX 5: InputGain Store Sync (CRÍTICO) - WAVE 15.1

### El Bug Raíz
El análisis FFT del **Renderer** usa `useAudioCapture.ts`, que lee el gain del **audioStore**:

```typescript
// useAudioCapture.ts línea 77
const inputGain = useAudioStore(state => state.inputGain)  // ← SIEMPRE era 1.0!
```

Pero el slider en `AudioOscilloscope.tsx` SOLO actualizaba:
1. ✅ Estado local (`setLocalGain`)
2. ✅ Backend vía IPC (`window.lux.setInputGain`)
3. ❌ **NUNCA** el audioStore

### Solución

**AudioOscilloscope.tsx:**
```typescript
const setStoreGain = useAudioStore(state => state.setInputGain)

const handleGainChange = (value) => {
  setLocalGain(value)
  setStoreGain(value)  // 🔧 WAVE 15.1: Sync to store
  window.lux?.setInputGain?.(value)  // Persist to backend
}
```

**main.ts (lux:start):**
```typescript
const savedGain = configManager.getConfig().audio?.inputGain ?? 1.0
return { success: true, inputGain: savedGain }  // Return saved gain
```

**TrinityProvider.tsx:**
```typescript
const result = await window.lux.start()
if (result?.inputGain !== undefined) {
  useAudioStore.getState().setInputGain(result.inputGain)
}
```

---

## 🎯 RESULTADO ESPERADO

Con WAVE 15, Selene ahora:

1. **VE** las frecuencias reales (bass = 20-250Hz, no índice 0-38)
2. **SIENTE** la ganancia del usuario (el slider funciona de verdad)
3. **RECUERDA** la ganancia entre sesiones
4. **REACCIONA** a cambios espectrales (mood dinámico, no constante)
5. **DETECTA** kicks, snares, hi-hats con precisión matemática

---

**Arquitecto:** GitHub Copilot (Claude)  
**Fecha:** Diciembre 2025  
**Versión:** Wave 15 - "MATH IS TRUTH"  
**Uso:** Profesional - Eventos de élite con iluminación y sonido
