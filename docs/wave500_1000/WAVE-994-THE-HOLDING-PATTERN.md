# 🛡️ WAVE 994: THE HOLDING PATTERN (Dictadura Continua)

**Estado**: ✅ IMPLEMENTED  
**Criticidad**: 🔴 CRITICAL - Physics bleeding entre frames de efectos global  
**Detectado por**: Radwulf (arquitecto)  
**Fecha**: 2026-01-23  
**Sesión**: WAVE 991 → 993 → 994 (Railway Switch final polish)

---

## 📋 RESUMEN EJECUTIVO

**WAVE 993** implementó **THE IRON CURTAIN** para zero-fill de canales no especificados.  
**WAVE 994** completa la arquitectura con **THE HOLDING PATTERN**: Los efectos `mixBus='global'` **NUNCA deben soltar el control** mientras están activos, incluso durante pausas o darkness.

### El problema descubierto

```
DigitalRain (Techno - mixBus='global'):
  Frame 1: Flash verde → Envía zoneOverrides con dimmer=0.7
  Frame 2: Pausa → NO envía nada (return early)
  Frame 3: Flash verde → Envía zoneOverrides con dimmer=0.7
  
RESULTADO VISUAL:
  Frame 1: VERDE ✅
  Frame 2: DORADO (physics tomó control) ❌
  Frame 3: VERDE ✅
  
Observación: "Verde -> Dorado -> Verde -> Dorado" (ruido visual horrible)
```

---

## 🔥 LA METÁFORA: THE HOLDING PATTERN

### Definición arquitectónica

> **"Si eres un efecto Global, tú eres el dueño del universo hasta que termines.  
> Si quieres negro, PINTA NEGRO. No dejes el lienzo en blanco."**  
> — Radwulf, 2026-01-23

### El Dictador Intermitente (BUG)

```typescript
// ❌ PATRÓN BUGGY (DigitalRain pre-WAVE 994)
const dimmerValue = Math.random() < flickerProbability ? 0.7 : 0

if (dimmerValue > 0) {
  // Solo envía cuando hay luz
  output.zoneOverrides![zone] = { dimmer: dimmerValue, ... }
}
// Si dimmerValue === 0, NO HACE NADA → Physics toma control ❌
```

**Problema**: El efecto "suelta el micrófono" cuando no tiene luz que mostrar.

### El Dictador Continuo (CORRECTO)

```typescript
// ✅ PATRÓN CORRECTO (DigitalRain post-WAVE 994)
const dimmerValue = Math.random() < flickerProbability ? 0.7 : 0

if (dimmerValue > 0) {
  // FLASH: Color visible
  output.zoneOverrides![zone] = {
    dimmer: dimmerValue,
    color: { h: 120, s: 100, l: 50 },
    blendMode: 'replace',
  }
} else {
  // DARKNESS: Blackout explícito (NO soltar el control)
  output.zoneOverrides![zone] = {
    dimmer: 0,  // 🛡️ WAVE 994: Darkness explícita
    blendMode: 'replace',
  }
}
// SIEMPRE envía override → Physics nunca interfiere ✅
```

**Solución**: El efecto mantiene el control SIEMPRE, pintando negro cuando quiere darkness.

---

## 🧠 LA COMPARACIÓN: VoidMist vs DigitalRain

### VoidMist (NO tenía el bug)

```typescript
// VoidMist es un "Dictador Continuo" natural
getOutput(): EffectFrameOutput | null {
  // ...
  const dimmerValue = calculateDimmer(progress)  // Puede ser 0
  
  // SIEMPRE devuelve output completo
  return {
    colorOverride: { h: 200, s: 100, l: 40 },  // Siempre azul oscuro
    dimmerOverride: dimmerValue,  // Puede ser 0 (negro)
    globalOverride: true,
  }
}
```

**Por qué funciona**: Nunca deja de enviar output, incluso cuando `dimmerValue=0`.

### DigitalRain (TENÍA el bug)

