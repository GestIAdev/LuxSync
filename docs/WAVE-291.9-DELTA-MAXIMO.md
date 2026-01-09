# WAVE 291.9 - DELTA MÁXIMO

> **Fecha**: 5 Enero 2026  
> **Vibe**: Fiesta Latina  
> **Objetivo**: Máximo contraste, histéresis real, cero ghosting

---

## 🔬 DIAGNÓSTICO DE LOGS

### **LOG 1 - Remix Latino Normal**
```
Mid ~0.40-0.55 → Back: MUCHOS 0.00, pocos 0.16-0.45
Movers: 0.51 → 0.51 → 0.50 (decay LENTÍSIMO)
```

### **LOG 2 - Voces**
```
Mid ~0.38-0.56 → Back oscila entre 0 y saturación
Front: 0.54 → 0.51 → 0.67 → 0.59 (NUNCA llega a 0)
```

---

## 🎯 PROBLEMAS IDENTIFICADOS

| Fixture | Problema | Causa Raíz |
|---------|----------|------------|
| **Movers** | Decay lento, beats se pisan | `DECAY_FACTOR=0.80` muy conservador |
| **Back PARs** | Invisibles la mayoría del tiempo | `GATE=0.38` demasiado alto |
| **Front PARs** | Vibran al decaer, nunca llegan a 0 | Sin histéresis real, sin floor |

---

## 🔥 SOLUCIÓN WAVE 291.9

### **MOVERS - Decay Instantáneo**
```typescript
// ANTES (WAVE 291.8)
MOVER_ATTACK = 0.50;
MOVER_DECAY_FACTOR = 0.80;  // Muy lento!
MOVER_GATE = 0.35;
MOVER_GAIN = 1.15;

// AHORA (WAVE 291.9)
MOVER_ATTACK = 0.65;        // +30% más agresivo
MOVER_DECAY_FACTOR = 0.40;  // 🔥 INSTANTÁNEO (cae 60% por frame!)
MOVER_GATE = 0.32;          // Un poco más bajo
MOVER_GAIN = 1.20;          // 20% ganancia
```

### **BACK PARs - Gate Bajo + Ganancia Alta**
```typescript
// ANTES (WAVE 291.8)
BACK_PAR_GATE = 0.38;       // Demasiado alto!
BACK_PAR_GAIN = 2.0;

// AHORA (WAVE 291.9)
BACK_PAR_GATE = 0.28;       // 🔥 MUCHO más bajo
BACK_PAR_ATTACK = 0.70;     // Ataque brutal
BACK_PAR_DECAY = 0.12;      // Decay rápido
BACK_PAR_GAIN = 2.5;        // 2.5x ganancia
```

**Matemática**: Con `mid=0.40`:
- ANTES: `(0.40 - 0.38) / 0.62 * 2.0 = 0.06` → INVISIBLE
- AHORA: `(0.40 - 0.28) / 0.72 * 2.5 = 0.42` → VISIBLE! ✅

### **FRONT PARs - Histéresis Real**
```typescript
// ANTES (WAVE 291.8)
FRONT_PAR_NOISE_GATE = 0.04;  // No funcionaba en decay

// AHORA (WAVE 291.9)
FRONT_PAR_HYSTERESIS = 0.06;  // 6% histéresis (solo en decay)
FRONT_PAR_FLOOR = 0.0;        // SÍ se apagan!
FRONT_PAR_ATTACK = 0.60;      // Más agresivo
FRONT_PAR_DECAY = 0.25;       // Más suave
```

**Lógica**:
```typescript
if (frontDelta > 0) {
  // SUBIDA: Siempre responder (sin histéresis)
  intensity += delta * ATTACK;
} else if (Math.abs(frontDelta) > HYSTERESIS) {
  // BAJADA: Solo si cambio > 6%
  intensity += delta * DECAY;
}
// Decay acelerado cuando bass < 8%
if (frontTarget < 0.08) {
  intensity *= 0.85;
}
```

---

## 📊 CAMBIOS ESPERADOS

| Fixture | Antes | Ahora |
|---------|-------|-------|
| **Movers** | Decay lento, se pisan beats | Decay instantáneo, máximo contraste |
| **Back PARs** | 0.00-0.10 (invisibles) | 0.20-0.50+ (visibles!) |
| **Front PARs** | Vibran en decay, ~20% floor | Estables, llegan a 0 |

---

## 🎵 FILOSOFÍA

> **"Máximo Delta = Máxima Vida"**

El latino es CONTRASTE. Es el "pom" y el silencio. Es la voz que ENTRA y SALE.
No queremos smooth. Queremos PUNCH. Queremos DELTA.

- **Movers**: La voz entra FUERTE, sale RÁPIDO
- **Back PARs**: El ritmo se VE, no es fantasma
- **Front PARs**: El corazón late, pero cuando para, PARA

---

## ⚡ PRÓXIMOS PASOS

1. **Probar con remix latino rápido** (160+ BPM)
2. **Verificar que Back PARs se ven** (deberían estar 0.20-0.50)
3. **Verificar que Front llegan a 0** (con bass < 8%)
4. **Mañana**: Pop/Rock - El nuevo reto

---

*"El código debe ser limpio, elegante, eficiente y sostenible. NO TENEMOS PRISA."*
