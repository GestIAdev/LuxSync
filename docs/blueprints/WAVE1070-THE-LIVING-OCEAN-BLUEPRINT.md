# 🌊 WAVE 1070: THE LIVING OCEAN
## Pre-Blueprint Arquitectónico | Ecosistema Hidrostático Generativo

**DE:** Founder & GeminiProxy  
**PARA:** Opus (System Architect)  
**REVISADO POR:** PunkOpus | Fecha: 2026-01-31  
**ESTADO:** 📋 PRE-BLUEPRINT (Pendiente Revisión)

---

## 📜 EXECUTIVE SUMMARY

Transformar Chill Lounge de física estática a **simulador oceánico vivo**. 
El sistema ya tiene una base sólida en `ChillStereoPhysics.ts` (WAVE 1064: THE FOUR WORLDS).

### Lo que YA existe vs Lo que FALTA:

| Componente | Estado | Ubicación |
|------------|--------|-----------|
| Motor de Profundidad | ✅ EXISTE | `ChillStereoPhysics.ts` líneas 53-72 |
| Zonas Oceánicas | ✅ EXISTE | `ChillStereoPhysics.ts` líneas 28-33 |
| Color Grading por Zona | ✅ EXISTE | `ChillStereoPhysics.ts` líneas 77-99 |
| Física de Fluidos | ✅ EXISTE | `ChillStereoPhysics.ts` líneas 104-113 |
| Telemetría Submarina | ✅ EXISTE | `ChillStereoPhysics.ts` línea 143 |
| **Efectos Oceánicos** | ❌ FALTA | `src/core/effects/library/chillLounge/` |
| **Triggers de Textura** | ❌ FALTA | Integrar en `ChillStereoPhysics.ts` |
| **Shield Update** | ❌ FALTA | `EffectManager.ts` ALLOW/BLOCK list |

---

## 🏗️ ARQUITECTURA ACTUAL (WAVE 1064)

### Código Existente en `ChillStereoPhysics.ts`:

```typescript
// ZONAS YA DEFINIDAS
const ZONES = {
  SHALLOWS: { min: 0, max: 200, label: '🌿' },
  OPEN_OCEAN: { min: 200, max: 1000, label: '🐬' },
  TWILIGHT: { min: 1000, max: 4000, label: '🐋' },
  MIDNIGHT: { min: 4000, max: 11000, label: '🪼' }
}

// MOTOR DE PROFUNDIDAD (45min tide cycle)
const tideCycle = 45 * 60 * 1000;
const tidePhase = (now % tideCycle) / tideCycle;
const baseDepth = 4000 * (1 + Math.sin(tidePhase * Math.PI * 2));

// LASTRE MUSICAL (centroid = flotabilidad)
const centroid = godEar.centroid || 1000;
const buoyancy = (centroid - 800) * -4;
```

**CONCLUSIÓN:** NO necesitamos crear `HydrostaticEngine.ts` ni `OceanicZones.ts` como archivos separados. La lógica ya está integrada y funciona. Solo extenderemos lo existente.

---

## 📦 ENTREGABLES WAVE 1070

### A. NUEVOS EFECTOS OCEÁNICOS (3 archivos)

Ubicación: `src/core/effects/library/chillLounge/`

#### 1. `SolarCaustics.ts` - Rayos de Sol Submarinos

**Trigger:** `clarity > 0.8 && currentDepth < 200` (zona SHALLOWS)  
**Comportamiento:** Haces de luz blanca/ámbar pálido atravesando el agua  
**MixBus:** `'global'` (override total para simular rayos de sol reales)  
**Duración:** 4000ms con decay suave

```typescript
/**
 * 🌞 SOLAR CAUSTICS - Rayos de Sol Submarinos
 * 
 * WAVE 1070: THE LIVING OCEAN
 * 
 * Simula los rayos de luz solar penetrando la superficie.
 * Se activa SOLO en zona SHALLOWS (0-200m) cuando la claridad
 * del audio es alta (voces claras, guitarras acústicas, etc.)
 * 
 * VISUAL:
 * - Movers en blanco cálido (2800K) muy pálido
 * - Movimiento lento y orgánico (caustics pattern)
 * - Intensidad modulada por la "ola" de superficie
 * 
 * TRIGGER CONDITIONS:
 * - Zone: SHALLOWS only
 * - clarity > 0.8
 * - cooldown: 8 segundos entre activaciones
 */

// CONFIG
interface SolarCausticsConfig {
  durationMs: number        // 4000ms - lento y contemplativo
  peakIntensity: number     // 0.7 - no cegar, solo acariciar
  colorTemp: number         // 2800K equivalent → amber tint
  movementSpeed: number     // 0.3 - muy lento
}

const DEFAULT_CONFIG: SolarCausticsConfig = {
  durationMs: 4000,
  peakIntensity: 0.7,
  colorTemp: 2800,
  movementSpeed: 0.3,
}

// COLORES PERMITIDOS (respeta CHILL_CONSTITUTION)
const CAUSTIC_COLOR = { h: 45, s: 30, l: 85 } // Blanco cálido con hint de amber
```