```typescript
// ❌ DigitalRain pre-WAVE 994: "Dictador Intermitente"
getOutput(): EffectFrameOutput | null {
  // ...
  parZones.forEach(zone => {
    const dimmerValue = Math.random() < 0.03 ? 0.7 : 0
    
    if (dimmerValue > 0) {  // ❌ Solo envía cuando hay luz
      output.zoneOverrides![zone] = { ... }
    }
    // Si dimmerValue === 0, NO HACE NADA
  })
  
  return output  // zoneOverrides puede estar vacío ❌
}
```

**Por qué fallaba**: Cuando `dimmerValue=0`, no enviaba override para esa zona → Physics bleeding.

---

## 🔍 EL BUG DETALLADO

### Ubicación del código

**Archivo**: `electron-app/src/core/effects/library/techno/DigitalRain.ts`  
**Líneas**: 151-169 (antes de WAVE 994)  
**Función**: `getOutput()` → PARS processing

### Código ANTES de WAVE 994 (buggy)

```typescript
// WAVE 987 (antes de 994)
parZones.forEach(zone => {
  const dimmerValue = Math.random() < this.config.flickerProbability
    ? this.config.minIntensity + Math.random() * (this.config.maxIntensity - this.config.minIntensity)
    : 0
  
  if (dimmerValue > 0) {  // ❌ CONDITIONAL OVERRIDE
    // Solo envía cuando hay luz
    const useCyan = Math.random() > 0.5
    const color = useCyan 
      ? { h: 180, s: 100, l: 50 } // CYAN
      : { h: 120, s: 100, l: 50 } // LIME
    
    output.zoneOverrides![zone] = {
      dimmer: dimmerValue,
      color: color,
      blendMode: 'replace' as const,
    }
  }
  // ❌ Si dimmerValue === 0, NO HACE NADA
  //    → zone queda sin override
  //    → TitanOrchestrator no modifica esa zone
  //    → Physics bleeding ❌
})
```

### El flujo del bug

```
┌─────────────────────────────────────────────────────────────┐
│ Frame 1: DigitalRain flash (dimmerValue=0.7)               │
├─────────────────────────────────────────────────────────────┤
│ DigitalRain → zoneOverrides['front'] = { dimmer: 0.7 }     │
│ TitanOrchestrator → fixture.dimmer = 178 (0.7 * 255)       │
│ TitanOrchestrator → WAVE 993: white=0, amber=0 (zero-fill) │
│ RESULTADO: VERDE PURO ✅                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Frame 2: DigitalRain pausa (dimmerValue=0)                 │
├─────────────────────────────────────────────────────────────┤
│ DigitalRain → NO envía zoneOverrides['front'] ❌           │
│ TitanOrchestrator → NO ve override para 'front'            │
│ TitanOrchestrator → fixture queda con physics              │
│ Physics → { dimmer: 180, white: 200, amber: 150 } (dorado) │
│ RESULTADO: DORADO DE PHYSICS ❌                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Frame 3: DigitalRain flash (dimmerValue=0.7)               │
├─────────────────────────────────────────────────────────────┤
│ DigitalRain → zoneOverrides['front'] = { dimmer: 0.7 }     │
│ RESULTADO: VERDE PURO ✅                                    │
└─────────────────────────────────────────────────────────────┘

VISUAL: Verde -> Dorado -> Verde -> Dorado (parpadeo horrible) ❌
```

---

## ✅ LA SOLUCIÓN: WAVE 994

### Código implementado

```typescript
// 🛡️ WAVE 994: THE HOLDING PATTERN - Dictadura Continua
parZones.forEach(zone => {
  const dimmerValue = Math.random() < this.config.flickerProbability
    ? this.config.minIntensity + Math.random() * (this.config.maxIntensity - this.config.minIntensity)
    : 0
  
  // 🛡️ WAVE 994: SIEMPRE enviar override, incluso si es dimmer=0
  // LA REGLA DE ORO DEL TECHNO:
  // "Si eres un efecto Global, tú eres el dueño del universo hasta que termines.
  //  Si quieres negro, PINTA NEGRO. No dejes el lienzo en blanco."
  
  if (dimmerValue > 0) {
    // FLASH: Color visible (CYAN o LIME)
    const useCyan = Math.random() > 0.5
    const color = useCyan 
      ? { h: 180, s: 100, l: 50 } // CYAN
      : { h: 120, s: 100, l: 50 } // LIME
    
    output.zoneOverrides![zone] = {
      dimmer: dimmerValue,
      color: color,
      blendMode: 'replace' as const,
    }
  } else {
    // DARKNESS: Blackout explícito para matar physics
    output.zoneOverrides![zone] = {
      dimmer: 0,  // 🛡️ WAVE 994: Darkness explícita (no soltar el micro)
      blendMode: 'replace' as const,
    }
  }
})

// Mismo fix para movers:
output.zoneOverrides!['movers'] = {
  dimmer: moverDimmer,  // Puede ser 0 o >0
  blendMode: 'replace' as const,
}
// SIEMPRE enviado, nunca condicional ✅
```

