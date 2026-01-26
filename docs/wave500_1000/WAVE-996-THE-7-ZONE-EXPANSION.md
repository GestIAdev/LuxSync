# 📊 WAVE 996: THE 7-ZONE EXPANSION (Pre-Flight Validation)

**Estado**: 🟡 IN PROGRESS - Fase 1/3 Complete  
**Criticidad**: 🔴 ARCHITECTURAL - Recalibración total de zonas  
**Autor**: Radwulf (arquitecto)  
**Fecha**: 2026-01-23  
**Objetivo**: Monte Carlo 3500 cycles con distribución equitativa

---

## 📋 RESUMEN EJECUTIVO

**WAVE 976.10** balanceó zonas para drops reales pero dejó distribución desigual.  
**WAVE 996** implementa **THE LADDER**: 7 zonas equidistantes para validación Monte Carlo con strict zone mutex.

### La transformación

```
ANTES (WAVE 976.10 - desbalanceado):
  silence: 0-30% (30% ancho) ❌ MUY ANCHO
  valley: 30-50% (20% ancho)
  ambient: 50-65% (15% ancho)
  gentle: 65-75% (10% ancho) ❌ MUY ESTRECHO
  active: 75-82% (7% ancho) ❌ MUY ESTRECHO
  intense: 82-92% (10% ancho)
  peak: 92-100% (8% ancho)

AHORA (WAVE 996 - THE LADDER):
  silence: 0-15% (15% ancho) ✅ EQUIDISTANTE
  valley: 15-30% (15% ancho) ✅ EQUIDISTANTE
  ambient: 30-45% (15% ancho) ✅ EQUIDISTANTE
  gentle: 45-60% (15% ancho) ✅ EQUIDISTANTE
  active: 60-75% (15% ancho) ✅ EQUIDISTANTE
  intense: 75-90% (15% ancho) ✅ EQUIDISTANTE
  peak: 90-100% (10% ancho) ✅ PEAK (locura absoluta)
```

---

## 🎯 OBJETIVO: MONTE CARLO VALIDATION

### Test specifications

```
Cycles: 3500
Energy scenarios: 7 (una por zona)
Condition: STRICT ZONE MUTEX (1 efecto por zona)
Target distribution: ~25% por zona activa (gentle-peak)
```

### Expected results