**Implementación Técnica:**
- Hereda de `BaseEffect`
- `mixBus: 'global'` para override total
- `zones: ['movers']` - solo movers crean los rayos
- Pan/Tilt con sine waves desfasadas para patrón de cáusticas
- `priority: 80` (alto, pero respeta otros efectos críticos)

---

#### 2. `SchoolOfFish.ts` - Banco de Peces

**Trigger:** `transientDensity > 0.6 && currentDepth >= 200 && currentDepth < 1000`  
**Comportamiento:** Ráfaga rápida de luz cyan cruzando L→R  
**MixBus:** `'htp'` (aditivo, no bloquea física base)  
**Duración:** 1500ms (crossing rápido)

```typescript
/**
 * 🐟 SCHOOL OF FISH - Banco de Peces Cruzando
 * 
 * WAVE 1070: THE LIVING OCEAN
 * 
 * Simula un banco de peces brillantes cruzando el campo visual.
 * Se activa cuando hay muchos transientes suaves (hi-hats, shakers)
 * en la zona OPEN_OCEAN (200-1000m).
 * 
 * VISUAL:
 * - Movers en cyan brillante
 * - Movimiento rápido de izquierda a derecha (o viceversa)
 * - Pulsos de intensidad durante el cruce (cada pez)
 * 
 * TRIGGER CONDITIONS:
 * - Zone: OPEN_OCEAN only
 * - transientDensity > 0.6 (muchos ataques percusivos suaves)
 * - cooldown: 5 segundos entre activaciones
 */

// CONFIG
interface SchoolOfFishConfig {
  durationMs: number        // 1500ms - cruce rápido
  peakIntensity: number     // 0.9 - brillante pero no cegador
  crossingDirection: 'LtoR' | 'RtoL' | 'random'
  fishCount: number         // 5-8 pulsos de intensidad durante cruce
}

const DEFAULT_CONFIG: SchoolOfFishConfig = {
  durationMs: 1500,
  peakIntensity: 0.9,
  crossingDirection: 'random',
  fishCount: 6,
}

// COLOR CYAN BRILLANTE (allowed en CHILL_CONSTITUTION: hue 135-340)
const FISH_COLOR = { h: 185, s: 95, l: 60 } // Cyan tropical
```

**Implementación Técnica:**
- `zones: ['movers_left', 'movers_right']` con timing desfasado
- Pan sweep de 0→1 en 1500ms
- Intensidad pulsante: `0.5 + sin(progress * fishCount * 2π) * 0.4`
- `priority: 70` (medio-alto)

---

#### 3. `AbyssalJellyfish.ts` - Medusa Bioluminiscente

**Trigger:** `spectralFlatness < 0.3 && currentDepth >= 4000`  
**Comportamiento:** Pulsos lentos de colores neón en pars  
**MixBus:** `'htp'` (aditivo, brilla sobre el darkness del abyss)  
**Duración:** 6000ms (muy lento, meditativo)

```typescript
/**
 * 🪼 ABYSSAL JELLYFISH - Medusa del Abismo
 * 
 * WAVE 1070: THE LIVING OCEAN
 * 
 * Simula medusas bioluminiscentes en las profundidades.
 * Se activa cuando el audio tiene tonos puros (bajo contenido armónico)
 * en la zona MIDNIGHT (>4000m).
 * 
 * VISUAL:
 * - Pars con colores "prohibidos" (magenta/lima neón)
 * - Pulsos muy lentos (cada 2 segundos)
 * - Intensidad baja pero saturación máxima
 * 
 * NOTA COLOR:
 * Los colores magenta/lima están FUERA de CHILL_CONSTITUTION allowedHueRanges
 * PERO este efecto los inyecta DIRECTAMENTE como override.
 * Esto es intencional: la bioluminiscencia es "alienígena" al océano normal.
 * 
 * TRIGGER CONDITIONS:
 * - Zone: MIDNIGHT only
 * - spectralFlatness < 0.3 (tonos puros, no ruido)
 * - cooldown: 10 segundos entre activaciones
 */

// CONFIG
interface AbyssalJellyfishConfig {
  durationMs: number        // 6000ms - muy lento
  peakIntensity: number     // 0.5 - solo un destello en la oscuridad
  pulseIntervalMs: number   // 2000ms - una medusa cada 2 segundos
  colors: { h: number, s: number, l: number }[]
}

const DEFAULT_CONFIG: AbyssalJellyfishConfig = {
  durationMs: 6000,
  peakIntensity: 0.5,
  pulseIntervalMs: 2000,
  colors: [
    { h: 300, s: 100, l: 45 },  // Magenta neón
    { h: 120, s: 100, l: 50 },  // Lima neón
    { h: 280, s: 100, l: 40 },  // Violeta profundo
  ]
}
```