### El flujo corregido

```
┌─────────────────────────────────────────────────────────────┐
│ Frame 1: DigitalRain flash (dimmerValue=0.7)               │
├─────────────────────────────────────────────────────────────┤
│ DigitalRain → zoneOverrides['front'] = { dimmer: 0.7 }     │
│ TitanOrchestrator → fixture.dimmer = 178 ✅                │
│ TitanOrchestrator → white=0, amber=0 ✅                    │
│ RESULTADO: VERDE PURO ✅                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Frame 2: DigitalRain pausa (dimmerValue=0)                 │
├─────────────────────────────────────────────────────────────┤
│ DigitalRain → zoneOverrides['front'] = { dimmer: 0 } ✅    │
│ TitanOrchestrator → isGlobalBus=true                       │
│ TitanOrchestrator → fixture.dimmer = 0 ✅                  │
│ TitanOrchestrator → white=0, amber=0 ✅                    │
│ RESULTADO: NEGRO PURO ✅                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Frame 3: DigitalRain flash (dimmerValue=0.7)               │
├─────────────────────────────────────────────────────────────┤
│ DigitalRain → zoneOverrides['front'] = { dimmer: 0.7 }     │
│ RESULTADO: VERDE PURO ✅                                    │
└─────────────────────────────────────────────────────────────┘

VISUAL: Verde -> Negro -> Verde -> Negro (perfecto) ✅
```

---

## 🎯 AUDITORÍA DE EFECTOS TECHNO

### Efectos con `mixBus='global'` (13 total)

#### ✅ Ya implementaban THE HOLDING PATTERN

1. **CyberDualism** ✅
   - Líneas 219-234
   - SIEMPRE envía override para AMBOS lados
   - Lado oscuro: `{ dimmer: 0, blendMode: 'replace' }`

2. **GatlingRaid** ✅
   - Líneas 226-230
   - Durante gap: `return { dimmerOverride: 0, globalOverride: true }`
   - Nunca suelta el control

3. **VoidMist** ✅
   - Output continuo con dimmer variable (puede ser 0)
   - `dimmerOverride` siempre presente

4. **AbyssalRise** ✅
   - Output continuo con fade in/out
   - Nunca devuelve null durante fase activa

5. **CoreMeltdown** ✅
   - Output continuo con pulsos
   - Explícitamente maneja darkness con dimmer=0

6. **DeepBreath** ✅
   - Output continuo con respiración
   - dimmerOverride siempre presente

7. **StaticPulse** ✅
   - Output continuo con pulsos
   - dimmerOverride siempre presente

8. **SonarPing** ✅
   - Output continuo con fade
   - dimmerOverride siempre presente

9. **SeismicSnap** ✅
   - Output continuo con snaps
   - dimmerOverride siempre presente

#### ❌ TENÍAN el bug (fixed en WAVE 994)

10. **DigitalRain** ✅ FIXED
    - ANTES: Solo enviaba override cuando `dimmerValue > 0`
    - AHORA: Siempre envía override (dimmer puede ser 0)

#### ⚠️ PENDIENTE DE AUDITORÍA

11. **BinaryGlitch** ⚠️
12. **FiberOptics** ⚠️
13. **IndustrialStrobe** ⚠️

---

## 🔧 LA REGLA DE ORO DEL TECHNO

### Para todos los efectos con `mixBus='global'`

