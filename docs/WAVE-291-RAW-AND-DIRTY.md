# WAVE 291: RAW & DIRTY - Física de Calle para Fiesta Latina

## 📋 RESUMEN EJECUTIVO

**Fecha:** 5 de Enero 2026  
**Operación:** RAW & DIRTY Fix  
**Archivo Modificado:** `electron-app/src/hal/physics/LatinoStereoPhysics.ts`  
**Estado:** ✅ COMPLETADO

---

## 🎯 PROBLEMA DETECTADO

El comportamiento de "Fiesta Latina" era **demasiado académico/suave**:

| Componente | Síntoma | Causa Raíz |
|------------|---------|------------|
| **Movers** | Lentos y agónicos (fantasmas) | LERP 0.03 simétrico + Gate 0.20 |
| **Back PARs** | Tiemblan con micropulsos | Curvas `Math.pow()` + Gate 0.30 |
| **Front PARs** | Tiemblan sin fluidez | Base + pulso directo sin suavizado |
| **Solar Flare** | No salta nunca | Umbrales muy altos (0.65/0.12) |

---

## 🔧 CAMBIOS IMPLEMENTADOS

### 1. CONSTANTES RAW & DIRTY

```typescript
// ── SOLAR FLARE (Más sensible para tracks comprimidos) ──
KICK_THRESHOLD = 0.55;         // ⬇️ Bajado de 0.65
BASS_DELTA_THRESHOLD = 0.08;   // ⬇️ Bajado de 0.12

// ── MOVERS (Ataque Instantáneo / Decay Líquido) ──
MOVER_ATTACK = 0.25;           // 🆕 Sube 25% por frame (4 frames to full)
MOVER_DECAY_FACTOR = 0.96;     // 🆕 Multiplicativo (cae SUAVE)
MOVER_GATE = 0.15;             // ⬇️ Gate más permisivo

// ── BACK PARs (Binary Punch - Sin medias tintas) ──
BACK_PAR_TRIGGER = 0.40;       // 🆕 Umbral de disparo
BACK_PAR_DECAY = 0.20;         // 🆕 Corte RÁPIDO

// ── FRONT PARs (Respiración Estabilizada) ──
FRONT_PAR_SMOOTH = 0.10;       // 🆕 10% LERP anti-temblor
```

### 2. LÓGICA RAW & DIRTY

#### BACK PARs: Binary Punch
```typescript
// ANTES: Curvas elegantes → temblor de Parkinson
const bassGated = bass > GATE ? Math.pow(bass - GATE, 1.3) * 2 : 0;

// AHORA: O GOLPEA o SE APAGA
if (bass > BACK_PAR_TRIGGER) {
  intensity = 1.0;  // GOLPE máximo
} else {
  intensity -= BACK_PAR_DECAY;  // CORTE rápido
}
```

#### MOVERS: Ataque Asimétrico
```typescript
// ANTES: LERP simétrico lento → fantasmas
intensity += (target - intensity) * 0.03;

// AHORA: Despierta RÁPIDO, duerme SUAVE
if (target > current && target > GATE) {
  current += (target - current) * MOVER_ATTACK;  // 25% por frame
} else {
  current *= MOVER_DECAY_FACTOR;  // 0.96 multiplicativo
}
```

#### FRONT PARs: Respiración LERP
```typescript
// ANTES: Base + pulso directo → tiembla
intensity = BASE + bass * MULT;

// AHORA: LERP suave → "respira"
intensity += (bass - intensity) * FRONT_PAR_SMOOTH;
```

---

## 📊 COMPORTAMIENTO ESPERADO

| Componente | Antes | Después |
|------------|-------|---------|
| **Movers** | Fantasmas agónicos (~950ms para 90%) | Despiertan en ~4 frames, duermen suave |
| **Back PARs** | Temblor constante con valores 0.2-0.7 | Binario: 0 o 1.0, golpe limpio |
| **Front PARs** | Sacudidas erráticas | Respiración suave con el bass |
| **Solar Flare** | Casi nunca dispara | Dispara con golpes comprimidos |

---

## 🎵 FILOSOFÍA RAW & DIRTY

> *"La matemática elegante está bien para la academia.*  
> *Esto es la pista. Aquí se viene a sudar."*  
> — PunkOpus

### Principios:
1. **BINARIO > CURVAS**: Las luces de discoteca no necesitan interpolación cuadrática
2. **ATAQUE RÁPIDO**: El cerebro detecta el INICIO del golpe, no el fade
3. **DECAY SUAVE**: El ojo perdona la caída lenta, no la subida lenta
4. **GATE REALISTA**: Los tracks latinos están comprimidos a muerte

---

## ✅ ESTADO FINAL

- [x] Constantes actualizadas
- [x] Lógica BACK PARs: Binary Punch
- [x] Lógica MOVERS: Ataque Asimétrico
- [x] Lógica FRONT PARs: LERP estabilizado
- [x] Solar Flare: Umbrales bajados
- [x] White Puncture: Intacto (ya funcionaba)
- [x] Compilación sin errores

---

## 🚀 PRÓXIMOS PASOS

1. **TEST EN VIVO**: Probar con "Despacito", "La Bicicleta", reggaeton genérico
2. **AJUSTE FINO**: Si sigue suave, bajar BACK_PAR_TRIGGER a 0.35
3. **FEEDBACK**: Reportar si los movers despiertan a tiempo

---

*WAVE 291 - Cuando la academia falla, la calle gobierna.* 🔥
