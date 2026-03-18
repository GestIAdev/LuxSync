# 🧹 WAVE 1015 - LOG CLEANUP EXECUTION PLAN

**Fecha**: 27 Enero 2026  
**Contexto**: Limpieza de spam de logs tras WAVE 1013 (60fps) - Console flooding

---

## 📊 ANÁLISIS DE LOGS ACTUALES

### **SPAM CRÍTICO (ELIMINAR)**

1. **DREAM_SIMULATOR** 🔴 - **20+ logs por dream**
   - Archivo: `EffectDreamSimulator.ts`
   - Problema: Log cada paso del proceso (4-8 veces por segundo)
   - Logs a eliminar:
     - `🔮 Dream #XXX - Exploring futures...`
     - `📊 Generated X candidates`
     - `🛡️ VIBE SHIELD`
     - `🧘 ZONE FILTER`
     - `🏆 TOP3`
   - **MANTENER SOLO**: Resultado final + timing (cuando > 5ms)

2. **INTEGRATOR** 🟡 - **5+ logs por integración**
   - Archivo: `DreamEngineIntegrator.ts`
   - Problema: Log cada paso (4-6 veces por segundo)
   - Logs a comprimir:
     - `📝 Passed 10 recent effects` ❌
     - `💾 Using cached dream result` ❌
     - `📊 Pipeline: ✅ APPROVED` → Solo si timing > 10ms

3. **BIAS_TRACKER** 🟡 - **Cada frame**
   - Archivo: `EffectBiasTracker.ts`
   - Logs a eliminar:
     - `📊 Last 10 effects: X/10 unique` → Solo si unique < 3

4. **CHOREO** 🟡 - **Contador inútil**
   - Archivo: `MovementChoreographer.ts`
   - Logs a eliminar TOTALMENTE:
     - `⚠️ FALLBACK: barCount forced`
     - `Bar:XXX | Phrase:XXX | Pattern:XXX`

5. **Workers (BETA/GAMMA/ALPHA)** 🟡 - **Heartbeat cada frame**
   - Archivos: `senses.ts`, `rhythm.ts`, etc.
   - Logs a COMPRIMIR:
     - `[BETA 🥁] BPM UPDATED` → Solo cambios > 5 BPM
     - `[BETA 🎵] Key Detected` → Solo cambios de key
     - `[GAMMA 🎵] Frame XXXX` → ELIMINAR
     - `[BETA 📡] AUDIO_BUFFER` → ELIMINAR

6. **IPC Heartbeat** 🟡 - **Completamente inútil**
   - Archivo: `TitanOrchestrator.ts` o workers
   - Log a eliminar:
     - `[IPC 📡] audioBuffer #XXXX | titan.running=true`

7. **GEARBOX** 🟡 - **Verbose innecesario**
   - Archivo: `MovementGearbox.ts`
   - Logs a COMPRIMIR:
     - Solo logear cuando factor < 0.80 (throttling activo)
     - Eliminar `✅ FULL THROTTLE` (ruido)

---

## ✅ LOGS A MANTENER (ÚTILES)

- `[SeleneTitanConscious]` - Estado de consciencia
- `[SENSE 🎛️]` - Textura espectral (harshness, flatness, centroid)
- `[FUZZY 😴]` - Estado difuso energético
- `[MEMORY 🧠]` - Memoria energética (solo alertas 🟡🔴)
- `[AGC 🎚️]` - Solo cuando gain > 2.0x o warnings
- `[TitanOrchestrator]` - Solo cada 300 frames (5s)
- `[VMM 🎯]` - Movimiento (útil para debug)
- `[EffectManager]`, efectos activos - MANTENER
- `[HISTORY_DEBUG]`, `[GLOBAL_LOCK]` - MANTENER
- `[StrategyArbiter]` - MANTENER
- `[Harmony 🎵]` - Solo KEY CHANGE
- `[KeyStabilizer]` - MANTENER

---

## 🎯 ESTRATEGIA DE LIMPIEZA

### **Fase 1: Dream Engine (CRÍTICO)**
Reducir de 20+ logs a 1-2 por dream:
- ANTES: 8 logs por dream × 4 dreams/seg = 32 logs/seg
- DESPUÉS: 1 log por dream × 4 dreams/seg = 4 logs/seg
- **Reducción: 87.5%**

### **Fase 2: Integrator**
Reducir de 5+ logs a 1:
- ANTES: 5 logs × 4 veces/seg = 20 logs/seg
- DESPUÉS: 1 log × 1 vez/seg = 1 log/seg
- **Reducción: 95%**

### **Fase 3: Workers + IPC**
Eliminar heartbeats innecesarios:
- ANTES: ~30 logs/seg (BETA, GAMMA, IPC)
- DESPUÉS: ~3 logs/seg (solo cambios significativos)
- **Reducción: 90%**

### **Fase 4: Choreo + Gearbox**
Eliminar ruido visual:
- ANTES: ~15 logs/seg
- DESPUÉS: 0-2 logs/seg (solo problemas)
- **Reducción: 87%**

---

## 📉 REDUCCIÓN TOTAL ESTIMADA

**ANTES**: ~100-120 logs/segundo  
**DESPUÉS**: ~10-15 logs/segundo  
**REDUCCIÓN GLOBAL**: **~90%** 🎯

---

## 🔧 ARCHIVOS A MODIFICAR

1. `EffectDreamSimulator.ts` - Silenciar proceso, solo resultado
2. `DreamEngineIntegrator.ts` - Silenciar pipeline, solo timing
3. `EffectBiasTracker.ts` - Solo alertas (unique < 3)
4. `MovementChoreographer.ts` - Eliminar todo
5. `MovementGearbox.ts` - Solo throttling crítico
6. `senses.ts` (Worker Beta) - Solo cambios BPM/Key
7. `rhythm.ts` o equivalente - Eliminar GAMMA heartbeat
8. `TitanOrchestrator.ts` - Eliminar IPC heartbeat

---

## ⚡ EJECUCIÓN

Limpieza en cascada, archivo por archivo, verificando no romper nada crítico.

**Estado**: READY TO EXECUTE ✅
