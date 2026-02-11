# 🕰️ CHRONOS: THE STRATEGIC AUDIT
**Operación Quirúrgica: Mapear territorio para diseñar el FX Creator**

---

## 🎯 EXECUTIVE SUMMARY

Chronos NO es un timecoder tradicional (channel-by-channel programming).  
Chronos NO es software amateur (static scenes y presets muertos).

**Chronos ES**: Un director adaptativo que genera movimiento/color vía **VIBES** + preset effects que se adaptan a cambios de rig sin reprogramar.

Este documento responde a 4 preguntas estratégicas:

1. **¿Qué funciona bien?** (nuestras fortalezas)
2. **¿Qué funciona mal?** (limitaciones actuales)
3. **¿Qué nos falta para ser respetados?** (gaps profesionales)
4. **¿Qué hacemos mejor que las consolas PRO?** (ventaja competitiva)

**Objetivo final**: Diseñar el **FX Creator** - la herramienta que alimenta a Chronos con efectos personalizados.

---

## 📊 ARQUITECTURA ACTUAL: MAPA DEL TERRITORIO

### 🎬 Timeline System

```
┌─────────────────────────────────────────────────────────────┐
│ TIMELINE ARCHITECTURE                                        │
├─────────────────────────────────────────────────────────────┤
│ RULER     │ ⏱️ 00:00 → 04:32 (BPM grid, beat snapping)     │
├─────────────────────────────────────────────────────────────┤
│ WAVEFORM  │ 🌊 Audio visualization (80px height)           │
├─────────────────────────────────────────────────────────────┤
│ VIBE      │ 🎭 [TECHNO][FIESTA][CHILL] (latch mode, 48px)  │
├─────────────────────────────────────────────────────────────┤
│ FX TRACK 1│ ⚡ [STROBE]──[SWEEP]──[PULSE] (36px)           │
│ FX TRACK 2│ ⚡ [CHASE]──[FADE]──[BLACKOUT] (36px)          │
│ FX TRACK 3│ ⚡ [COLOR-WASH]──[INTENSITY-RAMP] (36px)       │
│ FX TRACK 4│ ⚡ [CUSTOM SLOT - Ghost button] (36px)         │
└─────────────────────────────────────────────────────────────┘
```

**Tech Stack:**
- **ChronosInjector**: 30fps tick rate, state diffing (solo emite cambios)
- **ChronosIPCBridge**: IPC routing → backend (vibe-change, fx-trigger, fx-stop)
- **Timeline Storage**: `.chronos` JSON projects con blob URLs para audio

**Strengths:**
✅ Drag & drop clips con beat snapping automático  
✅ Serialización/deserialización de proyectos completos  
✅ State diffing eficiente (no floods de IPC)  
✅ Keyframe automation en FX clips (3 keyframes por defecto: 0 → 1 → 0)

**Limitations:**
❌ Solo 8 FX types preset (strobe, sweep, pulse, chase, fade, blackout, color-wash, intensity-ramp)  
❌ Keyframes limitados: solo **intensity curve** (0-1), no parámetros individuales (velocidad, color, tamaño...)  
❌ No hay FX Creator UI - el ghost button de FX4 está vacío  
❌ No hay sistema de FX library personalizada (efectos viven solo en memoria)

---

### 🎭 Vibe System: El Corazón Adaptativo

**5 Vibe Profiles:**

| Vibe | Physics | Color Palette | Movement Style | FX Restrictions |
|------|---------|---------------|----------------|-----------------|
| **fiesta-latina** | High energy, fast decay | Warm tones (orange/red/yellow) | Rhythmic sweeps, salsa spins | ✅ Strobe allowed (max 15Hz) |
| **techno-club** | Industrial, hard hits | Cold tones (cyan/magenta/blue) | Straight sweeps, sharp snaps | ✅ Strobe allowed (max 18Hz) |
| **chill-lounge** | Slow decay, smooth inertia | Deep ocean (blue/purple/teal) | Gentle oscillation, caustics | ❌ NO STROBES (bioluminescence only) |
| **pop-rock** | Medium energy, arena style | Saturated primaries | Spotlight tracking, arena sweeps | ✅ Strobe allowed (moderate) |
| **idle** | Minimal movement | Neutral/white | Static/breathing | ⚠️ Limited FX |

**Architecture:**
```
VibeProfile → PhysicsConfig → ZoneRouter → FixturePhysicsDriver
             → ColorPalette → ColorEngine → HAL
             → AllowedFX list (checked by EffectManager)
```

**Strengths:**
✅ **Rig-agnostic**: Vibe define *qué hacer*, fixtures deciden *cómo hacerlo*  
✅ Physics profiles automáticos (maxAcceleration, maxVelocity, friction, decay)  
✅ FX filtering (Chill Lounge bloquea strobes, techno los permite)  
✅ Zone-aware: Vibe respeta instalación física (ceiling, floor, truss)

**Limitations:**
❌ Solo 5 vibes preset - no hay Vibe Creator  
❌ Vibe profiles hardcoded (no edición runtime)  
❌ Transiciones entre vibes sin crossfade suave (cambio duro)

---

### 🧨 Effect System: Preset Arsenal

