# 🔮 V17: Effects & Optics Engine - Blueprint Técnico

> *"La luz no solo ilumina, transforma el espacio"* - Selene V17

**Autor**: Claude Opus (Arquitecto) + Gemini (Filosofía Determinista)
**Fecha**: Diciembre 2025
**Estado**: BLUEPRINT - Pendiente de implementación

---

## 📋 Índice

1. [Visión General](#visión-general)
2. [Arquitectura de Capas (Overlay System)](#arquitectura-de-capas)
3. [Motor de Ópticas Mecánicas](#motor-de-ópticas-mecánicas)
4. [Motor de Efectos Temporales](#motor-de-efectos-temporales)
5. [Integración con FixtureManager](#integración-con-fixturemanager)
6. [Filosofía Determinista](#filosofía-determinista)
7. [Estructuras de Datos](#estructuras-de-datos)
8. [Pseudocódigo de Decisión](#pseudocódigo-de-decisión)
9. [Roadmap de Implementación](#roadmap-de-implementación)

---

## 🎯 Visión General

### El Problema

Hasta V16, Selene controla:
- **Color** (V15): HSL procedural, paletas por mood
- **Movimiento** (V16): Lissajous patterns, física de inercia

Pero falta:
- **Efectos temporales**: Strobe, pulse, chase
- **Ópticas mecánicas**: Zoom, prisma, gobos, focus

### La Solución: Sistema de Capas

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DMX OUTPUT FINAL                            │
│         Valores listos para enviar al universo DMX                  │
└─────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ Merge & Resolve
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                      OPTICS LAYER (V17)                             │
│         beamWidth, texture, fragmentation → Zoom/Gobo/Prism         │
└─────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ Overlay (Additive/Replace)
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                      EFFECTS LAYER (V17)                            │
│         Strobe, Pulse, Shake, Rainbow → Modifica Base               │
└─────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ Overlay (Multiplicative)
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                      BASE LAYER (V15-V16)                           │
│         Color (HSL) + Position (Pan/Tilt) + Dimmer                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Principio Fundamental

> **Los efectos NO destruyen el estado base, lo MODULAN.**

Un strobe no "borra" el color - multiplica el dimmer por una onda cuadrada.
Un shake no "reemplaza" la posición - suma un offset de vibración.

---

## 🏗️ Arquitectura de Capas

### LayerStack: El Compositor

```javascript
class LayerStack {
  constructor() {
    this.layers = {
      base: null,      // Color + Position + Dimmer (V15-V16)
      effects: [],     // Array de efectos activos (pueden apilarse)
      optics: null,    // Estado de ópticas mecánicas
    };
  }
  
  /**
   * Resuelve todas las capas en un estado final DMX-ready
   * @returns {Object} - Estado final con todos los canales
   */
  resolve() {
    // 1. Empezar con el estado base
    let state = { ...this.layers.base };
    
    // 2. Aplicar efectos en orden (pueden apilarse)
    for (const effect of this.layers.effects) {
      state = effect.apply(state);
    }
    
    // 3. Aplicar ópticas (una sola capa)
    if (this.layers.optics) {
      state = this.layers.optics.apply(state);
    }
    
    return state;
  }
}
```

### Modos de Blend

Cada efecto define cómo se mezcla con el estado anterior:

```javascript
const BLEND_MODES = {
  // Multiplica el valor (ideal para dimmer)
  MULTIPLY: (base, effect) => base * effect,
  
  // Suma al valor (ideal para posición offset)
  ADD: (base, effect) => base + effect,
  
  // Reemplaza completamente (ideal para color override)
  REPLACE: (base, effect) => effect,
  
  // Mezcla por porcentaje
  MIX: (base, effect, amount) => base * (1 - amount) + effect * amount,
  
  // Máximo de ambos (ideal para strobe sobre dimmer bajo)
  MAX: (base, effect) => Math.max(base, effect),
};
```

### Flujo de Datos por Frame

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Audio      │     │   Selene     │     │  LayerStack  │
│   Analyzer   │────▶│   Decision   │────▶│   Resolve    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                     │
                            ▼                     ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  Base Layer  │     │  DMX Output  │
                     │  (V15-V16)   │     │  (Final)     │
                     └──────────────┘     └──────────────┘
                            │
                     ┌──────┴──────┐
                     ▼             ▼
              ┌──────────┐  ┌──────────┐
              │ Effects  │  │  Optics  │
              │  Layer   │  │  Layer   │
              └──────────┘  └──────────┘
```

---

## 🔭 Motor de Ópticas Mecánicas

### Abstracción: El Lenguaje de Selene

Selene NO habla en canales DMX. Selene habla en **conceptos artísticos**:

```javascript
/**
 * 🎭 OpticState: Lo que Selene "piensa"
 * Todos los valores son 0.0 a 1.0 (abstractos)
 */
const OpticState = {
  // ═══════════════════════════════════════════════════════════════════════
  // 🔍 BEAM WIDTH (Zoom + Focus)
  // ═══════════════════════════════════════════════════════════════════════
  beamWidth: 0.5,
  // 0.0 = Beam láser (zoom cerrado, foco nítido)
  // 0.5 = Spot estándar
  // 1.0 = Wash/Flood (zoom abierto, foco suave)
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎨 TEXTURE (Gobos)
  // ═══════════════════════════════════════════════════════════════════════
  texture: 0.0,
  // 0.0 = Open (sin gobo)
  // 0.1-0.3 = Gobos simples (círculos, líneas)
  // 0.4-0.6 = Gobos medios (estrellas, espirales)
  // 0.7-1.0 = Gobos complejos (breakups, nubes)
  
  textureRotation: 0.0,
  // 0.0 = Estático
  // 0.5 = Rotación lenta
  // 1.0 = Rotación máxima (sincronizada con BPM)
  
  // ═══════════════════════════════════════════════════════════════════════
  // 💎 FRAGMENTATION (Prisma)
  // ═══════════════════════════════════════════════════════════════════════
  fragmentation: 0.0,
  // 0.0 = Haz único (prisma OFF)
  // 0.3 = Prisma 3 facetas, rotación lenta
  // 0.6 = Prisma 6 facetas, rotación media
  // 1.0 = Prisma máximo, rotación a tope
  
  // ═══════════════════════════════════════════════════════════════════════
  // ✨ EXTRAS
  // ═══════════════════════════════════════════════════════════════════════
  frost: 0.0,
  // 0.0 = Sin frost (haz definido)
  // 1.0 = Frost máximo (difusión total)
  
  iris: 1.0,
  // 0.0 = Iris cerrado (punto pequeño)
  // 1.0 = Iris abierto (haz completo)
};
```

### Mapeo Mood → Ópticas

```javascript
/**
 * 🎭 Tabla de decisión: Cómo cada mood afecta las ópticas
 */
const MOOD_OPTICS_MAP = {
  // ═══════════════════════════════════════════════════════════════════════
  // 🧊 CHILL / AMBIENT
  // ═══════════════════════════════════════════════════════════════════════
  chill: {
    beamWidth: 0.8,        // Wash amplio, abraza el espacio
    texture: 0.0,          // Open, limpio
    textureRotation: 0.0,  // Estático
    fragmentation: 0.0,    // Sin prisma
    frost: 0.3,            // Ligero frost para suavidad
    iris: 1.0,             // Abierto
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // ❄️ HIELO / ETHEREAL
  // ═══════════════════════════════════════════════════════════════════════
  hielo: {
    beamWidth: 0.6,        // Spot medio
    texture: 0.2,          // Gobo simple (círculos)
    textureRotation: 0.2,  // Rotación muy lenta
    fragmentation: 0.2,    // Prisma sutil
    frost: 0.5,            // Frost medio (difusión etérea)
    iris: 0.8,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 FUEGO / LATINO
  // ═══════════════════════════════════════════════════════════════════════
  fuego: {
    beamWidth: 0.4,        // Spot definido
    texture: 0.4,          // Gobo medio (estrellas)
    textureRotation: 0.5,  // Rotación con el ritmo
    fragmentation: 0.4,    // Prisma moderado
    frost: 0.0,            // Sin frost (definido)
    iris: 0.9,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌿 SELVA / ORGANIC
  // ═══════════════════════════════════════════════════════════════════════
  selva: {
    beamWidth: 0.7,        // Wash-Spot
    texture: 0.6,          // Gobo orgánico (hojas, breakup)
    textureRotation: 0.3,  // Rotación orgánica lenta
    fragmentation: 0.1,    // Prisma mínimo
    frost: 0.2,
    iris: 1.0,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // ⚡ NEÓN / CYBERPUNK
  // ═══════════════════════════════════════════════════════════════════════
  neon: {
    beamWidth: 0.1,        // BEAM láser
    texture: 0.3,          // Gobo geométrico
    textureRotation: 0.8,  // Rotación rápida
    fragmentation: 0.6,    // Prisma activo
    frost: 0.0,            // Cero frost (definido)
    iris: 0.5,             // Iris medio (beam tight)
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🤖 TECHNO / INDUSTRIAL
  // ═══════════════════════════════════════════════════════════════════════
  techno: {
    beamWidth: 0.2,        // Beam cerrado
    texture: 0.5,          // Gobo industrial
    textureRotation: 0.7,  // Rotación mecánica
    fragmentation: 0.5,    // Prisma medio
    frost: 0.0,
    iris: 0.6,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 💥 DROP / CLIMAX
  // ═══════════════════════════════════════════════════════════════════════
  drop: {
    beamWidth: 0.0,        // BEAM MÁXIMO
    texture: 0.8,          // Gobo complejo
    textureRotation: 1.0,  // Rotación a tope
    fragmentation: 1.0,    // PRISMA FULL
    frost: 0.0,
    iris: 0.3,             // Iris cerrado (beams tight)
  },
};
```

### OpticEngine: El Traductor

```javascript
class OpticEngine {
  constructor() {
    this.currentState = { ...DEFAULT_OPTIC_STATE };
    this.targetState = { ...DEFAULT_OPTIC_STATE };
    this.transitionProgress = 1.0;
    this.transitionDuration = 500; // ms
  }
  
  /**
   * 🎭 Actualiza el estado de ópticas basado en mood y energía
   * @param {string} mood - Paleta/mood actual
   * @param {number} energy - Nivel de energía (0-1)
   * @param {number} bpm - BPM detectado
   * @param {number} entropy - Valor de getSystemEntropy()
   */
  update(mood, energy, bpm, entropy) {
    // 1. Obtener estado base del mood
    const baseState = MOOD_OPTICS_MAP[mood] || MOOD_OPTICS_MAP.chill;
    
    // 2. Modular por energía
    this.targetState = {
      beamWidth: baseState.beamWidth * (1.2 - energy * 0.4),  // Más energía = más cerrado
      texture: baseState.texture + energy * 0.2,               // Más energía = más textura
      textureRotation: this._syncRotationToBPM(baseState.textureRotation, bpm),
      fragmentation: baseState.fragmentation * (0.5 + energy * 0.5),
      frost: baseState.frost * (1 - energy * 0.5),            // Más energía = menos frost
      iris: baseState.iris * (1.1 - energy * 0.3),
    };
    
    // 3. Añadir variación determinista
    this._applyEntropyVariation(entropy);
    
    // 4. Clamp todos los valores a [0, 1]
    this._clampState();
  }
  
  /**
   * 🎵 Sincroniza la rotación de gobo/prisma con el BPM
   * @private
   */
  _syncRotationToBPM(baseRotation, bpm) {
    if (baseRotation === 0) return 0;
    
    // Rotación base escalada por BPM
    // 120 BPM = rotación "normal"
    // 140 BPM = rotación más rápida
    const bpmFactor = bpm / 120;
    return Math.min(1.0, baseRotation * bpmFactor);
  }
  
  /**
   * 🎲 Aplica variación determinista usando entropy
   * @private
   */
  _applyEntropyVariation(entropy) {
    // Usar entropy para pequeñas variaciones (±10%)
    const variation = (entropy - 0.5) * 0.2;
    
    this.targetState.texture += variation * 0.1;
    this.targetState.fragmentation += variation * 0.15;
  }
  
  /**
   * 📐 Clamp todos los valores al rango válido
   * @private
   */
  _clampState() {
    for (const key in this.targetState) {
      this.targetState[key] = Math.max(0, Math.min(1, this.targetState[key]));
    }
  }
  
  /**
   * 🔄 Tick de interpolación (llamar cada frame)
   * @param {number} deltaTime - ms desde último frame
   */
  tick(deltaTime) {
    if (this.transitionProgress >= 1.0) return;
    
    this.transitionProgress += deltaTime / this.transitionDuration;
    this.transitionProgress = Math.min(1.0, this.transitionProgress);
    
    // Interpolación suave (ease-out)
    const t = 1 - Math.pow(1 - this.transitionProgress, 3);
    
    for (const key in this.currentState) {
      this.currentState[key] = this.currentState[key] + 
        (this.targetState[key] - this.currentState[key]) * t;
    }
  }
  
  /**
   * 📤 Obtiene el estado actual para aplicar
   */
  getState() {
    return { ...this.currentState };
  }
}
```

---

## ⚡ Motor de Efectos Temporales

### Taxonomía de Efectos

```
EFFECTS
├── DIMMER FX (Modulan intensidad)
│   ├── Strobe      → Onda cuadrada 0/1
│   ├── Pulse       → Onda sinusoidal suave
│   ├── Blinder     → Flash intenso + decay
│   └── Breathe     → Onda muy lenta (chill)
│
├── POSITION FX (Modulan pan/tilt)
│   ├── Shake       → Vibración caótica (terremoto)
│   ├── Dizzy       → Offset espiral
│   └── Nod         → Movimiento de "cabeceo"
│
├── COLOR FX (Modulan HSL)
│   ├── Rainbow     → Chase de hue
│   ├── Police      → Rojo/Azul alternante
│   └── Fade        → Transición suave entre colores
│
└── SYNC FX (Disparan en eventos)
    ├── BeatFlash   → Flash en cada beat
    ├── DropBurst   → Explosión en drops
    └── BreakFreeze → Congelado en breaks
```

### Clase Base: Effect

```javascript
/**
 * 🎭 Clase base para todos los efectos
 * Todos los efectos heredan de aquí
 */
class Effect {
  constructor(config = {}) {
    this.id = config.id || `fx_${Date.now()}`;
    this.type = 'base';
    this.priority = config.priority || 0;
    this.blendMode = config.blendMode || BLEND_MODES.MULTIPLY;
    
    // Timing
    this.startTime = 0;
    this.duration = config.duration || Infinity;
    this.phase = 0;
    
    // Estado
    this.active = false;
    this.intensity = config.intensity || 1.0;
  }
  
  /**
   * Activa el efecto
   */
  start() {
    this.active = true;
    this.startTime = Date.now();
    this.phase = 0;
  }
  
  /**
   * Desactiva el efecto
   */
  stop() {
    this.active = false;
  }
  
  /**
   * Actualiza el estado interno del efecto
   * @param {number} deltaTime - ms desde último frame
   * @param {Object} context - { bpm, beat, energy, entropy }
   */
  tick(deltaTime, context) {
    if (!this.active) return;
    
    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.duration) {
      this.stop();
      return;
    }
    
    // Actualizar fase (para efectos cíclicos)
    this._updatePhase(deltaTime, context);
  }
  
  /**
   * Aplica el efecto al estado base
   * @param {Object} baseState - Estado actual (color, position, dimmer)
   * @returns {Object} - Estado modificado
   */
  apply(baseState) {
    // Implementar en subclases
    return baseState;
  }
  
  /**
   * @private
   */
  _updatePhase(deltaTime, context) {
    // Por defecto, fase basada en tiempo
    // Subclases pueden sobrescribir para sync con BPM
    this.phase += deltaTime / 1000;
  }
}
```

### Efectos de Dimmer

```javascript
/**
 * ⚡ STROBE: Onda cuadrada sincronizada con BPM
 */
class StrobeEffect extends Effect {
  constructor(config = {}) {
    super(config);
    this.type = 'strobe';
    this.blendMode = BLEND_MODES.MULTIPLY;
    
    // Frecuencia: pulsos por beat
    this.frequency = config.frequency || 4;  // 4 = semicorcheas
    this.dutyCycle = config.dutyCycle || 0.5; // 50% on, 50% off
  }
  
  _updatePhase(deltaTime, context) {
    // Sincronizar con BPM
    const beatsPerSecond = context.bpm / 60;
    const pulsesPerSecond = beatsPerSecond * this.frequency;
    this.phase += deltaTime / 1000 * pulsesPerSecond * Math.PI * 2;
  }
  
  apply(baseState) {
    if (!this.active) return baseState;
    
    // Onda cuadrada
    const cyclePosition = (this.phase % (Math.PI * 2)) / (Math.PI * 2);
    const strobeValue = cyclePosition < this.dutyCycle ? 1.0 : 0.0;
    
    return {
      ...baseState,
      dimmer: baseState.dimmer * strobeValue * this.intensity,
    };
  }
}

/**
 * 💓 PULSE: Onda sinusoidal suave
 */
class PulseEffect extends Effect {
  constructor(config = {}) {
    super(config);
    this.type = 'pulse';
    this.blendMode = BLEND_MODES.MULTIPLY;
    
    this.frequency = config.frequency || 1;  // Pulsos por beat
    this.minValue = config.minValue || 0.3;  // Nunca baja de 30%
  }
  
  _updatePhase(deltaTime, context) {
    const beatsPerSecond = context.bpm / 60;
    this.phase += deltaTime / 1000 * beatsPerSecond * this.frequency * Math.PI * 2;
  }
  
  apply(baseState) {
    if (!this.active) return baseState;
    
    // Onda sinusoidal (0 a 1)
    const sineValue = (Math.sin(this.phase) + 1) / 2;
    const pulseValue = this.minValue + sineValue * (1 - this.minValue);
    
    return {
      ...baseState,
      dimmer: baseState.dimmer * pulseValue * this.intensity,
    };
  }
}

/**
 * 💥 BLINDER: Flash intenso con decay exponencial
 */
class BlinderEffect extends Effect {
  constructor(config = {}) {
    super(config);
    this.type = 'blinder';
    this.blendMode = BLEND_MODES.MAX;  // MAX para subir sobre el base
    
    this.decayTime = config.decayTime || 200;  // ms hasta 10%
    this.holdTime = config.holdTime || 50;      // ms en máximo
  }
  
  apply(baseState) {
    if (!this.active) return baseState;
    
    const elapsed = Date.now() - this.startTime;
    let blinderValue;
    
    if (elapsed < this.holdTime) {
      // Fase de hold: máximo
      blinderValue = 1.0;
    } else {
      // Fase de decay: exponencial
      const decayElapsed = elapsed - this.holdTime;
      blinderValue = Math.exp(-decayElapsed / this.decayTime * 3);
    }
    
    return {
      ...baseState,
      dimmer: Math.max(baseState.dimmer, blinderValue * this.intensity),
    };
  }
}
```

### Efectos de Posición

```javascript
/**
 * 🌋 SHAKE: Vibración caótica determinista
 */
class ShakeEffect extends Effect {
  constructor(config = {}) {
    super(config);
    this.type = 'shake';
    this.blendMode = BLEND_MODES.ADD;
    
    this.amplitudePan = config.amplitudePan || 10;   // Unidades DMX
    this.amplitudeTilt = config.amplitudeTilt || 5;
    this.speed = config.speed || 20;  // Hz
    
    // Seeds deterministas para el "ruido"
    this.seedX = config.seedX || 1.618;  // PHI
    this.seedY = config.seedY || 2.718;  // e
  }
  
  /**
   * Ruido determinista (no usa Math.random)
   * @private
   */
  _deterministicNoise(t, seed) {
    // Suma de senos con frecuencias irracionales
    return (
      Math.sin(t * 7.3 * seed) * 0.5 +
      Math.sin(t * 13.7 * seed * 0.7) * 0.3 +
      Math.sin(t * 23.1 * seed * 1.3) * 0.2
    );
  }
  
  apply(baseState) {
    if (!this.active) return baseState;
    
    const t = this.phase * this.speed;
    
    // Offset determinista
    const offsetPan = this._deterministicNoise(t, this.seedX) * this.amplitudePan * this.intensity;
    const offsetTilt = this._deterministicNoise(t, this.seedY) * this.amplitudeTilt * this.intensity;
    
    return {
      ...baseState,
      pan: baseState.pan + offsetPan,
      tilt: baseState.tilt + offsetTilt,
    };
  }
}

/**
 * 🌀 DIZZY: Offset espiral (mareo)
 */
class DizzyEffect extends Effect {
  constructor(config = {}) {
    super(config);
    this.type = 'dizzy';
    this.blendMode = BLEND_MODES.ADD;
    
    this.radius = config.radius || 15;  // Radio máximo en DMX
    this.speed = config.speed || 2;     // Vueltas por segundo
  }
  
  _updatePhase(deltaTime, context) {
    // Espiral que crece y decrece con la energía
    this.phase += deltaTime / 1000 * this.speed * Math.PI * 2;
  }
  
  apply(baseState) {
    if (!this.active) return baseState;
    
    // Espiral: radio pulsa, ángulo gira
    const currentRadius = this.radius * this.intensity * 
      ((Math.sin(this.phase * 0.3) + 1) / 2);  // Pulsa
    
    const offsetPan = Math.cos(this.phase) * currentRadius;
    const offsetTilt = Math.sin(this.phase) * currentRadius * 0.5;
    
    return {
      ...baseState,
      pan: baseState.pan + offsetPan,
      tilt: baseState.tilt + offsetTilt,
    };
  }
}
```

### Efectos de Color

```javascript
/**
 * 🌈 RAINBOW: Chase de hue
 */
class RainbowEffect extends Effect {
  constructor(config = {}) {
    super(config);
    this.type = 'rainbow';
    this.blendMode = BLEND_MODES.REPLACE;
    
    this.speed = config.speed || 0.5;  // Ciclos por segundo
    this.saturation = config.saturation || 1.0;
    this.lightness = config.lightness || 0.5;
  }
  
  apply(baseState) {
    if (!this.active) return baseState;
    
    // Hue que gira continuamente
    const hue = (this.phase * this.speed * 360) % 360;
    
    // Convertir HSL a RGB
    const rgb = this._hslToRgb(hue, this.saturation, this.lightness);
    
    // Mezclar con el color base según intensidad
    return {
      ...baseState,
      color: {
        r: Math.round(baseState.color.r * (1 - this.intensity) + rgb.r * this.intensity),
        g: Math.round(baseState.color.g * (1 - this.intensity) + rgb.g * this.intensity),
        b: Math.round(baseState.color.b * (1 - this.intensity) + rgb.b * this.intensity),
      },
    };
  }
  
  _hslToRgb(h, s, l) {
    // ... implementación estándar
  }
}

/**
 * 🚨 POLICE: Rojo/Azul alternante
 */
class PoliceEffect extends Effect {
  constructor(config = {}) {
    super(config);
    this.type = 'police';
    this.blendMode = BLEND_MODES.REPLACE;
    
    this.frequency = config.frequency || 2;  // Cambios por segundo
  }
  
  _updatePhase(deltaTime, context) {
    this.phase += deltaTime / 1000 * this.frequency;
  }
  
  apply(baseState) {
    if (!this.active) return baseState;
    
    // Alternar entre rojo y azul
    const isRed = Math.floor(this.phase) % 2 === 0;
    
    const color = isRed 
      ? { r: 255, g: 0, b: 0 }
      : { r: 0, g: 0, b: 255 };
    
    return {
      ...baseState,
      color: {
        r: Math.round(baseState.color.r * (1 - this.intensity) + color.r * this.intensity),
        g: Math.round(baseState.color.g * (1 - this.intensity) + color.g * this.intensity),
        b: Math.round(baseState.color.b * (1 - this.intensity) + color.b * this.intensity),
      },
    };
  }
}
```

### EffectManager: El Director de Efectos

```javascript
class EffectManager {
  constructor() {
    this.activeEffects = new Map();
    this.effectClasses = {
      strobe: StrobeEffect,
      pulse: PulseEffect,
      blinder: BlinderEffect,
      shake: ShakeEffect,
      dizzy: DizzyEffect,
      rainbow: RainbowEffect,
      police: PoliceEffect,
    };
  }
  
  /**
   * Crea y activa un efecto
   */
  trigger(effectType, config = {}) {
    const EffectClass = this.effectClasses[effectType];
    if (!EffectClass) {
      console.warn(`[EffectManager] Efecto "${effectType}" no existe`);
      return null;
    }
    
    const effect = new EffectClass(config);
    effect.start();
    this.activeEffects.set(effect.id, effect);
    
    console.log(`[EffectManager] 🎭 Efecto "${effectType}" activado`);
    return effect.id;
  }
  
  /**
   * Detiene un efecto específico
   */
  stop(effectId) {
    const effect = this.activeEffects.get(effectId);
    if (effect) {
      effect.stop();
      this.activeEffects.delete(effectId);
    }
  }
  
  /**
   * Detiene todos los efectos de un tipo
   */
  stopType(effectType) {
    for (const [id, effect] of this.activeEffects) {
      if (effect.type === effectType) {
        effect.stop();
        this.activeEffects.delete(id);
      }
    }
  }
  
  /**
   * Actualiza todos los efectos activos
   */
  tick(deltaTime, context) {
    for (const [id, effect] of this.activeEffects) {
      effect.tick(deltaTime, context);
      
      // Limpiar efectos terminados
      if (!effect.active) {
        this.activeEffects.delete(id);
      }
    }
  }
  
  /**
   * Aplica todos los efectos al estado base
   */
  apply(baseState) {
    let state = { ...baseState };
    
    // Ordenar por prioridad
    const sorted = [...this.activeEffects.values()]
      .sort((a, b) => a.priority - b.priority);
    
    for (const effect of sorted) {
      state = effect.apply(state);
    }
    
    return state;
  }
}
```

---

## 🔌 Integración con FixtureManager

### Mapeo Abstracto → Canales DMX

El `FixtureManager` traduce las propiedades abstractas de V17 a canales DMX específicos usando la información de los archivos `.fxt`.

```javascript
class FixtureChannelMapper {
  constructor(fixtureDefinition) {
    this.channels = fixtureDefinition.channels;
    this.capabilities = fixtureDefinition.capabilities;
  }
  
  /**
   * Traduce OpticState abstracto a valores DMX
   * @param {Object} opticState - { beamWidth, texture, fragmentation, ... }
   * @returns {Object} - { channelName: dmxValue }
   */
  mapOpticsToDMX(opticState) {
    const dmx = {};
    
    // ═══════════════════════════════════════════════════════════════════════
    // ZOOM (beamWidth)
    // ═══════════════════════════════════════════════════════════════════════
    if (this.capabilities.zoom) {
      // beamWidth 0 = zoom mínimo (beam), 1 = zoom máximo (wash)
      dmx[this.channels.zoom] = Math.round(opticState.beamWidth * 255);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FOCUS (relacionado con beamWidth)
    // ═══════════════════════════════════════════════════════════════════════
    if (this.capabilities.focus) {
      // Focus inversamente proporcional al zoom para mantener nitidez
      const focusValue = 1 - opticState.beamWidth * 0.5;
      dmx[this.channels.focus] = Math.round(focusValue * 255);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // GOBO (texture)
    // ═══════════════════════════════════════════════════════════════════════
    if (this.capabilities.gobo) {
      // Mapear texture a índice de gobo
      // Los fixtures suelen tener 5-10 gobos
      const goboCount = this.capabilities.goboCount || 8;
      const goboIndex = Math.floor(opticState.texture * (goboCount - 1));
      
      // Cada gobo ocupa un rango de valores DMX
      const dmxPerGobo = 255 / goboCount;
      dmx[this.channels.gobo] = Math.round(goboIndex * dmxPerGobo + dmxPerGobo / 2);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // GOBO ROTATION (textureRotation)
    // ═══════════════════════════════════════════════════════════════════════
    if (this.capabilities.goboRotation) {
      // 0 = estático, 0.5 = rotación horaria lenta, 1 = rotación máxima
      // La mayoría de fixtures: 0-127 = horario, 128-255 = antihorario
      // Usamos solo horario para simplicidad
      dmx[this.channels.goboRotation] = Math.round(opticState.textureRotation * 127);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PRISM (fragmentation)
    // ═══════════════════════════════════════════════════════════════════════
    if (this.capabilities.prism) {
      // 0 = prism off, >0 = prism on
      dmx[this.channels.prism] = opticState.fragmentation > 0.1 ? 255 : 0;
    }
    
    if (this.capabilities.prismRotation) {
      // Similar a gobo rotation
      dmx[this.channels.prismRotation] = Math.round(opticState.fragmentation * 127);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FROST
    // ═══════════════════════════════════════════════════════════════════════
    if (this.capabilities.frost) {
      dmx[this.channels.frost] = Math.round(opticState.frost * 255);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // IRIS
    // ═══════════════════════════════════════════════════════════════════════
    if (this.capabilities.iris) {
      // iris 0 = cerrado, 1 = abierto
      dmx[this.channels.iris] = Math.round(opticState.iris * 255);
    }
    
    return dmx;
  }
}
```

### Estructura de Fixture Definition (.fxt enhanced)

```javascript
const FIXTURE_DEFINITION = {
  name: "Moving Head Pro 280",
  type: "MOVING_HEAD",
  channels: {
    pan: 1,
    panFine: 2,
    tilt: 3,
    tiltFine: 4,
    dimmer: 5,
    strobe: 6,
    red: 7,
    green: 8,
    blue: 9,
    white: 10,
    zoom: 11,
    focus: 12,
    gobo: 13,
    goboRotation: 14,
    prism: 15,
    prismRotation: 16,
    frost: 17,
    // ... más canales
  },
  capabilities: {
    rgb: true,
    rgbw: true,
    zoom: true,
    focus: true,
    gobo: true,
    goboCount: 8,
    goboRotation: true,
    prism: true,
    prismRotation: true,
    frost: true,
    iris: false,  // Este fixture no tiene iris
  },
  ranges: {
    zoom: { min: 5, max: 45 },  // Grados
    focus: { near: 2, far: 20 }, // Metros
  },
};
```

---

## 🎲 Filosofía Determinista

### Mandamiento Supremo

> **CERO `Math.random()` EN TODO EL SISTEMA.**

Todo debe ser reproducible. Si grabas un show con la misma canción, debe verse idéntico.

### getSystemEntropy(): La Fuente de "Aleatoriedad" Determinista

```javascript
/**
 * 🎲 Genera un valor pseudo-aleatorio determinista
 * Basado en: tiempo, BPM, paleta activa, frame count
 * 
 * @param {Object} context - Contexto actual
 * @returns {number} - Valor 0.0 a 1.0
 */
function getSystemEntropy(context) {
  const { 
    frameCount, 
    bpm = 120, 
    palette = 'fuego',
    audioEnergy = 0.5 
  } = context;
  
  // Semillas basadas en contexto
  const timeSeed = (Date.now() / 1000) % 1000;
  const frameSeed = frameCount * 0.001;
  const bpmSeed = (bpm / 60) * 0.1;
  const paletteSeed = hashPalette(palette) * 0.01;
  
  // Combinación determinista
  const combined = (
    Math.sin(timeSeed * 0.7) * 0.3 +
    Math.sin(frameSeed * 1.3) * 0.25 +
    Math.sin(bpmSeed * 2.1) * 0.25 +
    Math.sin(paletteSeed * 3.7) * 0.2
  );
  
  // Normalizar a [0, 1]
  return (combined + 1) / 2;
}

/**
 * Hash determinista para string de paleta
 */
function hashPalette(palette) {
  let hash = 0;
  for (let i = 0; i < palette.length; i++) {
    hash = ((hash << 5) - hash) + palette.charCodeAt(i);
    hash = hash & hash;  // Convertir a 32bit int
  }
  return Math.abs(hash) % 1000;
}
```

### Usos de Entropy en V17

```javascript
// ═══════════════════════════════════════════════════════════════════════
// SELECCIÓN DE GOBO
// ═══════════════════════════════════════════════════════════════════════
// En lugar de: goboIndex = Math.floor(Math.random() * goboCount)
// Usar:
const entropy = getSystemEntropy(context);
const goboIndex = Math.floor(entropy * goboCount);

// ═══════════════════════════════════════════════════════════════════════
// VARIACIÓN DE INTENSIDAD DE EFECTO
// ═══════════════════════════════════════════════════════════════════════
// En lugar de: effectIntensity = 0.8 + Math.random() * 0.2
// Usar:
const effectIntensity = 0.8 + getSystemEntropy(context) * 0.2;

// ═══════════════════════════════════════════════════════════════════════
// ROTACIÓN DE PRISMA
// ═══════════════════════════════════════════════════════════════════════
// En lugar de: rotationSpeed = Math.random() > 0.5 ? 'cw' : 'ccw'
// Usar:
const rotationDirection = getSystemEntropy(context) > 0.5 ? 'cw' : 'ccw';
```

---

## 📦 Estructuras de Datos

### Estado Completo de un Fixture (V17)

```javascript
const FixtureState = {
  // ═══════════════════════════════════════════════════════════════════════
  // BASE (V15-V16)
  // ═══════════════════════════════════════════════════════════════════════
  color: { r: 255, g: 128, b: 64 },
  dimmer: 0.85,
  pan: 127,
  tilt: 100,
  panFine: 0,
  tiltFine: 0,
  
  // ═══════════════════════════════════════════════════════════════════════
  // ÓPTICAS (V17)
  // ═══════════════════════════════════════════════════════════════════════
  optics: {
    beamWidth: 0.3,
    texture: 0.5,
    textureRotation: 0.4,
    fragmentation: 0.6,
    frost: 0.0,
    iris: 0.8,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFECTOS ACTIVOS (V17)
  // ═══════════════════════════════════════════════════════════════════════
  activeEffects: ['strobe_001', 'shake_002'],
  
  // ═══════════════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════════════
  lastUpdate: 1701532800000,
  zone: 'MOVING_LEFT',
};
```

### Configuración de Escena (V17)

```javascript
const SceneConfig = {
  // Base
  palette: 'fuego',
  mood: 'intense',
  energy: 0.8,
  
  // Ópticas globales
  globalOptics: {
    beamWidth: 0.4,
    texture: 0.5,
    fragmentation: 0.7,
  },
  
  // Efectos activos
  effects: [
    { type: 'strobe', config: { frequency: 4, dutyCycle: 0.3 } },
    { type: 'shake', config: { amplitude: 10, speed: 15 } },
  ],
  
  // Overrides por zona
  zoneOverrides: {
    MOVING_LEFT: { fragmentation: 1.0 },
    FRONT_PARS: { beamWidth: 0.9, effects: [] },  // PARs sin strobe
  },
};
```

---

## 💻 Pseudocódigo de Decisión

### Flujo Principal (cada frame)

```javascript
function processFrame(audioData, deltaTime) {
  // 1. Obtener contexto
  const context = {
    frameCount: state.frameCount++,
    bpm: audioData.bpm,
    beat: audioData.beat,
    energy: (audioData.bass + audioData.mid) / 2,
    entropy: getSystemEntropy({ frameCount: state.frameCount, bpm: audioData.bpm, palette: state.palette }),
  };
  
  // 2. Decisión de Selene (Base Layer - V15/V16)
  const baseDecision = selene.process(audioData);
  // → { color, dimmer, zones, palette, mood }
  
  // 3. Actualizar ópticas (V17)
  opticEngine.update(baseDecision.mood, context.energy, context.bpm, context.entropy);
  opticEngine.tick(deltaTime);
  const opticState = opticEngine.getState();
  
  // 4. Actualizar efectos (V17)
  effectManager.tick(deltaTime, context);
  
  // 5. Trigger de efectos por eventos
  if (audioData.beat && context.energy > 0.8) {
    effectManager.trigger('blinder', { intensity: 0.5, decayTime: 150 });
  }
  
  if (baseDecision.mood === 'drop' && !effectManager.hasType('strobe')) {
    effectManager.trigger('strobe', { frequency: 8, dutyCycle: 0.3 });
  }
  
  // 6. Componer estado final para cada fixture
  state.fixtures.forEach(fixture => {
    // 6a. Estado base
    let fixtureState = {
      color: baseDecision.zones[fixture.zone].color,
      dimmer: baseDecision.zones[fixture.zone].intensity,
      pan: fixture.currentPan,
      tilt: fixture.currentTilt,
    };
    
    // 6b. Aplicar efectos
    fixtureState = effectManager.apply(fixtureState);
    
    // 6c. Aplicar ópticas (solo moving heads)
    if (fixture.type === 'MOVING_HEAD') {
      fixtureState.optics = opticState;
    }
    
    // 6d. Traducir a DMX
    const dmxValues = fixtureMapper.toDMX(fixtureState);
    
    // 6e. Enviar
    dmxOutput.send(fixture.dmxAddress, dmxValues);
  });
}
```

### Decisiones de Efectos por Mood

```javascript
const MOOD_EFFECT_RULES = {
  chill: {
    allowedEffects: ['breathe', 'fade'],
    forbiddenEffects: ['strobe', 'police', 'shake'],
    autoTrigger: {
      breathe: { probability: 0.3, config: { frequency: 0.2 } },
    },
  },
  
  fuego: {
    allowedEffects: ['pulse', 'rainbow', 'dizzy'],
    forbiddenEffects: ['police'],
    autoTrigger: {
      pulse: { probability: 0.5, config: { frequency: 2 } },
    },
  },
  
  neon: {
    allowedEffects: ['strobe', 'shake', 'police'],
    forbiddenEffects: ['breathe', 'fade'],
    autoTrigger: {
      strobe: { probability: 0.7, config: { frequency: 4 } },
    },
  },
  
  drop: {
    allowedEffects: ['strobe', 'blinder', 'shake', 'rainbow'],
    forbiddenEffects: [],
    autoTrigger: {
      strobe: { probability: 1.0, config: { frequency: 8, dutyCycle: 0.5 } },
      shake: { probability: 0.8, config: { amplitude: 15 } },
    },
  },
  
  hielo: {
    allowedEffects: ['breathe', 'fade', 'pulse'],
    forbiddenEffects: ['strobe', 'police', 'shake'],
    autoTrigger: {
      breathe: { probability: 0.6, config: { frequency: 0.1, minValue: 0.5 } },
    },
  },
};
```

---

## 🗺️ Roadmap de Implementación

### Fase 1: Infraestructura (2-3 días)

- [ ] Crear `LayerStack` class
- [ ] Crear `Effect` base class
- [ ] Crear `EffectManager`
- [ ] Integrar en `selene-integration.js`

### Fase 2: Efectos de Dimmer (1-2 días)

- [ ] Implementar `StrobeEffect`
- [ ] Implementar `PulseEffect`
- [ ] Implementar `BlinderEffect`
- [ ] Tests con música

### Fase 3: Efectos de Posición (1 día)

- [ ] Implementar `ShakeEffect`
- [ ] Implementar `DizzyEffect`
- [ ] Integrar con Physics Driver V16

### Fase 4: Motor de Ópticas (2-3 días)

- [ ] Crear `OpticEngine`
- [ ] Mapeo `OpticState` → DMX
- [ ] Integrar con FixtureManager
- [ ] Parsear capabilities de .fxt

### Fase 5: Efectos de Color (1 día)

- [ ] Implementar `RainbowEffect`
- [ ] Implementar `PoliceEffect`
- [ ] Implementar `FadeEffect`

### Fase 6: Integración & Testing (2 días)

- [ ] UI para activar/desactivar efectos
- [ ] Presets de efectos por género musical
- [ ] Testing extensivo con fixtures reales
- [ ] Documentación final

---

## 📊 Diagrama de Clases

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              LayerStack                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ - layers: { base, effects[], optics }                                   │
│ + resolve(): FinalState                                                 │
│ + setBase(state)                                                        │
│ + addEffect(effect)                                                     │
│ + setOptics(opticState)                                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│      EffectManager          │     │       OpticEngine           │
├─────────────────────────────┤     ├─────────────────────────────┤
│ - activeEffects: Map        │     │ - currentState: OpticState  │
│ - effectClasses: Registry   │     │ - targetState: OpticState   │
│ + trigger(type, config)     │     │ + update(mood, energy, ...)  │
│ + stop(id)                  │     │ + tick(deltaTime)           │
│ + tick(deltaTime, context)  │     │ + getState(): OpticState    │
│ + apply(baseState): State   │     └─────────────────────────────┘
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│         Effect (base)       │
├─────────────────────────────┤
│ - id, type, priority        │
│ - blendMode, intensity      │
│ - phase, startTime          │
│ + start(), stop()           │
│ + tick(deltaTime, context)  │
│ + apply(baseState): State   │
└─────────────────────────────┘
              △
              │ extends
    ┌─────────┼─────────┬─────────┬─────────┐
    ▼         ▼         ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
│Strobe  ││Pulse   ││Shake   ││Rainbow ││Blinder │
│Effect  ││Effect  ││Effect  ││Effect  ││Effect  │
└────────┘└────────┘└────────┘└────────┘└────────┘
```

---

## 🔗 Integración con V15-V16

### Modificaciones Requeridas

**selene-integration.js:**
```javascript
// Añadir imports
// import { LayerStack, EffectManager, OpticEngine } from './v17-effects.js';

// En constructor:
this.layerStack = new LayerStack();
this.effectManager = new EffectManager();
this.opticEngine = new OpticEngine();

// En process():
// Después de calcular color/movement, añadir:
this.layerStack.setBase({ color, dimmer, pan, tilt });
this.effectManager.tick(deltaTime, context);
this.opticEngine.update(this.activePalette, energy, bpm, entropy);

// Final resolution:
const finalState = this.layerStack.resolve();
```

**app-v2.js:**
```javascript
// En applySeleneDecision():
// Después de aplicar color y movimiento:
if (window.selene.effectManager) {
  const effectModified = window.selene.effectManager.apply({
    dimmer: fixture.currentDimmer,
    pan: fixture.currentPan,
    tilt: fixture.currentTilt,
    color: fixture.currentColor,
  });
  
  fixture.currentDimmer = effectModified.dimmer;
  fixture.currentPan = effectModified.pan;
  fixture.currentTilt = effectModified.tilt;
  fixture.currentColor = effectModified.color;
}
```

---

## ✅ Checklist de Validación

Antes de dar por completada V17:

- [ ] Strobe sincronizado con BPM
- [ ] Efectos no destruyen estado base (se pueden desactivar)
- [ ] Ópticas responden al mood
- [ ] Prisma rota determinísticamente (sin Math.random)
- [ ] Shake no causa jitter en DMX real
- [ ] Blinder tiene decay suave (no corte abrupto)
- [ ] Transiciones de ópticas son suaves
- [ ] Compatible con fixtures sin ópticas (PARs)
- [ ] Performance: <2ms por frame con 12 fixtures
- [ ] Documentación actualizada

---

## 🙏 Créditos

- **Arquitectura V17**: Claude Opus
- **Filosofía Determinista**: Gemini (GeminiPunk)
- **Implementación**: Claude Sonnet (Executor)
- **QA & Testing**: El Casero (fixtures en riesgo 😅)

---

*Blueprint V17 - Effects & Optics Engine*
*"La luz no solo ilumina, transforma el espacio"*
*LuxSync - Diciembre 2025*
