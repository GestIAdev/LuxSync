# 🎭 WAVE 340: VIBE MOVEMENT PATTERNS BLUEPRINT

> **"Los movers son bailarines. Cada vibe es un género musical diferente. Cada patrón es un paso de baile."**

---

## 📋 ESTADO ACTUAL

### ✅ Lo que funciona
- **Techno**: Sweep horizontal rápido, sables láser Jedi ✨
- **Physics Engine**: Interpolación suave con inercia
- **Registro de fixtures**: IDs reales conectados

### ❌ Lo que falta
- **Latino**: `figure8`, `wave` no implementados → se queda quieto
- **Rock**: `wave`, `chase` no implementados → balanceo mínimo  
- **Chill**: `wave` no implementado, `static` = sin movimiento

### 🔍 Diagnóstico
El código en `TitanEngine.calculateMovement()` solo implementa:
```typescript
case 'sweep':   // ✅ Techno lo usa
case 'circle':  // ⚠️ Latino lo tiene pero energy selecciona otro
case 'pulse':   // ✅ Implementado
case 'random':  // ✅ Implementado
default:        // Static
```

Pero los perfiles de vibe piden:
- `figure8`, `wave`, `chase`, `mirror` → **NO EXISTEN**

---

## 🎨 FILOSOFÍA DE DISEÑO

### El Principio del Bailarín
Cada vibe es un **estilo de baile diferente**:

| Vibe | Estilo | Personalidad del Mover |
|------|--------|------------------------|
| **Techno** | Industrial / Berlín | Robot preciso, movimientos secos, láser scanning |
| **Latino** | Salsa / Cumbia | Fluido, caderas, figura 8, nunca para |
| **Rock** | Stadium / Arena | Dramático, headbang, wall of light |
| **Chill** | Ambient / Lounge | Glacial, nebuloso, casi estático pero vivo |

### El Principio del Contraste
- **No todos los patrones para todos los vibes**
- Cada vibe tiene 3-4 patrones que le son PROPIOS
- La **energía** selecciona qué patrón usar dentro del vibe

### El Principio del Tiempo
- **BPM** controla la frecuencia base
- **Energía** controla la amplitud
- **Beat Phase** sincroniza con el ritmo

---

## 📐 PATRONES A IMPLEMENTAR

### 1. 🌊 WAVE (Ola)
**Para**: Rock, Chill, Latino
**Descripción**: Ondulación suave, como respiración del mar

```
Posición X: Base + sin(time * freq) * amplitude
Posición Y: Base + sin(time * freq * 0.5) * amplitude * 0.3

Características:
- Frecuencia: BPM / 120 (un ciclo cada ~2 compases)
- Amplitud X: 0.2 - 0.4 (sutil)
- Amplitud Y: 0.1 - 0.2 (muy sutil)
- Fase: Offset por fixture para efecto cascada
```

**Sensación**: Como las luces de un concierto de Pink Floyd

---

### 2. ∞ FIGURE8 (Figura 8)
**Para**: Latino (EXCLUSIVO)
**Descripción**: El movimiento de caderas de la cumbia

```
Posición X: Base + sin(time * freq) * amplitude
Posición Y: Base + sin(time * freq * 2) * amplitude * 0.5

Características:
- Frecuencia: BPM / 60 (un ciclo por beat)
- Amplitud X: 0.3 - 0.5 (amplio)
- Amplitud Y: 0.2 - 0.3 (mitad del X)
- La relación 2:1 crea la figura 8
```

**Sensación**: Las caderas de una bailarina de salsa

---

### 3. 🏃 CHASE (Persecución)
**Para**: Techno, Rock
**Descripción**: Un fixture persigue al otro

```
Posición X: Sin(time * freq + fixtureIndex * phaseOffset)
Posición Y: Constante o siguiendo bass

Características:
- Phase offset: 90° entre fixtures (un fixture adelante del otro)
- Crea efecto de "ola mexicana" pero robótico
- En Techno: Muy rápido, preciso
- En Rock: Más dramático, con pausas
```

**Sensación**: Búsqueda láser en un bunker o persecución épica

---

