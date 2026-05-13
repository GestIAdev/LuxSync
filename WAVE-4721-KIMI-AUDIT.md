# WAVE 4721 — THE TUNGSTEN GHOST (Kimi Audit)

**Auditor:** Kimi (Forense profunda, cero código modificado)
**Fecha:** 2026-05-12
**Objetivo:** Rastrear el flujo completo del fixture "Fan Tungsten" (ID: `user-1775343513755-71zc1qeo4`) y documentar las 3 anomalías reportadas.
**Metodología:** Grep + readfile sobre el repositorio completo. Sin ejecución.

---

## EXECUTIVE SUMMARY

El "Fan Tungsten" es víctima de un **bypass hardcoded** en el pipeline de ingestión Aether (`NodeExtractionPipeline.ts`) que **ignora por completo** su definición real de 20 canales y la sustituye por una topología inventada en código. Esto explica la incapacidad de la UI para controlarlo nativamente.

La "Ghost Reactivity" (flashes del golden master y mutación de color del beam) **no proviene del LiquidEngineBase**, sino de la **capa L3 de Selene** (`selene-aether-adapter.ts`) que emite `strobeRate` a la zona `'all'` (todos los nodos IMPACT del show, incluido el golden-master) y deriva colores mutados (`_deriveAirColor`) para la zona `'air'` (donde vive el beam RGBW).

Existe además un **canal IPC dedicado** (`lux:aether:fireTungstenNuke`) y **mappings MIDI propietarios** (`tung-nuke-all`, etc.) que permiten disparar manualmente los pétalos y el rotor — completamente fuera del flujo estándar de efectos.

---

## FASE 1: INGESTION & UI TRACE

### 1.1 El Fixture Real vs. El Fixture Fantasma

**Definición real** (`fixtures/user-1775343513755-71zc1qeo4.json`):
- 20 canales DMX (índices 0–19).
- `hasDimmer: false`.
- `hasColorMixing: true`.
- 10 canales de tipo `custom` (incluyendo "Golden dimmer", "Stainning dimmer", "macro gold", "macro beam", etc.).
- 3 canales de color nativos: `red`, `green`, `blue` (índices 12, 13, 14).
- 1 canal `white` (índice 15).
- 1 canal `strobe` (índice 3).
- 1 canal `pan` (índice 0).

**Topología generada por Aether** (`NodeExtractionPipeline.ts:381–394`):

```typescript
fixtureDef.name === 'Tungsten'
  ? this._buildTungstenBypassNodes(...)   // ← BYPASS TOTAL
  : this._buildAllNodes(...)
```

El pipeline ejecuta `_buildTungstenBypassNodes()` en vez del análisis topológico normal. Este método **reconstruye artificialmente** los canales del fixture usando `fixtureDef.channels.find(ch => (ch.index - 1) === dmxOffset)` para robar nombres de los canales originales, pero **reemplaza sus tipos** (`custom` → `dimmer`, `rotation`, `red`, etc.) y **ignora completamente** los canales que no encajan en su plantilla.

### 1.2 Nodos Aether Generados (vs. Realidad)

| Nodo Aether | Familia | Zona | Canales hardcodeados | Canales reales del fixture que IGNORE |
|-------------|---------|------|----------------------|---------------------------------------|
| `<id>:atmosphere` | ATMOSPHERE | `unassigned` | `custom` @ CH0 ("Pan Kill") | Pan real @ CH0 |
| `<id>:kinetic` | KINETIC | `unassigned` | `rotation` @ CH1 ("Rotor Spin") | "X infinite" @ CH1 (custom) |
| `<id>:wash` | IMPACT | `ambient` | `dimmer` @ CH7 | "Stainning dimmer" @ CH7 (custom) |
| `<id>:wash-color` | COLOR | `ambient` | `red`, `green`, `blue` @ CH9–11 | "Stain red/green/blue" @ CH9–11 (custom) |
| `<id>:beam-color` | COLOR | `air` | `red`, `green`, `blue`, `white` @ CH12–15 | `red`, `green`, `blue`, `white` @ CH12–15 (✅ único match) |
| `<id>:petal-l` | IMPACT | `flash` | `dimmer` @ CH4 | "Gold 1" @ CH4 (custom) |
| `<id>:petal-c` | IMPACT | `flash` | `dimmer` @ CH5 | "Gold 2" @ CH5 (custom) |
| `<id>:petal-r` | IMPACT | `flash` | `dimmer` @ CH6 | "Gold 3" @ CH6 (custom) |
| `<id>:golden-master` | IMPACT | `flash` | `dimmer` @ CH2, `strobe` @ CH3 | "Golden dimmer" @ CH2 (custom), `strobe` @ CH3 (✅ match) |

