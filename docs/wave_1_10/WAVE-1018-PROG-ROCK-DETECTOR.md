# 🎭 WAVE 1018: PROG ROCK DETECTOR - PINK FLOYD ADAPTIVE MODE

**Commit:** `5a5d7d1`  
**Status:** ✅ COMPLETE  
**Date:** 2026-01-28  

---

## 📋 PROBLEMA DETECTADO

**Pink Floyd - "Comfortably Numb" (PULSE Live 1994):**

```
Centroid: 533Hz-1057Hz (DARK - guitarras enterradas)
Treble: 0.02-0.18 (CASI NADA)
Presence: 0.00 (CERO ABSOLUTO)
UltraAir: 0.000 (16-22kHz inexistente)
```

**DIAGNÓSTICO:**
- **David Gilmour's guitar**: Mezclada MUY BAJO en 2.5k-8kHz
- **Richard Wright's keyboards**: DOMINANTES en 500-1500Hz
- **Roger Waters' bass**: POTENTE en 80-200Hz
- **Nick Mason's drums**: Kicks suaves (jazz-prog), NO potencia bruta

GOD EAR FFT funcionaba PERFECTO - el problema es la **mezcla densa atmosférica** de Pink Floyd donde la guitarra está enterrada bajo sintetizadores.

---

## 💡 SOLUCIÓN: DETECTOR DE SUBGÉNERO CON MEMORIA HISTÓRICA

### **ARQUITECTURA:**

```typescript
🧠 SISTEMA DE CONFIANZA ACUMULATIVA
├─ Ventana histórica: 30 segundos (~1800 frames @ 60fps)
├─ Threshold de cambio: 70% de samples deben coincidir
├─ Hysteresis: Mínimo 10 segundos entre cambios
└─ Una vez en "PROG_ROCK", se mantiene hasta consenso >70%
```

### **SUBGÉNEROS DETECTABLES:**

#### **1. PROG ROCK** (Pink Floyd, Yes, Genesis, Rush)
```typescript
Signature:
- Centroid: 500-1500Hz (teclados dominantes)
- Flatness: <0.05 (atmosférico/tonal)
- Clarity: >0.95 (mezcla pristina)
- Treble: <0.15 (guitarra enterrada)

Confidence: 3+ de 4 señales → PROG_ROCK
```

**COMPORTAMIENTO ESPECÍFICO:**
- **MoverRight DUAL-BAND**: `Presence OR HighMid`
- **Guitar Solo Detection**: Si `HighMid > 0.30` + `Centroid > 1500Hz` → Usar HighMid también
- **Debug logging**: Cada 60 frames cuando detecta solo

#### **2. HARD ROCK** (AC/DC, Metallica, Red Hot, System of a Down)
```typescript
Signature:
- Centroid: 1000-3000Hz (guitarras al frente)
- Harshness: >0.20 (distorsión)
- Clarity: 0.70-0.95 (mezcla agresiva)

Confidence: 2+ de 3 señales → HARD_ROCK
```

**COMPORTAMIENTO ESPECÍFICO:**
- **MoverRight Presence PURO**: Solo cymbals (2.5k-8kHz)
- **3-stage Voice Rejection Filter**: Graduado (20%, 40%, 70%)
- **WAVE 1017.2 calibration**: Brian Johnson filter

---

## 🔧 IMPLEMENTACIÓN

### **1. RockStereoPhysics2.ts**

**Estado del detector:**
```typescript
private detectionHistory: SubgenreDetectionSample[] = [];
private currentSubgenre: RockSubgenre = 'HARD_ROCK';  // Default
private readonly HISTORY_WINDOW = 1800;  // 30 segundos
private readonly CHANGE_THRESHOLD = 0.70; // 70%
private lastSubgenreChangeFrame = 0;
private readonly MIN_FRAMES_BETWEEN_CHANGES = 600;  // 10 segundos
```

**Función de detección:**
```typescript
detectAndUpdateSubgenre(
  centroidHz: number,
  flatness: number,
  clarity: number,
  harshness: number,
  treble: number
): void
```

- Calcula `progScore` y `hardScore` basado en signatures
- Añade sample al historial (mantiene solo últimos 1800 frames)
- Solo cambia si >70% de últimos 5 segundos (300 frames) coinciden
- Requiere mínimo 10 segundos entre cambios (hysteresis)

### **2. processMoverRight() - DUAL-BAND ADAPTIVE**

```typescript
if (this.currentSubgenre === 'PROG_ROCK') {
  const guitarSoloSignature = bands.highMid > 0.30 && centroidHz > 1500;
  
  if (guitarSoloSignature) {
    // DUAL-BAND: Tomar el MAYOR entre Presence y HighMid ajustado
    rawInput = Math.max(bands.presence, bands.highMid * 0.7);
  }
}
```

