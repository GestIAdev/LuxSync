# SELENE-AETHER-INTEGRATION — WAVE 4632 Audit
> Auditoría forense del pipeline cognitivo Selene → NodeArbiter → DMX/UI.  
> Fecha: 2026-05-08 | Solo lectura. Blueprint de Conectividad.

---

## 🔥 MISIÓN 1: El Origen del "Disparo" (Selene & EffectManager)

### Estructura de salida: `CombinedEffectOutput`

Generada por `EffectManager.getCombinedOutput()` @ `EffectManager.ts:668`.

```typescript
interface CombinedEffectOutput {
  hasActiveEffects: boolean
  mixBus?: 'htp' | 'global'
  dimmerOverride?: number        // HTP blend de todos los efectos activos
  whiteOverride?: number         // HTP blend
  amberOverride?: number         // HTP blend (WAVE 630)
  colorOverride?: { h, s, l }    // Mayor prioridad gana (LTP)
  strobeRate?: number            // Máximo de todos
  intensity: number
  globalComposition?: number     // Máximo de todos (WAVE 1080 Fluid Dynamics)
  contributingEffects: string[]
  zoneOverrides?: { [zoneId]: { dimmer?, color?, white?, amber?, movement?, priority } }
}
```

**Punto de disparo exacto**: `TitanOrchestrator.ts:1790`
```typescript
const effectOutput = getEffectManager().getCombinedOutput()
seleneAetherAdapter.ingest(
  consciousnessOutput,  // DecisionMaker output (null = no-op)
  effectOutput,         // CombinedEffectOutput
  ctx.deltaMs,
  this._aetherBus,      // IIntentBus L0
)
```

**Semántica**: `effectOutput` contiene el estado *combinado* de todos los efectos activos. No es un evento puntual sino una "fotografía" del frame actual del motor de efectos.

---

## 🔥 MISIÓN 2: El Punto de Inyección (Aether Entry Point)

### Adapter: `SeleneAetherAdapter.ingest()` @ `selene-aether-adapter.ts:186`

Traduce `CombinedEffectOutput + ConsciousnessOutput` → intents atómicos → `IIntentBus.push()`.

**Pipeline interno**:
```
CombinedEffectOutput
  → Gate 1: hasActiveEffects? (early return si false)
  → Gate 2: globalComposition >= 0.01? (early return si below threshold)
  → Fase 1: _processGlobalOverrides()  → bus.push() IMPACT/COLOR nodes zona 'all'
  → Fase 2: _processZoneOverrides()   → bus.push() per-zone IMPACT/COLOR nodes
  → Fase 3: _processPhysicsModifier() → bus.push() STROBE nodes zona 'all' (si confidence > 0.5 y energy < 0.85)
```

**Canales emitidos** (normalizados 0-1):
- `dimmer` → NodeFamily.IMPACT
- `r`, `g`, `b` → NodeFamily.COLOR (conversión HSL→RGB inline zero-alloc)
- `white`, `amber` → NodeFamily.COLOR
- `strobeRate`, `shutter` → NodeFamily.IMPACT (vía physicsModifier)

**REGLA ABSOLUTA L3**: ❌ NUNCA emite `targetX/Y/Z`, `pan`, `tilt`. El adapter descarta explícitamente `override.movement` @ línea 291.

---

## 🔥 MISIÓN 3: Estrategia de Capas en el Árbitro (NodeArbiter)

### Capas declaradas vs. Capas usadas

| Capa | Declaración Arbiter | Alimentación Real en Path Moderno | Merge Strategy |
|------|---------------------|-----------------------------------|----------------|
| L0 | System intents (IntentBus) | ✅ TODOS los adapters (Kinetic, Color, Impact, Beam, Atmosphere, **Selene**) | HTP/LTP |
| L1 | Selene IA overrides | ❌ **VACÍO** — API existe (`setSeleneOverrides`) pero nadie la llama en el path moderno | HTP/LTP |
| LP | Playback (Chronos) | ✅ `chronosAetherAdapter.ingest()` → `setPlaybackIntents` | HTP/LTP |
| L3 | Effect intents (LiveFXEngine) | ❌ **BYPASSED LEGACY** — `IntentComposer` comentado en TitanOrchestrator.ts:1290 | HTP/LTP |
| L3+ | Hephaestus Diamond Data | ✅ `hephaestusAetherAdapter.ingest()` | HTP/LTP |
| L2 | Manual overrides | ✅ `ProgrammerAetherBridge` → IPC → `setManualOverride` | Direct overwrite |
| L2.5 | Inhibit limits | ✅ Post-arbitraje cap on dimmer | Direct cap |
| L4 | Blackout | ✅ `setBlackout` | Colapsa todo a 0 |

