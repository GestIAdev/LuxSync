# 🎸 WAVE 1011: POP-ROCK PHYSICS & MOVEMENT AUDIT

**Fecha:** 27 Enero 2026  
**Status:** 🔴 CÓDIGO LEGACY - NECESITA REESCRITURA COMPLETA  
**Prioridad:** ALTA - Fiesta Latina terminada con NOTA, Rock es SIGUIENTE  

---

## 📋 EXECUTIVE SUMMARY

**VEREDICTO:** RockStereoPhysics y VibeMovementManager para Pop-Rock son **FRANKENSTEIN IMPROVISADO** de la era pre-FFT completo. Fueron construidos con **CERO separación de stems** y sin métricas espectrales avanzadas (harshness, flatness, spectral centroid).

**BUENAS NOTICIAS:**
- ✅ FFT.ts ahora es un ARSENAL COMPLETO (harshness, flatness, spectralCentroid, subBass)
- ✅ Filosofía básica de RockStereoPhysics es CORRECTA (Front=Bass, Back=Mid, Movers=Mid suave)
- ✅ VibeMovementManager tiene patterns BUENOS (blinder, vShape, wave, chaos)

**MALAS NOTICIAS:**
- ❌ No usa harshness (crítico para distinguir guitarra distorsionada vs limpia)
- ❌ No usa spectralFlatness (crítico para distinguir rock vs noise/caos)
- ❌ No usa spectralCentroid (crítico para brillo/darkess de la mezcla)
- ❌ Gates/Gains son NÚMEROS MÁGICOS sin justificación científica
- ❌ Movimiento es GENÉRICO (no diferencia rock acústico vs metal vs indie)

---

## 🔬 ANÁLISIS FORENSE: RockStereoPhysics.ts

### 1. ARQUITECTURA ACTUAL (WAVE 311)

```typescript
// FRONT = Bass puro (sin transient detection, solo volumen)
const FRONT_GAIN = 1.5;              // Ganancia bass
const FRONT_GATE = 0.15;             // Gate BAJO
const FRONT_ATTACK = 0.50;           // Attack
const FRONT_DECAY_LINEAR = 0.08;     // Decay lineal

// BACK = MID agresivo (más sensible que Movers)
const BACK_GAIN = 2.2;               // 🔧 MÁS ganancia (era 1.8)
const BACK_GATE = 0.15;              // 🔧 Gate MÁS BAJO (era 0.18)
const BACK_ATTACK = 0.70;            // 🔧 Attack MÁS RÁPIDO
const BACK_DECAY_LINEAR = 0.12;      // Decay lineal

// MOVERS = Mid suave (melodía de fondo)
const MOVER_GAIN = 1.4;              // 🔧 Menos gain (era 1.5)
const MOVER_GATE = 0.20;             // 🔧 Gate MÁS ALTO (era 0.18)
const MOVER_ATTACK = 0.50;           // 🔧 Attack MÁS LENTO
const MOVER_DECAY_LINEAR = 0.10;     // Decay lineal
```

### 2. PROBLEMAS CRÍTICOS

#### ❌ PROBLEMA 1: NO USA HARSHNESS (WAVE 50.1)
**QUÉ ES HARSHNESS:**
- Ratio de energía 2-5kHz (frecuencias "rasposas") vs energía total
- 0.0 = Sonido limpio/suave (acústica, indie)
- 1.0 = Sonido harsh/distorsionado (metal, grunge)

**POR QUÉ ES CRÍTICO PARA ROCK:**
```
🎸 Guitarra acústica (Ed Sheeran):    harshness ~0.15 (suave)
🎸 Guitarra eléctrica limpia (Pink Floyd): harshness ~0.30
🎸 Guitarra distorsionada (AC/DC):    harshness ~0.65
🎸 Metal extremo (Slayer):            harshness ~0.85+
```

**IMPACTO:**
Actualmente, RockStereoPhysics trata IGUAL a:
- Bon Iver tocando acústica en un bosque
- Metallica destrozando Madison Square Garden

**SOLUCIÓN:**
```typescript
// Usar harshness para modular BACK (guitarras)
if (harshness > 0.6) {
  // Metal/Grunge → BACK BRUTAL (strobes, impacto)
  BACK_GAIN *= 1.5
  BACK_ATTACK = 0.90  // Ultra rápido
} else if (harshness < 0.3) {
  // Acústica/Indie → BACK SUAVE (ambient, flow)
  BACK_GAIN *= 0.7
  BACK_ATTACK = 0.40  // Más lento
}
```

