# 🎭 WAVE 340: VIBE MOVEMENT PATTERNS BLUEPRINT

> **"Los movers son bailarines. Cada vibe es un género musical diferente. Cada patrón es un paso de baile."**

---

## 🔥 ADICIONES CRÍTICAS DE RADWULF (v1.1)

> *"Si implementamos el blueprint tal cual, los movers se moverán... pero parecerán soldados sincronizados. Para que parezca un show de $1M, necesitamos DESFASE y DINÁMICA ÓPTICA."*

### 1. 🐍 EL SECRETO DEL "SNAKE" (Phase Offset)
Si usas `Math.sin(time)` para todos los focos, todos subirán y bajarán a la vez. **Eso es aburrido.**

**La Fórmula del Amor:**
```typescript
Position = Math.sin(Time + (FixtureIndex * PhaseOffset))
```

| Vibe | Phase Offset | Efecto |
|------|--------------|--------|
| **Latino** | `π/4` (45°) | Caderas en cadena, ola de salsa |
| **Chill** | `π/2` (90°) | Ola de mar que recorre el escenario |
| **Techno** | `0` o `π` | Sincronizado o alternado par/impar |
| **Rock** | `π/3` (60°) | Wall of light ondulante |

### 2. 💃 LA CADERA MATEMÁTICA (Curva de Lissajous)
Para `figure8`, no basta con mover Pan y Tilt a la vez. Necesitas una **Curva de Lissajous**.

**La Fórmula:**
```typescript
Pan  = sin(Time)        // Frecuencia 1x
Tilt = sin(Time * 2)    // Frecuencia 2x (¡el doble!)
```

**Resultado:** Un "8" perfecto en el aire. Es el movimiento más sexy que puede hacer un robot.

### 3. 👁️ ÓPTICA QUE RESPIRA (Dynamic Zoom/Focus)
Las ópticas NO deberían ser estáticas por Vibe. Deben **reaccionar al movimiento**.

| Vibe | Comportamiento Óptico |
|------|----------------------|
| **Chill** | Tilt Up → Zoom abre (inhalar). Tilt Down → Zoom cierra (exhalar) |
| **Rock** | Snare hit → Focus nítido 50ms (punch), luego vuelve a soft |
| **Techno** | Beat → Zoom pulsa cerrado (beam láser), entre beats abre |
| **Latino** | Zoom sigue la amplitud del movimiento (más amplio = más abierto) |

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

```typescript
// 🐍 SNAKE FORMULA: Phase offset por fixture
const phaseOffset = fixtureIndex * (Math.PI / 4)  // 45° entre fixtures
const freq = context.bpm / 120  // Un ciclo cada ~2 compases

centerX = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq + phaseOffset) * amplitude
centerY = 0.5 + Math.sin(timeSeconds * Math.PI * freq + phaseOffset) * amplitude * 0.3

// 👁️ ÓPTICA DINÁMICA: Zoom respira con el movimiento
zoom = zoomDefault + Math.sin(timeSeconds * Math.PI * freq + phaseOffset) * 20
```

**Sensación**: Como las luces de un concierto de Pink Floyd - una serpiente de luz

---

### 2. ∞ FIGURE8 (Figura 8 - Lissajous)
**Para**: Latino (EXCLUSIVO)
**Descripción**: El movimiento de caderas de la cumbia - Curva de Lissajous real

```typescript
// 💃 LISSAJOUS: Pan 1x freq, Tilt 2x freq = figura 8 perfecta
const freq = context.bpm / 60  // Un ciclo por beat
const phaseOffset = fixtureIndex * (Math.PI / 4)

centerX = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq + phaseOffset) * amplitude
centerY = 0.5 + Math.sin(timeSeconds * Math.PI * 4 * freq + phaseOffset) * amplitude * 0.5
//                                    ↑ DOBLE frecuencia = figura 8

// 👁️ ÓPTICA: Zoom sigue amplitud (más movimiento = más abierto)
const movementIntensity = Math.abs(Math.sin(timeSeconds * Math.PI * 2 * freq))
zoom = zoomDefault + movementIntensity * 30
```

**Sensación**: Las caderas de una bailarina de salsa dibujando un 8 en el aire

---

### 3. 🏃 CHASE (Persecución)
**Para**: Techno, Rock
**Descripción**: Un fixture persigue al otro - ola mexicana robótica

