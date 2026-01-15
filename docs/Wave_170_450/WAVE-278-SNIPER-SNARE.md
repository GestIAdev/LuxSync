# 🎯 WAVE 278: THE SNIPER SNARE

**Fecha**: 2025-01-XX  
**Misión**: "Los Back Pars deben actuar como francotiradores, no como ametralladoras"

---

## 📊 DIAGNÓSTICO (Log Boris Brejcha)

```
[AGC TRUST] IN[0.76, 0.36, 0.16] -> OUT[Front:0.72, Back:0.20, Mover:0.05]
[AGC TRUST] IN[0.60, 0.37, 0.09] -> OUT[Front:0.57, Back:0.21, Mover:0.01]
```

**Problema detectado**:
- Con `mid^1.5`, el ruido de fondo del Minimal Techno (~0.3-0.4) genera ~20% constante
- Visualmente parece "fijo" porque nunca hay silencio real
- El snare (0.9) solo sube a ~0.70 → falta contraste (30% vs 70%)

---

## 🔧 SOLUCIÓN: SNIPER FORMULA

### Matemática del Aplastamiento

```typescript
// ANTES: mid^1.5 * 0.95 (Escoba)
IN 0.36 → 0.36^1.5 * 0.95 = 0.20 ❌ (ruido visible)
IN 0.51 → 0.51^1.5 * 0.95 = 0.34 ❌ (ruido alto)
IN 0.90 → 0.90^1.5 * 0.95 = 0.81 ❌ (poco contraste)

// DESPUÉS: mid^3.0 * 1.5 (Katana)
IN 0.36 → 0.36^3 * 1.5 = 0.07 ✅ (SILENCIO)
IN 0.51 → 0.51^3 * 1.5 = 0.20 ✅ (tenue)
IN 0.90 → 0.90^3 * 1.5 = 1.09 → 0.95 ✅ (GOLPE)
```

**Ratio de contraste mejorado**:
- ANTES: 0.20 vs 0.81 = ratio 4:1
- DESPUÉS: 0.07 vs 0.95 = ratio 13.5:1 🎯

---

## 📝 CAMBIOS EN CÓDIGO

### SeleneLux.ts - Fórmulas de Zona

```typescript
// 1. FRONT PARS (Bass - El Empujón)
// 🎯 WAVE 278: Compressor - curva suave para evitar saturación constante
const compressedBass = Math.pow(bass, 1.2);  // Suaviza la entrada
const frontIntensity = Math.min(frontCeiling, compressedBass * brightMod);

// 2. BACK PARS (Mid/Snare - La Bofetada)
// 🎯 WAVE 278: THE SNIPER FORMULA
// ANTES: mid^1.5 * 0.95 → IN 0.36 = OUT 0.20 (ruido visible constante)
// AHORA: mid^3.0 * 1.5  → IN 0.36 = OUT 0.07 (silencio) | IN 0.90 = OUT 0.95 (golpe)
const backRaw = Math.pow(mid, 3.0) * 1.5;
const backIntensity = Math.min(0.95, backRaw);
```

---

## 📈 RESULTADO ESPERADO

### Antes (Ametralladora):
```
Mid:   ████░░██░░███░░████░░██░░  (ruido constante ~0.3-0.5)
Light: ████░░██░░███░░████░░██░░  (copia directa del ruido)
       ↑ nunca hay silencio real
```

### Después (Francotirador):
```
Mid:   ████░░██░░███░░████░░██░░  (mismo ruido de entrada)
Light: ░░░░░░██░░░░░░░████░░░░░░  (solo picos visibles)
       ↑ silencio real entre golpes
```

---

## 🔮 NOTA: Elemental Decay

Los modificadores elementales ya están definidos en `ElementalModifiers.ts`:
- **Fire**: decayMultiplier = 0.6 (rápido/cortante)
- **Earth**: decayMultiplier = 1.2 (medio/pesado)
- **Water**: decayMultiplier = 1.8 (lento/líquido)

Estos valores existen pero no están conectados al PhysicsEngine actualmente.
Para una futura WAVE, se puede añadir el parámetro al pipeline HAL.

Por ahora, la Sniper Formula resuelve el problema principal de contraste.

---

## ✅ VERIFICACIÓN

Con la nueva fórmula, en el log deberíamos ver:

```
[AGC TRUST] IN[0.76, 0.36, 0.16] -> OUT[Front:0.68, Back:0.07, Mover:0.05]
                                           ↑ bass^1.2   ↑ mid^3*1.5
```

**Criterio de éxito**:
- `IN Mid: 0.4` → `OUT Back: < 0.10` (silencio visual)
- `IN Mid: 0.9` → `OUT Back: > 0.80` (disparo)

---

**PunkOpus out.** 🎯
