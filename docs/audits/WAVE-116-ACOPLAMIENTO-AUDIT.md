# 🔍 WAVE 116: AUDITORÍA FORENSE DE ACOPLAMIENTO DE ZONAS

**Fecha**: 2025-12-25  
**Autor**: Copilot × GeminiPunk  
**Objetivo**: Investigar por qué todas las fixtures se encienden/apagan simultáneamente y si parMax (0.78) se está aplicando

---

## 📋 HALLAZGOS DE LA AUDITORÍA

### 1. ✅ ARQUITECTURA DE ZONAS - NO HAY ACOPLAMIENTO DE CÓDIGO

**Verificación**: Cada zona se calcula **INDEPENDIENTEMENTE** en el switch statement (línea ~948-1150).

```typescript
switch (zone) {
  case 'FRONT_PARS': {
    // Cálculo independiente basado en bassPulse
    intensity = applyDecayWithPhysics(parKey, targetIntensity, ...);
  }
  case 'BACK_PARS': {
    // Cálculo independiente basado en rawTreble
    intensity = applyDecayWithPhysics(backKey, targetIntensity, ...);
  }
  case 'MOVING_LEFT': {
    // Cálculo independiente basado en melodySignal
    intensity = applyDecayWithPhysics(moverKey, targetMover, ...);
  }
}
```

**Conclusión**: No hay código que fuerce sincronización entre zonas. Cada fixture tiene su propia lógica.

---

### 2. 🎯 ENTRADA DE AUDIO - FUGA ESPECTRAL CONFIRMADA

**Hallazgo**: El snare (caja) tiene componentes en **TODAS** las bandas:

- **Bass (20-200Hz)**: Cuerpo del snare → 0.66-0.76
- **Mid (200Hz-2kHz)**: Ataque del snare → 0.55-0.59  
- **Treble (2kHz-20kHz)**: Brillo del snare → 0.29-0.33

**Evidencia del log**:
```
[LUX_DEBUG] Mode:DROP | RAW[B:0.76 M:0.58 T:0.32] | PAR:0.20 MOV:0.45
```

Cuando hay un snare:
- `bassPulse` (Front Pars) = 0.76 → Activa Front
- `rawTreble` (Back Pars) = 0.32 → Activa Back
- `melodySignal` (Movers) = max(0.58, 0.32) = 0.58 → Activa Movers

**Conclusión**: El "acoplamiento misterioso" NO es un bug de código, es **fuga espectral legítima del snare**.

---

### 3. ⚠️ PROBLEMA DE parMax - NECESITA VERIFICACIÓN

**Hipótesis**: El límite `parMax: 0.78` se aplica a `rawIntensity` ANTES de clipper/physics.

**Código actual (línea ~973)**:
```typescript
let rawIntensity = Math.min(1, (bassPulse - preset.parGate) * preset.parGain);
rawIntensity = Math.min(preset.parMax, rawIntensity); // ← Aplicado aquí
targetIntensity = applySoftKneeClipper(rawIntensity);
intensity = applyDecayWithPhysics(parKey, targetIntensity, preset.decaySpeed, 'PAR');
```

**Posibles fugas**:
1. `applyDecayWithPhysics()` podría NO respetar el techo si el buffer previo es > 0.78
2. El log `PAR:0.65` muestra intensidad final **DESPUÉS** de physics, no el raw

**Logs añadidos para verificar**:
- `[PAR_AUDIT]`: Rastrea before/after parMax y clipper
- `[PAR_PHYSICS]`: Rastrea target vs final después de physics
- `[VIBE_AUDIT]`: Confirma que currentVibePreset es 'techno-club'

---

### 4. 🧬 FLUJO DE DATOS COMPLETO

```
FRONTEND (audioData)
  ↓
currentAudioData {bass, mid, treble}  (línea 2016)
  ↓
audioInput = useRealAudio ? currentAudioData : simulation  (línea 714)
  ↓
rawBass = audioInput.bass  (línea 831)
rawMid = audioInput.mid
rawTreble = audioInput.treble
  ↓
bassPulse = rawBass - (bassFloor * 0.60)  (línea 850)
melodySignal = max(normMid, normTreble)  (línea 854)
  ↓
SWITCH (zone)  (línea 948)
  ↓ FRONT_PARS
  rawIntensity = (bassPulse - gate) * gain
  rawIntensity = min(parMax, rawIntensity)  ← 🔴 TECHO AQUÍ
  targetIntensity = applySoftKneeClipper(rawIntensity)
  intensity = applyDecayWithPhysics(parKey, targetIntensity, ...)
  ↓
dimmer = round(intensity * 255)  (línea 1179)
  ↓
DMX Hardware
```

