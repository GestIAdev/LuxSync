Voy a investigar a fondo la arquitectura actual del dimmer y el path de 16-bit existente para pan/tilt, para entender qué implicaría extenderlo a dimmer.

Ahora déjame ver la estructura del channel definition (`is16bit`), las definiciones de fixture profiles para dimmer, y el calibration path.

El tipo `dimmer_fine` ya existe en el parser. Ahora veamos cómo se construyen los nodos del NodeGraph — si `dimmer_fine` se agrupa con `dimmer` como canal 16-bit o se descarta.

Ahora déjame ver cómo se agrupan los canales fine con sus coarse — el proceso de pairing en el NodeExtractionPipeline.

Ahora veo el problema clave: `IMPACT_CHANNEL_TYPES` incluye `'dimmer'` pero **NO** incluye `'dimmer_fine'`. Y `KINETIC_CHANNEL_TYPES` incluye `pan_fine` y `tilt_fine`. Veamos cómo se hace el pairing coarse/fine para pan/tilt.

Ahora veamos cómo el Forge/OFL translator maneja el `is16bit` flag y cómo se hace el pairing coarse/fine en el NodeGraph.

Encontré el punto crítico. En `oflTranslator.ts:267-279`, cuando se encuentra un fine alias, solo se mapea a `pan_fine` o `tilt_fine` — **no existe mapeo para `dimmer_fine`**. Veamos cómo el NodeExtractionPipeline maneja los canales fine en el caso de dimmer.

Ahora déjame ver cómo el NodeResolver escribe el byte coarse para canales 16-bit y cómo el governor/calibration interactúa con el dimmer.

Ahora déjame ver el path del governor y el calibration para dimmer, y el DarkSpin sweep que zeroa el dimmer.

Ahora déjame ver el DarkSpin sweep que zeroa el dimmer — cómo sabe qué byte es el dimmer.

Ahora déjame ver el DMX output — cómo se transmite el universo (sACN/Art-Net) y si hay algún manejo especial de canales fine.

Ahora déjame ver el Hephaestus path (HephUtils) que ya tiene `scaleToDMX16`, y el ForgeNodeEvaluator para entender cómo se maneja 16-bit en el forge path.

Ahora déjame ver el ForgeNodeEvaluator para entender cómo maneja los canales 16-bit en el forge path.

Excelente — el ForgeNodeEvaluator ya tiene soporte 16-bit genérico vía `out.is16bit`. Ahora déjame ver cómo se compila el `is16bit` flag para los outputs del forge.

Ahora déjame ver el `IOutputDmxConfig` para confirmar que tiene `is16bit`.

Déjame ver el `IOutputDmxConfig` completo para confirmar si tiene `is16bit`.

Ahora déjame ver el `makeOutputDmxNode` en `compileForgeState.ts` para ver cómo se asigna `is16bit` durante la compilación del forge state.

Ahora tengo el panorama completo. Déjame ver un último detalle — cómo el DarkSpin sweep zeroa el dimmer y si necesitaría zeroar también el dimmer_fine.

Tengo toda la información necesaria. Ahora voy a compilar el estudio completo.

---

# ESTUDIO ARQUITECTÓNICO — MIGRACIÓN DIMMER 8-BIT → 16-BIT

## 1. Estado Actual del Soporte 16-Bit

### 1.1 Lo que YA existe (pan/tilt)

El codebase ya tiene soporte 16-bit completo para **pan y tilt** en todos los layers:

| Layer | Mecanismo | Ubicación |
|-------|-----------|-----------|
| **Parser FXT** | `is16bit: channelType.includes('fine')` | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\library\FXTParser.ts" lines="437" /> |
| **Parser OFL** | `fineChannelAliases` → `pan_fine`/`tilt_fine`, `is16bit: true` | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\forge\oflTranslator.ts" lines="267-279" /> |
| **Forge types** | `IOutputDmxConfig.is16bit?: boolean` | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\forge\types.ts" lines="244-245" /> |
| **Forge compiler** | `is16bit: cfg.is16bit ?? false` en `CompiledOutput` | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\forge\compiler\ForgeGraphCompiler.ts" lines="368" /> |
| **Forge evaluator** | `if (out.is16bit) { coarse + fine }` | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\forge\evaluator\ForgeNodeEvaluator.ts" lines="147-153" /> |
| **NodeResolver (classic)** | `if (chDef.is16bit) { raw16 = normalized * 65535; coarse + fine }` | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1411-1422" /> |
| **NodeResolver (IK)** | `val16 = safePan16; coarse = (val16 >> 8); fine = val16 & 0xFF` | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1912-1921" /> |
| **HephUtils** | `scaleToDMX16()` → `{ coarse, fine }` | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\runtime\HephUtils.ts" lines="98-106" /> |
| **Phantom detection** | `is16bit → cubre offset + 1` | <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hooks\useOrphanPhantomChannels.ts" lines="167-168" /> |

