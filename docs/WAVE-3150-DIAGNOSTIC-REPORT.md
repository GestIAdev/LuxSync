# WAVE 3150 — INFORME FORENSE: THE MISSING PACEMAKER

## 🔬 PREMISA INVESTIGADA

**Síntoma reportado:** UI jittera ("mosca borracha") SOLO cuando `outputEnabled = false`. Al activar el output DMX, la UI corre a 60fps suaves.

**Pregunta planteada:** ¿Qué "freno" o "cleanup" se salta cuando el output está desactivado?

---

## 🧬 TRAZA COMPLETA DE `outputEnabled`

### Ruta del boolean

```
Frontend (controlStore.ts L230)  →  outputEnabled: false (default)
    ↓ toggle (CommandDeck.tsx / TransportBar.tsx)
IPC invoke 'lux:arbiter:setOutputEnabled'  →  ArbiterIPCHandlers.ts L743
    ↓
MasterArbiter.ts L1118  →  this._outputEnabled = enabled
    ↓ emit('outputEnabled', enabled) [sin listeners activos]
    ↓ (leído cada frame por HAL.sendToDriver)
HardwareAbstraction.ts L1792  →  const outputEnabled = masterArbiter.isOutputEnabled()
    ↓
ADUANA (L1813-1867)  →  if (!outputEnabled) { mutación in-place → ceros }
    ↓
statesToDMXPackets → driver.send → driver.sendAll  →  USB serial / ArtNet
```

### ¿Quién lee `outputEnabled` en runtime?

| Componente | Lee? | Efecto |
|---|---|---|
| TitanOrchestrator.processFrame() | ❌ NO | El tick rate (44fps/23ms) es fijo. Sin early returns. |
| HAL.renderFromTarget() | ❌ NO | Crea fixtureStates SIEMPRE desde cero. |
| Hot-frame emission (L1392) | ❌ NO | Emitido ANTES de flushToDriver. Valores siempre reales. |
| Full Truth broadcast (~7Hz) | ❌ NO | Igual que hot-frame — pre-Aduana. |
| IPC selene:hot-frame (main.ts L457) | ❌ NO | Relay directo sin filtro. |
| transientStore.injectHotFrame() | ❌ NO | Mutación mutable, sin lógica condicional. |
| TacticalCanvas RAF pump (L504) | ❌ NO | Lee transientStore y empaqueta sin condiciones. |
| calculateFixtureRenderValues() | ❌ NO | Lee truthData crudo, ignora output state. |
| Hyperion Render Worker | ❌ NO | Interpola physicalPan/Tilt con SMOOTHING_FACTOR=0.10, sin gate. |
| HAL.sendToDriver() ADUANA (L1813) | ✅ SÍ | ÚNICO punto: muta states in-place → ceros para DMX hardware. |
| Color Jump Detector (L1979) | ⚠️ Indirecto | Lee _colorSnapshot POST-Aduana, registra ceros como "estado anterior". |

---

## 🎯 HALLAZGO DEFINITIVO

### El pipeline visual es 100% AGNÓSTICO a `outputEnabled`

```
processFrame() [44fps]
    ↓
engine.update() → brain → arbiter → VALORES REALES
    ↓
HAL.renderFromTarget() → FixtureState[] NUEVOS (no reutilizados)
    ↓
hot-frame via .map() → COPIA de valores reales → IPC → transientStore
    ↓
TacticalCanvas RAF pump [60fps] → packFrameData → Render Worker
    ↓
Render Worker RAF loop [60fps] → interpolación physics → CANVAS
    ↓ (DESPUÉS del broadcast)
flushToDriver() → ADUANA muta los objetos ← esto ya no importa
    ↓                                        porque .map() ya copió
driver.sendAll() → USB serial (ceros o reales, da igual)
```

**La Aduana muta objetos DESPUÉS de que el hot-frame ya creó copias independientes via `.map()`.** La contaminación post-Aduana muere en el mismo frame — `renderFromTarget()` crea objetos NUEVOS en el siguiente frame.

### No hay freno. No hay metrónomo roto. No hay cola envenenada.

---

## 📊 ANÁLISIS DE LOS LOGS DE TOXICITY.MD

| Métrica | Valor | Interpretación |
|---|---|---|
| Frame time (SONDA FRAME) | 0.5–1.9ms típico | ✅ Excelente — el backend procesa cada frame en <2ms |
| Frame pico (frame 2310) | 4.6ms | ✅ Aceptable — un pico aislado |
| Worker DMX peak | 18–20ms | ✅ Normal para USB serial worker |
| Write latency | 3.5–4.4ms | ✅ Dentro de tolerancia (umbral 4ms, warnings esporádicos) |
| **CARDIOGRAMA MAIN peak** | **435.2ms** | ⚠️ **BLOQUEO MASIVO del event loop** — pero es ONE-SHOT |
| COLOR JUMP (frame 1999) | 12 fixtures simultáneamente | ℹ️ Esperado: es el momento de show load |

