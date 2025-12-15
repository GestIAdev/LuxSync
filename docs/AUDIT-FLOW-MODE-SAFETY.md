# 🕵️ AUDITORÍA DE SEGURIDAD: FLOW MODE
## "Operation Flow Safe" - Pre-Show Check

**Fecha:** 2025-12-12  
**Auditor:** Claude Opus (AI Security Auditor)  
**Arquitecto:** Raúl Acate  
**Prioridad:** 🔴 URGENTE (Pre-Show Check)

---

## 📋 RESUMEN EJECUTIVO

| Aspecto | Veredicto | Riesgo |
|---------|-----------|--------|
| **Color Flicker** | ⚠️ RIESGO BAJO | Protección parcial |
| **Movement Safety** | 🔴 RIESGO ALTO | Sin smoothing activo |
| **Ceiling Config** | 🟢 EXISTE | Pero desconectado |

---

## 1️⃣ RUTA DEL COLOR (Anti-Flicker Analysis)

### Flujo Investigado
```
SeleneLux.processAudioFrame() [useBrain=false]
  ↓
colorEngine.generate(metrics, beatState, pattern)
  ↓
applyGlobalMultipliers(colors.primary)
  ↓
this.lastColors = {...}
```

### Hallazgos

#### ✅ ColorEngine.generate() es ROBUSTO
**Archivo:** `engines/visual/ColorEngine.ts` líneas 358-381

```typescript
generate(metrics, beatState, _pattern): ColorOutput {
  this.personality.energy = metrics.energy
  const intensity = metrics.energy * 0.7 + metrics.bass * 0.3  // ← Punto débil
  
  // getLivingColor tiene Math.max/min interno
  const primary = this.getLivingColor(this.activePalette, intensity, 'wash', 'front')
  
  return {
    primary: this.boostColor(primary, beatBoost),  // ← Math.min(255, ...) aquí
    ...
  }
}
```

**Análisis:**
- `getLivingColor()` → Usa `Math.max(0, Math.min(1, entropy))` internamente
- `hslToRgb()` → Retorna `Math.round(r * 255)` siempre
- `boostColor()` → Aplica `Math.min(255, Math.round(color.r * factor))`

#### ⚠️ Vulnerabilidad Potencial
**Archivo:** `SeleneLux.ts` línea 366

```typescript
const intensity = metrics.energy * 0.7 + metrics.bass * 0.3
```

**Si `metrics.energy` o `metrics.bass` son `undefined` o `NaN`:**
- `intensity = NaN`
- Pasa a `getLivingColor(palette, NaN, ...)`
- Dentro de `getLivingColor()`, línea 323:
  ```typescript
  const entropy = this.getSystemEntropy(frameSeed)  // frameSeed usa intensity
  ```
- `getSystemEntropy` tiene clamping: `Math.max(0, Math.min(1, entropy))`

**Conclusión:** El clamping interno PROTEGE contra la mayoría de casos NaN.

#### ✅ applyGlobalMultipliers tiene clamping final
**Archivo:** `SeleneLux.ts` líneas 775-792

```typescript
private applyGlobalMultipliers(rgb: { r, g, b }): { r, g, b } {
  // ...cálculos...
  return {
    r: Math.round(Math.max(0, Math.min(255, finalR))),  // ✅ Clamping
    g: Math.round(Math.max(0, Math.min(255, finalG))),
    b: Math.round(Math.max(0, Math.min(255, finalB))),
  }
}
```

**PERO:** `Math.round(NaN)` = `NaN` → El clamping NO protege contra NaN propagado.

### 🎨 VEREDICTO DE COLOR

| Pregunta | Respuesta |
|----------|-----------|
| ¿Se valida NaN antes de asignar? | ⚠️ NO explícitamente, pero hay clamping |
| ¿Qué pasa con energy=0? | ✅ Funciona (intensity=0, colores oscuros) |
| ¿Por qué podría parpadear? | Si `metrics` tiene undefined/NaN |

**Causa Probable del Flicker:**
- NO es el ColorEngine en sí
- Puede ser **pérdida de señal de audio** que causa `metrics.energy = undefined`
- El clamping final no atrapa NaN

