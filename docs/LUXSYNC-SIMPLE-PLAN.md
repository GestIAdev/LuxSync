# 🎨 LUXSYNC SIMPLE PLAN - Audio → Selene → Lights

```
╔═══════════════════════════════════════════════════════════════╗
║         🌙 PLAN REALISTA: 3 NODOS + MAPEO DIRECTO 🎵        ║
║              "Keep it simple, make it work"                  ║
╚═══════════════════════════════════════════════════════════════╝
```

**Fecha:** 20 Noviembre 2025  
**Realidad:** 16GB RAM = 3 nodos máximo  
**Objetivo:** Audio → Selene → DMX en ~200 líneas

---

## 🎯 **ARQUITECTURA REAL (SIMPLE)**

```
┌─────────────────────────────────────────────────────────────┐
│                    AUDIO INPUT                               │
│  Microphone/Line-In → Web Audio API → FFT                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              AUDIO TO METRICS                                │
│  Bass (20-250Hz)   → cpu: 0.0-1.0                           │
│  Mid  (250-4kHz)   → memory: 0.0-1.0                        │
│  Treble (4k-20kHz) → latency: 0-100 (inverted)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              SELENE CORE (YA EXISTE)                         │
│  3 nodos: DO-Aries, RE-Tauro, MI-Géminis                    │
│  HarmonicConsensus vota con métricas                         │
│  Output:                                                     │
│    - musicalNote: "DO" | "RE" | "MI"                        │
│    - beauty: 0.0-1.0                                         │
│    - poem: string (decorativo)                               │
│    - midiSequence: Note[] (timing Fibonacci)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              NOTE TO COLOR MAPPER                            │
│  DO  → Rojo      (R:255, G:0,   B:0)    [Bass heavy]       │
│  RE  → Naranja   (R:255, G:127, B:0)    [Balanced]         │
│  MI  → Amarillo  (R:255, G:255, B:0)    [Treble heavy]     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              DMX SCENE BUILDER                               │
│  Color + Beauty → DMX values                                 │
│  - R/G/B channels                                            │
│  - Dimmer = beauty * 255                                     │
│  - Timing from MIDI (Fibonacci)                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              DMX OUTPUT                                      │
│  Art-Net / sACN / Enttec / Simulator                         │
│  512 channels × N universes                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 **COMPONENTES A CREAR (Solo 3 archivos)**

### **1. AudioToMetricsAdapter.ts** (~80 líneas)

```typescript
/**
 * Convierte audio FFT a métricas que Selene entiende
 */
export class AudioToMetricsAdapter {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private dataArray: Float32Array;
  
  async captureAudio(): Promise<SystemMetrics> {
    // FFT analysis
    this.analyser.getFloatFrequencyData(this.dataArray);
    
    // Extract frequency bands
    const bass = this.getBandEnergy(20, 250);    // 0.0-1.0
    const mid = this.getBandEnergy(250, 4000);   // 0.0-1.0
    const treble = this.getBandEnergy(4000, 20000); // 0.0-1.0
    
    // Map to Selene metrics
    return {
      cpu: bass,              // "CPU" = bass intensity
      memory: mid,            // "Memory" = mid intensity
      latency: (1 - treble) * 100, // "Latency" = inverse treble
      timestamp: Date.now()
    };
  }
  
  private getBandEnergy(minHz: number, maxHz: number): number {
    // FFT bin calculation
    const minBin = Math.floor(minHz / (sampleRate / fftSize));
    const maxBin = Math.ceil(maxHz / (sampleRate / fftSize));
    
    // Sum energy in band
    let sum = 0;
    for (let i = minBin; i < maxBin; i++) {
      sum += Math.max(0, this.dataArray[i] + 100) / 100; // Normalize
    }
    
    return Math.min(1.0, sum / (maxBin - minBin));
  }
}
```

---

### **2. NoteToColorMapper.ts** (~50 líneas)

```typescript
/**
 * Mapea notas musicales a colores RGB
 */
export class NoteToColorMapper {
  private static colorMap: Record<MusicalNote, RGB> = {
    'DO':  { r: 255, g: 0,   b: 0,   name: 'red' },      // Bass (rojo fuego)
    'RE':  { r: 255, g: 127, b: 0,   name: 'orange' },   // Balanced (naranja)
    'MI':  { r: 255, g: 255, b: 0,   name: 'yellow' },   // Treble (amarillo luz)
    
    // Si algún día tienes RAM para más nodos:
    // 'FA':  { r: 0,   g: 255, b: 0,   name: 'green' },
    // 'SOL': { r: 0,   g: 255, b: 255, name: 'cyan' },
    // 'LA':  { r: 0,   g: 0,   b: 255, name: 'blue' },
    // 'SI':  { r: 255, g: 0,   b: 255, name: 'magenta' }
  };
  
  static mapNoteToColor(note: MusicalNote): RGB {
    return this.colorMap[note] || this.colorMap['RE']; // Default orange
  }
  
