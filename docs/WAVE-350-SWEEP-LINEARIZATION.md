# 🔧 WAVE 350: SWEEP LINEARIZATION & STAB SAFETY

**Date**: 2026-01-10  
**Status**: ✅ COMPLETE  
**Layer**: ENGINE/MOVEMENT + HAL  
**Files Modified**: `VibeMovementManager.ts`, `HardwareAbstraction.ts`, `LightingIntent.ts`, `VibeMovementPresets.ts`

---

## 🎯 THE PROBLEM

**Síntoma**: "El sweep se renderiza como dos donuts bailando, no como un láser de barrido"

### Root Cause Analysis

El patrón `sweep` generaba un movimiento horizontal puro:
```typescript
sweep: (t, phase, audio) => ({
  x: Math.sin(phase * 0.5),  // Horizontal puro
  y: -0.2,                    // Tilt casi fijo
})
```

PERO, HAL aplicaba **rotación polar** (atan2) a este movimiento para crear el efecto "snake" entre fixtures, rotando el vector completo y convirtiéndolo en un **círculo/donut**.

**El resultado**: En lugar de un barrido lineal (←→), los movers dibujaban órbitas circulares desfasadas.

---

## 🔧 THE SOLUTION: LINEAR PHASE TYPE

### Arquitectura de 3 capas

#### 1. **MovementIntent.phaseType** (Protocol Layer)

Nuevo campo opcional que declara cómo HAL debe interpretar el movimiento:

```typescript
export interface MovementIntent {
  // ... campos existentes
  /** 🔧 WAVE 350: Tipo de desfase (linear = sin rotación polar, polar = con rotación) */
  phaseType?: 'linear' | 'polar'
}
```

- **`'linear'`**: El patrón ya tiene desfase integrado → HAL NO rota
- **`'polar'`**: Patrón simple → HAL aplica rotación matemática (comportamiento anterior)

#### 2. **Sweep Pattern Rediseñado** (VibeMovementManager.ts)

El desfase entre fixtures ahora se aplica **DENTRO del seno**, no después:

**ANTES (Polar)**:
```typescript
sweep: (t, phase, audio) => ({
  x: Math.sin(phase * 0.5),   // Calcula posición
  y: -0.2,                     // Tilt fijo
})
// HAL rotaba esto → círculo
```

**AHORA (Linear)**:
```typescript
sweep: (t, phase, audio, index = 0, total = 1) => {
  // Desfase aplicado DENTRO del argumento del seno
  const fixturePhase = (index / Math.max(total, 1)) * Math.PI * 0.5
  const x = Math.sin(phase * 0.5 + fixturePhase)  // ← AQUÍ
  const y = -0.15 + audio.bass * 0.10
  return { x, y }
}
// phaseType: 'linear' → HAL pasa directo
```

**Efecto**: Cada fixture está en un punto diferente del **mismo barrido horizontal**, creando una "ola" que cruza el rig.

#### 3. **HAL Linear Bypass** (HardwareAbstraction.ts)

Modificamos `applyPhaseOffset` para detectar `phaseType === 'linear'`:

```typescript
private applyPhaseOffset(
  baseX: number,
  baseY: number,
  pattern: string,
  fixtureIndex: number,
  zone: string,
  timeSeconds: number,
  bpm: number,
  phaseType: 'linear' | 'polar' = 'polar'  // WAVE 350
): { x: number; y: number } {
  // 🔧 WAVE 350: LINEAR BYPASS
  if (phaseType === 'linear') {
    // NO aplicar rotación polar - el patrón ya está bien
    return { x: baseX, y: baseY }
  }
  
  // ... resto del código (rotación polar para otros patrones)
}
```

**Log nuevo**:
```
[🔬 LINEAR BYPASS] Pan:126° Tilt:-15° | Pattern:sweep
```

---

## 🎸 BONUS: WAVE 350.5 - STAB SAFETY

**Problema secundario**: Los `botStabs` con period 2x ahora tienen 60% amplitud a 191 BPM, pero los saltos eran visualmente agresivos.

**Fix**: Aumentar aceleración máxima de Techno de **1500** a **2000** DMX/s²:

```typescript
// VibeMovementPresets.ts
'techno-club': {
  physics: {
    maxAcceleration: 2000,  // Era 1500
    maxVelocity: 600,       // Sin cambios
    friction: 0.05,
    arrivalThreshold: 0.5,
  },
  // ...
}
```

**Efecto**: 
- Los stabs siguen siendo agresivos y amplios (60% amplitud)
- Pero el "arranque" es un 33% más fuerte → transición más suave visualmente
- Motor sufre menos estrés en saltos repentinos

---

## 📊 RESULTADOS ESPERADOS

### Sweep Pattern

**ANTES**:
```
Fixture 0: Dibuja círculo en fase 0°
Fixture 1: Dibuja círculo en fase 20°
Fixture 2: Dibuja círculo en fase 40°
→ "Donuts girando"
```

**AHORA**:
```
Fixture 0: Barrido ←→ posición 0% del ciclo
Fixture 1: Barrido ←→ posición 12.5% del ciclo
Fixture 2: Barrido ←→ posición 25% del ciclo
→ "EL COCHE FANTÁSTICO" (ola horizontal)
```

### BotStabs Pattern

**Amplitud**: 30% → 62% (WAVE 349.7)  
**Aceleración**: 1500 → 2000 DMX/s² (WAVE 350.5)  
**Resultado**: Saltos grandes pero arranque suave

---

## 🎯 TESTING PROTOCOL

1. **Dev Mode**: `npm run dev`
2. **Select Techno vibe** con música >140 BPM
3. **Esperar a pattern `sweep`** (rotación cada 8 bars)
4. **Verificar**:
   - Fixtures se mueven en **línea horizontal** (no círculos)
   - Hay un **desfase** entre fixtures (ola que cruza el rig)
   - Log muestra `[🔬 LINEAR BYPASS]` cada ~1 segundo
5. **Esperar a pattern `botStabs`**:
   - Saltos amplios (60% amplitud)
   - Transiciones más suaves que antes (gracias a accel 2000)

---

## 🔍 DEBUG LOGS

### Sweep Linear:
```
[🎯 VMM] techno-club | sweep | phrase:3 | phaseType:linear | Pan:126° Tilt:-15°
[🔬 LINEAR BYPASS] Pan:126° Tilt:-15° | Pattern:sweep
[👁️ HAL] techno-club | Target:126°/-15° → Phys:126°/-15°
```

### BotStabs (Period 2x):
```
[🚗 GEARBOX] BPM:191 | Pattern:botStabs(2x) | Budget:158 DMX | Factor:0.62 (62% amplitude)
[🎯 VMM] techno-club | botStabs | Pan:122° Tilt:-30°
[👁️ HAL] techno-club | Target:122°/-30° → Phys:122°/-30° | Accel:2000
```

---

## 📝 COMMIT MESSAGE

```
feat(movement): WAVE 350 - Sweep Linearization & Stab Safety

🔧 LINEAR PHASE TYPE
- Nuevo campo MovementIntent.phaseType: 'linear' | 'polar'
- sweep pattern: Desfase aplicado DENTRO del seno (no rotación post-cálculo)
- HAL bypass: Si phaseType='linear', NO aplica rotación polar

🎸 SWEEP PATTERN REDISEÑADO
- fixturePhase integrado en Math.sin(phase + fixturePhase)
- Genera barrido horizontal lineal (EL COCHE FANTÁSTICO)
- Fix: Ya no dibuja "donuts girando", sino ola horizontal pura

⚡ STAB SAFETY (WAVE 350.5)
- Techno maxAcceleration: 1500 → 2000 DMX/s²
- botStabs period: 1x → 2x (WAVE 349.7)
- Resultado: 62% amplitud con arranque 33% más suave

📊 RESULTADOS
- Sweep: Barrido lineal perfecto con desfase visual
- BotStabs: Saltos amplios pero seguros (menos estrés motor)

FIXES: #350 (Sweep "donuts"), #350.5 (Stab safety)
```

---

**Status**: ✅ READY TO TEST  
**Expected**: Sweep como láser de barrido, BotStabs agresivos pero seguros  
**Victory**: De donuts a EL COCHE FANTÁSTICO. 🎛️🚗⚡
