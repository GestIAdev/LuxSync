# 🕵️ WAVE 1100: OPERATION SAFETY NET - AUDIT REPORT

**Fecha**: 2 de febrero, 2026  
**Solicitado por**: Founder & GeminiProxy  
**Ejecutado por**: PunkOpus (System Architect)  
**Objetivo**: Auditoría integral del pipeline de movimiento (Movement Engine → Physics → HAL → DMX)

---

## 📋 EXECUTIVE SUMMARY

| Zona | Hallazgos Críticos | Advertencias | Optimizaciones |
|------|-------------------|--------------|----------------|
| 1. Fixture Forge | 0 🔴 | 1 🟡 | 1 🟢 |
| 2. Physics Driver | 0 🔴 | 1 🟡 | 2 🟢 |
| 3. HAL & DMX Output | 1 🔴 | 1 🟡 | 2 🟢 |
| 4. Canvas 2D | 0 🔴 | 1 🟡 | 1 🟢 |
| **TOTAL** | **1 🔴** | **4 🟡** | **6 🟢** |

**VEREDICTO GENERAL**: El sistema tiene **protecciones robustas** pero hay **1 GAP CRÍTICO** que debe cerrarse.

---

## 🏗️ ZONA 1: LA DEFINICIÓN (Fixture Forge)

### Archivos Auditados:
- `electron-app/src/types/FixtureDefinition.ts`
- `electron-app/src/hal/translation/FixtureProfiles.ts`
- `electron-app/src/engine/movement/FixturePhysicsDriver.ts`

### ✅ HALLAZGOS POSITIVOS

#### 1.1 Límites de Tilt Definidos ✅
```typescript
// FixturePhysicsDriver.ts
limits: { tiltMin: number; tiltMax: number }

// INSTALLATION_PRESETS
ceiling: { limits: { tiltMin: 20, tiltMax: 200 } }
floor: { limits: { tiltMin: 0, tiltMax: 255 } }
truss_front: { limits: { tiltMin: 30, tiltMax: 220 } }
truss_back: { limits: { tiltMin: 20, tiltMax: 180 } }
```
**BIEN**: Los presets de instalación definen límites de Tilt específicos que actúan como "airbag" en el eje vertical.

#### 1.2 Safety Box Implementado ✅
```typescript
private applySafetyLimits(targetDMX: Position2D, config: FixtureConfig): Position2D {
  const { limits } = config
  return {
    pan: Math.max(0, Math.min(255, targetDMX.pan)),
    tilt: Math.max(limits.tiltMin, Math.min(limits.tiltMax, targetDMX.tilt)),
  }
}
```
**BIEN**: Toda posición pasa por `applySafetyLimits()` antes de enviarse.

### 🟡 ADVERTENCIA

#### 1.3 Pan Sin Margen de Seguridad (Safety Margin Missing)
**PROBLEMA**: El Pan se mapea 0-255 directamente sin margen mecánico.

```typescript
pan: Math.max(0, Math.min(255, targetDMX.pan))
```

**LA TRAMPA**: Si el perfil dice `range.pan: 540°`, el software envía DMX 0 o DMX 255, que corresponden a los extremos físicos del motor. En movers baratos ($50-200), esto puede causar:
- Ruido mecánico en los topes
- Desgaste prematuro de correas
- Golpes contra límites físicos

**RECOMENDACIÓN**: Implementar `PAN_SAFETY_MARGIN`:
```typescript
const PAN_SAFETY_MARGIN = 5 // DMX units (~2%)
pan: Math.max(PAN_SAFETY_MARGIN, Math.min(255 - PAN_SAFETY_MARGIN, targetDMX.pan))
```

### 🟢 OPTIMIZACIÓN

#### 1.4 Ranges Por Fixture
**ESTADO**: El sistema usa `range: { pan: 540, tilt: 270 }` como default para todos.

**MEJORA SUGERIDA**: Leer ranges del JSON de librería de fixtures (algunos movers tienen pan 360°, otros 540°, otros 630°).

---

## 🧠 ZONA 2: EL CONDUCTOR (Physics Driver)

### Archivos Auditados:
- `electron-app/src/engine/movement/FixturePhysicsDriver.ts`
- `electron-app/src/engine/movement/VibeMovementManager.ts`
- `electron-app/src/engine/movement/VibeMovementPresets.ts`

### ✅ HALLAZGOS POSITIVOS

