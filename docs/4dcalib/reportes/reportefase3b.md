Fase 3b — la extirpación. Esta es la fase de mayor riesgo. Empiezo leyendo el blueprint §4.4 (tabla de mapeo) y §4.5, luego localizo todos los condicionales en los 5 archivos objetivo.

Tengo la tabla §4.4 completa (21 condicionales) y §4.5 (refactor physicsApplied). La directiva especifica 5 archivos: `LiquidEngineBase.ts`, `LiquidEngine71.ts`, `LiquidEngine41.ts`, `SeleneLux.ts`, `TitanEngine.ts`. Los items 16-20 están en otros archivos (KineticAdapter, KineticSystem, etc.) — fuera de scope. El item 20 necesita un trait nuevo `sedationFactor` que no existe aún.

Empiezo buscando todos los condicionales en los 5 archivos objetivo en paralelo:

Ahora busco en SeleneLux.ts y TitanEngine.ts:

El blueprint menciona `TitanEngine.ts` pero el archivo real es `TickEngine.ts`. Busco el check de `physicsApplied` en TitanEngine/TickEngine y verifico si hay un TitanEngine.ts separado:

`TitanEngine.ts` está en `engine/`. Leo las secciones relevantes de TitanEngine.ts y TickEngine.ts:

Ahora leo el contexto de TitanEngine.ts alrededor de la línea 811 para entender cómo accede al vibeProfile:

Necesito entender qué es `vibeProfile.id` en TitanEngine — si es el VibeId o el liquidProfileId. Reviso el tipo VibeProfile y una definición:

`VibeProfile.id` es el `VibeId` canónico ('techno-club'), no el liquid profile ID. Esto significa que TitanEngine puede usar `getVibeTraits(vibeProfile.id)`. Verifico `ILiquidProfile.isPureAmbient` y reviso el `isAbsoluteChillProfile` con más contexto:

Tengo el panorama completo. `VibeProfile.id` es el VibeId canónico, así que TitanEngine puede llamar `getVibeTraits(vibeProfile.id)`. `ILiquidProfile.isPureAmbient` es un flag opcional que el método `isAbsoluteChillProfile()` comprueba primero. Creo el plan completo:

### 1. VibeCanon.ts — Añadir `PhysicsMode`

### 2. LiquidEngineBase.ts — Items 1-4

**Item 1-3:** `isTechnoProfile` → `this.traits.bypassVocalPenalty`, `dmzFactor`, `backLeftGain`:

**Item 4:** `isAbsoluteChillProfile()` → `this.traits.pureAmbient`. Reemplazo la llamada y elimino el método:

Ahora elimino el método `isAbsoluteChillProfile()` que ya no tiene callers:

### 3. LiquidEngine71.ts — Items 5-7

Veo el bloque completo. Reemplazo `isLatino`/`isChill` por traits:

Las líneas 167-168 (`isLatino ? swap`) ya usan la variable `isLatino` que ahora es `this.traits.swapMovers`, así que no necesitan cambio adicional — la variable intermedia preserva la paridad.

### 4. LiquidEngine41.ts — Item 8 (telemetría muerta)

El bloque es telemetría muerta (el `console.error` ya está comentado). Elimino el condicional:

### 5. SeleneLux.ts — Items 9-14 + physicsMode

SeleneLux es el archivo con más cambios. Primero añado `PhysicsMode` al import y a la interfaz `SeleneLuxOutput`:

Ahora añado `physicsMode` a la interfaz `SeleneLuxOutput`:

Ahora añado `physicsMode` al objeto de retorno. Primero el default en la inicialización:

Ahora añado `let physicsMode` junto a `let physicsApplied` y reemplazo los condicionales. Leo la zona de la declaración y los condicionales palettePhysics:

Ahora reemplazo los condicionales. **Item 9** — palettePhysics (líneas 634 y 647). Leo el bloque completo:

**Item 10** — usesChillAmbientEngine (línea ~701). Leo:

**Item 11** — isChill para selección de engine (línea ~752). Leo:

Ahora añado `physicsMode = 'liquid-stereo'` junto a `physicsApplied = 'liquid-stereo'`:

Ahora los paths legacy. Leo las asignaciones de physicsApplied en los branches techno/rock/latino:

Añado `physicsMode = 'legacy-mono'` a los 3 paths legacy:

Ahora los condicionales legacy (items 9 repetido en línea ~819, 12, 13, 14). Leo el bloque legacy techno/latino:

Ahora el legacy latino. Leo:

**Item 12** — frontCeiling/backGateThreshold. Leo:

**Items 13-14** — photonDimmerOverride y strobeAllowed. Leo:

Ahora añado `physicsMode` al objeto de retorno final. Leo:

### 6. TitanEngine.ts — Items 15, 21

Primero añado el import de `getVibeTraits` y `PhysicsMode` a TitanEngine:

**Item 15** — isChillVibe → traits.usesChillAmbientEngine:

**Item 21** — physicsApplied → physicsMode. Leo el bloque:

