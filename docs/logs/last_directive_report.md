**Reporte: Ejecución de WAVE 3531 — THE FRANKENSTEIN PROTOCOL (V3)**

**Resumen**
- Fecha: 2026-04-29
- Autor: GitHub Copilot (PunkOpus)
- Ramas afectadas: `v2-agnostic`
- Archivos modificados: 3

---

## Contexto del problema

Tras la purga de `SeleneLux` (Wave 3524.2), el pipeline Aether quedó parcialmente lobotomizado:

1. `TitanEngine` reemplazó la física real del `LiquidEngine71` con `calculateZoneIntents()`, una función de 5 líneas que ignoraba completamente el motor de fluidos.
2. El `AduanaFilter` (OutputGate) zerificaba los canales DMX **antes** de que el `UIProjector` los leyera, haciendo que Hyperion mostrara negro incluso con el motor activo (Blind Programming imposible).
3. Los `zoneId` del show file (`ceiling-left`, `ceiling-right`, `floor-front`, `floor-back`) no existían en `ZONE_TO_LIQUID`, causando que los fixtures cayeran al fallback geométrico erróneo.
4. `liquidEngine71` carecía de llamada a `setProfile()` al cambiar de vibe, quedando anclado en `TECHNO_PROFILE` para siempre.

---

## Intervenciones realizadas

### TAREA 1 — Restauración del motor físico real en [TitanEngine.ts](electron-app/src/engine/TitanEngine.ts)

**Problema**: `calculateZoneIntents()` (importado de `ColorProcessors.ts`) calculaba las intensidades zonales con una fórmula estática (`front: mid * 0.8 + bass * 0.2`) sin envelopes, sin umbrales por vibe, sin física de fluidos.

**Solución**: Se eliminó el import de `calculateZoneIntents` y se restauró la llamada directa a `liquidEngine71.applyBands(inp)` construyendo el `LiquidStereoInput` completo con las 7 bandas espectrales reales del frame. El resultado del motor se mapea a un `ZoneIntentMap` completo:

```typescript
// Antes (fórmula de juguete):
let zones = calculateZoneIntents(audio)

// Ahora (motor real de fluidos):
const _liquidInp: LiquidStereoInput = {
  bands: { subBass, bass, lowMid, mid, highMid, treble, ultraAir },
  isRealSilence: audio.energy < 0.01,
  isKick: audio.isBeat && audio.bass > 0.15,
  sectionType: normalizeSectionType(processedContext.section.type),
  ...
}
const _liquidResult = liquidEngine71.applyBands(_liquidInp)
let zones: ZoneIntentMap = {
  frontL: { intensity: _liquidResult.frontLeftIntensity,  paletteRole: 'primary'   },
  frontR: { intensity: _liquidResult.frontRightIntensity, paletteRole: 'primary'   },
  backL:  { intensity: _liquidResult.backLeftIntensity,   paletteRole: 'secondary' },
  backR:  { intensity: _liquidResult.backRightIntensity,  paletteRole: 'secondary' },
  front:  { intensity: avg(frontL, frontR),               paletteRole: 'primary'   },
  back:   { intensity: avg(backL, backR),                 paletteRole: 'secondary' },
  left:   { intensity: _liquidResult.moverLeftIntensity,  paletteRole: 'accent'    },
  right:  { intensity: _liquidResult.moverRightIntensity, paletteRole: 'accent'    },
}
```

### TAREA 2 — Zonas + reconexión de perfil (completadas en Wave 3534 previa)

**2a — Tabla ZONE_TO_LIQUID** en [LiquidEngineAdapter.ts](electron-app/src/core/aether/adapters/LiquidEngineAdapter.ts):

Los aliases del show file añadidos:
- `ceiling-left` → `backLeftIntensity`
- `ceiling-right` → `backRightIntensity`
- `floor-front` → avg(`frontLeft`, `frontRight`)
- `floor-back` → avg(`backLeft`, `backRight`)

El fixture `Fixture 41` (floor-front, x=0.06) ya no cae en zona "mover" por `isMid=true`.

