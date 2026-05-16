# WAVE 4834 — AUDITORÍA: ¿Por qué L0 no se calla cuando L3 habla?

> **Estado:** Auditoría completa. Sin código — solo diagnóstico y propuestas.  
> **Fecha:** 2026-05-16  
> **Contexto:** Tras WAVE 4832 (blendMode propagation) y WAVE 4833 (ZoneNodeRouter nodeId fix), los efectos blandos **ya pintan en pantalla y en DMX**. El problema residual es de **comportamiento**: L0 (Liquid/VMM base) sigue audible/visualmente activo debajo de L3, haciendo que los efectos pierdan su carácter diseñado.

---

## 1. MAPA DE CAPAS ACTUAL

### Pipeline de arbitraje (NodeArbiter.arbitrate)

Orden de aplicación, de menor a mayor prioridad:

| Paso | Capa | Fuente | Descripción |
|------|------|--------|-------------|
| 1 | **L0** | `systemBus.getAll()` | ColorSystem, ImpactSystem, KineticSystem, BeamSystem, AtmosphereSystem |
| 2 | **L1** | `_seleneBus` | Selene IA (cognición musical en tiempo real) |
| 3 | **LP** | `_playbackIntents` | Chronos Timeline (clips programados) |
| 4 | **L2** | `_manualOverrides` | UI faders, MIDI, OSC, Programmer |
| 5 | **L3** | `_effectIntents` | LiveFX Engine (CorazonLatino, SalsaFire, CumbiaMoon…) |
| 6 | **L3+** | `_hephaestusIntents` | Diamond Data custom curves |
| 7 | **Hard Lock** | `_manualChannelLocks` | Re-aplica L2 sobre L3/L3+ (autoridad del operador) |
| 8 | **Intensity Lock** | `_manualDimmerLocks` | Node-wide dimmer/brightness lock |
| 9 | **Release Fades** | `_releaseStates` | Ease-out cúbico al soltar overrides |
| 10 | **Grand Master** | `_grandMaster` | Escala 0-1 sobre dimmer/brightness/strobe |
| 11 | **Inhibit Limits** | `_inhibitLimits` | Cap per-fixture (L2.5) |
| 12 | **L2-MOTOR** | `_motorKineticOverrides` | AetherKineticEngine native output |

### Estrategias de merge por canal

```
STRICT_PRIORITY_CHANNELS = {'strobe', 'shutter'}
  → L4 > LP > L3 > L2 > L1 > L0 (HTP solo dentro de L0)

dimmer / brightness
  → LTP entre capas (última capa en escribir gana)
  → PERO: Smart Gate bloquea L0/L1 si L2/LP tocaron ese canal

todos los demás (r, g, b, white, amber, pan, tilt…)
  → LTP entre capas
  → Smart Gate: L0/L1 solo bloqueados en canales exactos que L2/LP escribieron
```

### WAVE 4832: mergeStrategy per-intent

En `_applyIntent` para `layer === 'effect'`:

| mergeStrategy | Comportamiento | Registra dominación L3 |
|---------------|---------------|------------------------|
| `'LTP'` (default) | `record[ch] = incoming` | **SÍ** → L0/L1 bloqueados en frames futuros |
| `'HTP'` | `record[ch] = max(record[ch], incoming)` | **NO** → L0/L1 siguen contribuyendo |

**Traducción desde blendMode del efecto:**
- `blendMode='replace'` → `mergeStrategy='LTP'` (tirano)
- `blendMode='max'` → `mergeStrategy='HTP'` (blando)

---

## 2. EVIDENCIA DEL PROBLEMA

### Log del usuario (corazon_latino)

```
[SeleneAetherAdapter 🔬] zone=back blend=max dim=0.43 color=H355/S100/L50
[NodeArbiter 🔬] L3 intents=22 sample[[object Object]] merge=HTP dimmer=0.43
[AGC TRUST 🌊LIQUID 7B] profile:latino-fiesta | FL:0.46 FR:0.00 | BL:0.00 BR:0.14 | ML:0.80 MR:0.13
```

**Análisis:**
- L3 emite `dimmer=0.43` en zona `back` con `merge=HTP`
- L0 (Liquid 7B) reporta `FL:0.46` (Front-Left a 46%)
- **Arbitraje HTP:** `max(L0=0.46, L3=0.43) = 0.46` → **L0 gana**, el efecto se pierde
- Resultado visual: las luces de back siguen pulsando al beat de L0; el heartbeat de CorazonLatino es inaudible