**Implementación Técnica:**
- `zones: ['front', 'back', 'pars']` - no movers (demasiado profundo)
- Ciclo de colores: rota entre los 3 cada pulso
- Gaussian pulse para el bloom: `exp(-((t - center)^2) / (2 * sigma^2))`
- `priority: 60` (bajo, no interrumpe nada)

---

### B. INTEGRACIÓN EN `ChillStereoPhysics.ts`

Añadir sistema de **Texture Monitor** para detectar condiciones de trigger:

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 🔍 WAVE 1070: TEXTURE MONITOR - Detección de Condiciones para Efectos
// ═══════════════════════════════════════════════════════════════════════════

interface OceanicTriggers {
  solarCaustics: boolean    // clarity > 0.8 && depth < 200
  schoolOfFish: boolean     // transientDensity > 0.6 && depth 200-1000
  abyssalJellyfish: boolean // spectralFlatness < 0.3 && depth > 4000
}

// Cooldowns (en ms)
const COOLDOWNS = {
  solarCaustics: 8000,
  schoolOfFish: 5000,
  abyssalJellyfish: 10000,
}

let lastTriggerTime: Record<keyof OceanicTriggers, number> = {
  solarCaustics: 0,
  schoolOfFish: 0,
  abyssalJellyfish: 0,
}

function checkOceanicTriggers(godEar: any, depth: number, now: number): OceanicTriggers {
  const clarity = godEar.clarity || 0
  const transientDensity = godEar.transientDensity || 0
  const spectralFlatness = godEar.spectralFlatness || 0.5
  
  return {
    solarCaustics: 
      depth < 200 && 
      clarity > 0.8 && 
      now - lastTriggerTime.solarCaustics > COOLDOWNS.solarCaustics,
      
    schoolOfFish: 
      depth >= 200 && depth < 1000 &&
      transientDensity > 0.6 &&
      now - lastTriggerTime.schoolOfFish > COOLDOWNS.schoolOfFish,
      
    abyssalJellyfish:
      depth >= 4000 &&
      spectralFlatness < 0.3 &&
      now - lastTriggerTime.abyssalJellyfish > COOLDOWNS.abyssalJellyfish,
  }
}
```

**Integración en `calculateChillStereo`:**

```typescript
// Al final de la función, antes del return:

// 🔍 WAVE 1070: Check triggers (returns via DeepFieldOutput.triggers)
const triggers = checkOceanicTriggers(godEar, currentDepth, now)

// Actualizar cooldowns si se dispara
if (triggers.solarCaustics) lastTriggerTime.solarCaustics = now
if (triggers.schoolOfFish) lastTriggerTime.schoolOfFish = now
if (triggers.abyssalJellyfish) lastTriggerTime.abyssalJellyfish = now

