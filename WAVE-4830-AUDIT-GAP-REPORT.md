# WAVE 4830 — AUDITORÍA: DARKSPIN, QUANTIZER & L3 VETOS

> **Mandato:** Solo lectura y reporte. Cero modificaciones de código.
>
> **Objetivo:** Trazar la ruta exacta de la señal desde que Selene pide "Oro" hasta que la HAL decide taparlo con DarkSpin, y documentar el veto de movimiento L3.

---

## 🔍 PASO 1: EL ECOSISTEMA DE LA RUEDA DE COLOR

### 1.1 DarkSpin — ¿Cuánto blackout impone?

Existen **dos implementaciones** del mismo concepto:

| Implementación | Archivo | Pipeline actual |
|---|---|---|
| Legacy singleton | `src/hal/translation/DarkSpinFilter.ts` | **Muerto en producción** (quedó del HAL legacy) |
| Activa (egress) | `src/core/aether/egress/AetherSafetyMiddleware.ts` | **Vivo en el hot-path de 44Hz** |

#### AetherSafetyMiddleware.checkDarkSpin (la que manda)

```typescript
// @src/core/aether/egress/AetherSafetyMiddleware.ts:282
checkDarkSpin(
  nodeId: NodeId,
  currentWheelDmx: number,
  minTransitMs: number,
  safetyMargin: number = 1.1
): boolean
```

**Algoritmo:**
1. Guarda `lastStableWheelDmx` por nodo.
2. Si `currentWheelDmx !== lastStableWheelDmx` → **activa tránsito**.
3. `transitDurationMs = Math.round(minTransitMs * safetyMargin)`.
4. Durante ese tiempo, `checkDarkSpin()` devuelve `true` → **blackout activo**.
5. Fail-safe: si el tránsito se atasca (> 2× duration), fuerza reset.

**Valores típicos para fixtures con rueda mecánica:**
- `minTransitMs` viene del perfil del fixture (ej: Beam 2R ≈ 500ms).
- Con `safetyMargin = 1.1` → **~550ms de blackout** por cada cambio de slot.
- **Consecuencia:** Si Selene emite un efecto de color que cambia 3 veces en 2 segundos, el fixture pasa ~1.65s en blackout total. El efecto se vuelve **invisible**.

#### ¿Existe flag `ignoreDarkspin` o `snapColor`?

**NO.** Se buscó en:
- `AetherSafetyMiddleware.ts` — `checkDarkSpin` no recibe flags opcionales.
- `NodeResolver.ts` — `_translateColor()` llama a `checkDarkSpin` sin flags de bypass.
- `DarkSpinFilter.ts` — API pública (`filter`, `resetFixture`) sin flags de salto.

> **GAP CRÍTICO:** No existe mecanismo para que un Intent L3 declare "soy un efecto rápido, sáltate el DarkSpin". Todos los cambios de rueda mecánica pasan por el mismo blackout de ~550ms.

---

### 1.2 HarmonicQuantizer — ¿Cómo interactúa con Gold y White?

```typescript
// @src/hal/translation/HarmonicQuantizer.ts:97
findResonantPeriod(bpm: number, minChangeTimeMs: number)
```

**Algoritmo:**
1. `beatPeriodMs = 60000 / bpm`
2. Itera multiplicadores `[1, 2, 4, 8, 16]`.
3. Elige el **más pequeño** cuyo `periodMs >= minChangeTimeMs`.

**Ejemplos:**

| BPM | beatPeriod | minChangeTime | Multiplicador elegido | Gate real |
|---|---|---|---|---|
| 95 (reguetón) | 631ms | 500ms | ×1 | **631ms** |
| 128 (techno) | 468ms | 500ms | ×2 | **937ms** |
| 150 (hard techno) | 400ms | 500ms | ×2 | **800ms** |

**Observación:** A BPM bajos (latino), el quantizer es **más permisivo** (gate cada 631ms). A BPM altos, es **más restrictivo** (gate cada 937ms). Esto significa que en techno los cambios de color están más espaciados — pero en latino hay más ventana para cambiar.

#### Gold y White en el Quantizer

**El Quantizer NO sabe de colores.** Es un gate temporal puro. Solo compara:
- `elapsed >= harmonicPeriodMs`
- `colorsEqual(newColor, lastAllowedColor)` (comparación exacta RGB)

**GAP ENCONTRADO:** Si la rueda mecánica del fixture tiene un slot "Amber" a DMX 70 y otro "Yellow" a DMX 85, y Selene pide "Gold" (RGB 255,200,40), el `ColorTranslator` elige el slot más cercano. Si en el siguiente frame Selene pide un tono ligeramente diferente (por interpolación de efecto), el Quantizer ve un color **diferente** y reinicia el gate — aunque físicamente la rueda no necesite moverse porque el slot elegido es el mismo.

