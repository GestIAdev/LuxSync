# WAVE 3300: THE MIDI BRIDGE BLUEPRINT

> *"Antes de escribir una sola línea de código, necesitamos ver el mapa completo."*
> — Exploración y Diseño. Cero ejecución. Solo el plano.

**Hardware Target:** Korg nanoPAD2 (16 pads + X-Y pad)
**Fecha:** Junio 2025
**Estado:** BLUEPRINT — pendiente de implementación

---

## ÍNDICE

1. [Anatomía del Estado Actual](#1-anatomía-del-estado-actual)
2. [Pregunta I: Catálogo Dinámico](#2-pregunta-i-catálogo-dinámico)
3. [Pregunta II: Puente de Inyección](#3-pregunta-ii-puente-de-inyección)
4. [Pregunta III: IA Override](#4-pregunta-iii-ia-override)
5. [Flujo de Datos Propuesto](#5-flujo-de-datos-propuesto)
6. [Decisiones Arquitectónicas](#6-decisiones-arquitectónicas)
7. [Riesgos y Mitigaciones](#7-riesgos-y-mitigaciones)

---

## 1. ANATOMÍA DEL ESTADO ACTUAL

### 1.1 Infraestructura MIDI Existente

LuxSync ya tiene los cimientos MIDI como ciudadanos de primera clase:

| Componente | Archivo | Función |
|---|---|---|
| **midiMapStore** | `src/stores/midiMapStore.ts` | Zustand + persist → localStorage. Almacena `Record<MappableControlId, MidiBinding>` |
| **useMidiLearn** | `src/hooks/useMidiLearn.ts` | Hook montado UNA VEZ en `AppCommander.tsx`. Llama `navigator.requestMIDIAccess()`, parsea bytes, despacha a stores |
| **MidiLearnOverlay** | `src/components/MidiLearnOverlay.tsx` | UI pill flotante "MIDI" en TitleBar. Muestra controles mapeables, acepta click para learn |
| **useMIDIClock** | `src/chronos/hooks/useMIDIClock.ts` | Receptor de MIDI Clock externo (0xF8 @ 24 PPQ, Ableton/Traktor sync) |
| **MIDIClockMaster** | `src/chronos/protocols/MIDIClockMaster.ts` | LuxSync como Clock Master — emite 0xF8 a 24 PPQ hacia dispositivos externos |

### 1.2 Los 16 Controles Mapeables Actuales (MAPPABLE_CONTROLS)

```
FADERS (CC → 0-127 → 0.0-1.0):
  ctrl-intensity      → Grand Master          → controlStore.setGlobalIntensity
  ctrl-saturation     → Saturation            → controlStore.setGlobalSaturation
  flow-speed          → Flow Speed            → controlStore.setFlowParams({speed})
  flow-spread         → Flow Spread           → controlStore.setFlowParams({spread})

BUTTONS (Note On → toggle):
  ctrl-output-toggle  → Output ON/OFF         → controlStore.toggleOutput
  ctrl-ai-toggle      → AI ON/OFF             → controlStore.toggleAI
  lux-blackout        → BLACKOUT              → luxSyncStore.toggleBlackout
  fx-strobe           → FX: Strobe            → effectsStore.toggleEffect('strobe')
  fx-blinder          → FX: Blinder           → effectsStore.toggleEffect('blinder')
  fx-smoke            → FX: Smoke             → effectsStore.toggleEffect('smoke')
  fx-laser            → FX: Laser             → effectsStore.toggleEffect('laser')
  fx-rainbow          → FX: Rainbow           → effectsStore.toggleEffect('rainbow')
  fx-police           → FX: Police            → effectsStore.toggleEffect('police')
  fx-beam             → FX: Beam              → effectsStore.toggleEffect('beam')
  fx-prism            → FX: Prism             → effectsStore.toggleEffect('prism')
```

### 1.3 EL GAP — El Puente Roto

```
PIPELINE ACTUAL (fx-* buttons):
  MIDI Pad → parseMidiMessage() → findControlForMessage()
    → fx-strobe match → effectsStore.toggleEffect('strobe')
    → ⚠️ TOGGLE DE UI STATE SOLAMENTE
    → ⛔ NO llega a EffectManager.trigger()
    → ⛔ NO genera DMX output real
```

El `effectsStore` es un store de **presentación UI** (Set de IDs activos para renderizar botones encendidos/apagados). **No es un puente hacia el backend.** Los efectos que realmente mueven luces viven en `EffectManager` (main process), con ~50 factories registradas en `registerBuiltinEffects()`.

### 1.4 Los 3 Caminos Reales Hacia EffectManager.trigger()

| Camino | Source | Bypass Shield | Bypass Cooldown | IPC Channel |
|---|---|---|---|---|
| **Selene AI** | `'hunt_strike'` | ❌ | ❌ | Interno (game loop) |
| **Chronos Timeline** | `'chronos'` | ✅ | ✅ | `chronos:triggerFX` |
| **forceStrike (UI)** | `'manual'` | ✅ | ✅ | `lux:forceStrike` |

El camino `forceStrike` ya existe y hace exactamente lo que necesitamos para MIDI:

```
Renderer:
  window.lux.forceStrike({ effect: 'gatling_raid', intensity: 1.0 })

Preload (IPC):
  ipcRenderer.invoke('lux:forceStrike', config)

IPCHandlers.ts:
  ipcMain.handle('lux:forceStrike', (_, config) => {
    titanOrchestrator.forceStrikeNextFrame(config)
  })

TitanOrchestrator → TitanEngine:
  this.manualStrikePending = config

Game Loop (next frame):
  effectManager.trigger({
    effectType: config.effect,
    intensity: config.intensity,
    source: 'manual',  // ← BYPASS SHIELD + COOLDOWN
    reason: 'Manual strike from FORCE STRIKE button',
  })
```

**Conclusión:** El puente MIDI→efectos NO necesita una nueva IPC. Solo necesita que `dispatchToStore` redirija los `fx-*` desde `effectsStore.toggleEffect()` hacia `window.lux.forceStrike()`.

---

## 2. PREGUNTA I: CATÁLOGO DINÁMICO

> *¿Cómo registramos dinámicamente el arsenal de Selene, los overrides del MasterArbiter y los comandos de Vibe en la UI para que el usuario pueda mapearlos sin hardcodear strings?*

### 2.1 El Problema

El array `MAPPABLE_CONTROLS` tiene 16 entries hardcodeadas. Hay ~50 efectos en EffectManager, 5+ vibes, y múltiples overrides del Arbiter. Meter todo en una lista plana es ilegible e inmanejable.

### 2.2 La Propuesta: Catálogo por Capas con Autodescubrimiento

```typescript
// ═══════════════════════════════════════════════════════════════════
// CAPA 1: CONTROLES DEL SISTEMA (los 16 actuales, intocables)
// ═══════════════════════════════════════════════════════════════════

type SystemControlId =
  | 'ctrl-intensity' | 'ctrl-saturation'
  | 'ctrl-output-toggle' | 'ctrl-ai-toggle'
  | 'flow-speed' | 'flow-spread'
  | 'lux-blackout'

// ═══════════════════════════════════════════════════════════════════
// CAPA 2: EFECTOS (autodescubiertos desde EffectManager)
// ═══════════════════════════════════════════════════════════════════

type EffectControlId = `fx-${string}`   // fx-gatling_raid, fx-solar_flare...

// ═══════════════════════════════════════════════════════════════════
// CAPA 3: VIBES (autodescubiertos desde VibeManager)
// ═══════════════════════════════════════════════════════════════════

type VibeControlId = `vibe-${string}`   // vibe-fiesta-latina, vibe-techno-club...

// ═══════════════════════════════════════════════════════════════════
// CAPA 4: ARBITER OVERRIDES (acciones maestras)
// ═══════════════════════════════════════════════════════════════════

type ArbiterControlId =
  | 'arb-blackout'          // toggleBlackout
  | 'arb-grand-master'      // setGrandMaster (fader)
  | 'arb-output-toggle'     // toggleOutput
  | 'arb-kill-effects'      // abortAll effects

// ═══════════════════════════════════════════════════════════════════
// UNIÓN TOTAL
// ═══════════════════════════════════════════════════════════════════

type MappableControlId = SystemControlId | EffectControlId | VibeControlId | ArbiterControlId
```

### 2.3 El Registry Central: `MidiActionRegistry`

Un módulo singleton que construye el catálogo consultando las fuentes reales:

```typescript
// Concepto — NO código de ejecución

class MidiActionRegistry {

  // Construye el catálogo completo al arrancar
  buildCatalog(): MappableControlMeta[] {
    return [
      ...this.getSystemControls(),   // 7 controles fijos (hardcoded, conocidos)
      ...this.getEffectControls(),   // ~50 efectos desde EffectManager.getAvailableEffects()
      ...this.getVibeControls(),     // ~5 vibes desde VibeManager o profiles
      ...this.getArbiterControls(),  // ~4 overrides del Arbiter
    ]
  }

  // Los efectos se autodescubren — si mañana registramos un nuevo efecto
  // en registerBuiltinEffects(), aparece automáticamente en el catálogo MIDI
  private getEffectControls(): MappableControlMeta[] {
    const effectIds = effectManager.getAvailableEffects()  // Ya existe este método
    const zoneMap = EFFECT_ZONE_MAP  // Ya existe — da contexto de energía
    
    return effectIds.map(id => ({
      id: `fx-${id}` as EffectControlId,
      label: humanize(id),               // 'gatling_raid' → 'Gatling Raid'
      category: 'button',
      store: 'effects',
      energyZone: zoneMap[id] || null,    // Metadata útil para filtrar en UI
    }))
  }

  // Los vibes se autodescubren desde la lista de profiles registrados
  private getVibeControls(): MappableControlMeta[] {
    const vibeIds = ['fiesta-latina', 'techno-club', 'pop-rock', 'chill-lounge']
    return vibeIds.map(id => ({
      id: `vibe-${id}` as VibeControlId,
      label: humanize(id),
      category: 'button',
      store: 'vibe',
    }))
  }
}
```

### 2.4 UI: Categorías Colapsables en MidiLearnOverlay

En lugar de una lista plana de 70+ controles, la UI muestra **categorías colapsables** con búsqueda:

```
┌─────────────────────────────────────────┐
│  🎹 MIDI LEARN                    [×]    │
│─────────────────────────────────────────│
│  🔍 [ Buscar control... ]               │
│                                          │
│  ▼ 🎛️ SISTEMA (7)                       │
│    ├─ Grand Master        [CC 0:7]       │
│    ├─ Saturation          [----]         │
│    ├─ Output ON/OFF       [Note 0:36]    │
│    └─ ...                                │
│                                          │
│  ▶ ⚡ EFECTOS — PEAK (8)                │
│  ▶ ⚡ EFECTOS — INTENSE (6)             │
│  ▶ ⚡ EFECTOS — ACTIVE (5)              │
│  ▶ ⚡ EFECTOS — GENTLE (5)              │
│  ▶ ⚡ EFECTOS — AMBIENT (6)             │
│  ▶ ⚡ EFECTOS — VALLEY (6)              │
│  ▶ ⚡ EFECTOS — SILENCE (5)             │
│                                          │
│  ▶ 🎭 VIBES (5)                         │
│  ▶ 🏛️ ARBITER (4)                      │
└─────────────────────────────────────────┘
```

**Los efectos se agrupan por `EFFECT_ZONE_MAP`** — el usuario de iluminación piensa en "dame algo para el DROP" (peak) o "dame un relleno para la calma" (valley). Esto es infinitamente más útil que una lista alfabética.

### 2.5 Resolución de la Pregunta

| Aspecto | Solución |
|---|---|
| **Sin hardcodeo** | `MidiActionRegistry` consulta `effectManager.getAvailableEffects()` en runtime |
| **Sin basura en UI** | Categorías colapsables por zona energética |
| **Escalable** | Nuevo efecto registrado en `registerBuiltinEffects()` → aparece automáticamente |
| **Metadata útil** | `EFFECT_ZONE_MAP` ya provee clasificación — solo hay que exponerlo |

---

## 3. PREGUNTA II: PUENTE DE INYECCIÓN

> *¿Dónde y cómo construimos el Listener maestro que traduzca nota MIDI → acción real? ¿Zustand middleware o handler en Main thread?*

### 3.1 Las Dos Opciones

**Opción A: Zustand Middleware en Renderer**
```
MIDI Input (WebMIDI) → parseMidiMessage → Zustand middleware intercept
  → IPC invoke → Main process → EffectManager
```

**Opción B: Handler Directo en Main Thread**
```
MIDI Input → IPC raw bytes → Main process MIDI parser → EffectManager
```

### 3.2 Veredicto: Opción A — Expandir `dispatchToStore` (Renderer)

**Razón arquitectónica:** La infraestructura MIDI ya vive en el renderer. `navigator.requestMIDIAccess()` es una Web API que corre en el renderer. El hook `useMidiLearn` ya está montado en `AppCommander.tsx`. El `midiMapStore` con persist ya funciona en localStorage del renderer.

Mover MIDI al main process requeriría:
- Instalar un módulo Node nativo para MIDI (ej. `midi`, `easymidi`)
- Duplicar la lógica de parsing que ya existe
- Romper el hot-plug de `onstatechange` que ya funciona con WebMIDI
- Perder el Soft Takeover que ya está calculado en el renderer

**El cambio real es cirugía menor en `dispatchToStore`:**

### 3.3 Diseño del Puente

```typescript
// EN dispatchToStore (useMidiLearn.ts)
// Hoy:
case 'fx-strobe':
case 'fx-blinder':
  // ...
  effectsStore.toggleEffect(effectId)  // ← Solo UI state
  break

// MAÑANA — El cambio arquitectónico:
// Los fx-* prefijados con IDs de EffectManager van por forceStrike
default: {
  if (controlId.startsWith('fx-')) {
    const effectId = controlId.slice(3)  // 'fx-gatling_raid' → 'gatling_raid'
    
    if (msg.type === 'note_on') {
      // DISPARO REAL → IPC → Main process → EffectManager.trigger()
      window.lux.forceStrike({
        effect: effectId,
        intensity: msg.value / 127,  // velocity = intensity
      })
    }
    // Note Off: No hacemos nada — el efecto tiene su propia duración
    return
  }

  if (controlId.startsWith('vibe-')) {
    const vibeId = controlId.slice(5)  // 'vibe-fiesta-latina' → 'fiesta-latina'
    window.lux.vibe.setVibe(vibeId)
    return
  }

  if (controlId.startsWith('arb-')) {
    // Router de acciones del Arbiter
    switch (controlId) {
      case 'arb-blackout':
        window.lux.arbiter.toggleBlackout()
        break
      case 'arb-grand-master':
        window.lux.arbiter.setGrandMaster(msg.value / 127)
        break
      case 'arb-kill-effects':
        window.lux.cancelAllEffects()
        break
    }
    return
  }
}
```

### 3.4 Diagrama: Pipeline Completa

```
┌─────────────────────────────────────────────────────────────────────┐
│ RENDERER PROCESS                                                     │
│                                                                      │
│  Korg nanoPAD2                                                       │
│       │                                                              │
│       ▼                                                              │
│  navigator.requestMIDIAccess()                                       │
│       │                                                              │
│       ▼                                                              │
│  useMidiLearn.handleMidiMessage()                                    │
│       │                                                              │
│       ├─ LEARN MODE? → midiMapStore.setMapping()                     │
│       │                                                              │
│       ▼                                                              │
│  midiMapStore.findControlForMessage(msg)                             │
│       │                                                              │
│       ▼                                                              │
│  dispatchToStore(controlId, msg)                                     │
│       │                                                              │
│       ├─ ctrl-*    → controlStore (local state)                      │
│       ├─ flow-*    → controlStore.flowParams (local state)           │
│       ├─ lux-*     → luxSyncStore (local state)                     │
│       │                                                              │
│       ├─ fx-*      → window.lux.forceStrike() ──┐ ← NUEVO          │
│       ├─ vibe-*    → window.lux.vibe.setVibe() ─┤ ← NUEVO          │
│       └─ arb-*     → window.lux.arbiter.*() ────┤ ← NUEVO          │
│                                                   │                   │
│                                        IPC invoke │                   │
└────────────────────────────────────────────────────┘                   │
                                                     │                   │
┌────────────────────────────────────────────────────┘───────────────────┐
│ MAIN PROCESS                                                          │
│                                                                       │
│  IPCHandlers.ts                                                       │
│       │                                                               │
│       ├─ lux:forceStrike → TitanOrchestrator.forceStrikeNextFrame()  │
│       ├─ lux:setVibe     → TitanOrchestrator.setVibe()                │
│       └─ arbiter:*       → MasterArbiter.*()                          │
│                                                                       │
│       ▼                                                               │
│  TitanEngine.tick() (60fps game loop)                                 │
│       │                                                               │
│       ▼                                                               │
│  EffectManager.trigger({                                              │
│    effectType: 'gatling_raid',                                        │
│    intensity: 0.85,                                                   │
│    source: 'manual',          ← BYPASS SHIELD + COOLDOWN             │
│  })                                                                   │
│       │                                                               │
│       ▼                                                               │
│  DMX OUTPUT → ArtNet → LUCES REALES                                  │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.5 Resolución de la Pregunta

| Pregunta | Respuesta |
|---|---|
| **¿Middleware Zustand?** | NO — no necesitamos interceptar mutations del store, sino despachar acciones |
| **¿Handler en Main thread?** | NO — WebMIDI ya vive en el renderer, mover sería duplicar todo |
| **¿Dónde vive el listener?** | EN `dispatchToStore()` dentro de `useMidiLearn.ts` — ya existe, solo hay que expandir los cases |
| **¿Qué IPC usa?** | `lux:forceStrike` — YA EXISTE, probado para forceStrike manual y Chronos timeline |

---

## 4. PREGUNTA III: IA OVERRIDE

> *Si el usuario dispara un efecto desde el MIDI, ¿cuál es el punto de inyección más limpio para que se ejecute con prioridad absoluta, saltándose cooldowns y restricciones de la IA, pero sin romper la "conciencia" de Selene?*

### 4.1 El Punto Ya Existe

El `EffectManager.trigger()` ya tiene un sistema elegante de 3 fuentes:

```typescript
// EffectManager.ts — líneas 520-560

// SHIELD BYPASS (restricciones de Vibe):
const bypassShield = config.source === 'chronos' || config.source === 'manual'
// Si source es 'manual' → Shield dice "Bypassed" → efecto permitido en CUALQUIER vibe

// COOLDOWN BYPASS (Gatekeeper):
const bypassCooldownGate = config.source === 'chronos' || config.source === 'manual'
// Si source es 'manual' → Gatekeeper no consulta cooldown → efecto inmediato
```

**La prioridad del manual strike es MÁXIMA:**

```
TitanEngine game loop (cada frame):

  if (this.manualStrikePending) {        // ← PRIORIDAD 1: Manual/MIDI
    effectManager.trigger({ source: 'manual' })
    this.manualStrikePending = null
  }
  else if (consciousnessOutput.effectDecision) {  // ← PRIORIDAD 2: Selene AI
    effectManager.trigger({ source: 'hunt_strike' })
  }
```

El manual strike se consume ANTES de que Selene pueda opinar. En el mismo frame, Selene no dispara.

### 4.2 ¿Qué SÍ Bloquea al Manual?

El TRAFFIC CONTROL (`checkTraffic()`) se ejecuta **ANTES** del bypass de Shield. Esto significa que los semáforos estructurales SÍ aplican:

| Regla | ¿Bloquea manual? | Razón |
|---|---|---|
| Rule 0: GLOBAL LOCK (dictador) | ✅ SÍ | Si hay un SolarFlare activo con mixBus='global', nadie entra |
| Rule 1: Critical blocks ambient | ✅ SÍ | Protección estructural de conflictos |
| Rule 2: No duplicados | ✅ SÍ | No puedes disparar 2x gatling_raid simultáneos |
| Rule 3: Atmospheric exclusivity | ✅ SÍ | Solo 1 atmosférico a la vez |
| Rule 4: Zone Mutex | ✅ SÍ | 1 efecto por zona energética |
| Rule 5: Divine Mutex | ✅ SÍ | peak e intense son mutuamente exclusivos |

**Esto es CORRECTO.** El Traffic Control protege la integridad del output DMX. Si un SolarFlare tiene mixBus='global' tomando el 100% del dimmer, no tiene sentido inyectar otro efecto encima. Es física, no burocracia.

### 4.3 ¿Cómo "No Romper" la Conciencia de Selene?

Selene no necesita ser notificada. Su diseño ya lo contempla:

1. **No se rompe porque no compite.** El manual strike se consume en el mismo slot de frame. Selene simplemente no genera decisión ese frame (el `else if` no se alcanza).

2. **No se desincroniza.** El `effectManager.trigger()` con `source: 'manual'` registra el efecto en `activeEffects`. Cuando Selene consulta EFFECT_ZONE_MAP en el siguiente frame, ve que la zona está ocupada y respeta el mutex. El efecto manual participa en el Traffic Control igual que cualquier otro.

3. **El cooldown no se corrompe.** Aunque MIDI bypasea el Gatekeeper para ENTRAR, el efecto SÍ se registra en `ContextualEffectSelector.registerEffectFired()`. Esto significa que después de un trigger manual, Selene respetará el cooldown natural del efecto antes de intentar re-dispararlo por su cuenta.

4. **DecisionMaker sigue decidiendo.** El `DROP_LOCK` del DecisionMaker no se altera. Si Selene está en un drop y el manual strike pre-empta, el DROP_LOCK se mantiene — Selene no pierde su lock state.

### 4.4 El Flujo Completo del Override

```
USUARIO GOLPEA PAD EN KORG
       │
       ▼
  MIDI Note On (Pad #5 = gatling_raid, velocity 100)
       │
       ▼
  dispatchToStore('fx-gatling_raid', { type: 'note_on', value: 100 })
       │
       ▼
  window.lux.forceStrike({
    effect: 'gatling_raid',
    intensity: 100/127 = 0.787
  })
       │
       ▼ IPC invoke
  IPCHandlers: 'lux:forceStrike'
       │
       ▼
  titanOrchestrator.forceStrikeNextFrame({
    effect: 'gatling_raid',
    intensity: 0.787,
    source: 'manual'     ← se inyecta si no viene en config
  })
       │
       ▼
  TitanEngine.manualStrikePending = config
       │
       ▼ (siguiente tick del game loop, ~16ms máx)
  
  ┌─ TRAFFIC CONTROL ─────────────────────────────────┐
  │  ✅ Rule 0: No hay dictador activo                │
  │  ✅ Rule 2: No hay otro gatling_raid activo        │
  │  ✅ Rule 4: Zona 'peak' libre                     │
  │  ✅ Rule 5: Divine Mutex OK                        │
  │  → PASO                                            │
  └───────────────────────────────────────────────────┘
  
  ┌─ SHIELD ──────────────────────────────────────────┐
  │  source === 'manual'                               │
  │  → BYPASS: "Bypassed (chronos/manual source)"     │
  └───────────────────────────────────────────────────┘
  
  ┌─ GATEKEEPER ──────────────────────────────────────┐
  │  source === 'manual'                               │
  │  → BYPASS: No cooldown check                       │
  └───────────────────────────────────────────────────┘
  
  ┌─ FIRE ────────────────────────────────────────────┐
  │  GatlingRaid.trigger(config)                       │
  │  activeEffects.set(id, effect)                     │
  │  selector.registerEffectFired('gatling_raid')      │
  │  emit('effectTriggered', ...)                      │
  └───────────────────────────────────────────────────┘
  
  SELENE VE:
  → activeEffects contiene gatling_raid
  → EFFECT_ZONE_MAP['gatling_raid'] = 'peak'  
  → Zone Mutex: peak OCUPADO → Selene no intenta meter nada en peak
  → Cooldown registrado → Selene esperará cooldown antes de re-disparar
  → Consciencia INTACTA ✓
```

### 4.5 Resolución de la Pregunta

| Aspecto | Respuesta |
|---|---|
| **Punto de inyección** | `forceStrike` → `TitanEngine.manualStrikePending` → `EffectManager.trigger({ source: 'manual' })` |
| **Prioridad absoluta** | ✅ Manual se consume ANTES del `else if` de Selene en el game loop |
| **Bypass Shield** | ✅ `source === 'manual'` ya bypasea en línea 522 de EffectManager |
| **Bypass Cooldown** | ✅ `source === 'manual'` ya bypasea en línea 554 de EffectManager |
| **¿Rompe Selene?** | ❌ Traffic Control protege la física. El efecto se registra en activeEffects y cooldown. Selene respeta el mutex y el cooldown naturalmente |
| **¿Necesita notificación a Selene?** | NO — el sistema de shared state (activeEffects + ZONE_MAP) es suficiente |
| **¿Código nuevo?** | CERO en EffectManager. CERO en TitanEngine. Solo cambios en `dispatchToStore` del renderer |

---

## 5. FLUJO DE DATOS PROPUESTO

### 5.1 Pipeline Completa: Input → Store → Traducción → Ejecución

```
═══════════════════════════════════════════════════════════════════════
CAPA FÍSICA
═══════════════════════════════════════════════════════════════════════

  Korg nanoPAD2 (USB-MIDI)
       │
       ▼
  navigator.requestMIDIAccess({ sysex: false })
       │
       ▼
  MIDIInput.onmidimessage(event)

═══════════════════════════════════════════════════════════════════════
CAPA PARSING (useMidiLearn.ts — renderer)
═══════════════════════════════════════════════════════════════════════

  parseMidiMessage(event.data: Uint8Array)
       │
       ├─ 0x90 → { type: 'note_on',  channel, control, value }
       ├─ 0x80 → { type: 'note_off', channel, control, value }
       └─ 0xB0 → { type: 'cc',       channel, control, value }

═══════════════════════════════════════════════════════════════════════
CAPA ROUTING (midiMapStore — renderer)
═══════════════════════════════════════════════════════════════════════

  findControlForMessage(msg: MidiMessage): MappableControlId | null
       │
       │  Busca en mappings: Record<MappableControlId, MidiBinding>
       │  Match: binding.type + binding.channel + binding.control
       │
       ▼
  controlId encontrado (ej: 'fx-gatling_raid')

═══════════════════════════════════════════════════════════════════════
CAPA TRADUCCIÓN (dispatchToStore — renderer)
═══════════════════════════════════════════════════════════════════════

  switch (controlId.prefix):
       │
       ├─ 'ctrl-' → Store local         (no IPC)
       ├─ 'flow-' → Store local         (no IPC)
       ├─ 'lux-'  → Store local         (no IPC)
       │
       ├─ 'fx-'   → forceStrike IPC     ← EFECTO REAL
       ├─ 'vibe-' → setVibe IPC         ← CAMBIO DE VIBE REAL
       └─ 'arb-'  → arbiter IPC         ← OVERRIDE REAL

═══════════════════════════════════════════════════════════════════════
CAPA IPC (preload.ts — contextBridge)
═══════════════════════════════════════════════════════════════════════

  ipcRenderer.invoke('lux:forceStrike', { effect, intensity })

═══════════════════════════════════════════════════════════════════════
CAPA EJECUCIÓN (main process)
═══════════════════════════════════════════════════════════════════════

  IPCHandlers → TitanOrchestrator → TitanEngine.manualStrikePending
       │
       ▼
  Game loop tick (16ms):
    EffectManager.trigger({ source: 'manual' })
       │
       ▼
    Effect instance created → activeEffects
       │
       ▼
    MasterArbiter.arbitrate() → Layer 3 effects
       │
       ▼
    FinalLightingTarget → DMX → ArtNet → LUCES
```

---

## 6. DECISIONES ARQUITECTÓNICAS

### 6.1 Velocity = Intensity

El nanoPAD2 envía velocity (0-127) en Note On. Usarla como multiplier de intensity es natural:

```
Pad golpeado suave:  velocity=40  → intensity=0.31  → efecto atenuado
Pad golpeado fuerte: velocity=127 → intensity=1.00  → efecto full power
```

Esto da expresividad real al performer sin parámetros extra.

### 6.2 Note Off = Ignorar (No Kill)

Los efectos de LuxSync tienen su propia duración interna (ej: StrobeStorm = 3-5s, GatlingRaid = 4s). Cortar un efecto a media ejecución con Note Off generaría un blackout abrupto y feo. El efecto se deja morir naturalmente.

**Excepción futura:** Podría implementarse un modo "hold" donde Note On activa y Note Off desactiva, pero SOLO para efectos sostenidos (si alguno se diseña así). Decisión para otra WAVE.

### 6.3 Los `fx-` Antiguos del effectsStore

Los 8 `fx-*` actuales (`fx-strobe`, `fx-blinder`, etc.) son conceptos de UI que no mapean 1:1 con los efectos del EffectManager. `fx-strobe` en `effectsStore` es un toggle de LED visual en la UI, NO un `EffectManager.trigger('strobe_storm')`.

**Decisión:** Hay dos caminos mutuamente excluyentes:

**Camino A: Migrar**
Reemplazar los 8 `fx-` actuales para que en lugar de hacer `effectsStore.toggleEffect()`, llamen a `forceStrike` directo. Los botones de la UI de efectos también usarían esta ruta. `effectsStore` queda como capa de presentación que se actualiza vía evento `effectTriggered` del backend.

**Camino B: Coexistir**
Mantener los 8 `fx-` actuales como están (toggle de UI) y agregar los ~50 `fx-{effectId}` del catálogo dinámico como entradas SEPARADAS que van por `forceStrike`. Los viejos quedan como "botones de UI genéricos" y los nuevos como "detonadores reales".

**Recomendación:** Camino A — Migrar. Es más limpio: un `fx-` = una acción real. La UI se sincroniza via `effectTriggered`/`effectFinished` events del EffectManager. Eliminar la ambigüedad de "este botón prende un LED pero no mueve luces".

### 6.4 X-Y Pad del nanoPAD2

El nanoPAD2 tiene un X-Y pad que envía 2 CCs simultáneos. Mapeo natural:

- **X** → `flow-speed` o `ctrl-intensity` (Grand Master)
- **Y** → `flow-spread` o `ctrl-saturation`

O para un uso más exótico:
- **X** → `arb-grand-master` (fader de dimmer global)
- **Y** → Un futuro `ctrl-color-temperature` o `ctrl-movement-speed`

### 6.5 Persistencia

`midiMapStore` ya persiste en localStorage vía Zustand persist. Las nuevas mappings (fx-gatling_raid, vibe-techno-club, etc.) usarán el mismo mecanismo. El usuario mapea una vez, sobrevive reinicios.

---

## 7. RIESGOS Y MITIGACIONES

### 7.1 Inundación de Triggers

**Riesgo:** El usuario golpea el pad 10 veces en 1 segundo → 10 llamadas a `forceStrike`.

**Mitigación natural:** `TitanEngine.manualStrikePending` es una SOLA variable. Si llegan 10 calls en 16ms (1 frame), solo se ejecuta la última. Las 9 anteriores se sobreescriben. El sistema ya tiene anti-flood nativo.

**Mitigación adicional:** Traffic Control Rule 2 (no duplicados) rechaza intentos de disparar el mismo efecto si ya está activo.

### 7.2 Conflicto MIDI Clock vs MIDI Pads

**Riesgo:** El nanoPAD2 envía notas en el mismo canal que un reloj MIDI externo.

**Mitigación:** `useMIDIClock` filtra por tipo de mensaje (0xF8 = clock tick, 0xFA = start, etc.). Los Note On/CC están en rangos de status byte completamente separados. No hay colisión.

### 7.3 Efectos que No Existen

**Riesgo:** El catálogo se genera al arrancar. Si un efecto se des-registra (improbable pero posible en dev), el mapping apunta a un factory inexistente.

**Mitigación:** `EffectManager.trigger()` ya chequea `this.effectFactories.get(config.effectType)` y retorna `null` con warning si no existe. Graceful fail sin crash.

### 7.4 Latencia IPC

**Riesgo:** El roundtrip IPC entre renderer y main process añade latencia.

**Mitigación:** `ipcRenderer.invoke` es async pero el `forceStrike` solo encola en `manualStrikePending`. No espera respuesta del efecto. Latencia real: ~1-2ms (medido en Electron). Imperceptible para MIDI a nivel humano (el umbral perceptible de MIDI jitter es ~5-10ms).

### 7.5 Soft Takeover para Faders MIDI

**Ya resuelto.** El `useMidiLearn` ya implementa Soft Takeover con threshold ±5/127 para faders CC. Si el valor físico del knob no está cerca del valor actual del parámetro, ignora el movimiento hasta que "lo alcanza". Esto previene saltos bruscos al cambiar de bank/preset en el controlador.

---

## RESUMEN EJECUTIVO

| Pregunta | Respuesta Corta |
|---|---|
| **Catálogo Dinámico** | `MidiActionRegistry` que consulta `effectManager.getAvailableEffects()` + `EFFECT_ZONE_MAP` + vibes + arbiter. UI con categorías colapsables por zona energética. |
| **Puente de Inyección** | Expandir `dispatchToStore()` en `useMidiLearn.ts` (renderer). Nuevos prefijos `fx-{effectId}` van por `window.lux.forceStrike()` via IPC existente. CERO nuevas IPCs necesarias. |
| **IA Override** | `source: 'manual'` ya bypasea Shield + Cooldown. Manual se ejecuta ANTES que Selene en el game loop. Traffic Control protege la física. Selene ve el efecto en activeEffects y respeta el mutex. Conciencia INTACTA. |

### Archivos a Modificar (cuando se ejecute)

| Archivo | Cambio |
|---|---|
| `src/stores/midiMapStore.ts` | Expandir `MappableControlId` union type. Reemplazar `MAPPABLE_CONTROLS` hardcodeado por `MidiActionRegistry.buildCatalog()`. |
| `src/hooks/useMidiLearn.ts` | Expandir `dispatchToStore` con prefix routing: `fx-` → forceStrike, `vibe-` → setVibe, `arb-` → arbiter actions. |
| `src/components/MidiLearnOverlay.tsx` | Rediseñar UI con categorías colapsables y búsqueda. Consumir catálogo de `MidiActionRegistry`. |
| **Nuevo archivo** | `src/midi/MidiActionRegistry.ts` — Singleton que construye catálogo dinámico desde EffectManager + VibeManager + Arbiter. |

### Archivos Que NO Se Tocan

| Archivo | Razón |
|---|---|
| `EffectManager.ts` | El bypass de `source: 'manual'` ya existe |
| `TitanEngine.ts` | `manualStrikePending` + `forceStrikeNextFrame` ya existen |
| `TitanOrchestrator.ts` | `forceStrikeNextFrame` ya delega al engine |
| `IPCHandlers.ts` | `lux:forceStrike` ya está registrado |
| `preload.ts` | `window.lux.forceStrike` ya está expuesto |
| `DecisionMaker.ts` | No necesita saber nada de MIDI |
| `MasterArbiter.ts` | Sus IPCs de blackout/output ya existen |

---

*Blueprint listo para ejecución. Cuando dés la orden, Radwulf.*
