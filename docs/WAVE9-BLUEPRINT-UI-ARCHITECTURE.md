# 🎨 WAVE 9: BLUEPRINT - UI ARCHITECTURE

## Commander Layout - Arquitectura de Componentes

**Fecha**: Diciembre 2025  
**Versión**: 1.0  
**Companion**: [WAVE9-BLUEPRINT-UI-MOCKUPS.md](./WAVE9-BLUEPRINT-UI-MOCKUPS.md)

---

## 📋 RESUMEN EJECUTIVO

**Misión**: Transformar componentes UI sueltos en una aplicación de escritorio profesional tipo "Commander Layout" con Sidebar + Tabs.

**Filosofía de Diseño**: 
> "Un DJ no mira menús, mira el escenario. La UI debe ser invisible hasta que la necesites."

**Inspiración**: Ableton Live + TouchDesigner + Resolume Arena

---

## 🌳 ÁRBOL DE COMPONENTES REACT

```
App.tsx
│
├── providers/
│   ├── <NavigationProvider>        # Estado de navegación (Zustand)
│   ├── <SeleneProvider>            # Estado de Selene Lux
│   ├── <AudioProvider>             # Estado de audio/BPM
│   ├── <DMXProvider>               # Estado DMX
│   └── <KeyboardProvider>          # Listener global de teclado
│
└── <MainLayout>
    │
    ├── <Sidebar>
    │   ├── <Logo />                 # Animado según modo
    │   ├── <NavigationTabs>
    │   │   ├── <NavTab icon="🎛️" label="LIVE" />
    │   │   ├── <NavTab icon="🔭" label="SIMULATE" />
    │   │   ├── <NavTab icon="🧠" label="SELENE LUX" />
    │   │   └── <NavTab icon="⚙️" label="SETUP" />
    │   │
    │   └── <StatusPanel>
    │       ├── <BPMDisplay />       # ♪ 128.0 BPM
    │       ├── <DMXStatus />        # ◉ DMX OK / ⊘ Disconnected
    │       ├── <AudioLevel />       # 🎤 -12dB (mini VU meter)
    │       └── <SeleneStatus />     # 🌙 Active / Learning
    │
    ├── <ContentArea>
    │   │
    │   ├── {activeTab === 'live' && <LiveView />}
    │   ├── {activeTab === 'simulate' && <SimulateView />}
    │   ├── {activeTab === 'selene' && <SeleneLuxView />}
    │   └── {activeTab === 'setup' && <SetupView />}
    │
    └── <GlobalEffectsBar>           # Siempre visible abajo
        ├── <EffectButton key="strobe" />
        ├── <EffectButton key="blinder" />
        ├── <EffectButton key="smoke" />
        ├── <EffectButton key="laser" />
        ├── <EffectButton key="rainbow" />
        ├── <EffectButton key="police" />
        └── <BlackoutMaster />       # El más importante
```

---

## 📱 COMPONENTES POR VISTA

### VISTA 1: LiveView

```
<LiveView>
├── <ModeSelector>
│   ├── <ModeButton mode="flow" />
│   ├── <ModeButton mode="selene" />
│   └── <ModeButton mode="locked" />
│
├── <LivePanels>  {/* CSS Grid 2 columns */}
│   │
│   ├── <PaletteReactor>
│   │   ├── <PaletteGrid>
│   │   │   └── <PaletteCard /> × 4
│   │   └── <GlobalSliders>
│   │       ├── <Slider label="Saturation" />
│   │       └── <Slider label="Intensity" />
│   │
│   └── <BrainPreview>  {/* Mini vista del estado del Brain */}
│       ├── <BrainModeIndicator />
│       ├── <BeautyMeter />
│       ├── <ConfidenceMeter />
│       └── <QuickStats />
│
└── <MovementControl>
    ├── <PatternSelector>
    │   └── <PatternButton /> × 6
    ├── <MovementSliders>
    │   ├── <Slider label="Speed" />
    │   └── <Slider label="Range" />
    └── <XYPreviewGrid>
        └── <FixturePosition /> {/* Animated dot */}
```

### VISTA 2: SimulateView

```
<SimulateView>
├── <StageCanvas>  {/* WebGL/Canvas2D */}
│   ├── <Truss />           {/* Estructura superior */}
│   ├── <MovingHead /> × N  {/* Cada fixture con physics */}
│   ├── <ParCan /> × N
│   ├── <LightBeam /> × N   {/* Rayos de luz */}
│   ├── <Floor />           {/* Reflejo/absorción */}
│   └── <HazeParticles />   {/* Humo opcional */}
│
├── <FixtureList>
│   └── <FixtureRow /> × N
│
└── <SimulatorControls>
    ├── <ToggleButton label="Show Beams" />
    ├── <ToggleButton label="Show Grid" />
    ├── <ToggleButton label="Add Haze" />
    └── <Button label="Screenshot" />
```

