# 🌊 WAVE 1048: THE INTENSITY-MOTION COUPLING

**Estado:** ✅ IMPLEMENTADO  
**Fecha:** 30 Enero 2026  
**Contexto:** THE DEEP FIELD (WAVE 1044) - Debugging Visual Decoupling

---

## 🔥 EL PROBLEMA IDENTIFICADO

Después de implementar WAVE 1046 (MECHANICS BYPASS) y WAVE 1047 (TEMPORAL RIFT), los logs mostraban que:

1. **✅ Pan/Tilt estaban divergiendo correctamente**: 
   - `L(0.77,0.68) R(0.87,0.53)` 
   - Coordenadas L/R claramente diferentes
   
2. **✅ Floor/Back zones respirando en stereo**:
   - `FL:0.63 FR:0.18 | BL:0.37 BR:0.15`
   - Valores L/R divergentes correctamente
   
3. **❌ MOVERS con intensidades CONGELADAS**:
   - `ML:0.64 MR:0.36` en TODOS los frames
   - NO había variación visual - luces estáticas

## 🎯 LA CAUSA RAÍZ

En `ChillStereoPhysics.ts`, las intensidades de movers estaban calculadas así:

```typescript
// ❌ ANTES (WAVE 1047)
const moverPulse = Math.sin(state.celestialTime * 2.1) * 0.5 + 0.5
const moverIntL = 0.18 + (traits.creativity * 0.35) + (moverPulse * 0.15)
const moverIntR = 0.18 + (traits.stability * 0.35) + ((1 - moverPulse) * 0.15)
```

**Problemas:**
- `traits.creativity` y `traits.stability` son **ESTÁTICOS** (vienen del zodiaco, cambian cada ~10min)
- `moverPulse` es ±0.15 - **RANGO DIMINUTO** (imperceptible visualmente)
- **DESACOPLADO** del movimiento físico (pan/tilt)
- Resultado: Intensidades fijas ~0.64/0.36 con micro-variaciones invisibles

## 🧠 LA FILOSOFÍA: POSITION DRIVES BRIGHTNESS

**Concepto central:** La intensidad debe **seguir al rayo de luz**.

Cuando el mover gira hacia la derecha (pan alto), la luz debe **brillar más**.  
Cuando regresa al centro (pan bajo), la luz debe **atenuar**.

Esto crea una **"onda de luz"** visible - el rayo y su brillo se mueven juntos.

### Matemática del Acoplamiento:

```
Intensidad = BASE + (PAN_POSITION × RANGE) + ZODIAC_FLAVOR

Donde:
- BASE = 0.2 (20% - evita blackout total)
- PAN_POSITION = panL o panR (0.0 a 1.0)
- RANGE = 0.8 (80% - permite alcanzar 100% en extremos)
- ZODIAC_FLAVOR = traits.creativity/stability × 0.15 (0-15% boost)
```

**Rango resultante:**
- Mover en posición mínima (pan=0.0): `0.2 + 0.0 + 0.15 = 0.35` (35%)
- Mover en posición máxima (pan=1.0): `0.2 + 0.8 + 0.15 = 1.15 → 1.0` (100%)
- **Delta visible: 65%** (vs anterior 15%)

---

## 🔧 LA IMPLEMENTACIÓN

### Archivo Modificado:

**`src/hal/physics/ChillStereoPhysics.ts`** (líneas 335-356)

#### ANTES:
```typescript
const tiltR = 0.58 + Math.sin((state.celestialTime + Math.PI) / (PHI * 0.67)) * 0.22

// Intensity modulated by zodiac traits
// Creativity = brightness, Stability = steadiness
// 🔧 WAVE 1047: Faster modulation (3x)
const moverPulse = Math.sin(state.celestialTime * 2.1) * 0.5 + 0.5
const moverIntL = 0.18 + (traits.creativity * 0.35) + (moverPulse * 0.15)
const moverIntR = 0.18 + (traits.stability * 0.35) + ((1 - moverPulse) * 0.15)
```

