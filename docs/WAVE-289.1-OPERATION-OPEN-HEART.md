# 🩺 OPERATION OPEN HEART - Diagnóstico de Calibración
## WAVE 289.1: Telemetría de Falsos Positivos DROP en Latino

**Fecha:** January 2, 2026  
**Síntoma Reportado:** UI MusicalDNA muestra "DROP" el 50% del tiempo en modo Latino  
**Status:** 🔍 PROBES INYECTADOS - Esperando datos de campo

---

## 📋 EXECUTIVE SUMMARY

### El Problema
Después de WAVE 289 (Vibe-Aware Section Tracker), el perfil Latino está disparando falsos positivos de DROP constantemente. La UI muestra sección "DROP" aproximadamente el 50% del tiempo cuando se reproduce reggaetón/cumbia.

### Sospecha Inicial
El perfil Latino tiene `dropAbsoluteThreshold: 0.70`. Como el reggaetón es muy denso (bass avg ~0.6), el umbral se alcanza constantemente.

### Acción Tomada
Inyección de probes de telemetría en DOS sistemas:
1. **SectionTracker** → El que modificamos en WAVE 289
2. **EnergyStabilizer** → Sistema legacy de detección de DROP

---

## 🔬 ARQUITECTURA DE DETECCIÓN DE DROP

### Descubrimiento Crítico: DOS SISTEMAS PARALELOS

```
┌─────────────────────────────────────────────────────────────────┐
│                   UI: MusicalDNAPanel                           │
│                                                                 │
│  isDrop = cognitive.dropState.state === 'SUSTAIN'               │
│           && cognitive.dropState.isActive === true              │
│                         │                                       │
│  section.name = musicalDNA.section.current                      │
│                         │                                       │
│  RENDER: isDrop ? '💥 DROP' : section.name.toUpperCase()        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────────────┐
│   EnergyStabilizer      │   │      SectionTracker             │
│                         │   │                                 │
│ DROP_ABSOLUTE_MIN: 0.85 │   │ dropAbsoluteThreshold: 0.70     │
│ DROP_RELATIVE: +0.40    │   │ dropEnergyRatio: 1.20           │
│                         │   │ (VIBE-AWARE DESDE WAVE 289)     │
│ ¿Vibe-aware? ❌ NO      │   │ ¿Vibe-aware? ✅ SÍ              │
│                         │   │                                 │
│ Output: dropState       │   │ Output: section.current         │
│         isDropActive    │   │                                 │
└─────────────────────────┘   └─────────────────────────────────┘
```

### Flujo de Datos en la UI

| Campo UI | Fuente | Sistema |
|----------|--------|---------|
| `isDrop` | `cognitive.dropState.state === 'SUSTAIN'` | EnergyStabilizer |
| `section.name` | `musicalDNA.section.current` | SectionTracker |
| **Visual mostrado** | `isDrop ? 💥DROP : section.name` | Prioriza EnergyStabilizer |

**IMPORTANTE:** Si `section.name === 'drop'` pero `isDrop === false`, la UI muestra:
- Icono: 💥 (porque `getSectionIcon('drop')` retorna 💥)
- Texto: "DROP" (el nombre de la sección en mayúsculas)

---

## 🎯 PROBES DE TELEMETRÍA INYECTADOS

### PROBE 1: SectionTracker (Nuevo en WAVE 289)

**Ubicación:** `SectionTracker.detectSection()` después del cálculo de umbrales

**Formato del Log:**
```
[TRACKER-PROBE] 🌊 Vibe:LATINO | E(W): 0.72 | Avg: 0.68 | Inst: 0.71 | Ratio: 1.05/1.02 | AbsThr: 0.70 | Votes: [Drop(2.0) Verse(0.5)] | Section: DROP | 🔥 DROP TRIGGER
```

**Campos Expuestos:**
| Campo | Descripción | Valor Crítico Latino |
|-------|-------------|---------------------|
| `Vibe` | Vibe activo actual | LATINO |
| `E(W)` | Energía ponderada (weighted) | Valores típicos 0.55-0.75 |
| `Avg` | avgEnergy (media móvil lenta ~2s) | Se estabiliza ~0.6 |
| `Inst` | instantEnergy (media rápida ~100ms) | Más volátil |
| `Ratio` | instant/avg / adjustedDropRatio | Si > 1.0 → cumple ratio |
| `AbsThr` | adjustedDropAbsThreshold | Latino: 0.70, high-energy: 0.80 |
| `Votes` | Votos acumulados por sección | Drop, Verse, Chorus... |
| `Section` | Sección actual | Lo que ve el usuario |
| `Result` | Emoji de diagnóstico | 🔥 DROP TRIGGER / ⚡ IN DROP / ✅ OK |

**Throttle:** 500ms

### PROBE 2: EnergyStabilizer (Sistema Legacy)

**Ubicación:** `EnergyStabilizer.update()` después de calcular `isRelativeDrop`

**Formato del Log:**
```
[STABILIZER-PROBE] 🏎️ E: 0.72 | EMA: 0.68 | Delta: 0.04/0.40 | AbsMin: 0.85 | isRelDrop: false | State: IDLE | Active: false | [Rel:false Abs:false]
```

