# CHILL_DIAGNOSTIC_REPORT.md
## Auditoría del Motor Chill Out — Desacople y Suavizado

**Fecha:** 2025-11-25  
**WAVE:** 2523 — CHILL AUDIT  
**Alcance:** `ChillAmbientEngine.ts`, `SeleneLux.ts`, `TickEngine.ts`, `KineticAdapter.ts`, `ImpactAdapter.ts`, `LiquidAetherAdapter.ts`, `NodeResolver.ts`

---

## 1. Arquitectura de Desacople — Cómo se aísla el modo Chill

### 1.1 Flujo nominal (diseño intencionado)

```
ChillAmbientEngine.tick()  →  ChillAmbientFrame
    ├── morphFactor  →  SeleneLux.morphFactor → LiquidEngine71.morphFactorOverride
    ├── dimmer       →  SeleneLux.dimmerOverride → intent.masterIntensity
    ├── frontL/R     →  SeleneLux.liquidStereoOverrides.frontL/R  (OVERRIDE post-applyBands)
    ├── backL/R      →  SeleneLux.liquidStereoOverrides.backL/R   (OVERRIDE post-applyBands)
    └── moverL/R     →  SeleneLux.deepFieldMechanics → TickEngine mechanics bypass (priority 50, LTP)
```

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/reactivity/SeleneLux.ts" lines="655-742" />

El `ChillAmbientEngine` es **stateless** — función pura de `performance.now()`. Cero EMA, cero estado acumulado. Cada tick es reproducible para el mismo `t`. Esto es correcto por diseño.

### 1.2 Neutralización del LiquidEngine71

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/LiquidEngine71.ts" lines="120-163" />

Cuando `profile.id === 'chill-oceanic'`, `routeZones()` retorna valores planos neutrales (`0.5` para todas las zonas, `0` para floor/air, `ambientIntensity` del frame). Esto neutraliza las señales reactivas de los envelopes. **Correcto por diseño.**

### 1.3 PERO: `applyBands()` sigue corriendo con señal FFT real

El `LiquidEngineBase.applyBands()` se ejecuta **siempre** en chill (SeleneLux:706). Aunque `routeZones()` neutraliza el output, el `lastFrame` interno del engine contiene **señales reactivas crudas**:

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/LiquidEngineBase.ts" lines="781-810" />

El `lastFrame` tiene `frontLeft`, `moverLeft`, `moverRight` etc. calculados con la señal FFT real. El `lastResult` (post-routeZones) tiene neutrales. **El `LiquidAetherAdapter` usa `result` (neutrales), no `frame` — así que L0 es limpio.** Pero el `lastFrame` queda disponible para otros consumidores.

---

## 2. Fugas de Audio Identificadas (Contaminación)

### 2.1 FUGA #1 — `KineticAdapter` emite `pan_offset`/`tilt_offset` en chill (CRÍTICA)

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/KineticAdapter.ts" lines="268-284" />

El `KineticAdapter` (L0, priority=10) **siempre corre**, incluso en chill. En su branch `isChillVibe` emite:
- `pan_offset` = LFO glacial con `GLACIER_LERP_ALPHA = 0.0005`
- `tilt_offset` = LFO glacial
- `speed` = 0.05

**El problema:** El bypass de mechanics en TickEngine emite `pan` y `tilt` **absolutos** (priority 50, LTP), pero **NO sobrescribe** `pan_offset`/`tilt_offset` — son canales distintos.

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts" lines="1107-1126" />

El `NodeArbiter` fusiona ambos: `pan_final = clamp01(pan_base + pan_offset × amp × aspect)`. El movimiento del `ChillAmbientEngine` (pan absoluto) se **modifica** con el LFO glacial del `KineticAdapter`. Esto no genera "beats" pero añade movimiento no deseado.