### 4. 🪞 MIRROR (Espejo)
**Para**: Techno
**Descripción**: Fixtures opuestos hacen movimiento simétrico

```
Fixture izquierdo: X = 0.5 + offset
Fixture derecho:   X = 0.5 - offset

Características:
- Los movers izquierdo/derecho son simétricos
- Cuando uno va a la izquierda, el otro va a la derecha
- Crea sensación de puerta abriéndose/cerrándose
```

**Sensación**: Las puertas del infierno techno abriéndose

---

### 5. 💫 CIRCLE (Círculo) - MEJORADO
**Para**: Latino, Chill
**Descripción**: Rotación circular suave

```
Posición X: Base + cos(time * freq) * amplitude
Posición Y: Base + sin(time * freq) * amplitude * aspectRatio

Características:
- Latino: aspectRatio = 0.7 (elipse horizontal, más "bailarín")
- Chill: aspectRatio = 1.0 (círculo perfecto, más "zen")
- Frecuencia mucho más lenta que sweep
```

---

### 6. 📍 STATIC - MEJORADO
**Para**: Chill, Idle
**Descripción**: No es "quieto" - es "respirando"

```
Posición X: 0.5 (centro)
Posición Y: 0.4 + sin(time * 0.1) * 0.05 + bass * 0.1

Características:
- Micro-movimiento casi imperceptible
- Como una vela que apenas se mueve con la brisa
- El bass crea un pequeño "inhalar"
```

**Sensación**: Meditación, no muerte

---

## 🎛️ TABLA DE PATRONES POR VIBE

| Patrón | Techno | Latino | Rock | Chill |
|--------|--------|--------|------|-------|
| sweep | ✅ Principal | ⚠️ Bajo | ✅ Alto | ❌ |
| figure8 | ❌ | ✅ Principal | ❌ | ❌ |
| circle | ❌ | ✅ Medio | ❌ | ✅ Principal |
| wave | ❌ | ✅ Bajo | ✅ Principal | ✅ Medio |
| chase | ✅ Alto | ❌ | ✅ Medio | ❌ |
| mirror | ✅ Medio | ❌ | ✅ Bajo | ❌ |
| pulse | ✅ Bajo | ❌ | ❌ | ❌ |
| static | ❌ | ❌ | ❌ | ✅ Bajo |

---

## 📊 PARÁMETROS POR VIBE

### 🎛️ TECHNO-CLUB
```typescript
{
  allowedPatterns: ['sweep', 'chase', 'mirror', 'pulse'],
  speedRange: { min: 0.6, max: 1.0 },  // Siempre rápido
  amplitudeRange: { min: 0.4, max: 0.8 },
  beatMultiplier: 1,  // Sincronizado con kick
  characteristics: {
    precision: 'high',      // Movimientos secos
    overshoot: false,       // Sin inercia visible
    symmetry: 'required',   // Mirror es importante
  }
}
```

### 💃 FIESTA-LATINA
```typescript
{
  allowedPatterns: ['figure8', 'circle', 'wave', 'sweep'],
  speedRange: { min: 0.3, max: 0.6 },  // Fluido, no apresurado
  amplitudeRange: { min: 0.3, max: 0.6 },
  beatMultiplier: 0.5,  // Sincronizado con clave (más lento que kick)
  characteristics: {
    precision: 'low',       // Movimientos orgánicos
    overshoot: true,        // Inercia elegante
    symmetry: 'optional',   // Puede ser asimétrico
  }
}
```

### 🎸 POP-ROCK
```typescript
{
  allowedPatterns: ['wave', 'chase', 'sweep', 'mirror'],
  speedRange: { min: 0.4, max: 0.8 },  // Variable
  amplitudeRange: { min: 0.5, max: 0.9 },  // Grande, dramático
  beatMultiplier: 2,  // Sincronizado con snare (cada 2 beats)
  characteristics: {
    precision: 'medium',    // Equilibrio
    overshoot: true,        // Dramático
    symmetry: 'preferred',  // Wall of light
  }
}
```