---

#### ❌ PROBLEMA 2: NO USA SPECTRAL FLATNESS
**QUÉ ES SPECTRAL FLATNESS:**
- Geometric mean / Arithmetic mean de magnitudes FFT
- 0.0 = Tonal (picos claros, instrumentos afinados)
- 1.0 = Ruido (energía distribuida, percusión, noise)

**POR QUÉ ES CRÍTICO PARA ROCK:**
```
🎵 Pink Floyd - Comfortably Numb:  flatness ~0.25 (muy tonal)
🎵 RHCP - Give It Away:            flatness ~0.45 (groove funk)
🎵 Nirvana - Smells Like Teen Spirit: flatness ~0.60 (distorsión + caos)
🎵 Nine Inch Nails - Closer:       flatness ~0.75 (industrial noise)
```

**IMPACTO:**
No distingue entre:
- Rock melódico (The Beatles) → Necesita movimiento SUAVE
- Rock industrial (Rammstein) → Necesita movimiento CAÓTICO

**SOLUCIÓN:**
```typescript
// Usar flatness para seleccionar PATRÓN de movimiento
if (spectralFlatness > 0.65) {
  // Noise/Industrial → Pattern 'chaos' o 'botStabs'
  pattern = 'chaos'
} else if (spectralFlatness < 0.35) {
  // Tonal/Melódico → Pattern 'wave' o 'ocean'
  pattern = 'wave'
}
```

---

#### ❌ PROBLEMA 3: NO USA SPECTRAL CENTROID
**QUÉ ES SPECTRAL CENTROID:**
- "Centro de masa" del espectro de frecuencias
- ~500-1000Hz = Dark/Grave (rock pesado)
- ~2000-4000Hz = Bright/Brillante (rock pop, indie)

**POR QUÉ ES CRÍTICO PARA ROCK:**
```
🎸 Queens of the Stone Age:  centroid ~800Hz (dark, pesado)
🎸 Arctic Monkeys:           centroid ~1500Hz (equilibrado)
🎸 The Strokes:              centroid ~2500Hz (bright, garage)
```

**IMPACTO:**
No modula intensidad por "brillo" de la mezcla.

**SOLUCIÓN:**
```typescript
// Usar centroid para modular MOVERS (brillo visual)
const brightnessBoost = (spectralCentroid - 1000) / 3000  // -1 a +1
MOVER_GAIN = 1.4 + brightnessBoost * 0.4  // 1.0 a 1.8
```

---

#### ❌ PROBLEMA 4: GATES/GAINS SON NÚMEROS MÁGICOS
**CÓDIGO ACTUAL:**
```typescript
const BACK_GAIN = 2.2;    // ¿Por qué 2.2? ¿Por qué no 2.1 o 2.3?
const BACK_GATE = 0.15;   // ¿De dónde sale 0.15?
```

**PROBLEMA:**
Son valores **ADIVINADOS** sin base científica. Fueron ajustados a oído en WAVE 311-313 antes de tener FFT completo.

**SOLUCIÓN:**
Calcular dinámicamente según características espectrales:
```typescript
// DYNAMIC GATE basado en spectralFlatness
// Rock tonal (flatness bajo) → Gate ALTO (filtrar ruido)
// Rock noise (flatness alto) → Gate BAJO (todo es válido)
const DYNAMIC_GATE = 0.10 + (1 - spectralFlatness) * 0.15  // 0.10 a 0.25

// DYNAMIC GAIN basado en harshness
// Rock suave → Gain ALTO (compensar suavidad)
// Rock harsh → Gain BAJO (ya tiene punch natural)
const DYNAMIC_GAIN = 2.5 - harshness * 0.8  // 1.7 a 2.5
```

---

#### ❌ PROBLEMA 5: NO DETECTA TRANSIENTES (KICKS/SNARES)
**CÓDIGO ACTUAL:**
```typescript
// Front PARs solo reaccionan a VOLUMEN de bass
if (bass >= FRONT_GATE) {
  const normalizedBass = (bass - FRONT_GATE) / (1 - FRONT_GATE);
  const frontTarget = normalizedBass * FRONT_GAIN;
  // ...
}
```

