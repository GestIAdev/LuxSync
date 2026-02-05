# 🔬 WAVE 1177: CALIBRATION LOGGING SYSTEM

**Fecha**: 2026-02-05  
**Autor**: PunkOpus  
**Disparador**: Log de Boris Brejcha mostrando spam de 675 líneas en segundos  

---

## 📋 PROBLEMA DETECTADO

Al analizar el log de **Boris Brejcha - Brutal Minimal Techno**, encontramos:

### 🚨 SPAM CRÍTICO:

1. **15+ DIVINE MOMENTS seguidos** mientras `gatling_raid` ejecutaba
   - El sistema detectaba Z > 3.5 cada frame
   - Intentaba disparar `core_meltdown` 15 veces
   - GLOBAL_LOCK bloqueaba... pero el log se llenaba

2. **Historial contaminado** con efectos BLOQUEADOS
   ```
   effects=[core_meltdown,core_meltdown,core_meltdown,core_meltdown...]
   ```
   - El push al historial ocurría ANTES del bloqueo
   - Destruía el algoritmo de diversidad

3. **Zone transitions caóticas** (4-5 por segundo)
   ```
   Zone transition: intense → active
   Zone transition: active → gentle  
   Zone transition: gentle → intense
   ```

4. **50%+ del log era ruido inútil**:
   - `[IPC 📡] audioBuffer` cada 30 frames
   - `[🎭 HAL ARBITER]` cada frame
   - `[TitanOrchestrator] ❤️ BPM` sin cambios

---

## 🔧 SOLUCIONES IMPLEMENTADAS

### 1. EffectManager: `hasDictator()` method

```typescript
// EffectManager.ts - NUEVO MÉTODO
hasDictator(): string | null {
  for (const effect of this.activeEffects.values()) {
    if ((effect as any).mixBus === 'global') {
      return effect.effectType
    }
  }
  return null
}
```

### 2. DecisionMaker: Skip DIVINE si hay dictador

```typescript
// DecisionMaker.ts - determineDecisionType()
if (activeDictator) {
  // Silencio total - el dictador ya fue anunciado
} else if (currentZ >= DIVINE_THRESHOLD) {
  // ... evaluar DIVINE normalmente
}
```

### 3. DecisionInputs: Nuevo campo `activeDictator`

```typescript
interface DecisionInputs {
  // ... existentes ...
  activeDictator?: string | null  // 🔒 WAVE 1177
}
```

### 4. SeleneTitanConscious: Pasar dictador a DecisionMaker

```typescript
const inputs: DecisionInputs = {
  // ... existentes ...
  activeDictator: getEffectManager().hasDictator(),
}
```

### 5. History push movido a `effectTriggered` listener

```typescript
// ANTES: Push en processConsciousness() (podía ser bloqueado después)
// DESPUÉS: Push solo cuando EffectManager confirma ejecución

effectManager.on('effectTriggered', (event) => {
  this.effectHistory.push({
    type: event.effectType,
    timestamp: Date.now(),
  })
})
```

### 6. CalibrationLogger: Sistema centralizado de niveles

Nuevo archivo: `src/core/utils/CalibrationLogger.ts`

```typescript
type LogLevel = 'SILENT' | 'CALIBRATION' | 'NORMAL' | 'DEBUG'

// CALIBRATION mode para disco test:
// - Solo efectos FIRED/BLOCKED
// - Sin spam de frames, IPC, zonas rápidas
```

---

## 📊 RESULTADO ESPERADO

| Métrica | Antes | Después |
|---------|-------|---------|
| Logs DIVINE durante efecto activo | 15+ por segundo | 0 |
| Historial con efectos bloqueados | Sí (contaminado) | No (solo ejecutados) |
| Zone transitions en log | 4-5 por segundo | Solo si persiste 500ms+ |
| Logs útiles para humano | ~10% | ~80% |

---

## 🎯 MODOS DE LOGGING

### `CALIBRATION` (para disco test)
```
🔥 [EFFECT FIRED] gatling_raid | Source: divine_strike | I: 1.00 | Z: 4.2σ
🔒 [BLOCKED] core_meltdown | GLOBAL_LOCK: gatling_raid (dictator)
🌩️ [DIVINE STRIKE] Z=4.54σ | Zone: active | Arsenal: [...]
```

### `DEBUG` (para desarrollo)
```
// Todo lo anterior + 
🎛️ [TEXTURE] CLEAN/Tonal | Harsh: 0.02 | Centroid: 1397Hz
🩻 [GOD EAR] Clarity: 0.989 | Flatness: 0.005 | Crest: 16.98
🔋 [ZONE] intense → active (E=0.67)
```

### `SILENT` (producción)
```
// Nada
```

---

## 📝 ARCHIVOS MODIFICADOS

1. `EffectManager.ts` - Nuevo método `hasDictator()`
2. `DecisionMaker.ts` - Nueva prop `activeDictator`, skip DIVINE si activo
3. `SeleneTitanConscious.ts` - Pasar dictador, mover history push
4. **NUEVO** `CalibrationLogger.ts` - Sistema centralizado
5. **NUEVO** `LogConfig.ts` - Configuración rápida

---

## 🎪 PARA EL DISCO TEST

1. Editar `LogConfig.ts`:
   ```typescript
   export const LOG_MODE: LogLevel = 'CALIBRATION'
   ```

2. En consola solo verás:
   - Efectos DISPARADOS con Z-Score
   - Efectos BLOQUEADOS y razón
   - Cambios de BPM significativos

3. Si necesitas más detalle:
   ```typescript
   import { enableDebugMode } from '../utils/LogConfig'
   enableDebugMode()  // Activa todo
   ```

---

*"Menos ruido, más señal. El francotirador no necesita gritar."* - PunkOpus
