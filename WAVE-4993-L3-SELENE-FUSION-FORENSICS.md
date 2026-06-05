# WAVE 4993 — L3 SELENE FUSION & MOVER COLOR CONFLICTS

> **Auditoría forense. ZERO código generado. Solo extracción y constatación.**
> **Fecha:** 2026-06-03  |  **Auditor:** Cascade (Forensic Mode)

---

## 0. RESUMEN EJECUTIVO

Selene (L3 Effects) emite intents visuales vía `SeleneAetherAdapter` → `IIntentBus` → `NodeArbiter.arbitrate()` → `NodeResolver.resolve()` → Hardware DMX. Tres barreras mecánicas/ritmicas pueden consumir o anular los datos de color de L3 antes de que lleguen al fixture:

1. **NodeArbiter — Fusión multicapa**: L3 domina sobre L0/L1 pero NO sobre L2 (Manual) ni LP (Playback). La "prohibición de movimiento en FX" existe, pero NO en el árbitro — está upstream en el adapter.
2. **HarmonicQuantizer — Retención rítmica**: Para fixtures con `color_wheel` física, los cambios de color de L3 pasan por un gate que retiene el color hasta la subdivisión musical más rápida que respete `minChangeTimeMs`.
3. **DarkSpin — Apagón de tránsito**: Si el color cuantizado logra cambiar la rueda mecánica, se fuerza `dimmer=0` durante `minTransitionMs × 1.1`. Un FX de 150ms puede terminar antes de que la luz vuelva a encenderse.

---

## 1. LA FUSIÓN L3 Y EL FILTRO DE MOVIMIENTO (NodeArbiter.ts)

### 1.1 Pipeline de `arbitrate()` — Orden de capas

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:469-748
arbitrate(): ArbitratedNodeMap {
  // 1. Reset pool...
  // 2. Pre-computar canales tocados por L2/LP (Smart Gate)
  // 3. ⚡ WAVE 4917: Pre-carga dominación L3 ANTES de aplicar L0/L1
  this._primeL3DominancePrePass()

  // L0: System intents (IntentBus)
  // L1: Selene IA overrides
  // LP: Playback (Chronos Timeline)
  // L2: Manual overrides (UI Hold)
  // L3: Effect intents (WAVE 4705 — autoridad sobre L2 manual internamente)
  // L3+: Hephaestus custom intents
  // WAVE 4714: MANUAL HARD LOCK (ley del operador)
  // Grand Master + Inhibit + Relative Offset Fusion + Release Fades
}
```

**Hallazgo clave**: L3 se aplica DESPUÉS de L0/L1/LP pero ANTES del MANUAL HARD LOCK. Eso significa que L3 gana sobre L0/L1, pero el operador humano (L2) puede anular a L3 en el último paso.

### 1.2 ¿Cómo aplica la "prohibición de movimiento en los FX"?

**NO existe en NodeArbiter.** La prohibición está en el origen (`SeleneAetherAdapter`):

```typescript
@/electron-app/src/core/aether/adapters/selene-aether-adapter.ts:15-17
 * REGLAS ABSOLUTAS:
 *   ❌ NUNCA emite targetX/Y/Z, pan, tilt (L3 bloqueado de movimiento)
```

El adapter nunca escribe canales cinéticos; el `_colorScratch` solo contiene `r/g/b/red/green/blue/white/amber` y el `_impactScratch` solo `dimmer`. El NodeArbiter **nunca ve `pan` ni `tilt` en intents L3**, por lo que no hay `delete` ni `continue` que los filtre.

### 1.3 Mover Shield — ¿Afecta a L3?

**NO.** El Mover Shield solo bloquea la capa `selene` (L1), NO `effect` (L3):

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:1035-1058
const shieldedColorNode =
  layer === 'selene' &&               // ← SOLO L1
  !this._seleneOverrideMoverShield &&
  this._moverShieldNodeIds.has(intent.nodeId)

for (const channel in values) {
  // MoverShield: bloquea canales de color en L1 para movers con rueda física
  if (shieldedColorNode && MOVER_SHIELD_BLOCKED_CHANNELS.has(channel)) {
    continue                          // ← skipped SOLO para L1
  }
  // ...
}
```