#### 2.1 SAFETY_CAP Implementado ✅
```typescript
private readonly SAFETY_CAP = {
  maxAcceleration: 2500,  // DMX units/s² - NUNCA exceder
  maxVelocity: 800,       // DMX units/s - NUNCA exceder
}

// Aplicación:
this.physicsConfig.maxAcceleration = Math.min(
  vibePhysics.maxAcceleration,
  this.SAFETY_CAP.maxAcceleration
)
```
**EXCELENTE**: Sin importar lo que pida el Vibe, el SAFETY_CAP protege el hardware.

#### 2.2 NaN Guard Implementado ✅
```typescript
// NaN GUARD V16.1: SEGURO DE VIDA PARA HARDWARE
const safePan = Number.isFinite(smoothedDMX.pan) ? smoothedDMX.pan : config.home.pan
const safeTilt = Number.isFinite(smoothedDMX.tilt) ? smoothedDMX.tilt : config.home.tilt

if (!Number.isFinite(smoothedDMX.pan) || !Number.isFinite(smoothedDMX.tilt)) {
  console.error(`[PhysicsDriver] ⚠️ NaN/Infinity en "${fixtureId}"! Usando home position`)
}
```
**EXCELENTE**: Protección contra NaN e Infinity. Fallback a home position.

#### 2.3 REV_LIMITER Per-Vibe ✅
```typescript
// Según aceleración del vibe:
if (maxAccel > 1400) {       // TECHNO
  REV_LIMIT_PAN = 120
  REV_LIMIT_TILT = 60
} else if (maxAccel > 1100) { // LATINO
  REV_LIMIT_PAN = 25
  REV_LIMIT_TILT = 18
} else if (maxAccel > 1000) { // ROCK
  REV_LIMIT_PAN = 15
  REV_LIMIT_TILT = 10
} else {                      // CHILL
  REV_LIMIT_PAN = 255
  REV_LIMIT_TILT = 255
}

// Aplicación:
deltaPan = Math.max(-REV_LIMIT_PAN, Math.min(REV_LIMIT_PAN, deltaPan))
deltaTilt = Math.max(-REV_LIMIT_TILT, Math.min(REV_LIMIT_TILT, deltaTilt))
```
**EXCELENTE**: El "Seguro de Vida para Correas" limita movimiento por frame según el género.

#### 2.4 Anti-Stuck Mechanism ✅
```typescript
// FIX V16.4: ANTI-STUCK EN LÍMITES
if ((newPos[axis] >= 254 || newPos[axis] <= 1) && absDistance > 20) {
  newVel[axis] = -Math.sign(newPos[axis] - 127) * maxSpeed * 0.3
  console.warn(`[PhysicsDriver] ⚠ Unstuck ${axis}: pos=${newPos[axis].toFixed(0)}, target=${target.toFixed(0)}`)
}
```
**BIEN**: Detecta fixtures pegados en límites y los empuja hacia el centro.

#### 2.5 Anti-Jitter Filter ✅
```typescript
// FILTRO ANTI-JITTER V16.1
if (Math.abs(newVel.pan) < 5) newVel.pan = 0
if (Math.abs(newVel.tilt) < 5) newVel.tilt = 0
```
**BIEN**: Evita micro-correcciones que calientan servos.

### 🟡 ADVERTENCIA

#### 2.6 Infinity Protection en Braking Phase
**PROBLEMA POTENCIAL**: La fórmula de frenado puede producir división por casi-cero.

```typescript
// FASE DE FRENADO:
const safeDistance = Math.max(0.5, absDistance)  // FIX V16.1
acceleration = -(vel * vel) / (2 * safeDistance) * direction
```

**LA TRAMPA**: El `safeDistance = 0.5` es bueno, pero si `vel` es muy alto y `absDistance` muy bajo, la aceleración puede ser extrema (aunque no Infinity).

**RECOMENDACIÓN**: Añadir clamp adicional:
```typescript
acceleration = Math.max(-SAFETY_CAP.maxAcceleration, 
                       Math.min(SAFETY_CAP.maxAcceleration, acceleration))
```
*Nota: Ya existe el clamp después, pero el valor intermedio puede ser alto.*

### 🟢 OPTIMIZACIONES

#### 2.7 Per-Fixture Physics
**ESTADO**: Todos los fixtures usan los mismos parámetros de física por vibe.

**MEJORA**: Permitir configuración individual:
- Movers de $50 → SAFETY_CAP más bajo
- Movers de $500+ → Permitir más velocidad

#### 2.8 Velocity Logging
**ESTADO**: Solo se loguea cuando hay NaN.

**MEJORA**: Opción de log periódico de velocidades máximas alcanzadas para tuning.

---

## 🔌 ZONA 3: EL ÁRBITRO (HAL & DMX Output)