**Observaciones críticas:**
- Los canales `macro gold` (16), `macro stain` (17), `macro beam` (18) y `repo` (19) **desaparecen del universo Aether**. No existen para el motor.
- Los canales "Gold 1–3" (índices 4–6), aunque en el fixture son `custom`, en Aether se reescriben como `dimmer` con rol `percussion` (porque el nodo IMPACT no tiene dimmer real → `_buildImpactNode` asigna `role: 'percussion'`).
- El canal "Stainning dimmer" (índice 7) se reescribe como `dimmer` en el nodo `wash`, pero con rol `primary` (sí tiene dimmer).

### 1.3 Por qué TheProgrammer no puede controlar colores/intensidad nativamente

**TheProgrammer.tsx** (`components/hyperion/controls/TheProgrammer.tsx`) muestra secciones basándose en los overrides que detecta en la selección:

```typescript
// Líneas 79–88
if (ov.dimmer !== null || ov.strobe !== null) dimmer = strobe = true
if (ov.red !== null || ov.green !== null || ov.blue !== null) color = true
```

Pero el fixture original **no tiene `dimmer` en su definición** (`hasDimmer: false`). Los canales de color reales (`red`, `green`, `blue`, `white`) están en los índices 12–15, pero en la FixtureDefinition original no hay un `colorEngine` que el UI reconozca como controlable nativamente. La UI **solo muestra IntensitySection** si el fixture tiene un canal `dimmer` o `shutter`; **solo muestra ColorSection** si los overrides contienen `red/green/blue`.

Como el fixture real no tiene `dimmer`, la IntensitySection no aparece. Como los canales de color originales son `custom` (aunque el bypass los reetiquete), la UI no los reconoce como controles de color nativos. El operador solo ve **ExtrasSection** con sliders para los canales `custom` originales (Gold 1, Stainning dimmer, macro gold, repo…).

**Tragedia:** los sliders de ExtrasSection envían valores al `nodeId:atmosphere` (`custom` key), pero el nodo `atmosphere` del bypass **solo tiene el canal "Pan Kill"** (CH0). Los demás canales custom (Gold 1, macro, repo) **no están en ningún nodo Aether**, por lo que los sliders de ExtrasSection **no tienen efecto físico** — son controles hacia el vacío.

### 1.4 El Hack de Rotación

El canal CH1 ("X infinite" en el fixture real) es capturado por el bypass como `rotation` (`_buildKineticNode` con `isContinuous = true` porque `hasRotation && !hasPanTilt`).

**Ruta de control:**
1. `ExtrasSection.tsx` detecta `type === 'rotation'` (línea 146 del pipeline) o el usuario lo controla como phantom.
2. `ProgrammerAetherBridge.ts` (línea 151): `KINETIC_PHANTOM_CHANNELS = new Set(['rotation', 'speed'])`.
3. `extractExtrasKinetic()` (línea 164) extrae `rotation` y lo envía al nodo `:kinetic` en vez de `:atmosphere`.
4. `_buildKineticNode` genera un nodo KINETIC con `isContinuous: true` → el `KineticAdapter` lo trata como rotación continua bipolar (0=izq, 127=stop, 255=dcha).

**Conclusión FASE 1:** El fixture es una marioneta. Su cuerpo real (20 canales) ha sido reemplazado por un esqueleto hardcodeado de 9 nodos. La UI muestra controles para canales que no existen en Aether, y los canales que sí existen en Aether no tienen controles nativos en la UI.

---

## FASE 2: THE POLTERGEIST HUNT (Audio & L0/L3 Override)

### 2.1 ¿Quién dispara el Golden Master (CH2/CH3)?

**Respuesta corta:** No es el LiquidEngineBase. Es la **capa cognitiva L3 de Selene** (`selene-aether-adapter.ts`) combinada con el **enrutador de zona `'all'`**.

#### Vía A: Physics Modifier (Selene Consciousness)

`selene-aether-adapter.ts:404–447` — `_processPhysicsModifier()`:

```typescript
const nodeIds = this._zoneRouter.resolve('all' as EffectZone, NodeFamily.IMPACT)
// ...
vals.strobeRate = modifier.strobeIntensity !== undefined ? clamp01(modifier.strobeIntensity) : 0
vals.shutter    = modifier.flashIntensity !== undefined ? (modifier.flashIntensity > 0.5 ? 1.0 : 0.0) : 0
for (let i = 0; i < nodeIds.length; i++) {
  scratch.nodeId = nodeIds[i]
  bus.push(scratch as unknown as INodeIntent)
}
```