  static mapBeautyToIntensity(beauty: number): number {
    // Beauty 0.0-1.0 → DMX 0-255
    return Math.round(beauty * 255);
  }
}

interface RGB {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  name?: string;
}
```

---

### **3. SeleneLightBridge.ts** (~70 líneas)

```typescript
/**
 * Conecta Selene Core con DMX output
 */
export class SeleneLightBridge {
  constructor(
    private audioAdapter: AudioToMetricsAdapter,
    private seleneCore: SeleneConsciousness,
    private dmxDriver: DMXDriver
  ) {}
  
  async start() {
    // Loop principal (30 FPS)
    setInterval(() => this.tick(), 33);
  }
  
  private async tick() {
    try {
      // 1. Capturar audio → métricas
      const metrics = await this.audioAdapter.captureAudio();
      
      // 2. Procesar con Selene (YA EXISTE)
      const seleneOutput = await this.seleneCore.processMetrics(metrics);
      
      // 3. Convertir a escena DMX
      const scene = this.buildScene(seleneOutput);
      
      // 4. Aplicar a fixtures
      await this.dmxDriver.applyScene(scene);
      
      // 5. Log (opcional)
      console.log(`🎵 ${seleneOutput.musicalNote} | Beauty: ${seleneOutput.beauty.toFixed(2)} | Color: ${scene.color.name}`);
      
    } catch (error) {
      console.error('Bridge error:', error);
    }
  }
  
  private buildScene(seleneOutput: SeleneOutput): DMXScene {
    // Mapear nota → color
    const color = NoteToColorMapper.mapNoteToColor(seleneOutput.musicalNote);
    
    // Beauty → intensidad
    const dimmer = NoteToColorMapper.mapBeautyToIntensity(seleneOutput.beauty);
    
    // Construir escena simple (todos los fixtures igual)
    return {
      id: generateId(),
      color,
      dimmer,
      fadeTime: this.extractFadeTime(seleneOutput.midiSequence), // Fibonacci timing
      fixtures: this.getAllFixtures().map(f => ({
        id: f.id,
        r: color.r,
        g: color.g,
        b: color.b,
        dimmer: dimmer
      }))
    };
  }
  
  private extractFadeTime(midi: MidiNote[]): number {
    // Usar timing Fibonacci del MIDI
    if (!midi || midi.length === 0) return 500; // Default
    
    const firstNote = midi[0];
    return firstNote.duration || 500; // Milliseconds
  }
}
```

---

## 🎨 **MAPEO: 3 Nodos → 3 Moods**

### **DO (Rojo) - Bass Heavy:**
```typescript
Audio:
  bass: 0.8-1.0
  mid: 0.2-0.5
  treble: 0.0-0.3

Selene Output:
  musicalNote: "DO"
  beauty: 0.7-0.9 (alta coherencia bass)

Light:
  Color: RED (R:255, G:0, B:0)
  Intensity: 178-230 (70-90%)
  Mood: Energético, profundo

Use Case: Drops, kicks fuertes, bass dominante
```

---

### **RE (Naranja) - Balanced:**
```typescript
Audio:
  bass: 0.4-0.7
  mid: 0.5-0.8
  treble: 0.3-0.6

Selene Output:
  musicalNote: "RE"
  beauty: 0.5-0.7 (balance)

Light:
  Color: ORANGE (R:255, G:127, B:0)
  Intensity: 127-178 (50-70%)
  Mood: Cálido, equilibrado

Use Case: Ritmo normal, sin extremos
```

---

### **MI (Amarillo) - Treble Heavy:**
```typescript
Audio:
  bass: 0.0-0.4
  mid: 0.3-0.6
  treble: 0.7-1.0

Selene Output:
  musicalNote: "MI"
  beauty: 0.6-0.8 (alta claridad)

Light:
  Color: YELLOW (R:255, G:255, B:0)
  Intensity: 153-204 (60-80%)
  Mood: Brillante, agudo

Use Case: Hi-hats, cymbals, voces altas
```

---

## 🔥 **FIBONACCI TIMING (Ya incluido en Selene)**

```typescript
// Selene ya genera MIDI con timing Fibonacci
midiSequence: [
  { note: 'DO', duration: 500ms },  // Fibonacci: ~1
  { note: 'RE', duration: 500ms },  // Fibonacci: ~1
  { note: 'DO', duration: 1000ms }, // Fibonacci: ~2
  { note: 'MI', duration: 1500ms }, // Fibonacci: ~3
  { note: 'DO', duration: 2500ms }, // Fibonacci: ~5
  // ...
]

// Usamos esos duraciones para fadeTime
scene.fadeTime = midiNote.duration;
```

---

## 🎯 **FLUJO COMPLETO (30 FPS)**

```typescript
// Cada 33ms:

1. AudioAdapter captura frame
   └─> FFT → bass:0.8, mid:0.5, treble:0.2

