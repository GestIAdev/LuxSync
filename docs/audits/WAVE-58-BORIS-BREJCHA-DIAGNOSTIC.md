# 🔍 WAVE 58: DIAGNÓSTICO BORIS BREJCHA - 4 BUGS CRÍTICOS

**Fecha:** 2025-12-21  
**Track:** Boris Brejcha (Techno)  
**Duración log:** 8 minutos  
**Estado:** 🚨 CRÍTICO - 4 bugs mayores detectados

---

## 📋 RESUMEN EJECUTIVO

Usuario reporta 4 problemas graves durante reproducción de Boris Brejcha:

| Problema | Estado Backend | Estado UI | Gravedad |
|----------|---------------|-----------|----------|
| **Zodiac inmutable** | ♍ `Zodiac=C` (correcto) | No cambia | 🟡 MEDIO |
| **Género errático** | `ELECTRONIC_4X4` → `LATINO_TRADICIONAL` | "pñe" | 🔴 CRÍTICO |
| **Strategy parcial** | `complementary` estable | Algo de `analogous` | 🟡 MEDIO |
| **DROP infinito** | Ciclo rápido ATTACK→RELEASE | UI vive en DROP | 🔴 CRÍTICO |

---

## 1. 🐛 BUG #1: DROP STATE MACHINE - "EL DROP INFINITO"

### Síntoma
Usuario reporta: **"El DROP. Horrible. En la UI Selene vive en un drop casi infinito"**

### Evidencia del Log

```log
[EnergyStabilizer] 🏎️ Drop=false Breakdown=false DropState=COOLDOWN Active=false
[EnergyStabilizer] 🎢 DROP: COOLDOWN → IDLE (ready for next drop)
[EnergyStabilizer] 🎢 DROP: IDLE → ATTACK
[EnergyStabilizer] 🎢 State: IDLE → ATTACK, Active=false  // ❌ ACTIVE DEBERÍA SER TRUE
[EnergyStabilizer] 🎢 DROP: ATTACK → RELEASE (aborted)
[EnergyStabilizer] 🎢 State: ATTACK → RELEASE, Active: true
[EnergyStabilizer] 🎢 DROP: RELEASE → COOLDOWN
[EnergyStabilizer] 🎢 State: RELEASE → COOLDOWN, Active: false
// ... 5 segundos después
[EnergyStabilizer] 🎢 DROP: COOLDOWN → IDLE (ready for next drop)
[EnergyStabilizer] 🎢 DROP: IDLE → ATTACK
[EnergyStabilizer] 🎢 State: IDLE → ATTACK, Active=false
```

**Ciclo observado:**
```
IDLE → ATTACK (Active=false ❌) → RELEASE (Active=true) → COOLDOWN (Active=false) → IDLE
Duración total: ~5-8 segundos
Frecuencia: Cada 10-15 segundos
```

### Análisis Técnico

**PROBLEMA 1: `isDropActive` se activa tarde**
```typescript
// EnergyStabilizer.ts línea ~350
case 'ATTACK':
  this.isDropActive = true;  // ✅ CORRECTO
  
  if (this.dropStateFrames >= this.dropConfig.attackFrames) {
    this.dropState = 'SUSTAIN';
  }
  // Si la energía cae durante attack, abortar
  else if (isRelativeBreakdown || energy < 0.3) {
    this.dropState = 'RELEASE';  // ❌ ABORT DEMASIADO SENSIBLE
  }
  break;
```

**PROBLEMA 2: Abort prematuro en ATTACK**
- **Config actual**: `attackFrames: 30` (0.5s)
- **Realidad**: El drop se aborta en 1-2 frames porque `energy < 0.3` O `isRelativeBreakdown`
- **Causa**: Boris Brejcha tiene drops sutiles (no explosivos) con energía que fluctúa

**PROBLEMA 3: Umbral de abort muy bajo**
```typescript
else if (isRelativeBreakdown || energy < 0.3) {  // ❌ 0.3 es muy alto
  this.dropState = 'RELEASE';
}
```

