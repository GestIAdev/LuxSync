# 🎵 WAVE 279.5: HEART vs SLAP
## Filosofía de Zonas & Back Par Resurrection

**Fecha:** 1 Enero 2026  
**Status:** ✅ IMPLEMENTED  
**Focus:** Back PAR intensity dynamics, zone philosophy  

---

## 📋 Problema Original (WAVE 279)

En Cyberpunk y Boris Brejcha, los **Back Pars** estaban completamente **MUERTOS**:
- Log AGC TRUST: `Back:0.00` constantemente
- Audio: mid=0.25-0.30, pero Back Pars no reaccionaban
- Razón: Fórmula mid³ × 1.5 aplastaba audio normalizado

### Síntomas:
```
[AGC TRUST] IN[0.75, 0.25, 0.03] -> OUT[Front:0.67, Back:0.00, Mover:0.00]
```

---

## 🔍 Diagnóstico: DOS PIPELINES PARALELOS

Se descubrió que LuxSync tenía **TWO PARALLEL COMPUTATION PIPELINES**:

### 1. **SeleneLux.ts** (Cálculo + Log)
- Ubicación: `src/core/reactivity/SeleneLux.ts`
- Propósito: Métricas internas de TitanEngine
- Output: Logs `[AGC TRUST]`
- ¿Controla luces? **❌ NO**

**Fórmula WAVE 278 (problemática):**
```typescript
const backRaw = Math.pow(mid, 3.0) * 1.5;
// mid=0.25: 0.015 × 1.5 = 0.023 ≈ 0.00 (invisible)
```

### 2. **ZoneRouter.ts** (vía HAL) (Render Real)
- Ubicación: `src/hal/mapping/ZoneRouter.ts`
- Propósito: Cálculo real para DMX
- Output: Intensidad a fixtures
- ¿Controla luces? **✅ SÍ**

**Fórmula WAVE 256.5 (vieja):**
```typescript
if (midSignal > preset.backParGate) {  // gate = 0.05
  let intensity = (midSignal - 0.05) * 4.0;  // gain = 4.0
}
// mid=0.30: (0.30 - 0.05) × 4.0 = 1.0 → saturado a 0.95
```

---

## 🔥 WAVE 279.3: ZOMBIE STEROIDS (SeleneLux)

**Cambio:** Fórmula mid^1.5 × 1.8 (más lineal, más boost)

```typescript
// ANTES (cúbica - aplasta):
const backRaw = Math.pow(mid, 3.0) * 1.5;
// mid=0.25: 0.023 → INVISIBLE
// mid=0.40: 0.11 → MUERTO

// AHORA (1.5 potencia - viva):
const backRaw = Math.pow(mid, 1.5) * 1.8;
const backGateThreshold = isTechno ? 0.10 : 0.06;
const backGated = backRaw < backGateThreshold ? 0 : backRaw;

// mid=0.25: 0.125 × 1.8 = 0.225 → ¡VIVE!
// mid=0.40: 0.253 × 1.8 = 0.456 → ¡RUGE!
// mid=0.55: 0.407 × 1.8 = 0.732 → ¡EXPLOTA!
```

**Resultado:** Back Pars resucitan en el log AGC TRUST.

---

## 🎯 WAVE 279.4: DUAL PIPELINE DEBUG

Se añadió logging diagnóstico a ZoneRouter para ver qué estaba pasando:

```typescript
private debugCounter = 0;

if (this.debugCounter++ % 60 === 0 && rawIntensity > 0) {
  console.log(`[HAL BACK_PARS] mid=${midSignal.toFixed(2)} gate=${preset.backParGate} → intensity=${rawIntensity.toFixed(2)}`)
}
```

**Resultado de Cyberpunk log:**
```
[HAL BACK_PARS] mid=0.30 gate=0.05 → intensity=0.95
[HAL BACK_PARS] mid=0.49 gate=0.05 → intensity=0.95
[HAL BACK_PARS] mid=0.53 gate=0.05 → intensity=0.95
[HAL BACK_PARS] mid=0.62 gate=0.05 → intensity=0.95
```

**Descubrimiento:** Back Pars ESTABAN VIVOS, pero **SATURABAN CONSTANTEMENTE A 0.95**

### Problema:
- Gate muy bajo (0.05)
- Gain muy alto (4.0)
- Resultado: mid=0.30 ya satura

---

## 👋 WAVE 279.5: HEART vs SLAP

**Filosofía de Zonas:**

### Front Pars = 💓 CORAZÓN
- Sonido: Bass/Kick
- Metáfora: `bom bom bom` - presión en el pecho
- Comportamiento: Envolvente, constante, no agresivo
- Max: 0.95 (mantiene presión, no explota)

### Back Pars = 👋 BOFETADA
- Sonido: Mid/Snare
- Metáfora: `PAF!` - golpe seco (como la mano de mamá hace 40 años 😂)
- Comportamiento: Explosivo, transiente, ataca rápido
- Max: **1.0** (¡¡IMPACTO COMPLETO!!)

### Implementación - Nuevos Parámetros:

**Archivo:** `src/hal/HardwareAbstraction.ts`

