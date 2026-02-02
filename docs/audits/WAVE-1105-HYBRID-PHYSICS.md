# 🔧 WAVE 1105.2: HYBRID PHYSICS ENGINE

**Fecha**: Auto-generado
**Archivo Modificado**: `electron-app/src/engine/movement/FixturePhysicsDriver.ts`
**Principio**: EL HARDWARE DEL FIXTURE MANDA

---

## 📋 PROBLEMA ORIGINAL

El sistema de física tenía solo 2 niveles de límites:
1. **SAFETY_CAP** (hardcoded global)
2. **Vibe Request** (dinámico por género)

**El Problema**: Un mover chino de $80 con motores lentos recibía las mismas instrucciones de velocidad que un Martin MAC de $5,000. Resultado: el mover barato intentaba seguir el ritmo de Techno y se estresaba (o se rompía).

---

## 🏗️ SOLUCIÓN: JERARQUÍA DE 3 NIVELES

```
┌─────────────────────────────────────────────────────────┐
│                    SAFETY_CAP                           │
│             (Límite absoluto del sistema)               │
│                maxAccel: 2500, maxVel: 800              │
├─────────────────────────────────────────────────────────┤
│                    VIBE REQUEST                         │
│               (Lo que pide el género)                   │
│        Techno: 1500 | Latino: 1200 | Chill: 600         │
├─────────────────────────────────────────────────────────┤
│               FIXTURE HARDWARE LIMIT                    │
│              (Lo que aguanta el motor)                  │
│     Budget: 1200 | Mid: 1800 | Pro: sin límite          │
└─────────────────────────────────────────────────────────┘

          ↓ ↓ ↓ THE BOTTLENECK ↓ ↓ ↓

    EffectiveLimit = Math.min(SafetyCap, VibeRequest, HardwareLimit)
```

**"Si tu motor es un burro, se mueve como burro aunque la Vibe pida F1"**

---

## 📦 NUEVA INTERFAZ: `FixturePhysicsProfile`

```typescript
export interface FixturePhysicsProfile {
  maxAcceleration?: number      // Límite de aceleración del hardware
  maxVelocity?: number          // Límite de velocidad del hardware
  motorType?: 'stepper' | 'servo' | 'belt' | 'unknown'
  panSpeedFactor?: number       // 0.5 = mitad de velocidad en pan
  tiltSpeedFactor?: number      // 0.5 = mitad de velocidad en tilt
  qualityTier?: 'budget' | 'mid' | 'pro'  // Auto-tune según tier
}
```

### Integración en `FixtureConfig`:

```typescript
export interface FixtureConfig {
  id: string
  name: string
  // ... campos existentes
  physicsProfile?: FixturePhysicsProfile  // ← NUEVO
}
```

---

## ⚙️ HELPER: `getEffectivePhysicsLimits()`

Calcula los límites efectivos aplicando la jerarquía de 3 niveles:

```typescript
private getEffectivePhysicsLimits(config: FixtureConfig): {
  maxAcceleration: number
  maxVelocity: number
  speedFactorPan: number
  speedFactorTilt: number
}
```

### Lógica:

1. **Nivel 1**: Empieza con SAFETY_CAP
2. **Nivel 2**: `Math.min` con Vibe Request
3. **Nivel 3**: `Math.min` con Hardware Limit (si existe)
4. **Auto-tune**: Si hay `qualityTier` pero no valores explícitos, aplica defaults

### Auto-tune por `qualityTier`:

| Tier | maxAcceleration | maxVelocity | Ejemplo |
|------|-----------------|-------------|---------|
| `budget` | 1200 | 400 | Movers chinos $50-150 |
| `mid` | 1800 | 600 | Movers $200-500 |
| `pro` | Sin límite extra | Sin límite extra | Martin, Robe, etc. |

---

## 🏎️ REV_LIMITER MODULADO POR SPEEDFACTOR

El REV_LIMITER ahora se ajusta por fixture:

```typescript
// Después de calcular REV_LIMIT base por vibe...
REV_LIMIT_PAN = Math.round(REV_LIMIT_PAN * speedFactorPan)
REV_LIMIT_TILT = Math.round(REV_LIMIT_TILT * speedFactorTilt)
```

**Ejemplo**: Un fixture con `panSpeedFactor: 0.5`:
- Techno pide `REV_LIMIT_PAN = 120`
- Fixture lo reduce a `120 * 0.5 = 60`
- El mover se mueve a la mitad de velocidad, pero sin estresarse

---

## 🔄 MODO CLÁSICO ACTUALIZADO

El CLASSIC MODE (usado por CHILL) ahora también usa límites efectivos:

```typescript
const effectiveMaxVel = effectiveLimits.maxVelocity
const maxSpeed = Math.min(config.maxSpeed[axis] || effectiveMaxVel, effectiveMaxVel)
const brakingDistance = (vel * vel) / (2 * maxAccel)
```

---

## 📝 EJEMPLO DE USO

Al registrar un fixture con motor lento:

```typescript
fixturePhysicsDriver.registerFixture({
  id: 'mover-chino-1',
  name: 'Generic LED Beam',
  panRange: [0, 540],
  tiltRange: [0, 220],
  maxSpeed: { pan: 300, tilt: 200 },
  physicsProfile: {
    qualityTier: 'budget',        // Auto-tune a límites conservadores
    panSpeedFactor: 0.6,          // Pan 40% más lento
    tiltSpeedFactor: 0.8,         // Tilt 20% más lento
  }
})
```

O con valores explícitos:

```typescript
fixturePhysicsDriver.registerFixture({
  id: 'robe-spot-575',
  name: 'Robe ColorSpot 575',
  physicsProfile: {
    maxAcceleration: 2200,        // Motor servo potente
    maxVelocity: 750,
    motorType: 'servo',
    qualityTier: 'pro',
  }
})
```

---

## 🛡️ GARANTÍAS DE SEGURIDAD

1. **SAFETY_CAP nunca se viola** - Es el tope absoluto
2. **Sin physicsProfile = defaults globales** - Comportamiento legacy
3. **Hardware siempre gana** - Si el motor es lento, va lento
4. **Logging explícito** - `🔧 WAVE 1105.2: Fixture registered with physicsProfile`

---

## 📊 RESUMEN DE CAMBIOS EN CÓDIGO

| Archivo | Cambio |
|---------|--------|
| `FixturePhysicsDriver.ts` | +`FixturePhysicsProfile` interface |
| `FixturePhysicsDriver.ts` | Extended `FixtureConfig` con `physicsProfile?` |
| `FixturePhysicsDriver.ts` | +`getEffectivePhysicsLimits()` helper |
| `FixturePhysicsDriver.ts` | `applyPhysicsEasing()` usa límites efectivos |
| `FixturePhysicsDriver.ts` | REV_LIMITER modulado por speedFactor |
| `FixturePhysicsDriver.ts` | CLASSIC MODE usa `maxAccel` efectivo |

---

## ✅ WAVE 1105.2 COMPLETADA

**Principio cumplido**: El hardware del fixture manda. Un motor lento se mueve lento, aunque la Vibe pida velocidad Warp.
