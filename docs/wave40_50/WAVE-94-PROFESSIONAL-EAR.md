# 🎧 WAVE 94: THE PROFESSIONAL EAR
## AGC (Automatic Gain Control) Implementation

---

## EL PROBLEMA

La cadena de señal de LuxSync era **víctima del nivel de entrada**:

| Fuente | Pico típico | Resultado |
|--------|-------------|-----------|
| MP3 salsa mal masterizada | 0.3 | **Luces apagadas** (bajo gate 0.40) |
| WAV cumbia clippeada | 0.9 | **Muro de luz** (siempre sobre gate) |

La música no "sonaba" igual porque el sistema no normalizaba la señal antes de decidir.

---

## LA SOLUCIÓN: AGC ADAPTATIVO

### Arquitectura

```
                    ┌─────────────────────────────────────────┐
                    │              MENTE (mind.ts)            │
                    │                                         │
  Audio Crudo ──────►│  ┌───────────────────────────────┐    │
  (energy: 0.3)      │  │    AutomaticGainControl       │    │
                     │  │                               │    │
                     │  │  maxPeak = 0.3 (tracking)     │    │
                     │  │  gain = 1/0.3 = 3.33          │    │
                     │  │                               │    │
                     │  │  normalized = 0.3 * 3.33 = 1.0│    │
                     │  └───────────────────────────────┘    │
                     │                    │                   │
                     │                    ▼                   │
                     │         effectiveAnalysis.energy = 1.0 │
                     │                    │                   │
                     │                    ▼                   │
                     │  ┌─────────────────────────────────┐  │
                     │  │ Arbiters (Key, Mood, Strategy)  │  │
                     │  │ Movement Selection              │  │
                     │  │ Effect Triggers                 │  │
                     │  └─────────────────────────────────┘  │
                     └─────────────────────────────────────────┘
```

### Peak Tracker con Histéresis Temporal

```typescript
// AutomaticGainControl.ts
private maxPeak = 0.001;  // Arranque conservador
private readonly PEAK_DECAY = 0.995;  // Decaimiento lento

normalize(raw: AudioMetrics): AudioMetrics {
  const peak = Math.max(raw.energy, raw.bass, raw.mid, raw.treble);
  
  // ATTACK: Instantáneo
  if (peak > this.maxPeak) {
    this.maxPeak = peak;
  } else {
    // DECAY: Lento (5 segundos para -3dB a 60fps)
    this.maxPeak *= this.PEAK_DECAY;
  }
  
  const gain = 1.0 / Math.max(this.maxPeak, 0.001);
  
  return {
    energy: Math.min(1, raw.energy * gain),
    bass: Math.min(1, raw.bass * gain),
    mid: Math.min(1, raw.mid * gain),
    treble: Math.min(1, raw.treble * gain),
  };
}
```

---

## COMPORTAMIENTO DEL DECAY

| Tiempo | maxPeak (desde 1.0) | Factor |
|--------|---------------------|--------|
| 0s | 1.000 | 1.0x |
| 1s (60 frames) | 0.741 | 1.35x |
| 2s (120 frames) | 0.549 | 1.82x |
| 5s (300 frames) | 0.223 | 4.48x |
| 10s (600 frames) | 0.050 | 20x |

**Interpretación**: Después de 10 segundos de silencio, una señal débil (0.05) se amplifica a 1.0.

---

## INTEGRACIÓN EN mind.ts

### Flujo de Datos

```typescript
// 1. Extracción cruda (SIN tocar)
const rawEnergy = analysis.energy ?? 0;
const rawBass = analysis.bass ?? 0;
const rawMid = analysis.mid ?? 0;
const rawTreble = analysis.treble ?? 0;

// 2. Normalización AGC
const normalized = state.agc.normalize({
  energy: rawEnergy,
  bass: rawBass,
  mid: rawMid,
  treble: rawTreble,
});

// 3. effectiveAnalysis para toda la lógica de decisión
const effectiveAnalysis = {
  ...analysis,
  energy: normalized.energy,
  bass: normalized.bass,
  mid: normalized.mid,
  treble: normalized.treble,
};
```