**Current FX Library (40+ effects):**

| Category | Effects | Strobe-Safe? | Vibe Specific? |
|----------|---------|--------------|----------------|
| **Fiesta Latina** | solar_flare, strobe_storm, strobe_burst, tidal_wave, tropical_pulse, salsa_fire, glitch_guaguanco, latina_meltdown | ⚠️ Yes (15Hz max) | Latina only |
| **Techno Club** | industrial_strobe, acid_sweep, cyber_dualism, gatling_raid, sky_saw, abyssal_rise, core_meltdown, static_pulse | ⚠️ Yes (18Hz max) | Techno only |
| **Chill Lounge** | solar_caustics, school_of_fish, whale_song, abyssal_jellyfish, deep_current_pulse, bioluminescent_spore | ✅ NO STROBES | Chill only |
| **Pop-Rock** | thunder_struck, liquid_solo, amp_heat, arena_sweep, feedback_storm, power_chord, stage_wash, spotlight_pulse | ⚠️ Moderate | Pop-Rock only |
| **Global** | ghost_breath, tidal_wave (ambient), fiber_optics | ✅ Yes | All vibes |

**Architecture:**
```
EffectManager
  ├─ effectFactories (Map<string, () => BaseEffect>)
  ├─ activeEffects (Map<instanceId, EffectInstance>)
  ├─ trigger(effectId, config)
  │    └─ Checks vibe restrictions (EFFECT_VIBE_RULES)
  │    └─ Creates instance → update(deltaMs) @ 30fps
  │    └─ Returns EffectFrameOutput (zones, dimmer/color/pan/tilt)
  └─ getOutput() → MasterArbiter → HAL → Fixtures
```

**Strengths:**
✅ **BaseEffect abstraction**: Todos los FX heredan de clase común  
✅ **Vibe-aware**: EffectManager respeta reglas (chill → NO strobes)  
✅ **MixBus system**: HTP (color additive) vs GLOBAL (dictator blackout)  
✅ **Priority system**: Efectos con prioridad alta (90-95) overridean bajos (50-70)  
✅ **Zone targeting**: Effects especifican qué zones afectan (front, back, moving_left, moving_right, all)

**Limitations:**
❌ **NO custom FX creation**: 40 effects hardcoded en EffectManager.ts  
❌ **NO parameter automation**: Keyframes de Chronos solo controlan intensity (0-1)  
❌ **NO FX layering UI**: Chronos solo puede triggerear 1 FX por track  
❌ **NO FX presets exportables**: No hay sistema de FX library (.lfx files?)  
❌ **Parámetros bloqueados**: strobeRateHz, sweepSpeed, color... son internos de cada efecto

---

### 🏛️ Zone System: Hardware Abstraction

**7 Zones Disponibles** (4 activas actualmente):

| Zone | Descripción | Fixture Types | Movement | Status |
|------|-------------|---------------|----------|--------|
| **MOVING_LEFT** | Movers izquierda | Moving Heads | Pan/Tilt (installation-aware) | ✅ Active |
| **MOVING_RIGHT** | Movers derecha | Moving Heads | Pan/Tilt (installation-aware) | ✅ Active |
| **FRONT** | PARs frontales | RGB PARs | Static color/dimmer | ✅ Active |
| **BACK** | PARs traseros | RGB PARs | Static color/dimmer | ✅ Active |
| **AIR** | Aerials (lasers, washers) | Lasers, Washers | Full 3D movement | ⚠️ Planned (not implemented) |
| **TRUSS_FRONT** | Fixtures en truss frontal | Mixed | Installation physics | ⚠️ Planned |
| **TRUSS_BACK** | Fixtures en truss trasero | Mixed | Installation physics | ⚠️ Planned |

**Architecture:**
```
ZoneRouter
  ├─ buildZoneConfig()
  │    └─ Returns Map<zone, ZoneConfig>
  │         ├─ respondsTo: 'bass' | 'melody' | 'both'
  │         ├─ gateThreshold: 0.2 (energy floor)
  │         ├─ gainMultiplier: 1.5 (sensitivity)
  │         └─ physics: PAR_PHYSICS | MOVER_PHYSICS
  │
  └─ routeToZones(intent, fixtures)
       └─ Filters fixtures by zone
       └─ Applies zone-specific physics config
```

**HAL Pipeline:**
```
1. ZoneRouter    → Fixture filtering por zone
2. PhysicsEngine → Decay, inertia, hysteresis
3. FixtureMapper → Intent → DMX (pan/tilt 0-540°, color HSL → RGB)
4. Driver        → USB/ArtNet/Mock output
```

**Strengths:**
✅ **Installation-aware physics**: ceiling vs floor fixtures invierten movimiento automáticamente  
✅ **Zone-based routing**: Effects especifican zones → HAL mapea a fixtures reales  
✅ **Dynamic fixture mapping**: Agregar fixtures al rig = auto-routing sin reprogramar  
✅ **Stereo positioning**: Position-based L/R mapping automático

**Limitations:**
❌ **Solo 4 zones activas**: AIR, TRUSS_FRONT, TRUSS_BACK no implementados  
❌ **No zone groups**: No puedes crear grupos custom (ej: "PERIMETER" = front + back)  
❌ **No fixture priorities**: Dentro de una zone, todos los fixtures son iguales  
❌ **No per-fixture overrides**: No puedes excluir fixtures específicos de un effect