### 🚨 CABLE ROTO #1: SELENE COMPITE EN L0 CON VMM Y SYSTEMS BASE

El `SeleneAetherAdapter` emite al `this._aetherBus` (IIntentBus) que luego se inyecta como **L0 System Intents** vía `aetherArbiter.setSystemIntents(this._aetherBus)` @ `TitanOrchestrator.ts:1816`.

**Problema**: Selene (cognición, prioridad 300 en el intent) está en la misma capa que `KineticAdapter` (VMM, prioridad 10), `ColorSystem`, `ImpactSystem`, etc. Todos comparten el bus L0.

Dentro de `_applyIntent` @ `NodeArbiter.ts:257`:
- HTP channels (`dimmer`, `strobe`, `shutter`): valor más alto gana → Selene puede coexistir con VMM si tiene dimmer mayor.
- LTP channels (`r`, `g`, `b`, `pan`, `tilt`, etc.): **última escritura gana**.

**Orden de ejecución en el frame loop** @ `TitanOrchestrator.ts`:
1. Systems base (VMM, Color, Impact, Beam, Atmosphere) → push al bus
2. SeleneAetherAdapter.ingest() → push al bus
3. `setSystemIntents(bus)` → arbiter aplica todos los intents del bus en orden de `getAll()`

Si `IIntentBus.getAll()` retorna en orden de inserción, Selene se aplica DESPUÉS de los systems base, por lo que en LTP **gana Selene** (última escritura). Pero esto es una garantía por *orden de ejecución*, no por *prioridad estructural*.

**Riesgo**: Si alguien reordena el frame loop o si `getAll()` cambia de orden (ej. optimización de sorting), Selene podría perder contra VMM en canales LTP.

### 🚨 CABLE ROTO #2: CAPA L1 (SELENE IA OVERRIDES) ESTÁ DESCONECTADA

`NodeArbiter` tiene API dedicada `setSeleneOverrides(intents)` @ `NodeArbiter.ts:112` que aplica en L1 (entre L0 y LP). 

**Nadie la usa en el path moderno.** La capa L1 está reservada para Selene pero el pipeline moderno la bypassa completamente, mandando todo a L0.

**Fix recomendado**: Migrar `SeleneAetherAdapter` de emitir al `aetherBus` (L0) a alimentar directamente `NodeArbiter.setSeleneOverrides()` (L1), o hacer que el `TitanOrchestrator` extraiga los intents Selene del bus y los inyecte vía `setSeleneOverrides`. Esto daría a Selene prioridad estructural garantizada sobre los systems base sin depender del orden de inserción.

### 🚨 CABLE ROTO #3: MOVIMIENTO COGNITIVO ESTÁ CABLEADO A PROPÓSITO EN OFF

SeleneAetherAdapter @ `selene-aether-adapter.ts:291`:
```typescript
// ❌ override.movement → DESCARTADO (Regla L3: movimiento ≡ KineticAdapter)
```

Esto significa que efectos cognitivos con `zoneOverrides[zoneId].movement` son **silenciosamente descartados** en el adapter. El movimiento solo puede venir de:
- L0: `KineticAdapter` (VMM/audio-reactive)
- L2: Manual overrides (Programmer faders)
- LP: Playback (Chronos timeline)

Si Selene/EffectManager necesita controlar posición (pan/tilt) o spatial targets, no hay pipeline. Es un **bloqueo intencional** que debe relajarse si se requiere cognición espacial.

### Merge Strategy concreto por canal