```typescript
// 🐍 CHASE: Phase offset grande para efecto persecución
const phaseOffset = fixtureIndex * (Math.PI / 2)  // 90° entre fixtures
const freq = context.bpm / 30  // Rápido

centerX = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq + phaseOffset) * amplitude
centerY = 0.5 + audio.bass * 0.2 - 0.1  // Tilt sigue el bass

// Techno: Movimiento seco, sin transición
// Rock: Más dramático, con pausas en los extremos
```

**Sensación**: Búsqueda láser en un bunker o persecución épica

---

### 4. 🪞 MIRROR (Espejo)
**Para**: Techno
**Descripción**: Fixtures opuestos hacen movimiento simétrico

```typescript
// 🪞 MIRROR: Izquierda y derecha son opuestos
const freq = context.bpm / 60
const baseOffset = Math.sin(timeSeconds * Math.PI * 2 * freq) * amplitude

// Fixture izquierdo (índice par): positivo
// Fixture derecho (índice impar): negativo
const mirrorSign = fixtureIndex % 2 === 0 ? 1 : -1
centerX = 0.5 + baseOffset * mirrorSign
centerY = 0.5

// 👁️ ÓPTICA: Beam cerrado sincronizado
zoom = 30  // Láser puro
```

**Sensación**: Las puertas del infierno techno abriéndose y cerrándose

---

### 5. 💫 CIRCLE (Círculo) - CON SNAKE
**Para**: Latino, Chill
**Descripción**: Rotación circular suave con desfase

```typescript
// 🐍 CIRCLE con phase offset = espiral de luz
const freq = context.bpm / 240  // Muy lento para Chill
const phaseOffset = fixtureIndex * (Math.PI / 2)  // 90° offset

centerX = 0.5 + Math.cos(timeSeconds * Math.PI * 2 * freq + phaseOffset) * amplitude
centerY = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq + phaseOffset) * amplitude * aspectRatio

// Latino: aspectRatio = 0.7 (elipse horizontal, más "bailarín")
// Chill: aspectRatio = 1.0 (círculo perfecto, más "zen")

// 👁️ ÓPTICA CHILL: Inhalar/Exhalar
zoom = zoomDefault + Math.sin(timeSeconds * Math.PI * freq) * 15  // Respira
```

---

### 6. 📍 STATIC - MEJORADO (Respiración Zen)
**Para**: Chill, Idle
**Descripción**: No es "quieto" - es "respirando"

```typescript
// 🧘 BREATHING: Micro-movimiento casi imperceptible
const breathFreq = 0.1  // Un ciclo cada 10 segundos
const phaseOffset = fixtureIndex * (Math.PI / 3)

centerX = 0.5  // Centro
centerY = 0.4 + Math.sin(timeSeconds * Math.PI * 2 * breathFreq + phaseOffset) * 0.05
            + audio.bass * 0.08  // El bass crea un pequeño "inhalar"

// 👁️ ÓPTICA: Zoom respira con el movimiento
zoom = zoomDefault + Math.sin(timeSeconds * Math.PI * 2 * breathFreq) * 10
focus = focusDefault + 20  // Siempre soft (nebuloso)
```

**Sensación**: Meditación, no muerte. Una vela que apenas se mueve con la brisa.

---

### 7. 💥 PULSE (Beat Sync)
**Para**: Techno, Rock
**Descripción**: Reacción explosiva al beat

```typescript
// 💥 PULSE: Reacción al beat phase
const beatPhase = context.beatPhase  // 0-1, 0 = inicio del beat
const pulseIntensity = Math.pow(1 - beatPhase, 3)  // Decae rápido después del beat

centerX = 0.5
centerY = 0.5 - pulseIntensity * amplitude * 0.3  // Baja en el beat

// 👁️ ÓPTICA ROCK: Focus punch en el beat
if (beatPhase < 0.1) {
  focus = 0  // NÍTIDO (punch)
} else {
  focus = focusDefault  // Vuelve a soft
}
```

**Sensación**: El headbang del rock, el kick del techno

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

### Problema: calculateMovement() no conoce el fixtureIndex

Actualmente `TitanEngine.calculateMovement()` genera UNA posición para TODOS los fixtures.
Para el Snake/Phase Offset, necesitamos que **HAL aplique el desfase por fixture**.