return {
  // ... existing output ...
  
  // 🆕 WAVE 1070: Triggers para EffectManager
  oceanicTriggers: triggers,
}
```

**Nota:** El `DeepFieldOutput` interface necesita extenderse:
```typescript
export interface DeepFieldOutput {
  // ... existing ...
  oceanicTriggers?: {
    solarCaustics: boolean
    schoolOfFish: boolean
    abyssalJellyfish: boolean
  }
}
```

---

### C. SHIELD UPDATE en `EffectManager.ts`

Añadir ALLOW LIST estricta para Chill Lounge:

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 1070: CHILL LOUNGE SHIELD - ALLOW LIST ESTRICTA
// ═══════════════════════════════════════════════════════════════════════════

const CHILL_LOUNGE_ALLOWED_EFFECTS = [
  // WAVE 1070: Oceanic Effects
  'solar_caustics',
  'school_of_fish',
  'abyssal_jellyfish',
  
  // Legacy allowed (atmospheric, non-dynamic)
  'deep_breath',      // Respiración orgánica
  'stage_wash',       // Wash cálido (isDynamic: false)
]

const CHILL_LOUNGE_BLOCKED_EFFECTS = [
  // Strobes - NEVER
  'industrial_strobe',
  'strobe_storm',
  'strobe_burst',
  'ambient_strobe',
  
  // Aggressive dynamics - NEVER
  'gatling_raid',
  'core_meltdown',
  'thunder_struck',
  'feedback_storm',
  
  // Fast sweeps - NEVER
  'acid_sweep',
  'sky_saw',
  'arena_sweep',
]

// En validateWithShield(), añadir ANTES de las reglas existentes:
private validateWithShield(effectType: string, vibeId: string): ShieldValidation {
  
  // ═══════════════════════════════════════════════════════════════
  // 🛡️ WAVE 1070: CHILL LOUNGE - STRICT ALLOW LIST
  // ═══════════════════════════════════════════════════════════════
  if (vibeId === 'chill-lounge') {
    // Check block list first
    if (CHILL_LOUNGE_BLOCKED_EFFECTS.includes(effectType)) {
      return {
        allowed: false,
        degraded: false,
        message: `[SHIELD 🛡️] ${effectType} BLOCKED in chill-lounge (explicit block list)`,
      }
    }
    
    // Check allow list
    if (!CHILL_LOUNGE_ALLOWED_EFFECTS.includes(effectType)) {
      return {
        allowed: false,
        degraded: false,
        message: `[SHIELD 🛡️] ${effectType} BLOCKED in chill-lounge (not in allow list)`,
      }
    }
    
    // Allowed effect - proceed with normal validation
    return { allowed: true, degraded: false, message: 'Allowed by Chill Shield' }
  }
  
  // ... rest of existing validation ...
}
```

---

### D. CONEXIÓN SeleneLux → EffectManager

En `SeleneLux.ts`, donde se procesa el output de `ChillStereoPhysics`:

```typescript
// Después de recibir result de calculateChillStereo:

// 🆕 WAVE 1070: Process oceanic triggers
if (result.oceanicTriggers) {
  const { oceanicTriggers } = result
  
  if (oceanicTriggers.solarCaustics) {
    this.effectManager?.trigger({
      effectType: 'solar_caustics',
      source: 'chill_texture_monitor',
      intensity: 0.8,
      musicalContext: context,
    })
    console.log('[🌞 SOLAR] Caustics triggered - surface light!')
  }
  
  if (oceanicTriggers.schoolOfFish) {
    this.effectManager?.trigger({
      effectType: 'school_of_fish',
      source: 'chill_texture_monitor',
      intensity: 0.9,
      musicalContext: context,
    })
    console.log('[🐟 FISH] School crossing!')
  }
  
  if (oceanicTriggers.abyssalJellyfish) {
    this.effectManager?.trigger({
      effectType: 'abyssal_jellyfish',
      source: 'chill_texture_monitor',
      intensity: 0.5,
      musicalContext: context,
    })
    console.log('[🪼 JELLY] Bioluminescence pulse!')
  }
}
```

---

## 🔒 SEGURIDAD & RESTRICCIONES

### Hardware Safety (HardwareSafetyLayer)

Los efectos oceánicos **DEBEN** respetar:

1. **Color Change Rate:** Máximo 1 cambio de color cada 500ms en movers
2. **Pan/Tilt Speed:** Máximo 15°/frame para evitar whiplash mecánico
3. **Dimmer Slew:** Transiciones de dimmer suavizadas (no 0→100 instantáneo)

**SchoolOfFish** es el más riesgoso porque:
- Hace pan sweep de 180° en 1.5 segundos
- Solución: Usar **intensidad para el ritmo**, mantener pan como interpolación lineal suave

```typescript
// En SchoolOfFish, usar HardwareSafetyLayer:
const safePan = HardwareSafetyLayer.interpolatePan(
  currentPan, 
  targetPan, 
  this.config.durationMs
)
```

### Constitution Compliance

| Efecto | Respeta CHILL_CONSTITUTION |
|--------|---------------------------|
| SolarCaustics | ✅ Sí - Color blanco cálido (neutro) |
| SchoolOfFish | ✅ Sí - Cyan (hue 185) dentro de [135, 340] |
| AbyssalJellyfish | ⚠️ Parcial - Magenta/Lima override intencional |

**Justificación AbyssalJellyfish:**  
La bioluminiscencia es un fenómeno "alienígena" al océano normal. Los colores prohibidos (magenta 300°, lima 120°) representan la luz de criaturas que NO siguen las reglas naturales. El override es **artísticamente intencional**.

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