**2b — Reconexión de perfil al cambiar vibe** en [TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts):

```typescript
// Wave 3534: llamada real que SeleneLux hacía y dejó de hacerse tras su purga
liquidEngine71.setProfile(PROFILE_REGISTRY[normalizedVibeId] ?? DEFAULT_LIQUID_PROFILE)
```

### TAREA 3 — Blind Programming: UIProjector pre-OutputGate en [TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts)

**Problema**: El bloque Aether pasaba `safeArbitrated` (post-Aduana, con OutputGate aplicado) al UIProjector. Cuando `outputEnabled = false` (estado ARMED), todos los canales estaban zerificados → Hyperion negro.

**Solución**: El UIProjector recibe ahora `arbitrated` (pre-Aduana). La Aduana solo afecta al Resolver de hardware DMX.

```typescript
// Antes (Hyperion ciego cuando output ARMED):
this._uiProjector.project(this._aetherGraph, safeArbitrated, fixtureStates, aetherConfig)

// Ahora (Hyperion siempre ve la verdad de Aether):
this._uiProjector.project(this._aetherGraph, arbitrated, fixtureStates, aetherConfig)
// safeArbitrated sigue siendo el único input del NodeResolver (DMX hardware)
```

**Flujo correcto post-Wave 3531**:
```
arbitrated  ──► UIProjector ──► Hyperion (siempre visib
safeArbitrated ──► Resolver  ──► DMX hardware (respeta mute)
```

---

## Estado de errores TypeScript

| Archivo | Errores |
|---------|---------|
| `TitanEngine.ts` | 0 |
| `TitanOrchestrator.ts` | 0 |
| `LiquidEngineAdapter.ts` | 0 |

---

## Verificación (pasos reproducibles)

```powershell
cd "c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app"
npm run build
```

En runtime, con vibe `techno-club` activo y audio presente:
- `[PROBE-DIMMER]` debe mostrar `vibeGain > 0` y `zoneInt > 0`
- Hyperion debe encender aunque el output esté en estado ARMED
- Al cambiar a `chill-lounge`, los osciladores del `CHILL_PROFILE` deben activarse

---

## Notas finales

- `calculateZoneIntents()` en `ColorProcessors.ts` queda como dead code (puede borrarse en un cleanup posterior si no lo usa nadie más).
- El motor `LiquidEngine71` es ahora la única fuente de zonas en todo el pipeline (`TitanEngine` + `LiquidImpactAdapter` + `LiquidColorAdapter`).

---
Generado automáticamente por el asistente — LuxSync Wave 3531.

**Problema identificado**
- Síntoma: Todos los fixtures aparecen en negro en la proyección UI/Hyperion.
- Causas principales detectadas:
  1. `IdleProfile` con `dimmer.floor = 0` y `dimmer.ceiling = 0` produce `vibe.intensity = 0.0` por diseño (negro intencional cuando el sistema está en `idle`).
  2. `liquidEngine71` quedaba fijo en `TECHNO_PROFILE` porque la llamada que hacía `SeleneLux.setActiveProfile()` fue purgada (Wave 3524.2).
  3. Algunos `zoneId` del show file (`ceiling-left`, `ceiling-right`, `floor-front`, `floor-back`) no existían en la tabla `ZONE_TO_LIQUID`, provocando que fixtures cayeran en resoluciones geométricas inesperadas (p. ej. become "mover" si x≈0), reduciendo energía efectiva.
  4. El `masterArbiter` arranca en estado `ARMED` (`outputEnabled = false`), y la `AduanaFilter` aplica un Output Gate que zerifica canales AUTO cuando está deshabilitado — la UI refleja exactamente ese estado.

**Investigación realizada**
- Revisado y trazado el flujo: Audio → SyncSmoother → TitanEngine.update() → FrameContext.vibe.intensity → LiquidEngineAdapter.applyBands() → selectZoneIntensity() → IntentBus → NodeArbiter → AduanaFilter (OutputGate) → NodeResolver → UIProjector → Hyperion.
- Confirmado que `current-show.v2.luxshow` contiene fixtures con `zone` = `ceiling-left/right`, `floor-front/back` y posiciones 3D válidas.
- Probes (`[PROBE-DIMMER]`, `[PROBE-COLOR]`) identifican valores de `audio.energy`, `zoneInt` y `vibeGain` en tiempo de ejecución para diagnóstico.

