# 🔍 WAVE 1167: AUDITORÍA DEL MÓDULO DE TELEMETRÍA

## ESTADO: AUDITADO - LEGACY PARCIAL DETECTADO

**Fecha**: 4 Febrero 2026  
**Auditor**: PunkOpus  
**Solicitante**: Radwulf  
**Scope**: `/src/components/telemetry/` + `/src/components/views/LuxCoreView/`

---

## 📋 RESUMEN EJECUTIVO

El módulo de telemetría está **parcialmente funcional pero con deuda técnica significativa**. Los componentes están conectados al `truthStore` (TITAN 2.0) pero varios muestran métricas obsoletas, tienen estilos inconsistentes con el resto de la UI, y el sistema de logging tiene conectividad intermitente.

### Veredicto General: 🟡 REQUIERE REDISEÑO

| Componente | Estado | Problema Principal |
|------------|--------|-------------------|
| `HuntMonitor` | 🟡 | Modelo mental obsoleto (solo Hunt, falta Dream Engine/Ethics) |
| `AudioOscilloscope` | 🟠 | Solo 3 bandas cuando FFT tiene 7, sin BPM confidence real |
| `MusicalDNAPanel` | 🟠 | Zodiaco sin impacto real, Mood fuente confusa |
| `PalettePreview` | 🟢 | Funciona bien, necesita refresh estético |
| `TacticalLog` | 🟡 | Categorías legacy, logs escasos del backend |
| `LuxCoreView` | 🟡 | Estructura OK, CSS obsoleto |

---

## 🔬 AUDITORÍA DETALLADA POR COMPONENTE

---

### 1. 🎯 HuntMonitor

**Ubicación**: `src/components/telemetry/HuntMonitor/HuntMonitor.tsx`  
**Líneas**: ~200 LOC  
**Última Wave**: WAVE 550

#### Estado de Conexión de Datos

| Propiedad UI | Source en truthStore | Estado |
|-------------|---------------------|--------|
| `huntState` | `truth.consciousness.ai.huntState` | ✅ ACTIVO |
| `confidence` | `truth.consciousness.ai.confidence` | ✅ ACTIVO |
| `prediction` | `truth.consciousness.ai.prediction` | ✅ ACTIVO |
| `beautyScore` | `truth.consciousness.ai.beautyScore` | ✅ ACTIVO |
| `beautyTrend` | `truth.consciousness.ai.beautyTrend` | ✅ ACTIVO |
| `consonance` | `truth.consciousness.ai.consonance` | ✅ ACTIVO |
| `energyOverride` | `truth.consciousness.ai.energyOverrideActive` | ✅ ACTIVO |
| `biases` | `truth.consciousness.ai.biasesDetected` | ✅ ACTIVO |
| `reasoning` | `truth.consciousness.ai.reasoning` | ✅ ACTIVO |

#### ⚠️ PROBLEMAS DETECTADOS

1. **Modelo Mental Obsoleto**
   - El panel se llama "Hunt Monitor" pero el sistema ahora tiene:
     - `SeleneTitanConscious` (SENSE → THINK → DREAM → VALIDATE)
     - `DreamEngine` (simulación de escenarios)
     - `VisualConscienceEngine` (ética visual)
     - `EffectDNA` (evolución de efectos)
   - **El Hunt es solo 1 de 4+ motores cognitivos**

2. **Controles Fantasma**
   ```tsx
   // Línea 40-48: Botones que pueden estar desconectados
   const handleForceMutate = useCallback(() => {
     window.lux?.forceMutate?.() // ¿Este IPC existe todavía?
   }, [])
   
   const handleResetMemory = useCallback(() => {
     window.lux?.resetMemory?.() // ¿Este IPC existe todavía?
   }, [])
   ```
   - **VERIFICAR**: Si estos IPCs están implementados en `preload.ts`

3. **Visualización Incompleta**
   - No muestra el estado del `DreamEngine` (isActive, currentType, projectedBeauty)
   - No muestra métricas de `VisualConscience` (flashing limits, safety)
   - No muestra `dropState` (IDLE/ATTACK/SUSTAIN/RELEASE)

#### 💀 LEGACY SCORE: 6/10

---

### 2. 🎵 AudioOscilloscope

**Ubicación**: `src/components/telemetry/AudioOscilloscope/AudioOscilloscope.tsx`  
**Líneas**: ~130 LOC  
**Última Wave**: WAVE 29

#### Estado de Conexión de Datos