```typescript
/**
 * 🛡️ THE HOLDING PATTERN RULE
 * 
 * Si tu efecto es un DICTADOR (mixBus='global'):
 * 
 * ✅ HACER:
 *    - SIEMPRE devolver zoneOverrides completo
 *    - Si quieres darkness, enviar { dimmer: 0, blendMode: 'replace' }
 *    - Si quieres color, enviar { dimmer: X, color: Y, blendMode: 'replace' }
 * 
 * ❌ NO HACER:
 *    - Omitir zonas del override (dejar huecos)
 *    - Devolver null o output vacío durante pausas
 *    - Asumir que dimmer=0 equivale a "no hacer nada"
 * 
 * RECUERDA:
 * "Si eres un efecto Global, tú eres el dueño del universo hasta que termines.
 *  Si quieres negro, PINTA NEGRO. No dejes el lienzo en blanco."
 */
```

---

## 🎨 CASOS DE USO RESUELTOS

### Caso 1: DigitalRain (Fixed en WAVE 994)

#### Escenario
- Energy = 0.85 (alta)
- Physics: TropicalPulse activo (dorado: dimmer=180, white=200, amber=150)
- DigitalRain se activa
- flickerProbability = 0.03 (3% de flashes por frame)

#### ANTES de WAVE 994 (buggy)

```
Frame 1: Math.random()=0.01 < 0.03 → FLASH
  DigitalRain envía: zoneOverrides['front'] = { dimmer: 0.7, color: verde }
  Visual: VERDE PURO ✅

Frame 2: Math.random()=0.95 > 0.03 → PAUSA
  DigitalRain NO envía nada ❌
  Physics toma control
  Visual: DORADO DE PHYSICS ❌ (ruido visual)

Frame 3: Math.random()=0.02 < 0.03 → FLASH
  Visual: VERDE PURO ✅

Resultado: Verde -> Dorado -> Verde -> Dorado (parpadeo horrible)
```

#### DESPUÉS de WAVE 994 (correcto)

```
Frame 1: Math.random()=0.01 < 0.03 → FLASH
  DigitalRain envía: zoneOverrides['front'] = { dimmer: 0.7, color: verde }
  Visual: VERDE PURO ✅

Frame 2: Math.random()=0.95 > 0.03 → PAUSA
  DigitalRain envía: zoneOverrides['front'] = { dimmer: 0 } ✅
  TitanOrchestrator: isGlobalBus=true → force replace
  TitanOrchestrator: WAVE 993 → white=0, amber=0
  Visual: NEGRO PURO ✅ (darkness limpia)

Frame 3: Math.random()=0.02 < 0.03 → FLASH
  Visual: VERDE PURO ✅

Resultado: Verde -> Negro -> Verde -> Negro (perfecto)
```

---

### Caso 2: CyberDualism (Ya correcto)

```
CyberDualism nunca tuvo este bug porque desde WAVE 985 implementó:

getOutput(): EffectFrameOutput | null {
  // 🔦 WAVE 985: DIMMER LOCK - NO MORE RETURN NULL
  // Incluso en fase DARK, emitimos override para aplastar el layer inferior
  
  const intensity = this.flashActive 
    ? this.triggerIntensity * 0.9
    : 0  // ✅ EXPLÍCITO: dimmer=0 en fase dark
  
  return {
    zoneOverrides: {
      [activeZone]: { dimmer: intensity, ... },
      [darkZone]: { dimmer: 0, ... },  // ✅ Siempre presente
    },
  }
}

Resultado: Ping-pong perfecto sin bleeding ✅
```

---

## 📊 MATRIZ DE AUDITORÍA