### VISTA 3: SeleneLuxView

```
<SeleneLuxView>
├── <TopPanels>  {/* Grid 2 columns */}
│   │
│   ├── <ConsciousnessState>
│   │   ├── <NeuralActivityGraph>  {/* Canvas animado */}
│   │   └── <StatusInfo>
│   │       ├── <StatusBadge />
│   │       ├── <ModeIndicator />
│   │       └── <BeautyAverage />
│   │
│   └── <MemoryStats>
│       ├── <StatRow label="Total Patterns" />
│       ├── <StatRow label="This Session" />
│       ├── <MemoryUsageBar />
│       └── <MemoryActions>
│           ├── <Button>Cleanup</Button>
│           └── <Button>Backup</Button>
│
├── <RealTimeMetrics>
│   ├── <MetricBar label="Confidence" />
│   ├── <MetricBar label="Energy" />
│   ├── <MetricBar label="Beauty" />
│   └── <BPMSlider />
│
└── <DecisionLog>
    ├── <LogHeader>
    │   └── <FilterDropdown />
    ├── <LogEntries>  {/* Virtualized list */}
    │   └── <LogEntry /> × N
    └── <LogActions>
        ├── <Button>Pause</Button>
        ├── <Button>Clear</Button>
        └── <Button>Export</Button>
```

### VISTA 4: SetupView

```
<SetupView>
├── <SetupProgress>
│   └── <ProgressStep /> × 4
│
├── <SetupWizard>
│   │
│   ├── {step === 1 && <AudioSetup />}
│   │   ├── <DeviceList type="audio-input" />
│   │   ├── <AudioLevelMeter />
│   │   └── <SensitivitySlider />
│   │
│   ├── {step === 2 && <DMXSetup />}
│   │   ├── <InterfaceList />
│   │   ├── <UniverseSelector />
│   │   └── <FrameRateSelector />
│   │
│   ├── {step === 3 && <FixturePatch />}
│   │   ├── <FixtureLibrary />
│   │   ├── <PatchTable />
│   │   └── <AddressCalculator />
│   │
│   └── {step === 4 && <SystemTest />}
│       ├── <TestSequence />
│       └── <ResultsSummary />
│
├── <QuickStatus>
│   └── <StatusRow /> × 4
│
└── <WizardNavigation>
    ├── <Button>Back</Button>
    └── <Button>Next</Button>
```

---

## 🎹 GESTIÓN DE TECLADO GLOBAL

### KeyBindings

```typescript
// hooks/useGlobalKeyboard.ts

interface KeyBindings {
  // Efectos (funcionan en todas las vistas)
  '1': () => toggleEffect('strobe'),
  '2': () => toggleEffect('blinder'),
  '3': () => toggleEffect('smoke'),
  '4': () => toggleEffect('laser'),
  '5': () => toggleEffect('rainbow'),
  '6': () => toggleEffect('police'),
  
  // CRÍTICO: Blackout siempre disponible
  'Space': () => toggleBlackout(),
  
  // Navegación
  'Tab': () => nextTab(),
  'Shift+Tab': () => prevTab(),
  
  // Live view específico
  'Q': () => setMode('flow'),
  'W': () => setMode('selene'),
  'E': () => setMode('locked'),
  
  // Paletas (si está en Live)
  'Z': () => selectPalette(0),
  'X': () => selectPalette(1),
  'C': () => selectPalette(2),
  'V': () => selectPalette(3),
}

// Siempre activo, incluso con modales abiertos
const GLOBAL_KEYS = ['Space', '1', '2', '3', '4', '5', '6'];
```

### Implementación KeyboardProvider

```typescript
// providers/KeyboardProvider.tsx

export const KeyboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toggleBlackout, toggleEffect } = useEffects()
  const { activeTab, setActiveTab } = useNavigation()
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Blackout SIEMPRE funciona
      if (e.code === 'Space' && !isTypingInInput(e)) {
        e.preventDefault()
        toggleBlackout()
        return
      }
      
      // Efectos 1-6 SIEMPRE funcionan
      if (['1','2','3','4','5','6'].includes(e.key)) {
        toggleEffect(EFFECT_MAP[e.key])
        return
      }
      
      // Navegación
      if (e.code === 'Tab') {
        e.preventDefault()
        setActiveTab(e.shiftKey ? prevTab(activeTab) : nextTab(activeTab))
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab])
  
  return <>{children}</>
}
```

