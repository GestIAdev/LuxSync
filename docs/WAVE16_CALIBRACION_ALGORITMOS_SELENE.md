# 🔧 WAVE 16: CALIBRACIÓN DE ALGORITMOS SELENE
## Blueprint Técnico - Basado en Data Real de stabilizacion.md

**Fecha**: 2025-12-09  
**Versión**: 16.0  
**Estado**: Blueprint (No implementado)  
**Objetivo**: Recalibrar todos los umbrales y algoritmos de Selene basándose en la data real observada

---

## 📊 ANÁLISIS DE DATA REAL (stabilizacion.md)

### 1. MÉTRICAS OBSERVADAS EN CUMBIA/YOUTUBE

| Métrica | Mínimo | Máximo | Promedio | Notas |
|---------|--------|--------|----------|-------|
| **RawRMS** | 0.03 | 0.50 | ~0.22 | Pre-amp ×10 funcionando |
| **Energy** | 0.02 | 0.48 | ~0.22 | NUNCA llega a 0.7+ |
| **Bass** | 0.00 | 0.71 | ~0.25 | Saludable |
| **Mid** | 0.05 | 0.71 | ~0.35 | Ya no satura |
| **Treble** | 0.02 | 0.59 | ~0.20 | Saludable |
| **Syncopation** | 0.36 | 1.00 | ~0.65 | Cumbia bien detectada! |
| **BPM** | 93-98 | 93-98 | ~95 | Estable (cumbia) |
| **Genre** | CUMBIA | LATIN_POP | - | Correcto! |

### 2. PROBLEMA CRÍTICO: RGB ESTÁTICO

```
RGB en log: 238,91,43 (constante durante toda la canción)
```

**Diagnóstico**: El color NO cambia con la música. Esto indica que:
- `ProceduralPaletteGenerator` está generando la misma paleta
- O el flujo UI no está recibiendo actualizaciones
- O hay un bug en `brainOutputToColors()`

### 3. PROBLEMA: KEY/MOOD EPILÉPTICO

```
Key cycling: G → C# → F → D → C → A → G# → F → C#...
Mood cycling: happy → neutral → happy → neutral...
```

**Causa**: El Worker calcula Key/Mood cada frame, pero:
- `keyStabilityCounter` requiere 35% de votos (insuficiente)
- No hay smoothing en la UI
- Los cambios se propagan instantáneamente

---

## 🎯 INVENTARIO DE UMBRALES PROBLEMÁTICOS

### A. UMBRALES DE ENERGÍA (DEMASIADO ALTOS)

| Archivo | Línea | Umbral Actual | Uso | Data Real | Propuesta |
|---------|-------|---------------|-----|-----------|-----------|
| `TrinityBridge.ts` | 226 | `energy > 0.8` | Chase pattern | E=0.22 avg | `> 0.45` |
| `TrinityBridge.ts` | 246 | `energy > 0.7` | Chase movement | E=0.48 max | `> 0.40` |
| `TrinityBridge.ts` | 283 | `energy > 0.6` | Happy mood | E=0.22 avg | `> 0.35` |
| `TrinityBridge.ts` | 317 | `energy > 0.6` | Derived mood | E=0.22 avg | `> 0.35` |
| `TrinityBridge.ts` | 355 | `energy > 0.9` | Strobe trigger | NUNCA | `> 0.55` |
| `TrinityBridge.ts` | 683 | `energy > 0.7` | Section change | E=0.48 max | `> 0.40` |
| `MusicToLightMapper.ts` | 407 | `energy > 0.6` | Chase mode | E=0.22 avg | `> 0.35` |
| `MusicToLightMapper.ts` | 448 | `energy > 0.8` | Strobe intensity | NUNCA | `> 0.50` |
| `MovementEngine.ts` | 215 | `bass > 0.6` | Beat kick | B=0.25 avg | `> 0.40` |
| `EffectsEngine.ts` | 602 | `fragmentation > 0.5` | Prism active | - | OK |

### B. UMBRALES DE CONFIANZA

| Archivo | Línea | Umbral Actual | Uso | Problema |
|---------|-------|---------------|-----|----------|
| `MusicalContextEngine.ts` | 21 | `< 0.5` | Reactive mode | OK |
| `SeleneMusicalBrain.ts` | 211 | `0.6` | Memory threshold | OK |
| `TrinityBridge.ts` | 270 | `>= 0.5` | Intelligent mode | OK |
| `TrinityBridge.ts` | 930 | `> 0.5` | Key change | **Demasiado bajo** → `0.65` |

### C. UMBRALES DE BANDAS FFT

| Archivo | Línea | Umbral Actual | Uso | Data Real | Propuesta |
|---------|-------|---------------|-----|-----------|-----------|
| `TrinityBridge.ts` | 358 | `treble > 0.8` | Laser trigger | T=0.59 max | `> 0.50` |
| `TrinityBridge.ts` | 417 | `bass > 0.6` | Kick detect | B=0.71 max | `> 0.45` |
| `TrinityBridge.ts` | 419 | `mid > 0.5` | Snare detect | M=0.71 max | OK |
| `TrinityBridge.ts` | 566 | `treble > 0.5 && bass > 0.5` | EDM detect | - | OK |

---