### Log del usuario (salsa_fire)

```
[SeleneAetherAdapter 🔬] zone=all-pars blend=replace dim=0.88 color=H0/S100/L50
[SeleneAetherAdapter 🔬] zone=all-movers blend=replace dim=0.53 color=—
[NodeArbiter 🔬] L3 intents=16 sample[[object Object]] merge=LTP dimmer=1.00
```

**Análisis:**
- SalsaFire usa `blend=replace` → `merge=LTP`
- `LTP`: `record['dimmer'] = 0.88` → **reemplaza** cualquier valor previo de L0
- L0 se calla en los nodos que SalsaFire toca → **comportamiento correcto**
- Pero el usuario reporta que SalsaFire "tampoco se pinta" → esto era el bug WAVE 4833 (objetos como nodeIds), ya resuelto

### Conclusión de la evidencia

| Efecto | blendMode | mergeStrategy | ¿Anula L0? | ¿Pintaba antes de WAVE 4833? |
|--------|-----------|---------------|-----------|------------------------------|
| `latina_meltdown` | (global) | LTP | ✅ Sí (dimmerOverride global) | ✅ Sí |
| `core_meltdown` | `replace` | LTP | ✅ Sí (zoneOverrides + dimmerOverride global) | ✅ Sí |
| `salsa_fire` | `replace` | LTP | ✅ Sí | ❌ No (WAVE 4833) |
| `tidal_wave` | `replace` | LTP | ✅ Sí | ❌ No (WAVE 4833) |
| `corazon_latino` | `max` | HTP | ❌ **NO** — L0 gana | ❌ No (WAVE 4833) |
| `cumbia_moon` | `max` | HTP | ❌ **NO** — L0 gana | ❌ No (WAVE 4833) |

**Los efectos que "funcionaban" eran los que usaban LTP (tirano). Los efectos "blandos" (HTP) nunca anulaban L0 — y eso es el problema que reporta el usuario.**

---

## 3. DIAGNÓSTICO DE RAÍZ

### 3.1 El contracto semántico de `blendMode='max'` está roto

**Diseño original (en los efectos):**
```ts
// CumbiaMoon.ts o CorazonLatino.ts
zoneOverrides['back'] = {
  color: { h: 355, s: 100, l: 50 },
  dimmer: 0.4,
  blendMode: 'max',  // "Soy un efecto suave, no quiero matar la fiesta"
}
```

**Intención del autor del efecto:**  
> "No quiero un corte brusco; quiero que mi efecto se mezcle con la base."

**Realidad del motor:**  
> HTP = `max(L0, L3)`. Si L0 (la música) está a 0.8 y el efecto a 0.4, el resultado es 0.8. **El efecto desaparece.**

El blendMode `'max'` fue diseñado pensando en adición o mezcla ponderada, pero el motor lo implementa como HTP puro. **HTP puro no es una mezcla — es una competición donde el más alto gana.**

### 3.2 El problema no es del Arbiter — es del contrato efecto↔motor

El Arbiter implementa HTP correctamente:
```ts
// NodeArbiter.ts:785-793
if (useHtpMerge) {
  const current = record[channel]
  if (current === undefined || incoming > current) {
    record[channel] = incoming
  }
}
```

Esto es HTP matemáticamente correcto. El bug está en que **ningún efecto blando puede ganarle a L0 en un entorno musical activo** porque L0 siempre estará por encima.

### 3.3 Escenario concreto: CumbiaMoon

**Diseño del efecto:**
- Lunares plateados flotando tranquilamente en zonas laterales
- Intensidad baja (0.2-0.4) para crear atmósfera, no dominación
- En silencio: las lunas son visibles
- Con música: L0 pone las mismas zonas a 0.6-0.8 → **las lunas desaparecen**

**Resultado:** El efecto solo es visible durante breakdowns o pasajes suaves de la música. En cualquier otro momento, la base musical lo aplasta.

### 3.4 Escenario concreto: CorazonLatino

**Diseño del efecto:**
- Latido de corazón con dos beats por ciclo (1500ms)
- Zonas front/back con pulso rojo sutil
- La gracia está en el **contraste**: brillo alto → oscuridad → brillo alto

**Resultado con L0 activo:**
- L0 mantiene las zonas a 0.5+ todo el tiempo
- El latido de CorazonLatino (0.3→0.8→0.3) nunca baja lo suficiente
- Se ve como un "tintado rojo" constante, no como un latido

