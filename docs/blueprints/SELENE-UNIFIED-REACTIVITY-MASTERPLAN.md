# 🌙 SELENE UNIFIED REACTIVITY MASTERPLAN

**Arquitecto:** GeminiPunk × Copilot  
**Fecha:** 2025-12-24  
**Versión:** 1.1 (con Netrunner Review)  
**Estado:** ✅ APROBADO CON HONORES - GO FOR LAUNCH

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#-resumen-ejecutivo)
2. [Diagnóstico del Estado Actual](#-diagnóstico-del-estado-actual)
3. [Los 3 Fantasmas](#-los-3-fantasmas)
4. [El Estándar Dubstep](#-el-estándar-dubstep---master-model)
5. [Nueva Arquitectura: The Pipeline](#-nueva-arquitectura-the-pipeline)
6. [Implementación Propuesta](#-implementación-propuesta)
7. [Sistema de Vibe Constraints](#-sistema-de-vibe-constraints)
8. [Mapa de Parámetros](#-mapa-de-parámetros-universales)
9. [Roadmap de Implementación](#-roadmap-de-implementación)
10. [Matices Técnicos (Netrunner Review)](#-matices-técnicos-netrunner-review)

---

## 🎯 RESUMEN EJECUTIVO

### El Problema Central
Diseñar **UN algoritmo reactivo estable** que funcione correctamente para 4 Vibes completamente diferentes:

| Vibe | Características | Desafío |
|------|-----------------|---------|
| **Techno** | Kicks repetitivos, bass sostenido al 100% | Diferencias mínimas, floor alto |
| **Dubstep** | Contrastes extremos, silencios marcados | El "Rey del Test" - funciona |
| **Reggaeton** | Metralleta rápida, bass constante | Pulsos pequeños pero frecuentes |
| **Cumbia/Latino** | Melodía dominante, güiro+congas | Móviles deben brillar, no bass |

### La Filosofía
> "El ojo humano percibe el **DELTA** (cambio), no el valor absoluto."  
> — Si el PAR está al 30% pero sube y baja con el kick, se ve más potente que estar fijo al 100%.

### La Solución
**Motor Global + Vibe Constraints:**
1. Un pipeline reactivo universal con 4 fases
2. Pequeños modificadores por Vibe que ajustan umbrales específicos
3. Arquitectura de "capas" como un procesador de audio (DAW)

---

## 🔬 DIAGNÓSTICO DEL ESTADO ACTUAL

### Evidencia de Logs (Análisis Cruzado)

#### Log Dubstep ✅ (FUNCIONA)
```
[LUX_DEBUG] Mode:DROP | RAW[B:0.68 M:0.55 T:0.26] | Pulse:0.09 | PAR:0.30 MOV:1.00
[LUX_DEBUG] Mode:MELODY | RAW[B:0.35 M:0.49 T:0.08] | PAR:0.00 MOV:1.00  ← Silencio + Melodía
[LUX_DEBUG] Mode:DROP | RAW[B:0.71 M:0.58 T:0.33] | Pulse:0.16 | PAR:0.64 MOV:1.00
```
**Observación:** 
- PAR al 30% durante drop, 0% en melodía ✅
- Contraste extremo (1.0 → 0.35 bass) detectado correctamente
- El Floor baja a 0.75-0.90 en breakdowns

#### Log Reggaeton ❌ (PROBLEMAS)
```
[LUX_DEBUG] Mode:DROP | RAW[B:0.72 M:0.48 T:0.17] | Pulse:0.14 Floor:0.96 | PAR:0.00 MOV:1.00
[LUX_DEBUG] Mode:DROP | RAW[B:0.68 M:0.52 T:0.19] | Pulse:0.08 Floor:0.99 | PAR:0.00 MOV:1.00
[LUX_DEBUG] Mode:DROP | RAW[B:0.65 M:0.51 T:0.19] | Pulse:0.05 Floor:0.99 | PAR:0.00 MOV:1.00
```
**Diagnóstico:**
- **Floor ALTÍSIMO (0.96-0.99):** El bass es tan constante que el promedio no baja
- **Pulsos pequeños (0.05-0.14):** La metralleta genera pulsos, pero muy sutiles
- **Gate W105 (0.15) los mata:** `Pulse:0.14 < Gate:0.15 → PAR:0.00`
- **MOV:1.00 constante:** Nunca se apaga porque hay "melodía" siempre (ruido M+T)

### Tabla Comparativa de Comportamiento

| Métrica | Dubstep | Reggaeton | Causa Raíz |
|---------|---------|-----------|------------|
| Bass Range | 0.35 - 1.00 | 0.65 - 0.80 | Reggaeton no tiene silencios |
| Floor | 0.75 - 0.92 | 0.94 - 0.99 | Promedio se satura |
| Pulse Range | 0.09 - 0.39 | 0.04 - 0.14 | Delta pequeño |
| PAR Output | 0.30 - 0.64 | 0.00 - 0.25 | Gate demasiado alto |
| MOV Output | Varía 0.35-1.00 | Fijo 1.00 | Melodía falsa positiva |

---

## 👻 LOS 3 FANTASMAS

### Fantasma #1: Móviles Insomnes 🌙
**Síntoma:** `MOV:1.00` constante, nunca se apagan  
**Causa:**
```typescript
const isMelodyDominant = melodySum > (rawBass * 1.5);
// Reggaeton: (0.48 + 0.17) = 0.65 > (0.72 * 1.5) = 1.08? NO
// PERO el suelo de 15% se aplica siempre que haya "algo" de melodía
```
El problema es que el umbral `melodySignal > 0.25` para DROP MODE es muy bajo.  
**Además:** El decay de smoothing es muy lento (`SMOOTHING_DECAY`), los móviles "flotan".

**Solución Propuesta:**
```typescript
// Noise Gate de Melodía más estricto
const cleanMelody = (melodySum > 0.60) && (melodySignal > 0.40);  // Melodía REAL
// Si hay bass fuerte, NO hay suelo de móviles
const moverFloor = (rawBass > 0.50) ? 0 : 0.15;  // Suelo dinámico
```

### Fantasma #2: PARs al 12% (La Fuga de Luz) 💡
**Síntoma:** Los PARs nunca llegan a 0%, siempre quedan en 10-15%  
**Causa:**
```typescript
bassPulse = rawBass - (bassFloor * 0.60);
// Reggaeton: 0.72 - (0.99 * 0.60) = 0.72 - 0.59 = 0.13
// 0.13 > 0.05 (gate W106) → (0.13 - 0.05) * 6 = 0.48 → 48%

// PROBLEMA: El pulso NUNCA es 0 porque siempre hay residuo de bass
```
El ruido de ambiente, zumbido eléctrico, o bass residual siempre deja un "resto".

**Solución Propuesta:** Hard Clipper (Tijera de Salida)
```typescript
// Después de calcular intensity, ANTES de asignar dimmer:
if (intensity < 0.15) intensity = 0;  // BLACKOUT LIMPIO
// Resultado: O estás al 20%+ o estás APAGADO. Sin términos medios.
```

### Fantasma #3: Sincronización del Apagado ⏱️
**Síntoma:** Cuando los PARs se apagan, los Móviles también caen  
**Causa:** Ambos dependen de la misma señal (bassFloor/energía global)  
**Observación en Dubstep:**
```
Mode:MELODY → PAR:0.00 MOV:1.00  ← Separación correcta!
Mode:DROP   → PAR:0.64 MOV:1.00
```
En Dubstep SÍ hay separación porque los silencios son más marcados.

**Solución Propuesta:** Decay Asimétrico
```typescript
// PARs: Decay INSTANTÁNEO (0ms)
parIntensity = (newValue > prevValue) ? newValue : newValue;  // Sin smoothing

// Móviles: Decay SUAVE (Inercia física de un foco en movimiento)
moverIntensity = (newValue > prevValue) 
  ? newValue 
  : Math.max(prevValue * 0.92, newValue);  // 8% decay por frame
```

---

## 🎵 EL ESTÁNDAR DUBSTEP - MASTER MODEL

### ¿Por qué Dubstep es el Rey del Test?

1. **Contraste Extremo:** De `B:1.0` a `B:0.09` en milisegundos
2. **Espectro Completo:** Subgraves (PAR), medios agresivos (MOV), hi-hats (BackPAR)
3. **Silencios Marcados:** Permite que el Floor baje y los pulsos se amplifiquen
4. **Tu observación:** "PAR al 30% se veía POTENTE" → El Delta importa más que el absoluto

### Extracción de Parámetros Óptimos del Dubstep

| Parámetro | Valor Óptimo | Por qué funciona |
|-----------|--------------|------------------|
| Floor Range | 0.75 - 0.92 | Permite pulsos de 0.16+ |
| Pulse Gate | 0.05 - 0.10 | Captura golpes reales |
| Melody Threshold | 0.40+ | Solo melodía REAL activa móviles |
| PAR Output Range | 0.30 - 0.64 | Suficiente contraste visual |
| Hard Clipper | 0.15 | Elimina ruido basura |

---

## 🔧 NUEVA ARQUITECTURA: THE PIPELINE

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    SELENE REACTIVITY PIPELINE v2.0                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │  FASE 1: GATEKEEPER (Juez de Silencio)                                  │  ║
║  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                   │  ║
║  │  INPUT: rawBass, rawMid, rawTreble                                      │  ║
║  │                                                                         │  ║
║  │  if (totalEnergy < 0.15) → BLACKOUT TOTAL                               │  ║
║  │     • Todos los fixtures a 0                                             │  ║
║  │     • Reset de smoothing buffers                                         │  ║
║  │     • Preparar para "attack" limpio                                      │  ║
║  │                                                                         │  ║
║  │  OUTPUT: isBlackout: boolean                                            │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                               ▼                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │  FASE 2: ROUTER (Clasificador de Contexto)                              │  ║
║  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                   │  ║
║  │  INPUT: rawBass, melodySum, energy                                      │  ║
║  │                                                                         │  ║
║  │  CLASIFICACIÓN:                                                         │  ║
║  │  ┌──────────────┬──────────────────────────────────────────────────┐    │  ║
║  │  │ RHYTHM_MODE  │ rawBass > 0.50 && bass > melody                  │    │  ║
║  │  │              │ → PARs: PRIORIDAD | Móviles: Sin suelo           │    │  ║
║  │  ├──────────────┼──────────────────────────────────────────────────┤    │  ║
║  │  │ ATMOS_MODE   │ melody > (bass * 1.5) || rawBass < 0.30          │    │  ║
║  │  │              │ → Móviles: PRIORIDAD | PARs: Gate alto           │    │  ║
║  │  ├──────────────┼──────────────────────────────────────────────────┤    │  ║
║  │  │ HYBRID_MODE  │ Transición entre ambos                           │    │  ║
║  │  │              │ → Blend suave para evitar parpadeo               │    │  ║
║  │  └──────────────┴──────────────────────────────────────────────────┘    │  ║
║  │                                                                         │  ║
║  │  OUTPUT: contextMode: 'RHYTHM' | 'ATMOS' | 'HYBRID'                     │  ║
║  │          rhythmPriority: number (0-1)                                   │  ║
║  │          atmosPriority: number (0-1)                                    │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                               ▼                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │  FASE 3: PHYSICS ENGINE (Cálculo de Intensidades)                       │  ║
║  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                            │  ║
║  │                                                                         │  ║
║  │  ┌─────────────────────────────────────────────────────────────────┐    │  ║
║  │  │ PAR ENGINE (Flash Physics)                                      │    │  ║
║  │  │ ─────────────────────────────────                               │    │  ║
║  │  │ • Attack: INSTANTÁNEO (0ms)                                     │    │  ║
║  │  │ • Decay: INSTANTÁNEO (0ms)                                      │    │  ║
║  │  │ • Formula: (bassPulse - gate) * gain                            │    │  ║
║  │  │ • Gate: Ajustado por Vibe                                       │    │  ║
║  │  │ • Final: Hard Clipper 15%                                       │    │  ║
║  │  └─────────────────────────────────────────────────────────────────┘    │  ║
║  │                                                                         │  ║
║  │  ┌─────────────────────────────────────────────────────────────────┐    │  ║
║  │  │ MOVER ENGINE (Inertia Physics)                                  │    │  ║
║  │  │ ──────────────────────────────                                  │    │  ║
║  │  │ • Attack: RÁPIDO (2-3 frames)                                   │    │  ║
║  │  │ • Decay: SUAVE (500ms, ~30 frames)                              │    │  ║
║  │  │ • Formula: floor + (melodySignal * (1 - floor))                 │    │  ║
║  │  │ • Floor: Dinámico basado en contextMode                         │    │  ║
║  │  │   - RHYTHM_MODE: floor = 0 (solo melodía fuerte)                │    │  ║
║  │  │   - ATMOS_MODE: floor = 0.15 (presencia continua)               │    │  ║
║  │  │ • Smoothing: Exponential decay 0.92                             │    │  ║
║  │  └─────────────────────────────────────────────────────────────────┘    │  ║
║  │                                                                         │  ║
║  │  ┌─────────────────────────────────────────────────────────────────┐    │  ║
║  │  │ BACK PAR ENGINE (Shimmer Physics)                               │    │  ║
║  │  │ ─────────────────────────────────                               │    │  ║
║  │  │ • Attack: RÁPIDO (1 frame)                                      │    │  ║
║  │  │ • Decay: MEDIO (5-10 frames)                                    │    │  ║
║  │  │ • Formula: (rawTreble - gate) * gain                            │    │  ║
║  │  │ • Desacoplado de Front PAR                                      │    │  ║
║  │  └─────────────────────────────────────────────────────────────────┘    │  ║
║  │                                                                         │  ║
║  │  OUTPUT: parIntensity, moverIntensity, backParIntensity                 │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                               ▼                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │  FASE 4: VIBE CONSTRAINTS (Sabores por Género)                          │  ║
║  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                │  ║
║  │                                                                         │  ║
║  │  APLICAR MODIFICADORES ESPECÍFICOS:                                     │  ║
║  │                                                                         │  ║
║  │  vibeConstraints[currentVibe].apply(intensities)                        │  ║
║  │                                                                         │  ║
║  │  OUTPUT: finalIntensities (con ajustes por vibe)                        │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                               ▼                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │  FASE 5: HARD CLIPPER (Limpieza Final)                                  │  ║
║  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                      │  ║
║  │                                                                         │  ║
║  │  for each intensity:                                                    │  ║
║  │    if (intensity < CLIP_THRESHOLD) intensity = 0                        │  ║
║  │                                                                         │  ║
║  │  // CLIP_THRESHOLD = 0.15 por defecto                                   │  ║
║  │  // Elimina "fantasmas" de luz tenue                                    │  ║
║  │                                                                         │  ║
║  │  OUTPUT: cleanIntensities → DMX                                         │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 💻 IMPLEMENTACIÓN PROPUESTA

### Pseudocódigo del Motor Global

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// SELENE UNIFIED REACTIVITY ENGINE v2.0
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 108: VIBE CONSTRAINTS SYSTEM (ACTUALIZADO)
// ═══════════════════════════════════════════════════════════════════════════
// CORRECCIÓN CRÍTICA: Los 4 Vibes reales son:
// 1. TechnoClub - Industrial Standard (Default)
// 2. FiestaLatina - La Metralleta 
// 3. PopRock - Alto Contraste (física "Dubstep")
// 4. ChillLounge - Fluidez Total
// ═══════════════════════════════════════════════════════════════════════════

interface VibeConstraints {
  name: string;              // Nombre descriptivo del preset
  parGate: number;           // Gate para Front PARs
  parGain: number;           // Ganancia para Front PARs
  backParGate: number;       // Gate para Back PARs
  backParGain: number;       // Ganancia para Back PARs
  moverFloor: number;        // Floor base de móviles (0 = oscuridad total)
  melodyThreshold: number;   // Umbral para detectar "melodía real"
  decaySpeed: number;        // Velocidad de decay (1=instantáneo, 10=líquido)
  hardClipThreshold: number; // Umbral del soft knee clipper
}

const VIBE_PRESETS: Record<string, VibeConstraints> = {
  // 🏭 TECHNO CLUB - Industrial Standard (DEFAULT)
  'techno-club': {
    name: 'Techno/Default',
    parGate: 0.15,           // Solo golpes claros
    parGain: 4.0,            // Potencia estándar
    backParGate: 0.20,
    backParGain: 4.0,        // Equilibrado
    moverFloor: 0.0,         // Sin suelo (oscuridad total en drops)
    melodyThreshold: 0.25,   // Solo melodías claras
    decaySpeed: 2,           // Rápido (Strobe feel)
    hardClipThreshold: 0.15,
  },
  
  // 💃 FIESTA LATINA - La Metralleta
  'fiesta-latina': {
    name: 'Latino',
    parGate: 0.05,           // Gate bajísimo (metralletas rápidas)
    parGain: 6.0,            // Ganancia extrema
    backParGate: 0.12,
    backParGain: 5.5,        // (4.0 * 1.35) ¡PRIORIDAD SNARE/TIMBAL!
    moverFloor: 0.0,         // Sin suelo en rhythm
    melodyThreshold: 0.40,   // Estricto (evitar falsos positivos)
    decaySpeed: 1,           // Instantáneo (corte seco)
    hardClipThreshold: 0.12,
  },
  
  // 🎸 POP / ROCK - Alto Contraste (Física "Dubstep")
  'pop-rock': {
    name: 'Pop/Rock',
    parGate: 0.10,           // Gate medio
    parGain: 5.0,            // Alta ganancia para llenar escenario
    backParGate: 0.18,
    backParGain: 4.5,        // Platos brillantes
    moverFloor: 0.05,        // Mínimo 5% luz ambiente
    melodyThreshold: 0.30,   // Detectar melodías claras
    decaySpeed: 3,           // Decay natural (resonancia)
    hardClipThreshold: 0.15,
  },
  
  // 🍹 CHILL / LOUNGE - Fluidez Total
  'chill-lounge': {
    name: 'Chill',
    parGate: 0.0,            // Sin gate, todo pasa
    parGain: 2.0,            // Ganancia suave
    backParGate: 0.10,
    backParGain: 2.0,
    moverFloor: 0.20,        // SIEMPRE presentes (20% suelo)
    melodyThreshold: 0.0,    // Cualquier sonido mueve los focos
    decaySpeed: 10,          // Muy lento (líquido)
    hardClipThreshold: 0.08, // Clipper suave
  },
};

function calculateReactivity(audio: AudioInput, vibe: string): FixtureIntensities {
  const constraints = VIBE_PRESETS[vibe] || VIBE_PRESETS['techno-club'];
  
  // ═══════════════════════════════════════════════════════════════════════
  // FASE 1: GATEKEEPER
  // ═══════════════════════════════════════════════════════════════════════
  const totalEnergy = audio.bass + audio.mid + audio.treble;
  if (totalEnergy < 0.15) {
    return { par: 0, backPar: 0, mover: 0, isBlackout: true };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FASE 2: ROUTER
  // ═══════════════════════════════════════════════════════════════════════
  const melodySum = audio.mid + audio.treble;
  const isRhythmMode = audio.bass > 0.50 && audio.bass > melodySum;
  const isAtmosMode = melodySum > (audio.bass * 1.5) || audio.bass < 0.30;
  
  // Blend suave para transiciones
  let rhythmPriority = isRhythmMode ? 1.0 : (isAtmosMode ? 0.0 : 0.5);
  let atmosPriority = 1.0 - rhythmPriority;
  
  // ═══════════════════════════════════════════════════════════════════════
  // FASE 3: PHYSICS ENGINE
  // ═══════════════════════════════════════════════════════════════════════
  
  // --- PAR ENGINE (Flash) ---
  const bassPulse = Math.max(0, audio.bass - (bassFloor * 0.60));
  let parIntensity = 0;
  if (bassPulse > constraints.parGate && rhythmPriority > 0.3) {
    parIntensity = Math.min(1, (bassPulse - constraints.parGate) * constraints.parGain);
  }
  
  // --- BACK PAR ENGINE (Shimmer) ---
  let backParIntensity = 0;
  if (audio.treble > constraints.backParGate && rhythmPriority > 0.3) {
    backParIntensity = Math.min(1, (audio.treble - constraints.backParGate) * constraints.backParGain);
  }
  
  // --- MOVER ENGINE (Inertia) ---
  const melodySignal = Math.max(audio.mid, audio.treble);
  const effectiveFloor = isRhythmMode 
    ? constraints.moverFloorRhythm 
    : constraints.moverFloorAtmos;
  
  let moverTarget = 0;
  if (melodySignal > constraints.melodyThreshold || isAtmosMode) {
    moverTarget = effectiveFloor + (melodySignal * (1 - effectiveFloor));
  } else if (isRhythmMode && melodySignal > 0.25) {
    // En rhythm mode, solo brillar si melodía supera umbral
    moverTarget = Math.pow(melodySignal, 2);  // Curva para suavidad
  }
  
  // Smoothing con decay asimétrico
  const prevMover = smoothedIntensities.get('mover') ?? 0;
  let moverIntensity: number;
  if (moverTarget > prevMover) {
    moverIntensity = moverTarget;  // Attack instantáneo
  } else {
    moverIntensity = Math.max(prevMover * constraints.moverDecay, moverTarget);
  }
  smoothedIntensities.set('mover', moverIntensity);
  
  // ═══════════════════════════════════════════════════════════════════════
  // FASE 4 + 5: VIBE CONSTRAINTS + HARD CLIPPER
  // ═══════════════════════════════════════════════════════════════════════
  
  // Aplicar Hard Clipper
  if (parIntensity < constraints.hardClipThreshold) parIntensity = 0;
  if (backParIntensity < constraints.hardClipThreshold) backParIntensity = 0;
  // Móviles NO usan clipper (queremos suavidad)
  
  return { 
    par: parIntensity, 
    backPar: backParIntensity, 
    mover: moverIntensity,
    isBlackout: false 
  };
}
```

---

## 🎭 SISTEMA DE VIBE CONSTRAINTS (WAVE 108 - ACTUALIZADO)

### Los 4 Vibes Oficiales

| Vibe | Descripción | Filosofía |
|------|-------------|-----------|
| 🏭 **TechnoClub** | Industrial Standard (Default) | Limpio, oscuro, golpes fuertes |
| 💃 **FiestaLatina** | Reggaetón, Cumbia, Salsa | Metralleta rápida, snare prioritario |
| 🎸 **PopRock** | Alto Contraste (física Dubstep) | Dinámica de batería acústica |
| 🍹 **ChillLounge** | Ambient, Lo-Fi, Downtempo | Fluidez total, siempre presente |

### Tabla de Ajustes por Vibe

| Parámetro | TechnoClub | FiestaLatina | PopRock | ChillLounge |
|-----------|------------|--------------|---------|-------------|
| `parGate` | 0.15 | **0.05** | 0.10 | **0.0** |
| `parGain` | 4.0 | **6.0** | 5.0 | **2.0** |
| `backParGain` | 4.0 | **5.5** | 4.5 | **2.0** |
| `moverFloor` | 0 | 0 | **0.05** | **0.20** |
| `melodyThreshold` | 0.25 | **0.40** | 0.30 | **0.0** |
| `decaySpeed` | 2 | **1** | 3 | **10** |
| `hardClipThreshold` | 0.15 | **0.12** | 0.15 | **0.08** |

### Justificación de Ajustes

**💃 Fiesta Latina:**
- `parGate: 0.05` → Capturar metralleta (pulsos pequeños pero rápidos)
- `parGain: 6.0` → Compensar pulsos pequeños con más amplificación
- `backParGain: 5.5` → (4.0 × 1.35) ¡PRIORIDAD SNARE/TIMBAL!
- `decaySpeed: 1` → Corte seco, instantáneo

**🎸 Pop/Rock:**
- `moverFloor: 0.05` → Mínimo 5% luz ambiente para ver la banda
- `decaySpeed: 3` → Resonancia natural de platos y cuerdas

**🍹 Chill/Lounge:**
- `moverFloor: 0.20` → Presencia continua de móviles (ambiente)
- `hardClipThreshold: 0.08` → Permitir brillos tenues
- `decaySpeed: 10` → Movimiento líquido, sin cortes bruscos

---

## 📊 MAPA DE PARÁMETROS UNIVERSALES

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PARÁMETRO MAP - SELENE v2.0                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ENTRADA (Audio FFT)                                                        │
│  ═══════════════════                                                        │
│  rawBass    ──┬──► [0.0 - 1.0] Energía de graves (20-200Hz)                │
│  rawMid     ──┤    [0.0 - 1.0] Energía de medios (200-2kHz)                │
│  rawTreble  ──┘    [0.0 - 1.0] Energía de agudos (2k-20kHz)                │
│                                                                             │
│  PROCESAMIENTO                                                              │
│  ══════════════                                                             │
│                                                                             │
│  bassFloor = avgNormEnergy  [0.5 - 1.0]  Promedio móvil de bass            │
│       │                                                                     │
│       ▼                                                                     │
│  bassPulse = rawBass - (bassFloor * 0.60)  [0.0 - 0.4]  Transient detect   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │  if (bassPulse > parGate)                                      │        │
│  │    parIntensity = (bassPulse - parGate) * parGain              │        │
│  │  else                                                          │        │
│  │    parIntensity = 0                                            │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                             │
│  melodySum = rawMid + rawTreble  [0.0 - 2.0]                               │
│       │                                                                     │
│       ▼                                                                     │
│  contextMode = CLASSIFY(rawBass, melodySum)                                 │
│       │                                                                     │
│       ├──► RHYTHM: bass > 0.50 && bass > melody                            │
│       ├──► ATMOS:  melody > bass * 1.5 || bass < 0.30                      │
│       └──► HYBRID: transición                                               │
│                                                                             │
│  SALIDA (DMX)                                                               │
│  ════════════                                                               │
│  parIntensity    ──► dimmer FRONT_PARS  [0-255]                            │
│  backParIntensity ─► dimmer BACK_PARS   [0-255]                            │
│  moverIntensity  ──► dimmer MOVERS      [0-255]                            │
│                                                                             │
│  POST-PROCESO                                                               │
│  ════════════                                                               │
│  Hard Clipper:  if (intensity < 0.15) → intensity = 0                       │
│  Final Clamp:   intensity = clamp(0, 1)                                     │
│  DMX Convert:   dmxValue = round(intensity * 255)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ ROADMAP DE IMPLEMENTACIÓN

### Fase 1: Core Refactor (WAVE 107) ✅ COMPLETADO
**Objetivo:** Implementar el Pipeline de 5 fases

```
[✅] Implementar FASE 1 (Gatekeeper) con totalEnergy check
[✅] Implementar FASE 2 (Router) con clasificación RHYTHM/ATMOS/HYBRID
[✅] Refactorizar FASE 3 (Physics) con motores separados
[✅] Implementar Soft Knee Clipper como FASE 5
[✅] Añadir getVibePreset() y applySoftKneeClipper()
```

### Fase 2: Vibe Constraints (WAVE 108) ✅ COMPLETADO
**Objetivo:** Sistema de presets por género

```
[✅] Crear interface VibeConstraints con name, decaySpeed, moverFloor
[✅] Definir VIBE_PRESETS con los 4 vibes CORRECTOS:
     - TechnoClub (Default)
     - FiestaLatina (Metralleta)
     - PopRock (Alto Contraste)
     - ChillLounge (Fluidez)
[✅] Smart Vibe Matcher con includes() flexible
[✅] Actualizar MOVERS para usar preset.moverFloor y decaySpeed
```

### Fase 3: Decay Asimétrico (WAVE 109)
**Objetivo:** Física diferenciada por tipo de fixture

```
[ ] PAR: Attack/Decay instantáneo
[ ] MOVER: Attack rápido, Decay suave con factor configurable
[ ] BACK_PAR: Shimmer con decay intermedio
[ ] Smoothing buffers por fixture type (no por address)
```

### Fase 4: Noise Gate de Melodía (WAVE 110)
**Objetivo:** Eliminar falsos positivos en detección de melodía

```
[ ] Implementar cleanMelody con umbral de coherencia
[ ] Suelo dinámico de móviles basado en bassLevel
[ ] Testing con reggaeton (MOV no debe ser 1.00 constante)
```

### Fase 5: Validación Final (WAVE 111)
**Objetivo:** Test suite con los 4 vibes

```
[ ] Capturar logs de: Techno, Latino, Dubstep, Chill
[ ] Comparar métricas vs baseline esperado
[ ] Ajustar umbrales según resultados
[ ] Documentar parámetros finales
```

---

## � MATICES TÉCNICOS (NETRUNNER REVIEW)

> **Revisión de GeminiPunk - 2025-12-24**  
> "El plan es 98% perfecto. Añado 3 constraints para evitar sorpresas en implementación."

### Matiz #1: Física de Inercia Específica (Decay Frames)

El Blueprint original menciona "Flash Physics" vs "Inertia Physics", pero necesitamos ser específicos:

| Fixture Type | Decay | Frames | Milisegundos | Razón |
|--------------|-------|--------|--------------|-------|
| **PARES** | Flash | 2 frames | ~30ms | Si es 0 (instantáneo), parece glitch eléctrico. La micro-cola de cometa registra el "golpe" sin parecer error de bombilla |
| **MÓVILES** | Inertia | 30-60 frames | 500-1000ms | Si melodía corta en seco, el beam debe desvanecerse como humo, no apagarse como interruptor. Sensación "premium" |
| **BACK_PARS** | Shimmer | 5-10 frames | ~80-160ms | Intermedio, para hi-hats y platillos |

**Implementación:**
```typescript
// Decay asimétrico por tipo
const DECAY_RATES = {
  FRONT_PARS: 0.85,   // 2-3 frames para caer a 0
  BACK_PARS: 0.70,    // 5-6 frames
  MOVERS: 0.92,       // 30+ frames (humo)
};
```

### Matiz #2: Trampa del Snare en Latino (Back Par Priority)

En Cumbia y Salsa, el **Snare/Timbal** (Back PARs) a veces lleva el ritmo maestro más que el bombo.

**Problema:** Las "bofetadas" del timbal quedan opacadas si Back PAR tiene la misma ganancia que otros géneros.

**Solución:** En Vibe Latino, el `backParGain` recibe multiplicador extra x1.2:

```typescript
// VIBE_PRESETS['latino-reggaeton']
backParGain: 4.0 * 1.2,  // = 4.8 (las bofetadas destacan sobre el bombo)
```

**Actualización de Tabla de Constraints:**

| Parámetro | Techno | Latino | Dubstep | Chill |
|-----------|--------|--------|---------|-------|
| `backParGain` | 5.0 | **4.8** ⬆️ | 5.0 | 3.0 |

### Matiz #3: Soft Knee Clipper (Anti-Parpadeo)

El Hard Clipper original corta linealmente:
```typescript
if (intensity < 0.15) intensity = 0;  // PROBLEMA: Oscilación 0.14↔0.16 = parpadeo nervioso
```

**Problema:** Si la energía oscila entre 0.14 y 0.16, la luz hace `0% → 15% → 0% → 15%...` (flickering molesto).

**Solución:** Soft Knee con rampa suave desde el umbral:

```typescript
function softKneeClip(val: number, threshold: number = 0.15): number {
  if (val < threshold) return 0;
  // Remapear [0.15, 1.0] → [0.0, 1.0] con entrada suave
  return (val - threshold) / (1 - threshold);
}

// Ejemplo:
// val = 0.14 → 0
// val = 0.15 → 0 (apenas entrando)
// val = 0.20 → (0.20-0.15)/0.85 = 0.059 → 6%
// val = 0.50 → (0.50-0.15)/0.85 = 0.412 → 41%
// val = 1.00 → (1.00-0.15)/0.85 = 1.0 → 100%
```

**Beneficio:** La transición de "oscuridad total" a "luz visible" es gradual, eliminando el flickering de borde.

---

## �📝 CONCLUSIONES

### Principios Fundamentales

1. **El Delta es Rey:** El ojo percibe cambio, no valor absoluto. 30% pulsante > 100% fijo.

2. **Separación de Responsabilidades:**
   - PARs → Bass/Rhythm (Flash Physics)
   - Móviles → Melody/Atmosphere (Inertia Physics)
   - Back PARs → Hi-hats/Shimmer (independiente)

3. **Un Motor, Muchos Sabores:** El algoritmo core es universal, los constraints son el "EQ" por género.

4. **Hard Clipper es Esencial:** Eliminar el ruido basura devuelve la negrura y el contraste.

5. **Dubstep como Benchmark:** Si funciona en Dubstep (contraste extremo), funciona en todo.

### Métricas de Éxito

| Vibe | PAR Range Esperado | MOV Comportamiento |
|------|-------------------|-------------------|
| Techno | 0% - 80% | Off en drops, On en breakdowns |
| Latino | 0% - 60% | Reactivo a voz, no constante |
| Dubstep | 0% - 100% | Contraste extremo |
| Chill | 10% - 40% | Siempre presente, fluido |

---

*"De tanto mirar el microscopio, perdimos de vista el paisaje.  
Este blueprint es el mapa para volver a verlo."*

— GeminiPunk × Copilot, Navidad 2024 🎄
