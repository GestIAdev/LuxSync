# ⚖️ ARBITER FORENSIC AUDIT — WAVE 4770-PRE
## La Tríada de Arbitraje: Vulnerabilidades Arquitectónicas en LuxSync

**Auditor:** Kimi (Auditor de Sistemas Core)  
**Mandato:** Análisis forense de `NodeArbiter.ts`, `LiquidEngineBase.ts` y trazas conceptuales hacia L3 (Intents).  
**Restricción:** Sin parches — solo diagnóstico y mapa de interacciones.  
**Fecha:** 2026-05-13

---

## 1. MAPEO DE CAPAS Y CALLERS

### 1.1 Arquitectura de Capas (de menor a mayor prioridad)

| Capa | Origen | Inyección en Arbiter | Granularidad | Canales Típicos |
|------|--------|----------------------|--------------|-----------------|
| **L0** | Systems (LiquidEngine, ColorSystem, ImpactSystem, KineticSystem, BeamSystem, AtmosphereSystem) | `setSystemIntents(_aetherBus)` | Por nodo (nodeId) | `dimmer`, `brightness`, `r/g/b`, `pan`, `tilt`, `strobeRate`, `shutter`, `gobo`, `prisma` |
| **L1** | Selene IA (ColorAdapter vía `_seleneBus`) | `setSeleneBus(_seleneBus)` + fallback `setSeleneOverrides(array)` | Por nodo (nodeId) | `dimmer`, `r/g/b`, `strobeRate`, `shutter` |
| **LP** | Playback (Chronos Timeline) | `setPlaybackIntents(array)` | Por nodo | Todo canal |
| **L2** | Manual Overrides (UI faders, MIDI, OSC, KineticsBridge anchor) | `setManualOverride(nodeId, channels)` + `setMotorKineticOverride(nodeId, channels)` | Por nodo | Todo canal (`pan_base`/`tilt_base` excluidos de hard lock) |
| **L3** | LiveFX Engine (EffectManager) | `setEffectIntents(array)` | Por zona (zonal aggregation) | `dimmer`, `r/g/b`, `white`, `amber`, `strobeRate`, `shutter` |
| **L3+** | Hephaestus (Diamond Data curves) | `setHephaestusIntents(array)` | Por nodo | Todo canal (custom clips) |
| **L4** | Blackout / Grand Master | `_blackout` flag + `_grandMaster` scalar | Global | Solo canales HTP (`dimmer`, `brightness`, `strobe`, `shutter`) |

### 1.2 Pipeline de Frame (`TitanOrchestrator.processFrame()`)

```
Frame (44 Hz)
│
├─ 1. LiquidEngineBase.applyBands() → LiquidStereoResult
│   └─ LiquidAetherAdapter.ingest() → _aetherBus (L0)
│
├─ 2. Systems escriben en _aetherBus:
│   ├─ ImpactAdapter.process()     → dimmer/brightness por zona
│   ├─ ColorAdapter.process()      → r/g/b (de SeleneLux palette)
│   ├─ KineticAdapter.process()    → pan/tilt (física espacial L0)
│   ├─ BeamAdapter.process()       → gobo, prisma, zoom, focus
│   └─ AtmosphereAdapter.process() → fog, haze, fan
│
├─ 3. SeleneAetherAdapter.ingest() → _effectBus (L3)
│   └─ Emite dimmer, color, strobe por zona canónica (no movimiento)
│
├─ 4. Playback (Chronos) → aetherArbiter directo
├─ 5. Hephaestus → aetherArbiter directo
├─ 6. AetherKineticEngine.tick() → _motorKineticOverrides (L2)
│
├─ 7. ARBITRAJE:
│   aetherArbiter.setSystemIntents(_aetherBus)
│   aetherArbiter.setEffectIntents(_effectBus.getAll())
│   const arbitrated = aetherArbiter.arbitrate()
│
├─ 8. PhysicsPostProcessor.process() → inercia cinética
├─ 9. AetherSafetyMiddleware → DarkSpin, velocity clamp, airbag
└─ 10. NodeResolver.resolve() → Uint8Array(512) → HAL.sendUniverseRaw()
```

