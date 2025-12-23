# 🎛️ WAVE 67.5 - INERTIA, CLAMP & DIP

**Fecha**: 2025-12-22  
**Estado**: ✅ COMPLETADO

---

## 📋 PROBLEMA DETECTADO

La música latina tiene una **energía promedio muy alta y constante** (0.5-0.6), lo que causa:
1. **Falsos Drops** - El promedio suavizado decae demasiado rápido entre beats
2. **Temperatura ignora perfil** - Se producen 5800K+ cuando el límite es 4500K
3. **Arcoíris sucio** - Las transiciones largas muestran todos los colores intermedios

---

## 🔧 CAMBIOS IMPLEMENTADOS

### 1. 📉 ENERGY INERTIA (EnergyStabilizer.ts) ✅

#### A. EMA Factor más perezoso

```typescript
// ANTES
emaFactor: 0.95,  // 95% histórico, 5% nuevo

// DESPUÉS (WAVE 67.5)
emaFactor: 0.98,  // 98% histórico, 2% nuevo
```

**Impacto**: El EMA ahora representa la energía de la **SECCIÓN**, no del compás.
- Antes: 5% de influencia del frame actual → muy reactivo
- Ahora: 2% de influencia → más "perezoso", ignora variaciones entre beats

#### B. DROP requiere energía absoluta > 0.85

```typescript
// ANTES (WAVE 66.8)
const isRelativeDrop = energy > (this.emaEnergy + DROP_RELATIVE_THRESHOLD) && energy > 0.6;

// DESPUÉS (WAVE 67.5)
const DROP_ABSOLUTE_MINIMUM = 0.85;
const isRelativeDrop = energy > (this.emaEnergy + DROP_RELATIVE_THRESHOLD) && energy > DROP_ABSOLUTE_MINIMUM;
```

**Impacto**: 
- ✅ **DROP requiere energía absoluta > 0.85** - CONFIRMADO
- Si la canción no rompe el techo (0.85+), no es un Drop, es un Chorus intenso
- Elimina falsos drops en música latina de alta energía constante

---

### 2. 🌡️ TEMP HARD CLAMP (SeleneColorEngine.ts) ✅

```typescript
// 🔥 WAVE 67.5: HARD CLAMP DE TEMPERATURA PARA LATINO
const isLatinMacro = macroId === 'LATIN_ORGANIC' || macroId.includes('LATIN');
if (isLatinMacro && temperature !== 'warm') {
  temperature = 'warm';
  // Ajustar hue hacia cálido si está en zona fría (180-300)
  if (primary.h >= 180 && primary.h < 300) {
    primary.h = 30 + ((primary.h - 180) / 120) * 30;  // → 30-60 (naranjas)
  }
}
```

**Impacto**:
- ✅ **Hard Clamp de temperatura implementado** - CONFIRMADO
- Latino SIEMPRE tiene temperatura 'warm' (nunca 'cool' o 'neutral')
- Hues fríos (cyan/azul/púrpura) se rotan a naranjas cálidos
- La restricción del Vibe tiene prioridad absoluta sobre la armonía musical

---

### 3. 🎨 DESATURATION DIP (SeleneColorInterpolator) ✅

```typescript
// 🔥 WAVE 67.5: DESATURATION DIP
const absHueDiff = Math.abs(hueDiff);
if (absHueDiff > 60) {
  // Curva gaussiana centrada en t=0.5
  const dipCenter = 0.5;
  const dipWidth = 0.25;
  const distanceFromCenter = Math.abs(t - dipCenter);
  
  if (distanceFromCenter < dipWidth) {
    // Saturación mínima: 30% de la original en el centro
    const dipStrength = 0.3;
    const normalizedDist = distanceFromCenter / dipWidth;
    const dipFactor = dipStrength + (1 - dipStrength) * (normalizedDist * normalizedDist);
    s = s * dipFactor;
  }
}
```

**Impacto**:
- Si diferencia de Hue > 60°, se aplica "lavado" en el punto medio
- t = 0.0: Color A (100% saturación)
- t = 0.5: Lavado (30% saturación) - blanco/gris
- t = 1.0: Color B (100% saturación)
- Evita ver "todos los colores intermedios" (arcoíris sucio)

---

## 📊 RESUMEN DE PARÁMETROS

| Parámetro | Antes | Después | Efecto |
|-----------|-------|---------|--------|
| `emaFactor` | 0.95 | **0.98** | EMA más lento (sección, no compás) |
| `DROP_ABSOLUTE_MINIMUM` | 0.6 | **0.85** | Solo picos reales son DROP |
| Latino temp | Calculada | **'warm' FORZADO** | Nunca frío en Latino |
| Latino hue frío | Sin clamp | **→ 30-60°** | Rotar a naranjas |
| Transición hue > 60° | Lineal | **Desaturation Dip** | Lavado en t=0.5 |

---

## 🎯 RESULTADO ESPERADO

1. **DROP es EXCEPCIONAL**: Solo picos > 0.85 y > 40% sobre EMA
2. **EMA representa SECCIÓN**: No reacciona a cada beat
3. **Latino SIEMPRE cálido**: Hard clamp garantiza 'warm' + hues naranjas
4. **Transiciones ELEGANTES**: Lavado blanco/gris en cruces de hue grandes

---

## 🧪 CÓMO VERIFICAR

```
Reproducir Cumbia/Reggaeton de alta energía constante:
- ❌ NO debe verse "Drop" constante
- ❌ NO debe verse temperatura "cool" en Latino
- ❌ NO debe verse arcoíris sucio en transiciones
- ✅ SÍ transiciones con "lavado" suave al cruzar colores distantes
- ✅ SÍ temperatura siempre cálida (naranjas/rojos) en Latino
```

---

## 📁 ARCHIVOS MODIFICADOS

1. `src/main/selene-lux-core/engines/visual/EnergyStabilizer.ts`
   - `emaFactor`: 0.95 → 0.98
   - `DROP_ABSOLUTE_MINIMUM`: 0.6 → 0.85

2. `src/main/selene-lux-core/engines/visual/SeleneColorEngine.ts`
   - Hard Clamp de temperatura para macro Latino
   - Desaturation Dip en `lerpHSL()` para hue diff > 60°

---

## ✅ CONFIRMACIONES OBLIGATORIAS

- ✅ **Hard Clamp de temperatura implementado**: Latino SIEMPRE 'warm', hues fríos rotados
- ✅ **Drop requiere energía absoluta > 0.85**: Solo picos reales disparan DROP

---

**WAVE 67.5 COMPLETE** 🎉
