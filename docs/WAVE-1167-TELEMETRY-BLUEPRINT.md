# 🏗️ WAVE 1167: BLUEPRINT - SELENE NEURAL COMMAND CENTER

## CODENAME: "NEURAL COMMAND"

**Fecha**: 4 Febrero 2026  
**Arquitecto**: PunkOpus  
**Stakeholder**: Radwulf  
**Objetivo**: Rediseño total del módulo de telemetría para reflejar la complejidad real del sistema TITAN 2.0

---

## 🎯 VISIÓN

Transformar la "Central de Monitoreo" de un panel legacy con métricas desconectadas en un **Neural Command Center** que muestre en tiempo real el funcionamiento interno de Selene de forma que **cualquier DJ o técnico de luces pueda entender**.

### Principios de Diseño

1. **LEGIBILIDAD** > Densidad de datos
2. **VISUALIZACIÓN** > Números crudos
3. **CONTEXTO** > Valores aislados
4. **COHERENCIA** con ForgeView/StageConstructor/CalibrationView

---

## 🖼️ NUEVO LAYOUT: NEURAL COMMAND CENTER

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧠 NEURAL COMMAND                          ● ONLINE  │  60 FPS  │  FLOW    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐ ┌─────────────────────────────────────────────┐   │
│  │                     │ │                                             │   │
│  │   AUDIO SPECTRUM    │ │              CONSCIOUSNESS HUD              │   │
│  │   ═══════════════   │ │              ═════════════════              │   │
│  │                     │ │                                             │   │
│  │  ▓▓▓  ▓▓▓  ▓▓  ▓▓▓  │ │  ┌───────────────┐  ┌─────────────────┐   │   │
│  │  ▓▓▓  ▓▓▓  ▓▓  ▓▓▓  │ │  │   AI STATE    │  │   DREAM FORGE   │   │   │
│  │  ███  ███  ██  ███  │ │  │   ─────────   │  │   ───────────   │   │   │
│  │  ███  ███  ██  ███  │ │  │   🐱 STALKING │  │   💭 Palette... │   │   │
│  │  ███  ███  ██  ███  │ │  │   ████████░░  │  │   Beauty: 0.72  │   │   │
│  │  SUB  BAS MID HIGH  │ │  └───────────────┘  └─────────────────┘   │   │
│  │                     │ │                                             │   │
│  │  ┌────────────────┐ │ │  ┌───────────────┐  ┌─────────────────┐   │   │
│  │  │ BPM: 128  ████ │ │ │  │   ETHICS      │  │   PREDICTION    │   │   │
│  │  │ CONF: 94%      │ │ │  │   ──────      │  │   ──────────    │   │   │
│  │  └────────────────┘ │ │  │   ✅ SAFE     │  │   ⚡ DROP: 71%  │   │   │
│  │                     │ │  │   Strobe: OK  │  │   in ~4 beats   │   │   │
│  └─────────────────────┘ │  └───────────────┘  └─────────────────┘   │   │
│                          └─────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────┐  ┌────────────────────────────┐  │
│  │                                      │  │                            │  │
│  │          CHROMATIC CORE              │  │      CONTEXT MATRIX        │  │
│  │          ══════════════              │  │      ══════════════        │  │
│  │                                      │  │                            │  │
│  │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │  │   KEY: C Major             │  │
│  │   │ PRI │ │ SEC │ │ AMB │ │ ACC │   │  │   SECTION: Build           │  │
│  │   │     │ │     │ │     │ │     │   │  │   VIBE: Techno Club        │  │
│  │   │#FF0 │ │#0FF │ │#F0F │ │#FFF │   │  │   MOOD: Energetic          │  │
│  │   └─────┘ └─────┘ └─────┘ └─────┘   │  │   TEMP: 6500K              │  │
│  │   STRATEGY: HARMONIC TRIAD          │  │   SYNCO: 23%               │  │
│  │                                      │  │                            │  │
│  └──────────────────────────────────────┘  └────────────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ▸ NEURAL STREAM   ▸ SYSTEM LOGS                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 14:32:05.234  🧠 BRAIN   Switched to STALKING - energy rising       │   │
│  │ 14:32:05.456  💭 DREAM   Simulating: Palette warm shift (φ: 0.72)   │   │
│  │ 14:32:05.678  ⚡ EFFECT  Selected: TidalWave (DNA: 0.89 fitness)    │   │
│  │ 14:32:06.123  🎯 STRIKE  EXECUTED: Color change to #FF4400          │   │
│  │ 14:32:06.234  🛡️ ETHICS  Strobe rate limited (safety threshold)     │   │
│  │ 14:32:07.000  🎵 BEAT    DROP DETECTED - Sustain phase active       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 NUEVOS COMPONENTES