---

### 🎯 Integration Pipeline: Brain → Stage

**Full Stack Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│ CHRONOS TIMELINE (Frontend)                                 │
│   └─ ChronosInjector.tick() @ 30fps                         │
│       └─ Emits: vibe-change, fx-trigger, fx-stop            │
└──────────────────────┬──────────────────────────────────────┘
                       │ IPC (ChronosIPCBridge)
┌──────────────────────▼──────────────────────────────────────┐
│ BACKEND HANDLERS (IPCHandlers.ts)                           │
│   ├─ chronos:setVibe → TitanEngine.setVibe()               │
│   ├─ chronos:triggerFX → EffectManager.trigger()           │
│   └─ chronos:stopFX → EffectManager.stop()                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ TITAN ENGINE (TitanOrchestrator.ts)                        │
│   └─ processFrame() @ 30fps                                │
│       ├─ Brain.decide() → LightingIntent                   │
│       ├─ EffectManager.getOutput() → EffectFrameOutput     │
│       ├─ MasterArbiter.arbitrate() → FinalLightingTarget   │
│       └─ HAL.render() → FixtureState[]                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ IPC (every frame)
┌──────────────────────▼──────────────────────────────────────┐
│ FRONTEND VISUALIZATION (StageSimulator2/3D)                │
│   └─ truthStore.fixtures → Canvas render @ 60fps           │
└─────────────────────────────────────────────────────────────┘
```

**Performance Metrics:**
- **Backend**: 30 FPS (processFrame every 33ms)
- **Frontend**: 60 FPS (Canvas/Three.js rendering)
- **IPC Throughput**: ~16 fixtures × 30fps = 480 updates/s
- **Visual Smoothing**: 0.3 interpolation factor (WAVE 1101) para esconder lag de IPC

**Strengths:**
✅ **State diffing**: ChronosInjector solo emite cambios (no floods)  
✅ **Fixture count agnostic**: Pipeline escala sin cambios (10 fixtures = same code as 100)  
✅ **Visual smoothing**: Frontend interpola missing frames (paz mental para el DJ)  
✅ **Zone-based rendering**: HAL no procesa fixtures fuera de zone target

**Limitations:**
❌ **30 FPS backend**: Límite teórico de 33ms latency (aceptable pero no pro)  
❌ **IPC bottleneck**: Con 1000 fixtures → 30k updates/s → posible saturación  
❌ **No frame skipping**: Si backend se retrasa, frontend sigue interpolando (genera lag acumulado)  
❌ **No DMX hardware throttling**: Mock driver OK, pero USB/ArtNet sin rate limiting

---

## 🔥 ¿QUÉ FUNCIONA BIEN? (FORTALEZAS)

### 1. 🎭 Adaptive Vibe System
**LA DIFERENCIA FUNDAMENTAL:**
- Consolas PRO: "Fixture 1 → Pan 127, Tilt 200, Color RGB(255,0,0)"
- **Chronos**: "Vibe TECHNO → Movers sweep industrial, PARs cyan/magenta pulse"

**Por qué es poderoso:**
- Cambias de 10 fixtures → 50 fixtures: **Vibe sigue funcionando**
- Cambias PARs RGB → RGBW: **Vibe adapta la paleta**
- Cambias moving heads ceiling → floor: **Physics se invierte automáticamente**

**Uso real:**
Un DJ con setup de 10 PARs hace un show genial. Al mes siguiente, alquila 20 movers + lasers.  
**Consola PRO**: Reprogramar TODO (días de trabajo).  
**Chronos**: Agregar fixtures al patch, asignar zones, **DONE** (30 minutos).

---

### 2. 🧠 Zone-Based Abstraction
**Separación conceptual:**
```
INTENT (abstracto)       →  HARDWARE (concreto)
"Color magenta en front" →  DMX [1-3]: [255, 0, 255]
"Sweep L→R en movers"    →  Pan fixtures L: 180°, R: 0°
```

**Por qué es brillante:**
- **Effects no saben de DMX**: Effect dice "front zone @ 80% magenta", HAL traduce a canales DMX
- **Installation-aware**: Fixture en ceiling vs floor = mismo effect, movimiento invertido
- **Stereo mapping**: Position-based L/R routing sin programar manualmente

**Comparación:**
- **Consolas PRO**: Tienes que programar "Group 1 = Movers L, Group 2 = Movers R"
- **Chronos**: Zones son automáticas basadas en position física

---

### 3. ⚡ Effect Arsenal Vibe-Aware
**Smart filtering:**
```typescript
// Chill Lounge → BLOQUEA strobes automáticamente
const CHILL_BLOCKED = [
  'industrial_strobe', 'strobe_storm', 'core_meltdown', 
  'gatling_raid', 'acid_sweep'
]