---

## 🗃️ GESTIÓN DE ESTADO (Zustand)

### Navigation Store

```typescript
// stores/navigationStore.ts
import { create } from 'zustand'

type TabId = 'live' | 'simulate' | 'selene' | 'setup'

interface NavigationState {
  activeTab: TabId
  previousTab: TabId | null
  
  // Actions
  setActiveTab: (tab: TabId) => void
  goBack: () => void
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  activeTab: 'live',
  previousTab: null,
  
  setActiveTab: (tab) => set({ 
    previousTab: get().activeTab, 
    activeTab: tab 
  }),
  
  goBack: () => {
    const { previousTab } = get()
    if (previousTab) set({ activeTab: previousTab, previousTab: null })
  },
}))
```

### Effects Store

```typescript
// stores/effectsStore.ts
import { create } from 'zustand'

interface EffectsState {
  blackout: boolean
  activeEffects: Set<string>
  
  // Actions
  toggleBlackout: () => void
  toggleEffect: (effect: string) => void
  clearAllEffects: () => void
}

export const useEffectsStore = create<EffectsState>((set, get) => ({
  blackout: false,
  activeEffects: new Set(),
  
  toggleBlackout: () => set((state) => ({ 
    blackout: !state.blackout,
    // Blackout desactiva todo lo demás
    activeEffects: state.blackout ? state.activeEffects : new Set()
  })),
  
  toggleEffect: (effect) => set((state) => {
    const newEffects = new Set(state.activeEffects)
    if (newEffects.has(effect)) {
      newEffects.delete(effect)
    } else {
      newEffects.add(effect)
    }
    return { activeEffects: newEffects }
  }),
  
  clearAllEffects: () => set({ activeEffects: new Set() }),
}))
```

### Selene Store

```typescript
// stores/seleneStore.ts
import { create } from 'zustand'

interface DecisionEntry {
  timestamp: number
  type: 'LEARN' | 'MEMORY' | 'SECTION' | 'GENRE' | 'MODE' | 'INIT' | 'ERROR'
  message: string
  data?: unknown
}

interface SeleneState {
  // Connection
  brainConnected: boolean
  brainInitialized: boolean
  
  // Real-time data
  currentMode: 'reactive' | 'intelligent'
  paletteSource: 'memory' | 'procedural' | 'fallback'
  confidence: number
  energy: number
  beautyScore: number
  
  // Stats
  framesProcessed: number
  patternsLearned: number
  sessionId: string | null
  
  // Decision log
  decisionLog: DecisionEntry[]
  logPaused: boolean
  
  // Actions
  updateFromBrainOutput: (output: BrainOutput) => void
  addLogEntry: (entry: Omit<DecisionEntry, 'timestamp'>) => void
  clearLog: () => void
  toggleLogPause: () => void
  setConnected: (connected: boolean) => void
}

export const useSeleneStore = create<SeleneState>((set, get) => ({
  // Initial state
  brainConnected: false,
  brainInitialized: false,
  currentMode: 'reactive',
  paletteSource: 'fallback',
  confidence: 0,
  energy: 0,
  beautyScore: 0.5,
  framesProcessed: 0,
  patternsLearned: 0,
  sessionId: null,
  decisionLog: [],
  logPaused: false,
  
  // Actions
  updateFromBrainOutput: (output) => set({
    currentMode: output.mode,
    paletteSource: output.paletteSource,
    confidence: output.confidence,
    beautyScore: output.estimatedBeauty,
  }),
  
  addLogEntry: (entry) => {
    if (get().logPaused) return
    
    set((state) => ({
      decisionLog: [
        { ...entry, timestamp: Date.now() },
        ...state.decisionLog.slice(0, 999), // Max 1000 entries
      ],
    }))
  },
  
  clearLog: () => set({ decisionLog: [] }),
  
  toggleLogPause: () => set((state) => ({ logPaused: !state.logPaused })),
  
  setConnected: (connected) => set({ brainConnected: connected }),
}))
```

### Audio Store

```typescript
// stores/audioStore.ts
import { create } from 'zustand'

interface AudioState {
  // Device
  deviceId: string | null
  deviceName: string | null
  isConnected: boolean
  
  // Real-time metrics
  bpm: number
  bpmConfidence: number
  level: number // dB
  
  // Spectrum
  bass: number
  mid: number
  treble: number
  
  // Actions
  setDevice: (id: string, name: string) => void
  updateMetrics: (metrics: Partial<AudioState>) => void
  disconnect: () => void
}

export const useAudioStore = create<AudioState>((set) => ({
  deviceId: null,
  deviceName: null,
  isConnected: false,
  bpm: 120,
  bpmConfidence: 0,
  level: -60,
  bass: 0,
  mid: 0,
  treble: 0,
  
  setDevice: (id, name) => set({ 
    deviceId: id, 
    deviceName: name, 
    isConnected: true 
  }),
  
  updateMetrics: (metrics) => set(metrics),
  
  disconnect: () => set({ 
    deviceId: null, 
    deviceName: null, 
    isConnected: false 
  }),
}))
```