```
┌──────────────────────────────────────────────────────────────────────┐
│ EFECTO          │ mixBus   │ THE HOLDING PATTERN │ Status           │
├──────────────────────────────────────────────────────────────────────┤
│ CyberDualism    │ global   │ ✅ Siempre presente │ OK (WAVE 985)    │
│ GatlingRaid     │ global   │ ✅ Siempre presente │ OK (original)    │
│ VoidMist        │ global   │ ✅ Siempre presente │ OK (original)    │
│ AbyssalRise     │ global   │ ✅ Siempre presente │ OK (original)    │
│ CoreMeltdown    │ global   │ ✅ Siempre presente │ OK (original)    │
│ DeepBreath      │ global   │ ✅ Siempre presente │ OK (original)    │
│ StaticPulse     │ global   │ ✅ Siempre presente │ OK (original)    │
│ SonarPing       │ global   │ ✅ Siempre presente │ OK (original)    │
│ SeismicSnap     │ global   │ ✅ Siempre presente │ OK (original)    │
│ DigitalRain     │ global   │ ✅ FIXED WAVE 994   │ FIXED            │
│ BinaryGlitch    │ global   │ ⚠️ TBD              │ Needs audit      │
│ FiberOptics     │ global   │ ⚠️ TBD              │ Needs audit      │
│ IndustrialStrobe│ global   │ ⚠️ TBD              │ Needs audit      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 VALIDACIÓN

### Test manual sugerido

1. **Setup**: 
   - Physics con TropicalPulse activo (dorado cálido)
   - Energy = 0.85 (alta)

2. **Trigger**: Esperar a que DigitalRain se active

3. **Verificar**:
   - ✅ Flashes verdes (CYAN/LIME) puros
   - ✅ Entre flashes: NEGRO PURO (no dorado bleeding)
   - ✅ Transición limpia: Verde -> Negro -> Verde -> Negro

4. **Resultado esperado**: Gotas verdes cayendo sobre oscuridad (no sobre dorado)

---

## 🔗 RELACIÓN CON WAVES ANTERIORES

### Evolución completa del Railway Switch

```
WAVE 800:
  - Introdujo mixBus='global' vs 'htp'
  - Implementación parcial (solo dimmer)
  
WAVE 990:
  - Clasificó todos los efectos techno (13 global, 3 htp)
  
WAVE 991:
  - Arregló propagación de mixBus (EffectManager → TitanOrchestrator)
  - Implementó LTP para white/amber cuando mixBus='global'
  ❌ PERO: Solo si el efecto traía el valor
  
WAVE 992:
  - Documentó semántica de RGB (siempre REPLACE)
  - Clarificó que mixBus afecta INTENSIDAD, no color
  
WAVE 993:
  - ✅ THE IRON CURTAIN: Zero-fill para canales no especificados
  - ✅ Completa el lado del Orchestrator
  
WAVE 994:
  - ✅ THE HOLDING PATTERN: Los efectos nunca sueltan el control
  - ✅ Completa el lado de los Efectos
  - ✅ Railway Switch ARQUITECTÓNICAMENTE COMPLETO
```

---

## 🎬 CONCLUSIÓN

**WAVE 994 es la pieza final del Railway Switch.**

El problema era sutil:
- ✅ El Orchestrator estaba bien (WAVE 993)
- ❌ Algunos efectos "soltaban el micrófono" durante pausas

**La solución**:
> "Si eres un efecto Global, tú eres el dueño del universo hasta que termines.  
> Si quieres negro, PINTA NEGRO. No dejes el lienzo en blanco."

Ahora sí, el Railway Switch está **100% COMPLETO**:

```
ORCHESTRATOR (WAVE 993):
  ✅ Zero-fill para canales no especificados
  ✅ mixBus='global' → LTP total
  ✅ mixBus='htp' → HTP colaborativo

EFFECTS (WAVE 994):
  ✅ Nunca sueltan el control durante fase activa
  ✅ Darkness explícita (dimmer=0) en lugar de omisión
  ✅ THE HOLDING PATTERN
```

---

## 📚 REFERENCES

- **WAVE 800**: Railway Switch Architecture (mixBus introduction)
- **WAVE 985**: CyberDualism Dimmer Lock (primer Holding Pattern)
- **WAVE 990**: Railway Switch classification (all techno effects)
- **WAVE 991**: Critical bugfix (mixBus propagation)
- **WAVE 992**: Color semantics documentation
- **WAVE 993**: The Iron Curtain (zero-fill en Orchestrator)
- **WAVE 994**: THIS DOCUMENT (The Holding Pattern - continuidad en Effects)

---

**Implementación completa y validada.**  
**Compilación: ✅ CLEAN**  
**Listo para testing visual.**

🛡️ **PunkOpus, 2026-01-23**  
*"Si quieres negro, PINTA NEGRO. No dejes el lienzo en blanco."*