// Techno Club → PERMITE strobes (18Hz max)
if (vibe === 'techno-club' && effect === 'industrial_strobe') {
  trigger({ strobeRateHz: 18 }) // ✅ OK
}
```

**Por qué es útil:**
DJ cambia de vibe → effects disponibles se adaptan → **Protege de errores** (ej: strobe en set chill = desastre)

**40+ effects organizados por vibe:**
- Fiesta Latina: solar_flare, salsa_fire, tropical_pulse
- Techno Club: industrial_strobe, acid_sweep, core_meltdown
- Chill Lounge: solar_caustics, whale_song, bioluminescent_spore
- Pop-Rock: thunder_struck, arena_sweep, spotlight_pulse

---

### 4. 🎬 Timeline Integration
**Chronos ≠ Live triggering tradicional:**
```
TRADICIONAL:              CHRONOS:
Press button → FX fires   Timeline clip @ 02:30 → FX auto-triggers
Forget to stop → keeps    Clip ends → FX auto-stops
Manual fade → aprox       Keyframe curve → preciso
```

**Ventajas:**
- **Pre-programación**: Prepara show completo en casa, ejecuta en vivo sin pensar
- **Beat-sync perfecto**: Clips snapping a beat grid (BPM detection)
- **Reproducibilidad**: Show grabado = mismo resultado siempre
- **State persistence**: Proyectos guardados como `.chronos` JSON + audio blob URLs

---

### 5. 🏛️ Hardware Abstraction Layer (HAL)
**Pipeline limpio:**
```
INTENT (abstract zones) → ROUTER (filter fixtures) 
                        → PHYSICS (decay/inertia) 
                        → MAPPER (DMX translation) 
                        → DRIVER (USB/ArtNet/Mock)
```

**Por qué es arquitectura sólida:**
- **Separation of concerns**: Brain no sabe de DMX, HAL no sabe de música
- **Testability**: Mock driver para desarrollo sin hardware
- **Future-proof**: Agregar ArtNet/sACN = solo cambiar Driver

---

## 💔 ¿QUÉ FUNCIONA MAL? (LIMITACIONES)

### 1. ❌ Keyframe System Primitivo
**Estado actual:**
```typescript
// FXClip solo tiene intensity curve (0-1)
keyframes: [
  { offsetMs: 0, value: 0, easing: 'ease-in' },      // ⬆️ Fade in
  { offsetMs: duration/2, value: 1, easing: 'ease-out' }, // 🔝 Peak
  { offsetMs: duration, value: 0, easing: 'linear' }  // ⬇️ Fade out
]
```

**Problema:**
- Solo controlas **cuánto** (intensity 0-1)
- NO controlas **cómo** (velocidad, color, tamaño, dirección...)

**Ejemplo del mundo real:**
Quieres un sweep que:
- Empieza lento (0.2 speed)
- Acelera a mitad (1.0 speed)
- Cambia color (cyan → magenta)
- Reduce tamaño (wide → narrow beam)

**Chronos actual:** ❌ IMPOSIBLE - solo tienes 1 curva de intensity  
**Consolas PRO:** ✅ Posible - múltiples parámetros con automation  
**FX Creator necesita:** Multi-parameter keyframing

---

### 2. ❌ Effect Library Hardcoded
**Problema:**
```typescript
// EffectManager.ts - 800 líneas de registros manuales
registerBuiltinEffects() {
  this.effectFactories.set('solar_flare', () => new SolarFlare())
  this.effectFactories.set('strobe_storm', () => new StrobeStorm())
  // ... 40 más hardcoded
}
```

**Consecuencias:**
- Agregar effect nuevo = editar código TypeScript + recompilar
- No hay FX library exportable (`.lfx` files)
- No puedes compartir effects entre usuarios
- No hay preset browser en Chronos

**Comparación:**
- **Consolas PRO**: Library de effects + importar/exportar shows
- **Ableton Live**: Racks de effects guardables como presets
- **Chronos**: Effects viven solo en código

---

### 3. ❌ Solo 4 Zones Activas
**Estado actual:**
```
✅ MOVING_LEFT, MOVING_RIGHT → Movers con pan/tilt
✅ FRONT, BACK → PARs estáticos
⚠️ AIR → Planeado (lasers, washers) pero no implementado
⚠️ TRUSS_FRONT, TRUSS_BACK → Planeado pero no implementado
```

**Limitaciones:**
- No puedes targetear "solo lasers"
- No puedes hacer "truss sweep front → back"
- No hay zone groups (ej: "PERIMETER" = front + back + sides)

**Escenario real:**
Tienes 4 PARs front, 4 PARs back, 2 movers L/R, 2 lasers air.  
Effect "laser sweep horizontal" → ❌ NO HAY ZONE AIR  
Workaround actual: Poner lasers en MOVING_LEFT/RIGHT → 🤮 Hacky

---

### 4. ❌ No Fixture Priorities/Overrides
**Problema:**
Dentro de una zone, todos los fixtures son iguales.

**Ejemplo:**
Tienes 4 PARs en FRONT zone.  
Effect "spotlight center" → Ilumina LOS 4 PARs  
No puedes decir "solo PAR 2 y 3, ignora 1 y 4"

**Comparación:**
- **Consolas PRO**: Selección manual de fixtures en cada cue
- **Chronos**: Zone = all or nothing

**Workaround actual:** Cambiar fixture de zone → 🤮 Rompe la lógica

---

### 5. ❌ Vibe Transitions Duras
**Problema:**
```typescript
// Cambio de vibe = instantáneo
setVibe('techno-club') // ⚡ Cambio duro
// Fixtures saltan de palette latina → techno sin crossfade
```

**Consecuencias:**
- Transiciones bruscas en cambios de vibe
- No hay crossfade engine para vibes (solo existe para overrides manuales)
- No puedes hacer "fade 5s de chill → techno"

**Comparación:**
- **Consolas PRO**: Crossfade time configurable entre cues
- **Chronos**: Cambios instantáneos

---

### 6. ❌ Performance en Escala
**Bottlenecks potenciales:**

| Component | Current | Scale Problem |
|-----------|---------|---------------|
| **Backend FPS** | 30 FPS | Con 1000 fixtures × 30fps = 30k updates/s → IPC saturado |
| **IPC throughput** | ~480 updates/s (16 fixtures) | Electron IPC no diseñado para high-frequency data |
| **HAL rendering** | O(n) per fixture | 1000 fixtures × 11 channels × 30fps = 330k operations/s |
| **Frontend canvas** | 60 FPS (todos los fixtures) | Sin virtualización → 1000 fixtures = lag visual |
| **Zone routing** | O(n) filtering | buildZoneConfig() recorre TODAS las fixtures cada frame |

**Evidencia:**
```typescript
// WAVE 377: 3D Simulator context loss con 50+ fixtures
if (fixtures.length > 50) {
  console.warn('[StageGrid3D] Too many fixtures, disabling raycasting')
}
```

**Comparación:**
- **Consolas PRO**: 1000+ fixtures @ 44 FPS (optimizaciones hardware)
- **Chronos**: Untested beyond 16 fixtures (demo rig)

---

## 🎖️ ¿QUÉ NOS FALTA PARA SER RESPETADOS? (GAPS PROFESIONALES)

### 1. 🎨 FX Creator - La Herramienta Faltante

**¿Qué necesita un FX Creator profesional?**

#### A. Multi-Parameter Keyframing
```
CURRENT (1 parameter):       TARGET (8+ parameters):
┌─────────────────────┐      ┌─────────────────────┐
│ Intensity: ○──●──○  │      │ Intensity: ○──●──○  │
└─────────────────────┘      │ Speed: ○────●───●   │
                             │ Color: ●────●──○    │
                             │ Size: ○──●────●     │
                             │ Direction: ●──○──●  │
                             │ Pan: ○───●────●     │
                             │ Tilt: ●──○───●      │
                             │ Zoom: ○────●──○     │
                             └─────────────────────┘
