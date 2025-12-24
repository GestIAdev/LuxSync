# 💃 WAVE 106: LATIN CALIBRATION

**Fecha:** 2025-01-24  
**Autor:** GeminiPunk + Copilot  
**Status:** ✅ IMPLEMENTADO

---

## 🎯 PROBLEMA REPORTADO

El usuario reportó problemas específicos con música latina (cumbia, reggaeton):

1. **"La metralleta de reggaeton"** - PAR Front atascado en 12%
2. **"Los móviles nunca se apagan con cumbia"** - MOV:1.00 constante
3. Necesidad de encontrar **punto medio** entre Techno y Latin

### Log de diagnóstico:
```
RAW[B:0.68 M:0.47 T:0.24] | Pulse:0.10 | PAR:0.12 MOV:1.00
```
- Pulso detectado: 0.10 ✅
- Gate W105: 0.15 ❌ (mata pulsos de 0.10)
- Resultado: PAR = 12% anémico

---

## 🔧 DIRECTIVA GEMINIPUNK

> "WAVE 106 es QUIRÚRGICO: Solo tocamos los números que matan el Latin sin destruir el Techno."

### Cambios implementados:

| Parámetro | WAVE 105 | WAVE 106 | Razón |
|-----------|----------|----------|-------|
| **FRONT_PARS Gate** | 0.15 | **0.05** | Beats latinos más rápidos/suaves |
| **FRONT_PARS Gain** | 5.0 | **6.0** | Compensar gate más bajo |
| **BACK_PARS Gain** | 8.0 | **5.0** | Equilibrar con Front |

---

## 📐 FÓRMULAS ACTUALIZADAS

### FRONT_PARS (Bass Pulse)
```typescript
// WAVE 106: LATIN CALIBRATION - FRONT PARS
const latinPulseGate = 0.05;  // ← W105 era 0.15
if (bassPulse > latinPulseGate) {
  intensity = Math.min(1, (bassPulse - latinPulseGate) * 6.0);  // ← W105 era 5.0
}
```

**Matemática Latin:**
```
Pulse:0.10 → (0.10 - 0.05) * 6.0 = 0.30 (30%)
```
vs W105:
```
Pulse:0.10 → (0.10 - 0.15) * 5.0 = NEGATIVO → 0%
```

### BACK_PARS (Treble)
```typescript
// WAVE 106: LATIN CALIBRATION - BACK PARS
const trebleGate = 0.20;  // Sin cambio
intensity = Math.min(1, (rawTreble - trebleGate) * 5.0);  // ← W105 era 8.0
```

**Razón:** El Back a x8 "robaba protagonismo" al Front. Ahora:
- Front x6 (protagonista bass)
- Back x5 (acompañamiento treble)

---

## 🎵 COMPORTAMIENTO ESPERADO

### Reggaeton (Metralleta)
```
RAW[B:0.68 M:0.47 T:0.24] | Pulse:0.10 Floor:0.97

W105 (ANTES):
- PAR Front: (0.10 - 0.15) * 5 = 0% ❌

W106 (AHORA):
- PAR Front: (0.10 - 0.05) * 6 = 30% ✅
```

### Cumbia (Güiro + Congas)
```
RAW[B:0.45 M:0.62 T:0.38] | melodySum = 1.00 > bass*1.5 = 0.675

Si isMelodyDominant:
- MOV: 1.00 (perfecto para cumbia melódica)
- PAR: Respondan al bassFloor ondulante
```

### Techno (Boris Brejcha)
```
RAW[B:0.95 M:0.15 T:0.22] | Pulse:0.38 Floor:0.57

W106:
- PAR Front: (0.38 - 0.05) * 6 = 1.98 → clamped 1.0 ✅
- Kicks siguen golpeando fuerte
```

---

## 🔗 CADENA DE WAVES

```
W103 → Pulse Detection (paradigma transient vs level)
W104 → Floor Factor 0.90 → 0.60 (pulsos más generosos)
W105 → Linear Gain (elimina curvas Math.pow)
W106 → Latin Calibration (gate 0.05, gains rebalanceados)
```

---

## 📊 RESUMEN CAMBIOS EN main.ts

### Líneas modificadas:
1. **~673**: FRONT_PARS header → "WAVE 106: LATIN CALIBRATION"
2. **~682**: `latinPulseGate = 0.05` (era 0.15)
3. **~689**: `* 6.0` (era 5.0)
4. **~718**: BACK_PARS header → "WAVE 106: LATIN CALIBRATION"
5. **~734**: `* 5.0` (era 8.0)

---

## ✅ VERIFICACIÓN

Para validar WAVE 106:

1. **Reggaeton Test:**
   - Reproducir reggaeton con kicks rápidos
   - PAR Front debe superar 30% en cada golpe
   - Buscar en log: `PAR:0.3+`

2. **Cumbia Test:**
   - Durante melodía dominante: MOV:1.00
   - Durante breaks de bajo: PARs pulsan

3. **Techno Test:**
   - Boris Brejcha / Amelie Lens
   - Kicks deben llevar PARs a 80-100%
   - No regresión de W103-W105

---

## 🎭 FILOSOFÍA

> "El Latin tiene pulsos más sutiles pero más frecuentes. El Techno tiene pulsos más fuertes pero más espaciados. WAVE 106 baja el umbral para capturar ambos."

---

*Documentación generada por Copilot siguiendo directrices GeminiPunk*