**Fuga de beats real:** Si `vibe.name` no mapea exactamente a `CHILL_VIBE_ID` en el `VIBE_ID_MAP`, `isChillVibe = false` y el VMM genera movimiento **reactivo al audio** (líneas 285-311). El `VIBE_ID_MAP` incluye: `'chill-lounge'`, `'chill'`, `'lounge'`, `'ambient'`, `'jazz'`. Si el vibe activo tiene un nombre distinto (ej. `'chill-oceanic'`, `'deep-chill'`, `'meditation'`), **no mapea** y el VMM genera beats.

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/KineticAdapter.ts" lines="84-101" />

### 2.2 FUGA #2 — `vibe.intensity` varía con el audio si `masterIntensity` es null (ALTA)

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts" lines="1044-1049" />

```typescript
_v.intensity = intent.masterIntensity ?? engineAudioMetrics.energy
```

Si `intent.masterIntensity` es `null` o `undefined`, `vibe.intensity = engineAudioMetrics.energy` — que **varía con el audio frame a frame**.

El `ImpactAdapter` multiplica el dimmer zonal por `vibe.intensity`:

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/ImpactAdapter.ts" lines="179-188" />

```typescript
const intentDimmer = BaseSystem.clamp01(zoneIntensity * globalVibe)
```

Para chill, `zoneIntensity = 0.5` (neutral del LiquidEngine71), pero si `globalVibe = engineAudioMetrics.energy`, el dimmer de los PARs **varía con el audio**. Esto genera los "destellos tipo beat" en los PARs.

**Condición de la fuga:** `intent.masterIntensity` debe llegar como `null`/`undefined` desde SeleneLux. El `dimmerOverride` del `chillFrame` se setea en SeleneLux:662 (`dimmerOverride = chillFrame.dimmer`), pero depende de cómo se propague al `intent.masterIntensity` final. Si la cadena se rompe en algún punto (ej. `SeleneProtocol` o `IntentComposer`), la fuga se activa.

### 2.3 FUGA #3 — `LiquidAetherAdapter` escribe dimmer a nodos KINETIC (MEDIA)

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/adapters/LiquidAetherAdapter.ts" lines="202-211" />

El `LiquidAetherAdapter` itera sobre **todas** las `NodeFamily` (incluyendo KINETIC) y escribe `dimmer` basándose en `result.moverLeftIntensity = 0.5` (neutral). Si los nodos KINETIC tienen canal `dimmer` físico, reciben `0.5` constante desde L0. Esto no genera beats, pero **acopla el dimmer de los movers al motor líquido** en lugar de al `ChillAmbientEngine`.

El bypass de mechanics solo emite `pan`/`tilt`, no `dimmer`. Así que el dimmer de los movers viene del `LiquidAetherAdapter` (neutral 0.5), no del `chillFrame.dimmer`.

---

## 3. Generación Procedural — Fórmulas Matemáticas Actuales

### 3.1 Morph Global (El Pulso del Océano)

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/ChillAmbientEngine.ts" lines="171-176" />

```typescript
morph1      = (sin(2π × t / 200) + 1) / 2        // seno rápido, período 200s
morph2      = (sin(2π × t / 600) + 1) / 2        // seno lento, período 600s
combined    = morph1 × 0.60 + morph2 × 0.40      // suma ponderada ∈ [0, 1]
morphFactor = 0.20 + combined × 0.60             // mapeo a [0.20, 0.80]
```

### 3.2 La Ola (Offsets Zonales)

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/ChillAmbientEngine.ts" lines="178-186" />

```typescript
wavePh = t / 38.2                                // velocidad de fase (240s / 2π ≈ 38.2 s/rad)
frontL = 0.35 + 0.25 × sin(wavePh + 0.0)         // fase 0.0 rad
frontR = 0.35 + 0.25 × sin(wavePh + 0.5)         // fase 0.5 rad
backL  = 0.35 + 0.25 × sin(wavePh + 1.0)         // fase 1.0 rad
backR  = 0.35 + 0.25 × sin(wavePh + 1.2)         // fase 1.2 rad
```

Rango zonal: **[0.10, 0.60]**. Período: **240 segundos** (4 minutos).

