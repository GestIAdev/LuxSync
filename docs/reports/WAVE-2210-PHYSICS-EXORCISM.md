# WAVE 2210 — THE PHYSICS EXORCISM

**Fecha:** 2024  
**Estado:** ✅ COMPLETE  
**Tests:** 127/127 PASS  
**Archivos modificados:**
- `src/engine/movement/VibeMovementManager.ts`
- `src/engine/movement/VibeMovementPresets.ts`
- `src/engine/movement/__tests__/FixturePhysicsDriver.test.ts`

---

## Diagnóstico

Tras WAVE 2209 (Amplitude Exorcism), tres bugs persistían:

### Bug 1 — Chill bypass: integrador de drift
`this.time` es un acumulador de dt (`+= frameDeltaTime`). Al pausar y reanudar
la aplicación, el primer frame acumula el tiempo completo de la pausa → el argumento
del `sin()` da un salto discreto → la posición del fixture "salta" instantáneamente.
Además, la amplitud WAVE 2209 era ±4.3° en pan (completamente invisible).

### Bug 2 — physicsMode 'snap' en Techno: efecto escalera
Con la fase ahora pura (sin BPM, sin jitter), el `VibeMovementManager` genera
targets sinusoidales suaves frame a frame. El `snap` mode aplica:
```
delta = (target - current) * snapFactor   // snapFactor = 0.85
```
Con targets continuos, el mover alcanza cada micro-target en <1ms y
"frena en seco" al frame siguiente → staircase effect / movimiento robótico.

**Diagnóstico preciso:** `snap` mode es correcto para targets DISCRETOS
(saltar a una posición fija). Es incorrecto para trayectorias CONTINUAS
(sin(), figure8, scan_x). Con trayectorias continuas, snap persigue
cada micro-target individualmente → sin fluidez de trayectoria.

### Bug 3 — Acumulador de fase: vulnerabilidad a jitter de rAF
rAF tiene ±2-5ms de jitter por frame. Con 60fps durante 10 minutos:
~36,000 frames × ±3ms = ±108s de desviación posible. Pausa/reanudación
genera dt de varios segundos en el primer frame → phase jump.

---

## Cirugías

### Surgery 1 — Chill bypass: reloj absoluto + amplitud visible
**Archivo:** `VibeMovementManager.ts`

**Antes (WAVE 2209):**
```typescript
const driftX = Math.sin(this.time * 0.00005 * phi) * 0.008
const driftY = Math.sin(this.time * 0.00003 * sqrt2) * 0.005
// this.time = acumulador de dt → puede saltarse al reanudar
// amplitud: ±4.3° (invisible)
```

**Después (WAVE 2210):**
```typescript
const tAbsolute = Date.now() / 1000  // reloj absoluto — sin acumulación
const driftX = Math.sin(tAbsolute * 0.00025 * phi) * 0.35
const driftY = Math.sin(tAbsolute * 0.00015 * sqrt2) * 0.20
// amplitud: ±94.5° pan, ±27° tilt — nube de luz glacial y visible
```

**Períodos:**
- X: `2π / (0.00025 × φ)` ≈ 15,534s (~4.3 horas)  
- Y: `2π / (0.00015 × √2)` ≈ 29,600s (~8.2 horas)

A 4 horas de fiesta el fixture se habrá movido ~82° en pan total.
El movimiento es visible como "nubes de luz" pero jamás perceptible como movimiento.

### Surgery 2 — Acumulador de fase: reloj absoluto
**Archivo:** `VibeMovementManager.ts`

**Antes (WAVE 2209):**
```typescript
if (!isSameFrame) {
  const angularVelocity = config.baseFrequency * (2 * Math.PI) / patternPeriod * phaseMultiplier
  const phaseDelta = frameDeltaTime * angularVelocity
  this.phaseAccumulator += phaseDelta   // acumula jitter de rAF
}
```

**Después (WAVE 2210):**
```typescript
const angularVelocity = config.baseFrequency * (2 * Math.PI) / patternPeriod * phaseMultiplier
this.phaseAccumulator = (Date.now() / 1000) * angularVelocity
// phase = f(tiempo_real) — nunca acumulado, nunca jittered
```