### Solución: Engine genera BASE + HAL aplica OFFSET

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  TitanEngine    │     │      HAL        │     │  PhysicsDriver  │
│                 │     │                 │     │                 │
│ centerX = 0.5   │────▶│ + phaseOffset   │────▶│ + interpolación │
│ centerY = 0.5   │     │ por fixture     │     │ con inercia     │
│ pattern = wave  │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Archivo: `HardwareAbstraction.ts` - Aplicar Phase Offset

```typescript
// En el loop de fixtures, después de obtener centerX/centerY del intent:

const applyPhaseOffset = (
  centerX: number,
  centerY: number,
  pattern: string,
  fixtureIndex: number,
  vibeId: string,
  timeSeconds: number,
  bpm: number
): { x: number, y: number } => {
  
  // Configuración de offset por vibe
  const PHASE_CONFIGS = {
    'techno-club':    { offset: 0,           type: 'sync' },      // Sincronizado
    'fiesta-latina':  { offset: Math.PI / 4, type: 'snake' },     // 45° cadena
    'pop-rock':       { offset: Math.PI / 3, type: 'snake' },     // 60° ondulante
    'chill-lounge':   { offset: Math.PI / 2, type: 'snake' },     // 90° ola lenta
  }
  
  const config = PHASE_CONFIGS[vibeId] || { offset: 0, type: 'sync' }
  
  if (config.type === 'sync') {
    return { x: centerX, y: centerY }
  }
  
  // Aplicar phase offset basado en el patrón
  const phaseOffset = fixtureIndex * config.offset
  const freq = bpm / 120
  
  switch (pattern) {
    case 'wave':
      return {
        x: 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq + phaseOffset) * (centerX - 0.5) * 2,
        y: 0.5 + Math.sin(timeSeconds * Math.PI * freq + phaseOffset) * (centerY - 0.5) * 2
      }
      
    case 'figure8':
      // Lissajous: Tilt a 2x frecuencia
      return {
        x: 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq + phaseOffset) * (centerX - 0.5) * 2,
        y: 0.5 + Math.sin(timeSeconds * Math.PI * 4 * freq + phaseOffset) * (centerY - 0.5) * 2
      }
      
    case 'circle':
      return {
        x: 0.5 + Math.cos(timeSeconds * Math.PI * 2 * freq + phaseOffset) * (centerX - 0.5) * 2,
        y: 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq + phaseOffset) * (centerY - 0.5) * 2
      }
      
    case 'chase':
      // Chase tiene offset más grande
      const chasePhase = fixtureIndex * (Math.PI / 2)
      return {
        x: 0.5 + Math.sin(timeSeconds * Math.PI * 2 * freq * 2 + chasePhase) * (centerX - 0.5) * 2,
        y: centerY
      }
      
    case 'mirror':
      // Par/Impar invertidos
      const mirrorSign = fixtureIndex % 2 === 0 ? 1 : -1
      return {
        x: 0.5 + (centerX - 0.5) * mirrorSign,
        y: centerY
      }
      
    default:
      return { x: centerX, y: centerY }
  }
}
```

### Archivo: `HardwareAbstraction.ts` - Óptica Dinámica

