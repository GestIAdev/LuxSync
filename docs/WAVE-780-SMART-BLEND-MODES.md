# 🎚️ WAVE 780 - SMART BLEND MODES

> **"Cada efecto sabe si quiere DOMINAR o SUMAR"**

## 🎯 EL PROBLEMA

WAVE 765 implementó LTP (Last Takes Precedence) para que TidalWave pudiera crear **valles oscuros**. Pero esto rompió efectos como TropicalPulse que NECESITAN HTP (Highest Takes Precedence) para **SUMAR energía**.

**El conflicto:**
- TidalWave: "Quiero que mi 20% SEA 20%, no el máximo con física"
- TropicalPulse: "Quiero que mi 80% se SUME con física, no la reemplace"

## 💡 LA SOLUCIÓN: BlendMode por Efecto

Cada efecto ahora declara su **intención de mezcla**:

| BlendMode | Comportamiento | Efectos |
|-----------|---------------|---------|
| `'replace'` | LTP - El efecto REEMPLAZA la física (valles visibles) | TidalWave, GhostBreath, CumbiaMoon |
| `'max'` | HTP - El efecto SUMA con la física (energía aditiva) | TropicalPulse, ClaveRhythm, CorazonLatino |

## 🏗️ ARQUITECTURA

### 1. types.ts - Nuevo tipo BlendMode

```typescript
// 🎚️ WAVE 780: SMART BLEND MODES
export type BlendMode = 'replace' | 'max'

// En ZoneOverride:
blendMode?: BlendMode  // 'replace' = LTP (valles), 'max' = HTP (energía aditiva)
```

### 2. TitanOrchestrator.ts - Lógica Smart

```typescript
// WAVE 780: SMART BLEND - Cada efecto decide su mezcla
const blendMode = zoneData.blendMode || 'max' // Default: HTP (seguro)

let finalDimmer: number
if (blendMode === 'replace') {
  // LTP: El efecto REEMPLAZA - valleys visibles
  finalDimmer = effectDimmer
} else {
  // HTP: El efecto SUMA - máximo entre física y efecto
  finalDimmer = Math.max(fixtureStates[index].dimmer, effectDimmer)
}
```

### 3. Efectos Actualizados

**REPLACE (Valles/Contraste):**
- `TidalWave.ts`: `blendMode: 'replace'`
- `GhostBreath.ts`: `blendMode: 'replace'`  
- `CumbiaMoon.ts`: `blendMode: 'replace'`

**MAX (Energía Aditiva):**
- `TropicalPulse.ts`: `blendMode: 'max'`
- `ClaveRhythm.ts`: `blendMode: 'max'`
- `CorazonLatino.ts`: `blendMode: 'max'`

## 🎨 FILOSOFÍA

```
TidalWave susurra: "Soy una ola... mi valle DEBE ser oscuro"
→ blendMode: 'replace' → dimmer = effectDimmer

TropicalPulse grita: "¡SOY LA FIESTA! ¡QUIERO MÁS LUZ!"
→ blendMode: 'max' → dimmer = Math.max(physics, effect)

CorazonLatino late: "Mi corazón SUMA al ambiente, no lo apaga"
→ blendMode: 'max' → dimmer = Math.max(physics, effect)
```

## 📊 RESULTADO

| Escenario | Antes (LTP global) | Después (Smart Blend) |
|-----------|-------------------|----------------------|
| TidalWave valle al 20% | ✅ Valle oscuro | ✅ Valle oscuro |
| TropicalPulse al 80% | ❌ Quedaba en 80% | ✅ Suma con física |
| GhostBreath UV al 5% | ✅ Oscuridad UV | ✅ Oscuridad UV |
| ClaveRhythm percusión | ❌ Perdía energía | ✅ Energía aditiva |

## 🔧 DEFAULT BEHAVIOR

**Default: `'max'` (HTP)**

Si un efecto NO declara blendMode, se asume `'max'` para:
1. Compatibilidad hacia atrás
2. Seguridad (nunca dims inesperado)
3. Los efectos que "quieren oscuridad" deben ser EXPLÍCITOS

---

**WAVE 780 - Porque cada efecto sabe lo que quiere.**

*"Replace for valleys, Max for energy"*
