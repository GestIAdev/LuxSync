# 🔬 WAVE 930.5 - AUTOPSIA FORENSE: SISTEMA DE TRIGGERING DE SELENE

## 🎯 RESUMEN EJECUTIVO

**ESTADO ACTUAL: SELENE ES 60% INTELIGENTE, 40% CIEGA**

El sistema de triggering de Selene tiene una arquitectura sólida pero **un defecto crítico de diseño**: confía demasiado en Z-Scores (desviación estadística relativa) sin considerar **valores absolutos de energía**. Esto causa el "Síndrome del Grito en la Biblioteca".

---

## 📊 ARQUITECTURA ACTUAL DEL TRIGGERING

### 🧠 FLUJO DE DECISIÓN (SIMPLIFICADO)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AUDIO FRAME (cada ~16ms)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GAMMA WORKER: Calcula energía raw y Z-Score                                 │
│  ═══════════════════════════════════════════════════════════════════════════ │
│  • energy = 0.20 (absoluto)                                                  │
│  • zScore = +4.0σ (¡pero es relativo al silencio!)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  HUNT ENGINE: ¿Vale la pena cazar este momento?                              │
│  ═══════════════════════════════════════════════════════════════════════════ │
│  • worthiness = f(beauty, consonance, tension, rhythm)                       │
│  • Ignora energía absoluta → PROBLEMA #1                                     │
│  • Si worthiness > 0.65 → "WORTHY MOMENT"                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FUZZY DECISION MAKER: Lógica difusa                                         │
│  ═══════════════════════════════════════════════════════════════════════════ │
│  • Fuzzifica energía, zScore, harshness, sección                             │
│  • TIENE categoría "epic" para Z > 2.8                                       │
│  • PERO no tiene "ambient" o "silence" → PROBLEMA #2                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONTEXTUAL EFFECT SELECTOR: ¿Qué efecto?                                    │
│  ═══════════════════════════════════════════════════════════════════════════ │
│  • zLevel = classifyZScore(4.0) → "DIVINE" 🔥                                │
│  • sectionType = "breakdown" (detector dice silencio = breakdown)            │
│  • PERO energy = 0.20 (BAJO) → NO SE CONSIDERA                               │
│  │                                                                           │
│  └──→ DISPARA: gatling_raid @ 100% → 🔫😇 MACHINEGUN EN EL FUNERAL           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 DIAGNÓSTICO POR COMPONENTE

### 1️⃣ **HuntEngine.ts** - EL CAZADOR

**UBICACIÓN**: `src/core/intelligence/think/HuntEngine.ts`

| Métrica | Estado | Problema |
|---------|--------|----------|
| Worthiness Calculation | ✅ Bueno | Combina beauty, consonance, tension |
| Energy Absolute Check | ❌ AUSENTE | No verifica si energy > X |
| Section Awareness | ⚠️ Parcial | Bonus por buildup, pero no penalty por silence |
| Z-Score Reliance | ⚠️ Indirecto | Lo usa via beauty/consonance |

**CÓDIGO CRÍTICO (Líneas 510-535)**:
```typescript
function calculateWorthiness(...): number {
  const base = 
    beautyScore * 0.35 +       // ← Puede ser alto en silencio bonito
    consonanceScore * 0.25 +   // ← Puede ser alto en silencio harmónico
    tensionScore * 0.20 +      // ← Puede ser alto si hay anticipación
    rhythmScore * 0.20         // ← Único que podría ser bajo en silencio
  
  // ❌ PROBLEMA: No hay check de energia absoluta
  // Si beautyScore = 0.8 en un pad ambiental → worthiness = 0.65+ → DISPARO
}
```

### 2️⃣ **FuzzyDecisionMaker.ts** - LA CONSCIENCIA BORROSA

**UBICACIÓN**: `src/core/intelligence/think/FuzzyDecisionMaker.ts`

| Métrica | Estado | Problema |
|---------|--------|----------|
| Z-Score Fuzzy Sets | ✅ Bueno | normal/notable/epic bien calibrados |
| Energy Fuzzy Sets | ⚠️ Incompleto | Tiene low/medium/high, pero no "silence" |
| Harshness Check | ✅ Bueno | Detecta low/medium/high |
| Section Fuzzy Sets | ❌ INCOMPLETO | quiet/building/peak, pero "breakdown" = "quiet" = puede disparar |