```
┌─────────────────────────────────────────────────────────────┐
│ ZONA    │ ESPERADO        │ EFECTOS VALIDADOS              │
├─────────────────────────────────────────────────────────────┤
│ SILENCE │ Mínima (< 5%)   │ DeepBreath, SonarPing          │
│ VALLEY  │ Mínima (< 5%)   │ VoidMist, FiberOptics          │
│ AMBIENT │ Mínima (< 5%)   │ DigitalRain, AcidSweep         │
│ GENTLE  │ ~25% (activa)   │ AmbientStrobe, BinaryGlitch    │
│ ACTIVE  │ ~25% (activa)   │ CyberDualism, SeismicSnap      │
│ INTENSE │ ~25% (activa)   │ SkySaw, AbyssalRise            │
│ PEAK    │ ~25% (activa)   │ Gatling, CoreMeltdown, Indus   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 THE LADDER: NUEVA ARQUITECTURA

### Tabla oficial de asignación

| ZONA    | RANGO       | ANCHO | EFECTOS ASIGNADOS (Titular / Suplente)        |
|---------|-------------|-------|------------------------------------------------|
| SILENCE | 0.00 - 0.15 | 15%   | DeepBreath 💨, SonarPing 📡                   |
| VALLEY  | 0.15 - 0.30 | 15%   | VoidMist 🌫️, FiberOptics 🔮                   |
| AMBIENT | 0.30 - 0.45 | 15%   | DigitalRain 🌧️, AcidSweep 🔪                  |
| GENTLE  | 0.45 - 0.60 | 15%   | AmbientStrobe 📷, BinaryGlitch ⚡              |
| ACTIVE  | 0.60 - 0.75 | 15%   | CyberDualism 👯, SeismicSnap 💥                |
| INTENSE | 0.75 - 0.90 | 15%   | SkySaw 🪚, AbyssalRise 🌊                      |
| PEAK    | 0.90 - 1.00 | 10%   | GatlingRaid 🔫, CoreMeltdown ☢️, Industrial 🔨 |

### Visualización: The Ladder

```
1.00 ▓▓▓▓▓▓▓▓▓▓ PEAK (10%) - Locura absoluta
0.90 ────────────────────────────────────────
0.90 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ INTENSE (15%) - Drops épicos
0.75 ────────────────────────────────────────
0.75 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ACTIVE (15%) - Build-ups
0.60 ────────────────────────────────────────
0.60 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ GENTLE (15%) - Ritmos medios
0.45 ────────────────────────────────────────
0.45 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ AMBIENT (15%) - Atmósfera
0.30 ────────────────────────────────────────
0.30 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ VALLEY (15%) - Breakdowns
0.15 ────────────────────────────────────────
0.15 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ SILENCE (15%) - Silencio
0.00 ────────────────────────────────────────
```

---

## 🔧 FASE 1: RECALIBRACIÓN DEL MOTOR ✅

### Archivo modificado

**EnergyConsciousnessEngine.ts** (líneas 88-133):

```typescript
// 🎯 WAVE 996: THE 7-ZONE EXPANSION - THE LADDER
zoneThresholds: {
  silence: 0.15,   // E < 0.15 = SILENCE (0-15%)
  valley: 0.30,    // E < 0.30 = VALLEY (15-30%)
  ambient: 0.45,   // E < 0.45 = AMBIENT (30-45%)
  gentle: 0.60,    // E < 0.60 = GENTLE (45-60%)
  active: 0.75,    // E < 0.75 = ACTIVE (60-75%)
  intense: 0.90,   // E < 0.90 = INTENSE (75-90%)
                   // E >= 0.90 = PEAK (90-100%)
},
```

### Cambios vs WAVE 976.10

```diff
- silence: 0.30   →  + silence: 0.15  (30% → 15%)
- valley: 0.50    →  + valley: 0.30   (20% → 15%)
- ambient: 0.65   →  + ambient: 0.45  (15% → 15% ✅)
- gentle: 0.75    →  + gentle: 0.60   (10% → 15%)
- active: 0.82    →  + active: 0.75   (7% → 15%)
- intense: 0.92   →  + intense: 0.90  (10% → 15%)
  peak: >=0.92    →    peak: >=0.90   (8% → 10%)