En Boris Brejcha, la energía baja a ~0.6-0.7 entre kicks, disparando abort constantemente.

**PROBLEMA 4: `section.type` siempre `'drop'` en SectionTracker**
```log
[BETA HEARTBEAT] {"section":{"type":"drop","energy":0.88,"confidence":1}}
[BETA HEARTBEAT] {"section":{"type":"drop","energy":0.70,"confidence":1}}
[BETA HEARTBEAT] {"section":{"type":"verse","energy":0.86,"confidence":1}}
[BETA HEARTBEAT] {"section":{"type":"drop","energy":0.84,"confidence":1}}
```

El SectionTracker SIEMPRE marca `type: 'drop'` durante 95% de la canción. Esto NO es culpa del State Machine.

### Root Cause
1. **SectionTracker bug**: Detecta TODO como drop (no es problema de WAVE 57.5)
2. **State Machine abort sensible**: Energía <0.3 es demasiado estricto para techno minimalista
3. **isDropActive en ATTACK**: Se activa pero se aborta en 1-2 frames

### Solución Propuesta

**Fix 1: Aumentar umbral de abort**
```typescript
// Cambiar de 0.3 a 0.2 (solo para silencios reales)
else if (isRelativeBreakdown || energy < 0.2) {
  this.dropState = 'RELEASE';
}
```

**Fix 2: Añadir gracia period en ATTACK**
```typescript
// No abortar en los primeros 15 frames (0.25s) de ATTACK
if (this.dropStateFrames > 15 && (isRelativeBreakdown || energy < 0.2)) {
  this.dropState = 'RELEASE';
}
```

**Fix 3: Ignorar isDropActive si SectionTracker no lo confirma**
```typescript
// En SeleneLux.ts getBroadcast()
const isDropActive = trinityData?.drop?.isDropActive === true 
  && trinityData?.sectionDetail?.type === 'drop';  // 🔧 DOUBLE CHECK
```

---

## 2. 🐛 BUG #2: GÉNERO ERRÁTICO - "LATINO EN TECHNO"

### Síntoma
Usuario reporta: **"La deteccion de genero sigue algo... pñe"**

### Evidencia del Log

```log
Frame 48750: winner="ELECTRONIC_4X4", scores={"ELECTRONIC_4X4":0.9,"LATINO_TRADICIONAL":0.1}
[SimpleBinaryBias] ❄️ ELECTRONIC_4X4 (4x4)
[SimpleBinaryBias] 🔄 GENRE CHANGE: ELECTRONIC_4X4 → LATINO_TRADICIONAL (locked for 20s)
Frame 48900: winner="LATINO_TRADICIONAL", scores={"ELECTRONIC_4X4":0.2,"LATINO_TRADICIONAL":0.8}
```

**Cambio abrupto:**
- **Frame 48750**: `ELECTRONIC_4X4=0.9, LATINO_TRADICIONAL=0.1`
- **150 frames después**: `ELECTRONIC_4X4=0.2, LATINO_TRADICIONAL=0.8`
- **Duración**: 2.5 segundos

### Análisis Técnico

**Contexto del cambio:**
```log
// Frame 48750 - Antes del cambio
"rhythm":{"syncRaw":"0.351","pattern":"four_on_floor","bpm":127}
"harmony":{"key":"C","mode":"minor"}
"section":{"type":"verse","energy":"0.69"}
"audio":{"energy":0.76,"bass":...}

// Frame 48900 - Después del cambio
"rhythm":{"syncRaw":"0.699","pattern":"breakbeat","bpm":127}
"harmony":{"key":"C","mode":"minor"}
"section":{"type":"drop","energy":"0.70"}
"senate":{"winner":"LATINO_TRADICIONAL","features":{"fourOnFloor":false,"dembow":true}}
```

### Root Cause

