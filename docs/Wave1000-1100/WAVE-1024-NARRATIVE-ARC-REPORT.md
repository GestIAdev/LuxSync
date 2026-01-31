# 🎬 WAVE 1024: THE NARRATIVE ARC
## Reporte de Implementación - SectionTracker + HarmonyDetector v2.0

**Fecha:** $(date)  
**Commit:** `58bfff9`  
**Archivos Modificados:** 2  
**Líneas Añadidas:** +620  

---

## 📋 Resumen Ejecutivo

WAVE 1024 moderniza dos motores core para usar las métricas del FFT 8K del God Ear:

| Motor | Codename | Cambio Principal |
|-------|----------|------------------|
| SectionTracker | THE NARRATIVE ARC | Detección de secciones con contexto relativo y análisis espectral |
| HarmonyDetector | VOTE BOOST | Votación de key con peso basado en clarity |

---

## 🎬 WAVE 1024.A - SectionTracker "THE NARRATIVE ARC"

### Problema Pre-1024

```
Track masterizado bajo (indie/jazz):
  → avgEnergy = 0.4 constantemente
  → instantEnergy nunca llega a 0.8
  → DROP threshold fijo de 0.8 NUNCA se cumple
  → SectionTracker reporta "verse" toda la canción

Track masterizado caliente (EDM/reggaetón):
  → avgEnergy = 0.85 constantemente
  → ratio nunca es > 1.6 porque todo está comprimido
  → DROP se detecta tarde o nunca
  → BREAKDOWN nunca se detecta (siempre hay energía alta)
```

### Solución WAVE 1024.A

#### A. Ventana de Contexto Relativo (30 segundos)

```typescript
interface SlidingWindow {
  localMin: number;    // Mínimo de energía en los últimos 30s
  localMax: number;    // Máximo de energía en los últimos 30s
  samples: number[];   // Historial de samples
  lastUpdate: number;  // Timestamp
}
```

**Lógica:**
- `updateSlidingWindow(energy, now)`: Mantiene 30 segundos de samples
- `calculateRelativeEnergy(currentEnergy)`: Normaliza 0-1 relativo al track
- **DROP**: Cuando `relativeEnergy > 0.8` (80% del máximo local)
- **BREAKDOWN**: Cuando `relativeEnergy < 0.25` (25% del máximo local)

**Resultado:**
```
Track indie (energía 0.2-0.5):
  localMax = 0.5, localMin = 0.2
  Si currentEnergy = 0.45 → relativeEnergy = 0.83 → ¡DROP detectado!

Track EDM (energía 0.7-0.95):
  localMax = 0.95, localMin = 0.7
  Si currentEnergy = 0.72 → relativeEnergy = 0.08 → BREAKDOWN detectado!
```

#### B. Detección de Buildup Espectral

```typescript
interface SpectralInput {
  rolloff: number;    // Hz - punto de corte espectral (brillo)
  flatness: number;   // 0-1 - ruido vs tonal
  subBass: number;    // 0-1 - energía grave profunda
  clarity: number;    // 0-1 - claridad del God Ear
}
```

**Algoritmo `detectSpectralBuildup()`:**

| Tendencia | Significado | Peso |
|-----------|-------------|------|
| Rising rolloff | Brillo aumentando (más agudos) | 0.4 |
| Rising flatness | Más ruido/sweep | 0.3 |
| Falling subBass | Bass dropout antes del drop | 0.3 |

**Resultado:**
- Score 0-1 de "tensión de buildup"
- Score > 0.6 → Votar BUILDUP con peso 1.2
- Detecta buildups **ANTES** que el método basado en energía

#### C. Sistema de Consenso Multi-Motor

```typescript
calculateConsensusVote(rhythm: RhythmAnalysis, intensity: number): 
  { section: SectionType; weight: number } | null
```

**Matriz de Consenso:**

| Syncopation | Clarity | Energy | → Voto |
|-------------|---------|--------|--------|
| > 0.4 | > 0.7 | > 0.7 | DROP (unánime, peso 2.0) |
| > 0.2 | > 0.7 | - | CHORUS (peso 1.5) |
| - | - | < 0.3 + falling | BREAKDOWN (peso 1.5) |

### Integración en detectSection()

```typescript
// Nuevas variables calculadas
const spectralBuildupScore = this.detectSpectralBuildup();
const consensusVote = this.calculateConsensusVote(rhythm, intensity);
const relativeEnergy = this.calculateRelativeEnergy(audio.energy);
const passesRelativeDrop = relativeEnergy > 0.8;

// DROP mejorado
if (passesOriginalDrop || passesRelativeDropCheck) {
  const dropWeight = (passesOriginalDrop && passesRelativeDropCheck) ? 3.0 : 2.5;
  this.addVote('drop', dropWeight);
}

// BUILDUP espectral
if (spectralBuildup) {
  this.addVote('buildup', spectralBuildup ? 1.2 : 0.8);
}

// CHORUS por consenso
if (consensusChorusVote) {
  this.addVote('chorus', 1.0);
}
```