### 1. `AudioSpectrumPanel` (Reemplaza AudioOscilloscope)

**Nueva ruta**: `src/components/telemetry/AudioSpectrumPanel/`

#### Características

- **7 bandas de frecuencia**: Sub-Bass, Bass, Low-Mid, Mid, High-Mid, Presence, Brilliance
- **Waveform visual** animada (no solo barras)
- **BPM gauge circular** con confidence arc
- **Beat pulse** sincronizado con el beat real
- **Energy trend** con flecha direccional

#### Datos del truthStore

```typescript
// Mapeo de datos
const spectrum = {
  subBass: sensory.audio.bass * 0.6,      // 20-60Hz
  bass: sensory.audio.bass,                // 60-250Hz
  lowMid: sensory.audio.mid * 0.7,         // 250-500Hz
  mid: sensory.audio.mid,                  // 500Hz-2kHz
  highMid: sensory.audio.mid * 1.2,        // 2-4kHz
  presence: sensory.audio.high * 0.8,      // 4-6kHz
  brilliance: sensory.audio.high,          // 6-20kHz
}

const beat = {
  bpm: sensory.beat.bpm,
  confidence: sensory.beat.confidence,
  onBeat: sensory.beat.onBeat,
  phase: sensory.beat.beatPhase,
}
```

#### Diseño Visual

```
┌──────────────────────────────────────┐
│  🎵 AUDIO SPECTRUM            ◉ LIVE │
├──────────────────────────────────────┤
│                                      │
│   ▓▓   ▓▓▓   ▓▓   ▓▓▓   ▓▓   ▓   ▓  │
│   ▓▓   ███   ▓▓   ███   ▓▓   ▓   ▓  │
│   ██   ███   ██   ███   ██   █   █  │
│   ██   ███   ██   ███   ██   █   █  │
│   ██   ███   ██   ███   ██   █   █  │
│   ▬▬   ▬▬▬   ▬▬   ▬▬▬   ▬▬   ▬   ▬  │
│   SUB  BAS  L-M   MID  H-M  PRS BRL │
│                                      │
│   ┌──────────────────────────────┐   │
│   │  ╭───╮    BPM         CONF   │   │
│   │  │128│    ████████░░  94%    │   │
│   │  ╰───╯                       │   │
│   └──────────────────────────────┘   │
│                                      │
│   ENERGY ████████████░░░░░░  67% ↗   │
│                                      │
└──────────────────────────────────────┘
```

---

### 2. `ConsciousnessHUD` (Reemplaza HuntMonitor)

**Nueva ruta**: `src/components/telemetry/ConsciousnessHUD/`

#### Características

- **AI State Panel**: Estado actual del cerebro (Sleeping/Stalking/Evaluating/Striking/Learning)
- **Dream Forge Monitor**: Qué está "imaginando" Selene
- **Ethics Dashboard**: Estado de seguridad visual
- **Prediction Display**: Predicciones activas con countdown

#### Sub-componentes

```
ConsciousnessHUD/
├── index.tsx
├── ConsciousnessHUD.css
├── AIStateCard.tsx         # Estado de caza
├── DreamForgeCard.tsx      # Sueños y simulaciones
├── EthicsCard.tsx          # Límites de seguridad
├── PredictionCard.tsx      # Predicciones activas
└── index.ts
```

