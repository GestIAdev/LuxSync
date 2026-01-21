---
title: "ENERGY CONSCIOUSNESS - MANUAL TESTING GUIDE"
subtitle: "Cómo calibrar con tus tracks reales"
date: "2026-01-21"
---

# 🎧 ENERGY CONSCIOUSNESS - MANUAL TESTING GUIDE

## 🎯 OBJETIVO

Validar que Selene se comporta "inteligentemente" en tus tracks específicos:
- No dispara tonterías en valles/pads suaves
- Sí dispara con potencia en drops reales
- Detecta fake drops instantáneamente
- Mantiene variedad de efectos

---

## 📋 TEST CHECKLIST

### Test 1: AMBIENT PAD (10-30s de energía baja sostenida)

**Setup**:
- Track: Ambient, pad, meditación o intro suave
- Monitorear: Energía visual durante 30 segundos

**Esperado**:
```
Energía: 0.1-0.3 (bien bajo)
↓
Zona: ambient o gentle
↓
Efectos: acid_sweep, tidal_wave, cumbia_moon
↓
❌ NUNCA: gatling_raid, industrial_strobe, solar_flare
```

**Resultado**: ✅ PASS / ❌ FAIL

**Si falla**:
- Revisar `ZONE_THRESHOLDS.ambient` (0.30)
- Subir threshold si la zona es ambigua

---

### Test 2: SILENCE + BUMP (Silencio profundo → pequeño sonido)

**Setup**:
- Track: Pad suave, respiración, sonido ambiente
- Duration: 10-15 segundos
- Luego: Pequeño sonido (voz, pad attack, cymbal)

**Esperado**:
```
Fases:
1. 0-10s: Energía 0.02-0.05 → Zona: silence
           ✅ NADA o ghost_breath suave

2. +bump: Energía sube a 0.15-0.25 → Z ≈ 3-4σ
           ✅ ghost_breath O cumbia_moon
           ❌ NUNCA gatling/strobe en este momento

3. 2-3s después: Si energía baja → Vuelve a silence
           ✅ Transición suave
```

**Resultado**: ✅ PASS / ❌ FAIL

**Si falla**:
- Revisar `FRAMES_TO_ENTER_SILENCE` (30)
- ¿Entra en silence demasiado rápido? Aumentar
- ¿Entra demasiado lento? Bajar

---

### Test 3: FAKE DROP (Silencio → Drop instantáneo)

**Setup**:
- Track: Cualquiera con patrón de fake drop
- Buscar: Silencio sostenido + Drop sorpresa

**Esperado**:
```
Silencio: 2+ segundos @ energía < 0.1
          ✅ ghost_breath o NADA
          
Drop: Energía salta a 0.9+ instantáneamente
      ✅ DROP EN <50ms (debe ser rápido)
      ✅ solar_flare O gatling_raid @ potencia
      
Timing total: Silencio → Drop ≈ 1 frame (16ms)
```

**Resultado**: ✅ PASS / ❌ FAIL

**Si falla**:
- Revisar `FRAMES_TO_EXIT_SILENCE` (3)
- Debe ser INSTANT para fake drops
- Si es lento: 🔴 BUG

---

### Test 4: GRADUAL DESCENT (Drop → Valle → Silencio)

**Setup**:
- Track: Cualquiera con transición suave a breakdown
- Buscar: 10-20 segundos de bajada gradual

**Esperado**:
```
Pico: E=0.95 → Zona: peak
      ✅ industrial_strobe, gatling_raid

Descenso: E 0.90 → 0.70 → 0.50 → 0.30
          ✅ Transición suave entre zonas
          ✅ Efectos reducen intensidad gradualmente
          
Valle: E < 0.15 → Zona: valley
       ✅ ghost_breath, tidal_wave (soft)
       
Fina: E < 0.05 → Zona: silence
      ✅ NADA O ghost_breath súper suave
```

**Resultado**: ✅ PASS / ❌ FAIL

**Si falla**:
- Revisar `SMOOTHING_FACTOR` (0.8)
- ¿Transición muy abrupt? Aumentar smoothing
- ¿Transición muy suave? Bajar smoothing

---

### Test 5: BUILD-UP (Construcción gradual a pico)

**Setup**:
- Track: Cualquiera con buildup claro
- Duration: 15-30 segundos

**Esperado**:
```
Intro: E=0.3 → Zona: ambient
       ✅ acid_sweep, tidal_wave

Building: E 0.4 → 0.5 → 0.6 → 0.7
          ✅ Progresión de efectos
          ✅ Aumentar intensidad

Pre-drop: E 0.75 → 0.85
          ✅ cyber_dualism, strobe_burst

Drop: E 0.90+
      ✅ FUEGO COMPLETO
```

**Resultado**: ✅ PASS / ❌ FAIL

**Si falla**:
- Revisar thresholds de cada zona
- ¿Salta zonas? Ajustar `SMOOTHING_FACTOR`

---

### Test 6: REPETITIVE ENERGY PATTERN (Techno loop 0.6-0.8)

**Setup**:
- Track: Minimal techno, loops, hypnotic
- Duration: 30+ segundos

**Esperado**:
```
Energía sostenida: 0.6-0.8 (zona: active/intense)
                   ✅ Variedad de efectos
                   ✅ NO repetir el mismo efecto >2 veces
                   
Raro/Nunca: Gatling en CADA beat
            (debe haber variedad)
            
Permitido: Cyber, acid, strobe alternando
```

**Resultado**: ✅ PASS / ❌ FAIL

**Si falla**:
- Revisar `consecutiveSameEffect` tracking
- Revisar `EFFECTS_BY_INTENSITY[zone]` para variedad

---

## 📊 LOGGING & DEBUGGING

### Habilitar Logs