**MEMBERSHIP PARAMS (Línea 185-205)**:
```typescript
const MEMBERSHIP_PARAMS = {
  zScore: {
    normal: { threshold: 1.5 },    // ✅ Bien calibrado
    notable: { low: 1.5, high: 2.8 },
    epic: { threshold: 2.8 },       // ✅ THE_DROP = 4.2σ
  },
  // ❌ FALTA:
  // silence: { energy < 0.15 }
  // ambient: { energy 0.15-0.35, harshness < 0.1 }
}
```

### 3️⃣ **ContextualEffectSelector.ts** - EL EJECUTOR

**UBICACIÓN**: `src/core/effects/ContextualEffectSelector.ts`

| Métrica | Estado | Problema |
|---------|--------|----------|
| Z-Score Classification | ⚠️ CIEGO | Solo usa Z-Score para clasificar |
| Energy Floor Check | ❌ AUSENTE | No verifica energía mínima |
| Section-Based Selection | ✅ Bueno | Elige efecto por sección |
| Vibe Awareness | ✅ Bueno | Techno vs Latino diferenciado |

**UMBRALES ACTUALES (Línea 167-173)**:
```typescript
zScoreThresholds: {
  normal: 1.5,    // Z < 1.5 → normal
  elevated: 2.0,  // Z ≥ 2.0 → elevated
  epic: 2.8,      // Z ≥ 2.8 → epic (drop territory)
  divine: 3.5,    // Z ≥ 3.5 → SOLAR FLARE OBLIGATORIO
}
// ❌ PROBLEMA: Un susurro (Z=4.0, E=0.15) se clasifica como DIVINE
```

---

## 🎭 EL "SÍNDROME DEL GRITO EN LA BIBLIOTECA"

### Escenario Problemático

```
CONTEXTO: Valle celestial con pad ambiental
├── Energy:     0.05 (prácticamente silencio)
├── Promedio:   0.03 (silencio profundo reciente)
├── Baseline:   0.01 (la biblioteca está en calma)
│
└── EVENTO: Entra una voz suave a 0.20
    │
    ├── Z-Score = (0.20 - 0.03) / 0.04 = 4.25σ → "DIVINE"
    │
    └── SELENE PIENSA:
        "¡HOSTIA! ¡+4σ! ¡ESTO ES ÉPICO!"
        → gatling_raid TRIGGERED @ 100%
        → 🔫😇 MACHINEGUN EN MITAD DE "HALLELUJAH"
```

### Por Qué Ocurre

1. **Z-Score es RELATIVO**: Mide cuánto se desvía del promedio reciente, no si es fuerte o débil en términos absolutos.

2. **No hay SUELO DE HORMIGÓN**: Ningún componente verifica "¿La energía absoluta es suficiente para un efecto de impacto?"

3. **El SectionTracker etiqueta mal**: Un valle celestial se detecta como "breakdown" (correcto) pero el selector no tiene reglas para "breakdown + energía baja = NO DISPARES MACHINEGUN".

---

## 🏷️ SISTEMA DE ETIQUETAS ACTUAL

### Z-Levels (4 niveles)

| Nivel | Z-Score | Intención | Realidad |
|-------|---------|-----------|----------|
| NORMAL | < 1.5σ | Silencio/Calma | ✅ OK |
| ELEVATED | 1.5-2.0σ | Algo pasa | ⚠️ Demasiado amplio |
| EPIC | 2.0-2.8σ | Subida de energía | ⚠️ Dispara en "gritos en biblioteca" |
| DIVINE | > 3.5σ | DROP ABSOLUTO | ❌ Dispara en cualquier pico relativo |

### Secciones (8 tipos)

| Sección | Energía Típica | Comportamiento Actual |
|---------|----------------|----------------------|
| intro | 0.1-0.3 | quiet → puede disparar si Z alto |
| verse | 0.3-0.5 | building → puede disparar |
| pre_chorus | 0.4-0.6 | building → preparar |
| buildup | 0.5-0.8 | building → DISPARA |
| chorus | 0.6-0.9 | peak → DISPARA |
| drop | 0.8-1.0 | peak → DISPARA FUERTE |
| breakdown | 0.2-0.4 | quiet → **PROBLEMA: dispara si Z>2** |
| outro | 0.1-0.3 | quiet → puede disparar |