```

**Parámetros esenciales:**
- **Dimmer**: Intensity curve (0-1)
- **Color**: HSL keyframes con fade
- **Movement**: Pan/Tilt curves + speed/acceleration
- **Optics**: Zoom, Focus, Iris curves
- **Speed**: Velocidad de sweep/chase/pulse
- **Shape**: Beam angle, gobo selection
- **Direction**: L→R, R→L, converge, diverge
- **Zone Target**: Qué zones afecta en cada keyframe

#### B. Effect Preset Library
```
~/.luxsync/effects/
  ├─ my-custom-sweep.lfx        ← Exportable, shareable
  ├─ strobo-latino-suave.lfx
  ├─ oceanic-caustics-slow.lfx
  └─ techno-gatling-brutal.lfx
```

**Formato `.lfx` (LuxSync Effect)**:
```json
{
  "id": "my-custom-sweep",
  "name": "My Custom Sweep",
  "category": "movement",
  "vibe": "techno-club",
  "zones": ["MOVING_LEFT", "MOVING_RIGHT"],
  "duration": 2000,
  "parameters": {
    "intensity": [
      { "time": 0, "value": 0, "easing": "ease-in" },
      { "time": 1000, "value": 1, "easing": "ease-out" },
      { "time": 2000, "value": 0, "easing": "linear" }
    ],
    "pan": [
      { "time": 0, "value": 0.2, "easing": "linear" },
      { "time": 2000, "value": 0.8, "easing": "linear" }
    ],
    "color": [
      { "time": 0, "value": { "h": 180, "s": 100, "l": 50 }, "easing": "linear" },
      { "time": 2000, "value": { "h": 300, "s": 100, "l": 50 }, "easing": "linear" }
    ],
    "speed": [
      { "time": 0, "value": 0.5 },
      { "time": 1000, "value": 1.0 },
      { "time": 2000, "value": 0.3 }
    ]
  }
}
```

#### C. Visual Effect Editor
```
┌──────────────────────────────────────────────────────────────┐
│ FX CREATOR - "my-custom-sweep"                    [✓ SAVE]   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  PREVIEW (Stage Simulator mini)                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   🎬 [▶ PLAY] [⏸ PAUSE] [⏹ STOP] [🔁 LOOP]       │    │
│  │                                                      │    │
│  │   💡 💡 💡 💡 (fixtures animando en tiempo real)  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  PARAMETERS                                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ INTENSITY  [●────────○────────○]  0.0 → 1.0       │    │
│  │ PAN        [○───────●──────────●]  0.2 → 0.8       │    │
│  │ COLOR      [●────────────●──────○] CYAN → MAGENTA  │    │
│  │ SPEED      [○──●────────────────●] 0.5 → 1.0 → 0.3│    │
│  │ ZOOM       [────────────────────] (no keyframes)   │    │
│  │ TILT       [────────────────────] (no keyframes)   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  TIMELINE (0 → 2000ms, beat grid @ 128 BPM)                 │
│  ├──●──────────────●──────────────●──┤                      │
│                                                               │
│  ZONES: [✓ MOVING_L] [✓ MOVING_R] [ ] FRONT [ ] BACK       │
│  VIBE: [TECHNO-CLUB ▼]  CATEGORY: [MOVEMENT ▼]             │
│  MIX BUS: [○ HTP  ● GLOBAL]  PRIORITY: [75/100]            │
└──────────────────────────────────────────────────────────────┘
```

**Features críticos:**
- **Real-time preview**: Ver effect antes de guardarlo
- **Keyframe editor**: Drag & drop keyframes, Bézier handles
- **Parameter locking**: "Lock PAN, solo edita COLOR"
- **Template system**: "Empezar desde acid_sweep, modificar"
- **Validation**: Check vibe compatibility (ej: no strobes en chill)

---

### 2. 🎯 Advanced Zone System

**Gaps actuales:**

#### A. Zone Groups
```typescript
// Crear grupos lógicos de zones
const zoneGroups = {
  PERIMETER: ['FRONT', 'BACK', 'LEFT', 'RIGHT'],
  OVERHEAD: ['AIR', 'TRUSS_FRONT', 'TRUSS_BACK'],
  MOVERS_ALL: ['MOVING_LEFT', 'MOVING_RIGHT'],
  CENTER_STAGE: ['FRONT:2,3', 'BACK:2,3'] // ← Fixture selection dentro de zone
}
```

#### B. Zone Priorities
```typescript
// Dentro de una zone, sub-prioritize fixtures
const zoneConfig = {
  FRONT: {
    fixtures: [
      { id: 'par_1', priority: 0.5 },  // Dimmer
      { id: 'par_2', priority: 1.0 },  // Hero
      { id: 'par_3', priority: 1.0 },  // Hero
      { id: 'par_4', priority: 0.5 }   // Dimmer
    ]
  }
}
```

#### C. Dynamic Zone Assignment
```typescript
// Effects pueden cambiar zone target durante ejecución
const effect = {
  keyframes: [
    { time: 0, zones: ['MOVING_LEFT'] },      // Start L
    { time: 1000, zones: ['MOVING_LEFT', 'MOVING_RIGHT'] }, // Add R
    { time: 2000, zones: ['MOVING_RIGHT'] }   // Drop L, keep R
  ]
}
```

---

### 3. ⚡ Performance Optimization

**Estrategias necesarias para 1000+ fixtures:**

#### A. Frame Skipping & Adaptive FPS
```typescript
// Backend ajusta FPS según carga
if (fixtureCount > 100 && avgFrameTime > 40ms) {
  targetFPS = 20  // Baja a 20 FPS
} else {
  targetFPS = 30  // Normal 30 FPS
}
```

#### B. Zone Culling
```typescript
// Solo renderizar zones activas
const activeZones = getActiveEffectZones()
for (const zone of activeZones) {
  renderZone(zone)  // Skip otras zones
}
```

#### C. Fixture Batching
```typescript
// IPC batch updates (1 mensaje con 100 fixtures vs 100 mensajes)
const batch = fixtures.map(f => ({
  id: f.id,
  dmx: f.dmxValues  // Pre-serializado
}))
ipc.send('fixtures:batch-update', batch)
```

#### D. Frontend Virtualization
```typescript
// Renderizar solo fixtures visibles en viewport
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={fixtures.length}
  itemSize={40}