**SimpleBinaryBias detecta `dembow=true`:**
```typescript
// TrinityBridge.ts - SimpleBinaryBias
const dembow = this.detectDembow(rhythmInput);  // ❌ FALSE POSITIVE
if (dembow) {
  return 'LATINO_TRADICIONAL';  // 💀 CAMBIO ERRÓNEO
}
```

**¿Por qué `dembow=true` en Techno?**
1. **Syncopation alto**: `0.699` (>0.65)
2. **Patrón breakbeat**: No es 4x4 limpio
3. **Detección de dembow** busca: `!fourOnFloor && highSyncopation`

Boris Brejcha usa **breakbeat techno** con síncopa alta, lo que confunde al detector de dembow.

### Solución Propuesta

**Fix: Añadir filtro por BPM a dembow**
```typescript
// TrinityBridge.ts - SimpleBinaryBias
const dembow = this.detectDembow(rhythmInput) && bpm >= 90 && bpm <= 105;
// Dembow típico: 95-105 BPM
// Techno: 120-140 BPM
```

---

## 3. 🐛 BUG #3: ZODIAC INMUTABLE

### Síntoma
Usuario reporta: **"Zodiac sigue inmutable y no cambia"**

### Evidencia del Log

```log
Frame 47700: [MoodArbiter] Votes(B/D/N)=66/696/0
Frame 48300: [MoodArbiter] Votes(B/D/N)=0/757/0 ♍ Zodiac=C
Frame 48900: [MoodArbiter] Votes(B/D/N)=0/773/0 ♍ Zodiac=C
Frame 49200: (sin zodiac info)
```

**Observaciones:**
- Zodiac solo aparece en 2 de 8 logs periódicos
- Siempre muestra `Zodiac=C` (mismo key musical)
- No hay rastro del signo zodiacal (♈, ♉, ♊, etc.)

### Análisis Técnico

**¿Dónde se calcula Zodiac?**
```typescript
// SeleneLux.ts línea 1517-1521
zodiac: {
  element: (this.lastZodiacInfo?.sign?.element ?? 'fire'),
  sign: this.lastZodiacInfo?.sign?.symbol ?? '♈',
  affinity: this.lastZodiacInfo?.sign?.creativity ?? 0.5,
  quality: (this.lastZodiacInfo?.sign?.quality ?? 'cardinal'),
}
```

**¿Cuándo se actualiza `lastZodiacInfo`?**
```typescript
// SeleneLux.ts línea 696-703
if (this.frameCount % 300 === 0) {  // Cada 5 segundos
  this.currentZodiacPosition = ZodiacAffinityCalculator.calculateZodiacPosition(Date.now())
  this.lastZodiacInfo = ZodiacAffinityCalculator.getZodiacInfo(this.currentZodiacPosition)
}
```

### Root Cause

**Problema 1: Zodiac basado en FECHA, no en audio**
- `ZodiacAffinityCalculator.calculateZodiacPosition(Date.now())` usa **timestamp**
- En 8 minutos de canción, el zodiac NO cambia (aún estamos en el mismo día)
- Es un "easter egg" astronómico, NO análisis musical

**Problema 2: El log `♍ Zodiac=C` confunde**
- `C` es la **KEY musical** (do menor)
- `♍` es el símbolo de Virgo
- NO hay relación entre key y zodiac

### Solución Propuesta

**Opción A: Zodiac basado en audio** (cambio arquitectónico grande)
```typescript
// Mapear frecuencias a signos zodiacales
const zodiacFromFrequency = (spectralCentroid: number) => {
  // 0-2000 Hz → Fuego (♈♌♐)
  // 2000-4000 Hz → Tierra (♉♍♑)
  // etc.
}
```

**Opción B: Acelerar ciclo zodiacal** (hack rápido)
```typescript
// Usar timestamp del audio en lugar de Date.now()
const audioTime = this.frameCount * (1000 / 60);  // ms desde inicio sesión
const zodiacPosition = (audioTime / 60000) % 12;  // Cambio cada minuto
```

