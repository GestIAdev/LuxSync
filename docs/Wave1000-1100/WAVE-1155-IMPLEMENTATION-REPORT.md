# 🩰 WAVE 1155: THE CHOREOGRAPHER REBORN

## 📜 Manifiesto

**FILOSOFÍA: "HARMONIC MOTION"**

El movimiento NO compite con los efectos (Flash/Color).
El movimiento TRANSPORTA la luz. Es la danza, no el bailarín.

---

## 🏆 LA DOCENA DORADA

12 patrones matemáticamente puros. Sin fallbacks. Sin legacy. Sin fantasmas.

### 🏭 TECHNO (4 patrones - Geometría Dura)

| Patrón | Descripción | Período | Matemática |
|--------|-------------|---------|------------|
| `scan_x` | Barrido horizontal puro (policía/searchlight) | 2 beats | `x = sin(θ), y = 0` |
| `square` | Movimiento cuadrado, esquinas duras | 4 beats | 4 posiciones cuantizadas |
| `diamond` | Rombo agresivo (norma L1) | 2 beats | `x = sin(θ)·√2, y = cos(θ)·√2` |
| `botstep` | Posiciones robóticas pseudo-random | 1 beat | Golden ratio quantization |

### 💃 LATINO (3 patrones - Curvas Sensuales)

| Patrón | Descripción | Período | Matemática |
|--------|-------------|---------|------------|
| `figure8` | El infinito ∞ (Lissajous 1:2) | 4 beats | `x = sin(θ), y = sin(2θ)` |
| `wave_y` | Ola: X lento, Y rápido | 2 beats | `x = sin(θ/2), y = sin(2θ)` |
| `ballyhoo` | Espiral compleja, cierra en 16 beats | 16 beats | Armónicos 1, 3, 5 |

### 🎸 POP-ROCK (3 patrones - Majestuosidad)

| Patrón | Descripción | Período | Matemática |
|--------|-------------|---------|------------|
| `circle_big` | El rey de los estadios | 4 beats | `x = sin(θ), y = cos(θ)` |
| `cancan` | Patadas verticales coordinadas | 2 beats | `x ≈ 0, y = sin(θ)` |
| `dual_sweep` | Barrido en U majestuoso | 4 beats | `y = x² - 0.3` (parábola) |

### 🍃 CHILL (3 patrones - Respiración)

| Patrón | Descripción | Período | Matemática |
|--------|-------------|---------|------------|
| `drift` | Movimiento browniano (humo) | 8 beats | Senos con φ, √2, √3 |
| `sway` | Péndulo suave (barco) | 4 beats | `x = sin(θ), y = 0` |
| `breath` | La luz respira | 4 beats | `x = 0, y = sin(θ)·0.35` |

---

## 🎨 CONFIGURACIÓN POR VIBE

```typescript
'techno-club': {
  amplitudeScale: 1.0,      // FULL RANGE
  baseFrequency: 0.25,
  patterns: ['scan_x', 'square', 'diamond', 'botstep'],
}

'fiesta-latina': {
  amplitudeScale: 0.85,     // Amplio pero sensual
  baseFrequency: 0.15,
  patterns: ['figure8', 'wave_y', 'ballyhoo'],
}

'pop-rock': {
  amplitudeScale: 0.80,     // Con peso
  baseFrequency: 0.20,
  patterns: ['circle_big', 'cancan', 'dual_sweep'],
}

'chill-lounge': {
  amplitudeScale: 0.50,     // Sutil
  baseFrequency: 0.10,
  patterns: ['drift', 'sway', 'breath'],
}
```

---

## 📊 Comparativa

| Métrica | VMM Antiguo | VMM 1155 |
|---------|-------------|----------|
| Líneas de código | 1028 | ~480 |
| Patrones totales | 25+ (muchos fantasma) | 12 (exactos) |
| Fallbacks | 7+ (confusos) | 1 (breath) |
| Complejidad cognitiva | Alta | Mínima |
| Patrones por género | Variable (3-7) | Consistente (3-4) |

---

## �️ Safety & Smoothness (WAVE 1155.1)

### 1. Safety: Mathematical Bounds

Todos los patrones matemáticos retornan valores en el rango **`[-1.0, +1.0]`**.

```typescript
// Ejemplo: figura8
return {
  x: Math.sin(phase),           // -1.0 a +1.0
  y: Math.sin(phase * 2) * 0.6, // -0.6 a +0.6
}
```

El escalado final por `amplitude` (Gearbox) asegura que **NUNCA** golpeamos topes mecánicos:

```typescript
const position = {
  x: Math.max(-1, Math.min(1, rawPosition.x * effectiveAmplitude)),
  y: Math.max(-1, Math.min(1, rawPosition.y * effectiveAmplitude)),
}
```

### 2. Smoothness: 2-Second LERP Transitions

Cuando el patrón cambia (ej: `square` → `circle_big`), implementamos un **LERP suave de 2 segundos**:

```typescript
// Detectar cambio de patron
if (this.lastPattern !== null && this.lastPattern !== patternName) {
  this.isTransitioning = true
  this.transitionStartTime = now
}

// LERP con curva ease-out (t^2 * (3 - 2t))
if (this.isTransitioning) {
  const t = Math.min(1.0, elapsed / 2000)
  const smoothT = t * t * (3 - 2 * t)
  
  finalPosition = {
    x: lastPosition.x + (newPosition.x - lastPosition.x) * smoothT,
    y: lastPosition.y + (newPosition.y - lastPosition.y) * smoothT,
  }
}
```

**Resultado**: En lugar de saltos bruscos, las luces fluyen orgánicamente entre patrones.

| Transición | Sin LERP | Con LERP |
|------------|----------|----------|
| `square` → `circle_big` | Salto cuántico ⚡ | Flujo orgánico 🌊 |
| `scan_x` → `diamond` | Fixture se teletransporta 💥 | Transición suave ✨ |

---

## �🔄 Compatibilidad

### ✅ Preservado:
- `MovementIntent` interface (100% compatible)
- `AudioContext` interface (100% compatible)
- Manual override API (WAVE 999)
- Gearbox (hardware speed limiting)
- Beat-locked phase (WAVE 1153)
- Time-based fallback (WAVE 1152)
- Singleton export

### ❌ Eliminado:
- Patrones legacy: `sweep`, `skySearch`, `mirror`, `blinder`, `vShape`, `wave`, `chaos`, `stageDive`, `guitarSolo`, `headbanger`, `ocean`, `nebula`, `aurora`, `static`, `hold`, `chase`, `pulse`
- Rock subgenres configs: `rock-metal`, `rock-indie`, `rock-prog`
- Energy history / dynamic threshold
- Veto por energía baja (simplificado a homeOnSilence)

---

## 🧪 Verificación Visual

Para cada género, el fixture debe:

| Género | Comportamiento Esperado |
|--------|-------------------------|
| Techno | Geometría dura, cortes, robots |
| Latino | Curvas fluidas, caderas, sensual |
| Pop-Rock | Círculos épicos, simetría, estadio |
| Chill | Movimiento orgánico, casi invisible |

---

## 🎯 Archivos Modificados

- `electron-app/src/engine/movement/VibeMovementManager.ts` - REESCRITO COMPLETO

---

## 🏁 Status: COMPLETE

1028 líneas de legacy → 480 líneas de matemática pura.

La Docena Dorada está implementada.

---

*WAVE 1155 - PunkOpus - El coreógrafo renació*