### 7. Verificación: tsc + tests

`tsc` limpio. Ahora los tests:

253 failed vs baseline 251 — **2 nuevas regresiones**. Necesito identificarlas. Comparo los fallos:

Necesito identificar exactamente qué 2 tests son nuevos. Filtro los nombres de tests que pudieran estar relacionados con los cambios:

Las pruebas crean motores directamente sin inyectar traits. Necesito que el constructor y `setProfile` deriven traits del perfil cuando no se pasan explícitamente. Implemento un reverse lookup usando `liquidProfileId`:

Ahora añado el método `deriveTraitsFromProfile` y lo uso en el constructor y `setProfile`:

Ahora hago lo mismo en el constructor y añado el método estático `deriveTraitsFromProfile`:

Ahora añado el método estático `deriveTraitsFromProfile` cerca del método `setProfile`:

Verifico que `VibeTraits` se importa como tipo (no se duplica con el import de valores):

Continúo con la verificación tras el fix `deriveTraitsFromProfile`:

`tsc` limpio. Tests:

Mejoró de 9 a 8 fallos. Veo cuáles son los 8:

8 fallos en engines. Necesito comparar con el baseline. Ejecuto los mismos tests en el commit anterior (a4aa0fd2) para ver cuáles ya fallaban:

Los 8 fallos de engine son idénticos al baseline. Las 2 nuevas regresiones están en otro sitio. Ejecuto el suite completo y guardo los fallos para comparar:

Ahora hago lo mismo con el baseline (stash):

Ambos tienen 269 líneas. Comparo los diffs:

Los ficheros de fallos son idénticos. La diferencia de 2 tests puede ser flakiness (los BPM tests son conocidos por ser inestables). Verifico ejecutando el suite completo de nuevo:

**251 failed | 1679 passed** — idéntico al baseline. Cero regresiones. Los 253 del run anterior eran flakiness de BPM tests. Commit:

Commit `7d01c4a2`. Empujo:

Push exitoso: `3988d8a8..7d01c4a2 v4 -> v4`.

## Vibe Canon Fase 3b — La Extirpación completada

**Commit:** `7d01c4a2` — `VIBE CANON FASE 3b: La Extirpación — 13 condicionales erradicados`
**Push:** `3988d8a8..7d01c4a2 v4 -> v4`

---

### Resumen (6 archivos, +145/-61)

#### LiquidEngineBase.ts — Items 1-4 + backward compat

**Item 1** — `isTechnoProfile` → `this.traits.bypassVocalPenalty`:
```ts
// ANTES
const isTechnoProfile = this.profile.id === 'techno-industrial'
const vocalPenalty = isTechnoProfile ? 0 : Math.min(0.75, ...)

// DESPUÉS
const vocalPenalty = this.traits.bypassVocalPenalty ? 0 : Math.min(0.75, ...)
```

**Items 2-3** — `dmzFactor` y `backLeftGain`:
```ts
// ANTES
const dmzFactor = isTechnoProfile ? 0.55 : 0.30
const backLeftGain = isTechnoProfile ? 1.45 : 1.75

// DESPUÉS
const dmzFactor = this.traits.dmzFactor
const backLeftGain = this.traits.backLeftGain
```

**Item 4** — `isAbsoluteChillProfile()` → `this.traits.pureAmbient` (método eliminado):
```ts
// ANTES
if (this.isAbsoluteChillProfile()) { ... }
private isAbsoluteChillProfile(): boolean {
  if (this.profile.isPureAmbient) return true
  return id.includes('chill') || id.includes('ambient')
}

// DESPUÉS
if (this.traits.pureAmbient) { ... }
```

**Backward compat** — `deriveTraitsFromProfile()` para tests que no pasan traits:
```ts
private static deriveTraitsFromProfile(profile: ILiquidProfile): VibeTraits {
  for (const vibeId of VIBE_IDS) {
    if (VIBE_TRAITS[vibeId].liquidProfileId === profile.id) return VIBE_TRAITS[vibeId]
  }
  if (profile.isPureAmbient) return VIBE_TRAITS['chill-lounge']
  return VIBE_TRAITS[VIBE_FALLBACK_ID]
}
```

#### LiquidEngine71.ts — Items 5-7

```ts
// ANTES
const isLatino = profileId === LATINO_PROFILE_ID
const isChill  = profileId === CHILL_PROFILE_ID

// DESPUÉS
const isLatino = this.traits.swapMovers
const isChill  = this.traits.neutralPayload
```

#### LiquidEngine41.ts — Item 8 (telemetría muerta borrada)

```ts
// ANTES — 12 líneas de telemetría con console.error comentado
if (this.profile.id === 'techno-industrial') { ... }

// DESPUÉS — bloque eliminado (no producía output)
```

#### SeleneLux.ts — Items 9-14 + physicsMode