---

## 4. PROPUESTAS DE SOLUCIÓN

### Opción A — "LTP Universal para L3" (cambio de contrato)

**Descripción:** Eliminar `mergeStrategy='HTP'` del Arbiter. Todos los intents L3 usan LTP puro. L0 se calla completamente en las zonas que L3 toca.

**Implementación:**
```ts
// En _applyIntent, layer === 'effect':
// Ignorar intent.mergeStrategy, siempre usar LTP.
// blendMode='max' pierde su significado arbitral.
```

**Pros:**
- Simple: un solo comportamiento para todos los efectos
- CumbiaMoon y CorazonLatino funcionan exactamente como diseñados

**Contras:**
- Rompe el contrato `blendMode='max'` que algunos efectos podrían estar usando correctamente
- Un efecto blanco tenue (`dimmer=0.2`) sobre una base roja (`dimmer=0.8`) apagaría la base → el efecto se vería tenue y solitario, quizá no como el autor quería
- No hay forma de que un efecto "sume" a la base

**Veredicto:** Demasiado rígido. Anula una característica que podría ser útil en otros contextos.

---

### Opción B — "Ducking proporcional de L0" (mezcla inteligente)

**Descripción:** Cuando L3 está activo en un nodo, L0 no se apaga ni se ignora — se **attenúa** proporcionalmente a la intensidad del efecto.

```
efecto_intensidad = 0.3  (L3 dimmer en ese nodo)
L0_atenuado = L0_original * (1 - efecto_intensidad)
resultado = max(L0_atenuado, L3_value)
```

**Ejemplo numérico:**
- L0 dimmer = 0.8, L3 dimmer = 0.3
- L0_atenuado = 0.8 * (1 - 0.3) = 0.56
- Resultado = max(0.56, 0.3) = **0.56**

L0 sigue presente pero más bajo; el efecto tiene espacio para respirar.

**Pros:**
- Efectos blandos coexisten con L0 sin ser aplastados
- No requiere cambiar blendMode en los efectos
- Comportamiento musical: la base baja cuando el efecto "canta"

**Contras:**
- Más complejo de implementar: requiere pasar de arbitraje per-canal a arbitraje per-nodo con cálculo de "intensidad total L3"
- Para CumbiaMoon con dimmer=0.2: L0 baja solo un 20% → quizá sigue siendo demasiado alto
- No garantiza oscuridad total cuando el efecto lo necesita

**Veredicto:** Elegante pero quizá demasiado mágico. No da el control explícito al autor del efecto.

---

### Opción C — "Dominación parcial por L3 (HTP + L0 ducking)" (recomendada)

**Descripción:** Conservar HTP para la mezcla del valor, pero **añadir un paso previo** que silencie L0 en los nodos donde L3 tiene presencia.

Cuando un efecto declara `zoneOverrides`, el sistema entiende que ese efecto **reclama la zona**. L0 se retira de esos nodos antes de que L3 escriba. L3 luego escribe sobre silencio.

**Variantes:**

#### C.1 — Silencio total (muteL0)

```ts
// En el adapter, al procesar zoneOverrides:
// Emitir un intent L3 "dummy" con mergeStrategy='LTP' y dimmer=0
// para registrar dominación y bloquear L0 en esos nodos.
// Luego el efecto real escribe sus valores sobre el silencio.
```

**Pros:**
- CumbiaMoon funciona exactamente: lunas tranquilas sobre oscuridad
- CorazonLatino funciona: latido con contraste real
- No cambia el contrato blendMode de los efectos

**Contras:**
- Si el efecto se detiene abruptamente, L0 vuelve instantáneamente (sin fade)
- Un efecto muy tenue (`dimmer=0.1`) apagaría completamente la zona → quizá demasiado drástico

#### C.2 — Ducking por intensidad del efecto (atténuaL0)

```ts
// Antes de aplicar L0 en arbitrate(), calcular para cada nodo:
//   l3Presence = max(dimers de todos los intents L3 en ese nodo)
//   l0Multiplier = 1 - l3Presence
//   Aplicar L0 con l0Multiplier como factor global del nodo
```

**Pros:**
- Efectos tenues atenúan L0 poco; efectos fuertes lo silencian mucho
- Comportamiento musical natural
- CumbiaMoon (dimmer=0.3): L0 baja a 70% → el efecto es visible
- CorazonLatino (dimmer=0.8 en peak): L0 baja a 20% → el latido domina