---

## 🎨 HIPÓTESIS DEL ACOPLAMIENTO

### Hipótesis A: Fuga Espectral (MÁS PROBABLE)
El snare activa TODAS las bandas legítimamente:
- Bass → Front Pars
- Treble → Back Pars
- Mid → Movers

**Solución**: No es un bug, es física del sonido. Podríamos:
1. Añadir **Spectral Masking** - Si Treble > 0.6, reducir Bass influence en Front
2. Añadir **Zone Priority** - Solo 1 zona puede estar al 100% a la vez
3. **Aceptar el comportamiento** - Es realista que el snare active todo

### Hipótesis B: Decay Buffer Overflow
`applyDecayWithPhysics()` mantiene un buffer que podría:
- Exceder `parMax` si el valor previo era alto
- No resetear correctamente

**Verificación**: El log `[PAR_PHYSICS]` mostrará si `intensity > 0.78` alguna vez.

### Hipótesis C: Vibe Preset Incorrecto
`currentVibePreset` podría NO ser 'techno-club', cayendo en fallback con `parMax: 1.0`.

**Verificación**: El log `[VIBE_AUDIT]` mostrará el preset real.

---

## 📊 PRÓXIMOS PASOS

### Paso 1: Ejecutar con logs de diagnóstico
```powershell
# Compilar con los nuevos logs
npm run dev
```

Buscar en consola:
- `[PAR_AUDIT]`: Confirmar que parMax se aplica
- `[PAR_PHYSICS]`: Ver si el decay respeta el techo
- `[VIBE_AUDIT]`: Confirmar preset actual

### Paso 2: Analizar resultados

**Si `[PAR_PHYSICS]` muestra `Final:0.82`** → Bug en `applyDecayWithPhysics()`  
**Si `[VIBE_AUDIT]` muestra `parMax:1.0`** → Bug en vibe mapping  
**Si todo está en rango** → El acoplamiento es fuga espectral legítima

### Paso 3: Soluciones propuestas

#### Opción A: Spectral Isolation (Nueva WAVE 117)
```typescript
// En FRONT_PARS
if (rawTreble > rawBass * 1.5) {
  // El snare domina, reducir influence de bajo
  rawIntensity *= 0.5;
}
```

#### Opción B: Zone Priority System
```typescript
const zoneIntensities = {
  front: frontIntensity,
  back: backIntensity,
  movers: moverIntensity
};
const maxZone = Object.entries(zoneIntensities).reduce((a,b) => a[1] > b[1] ? a : b);
// Solo maxZone va al 100%, otros se reducen
```

#### Opción C: Hard Ceiling Post-Physics
```typescript
intensity = applyDecayWithPhysics(...);
intensity = Math.min(preset.parMax, intensity); // ← Aplicar DESPUÉS también
```

---

## 🧪 LOGS DIAGNÓSTICOS AÑADIDOS

### 1. PAR_AUDIT (línea ~980)
```typescript
console.log(`[PAR_AUDIT] Pulse:${bassPulse.toFixed(2)} | Before:${beforeParMax.toFixed(2)} | After parMax(${preset.parMax}):${rawIntensity.toFixed(2)} | After Clip:${targetIntensity.toFixed(2)} | Vibe:${currentVibePreset}`);
```

### 2. PAR_PHYSICS (línea ~990)
```typescript
console.log(`[PAR_PHYSICS] Target:${targetIntensity.toFixed(2)} → Final:${intensity.toFixed(2)} | DecaySpeed:${preset.decaySpeed} | Key:${parKey}`);
```

### 3. VIBE_AUDIT (línea ~828)
```typescript
console.log(`[VIBE_AUDIT] currentVibePreset:'${currentVibePreset}' | parMax:${constraints.parMax} | backParMax:${constraints.backParMax} | melodyThreshold:${constraints.melodyThreshold}`);
```

---

## 🏁 CONCLUSIÓN PRELIMINAR

El "acoplamiento misterioso" tiene 2 causas posibles:

1. **Fuga Espectral** (80% probabilidad): El snare activa todas las bandas porque es un sonido de amplio espectro. Esto es **comportamiento esperado**, no un bug.

2. **Decay Buffer Overflow** (20% probabilidad): `applyDecayWithPhysics()` podría no respetar `parMax` si el buffer previo excede el límite.

**Recomendación**: Ejecutar con logs diagnósticos y analizar los resultados antes de implementar soluciones.