**Opción C: Eliminar Zodiac** (honestidad brutal)
- Es un easter egg que NO funciona como esperado
- Confunde a los usuarios
- Considerar deprecar

---

## 4. 🐛 BUG #4: STRATEGY PARCIAL

### Síntoma
Usuario reporta: **"Estrategia muestra complementary con algún cambio a analogous"**

### Evidencia del Log

```log
[StrategyArbiter] Strategy=complementary AvgSync=0.54 Locked=false
[StrategyArbiter] Strategy=complementary AvgSync=0.55 Locked=false
// ... TODO EL LOG
"colorEngine":{"strategy":"analogous"}  // ❌ DESCONEXIÓN
[StrategyArbiter] Strategy=complementary
```

### Análisis Técnico

**Backend (GAMMA Worker):**
- StrategyArbiter: `complementary` (estable, 5000+ frames sin cambio)
- debugInfo.mood.colorStrategy.stable: `complementary`

**SeleneColorEngine:**
- `colorEngine.strategy: "analogous"` ❌

**UI:**
- `visualDecision.palette.strategy: complementary` ✅ (WAVE 57 fix)

### Root Cause

**SeleneColorEngine genera su propia estrategia:**
```typescript
// SeleneColorEngine.ts
const strategy = this.deriveStrategy(harmonicTension);  // ❌ IGNORA StrategyArbiter
```

Hay 2 fuentes de estrategia:
1. **StrategyArbiter** (GAMMA) - basado en syncopation ✅
2. **SeleneColorEngine** (GAMMA) - basado en armonía ❌

SeleneColorEngine NO lee el output de StrategyArbiter.

### Solución Propuesta

**Fix: SeleneColorEngine debe leer StrategyArbiter**
```typescript
// mind.ts - Al llamar SeleneColorEngine
const selenePalette = state.seleneColorEngine.generate({
  ...stabilizedAnalysis,
  strategyOverride: strategyArbiterOutput.stableStrategy  // 🔧 NUEVA PROPERTY
});
```

---

## 📊 PRIORIDADES DE FIX

| Bug | Gravedad | Complejidad | Prioridad |
|-----|----------|-------------|-----------|
| **DROP infinito** | 🔴 CRÍTICA | 🟢 BAJA | **P0** |
| **Género LATINO** | 🔴 CRÍTICA | 🟢 BAJA | **P0** |
| **Strategy desync** | 🟡 MEDIA | 🟡 MEDIA | **P1** |
| **Zodiac inmutable** | 🟡 MEDIA | 🔴 ALTA | **P2** |

---

## 🎯 WAVE 58: PLAN DE ACCIÓN

### WAVE 58.1: FIX DROP STATE MACHINE
1. Aumentar umbral abort: `0.3` → `0.2`
2. Grace period en ATTACK: 15 frames sin abort
3. Double-check con SectionTracker

### WAVE 58.2: FIX GÉNERO DEMBOW
1. Añadir filtro BPM a detección dembow: `90-105 BPM`
2. Verificar que techno >120 BPM no triggere dembow

### WAVE 58.3: FIX STRATEGY DESYNC
1. SeleneColorEngine lee `strategyOverride` de StrategyArbiter
2. Eliminar `deriveStrategy()` interno

### WAVE 58.4: ZODIAC REDESIGN (opcional)
1. Discutir con usuario: ¿Zodiac basado en audio o deprecar?
2. Si mantener: Acelerar ciclo a 1 cambio/minuto

---

## 🏁 RESULTADO ESPERADO

**Después de WAVE 58.1-58.2:**
- DROP: Ciclos de 8-15s con sustain real, no abort prematuro
- GÉNERO: Boris Brejcha permanece en `ELECTRONIC_4X4`
- UI: Section.type='drop' solo cuando DROP real (2-8s), no constantemente

**Después de WAVE 58.3:**
- STRATEGY: `complementary` en backend Y UI (sin desync)

**Después de WAVE 58.4:**
- ZODIAC: Decisión sobre arquitectura futura