```typescript
const applyDynamicOptics = (
  fixture: FixtureState,
  vibeId: string,
  beatPhase: number,
  movementIntensity: number
): { zoom: number, focus: number } => {
  
  const baseZoom = fixture.zoom
  const baseFocus = fixture.focus
  
  switch (vibeId) {
    case 'chill-lounge':
      // Respiración: Zoom sigue el movimiento
      return {
        zoom: baseZoom + movementIntensity * 30,
        focus: baseFocus + 20  // Siempre soft
      }
      
    case 'pop-rock':
      // Punch en el beat
      if (beatPhase < 0.1) {
        return { zoom: baseZoom, focus: 0 }  // Nítido en el beat
      }
      return { zoom: baseZoom, focus: baseFocus }
      
    case 'techno-club':
      // Beam pulsante
      const beamPulse = beatPhase < 0.2 ? -20 : 0
      return { zoom: baseZoom + beamPulse, focus: 20 }  // Siempre nítido
      
    case 'fiesta-latina':
      // Zoom sigue amplitud
      return {
        zoom: baseZoom + movementIntensity * 25,
        focus: baseFocus
      }
      
    default:
      return { zoom: baseZoom, focus: baseFocus }
  }
}
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### PASO 1: TitanEngine - Patrones Base ✅ COMPLETADO
- [x] `sweep` - Barrido horizontal (ya funciona)
- [x] `circle` - Rotación básica (ya existe)
- [x] `pulse` - Beat sync (ya existe)
- [x] `wave` - Ondulación Pink Floyd ✅ WAVE 340.1
- [x] `figure8` - Lissajous caderas (Tilt 2x freq) ✅ WAVE 340.1
- [x] `chase` - Base para persecución ✅ WAVE 340.1
- [x] `mirror` - Base para espejo ✅ WAVE 340.1
- [x] `static` - Mejorado con micro-respiración ✅ WAVE 340.1
- [x] Tipos actualizados en LightingIntent.ts y types.ts ✅

### PASO 2: HAL - Phase Offset (🐍 SNAKE)
- [ ] Crear función `applyPhaseOffset()`
- [ ] Configurar offset por vibe:
  - Techno: 0 (sync) o π (alternado)
  - Latino: π/4 (45° cadena)
  - Rock: π/3 (60° ondulante)
  - Chill: π/2 (90° ola lenta)
- [ ] Aplicar offset en el loop de fixtures antes de physics

### PASO 3: HAL - Óptica Dinámica (👁️ BREATHING)
- [ ] Crear función `applyDynamicOptics()`
- [ ] Chill: Zoom respira con movimiento
- [ ] Rock: Focus punch en beat (nítido 50ms)
- [ ] Techno: Beam pulsa con kick
- [ ] Latino: Zoom sigue amplitud

### PASO 4: Actualizar Perfiles de Vibe
- [ ] Verificar `allowedPatterns` en cada perfil
- [ ] Añadir parámetros de `phaseOffset` por vibe
- [ ] Añadir parámetros de `opticsMode` por vibe

### PASO 5: Testing Visual
- [ ] Techno: Sables láser scanning ✓ (ya funciona)
- [ ] Latino: Caderas bailando figura 8 (Lissajous)
- [ ] Rock: Wall of light ondulante con punch en snare
- [ ] Chill: Nebulosa respirando, ola de mar

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

### Arquitectura Final: Engine → HAL → Physics

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE DATOS                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TitanEngine.calculateMovement()                                    │
│  ├─ Genera: pattern, centerX, centerY, amplitude, speed            │
│  └─ NO conoce fixtureIndex (genera posición BASE)                  │
│                         │                                           │
│                         ▼                                           │
│  HAL.render()                                                       │
│  ├─ Recibe: intent.movement + fixtures[]                           │
│  ├─ Aplica: applyPhaseOffset() por cada fixture                    │
│  ├─ Aplica: applyDynamicOptics() (zoom/focus reactivos)           │
│  └─ Envía: posición FINAL + óptica a PhysicsDriver                 │
│                         │                                           │
│                         ▼                                           │
│  FixturePhysicsDriver.translate()                                   │
│  ├─ Interpola: target → physical (con inercia/slew rate)          │
│  └─ Respeta: VibeMovementPresets (friction por vibe)               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Por qué HAL aplica el Phase Offset (no Engine)

1. **Engine es abstracto** - No conoce fixtures físicos
2. **HAL conoce la topología** - Sabe cuántos fixtures hay y su orden
3. **Physics es por fixture** - Cada fixture tiene su estado independiente
4. **Separación de responsabilidades** - Engine = QUÉ, HAL = CÓMO

### Sobre el Mirror para Techno

Para que `mirror` funcione bien, HAL necesita saber si un fixture es "izquierdo" o "derecho". Opciones:

1. **Por zona**: MOVING_LEFT vs MOVING_RIGHT
2. **Por índice par/impar**: fixture[0,2,4] = izquierda, fixture[1,3,5] = derecha
3. **Por posición física**: Usar coordenadas X del setup

**Recomendación**: Opción 1 (por zona) es la más semántica y ya existe en el sistema.

---

*Blueprint v1.1 - Actualizado con las adiciones de Radwulf*
*Fecha: 2026-01-09*
*Autores: PunkOpus + Radwulf*

> *"Los soldados marchan. Los bailarines danzan. La diferencia es el DESFASE."*