**Contras:**
- Requiere arbitraje en dos pasadas (o tracking previo de intensidad L3)
- No zero-allocation trivial

#### C.3 — **Propuesta híbrida: L3 Supremacy para zona (recomendada)**

**Nuevo campo en `EffectFrameOutput`:**
```ts
interface EffectFrameOutput {
  // ...existing fields...
  
  /**
   * WAVE 4834: Cuando un efecto declara zoneOverrides, ¿debe L0
   * silenciarse en esas zonas? 
   * - 'none': L0 fluye normal (comportamiento actual)
   * - 'duck': L0 se atenúa proporcional a la intensidad del efecto
   * - 'mute': L0 se silencia completamente en las zonas del efecto
   * Default: 'mute' (el 90% de los efectos quieren esto)
   */
  zoneL0Behavior?: 'none' | 'duck' | 'mute'
}
```

**Comportamiento por defecto:** `mute`.
- Si un efecto declara `zoneOverrides`, automáticamente L0 se silencia en esas zonas.
- El efecto escribe sobre silencio.
- Si el efecto quiere coexistir, usa `zoneL0Behavior: 'none'` o `'duck'`.

**Impacto en efectos existentes:**
- `CumbiaMoon`: usa `zoneOverrides` → L0 silenciado en esas zonas → ✅ lunas tranquilas
- `CorazonLatino`: usa `zoneOverrides` → L0 silenciado → ✅ latido con contraste
- `SalsaFire`: usa `zoneOverrides` → L0 silenciado → ✅ fuego puro
- `TidalWave`: usa `zoneOverrides` → L0 silenciado → ✅ ola espacial sin base
- `LatinaMeltdown`: usa `dimmerOverride` global + `zoneOverrides` → L0 silenciado globalmente → ✅ (ya funcionaba)

**Efectos que necesitan coexistir** (si los hay en el futuro):
- Usan `zoneL0Behavior: 'none'` y `blendMode='max'` → HTP puro, comportamiento actual

---

## 5. ANÁLISIS DE IMPACTO

### ¿Qué se rompería si implementamos Opción C.3?

| Efecto | blendMode actual | zoneOverrides | ¿Necesita L0 vivo? | Con C.3 (mute) |
|--------|-----------------|---------------|-------------------|----------------|
| `cumbia_moon` | `'max'` | ✅ | ❌ No | ✅ Funciona |
| `corazon_latino` | `'max'` | ✅ | ❌ No | ✅ Funciona |
| `salsa_fire` | `'replace'` | ✅ | ❌ No | ✅ Funciona (sin cambio visible) |
| `tidal_wave` | `'replace'` | ✅ | ❌ No | ✅ Funciona (sin cambio visible) |
| `latina_meltdown` | — | ✅ + global | ❌ No | ✅ Funciona (sin cambio visible) |
| `core_meltdown` | `'replace'` | ✅ + global | ❌ No | ✅ Funciona (sin cambio visible) |
| `gatling_raid` | — | ✅ | ❌ No | ✅ Funciona |

**Conclusión:** Ningún efecto existente en la librería de `fiesta-latina` necesita L0 coexistiendo. Todos son efectos "de escena" que pretenden ser la única luz visible en sus zonas.

### Caso hipotético futuro: efecto ambiental tenue

> "Quiero un efecto de destello muy suave que solo añada un poco de magia sin apagar la base."

Solución con C.3:
```ts
getOutput() {
  return {
    zoneOverrides: { 'front': { color: { h: 200, s: 30, l: 80 }, dimmer: 0.1 } },
    zoneL0Behavior: 'duck',  // L0 baja un 10%, no se apaga
  }
}
```

---

## 6. FLUJO DE DATOS PROPUESTO (Opción C.3)