## 🧠 FLUJO DE DATOS SELENE

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUDIO PIPELINE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  YouTube/Desktop ──► getDisplayMedia ──► Pre-Amp (×10) ──► Worker   │
│                                                                      │
│  Worker (TrinityBridge.ts):                                         │
│    ├── FFT.ts (Cooley-Tukey) ──► Bass/Mid/Treble (0-1)             │
│    ├── BeatDetector (AGC) ──► BPM, OnBeat, Phase                   │
│    └── SimpleHarmonyDetector ──► Key, Mood, Temperature             │
│                                                                      │
│  Output: TrinityAudioAnalysis { energy, syncopation, key, mood }    │
│                                                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SELENE BRAIN                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SeleneLux.processAudioFrame(metrics, beat):                        │
│    │                                                                 │
│    ├── metricsToAudioAnalysis() ──► AudioAnalysis struct            │
│    │                                                                 │
│    └── brain.process(audioAnalysis):                                │
│          │                                                           │
│          ├── MusicalContextEngine.process()                         │
│          │     ├── RhythmAnalyzer (syncopation, groove)             │
│          │     ├── GenreClassifier (cumbia, reggaeton, etc)         │
│          │     └── calculateOverallConfidence()                      │
│          │           └── confidence >= 0.5 ? intelligent : reactive │
│          │                                                           │
│          ├── IF INTELLIGENT MODE:                                    │
│          │     ├── consultMemory() → pattern?                       │
│          │     └── ProceduralPaletteGenerator.generatePalette()     │
│          │           ├── keyToHue(key, mood, mode, zodiac)          │
│          │           │     KEY → Círculo de Quintas → Hue base      │
│          │           │     MOOD → Fallback si no hay Key            │
│          │           │     ZODIAC → 30% shift elemental             │
│          │           ├── ENERGY → Saturación + Brillo (NO Hue!)     │
│          │           └── SYNCOPATION → Estrategia de color          │
│          │                                                           │
│          └── IF REACTIVE MODE:                                       │
│                └── generateFallbackPalette(energy)                   │
│                      └── Paleta básica basada solo en energía        │
│                                                                      │
│  Output: BrainOutput { palette, lighting, estimatedBeauty }         │
│                                                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        COLOR OUTPUT                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  brainOutputToColors(output):                                       │
│    ├── hslToRgb(palette.primary) ──► RGB                            │
│    ├── hslToRgb(palette.secondary) ──► RGB                          │
│    ├── hslToRgb(palette.accent) ──► RGB                             │
│    └── Apply globalIntensity/globalSaturation multipliers           │
│                                                                      │
│  ❌ BUG ENCONTRADO: RGB=238,91,43 estático en todo el log           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 DIAGNÓSTICO: ¿POR QUÉ RGB ESTÁTICO?

### Hipótesis 1: Key Nulo → Mood Fallback → Mismo Hue

```typescript
// ProceduralPaletteGenerator.ts línea 575-590
keyToHue(key, mood, mode, zodiacElement):
  if (key) {
    baseHue = KEY_TO_HUE[key]  // Círculo de quintas
  } else {
    // SIN KEY → Usa MOOD
    baseHue = MOOD_TO_HUE[mood] ?? 280  // Magenta neutral
  }
```

**Problema**: Si `key` es siempre null en el flujo principal (aunque el Worker lo detecte), el color siempre será determinado por `mood`.

**Log Evidence**:
```
Mood cycling: happy ↔ neutral
MOOD_TO_HUE['happy'] = 45 (Amarillo-Naranja)
MOOD_TO_HUE['neutral'] = 280 (Magenta)
```

Pero RGB=238,91,43 es **Naranja** (H≈25°), lo que sugiere que ni siquiera el mood está llegando correctamente.

### Hipótesis 2: Modo Reactivo Siempre Activo

```typescript
// MusicalContextEngine.ts
if (this.currentMode === 'reactive' || !this.hasValidAnalysis()) {
  result = this.fallbackReactiveMode(audio)
}
```

Si `overallConfidence < 0.5` siempre, Selene está en modo **reactivo permanente**, y la paleta es generada por `generateFallbackPalette()` que solo usa energía:

```typescript
// SeleneMusicalBrain.ts - generateFallbackPalette()
const palette = this.generateFallbackPalette(energy);
// → Paleta básica sin Key/Mood/Género
```

### Hipótesis 3: IPC Bridge No Actualiza Colores

El log muestra que **telemetryStore** recibe los datos, pero el componente visual puede no estar suscrito a cambios de color.

---

## 📐 PROPUESTA DE RECALIBRACIÓN (MODO EXPERTO)

### FASE 1: Normalización Adaptativa (Rolling Peak)

**Problema**: Energy típica 0.15-0.48, pero umbrales asumen 0.6-0.9
**Riesgo Anterior**: Multiplicador fijo (×2.5) satura cuando entra canción fuerte

**Solución PRO**: Normalización Adaptativa con "Rolling Max Peak"