---

### 1.3 ColorTranslator — ¿Cómo clava Gold/White en la ranura?

```typescript
// @src/hal/translation/ColorTranslator.ts:390
findNearestColorLab(target: RGB, wheel: ColorWheelDefinition, profileId: string)
```

**Algoritmo actual (WAVE 3456 — MECHANICAL HUE MATCHER):**
1. Convierte target y cada slot a HSL.
2. Si target es neutro (`saturation < 0.15`) → **devuelve slot 0 (Open/White) directamente**.
3. Si target es cromático → compara diferencia de hue circular.
4. Slots neutros (White, Open) reciben distancia penalizada = 180°.
5. Si `hueDiff > 45°` → `poorMatch = true`.

#### White
- Si el target es blanco puro (s < 0.15), el algoritmo **bypassa** el matching y devuelve el primer slot (`Open/White`).
- **Esto funciona** siempre que el primer slot de la rueda sea Open o White.

#### Gold (RGB 255,200,40)
- Hue ≈ **45°** (ámbar/dorado).
- Depende **100% de los slots físicos del fixture**:
  - Si la rueda tiene "Amber" a 40° → match perfecto.
  - Si la rueda tiene "Yellow" a 60° → diff = 15°, `poorMatch = false`, pero **no es oro puro**.
  - Si la rueda tiene "Orange" a 30° → diff = 15°, similar.
  - Si la rueda NO tiene nada entre 0°-90° → el match cae en el slot cromático más cercano (ej. Red a 0° o Green a 120°), `poorMatch = true`.

**GAP CRÍTICO:** No hay hardcodeo de "Gold" o "White". El matching es **puramente perceptual contra la rueda del fixture**. Si el fixture no tiene un slot ámbar/dorado, Selene nunca podrá pedir "Oro" y obtener oro — obtendrá el color más cercano, con `poorMatch = true` como bandera de advertencia.

---

## 🔍 PASO 2: EL VETO DE MOVIMIENTO L3

### 2.1 Capa 1 — El Adapter L3 (`selene-aether-adapter.ts`)

```typescript
// @src/core/aether/adapters/selene-aether-adapter.ts:16
// REGLAS ABSOLUTAS:
//   ❌ NUNCA emite targetX/Y/Z, pan, tilt (L3 bloqueado de movimiento)
```

```typescript
// @src/core/aether/adapters/selene-aether-adapter.ts:348
// ❌ override.movement → DESCARTADO (Regla L3: movimiento ≡ KineticAdapter)
```

**Veredicto:** Es un **bloqueo de canal**, NO un bloqueo de Intent completo.
- El adapter itera `zoneOverrides`, extrae `color`, `dimmer`, `white`, `amber`, `strobeRate`.
- Cuando ve `movement` (con `pan`/`tilt`), lo **ignora** (`continue` implícito).
- El resto del efecto (color, dimmer, strobe) sigue su camino hacia el IntentBus.

### 2.2 Capa 2 — NodeArbiter (MoverShield)

```typescript
// @src/core/aether/NodeArbiter.ts:70
const MOVER_SHIELD_BLOCKED_CHANNELS = new Set<string>([
  'r', 'g', 'b', 'red', 'green', 'blue', 'white', 'amber',
])
```

```typescript
// @src/core/aether/NodeArbiter.ts:686-692
const shieldedColorNode =
  layer === 'selene' &&
  !this._seleneOverrideMoverShield &&
  this._moverShieldNodeIds.has(intent.nodeId)
for (const channel in values) {
  if (shieldedColorNode && MOVER_SHIELD_BLOCKED_CHANNELS.has(channel)) {
    continue
  }
```

**Veredicto:** El MoverShield **solo aplica a L1 (`selene`)**, NO a L3 (`effect`).
- La capa `'effect'` (L3) pasa por `_applyIntent()` sin ningún MoverShield.
- El `overrideMoverShield: true` de los efectos (`OroSolido`, `CorazonLatino`) es redundante para L3, pero sirve para L1 si algún efecto colorea vía Selene directa.
- Después de WAVE 4829 (L3 Supremacy), L3 escribe color libremente en movers — y el Escudo Anti-Sangrado bloquea L0/L1 en esos canales.

### 2.3 Capa 3 — Los Efectos mismos

```typescript
// @src/core/effects/library/fiestalatina/OroSolido.ts:282-294
'movers-left': {
  color: hsl,
  dimmer: scaledIntensity,
  // 🚨 WAVE 2690: movement PURGED — Selene no conduce posiciones
  blendMode: 'replace',
},
```

