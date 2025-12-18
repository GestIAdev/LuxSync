# 🌊 MIGRATION WAVE 2 REPORT
## Effects, Physics & UI Bridge

**Fecha:** 2024-12-03  
**Branch:** main  
**Estado:** ✅ COMPLETADO

---

## 📦 Archivos Migrados

### 1. EffectsEngine V17.0
**Archivo:** `electron-app/src/main/selene-lux-core/engines/visual/EffectsEngine.ts`  
**Fuente:** `demo/selene-effects-engine.js` (874 líneas)

#### Componentes Migrados:
- **LayerStack**: Arquitectura de 3 capas (Base → Effects → Optics)
  - `baseLayer`: r, g, b, w, dimmer, pan, tilt, beamWidth, texture, fragmentation
  - `effectsLayer`: dimmerMultiplier, colorOverride, positionOffset, active
  - `opticsLayer`: prismActive, goboIndex, zoomValue, focusValue
  - `merge()`: Fusiona las 3 capas en estado DMX final

- **EFFECT_DEFINITIONS**: 8 efectos predefinidos
  | Efecto | Tipo | Descripción | minDuration |
  |--------|------|-------------|-------------|
  | strobe | dimmer | Parpadeo rápido | 500ms |
  | pulse | dimmer | Respiración sine wave | 2000ms |
  | blinder | color | Flash blanco con fade out | 1000ms |
  | shake | position | Vibración pseudo-random | 500ms |
  | dizzy | position | Movimiento circular | 1000ms |
  | police | color | Alternancia rojo/azul | 2000ms |
  | rainbow | color | Ciclo HSL continuo | 3000ms |
  | breathe | dimmer | Pulse muy lento (ambient) | 5000ms |

- **EffectManager**: Gestiona efectos activos con duración
  - `trigger(effectName, params, duration)` → effectId
  - `cancel(effectId)`, `cancelType(typeName)`, `cancelAll()`
  - `process(entropy)` → EffectsLayer combinado

- **OpticEngine**: Motor de ópticas con **MECHANICAL DEBOUNCE**
  - ⚠️ `MECHANICAL_HOLD_TIME_MS = 2000` (crítico para hardware)
  - Protege gobos y prismas de cambios rápidos
  - Zoom/Focus con interpolación suave (0.1 factor)

---

### 2. FixturePhysicsDriver V16.1
**Archivo:** `electron-app/src/main/selene-lux-core/hardware/FixturePhysicsDriver.ts`  
**Fuente:** `demo/fixture-physics-driver.js` (508 líneas)

#### Features Migrados:
- **Installation Presets**: 4 configuraciones predefinidas
  - `ceiling`: Colgado del techo (tilt invertido)
  - `floor`: En suelo mirando arriba
  - `truss_front`: Truss frontal hacia público
  - `truss_back`: Truss trasero (contraluz, pan espejado)

- **Physics Easing**: Curva S con aceleración/deceleración
  - `maxAcceleration: 800` DMX/s²
  - `maxVelocity: 400` DMX/s
  - `arrivalThreshold: 1.0` DMX units

- **Safety Features V16.1**:
  - ⚠️ **safeDistance Fix**: `Math.max(0.5, absDistance)` - Protección contra singularidad
  - 🛡️ **NaN Guard**: Si las matemáticas explotan, usar home position
  - 🔓 **Anti-Stuck Mechanism**: Detecta fixtures pegados en límites (254/1)
  - 📉 **Anti-Jitter Filter**: Velocidades < 5 DMX/s → 0 (evita calentar servos)

---

### 3. UI Bridge (preload.ts)
**Archivo:** `electron-app/electron/preload.ts`

#### Nueva API `window.lux`:
```typescript
// Control
lux.start()
lux.stop()
lux.setPalette(index)
lux.setMovement({ pattern, speed, intensity })
lux.triggerEffect(name, params, duration)
lux.cancelEffect(effectId)
lux.cancelAllEffects()
lux.audioFrame(metrics)
lux.getState()

// Eventos
lux.onStateUpdate(callback)   // 30fps updates
lux.onPaletteChange(callback)
lux.onEffectTriggered(callback)
```

---

### 4. React Hook: useSelene
**Archivo:** `electron-app/src/hooks/useSelene.ts`

#### Exports:
- `useSelene()` - Hook principal con estado y métodos de control
- `useSeleneColor()` - Solo RGB actual
- `useSeleneAudio()` - Solo métricas de audio
- `useSeleneDimmer()` - Dimmer normalizado (0-1)

#### Tipos:
```typescript
interface SeleneState {
  r, g, b, w: number
  pan, tilt: number
  dimmer: number
  movementPhase: number
  activeEffects: string[]
  prismActive: boolean
  goboIndex: number
  audioMetrics?: AudioMetrics
  paletteIndex: number
  paletteName: string
  timestamp: number
}
```

---

## 🔗 Estructura de Archivos Wave 2

```
electron-app/
├── electron/
│   └── preload.ts              # ✅ Añadido window.lux API
├── src/
│   ├── hooks/
│   │   ├── index.ts            # ✅ NUEVO - Exports
│   │   └── useSelene.ts        # ✅ NUEVO - React hook
│   └── main/
│       └── selene-lux-core/
│           ├── engines/
│           │   └── visual/
│           │       └── EffectsEngine.ts  # ✅ REESCRITO V17
│           └── hardware/
│               ├── index.ts              # ✅ ACTUALIZADO
│               └── FixturePhysicsDriver.ts # ✅ NUEVO V16.1
```

---

## 📊 Comparativa Demo → TypeScript

| Archivo Demo | Líneas | Archivo TS | Estado |
|--------------|--------|------------|--------|
| selene-effects-engine.js | 874 | EffectsEngine.ts | ✅ Migrado |
| fixture-physics-driver.js | 508 | FixturePhysicsDriver.ts | ✅ Migrado |
| (N/A) | - | preload.ts | ✅ Actualizado |
| (N/A) | - | useSelene.ts | ✅ Nuevo |

---

## 🧪 Testing Pendiente

1. **EffectsEngine**
   - [ ] Verificar que efectos respetan minDuration
   - [ ] Verificar Mechanical Debounce (2000ms entre cambios de gobo/prisma)
   - [ ] Verificar LayerStack merge produce valores DMX válidos

2. **FixturePhysicsDriver**
   - [ ] Verificar curva S de aceleración
   - [ ] Probar anti-stuck en límites
   - [ ] Verificar NaN guard con inputs inválidos

3. **UI Bridge**
   - [ ] Verificar que useSelene recibe updates a 30fps
   - [ ] Probar todos los métodos de control
   - [ ] Verificar cleanup de listeners al desmontar

---

## 🎯 Próximos Pasos (Wave 3)

1. **Integración Dashboard**
   - Conectar barras de frecuencia con `useSeleneAudio()`
   - Conectar preview de color con `useSeleneColor()`
   - Añadir indicadores de efectos activos

2. **Main Process**
   - Implementar handlers IPC faltantes
   - Integrar EffectsEngine en SeleneLux.ts
   - Integrar FixturePhysicsDriver para moving heads

3. **Audio Pipeline**
   - Conectar audio real con `lux:audio-frame`
   - Calibrar BPM detection

---

**Wave 2 Status: ✅ COMPLETADO**  
*4 archivos creados/actualizados, 0 errores de lint*
