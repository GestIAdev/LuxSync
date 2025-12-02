# 🎭 V16: Movement Engine - Documentación Técnica

> *"El movimiento es poesía en el espacio"* - Selene V16

---

## 📋 Índice

1. [Arquitectura de Dos Capas](#arquitectura-de-dos-capas)
2. [FixturePhysicsDriver](#fixturephysicsdriver)
3. [SeleneMovementEngine](#selenemovementengine)
4. [Patrones de Movimiento](#patrones-de-movimiento)
5. [Protocolo de Seguridad V16.1](#protocolo-de-seguridad-v161)
6. [Integración con Paletas](#integración-con-paletas)
7. [Guía para Nuevos Patrones](#guía-para-nuevos-patrones)
8. [Roadmap: Selene V17+](#roadmap-selene-v17)

---

## 🏗️ Arquitectura de Dos Capas

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA ABSTRACTA                               │
│              SeleneMovementEngine                               │
│                                                                 │
│   Coordenadas: X ∈ [-1, +1]  Y ∈ [-1, +1]                      │
│   Patrones: Lissajous, Perlin Noise, Triangulares              │
│   Input: Audio (bass, mid, treble, beat, bpm)                  │
│   Output: { fixtureId, x, y, intensity }                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA FÍSICA                                  │
│              FixturePhysicsDriver                               │
│                                                                 │
│   DMX: Pan ∈ [0, 255]  Tilt ∈ [0, 255]                         │
│   Features: Inversiones, Límites, Inercia, Safety Box          │
│   Input: { fixtureId, x, y, intensity }                        │
│   Output: { panDMX, tiltDMX, panFine, tiltFine }               │
└─────────────────────────────────────────────────────────────────┘
```

### ¿Por qué dos capas?

1. **Abstracción**: Selene "piensa" en coordenadas artísticas (-1 a +1), no en DMX
2. **Portabilidad**: El mismo patrón funciona en cualquier fixture
3. **Calibración**: Cada fixture puede tener su propia configuración física
4. **Seguridad**: La capa física aplica límites antes de enviar a hardware

---

## 🔧 FixturePhysicsDriver

**Archivo**: `demo/fixture-physics-driver.js`

### Responsabilidades

- Traducir coordenadas abstractas a DMX
- Aplicar inversiones según orientación del fixture
- Respetar límites mecánicos (Safety Box)
- Suavizar movimientos con física de inercia (Curva S)
- Proteger el hardware de comandos erróneos

### Presets de Instalación

```javascript
INSTALLATION_PRESETS: {
  // Fixtures colgados del techo mirando hacia abajo
  ceiling: {
    home: { pan: 127, tilt: 40 },      // Centro mirando a la pista
    range: { pan: 540, tilt: 270 },    // Rango de movimiento en grados
    invert: { pan: false, tilt: true }, // ⚠️ TILT INVERTIDO
    limits: { tiltMin: 20, tiltMax: 200 },
    maxSpeed: { pan: 200, tilt: 150 },
  },
  
  // Fixtures en el suelo mirando hacia arriba
  floor: {
    home: { pan: 127, tilt: 200 },
    invert: { pan: false, tilt: false },
    limits: { tiltMin: 50, tiltMax: 220 },
  },
  
  // Fixtures en truss lateral
  stage: {
    home: { pan: 127, tilt: 127 },
    invert: { pan: false, tilt: false },
    limits: { tiltMin: 0, tiltMax: 255 },
  },
}
```

### Configuración de Espejo

Para que dos grupos de fixtures se muevan de forma simétrica:

```javascript
// Grupo izquierdo - Movimiento normal
physicsDriver.registerFixture('moving_left', {
  installationType: 'ceiling',
  mirror: false,
});

// Grupo derecho - Espejo del izquierdo
physicsDriver.registerFixture('moving_right', {
  installationType: 'ceiling',
  mirror: true,  // Invierte X abstracta
  // ⚠️ NO usar invert.pan junto con mirror (se cancelan)
});
```

### Flujo de Traducción

```
Coordenadas Abstractas (x, y)
         │
         ▼
┌─────────────────────────┐
│ 1. Mirror (si aplica)   │  effectiveX = mirror ? -x : x
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 2. Mapear a DMX         │  pan = home + offset * range
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 3. Aplicar Inversiones  │  if (invert.tilt) offset = -offset
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 4. Safety Box           │  clamp(tiltMin, tiltMax)
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 5. Physics Easing       │  Curva S de aceleración
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 6. NaN Guard            │  Protección anti-explosión
└─────────────────────────┘
         │
         ▼
    DMX Final (0-255)
```

---

## 🎨 SeleneMovementEngine

**Archivo**: `demo/selene-movement-engine.js`

### Responsabilidades

- Generar patrones de movimiento basados en curvas matemáticas
- Sincronizar velocidad con BPM
- Modular amplitud según intensidad del audio
- Sugerir patrones apropiados para cada paleta/mood
- Aplicar offsets únicos por fixture (no todos iguales)

### Parámetros Principales

```javascript
{
  // Velocidad base sincronizada con música
  targetBPM: 120,
  
  // Fase actual del oscilador (0 a 2π)
  phase: 0,
  
  // Patrón activo
  activePattern: 'circle',
  
  // Amplitude base (escalada por intensidad)
  baseAmplitude: { x: 0.6, y: 0.4 },
  
  // Seeds para Perlin noise (deterministas)
  noiseSeeds: { x: PHI, y: PHI * 2 },
}
```

### Fórmula de Velocidad

```javascript
// 1 vuelta completa cada 2 beats
const beatsPerSecond = bpm / 60;
const baseSpeed = beatsPerSecond * Math.PI;  // rad/s

// Aplicar multiplicador del patrón
const phaseIncrement = baseSpeed * pattern.speedMultiplier * (deltaTime / 1000);
```

---

## 🔮 Patrones de Movimiento

### ⭕ Circle (Círculo/Elipse)

**Curva Lissajous**: `a=1, b=1, δ=π/2`

```javascript
x = cos(phase) * amplitude.x
y = sin(phase) * amplitude.y
```

**Características**:
- Movimiento suave y predecible
- Elipse horizontal por defecto (x > y)
- Ideal para ritmos constantes 4/4

**Moods**: `techno`, `house`, `trance`, `selva`

---

### ♾️ Infinity (Figura de 8)

**Curva Lissajous**: `a=1, b=2`

```javascript
x = sin(phase) * amplitude.x
y = sin(phase * 2) * amplitude.y
```

**Características**:
- Movimiento sensual de "caderas"
- Cruce en el centro crea tensión visual
- Más lento que circle (speedMult: 0.8)

**Moods**: `fuego`, `latin`, `reggaeton`, `cumbia`

---

### ⚡ Sweep (Barrido Horizontal)

**Onda Triangular** con micro-ondulación vertical

```javascript
// Onda triangular para movimiento lineal
const triangle = (p) => {
  const norm = (p % 2π) / 2π;
  return norm < 0.5 ? (norm * 4 - 1) : (3 - norm * 4);
};

x = triangle(phase) * amplitude.x
y = sin(phase * 0.5) * amplitude.y * 0.1 * intensity
```

**Características**:
- Barrido lineal de izquierda a derecha
- Ligera ondulación vertical para evitar monotonía
- Rápido (speedMult: 1.5)

**Moods**: `neon`, `cyberpunk`, `edm`

---

### ☁️ Cloud (Flotación Orgánica)

**Perlin Noise simplificado**

```javascript
const noise = (t, seed) => {
  return (
    sin(t * 0.7 + seed) * 0.5 +
    sin(t * 1.3 + seed * 1.5) * 0.3 +
    sin(t * 2.1 + seed * 0.8) * 0.2
  );
};

x = noise(noiseTime, seed.x) * amplitude.x
y = noise(noiseTime + 100, seed.y) * amplitude.y
```

**Características**:
- Movimiento impredecible pero suave
- Nunca repite exactamente el mismo camino
- Muy lento (speedMult: 0.3)
- Amplitud mínima en chill, crece con intensidad

**Moods**: `hielo`, `ambient`, `chill`

---

### 🌊 Waves (Olas Lissajous 3:2)

**Curva Lissajous**: `a=3, b=2, δ=π/4`

```javascript
x = sin(phase * 3) * amplitude.x
y = sin(phase * 2 + π/4) * amplitude.y
```

**Características**:
- Patrón complejo tipo "nudo"
- Nunca pasa por el mismo punto dos veces seguidas
- Muy energético para drops

**Moods**: `drop`, `intense`, `climax`

---

### 🎯 Static (Casi Estático)

**Posición fija con micro-vibración**

```javascript
const target = { x: 0, y: 0 };  // Centro
const micro = {
  x: sin(phase * 5) * 0.02 * intensity,
  y: cos(phase * 7) * 0.02 * intensity,
};

x = target.x + micro.x
y = target.y + micro.y
```

**Características**:
- Parece estático pero "respira"
- Para momentos de atención focal
- La micro-vibración evita que parezca "muerto"

**Moods**: `ballad`, `speech`, `focus`

---

## 🛡️ Protocolo de Seguridad V16.1

### 1. Protección contra Singularidad

**Problema**: División por distancia muy pequeña → Infinity/NaN

```javascript
// ❌ PELIGROSO
acceleration = -(vel * vel) / (2 * absDistance) * direction;
// Si absDistance → 0, acceleration → ∞

// ✅ SEGURO (V16.1)
const safeDistance = Math.max(0.5, absDistance);  // Mínimo 0.5 DMX
acceleration = -(vel * vel) / (2 * safeDistance) * direction;
```

### 2. Filtro Anti-Jitter

**Problema**: Servos baratos se calientan con micro-correcciones constantes

```javascript
// Si velocidad < 5, forzar parada total
if (Math.abs(newVel.pan) < 5) newVel.pan = 0;
if (Math.abs(newVel.tilt) < 5) newVel.tilt = 0;
```

### 3. NaN Guard

**Problema**: Si las matemáticas explotan, el motor recibe basura

```javascript
// Verificar ANTES de enviar a DMX
const safePan = Number.isFinite(smoothedDMX.pan) ? smoothedDMX.pan : config.home.pan;
const safeTilt = Number.isFinite(smoothedDMX.tilt) ? smoothedDMX.tilt : config.home.tilt;

if (!Number.isFinite(smoothedDMX.pan) || !Number.isFinite(smoothedDMX.tilt)) {
  console.error(`⚠️ NaN/Infinity detectado! Usando home position`);
}
```

### 4. Clamp Final de Seguridad

```javascript
// NUNCA enviar valores fuera de rango, pase lo que pase
const panDMX = Math.round(Math.max(0, Math.min(255, safePan)));
const tiltDMX = Math.round(Math.max(0, Math.min(255, safeTilt)));
```

### 5. Safety Box (Límites Mecánicos)

```javascript
limits: {
  tiltMin: 20,   // No mirar al techo (daño al LED)
  tiltMax: 200,  // No mirar al suelo (golpe mecánico)
}
```

---

## 🎨 Integración con Paletas

### Mapeo Paleta → Patrón

```javascript
PALETTE_PATTERNS = {
  // Paletas cálidas/latinas → Movimientos sensuales
  fuego: 'infinity',
  cumbia: 'infinity',
  
  // Paletas frías/ambient → Flotación orgánica
  hielo: 'cloud',
  ambient: 'cloud',
  
  // Paletas energéticas → Barridos rápidos
  neon: 'sweep',
  cyberpunk: 'sweep',
  
  // Paletas naturales → Círculos suaves
  selva: 'circle',
  techno: 'circle',
  
  // Paletas intensas → Patrones complejos
  drop: 'waves',
  intense: 'waves',
}
```

### Transiciones Suaves

Cuando Selene cambia de paleta, el patrón transiciona suavemente:

```javascript
setPattern(newPattern, transitionTime = 500) {
  this.transition = {
    active: true,
    from: this.activePattern,
    to: newPattern,
    progress: 0,
    duration: transitionTime,
  };
}

// Durante la transición, interpolar entre ambos patrones
const fromPos = patterns[from].calculate(...);
const toPos = patterns[to].calculate(...);
const blend = easeInOutCubic(progress);

return {
  x: lerp(fromPos.x, toPos.x, blend),
  y: lerp(fromPos.y, toPos.y, blend),
};
```

---

## 📝 Guía para Nuevos Patrones

### Estructura de un Patrón

```javascript
miPatron: {
  name: 'miPatron',
  description: 'Descripción para debug/UI',
  
  // Función de cálculo
  calculate: (phase, amplitude, intensity, engine) => {
    // phase: 0 a 2π (se repite)
    // amplitude: { x, y } baseAmplitude del patrón
    // intensity: 0 a 1 (energía del audio)
    // engine: referencia al motor (para noiseTime, etc)
    
    return {
      x: /* -1 a +1 */,
      y: /* -1 a +1 */,
    };
  },
  
  // Amplitud base
  baseAmplitude: { x: 0.5, y: 0.5 },
  
  // Multiplicador de velocidad (1.0 = normal)
  speedMultiplier: 1.0,
  
  // Paletas/moods donde usar este patrón
  moods: ['mood1', 'mood2'],
}
```

### Ejemplo: Patrón "Spiral"

```javascript
spiral: {
  name: 'spiral',
  description: 'Espiral que se expande y contrae',
  
  calculate: (phase, amplitude, intensity) => {
    // Radio que pulsa con la intensidad
    const radius = (0.3 + intensity * 0.7);
    
    // Espiral: radio crece con la fase
    const spiralPhase = phase * 3;  // 3 vueltas
    const expansion = (spiralPhase % (Math.PI * 2)) / (Math.PI * 2);
    
    return {
      x: Math.cos(phase) * amplitude.x * radius * expansion,
      y: Math.sin(phase) * amplitude.y * radius * expansion,
    };
  },
  
  baseAmplitude: { x: 0.8, y: 0.8 },
  speedMultiplier: 0.6,
  moods: ['psychedelic', 'trance', 'experimental'],
}
```

### Checklist para Nuevos Patrones

- [ ] `x` e `y` siempre entre -1 y +1
- [ ] Usar `amplitude.x` y `amplitude.y` (no escalar)
- [ ] Modular con `intensity` para reactividad al audio
- [ ] Definir `baseAmplitude` apropiada
- [ ] Definir `speedMultiplier` según energía deseada
- [ ] Listar `moods` compatibles
- [ ] Probar transiciones desde/hacia otros patrones

---

## 🚀 Roadmap: Selene V17+

### V17: Patrones Procedurales

Selene generará patrones únicos basándose en:

```javascript
class ProceduralPatternGenerator {
  generate(context) {
    const { palette, userHistory, audioProfile, timeOfDay } = context;
    
    // Analizar paleta actual
    const warmth = this.analyzeWarmth(palette);
    const energy = this.analyzeEnergy(audioProfile);
    
    // Generar curva Lissajous con parámetros derivados
    const a = this.deriveFrequencyX(warmth, energy);
    const b = this.deriveFrequencyY(warmth, energy);
    const delta = this.derivePhaseShift(userHistory);
    
    return {
      calculate: (phase, amplitude, intensity) => ({
        x: Math.sin(a * phase + delta) * amplitude.x * intensity,
        y: Math.sin(b * phase) * amplitude.y * intensity,
      }),
      // ... metadata
    };
  }
}
```

### V18: Aprendizaje de Preferencias

```javascript
class MovementPreferenceLearner {
  // Registrar cuando el usuario cambia manualmente el patrón
  onUserOverride(fromPattern, toPattern, context) {
    this.preferences.record({
      rejected: fromPattern,
      preferred: toPattern,
      palette: context.palette,
      energy: context.audioEnergy,
    });
  }
  
  // Ajustar mapeo paleta→patrón basado en historial
  suggestPattern(palette) {
    const history = this.preferences.forPalette(palette);
    if (history.overrides > 3) {
      return history.mostPreferred;
    }
    return this.defaultMapping[palette];
  }
}
```

### V19: Patrones Multi-Fixture Coordinados

```javascript
// En lugar de mover todos los fixtures igual con offset...
class ChoreographyEngine {
  patterns: {
    // Ola: Los fixtures se mueven en secuencia
    wave: (fixtureIndex, totalFixtures, phase) => {
      const delay = (fixtureIndex / totalFixtures) * Math.PI;
      return this.circle(phase + delay);
    },
    
    // Convergencia: Todos apuntan al mismo punto
    converge: (fixtureIndex, targetPoint, phase) => {
      const home = this.fixtureHomes[fixtureIndex];
      return this.lerp(home, targetPoint, Math.sin(phase));
    },
    
    // Explosión: Del centro hacia afuera
    explode: (fixtureIndex, phase) => {
      const angle = (fixtureIndex / totalFixtures) * Math.PI * 2;
      const radius = Math.sin(phase) * 0.8;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    },
  }
}
```

---

## 📊 Commits Relacionados

| Versión | Commit | Descripción |
|---------|--------|-------------|
| V16.0 | `9b13738` | Movement Engine - Lissajous patterns, Physics Driver |
| V16.1 | `9944e26` | Hardware Protection - NaN guard, singularity fix, anti-jitter |
| V16.2 | `51a915e` | Fix circle pattern amplitude bug |
| V16.3 | `0a46538` | Canvas visualiza TILT, fix mirror config |

---

## 🙏 Créditos

- **Arquitectura**: Gemini (Blueprint) + Claude (Implementación)
- **Patrones Lissajous**: Matemáticas clásicas del siglo XIX
- **Physics Easing**: Inspirado en motores de juegos (Unity, Unreal)
- **Safety Protocol**: Experiencia dolorosa con fixtures del casero 😅

---

*Documento generado para LuxSync V16 - Diciembre 2025*
*"Los fixtures del casero siguen vivos" ✅*