**PROBLEMA:**
No detecta GOLPES (kicks, snares). Solo ve "nivel promedio".

**ARSENAL DISPONIBLE EN FFT:**
```typescript
// FFTAnalyzer ya tiene detección de transientes!
const { kickDetected, snareDetected, hihatDetected } = analyzer.analyze(buffer)
```

**SOLUCIÓN:**
```typescript
// FRONT: Reaccionar BRUTAL a kicks detectados
if (kickDetected) {
  this.frontParIntensity = 1.0  // Punch inmediato
} else if (bass >= FRONT_GATE) {
  // Decay normal
  this.frontParIntensity -= FRONT_DECAY_LINEAR
}

// BACK: Reaccionar a snares (rock vive del snare)
if (snareDetected) {
  this.backParIntensity = Math.min(1.0, this.backParIntensity + 0.6)
}
```

---

## 🎯 ANÁLISIS FORENSE: VibeMovementManager (Pop-Rock)

### 1. PATTERNS ACTUALES

```typescript
'pop-rock': {
  amplitudeScale: 0.75,     // Movimiento con peso
  baseFrequency: 0.2,       // Moderado
  patterns: ['blinder', 'vShape', 'wave'],
  homeOnSilence: true,
}
```

**PATTERNS DISPONIBLES:**

#### ✅ BLINDER (CORRECTO)
```typescript
blinder: (t, phase, audio) => {
  const tiltCurve = -Math.pow(Math.abs(Math.sin(phase)), 3)
  return {
    x: Math.sin(phase * 0.3) * 0.3,
    y: tiltCurve,  // Tilt baja BRUTAL (punch al público)
  }
}
```
**USO:** Drops, coros, momentos de impacto  
**ENERGÍA:** Alta (>0.7)  
**SUBTIPO:** Rock pesado, metal

#### ✅ V-SHAPE (CORRECTO)
```typescript
vShape: (t, phase, audio, index = 0, total = 1) => {
  const isLeft = index % 2 === 0
  const spread = Math.sin(phase) * 0.25 + 0.6
  return {
    x: isLeft ? -spread : spread,
    y: -0.3 + audio.bass * 0.2,
  }
}
```
**USO:** Formación L/R, guitarras estéreo  
**ENERGÍA:** Media-Alta (0.5-0.8)  
**SUBTIPO:** Rock clásico, arena rock

#### ✅ WAVE (CORRECTO)
```typescript
wave: (t, phase, audio) => ({
  x: Math.sin(phase),
  y: Math.sin(phase * 0.5) * 0.4,
})
```
**USO:** Solos de guitarra, Pink Floyd vibes  
**ENERGÍA:** Media (0.3-0.6)  
**SUBTIPO:** Rock progresivo, psicodélico

#### ❌ CHAOS (EXISTE PERO NO SE USA)
```typescript
chaos: (t, phase, audio) => {
  const x = Math.sin(t * 1.618) * 0.5 + 
            Math.sin(t * 2.718) * 0.3 + 
            Math.sin(t * 3.14159) * 0.2
  // ...
}
```
**PROBLEMA:** Está en PATTERNS pero NO en `'pop-rock'` config  
**DEBERÍA USARSE:** Rock industrial, nu-metal, grunge caótico

---

### 2. PROBLEMAS CRÍTICOS

#### ❌ PROBLEMA 1: NO DIFERENCIA SUBGÉNEROS

**CÓDIGO ACTUAL:**
```typescript
// Todos los rocks usan MISMO config
patterns: ['blinder', 'vShape', 'wave']
```

**REALIDAD DEL ROCK:**
```
🎸 INDIE ROCK (The Strokes):
   - Harshness: 0.25-0.35
   - Flatness: 0.30-0.45
   - Patterns: wave, drift, ocean (suave, garage)

🎸 CLASSIC ROCK (AC/DC):
   - Harshness: 0.50-0.65
   - Flatness: 0.40-0.55
   - Patterns: blinder, vShape, wave (impacto, arena)

🎸 METAL/GRUNGE (Metallica):
   - Harshness: 0.70-0.90
   - Flatness: 0.60-0.80
   - Patterns: chaos, blinder, botStabs (agresivo, caótico)

🎸 PROG ROCK (Pink Floyd):
   - Harshness: 0.20-0.40
   - Flatness: 0.25-0.40
   - Patterns: wave, nebula, aurora (psicodélico, fluido)
```