| Propiedad UI | Source en truthStore | Estado |
|-------------|---------------------|--------|
| `bass` | `truth.sensory.audio.bass` | ✅ ACTIVO |
| `mid` | `truth.sensory.audio.mid` | ✅ ACTIVO |
| `treble` | `truth.sensory.audio.high` | ✅ ACTIVO |
| `energy` | `truth.sensory.audio.energy` | ✅ ACTIVO |
| `peak` | `truth.sensory.audio.peak` | ✅ ACTIVO |
| `onBeat` | `truth.sensory.beat.onBeat` | ✅ ACTIVO |
| `bpm` | `truth.sensory.beat.bpm` | ✅ ACTIVO |
| `confidence` | `truth.sensory.beat.confidence` | ✅ ACTIVO |

#### ⚠️ PROBLEMAS DETECTADOS

1. **Solo 3 Bandas - El FFT tiene 7**
   ```typescript
   // Backend tiene (SeleneProtocol.ts):
   // audio.bass (20-250Hz)
   // audio.mid (250Hz-4kHz)
   // audio.high (4kHz-20kHz)
   // + spectralCentroid, spectralFlux, zeroCrossingRate
   
   // WAVE 1011 en Workers añadió:
   // subBass, lowMid, highMid, transients
   ```
   - **El osciloscopio muestra 3 barras cuando podría mostrar 7**

2. **Trend Hardcodeado**
   ```tsx
   // Línea 32: Trend está FIJO
   trend: 'stable' as const // TODO: Implementar tendencia real
   ```
   - La tendencia nunca cambia visualmente

3. **Confidence Visual Primitiva**
   - Solo 3 dots para confidence cuando podría ser una barra o gauge

4. **Sin Waveform Real**
   - Se llama "Oscilloscope" pero no muestra una waveform/FFT visual
   - Es solo un bar chart básico

#### 💀 LEGACY SCORE: 7/10

---

### 3. 🧬 MusicalDNAPanel

**Ubicación**: `src/components/telemetry/MusicalDNAPanel/MusicalDNAPanel.tsx`  
**Líneas**: ~190 LOC  
**Última Wave**: WAVE 260.5

#### Estado de Conexión de Datos

| Propiedad UI | Source en truthStore | Estado |
|-------------|---------------------|--------|
| `key` | `truth.context.key` | ✅ ACTIVO |
| `mood` | `truth.context.mood` ó `consciousness.stableEmotion` | ⚠️ CONFUSO |
| `zodiac.sign` | `truth.consciousness.zodiac.sign` | ✅ ACTIVO |
| `zodiac.element` | `truth.consciousness.zodiac.element` | ✅ ACTIVO |
| `section` | `truth.context.section.current` | ✅ ACTIVO |
| `energy` | `truth.sensory.audio.energy` | ✅ ACTIVO |
| `vibe` | `truth.system.vibe` | ✅ ACTIVO |
| `syncopation` | `truth.context.syncopation` | ✅ ACTIVO |
| `dropState` | `truth.consciousness.dropState` | ✅ ACTIVO |

#### ⚠️ PROBLEMAS DETECTADOS

1. **Mood de Fuente Confusa**
   ```tsx
   // Línea 76-78: Cascada confusa de fuentes
   mood: contextData?.mood?.toUpperCase() || cognitive?.stableEmotion || 'NEUTRAL',
   ```
   - ¿De dónde viene el mood realmente? 
   - `context.mood` vs `consciousness.mood` vs `stableEmotion`

2. **Zodiac Sin Impacto Visible**
   - El Zodiac se muestra pero **¿afecta algo?**
   - En el backend, `ZodiacAffinityCalculator` influye en `BeautySensor`
   - Pero el usuario no sabe qué hace
   - **CANDIDATO A PURGA o explicación**

3. **Section Detection Básica**
   - Solo muestra nombre de sección
   - No muestra: transition progress, next predicted section

4. **Thermal Temperature Ausente**
   - El panel NO muestra `thermalTemperature` (2000K-10000K)
   - Aunque está en PalettePreview, debería estar aquí también

#### 💀 LEGACY SCORE: 5/10

---

### 4. 🎨 PalettePreview

**Ubicación**: `src/components/telemetry/PalettePreview/PalettePreview.tsx`  
**Líneas**: ~100 LOC  
**Última Wave**: WAVE 270

#### Estado de Conexión de Datos

| Propiedad UI | Source en truthStore | Estado |
|-------------|---------------------|--------|
| `primary` | `truth.intent.palette.primary` | ✅ ACTIVO |
| `secondary` | `truth.intent.palette.secondary` | ✅ ACTIVO |
| `accent` | `truth.intent.palette.accent` | ✅ ACTIVO |
| `ambient` | `truth.intent.palette.ambient` | ✅ ACTIVO |
| `strategy` | `truth.intent.palette.strategy` | ✅ ACTIVO |
| `mood` | `truth.context.mood` | ✅ ACTIVO |
| `thermalTemperature` | `truth.consciousness.thermalTemperature` | ✅ ACTIVO |

