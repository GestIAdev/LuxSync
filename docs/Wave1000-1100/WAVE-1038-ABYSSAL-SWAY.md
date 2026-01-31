# 🌊 WAVE 1038: THE ABYSSAL SWAY - La Marea Viva

**Fecha:** 2025-01-29
**Status:** ✅ COMPLETE
**Objetivo:** Reemplazar movimiento lineal (ascensor) por bamboleo lateral serpentino

---

## 📋 RESUMEN EJECUTIVO

WAVE 1038 transforma completamente la física de ChillLounge:

**ANTES (WAVE 1034):** Movimiento vertical lineal (Front → Back → Mover)
**AHORA (WAVE 1038):** Bamboleo lateral con desfase de fase (The Serpentine Sine)

---

## 🐍 THE SERPENTINE SINE - El Corazón del Sistema

### El Problema
El sistema anterior era un **ASCENSOR**: predecible, mecánico, lineal.
La luz subía de Front a Back a Movers. Siempre igual.

### La Solución: Phase Shifting
Tres osciladores acoplados con **desfase temporal**:

```
FRONT: sin(t)              → Fase 0°
BACK:  sin(t - π/2)        → Fase 90° (retardo de ~1s)  
MOVER: sin(t - π)          → Fase 180° (opuesto al Front)
```

### Resultado Visual
```
Tiempo T=0:
  FrontL ████████  FrontR ░░░░░░░░
  BackL  ████░░░░  BackR  ░░░░████
  MoverL ░░░░░░░░  MoverR ████████

Tiempo T=1 (cuarto de ciclo):
  FrontL ████░░░░  FrontR ░░░░████
  BackL  ████████  BackR  ░░░░░░░░
  MoverL ░░░░████  MoverR ████░░░░

→ Una "S" de luz serpenteando por la sala
```

---

## 💧 VISCOSIDAD HIDRÁULICA - Reactividad Musical

La música controla la **DENSIDAD DEL AGUA**:

| Estado | Viscosidad | Velocidad Sway | Sensación |
|--------|-----------|----------------|-----------|
| Sin música | Miel (0.80) | 0.0008 (~130s ciclo) | Slow motion profundo |
| Música suave | Agua ligera (0.65) | 0.002 (~50s ciclo) | Meditativo |
| Música rítmica | Agua (0.55) | 0.006 (~17s ciclo) | Respira con el beat |

### Fórmula
```typescript
speedFactor = BASE_SPEED + (energy * ENERGY_MULTIPLIER)
// Con smooth transition (no saltos bruscos):
currentSpeed = currentSpeed * 0.98 + targetSpeed * 0.02
```

---

## ✨ SPARKLE TEXTURE - Micro-brillos

Cuando el audio tiene **frecuencias altas** ("air" > 0.1):
- Añade micro-destellos a las zonas oscuras
- Como luz del sol rompiendo en la superficie del agua
- Solo activo en texturas `clean`, NO en `warm`

```typescript
if (air > SPARKLE_THRESHOLD && texture !== 'warm') {
  sparkle = sin(frame * 0.07) * 0.12 * airExcess
}
```

---

## 🫧 INTEGRACIÓN CON BUBBLES

Las burbujas del WAVE 1034 ahora **SURFEAN LA OLA**:

- Cuando `currentBalance < 0` (ola hacia izquierda):
  - Burbuja viaja por el lado izquierdo
  - MoverL recibe más energía del pop

- Cuando `currentBalance > 0` (ola hacia derecha):
  - Burbuja viaja por el lado derecho
  - MoverR recibe más energía del pop

```typescript
if (currentBalance < 0) {
  result.moverL += contrib * (1 + Math.abs(currentBalance) * 0.5)
  result.moverR += contrib * 0.3
}
```

---

## 📊 ARQUITECTURA DE CONSTANTES

### Velocidades
```typescript
SWAY_BASE_SPEED = 0.0008        // Muy lento sin música
SWAY_ENERGY_MULTIPLIER = 0.003  // Reactivo a energía
SWAY_MAX_SPEED = 0.006          // Cap máximo
```

### Desfases
```typescript
PHASE_OFFSET_BACK = π/2   // 90° = ~1s delay
PHASE_OFFSET_MOVER = π    // 180° = opuesto
```

### Profundidad de Sway
```typescript
SWAY_DEPTH_FRONT = 0.70   // 70% swing L↔R
SWAY_DEPTH_BACK = 0.55    // 55% (más ambient)
SWAY_DEPTH_MOVER = 0.85   // 85% (más dramático)
```

---

## 🔧 API - swayState

El resultado ahora incluye estado del sway para debugging:

```typescript
swayState: {
  speedFactor: number,    // Velocidad actual
  swayPhase: number,      // Fase del oscilador (0 - 2π)
  balanceFront: number,   // -1 (izq) a +1 (der)
  balanceBack: number,    // Desfasado 90°
  balanceMover: number    // Desfasado 180°
}
```

---

## 🎯 COMPARACIÓN ANTES/DESPUÉS

| Aspecto | WAVE 1034 | WAVE 1038 |
|---------|-----------|-----------|
| Movimiento | Vertical (ascensor) | Lateral (serpiente) |
| Previsibilidad | Alta | Baja (desfases) |
| Reactividad | Fija | Variable (viscosidad) |
| Estereo | Burbujas en carriles | Sway + burbujas surfeando |
| Sensación | Mecánico | Orgánico, como algas |

---

## 🧪 TESTING

### Test 1: Sin Música
1. Abrir simulador con Chill Lounge
2. Sin audio
3. **Expected:** Bamboleo muy lento (~130s ciclo completo)

### Test 2: Con Música Suave
1. Poner ambient/lofi
2. **Expected:** Ciclo más rápido (~50s), sigue el mood

### Test 3: Con Música Rítmica
1. Poner deep house con kick
2. **Expected:** Ciclo ~17s, burbujas surfeando la ola

### Test 4: Verificar Desfases
1. Mirar FL/FR/BL/BR/ML/MR en consola
2. **Expected:** Cuando FL máximo, BR debería estar subiendo, MR bajando

---

## 📝 ARCHIVOS MODIFICADOS

- `src/hal/physics/ChillStereoPhysics.ts` - **REESCRITO COMPLETO**
  - Nuevo sistema de sway con phase shifting
  - Viscosidad hidráulica reactiva
  - Sparkle texture para air frequencies
  - Bubbles integrados con sway

---

**PunkOpus** 🎸 *"Ya no es un ascensor. Es una serpiente de luz bailando en la oscuridad."*