```typescript
private currentPreset: VibeRouteConfig = {
  parGate: 0.08,           // Heart: responde a bass ligero
  parGain: 3.5,            // Heart: amplificación moderada
  parMax: 0.95,            // Heart: techo limitado (presión, no golpe)
  
  backParGate: 0.15,       // ← SUBIDO de 0.05 (ignora ruido)
  backParGain: 2.8,        // ← BAJADO de 4.0 (rango dinámico)
  backParMax: 1.0,         // ← SUBE a 1.0 (¡PAF! completo)
  
  melodyThreshold: 0.10,   // Movers: activan fácil
  decaySpeed: 2,
  moverDecaySpeed: 3,
};
```

### Rango Dinámico Resultante:

```
Back PAR Intensity = (mid - 0.15) × 2.8, max 1.0

mid=0.15: 0 → GATE (silencio)
mid=0.20: 0.14 → casi nada
mid=0.30: 0.42 → visible, ligero
mid=0.40: 0.70 → fuerte
mid=0.50: 0.98 → ¡casi PAF!
mid=0.55: 1.0 → ¡¡PAF COMPLETO!!
```

---

## 📊 Comparativa: Antes vs Después

| Aspecto | WAVE 279 (Muerto) | WAVE 279.3 (Vivo) | WAVE 279.5 (Dinámico) |
|---------|-------------------|------------------|----------------------|
| **Formula** | mid³ × 1.5 | mid^1.5 × 1.8 | (mid-0.15) × 2.8 |
| **mid=0.25** | 0.02 ❌ | 0.23 ✅ | 0.28 ✅ |
| **mid=0.40** | 0.11 ❌ | 0.46 ✅ | 0.70 ✅ |
| **mid=0.55** | 0.23 ❌ | 0.73 ✅ | 1.0 ✅✅ |
| **Saturación** | N/A | No | Dinámica (rango 0-1) |
| **Rango Visual** | Muerto | Limitado | **COMPLETO** |

---

## 🧪 Test Results: Cyberpunk

### Antes de WAVE 279.5:
```
[HAL BACK_PARS] mid=0.30 gate=0.05 → intensity=0.95  (SATURADO)
[HAL BACK_PARS] mid=0.49 gate=0.05 → intensity=0.95  (SATURADO)
[HAL BACK_PARS] mid=0.53 gate=0.05 → intensity=0.95  (SATURADO)
```
❌ Saturación constante, sin rango dinámico

### Después de WAVE 279.5:
```
Esperado:
[HAL BACK_PARS] mid=0.30 gate=0.15 → intensity=0.42  (moderado)
[HAL BACK_PARS] mid=0.49 gate=0.15 → intensity=0.95  (fuerte)
[HAL BACK_PARS] mid=0.55 gate=0.15 → intensity=1.0   (¡PAF!)
```
✅ Rango dinámico, peaks explosivos sin saturación constante

---

## 🎬 Ejecución

### Archivos Modificados:

1. **`src/core/reactivity/SeleneLux.ts`**
   - Cambio: mid³ × 1.5 → mid^1.5 × 1.8
   - Líneas: ~324-331
   - Propósito: Fix formula, más lineal

2. **`src/hal/HardwareAbstraction.ts`**
   - Cambio: backParGate 0.05→0.15, backParGain 4.0→2.8, backParMax 0.95→1.0
   - Líneas: ~90-102
   - Propósito: Rango dinámico sin saturación

3. **`src/hal/mapping/ZoneRouter.ts`** (debug log - no en versión final)
   - Cambio: Añadir debugCounter y log
   - Propósito: Diagnosticar pipeline

---

## 🎵 Filosofía Final

```
              BASS (Front Pars)          MID/SNARE (Back Pars)
              
Ritmo:        bom...bom...bom            PAF! [pausa] PAF!
Sensación:    Presión en pecho           Golpe en cara
Visión:       Envolvente, difuso         Explosiva, puntual
Decay:        Suave, sostenido           Rápido, transiente
Max:          0.95 (presión)             1.0 (impacto)

Metáfora:     💓 Corazón                 👋 Bofetada de mamá
```

---

## ✅ Checklist de Implementación

- [x] Diagnosticar dual pipeline issue
- [x] Fix SeleneLux formula (mid^1.5 × 1.8)
- [x] Add debug logging a ZoneRouter
- [x] Analyse Cyberpunk log saturation
- [x] Reduce backParGain (4.0 → 2.8)
- [x] Raise backParGate (0.05 → 0.15) 
- [x] Maximize backParMax (0.95 → 1.0)
- [x] Document philosophy: Heart vs Slap
- [x] Create final report

---

## 📈 Next Steps

1. **Test en vivo con Cyberpunk** - verificar rango dinámico
2. **Test con Boris Brejcha** - verificar transientes limpios
3. **Fine-tune decay** - si es necesario ajustar velocidad
4. **Consider Front Par adjustment** - mantener balance Heart/Slap

---

**Autor:** PunkOpus / GitHub Copilot  
**Filosofía:** Perfection First - Código limpio, elegante, eficiente  
**Estado:** Ready for Testing 🚀