#### ⚠️ PROBLEMAS DETECTADOS

1. **Labels Confusos**
   - `FRONT`, `MOV L`, `MOV R`, `BACK`
   - ¿Qué significan para un DJ? No son zonas estándar

2. **Strobe Detection Hardcodeada**
   ```tsx
   // Línea 31
   const isStrobe = (palette?.accent?.s === 0 && palette?.accent?.l === 100)
   ```
   - Lógica frágil para detectar strobe

3. **Estilo Visual Diferente**
   - Es el panel más "militar" del lote
   - Inconsistente con CalibrationView/Forge

#### 💀 LEGACY SCORE: 3/10 (el mejor del grupo)

---

### 5. 📜 TacticalLog

**Ubicación**: `src/components/views/LuxCoreView/TacticalLog.tsx`  
**Líneas**: ~230 LOC  
**Última Wave**: WAVE 560

#### Estado de Conexión de Datos

- **Source**: `useLogStore` ← IPC canal `lux:log`
- **Backend Emisor**: `TitanOrchestrator.log()`

#### ⚠️ PROBLEMAS DETECTADOS

1. **Categorías Legacy**
   ```tsx
   // Líneas 15-38: LOG_CONFIG tiene categorías obsoletas
   const LOG_CONFIG = {
     Hunt: { icon: '🎯', ... },   // Obsoleto (ahora hay 4+ motores)
     Brain: { icon: '🧠', ... },  // Muy genérico
     Mode: { icon: '🎭', ... },   // OK
     Beat: { icon: '🥁', ... },   // OK
     Music: { icon: '🎵', ... },  // OK
     Genre: { icon: '🧬', ... },  // Obsoleto (ahora es Vibe)
     Visual: { icon: '🎨', ... }, // OK
     DMX: { icon: '💡', ... },    // OK
     System: { icon: '⚙️', ... }, // OK
     Error: { icon: '💀', ... },  // OK
     Info: { icon: 'ℹ️', ... },   // OK
   }
   ```
   - **Faltan**: Dream, Ethics, Effect, Color, Movement, Physics

2. **Logs Escasos del Backend**
   - El `TitanOrchestrator.log()` solo emite ~10 tipos de eventos
   - No logea: cambios de efecto, mutaciones DNA, decisiones de Dream Engine
   - **El Tactical Log está hambriento de datos**

3. **Sin Filtro por Nivel**
   - Solo filtra por categoría
   - No hay filtro por nivel (info/warn/error)

4. **Sin Timestamps Relativos**
   - Muestra timestamp absoluto
   - Mejor: "hace 2s", "hace 1min"

5. **Lucide Icons Genéricos**
   ```tsx
   import { Filter, Download, Trash2, Search, Pause, Play, Terminal } from 'lucide-react'
   ```
   - Usa Lucide cuando el resto de la app tiene `LuxIcons.tsx`

#### 💀 LEGACY SCORE: 6/10

---

### 6. 🧠 LuxCoreView (Container)

**Ubicación**: `src/components/views/LuxCoreView/index.tsx`  
**Líneas**: ~126 LOC  
**Última Wave**: WAVE 25.6

#### Estado de Conexión

- Usa `useTruthSystem()` y `useTruthConnected()` - ✅ CORRECTO
- Layout: Grid asimétrico 1-2-1 - ✅ FUNCIONAL

#### ⚠️ PROBLEMAS DETECTADOS

1. **Header Stats Incompletos**
   ```tsx
   // Solo muestra: FPS, Brain, Mode
   // Podría mostrar: Fixtures Active, DMX Status, Consciousness ON/OFF
   ```

2. **CSS Obsoleto**
   - Usa emojis como iconos (`📊`, `📜`)
   - Estilo no coincide con ForgeView/StageConstructor

3. **Sin Sub-Paneles Nuevos**
   - El layout es rígido
   - No hay espacio para: EffectsDNA, Ethics Status, Movement Pattern

---

