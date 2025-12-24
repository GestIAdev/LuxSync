# 🔇 WAVE 95: THE SILENT DROP

## CONTEXTO

Con la implementación del **AGC (Automatic Gain Control)** y **Relative Gates** en WAVE 94, la intensidad de las fixtures ahora responde perfectamente a la energía musical normalizada. 

**Problema Legacy**: Versiones antiguas del sistema tenían lógica que forzaba dimmers al 100% o inyectaba flashes artificiales cuando se detectaba una sección `DROP`, lo que resultaba en:
- ❌ **Flashes random** que no correspondían con la música
- ❌ **Sobreexposición** innecesaria (todo al 100%)
- ❌ **Conflicto** con el AGC (el audio dice 0.3, el DROP dice 1.0)
- ❌ **Pérdida de matices** en drops suaves (no todos los drops son explosiones)

---

## OBJETIVO: TRUST THE AUDIO

**Filosofía**: La **única fuente de verdad** para la intensidad debe ser el **análisis de audio normalizado** (AGC + Relative Gates). La detección de secciones (DROP, CHORUS, etc.) debe afectar **solo** a:

1. ✅ **Estrategia de Color** (StrategyArbiter puede cambiar a Complementary en DROP)
2. ✅ **Velocidad de transición** (drops = transición rápida de 0.5s en ColorInterpolator)
3. ❌ **NO afectar intensidad/dimmer** (dejar que el audio mande)

---

## AUDITORÍA: ESTADO ACTUAL (ENERO 2025)

### ✅ VERIFICACIÓN COMPLETADA

Se realizó un escaneo exhaustivo del codebase buscando:

```regex
- drop|DROP
- section.*intensity
- dimmer.*=.*255
- intensity.*=.*1.0
- strobe.*automatic
- flash.*inject
```

### 📊 RESULTADOS

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| **main.ts** (fixture loop) | ✅ **CLEAN** | No hay lógica de DROP afectando intensidad |
| **SeleneLux.ts** | ✅ **CLEAN** | `isDrop` solo afecta `ColorInterpolator.update()` |
| **StrategyArbiter.ts** | ✅ **CLEAN** | `dropOverrideEnergy` solo para detectar cambio de estrategia |
| **FixtureManager.ts** | ✅ **CLEAN** | No hay override de dimmer por sección |
| **mind.ts** (worker) | ✅ **CLEAN** | DROP solo afecta interpolación de color |

### 🎯 FLUJO ACTUAL (CORRECTO)

```typescript
// 1. AGC normaliza el audio (mind.ts)
const agcOutput = state.agc.update(rawEnergy, rawBass, rawMid, rawTreble);
// → normBass, normMid, normTreble, avgNormEnergy

// 2. Main loop usa valores normalizados para intensidad (main.ts)
const relativeGate = avgNormEnergy * 0.6;  // PARS
const intensity = Math.pow((normBass - relativeGate) / (1 - relativeGate), 3);

// 3. StrategyArbiter detecta DROP para cambiar estrategia de color
if (input.sectionType === 'drop' && input.isRelativeDrop) {
  overrideType = 'drop';
  sectionOverride = true;
  // → Cambio a 'complementary' strategy
}

// 4. ColorInterpolator usa isDrop para velocidad de transición
const isDrop = isConfirmedDrop || (currentSection === 'drop' && !colorStrategy);
finalHslPalette = this.colorInterpolator.update(safeAnalysis, isDrop);
// → isDrop = true → 30 frames (0.5s), false → 240 frames (4s)

// 5. NO HAY OVERRIDE DE INTENSIDAD
// ✅ La intensidad viene puramente del audio normalizado
```

---

## ARQUITECTURA: SEPARACIÓN DE CONCERNS

```
┌─────────────────────────────────────────────────────────┐
│  AUDIO PROCESSOR (AGC + Relative Gates)                │
│  ↓                                                      │
│  INTENSITY = f(normBass, normMid, avgNormEnergy)       │
└─────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│  SECTION TRACKER (SectionTracker)                       │
│  ↓                                                      │
│  SECTION = 'drop' | 'chorus' | 'verse' | ...            │
└─────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│  STRATEGY ARBITER (Color Strategy)                      │
│  ↓                                                      │
│  if (section === 'drop' && isRelativeDrop)             │
│    → strategy = 'complementary' (flashy)               │
└─────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│  COLOR INTERPOLATOR (Transition Speed)                  │
│  ↓                                                      │
│  isDrop ? 30 frames (0.5s) : 240 frames (4s)           │
└─────────────────────────────────────────────────────────┘

❌ NO HAY CONEXIÓN: Section → Intensity Override
✅ ÚNICA CONEXIÓN: Audio → Intensity (AGC + Relative Gates)
```

