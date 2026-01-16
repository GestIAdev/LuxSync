# 🎚️ WAVE 670: OPERATION CLEAN SIGNAL - EXECUTION CHECKLIST

**Fecha**: 16/01/2026  
**Ejecutor**: PunkOpus  
**Status**: ✅ EJECUTADO

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### FASE 0: AGC Integration (WAVE 670) - MÁXIMA PRIORIDAD

#### Rescate del Motor
- [x] Crear `AutomaticGainControl.ts` en `src/workers/utils/` (adaptado para Worker)
- [x] Implementar normalización de buffer ANTES del FFT
- [x] Peak tracking con decay exponencial (0.997/frame)
- [x] Warmup period (60 frames) para calibración inicial
- [x] Anti-pumping con smoothing de ganancia (15 frames)

#### Integración Quirúrgica
- [x] Importar AGC en `senses.ts` (BETA Worker)
- [x] Integrar `agc.processBuffer(buffer)` ANTES del FFT
- [x] Exponer `agcGainFactor` en el output del análisis
- [x] Actualizar interface `AudioAnalysis` en `WorkerProtocol.ts`
- [x] Actualizar interface `ExtendedAudioAnalysis` en `senses.ts`

#### Logging & Debug
- [x] Log cada ~1 segundo: `[AGC 🎚️] Gain: 1.4x | In: 0.30 → Out: 0.42 | Peak: 0.35`
- [x] Indicador de warmup: `⏳ WARMUP` vs `✅ ACTIVE`
- [x] `agcGainFactor` disponible para TacticalLog

#### Tests (Pendientes para validación manual)
- [ ] MP3 silencioso normalizado correctamente
- [ ] WAV saturado normalizado correctamente
- [ ] gainFactor visible en logs de consola
- [ ] Verificar que rawEnergy refleja señal normalizada

---

## 📊 KPIs DE VALIDACIÓN

| Métrica | Esperado | Método |
|---------|----------|--------|
| AGC Gain para MP3 suave | 1.5x - 4.0x | Log de consola |
| AGC Gain para WAV fuerte | 0.5x - 1.0x | Log de consola |
| RMS de salida estable | ~0.25 RMS | Log de consola |
| Warmup time | ~1 segundo | Log de consola |

---

## 🔧 ARCHIVOS MODIFICADOS

1. **NUEVO**: `src/workers/utils/AutomaticGainControl.ts`
   - Clase AGC completa para normalización de buffer
   - Singleton pattern con `getAGC()` / `resetAGC()`
   
2. **MODIFICADO**: `src/workers/senses.ts`
   - Import del AGC
   - Integración en `processAudioBuffer()` ANTES del FFT
   - `agcGainFactor` añadido al return
   
3. **MODIFICADO**: `src/workers/WorkerProtocol.ts`
   - `agcGainFactor?: number` añadido a interface `AudioAnalysis`

---

## 🎯 SIGUIENTE PASO

Con AGC funcionando, el siguiente WAVE es:

**WAVE 661: FFT → GAMMA (Spectral Pipeline)**
- Extraer `harshness` y `flatness` del FFTAnalyzer
- Propagarlos via postMessage a TrinityBrain
- Verificar que llegan al Main Thread

---

## 📝 NOTAS TÉCNICAS

### Diferencia AGC vs AdaptiveEnergyNormalizer

| AGC (WAVE 670) | AdaptiveEnergyNormalizer (WAVE 16) |
|----------------|-----------------------------------|
| Normaliza BUFFER de audio | Normaliza VALOR de energía |
| ANTES del FFT | DESPUÉS del análisis |
| Afecta TODO el pipeline | Solo afecta energía display |
| Target: RMS consistente | Target: Rango dinámico 0-1 |

**Ambos son necesarios** - hacen cosas diferentes.

### Parámetros AGC

```typescript
const DEFAULT_AGC_CONFIG = {
  targetRMS: 0.25,      // Nivel objetivo (-12dB aprox)
  peakDecay: 0.997,     // ~3s para caer 50%
  maxGain: 8.0,         // Máximo 8x (+18dB)
  minGain: 0.25,        // Mínimo 0.25x (-12dB)
  warmupFrames: 60,     // 1 segundo @ 60fps
  noiseFloor: 0.005,    // Debajo = silencio
};
```

---

*"Sin AGC, los Z-Scores son ficción matemática. AGC primero."*  
— Radwulf (CEO), 16/01/2026