## 📊 MAPA DE FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Electron Main)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────┐    ┌──────────────────────────┐          │
│  │   TitanOrchestrator      │    │   SeleneTitanConscious   │          │
│  │   ━━━━━━━━━━━━━━━━━━━━   │    │   ━━━━━━━━━━━━━━━━━━━━   │          │
│  │   - mode, vibe           │    │   - ai.huntState         │          │
│  │   - brainStatus          │    │   - ai.confidence        │          │
│  │   - fps, uptime          │    │   - ai.prediction        │          │
│  └───────────┬──────────────┘    │   - ai.beautyScore       │          │
│              │                   │   - ai.biasesDetected    │          │
│              │                   └───────────┬──────────────┘          │
│              │                               │                          │
│  ┌───────────┴───────────────────────────────┴──────────────┐          │
│  │                    SeleneTruth                            │          │
│  │  ┌─────────┬─────────────┬─────────────┬─────────────┐   │          │
│  │  │ system  │  sensory    │consciousness│   intent    │   │          │
│  │  │         │             │             │             │   │          │
│  │  │ mode    │ audio.bass  │ ai.*        │ palette.*   │   │          │
│  │  │ vibe    │ audio.mid   │ mood        │ movement.*  │   │          │
│  │  │ fps     │ audio.high  │ zodiac.*    │ effects.*   │   │          │
│  │  │ brain   │ beat.*      │ dream.*     │ intensity   │   │          │
│  │  └─────────┴─────────────┴─────────────┴─────────────┘   │          │
│  └────────────────────────────┬──────────────────────────────┘          │
│                               │                                         │
│                    IPC: selene:truth @ 30fps                           │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Renderer)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────┐                                          │
│  │       truthStore         │ ◄─── useSeleneTruth() (1x en App.tsx)    │
│  │   (Zustand Store)        │                                          │
│  └───────────┬──────────────┘                                          │
│              │                                                          │
│   ┌──────────┼──────────┬───────────┬───────────┬───────────┐          │
│   │          │          │           │           │           │          │
│   ▼          ▼          ▼           ▼           ▼           ▼          │
│ ┌─────┐  ┌──────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌─────────┐    │
│ │Hunt │  │Audio │  │Musical │  │Palette │  │Tactical│  │  Otros  │    │
│ │Monit│  │Scope │  │  DNA   │  │Preview │  │  Log   │  │Componts │    │
│ └──┬──┘  └──┬───┘  └───┬────┘  └───┬────┘  └───┬────┘  └────┬────┘    │
│    │        │          │           │           │            │          │
│    │        │          │           │           │            │          │
│    ▼        ▼          ▼           ▼           ▼            ▼          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                         UI RENDER                             │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗑️ PROPUESTA DE PURGA

### Código a Eliminar

1. **HuntMonitor.tsx**
   - Líneas 40-48: Botones `forceMutate`, `resetMemory` si IPCs no existen
   
2. **AudioOscilloscope.tsx**  
   - Línea 32: Eliminar `trend: 'stable' as const` (implementar real o quitar)

3. **MusicalDNAPanel.tsx**
   - Líneas 42-58: Simplificar lógica de Zodiac (mostrar solo si tiene impacto)
   - Línea 76-78: Clarificar fuente de mood

4. **TacticalLog.tsx**
   - Líneas 17-38: Actualizar `LOG_CONFIG` con categorías modernas
   - Línea 10: Reemplazar Lucide imports con LuxIcons

### IPCs a Verificar en `preload.ts`

```typescript
// Verificar existencia de:
window.lux?.forceMutate?.()   // ¿Existe?
window.lux?.resetMemory?.()   // ¿Existe?
```

### Datos Obsoletos en Backend

El `TitanOrchestrator.log()` necesita emitir más eventos:
- Cambios de efecto activo
- Mutaciones de EffectDNA
- Decisiones del DreamEngine
- Vetos de Ethics
- Cambios de movimiento
- Eventos de física

---

## 📈 MÉTRICAS DE IMPACTO

| Archivo | LOC Actual | LOC Estimado Post-Rediseño | Cambio |
|---------|------------|---------------------------|--------|
| HuntMonitor.tsx | 200 | 350+ | +75% |
| AudioOscilloscope.tsx | 130 | 250+ | +92% |
| MusicalDNAPanel.tsx | 190 | 280+ | +47% |
| PalettePreview.tsx | 100 | 150 | +50% |
| TacticalLog.tsx | 230 | 300+ | +30% |
| LuxCoreView/index.tsx | 126 | 180 | +43% |
| **CSS combinado** | ~800 | ~1200 | +50% |

---

## ✅ CONCLUSIÓN

El módulo de telemetría fue diseñado para un sistema más simple. Ahora que Selene tiene:

- **4+ motores cognitivos** (Hunt, Dream, Ethics, Evolution)
- **7 bandas de frecuencia** (no 3)
- **Sistema de efectos con DNA**
- **Physics con velocidad/aceleración**
- **BPM detection con confidence real**

...el módulo necesita un **rediseño total** para reflejar la complejidad real del sistema.

**Siguiente paso**: Ver `WAVE-1167-TELEMETRY-BLUEPRINT.md` para el rediseño propuesto.

---

*Auditoría completada por PunkOpus - "La verdad antes del código"*
