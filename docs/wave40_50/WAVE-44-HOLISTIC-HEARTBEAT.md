# 🫀 WAVE 44.0 - HOLISTIC HEARTBEAT
## System-Wide Visibility Implementation

**Fecha**: 2024 - Post WAVE 41 Autopsia
**Objetivo**: El sistema estaba demasiado silencioso. Visibilidad holística para TODOS los motores.

---

## 📋 PROBLEMA DETECTADO

Tras la autopsia de WAVE 41, se descubrió que:
1. El sistema era **demasiado silencioso** - no había forma de saber qué pasaba internamente
2. GenreClassifier seguía inestable y la UI mostraba UNKNOWN
3. No había visibilidad del pipeline completo (qué keys llegaban de cada worker)

---

## 🛠️ IMPLEMENTACIÓN

### 1. HEARTBEAT en Worker BETA (`senses.ts`)
**Ubicación**: Línea 420+ (después del procesamiento de análisis)
**Frecuencia**: Cada 150 frames (~5 segundos)

```typescript
console.log('[BETA HEARTBEAT] 💓📡', JSON.stringify({
  frame: state.frameCount,
  rhythm: {
    bpm, syncSmoothed, pattern, confidence
  },
  harmony: {
    key, mode, mood, confidence
  },
  genre: {
    winner, scores: {...}, confidence
  },
  section: {
    type, energy, confidence
  }
}));
```

---

### 2. HEARTBEAT en Worker GAMMA (`mind.ts`)
**Ubicación**: Después del log DEBUG_VERBOSE (línea ~320)
**Frecuencia**: Cada 150 frames (~5 segundos)

```typescript
console.log('[GAMMA HEARTBEAT] 💓🧠', JSON.stringify({
  frame: state.frameCount,
  mode: state.operationMode,
  brainForced: state.brainForced,
  confidence: {
    combined, rhythm, harmony, section, genre
  },
  rhythm: {
    syncRaw, syncSmoothed, pattern, bpm
  },
  harmony: {
    key, mode, mood, temp
  },
  section: {
    type, energy
  },
  genre: {
    winner, scores, mood
  },
  personality: {
    mood, boldness
  },
  colorEngine: {
    paletteGenerated, strategy
  },
  perf: {
    decisions, avgMs
  }
}));
```

---

### 3. GenreClassifier `getDebugState()` Method
**Archivo**: `GenreClassifier.ts`
**Propósito**: Transparencia total en votos del Senate

```typescript
getDebugState(): {
  current: MacroGenre;
  scores: Record<MacroGenre, number>;
  smoothedSync: number;
  frameCount: number;
  switchMargin: number;
}
```

**Uso**: Permite que BETA HEARTBEAT incluya `genreClassifier.getDebugState().scores` directamente.

---

### 4. Pipeline Audit en Main Process (`main.ts`)
**Ubicación**: Event listeners de Trinity
**Propósito**: Ver qué keys realmente llegan al Main Process

```typescript
// Cada 150 frames:
console.log('[PIPELINE AUDIT] 🔬 BETA→Main keys:', analysis keys)
console.log('[PIPELINE AUDIT] 🔬 GAMMA→Main keys:', decision keys)
```

---

## 📊 EJEMPLO DE OUTPUT ESPERADO

```
[BETA HEARTBEAT] 💓📡 {"frame":450,"rhythm":{"bpm":128,"syncSmoothed":"0.341","pattern":"4x4"},"harmony":{"key":"Cm","mode":"minor","mood":"dark"},"genre":{"winner":"ELECTRONIC_4X4","scores":{"ELECTRONIC_4X4":67,"LATINO_URBANO":23}}}

[GAMMA HEARTBEAT] 💓🧠 {"frame":450,"mode":"explore","confidence":{"combined":"0.78","rhythm":"0.85"},"personality":{"mood":"energetic","boldness":0.7},"colorEngine":{"strategy":"chromatic-wheel"}}

[PIPELINE AUDIT] 🔬 BETA→Main keys: bpm, energy, spectral, rhythm, harmony, genre
[PIPELINE AUDIT] 🔬 GAMMA→Main keys: palette, effects, timing, meta
```

---

## 🎯 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `src/main/workers/senses.ts` | BETA HEARTBEAT cada 150 frames |
| `src/main/workers/mind.ts` | GAMMA HEARTBEAT cada 150 frames |
| `src/main/selene-lux-core/engines/musical/classification/GenreClassifier.ts` | Método `getDebugState()` |
| `electron/main.ts` | Pipeline Audit para verificar keys |

---

## ✅ RESULTADO

Con esta implementación, cada 5 segundos el sistema emite:
1. **BETA HEARTBEAT**: Estado del análisis de audio (ritmo, armonía, género)
2. **GAMMA HEARTBEAT**: Estado del cerebro (personalidad, paleta, decisiones)
3. **PIPELINE AUDIT**: Verificación de que los datos fluyen correctamente

**VISIBILIDAD TOTAL ALCANZADA** 🎉