**Propiedades:**
- Jitter de rAF → irrelevante (phase no depende de dt)
- Pausa/reanudación → sin salto (el reloj real continuó)
- Stereo L/R → mismo Date.now() → mismo phase → fixtureIndex maneja offset
- Tests → `vi.spyOn(Date, 'now').mockReturnValue(X)` propaga directamente ✅

### Surgery 3 — Techno physicsMode: 'snap' → 'classic'
**Archivo:** `VibeMovementPresets.ts`

**Antes (WAVE 2088.8):**
```typescript
physicsMode: 'snap',
snapFactor: 0.85,
friction: 0.05,
arrivalThreshold: 0.5,
```

**Después (WAVE 2210):**
```typescript
physicsMode: 'classic',   // inertia mode para trayectorias continuas
snapFactor: 0.0,          // ignorado en classic
friction: 0.08,           // casi sin fricción → personalidad techno agresiva
arrivalThreshold: 1.5,    // no frena en micro-deltas
```

**Por qué classic retiene la personalidad techno:**
- `maxAcceleration: 2000` → arranques brutales desde reposo
- `friction: 0.08` → prácticamente sin amortiguación (libre)
- `maxVelocity: 600` → velocidad techo alta
- `revLimitPanPerSec: 400` → protección de hardware mantenida
- La inercia de classic actúa como low-pass hardware que suaviza la TRAYECTORIA
  sin quitar velocidad pico → el movimiento es rápido Y fluido

---

## Tests actualizados (FixturePhysicsDriver.test.ts)

3 tests del bloque `SNAP vs CLASSIC` actualizados para reflejar WAVE 2210:

1. `"Techno activa SNAP mode"` → `"Techno activa CLASSIC mode con aceleración agresiva (WAVE 2210)"`
   - Verifica que techno se mueve en dirección correcta desde reposo (classic)
   
2. `"El desplazamiento escala linealmente con deltaTime"` 
   - Cambiado de `techno-club` (ahora classic) a `fiesta-latina` (snap)
   - La proporcionalidad lineal es válida solo en snap mode
   
3. `"Rock usa SNAP mode con peso visible (snapFactor < Techno)"`  → `"Rock usa SNAP mode con peso visible (snapFactor < Latino)"`
   - Ahora compara Rock vs Latino (ambos snap) en lugar de Rock vs Techno (techno ya no es snap)

---

## Resultado final

| Métrica | WAVE 2209 | WAVE 2210 |
|---------|-----------|-----------|
| Tests PASS | 127/127 | **127/127** |
| Chill bypass | this.time acumulador | **Date.now() absoluto** |
| Chill amplitud | ±0.8% (invisible) | **±35% (nube glacial)** |
| Phase accumulator | += dt × ω (jitter) | **(Date.now()/1000) × ω** |
| Techno physicsMode | snap (staircase) | **classic (fluido)** |
| Techno friction | 0.05 | **0.08** |
| Techno arrivalThreshold | 0.5 | **1.5** |

---

## Arquitectura post-WAVE 2210

```
Date.now()
    │
    ├─ / 1000 × angularVelocity → phaseAccumulator (absoluto, sin jitter)
    │                                      │
    │                              PATTERNS[name](phase) → rawPosition
    │                                      │
    │                              Gearbox(FROZEN amplitude) → finalAmplitude
    │                                      │
    │                              LERP transitions → MovementIntent {x,y}
    │
    └─ (chill bypass): sin(Date.now()/1000 × φ×0.00025) × 0.35 → {x,y} directo
                        sin(Date.now()/1000 × √2×0.00015) × 0.20

MovementIntent → FixturePhysicsDriver
    │
    ├─ techno/rock/latino: physicsMode='snap' (excepto techno: 'classic')
    │       ↓
    │   WAVE 2210: techno → 'classic', friction=0.08, maxAccel=2000
    │   Result: trayectorias continuas fluidas sin staircase
    │
    └─ chill/idle: physicsMode='classic' (sin cambios)
```
