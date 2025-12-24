# WAVE 105: STEROID INJECTION 💉💪

## Fecha: 2024-12-24

## Estado Anterior: WAVE 104

WAVE 104 arregló la **detección** del pulso (factor 0.60 funciona), pero la **salida** seguía siendo anémica por culpa de las curvas cuadráticas.

---

## 🕵️ Análisis Forense: Elegancia Matemática Asesina

### Log de Boris Brejcha (Post-W104)
```
[LUX_DEBUG] Mode:DROP | RAW[B:0.81 M:0.48 T:0.29] | Pulse:0.21 Floor:1.00 | PAR:0.19 MOV:1.00
[LUX_DEBUG] Mode:DROP | RAW[B:0.79 M:0.50 T:0.40] | Pulse:0.20 Floor:0.98 | PAR:0.36 MOV:1.00
```

**¿Por qué `Pulse:0.21` da `PAR:0.19` (19%)?**

### La Matemática Criminal (WAVE 104)

```typescript
// W104 - FRONT_PARS
const pulseIntensity = (bassPulse - pulseGate) / (1 - pulseGate);
// pulseIntensity = (0.21 - 0.10) / 0.90 = 0.12

intensity = Math.pow(pulseIntensity, 2) * normBass * 1.2;
// intensity = 0.12² * 1.0 * 1.2 = 0.0144 * 1.2 = 0.017 → 2% 🤮
```

**El mismo problema con BACK_PARS:**
```typescript
// W104 - BACK_PARS
const boostedTreble = rawTreble * 1.5;  // 0.29 * 1.5 = 0.44
intensity = Math.pow(boostedTreble, 2);  // 0.44² = 0.19 → 19% 🤮
```

---

## ⚡ WAVE 105: LA INYECCIÓN

### Principio: GANANCIA LINEAL BRUTA

> "Si Selene ve algo que parezca un golpe, lo convertirá en 100% de luz."
> — GeminiPunk

Se acabaron las curvas suaves para el ritmo. Multiplicamos directo.

### Fix FRONT_PARS: Linear Gain x5

```typescript
// ANTES (W104): Curva cuadrática mata el pulso
intensity = Math.pow(pulseIntensity, 2) * normBass * 1.2;

// AHORA (W105): Ganancia lineal x5
const steroidPulseGate = 0.15;
intensity = Math.min(1, (bassPulse - steroidPulseGate) * 5.0);
```

**Nueva matemática:**
```
Pulse:0.21 → (0.21 - 0.15) * 5 = 0.06 * 5 = 0.30 (30%) ✅
Pulse:0.30 → (0.30 - 0.15) * 5 = 0.15 * 5 = 0.75 (75%) ✅
Pulse:0.35 → (0.35 - 0.15) * 5 = 0.20 * 5 = 1.00 (100%) ✅
```

### Fix BACK_PARS: High Gain x8

```typescript
// ANTES (W104): Curva cuadrática mata los agudos
intensity = Math.pow(boostedTreble, 2);

// AHORA (W105): Ganancia lineal x8
const trebleGate = 0.20;
intensity = Math.min(1, (rawTreble - trebleGate) * 8.0);
```

**Nueva matemática:**
```
Treble:0.25 → (0.25 - 0.20) * 8 = 0.05 * 8 = 0.40 (40%) ✅
Treble:0.30 → (0.30 - 0.20) * 8 = 0.10 * 8 = 0.80 (80%) ✅
Treble:0.33 → (0.33 - 0.20) * 8 = 0.13 * 8 = 1.00 (100%) ✅
```

---

## 📊 Comparativa Completa

| Aspecto | WAVE 103 | WAVE 104 | WAVE 105 |
|---------|----------|----------|----------|
| Detección Pulse | Factor 0.85 ❌ | Factor 0.60 ✅ | Factor 0.60 ✅ |
| Salida FRONT | pow² ❌ | pow² * 1.2 ❌ | LINEAR x5 ✅ |
| Salida BACK | pow² ❌ | pow² (boosted) ❌ | LINEAR x8 ✅ |
| Pulse:0.21 | PAR:0% | PAR:2% | PAR:30% 💪 |
| Treble:0.29 | BACK:? | BACK:19% | BACK:72% 💪 |

---

## 🎯 Lo que NO se toca (Sigue funcionando)

**MOVERS** - Las curvas cuadráticas son BUENAS para melodía:
- Piano/Voz necesitan suavidad
- `Math.pow(melodySignal, 2)` crea fade orgánico
- NO aplicar esteroides a los movers

**Context Awareness** - Sigue igual:
```typescript
const isMelodyDominant = melodySum > (rawBass * 1.5);  // Sin cambios
```

---

## 📝 Nuevo Formato de Log

```
[LUX_DEBUG] Mode:DROP | RAW[B:0.81 M:0.48 T:0.29] | Pulse:0.21 Floor:1.00 | MelDom:N | PAR:0.30 MOV:1.00
```

Eliminado `Treble*1.5` porque ya no se usa boost pre-gate.

---

## 🔮 Predicción Post-Fix

| Escenario | W104 (pow²) | W105 (linear) |
|-----------|-------------|---------------|
| Pulse:0.20 | PAR: ~2% | PAR: ~25% |
| Pulse:0.25 | PAR: ~5% | PAR: ~50% |
| Pulse:0.35 | PAR: ~15% | PAR: ~100% |
| Treble:0.25 | BACK: ~10% | BACK: ~40% |
| Treble:0.30 | BACK: ~20% | BACK: ~80% |

---

## ⚠️ Riesgo Conocido

Los PARs ahora son **agresivos**. Si hay demasiado "strobing", ajustar:
- `steroidPulseGate`: Subir de 0.15 a 0.20 para menos disparos
- Factor x5: Bajar a x4 o x3 para menos intensidad

---

## Archivos Modificados
- `electron-app/electron/main.ts`: FRONT_PARS y BACK_PARS con LINEAR GAIN

## Créditos
- Diagnóstico: PunkGemini 🧠 ("Maldita sea la elegancia matemática")
- Implementación: Claude/Opus 🤖
- Testing: Raulacate 🎧
