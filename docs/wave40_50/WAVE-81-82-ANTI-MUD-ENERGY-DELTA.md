# 🎨 WAVE 81-82: Anti-Mud Protocol + Energy Delta Model

## 📅 Fecha: 2025-01-XX
## 🎯 Objetivo: Colores vibrantes + Detección reactiva de secciones

---

## 🔴 WAVE 81: PROTOCOLO ANTI-BARRO

### Problema Original
Los colores en la **zona amarillo/naranja (Hue 20-55)** se volvían **marrones/sucios** cuando:
- La luminosidad caía por debajo del 45%
- La saturación era demasiado baja

**Resultado**: Fiestas latinas que parecían un **pantano** en lugar de una celebración vibrante.

### Solución Implementada

**Archivo**: `SeleneColorEngine.ts`  
**Ubicación**: Después del cálculo de `primaryLight` (líneas ~693-738)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 81: PROTOCOLO ANTI-BARRO (Anti-Mud Protocol)
// ═══════════════════════════════════════════════════════════════════════════
// PROBLEMA: Los colores amarillos/naranjas (Hue 20-55) se vuelven MARRONES
// cuando la luminosidad es baja. Esto destruye la vibración de Fiesta Latina.
// 
// SOLUCIÓN: Forzar mínimos de Saturación y Luminosidad en contextos festivos
// para la ZONA DE PELIGRO (tonos cálidos que tienden al barro).
// ═══════════════════════════════════════════════════════════════════════════

let correctedSat = primarySat;
let correctedLight = primaryLight;

// Detectar contexto festivo vs oscuro
const isFestiveContext = mood === 'bright' || mood === 'energetic' || mood === 'euphoric';
const isDarkContext = mood === 'dark';

if (isFestiveContext) {
  // 🚨 ZONA DE PELIGRO: Hue 20-55 (naranjas y amarillos)
  const isDangerZone = finalHue > 20 && finalHue < 55;
  
  if (isDangerZone) {
    // 🎨 Anti-Barro AGRESIVO: Forzar colores vibrantes
    correctedLight = Math.max(correctedLight, 45);  // Mínimo L=45
    correctedSat = Math.max(correctedSat, 80);      // Mínimo S=80
  } else {
    // 🎨 Anti-Barro SUAVE: Mantener vivacidad general
    correctedLight = Math.max(correctedLight, 30);
    correctedSat = Math.max(correctedSat, 60);
  }
}

// Contexto oscuro: neón vibrante incluso en oscuridad
if (isDarkContext) {
  correctedSat = Math.max(correctedSat, 70);  // Neón mínimo
}

// 🎨 Color primario ahora usa valores corregidos
const primaryColor: HSL = {
  h: finalHue,
  s: correctedSat,    // ← ANTES: primarySat
  l: correctedLight   // ← ANTES: primaryLight
};
```

### Impacto

| Contexto | Zona de Peligro (Hue 20-55) | Otros Colores |
|----------|----------------------------|---------------|
| **Festivo** | L≥45, S≥80 (Anti-barro agresivo) | L≥30, S≥60 (vivacidad) |
| **Oscuro** | S≥70 (neón vibrante) | S≥70 (neón vibrante) |
| **Neutral** | Sin cambios | Sin cambios |

---

## 🔵 WAVE 82: ENERGY DELTA MODEL

### Problema Original
El `SectionTracker` usaba lógica compleja de **compases y votación** que era:
- Lenta para reaccionar (esperaba múltiples compases)
- Complicada de mantener
- No capturaba cambios de energía instantáneos

### Solución Implementada

**Archivo**: `SectionTracker.ts`  
**Ubicación**: Inicio del método `detectSection()` (líneas ~535-595)

#### Nuevas Variables de Estado

```typescript
// 🌊 WAVE 82: Energy Delta Model - Variables de estado
private avgEnergy: number = 0.5;      // Energía promedio (inercia lenta ~2s)
private instantEnergy: number = 0.5;   // Energía instantánea (reacción rápida ~100ms)
private timeInLowEnergy: number = 0;   // Tiempo acumulado en baja energía
private lastFrameTime: number = Date.now();
```

#### Física del Energy Delta Model

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 82: ENERGY DELTA MODEL
// ═══════════════════════════════════════════════════════════════════════════
// CONCEPTO: Comparar energía instantánea vs promedio móvil
// - avgEnergy: Inercia de ~2 segundos (smoothing 0.02 = ~50 frames)
// - instantEnergy: Reacción de ~100ms (smoothing 0.3 = ~3 frames)
// 
// DELTA = instantEnergy - avgEnergy
// - Delta > +0.15 → Subida de energía (potential DROP/BUILDUP)
// - Delta < -0.15 → Bajada de energía (potential BREAKDOWN/VERSE)
// ═══════════════════════════════════════════════════════════════════════════

const now = Date.now();
const deltaTime = (now - this.lastFrameTime) / 1000; // En segundos
this.lastFrameTime = now;

// Energía combinada del frame actual
const frameEnergy = (audio.bass * 0.5 + audio.mid * 0.3 + audio.presence * 0.2);

// 🌊 Actualizar promedios con diferentes velocidades de suavizado
const SLOW_SMOOTH = 0.02;   // Inercia lenta (~2 segundos para estabilizarse)
const FAST_SMOOTH = 0.3;    // Reacción rápida (~100ms)

this.avgEnergy = this.avgEnergy * (1 - SLOW_SMOOTH) + frameEnergy * SLOW_SMOOTH;
this.instantEnergy = this.instantEnergy * (1 - FAST_SMOOTH) + frameEnergy * FAST_SMOOTH;

// 🌊 DELTA = diferencia entre reacción rápida y promedio lento
const energyDelta = this.instantEnergy - this.avgEnergy;

// 🌊 Clasificación por delta
const DELTA_THRESHOLD_UP = 0.15;    // Umbral de subida
const DELTA_THRESHOLD_DOWN = -0.15; // Umbral de bajada
const LOW_ENERGY_THRESHOLD = 0.25;  // Energía baja absoluta

// Detectar tiempo en baja energía (para BREAKDOWN prolongado)
if (frameEnergy < LOW_ENERGY_THRESHOLD) {
  this.timeInLowEnergy += deltaTime;
} else {
  this.timeInLowEnergy = 0;
}

// 🌊 EARLY RETURN BASADO EN DELTA (complementa el sistema de votación)
// Si el delta es muy pronunciado, puede influir en la votación
if (energyDelta > DELTA_THRESHOLD_UP * 1.5) {
  // Subida MUY fuerte: añadir voto extra para DROP o BUILDUP
  // Esto no reemplaza la votación, la refuerza
  this.sectionVotes.drop = (this.sectionVotes.drop || 0) + 0.5;
  this.sectionVotes.buildup = (this.sectionVotes.buildup || 0) + 0.3;
}

if (energyDelta < DELTA_THRESHOLD_DOWN * 1.5) {
  // Bajada MUY fuerte: añadir voto extra para BREAKDOWN
  this.sectionVotes.breakdown = (this.sectionVotes.breakdown || 0) + 0.5;
}

// Tiempo prolongado en baja energía: reforzar BREAKDOWN/INTRO
if (this.timeInLowEnergy > 4.0) { // Más de 4 segundos en baja energía
  this.sectionVotes.breakdown = (this.sectionVotes.breakdown || 0) + 0.3;
  this.sectionVotes.intro = (this.sectionVotes.intro || 0) + 0.2;
}
```

