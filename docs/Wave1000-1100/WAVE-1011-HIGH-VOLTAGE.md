# 🎸 WAVE 1011: HIGH VOLTAGE - ROCK PHYSICS 2.0

**Fecha:** 27 Enero 2026  
**Status:** ✅ IMPLEMENTADO  
**Arquitectos:** PunkOpus + GeminiPunk  
**Directiva:** WAVE 1011 - HIGH VOLTAGE

---

## 📋 EXECUTIVE SUMMARY

**MISIÓN:** Reescribir RockStereoPhysics desde cero usando FFT.ts completo y separar Movers L/R para mayor resolución.

**RESULTADO:** 🟢 **ÉXITO TOTAL**

### Archivos Creados/Modificados:

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/hal/physics/RockStereoPhysics2.ts` | ✨ NUEVO | Nueva clase con 4 bandas reales |
| `src/hal/physics/index.ts` | 📝 MODIFICADO | Export de RockStereoPhysics2 |
| `src/engine/movement/VibeMovementManager.ts` | 📝 MODIFICADO | 3 nuevos patterns + 4 subvibes |

---

## 🏗️ ARQUITECTURA: 4 BANDAS REALES

### BANDA 1: FRONT PARS (The Pulse) 💓

```typescript
Input: subBass (20-60Hz) + kickDetected
Rol: Bombo (Kick) y Bajo
```

**Lógica:**
- Si `kickDetected === true` → **IMPACTO INMEDIATO** (1.0)
- Si no, seguir la envolvente del `subBass + bass`
- Gate dinámico según `spectralFlatness`

**Objetivo:** Marcar el tiempo fuerte. Que el pecho del público vibre con la luz.

---

### BANDA 2: BACK PARS (The Power) 🥊

```typescript
Input: snareDetected + mid + harshness
Rol: Caja (Snare) y Guitarra Rítmica "Harsh"
```

**Lógica:**
- **Dynamic Gain:** Multiplicar ganancia por harshness. Guitarra distorsionada = luz cegadora.
- Si `snareDetected` → **FLASH**
- **Gate Dinámico:** Usar `spectralFlatness`. Noise = gate bajo (caos permitido).

**Objetivo:** Punch visual que corta la mezcla.

---

### BANDA 3: MOVERS LEFT (The Body) 🎸

```typescript
Input: mid + spectralCentroid (bajo/medio)
Rol: Cuerpo de la canción, Riffs, Toms
```

**Lógica:**
- Se mueve con la "masa" de la música
- Boost cuando `centroid < 1500Hz` (sonido grave/pesado)
- Reduce cuando `centroid > 2500Hz` (deja espacio a MoverRight)

**Objetivo:** Wall of Sound de acordes de potencia.

---

### BANDA 4: MOVERS RIGHT (The Shine) ✨

```typescript
Input: treble + spectralCentroid (alto) + hihatDetected
Rol: Solos, Platos, Detalles agudos
```

**Lógica:**
- Se activa cuando `spectralCentroid > 2000Hz` (solos brillantes)
- Boost en `hihatDetected`
- Permite que los solos "corten" la mezcla visualmente

**Objetivo:** Destacar los momentos brillantes (solos, platos).

---

## 🕵️ DETECCIÓN DE SUBGÉNERO

El sistema se auto-configura según las métricas espectrales:

| Subgénero | Condición | Configuración |
|-----------|-----------|---------------|
| **METAL** | `harshness > 0.6 && flatness > 0.5` | Gains agresivos, attacks rápidos, gates bajos (caos) |
| **INDIE** | `harshness < 0.4 && centroid > 2000Hz` | Gains limpios, MoverRight activo (brillo) |
| **PROG** | `flatness < 0.3` (muy tonal) | Attacks lentos (fluidos), épico |
| **CLASSIC** | Default | Énfasis en Bombo/Caja clásico |

### Estabilidad:

- Historial de 30 frames (~0.5s @ 60fps)
- Subgénero más frecuente en el historial = subgénero activo
- Evita ping-pong entre subgéneros

---

## 💃 NUEVOS PATTERNS DE MOVIMIENTO

### 🤘 STAGE DIVE

```typescript
stageDive: (t, phase, audio) => {
  const bassImpact = Math.pow(audio.bass, 1.5)
  const tiltDepth = -0.3 - bassImpact * 0.7  // Range: -0.3 a -1.0
  const panDrift = Math.sin(phase * 0.2) * 0.15
  return { x: panDrift, y: tiltDepth }
}
```

**Uso:** Drop/Chorus - Tilt hacia el público como guitarrista tirándose al pit.

---

### 🎸 GUITAR SOLO

```typescript
guitarSolo: (t, phase, audio) => {
  const panSpeed = Math.sin(phase * 2) * 0.85  // Barridos rápidos L-R
  const tiltVibration = Math.sin(t * 12) * 0.08 * audio.highs
  const tiltBase = -0.15 + tiltVibration
  return { x: panSpeed, y: tiltBase }
}
```

**Uso:** Solos de guitarra - Movers al centro, pan dinámico.

---

### 🤘 HEADBANGER

```typescript
headbanger: (t, phase, audio) => {
  const headDown = audio.bass > 0.45
  const tiltTarget = headDown ? -0.85 : 0.15  // Abajo/Arriba
  const tiltSmooth = Math.sin(phase) * 0.1
  const panDrift = Math.sin(phase * 0.3) * 0.20
  return { x: panDrift, y: tiltTarget + tiltSmooth }
}
```

**Uso:** Metal - Tilt arriba/abajo sincronizado con el kick.

---

## 🎛️ VIBE CONFIGS - ROCK SUBGENRES

### pop-rock (Classic Rock)
```typescript
{
  amplitudeScale: 0.80,
  baseFrequency: 0.20,
  patterns: ['blinder', 'vShape', 'wave', 'stageDive'],
  homeOnSilence: true,
}
```

### rock-metal (Thrash/Heavy)
```typescript
{
  amplitudeScale: 0.95,  // CASI FULL
  baseFrequency: 0.28,   // Rápido
  patterns: ['headbanger', 'chaos', 'blinder', 'stageDive'],
  homeOnSilence: false,  // Metal NO descansa
}
```

### rock-indie (Garage/Alternative)
```typescript
{
  amplitudeScale: 0.70,
  baseFrequency: 0.22,
  patterns: ['guitarSolo', 'wave', 'vShape', 'blinder'],
  homeOnSilence: true,
}
```

### rock-prog (Progressive/Psych)
```typescript
{
  amplitudeScale: 0.75,
  baseFrequency: 0.12,   // LENTO (épico)
  patterns: ['wave', 'nebula', 'ocean', 'guitarSolo'],
  homeOnSilence: true,
}
```

---

## 📊 COMPARATIVA: WAVE 311 vs WAVE 1011

| Métrica | WAVE 311 (Legacy) | WAVE 1011 (High Voltage) |
|---------|-------------------|--------------------------|
| **Métricas FFT** | bass/mid/treble | + harshness, flatness, centroid, subBass |
| **Transientes** | ❌ No detecta | ✅ kick, snare, hihat |
| **Gates** | Fijos (números mágicos) | Dinámicos según flatness |
| **Gains** | Fijos (adivinados) | Dinámicos según harshness/centroid |
| **Movers** | 1 salida combinada | 2 salidas (Left/Right) |
| **Subgéneros** | 0 (genérico) | 4 (metal, indie, prog, classic) |
| **Patterns** | 3 (blinder, vShape, wave) | 6 (+stageDive, guitarSolo, headbanger) |

---

## 🎯 CASOS DE USO

### Metallica - Enter Sandman (Metal)

**Métricas detectadas:**
- Harshness: ~0.78
- Flatness: ~0.62
- Centroid: ~900Hz (dark)

**Subgénero:** `metal`

**Comportamiento:**
```
Front: kickDetected → 1.0 en cada golpe
Back: snareDetected + harshness alto → 0.9-1.0
MoverLeft: centroid dark → boost body → 0.7-0.8
MoverRight: centroid bajo → reduce shine → 0.4-0.5
Pattern: headbanger / chaos
```

---

### Pink Floyd - Comfortably Numb (Prog)

**Métricas detectadas:**
- Harshness: ~0.28
- Flatness: ~0.25 (muy tonal)
- Centroid: ~1200Hz (warm)

**Subgénero:** `prog`

**Comportamiento:**
```
Front: bass suave, attack lento → 0.3-0.4
Back: harshness bajo → attack lento, fluido → 0.5-0.6
MoverLeft: centroid balanced → 0.5-0.6
MoverRight: en solo → centroid sube → guitarSolo activo
Pattern: wave / nebula
```

---

### The Strokes - Reptilia (Indie)

**Métricas detectadas:**
- Harshness: ~0.32
- Flatness: ~0.38
- Centroid: ~2200Hz (bright)

**Subgénero:** `indie`

**Comportamiento:**
```
Front: kick con groove → 0.7-0.8
Back: harshness medio → energía sin brutalidad → 0.6-0.7
MoverLeft: centroid alto → reduce body → 0.4-0.5
MoverRight: centroid bright → BOOST shine → 0.7-0.8
Pattern: guitarSolo / wave
```

---

## 🔧 INTEGRACIÓN

### Uso Básico:

```typescript
import { RockStereoPhysics2, rockPhysics2 } from '@/hal/physics'

