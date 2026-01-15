# WAVE 291.5: CUMBIA FIX - Transient Detection, No Smooth

## 📋 RESUMEN EJECUTIVO

**Fecha:** 5 de Enero 2026  
**Operación:** CUMBIA PHYSICS FIX  
**Archivo Modificado:** `electron-app/src/hal/physics/LatinoStereoPhysics.ts`  
**Estado:** ✅ COMPLETADO

---

## 🎯 PROBLEMA DETECTADO (Post WAVE 291)

El fix "RAW & DIRTY" mejoró reggaeton pero **FALLÓ con cumbia**:

| Componente | Síntoma | Causa Raíz |
|------------|---------|------------|
| **Front PARs** | SMOOTH causa delay + temblor paradójico | LERP 10% suaviza PERO también retrasa |
| **Back PARs** | Fijos encendidos todo el tema | Trigger por NIVEL (>0.40) + bajo de cumbia CONSTANTE |
| **Movers** | Captan güiro/maracas | Gate 0.15 muy bajo para cumbia |

### 🎵 El Problema del Bajo de Cumbia
En reggaeton el bajo es "PUM-PUM-PUM" (golpes discretos).
En cumbia el bajo es "MMMMMMMMM" (alfombra constante).

El trigger por NIVEL ve el bajo al 80% y deja los Back PARs FIJOS.

---

## 🔧 SOLUCIÓN: TRANSIENT DETECTION

### Filosofía WAVE 291.5
> *"No me importa si el bajo está al 80%.*  
> *Me importa si SUBE DE GOLPE."*

### Cambios de Constantes

```typescript
// ── MOVERS (Hard Silence - Gate Alto) ──
MOVER_DECAY_FACTOR = 0.85;     // 🔧 Era 0.96 → Decay RÁPIDO
MOVER_GATE = 0.40;             // 🔧 Era 0.15 → Gate ALTO

// ── BACK PARs (Transient Only - Delta Puro) ──
BACK_PAR_DELTA_TRIGGER = 0.08; // 🆕 Solo dispara en FLANCO de subida
BACK_PAR_DECAY = 0.20;         // Corte rápido

// ── FRONT PARs (Direct & Raw - No Smooth) ──
FRONT_PAR_BASE = 0.30;         // 🆕 Base de iluminación facial
FRONT_PAR_BASS_MULT = 0.40;    // 🆕 Multiplicador del bass
FRONT_PAR_NOISE_GATE = 0.02;   // 🆕 Cambios < 2% = ignorar
```

### Cambios de Lógica

#### BACK PARs: Transient Only
```typescript
// ANTES: Trigger por NIVEL → falla con bajo constante
if (bass > 0.40) intensity = 1.0;

// AHORA: Trigger por DELTA → solo el ATAQUE
if (bassDelta > 0.08) intensity = 1.0;
else intensity -= 0.20;
```

#### MOVERS: Hard Silence
```typescript
// ANTES: Gate 0.15 → güiro/maracas encendían
if (mid > 0.15 && mid > current) Attack;

// AHORA: Gate 0.40 + Decay 0.85 → OSCURIDAD si no hay melodía fuerte
if (mid > 0.40) Attack;
else current *= 0.85;  // Decay RÁPIDO
```

#### FRONT PARs: Direct + Noise Gate
```typescript
// ANTES: LERP 10% → delay + temblor
intensity += (target - intensity) * 0.10;

// AHORA: Mapeo DIRECTO + Noise Gate
target = BASE + (bass * 0.40);
if (abs(target - current) > 0.02) {
  intensity = target;  // Cambio INMEDIATO
} else {
  // Mantener valor anterior (anti-temblor sin delay)
}
```

---

## 📊 COMPORTAMIENTO ESPERADO

| Componente | WAVE 291 | WAVE 291.5 |
|------------|----------|------------|
| **Back PARs** | Fijos con bajo de cumbia | Solo disparan en el "PUM" del bombo |
| **Movers** | Captan güiro/maracas | NEGRO si no hay voz/trompeta fuerte |
| **Front PARs** | Delay de ~200ms + temblor | Respuesta INSTANTÁNEA, sin microvibraciones |

---

## 🎵 CASOS DE USO

### Reggaeton (Bad Bunny, Daddy Yankee)
- ✅ Back PARs: Siguen el "PUM-PUM" del dembow
- ✅ Movers: Siguen la voz (fuerte)
- ✅ Front PARs: Respiran con el bajo

### Cumbia (Grupo 5, Corazón Serrano)
- ✅ Back PARs: Solo en golpes de timbal/bombo (NO en el bajo constante)
- ✅ Movers: APAGADOS durante güiro/maracas, ENCENDIDOS con trompeta/voz
- ✅ Front PARs: Base estable, pulsan con el bajo sin temblor

### Salsa (Marc Anthony, Héctor Lavoe)
- ✅ Back PARs: Siguen el tumbao del bajo (tiene transients)
- ✅ Movers: Siguen metales y voz
- ✅ Front PARs: Iluminación facial constante

---

## ✅ ESTADO FINAL

- [x] FRONT_PAR_SMOOTH eliminado → Mapeo directo
- [x] Noise Gate implementado (0.02) → Anti-temblor sin delay
- [x] BACK_PAR_TRIGGER → BACK_PAR_DELTA_TRIGGER (transient detection)
- [x] MOVER_GATE subido a 0.40 → Hard silence
- [x] MOVER_DECAY_FACTOR bajado a 0.85 → Decay rápido
- [x] White Puncture intacto
- [x] Compilación sin errores

---

## 🎯 CLAVE DEL FIX

```
NIVEL = "¿Qué tan alto está?"
DELTA = "¿Está SUBIENDO?"

Para bajo constante de cumbia:
- NIVEL = 0.80 todo el tema → Back PARs FIJOS (MAL)
- DELTA = 0.00 casi siempre, 0.15 en el bombo → Back PARs solo en golpes (BIEN)
```

---

*WAVE 291.5 - Cuando el bajo es alfombra, escucha los transients.* 🥁