#### Datos del truthStore

```typescript
const ai = consciousness.ai
const dream = consciousness.dream
const ethicsViolations = consciousness.ai.biasesDetected
const prediction = consciousness.ai.prediction
```

#### Diseño Visual

```
┌──────────────────────────────────────────────────────┐
│  🧠 CONSCIOUSNESS                   ● AI: ACTIVE     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐   │
│  │ 🐱 AI STATE         │  │ 💭 DREAM FORGE      │   │
│  │ ═══════════════════ │  │ ═══════════════════ │   │
│  │                     │  │                     │   │
│  │ Mode: STALKING      │  │ Status: SIMULATING  │   │
│  │ ████████████░░░░ 78%│  │                     │   │
│  │                     │  │ Type: Palette Shift │   │
│  │ Reason:             │  │ Thought:            │   │
│  │ "Energy rising,     │  │ "Warm to cool       │   │
│  │  preparing strike"  │  │  would feel right"  │   │
│  │                     │  │                     │   │
│  │ Beauty: φ 1.342     │  │ Projected: 0.72     │   │
│  │ Trend: ↗ Rising     │  │ Recommendation:     │   │
│  │                     │  │ ✅ EXECUTE          │   │
│  └─────────────────────┘  └─────────────────────┘   │
│                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐   │
│  │ 🛡️ ETHICS           │  │ 🔮 PREDICTION       │   │
│  │ ═══════════════════ │  │ ═══════════════════ │   │
│  │                     │  │                     │   │
│  │ ✅ Strobe: SAFE     │  │ ⚡ DROP INCOMING    │   │
│  │ ✅ Flashing: OK     │  │                     │   │
│  │ ✅ Intensity: OK    │  │ Probability: 71%    │   │
│  │                     │  │ ETA: ~4 beats       │   │
│  │ Override: NONE      │  │                     │   │
│  │                     │  │ Preparing:          │   │
│  │ Biases: 0 detected  │  │ Intensity boost     │   │
│  └─────────────────────┘  └─────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### 3. `ChromaticCorePanel` (Evolución de PalettePreview)

**Nueva ruta**: `src/components/telemetry/ChromaticCorePanel/`

#### Características

- **Color swatches grandes** con hex/hue
- **Strategy indicator** con explicación
- **Color wheel mini** mostrando relación armónica
- **Strobe indicator** cuando activo

#### Diseño Visual

```
┌──────────────────────────────────────┐
│  🎨 CHROMATIC CORE         HARMONIC  │
├──────────────────────────────────────┤
│                                      │
│   ┌──────┐  ┌──────┐  ┌──────┐      │
│   │      │  │      │  │      │      │
│   │ ████ │  │ ████ │  │ ████ │      │
│   │      │  │      │  │      │      │
│   │#FF4400│  │#00FFAA│  │#AA00FF│      │
│   │PRIMARY│  │SECOND │  │ACCENT │      │
│   │ 28°   │  │ 162°  │  │ 280°  │      │
│   └──────┘  └──────┘  └──────┘      │
│                                      │
│   STRATEGY: Harmonic Triad (120°)    │
│   TEMP: 6500K ████████░░ Daylight    │
│                                      │
└──────────────────────────────────────┘
```

---

### 4. `ContextMatrixPanel` (Evolución de MusicalDNAPanel)

**Nueva ruta**: `src/components/telemetry/ContextMatrixPanel/`

#### Características

- **Key detection** con indicador visual
- **Section tracker** con progress
- **Vibe indicator** con icono
- **Mood synthesis** 
- **Syncopation meter**
- **SIN ZODIAC** (movido a settings o eliminado)

#### Diseño Visual

```
┌──────────────────────────────────────┐
│  📊 CONTEXT MATRIX                   │
├──────────────────────────────────────┤
│                                      │
│   KEY         SECTION                │
│   ┌─────────┐ ┌─────────────────────┐│
│   │  C Maj  │ │ BUILD       ████░░░ ││
│   │   ♪     │ │ Next: Drop  ~8 bars ││
│   └─────────┘ └─────────────────────┘│
│                                      │
│   VIBE                MOOD           │
│   ┌─────────────────┐ ┌─────────────┐│
│   │ ⚡ Techno Club  │ │ ENERGETIC   ││
│   └─────────────────┘ └─────────────┘│
│                                      │
│   SYNCOPATION    TEMP                │
│   ████░░░░░░ 23% 6500K ☀️           │
│                                      │
└──────────────────────────────────────┘
```

---

### 5. `NeuralStreamLog` (Evolución de TacticalLog)

**Nueva ruta**: `src/components/telemetry/NeuralStreamLog/`

#### Nuevas Categorías

```typescript
const LOG_CATEGORIES = {
  // CONSCIOUSNESS
  Brain: { icon: BrainIcon, color: '#fbbf24', label: 'BRAIN' },
  Dream: { icon: DreamIcon, color: '#a855f7', label: 'DREAM' },
  Ethics: { icon: ShieldIcon, color: '#22c55e', label: 'ETHICS' },
  Strike: { icon: LightningIcon, color: '#ef4444', label: 'STRIKE' },
  
  // EFFECTS
  Effect: { icon: SparkleIcon, color: '#ec4899', label: 'EFFECT' },
  Color: { icon: PaletteIcon, color: '#06b6d4', label: 'COLOR' },
  Movement: { icon: MoveIcon, color: '#f97316', label: 'MOVE' },
  
  // AUDIO
  Beat: { icon: DrumIcon, color: '#22c55e', label: 'BEAT' },
  Drop: { icon: WaveIcon, color: '#ff0040', label: 'DROP' },
  Section: { icon: LayersIcon, color: '#8b5cf6', label: 'SECTION' },
  
  // SYSTEM
  System: { icon: CogIcon, color: '#64748b', label: 'SYS' },
  DMX: { icon: LightbulbIcon, color: '#14b8a6', label: 'DMX' },
  Error: { icon: AlertIcon, color: '#ef4444', label: 'ERROR' },
}
```

#### Nuevas Features

- **Timestamps relativos**: "hace 2s" en lugar de timestamp absoluto
- **Log grouping**: Agrupar logs del mismo tipo en un periodo
- **Syntax highlighting**: Valores numéricos coloreados
- **Copy to clipboard**: Click en log para copiar
- **Fullscreen mode**: Expandir a pantalla completa

---

## 🎨 SISTEMA DE ICONOS CUSTOM

### Nuevos iconos para `LuxIcons.tsx`

```typescript
// CONSCIOUSNESS ICONS
export const BrainNeuralIcon      // Cerebro con sinapsis
export const DreamCloudIcon       // Nube con estrellas
export const ShieldCheckIcon      // Escudo con check
export const CatStalkIcon         // Gato en posición de caza
export const LightningStrikeIcon  // Rayo impactando