```
┌─────────────────────────────────────────────────────────────┐
│  FRAME START                                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. EffectManager.getCombinedOutput()                      │
│     - Calcula zoneOverrides combinados de todos los fx      │
│     - blendMode ya propagado (WAVE 4832)                   │
│     - NEW: zoneL0Behavior presente en la salida            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. SeleneAetherAdapter.ingest()                           │
│     - Procesa zoneOverrides → emite intents L3             │
│     - NEW: Si zoneL0Behavior='mute', emite un intent        │
│       especial "L0_SUPPRESS" para esos nodos              │
│       (registra dominación L3 en todos los canales)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. NodeArbiter.arbitrate()                                │
│     a. L0 System intents → _applyIntent('system')          │
│        - Si nodo está en _l3DominatedChannels → SKIP       │
│        - L0 silenciado en zonas con efecto activo          │
│     b. L1 Selene → idem                                    │
│     c. L3 Effects → _applyIntent('effect')                 │
│        - Escribe sobre silencio (LTP o HTP, ambos OK)     │
│     d. Hard Lock / GM / etc.                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  RESULTADO:                                                 │
│  - Zonas sin efecto: L0 fluye normalmente                  │
│  - Zonas con efecto: L0 silenciado, efecto puro           │
│  - Efectos blandos ahora sí son visibles                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. DECISIONES PENDIENTES

Antes de codificar, necesitamos responder:

1. **¿El silencio de L0 debería ser instantáneo o con fade?**
   - Instantáneo: más responsivo, pero puede sentirse abrupto
   - Fade 200ms: más suave, pero el efecto tarda en "aparecer"
   - Recomendación: instantáneo. Los efectos de disparo (one-shot) no pueden esperar.

2. **¿Debería el silencio de L0 afectar también a L1 (Selene)?**
   - Si. Si L3 está en una zona, Selene también debería callarse allí. El efecto es la autoridad.
   - WAVE 4829 (L3 Supremacy) ya implementa esto parcialmente — solo hay que asegurar que el "suppression intent" domine TODOS los canales, no solo los que el efecto toca.

3. **¿Qué pasa cuando el efecto termina?**
   - L0 vuelve instantáneamente (Smart Gate se libera).
   - Si se siente brusco, podemos añadir un "release fade" de L0 en el futuro (WAVE futura).

4. **¿Necesitamos el campo `zoneL0Behavior` o puede ser siempre `mute`?**
   - Si todos los efectos actuales y futuros van a querer silencio, no necesitamos el campo.
   - Si queremos flexibilidad, el campo da libertad al autor del efecto.
   - **Recomendación:** Empezar siempre con `mute` para `zoneOverrides`. Si surge un caso real de coexistencia, añadir el campo. Menor complejidad hoy.

---

## 8. RESUMEN EJECUTIVO

| | |
|---|---|
| **Problema** | Efectos blandos (blendMode='max') usan HTP, pero L0 (música) siempre tiene intensidad más alta → efecto desaparece |
| **Bug previo** | WAVE 4833 (objetos como nodeIds) — YA RESUELTO |
| **Causa real** | Contrato roto: `blendMode='max'` promete coexistencia, pero HTP puro es una competición que L0 siempre gana |
| **Fix recomendado** | Opción C.3 (sin campo opcional): cualquier efecto con `zoneOverrides` silencia automáticamente L0 en esas zonas |
| **Archivos a tocar** | `selene-aether-adapter.ts` (emitir dominación L3 previa), `NodeArbiter.ts` (ya listo vía WAVE 4829) |
| **Riesgo** | Bajo. Ningún efecto existente necesita L0 coexistiendo. Si aparece un caso, se añade `zoneL0Behavior` |
| **Estimación** | 20-30 LOC en adapter + verificación en Arbiter |

---

## 9. ANEXO: Evidencia de logs crudos

```
// corazon_latino — el smoking gun
[SeleneAetherAdapter 🔬] zone=back blend=max dim=0.43 color=H355/S100/L50
[NodeArbiter 🔬] L3 intents=22 sample[[object Object]] merge=HTP dimmer=0.43
[AGC TRUST 🌊LIQUID 7B] ... FL:0.46 ... ML:0.80 ...

// Interpretación:
//   L3 quiere dimmer=0.43 en back
//   L0 tiene dimmer≈0.46 en front-left (y probablemente similar en back)
//   HTP merge: max(0.46, 0.43) = 0.46
//   Resultado: efecto invisible. L0 gana por 0.03.
```

```
// salsa_fire — comportamiento correcto (LTP)
[SeleneAetherAdapter 🔬] zone=all-pars blend=replace dim=0.88
[NodeArbiter 🔬] L3 intents=16 merge=LTP dimmer=1.00

// Interpretación:
//   L3 con LTP: record['dimmer'] = 0.88
//   L0 anterior es SOBRESCRITO, no mezclado
//   Resultado: efecto visible al 88%. L0 callado.
```

**La diferencia entre LTP y HTP, en una cifra:**  
Para `dimmer=0.4` en un club con música al 80%:  
- LTP: efecto al 40%, base al 0% → **efecto VISIBLE**  
- HTP: efecto al 40% vs base al 80% → max=80% → **efecto INVISIBLE**