### 1.3 Quién Puebla L0 y Con Qué Granularidad

| Sistema | Fuente de Datos | Granularidad | Frecuencia |
|---------|----------------|--------------|----------|
| **LiquidAetherAdapter** | `LiquidStereoResult` (9 intensidades zonales) | Por zona → todos los nodos IMPACT/COLOR de esa zona | 44 Hz |
| **ColorAdapter** | `SeleneLuxOutput` (paleta HSL) | Por nodo COLOR | 44 Hz |
| **ImpactAdapter** | `LiquidStereoResult` (mismo que arriba) | Por nodo IMPACT | 44 Hz |
| **KineticAdapter** | Contexto musical + posición fixture | Por nodo KINETIC | 44 Hz |
| **BeamAdapter** | Contexto musical + decisión de gobo/prisma | Por nodo BEAM | 44 Hz |
| **AtmosphereAdapter** | Contexto musical | Por nodo ATMOSPHERE | 44 Hz |

**Observación crítica:** L0 es una **torre de Babel** donde 6 sistemas independientes escriben en el mismo bus sin coordinación inter-sistema. No existe un "Director L0" que valide coherencia entre lo que ColorAdapter y BeamAdapter emiten para el mismo fixture.

---

## 2. EL PROBLEMA DEL HTP TRANS-CAPA

### 2.1 Estrategia de Merge Actual

```typescript
// NodeArbiter.ts L46
const HTP_CHANNELS = new Set<string>(['dimmer', 'brightness', 'strobe', 'shutter'])
```

Para canales HTP: `max(valor_actual, valor_entrante)` — independientemente de la capa.  
Para todos los demás: LTP (sobrescritura pura, la última capa en escribir gana).

### 2.2 Análisis Matemático del Fallo

**Escenario:**  
- L2 (Manual) envía `{ dimmer: 0.3 }` para `fix-01:impact`  
- L0 (LiquidEngine) envía un pico de `{ dimmer: 1.0 }` para el mismo nodo en el mismo frame

**Cálculo en `_applyIntent`:**

```typescript
// L0 escribe primero (system layer)
record['dimmer'] = 1.0  // pico del beat

// L2 se aplica DESPUÉS en el bloque manual (post-L3)
// PERO el Manual Hard Lock (WAVE 4714) reescribe:
record['dimmer'] = 0.3  // valor manual
```

**¿Dónde está el fallo?**  
El fallo NO está en el resultado final (el lock L2 funciona), sino en el **HTP intermedio**:

```typescript
// Dentro de _applyIntent para L0 (system):
if (HTP_CHANNELS.has(channel)) {
  const current = record[channel]  // undefined (primera vez)
  if (current === undefined || incoming > current) {
    record[channel] = incoming  // 1.0 se escribe
  }
}
```

Si entre L0 y el bloque L2 manual llega **L1 (Selene)** o **L3 (Effect)** con `dimmer: 0.8`:

- L0: `dimmer = 1.0`
- L1: HTP → `max(1.0, 0.8)` = `1.0` ✅
- L3 (Effect): HTP → `max(1.0, 0.6)` = `1.0` ✅
- L2 (Manual 0.3): **Hard Lock reescribe a 0.3** ✅

**El resultado final es correcto**, pero el **HTP trans-capa viola la semántica de prioridad**:  
L3 (Effect) tiene prioridad conceptual sobre L0, pero el HTP le permite a L0 "ganar" si su valor es mayor, creando un flash de 1 frame donde L3 debería haber dominado. El Manual Hard Lock (post-L3) lo corrige, pero el flash ya ocurrió en el bus intermedio.

### 2.3 El Flash de Un Frame (WAVE 4705)

El comentario en `NodeArbiter.ts:541-558` lo reconoce explícitamente:

> *"CLEAN CABIN: L2 DICTATOR — si el operador tiene un lock manual [...] L0/L1/LP NO pueden pisarlo con HTP [...] este guard temprano evita que la capa intermedia herede el valor alto de L0 antes del lock final, eliminando flashes de un frame."*

**Pero este guard solo aplica a L0/L1/LP — NO a L3 (effect) ni L3+ (hephaestus).**  
La línea 553:

```typescript
if (layer !== 'effect' && layer !== 'hephaestus') {
  const lockRecord = this._manualChannelLocks.get(intent.nodeId)
  if (lockRecord !== undefined && channel in lockRecord) continue
}
```

Esto significa que si L2 tiene dimmer manual bloqueado, un efecto L3 puede **sobrescribir el dimmer a 0** (línea 543: destructive authority) y el guard L2 se ejecuta DESPUÉS. El operador ve un parpadeo a oscuro cuando debería ver un hold constante.

---

## 3. LA VULNERABILIDAD "OPAQUE MASK" (GOBOSE FANTASMA)

### 3.1 El Mecanismo LTP y Su Ceguera

Para canales NO-HTP (`gobo`, `prisma`, `color_wheel`, `zoom`, `focus`, `pan`, `tilt`...):

```typescript
// NodeArbiter.ts L564-568
} else {
  // LTP: la última escritura (capa más alta) gana
  record[channel] = incoming
}
```

### 3.2 Escenario de Intrusion

**Capa L2 (Manual):**
```typescript
{ dimmer: 0.5, color: 1.0 }  // El operador solo tocó dimmer y color
```

**Capa L0 (Liquid/BeamSystem):**
```typescript
{ gobo: 0.2, prisma: 1.0 }   // El motor decidió cambiar gobo y activar prisma
```

**Resultado del arbitraje:**
```typescript
{
  dimmer:   0.5,   // HTP: max(0, 0.5) = 0.5 (L2 gana)
  color:    1.0,   // LTP: L2 escribe último
  gobo:     0.2,   // LTP: L0 es la ÚNICA capa que escribió gobo
  prisma:   1.0    // LTP: L0 es la ÚNICA capa que escribió prisma
}
```

### 3.3 Diagnóstico: Ausencia de Bloqueo Opaco

**El problema conceptual:** L2 no declaró intención sobre `gobo` ni `prisma`, pero el Arbiter interpreta eso como "L2 no le importa esos canales" en lugar de "L2 toma el control TOTAL del fixture y bloquea todo lo demás".

**Esto permite dos fenómenos espectrales:**

1. **Gobo Fantasma (Poltergeist):** El operador bloquea dimmer/color manualmente, pero L0 (BeamSystem) sigue cambiando gobos automáticamente porque L2 nunca declaró `gobo: X`.

2. **Prisma Parasito:** L0 activa prisma a 1.0 mientras L2 solo quería un wash estático. El fixture proyecta prisms donde no los pidieron.

### 3.4 ¿Por Qué No Existe Opaque Mask?

El Arbiter opera a nivel **nodeId + channel**, no a nivel **fixture**. No existe una entidad `FixtureArbiter` que diga: *"Si L2 toca CUALQUIER canal de este fixture, congélalo completamente para L0"*.

Las únicas excepciones parciales son:
- **WAVE 4713:** Si L2 toca dimmer, bloquea intents L0 no-cinéticos para TODOS los nodos del mismo fixture. PERO esto solo aplica a familias `impact`/`color`, no a `beam`.
- **WAVE 4670 MoverShield:** Solo bloquea canales de color (`r/g/b/white/amber`) para nodos COLOR de movers con rueda física.

**Ninguno de estos mecanismos cubre canales ópticos (`gobo`, `prisma`, `zoom`, `focus`) del sistema BEAM.**

---

## 4. CONFLICTOS MECÁNICOS EN MOVERS (El Caos del Mood)

### 4.1 Frecuencia de Cambio Cromático

