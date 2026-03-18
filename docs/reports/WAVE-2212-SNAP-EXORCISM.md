# WAVE 2212 — THE SNAP EXORCISM

**Fecha:** 2026-03-14  
**Estado:** COMPLETADO ✅  
**Tests:** 127/127 ✅  
**Archivos modificados:** 4  

---

## Contexto

WAVE 2211 limpió el pipeline downstream (TitanOrchestrator + HAL).  
WAVE 2212 ataca la fuente: los modos de física y la geometría stereo del VMM.

### Síntoma visible pre-WAVE 2212

1. **Staircase effect** en fiesta-latina y pop-rock: el movimiento parecía robótico, fragmentado en escalones, en lugar de curvas fluidas.
2. **Deformación geométrica del snake**: figure8 y circle_big perdían su forma cuando había 2+ fixtures porque el offset se aplicaba rotando el vector XY con `Math.atan2/cos/sin`.
3. **Ciclos demasiado lentos**: fiesta-latina tardaba ~18s por figure8, techno ~8s por scan — lentos para una sala de fiesta.

---

## Cirugía 1: Exterminio Global del Modo SNAP

### Root Cause

`physicsMode: 'snap'` fue diseñado para **targets discretos** (el DJ pincha una posición fija, el mover va a ella rápido). El VMM genera **targets continuos** (sinusoidales): cada frame, el target es un punto diferente en la curva. Con snap, el driver alcanzaba el micro-target del frame actual en <1ms y frenaba en seco → staircase: miles de micro-frenadas por segundo dan un movimiento fragmentado en lugar de una curva.

### Fix aplicado

| Vibe | physicsMode | snapFactor | friction | arrivalThreshold | maxAcceleration |
|------|------------|-----------|---------|-----------------|----------------|
| `fiesta-latina` | `'snap'` → `'classic'` | `0.70` → `0.0` | `0.20` → `0.15` | `2.0` → `1.5` | `1200` → `1500` |
| `pop-rock` | `'snap'` → `'classic'` | `0.65` → `0.0` | `0.30` → `0.20` | `1.0` → `1.5` | `1100` → `1500` |

**Resultado**: Todos los vibes activos son ahora `physicsMode: 'classic'`. El snap está **completamente exorcizado** del sistema de movimiento continuo.

**Archivos:** `src/engine/movement/VibeMovementPresets.ts`

---

## Cirugía 2: Fix Geométrico del Snake — Pre-Phase Injection

### Root Cause (KEA-005 reloaded)

El bloque `else if (stereoConfig.type === 'snake')` aplicaba el offset rotando el **vector posición** en el plano XY:

```typescript
// BUG — Código eliminado:
const mag = Math.sqrt(finalPosition.x² + finalPosition.y²)
const currentAngle = Math.atan2(finalPosition.y, finalPosition.x)
const newAngle = currentAngle + phaseOffset
stereoPosition.x = Math.cos(newAngle) * mag
stereoPosition.y = Math.sin(newAngle) * mag
```

**Propiedad matemática rota**: rotar un punto `{x, y}` alrededor del origen lo mueve en un **círculo**, no a lo largo de la trayectoria original. Un punto de `figure8` en `{0.5, 0.8}` rotado `π/4` va a `{-0.21, 0.94}` — un punto de un **círculo de radio 0.94**, no del figure8. El patrón quedaba deformado.

Este bug también anulaba patrones Y-only (`breath`, `cancan`) que quedaban convertidos en oscilaciones diagonales.

### Fix aplicado

El offset se inyecta **en la fase** (dominio tiempo) ANTES de evaluar `patternFn()`:

```typescript
// NUEVO — Código correcto:
const stereoConfig = STEREO_CONFIG[vibeId] || STEREO_CONFIG['idle']
let patternPhase = phase
if (stereoConfig.type === 'snake' && totalFixtures > 1) {
  patternPhase += fixtureIndex * stereoConfig.offset
}
const rawPosition = patternFn(patternPhase, audio, fixtureIndex, totalFixtures)
```