```typescript
// PROPUESTA: utils/AdaptiveEnergyNormalizer.ts

export class AdaptiveEnergyNormalizer {
  private rollingMaxWindow: number[] = [];
  private readonly WINDOW_SIZE = 450;  // 15 segundos @ 30fps
  private readonly MIN_PEAK = 0.05;    // Valor mínimo protector
  private currentPeakMax: number = 0.1;
  
  /**
   * 🧬 NORMALIZACIÓN ADAPTATIVA
   * 
   * Selene recuerda el PICO MÁXIMO de los últimos 15 segundos.
   * Energía Real = Energía Actual / Pico Máximo Rodante
   * 
   * Resultado:
   * - Canción bajita → Selene sube sensibilidad automáticamente
   * - Canción fuerte → Selene baja sensibilidad automáticamente
   * - Siempre: Rango dinámico completo (0-1) sin ajustes manuales
   * 
   * "La sensibilidad de Selene se ajusta al volumen del momento" - Wave 16
   */
  normalize(rawEnergy: number): number {
    // 1. Agregar energía actual al ventana rodante
    this.rollingMaxWindow.push(rawEnergy);
    if (this.rollingMaxWindow.length > this.WINDOW_SIZE) {
      this.rollingMaxWindow.shift();
    }
    
    // 2. Calcular pico máximo en la ventana
    this.currentPeakMax = Math.max(
      ...this.rollingMaxWindow,
      this.MIN_PEAK
    );
    
    // 3. Normalizar: energía actual / pico máximo
    let normalized = rawEnergy / this.currentPeakMax;
    
    // 4. Aplicar curve de suavizado (power law para percepción logarítmica)
    // Las variaciones pequeñas importan más en niveles bajos
    normalized = Math.pow(normalized, 0.9);
    
    // 5. Clamear a [0, 1]
    return Math.min(1.0, Math.max(0, normalized));
  }
  
  /**
   * Reset la ventana (ej: cambio de canción)
   */
  reset(): void {
    this.rollingMaxWindow = [];
    this.currentPeakMax = 0.1;
  }
  
  /**
   * Obtener el pico actual (para debug/telemetría)
   */
  getCurrentPeak(): number {
    return this.currentPeakMax;
  }
}
```

**Integración en Flujo**:

```typescript
// TrinityBridge.ts - Worker

private energyNormalizer = new AdaptiveEnergyNormalizer();

analyze(frame: AudioFrame): TrinityAudioAnalysis {
  const rawEnergy = calculateEnergy(frame);
  
  // Normalización adaptativa (remota del pico de 15s)
  const normalizedEnergy = this.energyNormalizer.normalize(rawEnergy);
  
  // Ahora se usan los umbrales con energía adaptativa
  const shouldChase = normalizedEnergy > 0.70;  // Consistente en cualquier masterización
  const shouldStrobe = normalizedEnergy > 0.80;
  
  return {
    energy: normalizedEnergy,  // Ya normalizado
    // ... resto de métricas
  };
}
```

**Ventajas**:
- ✅ NO requiere calibración manual por canción
- ✅ Funciona con YouTube (pueden ser anuncios bajitos)
- ✅ Funciona con anuncios fuertes (sin saturation)
- ✅ Mantiene rango dinámico (0-1) sempre
- ✅ Transparente para resto del código (solo cambia el valor de energía)

**Aplicar en**:
- `TrinityBridge.ts`: Worker actualiza energía con normalización
- `SeleneMusicalBrain.ts`: Recibe energía ya normalizada
- `MusicToLightMapper.ts`: Recibe energía ya normalizada

### FASE 2: Estabilización de Key con Votación Ponderada