```typescript
// NodeArbiter.ts:43
const HTP_CHANNELS = new Set<string>(['dimmer', 'strobe', 'shutter'])
```

| Canal | Estrategia | Implicación para Selene |
|-------|------------|-------------------------|
| `dimmer` | HTP | Selene puede "mezclarse" con VMM/manual si su valor es mayor. Un flash de efecto con dimmer=1.0 ganará incluso sobre manual dimmer=0.5 (a menos que manual esté en L2, que se aplica DESPUÉS). |
| `r`, `g`, `b` | LTP | Selene gana sobre VMM/base SI se inserta después en el bus. Manual (L2) siempre gana después. |
| `pan`, `tilt` | LTP | Selene NO emite estos canales (regla L3). Solo VMM (L0), Playback (LP) o Manual (L2) los controlan. |
| `strobeRate` | HTP | Selene (vía physicsModifier) puede activar strobe si su rate es mayor que otros. |
| `shutter` | HTP | Flash de Selene puede abrir shutter si > current. |

---

## 🔥 MISIÓN 4: Visibilidad en la UI (Feedback Loop)

### Pipeline UI

```
NodeResolver.resolve(arbitrated)
  → AetherUIProjector.project(fixtureStates, aetherGraph, arbitrated)
    → emitHotFrame()
      → IPC → Hyperion 3D / Programmer panels
```

**Crítico**: `project()` recibe el mapa `arbitrated` **post-arbitraje** @ `TitanOrchestrator.ts:1877`.

```typescript
this._aetherUIProjector.project(fixtureStates, this._aetherGraph, arbitrated)
emitHotFrame()
```

Esto significa que la UI ve el estado **después** de que L2 (Manual) haya sobrescrito L3/L0. Si un usuario tiene un fader manual activo, la UI mostrará el valor manual, no el valor del efecto Selene. Esto es correcto — la UI debe reflejar la realidad DMX.

### Cuellos de botella para flashes rápidos

1. **Frame rate**: El pipeline corre a 44Hz (~23ms/frame). Un flash de 1-beat (ej. 120BPM = 500ms) es visible. Un strobe de 1/16 beat (~31ms) puede perderse entre frames o ser suavizado por `PhysicsPostProcessor`.

2. **PhysicsPostProcessor**: Aplica inercia/smoothing a canales KINETIC. No afecta color/dimmer directamente (esos van directo a DMX), pero si un efecto Selene modifica velocidad de movimiento indirectamente, el PPS la suavizaría.

3. **AetherSafetyMiddleware (Fase 0)**: `applyOutputGate()` puede filtrar/mutar valores post-arbitraje antes de resolver a DMX. Si hay gates agresivos, flashes rápidos pueden ser suprimidos.

4. **Hot-frame throttle**: `emitHotFrame()` puede tener throttling interno. Si el hot-frame se emite a 30Hz mientras DMX corre a 44Hz, se perderían ~14 frames/s de detalle.

**Veredicto**: No hay cuello de botella obvio que filtre cambios rápidos de intensidad/color en el path Selene→DMX, siempre que el effectOutput tenga `hasActiveEffects=true` y `globalComposition >= 0.01`. El único gate real es el `MIN_GLOBAL_COMPOSITION` del adapter.

---

## 🗺️ MAPA DE CABLES ROTOS Y RECOMENDACIONES

