# 🚗 WAVE 349: TECHNO UNCHAINED - Gearbox Period Awareness

**Date**: 2026-01-10  
**Status**: ✅ COMPLETE  
**Layer**: ENGINE/MOVEMENT  
**Files Modified**: `VibeMovementManager.ts`

---

## 🎯 THE PROBLEM

**Síntoma**: "Techno se mueve como una viejita coja"

```
[🚗 GEARBOX] BPM:140 | Requested:255 DMX | Budget:107 DMX | Factor:0.42 (42% amplitude)
```

### Root Cause Analysis

El Gearbox calculaba el presupuesto de viaje asumiendo que **cada patrón completa 1 ciclo por beat**.

**Matemática del dolor** (antes de WAVE 349):
```
HARDWARE_MAX_SPEED = 250 DMX/s  (conservador para EL-1140)
BPM = 140 → secondsPerBeat = 0.428s
maxTravelPerBeat = 250 * 0.428 = 107 DMX
requestedTravel = 255 DMX (sweep completo)
gearboxFactor = min(1.0, 107/255) = 0.42 → 42% amplitud
```

**Resultado**: Sweeps minúsculos, movers tímidos, Techno sin alma.

---

## 🔧 THE SOLUTION: PATTERN PERIOD METADATA

### 1. Nuevo Mapa de Períodos

```typescript
/**
 * 🚗 WAVE 349: PATTERN PERIOD METADATA
 * 
 * Le dice al GEARBOX cuántos beats toma cada patrón en completar un ciclo.
 * - 1 = Normal (1 beat = 1 ciclo)
 * - 2 = HALF-TIME (2 beats = 1 ciclo) ← Los patrones de Techno
 * - 4 = QUARTER-TIME (4 beats = 1 ciclo)
 */
const PATTERN_PERIOD: Record<string, number> = {
  // 🎛️ TECHNO: HALF-TIME para sweeps dramáticos
  sweep: 2,        // 2 beats por ciclo
  skySearch: 4,    // 4 beats por ciclo (muy lento pero GRANDIOSO)
  botStabs: 1,     // Stabs son instantáneos
  mirror: 2,
  
  // 💃 LATINO: Normal timing (caderas rápidas)
  figure8: 1,
  circle: 1,
  snake: 1,
  
  // 🎸 ROCK: Mezcla
  blinder: 1,
  vShape: 1,
  wave: 1,
  
  // 🍸 CHILL: Ultra slow
  ocean: 4,
  drift: 4,
  nebula: 4,
  aurora: 4,
  
  static: 1,
}
```

### 2. Gearbox Actualizado

**ANTES**:
```typescript
const maxTravelPerBeat = HARDWARE_MAX_SPEED * secondsPerBeat
const gearboxFactor = Math.min(1.0, maxTravelPerBeat / requestedTravel)
```

**AHORA**:
```typescript
const patternPeriod = PATTERN_PERIOD[patternName] || 1
const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel)
```

### 3. Bonus Fix: energyBoost Overflow

**Descubierto durante testing**: `energyBoost` puede hacer que `finalScale > 1.0`:

```typescript
const energyBoost = 1.0 + audio.energy * 0.2  // Hasta 1.2x
const vibeScale = config.amplitudeScale * energyBoost  // 1.0 * 1.2 = 1.2
const finalScale = Math.min(1.0, vibeScale * gearboxFactor)  // CLAMP a 1.0
```

Sin el clamp, `skySearch` con energía alta generaba `Amp:1.04` → posiciones fuera de rango → movers como faros espaciales.

---

## 📊 MATHEMATICAL VICTORY

| BPM | Pattern | Period | Budget (DMX) | Amplitude (Antes) | Amplitude (Ahora) |
|-----|---------|--------|--------------|-------------------|-------------------|
| 120 | sweep   | 2x     | 250 * 0.5 * 2 = 250 | 52% | **98%** (capped 100%) |
| 140 | sweep   | 2x     | 250 * 0.43 * 2 = 215 | 42% | **84%** ✅ |
| 160 | sweep   | 2x     | 250 * 0.375 * 2 = 187 | 37% | **73%** ✅ |
| 140 | skySearch | 4x   | 250 * 0.43 * 4 = 430 | 42% | **100%** ✅ |
| 174 | skySearch | 4x   | 250 * 0.34 * 4 = 340 | 37% | **100%** ✅ |