### Puntos de Uso de effectiveAnalysis

| Componente | Variable Usada | Propósito |
|------------|----------------|-----------|
| KeyStabilizer | effectiveAnalysis.energy | Detectar cambios de tonalidad |
| MoodArbiter | effectiveAnalysis.energy | Ponderar mood por energía |
| StrategyArbiter | effectiveAnalysis.energy | Seleccionar estrategia de movimiento |
| sectionToMovement | effectiveAnalysis.energy | Seleccionar patrón de movimiento |
| effectTriggers | effectiveAnalysis.energy | Disparar efectos (strobe, chase) |

### Puntos que mantienen analysis.energy original

| Función | Razón |
|---------|-------|
| calculateBeautyScore | Scoring estético, no afecta control directo |

---

## LOG DE DIAGNÓSTICO

```typescript
// AUDIO_DEBUG: Se emite 1 vez por segundo
{
  raw: { energy: 0.3, bass: 0.25, mid: 0.28, treble: 0.22 },
  normalized: { energy: 1.0, bass: 0.83, mid: 0.93, treble: 0.73 },
  gain: 3.33,
  maxPeak: 0.3
}
```

---

## RESULTADO ESPERADO

| Escenario | Antes | Después |
|-----------|-------|---------|
| MP3 salsa (pico 0.3) | Luces muertas | Respuesta normal (0.3 → 1.0) |
| WAV cumbia (pico 0.9) | Muro constante | Respuesta normal (0.9 → 1.0) |
| Transición silencio→música | Explosión súbita | Fade-in suave (decay lento) |
| Transición música→silencio | Muerte instantánea | Fade-out gradual |

---

## ARCHIVOS MODIFICADOS

1. **AutomaticGainControl.ts** (NUEVO)
   - Clase con peak tracking + normalization
   - Decay configurable (default 0.995)

2. **mind.ts**
   - Import de AutomaticGainControl
   - AGC en GammaState
   - effectiveAnalysis en generateDecision
   - Arbiters usan effectiveAnalysis.energy

---

## CADENA DE SEÑAL COMPLETA (WAVE 92-94)

```
Audio → AGC (WAVE 94) → Relative Gates (WAVE 94.2) → Intensity Curves
        ↓                ↓                            ↓
        Normaliza        Gate dinámico                pow(x) para punch
        0.3 → 1.0        avgEnergy * factor           PARS: pow(3) "LÁTIGO"
        0.9 → 1.0        PARS: *0.6                   MOVERS: pow(2) "CORO"
                         MOVERS: *0.3
```

---

## 🎯 WAVE 94.2: RELATIVE GATES

### El Problema de los Gates Fijos

| Canción | Avg Energy | Gate Fijo 0.40 | Resultado |
|---------|------------|----------------|-----------|
| Salsa tranquila | 0.4 | 0.40 | ❌ Luces parpadean |
| Cumbia muro | 0.8 | 0.40 | ❌ PARS siempre encendidos |

### La Solución: Gate Relativo

```
Relative Gate = avgNormEnergy × factor
```

#### PARS (El Látigo - Percusión)
- **Fuente**: Solo `normBass` (ignorar mids/highs)
- **Gate**: `> (avgNormEnergy * 0.6)`
- **Curva**: `pow(3)` - Golpes secos y picudos
- **Efecto**: En cumbia (avg 0.8), gate = 0.48. Los pequeños valles apagan la luz.

#### MOVERS (El Coro - Melodía/Voz)
- **Fuente**: `(normMid + normTreble) / 2` (captura voz y autotune)
- **Gate**: `> (avgNormEnergy * 0.3)` - Más permisivo
- **Curva**: `pow(2)` - Movimiento orgánico
- **Efecto**: Se mueven casi siempre, salvo en silencios reales.

### Comportamiento por Canción