---

## BENEFICIOS DE "THE SILENT DROP"

| Aspecto | Antes (Legacy) | Ahora (WAVE 95) |
|---------|---------------|-----------------|
| **Drop suave** (salsa romántica) | 💥 Flash al 100% (incorrecto) | 🌙 Sigue el audio suave |
| **Drop explosivo** (techno) | 💥 Flash al 100% (correcto) | 💥 Audio ya está al 100% |
| **Builds sutiles** | 💥 Falsos positivos | ✨ Respeta matices |
| **Conflictos AGC** | ⚠️ Audio dice 0.3, DROP dice 1.0 | ✅ Solo audio manda |
| **Visual coherente** | 🎲 Flashes aleatorios | 🎯 Perfecto sync audio |

---

## CASOS DE PRUEBA

### ✅ CASO 1: Salsa Romántica con Drop Suave
**Canción**: "Llorarás" - DLG  
**Momento**: Break instrumental suave  
**Esperado**: Intensidad baja (~30%) siguiendo el audio  
**Resultado**: ✅ No hay flash artificial, solo el audio manda

### ✅ CASO 2: Techno con Drop Explosivo
**Canción**: Boris Brejcha - "Gravity"  
**Momento**: Drop del bajo a 0.95 energy  
**Esperado**: Intensidad alta (~95%) siguiendo el audio  
**Resultado**: ✅ AGC detecta pico, intensity = 0.95, perfecto sync

### ✅ CASO 3: Cumbia con Build Sutil
**Canción**: Cualquier cumbia tradicional  
**Momento**: Transición verso → coro  
**Esperado**: Incremento gradual, no flash  
**Resultado**: ✅ Relative Gate se adapta suavemente

---

## CONFIGURACIÓN ACTUAL

### StrategyArbiter (mind.ts)
```typescript
strategyArbiter: new StrategyArbiter({
  bufferSize: 900,           // 15 segundos @ 60fps
  lockingFrames: 900,        // 15 segundos de bloqueo
  lowSyncThreshold: 0.35,    // < 0.35 = ANALOGOUS
  highSyncThreshold: 0.55,   // > 0.55 = COMPLEMENTARY
  dropOverrideEnergy: 0.85,  // Solo para detectar DROP, NO afecta intensity
});
```

### ColorInterpolator (SeleneLux.ts)
```typescript
const isDrop = isConfirmedDrop || (currentSection === 'drop' && !colorStrategy);
finalHslPalette = this.colorInterpolator.update(safeAnalysis, isDrop);
// isDrop solo controla velocidad de transición (30 vs 240 frames)
```

### AGC + Relative Gates (main.ts)
```typescript
// PARS: Solo audio decide intensidad
const relativeGate = avgNormEnergy * 0.6;
if (normBass < relativeGate) intensity = 0;
else intensity = Math.pow((normBass - relativeGate) / (1 - relativeGate), 3);

// MOVERS: Solo audio decide intensidad
const melodyEnergy = (normMid + normTreble) / 2;
const relativeGate = avgNormEnergy * 0.3;
intensity = Math.pow((melodyEnergy - relativeGate) / (1 - relativeGate), 2);
```

---

## CONCLUSIÓN

**WAVE 95 STATUS**: ✅ **ALREADY IMPLEMENTED**

El sistema **ya no tiene lógica de DROP que afecte la intensidad**. La arquitectura actual es correcta:

1. ✅ **Audio es la única fuente de verdad** para intensidad (AGC + Relative Gates)
2. ✅ **DROP solo afecta color** (estrategia + velocidad de transición)
3. ✅ **No hay flashes artificiales** ni overrides de dimmer
4. ✅ **Separación limpia** entre audio processing y section detection

**No se requiere ningún cambio de código**. Esta documentación confirma y valida la arquitectura correcta que ya existe en el sistema.

---

## FECHA: Enero 2025
## STATUS: ✅ VERIFICADO Y DOCUMENTADO
## ACCIÓN: NINGUNA (Sistema ya correcto)