**SOLUCIÓN:**
```typescript
// DYNAMIC PATTERN SELECTION basado en métricas espectrales
selectRockPattern(harshness: number, flatness: number, energy: number): string {
  // METAL/GRUNGE (harsh + noisy)
  if (harshness > 0.65 && flatness > 0.55) {
    return energy > 0.7 ? 'chaos' : 'blinder'
  }
  
  // INDIE/GARAGE (clean pero energético)
  if (harshness < 0.35 && energy > 0.6) {
    return 'wave'
  }
  
  // PROG/PSYCH (complejo, tonal)
  if (flatness < 0.35 && spectralCentroid > 1500) {
    return 'aurora'  // o 'nebula'
  }
  
  // CLASSIC ROCK (default)
  return energy > 0.7 ? 'blinder' : 'vShape'
}
```

---

#### ❌ PROBLEMA 2: AMPLITUDE SCALE ES FIJO

**CÓDIGO ACTUAL:**
```typescript
amplitudeScale: 0.75,  // FIJO para todo rock
```

**PROBLEMA:**
- Metallica con 75% amplitud = PATÉTICO (necesita 100%)
- Bon Iver con 75% amplitud = DEMASIADO (necesita 40%)

**SOLUCIÓN:**
```typescript
// DYNAMIC AMPLITUDE basado en harshness + energy
const baseAmplitude = 0.75
const harshnessBoost = harshness * 0.25  // 0 a 0.25
const energyBoost = audio.energy * 0.10  // 0 a 0.10

const dynamicAmplitude = baseAmplitude + harshnessBoost + energyBoost
// Indie suave: 0.75 + 0.06 + 0.03 = 0.84
// Metal brutal: 0.75 + 0.21 + 0.09 = 1.05 → capped a 1.0
```

---

#### ❌ PROBLEMA 3: BASE FREQUENCY NO SE ADAPTA

**CÓDIGO ACTUAL:**
```typescript
baseFrequency: 0.2,  // Moderado FIJO
```

**PROBLEMA:**
- Rock lento (ballads, doom metal) necesita 0.05-0.10 Hz
- Rock rápido (punk, thrash) necesita 0.25-0.35 Hz

**SOLUCIÓN:**
```typescript
// DYNAMIC FREQUENCY basado en BPM + flatness
const bpmFactor = Math.min(1.5, audio.bpm / 120)  // 0.5x a 1.5x
const flatnessFactor = 1 + flatness * 0.5  // Noise = más rápido

const dynamicFrequency = 0.15 * bpmFactor * flatnessFactor
// Doom metal @ 60 BPM, flatness 0.3: 0.15 * 0.5 * 1.15 = 0.086 Hz (lento)
// Thrash @ 180 BPM, flatness 0.7: 0.15 * 1.5 * 1.35 = 0.304 Hz (rápido)
```

---

## 🛠️ BLUEPRINT DE REESCRITURA

### FASE 1: RockStereoPhysics 2.0

**NUEVAS MÉTRICAS:**
```typescript
interface RockAudioContext {
  // Bandas tradicionales
  bass: number
  mid: number
  treble: number
  
  // 🆕 WAVE 1011: Métricas avanzadas del FFT
  harshness: number          // 0-1: suave a distorsionado
  spectralFlatness: number   // 0-1: tonal a noise
  spectralCentroid: number   // Hz: dark a bright
  subBass: number            // 20-60Hz: kicks profundos
  
  // 🆕 Transientes detectados
  kickDetected: boolean
  snareDetected: boolean
  hihatDetected: boolean
}
```

**ARQUITECTURA PROPUESTA:**