### Archivos Auditados:
- `electron-app/src/hal/HardwareAbstraction.ts`
- `electron-app/src/hal/drivers/UniversalDMXDriver.ts`
- `electron-app/src/hal/translation/HardwareSafetyLayer.ts`

### ✅ HALLAZGOS POSITIVOS

#### 3.1 HardwareSafetyLayer para Color Wheels ✅
```typescript
// SafetyConfig
safetyMargin: 1.2,      // 20% margen de seguridad extra
chaosThreshold: 3,       // 3 cambios/segundo = caos
latchDurationMs: 2000,   // 2 segundos de latch

// Cálculo de tiempo mínimo:
return Math.round(baseTime * this.config.safetyMargin)
```
**EXCELENTE**: Protección contra strobes en ruedas mecánicas. El 20% extra es prudente.

#### 3.2 Smooth Optics (WAVE 340.2) ✅
```typescript
// Smoothing para evitar oscilaciones locas:
this.smoothedZoomMod += (targetZoomMod - this.smoothedZoomMod) * smoothFactor
this.smoothedFocusMod += (targetFocusMod - this.smoothedFocusMod) * smoothFactor
```
**BIEN**: Las ópticas (zoom/focus) no saltan, usan EMA para suavizar.

### 🔴 CRÍTICO

#### 3.3 🔴 DMX Refresh Rate Fijo Sin Throttling Por Fixture
**PROBLEMA GRAVE**: El driver DMX usa un refresh rate fijo de 44Hz para TODOS los fixtures.

```typescript
// UniversalDMXDriver.ts
refreshRate: config.refreshRate ?? 44,

// Output loop:
const intervalMs = 1000 / this.config.refreshRate  // 22.7ms
```

**LA TRAMPA**: Un mover chino barato de $50 puede tener un procesador DMX que solo procesa a 20Hz. Si le enviamos datos a 44Hz:
- Buffer overflow en el chip del mover
- Espasmos o saltos impredecibles
- Comportamiento errático

**IMPACTO**: ALTO - Puede causar movimientos erráticos que parecen bugs de software pero son limitaciones de hardware.

**RECOMENDACIÓN URGENTE**: Implementar **Per-Fixture Output Throttling**:

```typescript
interface FixtureOutputConfig {
  fixtureId: string
  maxRefreshHz: number  // 20 para movers baratos, 44 para pros
  lastSentTime: number
}

// En el output loop:
if (now - fixture.lastSentTime >= 1000 / fixture.maxRefreshHz) {
  sendDMXToFixture(fixture)
  fixture.lastSentTime = now
}
```

**WORKAROUND INMEDIATO**: Bajar `refreshRate` global a 30Hz en `electron-app/active`:
```json
"frameRate": 30  // Actualmente está en 40
```

### 🟡 ADVERTENCIA

#### 3.4 No Hay Verificación de Conexión Continua
**PROBLEMA**: El watchdog existe pero no verifica que los datos lleguen correctamente.

```typescript
watchdogInterval: config.watchdogInterval ?? 1000  // Solo detecta desconexión USB
```

**MEJORA**: Implementar heartbeat bidireccional (si el hardware lo soporta).

### 🟢 OPTIMIZACIONES

#### 3.5 Universe Buffer Pre-allocation
**ESTADO**: Los buffers se crean on-demand.

**MEJORA**: Pre-alocar todos los universos al inicio para evitar GC durante show.

#### 3.6 Batch DMX Sending
**ESTADO**: Cada fixture se procesa individualmente.

**MEJORA**: Acumular cambios y enviar en batch al final del frame.

---

## 📺 ZONA 4: LA MENTIRA VISUAL (Canvas 2D)

### Archivos Auditados:
- `electron-app/src/hooks/useFixtureRender.ts`
- `electron-app/src/stores/truthStore.ts`

### ✅ HALLAZGOS POSITIVOS

#### 4.1 Physics State Broadcasting ✅
```typescript
// useFixtureRender.ts
const physicalPan = truthData?.physicalPan ?? pan   // Already normalized
const physicalTilt = truthData?.physicalTilt ?? tilt // Already normalized
```
**BIEN**: El frontend recibe `physicalPan/Tilt` (posición interpolada) además del target.

#### 4.2 Single Source of Truth ✅
```typescript
// WAVE 78: SINGLE SOURCE OF TRUTH
// All colors and movement come from backend (truthData).
// Frontend no longer overrides with Flow/Fuego or Radar patterns.
```
**EXCELENTE**: El frontend es "dumb render" - no calcula nada, solo muestra lo que el backend dice.

### 🟡 ADVERTENCIA