>
  {({ index, style }) => <Fixture key={index} style={style} />}
</FixedSizeList>
```

---

### 4. 🔄 Vibe Crossfade Engine

**Implementación necesaria:**
```typescript
class VibeCrossfader {
  private fromVibe: VibeProfile | null = null
  private toVibe: VibeProfile
  private progress = 0  // 0-1
  
  start(from: VibeProfile, to: VibeProfile, durationMs: number) {
    this.fromVibe = from
    this.toVibe = to
    this.progress = 0
    this.durationMs = durationMs
  }
  
  update(deltaMs: number): VibeProfile {
    this.progress += deltaMs / this.durationMs
    if (this.progress >= 1) {
      return this.toVibe
    }
    
    // Interpolate physics config
    return {
      physics: lerpPhysics(this.fromVibe.physics, this.toVibe.physics, this.progress),
      colors: lerpPalette(this.fromVibe.colors, this.toVibe.colors, this.progress),
      allowedFX: this.progress < 0.5 ? this.fromVibe.allowedFX : this.toVibe.allowedFX
    }
  }
}
```

---

### 5. 📊 Telemetry & Performance Dashboard

**Métricas críticas:**
```
┌─────────────────────────────────────────────────┐
│ LUXSYNC TELEMETRY                               │
├─────────────────────────────────────────────────┤
│ Backend FPS: 29.8 fps (target: 30)  ✅         │
│ Avg Frame Time: 31ms (budget: 33ms) ✅         │
│ IPC Throughput: 487 msg/s            ⚠️         │
│ Fixture Count: 16 active              ✅         │
│ Active Effects: 2 (solar_flare, acid_sweep) ✅ │
│ Zone Routing: 12ms                    ✅         │
│ HAL Render: 8ms                       ✅         │
│ DMX Output: 2ms                       ✅         │
│                                                  │
│ Warnings:                                        │
│ ⚠️ IPC approaching saturation (>500 msg/s)     │
└─────────────────────────────────────────────────┘
```

---

## 🚀 ¿QUÉ HACEMOS MEJOR QUE LAS CONSOLAS PRO?

### 1. 🎭 Zero Reprogramming on Rig Changes

**Scenario:** DJ with 10 PARs → upgrades to 20 PARs + 4 movers + 2 lasers

| Workflow | Traditional Console | LuxSync Chronos |
|----------|---------------------|-----------------|
| **Patch new fixtures** | 30 min | 30 min |
| **Reprogram all cues** | **8 hours** (cada cue referencia fixtures específicos) | ❌ NO NEEDED |
| **Test all transitions** | **2 hours** | **10 min** (vibes auto-adaptan) |
| **Total time** | **~11 hours** | **~40 min** |

**Por qué:**
Chronos effects dicen "zones + vibes", no "fixture 1 pan 127".  
Agregar fixtures = auto-routing. DONE.

---

### 2. 🧠 AI-Driven Decision Making

**Consolas PRO:**
```
IF kick → THEN fixture 1 dimmer 255
IF snare → THEN fixture 2 strobe
```

**Chronos Brain:**
```
Analyze audio → Detect mood + energy + rhythm
↓
Decide vibe (techno-club @ energy=0.8)
↓
Trigger effects (acid_sweep @ bass hit)
↓
Modulate intensity (energy curve 0-1)
```

**Ventaja:**
Consola PRO = reglas estáticas (dumb triggers).  
Chronos = adaptive intelligence (entiende contexto musical).

---

### 3. 🎬 Timeline-First Workflow

**Consolas PRO:**
- Programas cues (cue 1, cue 2, cue 3...)
- Live triggering: presionas GO, cue 1 → cue 2
- Timecode opcional (SMPTE sync)

**Chronos:**
- Programas timeline (drag & drop clips)
- Playback automático (beat-synced)
- Live override sin perder timeline

**Ventaja clave:**
Chronos = **Pre-program + live adapt**.  
Consola = **O programas O improvizas**, no ambos a la vez.

---

### 4. 💰 Zero Hardware Dependency

**Consolas PRO:**
```
GrandMA3 onPC → $5,000 (command wing)
Avolites Titan → $8,000 (console)
Chamsys MagicQ → $2,000 (wing)
```

**Chronos:**
```
Laptop + Electron app → $0
USB DMX adapter → $50 (Enttec Open DMX)
ArtNet (WiFi) → $0 (software)
```

**Total cost:**
- Consola PRO: **$2,000-$8,000**
- Chronos: **$50** (or $0 con ArtNet)

---

### 5. 🌊 Music-Reactive by Default

**Consolas PRO:**
- Audio input → manual BPM tap
- Effects = fixed timings
- Sound-to-light = basic LFOs

**Chronos:**
- Audio analysis → automatic BPM + beat detection
- Effects = adaptive speed (sync to BPM)
- DNA Brain → energy mapping (valley/build/drop/sustain)

**Example:**
Track @ 128 BPM → Chronos auto-detects → sweep speed = 2 bars.  
Track @ 170 BPM (D&B) → sweep speed = 4 bars.  
**Same effect, adapted speed**.

---

## 🎯 STRATEGIC RECOMMENDATIONS: FX CREATOR DESIGN

### Phase 1: Foundation (MUST HAVE)

#### 1.1 Multi-Parameter Keyframe System
```typescript
interface FXParameter {
  id: string  // 'intensity', 'pan', 'tilt', 'color', 'speed', 'zoom'
  type: 'number' | 'color' | 'enum'
  range: [number, number]  // [0, 1] or [0, 255]
  keyframes: Keyframe[]
}