// AUDIO ICONS  
export const SpectrumBarsIcon     // Barras de frecuencia
export const WaveformIcon         // Onda sinusoidal
export const BPMHeartIcon         // Corazón latiendo con BPM
export const DropImpactIcon       // Gota impactando

// CONTEXT ICONS
export const MusicalKeyIcon       // Llave con nota musical
export const SectionFlowIcon      // Flujo de secciones
export const VibeAuraIcon         // Aura energética
export const ThermoIcon           // Termómetro de color

// UTILITY ICONS
export const LiveDotIcon          // Punto pulsante LIVE
export const TrendUpIcon          // Flecha diagonal arriba
export const TrendDownIcon        // Flecha diagonal abajo
export const TrendStableIcon      // Flecha horizontal
```

### Ejemplo de Implementación

```tsx
/**
 * 🐱 CAT STALK ICON - Gata en modo stalking
 */
export const CatStalkIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = 'currentColor',
  className = '' 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Cuerpo agachado */}
    <ellipse cx="12" cy="16" rx="8" ry="4" fill={color} opacity="0.3" />
    {/* Cabeza */}
    <circle cx="18" cy="12" r="4" fill={color} />
    {/* Orejas */}
    <path d="M16 8L14 6L15 9Z" fill={color} />
    <path d="M20 8L22 6L21 9Z" fill={color} />
    {/* Ojos (alertas) */}
    <circle cx="17" cy="11" r="1" fill="#00ff00" />
    <circle cx="19" cy="11" r="1" fill="#00ff00" />
    {/* Cola arqueada */}
    <path d="M4 14Q6 10 8 14" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)