**Conclusión forense**: L3 Effects puede colorear nodos de mover con rueda física libremente. La única barrera es downstream (HarmonicQuantizer + DarkSpin), NO upstream en el árbitro.

### 1.4 L3 Dominance — Supremacía absoluta sobre L0/L1

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:1067-1072
// WAVE 4829: ABSOLUTE L3 OVERRIDE — L3 Supremacy.
// Si L3 ya escribió este canal en este nodo, L0/L1 son silenciados.
if (l3DominatedChannels?.has(channel) === true) {
  continue
}
```

Y la pre-pass que la alimenta:

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:1133-1161
private _primeL3DominancePrePass(): void {
  for (let i = 0; i < this._effectIntents.length; i++) {
    const intent = this._effectIntents[i]
    const values = intent.values
    for (const channel in values) {
      const incoming = values[channel]
      if (!isFiniteChannelValue(incoming)) continue
      this._registerL3Dominance(intent.nodeId, channel)
    }
  }
  // ... idem para Hephaestus
}
```

**Consecuencia**: Si L3 escribe `dimmer` en un nodo `:impact`, L0 queda amordazado en `dimmer/brightness/strobe/shutter` de ese nodo vía el **L3 Luminance Gag** (WAVE 4871):

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:1175-1194
// ⚡ WAVE 4871 + WAVE 4917: L3 LUMINANCE GAG.
// Si L3 escribe en :impact o :color, dominar también luminancia
// en ambos nodos del fixture para apagar sangrado L0/L1.
const family = nodeId.slice(sep + 1)
if (!L3_GAG_TRIGGER_FAMILIES.has(family)) return
const fixturePrefix = nodeId.slice(0, sep)
for (const gagFamily of L3_GAG_TRIGGER_FAMILIES) {
  const gagNodeId = `${fixturePrefix}:${gagFamily}`
  // ... marca dimmer/strobe/shutter/brightness como dominados
}
```

---

## 2. EL CONSUMO DEL DARKSPIN (AetherSafetyMiddleware + NodeResolver)

### 2.1 Lógica del DarkSpin

DarkSpin vive en dos lugares:
- **`AetherSafetyMiddleware.checkDarkSpin()`**: detecta cambio de rueda y calcula apagón.
- **`NodeResolver._applyDarkSpinCrossNodeSweep()`**: después de escribir todos los nodos, busca dispositivos en tránsito y fuerza `dimmer=0` / `shutter=0` en sus nodos `:impact`.

**`AetherSafetyMiddleware.checkDarkSpin`:**

```typescript
@/electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts:282-318
checkDarkSpin(nodeId, currentWheelDmx, minTransitMs, safetyMargin = 1.1): boolean {
  let s = this._darkSpinState.get(nodeId)
  if (!s) {
    s = { lastStableWheelDmx: currentWheelDmx, pendingWheelDmx: currentWheelDmx,
          inTransit: false, transitStartMs: 0, transitDurationMs: 0 }
    this._darkSpinState.set(nodeId, s)
    return false
  }

  const now = this._nowMs

  // CHECK 1: Active transit?
  if (s.inTransit) {
    const elapsed = now - s.transitStartMs
    const failSafe = s.transitDurationMs * 2
    if (elapsed >= failSafe) {
      s.inTransit = false; s.lastStableWheelDmx = s.pendingWheelDmx
    } else if (elapsed < s.transitDurationMs) {
      return true  // Still in blackout
    } else {
      s.inTransit = false; s.lastStableWheelDmx = s.pendingWheelDmx
    }
  }

  // CHECK 2: New color change?
  if (currentWheelDmx !== s.lastStableWheelDmx) {
    s.inTransit = true
    s.transitStartMs = now
    s.transitDurationMs = Math.round(minTransitMs * safetyMargin)  // ← DURACIÓN
    s.pendingWheelDmx = currentWheelDmx
    return true  // Blackout starts now
  }

  return false
}
```

**Fórmula de duración del apagón:**
```
transitDurationMs = round(minTransitMs × 1.1)
```

Para un Beam 2R típico, `minTransitMs` puede ser 500ms → apagón de **550ms**.

### 2.2 ¿Puede un FX corto quedar "invisible"?

**SÍ.** El escenario es matemáticamente posible:

1. Selene emite un FX de 150ms (ej. flash de color en un beat) a un nodo COLOR de mover con rueda mecánica.
2. El HarmonicQuantizer deja pasar el cambio (gate abierto).
3. `_translateColor` detecta que el slot de rueda cambió → `checkDarkSpin` retorna `true` → inicia tránsito de 550ms.
4. El FX termina su duración de 150ms y deja de emitir intents L3.
5. La luz del mover sigue en blackout porque `elapsed < transitDurationMs`.
6. Para el público: el FX "nunca existió".

**NodeResolver ejecuta el sweep cross-node:**

```typescript
@/electron-app/src/core/aether/resolver/NodeResolver.ts:1115-1159
private _applyDarkSpinCrossNodeSweep(): void {
  const sm = this._safetyMiddleware
  if (!sm) return

  const transitNodeIds = sm.getDarkSpinTransitNodeIds()
  if (transitNodeIds.length === 0) return

  const transitDevices = new Set<DeviceId>()
  for (const nodeId of transitNodeIds) {
    const node = this._graph.getNodeData(nodeId)
    if (!node || node.family !== NodeFamily.COLOR) continue
    if (!this._isDarkSpinEligibleColorNode(node as IColorNodeData)) continue
    transitDevices.add(node.deviceId)
  }
  if (transitDevices.size === 0) return

  // For each transit device, find its IMPACT nodes and kill dimmer/shutter
  for (const deviceId of transitDevices) {
    // ... busca nodos IMPACT del mismo fixture ...
    for (const chDef of node.channels) {
      if (chDef.type !== DIMMER_CHANNEL && chDef.type !== SHUTTER_CHANNEL) continue
      const idx = baseAddr + chDef.dmxOffset
      if (idx < 0 || idx >= DMX_UNIVERSE_SIZE) continue
      if (buf[idx] > 0) {
        buf[idx] = 0        // ← KILL: dimmer/shutter a cero
        killed++
      }
    }
  }
}
```

**Conclusión forense**: DarkSpin no solo anula el color — anula **toda la intensidad del fixture** durante el tránsito. Un FX corto que active la rueda de un mover genera un apagón de 500-600ms que supera ampliamente la vida del propio FX.

---

## 3. LA RETENCIÓN DEL CUANTIZADOR (HarmonicQuantizer)

### 3.1 Lógica de cuantización

```typescript
@/electron-app/src/hal/translation/HarmonicQuantizer.ts:153-237
public quantize(
  fixtureId: string,
  newColor: RGBColor | undefined,
  bpm: number,
  bpmConfidence: number,
  minChangeTimeMs: number,
): QuantizerResult {
  const now = Date.now()

  if (!newColor) {
    return { colorAllowed: true, harmonicPeriodMs: 0, beatMultiplier: 0, timeUntilNextChangeMs: 0 }
  }

  // Confianza de BPM demasiado baja → fallback a debounce simple
  if (bpmConfidence < MIN_BPM_CONFIDENCE) {    // MIN_BPM_CONFIDENCE = 0.3
    return { colorAllowed: true, ... }
  }

  // ...estado por fixture...

  const harmonicPeriodMs = state.currentHarmonicPeriodMs
  const elapsed = now - state.lastColorChangeTime

  // ¿Es el mismo color? → no consume el gate
  if (state.lastAllowedColor && this.colorsEqual(newColor, state.lastAllowedColor)) {
    return { colorAllowed: true, ... }
  }

  // ¿Ha pasado el período armónico?
  if (elapsed >= harmonicPeriodMs) {
    // GATE ABIERTO → permitir cambio
    state.lastColorChangeTime = now
    state.lastAllowedColor = { ...newColor }
    return { colorAllowed: true, ... }
  }

  // GATE CERRADO → color no permitido en este tick
  return { colorAllowed: false, ... }
}
```

### 3.2 Dónde se aplica en el pipeline L3 → Hardware

```typescript
@/electron-app/src/core/aether/resolver/NodeResolver.ts:1479-1503
// ── HarmonicQuantizer: gating musical de cambios de rueda ────
const qResult = getHarmonicQuantizer().quantize(
  nodeId,
  this._rgbScratch,
  _currentBpm,
  _currentBpmConfidence,
  aetherWheel.minTransitionMs,
)
if (!qResult.colorAllowed) {
  // El quantizer bloquea el cambio: retener el último valor permitido.
  const qState = getHarmonicQuantizer().getFixtureState(nodeId)
  if (qState?.lastAllowedColor) {
    const heldResult = getColorTranslator().translate(
      qState.lastAllowedColor,
      { colorEngine: { mixing: 'wheel', colorWheel: legacyWheel } },
    )
    wheelDmxNorm = (heldResult.colorWheelDmx ?? 0) / 255
  }
  // Si no hay lastAllowedColor, mantenemos el valor ya calculado
}
```

**Flujo visual:**
1. L3 emite `r=1.0, g=0.0, b=0.0` (rojo puro) a un nodo COLOR de mover.
2. `_translateColor` convierte RGB → slot de rueda mecánica más cercano.
3. **HarmonicQuantizer evalúa**: ¿ha pasado el período armónico desde el último cambio?
   - Si NO → `colorAllowed: false` → el fixture **mantiene el color anterior** (retención).
   - El intent L3 de color **no se descarta completamente** — se retiene el último color que el cuantizador aprobó.
4. Solo si `colorAllowed: true`, el color nuevo pasa al DarkSpin.

### 3.3 Período armónico calculado

```typescript
@/electron-app/src/hal/translation/HarmonicQuantizer.ts:116-137
public findResonantPeriod(bpm, minChangeTimeMs): { periodMs, multiplier } {
  const safeBpm = bpm > 0 ? bpm : DEFAULT_BPM        // DEFAULT_BPM = 120
  const beatPeriodMs = 60000 / safeBpm

  for (const multiplier of BEAT_MULTIPLIERS) {      // [1, 2, 4, 8, 16]
    const periodMs = beatPeriodMs * multiplier
    if (periodMs >= minChangeTimeMs) {
      return { periodMs, multiplier }
    }
  }
  // fallback al máximo multiplicador
}
```

**Ejemplo con Beam 2R (minChangeTimeMs = 500ms) y BPM = 128:**
- beatPeriod = 468.75ms
- ×1 = 468.75ms < 500ms → rechazado
- ×2 = 937.50ms ≥ 500ms → **elegido**
- Período armónico = **937.5ms** (~1 compás)

**Conclusión forense**: El HarmonicQuantizer retiene los cambios de color de L3 esperando al beat. Si Selene emite un FX de 150ms justo después de un cambio aprobado, el cuantizador puede rechazarlo y retener el color PREVIO durante ~937ms. El FX visual nunca se manifiesta en la rueda mecánica.

---

## 4. CADENA DE FALLA COMPLETA (Escenario Hipotético)

**Condiciones**: Mover con rueda mecánica (Beam 2R), BPM=128, minChangeTimeMs=500ms, FX de Selene de 150ms con color rojo intenso.

| Paso | Módulo | Acción | Resultado para el público |
|------|--------|--------|---------------------------|
| 1 | SeleneAetherAdapter | Emite intent L3 `r=1.0` a nodo COLOR | — |
| 2 | NodeArbiter | L3 domina L0/L1; no hay L2 manual | Color rojo gana el nodo |
| 3 | NodeResolver._translateColor | Convierte RGB → slot de rueda | — |
| 4 | HarmonicQuantizer | `elapsed < 937ms` → `colorAllowed: false` | **Retiene color anterior** (rojo no llega) |
| 5 | *(alternativa)* | Si el gate abre → nuevo slot aprobado | Rueda empieza a girar |
| 6 | DarkSpin (checkDarkSpin) | Detecta cambio de slot → `inTransit = true`, 550ms blackout | **Luz apagada** |
| 7 | DarkSpin (cross-node sweep) | Busca nodos IMPACT del mismo fixture → `dimmer=0`, `shutter=0` | Fixture completamente oscuro |
| 8 | FX de 150ms termina | L3 deja de emitir | — |
| 9 | DarkSpin continúa | `elapsed = 150ms < 550ms` → sigue en blackout | **Sigue apagado** |
| 10 | DarkSpin libera | `elapsed = 550ms` → tránsito termina | Luz vuelve, pero el FX ya no existe |

**Hallazgo crítico**: La concatenación HarmonicQuantizer (retención) + DarkSpin (apagón) puede hacer que un FX de Selene sea completamente invisible en fixtures con rueda mecánica, aunque el intent L3 llegue correctamente al NodeArbiter.

---

## 5. BLOQUES DE CÓDIGO GOBERNANTES (Extractos Exactos)

### 5.1 SeleneAetherAdapter — Emisión de color L3

```typescript
@/electron-app/src/core/aether/adapters/selene-aether-adapter.ts:535-585
private _emitColor(zone, color, confidence, bus): void {
  const nodeIds = this._zoneRouter.resolve(zone, NodeFamily.COLOR)
  // ...
  this._clearColorScratch()
  const scratch = this._colorScratch
  const vals    = this._colorValues

  vals.r = r; vals.g = g; vals.b = b
  vals.red = r; vals.green = g; vals.blue = b
  scratch.confidence   = confidence
  scratch.mergeStrategy = 'LTP'

  for (let i = 0; i < nodeIds.length; i++) {
    scratch.nodeId = nodeIds[i]
    bus.push(scratch as unknown as INodeIntent)
  }
}
```

### 5.2 NodeArbiter — L3 Dominance Pre-Pass

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:1133-1161
private _primeL3DominancePrePass(): void {
  for (let i = 0; i < this._effectIntents.length; i++) {
    const intent = this._effectIntents[i]
    const values = intent.values
    for (const channel in values) {
      const incoming = values[channel]
      if (!isFiniteChannelValue(incoming)) continue
      this._registerL3Dominance(intent.nodeId, channel)
    }
  }
  // ... idem para Hephaestus
}
```