interface Keyframe {
  time: TimeMs
  value: number | HSL | string
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier'
  handles?: BezierHandles  // For custom curves
}
```

**Implementation:**
- Extend `FXClip` → `params: Map<string, FXParameter>`
- ChronosInjector → interpolate multi-params at playback
- EffectManager → accept `params` override in trigger()

---

#### 1.2 Effect Preset File Format (`.lfx`)
```json
{
  "$schema": "https://luxsync.io/schemas/effect.v1.json",
  "version": "1.0.0",
  "effect": {
    "id": "custom-sweep-01",
    "name": "My Custom Sweep",
    "author": "DJ Radwulf",
    "category": "movement",
    "tags": ["sweep", "techno", "movers"],
    "vibe": ["techno-club", "pop-rock"],
    "zones": ["MOVING_LEFT", "MOVING_RIGHT"],
    "mixBus": "global",
    "priority": 75,
    "defaultDuration": 2000,
    "parameters": { ... }
  }
}
```

**Features:**
- JSON schema validation
- Portable (share between users)
- Versioning (migrate old effects)

---

#### 1.3 Visual Effect Editor UI
```
src/chronos/ui/fx-creator/
  ├─ FXCreatorWindow.tsx       (main window)
  ├─ ParameterTimeline.tsx     (keyframe editor)
  ├─ PreviewStage.tsx          (mini simulator)
  ├─ ParameterPanel.tsx        (param controls)
  └─ LibraryBrowser.tsx        (load/save .lfx)
