# 🔧 CORE 2 BLUEPRINT: MOVEMENT & OPTICS ENGINE
## Autopsia + Plan de Ataque 48h

**Status**: 🔬 AUTOPSIA COMPLETA  
**Commander**: Radwulf  
**Operative**: PunkOpus  
**Date**: January 9, 2026  
**Mission**: 12 fixtures bailando en 48 horas

---

## 📋 EXECUTIVE SUMMARY

### ✅ **BUENAS NOTICIAS - Lo que YA TENEMOS:**

1. **FixturePhysicsDriver V16.1** - Motor de física FUNCIONAL
   - ✅ Inercia/Aceleración implementada (curva S)
   - ✅ Fases de frenado y aceleración
   - ✅ Anti-stuck mechanism
   - ✅ Anti-jitter filter
   - ✅ NaN guard (protección hardware)
   - ✅ 4 presets de instalación (ceiling, floor, truss_front, truss_back)
   - ✅ Soporte 16-bit (panFine, tiltFine)

2. **VibeProfile System** - Estructura de constraints YA EXISTE
   - ✅ `VibeMovementConstraints` definido en tipos
   - ✅ Cada vibe tiene `movement: { allowedPatterns, speedRange, ... }`
   - ✅ TitanEngine ya llama `calculateMovement()` con vibeProfile

3. **FixtureManager** - Gestión de fixtures básica
   - ✅ Soporte para Pan/Tilt, Focus, Zoom (en definiciones)
   - ✅ Detección de capacidades por fixture
   - ✅ Mapeo a canales DMX

### ⚠️ **GAPS DETECTADOS - Lo que FALTA:**

1. **Movement Profiles INCOMPLETOS**
   - Los vibes tienen `movement: {}` pero es MUY BÁSICO
   - Falta: aceleración, inercia, zoom, focus por vibe
   - El `calculateMovement()` en TitanEngine es RUDIMENTARIO

2. **OPTICS NO EXISTEN**
   - Zoom/Focus están en las definiciones pero **NO SE USAN**
   - No hay lógica que traduzca vibe → óptica
   - El FixtureManager tiene los canales pero no los controla

3. **CONEXIÓN ROTA**
   - TitanEngine calcula `MovementIntent` pero **NO LO PASA** al FixturePhysicsDriver
   - El HAL no recibe instrucciones de movimiento reales
   - El FixturePhysicsDriver existe pero **NADIE LO LLAMA**

---

## 🗂️ ARCHIVOS CRÍTICOS DETECTADOS

### **Motor de Movimiento**
```
electron-app/src/engine/movement/
├── FixturePhysicsDriver.ts  ← 446 líneas, COMPLETO V16.1
├── FixtureManager.ts        ← 333 líneas, gestión fixtures
└── index.ts

Estado: ✅ Código existe, ⚠️ Desconectado del pipeline
```

### **Física por Vibe**
```
electron-app/src/hal/physics/
├── PhysicsEngine.ts         ← Motor global (intensidades)
├── TechnoStereoPhysics.ts   ← Física Techno (intensidad)
├── LatinoStereoPhysics.ts   ← Física Latino (intensidad)
├── RockStereoPhysics.ts     ← Física Rock (intensidad)
├── ChillStereoPhysics.ts    ← Física Chill (intensidad)
└── index.ts

Estado: ✅ Funcionales para INTENSIDAD, ❌ NO manejan MOVIMIENTO
```

### **Perfiles de Vibe**
```
electron-app/src/engine/vibe/profiles/
├── TechnoClubProfile.ts     ← movement básico
├── FiestaLatinaProfile.ts   ← movement básico
├── PopRockProfile.ts        ← movement básico
├── ChillLoungeProfile.ts    ← movement básico
└── IdleProfile.ts

Estado: ✅ Estructura existe, ⚠️ Falta ampliar movement + optics
```

### **Orquestación**
```
electron-app/src/engine/TitanEngine.ts    ← 702 líneas
└── calculateMovement() en línea 571      ← RUDIMENTARIO

Estado: ⚠️ Calcula MovementIntent pero no lo conecta a physics
```

### **Drivers DMX**
```
electron-app/src/hal/drivers/
├── ArtNetDriver.ts          ← Envío DMX por red
├── UniversalDMXDriver.ts    ← Driver universal
└── DMXDriver.interface.ts

Estado: ✅ Funcionales
```

---