### 3.3 Micro-Drift Boreal (Caústicas de Movers)

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/ChillAmbientEngine.ts" lines="188-203" />

```typescript
panL  = 0.50 + sin(t / 120) × 0.015              // ±1.5% pan, período ~754s
tiltL = 0.70 + cos(t / 180) × 0.010              // ±1.0% tilt, período ~1131s
panR  = 0.50 + sin(t / 120 + 4.19) × 0.015       // desfase 2/3 ciclo
tiltR = 0.70 + cos(t / 180 + π) × 0.010          // desfase 1/2 ciclo
```

**Evaluación:** Las fórmulas son matemáticamente correctas — senos puros de tiempo continuo. No hay EMA, no hay estado. El problema **no está en la generación**, sino en la **cuantización downstream**.

---

## 4. Cuello de Botella de Resolución — Los Saltos

### 4.1 Cuantización a 8 bits en NodeResolver

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/resolver/NodeResolver.ts" lines="1207-1208" />

```typescript
let dmxValue = sanitizeDmxByte(Math.round(normalized * 255))
```

**Análisis cuantitativo del escalonado:**

Para La Ola (rango [0.10, 0.60], período 240s):
- Rango DMX: `Math.round(0.10 × 255)` = 25 a `Math.round(0.60 × 255)` = 153 → **128 steps DMX**
- Velocidad: 128 steps / 240s = **0.53 steps/segundo**
- A 44Hz: cambio por frame = 0.53 / 44 = **0.012 steps/frame**
- Steps DMX enteros por frame: **0** (la mayoría de los frames)
- Frames entre saltos de 1 step: **~83 frames ≈ 1.9 segundos**

**Conclusión:** El dimmer se mantiene en el mismo valor DMX durante ~1.9 segundos, luego salta 1 step (0.39% del rango). A 44Hz, esto se percibe como **respiración escalonada** — saltos discretos cada ~2 segundos en lugar de una curva suave.

### 4.2 Cuantización adicional en AetherSafetyMiddleware

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts" lines="221-222" />

```typescript
out.pan  = rP < 0 ? 0 : rP > 255 ? 255 : Math.round(rP)
out.tilt = rT < 0 ? 0 : rT > 255 ? 255 : Math.round(rT)
```

Segunda capa de `Math.round` sobre valores ya cuantizados. No introduce steps adicionales, pero confirma que **no hay dithering ni interpolación** en ningún punto del pipeline.

### 4.3 No hay 16-bit dimmer para La Ola

El `NodeResolver` soporta 16-bit (líneas 1300-1306), pero solo se activa cuando el canal tiene `fine` channel definido en el fixture. Los PARs de tungsteno típicamente son 8-bit dimmer — no tienen canal fine.

### 4.4 No hay EMA post-cálculo

El `ChillAmbientEngine` es stateless por diseño (WAVE 6055). No aplica EMA suave post-cálculo. El valor crudo del seno se pasa directamente a `liquidStereoOverrides` → `zoneIntensities` → `IntentBus` → `NodeResolver` → `Math.round × 255`.

**No hay ninguna etapa de suavizado temporal** entre el seno continuo y la cuantización DMX de 8 bits.

---

## 5. Estructura del Código — Mapa de Archivos a Tocar

### 5.1 Para erradicar la contaminación de audio

| Archivo | Líneas | Problema | Solución propuesta |
|---|---|---|---|
| `KineticAdapter.ts` | 268-284 | Emite `pan_offset`/`tilt_offset` en chill que se suman al bypass | **Early return** en chill si `intent.movement?.mechanicsL` existe (bypass activo) |
| `KineticAdapter.ts` | 84-101 | `VIBE_ID_MAP` no cubre todos los nombres de vibe chill | Ampliar mapa o usar `vibe.name.includes('chill')` como fallback |
| `TickEngine.ts` | 1048 | `vibe.intensity = intent.masterIntensity ?? engineAudioMetrics.energy` | Para chill: forzar `vibe.intensity = chillFrame.dimmer` si está disponible |
| `TickEngine.ts` | 1107-1126 | Bypass de mechanics no emite `dimmer` | Emitir también `dimmer = chillMoverIntensity` con priority 50 |
| `LiquidAetherAdapter.ts` | 202-211 | Itera KINETIC en chill y escribe dimmer neutral | Skip KINETIC nodes cuando el frame es chill (o cuando mechanics bypass está activo) |

