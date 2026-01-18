# 🔧 WAVE 790 - ATOMIC BLENDING & TIMING

> **"Mezcla por CANAL, no solo por dimmer"**

## 🎯 EL PROBLEMA

WAVE 780 introdujo BlendMode pero **solo afectaba el dimmer**:
- **Color** se aplicaba SIEMPRE (ignorando física)
- **White/Amber** NO se tocaban nunca → **Por eso no había oro**

**Síntomas:**
1. CumbiaMoon seguía pulsando (bpmSync interno)
2. TropicalPulse sin flash dorado (white/amber ignorados)
3. Colores "sucios" mezclados incorrectamente

## 💡 LA SOLUCIÓN: Mezcla Atómica por Canal

### TitanOrchestrator.ts - Nueva Lógica

```typescript
if (blendMode === 'replace') {
  // 🛡️ MODO ESCUDO - IGNORAR COMPLETAMENTE LA FÍSICA
  
  // Dimmer: El efecto MANDA
  fixtureStates[index].dimmer = effectDimmer
  
  // Color: FORZAR (no mezclar)
  fixtureStates[index].r = rgb.r
  fixtureStates[index].g = rgb.g
  fixtureStates[index].b = rgb.b
  
  // White/Amber: FORZAR (limpiar residuos si undefined)
  fixtureStates[index].white = effectWhite || 0  // ← Limpia residuos
  fixtureStates[index].amber = effectAmber || 0  // ← Limpia residuos

} else {
  // 🔥 MODO ENERGÍA - HTP POR CANAL
  
  // Dimmer: Gana el más alto
  fixtureStates[index].dimmer = Math.max(physics, effect)
  
  // Color: "Winner Takes All" (80% threshold)
  if (effectDimmer >= physicsDimmer * 0.8) {
    // El efecto brilla suficiente → gana el color
  }
  
  // White/Amber: HTP - EL FIX DEL ORO 🔥
  fixtureStates[index].white = Math.max(physicsWhite, effectWhite)
  fixtureStates[index].amber = Math.max(physicsAmber, effectAmber)
}
```

### CumbiaMoon.ts - Timing Fix

```typescript
// ANTES (pulsaba al beat):
cycleDurationMs: 3000,
bpmSync: true,
beatsPerCycle: 4,
peakSustainMs: 400,

// AHORA (respiración lenta independiente):
cycleDurationMs: 8000,  // 8 segundos completos
bpmSync: false,          // NO sync con música
peakSustainMs: 2000,    // 2 segundos en el pico
```

## 📊 TABLA DE COMPORTAMIENTO

| Canal | REPLACE (Escudo) | MAX (Energía) |
|-------|-----------------|---------------|
| **Dimmer** | effectDimmer | Math.max(physics, effect) |
| **Color** | FORZAR efecto | Winner Takes All (80% threshold) |
| **White** | effectWhite \|\| 0 | Math.max(physics, effect) |
| **Amber** | effectAmber \|\| 0 | Math.max(physics, effect) |

## 🎨 RESULTADO

### CumbiaMoon (REPLACE)
- ✅ Luna CONSTANTE al 15% (no pulsa con la música)
- ✅ Respiración de 8 segundos (casi imperceptible)
- ✅ White/Amber en 0 (sin residuos de física)
- ✅ Color plata lunar forzado

### TropicalPulse / ClaveRhythm (MAX)
- ✅ Flash dorado VISIBLE (white/amber HTP funcionando)
- ✅ Energía aditiva (Math.max en dimmer)
- ✅ Color del efecto cuando brilla más que física

## 🔑 KEY INSIGHT

```
REPLACE = "Yo soy el único que manda aquí"
  → Para: lunas, olas, ambientes que necesitan SILENCIO de física
  
MAX = "Yo SUMO a lo que hay"
  → Para: flashes, percusión, energía que potencia la física
```

---

**WAVE 790 - Porque cada canal merece respeto.**

*"Atomic Blending: dimmer + color + white + amber"*