### 🌙 CHILL-LOUNGE
```typescript
{
  allowedPatterns: ['circle', 'wave', 'static'],
  speedRange: { min: 0.05, max: 0.2 },  // Glacial
  amplitudeRange: { min: 0.1, max: 0.25 },  // Sutil
  beatMultiplier: 0.25,  // Un ciclo cada 4 compases
  characteristics: {
    precision: 'low',       // Nebuloso
    overshoot: false,       // Sin sacudidas
    symmetry: 'optional',   // Puede ser orgánico
  }
}
```

---

## 🔧 IMPLEMENTACIÓN

### Archivo: `TitanEngine.ts` → `calculateMovement()`

```typescript
// Añadir estos patrones al switch:

case 'wave':
  // Ondulación como respiración del mar
  const waveFreq = context.bpm / 120  // Un ciclo cada ~2 compases
  centerX = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * waveFreq) * amplitude * 0.4
  centerY = 0.5 + Math.sin(timeSeconds * Math.PI * waveFreq) * amplitude * 0.15
  break

case 'figure8':
  // Caderas de cumbia - figura 8
  const f8Freq = context.bpm / 60  // Un ciclo por beat
  centerX = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * f8Freq) * amplitude
  centerY = 0.5 + Math.sin(timeSeconds * Math.PI * 4 * f8Freq) * amplitude * 0.5  // 2x frecuencia
  break

case 'chase':
  // Persecución - offset por fixture
  const chaseFreq = context.bpm / 30  // Rápido
  const fixturePhase = (this.state.frameCount % 4) * (Math.PI / 2)  // 90° offset
  centerX = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * chaseFreq + fixturePhase) * amplitude
  centerY = 0.5 + audio.bass * 0.2 - 0.1
  break

case 'mirror':
  // Espejo - simétrico respecto al centro
  const mirrorFreq = context.bpm / 60
  const mirrorOffset = Math.sin(timeSeconds * Math.PI * 2 * mirrorFreq) * amplitude
  // TODO: Necesita saber si es fixture izquierdo o derecho
  centerX = 0.5 + mirrorOffset  // El otro fixture usará -mirrorOffset
  centerY = 0.5
  break
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### PASO 1: Implementar Patrones Básicos
- [ ] `wave` - Ondulación suave
- [ ] `figure8` - Figura 8 para Latino
- [ ] `chase` - Persecución con phase offset
- [ ] `mirror` - Movimiento simétrico
- [ ] Mejorar `static` con micro-respiración
- [ ] Mejorar `circle` con aspect ratio por vibe

### PASO 2: Actualizar Perfiles de Vibe
- [ ] Verificar `allowedPatterns` en cada perfil
- [ ] Ajustar `speedRange` según filosofía
- [ ] Añadir parámetros de `beatMultiplier`

### PASO 3: Conectar con Physics
- [ ] Los presets de VibeMovementPresets.ts deben afectar la interpolación
- [ ] Techno = friction baja (movimiento seco)
- [ ] Latino = friction alta (movimiento fluido)

### PASO 4: Testing Visual
- [ ] Techno: Sables láser scanning ✓ (ya funciona)
- [ ] Latino: Caderas bailando figura 8
- [ ] Rock: Wall of light ondulante
- [ ] Chill: Nebulosa respirando

---

## 🎯 RESULTADO ESPERADO

Después de WAVE 340:
- **Cada vibe tiene su ALMA en movimiento**
- **No hay patrones "muertos" o "quietos"** (excepto idle)
- **El contraste entre vibes es DRAMÁTICO**
- **Los movers son BAILARINES, no robots** (excepto en Techno, donde SÍ son robots)

---

**"En LuxSync, hasta los cables tienen swing."** 🎸

---

## 📝 NOTAS ADICIONALES

### Sobre el fixture_index para Chase/Mirror
Actualmente `calculateMovement()` no sabe qué fixture está calculando. Para `chase` y `mirror` necesitaremos:
1. O pasar el fixture index como parámetro
2. O calcular múltiples posiciones en una sola llamada
3. O hacer que HAL modifique las posiciones por fixture después

**Recomendación**: Opción 3 es la más limpia - el Engine genera el "centro" y HAL aplica offsets por zona (MOVING_LEFT vs MOVING_RIGHT).

---

*Blueprint creado: 2026-01-09*
*Autor: PunkOpus + Radwulf*
*Versión: 1.0*
