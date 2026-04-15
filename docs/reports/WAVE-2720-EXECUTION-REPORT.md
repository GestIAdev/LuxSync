# WAVE 2720 — LA LEY UNIVERSAL DEL PÉNDULO

**Fecha**: 2025-06-03  
**Operador**: PunkOpus  
**Compilación**: ✅ ZERO ERRORES  
**Axioma**: Perfection First — Solución arquitectónica correcta

---

## 🎯 DIAGNÓSTICO

El HarmonicQuantizer (WAVE 2672) cuantizaba los cambios de color de fixtures mecánicos a intervalos armónicos del BPM — pero SOLO operaba dentro de TitanOrchestrator. Esto significaba que:

- **Chronos/TimelineEngine** → enviaba colores RAW vía `setPlaybackFrame()` → bypass total del quantizer
- **Manual UI overrides** → vía `setManualOverride()` → bypass total
- **Cualquier fuente futura** → bypass por defecto

El resultado: un efecto como LatinaMeltdown (4 cambios/sec) ejecutado desde Chronos golpeaba el SafetyLayer directamente — solo debounce pasivo sin cuantización musical. La rueda de color saltaba sin ritmo.

---

## 🏗️ DISEÑO ARQUITECTÓNICO

### La Ley Universal

> **Toda orden de color dirigida a un fixture mecánico, provenga de donde provenga, debe ser cuantizada armónicamente al rBPM.**

### El Punto de Integración

El único punto por donde TODOS los colores de TODAS las capas pasan antes de llegar al hardware es:

```
HAL.translateColorToWheel()
```

Llamado desde `renderFromTarget()`, este método procesa CADA fixture mecánico en CADA frame. No importa si el color viene de Titan (Layer 0), Chronos (Layer 1), Timeline (Layer 2), efectos (Layer 3) o Manual UI — todos convergen aquí después de la arbitración.

### El Pipeline Final

```
ColorTranslator.translate()  →  HarmonicQuantizer.quantize()  →  SafetyLayer.filter()  →  DarkSpinFilter.filter()
         ↑                              ↑                              ↑                         ↑
    RGB → wheel DMX              Gate armónico BPM              Debounce pasivo            Blackout tránsito
```

**Si el Quantizer bloquea**: alimenta al SafetyLayer el color ANTERIOR → SafetyLayer ve "sin cambio" → DarkSpin ve "sin cambio" → ni blackout ni movimiento de motor. Elegante e invisible.

---

## 🔧 CAMBIOS EJECUTADOS

### 1. AudioMetrics — BPM Bridge (`HardwareAbstraction.ts`)

```typescript
// ANTES
interface AudioMetrics {
  bpm?: number
}

// DESPUÉS (WAVE 2720)
interface AudioMetrics {
  bpm?: number
  bpmConfidence?: number  // 0-1, from IntervalBPMTracker via Worker
}
```

`bpmConfidence` ahora fluye: Worker → IPC → TitanOrchestrator → `halAudioMetrics` → HAL.

### 2. HAL — BPM State por Frame (`HardwareAbstraction.ts`)

Nuevas propiedades de instancia:
```typescript
private currentFrameBpm = 120
private currentFrameBpmConfidence = 0
```

Seteadas al inicio de `renderFromTarget()` desde `audio.bpm` y `audio.bpmConfidence`. Disponibles para `translateColorToWheel()` sin cambiar su firma.

### 3. HarmonicQuantizer en translateColorToWheel (`HardwareAbstraction.ts`)

Integración ANTES del SafetyLayer, SOLO para fixtures mecánicos:

```typescript
if (isMechanicalFixture(profile)) {
  const quantizerResult = this.harmonicQuantizer.quantize(
    fixtureId, targetRGB,
    this.currentFrameBpm, this.currentFrameBpmConfidence,
    minChangeTimeMs
  )
  if (!quantizerResult.colorAllowed) {
    quantizedColorDmx = this.safetyLayer.getLastColor(fixtureId) ?? quantizedColorDmx
  }
}
```

### 4. SafetyLayer — `getLastColor()` (`HardwareSafetyLayer.ts`)