| Canción | avgNormEnergy | Gate PARS | Gate MOVERS |
|---------|---------------|-----------|-------------|
| Salsa tranquila | 0.40 | 0.24 | 0.12 |
| Cumbia muro | 0.80 | 0.48 | 0.24 |
| Balada suave | 0.30 | 0.18 | 0.09 |
| Drop EDM | 0.90 | 0.54 | 0.27 |

---

## IMPLEMENTACIÓN

### AGC (AutomaticGainControl.ts)

```typescript
// Rolling average para Relative Gates (~3s window)
private avgNormEnergy: number = 0.5;
private readonly AVG_ALPHA = 0.01; // EMA

update(raw): AGCOutput {
  // ... peak tracking + normalization ...
  
  // Rolling average para gates dinámicos
  this.avgNormEnergy = this.avgNormEnergy * 0.99 + normalizedEnergy * 0.01;
  
  return { 
    normalizedEnergy, normalizedBass, normalizedMid, normalizedTreble,
    avgNormEnergy: this.avgNormEnergy  // 🎯 WAVE 94.2
  };
}
```

### main.ts - Loop de Fixtures

```typescript
// Obtener datos AGC normalizados
const agcData = selene.getAgcData()
const normBass = agcData?.normalizedBass ?? audioInput.bass
const normMid = agcData?.normalizedMid ?? audioInput.mid
const normTreble = agcData?.normalizedTreble ?? audioInput.treble
const avgNormEnergy = agcData?.avgNormEnergy ?? 0.5

// PARS: Relative Gate + Cúbica
case 'FRONT_PARS':
  const relativeGate = avgNormEnergy * 0.6;
  if (normBass < relativeGate) {
    intensity = 0;
  } else {
    const normalized = (normBass - relativeGate) / (1 - relativeGate);
    intensity = Math.pow(normalized, 3);  // LÁTIGO
  }

// MOVERS: Relative Gate + Cuadrática
case 'MOVING_LEFT':
  const melodyEnergy = (normMid + normTreble) / 2;
  const relativeGate = avgNormEnergy * 0.3;
  if (melodyEnergy < relativeGate) {
    intensity = 0;
  } else {
    const normalized = (melodyEnergy - relativeGate) / (1 - relativeGate);
    intensity = Math.pow(normalized, 2);  // CORO
  }
```

---

## FECHA: Junio 2025
## STATUS: ✅ IMPLEMENTADO

---

## 🧂 WAVE 94.2: SALT CROMÁTICO (Diferenciación de Gemelas)

### EL PROBLEMA: Monotonía Cromática en Fiesta Latina

En el vibe `fiesta-latina`, el **warm filter** (mood='bright' → 0-60° rango cálido) comprime todas las keys al espectro naranja-amarillo, haciendo que **F Major** y **A Major** se vean idénticas visualmente:

| Key | Hue Natural | Post Warm Filter | Resultado Visual |
|-----|-------------|------------------|------------------|
| F Major | 150° (Verde-Lima) | ~30° (Naranja) | 🟠 Naranja |
| A Major | 270° (Violeta) | ~30° (Naranja) | 🟠 Naranja |

**Problema**: El público no puede distinguir cambios de tonalidad durante la canción.

### LA SOLUCIÓN: Rotación Cromática Específica

Aplicamos una **rotación adicional** al color secundario **solo para F Major y A Major** en el vibe `fiesta-latina`:

```typescript
// SeleneColorEngine.ts - línea ~781
let saltRotation = 0;
if (isLatinoVibe && key) {
  const keyIndex = KEY_TO_ROOT[key]; // 0=C, 5=F, 9=A
  if (keyIndex === 5) saltRotation = -35;       // F → Lima
  else if (keyIndex === 9) saltRotation = +35;  // A → Miami Pink
}

const secondaryHue = normalizeHue(finalHue + fibonacciRotation + saltRotation);
```

### Resultado Visual

