# 🔬 WAVE 65 - COLOR TELEMETRY & STABILIZATION

## Problema Detectado

Durante pruebas con audio real, el sistema era **demasiado sensible a silencios momentáneos**:

1. **Breakdown falso**: Cada pausa breve (< 1s) activaba modo Breakdown → forzaba Analogous
2. **Reset de mood**: El silencio entre pistas reseteaba todo en solo 3 segundos
3. **Key inestable**: La key musical cambiaba con demasiada frecuencia causando saltos de color

---

## Soluciones Implementadas

### 1. 🕐 SILENCE RESET EXTENDIDO (3s → 15s)

**Archivo**: `EnergyStabilizer.ts`

```typescript
// ANTES:
silenceResetFrames: 180,  // 3 segundos (muy corto)

// DESPUÉS:
silenceResetFrames: 900,  // 15 segundos
```

**Razón**: Entre canciones típicamente hay 5-10s de silencio. Ahora solo se resetea el estado si hay un silencio genuino prolongado.

---

### 2. 🎯 BREAKDOWN HYSTERESIS (2.5s sustain requerido)

**Archivo**: `EnergyStabilizer.ts`

```typescript
// NUEVO:
private breakdownFrameCount = 0;
private readonly breakdownHysteresisFrames = 150;  // 2.5 segundos

// isRelativeBreakdown ahora requiere energía baja SOSTENIDA:
if (this.currentEnergy < this.baselineEnergy * BREAKDOWN_RATIO) {
  this.breakdownFrameCount++;
} else {
  this.breakdownFrameCount = 0;
}

// Solo es breakdown si se mantiene 2.5+ segundos:
this.isRelativeBreakdown = this.breakdownFrameCount >= this.breakdownHysteresisFrames;
```

**Razón**: Pausas de respiración, breaks de 1 beat, o silencios de transición ya no disparan breakdown. Solo cambios estructurales reales.

---

### 3. ⚓ KEY STABILIZER MÁS "STICKY"

**Archivo**: `KeyStabilizer.ts`

```typescript
// ANTES:
lockingFrames: 180,        // 3 segundos (muy corto)
dominanceThreshold: 0.35,  // 35% de confianza

// DESPUÉS:
lockingFrames: 300,        // 5 segundos
dominanceThreshold: 0.45,  // 45% de confianza
```

**Razón**: La key musical define el hue base. Cambiarla muy rápido causa saltos de color molestos. Ahora se requiere más evidencia y tiempo antes de cambiar.

---

### 4. 📊 SMART CHROMATIC AUDIT LOG

**Archivo**: `SeleneColorEngine.ts` + `mind.ts`

```typescript
// Nuevo método estático con rate limiting inteligente:
static logChromaticAudit(
  data: { key: string | null; mood: string | null; energy: number },
  palette: SelenePalette,
  vibeId: string,
  overrideReason: string | null
): void {
  // Solo loguea cuando:
  // - Cambia la key
  // - Cambia la estrategia  
  // - Cambia el vibe
  // - O pasaron 3 segundos desde último log
}
```

**Ejemplo de output**:
```
[COLOR_AUDIT] 🎨 {"vibe":"techno-club","key":"C","strategy":"triadic","reason":"vibe_optimal","temp":4500,"mood":"BRIGHT","hue":0,"sat":85,"energy":78}
[COLOR_AUDIT] 🎨 {"vibe":"techno-club","key":"C","strategy":"analogous","reason":"breakdown","temp":4200,"mood":"NEUTRAL","hue":0,"sat":60,"energy":22}
```

---

## Tiempos de Estabilización (WAVE 65)

| Parámetro | Valor Anterior | Valor WAVE 65 | Descripción |
|-----------|----------------|---------------|-------------|
| `silenceResetFrames` | 180 (3s) | 900 (15s) | Reset de estado por silencio |
| `breakdownHysteresisFrames` | 0 (instantáneo) | 150 (2.5s) | Sustain requerido para breakdown |
| `keyLockingFrames` | 180 (3s) | 300 (5s) | Lock de key después de cambio |
| `keyDominanceThreshold` | 0.35 (35%) | 0.45 (45%) | Confianza para cambio de key |

---

## Datos Disponibles en Frontend

El `debugInfo` enviado al frontend incluye:

```typescript
debugInfo: {
  macroGenre: 'ELECTRONIC_4X4',
  strategy: 'triadic',          // ✅ Estrategia de color
  temperature: 'warm',          // ✅ Temperatura visual
  description: 'C minor (Techno) E=75% S=40%',
  key: 'C',
  mode: 'minor',
  activeVibe: 'techno-club',
  mood: {
    stableEmotion: 'BRIGHT',
    thermalTemperature: 4500,   // ✅ Temperatura en Kelvin
    colorStrategy: {
      stable: 'triadic',
      instant: 'complementary',
      avgSyncopation: 0.42,
      contrastLevel: 'medium',
      sectionOverride: 'none'
    }
  }
}
```

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `EnergyStabilizer.ts` | +hysteresis breakdown, +silence 15s |
| `KeyStabilizer.ts` | +locking 5s, +dominance 45% |
| `SeleneColorEngine.ts` | +logChromaticAudit() método |
| `mind.ts` | +llamada a logChromaticAudit() |

---

## Testing

Para validar los cambios:

1. **Reproducir audio con pausas breves** - No debería triggear breakdown
2. **Cambiar de canción** - Key debería mantener 5s antes de cambiar
3. **Silencio entre canciones** - Solo resetea después de 15s
4. **Verificar consola** - `[COLOR_AUDIT]` solo aparece en cambios reales

---

## Status

✅ **WAVE 65 COMPLETADA**

- [x] Silence reset: 3s → 15s  
- [x] Breakdown hysteresis: 2.5s sustain
- [x] Key stabilizer más sticky: 5s lock, 45% threshold
- [x] Smart chromatic audit log con JSON
- [x] Verificado datos en debugInfo para frontend