### 🔧 HOTFIX RECOMENDADO (Color)

**Archivo:** `SeleneLux.ts` línea 427 (dentro del else)

```typescript
// ANTES:
const colors = this.colorEngine.generate(metrics, beatState, this.currentPattern)

// DESPUÉS (añadir validación):
const safeMetrics = {
  ...metrics,
  energy: Number.isFinite(metrics.energy) ? metrics.energy : 0,
  bass: Number.isFinite(metrics.bass) ? metrics.bass : 0,
  mid: Number.isFinite(metrics.mid) ? metrics.mid : 0,
  treble: Number.isFinite(metrics.treble) ? metrics.treble : 0,
}
const colors = this.colorEngine.generate(safeMetrics, beatState, this.currentPattern)
```

---

## 2️⃣ RUTA DEL MOVIMIENTO (Hardware Safety)

### Flujo Investigado
```
UI Slider (setMovementSpeed)
  ↓
SeleneLux.setMovementSpeed()
  ↓
MovementEngine.setSpeed()
  ↓
MovementEngine.calculate() [cada frame]
  ↓
this.lastMovement = { pan, tilt, speed, pattern }
  ↓
[DMX Output]
```

### Hallazgos

#### ✅ Los sliders LLEGAN correctamente
**Archivo:** `SeleneLux.ts` líneas 670-678

```typescript
setMovementSpeed(speed: number): void {
  this.movementEngine.setSpeed(speed)  // ✅ Llega
}

setMovementRange(range: number): void {
  this.movementEngine.setRange(range)  // ✅ Llega
}
```

**Archivo:** `MovementEngine.ts` líneas 256-264

```typescript
setSpeed(speed: number): void {
  this.state.speed = Math.max(0, Math.min(1, speed))  // ✅ Clamping
}

setRange(range: number): void {
  this.state.range = Math.max(0, Math.min(1, range))  // ✅ Clamping
}
```

#### 🔴 CRÍTICO: NO HAY SMOOTHING EN CALCULATE()
**Archivo:** `MovementEngine.ts` líneas 179-233

```typescript
calculate(metrics, beatState, deltaTime): MovementOutput {
  // ...cálculos de Lissajous...
  
  pan = 0.5 + Math.sin(this.phase * config.freqX) * 0.5 * this.state.range
  tilt = 0.5 + Math.sin(this.phase * config.freqY + config.phaseShift) * 0.5 * this.state.range
  
  // ❌ SIN INTERPOLACIÓN - Valor directo cada frame
  return { pan, tilt, speed, pattern }
}
```

**Problema:**
- `this.smoothing` se define en constructor (línea 95) → `this.smoothing = config.movementSmoothing || 0.8`
- **NUNCA SE USA** en `calculate()`
- Cada frame calcula pan/tilt DIRECTAMENTE desde la función sinusoidal
- Si el patrón cambia abruptamente o la fase salta → **LATIGAZO MECÁNICO**

#### 🔴 FixturePhysicsDriver NO ESTÁ CONECTADO
**Archivo:** `SeleneLux.ts` - Búsqueda: `physicsDriver`

```
No matches found
```

**El driver sofisticado existe pero NO se usa:**
- `FixturePhysicsDriver.ts` tiene:
  - Curva S de aceleración/deceleración
  - Inversión de ejes (ceiling/floor)
  - Límites mecánicos de tilt
  - Anti-jitter filter
  - NaN Guard
- **PERO** SeleneLux no lo instancia ni llama

### 🏍️ VEREDICTO DE MOVIMIENTO

| Pregunta | Respuesta |
|----------|-----------|
| ¿Sliders llegan a MovementEngine? | ✅ SÍ |
| ¿Existe lerp/smoothing activo? | 🔴 NO (variable existe pero no se usa) |
| ¿Riesgo de daño a motores? | 🔴 SÍ - cambios abruptos posibles |
| ¿FixturePhysicsDriver conectado? | 🔴 NO |

**Causa del Riesgo:**
- Cambio de patrón → salto instantáneo de posición
- Sin curva de aceleración/deceleración
- Los servos de moving heads recibirán comandos abruptos

### 🔧 HOTFIX RECOMENDADO (Movimiento)