```typescript
// @src/core/effects/library/fiestalatina/CorazonLatino.ts:356-359
const moverOverride = {
  color: this.config.heatColor,
  dimmer: this.heartIntensity * 0.8,
  // 🚨 WAVE 2690: movement PURGED — Selene solo pinta fotones
}
```

**Veredicto:** Los efectos ya se **autocensuran**. Calculan posiciones internamente (`panLeftNow`, `panRightNow`, `tiltNow` en `OroSolido`) pero **nunca las emiten** en `getOutput()`. El adapter no tiene nada que descartar porque el `movement` simplemente no existe en el payload.

### 2.4 Resumen del Veto

| Capa | Tipo de bloqueo | ¿Afecta color/dimmer? | ¿Cancela el efecto? |
|---|---|---|---|
| Adapter L3 | Canal (`movement` descartado) | **NO** | **NO** |
| NodeArbiter MoverShield | Canal (para L1 selene) | Sí (solo L1) | NO |
| Efectos mismos | Autocensura (no emiten movement) | NO | NO |

> **CONCLUSIÓN:** El veto de movimiento es **no destructivo**. Ninguna capa cancela el Intent completo. El efecto se renderiza con color, dimmer y strobe — simplemente sin pan/tilt. Los "efectos caídos" por veto de movimiento **no existen en el código actual** (desde WAVE 2690).

---

## 🔍 PASO 3: AUTOPSIA DE EFECTOS `orosolido` Y `corazonlatino`

### 3.1 OroSolido

```typescript
// @src/core/effects/library/fiestalatina/OroSolido.ts:130-139
readonly effectType = 'oro_solido'
readonly category: EffectCategory = 'physical'
readonly priority = 98
override readonly mixBus = 'global' as const  // DICTADOR — silencia todo
```

**Canales declarados en `getOutput()`:**
- `zoneOverrides.front`: `color`, `dimmer`, `white`, `amber`, `blendMode: 'replace'`
- `zoneOverrides.back`: idem
- `zoneOverrides['movers-left']`: `color`, `dimmer`, `blendMode: 'replace'`
- `zoneOverrides['movers-right']`: idem
- `overrideMoverShield: true`

**Canales NO declarados:**
- ❌ `movement` (pan/tilt) — WAVE 2690 PURGED
- ❌ `strobeRate`
- ❌ `globalComposition` (hereda del sistema)

**Nota:** Aunque `OroSolido` calcula internamente `panLeftNow`, `panRightNow`, `tiltNow` (líneas 241-247), estos valores **nunca salen** del objeto. Son código muerto desde el punto de vista del pipeline.

### 3.2 CorazonLatino

```typescript
// @src/core/effects/library/fiestalatina/CorazonLatino.ts:123-128
readonly effectType = 'corazon_latino'
readonly category: EffectCategory = 'physical'
readonly priority = 85
readonly mixBus = 'htp' as const
```

**Canales declarados en `getOutput()`:**
- `zoneOverrides.back`: `color`, `dimmer`, `blendMode: 'max'`
- `zoneOverrides['all-movers']`: `color`, `dimmer`, `blendMode: 'max'`
- `zoneOverrides.front`: `color`, `dimmer`, `white`, `amber`, `blendMode: 'max'`
- `overrideMoverShield: true`

**Canales NO declarados:**
- ❌ `movement` (pan/tilt) — WAVE 2690 PURGED
- ❌ `strobeRate`

### 3.3 ¿Son residuales de pantilt que podemos amputar?

**NO.** Desde WAVE 2690 (y reforzado en WAVE 1009 FREEDOM DAY), ambos efectos ya están limpios:
- No hay campo `movement` en sus `zoneOverrides`.
- El adapter no descarta nada porque no hay nada que descartar.
- El veto de movimiento L3 **no aplica** a estos efectos.

Si el usuario percibe que `orosolido` o `corazonlatino` "caen" por algún veto, el culpable NO es el veto de movimiento. Las causas reales probables son:
1. **DarkSpin** — el efecto cambia de color rápidamente (especialmente `OroSolido` con latch→decay) y la rueda mecánica entra en blackout de tránsito.
2. **HarmonicQuantizer** — el gate temporal bloquea el cambio de color porque no ha pasado el período armónico.
3. **MoodController / EnergyOverride** — el efecto es bloqueado por cooldown o por threshold de energía (Drop Lock).

---

## 🩸 GAPS IDENTIFICADOS (Resumen Ejecutivo)