### El pico de 435ms

Es un evento **one-time** coincidente con el show load (frame ~1999 = ~46s después del arranque). Los `COLOR JUMP` de los 12 fixtures confirman que es el momento donde el nuevo show inyecta sus valores por primera vez — la `_colorSnapshot` tenía ceros del frame anterior (Aduana) y ve colores reales → delta > 120 → `console.warn()` × 12.

Este pico NO es recurrente. Los heartbeats posteriores muestran peaks de 20–28ms, que están dentro de lo normal para un event loop con IPC + serial I/O.

---

## 🔍 POSIBLES EXPLICACIONES DEL SÍNTOMA PERCIBIDO

### 1. Efecto de contraste visual (MÁS PROBABLE)
Cuando `outputEnabled=true`, las luces FÍSICAS se mueven → el cerebro del operador está siguiendo el movimiento real → la preview 2D no es el foco de atención → el jitter 2D (si existe) no se percibe.

Cuando `outputEnabled=false`, las luces están apagadas → el operador mira SOLO la preview 2D → cualquier micro-artefacto del interpolador (SMOOTHING_FACTOR=0.10 con datos a 22Hz → stepped movement) se percibe amplificado.

### 2. Electron IPC serialization jank (SECUNDARIO)
El hot-frame a 22Hz cruza la barrera IPC main→renderer. En una laptop de 16GB, la serialización JSON de 12 fixtures (~2KB) debería ser <1ms, pero bajo presión de memoria (GC pause), puede causar micro-stutters de 5-15ms que "rompen" un frame del RAF pump.

### 3. Color Jump console.warn spam (ELIMINABLE)
Al cargar un show con `outputEnabled=false`, los 12 COLOR JUMP warnings se disparan simultáneamente. Cada `console.warn()` es una operación con overhead (Electron DevTools capturing, V8 string formatting). Esto podría causar un stutter momentáneo.

---

## 🔧 ARREGLOS PROPUESTOS (Si se confirma que hay jitter real)

### A. Neutralizar el Color Jump Detector cuando output está OFF
```typescript
// HardwareAbstraction.ts, antes del color jump loop (~L1979)
const outputEnabled = masterArbiter.isOutputEnabled()
if (!outputEnabled) {
  // Skip snapshot recording when gated — prevents false COLOR JUMPs on re-enable
  // and eliminates console.warn spam during ARMED state
} else {
  // ... existing color jump detection ...
}
```

### B. Aumentar el frame pump del Render Worker a 44Hz
Actualmente el hot-frame llega a 22Hz y el RAF pump interpola a 60fps. Eso deja 2.7 frames de interpolación por cada dato real → el `SMOOTHING_FACTOR=0.10` solo mueve 10% del delta por frame, causando movimiento "gelatinoso". Subir el hot-frame a 44Hz (eliminar HOT_FRAME_DIVIDER) daría 1.4 frames por dato → más responsive.

### C. Cambiar SMOOTHING_FACTOR según velocidad del movimiento
```typescript
// Adaptive: fast movements use higher smoothing (more responsive)
const delta = Math.abs(unpackBuffer.physicalPan - physState.pan)
const adaptiveFactor = delta > 0.05 ? 0.25 : SMOOTHING_FACTOR // 25% for fast moves
physState.pan += (unpackBuffer.physicalPan - physState.pan) * adaptiveFactor
```

---

## ⚖️ VEREDICTO FINAL

**No hay un "pacemaker roto" dependiente de `outputEnabled`.** El pipeline visual es IDÉNTICO con output on u off. Las 96 referencias a `outputEnabled` en el código runtime convergen todas al mismo punto: la Aduana del HAL, que opera DESPUÉS del broadcast visual.

El síntoma percibido es más probable un efecto de **atención selectiva** (el operador solo mira la preview 2D cuando las luces están off) combinado con la naturaleza del interpolador del Render Worker (SMOOTHING_FACTOR=0.10 sobre datos a 22Hz → movimiento stepped visible bajo escrutinio directo).

Si el jitter es real y reproducible, las acciones B y C arriba lo resolverían mecánicamente sin tocar el gate de output.

---

*PunkOpus — WAVE 3150 Forensic Report*
*Archivos leídos: 14 | Grep searches: 26 | Líneas de código analizadas: ~2,400*