| Capa | Fuente de Color | Frecuencia de Cambio | Perfil Temporal |
|------|----------------|---------------------|-----------------|
| L0 (ColorAdapter) | `SeleneColorEngine.generate()` → paleta HSL | Cada frame (44 Hz) | LERP suave ~0.3s |
| L1 (SeleneBus) | Mismo que L0, pero inyectado como override | Cada frame | LERP suave |
| L3 (SeleneAetherAdapter) | `effectOutput.colorOverride` | Depende del efecto | Instantáneo |

**Problema:** ColorAdapter (L0) calcula `node.currentColor` con LERP (0.3s) dentro de `ColorSystem.ts`, pero el **valor target** (`_targetRgb`) cambia en CADA frame según la paleta musical. Si la música transita de Do Mayor a Fa Mayor, el hue target salta de 60° a 160° en un frame, y el LERP tarda ~13 frames en converger.

### 4.2 La Ausencia de Mechanical Cooldown

**Hardware real con ruedas mecánicas:**
- Cambio de gobo mecánico: ~0.3–1.2s
- Rueda de color: ~0.2–0.5s
- Prisma insert/eject: ~0.1–0.3s

**El Arbiter no tiene conocimiento de la física mecánica del fixture.**  
En `NodeResolver.ts` existe `checkDarkSpin()` (WAVE 4557) para ruedas de color, pero:

1. **Solo aplica a transiciones de color wheel** (no a gobos, prismas, zoom).
2. **Opera en la aduana final (egress)**, no en el arbitraje. El Arbiter ya ha decidido el valor; el resolver solo atenúa dimmer durante el tránsito.
3. **No existe filtro anti-spam de color** que diga: *"Si el hue target cambió > 30° en < 0.5s, mantén el color anterior hasta que el hardware pueda seguir"*.

### 4.3 El Efecto Caótico en Vivo

En una transición musical rápida (por ejemplo, un cambio de sección de drop a breakdown):

1. `SeleneColorEngine` detecta cambio de key y genera nueva paleta.
2. ColorAdapter recibe nueva paleta y comienza LERP hacia nuevos RGB.
3. El fixture (mover con rueda de color) recibe comandos DMX a 44 Hz con valores cambiantes.
4. Si la rueda mecánica tarda 300ms en rotar y el LERP cambia significativamente en 100ms, el resolver activa DarkSpin (dimmer=0 durante tránsito).
5. **Resultado perceptivo:** El parpadea oscuro-parpadea claro-parpadea oscuro — un "caos cromático" donde el operador ve al mover intentar seguir cambios imposibles mecánicamente.

---

## 5. FRICCIÓN L0 ESPACIAL vs L3 INTENTS

### 5.1 La Frontera Cinética

| Capa | Responsable de Movimiento | Tipo de Movimiento |
|------|--------------------------|--------------------|
| L0 | `KineticAdapter` | Física espacial continua (posición 3D → pan/tilt) |
| L2 | `AetherKineticEngine` (motor cinético nativo) | Patrones manuales (círculos, figuras, chase) |
| L3 | **BLOQUEADO** | SeleneAetherAdapter nunca emite pan/tilt |

### 5.2 El Riesgo de Interrupción

**Escenario:**  
- L0 (KineticAdapter) está ejecutando una trayectoria suave de 4 segundos: el fixture se desplaza de posición A a posición B con curva de aceleración.
- L3 (SeleneAetherAdapter) NO puede emitir pan/tilt (regla estricta L3).
- PERO L3 SÍ puede emitir `dimmer: 0` o `strobeRate: 1.0`.

**¿Qué ocurre si L3 emite `dimmer: 0` en medio de la trayectoria?**

1. El Arbiter aplica HTP para dimmer. Si L0 tenía `dimmer: 0.8` y L3 emite `dimmer: 0`:
   - HTP → `max(0.8, 0) = 0.8` (L0 gana, el fixture sigue visible).
   - **EXCEPTO** si L3 usa la rama destructiva (WAVE 4705, línea 543): `if (layer === 'effect' && channel === 'dimmer' && incoming <= 0) record[channel] = 0`. El efecto puede FORZAR apagado.