```

**Key components:**
- Drag & drop keyframes
- Real-time preview (mini 3D/2D stage)
- Parameter locking (edit color, freeze pan/tilt)
- Template system (clone existing effect)

---

### Phase 2: Advanced Features (NICE TO HAVE)

#### 2.1 Zone Groups & Priorities
```typescript
interface ZoneGroup {
  id: string
  name: string
  zones: string[]
  priorities?: Map<fixtureId, number>
}

const groups = {
  PERIMETER: { zones: ['FRONT', 'BACK', 'LEFT', 'RIGHT'] },
  OVERHEAD: { zones: ['AIR', 'TRUSS_FRONT'] },
  HEROES: { 
    zones: ['MOVING_LEFT', 'MOVING_RIGHT'],
    priorities: { 'mover_1': 1.0, 'mover_2': 0.5 }
  }
}
```

---

#### 2.2 Effect Layering
```typescript
// Multiple FX stacks con blend modes
const effectStack = [
  { effect: 'base-color-wash', blend: 'htp', opacity: 1.0 },
  { effect: 'sweep-overlay', blend: 'add', opacity: 0.7 },
  { effect: 'strobe-accent', blend: 'multiply', opacity: 0.5 }
]
```

---

#### 2.3 Conditional Parameters
```typescript
// Parameter values cambian según audio metrics
const parameter = {
  id: 'speed',
  source: 'audio.energy',  // ← Bind to audio
  mapping: 'linear',
  range: [0.5, 2.0]  // energy 0 → speed 0.5, energy 1 → speed 2.0
}
```

---

#### 2.4 Macro Effects (Meta-Effects)
```typescript
// Un effect que triggerea otros effects
const macroEffect = {
  id: 'drop-explosion',
  type: 'macro',
  sequence: [
    { effect: 'blackout', duration: 200 },
    { effect: 'strobe-burst', duration: 500 },
    { effect: 'sweep-left', duration: 1000, startAfter: 200 },
    { effect: 'color-wash', duration: 2000, startAfter: 500 }
  ]
}
```

---

### Phase 3: Professional Polish (FUTURE)

#### 3.1 Effect Marketplace
```
https://luxsync.io/effects/
  ├─ Featured effects
  ├─ Community uploads
  ├─ Vibe-specific packs
  └─ Pro artist presets
```

#### 3.2 Effect Analytics
```
Track usage:
- Most used effects
- Average duration
- Vibe compatibility
- User ratings
```

#### 3.3 AI Effect Generator
```
Prompt: "Create a smooth sweep left to right with cyan color, 2 seconds"
↓
Chronos AI generates .lfx file
↓
User tweaks in FX Creator
```

---

## 📋 CONCLUSION: THE PATH FORWARD

### ✅ What We Have (Strengths)
1. **Adaptive Vibe System** - rig-agnostic, physics-aware
2. **Zone-Based Architecture** - abstract intent → concrete hardware
3. **40+ Preset Effects** - vibe-aware filtering, professional arsenal
4. **Timeline Integration** - beat-synced, pre-programmable, reproducible
5. **HAL Abstraction** - clean separation, testable, future-proof

### ❌ What We Need (Critical Gaps)
1. **FX Creator** - multi-param keyframing, visual editor, .lfx presets
2. **Advanced Zones** - groups, priorities, dynamic assignment
3. **Performance Optimization** - frame skipping, batching, virtualization
4. **Vibe Crossfade** - smooth transitions entre vibes
5. **Telemetry Dashboard** - performance monitoring, bottleneck detection

### 🚀 Competitive Advantages
1. **Zero reprogramming** on rig changes (vs consolas PRO: horas de trabajo)
2. **AI-driven intelligence** (vs reglas estáticas)
3. **Timeline-first workflow** (pre-program + live adapt)
4. **Zero hardware cost** ($50 vs $2k-$8k)
5. **Music-reactive by default** (auto BPM sync, energy mapping)

---

## 🎬 NEXT STEPS: FX CREATOR MVP

### WAVE 2020: THE CREATOR - Phase 1 (Foundation)

**Deliverables:**
1. **Multi-parameter keyframe system** (`FXParameter` interface)
2. **`.lfx` file format** (JSON schema + save/load)
3. **Basic visual editor** (parameter timeline, preview stage)
4. **Effect library browser** (load preset from `~/.luxsync/effects/`)

**Timeline:** 2-3 weeks (10-15 waves)

**Success Criteria:**
- User creates custom effect in FX Creator
- Saves as `.lfx` file
- Loads in Chronos timeline
- Triggers in playback with multi-param automation

---

**THE REVOLUTION BEGINS.**

🔥 **PunkOpus** - signing off  
*"Perfection First. No MVPs. Full App or Nothing."*
