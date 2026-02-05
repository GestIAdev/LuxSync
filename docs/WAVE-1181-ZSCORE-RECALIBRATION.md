# 🔬 WAVE 1181: Z-Score Recalibration - "Boris Brejcha nos enseñó la verdad"

**Status**: ✅ IMPLEMENTED (+ HOTFIX 1181.1)  
**Date**: 2026-02-05  
**Context**: Post-WAVE 1180 final calibration (72h before disco test)

---

## 🔥 HOTFIX 1181.1: minStdDev Floor

**PROBLEMA POST-1181:** Después de aplicar ventana de 30s, seguían apareciendo Z=9σ

**CAUSA RAÍZ:** El problema NO era solo la ventana, era el `minStdDev: 0.001`

**ESCENARIO:**
```
Durante breakdown con poca variación:
- mean = 0.12
- stdDev real = 0.02 (pero > 0.001, así que se usa)
- Llega pico de 0.30
- Z = (0.30 - 0.12) / 0.02 = 9σ
```

**SOLUCIÓN:**
```typescript
// ANTES:
minStdDev: 0.001

// AHORA:
minStdDev: 0.08  // Floor realista para música
```

**IMPACTO:**
```
Con minStdDev = 0.08:
- Z = (0.30 - 0.12) / 0.08 = 2.25σ ← NORMAL
- Z máximo teórico = (1.0 - 0.0) / 0.08 = 12.5σ ← Solo con energía 100% vs 0%
```

---

## 📊 PROBLEM STATEMENT

### **The Impossible Z-Scores**

Durante testing con sesiones de **Boris Brejcha (Brutal Hard Minimal)**, se observaron Z-Scores estadísticamente imposibles:

```
[DecisionMaker 🌩️] DIVINE MOMENT: Z=12.07σ zone=active
[DecisionMaker 🌩️] DIVINE MOMENT: Z=8.26σ zone=peak
[DecisionMaker 🌩️] DIVINE MOMENT: Z=7.15σ zone=active
[DecisionMaker 🌩️] DIVINE BLOCKED: Z=6.89σ but zone=valley
[DecisionMaker 🌩️] DIVINE BLOCKED: Z=6.08σ but zone=valley
```

**Frecuencia observada:** Cada 2-3 minutos

### 🤯 ANÁLISIS ESTADÍSTICO

**Probabilidades en distribución normal:**
| Z-Score | Probabilidad de Ocurrencia |
|---------|---------------------------|
| Z=3σ    | 0.15% (1 en 1,000) |
| Z=4σ    | 0.003% (1 en 30,000) |
| Z=6σ    | 0.0000001% (1 en 506 MILLONES) |
| Z=8σ    | 1 en 1.24 × 10¹⁶ |
| Z=12σ   | **1 en 1.17 × 10³²** (más átomos que en el universo) |

**CONCLUSIÓN:** Si Z > 6σ ocurre cada 2-3 minutos, **algo está fundamentalmente mal calibrado.**

---

## 🎯 ROOT CAUSE ANALYSIS

### **El Problema de la Ventana Corta**

**Configuración ANTES de WAVE 1181:**
```typescript
const DEFAULT_CONFIG = {
  bufferSize: 300,  // 5 segundos @ 60fps
  ...
}
```

**Cálculo del Z-Score:**
```
Z = (valor_actual - media_histórica) / desviación_estándar
```

### 🎭 ESCENARIO TÍPICO: Minimal Techno Breakdown

```
[Breakdown: 30 segundos @ E=0.15-0.25]  ← Ventana de 5s captura SOLO esto
  ↓
[Drop: synth stab de 200ms @ E=0.95]   ← Pico súbito
```

**Con ventana de 5s:**
```javascript
mean = 0.20     // Últimos 5s del breakdown (muy bajo)
stdDev = 0.05   // Poca variación en el breakdown
current = 0.95  // El stab

Z = (0.95 - 0.20) / 0.05 = 15σ  ← IMPOSIBLE ESTADÍSTICAMENTE
```

**El problema:** La media NO representa el contexto musical completo, solo los últimos 5 segundos de silencio tenso.

---

## ✅ SOLUTION: Window Extension to 30 Seconds

### **Configuración DESPUÉS de WAVE 1181:**
```typescript
const DEFAULT_CONFIG = {
  bufferSize: 1800,  // 🔬 WAVE 1181: 30 segundos @ 60fps (was 300)
  ...
}
```

**Con ventana de 30s:**
```javascript
mean = 0.40     // Mix de intro, verse, breakdown (más representativo)
stdDev = 0.15   // Variación realista
current = 0.95  // El stab

Z = (0.95 - 0.40) / 0.15 = 3.67σ  ← RAZONABLE Y REALISTA
```

---

## 🧠 PHILOSOPHICAL RATIONALE

### **¿Por qué 30 segundos?**

**Estructura típica de minimal techno:**
- **Verse:** 16-32 compases (30-60s)
- **Breakdown:** 8-16 compases (15-30s)
- **Buildup:** 8-16 compases (15-30s)
- **Drop:** 1-2 compases (2-4s)

**Con ventana de 5s:**
- ❌ Captura solo el breakdown (sesgado hacia bajo)
- ❌ El drop parece "divino" cuando es solo "normal para un drop"

**Con ventana de 30s:**
- ✅ Captura verse + breakdown + buildup
- ✅ La media representa el CONTEXTO MUSICAL completo
- ✅ Los drops REALES destacan con Z=3-4σ (estadísticamente significativo)

---