Cuando Selene detecta un transitorio fuerte (sintetizador sierra, dubstep), su `ConsciousnessOutput.physicsModifier` emite `strobeIntensity` y `flashIntensity`. El adapter enruta esto a **todos los nodos IMPACT del show** (`zone 'all'`). El nodo `golden-master` (IMPACT, zona `flash`) está incluido porque `'all'` = universo completo.

#### Vía B: Base Effect Output (Strobe Rate)

`selene-aether-adapter.ts:288–291` — `_processBaseOutput()`:

```typescript
if (output.strobeRate !== undefined && output.strobeRate > 0) {
  this._emitStrobe('all' as EffectZone, clamp01(output.strobeRate), composition, bus)
}
```

Cualquier efecto con `strobeRate > 0` (ej. `industrial_strobe`, `strobe_burst`, `neon_blinder`) enruta su strobe a **todos los nodos IMPACT** del show. El golden-master recibe el strobe como si fuera un mover común.

#### Vía C: Zone Overrides Explícitas

`selene-aether-adapter.ts:386–389` — `_processZoneOverrides()`:

```typescript
if (override.strobeRate !== undefined && override.strobeRate > 0) {
  this._emitStrobe(zone, clamp01(override.strobeRate), composition, bus)
}
```

Si un efecto declara `zoneOverrides['flash'].strobeRate`, el golden-master (en zona `flash`) recibe el trigger directamente.

#### Vía D: LiquidEngineBase (la fuente NEGADA por el operador)

`LiquidEngineBase.ts:572`:

```typescript
const strobeResult = this.calculateStrobe(bands.treble, bands.ultraAir, noiseMode)
```

El LiquidEngine **sí** calcula strobe a partir de `treble` + `ultraAir` (sintetizadores sierra = mucha energía en treble). Pero el operador dice que no proviene de `liquidenginebase`. Esto es consistente: el strobe que ve no es el `strobeResult` del LiquidEngine, sino el de Selene L3 (physics modifier + base output) que se suma encima.

**Veredicto:** El golden-master parpadea porque Selene L3 (no L0/Liquid) inyecta `strobeRate` en la zona `'all'`, y el nodo `golden-master` es un nodo IMPACT que vive en esa zona agregada.

### 2.2 ¿Quién muta el color del Beam?

**Respuesta:** `_deriveAirColor()` en `selene-aether-adapter.ts:332–347`.

El nodo `beam-color` está en zona `air`. Cuando Selene emite un color primario, el adapter deriva un color de acompañamiento para la zona `air`:

```typescript
// Hue shifted +22°, reduced saturation (×0.7) and lightness (×0.55)
const airColor = {
  h: (base.h + 22) % 360,
  s: Math.min(100, base.s * 0.72),
  l: Math.min(100, base.l * 0.66),
}
```

El beam RGBW recibe este color mutado. Si el operador pone magenta puro en el fixture, el beam sale rosado/naranja. Si pone cian, sale azul-verdoso. La "mutación" es **intencional por diseño** (zona `air` como acento), pero el operador percibe que el beam tiene vida propia porque no hay control manual directo sobre el nodo `beam-color` desde TheProgrammer.

### 2.3 Inyecciones DMX Crudas y Hardcodes del ID

**No existe hardcode del fixture ID** (`user-1775343513755-71zc1qeo4`) en ningún archivo `.ts` o `.tsx`. El sistema no conoce este ID. En su lugar, usa **hardcodes semánticos por nombre**:

#### Hardcode 1: Nombre "Tungsten"

`NodeExtractionPipeline.ts:384`:
```typescript
fixtureDef.name === 'Tungsten'
```

Cualquier fixture llamado "Tungsten" activará el bypass, independientemente de su ID o canales reales.

#### Hardcode 2: Sufijo `:golden-master`

`TitanOrchestrator.ts:548`:
```typescript
const hasGoldenMaster = nodeIds.some(nid => nid.endsWith(':golden-master'))
```

`getTungstenNodeIds()` escanea el NodeGraph buscando cualquier device con un nodo cuyo ID termine en `:golden-master`. Esto es cómo encuentra el fixture en runtime.

#### Hardcode 3: Canal IPC dedicado `fireTungstenNuke`