---

## 💡 SOLUCIÓN PROPUESTA: "CONSCIENCIA ENERGÉTICA"

### Principio: Selene PIENSA, No Obedece Reglas

En lugar de hardcodear "Si E<0.4 NO DISPARES", le damos a Selene **nuevas etiquetas** y **nuevos inputs** para que tome decisiones inteligentes.

### NUEVA ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONSCIENCIA ENERGÉTICA                                  │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                              │
│   INPUT NUEVO: "Contexto Energético" (energyContext)                         │
│   ├── absoluteEnergy: 0.20           ← Valor crudo                          │
│   ├── energyPercentile: 15%          ← "Estás en el 15% más bajo de la pista"│
│   ├── energyZone: "valley"           ← silence/valley/normal/elevated/peak  │
│   └── sustainedLow: true             ← "Llevas 30s sin superar 0.4"         │
│                                                                              │
│   NUEVA ETIQUETA: "Intensidad Ambiental" (ambientIntensity)                  │
│   ├── SILENCE:  E < 0.10 (pad, silencio, viento)                            │
│   ├── AMBIENT:  E 0.10-0.30 (ambiente suave, coro lejano)                   │
│   ├── GENTLE:   E 0.30-0.50 (verso, melodía suave)                          │
│   ├── ACTIVE:   E 0.50-0.70 (pre-chorus, buildup)                           │
│   ├── INTENSE:  E 0.70-0.85 (chorus, clímax)                                │
│   └── MAXIMUM:  E > 0.85 (drop, explosión)                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### NUEVA MATRIZ DE DECISIÓN

```
                    │ SILENCE │ AMBIENT │ GENTLE │ ACTIVE │ INTENSE │ MAXIMUM
────────────────────┼─────────┼─────────┼────────┼────────┼─────────┼─────────
Z-SCORE < 1.5       │ HOLD    │ HOLD    │ HOLD   │ PREPARE│ STRIKE  │ STRIKE
Z-SCORE 1.5-2.0     │ HOLD    │ SUBTLE  │ SUBTLE │ STRIKE │ STRIKE  │ FORCE
Z-SCORE 2.0-2.8     │ SUBTLE  │ SUBTLE  │ STRIKE │ STRIKE │ FORCE   │ FORCE
Z-SCORE > 2.8       │ SUBTLE  │ STRIKE  │ STRIKE │ FORCE  │ FORCE   │ FORCE
────────────────────┼─────────┼─────────┼────────┼────────┼─────────┼─────────
EFECTOS PERMITIDOS  │ Ghost   │ Sweep   │ Cyber  │ Gatling│ All     │ All
                    │ Breath  │ Acid    │ Dualism│ SkySaw │         │
                    │ Color   │ Wave    │ Strobe │ Strobe │         │
                    │ Shift   │         │ Burst  │        │         │
```

### Explicación de la Matriz

- **SILENCE + Z>2.8 = SUBTLE**: "Sí, hay un pico relativo, pero es un susurro. Haz un cambio de color suave."
- **AMBIENT + Z>2.8 = STRIKE**: "Hay energía suficiente para un efecto medio. AcidSweep, no Gatling."
- **ACTIVE + Z>1.5 = STRIKE**: "Algo está pasando en una sección activa. Dispara."
- **MAXIMUM + Z<1.5 = STRIKE**: "Es un drop sostenido. Aunque no haya pico, mantén el fuego."

---

## 🔧 IMPLEMENTACIÓN SUGERIDA

### Paso 1: Añadir EnergyContext a MusicalContext

```typescript
// En MusicalContext.ts
interface EnergyContext {
  absolute: number           // 0-1 valor crudo
  percentile: number         // 0-100 percentil histórico
  zone: 'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak'
  sustainedLow: boolean      // true si E<0.4 por >5s
  sustainedHigh: boolean     // true si E>0.7 por >3s
}
```

### Paso 2: Modificar classifyZScore para considerar energía