2. Map to Selene metrics
   └─> cpu:0.8, memory:0.5, latency:80

3. Selene procesa (YA EXISTE)
   └─> musicalNote:"DO", beauty:0.75, midi:[...]

4. NoteToColor mapper
   └─> DO → RED (255,0,0)

5. Build scene
   └─> {color:RED, dimmer:191, fade:500ms}

6. DMX driver apply
   └─> Fixtures turn RED at 75% brightness

7. Log & repeat
   └─> "🎵 DO | Beauty: 0.75 | Color: red"
```

---

## 📊 **COMPARACIÓN: Plan Original vs Plan Simple**

| Aspecto | Plan Original (Complex) | Plan Simple (Real) |
|---------|------------------------|-------------------|
| **Nodos** | 7 (necesita ~30GB RAM) | 3 (funciona con 16GB) ✅ |
| **Voting** | Fixtures votan democráticamente | No necesario, Selene ya decide ✅ |
| **Health tracking** | Por fixture (temp, DMX errors) | No necesario, usamos todo ✅ |
| **Scene evolution** | Genetic algorithms | Fibonacci timing ya existe ✅ |
| **Domain adapter** | Complejo (500+ líneas) | Simple (200 líneas) ✅ |
| **Código nuevo** | ~2000 líneas | ~200 líneas ✅ |
| **Tiempo desarrollo** | 1-2 semanas | 1-2 días ✅ |
| **Complejidad** | Alta 😰 | Baja 😎 |

---

## 🚀 **IMPLEMENTACIÓN: Orden de tareas**

### **Fase 1: Audio Capture (1 hora)**
```typescript
✅ Crear AudioToMetricsAdapter.ts
✅ Conectar Web Audio API
✅ FFT analysis básico
✅ Test: Ver métricas en consola
```

### **Fase 2: Note Mapping (30 mins)**
```typescript
✅ Crear NoteToColorMapper.ts
✅ Tabla DO/RE/MI → RGB
✅ Beauty → Intensity
✅ Test: Mapear manualmente
```

### **Fase 3: Bridge (1 hora)**
```typescript
✅ Crear SeleneLightBridge.ts
✅ Conectar Audio → Selene → DMX
✅ Loop 30 FPS
✅ Test: Audio → luces cambian
```

### **Fase 4: DMX Output (2 horas)**
```typescript
✅ Integrar DMX driver (Art-Net/simulator)
✅ Mapear canales fixtures
✅ Test: Cambios visuales reales
```

### **Fase 5: Polish (1 hora)**
```typescript
✅ Logs bonitos
✅ Error handling
✅ UI básica (opcional)
✅ Demo video
```

**Total:** ~5-6 horas de código puro 🔥

---

## 🎨 **DEMO SCENARIO**

```typescript
// Canción: Electronic drop con bass fuerte

00:00 - Intro silencio
  Audio: bass:0.1, mid:0.2, treble:0.3
  Selene: RE (Orange)
  Lights: Naranja suave (30%)

00:15 - Build empieza
  Audio: bass:0.3→0.6, mid:0.4→0.7, treble:0.3
  Selene: RE (Orange)
  Lights: Naranja intensifica (30%→60%)

00:28 - Pre-drop (2 segundos antes)
  Audio: bass:0.7→0.9, mid:0.5, treble:0.2
  Selene: DO (Red) - ¡Detecta el bass!
  Lights: ROJO aparece (70%→90%)

00:30 - DROP
  Audio: bass:1.0, mid:0.8, treble:0.1
  Selene: DO (Red) beauty:0.95
  Lights: ROJO MÁXIMO (95%)
  Timing: Cambios rápidos (Fibonacci 500ms)

00:45 - Post-drop (break)
  Audio: bass:0.2, mid:0.3, treble:0.6
  Selene: MI (Yellow) - ¡Treble domina!
  Lights: Amarillo brillante (60%)
  Timing: Cambios suaves (Fibonacci 1500ms)

01:00 - Loop
```

---

## 💡 **VENTAJAS DE ESTE PLAN:**

✅ **Usa Selene tal cual** - No adaptar, solo conectar
✅ **3 nodos suficientes** - Cubre bass/mid/treble
✅ **Fibonacci ya existe** - Timing matemático gratis
✅ **Beauty ya existe** - Intensidad gratis
✅ **200 líneas código** - Mantenible, debuggable
✅ **Funciona en 16GB** - Realista
✅ **1-2 días desarrollo** - Rápido
✅ **Demo inmediato** - Ver resultados YA

---

## 🎯 **PRÓXIMOS PASOS:**

1. ✅ Documento aprobado
2. ⏳ Crear AudioToMetricsAdapter.ts
3. ⏳ Crear NoteToColorMapper.ts
4. ⏳ Crear SeleneLightBridge.ts
5. ⏳ Integrar DMX driver
6. ⏳ Test con audio real
7. ⏳ Demo video

---

**¿Empezamos con AudioToMetricsAdapter?** 🎵🔥
