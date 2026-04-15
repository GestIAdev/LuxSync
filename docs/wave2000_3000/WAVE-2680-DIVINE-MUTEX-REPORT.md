# WAVE 2680 — THE DIVINE MUTEX (GLOBAL HARD EFFECT LOCK)

**Estado:** ✅ COMPLETADO  
**Archivo modificado:** `electron-app/src/core/effects/EffectManager.ts`  
**Compilación:** `tsc --noEmit` = 0 errores  

---

## 📛 EL PROBLEMA

En géneros hiper-comprimidos (Fiesta Latina, Techno Industrial), el Z-score se mantiene en niveles Divinos (>4.0σ) durante múltiples frames consecutivos. Cada frame genera un DIVINE STRIKE con un arma disponible del arsenal. El resultado:

```
[Frame N]   strobe_storm (peak) → FIRE ✅
[Frame N+1] neon_blinder (peak) → FIRE ✅  ← SOLAPAMIENTO
```

Dos efectos pesados alterando dimmer/color simultáneamente = HARDWARE COLAPSADO.

---

## 🔍 ROOT CAUSE

### Causa Raíz #1: EFFECT_ZONE_MAP incompleto

`strobe_storm` y **TODOS** los efectos de Fiesta Latina no estaban registrados en `EFFECT_ZONE_MAP`. Cuando `checkTraffic()` Rule 4 (Zone Mutex, WAVE 996) evaluaba:

```typescript
const incomingZone = EFFECT_ZONE_MAP['strobe_storm']  // → undefined
if (incomingZone) { /* SKIPPED — strobe_storm invisible al zone mutex */ }
```

El guard `if (incomingZone)` devolvía `false`, y `strobe_storm` pasaba sin evaluación de zona.

### Causa Raíz #2: Ausencia de mutex cross-zone

Incluso con el zone map completo, la Rule 4 solo bloquea **MISMA zona**. Un efecto `peak` bloquea otro `peak`, pero `intense` + `peak` pueden coexistir. `industrial_strobe` (demoted a `intense` en WAVE 2493) y `strobe_storm` (peak) se solaparían libremente.

---

## 🔧 SOLUCIÓN: TWO-PRONGED FIX

### Prong 1: EFFECT_ZONE_MAP completo

15 efectos añadidos al mapa con zonas calibradas:

| Efecto | Zona | Justificación |
|--------|------|---------------|
| `ghost_breath` | valley | Respiración fantasma suave |
| `amazon_mist` | valley | Neblina, zona baja |
| `cumbia_moon` | ambient | Glow de breakdown |
| `tropical_pulse` | gentle | Crescendo conga |
| `salsa_fire` | gentle | Fuego orgánico |
| `clave_rhythm` | gentle | Patrón 3-2 |
| `machete_spark` | active | Chispa militar |
| `glitch_guaguanco` | active | Glitch cubano |
| `corazon_latino` | active | Heartbeat passion |
| `tidal_wave` | intense | Ola de energía |
| `strobe_burst` | intense | Ráfaga rítmica |
| `strobe_storm` | **peak** | Strobe pesado de drop |
| `solar_flare` | **peak** | Takeover total |
| `latina_meltdown` | **peak** | La bestia |
| `oro_solido` | **peak** | Muro de oro |

### Prong 2: Rule 5 — THE DIVINE MUTEX

Nueva regla en `checkTraffic()` después de Rule 4:

```
HARD_ZONES = { 'peak', 'intense' }

IF incoming effect is in a HARD_ZONE
  AND any active effect is ALSO in a HARD_ZONE
→ BLOCK (One God at a Time)
```

**Filosofía:** `peak` e `intense` son **mutuamente exclusivos**. Si cualquiera está activo, el otro espera. Los clímax hacen cola. El hardware exige que los Dioses hablen uno a la vez.

---

## 📐 CADENA DE VERIFICACIÓN

```
DecisionMaker (Z>4.0σ)
    → DIVINE MOMENT detectado
    → Selecciona arma del DIVINE_ARSENAL[vibe]
    
SeleneTitanConscious
    → effectSelector.getAvailableFromArsenal(divineArsenal)
    → checkAvailability() → cooldown basado en TIEMPO (ok)
    → emite efectoDecision

TitanEngine
    → lee consciousnessOutput.effectDecision
    → effectManager.trigger({effectType, intensity...})

EffectManager.checkTraffic()  ← LA ÚLTIMA COMPUERTA
    → Rule 0: GLOBAL_LOCK (dictador)
    → Rule 1: CRITICAL bloquea AMBIENT
    → Rule 2: No duplicados
    → Rule 3: Atmospheric exclusivity
    → Rule 4: ZONE MUTEX (WAVE 996) ← AHORA con mapa completo
    → Rule 5: DIVINE MUTEX (WAVE 2680) ← NUEVO — peak/intense exclusivos
```

La protección opera en la ÚLTIMA compuerta, garantizando que NINGÚN efecto pesado llegue al hardware si otro ya está activo. El `ContextualEffectSelector` sigue evaluando disponibilidad temporal (cooldowns), mientras el `EffectManager` controla estado real de hardware.

---

## 🎯 RESULTADO ESPERADO

```
[Frame N]   strobe_storm (peak) → FIRE ✅
[Frame N+1] neon_blinder (peak) → 🔒 DIVINE MUTEX: blocked by strobe_storm — One God at a Time
[Frame N+5] strobe_storm finished → canal limpio
[Frame N+6] neon_blinder (peak) → FIRE ✅  ← Momento único, limpio
```

---

*PunkOpus — WAVE 2680 — "One God at a Time"*