| # | Prioridad | Problema | Ubicación | Fix / Decisión |
|---|-----------|----------|-----------|----------------|
| **1** | 🔴 CRÍTICA | Selene compite en L0 con systems base; prioridad 300 del intent no se respeta estructuralmente si `IIntentBus` no ordena. | `selene-aether-adapter.ts:186` → `aetherBus` → `NodeArbiter.setSystemIntents()` | **Opción A**: Migrar Selene a `NodeArbiter.setSeleneOverrides()` (L1). **Opción B**: Verificar que `IIntentBus.getAll()` ordena por `priority` descendente antes de entregar al arbiter. |
| **2** | 🔴 CRÍTICA | Capa L1 (`_seleneOverrides`) está declarada en arbiter pero desconectada del pipeline moderno. | `NodeArbiter.ts:112` (API sin caller en path moderno) | Conectar `TitanOrchestrator` para que, tras `seleneAetherAdapter.ingest()`, extraiga los intents Selene del bus y los inyecte vía `arbiter.setSeleneOverrides()` antes de `setSystemIntents()`. |
| **3** | 🟡 ALTA | Movimiento (`pan`/`tilt`/`targetX/Y/Z`) de efectos es descartado silenciosamente. | `selene-aether-adapter.ts:291` | Si Selene/EffectManager necesita control posicional, relajar la regla L3 y emitir `targetX/Y/Z` para nodos KINETIC (la ruta IK de NodeResolver ya los soporta @ `NodeResolver.ts:421`). |
| **4** | 🟡 ALTA | `MIN_GLOBAL_COMPOSITION = 0.01` descarta efectos sutiles. | `selene-aether-adapter.ts:52` | Ajustar threshold o hacerlo configurable por vibe. Un valor de 0.01 es razonable para evitar ruido, pero documentar explícitamente. |
| **5** | 🟢 MEDIA | Energy veto (`MAX_ENERGY_FOR_PHYSICS_MOD = 0.85`) silencia strobe en drops/clímax. | `selene-aether-adapter.ts:58` | Comportamiento intencional (WAVE 450), pero verificar que no suprime strobe cuando el operador espera feedback visual en momentos de alta energía. |
| **6** | 🟢 MEDIA | `EffectIntents` legacy (L3) está comentado/bypassed en `TitanOrchestrator`. | `TitanOrchestrator.ts:1290-1294` | Limpiar código legacy o documentar que L3 EffectIntents está deprecado en favor de SystemBus L0/L1. |

---

## 🎯 DIAGRAMA DE FLUJO ACTUAL

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  EffectManager  │────→│ CombinedEffectOutput │────→│ SeleneAetherAdapter│
│  (getCombined)  │     │  + ConsciousnessOut  │     │   .ingest()       │
└─────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                              │ bus.push()
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         IIntentBus (L0)                                 │
│  [KineticAdapter] [ColorSystem] [ImpactSystem] [BeamAdapter] [Selene]...  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ NodeArbiter L0  │ ← setSystemIntents(bus)
                    ├─────────────────┤
                    │ (vacío) L1      │ ← setSeleneOverrides() — NO CONECTADO
                    │ Playback LP     │ ← setPlaybackIntents()
                    │ (vacío) L3      │ ← setEffectIntents() — LEGACY BYPASSED
                    │ Hephaestus L3+  │ ← setHephaestusIntents()
                    │ Manual L2       │ ← setManualOverride() — GANA SIEMPRE
                    │ Inhibit L2.5    │ ← Post-arbitraje cap
                    │ Blackout L4     │ ← setBlackout()
                    └────────┬────────┘
                             │ arbitrated
                             ▼
                    ┌─────────────────┐
                    │  NodeResolver   │ → DMX Uint8Array(512)
                    └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ AetherUIProjector│ → emitHotFrame() → UI 3D/Programmer
                    └─────────────────┘
```

---

## 🎬 DICTAMEN EJECUTIVO

**Estado**: El pipeline Selene → DMX está **FUNCIONAL pero FRÁGIL**.

- Los efectos de color e intensidad llegan a DMX correctamente a través del adapter L3 → bus L0 → arbiter → resolver.
- **La fragilidad está en la capa L0**: Selene compite con VMM y otros systems base sin una barrera de prioridad estructural. Funciona "por accidente" porque Selene se inserta después en el frame loop y LTP favorece la última escritura.
- **La capa L1 está desconectada**: El arbiter tiene un slot reservado para Selene que no se usa. Conectarlo es la mejora arquitectónica más importante.
- **Movimiento cognitivo está apagado**: Por diseño. Si se necesita que efectos cognitivos controlen posición, hay que relajar el bloqueo L3 en el adapter.
- **No hay cuellos de botella DMX/UI**: El hot-frame recibe `arbitrated` post-arbitraje, por lo que refleja fielmente el estado final incluyendo overrides manuales.

**Recomendación inmediata**: Conectar Selene a L1 (`setSeleneOverrides`) para robustecer la jerarquía de capas antes del próximo show.