`AetherIPCHandlers.ts:712–769`:

```typescript
ipcMain.handle('lux:aether:fireTungstenNuke', (_event, { target, release, value }) => {
  // ...
  arbiter.setManualOverride(t.goldenMaster, { dimmer: intensity, strobe: 1.0 })
  arbiter.setManualOverride(t.petalL, { dimmer: intensity })
  // ...
})
```

Este handler **bypassa por completo** el pipeline de efectos. Escribe directamente en el NodeArbiter L2, ignorando L0, L1 y L3. Es un disparo crudo de DMX semántico.

#### Hardcode 4: Mappings MIDI propietarios

`MidiActionRegistry.ts:159–165`:
```typescript
const TUNGSTEN_CONTROLS = [
  { id: 'tung-spin',     label: 'Tungsten Spin',      category: 'fader' },
  { id: 'tung-nuke-all', label: 'Nuke Gold — Big Bang', category: 'button' },
  { id: 'tung-petal-l',  label: 'Petal Left Burst',   category: 'button' },
  { id: 'tung-petal-c',  label: 'Petal Center Burst', category: 'button' },
  { id: 'tung-petal-r',  label: 'Petal Right Burst',  category: 'button' },
]
```

`useMidiLearn.ts:231–253`:
```typescript
if (controlId.startsWith('tung-')) {
  const tungAction = controlId.slice(5)
  if (tungAction === 'nuke-all') {
    window.lux.aether.fireTungstenNuke({ target: 'all', value: 1.0 })
  }
  // ...
}
```

Un pad MIDI (ej. nanoPAD2) puede disparar el golden master completamente fuera del motor de efectos.

---

## FASE 3: INTEGRACIÓN EN EL SHOW ACTUAL

### 3.1 Registro Dinámico (no hardcodeado en show file)

El fixture NO aparece hardcodeado en ningún archivo de show o escena del repositorio. Su presencia en el show es **puramente dinámica**:

**Flujo de registro:**
1. El usuario añade el fixture en la UI (StageConstructor / FixtureForge).
2. `stageStore` lo guarda en el show file como un `FixtureV2` con `profileId: "user-1775343513755-71zc1qeo4"`.
3. Al cargar el show, `TitanOrchestrator.setFixtures()` recibe el array de fixtures.
4. `_syncFixturesToAether()` (línea ~2740) itera los fixtures y llama `registerAetherDevice()` para cada uno.
5. `registerAetherDevice()` llama `NodeExtractionPipeline.extract()`.
6. Como `fixtureDef.name === 'Tungsten'`, el pipeline ejecuta `_buildTungstenBypassNodes()`.
7. Los nodos se registran en el `NodeGraph`.
8. `resolver.registerDevice()` pre-computa el mapa de ignición (WAVE 4720, recién implementado).

### 3.2 Parcheo de Zonas (Zone Mapping)

El bypass asigna zonas fijas:

| Sub-sistema | Zona Aether | Zona Selene/Effecto |
|-------------|-------------|---------------------|
| Pan Kill + Rotor | `unassigned` | No enrutable por L3 |
| Wash (dimmer + RGB) | `ambient` | Efectos de ambiente (`ambient_strobe`, `void_mist`, etc.) |
| Beam (RGBW) | `air` | Efectos de aire/accento (`airColor` mutado) |
| Pétalos (3× dimmer) | `flash` | Efectos de flash/strobe (`industrial_strobe`, `neon_blinder`, etc.) |
| Golden Master (dimmer+strobe) | `flash` | Efectos de flash/strobe + physics modifier |

**Observación:** El `ZoneNodeRouter` (`zone-node-router.ts`) no tiene una zona canónica `flash` en su lista pre-construida, pero **sí la absorbe** del NodeGraph porque es una zona activa del grafo (`activeZones`). Luego, la zona `'all'` aglutina TODOS los nodos IMPACT, incluidos los de `flash`.

### 3.3 Por qué reacciona "solo"

El operador dice que el fixture "se mueve, brilla y reacciona de forma autónoma". Esto ocurre porque:

1. **Movimiento (Rotor):** El nodo `:kinetic` (rotor) no tiene un override L2 permanente salvo que el operador active el control de rotación. Sin override, L0 (VMM / AetherKineticEngine) **no controla canales de rotación** — el rotor queda en su default (127 = stop) a menos que Selene o un efecto lo toquen. Como ningún sistema L3 emite `rotation`, el rotor está parado por defecto. El "movimiento" que percibe el operador probablemente es el **pan** del fixture (CH0) si otro sistema lo está moviendo, pero en el bypass el pan está clavado en 127 ("Pan Kill").