#### 4.3 No Hay Interpolación Visual Independiente
**PROBLEMA**: Si se pierde un frame de datos del backend, el Canvas da un salto.

```typescript
// No hay código de interpolación visual tipo:
// visualPosition = lerp(lastVisualPosition, physicalPosition, smoothFactor)
```

**LA TRAMPA**: En condiciones de alta carga (laptop cafetera de 16GB RAM), el IPC puede perder frames. El simulador visual saltará mientras el hardware real (con su propia física) se mueve suave.

**IMPACTO**: BAJO para hardware (el DMX tiene su propia física), MEDIO para debugging visual.

**RECOMENDACIÓN**: Implementar smoothing visual opcional:
```typescript
const VISUAL_SMOOTH_FACTOR = 0.3
visualPan = prevVisualPan + (physicalPan - prevVisualPan) * VISUAL_SMOOTH_FACTOR
```

### 🟢 OPTIMIZACIÓN

#### 4.4 Render Throttling para UI
**ESTADO**: El frontend renderiza a la tasa que le llegan datos.

**MEJORA**: Implementar `requestAnimationFrame` throttling para no sobrecargar el renderer.

---

## 🎯 PRIORIDADES DE ACCIÓN

### 🔴 PRIORIDAD 1 - CRÍTICO (Hacer Ahora)

**[3.3] Implementar Per-Fixture Output Throttling**

1. **Workaround inmediato** (5 min):
   ```json
   // electron-app/active
   "frameRate": 30
   ```

2. **Solución completa** (2-4 horas):
   - Añadir `maxRefreshHz` a FixtureDefinition
   - Implementar per-fixture throttling en UniversalDMXDriver
   - Default: 30Hz para tipo "beam"/"spot", 44Hz para tipo "par"/"wash"

### 🟡 PRIORIDAD 2 - ADVERTENCIAS (Sprint Siguiente)

| ID | Descripción | Esfuerzo |
|----|-------------|----------|
| 1.3 | Pan Safety Margin (5 DMX units) | 30 min |
| 2.6 | Clamp adicional en braking phase | 15 min |
| 3.4 | Heartbeat bidireccional | 2 horas |
| 4.3 | Interpolación visual independiente | 1 hora |

### 🟢 PRIORIDAD 3 - OPTIMIZACIONES (Backlog)

| ID | Descripción | Esfuerzo |
|----|-------------|----------|
| 1.4 | Ranges dinámicos desde JSON | 1 hora |
| 2.7 | Per-Fixture Physics config | 2 horas |
| 2.8 | Velocity logging para tuning | 30 min |
| 3.5 | Universe buffer pre-allocation | 30 min |
| 3.6 | Batch DMX sending | 2 horas |
| 4.4 | RAF throttling para UI | 1 hora |

---

## 📊 COVERAGE SUMMARY

### Protecciones Activas ✅
1. **SAFETY_CAP** - Límite absoluto de aceleración/velocidad
2. **REV_LIMITER** - Límite de movimiento por frame (per-vibe)
3. **NaN Guard** - Protección contra valores inválidos
4. **Safety Box** - Límites de Tilt por instalación
5. **Anti-Stuck** - Detección de fixtures pegados
6. **Anti-Jitter** - Filtro de micro-correcciones
7. **HardwareSafetyLayer** - Protección para ruedas mecánicas
8. **Smooth Optics** - EMA para zoom/focus

### Gaps Identificados ⚠️
1. **Pan Sin Margen** - Falta airbag en extremos horizontales
2. **DMX Rate Fijo** - Sin throttling por fixture
3. **Sin Interpolación Visual** - Saltos en Canvas si se pierden frames

---

## 🏁 CONCLUSIÓN

El sistema tiene **8 capas de protección** activas. La mayoría de incidentes reportados (ruido mecánico en límites) probablemente se deben a:

1. **Movers baratos** recibiendo DMX a 44Hz cuando solo procesan 20-30Hz → **Bajar frameRate a 30**
2. **Pan llegando a extremos** sin margen → **Añadir PAN_SAFETY_MARGIN**

Los artefactos visuales en Canvas son **cosméticos** - el hardware real tiene su propia física y no salta.

**VEREDICTO**: Sistema APTO para producción con **1 ajuste crítico** (frameRate → 30Hz).

---

**Auditoría completada**: 2 de febrero, 2026  
**Próxima revisión recomendada**: WAVE 1150 (post-implementación de throttling)

```
╔═══════════════════════════════════════════════════════════════╗
║  "Es mejor un show imperfecto que un fixture roto"            ║
║                          - HardwareSafetyLayer.ts, línea 18   ║
╚═══════════════════════════════════════════════════════════════╝
```