```

---

## 🎯 FASE 2: REASIGNACIÓN DE EFECTOS (PENDING)

### Efectos a modificar (16 total)

#### SILENCE (0.00 - 0.15)
- [ ] `DeepBreath.ts` → energyRange: [0.00, 0.15], zones: ['silence']
- [ ] `SonarPing.ts` → energyRange: [0.00, 0.15], zones: ['silence']

#### VALLEY (0.15 - 0.30)
- [ ] `VoidMist.ts` → energyRange: [0.15, 0.30], zones: ['valley']
- [ ] `FiberOptics.ts` → energyRange: [0.15, 0.30], zones: ['valley']

#### AMBIENT (0.30 - 0.45)
- [ ] `DigitalRain.ts` → energyRange: [0.30, 0.45], zones: ['ambient']
- [ ] `AcidSweep.ts` → energyRange: [0.30, 0.45], zones: ['ambient']

#### GENTLE (0.45 - 0.60)
- [ ] `AmbientStrobe.ts` → energyRange: [0.45, 0.60], zones: ['gentle']
- [ ] `BinaryGlitch.ts` → energyRange: [0.45, 0.60], zones: ['gentle']

#### ACTIVE (0.60 - 0.75)
- [ ] `CyberDualism.ts` → energyRange: [0.60, 0.75], zones: ['active']
- [ ] `SeismicSnap.ts` → energyRange: [0.60, 0.75], zones: ['active']

#### INTENSE (0.75 - 0.90)
- [ ] `SkySaw.ts` → energyRange: [0.75, 0.90], zones: ['intense']
- [ ] `AbyssalRise.ts` → energyRange: [0.75, 0.90], zones: ['intense']

#### PEAK (0.90 - 1.00)
- [ ] `GatlingRaid.ts` → energyRange: [0.90, 1.00], zones: ['peak']
- [ ] `CoreMeltdown.ts` → energyRange: [0.90, 1.00], zones: ['peak']
- [ ] `IndustrialStrobe.ts` → energyRange: [0.90, 1.00], zones: ['peak']

### Archivos adicionales afectados

- [x] `ContextualEffectSelector.ts` → **COMPLETE** - Actualizado EFFECTS_BY_INTENSITY (líneas 771-793)
- [ ] `EffectDreamSimulator.ts` → Verificar filtros de zona
- [ ] Tests → `TechnoStrictTest.ts`, futuros Monte Carlo tests

---

## 📊 FASE 3: VALIDACIÓN MONTE CARLO (PENDING)

### Test a crear

**Archivo**: `src/tests/MonteCarloZoneMutex.ts`

#### Especificaciones

```typescript
/**
 * 🎲 WAVE 996: MONTE CARLO ZONE MUTEX TEST
 * 
 * OBJETIVO:
 * Validar distribución equitativa en 7 zonas con strict zone mutex.
 * 
 * TEST:
 * - 3500 ciclos (500 por zona)
 * - 7 escenarios de energía: [0.07, 0.22, 0.37, 0.52, 0.67, 0.82, 0.95]
 * - Cada ciclo: Simular 5 segundos @ 60fps (300 frames)
 * - Validar: Solo 1 efecto activo por zona simultáneamente
 * 
 * SUCCESS CRITERIA:
 * - Zona GENTLE: ~25% activación (±5%) ✅
 * - Zona ACTIVE: ~25% activación (±5%) ✅
 * - Zona INTENSE: ~25% activación (±5%) ✅
 * - Zona PEAK: ~25% activación (±5%) ✅
 * - Zonas SILENCE/VALLEY/AMBIENT: < 5% activación ✅
 * - ZERO zone mutex violations (2 efectos en misma zona) ✅
 */
```

---

## 🧠 RAZONAMIENTO ARQUITECTÓNICO

### Por qué equidistancia

#### ANTES (WAVE 976.10)
```
Problema: Zonas desiguales → test Monte Carlo imposible
- gentle: 10% ancho → muy pocos samples
- active: 7% ancho → casi invisible
- silence: 30% ancho → sobrerepresentada

Resultado: No podías validar distribución equitativa
```

#### AHORA (WAVE 996)
```
Solución: 6 zonas de 15% + peak de 10%
- Cada zona activa (gentle-peak): mismo peso estadístico
- Monte Carlo puede validar ~25% por zona
- Distribución predecible y testeable

Resultado: Validación científica posible
```

### Por qué mover thresholds hacia abajo

```
WAVE 976.10: Zonas empezaban alto (silence=0.30)
Problema: Tracks reales rara vez bajan de 0.30
         → Zonas bajas nunca se usaban

WAVE 996: Zonas empiezan en 0.15
Solución: Captura breakdowns reales (0.15-0.30)
         → VoidMist, DeepBreath ahora tienen espacio real
```

---

## 🎯 IMPACTO EN EFECTOS

### Cambios de zona esperados

```
┌────────────────────────────────────────────────────────────────┐
│ EFECTO          │ ANTES (976.10)    │ AHORA (996)            │
├────────────────────────────────────────────────────────────────┤
│ DeepBreath      │ silence (< 0.30)  │ silence (< 0.15) ✅    │
│ VoidMist        │ valley (< 0.50)   │ valley (< 0.30) ✅     │
│ DigitalRain     │ ambient (< 0.65)  │ ambient (< 0.45) ✅    │
│ AmbientStrobe   │ gentle (< 0.75)   │ gentle (< 0.60) ✅     │
│ CyberDualism    │ active (< 0.82)   │ active (< 0.75) ✅     │
│ SkySaw          │ intense (< 0.92)  │ intense (< 0.90) ✅    │
│ GatlingRaid     │ peak (>= 0.92)    │ peak (>= 0.90) ✅      │
└────────────────────────────────────────────────────────────────┘

