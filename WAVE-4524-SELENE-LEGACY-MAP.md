# WAVE 4524.1 — THE SELENE COGNITIVE TRACE

> Auditoría de Interfaz de Salida Legacy (Selene IA → Orchestrator)
> Estado: INVESTIGACIÓN Y DOCUMENTACIÓN — PROHIBIDO ESCRIBIR CÓDIGO AETHER

---

## 1. EL CONTRATO DE VEREDICTO (DecisionMaker Output)

### 1.1 Raíz: `ConsciousnessOutput`

```typescript
interface ConsciousnessOutput {
  colorDecision:       ConsciousnessColorDecision | null
  physicsModifier:     ConsciousnessPhysicsModifier | null
  movementDecision:    ConsciousnessMovementDecision | null
  effectDecision:      ConsciousnessEffectDecision | null   // 🧨 WAVE 600
  confidence:          number
  timestamp:           number
  source:              DecisionSource
  debugInfo:           ConsciousnessDebugInfo
}
```

**Observación:** Es **un solo objeto por frame**, sin arrays por fixture ni por zona.

### 1.2 `ConsciousnessColorDecision`

- `suggestedHue`, `suggestedStrategy` ('analogous'|'complementary'|'triadic'|'split-complementary'|'prism'), `saturationMod`, `brightnessMod`
- **Uso legacy:** `applyConsciousnessColorDecision(palette, colorDecision)` modifica la `ColorPalette` HSL **global** antes de empaquetar `LightingIntent`. No toca zonas individualmente.

### 1.3 `ConsciousnessPhysicsModifier`

- `strobeIntensity`, `flashIntensity`, `triggerThresholdMod`
- **Uso legacy:** `applyConsciousnessPhysicsModifier(effects, physicsModifier)` solo si `confidence > 0.5` **Y** `smoothedEnergy < 0.85` (Energy Override). Modifica parámetros strobe/flash del motor, no dispara efectos nominales.

### 1.4 `ConsciousnessMovementDecision` — **CABLE MUERTO**

```typescript
interface ConsciousnessMovementDecision {
  pattern?: 'sweep'|'chase'|'static'|'mirror'|'circle'|'figure8'|'wave'
  speedMultiplier?: number
  confidence: number
}
```

- `DecisionMaker.makeDecision()` lo puede retornar, pero `TitanEngine.update()` **nunca lo consume** para alterar `MovementIntent`.
- Único uso real: `getConsciousnessTelemetry()` lo muestra en UI como `"lastDecision: 'Movement Change'"`.
- **Hallazgo:** Movimiento procede 100% de `VibeMovementManager` basado en audio, no de decisiones cognitivas de Selene.

### 1.5 `ConsciousnessEffectDecision`

```typescript
interface ConsciousnessEffectDecision {
  effectType: string   // e.g. 'solar_flare', 'core_meltdown'
  intensity: number
  zones?: ('all'|'front'|'back'|'movers'|'movers_left'|'movers_right'|'pars')[]
  reason?: string
  confidence: number
}
```

- **Uso legacy:** Si `confidence > 0.6`, `TitanEngine` invoca `effectManager.trigger({effectType, intensity, zones, source:'hunt_strike', musicalContext})`.
- `EffectManager` aloja instancias `BaseEffect` con fases TRIGGER→SUSTAIN→DECAY.

---

## 2. EL ENRUTAMIENTO ESPACIAL (Zonas)

### 2.1 Modelo abstracto de Selene

Selene NO conoce fixtures individuales. Solo habla en zonas canónicas:

| Zona | Semántica |
|------|-----------|
| `'all'` | Todos |
| `'front'` | Pars frontales |
| `'back'` | Pars traseros |
| `'movers'` | Moving heads ambos lados |
| `'movers_left'` | Movers izquierdos |
| `'movers_right'` | Movers derechos |
| `'pars'` | Todos los PARs |

### 2.2 Resolución legacy

```
Selene.effectDecision.zones
    → TitanOrchestrator / EffectManager
        → ZoneMapper.fixtureMatchesZone(fixtureZone, zoneKey, positionX)
            → FixtureSnapshot[] por zona
                → Map<fixtureId, EffectIntent>
                    → MasterArbiter.setEffectIntents(intentMap) [Layer 3]
```

**NO hay targeting por fixture ID desde Selene.** La IA nunca dice "apunta al fixture #7".

---

## 3. LA INYECCIÓN LEGACY (TitanOrchestrator / MasterArbiter)