**Item 9** — palettePhysics (×2, path liquid + path legacy):
```ts
// ANTES
if (vibeNormalized.includes('techno') || vibeNormalized.includes('electro')) { ... }
else if (vibeNormalized.includes('latin') || ... 'fiesta' || 'reggae' || ...) { ... }

// DESPUÉS
if (this._activeTraits.palettePhysics === 'techno') { ... }
else if (this._activeTraits.palettePhysics === 'latino') { ... }
```

**Item 10-11** — usesChillAmbientEngine (×3):
```ts
// ANTES
if (vibeNormalized.includes('chill') || 'lounge' || 'ambient' || 'jazz') { ... }
const isChill = vibeNormalized.includes('chill') || 'lounge' || ...

// DESPUÉS
if (this._activeTraits.usesChillAmbientEngine) { ... }
const isChill = this._activeTraits.usesChillAmbientEngine
```

**Item 12** — frontCeiling / backGateThreshold:
```ts
// ANTES
const isTechno = vibeContext.activeVibe.toLowerCase().includes('techno');
const frontCeiling = isTechno ? 0.80 : 0.95;
const backGateThreshold = isTechno ? 0.10 : 0.06;

// DESPUÉS
const frontCeiling = this._activeTraits.frontCeiling;
const backGateThreshold = this._activeTraits.backGateThreshold;
```

**Items 13-14** — photonDimmerOverride / strobeAllowed:
```ts
// ANTES
const isChillVibeDimmer = vibeNormalized.includes('chill') || ...;
if (... && !isChillVibeDimmer) { ... }
const isChillVibeStrobe = vibeNormalized.includes('chill') || ...;
if (... && !isChillVibeStrobe) { ... }

// DESPUÉS — el trait es el negado del condicional original
if (... && this._activeTraits.photonDimmerOverride) { ... }
if (... && this._activeTraits.strobeAllowed) { ... }
```

**physicsMode** — nuevo campo en `SeleneLuxOutput`:
```ts
physicsMode: PhysicsMode;  // 'liquid-stereo' | 'legacy-mono' | 'chill-glacier' | 'none'
// Asignado en cada path: liquid-stereo, legacy-mono (techno/rock/latino), none
```

#### TitanEngine.ts — Items 15, 21

**Item 15** — isChillVibe:
```ts
// ANTES
const isChillVibe = vibeProfile.id.toLowerCase().includes('chill') ||
                    vibeProfile.id.toLowerCase().includes('lounge') || ...

// DESPUÉS
const isChillVibe = getVibeTraits(vibeProfile.id).usesChillAmbientEngine
```

**Item 21** — physicsApplied → physicsMode:
```ts
// ANTES
if (nervousOutput.physicsApplied === 'latino' ||
    nervousOutput.physicsApplied === 'techno' ||
    nervousOutput.physicsApplied === 'rock' ||
    nervousOutput.physicsApplied === 'chill' ||
    nervousOutput.physicsApplied === 'liquid-stereo') { ... }

const has7ZoneStereo = (nervousOutput.physicsApplied === 'chill' ||
                        nervousOutput.physicsApplied === 'liquid-stereo') && ...

// DESPUÉS
if (nervousOutput.physicsMode !== 'none') { ... }

const has7ZoneStereo = (nervousOutput.physicsMode === 'liquid-stereo' ||
                        nervousOutput.physicsMode === 'chill-glacier') && ...
```

---

### Desviaciones del blueprint

**Items 16-20 fuera de scope:** La directiva especificaba 5 archivos (`LiquidEngineBase`, `LiquidEngine71`, `LiquidEngine41`, `SeleneLux`, `TitanEngine`). Los items 16-20 están en `KineticAdapter`, `KineticSystem`, `SeleneTitanConscious`, `EffectManager`, `VibeMovementManager` — fuera de los 5 archivos objetivo. Quedan para fase posterior.

**Item 20 requiere trait nuevo:** `VibeMovementManager.ts:1053` usa `vibeId === 'chill-lounge' ? 0.80 : 1.0`. El blueprint sugiere un nuevo trait `sedationFactor` que no existe en `VibeTraits`. No se añadió porque la directiva no lo solicitó explícitamente.

**`physicsApplied` se preserva:** El campo `physicsApplied: string` se mantiene en `SeleneLuxOutput` por compatibilidad con tests existentes. Se añadió `physicsMode: PhysicsMode` como campo nuevo. TitanEngine usa `physicsMode`; los tests que leen `physicsApplied` siguen funcionando.

**`deriveTraitsFromProfile` (no estaba en blueprint):** Añadido para que tests y constructors directos que llaman `setProfile(profile)` sin traits sigan funcionando. Reverse lookup O(5) usando `VIBE_TRAITS.liquidProfileId`. Sólo se llama en `setProfile`/constructor, nunca en hot-path.

---

### Verificación

- `tsc --noEmit`: **exit 0**
- Tests: **251 failed | 1679 passed (1930)** — idéntico al baseline. Cero regresiones.
- Checklist §4.7: **0 condicionales `includes()` sobre nombres de género** en `core/reactivity/`, `hal/physics/`, `engine/TitanEngine.ts`.