2. El fixture llega a su destino B con `dimmer: 0` (apagado por L3).  
   El operador no ve el movimiento (está oscuro), pero el motor cinético SÍ completó la trayectoria.  
   Cuando L3 suelta el dimmer (efecto termina), el fixture aparece en B — un **teletransporte perceptivo**.

### 5.3 Falta de Coordinación L0-L3

No existe un mecanismo que le diga a L0: *"L3 ha tomado el control de dimmer — detén tu trayectoria cinética hasta que se libere"*.  
El `PhysicsPostProcessor` (WAVE 4518.1) aplica inercia a `pan`/`tilt` post-arbitraje, pero no tiene visibilidad de por qué el dimmer es 0. Si el dimmer está a 0 por L3, la inercia sigue ejecutándose sobre pan/tilt en la oscuridad, gastando ciclos de motor mecánico sin valor perceptivo.

### 5.4 El Efecto Corto (< 2 segundos)

Si Selene decide un efecto flash de 1.5 segundos (`dimmer: 1.0 → 0.0 → 1.0`):

- L3 emite `dimmer: 0` al frame 66 (1.5s).
- L0 (KineticAdapter) tenía una trayectoria de 3 segundos en curso.
- El fixture se apaga a mitad de camino.
- Al reactivarse, la inercia ha movido el pan/tilt a una posición intermedia sin que nadie la haya visto.
- **Resultado:** El fixture "salta" a una posición inesperada cuando el flash termina, interrumpiendo el flujo continuo de L0.

---

## 6. CATÁLOGO DE VULNERABILIDADES ARQUITECTÓNICAS

### V-01: HTP Sin Contexto de Prioridad
**Severidad:** 🔴 ALTA  
**Archivo:** `NodeArbiter.ts:541-563`  
**Descripción:** El HTP opera como `max()` puro sin pesar la prioridad de la capa. Una capa baja (L0) con valor alto puede dominar temporalmente sobre una capa alta (L3) con valor medio, generando flashes de un frame antes de que los mecanismos de lock post-hoc los corrijan.

### V-02: Opaque Mask Ausente
**Severidad:** 🔴 ALTA  
**Archivo:** `NodeArbiter.ts` (diseño general)  
**Descripción:** No existe un mecanismo de "Bloqueo Opaco por Fixture". Cuando L2 toma control parcial de un fixture (ej. solo `dimmer`), L0 sigue inyectando canales no-declarados (`gobo`, `prisma`, `zoom`) como si el fixture estuviera libre.

### V-03: MoverShield Incompleto
**Severidad:** 🟡 MEDIA  
**Archivo:** `NodeArbiter.ts:47-51, 527-534`  
**Descripción:** MoverShield solo bloquea canales de color (`r/g/b/white/amber`) para nodos COLOR. No protege canales BEAM (`gobo`, `prisma`) ni ATMOSPHERE (`fog`, `haze`). Un mover con rueda mecánica puede seguir recibiendo cambios de gobo automáticos mientras su color está bloqueado.

### V-04: Mechanical Cooldown Ausente
**Severidad:** 🟡 MEDIA  
**Archivo:** `ColorSystem.ts`, `NodeResolver.ts`  
**Descripción:** La aduana (`AetherSafetyMiddleware`) tiene `checkDarkSpin()` para ruedas de color, pero no existe un filtro anti-spam general que rate-limite cambios de color/gobo/prisma según la capacidad mecánica real del fixture. El LERP de ColorSystem mitiga visualmente pero no protege el hardware.