**Opción A: Añadir lerp en MovementEngine.calculate()**

```typescript
// Añadir al final de calculate(), antes del return:
// Smooth interpolation hacia target
const smoothFactor = 1 - Math.pow(1 - this.smoothing, deltaTime / 16.67)
this.lastPan = this.lastPan ?? pan
this.lastTilt = this.lastTilt ?? tilt
const smoothedPan = this.lastPan + (pan - this.lastPan) * smoothFactor
const smoothedTilt = this.lastTilt + (tilt - this.lastTilt) * smoothFactor
this.lastPan = smoothedPan
this.lastTilt = smoothedTilt

return { pan: smoothedPan, tilt: smoothedTilt, speed, pattern }
```

**Opción B: Integrar FixturePhysicsDriver (Mejor solución)**

```typescript
// En SeleneLux.ts constructor:
import { FixturePhysicsDriver } from './hardware/FixturePhysicsDriver'

this.physicsDriver = new FixturePhysicsDriver()
// Registrar fixtures con preset ceiling/floor

// En processAudioFrame, después de calculate():
const rawMovement = this.movementEngine.calculate(...)
const physicalMovement = this.physicsDriver.translate({
  fixtureId: 'main',
  x: rawMovement.pan * 2 - 1,  // Convert 0-1 to -1 to +1
  y: rawMovement.tilt * 2 - 1,
}, deltaTime)
```

---

## 3️⃣ CONFIGURACIÓN CEILING/FLOOR

### Hallazgos

#### ✅ ConfigManager tiene la opción
**Archivo:** `electron/ConfigManager.ts` líneas 62-63, 99-100

```typescript
// Tipo de instalación
installationType: 'ceiling' | 'floor'

// Default
installationType: 'ceiling',  // ← Por defecto colgados
```

#### ✅ FixturePhysicsDriver tiene los presets
**Archivo:** `hardware/FixturePhysicsDriver.ts` líneas 85-121

```typescript
INSTALLATION_PRESETS = {
  ceiling: {
    description: 'Colgado del techo, mirando hacia abajo',
    defaultHome: { pan: 127, tilt: 40 },
    invert: { pan: false, tilt: true },  // ← TILT INVERTIDO
    limits: { tiltMin: 20, tiltMax: 200 },
    tiltOffset: -90,
  },
  floor: {
    description: 'En el suelo, mirando hacia arriba',
    defaultHome: { pan: 127, tilt: 127 },
    invert: { pan: false, tilt: false },
    limits: { tiltMin: 0, tiltMax: 255 },
    tiltOffset: 0,
  },
  // ... truss_front, truss_back
}
```

#### 🔴 Pero NO está conectado al flujo
**Problema:**
- `ConfigManager.getInstallationType()` → Retorna 'ceiling' o 'floor'
- `FixturePhysicsDriver.registerFixture()` → Acepta `installationType`
- **PERO** SeleneLux no llama a ninguno de los dos

### 🏠 VEREDICTO DE INSTALACIÓN

| Pregunta | Respuesta |
|----------|-----------|
| ¿Existe config ceiling/floor? | ✅ SÍ en ConfigManager |
| ¿FixturePhysicsDriver lo soporta? | ✅ SÍ con inversión de tilt |
| ¿Está activo en el flujo? | 🔴 NO - Desconectado |
| ¿Riesgo para fixtures colgados? | 🔴 SÍ - Tilt sin invertir |

### 🔧 HOTFIX RECOMENDADO (Ceiling)

**Archivo:** `SeleneLux.ts` o donde se inicializa el DMX

```typescript
// Al inicializar:
const installationType = configManager.getInstallationType()

this.physicsDriver = new FixturePhysicsDriver()

// Registrar cada fixture con el preset correcto
for (const fixture of fixtures) {
  this.physicsDriver.registerFixture(fixture.id, {
    installationType: installationType,  // 'ceiling' o 'floor'
  })
}
```

---

## 4️⃣ RESUMEN DE RIESGOS

### Matriz de Riesgo