## 🔬 ANATOMÍA DEL MOTOR FÍSICO

### **FixturePhysicsDriver V16.1 - LO QUE YA HACE:**

```typescript
// Estructura de física de inercia existente:
physicsConfig = {
  maxAcceleration: 800,     // Aceleración máxima
  maxVelocity: 400,         // Velocidad máxima
  friction: 0.15,           // Fricción
  arrivalThreshold: 1.0,    // Umbral de llegada
  minTransitionTime: 50,    // Tiempo mínimo transición
}

// Método translate() YA implementa:
// 1. abstractToTargetDMX() - Coordenadas (-1,+1) → DMX (0-255)
// 2. applySafetyLimits() - Safety box
// 3. applyPhysicsEasing() - CURVA S con aceleración/frenado
// 4. Anti-NaN, Anti-Jitter, Anti-Stuck
```

### **LO QUE FALTA EN PHYSICS:**

```typescript
// NO EXISTE: Ópticas
interface OpticsConfig {
  zoom: number       // 0-255
  focus: number      // 0-255
  iris?: number      // 0-255 (si aplica)
}

// NO EXISTE: Profiles por Vibe
interface MovementProfile {
  maxAcceleration: number   // Por vibe
  maxVelocity: number       // Por vibe
  friction: number          // Por vibe (slew rate)
  defaultZoom: number       // Beam, Spot, Wash
  defaultFocus: number      // Sharp, Soft, Nebula
}
```

---

## 🎯 ESTRUCTURA PROPUESTA: VibeMovementPresets

