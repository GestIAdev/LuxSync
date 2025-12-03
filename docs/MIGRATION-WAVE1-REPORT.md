# 🌊 MIGRACIÓN WAVE 1: COLOR & MOVEMENT

**Fecha:** 3 de Diciembre, 2025  
**Estado:** ✅ COMPLETADO  
**Branch:** main

---

## 📋 RESUMEN EJECUTIVO

Wave 1 migra la lógica probada del demo web (`demo/selene-integration.js` y `demo/selene-movement-engine.js`) al nuevo backend TypeScript de Electron (`electron-app/src/main/selene-lux-core/`).

### Archivos Fuente (JavaScript Demo)
- `demo/selene-integration.js` (~1759 líneas) → `getLivingColor()` V15.2
- `demo/selene-movement-engine.js` (~597 líneas) → Patrones Lissajous

### Archivos Destino (TypeScript Backend)
- `electron-app/src/main/selene-lux-core/engines/visual/ColorEngine.ts`
- `electron-app/src/main/selene-lux-core/engines/visual/MovementEngine.ts`
- `electron-app/src/main/selene-lux-core/SeleneLux.ts`
- `electron-app/electron/main.ts`

---

## 🎨 1. ColorEngine - Living Palettes V15.2

### Características Migradas

| Feature | Descripción | Estado |
|---------|-------------|--------|
| `getLivingColor()` | Motor de colores procedurales HSL | ✅ |
| `getSystemEntropy()` | Entropía determinista (sin Math.random) | ✅ |
| `hslToRgb()` | Conversión HSL → RGB | ✅ |
| Sistema de lateralidad | Parámetro `side` para romper simetría | ✅ |
| Transiciones suaves | `updateTransition(deltaTime)` | ✅ |

### Paletas Disponibles

```typescript
type LivingPaletteId = 'fuego' | 'hielo' | 'selva' | 'neon'
```

| Paleta | Descripción | Características V15.2 |
|--------|-------------|----------------------|
| 🔥 **fuego** | Rojos, naranjas, dorados | Respiración amplia, Moving Left liberado |
| ❄️ **hielo** | Cyans, azules, rosa chicle | Aurora determinista, minIntensity 0.25 |
| 🌿 **selva** | Verdes → Oro solar | Hysteresis Rosa anti-parpadeo |
| ⚡ **neon** | Pares de colores Blade Runner | Estabilizado "Cumbia Safe" |

### API Principal

```typescript
// Generar color para una zona
getLivingColor(
  paletteName: string,
  intensity: number,      // 0-1
  zoneType: 'wash' | 'spot',
  side: 'left' | 'right' | 'front' | 'back'
): RGBColor

// Generar colores para todas las zonas
calculateZoneColors(intensity: number): {
  front: RGBColor
  back: RGBColor
  movingLeft: RGBColor
  movingRight: RGBColor
}

// Cambiar paleta
setPalette(palette: LivingPaletteId): void
```

---

## 🎯 2. MovementEngine - Patrones Lissajous

### Patrones Migrados

| Patrón | Descripción | Fórmula |
|--------|-------------|---------|
| `circle` | Círculo perfecto | freqX=1, freqY=1, phase=π/2 |
| `infinity` | Figura 8 / infinito | freqX=2, freqY=1 |
| `sweep` | Barrido horizontal | freqX=1, freqY=0.1 |
| `cloud` | Movimiento orgánico | freqX=1.3, freqY=1.7 |
| `waves` | Ondas suaves | freqX=1, freqY=2 |
| `static` | Sin movimiento | amplitude=0 |

### API Principal

```typescript
// Tick para múltiples fixtures (retorna posiciones)
tick(
  audioData: { energy, bass, mid, treble },
  deltaTime: number,
  fixtureIds: string[]
): FixtureMovement[]

interface FixtureMovement {
  fixtureId: string
  x: number      // 0-1
  y: number      // 0-1
  intensity: number
}

// Calcular posición para un fixture
calculate(
  metrics: AudioMetrics,
  beatState: BeatState,
  deltaTime: number
): MovementOutput
```

