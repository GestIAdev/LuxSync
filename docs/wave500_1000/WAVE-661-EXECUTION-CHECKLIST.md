# 🎛️ WAVE 661: SPECTRAL PIPELINE - EXECUTION CHECKLIST

## MISSION
Exponer harshness, spectralFlatness y spectralCentroid desde FFT hasta SeleneMusicalPattern.

## STATUS: ✅ IMPLEMENTADO

---

## ARQUITECTURA DEL FLUJO

```
FFT.ts (Ya calcula métricas)
    │
    ├── computeBandEnergies() → BandEnergy { harshness, spectralFlatness, spectralCentroid }
    │
    ↓
senses.ts (BETA Worker) 
    │
    ├── AudioMetrics { harshness, spectralFlatness, spectralCentroid }
    │
    ↓
TrinityBridge.ts (Ya tiene interfaces)
    │
    ├── AudioMetrics interface (optional fields)
    │
    ↓
Frontend → processAudioFrame()  ← 🎯 WAVE 661: Ahora extrae métricas espectrales
    │
    ↓
TitanOrchestrator.ts
    │
    ├── lastAudioData { ..., harshness, spectralFlatness, spectralCentroid }
    ├── engineAudioMetrics { ..., harshness, spectralFlatness, spectralCentroid }
    │
    ↓
TitanEngine.ts
    │
    ├── EngineAudioMetrics interface { harshness?, spectralFlatness?, spectralCentroid? }
    ├── TitanStabilizedState { harshness, spectralFlatness, spectralCentroid }
    │
    ↓
MusicalPatternSensor.ts
    │
    ├── SeleneMusicalPattern { harshness, spectralFlatness, spectralCentroid }
    ├── Debug log: "[SENSE 🎛️] Texture: HARSH/Dirty | Harsh=0.78 | Flat=0.20 | Centroid=2500Hz"
    │
    ↓
🎯 Disponible para HuntEngine, DecisionMaker, ScenarioSimulator...
```

---

## ARCHIVOS MODIFICADOS

### 1. `src/core/intelligence/types.ts`
- [x] Añadido `harshness`, `spectralFlatness`, `spectralCentroid` a `TitanStabilizedState`
- [x] Añadido `harshness`, `spectralFlatness`, `spectralCentroid` a `SeleneMusicalPattern`

### 2. `src/engine/TitanEngine.ts`
- [x] Añadido campos opcionales a `EngineAudioMetrics` interface
- [x] Pasando métricas espectrales a `titanStabilizedState` (con defaults)

### 3. `src/core/orchestrator/TitanOrchestrator.ts`
- [x] Ampliado tipo de `lastAudioData` para incluir métricas espectrales
- [x] `processAudioFrame()` ahora extrae `harshness`, `spectralFlatness`, `spectralCentroid`
- [x] `engineAudioMetrics` ahora incluye métricas espectrales
- [x] Reset de stale audio incluye métricas espectrales

### 4. `src/core/intelligence/sense/MusicalPatternSensor.ts`
- [x] Mapeo de métricas espectrales desde `TitanStabilizedState` a `SeleneMusicalPattern`
- [x] Debug log cada ~1s mostrando textura espectral

---

## SIGNIFICADO DE LAS MÉTRICAS

### Harshness (0-1)
- **Cálculo**: Ratio de energía en 2-5kHz vs energía total
- **0.0-0.3**: Sonido limpio, suave (piano, cuerdas, ambient)
- **0.3-0.6**: Medio, synths moderados (house, pop)
- **0.6-1.0**: Harsh, sucio (Skrillex, distorsión, industrial)

### Spectral Flatness (0-1)
- **Cálculo**: Mean geométrico / Mean aritmético del espectro
- **0.0-0.3**: Muy tonal (nota clara, voz, instrumentos melódicos)
- **0.3-0.6**: Mezcla (música con percusión y melodía)
- **0.6-1.0**: Muy ruidoso (hi-hats, crashes, white noise)

### Spectral Centroid (Hz)
- **Cálculo**: Centro de masa frecuencial ponderado por magnitud
- **< 1000 Hz**: Sonido oscuro, grave (bass music, dub)
- **1000-3000 Hz**: Medio (mayoría de la música)
- **> 3000 Hz**: Brillante, agudo (hi-hats dominantes, synths agudos)

---

## USO FUTURO

### En HuntEngine
```typescript
// Detectar transiciones de textura para triggers
if (pattern.harshness > 0.6 && pattern.harshness - prevHarshness > 0.2) {
  // Synth sucio entrando → trigger visual agresivo
}
```

### En ScenarioSimulator
```typescript
// Predecir intensidad visual según textura
const visualAggression = pattern.harshness * 0.5 + pattern.spectralFlatness * 0.3
```

### En Color Selection
```typescript
// Colores más saturados para textura agresiva
const saturationBoost = pattern.harshness * 0.2
```

---

## VERIFICACIÓN

### TypeScript Compile: ✅
- Solo errores pre-existentes (SimulateView, StageViewDual)
- Ningún error nuevo introducido por WAVE 661

### Debug Log Format
```
[SENSE 🎛️] Texture: HARSH/Dirty | Harsh=0.78 | Flat=0.20 | Centroid=2500Hz
[SENSE 🎛️] Texture: CLEAN/Tonal | Harsh=0.15 | Flat=0.25 | Centroid=1200Hz
[SENSE 🎛️] Texture: NOISE/Percussive | Harsh=0.30 | Flat=0.75 | Centroid=4500Hz
```

---

## NOTAS TÉCNICAS

### Defaults cuando no hay datos
- `harshness`: 0 (neutral/clean)
- `spectralFlatness`: 0 (tonal)
- `spectralCentroid`: 1000 (medio)

### Flujo de datos existente
Las métricas YA se calculan en FFT.ts desde WAVE 50.1. El trabajo de WAVE 661 fue **propagar** estos datos a través de:
1. Frontend (cuando envía audioFrame)
2. TitanOrchestrator → lastAudioData
3. EngineAudioMetrics → TitanEngine
4. TitanStabilizedState → MusicalPatternSensor
5. SeleneMusicalPattern → disponible para inteligencia

---

**WAVE 661 COMPLETE** ✅