**Notas**:
- `sweep` (2x): 80-90% amplitud en rango típico de Techno (120-160 BPM)
- `skySearch` (4x): FULL THROTTLE hasta ~250 BPM
- `botStabs` (1x): Mantiene agresividad (stabs no necesitan más tiempo)

---

## 🎛️ NUEVOS LOGS

### Antes (Depressing):
```
[🚗 GEARBOX] BPM:140 | Requested:255 DMX | Budget:107 DMX | Factor:0.42 (42% amplitude)
```

### Ahora (Victory):
```
[🚗 GEARBOX] BPM:174 | Pattern:sweep(2x) | Requested:264 DMX | Budget:172 DMX | Factor:0.65 (65% amplitude)
[🚗 GEARBOX] ✅ FULL THROTTLE | BPM:183 | Pattern:skySearch(4x) | 100% amplitude
```

El log ahora muestra:
- **Pattern name + period**: `sweep(2x)`, `skySearch(4x)`
- **Budget ajustado**: `172 DMX` (2x el anterior)
- **FULL THROTTLE mensaje**: Cuando gearbox está en verde (>95%)

---

## 🐛 BUGS FIXED

### Bug 1: Viejita Coja
- **Síntoma**: Techno con amplitud 37-42% a BPMs altos
- **Causa**: Gearbox asumía 1 beat por ciclo
- **Fix**: Pattern period metadata + Gearbox multiplicador

### Bug 2: Faro Espacial
- **Síntoma**: `skySearch` mandaba movers a Pan:270° Tilt:-124°
- **Causa**: `energyBoost` hacía que `finalScale > 1.0`
- **Fix**: Clamp `finalScale` a 1.0

---

## 🎸 AXIOMA VALIDADO

> **Perfection First**: La solución arquitectónica correcta toma más tiempo pero vale cada segundo.

**Rechazamos**:
- ❌ Hack rápido: `requestedTravel * 0.5` solo para Techno
- ❌ Amplitud fija: Ignorar BPM y enviar valores mágicos
- ❌ Disable Gearbox: Romper la física

**Elegimos**:
- ✅ Metadata declarativa: Cada patrón declara su período
- ✅ Gearbox inteligente: Ajusta presupuesto según patrón
- ✅ Safety clamps: Nunca exceder rango físico

---

## 🔬 TESTING PROTOCOL

1. **Dev Mode**: `npm run dev`
2. **Select Techno vibe** con música >130 BPM
3. **Verificar logs**:
   - `[🚗 GEARBOX]` debe mostrar pattern period: `sweep(2x)`
   - Amplitud debe ser 60-85% para `sweep` a 140+ BPM
   - `skySearch` debe mostrar `✅ FULL THROTTLE`
4. **Observar 3D movers**:
   - Sweeps amplios y dramáticos (no tímidos)
   - Sin saltos extraños o clipping visual
   - Transiciones suaves entre patrones

---

## 📝 COMMIT MESSAGE

```
feat(movement): WAVE 349 - Gearbox Period Awareness

🚗 PATTERN PERIOD METADATA
- Nuevo mapa PATTERN_PERIOD: Cada patrón declara cuántos beats por ciclo
- Techno sweep: 2x (HALF-TIME) → 80% amplitud a 140 BPM
- Techno skySearch: 4x (QUARTER-TIME) → FULL THROTTLE
- Latino/Rock/Chill: Períodos optimizados por estilo

🔧 GEARBOX UPGRADE
- maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
- Logs mejorados: Muestra pattern(Nx) y FULL THROTTLE status
- Safety: Clamp finalScale a 1.0 (evita energyBoost overflow)

📊 RESULTADOS
- Techno sweep: 42% → 84% amplitud (140 BPM)
- Techno skySearch: 37% → 100% amplitud (174 BPM)
- Movers ahora bailan como deben, no como viejitas cojas

FIXES: #349 (Techno "viejita coja")
FIXES: #349.5 (skySearch "faro espacial")
```

---

**Status**: ✅ READY TO ROCK  
**Next**: Testing con música real, ajustar períodos si es necesario  
**Victory**: De 37% a 84%. Techno UNCHAINED. 🎛️⚡