### V-05: Desacoplamiento L0-L3 en Cinética
**Severidad:** 🟠 MEDIA-ALTA  
**Archivo:** `TitanOrchestrator.ts:1930-1942`, `PhysicsPostProcessor`  
**Descripción:** L3 puede forzar `dimmer: 0` destructivamente sin notificar a L0 (KineticAdapter). La trayectoria espacial continúa en la oscuridad, generando saltos perceptivos cuando L3 libera el canal. No hay un "Freeze on Blackout" semántico.

### V-06: Granularidad Incorrecta de Manual Hard Lock
**Severidad:** 🟡 MEDIA  
**Archivo:** `NodeArbiter.ts:410-445`  
**Descripción:** El lock de dimmer por fixture (WAVE 4711) replica el valor a TODOS los nodos del fixture, incluyendo nodos que el operador nunca tocó. Si el operador bloquea dimmer del nodo `fix-01:impact`, el Arbiter también congela `fix-01:color` y `fix-01:beam` aunque el operador no quisiera eso.

### V-07: LTP Sin Historial de Capa
**Severidad:** 🟡 MEDIA  
**Archivo:** `NodeArbiter.ts:564-568`  
**Descripción:** LTP solo sabe "último en escribir gana". Si una capa alta (L3) escribe `color: rojo` y luego una capa baja (L0) escribe `color: azul`, L0 gana. El Arbiter no rastrea DE QUÉ CAPA vino cada valor, por lo que no puede detectar que una capa de baja prioridad está pisando una de alta prioridad.

---

## 7. DIAGNÓSTICO FINAL

### El Árbitro No Es un Árbitro — Es un Fusor Ciego

El `NodeArbiter` fue diseñado como un **fusor de valores** (merge engine), no como un **juez de prioridades** (priority arbiter). Sus reglas de merge son localmente correctas (HTP para intensidad, LTP para el resto), pero carecen de tres capacidades fundamentales:

1. **Consciencia de Fixture:** Opera en nodeId+channel, no en fixture. No puede decidir "este fixture está bajo control manual → bloquea todo automático".

2. **Consciencia de Historial:** No rastrea qué capa inyectó cada valor. No puede detectar inversiones de prioridad.

3. **Consciencia Mecánica:** No conoce las capacidades físicas del hardware. No puede rate-limitar cambios imposibles mecánicamente.

### Por Qué Los Poltergeists Aparecen en Vivo

Los "gobos fantasmas" y los "pares que ignoran L2" no son bugs de código — son **síntomas de una arquitectura que delega la responsabilidad de coherencia a capas individuales** (cada System hace lo suyo) sin un director central que valide que las 6 capas L0 no se contradigan entre sí ni invadan el territorio de L2.

La capa L3 (Selene) es la única que tiene reglas estrictas (no emite movimiento), pero incluso ella puede generar intrusiones de color/intensidad que no respetan el estado mecánico del fixture.

---

## 8. RECOMENDACIONES ARQUITECTÓNICAS (SIN PARCHEO)

1. **Introducir un `FixtureLockRegistry`:** Cuando L2 toca cualquier canal de un fixture, registrar el fixture como "opaque locked". Todas las capas L0/L1/L3 deben consultar este registro antes de inyectar canales no-cinéticos.

2. **Extender MoverShield a Beam:** Los canales ópticos (`gobo`, `prisma`, `zoom`, `focus`) de fixtures con ruedas mecánicas deben ser shield-ables desde la constitución del fixture.

3. **Añadir `MechanicalCapabilityProfile` por Fixture:** Definir `minColorTransitionMs`, `minGoboTransitionMs`, `prismaInsertMs`. El Arbiter o el resolver deben rate-limitear cambios respetando estos perfiles.

4. **Implementar `LayerProvenance` en el Arbiter:** Cada valor arbitrado debe llevar metadatos de qué capa lo inyectó. Esto permite detectar y auditar inversiones de prioridad.

5. **Freeze-on-Blackout Semántico:** Cuando L3 fuerza `dimmer <= 0`, el `PhysicsPostProcessor` debe recibir un flag para pausar inercia cinética hasta que el dimmer vuelva > 0.

---

*Fin del informe forense.*