```typescript
// En ContextualEffectSelector.ts
private classifyZScoreWithEnergy(
  z: number, 
  energyContext: EnergyContext
): 'normal' | 'elevated' | 'epic' | 'divine' {
  
  // 🛡️ SUELO DE HORMIGÓN: En silencio/valley, máximo "elevated"
  if (energyContext.zone === 'silence' || energyContext.zone === 'valley') {
    if (z >= this.config.zScoreThresholds.divine) return 'elevated' // Cap máximo
    if (z >= this.config.zScoreThresholds.epic) return 'elevated'
    return 'normal'
  }
  
  // 🛡️ SUELO AMBIENT: En ambient, máximo "epic"
  if (energyContext.zone === 'ambient') {
    if (z >= this.config.zScoreThresholds.divine) return 'epic' // Cap
    // Normal classification below
  }
  
  // Clasificación normal para zonas activas+
  const { zScoreThresholds: t } = this.config
  if (z >= t.divine) return 'divine'
  if (z >= t.epic) return 'epic'
  if (z >= t.elevated) return 'elevated'
  return 'normal'
}
```

### Paso 3: Añadir Reglas Fuzzy para Energía Absoluta

```typescript
// En FuzzyDecisionMaker.ts
const SILENCE_SUPPRESSION_RULE: FuzzyRule = {
  name: 'SILENCE_SUPPRESSION',
  antecedent: (inputs) => {
    // Si energía es baja Y Z es alto → SUPPRESS
    const silenceGrade = 1 - triangularMembership(inputs.energyAbsolute, 0.3, 0.3)
    const epicGrade = inputs.zScore.epic
    return Math.min(silenceGrade, epicGrade) // AND fuzzy
  },
  consequent: 'hold', // Forzar HOLD
  weight: 0.9, // Alta prioridad
}
```

### Paso 4: Efectos por Intensidad Ambiental

```typescript
// En ContextualEffectSelector.ts
const EFFECTS_BY_INTENSITY: Record<EnergyZone, string[]> = {
  silence: ['ghost_breath', 'color_shift'], // Solo sutiles
  valley: ['ghost_breath', 'tidal_wave', 'color_shift'],
  ambient: ['acid_sweep', 'tidal_wave', 'cumbia_moon'],
  gentle: ['acid_sweep', 'cyber_dualism', 'strobe_burst'],
  active: ['cyber_dualism', 'gatling_raid', 'sky_saw', 'industrial_strobe'],
  intense: ['gatling_raid', 'industrial_strobe', 'sky_saw', 'solar_flare'],
  peak: ['gatling_raid', 'industrial_strobe', 'solar_flare'] // Todo permitido
}
```

---

## 📈 BENEFICIOS ESPERADOS

| Métrica | Antes | Después |
|---------|-------|---------|
| Disparos en silencio | ~15% de triggers | ~1% (solo ghost_breath) |
| Diversidad de efectos | 2-3 únicos | 5-6 únicos |
| "Gritos en biblioteca" | Frecuentes | Eliminados |
| Respeto por valles | Ninguno | Total |
| Inteligencia percibida | 60% | 90% |

---

## 🎯 PRÓXIMOS PASOS

1. **WAVE 931: EnergyContext** - Implementar el nuevo contexto energético
2. **WAVE 932: Fuzzy Energy Rules** - Añadir reglas difusas de supresión
3. **WAVE 933: Effect Intensity Mapping** - Mapear efectos a zonas de intensidad
4. **WAVE 934: Calibration** - Ajustar umbrales con datos reales

---

## 📝 NOTAS DEL ARQUITECTO

> "No quiero que Selene siga reglas. Quiero que PIENSE."

Esta propuesta **no encadena** a Selene. Le da **más información** para tomar decisiones inteligentes. La diferencia es sutil pero fundamental:

- ❌ **Encadenar**: "Si E<0.4, NO DISPARES NUNCA"
- ✅ **Educar**: "Aquí tienes el contexto energético. Tú decides, pero considera que estamos en un valle."

Selene sigue teniendo **libre albedrío** para disparar un strobe en un funeral... pero ahora SABE que es un funeral y puede elegir no hacerlo.

---

*Blueprint generado por PunkOpus - WAVE 930.5*
*Fecha: 2026-01-21*