| Key | Warm Filter Base | Salt Rotation | Resultado Final |
|-----|------------------|---------------|-----------------|
| F Major | 30° (Naranja) | **-35°** | ~355° (Lima/Verde-Amarillo) 🟢 |
| A Major | 30° (Naranja) | **+35°** | ~65° (Rosa Miami/Magenta) 🌺 |

Ahora el público puede **ver la diferencia** entre las tonalidades durante una cumbia que modula de F a A.

### Filosofía del Salt

- **No altera el primary color** (usado para auditoría de key)
- **Solo afecta al secondary** (color de ambiente/fondo)
- **Exclusivo de Fiesta Latina** (otros vibes mantienen su lógica)
- **Diferenciación selectiva**: Solo F y A (las más problemáticas)

### Archivos Modificados

```
electron-app/src/main/selene-lux-core/engines/visual/SeleneColorEngine.ts
  - Línea 781: Salt Cromático antes de calcular secondaryHue
  - Usa KEY_TO_ROOT existente para obtener root numérico
```

---

## FECHA WAVE 94.2: Enero 2025
## STATUS: ✅ IMPLEMENTADO

---

## 🏛️ WAVE 94.3: MINT & NAVY OVERRIDE (Luxury Signatures)

### EVOLUCIÓN: De Rotación a Asignación Directa

**WAVE 94.2** usaba rotación cromática (`-35°` y `+35°`) para diferenciar F y A Major, pero el resultado seguía siendo dependiente del warm filter. **WAVE 94.3** va más allá: **asigna colores signature específicos** que definen la identidad visual de cada tonalidad.

### Los Colores Signature

| Key | Secondary (Signature) | Ambient (Complementario) | Paleta Resultante |
|-----|----------------------|--------------------------|-------------------|
| **F Major** | 🌿 **MINT** (160°) | 🍓 **BERRY** (340°) | Verde Menta & Magenta |
| **A Major** | 🌊 **NAVY** (230°) | ✨ **GOLD** (50°) | Azul Marino & Dorado |

### Implementación

```typescript
// SeleneColorEngine.ts - línea ~801
if (isLatinoVibe && key) {
  const keyIndex = KEY_TO_ROOT[key];
  
  if (keyIndex === 5) {
    // F MAJOR -> MINT & BERRY
    secondary.h = 160;  // Verde Menta / Espuma de mar
    secondary.s = Math.min(secondary.s, 85);  // Saturación pastel
  } else if (keyIndex === 9) {
    // A MAJOR -> NAVY & GOLD
    secondary.h = 230;  // Azul Marino / Royal Blue
  }
  // ambient.h se recalcula en WAVE 85 TROPICAL MIRROR
}
```

### Interacción con WAVE 85 (TROPICAL MIRROR)

El override de WAVE 94.3 se ejecuta **ANTES** del TROPICAL MIRROR (WAVE 85), que automáticamente calcula:

```typescript
ambient.h = normalizeHue(secondary.h + 180);
```

Resultado:
- **F Major**: `secondary.h = 160°` → `ambient.h = 340°` (Mint → Berry) 🌿🍓
- **A Major**: `secondary.h = 230°` → `ambient.h = 50°` (Navy → Gold) 🌊✨

### Filosofía: Identidad Visual Musical

Cada tonalidad tiene ahora una **firma cromática única**:

- **F Major** = Tropical, fresco, orgánico (Mint & Berry)
- **A Major** = Elegante, lujoso, profundo (Navy & Gold)

Esto permite que el público **identifique la tonalidad por color** durante una performance, convirtiendo la música en un lenguaje visual coherente.

### Archivos Modificados

```
electron-app/src/main/selene-lux-core/engines/visual/SeleneColorEngine.ts
  - Línea 801: MINT & NAVY OVERRIDE antes de accent calculation
  - Usa KEY_TO_ROOT existente
  - Se integra con TROPICAL MIRROR (WAVE 85)
```

---

## FECHA WAVE 94.3: Enero 2025
## STATUS: ✅ IMPLEMENTADO