| Riesgo | Probabilidad | Impacto | Prioridad |
|--------|--------------|---------|-----------|
| NaN en metrics causa parpadeo | Media | Bajo | P2 |
| Latigazo mecánico en moving heads | Alta | **ALTO** | **P0** |
| Tilt invertido en ceiling fixtures | Alta | **ALTO** | **P0** |

### Código Culpable

| Archivo | Línea | Problema |
|---------|-------|----------|
| `MovementEngine.ts` | 95 | `this.smoothing` declarado pero no usado |
| `MovementEngine.ts` | 179-233 | `calculate()` sin interpolación |
| `SeleneLux.ts` | - | No importa ni usa `FixturePhysicsDriver` |
| `SeleneLux.ts` | 427 | No valida `metrics` antes de `colorEngine.generate()` |

---

## 5️⃣ PLAN DE FIX (Priorizado)

### 🔴 P0: SEGURIDAD DE HARDWARE (ANTES DEL SHOW)

**Fix 1: Añadir smoothing mínimo a MovementEngine**
```typescript
// MovementEngine.ts - Añadir propiedades
private lastPan = 0.5
private lastTilt = 0.5

// En calculate(), antes del return:
const smoothFactor = 0.15  // ~6 frames para llegar al target
this.lastPan += (pan - this.lastPan) * smoothFactor
this.lastTilt += (tilt - this.lastTilt) * smoothFactor
return { pan: this.lastPan, tilt: this.lastTilt, speed, pattern }
```

**Fix 2: Limitar velocidad máxima de cambio**
```typescript
// Máximo cambio por frame (0.02 = ~5 segundos para 0→1)
const maxDelta = 0.02
this.lastPan += Math.max(-maxDelta, Math.min(maxDelta, pan - this.lastPan))
this.lastTilt += Math.max(-maxDelta, Math.min(maxDelta, tilt - this.lastTilt))
```

### 🟠 P1: INTEGRAR PHYSICS DRIVER

**Conectar FixturePhysicsDriver a SeleneLux:**
1. Importar en SeleneLux.ts
2. Instanciar en constructor
3. Registrar fixtures con installationType
4. Llamar `translate()` después de `calculate()`

### 🟡 P2: ANTI-FLICKER

**Añadir validación de metrics en Flow Mode:**
```typescript
const safeMetrics = {
  ...metrics,
  energy: Number.isFinite(metrics.energy) ? metrics.energy : 0,
  bass: Number.isFinite(metrics.bass) ? metrics.bass : 0,
}
```

---

## 6️⃣ RECOMENDACIÓN PARA EL SHOW

### ⚠️ ADVERTENCIA PRE-SHOW

1. **NO usar cambios bruscos de patrón** hasta implementar smoothing
2. **Velocidad baja** (`setMovementSpeed(0.2)`) para reducir riesgo
3. **Rango reducido** (`setMovementRange(0.5)`) para limitar amplitud
4. **Modo SELENE preferido** - tiene OUTPUT GUARD que Flow no tiene

### 🛡️ Configuración Segura Temporal

```typescript
// Antes de conectar hardware real:
selene.setMovementSpeed(0.2)   // Lento
selene.setMovementRange(0.4)   // Rango reducido
selene.setMode('selene')       // Brain mode con OUTPUT GUARD
```

---

## 7️⃣ CONCLUSIÓN

### Estado Actual
- **ColorEngine:** Robusto pero sin validación explícita de NaN
- **MovementEngine:** Funcional pero **sin protección de hardware**
- **FixturePhysicsDriver:** Excelente pero **desconectado**
- **Ceiling Config:** Existe pero **no se aplica**

### Acción Inmediata Requerida
1. **HOTFIX P0:** Añadir smoothing mínimo a MovementEngine
2. **HOTFIX P0:** Limitar delta máximo por frame
3. **TEST:** Probar con fixtures en modo seguro antes del show

### Deuda Técnica
- Integrar FixturePhysicsDriver completamente
- Exponer installationType en UI Setup
- Añadir validación NaN en Flow Mode

---

**Firma del Auditor:**
```
Operation Flow Safe - Security Audit
Date: 2025-12-12
Auditor: Claude Opus
Status: 🔴 REQUIRES IMMEDIATE ACTION
Risk Level: HIGH (Hardware Safety)
```