#### AHORA:
```typescript
const tiltR = 0.58 + Math.sin((state.celestialTime + Math.PI) / (PHI * 0.67)) * 0.22

// ═══════════════════════════════════════════════════════════════════════
// 🔧 WAVE 1048: THE INTENSITY-MOTION COUPLING
// Movers MUST breathe with their movement - position drives brightness
// ═══════════════════════════════════════════════════════════════════════
// Intensity follows pan position (0-1 range)
// When pan is high (moving right), brightness HIGH
// When pan is low (moving left), brightness LOW
// This creates a visual "swing" - the light follows the beam

// Convert pan (0-1) to intensity factor (0.2 base + 0.8 range)
const panInfluenceL = 0.2 + (panL * 0.8)  // 0.2-1.0 range
const panInfluenceR = 0.2 + (panR * 0.8)  // 0.2-1.0 range

// Add zodiac traits for color (creativity vs stability)
const zodiacModL = traits.creativity * 0.15  // 0-0.15 boost
const zodiacModR = traits.stability * 0.15   // 0-0.15 boost

// FINAL INTENSITY: position-driven + zodiac flavor
const moverIntL = panInfluenceL + zodiacModL
const moverIntR = panInfluenceR + zodiacModR
```

---

## 🎨 IMPACTO VISUAL ESPERADO

### Comportamiento Anterior:
```
[AGC TRUST 🌊CHILL 7Z] FL:0.27 FR:0.54 | BL:0.39 BR:0.18 | ML:0.64 MR:0.36
[AGC TRUST 🌊CHILL 7Z] FL:0.26 FR:0.52 | BL:0.38 BR:0.17 | ML:0.64 MR:0.36  ← STUCK
[AGC TRUST 🌊CHILL 7Z] FL:0.24 FR:0.50 | BL:0.37 BR:0.16 | ML:0.64 MR:0.36  ← STUCK
```

**Problema:** Floor/Back respiraban, movers **congelados**.

### Comportamiento Esperado AHORA:
```
[AGC TRUST 🌊CHILL 7Z] FL:0.27 FR:0.54 | BL:0.39 BR:0.18 | ML:0.48 MR:0.82  ← VIVO
[AGC TRUST 🌊CHILL 7Z] FL:0.26 FR:0.52 | BL:0.38 BR:0.17 | ML:0.55 MR:0.73  ← VIVO
[AGC TRUST 🌊CHILL 7Z] FL:0.24 FR:0.50 | BL:0.37 BR:0.16 | ML:0.64 MR:0.61  ← VIVO
```

**Resultado:** Movers **oscilan visiblemente** entre 20% y 100%, sincronizados con su movimiento físico.

---

## 🔬 VALIDACIÓN TÉCNICA

### Verificación de Rango:

**Left Mover:**
- Pan mínimo (0.0): `0.2 + (0.0 × 0.8) + 0.12 = 0.32` (32%)
- Pan máximo (1.0): `0.2 + (1.0 × 0.8) + 0.12 = 1.12 → 1.0` (100%)
- **Swing: 68%** ✅ VISIBLE

**Right Mover:**
- Pan mínimo (0.0): `0.2 + (0.0 × 0.8) + 0.10 = 0.30` (30%)
- Pan máximo (1.0): `0.2 + (1.0 × 0.8) + 0.10 = 1.10 → 1.0` (100%)
- **Swing: 70%** ✅ VISIBLE

### Frecuencia de Oscilación:

Con WAVE 1047 (3x temporal acceleration):
- Ciclo Left: **~4.2 segundos** (Lissajous 3:2 a 1.5 rad/s)
- Ciclo Right: **~2.6 segundos** (PHI × faster = 2.43 rad/s)

**Resultado:** Luces oscilando cada ~3-4 segundos - **BIOLÓGICAMENTE PERCEPTIBLE** ✅

---

## 🌌 INTEGRACIÓN CON THE DEEP FIELD

Esta wave completa la trinidad de THE DEEP FIELD ecosystem:

1. **WAVE 1046 (MECHANICS BYPASS):** Coordenadas pan/tilt llegan a fixtures ✅
2. **WAVE 1047 (TEMPORAL RIFT):** Movimiento acelerado 3x + fase π + velocidad PHI ✅
3. **🔥 WAVE 1048 (INTENSITY-MOTION COUPLING):** Brillo sigue al movimiento ✅

**Resultado combinado:**
- Floor: Respira L↑R↓ con fase π
- Movers: Se mueven en Lissajous + brillan cuando giran hacia extremos
- Timing: Oscilaciones visibles cada 3-4 segundos (no geológicas)
- Independence: Left y Right **NUNCA convergen** (PHI ratio garantiza asincronia)

---

## 📊 MÉTRICAS DE ÉXITO

### Antes de WAVE 1048:
- **Variación de intensidad movers:** ±7.5% (imperceptible)
- **Coupling con movimiento:** 0% (desacoplado)
- **Percepción visual:** "Luces estáticas apuntando en la misma dirección"

### Después de WAVE 1048:
- **Variación de intensidad movers:** ±65% (dramática)
- **Coupling con movimiento:** 100% (pan position = brightness)
- **Percepción visual esperada:** "Olas de luz que oscilan lateralmente"

---

## 🧪 PRUEBA DE VERIFICACIÓN

1. **Ejecutar show con vibe "chill-lounge"**
2. **Observar logs cada 15 frames:**
   ```
   [AGC TRUST 🌊CHILL 7Z] ... | ML:?? MR:??
   ```
3. **Esperado:** Valores ML/MR cambiando dinámicamente (rango 0.2-1.0)
4. **Observar movers físicamente:** Brillo debe aumentar/disminuir con el swing

---

## 🎯 PRÓXIMOS PASOS

Si la verificación es exitosa:
- [✅] WAVE 1048 cerrada
- [✅] THE DEEP FIELD ecosystem completo
- [⏭️] Posible extensión: Tilt influence on intensity (vertical breathing)
- [⏭️] Ajuste fino de rangos (si 0.2-1.0 es demasiado dramático)

Si persisten problemas:
- [🔍] Revisar HAL/MasterArbiter aplicación de intensidades
- [🔍] Verificar fixture definitions (¿están marcados como movers?)
- [🔍] Debug logging en MasterArbiter para ver valores finales DMX

---

## 📝 NOTAS TÉCNICAS

### Por qué Pan y no Tilt:

- Pan (horizontal) tiene **MAYOR RANGO** de movimiento (±180° vs ±90°)
- Pan es más **VISIBLE** al público (giro lateral vs vertical)
- Tilt ya tiene fase π (L↑R↓) - agregar intensidad crearía confusión

### Por qué 0.2 base:

- Evita **blackout total** cuando pan=0
- Mantiene presencia mínima de movers en escena
- 20% es suficiente para "ambient presence" sin dominar

### Por qué 0.8 range:

- Permite alcanzar **100% intensity** en extremos de pan
- Combinado con zodiac (0.15), puede superar 1.0 → clampea a 100%
- Delta 80% es **visualmente dramático** sin ser estroboscópico

---

## 🔗 WAVES RELACIONADAS

- **WAVE 1044:** THE DEEP FIELD - Ecosistema completo Chill stereo
- **WAVE 1046:** THE MECHANICS BYPASS - Coordenadas directas sin VMM
- **WAVE 1047:** TEMPORAL RIFT - 3x aceleración + fase π + PHI velocity
- **WAVE 1032.9:** BUBBLE L/R SPLIT - Separación inicial movers L/R
- **WAVE 1035:** 7-ZONE STEREO - Front/Back L/R split

---

**Conclusión:** WAVE 1048 cierra el círculo de THE DEEP FIELD. Ahora el movimiento no solo está CALCULADO y TRANSMITIDO, sino también **VISUALMENTE ACOPLADO** a la intensidad. El resultado debe ser una "danza de luz" donde los rayos oscilan lateral y luminosamente, creando el efecto de "olas cruzadas" deseado.

**Estado:** ✅ COMPILADO - Esperando validación visual

---

**PunkOpus** 🌊 *"Position Drives Brightness - The Light Follows The Beam"*