**Solución implementada**
1. Añadido soporte semántico para los zoneIds del show file en la tabla de lookup de zonas:
   - Archivo modificado: [electron-app/src/core/aether/adapters/LiquidEngineAdapter.ts](electron-app/src/core/aether/adapters/LiquidEngineAdapter.ts)
   - Cambios: se incorporaron las entradas `ceiling-left`, `ceiling-right`, `floor-front`, `floor-back` en `ZONE_TO_LIQUID` para mapear adecuadamente a los canales zonales de `LiquidStereoResult`.
2. Reconexión del perfil del motor físico `liquidEngine71` al cambiar el `vibe`:
   - Archivo modificado: [electron-app/src/core/orchestrator/TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts)
   - Cambios: importados `liquidEngine71` y `PROFILE_REGISTRY`, y añadida la llamada:
     `liquidEngine71.setProfile(PROFILE_REGISTRY[normalizedVibeId] ?? DEFAULT_LIQUID_PROFILE)`
     justo después de `this.engine.setActiveProfile(normalizedVibeId)`.
3. Validación estática: ambas modificaciones pasan la verificación TypeScript local (no se reportaron errores en los archivos tocados).

**Archivos modificados (resumen)**
- [electron-app/src/core/aether/adapters/LiquidEngineAdapter.ts](electron-app/src/core/aether/adapters/LiquidEngineAdapter.ts)
- [electron-app/src/core/orchestrator/TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts)

**Cómo verificar (pasos reproducibles)**
1. Construir la app (desde la raíz del repo):

```powershell
cd "c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app"
npm run build
```

2. Ejecutar la app en modo desarrollo o empaquetada.
3. En la UI:
   - Asegurarse de que el `Output` esté en `LIVE` (presionar GO/ARM según UI). Si permanece en `ARMED`, la `AduanaFilter` continuará zerificando canales.
   - Seleccionar un `vibe` distinto de `idle` (por ejemplo `techno-club` o `chill-lounge`). Esto provoca la llamada a `liquidEngine71.setProfile(...)` y actualiza el comportamiento físico.
4. Reproducir audio con energía suficiente (asegurar `audio.energy >= 0.01`) para evitar `isRealSilence`.
5. En la consola se debería ver logs tipo `[PROBE-DIMMER]` y `[PROBE-COLOR]` cada segundo con valores: `audioE`, `bandE`, `zoneInt`, `falloff`, `vibeGain`, `result`.

**Resultados esperados**
- Con `Output` en `LIVE`, `vibe` activo (no `idle`) y audio presente, los fixtures deben recibir intents distintos de 0 y la proyección Hyperion dejará de mostrar todo negro.
- Los fixtures con `zone` `floor-front` ahora mapearán correctamente a la energía frontal, en lugar de caer en la zona de movers por efecto del umbral `isMid`.

**Siguientes pasos recomendados**
- Considerar UX: si se desea que el visualizador muestre el "what-if" aunque el hardware esté ARMED, implementar una opción dev/preview que muestre `arbitrated` antes de aplicar Output Gate.
- Revisar `IdleProfile` si el comportamiento de blackout por defecto confunde a usuarios: cambiar `dimmer.floor` a un valor mínimo > 0 o restaurar el último `vibe` usado al iniciar.
- Añadir tests unitarios para `selectZoneIntensity()` cubriendo nuevos aliases de zoneId y casos limítrofes de `isMid`.

**Notas finales**
- Los cambios aplicados son locales, mínimos y seguros: no alteran la lógica de hot-path salvo los mapeos semánticos y la reconexión del perfil al cambiar `vibe`.
- Si quieres, puedo abrir un Pull Request en la rama `v2-agnostic` con estos cambios y un breve changelog.

---
Generado automáticamente por el asistente en el repositorio LuxSync.