**Problema**: Key cambia cada frame (G→C#→F→D...)
**Mejora PRO**: No todos los frames valen lo mismo. La energía determina el peso.

**Lógica**: "Si lo oigo fuerte, me fío más"

```typescript
// PROPUESTA: TrinityBridge.ts - SimpleHarmonyDetector mejorado

class SimpleHarmonyDetector {
  private noteHistorySize = 128;           // Más historia
  private noteHistory: NoteVote[] = [];    // NUEVO: Con peso
  private stabilityThreshold = 0.45;       // Más estricto
  private keyLockFrames = 90;              // Lock por 3s @ 30fps
  private currentKeyLock = 0;
  private lockedKey: string | null = null;
  
  /**
   * 🎵 VOTACIÓN PONDERADA
   * 
   * Cada nota tiene un peso basado en la energía cuando fue detectada.
   * 
   * Ejemplo:
   * - Frame fuerte (E=0.45): Vota por "C" con peso 0.45
   * - Frame débil (E=0.05): Vota por "C#" con peso 0.05
   * 
   * Resultado: Cambios de tonalidad erráticos en silencios/bajadas NO afectan
   */
  addNoteVote(note: string, energy: number): void {
    // Energy actúa como confianza del voto
    const weight = Math.pow(energy, 1.2); // Exponencial para favorecer momentos fuertes
    
    this.noteHistory.push({
      note,
      weight,
      timestamp: Date.now(),
    });
    
    if (this.noteHistory.length > this.noteHistorySize) {
      this.noteHistory.shift();
    }
  }
  
  private countWeightedVotes(): Record<string, number> {
    const votes: Record<string, number> = {};
    
    for (const vote of this.noteHistory) {
      votes[vote.note] = (votes[vote.note] || 0) + vote.weight;
    }
    
    return votes;
  }
  
  detectKey(): { key: string | null; confidence: number } {
    // Si hay lock activo, mantenerlo
    if (this.currentKeyLock > 0 && this.lockedKey) {
      this.currentKeyLock--;
      return { key: this.lockedKey, confidence: 0.85 };
    }
    
    // Contar votos PONDERADOS (no simples)
    const weightedVotes = this.countWeightedVotes();
    const maxWeight = Math.max(...Object.values(weightedVotes));
    const totalWeight = Object.values(weightedVotes).reduce((a, b) => a + b, 0);
    const confidence = totalWeight > 0 ? maxWeight / totalWeight : 0;
    
    // Cambiar key solo si:
    // 1. Confianza >= threshold
    // 2. Es diferente del key locked
    if (confidence >= this.stabilityThreshold) {
      const newKey = Object.entries(weightedVotes)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;
      
      if (newKey && newKey !== this.lockedKey) {
        // Cambio válido → Activar lock
        this.lockedKey = newKey;
        this.currentKeyLock = this.keyLockFrames;
        console.log(`[Key] Changed to ${newKey} (confidence: ${confidence.toFixed(2)}, locked for 3s)`);
      }
      
      return { key: newKey, confidence };
    }
    
    // Sin confianza suficiente → Mantener key anterior
    return { key: this.lockedKey, confidence: Math.max(0, confidence * 0.7) };
  }
  
  private getKeyWithMaxWeight(votes: Record<string, number>): string | null {
    const maxEntry = Object.entries(votes)
      .sort(([, a], [, b]) => b - a)[0];
    return maxEntry ? maxEntry[0] : null;
  }
}

interface NoteVote {
  note: string;
  weight: number;  // Basado en energía (0-1)
  timestamp: number;
}
```

**Ventajas**:
- ✅ Elimina cambios de tonalidad en silencios
- ✅ Favorece detecciones en momentos musicales fuertes
- ✅ Mantiene lock de 3 segundos para coherencia visual
- ✅ "Si lo oigo fuerte, cambio de tonalidad; si es débil, ignoro"

### FASE 3: Hysteresis Triggers (Schmitt Trigger)

**Problema**: Efectos (Strobe, Chase) parpadean si energía oscila en el borde (efecto "metralleta")
**Mejora PRO**: Usar Schmitt Triggers - Umbrales diferentes para ON/OFF

**Lógica**: 
- Para **ACTIVAR**: Energía debe superar `THRESHOLD_ON` (subida rápida)
- Para **DESACTIVAR**: Energía debe bajar de `THRESHOLD_OFF` (histeresis)
- Si oscila entre ON_OFF, mantiene estado anterior (evita flicker)

```typescript
// PROPUESTA: utils/HysteresisTrigger.ts

export class HysteresisTrigger {
  private state: boolean = false;
  private readonly thresholdOn: number;
  private readonly thresholdOff: number;
  private readonly name: string;
  
  /**
   * 🔄 SCHMITT TRIGGER (Histéresis)
   * 
   * Previene el efecto "metralleta" cuando la energía oscila.
   * 
   * Ejemplo: Strobe
   * ┌─────────────────────────────────────────┐
   * │ Energía: ────────▄▄▄▄▀▀▀─ (oscila)      │
   * │           0.60  0.70 0.50                │
   * │                                          │
   * │ Strobe ON_THRESHOLD = 0.70              │
   * │ Strobe OFF_THRESHOLD = 0.50             │
   * │                                          │
   * │ Comportamiento:                         │
   * │ - Sube a 0.70 → ENCIENDE (cruza ON)    │
   * │ - Oscila entre 0.60-0.70 → SIGUE ON    │
   * │ - Baja a 0.50 → APAGA (cruza OFF)      │
   * │                                          │
   * │ Resultado: 1 evento ON, 1 OFF           │
   * │ Sin: 20 eventos ON/OFF/ON/OFF/... (💥)  │
   * └─────────────────────────────────────────┘
   */
  constructor(
    name: string,
    thresholdOn: number,
    thresholdOff: number
  ) {
    this.name = name;
    this.thresholdOn = thresholdOn;
    this.thresholdOff = thresholdOff;
    
    if (thresholdOff >= thresholdOn) {
      throw new Error(`HysteresisTrigger: OFF (${thresholdOff}) must be < ON (${thresholdOn})`);
    }
  }
  
  /**
   * Procesa valor de energía con histéresis
   * Retorna true si estado cambió
   */
  process(energy: number): boolean {
    const previousState = this.state;
    
    if (!this.state && energy > this.thresholdOn) {
      // Transición: OFF → ON
      this.state = true;
    } else if (this.state && energy < this.thresholdOff) {
      // Transición: ON → OFF
      this.state = false;
    }
    // Si energía está entre OFF y ON, no cambiar estado (histéresis)
    
    return this.state !== previousState;
  }
  
  /**
   * Obtiene el estado actual
   */
  getState(): boolean {
    return this.state;
  }
  
  /**
   * Reset del trigger
   */
  reset(): void {
    this.state = false;
  }
}
```

**Integración en TrinityBridge**:

```typescript
// TrinityBridge.ts - Constructor

class TrinityBridge extends EventEmitter {
  // Triggers con histéresis
  private strobeTrigger = new HysteresisTrigger('strobe', 0.80, 0.55);
  private chaseTrigger = new HysteresisTrigger('chase', 0.70, 0.45);
  private laserTrigger = new HysteresisTrigger('laser', 0.65, 0.40);
  private pulseTrigger = new HysteresisTrigger('pulse', 0.50, 0.30);
  
  analyze(frame: AudioFrame): TrinityAudioAnalysis {
    const normalizedE = this.energyNormalizer.normalize(rawEnergy);
    
    // Aplicar Schmitt triggers
    const strobeTriggered = this.strobeTrigger.process(normalizedE);
    const chaseTriggered = this.chaseTrigger.process(normalizedE);
    const laserTriggered = this.laserTrigger.process(normalizedE);
    
    return {
      energy: normalizedE,
      strobe: this.strobeTrigger.getState(),      // Estado actual (ON/OFF)
      chase: this.chaseTrigger.getState(),
      laser: this.laserTrigger.getState(),
      pulse: this.pulseTrigger.getState(),
      // ... resto
    };
  }
}
```

**Configuración de Umbrales (ejemplo)**:

| Efecto | ON Threshold | OFF Threshold | Banda Energía Activa |
|--------|--------------|---------------|---------------------|
| **Pulse** | 0.50 | 0.30 | 0.30-1.0 (siempre algo) |
| **Chase** | 0.70 | 0.45 | 0.45-1.0 (movimiento) |
| **Strobe** | 0.80 | 0.55 | 0.55-1.0 (picos) |
| **Laser** | 0.65 | 0.40 | 0.40-1.0 (efectos) |
| **Prism** | 0.75 | 0.50 | 0.50-1.0 (parpadeo) |

**Ventajas**:
- ✅ Elimina el efecto "metralleta" (flicker indeseado)
- ✅ Transiciones suaves y profesionales
- ✅ Banda muerta entre ON/OFF evita oscilaciones
- ✅ Mantiene estado hasta cambio claro
- ✅ Se siente más "intencional" y "humano"

### FASE 4: Recalibración de Umbrales (Con Adaptatividad)

**Principio**: Ya NO usamos umbrales "duros", ahora usamos:
1. **Normalización Adaptativa** (Rolling Peak) para energía
2. **Votación Ponderada** (por energía) para Key
3. **Schmitt Triggers** (histéresis) para efectos

**Archivo**: `TrinityBridge.ts` - Refactorización

```typescript
// ANTES (umbrales "duros" calibrados a data media)
if (energy > 0.8) return 'chase';      // Nunca se activa (E=0.22 avg)
if (energy > 0.6) mood = 'happy';      // Nunca se activa
if (energy > 0.9) strobe = true;       // Nunca se activa

// DESPUÉS (con normalización adaptativa)
const normalizedE = this.energyNormalizer.normalize(rawEnergy);
if (normalizedE > 0.70) return 'chase';     // Se activa cuando hay energía relativa alta
if (normalizedE > 0.55) mood = 'happy';     // Se activa en momentos alegres
if (this.strobeTrigger.process(normalizedE)) strobe = true;  // Con histéresis
```

**Archivo**: `ProceduralPaletteGenerator.ts` - Saturación Dinámica

```typescript
// ANTES (energía bruta de 0-0.5 produce colores apagados)
const energySat = 50 + fullDNA.energy * 50;    // 0.22 → 61% sat (pálido)
const energyLight = 40 + fullDNA.energy * 30;  // 0.22 → 47% light

// DESPUÉS (energía normalizada de 0-1 produce colores vibrantes)
const normalizedE = normalizeEnergyForThresholds(fullDNA.energy);
const energySat = 45 + normalizedE * 55;       // 0.5 → 72.5% sat (vibrante)
const energyLight = 38 + normalizedE * 42;     // 0.5 → 59% light (brillante)
```

**Archivo**: `MusicToLightMapper.ts` - Intensidades

```typescript
// ANTES
const intensity = normalizedE > 0.6 ? 255 : Math.round(normalizedE * 200);

// DESPUÉS (usa el mismo normalizedE del Worker)
const intensity = Math.round(100 + normalizedE * 155);  // 100-255
const strobe = this.strobeTrigger.getState() ? 150 + normalizedE * 105 : 0;
```

**Tabla de Referencia**: Qué se activa en cada nivel de energía normalizada

| Energía Normalizada | Activaciones | Mood | Efecto Visual |
|------|------|------|------|
| 0.0-0.3 | Pulse básico | Neutral | Luz ambiental constante |
| 0.3-0.5 | Pulse + Laser | Universal | Brillo moderado |
| 0.5-0.7 | Pulse + Laser + Chase | Happy | Colores vibrantes, movimiento |
| 0.7-0.85 | Pulse + Laser + Chase + Strobe | Energetic | Flash ocasional |
| 0.85-1.0 | Todos los efectos | Epic | Estrobo intenso, máxima energía |

### FASE 5: Fix del RGB Estático + Smoothing de Mood en UI

**Problema 1: RGB Estático**

Investigar en orden:

1. **Verificar que Key llega al Brain**:
   ```typescript
   // SeleneMusicalBrain.ts - processIntelligentMode()
   const detectedKey = context.harmony?.key ?? null;
   console.log(`[Brain] Key from context: ${detectedKey}`);
   console.log(`[Brain] Mood: ${context.mood}`);
   ```

2. **Verificar que ProceduralPaletteGenerator recibe Key**:
   ```typescript
   // ProceduralPaletteGenerator.ts - generatePalette()
   const fullDNA = { ...DEFAULT_DNA, ...dna };
   console.log(`[Palette] DNA.key=${fullDNA.key}, DNA.mood=${fullDNA.mood}`);
   ```

3. **Verificar que brainOutputToColors se ejecuta**:
   ```typescript
   // SeleneLux.ts - brainOutputToColors()
   const primaryRGB = this.hslToRgb(palette.primary);
   console.log(`[SeleneLux] Primary HSL: H=${palette.primary.h}, RGB: ${primaryRGB}`);
   ```

4. **Verificar IPC al Renderer**:
   ```typescript
   // main.ts - donde se envíe al renderer
   console.log(`[IPC] Sending colors to UI: ${JSON.stringify(colorOutput)}`);
   ```

**Problema 2: Mood Epiléptico en UI**

**Solución**: Smoothing en telemetryStore (Renderer) + Cooldown

```typescript
// PROPUESTA: telemetryStore.ts - Smoothing de valores volátiles

interface SmoothedState {
  mood: string;
  moodConfidence: number;
  moodLastChange: number;
  
  key: string | null;
  keyConfidence: number;
  keyLastChange: number;
}

const MOOD_CHANGE_COOLDOWN_MS = 2000;  // 2 segundos mínimo entre cambios
const KEY_CHANGE_COOLDOWN_MS = 3000;   // 3 segundos (sincroniza con Worker lock)

class SmoothedTelemetryStore {
  private smoothed: SmoothedState = {
    mood: 'neutral',
    moodConfidence: 0,
    moodLastChange: Date.now(),
    key: null,
    keyConfidence: 0,
    keyLastChange: Date.now(),
  };
  
  /**
   * 🎭 UPDATE MOOD CON COOLDOWN
   * 
   * Solo cambia el mood si:
   * 1. Han pasado > 2 segundos desde el último cambio
   * 2. La confianza es > 0.6
   * 3. El nuevo mood es diferente
   * 
   * "El mood de Selene no cambia cada frame, solo cuando hay certeza"
   */
  updateMood(newMood: string, confidence: number): string {
    const now = Date.now();
    const timeSinceLastChange = now - this.smoothed.moodLastChange;
    
    // Aplicar cooldown + confianza + cambio
    if (
      timeSinceLastChange > MOOD_CHANGE_COOLDOWN_MS &&
      confidence > 0.6 &&
      newMood !== this.smoothed.mood
    ) {
      console.log(`[TelemetryStore] Mood: ${this.smoothed.mood} → ${newMood} (conf: ${confidence.toFixed(2)})`);
      this.smoothed.mood = newMood;
      this.smoothed.moodConfidence = confidence;
      this.smoothed.moodLastChange = now;
    }
    
    return this.smoothed.mood;
  }
  
  /**
   * 🎵 UPDATE KEY CON COOLDOWN
   * 
   * Sincronizado con el lock de 3 segundos del Worker
   * Solo cambia si worker detectó cambio + cooldown pasó
   */
  updateKey(newKey: string | null, confidence: number): string | null {
    const now = Date.now();
    const timeSinceLastChange = now - this.smoothed.keyLastChange;
    
    if (
      timeSinceLastChange > KEY_CHANGE_COOLDOWN_MS &&
      confidence > 0.65 &&
      newKey !== this.smoothed.key
    ) {
      console.log(`[TelemetryStore] Key: ${this.smoothed.key} → ${newKey} (conf: ${confidence.toFixed(2)})`);
      this.smoothed.key = newKey;
      this.smoothed.keyConfidence = confidence;
      this.smoothed.keyLastChange = now;
    }
    
    return this.smoothed.key;
  }
  
  /**
   * Obtener estado suavizado actual
   */
  getSmoothedState(): SmoothedState {
    return { ...this.smoothed };
  }
}
```

**Integración en IPC Listener** (Renderer):

```typescript
// ipcRenderer.on('audio-telemetry', (data) => {
//   const cleanedData = {
//     mood: telemetryStore.updateMood(data.mood, data.moodConfidence),
//     key: telemetryStore.updateKey(data.key, data.keyConfidence),
//     energy: data.energy,  // Este SÍ actualiza cada frame
//     ... resto de datos
//   };
//   
//   // Emitir al store de UI con datos suavizados
//   useAudioTelemetry.setState(cleanedData);
// })
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN (ACTUALIZADO)

### Wave 16.1: Diagnóstico RGB
- [ ] Agregar logs de diagnóstico en flujo de color
- [ ] Identificar dónde se "congela" el RGB
- [ ] Documentar causa raíz

### Wave 16.2: Normalización Adaptativa  
- [ ] Crear `AdaptiveEnergyNormalizer.ts` (Rolling Peak 15s)
- [ ] Integrar en TrinityBridge.ts (Worker)
- [ ] Integrar en SeleneMusicalBrain.ts
- [ ] Integrar en MusicToLightMapper.ts
- [ ] Validar que energía normalizada siempre está 0-1
- [ ] Test: Canción bajita vs fuerte (mismo rango dinámico)

### Wave 16.3: Votación Ponderada + Schmitt Triggers
- [ ] Crear `HysteresisTrigger.ts` (Schmitt triggers)
- [ ] Implementar votación ponderada en SimpleHarmonyDetector
- [ ] Agregar NoteVote interface con weight
- [ ] Integrar 5 Schmitt triggers (pulse, chase, strobe, laser, prism)
- [ ] Configurar umbrales ON/OFF para cada efecto
- [ ] Test: Energía oscilante no causa flicker
- [ ] Test: Key estable > 3 segundos

### Wave 16.4: Smoothing de Mood/Key en UI
- [ ] Crear `SmoothedTelemetryStore` en telemetryStore.ts
- [ ] Implementar cooldown de 2s para mood changes
- [ ] Implementar cooldown de 3s para key changes
- [ ] Integrar en ipcRenderer listener
- [ ] Test: Mood/Key cambian solo cuando hay confianza alta
- [ ] Test: No hay cambios durante silencios

### Wave 16.5: Validación Completa
- [ ] Test con Cumbia (fuente original + log baseline)
- [ ] Test con Reggaeton (energía variable)
- [ ] Test con Balada (baja energía sostenida)
- [ ] Test con EDM (drops/buildups abruptos)
- [ ] Test con YouTube (anuncios débiles intercalados)
- [ ] Documentar nuevos rangos observados
- [ ] Capturar nuevo baseline `estabilizacion_v2.md`

---

## 📈 MÉTRICAS DE ÉXITO

| Métrica | Antes | Objetivo |
|---------|-------|----------|
| RGB cambios/min | 0 | > 10 |
| Key estabilidad | < 1s | > 3s |
| Mood estabilidad | < 0.5s | > 2s |
| Chase triggers/min | 0 | > 5 (en cumbia) |
| Strobe triggers/canción | 0 | > 10 (en drops) |
| Genre accuracy | 90% | 95% |

## 📈 MÉTRICAS DE ÉXITO (ACTUALIZADO)

| Métrica | Antes | Objetivo Pro |
|---------|-------|------------|
| **RGB cambios/min** | 0 (estático) | > 20 (dinámico) |
| **Key estabilidad** | < 1s (epiléptico) | > 3s (locked) |
| **Mood estabilidad** | < 0.5s (rápido) | > 2s (cooldown) |
| **Chase triggers/min** | 0 (nunca) | > 5-8 (en cumbia) |
| **Strobe triggers/canción** | 0 (nunca) | > 10-15 (en drops) |
| **Energy range utilizado** | 0.00-0.48 | 0.00-1.00 (normalizado) |
| **Flicker en bordes** | Sí (metralleta) | No (Schmitt trigger) |
| **Genre accuracy** | 90% | 95%+ |
| **Adaptación a masterización** | Manual | Automática (Rolling Peak) |
| **Profesionalismo visual** | 6/10 | 9/10 |

### Comparativa: Antes vs Después

**ANTES (Sin optimizaciones)**:
```
Cumbia a volumen bajo:
├─ Energy: 0.22 avg
├─ RGB: 238,91,43 (congelado)
├─ Key: G→C#→F→D (cambia c/frame)
├─ Mood: happy↔neutral (parpadea)
├─ Chase: No se activa (E < 0.8 threshold)
├─ Strobe: No se activa (E < 0.9 threshold)
└─ Resultado: 4/10 (aburrido, estático)

YouTube con anuncio fuerte:
├─ Energy: 0.65 (pico anuncio)
├─ RGB: Salta a colores brillantes
├─ Chase: Se activa violentamente
├─ Strobe: Estrobo continuo (metralleta)
└─ Resultado: 3/10 (caótico, sin control)
```

**DESPUÉS (Con optimizaciones)**:
```
Cumbia a volumen bajo:
├─ Raw Energy: 0.22 → Normalized: 0.52
├─ RGB: Cambia (hue+saturación responde)
├─ Key: "G" por 3s, luego "C" por 3s (estable)
├─ Mood: "happy" por 2s, cambios intencionales
├─ Chase: Se activa (normalizedE > 0.70)
├─ Strobe: Ocasional en picos (normalizedE > 0.80)
└─ Resultado: 9/10 (dinámico, coherente)

YouTube con anuncio fuerte:
├─ Peak Max: 0.65 (actualiza Rolling Max)
├─ Raw Energy: 0.65 → Normalized: 0.98 (relativo)
├─ Pero después anuncio termina:
├─ Peak Max baja a 0.48 (ajuste automático)
├─ Raw Energy: 0.25 → Normalized: 0.59 (sensibilidad sube)
├─ Strobe: Histéresis evita flicker
└─ Resultado: 9/10 (adapta automáticamente)
```

---

## 🔮 ARQUITECTURA MEJORADA

```
┌─────────────────────────────────────────────────────────┐
│         AUDIO INPUT (Raw, cualquier masterización)      │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────▼───────────┐
         │ ROLLING PEAK TRACKER  │
         │ (15s window)          │
         │ peak = max(últimos)   │
         └───────────┬───────────┘
                     │
      ┌──────────────▼──────────────┐
      │ ADAPTIVE NORMALIZER         │
      │ energy = raw / peak         │
      │ Resultado: 0-1 siempre      │
      └──────────────┬──────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
  ┌──▼──┐      ┌─────▼─────┐    ┌───▼────┐
  │ FFTE │      │  HARMONY  │    │  BEAT  │
  │      │      │  + Weighted   │ (AGC)  │
  │      │      │  Voting   │    │        │
  └──┬───┘      └─────┬─────┘    └───┬────┘
     │                │              │
     └────────────────┼──────────────┘
                      │
          ┌───────────▼────────────┐
          │  TRINITY ANALYSIS      │
          │ (normalizedE, key, mood)
          └───────────┬────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
 ┌──▼──────┐   ┌──────▼──────┐   ┌─────▼─────┐
 │ SCHMITT │   │ SELENE BRAIN│   │ MOVEMENT  │
 │TRIGGERS │   │ Palette Gen │   │ ENGINE    │
 │ (ON/OFF)│   │ (Key→Hue)   │   │           │
 └──┬──────┘   └──────┬──────┘   └─────┬─────┘
    │                 │                │
    │ pulse,chase     │ RGB            │ pos,speed
    │ strobe,laser    │ sat,light      │
    │                 │                │
    └─────────────────┼────────────────┘
                      │
          ┌───────────▼────────────┐
          │  SMOOTHING STORE (UI)  │
          │ Cooldown + confidence  │
          │ mood/key no cambian    │
          │ cada frame             │
          └───────────┬────────────┘
                      │
                 ┌────▼────┐
                 │  RENDER  │
                 │  (UI)    │
                 └──────────┘
```

## 🔮 VISIÓN PROFESIONAL (WAVE 16 PRO)

### Objetivo Final: "DMX Automático Profesional de Clase World"

Para competir con sistemas profesionales como:
- **SoundSwitch** (Serato/Pioneer DJ)
- **LightJockey** (Martin)
- **GrandMA 3** (MA Lighting)
- **Resolume Avenue** (Projection mapping)

### Diferenciadores de Wave 16 Pro

| Característica | Solución Estándar | Wave 16 Pro |
|---|---|---|
| **Sensibilidad a volumen** | Umbrales fijos | Rolling Peak (15s) |
| **Key Detection** | Votación simple | Votación ponderada por energía |
| **Efectos ON/OFF** | Encender/apagar binario | Schmitt Triggers (histéresis) |
| **Mood/Key en UI** | Cambia cada frame | Cooldown de 2-3s |
| **Adaptación** | Manual por canción | Automática sin intervención |
| **Rango dinámico** | Limitado (0-0.5) | Completo (0-1) normalizado |
| **Profesionalismo** | "DJ Automático" | "Lighting Designer Automático" |

### Wave 16 Pro en Acción

**Escenario: DJ en vivo con YouTube + Canciones propias**

```
Minuto 0-5: Anuncio de YouTube (bajito, E=0.18)
├─ Rolling Peak: 0.18
├─ Normalized: 0.42 (Selene sube sensibilidad)
├─ Efectos: Pulse + Laser (sutilmente)
├─ Mood: Neutral (sin sobresaltos)
└─ Resultado: UI muestra algo, no "está muerto"

Minuto 5-10: Canción propia en Cumbia (masterización alta, E=0.45)
├─ Rolling Peak: Actualiza a 0.45
├─ Normalized: 0.88 (momento fuerte)
├─ Efectos: Chase activa, colores vibrantes
├─ Strobe: Ocasional en picos (Schmitt trigger evita flicker)
├─ Key: "G" durante 3s, sé que es salsa
└─ Resultado: Luces responden musicalmente

Minuto 10-15: Balada para baile lento (E=0.12)
├─ Rolling Peak: Baja gradualmente a 0.30
├─ Normalized: 0.40 (Selene re-sensibiliza)
├─ Efectos: Pulse + Ambient soft
├─ Mood: Peaceful, cambio a los 13:00 (no a los 10:05)
├─ RGB: Cálidos (rojo/naranja) según la tonalidad
└─ Resultado: Atmósfera íntima, no caótica
```

**Pro Tip**: Rolling Peak se resetea cada 15s automáticamente, pero se actualiza en tiempo real.
Si el DJ sube el volumen de la consola (no es una nueva canción), Selene se adapta en <1 segundo.

---

## � DIFERENCIAS CLAVE: Wave 16 Standard vs Wave 16 Pro

### 1. Normalización

**Standard**: `E = E × 2.5` (multiplicador fijo)
- ❌ Satura con canciones fuertes
- ❌ No responde con canciones débiles
- ❌ Requiere ajuste manual por fuente

**Pro**: `E = E / Peak(15s)` (adaptativo)
- ✅ Siempre rango 0-1 dinámico
- ✅ Automático sin intervención
- ✅ Funciona con cualquier masterización

### 2. Key Detection

**Standard**: Votación simple (más votos = gana)
- ❌ Cambios en silencios
- ❌ Ruidoso en cálculos FFT débiles
- ❌ Inestable

**Pro**: Votación ponderada (peso = energía)
- ✅ Cambios solo en momentos fuertes
- ✅ Ignora silencios/ruido
- ✅ Estable 3+ segundos

### 3. Efectos (Chase, Strobe, Laser)

**Standard**: ON si `E > threshold` / OFF si `E < threshold`
- ❌ Flicker "metralleta" si E oscila
- ❌ Sin control en transiciones
- ❌ Poco profesional

**Pro**: Schmitt Trigger (ON en 0.80, OFF en 0.55)
- ✅ Histéresis: no flicker
- ✅ Transiciones suaves
- ✅ Sensación "intencional"

### 4. UI Smoothing

**Standard**: Mood/Key actualizan cada frame
- ❌ Parpadea en pantalla
- ❌ Difícil de leer
- ❌ Visual amateur

**Pro**: Cooldown de 2-3s + confianza > 0.6
- ✅ Cambios legibles
- ✅ Visual profesional
- ✅ Usuario entiende decisiones

---

## 📝 RESUMEN EJECUTIVO

Este blueprint Wave 16 Pro implementa 3 mejoras fundamentales:

1. **Normalización Adaptativa** (Rolling Peak 15s)
   - Auto-ajuste de sensibilidad
   - Sin saturación en picos
   - Funciona con cualquier volumen

2. **Votación Ponderada + Schmitt Triggers**
   - Key estable 3+ segundos
   - Efectos sin flicker
   - Lógica musical (energía → peso)

3. **Smoothing en Renderer**
   - Mood/Key legibles
   - Cooldown evita cambios rápidos
   - Interfaz profesional

**Impacto Visual**:
- Antes: 4-6/10 (estático, epiléptico)
- Después: 9-9.5/10 (dinámico, coherente, profesional)

**Tiempo de Implementación**: 
- Wave 16.1-16.5: ~2-3 semanas (5 subtareas)
- Sin refactorización destructiva del código existente

**Próximo Paso**: Empezar Wave 16.1 (diagnosticar RGB estático)

---

*"Selene no solo escucha la música. Ahora la SIENTE, la adapta y la pinta con inteligencia."*  
*- Visión Wave 16 Pro*