**LÓGICA:**
- **HARD_ROCK**: Solo `Presence` (cymbals)
- **PROG_ROCK**: `Presence OR HighMid*0.7` (detecta solos enterrados)

### **3. senses.ts - Clarity Export**

```typescript
analyze() return {
  // ... existing fields ...
  
  // 🎭 WAVE 1018: Clarity for PROG ROCK detection
  clarity: godEarResult.spectral.clarity,
}
```

### **4. SeleneLux.ts - Clarity Pass-through**

```typescript
const rockContext = {
  // ... existing fields ...
  
  // 🎭 WAVE 1018: Clarity for PROG ROCK detection
  clarity: audioMetrics.clarity ?? 0.85,
};
```

---

## 📊 LOGGING & DEBUG

### **Cambio de subgénero:**
```
🎭 [RockPhysics2] SUBGENRE CHANGE → PROG_ROCK (confidence: 82.3%)
   🩻 Signature: C=847Hz F=0.002 Clarity=0.998 T=0.089
```

### **Monitor cada 5 segundos:**
```
🎭 [Subgenre Monitor] Current=PROG_ROCK | Last 5s: PROG=85.3% | C=1045Hz F=0.01
```

### **Guitar Solo Detection:**
```
🎸 [PROG Guitar Solo] HM=0.45 PR=0.18 C=2350Hz → MR_input=0.32
```

---

## ✅ TESTING PLAN

### **1. Pink Floyd - "Comfortably Numb"**
- ✅ Debe detectar `PROG_ROCK` en primeros 30 segundos
- ✅ MoverRight debe activarse en solos de Gilmour (HighMid>0.30)
- ✅ NO debe cambiar a HARD_ROCK durante puentes/intros

### **2. AC/DC - "Thunderstruck"**
- ✅ Debe detectar `HARD_ROCK` inmediatamente
- ✅ MoverRight solo responde a cymbals (Presence)
- ✅ Voice Rejection activo (Brian Johnson filtrado)

### **3. Transiciones (playlist rock variado)**
- ✅ Cambio Pink Floyd → Metallica debe tomar ~10 segundos
- ✅ NO debe oscilar cada frame (hysteresis funciona)
- ✅ Consenso >70% necesario para cambiar

---

## 🎯 RESULTADOS ESPERADOS

### **PROG_ROCK Mode (Pink Floyd):**
```
FrontPar:  0.00-0.95 (Nick Mason's soft kicks)
BackPar:   0.20-0.60 (David Gilmour voice)
MoverLeft: 0.30-0.80 (Bass + Guitar body)
MoverRight: 0.15-0.70 (DUAL-BAND: solos enterrados detectados) ← NUEVO
```

### **HARD_ROCK Mode (AC/DC, Metallica):**
```
FrontPar:  0.00-1.00 (Phil Rudd/Lars Ulrich power kicks)
BackPar:   0.20-0.95 (Brian Johnson/James Hetfield)
MoverLeft: 0.30-0.80 (Angus Young/Kirk Hammett riffs)
MoverRight: 0.00-0.80 (Cymbals ONLY, voces filtradas) ← WAVE 1017.2
```

---

## 🔮 NEXT STEPS

- [ ] Test con Rush ("2112"), Yes ("Roundabout"), Genesis ("Firth of Fifth")
- [ ] Ajustar thresholds si detección es demasiado sensible
- [ ] Considerar modo "METAL" específico para thrash/death metal
- [ ] Añadir detección de "double bass drums" para metal extremo

---

## 📚 TECHNICAL NOTES

**WHY 70% THRESHOLD?**
- 60% = demasiado sensible, cambia con ruido
- 80% = demasiado rígido, nunca cambia
- 70% = sweet spot para consenso estable

**WHY 10 SECONDS MIN?**
- Pink Floyd tiene pasajes instrumentales largos (>30s)
- AC/DC tiene intros de guitarra antes del kick
- 10s permite "respirar" sin cambios espurios

**WHY DUAL-BAND FOR PROG?**
- Mezcla densa → guitarra en HighMid (400-2500Hz)
- Presence vacío → solo cymbals en momentos discretos
- HighMid*0.7 → evita saturación, solo picos reales

---

## 🎸 FILOSOFÍA

> "Una canción de Metallica ES Metallica. Una de Pink Floyd ES Floyd.
> NO cambiamos cada 10 segundos como loco."

**AXIOM PERFECTION FIRST:**
- Detector robusto con memoria histórica
- Hysteresis para estabilidad
- Lógica específica por subgénero, NO hacks

---

**END OF WAVE 1018** 🎭✨