### 3.1 Flujo por frame

```
TitanOrchestrator.processFrame()
    1. engine.update(context, audioMetrics)
        └─→ TitanEngine.tick()
            ├── selene.process(titanStabilizedState)
            │       └─→ DecisionMaker.makeDecision()
            │           └─→ ConsciousnessOutput
            ├─ [colorDecision]  → applyConsciousnessColorDecision(palette)
            ├─ [physicsModifier]→ applyConsciousnessPhysicsModifier(effects)
            ├─ [effectDecision] → effectManager.trigger({effectType, zones})
            ├─ [movementDecision] → ═════ NO OP (cable muerto) ═════
            └─→ LightingIntent {palette, zones, movement, effects}
    2. masterArbiter.setTitanIntent(Layer0_Titan {intent, vibeId})
    3. EffectManager.getCombinedOutput()
        └─→ Orchestrator resuelve zones→fixture IDs
            └─→ masterArbiter.setEffectIntents(Map<fixtureId, EffectIntent>) [Layer 3]
    4. arbitratedTarget = masterArbiter.arbitrate()
    5. fixtureStates = hal.renderFromTarget(arbitratedTarget, fixtures)
        └─→ FixtureSnapshot[] con r,g,b,dimmer,pan,tilt,strobe
    6. (post-HAL) HephaestusRuntime.merge(fixtureStates) [opcional]
```

### 3.2 Capas del MasterArbiter

| Layer | Fuente | Prioridad |
|-------|--------|-----------|
| L0 | `TitanEngine` (procedural AI) | Base |
| L1 | Manual overrides (UI, OSC) | Override |
| L2 | Chronos playback | Playback |
| L3 | EffectManager (Selene effects + Hephaestus) | Efectos |

`MasterArbiter.arbitrate()` fusiona por prioridad:
- Intensity/Dimmer: HTP (Highest Takes Precedence)
- Color (RGB): LTP (Hephaestus overwrites si presente)
- Pan/Tilt: Overlay
- Strobe: Additive (sum clamped)

---

## 4. LA BRECHA HACIA AETHER

### 4.1 Naturaleza monolítica vs. modular

| Aspecto | Selene Legacy | Aether V2 |
|---------|---------------|-----------|
| **Unidad de decisión** | Un `ConsciousnessOutput` por frame | `INodeIntent` por nodo y por familia |
| **Color** | `ColorPalette` HSL global (4 colores) | Nodos `COLOR` con canales r/g/b individuales |
| **Movimiento** | Patrón abstracto (`'sweep'`, `'circle'`) en `MovementIntent` | Nodos `KINETIC` con `targetX/Y/Z` o pan/tilt directo |
| **Efectos** | `EffectIntent[]` con tipos nominales ('solar_flare') | No existe concepto de "efecto nominal". Solo canales DMX |
| **Zonas** | ZoneMapper resuelve zones canónicas a fixtures | NodeGraph ya conoce device→nodes. No hay zona abstracta |
| **Routing** | Por zona canónica ('front', 'movers_left') | Por `NodeId` directo (1:1 con fixture+función) |
| **Calibración** | Aplicada en `HAL.renderFromTarget()` y en `NodeResolver` | Aplicada en `NodeResolver._writeNode()` |

### 4.2 Discrepancias críticas identificadas

#### D1 — Efectos nominales vs. canales atómicos
Selene dispara `"solar_flare"` con intensidad 0.8 en zona `'front'`. Aether no tiene receptor para `"solar_flare"`. Solo entiende `dimmer=204`, `strobe=180`, `color={r:255,g:200,b:0}` en un nodo específico. La traducción de efecto nominal a parámetros atómicos de canal ocurre en `EffectManager` + `BaseEffect` — toda esa lógica está fuera de Aether.

#### D2 — Paleta HSL global vs. color por nodo
Selene sugiere un `suggestedHue` que afecta la paleta global de 4 colores. Aether espera que cada nodo `COLOR` reciba sus valores RGB explícitos. La expansión de "paleta global → color por fixture" ocurre en `HAL.renderFromTarget()` mediante `translateColorToWheel()` — lógica legacy no presente en Aether.

#### D3 — Movimiento abstracto vs. espacial 3D
Selene sugiere `pattern='circle'` o `speedMultiplier=1.2`. Aether espera `targetX/Y/Z` en metros (espacio real del venue) o pan/tilt DMX ya resueltos. El patrón abstracto es interpretado por `VibeMovementManager` (VMM) en el legacy. Aether no tiene VMM; usa `VMMAdapter` + `PhysicsPostProcessor` para inercia 3D.