2. **Brillo autónomo:** Los nodos `petal-l/c/r` y `golden-master` son IMPACT en zona `flash`. Selene L3 emite `dimmerOverride` e `strobeRate` a zona `'all'`, que los incluye. Además, el `physicsModifier` de Selene puede emitir `flashIntensity` que abre el shutter (o en este caso, el strobe) de todos los nodos IMPACT.

3. **Reacción a audio:** El `physicsModifier` reacciona a energía, brusquedad (`harshness`) y planicidad (`flatness`) del espectro. Sintetizadores sierra = alto `harshness` + alto `treble` → `physicsModifier.confidence` sube → `_processPhysicsModifier` dispara → strobe en golden-master.

---

## DIAGNÓSTICO FORENSE FINAL

### Causa Raíz de la Anomalía UI

**Código culpable:** `NodeExtractionPipeline.ts:384` + `_buildTungstenBypassNodes()` (líneas 512–634).

**Síntoma:** La UI es incapaz de controlar nativamente colores/intensidad.
**Mecanismo:** El bypass hardcodeado ignora la definición real del fixture. Los canales `custom` originales (Gold 1-3, macros, repo) no se mapean a ningún nodo Aether. Los canales que SÍ se mapean (wash-color, beam-color) usan tipos re-etiquetados que la UI no reconoce como controles nativos porque el fixture original no los declara como `red`/`green`/`blue` en su `capabilities`.

### Causa Raíz de la Ghost Reactivity

**Código culpable:** `selene-aether-adapter.ts:404–447` (`_processPhysicsModifier`) + líneas 288–291 (`_processBaseOutput`).

**Síntoma:** El golden master parpadea con transitorios de audio; el beam muta de color.
**Mecanismo:** El adapter L3 enruta `strobeRate` y `flashIntensity` a la zona `'all'` (todos los IMPACT). El golden-master es IMPACT. El beam-color es COLOR en zona `air`, que recibe el color derivado `_deriveAirColor()` con hue shift +22°.
**Por qué NO es LiquidEngineBase:** El operador tiene razón. El LiquidEngine produce `strobeResult` y `airIntensity`, pero esos valores son consumidos por el `LiquidStereoPhysics` (L1) y traducidos a intensidades por zona. La "reactividad fantasma" viene de **encima** (L3), donde Selene inyecta strobe/shutter directamente en el bus de intents sin pasar por el cálculo de intensidad del LiquidEngine.

### Causa Raíz del Control Paralelo (MIDI/Nuke)

**Código culpable:** `AetherIPCHandlers.ts:712–769` + `MidiActionRegistry.ts:159–165`.

**Síntoma:** El fixture puede dispararse vía MIDI fuera del flujo de efectos.
**Mecanismo:** Un handler IPC exclusivo (`fireTungstenNuke`) escribe directamente en `NodeArbiter.setManualOverride()`, bypassando L0/L1/L3. Esto es intencional (WAVE 4699.2: "Tungsten Golden Nuke") pero crea un **sistema de control paralelo** que el operador puede confundir con comportamiento autónomo si un mapping MIDI está activo sin su conocimiento.

---

## RECOMENDACIONES (sin modificar código — solo auditoría)

1. **Eliminar el bypass `_buildTungstenBypassNodes`** y permitir que `_buildAllNodes` procese el fixture real. Si el fixture necesita una topología especial, debe declararse en su `FixtureDefinitionV2.nodeGraph` (Forge) en lugar de hardcodearse en el pipeline.

2. **Re-etiquetar los canales del fixture JSON** para que `hasDimmer: true` y los canales Gold 1-3 sean de tipo `dimmer` en lugar de `custom`. Esto haría que TheProgrammer muestre IntensitySection y ColorSection nativamente.

3. **Auditar mappings MIDI** (`midiMapStore`) para verificar si `tung-nuke-all` o `tung-spin` están mapeados a pads/faders físicos que se activen accidentalmente.

4. **Revisar `_processPhysicsModifier`** para que no emita a `'all'` sin restricción, o para que los nodos de tipo `fan` / atmósfera tengan un flag que los excluya del strobe global si no es deseado.

5. **Documentar el bypass** en el fixture JSON o en un comentario del pipeline para que futuros operadores sepan que el fixture real no es lo que Aether ve.

---

*Fin del informe forense WAVE 4721. Sin código modificado. Solo rastreo y documentación.*
