# 🎭 CHANGELOG V15: Human Touch & Deterministic Chaos

**Commit:** `ecd71b7`  
**Fecha:** $(Get-Date -Format "yyyy-MM-dd")  
**Directiva:** GeminiPunk Philosophy - "Selene es un motor Determinista/procedural con 3 modos de entropía... y con 0 Math.random()"

---

## 🎯 Objetivo Principal

Eliminar toda aleatoriedad no-determinista (`Math.random()`) y reemplazarla con **entropía derivada del sistema** (audio + tiempo), siguiendo la filosofía de Selene como motor determinista.

---

## ✨ Nuevas Características

### 1. 🎲 Motor de Entropía Determinista

```javascript
this.entropyState = {
  lastAudioEnergy: 0,      // Última energía de audio
  lastTimeSample: Date.now(), // Timestamp anterior
  accumulatedDrift: 0,     // Drift acumulado
};

getSystemEntropy() {
  // Extrae décimas de energía de audio (chaos from music)
  // + componente temporal (sin() del tiempo)
  // = Valor 0-1 totalmente determinista
}
```

**Fuentes de entropía:**
- Decimales de `personality.energy` (ej: 0.7**34** → 0.34)
- `Math.sin(time * 0.001)` para variación temporal suave
- `Math.cos(noise * 100)` para componente de ruido

### 2. 🎭 Lateralidad (Asimetría Artística)

| Zona | Offset Hue | Descripción |
|------|------------|-------------|
| `front` | +0° | Color puro de paleta (kick/bass) |
| `back` | -15° | Profundidad visual (snare/claps) |
| `left` | +0° | Moving head izquierdo (melodía) |
| `right` | +30° | Offset creativo escalado por `personality.creativity` |

```javascript
// RIGHT side: asimetría artística
if (side === 'right') {
  const creativityOffset = 30 * this.personality.creativity;
  h = (h + creativityOffset) % 360;
}

// BACK: profundidad visual
if (side === 'back') {
  h = (h - 15 + 360) % 360;
}
```

### 3. 📊 Parámetro `side` en getLivingColor()

**Firma actualizada:**
```javascript
getLivingColor(paletteName, intensity, zoneType = 'wash', side = 'left')
```

**Valores de `side`:**
- `'front'` - PARs frontales (sin offset)
- `'back'` - PARs traseros (-15° depth)
- `'left'` - Moving head izquierdo (sin offset)
- `'right'` - Moving head derecho (+30° creativity-scaled)

---

## 🔧 Cambios Técnicos

### Constructor
```javascript
// Nuevo: Estado de entropía
this.entropyState = {
  lastAudioEnergy: 0,
  lastTimeSample: Date.now(),
  accumulatedDrift: 0,
};
```

### calculateZoneColors()
```javascript
// V15: Todas las llamadas ahora pasan el parámetro side

// Front pars (kick)
frontColor = this.getLivingColor(palette, bass, 'wash', 'front');

// Back pars (snare)  
backColor = this.getLivingColor(palette, snare, 'wash', 'back');

// Moving heads (melodía)
leftColor = this.getLivingColor(palette, melody, 'spot', 'left');
rightColor = this.getLivingColor(palette, melody, 'spot', 'right');
```

---

## 🌈 Refinamientos de Paleta

### Fuego 🔥
- Hue clamped a 350-20° (rojo-naranja, evita amarillo)
- Spot: violeta mágico (285°) en intensidad alta

### Selva 🌿
- Histéresis para pink trigger (anti-flicker)
- Orchid pink (290°) solo cuando intensity > 0.7 + creatividad alta

### Neón 💜
- Entropía determina selección: cian (180°), magenta (300°), amarillo (60°)
- `Math.floor(entropy * 3)` en lugar de `Math.random()`

### Océano 🌊
- Gradiente más azul (hue 190-220°)
- Turquesa profundo en spots

---

## 📈 Arquitectura Selene (Referencia)

V15 se alinea con la arquitectura encontrada en `/src/engines/selene/`:

### deterministic-utils.ts
```typescript
// LCG random - generador determinista con seed
export function lcgRandom(seed: number): number;
export function deterministicNoise(x: number, seed: number): number;
```

### fibonacci-pattern-engine.ts
```typescript
// PHI = Golden Ratio para patrones evolutivos
const PHI = 1.618033988749895;
```

### mode-manager.ts
```typescript
// 3 modos de entropía
type ModeConfig = {
  entropyFactor: 0 | 50 | 100;  // deterministic | balanced | punk
  riskThreshold: number;
  punkProbability: number;
  feedbackInfluence: number;
};
```

---

## 🚫 Eliminado

- `Math.random()` - Reemplazado por `getSystemEntropy()`
- Variación temporal ingenua - Ahora usa sistema de personalidad

---

## ✅ Tests Recomendados

1. **Determinismo:** Misma canción + mismo timestamp = mismos colores
2. **Lateralidad:** RIGHT debería tener offset visible vs LEFT
3. **Depth:** BACK pars deberían verse más "profundos" que FRONT
4. **Paletas:** Verificar que Fuego no muestre amarillo, Selva active pink correctamente

---

## 🔗 Referencias

- **V14:** Living Palettes (base)
- **Commit anterior:** `2358b57`
- **GeminiPunk Directive:** Deterministic Chaos Philosophy
- **Selene Core:** `/src/engines/selene/shared/deterministic-utils.ts`