```
[ ] 1. Crear carpeta src/core/effects/library/chillLounge/
[ ] 2. Implementar SolarCaustics.ts
[ ] 3. Implementar SchoolOfFish.ts  
[ ] 4. Implementar AbyssalJellyfish.ts
[ ] 5. Crear index.ts con exports
[ ] 6. Registrar efectos en EffectManager constructor
[ ] 7. Añadir EFFECT_VIBE_RULES para los 3 efectos
[ ] 8. Añadir EFFECT_ZONE_MAP para los 3 efectos
[ ] 9. Implementar CHILL_LOUNGE_ALLOWED/BLOCKED lists
[ ] 10. Modificar validateWithShield() con Chill Shield
[ ] 11. Extender DeepFieldOutput interface con oceanicTriggers
[ ] 12. Añadir checkOceanicTriggers() a ChillStereoPhysics.ts
[ ] 13. Conectar triggers en SeleneLux.ts
[ ] 14. Build & Test
[ ] 15. Documentar en WAVE log
```

---

## 🎬 PERFORMANCE NARRATIVE

### "Descent" - Una Experiencia de 45 Minutos

| Tiempo | Zona | Depth | Colores | Efectos Activos | Mood |
|--------|------|-------|---------|-----------------|------|
| 0:00 | 🌿 SHALLOWS | 0m | Verde/Esmeralda | SolarCaustics | Calma solar |
| 0:05 | 🌿 SHALLOWS | 150m | Verde brillante | SolarCaustics | Warmth |
| 0:10 | 🐬 OCEAN | 500m | Cyan/Aqua | SchoolOfFish | Curiosidad |
| 0:15 | 🐬 OCEAN | 900m | Azul tropical | SchoolOfFish | Exploración |
| 0:22 | 🐋 TWILIGHT | 2000m | Índigo | DeepBreath | Presión |
| 0:30 | 🐋 TWILIGHT | 3500m | Violeta oscuro | DeepBreath | Soledad |
| 0:35 | 🪼 MIDNIGHT | 5000m | Negro + neón | AbyssalJellyfish | Misterio |
| 0:40 | 🪼 MIDNIGHT | 7000m | UV/Magenta | AbyssalJellyfish | Alien |
| 0:45 | 🪼 MIDNIGHT | 8000m | Pitch black + flashes | AbyssalJellyfish | Transcendencia |

**Nota:** A las 0:45 el ciclo de marea comienza a subir de nuevo. La experiencia es cíclica e infinita.

---

## 🎯 MÉTRICAS DE ÉXITO

1. **Zero Strobes:** Ningún efecto tipo strobe debe dispararse en Chill Lounge
2. **Zone Coherence:** Efectos deben coincidir con la zona de profundidad actual
3. **Cooldown Respect:** No spam de efectos (mínimo 5 segundos entre cada tipo)
4. **Hardware Health:** Movers no deben recibir más de 2 cambios de color/segundo
5. **Atmospheric Continuity:** La física base NUNCA debe ser interrumpida por efectos (HTP, no global para la mayoría)

---

## 🔮 EXPANSIONES FUTURAS (POST-1070)

1. **PlanktonCloud:** Partículas de luz parpadeante en pars cuando hay mucho ruido blanco
2. **WhaleCall:** Fade-out total de 3 segundos cuando detecta sub-bass profundo (<40Hz)
3. **ThermalVent:** Explosión cálida de luz naranja/roja desde el fondo cuando hay kick muy pesado en zona MIDNIGHT
4. **SurfaceBreak:** Flash blanco cuando se rompe la superficie (depth < 10m)

---

## ✅ APROBACIÓN

Este blueprint ha sido revisado y está listo para implementación.

**Notas del Arquitecto (PunkOpus):**

> La base ya existe y es sólida. WAVE 1064 hizo el trabajo pesado.
> Lo que falta son los EFECTOS (las criaturas del océano) y su CONEXIÓN
> al sistema de triggers. No hay que reinventar la rueda.
>
> Recomiendo implementar en este orden:
> 1. Shield Update (bloquea basura primero)
> 2. SolarCaustics (el más simple)
> 3. SchoolOfFish (el más visible)
> 4. AbyssalJellyfish (el más artístico)
> 5. Conexión en SeleneLux
>
> El océano ya respira. Ahora le damos vida. 🌊

---

**FIN DEL BLUEPRINT WAVE 1070**

```
╔══════════════════════════════════════════════════════════════════╗
║  "The ocean does not rage. It breathes. And sometimes, when     ║
║   the conditions are right, it glows."                          ║
║                                                                  ║
║                              - THE LIVING OCEAN MANIFESTO        ║
╚══════════════════════════════════════════════════════════════════╝
```
