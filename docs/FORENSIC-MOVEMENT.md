# 🔴 AUDITORÍA FORENSE COMPLETA - FLUJO DE MOVIMIENTO EN LUXSYNC

**Fecha:** 9 de Enero de 2026  
**Estado:** CÓDIGO ROJO - Investigación Crítica  
**Objetivo:** Rastrear la señal de movimiento desde su nacimiento hasta su muerte en el hardware

---

## 📋 TABLA DE CONTENIDOS

1. [Diagrama General de Flujo](#diagrama-general-de-flujo)
2. [Análisis Capa por Capa](#análisis-capa-por-capa)
3. [Problemas Identificados](#problemas-identificados)
4. [Análisis de Unidades](#análisis-de-unidades)
5. [Rastreo de Patrones](#rastreo-de-patrones)
6. [Duplicación de Código](#duplicación-de-código)
7. [Estado Actual por Vibe](#estado-actual-por-vibe)
8. [Recomendaciones](#recomendaciones)

---

## 🗺️ DIAGRAMA GENERAL DE FLUJO

```
┌──────────────────────────────────────────────────────────────────────┐
│                   INICIO: INTENCIÓN DE ILUMINACIÓN                    │
│                        (LightingIntent)                               │
│  Entrada: { movement: { pattern, speed, intensity, centerX, centerY } │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PASO 1: 🧠 GENERACIÓN DE PATRÓN - TitanEngine.ts L.~760            │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ calculateMovement(intent, deltaTime)                           │  │
│  │                                                                │  │
│  │ PATRONES HARDCODED:                                           │  │
│  │  • figure8:   centerX = 0.5 + Math.sin(t*f)*amp             │  │
│  │               centerY = 0.5 + Math.cos(t*f*2)*amp           │  │
│  │  • circle:    centerX = 0.5 + Math.sin(t*f)*amp             │  │
│  │               centerY = 0.5 + Math.cos(t*f)*amp             │  │
│  │  • mirror:    (no pattern math, devuelve center únicamente) │  │
│  │  • wave:      similar a figure8 con variación                │  │
│  │  • sweep:     barrido lineal                                 │  │
│  │  • chase:     persecución con offset per fixture             │  │
│  │  • static:    punto fijo con respiración                     │  │
│  │                                                                │  │
│  │ ⚠️ PROBLEMA: Toda esta lógica debería estar en               │  │
│  │    VibeMovementManager (que NO existe)                       │  │
│  │                                                                │  │
│  │ OUTPUT: { centerX, centerY } en escala 0-1                   │  │
│  │         Rango: 0.0 = izquierda/arriba                        │  │
│  │                0.5 = centro                                  │  │
│  │                1.0 = derecha/abajo                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  📊 UNIDADES: 0-1 (normalizado, 0=min pan/tilt, 1=max)             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ intent.movement.centerX/centerY
                               │ Unidades: 0-1
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PASO 2: 🔌 APLICAR DESFASE DE FASE - HAL.applyPhaseOffset() L.177  │
│                                                                       │
│  Input: baseX, baseY (0-1)                                          │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ switch (pattern) {                                             │  │
│  │                                                                │  │
│  │   case 'wave'|'figure8'|'circle'|'sweep': // Síncrono       │  │
│  │     Rotar posición alrededor del centro por phase offset      │  │
│  │     Esto crea efecto "snake" (fixtures desfasadas temporales) │  │
│  │     angle = atan2(ampY, ampX)                                │  │
│  │     newAngle = angle + phaseOffset                           │  │
│  │     result = 0.5 + {cos,sin}(newAngle) * magnitude           │  │
│  │                                                                │  │
│  │   case 'mirror': // ESPEJO TECHNO                            │  │
│  │     isLeftZone = zone.includes('LEFT')                       │  │
│  │     isRightZone = zone.includes('RIGHT')                     │  │
│  │     mirrorSign = isRightZone ? -1 : 1                        │  │
│  │     return {                                                  │  │
│  │       x: 0.5 + amplitudeX * mirrorSign,  // Invertir PAN    │  │
│  │       y: baseY                            // TILT compartido  │  │
│  │     }                                                          │  │
│  │                                                                │  │
│  │   case 'chase': // Persecución láser                         │  │
│  │     chasePhase = fixtureIndex * (π/2)  // 90° entre fixture  │  │
│  │     x = 0.5 + sin(t*freq*2 + chasePhase) * |ampX|            │  │
│  │     y = baseY                                                │  │
│  │                                                                │  │
│  │   case 'static': // Respiración sutil                        │  │
│  │     breathPhase = fixtureIndex * (π/3)                       │  │
│  │     y = 0.5 + sin(t*π*0.2 + breathPhase) * 0.02 + ampY      │  │
│  │                                                                │  │
│  │   default: // Rotación para otros patrones                   │  │
│  │     (similar a wave/figure8)                                  │  │
│  │ }                                                              │  │
│  │                                                                │  │
│  │ 🔍 DEBUG LOGS (cada 30 frames para fixture 0):               │  │
│  │   [🔬 PHASE IN] Pan:XXX° Tilt:YYY° | Pattern:... | Mag:... │  │
│  │   [🔬 PHASE OUT] Pan:AAA° Tilt:BBB° | Δ=CCC°                │  │
│  │                                                                │  │
│  │ ⚠️ NOTA IMPORTANTE: Este step SOLO modifica la POSICIÓN,     │  │
│  │    no recalcula el patrón (evita duplicación con TitanEngine)│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  OUTPUT: { x, y } en escala 0-1 (después de phase offset)           │
│  📊 UNIDADES: 0-1 (normalizado)                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ phaseOffsetted.x/y
                               │ Unidades: 0-1
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PASO 3: 🗺️ MAPEAR A ESTADO DE FIXTURE - FixtureMapper L.135      │
│                                                                       │
│  Input: movement.pan/tilt (0-1) desde applyPhaseOffset              │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ mapFixture(fixture, intent, intensity, movement) {            │  │
│  │   let panValue = movement.pan    // 0-1                       │  │
│  │   let tiltValue = movement.tilt  // 0-1                       │  │
│  │                                                                │  │
│  │   // 🎯 Inversión de tilt para instalación en techo          │  │
│  │   if (installationType === 'ceiling' && isMovingFixture) {    │  │
│  │     tiltValue = 1 - tiltValue                                 │  │
│  │   }                                                            │  │
│  │                                                                │  │
│  │   // ⚠️ BUG CRÍTICO: MIRROR DUPLICADO                         │  │
│  │   if (zone === 'MOVING_RIGHT') {                              │  │
│  │     panValue = 1 - panValue  // INVIERTE NUEVAMENTE           │  │
│  │   }                                                            │  │
│  │                                                                │  │
│  │   return {                                                     │  │
│  │     pan: Math.round(panValue * 255),   // Convertir a DMX     │  │
│  │     tilt: Math.round(tiltValue * 255), // Convertir a DMX     │  │
│  │     ... otras propiedades de color/intensidad                 │  │
│  │   }                                                            │  │
│  │ }                                                              │  │
│  │                                                                │  │
│  │ 🔥 PROBLEMA: El mirror ya fue aplicado en HAL.applyPhaseOffset │  │
│  │    Ahora se aplica DE NUEVO aquí → DOBLE INVERSIÓN            │  │
│  │    Resultado: MOVING_RIGHT vuelve al original (sin espejo)    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  OUTPUT: FixtureState con { pan, tilt } en 0-255                    │
│  📊 UNIDADES: 0-255 (rango DMX)                                     │
│             0 = mínimo pan/tilt (-270°/-135°)                       │
│           128 = centro (0°/0°)                                       │
│           255 = máximo pan/tilt (+270°/+135°)                       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ state.pan/tilt (0-255)
                               │ Unidades: DMX
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PASO 4: 💫 APLICAR EFECTOS GLOBALES - FixtureMapper L.180+        │
│                                                                       │
│  applyEffectsAndOverrides(states, timestamp)                        │
│                                                                       │
│  • Aplicar overrides manuales si existen                            │
│  • Clip valores a 0-255                                             │
│  • Sincronizar intenciones de color                                 │
│                                                                       │
│  OUTPUT: FixtureState modificado (pan/tilt sin cambios)             │
│  📊 UNIDADES: 0-255 (rango DMX)                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ state con overrides aplicados
                               │ Unidades: 0-255
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PASO 5: ⚙️ INTERPOLACIÓN CON FÍSICA - PhysicsDriver L.420         │
│                                                                       │
│  HAL.render() línea ~576:                                           │
│  movementPhysics.translateDMX(fixtureId, state.pan, state.tilt, 16) │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ FixturePhysicsDriver.translateDMX() {                          │  │
│  │   // Almacena target DMX para este frame                       │  │
│  │   fixtureState.targetPan = panDmx    // 0-255                 │  │
│  │   fixtureState.targetTilt = tiltDmx  // 0-255                 │  │
│  │                                                                │  │
│  │   // Calcula velocidad actual                                 │  │
│  │   deltaX = panDmx - currentPan                                │  │
│  │   deltaY = tiltDmx - currentTilt                              │  │
│  │                                                                │  │
│  │   // 🔧 SNAP MODE: Si cambio es pequeño, usar physicsConfig  │  │
│  │   const isSmallChange = Math.abs(deltaX) < threshold &&       │  │
│  │                         Math.abs(deltaY) < threshold          │  │
│  │                                                                │  │
│  │   if (isSmallChange) {                                         │  │
│  │     // Usar physical physics config (suave)                   │  │
│  │     snapFactor = SNAP_FACTORS.physical[vibeId]                │  │
│  │   } else {                                                     │  │
│  │     // Cambio grande = abrupto (snap)                         │  │
│  │     snapFactor = SNAP_FACTORS.snap[vibeId]                    │  │
│  │   }                                                            │  │
│  │                                                                │  │
│  │   // 🎛️ REV LIMITER: Limitar velocidad por vibe              │  │
│  │   maxDeltaPerFrame = REV_LIMIT_PAN[vibeId] / 60fps            │  │
│  │   deltaX = Math.min(Math.abs(deltaX), maxDeltaPerFrame)       │  │
│  │                                                                │  │
│  │   // Interpolar hacia target                                  │  │
│  │   physicalPan = currentPan + deltaX * snapFactor              │  │
│  │   physicalTilt = currentTilt + deltaY * snapFactor            │  │
│  │ }                                                              │  │
│  │                                                                │  │
│  │ ✅ CORRECTO: Rev Limiter está aquí (no en pattern generation)│  │
│  │ ✅ CORRECTO: Physics es per-vibe                             │  │
│  │ ✅ CORRECTO: Smooth interpolation hacia target                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  OUTPUT: { physicalPan, physicalTilt } = pan/tilt interpolados     │
│  📊 UNIDADES: 0-255 (rango DMX)                                     │
│             Con velocidad limitada por vibe                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ physicalPan/Tilt (0-255 interpolado)
                               │ Unidades: DMX
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PASO 6: 👁️ INYECTAR ESTADO FÍSICO - HAL.render() L.510+         │
│                                                                       │
│  statesWithPhysics = finalStates.map((state, index) => {            │
│    const physicsState = movementPhysics.getPhysicsState(fixtureId)  │
│    return {                                                          │
│      ...state,                                                       │
│      physicalPan: physicsState.physicalPan,                         │
│      physicalTilt: physicsState.physicalTilt,                       │
│      panVelocity: physicsState.panVelocity,                         │
│      tiltVelocity: physicsState.tiltVelocity,                       │
│      zoom: finalZoom,      // Con dynamic optics                     │
│      focus: finalFocus,    // Con dynamic optics                     │
│    }                                                                 │
│  })                                                                  │
│                                                                       │
│  OUTPUT: FixtureState completo con movimiento físico interpolado    │
│  📊 UNIDADES: 0-255 (rango DMX)                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ statesWithPhysics (completo)
                               │ Unidades: 0-255
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PASO 7: 📡 ENVIAR AL HARDWARE/FRONTEND - HAL.render() L.619       │
│                                                                       │
│  sendToDriver(statesWithPhysics)                                     │
│                                                                       │
│  • Driver USB-DMX (si está conectado)                               │
│  • Mock driver (para testing)                                        │
│  • Frontend via window.api.fixture.updatePhysical()                 │
│                                                                       │
│  OUTPUT: DMX values en hardware OR Frontend state update             │
│  📊 UNIDADES: 0-255 (rango DMX estándar)                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
                        🏁 FIN: Hardware/Pantalla
                      Movers ejecutan movimiento real
                      Frontend renderiza visualización
```

---

## 🔬 ANÁLISIS CAPA POR CAPA

### Capa 1: TitanEngine.ts (Generación de Patrón)

**Ubicación:** `electron-app/src/core/TitanEngine.ts` línea ~760

**Responsabilidad:** Generar la trayectoria del patrón base (sin considerar zona de fixture)

**Código Actual:**
```typescript
private calculateMovement(intent: LightingIntent, deltaTime: number): { centerX: number; centerY: number } {
  const pattern = intent.movement?.pattern || 'static'
  const speed = intent.movement?.speed || 0.5
  const freq = Math.max(60, speed * 240) / 120  // Convertir speed a Hz
  const time = this.movementTime
  const amplitude = (intent.movement?.intensity || 0.5) * 0.4  // Max 40% del range
  
  // ⚠️ HARDCODED PATTERN MATH
  switch (pattern) {
    case 'figure8':
      const centerX = 0.5 + Math.sin(time * freq) * amplitude
      const centerY = 0.5 + Math.cos(time * freq * 2) * amplitude
      return { centerX, centerY }
    
    case 'circle':
      return {
        centerX: 0.5 + Math.sin(time * freq) * amplitude,
        centerY: 0.5 + Math.cos(time * freq) * amplitude
      }
    
    case 'mirror':
      // Mirror NO genera pattern math, solo devuelve center
      return { centerX: 0.5, centerY: 0.5 }
    
    // ... más casos
  }
}
```

**Problemas:**
- ✗ Toda la lógica de patrón está hardcoded aquí
- ✗ No existe `VibeMovementManager` para separar esta responsabilidad
- ✗ Difícil de debuggear/extender sin tocar el engine principal
- ✗ No hay abstracción para diferentes tipos de patrones

**Qué debería pasar:**
- ✓ TitanEngine debería llamar a `VibeMovementManager.generatePattern()`
- ✓ Cada patrón tendría su propia clase/función
- ✓ Fácil de agregar nuevos patrones sin tocar el engine

---

### Capa 2: HardwareAbstraction.ts - applyPhaseOffset (Desfase)

**Ubicación:** `electron-app/src/hal/HardwareAbstraction.ts` línea 177

**Responsabilidad:** Aplicar desfase temporal per-fixture para crear efecto snake/espejo

**Análisis por patrón:**

#### Pattern: 'mirror' (TECHNO - CRÍTICO)
```typescript
case 'mirror':
  const isLeftZone = zone.includes('LEFT')
  const isRightZone = zone.includes('RIGHT')
  
  let mirrorSign = 1
  if (isLeftZone) {
    mirrorSign = 1      // LEFT mantiene dirección
  } else if (isRightZone) {
    mirrorSign = -1     // RIGHT invierte PAN
  }
  
  return {
    x: 0.5 + amplitudeX * mirrorSign,  // Invierte PAN
    y: baseY                            // TILT compartido
  }
```

**Lógica esperada:**
- MOVING_LEFT: pan sigue normal (izq → der → izq)
- MOVING_RIGHT: pan invertido (der → izq → der)
- TILT igual para ambas zonas (mismo nivel vertical)
- Efecto visual: "puertas del infierno" abriéndose/cerrándose

**Debug output:**
```
[🪞 MIRROR] Fixture 0 | Zone: "MOVING_LEFT" | Sign=1 | baseX=0.62 baseY=0.50 → x=0.62 y=0.50
[🪞 MIRROR] Fixture 1 | Zone: "MOVING_RIGHT" | Sign=-1 | baseX=0.62 baseY=0.50 → x=0.38 y=0.50
```

✅ **Esto es CORRECTO** - LEFT mantiene su posición, RIGHT invierte

#### Pattern: 'wave', 'figure8', 'circle', 'sweep' (LATINO)
```typescript
case 'wave':
case 'figure8':
case 'circle':
case 'sweep':
  // Rotar posición por phase offset (crea efecto "snake")
  const angle = Math.atan2(amplitudeY, amplitudeX)
  const phaseAngle = phaseOffset
  const newAngle = angle + phaseAngle
  
  return {
    x: 0.5 + Math.cos(newAngle) * magnitude,
    y: 0.5 + Math.sin(newAngle) * magnitude
  }
```

**Lógica:** 
- Cada fixture está desfasada N radianes en la trayectoria
- Si la trayectoria es un círculo, crean efecto "snake" alrededor del círculo
- Si es figure8, crean patrón desfasado

✅ **Esto es CORRECTO para Latino**

---

### Capa 3: FixtureMapper.ts (CRÍTICO - BUG ENCONTRADO)

**Ubicación:** `electron-app/src/hal/mapping/FixtureMapper.ts` línea 135-160

**Responsabilidad:** Mapear estado lógico a estado físico DMX

**Código con BUG:**
```typescript
public mapFixture(
  fixture: PatchedFixture,
  intent: LightingIntent,
  intensity: number,
  movement: MovementState
): FixtureState {
  const zone = (fixture.zone || 'UNASSIGNED') as PhysicalZone
  
  let panValue = movement.pan   // 0-1 (viene de applyPhaseOffset)
  let tiltValue = movement.tilt // 0-1
  
  const isMovingFixture = this.isMovingZone(zone) || 
                          fixture.type?.toLowerCase().includes('moving')
  
  // Ceiling tilt inversion (normal)
  if (this.installationType === 'ceiling' && isMovingFixture) {
    tiltValue = 1 - tiltValue
  }
  
  // ⚠️ BUG CRÍTICO: MIRROR DUPLICADO
  if (zone === 'MOVING_RIGHT') {
    panValue = 1 - panValue  // ¡INVIERTE NUEVAMENTE!
  }
  
  return {
    pan: Math.round(panValue * 255),   // Convertir a DMX
    tilt: Math.round(tiltValue * 255), // Convertir a DMX
    ...
  }
}
```

**El Problema:**
1. `HAL.applyPhaseOffset()` ya invierte PAN para MOVING_RIGHT (mirrorSign = -1)
2. `FixtureMapper.mapFixture()` invierte NUEVAMENTE
3. Resultado: DOUBLE FLIP = Sin cambio
4. MOVING_RIGHT no se ve diferente a MOVING_LEFT

**Ejemplo Numérico:**
```
TitanEngine genera: baseX = 0.62

HAL.applyPhaseOffset() con pattern='mirror':
  amplitudeX = 0.62 - 0.5 = 0.12
  mirrorSign = -1 (para RIGHT)
  x = 0.5 + 0.12 * (-1) = 0.5 - 0.12 = 0.38 ✅ CORRECTO (invertido)

FixtureMapper.mapFixture():
  panValue = 0.38 (entrada)
  if (zone === 'MOVING_RIGHT') panValue = 1 - 0.38 = 0.62
  panValue = 0.62 ❌ VOLVIÓ AL ORIGINAL!
  
Resultado: MOVING_RIGHT termina en 0.62 (mismo que MOVING_LEFT)
           No hay espejo visible
```

---

### Capa 4: FixturePhysicsDriver.ts (Interpolación)

**Ubicación:** `electron-app/src/hal/drivers/FixturePhysicsDriver.ts` línea 420

**Responsabilidad:** Interpolar movimiento con límites de velocidad por vibe

**Análisis:**
```typescript
public translateDMX(fixtureId: string, panDmx: number, tiltDmx: number, frameTime: number) {
  const state = this.fixtureStates.get(fixtureId)
  if (!state) return
  
  // Calcular delta desde posición actual
  const deltaX = panDmx - state.physicalPan
  const deltaY = tiltDmx - state.physicalTilt
  
  // SNAP MODE: Si cambio pequeño, usar física suave
  const threshold = 10  // DMX units
  const isSmallChange = Math.abs(deltaX) < threshold && 
                        Math.abs(deltaY) < threshold
  
  const snapFactor = isSmallChange 
    ? SNAP_FACTORS.physical[this.currentVibeId]  // ~0.15 (suave)
    : SNAP_FACTORS.snap[this.currentVibeId]      // ~0.6 (rápido)
  
  // REV LIMITER: Limitar velocidad máxima por vibe
  const revLimit = REV_LIMIT_PAN[this.currentVibeId] || 255
  const maxDeltaPerFrame = revLimit / 60  // Para 60 FPS
  
  const limitedDeltaX = Math.min(Math.abs(deltaX), maxDeltaPerFrame)
  const limitedDeltaY = Math.min(Math.abs(deltaY), maxDeltaPerFrame)
  
  // Interpolar
  state.physicalPan += Math.sign(deltaX) * limitedDeltaX * snapFactor
  state.physicalTilt += Math.sign(deltaY) * limitedDeltaY * snapFactor
  
  // Guardar velocidad para debug
  state.panVelocity = state.physicalPan - prevPan
  state.tiltVelocity = state.physicalTilt - prevTilt
}
```

**Análisis:**
- ✅ Rev Limiter está en el lugar CORRECTO (en driver, no en pattern)
- ✅ SNAP MODE es per-vibe y tiene lógica clara
- ✅ Interpolación suave hacia target
- ✅ No hay duplicación o lógica conflictiva aquí

**Nota:** Este layer es donde la velocidad se limita, lo que explica por qué los movers se mueven "suave" incluso cuando el patrón cambia abruptamente.

---

## 🔴 PROBLEMAS IDENTIFICADOS

### 🔴 CRÍTICO #1: MIRROR DUPLICADO EN FIXTUREMAPPER

| Aspecto | Detalles |
|---------|----------|
| **Ubicación** | `FixtureMapper.ts` línea 156-158 |
| **Tipo** | Duplicación de código / Bug lógico |
| **Severidad** | CRÍTICA - Afecta visualmente a Techno |
| **Síntoma** | MOVING_RIGHT no se ve invertido |
| **Causa** | Ambos HAL y FixtureMapper aplican espejo |
| **Solución** | Eliminar líneas 156-158 en FixtureMapper |

**Código a eliminar:**
```typescript
// Mirror effect for MOVING_RIGHT  ← CÓDIGO MUERTO
if (zone === 'MOVING_RIGHT') {
  panValue = 1 - panValue
}
```

**Por qué es un fósil:**
- El mirror se implementó primero en FixtureMapper
- Luego se movió a HAL.applyPhaseOffset() para consolidar pattern logic
- El código antiguo nunca se eliminó → doble aplicación

---

### 🟠 IMPORTANTE #2: PATTERN MATH HARDCODED EN TITANENGINE

| Aspecto | Detalles |
|---------|----------|
| **Ubicación** | `TitanEngine.ts` línea ~760 |
| **Tipo** | Violación de responsabilidades |
| **Severidad** | IMPORTANTE - Arquitectónica |
| **Síntoma** | Difícil de debuggear, extender, testear |
| **Causa** | VibeMovementManager nunca fue creado |
| **Impacto** | Mantenimiento, escalabilidad |

**Contexto:**
- TitanEngine es el orquestador del lighting
- No debería conocer detalles de generación de patrones
- Esta lógica debería estar en su propio módulo

**Qué está hardcoded:**
- figure8: `0.5 + Math.sin(t*f)*amp`
- circle: `0.5 + Math.sin/cos(t*f)*amp`
- wave: variación de figure8
- sweep: barrido lineal
- chase: persecución
- static: respiración

**Impacto actual:**
- ✗ Para agregar nuevo patrón: editar TitanEngine
- ✗ Para debuggear patrón: buscar en TitanEngine
- ✗ Para testear patrón: integración completa
- ✓ Funciona, pero no es escalable

---

### 🟡 POTENCIAL #3: VibeMovementPresets PARCIALMENTE UTILIZADO

| Aspecto | Detalles |
|---------|----------|
| **Ubicación** | `VibeMovementPresets.ts` |
| **Tipo** | Código parcialmente muerto |
| **Severidad** | POTENCIAL - No afecta funcionamiento |
| **Síntoma** | Nombre confuso (debería ser PhysicsPresets) |
| **Causa** | Refactoring incompleto |

**Estado actual:**
- Contiene: maxAccel, maxVel, friction, optics configs
- NO contiene: pattern definitions
- Se usa en: FixturePhysicsDriver (sí) y HAL (referencias)
- Se debería usar en: (cuando exista VibeMovementManager)

**Nota:** No afecta funcionamiento actual, solo organización del código.

---

## 📐 ANÁLISIS DE UNIDADES

### Tabla de Conversión de Unidades en el Flujo

```
┌───────────────────────┬──────────┬───────────────┬────────────────────┐
│ Capa                  │ Pan/Tilt │ Rango         │ Significado         │
├───────────────────────┼──────────┼───────────────┼────────────────────┤
│ TitanEngine.output    │ 0-1      │ Normalizado   │ 0=min, 1=max       │
│                       │          │               │ (sin tomar zona)    │
├───────────────────────┼──────────┼───────────────┼────────────────────┤
│ HAL.applyPhaseOffset  │ 0-1      │ Normalizado   │ Después de desfase  │
│                       │          │               │ (pan invertido p/   │
│                       │          │               │  RIGHT en mirror)   │
├───────────────────────┼──────────┼───────────────┼────────────────────┤
│ FixtureMapper.input   │ 0-1      │ Normalizado   │ Antes de x255       │
│                       │          │               │ (ojo: bug duplica)  │
├───────────────────────┼──────────┼───────────────┼────────────────────┤
│ FixtureMapper.output  │ 0-255    │ DMX estándar  │ Convertido a DMX    │
│                       │          │               │ (pan*255, tilt*255)│
├───────────────────────┼──────────┼───────────────┼────────────────────┤
│ PhysicsDriver.input   │ 0-255    │ DMX estándar  │ Target DMX          │
│                       │          │               │ (sin interpolar)    │
├───────────────────────┼──────────┼───────────────┼────────────────────┤
│ PhysicsDriver.output  │ 0-255    │ DMX estándar  │ Interpolado hacia   │
│                       │          │               │ target (con límites)│
├───────────────────────┼──────────┼───────────────┼────────────────────┤
│ Frontend.render       │ 0-255    │ DMX estándar  │ Visualización 3D    │
│                       │          │               │ Convertir a ángulos │
└───────────────────────┴──────────┴───────────────┴────────────────────┘
```

### Conversión de Ángulos (Orientación del Mover)

```
PAN (horizontal, 0-255 DMX):
  0°   = DMX 0   = Pan izquierda máxima   (-270°)
  90°  = DMX 64  = Pan izquierda media
  180° = DMX 128 = Centro (0°)
  270° = DMX 192 = Pan derecha media
  360° = DMX 255 = Pan derecha máxima (+270°)
  
TILT (vertical, 0-255 DMX):
  0°   = DMX 0   = Tilt arriba máximo     (-135°)
  90°  = DMX 64  = Tilt arriba media
  180° = DMX 128 = Centro (0°)
  270° = DMX 192 = Tilt abajo media
  360° = DMX 255 = Tilt abajo máximo     (+135°)
```

### Ejemplo de Rastreo Numérico (Mirror Pattern Techno)

**ESCENARIO:** MOVING_LEFT vs MOVING_RIGHT con mirror pattern

```
┌─ MOVING_LEFT ──────────────────────────────────────────────────┐
│                                                                 │
│ TitanEngine (no aplica espejo, solo devuelve center):         │
│   baseX = 0.5 + sin(t) * 0.1 = 0.65                           │
│   baseY = 0.5                                                  │
│   Output: { centerX: 0.65, centerY: 0.5 }                    │
│                                                                 │
│ HAL.applyPhaseOffset(pattern='mirror', zone='MOVING_LEFT'):  │
│   isLeftZone = true                                            │
│   mirrorSign = 1                                               │
│   x = 0.5 + (0.65-0.5) * 1 = 0.65 ✅ Sin cambio              │
│   y = 0.5                                                      │
│   Output: { x: 0.65, y: 0.5 }                                 │
│                                                                 │
│ FixtureMapper.mapFixture():                                    │
│   panValue = 0.65                                              │
│   if (zone === 'MOVING_RIGHT') { ... } ← FALSE, no aplica     │
│   pan = round(0.65 * 255) = 166 DMX ✅                        │
│   Output: { pan: 166 DMX, tilt: 128 DMX }                    │
│                                                                 │
│ PhysicsDriver.translateDMX():                                  │
│   Interpola hacia pan=166, tilt=128                           │
│   (resultado final del ciclo depende de velocidad anterior)    │
│                                                                 │
│ Frontend: Pan ~166 → ~45° a la derecha ✓ CORRECTO            │
└─────────────────────────────────────────────────────────────────┘

┌─ MOVING_RIGHT ──────────────────────────────────────────────────┐
│                                                                 │
│ TitanEngine (igual que LEFT - sin saber de zonas):            │
│   baseX = 0.65                                                │
│   baseY = 0.5                                                  │
│   Output: { centerX: 0.65, centerY: 0.5 }                    │
│                                                                 │
│ HAL.applyPhaseOffset(pattern='mirror', zone='MOVING_RIGHT'):  │
│   isRightZone = true                                           │
│   mirrorSign = -1                                              │
│   x = 0.5 + (0.65-0.5) * (-1) = 0.35 ✅ INVERTIDO            │
│   y = 0.5                                                      │
│   Output: { x: 0.35, y: 0.5 }                                 │
│                                                                 │
│ FixtureMapper.mapFixture():                                    │
│   panValue = 0.35                                              │
│   if (zone === 'MOVING_RIGHT') {                              │
│     panValue = 1 - 0.35 = 0.65 ❌ VOLVIÓ AL ORIGINAL!        │
│   }                                                             │
│   pan = round(0.65 * 255) = 166 DMX ❌ MISMO QUE LEFT         │
│   Output: { pan: 166 DMX, tilt: 128 DMX }                    │
│                                                                 │
│ PhysicsDriver.translateDMX():                                  │
│   Interpola hacia pan=166, tilt=128 (igual que LEFT)         │
│                                                                 │
│ Frontend: Pan ~166 → ~45° a la derecha ✗ DEBERÍA SER -45°    │
└─────────────────────────────────────────────────────────────────┘

⚠️ RESULTADO FINAL:
  MOVING_LEFT:   Pan = 166 DMX → +45° derecha
  MOVING_RIGHT:  Pan = 166 DMX → +45° derecha (¡MISMO!)
  
  ❌ NO hay efecto espejo visible
  ❌ Ambos movers se mueven igual
  ❌ Techno "puertas del infierno" no funciona
```

---

## 🔍 RASTREO DE PATRONES

### Pattern: LATINO - FIGURE8

```
TitanEngine.calculateMovement():
  pattern = 'figure8'
  freq = speed * 240 / 120
  time = movementTime
  amplitude = intensity * 0.4
  
  centerX = 0.5 + Math.sin(time * freq) * amplitude      ← Horizontal
  centerY = 0.5 + Math.cos(time * freq * 2) * amplitude  ← Vertical (doblar frecuencia)
  
  Resultado: Trayectoria tipo "8" con movers desfasados

HAL.applyPhaseOffset():
  case 'figure8':
    angle = atan2(amplitudeY, amplitudeX)
    newAngle = angle + phaseOffset
    
    x = 0.5 + cos(newAngle) * magnitude
    y = 0.5 + sin(newAngle) * magnitude
    
  Resultado: Cada fixture está rotada en la trayectoria
             Efecto visual: "snake" alrededor del 8

FixtureMapper.mapFixture():
  panValue = x * 255
  tiltValue = y * 255
  
  Resultado: Convertir a DMX

Estado ACTUAL: ✅ FUNCIONA - Latino figure8 se ve bien
               Logs confirman 2D y 3D funcionan
```

### Pattern: TECHNO - MIRROR

```
TitanEngine.calculateMovement():
  pattern = 'mirror'
  
  // Mirror NO genera pattern math, solo devuelve center
  return { centerX: 0.5, centerY: 0.5 }
  
  ℹ️ Nota: El movimiento real viene de las búsquedas

HAL.applyPhaseOffset():
  case 'mirror':
    isLeftZone = zone.includes('LEFT')
    isRightZone = zone.includes('RIGHT')
    
    if (isLeftZone)  mirrorSign = 1
    if (isRightZone) mirrorSign = -1
    
    x = 0.5 + amplitudeX * mirrorSign   ← Invierte solo PAN
    y = baseY                            ← TILT igual para ambas
    
  Resultado: MOVING_LEFT ≠ MOVING_RIGHT (deberían ser espejo)

FixtureMapper.mapFixture():
  ⚠️ BUG: if (zone === 'MOVING_RIGHT') { panValue = 1 - panValue }
  
  Resultado: DOUBLE FLIP = sin cambio
             RIGHT vuelve al original

Estado ACTUAL: ❌ ROTO - Espejo no se ve porque se aplica dos veces
```

### Pattern: TECHNO - CHASE

```
TitanEngine.calculateMovement():
  pattern = 'chase'
  
  // Chase también devuelve center
  return { centerX: 0.5, centerY: 0.5 }

HAL.applyPhaseOffset():
  case 'chase':
    chasePhase = fixtureIndex * (π/2)  // 90° entre fixtures
    
    x = 0.5 + sin(time * π * 2 * freq * 2 + chasePhase) * |amplitudeX|
    y = baseY
    
  Resultado: Persecución láser con offset per-fixture

Estado ACTUAL: ? No reportado problemas, probablemente funciona
```

---

## ⚙️ DUPLICACIÓN DE CÓDIGO

### Lista de Duplicaciones Identificadas

| Código | Ubicación 1 | Ubicación 2 | Severidad | Solución |
|--------|------------|------------|-----------|----------|
| Mirror inversion | HAL L.302 `x = 0.5 + amplitudeX * mirrorSign` | FixtureMapper L.157 `panValue = 1 - panValue` | 🔴 CRÍTICA | Eliminar en FixtureMapper |

**Análisis:**

El mirror se implementó en dos lugares:
1. **HAL** (CORRECTO): Aplica lógica de pattern + phase offset
2. **FixtureMapper** (FÓSIL): Código antiguo que nunca se eliminó

Cuando el refactoring movió logic de FixtureMapper a HAL, el código antiguo no se limpió.

---

## 📊 ESTADO ACTUAL POR VIBE

### ✅ LATINO (Figure8)

| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| **2D Movement** | ✅ Funciona | User: "Latino funciona en 2D y 3D" |
| **3D Movement** | ✅ Funciona | User: confirmado funcionando |
| **Pattern Shape** | ✅ Correcto | Figure8 visible en pantalla |
| **Phasing** | ✅ Correcto | Logs muestran desfase per-fixture |
| **Physics** | ✅ Correcto | SNAP MODE suave |

**Logs de éxito:**
```
[🔬 PHASE IN] Pan:XXX° Tilt:YYY° | Pattern:figure8 | Mag:0.123
[🔬 PHASE OUT] Pan:AAA° Tilt:BBB° | Δ=45°
[👁️ HAL] latino | Target:180°/0° → Phys:179°/1° | Z:200 F:150
```

---

### ❌ TECHNO (Mirror)

| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| **Mirror Inversion** | ❌ Roto | MOVING_RIGHT no se invierte |
| **Debug Logs** | ⚠️ Confusos | Logs muestran inversión correcta en HAL pero no se ve |
| **Phasing** | ✅ Correcto | Logs en HAL muestran mirrorSign=-1 para RIGHT |
| **Physics** | ✅ Correcto | SNAP MODE funciona |

**Problema raíz:**
```
HAL.applyPhaseOffset() → x=0.38 ✓ (correcto)
            ↓
FixtureMapper.mapFixture() → x=0.62 ✗ (invierte de nuevo)
            ↓
Frontend → MOVING_RIGHT = MOVING_LEFT (no hay espejo)
```

---

### ⏳ OTROS PATRONES

| Patrón | Estado | Notas |
|--------|--------|-------|
| **Wave** | ? Probable ✅ | Similar a Figure8, debería funcionar |
| **Circle** | ? Probable ✅ | Similar a Figure8, debería funcionar |
| **Sweep** | ? Probable ✅ | Similar a Figure8, debería funcionar |
| **Chase** | ? Probable ✅ | Implementación única, no reportado issues |
| **Static** | ✅ Funciona | Punto fijo con respiración |

---

## 📋 RECOMENDACIONES

### 🔴 CRÍTICO - Ejecutar Inmediatamente

#### Recomendación #1: Eliminar Mirror Duplicado

**Acción:** Borrar líneas 156-158 de `FixtureMapper.ts`

```typescript
// ❌ ELIMINAR ESTO:
if (zone === 'MOVING_RIGHT') {
  panValue = 1 - panValue
}
```

**Por qué:**
- El mirror ya se aplica en HAL.applyPhaseOffset()
- Doble aplicación causa que RIGHT vuelva al original
- Es código fósil de antes del refactoring

**Impacto:**
- Techno mirror debería funcionar correctamente
- No debería afectar otros patrones (MOVING_LEFT no entra en ese if)

**Testing:**
```
Antes: MOVING_LEFT pan=166°, MOVING_RIGHT pan=166° (¡igual!)
Después: MOVING_LEFT pan=166°, MOVING_RIGHT pan=90° (invertido)
```

---

### 🟠 IMPORTANTE - Refactoring Arquitectónico

#### Recomendación #2: Crear VibeMovementManager

**Ubicación:** Crear `electron-app/src/core/VibeMovementManager.ts`

**Responsabilidad:** Centralizar toda la lógica de generación de patrones

**Estructura propuesta:**
```typescript
export class VibeMovementManager {
  static generatePattern(
    pattern: string,
    time: number,
    speed: number,
    intensity: number
  ): { centerX: number; centerY: number } {
    switch (pattern) {
      case 'figure8': return PatternGenerators.figure8(time, speed, intensity)
      case 'circle': return PatternGenerators.circle(time, speed, intensity)
      case 'mirror': return PatternGenerators.mirror(time, speed, intensity)
      // ...
    }
  }
}

class PatternGenerators {
  static figure8(time: number, speed: number, intensity: number) {
    const freq = speed * 2
    const amplitude = intensity * 0.4
    return {
      centerX: 0.5 + Math.sin(time * freq) * amplitude,
      centerY: 0.5 + Math.cos(time * freq * 2) * amplitude
    }
  }
  
  static mirror(time: number, speed: number, intensity: number) {
    // Mirror devuelve center estático (el offset lo hace applyPhaseOffset)
    return { centerX: 0.5, centerY: 0.5 }
  }
  
  // ... más patrones
}
```

**Beneficios:**
- ✓ Separación de responsabilidades clara
- ✓ Fácil de testear cada patrón independientemente
- ✓ Fácil de agregar nuevos patrones
- ✓ TitanEngine solo orquesta, no implementa

**Implementación:** Mover código de TitanEngine.ts línea ~760 a este nuevo módulo

---

#### Recomendación #3: Refactorizar VibeMovementPresets

**Ubicación:** Renombrar o crear nuevo archivo

**Cambios:**
- Renombrar a `VibePhysicsPresets.ts` para claridad
- O crear `VibeMovementPresets.ts` que incluya patrones + physics

**Nota:** Baja prioridad, solo claridad de nombres

---

### 🟡 VALIDACIÓN - Testing

#### Recomendación #4: Crear Test Suite para Movimiento

**Tests necesarios:**

1. **Mirror Pattern Test**
   ```typescript
   test('mirror pattern inverts RIGHT correctly', () => {
     const left = applyPhaseOffset(..., zone='MOVING_LEFT', pattern='mirror')
     const right = applyPhaseOffset(..., zone='MOVING_RIGHT', pattern='mirror')
     
     expect(left.x).toBe(0.65)
     expect(right.x).toBe(0.35)  // Invertido
   })
   ```

2. **No Double Inversion**
   ```typescript
   test('mapper does not double-invert RIGHT', () => {
     const state = mapFixture(..., movement={x: 0.35})
     
     // FixtureMapper no debería invertir de nuevo
     expect(state.pan).toBe(round(0.35 * 255))
   })
   ```

3. **Unit Conversions**
   ```typescript
   test('units are consistent across layers', () => {
     // TitanEngine → 0-1
     // HAL → 0-1
     // FixtureMapper → 0-255
     // PhysicsDriver → 0-255
   })
   ```

---

## 📝 CONCLUSIONES

### Lo que está BIEN ✅
1. **Latino Figure8** - Funciona perfecto en 2D y 3D
2. **Physics Interpolation** - SNAP MODE es suave y per-vibe
3. **Rev Limiter Placement** - Está en el lugar correcto (PhysicsDriver)
4. **Overall Architecture** - Flujo claro de generación → phase offset → mapping → physics

### Lo que está MAL ❌
1. **Mirror Duplicado** - CRÍTICO - Techno no funciona
2. **Pattern Math Hardcoded** - IMPORTANTE - Mantenibilidad

### Acción Recomendada
1. 🔴 Eliminar mirror duplicado en FixtureMapper (5 min)
2. 🟠 Crear VibeMovementManager (1-2 horas)
3. 🟡 Tests para prevenir regressions (1 hora)

---

**Documento preparado para:** Radwulf  
**Auditoría realizada por:** PunkOpus  
**Estado:** ANÁLISIS COMPLETO LISTO PARA ACCIÓN