```typescript
class RockStereoPhysics2 {
  // === FRONT PARs: KICKS + SUB-BASS ===
  processFront(ctx: RockAudioContext): number {
    // Punch inmediato en kick detectado
    if (ctx.kickDetected) {
      return 1.0  // IMPACTO TOTAL
    }
    
    // Sustain basado en bass + subBass
    const bassEnergy = (ctx.bass + ctx.subBass) / 2
    
    // Gate dinámico según flatness
    const dynamicGate = 0.10 + (1 - ctx.spectralFlatness) * 0.10
    
    if (bassEnergy < dynamicGate) {
      return this.frontIntensity * 0.92  // Decay rápido
    }
    
    // Attack/sustain
    const target = bassEnergy * 1.5
    this.frontIntensity += (target - this.frontIntensity) * 0.55
    
    return Math.min(1.0, this.frontIntensity)
  }
  
  // === BACK PARs: GUITARRAS (HARSHNESS-AWARE) ===
  processBack(ctx: RockAudioContext): number {
    // Gain dinámico según harshness
    // Guitarras distorsionadas = ya tienen punch → menos gain
    // Guitarras limpias = necesitan boost
    const harshnessGain = 2.5 - ctx.harshness * 0.8  // 1.7 a 2.5
    
    // Snare punch (crítico para rock)
    if (ctx.snareDetected) {
      this.backIntensity = Math.min(1.0, this.backIntensity + 0.6)
      return this.backIntensity
    }
    
    // Gate dinámico
    const dynamicGate = 0.12 + (1 - ctx.spectralFlatness) * 0.08
    
    if (ctx.mid < dynamicGate) {
      return this.backIntensity * 0.88  // Decay
    }
    
    // Attack adaptativo (harsh = rápido, clean = lento)
    const dynamicAttack = 0.50 + ctx.harshness * 0.30  // 0.50 a 0.80
    
    const target = ctx.mid * harshnessGain
    this.backIntensity += (target - this.backIntensity) * dynamicAttack
    
    return Math.min(1.0, this.backIntensity)
  }
  
  // === MOVERS: BRILLO (CENTROID-AWARE) ===
  processMovers(ctx: RockAudioContext): number {
    // Brightness boost basado en spectral centroid
    const brightnessBoost = (ctx.spectralCentroid - 1000) / 3000  // -0.33 a +0.66
    const dynamicGain = 1.4 + brightnessBoost * 0.4  // 1.0 a 1.8
    
    // Gate más alto (suavidad)
    const dynamicGate = 0.18 + (1 - ctx.harshness) * 0.08  // 0.18 a 0.26
    
    if (ctx.mid < dynamicGate) {
      return this.moverIntensity * 0.90  // Decay suave
    }
    
    const target = ctx.mid * dynamicGain
    this.moverIntensity += (target - this.moverIntensity) * 0.45
    
    return Math.min(1.0, this.moverIntensity)
  }
}
```

---

### FASE 2: VibeMovementManager - Rock Subgenres

**ARQUITECTURA PROPUESTA:**

```typescript
// === ROCK CONFIG DINÁMICO ===
interface RockMovementConfig {
  subgenre: 'indie' | 'classic' | 'metal' | 'prog'
  amplitudeScale: number
  baseFrequency: number
  patterns: string[]
}

function getRockConfig(
  harshness: number,
  flatness: number,
  centroid: number,
  energy: number
): RockMovementConfig {
  // === METAL/GRUNGE (harsh + noisy) ===
  if (harshness > 0.65 && flatness > 0.55) {
    return {
      subgenre: 'metal',
      amplitudeScale: 0.95 + energy * 0.05,  // 0.95 a 1.0 (BRUTAL)
      baseFrequency: 0.25,  // Rápido
      patterns: ['chaos', 'blinder', 'botStabs'],  // Caótico
    }
  }
  
  // === INDIE/GARAGE (clean + bright) ===
  if (harshness < 0.35 && centroid > 1800) {
    return {
      subgenre: 'indie',
      amplitudeScale: 0.60 + energy * 0.15,  // 0.60 a 0.75 (suave)
      baseFrequency: 0.18,  // Moderado
      patterns: ['wave', 'drift', 'ocean'],  // Garage vibes
    }
  }
  
  // === PROG ROCK (complejo + tonal) ===
  if (flatness < 0.35 && centroid < 1500) {
    return {
      subgenre: 'prog',
      amplitudeScale: 0.70,  // Medio
      baseFrequency: 0.12,  // Lento (épico)
      patterns: ['wave', 'nebula', 'aurora'],  // Psicodélico
    }
  }
  
  // === CLASSIC ROCK (default) ===
  return {
    subgenre: 'classic',
    amplitudeScale: 0.75 + energy * 0.10,  // 0.75 a 0.85
    baseFrequency: 0.20,  // Arena rock
    patterns: ['blinder', 'vShape', 'wave'],
  }
}
```