Nuevo método público que expone el último color DMX conocido de un fixture:
```typescript
public getLastColor(fixtureId: string): number | undefined {
  return this.fixtureStates.get(fixtureId)?.lastColorDmx
}
```

### 5. Desacoplamiento de TitanOrchestrator (`TitanOrchestrator.ts`)

- **ELIMINADO**: Bloque completo de cuantización por efecto (líneas ~957-993)
- **ELIMINADO**: `import { getHarmonicQuantizer }` 
- **ELIMINADO**: `import { getProfile, isMechanicalFixture }` (ya no usados)
- **PRESERVADO**: Comentario explicando la migración a HAL

### 6. TitanOrchestrator — Propagación `bpmConfidence`

```typescript
const halAudioMetrics = {
  // ... campos existentes ...
  bpmConfidence: this.lastAudioData?.workerBpmConfidence ?? 0,
}
```

---

## 📊 ARCHIVOS MODIFICADOS

| Archivo | Operación |
|---------|-----------|
| `electron-app/src/hal/HardwareAbstraction.ts` | +imports, +BPM state, +quantizer en pipeline |
| `electron-app/src/hal/translation/HardwareSafetyLayer.ts` | +`getLastColor()` |
| `electron-app/src/core/orchestrator/TitanOrchestrator.ts` | -quantizer block, -imports muertos, +bpmConfidence propagation |

---

## 🔬 FLUJO DE DATOS COMPLETO (POST-WAVE 2720)

```
┌─────────────────────────────────────────────┐
│ Worker Thread                                │
│ IntervalBPMTracker → {bpm, bpmConfidence}   │
└──────────────┬──────────────────────────────┘
               │ IPC (brain.on('audio-levels'))
               ↓
┌──────────────────────────────────────────────┐
│ TitanOrchestrator                            │
│ lastAudioData.workerBpm                      │
│ lastAudioData.workerBpmConfidence ──────┐    │
│                                         │    │
│ halAudioMetrics = {                     │    │
│   bpm: workerBpm,           ◄───────────┤    │
│   bpmConfidence: workerBpmConfidence ◄──┘    │
│ }                                            │
└──────────────┬───────────────────────────────┘
               │ renderFromTarget(target, fixtures, halAudioMetrics)
               ↓
┌──────────────────────────────────────────────┐
│ HAL.renderFromTarget()                       │
│ this.currentFrameBpm = audio.bpm             │
│ this.currentFrameBpmConfidence = audio.bpmC  │
│                                              │
│ → translateColorToWheel(state, fixture, cw)  │
│   → ColorTranslator.translate(RGB, profile)  │
│   → [QUANTIZER] HarmonicQuantizer.quantize() │◄── UNIVERSAL GATE
│   → SafetyLayer.filter(id, dmx, profile, d)  │
│   → DarkSpinFilter.filter(id, dmx, prof, d)  │
│   → return {colorWheel, dimmer, strobe}       │
└──────────────────────────────────────────────┘
```

---

## ✅ VERIFICACIÓN

- **Compilación TypeScript**: ZERO errores en todos los archivos modificados
- **IDE Diagnostics**: ZERO errores (solo warnings preexistentes de deprecación tsconfig)
- **Dimmer/LED**: NO afectados — Quantizer solo opera en fixtures mecánicos (`isMechanicalFixture()`)
- **RGBW/CMY fixtures**: NO afectados — retornan antes de la sección COLOR WHEEL
- **Chronos/Timeline**: AHORA cuantizados — pasan por translateColorToWheel como todos
- **Manual overrides**: AHORA cuantizados — pasan por translateColorToWheel como todos
- **Primer frame**: Graceful fallback — si no hay `lastColor`, pasa el primer color sin bloquear

---

## 🎵 EPÍLOGO

El Péndulo Armónico ya no es una ley local de TitanOrchestrator. Es la Ley Universal del HAL. Todo fixture mecánico, todo color, todo origen — cuantizado al ritmo de la música. El beat dicta la partitura. El hardware dicta las físicas. Sin excepciones.