**Propiedad matemática correcta**: para cualquier función `f(phase)`, `f(phase + offset)` es siempre un punto válido en la misma trayectoria de `f`, desplazado en el tiempo. El figure8 de fixture R es el mismo figure8 de L, 45° de fase más adelante → **ola de caderas perfecta**.

### Cleanup: fixtureOffset interno eliminado

Los patrones `scan_x`, `circle_big`, `cancan` tenían su propio `fixtureOffset` interno que sumaban a la fase. Con el nuevo sistema de inyección externa, este doble-offset cancela la geometría. Eliminados:

| Patrón | Código eliminado |
|--------|----------------|
| `scan_x` | `const fixtureOffset = (index / max(total, 1)) * π * 0.5` |
| `circle_big` | `const fixtureOffset = (index / max(total, 1)) * π * 2` |
| `cancan` | `const fixtureOffset = (index / max(total, 1)) * π` |

**Nota**: `ballyhoo` mantiene su `fixtureOffset` pero no afecta al eje de fase — modula amplitud (`x * (0.85 + offset * 0.3)`), no offset temporal. Sin conflicto.

**Archivos:** `src/engine/movement/VibeMovementManager.ts`

---

## Cirugía 3: Multiplicadores de Fase — La Fiesta Se Acelera

### Diagnóstico

Con `phaseMultiplier` anteriores, los ciclos eran demasiado lentos para mostrar de club:
- fiesta-latina figure8: ~18s por ciclo completo → lento, casi imperceptible
- techno scan: ~8s → profesional pero mejorable
- pop-rock circle: ~16s → estadio lento

### Fix aplicado

```typescript
// ANTES:
VIBE_PHASE_MULTIPLIER = { 'techno-club': 8, 'fiesta-latina': 6, 'pop-rock': 5 }

// AHORA:
VIBE_PHASE_MULTIPLIER = { 'techno-club': 12, 'fiesta-latina': 12, 'pop-rock': 8 }
```

| Vibe | Multiplier | Ciclo antes | Ciclo ahora |
|------|-----------|------------|------------|
| `techno-club` | 8 → 12 | ~8s scan | ~5.3s scan |
| `fiesta-latina` | 6 → 12 | ~18s figure8 | ~9s figure8 |
| `pop-rock` | 5 → 8 | ~16s circle | ~10s circle |

**Archivos:** `src/engine/movement/VibeMovementManager.ts`

---

## Tests actualizados

Los tests que asertaban `physicsMode: 'snap'` para fiesta-latina y pop-rock fueron actualizados para reflejar la nueva realidad:

| Test | Cambio |
|------|--------|
| `El desplazamiento escala linealmente con deltaTime` | Reescrito para verificar comportamiento classic (aceleración creciente desde reposo) |
| `Latino usa SNAP mode` | Renombrado y reescrito: "Latino usa CLASSIC mode (WAVE 2212: SNAP EXORCISM)" |
| `Rock usa SNAP mode` | Renombrado y reescrito: "Rock usa CLASSIC mode con arcos dramáticos" |
| `Latino snake: L and R have different positions` | Warmup aumentado de 300 → 420 frames para evitar caer en el frame exacto de inicio de transición de patrón (t=30s) donde el LERP está en t=0 y devuelve `this.lastPosition` para ambos fixtures |

---

## Estado del sistema post-WAVE 2212

```
Vibe          physicsMode   snake      multiplier
──────────────────────────────────────────────────
techno-club   classic ✅    mirror     12 ↑
fiesta-latina classic ✅    snake(π/4) 12 ↑↑
pop-rock      classic ✅    snake(π/3) 8  ↑
chill-lounge  classic ✅    snake(π/2) 1  (sin cambio)
idle          classic ✅    sync       5  (sin cambio)
```

**Tests:** 127/127 ✅  
**Errores de compilación:** 0  
**Math.random() en producción:** 0 (Axioma Anti-Simulación respetado)  