### Características Clave

- **Phase Offset por Fixture**: Cada fixture tiene un offset de fase único para movimiento orgánico
- **Sincronización BPM**: Opcional, normaliza velocidad a 120 BPM base
- **Modo Mirror**: Fixtures pares van invertidos en pan
- **Entropía Determinista**: Sin Math.random(), usa `getSystemEntropy()`

---

## 🔌 3. IPC Handlers - Comunicación Main ↔ Renderer

### Handlers Implementados

| Canal | Dirección | Descripción |
|-------|-----------|-------------|
| `lux:start` | Renderer → Main | Inicializa Selene y arranca main loop |
| `lux:stop` | Renderer → Main | Detiene main loop |
| `lux:set-palette` | Renderer → Main | Cambia paleta de colores |
| `lux:set-movement` | Renderer → Main | Cambia patrón de movimiento |
| `lux:get-state` | Renderer → Main | Obtiene estado actual |
| `lux:audio-frame` | Renderer → Main | Feed de audio desde Web Audio API |
| `lux:update-state` | Main → Renderer | Estado actualizado (cada 30ms) |

### Main Loop

```typescript
// 30ms = ~33fps
setInterval(() => {
  const state = selene.processAudioFrame(audioMetrics, deltaTime)
  mainWindow.webContents.send('lux:update-state', state)
}, 30)
```

---

## 🌙 4. SeleneLux - Orquestador Principal

### Constructor

```typescript
const selene = new SeleneLux({
  audio: {
    device: 'default',
    sensitivity: 0.7,
    noiseGate: 0.05,
    fftSize: 2048,
    smoothing: 0.8,
  },
  visual: {
    transitionTime: 300,
    colorSmoothing: 0.85,
    movementSmoothing: 0.8,
    effectIntensity: 1.0,
  },
  dmx: {
    universe: 1,
    driver: 'virtual',
    frameRate: 40,
  },
})
```

### Estado Completo

```typescript
interface SeleneState {
  mode: 'flow' | 'selene' | 'locked'
  palette: LivingPaletteId
  colors: ColorOutput
  movement: MovementOutput
  beat: BeatState
  consciousness: ConsciousnessState
  stats: { frames, decisions, uptime }
}
```

---

## 📁 Estructura de Archivos Actualizada

```
electron-app/
├── electron/
│   └── main.ts                 # ✅ IPC handlers + main loop
├── src/
│   └── main/
│       └── selene-lux-core/
│           ├── SeleneLux.ts    # ✅ Orquestador principal
│           ├── types.ts        # ✅ Tipos actualizados
│           └── engines/
│               ├── audio/
│               │   └── BeatDetector.ts
│               └── visual/
│                   ├── ColorEngine.ts   # ✅ Living Palettes V15.2
│                   └── MovementEngine.ts # ✅ Patrones Lissajous
```

---

## 🔜 PRÓXIMOS PASOS (Wave 2)

1. **EffectsEngine** - Migrar efectos (strobe, fade, chase)
2. **FixtureManager** - Gestión de fixtures DMX
3. **Preload + IPC Bridge** - Exponer API al renderer
4. **React Hooks** - `useSelene()` para el frontend
5. **Tests** - Unit tests para engines

---

## 📝 Notas Técnicas

### Entropía Determinista
```typescript
// SIN Math.random() - reproducible en mismas condiciones
getSystemEntropy(seedOffset = 0): number {
  const time = Date.now()
  const audioNoise = (this.personality.energy * 1000) % 1
  const combinedSeed = time * 0.001 + audioNoise * 100 + seedOffset * 7.3
  return (Math.sin(combinedSeed) + Math.cos(combinedSeed * 0.7) + 2) / 4
}
```

### Sistema de Lateralidad
El parámetro `side` en `getLivingColor()` permite:
- **front/back**: Wash lights (PAR)
- **left/right**: Moving heads (Spot)
- Offset cromático de -15° para `back` (profundidad 3D)

---

*Documentación generada automáticamente - LuxSync Migration Wave 1*