| # | Problema | Archivo(s) | Severidad |
|---|---|---|---|
| 1 | **DarkSpin sin bypass para L3** — Los efectos rápidos (< 600ms) se vuelven invisibles en movers con rueda mecánica porque cada cambio de slot impone ~550ms de blackout. No existe flag `ignoreDarkspin` o `snapColor` en intents. | `AetherSafetyMiddleware.ts`, `NodeResolver.ts` | **ALTA** |
| 2 | **Gold es una apuesta** — El `ColorTranslator` hace matching por hue circular contra los slots del fixture. Si la rueda no tiene Amber/Gold, cae en Yellow u Orange. No hay hardcodeo de "Gold" ni fallback a LED RGBW cuando la rueda falla. | `ColorTranslator.ts`, `NodeResolver.ts` | **MEDIA** |
| 3 | **El veto de movimiento NO mata efectos** — Es un bloqueo de canal (descarta `movement`), no de Intent. `OroSolido` y `CorazonLatino` ya no declaran `pan`/`tilt` desde WAVE 2690. Si "caen", el culpable es otro. | `selene-aether-adapter.ts`, `NodeArbiter.ts` | **BAJA** (percepción vs realidad) |
| 4 | **Cálculos muertos en OroSolido** — `panLeftNow`, `panRightNow`, `tiltNow` se calculan pero nunca se emiten. Código residual que podría confundir a futuros maintainers. | `OroSolido.ts` | **BAJA** |

---

## 🗺️ RUTA DE LA SEÑAL: "Selene pide Oro" → HAL decide taparlo

```
1. SeleneTitanConscious decide disparar "oro_solido"
   ↓
2. EffectManager.trigger('oro_solido') → instancia OroSolido
   ↓
3. OroSolido.getOutput() devuelve zoneOverrides con color HSL (hue ~45°)
   ↓
4. EffectManager.getCombinedOutput() combina outputs (HTP/LTP)
   ↓
5. SeleneAetherAdapter.ingest()
   → _processZoneOverrides() emite color HSL a nodos COLOR de zona 'movers-left/right'
   → ❌ DESCARTA movement (pero OroSolido ya no lo tenía)
   → Bus.push() con priority=300, source='effect'
   ↓
6. NodeArbiter.arbitrate()
   → L3 (effect) escribe canales 'r', 'g', 'b' en nodo COLOR
   → WAVE 4829: L3 domina → L0/L1 silenciados en esos canales
   → Resultado: record = { r: 0.85, g: 0.65, b: 0.12 } (oro normalizado)
   ↓
7. NodeResolver._writeNode(nodeId COLOR)
   → _translateColor(mixingType='wheel', rNorm=0.85, gNorm=0.65, bNorm=0.12)
   → ColorTranslator.findNearestColorLab() → slot "Amber" (DMX 70)
   → HarmonicQuantizer.quantize() → ¿Ha pasado el gate? 
      SI: wheelDmxNorm = 70/255
      NO: retiene lastAllowedColor
   → AetherSafetyMiddleware.checkDarkSpin(nodeId, wheelDmx=70, minTransitMs=500)
      SI cambió desde último frame: inTransit = true, duration = 550ms
      → Devuelve true → dimmer FORZADO a 0 en scratchpad
   → Escribe color_wheel = 70/255 en buffer DMX
   → Escribe dimmer = 0 en buffer DMX  ← 💀 BLACKOUT
   ↓
8. HAL.sendUniverseRaw() envía DMX al fixture
   → Fixture recibe color_wheel=70 (Ámbar) pero dimmer=0
   → Público ve: **OSCURIDAD durante 550ms**
```

---

## 📝 RECOMENDACIONES ARQUITECTÓNICAS (Solo orientativas)

1. **Bypass de DarkSpin para efectos cortos:** Añadir flag `skipDarkSpin: boolean` al `EffectFrameOutput` y propagarlo hasta `AetherSafetyMiddleware.checkDarkSpin()`. Solo efectos one-shot (< 700ms) deberían calificar.

2. **Slot "Gold" garantizado:** En el `ColorTranslator`, si `targetHue ∈ [35°, 55°]` y el fixture tiene un slot "Amber", forzar selección de ese slot con `poorMatch = false` (regla de identidad cultural para música latina).

3. **Limpiar código muerto:** Eliminar `panLeftNow`, `panRightNow`, `tiltNow` de `OroSolido.ts` y `moverPanOffset` de `CorazonLatino.ts` para evitar confusión.

4. **Diagnóstico de veto real:** Si un efecto "no sale", priorizar la búsqueda en `EffectManager` logs (`BLOCKED`, `DEGRADED`) y `EnergyOverride.ts` antes de sospechar del veto de movimiento.

---

*Reporte generado por Auditor WAVE 4830. Solo lectura. Cero modificaciones.*
