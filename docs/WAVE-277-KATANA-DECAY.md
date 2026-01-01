# 🗡️ WAVE 277: KATANA DECAY

**Fecha**: 2025-01-XX  
**Misión**: "Queremos que corten el aire como katanas, no que barran como escobas"

---

## 🎯 DIAGNÓSTICO

El usuario reportó:
1. **Back PARs**: Decay lineal (bajan despacio) → Necesitan decay EXPONENCIAL
2. **Movers**: Tienen "suelo" residual (beam persiste) → Necesitan ZERO FLOOR
3. **Canvas**: Cabeza del mover muy pequeña para ver pulso

---

## 🔧 CAMBIOS APLICADOS

### 1. Canvas: Mover Head x1.6
**Archivo**: `src/components/views/SimulateView/StageSimulator2.tsx`

```typescript
// ANTES
baseRadius = type === 'moving' ? 12 : 16
fixtureRadius = baseRadius + intensity * (type === 'moving' ? 8 : 10)
haloRadius = type === 'moving' ? 35 + intensity * 55 : ...
coreRadius = type === 'moving' ? 10 + intensity * 15 : ...
whiteCoreRadius = type === 'moving' ? 4 + intensity * 5 : ...

// DESPUÉS (x1.6)
baseRadius = type === 'moving' ? 19 : 16
fixtureRadius = baseRadius + intensity * (type === 'moving' ? 13 : 10)
haloRadius = type === 'moving' ? 56 + intensity * 88 : ...
coreRadius = type === 'moving' ? 16 + intensity * 24 : ...
whiteCoreRadius = type === 'moving' ? 6 + intensity * 8 : ...
```

### 2. Exponential Decay (la katana)
**Archivo**: `src/hal/physics/PhysicsEngine.ts`

```typescript
// ANTES: Linear Decay (escoba)
dropRate = 0.40 / decaySpeed  // for PAR
dropRate = 0.10 / decaySpeed  // for MOVER
nextValue = current - dropRate

// DESPUÉS: Exponential Decay (katana)
decayFactor = 0.65 + (decaySpeed - 1) * 0.03  // PAR: 0.65 → 0.92
decayFactor = 0.70 + (decaySpeed - 1) * 0.02  // MOVER: 0.70 → 0.88
nextValue = current * decayFactor

// + Noise Gate
if (nextValue < 0.02) nextValue = 0
```

**Por qué exponencial es mejor:**
- Linear: `1.0 → 0.9 → 0.8 → 0.7 → ...` (baja constante, 10 frames a cero)
- Exponential: `1.0 → 0.75 → 0.56 → 0.42 → 0.31 → 0.23 → 0.17 → 0.13 → 0.10 → 0.07 → 0.05 → 0.04 → 0.02 → 0` 
  
Con factor 0.75, en 5 frames ya estás al 24% (casi apagado). Corte rápido al inicio, suavizado al final.

### 3. Zero Floor Policy
**Archivo**: `src/hal/physics/PhysicsEngine.ts`

```typescript
// ANTES: calculateMoverTarget tenía "grace period"
if (moverState) {
  target = 0.10  // ← FLOOR RESIDUAL (el beam persistía)
}

// DESPUÉS: Sin grace, muerte instantánea
// (código eliminado)
```

También añadido noise gate en retorno:
```typescript
const cleanedIntensity = target < 0.05 ? 0 : Math.min(1, target)
```

---

## 📊 COMPORTAMIENTO ESPERADO

### Antes (escoba):
```
Audio:    ████████████░░░░░░░░░░░░░░░░░░
Light:    ████████████████████████░░░░░░  ← arrastra, no corta
```

### Después (katana):
```
Audio:    ████████████░░░░░░░░░░░░░░░░░░
Light:    █████████░░░░░░░░░░░░░░░░░░░░░  ← corte limpio
```

---

## ✅ VERIFICACIÓN

1. **ZoneRouter**: Ya tiene noise gates en 0.05 → OK
2. **SeleneLux**: Solo tiene ceilings (Math.min), no floors → OK
3. **MovementEngine**: Ya tiene `Math.max(0, ...)` sin floor artificial → OK
4. **PhysicsEngine**: Ahora tiene decay exponencial + noise gate 0.02 → FIXED

---

## 🎭 FILOSOFÍA

> "Si la música calla, la luz muere"

No hay floors artificiales. No hay grace periods. No hay "suelo residual".

La luz responde al audio como un katana responde al viento:
- **Ataque**: Instantáneo
- **Decay**: Exponencial (rápido al inicio, suave al final)
- **Zero Floor**: Si el audio baja de 0.02, la luz es CERO

---

**PunkOpus out.** 🗡️