### 5.2 Para suavizar la respiración escalonada

| Archivo | Líneas | Problema | Solución propuesta |
|---|---|---|---|
| `ChillAmbientEngine.ts` | 167-212 | Output crudo sin suavizado temporal | Añadir **dithering** (ruido Perlin ±0.5 LSB) antes del output |
| `NodeResolver.ts` | 1208 | `Math.round(normalized × 255)` sin dithering | Añadir **blue noise** de ±0.5 LSB antes de redondear |
| `ChillAmbientEngine.ts` | 76-78 | `WAVE_AMPLITUDE = 0.25` sobre base 0.35 | Considerar amplitud mayor (0.35) para más steps DMX en el rango |

### 5.3 Para reescribir como sistema puro de curvas

| Archivo | Rol | Acción |
|---|---|---|
| `ChillAmbientEngine.ts` | Motor de curvas | **Mantener** — ya es función pura de t. Añadir dithering. |
| `SeleneLux.ts:655-742` | Routing chill | **Simplificar** — eliminar dependencia de `liquidEngine71.applyBands()` para chill |
| `LiquidEngine71.ts:120-163` | Neutralización | **Mantener** — retornar neutrales es correcto |
| `KineticAdapter.ts:268-284` | LFO de hielo | **Eliminar** — el bypass de mechanics debe ser la única fuente de movimiento en chill |
| `TickEngine.ts:1107-1126` | Bypass de mechanics | **Ampliar** — emitir dimmer además de pan/tilt |
| `NodeResolver.ts:1208` | Cuantización DMX | **Añadir dithering** para canales de dimmer en modo chill |

---

## 6. Resumen Ejecutivo

### Contaminación de Audio (Movers disparando beats)

**Causa raíz:** El `KineticAdapter` (L0, priority=10) **siempre corre** y emite `pan_offset`/`tilt_offset` a los nodos KINETIC. El bypass de mechanics del `ChillAmbientEngine` emite `pan`/`tilt` absolutos (priority 50) pero **no sobrescribe** los offsets. El `NodeArbiter` suma ambos. Si el `VIBE_ID_MAP` no reconoce el vibe chill activo, el VMM genera movimiento **reactivo al audio**.

**Fix propuesto:** Early return en `KineticAdapter.process()` cuando el bypass de mechanics esté activo (chill), o eliminar el branch `isChillVibe` por completo y depender exclusivamente del bypass.

### Respiración Escalonada (PARs a saltos)

**Causa raíz:** El `ChillAmbientEngine` produce senos suaves de 240s, pero el `NodeResolver` cuantiza a 8 bits con `Math.round(normalized × 255)`. Con 128 steps DMX en 240s, el dimmer cambia 1 step cada ~1.9 segundos. No hay dithering ni interpolación temporal.

**Fix propuesto:** Añadir **dithering con blue noise** (±0.5 LSB = ±0.00196 en [0,1]) antes de `Math.round` en `NodeResolver`, o usar **16-bit dimmer** si el hardware lo soporta. Alternativamente, añadir un micro-ruido Perlin al `ChillAmbientEngine` para que el valor nunca sea exactamente el mismo entre frames.

### Dimmer de PARs variando con audio

**Causa raíz:** `vibe.intensity = intent.masterIntensity ?? engineAudioMetrics.energy`. Si `masterIntensity` no llega, el `ImpactAdapter` multiplica el dimmer neutral por la energía del audio.

**Fix propuesto:** Para chill, forzar `vibe.intensity = 1.0` (o el dimmer del chillFrame) en `TickEngine` antes de construir el `FrameContext`, eliminando la dependencia de `engineAudioMetrics.energy`.