```

---

## 🎨 SISTEMA CSS

### Variables Globales (añadir a `globals.css`)

```css
:root {
  /* NEURAL COMMAND COLORS */
  --neural-bg: #0a0a0f;
  --neural-card: rgba(15, 20, 30, 0.8);
  --neural-border: rgba(255, 255, 255, 0.08);
  --neural-glow: rgba(139, 92, 246, 0.3);
  
  /* CONSCIOUSNESS COLORS */
  --state-sleeping: #64748b;
  --state-stalking: #f97316;
  --state-evaluating: #fbbf24;
  --state-striking: #ef4444;
  --state-learning: #a855f7;
  
  /* CATEGORY COLORS */
  --cat-brain: #fbbf24;
  --cat-dream: #a855f7;
  --cat-ethics: #22c55e;
  --cat-strike: #ef4444;
  --cat-effect: #ec4899;
  --cat-color: #06b6d4;
  --cat-beat: #22c55e;
  --cat-drop: #ff0040;
  
  /* GLASSMORPHISM */
  --glass-bg: rgba(15, 20, 30, 0.6);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-blur: 12px;
}
```

### Componente Base Card

```css
.neural-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
  backdrop-filter: blur(var(--glass-blur));
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.neural-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--neural-border);
}

.neural-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
}

.neural-card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.5);
}

.neural-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse-live 2s ease-in-out infinite;
}

@keyframes pulse-live {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
  50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
}
```

### Gauge Component

```css
.neural-gauge {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.neural-gauge-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(90deg, var(--gauge-start), var(--gauge-end));
  box-shadow: 0 0 10px var(--gauge-glow);
}

.neural-gauge-threshold {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.3);
}
```

---

## 📁 ESTRUCTURA DE ARCHIVOS FINAL

```
src/components/
├── telemetry/
│   ├── index.ts                      # Re-exports
│   │
│   ├── AudioSpectrumPanel/
│   │   ├── index.ts
│   │   ├── AudioSpectrumPanel.tsx
│   │   ├── AudioSpectrumPanel.css
│   │   ├── FrequencyBars.tsx         # Sub-componente barras
│   │   ├── BPMGauge.tsx              # Sub-componente BPM
│   │   └── EnergyMeter.tsx           # Sub-componente energía
│   │
│   ├── ConsciousnessHUD/
│   │   ├── index.ts
│   │   ├── ConsciousnessHUD.tsx
│   │   ├── ConsciousnessHUD.css
│   │   ├── AIStateCard.tsx
│   │   ├── DreamForgeCard.tsx
│   │   ├── EthicsCard.tsx
│   │   └── PredictionCard.tsx
│   │
│   ├── ChromaticCorePanel/
│   │   ├── index.ts
│   │   ├── ChromaticCorePanel.tsx
│   │   ├── ChromaticCorePanel.css
│   │   └── ColorSwatch.tsx
│   │
│   ├── ContextMatrixPanel/
│   │   ├── index.ts
│   │   ├── ContextMatrixPanel.tsx
│   │   └── ContextMatrixPanel.css
│   │
│   └── NeuralStreamLog/
│       ├── index.ts
│       ├── NeuralStreamLog.tsx
│       ├── NeuralStreamLog.css
│       └── LogEntry.tsx
│
├── views/
│   └── NeuralCommandView/            # Renombrado de LuxCoreView
│       ├── index.tsx
│       ├── NeuralCommandView.css
│       └── ViewHeader.tsx
│
└── icons/
    └── LuxIcons.tsx                  # +15 nuevos iconos