#### D4 — `movementDecision` es cable muerto
Selene emite decisiones de movimiento que el sistema legacy ignora por completo. Si Aether alguna día quiere consumir decisiones cognitivas de movimiento, debería leer `ConsciousnessOutput.movementDecision` y traducirlo a `INodeIntent` de familia `KINETIC` — algo que hoy no ocurre en ningún pipeline.

#### D5 — ZoneMapper no existe en Aether
El enrutamiento por zonas canónicas (`'front'`, `'movers_left'`) requiere `ZoneMapper.fixtureMatchesZone()` para expandir a IDs de fixture. Aether no tiene ZoneMapper; sus nodos ya están vinculados a fixtures en `patch time` via `NodeGraph.registerDevice()`. La noción de "zona" no existe en el grafo de Aether.

### 4.3 Estado actual de los dos pipelines

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TITANORCHESTRATOR.processFrame()                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PIPELINE LEGACY (masterArbiter → HAL.renderFromTarget)                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  TitanEngine → LightingIntent → MasterArbiter.arbitrate()            │  │
│  │  → HAL.renderFromTarget() → FixtureSnapshot[] → DMX                 │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                              ↑                                              │
│                              │ Selene inyecta aquí (color, physics, effects)│
│                              │                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  PIPELINE AETHER (NodeGraph → IntentBus → NodeArbiter → Resolver)   │  │
│  │  Adapters (Impact, Color, VMM, Beam, Atmosphere) → _aetherBus      │  │
│  │  → NodeArbiter.arbitrate() → PhysicsPostProcessor → NodeResolver    │  │
│  │  → HAL.sendUniverseRaw()                                            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                              ↑                                              │
│                              │ Selene NO inyecta aquí. Recibe datos de      │
│                              │   liquidEngine71 + adapters internos.         │
│                              │   Es un pipeline paralelo sin consciencia.  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Hallazgo de arquitectura:** Los dos pipelines corren en paralelo en el mismo `processFrame()`, pero no se mezclan. Selene solo alimenta el legacy. El pipeline Aether es "ciego" — opera sobre métricas de audio crudo (`liquidEngine71.lastFrame`) y perfiles de vibe, sin acceso a `ConsciousnessOutput`.

---

## 5. RESUMEN EJECUTIVO

| Hallazgo | Severidad | Descripción |
|----------|-----------|-------------|
| H1 | 🔴 **Crítica** | `movementDecision` es cable muerto. Selene decide movimiento, el sistema lo ignora. |
| H2 | 🟡 **Alta** | Selene opera en zonas abstractas; Aether en `NodeId` concreto. Necesita traductor. |
| H3 | 🟡 **Alta** | Efectos nominales (`'solar_flare'`) no tienen equivalente atómico en Aether. |
| H4 | 🟢 **Media** | Paleta HSL global requiere expansión por fixture para Aether (hoy en HAL legacy). |
| H5 | 🟢 **Media** | Aether pipeline corre ciego: no recibe `ConsciousnessOutput` de ninguna fuente. |

---

## 6. REFERENCIAS DE CÓDIGO

- `src/core/protocol/ConsciousnessOutput.ts` — Contrato de salida de Selene
- `src/core/intelligence/think/DecisionMaker.ts` — `makeDecision()` final arbiter
- `src/engine/TitanEngine.ts` — Consumo de `ConsciousnessOutput` y ensamblaje de `LightingIntent`
- `src/core/orchestrator/TitanOrchestrator.ts` — Inyección L0/L3 en `MasterArbiter`, dual pipeline Aether
- `src/core/arbiter/MasterArbiter.ts` — Fusión de capas (L0-L3) y `arbitrate()`
- `src/hal/HardwareAbstraction.ts` — `renderFromTarget()` legacy
- `src/core/aether/` — Pipeline V2 (NodeGraph, IntentBus, NodeArbiter, NodeResolver, PhysicsPostProcessor)
- `src/core/effects/EffectManager.ts` — Arsenal de efectos nominales
- `src/core/zones/ZoneMapper.ts` — Resolución de zonas canónicas a fixture IDs

---

*Documento generado bajo directiva WAVE 4524.1 — THE SELENE COGNITIVE TRACE*
*Auditoría completada. Sin modificaciones de código Aether.*