### Concepto Físico

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ENERGY DELTA MODEL                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  avgEnergy ──────────── Inercia lenta (~2s) ─────────────►          │
│           \                                                         │
│            \    DELTA = instantEnergy - avgEnergy                   │
│             \                                                       │
│              \                                                      │
│  instantEnergy ── Reacción rápida (~100ms) ─────────────►           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ DELTA > +0.15  →  🔥 Subida de energía (DROP/BUILDUP)       │   │
│  │ DELTA < -0.15  →  ❄️ Bajada de energía (BREAKDOWN/VERSE)     │   │
│  │ |DELTA| < 0.15 →  🔄 Estabilidad (mantener sección actual)  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Compatibilidad con Sistema Existente

El Energy Delta Model **NO reemplaza** el sistema de votación de WAVE 70/70.5:
- Añade **votos fractionales** (0.3-0.5) cuando detecta deltas pronunciados
- El sistema de votación sigue tomando la decisión final
- Los DROP timeouts y cooldowns siguen funcionando igual

---

## 📊 ARCHIVOS MODIFICADOS

| Archivo | Cambios | Estado |
|---------|---------|--------|
| `SeleneColorEngine.ts` | Anti-Mud Protocol (~45 líneas) | ✅ Compila limpio |
| `SectionTracker.ts` | Energy Delta Model (~65 líneas) | ✅ Compila limpio |

---

## 🧪 CÓMO VERIFICAR

### Anti-Mud Protocol (WAVE 81)
1. Reproducir música latina/reggaeton
2. Observar colores en zona naranja/amarillo
3. **ANTES**: Podían verse marrones/sucios
4. **DESPUÉS**: Siempre vibrantes (L≥45, S≥80)

### Energy Delta Model (WAVE 82)
1. Reproducir música con cambios bruscos de energía
2. Observar transiciones de sección
3. **ANTES**: Tardaba varios compases en reaccionar
4. **DESPUÉS**: Detecta cambios de energía en ~100-200ms

---

## 🔗 DEPENDENCIAS

- **WAVE 79**: SeleneLux SSOT guard (protege colores del Worker)
- **WAVE 80**: useFixtureRender PRIORITY 2 (permite Flow mode)
- **WAVE 70/70.5**: DROP timeout y cooldown system (compatible)

---

## ✅ ESTADO FINAL

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WAVE 81 + WAVE 82 COMPLETE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ Anti-Mud Protocol      → Colores vibrantes en zona peligrosa    │
│  ✅ Energy Delta Model     → Detección reactiva de secciones        │
│  ✅ Compilación limpia     → 0 errores en ambos archivos            │
│  ✅ Compatibilidad         → Sistema de votación WAVE 70 intacto    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Documentación generada para WAVES 81-82 del sistema LuxSync/Selene*