### DMX Store

```typescript
// stores/dmxStore.ts
import { create } from 'zustand'

type DMXDriver = 'enttec-open' | 'enttec-pro' | 'artnet' | 'sacn'

interface DMXState {
  // Connection
  driver: DMXDriver | null
  port: string | null
  isConnected: boolean
  
  // Config
  universe: number
  frameRate: number
  
  // Fixtures
  fixtureCount: number
  channelsUsed: number
  
  // Actions
  connect: (driver: DMXDriver, port: string) => void
  disconnect: () => void
  setUniverse: (universe: number) => void
  setFrameRate: (rate: number) => void
  updateFixtureCount: (count: number, channels: number) => void
}

export const useDMXStore = create<DMXState>((set) => ({
  driver: null,
  port: null,
  isConnected: false,
  universe: 1,
  frameRate: 44,
  fixtureCount: 0,
  channelsUsed: 0,
  
  connect: (driver, port) => set({ 
    driver, 
    port, 
    isConnected: true 
  }),
  
  disconnect: () => set({ 
    driver: null, 
    port: null, 
    isConnected: false 
  }),
  
  setUniverse: (universe) => set({ universe }),
  setFrameRate: (frameRate) => set({ frameRate }),
  updateFixtureCount: (fixtureCount, channelsUsed) => set({ 
    fixtureCount, 
    channelsUsed 
  }),
}))
```

---

## 🎨 SISTEMA DE ESTILOS

### CSS Variables (Theme)

```css
/* styles/theme.css */

:root {
  /* Colores base - Cyberpunk Oscuro */
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-tertiary: #1a1a25;
  --bg-card: #15151f;
  
  /* Acentos neón */
  --accent-cyan: #00fff0;
  --accent-pink: #ff00ff;
  --accent-purple: #a855f7;
  --accent-green: #00ff88;
  --accent-red: #ff3366;
  --accent-orange: #ff6b35;
  --accent-yellow: #ffd700;
  
  /* Estados */
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;
  
  /* Texto */
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  
  /* Bordes */
  --border-subtle: rgba(255, 255, 255, 0.1);
  --border-glow: rgba(0, 255, 240, 0.3);
  
  /* Sombras y glows */
  --glow-cyan: 0 0 20px rgba(0, 255, 240, 0.5);
  --glow-pink: 0 0 20px rgba(255, 0, 255, 0.5);
  
  /* Spacing */
  --sidebar-width: 280px;
  --effects-bar-height: 80px;
  --header-height: 60px;
}
```

### Tailwind Classes Comunes

```typescript
// Botones con glow
const btnEffect = `
  px-4 py-3 rounded-lg font-bold uppercase tracking-wider
  bg-gradient-to-b from-gray-800 to-gray-900
  border border-white/10
  transition-all duration-200
  hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(0,255,240,0.5)]
  active:scale-95
`

const btnEffectActive = `
  bg-gradient-to-b from-cyan-600 to-cyan-800
  border-cyan-400 shadow-[0_0_20px_rgba(0,255,240,0.5)]
`

// Sidebar
const sidebar = `
  fixed left-0 top-0 h-screen w-[280px]
  bg-gradient-to-b from-gray-900 to-black
  border-r border-white/10
  flex flex-col
`

// Cards con efecto glass
const cardGlass = `
  bg-white/5 backdrop-blur-sm
  border border-white/10 rounded-xl
  p-4
`

// Barras de progreso
const progressBar = `h-2 rounded-full bg-gray-800 overflow-hidden`
const progressBarFill = `
  h-full rounded-full transition-all duration-300
  bg-gradient-to-r from-cyan-400 to-purple-500