En `core/effects/ContextualEffectSelector.ts`, busca:

```typescript
console.log(`[EffectSelector 🔋] Zone ${energyContext?.zone}: ...`)
console.log(`[EffectSelector 🎯] Section=${sectionType} Z=${zLevel} ...`)
```

Estos te mostrarán en VIVO:
- Zona actual
- Z-Level
- Cambios de zona
- Effect selections
- Zone swaps

### Monitorear

Abre DevTools (F12) y busca logs de:
```
[EffectSelector 🔋]    → Zone changes
[EffectSelector 🎯]    → Effect selections
[SeleneTitanConscious] → Zone transitions
```

---

## 🎛️ TUNING PARAMETERS

Si necesitas ajustar, estos son los knobs:

### 1. Timing (cuánto tarda en cambiar zona)

**Archivo**: `core/intelligence/EnergyConsciousnessEngine.ts`

```typescript
// Línea ~40
const FRAMES_TO_ENTER_SILENCE = 30  // ← Más = más lento a silence
const FRAMES_TO_EXIT_SILENCE = 3    // ← Más = más lento salir silence
```

**Valores de prueba**:
- Lento: FRAMES_TO_ENTER = 60 (1 segundo)
- Normal: FRAMES_TO_ENTER = 30 (500ms)
- Rápido: FRAMES_TO_ENTER = 10 (166ms)

### 2. Smoothing (cuánto suaviza cambios de energía)

**Archivo**: `core/intelligence/EnergyConsciousnessEngine.ts`

```typescript
// Línea ~50
const SMOOTHING_FACTOR = 0.8  // ← 0.9 = más suave, 0.5 = responsivo
```

**Interpretación**:
- `smoothed = smoothed * 0.8 + energy * 0.2`
- Alto (0.9): Cambios lentos, smooth
- Bajo (0.5): Cambios rápidos, responsivo

### 3. Zone Thresholds (dónde empieza cada zona)

**Archivo**: `core/intelligence/EnergyConsciousnessEngine.ts`

```typescript
// Línea ~35
const ZONE_THRESHOLDS = {
  silence: 0.05,   // ← Subir = más cosas en silence
  valley: 0.15,
  ambient: 0.30,
  gentle: 0.45,
  active: 0.60,
  intense: 0.80,
}
```

**Cómo ajustar**:
- Si detectas mucho en zona baja: ↑ thresholds
- Si detectas poco en zona alta: ↓ thresholds

### 4. Effect Lists (qué efectos en cada zona)

**Archivo**: `core/effects/ContextualEffectSelector.ts` línea ~610

```typescript
const EFFECTS_BY_INTENSITY: Record<EnergyZone, string[]> = {
  silence: ['ghost_breath', 'cumbia_moon'],  // ← Añade aquí
  valley: ['ghost_breath', ...],
  // ...
}
```

**Experimentar**:
- Quitar efectos que no encajan
- Añadir nuevos si los anteriores se repiten

---

## 🧪 QUICK TEST SCRIPT

Si quieres automatizar:

```typescript
// Ejecutar en console del DevTools

// Test 1: Simular silencio + bump
setEnergySequence([0.02, 0.02, 0.02, 0.15, 0.10, 0.05])

// Test 2: Simular fake drop
setEnergySequence([0.02, 0.02, 0.02, 0.95])

// Test 3: Simular descenso
setEnergySequence([0.95, 0.75, 0.50, 0.30, 0.10])

// Ver resultados en logs
```

(Necesitaría exponer función, pero idea es simple)

---

## 📝 TEST REPORT TEMPLATE

Cuando pruebes, reporta:

```markdown
## Test: [NAME]

**Track**: [Artist - Song]
**Duration**: [mm:ss]
**Energy Range**: [0.X - 0.Y]

**Observations**:
- [ ] Behavior was as expected
- [ ] Transition speed appropriate
- [ ] Effect variety good
- [ ] No unexpected triggers

**Issues Found**:
- [If any]

**Suggestions**:
- [If any]

**Confidence**: [A/B/C]
- A = Perfect, ship it
- B = Good, minor tuning needed
- C = Needs rework
```

---

## 🎯 SUCCESS CRITERIA

Test pasa si:

- ✅ No gatling en silencio/valley
- ✅ Fake drops detectados en <100ms
- ✅ Real drops se disparan con potencia
- ✅ Variedad de efectos (no repetición)
- ✅ Transiciones suaves
- ✅ "Feels intelligent"

---

## 🚨 RED FLAGS

Si ves esto, hay bug:

- 🔴 Gatling en silencio
- 🔴 Delay largo (>500ms) en fake drops
- 🔴 Mismo efecto >3 veces seguidas
- 🔴 Saltos abruptos de energía
- 🔴 Transiciones "robóticas"

---

## 💡 TIPS

1. **Test con tracks que CONOCES**: Sabes cuándo "debería" disparar
2. **A/B compara**: Play old version vs new, escucha diferencias
3. **Lento es mejor**: Si tienes dudas, entra lento a silencio
4. **Logs son tu amigo**: `console.log` todo lo que necesites
5. **Incremental**: Cambia UNO a la vez, test, repeat

---

## 📞 DEBUGGING CHECKLIST

Si algo no funciona:

- [ ] ¿Energía está realmente en rango esperado?
- [ ] ¿Zone se actualiza correctamente?
- [ ] ¿Fuzzy rules se ejecutan?
- [ ] ¿Effect lookup tiene el efecto?
- [ ] ¿Compilación limpia (sin errores)?
- [ ] ¿Browser cache limpio?

---

## 🎉 FINISH LINE

Cuando 6/6 tests pasen con "A" confidence:

**SHIP IT! 🚀**

---

*Manual de calibración - WAVE 934+*  
*Last updated: 2026-01-21*