**Campos Expuestos:**
| Campo | Descripción | Valor Crítico |
|-------|-------------|---------------|
| `E` | Energía instantánea raw | 0.0-1.0 |
| `EMA` | Exponential Moving Average | ~0.6 en reggaetón |
| `Delta` | E - EMA / umbral (0.40) | Necesita +0.40 para drop |
| `AbsMin` | DROP_ABSOLUTE_MINIMUM | 0.85 (hardcoded) |
| `isRelDrop` | ¿Cumple condición de drop? | true/false |
| `State` | Estado máquina de DROP | IDLE/ATTACK/SUSTAIN/RELEASE/COOLDOWN |
| `Active` | isDropActive (para UI) | true/false |
| `[Rel:X Abs:Y]` | Breakdown de condiciones | Qué condición falla |

**Throttle:** ~500ms (cada 30 frames @ 60fps)

---

## 📊 ANÁLISIS PRELIMINAR DE UMBRALES

### Perfil Latino Actual (VibeSectionProfiles.ts)

```typescript
'latino': {
  dropEnergyRatio: 1.20,         // Más sensible que Techno (1.40)
  maxDropDuration: 12000,        // 12 segundos
  dropAbsoluteThreshold: 0.70,   // ← SOSPECHOSO PRINCIPAL
  dropCooldown: 6000,            // 6 segundos
  dropEnergyKillThreshold: 0.50,
  
  frequencyWeights: {
    bass: 0.30,      // 30%
    midBass: 0.40,   // 40% ← PESO DOMINANTE
    mid: 0.20,       // 20%
    treble: 0.10,    // 10%
  },
}
```

### Cálculo de Energía Ponderada

```typescript
// En calculateWeightedEnergy():
const midBass = (audio.bass + audio.mid) / 2;

return (
  audio.bass * 0.30 +      // 30% bass
  midBass * 0.40 +         // 40% midBass (interpolado)
  audio.mid * 0.20 +       // 20% mid
  audio.treble * 0.10      // 10% treble
);
```

### Problema Hipotético

**Reggaetón típico:**
- `bass` ≈ 0.70 (dembow constante)
- `mid` ≈ 0.55 (voces + synths)
- `treble` ≈ 0.40 (hi-hats)

**Energía ponderada:**
```
midBass = (0.70 + 0.55) / 2 = 0.625
weighted = 0.70*0.30 + 0.625*0.40 + 0.55*0.20 + 0.40*0.10
         = 0.21 + 0.25 + 0.11 + 0.04
         = 0.61
```

Con `avgEnergy` estabilizado ~0.58 y `instantEnergy` ~0.61:
- `ratio = 0.61 / 0.58 = 1.05` (NO cumple dropRatio 1.20)
- `instantEnergy = 0.61` (NO cumple dropAbsThreshold 0.70)

**Pero en picos del dembow:**
- `bass` salta a 0.85
- `weighted` sube a ~0.75
- **¡Cumple dropAbsThreshold 0.70!**
- Y con ratio adaptativo (high-energy) = 1.02 → **cumple**

---

## 🎯 HIPÓTESIS DE FALLO

### Escenario A: Ratio Adaptativo Demasiado Permisivo

```typescript
const isHighEnergyTrack = this.avgEnergy > 0.7;
const adjustedDropRatio = isHighEnergyTrack ? dropRatio * 0.85 : dropRatio;
// Latino: 1.20 * 0.85 = 1.02 ← MUY BAJO
```

Si el track tiene avgEnergy > 0.7 (común en reggaetón mastered hot), el ratio baja a 1.02. Cualquier variación mínima cumple.

### Escenario B: dropAbsoluteThreshold Demasiado Bajo

`0.70` es alcanzable constantemente en reggaetón. El dembow golpea esa marca en cada beat.

### Escenario C: Cálculo de midBass Incorrecto

```typescript
const midBass = (audio.bass + audio.mid) / 2;
```

Esto interpola linealmente, pero en reggaetón el midBass debería venir del canal específico (80-250Hz), no de un promedio bass+mid.

---

## 🔧 POSIBLES CALIBRACIONES (Post-Diagnóstico)

| Parámetro | Actual | Propuesto | Razón |
|-----------|--------|-----------|-------|
| `dropAbsoluteThreshold` | 0.70 | **0.80** | Requiere pico real, no dembow normal |
| `dropEnergyRatio` | 1.20 | **1.25** | Más margen antes de disparar |
| High-energy adaptive | `* 0.85` | `* 0.90` | Menos agresivo en tracks comprimidos |

---

## 📋 PRÓXIMOS PASOS

1. **Ejecutar la app** con audio reggaetón/cumbia
2. **Observar consola** - buscar patrones en `[TRACKER-PROBE]` y `[STABILIZER-PROBE]`
3. **Identificar** qué sistema está disparando DROP (¿SectionTracker o EnergyStabilizer?)
4. **Calibrar** los umbrales basándose en datos reales
5. **Eliminar probes** una vez confirmado el diagnóstico

---

## 🗂️ ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `SectionTracker.ts` | +Probe telemetría throttled 500ms |
| `EnergyStabilizer.ts` | +Probe telemetría throttled 30 frames |

---

**Status:** 🔍 PROBES ACTIVOS - Esperando ejecución y datos de campo

*"No asumimos. Medimos."* - Axioma PunkOpus