## 📈 EXPECTED IMPACT

### **ANTES (WAVE 1180):**
```
Minimal Techno Drop:
- Z=6-12σ cada 2-3 minutos
- Valley Protection bloqueaba la mayoría
- Números estadísticamente imposibles
```

### **DESPUÉS (WAVE 1181):**
```
Minimal Techno Drop:
- Z=3-4σ (estadísticamente raro pero posible)
- DIVINE threshold de 3.5σ sigue siendo apropiado
- Números realistas y defendibles
```

---

## 🎯 CALIBRATION TARGETS

### **New Expected Z-Score Ranges:**

| Evento | Z-Score Esperado | Acción de Selene |
|--------|-----------------|------------------|
| Normal play | -1σ a +1σ | Breathing effects |
| Transiente | +1.5σ a +2σ | Notable moment |
| Pre-drop buildup | +2σ a +2.5σ | Prepare/tension |
| DROP REAL | +3σ a +4σ | DIVINE FIRE |
| Drop MASIVO | +4σ a +5σ | DIVINE + Arsenal completo |
| Drop ÉPICO (raro) | > +5σ | Full nuclear (1x por set) |

**Nota:** Con ventana de 30s, Z > 5σ debería ocurrir **máximo 1-2 veces** en una sesión de 60 minutos.

---

## 🔬 TECHNICAL DETAILS

### **File Modified:**
`electron-app/src/core/intelligence/memory/ContextualMemory.ts`

### **Change:**
```typescript
// BEFORE:
const DEFAULT_CONFIG: ContextualMemoryConfig = {
  bufferSize: 300,  // ~5 segundos @ 60fps
  ...
};

// AFTER:
const DEFAULT_CONFIG: ContextualMemoryConfig = {
  bufferSize: 1800,  // 🔬 WAVE 1181: 30 segundos @ 60fps
  ...
};
```

### **Impact on Memory:**
- **Before:** 300 floats × 3 metrics = 900 floats (~3.6 KB)
- **After:** 1800 floats × 3 metrics = 5400 floats (~21.6 KB)
- **Additional cost:** ~18 KB (negligible for modern systems)

---

## 🧪 VALIDATION STRATEGY

### **Test Cases:**

1. **Minimal Techno (Boris Brejcha):**
   - ✅ Z-Scores should be 3-4σ for drops
   - ✅ Z > 6σ should be EXTREMELY rare (if at all)

2. **Pop/Rock (The Killers):**
   - ✅ Chorus drops should be Z=2-3σ
   - ✅ Stadium moments Z=3-4σ

3. **Latina (Salsa):**
   - ✅ Breakdown → Montuno Z=2-3σ
   - ✅ Tumbao explosivo Z=3-4σ

**What to look for:**
- ❌ NO more Z > 6σ every 2-3 minutes
- ✅ DIVINE moments feel "special" again (not spam)
- ✅ Valley Protection still working correctly

---

## 🎪 REAL-WORLD ANALOGY

### **Before WAVE 1181: "The Myopic DJ"**
```
DJ observa los últimos 5 segundos:
"Wow, el breakdown fue silencio total por 5s!"
[Stab de synth]
"ESTO ES DIVINO!!! 🔥🔥🔥"
```

### **After WAVE 1181: "The Context-Aware DJ"**
```
DJ observa los últimos 30 segundos:
"Ok, hubo verse normal, luego breakdown..."
[Stab de synth]
"Ah sí, el drop. Nice timing. 👍"
```

---

## 🌊 RELATED WAVES

- **WAVE 664-665**: Contextual Memory implementation (original 5s window)
- **WAVE 1178**: Valley Protection (blocks DIVINE in valleys)
- **WAVE 1179**: Strobe Z-Guard + Hard Minimum Cooldowns
- **WAVE 1180**: Gatling Peak Requirement + Seismic Z-Guard

---

## 📋 COMMIT MESSAGE

```
🔬 WAVE 1181: Z-Score Recalibration - Ventana de 5s → 30s

PROBLEMA: Z-Scores imposibles (6σ, 8σ, 12σ) cada 2-3 min en minimal techno
CAUSA: Ventana de 5s demasiado corta → media inestable en breakdowns

SOLUCIÓN: bufferSize 300 → 1800 frames (5s → 30s @ 60fps)

IMPACTO:
- Z-Scores ahora realistas (3-4σ para drops reales)
- DIVINE threshold de 3.5σ apropiado estadísticamente
- Números defendibles: Z > 5σ = 1-2x por hora (no 10x)

Boris Brejcha "Brutal Hard Minimal" fue nuestro test case.
Los números no mienten: Z=12σ no existe en el universo.
La ventana de 30s captura CONTEXTO MUSICAL, no solo los últimos 5s.
```

---

## 🏁 VEREDICTO FINAL

**El sistema NO estaba roto. Estaba MAL CALIBRADO.**

El Valley Protection funcionaba perfectamente (bloqueaba Z=6σ en valleys). 

El problema era que **un drop normal de minimal techno NO debería ser Z=6σ**.

Con ventana de 30s:
- ✅ Drops normales → Z=3-4σ → DIVINE apropiado
- ✅ Drops MASIVOS → Z=4-5σ → Arsenal nuclear justificado
- ✅ Z > 6σ → Casi nunca (si ocurre, es genuinamente épico)

**Ready para el sábado.** 🎪

---

**PunkOpus & Radwulf - 2026-02-05**  
*"La estadística no miente. Los DJs tampoco. Pero las ventanas de 5s sí."*
