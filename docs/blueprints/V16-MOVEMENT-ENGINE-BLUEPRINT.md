# 🎭 V16: SELENE MOVEMENT ENGINE - BLUEPRINT

## "Abstract Motion vs Physical Output"

**Fecha:** 2024-12-02  
**Autor:** Claude (Opus) + Directiva GeminiPunk  
**Estado:** DISEÑO - Sin implementar

---

## 📋 ÍNDICE

1. [El Problema](#-el-problema)
2. [La Solución: Dos Capas](#-la-solución-dos-capas)
3. [Arquitectura](#-arquitectura)
4. [Sistema de Coordenadas](#-sistema-de-coordenadas-abstractas)
5. [Patrones de Movimiento (Lissajous)](#-patrones-de-movimiento-lissajous)
6. [Configuración de Hardware](#-configuración-de-hardware-mapping)
7. [Integración con Selene](#-integración-con-selene)
8. [API Propuesta](#-api-propuesta)
9. [Decisiones de Diseño](#-decisiones-de-diseño)
10. [Plan de Implementación](#-plan-de-implementación)

---

## 🎯 EL PROBLEMA

### La Realidad Física

```
ESCENARIO CLÁSICO (Horizontal)          TU SALA (Vertical/Techo)
                                        
    ┌─────────────────┐                     ════════════════════
    │   ESCENARIO     │                     │ TECHO │ TECHO │
    │  ○    ○    ○    │ ← Fixtures          │  ◊       ◊    │ ← Fixtures colgados
    └─────────────────┘                     │  │       │    │
           ↓                                │  ▼       ▼    │
    ┌─────────────────┐                     │               │
    │     PISTA       │                     │    PISTA      │
    └─────────────────┘                     │               │
                                            └───────────────┘

Tilt 0° = Horizonte                    Tilt 0° = SUELO (mirando abajo)
Tilt 90° = Cielo                       Tilt 90° = PARED (horizontal)
```

### El Bug Inevitable (Sin Abstracción)

| Intención de Selene | Escenario Clásico | Tu Sala (sin fix) |
|---------------------|-------------------|-------------------|
| "Mira al público" | ✅ Tilt 45° = Correcto | ❌ Tilt 45° = Mirando al suelo |
| "Break épico: ¡Al cielo!" | ✅ Tilt 90° = Arriba | ❌ Tilt 90° = A la pared |
| "Barrer la pista" | ✅ Pan sweep + Tilt bajo | ❌ Pan sweep + ilumina DJ |

**Conclusión:** Sin abstracción, cada instalación requiere reescribir la lógica de Selene.

---

## 💡 LA SOLUCIÓN: DOS CAPAS

### Filosofía: Separación de Concerns

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA SELENE (ABSTRACTA)                      │
│                                                                 │
│   • Piensa en INTENCIONES: "iluminar pista", "break épico"     │
│   • Coordenadas Cartesianas Normalizadas: (X, Y) de -1 a +1    │
│   • Patrones matemáticos: Lissajous, Noise, Geometric          │
│   • NO conoce DMX, NO conoce orientación física                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DRIVER (FÍSICA)                         │
│                                                                 │
│   • Traduce (X, Y) → (Pan DMX, Tilt DMX)                       │
│   • Conoce la orientación del fixture (techo, suelo, truss)    │
│   • Aplica inversiones, offsets, límites mecánicos             │
│   • Específico por instalación (configurable)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ ARQUITECTURA

### Diagrama de Clases

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           SeleneMovementEngine                            │
│──────────────────────────────────────────────────────────────────────────│
│  - patterns: Map<string, LissajousPattern>                               │
│  - activePattern: string                                                  │
│  - phase: number (0-2π)                                                   │
│  - speed: number (BPM-driven)                                            │
│  - intensity: number (0-1, affects amplitude)                            │
│  - personality: SelenePersonality (from parent)                          │
│──────────────────────────────────────────────────────────────────────────│
│  + tick(audioData, deltaTime): AbstractPosition[]                        │
│  + setPattern(name: string)                                              │
│  + setSpeed(bpm: number)                                                 │
│  + getAbstractPosition(fixtureId): { x, y, intensity }                   │
│  + suggestPatternFromMood(mood: string): string                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ genera
                                    ▼
                        ┌───────────────────────┐
                        │   AbstractPosition    │
                        │───────────────────────│
                        │  x: number (-1 to +1) │
                        │  y: number (-1 to +1) │
                        │  intensity: number    │
                        │  fixtureId: string    │
                        └───────────────────────┘
                                    │
                                    │ traducido por
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           FixturePhysicsDriver                            │
│──────────────────────────────────────────────────────────────────────────│
│  - fixtureConfigs: Map<string, PhysicalConfig>                           │
│──────────────────────────────────────────────────────────────────────────│
│  + translateToPhysical(abstract: AbstractPosition): PhysicalOutput       │
│  + calibrate(fixtureId, homePosition, inversions)                        │
│  + setInstallationType(type: 'ceiling' | 'floor' | 'truss')             │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ produce
                                    ▼
                        ┌───────────────────────┐
                        │    PhysicalOutput     │
                        │───────────────────────│
                        │  panDMX: number 0-255 │
                        │  tiltDMX: number 0-255│
                        │  panFine: number      │
                        │  tiltFine: number     │
                        └───────────────────────┘
```

### Ubicación de Archivos

```
demo/
├── selene-integration.js      # Orquestador principal (ya existe)
├── selene-movement-engine.js  # NUEVO: Motor de movimiento abstracto
├── fixture-physics-driver.js  # NUEVO: Traductor físico
└── app-v2.js                  # Config de fixtures (ya existe, añadir física)
```

---

## 📐 SISTEMA DE COORDENADAS ABSTRACTAS

### El Espacio Normalizado

```
                    Y = +1.0 (Arriba/Cielo)
                         │
                         │
         (-1, +1)        │        (+1, +1)
              ┌──────────┼──────────┐
              │          │          │
              │    II    │    I     │
              │          │          │
    X = -1.0 ─┼──────────┼──────────┼─ X = +1.0
    (Izquierda)│          │          │ (Derecha)
              │   III    │    IV    │
              │          │          │
              └──────────┼──────────┘
         (-1, -1)        │        (+1, -1)
                         │
                    Y = -1.0 (Abajo/Suelo)

              CENTRO (0, 0) = PISTA DE BAILE
```

### Mapeo Semántico (Intenciones → Coordenadas)

| Intención Selene | Coordenada (X, Y) | Descripción |
|------------------|-------------------|-------------|
| `"audience"` | (0, 0) | Centro de la pista |
| `"sky"` / `"break"` | (0, +0.8) | Arriba (para momentos épicos) |
| `"floor"` / `"drop"` | (0, -0.5) | Hacia abajo (drops) |
| `"dj"` | (0, +0.9) | Cabina DJ (fondo) |
| `"left_crowd"` | (-0.7, 0) | Lado izquierdo |
| `"right_crowd"` | (+0.7, 0) | Lado derecho |
| `"sweep_wide"` | animación X | Barrido horizontal |

---

## 🌀 PATRONES DE MOVIMIENTO (LISSAJOUS)

### ¿Qué son las Curvas de Lissajous?

Curvas paramétricas donde:
```
X(t) = A * sin(a*t + δ)
Y(t) = B * sin(b*t)
```

Cambiando `a`, `b` y `δ` obtenemos formas orgánicas diferentes.

### Patrones Disponibles

#### 1. ⭕ CÍRCULO (`circle`)
**Uso:** Techno, House, ritmos 4/4 constantes

```javascript
{
  name: 'circle',
  a: 1, b: 1, delta: Math.PI/2,  // Lissajous 1:1 con fase 90°
  amplitude: { x: 0.6, y: 0.4 }, // Elipse achatada (más pan que tilt)
  speedMultiplier: 1.0,
  mood: ['techno', 'house', 'trance']
}

// Resultado: X = sin(t + π/2) = cos(t), Y = sin(t)
// Movimiento circular suave
```

```
        ╭───────╮
       ╱         ╲
      │     →     │
      │   ╭─╮     │
      │   │●│     │  ← Fixture traza círculo
      │   ╰─╯     │
       ╲    ←    ╱
        ╰───────╯
```

#### 2. ♾️ INFINITO / OCHO (`infinity`)
**Uso:** Latino, Fuego, Reggaeton - "Movimiento de caderas"

```javascript
{
  name: 'infinity',
  a: 1, b: 2, delta: 0,  // Ratio 1:2 = figura de 8
  amplitude: { x: 0.7, y: 0.3 },
  speedMultiplier: 0.8,  // Más lento, sensual
  mood: ['latino', 'fuego', 'reggaeton']
}

// Resultado: X = sin(t), Y = sin(2t)
// Movimiento en forma de 8 horizontal
```

```
      ╭─────╮   ╭─────╮
     ╱       ╲ ╱       ╲
    │    ←    ╳    →    │
     ╲       ╱ ╲       ╱
      ╰─────╯   ╰─────╯
           ∞ shape
```

#### 3. ⚡ BARRIDO / ZIGZAG (`sweep`)
**Uso:** Neón, Cyberpunk, builds intensos

```javascript
{
  name: 'sweep',
  // No es Lissajous puro, es onda triangular
  waveform: 'triangle',  
  axis: 'x',             // Solo movimiento horizontal
  amplitude: { x: 0.9, y: 0.1 },  // Casi solo pan
  speedMultiplier: 2.0,  // Rápido
  mood: ['neon', 'cyberpunk', 'edm']
}

// Resultado: X = triangle(t), Y = constante
// Barrido lineal izquierda-derecha
```

```
    ←─────────────────────→
    ←─────────────────────→
    ←─────────────────────→
         Linear sweep
```

#### 4. ☁️ NUBE / DRIFT (`cloud`)
**Uso:** Hielo, Ambient, Chill - Movimiento Browniano

```javascript
{
  name: 'cloud',
  // Usa Perlin Noise en lugar de Lissajous
  noiseScale: 0.002,     // Muy lento
  amplitude: { x: 0.4, y: 0.3 },  // Movimientos pequeños
  smoothing: 0.95,       // Muy suavizado (casi flotar)
  mood: ['hielo', 'ambient', 'chill']
}

// Resultado: Movimiento orgánico impredecible pero suave
// Como una nube flotando
```

```
          ·  ·
        ·      ·
       ·   ~~~  ·    ← Movimiento aleatorio suave
        ·      ·
          ·  ·
```

#### 5. 🎯 ESTÁTICO / FOCUS (`static`)
**Uso:** Momentos dramáticos, spotlight en vocalista

```javascript
{
  name: 'static',
  target: { x: 0, y: 0 },  // Configurable
  microMovement: 0.02,     // Muy sutil vibración (vida)
  mood: ['ballad', 'speech', 'focus']
}
```

#### 6. 🌊 ONDAS (`waves`)
**Uso:** Selva, Océano - Ondulación orgánica

```javascript
{
  name: 'waves',
  a: 3, b: 2, delta: Math.PI/4,
  amplitude: { x: 0.5, y: 0.5 },
  speedMultiplier: 0.6,
  mood: ['selva', 'oceano', 'organic']
}

// Lissajous 3:2 = patrón ondulante complejo
```

```
      ╭─╮   ╭─╮   ╭─╮
     ╱   ╲ ╱   ╲ ╱   ╲
    ╱     ╳     ╳     ╲
    ╲     ╳     ╳     ╱
     ╲   ╱ ╲   ╱ ╲   ╱
      ╰─╯   ╰─╯   ╰─╯
```

### Tabla Resumen: Paleta → Patrón Sugerido

| Paleta | Patrón Principal | Patrón Secundario | Velocidad Base |
|--------|------------------|-------------------|----------------|
| 🔥 Fuego | `infinity` | `sweep` | 1.0x BPM |
| ❄️ Hielo | `cloud` | `static` | 0.3x BPM |
| 🌿 Selva | `waves` | `cloud` | 0.6x BPM |
| ⚡ Neón | `sweep` | `circle` | 1.5x BPM |
| 🌊 Océano | `waves` | `circle` | 0.5x BPM |

---

## ⚙️ CONFIGURACIÓN DE HARDWARE (MAPPING)

### PhysicalConfig por Fixture

```javascript
const fixturePhysicsConfig = {
  // MOVING HEAD IZQUIERDO
  'moving_left': {
    installationType: 'ceiling',  // 'ceiling' | 'floor' | 'truss_front' | 'truss_back'
    
    // HOME: Donde está (0,0) en términos DMX
    home: {
      pan: 127,    // Centro horizontal
      tilt: 40,    // Levantado ~30° desde vertical (mirando a pista)
    },
    
    // RANGOS: Cuánto se puede mover desde home
    range: {
      pan: 180,    // ±180° de rotación (algunos tienen 540°)
      tilt: 90,    // Rango útil de tilt
    },
    
    // INVERSIONES: Depende de orientación física
    invert: {
      pan: false,  // true si está montado "al revés"
      tilt: true,  // TRUE para techo (subir DMX = bajar cabeza)
    },
    
    // LÍMITES MECÁNICOS (seguridad)
    limits: {
      tiltMin: 0,    // No mirar más arriba de horizontal
      tiltMax: 200,  // No mirar al propio cable
    },
    
    // VELOCIDAD MECÁNICA (para suavizado)
    maxSpeed: {
      pan: 2.0,   // Grados por frame máximo
      tilt: 1.5,
    }
  },
  
  // MOVING HEAD DERECHO (espejo del izquierdo)
  'moving_right': {
    installationType: 'ceiling',
    home: { pan: 127, tilt: 40 },
    range: { pan: 180, tilt: 90 },
    invert: { pan: true, tilt: true },  // Pan invertido (espejo)
    limits: { tiltMin: 0, tiltMax: 200 },
    maxSpeed: { pan: 2.0, tilt: 1.5 }
  }
};
```

### Tipos de Instalación Predefinidos

```javascript
const INSTALLATION_PRESETS = {
  // Fixtures colgados del techo mirando hacia abajo
  ceiling: {
    defaultHome: { pan: 127, tilt: 35 },
    invertTilt: true,
    invertPan: false,
    tiltOffset: -90,  // Rotación del sistema de referencia
  },
  
  // Fixtures en el suelo mirando hacia arriba
  floor: {
    defaultHome: { pan: 127, tilt: 127 },
    invertTilt: false,
    invertPan: false,
    tiltOffset: 0,
  },
  
  // En truss frontal (típico escenario)
  truss_front: {
    defaultHome: { pan: 127, tilt: 100 },
    invertTilt: false,
    invertPan: false,
    tiltOffset: -45,
  },
  
  // En truss trasero (contraluz)
  truss_back: {
    defaultHome: { pan: 127, tilt: 60 },
    invertTilt: false,
    invertPan: true,  // Espejado porque mira hacia atrás
    tiltOffset: -45,
  }
};
```

---

## 🔗 INTEGRACIÓN CON SELENE

### Flujo de Datos (por frame)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CADA FRAME (~60fps)                            │
└─────────────────────────────────────────────────────────────────────────────┘

1. ANÁLISIS DE AUDIO (ya existe en selene-integration.js)
   │
   ├─→ bass, mid, treble, beat, bpm
   │
   ▼
2. SELENE DECIDE MOVIMIENTO
   │
   │  ┌──────────────────────────────────────────┐
   │  │ seleneMovement.tick(audioData, delta)    │
   │  │                                          │
   │  │  - Actualiza phase según BPM             │
   │  │  - Calcula (X, Y) del patrón activo      │
   │  │  - Modula amplitud con bass/beat         │
   │  │  - Retorna AbstractPosition[]            │
   │  └──────────────────────────────────────────┘
   │
   ▼
3. TRADUCCIÓN FÍSICA
   │
   │  ┌──────────────────────────────────────────┐
   │  │ physicsDriver.translate(abstractPos)     │
   │  │                                          │
   │  │  - Aplica home offset                    │
   │  │  - Aplica inversiones                    │
   │  │  - Aplica límites mecánicos              │
   │  │  - Suaviza velocidad (evita saltos)      │
   │  │  - Retorna { panDMX, tiltDMX }           │
   │  └──────────────────────────────────────────┘
   │
   ▼
4. OUTPUT A DMX (ya existe)
   │
   └─→ movingLeft.pan = panDMX, movingLeft.tilt = tiltDMX
```

### Integración con Paletas y Mood

```javascript
// En selene-integration.js (método existente o nuevo)

updateMovement(audioData) {
  const { bass, mid, treble, beat, bpm } = audioData;
  
  // 1. Decidir patrón basado en paleta activa
  const suggestedPattern = this.movementEngine.suggestPatternFromMood(this.activePalette);
  
  // 2. Solo cambiar patrón si hay un beat fuerte (transición natural)
  if (beat && bass > 0.7 && suggestedPattern !== this.movementEngine.activePattern) {
    this.movementEngine.setPattern(suggestedPattern);
  }
  
  // 3. Modular velocidad con BPM detectado
  this.movementEngine.setSpeed(bpm || 120);
  
  // 4. Modular amplitud con energía
  const energy = (bass + mid + treble) / 3;
  this.movementEngine.setIntensity(energy);
  
  // 5. Tick del motor (actualiza posiciones)
  const abstractPositions = this.movementEngine.tick(audioData, this.deltaTime);
  
  // 6. Traducir a físico
  const physicalOutputs = abstractPositions.map(pos => 
    this.physicsDriver.translate(pos)
  );
  
  return physicalOutputs;
}
```

### Eventos Especiales (Beats, Drops, Breaks)

```javascript
// El motor puede recibir "eventos" para comportamientos especiales

// En un DROP: Todos los móviles al centro, luego explosión
movementEngine.triggerEvent('drop', {
  preDuration: 500,   // 500ms convergiendo al centro
  postBehavior: 'explode',  // Después del drop, máxima amplitud
});

// En un BREAK: Mirar arriba (cielo/lasers)
movementEngine.triggerEvent('break', {
  target: { x: 0, y: 0.9 },  // Arriba
  duration: 4000,  // 4 segundos mirando arriba
});

// En SILENCIO: Posición de reposo
movementEngine.triggerEvent('rest', {
  target: { x: 0, y: -0.3 },  // Ligeramente abajo
  microMovement: 0.01,  // Casi estático pero "vivo"
});
```

---

## 📦 API PROPUESTA

### SeleneMovementEngine

```javascript
class SeleneMovementEngine {
  constructor(personality) {
    this.personality = personality;
    this.patterns = new Map();
    this.activePattern = 'circle';
    this.phase = 0;
    this.speed = 1.0;  // Multiplicador
    this.intensity = 0.5;  // Amplitud base
    this.targetBPM = 120;
    
    this._initPatterns();
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MÉTODOS PÚBLICOS
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Actualiza el motor y retorna posiciones abstractas
   * @param {Object} audioData - { bass, mid, treble, beat, bpm }
   * @param {number} deltaTime - Tiempo desde último frame (ms)
   * @returns {AbstractPosition[]} - Posiciones para cada fixture
   */
  tick(audioData, deltaTime) { }
  
  /**
   * Cambia el patrón activo
   * @param {string} patternName - 'circle' | 'infinity' | 'sweep' | 'cloud' | 'waves'
   */
  setPattern(patternName) { }
  
  /**
   * Ajusta la velocidad basada en BPM
   * @param {number} bpm
   */
  setSpeed(bpm) { }
  
  /**
   * Ajusta la amplitud/intensidad del movimiento
   * @param {number} intensity - 0 a 1
   */
  setIntensity(intensity) { }
  
  /**
   * Sugiere un patrón basado en la paleta/mood actual
   * @param {string} mood - 'fuego' | 'hielo' | 'selva' | 'neon'
   * @returns {string} - Nombre del patrón sugerido
   */
  suggestPatternFromMood(mood) { }
  
  /**
   * Dispara un evento especial (drop, break, etc)
   * @param {string} eventType
   * @param {Object} params
   */
  triggerEvent(eventType, params) { }
  
  /**
   * Obtiene la posición actual para un fixture específico
   * @param {string} fixtureId
   * @returns {AbstractPosition}
   */
  getPosition(fixtureId) { }
}
```

### FixturePhysicsDriver

```javascript
class FixturePhysicsDriver {
  constructor() {
    this.configs = new Map();
    this.lastPositions = new Map();  // Para suavizado
  }
  
  /**
   * Registra un fixture con su configuración física
   */
  registerFixture(fixtureId, config) { }
  
  /**
   * Aplica un preset de instalación a todos los fixtures
   */
  setInstallationType(type) { }
  
  /**
   * Traduce posición abstracta a valores DMX
   * @param {AbstractPosition} abstract
   * @returns {PhysicalOutput}
   */
  translate(abstract) { }
  
  /**
   * Calibración interactiva (para UI futura)
   */
  calibrateHome(fixtureId, panDMX, tiltDMX) { }
}
```

### Tipos de Datos

```typescript
// Para referencia (aunque sea JS, ayuda documentar)

interface AbstractPosition {
  fixtureId: string;
  x: number;        // -1 a +1
  y: number;        // -1 a +1
  intensity: number; // 0 a 1 (puede modular dimmer)
  timestamp: number;
}

interface PhysicalOutput {
  fixtureId: string;
  panDMX: number;      // 0-255
  tiltDMX: number;     // 0-255
  panFine?: number;    // 0-255 (16-bit)
  tiltFine?: number;   // 0-255 (16-bit)
}

interface PhysicalConfig {
  installationType: 'ceiling' | 'floor' | 'truss_front' | 'truss_back';
  home: { pan: number; tilt: number };
  range: { pan: number; tilt: number };
  invert: { pan: boolean; tilt: boolean };
  limits: { tiltMin: number; tiltMax: number };
  maxSpeed: { pan: number; tilt: number };
}

interface LissajousPattern {
  name: string;
  a: number;          // Frecuencia X
  b: number;          // Frecuencia Y
  delta: number;      // Desfase
  amplitude: { x: number; y: number };
  speedMultiplier: number;
  mood: string[];
}
```

---

## 🎨 DECISIONES DE DISEÑO

### 1. ¿Por qué separar en dos clases?

**Opción A:** Todo en `selene-integration.js` (monolito)
- ❌ Ya tiene 1500+ líneas
- ❌ Mezcla lógica abstracta con física
- ❌ Difícil de testear

**Opción B:** Dos clases especializadas ✅
- ✅ `SeleneMovementEngine` es portable (funciona sin hardware)
- ✅ `FixturePhysicsDriver` es configurable por instalación
- ✅ Testeable: puedes probar patrones sin fixtures reales
- ✅ Futuro: UI de calibración solo toca el Driver

### 2. ¿Por qué Lissajous y no keyframes?

**Keyframes (animación tradicional):**
```javascript
// Definir cada punto del movimiento
const animation = [
  { time: 0, x: 0, y: 0 },
  { time: 500, x: 0.5, y: 0.3 },
  { time: 1000, x: -0.5, y: 0.3 },
  // ... tedioso, rígido
];
```

**Lissajous (matemáticas continuas):**
```javascript
// Una fórmula genera movimiento infinito y orgánico
x = sin(t);
y = sin(2*t);
// Ajustas parámetros, no puntos
```

**Ventajas Lissajous:**
- ✅ Movimiento siempre fluido (no hay "saltos" entre keyframes)
- ✅ Sincronizable con BPM (t = phase, phase += bpm/60 * delta)
- ✅ Escalable (cambiar amplitud no requiere recalcular puntos)
- ✅ Matemáticamente bello (es lo que hace un oscilador de verdad)

### 3. ¿Por qué "Home" en lugar de "Center"?

El término **Home** viene de la industria de luces:
- Es la posición de **calibración mecánica** del fixture
- Cuando enciendes un moving head, hace "homing" primero
- En nuestro sistema: Home = donde (0,0) abstracto se mapea

### 4. ¿Qué pasa con fixtures que no tienen Pan/Tilt?

Los **PARs** no se mueven. El sistema simplemente ignora la salida de movimiento para ellos:

```javascript
// En la integración
if (fixture.type === 'par') {
  // Solo color e intensidad, sin movimiento
  return;
}
```

### 5. ¿Suavizado (Smoothing)?

Los fixtures mecánicos no pueden saltar instantáneamente. El Driver aplica:

```javascript
// Limitar velocidad máxima por frame
const maxDelta = config.maxSpeed.pan * deltaTime;
const actualDelta = Math.min(Math.abs(targetPan - currentPan), maxDelta);
newPan = currentPan + Math.sign(targetPan - currentPan) * actualDelta;
```

Esto evita:
- Movimientos bruscos antiestéticos
- Estrés mecánico en los motores
- Ruido de los servos

---

## 📋 PLAN DE IMPLEMENTACIÓN

### Fase 1: Esqueleto (V16.0)
- [ ] Crear `selene-movement-engine.js` con estructura básica
- [ ] Implementar patrón `circle` como prueba de concepto
- [ ] Crear `fixture-physics-driver.js` con traducción básica
- [ ] Integrar en `selene-integration.js` (llamada básica)
- [ ] Testear en canvas (visualizar movimiento)

### Fase 2: Patrones (V16.1)
- [ ] Implementar todos los patrones Lissajous
- [ ] Implementar `cloud` (Perlin noise)
- [ ] Implementar `sweep` (onda triangular)
- [ ] Mapeo paleta → patrón sugerido

### Fase 3: Física Real (V16.2)
- [ ] Implementar presets de instalación
- [ ] Calibración para tu sala (techo)
- [ ] Suavizado de velocidad
- [ ] Límites mecánicos

### Fase 4: Eventos (V16.3)
- [ ] Sistema de eventos (drop, break, rest)
- [ ] Transiciones suaves entre patrones
- [ ] Sincronización fina con BPM

### Fase 5: Polish (V16.4)
- [ ] Ajuste fino de amplitudes por patrón
- [ ] Lateralidad (left/right offset en fase)
- [ ] Documentación y CHANGELOG

---

## 🔮 FUTURO (Post-V16)

### UI de Calibración
```
┌─────────────────────────────────────────┐
│  FIXTURE CALIBRATION                    │
│─────────────────────────────────────────│
│  Moving Left                            │
│  ┌─────────────────────────────────┐   │
│  │  Home Pan:  [====●=====] 127    │   │
│  │  Home Tilt: [==●=======]  40    │   │
│  │  Invert Pan:  [ ]               │   │
│  │  Invert Tilt: [✓]               │   │
│  └─────────────────────────────────┘   │
│  [Test Position] [Save] [Reset]        │
└─────────────────────────────────────────┘
```

### Patrones Personalizados
Permitir al usuario dibujar un path que se convierte en Lissajous aproximado.

### Multi-Fixture Choreography
Coordinar múltiples fixtures para coreografías complejas:
- Left y Right en espejo
- Secuencias tipo "ola"
- Chase patterns

---

## 📚 REFERENCIAS

- [Curvas de Lissajous (Wikipedia)](https://es.wikipedia.org/wiki/Curva_de_Lissajous)
- [Perlin Noise](https://en.wikipedia.org/wiki/Perlin_noise)
- [DMX Pan/Tilt Conventions](https://www.dmx512-online.com/)
- Código existente: `selene-integration.js` líneas 730-850 (sistema de silencios)

---

**Siguiente paso:** Revisar este blueprint, ajustar según feedback, y proceder a V16.0 (esqueleto).