### 1.2 Lo que NO existe (dimmer)

El tipo `dimmer_fine` ya está declarado en `FXTParser.ts:37` y mapeado en `FXTParser.ts:180-181`, pero **el pipeline lo descarta** en tres puntos críticos:

1. **`IMPACT_CHANNEL_TYPES` no incluye `dimmer_fine`** (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\ingestion\NodeExtractionPipeline.ts" lines="111-113" />):
   ```typescript
   const IMPACT_CHANNEL_TYPES = new Set<string>([
     'dimmer', 'strobe', 'shutter',  // ← NO 'dimmer_fine'
   ])
   ```
   Un canal `dimmer_fine` no se clasifica como IMPACT → cae en `atmosphereChs` o se pierde.

2. **`oflTranslator.ts` no mapea `dimmer_fine`** (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\forge\oflTranslator.ts" lines="270-272" />):
   ```typescript
   if (parentType === 'pan') fineType = 'pan_fine'
   else if (parentType === 'tilt') fineType = 'tilt_fine'
   // ← NO: else if (parentType === 'dimmer') fineType = 'dimmer_fine'
   ```
   Un fine alias de dimmer se queda con `fineType = 'dimmer'` (tipo del padre), creando dos canales `dimmer` duplicados en lugar de un par coarse/fine.

3. **`HephUtils.DMX_16BIT_PARAMS` no incluye `dimmer`** (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\runtime\HephUtils.ts" lines="54" />):
   ```typescript
   const DMX_16BIT_PARAMS = new Set(['pan', 'tilt'])  // ← NO 'dimmer'
   ```

### 1.3 El path genérico 16-bit del NodeResolver SÍ funciona para dimmer

El código en <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1411-1422" /> es **agnóstico al tipo de canal**:
```typescript
if (chDef.is16bit) {
  const raw16 = Math.round(normalized * 65535)
  buf[fineIdx] = sanitizeDmxByte(raw16 & 0xFF)
  buf[bufIdx] = sanitizeDmxByte((raw16 >> 8) & 0xFF)
}
```

Si un canal `dimmer` tuviera `is16bit: true`, el byte fine se escribiría correctamente en `dmxOffset + 1`. **El problema no está en el resolver — está en la ingestión.**

---

## 2. Cambios Necesarios

### 2.1 Ingestión (3 cambios mínimos)

| # | Archivo | Cambio | Riesgo |
|---|---------|--------|--------|
| **I-1** | `NodeExtractionPipeline.ts:111` | Añadir `'dimmer_fine'` a `IMPACT_CHANNEL_TYPES` | **Medio** — ver §3.1 |
| **I-2** | `oflTranslator.ts:271-272` | Añadir `else if (parentType === 'dimmer') fineType = 'dimmer_fine'` | **Bajo** |
| **I-3** | `HephUtils.ts:54` | Añadir `'dimmer'` a `DMX_16BIT_PARAMS` | **Bajo** — solo afecta Hephaestus path |

### 2.2 Pairing Coarse/Fine

El sistema actual asume que el canal fine está en `dmxOffset + 1` (slot inmediatamente siguiente al coarse). Esto es **convención DMX estándar** pero no garantizada. El pairing se hace implícitamente:

- **FXTParser**: `is16bit: channelType.includes('fine')` — el canal fine se marca como 16-bit, pero el canal coarse **NO se marca**. El resolver escribe el byte fine en `bufIdx + 1` del canal coarse.
- **OFL**: El canal con `fineChannelAliases` se marca `is16bit: true` (coarse), y el alias se marca `is16bit: true` (fine). **Ambos** se marcan como 16-bit.

**Problema potencial**: Si el canal fine NO está en el slot inmediatamente siguiente (ej. dimmer en CH1, dimmer_fine en CH3), el resolver escribiría el byte fine en CH2 (que podría ser otro canal). Sin embargo, la convención DMX es que el fine siga al coarse, y los perfiles OFL/FXT lo respetan.

### 2.3 Calibration (escala 8-bit → 16-bit)

El calibration actual de dimmer (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="2339-2351" />) opera en dominio 8-bit:
```typescript
if (calibration.dimmerScale !== undefined) {
  v = Math.round(v * calibration.dimmerScale)  // v ∈ [0, 255]
}
if (calibration.dimmerMin !== undefined && v > 0 && v < calibration.dimmerMin) {
  v = calibration.dimmerMin  // dead-zone floor en 8-bit
}
```

Para 16-bit, esto necesitaría escalarse:
- `dimmerScale` es un multiplicador adimensional → **funciona igual** (solo cambia el rango de v).
- `dimmerMin` está en escala 0-255 → necesitaría una versión `dimmerMin16` (0-65535) o escalarse `dimmerMin * 257`.

### 2.4 DarkSpin Sweep (zeroar dimmer_fine durante blackout)

El DarkSpin cross-node sweep (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1529-1537" />) zeroa el dimmer:
```typescript
if (chDef.type !== DIMMER_CHANNEL && chDef.type !== SHUTTER_CHANNEL) continue
buf[idx] = 0
```

Si el dimmer es 16-bit, el byte fine en `idx + 1` **también debe zeroarse**. El código actual no lo hace porque `chDef.is16bit` no se verifica aquí. **Esto es un bug latente** — si el dimmer es 16-bit y el DarkSpin solo zeroa el coarse, el fixture recibe `coarse=0, fine=X` que se traduce a un valor no-cero (el fine contribuye 1/256 del coarse).

### 2.5 DMX Governor Engine

El governor (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1424-1442" />) opera en bytes 8-bit:
```typescript
finalByte = sanitizeDmxByte(applyDMXGovernors(_govMap, chDef.dmxOffset, chDef.type, rawNormalized, safeDmxValue))
buf[bufIdx] = finalByte
```

Si el governor modifica el byte coarse, el byte fine **no se actualiza** para reflejar el cambio. Esto causaría incoherencia coarse/fine. El governor necesitaría ser 16-bit aware, o ejecutarse antes del split coarse/fine.

### 2.6 DMX Personality Remapper

El personality remapper (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="1366-1378" />) eleva el dimmer al mínimo físico:
```typescript
if (rawNormalized > 0 && dmxValue < pers.minDimmer) {
  dmxValue = pers.minDimmer
}
```

`pers.minDimmer` está en escala 0-255. Para 16-bit, necesitaría escalarse o tener una versión 16-bit.

### 2.7 Soft Blackout

El soft blackout (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\NodeResolver.ts" lines="99-101" />):
```typescript
const SOFT_BLACKOUT_INTENSITY_CHANNELS = new Set<string>([
  DIMMER_CHANNEL,
])
```

Esto se usa para rampas suaves de blackout. Si el dimmer es 16-bit, la rampa necesita operar en dominio 16-bit para ser suave (una rampa 8-bit sobre un dimmer 16-bit produciría steps visibles en el byte fine).

---

## 3. Riesgos y Mitigaciones

### 3.1 RIESGO CRÍTICO — `dimmer_fine` en `IMPACT_CHANNEL_TYPES` rompe el agrupamiento

**Problema**: Al añadir `'dimmer_fine'` a `IMPACT_CHANNEL_TYPES`, el canal `dimmer_fine` se clasificará como IMPACT y se agrupará con `dimmer` en el mismo nodo. Pero el nodo IMPACT espera canales de tipo `dimmer`/`strobe`/`shutter` — un canal `dimmer_fine` podría confundir la lógica de `hasDimmer` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\ingestion\NodeExtractionPipeline.ts" lines="1047" />):
```typescript
const hasDimmer = impactChs.some(ch => this._normalizeChannelType(ch.type) === 'dimmer')
```

Esto retornaría `true` (porque `dimmer` también está en el grupo), pero el canal `dimmer_fine` se mapearía como un canal separado con `type: 'dimmer_fine'` en el `INodeChannelDef`. El resolver no reconoce `'dimmer_fine'` como `DIMMER_CHANNEL` (`'dimmer'`) → el DarkSpin sweep no lo zeroaría.

**Mitigación**: En lugar de añadir `'dimmer_fine'` a `IMPACT_CHANNEL_TYPES`, filtrar `dimmer_fine` del flujo de canales y marcar el canal `dimmer` correspondiente con `is16bit: true` durante la ingestión. Esto replica exactamente el patrón de pan/tilt donde `pan_fine` se filtra y `pan` se marca `is16bit`.

**Alternativa más segura**: En `_mapChannels`/`_mapForgeNodes`, detectar si hay un canal `dimmer_fine` adyacente y marcar el `dimmer` como `is16bit: true`, luego descartar el `dimmer_fine` del array de canales del nodo.

### 3.2 RIESGO ALTO — Incoherencia Coarse/Fine post-Governor y post-DarkSpin

**Problema**: El governor, DarkSpin, soft blackout y personality remapper modifican el byte coarse **después** del split 16-bit. El byte fine queda stale.

**Mitigación**: Reordenar el pipeline para que el split coarse/fine ocurra **al final**, después de todas las transformaciones 8-bit. O bien, hacer que cada transformación que modifica el coarse también actualice el fine.

**Opción A (reordenar)**:
```
normalized → calibration → governor → personality → DarkSpin → split 16-bit → buf
```
Esto requiere que calibration/governor/personality operen en dominio normalizado [0,1] en lugar de bytes 8-bit. Es el approach más limpio pero requiere refactorizar varias funciones.

**Opción B (propagar)**:
```
split 16-bit → calibration → governor → personality → DarkSpin → re-split if modified
```
Menos limpio pero menos invasivo. Cada punto que modifica `buf[bufIdx]` debe también actualizar `buf[bufIdx + 1]` si `chDef.is16bit`.

### 3.3 RIESGO MEDIO — Fixtures sin dimmer_fine reciben byte fantasma

**Problema**: Si el pairing coarse/fine asume que el fine está en `dmxOffset + 1`, pero el fixture no tiene dimmer_fine, el byte en `dmxOffset + 1` pertenece a **otro canal** (ej. `red`). Escribir el LSB ahí corrompería el canal adyacente.

**Mitigación**: El flag `is16bit` ya protege contra esto — solo se escribe el byte fine si `chDef.is16bit === true`, lo cual solo ocurre si el perfil declara el canal fine. **No hay riesgo** mientras el flag se asigne correctamente en ingestión.

### 3.4 RIESGO MEDIO — DMX Universe Footprint

**Problema**: Cada canal dimmer 16-bit consume 2 slots DMX en lugar de 1. Un rig con 32 PARs que antes usaba 32 slots ahora usa 64. En universos densos (>256 fixtures), esto puede exceder los 512 slots.

**Mitigación**: 
- Detectar colisiones de offset en patch time (ya existe `useOrphanPhantomChannels` que lo hace).
- Solo habilitar 16-bit dimming en fixtures que lo declaran en su perfil.
- Documentar que el footprint DMX aumenta al usar perfiles 16-bit.

### 3.5 RIESGO BAJO — Compatibilidad retroactiva de Show Files

**Problema**: Show files guardados antes de la migración no tienen `dimmer_fine` en sus perfiles. Al cargar, el dimmer sigue siendo 8-bit. Esto es **correcto** — la migración es opt-in por fixture.

**Mitigación**: Ninguna necesaria. La ausencia de `dimmer_fine` en el perfil → `is16bit: false` → path 8-bit existente.

### 3.6 RIESGO BAJO — Hephaestus path

**Problema**: `HephUtils.DMX_16BIT_PARAMS` solo incluye `pan` y `tilt`. Si se añade `dimmer`, `scaleToDMX` retornaría el byte coarse para dimmer 16-bit, pero `scaleToDMX16` retornaría el par completo. El Hephaestus runtime necesitaría usar `scaleToDMX16` para dimmer.

**Mitigación**: Verificar que el Hephaestus runtime llame `scaleToDMX16` cuando el parámetro es 16-bit. El ForgeNodeEvaluator ya lo hace vía `out.is16bit`.

---

## 4. Implicaciones Positivas

### 4.1 Resolución de dimming: 256 → 65536 pasos

| Métrica | 8-bit | 16-bit | Mejora |
|---------|-------|--------|--------|
| Steps totales | 256 | 65536 | 256× |
| Step size (% full range) | 0.39% | 0.0015% | 256× más fino |
| Step size (morph 200s, near peak) | ~2-5s dwell | ~0.01s dwell | **Imperceptible** |
| Step size (morph 60s, near peak) | ~0.6s dwell | ~0.002s dwell | **Imperceptible** |

Con 16-bit, el stepping del PAR LED desaparece **completamente** incluso con el morph de 200s. No hay necesidad de acortar los períodos del ChillAmbientEngine.

### 4.2 Eliminación del catch-22 del dithering

Con 16-bit, el dithering entre steps adyacentes produce oscilación de 0.0015% — ** below the perceptual threshold**. Se podría reintroducir dithering para eliminar el último step visible sin causar trembling.

### 4.3 Suavidad de ramps de blackout

El soft blackout y las rampas de encendido/apagado serían verdaderamente suaves. Una rampa de 2s con 16-bit produce 65536/2 = 32768 steps/s — completamente continuo a nivel perceptual.

### 4.4 Calibración de dimming más precisa

`dimmerScale` y `dimmerMin` podrían especificarse con precisión sub-1% en lugar de redondear al byte más cercano. Esto permite calibrar curvas de dimming no-lineales con mayor fidelidad.

### 4.5 Beneficio para todos los vibes, no solo chill

Cualquier fade lento (transiciones de sección, drops, build-ups) se beneficia del 16-bit. El stepping 8-bit es visible en cualquier fade < 10Hz de rate de cambio.

---

## 5. Plan de Implementación Recomendado

### Fase 1 — Ingestión (sin tocar el resolver)

1. **`oflTranslator.ts`**: Añadir mapeo `dimmer → dimmer_fine` (cambio de 1 línea).
2. **`NodeExtractionPipeline.ts`**: En `_mapChannels`/`_mapForgeNodes`, detectar `dimmer_fine` adyacente y marcar `dimmer` con `is16bit: true`, luego filtrar `dimmer_fine` del array de canales del nodo (replicando el patrón pan/tilt).
3. **`HephUtils.ts`**: Añadir `'dimmer'` a `DMX_16BIT_PARAMS`.

**Verificación**: Cargar un fixture OFL con `dimmer fineChannelAliases`, verificar que el NodeGraph tiene un canal `dimmer` con `is16bit: true` y no hay canal `dimmer_fine` duplicado.

### Fase 2 — Resolver (propagar fine en transformaciones post-split)

4. **DarkSpin sweep**: Después de `buf[idx] = 0`, añadir `if (chDef.is16bit) buf[idx + 1] = 0`.
5. **Governor**: Después de `buf[bufIdx] = finalByte`, añadir `if (chDef.is16bit) { recalcular fine desde finalByte }`.
6. **Personality remapper**: Escalar `pers.minDimmer` a 16-bit cuando `chDef.is16bit`.
7. **Calibration**: Escalar `dimmerMin` a 16-bit cuando `chDef.is16bit`.

**Opción más limpia (Fase 2 alternativa)**: Mover el split 16-bit al final del pipeline, después de todas las transformaciones. Esto requiere que calibration/governor/personality operen en dominio normalizado, no en bytes.

### Fase 3 — Validación

8. Test con fixture OFL que tenga dimmer 16-bit (ej. Robe Pointe, Martin MAC Aura).
9. Test de DarkSpin: verificar que el blackout zeroa ambos bytes.
10. Test de chill vibe: verificar que el stepping del PAR desaparece.
11. Test de Show File retrocompatibilidad: cargar show file sin dimmer_fine, verificar que sigue funcionando en 8-bit.

---

## 6. Conclusión

La migración a dimmer 16-bit es **arquitectónicamente viable** porque el 80% de la infraestructura ya existe para pan/tilt. Los cambios necesarios son:

- **3 cambios de 1 línea** en ingestión (mapeo de tipos).
- **1 cambio estructural** en el pairing coarse/fine durante la ingestión (filtrar `dimmer_fine` y marcar `dimmer` con `is16bit`).
- **4 puntos de propagación** en el resolver donde las transformaciones post-split deben actualizar el byte fine.

El riesgo principal no está en el mecanismo 16-bit en sí (que es genérico y probado para pan/tilt), sino en **las transformaciones post-split que modifican el byte coarse sin propagar al fine**. El DarkSpin sweep es el más crítico — un blackout que solo zeroa el coarse deja un residual de 0-255 en el fine que puede mantener el fixture ligeramente encendido.

La recompensa es enorme: **elimina completamente el problema de stepping del chill vibe** sin necesidad de acortar los períodos del ChillAmbientEngine, y mejora la suavidad de todos los fades lentos en todos los vibes.