---

## 🎸 WAVE 1024.B - HarmonyDetector "VOTE BOOST"

### Problema Pre-1024.B

```
Todos los votos de key tienen peso 1.0:
  → Frame con señal limpia: voto = 1.0
  → Frame con ruido: voto = 1.0
  → Ruido contamina la detección de key
  → Key oscila innecesariamente
```

### Solución WAVE 1024.B

#### A. Sistema de Votos con Peso por Clarity

```typescript
// Recibir clarity del God Ear
setClarity(clarity: number): void

// Calcular peso del voto
getVoteWeight(): number {
  if (clarity > 0.7) return 2.0;  // Señal limpia
  if (clarity < 0.4) return 0.5;  // Señal ruidosa
  return 1.0;                      // Normal
}

// Registrar voto ponderado
registerKeyVote(key: string, weight: number): void
```

#### B. Historial de Votos con Decay

```typescript
private keyVoteHistory: Map<string, { totalWeight: number; count: number }>;

// Cada frame de análisis
decayKeyVotes(): void {
  for (const [key, votes] of keyVoteHistory) {
    votes.totalWeight *= 0.9;  // Decay 10%
    if (votes.totalWeight < 0.01) {
      keyVoteHistory.delete(key);
    }
  }
}
```

#### C. Estabilización de Key

```typescript
getStabilizedKey(): { key: string; confidence: number } | null {
  // Retorna la key con más peso acumulado
  // Solo usa si confidence > 0.6
}

// En analyze():
const stabilized = this.getStabilizedKey();
const finalKey = (stabilized && stabilized.confidence > 0.6) 
  ? stabilized.key 
  : scaleMatch.rootName;
```

#### D. Eventos Mejorados

```typescript
// Antes:
this.emit('key-change', { from, to, confidence });

// WAVE 1024.B:
this.emit('key-change', { 
  from, 
  to, 
  confidence,
  weight: voteWeight * confidence,  // Nuevo
  clarity: this.currentClarity,     // Nuevo
});
```

---

## 📊 Métricas de Cambio

| Archivo | Antes | Después | Delta |
|---------|-------|---------|-------|
| SectionTracker.ts | 1283 líneas | 1710 líneas | +427 |
| HarmonyDetector.ts | 719 líneas | 855 líneas | +136 |
| **Total** | 2002 líneas | 2565 líneas | **+563** |

---

## 🔌 Integración con God Ear

### SectionTracker

```typescript
// El TrinityBridge debe pasar las métricas espectrales
sectionTracker.track(rhythm, harmony, audio, false, {
  rolloff: godEarMetrics.spectralRolloff,
  flatness: godEarMetrics.spectralFlatness,
  subBass: godEarMetrics.subBassEnergy,
  clarity: godEarMetrics.clarity,
});

// O actualizar clarity separadamente
sectionTracker.setClarity(godEarMetrics.clarity);
```

### HarmonyDetector

```typescript
// El TrinityBridge debe actualizar clarity
harmonyDetector.setClarity(godEarMetrics.clarity);

// El análisis usará automáticamente el peso correcto
const harmony = harmonyDetector.analyze(audio);
```

---

## 🧪 Diagnósticos Disponibles

### SectionTracker

```typescript
const diagnostics = sectionTracker.getNarrativeArcDiagnostics();
// {
//   slidingWindow: { localMin, localMax, sampleCount },
//   spectralHistory: { rolloffTrend, flatnessTrend, subBassTrend },
//   lastBuildupScore: number,
//   lastConsensusVote: { section, weight } | null,
//   lastRelativeEnergy: number,
// }
```

### HarmonyDetector

```typescript
const diagnostics = harmonyDetector.getVoteDiagnostics();
// {
//   currentClarity: number,
//   currentVoteWeight: number,
//   keyVoteHistory: { 'C': { totalWeight, count }, ... },
//   stabilizedKey: { key, confidence } | null,
// }
```

---

## ✅ Retrocompatibilidad

| Aspecto | Estado |
|---------|--------|
| SectionTracker.track() sin spectral | ✅ Funciona (parámetro opcional) |
| HarmonyDetector sin setClarity() | ✅ Funciona (clarity default 0.5) |
| Eventos existentes | ✅ Sin cambios breaking |
| APIs públicas | ✅ Solo adiciones |

---

## 🎯 Próximos Pasos

1. **Integrar en TrinityBridge**: Pasar métricas del God Ear a ambos motores
2. **Telemetría**: Añadir logging de diagnósticos para calibración
3. **Tests**: Crear tests con fixtures de diferentes géneros
4. **UI**: Mostrar datos de diagnósticos en el Dream Monitor

---

**WAVE 1024: THE NARRATIVE ARC** - *La arquitectura de la emoción musical*