`
```

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
electron-app/src/renderer/
│
├── App.tsx                      # Entry point
├── main.tsx                     # React DOM render
│
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx       # Layout principal
│   │   ├── Sidebar.tsx          # Barra lateral
│   │   ├── ContentArea.tsx      # Área de contenido
│   │   └── GlobalEffectsBar.tsx # Barra de efectos
│   │
│   ├── sidebar/
│   │   ├── Logo.tsx             # Logo animado
│   │   ├── NavigationTabs.tsx   # Tabs de navegación
│   │   ├── NavTab.tsx           # Tab individual
│   │   └── StatusPanel.tsx      # Panel de estado
│   │       ├── BPMDisplay.tsx
│   │       ├── DMXStatus.tsx
│   │       ├── AudioLevel.tsx
│   │       └── SeleneStatus.tsx
│   │
│   ├── views/
│   │   ├── LiveView/
│   │   │   ├── index.tsx
│   │   │   ├── ModeSelector.tsx
│   │   │   ├── PaletteReactor.tsx
│   │   │   ├── BrainPreview.tsx
│   │   │   └── MovementControl.tsx
│   │   │
│   │   ├── SimulateView/
│   │   │   ├── index.tsx
│   │   │   ├── StageCanvas.tsx
│   │   │   ├── FixtureList.tsx
│   │   │   └── SimulatorControls.tsx
│   │   │
│   │   ├── SeleneLuxView/
│   │   │   ├── index.tsx
│   │   │   ├── ConsciousnessState.tsx
│   │   │   ├── MemoryStats.tsx
│   │   │   ├── RealTimeMetrics.tsx
│   │   │   └── DecisionLog.tsx
│   │   │
│   │   └── SetupView/
│   │       ├── index.tsx
│   │       ├── SetupProgress.tsx
│   │       ├── AudioSetup.tsx
│   │       ├── DMXSetup.tsx
│   │       ├── FixturePatch.tsx
│   │       └── SystemTest.tsx
│   │
│   ├── effects/
│   │   ├── EffectButton.tsx
│   │   └── BlackoutMaster.tsx
│   │
│   └── common/
│       ├── Button.tsx
│       ├── Slider.tsx
│       ├── ProgressBar.tsx
│       ├── Card.tsx
│       └── Badge.tsx
│
├── stores/
│   ├── navigationStore.ts
│   ├── effectsStore.ts
│   ├── seleneStore.ts
│   ├── audioStore.ts
│   └── dmxStore.ts
│
├── hooks/
│   ├── useGlobalKeyboard.ts
│   ├── useSelene.ts
│   ├── useAudio.ts
│   └── useDMX.ts
│
├── providers/
│   ├── KeyboardProvider.tsx
│   ├── SeleneProvider.tsx
│   └── ThemeProvider.tsx
│
├── styles/
│   ├── globals.css
│   ├── theme.css
│   └── animations.css
│
└── types/
    └── index.ts
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 9.1: Foundation (1-2 días)
- [ ] Crear estructura de carpetas
- [ ] Setup Zustand stores básicos
- [ ] Implementar MainLayout + Sidebar
- [ ] Implementar NavigationTabs
- [ ] KeyboardProvider con blackout

### Fase 9.2: Views Básicas (2-3 días)
- [ ] LiveView (portar componentes existentes)
- [ ] SimulateView (portar StageCanvas)
- [ ] SetupView (wizard básico)
- [ ] SeleneLuxView (estructura básica)

### Fase 9.3: Integración Brain (1-2 días)
- [ ] Conectar SeleneLuxView con BrainOutput
- [ ] Implementar DecisionLog en tiempo real
- [ ] Métricas y gráficos animados

### Fase 9.4: Polish (1-2 días)
- [ ] Animaciones y transiciones
- [ ] Responsive ajustes
- [ ] Temas y colores finales
- [ ] Testing de keyboard shortcuts

---

## 💡 NOTAS DE DISEÑO

### Principios UX para DJs

1. **Zero-Distraction**: La UI debe desaparecer cuando no se necesita
2. **One-Click Actions**: Todo crítico accesible con un click
3. **Visual Feedback**: Estados claros y animaciones suaves
4. **Keyboard-First**: Todo controlable sin mouse
5. **Fail-Safe**: Blackout SIEMPRE accesible

### Consideraciones de Performance

- Usar `React.memo` en componentes del Simulator
- Throttle en updates del DecisionLog (max 10/sec)
- Canvas optimizado con `requestAnimationFrame`
- Lazy loading de vistas no activas

---

## 🎯 RESULTADO ESPERADO

Una aplicación que se sienta como:
- **Ableton Live** (precisión y control)
- **TouchDesigner** (visuales en tiempo real)
- **Resolume Arena** (performance-ready)

Con la personalidad única de **Selene Lux** - una IA que aprende y evoluciona.

---

*WAVE 9: Commander Layout - Architecture Document*  
*Ver mockups en: [WAVE9-BLUEPRINT-UI-MOCKUPS.md](./WAVE9-BLUEPRINT-UI-MOCKUPS.md)*