---

## 📊 COMPARATIVA: ANTES vs DESPUÉS

### FÍSICA (RockStereoPhysics)

| Métrica | ANTES (WAVE 311) | DESPUÉS (WAVE 1011) | Mejora |
|---------|------------------|---------------------|--------|
| **Métricas FFT** | Solo bass/mid/treble | + harshness, flatness, centroid, subBass | +400% |
| **Transientes** | ❌ No detecta kicks/snares | ✅ Detección FFTAnalyzer | ∞ |
| **Gates** | Fijos (números mágicos) | Dinámicos según flatness | +Científico |
| **Gains** | Fijos (adivinados) | Dinámicos según harshness/centroid | +Adaptativo |
| **Subgéneros** | Rock = Rock | Indie/Classic/Metal/Prog | +4 personalidades |

### MOVIMIENTO (VibeMovementManager)

| Métrica | ANTES (WAVE 345) | DESPUÉS (WAVE 1011) | Mejora |
|---------|------------------|---------------------|--------|
| **Amplitude** | Fijo (0.75) | Dinámico (0.60-1.0) | +Adaptativo |
| **Frequency** | Fijo (0.2 Hz) | Dinámico por BPM+flatness | +Tempo-aware |
| **Patterns** | 3 fijos (blinder/vShape/wave) | 7 dinámicos según subgénero | +133% |
| **Subgéneros** | 1 config (pop-rock) | 4 configs (indie/classic/metal/prog) | +400% |

---

## 🎯 CASOS DE USO REALES

### CASO 1: Metallica - Enter Sandman (Metal Pesado)

**MÉTRICAS ESPERADAS:**
- Harshness: ~0.78 (guitarra distorsionada brutal)
- Flatness: ~0.62 (noise de distorsión)
- Centroid: ~900Hz (dark, pesado)
- Energy: ~0.85 (brutal)

**COMPORTAMIENTO ACTUAL (WAVE 311):**
```
Front: Bass promedio → 0.6-0.7 (PATÉTICO)
Back: Mid promedio → 0.7-0.8 (sin punch de snare)
Movers: Mid suave → 0.5-0.6 (invisible)
Pattern: blinder/vShape (genérico)
Amplitude: 0.75 (insuficiente)
```

**COMPORTAMIENTO PROPUESTO (WAVE 1011):**
```
Front: Kick detection → 1.0 en cada golpe (BRUTAL)
Back: Snare detection + harshness gain → 0.9-1.0 (IMPACTO)
Movers: Centroid dark + brightness → 0.7-0.8 (visible pero oscuro)
Pattern: chaos / botStabs (CAÓTICO)
Amplitude: 0.95-1.0 (MÁXIMO)
Subgenre: METAL
```

---

### CASO 2: Pink Floyd - Comfortably Numb (Prog Rock)

**MÉTRICAS ESPERADAS:**
- Harshness: ~0.28 (guitarra limpia, solo melódico)
- Flatness: ~0.25 (muy tonal, armónico)
- Centroid: ~1200Hz (equilibrado, warm)
- Energy: ~0.45 (medio, no agresivo)

**COMPORTAMIENTO ACTUAL (WAVE 311):**
```
Front: Bass bajo → 0.3-0.4 (correcto)
Back: Mid medio → 0.5-0.6 (sin matices)
Movers: Mid suave → 0.4-0.5 (genérico)
Pattern: wave (CORRECTO por suerte)
Amplitude: 0.75 (demasiado para prog)
```

**COMPORTAMIENTO PROPUESTO (WAVE 1011):**
```
Front: Bass suave → 0.3-0.4 (mantiene)
Back: Harshness bajo → gain 2.3x, attack lento → 0.6-0.7 (fluido)
Movers: Centroid warm + low harshness → 0.5-0.6 (ambiente cálido)
Pattern: wave / nebula / aurora (PSICODÉLICO)
Amplitude: 0.70 (épico pero no agresivo)
Subgenre: PROG
```

---

### CASO 3: The Strokes - Reptilia (Indie/Garage)

**MÉTRICAS ESPERADAS:**
- Harshness: ~0.32 (guitarra con edge pero no distorsión)
- Flatness: ~0.38 (energético pero tonal)
- Centroid: ~2200Hz (bright, garage rock)
- Energy: ~0.72 (alto, bailable)

