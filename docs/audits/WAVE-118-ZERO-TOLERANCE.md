# 🎯 WAVE 118: Zero Tolerance - La Guillotina Universal

**Fecha**: $(date)
**Estado**: ✅ IMPLEMENTADO
**Problema**: 12% Fantasma en Movers

---

## 📊 DIAGNÓSTICO DEL USUARIO

```
El problema del 12% fantasma:
- Noise floor: ~0.07 pulse
- Gate: 0.05 → PASA (0.07 > 0.05)
- Residual: 0.07 - 0.05 = 0.02
- Gain: x6 → 0.02 * 6.0 = 0.12 (12%)
- Clipper threshold: 0.12 → APENAS PASA!
```

---

## 🔍 HALLAZGO CRÍTICO

**¡LOS MOVERS NO TENÍAN SOFT KNEE CLIPPER!**

### Antes de WAVE 118:

| Zona | applySoftKneeClipper | Resultado |
|------|---------------------|-----------|
| FRONT_PARS | ✅ Sí | 12% → 0% |
| BACK_PARS | ✅ Sí | 12% → 0% |
| MOVING_LEFT | ❌ **NO** | 12% → **12% FANTASMA** |
| MOVING_RIGHT | ❌ **NO** | 12% → **12% FANTASMA** |

### Después de WAVE 118:

| Zona | applySoftKneeClipper | Resultado |
|------|---------------------|-----------|
| FRONT_PARS | ✅ Sí | 12% → 0% |
| BACK_PARS | ✅ Sí | 12% → 0% |
| MOVING_LEFT | ✅ **AÑADIDO** | 12% → **0%** |
| MOVING_RIGHT | ✅ **AÑADIDO** | 12% → **0%** |

---

## 🔧 CAMBIOS IMPLEMENTADOS

### 1. Threshold aumentado (techno-club)

```typescript
// ANTES (main.ts línea ~504)
hardClipThreshold: 0.12

// DESPUÉS
hardClipThreshold: 0.15 // WAVE 118: Margen de seguridad
```

### 2. Clipper añadido a MOVING_LEFT (~línea 1140)

```typescript
// WAVE 115→117.1: BASS DOMINANCE GATE
if (currentVibePreset === 'techno-club' && rawMid < rawBass * 0.5) {
  targetMover = 0;
}

// 🎛️ WAVE 118: ZERO TOLERANCE CLIPPER PARA MOVERS ← NUEVO
// HALLAZGO: Los movers NO tenían softKneeClipper → 12% fantasma pasaba
targetMover = applySoftKneeClipper(targetMover);

// 🎛️ WAVE 117.2: MOVER BLACKOUT RÁPIDO
```

### 3. Clipper añadido a MOVING_RIGHT (~línea 1200)

```typescript
// WAVE 115→117.1: BASS DOMINANCE GATE (Stereo Mirror)
if (currentVibePreset === 'techno-club' && rawMid < rawBass * 0.5) {
  targetMover = 0;
}

// 🎛️ WAVE 118: ZERO TOLERANCE CLIPPER PARA MOVERS (Stereo Mirror) ← NUEVO
targetMover = applySoftKneeClipper(targetMover);

// 🎛️ WAVE 117.2: MOVER BLACKOUT RÁPIDO (Stereo Mirror)
```

---

## 🧮 MATEMÁTICAS DE LA SOLUCIÓN

### Pipeline de señal ANTES (Movers):
```
rawMid (0.07) 
→ Gate 0.05 (PASA: 0.07 > 0.05)
→ cleanSignal = (0.07-0.05)/(1-0.05) = 0.02
→ Gain x6 = 0.12
→ NO HAY CLIPPER
→ intensity = 0.12 (12% VISIBLE!)
```

### Pipeline de señal DESPUÉS (Movers):
```
rawMid (0.07) 
→ Gate 0.05 (PASA: 0.07 > 0.05)
→ cleanSignal = 0.02
→ Gain x6 = 0.12
→ CLIPPER threshold 0.15 (0.12 < 0.15)
→ softKneeClip(0.12, 0.15) = 0 ← CORTADO!
→ intensity = 0 (NEGRO TOTAL!)
```

---

## 📈 RESULTADO ESPERADO

| Métrica | Antes | Después |
|---------|-------|---------|
| Movers en silencio | 12% iluminados | 0% (negro) |
| Tiempo de apagado | Variable | Instantáneo |
| Acoplamiento zonas | Parcial | ELIMINADO |

---

## 🎵 COMPORTAMIENTO POR ESCENARIO

### DROP (Kick + Bass):
- Pars: 🔥 Reactivos a kick
- Movers: ⚫ NEGRO (bass domina, clipper corta residual)

### BREAKDOWN (Melody + Pads):
- Pars: 💤 Mínimos/Off
- Movers: 💡 Reactivos a melodía (señal > 0.15 threshold)

### BUILDUP (Todo crece):
- Pars: 📈 Subiendo con bass
- Movers: 📈 Subiendo con melody (independiente)

---

## ✅ VALIDACIÓN

Para confirmar el fix:
1. Log esperado: `[MOVER_CLIP] targetMover: 0.12 → clipped: 0`
2. Movers deben estar NEGRO durante kicks sin melodía
3. Movers deben encender SOLO cuando hay melodía real (> 0.15)

---

## 📋 RESUMEN EJECUTIVO

**Problema**: El 12% fantasma provenía de noise floor que pasaba el gate pero quedaba amplificado por el gain.

**Causa raíz**: Los movers NO tenían `applySoftKneeClipper()` aplicado (los pars sí lo tenían).

**Solución**: 
1. Añadir clipper a MOVING_LEFT y MOVING_RIGHT
2. Aumentar threshold de 0.12 a 0.15 (margen de seguridad)

**Resultado**: Guillotina universal que corta cualquier señal < 15%, eliminando el fantasma.
