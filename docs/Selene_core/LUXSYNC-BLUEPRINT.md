# 🎪 LUXSYNC - BLUEPRINT ARQUITECTÓNICO V2
## Sistema Inteligente de Sincronización Música → Iluminación DMX

---

**Versión**: 2.0 (Blueprint Final)  
**Fecha**: 30 de Noviembre 2025  
**Autor**: GeminiEnder + PunkClaude  
**Cliente**: El Casero 🎉  

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#-resumen-ejecutivo)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Modos de Operación](#-modos-de-operación)
4. [Capas del Sistema](#-capas-del-sistema)
5. [Sistema de Zonas](#-sistema-de-zonas)
6. [Flujo de Datos](#-flujo-de-datos)
7. [Integración Selene AI](#-integración-selene-ai)
8. [Componentes Técnicos](#-componentes-técnicos)
9. [Hardware Soportado](#-hardware-soportado)
10. [Roadmap de Integración](#-roadmap-de-integración)

---

## 📊 RESUMEN EJECUTIVO

### ¿Qué es LuxSync?

**LuxSync** es un sistema web que sincroniza automáticamente luces DMX512 con la música en tiempo real. Elimina la necesidad de un operador manual controlando las luces durante un show.

### El Problema

```
ANTES (FreeStyler):
┌─────────────────────────────────────────────────────────┐
│  DJ tocando  →  Operador con laptop  →  Luces          │
│      🎧              👨‍💻 (manual)          💡            │
│                                                         │
│  • 1 persona dedicada al 100%                          │
│  • Cientos de parámetros que ajustar                   │
│  • Sincronización imprecisa (reacción humana ~300ms)   │
│  • Software antiguo (FreeStyler de 2005)               │
│  • Fatiga del operador en shows largos                 │
└─────────────────────────────────────────────────────────┘
```

### La Solución

```
DESPUÉS (LuxSync):
┌─────────────────────────────────────────────────────────┐
│  DJ tocando  →  LuxSync AI  →  Luces (automático)      │
│      🎧            🤖              💡                   │
│                                                         │
│  • 0 operadores necesarios                             │
│  • Audio FFT → Decisiones automáticas                  │
│  • Sincronización perfecta (<33ms)                     │
│  • Aprende con el tiempo (Selene AI)                   │
│  • Funciona 24/7 sin fatiga                            │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Diagrama de Alto Nivel

```
╔══════════════════════════════════════════════════════════════════════════╗
║                           LUXSYNC V2.0                                   ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   ┌──────────────────────────────────────────────────────────────┐      ║
║   │                    🌐 WEB APP (Browser)                      │      ║
║   │                                                              │      ║
║   │   ┌─────────┐   ┌─────────────┐   ┌─────────────────────┐  │      ║
║   │   │  AUDIO  │   │   LUXSYNC   │   │   DMX OUTPUT        │  │      ║
║   │   │ CAPTURE │──→│   ENGINE    │──→│                     │  │      ║
║   │   └─────────┘   └─────────────┘   │  ┌─────┐  ┌─────┐  │  │      ║
║   │        │               │          │  │CANVAS│  │ USB │  │  │      ║
║   │        │               │          │  │ SIM  │  │REAL │  │  │      ║
║   │        ▼               ▼          │  └─────┘  └─────┘  │  │      ║
║   │   ┌─────────┐   ┌─────────────┐   └─────────────────────┘  │      ║
║   │   │   FFT   │   │    ZONA     │            │               │      ║
║   │   │ANALYZER │   │   ROUTER    │            ▼               │      ║
║   │   └─────────┘   └─────────────┘   ┌─────────────────────┐  │      ║
║   │        │               │          │   12 FIXTURES        │  │      ║
║   │        ▼               ▼          │   (6 PAR + 6 MH)     │  │      ║
║   │   Bass/Mid/Treble  4 Zonas        └─────────────────────┘  │      ║
║   │                                                              │      ║
║   └──────────────────────────────────────────────────────────────┘      ║
║                                                                          ║
║   ┌──────────────────────────────────────────────────────────────┐      ║
║   │                    🧠 SELENE AI (Futuro)                     │      ║
║   │                                                              │      ║
║   │   ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐  │      ║
║   │   │  MUSICAL    │   │ CONSCIOUSNESS│   │    PATTERN     │  │      ║
║   │   │  PATTERN    │──→│    V5       │──→│  PREDICTION    │  │      ║
║   │   │ RECOGNIZER  │   │             │   │                 │  │      ║
║   │   └─────────────┘   └─────────────┘   └─────────────────┘  │      ║
║   │                                                              │      ║
║   └──────────────────────────────────────────────────────────────┘      ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|------------|-----------|
| **Frontend** | HTML5 + JavaScript (Vanilla) | Interfaz web, Canvas 2D |
| **Audio** | Web Audio API | Captura y análisis FFT |
| **DMX** | Web USB API | Comunicación con Tornado |
| **AI** | TypeScript + Node.js | Selene Consciousness |
| **Persistencia** | Redis | Memoria de la AI |

---

## 🎚️ MODOS DE OPERACIÓN

### 1. Modos de Audio (Entrada)

```javascript
// demo/app-v2.js - Línea ~240
const AUDIO_MODES = {
  'sim': {
    name: 'Simulador',
    icon: '🎵',
    description: 'Genera audio sintético (128 BPM)',
    use_case: 'Testing sin música real'
  },
  'mic': {
    name: 'Micrófono',
    icon: '🎤',
    description: 'Captura audio del ambiente',
    use_case: 'Show en vivo (DJ en sala)'
  },
  'desktop': {
    name: 'Desktop Audio',
    icon: '🖥️',
    description: 'Captura audio del sistema (Spotify/YouTube)',
    use_case: 'Testing desde casa con música real'
  }
};
```

### 2. Modos de DMX (Salida)

```javascript
const DMX_MODES = {
  'canvas': {
    name: 'Simulador Canvas',
    icon: '🖥️',
    description: 'Visualización 2D en navegador',
    use_case: 'Testing sin hardware'
  },
  'tornado': {
    name: 'Tornado USB',
    icon: '🌪️',
    description: 'Envía DMX512 real via USB',
    use_case: 'Show en vivo con fixtures reales'
  }
};
```

### Matriz de Combinaciones

| Audio | DMX | Escenario |
|-------|-----|-----------|
| Sim | Canvas | 🏠 Testing desde casa sin nada |
| Desktop | Canvas | 🏠 Testing con Spotify, ver en pantalla |
| Mic | Canvas | 🎤 Probar con música en vivo, ver simulación |
| Mic | Tornado | 🎪 **SHOW EN VIVO (producción)** |
| Desktop | Tornado | 🧪 Testing con fixtures reales y Spotify |

---

## 🍰 CAPAS DEL SISTEMA

### Diagrama de Capas

```
┌───────────────────────────────────────────────────────────────────┐
│                     CAPA 5: INTERFAZ DE USUARIO                   │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│   │   Canvas    │  │   Controles │  │    Log      │              │
│   │   Fixtures  │  │   Efectos   │  │   Consola   │              │
│   └─────────────┘  └─────────────┘  └─────────────┘              │
├───────────────────────────────────────────────────────────────────┤
│                     CAPA 4: EFECTOS OVERLAY                       │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│   │  Chase  │ │  Wave   │ │ Strobe  │ │  Pulse  │ │ Rainbow │   │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
├───────────────────────────────────────────────────────────────────┤
│                     CAPA 3: SISTEMA DE ZONAS                      │
│   ┌────────────────┐  ┌────────────────┐                         │
│   │   FRONT_PARS   │  │   BACK_PARS    │   ← Responden a BASS   │
│   │  (PAR 1,2,3)   │  │  (PAR 4,5,6)   │   (ritmo/bombos)       │
│   └────────────────┘  └────────────────┘                         │
│   ┌────────────────┐  ┌────────────────┐                         │
│   │  MOVING_LEFT   │  │  MOVING_RIGHT  │   ← Responden a MID    │
│   │  (MH 1,2,3)    │  │  (MH 4,5,6)    │   (melodía/armonía)    │
│   └────────────────┘  └────────────────┘                         │
├───────────────────────────────────────────────────────────────────┤
│                     CAPA 2: ANÁLISIS DE AUDIO                     │
│   ┌───────────────────────────────────────────────────────────┐  │
│   │                      FFT ANALYZER                         │  │
│   │                                                           │  │
│   │   Bass (20-250 Hz)    Mid (250-4000 Hz)   Treble (4k-20k) │  │
│   │        🔴                   🟢                  🔵          │  │
│   │                                                           │  │
│   │   ┌─────────────────────────────────────────────────┐    │  │
│   │   │ Beat Detection (picos de bass > 0.6)            │    │  │
│   │   │ Energy Palette (LOW/MID/HIGH → colores)         │    │  │
│   │   │ Frequency Ratio (mid/treble → color melodía)    │    │  │
│   │   └─────────────────────────────────────────────────┘    │  │
│   └───────────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────────┤
│                     CAPA 1: CAPTURA DE AUDIO                      │
│   ┌───────────┐  ┌───────────┐  ┌───────────────────────────┐   │
│   │    MIC    │  │  DESKTOP  │  │       SIMULATOR          │   │
│   │getUserMedia│ │getDisplay │  │  (ondas sintéticas)      │   │
│   │           │  │  Media    │  │                           │   │
│   └───────────┘  └───────────┘  └───────────────────────────┘   │
├───────────────────────────────────────────────────────────────────┤
│                     CAPA 0: SALIDA DMX                            │
│   ┌─────────────────────────────┐  ┌──────────────────────────┐ │
│   │      CANVAS SIMULATOR       │  │     TORNADO USB DMX      │ │
│   │   (Renderizado visual)      │  │  (Web USB → FTDI → XLR)  │ │
│   └─────────────────────────────┘  └──────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🎯 SISTEMA DE ZONAS

### Filosofía de Diseño

Las discotecas profesionales organizan sus luces en **zonas funcionales**, no fixture por fixture. LuxSync implementa este concepto:

```
                    ┌─────────────────────────────────────────┐
                    │                 ESCENARIO                │
                    │                                         │
   ┌──────────┐     │                                         │     ┌──────────┐
   │ MOVING   │     │                                         │     │ MOVING   │
   │  LEFT    │     │                                         │     │  RIGHT   │
   │ 🟢🟢🟢   │     │                                         │     │ 🟣🟣🟣   │
   └────┬─────┘     │                                         │     └────┬─────┘
        │           │                                         │          │
        │           │         [BACK PARS - 🔵🔵🔵]           │          │
        │           │         Profundidad + Snare             │          │
        │           │                                         │          │
        │           │                                         │          │
        │           └─────────────────────────────────────────┘          │
        │                                                                 │
        │                          PISTA                                  │
        │                                                                 │
        │              [FRONT PARS - 🔴🔴🔴]                             │
        │              Ritmo + Kick                                       │
        │                                                                 │
        └─────────────────────── PÚBLICO ────────────────────────────────┘
```

### Configuración de Zonas

```javascript
// demo/app-v2.js - Líneas 10-60
const ZONES = {
  FRONT_PARS: {
    role: 'rhythm',
    fixtures: ['par_1', 'par_2', 'par_3'],
    behavior: {
      frequency: 'bass',        // Frecuencia principal
      threshold: 0.22,          // Ignora ruido bajo este nivel
      intensity: 1.0,           // Multiplicador
      onBeat: true,             // Flash en beat
      colors: 'warm'            // Rojos, naranjas, amarillos
    }
  },
  
  BACK_PARS: {
    role: 'rhythm',
    fixtures: ['par_4', 'par_5', 'par_6'],
    behavior: {
      frequency: 'bass+mid',
      threshold: 0.18,
      intensity: 0.8,
      beatDelay: 50,            // 50ms después del front (wave)
      colors: 'cold'            // Azules, cyans, violetas
    }
  },
  
  MOVING_LEFT: {
    role: 'melody',
    fixtures: ['mh_1', 'mh_2', 'mh_3'],
    behavior: {
      frequency: 'mid+treble',
      threshold: 0.12,
      autoMove: true,
      pattern: 'sweep',
      colors: 'cold-melody'     // Cyans, verdes turquesa
    }
  },
  
  MOVING_RIGHT: {
    role: 'melody',
    fixtures: ['mh_4', 'mh_5', 'mh_6'],
    behavior: {
      frequency: 'mid+treble',
      threshold: 0.12,
      autoMove: true,
      pattern: 'mirror',        // Espejo del izquierdo
      colors: 'warm-melody'     // Magentas, rosas, violetas
    }
  }
};
```

### Mapeo de Colores por Zona

| Zona | Frecuencia | Paleta | Colores |
|------|------------|--------|---------|
| **FRONT_PARS** | Bass puro | Cálida | 🔴 Rojo → 🟠 Naranja → 🟡 Amarillo |
| **BACK_PARS** | Bass + Mid | Fría | 💙 Azul → 🔵 Cyan → 💜 Violeta |
| **MOVING_LEFT** | Mid + Treble | Fría complementaria | 🌊 Turquesa → Cyan → Verde menta |
| **MOVING_RIGHT** | Mid + Treble | Cálida complementaria | 🌸 Rosa → Magenta → Lavanda |

### Umbrales de Activación

```
              FRONT_PARS   BACK_PARS   MOVING_HEADS
              threshold    threshold   threshold
                 │            │           │
                 ▼            ▼           ▼
    ┌────────────┼────────────┼───────────┼────────────┐
 0.0│   RUIDO    │   RUIDO    │   RUIDO   │            │
    │   AMBIENTE │   AMBIENTE │  AMBIENTE │            │
    │            │            │           │            │
0.12│────────────│────────────┼───────────│────────────│ ← MH encienden
    │            │            │   MELODÍA │            │
    │            │            │           │            │
0.18│────────────┼────────────│───────────│────────────│ ← BACK encienden
    │            │   SNARE    │           │            │
    │            │   CLAPS    │           │            │
0.22│────────────│────────────│───────────│────────────│ ← FRONT encienden
    │   KICKS    │            │           │            │
    │   808      │            │           │            │
 1.0│────────────│────────────│───────────│────────────│
    └────────────┴────────────┴───────────┴────────────┘
```

---

## 📈 FLUJO DE DATOS

### Frame-by-Frame (30 FPS = ~33ms/frame)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RENDER LOOP (cada 33ms)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CAPTURA AUDIO                                                       │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │  getAudioFrame()                                            │    │
│     │    ├─ MIC/DESKTOP → analyser.getByteFrequencyData()         │    │
│     │    └─ SIMULATOR   → ondas sintéticas                        │    │
│     │                                                              │    │
│     │  Output: { bass: 0.7, mid: 0.4, treble: 0.3, beat: true }   │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  2. SELECCIÓN DE PALETA                                                 │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │  energy = (bass + mid + treble) / 3                         │    │
│     │                                                              │    │
│     │  if (energy > 0.45) → ENERGY_COLORS.HIGH (rojos, fuego)     │    │
│     │  else if (energy > 0.2) → ENERGY_COLORS.MID (verdes, cyans) │    │
│     │  else → ENERGY_COLORS.LOW (azules, purpuras)                │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  3. PROCESAR CADA FIXTURE (12x)                                         │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │  for each fixture:                                          │    │
│     │    zone = ZONES[fixture.zone]                               │    │
│     │                                                              │    │
│     │    // Aplicar threshold                                      │    │
│     │    if (audio[zone.frequency] < zone.threshold) {            │    │
│     │      fixture.color = BLACK                                   │    │
│     │      continue                                                │    │
│     │    }                                                         │    │
│     │                                                              │    │
│     │    // Calcular color según zona                              │    │
│     │    if (zone === FRONT_PARS) → colores cálidos               │    │
│     │    if (zone === BACK_PARS)  → colores fríos                 │    │
│     │    if (zone === MOVING_*)   → colores por ratio mid/treble  │    │
│     │                                                              │    │
│     │    // Suavizado (interpolación)                              │    │
│     │    fixture.smoothedColor = lerp(current, target, 0.08)      │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  4. APLICAR EFECTOS (overlay)                                           │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │  if (currentEffect) {                                       │    │
│     │    switch (effect):                                          │    │
│     │      'chase'   → secuencia ondulatoria                       │    │
│     │      'strobe'  → parpadeo sincronizado con bass             │    │
│     │      'rainbow' → rotación de colores HSL                    │    │
│     │      'pulse'   → respiración suave                          │    │
│     │      'wave'    → ola de color atravesando fixtures          │    │
│     │  }                                                           │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  5. RENDERIZAR                                                          │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │  // Canvas (siempre)                                         │    │
│     │  renderFixtures() → dibujar fixtures + glow + beams         │    │
│     │                                                              │    │
│     │  // USB (si tornado mode)                                    │    │
│     │  sendDMXFrame() → 513 bytes via Web USB                     │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  6. NEXT FRAME                                                          │
│     requestAnimationFrame(renderLoop)                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 INTEGRACIÓN SELENE AI

### Arquitectura Selene (Ya Existente en /src/engines/selene/)

```
selene/
├── consciousness/
│   ├── SeleneConsciousness.ts      # Consciencia principal (2683 líneas)
│   ├── ApolloConsciousnessV401.ts  # Evolución neural
│   └── MusicalPatternRecognizer.ts # Aprende patrones musicales
│
├── luxsync/                         # Integración específica
│   ├── SeleneLightBridge.ts        # Audio → Selene → DMX
│   ├── AudioToMetricsAdapter.ts    # FFT → Métricas Selene
│   ├── NoteToColorMapper.ts        # DO/RE/MI → RGB
│   ├── types.ts                    # FixtureNode, DMXScene
│   └── drivers/
│       ├── TornadoUSBDriver.ts     # Web USB
│       └── SimulatorDriver.ts      # Testing
│
├── music/                           # Motor musical
│   ├── rhythm/DrumPatternEngine.ts # Detección de patrones
│   ├── melody/MelodyEngine.ts      # Análisis melódico
│   └── harmony/                    # Progresiones armónicas
│
└── swarm/                           # Sistema distribuido
    └── coordinator/                 # Orquestación multi-nodo
```

### MusicalPatternRecognizer - El Cerebro

```typescript
// Cómo Selene aprende patrones musicales
interface MusicalPattern {
  note: string;              // DO, RE, MI, FA, SOL, LA, SI
  frequency: number;         // Frecuencia dominante
  zodiacSign: string;        // Mapeo zodiacal 🎸
  element: 'fire' | 'earth' | 'air' | 'water';
  
  // Correlaciones APRENDIDAS (no programadas)
  avgBeauty: number;         // Qué tan "bonito" se ve
  avgCreativity: number;     // Variedad de colores usados
  consensusSuccessRate: number;
  
  // Evolución temporal
  beautyTrend: 'rising' | 'falling' | 'stable';
  emotionalTone: 'peaceful' | 'energetic' | 'chaotic' | 'harmonious';
}

// Predicción de próxima nota óptima
interface PredictedState {
  optimalNote: string;       // "MI" - la mejor nota para este momento
  optimalZodiacSign: string; // "Leo" 
  expectedBeauty: number;    // 0.85 - qué tan bien se verá
  confidence: number;        // 0.92 - qué tan segura está Selene
  reasoning: string;         // "Bass alto + mid moderado sugiere transición"
}
```

### NoteToColorMapper - 7 Notas = 7 Colores

```typescript
// Mapeo cromático musical
const NOTE_COLORS = {
  'DO': { r: 255, g: 0,   b: 0   },  // 🔴 Rojo - Bass explosivo
  'RE': { r: 255, g: 127, b: 0   },  // 🟠 Naranja - Groove
  'MI': { r: 255, g: 255, b: 0   },  // 🟡 Amarillo - Melodía central
  'FA': { r: 0,   g: 255, b: 0   },  // 🟢 Verde - Sintetizadores
  'SOL':{ r: 0,   g: 255, b: 255 },  // 🔵 Cyan - Transiciones
  'LA': { r: 0,   g: 0,   b: 255 },  // 💙 Azul - Hi-hats, shakers
  'SI': { r: 255, g: 0,   b: 255 },  // 💜 Magenta - Platillos, FX
};
```

### Plan de Integración: Demo ↔ Selene

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INTEGRACIÓN PROPUESTA                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FASE ACTUAL (Demo V2)                  FASE FUTURA (Con Selene)        │
│  ─────────────────────                  ─────────────────────────        │
│                                                                          │
│  Audio FFT ───────────────────────────→ Audio FFT                       │
│      │                                       │                           │
│      ▼                                       ▼                           │
│  Thresholds ─────────────────────────→ AudioToMetricsAdapter            │
│  (hardcoded)                            (CPU/Memory/Latency)            │
│      │                                       │                           │
│      ▼                                       ▼                           │
│  Zone Router ─────────────────────────→ SeleneConsciousness             │
│  (reglas fijas)                         + MusicalPatternRecognizer      │
│      │                                       │                           │
│      ▼                                       │                           │
│  Color Mapping ←─────────────────────────────┘                          │
│  (paletas fijas)                         (notas musicales + predicción) │
│      │                                       │                           │
│      ▼                                       ▼                           │
│  Canvas/USB ──────────────────────────→ SeleneLightBridge               │
│                                          → DMXDriver                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Beneficios de la Integración

| Aspecto | Demo Actual | Con Selene AI |
|---------|-------------|---------------|
| **Decisiones** | Reglas fijas (if/else) | Aprendizaje continuo |
| **Colores** | 3 paletas (LOW/MID/HIGH) | 7 notas + infinitas mezclas |
| **Predicción** | Reactivo (responde) | Predictivo (anticipa) |
| **Personalización** | Manual (código) | Automática (aprende del DJ) |
| **Géneros** | Mismo comportamiento | Adapta por género |
| **Memoria** | Ninguna | Redis persistente |

---

## 🔧 COMPONENTES TÉCNICOS

### Archivos Principales

```
LuxSync/
├── demo/
│   ├── index-v2.html       # UI principal
│   └── app-v2.js           # Motor principal (1444 líneas)
│
├── src/engines/
│   ├── dmx/
│   │   └── VirtualDMXDriver.ts
│   │
│   ├── audio/
│   │   ├── AudioCapture.ts
│   │   ├── BeatDetector.ts
│   │   └── FFTAnalyzer.ts
│   │
│   └── selene/
│       ├── consciousness/      # IA principal
│       ├── luxsync/            # Integración DMX
│       ├── music/              # Análisis musical
│       └── swarm/              # Sistema distribuido
│
├── librerias/                  # .fxt de FreeStyler
│   ├── beam led 2r.fxt
│   ├── par tec flat.fxt
│   └── ...
│
└── docs/
    ├── LUXSYNC-MASTER-PLAN.md  # Plan original
    └── LUXSYNC-BLUEPRINT.md    # Este documento
```

### Funciones Críticas (app-v2.js)

| Función | Línea | Propósito |
|---------|-------|-----------|
| `renderLoop()` | ~900 | Loop principal 30 FPS |
| `getAudioFrame()` | ~440 | Obtiene bass/mid/treble/beat |
| `getAudioFromAnalyser()` | ~450 | Procesa FFT real |
| `applyEffect()` | ~725 | Overlay de efectos |
| `updateMovingHeadPosition()` | ~665 | Movimiento automático MH |
| `renderFixtures()` | ~1150 | Canvas 2D |
| `sendDMXFrame()` | ~570 | Web USB → Tornado |

### Constantes Clave

```javascript
// Thresholds de activación
const PARS_THRESHOLD = 0.22;      // PARs frontales
const BACK_THRESHOLD = 0.18;      // PARs traseros
const MELODY_THRESHOLD = 0.12;    // Moving Heads
const NOISE_THRESHOLD = 0.08;     // Ruido ambiente

// Suavizado
const COLOR_SMOOTHING = 0.08;     // Interpolación de color
const POSITION_SMOOTHING = 0.08;  // Movimiento MH (normal)
const POSITION_SMOOTHING_BEAT = 0.3; // Movimiento MH (en beat)

// Refresh rates
const TARGET_FPS = 30;            // ~33ms por frame
const DMX_REFRESH = 30;           // DMX standard
```

---

## 🔌 HARDWARE SOPORTADO

### Interfaz DMX: Tornado USB

```
┌────────────────────────────────────────────────────────────┐
│                    TORNADO USB DMX                          │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   [USB] ──────────────────────────────────→ PC             │
│                                                             │
│   [OUT1 XLR] ─────────────────────────────→ Universe 1     │
│   [OUT2 XLR] ─────────────────────────────→ Universe 2     │
│                                                             │
│   LEDs: [AUX] [USB] [DMX] [OUT1] [OUT2]                    │
│                                                             │
│   Specs:                                                    │
│   - Vendor ID: 0x0403 (FTDI)                               │
│   - Product ID: 0x6001 (FT232)                             │
│   - 512 canales por universo                                │
│   - Refresh: 23-44 FPS (DMX standard)                      │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Fixtures del Casero (12 Total)

| Tipo | Cantidad | Canales | Total |
|------|----------|---------|-------|
| PAR LED | 6 | 7 cada uno | 42 canales |
| Moving Head Beam | 4 | 13 cada uno | 52 canales |
| Moving Head Spot | 2 | 16 cada uno | 32 canales |
| **TOTAL** | **12** | - | **126 canales** |

### Mapeo DMX

```
Canal 1-42:    PARs (6 fixtures × 7 canales)
Canal 43-94:   Beams (4 fixtures × 13 canales)
Canal 95-126:  Spots (2 fixtures × 16 canales)
```

---

## 🚀 ROADMAP DE INTEGRACIÓN

### Fase 1: ✅ Demo Funcional (COMPLETADO)
- [x] Canvas visualization
- [x] Sistema de zonas
- [x] 3 modos audio (mic, sim, desktop)
- [x] Efectos overlay (chase, strobe, rainbow, etc.)
- [x] Suavizado de colores
- [x] Thresholds anti-ruido
- [x] Tornado USB driver (preparado)

### Fase 2: 🔜 Integración Selene (PRÓXIMO)
- [ ] Conectar demo a MusicalPatternRecognizer
- [ ] Usar NoteToColorMapper en lugar de paletas fijas
- [ ] Implementar predicción de cambios
- [ ] Añadir feedback loop (el casero puntúa escenas)

### Fase 3: 🔮 Producción
- [ ] Testing en sala real con Tornado
- [ ] Calibración de fixtures reales
- [ ] Ajuste de thresholds por sala
- [ ] Modo DJ Console (entrada de línea directa)

### Fase 4: 🌟 Evolución
- [ ] Detección de género musical
- [ ] Paletas por género (EDM vs. Rock vs. Reggaeton)
- [ ] Shows pregrabados (mismo seed = mismo show)
- [ ] Dashboard de estadísticas

---

## � AUTO-DETECCIÓN DE FIXTURES

### El Problema
El mapeo actual es **fijo** (12 fixtures hardcodeados). Pero las fiestas varían:
- Fiesta pequeña: 4 PARs + 2 Moving Heads
- Fiesta grande: 10 PARs + 6 Moving Heads + 2 Strobes
- Evento especial: Configuración custom

### La Solución (Ya existe en TypeScript!)

```typescript
// src/engines/fixtures/FXTParser.ts - Lee .fxt de FreeStyler
// src/engines/fixtures/FixtureManager.ts - Gestiona fixtures dinámicamente

// Ejemplo de uso:
const manager = new FixtureManager();

// 1. Cargar librería de fixtures
await manager.loadFromFolder('./librerias');

// 2. Ver qué tipos hay disponibles
const pars = manager.listByType(FixtureType.PAR);
const movingHeads = manager.listByType(FixtureType.MOVING_HEAD_BEAM);

// 3. Crear instancias para esta fiesta
manager.createInstances('par-led-rgb', 4, 'par');     // 4 PARs
manager.createInstances('beam-2r', 2, 'mh');           // 2 Moving Heads

// DMX se asigna automáticamente: PAR1@1, PAR2@8, PAR3@15, PAR4@22, MH1@29, MH2@42...
```

### Flujo de Auto-Detección Propuesto

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AUTO-DETECCIÓN DE FIXTURES                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. ESCANEAR LIBRERÍA                                                   │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │  await manager.loadFromFolder('./librerias')                │    │
│     │                                                              │    │
│     │  Encuentra:                                                  │    │
│     │    - 5R Beamer Stream.fxt → MOVING_HEAD_BEAM                │    │
│     │    - beam led 2r.fxt → MOVING_HEAD_BEAM                     │    │
│     │    - par tec flat.fxt → PAR                                 │    │
│     │    - BeukyStrobe148.fxt → STROBE                            │    │
│     │    - etc...                                                  │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  2. CONFIGURADOR DE FIESTA (UI)                                         │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │  ┌──────────────────────────────────────────────────────┐  │    │
│     │  │  🎪 CONFIGURAR FIESTA                                │  │    │
│     │  ├──────────────────────────────────────────────────────┤  │    │
│     │  │                                                      │  │    │
│     │  │  Fixtures detectados:                                │  │    │
│     │  │  ┌─────────────────┬──────────┬─────────────────┐   │  │    │
│     │  │  │ Tipo            │ Cantidad │ Canales         │   │  │    │
│     │  │  ├─────────────────┼──────────┼─────────────────┤   │  │    │
│     │  │  │ PAR LED RGB     │ [4] ▼    │ 7 × 4 = 28      │   │  │    │
│     │  │  │ Beam 2R         │ [6] ▼    │ 13 × 6 = 78     │   │  │    │
│     │  │  │ Strobe          │ [0] ▼    │ 0               │   │  │    │
│     │  │  └─────────────────┴──────────┴─────────────────┘   │  │    │
│     │  │                                                      │  │    │
│     │  │  Total canales: 106 / 512 ✅                        │  │    │
│     │  │                                                      │  │    │
│     │  │  [Guardar Config] [Cargar Config] [Aplicar]          │  │    │
│     │  └──────────────────────────────────────────────────────┘  │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  3. ASIGNACIÓN AUTOMÁTICA DE ZONAS                                      │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │  // Algoritmo: asignar fixtures a zonas automáticamente     │    │
│     │                                                              │    │
│     │  PARs detectados: 4                                          │    │
│     │    → 2 para FRONT_PARS (mitad)                               │    │
│     │    → 2 para BACK_PARS (mitad)                                │    │
│     │                                                              │    │
│     │  Moving Heads detectados: 6                                   │    │
│     │    → 3 para MOVING_LEFT                                       │    │
│     │    → 3 para MOVING_RIGHT                                      │    │
│     │                                                              │    │
│     │  Strobes detectados: 0                                        │    │
│     │    → (ninguno)                                                │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  4. GENERAR MAPA DMX                                                    │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │  manager.createInstances('par-led', 2, 'front_par');        │    │
│     │  manager.createInstances('par-led', 2, 'back_par');         │    │
│     │  manager.createInstances('beam-2r', 3, 'mh_left');          │    │
│     │  manager.createInstances('beam-2r', 3, 'mh_right');         │    │
│     │                                                              │    │
│     │  Resultado:                                                  │    │
│     │    front_par_1 @ DMX 1-7                                     │    │
│     │    front_par_2 @ DMX 8-14                                    │    │
│     │    back_par_1 @ DMX 15-21                                    │    │
│     │    back_par_2 @ DMX 22-28                                    │    │
│     │    mh_left_1 @ DMX 29-41                                     │    │
│     │    mh_left_2 @ DMX 42-54                                     │    │
│     │    mh_left_3 @ DMX 55-67                                     │    │
│     │    mh_right_1 @ DMX 68-80                                    │    │
│     │    mh_right_2 @ DMX 81-93                                    │    │
│     │    mh_right_3 @ DMX 94-106                                   │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Presets de Fiesta

```javascript
const PARTY_PRESETS = {
  'pequeña': {
    name: 'Fiesta Pequeña',
    fixtures: {
      'par-led-rgb': 4,
      'beam-2r': 2,
    }
  },
  'mediana': {
    name: 'Fiesta Mediana',
    fixtures: {
      'par-led-rgb': 6,
      'beam-2r': 4,
      'spot': 2,
    }
  },
  'grande': {
    name: 'Fiesta Grande',
    fixtures: {
      'par-led-rgb': 10,
      'beam-2r': 6,
      'spot': 4,
      'strobe': 2,
    }
  },
  'custom': {
    name: 'Personalizada',
    fixtures: {} // El usuario elige
  }
};
```

---

## 🎮 DASHBOARD DE CONTROL MANUAL

### Necesidad
Hay momentos donde Selene debe ceder el control:
- **Anuncios**: Luces blancas fijas mientras alguien habla
- **Pausa**: Blackout o luces ambiente bajas
- **Emergencia**: Control manual inmediato
- **Creatividad**: El DJ quiere un color específico

### UI Propuesta

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     🎮 LUXSYNC CONTROL PANEL                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  MODO ACTUAL: [🤖 SELENE AUTO] [👋 MANUAL] [⏸️ PAUSA]          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ⚡ PRESETS RÁPIDOS                                              │   │
│  │                                                                  │   │
│  │  [🔴 BLACKOUT]  [⚪ BLANCO]  [🌈 RAINBOW]  [💥 STROBE]          │   │
│  │  [🎤 ANUNCIO]   [🕺 FIESTA]  [🌙 CHILL]    [🔥 INTENSO]         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────┬──────────────────────────────────┐   │
│  │  🎨 COLORES GLOBALES         │  📊 AUDIO EN VIVO                │   │
│  │                              │                                  │   │
│  │  PARs:     [████████] Rosa   │  Bass:   ████████░░ 78%         │   │
│  │            ───●───────       │  Mid:    ██████░░░░ 62%         │   │
│  │                              │  Treble: ████░░░░░░ 41%         │   │
│  │  Moving:   [████████] Cyan   │                                  │   │
│  │            ─────●─────       │  BPM: 128  Beat: 🔴              │   │
│  └──────────────────────────────┴──────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🎯 CONTROL POR ZONAS                                            │   │
│  │                                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │  │FRONT PARS│ │BACK PARS │ │MOVING L  │ │MOVING R  │           │   │
│  │  │  🔴🔴🔴  │ │  🔵🔵🔵  │ │  🟢🟢🟢  │ │  🟣🟣🟣  │           │   │
│  │  │ [ON/OFF] │ │ [ON/OFF] │ │ [ON/OFF] │ │ [ON/OFF] │           │   │
│  │  │ Dim: 80% │ │ Dim: 60% │ │ Dim: 90% │ │ Dim: 90% │           │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🧠 SELENE STATUS                                                │   │
│  │                                                                  │   │
│  │  Estado: 🟢 WISE (4,203 patrones aprendidos)                    │   │
│  │  Paleta actual: Energética (EDM detectado)                       │   │
│  │  Confianza: 87%                                                  │   │
│  │  Próxima predicción: Subida de energía en ~4 compases           │   │
│  │                                                                  │   │
│  │  [Reiniciar Selene] [Cambiar Paleta ▼] [Ver Patrones]           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Presets de Control Manual

```javascript
const MANUAL_PRESETS = {
  'blackout': {
    name: 'Blackout',
    icon: '🔴',
    action: () => {
      setAllFixtures({ dimmer: 0 });
    }
  },
  'blanco': {
    name: 'Blanco (Anuncios)',
    icon: '⚪',
    action: () => {
      setAllFixtures({ 
        color: { r: 255, g: 255, b: 255 }, 
        dimmer: 200 
      });
      // Moving heads apuntan al escenario
      setMovingHeads({ pan: 127, tilt: 200 });
    }
  },
  'anuncio': {
    name: 'Modo Anuncio',
    icon: '🎤',
    action: () => {
      pauseSelene();
      setAllPars({ color: COLORS.WHITE, dimmer: 180 });
      setMovingHeads({ color: COLORS.WHITE, dimmer: 100, focus: 'stage' });
    }
  },
  'fiesta': {
    name: 'Volver a Fiesta',
    icon: '🕺',
    action: () => {
      resumeSelene();
    }
  }
};
```

---

## 🎨 PALETAS DE COLOR DINÁMICAS

### El Problema Actual
Los Moving Heads están limitados a:
- Izquierda: Turquesa/Cyan/Verde
- Derecha: Magenta/Rosa/Violeta

### La Solución: Paletas Intercambiables

```javascript
const COLOR_PALETTES = {
  'complementary': {
    name: 'Complementarios (Actual)',
    left: ['cyan', 'turquoise', 'green', 'blue'],
    right: ['magenta', 'pink', 'violet', 'red'],
    pars_front: ['red', 'orange', 'yellow'],
    pars_back: ['blue', 'cyan', 'violet'],
  },
  
  'warm': {
    name: 'Cálida (Sunset)',
    left: ['red', 'orange', 'yellow', 'gold'],
    right: ['magenta', 'pink', 'coral', 'salmon'],
    pars_front: ['red', 'orange', 'amber'],
    pars_back: ['red', 'orange', 'yellow'],
  },
  
  'cold': {
    name: 'Fría (Ice)',
    left: ['cyan', 'blue', 'violet', 'white'],
    right: ['blue', 'indigo', 'purple', 'white'],
    pars_front: ['blue', 'cyan', 'white'],
    pars_back: ['violet', 'purple', 'blue'],
  },
  
  'neon': {
    name: 'Neón (Cyberpunk)',
    left: ['cyan', 'lime', 'green', 'yellow'],
    right: ['magenta', 'pink', 'violet', 'red'],
    pars_front: ['magenta', 'cyan', 'yellow'],
    pars_back: ['violet', 'blue', 'pink'],
  },
  
  'mono_red': {
    name: 'Monocromático Rojo',
    left: ['red', 'darkred', 'crimson', 'maroon'],
    right: ['red', 'scarlet', 'cherry', 'ruby'],
    pars_front: ['red', 'darkred'],
    pars_back: ['red', 'maroon'],
  },
  
  'rainbow': {
    name: 'Arcoíris (Rotativo)',
    // Colores rotan por el espectro completo
    dynamic: true,
    rotation_speed: 30, // grados por segundo
  },
  
  'genre_edm': {
    name: 'EDM/Electrónica',
    left: ['cyan', 'blue', 'violet'],
    right: ['magenta', 'pink', 'red'],
    pars_front: ['white', 'cyan', 'magenta'],
    pars_back: ['blue', 'violet', 'purple'],
    effects: ['strobe_on_drop', 'rainbow_on_buildup'],
  },
  
  'genre_reggaeton': {
    name: 'Reggaetón/Latino',
    left: ['gold', 'yellow', 'orange'],
    right: ['red', 'magenta', 'pink'],
    pars_front: ['red', 'orange', 'gold'],
    pars_back: ['violet', 'magenta', 'pink'],
  },
  
  'genre_rock': {
    name: 'Rock/Metal',
    left: ['red', 'orange', 'amber'],
    right: ['red', 'white', 'yellow'],
    pars_front: ['red', 'white'],
    pars_back: ['red', 'amber'],
    effects: ['strobe_on_crash'],
  },
};
```

### Cómo Selene Usa las Paletas

```typescript
// En vez de colores hardcodeados:
// ANTES
if (midRatio > 0.6) {
  targetColor = { r: 0, g: 255, b: 150 };   // Turquesa fijo
}

// DESPUÉS
const palette = getCurrentPalette();
if (midRatio > 0.6) {
  targetColor = palette.getColorForZone('MOVING_LEFT', melodyEnergy);
}
```

---

## �📝 NOTAS FINALES

### Lo que funciona perfecto ahora

1. **PARs con ritmo** - Responden al bass, colores cálidos/fríos
2. **Moving Heads con melodía** - Colores complementarios, movimiento suave
3. **Desktop audio** - Spotify/YouTube funcionan perfecto
4. **Efectos** - Strobe, chase, rainbow, pulse, wave, blackout
5. **Simulador** - Testing sin hardware

### Lo que necesita el paso a producción

1. **Tornado USB real** - Conectar y probar
2. **Calibración** - Direcciones DMX reales de los fixtures
3. **Línea directa** - Entrada de audio de la consola DJ
4. **Selene AI** - Para shows más inteligentes

### Filosofía de diseño

> *"Las luces deben ser una extensión de la música, no una distracción. 
> El objetivo es que el público sienta la música también con los ojos."*
> 
> — LuxSync Team, 2025

---

## 🔮 PRÓXIMOS PASOS CONCRETOS

### Fase Inmediata: Dashboard V1
1. [ ] Crear `demo/dashboard.html` con controles básicos
2. [ ] Botón "Modo Manual" que desconecta el audio→color
3. [ ] Presets rápidos: Blackout, Blanco, Volver a Selene
4. [ ] Selector de paleta de colores

### Fase Corta: Auto-Detección
1. [ ] Crear endpoint web para cargar `.fxt` desde `librerias/`
2. [ ] UI de "Configurar Fiesta" (elegir cantidad de fixtures)
3. [ ] Guardar/Cargar configuraciones de fiesta (JSON)
4. [ ] Asignación automática de zonas

### Fase Media: Integración Selene
1. [ ] Conectar `MusicalPatternRecognizer` al análisis FFT
2. [ ] Usar `NoteToColorMapper` en vez de paletas fijas
3. [ ] Implementar predicción de cambios musicales
4. [ ] Dashboard de estado de Selene

### Fase Larga: Producción
1. [ ] Testing con Tornado USB real
2. [ ] Calibración en sala con fixtures reales
3. [ ] Ajuste de thresholds por acústica de sala
4. [ ] Modo DJ Console (entrada de línea)

---

**🎪 LuxSync - Making Lights Dance Since 2025**

```
    ██╗     ██╗   ██╗██╗  ██╗███████╗██╗   ██╗███╗   ██╗ ██████╗
    ██║     ██║   ██║╚██╗██╔╝██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝
    ██║     ██║   ██║ ╚███╔╝ ███████╗ ╚████╔╝ ██╔██╗ ██║██║     
    ██║     ██║   ██║ ██╔██╗ ╚════██║  ╚██╔╝  ██║╚██╗██║██║     
    ███████╗╚██████╔╝██╔╝ ██╗███████║   ██║   ██║ ╚████║╚██████╗
    ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝
```