### 5.3 NodeArbiter — L3 Supremacy en `_applyIntent`

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:1067-1072
if (l3DominatedChannels?.has(channel) === true) {
  continue   // L0/L1 silenciados en este canal
}
```

### 5.4 NodeArbiter — Mover Shield (SOLO L1)

```typescript
@/electron-app/src/core/aether/NodeArbiter.ts:1035-1058
const shieldedColorNode =
  layer === 'selene' &&
  !this._seleneOverrideMoverShield &&
  this._moverShieldNodeIds.has(intent.nodeId)

if (shieldedColorNode && MOVER_SHIELD_BLOCKED_CHANNELS.has(channel)) {
  continue   // skipped SOLO para L1
}
```

### 5.5 HarmonicQuantizer — Gate cerrado

```typescript
@/electron-app/src/hal/translation/HarmonicQuantizer.ts:230-237
// GATE CERRADO → color no permitido en este tick
return {
  colorAllowed: false,
  harmonicPeriodMs,
  beatMultiplier: this.getCurrentMultiplier(effectiveBpm, harmonicPeriodMs),
  timeUntilNextChangeMs: harmonicPeriodMs - elapsed,
}
```

### 5.6 NodeResolver — Retención cuando el Quantizer bloquea

```typescript
@/electron-app/src/core/aether/resolver/NodeResolver.ts:1488-1503
if (!qResult.colorAllowed) {
  const qState = getHarmonicQuantizer().getFixtureState(nodeId)
  if (qState?.lastAllowedColor) {
    const heldResult = getColorTranslator().translate(
      qState.lastAllowedColor,
      { colorEngine: { mixing: 'wheel', colorWheel: legacyWheel } },
    )
    wheelDmxNorm = (heldResult.colorWheelDmx ?? 0) / 255
  }
}
```

### 5.7 AetherSafetyMiddleware — Inicio del DarkSpin blackout

```typescript
@/electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts:308-315
if (currentWheelDmx !== s.lastStableWheelDmx) {
  s.inTransit = true
  s.transitStartMs = now
  s.transitDurationMs = Math.round(minTransitMs * safetyMargin)  // 1.1×
  s.pendingWheelDmx = currentWheelDmx
  return true  // Blackout starts now
}
```

### 5.8 NodeResolver — Cross-node sweep (kill dimmer/shutter)

```typescript
@/electron-app/src/core/aether/resolver/NodeResolver.ts:1147-1155
for (const chDef of node.channels) {
  if (chDef.type !== DIMMER_CHANNEL && chDef.type !== SHUTTER_CHANNEL) continue
  const idx = baseAddr + chDef.dmxOffset
  if (idx < 0 || idx >= DMX_UNIVERSE_SIZE) continue
  if (buf[idx] > 0) {
    buf[idx] = 0        // KILL
    killed++
  }
}
```

---

## 6. HALLAZGOS Y RECOMENDACIONES FORENSES

### 6.1 Hallazgos Críticos

1. **[ARCHITECTURE]** L3 Effects NO está bloqueado de colorear movers con rueda física. El Mover Shield (`MOVER_SHIELD_BLOCKED_CHANNELS`) solo afecta a L1 (Selene IA), NO a L3. Esto es **correcto por diseño** (WAVE 4675: "efectos diplomáticos de Selene"), pero implica que L3 puede disparar cambios de rueda que luego son consumidos por DarkSpin.

2. **[PHYSICS]** DarkSpin apaga el **fixture completo** (todos sus nodos IMPACT) durante el tránsito de rueda. Un FX de duración < `minTransitionMs × 1.1` es matemáticamente imposible de ver en un mover con rueda mecánica.

3. **[RHYTHM]** HarmonicQuantizer retiene cambios de color esperando subdivisiones musicales. Si el FX llega "entre beats", se retiene el color PREVIO. El FX nuevo no se manifiesta hasta el próximo gate armónico.

4. **[UPSTREAM BAN]** La "prohibición de movimiento en FX" NO existe en NodeArbiter. Es una **regla de conducta** del `SeleneAetherAdapter` (no emite pan/tilt). No hay enforcement downstream.

### 6.2 Recomendaciones (Solo constatación, no ejecución)

- **R1:** Evaluar si el DarkSpin debería ser "fixture-aware" en lugar de "device-aware". Actualmente anula TODOS los nodos IMPACT del dispositivo. Si un fixture tiene múltiples celdas de impacto, todas se apagan.
- **R2:** Considerar si los FX de duración < 550ms deberían rutear a movers a través de canales electrónicos (RGB/CMY) en lugar de rueda mecánica, o si deberían ser descartados upstream por Selene.
- **R3:** Verificar si el HarmonicQuantizer + DarkSpin combo está provocando que los FX de Selene sean invisibles en producción sin que el algoritmo cognitivo lo sepa (no hay feedback loop de "FX no llegó al hardware").
- **R4:** El Mover Shield no protege a L3. Si en algún momento un efecto L3 incluye `colorWheel` como canal (vía Hephaestus), el NodeArbiter lo dejaría pasar y el DarkSpin lo consumiría igual.

---

## 7. ANEXO: MAPA DE DATOS L3 → HARDWARE

```
Selene (DecisionMaker)
  └─> SeleneAetherAdapter._emitColor() ── L3 intent (r,g,b) ──┐
                                                               │
  ┌─ IIntentBus.push() ◄───────────────────────────────────────┘
  │
  └─> NodeArbiter.arbitrate()
      ├─ _primeL3DominancePrePass()   ← registra dominación L3
      ├─ L0, L1, LP aplicadas
      ├─ L3 Effect intents aplicadas  ← L3 gana sobre L0/L1
      └─ L3+ Hephaestus aplicadas
      ├─ MANUAL HARD LOCK (L2 final)
      └─ Grand Master + Inhibit
          │
          ▼
    NodeResolver.resolve()
      ├─ _translateColor()
      │   ├─ ColorTranslator: RGB → slot de rueda
      │   ├─ HarmonicQuantizer.quantize()  ← GATE 1 (retención rítmica)
      │   │      ├─ colorAllowed=true  → nuevo slot pasa
      │   │      └─ colorAllowed=false → retiene slot anterior
      │   └─ DarkSpin check (AetherSafetyMiddleware) ← GATE 2 (apagón)
      │          ├─ inBlackout=true  → dimmer=0 en COLOR node
      │          └─ inBlackout=false → color fluye
      │
      ├─ _writeNode() para cada nodo
      └─ _applyDarkSpinCrossNodeSweep()  ← KILL dimmer/shutter en IMPACT nodes
          │
          ▼
    DMX Universe Buffer (Uint8Array 512)
```

---

*Fin del informe forense WAVE 4993.*