```

---

## 🔌 BACKEND: LOGS ADICIONALES NECESARIOS

Para alimentar el NeuralStreamLog, el backend necesita emitir más eventos:

### TitanOrchestrator.ts - Añadir

```typescript
// En el loop principal, cuando cambia efecto:
this.log('Effect', `Selected: ${effectName}`, { 
  dnaFitness: effect.fitness,
  vibe: this.currentVibe 
})

// Cuando DreamEngine toma decisión:
this.log('Dream', `${dream.currentType}: "${dream.currentThought}"`, {
  projectedBeauty: dream.projectedBeauty,
  recommendation: dream.lastRecommendation
})

// Cuando Ethics interviene:
this.log('Ethics', `${violation.type} limited`, {
  reason: violation.reason,
  threshold: violation.threshold
})

// Cuando hay predicción:
this.log('Prediction', `${prediction.type} - ${prediction.probability}%`, {
  eta: prediction.timeMs,
  action: prediction.preparedAction
})

// En cambio de sección:
this.log('Section', `Transition: ${prev} → ${next}`, {
  confidence: section.confidence
})
```

---

## 📋 PLAN DE IMPLEMENTACIÓN

### Fase 1: Preparación (1-2 horas) ✅ COMPLETADA
- [x] Crear estructura de carpetas
- [x] Añadir nuevos iconos a `LuxIcons.tsx` (+21 iconos)
- [x] Añadir variables CSS globales (+300 líneas)
- **Commit**: `fe24a8c` - 4 Feb 2026

### Fase 2: Componentes Core (3-4 horas) ✅ COMPLETADA
- [x] Implementar `AudioSpectrumPanel` (6 archivos)
- [x] Implementar `ConsciousnessHUD` con sub-cards (6 archivos)
- [x] Implementar `ChromaticCorePanel` (3 archivos)
- [x] Implementar `ContextMatrixPanel` (3 archivos)
- **Total**: 18 archivos nuevos - 5 Feb 2026

### Fase 3: Logger (1-2 horas)
- [ ] Implementar `NeuralStreamLog`
- [ ] Actualizar categorías de log
- [ ] Implementar timestamps relativos

### Fase 4: Container (1 hora)
- [ ] Renombrar `LuxCoreView` → `NeuralCommandView`
- [ ] Actualizar layout y routing
- [ ] Actualizar header con nuevos stats

### Fase 5: Backend Enhancement (1 hora)
- [ ] Añadir logs adicionales en TitanOrchestrator
- [ ] Verificar IPCs de control (forceMutate, etc)

### Fase 6: Polish (1-2 horas)
- [ ] Responsive adjustments
- [ ] Animaciones y transiciones
- [ ] Testing visual

### Fase 7: Legacy Purge 🗑️ (30 min)
- [ ] Eliminar `AudioOscilloscope/` completo
- [ ] Eliminar `HuntMonitor/` completo
- [ ] Eliminar `MusicalDNAPanel/` completo  
- [ ] Eliminar `PalettePreview/` completo
- [ ] Eliminar `LuxCoreView/TacticalLog.tsx`
- [ ] Eliminar `LuxCoreView/` (tras migrar a NeuralCommandView)
- [ ] Limpiar imports huérfanos en `telemetry/index.ts`
- [ ] Verificar que no hay referencias rotas

**Tiempo total estimado**: 9-13 horas

---

## 🎯 CRITERIOS DE ÉXITO

1. ✅ Cualquier DJ puede entender qué está pasando en 5 segundos
2. ✅ Los 4 motores cognitivos están representados visualmente
3. ✅ Las 7 bandas de frecuencia están visibles
4. ✅ El BPM confidence es obvio visualmente
5. ✅ Los logs cuentan una historia coherente del sistema
6. ✅ El estilo visual es coherente con ForgeView/StageConstructor
7. ✅ Cero iconos genéricos (Lucide) - todo custom
8. ✅ Performance: <5ms render time por frame

---

*Blueprint diseñado por PunkOpus para Radwulf - "El código es poesía, la UI es el verso que el usuario lee"*
