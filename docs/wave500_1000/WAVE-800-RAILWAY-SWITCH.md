# 🚂 WAVE 800 - RAILWAY SWITCH

> **"Cada efecto elige su vía: Dictador o Aditivo"**

## 🎯 EL PROBLEMA

La guerra física vs efectos era caótica. Híbridos como WAVE 790 rompían todo. Necesitábamos una arquitectura clara y simple.

## 💡 LA SOLUCIÓN: Railway Switch

Dos vías de mezcla separadas, elegidas POR CADA EFECTO:

### 🛤️ Vía 1: HTP (High Takes Precedence) - Aditivo

```
Comportamiento: "Suma y sigue"
- Se mezcla con la física
- Si física=80% y efecto=20%, resultado=80%
- Si efecto=100%, resultado=100%
```

**Efectos en esta vía:**
| Efecto | Razón |
|--------|-------|
| TropicalPulse | Flashes que complementan |
| ClaveRhythm | Percusión que suma |

### 🛤️ Vía 2: GLOBAL (Override) - Dictador

```
Comportamiento: "Aparta que voy"
- Ignora completamente la física
- Si efecto=10%, resultado=10% (ducking)
- Control total del espacio visual
```

**Efectos en esta vía:**
| Efecto | Razón |
|--------|-------|
| SolarFlare | Emergencia visual |
| CumbiaMoon | Respiro que necesita silencio |
| StrobeBurst | Strobo = dictador |
| SalsaFire | Fuego dramático |
| TidalWave | Ola espacial con valles |
| CorazonLatino | Colores que no deben mezclarse |
| GhostBreath | UV tenue que se pierde en HTP |

## 🏗️ ARQUITECTURA

### 1. BaseEffect.ts - Declaración

```typescript
// Default: 'htp' - Los efectos suman por defecto
readonly mixBus: 'htp' | 'global' = 'htp'

// Los efectos dictadores sobrescriben:
readonly mixBus = 'global' as const
```

### 2. ILightEffect (types.ts) - Interface

```typescript
readonly mixBus: 'htp' | 'global'
```

### 3. EffectManager.ts - Propagación

```typescript
// El efecto de mayor prioridad determina el mixBus
let dominantMixBus: 'htp' | 'global' = 'htp'

// Global tiene precedencia en empate de prioridad
if (effect.priority > highestPriority || 
    (effect.priority === highestPriority && effect.mixBus === 'global')) {
  dominantMixBus = effect.mixBus
}

return {
  mixBus: dominantMixBus,
  // ...
}
```

### 4. TitanOrchestrator.ts - Ejecución

```typescript
const isGlobalMode = effectOutput.mixBus === 'global' || effectOutput.globalOverride

if (isGlobalMode) {
  // VÍA GLOBAL: El efecto REEMPLAZA
  return { ...f, r, g, b, dimmer: effectDimmer }
} else {
  // VÍA HTP: El efecto SUMA
  return { ...f, r, g, b, dimmer: Math.max(f.dimmer, effectDimmer) }
}
```

## 📊 ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `BaseEffect.ts` | +`mixBus` con default 'htp' |
| `types.ts` | +`mixBus` en ILightEffect y CombinedEffectOutput |
| `EffectManager.ts` | Propaga `mixBus` del efecto dominante |
| `TitanOrchestrator.ts` | Lee `mixBus` para decidir HTP vs GLOBAL |
| `CumbiaMoon.ts` | `mixBus = 'global'` |
| `TidalWave.ts` | `mixBus = 'global'` |
| `GhostBreath.ts` | `mixBus = 'global'` |
| `SolarFlare.ts` | `mixBus = 'global'` |
| `StrobeBurst.ts` | `mixBus = 'global'` |
| `SalsaFire.ts` | `mixBus = 'global'` |
| `CorazonLatino.ts` | `mixBus = 'global'` |
| `TropicalPulse.ts` | `mixBus = 'htp'` (explícito) |
| `ClaveRhythm.ts` | `mixBus = 'htp'` (explícito) |

## 🔑 FILOSOFÍA

```
NO es hardcoding sucio.
ES arquitectura de señal.

Como en una mesa de mezclas:
- Algunos canales van al bus principal (suman)
- Algunos canales tienen mute groups (reemplazan)

La decisión vive DONDE DEBE VIVIR: en el efecto.
El Orchestrator solo lee y ejecuta.
```

---

**WAVE 800 - Railway Switch: Cada efecto elige su destino.**

*"🛤️ HTP = Suma | 🛤️ GLOBAL = Dicta"*