CRÍTICO:
- SkySaw/AbyssalRise: BAJARON de zone (intense era 0.82-0.92, ahora 0.75-0.90)
  → Dispararán MÁS TEMPRANO en build-ups (GOOD para épica)
  
- GatlingRaid/CoreMeltdown: BAJARON umbral (peak era >=0.92, ahora >=0.90)
  → MÁS ACCESIBLES en drops normales (GOOD para locura)
```

---

## 🧪 VALIDACIÓN PRE-FLIGHT

### Test manual recomendado (después de Fase 2)

1. **Setup**: Hard Techno track (Charlotte de Witte)

2. **Escenarios**:
   ```
   E=0.10 → SILENCE → DeepBreath/SonarPing ✅
   E=0.25 → VALLEY → VoidMist/FiberOptics ✅
   E=0.40 → AMBIENT → DigitalRain/AcidSweep ✅
   E=0.55 → GENTLE → AmbientStrobe/BinaryGlitch ✅
   E=0.70 → ACTIVE → CyberDualism/SeismicSnap ✅
   E=0.85 → INTENSE → SkySaw/AbyssalRise ✅
   E=0.95 → PEAK → GatlingRaid/CoreMeltdown ✅
   ```

3. **Verificar**:
   - ✅ Solo 1 efecto por zona
   - ✅ Distribución visual equitativa
   - ✅ No overlap entre zonas

---

## ⚠️ RIESGOS Y MITIGACIÓN

### Riesgo 1: Efectos disparan demasiado pronto

```
Problema: SkySaw (intense) ahora empieza en 0.75 (antes 0.82)
         → Puede disparar en pre-drops suaves

Mitigación: Si molesta, ajustar triggerThreshold individual del efecto
           (no cambiar zona global)
```

### Riesgo 2: Zonas bajas muy pobladas

```
Problema: SILENCE (0-15%) puede tener mucho silencio real
         → DeepBreath dispara en pausa de DJ

Mitigación: Ya implementado en Selector:
           - sustainedLow filter (5s de valle sostenido)
           - Cooldown entre efectos bajos
```

### Riesgo 3: Peak demasiado accesible

```
Problema: Peak bajó de 0.92 → 0.90
         → GatlingRaid dispara más seguido

Mitigación: GOOD THING - Era el objetivo
           Peak de 0.92 era inalcanzable en tracks normales
```

---

## 📚 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Motor ✅
- [x] Actualizar `zoneThresholds` en EnergyConsciousnessEngine.ts
- [x] Documentar cambios (este documento)
- [x] Compilación OK

### Fase 2: Efectos ⏳
- [ ] Actualizar 16 archivos de efectos (energyRange + zones)
- [ ] Verificar ContextualEffectSelector.ts
- [ ] Verificar EffectDreamSimulator.ts
- [ ] Compilación completa OK

### Fase 3: Validación ⏳
- [ ] Crear MonteCarloZoneMutex.ts (3500 cycles)
- [ ] Run test con 7 escenarios
- [ ] Validar distribución ~25% por zona activa
- [ ] Zero mutex violations
- [ ] Reporte final

---

## 🎬 ESTADO ACTUAL

```
┌──────────────────────────────────────────────────────────────┐
│ WAVE 996: THE 7-ZONE EXPANSION                               │
├──────────────────────────────────────────────────────────────┤
│ ✅ Fase 1: Motor recalibrado (EnergyConsciousnessEngine)    │
│ ⏳ Fase 2: Reasignar 16 efectos (PENDING)                   │
│ ⏳ Fase 3: Monte Carlo validation (PENDING)                 │
│                                                               │
│ CHECKPOINT: Motor listo, esperando aprobación para Fase 2    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📚 REFERENCES

- **WAVE 976.10**: Recalibración inicial (drops reales)
- **WAVE 988.6**: TechnoStrictTest (whitelist validation)
- **WAVE 996**: THIS DOCUMENT (7-zone expansion)

---

**Esperando luz verde para Fase 2 (reasignación de efectos).**

🎯 **PunkOpus, 2026-01-23**  
*"The Ladder: 7 peldaños hacia la perfección Monte Carlo"*