```typescript
// electron-app/src/engine/movement/VibeMovementPresets.ts

/**
 * 🎛️ VIBE MOVEMENT PRESETS
 * 
 * Define física de movimiento + óptica por vibe.
 * El motor físico lee estos presets y ajusta su comportamiento.
 */

export interface MovementPreset {
  // ═══════════════════════════════════════════════════════════════
  // FÍSICA DE MOVIMIENTO
  // ═══════════════════════════════════════════════════════════════
  physics: {
    maxAcceleration: number   // DMX units/s² (100-2000)
    maxVelocity: number       // DMX units/s (50-800)
    friction: number          // 0.0-1.0 (slew rate limit)
    arrivalThreshold: number  // DMX units (0.5-5.0)
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ÓPTICA
  // ═══════════════════════════════════════════════════════════════
  optics: {
    zoomDefault: number       // 0-255 (0=Beam, 255=Wash)
    zoomRange: { min: number; max: number }
    focusDefault: number      // 0-255 (0=Sharp, 255=Soft)
    focusRange: { min: number; max: number }
    irisDefault?: number      // 0-255 (si existe)
  }
  
  // ═══════════════════════════════════════════════════════════════
  // COMPORTAMIENTO
  // ═══════════════════════════════════════════════════════════════
  behavior: {
    homeOnSilence: boolean    // ¿Volver a home en silencio?
    syncToBeat: boolean       // ¿Sincronizar con beat?
    allowRandomPos: boolean   // ¿Permitir posiciones random?
    smoothFactor: number      // 0.0-1.0 (extra smoothing)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESETS POR VIBE
// ═══════════════════════════════════════════════════════════════════════════

export const MOVEMENT_PRESETS: Record<string, MovementPreset> = {
  
  // ───────────────────────────────────────────────────────────────
  // 🎛️ TECHNO: Velocidad máxima, Aceleración agresiva
  // ───────────────────────────────────────────────────────────────
  'techno-club': {
    physics: {
      maxAcceleration: 1500,    // Arranques explosivos
      maxVelocity: 600,         // Muy rápido
      friction: 0.05,           // Casi sin fricción (libre)
      arrivalThreshold: 0.5,    // Precisión alta
    },
    optics: {
      zoomDefault: 30,          // Beam cerrado
      zoomRange: { min: 0, max: 80 },
      focusDefault: 20,         // Foco nítido
      focusRange: { min: 0, max: 50 },
    },
    behavior: {
      homeOnSilence: false,     // Mantener posición en breakdown
      syncToBeat: true,         // Sincronizar con kick
      allowRandomPos: false,    // Patrones predecibles
      smoothFactor: 0.1,        // Movimiento seco
    },
  },
  
  // ───────────────────────────────────────────────────────────────
  // 💃 LATINO: Fluido, Circular, Orgánico
  // ───────────────────────────────────────────────────────────────
  'fiesta-latina': {
    physics: {
      maxAcceleration: 400,     // Arranques suaves
      maxVelocity: 250,         // Velocidad media
      friction: 0.25,           // Fricción moderada (fluido)
      arrivalThreshold: 2.0,    // Permite overshoot elegante
    },
    optics: {
      zoomDefault: 150,         // Zoom medio (spot suave)
      zoomRange: { min: 80, max: 200 },
      focusDefault: 100,        // Foco medio
      focusRange: { min: 50, max: 180 },
    },
    behavior: {
      homeOnSilence: false,     // Continuar bailando
      syncToBeat: true,         // Sincronizar con clave
      allowRandomPos: true,     // Movimientos orgánicos
      smoothFactor: 0.5,        // Movimiento suave
    },
  },
  
  // ───────────────────────────────────────────────────────────────
  // 🎸 ROCK: Reactivo, Posiciones fijas, Wall of Light
  // ───────────────────────────────────────────────────────────────
  'pop-rock': {
    physics: {
      maxAcceleration: 800,     // Golpes reactivos
      maxVelocity: 400,         // Rápido en golpes
      friction: 0.40,           // Alta fricción (para estático)
      arrivalThreshold: 1.0,    // Precisión normal
    },
    optics: {
      zoomDefault: 220,         // Zoom abierto (wash)
      zoomRange: { min: 150, max: 255 },
      focusDefault: 180,        // Foco suave (difuso)
      focusRange: { min: 100, max: 255 },
    },
    behavior: {
      homeOnSilence: true,      // Volver a home en breakdown
      syncToBeat: false,        // Reaccionar a energía, no beat
      allowRandomPos: false,    // Posiciones de stage fijas
      smoothFactor: 0.2,        // Algo de suavizado
    },
  },
  
  // ───────────────────────────────────────────────────────────────
  // 🍸 CHILL: Glacial, Nebulosa, Meditativo
  // ───────────────────────────────────────────────────────────────
  'chill-lounge': {
    physics: {
      maxAcceleration: 100,     // Ultra lento
      maxVelocity: 50,          // Velocidad glacial
      friction: 0.80,           // Máxima fricción (slew rate limit)
      arrivalThreshold: 3.0,    // Permite mucho overshoot
    },
    optics: {
      zoomDefault: 255,         // Zoom máximo (wash total)
      zoomRange: { min: 200, max: 255 },
      focusDefault: 255,        // Desenfocado (nebulosa)
      focusRange: { min: 200, max: 255 },
    },
    behavior: {
      homeOnSilence: false,     // Flotar eternamente
      syncToBeat: false,        // Movimiento libre
      allowRandomPos: true,     // Deriva orgánica
      smoothFactor: 0.9,        // Ultra suave
    },
  },
  
  // ───────────────────────────────────────────────────────────────
  // 💤 IDLE: Estático, Neutral
  // ───────────────────────────────────────────────────────────────
  'idle': {
    physics: {
      maxAcceleration: 200,
      maxVelocity: 100,
      friction: 0.50,
      arrivalThreshold: 1.0,
    },
    optics: {
      zoomDefault: 127,
      zoomRange: { min: 0, max: 255 },
      focusDefault: 127,
      focusRange: { min: 0, max: 255 },
    },
    behavior: {
      homeOnSilence: true,
      syncToBeat: false,
      allowRandomPos: false,
      smoothFactor: 0.3,
    },
  },
}

/**
 * Obtener preset de movimiento por vibe
 */
export function getMovementPreset(vibeId: string): MovementPreset {
  return MOVEMENT_PRESETS[vibeId] || MOVEMENT_PRESETS['idle']
}
```

---

## 🔥 PLAN DE ATAQUE - 3 PASOS

### **PASO 1: CONECTAR EL CABLE (4h)** 🔌
**Objetivo**: Hacer que TitanEngine → FixturePhysicsDriver funcione

1. Crear `VibeMovementPresets.ts` (código arriba)
2. Modificar `TitanEngine.calculateMovement()` para:
   - Leer preset del vibe actual
   - Pasar physics config al driver
3. Instanciar `FixturePhysicsDriver` en HAL
4. Conectar `MovementIntent` → `translate()` → DMX output

**Archivos a tocar**:
- `NEW: src/engine/movement/VibeMovementPresets.ts`
- `EDIT: src/engine/TitanEngine.ts` (línea 571+)
- `EDIT: src/hal/HardwareAbstraction.ts` (instanciar driver)