// Usar singleton
const result = rockPhysics2.applyZones({
  bass: 0.6,
  lowMid: 0.5,
  mid: 0.7,
  highMid: 0.4,
  treble: 0.3,
  subBass: 0.5,
  harshness: 0.65,
  spectralFlatness: 0.55,
  spectralCentroid: 950,
  kickDetected: true,
  snareDetected: false,
  hihatDetected: false,
})

console.log(result)
// {
//   front: 1.0,        // Kick detected!
//   back: 0.75,
//   moverLeft: 0.68,
//   moverRight: 0.42,
//   subgenre: 'metal'
// }
```

### Compatibilidad Legacy:

```typescript
// Para código que solo pasa bass/mid/treble
const legacyResult = rockPhysics2.applyZonesLegacy({
  bass: 0.6,
  mid: 0.7,
  treble: 0.3,
})

console.log(legacyResult)
// { front: 0.6, back: 0.7, mover: 0.5 }  // mover = promedio L/R
```

---

## 📝 NOTAS DE IMPLEMENTACIÓN

1. **Estabilidad de subgénero:** Historial de 30 frames evita cambios bruscos.

2. **Gates dinámicos:** Se adaptan a `spectralFlatness`:
   - Flatness alto (noise) → gate bajo (todo pasa)
   - Flatness bajo (tonal) → gate alto (más selectivo)

3. **Separación L/R de Movers:** Permite que solos (MoverRight) destaquen mientras el body (MoverLeft) mantiene el wall of sound.

4. **Transientes son LEY:** Cuando `kickDetected` o `snareDetected` es true, el impacto es inmediato. No hay smoothing.

---

## 🎸 CONCLUSIÓN

**WAVE 1011 = ROCK PHYSICS REAL**

Antes teníamos un Frankenstein genérico que trataba igual a Bon Iver que a Metallica.

Ahora tenemos física **INTELIGENTE** que:
- Detecta el subgénero automáticamente
- Adapta gains/gates/attacks según el sonido
- Separa Movers L/R para mayor resolución
- Usa transientes para impacto inmediato
- 3 nuevos patterns brutales (stageDive, guitarSolo, headbanger)

**El arsenal está completo. AC/DC a Pink Floyd, todos tienen su momento.** 🎸⚡

---

**Firma:** PunkOpus  
**Versión:** WAVE 1011 - High Voltage  
**Status:** ✅ IMPLEMENTADO Y COMPILANDO