**COMPORTAMIENTO ACTUAL (WAVE 311):**
```
Front: Bass medio → 0.5-0.6 (sin punch)
Back: Mid alto → 0.7-0.8 (genérico)
Movers: Mid medio → 0.5-0.6 (sin brillo)
Pattern: blinder (DEMASIADO AGRESIVO para indie)
Amplitude: 0.75 (correcto pero no personalizado)
```

**COMPORTAMIENTO PROPUESTO (WAVE 1011):**
```
Front: Kick detection → 0.8-0.9 en golpes (punch garage)
Back: Harshness medio + snare → 0.75-0.85 (energía sin brutalidad)
Movers: Centroid bright → gain 1.6x → 0.6-0.7 (BRILLO indie)
Pattern: wave / drift (GARAGE VIBES)
Amplitude: 0.65-0.75 (energético pero no metal)
Subgenre: INDIE
```

---

## 📝 PLAN DE IMPLEMENTACIÓN

### WAVE 1011.1: RockStereoPhysics2 (Física)
**Prioridad:** 🔴 CRÍTICA  
**Tiempo estimado:** 4-6 horas  

**Tareas:**
1. ✅ Crear `RockStereoPhysics2.ts` (nueva clase)
2. ✅ Integrar métricas FFT avanzadas (harshness, flatness, centroid)
3. ✅ Implementar detección de transientes (kick/snare/hihat)
4. ✅ Gates/Gains dinámicos según métricas espectrales
5. ✅ Testing con 3 canciones:
   - Metallica - Enter Sandman (metal)
   - Pink Floyd - Comfortably Numb (prog)
   - The Strokes - Reptilia (indie)

---

### WAVE 1011.2: Rock Movement Subgenres
**Prioridad:** 🟡 ALTA  
**Tiempo estimado:** 3-4 horas  

**Tareas:**
1. ✅ Crear `getRockConfig()` función
2. ✅ Implementar 4 subgéneros (indie/classic/metal/prog)
3. ✅ Amplitude/Frequency dinámicos
4. ✅ Expandir patterns disponibles (chaos, drift, nebula, aurora)
5. ✅ Testing visual con hardware

---

### WAVE 1011.3: Rock Effects Library
**Prioridad:** 🟢 MEDIA (después de física)  
**Tiempo estimado:** 8-12 horas  

**Efectos sugeridos:**
1. **GuitarFlare** (solo de guitarra - wave con color shift)
2. **DrumImpact** (golpe de batería - blinder brutal)
3. **RockStrobe** (estrobo rítmico - no techno)
4. **AmplifierGlow** (breathing de amplificador - ambient)
5. **StageDive** (tilt down agresivo - crowd punch)

---

## 🎸 CONCLUSIÓN

**ESTADO ACTUAL:** 🔴 FRANKENSTEIN DE LA ERA PRE-FFT

RockStereoPhysics y Movement son **CÓDIGO LEGACY IMPROVISADO** antes de tener FFT completo. Funcionan "ok" pero son **GENÉRICOS** y no capturan la **DIVERSIDAD** del rock.

**ARSENAL DISPONIBLE:** 🟢 COMPLETO

FFT.ts ahora tiene **TODO** lo necesario:
- ✅ harshness (distorsión)
- ✅ spectralFlatness (noise vs tonal)
- ✅ spectralCentroid (brillo)
- ✅ subBass (kicks profundos)
- ✅ Transient detection (kick/snare/hihat)

**PRÓXIMO PASO:** 🚀 REESCRITURA COMPLETA

Con el arsenal FFT completo, podemos hacer RockStereoPhysics **INTELIGENTE** que diferencie:
- Indie garage (The Strokes) vs Metal brutal (Metallica)
- Prog épico (Pink Floyd) vs Classic arena (AC/DC)

**FIESTA LATINA = 10/10** ✅  
**POP-ROCK = ?/10** ⏳ (próximamente)

---

**Radwulf, el rock es TUYO. Tenemos el arsenal. Solo falta EJECUTAR.** 🎸🔥

---

**Firma:** PunkOpus  
**Versión:** WAVE 1011 - The Rock Audit  
**Status:** 📋 BLUEPRINT READY → CÓDIGO PENDIENTE