### **PASO 2: ÓPTICAS (3h)** 🔍
**Objetivo**: Zoom/Focus controlado por vibe

1. Añadir `OpticsController` al HAL
2. Leer valores de óptica del `MovementPreset`
3. Mapear a canales DMX del fixture (ya definidos en FixtureManager)
4. Aplicar suavizado (no queremos zoom nervioso)

**Archivos a tocar**:
- `NEW: src/hal/OpticsController.ts`
- `EDIT: src/hal/HardwareAbstraction.ts`
- `EDIT: src/engine/movement/FixtureManager.ts`

### **PASO 3: UI CLEANUP (2h)** 🧹
**Objetivo**: Fixture selection menos "chapucero"

**Archivo identificado**: 
- `src/engine/movement/FixtureManager.ts` (líneas 170-333)
- Estado de fixtures en `Map<string, ManagedFixture>`

**Problemas detectados**:
- No hay validación de conflictos de canal
- No hay feedback visual del estado
- La selección es manual sin helpers

**Fix rápido**:
- Añadir `validateChannelConflicts()`
- Añadir `getFixtureSummary()` para UI
- Limpiar logs de debug innecesarios

---

## 📊 RESUMEN VISUAL

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA CORE 2                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐  │
│  │ VibeProfile │────>│  TitanEngine     │────>│ HAL Layer   │  │
│  │ movement:   │     │ calculateMove()  │     │             │  │
│  │ speedRange  │     └────────┬─────────┘     │             │  │
│  │ patterns    │              │               │             │  │
│  └─────────────┘              ▼               │             │  │
│                    ┌──────────────────┐       │             │  │
│  ┌─────────────┐   │ MovementPreset   │       │             │  │
│  │ NEW!        │──>│ physics, optics  │       │             │  │
│  │ VibeMove    │   │ behavior         │       │             │  │
│  │ Presets.ts  │   └────────┬─────────┘       │             │  │
│  └─────────────┘            │                 │             │  │
│                             ▼                 │             │  │
│                  ┌──────────────────┐         │             │  │
│                  │ FixturePhysics   │◄────────┤             │  │
│                  │ Driver V16.1    │         │             │  │
│                  │ translate()      │         │             │  │
│                  │ applyPhysics()   │         │             │  │
│                  └────────┬─────────┘         │             │  │
│                           │                   │             │  │
│                           ▼                   │             │  │
│                  ┌──────────────────┐         │             │  │
│                  │ DMX Output       │◄────────┘             │  │
│                  │ Pan/Tilt/Zoom    │                       │  │
│                  │ Focus/Gobo/etc   │                       │  │
│                  └──────────────────┘                       │  │
│                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⏱️ TIMELINE 48H

| Hora | Tarea | Deliverable |
|------|-------|-------------|
| **0-4h** | PASO 1: Cable Connection | MovementPreset → Driver working |
| **4-7h** | PASO 2: Optics | Zoom/Focus por vibe |
| **7-9h** | PASO 3: UI Cleanup | FixtureManager limpio |
| **9-12h** | Integration Testing | Todos los vibes probados |
| **12-24h** | Buffer / Debugging | Arreglar lo que se rompa |
| **24-48h** | Real Fixture Testing | 12 fixtures bailando |

---

## 🎯 VICTORY CONDITION

**Los 12 fixtures deben:**
1. ✅ Responder a cambio de vibe (velocidad/inercia diferente)
2. ✅ Zoom cambia automáticamente (Beam→Wash según vibe)
3. ✅ Focus cambia automáticamente (Sharp→Nebula según vibe)
4. ✅ Movimiento sincronizado con música (beat sync)
5. ✅ Sin jitter, sin stuck, sin NaN

---

## 📝 NOTAS FINALES

**El motor físico YA ESTÁ HECHO.** FixturePhysicsDriver V16.1 es sólido.

**El problema es que NADIE LO USA.** TitanEngine calcula MovementIntent pero no lo conecta al driver.

**La solución es PLOMERÍA, no arquitectura.** Conectar los cables que ya existen.

**Confidence Level**: 90% de éxito en 48h. El código base es bueno, solo falta integración.

---

*"Lock, Stock, and Two Smoking Barrels - ahora moviendo cabezas."*

🔧 **PunkOpus - CORE 2 AUTOPSY COMPLETE**
